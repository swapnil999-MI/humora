package pulse

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"math"
	"net"
	"os"
	"sort"
	"testing"
	"time"

	"humora-backend/internal/pulse/pulsepb"
	"humora-backend/pkg/media"

	ws "github.com/fasthttp/websocket"
	"github.com/gofiber/fiber/v2"
	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"google.golang.org/protobuf/proto"
)

// These tests drive the real gateway over a real WebSocket against Postgres.
// They run only when PULSE_TEST_DATABASE_URL points at a database that has
// database/schema/01_identity.sql and 05_pulse.sql applied.

type testEnv struct {
	t    *testing.T
	db   *sqlx.DB
	svc  *Service
	hub  *Hub
	addr string
}

type testUser struct {
	tenantID uuid.UUID
	id       uuid.UUID
}

type testConn struct {
	t      *testing.T
	conn   *ws.Conn
	frames chan *pulsepb.ServerFrame
	device uuid.UUID
}

func newTestEnv(t *testing.T) *testEnv {
	t.Helper()
	url := os.Getenv("PULSE_TEST_DATABASE_URL")
	if url == "" {
		t.Skip("PULSE_TEST_DATABASE_URL not set")
	}
	db, err := sqlx.Connect("postgres", url)
	if err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { db.Close() })

	repo := NewRepository(db)
	hub := NewHub(repo)
	svc := NewService(repo, hub)

	app := fiber.New(fiber.Config{DisableStartupMessage: true})
	RegisterRoutes(app.Group("/api/v1"), NewHandler(svc), hub)
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	go app.Listener(ln)
	t.Cleanup(func() { _ = app.Shutdown() })

	return &testEnv{t: t, db: db, svc: svc, hub: hub, addr: ln.Addr().String()}
}

func (e *testEnv) tenant() uuid.UUID {
	e.t.Helper()
	var id uuid.UUID
	err := e.db.Get(&id, `INSERT INTO tenants (slug, name) VALUES ($1, 'Pulse Test') RETURNING id`, "pt-"+uuid.NewString()[:13])
	if err != nil {
		e.t.Fatalf("seed tenant: %v", err)
	}
	e.t.Cleanup(func() { e.db.Exec(`DELETE FROM tenants WHERE id = $1`, id) })
	return id
}

func (e *testEnv) user(tenantID uuid.UUID) testUser {
	e.t.Helper()
	var id uuid.UUID
	err := e.db.Get(&id, `INSERT INTO users (tenant_id, email, password_hash) VALUES ($1, $2, 'x') RETURNING id`,
		tenantID, uuid.NewString()+"@pulse.test")
	if err != nil {
		e.t.Fatalf("seed user: %v", err)
	}
	return testUser{tenantID: tenantID, id: id}
}

func (e *testEnv) device(u testUser) uuid.UUID {
	e.t.Helper()
	d, err := e.svc.RegisterDevice(context.Background(), u.tenantID, u.id, &RegisterDeviceRequest{
		ID: uuid.New(), Platform: "web", Name: "test", IdentityKey: []byte("identity"), KeyPackages: [][]byte{[]byte("kp1"), []byte("kp2")},
	})
	if err != nil {
		e.t.Fatalf("register device: %v", err)
	}
	return d.ID
}

func (e *testEnv) dial(ticket string) (*ws.Conn, error) {
	conn, _, err := ws.DefaultDialer.Dial(fmt.Sprintf("ws://%s/api/v1/pulse/ws?ticket=%s", e.addr, ticket), nil)
	return conn, err
}

func (e *testEnv) connectDevice(u testUser, deviceID uuid.UUID) *testConn {
	e.t.Helper()
	ticket, err := e.svc.IssueTicket(context.Background(), u.tenantID, u.id, deviceID)
	if err != nil {
		e.t.Fatalf("ticket: %v", err)
	}
	conn, err := e.dial(ticket)
	if err != nil {
		e.t.Fatalf("dial: %v", err)
	}
	tc := &testConn{t: e.t, conn: conn, frames: make(chan *pulsepb.ServerFrame, 1024), device: deviceID}
	go func() {
		defer close(tc.frames)
		for {
			_, data, err := conn.ReadMessage()
			if err != nil {
				return
			}
			f := &pulsepb.ServerFrame{}
			if proto.Unmarshal(data, f) == nil {
				tc.frames <- f
			}
		}
	}()
	e.t.Cleanup(func() { conn.Close() })
	return tc
}

