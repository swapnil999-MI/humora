package pulse

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sync"
	"time"

	"humora-backend/internal/pulse/pulsepb"
	"humora-backend/pkg/logger"

	"github.com/gofiber/contrib/websocket"
	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
)

const (
	// Media travels through object storage, so message frames stay small.
	maxCiphertextBytes = 64 << 10
	maxFrameBytes      = maxCiphertextBytes + 1024
	maxDirectBytes     = 64 << 10

	sendQueueSize = 256
	writeTimeout  = 10 * time.Second
	pingInterval  = 25 * time.Second
	readTimeout   = 60 * time.Second
	dbTimeout     = 5 * time.Second

	defaultSyncLimit = 100
	maxSyncLimit     = 500
	inboxBatch       = 200

	// Per-connection message rate: sustained 20/s with bursts of 60.
	sendRate  = 20.0
	sendBurst = 60.0
)

const sessionLocalKey = "pulse_session"

// client is one live WebSocket. The read loop handles requests, except receipts,
// which the receipt worker (markLoop) records; the write loop is the only
// goroutine that writes to the socket.
type client struct {
	hub  *Hub
	conn *websocket.Conn
	sess session

	send      chan []byte
	done      chan struct{}
	closeOnce sync.Once

	limiter bucket

	// Receipts wait here for the receipt worker, so a message send never queues behind a
	// receipt's database write. Newer receipts for the same conversation replace older ones.
	marksMu sync.Mutex
	marks   map[string]*pendingMarks
	marksIn chan struct{}
}

type pendingMarks struct {
	conversationID []byte
	delivered      uint64
	read           uint64
}

// maxPendingMarks bounds the receipts one connection can have waiting.
const maxPendingMarks = 1024

// bucket is a token bucket used only from the read loop.
type bucket struct {
	tokens float64
	last   time.Time
}

func (b *bucket) allow(now time.Time) bool {
	if b.last.IsZero() {
		b.tokens = sendBurst
	} else {
		b.tokens = math.Min(sendBurst, b.tokens+now.Sub(b.last).Seconds()*sendRate)
	}
	b.last = now
	if b.tokens < 1 {
		return false
	}
	b.tokens--
	return true
}

func (c *client) close() {
	c.closeOnce.Do(func() { close(c.done) })
}

// enqueue never blocks: a connection that cannot keep up is dropped and will
// catch up through Sync when it reconnects.
func (c *client) enqueue(frame []byte) {
	select {
	case c.send <- frame:
	case <-c.done:
	default:
		c.close()
	}
}

func (c *client) reply(reqID uint64, f *pulsepb.ServerFrame) {
	f.ReqId = reqID
	b, err := proto.Marshal(f)
	if err != nil {
		return
	}
	c.enqueue(b)
}

func (c *client) fail(reqID uint64, code pulsepb.ErrorCode, msg string) {
	c.reply(reqID, &pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_Error{Error: &pulsepb.Error{Code: code, Message: msg}}})
}

func (c *client) failErr(reqID uint64, err error) {
	switch {
	case errors.Is(err, ErrForbidden), errors.Is(err, ErrNotFound):
		// Same answer for "no such conversation" and "not a member".
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_FORBIDDEN, "not permitted")
	case errors.Is(err, ErrConflict):
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_CONFLICT, "epoch conflict")
	default:
		logger.Error(fmt.Sprintf("[Pulse] gateway request failed: %v", err))
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_INTERNAL, "internal error")
	}
}

// Serve runs one gateway connection until it closes.
func (h *Hub) Serve(conn *websocket.Conn) {
	sess, ok := conn.Locals(sessionLocalKey).(session)
	if !ok {
		return
	}
	c := &client{
		hub:     h,
		conn:    conn,
		sess:    sess,
		send:    make(chan []byte, sendQueueSize),
		done:    make(chan struct{}),
		marks:   make(map[string]*pendingMarks),
		marksIn: make(chan struct{}, 1),
	}
	h.register(c)
	go c.markLoop()

	writerDone := make(chan struct{})
	go func() {
		c.writeLoop()
		close(writerDone)
	}()

	c.onConnect()
	c.readLoop()

	c.close()
	h.unregister(c)
	// The connection object is recycled once Serve returns; the writer must be gone first.
	<-writerDone
}

