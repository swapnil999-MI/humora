# 01. Project Overview & Vision: Humora Platform

## Executive Summary
**Humora** is a next-generation, unified enterprise platform that seamlessly fuses **Human Capital Management (Zoho People / HR)** with **Agile Work & Project Management (Jira)**. Engineered to 2026 enterprise benchmarks with **zero reliance on AI**, Humora operates on a single high-performance codebase, single PostgreSQL relational schema, and single identity layer.

By bringing the full breadth of Zoho People and Jira into the exact same application, Humora completely eliminates the sync delays, broken API connectors, duplicated user accounts, and mismatched reporting inherent to fragmented enterprise software suites.

---

## The Complete Zoho People & Jira Ecosystem

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                    HUMORA ENTERPRISE PLATFORM                                   │
├────────────────────────────────────────────────────────────────┬────────────────────────────────┤
│                    HUMAN CAPITAL MANAGEMENT                    │    AGILE WORK & PROJECT MGMT   │
│                      (ZOHO PEOPLE SUITE)                       │          (JIRA SUITE)          │
├────────────────────────────────────────────────────────────────┼────────────────────────────────┤
│ 1. Core HR & EIS                                               │ 1. Project & Workspaces        │
│    • Custom Forms & Dynamic Sub-forms (JSONB)                  │    • Scrum, Kanban, Service    │
│    • Bi-temporal / Effective-Dated Records                     │    • Sequential Keys (HUM-101) │
│    • Interactive Canvas Org Tree (Matrix Reporting)            │                                │
│    • Asset Custody & Lifecycle Management                      │ 2. Issues & Hierarchy          │
│    • Dynamic HR Letter Template Generator                      │    • Initiative -> Epic ->     │
│    • Social Feeds, Kudos Wall & Celebration Automations        │      Story/Bug -> Sub-task     │
│                                                                │    • Formula & Custom Fields   │
│ 2. Time & Attendance Engine                                    │                                │
│    • Multi-Location Geofence (Polygon + Haversine)             │ 3. Finite State Machine        │
│    • Office Wi-Fi BSSID & Corporate IP Whitelisting            │    • Visual Workflow Designer  │
│    • Cryptographic Offline-Signed Punch (Ed25519 Keystore)     │    • Guard Conditions          │
│    • Real-time Biometric Hardware Gateway (ADMS/Push)          │    • Transition Validators     │
│    • Shift Rosters, Auto-Rotation & Peer Swaps                 │    • Automated Post-Functions  │
│    • Break Tracking, Grace Periods & Late Penalties            │                                │
│                                                                │ 4. Interactive Agile Boards    │
│ 3. Leave & Absence Management                                  │    • Backlog Drag-and-Drop     │
│    • Accrual Engine (Daily, Monthly, Pro-Rata)                 │    • Sprint Board & WIP Limits │
│    • Deterministic Sandwich Rule Enforcement                   │    • Burndown & Velocity Charts│
│    • Compensatory Off (Comp-Off) Auto-Creditor                 │    • Timeline / Gantt Roadmaps │
│    • Clubbing Restrictions & Blackout Overlap Matrix           │                                │
│    • Multi-Tier Approval Hierarchies with Auto-Escalation      │ 5. SLA & Escalations           │
│                                                                │    • Shift-Aware SLA Timers    │
│ 4. Timesheets & Project Costing                                │    • Breach Warnings & Badges  │
│    • Persistent Stopwatch & Time Logs                          │                                │
│    • Client Cost Center Allocation & Project Labor P&L         │ 6. Cross-Domain Synergy        │
│    • Automated Weekly Lockouts & Dual PM/HR Sign-Off           │    • Sprint Capacity Engine    │
│                                                                │    • Atomic Worklog Timesheets │
│ 5. Performance Management System (PMS - 100% Objective)        │    • Live In-Office Presence   │
│    • Cascading OKRs & Quantitative KRAs                        │    • On-Duty Bug Auto-Routing  │
│    • 360-Degree Multi-Rater Cycles (Self, Manager, Peer)       │    • Objective Appraisals      │
│    • 9-Box Grid & Bell Curve Normalization                     │    • Atomic Offboarding Exit   │
│    • 1-on-1 Continuous Meetings & PIP Tracking                 │                                │
│                                                                │                                │
│ 6. Travel & Expense Desk                                       │                                │
│    • Travel Itineraries, Flight & Hotel Advance Requests       │                                │
│    • Multi-Currency Expense Vouchers & Mileage Tracking        │                                │
│    • Cryptographic Receipt Hash Auditing (Anti-Duplicate)      │                                │
│                                                                │                                │
│ 7. Employee HR Helpdesk & Query Desk                           │                                │
│    • Multi-Category Ticketing (Payroll, IT, Admin, Policy)     │                                │
│    • Business-Hour SLA Dispatch & CSAT Satisfaction Surveys    │                                │
│                                                                │                                │
│ 8. Onboarding, Exit & Payroll Prep                             │                                │
│    • Candidate Pre-Boarding Portal & Digital Induction         │                                │
│    • Resignation, Buyout & Multi-Dept NOC Clearance Matrix     │                                │
│    • Full & Final (F&F) Settlement Sheet Calculation           │                                │
│    • CTC Components, LOP Deductions & Bank NEFT/RTGS Exports   │                                │
└────────────────────────────────────────────────────────────────┴────────────────────────────────┘
```

---

## The Core Philosophy: Next-Gen 2026 Without AI
While modern software increasingly relies on probabilistic AI models that introduce hallucinations, high inference costs, and unpredictability, Humora is engineered around **deterministic mathematical rigor, ultra-low latency, and cryptographic certainty**:

1. **Deterministic Rule & Workflow Engines**: All automations, ticket routings, SLA escalations, and approval hierarchies are powered by AST-based expression evaluators (Google Common Expression Language - CEL) and finite state machines. Every action is 100% auditable and reproducible.
2. **Real-Time Event Reactivity**: Real-time bi-directional streaming via WebSockets ensures sub-16ms live updates across web and mobile without polling.
3. **Cryptographic Tamper-Evident Ledger**: All critical business operations (payroll adjustments, attendance regularizations, expense receipts, permission escalations) are recorded into an append-only SHA-256 hash-chained audit ledger.
4. **Mathematical Capacity & Resource Planning**: Sprint capacity, project schedules, and employee availability are calculated directly from active shift rosters, approved leaves, and public holiday calendars down to the exact minute.
5. **Ultra-Reliable Offline-First Architecture**: Native mobile applications feature cryptographic hardware-keystore signed event queues that allow field staff to punch attendance and log work offline with zero risk of timestamp manipulation.
