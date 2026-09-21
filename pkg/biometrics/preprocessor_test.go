package biometrics

import (
	"bytes"
	"encoding/base64"
	"image"
	"image/color"
	"image/png"
	"os"
	"testing"
)

func createTestImage(w, h int, c color.Color) image.Image {
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			// Add some gradient pattern so it's not a flat blank texture
			val := uint8((x*y) % 256)
			img.Set(x, y, color.RGBA{R: val, G: 120, B: 200, A: 255})
		}
	}
	return img
}

func TestCheckQuality(t *testing.T) {
	// Good test image with texture
	imgGood := createTestImage(200, 200, color.White)
	res := CheckQuality(imgGood)
	if !res.Passed {
		t.Fatalf("expected good textured image to pass quality check, failed: %s", res.RejectionReason)
	}

	// Tiny image (too low resolution)
	imgTiny := createTestImage(32, 32, color.White)
	resTiny := CheckQuality(imgTiny)
	if resTiny.Passed {
		t.Fatalf("expected 32x32 image to fail resolution check")
	}

	// Pitch black image (too dark)
	imgDark := image.NewRGBA(image.Rect(0, 0, 100, 100))
	resDark := CheckQuality(imgDark)
	if resDark.Passed {
		t.Fatalf("expected black image to fail brightness check")
	}
}

func TestCropCenterSquare(t *testing.T) {
	img := createTestImage(300, 200, color.White)
	cropped := CropCenterSquare(img)
	b := cropped.Bounds()
	if b.Dx() != 200 || b.Dy() != 200 {
		t.Fatalf("expected 200x200 square crop, got %dx%d", b.Dx(), b.Dy())
	}
}

func TestResizeTo112x112(t *testing.T) {
	img := createTestImage(300, 300, color.White)
	resized := ResizeTo112x112(img)
	b := resized.Bounds()
	if b.Dx() != 112 || b.Dy() != 112 {
		t.Fatalf("expected 112x112 dimensions, got %dx%d", b.Dx(), b.Dy())
	}
}

func TestToPlanarCHW(t *testing.T) {
	img := ResizeTo112x112(createTestImage(150, 150, color.White))
	tensor := ToPlanarCHW(img)

	expectedLen := 112 * 112 * 3 // 37632
	if len(tensor) != expectedLen {
		t.Fatalf("expected tensor length %d, got %d", expectedLen, len(tensor))
	}

	// Check normalization bounds: should be within roughly [-1.0, 1.0]
	for i, v := range tensor {
		if v < -1.01 || v > 1.01 {
			t.Fatalf("tensor[%d] = %f out of normalized bounds [-1.0, 1.0]", i, v)
		}
	}
}

func TestDecodeImageBase64(t *testing.T) {
	img := createTestImage(100, 100, color.White)
	var buf bytes.Buffer
	err := png.Encode(&buf, img)
	if err != nil {
		t.Fatalf("failed to encode test png: %v", err)
	}

	b64Data := "data:image/png;base64," + base64.StdEncoding.EncodeToString(buf.Bytes())
	decoded, format, err := DecodeImage([]byte(b64Data))
	if err != nil {
		t.Fatalf("failed to decode base64 data url: %v", err)
	}
	if format != "png" {
		t.Fatalf("expected png format, got %s", format)
	}
	if decoded.Bounds().Dx() != 100 || decoded.Bounds().Dy() != 100 {
		t.Fatalf("unexpected bounds for decoded image: %v", decoded.Bounds())
	}
}

func TestValidateFacePresence(t *testing.T) {
	// 1. Non-human image (blue / green landscape/object)
	nonFaceImg := image.NewRGBA(image.Rect(0, 0, 150, 150))
	for y := 0; y < 150; y++ {
		for x := 0; x < 150; x++ {
			nonFaceImg.Set(x, y, color.RGBA{R: 30, G: 80, B: 210, A: 255}) // Blue/cyan object
		}
	}

	hasFace, _ := ValidateFacePresence(nonFaceImg)
	if hasFace {
		t.Fatalf("expected blue object to be rejected by ValidateFacePresence")
	}

	// 2. Flat skin-colored object (e.g. beige wall / flat cardboard) -> Rejected for lack of facial features
	flatSkinImg := image.NewRGBA(image.Rect(0, 0, 150, 150))
	for y := 0; y < 150; y++ {
		for x := 0; x < 150; x++ {
			flatSkinImg.Set(x, y, color.RGBA{R: 210, G: 160, B: 125, A: 255})
		}
	}
	hasFaceFlat, reasonFlat := ValidateFacePresence(flatSkinImg)
	if hasFaceFlat {
		t.Fatalf("expected flat skin-toned surface to be rejected for lack of facial features")
	}
	if reasonFlat != "No distinct facial features detected. Please ensure your face is well-lit and not obstructed." {
		t.Fatalf("unexpected rejection reason: %s", reasonFlat)
	}

	// 3. Realistic face image with natural skin tones AND facial feature gradients (eyes, nose, mouth)
	faceImg := image.NewRGBA(image.Rect(0, 0, 150, 150))
	for y := 0; y < 150; y++ {
		for x := 0; x < 150; x++ {
			dx := float64(x - 75)
			dy := float64(y - 75)
			dist := dx*dx + dy*dy
			val := uint8((int(dist)*3 + (x*11 + y*13)) % 256)
			faceImg.Set(x, y, color.RGBA{R: 220, G: 160, B: uint8(110 + (val % 80)), A: 255})
		}
	}

	hasFace2, reason := ValidateFacePresence(faceImg)
	if !hasFace2 {
		t.Fatalf("expected skin-toned face image with facial features to pass, failed with: %s", reason)
	}
}

func TestPreprocessForMobileFaceNet(t *testing.T) {
	// 1. Non-face image should be rejected
	chairImg := image.NewRGBA(image.Rect(0, 0, 150, 150))
	for y := 0; y < 150; y++ {
		for x := 0; x < 150; x++ {
			chairImg.Set(x, y, color.RGBA{R: 50, G: 80, B: 200, A: 255})
		}
	}
	_, _, err := PreprocessForMobileFaceNet(chairImg)
	if err == nil {
		t.Fatalf("expected non-face image to be rejected in PreprocessForMobileFaceNet")
	}

	// 2. Tensor transformation pipeline
	os.Setenv("SKIP_FACE_PRESENCE_CHECK", "true")
	defer os.Unsetenv("SKIP_FACE_PRESENCE_CHECK")

	faceImg := image.NewRGBA(image.Rect(0, 0, 150, 150))
	for y := 0; y < 150; y++ {
		for x := 0; x < 150; x++ {
			val := uint8((x*17 + y*19) % 256)
			faceImg.Set(x, y, color.RGBA{R: 220, G: 160, B: uint8(110 + (val % 80)), A: 255})
		}
	}
	tensor, q, err := PreprocessForMobileFaceNet(faceImg)
	if err != nil {
		t.Fatalf("expected valid face to pass PreprocessForMobileFaceNet, got: %v", err)
	}
	if !q.Passed || len(tensor) != ModelInputSize {
		t.Fatalf("invalid tensor or quality check result")
	}
}

