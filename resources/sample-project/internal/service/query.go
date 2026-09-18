package service

import (
	"context"
	"fmt"

	"github.com/fieldguide-app/pulsegate/internal/cache"
	"github.com/fieldguide-app/pulsegate/internal/domain"
	"github.com/fieldguide-app/pulsegate/internal/store"
)

// Querier serves reads with a cache-aside strategy.
//
// The cache key is derived from the filter, so the hot "latest errors" poll
// costs one map lookup instead of a store scan. Writes invalidate the whole
// cache: the demo optimises for correctness over cleverness.
type Querier struct {
	repo  store.Store
	cache *cache.LRU
}

// NewQuerier wires the read path.
func NewQuerier(repo store.Store, c *cache.LRU) *Querier {
	return &Querier{repo: repo, cache: c}
}

// Recent returns events matching the filter, newest first.
func (q *Querier) Recent(ctx context.Context, req store.Query) ([]domain.Event, error) {
	key := cacheKey(req)
	if v, ok := q.cache.Get(key); ok {
		if events, ok := v.([]domain.Event); ok {
			return events, nil
		}
	}

	events, err := q.repo.List(ctx, req)
	if err != nil {
		return nil, err
	}
	q.cache.Put(key, events)
	return events, nil
}

// Stats proxies the store aggregate (uncached: it is cheap and must be fresh).
func (q *Querier) Stats(ctx context.Context) (store.Stats, error) {
	return q.repo.Stats(ctx)
}

// Invalidate drops cached reads after a write landed.
func (q *Querier) Invalidate() {
	q.cache.InvalidateAll()
}

// CacheStats exposes hit/miss counters for the /v1/stats endpoint.
func (q *Querier) CacheStats() (hits, misses, size int) {
	return q.cache.Stats()
}

func cacheKey(req store.Query) string {
	return fmt.Sprintf("%s|%s|%s|%d", req.Source, req.Kind, req.Level, req.Limit)
}
