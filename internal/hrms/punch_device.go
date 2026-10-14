package hrms

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"errors"
	"fmt"
	"log"
	"strconv"
	"strings"
	"time"

	"humora-backend/configs"
	"humora-backend/pkg/media"

	"github.com/google/uuid"
)

// Fingerprint punches.
//
// The server never sees a fingerprint. Instead the phone holds an ECDSA P-256 key in
// the Android Keystore that can only sign right after a successful fingerprint scan
// (setUserAuthenticationRequired, invalidated when a new fingerprint is enrolled).
// The public half is registered once, together with a selfie that matches the
// employee's enrolled face (so the key belongs to the right person) and an Android Key
// Attestation chain proving those key properties (see attestation.go).
//
// Each punch signs a fresh server challenge: "v1.<tenant>.<user>.<type>.<expiry>.<nonce>.<mac>".
// The MAC makes challenges unforgeable, the expiry keeps them short-lived and a unique
// index on the punch row makes each one single-use.

const punchChallengeTTL = 2 * time.Minute

var (
	errChallengeInvalid    = errors.New("punch challenge is invalid or expired. please try again")
	errNoPunchDevice       = errors.New("fingerprint punch is not set up on this phone. set it up with a face check first")
	errFingerprintDisabled = errors.New("fingerprint punch is not enabled for you. ask HR or an admin to allow it, or punch with your face")
)

func punchChallengeKey() []byte {
	secret := ""
	if configs.AppConfig != nil {
		secret = configs.AppConfig.Server.JWTSecret
	}
	sum := sha256.Sum256([]byte("humora-punch-challenge|" + secret))
	return sum[:]
}

func signChallengePayload(payload string) string {
	mac := hmac.New(sha256.New, punchChallengeKey())
	mac.Write([]byte(payload))
	return base64.RawURLEncoding.EncodeToString(mac.Sum(nil))
}

func newPunchChallenge(tenantID, userID uuid.UUID, punchType string, now time.Time) string {
	nonce := make([]byte, 16)
	_, _ = rand.Read(nonce)
	payload := strings.Join([]string{
		"v1", tenantID.String(), userID.String(), punchType,
		strconv.FormatInt(now.Add(punchChallengeTTL).Unix(), 10),
		base64.RawURLEncoding.EncodeToString(nonce),
	}, ".")
	return payload + "." + signChallengePayload(payload)
}

// checkPunchChallenge confirms the challenge was issued by this server, to this
// user, for this punch type, and has not expired.
func checkPunchChallenge(challenge string, tenantID, userID uuid.UUID, punchType string, now time.Time) error {
	i := strings.LastIndexByte(challenge, '.')
	if i < 0 {
		return errChallengeInvalid
	}
	payload, mac := challenge[:i], challenge[i+1:]
	if !hmac.Equal([]byte(mac), []byte(signChallengePayload(payload))) {
		return errChallengeInvalid
	}
	parts := strings.Split(payload, ".")
	if len(parts) != 6 || parts[0] != "v1" || parts[1] != tenantID.String() || parts[2] != userID.String() || parts[3] != punchType {
		return errChallengeInvalid
	}
	exp, err := strconv.ParseInt(parts[4], 10, 64)
	if err != nil || now.Unix() > exp {
		return errChallengeInvalid
	}
	return nil
}

func parsePunchDeviceKey(b64 string) (*ecdsa.PublicKey, error) {
	der, err := base64.StdEncoding.DecodeString(strings.TrimSpace(b64))
	if err != nil {
		return nil, errors.New("public_key must be base64 DER (SubjectPublicKeyInfo)")
	}
	key, err := x509.ParsePKIXPublicKey(der)
	if err != nil {
		return nil, errors.New("public_key is not a valid public key")
	}
	ec, ok := key.(*ecdsa.PublicKey)
	if !ok || ec.Curve != elliptic.P256() {
		return nil, errors.New("public_key must be an ECDSA P-256 key")
	}
	return ec, nil
}

func validPunchType(t string) bool {
	return t == "in" || t == "out" || t == "break_start" || t == "break_end"
}

func (s *service) GetPunchDevice(ctx context.Context, tenantID, userID uuid.UUID) (*PunchDeviceStatus, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}
	d, err := s.repo.GetPunchDevice(ctx, tenantID, emp.ID)
	if err != nil {
		return nil, err
	}
	if d == nil {
		return &PunchDeviceStatus{}, nil
	}
	return &PunchDeviceStatus{
		Allowed:      true,
		Registered:   d.PublicKey != "",
		PublicKey:    d.PublicKey,
		DeviceLabel:  d.DeviceLabel,
		RegisteredAt: d.RegisteredAt,
	}, nil
}

// registerChallengeType marks challenges issued for registering a punch key.
const registerChallengeType = "register-device"

