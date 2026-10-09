package pulse

import (
	"context"
	"database/sql"
	"errors"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

type Repository struct {
	db *sqlx.DB
}

func NewRepository(db *sqlx.DB) *Repository {
	return &Repository{db: db}
}

func uuidArray(ids []uuid.UUID) any {
	out := make([]string, len(ids))
	for i, id := range ids {
		out[i] = id.String()
	}
	return pq.Array(out)
}

// ───────────────────────────── Devices ─────────────────────────────

func (r *Repository) CountActiveDevices(ctx context.Context, userID uuid.UUID) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM pulse_devices WHERE user_id = $1 AND revoked_at IS NULL`, userID)
	return n, err
}

func (r *Repository) CreateDevice(ctx context.Context, d *Device, keyPackages [][]byte) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	err = tx.QueryRowxContext(ctx, `
		INSERT INTO pulse_devices (id, tenant_id, user_id, platform, name, identity_key)
		VALUES ($1, $2, $3, $4, $5, $6)
		RETURNING created_at
	`, d.ID, d.TenantID, d.UserID, d.Platform, d.Name, d.IdentityKey).Scan(&d.CreatedAt)
	if err != nil {
		var pqErr *pq.Error
		if errors.As(err, &pqErr) && pqErr.Code == "23505" {
			return ErrConflict
		}
		return err
	}
	if err := insertKeyPackages(ctx, tx, d.ID, keyPackages); err != nil {
		return err
	}
	return tx.Commit()
}

func insertKeyPackages(ctx context.Context, ex sqlx.ExtContext, deviceID uuid.UUID, keyPackages [][]byte) error {
	if len(keyPackages) == 0 {
		return nil
	}
	_, err := ex.ExecContext(ctx, `
		INSERT INTO pulse_key_packages (device_id, key_package)
		SELECT $1::uuid, kp FROM unnest($2::bytea[]) kp
	`, deviceID, pq.ByteaArray(keyPackages))
	return err
}

// GetActiveDevice returns the device only if it belongs to the user and is not revoked.
func (r *Repository) GetActiveDevice(ctx context.Context, tenantID, userID, deviceID uuid.UUID) (*Device, error) {
	var d Device
	err := r.db.GetContext(ctx, &d, `
		SELECT id, tenant_id, user_id, platform, name, identity_key, created_at, last_seen_at
		FROM pulse_devices
		WHERE id = $1 AND user_id = $2 AND tenant_id = $3 AND revoked_at IS NULL
	`, deviceID, userID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	return &d, err
}

// DeviceOwner resolves an active device in the tenant to its user.
func (r *Repository) DeviceOwner(ctx context.Context, tenantID, deviceID uuid.UUID) (uuid.UUID, error) {
	var userID uuid.UUID
	err := r.db.GetContext(ctx, &userID, `
		SELECT user_id FROM pulse_devices WHERE id = $1 AND tenant_id = $2 AND revoked_at IS NULL
	`, deviceID, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return uuid.Nil, ErrNotFound
	}
	return userID, err
}

func (r *Repository) ListDevices(ctx context.Context, tenantID, userID uuid.UUID) ([]Device, error) {
	devices := []Device{}
	err := r.db.SelectContext(ctx, &devices, `
		SELECT id, tenant_id, user_id, platform, name, identity_key, created_at, last_seen_at
		FROM pulse_devices
		WHERE user_id = $1 AND tenant_id = $2 AND revoked_at IS NULL
		ORDER BY created_at
	`, userID, tenantID)
	return devices, err
}

// LookupDevices returns the active devices of several users in one query.
func (r *Repository) LookupDevices(ctx context.Context, tenantID uuid.UUID, userIDs []uuid.UUID) ([]Device, error) {
	devices := []Device{}
	err := r.db.SelectContext(ctx, &devices, `
		SELECT id, tenant_id, user_id, platform, name, identity_key, created_at, last_seen_at
		FROM pulse_devices
		WHERE tenant_id = $1 AND user_id = ANY($2::uuid[]) AND revoked_at IS NULL
		ORDER BY user_id, created_at
	`, tenantID, uuidArray(userIDs))
	return devices, err
}

// RevokeDevice retires the device and drops everything queued for it.
func (r *Repository) RevokeDevice(ctx context.Context, tenantID, userID, deviceID uuid.UUID) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx, `
		UPDATE pulse_devices SET revoked_at = NOW(), push_token = NULL
		WHERE id = $1 AND user_id = $2 AND tenant_id = $3 AND revoked_at IS NULL
	`, deviceID, userID, tenantID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM pulse_key_packages WHERE device_id = $1`, deviceID); err != nil {
		return err
	}
	if _, err := tx.ExecContext(ctx, `DELETE FROM pulse_device_inbox WHERE device_id = $1`, deviceID); err != nil {
		return err
	}
	return tx.Commit()
}

