# 04. Zoho People HRMS Complete & Advanced Specification (2026 Non-AI Standard)

An exhaustive, enterprise-grade specification encompassing **every single module, feature, and workflow from Zoho People / Zoho HR**, supercharged to 2026 standards with **zero AI features**. Everything is driven by deterministic rule engines, mathematical models, cryptographic auditability, and real-time streaming.

---

## Complete Module Breakdown

```
┌─────────────────────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                         HUMORA HRMS COMPLETE SUITE                                              │
├────────────────────────────────┬────────────────────────────────┬──────────────────────────────────────────────┤
│ 1. Core HR & Employee Database │ 2. Time & Attendance Engine    │ 3. Leave & Absence Management                │
│    • Custom Form/Subform Bldr  │    • Multi-Location Geofence   │    • Complex Accruals & Pro-Rata             │
│    • Bi-temporal Record Dating │    • Wi-Fi BSSID & IP White-   │    • Deterministic Sandwich Rule             │
│    • Interactive Org Tree      │      listing                   │    • Comp-off Auto-Creditor                  │
│    • Asset Custody & Lifecycle │    • Hardware-Signed Offline   │    • Clubbing & Blackout Matrix              │
│    • Document Vault & e-Sign   │      Punch (Ed25519)           │    • Multi-Tier Escalation Matrix            │
│    • Automated Letter Engine   │    • Biometric ADMS Gateway    │    • Encashment & Carry-Forward              │
│    • Social Feeds & Kudos Wall │    • Shift Roster & Auto-Swap  │                                              │
│                                │    • Break & Penalty Engine    │                                              │
├────────────────────────────────┼────────────────────────────────┼──────────────────────────────────────────────┤
│ 4. Timesheets & Project Costs  │ 5. Performance Management(PMS) │ 6. Onboarding & Exit Management              │
│    • Live Stopwatch Tracking   │    • Cascading OKRs & KRAs     │    • Candidate Pre-boarding Portal           │
│    • Billable vs Non-Billable  │    • 360-Degree Multi-Rater    │    • Day 1, 30, 60, 90 Checklists            │
│    • Client Cost Center Audit  │    • 9-Box Grid Matrix         │    • Resignation & Buyout Engine             │
│    • Dual PM/HR Sign-Off       │    • Bell Curve Normalization  │    • Multi-Dept Clearance (IT/Admin/Fin)     │
│    • Automated Weekly Lockouts │    • PIP Milestone Tracker     │    • Automated F&F Settlement Calc           │
├────────────────────────────────┼────────────────────────────────┼──────────────────────────────────────────────┤
│ 7. Travel & Expense Desk       │ 8. Employee Helpdesk & Cases   │ 9. Compensation & Payroll Prep               │
│    • Travel Requests & Booking │    • Multi-Category HR Tickets │    • CTC Breakdown & Tax Slabs               │
│    • Multi-Currency Expenses   │    • SLA Resolution Matrix     │    • Automated LOP Deductions                │
│    • Receipt Hash Verification │    • Dynamic Routing by Dept   │    • Tax Proofs & Declarations               │
│    • Advance Cash Adjustments  │    • Satisfaction Surveys      │    • Bank-Ready NEFT/RTGS Exports            │
└────────────────────────────────┴────────────────────────────────┴──────────────────────────────────────────────┘
```

---

## 1. Core HR & Employee Database (Enterprise EIS)

### 1.1 Dynamic Custom Form & Sub-Form Builder
- **Zero-Migration Schema Extensions**: Built on PostgreSQL `JSONB` with virtual generated column indexes.
- **Supported Field Types**: Single-line Text, Multi-line Rich Text, Formula calculations, Number, Currency, Percentage, Date, Time, DateTime, Single/Multi Select Dropdown, Dependent/Cascading Dropdowns (e.g. Country $\rightarrow$ State $\rightarrow$ City), File Attachments, Checkboxes, Toggle switches, User pickers, Department pickers.
- **Sub-Forms (Nested Records)**: Add repeating child records inside employee profiles (e.g., Previous Employment History, Educational Qualifications, Dependent Family Members, Certifications).
- **Sensitive Data Masking**: Fields like Bank Account Number, Aadhaar / Social Security Number, and Tax IDs are masked by default (`•••• •••• 1234`) and require explicit ABAC permission (`hrms:view_pii`) to reveal.