// IssueDeviceRegistrationChallenge returns the challenge the phone must bind into its new
// key's attestation (as SHA-256 of the challenge string).
func (s *service) IssueDeviceRegistrationChallenge(ctx context.Context, tenantID, userID uuid.UUID) (*PunchChallengeResponse, error) {
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}
	if d, err := s.repo.GetPunchDevice(ctx, tenantID, emp.ID); err != nil {
		return nil, err
	} else if d == nil {
		return nil, errFingerprintDisabled
	}
	return &PunchChallengeResponse{
		Challenge: newPunchChallenge(tenantID, userID, registerChallengeType, time.Now()),
		ExpiresIn: int(punchChallengeTTL.Seconds()),
	}, nil
}

func (s *service) RegisterPunchDevice(ctx context.Context, tenantID, userID uuid.UUID, req *RegisterPunchDeviceRequest) (*PunchDeviceStatus, error) {
	if strings.TrimSpace(req.SelfieImage) == "" {
		return nil, errors.New("a selfie is required to set up fingerprint punch")
	}
	if _, err := parsePunchDeviceKey(req.PublicKey); err != nil {
		return nil, err
	}
	// The key must be proven by Android Key Attestation to live in secure hardware and to
	// sign only after a fingerprint, created for this server's fresh challenge.
	if err := checkPunchChallenge(req.Challenge, tenantID, userID, registerChallengeType, time.Now()); err != nil {
		return nil, err
	}
	keyDER, _ := base64.StdEncoding.DecodeString(strings.TrimSpace(req.PublicKey))
	challengeHash := sha256.Sum256([]byte(req.Challenge))
	if _, err := VerifyPunchKeyAttestation(req.AttestationChain, keyDER, challengeHash[:]); err != nil {
		return nil, fmt.Errorf("fingerprint punch cannot be set up on this phone: %w", err)
	}
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}
	if d, err := s.repo.GetPunchDevice(ctx, tenantID, emp.ID); err != nil {
		return nil, err
	} else if d == nil {
		return nil, errFingerprintDisabled
	}

	match, err := s.verifyEmployeeFace(emp, req.SelfieImage)
	if err != nil {
		return nil, err
	}
	if !match.matched {
		return nil, fmt.Errorf("identity mismatch: face belongs to a different person (match score: %.1f%%). Fingerprint punch was not set up", match.confidence)
	}

	label := strings.TrimSpace(req.DeviceLabel)
	if len(label) > 120 {
		label = label[:120]
	}
	bound, err := s.repo.BindPunchDeviceKey(ctx, tenantID, emp.ID, strings.TrimSpace(req.PublicKey), label)
	if err != nil {
		return nil, fmt.Errorf("failed to register fingerprint device: %w", err)
	}
	if !bound { // access was removed while the face check ran
		return nil, errFingerprintDisabled
	}
	return s.GetPunchDevice(ctx, tenantID, userID)
}

func (s *service) IssuePunchChallenge(ctx context.Context, tenantID, userID uuid.UUID, punchType string) (*PunchChallengeResponse, error) {
	if !validPunchType(punchType) {
		return nil, errors.New("invalid punch_type: must be 'in', 'out', 'break_start', or 'break_end'")
	}
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}
	if _, err := ShiftForPunch(ctx, s.repo, tenantID, emp.ID, punchType); err != nil {
		return nil, err
	}
	if d, err := s.repo.GetPunchDevice(ctx, tenantID, emp.ID); err != nil {
		return nil, err
	} else if d == nil {
		return nil, errFingerprintDisabled
	} else if d.PublicKey == "" {
		return nil, errNoPunchDevice
	}
	return &PunchChallengeResponse{
		Challenge: newPunchChallenge(tenantID, userID, punchType, time.Now()),
		ExpiresIn: int(punchChallengeTTL.Seconds()),
	}, nil
}

