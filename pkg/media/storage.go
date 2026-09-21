package media

import (
	"context"
	"io"
	"mime/multipart"
	"time"
)

// ObjectInfo holds vendor-agnostic metadata about a stored media object.
type ObjectInfo struct {
	Key          string            `json:"key"`
	Size         int64             `json:"size"`
	ContentType  string            `json:"contentType"`
	ETag         string            `json:"etag"`
	LastModified time.Time         `json:"lastModified"`
	UserMetadata map[string]string `json:"userMetadata,omitempty"`
}

// Storage defines the contract for abstract object and file storage backends (e.g. MinIO, S3).
type Storage interface {
	EnsureBucketExists(ctx context.Context, bucketName string) error
	UploadFile(ctx context.Context, bucketName, objectName string, reader io.Reader, objectSize int64, contentType string) (string, error)
	UploadMultipartFile(ctx context.Context, bucketName string, fileHeader *multipart.FileHeader, subdir string) (string, error)
	DownloadFile(ctx context.Context, bucketName, objectName string) (io.ReadCloser, error)
	GetPresignedURL(ctx context.Context, bucketName, objectName string, expires time.Duration) (string, error)
	DeleteFile(ctx context.Context, bucketName, objectName string) error
	FileExists(ctx context.Context, bucketName, objectName string) (bool, error)
	GetFileMetadata(ctx context.Context, bucketName, objectName string) (*ObjectInfo, error)
	ListFiles(ctx context.Context, bucketName, prefix string) ([]ObjectInfo, error)
	FormatURL(rawPath string) string
}