### 1.2 Bi-Temporal & Effective Dating
- Every profile change preserves full historical lineage using `effective_from` and `effective_to` timestamps.
- **Time-Travel Audit**: Querying the employee record at any historical timestamp (e.g., `2024-06-15 00:00:00Z`) returns the exact designation, salary, manager, and department active on that date.

### 1.3 Interactive Org Chart & Matrix Reporting
- **Dynamic Hardware-Accelerated Tree Canvas**: Zoom, pan, search, filter by department/branch.
- **Matrix Reporting**: Full support for dual reporting structures:
  - *Administrative / Direct Reporting Manager* (approves leaves, appraisals, attendance).
  - *Functional / Project Manager* (assigns tasks, approves project timesheets).

### 1.4 Company Feeds & Collaboration Wall
- Announcements, department notices, policy updates.
- Automated Celebration Feeds: Deterministic cron triggers celebrating birthdays, work anniversaries, and new joiner welcomes.
- Peer-to-Peer Recognition & Badges (Kudos wall).

### 1.5 Asset Management & Custody Tracking
- Complete asset ledger: Laptops, monitors, mobile devices, ID cards, parking tags, software licenses.
- Tracking: Serial number, warranty dates, purchase cost, asset condition (New, Good, Damaged).
- Digital handover acknowledgment with employee signature; automated asset clearance alerts during offboarding.

### 1.6 Document Vault & Dynamic HR Letter Generator
- Encrypted document storage for passports, visas, diplomas, contracts, NDAs.
- Expiration Tracker: Deterministic notifications at 90, 60, 30, and 7 days prior to document expiry.
- **Dynamic HR Letter Generation**:
  - Offer Letters, Appointment Letters, Promotion/Increment Letters, Transfer Letters, Experience Letters, Relieving Letters, Bonafide Certificates.
  - Template engine supporting dynamic merge tags (`{{employee.name}}`, `{{employee.designation}}`, `{{compensation.ctc}}`) with instant PDF export.

---

## 2. Time & Attendance Engine (2026 High-Integrity Standard)

### 2.1 Multi-Location Geofenced Punch-In/Out
- **Circle & Polygon Geofencing**: Validates coordinates against configured office perimeters using the Haversine equation and ray-casting polygon algorithms.
- **Anti-Mock / Anti-Spoof Location Verification**: Rejects punches if Android `isMockLocation` or iOS simulated GPS flags are detected.

### 2.2 Corporate Wi-Fi BSSID & IP Whitelisting
- Punch validation requires connection to approved office Wi-Fi routers (verifying hardware MAC/BSSID addresses).
- Corporate public IP subnet verification for office desktop check-ins.

### 2.3 Cryptographic Offline Punch Queue (Ed25519)
- For field employees, underground facilities, or network dropouts:
  - Punch event `{employee_id, timestamp, latitude, longitude, device_id}` is signed using the private key inside the Android Keystore / Apple Secure Enclave.
  - Monotonic hardware clock prevents system time tampering.
  - Server verifies the Ed25519 signature against the employee's registered device public key upon network reconnection.

### 2.4 Biometric Hardware Gateway (ADMS / Push Protocol)
- Native TCP/HTTP ingestion gateway supporting direct push logs from ZKTeco, eSSL, and standard biometric hardware.
- Real-time event deduplication and instant synchronization with web attendance status.

### 2.5 Shift Rostering, Auto-Rotation & Peer Swaps
- Support for Fixed, Flexible, Rotational, Night, and Split shifts.
- Shift Auto-Rotation Rules (e.g. 6 days on morning shift $\rightarrow$ 1 day off $\rightarrow$ 6 days on night shift).
- Night shift allowance calculation rules.
- **Peer-to-Peer Shift Swapping**: Employee A selects a shift with Employee B; Employee B accepts; routes to Manager for one-click approval.

### 2.6 Attendance Regularization & Penalties
- Missed Punch Regularization workflows with manager sign-off.
- On-Duty (OD) and Work-From-Home (WFH) application workflows.
- Late-In, Early-Out, and Short-Hours penalty matrix:
  - Configurable grace time (e.g., 15 minutes).
  - Penalty rule: Every 3 late arrivals in a month automatically trigger a half-day Loss of Pay (LOP) or leave deduction.