func (s *service) PunchWithFingerprint(ctx context.Context, tenantID, userID uuid.UUID, req *PunchWithFingerprintRequest) (*PunchWithFingerprintResponse, error) {
	if !validPunchType(req.PunchType) {
		return nil, errors.New("invalid punch_type: must be 'in', 'out', 'break_start', or 'break_end'")
	}
	if err := checkPunchChallenge(req.Challenge, tenantID, userID, req.PunchType, time.Now()); err != nil {
		return nil, err
	}
	emp, err := s.repo.GetEmployeeByUserID(ctx, tenantID, userID)
	if err != nil || emp == nil {
		return nil, errors.New("employee profile not found for user")
	}
	if _, err := ShiftForPunch(ctx, s.repo, tenantID, emp.ID, req.PunchType); err != nil {
		return nil, err
	}
	device, err := s.repo.GetPunchDevice(ctx, tenantID, emp.ID)
	if err != nil {
		return nil, err
	}
	if device == nil {
		return nil, errFingerprintDisabled
	}
	key, err := parsePunchDeviceKey(device.PublicKey)
	if err != nil {
		return nil, errNoPunchDevice
	}
	sig, err := base64.StdEncoding.DecodeString(strings.TrimSpace(req.Signature))
	digest := sha256.Sum256([]byte(req.Challenge))
	if err != nil || !ecdsa.VerifyASN1(key, digest[:], sig) {
		return nil, errors.New("fingerprint signature could not be verified. if you changed phones or fingerprints, set up fingerprint punch again")
	}

	isGeofenceVerified, err := s.checkPunchGeofence(ctx, tenantID, req.Latitude, req.Longitude)
	if err != nil {
		return nil, err
	}

	challenge := req.Challenge
	source := strings.TrimSpace(req.Source)
	if source == "" {
		source = "android_fingerprint"
	}
	punch := &AttendancePunch{
		ID:                 uuid.New(),
		TenantID:           tenantID,
		EmployeeID:         emp.ID,
		PunchType:          req.PunchType,
		PunchedAt:          time.Now().UTC(),
		Latitude:           req.Latitude,
		Longitude:          req.Longitude,
		AccuracyMeters:     req.AccuracyMeters,
		IsGeofenceVerified: isGeofenceVerified,
		Source:             source,
		IsDeviceVerified:   true,
		DeviceChallenge:    &challenge,
	}
	if req.LocationID != nil && *req.LocationID != "" {
		if locID, err := uuid.Parse(*req.LocationID); err == nil {
			punch.LocationID = &locID
		}
	}
	if err := s.repo.CreateAttendancePunch(ctx, punch); err != nil {
		if strings.Contains(err.Error(), "idx_hrms_attendance_punches_device_challenge") {
			return nil, errChallengeInvalid
		}
		return nil, fmt.Errorf("failed to record attendance punch: %w", err)
	}

	return &PunchWithFingerprintResponse{
		ID:                 punch.ID.String(),
		PunchType:          punch.PunchType,
		PunchedAt:          punch.PunchedAt,
		IsDeviceVerified:   true,
		IsGeofenceVerified: isGeofenceVerified,
		Message:            fmt.Sprintf("Fingerprint verified. Check-%s recorded.", req.PunchType),
	}, nil
}

// ── HR / admin controls ──────────────────────────────────────────────────────

func (s *service) employeeInTenant(ctx context.Context, tenantID, employeeID uuid.UUID) error {
	emp, err := s.repo.GetEmployeeByID(ctx, tenantID, employeeID)
	if err != nil || emp == nil {
		return errors.New("employee record not found")
	}
	return nil
}

// ListFingerprintAccess returns every employee who may punch with a fingerprint, and their phone if set up.
func (s *service) ListFingerprintAccess(ctx context.Context, tenantID uuid.UUID) ([]PunchDevice, error) {
	devices, err := s.repo.ListPunchDevices(ctx, tenantID)
	if devices == nil {
		devices = []PunchDevice{}
	}
	return devices, err
}

// AllowFingerprint lets an employee set up fingerprint punching on their own phone.
func (s *service) AllowFingerprint(ctx context.Context, tenantID, employeeID, adminUserID uuid.UUID) error {
	if err := s.employeeInTenant(ctx, tenantID, employeeID); err != nil {
		return err
	}
	return s.repo.AllowPunchDevice(ctx, tenantID, employeeID, adminUserID)
}

// RemoveFingerprint deletes the employee's fingerprint access and phone key; fingerprint punches stop at once.
func (s *service) RemoveFingerprint(ctx context.Context, tenantID, employeeID uuid.UUID) error {
	if err := s.employeeInTenant(ctx, tenantID, employeeID); err != nil {
		return err
	}
	return s.repo.DeletePunchDevice(ctx, tenantID, employeeID)
}

// DeleteEmployeeFace removes the enrolled face template and master photo; face punches
// (and new fingerprint set-ups, which need a face match) fail until HR enrolls again.
func (s *service) DeleteEmployeeFace(ctx context.Context, tenantID, employeeID uuid.UUID) error {
	emp, err := s.repo.GetEmployeeByID(ctx, tenantID, employeeID)
	if err != nil || emp == nil {
		return errors.New("employee record not found")
	}
	if err := s.repo.ClearEmployeeBiometricFace(ctx, tenantID, employeeID); err != nil {
		return fmt.Errorf("failed to delete face data: %w", err)
	}
	if emp.BiometricFaceURL != nil {
		if i := strings.Index(*emp.BiometricFaceURL, "biometrics/"); i >= 0 {
			if err := media.DeleteFile(ctx, "paylogic-media", (*emp.BiometricFaceURL)[i:]); err != nil {
				log.Printf("[Biometrics] Face template cleared but master photo could not be deleted for employee %s: %v", employeeID, err)
			}
		}
	}
	return nil
}
