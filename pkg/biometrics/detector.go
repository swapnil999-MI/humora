package biometrics

import (
	"fmt"
	"image"
	"log"
	"math"
	"os"
	"sync"

	ort "github.com/yalue/onnxruntime_go"
	"golang.org/x/image/draw"
)

// FaceDetector defines the contract for human facial presence and quality gating.
type FaceDetector interface {
	DetectFace(img image.Image) (hasFace bool, confidence float32, reason string)
	CropFaceLandmarks(img image.Image) (cropped image.Image, hasFace bool, reason string)
	Close()
}

// DefaultDetectorModelPath points to the default bundled SCRFD/YuNet face detection model.
const DefaultDetectorModelPath = "configs/models/face_detector.onnx"

// ONNXFaceDetector runs the deep learning face detector ONNX model natively in Go.
type ONNXFaceDetector struct {
	session *ort.DynamicAdvancedSession
	mu      sync.Mutex
}

func NewONNXFaceDetector(modelPath string) (*ONNXFaceDetector, error) {
	if _, err := os.Stat(modelPath); err != nil {
		return nil, fmt.Errorf("detector model not found at %s: %w", modelPath, err)
	}

	if err := InitONNXRuntime(); err != nil {
		return nil, fmt.Errorf("failed to init ONNX environment: %w", err)
	}

	options, err := ort.NewSessionOptions()
	if err != nil {
		return nil, fmt.Errorf("failed to create ONNX session options: %w", err)
	}
	defer options.Destroy()

	_ = options.SetIntraOpNumThreads(2)
	_ = options.SetInterOpNumThreads(2)

	// We query all 3 strides: 8 (small faces), 16 (medium faces), 32 (large close-up faces)
	inputNames := []string{"input"}
	outputNames := []string{
		"cls_8", "obj_8", "kps_8",
		"cls_16", "obj_16", "kps_16",
		"cls_32", "obj_32", "kps_32",
	}

	session, err := ort.NewDynamicAdvancedSession(modelPath, inputNames, outputNames, options)
	if err != nil {
		return nil, fmt.Errorf("failed to create face detector ONNX session: %w", err)
	}

	log.Printf("[Biometrics] ONNX Deep Face Detector initialized with multi-scale strides (8, 16, 32) from %s", modelPath)
	return &ONNXFaceDetector{session: session}, nil
}

// DetectFace runs deep neural inference to verify if an image contains a genuine human face.
func (d *ONNXFaceDetector) DetectFace(img image.Image) (bool, float32, string) {
	_, hasFace, conf, reason := d.detectInternal(img)
	return hasFace, conf, reason
}

// CropFaceLandmarks uses neural facial landmark coordinates (eyes) to crop and scale the face identically.
func (d *ONNXFaceDetector) CropFaceLandmarks(img image.Image) (image.Image, bool, string) {
	cropped, hasFace, _, reason := d.detectInternal(img)
	if !hasFace {
		return img, false, reason
	}
	return cropped, true, ""
}

