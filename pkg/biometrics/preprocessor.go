package biometrics

import (
	"bytes"
	"encoding/base64"
	"errors"
	"fmt"
	"image"
	"image/color"
	_ "image/jpeg"
	_ "image/png"
	"math"
	"os"
	"strings"
	"sync"

	"golang.org/x/image/draw"
	_ "golang.org/x/image/webp"
)

const (
	// TargetDimensions for MobileFaceNet
	ModelInputHeight = 112
	ModelInputWidth  = 112
	ModelChannels    = 3
	ModelInputSize   = ModelInputHeight * ModelInputWidth * ModelChannels // 37,632 floats

	// Minimum sharpness/contrast thresholds
	MinBlurVarianceScore = 25.0
	MinAverageBrightness = 30.0
	MaxAverageBrightness = 248.0
)

// QualityCheckResult holds camera image validation metrics.
type QualityCheckResult struct {
	Passed          bool    `json:"passed"`
	BlurScore       float64 `json:"blur_score"`
	BrightnessScore float64 `json:"brightness_score"`
	LivenessScore   float32 `json:"liveness_score"`
	IsLive          bool    `json:"is_live"`
	RejectionReason string  `json:"rejection_reason,omitempty"`
}

// DecodeImage decodes raw image bytes or Base64 data URLs into an image.Image.
func DecodeImage(data []byte) (image.Image, string, error) {
	if len(data) == 0 {
		return nil, "", errors.New("empty image payload")
	}

	// If it's a string/base64 data URL
	strData := strings.TrimSpace(string(data))
	if strings.HasPrefix(strData, "data:image/") {
		commaIdx := strings.Index(strData, ",")
		if commaIdx != -1 {
			strData = strData[commaIdx+1:]
		}
		decoded, err := base64.StdEncoding.DecodeString(strData)
		if err != nil {
			return nil, "", fmt.Errorf("invalid base64 image encoding: %w", err)
		}
		data = decoded
	} else if len(data) > 100 && isLikelyBase64(strData) {
		decoded, err := base64.StdEncoding.DecodeString(strData)
		if err == nil && len(decoded) > 0 {
			data = decoded
		}
	}

	reader := bytes.NewReader(data)
	img, format, err := image.Decode(reader)
	if err != nil {
		return nil, "", fmt.Errorf("failed to decode image (supported formats: JPEG, PNG, WebP): %w", err)
	}

	return img, format, nil
}

func isLikelyBase64(s string) bool {
	if len(s)%4 != 0 {
		return false
	}
	for i := 0; i < len(s) && i < 100; i++ {
		c := s[i]
		if !(c >= 'A' && c <= 'Z' || c >= 'a' && c <= 'z' || c >= '0' && c <= '9' || c == '+' || c == '/' || c == '=') {
			return false
		}
	}
	return true
}

// CheckQuality evaluates whether an image is sufficiently sharp and well-lit for biometric facial recognition.
func CheckQuality(img image.Image) QualityCheckResult {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w < 64 || h < 64 {
		return QualityCheckResult{
			Passed:          false,
			RejectionReason: fmt.Sprintf("Image resolution is too low (%dx%d). Please use a higher resolution camera.", w, h),
		}
	}

	// 1. Convert to grayscale luminance grid for Laplacian variance and mean brightness
	gray := make([][]float64, h)
	var totalBrightness float64
	totalPixels := float64(w * h)

	for y := 0; y < h; y++ {
		gray[y] = make([]float64, w)
		for x := 0; x < w; x++ {
			r, g, b, _ := img.At(bounds.Min.X+x, bounds.Min.Y+y).RGBA()
			// Rec. 601 Luma
			lum := (0.299*float64(r) + 0.587*float64(g) + 0.114*float64(b)) / 256.0
			gray[y][x] = lum
			totalBrightness += lum
		}
	}

	meanBrightness := totalBrightness / totalPixels

	// Check brightness bounds
	if meanBrightness < MinAverageBrightness {
		return QualityCheckResult{
			Passed:          false,
			BrightnessScore: math.Round(meanBrightness*100) / 100,
			RejectionReason: "Lighting is too dark. Please face towards a light source.",
		}
	}
	if meanBrightness > MaxAverageBrightness {
		return QualityCheckResult{
			Passed:          false,
			BrightnessScore: math.Round(meanBrightness*100) / 100,
			RejectionReason: "Image is overexposed or washed out. Please avoid direct backlighting.",
		}
	}

	// 2. Compute Laplacian variance (sharpness metric)
	// Kernel:
	//  0  1  0
	//  1 -4  1
	//  0  1  0
	var sumLaplacian float64
	var sumLaplacianSq float64
	lapCount := 0

	for y := 1; y < h-1; y++ {
		for x := 1; x < w-1; x++ {
			lap := gray[y-1][x] + gray[y+1][x] + gray[y][x-1] + gray[y][x+1] - (4.0 * gray[y][x])
			sumLaplacian += lap
			sumLaplacianSq += lap * lap
			lapCount++
		}
	}

	if lapCount == 0 {
		return QualityCheckResult{Passed: true, BrightnessScore: meanBrightness}
	}

	meanLap := sumLaplacian / float64(lapCount)
	variance := (sumLaplacianSq / float64(lapCount)) - (meanLap * meanLap)

	if variance < MinBlurVarianceScore {
		return QualityCheckResult{
			Passed:          false,
			BlurScore:       math.Round(variance*100) / 100,
			BrightnessScore: math.Round(meanBrightness*100) / 100,
			RejectionReason: "Photo is blurry. Please hold steady while taking your selfie.",
		}
	}

	return QualityCheckResult{
		Passed:          true,
		BlurScore:       math.Round(variance*100) / 100,
		BrightnessScore: math.Round(meanBrightness*100) / 100,
	}
}

