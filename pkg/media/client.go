package media

import (
	"context"
	"fmt"
	"strings"
	"sync"
	"time"

	"humora-backend/configs"
	"humora-backend/pkg/logger"
)

var (
	defaultStorage Storage
	storageMu      sync.RWMutex
)

// SetDefaultStorage sets the global default storage driver for the media package.
func SetDefaultStorage(s Storage) {
	storageMu.Lock()
	defer storageMu.Unlock()
	defaultStorage = s
}

// GetDefaultStorage retrieves the current global default storage driver.
func GetDefaultStorage() Storage {
	storageMu.RLock()
	defer storageMu.RUnlock()
	return defaultStorage
}

// Init initializes the default storage client using configs.AppConfig (MinIO or S3 based on StorageDriver).
func Init() error {
	if configs.AppConfig == nil {
		return fmt.Errorf("app configuration is not loaded")
	}

	if strings.EqualFold(configs.AppConfig.StorageDriver, "s3") {
		return InitS3FromConfig(&configs.AppConfig.S3)
	}

	storage, err := NewMinioStorageFromConfig(&configs.AppConfig.Minio)
	if err != nil {
		return fmt.Errorf("failed to initialize default media storage: %w", err)
	}
	SetDefaultStorage(storage)

	// Re-apply the default bucket's policy on every start, so a policy from an older
	// version (which left biometric images public) is replaced. Best effort: the
	// bucket may not exist yet, in which case it gets this policy when created.
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if exists, err := storage.Client().BucketExists(ctx, storage.DefaultBucket()); err == nil && exists {
		if err := storage.SetBucketPublicRead(ctx, storage.DefaultBucket()); err != nil {
			logger.Warn(fmt.Sprintf("could not update the media bucket policy: %v", err))
		}
	}
	return nil
}

// InitS3FromConfig initializes the default storage client from the provided S3Config.
func InitS3FromConfig(cfg *configs.S3Config) error {
	storage, err := NewS3StorageFromConfig(cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize default S3 storage from config: %w", err)
	}
	SetDefaultStorage(storage)
	return nil
}

// DeleteFile removes a file object from storage using the default storage instance.
func DeleteFile(ctx context.Context, bucketName, objectName string) error {
	s := GetDefaultStorage()
	if s == nil {
		return fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.DeleteFile(ctx, bucketName, objectName)
}
