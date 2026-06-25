# IAMS — Full End-to-End Test Script

> A single follow-along walkthrough that takes one audit from **Super Admin login → audit closure**, touching every module, and shows how the system *feels* for each kind of user (especially the **auditee**).
>
> Built fresh from the codebase (`src/modules/**`, `prisma/seed.ts`, `frontend/**`) — not from any prior QA doc. Endpoints, permissions, statuses and gates below match what the code actually enforces as of this writing.

---

## 0. Before you start

### 0.1 Run the stack

| Service | Command (from `audit-system/`) | URL |
|---|---|---|
| Backend API | `npm run dev` | http://localhost:3000 |
| API base path | — | `http://localhost:3000/api/v1` |
| Swagger docs | — | http://localhost:3000/docs |
| Frontend (Next.js) | `cd frontend && npm run dev` | http://localhost:3001 |

Seed/reset data first if needed: `npx prisma migrate deploy` then `npx ts-node prisma/seed.ts` (or your seed script).

**Do the whole script in the UI at http://localhost:3001.** API calls are given only as optional verification (`✔ API check`).

### 0.2 The cast (seeded users)

| # | Person | Email | Password | Role | What they're here to do |
|---|---|---|---|---|---|
| 1 | Bello Adesanya | `admin@example.com` | `Bello@123456!` | **super_admin** | See/operate everything; set up users & system config |
| 2 | Adaeze Okonkwo | `adaeze@gbb.gov.ng` | `Adaeze@123456!` | **audit_manager** | Owns the programme: universe, risk, plans, engagement creation, WP/report/finding approvals |
| 3 | Tunde Bakare | `tunde@gbb.gov.ng` | `Tunde@123456!` | **audit_lead** | Runs assigned engagements, verifies remediation |
| 4 | Emeka Eze | `emeka@gbb.gov.ng` | `Emeka@123456!` | **auditor** | Fieldwork: checklists, working papers, evidence, findings |
| 5 | Chisom Okafor | `chisom@gbb.gov.ng` | `Chisom@123456!` | **auditee** | Responds to findings, uploads remediation evidence |
| 6 | Ibrahim Musa | `ibrahim@gbb.gov.ng` | `Ibrahim@123456!` | **director** | Level-2 report approval (oversight) |
| 7 | Fatima Aliyu | `fatima@gbb.gov.ng` | `Fatima@123456!` | **cae** | Approves plans; Level-3 report approval; **issues** reports |

> ⚠️ **Role facts the code enforces (different from intuition):**
> - **`audit_lead` (Tunde) cannot create plans or engagements** — he only has `plan:read` / `engagement:read,update`. **Plan and engagement creation belong to `audit_manager` (Adaeze)** (and super_admin).
> - **`auditor` (Emeka) cannot generate the report** — `report:create` is `audit_manager`/super_admin only. Emeka does fieldwork + findings; **Adaeze drafts & submits the report**.
> - **Report Level-1 approver is the engagement's assigned Audit Manager** (pinned by `audit_manager_id`), Level-2 = a `report:approve:oversight` holder (Director), Level-3 = a `report:approve:final` holder (CAE).
> - **Working-paper approval and finding-closure approval are both done by the engagement's Audit Manager** (Adaeze), not the lead auditor.

### 0.3 The lifecycle you are about to drive

```
PLAN:        draft ──submit──▶ submitted ──approve/reject──▶ approved / rejected
                                              (CAE: plan:approve)

ENGAGEMENT:  planned ─▶ in_progress ─▶ under_review ─▶ reported ─▶ closed
                gate1↑       gate2↑          gate3↑        gate4↑

FINDING:     open ─▶ management_response_received ─▶ in_remediation ─▶ verified
                  ─▶ (close request) pending_closure ─▶ [closure approval] ─▶ closed
```

**Gates the backend enforces (all ON by default — `audit-config.utility.ts`):**

