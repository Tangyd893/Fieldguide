// Package service holds the business rules of pulsegate.
//
// Both directions of the data flow live here: Ingestor owns the write path
// (validate → deduplicate → enqueue) and Querier owns the read path
// (cache-aside over the store). HTTP handlers only translate between JSON and
// these two types.
package service

import (
	"context"
	"errors"
	"fmt"

	"github.com/fieldguide-app/pulsegate/internal/cache"
	"github.com/fieldguide-app/pulsegate/internal/domain"
	"github.com/fieldguide-app/pulsegate/internal/store"
	"github.com/fieldguide-app/pulsegate/internal/worker"
)

// ErrDuplicate means the event id was already accepted recently; producers that
// retry after a timeout must not double-count.
var ErrDuplicate = errors.New("service: duplicate event")

// Ingestor validates and buffers incoming events.
type Ingestor struct {
	repo    store.Store
	pool    *worker.Pool
	seen    *cache.LRU // idempotency window keyed by event id
	batches chan []domain.Event
}

// NewIngestor wires the write path. seenTTL bounds the deduplication window.
func NewIngestor(repo store.Store, pool *worker.Pool, dedupeSize int) *Ingestor {
	return &Ingestor{
		repo:    repo,
		pool:    pool,
		seen:    cache.New(dedupeSize, 0),
		batches: make(chan []domain.Event, 8),
	}
}

// Accept validates a batch and hands it to the worker pool.
//
// It returns the accepted events and the number of duplicates skipped. A partial
// success is intentional: one malformed event should not discard a whole batch.
func (i *Ingestor) Accept(ctx context.Context, events []domain.Event) (accepted []domain.Event, duplicates int, err error) {
	if len(events) == 0 {
		return nil, 0, nil
	}

	for _, ev := range events {
		if verr := ev.Validate(); verr != nil {
			return accepted, duplicates, fmt.Errorf("event %s: %w", ev.ID, verr)
		}
		if _, hit := i.seen.Get(ev.ID); hit {
			duplicates++
			continue
		}
		i.seen.Put(ev.ID, struct{}{})
		accepted = append(accepted, ev)
	}

	if len(accepted) == 0 {
		return nil, duplicates, nil
	}

	job := make([]any, len(accepted))
	for n, ev := range accepted {
		job[n] = ev
	}
	if err := i.pool.Submit(ctx, job); err != nil {
		return nil, duplicates, err
	}
	return accepted, duplicates, nil
}

// Flush stores a batch synchronously — used by tests and by the shutdown path,
// where dropping the queue is not acceptable.
func (i *Ingestor) Flush(ctx context.Context, events []domain.Event) error {
	if len(events) == 0 {
		return nil
	}
	return i.repo.Save(ctx, events)
}
