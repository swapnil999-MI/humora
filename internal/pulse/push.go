package pulse

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"sync"
	"time"

	"humora-backend/pkg/logger"

	"github.com/google/uuid"
	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

// Push wakes devices that are not connected to the gateway, so they can sync and show a
// notification. The push carries no content at all, only "conversation X has news": the
// device fetches the ciphertext itself and decrypts it locally, so Google sees nothing.

// ErrPushTokenGone means the push service no longer knows the token (app uninstalled, token rotated).
var ErrPushTokenGone = errors.New("push token is no longer valid")

// PushSender delivers one data-only push to one device token.
type PushSender interface {
	Send(ctx context.Context, token string, data map[string]string, collapseKey string) error
}

const (
	pushQueueSize = 1024
	pushTimeout   = 10 * time.Second
	// At most one push per device and conversation in this window: a busy chat wakes a phone once,
	// and the phone then syncs everything in one go.
	pushCoalesceWindow = 15 * time.Second
)

type pushJob struct {
	conversationID uuid.UUID
	userIDs        []uuid.UUID
	skipDevice     uuid.UUID
	onlyDevice     uuid.UUID // non-zero: push just this device (device-to-device payloads)
	kind           string    // "" = Pulse chat, "notification" = in-app notifications
}

// Pusher sends pushes in the background; the message path never waits for it.
type Pusher struct {
	repo   *Repository
	hub    *Hub
	sender PushSender
	jobs   chan pushJob

	mu     sync.Mutex
	recent map[[2]uuid.UUID]time.Time
}

// NewPusher starts the push worker. A nil sender disables push (nothing is queued).
func NewPusher(repo *Repository, hub *Hub, sender PushSender) *Pusher {
	p := &Pusher{repo: repo, hub: hub, sender: sender, jobs: make(chan pushJob, pushQueueSize), recent: make(map[[2]uuid.UUID]time.Time)}
	if sender != nil {
		go p.run()
	}
	return p
}

// MessageStored wakes the members' offline devices after a message was stored (all but the sending device).
func (p *Pusher) MessageStored(conversationID uuid.UUID, memberIDs []uuid.UUID, senderDevice uuid.UUID) {
	p.enqueue(pushJob{conversationID: conversationID, userIDs: memberIDs, skipDevice: senderDevice})
}

// UsersNotified wakes the users' phones because new in-app notifications are waiting. The push names
// no content; the app fetches the notifications over the authenticated API.
func (p *Pusher) UsersNotified(userIDs []uuid.UUID) {
	p.enqueue(pushJob{userIDs: userIDs, kind: "notification"})
}

// DirectQueued wakes one device that has a device-to-device payload (e.g. a group welcome) waiting.
func (p *Pusher) DirectQueued(userID, deviceID uuid.UUID, conversationID uuid.UUID) {
	p.enqueue(pushJob{conversationID: conversationID, userIDs: []uuid.UUID{userID}, onlyDevice: deviceID})
}

func (p *Pusher) enqueue(j pushJob) {
	if p == nil || p.sender == nil {
		return
	}
	select {
	case p.jobs <- j:
	default:
		// Full queue: drop it. The device still gets everything on its next sync.
	}
}

func (p *Pusher) run() {
	for j := range p.jobs {
		ctx, cancel := context.WithTimeout(context.Background(), pushTimeout)
		p.process(ctx, j)
		cancel()
	}
}

func (p *Pusher) process(ctx context.Context, j pushJob) {
	targets, err := p.repo.PushTargets(ctx, j.userIDs)
	if err != nil {
		logger.Warn(fmt.Sprintf("pulse push: cannot load targets: %v", err))
		return
	}
	for _, t := range targets {
		if t.DeviceID == j.skipDevice || (j.onlyDevice != uuid.Nil && t.DeviceID != j.onlyDevice) {
			continue
		}
		data := map[string]string{"type": "pulse"}
		collapse := j.conversationID.String()
		if j.kind == "notification" {
			// Not tied to the chat connection: wake every phone (the app de-duplicates what it shows).
			data, collapse = map[string]string{"type": "notification"}, "notifications"
			if !p.claimSlot(t.DeviceID, notificationSlot) {
				continue
			}
		} else {
			if p.hub.deviceConnected(t.UserID, t.DeviceID) || !p.claimSlot(t.DeviceID, j.conversationID) {
				continue
			}
			if j.conversationID != uuid.Nil {
				data["conversation_id"] = j.conversationID.String()
			}
		}
		err := p.sender.Send(ctx, t.Token, data, collapse)
		switch {
		case errors.Is(err, ErrPushTokenGone):
			_ = p.repo.ClearPushToken(ctx, t.DeviceID, t.Token)
		case err != nil:
			logger.Warn(fmt.Sprintf("pulse push to device %s failed: %v", t.DeviceID, err))
		}
	}
}

