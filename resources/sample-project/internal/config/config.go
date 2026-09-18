// Package config loads runtime settings from the environment.
//
// Every knob has a safe default so `go run ./cmd/gateway` works with no setup;
// Validate then rejects combinations that would be unsafe in production.
package config

import (
	"errors"
	"fmt"
	"os"
	"strconv"
	"strings"
	"time"
)

// Config is the fully resolved gateway configuration.
type Config struct {
	Addr            string
	Workers         int
	QueueSize       int
	BatchSize       int
	BufferCapacity  int
	CacheSize       int
	CacheTTL        time.Duration
	ReadTimeout     time.Duration
	WriteTimeout    time.Duration
	ShutdownTimeout time.Duration
	LogLevel        string
}

// Load reads the environment, applying defaults for anything unset.
func Load() (Config, error) {
	cfg := Config{
		Addr:            env("PULSEGATE_ADDR", ":8080"),
		Workers:         envInt("PULSEGATE_WORKERS", 4),
		QueueSize:       envInt("PULSEGATE_QUEUE_SIZE", 256),
		BatchSize:       envInt("PULSEGATE_BATCH_SIZE", 32),
		BufferCapacity:  envInt("PULSEGATE_BUFFER", 4096),
		CacheSize:       envInt("PULSEGATE_CACHE_SIZE", 128),
		CacheTTL:        envDuration("PULSEGATE_CACHE_TTL", 5*time.Second),
		ReadTimeout:     envDuration("PULSEGATE_READ_TIMEOUT", 5*time.Second),
		WriteTimeout:    envDuration("PULSEGATE_WRITE_TIMEOUT", 10*time.Second),
		ShutdownTimeout: envDuration("PULSEGATE_SHUTDOWN_TIMEOUT", 15*time.Second),
		LogLevel:        strings.ToLower(env("PULSEGATE_LOG_LEVEL", "info")),
	}
	return cfg, cfg.Validate()
}

// Validate rejects values that would break the running process.
func (c Config) Validate() error {
	if c.Addr == "" {
		return errors.New("config: addr must not be empty")
	}
	if c.Workers < 1 || c.Workers > 1024 {
		return fmt.Errorf("config: workers must be 1..1024, got %d", c.Workers)
	}
	if c.QueueSize < c.BatchSize {
		return fmt.Errorf("config: queue size %d must be >= batch size %d", c.QueueSize, c.BatchSize)
	}
	if c.BufferCapacity < 1 {
		return fmt.Errorf("config: buffer capacity must be positive, got %d", c.BufferCapacity)
	}
	switch c.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("config: unknown log level %q", c.LogLevel)
	}
	return nil
}

// Redacted renders the configuration for the startup log.
func (c Config) Redacted() string {
	return fmt.Sprintf(
		"addr=%s workers=%d queue=%d batch=%d buffer=%d cache=%d/%s level=%s",
		c.Addr, c.Workers, c.QueueSize, c.BatchSize, c.BufferCapacity,
		c.CacheSize, c.CacheTTL, c.LogLevel,
	)
}

func env(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

func envInt(key string, fallback int) int {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	n, err := strconv.Atoi(raw)
	if err != nil {
		return fallback
	}
	return n
}

func envDuration(key string, fallback time.Duration) time.Duration {
	raw := strings.TrimSpace(os.Getenv(key))
	if raw == "" {
		return fallback
	}
	d, err := time.ParseDuration(raw)
	if err != nil {
		return fallback
	}
	return d
}
