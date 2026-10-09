# IAMS UAT dry-run report — 9 Oct 2026

Driven end to end through the browser (Chrome extension), logging in and out between all seven users, following `~/Downloads/IAMS-UAT-Script.docx`.
Build: `dev` @ `e4de189`. Local stack: SQL Server in Docker, API on :3010, frontend on :3001.

**Bottom line:** every step of the script can be completed and the core lifecycle (programme → engagement → fieldwork → 3-level approval → issue → remediation → closure) works. But **five things will embarrass you tomorrow if you don't fix or work around them** (section 1), and the script itself needs about six edits (section 2).

---

## 0. How the run was set up (and what I changed)

| Item | Detail |
|---|---|
| Script file | `/Users/mac/audit/script.md` is **0 bytes**. I used `~/Downloads/IAMS-UAT-Script.docx` (it was open in Word one minute before the empty file was created). Check this is the version you want to hand out. |
| Port 3000 | Taken by another project (`spiceisland`). IAMS API ran on **3010** (`PORT=3010`), frontend on 3001 with `INTERNAL_API_URL=http://localhost:3010/api/v1`. |
| SQL Server | The `iams-mssql` container was stopped (exited 9 days ago). Started it, ran `migrate deploy`, `db seed`, `seed:role-permissions`, `seed-compliance-controls.ts`. |
| API env overrides (not saved to `.env`) | `RATE_LIMIT_MAX_REQUESTS=5000` (see 1.2) and `SMTP_HOST=127.0.0.1 SMTP_PORT=1` (see 1.3). Without these the run stalled. |
| MFA | `.env` has `MFA_MANDATORY=false`, so the "Set up two-factor authentication → Skip" screen **never appeared**. Not tested. |
| Leftover data | The DB still holds the 28 Sep demo data (AUD-2026-001 Dynafin, its finding, SAR-2026-0001…0018, SEC-2026-0001). I did not delete it. |
| Script deviations | Parts 3 and 4 had to be repeated on AUD-2026-001 (see 2.1). |

Data created during the run (still in the local DB): Treasury Operations entity, risk "Unauthorised payment release" (20 Critical), two programmes, engagement AUD-2026-002 (Closed), finding, working paper, review, REQ-2026-0001, AST-001, SAR-2026-0019/0020, SEC-2026-0002/0003.

---

## 1. Must fix or work around before UAT

### 1.1 CAE, Director and Auditee get 403 on every document download  — **major, script step 10 fails**
- As CAE: `GET /documents/:id/file` → `403 Insufficient permissions` for the **signed review**, the **issued report PDF**, and the **signed programme she approved herself**. As Auditee: the remediation evidence file they just uploaded also 403s.
- The Download links are still shown, so the user clicks a dead link. The script says "Issue review ✅ … download the PDF".
- Cause: `document.controller.ts` `_getFileById` requires `document:read` (only `user_signature` is exempt), and `prisma/seed.ts` gives `document:read` only to super_admin, audit_manager, audit_lead, auditor. `cae`, `director`, `auditee`, `audit_committee`, `viewer` don't have it.
- Fix options: exempt `workflow_approval_signed` and `audit_report` (the per-document ACL `assertCanUserAccess` still runs), or grant `document:read` to cae/director (and a scoped path for auditee). Lead/Manager downloads work (200).

### 1.2 Rate limit is 100 requests / 15 min in `.env` and `.env.example`  — **major**
- Each dashboard load fires ~14 calls. After ~25 minutes of normal clicking the API returned **429** and the engagement page showed a generic **"Something went wrong"** crash screen (no "too many requests, retry in N s" message).
- The code's own comment says 100/15 min "throttled normal SPA usage" and sets the default to 600; the VPS runbook says 300; `.env.example` still says 100. If tomorrow's environment was built from `.env.example` it will throttle a live demo. All clients behind one corporate NAT share one bucket.
- Set `RATE_LIMIT_MAX_REQUESTS` to at least 600 (higher for a demo with several people on one network), and make the UI show a proper 429 message.

