package hrms

import (
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/asn1"
	"encoding/base64"
	"math/big"
	"strings"
	"testing"
	"time"
)

func authField(t *testing.T, tag int, inner []byte) []byte {
	t.Helper()
	b, err := asn1.Marshal(asn1.RawValue{Class: asn1.ClassContextSpecific, Tag: tag, IsCompound: true, Bytes: inner})
	if err != nil {
		t.Fatal(err)
	}
	return b
}

func mustMarshal(t *testing.T, v any, params ...string) []byte {
	t.Helper()
	var b []byte
	var err error
	if len(params) > 0 {
		b, err = asn1.MarshalWithParams(v, params[0])
	} else {
		b, err = asn1.Marshal(v)
	}
	if err != nil {
		t.Fatal(err)
	}
	return b
}

type descOpts struct {
	level          int
	challenge      []byte
	noAuthRequired bool
	userAuthType   int
	authTimeout    int
}

func keyDescriptionDER(t *testing.T, o descOpts) []byte {
	t.Helper()
	var list []byte
	list = append(list, authField(t, tagPurpose, mustMarshal(t, []int{purposeSign}, "set"))...)
	if o.noAuthRequired {
		list = append(list, authField(t, tagNoAuthRequired, asn1.NullBytes)...)
	}
	if o.userAuthType != 0 {
		list = append(list, authField(t, tagUserAuthType, mustMarshal(t, o.userAuthType))...)
	}
	if o.authTimeout != 0 {
		list = append(list, authField(t, tagAuthTimeout, mustMarshal(t, o.authTimeout))...)
	}
	seq := func(b []byte) asn1.RawValue {
		return asn1.RawValue{Class: asn1.ClassUniversal, Tag: asn1.TagSequence, IsCompound: true, Bytes: b}
	}
	return mustMarshal(t, keyDescription{
		AttestationVersion:       200,
		AttestationSecurityLevel: asn1.Enumerated(o.level),
		KeymasterVersion:         200,
		KeymasterSecurityLevel:   asn1.Enumerated(o.level),
		AttestationChallenge:     o.challenge,
		UniqueID:                 []byte{},
		SoftwareEnforced:         seq(nil),
		HardwareEnforced:         seq(list),
	})
}

func TestKeyDescriptionRules(t *testing.T) {
	ch := sha256.Sum256([]byte("challenge"))
	good := descOpts{level: 1, challenge: ch[:], userAuthType: userAuthTypeFingerprint}
	if got, err := checkKeyDescription(keyDescriptionDER(t, good), ch[:]); err != nil || got.SecurityLevel != "tee" {
		t.Fatalf("hardware fingerprint-bound key rejected: %v", err)
	}
	strong := good
	strong.level = 2
	if got, err := checkKeyDescription(keyDescriptionDER(t, strong), ch[:]); err != nil || got.SecurityLevel != "strongbox" {
		t.Fatalf("StrongBox key rejected: %v", err)
	}

	other := sha256.Sum256([]byte("other"))
	bad := map[string]descOpts{
		"software key":     {level: 0, challenge: ch[:], userAuthType: userAuthTypeFingerprint},
		"wrong challenge":  {level: 1, challenge: other[:], userAuthType: userAuthTypeFingerprint},
		"no auth required": {level: 1, challenge: ch[:], noAuthRequired: true, userAuthType: userAuthTypeFingerprint},
		"PIN allowed":      {level: 1, challenge: ch[:], userAuthType: 1},
		"no auth type":     {level: 1, challenge: ch[:]},
		"time window":      {level: 1, challenge: ch[:], userAuthType: userAuthTypeFingerprint, authTimeout: 30},
	}
	for name, o := range bad {
		if _, err := checkKeyDescription(keyDescriptionDER(t, o), ch[:]); err == nil {
			t.Errorf("%s: accepted, want rejection", name)
		}
	}
}

func TestAttestationChainMustEndAtGoogleRoot(t *testing.T) {
	if len(googleAttestationRootKeys()) < 2 {
		t.Fatal("embedded Google attestation roots did not load")
	}
	// A chain made by anyone else (e.g. a key generated in software) is refused.
	rootKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	rootTmpl := &x509.Certificate{SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "fake root"},
		NotBefore: time.Now(), NotAfter: time.Now().Add(time.Hour), IsCA: true, BasicConstraintsValid: true}
	rootDER, _ := x509.CreateCertificate(rand.Reader, rootTmpl, rootTmpl, &rootKey.PublicKey, rootKey)
	leafKey, _ := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	leafTmpl := &x509.Certificate{SerialNumber: big.NewInt(2), Subject: pkix.Name{CommonName: "punch key"},
		NotBefore: time.Now(), NotAfter: time.Now().Add(time.Hour)}
	root, _ := x509.ParseCertificate(rootDER)
	leafDER, _ := x509.CreateCertificate(rand.Reader, leafTmpl, root, &leafKey.PublicKey, rootKey)
	pub, _ := x509.MarshalPKIXPublicKey(&leafKey.PublicKey)

	chain := []string{base64.StdEncoding.EncodeToString(leafDER), base64.StdEncoding.EncodeToString(rootDER)}
	_, err := VerifyPunchKeyAttestation(chain, pub, []byte("x"))
	if err == nil || !strings.Contains(err.Error(), "Google") {
		t.Fatalf("chain to a non-Google root: got %v", err)
	}
	if _, err := VerifyPunchKeyAttestation(chain[:1], pub, []byte("x")); err == nil {
		t.Fatal("a lone certificate must be rejected")
	}
}