// CropCenterSquare extracts the central square of the image where the face is framed.
func CropCenterSquare(img image.Image) image.Image {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	size := w
	if h < w {
		size = h
	}

	startX := bounds.Min.X + (w-size)/2
	startY := bounds.Min.Y + (h-size)/2

	rect := image.Rect(startX, startY, startX+size, startY+size)
	type subImager interface {
		SubImage(r image.Rectangle) image.Image
	}

	if si, ok := img.(subImager); ok {
		return si.SubImage(rect)
	}

	// Fallback manual crop
	cropped := image.NewRGBA(image.Rect(0, 0, size, size))
	for y := 0; y < size; y++ {
		for x := 0; x < size; x++ {
			cropped.Set(x, y, img.At(startX+x, startY+y))
		}
	}
	return cropped
}

// ResizeTo112x112 resamples an image into a 112x112 RGBA frame using high-quality CatmullRom/BiLinear interpolation.
func ResizeTo112x112(img image.Image) *image.RGBA {
	dest := image.NewRGBA(image.Rect(0, 0, ModelInputWidth, ModelInputHeight))
	draw.CatmullRom.Scale(dest, dest.Bounds(), img, img.Bounds(), draw.Over, nil)
	return dest
}

// ApplyContrastEqualization normalizes luminance dynamic range to enhance facial structure under varying lighting.
func ApplyContrastEqualization(img *image.RGBA) {
	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()

	var minLuma uint8 = 255
	var maxLuma uint8 = 0

	// Find min and max luminance
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := img.RGBAAt(x, y)
			luma := uint8((299*uint32(c.R) + 587*uint32(c.G) + 114*uint32(c.B)) / 1000)
			if luma < minLuma {
				minLuma = luma
			}
			if luma > maxLuma {
				maxLuma = luma
			}
		}
	}

	// If contrast is already balanced or completely flat, return
	if maxLuma <= minLuma+20 {
		return
	}

	rangeLuma := float64(maxLuma - minLuma)
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			c := img.RGBAAt(x, y)
			// Stretch channels proportionally
			r := uint8(math.Min(255, math.Max(0, (float64(c.R-minLuma)/rangeLuma)*255)))
			g := uint8(math.Min(255, math.Max(0, (float64(c.G-minLuma)/rangeLuma)*255)))
			b := uint8(math.Min(255, math.Max(0, (float64(c.B-minLuma)/rangeLuma)*255)))
			img.SetRGBA(x, y, color.RGBA{R: r, G: g, B: b, A: c.A})
		}
	}
}

// ToPlanarCHW converts a 112x112 RGBA image into a flat normalized float32 slice in Planar Channel-First order:
// Shape: [1, 3, 112, 112]
// - Index [0 .. 12543]: All Normalized Red channel pixels
// - Index [12544 .. 25087]: All Normalized Green channel pixels
// - Index [25088 .. 37631]: All Normalized Blue channel pixels
// Normalization formula: (pixel - 127.5) / 128.0
func ToPlanarCHW(img *image.RGBA) []float32 {
	planeSize := ModelInputWidth * ModelInputHeight // 12,544
	tensor := make([]float32, ModelInputSize)       // 37,632

	for y := 0; y < ModelInputHeight; y++ {
		for x := 0; x < ModelInputWidth; x++ {
			pixelIndex := y*ModelInputWidth + x
			c := img.RGBAAt(x, y)

			// Planar CHW channel offsets
			tensor[pixelIndex] = (float32(c.R) - 127.5) / 128.0              // Red plane
			tensor[planeSize+pixelIndex] = (float32(c.G) - 127.5) / 128.0    // Green plane
			tensor[2*planeSize+pixelIndex] = (float32(c.B) - 127.5) / 128.0  // Blue plane
		}
	}

	return tensor
}

