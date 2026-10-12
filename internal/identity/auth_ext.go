package identity

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"sync"
	"time"

	"humora-backend/configs"

	"github.com/google/uuid"
)

// ── In-Memory Session Stores ────────────────────────────────────────────────

type QRSession struct {
	SessionID string
	Nonce     string
	Status    string // "pending", "authenticated", "expired"
	Auth      *AuthResponse
	ExpiresAt time.Time
	// Who asked for it, shown on the phone before approving so a QR code
	// relayed by a phisher can be recognised.
	RequesterIP    string
	RequesterAgent string
}

type OAuthState struct {
	State      string
	Provider   string
	ClientType string // "web" or "mobile"
	// Challenge is the SHA-256 (base64url) of a secret only the client that
	// started the login holds; the tokens are released only for that secret.
	Challenge string
	ExpiresAt time.Time
}

// OAuthCode is a finished social login waiting to be collected. Tokens never
// travel in a redirect URL (browser history, logs, an app that hijacks the
// humora:// scheme); only this one-time code does.
type OAuthCode struct {
	Auth      *AuthResponse
	Challenge string
	ExpiresAt time.Time
}

var (
	qrSessions  = sync.Map{}
	oauthStates = sync.Map{}
	oauthCodes  = sync.Map{}
)

const oauthCodeTTL = 2 * time.Minute

func init() {
	// Background cleanup of expired sessions and states every 60 seconds
	go func() {
		ticker := time.NewTicker(60 * time.Second)
		defer ticker.Stop()
		for range ticker.C {
			now := time.Now().UTC()
			qrSessions.Range(func(key, value any) bool {
				if sess, ok := value.(*QRSession); ok && sess.ExpiresAt.Before(now) {
					qrSessions.Delete(key)
				}
				return true
			})
			oauthStates.Range(func(key, value any) bool {
				if st, ok := value.(*OAuthState); ok && st.ExpiresAt.Before(now) {
					oauthStates.Delete(key)
				}
				return true
			})
			oauthCodes.Range(func(key, value any) bool {
				if oc, ok := value.(*OAuthCode); ok && oc.ExpiresAt.Before(now) {
					oauthCodes.Delete(key)
				}
				return true
			})
		}
	}()
}

// ── Service Extension Interface ─────────────────────────────────────────────

type AuthExtService interface {
	GetEnabledProviders() *AuthProvidersResponse
	InitiateOAuth(provider, clientType, challenge string) (string, error)
	HandleOAuthCallback(ctx context.Context, provider, code, state string) (string, error)
	ExchangeOAuthCode(code, verifier string) (*AuthResponse, error)
	InitiateQRLogin(ctx context.Context, requesterIP, requesterAgent string) (*QRInitiateResponse, error)
	GetQRStatus(ctx context.Context, sessionID string) (*QRStatusResponse, error)
	GetQRInfo(sessionID, nonce string) (*QRInfoResponse, error)
	ConfirmQRLogin(ctx context.Context, sessionID, nonce string, userID uuid.UUID) error
}

type authExtService struct {
	repo Repository
}

func NewAuthExtService(repo Repository) AuthExtService {
	return &authExtService{repo: repo}
}

// ── Provider Discovery ──────────────────────────────────────────────────────

func (s *authExtService) GetEnabledProviders() *AuthProvidersResponse {
	cfg := configs.AppConfig.OAuth
	return &AuthProvidersResponse{
		Google:    cfg.GoogleClientID != "" && cfg.GoogleClientSecret != "",
		Github:    cfg.GithubClientID != "" && cfg.GithubClientSecret != "",
		Microsoft: cfg.MicrosoftClientID != "" && cfg.MicrosoftClientSecret != "",
		QRCode:    true, // Always enabled: 100% self-hosted
	}
}

// ── OAuth Initiation ────────────────────────────────────────────────────────

