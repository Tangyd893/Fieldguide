// Package httpapi adapts HTTP requests onto the service layer.
//
// Handlers stay thin: decode JSON, call a service method, map domain errors to
// status codes. All cross-cutting behaviour (request ids, panic recovery,
// access logging) lives in the middleware in router.go.
package httpapi

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/fieldguide-app/pulsegate/internal/domain"
	"github.com/fieldguide-app/pulsegate/internal/service"
	"github.com/fieldguide-app/pulsegate/internal/store"
	"github.com/fieldguide-app/pulsegate/internal/worker"
)

// Handlers bundles the dependencies of every HTTP endpoint.
type Handlers struct {
	Ingestor *service.Ingestor
	Querier  *service.Querier
	Pool     *worker.Pool
	Version  string
	Started  time.Time
}

// NewHandlers builds the handler set.
func NewHandlers(ingest *service.Ingestor, query *service.Querier, pool *worker.Pool, version string) *Handlers {
	return &Handlers{Ingestor: ingest, Querier: query, Pool: pool, Version: version, Started: time.Now()}
}

type ingestRequest struct {
	Source  string            `json:"source"`
	Kind    string            `json:"kind"`
	Level   string            `json:"level"`
	Payload map[string]string `json:"payload"`
}

type ingestResponse struct {
	Accepted   int      `json:"accepted"`
	Duplicates int      `json:"duplicates"`
	IDs        []string `json:"ids"`
}

// Ingest handles POST /v1/events.
func (h *Handlers) Ingest(w http.ResponseWriter, r *http.Request) {
	var reqs []ingestRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<20)).Decode(&reqs); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}
	if len(reqs) == 0 {
		writeError(w, http.StatusBadRequest, "empty batch")
		return
	}

	events := make([]domain.Event, 0, len(reqs))
	for _, req := range reqs {
		level := domain.Level(strings.ToLower(strings.TrimSpace(req.Level)))
		if level == "" {
			level = domain.LevelInfo
		}
		ev, err := domain.NewEvent(req.Source, req.Kind, level, req.Payload)
		if err != nil {
			writeError(w, http.StatusUnprocessableEntity, err.Error())
			return
		}
		events = append(events, ev)
	}

	accepted, duplicates, err := h.Ingestor.Accept(r.Context(), events)
	if err != nil {
		switch {
		case errors.Is(err, worker.ErrQueueFull):
			writeError(w, http.StatusServiceUnavailable, "ingest queue full, retry shortly")
		case errors.Is(err, context.Canceled):
			writeError(w, http.StatusRequestTimeout, "request cancelled")
		default:
			writeError(w, http.StatusUnprocessableEntity, err.Error())
		}
		return
	}

	// Writes make cached reads stale.
	h.Querier.Invalidate()

	ids := make([]string, 0, len(accepted))
	for _, ev := range accepted {
		ids = append(ids, ev.ID)
	}
	writeJSON(w, http.StatusAccepted, ingestResponse{
		Accepted:   len(accepted),
		Duplicates: duplicates,
		IDs:        ids,
	})
}

// List handles GET /v1/events.
func (h *Handlers) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	limit := 50
	if raw := q.Get("limit"); raw != "" {
		n, err := strconv.Atoi(raw)
		if err != nil || n < 1 || n > 500 {
			writeError(w, http.StatusBadRequest, "limit must be an integer between 1 and 500")
			return
		}
		limit = n
	}

	events, err := h.Querier.Recent(r.Context(), store.Query{
		Source: strings.TrimSpace(q.Get("source")),
		Kind:   strings.TrimSpace(q.Get("kind")),
		Level:  domain.Level(strings.ToLower(strings.TrimSpace(q.Get("level")))),
		Limit:  limit,
	})
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusOK, map[string]any{"events": events, "count": len(events)})
}

// Stats handles GET /v1/stats.
func (h *Handlers) Stats(w http.ResponseWriter, r *http.Request) {
	stats, err := h.Querier.Stats(r.Context())
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	submitted, processed, failed, dropped, queued := h.Pool.Stats()
	hits, misses, cacheSize := h.Querier.CacheStats()

	writeJSON(w, http.StatusOK, map[string]any{
		"store": stats,
		"pool": map[string]int{
			"submitted": submitted,
			"processed": processed,
			"failed":    failed,
			"dropped":   dropped,
			"queued":    queued,
		},
		"cache":  map[string]int{"hits": hits, "misses": misses, "size": cacheSize},
		"uptime": time.Since(h.Started).String(),
	})
}

// Health handles GET /healthz.
func (h *Handlers) Health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]string{"status": "ok", "version": h.Version})
}

func writeJSON(w http.ResponseWriter, status int, body any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(body)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
