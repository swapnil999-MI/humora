package pulse

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/json"
	"sync"
	"time"

	"humora-backend/configs"

	"github.com/google/uuid"
)

const ticketTTL = 30 * time.Second

// session identifies an authenticated gateway connection.
type session struct {
	TenantID uuid.UUID `json:"t"`
	UserID   uuid.UUID `json:"u"`
	DeviceID uuid.UUID `json:"d"`
}

// ticketStore issues short-lived, single-use tickets that stand in for the
// JWT on the WebSocket upgrade, where browsers cannot send an Authorization
// header. Redis backs it when available so any node can redeem; otherwise it
// falls back to process memory.
type ticketStore struct {
	mu    sync.Mutex
	local map[string]localTicket
}

type localTicket struct {
	sess    session
	expires time.Time
}

func newTicketStore() *ticketStore {
	return &ticketStore{local: make(map[string]localTicket)}
}

func ticketKey(ticket string) string { return "pulse:ticket:" + ticket }

func (s *ticketStore) issue(ctx context.Context, sess session) (string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", err
	}
	ticket := base64.RawURLEncoding.EncodeToString(raw)

	if rdb := configs.RedisClient; rdb != nil {
		payload, err := json.Marshal(sess)
		if err != nil {
			return "", err
		}
		if err := rdb.Set(ctx, ticketKey(ticket), payload, ticketTTL).Err(); err != nil {
			return "", err
		}
		return ticket, nil
	}

	now := time.Now()
	s.mu.Lock()
	for k, t := range s.local {
		if now.After(t.expires) {
			delete(s.local, k)
		}
	}
	s.local[ticket] = localTicket{sess: sess, expires: now.Add(ticketTTL)}
	s.mu.Unlock()
	return ticket, nil
}

// redeem consumes the ticket; a second redeem of the same ticket fails.
func (s *ticketStore) redeem(ctx context.Context, ticket string) (session, bool) {
	var sess session
	if ticket == "" {
		return sess, false
	}

	if rdb := configs.RedisClient; rdb != nil {
		payload, err := rdb.GetDel(ctx, ticketKey(ticket)).Bytes()
		if err != nil {
			return sess, false
		}
		if err := json.Unmarshal(payload, &sess); err != nil {
			return sess, false
		}
		return sess, true
	}

	s.mu.Lock()
	t, ok := s.local[ticket]
	delete(s.local, ticket)
	s.mu.Unlock()
	if !ok || time.Now().After(t.expires) {
		return sess, false
	}
	return t.sess, true
}
