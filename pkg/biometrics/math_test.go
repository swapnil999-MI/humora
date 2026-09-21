package biometrics

import (
	"math"
	"testing"
)

func TestNormalizeUnitVector(t *testing.T) {
	vec := []float32{3.0, 4.0}
	normalized := NormalizeUnitVector(vec)

	// Length should be 1.0 (sqrt(0.6^2 + 0.8^2) = 1.0)
	var sumSquares float64
	for _, v := range normalized {
		sumSquares += float64(v) * float64(v)
	}
	norm := math.Sqrt(sumSquares)
	if math.Abs(norm-1.0) > 1e-5 {
		t.Fatalf("expected unit norm 1.0, got %f", norm)
	}

	if math.Abs(float64(normalized[0])-0.6) > 1e-5 || math.Abs(float64(normalized[1])-0.8) > 1e-5 {
		t.Fatalf("unexpected normalized values: %v", normalized)
	}
}

func TestCalculateSquaredL2Distance(t *testing.T) {
	vA := []float32{1.0, 2.0, 3.0}
	vB := []float32{1.0, 2.0, 3.0}

	dist, err := CalculateSquaredL2Distance(vA, vB)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dist != 0.0 {
		t.Fatalf("expected 0.0 distance for identical vectors, got %f", dist)
	}

	vC := []float32{4.0, 6.0, 3.0} // diffs: 3, 4, 0 -> 9 + 16 = 25
	dist2, err := CalculateSquaredL2Distance(vA, vC)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if dist2 != 25.0 {
		t.Fatalf("expected 25.0 distance, got %f", dist2)
	}
}

func TestComputeCentroidEmbedding(t *testing.T) {
	v1 := []float32{1.0, 0.0, 0.0}
	v2 := []float32{0.0, 1.0, 0.0}
	v3 := []float32{0.0, 0.0, 1.0}

	centroid, err := ComputeCentroidEmbedding([][]float32{v1, v2, v3})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}

	if len(centroid) != 3 {
		t.Fatalf("expected centroid length 3, got %d", len(centroid))
	}

	// Should be unit normalized: each component equal to 1/sqrt(3) ~= 0.57735
	expected := float32(1.0 / math.Sqrt(3.0))
	for i, val := range centroid {
		if math.Abs(float64(val-expected)) > 1e-4 {
			t.Fatalf("centroid[%d] = %f, expected %f", i, val, expected)
		}
	}
}

func TestVerifyIdentity(t *testing.T) {
	// Identical vectors
	v1 := []float32{0.5, 0.5, 0.5, 0.5}
	matched, dist, conf, err := VerifyIdentity(v1, v1, OptimalL2Threshold)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !matched {
		t.Fatalf("expected identity match for identical vectors")
	}
	if dist != 0.0 {
		t.Fatalf("expected distance 0.0, got %f", dist)
	}
	if conf != 100.0 {
		t.Fatalf("expected 100%% confidence, got %f", conf)
	}

	// Close vectors (within threshold)
	v2 := []float32{0.52, 0.48, 0.51, 0.49}
	matched2, dist2, conf2, err := VerifyIdentity(v1, v2, OptimalL2Threshold)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !matched2 {
		t.Fatalf("expected match for close vectors, dist: %f", dist2)
	}
	if conf2 < 90.0 {
		t.Fatalf("expected confidence > 90%% for close vectors, got %f", conf2)
	}

	// Distant/Orthogonal vectors
	v3 := []float32{1.0, 0.0, 0.0, 0.0}
	v4 := []float32{0.0, 1.0, 0.0, 0.0}
	matched3, dist3, conf3, err := VerifyIdentity(v3, v4, OptimalL2Threshold)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if matched3 {
		t.Fatalf("orthogonal vectors should not match (dist: %f, threshold: %f)", dist3, OptimalL2Threshold)
	}
	if dist3 < 1.9 {
		t.Fatalf("expected orthogonal distance around 2.0, got %f", dist3)
	}
	if conf3 > 10.0 {
		t.Fatalf("expected low confidence, got %f", conf3)
	}
}
