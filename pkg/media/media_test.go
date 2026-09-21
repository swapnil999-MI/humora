package media

import (
	"bytes"
	"mime/multipart"
	"net/textproto"
	"strings"
	"testing"

	"humora-backend/configs"
)

func TestSanitizeSubdir(t *testing.T) {
	tests := []struct {
		name     string
		input    string
		expected string
	}{
		{"empty string", "", ""},
		{"simple path", "avatars", "avatars"},
		{"path with slashes", "/documents/users/", "documents/users"},
		{"path with traversal", "../../../secret/data", "secret/data"},
		{"nested traversal", "user/../../admin/uploads", "user/admin/uploads"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := SanitizeSubdir(tt.input)
			if got != tt.expected {
				t.Errorf("SanitizeSubdir(%q) = %q; want %q", tt.input, got, tt.expected)
			}
		})
	}
}

func TestIsCompatibleContentType(t *testing.T) {
	tests := []struct {
		ext         string
		contentType string
		want        bool
	}{
		{".jpg", "image/jpeg", true},
		{".jpeg", "image/jpeg", true},
		{".png", "image/png", true},
		{".pdf", "application/pdf", true},
		{".mp4", "video/mp4", true},
		{".json", "application/json", true},
		{".png", "application/pdf", false},
		{".exe", "application/octet-stream", false},
	}

	for _, tt := range tests {
		t.Run(tt.ext+"_"+tt.contentType, func(t *testing.T) {
			got := IsCompatibleContentType(tt.ext, tt.contentType)
			if got != tt.want {
				t.Errorf("IsCompatibleContentType(%q, %q) = %v; want %v", tt.ext, tt.contentType, got, tt.want)
			}
		})
	}
}

func TestGenerateFileName(t *testing.T) {
	name1 := GenerateFileName(".png")
	name2 := GenerateFileName(".png")

	if !strings.HasSuffix(name1, ".png") {
		t.Fatalf("expected suffix .png, got %s", name1)
	}

	if name1 == name2 {
		t.Fatalf("expected unique filenames, got duplicates: %s", name1)
	}
}

func TestRandomString(t *testing.T) {
	s1 := RandomString(16)
	s2 := RandomString(16)

	if len(s1) != 16 {
		t.Fatalf("expected length 16, got %d", len(s1))
	}
	if s1 == s2 {
		t.Fatalf("expected different random strings, got same: %s", s1)
	}
}