func (d *ONNXFaceDetector) detectInternal(img image.Image) (image.Image, bool, float32, string) {
	if img == nil {
		return nil, false, 0, "Empty image provided"
	}

	d.mu.Lock()
	defer d.mu.Unlock()

	bounds := img.Bounds()
	origW, origH := bounds.Dx(), bounds.Dy()
	if origW < 64 || origH < 64 {
		return img, false, 0, "Image resolution is too low for face verification"
	}

	// Resize to 640x640 for detector model
	targetW, targetH := 640, 640
	resized := image.NewRGBA(image.Rect(0, 0, targetW, targetH))
	draw.ApproxBiLinear.Scale(resized, resized.Bounds(), img, bounds, draw.Over, nil)

	// Prepare planar CHW tensor [1, 3, 640, 640] in BGR planar order expected by SCRFD
	planeSize := targetW * targetH // 409,600
	pixels := make([]float32, 3*planeSize)
	for y := 0; y < targetH; y++ {
		for x := 0; x < targetW; x++ {
			idx := y*targetW + x
			c := resized.RGBAAt(x, y)
			pixels[idx] = float32(c.B)
			pixels[planeSize+idx] = float32(c.G)
			pixels[2*planeSize+idx] = float32(c.R)
		}
	}

	inputShape := ort.NewShape(1, 3, int64(targetH), int64(targetW))
	inputTensor, err := ort.NewTensor(inputShape, pixels)
	if err != nil {
		return img, false, 0, fmt.Sprintf("failed to create detector input tensor: %v", err)
	}
	defer inputTensor.Destroy()

	// 1. Stride 8 (6400 anchors for small faces)
	outCls8Buf := make([]float32, 6400)
	outCls8Tensor, _ := ort.NewTensor(ort.NewShape(1, 6400, 1), outCls8Buf)
	defer outCls8Tensor.Destroy()

	outObj8Buf := make([]float32, 6400)
	outObj8Tensor, _ := ort.NewTensor(ort.NewShape(1, 6400, 1), outObj8Buf)
	defer outObj8Tensor.Destroy()

	outKps8Buf := make([]float32, 6400*10)
	outKps8Tensor, _ := ort.NewTensor(ort.NewShape(1, 6400, 10), outKps8Buf)
	defer outKps8Tensor.Destroy()

	// 2. Stride 16 (1600 anchors for medium faces)
	outCls16Buf := make([]float32, 1600)
	outCls16Tensor, _ := ort.NewTensor(ort.NewShape(1, 1600, 1), outCls16Buf)
	defer outCls16Tensor.Destroy()

	outObj16Buf := make([]float32, 1600)
	outObj16Tensor, _ := ort.NewTensor(ort.NewShape(1, 1600, 1), outObj16Buf)
	defer outObj16Tensor.Destroy()

	outKps16Buf := make([]float32, 1600*10)
	outKps16Tensor, _ := ort.NewTensor(ort.NewShape(1, 1600, 10), outKps16Buf)
	defer outKps16Tensor.Destroy()

	// 3. Stride 32 (400 anchors for close-up selfie faces)
	outCls32Buf := make([]float32, 400)
	outCls32Tensor, _ := ort.NewTensor(ort.NewShape(1, 400, 1), outCls32Buf)
	defer outCls32Tensor.Destroy()

	outObj32Buf := make([]float32, 400)
	outObj32Tensor, _ := ort.NewTensor(ort.NewShape(1, 400, 1), outObj32Buf)
	defer outObj32Tensor.Destroy()

	outKps32Buf := make([]float32, 400*10)
	outKps32Tensor, _ := ort.NewTensor(ort.NewShape(1, 400, 10), outKps32Buf)
	defer outKps32Tensor.Destroy()

	outputs := []ort.Value{
		outCls8Tensor, outObj8Tensor, outKps8Tensor,
		outCls16Tensor, outObj16Tensor, outKps16Tensor,
		outCls32Tensor, outObj32Tensor, outKps32Tensor,
	}

	err = d.session.Run([]ort.Value{inputTensor}, outputs)
	if err != nil {
		return img, false, 0, fmt.Sprintf("detector inference failed: %v", err)
	}

	type StrideInfo struct {
		Stride int
		FeatW  int
		Cls    []float32
		Obj    []float32
		Kps    []float32
	}
	strides := []StrideInfo{
		{8, 80, outCls8Buf, outObj8Buf, outKps8Buf},
		{16, 40, outCls16Buf, outObj16Buf, outKps16Buf},
		{32, 20, outCls32Buf, outObj32Buf, outKps32Buf},
	}

	var bestScore float32
	var bestKp [10]float32
	var bestGx, bestGy float32
	var bestStride float32

	for _, s := range strides {
		for i := 0; i < len(s.Cls); i++ {
			sc := s.Cls[i] * s.Obj[i]
			if sc > bestScore {
				bestScore = sc
				bestStride = float32(s.Stride)
				bestGx = float32((i % s.FeatW) * s.Stride)
				bestGy = float32((i / s.FeatW) * s.Stride)
				for k := 0; k < 10; k++ {
					bestKp[k] = s.Kps[i*10+k]
				}
			}
		}
	}

	// Non-human objects score < 0.10. Genuine faces consistently score >= 0.75.
	const MinDetectionConfidence float32 = 0.35
	if bestScore < MinDetectionConfidence {
		return img, false, bestScore, "No human face detected in image. Please ensure your face is clearly visible inside the oval camera guide."
	}

	// Neural Landmark Proportional Scaling
	scaleX := float32(origW) / 640.0
	scaleY := float32(origH) / 640.0

	// Landmark 0: Left Eye, Landmark 1: Right Eye
	eyeLx := (bestGx + bestKp[0]*bestStride) * scaleX
	eyeLy := (bestGy + bestKp[1]*bestStride) * scaleY
	eyeRx := (bestGx + bestKp[2]*bestStride) * scaleX
	eyeRy := (bestGy + bestKp[3]*bestStride) * scaleY

	dx := float64(eyeRx - eyeLx)
	dy := float64(eyeRy - eyeLy)
	eyeDist := math.Sqrt(dx*dx + dy*dy)

	if eyeDist < 12.0 {
		return CropFaceAdaptive(img), true, bestScore, ""
	}

	eyeCx := float64(eyeLx+eyeRx) / 2.0
	eyeCy := float64(eyeLy+eyeRy) / 2.0

	// Optimal MobileFaceNet crop: eye distance occupies ~32% of 112px box
	cropSize := eyeDist * 3.15
	cy := eyeCy + eyeDist*0.45
	cx := eyeCx

	startX := int(cx - cropSize/2.0)
	startY := int(cy - cropSize*0.52)
	size := int(cropSize)

	if startX < bounds.Min.X {
		startX = bounds.Min.X
	}
	if startX+size > bounds.Max.X {
		startX = bounds.Max.X - size
	}
	if startY < bounds.Min.Y {
		startY = bounds.Min.Y
	}
	if startY+size > bounds.Max.Y {
		startY = bounds.Max.Y - size
	}
	if size > origW {
		size = origW
	}
	if size > origH {
		size = origH
	}

	rect := image.Rect(startX, startY, startX+size, startY+size)
	type subImager interface {
		SubImage(r image.Rectangle) image.Image
	}
	if si, ok := img.(subImager); ok {
		return si.SubImage(rect), true, bestScore, ""
	}

	cropped := image.NewRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			cropped.Set(x, y, img.At(startX+x, startY+y))
		}
	}

	return cropped, true, bestScore, ""
}

