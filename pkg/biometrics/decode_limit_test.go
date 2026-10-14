package biometrics

import (
	"bytes"
	"encoding/binary"
	"hash/crc32"
	"strings"
	"testing"
)

// A PNG whose header claims 30000x30000 pixels must be refused before any pixel buffer is allocated.
func TestDecodeImageRejectsOversizedDimensions(t *testing.T) {
	var buf bytes.Buffer
	buf.WriteString("\x89PNG\r\n\x1a\n")
	ihdr := make([]byte, 13)
	binary.BigEndian.PutUint32(ihdr[0:], 30000)
	binary.BigEndian.PutUint32(ihdr[4:], 30000)
	ihdr[8], ihdr[9] = 8, 2 // 8-bit RGB
	_ = binary.Write(&buf, binary.BigEndian, uint32(len(ihdr)))
	chunk := append([]byte("IHDR"), ihdr...)
	buf.Write(chunk)
	_ = binary.Write(&buf, binary.BigEndian, crc32.ChecksumIEEE(chunk))

	_, _, err := DecodeImage(buf.Bytes())
	if err == nil || !strings.Contains(err.Error(), "maximum") {
		t.Fatalf("expected a size-limit error, got %v", err)
	}
}