- Break Tracking: Paid vs Unpaid breaks (Lunch, Tea, Smoke), max break duration alerts, and automatic clockout safeguards.

---

## 3. Leave & Absence Management Engine

### 3.1 Flexible Policy Engine & Accruals
- Custom leave types: Paid Leave (PL), Casual Leave (CL), Sick Leave (SL), Maternity, Paternity, Bereavement, Sabbatical, Loss of Pay (LOP).
- Accrual Frequencies: Daily, Monthly (e.g. 1.75 days/month), Quarterly, Annual.
- Pro-rata calculations for employees joining or resigning mid-cycle.
- Tenure-based accrual rules (e.g., employees with $> 3$ years service receive 2 extra days/year).
- Maximum carry-forward limits, year-end balance lapsing, and encashment payout rules.

### 3.2 Deterministic Sandwich Policy Rule Engine
- When an employee takes leave on Friday and Monday:
  - If `sandwich_rule == true`, the engine automatically detects intervening weekends and public holidays and adds them to the leave request.
  - Transparent UI: Shows the employee exact deductions before application.

### 3.3 Compensatory Off (Comp-Off) Auto-Creditor
- If an employee logs $> 4.5$ hours on a weekend or public holiday:
  - The system automatically credits a Comp-Off balance to their leave ledger.
  - Validity window: Automatically expires unused Comp-Offs after 60 days.

### 3.4 Clubbing Rules & Team Leave Overlap Blackout
- Clubbing Restrictions: E.g., Sick Leave cannot be combined with Casual Leave without a medical certificate attachment.
- Department Overlap Protection: Prevents understaffing by rejecting leave requests if team absence on that date exceeds a configured threshold (e.g. maximum 20% of the team on leave).
- Blackout Dates: Restrict leave applications during business-critical windows (e.g. quarterly close, product launches).

### 3.5 Multi-Tier Approval Hierarchies
- Dynamic approval routing:
  - Step 1: Reporting Manager $\rightarrow$ Step 2: Department Head $\rightarrow$ Step 3: HR Operations.
- Automated escalation: If a manager does not approve/reject within 48 hours, the request automatically escalates to the Department Head.

---

## 4. Timesheets & Project Costing Engine

### 4.1 Real-Time Stopwatch & Manual Time Logs
- Persistent timer widget on Web top navigation and Mobile notification tray.
- Logs tagged by Client, Project, Job, and Task.
- Billable vs Non-Billable classifications.

### 4.2 Automated Weekly Lockout & Compliance
- Strict time submission schedules (e.g., Every Monday at 10:00 AM).
- Automated reminders sent via WebSockets, Mobile Push, and Email to employees with unsubmitted hours.
- Dual Approval: Project Manager approves for billing accuracy; Reporting Manager approves for attendance/payroll reconciliation.

### 4.3 Client Cost Centers & Labor Profitability
- Combines logged employee hours with their internal hourly salary cost from HR:
  $$\text{Incurred Labor Cost} = \sum (\text{Hours Logged} \times \text{Employee Hourly Cost})$$
- Real-time project profitability and margin dashboard showing actual vs budgeted spend.

---

## 5. Performance Management System (PMS - 100% Objective)

### 5.1 Cascading OKRs & Quantitative KRAs
- Objectives cascade from Company $\rightarrow$ Department $\rightarrow$ Team $\rightarrow$ Individual.
- Key Results are strictly measurable:
  - Numbers, Currency, Percentages, Milestone checklists.
- Mathematical progress aggregation without subjective human bias.

### 5.2 360-Degree Multi-Rater Feedback
- Configurable appraisal cycles: Annual, Semi-Annual, Quarterly.
- Reviewer types: Self-appraisal, Reporting Manager, Direct Reports, Peers, External Stakeholders.
- Configurable anonymity: Anonymous peer reviews or transparent named reviews.

### 5.3 9-Box Grid & Bell Curve Normalization
- **9-Box Grid**: Plots employees across Performance (X-axis) vs Potential (Y-axis) based on quantitative review scores.
- **Bell Curve Normalization**: Assists HR leadership in standardizing performance ratings across departments to ensure consistent compensation review distributions.

