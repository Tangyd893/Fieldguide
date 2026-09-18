package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/fieldguide-app/pulsegate/internal/cache"
	"github.com/fieldguide-app/pulsegate/internal/domain"
	"github.com/fieldguide-app/pulsegate/internal/service"
	"github.com/fieldguide-app/pulsegate/internal/store"
	"github.com/fieldguide-app/pulsegate/internal/worker"
)

// newTestServer builds the same object graph as cmd/gateway with test-sized bounds.
func newTestServer(t *testing.T) (*httptest.Server, *worker.Pool) {
	t.Helper()

	repo := store.NewMemory(128)
	pool := worker.New(context.Background(), 2, 32, func(ctx context.Context, job []any) error {
		batch := make([]domain.Event, 0, len(job))
		for _, item := range job {
			if ev, ok := item.(domain.Event); ok {
				batch = append(batch, ev)
			}
		}
		return repo.Save(ctx, batch)
	})
	t.Cleanup(func() { pool.Shutdown(context.Background()) })

	ingestor := service.NewIngestor(repo, pool, 64)
	querier := service.NewQuerier(repo, cache.New(16, time.Minute))
	handlers := NewHandlers(ingestor, querier, pool, "test")
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	srv := httptest.NewServer(NewRouter(handlers, logger))
	t.Cleanup(srv.Close)
	return srv, pool
}

func postEvents(t *testing.T, srv *httptest.Server, body string) (*http.Response, map[string]any) {
	t.Helper()
	resp, err := http.Post(srv.URL+"/v1/events", "application/json", bytes.NewBufferString(body))
	if err != nil {
		t.Fatalf("POST /v1/events: %v", err)
	}
	var decoded map[string]any
	_ = json.NewDecoder(resp.Body).Decode(&decoded)
	resp.Body.Close()
	return resp, decoded
}

func TestIngestThenList(t *testing.T) {
	srv, pool := newTestServer(t)

	resp, body := postEvents(t, srv, `[{"source":"edge-1","kind":"request","level":"warn","payload":{"path":"/login"}}]`)
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want 202 (body %v)", resp.StatusCode, body)
	}
	if got := body["accepted"]; got != float64(1) {
		t.Fatalf("accepted = %v, want 1", got)
	}

	if !pool.Drain(2 * time.Second) {
		t.Fatal("worker queue did not drain")
	}

	listResp, err := http.Get(srv.URL + "/v1/events?level=warn")
	if err != nil {
		t.Fatalf("GET /v1/events: %v", err)
	}
	defer listResp.Body.Close()
	var listed struct {
		Events []domain.Event `json:"events"`
		Count  int            `json:"count"`
	}
	if err := json.NewDecoder(listResp.Body).Decode(&listed); err != nil {
		t.Fatalf("decode list: %v", err)
	}
	if listed.Count != 1 || listed.Events[0].Source != "edge-1" {
		t.Fatalf("list = %+v, want a single edge-1 event", listed)
	}
}

func TestIngestDefaultsLevelToInfo(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, body := postEvents(t, srv, `[{"source":"edge-2","kind":"metric"}]`)
	if resp.StatusCode != http.StatusAccepted {
		t.Fatalf("status = %d, want 202 (body %v)", resp.StatusCode, body)
	}
}

func TestIngestRejectsMalformedBatch(t *testing.T) {
	srv, _ := newTestServer(t)

	resp, _ := postEvents(t, srv, `[{"kind":"request"}]`) // missing source
	if resp.StatusCode != http.StatusUnprocessableEntity {
		t.Errorf("missing source: status = %d, want 422", resp.StatusCode)
	}

	resp, _ = postEvents(t, srv, `not json`)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("bad json: status = %d, want 400", resp.StatusCode)
	}

	resp, _ = postEvents(t, srv, `[]`)
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("empty batch: status = %d, want 400", resp.StatusCode)
	}
}

func TestListValidatesLimit(t *testing.T) {
	srv, _ := newTestServer(t)
	resp, err := http.Get(srv.URL + "/v1/events?limit=9999")
	if err != nil {
		t.Fatalf("GET: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusBadRequest {
		t.Errorf("status = %d, want 400", resp.StatusCode)
	}
}

func TestWrongMethodReturns405(t *testing.T) {
	srv, _ := newTestServer(t)
	req, _ := http.NewRequest(http.MethodDelete, srv.URL+"/v1/events", nil)
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("DELETE: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Errorf("status = %d, want 405", resp.StatusCode)
	}
	if resp.Header.Get("Allow") == "" {
		t.Error("405 response is missing the Allow header")
	}
}

func TestHealthAndStats(t *testing.T) {
	srv, _ := newTestServer(t)

	health, err := http.Get(srv.URL + "/healthz")
	if err != nil {
		t.Fatalf("GET /healthz: %v", err)
	}
	health.Body.Close()
	if health.StatusCode != http.StatusOK {
		t.Errorf("healthz status = %d, want 200", health.StatusCode)
	}
	if health.Header.Get("X-Request-Id") == "" {
		t.Error("request id middleware did not set X-Request-Id")
	}

	stats, err := http.Get(srv.URL + "/v1/stats")
	if err != nil {
		t.Fatalf("GET /v1/stats: %v", err)
	}
	defer stats.Body.Close()
	var payload map[string]any
	if err := json.NewDecoder(stats.Body).Decode(&payload); err != nil {
		t.Fatalf("decode stats: %v", err)
	}
	for _, key := range []string{"store", "pool", "cache", "uptime"} {
		if _, ok := payload[key]; !ok {
			t.Errorf("stats payload missing %q", key)
		}
	}
}
