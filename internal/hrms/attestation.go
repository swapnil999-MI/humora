package hrms

import (
	"bytes"
	"crypto/x509"
	_ "embed"
	"encoding/asn1"
	"encoding/base64"
	"encoding/pem"
	"errors"
	"fmt"
	"sync"
)

// Android Key Attestation for fingerprint punches.
//
// When the phone creates its punch key, the Android Keystore issues a certificate chain for
// it, signed up to a Google hardware attestation root. The leaf carries a KeyDescription
// extension written by the secure hardware itself, stating how the key may be used. The
// server only accepts a key whose chain proves it lives in a TEE or StrongBox, signs only
// after a fingerprint scan (every use, no PIN fallback), and was created for the challenge
// this server issued. A key generated in software cannot produce such a chain.

//go:embed attestation_roots.pem
var attestationRootsPEM []byte

var (
	attestationRootsOnce sync.Once
	attestationRootKeys  [][]byte // DER SubjectPublicKeyInfo of each Google root
)

func googleAttestationRootKeys() [][]byte {
	attestationRootsOnce.Do(func() {
		rest := attestationRootsPEM
		for {
			var block *pem.Block
			block, rest = pem.Decode(rest)
			if block == nil {
				break
			}
			if cert, err := x509.ParseCertificate(block.Bytes); err == nil {
				attestationRootKeys = append(attestationRootKeys, cert.RawSubjectPublicKeyInfo)
			}
		}
	})
	return attestationRootKeys
}

var oidKeyDescription = asn1.ObjectIdentifier{1, 3, 6, 1, 4, 1, 11129, 2, 1, 17}

// keyDescription is the Android KeyDescription extension (later versions append fields,
// which encoding/asn1 tolerates at the end of a SEQUENCE).
type keyDescription struct {
	AttestationVersion       int
	AttestationSecurityLevel asn1.Enumerated
	KeymasterVersion         int
	KeymasterSecurityLevel   asn1.Enumerated
	AttestationChallenge     []byte
	UniqueID                 []byte
	SoftwareEnforced         asn1.RawValue
	HardwareEnforced         asn1.RawValue
}

const (
	securityLevelSoftware = 0 // 1 = TrustedEnvironment, 2 = StrongBox

	// AuthorizationList tags (Keymaster/KeyMint).
	tagPurpose        = 1
	tagNoAuthRequired = 503
	tagUserAuthType   = 504
	tagAuthTimeout    = 505

	purposeSign             = 2
	userAuthTypeFingerprint = 2 // HardwareAuthenticatorType: 1 = password, 2 = fingerprint (strong biometric)
)

// AttestedKey is what a verified attestation proves about the punch key.
type AttestedKey struct {
	SecurityLevel string // "tee" or "strongbox"
}

// VerifyPunchKeyAttestation checks an Android attestation chain (base64 DER certificates,
// leaf first) for the given public key and challenge.
func VerifyPunchKeyAttestation(chainB64 []string, publicKeyDER, challenge []byte) (*AttestedKey, error) {
	if len(chainB64) < 2 || len(chainB64) > 10 {
		return nil, errors.New("attestation chain is missing or malformed")
	}
	chain := make([]*x509.Certificate, len(chainB64))
	for i, c := range chainB64 {
		der, err := base64.StdEncoding.DecodeString(c)
		if err != nil {
			return nil, errors.New("attestation chain is not base64")
		}
		if chain[i], err = x509.ParseCertificate(der); err != nil {
			return nil, fmt.Errorf("attestation certificate %d is invalid", i)
		}
	}

	// Each certificate must be signed by the next one, and the last must be a Google root.
	// (Attestation certificates carry unusual validity periods, so dates are not checked.)
	for i := 0; i < len(chain)-1; i++ {
		if err := chain[i+1].CheckSignature(chain[i].SignatureAlgorithm, chain[i].RawTBSCertificate, chain[i].Signature); err != nil {
			return nil, errors.New("attestation chain signature does not verify")
		}
	}
	root := chain[len(chain)-1]
	if err := root.CheckSignature(root.SignatureAlgorithm, root.RawTBSCertificate, root.Signature); err != nil {
		return nil, errors.New("attestation root is not self-signed")
	}
	trusted := false
	for _, k := range googleAttestationRootKeys() {
		if bytes.Equal(k, root.RawSubjectPublicKeyInfo) {
			trusted = true
			break
		}
	}
	if !trusted {
		return nil, errors.New("attestation chain does not lead to a Google hardware attestation root")
	}

	leaf := chain[0]
	if !bytes.Equal(leaf.RawSubjectPublicKeyInfo, publicKeyDER) {
		return nil, errors.New("attestation is for a different key")
	}

	var ext []byte
	for _, e := range leaf.Extensions {
		if e.Id.Equal(oidKeyDescription) {
			ext = e.Value
			break
		}
	}
	if ext == nil {
		return nil, errors.New("attestation has no key description")
	}
	return checkKeyDescription(ext, challenge)
}

