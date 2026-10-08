package pulse

import (
	"context"
	"sync"

	"humora-backend/internal/pulse/pulsepb"

	"github.com/google/uuid"
	"google.golang.org/protobuf/proto"
)

// convRoute is an immutable snapshot of who a conversation fans out to.
type convRoute struct {
	tenantID uuid.UUID
	kind     string
	members  []uuid.UUID
	set      map[uuid.UUID]struct{}
}

func (r *convRoute) has(userID uuid.UUID) bool {
	_, ok := r.set[userID]
	return ok
}

// Hub tracks live connections and routes frames between them. Membership is
// cached in memory so the send path authorizes without a database read.
//
// The hub is per-process: with more than one gateway node, fanout and cache
// invalidation must additionally be relayed between nodes.
type Hub struct {
	repo   *Repository
	pusher *Pusher // optional; wakes devices that are not connected

	mu    sync.RWMutex
	users map[uuid.UUID]map[*client]struct{}

	routeMu  sync.RWMutex
	routes   map[uuid.UUID]*convRoute
	routeGen uint64
}

func NewHub(repo *Repository) *Hub {
	return &Hub{
		repo:   repo,
		users:  make(map[uuid.UUID]map[*client]struct{}),
		routes: make(map[uuid.UUID]*convRoute),
	}
}

// register adds the connection and displaces any older one from the same device.
func (h *Hub) register(c *client) {
	h.mu.Lock()
	conns := h.users[c.sess.UserID]
	if conns == nil {
		conns = make(map[*client]struct{})
		h.users[c.sess.UserID] = conns
	}
	for old := range conns {
		if old.sess.DeviceID == c.sess.DeviceID {
			old.close()
		}
	}
	conns[c] = struct{}{}
	h.mu.Unlock()
}

func (h *Hub) unregister(c *client) {
	h.mu.Lock()
	if conns := h.users[c.sess.UserID]; conns != nil {
		delete(conns, c)
		if len(conns) == 0 {
			delete(h.users, c.sess.UserID)
		}
	}
	h.mu.Unlock()
}

// route returns the cached routing snapshot, loading it on a miss.
func (h *Hub) route(ctx context.Context, conversationID uuid.UUID) (*convRoute, error) {
	h.routeMu.RLock()
	r := h.routes[conversationID]
	gen := h.routeGen
	h.routeMu.RUnlock()
	if r != nil {
		return r, nil
	}

	tenantID, kind, members, err := h.repo.ConversationRouting(ctx, conversationID)
	if err != nil {
		return nil, err
	}
	r = &convRoute{tenantID: tenantID, kind: kind, members: members, set: make(map[uuid.UUID]struct{}, len(members))}
	for _, m := range members {
		r.set[m] = struct{}{}
	}

	// Skip caching if membership changed while we were loading: the snapshot may be stale.
	h.routeMu.Lock()
	if h.routeGen == gen {
		h.routes[conversationID] = r
	}
	h.routeMu.Unlock()
	return r, nil
}

// invalidate drops the cached membership after it changes.
func (h *Hub) invalidate(conversationID uuid.UUID) {
	h.routeMu.Lock()
	delete(h.routes, conversationID)
	h.routeGen++
	h.routeMu.Unlock()
}

// fanout queues one already-encoded frame to every live connection of the
// given users, except skip.
func (h *Hub) fanout(userIDs []uuid.UUID, frame []byte, skip *client) {
	h.mu.RLock()
	for _, u := range userIDs {
		for c := range h.users[u] {
			if c != skip {
				c.enqueue(frame)
			}
		}
	}
	h.mu.RUnlock()
}

// SetPusher enables push for devices that are offline when something arrives for them.
func (h *Hub) SetPusher(p *Pusher) { h.pusher = p }

// Pusher returns the configured pusher, or nil when push is off.
func (h *Hub) Pusher() *Pusher { return h.pusher }

// deviceConnected reports whether this device has a live gateway connection on this node.
func (h *Hub) deviceConnected(userID, deviceID uuid.UUID) bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	for c := range h.users[userID] {
		if c.sess.DeviceID == deviceID {
			return true
		}
	}
	return false
}

// toDevice queues a frame to one specific device if it is connected.
func (h *Hub) toDevice(userID, deviceID uuid.UUID, frame []byte) {
	h.mu.RLock()
	for c := range h.users[userID] {
		if c.sess.DeviceID == deviceID {
			c.enqueue(frame)
		}
	}
	h.mu.RUnlock()
}

// disconnectDevice closes any live connection of a revoked device.
func (h *Hub) disconnectDevice(userID, deviceID uuid.UUID) {
	h.mu.RLock()
	for c := range h.users[userID] {
		if c.sess.DeviceID == deviceID {
			c.close()
		}
	}
	h.mu.RUnlock()
}

// notifyChanged tells the given users' clients to refetch a conversation.
func (h *Hub) notifyChanged(conversationID uuid.UUID, userIDs []uuid.UUID) {
	frame, err := proto.Marshal(&pulsepb.ServerFrame{
		Body: &pulsepb.ServerFrame_ConversationChanged{
			ConversationChanged: &pulsepb.ConversationChanged{ConversationId: conversationID[:]},
		},
	})
	if err != nil {
		return
	}
	h.fanout(userIDs, frame, nil)
}
