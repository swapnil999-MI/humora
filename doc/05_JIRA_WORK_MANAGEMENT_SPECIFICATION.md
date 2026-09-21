# 05. Jira Work Management Detailed Specification

This document details the Project and Work Management engine within Humora, engineered to 2026 enterprise benchmarks with **zero AI features**.

---

## 1. Project & Workspace Architecture

### Project Keys & Entity Hierarchies
- Every project has a unique alphanumeric prefix key (`HUM`, `PAY`, `INFRA`).
- Sequential issue keys generated atomically (`HUM-1`, `HUM-2`, ..., `HUM-10492`).
- 4-Tier Hierarchy:
  1. **Initiative**: Cross-project business objective spanning quarters.
  2. **Epic**: Large deliverable containing multiple user stories.
  3. **Standard Issues**: Story, Task, Bug, Customer Ticket.
  4. **Sub-Task**: Atomic checklist item tied to a parent issue.

### Project Templates
- **Scrum Template**: Backlog grooming, 1-4 week sprint cycles, story point estimation, velocity tracking, and burndown analytics.
- **Kanban Template**: Continuous delivery flow, column-level Work In Progress (WIP) limits, cycle/lead time analytics.
- **Service Desk / Ticketing Template**: Customer/internal request portal, shift-aware on-call assignment, business-hour SLA timers.

---

## 2. Dynamic Workflow State Machine

Workflows in Humora are deterministic finite state machines (FSM) configured visually or via JSON definitions.

```
       ┌───────────┐
       │  Backlog  │
       └─────┬─────┘
             │ (Assignee != null)
             ▼
       ┌───────────┐
       │  In Dev   │
       └─────┬─────┘
             │ (PR Link != null && StoryPoints > 0)
             ▼
       ┌───────────┐
       │    QA     │
       └─────┬─────┘
             │ (Role == 'QA Lead' && LoggedTime > 0)
             ▼
       ┌───────────┐
       │   Done    │
       └───────────┘
```

### 1. Guard Conditions
- Transitions can only be triggered if pre-conditions evaluate to true:
  - *Role Permission*: Only a user with `project:qa_lead` can move a ticket from `QA` to `Done`.
  - *Assignee Guard*: Cannot move from `Backlog` to `In Progress` unless an assignee is explicitly set.

### 2. Transition Validators
- Validates field constraints before committing a state change:
  - Cannot transition to `Ready for Release` unless all child sub-tasks are marked `Done`.
  - Cannot transition to `Closed` if `original_estimate > 0` but `total_time_logged == 0`.

### 3. Post-Functions
- Actions automatically performed after a successful transition:
  - Set `resolution_date = NOW()`.
  - Reassign ticket to the original reporter when moving to `Needs Clarification`.
  - Auto-close child sub-tasks when parent story is marked `Done`.
  - Emit real-time WebSocket event to all active board viewers.

---

## 3. Dynamic Custom Fields Engine

### Relational + JSONB Hybrid Design
- Dynamic custom fields are stored within `jira_issues.custom_fields` as indexed `JSONB`.
- Supported Data Types:
  - Text, Number, Single/Multi-Select Dropdown, Cascading Dropdowns.
  - Date & DateTime pickers.
  - User Picker (filtering by HR department, e.g. "DevOps Engineers").
  - **Formula Fields**: Deterministically calculated without AI:
    $$\text{Priority Score} = (\text{Business Value} \times 0.7) + (\text{Customer Tier} \times 0.3)$$
- Custom fields can be configured per issue type (e.g. "Browser Version" only appears on Bugs, not on Epics).

---

## 4. Interactive Agile Boards & Visualizations

### High-Performance Scrum Board
- **Backlog View**:
  - Drag-and-drop prioritization of backlog items.
  - Story point estimation (Fibonacci: 1, 2, 3, 5, 8, 13, 21).
  - One-click Sprint creation with start date, end date, sprint goal, and **auto-calculated HR capacity**.
- **Active Sprint Board**:
  - Dynamic swimlanes: Group by Assignee, Epic, or Priority.
  - Quick filters: "My Issues", "Recently Updated", "P0 Bugs".
  - Sub-16ms drag-and-drop card movements powered by `@dnd-kit/core`.

### Kanban Board with Strict WIP Limits
- Work-In-Progress limits can be placed on individual columns (e.g., max 5 tickets in `Code Review`).
- If WIP limit is exceeded, the column turns amber/red, visually warning the team of bottlenecks.

### Agile Analytics & Charts
- **Burndown Chart**: Real-time ideal vs actual burn line based on completed story points.
- **Velocity Chart**: Historical commitment vs completed story points over past 5 sprints.
- **Cumulative Flow Diagram (CFD)**: Tracks work status over time to detect process bottlenecks.

---

## 5. SLA & Escalation Engine (Service Management)

### Shift-Aware SLA Calculation
- Timers respect working hours and public holidays:
  - If a ticket is logged Friday at 5:30 PM and the office closes at 6:00 PM, a 2-hour resolution SLA pauses over the weekend and resumes Monday at 9:00 AM.
- Configurable thresholds:
  - First Response SLA (e.g., 15 minutes for Critical issues).
  - Target Resolution SLA (e.g., 4 hours for P0 issues).

### Automated Escalation Triggers (Zero-AI)
- At 75% elapsed SLA: Send high-priority alert to Assignee and Team Lead.
- At 100% SLA breach: Auto-escalate ticket priority, trigger red breach badge on Kanban board, and notify Engineering Director.

---

## 6. Deterministic Automation Engine (Google CEL)

- **Common Expression Language (CEL)** evaluator running in Go:
  - Fast execution ($< 1$ microsecond per evaluation).
  - Type-safe, sandboxed, and zero-allocation.
- Example Automation Rules:
  - **Auto-Triage**:
    ```cel
    trigger == "issue_created" && issue.type == "Bug" && issue.labels.contains("Security")
    ==> set_priority("Highest"); set_security_level("Confidential");
    ```
  - **Shift-Aware Auto-Assignment**:
    ```cel
    trigger == "issue_created" && issue.priority == "Highest"
    ==> assign_to_active_shift_lead(project.department_id);
    ```
