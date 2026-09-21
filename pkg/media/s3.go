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

// Ensure S3Storage implements the Storage interface.
var _ Storage = (*S3Storage)(nil)

// S3Storage implements the Storage interface using AWS S3 (or S3-compatible cloud storage).
type S3Storage struct {
	client        *minio.Client
	presignClient *minio.Client
	defaultBucket string
	region        string
	baseURL       string
}

// S3Config holds connection parameters for AWS S3 storage.
type S3Config struct {
	Endpoint        string `json:"endpoint"`
	AccessKeyID     string `json:"access_key_id"`
	SecretAccessKey string `json:"secret_access_key"`
	UseSSL          bool   `json:"use_ssl"`
	DefaultBucket   string `json:"default_bucket"`
	Region          string `json:"region"`
	PublicURL       string `json:"public_url"`
}

// NewS3Storage creates a new S3Storage instance using an existing minio.Client.
func NewS3Storage(client *minio.Client, defaultBucket, region, baseURL string) *S3Storage {
	if region == "" {
		region = DefaultRegion
	}
	return &S3Storage{
		client:        client,
		presignClient: client,
		defaultBucket: strings.TrimSpace(defaultBucket),
		region:        region,
		baseURL:       strings.TrimRight(strings.TrimSpace(baseURL), "/"),
	}
}

// NewS3StorageFromConfig initializes an S3Storage driver using the provided configs.S3Config.
func NewS3StorageFromConfig(cfg *configs.S3Config) (*S3Storage, error) {
	if cfg == nil {
		return nil, fmt.Errorf("s3 configuration cannot be nil")
	}

	region := strings.TrimSpace(cfg.Region)
	if region == "" {
		region = DefaultRegion
	}

	endpoint := strings.TrimSpace(cfg.Endpoint)
	useSSL := cfg.UseSSL
	if endpoint == "" {
		// Default to standard AWS S3 regional endpoint
		if region != "" && region != "us-east-1" {
			endpoint = fmt.Sprintf("s3.%s.amazonaws.com", region)
		} else {
			endpoint = "s3.amazonaws.com"
		}
		useSSL = true
	} else {
		if after, ok := strings.CutPrefix(endpoint, "https://"); ok {
			endpoint = after
			useSSL = true
		} else if after, ok := strings.CutPrefix(endpoint, "http://"); ok {
			endpoint = after
		}
		endpoint = strings.TrimRight(endpoint, "/")
	}

	client, err := minio.New(endpoint, &minio.Options{
		Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
		Secure: useSSL,
		Region: region,
	})
	if err != nil {
		return nil, fmt.Errorf("failed to create AWS S3 client from config: %w", err)
	}

	storage := NewS3Storage(client, cfg.DefaultBucket, region, cfg.PublicURL)

	if cfg.PublicURL != "" {
		publicEndpoint := cfg.PublicURL
		publicSecure := true
		if after, ok := strings.CutPrefix(publicEndpoint, "https://"); ok {
			publicEndpoint = after
		} else if after, ok := strings.CutPrefix(publicEndpoint, "http://"); ok {
			publicEndpoint = after
			publicSecure = false
		}
		publicEndpoint = strings.TrimRight(publicEndpoint, "/")

		storage.presignClient, _ = minio.New(publicEndpoint, &minio.Options{
			Creds:  credentials.NewStaticV4(cfg.AccessKeyID, cfg.SecretAccessKey, ""),
			Secure: publicSecure,
			Region: region,
		})
	}

	return storage, nil
}

// Client returns the underlying minio.Client instance configured for AWS S3.
func (s *S3Storage) Client() *minio.Client {
	return s.client
}

// DefaultBucket returns the configured default S3 bucket name.
func (s *S3Storage) DefaultBucket() string {
	return s.defaultBucket
}

// Region returns the configured AWS region.
func (s *S3Storage) Region() string {
	return s.region
}

// BaseURL returns the configured base public URL (e.g. CloudFront CDN URL).
func (s *S3Storage) BaseURL() string {
	return s.baseURL
}