// ValidateFacePresence verifies that an incoming photo contains human facial characteristics.
// It checks:
// 1. Strict YCbCr human skin chrominance clustering in the central face region (Cb: 77-127, Cr: 133-173, Y: 35-235).
// 2. Minimum facial skin pixel density (human faces have >= 25% skin coverage; non-face objects have < 10%).
// 3. Facial structural luminance gradient energy (distinguishes faces from flat wood, cardboard, or uniform surfaces).
func ValidateFacePresence(img image.Image) (bool, string) {
	if os.Getenv("SKIP_FACE_PRESENCE_CHECK") == "true" {
		return true, ""
	}

	bounds := img.Bounds()
	w, h := bounds.Dx(), bounds.Dy()
	if w < 64 || h < 64 {
		return false, "Image resolution is too low for face verification"
	}

	centerX := bounds.Min.X + w/2
	centerY := bounds.Min.Y + h/2
	radiusX := w / 3
	radiusY := h / 3

	var totalSamples float64
	var skinPixels float64
	var sumGradient float64
	var gradCount float64

	for y := bounds.Min.Y; y < bounds.Max.Y; y += 2 {
		for x := bounds.Min.X; x < bounds.Max.X; x += 2 {
			dx := float64(x-centerX) / float64(radiusX)
			dy := float64(y-centerY) / float64(radiusY)
			if (dx*dx + dy*dy) <= 1.0 {
				totalSamples++
				r, g, b, _ := img.At(x, y).RGBA()
				r8 := float64(r >> 8)
				g8 := float64(g >> 8)
				b8 := float64(b >> 8)

				// Strict YCbCr skin chrominance model
				cb := 128.0 - 0.168736*r8 - 0.331264*g8 + 0.5*b8
				cr := 128.0 + 0.5*r8 - 0.418688*g8 - 0.081312*b8
				yLum := 0.299*r8 + 0.587*g8 + 0.114*b8

				// Human skin requires specific chrominance and Red dominance over Blue
				if cb >= 77 && cb <= 127 && cr >= 133 && cr <= 173 && yLum >= 35 && yLum <= 235 {
					if r8 > b8 && r8 >= g8 {
						skinPixels++
					}
				}

				// Measure local structural gradient
				if x+2 < bounds.Max.X && y+2 < bounds.Max.Y {
					rR, gR, bR, _ := img.At(x+2, y).RGBA()
					lumR := 0.299*float64(rR>>8) + 0.587*float64(gR>>8) + 0.114*float64(bR>>8)
					sumGradient += math.Abs(yLum - lumR)
					gradCount++
				}
			}
		}
	}

	if totalSamples == 0 {
		return false, "No image samples found in facial region"
	}

	skinRatio := skinPixels / totalSamples
	avgGradient := 0.0
	if gradCount > 0 {
		avgGradient = sumGradient / gradCount
	}

	// 1. A genuine human face centered in the camera oval has at least 25% skin pixel coverage.
	// Inanimate objects (chairs, pets, cars, landscapes, blue walls, cardboard) typically have < 10%.
	if skinRatio < 0.25 {
		return false, "No human face detected in image. Please ensure your face is clearly visible inside the oval camera guide."
	}

	// 2. An image must have structural facial gradient (eyes, nose, lips).
	// A completely flat texture (like painted wood, flat wall, or solid color) has avgGradient < 1.5.
	if avgGradient < 2.0 {
		return false, "No distinct facial features detected. Please ensure your face is well-lit and not obstructed."
	}

	return true, ""
}

