package pulse

import (
	"context"
	"errors"
	"fmt"
	"os"
	"strings"
	"sync/atomic"
	"time"

	"humora-backend/pkg/media"

	"github.com/google/uuid"
)

const (
	maxDevicesPerUser     = 10
	maxKeyPackagesPerCall = 100
	maxKeyPackagesStored  = 500
	maxKeyPackageBytes    = 16 << 10
	maxIdentityKeyBytes   = 4 << 10
	maxMembersPerCall     = 1000
	maxKeyBackupsPerCall  = 500
	maxKeyBackupBytes     = 4 << 10
	// MaxMediaBytes caps one encrypted attachment.
	MaxMediaBytes  = 100 << 20
	mediaUploadTTL = 10 * time.Minute
	// Long enough to start a download; the link is useless without the key in the message.
	mediaDownloadTTL = 5 * time.Minute
)

// InvalidError is a client mistake that is safe to show as-is.
type InvalidError struct{ msg string }

func (e *InvalidError) Error() string { return e.msg }

func invalid(msg string) error { return &InvalidError{msg: msg} }

type Service struct {
	repo    *Repository
	hub     *Hub
	tickets *ticketStore

	// Attachments live in their own bucket, which unlike the shared media
	// bucket is never opened for anonymous reads.
	mediaBucket      string
	mediaBucketReady atomic.Bool
}

func NewService(repo *Repository, hub *Hub) *Service {
	bucket := os.Getenv("PULSE_MEDIA_BUCKET")
	if bucket == "" {
		bucket = "pulse-media"
	}
	return &Service{repo: repo, hub: hub, tickets: newTicketStore(), mediaBucket: bucket}
}

func validateKeyPackages(kps [][]byte) error {
	if len(kps) > maxKeyPackagesPerCall {
		return invalid("Too many key packages in one request")
	}
	for _, kp := range kps {
		if len(kp) == 0 || len(kp) > maxKeyPackageBytes {
			return invalid("Invalid key package size")
		}
	}
	return nil
}

// ───────────────────────────── Devices ─────────────────────────────

func (s *Service) RegisterDevice(ctx context.Context, tenantID, userID uuid.UUID, req *RegisterDeviceRequest) (*Device, error) {
	if req.Platform != "web" && req.Platform != "android" && req.Platform != "ios" {
		return nil, invalid("platform must be web, android, or ios")
	}
	if req.ID == uuid.Nil {
		return nil, invalid("id is required")
	}
	req.Name = strings.TrimSpace(req.Name)
	if len(req.Name) > 120 {
		return nil, invalid("Device name is too long")
	}
	if len(req.IdentityKey) == 0 || len(req.IdentityKey) > maxIdentityKeyBytes {
		return nil, invalid("identity_key is required")
	}
	if err := validateKeyPackages(req.KeyPackages); err != nil {
		return nil, err
	}

	n, err := s.repo.CountActiveDevices(ctx, userID)
	if err != nil {
		return nil, err
	}
	if n >= maxDevicesPerUser {
		return nil, invalid("Device limit reached. Remove an old device first.")
	}

	d := &Device{ID: req.ID, TenantID: tenantID, UserID: userID, Platform: req.Platform, Name: req.Name, IdentityKey: req.IdentityKey}
	if err := s.repo.CreateDevice(ctx, d, req.KeyPackages); err != nil {
		if errors.Is(err, ErrConflict) {
			return nil, invalid("Device id is already registered")
		}
		return nil, err
	}
	// Members of this user's conversations must add the new device to each
	// group before it can read anything; nudge the ones that are online.
	if convs, err := s.repo.ListConversations(ctx, tenantID, userID); err == nil {
		for i := range convs {
			s.hub.notifyChanged(convs[i].ID, memberIDs(&convs[i]))
		}
	}
	return d, nil
}

func (s *Service) ListDevices(ctx context.Context, tenantID, userID uuid.UUID) ([]Device, error) {
	return s.repo.ListDevices(ctx, tenantID, userID)
}

// LookupDevices is the public device directory: which devices a
// conversation's keys must be shared with.
func (s *Service) LookupDevices(ctx context.Context, tenantID uuid.UUID, userIDs []uuid.UUID) ([]Device, error) {
	if len(userIDs) == 0 || len(userIDs) > maxMembersPerCall {
		return nil, invalid("user_ids must contain between 1 and 1000 users")
	}
	return s.repo.LookupDevices(ctx, tenantID, userIDs)
}