func (c *client) writeLoop() {
	ping := time.NewTicker(pingInterval)
	defer ping.Stop()
	defer c.conn.Close()

	for {
		select {
		case frame := <-c.send:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := c.conn.WriteMessage(websocket.BinaryMessage, frame); err != nil {
				c.close()
				return
			}
		case <-ping.C:
			_ = c.conn.SetWriteDeadline(time.Now().Add(writeTimeout))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				c.close()
				return
			}
		case <-c.done:
			return
		}
	}
}

func (c *client) readLoop() {
	c.conn.SetReadLimit(maxFrameBytes)
	_ = c.conn.SetReadDeadline(time.Now().Add(readTimeout))
	c.conn.SetPongHandler(func(string) error {
		return c.conn.SetReadDeadline(time.Now().Add(readTimeout))
	})

	for {
		mt, data, err := c.conn.ReadMessage()
		if err != nil {
			return
		}
		_ = c.conn.SetReadDeadline(time.Now().Add(readTimeout))
		if mt != websocket.BinaryMessage {
			continue
		}

		var f pulsepb.ClientFrame
		if err := proto.Unmarshal(data, &f); err != nil {
			c.fail(0, pulsepb.ErrorCode_ERROR_CODE_BAD_REQUEST, "malformed frame")
			continue
		}
		c.dispatch(&f)

		select {
		case <-c.done:
			return
		default:
		}
	}
}

func (c *client) dispatch(f *pulsepb.ClientFrame) {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	switch body := f.Body.(type) {
	case *pulsepb.ClientFrame_Send:
		c.handleSend(ctx, f.ReqId, body.Send)
	case *pulsepb.ClientFrame_Delivered:
		c.queueWatermark(ctx, f.ReqId, body.Delivered, false)
	case *pulsepb.ClientFrame_Read:
		c.queueWatermark(ctx, f.ReqId, body.Read, true)
	case *pulsepb.ClientFrame_Typing:
		c.handleTyping(ctx, body.Typing)
	case *pulsepb.ClientFrame_Sync:
		c.handleSync(ctx, f.ReqId, body.Sync)
	case *pulsepb.ClientFrame_Ping:
		c.reply(f.ReqId, &pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_Pong{Pong: &pulsepb.Pong{
			ClientTs: body.Ping.GetClientTs(),
			ServerTs: time.Now().UnixMilli(),
		}}})
	case *pulsepb.ClientFrame_DirectSend:
		c.handleDirectSend(ctx, f.ReqId, body.DirectSend)
	case *pulsepb.ClientFrame_DirectAck:
		if ids := body.DirectAck.GetIds(); len(ids) > 0 && len(ids) <= inboxBatch {
			signed := make([]int64, len(ids))
			for i, id := range ids {
				signed[i] = clampSeq(id)
			}
			if err := c.hub.repo.AckDirect(ctx, c.sess.DeviceID, signed); err != nil {
				logger.Warn(fmt.Sprintf("[Pulse] inbox ack failed: %v", err))
			} else if len(ids) == inboxBatch {
				// A full batch was cleared; more may be waiting behind it.
				c.flushInbox(ctx)
			}
		}
	default:
		c.fail(f.ReqId, pulsepb.ErrorCode_ERROR_CODE_BAD_REQUEST, "unknown frame")
	}
}

// memberRoute resolves the conversation and confirms the caller may use it.
func (c *client) memberRoute(ctx context.Context, rawID []byte) (uuid.UUID, *convRoute, error) {
	convID, err := uuid.FromBytes(rawID)
	if err != nil {
		return uuid.Nil, nil, ErrForbidden
	}
	route, err := c.hub.route(ctx, convID)
	if err != nil {
		return uuid.Nil, nil, err
	}
	if route.tenantID != c.sess.TenantID || !route.has(c.sess.UserID) {
		return uuid.Nil, nil, ErrForbidden
	}
	return convID, route, nil
}

