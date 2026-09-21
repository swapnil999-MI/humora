package biometrics

import (
	"math"
	"testing"
)

func TestPureGoFaceEmbedder(t *testing.T) {
	embedder := NewPureGoFaceEmbedder()
	defer embedder.Close()

	// Create dummy normalized pixel tensor [112x112x3]
	pixels := make([]float32, ModelInputSize)
	for i := 0; i < len(pixels); i++ {
		pixels[i] = float32(i%100)/50.0 - 1.0 // between -1.0 and 1.0
	}

	embeddings, err := embedder.ExtractEmbeddings(pixels)
	if err != nil {
		t.Fatalf("failed to extract embeddings: %v", err)
	}

	if len(embeddings) != 128 {
		t.Fatalf("expected 128-dimensional embedding, got %d", len(embeddings))
	}

	// Verify unit norm
	var sumSquares float64
	for _, v := range embeddings {
		sumSquares += float64(v) * float64(v)
	}
	norm := math.Sqrt(sumSquares)
	if math.Abs(norm-1.0) > 1e-4 {
		t.Fatalf("expected unit norm 1.0, got %f", norm)
	}

	// Comparing identical input should yield distance 0.0
	embeddings2, err := embedder.ExtractEmbeddings(pixels)
	if err != nil {
		t.Fatalf("failed second extraction: %v", err)
	}

	matched, dist, conf, err := VerifyIdentity(embeddings, embeddings2, OptimalL2Threshold)
	if err != nil {
		t.Fatalf("verify error: %v", err)
	}
	if !matched || dist != 0.0 || conf != 100.0 {
		t.Fatalf("expected identical match: matched=%v, dist=%f, conf=%f", matched, dist, conf)
	}
}
