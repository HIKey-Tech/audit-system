# IAMS — Full End-to-End UAT Test Script

> **Purpose:** exercise **every module, every feature, and every cross-module hand-off** of IAMS using **multiple users with different roles**, following the real internal-audit lifecycle from platform setup to engagement closure. You start as **Super Admin** and build the world (Task 0), then each phase tells you **which user to log in as**.
>
> **Environment:** `https://audit.galaxybackbone.com.ng` · one browser is fine — log out / use a second browser profile or incognito window per user so you can switch roles quickly.

---

## How to use this script

- **👤 LOGIN AS** banner at the top of each phase tells you who to be. Log out and back in when it changes.
- **☐** = a step to perform. **✅** = the expected result to confirm before moving on. **🔗** = a **cross-module** effect to verify (the whole point of this script).
- **Do the phases in order** — later phases depend on data created earlier (a finding needs an engagement, a report needs findings, etc.).
- **2FA note:** 2FA is mandatory but has a **grace period**. New users log in with **just their password** during the grace window and may **defer** the "set up 2FA" prompt. Phase 13B tests full 2FA enrolment on one user.
- **Labels may vary slightly** from the exact button text in the UI; the navigation path and intent are what matter.

### The test cast (created in Task 0)

| Handle | Name | Email | Password | Role | Represents |
|---|---|---|---|---|---|
| **SA** | Bello Adesanya | `superadmin@gbb.gov.ng` | *(your existing super-admin password)* | super_admin | Platform admin |
| **MGR** | Uat Manager | `uat.manager@gbb.gov.ng` | `UatTest@2026!` | audit_manager | Audit Manager |
| **LEAD** | Uat Lead | `uat.lead@gbb.gov.ng` | `UatTest@2026!` | audit_lead | Lead Auditor |
| **STAFF** | Uat Auditor | `uat.auditor@gbb.gov.ng` | `UatTest@2026!` | auditor | Staff Auditor |
| **AUDITEE** | Uat Auditee | `uat.auditee@gbb.gov.ng` | `UatTest@2026!` | auditee | Finance (auditee) |
| **DIR** | Uat Director | `uat.director@gbb.gov.ng` | `UatTest@2026!` | director | Director (oversight) |
| **CAE** | Uat Cae | `uat.cae@gbb.gov.ng` | `UatTest@2026!` | cae | Chief Audit Executive |
| **AC** | Uat Committee | `uat.committee@gbb.gov.ng` | `UatTest@2026!` | audit_committee | Audit Committee |
| **VIEW** | Uat Viewer | `uat.viewer@gbb.gov.ng` | `UatTest@2026!` | viewer | Read-only oversight |

> `uat.*` emails are used so this script never collides with the pre-seeded demo users (adaeze, tunde, chisom, …). If a password is rejected, follow the on-screen policy hint (≥12 chars, upper + lower + number + symbol).

---

## TASK 0 — Super Admin builds the platform

### 👤 LOGIN AS: **SA (Super Admin)**

### 0.1 Create the roles, then the users  *(Module: User Management + RBAC)*

> **Why this comes first:** IAMS ships with only **super_admin** guaranteed. Every other role is admin-defined — permissions are the source of truth, roles are just named bundles of them. So you **build the roles yourself** before you can assign them. The lists below are the exact permission sets each role must hold for the rest of this script to behave correctly.
>
> If a role below **already exists** (e.g. the environment was seeded), don't recreate it — open it and confirm its permissions match the list, then move on. **Do not recreate super_admin** (that's SA, who already exists).

**How to create each role (Settings → Roles):**
1. ☐ **Create role** → enter the **Name** exactly as shown (e.g. `audit_manager`) and a short description → **Create role**.
2. ☐ Open the new role → **Edit permissions**. Permissions are grouped by module. Tick every slug listed for that role, then **Save**. Use a module's **Select all** when the role holds every action in it.
- ✅ The role's permission count matches the number of slugs you ticked.

> **`report:approve` has three variants** under the **Audit** module — the checkboxes read *Report Approve*, *Report Approve Oversight*, *Report Approve Final*. Tick only the exact slug the role's list names.

Create these eight roles:

**`audit_manager`** — audit programme, workflow, risk, document, read-only settings
```
universe:read universe:create universe:update
plan:read plan:create plan:update plan:add_item plan:submit
engagement:read engagement:create engagement:update engagement:read_all
checklist:read checklist:create checklist:update
working_paper:read working_paper:create working_paper:update working_paper:submit working_paper:approve working_paper:reject
evidence:read evidence:upload evidence:dispute evidence:request
finding:read finding:create finding:update finding:close finding:read_all
followup:read followup:verify
report:read report:create report:update report:submit report:approve report:reject report:issue report:export
control:read control:manage
risk:read risk:create risk:update risk:assess risk:read_all
risk_category:read risk_category:write
risk_monitoring:read
asset:read asset:create asset:update asset:delete asset:admin asset:attest asset:import asset:link asset:export
integration:read
predictive:read
approval:read approval:approve approval:reject approval:cancel
assignment:read assignment:create assignment:delete
escalation:read escalation:acknowledge
escalation_policy:read escalation_policy:update
user:read role:read
document:read document:write
document_template:read
dashboard:read
notification:read notification:update
notification_template:read
log:read
job:read
settings:read
request:create request:read request:receive request:act request:admin
```

**`audit_lead`** — lead auditor over assigned engagement execution
```
universe:read
plan:read
engagement:read engagement:update
checklist:read checklist:create checklist:update
working_paper:read working_paper:create working_paper:update working_paper:submit working_paper:approve working_paper:reject
evidence:read evidence:upload evidence:request
finding:read finding:create finding:update finding:close
followup:read followup:verify
report:read report:export report:approve
control:read
risk:read
risk_monitoring:read
asset:read asset:link asset:attest asset:export
approval:read approval:approve approval:reject
assignment:read
escalation:read
document:read document:write
dashboard:read
notification:read notification:update
log:read
request:create request:read request:receive request:act
```

**`auditor`** — standard auditor on assigned engagements
```
universe:read
plan:read
engagement:read
checklist:read checklist:create checklist:update
working_paper:read working_paper:create working_paper:update working_paper:submit
evidence:read evidence:upload evidence:request
finding:read finding:create finding:update
followup:read
report:read
asset:read asset:link
document:read document:write
dashboard:read
notification:read notification:update
request:create request:read request:receive request:act
```

**`auditee`** — views findings, submits follow-up responses/evidence
```
engagement:read
finding:read
followup:read followup:respond followup:evidence
asset:read asset:attest
notification:read notification:update
dashboard:read
request:create request:read request:receive request:act
```

**`director`** — oversight + approval (oversight sign-off)
```
engagement:read engagement:read_all
finding:read finding:read_all
report:read report:approve:oversight
committee_pack:read
approval:read approval:approve approval:reject
risk:read risk:read_all
risk_monitoring:read
asset:read asset:export
integration:read
predictive:read
universe:read
plan:read
dashboard:read
notification:read notification:update
log:read
request:create request:read request:receive request:act
```

**`cae`** — Chief Audit Executive (final sign-off + issue authority)
```
engagement:read engagement:read_all
finding:read finding:read_all
report:read report:issue report:approve:final
committee_pack:read
approval:read approval:approve approval:reject
risk:read risk:read_all
risk_monitoring:read
asset:read asset:export
integration:read
predictive:read
universe:read
plan:read plan:approve plan:reject
dashboard:read
notification:read notification:update
log:read log:summary
request:create request:read request:receive request:act
```

**`audit_committee`** — periodic oversight pack access only
```
committee_pack:read
dashboard:read
notification:read notification:update
```

**`viewer`** — read-only oversight / default SSO provisioning
```
engagement:read
finding:read
report:read
risk:read
risk_monitoring:read
asset:read
integration:read
predictive:read
universe:read
plan:read
dashboard:read
notification:read
```

**Then create the users and assign roles.** For **each** row in the cast table above (MGR → VIEW):
- ☐ Go to **Users** (`/users`) → **Add / New User**.
- ☐ Enter first/last name, email, department, job title, and **set the password** (`UatTest@2026!`) so you don't depend on email delivery.
- ☐ Assign the matching **role** you created above (e.g. MGR → `audit_manager`).
- ☐ Save.
- ✅ The user appears in the Users list with the correct role and **Active** status.

🔗 **RBAC wiring check:** open one user (e.g. LEAD) → confirm the assigned role and that its **permissions** are the ones you granted the role. This is the role → permission → user chain that every later gate depends on.