func (s *authExtService) InitiateOAuth(provider, clientType, challenge string) (string, error) {
	provider = strings.ToLower(strings.TrimSpace(provider))
	if clientType != "mobile" {
		clientType = "web"
	}
	// base64url of a SHA-256 digest is 43 characters.
	if len(challenge) != 43 || strings.Trim(challenge, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_") != "" {
		return "", errors.New("a code challenge is required to sign in with a provider")
	}

	stateBytes := make([]byte, 16)
	if _, err := rand.Read(stateBytes); err != nil {
		return "", fmt.Errorf("failed to generate secure state: %w", err)
	}
	state := hex.EncodeToString(stateBytes)

	oauthStates.Store(state, &OAuthState{
		State:      state,
		Provider:   provider,
		ClientType: clientType,
		Challenge:  challenge,
		ExpiresAt:  time.Now().UTC().Add(10 * time.Minute),
	})

	redirectURI := getOAuthCallbackURL(provider)
	cfg := configs.AppConfig.OAuth

	switch provider {
	case "google":
		if cfg.GoogleClientID == "" {
			return "", errors.New("Google OAuth is not configured on this server")
		}
		params := url.Values{
			"client_id":     {cfg.GoogleClientID},
			"redirect_uri":  {redirectURI},
			"response_type": {"code"},
			"scope":         {"openid email profile"},
			"state":         {state},
			"access_type":   {"offline"},
			"prompt":        {"select_account"},
		}
		return "https://accounts.google.com/o/oauth2/v2/auth?" + params.Encode(), nil

	case "github":
		if cfg.GithubClientID == "" {
			return "", errors.New("GitHub OAuth is not configured on this server")
		}
		params := url.Values{
			"client_id":    {cfg.GithubClientID},
			"redirect_uri": {redirectURI},
			"scope":        {"read:user user:email"},
			"state":        {state},
		}
		return "https://github.com/login/oauth/authorize?" + params.Encode(), nil

	case "microsoft":
		if cfg.MicrosoftClientID == "" {
			return "", errors.New("Microsoft OAuth is not configured on this server")
		}
		params := url.Values{
			"client_id":     {cfg.MicrosoftClientID},
			"redirect_uri":  {redirectURI},
			"response_type": {"code"},
			"scope":         {"openid email profile User.Read"},
			"state":         {state},
		}
		return "https://login.microsoftonline.com/common/oauth2/v2.0/authorize?" + params.Encode(), nil

	default:
		return "", fmt.Errorf("unsupported OAuth provider %q", provider)
	}
}

// ── OAuth Callback Handling ─────────────────────────────────────────────────

func (s *authExtService) HandleOAuthCallback(ctx context.Context, provider, code, state string) (string, error) {
	val, ok := oauthStates.Load(state)
	if !ok {
		return "", errors.New("invalid or expired OAuth state")
	}
	st := val.(*OAuthState)
	oauthStates.Delete(state)

	if st.ExpiresAt.Before(time.Now().UTC()) {
		return "", errors.New("OAuth session expired. Please try again.")
	}
	if st.Provider != strings.ToLower(provider) {
		return "", errors.New("invalid or expired OAuth state")
	}

	// 1. Fetch the verified email from the provider
	email, _, _, err := s.exchangeCodeForProfile(provider, code)
	if err != nil {
		return "", fmt.Errorf("failed to verify with %s: %w", provider, err)
	}

	email = strings.ToLower(strings.TrimSpace(email))
	if email == "" {
		return "", errors.New("no verified email returned by identity provider")
	}

	// 2. Match an existing account. A social login never creates one: anybody
	// can hold a Google, GitHub or Microsoft account, so people get into an
	// organisation only by being invited to it.
	user, tenant, err := s.repo.GetUserByEmail(ctx, email)
	if err != nil {
		return "", fmt.Errorf("database lookup failed: %w", err)
	}
	if user == nil || tenant == nil {
		return "", errors.New("no Humora account uses this email address. Ask your administrator to invite you")
	}
	if user.Status != "active" {
		return "", fmt.Errorf("account is %s. please contact administrator", user.Status)
	}

	_ = s.repo.UpdateLastLogin(ctx, user.ID)

	roles, perms, _ := s.repo.GetRolesForUser(ctx, tenant.ID, user.ID)
	accessToken, refreshToken, err := generateTokens(user, tenant, roles, perms)
	if err != nil {
		return "", fmt.Errorf("failed to generate authentication tokens: %w", err)
	}

	// 3. Park the tokens behind a one-time code for the client that started this login.
	codeBytes := make([]byte, 32)
	if _, err := rand.Read(codeBytes); err != nil {
		return "", fmt.Errorf("failed to generate login code: %w", err)
	}
	code = hex.EncodeToString(codeBytes)
	oauthCodes.Store(code, &OAuthCode{
		Auth:      authResponse(user, tenant, roles, perms, accessToken, refreshToken),
		Challenge: st.Challenge,
		ExpiresAt: time.Now().UTC().Add(oauthCodeTTL),
	})

	if st.ClientType == "mobile" {
		return "humora://auth/callback?code=" + url.QueryEscape(code), nil
	}
	baseURL := strings.TrimRight(configs.AppConfig.Server.FrontendBaseURL, "/")
	return baseURL + "/?oauth_code=" + url.QueryEscape(code), nil
}

