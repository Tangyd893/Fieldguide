# pulsegate — build/test helpers for the bundled Fieldguide demo.
BINARY := bin/pulsegate
VERSION ?= 0.1.0-dev

.PHONY: all build run test vet fmt smoke clean

all: fmt vet test build

build:
	go build -ldflags "-X main.version=$(VERSION)" -o $(BINARY) ./cmd/gateway

run:
	go run ./cmd/gateway

test:
	go test ./...

vet:
	go vet ./...

fmt:
	gofmt -w .

smoke: build
	@./$(BINARY) & pid=$$!; \
	sleep 0.5; \
	curl -s -X POST localhost:8080/v1/events \
		-H 'Content-Type: application/json' \
		-d '[{"source":"edge-1","kind":"request","level":"warn"}]'; \
	echo; \
	curl -s localhost:8080/v1/stats; \
	echo; \
	kill $$pid

clean:
	rm -rf bin
