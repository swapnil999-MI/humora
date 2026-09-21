package biometrics

import (
	"image"
	"image/color"
	"testing"
)

func TestONNXFaceDetectorAndEmbedder(t *testing.T) {
	// 1. Initialize FaceDetector
	detector := NewFaceDetector("")
	if detector == nil {
		t.Fatalf("expected non-nil detector")
	}
	defer detector.Close()

	// 2. Test Non-Human / Plain Object Image (Should return hasFace = false)
	chairImg := image.NewRGBA(image.Rect(0, 0, 300, 300))
	for y := 0; y < 300; y++ {
		for x := 0; x < 300; x++ {
			chairImg.Set(x, y, color.RGBA{R: 40, G: 70, B: 210, A: 255})
		}
	}
	hasFace, conf, reason := detector.DetectFace(chairImg)
	if hasFace {
		t.Fatalf("expected chair image to be rejected by detector, got confidence: %f", conf)
	}
	if reason != "No human face detected in image. Please ensure your face is clearly visible inside the oval camera guide." {
		t.Fatalf("unexpected reason: %s", reason)
	}

	// 2b. Test Flat Wood / Cardboard Image
	woodImg := image.NewRGBA(image.Rect(0, 0, 300, 300))
	for y := 0; y < 300; y++ {
		for x := 0; x < 300; x++ {
			woodImg.Set(x, y, color.RGBA{R: 205, G: 155, B: 120, A: 255})
		}
	}
	hasFaceWood, confWood, reasonWood := detector.DetectFace(woodImg)
	if hasFaceWood {
		t.Fatalf("expected flat wood image to be rejected by detector, got confidence: %f", confWood)
	}
	if reasonWood != "No human face detected in image. Please ensure your face is clearly visible inside the oval camera guide." {
		t.Fatalf("unexpected reason: %s", reasonWood)
	}

	// 3. Test MobileFaceNet ONNX Embedder
	embedder := NewFaceEmbedder("")
	if embedder == nil {
		t.Fatalf("expected non-nil embedder")
	}
	defer embedder.Close()

	dummyPixels := make([]float32, ModelInputSize)
	for i := range dummyPixels {
		dummyPixels[i] = 0.5
	}
	vec, err := embedder.ExtractEmbeddings(dummyPixels)
	if err != nil {
		t.Fatalf("ExtractEmbeddings failed: %v", err)
	}
	if len(vec) != 512 && len(vec) != 128 {
		t.Fatalf("expected 512-D or 128-D vector, got %d", len(vec))
	}

	// Verify unit normalization
	var sumSq float64
	for _, v := range vec {
		sumSq += float64(v) * float64(v)
	}
	if sumSq < 0.99 || sumSq > 1.01 {
		t.Fatalf("vector not unit normalized: sum of squares = %f", sumSq)
	}
}
