package media

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"strings"
	"sync"
	"time"

	"humora-backend/configs"
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
	return nil
}

// InitFromConfig initializes the default storage client from the provided MinioConfig.
func InitFromConfig(cfg *configs.MinioConfig) error {
	storage, err := NewMinioStorageFromConfig(cfg)
	if err != nil {
		return fmt.Errorf("failed to initialize default media storage from config: %w", err)
	}
	SetDefaultStorage(storage)
	return nil
}

// InitS3 initializes the default S3 storage client using configs.AppConfig.S3.
func InitS3() error {
	if configs.AppConfig == nil {
		return fmt.Errorf("app configuration is not loaded")
	}
	return InitS3FromConfig(&configs.AppConfig.S3)
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

// UploadFile uploads stream data using the default storage instance.
func UploadFile(ctx context.Context, bucketName, objectName string, reader io.Reader, objectSize int64, contentType string) (string, error) {
	s := GetDefaultStorage()
	if s == nil {
		return "", fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.UploadFile(ctx, bucketName, objectName, reader, objectSize, contentType)
}

// UploadMultipartFile validates, sanitizes, and streams a multipart file using the default storage instance.
func UploadMultipartFile(ctx context.Context, bucketName string, fileHeader *multipart.FileHeader, subdir string) (string, error) {
	s := GetDefaultStorage()
	if s == nil {
		return "", fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.UploadMultipartFile(ctx, bucketName, fileHeader, subdir)
}

// DownloadFile retrieves a file stream by object name using the default storage instance.
func DownloadFile(ctx context.Context, bucketName, objectName string) (io.ReadCloser, error) {
	s := GetDefaultStorage()
	if s == nil {
		return nil, fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.DownloadFile(ctx, bucketName, objectName)
}

// GetPresignedURL generates a temporary presigned URL using the default storage instance.
func GetPresignedURL(ctx context.Context, bucketName, objectName string, expires time.Duration) (string, error) {
	s := GetDefaultStorage()
	if s == nil {
		return "", fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.GetPresignedURL(ctx, bucketName, objectName, expires)
}

// DeleteFile removes a file object from storage using the default storage instance.
func DeleteFile(ctx context.Context, bucketName, objectName string) error {
	s := GetDefaultStorage()
	if s == nil {
		return fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.DeleteFile(ctx, bucketName, objectName)
}

// FileExists checks whether an object exists in storage using the default storage instance.
func FileExists(ctx context.Context, bucketName, objectName string) (bool, error) {
	s := GetDefaultStorage()
	if s == nil {
		return false, fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.FileExists(ctx, bucketName, objectName)
}

// GetFileMetadata retrieves metadata for the specified object using the default storage instance.
func GetFileMetadata(ctx context.Context, bucketName, objectName string) (*ObjectInfo, error) {
	s := GetDefaultStorage()
	if s == nil {
		return nil, fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.GetFileMetadata(ctx, bucketName, objectName)
}

// ListFiles returns all object descriptors matching the provided prefix using the default storage instance.
func ListFiles(ctx context.Context, bucketName, prefix string) ([]ObjectInfo, error) {
	s := GetDefaultStorage()
	if s == nil {
		return nil, fmt.Errorf("media storage is not initialized; call media.Init() or media.SetDefaultStorage()")
	}
	return s.ListFiles(ctx, bucketName, prefix)
}

// FormatURL converts a stored relative media path into a fully qualified URL prepended with the base domain.
func FormatURL(rawPath string) string {
	s := GetDefaultStorage()
	if s != nil {
		return s.FormatURL(rawPath)
	}
	return rawPath
}