func (s *Service) RevokeDevice(ctx context.Context, tenantID, userID, deviceID uuid.UUID) error {
	if err := s.repo.RevokeDevice(ctx, tenantID, userID, deviceID); err != nil {
		return err
	}
	s.hub.disconnectDevice(userID, deviceID)
	return nil
}

// SetPushToken registers the push token of one of the user's own devices ("" unregisters it).
func (s *Service) SetPushToken(ctx context.Context, tenantID, userID, deviceID uuid.UUID, token string) error {
	if len(token) > 4096 {
		return invalid("push token is too long")
	}
	return s.repo.SetPushToken(ctx, tenantID, userID, deviceID, token)
}

func (s *Service) AddKeyPackages(ctx context.Context, tenantID, userID, deviceID uuid.UUID, kps [][]byte) (int, error) {
	if len(kps) == 0 {
		return 0, invalid("key_packages is required")
	}
	if err := validateKeyPackages(kps); err != nil {
		return 0, err
	}
	if _, err := s.repo.GetActiveDevice(ctx, tenantID, userID, deviceID); err != nil {
		return 0, err
	}
	stored, err := s.repo.CountKeyPackages(ctx, deviceID)
	if err != nil {
		return 0, err
	}
	if stored+len(kps) > maxKeyPackagesStored {
		return 0, invalid("Too many unused key packages stored for this device")
	}
	if err := s.repo.AddKeyPackages(ctx, deviceID, kps); err != nil {
		return 0, err
	}
	return stored + len(kps), nil
}

func (s *Service) CountKeyPackages(ctx context.Context, tenantID, userID, deviceID uuid.UUID) (int, error) {
	if _, err := s.repo.GetActiveDevice(ctx, tenantID, userID, deviceID); err != nil {
		return 0, err
	}
	return s.repo.CountKeyPackages(ctx, deviceID)
}

func (s *Service) ClaimKeyPackages(ctx context.Context, tenantID, targetUserID uuid.UUID) ([]ClaimedKeyPackage, error) {
	return s.repo.ClaimKeyPackages(ctx, tenantID, targetUserID)
}

// ───────────────────────────── Gateway tickets ─────────────────────────────

func (s *Service) IssueTicket(ctx context.Context, tenantID, userID, deviceID uuid.UUID) (string, error) {
	if _, err := s.repo.GetActiveDevice(ctx, tenantID, userID, deviceID); err != nil {
		return "", err
	}
	return s.tickets.issue(ctx, session{TenantID: tenantID, UserID: userID, DeviceID: deviceID})
}

func (s *Service) RedeemTicket(ctx context.Context, ticket string) (session, bool) {
	return s.tickets.redeem(ctx, ticket)
}

// ───────────────────────────── Conversations ─────────────────────────────

// uniqueWith returns ids de-duplicated, with self guaranteed present.
func uniqueWith(self uuid.UUID, ids []uuid.UUID) []uuid.UUID {
	seen := map[uuid.UUID]struct{}{self: {}}
	out := []uuid.UUID{self}
	for _, id := range ids {
		if _, dup := seen[id]; dup || id == uuid.Nil {
			continue
		}
		seen[id] = struct{}{}
		out = append(out, id)
	}
	return out
}

func (s *Service) requireTenantUsers(ctx context.Context, tenantID uuid.UUID, ids []uuid.UUID) error {
	n, err := s.repo.CountUsersInTenant(ctx, tenantID, ids)
	if err != nil {
		return err
	}
	if n != len(ids) {
		return invalid("One or more members do not exist")
	}
	return nil
}

