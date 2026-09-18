package worker

import (
	"context"
	"errors"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func TestPoolProcessesAllJobs(t *testing.T) {
	var count atomic.Int64
	pool := New(context.Background(), 4, 64, func(_ context.Context, job []any) error {
		count.Add(int64(len(job)))
		return nil
	})
	defer pool.Shutdown(context.Background())

	for i := 0; i < 20; i++ {
		if err := pool.Submit(context.Background(), []any{i}); err != nil {
			t.Fatalf("Submit() error: %v", err)
		}
	}

	if !pool.Drain(2 * time.Second) {
		t.Fatal("queue did not drain")
	}
	if got := count.Load(); got != 20 {
		t.Errorf("processed %d jobs, want 20", got)
	}
	if _, processed, _, _, _ := pool.Stats(); processed != 20 {
		t.Errorf("processed counter = %d, want 20", processed)
	}
}

func TestPoolRejectsWhenQueueFull(t *testing.T) {
	release := make(chan struct{})
	pool := New(context.Background(), 1, 1, func(_ context.Context, _ []any) error {
		<-release // block the single worker
		return nil
	})
	defer func() {
		close(release)
		pool.Shutdown(context.Background())
	}()

	// First job occupies the worker, second fills the queue, third must fail fast.
	if err := pool.Submit(context.Background(), []any{1}); err != nil {
		t.Fatalf("first Submit() error: %v", err)
	}
	time.Sleep(20 * time.Millisecond)
	if err := pool.Submit(context.Background(), []any{2}); err != nil {
		t.Fatalf("second Submit() error: %v", err)
	}
	err := pool.Submit(context.Background(), []any{3})
	if !errors.Is(err, ErrQueueFull) {
		t.Fatalf("third Submit() = %v, want ErrQueueFull", err)
	}
	if _, _, _, dropped, _ := pool.Stats(); dropped != 1 {
		t.Errorf("dropped = %d, want 1", dropped)
	}
}

func TestPoolCountsHandlerFailures(t *testing.T) {
	pool := New(context.Background(), 2, 16, func(_ context.Context, _ []any) error {
		return errors.New("store unavailable")
	})
	defer pool.Shutdown(context.Background())

	for i := 0; i < 5; i++ {
		if err := pool.Submit(context.Background(), []any{i}); err != nil {
			t.Fatalf("Submit() error: %v", err)
		}
	}
	if !pool.Drain(2 * time.Second) {
		t.Fatal("queue did not drain")
	}
	if _, processed, failed, _, _ := pool.Stats(); processed != 0 || failed != 5 {
		t.Errorf("processed=%d failed=%d, want 0/5", processed, failed)
	}
}

func TestPoolSubmitHonoursCancelledContext(t *testing.T) {
	pool := New(context.Background(), 1, 8, func(_ context.Context, _ []any) error { return nil })
	defer pool.Shutdown(context.Background())

	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if err := pool.Submit(ctx, []any{1}); !errors.Is(err, context.Canceled) {
		t.Fatalf("Submit() = %v, want context.Canceled", err)
	}
}

func TestPoolShutdownWaitsForWorkers(t *testing.T) {
	var wg sync.WaitGroup
	wg.Add(1)
	pool := New(context.Background(), 2, 8, func(_ context.Context, _ []any) error {
		defer wg.Done()
		time.Sleep(10 * time.Millisecond)
		return nil
	})

	if err := pool.Submit(context.Background(), []any{1}); err != nil {
		t.Fatalf("Submit() error: %v", err)
	}
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()
	if err := pool.Shutdown(ctx); err != nil {
		t.Fatalf("Shutdown() error: %v", err)
	}
	wg.Wait() // fails the test if the handler never ran
}
