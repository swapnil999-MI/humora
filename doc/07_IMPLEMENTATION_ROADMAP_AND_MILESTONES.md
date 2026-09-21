# 07. Implementation Roadmap & Milestones

This document details the phased rollout for the **Humora** enterprise platform, covering the Go Backend, PostgreSQL migrations, React Web Application, and Native Mobile Apps.

---

## Phased Implementation Roadmap

```
Phase 1: Foundation, Multi-Tenant Auth & Database Core
    ├── PostgreSQL Migrations (Tenants, Users, Roles, Audit Ledger)
    ├── Go Backend Scaffold (Chi, sqlx, pgx, Argon2id, JWT)
    └── Base Seed Data & Multi-Tenant RLS Setup
Phase 2: Core HRMS (Zoho People Engine)
    ├── Employee Directory, Dynamic Custom Profile Fields, Org Tree
    ├── Geofenced Attendance (Polygon, Haversine, Anti-Spoof, Offline Ed25519)
    ├── Shift Rostering & Peer-to-Peer Shift Swaps
    ├── Leave Policy Engine, Sandwich Rules & Multi-Tier Approvals
    └── Timesheets & Project Cost Centers
Phase 3: Work Management (Jira Engine)
    ├── Projects, Epics, Stories, Bugs, Sub-tasks (Issue Keys HUM-101)
    ├── Custom Dynamic Workflow Engine (Finite State Machine + Guard Validators)
    ├── Dynamic Custom Fields System (JSONB + Generated Virtual Columns)
    └── Agile Boards: Backlog Grooming, Sprint Management, Kanban WIP Limits
Phase 4: The "Unified Synergy" & Deterministic Automation Engine
    ├── Deterministic Sprint Capacity Engine (Auto-deducts HR leaves & shifts)
    ├── Atomic Time Tracking (Jira worklogs auto-fill HR payroll timesheets)
    ├── Shift-Aware On-Call Ticket Routing
    ├── Google CEL Rule Engine for Event Automations & SLA Escalations
    └── Real-Time WebSocket Hub (Live card movements, Presence badges)
Phase 5: React 19 Web Application
    ├── Design System: 2026 aesthetics (Dark/Light high-density, Glassmorphism)
    ├── Unified Workspace Shell (Toggle between HRMS and Jira Workspaces)
    ├── Interactive Drag-and-Drop Kanban & Scrum Boards (@dnd-kit/core)
    ├── Interactive Canvas/SVG Zoomable Org Chart & Shift Roster Planner
    └── Attendance Check-In Widget with Live Stopwatch
Phase 6: Native Mobile Applications
    ├── Android (Kotlin + Jetpack Compose + Room + Keystore Ed25519 Punch)
    ├── iOS (Swift 6 + SwiftUI + SwiftData + Secure Enclave Punch)
    └── Mobile "My Work" Dashboard (Check-in, Assigned Tickets, Live Timers)
```

---

## Milestone Breakdown & Deliverables

### Milestone 1: Core Foundation & Data Layer
- **Target**: Fully functional Go backend server with PostgreSQL connection pool, migration runner, and authentication.
- **Deliverables**:
  - `backend/cmd/api/main.go`
  - `backend/migrations/*.sql` (Complete schema for Tenants, Users, HRMS, Jira, Audit)
  - `backend/internal/auth/` (Login, Register, JWT, RLS middleware)
  - `backend/pkg/db/` (`sqlx` connection helper with health checks)

### Milestone 2: Zoho People HRMS Engine
- **Target**: Complete HR operations API.
- **Deliverables**:
  - `backend/internal/hrms/employees/` (CRUD, Org chart tree builder, dynamic profile fields)
  - `backend/internal/hrms/attendance/` (Geofence validation, punch in/out, offline signature verification)
  - `backend/internal/hrms/shifts/` (Rosters, auto-rotation, shift swap requests)
  - `backend/internal/hrms/leaves/` (Accrual engine, sandwich rule detector, approval workflow)
  - `backend/internal/hrms/timesheets/` (Timesheet entries, weekly lockouts)

### Milestone 3: Jira Work Management Engine
- **Target**: Complete Jira-grade project and issue tracking API.
- **Deliverables**:
  - `backend/internal/jira/projects/` (Project setup, keys, lead assignment)
  - `backend/internal/jira/workflows/` (FSM transitions, guard conditions, validators)
  - `backend/internal/jira/issues/` (Issue lifecycle, custom fields, comments, attachments)
  - `backend/internal/jira/sprints/` (Sprint creation, backlog ordering)
  - `backend/internal/jira/worklogs/` (Task stopwatches, estimates vs actuals)

### Milestone 4: Native Cross-Domain Integrations & WebSockets
- **Target**: Sub-millisecond cross-domain operations and live real-time sync.
- **Deliverables**:
  - `backend/internal/integration/capacity/` (Sprint capacity computed from HR leaves)
  - `backend/internal/integration/worklog_sync/` (Atomic dual-insert to Jira & HR)
  - `backend/internal/realtime/` (WebSocket hub, presence broadcast, card animations)
  - `backend/internal/automation/` (Google CEL rule evaluator, SLA tickers)

### Milestone 5: React 19 Web Application
- **Target**: Production-grade web interface.
- **Deliverables**:
  - `web/src/components/` (Design system, buttons, dialogs, drawers, data grids)
  - `web/src/modules/hrms/` (Attendance widget, leave application, org chart)
  - `web/src/modules/jira/` (Drag-and-drop Kanban, Scrum backlog, sprint active board)
  - `web/src/api/` (TanStack Query hooks, WebSocket client)

### Milestone 6: Native Mobile Applications
- **Target**: Production-grade Android and iOS apps.
- **Deliverables**:
  - `mobile-android/` (Jetpack Compose UI, Room offline cache, Keystore punch signer)
  - `mobile-ios/` (SwiftUI, SwiftData offline cache, Secure Enclave punch signer)

---

## Quality Assurance & Verification Criteria
- **Zero-Allocation HTTP Handlers**: Hot API endpoints must complete with $< 15\text{ms}$ p99 latency.
- **100% Deterministic Testing**:
  - Unit test suite for sandwich leave calculations covering all edge cases (mid-week holidays, multiple leaves).
  - Haversine and polygon geofence test suite with known boundary coordinates.
  - Cryptographic audit chain verification tests verifying that altering any row invalidates the SHA-256 chain.
  - Multi-tenant isolation tests verifying that Tenant A cannot query Tenant B's data under any condition.