// ExchangeOAuthCode releases a finished social login's tokens, once, to the
// client that proves it started it (PKCE: SHA-256 of the verifier must match
// the challenge it sent at the start).
func (s *authExtService) ExchangeOAuthCode(code, verifier string) (*AuthResponse, error) {
	invalid := errors.New("this sign-in link is invalid or has expired. Please sign in again")
	val, ok := oauthCodes.LoadAndDelete(code)
	if !ok {
		return nil, invalid
	}
	oc := val.(*OAuthCode)
	if oc.ExpiresAt.Before(time.Now().UTC()) {
		return nil, invalid
	}
	digest := sha256.Sum256([]byte(verifier))
	if subtle.ConstantTimeCompare([]byte(base64.RawURLEncoding.EncodeToString(digest[:])), []byte(oc.Challenge)) != 1 {
		return nil, invalid
	}
	return oc.Auth, nil
}

func authResponse(user *User, tenant *Tenant, roles, perms []string, accessToken, refreshToken string) *AuthResponse {
	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(configs.AppConfig.Server.JWTAccessTokenExpiry.Seconds()),
		User: UserSummary{
			ID:             user.ID.String(),
			TenantID:       tenant.ID.String(),
			TenantName:     tenant.Name,
			TenantSlug:     tenant.Slug,
			Email:          user.Email,
			Status:         user.Status,
			PresenceStatus: user.PresenceStatus,
			Roles:          roles,
			Permissions:    perms,
		},
	}
}

// ── Provider Token & Profile Exchange ───────────────────────────────────────