func (r *Repository) TouchDevice(ctx context.Context, deviceID uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `UPDATE pulse_devices SET last_seen_at = NOW() WHERE id = $1`, deviceID)
	return err
}

func (r *Repository) AddKeyPackages(ctx context.Context, deviceID uuid.UUID, keyPackages [][]byte) error {
	return insertKeyPackages(ctx, r.db, deviceID, keyPackages)
}

func (r *Repository) CountKeyPackages(ctx context.Context, deviceID uuid.UUID) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n, `SELECT COUNT(*) FROM pulse_key_packages WHERE device_id = $1`, deviceID)
	return n, err
}

// ClaimKeyPackages consumes one key package from each active device of the
// target user. Devices that have run out are omitted.
func (r *Repository) ClaimKeyPackages(ctx context.Context, tenantID, targetUserID uuid.UUID) ([]ClaimedKeyPackage, error) {
	devices, err := r.ListDevices(ctx, tenantID, targetUserID)
	if err != nil {
		return nil, err
	}
	claimed := make([]ClaimedKeyPackage, 0, len(devices))
	for _, d := range devices {
		var kp []byte
		err := r.db.GetContext(ctx, &kp, `
			DELETE FROM pulse_key_packages
			WHERE id = (
				SELECT id FROM pulse_key_packages
				WHERE device_id = $1
				ORDER BY id
				FOR UPDATE SKIP LOCKED
				LIMIT 1
			)
			RETURNING key_package
		`, d.ID)
		if errors.Is(err, sql.ErrNoRows) {
			continue
		}
		if err != nil {
			return nil, err
		}
		claimed = append(claimed, ClaimedKeyPackage{DeviceID: d.ID, IdentityKey: d.IdentityKey, KeyPackage: kp})
	}
	return claimed, nil
}

// ───────────────────────────── Conversations ─────────────────────────────

func (r *Repository) CountUsersInTenant(ctx context.Context, tenantID uuid.UUID, userIDs []uuid.UUID) (int, error) {
	var n int
	err := r.db.GetContext(ctx, &n, `
		SELECT COUNT(*) FROM users WHERE tenant_id = $1 AND id = ANY($2::uuid[])
	`, tenantID, uuidArray(userIDs))
	return n, err
}

// CreateConversation inserts the conversation and its members. For a DM that
// already exists it returns the existing id with created=false.
func (r *Repository) CreateConversation(ctx context.Context, c *Conversation, dmKey *string, memberIDs []uuid.UUID) (created bool, err error) {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return false, err
	}
	defer tx.Rollback()

	err = tx.QueryRowxContext(ctx, `
		INSERT INTO pulse_conversations (tenant_id, kind, name, topic, is_private, dm_key, created_by)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
		ON CONFLICT (tenant_id, dm_key) DO NOTHING
		RETURNING id
	`, c.TenantID, c.Kind, c.Name, c.Topic, c.IsPrivate, dmKey, c.CreatedBy).Scan(&c.ID)
	if errors.Is(err, sql.ErrNoRows) {
		err = tx.GetContext(ctx, &c.ID, `
			SELECT id FROM pulse_conversations WHERE tenant_id = $1 AND dm_key = $2
		`, c.TenantID, dmKey)
		return false, err
	}
	if err != nil {
		return false, err
	}

	_, err = tx.ExecContext(ctx, `
		INSERT INTO pulse_members (conversation_id, user_id, role)
		SELECT $1::uuid, u, CASE WHEN u = $2::uuid THEN 'owner' ELSE 'member' END
		FROM unnest($3::uuid[]) u
	`, c.ID, c.CreatedBy, uuidArray(memberIDs))
	if err != nil {
		return false, err
	}
	return true, tx.Commit()
}

