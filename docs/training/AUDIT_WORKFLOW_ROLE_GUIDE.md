# IAMS — Full Audit Workflow: Role-by-Role Guide

For the Day 3 practical. One person (or small group) plays each role. Everyone works in the same live
system; the audit moves from person to person, so **nobody can finish it alone**. The facilitator calls
out whose turn it is.

> Based on a complete dry run of the system. Screen names and button labels below are the ones seen in
> the app. Items marked **(not click-tested)** were verified another way — try them yourself first.

---

## 1. The cast

| Role in class | Account (training only) | Password | What they own |
|---|---|---|---|
| **Audit Manager** | `adaeze@gbb.gov.ng` | `Adaeze@123456!` | Sets up the audit, assigns the team, approves working papers, level-1 report sign-off, approves finding closure |
| **Lead Auditor** | `tunde@gbb.gov.ng` | `Tunde@123456!` | Runs fieldwork, tests controls, requests evidence, writes the report, verifies remediation, requests closure |
| **Supporting Auditor** | `emeka@gbb.gov.ng` | `Emeka@123456!` | Does the testing: working papers, evidence, findings |
| **Auditee** | `chisom@gbb.gov.ng` | `Chisom@123456!` | Provides evidence, responds to findings, fixes issues |
| **Director** | `ibrahim@gbb.gov.ng` | `Ibrahim@123456!` | Level-2 (oversight) report approval |
| **CAE** | `fatima@gbb.gov.ng` | `Fatima@123456!` | Approves the audit programme, level-3 (final) report approval, **issues** the report |

Spare accounts for a second group: `adaeze2`, `tunde2`, `emeka2`, `chisom2`, `ibrahim2`, `fatima2`
(passwords follow the same pattern with a `2`, e.g. `Tunde2@123456!`). A second auditee `chisom2`
is **Amaka Nwosu**.

Login: `http://localhost:3001/login`. **Logging in takes 12–18 seconds** (the system checks Active
Directory first). Tell people to wait — don't click again.

---

## 2. The whole flow on one page

```
 PLAN            Manager creates Universe entity + Programme  ->  CAE approves
 SET UP          Manager creates Engagement, assigns team
 FIELDWORK       Lead starts fieldwork -> checklists tested -> working papers (Auditor) -> Manager approves
                 Evidence requests to Auditee  |  Evidence uploaded  |  Findings raised
 QUALITY ASSUR.  (engagement moves here by itself; auditee is notified)
                 Auditee sees findings + gives MANAGEMENT RESPONSE  ->  Lead drafts Review (includes responses)
 REPORTING       Lead submits -> Manager (L1) -> Director (L2) -> CAE (L3) approve  ->  CAE issues
 FOLLOW-UP       Auditee uploads remediation evidence -> Lead verifies -> Lead requests closure -> Manager approves
 CLOSED          Engagement closes by itself when every finding is closed
```

**Engagement status ladder:** Planned → In progress → Under review (shown as *Quality Assurance*) →
Reported (*Review & Findings*) → Closed (*Audit Closure*). Only the first step (Start fieldwork) is
manual; the rest move **automatically** when the conditions are met.

**Finding status ladder:** Open → Management response received → In remediation → Verified →
Pending closure → Closed.

The **"What's next"** box at the top of every engagement always says what is blocking progress and who
should act. When people are lost, tell them to read it.

---

## 3. Step-by-step, by phase

### Phase 1 — Plan the audit  *(Audit Manager, then CAE)*

