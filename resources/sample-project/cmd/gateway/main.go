// Command gateway is the pulsegate entry point.
//
// It owns process lifecycle only: load config, build the layers, serve HTTP,
// then shut down gracefully. No business rule lives here — see internal/service.
package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	"github.com/fieldguide-app/pulsegate/internal/cache"
	"github.com/fieldguide-app/pulsegate/internal/config"
	"github.com/fieldguide-app/pulsegate/internal/domain"
	"github.com/fieldguide-app/pulsegate/internal/httpapi"
	"github.com/fieldguide-app/pulsegate/internal/service"
	"github.com/fieldguide-app/pulsegate/internal/store"
	"github.com/fieldguide-app/pulsegate/internal/worker"
)

// version is overridden at build time: -ldflags "-X main.version=1.2.3".
var version = "0.1.0-dev"

func main() {
	if err := run(); err != nil {
		fmt.Fprintf(os.Stderr, "pulsegate: %v\n", err)
		os.Exit(1)
	}
}

func run() error {
	cfg, err := config.Load()
	if err != nil {
		return err
	}
	logger := newLogger(cfg.LogLevel)
	logger.Info("pulsegate starting", "version", version, "config", cfg.Redacted())

	// Root context cancelled on SIGINT/SIGTERM.
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()

	// ── Layer wiring (outermost dependency first) ──
	repo := store.NewMemory(cfg.BufferCapacity)
	c := cache.New(cfg.CacheSize, cfg.CacheTTL)

	// The pool's handler is the only place that writes to the store, so the
	// service layer stays free of concurrency code.
	pool := worker.New(ctx, cfg.Workers, cfg.QueueSize, func(ctx context.Context, job []any) error {
		batch := make([]domain.Event, 0, len(job))
		for _, item := range job {
			if ev, ok := item.(domain.Event); ok {
				batch = append(batch, ev)
			}
		}
		return repo.Save(ctx, batch)
	})

	ingestor := service.NewIngestor(repo, pool, cfg.QueueSize)
	querier := service.NewQuerier(repo, c)
	handlers := httpapi.NewHandlers(ingestor, querier, pool, version)

	srv := &http.Server{
		Addr:         cfg.Addr,
		Handler:      httpapi.NewRouter(handlers, logger),
		ReadTimeout:  cfg.ReadTimeout,
		WriteTimeout: cfg.WriteTimeout,
	}

	errCh := make(chan error, 1)
	go func() {
		logger.Info("listening", "addr", cfg.Addr)
		if err := srv.ListenAndServe(); err != nil && !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
		logger.Info("shutdown signal received; draining")
	}

	return shutdown(srv, pool, cfg, logger)
}

// shutdown stops accepting requests, waits for the pool to drain, and reports
// anything still queued so operators can see what was lost.
func shutdown(srv *http.Server, pool *worker.Pool, cfg config.Config, logger *slog.Logger) error {
	ctx, cancel := context.WithTimeout(context.Background(), cfg.ShutdownTimeout)
	defer cancel()

	if err := srv.Shutdown(ctx); err != nil {
		logger.Error("http shutdown failed", "error", err)
	}

	if err := pool.Shutdown(ctx); err != nil {
		logger.Warn("pool did not drain in time", "error", err)
	}

	submitted, processed, failed, dropped, queued := pool.Stats()
	logger.Info("final pool stats",
		"submitted", submitted,
		"processed", processed,
		"failed", failed,
		"dropped", dropped,
		"queued", queued,
		"at", time.Now().UTC().Format(time.RFC3339),
	)
	return nil
}

func newLogger(level string) *slog.Logger {
	var lvl slog.Level
	switch level {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	return slog.New(slog.NewJSONHandler(os.Stdout, &slog.HandlerOptions{Level: lvl}))
}
