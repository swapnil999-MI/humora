package media

import (
	"context"
	"fmt"
	"io"
	"mime/multipart"
	"strings"
	"time"

	"github.com/minio/minio-go/v7"
	"github.com/minio/minio-go/v7/pkg/credentials"

	"humora-backend/configs"
	"humora-backend/pkg/alert"
)

// Ensure MinioStorage implements the Storage interface.
var _ Storage = (*MinioStorage)(nil)

// MinioStorage implements the Storage interface using MinIO as the object storage driver.
type MinioStorage struct {
	client        *minio.Client
	presignClient *minio.Client
	defaultBucket string
	location      string
	baseURL       string
}

// NewMinioStorage creates a new MinioStorage instance using an existing minio.Client.
func NewMinioStorage(client *minio.Client, defaultBucket, location, baseURL string) *MinioStorage {
	if location == "" {
		location = DefaultRegion
	}
	return &MinioStorage{
		client:        client,
		presignClient: client,
		defaultBucket: strings.TrimSpace(defaultBucket),
		location:      location,
		baseURL:       strings.TrimRight(strings.TrimSpace(baseURL), "/"),
	}
}

// NewMinioStorageFromConfig creates a MinioStorage instance by initializing a client from MinioConfig.
func NewMinioStorageFromConfig(cfg *configs.MinioConfig) (*MinioStorage, error) {
	if cfg == nil {
		return nil, fmt.Errorf("minio configuration cannot be nil")
	}

	endpoint := strings.TrimSpace(cfg.Endpoint)
	if endpoint == "" {
		return nil, fmt.Errorf("minio endpoint cannot be empty")
	}

	useSSL := cfg.UseSSL
	if after, ok := strings.CutPrefix(endpoint, "https://"); ok {
		endpoint = after
		useSSL = true
	} else if after, ok := strings.CutPrefix(endpoint, "http://"); ok {
		endpoint = after
	}
	endpoint = strings.TrimRight(endpoint, "/")

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: useSSL,
		Region: cfg.Region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create MinIO client from config: %w", err)
	}

	location := cfg.Region
	if location == "" {
		location = DefaultRegion
	}

	storage := NewMinioStorage(client, cfg.DefaultBucket, location, cfg.PublicURL)

	if cfg.PublicURL != "" {
		storage.presignClient, _ = minio.New(cfg.PublicURL, &minio.Options{
			Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
			Secure: cfg.UseSSL,
			Region: cfg.Region,
		})
	}

	return storage, nil
}

// Client returns the underlying minio.Client instance.
func (m *MinioStorage) Client() *minio.Client {
	return m.client
}

// DefaultBucket returns the configured default bucket name.
func (m *MinioStorage) DefaultBucket() string {
	return m.defaultBucket
}

// Location returns the configured region / location.
func (m *MinioStorage) Location() string {
	return m.location
}

// BaseURL returns the configured base URL for public/client access.
func (m *MinioStorage) BaseURL() string {
	return m.baseURL
}

// GetURL returns the full URL for an object under the specified bucket.
func (m *MinioStorage) GetURL(bucketName, objectName string) string {
	if bucketName == "" {
		bucketName = m.defaultBucket
	}
	if m.baseURL != "" {
		return fmt.Sprintf("%s/%s/%s", m.baseURL, bucketName, objectName)
	}
	return fmt.Sprintf("%s/%s", bucketName, objectName)
}

// resolveBucket returns bucketName if provided, otherwise falls back to defaultBucket.
func (m *MinioStorage) resolveBucket(bucketName string) (string, error) {
	target := strings.TrimSpace(bucketName)
	if target == "" {
		target = strings.TrimSpace(m.defaultBucket)
	}
	if target == "" {
		return "", fmt.Errorf("bucket name must be provided or configured as default")
	}
	return target, nil
}

// EnsureBucketExists checks if a bucket exists, creating it if necessary.
func (m *MinioStorage) EnsureBucketExists(ctx context.Context, bucketName string) error {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return err
	}

	exists, err := m.client.BucketExists(ctx, bucket)
	if err != nil {
		bucketErr := fmt.Errorf("error checking if MinIO bucket %q exists: %w", bucket, err)
		alert.SendCriticalAlert("MinIO BucketExists Failed", bucketErr)
		return bucketErr
	}

	if !exists {
		err = m.client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{Region: m.location})
		if err != nil {
			bucketErr := fmt.Errorf("failed to create MinIO bucket %q: %w", bucket, err)
			alert.SendCriticalAlert("MinIO MakeBucket Failed", bucketErr)
			return bucketErr
		}
		if bucket == m.defaultBucket {
			_ = m.SetBucketPublicRead(ctx, bucket)
		}
	}
	return nil
}

// SetBucketPublicRead configures anonymous download access on the MinIO bucket for browser/media viewing.
func (m *MinioStorage) SetBucketPublicRead(ctx context.Context, bucketName string) error {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return err
	}
	policy := fmt.Sprintf(`{
		"Version": "2012-10-17",
		"Statement": [
			{
				"Effect": "Allow",
				"Principal": {"AWS": ["*"]},
				"Action": ["s3:GetBucketLocation", "s3:ListBucket"],
				"Resource": ["arn:aws:s3:::%s"]
			},
			{
				"Effect": "Allow",
				"Principal": {"AWS": ["*"]},
				"Action": ["s3:GetObject"],
				"Resource": ["arn:aws:s3:::%s/*"]
			}
		]
	}`, bucket, bucket)
	return m.client.SetBucketPolicy(ctx, bucket, policy)
}