### 0.2 Inspect roles & permissions  *(Module: Settings / RBAC)*
- ☐ Go to **Settings → Roles** (or the roles panel). Open `audit_manager`, `auditee`, `cae`.
- ✅ Each role shows a distinct permission set (e.g. only `cae` has `report:issue`; only `auditee` has `followup:respond`). This proves permissions are **role-driven and configurable**, not hardcoded.
- ☐ *(Optional, tests role editing)* create a throwaway custom role, grant it `dashboard:read` only, save, then delete it.

### 0.3 Configure audit settings  *(Module: Settings — feeds later phases)*
- ☐ **Compliance library / Control templates:** confirm control sets exist for IT / Financial / Compliance / Systems (ISO 27001, PCI DSS, NDPR, etc.). Add one custom control to the **Financial** set (e.g. `FIN-TEST-001`).
- ☐ **Working-paper templates:** confirm a default template exists; note its sections.
- ☐ **Report templates:** confirm a default report template exists.
- ☐ **Approval matrix:** confirm Report = *engagement manager → oversight → final*; Plan = *plan:approve*. Leave defaults.
- ☐ **Escalation policies:** confirm SLA hours per audit type (used in Phase 10).
- ☐ **Planning priority weights:** note the weights (risk score, open findings, overdue, never-audited, time-since) — used in Phase 2.
- ✅ All settings load and save without error.

🔗 **Cross-module seed:** the control you added in 0.3 must later appear as a **checklist item** on a Financial engagement (Phase 4) — that is the Compliance-library → Engagement-checklist hand-off.

### 0.4 Verify the audit trail is sealing (REM-3)
- ☐ Everything you just did was a mutation. Go to **Logs** (`/logs`).
- ✅ You see `user.create`, `role` assignment, `settings.*` entries attributed to **SA** with timestamps.
- ☐ Run the tamper-evidence check (Appendix A): `GET /api/v1/logs/verify-chain`.
- ✅ Returns **"Audit log chain intact"** with `sealedCount ≥ 1`.

---

## PHASE 1 — Risk & Universe foundation

### 👤 LOGIN AS: **MGR (Audit Manager)**

### 1.1 Risk categories & register  *(Module: Risk)*
- ☐ **Risk → Categories:** create categories `Operational`, `IT Security`, `Financial`.
- ☐ **Risk → Register:** create a risk *"Weak access controls on core finance system"* — category `IT Security`, owner = **AUDITEE**, likelihood `4`, impact `5`.
- ✅ Current score auto-computes (`likelihood × impact = 20`, band **Critical**).
- ☐ **Assess** the risk once (likelihood 4, impact 5, note) — a Risk Assessment history entry is created.

### 1.2 Audit universe  *(Module: Audit Universe)*
- ☐ **Audit → Universe:** create an entity *"Core Financial System"* — category `system`, owner = **AUDITEE**, frequency `annual`, risk score `20`.
- ☐ Create a second entity *"IT Infrastructure"* — category `system`, frequency `biannual`, risk score `15`.
- ✅ Both appear in the universe list with risk scores.

🔗 **Risk ↔ Universe:** on the *Weak access controls* risk, set its **universe** to *Core Financial System*. Later, a verified finding on this universe will nudge this risk's owner to reassess (Phase 6).

---

## PHASE 2 — Annual planning

### 👤 LOGIN AS: **MGR**, then **CAE**

### 2.1 Build the plan  *(Module: Planning)*
- ☐ **Audit → Plans:** create plan *"FY2026 Internal Audit Plan"*, year 2026.
- ☐ **Add items:** add *Core Financial System* — audit type `financial`, priority `high`, planned dates (this month). Add *IT Infrastructure* — audit type `it`, priority `medium`.
- ☐ Open the **risk-based priority ranking** view.
- ✅ Entities are ranked by the composite score (risk + open findings + overdue + never-audited + time-since). *Core Financial System* (risk 20) ranks above *IT Infrastructure* (risk 15).
- ☐ **Submit** the plan.
- ✅ Plan status → **submitted**; MGR can no longer edit it.

### 2.2 Approve the plan  *(Cross-module: Planning → Workflow → RBAC)*
### 👤 LOGIN AS: **CAE**
- ☐ **Workflow → Approvals** (or Plans): find the pending plan approval.
- ✅ CAE can act (holds `plan:approve`); **MGR could not have approved their own submission** (test that in Phase 16).
- ☐ **Approve**.
- ✅ Plan status → **approved**. 🔗 Notification fires to MGR (check Phase 13).