func TestValidateFileHeader(t *testing.T) {
	// Create mock multipart file header
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	// Create JPEG dummy content (with standard JPEG magic bytes: FF D8 FF)
	jpegData := []byte{0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00}
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="file"; filename="sample.jpg"`)
	h.Set("Content-Type", "image/jpeg")

	part, err := writer.CreatePart(h)
	if err != nil {
		t.Fatalf("failed to create part: %v", err)
	}
	_, _ = part.Write(jpegData)
	writer.Close()

	reader := multipart.NewReader(body, writer.Boundary())
	form, err := reader.ReadForm(1024)
	if err != nil {
		t.Fatalf("failed to read form: %v", err)
	}

	headers := form.File["file"]
	if len(headers) == 0 {
		t.Fatalf("expected header file")
	}

	ext, detectedType, r, closer, err := ValidateFileHeader(headers[0])
	if err != nil {
		t.Fatalf("ValidateFileHeader returned unexpected error: %v", err)
	}
	defer closer.Close()

	if ext != ".jpg" {
		t.Errorf("expected ext .jpg, got %s", ext)
	}
	if !strings.HasPrefix(detectedType, "image/jpeg") {
		t.Errorf("expected detectedType image/jpeg, got %s", detectedType)
	}
	if r == nil {
		t.Errorf("expected non-nil reader")
	}
}

func TestNewMinioStorageFromConfigValidation(t *testing.T) {
	// Test nil config
	_, err := NewMinioStorageFromConfig(nil)
	if err == nil {
		t.Errorf("expected error for nil config, got nil")
	}

	// Test empty endpoint
	_, err = NewMinioStorageFromConfig(&configs.MinioConfig{})
	if err == nil {
		t.Errorf("expected error for empty endpoint, got nil")
	}

	// Test valid config creation
	storage, err := NewMinioStorageFromConfig(&configs.MinioConfig{
		Endpoint:        "localhost:9000",
		AccessKeyID:     "minioadmin",
		SecretAccessKey: "minioadmin",
		UseSSL:          false,
		DefaultBucket:   "test-bucket",
		Region:          "us-east-1",
		PublicURL:       "http://localhost:9000",
	})
	if err != nil {
		t.Fatalf("unexpected error creating MinioStorage: %v", err)
	}

	if storage == nil {
		t.Fatalf("expected non-nil MinioStorage")
	}

	if storage.DefaultBucket() != "test-bucket" {
		t.Errorf("expected default bucket test-bucket, got %s", storage.DefaultBucket())
	}
	if storage.Location() != "us-east-1" {
		t.Errorf("expected location us-east-1, got %s", storage.Location())
	}
	if storage.BaseURL() != "http://localhost:9000" {
		t.Errorf("expected baseURL http://localhost:9000, got %s", storage.BaseURL())
	}
	expectedURL := "http://localhost:9000/test-bucket/gateway/logo/sample.png"
	if gotURL := storage.GetURL("test-bucket", "gateway/logo/sample.png"); gotURL != expectedURL {
		t.Errorf("expected GetURL %s, got %s", expectedURL, gotURL)
	}
	if gotFormatted := storage.FormatURL("paylogic-media/gateway/logo/sample.png"); gotFormatted != "http://localhost:9000/paylogic-media/gateway/logo/sample.png" {
		t.Errorf("expected FormatURL %s, got %s", "http://localhost:9000/paylogic-media/gateway/logo/sample.png", gotFormatted)
	}
}

func TestPackageLevelStorageHelpers(t *testing.T) {
	// Reset default storage
	SetDefaultStorage(nil)

	// Calls should fail when uninitialized
	_, err := UploadFile(nil, "bucket", "obj", nil, 0, "")
	if err == nil {
		t.Errorf("expected error when storage uninitialized, got nil")
	}

	storage, _ := NewMinioStorageFromConfig(&configs.MinioConfig{
		Endpoint:      "localhost:9000",
		DefaultBucket: "my-bucket",
		PublicURL:     "http://localhost:9000",
	})
	SetDefaultStorage(storage)

	if GetDefaultStorage() != storage {
		t.Errorf("expected default storage to match set storage")
	}

	if got := FormatURL("paylogic-media/test.png"); got != "http://localhost:9000/paylogic-media/test.png" {
		t.Errorf("expected FormatURL http://localhost:9000/paylogic-media/test.png, got %s", got)
	}
}

func TestNewS3StorageFromConfigValidation(t *testing.T) {
	// Test nil config
	_, err := NewS3StorageFromConfig(nil)
	if err == nil {
		t.Errorf("expected error for nil config, got nil")
	}

	// Test default AWS S3 config
	storage, err := NewS3StorageFromConfig(&configs.S3Config{
		AccessKeyID:     "AKIAIOSFODNN7EXAMPLE",
		SecretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
		DefaultBucket:   "paylogic-media",
		Region:          "ap-south-1",
		PublicURL:       "https://cdn.example.com",
	})
	if err != nil {
		t.Fatalf("unexpected error creating S3Storage: %v", err)
	}

	if storage == nil {
		t.Fatalf("expected non-nil S3Storage")
	}

	if storage.DefaultBucket() != "paylogic-media" {
		t.Errorf("expected default bucket paylogic-media, got %s", storage.DefaultBucket())
	}
	if storage.Region() != "ap-south-1" {
		t.Errorf("expected region ap-south-1, got %s", storage.Region())
	}
	if storage.BaseURL() != "https://cdn.example.com" {
		t.Errorf("expected baseURL https://cdn.example.com, got %s", storage.BaseURL())
	}

	expectedURL := "https://cdn.example.com/paylogic-media/gateway/logo/sample.png"
	if gotURL := storage.GetURL("paylogic-media", "gateway/logo/sample.png"); gotURL != expectedURL {
		t.Errorf("expected GetURL %s, got %s", expectedURL, gotURL)
	}
	if gotFormatted := storage.FormatURL("paylogic-media/gateway/logo/sample.png"); gotFormatted != "https://cdn.example.com/paylogic-media/gateway/logo/sample.png" {
		t.Errorf("expected FormatURL %s, got %s", "https://cdn.example.com/paylogic-media/gateway/logo/sample.png", gotFormatted)
	}
}

func TestValidateSVGContent(t *testing.T) {
	tests := []struct {
		name        string
		svgData     string
		expectError bool
	}{
		{
			name:        "Valid clean SVG",
			svgData:     `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" /></svg>`,
			expectError: false,
		},
		{
			name:        "Valid SVG with path and group",
			svgData:     `<svg viewBox="0 0 100 100"><g fill="none"><path d="M10 10 H 90 V 90 H 10 L 10 10" /></g></svg>`,
			expectError: false,
		},
		{
			name:        "Rejected: Embedded <script> tag",
			svgData:     `<svg xmlns="http://www.w3.org/2000/svg"><script>alert("XSS")</script></svg>`,
			expectError: true,
		},
		{
			name:        "Rejected: Case-variant <SCRIPT> tag",
			svgData:     `<svg xmlns="http://www.w3.org/2000/svg"><ScRiPt>alert(1)</sCrIpt></svg>`,
			expectError: true,
		},
		{
			name:        "Rejected: Inline onload event handler",
			svgData:     `<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><circle cx="50" cy="50" r="40"/></svg>`,
			expectError: true,
		},
		{
			name:        "Rejected: Inline onerror event handler on image",
			svgData:     `<svg xmlns="http://www.w3.org/2000/svg"><image href="invalid.jpg" onerror="alert(document.cookie)" /></svg>`,
			expectError: true,
		},
		{
			name:        "Rejected: javascript: URI in href",
			svgData:     `<svg xmlns="http://www.w3.org/2000/svg"><a href="javascript:alert(1)"><text x="10" y="20">Click me</text></a></svg>`,
			expectError: true,
		},
		{
			name:        "Rejected: <foreignObject> HTML embedding",
			svgData:     `<svg xmlns="http://www.w3.org/2000/svg"><foreignObject width="100" height="50"><body xmlns="http://www.w3.org/1999/xhtml"><div>HTML</div></body></foreignObject></svg>`,
			expectError: true,
		},
		{
			name:        "Rejected: XXE with <!ENTITY>",
			svgData:     `<?xml version="1.0"?><!DOCTYPE svg [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><svg>&xxe;</svg>`,
			expectError: true,
		},
		{
			name:        "Rejected: Empty content",
			svgData:     ``,
			expectError: true,
		},
		{
			name:        "Rejected: Malformed XML",
			svgData:     `<svg><unclosed>`,
			expectError: true,
		},
		{
			name:        "Rejected: XML without svg tag",
			svgData:     `<?xml version="1.0"?><root><item>test</item></root>`,
			expectError: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := ValidateSVGContent([]byte(tt.svgData))
			if (err != nil) != tt.expectError {
				t.Errorf("ValidateSVGContent() error = %v, expectError = %v", err, tt.expectError)
			}
		})
	}
}