const conversationColumns = `c.id, c.tenant_id, c.kind, c.name, c.topic, c.is_private, c.created_by, c.last_seq, c.epoch, c.group_info_epoch, c.last_message_at, c.created_at`

func (r *Repository) GetConversation(ctx context.Context, tenantID, id uuid.UUID) (*Conversation, error) {
	var c Conversation
	err := r.db.GetContext(ctx, &c, `
		SELECT `+conversationColumns+` FROM pulse_conversations c WHERE c.id = $1 AND c.tenant_id = $2
	`, id, tenantID)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	c.Members, err = r.ListMembers(ctx, id)
	return &c, err
}

// ConversationRouting is the minimum the gateway needs to authorize and fan out.
func (r *Repository) ConversationRouting(ctx context.Context, id uuid.UUID) (tenantID uuid.UUID, kind string, memberIDs []uuid.UUID, err error) {
	err = r.db.QueryRowxContext(ctx, `SELECT tenant_id, kind FROM pulse_conversations WHERE id = $1`, id).Scan(&tenantID, &kind)
	if errors.Is(err, sql.ErrNoRows) {
		return uuid.Nil, "", nil, ErrNotFound
	}
	if err != nil {
		return uuid.Nil, "", nil, err
	}
	err = r.db.SelectContext(ctx, &memberIDs, `SELECT user_id FROM pulse_members WHERE conversation_id = $1`, id)
	return tenantID, kind, memberIDs, err
}

func (r *Repository) ListMembers(ctx context.Context, conversationID uuid.UUID) ([]Member, error) {
	members := []Member{}
	err := r.db.SelectContext(ctx, &members, `
		SELECT conversation_id, user_id, role, joined_seq, delivered_seq, read_seq
		FROM pulse_members WHERE conversation_id = $1
		ORDER BY joined_at, user_id
	`, conversationID)
	return members, err
}

// ListConversations returns every conversation the user belongs to, most
// recently active first, with member watermarks attached.
func (r *Repository) ListConversations(ctx context.Context, tenantID, userID uuid.UUID) ([]Conversation, error) {
	convs := []Conversation{}
	err := r.db.SelectContext(ctx, &convs, `
		SELECT `+conversationColumns+`
		FROM pulse_conversations c
		JOIN pulse_members m ON m.conversation_id = c.id
		WHERE m.user_id = $1 AND c.tenant_id = $2
		ORDER BY COALESCE(c.last_message_at, c.created_at) DESC
	`, userID, tenantID)
	if err != nil || len(convs) == 0 {
		return convs, err
	}

	ids := make([]uuid.UUID, len(convs))
	index := make(map[uuid.UUID]int, len(convs))
	for i := range convs {
		ids[i] = convs[i].ID
		index[convs[i].ID] = i
		convs[i].Members = []Member{}
	}

	var members []Member
	err = r.db.SelectContext(ctx, &members, `
		SELECT conversation_id, user_id, role, joined_seq, delivered_seq, read_seq
		FROM pulse_members WHERE conversation_id = ANY($1::uuid[])
		ORDER BY joined_at, user_id
	`, uuidArray(ids))
	if err != nil {
		return nil, err
	}
	for _, m := range members {
		i := index[m.ConversationID]
		convs[i].Members = append(convs[i].Members, m)
	}
	return convs, nil
}

// AddMembers joins users at the current end of the log, so their watermarks
// never hold back ticks on messages sent before they joined.
func (r *Repository) AddMembers(ctx context.Context, conversationID uuid.UUID, userIDs []uuid.UUID) error {
	_, err := r.db.ExecContext(ctx, `
		INSERT INTO pulse_members (conversation_id, user_id, joined_seq, delivered_seq, read_seq)
		SELECT c.id, u, c.last_seq, c.last_seq, c.last_seq
		FROM pulse_conversations c, unnest($2::uuid[]) u
		WHERE c.id = $1
		ON CONFLICT DO NOTHING
	`, conversationID, uuidArray(userIDs))
	return err
}