### 2.3 Generate the engagement  *(Cross-module: Plan item → Engagement)*
### 👤 LOGIN AS: **MGR**
- ☐ On the approved plan's *Core Financial System* item → **Create Engagement**.
- ✅ A new engagement is created with a reference like `AUD-2026-001`, status **planned**, `engagement_created` flag set on the plan item.

---

## PHASE 3 — Engagement setup & team

### 👤 LOGIN AS: **MGR**

### 3.1 Configure the engagement  *(Module: Engagement)*
- ☐ Open engagement `AUD-2026-001`. Set **lead auditor = LEAD**, **audit manager = MGR**, **auditee = AUDITEE**, planned dates, SLA deadline.
- ☐ **Assignments:** add **STAFF** as a *supporting auditor* (Workflow → Assignments, or the engagement team panel).
- ✅ Team saved; STAFF now appears as an assignee.

### 3.2 Assets in scope  *(🔗 Cross-module: Asset ↔ Engagement — the "assets mix with audits" flow)*
### 👤 LOGIN AS: **SA** *(or MGR — needs `asset:create`/`asset:link`)*
- ☐ **Assets:** create asset *"FIN-DB-01 — Finance Database"* — type `database`, criticality `critical`, integrity rating `high`, owner AUDITEE.
- ☐ Create asset *"APP-ERP-01 — Dynafin ERP"* — type `application`, criticality `high`.
- ☐ Create an **asset relationship**: `APP-ERP-01` *depends on* `FIN-DB-01`.
- ☐ **Link `FIN-DB-01` to the universe** entity *Core Financial System*.
- ☐ **Link both assets to engagement** `AUD-2026-001` (scope role e.g. *in-scope system* / *data*).
- ✅ On the engagement, an **Assets in scope** panel now lists both assets.
🔗 Keep these — they must reappear on the **finding** (Phase 5), the **risk** (Phase 6), and the **issued report's "Assets in scope"** table (Phase 7).

### 3.3 Start the engagement  *(Module: Engagement — lifecycle gate)*
### 👤 LOGIN AS: **MGR**
- ☐ **Start** the engagement (planned → in_progress).
- ✅ Status → **in_progress**, actual start date set. (This is the only manual lifecycle transition; the rest auto-advance via gates.)

---

## PHASE 4 — Fieldwork: control testing, sampling, evidence, working papers

### 👤 LOGIN AS: **LEAD** (and **STAFF**, **AUDITEE** where noted)