// notificationSlot coalesces notification pushes per device like a conversation would.
var notificationSlot = uuid.MustParse("00000000-0000-0000-0000-00000000000e")

// claimSlot reports whether this device may be pushed for this conversation now.
func (p *Pusher) claimSlot(deviceID, conversationID uuid.UUID) bool {
	key := [2]uuid.UUID{deviceID, conversationID}
	now := time.Now()
	p.mu.Lock()
	defer p.mu.Unlock()
	if last, ok := p.recent[key]; ok && now.Sub(last) < pushCoalesceWindow {
		return false
	}
	p.recent[key] = now
	if len(p.recent) > 50_000 { // forget old entries so the map stays small
		for k, t := range p.recent {
			if now.Sub(t) > pushCoalesceWindow {
				delete(p.recent, k)
			}
		}
	}
	return true
}

// ─────────────────────────── Firebase Cloud Messaging ───────────────────────────

// FCMSender sends data-only messages through the FCM HTTP v1 API using a service account.
type FCMSender struct {
	projectID string
	client    *http.Client
	endpoint  string // overridable in tests
}

// NewFCMSenderFromEnv builds a sender from FCM_SERVICE_ACCOUNT_FILE or FCM_SERVICE_ACCOUNT_JSON.
// It returns (nil, nil) when neither is set: push is optional.
func NewFCMSenderFromEnv(ctx context.Context) (*FCMSender, error) {
	raw := []byte(os.Getenv("FCM_SERVICE_ACCOUNT_JSON"))
	if path := os.Getenv("FCM_SERVICE_ACCOUNT_FILE"); len(raw) == 0 && path != "" {
		b, err := os.ReadFile(path)
		if err != nil {
			return nil, fmt.Errorf("read FCM service account: %w", err)
		}
		raw = b
	}
	if len(raw) == 0 {
		return nil, nil
	}
	var meta struct {
		ProjectID string `json:"project_id"`
	}
	if err := json.Unmarshal(raw, &meta); err != nil || meta.ProjectID == "" {
		return nil, fmt.Errorf("FCM service account JSON is invalid or has no project_id")
	}
	creds, err := google.CredentialsFromJSON(ctx, raw, "https://www.googleapis.com/auth/firebase.messaging")
	if err != nil {
		return nil, fmt.Errorf("load FCM credentials: %w", err)
	}
	client := oauth2.NewClient(ctx, creds.TokenSource)
	client.Timeout = pushTimeout
	return &FCMSender{
		projectID: meta.ProjectID,
		client:    client,
		endpoint:  "https://fcm.googleapis.com/v1/projects/" + meta.ProjectID + "/messages:send",
	}, nil
}

func (s *FCMSender) Send(ctx context.Context, token string, data map[string]string, collapseKey string) error {
	body, _ := json.Marshal(map[string]any{
		"message": map[string]any{
			"token": token,
			"data":  data,
			"android": map[string]any{
				// High priority so a sleeping phone wakes now; the payload is tiny and content-free.
				"priority":     "high",
				"collapse_key": collapseKey,
				"ttl":          "3600s",
			},
		},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.endpoint, bytes.NewReader(body))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := s.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		return nil
	}
	msg, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
	// 404 UNREGISTERED: the app was uninstalled or the token rotated. 400 INVALID_ARGUMENT on the
	// token field: it was never valid. Both mean the token should be forgotten.
	if resp.StatusCode == http.StatusNotFound ||
		(resp.StatusCode == http.StatusBadRequest && bytes.Contains(msg, []byte("registration token"))) {
		return ErrPushTokenGone
	}
	return fmt.Errorf("fcm: HTTP %d: %s", resp.StatusCode, msg)
}
