// Package cache holds a small LRU used to serve repeated queries cheaply.
//
// It exists because the read path is dominated by a handful of hot queries
// (a dashboard polling "latest errors" for example); caching them keeps the
// store mutex out of the way.
package cache

import (
	"container/list"
	"sync"
	"time"
)

type entry struct {
	key     string
	value   any
	expires time.Time
}

// LRU is a concurrency-safe, capacity- and TTL-bounded cache.
type LRU struct {
	mu       sync.Mutex
	capacity int
	ttl      time.Duration
	items    map[string]*list.Element
	order    *list.List // front = most recently used

	hits   int
	misses int
}

// New creates a cache holding at most capacity entries. ttl <= 0 disables expiry.
func New(capacity int, ttl time.Duration) *LRU {
	if capacity <= 0 {
		capacity = 64
	}
	return &LRU{
		capacity: capacity,
		ttl:      ttl,
		items:    make(map[string]*list.Element, capacity),
		order:    list.New(),
	}
}

// Get returns the cached value and whether it was found and still fresh.
func (c *LRU) Get(key string) (any, bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	el, ok := c.items[key]
	if !ok {
		c.misses++
		return nil, false
	}
	item := el.Value.(*entry)
	if c.ttl > 0 && time.Now().After(item.expires) {
		c.order.Remove(el)
		delete(c.items, key)
		c.misses++
		return nil, false
	}
	c.order.MoveToFront(el)
	c.hits++
	return item.value, true
}

// Put stores a value, evicting the least recently used entry when full.
func (c *LRU) Put(key string, value any) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if el, ok := c.items[key]; ok {
		item := el.Value.(*entry)
		item.value = value
		if c.ttl > 0 {
			item.expires = time.Now().Add(c.ttl)
		}
		c.order.MoveToFront(el)
		return
	}

	el := c.order.PushFront(&entry{key: key, value: value, expires: c.expiresAt()})
	c.items[key] = el

	for c.order.Len() > c.capacity {
		oldest := c.order.Back()
		if oldest == nil {
			break
		}
		c.order.Remove(oldest)
		delete(c.items, oldest.Value.(*entry).key)
	}
}

// Invalidate drops one key and reports whether it was present.
func (c *LRU) Invalidate(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()

	el, ok := c.items[key]
	if !ok {
		return false
	}
	c.order.Remove(el)
	delete(c.items, key)
	return true
}

// InvalidateAll empties the cache; used after a write makes results stale.
func (c *LRU) InvalidateAll() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.items = make(map[string]*list.Element, c.capacity)
	c.order.Init()
}

// Stats reports cache effectiveness for /v1/stats.
func (c *LRU) Stats() (hits, misses, size int) {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.hits, c.misses, c.order.Len()
}

func (c *LRU) expiresAt() time.Time {
	if c.ttl <= 0 {
		return time.Time{}
	}
	return time.Now().Add(c.ttl)
}