func (e *testEnv) connect(u testUser) *testConn {
	return e.connectDevice(u, e.device(u))
}

func (c *testConn) write(f *pulsepb.ClientFrame) {
	c.t.Helper()
	b, err := proto.Marshal(f)
	if err != nil {
		c.t.Fatalf("marshal: %v", err)
	}
	if err := c.conn.WriteMessage(ws.BinaryMessage, b); err != nil {
		c.t.Fatalf("write: %v", err)
	}
}

// next returns the next frame, skipping conversation-changed notices.
func (c *testConn) next() *pulsepb.ServerFrame {
	c.t.Helper()
	for {
		select {
		case f, ok := <-c.frames:
			if !ok {
				c.t.Fatalf("connection closed while waiting for a frame")
			}
			if f.GetConversationChanged() != nil {
				continue
			}
			return f
		case <-time.After(3 * time.Second):
			c.t.Fatalf("timed out waiting for a frame")
		}
	}
}

// quiet asserts nothing (other than conversation-changed notices) arrives.
func (c *testConn) quiet() {
	c.t.Helper()
	deadline := time.After(200 * time.Millisecond)
	for {
		select {
		case f, ok := <-c.frames:
			if ok && f.GetConversationChanged() == nil {
				c.t.Fatalf("unexpected frame: %v", f)
			}
			if !ok {
				return
			}
		case <-deadline:
			return
		}
	}
}

func (c *testConn) send(reqID uint64, convID, msgID uuid.UUID, body string) {
	c.write(&pulsepb.ClientFrame{ReqId: reqID, Body: &pulsepb.ClientFrame_Send{Send: &pulsepb.Send{
		ConversationId: convID[:], Id: msgID[:], Kind: pulsepb.MessageKind_MESSAGE_KIND_APPLICATION, Ciphertext: []byte(body),
	}}})
}

func (e *testEnv) conversation(creator testUser, kind, name string, others ...testUser) uuid.UUID {
	e.t.Helper()
	ids := make([]uuid.UUID, len(others))
	for i, o := range others {
		ids[i] = o.id
	}
	c, _, err := e.svc.CreateConversation(context.Background(), creator.tenantID, creator.id,
		&CreateConversationRequest{Kind: kind, Name: name, MemberIDs: ids})
	if err != nil {
		e.t.Fatalf("create conversation: %v", err)
	}
	return c.ID
}

func TestTicketIsSingleUse(t *testing.T) {
	e := newTestEnv(t)
	alice := e.user(e.tenant())
	ticket, err := e.svc.IssueTicket(context.Background(), alice.tenantID, alice.id, e.device(alice))
	if err != nil {
		t.Fatal(err)
	}
	conn, err := e.dial(ticket)
	if err != nil {
		t.Fatalf("first dial should succeed: %v", err)
	}
	conn.Close()
	if conn, err := e.dial(ticket); err == nil {
		conn.Close()
		t.Fatal("reused ticket was accepted")
	}
	if conn, err := e.dial("not-a-ticket"); err == nil {
		conn.Close()
		t.Fatal("bogus ticket was accepted")
	}
}