// GetURL returns the full accessible URL for an object under the specified bucket.
func (s *S3Storage) GetURL(bucketName, objectName string) string {
	if bucketName == "" {
		bucketName = s.defaultBucket
	}
	if s.baseURL != "" {
		return fmt.Sprintf("%s/%s/%s", s.baseURL, bucketName, objectName)
	}
	if s.region != "" && s.region != "us-east-1" {
		return fmt.Sprintf("https://%s.s3.%s.amazonaws.com/%s", bucketName, s.region, objectName)
	}
	return fmt.Sprintf("https://%s.s3.amazonaws.com/%s", bucketName, objectName)
}

// resolveBucket returns bucketName if provided, otherwise falls back to defaultBucket.
func (s *S3Storage) resolveBucket(bucketName string) (string, error) {
	target := strings.TrimSpace(bucketName)
	if target == "" {
		target = strings.TrimSpace(s.defaultBucket)
	}
	if target == "" {
		return "", fmt.Errorf("s3 bucket name must be provided or configured as default")
	}
	return target, nil
}

// EnsureBucketExists checks if the S3 bucket exists, creating it if necessary.
func (s *S3Storage) EnsureBucketExists(ctx context.Context, bucketName string) error {
	bucket, err := s.resolveBucket(bucketName)
	if err != nil {
		return err
	}

	exists, err := s.client.BucketExists(ctx, bucket)
	if err != nil {
		bucketErr := fmt.Errorf("error checking if S3 bucket %q exists: %w", bucket, err)
		alert.SendCriticalAlert("AWS S3 BucketExists Failed", bucketErr)
		return bucketErr
	}

	if !exists {
		err = s.client.MakeBucket(ctx, bucket, minio.MakeBucketOptions{Region: s.region})
		if err != nil {
			bucketErr := fmt.Errorf("failed to create S3 bucket %q in region %q: %w", bucket, s.region, err)
			alert.SendCriticalAlert("AWS S3 MakeBucket Failed", bucketErr)
			return bucketErr
		}
	}
	return nil
}

// UploadFile uploads content from an io.Reader into AWS S3 under the given bucket and object key.
func (s *S3Storage) UploadFile(ctx context.Context, bucketName, objectName string, reader io.Reader, objectSize int64, contentType string) (string, error) {
	bucket, err := s.resolveBucket(bucketName)
	if err != nil {
		return "", err
	}

	if reader == nil {
		return "", fmt.Errorf("reader cannot be nil")
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return "", fmt.Errorf("object key cannot be empty")
	}

	if err := s.EnsureBucketExists(ctx, bucket); err != nil {
		return "", err
	}

	if contentType == "" {
		contentType = "application/octet-stream"
	}

	info, err := s.client.PutObject(ctx, bucket, objectName, reader, objectSize, minio.PutObjectOptions{
		ContentType: contentType,
	})
	if err != nil {
		uploadErr := fmt.Errorf("failed to upload object %q to S3 bucket %q: %w", objectName, bucket, err)
		alert.SendCriticalAlert("AWS S3 PutObject Failed", uploadErr)
		return "", uploadErr
	}

	return fmt.Sprintf("%s/%s", bucket, info.Key), nil
}

// FormatURL converts a stored relative media path into a fully qualified S3/CloudFront URL.
func (s *S3Storage) FormatURL(rawPath string) string {
	rawPath = strings.TrimSpace(rawPath)
	if rawPath == "" {
		return ""
	}
	if strings.HasPrefix(rawPath, "http://") || strings.HasPrefix(rawPath, "https://") {
		return rawPath
	}
	if s.baseURL != "" {
		return fmt.Sprintf("%s/%s", s.baseURL, strings.TrimPrefix(rawPath, "/"))
	}
	// Extract bucket and key if format is "bucket/key"
	parts := strings.SplitN(strings.TrimPrefix(rawPath, "/"), "/", 2)
	if len(parts) == 2 {
		return s.GetURL(parts[0], parts[1])
	}
	return s.GetURL(s.defaultBucket, rawPath)
}

// UploadMultipartFile validates, sanitizes, and streams a multipart file header into AWS S3.
func (s *S3Storage) UploadMultipartFile(ctx context.Context, bucketName string, fileHeader *multipart.FileHeader, subdir string) (string, error) {
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

	return s.UploadFile(ctx, bucketName, objectKey, reader, fileHeader.Size, detectedType)
}