func TestValidateFileHeader_SVG(t *testing.T) {
	// 1. Test valid clean SVG upload
	cleanSVG := []byte(`<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><rect width="100" height="100" fill="red"/></svg>`)
	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)
	h := make(textproto.MIMEHeader)
	h.Set("Content-Disposition", `form-data; name="file"; filename="logo.svg"`)
	h.Set("Content-Type", "image/svg+xml")
	part, _ := writer.CreatePart(h)
	_, _ = part.Write(cleanSVG)
	writer.Close()

	reader := multipart.NewReader(body, writer.Boundary())
	form, err := reader.ReadForm(1024)
	if err != nil {
		t.Fatalf("failed to read multipart form: %v", err)
	}

	ext, detectedType, r, closer, err := ValidateFileHeader(form.File["file"][0])
	if err != nil {
		t.Fatalf("expected clean SVG to succeed, got error: %v", err)
	}
	closer.Close()
	if ext != ".svg" {
		t.Errorf("expected .svg, got %s", ext)
	}
	if detectedType != "image/svg+xml" {
		t.Errorf("expected image/svg+xml, got %s", detectedType)
	}
	if r == nil {
		t.Errorf("expected non-nil reader")
	}

	// 2. Test malicious SVG upload rejection
	maliciousSVG := []byte(`<svg xmlns="http://www.w3.org/2000/svg" onload="alert(1)"><rect width="100" height="100"/></svg>`)
	body2 := &bytes.Buffer{}
	writer2 := multipart.NewWriter(body2)
	part2, _ := writer2.CreatePart(h)
	_, _ = part2.Write(maliciousSVG)
	writer2.Close()

	reader2 := multipart.NewReader(body2, writer2.Boundary())
	form2, err := reader2.ReadForm(1024)
	if err != nil {
		t.Fatalf("failed to read multipart form: %v", err)
	}

	_, _, _, _, err = ValidateFileHeader(form2.File["file"][0])
	if err == nil {
		t.Fatalf("expected malicious SVG to be rejected, but got no error")
	}
}