func clampSeq(seq uint64) int64 {
	if seq > math.MaxInt64 {
		return math.MaxInt64
	}
	return int64(seq)
}

func (c *client) handleSend(ctx context.Context, reqID uint64, s *pulsepb.Send) {
	if !c.limiter.allow(time.Now()) {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_RATE_LIMITED, "slow down")
		return
	}
	msgID, err := uuid.FromBytes(s.GetId())
	if err != nil || msgID == uuid.Nil {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_BAD_REQUEST, "invalid message id")
		return
	}
	if s.GetKind() != pulsepb.MessageKind_MESSAGE_KIND_APPLICATION && s.GetKind() != pulsepb.MessageKind_MESSAGE_KIND_HANDSHAKE {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_BAD_REQUEST, "invalid message kind")
		return
	}
	handshake := s.GetKind() == pulsepb.MessageKind_MESSAGE_KIND_HANDSHAKE
	if handshake && s.GetEpoch() == 0 {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_BAD_REQUEST, "handshake needs an epoch")
		return
	}
	if len(s.GetCiphertext()) == 0 {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_BAD_REQUEST, "empty message")
		return
	}
	if len(s.GetCiphertext()) > maxCiphertextBytes {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_TOO_LARGE, "message too large")
		return
	}
	convID, route, err := c.memberRoute(ctx, s.GetConversationId())
	if err != nil {
		c.failErr(reqID, err)
		return
	}

	msg := &StoredMessage{
		ID:             msgID,
		SenderID:       c.sess.UserID,
		SenderDeviceID: c.sess.DeviceID,
		Kind:           int16(s.GetKind()),
		Epoch:          clampSeq(s.GetEpoch()),
		Ciphertext:     s.GetCiphertext(),
	}
	duplicate, err := c.hub.repo.InsertMessage(ctx, convID, msg, handshake)
	if err != nil {
		c.failErr(reqID, err)
		return
	}
	serverTs := msg.CreatedAt.UnixMilli()

	// Stored: single tick for the sender.
	c.reply(reqID, &pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_SendAck{SendAck: &pulsepb.SendAck{
		ConversationId: convID[:],
		Id:             msgID[:],
		Seq:            uint64(msg.Seq),
		ServerTs:       serverTs,
		Duplicate:      duplicate,
	}}})
	if duplicate {
		return
	}

	frame, err := proto.Marshal(&pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_Message{Message: &pulsepb.Envelope{
		ConversationId: convID[:],
		Seq:            uint64(msg.Seq),
		Id:             msgID[:],
		SenderId:       c.sess.UserID[:],
		SenderDeviceId: c.sess.DeviceID[:],
		Kind:           s.GetKind(),
		Ciphertext:     s.GetCiphertext(),
		ServerTs:       serverTs,
		Epoch:          uint64(msg.Epoch),
	}}})
	if err != nil {
		return
	}
	c.hub.fanout(route.members, frame, c)
	if pulsepb.MessageKind(s.GetKind()) == pulsepb.MessageKind_MESSAGE_KIND_APPLICATION {
		c.hub.pusher.MessageStored(convID, route.members, c.sess.DeviceID)
	}
}

// queueWatermark hands a receipt to the receipt worker. A receipt sent as a request (with a
// req_id) is answered inline instead, so its reply keeps its meaning.
func (c *client) queueWatermark(ctx context.Context, reqID uint64, w *pulsepb.Watermark, read bool) {
	if reqID != 0 {
		c.handleWatermark(ctx, reqID, w, read)
		return
	}
	key := string(w.GetConversationId())
	c.marksMu.Lock()
	m := c.marks[key]
	if m == nil {
		if len(c.marks) >= maxPendingMarks {
			c.marksMu.Unlock()
			return // the client repeats its position with its next receipt
		}
		m = &pendingMarks{conversationID: w.GetConversationId()}
		c.marks[key] = m
	}
	if read {
		m.read = max(m.read, w.GetSeq())
	} else {
		m.delivered = max(m.delivered, w.GetSeq())
	}
	c.marksMu.Unlock()
	select {
	case c.marksIn <- struct{}{}:
	default: // the worker is already due to run
	}
}

