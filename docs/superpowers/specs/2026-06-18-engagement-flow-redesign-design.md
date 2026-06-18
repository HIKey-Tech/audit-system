# Engagement Flow Redesign — Design Spec

> Date: 2026-06-18
> Author: Wole (with Claude)
> Status: Draft for review
> Scope: Audit engagement lifecycle — stage advancement, the engagement workspace UI, the approval chain display, and engagement visibility. Backend (`src/modules/audit`, `src/modules/workflow`) + frontend (`frontend/.../audit/engagements`).

---

## 1. Problem

The audit engagement experience is the heart of IAMS, but it does not match how the audit lifecycle is meant to feel, and the UI contradicts the permission-based engine underneath it:

1. **Stage advancement is a manual button.** A human must click "Move to X" even when the system already knows every gate is satisfied. Status behaves like a toggle someone flips rather than a reflection of the work.
2. **The "guide" panel is confusing.** The `StatusStepper` stacks a task checklist, a yellow "Status Transition Rules" banner, and an advance button. It explains *rules* instead of telling *the person looking at it* what they need to do.
3. **Hardcoded role language contradicts the model.** The UI says "obtain supervisor and CAE sign-off", "CAE must click Issue Report", and shows "Level 1 / Level 2". The backend approval engine is already permission-based and per-engagement (`audit-config.utility.ts` → `ApprovalMatrix`), resolving each level to a permission holder or the assigned engagement manager — never to a role named "CAE". The words are stale; the logic is correct.
4. **The approval chain is not shown per engagement as people.** The data to show names exists on `ApprovalStepResponseDto` (`approver`, `requiredPermission`, `level`), but the engagement workspace does not render the chain, and permission-based levels have no single name until someone acts.
5. **Visibility is coarse and has a gap.** Scoping is binary: `engagement:read_all` (see everything) vs. named party (lead/manager/auditee/assignee). Oversight approvers who hold `report:approve:oversight`/`:final` but are not on the team cannot open the engagement they must sign off — tempting admins to grant blanket `read_all`, which is what makes it feel like "everyone sees everything".

This redesign makes **status a reflection of reality**, rebuilds the workspace around **"what's next for you"**, shows the **real approval chain with names**, and replaces the binary visibility model with **three clear tiers** plus a **restricted auditee view**.

---

## 2. Guiding principle

**An engagement's status is derived from its work and its sign-offs — not a field someone toggles.** The engagement advances itself the moment a stage's gates are satisfied. The only exceptions are the two transitions that are genuine human *decisions* rather than mere completion: **starting fieldwork** and **issuing the report**. Everything else flows automatically.

This is forward-only: reconciliation advances a stage when gates are met; it never auto-regresses a stage if an artifact later changes (that would be chaotic and is handled by normal review, not by status flipping backward).

---

## 3. The stage flow

Stages (unchanged set): `planned → in_progress → under_review → reported → closed`.

| Transition | Mechanism | Trigger / gate | Who acts |
|---|---|---|---|
| **planned → in_progress** ("Start fieldwork") | **Manual, one click** | Team + schedule complete (already validated). Stamps `actual_start_date`, populates checklists. | Lead auditor (or anyone with `engagement:update`) |
| **in_progress → under_review** | **Automatic** | All checklist controls tested (no `not_tested`) **and** every working paper `approved`. (`requireAllChecklistsTestedBeforeUnderReview`, `requireApprovedWorkingPaperBeforeUnderReview`) | No one — derived |
| **under_review → reported** | **Automatic** | An audit report has been **issued**. The deliberate act is *issuing the report* (never automatic — a report must not mail itself to the auditee). (`requireReportIssuedBeforeReported`) | Report issuance is the human act; stage follows |
| **reported → closed** | **Automatic** | Every finding is `closed` (each closure already runs its own approval chain). (`requireClosedFindingsBeforeClose`) | No one — derived |

**Net effect:** exactly two human acts remain — **Start fieldwork** and **Issue report** — each performed by a named, permissioned person and recorded in the audit trail. The `requireXxx` lifecycle gates in `audit_lifecycle_rules` remain the source of truth and stay GBB-configurable; this change only flips *who initiates the transition* from "a person clicking Move to X" to "the system, as soon as the gates pass".

### 3.1 Implementation: `reconcileStatus`

Add `EngagementService.reconcileStatus(engagementId, actor)`:

- Loads the engagement and computes the **highest stage whose gates are satisfied**, walking forward from the current stage only.
- For each candidate forward transition, reuses the existing `_assertLifecycleGate` / finding-closure checks (refactored to return booleans instead of throwing, so reconciliation can *test* a gate without raising).
- Advances through the existing `updateStatus` side-effect path (so `actual_start_date`, checklist population, `last_audited_at`, audit-log entries all still fire) — but does **not** cross a *manual* transition. `planned → in_progress` is never auto-crossed; reconciliation starts evaluating at `in_progress` and up.
- Idempotent and safe to call repeatedly.