// UploadFile uploads content from an io.Reader into MinIO storage under the given bucket and object name.
func (m *MinioStorage) UploadFile(ctx context.Context, bucketName, objectName string, reader io.Reader, objectSize int64, contentType string) (string, error) {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return "", err
	}

	if reader == nil {
		return "", fmt.Errorf("reader cannot be nil")
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return "", fmt.Errorf("object name cannot be empty")
	}

	if err := m.EnsureBucketExists(ctx, bucket); err != nil {
		return "", err
	}

	if contentType == "" {
		contentType = "application/octet-stream"
	}

	info, err := m.client.PutObject(ctx, bucket, objectName, reader, objectSize, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		uploadErr := fmt.Errorf("failed to upload object %q to MinIO bucket %q: %w", objectName, bucket, err)
		alert.SendCriticalAlert("MinIO PutObject Failed", uploadErr)
		return "", uploadErr
	}

	return fmt.Sprintf("%s/%s", bucket, info.Key), nil
}

// FormatURL converts a stored relative media path into a fully qualified URL prepended with the base domain.
func (m *MinioStorage) FormatURL(rawPath string) string {
	rawPath = strings.TrimSpace(rawPath)
	if rawPath == "" {
		return ""
	}
	if strings.HasPrefix(rawPath, "http://") || strings.HasPrefix(rawPath, "https://") {
		return rawPath
	}
	if m.baseURL != "" {
		return fmt.Sprintf("%s/%s", m.baseURL, strings.TrimPrefix(rawPath, "/"))
	}
	return rawPath
}

// UploadMultipartFile validates, sanitizes, and uploads a multipart file upload header to MinIO.
func (m *MinioStorage) UploadMultipartFile(ctx context.Context, bucketName string, fileHeader *multipart.FileHeader, subdir string) (string, error) {
	ext, detectedType, reader, closer, err := ValidateFileHeader(fileHeader)
	if err != nil {
		return "", err
	}
	defer closer.Close()

	cleanSubdir := SanitizeSubdir(subdir)
	filename := GenerateFileName(ext)
	objectKey := filename
	if cleanSubdir != "" {
		objectKey = fmt.Sprintf("%s/%s", cleanSubdir, filename)
	}

	return m.UploadFile(ctx, bucketName, objectKey, reader, fileHeader.Size, detectedType)
}

// DownloadFile retrieves an object from MinIO storage as a ReadCloser stream.
func (m *MinioStorage) DownloadFile(ctx context.Context, bucketName, objectName string) (io.ReadCloser, error) {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return nil, err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return nil, fmt.Errorf("object name cannot be empty")
	}

	object, err := m.client.GetObject(ctx, bucket, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to download object %q from bucket %q: %w", objectName, bucket, err)
	}

	return object, nil
}

// GetPresignedURL generates a temporary presigned URL for GET access to an object.
func (m *MinioStorage) GetPresignedURL(ctx context.Context, bucketName, objectName string, expires time.Duration) (string, error) {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return "", err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return "", fmt.Errorf("object name cannot be empty")
	}

	if expires <= 0 {
		expires = 15 * time.Minute
	}

	signingClient := m.client
	if m.presignClient != nil {
		signingClient = m.presignClient
	}

	presignedURL, err := signingClient.PresignedGetObject(ctx, bucket, objectName, expires, nil)
	if err != nil {
		return "", fmt.Errorf("failed to generate presigned URL for object %q in bucket %q: %w", objectName, bucket, err)
	}

	return presignedURL.String(), nil
}

// DeleteFile removes an object from MinIO storage.
func (m *MinioStorage) DeleteFile(ctx context.Context, bucketName, objectName string) error {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return fmt.Errorf("object name cannot be empty")
	}

	err = m.client.RemoveObject(ctx, bucket, objectName, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to remove object %q from bucket %q: %w", objectName, bucket, err)
	}
	return nil
}

// FileExists checks whether an object exists in MinIO storage.
func (m *MinioStorage) FileExists(ctx context.Context, bucketName, objectName string) (bool, error) {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return false, err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return false, fmt.Errorf("object name cannot be empty")
	}

	_, err = m.client.StatObject(ctx, bucket, objectName, minio.StatObjectOptions{})
	if err != nil {
		errResponse := minio.ToErrorResponse(err)
		if errResponse.Code == "NoSuchKey" || errResponse.Code == "NotFound" {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// GetFileMetadata returns detailed metadata about an object stored in MinIO.
func (m *MinioStorage) GetFileMetadata(ctx context.Context, bucketName, objectName string) (*ObjectInfo, error) {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return nil, err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return nil, fmt.Errorf("object name cannot be empty")
	}

	info, err := m.client.StatObject(ctx, bucket, objectName, minio.StatObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to stat object %q in bucket %q: %w", objectName, bucket, err)
	}

	return &ObjectInfo{
		Key:          info.Key,
		Size:         info.Size,
		ContentType:  info.ContentType,
		ETag:         info.ETag,
		LastModified: info.LastModified,
		UserMetadata: info.UserMetadata,
	}, nil
}

// ListFiles lists objects in a bucket matching the given prefix.
func (m *MinioStorage) ListFiles(ctx context.Context, bucketName, prefix string) ([]ObjectInfo, error) {
	bucket, err := m.resolveBucket(bucketName)
	if err != nil {
		return nil, err
	}

	var objects []ObjectInfo
	objectCh := m.client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	for obj := range objectCh {
		if obj.Err != nil {
			return nil, fmt.Errorf("error listing objects in bucket %q: %w", bucket, obj.Err)
		}
		objects = append(objects, ObjectInfo{
			Key:          obj.Key,
			Size:         obj.Size,
			ContentType:  obj.ContentType,
			ETag:         obj.ETag,
			LastModified: obj.LastModified,
			UserMetadata: obj.UserMetadata,
		})
	}

	return objects, nil
}
