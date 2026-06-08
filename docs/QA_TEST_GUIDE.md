# Galaxy Backbone Limited (GBB) - Internal Audit Management Software (IAMS)

## Comprehensive System Specification, RBAC Directory, and End-to-End QA Manual Testing Guide

---

## 1. Document Control & Metadata

* **Document Version:** 1.0.0 (Release-Ready Reference)
* **Client Owner:** Galaxy Backbone Limited (GBB) - Internal Audit Department
* **Release State:** System Deployed / Pre-QA Sign-off
* **Document Classification:** GBB Internal & Confidential

---

## 2. System Context & Business Overview

The **Internal Audit Management Software (IAMS)** is a custom enterprise platform developed for **Galaxy Backbone Limited (GBB)**, a Federal Government of Nigeria information technology service provider. The system is designed to digitalize and automate GBB's end-to-end internal audit lifecycle, transitioning operations from manual paper-based or spreadsheet workflows into a structured, trackable, and role-governed environment.

### 2.1 Deployment & Environmental Context
IAMS is engineered for on-premises hosting within GBB's private cloud (**GCS - Galaxy Cloud Services**) or on-premise datacenters. It relies on a Microsoft SQL Server database schema and integrates directly with corporate Active Directory for user access control.

### 2.2 Compliance Scope & Mandates
To support GBB's role as an infrastructure and security provider, the software embeds compliance hooks and terminology aligned with the following global and national standards:
* **ISO 27001** (Information Security Management System)
* **ISO 9001** (Quality Management System)
* **ISO 20000** (IT Service Management)
* **ISO 22301** (Business Continuity Management)
* **NDPR** (Nigeria Data Protection Regulation)
* **COBIT & NIST** (IT Security & Governance Frameworks)
* **PCI DSS** (Payment Card Industry Data Security Standard)

### 2.3 External Systems Interactivity (Read-Only)
To maintain a clear boundary of corporate state, IAMS connects to GBB's existing tools in a strict **READ-ONLY** manner via structural adapters. Under no circumstances does IAMS write back to these external systems:
* **ERP (Dynafin):** GBB's primary Enterprise Resource Planning (ERP) suite. Extracted data is used to verify procurement logs, assets, and departmental transactions.
* **ITSM (IMOC):** GBB's IT Service Management (ITSM) tool. Extracted data provides IT incident records, service levels, and system change lists.
* **Identity (AD):** Supplies organization charts, staff profiles, and corporate authentication.
* **Projects (Project Plus):** Corporate project registry, permitting auditor tracking of ongoing government IT initiatives.
* **Shared Drive:** Legacy document storage archives, read for historical audit documentation references.

---

## 3. Tech Stack & Environment Guide

The system is implemented as a **Modular Monolith**, combining all services into a single database schema and Node.js process while enforcing structural separation:
* **Backend Layer:** Node.js (v20+) with Express and strict-mode TypeScript.
* **Database Layer:** Prisma ORM connected to Microsoft SQL Server.
* **Frontend Layer:** Next.js (v14 App Router) utilizing Tailwind CSS for a premium, clean enterprise UI.
* **Authentication:** OpenID Connect (OIDC) integrated with Azure AD, plus a secure local credentials database for failover and developer environments.
* **Storage Adapter:** Local storage adapter for file binaries during development (UUID-encrypted file naming), swap-ready for Azure Blob Storage in production.
* **Background Jobs:** `node-cron` runner writing job status to SQL Server tables (`scheduled_jobs` / `scheduled_job_runs`) for automated compliance checks.