func (s *Service) CreateConversation(ctx context.Context, tenantID, userID uuid.UUID, req *CreateConversationRequest) (*Conversation, bool, error) {
	if len(req.MemberIDs) > maxMembersPerCall {
		return nil, false, invalid("Too many members in one request")
	}
	members := uniqueWith(userID, req.MemberIDs)
	req.Name = strings.TrimSpace(req.Name)
	req.Topic = strings.TrimSpace(req.Topic)
	if len(req.Name) > 120 || len(req.Topic) > 500 {
		return nil, false, invalid("Name or topic is too long")
	}

	c := &Conversation{TenantID: tenantID, Kind: req.Kind, Name: req.Name, Topic: req.Topic, IsPrivate: true, CreatedBy: userID}
	var dmKey *string

	switch req.Kind {
	case KindDM:
		if len(members) != 2 {
			return nil, false, invalid("A direct message needs exactly one other member")
		}
		a, b := members[0].String(), members[1].String()
		if a > b {
			a, b = b, a
		}
		key := a + ":" + b
		dmKey = &key
		c.Name, c.Topic = "", ""
	case KindGroup:
		if c.Name == "" {
			return nil, false, invalid("Group name is required")
		}
		if len(members) < 2 {
			return nil, false, invalid("A group needs at least one other member")
		}
	case KindChannel:
		if c.Name == "" {
			return nil, false, invalid("Channel name is required")
		}
		if req.IsPrivate != nil {
			c.IsPrivate = *req.IsPrivate
		}
	default:
		return nil, false, invalid("kind must be dm, group, or channel")
	}

	if err := s.requireTenantUsers(ctx, tenantID, members); err != nil {
		return nil, false, err
	}
	created, err := s.repo.CreateConversation(ctx, c, dmKey, members)
	if err != nil {
		return nil, false, err
	}
	full, err := s.repo.GetConversation(ctx, tenantID, c.ID)
	if err != nil {
		return nil, false, err
	}
	if created {
		s.hub.notifyChanged(c.ID, members)
	}
	return full, created, nil
}

func (s *Service) ListConversations(ctx context.Context, tenantID, userID uuid.UUID) ([]Conversation, error) {
	return s.repo.ListConversations(ctx, tenantID, userID)
}

func memberOf(c *Conversation, userID uuid.UUID) *Member {
	for i := range c.Members {
		if c.Members[i].UserID == userID {
			return &c.Members[i]
		}
	}
	return nil
}

func memberIDs(c *Conversation) []uuid.UUID {
	ids := make([]uuid.UUID, len(c.Members))
	for i := range c.Members {
		ids[i] = c.Members[i].UserID
	}
	return ids
}

// conversationFor loads a conversation and the caller's membership in it.
// Non-members get ErrNotFound so existence is not revealed.
func (s *Service) conversationFor(ctx context.Context, tenantID, userID, conversationID uuid.UUID) (*Conversation, *Member, error) {
	c, err := s.repo.GetConversation(ctx, tenantID, conversationID)
	if err != nil {
		return nil, nil, err
	}
	me := memberOf(c, userID)
	if me == nil {
		return nil, nil, ErrNotFound
	}
	return c, me, nil
}

func (s *Service) GetConversation(ctx context.Context, tenantID, userID, conversationID uuid.UUID) (*Conversation, error) {
	c, _, err := s.conversationFor(ctx, tenantID, userID, conversationID)
	return c, err
}

func canManage(m *Member) bool { return m.Role == RoleOwner || m.Role == RoleAdmin }

func (s *Service) AddMembers(ctx context.Context, tenantID, userID, conversationID uuid.UUID, userIDs []uuid.UUID) (*Conversation, error) {
	if len(userIDs) == 0 || len(userIDs) > maxMembersPerCall {
		return nil, invalid("user_ids must contain between 1 and 1000 users")
	}
	c, me, err := s.conversationFor(ctx, tenantID, userID, conversationID)
	if err != nil {
		return nil, err
	}
	if c.Kind == KindDM {
		return nil, invalid("Members cannot be added to a direct message")
	}
	if !canManage(me) {
		return nil, ErrForbidden
	}
	// Drop self and duplicates; self is already a member.
	adding := uniqueWith(userID, userIDs)[1:]
	if len(adding) == 0 {
		return c, nil
	}
	if err := s.requireTenantUsers(ctx, tenantID, adding); err != nil {
		return nil, err
	}
	if err := s.repo.AddMembers(ctx, conversationID, adding); err != nil {
		return nil, err
	}
	s.hub.invalidate(conversationID)

	updated, err := s.repo.GetConversation(ctx, tenantID, conversationID)
	if err != nil {
		return nil, err
	}
	s.hub.notifyChanged(conversationID, memberIDs(updated))
	return updated, nil
}

