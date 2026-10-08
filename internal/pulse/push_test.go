package pulse

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/google/uuid"
)

type recordedPush struct {
	token string
	data  map[string]string
}

type fakeSender struct {
	mu     sync.Mutex
	pushes []recordedPush
	err    error
}

func (f *fakeSender) Send(_ context.Context, token string, data map[string]string, _ string) error {
	f.mu.Lock()
	defer f.mu.Unlock()
	f.pushes = append(f.pushes, recordedPush{token, data})
	return f.err
}

func (f *fakeSender) waitFor(t *testing.T, n int) []recordedPush {
	t.Helper()
	deadline := time.Now().Add(3 * time.Second)
	for time.Now().Before(deadline) {
		f.mu.Lock()
		if len(f.pushes) >= n {
			out := append([]recordedPush(nil), f.pushes...)
			f.mu.Unlock()
			return out
		}
		f.mu.Unlock()
		time.Sleep(10 * time.Millisecond)
	}
	f.mu.Lock()
	defer f.mu.Unlock()
	t.Fatalf("expected %d pushes, got %d", n, len(f.pushes))
	return nil
}

func TestFCMSenderMapsErrors(t *testing.T) {
	var got map[string]any
	status := http.StatusOK
	body := ""
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_ = json.NewDecoder(r.Body).Decode(&got)
		w.WriteHeader(status)
		_, _ = w.Write([]byte(body))
	}))
	defer srv.Close()
	s := &FCMSender{client: srv.Client(), endpoint: srv.URL}

	if err := s.Send(context.Background(), "tok", map[string]string{"type": "pulse"}, "c1"); err != nil {
		t.Fatalf("ok send: %v", err)
	}
	msg := got["message"].(map[string]any)
	if msg["token"] != "tok" || msg["android"].(map[string]any)["priority"] != "high" {
		t.Fatalf("unexpected request: %v", got)
	}
	if _, hasNotification := msg["notification"]; hasNotification {
		t.Fatal("push must be data-only: the phone builds the notification after decrypting")
	}

	status, body = http.StatusNotFound, `{"error":{"status":"NOT_FOUND"}}`
	if err := s.Send(context.Background(), "tok", nil, ""); !errors.Is(err, ErrPushTokenGone) {
		t.Fatalf("404 should mean the token is gone, got %v", err)
	}
	status, body = http.StatusInternalServerError, "boom"
	if err := s.Send(context.Background(), "tok", nil, ""); err == nil || errors.Is(err, ErrPushTokenGone) {
		t.Fatalf("500 should be a transient error, got %v", err)
	}
}

func TestPushCoalescesPerDeviceAndConversation(t *testing.T) {
	p := &Pusher{recent: make(map[[2]uuid.UUID]time.Time)}
	dev, convA, convB := uuid.New(), uuid.New(), uuid.New()
	if !p.claimSlot(dev, convA) || p.claimSlot(dev, convA) {
		t.Fatal("a second push for the same chat within the window must be suppressed")
	}
	if !p.claimSlot(dev, convB) {
		t.Fatal("another chat is not suppressed")
	}
}

// An offline device with a push token is woken, content-free; the sending device and connected devices are not.
func TestOfflineDeviceIsPushed(t *testing.T) {
	e := newTestEnv(t)
	sender := &fakeSender{}
	e.hub.SetPusher(NewPusher(e.svc.repo, e.hub, sender))

	tenant := e.tenant()
	alice, bob := e.user(tenant), e.user(tenant)
	aliceDev, bobPhone, bobLaptop := e.device(alice), e.device(bob), e.device(bob)
	ctx := context.Background()
	for _, d := range []struct {
		u   testUser
		dev uuid.UUID
		tok string
	}{{alice, aliceDev, "alice-token"}, {bob, bobPhone, "bob-phone-token"}, {bob, bobLaptop, "bob-laptop-token"}} {
		if err := e.svc.SetPushToken(ctx, d.u.tenantID, d.u.id, d.dev, d.tok); err != nil {
			t.Fatalf("set push token: %v", err)
		}
	}
	conv := e.conversation(alice, "dm", "", bob)

	a := e.connectDevice(alice, aliceDev)
	e.connectDevice(bob, bobLaptop) // online: gets the frame, no push
	a.quiet()
	a.send(1, conv, uuid.New(), "ciphertext")

	pushes := sender.waitFor(t, 1)
	time.Sleep(100 * time.Millisecond)
	sender.mu.Lock()
	n := len(sender.pushes)
	sender.mu.Unlock()
	if n != 1 || pushes[0].token != "bob-phone-token" {
		t.Fatalf("want exactly one push to Bob's offline phone, got %+v", sender.pushes)
	}
	if pushes[0].data["conversation_id"] != conv.String() || pushes[0].data["type"] != "pulse" || len(pushes[0].data) != 2 {
		t.Fatalf("push must only name the conversation, got %v", pushes[0].data)
	}

	// A token the push service rejects is forgotten.
	sender.err = ErrPushTokenGone
	other := e.conversation(alice, "group", "g", bob)
	a.send(2, other, uuid.New(), "ciphertext")
	sender.waitFor(t, 2)
	deadline := time.Now().Add(2 * time.Second)
	for {
		var token *string
		_ = e.db.Get(&token, `SELECT push_token FROM pulse_devices WHERE id = $1`, bobPhone)
		if token == nil {
			break
		}
		if time.Now().After(deadline) {
			t.Fatal("rejected token was not cleared")
		}
		time.Sleep(20 * time.Millisecond)
	}
}