**1.1 Audit Manager — create the universe entity**
- Menu **Audit Universe** → **New Entity**.
- Fill **Name**, **Description**, **Category**, **Owner** (pick the auditee's name — type to search),
  **Audit Frequency** → **Create entity**.
- *Expect:* "Auditable entity created"; it appears in the list.

**1.2 Audit Manager — create the programme**
- Menu **Audit Programme** → **New Programme**: **Title**, **Year**, **Audit type**, **Description** →
  **Create programme**. (One programme per year and audit type — use a new year if one exists.)
- Open it → **Add plan**: choose the entity (the list shows a *priority* score — risk feeds this),
  **Priority**, **Planned start/end** → **Add item**.
- **Submit for approval**. The *Approval chain* card shows who can approve.

**1.3 CAE — approve (or reject)**
- Menu **Review/Approval** → the programme is in **Pending inbox**.
- **Approve & Sign** (comment optional) — a signature preview appears; confirm.
- OR **Reject** — a **reason is required**. The manager then sees status *Rejected*, the reason in a
  red box, and can fix and **Submit for approval** again.
- *Expect:* programme becomes **Approved** with a signed PDF attached; the manager gets a notification.

### Phase 2 — Set up the engagement  *(Audit Manager)*

**2.1 Create the engagement**
- Open the approved programme → on the plan row click **Create**.
- Fill **Title**, **Lead auditor**, **Audit manager**, **Auditee**, **Start**, **End**, **OLA deadline**.
- Rules enforced: the three must be **different people**; a **super admin** can't be lead or manager;
  the pickers already hide people chosen for another role.
- *Expect:* "Engagement created" with a reference like `AUD-2026-003`, status **Planned**. The auditee
  gets *Audit Scheduled*; lead and manager get assignment notifications.

**2.2 Assign the supporting auditor**
- Open the engagement → **Team → Manage** → find the person → role **Supporting Auditor** →
  **Assign Staff**.
- The lead, manager, auditee and super admins are not offered (they already hold a role).

### Phase 3 — Fieldwork  *(Lead, Auditor, Manager, Auditee)*

**3.1 Lead — start fieldwork**
- Engagement page → **Start fieldwork** (in the *What's next* box).
- *Expect:* status **In progress**; a checklist of controls (43 for System/IT) is generated.

**3.2 Test the controls** *(Lead, Auditor or Manager)*
- **Checklists** tab. Set each control to **Passed / Failed / Not applicable**, add notes, optionally
  **Attach evidence** to a control.
- **Shortcut for class:** the bar above the list has **Apply to all untested** (pick *Passed* or
  *Not applicable*) with a confirmation. Use it so nobody spends 20 minutes clicking.
- To demo a finding, mark one control **Failed**, then **Raise finding** on that row.

**3.3 Auditor — working paper**
- **Working Papers** tab → **New working paper**. Required: **Title**, **Control Objective**,
  **Control Description**, **Test Procedure**, **Evidence Reviewed**, **Conclusion** (plus Exceptions /
  Risk Rating).
- **Save as draft** or **Submit for review**.
- *Expect:* status *Submitted*; the manager sees it in Review/Approval.

**3.4 Audit Manager — approve the working paper**
- **Review/Approval** → **Approve & Sign** (or **Reject** with a reason).
- If rejected, the auditor edits the paper and **resubmits**; the manager approves the new version.
- *Expect:* once **all checklist items are tested AND all working papers are approved**, the
  engagement **moves to Quality Assurance by itself**.

**3.5 Evidence collection**
- *Ask the auditee for a document (Lead/Auditor):* **Evidence Requests** tab → **New request** →
  **What do you need?**, **Details**, **Due date**, **Request from** → **Send request**.
- *Auditee provides it:* Home shows **Documents requested from you**; open it → **Evidence Requests**
  tab → **Upload** → choose the file. Status becomes **Submitted**.
- *Lead reviews:* **Accept** (fulfilled) or **Return** with a **required reason** (the auditee uploads
  again).
- *Auditors add their own evidence:* **Evidence** tab → drop or click to upload (one or many files).
  Rows show size, uploader and date. **View** opens an in-app preview; **Download** saves it.
- *Link evidence* to a control (Checklist → Attach evidence), a working paper or a finding.
- *Manager disputes weak evidence:* **Dispute** → reason required. Auditors cannot dispute.
- All evidence across audits: menu **Evidence Repository** (auditors/managers only — auditees can't see it).

**3.6 Raise a finding** *(Auditor, Lead or Manager)*
- **Findings** tab → **New finding**. Required: **Title**, **Description**, **Category**, **Severity**,
  **Root cause**, **Risk implication**, **Recommendation**, **Auditee**, **Due date**.
- Optional: **Related risk** (see §5).
- *Expect:* finding is **Open**. **The auditee cannot see it yet** — findings stay internal while fieldwork is
  going on. They become visible to the auditee automatically when the engagement reaches **Quality Assurance** (§6).

### Phase 4 — Draft stage: management response  *(Auditee)*  — **before the report is issued**

Fieldwork is finished (all controls tested, all working papers approved), the engagement is now **Quality
Assurance**, and **the auditee is notified: "Findings awaiting your response"**.

**4.0 Auditee — see the findings and respond**
- Notifications (bell) → open the finding, or engagement → **Findings / Follow-up** tab.
- **Submit response** — owner, action, target date → **Submit**. Finding becomes *Management response received*.
- The auditee may also **Attach evidence** now if the fix is already done (→ *In remediation*).
- *The lead should wait for the response before drafting the review, so it is included in the report.*
- If the auditee tries before this stage they get: "Findings can be responded to once fieldwork is complete
  and the engagement is in Quality Assurance."

### Phase 5 — Report  *(Lead, then three approvers)*

**5.1 Lead — draft and submit the review**
- Engagement → **Review** tab → fill **Executive summary**, **Scope**, **Methodology** →
  **Generate review** → check it → **Submit for approval**.

**5.2 Approval chain — three levels, in order**
| Level | Who | Where |
|---|---|---|
| 1 | Audit Manager (the engagement's manager) | Review/Approval |
| 2 | Director (oversight) | Review/Approval |
| 3 | CAE (final) | Review/Approval |

Each uses **Approve & Sign** or **Reject** (reason required). The next person only sees it after the
previous one has signed. **A rejection at any level sends the report back to the lead; after changes
and resubmission, the chain restarts at level 1.**

**5.3 CAE — issue**
- Review tab → **Issue review** (only the manager and CAE can issue).
- *Expect:* status **Issued**, engagement moves to **Review & Findings**, a signed report (PDF + DOCX)
  is stored, and **the auditee is notified**.

### Phase 6 — Remediation, verification and closure  *(Auditee, Lead, Manager)*

**6.1 Auditee — remediation evidence**
- Notifications at issue: *Audit findings assigned*, *Audit report issued*.
- Engagement → **Follow-up** tab → **Attach evidence** → choose the file → **Submit evidence**.
  Finding becomes *In remediation*. (A management response must already exist — Phase 4.0.)

**6.2 Lead — verify**
- **Follow-up** tab → **Verify** (shown only once the auditee has responded; before that it says
  *Waiting for the auditee's response*) → choose **Verified** or **Rejected**, add notes → **Save verification**.
- *Rejected* sends it back: the finding returns to *In remediation* and the auditee uploads better
  evidence. *Verified* moves it on.

**6.3 Lead — request closure**
- Open the finding (Findings tab) → **Request closure**. Status: *Pending closure*.

**6.4 Audit Manager — approve closure**
- **Review/Approval** → **Approve & Sign** (or **Reject** with a reason — the lead fixes and
  re-requests).
- *Expect:* finding **Closed**; when every finding is closed the **engagement closes** and shows the
  green "Engagement Completed" banner.

---

## 4. Rejection and return paths (run each at least once)

| Where | Who rejects | What happens next |
|---|---|---|
| Audit programme | CAE | Reason shown to manager; manager fixes and resubmits |
| Working paper | Manager | Auditor edits, resubmits, manager approves |
| Report (any level) | Manager / Director / CAE | Lead edits, resubmits; chain restarts at level 1 |
| Evidence request | Lead (**Return**) | Auditee re-uploads; lead accepts |
| Remediation | Lead (**Verify → Rejected**) | Auditee re-uploads; lead verifies |
| Finding closure | Manager | Lead addresses the point and re-requests closure |

A rejection **always needs a reason** — leaving it empty is blocked.

---

## 5. Linking risk and assets

**Risk** — *Audit Manager:* menu **Risk Register** → **New Risk** → fill Title, Description, Business
objective, **Linked Universe Entity** (pick the audited entity), Category, **Owner**, Likelihood,
Impact → **Add to register**.
- Effect: the entity's planning **priority** rises (visible when adding a plan to a programme).
- On a finding, **Related risk** links the finding to the risk; the finding page then shows
  **Linked risk**, and the risk page lists **Linked findings**.
- **Visibility rule:** a user without `risk:read_all` only sees **risks they own**. So an auditor
  usually sees an *empty* Related-risk list. **Tell auditors to ask the manager to link the risk**
  (the form now says this). Managers/CAE can see all.

**Assets** — *Audit Manager:* menu **Assets** → **New asset** (Asset tag, Name, Type, **Owner**, …) →
**Create asset**.
- Assets can be linked to the **universe entity, engagement, finding, risk and evidence**.
- Where it shows: finding page → **Linked assets**; risk page → **Linked assets**; engagement →
  **Assets** tab; asset page → **Audit context** tab (shows names, with links).
- *(not click-tested)* the buttons used to **create** the links — linking was done through the system's
  API in the dry run and the results were verified on screen. Practise the link step before class.

**IMOC** — switched **off** in this environment (the IMOC Tickets tab says "IMOC is disabled"). Skip it
in the practical; mention that it is an optional read-only ticket link.

---

## 6. What each person sees and is told

- **Auditee:** a smaller menu. On an engagement, Checklists, Working Papers, Evidence and Review are
  **locked**. They see only **Evidence Requests, Findings, Follow-up, Assets**.
- **Findings are hidden from the auditee during fieldwork** (they are still being drafted). They appear
  automatically when the engagement reaches **Quality Assurance**, so the auditee can respond **before the
  report is issued**. Until then their Findings tab says "No findings yet" — expected.
- **Notifications (bell icon, and the Notifications page)** fire at: audit scheduled, assignment,
  **findings awaiting your response (when Quality Assurance starts)**, approval required, approval completed/rejected, evidence requested, finding assigned, report issued,
  escalation. Emails are **not** sent in this environment (no mail server) — in-app only.

---

## 7. Rules that will be tested live (segregation of duties)

| Rule | What the class will see |
|---|---|
| The **same person can't hold two engagement roles** | "must be three different people" |
| A **super admin can't be lead, manager or team member** | blocked |
| **Nobody approves their own submission** | "…cannot also approve it (segregation of duties)" |
| If the **manager wrote the working paper**, the approval moves to **another qualified approver** (e.g. the lead) | manager gets no Approve button |
| Approvers must act **in order** | a level-3 user can't approve before level 1 |
| **Auditee can't verify their own remediation** | permission message |
| **Lead can't issue the report** | permission message |
| **Auditor can't dispute evidence** | permission message |

Any permission failure now says: **"You don't have permission to do this. Please contact your system
administrator."** Explain to the class this is the role/permission system doing its job.

---

## 8. Escalations (automatic)

- Runs **hourly**. An approval waiting too long, or an engagement past its SLA deadline, escalates in
  levels (default after **24 / 72 / 120 / 168 hours**).
- First-level recipients: the **current approver** (for a stalled approval) and the **lead auditor**
  (for an SLA breach). Higher levels go to the people configured in the escalation matrix (director,
  CAE).
- Recipients get an in-app notification and **acknowledge** it (only the person notified can).
  Menu: **Escalations**. Policies: **Escalation Policies**.
- You can't wait hours in class — **explain it; show the Escalations and Escalation Policies pages**.
  (In the dry run it was triggered by back-dating test data, which you shouldn't do live.)

---

## 9. Facilitator cheat-sheet

**Suggested running order (about 90–120 minutes)**
1. Manager: entity + programme (+ risk and asset) — 15 min
2. CAE: **reject** the programme once, manager fixes, CAE approves — 10 min
3. Manager: engagement + team — 10 min
4. Lead: start fieldwork; Lead/Auditor: checklist (use *Apply to all untested*), working paper; Manager:
   **reject** the working paper once, then approve — 20 min
5. Lead: evidence request; Auditee: upload; Lead: **return** once, then accept — 15 min
6. Auditor: finding — 5 min
7. Auditee: sees "findings awaiting your response" and submits the **management response** — 10 min
8. Lead: review; Manager → Director → CAE approve; CAE issues — 20 min
9. Auditee: remediation evidence; Lead: **reject** remediation once, then verify;
   Manager: approves closure — 20 min
10. Wrap up: segregation-of-duties and escalation talk — 10 min

**Practical tips**
- Give each role **their own browser profile or private window** so people can stay logged in; otherwise
  sign out (bottom-left arrow) between turns.
- First login takes 12–18 s — expect it.
- If a page seems stuck on a step, read the **What's next** box.
- The checklist is long; the bulk button exists for a reason.
- **One programme per year and audit type** — for a second run, use a new year or a different audit
  type.
- Uploads accept any file type; small PDFs/Word/Excel files work well.
- **Escape** inside a form closes only the open dropdown; pressing it again closes the panel (it asks
  before discarding what's typed).
- A tab can be opened directly with a link such as `…/audit/engagements/<id>?tab=review`
  (also `evidence`, `requests`, `findings`, `follow-up`, `working-papers`, `checklists`, `assets`).

**Quick fixes**
| Problem | Likely cause / fix |
|---|---|
| "You don't have permission to do this" | Wrong role for that step — check §1 |
| Auditee says "No findings yet" | Engagement still in fieldwork — findings appear at Quality Assurance |
| Auditee can't respond | Same — all checklist items tested and all working papers approved first |
| Lead sees no Verify button | Auditee hasn't responded yet |
| Can't find the approval | It's waiting for an earlier level — check the Approval chain on the Review tab |
| Programme can't be created | One already exists for that year + type |
| Related risk list empty | Auditor doesn't own the risk — ask manager to link it |
| Engagement didn't move on | All checklist items tested? All working papers approved? Read *What's next* |
| Engagement shows "reported" a moment after the last approval | Refresh once — it closes within seconds |

---

## 10. Printable checklist (tick as the class goes)

- [ ] Entity created (Manager)
- [ ] Programme created, plan added, submitted (Manager)
- [ ] Programme rejected once, fixed, approved (CAE)
- [ ] Engagement created, team assigned (Manager)
- [ ] Fieldwork started (Lead)
- [ ] Checklist tested (Lead/Auditor)
- [ ] Working paper submitted, rejected once, approved (Auditor/Manager)
- [ ] Evidence requested, uploaded, returned once, accepted (Lead/Auditee)
- [ ] Evidence uploaded directly (Auditor)
- [ ] Finding raised (Auditor)
- [ ] Management response submitted (Auditee) — before the report
- [ ] Review generated and submitted (Lead)
- [ ] Approved at levels 1, 2, 3 (Manager, Director, CAE)
- [ ] Report issued (CAE) — auditee notified
- [ ] Remediation evidence (Auditee)
- [ ] Remediation rejected once, then verified (Lead)
- [ ] Closure requested and approved (Lead/Manager)
- [ ] Engagement closed
- [ ] Risk linked; asset linked
- [ ] Segregation-of-duties demonstrated