func TestSendDeliverReadTicks(t *testing.T) {
	e := newTestEnv(t)
	tenant := e.tenant()
	alice, bob := e.user(tenant), e.user(tenant)
	conv := e.conversation(alice, KindDM, "", bob)
	a, b := e.connect(alice), e.connect(bob)

	// Single tick: stored and acked with seq 1.
	id := uuid.New()
	a.send(7, conv, id, "ciphertext-1")
	ack := a.next()
	if ack.GetReqId() != 7 || ack.GetSendAck().GetSeq() != 1 || ack.GetSendAck().GetDuplicate() {
		t.Fatalf("bad ack: %v", ack)
	}
	env := b.next().GetMessage()
	if env.GetSeq() != 1 || !bytes.Equal(env.GetCiphertext(), []byte("ciphertext-1")) || !bytes.Equal(env.GetSenderId(), alice.id[:]) {
		t.Fatalf("bad envelope: %v", env)
	}

	// A retry of the same id is acked with the original seq and not re-delivered.
	a.send(8, conv, id, "ciphertext-1")
	dup := a.next().GetSendAck()
	if dup.GetSeq() != 1 || !dup.GetDuplicate() {
		t.Fatalf("bad duplicate ack: %v", dup)
	}
	b.quiet()

	// Double tick.
	b.write(&pulsepb.ClientFrame{Body: &pulsepb.ClientFrame_Delivered{Delivered: &pulsepb.Watermark{ConversationId: conv[:], Seq: 1}}})
	r := a.next().GetReceipt()
	if r.GetDeliveredSeq() != 1 || r.GetReadSeq() != 0 || !bytes.Equal(r.GetUserId(), bob.id[:]) {
		t.Fatalf("bad delivered receipt: %v", r)
	}
	// Repeating a watermark changes nothing and sends nothing.
	b.write(&pulsepb.ClientFrame{Body: &pulsepb.ClientFrame_Delivered{Delivered: &pulsepb.Watermark{ConversationId: conv[:], Seq: 1}}})
	a.quiet()

	// Blue tick. A watermark past the end of the log is clamped to it.
	b.write(&pulsepb.ClientFrame{Body: &pulsepb.ClientFrame_Read{Read: &pulsepb.Watermark{ConversationId: conv[:], Seq: 999}}})
	r = a.next().GetReceipt()
	if r.GetDeliveredSeq() != 1 || r.GetReadSeq() != 1 {
		t.Fatalf("bad read receipt: %v", r)
	}

	// Watermarks are persisted for clients that were offline.
	c, err := e.svc.GetConversation(context.Background(), tenant, alice.id, conv)
	if err != nil {
		t.Fatal(err)
	}
	for _, m := range c.Members {
		if m.DeliveredSeq != 1 || m.ReadSeq != 1 {
			t.Fatalf("member %s watermarks = %d/%d, want 1/1", m.UserID, m.DeliveredSeq, m.ReadSeq)
		}
	}

	// Typing is relayed to the other side only.
	a.write(&pulsepb.ClientFrame{Body: &pulsepb.ClientFrame_Typing{Typing: &pulsepb.Typing{ConversationId: conv[:], Active: true}}})
	if ty := b.next().GetTyping(); !ty.GetActive() || !bytes.Equal(ty.GetUserId(), alice.id[:]) {
		t.Fatalf("bad typing event: %v", ty)
	}
	a.quiet()
}

func TestOutsidersAreRejected(t *testing.T) {
	e := newTestEnv(t)
	tenant := e.tenant()
	alice, bob, carol := e.user(tenant), e.user(tenant), e.user(tenant)
	mallory := e.user(e.tenant())
	conv := e.conversation(alice, KindDM, "", bob)
	a := e.connect(alice)
	a.send(1, conv, uuid.New(), "secret")
	a.next()

	for name, outsider := range map[string]testUser{"same tenant non-member": carol, "other tenant": mallory} {
		c := e.connect(outsider)
		c.send(1, conv, uuid.New(), "intrusion")
		if code := c.next().GetError().GetCode(); code != pulsepb.ErrorCode_ERROR_CODE_FORBIDDEN {
			t.Fatalf("%s: send got %v, want FORBIDDEN", name, code)
		}
		c.write(&pulsepb.ClientFrame{ReqId: 2, Body: &pulsepb.ClientFrame_Sync{Sync: &pulsepb.Sync{ConversationId: conv[:]}}})
		if code := c.next().GetError().GetCode(); code != pulsepb.ErrorCode_ERROR_CODE_FORBIDDEN {
			t.Fatalf("%s: sync got %v, want FORBIDDEN", name, code)
		}
		c.write(&pulsepb.ClientFrame{ReqId: 3, Body: &pulsepb.ClientFrame_Read{Read: &pulsepb.Watermark{ConversationId: conv[:], Seq: 1}}})
		if code := c.next().GetError().GetCode(); code != pulsepb.ErrorCode_ERROR_CODE_FORBIDDEN {
			t.Fatalf("%s: read got %v, want FORBIDDEN", name, code)
		}
	}
	a.quiet()

	// Users from another tenant cannot be pulled into a conversation.
	_, _, err := e.svc.CreateConversation(context.Background(), tenant, alice.id,
		&CreateConversationRequest{Kind: KindGroup, Name: "x", MemberIDs: []uuid.UUID{mallory.id}})
	var inv *InvalidError
	if !errors.As(err, &inv) {
		t.Fatalf("cross-tenant member: got %v, want InvalidError", err)
	}
}