// markLoop records queued receipts until the connection closes.
func (c *client) markLoop() {
	for {
		select {
		case <-c.done:
			return
		case <-c.marksIn:
		}
		c.marksMu.Lock()
		batch := c.marks
		c.marks = make(map[string]*pendingMarks, len(batch))
		c.marksMu.Unlock()
		for _, m := range batch {
			ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
			// A read position is also a delivered position, so one write covers both when it can.
			if m.read > 0 {
				c.handleWatermark(ctx, 0, &pulsepb.Watermark{ConversationId: m.conversationID, Seq: m.read}, true)
			}
			if m.delivered > m.read {
				c.handleWatermark(ctx, 0, &pulsepb.Watermark{ConversationId: m.conversationID, Seq: m.delivered}, false)
			}
			cancel()
		}
	}
}

// handleWatermark records a delivered or read receipt and tells the people
// who are waiting on it.
func (c *client) handleWatermark(ctx context.Context, reqID uint64, w *pulsepb.Watermark, read bool) {
	convID, route, err := c.memberRoute(ctx, w.GetConversationId())
	if err != nil {
		c.failErr(reqID, err)
		return
	}
	delivered, readSeq, changed, err := c.hub.repo.AdvanceWatermark(ctx, convID, c.sess.UserID, clampSeq(w.GetSeq()), read)
	if err != nil {
		c.failErr(reqID, err)
		return
	}
	if !changed {
		return
	}

	frame, err := proto.Marshal(&pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_Receipt{Receipt: &pulsepb.Receipt{
		ConversationId: convID[:],
		UserId:         c.sess.UserID[:],
		DeliveredSeq:   uint64(delivered),
		ReadSeq:        uint64(readSeq),
	}}})
	if err != nil {
		return
	}
	// Channels can be large, so per-member receipts are not broadcast there;
	// they only sync the reader's own devices. DMs and groups get live ticks.
	targets := route.members
	if route.kind == KindChannel {
		targets = []uuid.UUID{c.sess.UserID}
	}
	c.hub.fanout(targets, frame, c)
}

func (c *client) handleTyping(ctx context.Context, t *pulsepb.Typing) {
	convID, route, err := c.memberRoute(ctx, t.GetConversationId())
	if err != nil {
		return
	}
	frame, err := proto.Marshal(&pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_Typing{Typing: &pulsepb.TypingEvent{
		ConversationId: convID[:],
		UserId:         c.sess.UserID[:],
		Active:         t.GetActive(),
	}}})
	if err != nil {
		return
	}
	c.hub.fanout(route.members, frame, c)
}

func (c *client) handleSync(ctx context.Context, reqID uint64, s *pulsepb.Sync) {
	convID, _, err := c.memberRoute(ctx, s.GetConversationId())
	if err != nil {
		c.failErr(reqID, err)
		return
	}
	limit := int(s.GetLimit())
	if limit <= 0 {
		limit = defaultSyncLimit
	}
	if limit > maxSyncLimit {
		limit = maxSyncLimit
	}

	msgs, hasMore, err := c.hub.repo.ListMessages(ctx, convID, clampSeq(s.GetAfterSeq()), clampSeq(s.GetBeforeSeq()), limit)
	if err != nil {
		c.failErr(reqID, err)
		return
	}
	batch := &pulsepb.SyncBatch{ConversationId: convID[:], HasMore: hasMore, Messages: make([]*pulsepb.Envelope, len(msgs))}
	for i := range msgs {
		m := &msgs[i]
		batch.Messages[i] = &pulsepb.Envelope{
			ConversationId: convID[:],
			Seq:            uint64(m.Seq),
			Id:             m.ID[:],
			SenderId:       m.SenderID[:],
			SenderDeviceId: m.SenderDeviceID[:],
			Kind:           pulsepb.MessageKind(m.Kind),
			Ciphertext:     m.Ciphertext,
			ServerTs:       m.CreatedAt.UnixMilli(),
			Epoch:          uint64(m.Epoch),
		}
	}
	c.reply(reqID, &pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_SyncBatch{SyncBatch: batch}})
}