func (s *authExtService) exchangeCodeForProfile(provider, code string) (email, firstName, lastName string, err error) {
	cfg := configs.AppConfig.OAuth
	client := &http.Client{Timeout: 15 * time.Second}
	callbackURL := getOAuthCallbackURL(provider)

	switch provider {
	case "google":
		tokenParams := url.Values{
			"code":          {code},
			"client_id":     {cfg.GoogleClientID},
			"client_secret": {cfg.GoogleClientSecret},
			"redirect_uri":  {callbackURL},
			"grant_type":    {"authorization_code"},
		}
		resp, err := client.PostForm("https://oauth2.googleapis.com/token", tokenParams)
		if err != nil {
			return "", "", "", err
		}
		defer resp.Body.Close()

		var tokRes struct {
			AccessToken string `json:"access_token"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&tokRes); err != nil || tokRes.AccessToken == "" {
			return "", "", "", errors.New("failed to retrieve Google access token")
		}

		// Fetch profile
		req, _ := http.NewRequest("GET", "https://www.googleapis.com/oauth2/v3/userinfo", nil)
		req.Header.Set("Authorization", "Bearer "+tokRes.AccessToken)
		profileResp, err := client.Do(req)
		if err != nil {
			return "", "", "", err
		}
		defer profileResp.Body.Close()

		var profile struct {
			Email         string `json:"email"`
			EmailVerified bool   `json:"email_verified"`
			GivenName     string `json:"given_name"`
			FamilyName    string `json:"family_name"`
			Name          string `json:"name"`
		}
		if err := json.NewDecoder(profileResp.Body).Decode(&profile); err != nil {
			return "", "", "", err
		}
		if !profile.EmailVerified {
			return "", "", "", errors.New("Google has not verified this account's email address")
		}
		firstName = profile.GivenName
		lastName = profile.FamilyName
		if firstName == "" && profile.Name != "" {
			parts := strings.SplitN(profile.Name, " ", 2)
			firstName = parts[0]
			if len(parts) > 1 {
				lastName = parts[1]
			}
		}
		return profile.Email, firstName, lastName, nil

	case "github":
		tokenParams := url.Values{
			"code":          {code},
			"client_id":     {cfg.GithubClientID},
			"client_secret": {cfg.GithubClientSecret},
			"redirect_uri":  {callbackURL},
		}
		req, _ := http.NewRequest("POST", "https://github.com/login/oauth/access_token", strings.NewReader(tokenParams.Encode()))
		req.Header.Set("Accept", "application/json")
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
		resp, err := client.Do(req)
		if err != nil {
			return "", "", "", err
		}
		defer resp.Body.Close()

		var tokRes struct {
			AccessToken string `json:"access_token"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&tokRes); err != nil || tokRes.AccessToken == "" {
			return "", "", "", errors.New("failed to retrieve GitHub access token")
		}

		// Fetch user profile
		userReq, _ := http.NewRequest("GET", "https://api.github.com/user", nil)
		userReq.Header.Set("Authorization", "Bearer "+tokRes.AccessToken)
		userReq.Header.Set("Accept", "application/vnd.github.v3+json")
		uResp, err := client.Do(userReq)
		if err != nil {
			return "", "", "", err
		}
		defer uResp.Body.Close()

		var ghUser struct {
			Email string `json:"email"`
			Name  string `json:"name"`
			Login string `json:"login"`
		}
		_ = json.NewDecoder(uResp.Body).Decode(&ghUser)

		// Only the primary address GitHub has verified: the profile email and
		// other listed addresses can be ones the user has not proven they own.
		email = ""
		eReq, _ := http.NewRequest("GET", "https://api.github.com/user/emails", nil)
		eReq.Header.Set("Authorization", "Bearer "+tokRes.AccessToken)
		eReq.Header.Set("Accept", "application/vnd.github.v3+json")
		eResp, err := client.Do(eReq)
		if err != nil {
			return "", "", "", err
		}
		defer eResp.Body.Close()
		var emails []struct {
			Email    string `json:"email"`
			Primary  bool   `json:"primary"`
			Verified bool   `json:"verified"`
		}
		if err := json.NewDecoder(eResp.Body).Decode(&emails); err != nil {
			return "", "", "", err
		}
		for _, em := range emails {
			if em.Primary && em.Verified {
				email = em.Email
				break
			}
		}
		if email == "" {
			return "", "", "", errors.New("GitHub has no verified primary email for this account")
		}

		name := ghUser.Name
		if name == "" {
			name = ghUser.Login
		}
		parts := strings.SplitN(name, " ", 2)
		firstName = parts[0]
		if len(parts) > 1 {
			lastName = parts[1]
		}
		return email, firstName, lastName, nil

	case "microsoft":
		tokenParams := url.Values{
			"code":          {code},
			"client_id":     {cfg.MicrosoftClientID},
			"client_secret": {cfg.MicrosoftClientSecret},
			"redirect_uri":  {callbackURL},
			"grant_type":    {"authorization_code"},
		}
		resp, err := client.PostForm("https://login.microsoftonline.com/common/oauth2/v2.0/token", tokenParams)
		if err != nil {
			return "", "", "", err
		}
		defer resp.Body.Close()

		var tokRes struct {
			AccessToken string `json:"access_token"`
		}
		if err := json.NewDecoder(resp.Body).Decode(&tokRes); err != nil || tokRes.AccessToken == "" {
			return "", "", "", errors.New("failed to retrieve Microsoft access token")
		}

		// Fetch profile from Microsoft Graph
		mReq, _ := http.NewRequest("GET", "https://graph.microsoft.com/v1.0/me", nil)
		mReq.Header.Set("Authorization", "Bearer "+tokRes.AccessToken)
		mResp, err := client.Do(mReq)
		if err != nil {
			return "", "", "", err
		}
		defer mResp.Body.Close()

		var msUser struct {
			Mail              string `json:"mail"`
			UserPrincipalName string `json:"userPrincipalName"`
			GivenName         string `json:"givenName"`
			Surname           string `json:"surname"`
			DisplayName       string `json:"displayName"`
		}
		if err := json.NewDecoder(mResp.Body).Decode(&msUser); err != nil {
			return "", "", "", err
		}
		// `mail` can be set to any address by the account's own tenant admin
		// ("nOAuth"), so it is never trusted. The UPN must be on a domain that
		// tenant has verified; guest accounts (#EXT#) are refused.
		email = msUser.UserPrincipalName
		if !strings.Contains(email, "@") || strings.Contains(strings.ToUpper(email), "#EXT#") {
			return "", "", "", errors.New("Microsoft did not return a verified work address for this account")
		}
		firstName = msUser.GivenName
		lastName = msUser.Surname
		if firstName == "" && msUser.DisplayName != "" {
			parts := strings.SplitN(msUser.DisplayName, " ", 2)
			firstName = parts[0]
			if len(parts) > 1 {
				lastName = parts[1]
			}
		}
		return email, firstName, lastName, nil

	default:
		return "", "", "", fmt.Errorf("unknown provider %s", provider)
	}
}

func getOAuthCallbackURL(provider string) string {
	base := strings.TrimRight(configs.AppConfig.OAuth.RedirectBaseURL, "/")
	if base == "" {
		port := configs.AppConfig.Server.Port
		if port == "" {
			port = "8090"
		}
		base = "http://localhost:" + port
	}
	return fmt.Sprintf("%s/api/v1/auth/oauth/%s/callback", base, provider)
}

// ── WhatsApp-Style QR Login ─────────────────────────────────────────────────

