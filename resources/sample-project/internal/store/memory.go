package store

import (
	"context"
	"sort"
	"sync"
	"time"

	"github.com/fieldguide-app/pulsegate/internal/domain"
)

// Memory is a bounded, in-memory ring buffer of events.
//
// It keeps the newest `capacity` events and drops the oldest ones, which makes
// memory use predictable for a long-running gateway.
//
// TODO(tech-debt): a single mutex guards reads and writes, so query throughput
// collapses once batches get large. A per-source shard (or RWMutex plus an
// immutable snapshot) would remove the contention; the LRU cache in
// internal/cache only hides it for repeated queries.
type Memory struct {
	mu       sync.Mutex
	ring     []domain.Event
	head     int // next write position
	size     int
	capacity int
	dropped  int
	newest   time.Time
}

// NewMemory creates a store holding at most capacity events.
func NewMemory(capacity int) *Memory {
	if capacity <= 0 {
		capacity = 1024
	}
	return &Memory{ring: make([]domain.Event, capacity), capacity: capacity}
}

// Save appends a batch, evicting the oldest events when the buffer is full.
func (m *Memory) Save(_ context.Context, events []domain.Event) error {
	m.mu.Lock()
	defer m.mu.Unlock()

	for _, ev := range events {
		if m.size == m.capacity {
			m.dropped++
		} else {
			m.size++
		}
		m.ring[m.head] = ev
		m.head = (m.head + 1) % m.capacity
		if ev.At.After(m.newest) {
			m.newest = ev.At
		}
	}
	return nil
}

// List returns matching events, newest first.
func (m *Memory) List(_ context.Context, q Query) ([]domain.Event, error) {
	m.mu.Lock()
	snapshot := make([]domain.Event, 0, m.size)
	for i := 0; i < m.size; i++ {
		// Walk backwards from the most recent write.
		idx := (m.head - 1 - i + m.capacity) % m.capacity
		snapshot = append(snapshot, m.ring[idx])
	}
	m.mu.Unlock()

	limit := q.Limit
	if limit <= 0 {
		limit = 100
	}

	matched := make([]domain.Event, 0, limit)
	for _, ev := range snapshot {
		if q.Source != "" && ev.Source != q.Source {
			continue
		}
		if q.Kind != "" && ev.Kind != q.Kind {
			continue
		}
		if q.Level != "" && ev.Level != q.Level {
			continue
		}
		matched = append(matched, ev)
		if len(matched) == limit {
			break
		}
	}
	return matched, nil
}

// Stats aggregates the current buffer contents.
func (m *Memory) Stats(_ context.Context) (Stats, error) {
	m.mu.Lock()
	defer m.mu.Unlock()

	out := Stats{
		Total:    m.size,
		ByLevel:  map[domain.Level]int{},
		BySource: map[string]int{},
		Dropped:  m.dropped,
	}
	for i := 0; i < m.size; i++ {
		idx := (m.head - 1 - i + m.capacity) % m.capacity
		ev := m.ring[idx]
		out.ByLevel[ev.Level]++
		out.BySource[ev.Source]++
	}
	if !m.newest.IsZero() {
		out.NewestAt = m.newest.Format(time.RFC3339)
	}
	return out, nil
}

// Sources lists the sources currently present, sorted for stable output.
func (m *Memory) Sources(ctx context.Context) ([]string, error) {
	stats, err := m.Stats(ctx)
	if err != nil {
		return nil, err
	}
	sources := make([]string, 0, len(stats.BySource))
	for s := range stats.BySource {
		sources = append(sources, s)
	}
	sort.Strings(sources)
	return sources, nil
}