// checkKeyDescription enforces the hardware-reported key properties.
func checkKeyDescription(ext, challenge []byte) (*AttestedKey, error) {
	var kd keyDescription
	if _, err := asn1.Unmarshal(ext, &kd); err != nil {
		return nil, errors.New("attestation key description is malformed")
	}
	if int(kd.AttestationSecurityLevel) == securityLevelSoftware || int(kd.KeymasterSecurityLevel) == securityLevelSoftware {
		return nil, errors.New("the punch key is not stored in secure hardware on this phone")
	}
	if !bytes.Equal(kd.AttestationChallenge, challenge) {
		return nil, errors.New("attestation was not made for this server's challenge")
	}

	auth, err := parseAuthorizationList(kd.HardwareEnforced)
	if err != nil {
		return nil, err
	}
	if !auth.purposes[purposeSign] {
		return nil, errors.New("the punch key is not a signing key")
	}
	if auth.noAuthRequired {
		return nil, errors.New("the punch key can be used without a fingerprint")
	}
	if auth.userAuthType == nil || *auth.userAuthType != userAuthTypeFingerprint {
		return nil, errors.New("the punch key must require a fingerprint (not a PIN or pattern)")
	}
	if auth.authTimeout != nil && *auth.authTimeout != 0 {
		return nil, errors.New("the punch key must require a fingerprint for every punch")
	}

	level := "tee"
	if kd.AttestationSecurityLevel == 2 {
		level = "strongbox"
	}
	return &AttestedKey{SecurityLevel: level}, nil
}

type authorizationList struct {
	purposes       map[int]bool
	noAuthRequired bool
	userAuthType   *int64
	authTimeout    *int64
}

// parseAuthorizationList reads the few tags that matter from an AuthorizationList, a
// SEQUENCE of explicitly tagged fields that encoding/asn1 cannot map to a struct reliably.
func parseAuthorizationList(raw asn1.RawValue) (*authorizationList, error) {
	out := &authorizationList{purposes: map[int]bool{}}
	rest := raw.Bytes
	for len(rest) > 0 {
		var field asn1.RawValue
		var err error
		if rest, err = asn1.Unmarshal(rest, &field); err != nil {
			return nil, errors.New("attestation authorization list is malformed")
		}
		if field.Class != asn1.ClassContextSpecific {
			continue
		}
		switch field.Tag {
		case tagPurpose:
			var purposes []int
			if _, err := asn1.UnmarshalWithParams(field.Bytes, &purposes, "set"); err != nil {
				return nil, errors.New("attestation purpose is malformed")
			}
			for _, p := range purposes {
				out.purposes[p] = true
			}
		case tagNoAuthRequired:
			out.noAuthRequired = true
		case tagUserAuthType, tagAuthTimeout:
			var v int64
			if _, err := asn1.Unmarshal(field.Bytes, &v); err != nil {
				return nil, errors.New("attestation authorization value is malformed")
			}
			if field.Tag == tagUserAuthType {
				out.userAuthType = &v
			} else {
				out.authTimeout = &v
			}
		}
	}
	return out, nil
}
