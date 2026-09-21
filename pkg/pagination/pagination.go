package pagination

import (
	"strconv"

	"github.com/gofiber/fiber/v2"
)

// PaginationParams contains common pagination input options.
type PaginationParams struct {
	Page     int    `json:"page"`
	Limit    int    `json:"limit"`
	Offset   int    `json:"offset"`
	SortBy   string `json:"sort_by"`
	Order    string `json:"order"`
	Search   string `json:"search"`
}

// Meta represents pagination metadata in responses.
type Meta struct {
	CurrentPage int   `json:"current_page"`
	PerPage     int   `json:"per_page"`
	TotalItems  int64 `json:"total_items"`
	TotalPages  int   `json:"total_pages"`
	HasNext     bool  `json:"has_next"`
	HasPrev     bool  `json:"has_prev"`
}

// PaginatedResponse wraps a slice of items with metadata.
type PaginatedResponse[T any] struct {
	Items []T  `json:"items"`
	Meta  Meta `json:"meta"`
}

// ExtractPagination extracts page, limit, sort_by, order, and search from query params.
func ExtractPagination(c *fiber.Ctx) PaginationParams {
	page, _ := strconv.Atoi(c.Query("page", "1"))
	if page < 1 {
		page = 1
	}

	limit, _ := strconv.Atoi(c.Query("limit", "20"))
	if limit < 1 {
		limit = 20
	} else if limit > 100 {
		limit = 100
	}

	offset := (page - 1) * limit
	sortBy := c.Query("sort_by", "created_at")
	order := c.Query("order", "desc")
	search := c.Query("search", "")

	return PaginationParams{
		Page:   page,
		Limit:  limit,
		Offset: offset,
		SortBy: sortBy,
		Order:  order,
		Search: search,
	}
}

// BuildMeta calculates pagination metadata.
func BuildMeta(totalItems int64, page, limit int) Meta {
	totalPages := int((totalItems + int64(limit) - 1) / int64(limit))
	if totalPages == 0 {
		totalPages = 1
	}

	return Meta{
		CurrentPage: page,
		PerPage:     limit,
		TotalItems:  totalItems,
		TotalPages:  totalPages,
		HasNext:     page < totalPages,
		HasPrev:     page > 1,
	}
}
