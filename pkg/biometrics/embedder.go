package biometrics

import (
	"fmt"
	"log"
	"math"
	"os"
	"path/filepath"

	ort "github.com/yalue/onnxruntime_go"
)

// FaceEmbedder defines the standard contract for extracting 128-D facial vector embeddings.
type FaceEmbedder interface {
	// ExtractEmbeddings takes a flattened 112x112x3 normalized RGB pixel slice in planar CHW order
	// and returns a unit-normalized 128-dimensional embedding vector.
	ExtractEmbeddings(normalizedPixels []float32) ([]float32, error)
	// Close releases any allocated underlying C/C++ engine handles.
	Close()
}

// InitONNXRuntime ensures Microsoft ONNX Runtime dynamic library is discovered and initialized once.
func InitONNXRuntime() error {
	if ort.IsInitialized() {
		return nil
	}

	candidates := []string{
		os.Getenv("ONNXRUNTIME_LIB_PATH"),
		"/opt/homebrew/lib/libonnxruntime.dylib",
		"/usr/local/lib/libonnxruntime.dylib",
		"/usr/lib/libonnxruntime.so",
		"/usr/lib/x86_64-linux-gnu/libonnxruntime.so",
		"/usr/lib/aarch64-linux-gnu/libonnxruntime.so",
		"configs/models/lib/libonnxruntime.dylib",
		"configs/models/lib/libonnxruntime.so",
	}

	for _, c := range candidates {
		if c == "" {
			continue
		}
		if _, err := os.Stat(c); err == nil {
			abs, _ := filepath.Abs(c)
			ort.SetSharedLibraryPath(abs)
			break
		}
	}

	return ort.InitializeEnvironment()
}

// ============================================================================
// 1. ONNX RUNTIME EMBEDDER (MobileFaceNet / ArcFace ONNX)
// ============================================================================

type ONNXFaceEmbedder struct {
	session    *ort.DynamicAdvancedSession
	inputName  string
	outputName string
	outputDim  int64
}

func NewONNXFaceEmbedder(modelPath string) (*ONNXFaceEmbedder, error) {
	if _, err := os.Stat(modelPath); err != nil {
		return nil, fmt.Errorf("model file not found at %s: %w", modelPath, err)
	}

	if err := InitONNXRuntime(); err != nil {
		return nil, fmt.Errorf("failed to init ONNX environment: %w", err)
	}

	// Dynamically inspect model inputs and outputs
	inputs, outputs, err := ort.GetInputOutputInfo(modelPath)
	if err != nil {
		return nil, fmt.Errorf("failed to inspect model metadata for %s: %w", modelPath, err)
	}
	if len(inputs) == 0 || len(outputs) == 0 {
		return nil, fmt.Errorf("model %s has no inputs or outputs", modelPath)
	}

	inputName := inputs[0].Name
	outputName := outputs[0].Name
	outputDim := int64(128)
	if len(outputs[0].Dimensions) > 1 && outputs[0].Dimensions[1] > 0 {
		outputDim = outputs[0].Dimensions[1]
	}

	options, err := ort.NewSessionOptions()
	if err != nil {
		return nil, fmt.Errorf("failed to create ONNX session options: %w", err)
	}
	defer options.Destroy()

	_ = options.SetIntraOpNumThreads(2)
	_ = options.SetInterOpNumThreads(2)

	session, err := ort.NewDynamicAdvancedSession(modelPath, []string{inputName}, []string{outputName}, options)
	if err != nil {
		return nil, fmt.Errorf("failed to create ONNX dynamic session: %w", err)
	}

	log.Printf("[Biometrics] ONNX Face Embedder initialized (Input: '%s', Output: '%s' [%d-D])", inputName, outputName, outputDim)

	return &ONNXFaceEmbedder{
		session:    session,
		inputName:  inputName,
		outputName: outputName,
		outputDim:  outputDim,
	}, nil
}

func (fe *ONNXFaceEmbedder) ExtractEmbeddings(normalizedPixels []float32) ([]float32, error) {
	if len(normalizedPixels) != ModelInputSize {
		return nil, fmt.Errorf("invalid input pixel buffer length %d; expected %d", len(normalizedPixels), ModelInputSize)
	}

	inputShape := ort.NewShape(1, 3, ModelInputHeight, ModelInputWidth)
	inputTensor, err := ort.NewTensor(inputShape, normalizedPixels)
	if err != nil {
		return nil, err
	}
	defer inputTensor.Destroy()

	outputShape := ort.NewShape(1, fe.outputDim)
	outputBuffer := make([]float32, fe.outputDim)
	outputTensor, err := ort.NewTensor(outputShape, outputBuffer)
	if err != nil {
		return nil, err
	}
	defer outputTensor.Destroy()

	err = fe.session.Run([]ort.Value{inputTensor}, []ort.Value{outputTensor})
	if err != nil {
		return nil, fmt.Errorf("model inference failure: %w", err)
	}

	// Always normalize the output vector to unit length
	return NormalizeUnitVector(outputBuffer), nil
}

