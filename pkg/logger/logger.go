package logger

import (
	"context"
	"humora-backend/configs"
	"log/slog"
	"os"
	"strings"
)

// InitLogger initializes the global structured logger.
func InitLogger() {
	logLevel := slog.LevelInfo
	env := "local"

	if configs.AppConfig != nil {
		if configs.AppConfig.Server.Env != "" {
			env = configs.AppConfig.Server.Env
		}

		switch strings.ToLower(configs.AppConfig.Server.LogLevel) {
		case "debug":
			logLevel = slog.LevelDebug
		case "warn":
			logLevel = slog.LevelWarn
		case "error":
			logLevel = slog.LevelError
		default:
			if env == "local" {
				logLevel = slog.LevelDebug
			} else {
				logLevel = slog.LevelInfo
			}
		}
	}

	opts := &slog.HandlerOptions{
		Level: logLevel,
	}

	// Include file/line info only in debug/local configurations
	if logLevel == slog.LevelDebug {
		opts.AddSource = true
	}

	var handler slog.Handler
	if env == "local" {
		handler = slog.NewTextHandler(os.Stdout, opts)
	} else {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	}

	logger := slog.New(handler).With(
		slog.String("service", "humora-backend"),
		slog.String("env", env),
	)
	slog.SetDefault(logger)
}

func Info(msg string, args ...any) {
	slog.Info(msg, args...)
}

func Debug(msg string, args ...any) {
	slog.Debug(msg, args...)
}

func Warn(msg string, args ...any) {
	slog.Warn(msg, args...)
}

func Error(msg string, args ...any) {
	slog.Error(msg, args...)
}

func LogAttrs(ctx context.Context, level slog.Level, msg string, attrs ...slog.Attr) {
	slog.LogAttrs(ctx, level, msg, attrs...)
}