### 5.4 Continuous 1-on-1s & PIP Management
- 1-on-1 Meeting Cadence: Agendas, shared notes, action items with target resolution dates.
- Performance Improvement Plans (PIP): Defined objectives, milestone review dates, formal sign-offs, and outcomes (Successful completion vs Exit initiation).

---

## 6. Travel & Expense Desk

### 6.1 Travel Request & Advance Booking
- Domestic and International travel requests with itinerary details, flight preferences, hotel requirements, and travel advances.
- Multi-tier approval routing (Manager $\rightarrow$ Finance Travel Desk).

### 6.2 Expense Claims & Multi-Currency Vouchers
- Mileage calculator for field travel.
- Multi-currency expense filing with real-time conversion rates.
- Policy Compliance Checker: Flags expenses exceeding daily limits (e.g. food allowance $> \$50/\text{day}$).
- Cryptographic Receipt Hashing: SHA-256 hash generated on uploaded receipts to prevent duplicate expense claims.
- Automated reimbursement reconciliation with payroll.

---

## 7. Employee Helpdesk & Internal HR Query Desk

### 7.1 Multi-Category Ticketing Portal
- Categories: Payroll Queries, PF & Tax Clarifications, IT Assets, Insurance & Benefits, Workplace Admin, General HR Policies.
- Priority levels: Low, Medium, High, Urgent.

### 7.2 SLA Matrix & Automated Dispatch
- Business-hour SLA resolution targets.
- Auto-assignment rules: Routes tickets to specific HR representatives based on category and employee branch location.
- Canned responses, internal private notes between HR staff, and employee satisfaction (CSAT) ratings upon resolution.

---

## 8. Onboarding & Exit Lifecycle Management

### 8.1 Candidate Pre-Boarding Portal
- Secure candidate login prior to Day 1:
  - Document upload (IDs, certificates, previous company payslips).
  - Emergency contacts, nominee details, bank account info.
  - Digital signing of Offer Letter and Non-Disclosure Agreement (NDA).

### 8.2 Onboarding Journey Checklists
- Custom onboarding task lists: Day 1 orientation, Day 7 IT check, Day 30 manager check-in, Day 60 review, Day 90 probation completion.
- Automated buddy assignment and welcome broadcast on company feed.

### 8.3 Digital Exit Management & Full & Final (F&F)
- Resignation submission with formal reason capture and notice period tracking.
- Notice period buyout calculation (shortfall days $\times$ daily wage).
- **Multi-Department Clearance Matrix (NOC)**:
  - IT: Hardware return, revoke email & SSO tokens.
  - Finance: Travel advances, loan repayments.
  - Admin: Parking tags, access cards.
  - HR: Exit interview questionnaire, leave encashment sign-off.
- **Full & Final Settlement Engine**:
  $$\text{F\&F Payout} = \text{Unpaid Wages} + \text{Encashable Leaves} + \text{Gratuity} - \text{Notice Shortfall} - \text{Tax Deductions}$$
- Automated generation of Relieving Letter and Experience Certificate.

---

## 9. Compensation, Benefits & Payroll Preparation

### 9.1 CTC Structure & Compensation Components
- Earnings: Basic, House Rent Allowance (HRA), Dearness Allowance (DA), Conveyance, Special Allowance, Performance Bonus.
- Deductions: Provident Fund (PF), Employee State Insurance (ESI), Professional Tax (PT), Tax Deducted at Source (TDS).

### 9.2 Automated Loss of Pay (LOP) Calculation
- Deterministically aggregates unpaid leaves, unauthorized absences, and late arrival penalties from the Attendance Engine.
- Calculates exact payable days for payroll:
  $$\text{Payable Days} = \text{Total Calendar Days} - (\text{Unpaid Leaves} + \text{Attendance Penalty Days})$$

### 9.3 Tax Declarations & Investment Proofs
- Employee tax regime selection (Old vs New Tax Regime).
- Form 12BB investment declarations (Section 80C, 80D, HRA rent receipts, Home Loan interest).
- Document verification workflow with HR rejection/approval comments.
- Bank-Ready Payout Export: Standard NEFT/RTGS CSV files for direct upload to corporate banking portals.
