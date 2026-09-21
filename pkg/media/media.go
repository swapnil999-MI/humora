package media

import (
	"bytes"
	"crypto/rand"
	"encoding/xml"
	"fmt"
	"io"
	"math/big"
	"mime/multipart"
	"net/http"
	"path/filepath"
	"strings"
	"time"
)

const (
	// MaxUploadSize defines the maximum file size limit (20 MB).
	MaxUploadSize = 20 << 20
	// DefaultRegion is the fallback region used for cloud/object storage.
	DefaultRegion = "us-east-1"
)

// AllowedMediaExtensions lists all permitted file extensions for uploads.
var AllowedMediaExtensions = map[string]struct{}{
	".jpg":  {},
	".jpeg": {},
	".png":  {},
	".gif":  {},
	".bmp":  {},
	".webp": {},
	".svg":  {},
	".mp4":  {},
	".mov":  {},
	".avi":  {},
	".mkv":  {},
	".mp3":  {},
	".wav":  {},
	".ogg":  {},
	".pdf":  {},
	".txt":  {},
	".csv":  {},
	".json": {},
	".xlsx": {},
	".xls":  {},
}

// ValidateFileHeader checks size, file extension, and MIME type consistency for a multipart upload.
// It returns the extension, detected MIME type, and a combined reader of the verified stream.
func ValidateFileHeader(fileHeader *multipart.FileHeader) (ext string, detectedType string, reader io.Reader, closer io.Closer, err error) {
	if fileHeader == nil {
		return "", "", nil, nil, fmt.Errorf("file header is nil")
	}

	if fileHeader.Size > MaxUploadSize {
		return "", "", nil, nil, fmt.Errorf("file size %d bytes exceeds limit of %d bytes", fileHeader.Size, MaxUploadSize)
	}

	ext = strings.ToLower(filepath.Ext(fileHeader.Filename))
	if ext == "" {
		ext = ".bin"
	}

	if _, ok := AllowedMediaExtensions[ext]; !ok {
		return "", "", nil, nil, fmt.Errorf("file extension %q is not allowed", ext)
	}

	src, err := fileHeader.Open()
	if err != nil {
		return "", "", nil, nil, fmt.Errorf("failed to open multipart file header: %w", err)
	}

	limitedReader := io.LimitReader(src, MaxUploadSize+1)

	detectBuffer := make([]byte, 512)
	n, err := io.ReadFull(limitedReader, detectBuffer)
	if err != nil && err != io.ErrUnexpectedEOF {
		src.Close()
		return "", "", nil, nil, fmt.Errorf("failed to read header bytes for content detection: %w", err)
	}

	detectedType = http.DetectContentType(detectBuffer[:n])
	if !IsCompatibleContentType(ext, detectedType) {
		src.Close()
		return "", "", nil, nil, fmt.Errorf("file content type %q does not match extension %q", detectedType, ext)
	}

	fullReader := io.MultiReader(strings.NewReader(string(detectBuffer[:n])), limitedReader)

	// If the file is an SVG, read the full stream into memory and validate against XSS / XXE
	if ext == ".svg" {
		svgBytes, readErr := io.ReadAll(fullReader)
		if readErr != nil {
			src.Close()
			return "", "", nil, nil, fmt.Errorf("failed to read SVG file content: %w", readErr)
		}
		if err := ValidateSVGContent(svgBytes); err != nil {
			src.Close()
			return "", "", nil, nil, fmt.Errorf("SVG security validation failed: %w", err)
		}
		detectedType = "image/svg+xml"
		fullReader = bytes.NewReader(svgBytes)
	}

	return ext, detectedType, fullReader, src, nil
}