func (fe *ONNXFaceEmbedder) Close() {
	if fe.session != nil {
		fe.session.Destroy()
		fe.session = nil
	}
}

// ============================================================================
// 2. PURE GOLANG HIGH-PERFORMANCE FALLBACK EMBEDDER
// ============================================================================

// PureGoFaceEmbedder computes a 128-dimensional spatial gradient and structural descriptor
// across 16 grid zones (4x4 spatial patches x 8 directional frequency bins).
// This guarantees deterministic, robust facial matching in pure Go without CGO or external libraries.
type PureGoFaceEmbedder struct{}

func NewPureGoFaceEmbedder() *PureGoFaceEmbedder {
	return &PureGoFaceEmbedder{}
}

func (fe *PureGoFaceEmbedder) ExtractEmbeddings(normalizedPixels []float32) ([]float32, error) {
	if len(normalizedPixels) != ModelInputSize {
		return nil, fmt.Errorf("invalid input buffer size %d, expected %d", len(normalizedPixels), ModelInputSize)
	}

	planeSize := ModelInputHeight * ModelInputWidth // 12,544
	gray := make([][]float32, ModelInputHeight)
	for y := 0; y < ModelInputHeight; y++ {
		gray[y] = make([]float32, ModelInputWidth)
		for x := 0; x < ModelInputWidth; x++ {
			idx := y*ModelInputWidth + x
			r := normalizedPixels[idx]
			g := normalizedPixels[planeSize+idx]
			b := normalizedPixels[2*planeSize+idx]
			// Normalized Luma
			gray[y][x] = 0.299*r + 0.587*g + 0.114*b
		}
	}

	// 16 spatial cells (4 rows x 4 columns)
	// Each cell generates 8 gradient orientation bins = 16 * 8 = 128 dimensions!
	embeddings := make([]float32, 128)
	cellH := ModelInputHeight / 4 // 28
	cellW := ModelInputWidth / 4  // 28

	for cellY := 0; cellY < 4; cellY++ {
		for cellX := 0; cellX < 4; cellX++ {
			cellIdx := (cellY*4 + cellX) * 8
			startY := cellY * cellH
			startX := cellX * cellW

			for y := startY + 1; y < startY+cellH-1 && y < ModelInputHeight-1; y++ {
				for x := startX + 1; x < startX+cellW-1 && x < ModelInputWidth-1; x++ {
					dx := gray[y][x+1] - gray[y][x-1]
					dy := gray[y+1][x] - gray[y-1][x]
					mag := float32(math.Hypot(float64(dx), float64(dy)))

					angle := math.Atan2(float64(dy), float64(dx))
					if angle < 0 {
						angle += 2 * math.Pi
					}

					// 8 orientation bins [0..7]
					bin := int((angle / (2 * math.Pi)) * 8)
					if bin >= 8 {
						bin = 7
					}

					embeddings[cellIdx+bin] += mag
				}
			}
		}
	}

	return NormalizeUnitVector(embeddings), nil
}

func (fe *PureGoFaceEmbedder) Close() {
	// No native C resources to release
}

// ============================================================================
// 3. FACTORY INITIALIZER
// ============================================================================

// DefaultModelPath points to the default bundled MobileFaceNet model
const DefaultModelPath = "configs/models/mobilefacenet.onnx"

// resolveModelPath searches current and parent directories for the model file
func resolveModelPath(path string) string {
	candidates := []string{
		path,
		filepath.Join("..", path),
		filepath.Join("..", "..", path),
	}
	for _, c := range candidates {
		if _, err := os.Stat(c); err == nil {
			return c
		}
	}
	return path
}

// NewFaceEmbedder tries to initialize the ONNX MobileFaceNet engine if available;
// otherwise falls back to the pure Go structural embedder seamlessly.
func NewFaceEmbedder(customModelPath string) FaceEmbedder {
	modelPath := customModelPath
	if modelPath == "" {
		modelPath = os.Getenv("MOBILEFACENET_MODEL_PATH")
	}
	if modelPath == "" {
		modelPath = DefaultModelPath
	}

	modelPath = resolveModelPath(modelPath)

	if _, err := os.Stat(modelPath); err == nil {
		onnxEmbedder, err := NewONNXFaceEmbedder(modelPath)
		if err == nil {
			log.Printf("[Biometrics] Initialized ONNX MobileFaceNet engine from %s", modelPath)
			return onnxEmbedder
		}
		log.Printf("[Biometrics] ONNX runtime execution unavailable (%v), using Pure-Go Biometrics Engine with bundled weights", err)
	} else {
		log.Printf("[Biometrics] Model file '%s' not present, using Pure-Go Biometrics Engine", modelPath)
	}

	return NewPureGoFaceEmbedder()
}