| Transition | Gate |
|---|---|
| `planned → in_progress` | none; side-effect: **checklists auto-populate** from the audit type's control set |
| `in_progress → under_review` | **every** checklist item must be tested (none `not_tested`) **AND** ≥1 working paper exists and **all** working papers are `approved` |
| `under_review → reported` | an audit report with status `issued` must exist |
| `reported → closed` | **every** finding must be `closed` |

Keep this table open — when a status button is greyed out or a 400 comes back, this is why.

---

## PART 1 — Super Admin orientation (Bello)

**Login as `admin@example.com` / `Bello@123456!`.**

1. Open http://localhost:3001 → you land on `/login`. Enter the email + password, submit.
   - ✅ **Expected:** If 2FA is not yet enrolled you're logged straight in (you may see a "set up 2FA" banner — 2FA is mandatory only after a grace window). If 2FA *is* enabled on the account you're sent to `/login/2fa` for a code. Either way you arrive at `/dashboard`.

2. Look at the **left sidebar**.
   - ✅ **Expected:** Super admin sees the full menu: Home, Workflow (Audit Approvals, Assignments, Escalations, Requests, Escalation Policies), Audit Modules group, Audit (Universe, Plans, Engagements, Findings, Reports, Compliance Frameworks, Evidence Repository), Notifications, Assets, Risk Register, Documents, Analytics, Audit Logs, Users, Settings. Nothing is hidden.

3. Go to **Users** (`/users`).
   - ✅ **Expected:** All 7 seeded users listed with their roles. You can open a user and see roles/permissions. (Create/Update/Deactivate controls are visible because super_admin holds `user:create/update/deactivate/admin` + `role:assign`.)
   - ✔ API check: `GET /api/v1/users` returns the 7 active users.

4. Go to **Settings** (`/settings`).
   - ✅ **Expected:** Tabs render: System Config (key/value), Audit Customization (lifecycle rules, checklist templates per audit type, SLA defaults), Report templates, Working-paper templates, Roles/permissions table, and the Directory (Azure AD group→role) mapping tab. Confirm the **Audit lifecycle rules** show the four gates from §0.3 all enabled.

5. Go to **Audit Logs** (`/logs`).
   - ✅ **Expected:** A reverse-chronological trail. Your own login shows up. Each entry has actor, module, action, IP, user-agent; opening one shows a JSON diff (old/new values). Keep this tab handy — you'll re-check it at the end.

> **Why super admin first:** it confirms the environment is healthy and that RBAC isn't accidentally hiding things globally. From here on we deliberately switch to the *least-privileged* role that can do each step, so we can feel the permission boundaries.

---

## PART 2 — Foundation data: Universe + Risk (Adaeze, Audit Manager)

**Log out, log in as `adaeze@gbb.gov.ng` / `Adaeze@123456!`.**

6. Sidebar sanity check.
   - ✅ **Expected:** Adaeze sees Universe, Plans, Engagements, Findings, Reports, Compliance, Evidence Repository, Workflow (she has `approval:read` + `assignment:read`), Risk Register, Assets, Documents, Analytics, Audit Logs, **Settings (read-only)**, **Users (read-only)**. She does **not** get write controls in Settings (`settings:manage` is missing).

7. **Audit Universe** (`/audit/universe`) → **New Entity**. Create *"Finance Department"*, Category = `department`, Status = `active`. Save.
   - ✅ **Expected:** Entity created, appears in the list with a baseline calculated risk score (0 / low). 
   - ✔ API check: `POST /api/v1/universe` → 201; entity has `id`.

8. **Risk Register** (`/risk`) → **New Risk**. Title *"Unauthorized Treasury Withdrawals"*, Category = `Financial`, link to Universe entity *"Finance Department"*. Create.
   - ✅ **Expected:** Risk created and shows on the register. Because Adaeze has `risk:create`, the button works.

9. Open the risk → **Record Assessment**. Likelihood = **4**, Impact = **5**, add assessor note. Submit.
   - ✅ **Expected:** Assessment saved; **risk score = 20** (likelihood × impact), flagged High/Critical. A trend point is recorded.
   - ✔ API check: `POST /api/v1/register/:id/assessments` → score 20; `GET /api/v1/monitoring/high-risk` now includes this risk.