func (r *Repository) RemoveMember(ctx context.Context, conversationID, userID uuid.UUID) error {
	res, err := r.db.ExecContext(ctx, `
		DELETE FROM pulse_members WHERE conversation_id = $1 AND user_id = $2
	`, conversationID, userID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// PutGroupInfo stores the GroupInfo for the conversation's current epoch. The
// first one stored for an epoch is kept (any member can publish it, and they
// are equivalent). A GroupInfo for any other epoch is ErrConflict.
func (r *Repository) PutGroupInfo(ctx context.Context, conversationID uuid.UUID, epoch int64, info []byte) error {
	var current int64
	err := r.db.QueryRowxContext(ctx, `
		WITH upd AS (
			UPDATE pulse_conversations SET group_info = $3, group_info_epoch = $2
			WHERE id = $1 AND epoch = $2 AND group_info_epoch < $2
			RETURNING epoch
		)
		SELECT epoch FROM upd
		UNION ALL
		SELECT epoch FROM pulse_conversations WHERE id = $1 AND NOT EXISTS (SELECT 1 FROM upd)
	`, conversationID, epoch, info).Scan(&current)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrNotFound
	}
	if err != nil {
		return err
	}
	if current != epoch {
		return ErrConflict
	}
	return nil
}

// GetGroupInfo returns the GroupInfo for the conversation's current epoch, or
// ErrNotFound if none has been published for it yet.
func (r *Repository) GetGroupInfo(ctx context.Context, conversationID uuid.UUID) (*GroupInfo, error) {
	var g GroupInfo
	err := r.db.QueryRowxContext(ctx, `
		SELECT epoch, group_info FROM pulse_conversations
		WHERE id = $1 AND group_info IS NOT NULL AND group_info_epoch = epoch
	`, conversationID).Scan(&g.Epoch, &g.GroupInfo)
	if errors.Is(err, sql.ErrNoRows) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return &g, nil
}

// ───────────────────────────── Messages ─────────────────────────────

// InsertMessage appends to the conversation log in one round trip: it takes
// the next seq, stores the ciphertext, and moves the sender's own watermarks.
// A retry of an already stored id returns the original seq with duplicate=true.
// A handshake (requireEpoch) is stored only if m.Epoch is exactly one past the
// conversation's epoch; otherwise ErrConflict.
func (r *Repository) InsertMessage(ctx context.Context, conversationID uuid.UUID, m *StoredMessage, requireEpoch bool) (duplicate bool, err error) {
	err = r.db.QueryRowxContext(ctx, `
		WITH bump AS (
			UPDATE pulse_conversations
			SET last_seq = last_seq + 1, last_message_at = NOW(),
			    epoch = CASE WHEN $8::boolean THEN $7::bigint ELSE epoch END
			WHERE id = $1 AND (NOT $8::boolean OR epoch = $7::bigint - 1)
			RETURNING last_seq
		), ins AS (
			INSERT INTO pulse_messages (conversation_id, seq, id, sender_id, sender_device_id, kind, ciphertext, epoch)
			SELECT $1::uuid, last_seq, $2::uuid, $3::uuid, $4::uuid, $5::smallint, $6::bytea, $7::bigint FROM bump
			RETURNING seq, created_at
		), mark AS (
			UPDATE pulse_members mem
			SET delivered_seq = ins.seq, read_seq = ins.seq
			FROM ins
			WHERE mem.conversation_id = $1 AND mem.user_id = $3
		)
		SELECT seq, created_at FROM ins
	`, conversationID, m.ID, m.SenderID, m.SenderDeviceID, m.Kind, m.Ciphertext, m.Epoch, requireEpoch).Scan(&m.Seq, &m.CreatedAt)
	if err == nil {
		return false, nil
	}

	// Nothing stored. Either the id is already in the log (unique violation,
	// or a retried handshake whose epoch has since moved on), or a handshake
	// lost the race for its epoch. In both cases no seq was consumed.
	var pqErr *pq.Error
	isUnique := errors.As(err, &pqErr) && pqErr.Code == "23505"
	if !isUnique && !errors.Is(err, sql.ErrNoRows) {
		return false, err
	}

	var senderID uuid.UUID
	err = r.db.QueryRowxContext(ctx, `
		SELECT seq, created_at, sender_id FROM pulse_messages WHERE conversation_id = $1 AND id = $2
	`, conversationID, m.ID).Scan(&m.Seq, &m.CreatedAt, &senderID)
	if errors.Is(err, sql.ErrNoRows) {
		return false, ErrConflict
	}
	if err != nil {
		return false, err
	}
	if senderID != m.SenderID {
		return false, ErrForbidden
	}
	return true, nil
}

// ListMessages returns up to limit rows in ascending seq order.
// With beforeSeq == 0 it pages forward from afterSeq; otherwise it returns
// the page just below beforeSeq.
func (r *Repository) ListMessages(ctx context.Context, conversationID uuid.UUID, afterSeq, beforeSeq int64, limit int) (msgs []StoredMessage, hasMore bool, err error) {
	const cols = `seq, id, sender_id, sender_device_id, kind, epoch, ciphertext, created_at`
	forward := beforeSeq == 0
	if forward {
		err = r.db.SelectContext(ctx, &msgs, `
			SELECT `+cols+` FROM pulse_messages
			WHERE conversation_id = $1 AND seq > $2
			ORDER BY seq ASC LIMIT $3
		`, conversationID, afterSeq, limit+1)
	} else {
		err = r.db.SelectContext(ctx, &msgs, `
			SELECT `+cols+` FROM pulse_messages
			WHERE conversation_id = $1 AND seq < $2
			ORDER BY seq DESC LIMIT $3
		`, conversationID, beforeSeq, limit+1)
	}
	if err != nil {
		return nil, false, err
	}
	if len(msgs) > limit {
		hasMore = true
		msgs = msgs[:limit]
	}
	if !forward {
		for i, j := 0, len(msgs)-1; i < j; i, j = i+1, j-1 {
			msgs[i], msgs[j] = msgs[j], msgs[i]
		}
	}
	return msgs, hasMore, nil
}

// AdvanceWatermark moves a member's delivered (and optionally read) watermark
// forward, clamped to the end of the log. changed is false when nothing moved
// or the user is not a member.
func (r *Repository) AdvanceWatermark(ctx context.Context, conversationID, userID uuid.UUID, seq int64, read bool) (delivered, readSeq int64, changed bool, err error) {
	err = r.db.QueryRowxContext(ctx, `
		UPDATE pulse_members m
		SET delivered_seq = GREATEST(m.delivered_seq, LEAST($3::bigint, c.last_seq)),
		    read_seq = CASE WHEN $4::boolean THEN GREATEST(m.read_seq, LEAST($3::bigint, c.last_seq)) ELSE m.read_seq END
		FROM pulse_conversations c
		WHERE m.conversation_id = $1 AND m.user_id = $2 AND c.id = m.conversation_id
		  AND (m.delivered_seq < LEAST($3::bigint, c.last_seq)
		       OR ($4::boolean AND m.read_seq < LEAST($3::bigint, c.last_seq)))
		RETURNING m.delivered_seq, m.read_seq
	`, conversationID, userID, seq, read).Scan(&delivered, &readSeq)
	if errors.Is(err, sql.ErrNoRows) {
		return 0, 0, false, nil
	}
	return delivered, readSeq, err == nil, err
}

// ───────────────────────────── Device inbox ─────────────────────────────

func (r *Repository) InsertDirect(ctx context.Context, toDeviceID uuid.UUID, d *DirectMessage) error {
	return r.db.QueryRowxContext(ctx, `
		INSERT INTO pulse_device_inbox (device_id, from_user_id, from_device_id, conversation_id, payload)
		VALUES ($1, $2, $3, $4, $5)
		RETURNING id, created_at
	`, toDeviceID, d.FromUserID, d.FromDeviceID, d.ConversationID, d.Payload).Scan(&d.ID, &d.CreatedAt)
}

func (r *Repository) ListDirect(ctx context.Context, deviceID uuid.UUID, limit int) ([]DirectMessage, error) {
	var out []DirectMessage
	err := r.db.SelectContext(ctx, &out, `
		SELECT id, from_user_id, from_device_id, conversation_id, payload, created_at
		FROM pulse_device_inbox WHERE device_id = $1
		ORDER BY id LIMIT $2
	`, deviceID, limit)
	return out, err
}

func (r *Repository) AckDirect(ctx context.Context, deviceID uuid.UUID, ids []int64) error {
	_, err := r.db.ExecContext(ctx, `
		DELETE FROM pulse_device_inbox WHERE device_id = $1 AND id = ANY($2::bigint[])
	`, deviceID, pq.Array(ids))
	return err
}

// ───────────────────────────── Key backups ─────────────────────────────

// PutKeyBackups stores backups only for conversations the user belongs to.
func (r *Repository) PutKeyBackups(ctx context.Context, userID uuid.UUID, items []KeyBackup) error {
	tx, err := r.db.BeginTxx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, it := range items {
		_, err := tx.ExecContext(ctx, `
			INSERT INTO pulse_key_backups (user_id, conversation_id, epoch, encrypted_key)
			SELECT $1::uuid, $2::uuid, $3::bigint, $4::bytea
			WHERE EXISTS (SELECT 1 FROM pulse_members WHERE conversation_id = $2 AND user_id = $1)
			ON CONFLICT (user_id, conversation_id, epoch)
			DO UPDATE SET encrypted_key = EXCLUDED.encrypted_key, updated_at = NOW()
		`, userID, it.ConversationID, it.Epoch, it.EncryptedKey)
		if err != nil {
			return err
		}
	}
	return tx.Commit()
}

func (r *Repository) ListKeyBackups(ctx context.Context, userID uuid.UUID, conversationID *uuid.UUID) ([]KeyBackup, error) {
	out := []KeyBackup{}
	err := r.db.SelectContext(ctx, &out, `
		SELECT conversation_id, epoch, encrypted_key FROM pulse_key_backups
		WHERE user_id = $1 AND ($2::uuid IS NULL OR conversation_id = $2)
		ORDER BY conversation_id, epoch
	`, userID, conversationID)
	return out, err
}

// PushTarget is a device that can be woken by push.
type PushTarget struct {
	DeviceID uuid.UUID `db:"id"`
	UserID   uuid.UUID `db:"user_id"`
	Token    string    `db:"push_token"`
}

// PushTargets lists the active devices of these users that registered a push token.
func (r *Repository) PushTargets(ctx context.Context, userIDs []uuid.UUID) ([]PushTarget, error) {
	var out []PushTarget
	err := r.db.SelectContext(ctx, &out, `
		SELECT id, user_id, push_token FROM pulse_devices
		WHERE user_id = ANY($1) AND revoked_at IS NULL AND push_token IS NOT NULL AND push_token <> ''
	`, pq.Array(userIDs))
	return out, err
}

// SetPushToken stores (or, with an empty token, clears) the push token of one of the user's devices.
func (r *Repository) SetPushToken(ctx context.Context, tenantID, userID, deviceID uuid.UUID, token string) error {
	res, err := r.db.ExecContext(ctx, `
		UPDATE pulse_devices SET push_token = NULLIF($1, '')
		WHERE id = $2 AND user_id = $3 AND tenant_id = $4 AND revoked_at IS NULL
	`, token, deviceID, userID, tenantID)
	if err != nil {
		return err
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return ErrNotFound
	}
	return nil
}

// ClearPushToken forgets a token the push service rejected, unless the device has registered a new one since.
func (r *Repository) ClearPushToken(ctx context.Context, deviceID uuid.UUID, token string) error {
	_, err := r.db.ExecContext(ctx, `UPDATE pulse_devices SET push_token = NULL WHERE id = $1 AND push_token = $2`, deviceID, token)
	return err
}
