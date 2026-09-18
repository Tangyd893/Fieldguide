// Package worker runs the write path off the request goroutines.
//
// Ingest handlers must never block on the store, so they hand events to a
// bounded pool. The bound matters: an unbounded queue turns a slow store into
// unbounded memory growth, and callers would rather get a fast "queue full"
// than an OOM minutes later.
package worker

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"time"
)

// ErrQueueFull is returned by Submit when the buffer cannot accept more work.
var ErrQueueFull = errors.New("worker: queue full")

// BatchHandler processes one job. Returning an error is logged and counted,
// not retried — the demo keeps retry policy out of scope on purpose.
type BatchHandler func(ctx context.Context, job []any) error

// Pool is a fixed-size worker pool with a bounded job queue.
type Pool struct {
	handler BatchHandler
	jobs    chan []any
	wg      sync.WaitGroup

	ctx    context.Context
	cancel context.CancelFunc

	submitted atomic.Int64
	processed atomic.Int64
	failed    atomic.Int64
	dropped   atomic.Int64
}

// New starts `workers` goroutines draining a queue of `queueSize` jobs.
func New(parent context.Context, workers, queueSize int, handler BatchHandler) *Pool {
	if workers <= 0 {
		workers = 4
	}
	if queueSize <= 0 {
		queueSize = 128
	}
	ctx, cancel := context.WithCancel(parent)
	p := &Pool{
		handler: handler,
		jobs:    make(chan []any, queueSize),
		ctx:     ctx,
		cancel:  cancel,
	}
	for i := 0; i < workers; i++ {
		p.wg.Add(1)
		go p.run()
	}
	return p
}

func (p *Pool) run() {
	defer p.wg.Done()
	for {
		select {
		case <-p.ctx.Done():
			return
		case job, ok := <-p.jobs:
			if !ok {
				return
			}
			if err := p.handler(p.ctx, job); err != nil {
				p.failed.Add(1)
				continue
			}
			p.processed.Add(1)
		}
	}
}

// Submit enqueues a job. It fails fast when the request is cancelled or the
// queue is saturated, so HTTP handlers can answer 503 instead of piling up.
func (p *Pool) Submit(ctx context.Context, job []any) error {
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-p.ctx.Done():
		return context.Canceled
	default:
	}

	select {
	case p.jobs <- job:
		p.submitted.Add(1)
		return nil
	case <-ctx.Done():
		return ctx.Err()
	default:
		p.dropped.Add(1)
		return ErrQueueFull
	}
}

// Stats returns a snapshot of pool counters.
func (p *Pool) Stats() (submitted, processed, failed, dropped, queued int) {
	return int(p.submitted.Load()), int(p.processed.Load()), int(p.failed.Load()),
		int(p.dropped.Load()), len(p.jobs)
}

// Shutdown stops accepting work, drains what is queued and waits for workers.
// It returns ctx.Err() if the deadline passes first.
func (p *Pool) Shutdown(ctx context.Context) error {
	close(p.jobs)

	done := make(chan struct{})
	go func() {
		p.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		p.cancel()
		return nil
	case <-ctx.Done():
		p.cancel() // abandon remaining jobs
		return ctx.Err()
	}
}

// Drain lets tests and shutdown paths wait for the queue to empty.
func (p *Pool) Drain(timeout time.Duration) bool {
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if len(p.jobs) == 0 {
			return true
		}
		time.Sleep(2 * time.Millisecond)
	}
	return len(p.jobs) == 0
}