func TestSyncPaging(t *testing.T) {
	e := newTestEnv(t)
	tenant := e.tenant()
	alice, bob := e.user(tenant), e.user(tenant)
	conv := e.conversation(alice, KindDM, "", bob)
	a := e.connect(alice)
	for i := 1; i <= 5; i++ {
		a.send(uint64(i), conv, uuid.New(), fmt.Sprintf("m%d", i))
		a.next()
	}

	seqs := func(b *pulsepb.SyncBatch) []uint64 {
		out := []uint64{}
		for _, m := range b.GetMessages() {
			out = append(out, m.GetSeq())
		}
		return out
	}
	sync := func(after, before uint64, limit uint32) *pulsepb.SyncBatch {
		b := e.connect(bob)
		b.write(&pulsepb.ClientFrame{ReqId: 1, Body: &pulsepb.ClientFrame_Sync{Sync: &pulsepb.Sync{
			ConversationId: conv[:], AfterSeq: after, BeforeSeq: before, Limit: limit,
		}}})
		return b.next().GetSyncBatch()
	}

	if b := sync(2, 0, 2); fmt.Sprint(seqs(b)) != "[3 4]" || !b.GetHasMore() {
		t.Fatalf("gap fill: %v more=%v", seqs(b), b.GetHasMore())
	}
	if b := sync(0, 4, 2); fmt.Sprint(seqs(b)) != "[2 3]" || !b.GetHasMore() {
		t.Fatalf("scroll back: %v more=%v", seqs(b), b.GetHasMore())
	}
	if b := sync(0, 0, 3); fmt.Sprint(seqs(b)) != "[1 2 3]" || !b.GetHasMore() {
		t.Fatalf("from start: %v more=%v", seqs(b), b.GetHasMore())
	}
	if b := sync(0, math.MaxUint64, 3); fmt.Sprint(seqs(b)) != "[3 4 5]" || !b.GetHasMore() {
		t.Fatalf("latest page: %v more=%v", seqs(b), b.GetHasMore())
	}
	if b := sync(5, 0, 10); len(seqs(b)) != 0 || b.GetHasMore() {
		t.Fatalf("caught up: %v more=%v", seqs(b), b.GetHasMore())
	}
}

func TestGroupMembershipChanges(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	tenant := e.tenant()
	alice, bob, carol := e.user(tenant), e.user(tenant), e.user(tenant)
	conv := e.conversation(alice, KindGroup, "team", bob)
	a, b, c := e.connect(alice), e.connect(bob), e.connect(carol)

	a.send(1, conv, uuid.New(), "before carol")
	a.next()
	b.next()
	c.quiet()

	// Only owner/admin may add.
	if _, err := e.svc.AddMembers(ctx, tenant, bob.id, conv, []uuid.UUID{carol.id}); !errors.Is(err, ErrForbidden) {
		t.Fatalf("member add: got %v, want ErrForbidden", err)
	}
	updated, err := e.svc.AddMembers(ctx, tenant, alice.id, conv, []uuid.UUID{carol.id})
	if err != nil {
		t.Fatal(err)
	}
	// A new member starts at the end of the log, so old ticks are not held back.
	if m := memberOf(updated, carol.id); m == nil || m.JoinedSeq != 1 || m.ReadSeq != 1 {
		t.Fatalf("carol membership: %+v", m)
	}

	a.send(2, conv, uuid.New(), "with carol")
	a.next()
	if got := c.next().GetMessage().GetSeq(); got != 2 {
		t.Fatalf("carol got seq %d, want 2", got)
	}
	b.next()

	if err := e.svc.RemoveMember(ctx, tenant, alice.id, conv, carol.id); err != nil {
		t.Fatal(err)
	}
	c.send(3, conv, uuid.New(), "after removal")
	if code := c.next().GetError().GetCode(); code != pulsepb.ErrorCode_ERROR_CODE_FORBIDDEN {
		t.Fatalf("removed member send got %v, want FORBIDDEN", code)
	}
	a.send(4, conv, uuid.New(), "without carol")
	a.next()
	b.next()
	c.quiet()
}