### 4.1 Checklists / control testing  *(🔗 Cross-module: Compliance controls → Checklist)*
- ☐ On the engagement, **populate checklists** from the control library.
- ✅ Checklist items appear drawn from the **Financial** control set — including the custom `FIN-TEST-001` you added in Task 0.3.
- ☐ Mark 2 items **passed**, 1 item **failed** (e.g. the access-control item), 1 **not applicable**.
- ☐ On the **failed** item, add a note (this becomes a finding's *criteria* in Phase 5).

### 4.2 Sample-size calculator (REM-4) + sampling  *(Module: Sampling)*
- ☐ **Sample size:** use the calculator (Appendix A endpoint, or UI if present): population `1000`, confidence `0.95`, tolerable `0.05` → expect **n ≈ 56** (with FPC).
- ☐ **Draw a sample:** upload a CSV population (e.g. 100 payment rows with an `amount` column) → method **random**, size `10`, note the **seed**.
- ✅ You get a sample + a **methodology write-up**, and **two evidence files** (population + sample) are auto-attached to the engagement.
🔗 **Sampling → Evidence:** confirm the population & sample CSVs appear under the engagement's **Evidence**. Re-run with the **same seed** → identical selection (reproducibility).

### 4.3 Evidence request (PBC) with the auditee  *(🔗 Cross-module: Auditor ↔ Auditee ↔ Document)*
- ☐ **LEAD:** create an **Evidence Request** *"Provide Q1 bank reconciliations"*, assign to **AUDITEE**, due date.
- ✅ 🔗 AUDITEE receives a notification (Phase 13).
### 👤 LOGIN AS: **AUDITEE**
- ☐ Open the request, **upload** a file (any PDF).
- ✅ Request status → **submitted**.
### 👤 LOGIN AS: **LEAD**
- ☐ **Return** it once with a reason (tests the return loop) → status back to **open** → AUDITEE re-uploads → LEAD **accepts** → **fulfilled**.
- ☐ **Dispute** one evidence item with a reason, then clear it.
- ✅ 🔗 The uploaded file appears in **Evidence** and in the central **Evidence Repository**; open it and confirm a **`contentSha256`** value is recorded (REM-2 chain-of-custody seal).

### 4.4 Working papers + maker–checker review  *(🔗 Cross-module: Working paper → Workflow approval + Signatures)*
- ☐ **STAFF:** create a working paper from the default template; fill sections; **link evidence** from 4.3.
- ☐ **STAFF:** edit it once → confirm **version number increments** and a snapshot is kept.
- ☐ **STAFF:** **submit** it for review.
- ✅ 🔗 A **workflow approval** is created and routed to the **engagement manager (MGR)**.
### 👤 LOGIN AS: **MGR**
- ☐ Add a **review comment** on the working paper; confirm STAFF is notified.
- ☐ **Reject** it with a reason → STAFF edits and resubmits.
- ☐ **Approve-with-edit** (make a small content fix on approval).
- ✅ Working paper → **approved**; MGR **could not** have approved it had MGR been the preparer (SoD — Phase 16).
- ☐ **Export** the approved working paper to **PDF** and **DOCX**.
- ✅ The export carries an **approver sign-off block** (name/role/date + signature image if MGR has one — set one in Phase 9.0).

---

## PHASE 5 — Findings

### 👤 LOGIN AS: **LEAD**

### 5.1 Raise findings (the 5 C's)  *(🔗 Cross-module: Checklist + Risk + Working paper + Asset → Finding)*
- ☐ Create a finding from the **failed checklist item**: title, description (*condition*), **root cause**, **risk implication**, **recommendation**, category `financial`, severity `high`, due date.
- ☐ **Link** it to: the failed **checklist** (criteria), the **risk** from Phase 1, the **working paper** from 4.4, and **asset `FIN-DB-01`**.
- ☐ Assign **primary auditee = AUDITEE**; add **STAFF's counterpart** or a second user as a **co-responder**.
- ✅ 🔗 Finding created; AUDITEE **and** the co-responder each get a notification + email (Phase 13). The linked asset shows on the finding.
- ☐ Create a second finding, severity `medium`, so the report has multiple.

🔗 **Auditee visibility timing:** while the engagement is *in_progress*, log in as **AUDITEE** and confirm findings are **not yet visible** (they appear only after the report is issued — verify the flip in Phase 7).

---

## PHASE 6 — Follow-up, remediation & the risk feedback loop

### 👤 LOGIN AS: **AUDITEE**, then **LEAD**

### 6.1 Management response & remediation  *(Module: Follow-up)*
- ☐ **AUDITEE:** on the high finding, submit a **management response**.
- ✅ Finding status → **management_response_received**; 🔗 LEAD notified.
- ☐ **AUDITEE:** upload **remediation evidence** (a file).
- ✅ Status → **in_remediation**; 🔗 LEAD notified it awaits verification.

### 6.2 Verification (segregation)  *(🔗 Cross-module: Follow-up → Risk reassessment)*
### 👤 LOGIN AS: **LEAD**
- ☐ **Reject** the remediation once (status returns for resubmission) → AUDITEE resubmits.
- ☐ **Verify** the remediation.
- ✅ Finding status → **verified**. AUDITEE **cannot verify their own remediation** (only the audit team can — confirm the denial in Phase 16).
- ✅ 🔗 **Risk feedback loop:** the owner of the linked risk (**AUDITEE**, owner of *Weak access controls*) and owners of risks on the same universe get a **"reassess this risk"** notification. Confirm it in Phase 13.

### 6.3 Close the finding  *(🔗 Cross-module: Finding closure → Workflow approval)*
- ☐ **LEAD:** request **closure** of the verified finding.
- ✅ Status → **pending_closure**; a **closure approval** routes to the engagement manager.
### 👤 LOGIN AS: **MGR**
- ☐ Approve the closure.
- ✅ Finding → **closed**. Repeat 6.1–6.3 (fast path) for the second finding so **all findings are closed** (needed for engagement close in Phase 8).

---

## PHASE 7 — Reporting

### 👤 LOGIN AS: **MGR → DIR → CAE**

### 7.1 Build the report  *(🔗 Cross-module: Findings + Assets → Report)*
- ☐ **MGR:** create the audit report from the default template; write executive summary, scope, methodology.
- ✅ 🔗 The report **auto-assembles the findings** (summary table sorted by severity + detailed findings) and an **"Assets in scope"** table (the two assets from Phase 3.2). You did not retype them.
- ☐ **Submit** the report.
- ✅ A **3-level approval** is created: engagement manager → oversight → final.

### 7.2 Multi-level approval  *(🔗 Cross-module: Report → Workflow, 3 roles)*
- ☐ **MGR** approves level 1 (engagement manager).
### 👤 LOGIN AS: **DIR**
- ☐ **DIR** approves level 2 (`report:approve:oversight`).
### 👤 LOGIN AS: **CAE**
- ☐ **CAE** approves level 3 (`report:approve:final`), then **Issue** the report (`report:issue`).
- ✅ Report status → **issued**, issued date set.
- ☐ **Export** the issued report to **PDF** and **DOCX**.

🔗 **Auditee visibility flips:** log in as **AUDITEE** → findings for this engagement are **now visible** (report issued). This confirms the visibility rule from Phase 5.

---

## PHASE 8 — Engagement lifecycle gates & close

### 👤 LOGIN AS: **MGR**

- ☐ Return to engagement `AUD-2026-001`.
- ✅ 🔗 With all checklists tested, all working papers approved, the report **issued**, and all findings **closed**, the engagement should have **auto-advanced** through *under_review → reported → closed* (the hourly reconcile job, or on the triggering actions).
- ☐ If not yet closed, check the **gate status** hint (it tells you what's outstanding) and resolve it.
- ✅ Engagement → **closed**; 🔗 the universe entity's **last_audited_at** updates (see it on *Core Financial System*).

---

## PHASE 9 — Signatures & ad-hoc workflow requests

### 9.0 User signature  *(Module: Signatures — do this before Phase 4.4 export if you want a signed WP)*
### 👤 LOGIN AS: **MGR** (and any approver)
- ☐ **Profile → Signature:** draw or upload a signature.
- ✅ Saved; it will be embedded on future approvals/exports.

### 9.1 Ad-hoc request  *(Module: Workflow Requests — decoupled sequential sign-off)*
### 👤 LOGIN AS: **STAFF**
- ☐ **Requests → New:** create a request *"Approve overtime for fieldwork"*, add an attachment, add sequential recipients **LEAD** (approve) then **MGR** (sign).
- ✅ Reference like `REQ-2026-001`; status **pending**; content **locks** after the first recipient acts.
### 👤 LOGIN AS: **LEAD** → **MGR**
- ☐ LEAD **approves**; MGR **signs** (with the signature from 9.0).
- ✅ Status → **completed**; a **signed certificate/document** is generated with a signature hash. Reject/comment paths available on a second request.

---

## PHASE 10 — Escalations & SLA

### 👤 LOGIN AS: **SA / MGR**, then **DIR / CAE**

- ☐ **Settings → Escalation policies:** temporarily set the level-1 SLA for `financial` to a very low value (e.g. 1 hour) so a breach triggers.
- ☐ Create a small ad-hoc engagement or approval and let its SLA lapse (or wait for the **hourly escalation job**).
- ✅ 🔗 A **Workflow Escalation** is raised and the **escalation-matrix** roles are notified. *(Note the boot warning: director/cae/audit_manager tiers notify nobody until those roles have active users — your UAT users MGR/DIR/CAE now hold them, so escalations should reach them.)*
### 👤 LOGIN AS: **DIR**
- ☐ **Acknowledge** the escalation.
- ✅ Acknowledged timestamp set. Restore the SLA value afterward.

---

## PHASE 11 — Dashboards, committee pack & risk monitoring

- ☐ **👤 MGR / LEAD:** open **Dashboard** → KPIs reflect your engagement, findings, overdue items.
- ☐ **👤 AUDITEE:** dashboard is **scoped** to their findings only (no other engagements).
- ☐ **👤 DIR / CAE:** open the **Committee Pack** (`committee_pack:read`) → generates a board/AC pack.
- ☐ **👤 AC (Audit Committee):** confirm AC can see the **committee pack + dashboard only** and nothing else.
- ☐ **👤 DIR:** open **Risk monitoring** → the reassessed risk and its history are visible.
- ✅ Each role's dashboard shows **only what its permissions allow**.

---

## PHASE 12 — Documents module

### 👤 LOGIN AS: **STAFF** (and **SA**)
- ☐ **Documents:** upload a **personal** document (no entity link).
- ✅ Only the uploader sees it (log in as another non-admin → it is **not** listed).
- ☐ Upload a **new version** → version history shows both; current is latest.
- ☐ **Document templates (SA):** confirm a DOCX template exists (used by report/WP export).
- ✅ 🔗 Every uploaded file carries a **`contentSha256`** (REM-2). Downloads are integrity-verified server-side.

---

## PHASE 13 — Notifications & 2FA

### 13A Notifications  *(Module: Messaging/Notifications)*
- ☐ **👤 each user:** open **Notifications**. Confirm the events you triggered arrived: finding assigned (AUDITEE), approval required (MGR/DIR/CAE), plan approved (MGR), remediation verified (AUDITEE), **risk reassessment suggested** (AUDITEE), request actions.
- ☐ **Mark as read**; confirm unread count updates.
- ✅ In-app notifications present; if SMTP is configured, matching emails are queued/sent (the every-minute queue job drains them).

### 13B Full 2FA enrolment  *(Module: Auth/MFA — test on one user)*
### 👤 LOGIN AS: **VIEW**
- ☐ From Profile / the 2FA prompt, **enrol in 2FA**. Retrieve the **email OTP** (inbox, or ask SA to check the email/notification logs), complete enrolment, and save the **backup codes**.
- ☐ Log out and log back in → you are now challenged for the **OTP**; use one **backup code** once to confirm it works.
- ☐ **Forgot password:** from the login page, run the **reset** flow for VIEW.
- ✅ 2FA challenge enforced; backup code consumed; password reset email/flow works.

---

## PHASE 14 — Audit trail & tamper-evidence (REM-3)

### 👤 LOGIN AS: **SA** (or **CAE**, holds `log:read`/`log:summary`)
- ☐ **Logs:** filter by module (`audit`, `workflow`, `user`), by user (LEAD), by date, by action.
- ☐ Open the **summary** (CAE) → per-module success/failure counts.
- ☐ Run **verify-chain** (Appendix A).
- ✅ **"Audit log chain intact"**, `verifiedCount == sealedCount`. Every action from Task 0 onward is attributable and sealed.

---

## PHASE 15 — Integrations & predictive

### 👤 LOGIN AS: **SA / DIR**
- ☐ **Integrations:** open **directory group mappings** (Azure AD → IAMS role). Create a sample mapping (it will be a stub unless directory sync is enabled).
- ☐ **Predictive:** open the page.
- ✅ Integrations page loads; predictive shows its **placeholder / not-yet-available** state (backend module not built — expected).

---

## PHASE 16 — RBAC & negative tests (the guardrails)

Run these deliberately-failing checks; each **should be blocked**.

| # | 👤 Login as | Attempt | Expected |
|---|---|---|---|
| 16.1 | **VIEW** | Create an engagement / edit anything | **Blocked** (read-only) |
| 16.2 | **AUDITEE** | Open another engagement's working papers | **Not visible / blocked** |
| 16.3 | **STAFF** | Approve their **own** submitted working paper | **Blocked — segregation of duties** (REM-5) |
| 16.4 | **MGR** | Approve a plan **MGR** submitted | **Blocked — self-approval** (SoD) |
| 16.5 | **AUDITEE** | Verify their **own** remediation | **Blocked** (only audit team verifies) |
| 16.6 | **LEAD** | Issue the report (`report:issue`) | **Blocked** (only CAE issues) |
| 16.7 | **STAFF** | Access **Logs** / **Users** admin | **Blocked** (no `log:read` admin / `user:*`) |
| 16.8 | **AUDITEE** | See a finding **before** its report is issued | **Not visible** |
| 16.9 | **VIEW/STAFF** | Open another engagement's evidence in the repository | **Scoped out** (only own engagements) |

✅ Every row is denied with a clear 403 / not-found. These prove the authorization gates, SoD, and visibility scoping actually hold.

---

## Appendix A — API-only checks (REM-3 & REM-4)

These two features are API endpoints (no dedicated UI button yet). Get an **access token** from your logged-in browser session (DevTools → Application → Cookies, or the login response), then:

**REM-3 — verify the audit-log chain** (needs `log:read`):
```bash
curl -s https://audit.galaxybackbone.com.ng/api/v1/logs/verify-chain \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
# → { "ok": true, "sealedCount": N, "verifiedCount": N }  ("Audit log chain intact")
```

**REM-4 — attribute sample size** (needs `evidence:upload`):
```bash
curl -s -X POST https://audit.galaxybackbone.com.ng/api/v1/audit/sampling/sample-size \
  -H "Authorization: Bearer <ACCESS_TOKEN>" -H "Content-Type: application/json" \
  -d '{"populationSize":1000,"confidenceLevel":0.95,"tolerableRate":0.05}'
# → sampleSize ≈ 56, with a methodDescription explaining the formula
```

**REM-2 — evidence hash:** visible in the UI on any evidence/document record as `contentSha256`. (A true tamper test — altering a file on disk and re-downloading to force the "integrity check failed" event — is a server-side/DBA exercise, not a UI step.)

---

## Appendix B — Cross-module integration map (what talks to what)

| Source | → | Target | Where it's tested |
|---|---|---|---|
| Role → Permission → User | → | every authorization gate | 0.1, 16 |
| Compliance controls | → | Engagement checklists | 4.1 |
| Universe → Plan item | → | Engagement | 2.3 |
| Failed checklist | → | Finding (criteria) | 5.1 |
| Finding ↔ Risk register | → | Verified finding nudges risk owner | 6.2 |
| Working paper submit | → | Workflow approval + signature | 4.4, 9 |
| Report submit | → | 3-level workflow (MGR→DIR→CAE) → issue | 7 |
| Finding closure | → | Workflow approval | 6.3 |
| Sampling run | → | Evidence (population+sample) | 4.2 |
| Evidence/report/WP | → | Document module + SHA-256 seal | 4.3, 4.4, 12 |
| **Asset ↔ Universe / Engagement / Finding / Risk / Evidence** | → | Assets-in-scope on report; audit-context view | 3.2, 5.1, 7.1 |
| Follow-up remediation | → | Document upload | 6.1 |
| SLA lapse | → | Escalation → matrix roles notified | 10 |
| Every mutation | → | Audit trail (sealed) + Notifications | 0.4, 13, 14 |

---

## Appendix C — Module coverage matrix

| Module | Covered in |
|---|---|
| User / Auth / 2FA / RBAC | 0.1, 0.2, 13B, 16 |
| Settings & templates | 0.2, 0.3 |
| Risk (register, categories, assessment, monitoring) | 1.1, 6.2, 11 |
| Audit Universe | 1.2 |
| Planning | 2 |
| Engagement (+ lifecycle gates, time, assignments) | 3, 8 |
| Checklists / control testing | 4.1 |
| Sampling (+ sample-size REM-4) | 4.2 |
| Evidence + PBC requests + repository | 4.3 |
| Working papers (+ review, versions, export) | 4.4 |
| Findings | 5 |
| Follow-up / remediation | 6 |
| Report (+ multi-level approval, issue, export) | 7 |
| Compliance framework/controls | 0.3, 4.1 |
| Workflow — approvals (SoD REM-5) | 2.2, 4.4, 6.3, 7.2, 16 |
| Workflow — assignments | 3.1 |
| Workflow — escalations & policies | 10 |
| Workflow — requests + signatures | 9 |
| Documents (+ integrity REM-2) | 4.3, 12 |
| Assets (+ audit links) | 3.2, and woven through 5/6/7 |
| Dashboard / committee pack | 11 |
| Notifications / messaging | 13A |
| Logging / audit trail (verify-chain REM-3) | 0.4, 14 |
| Integrations / predictive | 15 |
| Background jobs (reminders, escalation, reconcile, queue) | effects seen in 8, 10, 13 |

---

## Appendix D — Reset / teardown

- The `uat.*` users can be **deactivated** (Users → deactivate) after testing; they leave a clean audit trail behind (do not hard-delete — soft-delete keeps the trail intact).
- To re-run from scratch, deactivate the `uat.*` users and re-do Task 0, or reset the escalation SLA you changed in Phase 10.
- Nothing in this script deletes seeded demo data.

**End of script.** If any step's ✅ does not match what you see, note the phase number and the actual result — that's your defect list.