func directFrame(d *DirectMessage) ([]byte, error) {
	out := &pulsepb.Direct{
		Id:           uint64(d.ID),
		FromUserId:   d.FromUserID[:],
		FromDeviceId: d.FromDeviceID[:],
		Payload:      d.Payload,
		ServerTs:     d.CreatedAt.UnixMilli(),
	}
	if d.ConversationID != nil {
		out.ConversationId = d.ConversationID[:]
	}
	return proto.Marshal(&pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_Direct{Direct: out}})
}

func (c *client) handleDirectSend(ctx context.Context, reqID uint64, d *pulsepb.DirectSend) {
	if !c.limiter.allow(time.Now()) {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_RATE_LIMITED, "slow down")
		return
	}
	toDevice, err := uuid.FromBytes(d.GetToDeviceId())
	if err != nil {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_BAD_REQUEST, "invalid device id")
		return
	}
	if len(d.GetPayload()) == 0 || len(d.GetPayload()) > maxDirectBytes {
		c.fail(reqID, pulsepb.ErrorCode_ERROR_CODE_TOO_LARGE, "invalid payload size")
		return
	}

	msg := &DirectMessage{FromUserID: c.sess.UserID, FromDeviceID: c.sess.DeviceID, Payload: d.GetPayload()}
	if len(d.GetConversationId()) > 0 {
		// A conversation context is only accepted from one of its members.
		convID, _, err := c.memberRoute(ctx, d.GetConversationId())
		if err != nil {
			c.failErr(reqID, err)
			return
		}
		msg.ConversationID = &convID
	}

	// Tenant-scoped lookup: a device in another tenant is indistinguishable from a missing one.
	toUser, err := c.hub.repo.DeviceOwner(ctx, c.sess.TenantID, toDevice)
	if err != nil {
		c.failErr(reqID, err)
		return
	}
	if err := c.hub.repo.InsertDirect(ctx, toDevice, msg); err != nil {
		c.failErr(reqID, err)
		return
	}
	c.reply(reqID, &pulsepb.ServerFrame{Body: &pulsepb.ServerFrame_DirectSendAck{DirectSendAck: &pulsepb.DirectSendAck{Id: uint64(msg.ID)}}})
	if frame, err := directFrame(msg); err == nil {
		c.hub.toDevice(toUser, toDevice, frame)
	}
	var convID uuid.UUID
	if msg.ConversationID != nil {
		convID = *msg.ConversationID
	}
	c.hub.pusher.DirectQueued(toUser, toDevice, convID)
}

// onConnect flushes payloads queued for this device while it was offline.
func (c *client) onConnect() {
	ctx, cancel := context.WithTimeout(context.Background(), dbTimeout)
	defer cancel()

	if err := c.hub.repo.TouchDevice(ctx, c.sess.DeviceID); err != nil {
		logger.Warn(fmt.Sprintf("[Pulse] device touch failed: %v", err))
	}
	c.flushInbox(ctx)
}

func (c *client) flushInbox(ctx context.Context) {
	pending, err := c.hub.repo.ListDirect(ctx, c.sess.DeviceID, inboxBatch)
	if err != nil {
		logger.Warn(fmt.Sprintf("[Pulse] inbox load failed: %v", err))
		return
	}
	for i := range pending {
		if frame, err := directFrame(&pending[i]); err == nil {
			c.enqueue(frame)
		}
	}
}
