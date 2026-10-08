// Package notify records in-app notifications for users and, when push is configured, wakes their phones.
//
// Domain services call the package-level helpers (ToEmployee, ToApproversOf, ...) after an event has
// been committed. Delivery runs in the background: a failure to notify never fails the action itself.
package notify

import (
	"context"
	"fmt"
	"time"

	"humora-backend/pkg/logger"

	"github.com/google/uuid"
	"github.com/jmoiron/sqlx"
	"github.com/lib/pq"
)

// Categories group notifications in the UI.
const (
	CategoryLeave      = "leave"
	CategoryApproval   = "approval"
	CategoryAttendance = "attendance"
	CategoryPayroll    = "payroll"
	CategoryExpense    = "expense"
	CategoryOnboarding = "onboarding"
	CategoryWork       = "work"
	CategorySystem     = "system"
)

// Message is what a recipient sees.
type Message struct {
	Category   string
	Title      string
	Body       string
	Link       string // web page id, e.g. "approvals"
	EntityType string
	EntityID   *uuid.UUID
}

// Notification is a stored notification as returned by the API.
type Notification struct {
	ID         uuid.UUID  `db:"id" json:"id"`
	Category   string     `db:"category" json:"category"`
	Title      string     `db:"title" json:"title"`
	Body       string     `db:"body" json:"body"`
	Link       *string    `db:"link" json:"link,omitempty"`
	EntityType *string    `db:"entity_type" json:"entity_type,omitempty"`
	EntityID   *uuid.UUID `db:"entity_id" json:"entity_id,omitempty"`
	CreatedAt  time.Time  `db:"created_at" json:"created_at"`
	ReadAt     *time.Time `db:"read_at" json:"read_at,omitempty"`
}

// PushFunc wakes the users' phones that a notification is waiting (no content is sent).
type PushFunc func(userIDs []uuid.UUID)

type service struct {
	db   *sqlx.DB
	push PushFunc
}

var std *service

// Init enables notifications. Until it is called (e.g. in unit tests) the helpers do nothing.
func Init(db *sqlx.DB, push PushFunc) {
	if db != nil {
		std = &service{db: db, push: push}
	}
}

const deliverTimeout = 10 * time.Second

func deliver(desc string, fn func(ctx context.Context, s *service) ([]uuid.UUID, error), tenantID uuid.UUID, m Message) {
	s := std
	if s == nil {
		return
	}
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), deliverTimeout)
		defer cancel()
		users, err := fn(ctx, s)
		if err != nil {
			logger.Warn(fmt.Sprintf("notify (%s): cannot resolve recipients: %v", desc, err))
			return
		}
		if err := s.insert(ctx, tenantID, users, m); err != nil {
			logger.Warn(fmt.Sprintf("notify (%s): %v", desc, err))
		}
	}()
}

// ToUsers notifies specific users.
func ToUsers(tenantID uuid.UUID, userIDs []uuid.UUID, m Message) {
	deliver("users", func(context.Context, *service) ([]uuid.UUID, error) { return userIDs, nil }, tenantID, m)
}

// ToEmployee notifies the user account of an employee (nothing if the employee cannot sign in).
func ToEmployee(tenantID, employeeID uuid.UUID, m Message) {
	deliver("employee", func(ctx context.Context, s *service) ([]uuid.UUID, error) {
		var ids []uuid.UUID
		err := s.db.SelectContext(ctx, &ids, `SELECT user_id FROM hrms_employees WHERE tenant_id = $1 AND id = $2 AND user_id IS NOT NULL`, tenantID, employeeID)
		return ids, err
	}, tenantID, m)
}

// ToApproversOf notifies whoever decides on this employee's requests: their manager if they have one
// who can sign in, otherwise the organisation's admins and HR. The employee never approves themselves.
func ToApproversOf(tenantID, employeeID uuid.UUID, m Message) {
	deliver("approvers", func(ctx context.Context, s *service) ([]uuid.UUID, error) {
		var self *uuid.UUID
		_ = s.db.GetContext(ctx, &self, `SELECT user_id FROM hrms_employees WHERE tenant_id = $1 AND id = $2`, tenantID, employeeID)
		var ids []uuid.UUID
		err := s.db.SelectContext(ctx, &ids, `
			SELECT m.user_id FROM hrms_employees e
			JOIN hrms_employees m ON m.id = e.manager_id
			JOIN users u ON u.id = m.user_id AND u.status = 'active'
			WHERE e.tenant_id = $1 AND e.id = $2`, tenantID, employeeID)
		if err != nil {
			return nil, err
		}
		if len(ids) == 0 {
			if ids, err = s.management(ctx, tenantID); err != nil {
				return nil, err
			}
		}
		return without(ids, self), nil
	}, tenantID, m)
}

// ToManagement notifies the organisation's admins and HR.
func ToManagement(tenantID uuid.UUID, m Message) {
	deliver("management", func(ctx context.Context, s *service) ([]uuid.UUID, error) { return s.management(ctx, tenantID) }, tenantID, m)
}

func (s *service) management(ctx context.Context, tenantID uuid.UUID) ([]uuid.UUID, error) {
	var ids []uuid.UUID
	err := s.db.SelectContext(ctx, &ids, `
		SELECT DISTINCT ur.user_id FROM user_roles ur
		JOIN roles r ON r.id = ur.role_id
		JOIN users u ON u.id = ur.user_id AND u.status = 'active'
		WHERE r.tenant_id = $1 AND r.name IN ('superadmin', 'admin', 'hr_admin')`, tenantID)
	return ids, err
}

func without(ids []uuid.UUID, self *uuid.UUID) []uuid.UUID {
	if self == nil {
		return ids
	}
	out := ids[:0]
	for _, id := range ids {
		if id != *self {
			out = append(out, id)
		}
	}
	return out
}

func (s *service) insert(ctx context.Context, tenantID uuid.UUID, users []uuid.UUID, m Message) error {
	if len(users) == 0 {
		return nil
	}
	var link, etype *string
	if m.Link != "" {
		link = &m.Link
	}
	if m.EntityType != "" {
		etype = &m.EntityType
	}
	// One statement for all recipients; only users of this tenant can receive it.
	_, err := s.db.ExecContext(ctx, `
		INSERT INTO notifications (tenant_id, user_id, category, title, body, link, entity_type, entity_id)
		SELECT $1, u.id, $3, $4, $5, $6, $7, $8 FROM users u WHERE u.tenant_id = $1 AND u.id = ANY($2)`,
		tenantID, pq.Array(users), m.Category, m.Title, m.Body, link, etype, m.EntityID)
	if err != nil {
		return fmt.Errorf("insert notifications: %w", err)
	}
	if s.push != nil {
		s.push(users)
	}
	return nil
}