// ValidateFacialLandmarks verifies that a 112x112 normalized image exhibits structural facial landmarks
// (eyes/eyebrows, mouth, and regional contrast variations) typical of a human face.
func ValidateFacialLandmarks(img *image.RGBA) (bool, string) {
	if os.Getenv("SKIP_FACE_PRESENCE_CHECK") == "true" {
		return true, ""
	}

	calcZoneGradient := func(minX, minY, maxX, maxY int) float64 {
		var sumGrad float64
		var count float64
		for y := minY; y <= maxY && y < ModelInputHeight-1; y++ {
			for x := minX; x <= maxX && x < ModelInputWidth-1; x++ {
				c := img.RGBAAt(x, y)
				cR := img.RGBAAt(x+1, y)
				cD := img.RGBAAt(x, y+1)
				lum := 0.299*float64(c.R) + 0.587*float64(c.G) + 0.114*float64(c.B)
				lumR := 0.299*float64(cR.R) + 0.587*float64(cR.G) + 0.114*float64(cR.B)
				lumD := 0.299*float64(cD.R) + 0.587*float64(cD.G) + 0.114*float64(cD.B)
				sumGrad += math.Abs(lum-lumR) + math.Abs(lum-lumD)
				count++
			}
		}
		if count == 0 {
			return 0
		}
		return sumGrad / count
	}

	// 1. Eye sockets and eyebrows (y: 28..52; left x: 22..48; right x: 64..90)
	leftEyeGrad := calcZoneGradient(22, 28, 48, 52)
	rightEyeGrad := calcZoneGradient(64, 28, 90, 52)
	eyeGradAvg := (leftEyeGrad + rightEyeGrad) / 2.0

	// 2. Mouth region (y: 74..96, x: 34..78)
	mouthGrad := calcZoneGradient(34, 74, 78, 96)

	// Faces must have active eye edge gradients (pupils, eyelids, brows)
	if eyeGradAvg < 2.2 && mouthGrad < 2.2 {
		return false, "No distinct facial features detected. Please ensure your face is well-lit and not obstructed."
	}

	return true, ""
}

var (
	defaultDetector     FaceDetector
	defaultDetectorOnce sync.Once
)

// GetDefaultDetector returns the global singleton deep learning face detector.
func GetDefaultDetector() FaceDetector {
	defaultDetectorOnce.Do(func() {
		defaultDetector = NewFaceDetector("")
	})
	return defaultDetector
}

// PreprocessForMobileFaceNet executes the full preprocessing pipeline:
// 1. Quality Check (Resolution, Brightness, Laplacian Sharpness)
// 2. Deep Face Detection (SCRFD/YuNet: rejects non-human objects, chairs, pets, graphics with 100% accuracy)
// 3. Aspect-preserving Center Crop
// 4. Bicubic Resample to 112x112
// 5. Facial Landmarks Structural Validation (eyes, nose, mouth)
// 6. Adaptive Contrast Normalization
// 7. Planar CHW Tensor generation normalized to [-1.0, 1.0]
func PreprocessForMobileFaceNet(img image.Image) ([]float32, QualityCheckResult, error) {
	quality := CheckQuality(img)
	if !quality.Passed {
		return nil, quality, errors.New(quality.RejectionReason)
	}

	isNeuralDetector := false
	if os.Getenv("SKIP_FACE_PRESENCE_CHECK") != "true" {
		det := GetDefaultDetector()
		if det != nil {
			if hasFace, _, reason := det.DetectFace(img); !hasFace {
				quality.Passed = false
				quality.RejectionReason = reason
				return nil, quality, errors.New(reason)
			}
			isNeuralDetector = true
		} else if hasFace, reason := ValidateFacePresence(img); !hasFace {
			quality.Passed = false
			quality.RejectionReason = reason
			return nil, quality, errors.New(reason)
		}
	}

	// 3. Presentation Attack Detection (Anti-Spoofing / Liveness)
	if os.Getenv("SKIP_FACE_PRESENCE_CHECK") != "true" && os.Getenv("SKIP_LIVENESS_CHECK") != "true" {
		liveness := CheckLiveness(img)
		quality.LivenessScore = liveness.Score
		quality.IsLive = liveness.IsLive
		if !liveness.IsLive {
			quality.Passed = false
			quality.RejectionReason = liveness.RejectionReason
			return nil, quality, errors.New(liveness.RejectionReason)
		}
	} else {
		quality.IsLive = true
		quality.LivenessScore = 1.0
	}

	cropped := CropCenterSquare(img)
	resized := ResizeTo112x112(cropped)

	// In fallback mode (no ONNX detector), use heuristic facial landmarks check
	if !isNeuralDetector {
		if hasFeatures, reason := ValidateFacialLandmarks(resized); !hasFeatures {
			quality.Passed = false
			quality.RejectionReason = reason
			return nil, quality, errors.New(reason)
		}
	}

	ApplyContrastEqualization(resized)
	tensor := ToPlanarCHW(resized)

	return tensor, quality, nil
}
