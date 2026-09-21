package configs

import (
	"fmt"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
)

// DB is the global database connection pool.
var DB *sqlx.DB

// ConnectDB establishes a database connection using the loaded AppConfig settings.
func ConnectDB() error {
	cfg := AppConfig.DB

	dsn := fmt.Sprintf("host=%s port=%s user=%s password=%s dbname=%s sslmode=%s",
		cfg.Host, cfg.Port, cfg.User, cfg.Password, cfg.Name, cfg.SSLMode)

	var err error
	DB, err = sqlx.Connect("postgres", dsn)
	if err != nil {
		return fmt.Errorf("failed to connect to database: %w", err)
	}

	// Optimize connection pooling to prevent connection churn and memory allocation spikes
	DB.SetMaxOpenConns(50)
	DB.SetMaxIdleConns(25)
	DB.SetConnMaxLifetime(15 * time.Minute)
	DB.SetConnMaxIdleTime(5 * time.Minute)

	log.Printf("[DB] Database connection established successfully via sqlx to database %q", cfg.Name)
	return nil
}
