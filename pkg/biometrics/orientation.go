package biometrics

import (
	"image"
	"io"
)

// ReadExifOrientation parses standard EXIF JPEG markers to find orientation (1 to 8).
// 1 = Normal, 3 = 180 deg, 6 = 90 deg CW, 8 = 270 deg CW (90 deg CCW)
func ReadExifOrientation(r io.ReaderAt, size int64) int {
	if size < 12 {
		return 1
	}

	header := make([]byte, 12)
	if _, err := r.ReadAt(header, 0); err != nil {
		return 1
	}

	// Must be JPEG SOI (0xFFD8)
	if header[0] != 0xFF || header[1] != 0xD8 {
		return 1
	}

	var offset int64 = 2
	for offset < size-4 {
		marker := make([]byte, 4)
		if _, err := r.ReadAt(marker, offset); err != nil {
			break
		}
		if marker[0] != 0xFF {
			break
		}

		markerType := marker[1]
		markerLen := int64(int(marker[2])<<8 | int(marker[3]))

		// APP1 marker (0xFFE1) contains EXIF
		if markerType == 0xE1 && markerLen > 14 {
			exifHeader := make([]byte, 6)
			if _, err := r.ReadAt(exifHeader, offset+4); err != nil {
				break
			}
			if string(exifHeader) == "Exif\x00\x00" {
				tiffOffset := offset + 10
				tiffData := make([]byte, markerLen-8)
				if _, err := r.ReadAt(tiffData, tiffOffset); err != nil {
					break
				}
				return parseTiffOrientation(tiffData)
			}
		}

		offset += 2 + markerLen
	}

	return 1
}

func parseTiffOrientation(tiff []byte) int {
	if len(tiff) < 8 {
		return 1
	}

	var isLittleEndian bool
	if tiff[0] == 'I' && tiff[1] == 'I' {
		isLittleEndian = true
	} else if tiff[0] == 'M' && tiff[1] == 'M' {
		isLittleEndian = false
	} else {
		return 1
	}

	readUint16 := func(b []byte, off int) uint16 {
		if off+2 > len(b) {
			return 0
		}
		if isLittleEndian {
			return uint16(b[off]) | uint16(b[off+1])<<8
		}
		return uint16(b[off])<<8 | uint16(b[off+1])
	}

	readUint32 := func(b []byte, off int) uint32 {
		if off+4 > len(b) {
			return 0
		}
		if isLittleEndian {
			return uint32(b[off]) | uint32(b[off+1])<<8 | uint32(b[off+2])<<16 | uint32(b[off+3])<<24
		}
		return uint32(b[off])<<24 | uint32(b[off+1])<<16 | uint32(b[off+2])<<8 | uint32(b[off+3])
	}

	if4Offset := int(readUint32(tiff, 4))
	if if4Offset >= len(tiff) || if4Offset < 8 {
		return 1
	}

	numEntries := int(readUint16(tiff, if4Offset))
	curr := if4Offset + 2

	for i := 0; i < numEntries && curr+12 <= len(tiff); i++ {
		tag := readUint16(tiff, curr)
		if tag == 0x0112 { // Orientation Tag
			val := int(readUint16(tiff, curr+8))
			if val >= 1 && val <= 8 {
				return val
			}
		}
		curr += 12
	}

	return 1
}

// AutoRotateByOrientation normalizes an image based on EXIF orientation (1..8).
func AutoRotateByOrientation(img image.Image, orientation int) image.Image {
	if orientation <= 1 {
		return img
	}

	b := img.Bounds()
	w, h := b.Dx(), b.Dy()

	switch orientation {
	case 3: // 180 rotate
		res := image.NewRGBA(image.Rect(0, 0, w, h))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				res.Set(w-1-x, h-1-y, img.At(b.Min.X+x, b.Min.Y+y))
			}
		}
		return res
	case 6: // Rotate 90 CW
		res := image.NewRGBA(image.Rect(0, 0, h, w))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				res.Set(h-1-y, x, img.At(b.Min.X+x, b.Min.Y+y))
			}
		}
		return res
	case 8: // Rotate 270 CW (90 CCW)
		res := image.NewRGBA(image.Rect(0, 0, h, w))
		for y := 0; y < h; y++ {
			for x := 0; x < w; x++ {
				res.Set(y, w-1-x, img.At(b.Min.X+x, b.Min.Y+y))
			}
		}
		return res
	}

	return img
}
