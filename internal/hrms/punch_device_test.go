package hrms

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"testing"
	"time"

	"github.com/google/uuid"
)

func TestPunchChallengeIsBoundToUserTypeAndTime(t *testing.T) {
	tenant, user, other := uuid.New(), uuid.New(), uuid.New()
	now := time.Now()
	ch := newPunchChallenge(tenant, user, "in", now)

	if err := checkPunchChallenge(ch, tenant, user, "in", now); err != nil {
		t.Fatalf("fresh challenge rejected: %v", err)
	}
	for name, err := range map[string]error{
		"other user":  checkPunchChallenge(ch, tenant, other, "in", now),
		"other type":  checkPunchChallenge(ch, tenant, user, "out", now),
		"expired":     checkPunchChallenge(ch, tenant, user, "in", now.Add(punchChallengeTTL+time.Second)),
		"tampered":    checkPunchChallenge(ch[:len(ch)-2]+"AA", tenant, user, "in", now),
		"not a token": checkPunchChallenge("hello", tenant, user, "in", now),
	} {
		if err == nil {
			t.Errorf("%s: expected rejection", name)
		}
	}
}

func TestFingerprintKeySignatureVerifies(t *testing.T) {
	priv, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	der, _ := x509.MarshalPKIXPublicKey(&priv.PublicKey)
	pub, err := parsePunchDeviceKey(base64.StdEncoding.EncodeToString(der))
	if err != nil {
		t.Fatalf("P-256 key rejected: %v", err)
	}

	ch := newPunchChallenge(uuid.New(), uuid.New(), "in", time.Now())
	digest := sha256.Sum256([]byte(ch)) // what Android's SHA256withECDSA signs
	sig, _ := ecdsa.SignASN1(rand.Reader, priv, digest[:])
	if !ecdsa.VerifyASN1(pub, digest[:], sig) {
		t.Fatal("valid signature did not verify")
	}
	other := sha256.Sum256([]byte(ch + "x"))
	if ecdsa.VerifyASN1(pub, other[:], sig) {
		t.Fatal("signature verified for a different challenge")
	}

	p384, _ := ecdsa.GenerateKey(elliptic.P384(), rand.Reader)
	der384, _ := x509.MarshalPKIXPublicKey(&p384.PublicKey)
	if _, err := parsePunchDeviceKey(base64.StdEncoding.EncodeToString(der384)); err == nil {
		t.Fatal("non-P-256 key accepted")
	}
}