### 1.3 Notification queue wedges and in-app alerts stop  — **major, script step 13 check fails while wedged**
- With SMTP unconfigured, the job `BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE` stopped finishing ("previous run is still active" every 15 s). From then on **no queued in-app notification is delivered** (25 stuck, including "Risk reassessment suggested", over 15 minutes late). A restart cleared it, then it hung again on the first email item.
- Workaround used: point SMTP at a closed local port so email fails instantly; the queue drained (34 in-app sent) and Ibrahim received "Risk reassessment suggested".
- Root cause not isolated (the transport already has timeouts and `pool: true`). Needs a fix (per-item timeout, or don't let email block in-app delivery). For UAT either configure real SMTP or disable the email channel.
- Also: `SMTP_USER` empty → log noise `530 Authentication Required` every 30 s.

### 1.4 Audit log "Details show old and new values" is true for 4 of 402 entries  — **script step (Part 7) is misleading**
- Log drawer shows **New values only** for checklist update, security-test authorise and access-review decisions. Only 4 rows have old values (assignment removal, security-test status changes). Old/new values are raw JSON with UUIDs.
- IP and user agent are **"—"** on UI-originated entries (checklist update, assignment removal). 257 of 402 rows have them.
- For the demo, open **"Workflow Assignment Remove"** (search "remove") to show before and after values. `verify-chain` works: "Audit log chain intact" (402/402).
- Also: every login writes two rows ("User logged in" attributed to *System*, then "Signed in" with the user), and the "only entries that changed data" filter still lists Signed in/out.

### 1.5 The script breaks on its own ordering  — see section 2.

---

## 2. Script corrections

| # | Where | Problem | Fix |
|---|---|---|---|
| 2.1 | Part 3, "engagement → Assets tab → Link asset" | Engagement from Part 1 is **Closed** → toast "Cannot change the asset scope of a closed engagement". | Link the asset **before** step 13 (closure), or use an open engagement. I linked to AUD-2026-001 instead. |
| 2.2 | Part 4, "engagement Evidence tab → drop a file" | Same reason: POST returns 400 "Engagement must be in progress"; the UI shows **no error** and the drop zone is still offered. | Do it before closure, or use an open engagement. |
| 2.3 | Part 5, "Seven seeded users" | Seed creates **14** users (the 7 plus `*2` variants). | Say "14", or remove the `*2` users from the seed. |
| 2.4 | Part 1 step 1, New risk | **Description is required** but not listed. | Add "Description: any text". |
| 2.5 | Parts 6/7 | **Sign off review**, **Authorise test** each require a **note**; **Plan test** requires **Provider / team**. | Add these fields. |
| 2.6 | Part 7, audit-log row | See 1.4. | Name the row ("Workflow Assignment Remove"). |
| 2.7 | Part 1 step 4 | The checklist template has 3 controls; "all but the first two" = delete one. | Fine, but say "delete the last control". |
| 2.8 | Part 1 step 5 | Raise finding: Category defaults to **System/IT** and severity to **Critical**; the script sets both, so they must be changed. | OK as written; just be aware. |
| 2.9 | Before Part 1 | "If you see Set up two-factor authentication, click Skip" — not seen here (`MFA_MANDATORY=false`). | Check the UAT env. |
| 2.10 | Tip for the live demo | The first click right after a page navigation is often lost (page hydrates for ~3 s). | Pause 3 s after each page load. |

---

## 3. Bugs and broken logic (moderate)

1. **Form defaults are not what is shown** (same family): *New risk* shows Likelihood "1 — Rare" / Impact "1 — Minor" but the calculated score is **9 Medium** (internal default 3×3). *New asset* shows Criticality "Low" / Classification "Public" but saves **Medium / Internal**. If a user doesn't touch the selects, they save values they never saw.
2. **Working paper rejection**: the **reason is not shown** anywhere on the paper (row or drawer); the author only sees it truncated in the bell. The drawer subtitle reads **"Version undefined · rejected"**; the list shows **"Created by ·" with no name**; the manager sees a **Submit** button on someone else's rejected paper.
3. **Author can click Approve & Sign / Reject on their own working paper**, is forced to draw+save a signature, and only then gets "not authorized". Server enforcement is correct; the UI should hide it.
4. **Stale approval chain**: after Approve & Sign (programme, review) the chain still shows "awaiting" until refresh; after a rejected programme is resubmitted it still shows "Fatima Aliyu · rejected".
5. **Programme list "Approved by" shows "—"** for approved programmes (the detail page shows Fatima).
6. **Review template defaults to "Compliance Audit Report"** on a Financial engagement. The generated review is thin (one-line summary, boilerplate scope/methodology).
7. **Raise finding from a failed control**: "Source control test" shows **None** (even though the control is the origin), and the **Raise finding button stays** on the failed row after raising (can create duplicates; not tested). The finding page does not show source control or related risk anywhere.
8. **Attestation "Confirmed" is a red pill** (should be positive).
9. **Notifications**: raw slugs in text ("audit_working_paper 'WP-01…'", "audit_report", "audit_plan", "audit_finding_closure"); *Mark all read* toast says **"Marked undefined as read"**.
10. **Closed engagements stay editable in places**: Team → Manage lets you remove/assign staff on a Closed engagement (asset scope is blocked, staff is not); "Link asset" and the evidence drop zone are still shown.
11. **Assign Staff** candidates include the auditee, CAE and executives as "Supporting Auditor". **Remove** has no confirmation. Search "Emeka" also returns Chidi Onuoha.
12. **Access review**: bulk "Appropriate" on all 14 accounts was accepted although 2 are flagged "Privileged access needing justification" and 22 SoD conflicts exist (no justification required). Header said "30 open exceptions" but 36 were confirmed.
13. **Stale "What's next" card**: "(0/2 done)" after both checklist results were set; "approve working papers (0/1 approved)" while the paper was rejected.
14. **Auditee Home** "My Work → Active engagements" stops listing AUD-2026-002 after the review is issued, although remediation is still the auditee's task.
15. **Engagement wizard** doesn't prefill title or dates from the plan item (the plan already has dates).
16. **Audit Customization / System Configuration** both edit the same SLA values.
17. **Settings → Role Management** header says "8 roles" with 9 rows; the permission editor shows several labels just "Approve".

## 4. Polish / minor
- Owner dropdowns (risk, entity, asset) have no search; the list scrolls and only ~6 of 14 users are visible, so it looks like users are missing.
- No risk categories seeded (the script creates one, fine).
- Security testing "Plan test": a second click on the button closes the drawer again (click once and wait).
- Sidebar highlights "Data analytics" while viewing an access review.
- Findings-by-severity on the engagement still counts the closed finding.
- Auditee sidebar shows System → Analytics and Audit Intelligence (access level not checked).
- SA's **Authorise test** is greyed with no tooltip explaining why.
- Data pollution: old demo notifications (e.g. "New audit finding assigned" 11 days ago in Chisom's bell) could be mistaken for the script's step-11 alert.

---

## 5. What worked (✅)

**Part 1 (all 13 steps):** entity, category, risk scored 20 Critical; programme create/add plan/submit (Submitted); CAE Approve & Sign (Approved, signed PDF generated); engagement wizard (Planned); fieldwork start; evidence request; checklist Failed/Passed; raise finding; working paper submit; auditee evidence upload with Checklists/Working Papers/Evidence tabs greyed and no finding alert; evidence accept; WP reject → resubmit → approve and sign, engagement moved to Quality Assurance by itself; "not authorized" for the author's own approval; review generate/submit; 3-level approval (Manager on Review tab, Director and CAE from the Pending inbox "Level 2 of 3"); Issue review → Review Issued; finding alerts for the auditee after issue; management response → In Remediation; verify → Pending Closure; closure approval → Finding Closed, **Engagement Completed**; risk owner got "Risk reassessment suggested" (once the queue was unblocked).
**Part 2:** programme reject/resubmit/approve (reason shown to the submitter); ad-hoc request with ordered recipients, approve, sign with typed name, signed document; staff re-assignment; notifications page and mark all read.
**Part 3:** asset create, attestation listed.
**Part 4:** Documents upload; SA sees delete icon, Lead doesn't; evidence downloads for Lead (200).
**Part 5:** role permissions, lifecycle gates/approval matrix, system configuration, users list and profile drawer.
**Part 6:** access review run/appropriate/confirm/sign-off; analysis with the backup CSV (auto column mapping, 6 exceptions: 1 critical, 2 high, 3 medium); security test planned by Lead, authorised by Director; SA cannot authorise their own.
**Part 7:** Committee pack PDF (valid, 200); audit-log row details; `verify-chain` → "Audit log chain intact".

## 6. Not tested
2FA enrolment, SSO/Entra login, real email delivery, saving PDFs to disk (checked via in-page fetch), duplicate-finding behaviour, forgot-password, Dynafin/IMOC integrations, mobile layout.

## 7. Suggested order of work tonight
1. Fix 1.1 (document access for approvers) — it breaks a headline script step.
2. Set rate limit ≥ 600 and decide SMTP (real credentials, or disable email) — 1.2 and 1.3.
3. Edit the script (section 2) and decide whether to reset the DB (demo data, `*2` users) so alerts and lists are clean.
4. Quick wins: form defaults (3.1), rejection reason (3.2), raw slugs (3.9), "Confirmed" colour (3.8).

---

## 8. Resolution (same day, after the fixes)

Backend type-check, frontend type-check, the Next.js production build and all 75 Jest tests pass. Fixes were re-verified against the running system (API calls for permissions, queue and rules; browser for the forms and tabs).

| Item | Status |
|---|---|
| 1.1 CAE/Director/Auditee document 403 | **Fixed.** CAE and Director now get 200 on signed review, issued report PDF and signed programme; an auditee can open their own upload. The auditee still cannot open other people's review documents (by design). |
| 1.2 Rate limit | **Fixed.** `.env.example` and the runbook now say 600; the UI explains 429 and other errors instead of "Something went wrong". Set the value in tomorrow's environment too. |
| 1.3 Notification queue wedge | **Mitigated, root cause still unproven.** Per-item 45 s timeout, in-app first, no connection pool, fast failure when SMTP is unset. Verified: 49 in-app notifications delivered with no "previous run still active" warnings. If real SMTP is configured, watch the log on the first day. |
| 1.4 Audit log | **Fixed.** IP/user agent captured; before-values recorded for the main update actions; Before/After table; no duplicate login rows; filter excludes security events. Older rows are unchanged. |
| 1.5 / section 2 script | **Fixed.** Corrected script written to `/Users/mac/audit/script.md` (asset link and evidence upload moved before closure, new required fields, 14 users). |
| 3.1 Form defaults | **Fixed at the root** (shared Select). Verified on the risk form (3 — Possible / 3 — Moderate / 9 Medium) and the raise-finding form. |
| 3.2 / 3.3 Working paper | **Fixed.** Reason shown on the row; creator and reviewer names; "Version" no longer undefined; only the author sees Submit; the author does not see Approve/Reject. |
| 3.4 Stale approval chain | **Fixed** (chain query is invalidated after every approval action). |
| 3.5 Programme "Approved by" | **Fixed.** |
| 3.6 Review template | **Fixed** (it was the Select bug; the saved default was always GBB Standard). |
| 3.7 Finding ↔ control link | **Fixed.** Verified new finding is saved with its control (`checklist_id` linked) and the control row shows "Finding raised". The two findings created during the dry run have no link. |
| 3.8 Confirmed pill | **Fixed** (green). |
| 3.9 Notifications | **Fixed** for new notifications (plain names, real count in the toast). Existing rows keep their old text. |
| 3.10 Closed engagements | **Fixed.** Server refuses team changes; Manage, Link asset and the evidence drop zone are hidden or explained. |
| 3.11 Assign staff | **Fixed.** Audit staff only (UI and server), Remove asks for confirmation. *Retracted:* the "Emeka returns Chidi" search was correct (Chidi's seed email is `emeka2@gbb.gov.ng`). |
| 3.12 Access review | **Fixed.** Privileged/SoD accounts need a justification (verified: refused without a note, accepted with one). *Retracted:* the "30 vs 36" exception count was a misread of a small screenshot. |
| 3.13 Stale "What's next" | **Fixed** (refreshes after each checklist test; rejected papers get their own line). |
| 3.14 Auditee My Work | **Fixed.** Also found while re-testing: the auditee's Review tab said "No review yet" although a review had been issued (they cannot read it); the tab is now locked like the other internal tabs. |
| 3.15 Wizard prefill | **Fixed.** Verified: title, dates and SLA prefilled from the plan item. |
| 3.16 Duplicate SLA settings | **Fixed.** The standalone "Service levels" values were not read by anything and were removed. |
| 3.17 "8 roles" header | **Retracted.** The count comes from the same list as the rows. |
| Section 4 polish | **Fixed:** owner pickers are searchable; sidebar highlight on access-review pages; Authorise-test explanation; log action names tidied. **Not changed (by design):** the auditee sees Analytics (it is scoped to their own data); no risk categories are seeded (the script creates one, and the form already explains an empty list); the engagement severity card counts closed findings (it is a history view). |

Still your call before UAT: the local database contains the 28 Sep demo data and this dry run. To start clean, run the commands at the top of `/Users/mac/audit/script.md`.