10. Go back to **Audit Universe → Finance Department**.
    - ✅ **Expected:** The entity's **calculated risk score reflects the linked assessment** (recalculated upward / flagged high priority). This proves Risk → Universe integration.

---

## PART 3 — Annual Plan: build, submit, reject, revise, approve

### 3a. Manager builds & submits (Adaeze)

11. **Audit Plans** (`/audit/plans`) → **New Plan**. Name *"2027 Annual Audit Plan"*, Year = 2027. Save as draft.
    - ✅ **Expected:** Plan created with status **`draft`**. (Adaeze has `plan:create`.)

12. Open the plan → **Add Plan Item**: Universe = *Finance Department*, Priority = `High`, Audit Type = `financial`, Quarter = Q1. Save.
    - ✅ **Expected:** Item added to the draft. (`plan:add_item`.)

13. Click **Submit for Approval**.
    - ✅ **Expected:** Status → **`submitted`**. A workflow approval is created and routed to a `plan:approve` holder. Plan becomes read-only to the submitter.
    - ✔ API check: `POST /api/v1/plans/:id/submit` → status `submitted`.

### 3b. CAE rejects with remarks (Fatima)

14. **Log in as `fatima@gbb.gov.ng` / `Fatima@123456!`** → **Workflow → Audit Approvals** (`/workflow/approvals`).
    - ✅ **Expected:** The *2027 Annual Audit Plan* appears in her inbox (CAE holds `plan:approve` + `approval:read`).

15. Open it → **Reject**, reason: *"Add IT Infrastructure audit before approval."* Submit.
    - ✅ **Expected:** Plan status → **`rejected`**; rejection reason captured; submitter notified. Item leaves Fatima's inbox.

### 3c. Manager revises & resubmits (Adaeze)

16. **Log back in as Adaeze** → open the rejected plan → add a second item (Audit Type `it`, e.g. *IT Infrastructure*) → **Submit for Approval** again.
    - ✅ **Expected:** Status returns to **`submitted`**.

### 3d. CAE approves (Fatima)

17. **Log in as Fatima** → **Workflow → Audit Approvals** → open the plan → **Approve**.
    - ✅ **Expected:** Status → **`approved`**. The plan item is now eligible to spawn an engagement. (`PLAN_TRANSITIONS`: only `submitted → approved/rejected`; an approved plan is terminal.)

> Negative check (optional): while logged in as Fatima, try to find a "New Plan" button — there isn't one. CAE has `plan:read/approve/reject` but **not** `plan:create`.

---

## PART 4 — Engagement initialization & staffing (Adaeze)

**Log in as Adaeze.**

