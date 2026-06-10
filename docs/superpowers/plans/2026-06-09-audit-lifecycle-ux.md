# Audit Lifecycle UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix three UX gaps in the audit lifecycle: supporting auditors can't see their assignments on the dashboard, the "advance lifecycle" button is buried, and engagement pages show no lineage or assignment context.

**Architecture:** Pure wiring changes — no new pages or routes. The backend already exposes all necessary data. We lift one mutation to a higher component, add one new `useQuery` to the dashboard panel, and thread new props through two existing components. One minimal backend change adds `planTitle` to the engagement response.

**Tech Stack:** Next.js 14, React Query (`@tanstack/react-query`), TypeScript, Prisma (backend), Express (backend). Tailwind CSS for styling.

---

## File Map

| File | Change |
|---|---|
| `src/modules/audit/engagement/service/implementation/engagement.service.ts` | Add `plan_item` to include |
| `src/modules/audit/engagement/dto/response/engagement.response.dto.ts` | Add `planTitle` field + mapper |
| `frontend/lib/types/domain.ts` | Add `planTitle` to `AuditEngagement` |
| `frontend/components/dashboard/MyWorkPanel.tsx` | Add My Assignments section |
| `frontend/components/audit/engagements/StatusStepper.tsx` | Add `onAdvance`/`isAdvancing`/`canAdvance` props + button |
| `frontend/app/(app)/audit/engagements/[id]/page.tsx` | Lift mutation here, add lineage subtitle |
| `frontend/components/audit/engagements/OverviewTab.tsx` | Remove old button + mutation, add assignee callout |
| `frontend/app/(app)/workflow/page.tsx` | Make assignment rows clickable |
| `frontend/components/audit/engagements/StartAuditWizard.tsx` | Rename step-4 buttons + hint text |

---

## Task 1: Backend — expose `planTitle` in engagement response

**Files:**
- Modify: `src/modules/audit/engagement/service/implementation/engagement.service.ts` (line 28)
- Modify: `src/modules/audit/engagement/dto/response/engagement.response.dto.ts`

- [ ] **Step 1: Update `engagementInclude` to fetch plan title**

In `engagement.service.ts`, replace line 28:
```ts
// Before
const engagementInclude = { universe: true };

// After
const engagementInclude = {
  universe: true,
  plan_item: { include: { plan: { select: { id: true, title: true } } } },
};
```

- [ ] **Step 2: Add `planTitle` to the response DTO interface**

In `engagement.response.dto.ts`, add `planTitle` to `EngagementResponseDto` after `planItemId`:
```ts
export interface EngagementResponseDto {
  id: string;
  referenceNumber: string;
  title: string;
  universeId: string;
  planItemId: string | null;
  planTitle: string | null;   // ← add this
  auditType: string;
  // ... rest unchanged
}
```

- [ ] **Step 3: Update the mapper parameter type and mapping**

In `engagement.response.dto.ts`, update `mapEngagementToResponse`:

```ts
export const mapEngagementToResponse = (
  engagement: {
    id: string;
    reference_number: string;
    title: string;
    universe_id: string;
    plan_item_id: string | null;
    audit_type: string;
    status: string;
    priority: string;
    lead_auditor_id: string;
    audit_manager_id: string;
    auditee_id: string;
    planned_start_date: Date;
    planned_end_date: Date;
    actual_start_date: Date | null;
    actual_end_date: Date | null;
    sla_deadline: Date;
    is_adhoc: boolean;
    adhoc_reason: string | null;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
    universe?: Parameters<typeof mapUniverseToResponse>[0];
    plan_item?: { plan?: { title: string } | null } | null;  // ← add this
  },
  extras?: {
    findingCounts?: FindingSeverityCount[];
    workingPaperCount?: number;
    checklistProgress?: ChecklistProgress;
  },
): EngagementResponseDto => ({
  id: engagement.id,
  referenceNumber: engagement.reference_number,
  title: engagement.title,
  universeId: engagement.universe_id,
  planItemId: engagement.plan_item_id,
  planTitle: engagement.plan_item?.plan?.title ?? null,  // ← add this
  auditType: engagement.audit_type,
  // ... rest of fields unchanged
  universe: engagement.universe ? mapUniverseToResponse(engagement.universe) : undefined,
  findingCounts: extras?.findingCounts,
  workingPaperCount: extras?.workingPaperCount,
  checklistProgress: extras?.checklistProgress,
});
```