func (s *authExtService) InitiateQRLogin(ctx context.Context, requesterIP, requesterAgent string) (*QRInitiateResponse, error) {
	sessionID := uuid.NewString()
	nonceBytes := make([]byte, 16)
	if _, err := rand.Read(nonceBytes); err != nil {
		return nil, err
	}
	nonce := hex.EncodeToString(nonceBytes)

	qrPayload := fmt.Sprintf("humora:auth:qr:%s:%s", sessionID, nonce)
	expiresIn := int64(120) // 2 minutes

	qrSessions.Store(sessionID, &QRSession{
		SessionID:      sessionID,
		Nonce:          nonce,
		Status:         "pending",
		ExpiresAt:      time.Now().UTC().Add(time.Duration(expiresIn) * time.Second),
		RequesterIP:    requesterIP,
		RequesterAgent: requesterAgent,
	})

	return &QRInitiateResponse{
		SessionID: sessionID,
		QRPayload: qrPayload,
		ExpiresIn: expiresIn,
	}, nil
}

func (s *authExtService) GetQRStatus(ctx context.Context, sessionID string) (*QRStatusResponse, error) {
	val, ok := qrSessions.Load(sessionID)
	if !ok {
		return &QRStatusResponse{Status: "expired"}, nil
	}
	sess := val.(*QRSession)

	if sess.ExpiresAt.Before(time.Now().UTC()) {
		qrSessions.Delete(sessionID)
		return &QRStatusResponse{Status: "expired"}, nil
	}

	if sess.Status == "authenticated" {
		// One-time consumption: delete once authenticated
		qrSessions.Delete(sessionID)
		return &QRStatusResponse{
			Status: "authenticated",
			Auth:   sess.Auth,
		}, nil
	}

	return &QRStatusResponse{Status: "pending"}, nil
}

// pendingQRSession returns a live QR session, checking the nonce from the QR
// code itself: knowing only the session id (e.g. from the status poll) is not enough.
func pendingQRSession(sessionID, nonce string) (*QRSession, error) {
	val, ok := qrSessions.Load(sessionID)
	if !ok {
		return nil, errors.New("QR login session not found or expired")
	}
	sess := val.(*QRSession)
	if subtle.ConstantTimeCompare([]byte(sess.Nonce), []byte(nonce)) != 1 || sess.Status != "pending" {
		return nil, errors.New("QR login session not found or expired")
	}
	return sess, nil
}

// GetQRInfo tells the phone which browser is asking to be signed in, before the user approves it.
func (s *authExtService) GetQRInfo(sessionID, nonce string) (*QRInfoResponse, error) {
	sess, err := pendingQRSession(sessionID, nonce)
	if err != nil {
		return nil, err
	}
	if sess.ExpiresAt.Before(time.Now().UTC()) {
		return nil, errors.New("QR code has expired. Please refresh the QR code on your browser.")
	}
	return &QRInfoResponse{
		RequesterIP:    sess.RequesterIP,
		RequesterAgent: sess.RequesterAgent,
		ExpiresIn:      int64(time.Until(sess.ExpiresAt).Seconds()),
	}, nil
}

func (s *authExtService) ConfirmQRLogin(ctx context.Context, sessionID, nonce string, userID uuid.UUID) error {
	sess, err := pendingQRSession(sessionID, nonce)
	if err != nil {
		return err
	}

	if sess.ExpiresAt.Before(time.Now().UTC()) {
		qrSessions.Delete(sessionID)
		return errors.New("QR code has expired. Please refresh the QR code on your browser.")
	}

	user, err := s.repo.GetUserByID(ctx, userID)
	if err != nil || user == nil {
		return errors.New("authenticated user not found")
	}

	tenant, err := s.repo.GetTenantByID(ctx, user.TenantID)
	if err != nil || tenant == nil {
		return errors.New("organization tenant not found")
	}

	roles, perms, _ := s.repo.GetRolesForUser(ctx, tenant.ID, user.ID)
	accessToken, refreshToken, err := generateTokens(user, tenant, roles, perms)
	if err != nil {
		return fmt.Errorf("failed to issue tokens: %w", err)
	}

	sess.Status = "authenticated"
	sess.Auth = &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		TokenType:    "Bearer",
		ExpiresIn:    int64(configs.AppConfig.Server.JWTAccessTokenExpiry.Seconds()),
		User: UserSummary{
			ID:             user.ID.String(),
			TenantID:       tenant.ID.String(),
			TenantName:     tenant.Name,
			TenantSlug:     tenant.Slug,
			Email:          user.Email,
			Status:         user.Status,
			PresenceStatus: user.PresenceStatus,
			Roles:          roles,
			Permissions:    perms,
		},
	}
	qrSessions.Store(sessionID, sess)

	return nil
}
