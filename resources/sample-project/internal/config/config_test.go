package config

import (
	"testing"
	"time"
)

func TestLoadAppliesDefaults(t *testing.T) {
	t.Setenv("PULSEGATE_ADDR", "")
	t.Setenv("PULSEGATE_WORKERS", "")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}
	if cfg.Addr != ":8080" {
		t.Errorf("default addr = %q, want :8080", cfg.Addr)
	}
	if cfg.Workers != 4 {
		t.Errorf("default workers = %d, want 4", cfg.Workers)
	}
	if cfg.CacheTTL != 5*time.Second {
		t.Errorf("default cache ttl = %s, want 5s", cfg.CacheTTL)
	}
}

func TestLoadReadsEnvironment(t *testing.T) {
	t.Setenv("PULSEGATE_WORKERS", "16")
	t.Setenv("PULSEGATE_CACHE_TTL", "90s")
	t.Setenv("PULSEGATE_LOG_LEVEL", "debug")

	cfg, err := Load()
	if err != nil {
		t.Fatalf("Load() returned error: %v", err)
	}
	if cfg.Workers != 16 {
		t.Errorf("workers = %d, want 16", cfg.Workers)
	}
	if cfg.CacheTTL != 90*time.Second {
		t.Errorf("cache ttl = %s, want 90s", cfg.CacheTTL)
	}
}

func TestValidateRejectsBadValues(t *testing.T) {
	cases := map[string]Config{
		"no addr":       {Addr: "", Workers: 1, QueueSize: 10, BatchSize: 1, BufferCapacity: 10, LogLevel: "info"},
		"worker count":  {Addr: ":1", Workers: 0, QueueSize: 10, BatchSize: 1, BufferCapacity: 10, LogLevel: "info"},
		"queue < batch": {Addr: ":1", Workers: 1, QueueSize: 2, BatchSize: 8, BufferCapacity: 10, LogLevel: "info"},
		"log level":     {Addr: ":1", Workers: 1, QueueSize: 10, BatchSize: 1, BufferCapacity: 10, LogLevel: "loud"},
	}
	for name, cfg := range cases {
		if err := cfg.Validate(); err == nil {
			t.Errorf("%s: Validate() = nil, want error", name)
		}
	}
}