// RemoveMember removes another member (owner/admin only) or lets a member leave.
func (s *Service) RemoveMember(ctx context.Context, tenantID, userID, conversationID, targetID uuid.UUID) error {
	c, me, err := s.conversationFor(ctx, tenantID, userID, conversationID)
	if err != nil {
		return err
	}
	if c.Kind == KindDM {
		return invalid("Members cannot be removed from a direct message")
	}
	if targetID != userID {
		if !canManage(me) {
			return ErrForbidden
		}
		target := memberOf(c, targetID)
		if target == nil {
			return ErrNotFound
		}
		if target.Role == RoleOwner {
			return ErrForbidden
		}
	}
	if err := s.repo.RemoveMember(ctx, conversationID, targetID); err != nil {
		return err
	}
	s.hub.invalidate(conversationID)
	// Includes the removed user, so their clients drop the conversation too.
	s.hub.notifyChanged(conversationID, memberIDs(c))
	return nil
}

// ───────────────────────────── Media ─────────────────────────────

// Attachments are encrypted on the device and stored as opaque blobs under
// their conversation. The server only checks that the caller is a member.
func mediaPrefix(tenantID, conversationID uuid.UUID) string {
	return fmt.Sprintf("pulse/%s/%s/", tenantID, conversationID)
}

// mediaStorage returns object storage with the attachment bucket in place.
func (s *Service) mediaStorage(ctx context.Context) (media.Storage, error) {
	storage := media.GetDefaultStorage()
	if storage == nil {
		return nil, errors.New("attachment storage is not configured")
	}
	if !s.mediaBucketReady.Load() {
		if err := storage.EnsurePrivateBucket(ctx, s.mediaBucket); err != nil {
			return nil, err
		}
		s.mediaBucketReady.Store(true)
	}
	return storage, nil
}

func (s *Service) MediaUpload(ctx context.Context, tenantID, userID uuid.UUID, req *MediaUploadRequest) (*MediaUploadResponse, error) {
	if req.SizeBytes <= 0 || req.SizeBytes > MaxMediaBytes {
		return nil, invalid("File is empty or larger than 100 MB")
	}
	if _, _, err := s.conversationFor(ctx, tenantID, userID, req.ConversationID); err != nil {
		return nil, err
	}
	storage, err := s.mediaStorage(ctx)
	if err != nil {
		return nil, err
	}
	key := mediaPrefix(tenantID, req.ConversationID) + uuid.NewString()
	up, err := storage.GetPresignedUpload(ctx, s.mediaBucket, key, mediaUploadTTL, MaxMediaBytes)
	if err != nil {
		return nil, err
	}
	return &MediaUploadResponse{ObjectKey: key, URL: up.URL, Fields: up.Fields}, nil
}

func (s *Service) MediaDownload(ctx context.Context, tenantID, userID uuid.UUID, req *MediaDownloadRequest) (*MediaDownloadResponse, error) {
	if _, _, err := s.conversationFor(ctx, tenantID, userID, req.ConversationID); err != nil {
		return nil, err
	}
	// The key must be exactly one object directly under this conversation.
	name, ok := strings.CutPrefix(req.ObjectKey, mediaPrefix(tenantID, req.ConversationID))
	if _, err := uuid.Parse(name); !ok || err != nil {
		return nil, ErrNotFound
	}
	storage, err := s.mediaStorage(ctx)
	if err != nil {
		return nil, err
	}
	url, err := storage.GetPresignedURL(ctx, s.mediaBucket, req.ObjectKey, mediaDownloadTTL)
	if err != nil {
		return nil, err
	}
	return &MediaDownloadResponse{URL: url}, nil
}

// ───────────────────────────── Key backups ─────────────────────────────

func (s *Service) PutKeyBackups(ctx context.Context, userID uuid.UUID, items []KeyBackup) error {
	if len(items) == 0 || len(items) > maxKeyBackupsPerCall {
		return invalid("items must contain between 1 and 500 entries")
	}
	for _, it := range items {
		if it.Epoch < 0 || len(it.EncryptedKey) == 0 || len(it.EncryptedKey) > maxKeyBackupBytes {
			return invalid("Invalid key backup entry")
		}
	}
	return s.repo.PutKeyBackups(ctx, userID, items)
}

func (s *Service) ListKeyBackups(ctx context.Context, userID uuid.UUID, conversationID *uuid.UUID) ([]KeyBackup, error) {
	return s.repo.ListKeyBackups(ctx, userID, conversationID)
}
