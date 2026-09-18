// Package store defines the persistence boundary of pulsegate.
//
// The service layer depends on the Store interface, never on a concrete
// backend, which is what lets the demo run with an in-memory implementation
// while a real deployment could swap in Postgres or ClickHouse.
package store

import (
	"context"
	"errors"

	"github.com/fieldguide-app/pulsegate/internal/domain"
)

// ErrNotFound is returned when a query targets a source that does not exist.
var ErrNotFound = errors.New("store: not found")

// Query describes a read request. Zero values mean "no filter".
type Query struct {
	Source string
	Kind   string
	Level  domain.Level
	Limit  int
}

// Stats is the aggregate counter snapshot exposed by /v1/stats.
type Stats struct {
	Total    int                  `json:"total"`
	ByLevel  map[domain.Level]int `json:"byLevel"`
	BySource map[string]int       `json:"bySource"`
	Dropped  int                  `json:"dropped"`
	NewestAt string               `json:"newestAt,omitempty"`
}

// Store is the write/read contract used by the service layer.
type Store interface {
	Save(ctx context.Context, events []domain.Event) error
	List(ctx context.Context, q Query) ([]domain.Event, error)
	Stats(ctx context.Context) (Stats, error)
}