- [ ] **Step 4: Build to verify no TypeScript errors**

```bash
npm run build
```

Expected: Build passes with no type errors.

- [ ] **Step 5: Commit**

```bash
git add src/modules/audit/engagement/service/implementation/engagement.service.ts src/modules/audit/engagement/dto/response/engagement.response.dto.ts
git commit -m "feat(audit): include planTitle in engagement response DTO"
```

---

## Task 2: Frontend types — add `planTitle` to `AuditEngagement`

**Files:**
- Modify: `frontend/lib/types/domain.ts`

- [ ] **Step 1: Add `planTitle` to the `AuditEngagement` interface**

In `frontend/lib/types/domain.ts`, find the `AuditEngagement` interface (currently around line 312) and add `planTitle` after `planItemId`:

```ts
export interface AuditEngagement {
  id: string;
  referenceNumber: string;
  title: string;
  universeId: string;
  planItemId: string | null;
  planTitle: string | null;   // ← add this line
  auditType: string;
  status: string;
  // ... rest unchanged
}
```

- [ ] **Step 2: Verify TypeScript in frontend**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No new errors introduced.

- [ ] **Step 3: Commit**

```bash
git add frontend/lib/types/domain.ts
git commit -m "feat(frontend): add planTitle to AuditEngagement domain type"
```

---

## Task 3: MyWorkPanel — add "My Assignments" section

**Files:**
- Modify: `frontend/components/dashboard/MyWorkPanel.tsx`

Context: Currently `MyWorkPanel` shows "Active Engagements" and "Pending Approvals". Supporting auditors assigned via `workflow_assignments` see nothing because `myActiveEngagements` only contains engagements where the user is `leadAuditorId`. The backend already has `GET /workflow/assignments/mine` returning all `WorkflowAssignment[]`.

- [ ] **Step 1: Add the `workflowApi` import**

At the top of `MyWorkPanel.tsx`, add to the existing imports:
```ts
import { workflowApi } from '@/lib/api/workflow';
import type { WorkflowAssignment } from '@/lib/types/domain';
```

- [ ] **Step 2: Add the assignments query inside the component**

Inside `MyWorkPanel` component, after the existing `useQuery` call, add:
```ts
const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
  queryKey: ['workflow', 'assignments', 'mine'],
  queryFn: () => workflowApi.listMine(),
});
```

- [ ] **Step 3: Compute deduplicated assignments**

After the two queries, add:
```ts
const leadEngagementIds = new Set((data?.myActiveEngagements ?? []).map((e) => e.id));
const myAssignments: WorkflowAssignment[] = (assignmentsData ?? []).filter(
  (a) => !leadEngagementIds.has(a.engagementId),
);
```

- [ ] **Step 4: Add the "My Assignments" section between the two existing sections**

Replace the `<div className="space-y-5">` content so the three sections appear in order: Active Engagements → My Assignments → Pending Approvals.

The full new content of the outer `<div className="space-y-5">`:

