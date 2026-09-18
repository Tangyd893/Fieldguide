// Package domain holds the core types of pulsegate and their invariants.
//
// Nothing in this package imports another pulsegate package: it is the innermost
// layer, so every other layer is allowed to depend on it and never the reverse.
package domain

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
	"time"
)

// Level is the severity attached to an event.
type Level string

const (
	LevelDebug Level = "debug"
	LevelInfo  Level = "info"
	LevelWarn  Level = "warn"
	LevelError Level = "error"
)

// Validation errors returned by Event.Validate. They are sentinels so callers
// can map them onto HTTP status codes without string matching.
var (
	ErrEmptySource  = errors.New("domain: source is required")
	ErrEmptyKind    = errors.New("domain: kind is required")
	ErrUnknownLevel = errors.New("domain: unknown level")
	ErrTooManyTags  = errors.New("domain: payload exceeds limit")
)

// maxPayloadKeys bounds a single event so one producer cannot exhaust memory.
const maxPayloadKeys = 32

// Event is one observation reported by a producer.
type Event struct {
	ID      string            `json:"id"`
	Source  string            `json:"source"`
	Kind    string            `json:"kind"`
	Level   Level             `json:"level"`
	Payload map[string]string `json:"payload,omitempty"`
	At      time.Time         `json:"at"`
}

// NewEvent builds a validated event with a generated identifier.
func NewEvent(source, kind string, level Level, payload map[string]string) (Event, error) {
	if payload == nil {
		payload = map[string]string{}
	}
	ev := Event{
		ID:      newID(),
		Source:  strings.TrimSpace(source),
		Kind:    strings.TrimSpace(kind),
		Level:   level,
		Payload: payload,
		At:      time.Now().UTC(),
	}
	if err := ev.Validate(); err != nil {
		return Event{}, err
	}
	return ev, nil
}

// Validate reports whether the event is well formed.
func (e Event) Validate() error {
	if e.Source == "" {
		return ErrEmptySource
	}
	if e.Kind == "" {
		return ErrEmptyKind
	}
	switch e.Level {
	case LevelDebug, LevelInfo, LevelWarn, LevelError:
	default:
		return fmt.Errorf("%w: %q", ErrUnknownLevel, e.Level)
	}
	if len(e.Payload) > maxPayloadKeys {
		return fmt.Errorf("%w: %d keys", ErrTooManyTags, len(e.Payload))
	}
	return nil
}

func newID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		// crypto/rand only fails on platforms without an entropy source; the
		// timestamp still gives us a usable, if less unique, identifier.
		return fmt.Sprintf("ev-%d", time.Now().UnixNano())
	}
	return "ev-" + hex.EncodeToString(b[:])
}
