# Audit Lifecycle UX — Design Spec
**Date:** 2026-06-09  
**Status:** Approved for implementation

---

## 1. Problem

The audit lifecycle flow is fragmented and creates confusion at three critical points:

1. **Assigned users are invisible to themselves** — Supporting auditors assigned via `workflow_assignments` never see those engagements on their dashboard. `MyWorkPanel` only shows engagements where the user is `leadAuditorId`. The backend already exposes `/workflow/assignments/mine` but it is never used on the dashboard.

2. **Status transitions are buried and passive** — After creating an engagement, it sits in `planned` with no obvious next action. The "Move to {next stage}" button lives in a small card header inside the Overview tab — a place many users never look. The `StatusStepper` shows the task checklist but owns no actions.

3. **Lifecycle context is invisible** — Engagements show no trace of where they came from (which plan, which universe entity). Users lose the thread between Universe → Plan → Engagement once they land on the engagement page.

---

## 2. Goals

- An auditor assigned to any engagement sees it immediately on their dashboard — whether as lead, manager, auditee, or supporting auditor.
- The next action to advance the engagement lifecycle is always visible on the engagement page without the user having to hunt for it.
- Every engagement shows its lineage (plan + universe entity) so the broader context is never lost.
- No new pages. No new routes. Fix the wiring between existing pieces.

---

## 3. Changes

### 3.1 MyWorkPanel — three-section work center

**File:** `frontend/components/dashboard/MyWorkPanel.tsx`

Replace the current two-section panel (Active Engagements + Pending Approvals) with three sections:

**Section A — Active Engagements (Lead/Manager/Auditee)**
- Existing data from `GET /dashboard/my-work` → `myActiveEngagements`
- No change to data or rendering

**Section B — My Assignments (Supporting)**
- New fetch: `GET /workflow/assignments/mine` (already used in `/workflow?tab=assignments`)
- Filter: exclude any `engagementId` already shown in Section A to avoid duplicates
- Each row: engagement reference (mono) + title + role badge (`Supporting Auditor`) + `View` link to `/audit/engagements/{engagementId}`
- Empty state: "No supporting roles assigned."

**Section C — Pending Approvals**
- Existing data from `GET /dashboard/my-work` → `myPendingApprovals`
- No change to rendering; "Review" link goes to `/workflow?tab=inbox`

**Data fetching:** Add a second `useQuery` for `workflowApi.listMine()` alongside the existing `dashboardApi.getMyWork()` call.

---

### 3.2 StatusStepper — embedded action button

**Files:** `frontend/components/audit/engagements/StatusStepper.tsx`, `frontend/components/audit/engagements/OverviewTab.tsx`

**StatusStepper receives two new props:**
```ts
interface Props {
  engagement: AuditEngagementDetail;
  onAdvance?: () => void;       // mutation trigger
  isAdvancing?: boolean;        // loading state
  canAdvance?: boolean;         // permission gate
}
```

**Inside the guide panel**, after the task list and the amber rules banner, add:

- If `canAdvance` and `next` status exists: a full-width primary `Button` — "Move to {humanizeStatus(next)}" — with `isLoading={isAdvancing}`.
- The button is **disabled** (with tooltip "Complete all tasks above first") when any task in the current stage's checklist is `done: false` AND the user is not `super_admin` / `audit_admin`.
- Admin-level users can always advance regardless of task completion (they may have legitimate reasons to skip).
- For the `closed` stage: no button.

**OverviewTab:**
- Remove the `action` prop from the `CardHeader` of the "Engagement details" card (the old small button is gone).
- Pass `onAdvance={() => update.mutate(next)}`, `isAdvancing={update.isPending}`, `canAdvance={canUpdateEngagement && Boolean(next)}` into `StatusStepper`.

This makes the stepper the single authoritative place to advance the lifecycle.

---

### 3.3 Engagement detail — lineage + assignee callout

**File:** `frontend/app/(app)/audit/engagements/[id]/page.tsx`  
**File:** `frontend/components/audit/engagements/OverviewTab.tsx`

#### 3.3a Lineage pill in PageHeader

In `EngagementDetailPage`, below the `subtitle` (Reference number), add a small secondary line:

- If `engagement.planItemId` is set: show `"From plan: {engagement.planTitle ?? 'Annual Plan'}"` — data already in the engagement detail response if the backend includes plan name. If `planTitle` is absent from the current `AuditEngagementDetail` type, add it as an optional field and ensure the backend include for engagement detail returns it via the plan_item → plan relation.
- If `engagement.isAdhoc` is true (no plan item): show `"Ad-hoc engagement"`.
- Render as a muted `text-xs text-text-secondary` line under the subtitle, not a badge — keep it subtle.

#### 3.3b Supporting auditor callout in OverviewTab

`OverviewTab` already fetches `workflowApi.listByEngagement(engagement.id)` into `assignments`. After the data loads, check:

```ts
const currentUserId = user.id; // from usePermissions()
const myAssignment = assignments.data?.find(a => a.userId === currentUserId);
```

If `myAssignment` exists and the user is NOT the `leadAuditorId` / `auditManagerId` / `auditeeId` on the engagement (i.e., they are a supporting auditor only):

Show a blue info banner at the very top of the tab (above the status meaning strip):

> "You are assigned as **{humanizeStatus(myAssignment.role)}** on this engagement."

This gives supporting auditors immediate context when they navigate from their dashboard.

---

### 3.4 Workflow Assignments tab — rows navigate to engagement

**File:** `frontend/app/(app)/workflow/page.tsx` — `AssignmentsTab`

Currently the assignments table has no row click. Add `onRowClick={(a) => router.push(`/audit/engagements/${a.engagementId}`)}` to make rows navigable. This means when a user opens `/workflow?tab=assignments` and sees their list, they can click straight into the engagement.

---

### 3.5 StartAuditWizard — default to "Start audit now"

**File:** `frontend/components/audit/engagements/StartAuditWizard.tsx`

Step 4 currently has two buttons: "Finish" (leaves engagement in `planned`) and "Start audit now" (advances to `in_progress`). This is confusing — "Finish" sounds like the safe default but it leaves the engagement stranded.

Change:
- Make "Start audit now" the primary (filled) button — it already is, but label it more clearly: **"Start fieldwork"**
- Rename "Finish" to **"Save & review later"** — secondary/ghost style
- Add a one-line note: `"Choosing 'Save & review later' leaves this engagement in Planning status. You can start fieldwork from the engagement page."`

This removes the ambiguity about what "Finish" means.

---

## 4. Data flow summary

| Pain point | Data source | Already exists? | Change required |
|---|---|---|---|
| Supporting auditor assignments on dashboard | `GET /workflow/assignments/mine` | Yes | Add to `MyWorkPanel` |
| Advance lifecycle button | `PATCH /engagements/:id/status` | Yes | Move to `StatusStepper` |
| Lineage pill | `engagement.planTitle` via plan_item include | Partial — needs type + backend check | Add optional field |
| Assignee callout | `workflowApi.listByEngagement()` already fetched | Yes | Check current user in result |
| Assignments table row click | Router push | Yes | One-line addition |
| Wizard default button | UI only | Yes | Label + style change |

---

## 5. Out of scope

- New pages or routes
- Backend schema changes
- The "Audit Program" board view (Approach C)
- Risk module or settings changes
