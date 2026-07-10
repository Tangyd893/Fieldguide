package main

import (
	"fmt"
	"log"
	"net/http"

	"github.com/fieldguide-app/tiny-go/internal/service"
	"github.com/fieldguide-app/tiny-go/internal/store"
)

func main() {
	db := store.NewDB(":memory:")
	handler := service.NewHandler(db)

	http.HandleFunc("/hello", handler.Hello)
	http.HandleFunc("/items", handler.ListItems)

	fmt.Println("Starting server on :8080")
	log.Fatal(http.ListenAndServe(":8080", nil))
}