```tsx
<div className="space-y-5">
  {/* ── Section A: Active Engagements (Lead / Manager / Auditee) ── */}
  <section>
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
      Active Engagements
    </h4>
    {data!.myActiveEngagements.length === 0 ? (
      <p className="text-xs text-text-muted">None assigned to you.</p>
    ) : (
      <ul className="space-y-2">
        {data!.myActiveEngagements.slice(0, 5).map((eng) => (
          <li key={eng.id}>
            <Link
              href={`/audit/engagements/${eng.id}`}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-white px-2.5 py-2 transition-colors hover:bg-surface-alt"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">{eng.title}</p>
                <p className="text-[10px] text-text-muted">{eng.referenceNumber}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={eng.status} size="xs" />
                <span className="inline-flex items-center gap-1 text-[10px] text-text-muted">
                  <CalendarClock className="h-3 w-3" />
                  {formatDate(eng.slaDeadline)}
                </span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>

  {/* ── Section B: My Assignments (Supporting Auditor) ── */}
  <section>
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
      My Assignments
    </h4>
    {assignmentsLoading ? (
      <p className="text-xs text-text-muted">Loading…</p>
    ) : myAssignments.length === 0 ? (
      <p className="text-xs text-text-muted">No supporting roles assigned.</p>
    ) : (
      <ul className="space-y-2">
        {myAssignments.slice(0, 5).map((a) => (
          <li key={a.id}>
            <Link
              href={`/audit/engagements/${a.engagementId}`}
              className="flex items-start justify-between gap-2 rounded-md border border-border bg-white px-2.5 py-2 transition-colors hover:bg-surface-alt"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-text-primary">{a.engagementTitle}</p>
                <p className="text-[10px] text-text-muted">{a.engagementReference}</p>
              </div>
              <span className="shrink-0 rounded bg-surface-alt px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
                {a.role === 'lead_auditor' ? 'Lead' : 'Supporting'}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>

  {/* ── Section C: Pending Approvals ── */}
  <section>
    <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-text-secondary">
      Pending Approvals
    </h4>
    {data!.myPendingApprovals.length === 0 ? (
      <EmptyState
        compact
        icon={<Inbox className="h-4 w-4" />}
        title="Inbox is empty"
      />
    ) : (
      <ul className="space-y-2">
        {data!.myPendingApprovals.slice(0, 5).map((step) => (
          <li
            key={step.stepId}
            className="flex items-start justify-between gap-2 rounded-md border border-border bg-white px-2.5 py-2"
          >
            <div className="min-w-0 flex-1">
              <p className="text-xs font-medium text-text-primary">
                {ENTITY_LABEL[step.entityType] ?? humanizeStatus(step.entityType)}
              </p>
              <p className="text-[10px] text-text-muted">
                Level {step.currentLevel} · {formatDate(step.createdAt)}
              </p>
            </div>
            <Link
              href="/workflow"
              className="text-[10px] font-medium text-primary hover:underline"
            >
              Review
            </Link>
          </li>
        ))}
      </ul>
    )}
  </section>
</div>
```

- [ ] **Step 5: Verify the page compiles with no TypeScript errors**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/dashboard/MyWorkPanel.tsx
git commit -m "feat(dashboard): add My Assignments section to MyWorkPanel for supporting auditors"
```

---

## Task 4: StatusStepper — embed the lifecycle transition button

**Files:**
- Modify: `frontend/components/audit/engagements/StatusStepper.tsx`

Context: The stepper already shows a task checklist per lifecycle stage. We add a primary action button at the bottom of the guide panel so the user never has to hunt for how to advance the engagement.

- [ ] **Step 1: Add new props to the `StatusStepper` component**

At the top of `StatusStepper.tsx`, add the `useMutation` import and update the props interface. Find the existing props type (it's inline on the export):

```ts
// Replace the existing props signature:
// export const StatusStepper = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {

// With:
interface StatusStepperProps {
  engagement: AuditEngagementDetail;
  onAdvance?: () => void;
  isAdvancing?: boolean;
  canAdvance?: boolean;
}

