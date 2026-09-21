# 02. System Architecture & Technology Stack

## High-Level Architecture Diagram

```
                                  CLIENT ECOSYSTEM
      ┌─────────────────────────────────┬─────────────────────────────────┐
      │  React 19 Web Application       │  Native Mobile Applications     │
      │  - Vite + TypeScript            │  - Android: Kotlin + Compose    │
      │  - TanStack Query + Zustand     │  - iOS: Swift 6 + SwiftUI       │
      │  - @dnd-kit/core for Kanban     │  - Keystore / Secure Enclave    │
      │  - Dynamic Form & Org Canvas    │  - Offline Monotonic Sync       │
      └────────────────┬────────────────┴────────────────┬────────────────┘
                       │ HTTPS / WSS                     │ HTTPS / WSS
                       └────────────────┬────────────────┘
                                        │
                                        ▼
      ┌───────────────────────────────────────────────────────────────────┐
      │             Edge / Reverse Proxy (Traefik / Nginx)                │
      │   - TLS 1.3 Termination, WAF, Rate Limiting & Static Assets       │
      └─────────────────────────────────┬─────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           Go Backend Service (Golang 1.23+)                     │
│                                                                                 │
│   ┌────────────────────────┐  ┌─────────────────────────┐  ┌────────────────┐   │
│   │   Chi HTTP Router      │  │  WebSocket Hub Manager  │  │ Google CEL     │   │
│   │   - Zero Allocation    │  │  - Pub/Sub Room Engine  │  │ Rule Engine    │   │
│   │   - Middleware Stack   │  │  - Realtime Presence    │  │ - Automations  │   │
│   └───────────┬────────────┘  └────────────┬────────────┘  └───────┬────────┘   │
│               │                            │                       │            │
│   ┌───────────┴────────────────────────────┴───────────────────────┴────────┐   │
│   │                       Domain Business Logic Services                    │   │
│   │                                                                         │   │
│   │  [ HRMS COMPLETE DOMAIN (ZOHO PEOPLE) ]                                 │   │
│   │  • Employee Database, Custom Forms & Subforms, Bi-temporal Dating       │   │
│   │  • Interactive Canvas Org Chart (Matrix & Direct reporting)             │   │
│   │  • Geofence, Wi-Fi BSSID & Hardware Biometric ADMS Attendance           │   │
│   │  • Cryptographic Offline Punch Verification (Ed25519)                   │   │
│   │  • Shift Roster, Auto-Rotation & Peer-to-Peer Shift Swaps               │   │
│   │  • Leave Policy Engine, Sandwich Rules, Comp-Offs & Multi-Tier Approvals│   │
│   │  • Timesheets, Weekly Lockouts & Client Cost Center Tracking            │   │
│   │  • Objective Performance Reviews (Cascading OKRs, 360, 9-Box Grid)      │   │
│   │  • Onboarding Checklists, Asset Custody & Dynamic HR Letter Generator   │   │
│   │  • Exit Management, Multi-Dept NOC Clearance & F&F Settlement Sheet     │   │
│   │  • Travel & Multi-Currency Expense Desk with Receipt Hash Auditing      │   │
│   │  • Internal Employee HR Helpdesk & SLA-Driven Case Ticketing            │   │
│   │  • Compensation CTC Slabs, Loss of Pay (LOP) & Bank NEFT/RTGS Exports   │   │
│   │                                                                         │   │
│   │  [ JIRA WORK MANAGEMENT DOMAIN ]                                        │   │
│   │  • Projects, Epics, Stories, Bugs & Sub-Tasks (Keys: HUM-101)           │   │
│   │  • Finite State Machine Workflows (Guard Conditions, Validators)        │   │
│   │  • Dynamic Custom Fields & Formula Calculation Engine (JSONB)           │   │
│   │  • Interactive Scrum (Backlog, Sprints) & Kanban Boards (WIP Limits)    │   │
│   │  • Service Management Business-Hour SLA Timers & Escalations            │   │
│   │  • Burndown, Velocity & Cumulative Flow Diagrams                        │   │
│   │                                                                         │   │
│   │  [ UNIFIED CROSS-DOMAIN ORCHESTRATOR ]                                  │   │
│   │  • Dynamic Sprint Capacity Calculator (HR Shifts/Leaves -> Jira)        │   │
│   │  • Atomic Worklog & Timesheet Ledger (Single ACID Transaction)          │   │
│   │  • Shift-Aware Ticket Routing & Live Attendance Board Presence          │   │
│   │  • Real-Time Project Labor P&L (Employee CTC Cost * Jira Hours)         │   │
│   └────────────────────────────────────┬────────────────────────────────────┘   │
│                                        │                                        │
│                           ┌────────────┴────────────┐                           │
│                           │   Data Access (sqlx)    │                           │
│                           └────────────┬────────────┘                           │
└────────────────────────────────────────┼────────────────────────────────────────┘
                                         │
                                         ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              PostgreSQL 16+ Database                            │
│  - Multi-Tenant Row Level Security (RLS) via `tenant_id`                        │
│  - Structured Relational Integrity (Foreign keys, cascade rules, checks)        │
│  - JSONB with GIN and generated virtual column indexes for custom fields        │
│  - PostGIS / Native Earthdistance for geofenced office boundaries               │
│  - Cryptographic Append-Only Hash-Chained Audit Log                             │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Stack Specifications

### 1. Backend Service (Go)
- **Language**: Go 1.23+
- **HTTP Routing**: `github.com/go-chi/chi/v5`
  - Ultra-lightweight, 100% compliant with standard library `net/http`.
  - Zero memory allocation overhead on route matches.
- **Database Driver & Query Layer**: `github.com/jmoiron/sqlx` with `github.com/jackc/pgx/v5`
  - Explicit, performant SQL queries with struct scanning.
  - Full control over transactions, connection pooling, and statement preparation.
- **Rule & Automation Engine**: `github.com/google/cel-go`
  - Google Common Expression Language for fast, memory-safe AST evaluation of business triggers.
- **Real-Time WebSockets**: `github.com/gorilla/websocket` with thread-safe client connection hubs.
- **Authentication & Cryptography**:
  - `golang-jwt/jwt/v5` for stateless access tokens with cryptographically signed refresh tokens.
  - `golang.org/x/crypto/argon2` for password hashing.
  - `crypto/ed25519` for verifying offline mobile punch signatures.
- **Validation**: `github.com/go-playground/validator/v10`

### 2. Relational Database (PostgreSQL 16+)
- **Multi-Tenancy Model**: Row-Level Security (RLS) with session variable `SET LOCAL app.current_tenant_id = '...'`.
- **Custom Dynamic Fields**: PostgreSQL `JSONB` with virtual generated columns and `GIN` indexes.
- **Geofencing**: Native Earthdistance / Point geometry for sub-meter distance calculation.
- **Audit Ledger**: Append-only table with SHA-256 hash chains computed via `pgcrypto` / Go service layer.

### 3. Web Frontend (React 19)
- **Tooling**: Vite + TypeScript (Strict Mode).
- **Server State Management**: `@tanstack/react-query` (v5) for automatic caching, background refetching, and optimistic updates.
- **Local & Board State**: `zustand` for ultra-lean board state without boilerplate.
- **Interactive Drag & Drop**: `@dnd-kit/core` and `@dnd-kit/sortable` for 60fps Kanban/Scrum drag-and-drop.
- **Org Chart & Timelines**: Hardware-accelerated dynamic SVG and HTML5 Canvas.
- **Design System**: Modern Vanilla CSS Modules / TailwindCSS with tailored 2026 design tokens, glassmorphism accents, and dark/light high-density themes.

### 4. Mobile Applications (Native Android & iOS)
- **Native Android**:
  - Language: Kotlin
  - UI Toolkit: Jetpack Compose
  - Architecture: Clean Architecture + MVI
  - Local Storage: Room (SQLite) with encrypted preferences
  - Hardware Security: Android Keystore for Ed25519 offline punch signing
  - Location: Google Play Services Location API with mock location provider detection
- **Native iOS**:
  - Language: Swift 6
  - UI Toolkit: SwiftUI
  - Architecture: MVVM with `@Observable`
  - Local Storage: SwiftData / GRDB SQLite
  - Hardware Security: Apple Secure Enclave for biometric-backed offline punch signing
  - Location: CoreLocation with geofenced circular and polygon region monitoring
