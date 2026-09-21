# ==============================================================================
# Humora Enterprise Platform — Makefile
# ==============================================================================

.PHONY: help run stop logs migrate seed dev build test lint clean

COMPOSE_FILE := infra/local/docker-compose.yml
CONTAINER_NAME := humora-backend-local
BINARY_NAME := bin/server

GREEN := \033[32m
RESET := \033[0m

## help: Display available commands
help:
	@echo "$(GREEN)Humora Platform Commands:$(RESET)"
	@echo "  make run     - Build and start local docker containers (Backend, Postgres, Redis, MinIO)"
	@echo "  make stop    - Stop local docker containers"
	@echo "  make logs    - Tail live backend container logs"
	@echo "  make migrate - Apply pending database migrations with Atlas"
	@echo "  make dev     - Run backend server locally (go run ./cmd/server)"
	@echo "  make build   - Compile backend binary into bin/server"
	@echo "  make test    - Run unit tests"
	@echo "  make lint    - Format Go code"
	@echo "  make clean   - Remove build binaries"

## run: Start local Docker containers
run:
	@echo "$(GREEN)Starting Humora docker containers...$(RESET)"
	docker compose -f $(COMPOSE_FILE) up -d --build

## stop: Stop local Docker containers
stop:
	@echo "$(GREEN)Stopping Humora docker containers...$(RESET)"
	docker compose -f $(COMPOSE_FILE) down

## logs: Tail backend container logs
logs:
	docker logs -f $(CONTAINER_NAME)

## migrate: Apply database migrations using Atlas
migrate:
	@echo "$(GREEN)Applying database migrations with Atlas...$(RESET)"
	@if docker ps --format '{{.Names}}' | grep -q "^$(CONTAINER_NAME)$$"; then \
		docker exec -i $(CONTAINER_NAME) sh -c "cd /app/database && atlas migrate hash && atlas migrate apply --env local"; \
	elif command -v atlas >/dev/null 2>&1; then \
		cd database && atlas migrate hash && atlas migrate apply --env local; \
	else \
		docker run --rm -v "$(PWD)/database:/app/database" -w /app/database --network host arigaio/atlas migrate hash && \
		docker run --rm -e DB_HOST=192.168.1.20 -e DB_PORT=5432 -e DB_USER=postgres -e DB_PASSWORD=Paylogic2026 -e DB_NAME=paylogic_local -e DB_DEV_NAME=paylogic_dev_tmp -e DB_SSLMODE=disable -v "$(PWD)/database:/app/database" -w /app/database --network host arigaio/atlas migrate apply --env local; \
	fi

## dev: Run backend server locally
dev:
	@echo "$(GREEN)Starting Humora Backend...$(RESET)"
	go run ./cmd/server

## build: Compile binary
build:
	@echo "$(GREEN)Building binary to $(BINARY_NAME)...$(RESET)"
	@mkdir -p bin
	go build -o $(BINARY_NAME) ./cmd/server

## test: Run unit tests
test:
	@echo "$(GREEN)Running unit tests...$(RESET)"
	go test -v ./...

## lint: Format Go code
lint:
	@echo "$(GREEN)Formatting Go code...$(RESET)"
	go fmt ./...

## clean: Remove binaries
clean:
	@echo "$(GREEN)Cleaning build directory...$(RESET)"
	rm -rf bin/ server worker tmp/
