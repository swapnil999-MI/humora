package configs

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"github.com/redis/go-redis/v9"
)

// RedisClient is the global Redis client.
var RedisClient *redis.Client

// InitRedis establishes the Redis connection pool.
func InitRedis() error {
	cfg := AppConfig.Redis

	dbIndex, err := strconv.Atoi(cfg.DB)
	if err != nil {
		dbIndex = 0
	}

	RedisClient = redis.NewClient(&redis.Options{
		Addr:         fmt.Sprintf("%s:%s", cfg.Host, cfg.Port),
		Password:     cfg.Password,
		DB:           dbIndex,
		PoolSize:     50,
		MinIdleConns: 10,
		DialTimeout:  5 * time.Second,
		ReadTimeout:  3 * time.Second,
		WriteTimeout: 3 * time.Second,
	})

	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := RedisClient.Ping(ctx).Err(); err != nil {
		return fmt.Errorf("failed to ping Redis: %w", err)
	}

	log.Printf("[Redis] Connection established successfully to Redis on %s:%s (DB %d)", cfg.Host, cfg.Port, dbIndex)
	return nil
}