**Call sites** (after the action commits, fire-and-forget-safe but awaited within the request where cheap):
- Working-paper approval completes (workflow approval final-level for a working paper).
- Checklist control test result saved.
- Report **issued**.
- Finding closure approved (finding moves to `closed`).

**Safety net:** extend an existing audit background job (or add `BG:AUDIT:RECONCILE:STATUS:HOURLY`) to reconcile any non-closed engagement whose gates are met but whose status lagged (e.g., if an in-request reconcile was skipped). Idempotent by construction.

`updateStatus` (the manual endpoint) stays for `planned → in_progress` and as an admin override, but the generic "Move to next" button is removed from the UI.

---

## 4. The engagement workspace UI

### 4.1 Replace `StatusStepper`'s guide with a "What's next" panel

Keep the clean 5-node progress bar (Planning → Fieldwork → Review → Reporting → Closed). **Remove** the task-checklist + yellow "Status Transition Rules" banner + "Move to X" button stack.

In its place, a **What's next** panel that reads as *who needs to do what*, using real names:

- Computes a short **blocker list** for the current stage from the detail payload (`checklistProgress`, `workingPaperStats`, `reportStatus`, `findingStats`) and the resolved approval chain (§5):
  - *"Waiting on **Tunde Bakare** (Lead Auditor) to test 3 of 12 controls."*
  - *"Working paper WP-002 awaiting approval from **Adaeze Okonkwo** (Audit Manager)."*
  - *"Report approved — **Fatima Aliyu** can issue it to the auditee."*
- When the **viewer is the blocker**, their row is highlighted and the relevant action/CTA is shown inline (e.g. "Start fieldwork", a deep link to the Working Papers tab, "Issue report").
- When nothing blocks and the stage is mid-automatic, show *"Fieldwork complete — moving to Quality Review."*
- The only buttons that ever appear here are the **two manual acts**: **Start fieldwork** (stage `planned`, shown to those with `engagement:update`) and a link to **Issue report** (stage `under_review`, when the report is approved, shown to the eligible issuer).

No "Move to next stage" button. No rules banner.

### 4.2 Language fix

Remove every hardcoded role string from `StatusStepper.tsx` and any sibling copy:
- "CAE", "supervisor", "Level 1/2" → the **actual assigned person's name + their function on this engagement** ("Audit Manager: Adaeze Okonkwo", "Report issuer: Fatima Aliyu").
- Where a step is permission-based and unacted, render candidate names (§5), not a role label.

---

## 5. Approval chain — shown per engagement, with names

Render each engagement's approval chains (report, working papers, finding closures) as **people**, in the workspace (Report tab and the What's-next panel).

New backend resolver (workflow module), e.g. `ApprovalService.resolveChainForEntity(entityType, entityId)` returning, per level:

```
{
  level: number,
  kind: 'person' | 'permission',
  status: 'pending' | 'approved' | 'rejected' | 'upcoming',
  resolvedApprover?: { id, displayName, jobTitle },   // when acted, or pinned engagement manager
  candidates?: { id, displayName, jobTitle }[],        // for unacted permission levels
  requiredPermission?: string
}
```

- **Pinned levels** (`ENGAGEMENT_MANAGER_APPROVER`) resolve to the engagement's audit manager — **always a real name**.
- **Permission levels** (`report:approve:oversight`, `report:approve:final`, etc.) resolve to the **list of active permission holders** before anyone acts (reusing the holder-lookup pattern from `EngagementService.getEligibleUsers` / the user service). Once a step is acted on, it collapses to the **single person who signed** (already on `approver`).

UI renders: `Adaeze Okonkwo → (oversight: any of Ibrahim Musa, Fatima Aliyu) → Fatima Aliyu (signed 2026-06-18)`. Never "Level 1 / Level 2".

---

## 6. Visibility — three tiers + restricted auditee view

### 6.1 Three tiers

Replace the binary scope in `EngagementService._actorScope` with:

1. **Oversight tier — `engagement:read_all`.** Sees all engagements (list + detail). Reserved for genuine oversight roles (CAE-type, audit director, audit admin). GBB assigns this permission to roles in Settings — not hardcoded.
2. **Involved parties — automatic.** Lead auditor, audit manager, auditee, supporting auditors (workflow assignees). See *their* engagements in the list and detail. (Already implemented.)
3. **Active approvers — automatic, detail access.** A user with a **pending approval step they are eligible for** on one of this engagement's entities (report / working paper / finding closure) can **open the engagement detail** while that step is open — because you cannot responsibly approve what you cannot read. Implemented in `getEngagementById` (not the list query): given the engagement, look up its report/working-paper/finding ids, and allow access if a `workflow_approval_steps` row for those entities is `pending` and either `approver_id = actor.id` or `required_permission ∈ actor.permissions`. Approvers reach engagements via their **approval inbox** link, so list-query denormalization is unnecessary. Access reverts automatically when the step closes.