18. Open the approved plan → select the **Finance Department** item → **Initialize Engagement**. Fill the required fields:
    - **Lead Auditor** = Tunde Bakare
    - **Audit Manager** = Adaeze Okonkwo *(this becomes the Level-1 approver for WP/report/finding-closure — set it deliberately)*
    - **Auditee** = Chisom Okafor
    - Planned start/end + **SLA deadline** (e.g. 30 days out)
    - Create.
    - ✅ **Expected:** Engagement created with status **`planned`**, auto-assigned a reference like `AUD-2027-001`. The plan item is now flagged `engagement_created` (you can't create a second engagement from the same item — that returns a conflict).
    - ✔ API check: `POST /api/v1/engagements` → 201; `status: "planned"`.

19. Open the engagement → **Assignments** tab → **Assign Staff**: add **Emeka Eze** as `supporting_auditor`. Save.
    - ✅ **Expected:** Emeka is now a workflow assignee on the engagement (so it'll show under his "My Work"). Assignment role options are only **Lead Auditor / Supporting Auditor** (these are the only `WorkflowAssignmentRole` values). 
    - ℹ️ Note: assigning staff requires `assignment:create` — Adaeze (manager) has it; **Tunde the lead does not**, so staffing is a manager action.

20. Move the engagement **`planned → in_progress`** (status control / "Start Engagement"). 
    - ✅ **Expected:** Status → **`in_progress`**, `actual_start_date` set, and **checklist items auto-populate** from the `financial` audit type's seeded control set. Open the **Checklists** tab to confirm controls appeared, all with result `not_tested`.
    - ✔ API check: `PATCH /api/v1/engagements/:id/status {status:"in_progress"}` then `GET /api/v1/engagements/:id/checklists` returns the populated controls.

---

## PART 5 — Fieldwork: checklists, working papers, evidence (Emeka, Auditor)

**Log in as `emeka@gbb.gov.ng` / `Emeka@123456!`.**

21. Sidebar reality check for an auditor.
    - ✅ **Expected:** Emeka sees Home, Audit (Universe, Plans, Engagements, Findings, Reports, Compliance, Evidence Repository), Assets, Documents, Notifications, Analytics. He **does not** see **Risk Register** (auditor has no `risk:read`), **Workflow** (no `approval:read`/`assignment:read`), **Users**, **Settings**, or **Audit Logs**. This is the first strong "feel" of least privilege.

22. Open the Finance engagement (via dashboard "My Work" or `/audit/engagements`). 
    - ✅ **Expected:** Because of engagement scoping, Emeka sees it (he's an assignee). A non-party auditor would not.

23. **Checklists** tab → open Control #1 (e.g. *Segregation of Duties*) → set Result = **Failed**, observation: *"Cash handling and reconciliation performed by the same officer."* Save. Then mark the **remaining** controls as `Passed` / `Not Applicable` so **none stay `not_tested`**.
    - ✅ **Expected:** Each save updates that item's result + progress meter. ⚠️ You must clear *all* `not_tested` items or the `under_review` gate will block you later.
    - ✔ API check: `GET /api/v1/engagements/:id/checklists/progress` shows 0 `not_tested`.

24. **Working Papers** tab → **New Working Paper** → pick the standard template, fill Objective/Scope/Procedure/Observations (document the segregation failure). Save (status `draft`).
    - ✅ **Expected:** Working paper created in **`draft`**.

25. **Evidence**: from the working paper (or Evidence tab) **Upload** a sample file (PDF/xlsx). Optionally link it to the failed checklist item and/or the working paper.
    - ✅ **Expected:** File stored via the storage adapter (UUID-named); evidence appears in the engagement's evidence list and in the central **Evidence Repository**. (`evidence:upload`.)

26. On the working paper → **Submit for Review**.
    - ✅ **Expected:** Working paper status → **`submitted`**; a working-paper approval is routed to the **engagement's Audit Manager (Adaeze)**.
    - ✔ API check: `POST /api/v1/working-papers/:id/submit` → `submitted`.

> Negative check (optional, as Emeka): open the **Reports** tab and look for "Generate Report". ✅ **Expected:** no generate/draft control (auditor lacks `report:create`); he can only read reports.

---

## PART 6 — Working-paper approval (Adaeze, Audit Manager)

**Log in as Adaeze.**

27. **Workflow → Audit Approvals** (or the engagement's Working Papers tab) → open the submitted working paper → **Approve**.
    - ✅ **Expected:** Working paper status → **`approved`**. Because the chain for working papers is a single level pinned to the engagement manager, **Adaeze is the approver** (not Tunde). Now both `under_review` pre-conditions are satisfiable: all checklists tested + ≥1 approved working paper.
    - ✔ API check: `POST /api/v1/working-papers/:id/approve` → `approved`.

---

## PART 7 — Raising findings (Emeka, Auditor)

**Log in as Emeka.**

28. Engagement → **Findings** tab → **Add Finding**:
    - Title *"Lack of Segregation in Treasury Management"*
    - Link to the failed checklist control from step 23
    - Severity = `high`, Category = `financial`
    - Root cause + recommendation
    - Save.
    - ✅ **Expected:** Finding created with status **`open`**, linked to the engagement and the checklist control. The assigned **auditee (Chisom) is notified**. (`finding:create` — auditor has it; `finding:close` he does **not**.)
    - ✔ API check: `POST /api/v1/engagements/:id/findings` → `status:"open"`.

---

## PART 8 — The auditee's own journey (Chisom) 👈 *this is "how the auditee does his/her own"*

**Log in as `chisom@gbb.gov.ng` / `Chisom@123456!`.**

29. First impression — the sidebar.
    - ✅ **Expected:** Chisom sees a **deliberately small menu**: Home, **Engagements** (read-only, scoped to engagements he's the auditee on), **Findings** (only findings raised against him), Assets, Notifications, Requests, and Analytics (scoped to "Your findings"). He sees **no** Universe, Plans, Reports, Risk Register, Workflow, Documents, Users, Settings, or Logs. This is the most restricted experience in the system.

30. **Dashboard / Notifications**: open the alert about the new finding, or go to **Findings** and open *"Lack of Segregation in Treasury Management"*.
    - ✅ **Expected:** He can read the finding detail (title, severity, recommendation, linked control). He **cannot** edit the finding itself or see other departments' findings — visibility is scoped to his own.

31. **Add Management Response** → e.g. *"We will recruit a dedicated reconciliation officer by 15 June; interim dual-control introduced immediately."* Submit.
    - ✅ **Expected:** Finding status → **`management_response_received`**. The engagement's **lead auditor (Tunde) is notified**. (`followup:respond` — only the assigned auditee or a co-responder may post this; anyone else gets `403 Only an assigned auditee can submit a response`.)
    - ✔ API check: `POST /api/v1/findings/:id/followup/response` → finding `management_response_received`.

32. **Submit Remediation Evidence** → **Upload** a supporting file (e.g. appointment letter / revised SoP). Submit.
    - ✅ **Expected:** Finding status → **`in_remediation`**; the uploaded file is attached to the follow-up with verification status `pending`; lead auditor notified. (`followup:evidence`.) The evidence must belong to the same engagement — cross-engagement files are rejected.
    - ✔ API check: `POST /api/v1/findings/:id/followup/evidence/upload` (multipart) → finding `in_remediation`.

> This is the whole auditee surface: **read my findings → respond → upload remediation evidence → wait for verification.** No drafting, no approving, no programme visibility. That's by design.

---

## PART 9 — Verify remediation & close the finding (Tunde + Adaeze)

### 9a. Lead verifies (Tunde, Audit Lead)

33. **Log in as `tunde@gbb.gov.ng` / `Tunde@123456!`.** Open the finding → review the auditee's response + evidence → **Verify Remediation**: set verification = `verified`, add notes. Submit.
    - ✅ **Expected:** Finding status → **`verified`**; follow-up verification status `verified`; the auditee + co-responders are notified the remediation was accepted. (`followup:verify` — held by audit_lead and audit_manager.)
    - ✔ API check: `POST /api/v1/findings/:id/followup/verify` → finding `verified`.

34. Still as Tunde, on the finding → **Request Closure** ("Close finding").
    - ✅ **Expected:** Finding status → **`pending_closure`** (NOT immediately closed) and a **finding-closure approval** is created, routed to the engagement manager. (`finding:close` — lead/manager have it. A finding must be `verified` first, else `400 Only verified findings can be closed`.)
    - ✔ API check: `POST /api/v1/findings/:id/close` → `pending_closure` + approval created.

### 9b. Manager approves the closure (Adaeze)

35. **Log in as Adaeze** → **Workflow → Audit Approvals** → open the finding-closure approval → **Approve**.
    - ✅ **Expected:** The closure is approved and the finding flips to **`closed`** (closed_by/closed_at set on completion). This single-level closure chain is pinned to the engagement manager.
    - ✔ API check: finding `GET` now shows `status:"closed"`. With every finding closed, the `reported → closed` gate is now satisfiable.

---

## PART 10 — Move engagement to Under Review (Adaeze or Tunde)

36. On the engagement, change status **`in_progress → under_review`**.
    - ✅ **Expected:** Succeeds **only because** (a) no checklist item is `not_tested` and (b) at least one working paper exists and all are `approved`. If either is unmet you get a `400` — e.g. *"Cannot move engagement to review while checklist procedures remain untested"* or *"...while working papers remain unapproved"*. Status → **`under_review`**.

> Try it deliberately broken (optional): create a new working paper and submit it but don't approve it, then attempt `under_review` again → ✅ **Expected:** blocked with the "working papers remain unapproved" error. Re-approve/withdraw to proceed.

---

## PART 11 — Report drafting & 3-level approval

### 11a. Manager drafts & submits (Adaeze)

37. Engagement → **Report** tab → **Generate Draft Report** → choose *"Audit Report - GBB Default"* template.
    - ✅ **Expected:** A report is generated in **`draft`**, auto-pulling engagement metadata + all findings (with the closed treasury finding). (`report:create` — manager/super_admin only.)

38. Review/edit the draft, then **Submit Report**.
    - ✅ **Expected:** Report status → **`submitted`** and a **3-level approval chain** is created:
      - **Level 1** — the engagement's Audit Manager (**Adaeze**, `report:approve`)
      - **Level 2** — a Director (**Ibrahim**, `report:approve:oversight`)
      - **Level 3** — the CAE (**Fatima**, `report:approve:final`)
    - ✔ API check: `POST /api/v1/reports/:id/submit` → `submitted`; `GET /api/v1/approvals/chain/audit_report/:id` shows 3 levels, current level 1.

### 11b. Level 1 — Manager (Adaeze)

39. As Adaeze → **Workflow → Audit Approvals** → open the report approval → **Approve**.
    - ✅ **Expected:** Level 1 satisfied; current level advances to **2**. (Because Adaeze both drafted and is the pinned L1 approver in this 7-user seed, note this is a *self-approval at L1* — fine for the test; in production a separate manager would sit here.)

### 11c. Level 2 — Director (Ibrahim)

40. **Log in as `ibrahim@gbb.gov.ng` / `Ibrahim@123456!`** → **Workflow → Audit Approvals** → open the report → **Approve**.
    - ✅ **Expected:** Level 2 satisfied (Ibrahim holds `report:approve:oversight` + `approval:approve`); current level advances to **3**. Director's menu, by the way, is oversight-only: engagements/findings/reports (all-read), risk, workflow, analytics, logs — no create/settings.

### 11d. Level 3 — CAE (Fatima)

41. **Log in as Fatima** → **Workflow → Audit Approvals** → open the report → **Approve**.
    - ✅ **Expected:** Final level satisfied; report status → **`approved`**. The report is now eligible to be **issued**.
    - ✔ API check: `GET /api/v1/reports/:id` → `approved`.

> Rejection variant (optional): at any level, **Reject** with a reason → report returns to an editable state (`draft`/`rejected`), the chain resets, and the manager must revise and resubmit. Test this once to confirm the loop.

---

## PART 12 — Issue report, mark reported, close the engagement

### 12a. CAE issues the report (Fatima)

42. Still as Fatima, open the approved report → **Issue Report**.
    - ✅ **Expected:** Report status → **`issued`** (`report:issue` — CAE/manager/super_admin). This is the deliberate human act that satisfies the `under_review → reported` gate.
    - ✔ API check: `POST /api/v1/reports/:id/issue` → `issued`.

### 12b. Mark engagement Reported (Adaeze or Tunde)

43. On the engagement, change status **`under_review → reported`**.
    - ✅ **Expected:** Succeeds because an `issued` report now exists. If you skipped step 42 you'd get `400 Cannot mark engagement as reported before an audit report is issued`. Status → **`reported`**.

### 12c. Close the engagement (Adaeze or Tunde)

44. Change status **`reported → closed`**.
    - ✅ **Expected:** Succeeds because **every finding is `closed`** (we closed the treasury finding in Part 9). Status → **`closed`**, `actual_end_date` set, and the linked **Audit Universe entity's `last_audited_at`** is stamped. If any finding were still open you'd get `400 Cannot close engagement while findings remain open or awaiting closure approval`.
    - ✔ API check: `PATCH /api/v1/engagements/:id/status {status:"closed"}` → `closed`; `GET /api/v1/universe/:id` shows updated `last_audited_at`.

🎉 **The audit is now closed end-to-end.**

---

## PART 13 — Deliverables & artifacts

45. **Export the report (Word).** On the issued report → **Export Report (Word)** (`report:export` — manager/lead). Open the `.docx`.
    - ✅ **Expected:** A Word file renders with executive summary, scope, findings table + detail (incl. the closed treasury finding), and approval/issue metadata. Generated server-side (Helvetica, no external Chromium — pdf/docx util path).

46. **Evidence Repository** (`/audit/repository`) and **Documents** (`/documents`).
    - ✅ **Expected:** The evidence and remediation files uploaded earlier are discoverable/searchable; downloads stream from storage. Auditee-uploaded remediation evidence is present and traceable to the finding.

---

## PART 14 — Cross-cutting / infrastructure checks (Bello, super_admin)

**Log in as Bello.**

47. **Audit Logs** (`/logs`).
    - ✅ **Expected:** The full chain of mutations from this run is recorded — plan submit/approve, engagement create + each status change, checklist updates, WP submit/approve, finding create + status changes, follow-up response/evidence/verify, report submit/approve×3/issue, engagement close. Each has actor, IP, user-agent, and an old→new JSON diff.

48. **Notifications** (`/notifications`) + queue.
    - ✅ **Expected:** Event-driven emails were enqueued (not sent inline). 
    - ✔ API check: `GET /api/v1/notifications/queue/stats` shows queued/sent counts; `GET /api/v1/notifications/templates` lists active templates.

49. **Background jobs** (`/api/v1/jobs`).
    - ✅ **Expected:** Registered crons with run history, e.g. the notification-queue processor (every minute), workflow escalation (hourly), token cleanup, document version prune. Each is independently enable/disable-able. (`job:read`/`job:admin`.)

50. **Escalations & Requests** (Workflow).
    - ✅ **Expected:** `/workflow/escalations` lists any SLA/approval-inaction escalations the hourly job raised (let an approval sit past its policy window to force one). `/requests` is the ad-hoc sign-off channel — create a request to another user, have them sign/approve/reject, and confirm signed-document generation + signature verification.

---

## PART 15 — "How it feels" per role + permission boundary tests

Quick role-by-role login passes. For each, **log in, glance at the sidebar, and try the listed denied action** — denied actions should hide the control in the UI and return `403` if called directly.

### super_admin — Bello
- **Feels like:** mission control. Every menu, every write.
- **Can:** everything (holds all permissions).

### audit_manager — Adaeze
- **Feels like:** the programme owner. Builds universe/risk/plans, creates & staffs engagements, approves WPs/reports(L1)/finding-closures, issues nothing-but-can-draft reports.
- **Can:** create universe/risk/plan/engagement, assign staff, approve WP & finding closure, draft/submit/approve(L1)/export reports, read settings/users/logs.
- **Denied (expect hidden / 403):** `settings:manage` (Settings is read-only), `user:create` (Users read-only), `plan:approve` (cannot approve her own plan — that's CAE).

### audit_lead — Tunde
- **Feels like:** an engagement runner without programme authority.
- **Can:** read plans/universe, update engagement status, run checklists, create/submit/**approve** working papers (capability-wise) , create findings, verify remediation, request finding closure, export reports.
- **Denied:** **create plans** (`plan:create`), **create/staff engagements** (`engagement:create`, `assignment:create`), **generate reports** (`report:create`). Confirm there are no "New Plan"/"New Engagement"/"Generate Report" buttons for him.

### auditor — Emeka
- **Feels like:** the fieldworker. Checklists, working papers, evidence, findings — on engagements he's assigned to.
- **Can:** `checklist:update`, `working_paper:create/update/submit`, `evidence:upload`, `finding:create/update`.
- **Denied:** **Risk Register** (no `risk:read` → menu hidden), **Workflow** (no approval/assignment read → hidden), **close findings** (`finding:close`), **generate/approve reports**, Users/Settings/Logs.

### auditee — Chisom  *(re-confirm Part 8)*
- **Feels like:** a narrow, finding-centric portal.
- **Can:** read his own findings + engagements, post management response, upload remediation evidence, attest assets, send/receive requests.
- **Denied (expect hidden / 403):** everything else — Universe, Plans, Reports, Risk, Workflow, Documents, Users, Settings, Logs; cannot edit findings, cannot verify/close, cannot see other auditees' findings.

### director — Ibrahim
- **Feels like:** oversight + a signature.
- **Can:** read-all engagements/findings, read reports, **approve report Level 2** (`report:approve:oversight`), approve/reject approvals, read risk/universe/plan/logs.
- **Denied:** any create/edit on audit content, `report:issue`, settings, users.

### cae — Fatima
- **Feels like:** executive authority at the two ends of the lifecycle.
- **Can:** **approve/reject plans**, **approve report Level 3** (`report:approve:final`), **issue reports**, read-all oversight, `log:summary`.
- **Denied:** create plans/engagements, fieldwork, settings management, user admin.

### viewer (no seeded user, optional)
- **Feels like:** read-only oversight; if you assign the `viewer` role to a test account it should see read-only engagements/findings/reports/risk/universe/plans/dashboard and nothing writable.

---

## Appendix A — Status cheat-sheet

| Entity | States (in order) | Who moves it |
|---|---|---|
| Plan | draft → submitted → approved \| rejected | manager submits; CAE approves/rejects |
| Engagement | planned → in_progress → under_review → reported → closed | manager/lead (status); gates enforced |
| Working paper | draft → submitted → approved \| rejected | auditor/lead submit; **manager** approves |
| Finding | open → management_response_received → in_remediation → verified → pending_closure → closed | auditee responds/evidences; lead/manager verify + request closure; **manager** approves closure |
| Report | draft → submitted → approved \| rejected → issued | manager drafts/submits; manager→director→CAE approve; **CAE** issues |

## Appendix B — When a button is greyed out or you get a 400/403

- **403 / control missing** → the logged-in role lacks the permission. Cross-check §15 and `prisma/seed.ts` ROLES.
- **400 "checklist procedures remain untested"** → some checklist item is still `not_tested` (Part 5, step 23).
- **400 "working papers remain unapproved"** → a WP isn't `approved` yet (Part 6).
- **400 "before an audit report is issued"** → issue the report first (Part 12a).
- **400 "findings remain open or awaiting closure"** → a finding isn't `closed` yet (Part 9).
- **403 "Only an assigned auditee can submit a response"** → you're posting a follow-up as someone who isn't the finding's auditee/co-responder.
- **Engagement not visible** → engagement visibility is scoped; only its lead/manager/auditee/assignees (or `engagement:read_all` holders like director/CAE/admin) can see it.

## Appendix C — Module coverage checklist

Run through and tick that you exercised each: User/Auth ☐ · Dashboard ☐ · Risk Register + Assessments + Monitoring ☐ · Audit Universe ☐ · Planning ☐ · Engagements ☐ · Checklists ☐ · Working Papers ☐ · Evidence ☐ · Findings ☐ · Follow-up/Remediation ☐ · Reports ☐ · Compliance Frameworks ☐ · Documents ☐ · Assets ☐ · Workflow Approvals ☐ · Assignments ☐ · Escalations ☐ · Requests ☐ · Notifications ☐ · Audit Logs ☐ · Background Jobs ☐ · Settings ☐ · Integrations (placeholder) ☐ · Predictive (placeholder) ☐
