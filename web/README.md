<div align="center">
  <img src="./public/logo.svg" alt="PeopleOS Brand Emblem" width="96" height="96" style="margin-bottom: 16px;" />
  <h1>PeopleOS &bull; Enterprise Frontend Application</h1>
  <p><strong>The High-Performance, Unified Workday, Agile & HRMS Operating System</strong></p>
  <p>
    <code>React 19</code> &bull;
    <code>TypeScript 6</code> &bull;
    <code>Vite 8</code> &bull;
    <code>Zustand</code> &bull;
    <code>Lucide Icons</code> &bull;
    <code>DnD Kit</code> &bull;
    <code>Champagne Amber Gold Theme</code>
  </p>
</div>

---

## 📑 Table of Contents
1. [System Overview & Architecture](#-system-overview--architecture)
2. [Luxury Design System & Theming](#-luxury-design-system--theming)
3. [Brand Identity & Visual Assets](#-brand-identity--visual-assets)
4. [Comprehensive Feature Matrix](#-comprehensive-feature-matrix)
   - [1. My Workday Hub (`#hub`)](#1-my-workday-hub-hub)
   - [2. Agile Project Management & Sprints (`#work`)](#2-agile-project-management--sprints-work)
   - [3. HRMS Core & Workforce Administration (`#hrms`)](#3-hrms-core--workforce-administration-hrms)
   - [4. My Payrolls & Payslips Desk (`#payroll`)](#4-my-payrolls--payslips-desk-payroll)
   - [5. Universal Search & Ergonomics](#5-universal-search--ergonomics)
5. [Keyboard Navigation & Shortcuts (`?`)](#-keyboard-navigation--shortcuts-)
6. [Folder & Directory Structure](#-folder--directory-structure)
7. [API Integration & State Management](#-api-integration--state-management)
8. [Local Setup & Development Guide](#-local-setup--development-guide)

---

## 🏛 System Overview & Architecture

**PeopleOS Frontend** is a modern Single Page Application (SPA) engineered to replace disjointed HR portals, time trackers, sprint management software, and payroll spreadsheets with a cohesive, fluid enterprise experience.

- **Zero Vendor Lock-In**: Complete control over client-side business logic and rendering.
- **Microsecond Responsiveness**: Built with pure React 19, Vite 8 bundling, and lightweight Zustand stores.
- **Biometric & Agile Integration**: Unifies check-in/out timestamps with sprint ticket deliverables for auditable workday reconciliation.
- **Statutory Compliance Ready**: End-to-end Indian payroll structures (PF 12%, PT ₹200, Gratuity 4.81%, New vs Old IT Regimes).

---

## 🎨 Luxury Design System & Theming

The application features a bespoke **Champagne Amber Gold & Smoky Velvet Obsidian** dual-color luxury aesthetic inspired by high-end financial platforms.

### 1. Dual-Color Tonal Harmony
- **Base Canvas (Smoky Velvet Obsidian)**:
  - Deep obsidian dark surfaces (`#121110`, `#181715`, `#201e1b`, `#292723`, `#35322d`) designed to eliminate OLED glare during long engineering shifts.
  - Soft warm silk alabaster typography (`#faf8f5`) with warm cashmere mineral secondary text (`#ab9f91`).
- **Interactive Accents (Champagne Amber Gold)**:
  - Molten gold gradients (`#f59e0b` to `#b45309`) for primary calls to action, active indicators, live attendance stopwatch beacons, and focus rings.
  - Transparent amber subtles (`rgba(245, 158, 11, 0.12)`) for high-polish badges and borders.
- **Zero Color Clash**: Strict ban on raw blues, indigos, cyans, and emerald greens in core views to preserve visual calm.

### 2. Button Design Tokens
All interactive buttons adhere to consistent soft-theme rules:
- `.btn-primary`: Subtle champagne amber gradient with glowing border ring on focus.
- `.btn-secondary`: Warm obsidian card surface with subtle hairline border.
- `.btn-ghost`: Translucent background that reveals card textures underneath.
- `.btn-outline`: Hairline borders with smooth hover transitions.

---

## 💎 Brand Identity & Visual Assets

- **Vector Mark (`PeopleOSLogo.tsx`)**: Stylized human profile with an internal cerebral spiral brain labyrinth and integrated `P` monogram. Rendered with transparent negative space and a radiant champagne gold gradient.
- **Brand Placements**:
  - **Header Anchor**: Prominently displayed next to interactive breadcrumbs with a 1-click return to the home hub.
  - **App Rail**: Persistent top brand emblem in the leftmost navigation rail.
  - **Favicon & Meta**: Configured in `index.html` via `/logo.svg` and `/favicon.svg`.

---

## ⚡ Comprehensive Feature Matrix

### 1. My Workday Hub (`#hub`)
The daily home base for every team member:
- **Real-Time Active Work Stopwatch**: When punched in, the attendance card and top header display a live digital stopwatch (`HH:MM:SS`) accompanied by a pulsating golden beacon (`.live-pulse-dot`).
- **One-Click Shift Clock-In / Clock-Out**: Biometric timestamp tracking with automatic session calculation.
- **Vertical Day-Wise Reconciliation Ledger**:
  - Financial-grade table aligning weekly attendance with logged sprint deliverables across 6 strictly budgeted columns (`Day & Date`, `Shift Attendance`, `Sprint Worklogs`, `Sync Ratio`, `Net Variance`, `Audit Status & Actions`).
  - **Variance Diagnostics**: Instant indication of balanced days (`0.0h bal`), deficits (`-1.5h`), and surpluses (`+0.5h`).
  - **Under-Logged Actionables**: Inline `+ Log Work` shortcut to open the Issue Drawer and log time directly to missing dates.
  - **Expand/Collapse Drill-Down**: Click any row to expand itemized sprint deliverables showing ticket keys (`PAY-101`), titles, time spent, and billable tags.
  - **Global Controls**: `Expand All` and `Collapse All` toggles.
  - **Weekly Sign-Off Ribbon**: Timesheet sign-off and submission workflow with manager approval state tracking.
- **Sprint Focus & Quick Tasks**: Itemized priority tickets assigned to the active sprint.

---

### 2. Agile Project Management & Sprints (`#work`)
Full-featured project management workspace:
- **Interactive Drag-and-Drop Kanban Board**: Powered by `@dnd-kit` across custom workflow columns (`To Do`, `In Progress`, `Review`, `Done`).
- **Inline Quick Task Creator**: Click `+ Add task` at the bottom of any column to open an inline composer (`Enter` to create, `Esc` to cancel).
- **Slide-Over Issue Drawer**:
  - View and edit title, markdown descriptions, story points, priority, and assignees.
  - Quick-hour worklog presets (`+15m`, `+30m`, `+1h`, `+2h`) for instantaneous timesheet logging.
  - Ticket comments and threaded activity streams.
  - Keyboard dismissal via `Esc`.
- **Sprint Milestones & Velocity**: Target deadlines, burned story points, and sprint progress gauges.

---

### 3. HRMS Core & Workforce Administration (`#hrms`)
Enterprise workforce management suite:
- **Employee Directory (`#hrms/directory`)**: Complete searchable database of employees, departments, designations, work email, phone, and joining dates.
- **Shift Management & Rostering (`#hrms/shifts`)**: Flexible work schedules, rotational shift assignments, and weekly off configurations.
- **Team Capacity Desk & Burnout Sentinel (`#hrms/capacity`)**:
  - Real-time engineering velocity and active sprint point allocation.
  - **Burnout Sentinel**: Automated strain detection flagging team members at optimal workload vs high risk of burnout.
- **Team Radar Desk (`#hrms/radar`)**: Real-time presence monitor showing who is actively `Working Now`, on `Break`, or `Offline`.
- **Approvals Desk (`#hrms/approvals`)**: Central inbox for pending leave requests, attendance regularization requests, and reimbursement approvals with one-click decisioning.
- **Onboarding Pipeline Desk (`#hrms/onboarding`)**: Phase-based new-hire roadmaps covering Documentation, Hardware Procurement, Corporate Orientation, and Compliance Training.
- **Company Settings & Legal Profile (`#hrms/company`)**: Master company profile management (Legal Name, CIN, GSTIN, PAN, TAN, Registered Address, Geofence Radius, Digital Signatories).

---

### 4. My Payrolls & Payslips Desk (`#payroll`)
High-precision compensation and statutory benefits hub:
- **Monthly Payslips History (Tab 1)**:
  - Itemized history of all released salary slips with Net Pay, Gross Earnings, Payable Days, and Biometric LOP attendance deductions.
  - Direct PDF download and interactive document viewer.
  - **PeopleOS Salary Calculation Engine Explainer**: Educational cards breaking down Gross Earnings, Biometric LOP deductions, and Retiral Contributions.
- **Cost to Company (CTC) Schedule (Tab 2)**:
  - Annual and monthly compensation schedule effective dates.
  - **Part A (Fixed Monthly Earnings)**: Basic Salary (50%), HRA (20%), Conveyance Allowance, Medical Allowance, and Special Allowance.
  - **Part B (Retiral & Statutory Contributions)**: Employer PF (12%), Employee PF (12%), Gratuity (4.81%), and Professional Tax (₹200).
  - Highlighted **Estimated Monthly Take-Home (Pre-TDS)** banner.
- **IT Declaration & Regime Planner (Tab 3)**:
  - Interactive regime election between **New Regime (115BAC)** and **Old Regime (with Exemptions)**.
  - **Tax Optimizer Recommendation**: Automated algorithm suggesting the regime that minimizes annual liability based on declared CTC.
  - Declarations for Section 80C (PPF, EPF, ELSS up to ₹1.5L), Section 80D (Self & Parents Health Cover up to ₹75k), NPS (80CCD(1B) up to ₹50k), and HRA Rent with Landlord PAN validation.
- **Reimbursements & Flexible Benefit Plan (FBP) (Tab 4)**:
  - Tax-exempt business expense claims across Broadband, Certifications & Learning, Transit, Ergonomics & Wellness, and Home Workstation Supplies.
  - Unified soft status badges (`reimbursed`, `approved`, `pending`).
  - Slide-over / modal claim submission with invoice numbers, merchant details, and justification notes.
- **Official Payslip Document Modal (`PayslipDocumentModal.tsx`)**:
  - Compliant dual-column paper layout (Earnings vs Deductions).
  - Generates Net Pay written in formal English words.
  - Includes corporate signatory, CIN/GSTIN matrix, and biometric attendance stamp.
  - Print-ready canvas with `@media print` stylesheets.
- **Statutory Payroll Engine Modal (`PayrollRunModal.tsx`)**:
  - Administrative payroll run simulator for any month/year.
  - Pre-computes biometric check-in LOP, statutory PF, PT, and regime TDS across all employees before official locking.

---

### 5. Universal Search & Ergonomics
- **Google Search Bar**:
  - Universal search modal accessible from header or `Cmd+K`.
  - **Substring Highlighting**: Automatically highlights matched keywords in real-time (`<mark className="search-highlight">`).
  - **Recent Searches Memory**: Stored in `localStorage` for 1-click query replay or clearing.
  - **Keyboard Smooth Auto-Scroll**: Navigating items via `ArrowDown`/`ArrowUp` automatically scrolls long result lists into view.
- **Clickable Breadcrumbs**: Fast parent hub navigation via `.breadcrumb-btn`.
- **User Profile Flyout**: Live duty indicator, quick profile links, and sign-out controls anchored to the rail avatar.

---

## ⌨️ Keyboard Navigation & Shortcuts (`?`)

Press `?` anywhere in the application to summon the cheat sheet modal:

| Key Binding | Action Triggered |
| :--- | :--- |
| `?` | Open Global Keyboard Shortcuts Guide |
| `Cmd + K` / `Ctrl + K` | Focus & Open Universal Google Search Bar |
| `1` | Navigate to **My Workday Hub** (`#hub`) |
| `2` | Navigate to **Agile Kanban Board** (`#work`) |
| `3` | Navigate to **HRMS Dashboard** (`#hrms`) |
| `4` | Navigate to **My Payrolls & Payslips Desk** (`#payroll`) |
| `5` | Navigate to **Employee Directory** (`#hrms/directory`) |
| `P` | Toggle Biometric Work Punch (Clock In / Clock Out) |
| `C` | Create New Agile Task / Ticket |
| `Esc` | Close any open Modal, Popover, or Slide-Over Drawer |
| `ArrowUp` / `ArrowDown` | Navigate through search suggestions with auto-scroll |
| `Enter` | Select active search item or submit inline task |

---

## 📁 Folder & Directory Structure

```
frontend/
├── public/
│   ├── favicon.svg             # PeopleOS browser tab favicon
│   └── logo.svg                # High-res Champagne Amber Gold vector emblem
├── src/
│   ├── api/
│   │   └── client.ts           # Centralized Fetch client with error handling & proxy
│   ├── components/
│   │   ├── AppRail.tsx         # Leftmost persistent navigation rail & user popover
│   │   ├── Header.tsx          # Top control bar, breadcrumbs, live ticking stopwatch
│   │   ├── GoogleSearchBar.tsx # Substring highlighter, recent pills, keyboard scroller
│   │   ├── KeyboardShortcutsModal.tsx # Shortcut cheat sheet modal (?)
│   │   ├── NotificationSidebar.tsx    # Slide-over notification tray
│   │   └── PeopleOSLogo.tsx    # Pure SVG vectorized brand emblem
│   ├── store/
│   │   ├── store.ts            # Root store orchestrator
│   │   ├── authStore.ts        # Active user session & profile state
│   │   ├── workdayStore.ts     # Attendance, timesheets, vertical ledger reconciliation
│   │   ├── workStore.ts        # Kanban board, sprints, issues, worklogs
│   │   ├── hrmsStore.ts        # Directory, shifts, approvals, payroll, CTC, tax planner
│   │   └── uiSlice.ts          # Modals, toasts, theme settings, drawer states
│   ├── views/
│   │   ├── hub/
│   │   │   └── MyWorkdayHub.tsx        # Vertical day-wise reconciliation & attendance
│   │   ├── work/
│   │   │   ├── KanbanBoard.tsx         # Drag-and-drop ticket board
│   │   │   └── IssueDrawer.tsx         # Slide-over task detail & hour presets
│   │   └── hrms/
│   │       ├── HrmsDashboard.tsx       # Core HR analytics & quick links
│   │       ├── EmployeeDirectory.tsx   # Staff roster & contact cards
│   │       ├── ShiftManagementDesk.tsx # Rosters & shift timings
│   │       ├── TeamCapacityDesk.tsx    # Burnout Sentinel & sprint capacity
│   │       ├── TeamRadarDesk.tsx       # Live status presence radar
│   │       ├── ApprovalsDesk.tsx       # Leaves & regularization inbox
│   │       ├── OnboardingPipelineDesk.tsx # New-hire milestone checklists
│   │       ├── CompanySettingsDesk.tsx # Legal master entity settings
│   │       ├── PayrollDesk.tsx         # Monthly payslips, CTC schedule, IT declaration, FBP
│   │       ├── PayslipDocumentModal.tsx # Printable official payslip canvas
│   │       ├── PayrollRunModal.tsx     # Statutory payroll batch runner
│   │       └── RegularizationModal.tsx # Attendance regularization form
│   ├── types/
│   │   └── index.ts            # Enterprise TypeScript domain definitions
│   ├── utils/
│   │   └── numberToWords.ts    # Currency formatter (INR) & English word converter
│   ├── App.tsx                 # View router & global modal mounts
│   ├── index.css               # Design system tokens, variables, & utility classes
│   └── main.tsx                # Application bootstrap
├── index.html                  # HTML5 entry with PeopleOS meta tags
├── package.json                # Dependencies, build scripts & metadata
├── tsconfig.json               # TypeScript compiler options
└── vite.config.ts              # Vite configuration & backend proxy rules
```

---

## 🔌 API Integration & State Management

- **Proxy Routing**: All network calls beginning with `/api/*` are routed via Vite proxy to the local Go backend (`http://127.0.0.1:8090`).
- **Resilient Fallbacks**: If the backend database contains no row for a specific query (e.g. initial compensation records), stores automatically fallback to statutory defaults so the interface never crashes.
- **Safe Rendering**: All list mappings use optional chaining (`items?.map(...)`) ensuring graceful degradation during async network operations.

---

## 🛠 Local Setup & Development Guide

### Prerequisites
- Node.js 20+
- npm 10+ (or bun)
- Go backend running on port `8090` (located in `../humora`)

### 1. Install Dependencies
```bash
cd /Users/ritejmule/Desktop/Ritej/App/peopleos/frontend
npm install
```

### 2. Start Development Server
```bash
npm run dev
```
The application will launch on `http://localhost:3000/` (or `http://localhost:3001/` if port 3000 is occupied).

### 3. Build Production Bundle
```bash
npm run build
```
Compiles TypeScript checks and generates a minified, tree-shaken production distribution in `dist/`.

### 4. Run Code Linter
```bash
npm run lint
```
Executes fast Oxlint type and styling validation.

---

<div align="center">
  <p><em>Built with precision for PeopleOS Enterprise. Designed for clarity, speed, and elegance.</em></p>
</div>