### 3.1 Running the QA Environment
Ensure that the following endpoints are accessible in the local QA testing sandbox:
1. **Backend API:** [http://localhost:3000](http://localhost:3000) (Backend REST API server)
2. **Frontend Web App:** [http://localhost:3001](http://localhost:3001) (Next.js administrative frontend web portal)
3. **API Documentation:** [http://localhost:3000/docs](http://localhost:3000/docs) (Swagger OpenAPI document explorer)

---

## 4. Detailed Module & Page Directory

IAMS consists of 10 logical backend modules and 21 distinct web routes. Below is the full directory detailing what works, where it resides, and what it covers:

| Module Name | Web Routes | Status / Functionality |
| :--- | :--- | :--- |
| **1. Auth / User** | `/login`, `/users`, `/users/:id` | **Complete.** Handles OIDC and local credentials login, profile management, password resets, and user skills tags. |
| **2. Dashboard** | `/dashboard` | **Complete.** Role-specific dashboards. Auditees see only their pending findings; CAE/Managers see summaries, charts, workload, and escalations. |
| **3. Risk Register** | `/risk`, `/risk/[id]` | **Complete.** Holds enterprise risks, categories, and assessments. Scores multiply likelihood * impact, plotting trend lines. |
| **4. Audit Universe** | `/audit/universe`, `/audit/universe/[id]` | **Complete.** List of GBB assets/departments. Recalculates risk scores based on linked Risk Register assessments. |
| **5. Audit Planning** | `/audit/plans`, `/audit/plans/[id]` | **Complete.** Drafts annual plans, adds universe items, and runs approvals through Workflow. Rollover creates engagements. |
| **6. Engagements** | `/audit/engagements`, `/audit/engagements/[id]` | **Complete.** Tabbed engagement console. Houses checklists, working papers, evidence uploads, findings, reports, and follow-ups. |
| **7. Documents** | `/documents` | **Complete.** Explorer interface. Manages document uploads, version snapshots, templates, and server-side storage streaming. |
| **8. Workflow Hub** | `/workflow` | **Complete.** Handles inbox approvals, staff assignments, escalation schedules (L1 to L4), and policy configs. |
| **9. Audit Trail Logs** | `/logs` | **Complete.** Log directory capturing IP, user agent, module, action, and JSON diffs of changes. |
| **10. System Settings** | `/settings` | **Complete.** Houses default templates, config key/value overrides, audit lifecycle rules, and role permission tables. |
| **11. Integrations** | `/integrations` | **Placeholder Shell.** UI displays "Coming Soon" while external integrations remain mocked for testing. |
| **12. Predictive** | `/predictive` | **Placeholder Shell.** UI displays "Coming Soon" for future AI NLP finding classifiers. |

---

## 5. Complete Permissions Catalog (RBAC)

IAMS enforces access security using granular permissions mapped to specific roles. Below is the list of all 60 system permissions defined in the database:

### 5.1 User & Auth Permissions
* `user:read` — View profiles, users list, and skill tags.
* `user:create` — Create new local users in the database.
* `user:update` — Modify existing profiles and credentials.
* `user:delete` — Performs a soft-delete on users (sets `deleted_at`).
* `user:deactivate` — Toggle user activation status.
* `user:admin` — Full RBAC administrative controls (role assignments).
* `role:read`, `role:create`, `role:update`, `role:delete` — Access to view and manage the roles registry.
* `role:assign` — Assign roles to users.
* `permission:read` — View all system permissions.

### 5.2 Risk Module Permissions
* `risk:read`, `risk:read_all` — Access to search and view the corporate risk registry.
* `risk:create`, `risk:update`, `risk:delete` — Access to log and modify risks in the registry.
* `risk:assess` — Submit new Likelihood * Impact assessments and update risk scores.
* `risk_category:read`, `risk_category:write`, `risk_category:delete` — Manage categories (e.g., Financial, IT).
* `risk_monitoring:read` — Access to view risk monitoring dashboards and metrics.

### 5.3 Audit Universe & Planning Permissions
* `universe:read`, `universe:create`, `universe:update`, `universe:delete` — Manage the auditable assets and entities list.
* `plan:read`, `plan:create`, `plan:update` — Draft and edit annual audit plans.
* `plan:add_item` — Link audit universe items to draft plans.
* `plan:submit` — Trigger the plan approval workflow request.
* `plan:approve`, `plan:reject` — Executive authority to approve/reject draft plans.

### 5.4 Engagements & Checklist Permissions
* `engagement:read`, `engagement:read_all` — Permission to view active/planned audit engagements.
* `engagement:create`, `engagement:update`, `engagement:delete` — Permission to initialize engagements from plans.
* `checklist:read`, `checklist:update` — Control checklists access, running tests.

### 5.5 Working Papers & Evidence Permissions
* `working_paper:read`, `working_paper:create`, `working_paper:update` — Draft and compile working papers.
* `working_paper:submit` — Submit working papers to managers for review.
* `working_paper:approve`, `working_paper:reject` — Managerial approval of working papers.
* `evidence:read`, `evidence:upload`, `evidence:dispute` — Auditors and auditees to manage evidence files.

### 5.6 Findings & Reports Permissions
* `finding:read`, `finding:read_all`, `finding:create`, `finding:update`, `finding:close` — Complete management of findings raised during audits.
* `followup:read`, `followup:respond`, `followup:evidence`, `followup:verify` — Manage follow-up actions and auditee remediations.
* `report:read`, `report:create`, `report:update`, `report:export` — Draft and review final audit reports.
* `report:submit`, `report:approve`, `report:reject` — Govern report approval workflow steps.
* `report:issue` — CAE only. Closes the audit and issues report to GBB.

### 5.7 Infrastructure & System Permissions
* `document:read`, `document:write`, `document:delete` — Direct backend operations on file assets.
* `log:read`, `log:summary` — View security audit trails and aggregate stats.
* `job:read`, `job:admin` — Execute and manage background crons.
* `settings:read`, `settings:manage` — Modify system thresholds, configs, and templates.

---

## 6. Seeded Test Users & Credentials

Use the following seeded accounts during manual testing. They have been configured with specific role allocations representing GBB's organizational structure:

| Display Name | Email Address | Primary Role | Local Dev Password |
| :--- | :--- | :--- | :--- |
| **Bello Adesanya** (CAE/Admin) | `admin@example.com` | `super_admin` | `Bello@123456!` |
| **Tunde Bakare** (Lead Auditor) | `tunde@gbb.gov.ng` | `audit_lead` | `Tunde@123456!` |
| **Adaeze Okonkwo** (Audit Mgr) | `adaeze@gbb.gov.ng` | `audit_manager` | `Adaeze@123456!` |
| **Emeka Eze** (Staff Auditor) | `emeka@gbb.gov.ng` | `auditor` | `Emeka@123456!` |
| **Chisom Okafor** (Head Finance) | `chisom@gbb.gov.ng` | `auditee` | `Chisom@123456!` |
| **Ibrahim Musa** (Director) | `ibrahim@gbb.gov.ng` | `director` | `Ibrahim@123456!` |
| **Fatima Aliyu** (Executive CAE) | `fatima@gbb.gov.ng` | `cae` | `Fatima@123456!` |

---

## 7. End-to-End Manual Testing Manual

This section details the manual testing scenarios to execute. QAs should perform these in order to verify full business integration.

### Scenario 1: Risk-Universe Integration & Assessment
* **Purpose:** Verify that establishing a risk and scoring it dynamically updates the Audit Universe entity's score, driving automated audit scheduling priorities.
* **Step 1:** Login to the portal (`http://localhost:3001`) as Auditor: `emeka@gbb.gov.ng` / `Emeka@123456!`.
* **Step 2:** Go to **Audit Universe** (`/audit/universe`) via the navigation sidebar. Inspect the list. Click on "Finance Department". Take note of the current "Calculated Risk Score" (e.g., 0 or a low baseline).
* **Step 3:** Go to **Risk Register** (`/risk`) via the sidebar. Click **New Risk**. Set Title to *"Unauthorized Treasury Withdrawals"*, select Category = *"Financial"*, and under "Linked Universe Entity" dropdown choose *"Finance Department"*. Click **Create Risk**.
* **Step 4:** Navigate to the newly created risk details page. Click the **Record Assessment** button. Set Likelihood = **4** and Impact = **5** (High-Critical quadrant). Input assessor notes and click **Submit Assessment**.
* **Step 5:** Go back to **Audit Universe** (`/audit/universe`) and select "Finance Department". Verify that the Risk Score has updated to **20** (Likelihood * Impact) and that the status has flagged as High Priority.
* **Step 6 (API Verification):** Verify that a GET request to `/api/v1/universe/{id}` returns the updated score and that `/api/v1/logs` registers the audit-trail entry.

---

### Scenario 2: Annual Plan Compilation & Rejection Workflow
* **Purpose:** Verify that annual planning items can be compiled, submitted to the CAE, rejected with remarks, revised, and subsequently approved.
* **Step 1:** Login as Lead Auditor: `tunde@gbb.gov.ng` / `Tunde@123456!`.
* **Step 2:** Go to **Audit Plans** (`/audit/plans`). Click **New Plan**. Enter *"2027 Annual Audit Plan"* and select Year = **2027**. Save as Draft.
* **Step 3:** Open the draft plan, click **Add Plan Item**. Select Universe Entity = *"Finance Department"*, Priority = *"High"*, Audit Type = *"Financial"*, and Quarter = *"Q1"*. Save.
* **Step 4:** Click **Submit for Approval**. The status should change to *"submitted"*. Close session.
* **Step 5:** Login as CAE: `fatima@gbb.gov.ng` / `Fatima@123456!`.
* **Step 6:** Go to **Workflow Hub** (`/workflow`). Under "Approval Inbox", click the pending item *"2027 Annual Audit Plan"*. Click **Reject**. Input reason: *"Add IT Infrastructure Audit before approval"* and click Submit.
* **Step 7:** Verify the plan status in the UI transitions to *"rejected"*.
* **Step 8:** Login back as Lead Auditor (Tunde). Add *"IT Infrastructure"* to the plan and click **Submit for Approval** again.
* **Step 9:** Login back as CAE (Fatima). Locate the plan in your inbox and click **Approve**. Verify the status changes to *"approved"*.

---

### Scenario 3: Engagement Initialization & Checklist Auditing
* **Purpose:** Convert an approved plan item into an active audit engagement, allocate resources, and fail a control checklist test to document deficiencies.
* **Step 1:** Logged in as Lead Auditor (Tunde), go to **Audit Plans** (`/audit/plans`) and click the approved *"2027 Annual Audit Plan"*.
* **Step 2:** Select the "Finance Department" plan item. Click **Initialize Engagement**. Set SLA Deadline (e.g., 1 month out) and click **Create**. Engagement status is now *"planned"*.
* **Step 3:** Go to the newly created Engagement details. Click the **Assignments** tab, click **Assign Staff**. Assign Emeka Eze as the Auditor, and Tunde Bakare as the Lead. Click Save. Engagement status transitions to *"in_progress"*.
* **Step 4:** Login as Auditor: `emeka@gbb.gov.ng`. Under **My Work** on the dashboard, click the "Finance Department" engagement.
* **Step 5:** Select the **Checklists** tab. The system should load seeded controls. Edit Control #1 (*"Segregation of Duties"*). Change status to *"Fail"*, input observations: *"Cash handling and reconciliations are managed by the same officer,"* and Save.

---

### Scenario 4: Working Papers & Evidence Tracking
* **Purpose:** Allow staff to upload testing worksheets, link files to control failures, and obtain review clearance from the lead auditor.
* **Step 1:** In the "Finance Department" engagement (logged in as Emeka), select the **Working Papers** tab. Click **New Working Paper**.
* **Step 2:** Select *"Standard Financial Audit Working Paper"* template. The system loads section headings (Objective, Scope, Procedure, Observations). Fill in details. Under Observations, document the segregation of duties failure.
* **Step 3:** Click **Attach Document / Evidence**. Upload a sample file (e.g., PDF or spreadsheet). Click **Submit for Review**. The paper transitions to *"submitted"*.
* **Step 4:** Login as Lead Auditor (Tunde). Go to **Workflow Hub** → **Approval Inbox** (or open the engagement details → "Working Papers" tab). Click **Approve**. Status transitions to *"approved"*.

---

### Scenario 5: Raising Findings & Auditee Remediation Follow-up
* **Purpose:** Elevate checklist failures to official findings, collect auditee management responses, upload remediation documents, and execute auditor verification.
* **Step 1:** Logged in as Emeka (Auditor), go to the Engagement details → **Findings** tab. Click **Add Finding**.
* **Step 2:** Set Title: *"Lack of Segregation in Treasury Management"*. Link to the failed checklist control from Scenario 3. Set Severity = *"High"*, Category = *"Financial"*. Input Root Cause and Recommendations. Click Save.
* **Step 3:** Login as Auditee: `chisom@gbb.gov.ng` / `Chisom@123456!` (Head of Finance).
* **Step 4:** On the dashboard, click the active Finding notification. In the details, click **Add Management Response**. Enter: *"We will recruit a separate accountant to manage bank reconciliations by June 15."* Save.
* **Step 5:** Later, click **Submit Remediation Evidence**. Upload an evidence PDF (e.g., employee appointment letter or process flow). Click Submit.
* **Step 6:** Login as Auditor (Emeka). Go to the Finding page. Review the uploaded PDF. Click **Verify Remediation**. Input verification notes, select *"Verified"* and click Save. Status updates to *"closed"*.

---

### Scenario 6: Final Audit Report Compiler & 3-Level Approval
* **Purpose:** Assemble the findings into a report, route it through GBB's strict manager-director-CAE approval sequence, issue the report, and verify the DOCX export.
* **Step 1:** Login as Auditor (Emeka). In the Engagement page, select the **Report** tab. Click **Generate Draft Report**. Select the *"Audit Report - GBB Default"* template. The system pulls all findings and scopes. Save.
* **Step 2:** Click **Submit Report**. The status updates to *"submitted"* and requires 3 levels of approval.
* **Step 3 (Level 1 Approval):** Login as Audit Manager (`adaeze@gbb.gov.ng` / `Adaeze@123456!`). Go to **Workflow Hub** → **Approval Inbox**. Click **Approve** on the report.
* **Step 4 (Level 2 Approval):** Login as Director (`ibrahim@gbb.gov.ng` / `Ibrahim@123456!`). Go to **Workflow Hub** → **Approval Inbox**. Click **Approve**.
* **Step 5 (Level 3 Approval):** Login as Executive CAE (`fatima@gbb.gov.ng` / `Fatima@123456!`). Go to **Workflow Hub** → **Approval Inbox**. Click **Approve**.
* **Step 6 (Issue Report):** Still logged in as Fatima, open the report and click **Issue Report**. The engagement status changes to *"reported"*.
* **Step 7 (Export Verification):** Click the **Export Report (Word)** button. Open the downloaded `.docx` file. Verify that all findings, executive summaries, and approval details are rendered correctly.

---

## 8. Operational Auditing & Troubleshooting

Verify that the system background components are functioning correctly:

### 8.1 Notification System
All event-driven alerts write to a DB-backed queue first rather than executing inline SMTP commands. Inspect `email_logs` and `notification_queue` tables to check email dispatch states. QAs can review active templates via `/api/v1/notifications/templates` and check queue metrics using `/api/v1/notifications/queue/stats`.

### 8.2 Scheduled Jobs Control
Ensure crons are registered. Go to `/api/v1/jobs` to confirm execution logs for:
1. `BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE` (Processes email queue)
2. `BG:WORKFLOW:ESCALATION:HOURLY` (Checks overdue engagement SLA and approval limits)
3. `BG:TOKEN:CLEANUP:HOURLY` (Clears expired sessions)
4. `BG:DOCUMENT:VERSION:PRUNE:WEEKLY` (Weekly document cleanup job)

### 8.3 Diffs Log Inspection
Navigate to **Logs** (`/logs`) after completing the E2E scripts. Inspect the latest log. Click to open details and verify the JSON diff payload accurately logs old vs new values alongside IP addresses and user agents.