func TestDirectInboxSurvivesOffline(t *testing.T) {
	e := newTestEnv(t)
	tenant := e.tenant()
	alice, bob := e.user(tenant), e.user(tenant)
	a := e.connect(alice)
	bobDevice := e.device(bob)

	a.write(&pulsepb.ClientFrame{ReqId: 1, Body: &pulsepb.ClientFrame_DirectSend{DirectSend: &pulsepb.DirectSend{
		ToDeviceId: bobDevice[:], Payload: []byte("welcome"),
	}}})
	if ack := a.next(); ack.GetReqId() != 1 || ack.GetDirectSendAck().GetId() == 0 {
		t.Fatalf("bad direct send ack: %v", ack)
	}

	b := e.connectDevice(bob, bobDevice)
	d := b.next().GetDirect()
	if !bytes.Equal(d.GetPayload(), []byte("welcome")) || !bytes.Equal(d.GetFromDeviceId(), a.device[:]) {
		t.Fatalf("bad direct: %v", d)
	}
	b.write(&pulsepb.ClientFrame{Body: &pulsepb.ClientFrame_DirectAck{DirectAck: &pulsepb.DirectAck{Ids: []uint64{d.GetId()}}}})
	// Ping/Pong proves the ack was processed before we reconnect.
	b.write(&pulsepb.ClientFrame{ReqId: 9, Body: &pulsepb.ClientFrame_Ping{Ping: &pulsepb.Ping{ClientTs: 1}}})
	if b.next().GetPong() == nil {
		t.Fatal("expected pong")
	}

	// Reconnecting the same device displaces the old socket and finds the inbox empty.
	e.connectDevice(bob, bobDevice).quiet()

	// Key packages are one-time: two per device were published.
	for i, want := range []int{1, 1, 0} {
		claimed, err := e.svc.ClaimKeyPackages(context.Background(), tenant, bob.id)
		if err != nil {
			t.Fatal(err)
		}
		if len(claimed) != want {
			t.Fatalf("claim %d returned %d packages, want %d", i, len(claimed), want)
		}
	}
}

func TestHandshakeEpochOrdering(t *testing.T) {
	e := newTestEnv(t)
	tenant := e.tenant()
	alice, bob := e.user(tenant), e.user(tenant)
	conv := e.conversation(alice, KindGroup, "team", bob)
	a, b := e.connect(alice), e.connect(bob)

	commit := func(c *testConn, reqID uint64, id uuid.UUID, epoch uint64) *pulsepb.ServerFrame {
		c.write(&pulsepb.ClientFrame{ReqId: reqID, Body: &pulsepb.ClientFrame_Send{Send: &pulsepb.Send{
			ConversationId: conv[:], Id: id[:], Kind: pulsepb.MessageKind_MESSAGE_KIND_HANDSHAKE, Ciphertext: []byte("commit"), Epoch: epoch,
		}}})
		return c.next()
	}

	// Two members race to commit epoch 1: exactly one wins.
	winner := uuid.New()
	if ack := commit(a, 1, winner, 1).GetSendAck(); ack.GetSeq() != 1 {
		t.Fatalf("first commit not accepted: %v", ack)
	}
	if env := b.next().GetMessage(); env.GetEpoch() != 1 || env.GetKind() != pulsepb.MessageKind_MESSAGE_KIND_HANDSHAKE {
		t.Fatalf("bad handshake envelope: %v", env)
	}
	if code := commit(b, 2, uuid.New(), 1).GetError().GetCode(); code != pulsepb.ErrorCode_ERROR_CODE_CONFLICT {
		t.Fatalf("racing commit got %v, want CONFLICT", code)
	}
	// Skipping an epoch is refused too, and neither failure consumed a seq.
	if code := commit(b, 3, uuid.New(), 3).GetError().GetCode(); code != pulsepb.ErrorCode_ERROR_CODE_CONFLICT {
		t.Fatalf("epoch skip got %v, want CONFLICT", code)
	}
	// A retry of the accepted commit is a duplicate, not a conflict.
	if ack := commit(a, 4, winner, 1).GetSendAck(); !ack.GetDuplicate() || ack.GetSeq() != 1 {
		t.Fatalf("retried commit: %v", ack)
	}
	if ack := commit(b, 5, uuid.New(), 2).GetSendAck(); ack.GetSeq() != 2 {
		t.Fatalf("next commit seq = %d, want 2", ack.GetSeq())
	}
	a.next()

	c, err := e.svc.GetConversation(context.Background(), tenant, alice.id, conv)
	if err != nil || c.Epoch != 2 || c.LastSeq != 2 {
		t.Fatalf("conversation epoch/seq = %d/%d (%v), want 2/2", c.Epoch, c.LastSeq, err)
	}
}

// fakeStorage stands in for object storage; only the presign calls are used.
type fakeStorage struct{ media.Storage }

func (fakeStorage) EnsurePrivateBucket(context.Context, string) error { return nil }