// DownloadFile retrieves an object stream from AWS S3. The caller is responsible for closing the stream.
func (s *S3Storage) DownloadFile(ctx context.Context, bucketName, objectName string) (io.ReadCloser, error) {
	bucket, err := s.resolveBucket(bucketName)
	if err != nil {
		return nil, err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return nil, fmt.Errorf("object key cannot be empty")
	}

	object, err := s.client.GetObject(ctx, bucket, objectName, minio.GetObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to download object %q from S3 bucket %q: %w", objectName, bucket, err)
	}

	return object, nil
}

// GetPresignedURL generates a temporary presigned URL for secure GET access to an S3 object.
func (s *S3Storage) GetPresignedURL(ctx context.Context, bucketName, objectName string, expires time.Duration) (string, error) {
	bucket, err := s.resolveBucket(bucketName)
	if err != nil {
		return "", err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return "", fmt.Errorf("object key cannot be empty")
	}

	if expires <= 0 {
		expires = 15 * time.Minute
	}

	signingClient := s.client
	if s.presignClient != nil {
		signingClient = s.presignClient
	}

	presignedURL, err := signingClient.PresignedGetObject(ctx, bucket, objectName, expires, nil)
	if err != nil {
		return "", fmt.Errorf("failed to generate S3 presigned URL for object %q in bucket %q: %w", objectName, bucket, err)
	}

	return presignedURL.String(), nil
}

// DeleteFile removes an object from AWS S3 storage.
func (s *S3Storage) DeleteFile(ctx context.Context, bucketName, objectName string) error {
	bucket, err := s.resolveBucket(bucketName)
	if err != nil {
		return err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return fmt.Errorf("object key cannot be empty")
	}

	err = s.client.RemoveObject(ctx, bucket, objectName, minio.RemoveObjectOptions{})
	if err != nil {
		return fmt.Errorf("failed to remove object %q from S3 bucket %q: %w", objectName, bucket, err)
	}
	return nil
}

// FileExists checks whether an object exists in AWS S3 storage.
func (s *S3Storage) FileExists(ctx context.Context, bucketName, objectName string) (bool, error) {
	bucket, err := s.resolveBucket(bucketName)
	if err != nil {
		return false, err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return false, fmt.Errorf("object key cannot be empty")
	}

	_, err = s.client.StatObject(ctx, bucket, objectName, minio.StatObjectOptions{})
	if err != nil {
		errResponse := minio.ToErrorResponse(err)
		if errResponse.Code == "NoSuchKey" || errResponse.Code == "NotFound" {
			return false, nil
		}
		return false, err
	}

	return true, nil
}

// GetFileMetadata returns metadata for an AWS S3 object.
func (s *S3Storage) GetFileMetadata(ctx context.Context, bucketName, objectName string) (*ObjectInfo, error) {
	bucket, err := s.resolveBucket(bucketName)
	if err != nil {
		return nil, err
	}

	objectName = strings.TrimSpace(objectName)
	if objectName == "" {
		return nil, fmt.Errorf("object key cannot be empty")
	}

	info, err := s.client.StatObject(ctx, bucket, objectName, minio.StatObjectOptions{})
	if err != nil {
		return nil, fmt.Errorf("failed to stat S3 object %q in bucket %q: %w", objectName, bucket, err)
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

// ListFiles returns all S3 objects in a bucket matching the given prefix.
func (s *S3Storage) ListFiles(ctx context.Context, bucketName, prefix string) ([]ObjectInfo, error) {
	bucket, err := s.resolveBucket(bucketName)
	if err != nil {
		return nil, err
	}

	var objects []ObjectInfo
	objectCh := s.client.ListObjects(ctx, bucket, minio.ListObjectsOptions{
		Prefix:    prefix,
		Recursive: true,
	})

	for obj := range objectCh {
		if obj.Err != nil {
			return nil, fmt.Errorf("error listing S3 objects in bucket %q: %w", bucket, obj.Err)
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