func (d *ONNXFaceDetector) Close() {
	if d.session != nil {
		d.session.Destroy()
		d.session = nil
	}
}

// FallbackFaceDetector uses color/heuristic checks when ONNX is unavailable
type FallbackFaceDetector struct{}

func (f *FallbackFaceDetector) DetectFace(img image.Image) (bool, float32, string) {
	hasFace, reason := ValidateFacePresence(img)
	if !hasFace {
		return false, 0.0, reason
	}
	return true, 0.85, ""
}

func (f *FallbackFaceDetector) CropFaceLandmarks(img image.Image) (image.Image, bool, string) {
	hasFace, reason := ValidateFacePresence(img)
	if !hasFace {
		return img, false, reason
	}
	return CropFaceAdaptive(img), true, ""
}

func (f *FallbackFaceDetector) Close() {}

// NewFaceDetector returns an ONNX deep learning face detector if the model is found,
// otherwise falling back gracefully.
func NewFaceDetector(customModelPath string) FaceDetector {
	modelPath := customModelPath
	if modelPath == "" {
		modelPath = os.Getenv("FACE_DETECTOR_MODEL_PATH")
	}
	if modelPath == "" {
		modelPath = DefaultDetectorModelPath
	}

	modelPath = resolveModelPath(modelPath)

	if _, err := os.Stat(modelPath); err == nil {
		detector, err := NewONNXFaceDetector(modelPath)
		if err == nil {
			return detector
		}
		log.Printf("[Biometrics] ONNX Face Detector unavailable (%v), using fallback presence detector", err)
	} else {
		log.Printf("[Biometrics] Detector model file '%s' not present, using fallback detector", modelPath)
	}

	return &FallbackFaceDetector{}
}
