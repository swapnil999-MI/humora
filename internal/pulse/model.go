package pulse

import (
	"errors"
	"time"

	"github.com/google/uuid"
)

var (
	ErrNotFound  = errors.New("not found")
	ErrForbidden = errors.New("forbidden")
	// ErrConflict: a handshake did not advance the epoch by exactly one.
	ErrConflict = errors.New("epoch conflict")
)

const (
	KindDM      = "dm"
	KindGroup   = "group"
	KindChannel = "channel"

	RoleOwner  = "owner"
	RoleAdmin  = "admin"
	RoleMember = "member"
)

// Device is one installed client holding its own end-to-end encryption keys.
type Device struct {
	ID          uuid.UUID  `db:"id" json:"id"`
	TenantID    uuid.UUID  `db:"tenant_id" json:"-"`
	UserID      uuid.UUID  `db:"user_id" json:"user_id"`
	Platform    string     `db:"platform" json:"platform"`
	Name        string     `db:"name" json:"name"`
	IdentityKey []byte     `db:"identity_key" json:"identity_key"`
	CreatedAt   time.Time  `db:"created_at" json:"created_at"`
	LastSeenAt  *time.Time `db:"last_seen_at" json:"last_seen_at,omitempty"`
}

// ClaimedKeyPackage is a one-time key package handed to a sender.
type ClaimedKeyPackage struct {
	DeviceID    uuid.UUID `json:"device_id"`
	IdentityKey []byte    `json:"identity_key"`
	KeyPackage  []byte    `json:"key_package"`
}

// Conversation is a DM, group, or channel. The server knows its membership
// and message count, never its content.
type Conversation struct {
	ID        uuid.UUID `db:"id" json:"id"`
	TenantID  uuid.UUID `db:"tenant_id" json:"-"`
	Kind      string    `db:"kind" json:"kind"`
	Name      string    `db:"name" json:"name"`
	Topic     string    `db:"topic" json:"topic"`
	IsPrivate bool      `db:"is_private" json:"is_private"`
	CreatedBy uuid.UUID `db:"created_by" json:"created_by"`
	LastSeq   int64     `db:"last_seq" json:"last_seq"`
	Epoch     int64     `db:"epoch" json:"epoch"`
	// GroupInfoEpoch is the epoch of the stored GroupInfo; below Epoch means none is available yet.
	GroupInfoEpoch int64      `db:"group_info_epoch" json:"group_info_epoch"`
	LastMessageAt  *time.Time `db:"last_message_at" json:"last_message_at,omitempty"`
	CreatedAt      time.Time  `db:"created_at" json:"created_at"`
	Members        []Member   `json:"members"`
}

// Member carries the receipt watermarks that drive the tick marks:
// a message is delivered / read once every other member's watermark reaches its seq.
type Member struct {
	ConversationID uuid.UUID `db:"conversation_id" json:"-"`
	UserID         uuid.UUID `db:"user_id" json:"user_id"`
	Role           string    `db:"role" json:"role"`
	JoinedSeq      int64     `db:"joined_seq" json:"joined_seq"`
	DeliveredSeq   int64     `db:"delivered_seq" json:"delivered_seq"`
	ReadSeq        int64     `db:"read_seq" json:"read_seq"`
}

// StoredMessage is one row of the encrypted message log.
type StoredMessage struct {
	Seq            int64     `db:"seq"`
	ID             uuid.UUID `db:"id"`
	SenderID       uuid.UUID `db:"sender_id"`
	SenderDeviceID uuid.UUID `db:"sender_device_id"`
	Kind           int16     `db:"kind"`
	Epoch          int64     `db:"epoch"`
	Ciphertext     []byte    `db:"ciphertext"`
	CreatedAt      time.Time `db:"created_at"`
}

// DirectMessage is a queued device-addressed payload.
type DirectMessage struct {
	ID             int64      `db:"id"`
	FromUserID     uuid.UUID  `db:"from_user_id"`
	FromDeviceID   uuid.UUID  `db:"from_device_id"`
	ConversationID *uuid.UUID `db:"conversation_id"`
	Payload        []byte     `db:"payload"`
	CreatedAt      time.Time  `db:"created_at"`
}

// GroupInfo is a conversation's latest signed MLS GroupInfo: public group
// state only, from which a member's device can join without anyone online.
type GroupInfo struct {
	Epoch     int64  `json:"epoch"`
	GroupInfo []byte `json:"group_info"`
}

// KeyBackup is a message key encrypted under the user's recovery key.
type KeyBackup struct {
	ConversationID uuid.UUID `db:"conversation_id" json:"conversation_id"`
	Epoch          int64     `db:"epoch" json:"epoch"`
	EncryptedKey   []byte    `db:"encrypted_key" json:"encrypted_key"`
}