This closes the oversight-approver gap **without** handing out blanket `read_all`.

### 6.2 Restricted auditee view

When the viewer's only relationship to the engagement is **auditee** (not also an auditor/manager/assignee, and not oversight), they get a restricted workspace:

| Area | Auditee sees? |
|---|---|
| Overview / scope / team / schedule | ✅ |
| **Issued** report | ✅ |
| Their findings + remediation / follow-up tasks | ✅ |
| Working papers | ❌ hidden |
| Draft / unissued findings | ❌ hidden |
| Internal evidence | ❌ hidden |
| Checklists (internal control tests) | ❌ hidden |

**Implementation (defense in depth):**
- The engagement detail response gains a `viewerContext` object computed server-side: `{ role: 'oversight' | 'team' | 'auditee', canViewWorkingPapers, canViewInternalEvidence, canViewChecklists, canViewDraftFindings }`.
- **Frontend** hides tabs/sections based on `viewerContext` (Working Papers, Evidence, Checklists hidden for a pure auditee; Findings filtered to issued/finalized).
- **Backend** enforces the same on the sub-resource endpoints (working-paper list/detail, evidence, checklists, findings) so hiding a tab is not the only guard — a pure auditee calling the working-papers endpoint directly gets `403`/empty.
- "Pure auditee" = actor matches `auditee_id` and is not lead/manager/assignee and lacks `engagement:read_all`. A user who is both auditee and oversight keeps the full view.

---

## 7. Components & files touched (orientation, not exhaustive)

**Backend**
- `src/modules/audit/engagement/service/implementation/engagement.service.ts` — `reconcileStatus`, refactor `_assertLifecycleGate` to boolean-returning gate checks, three-tier `_actorScope`, active-approver detail access, `viewerContext` on detail.
- `src/modules/audit/engagement/dto/response/engagement.response.dto.ts` — add `viewerContext`.
- Checklist / working-paper / report / finding-closure services — call `reconcileStatus` after gate-affecting actions; enforce auditee restrictions on their read endpoints.
- `src/modules/workflow/approval/service/...` — `resolveChainForEntity` resolver + route.
- `src/modules/background/...` — optional `BG:AUDIT:RECONCILE:STATUS:HOURLY` safety-net job.

**Frontend**
- `frontend/components/audit/engagements/StatusStepper.tsx` — strip guide/rules/advance button; keep progress bar; new **What's next** panel (may split into a `WhatsNextPanel.tsx`).
- `frontend/app/(app)/audit/engagements/[id]/page.tsx` — remove `nextEngagementStatus`/advance mutation wiring; gate tabs on `viewerContext`.
- `frontend/components/audit/engagements/ReportTab.tsx` — render resolved approval chain with names; keep "Issue report" as the manual act.
- New small component for the **approval chain with names**, reused in What's-next and Report tab.
- `frontend/lib/api/audit.ts` / types — `viewerContext`, approval-chain resolver client.

---

## 8. Non-goals (YAGNI)

- No change to the set of stages or to the `audit_lifecycle_rules` gate definitions (only *who triggers* the transition).
- No change to the approval **matrix** model — it is already permission-based and configurable; we only *display* it better and *resolve* candidate names.
- No auto-issuing of reports, no auto-starting of fieldwork.
- No status auto-regression.
- No new roles. Visibility tiers ride on existing/Settings-assigned permissions (`engagement:read_all`).
- No rework of the StartAuditWizard creation flow (it already collects team/schedule/checklist correctly).

---

## 9. Success criteria

1. Advancing an engagement requires **zero** "Move to next stage" clicks; the only lifecycle buttons are **Start fieldwork** and **Issue report**.
2. Completing the last gate of a stage (last control tested, last working paper approved, report issued, last finding closed) advances the engagement **within the same request**, verified against the DB.
3. The engagement workspace shows a **What's next** panel naming real people and surfacing the viewer's own action when they are the blocker.
4. No UI string contains "CAE", "supervisor", or "Level 1/2"; the approval chain renders names (or candidate names) per engagement.
5. An oversight approver not on the team can open an engagement they have a pending step on; a pure auditee **cannot** load working papers, internal evidence, checklists, or draft findings (enforced at the API, not just hidden tabs).
6. `npm run build` passes for backend and frontend.
