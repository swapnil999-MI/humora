package biometrics

import (
	"image"
	"image/color"
	_ "image/jpeg"
	"os"
	"testing"
)

func TestCheckLiveness_RealFace(t *testing.T) {
	f, err := os.Open("../../scratch/lena.jpg")
	if err != nil {
		f, err = os.Open("scratch/lena.jpg")
	}
	if err == nil {
		defer f.Close()
		img, _, err := image.Decode(f)
		if err == nil {
			res := CheckLiveness(img)
			if !res.IsLive {
				t.Fatalf("expected real face (Lena) to pass liveness check, got score %f, reason: %s", res.Score, res.RejectionReason)
			}
			t.Logf("✓ Real face passed liveness check with score: %f", res.Score)
		}
	}
}

func TestCheckLiveness_DigitalScreenReplay(t *testing.T) {
	// Simulate an electronic display pixel grid (high-frequency periodic Moiré noise)
	w, h := 300, 300
	screenImg := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			// Alternating subpixel stripes typical of an LCD/OLED panel
			stripe := (x % 3) * 60
			grid := ((x%2 ^ y%2)) * 120
			screenImg.Set(x, y, color.RGBA{
				R: uint8(150 + stripe),
				G: uint8(130 + grid),
				B: uint8(110 + stripe),
				A: 255,
			})
		}
	}

	res := CheckLiveness(screenImg)
	if res.IsLive {
		t.Fatalf("expected digital screen replay to be rejected, but got score: %f", res.Score)
	}
	t.Logf("✓ Digital screen replay successfully blocked with score %f, reason: %s", res.Score, res.RejectionReason)
}

func TestCheckLiveness_FlatPaperPrint(t *testing.T) {
	// Simulate a low-dynamic-range, flat, washed out paper print
	w, h := 300, 300
	paperImg := image.NewRGBA(image.Rect(0, 0, w, h))
	for y := 0; y < h; y++ {
		for x := 0; x < w; x++ {
			// Zero chrominance variance, flat 2D illumination
			paperImg.Set(x, y, color.RGBA{R: 180, G: 165, B: 155, A: 255})
		}
	}

	res := CheckLiveness(paperImg)
	if res.IsLive {
		t.Fatalf("expected flat paper print to be rejected, but got score: %f", res.Score)
	}
	t.Logf("✓ Flat paper print successfully blocked with score %f, reason: %s", res.Score, res.RejectionReason)
}
