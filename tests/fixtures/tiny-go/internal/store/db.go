package store

import "sync"

// Item represents a stored record.
type Item struct {
	ID    int    `json:"id"`
	Value string `json:"value"`
}

// DB is a simple in-memory data store.
type DB struct {
	mu    sync.RWMutex
	items []Item
}

// NewDB creates a new DB.
func NewDB(name string) *DB {
	return &DB{
		items: []Item{
			{ID: 1, Value: "alpha"},
			{ID: 2, Value: "beta"},
		},
	}
}

// All returns a copy of all items.
func (db *DB) All() []Item {
	db.mu.RLock()
	defer db.mu.RUnlock()
	result := make([]Item, len(db.items))
	copy(result, db.items)
	return result
}