func (fakeStorage) GetPresignedUpload(_ context.Context, _, object string, _ time.Duration, maxBytes int64) (*media.PresignedUpload, error) {
	return &media.PresignedUpload{URL: "https://storage.test/upload", Fields: map[string]string{"key": object, "max": fmt.Sprint(maxBytes)}}, nil
}

func (fakeStorage) GetPresignedURL(_ context.Context, _, object string, _ time.Duration) (string, error) {
	return "https://storage.test/" + object, nil
}

func TestMediaAccessFollowsMembership(t *testing.T) {
	e := newTestEnv(t)
	ctx := context.Background()
	media.SetDefaultStorage(fakeStorage{})
	t.Cleanup(func() { media.SetDefaultStorage(nil) })

	tenant := e.tenant()
	alice, bob, carol := e.user(tenant), e.user(tenant), e.user(tenant)
	conv := e.conversation(alice, KindDM, "", bob)
	other := e.conversation(alice, KindDM, "", carol)

	up, err := e.svc.MediaUpload(ctx, tenant, alice.id, &MediaUploadRequest{ConversationID: conv, SizeBytes: 1024})
	if err != nil {
		t.Fatal(err)
	}
	if up.Fields["key"] != up.ObjectKey || up.Fields["max"] != fmt.Sprint(MaxMediaBytes) {
		t.Fatalf("upload not bound to its key and size cap: %+v", up)
	}
	if _, err := e.svc.MediaDownload(ctx, tenant, bob.id, &MediaDownloadRequest{ConversationID: conv, ObjectKey: up.ObjectKey}); err != nil {
		t.Fatalf("member download: %v", err)
	}

	var inv *InvalidError
	if _, err := e.svc.MediaUpload(ctx, tenant, alice.id, &MediaUploadRequest{ConversationID: conv, SizeBytes: MaxMediaBytes + 1}); !errors.As(err, &inv) {
		t.Fatalf("oversize upload: got %v, want InvalidError", err)
	}
	// A non-member gets nothing, for upload or download.
	if _, err := e.svc.MediaUpload(ctx, tenant, carol.id, &MediaUploadRequest{ConversationID: conv, SizeBytes: 1}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("outsider upload: got %v, want ErrNotFound", err)
	}
	if _, err := e.svc.MediaDownload(ctx, tenant, carol.id, &MediaDownloadRequest{ConversationID: conv, ObjectKey: up.ObjectKey}); !errors.Is(err, ErrNotFound) {
		t.Fatalf("outsider download: got %v, want ErrNotFound", err)
	}
	// Carol cannot reach the object by naming a conversation she is in.
	for _, key := range []string{up.ObjectKey, mediaPrefix(tenant, other) + "../" + conv.String() + "/x", "hrms/payslips/secret.pdf"} {
		if _, err := e.svc.MediaDownload(ctx, tenant, carol.id, &MediaDownloadRequest{ConversationID: other, ObjectKey: key}); !errors.Is(err, ErrNotFound) {
			t.Fatalf("key %q via another conversation: got %v, want ErrNotFound", key, err)
		}
	}
}

// TestSendLatency reports server-side latency on this machine; it asserts nothing.
func TestSendLatency(t *testing.T) {
	e := newTestEnv(t)
	tenant := e.tenant()
	alice, bob := e.user(tenant), e.user(tenant)
	conv := e.conversation(alice, KindDM, "", bob)
	a, b := e.connect(alice), e.connect(bob)
	payload := string(bytes.Repeat([]byte("x"), 512))

	const n = 50 // within the per-connection send burst
	acks, delivers := make([]time.Duration, 0, n), make([]time.Duration, 0, n)
	for i := 0; i < n; i++ {
		start := time.Now()
		a.send(uint64(i+1), conv, uuid.New(), payload)
		a.next()
		acks = append(acks, time.Since(start))
		b.next()
		delivers = append(delivers, time.Since(start))
	}
	pct := func(d []time.Duration, p float64) time.Duration {
		sort.Slice(d, func(i, j int) bool { return d[i] < d[j] })
		return d[int(float64(len(d)-1)*p)]
	}
	t.Logf("send->ack     p50=%v p95=%v p99=%v", pct(acks, 0.5), pct(acks, 0.95), pct(acks, 0.99))
	t.Logf("send->deliver p50=%v p95=%v p99=%v", pct(delivers, 0.5), pct(delivers, 0.95), pct(delivers, 0.99))
}
