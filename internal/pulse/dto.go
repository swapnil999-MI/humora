package pulse

import "github.com/google/uuid"

// Binary fields ([]byte) are base64 strings in JSON.

// RegisterDeviceRequest enrolls a new client and publishes its first key packages.
// The id is chosen by the client because it is bound into the device's
// encryption credential before the device can be registered.
type RegisterDeviceRequest struct {
	ID          uuid.UUID `json:"id"`
	Platform    string    `json:"platform"` // 'web', 'android', 'ios'
	Name        string    `json:"name"`
	IdentityKey []byte    `json:"identity_key"`
	KeyPackages [][]byte  `json:"key_packages"`
}

type DeviceLookupRequest struct {
	UserIDs []uuid.UUID `json:"user_ids"`
}

type AddKeyPackagesRequest struct {
	KeyPackages [][]byte `json:"key_packages"`
}

type KeyPackageCountResponse struct {
	Remaining int `json:"remaining"`
}

type TicketRequest struct {
	DeviceID string `json:"device_id"`
}

type TicketResponse struct {
	Ticket    string `json:"ticket"`
	ExpiresIn int    `json:"expires_in"` // seconds
}

// CreateConversationRequest: for a DM, member_ids holds exactly the other user.
type CreateConversationRequest struct {
	Kind      string      `json:"kind"` // 'dm', 'group', 'channel'
	Name      string      `json:"name"`
	Topic     string      `json:"topic"`
	IsPrivate *bool       `json:"is_private,omitempty"` // channels only; defaults to true
	MemberIDs []uuid.UUID `json:"member_ids"`
}

type AddMembersRequest struct {
	UserIDs []uuid.UUID `json:"user_ids"`
}

// MediaUploadRequest asks for a slot to upload one already-encrypted file.
type MediaUploadRequest struct {
	ConversationID uuid.UUID `json:"conversation_id"`
	SizeBytes      int64     `json:"size_bytes"`
}

type MediaUploadResponse struct {
	ObjectKey string            `json:"object_key"`
	URL       string            `json:"url"`
	Fields    map[string]string `json:"fields"`
}

type MediaDownloadRequest struct {
	ConversationID uuid.UUID `json:"conversation_id"`
	ObjectKey      string    `json:"object_key"`
}

type MediaDownloadResponse struct {
	URL string `json:"url"`
}

// PutGroupInfoRequest publishes the group's public state for one epoch.
type PutGroupInfoRequest = GroupInfo

type PutKeyBackupsRequest struct {
	Items []KeyBackup `json:"items"`
}