// ValidateSVGContent parses and checks SVG bytes for dangerous scripts, event handlers, and XML vulnerabilities (XXE).
func ValidateSVGContent(data []byte) error {
	if len(data) == 0 {
		return fmt.Errorf("SVG content is empty")
	}

	// 1. Raw string inspection for DOCTYPE, ENTITY, and dangerous tags/schemes
	lowerContent := strings.ToLower(string(data))

	// Prevent XXE (XML External Entity) and Billion Laughs / quadratic blowup attacks
	if strings.Contains(lowerContent, "<!entity") || strings.Contains(lowerContent, "<!doctype") {
		return fmt.Errorf("SVG contains prohibited DOCTYPE or ENTITY definitions")
	}

	// Prohibited executable tags and dangerous protocols
	prohibitedSubstrings := []string{
		"<script",
		"</script",
		"<foreignobject",
		"</foreignobject",
		"<iframe",
		"<embed",
		"<object",
		"<applet",
		"<meta",
		"<link",
		"javascript:",
		"vbscript:",
		"data:text/html",
		"data:text/xml",
		"data:image/svg+xml",
	}

	for _, sub := range prohibitedSubstrings {
		if strings.Contains(lowerContent, sub) {
			return fmt.Errorf("SVG contains prohibited element or scheme %q", sub)
		}
	}

	// 2. Strict XML token parsing to detect inline event handlers and malicious attributes
	decoder := xml.NewDecoder(bytes.NewReader(data))
	hasSVGTag := false

	for {
		token, err := decoder.Token()
		if err != nil {
			if err == io.EOF {
				break
			}
			return fmt.Errorf("invalid XML structure in SVG: %w", err)
		}

		switch elem := token.(type) {
		case xml.StartElement:
			localName := strings.ToLower(elem.Name.Local)
			if localName == "svg" {
				hasSVGTag = true
			}

			// Blacklist forbidden elements
			forbiddenElements := map[string]bool{
				"script":        true,
				"foreignobject": true,
				"iframe":        true,
				"embed":         true,
				"object":        true,
				"applet":        true,
				"meta":          true,
				"link":          true,
				"form":          true,
				"input":         true,
				"button":        true,
			}
			if forbiddenElements[localName] {
				return fmt.Errorf("SVG contains prohibited element <%s>", localName)
			}

			// Inspect every attribute
			for _, attr := range elem.Attr {
				attrName := strings.ToLower(attr.Name.Local)
				attrVal := strings.ToLower(strings.TrimSpace(attr.Value))

				// Disallow all inline event handlers (onload, onerror, onclick, onmouseover, etc.)
				if strings.HasPrefix(attrName, "on") {
					return fmt.Errorf("SVG contains prohibited event handler attribute %q", attrName)
				}

				// Check href, xlink:href, src, action for dangerous schemes (handling whitespace obfuscation)
				if strings.Contains(attrName, "href") || attrName == "src" || attrName == "action" || attrName == "data" {
					cleanVal := strings.ReplaceAll(strings.ReplaceAll(strings.ReplaceAll(attrVal, "\t", ""), "\n", ""), " ", "")
					if strings.HasPrefix(cleanVal, "javascript:") ||
						strings.HasPrefix(cleanVal, "vbscript:") ||
						strings.HasPrefix(cleanVal, "data:text/html") ||
						strings.HasPrefix(cleanVal, "data:text/xml") ||
						strings.HasPrefix(cleanVal, "data:image/svg+xml") {
						return fmt.Errorf("SVG attribute %q contains prohibited scheme", attrName)
					}
				}
			}
		}
	}

	if !hasSVGTag {
		return fmt.Errorf("SVG file must contain a valid <svg> element")
	}

	return nil
}

// SanitizeSubdir cleans and normalizes subpath directories to prevent directory traversal attacks.
func SanitizeSubdir(subdir string) string {
	subdir = strings.TrimSpace(subdir)
	if subdir == "" {
		return ""
	}

	// Normalize windows separators
	subdir = strings.ReplaceAll(subdir, "\\", "/")
	parts := strings.Split(subdir, "/")
	var cleanParts []string
	for _, part := range parts {
		part = strings.TrimSpace(part)
		part = strings.ReplaceAll(part, "..", "")
		part = strings.Trim(part, "/.")
		if part != "" {
			cleanParts = append(cleanParts, part)
		}
	}
	return strings.Join(cleanParts, "/")
}

// IsCompatibleContentType checks if detected content-type is compatible with extension.
func IsCompatibleContentType(ext, contentType string) bool {
	contentType = strings.ToLower(contentType)

	switch ext {
	case ".jpg", ".jpeg":
		return strings.HasPrefix(contentType, "image/jpeg")
	case ".png":
		return strings.HasPrefix(contentType, "image/png")
	case ".gif":
		return strings.HasPrefix(contentType, "image/gif")
	case ".bmp":
		return strings.HasPrefix(contentType, "image/bmp")
	case ".webp":
		return strings.HasPrefix(contentType, "image/webp")
	case ".svg":
		return strings.Contains(contentType, "svg") || strings.HasPrefix(contentType, "text/xml") || strings.HasPrefix(contentType, "text/plain")
	case ".mp4":
		return strings.HasPrefix(contentType, "video/mp4")
	case ".mov":
		return strings.HasPrefix(contentType, "video/quicktime")
	case ".avi":
		return strings.Contains(contentType, "video")
	case ".mkv":
		return strings.Contains(contentType, "video")
	case ".mp3":
		return strings.HasPrefix(contentType, "audio/mpeg")
	case ".wav":
		return strings.HasPrefix(contentType, "audio/wav")
	case ".ogg":
		return strings.Contains(contentType, "audio") || strings.Contains(contentType, "video")
	case ".pdf":
		return strings.HasPrefix(contentType, "application/pdf")
	case ".txt":
		return strings.HasPrefix(contentType, "text/")
	case ".csv":
		return strings.HasPrefix(contentType, "text/") || strings.Contains(contentType, "csv")
	case ".json":
		return strings.Contains(contentType, "json") || strings.HasPrefix(contentType, "text/plain")
	case ".xlsx":
		return strings.Contains(contentType, "spreadsheetml") || strings.Contains(contentType, "zip") || strings.Contains(contentType, "octet-stream")
	case ".xls":
		return strings.Contains(contentType, "excel") || strings.Contains(contentType, "msword") || strings.Contains(contentType, "octet-stream")
	default:
		return false
	}
}

// GenerateFileName creates a unique timestamped filename with the provided extension.
func GenerateFileName(ext string) string {
	return fmt.Sprintf("%d_%s%s", time.Now().UnixNano(), RandomString(8), ext)
}

// RandomString generates a cryptographically secure random alphanumeric string of given length.
func RandomString(length int) string {
	const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"
	b := make([]byte, length)
	for i := range b {
		idx, err := rand.Int(rand.Reader, big.NewInt(int64(len(chars))))
		if err != nil {
			b[i] = chars[0]
			continue
		}
		b[i] = chars[idx.Int64()]
	}
	return string(b)
}