export const StatusStepper = ({
  engagement,
  onAdvance,
  isAdvancing = false,
  canAdvance = false,
}: StatusStepperProps): JSX.Element => {
```

Also add `Button` to the imports at the top of the file (it's not imported yet):
```ts
import { Button } from '@/components/ui/Button';
```

- [ ] **Step 2: Compute `allTasksDone` from the existing tasks array**

After `const tasks = getActiveTasks();` and before `const progressPercent = ...`, add:

```ts
const allTasksDone = tasks.length > 0 && tasks.every((t) => t.done);
const nextStatus = NEXT_STATUS[engagement.status as keyof typeof NEXT_STATUS] ?? null;
```

Add the `NEXT_STATUS` map near the top of the component (before the `STAGES` array or just inside the component):

```ts
const NEXT_STATUS: Record<string, string> = {
  planned: 'in_progress',
  in_progress: 'under_review',
  under_review: 'reported',
  reported: 'closed',
};
```

- [ ] **Step 3: Add the action button at the bottom of the guide panel**

Inside the `{isOpen && (...)}` block, at the very end of the non-closed-state branch (after the amber `Transition Enforcements Banner` div, before the closing `</div>`), add:

```tsx
{canAdvance && nextStatus && onAdvance && (
  <div className="mt-4">
    <Button
      className="w-full"
      onClick={onAdvance}
      isLoading={isAdvancing}
      disabled={!allTasksDone && !isAdvancing}
      title={
        !allTasksDone
          ? 'Complete all tasks above before advancing'
          : undefined
      }
    >
      Move to {humanizeStatus(nextStatus)}
    </Button>
    {!allTasksDone && (
      <p className="mt-1.5 text-center text-[11px] text-text-muted">
        Complete all tasks above to unlock this action.
      </p>
    )}
  </div>
)}
```

Add `humanizeStatus` to the imports if not already imported:
```ts
import { humanizeStatus } from '@/lib/utils/status';
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/audit/engagements/StatusStepper.tsx
git commit -m "feat(engagements): add lifecycle transition button to StatusStepper"
```

---

## Task 5: EngagementDetailPage — lift the status mutation here

**Files:**
- Modify: `frontend/app/(app)/audit/engagements/[id]/page.tsx`

Context: The `update` mutation currently lives in `OverviewTab`. We move it up to `EngagementDetailPage` so `StatusStepper` (which is a sibling of `OverviewTab`, not a child) can receive `onAdvance` directly from the page.

- [ ] **Step 1: Add required imports to `EngagementDetailPage`**

Add to the existing imports at the top of `frontend/app/(app)/audit/engagements/[id]/page.tsx`:

```ts
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { engagementsApi } from '@/lib/api/audit';
import { usePermissions } from '@/lib/hooks/usePermissions';
```

- [ ] **Step 2: Add mutation and permission check inside `EngagementDetailPage`**

After the existing `useQuery` call (around line 50), add:

```ts
const qc = useQueryClient();
const { canManageAuditProgramme: canUpdateEngagement } = usePermissions();

const NEXT_STATUS: Record<string, string | null> = {
  planned: 'in_progress',
  in_progress: 'under_review',
  under_review: 'reported',
  reported: 'closed',
  closed: null,
};

const advanceMutation = useMutation({
  mutationFn: (status: string) => engagementsApi.updateStatus(params!.id, status),
  onSuccess: () => {
    toast.success('Status updated');
    qc.invalidateQueries({ queryKey: ['engagements', params?.id] });
  },
  onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
});

const nextStatus = data ? (NEXT_STATUS[data.status] ?? null) : null;
```

- [ ] **Step 3: Pass the new props to `StatusStepper`**

Find the existing `<StatusStepper engagement={data} />` line and replace it:

```tsx
<StatusStepper
  engagement={data}
  onAdvance={nextStatus ? () => advanceMutation.mutate(nextStatus) : undefined}
  isAdvancing={advanceMutation.isPending}
  canAdvance={canUpdateEngagement && Boolean(nextStatus)}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(app)/audit/engagements/[id]/page.tsx
git commit -m "feat(engagements): lift status mutation to EngagementDetailPage, wire StatusStepper"
```

---

## Task 6: OverviewTab — remove old button, add assignee callout

**Files:**
- Modify: `frontend/components/audit/engagements/OverviewTab.tsx`

Context: Now that the mutation lives in `EngagementDetailPage`, we remove the duplicate from `OverviewTab`. We also add the supporting-auditor callout using the assignments data the tab already fetches.

- [ ] **Step 1: Remove the `update` mutation and `next` variable from `OverviewTab`**

In `OverviewTab.tsx`, remove these lines (currently near the top of the component):

```ts
// Remove these:
const NEXT_STATUS: Record<string, string | null> = {
  planned: 'in_progress',
  in_progress: 'under_review',
  under_review: 'reported',
  reported: 'closed',
  closed: null,
};

const next = NEXT_STATUS[engagement.status];

const update = useMutation({
  mutationFn: (status: string) => engagementsApi.updateStatus(engagement.id, status),
  onSuccess: () => {
    toast.success('Status updated');
    qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
  },
  onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
});
```

Also remove `useMutation` from the react-query import if it's no longer used, and remove the `engagementsApi` import if it's no longer used.

- [ ] **Step 2: Remove the "Move to X" button from the card header action**

Find the `<CardHeader ... action={...}>` for the "Engagement details" card. It currently has:

```tsx
action={
  canUpdateEngagement && next ? (
    <Button
      size="sm"
      leftIcon={<ArrowRight className="h-3.5 w-3.5" />}
      onClick={() => update.mutate(next)}
      isLoading={update.isPending}
    >
      Move to {humanizeStatus(next)}
    </Button>
  ) : null
}
```

Remove the `action` prop entirely so it becomes:

```tsx
<CardHeader
  title="Engagement details"
  subtitle={`Reference ${engagement.referenceNumber}`}
/>
```

Also remove the `ArrowRight` import if no longer used.

- [ ] **Step 3: Add `usePermissions` to get the current user ID**

Add import at the top:
```ts
import { usePermissions } from '@/lib/hooks/usePermissions';
```

Inside the component, add alongside the existing `usePermission` calls:
```ts
const { user } = usePermissions();
```

The `canUpdateEngagement` variable can now be removed since the button is gone. Keep `canManageAssignments` as it is — it's still used for the "Manage" button in the assigned staff card.

- [ ] **Step 4: Add the supporting-auditor callout**

The `assignments` query already exists in `OverviewTab`:

```ts
const assignments = useQuery({
  queryKey: ['engagements', engagement.id, 'assignments'],
  queryFn: () => workflowApi.listByEngagement(engagement.id),
});
```

After the query declarations and before the JSX return, add:

```ts
const myAssignment = assignments.data?.find((a) => a.userId === user?.id);
const isOnlyAssigned =
  myAssignment != null &&
  engagement.leadAuditorId !== user?.id &&
  engagement.auditManagerId !== user?.id &&
  engagement.auditeeId !== user?.id;
```

Then inside the JSX, at the very top of the `<div className="grid ...">`, before the status-meaning strip, add:

```tsx
{isOnlyAssigned && myAssignment && (
  <div className="lg:col-span-3 rounded-lg border border-blue-200 bg-blue-50 dark:bg-blue-950/20 px-4 py-3 flex items-center gap-2">
    <Users className="h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
    <p className="text-sm text-blue-800 dark:text-blue-300">
      You are assigned as{' '}
      <span className="font-semibold">
        {myAssignment.role === 'lead_auditor' ? 'Lead Auditor' : 'Supporting Auditor'}
      </span>{' '}
      on this engagement.
    </p>
  </div>
)}
```

Make sure `Users` is in the imports (it already is, used for the assigned staff empty state).

- [ ] **Step 5: Clean up unused imports**

Remove `ArrowRight` from lucide-react imports if it was only used for the old button. Remove `useMutation` from react-query imports if no longer used. Remove `engagementsApi` from audit API imports if no longer used.

- [ ] **Step 6: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/audit/engagements/OverviewTab.tsx
git commit -m "feat(engagements): remove buried advance button from OverviewTab, add assignee callout"
```

---

## Task 7: Engagement detail page — lineage pill in header

**Files:**
- Modify: `frontend/app/(app)/audit/engagements/[id]/page.tsx`

Context: Once the engagement loads, show a subtle line below the subtitle indicating where the engagement came from (which plan, or that it's ad-hoc) and which universe entity is being audited.

- [ ] **Step 1: Add the lineage subtitle to the `PageHeader`**

In `EngagementDetailPage`, find the `<PageHeader ... />` block (currently after the loading/error guards). It currently has:

```tsx
<PageHeader
  title={data.title}
  subtitle={`Reference ${data.referenceNumber}`}
  breadcrumbs={...}
  actions={...}
/>
```

Replace the `subtitle` prop with a JSX element that includes lineage:

```tsx
subtitle={
  <span className="flex flex-wrap items-center gap-2 text-xs text-text-secondary">
    <span>Reference {data.referenceNumber}</span>
    <span className="text-border">·</span>
    {data.planTitle ? (
      <span>
        From plan:{' '}
        <span className="font-medium text-text-primary">{data.planTitle}</span>
      </span>
    ) : (
      <span className="rounded bg-amber-100 dark:bg-amber-900/30 px-1.5 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
        Ad-hoc
      </span>
    )}
    {data.universeName && (
      <>
        <span className="text-border">·</span>
        <span>
          Auditing:{' '}
          <span className="font-medium text-text-primary">{data.universeName}</span>
        </span>
      </>
    )}
  </span>
}
```

Note: Check whether `PageHeader` accepts `subtitle` as `React.ReactNode` or only `string`. If it only accepts `string`, you'll need to add a small line just below the `<PageHeader />` component instead:

```tsx
{/* Fallback if PageHeader subtitle is string-only */}
<div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-secondary">
  ...same content...
</div>
```

Check the `PageHeader` component signature at `frontend/components/ui/PageHeader.tsx` before deciding which approach to use.

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/(app)/audit/engagements/[id]/page.tsx
git commit -m "feat(engagements): add lineage pill (plan / ad-hoc / universe entity) to engagement header"
```

---

## Task 8: Workflow page — make assignment rows navigate to engagement

**Files:**
- Modify: `frontend/app/(app)/workflow/page.tsx`

Context: The `AssignmentsTab` shows a table of assignments. Rows are not clickable. Adding `onRowClick` makes it a one-click path from assignments list to the actual engagement.

- [ ] **Step 1: Add `useRouter` import**

In `workflow/page.tsx`, `useRouter` is already imported at the top:
```ts
import { useRouter, useSearchParams } from 'next/navigation';
```

Verify it's there — if not, add it.

- [ ] **Step 2: Pass `router` into `AssignmentsTab`**

`AssignmentsTab` is a component defined inside `workflow/page.tsx`. Add `router` as a prop or call `useRouter` inside `AssignmentsTab` directly. The simplest approach: call `useRouter()` inside `AssignmentsTab`.

In the `AssignmentsTab` component, add at the top:
```ts
const router = useRouter();
```

- [ ] **Step 3: Add `onRowClick` to the assignments `Table`**

Find the `<Table<WorkflowAssignment>` in `AssignmentsTab`. It currently has no `onRowClick`. Add:

```tsx
<Table<WorkflowAssignment>
  columns={columns}
  data={mine.data}
  rowKey={(a) => a.id}
  isLoading={mine.isLoading}
  onRowClick={(a) => router.push(`/audit/engagements/${a.engagementId}`)}
  emptyState={<EmptyState icon={<Users className="h-4 w-4" />} title="No assignments yet" />}
/>
```

- [ ] **Step 4: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/(app)/workflow/page.tsx
git commit -m "feat(workflow): make assignment rows clickable, navigate to engagement"
```

---

## Task 9: StartAuditWizard — clarify step-4 button labels

**Files:**
- Modify: `frontend/components/audit/engagements/StartAuditWizard.tsx`

Context: Step 4 has "Finish" (leaves engagement in `planned`) and "Start audit now". "Finish" sounds like the safe default but strands the engagement in planning limbo. We rename and add a clarifying hint.

- [ ] **Step 1: Rename the buttons and add hint text**

In `StartAuditWizard.tsx`, find the step-4 footer section (inside the `footer` prop of `SlideOver`):

```tsx
{step === 4 && (
  <>
    <Button variant="secondary" size="sm" onClick={finish}>
      Finish
    </Button>
    <Button size="sm" onClick={() => startNow.mutate()} isLoading={startNow.isPending}>
      Start audit now
    </Button>
  </>
)}
```

Replace with:

```tsx
{step === 4 && (
  <div className="flex flex-col items-end gap-2 w-full">
    <div className="flex gap-2">
      <Button variant="ghost" size="sm" onClick={finish}>
        Save &amp; review later
      </Button>
      <Button size="sm" onClick={() => startNow.mutate()} isLoading={startNow.isPending}>
        Start fieldwork
      </Button>
    </div>
    <p className="text-[11px] text-text-muted text-right max-w-xs">
      "Save &amp; review later" leaves the engagement in Planning status. Start fieldwork when your team is ready.
    </p>
  </div>
)}
```

- [ ] **Step 2: Verify TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/audit/engagements/StartAuditWizard.tsx
git commit -m "feat(wizard): rename step-4 buttons to 'Start fieldwork' / 'Save & review later'"
```

---

## Self-Review Checklist

- [x] **Spec §3.1 MyWorkPanel** — Task 3 implements the three-section panel with deduplication.
- [x] **Spec §3.2 StatusStepper** — Task 4 adds props + button; Task 5 lifts mutation and wires it; Task 6 removes old button from OverviewTab.
- [x] **Spec §3.3a Lineage pill** — Task 1 adds `planTitle` to backend; Task 2 adds it to frontend types; Task 7 renders it.
- [x] **Spec §3.3b Assignee callout** — Task 6 adds the callout to OverviewTab.
- [x] **Spec §3.4 Assignments row click** — Task 8.
- [x] **Spec §3.5 Wizard button labels** — Task 9.
- [x] No placeholders or TBDs.
- [x] Type names consistent across tasks: `planTitle` (Tasks 1, 2, 7), `onAdvance`/`isAdvancing`/`canAdvance` (Tasks 4, 5), `myAssignment`/`isOnlyAssigned` (Task 6).
