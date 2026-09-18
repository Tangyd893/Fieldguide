package httpapi

import (
	"context"
	"log/slog"
	"net/http"
	"sync/atomic"
	"time"
)

// middleware is the shape every cross-cutting concern follows.
type middleware func(http.Handler) http.Handler

var requestCounter atomic.Uint64

// NewRouter wires the endpoints and the middleware chain.
//
// Chain order matters and reads outside-in: requestID must be outermost so every
// log line has an id, and recover must wrap the handlers it protects.
func NewRouter(h *Handlers, logger *slog.Logger) http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("/healthz", h.Health)
	mux.HandleFunc("/v1/events", methodSwitch(map[string]http.HandlerFunc{
		http.MethodPost: h.Ingest,
		http.MethodGet:  h.List,
	}))
	mux.HandleFunc("/v1/stats", h.Stats)

	return chain(mux,
		requestID,
		recoverPanic(logger),
		accessLog(logger),
	)
}

func chain(h http.Handler, mws ...middleware) http.Handler {
	for i := len(mws) - 1; i >= 0; i-- {
		h = mws[i](h)
	}
	return h
}

// methodSwitch returns 405 (with an Allow header) instead of 404 for known
// paths hit with the wrong verb.
func methodSwitch(byMethod map[string]http.HandlerFunc) http.HandlerFunc {
	allowed := make([]string, 0, len(byMethod))
	for m := range byMethod {
		allowed = append(allowed, m)
	}
	return func(w http.ResponseWriter, r *http.Request) {
		if fn, ok := byMethod[r.Method]; ok {
			fn(w, r)
			return
		}
		w.Header().Set("Allow", joinMethods(allowed))
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func joinMethods(methods []string) string {
	out := ""
	for i, m := range methods {
		if i > 0 {
			out += ", "
		}
		out += m
	}
	return out
}

type ctxKey string

const requestIDKey ctxKey = "request-id"

func requestID(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-Id")
		if id == "" {
			id = "req-" + time.Now().UTC().Format("20060102T150405.000")
		}
		w.Header().Set("X-Request-Id", id)
		next.ServeHTTP(w, r.WithContext(context.WithValue(r.Context(), requestIDKey, id)))
	})
}

// RequestID reads the id injected by the requestID middleware.
func RequestID(ctx context.Context) string {
	if v, ok := ctx.Value(requestIDKey).(string); ok {
		return v
	}
	return ""
}

func recoverPanic(logger *slog.Logger) middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			defer func() {
				if rec := recover(); rec != nil {
					logger.Error("panic recovered",
						"requestId", RequestID(r.Context()),
						"path", r.URL.Path,
						"panic", rec,
					)
					writeError(w, http.StatusInternalServerError, "internal error")
				}
			}()
			next.ServeHTTP(w, r)
		})
	}
}

// statusRecorder captures the status code so the access log can report it.
type statusRecorder struct {
	http.ResponseWriter
	status int
	bytes  int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func (s *statusRecorder) Write(b []byte) (int, error) {
	if s.status == 0 {
		s.status = http.StatusOK
	}
	n, err := s.ResponseWriter.Write(b)
	s.bytes += n
	return n, err
}

func accessLog(logger *slog.Logger) middleware {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			start := time.Now()
			rec := &statusRecorder{ResponseWriter: w}
			next.ServeHTTP(rec, r)

			id := requestCounter.Add(1)
			logger.Info("request",
				"seq", id,
				"requestId", RequestID(r.Context()),
				"method", r.Method,
				"path", r.URL.Path,
				"status", rec.status,
				"bytes", rec.bytes,
				"durationMs", time.Since(start).Milliseconds(),
			)
		})
	}
}
