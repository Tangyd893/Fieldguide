package service

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/fieldguide-app/tiny-go/internal/store"
)

// Handler handles HTTP requests using the provided store.
type Handler struct {
	db *store.DB
}

// NewHandler creates a new Handler.
func NewHandler(db *store.DB) *Handler {
	return &Handler{db: db}
}

// Hello responds with a greeting.
func (h *Handler) Hello(w http.ResponseWriter, r *http.Request) {
	name := r.URL.Query().Get("name")
	if name == "" {
		name = "World"
	}
	fmt.Fprintf(w, "Hello, %s!", name)
}

// ListItems returns all items from the store as JSON.
func (h *Handler) ListItems(w http.ResponseWriter, r *http.Request) {
	items := h.db.All()
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(items)
}
