package media

import (
	"context"
	"strings"
	"testing"
	"time"

	"humora-backend/configs"
)

func TestPresignUsesPublicHost(t *testing.T) {
	s, err := NewMinioStorageFromConfig(&configs.MinioConfig{Endpoint: "paylogic-minio:9000", AccessKeyID: "a", SecretAccessKey: "b", DefaultBucket: "x", Region: "us-east-1", PublicURL: "http://192.168.1.50:9000"})
	if err != nil {
		t.Fatal(err)
	}
	u, err := s.GetPresignedURL(context.Background(), "pulse-media", "pulse/a/b/c", time.Minute)
	if err != nil || !strings.HasPrefix(u, "http://192.168.1.50:9000/pulse-media/") {
		t.Fatalf("GET url = %q err=%v", u, err)
	}
	up, err := s.GetPresignedUpload(context.Background(), "pulse-media", "pulse/a/b/c", time.Minute, 10)
	if err != nil || !strings.HasPrefix(up.URL, "http://192.168.1.50:9000/pulse-media") || up.Fields["key"] != "pulse/a/b/c" {
		t.Fatalf("POST = %+v err=%v", up, err)
	}
}
