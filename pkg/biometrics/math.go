package biometrics

import (
	"errors"
	"math"
)

// OptimalL2Threshold is the calibrated squared Euclidean distance threshold for unit-normalized face embeddings (MobileFaceNet / ArcFace).
// For unit-normalized vectors: Distance <= 0.50 indicates strict match (Cosine >= 0.75, Confidence >= 75%).
// Distance > 0.50 indicates a mismatch / proxy attempt.
const OptimalL2Threshold float32 = 0.50

// NormalizeUnitVector normalizes a vector to unit length (L2 norm = 1.0).
// Unit normalization aligns Euclidean distance with Angular/Cosine distance, eliminating scale distortion.
func NormalizeUnitVector(vector []float32) []float32 {
	if len(vector) == 0 {
		return vector
	}

	var sumOfSquares float64
	for _, val := range vector {
		sumOfSquares += float64(val) * float64(val)
	}

	norm := float32(math.Sqrt(sumOfSquares))
	if norm == 0 {
		return vector
	}

	normalized := make([]float32, len(vector))
	for i, val := range vector {
		normalized[i] = val / norm
	}

	return normalized
}

// CalculateSquaredL2Distance computes the squared Euclidean distance between two face embeddings.
// Formula: sum((vectorA[i] - vectorB[i])^2)
func CalculateSquaredL2Distance(vectorA, vectorB []float32) (float32, error) {
	if len(vectorA) == 0 || len(vectorB) == 0 {
		return 0, errors.New("face vector embeddings cannot be empty")
	}
	if len(vectorA) != len(vectorB) {
		return 0, errors.New("vector dimensions must match")
	}

	var sumOfSquares float32
	for i := 0; i < len(vectorA); i++ {
		diff := vectorA[i] - vectorB[i]
		sumOfSquares += diff * diff
	}

	return sumOfSquares, nil
}

// ComputeCentroidEmbedding calculates the mean centroid embedding across 1 to N sample embeddings (Multi-shot enrollment),
// and normalizes the resulting centroid vector to unit length.
func ComputeCentroidEmbedding(vectors [][]float32) ([]float32, error) {
	if len(vectors) == 0 {
		return nil, errors.New("at least one embedding vector is required to compute centroid")
	}

	dim := len(vectors[0])
	if dim == 0 {
		return nil, errors.New("vector dimensions cannot be zero")
	}

	centroid := make([]float32, dim)
	for _, v := range vectors {
		if len(v) != dim {
			return nil, errors.New("all sample vectors must have identical dimensions")
		}
		for i := 0; i < dim; i++ {
			centroid[i] += v[i]
		}
	}

	sampleCount := float32(len(vectors))
	for i := 0; i < dim; i++ {
		centroid[i] /= sampleCount
	}

	return NormalizeUnitVector(centroid), nil
}

// VerifyIdentity checks if an extracted selfie face vector matches a stored profile vector.
// Returns:
// - isMatched: boolean decision based on threshold
// - distance: raw squared L2 distance (lower is closer)
// - confidence: normalized match confidence score percentage (0.0% to 100.0%)
func VerifyIdentity(currentFace, savedFace []float32, threshold float32) (bool, float32, float64, error) {
	if threshold <= 0 {
		threshold = OptimalL2Threshold
	}

	normCurrent := NormalizeUnitVector(currentFace)
	normSaved := NormalizeUnitVector(savedFace)

	distance, err := CalculateSquaredL2Distance(normCurrent, normSaved)
	if err != nil {
		return false, 0, 0, err
	}

	confidence := CalibrateConfidence(distance, threshold)
	isMatched := distance <= threshold
	return isMatched, distance, confidence, nil
}

// CalibrateConfidence maps squared Euclidean distance to a human-calibrated biometric match confidence score.
// - distance = 0.00 -> 100% (Identical)
// - distance <= threshold (0.50) -> 75% to 100% (Genuine match pass zone)
// - distance > threshold -> steeply decays to 0% (Impostor / Proxy / Non-human mismatch)
func CalibrateConfidence(distance, threshold float32) float64 {
	if threshold <= 0 {
		threshold = OptimalL2Threshold // 0.50
	}

	// 1. Exact match
	if distance <= 0.001 {
		return 100.0
	}

	// 2. Genuine Match Range (0 < distance <= threshold)
	// Smoothly scales from 100% down to 75% at threshold
	if distance <= threshold {
		ratio := float64(distance / threshold)
		conf := 100.0 - (ratio * 25.0)
		return math.Round(conf*10) / 10
	}

	// 3. Mismatch / Impostor Range (distance > threshold)
	// Distance from threshold to (threshold + 0.35) drops steeply from 74.9% down to 0%
	// Any distance >= (threshold + 0.35) is an unambiguous 0.0% mismatch.
	failSpan := float64(threshold * 0.70) // ~0.35
	excess := float64(distance - threshold)
	if excess >= failSpan {
		return 0.0
	}

	decay := math.Cos((excess / failSpan) * (math.Pi / 2.0))
	conf := 74.9 * decay * decay
	return math.Round(conf*10) / 10
}
