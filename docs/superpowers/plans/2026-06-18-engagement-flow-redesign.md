# Engagement Flow Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make an audit engagement's status a *derived reflection* of its work (auto-advancing on completed gates, with only "Start fieldwork" and "Issue report" as manual acts), rebuild the engagement workspace around "what's next for you", show the approval chain as real people, and replace the binary visibility model with three tiers plus a restricted auditee view.

**Architecture:** A cycle-free standalone reconciler (`engagement-status.reconciler.ts`, depends only on Prisma + lifecycle config) computes the highest forward stage whose gates are satisfied and advances the engagement. It is invoked directly from audit-side triggers (checklist test, report issue) and via dynamic import from the workflow approval service (working-paper / finding-closure final approval), mirroring the existing `approvalSignedDocumentService` dynamic-import pattern that avoids the audit↔workflow cycle. Visibility gains a third tier (active approvers) and a per-viewer `viewerContext`; the frontend `StatusStepper` guide is replaced by a "What's next" panel and an approval-chain component that render names.

**Tech Stack:** Node.js + Express + TypeScript (strict), Prisma (SQL Server), Zod, Next.js (App Router) + React Query + Tailwind.

## Global Constraints

- **No automated test harness exists** (Jest installed, zero tests; per `CLAUDE.md` §8 tests are *not required*). This plan therefore verifies via `npm run build` (backend `tsc`) + `cd frontend && npm run build` + concrete manual/API checks — **not** TDD. This is a deliberate deviation from the writing-plans default, justified by the user's standing instruction and the absence of a test DB.
- **Status is forward-only.** Reconciliation only ever advances a stage; it never auto-regresses.
- **Two manual acts only:** `planned → in_progress` ("Start fieldwork") and report **issuance**. Everything else auto-advances. Never auto-issue a report; never auto-start fieldwork.
- **Lifecycle gates are GBB-configurable** via `system_config.audit_lifecycle_rules` (`getAuditLifecycleRules()`); the reconciler must read them, not hardcode.
- **No role names in code/UI.** Resolve approvers to permission holders or the assigned engagement manager. No "CAE", "supervisor", or "Level 1/2" strings anywhere in the UI.
- **Conventions:** follow the `user` module layout; `buildResponse(...)` for HTTP; `AppError.xxx(...)` for errors; `auditLogService.logAsync(...)` for mutations; snake_case DB ↔ camelCase DTO; cross-module calls via injected interfaces or the established dynamic-import escape hatch for the audit↔workflow cycle.
- **Enum values:** `EngagementStatus` = `planned | in_progress | under_review | reported | closed`. `FindingStatus.Closed = 'closed'`. `WorkflowEntityType.AuditWorkingPaper = 'audit_working_paper'`, `AuditReport = 'audit_report'`, `AuditFindingClosure = 'audit_finding_closure'`.

---

## File Structure

**Backend — created**
- `src/modules/audit/engagement/service/implementation/engagement-gates.ts` — pure boolean gate predicates (`canEnterUnderReview`, `canEnterReported`, `canClose`), reading lifecycle rules + Prisma counts. Single source of truth for "are this stage's gates met".
- `src/modules/audit/engagement/service/implementation/engagement-status.reconciler.ts` — `reconcileEngagementStatus(engagementId, actorId)` + `reconcileEngagementForApprovalEntity(entityType, entityId, actorId)`. No dependency on any service (cycle-free).
- `src/modules/audit/engagement/utility/engagement-visibility.util.ts` — `resolveViewerContext(...)`, `assertCanViewInternalArtifacts(...)`, `isPureAuditee(...)`.
- `src/modules/workflow/approval/dto/response/approval-chain.response.dto.ts` — `ResolvedApprovalChainDto` + level DTO + mapper.

**Backend — modified**
- `engagement.service.ts` — three-tier `_actorScope`, active-approver detail access in `getEngagementById`, attach `viewerContext`.
- `engagement.response.dto.ts` — add optional `viewerContext` to `EngagementResponseDto`.
- `checklist.service.ts` (`updateChecklistItem`), `report.service.ts` (`issueReport`) — call reconciler after commit.
- `approval.service.ts` — post-commit reconcile trigger (dynamic import) + new `resolveChainForEntity(...)` + `_activeHoldersBrief(...)`.
- `approval.controller.ts` — `GET /workflow/approvals/chain/:entityType/:entityId`.
- `working-paper.service.ts`, `evidence.service.ts`, `checklist.service.ts`, `finding.service.ts` — enforce auditee restriction on engagement-scoped reads.
- `src/modules/background/service/implementation/scheduler.service.ts` (`registerAllJobs`) — `BG:AUDIT:RECONCILE:STATUS:HOURLY`.

**Frontend — modified/created**
- `frontend/lib/types/domain.ts` — `ViewerContext`, approval-chain types.
- `frontend/lib/api/audit.ts`, `frontend/lib/api/workflow.ts` — `viewerContext` passthrough, `getApprovalChain`.
- `frontend/components/audit/engagements/StatusStepper.tsx` — progress bar only; delegate guide to new panel.
- `frontend/components/audit/engagements/WhatsNextPanel.tsx` (create) — "what's next for you".
- `frontend/components/audit/engagements/ApprovalChain.tsx` (create) — chain with names.
- `frontend/app/(app)/audit/engagements/[id]/page.tsx` — remove advance mutation/button; gate tabs on `viewerContext`.
- `frontend/components/audit/engagements/ReportTab.tsx` — render `ApprovalChain`; keep "Issue report".

---

## Task 1: Engagement gate predicates + reconciler

**Files:**
- Create: `src/modules/audit/engagement/service/implementation/engagement-gates.ts`
- Create: `src/modules/audit/engagement/service/implementation/engagement-status.reconciler.ts`

**Interfaces:**
- Produces:
  - `canEnterUnderReview(engagementId: string): Promise<boolean>`
  - `canEnterReported(engagementId: string): Promise<boolean>`
  - `canClose(engagementId: string): Promise<boolean>`
  - `reconcileEngagementStatus(engagementId: string, actorId: string): Promise<void>`
  - `reconcileEngagementForApprovalEntity(entityType: 'audit_working_paper' | 'audit_finding_closure', entityId: string, actorId: string): Promise<void>`

- [ ] **Step 1: Create the gate predicates**

`engagement-gates.ts`:

```ts
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { FindingStatus } from '../../../domain/enum/audit.enum';
import { getAuditLifecycleRules } from '../../../utility/audit-config.utility';

/** True when an in_progress engagement satisfies every gate to enter under_review. */
export const canEnterUnderReview = async (engagementId: string): Promise<boolean> => {
  const rules = await getAuditLifecycleRules();

  if (rules.requireAllChecklistsTestedBeforeUnderReview) {
    const [total, notTested] = await prisma.$transaction([
      prisma.audit_Checklist.count({ where: { engagement_id: engagementId } }),
      prisma.audit_Checklist.count({ where: { engagement_id: engagementId, result: 'not_tested' } }),
    ]);
    if (total === 0 || notTested > 0) return false;
  }

  if (rules.requireApprovedWorkingPaperBeforeUnderReview) {
    const [totalPapers, unapproved] = await prisma.$transaction([
      prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null } }),
      prisma.audit_Working_Paper.count({ where: { engagement_id: engagementId, deleted_at: null, status: { not: 'approved' } } }),
    ]);
    if (totalPapers === 0 || unapproved > 0) return false;
  }

  return true;
};

/** True when an under_review engagement has an issued report (the deliberate human act). */
export const canEnterReported = async (engagementId: string): Promise<boolean> => {
  const rules = await getAuditLifecycleRules();
  if (!rules.requireReportIssuedBeforeReported) return true;
  const issued = await prisma.audit_Report.count({
    where: { engagement_id: engagementId, deleted_at: null, status: 'issued' },
  });
  return issued > 0;
};

/** True when a reported engagement has no findings left open/awaiting closure. */
export const canClose = async (engagementId: string): Promise<boolean> => {
  const rules = await getAuditLifecycleRules();
  if (!rules.requireClosedFindingsBeforeClose) return true;
  const open = await prisma.audit_Finding.count({
    where: { engagement_id: engagementId, deleted_at: null, status: { not: FindingStatus.Closed } },
  });
  return open === 0;
};
```

- [ ] **Step 2: Create the reconciler**

`engagement-status.reconciler.ts`:

```ts
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { logger } from '../../../../../shared/utils/logger.util';
import { auditLogService } from '../../../../logging/service/implementation/audit-log.service';
import { EngagementStatus } from '../../../domain/enum/audit.enum';
import { canClose, canEnterReported, canEnterUnderReview } from './engagement-gates';

type ApprovalEntityType = 'audit_working_paper' | 'audit_finding_closure';

/** Compute the immediate forward target if its gates are met, else null. Forward-only. */
const nextForwardStatus = async (
  status: EngagementStatus,
  engagementId: string,
): Promise<EngagementStatus | null> => {
  if (status === EngagementStatus.InProgress && (await canEnterUnderReview(engagementId))) {
    return EngagementStatus.UnderReview;
  }
  if (status === EngagementStatus.UnderReview && (await canEnterReported(engagementId))) {
    return EngagementStatus.Reported;
  }
  if (status === EngagementStatus.Reported && (await canClose(engagementId))) {
    return EngagementStatus.Closed;
  }
  return null;
};

/**
 * Advance an engagement as far forward as its gates allow. Idempotent and safe to
 * call repeatedly. Never crosses the manual planned -> in_progress transition.
 * Mirrors the side effects of EngagementService.updateStatus for the transitions
 * it performs (actual_end_date + universe.last_audited_at on close).
 */
export const reconcileEngagementStatus = async (engagementId: string, actorId: string): Promise<void> => {
  // Bounded loop: at most 3 forward hops (in_progress -> under_review -> reported -> closed).
  for (let hop = 0; hop < 3; hop += 1) {
    const engagement = await prisma.audit_Engagement.findFirst({
      where: { id: engagementId, deleted_at: null },
      select: { id: true, status: true, universe_id: true },
    });
    if (!engagement) return;

    const target = await nextForwardStatus(engagement.status as EngagementStatus, engagementId);
    if (!target) return;

    await prisma.$transaction(async (tx) => {
      await tx.audit_Engagement.update({
        where: { id: engagementId },
        data: {
          status: target,
          ...(target === EngagementStatus.Closed && { actual_end_date: new Date() }),
        },
      });
      if (target === EngagementStatus.Closed) {
        await tx.audit_Universe.update({
          where: { id: engagement.universe_id },
          data: { last_audited_at: new Date() },
        });
      }
    });

    logger.info('Audit engagement auto-advanced', { engagementId, from: engagement.status, to: target, actorId });
    auditLogService.logAsync({
      userId: actorId,
      action: 'audit.engagement.status.auto_advance',
      module: 'audit',
      entityType: 'audit_engagement',
      entityId: engagementId,
      newValues: { status: target, from: engagement.status },
    });
  }
};

/** Resolve the engagement behind a just-approved working paper / finding closure, then reconcile. */
export const reconcileEngagementForApprovalEntity = async (
  entityType: ApprovalEntityType,
  entityId: string,
  actorId: string,
): Promise<void> => {
  let engagementId: string | null = null;
  if (entityType === 'audit_working_paper') {
    const wp = await prisma.audit_Working_Paper.findUnique({ where: { id: entityId }, select: { engagement_id: true } });
    engagementId = wp?.engagement_id ?? null;
  } else {
    const finding = await prisma.audit_Finding.findUnique({ where: { id: entityId }, select: { engagement_id: true } });
    engagementId = finding?.engagement_id ?? null;
  }
  if (engagementId) await reconcileEngagementStatus(engagementId, actorId);
};
```

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS (no type errors). If `actual_end_date`/`universe_id`/`engagement_id` names differ, reconcile against `prisma/schema.prisma` `Audit_Engagement` / `Audit_Working_Paper` / `Audit_Finding` field names.

- [ ] **Step 4: Commit**

```bash
git add src/modules/audit/engagement/service/implementation/engagement-gates.ts src/modules/audit/engagement/service/implementation/engagement-status.reconciler.ts
git commit -m "feat(audit): add engagement gate predicates and status reconciler"
```

---

## Task 2: Trigger reconcile from audit-side acts (checklist test, report issue)

**Files:**
- Modify: `src/modules/audit/checklists/service/implementation/checklist.service.ts` (`updateChecklistItem`, ~line 88)
- Modify: `src/modules/audit/report/service/implementation/report.service.ts` (`issueReport`, line 182)

**Interfaces:**
- Consumes: `reconcileEngagementStatus(engagementId, actorId)` from Task 1.

- [ ] **Step 1: Import the reconciler in `checklist.service.ts`**

Add near the other imports:

```ts
import { reconcileEngagementStatus } from '../../../engagement/service/implementation/engagement-status.reconciler';
```

- [ ] **Step 2: Reconcile after a checklist result is saved**

In `updateChecklistItem`, after the item is updated and before `return`, using the updated row's engagement id (the updated checklist record exposes `engagement_id`):

```ts
// A tested control may complete the fieldwork gate — let the engagement advance itself.
await reconcileEngagementStatus(updated.engagement_id, actor.id);
```

(If the local variable holding the updated record is not named `updated`, use that variable's `.engagement_id`. If it isn't selected, add `engagement_id` to the update's `select`/`include` or fetch it once before the call.)

- [ ] **Step 3: Import the reconciler in `report.service.ts`**

```ts
import { reconcileEngagementStatus } from '../../../engagement/service/implementation/engagement-status.reconciler';
```

- [ ] **Step 4: Reconcile after the report is issued**

In `issueReport`, after the post-commit notification/PDF work is kicked off and before `return`, using the issued report's engagement id:

```ts
// Issuing the report is the human act; the engagement follows into "reported".
await reconcileEngagementStatus(report.engagement_id, actor.id);
```

(`report` here is the record loaded at the top of `issueReport` via `_getReport`; it exposes `engagement_id`. If not selected there, read it from the `issued`/`updated` row instead.)

- [ ] **Step 5: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 6: Manual verification (against the dev DB / running API)**

Start the API (`npm run dev`). For an `in_progress` engagement with one working paper already `approved`: mark its last `not_tested` checklist control to `pass` via `PATCH /api/v1/audit/checklists/:id`. Then `GET /api/v1/audit/engagements/:id` and confirm `status` is now `under_review` with **no** manual status call. For a `under_review` engagement, issue its approved report and confirm the engagement flips to `reported`.

- [ ] **Step 7: Commit**

```bash
git add src/modules/audit/checklists/service/implementation/checklist.service.ts src/modules/audit/report/service/implementation/report.service.ts
git commit -m "feat(audit): auto-advance engagement after checklist test and report issue"
```

---

## Task 3: Trigger reconcile from approval completion (working paper, finding closure)

**Files:**
- Modify: `src/modules/workflow/approval/service/implementation/approval.service.ts` (`approve`, final-approval `else` branch, ~lines 328–336)

**Interfaces:**
- Consumes: `reconcileEngagementForApprovalEntity(...)` from Task 1 (loaded by dynamic import to avoid the audit↔workflow cycle).

- [ ] **Step 1: Add the reconcile trigger after final approval commits**

In `approve()`, inside the `else` branch that runs when there is **no** `nextStep` (final-level approval), directly after the existing `void import('.../approval-signed-document.service')...` block, add:

```ts
// A final working-paper / finding-closure approval may complete an engagement
// gate — reconcile its status post-commit. Dynamic import avoids the
// audit↔workflow module cycle (same pattern as the signed-document freeze).
if (
  approval.entity_type === WorkflowEntityType.AuditWorkingPaper ||
  approval.entity_type === WorkflowEntityType.AuditFindingClosure
) {
  const reconcileEntityType = approval.entity_type === WorkflowEntityType.AuditWorkingPaper
    ? 'audit_working_paper'
    : 'audit_finding_closure';
  void import('../../../../audit/engagement/service/implementation/engagement-status.reconciler')
    .then((m) => m.reconcileEngagementForApprovalEntity(reconcileEntityType, approval.entity_id, actor.id))
    .catch((err: unknown) => logger.warn('Engagement reconcile after approval failed', { approvalId, err }));
}
```

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Manual verification**

For an `in_progress` engagement whose checklists are all tested and which has exactly one `submitted` working paper: approve that working paper through its full chain. After the final approval, `GET /api/v1/audit/engagements/:id` shows `under_review`. For a `reported` engagement with one `verified` finding: complete its finding-closure approval and confirm the engagement flips to `closed` (and `audit_universe.last_audited_at` is stamped).

- [ ] **Step 4: Commit**

```bash
git add src/modules/workflow/approval/service/implementation/approval.service.ts
git commit -m "feat(workflow): reconcile engagement status after working-paper/finding approval"
```

---

## Task 4: Hourly safety-net reconcile job

**Files:**
- Modify: `src/modules/background/service/implementation/scheduler.service.ts` (`registerAllJobs`)

**Interfaces:**
- Consumes: `reconcileEngagementStatus(...)` from Task 1.

- [ ] **Step 1: Register the job**

Inside `registerAllJobs()`, add a registration alongside the existing audit jobs (match the surrounding `schedulerService.register({...})` shape exactly — `key`, `name`, `schedule` cron, `handler`):

```ts
schedulerService.register({
  key: 'BG:AUDIT:RECONCILE:STATUS:HOURLY',
  name: 'Reconcile engagement statuses',
  schedule: '0 * * * *',
  handler: async () => {
    const { reconcileEngagementStatus } = await import(
      '../../../audit/engagement/service/implementation/engagement-status.reconciler'
    );
    const engagements = await prisma.audit_Engagement.findMany({
      where: { deleted_at: null, status: { in: ['in_progress', 'under_review', 'reported'] } },
      select: { id: true },
    });
    for (const e of engagements) {
      await reconcileEngagementStatus(e.id, 'system');
    }
  },
});
```

Ensure `prisma` is imported in this file (it almost certainly is; if not, add `import { prisma } from '../../../../shared/prisma/prisma.client';`). Confirm the `register({...})` field names against an existing call in the same function — if the property is `cron` rather than `schedule`, match the existing one.

- [ ] **Step 2: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/modules/background/service/implementation/scheduler.service.ts
git commit -m "feat(background): hourly engagement status reconcile safety-net job"
```

---

## Task 5: Three-tier visibility + active-approver detail access

**Files:**
- Modify: `src/modules/audit/engagement/service/implementation/engagement.service.ts` (`_actorScope`, `getEngagementById`)

**Interfaces:**
- Produces: `getEngagementById` now also resolves for active approvers; `_actorScope` unchanged in shape (`Prisma.Audit_EngagementWhereInput | undefined`).

- [ ] **Step 1: Add an active-approver detail check**

Add a private helper to `EngagementService`:

```ts
/**
 * Active-approver access: a user with a pending approval step they may act on,
 * against one of this engagement's reports / working papers / findings, can open
 * the engagement while that step is open — you can't approve what you can't read.
 */
private async _hasActiveApprovalAccess(engagementId: string, actor: ActorContext): Promise<boolean> {
  const [reports, papers, findings] = await prisma.$transaction([
    prisma.audit_Report.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
    prisma.audit_Working_Paper.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
    prisma.audit_Finding.findMany({ where: { engagement_id: engagementId, deleted_at: null }, select: { id: true } }),
  ]);
  const entityIds = [...reports, ...papers, ...findings].map((r) => r.id);
  if (entityIds.length === 0) return false;

  const orConditions: Prisma.Workflow_Approval_StepWhereInput[] = [{ approver_id: actor.id }];
  if (actor.permissions.length > 0) {
    orConditions.push({ approver_id: null, required_permission: { in: actor.permissions } });
  }

  const step = await prisma.workflow_Approval_Step.findFirst({
    where: {
      status: 'pending',
      approval: { status: 'pending', entity_id: { in: entityIds } },
      OR: orConditions,
    },
    select: { id: true, level: true, approval: { select: { current_level: true } } },
  });
  return step !== null && step.level === step.approval.current_level;
}
```

- [ ] **Step 2: Use it in `getEngagementById`**

Replace the body of `getEngagementById` so that, when the scoped lookup misses, it falls back to active-approver access before 404-ing:

```ts
async getEngagementById(id: string, actor: ActorContext): Promise<EngagementResponseDto> {
  const scope = this._actorScope(actor);
  let engagement = await prisma.audit_Engagement.findFirst({
    where: { id, deleted_at: null, ...(scope ?? {}) },
    include: engagementInclude,
  });

  // Not an involved party / oversight — allow if they hold a live approval step on it.
  if (!engagement && scope && (await this._hasActiveApprovalAccess(id, actor))) {
    engagement = await prisma.audit_Engagement.findFirst({
      where: { id, deleted_at: null },
      include: engagementInclude,
    });
  }

  if (!engagement) throw AppError.notFound('Audit engagement');
  return this._withMetrics(engagement, actor);
}
```

(Note `_withMetrics` gains an `actor` parameter in Task 6. If implementing Task 5 first, temporarily call `this._withMetrics(engagement)` and add the arg in Task 6.)

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual verification**

As a user who is **not** lead/manager/auditee/assignee and lacks `engagement:read_all`, `GET /api/v1/audit/engagements/:id` returns 404. Submit a report on that engagement for approval such that this user is a pool approver at the current level; repeat the GET and confirm it now returns 200. Approve/route past their level; confirm it 404s again.

- [ ] **Step 5: Commit**

```bash
git add src/modules/audit/engagement/service/implementation/engagement.service.ts
git commit -m "feat(audit): active-approver access to engagement detail"
```

---

## Task 6: `viewerContext` on engagement detail

**Files:**
- Modify: `src/modules/audit/engagement/dto/response/engagement.response.dto.ts`
- Modify: `src/modules/audit/engagement/service/implementation/engagement.service.ts` (`_withMetrics`, `getEngagementById`)

**Interfaces:**
- Produces: `EngagementResponseDto.viewerContext?: ViewerContext` where
  `ViewerContext = { role: 'oversight' | 'team' | 'auditee'; canViewWorkingPapers: boolean; canViewInternalEvidence: boolean; canViewChecklists: boolean; canViewDraftFindings: boolean }`.

- [ ] **Step 1: Add the type + field to the response DTO**

In `engagement.response.dto.ts`, add and export:

```ts
export interface ViewerContext {
  role: 'oversight' | 'team' | 'auditee';
  canViewWorkingPapers: boolean;
  canViewInternalEvidence: boolean;
  canViewChecklists: boolean;
  canViewDraftFindings: boolean;
}
```

Add `viewerContext?: ViewerContext;` to `EngagementResponseDto`. Do **not** set it inside `mapEngagementToResponse` (it is per-viewer); the service attaches it.

- [ ] **Step 2: Create the visibility utility**

Create `src/modules/audit/engagement/utility/engagement-visibility.util.ts`:

```ts
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { ActorContext } from '../../../domain/entity/audit.entity';
import { ViewerContext } from '../dto/response/engagement.response.dto';

interface EngagementParties {
  lead_auditor_id: string | null;
  audit_manager_id: string | null;
  auditee_id: string | null;
}

const isAssignee = async (engagementId: string, userId: string): Promise<boolean> => {
  const a = await prisma.workflow_Assignment.findFirst({
    where: { engagement_id: engagementId, user_id: userId },
    select: { id: true },
  });
  return a !== null;
};

/** A "pure auditee" is the auditee and nothing else — not team, not oversight. */
export const resolveViewerContext = async (
  engagementId: string,
  parties: EngagementParties,
  actor: ActorContext,
): Promise<ViewerContext> => {
  const isOversight = actor.permissions.includes('engagement:read_all');
  const isTeam =
    actor.id === parties.lead_auditor_id ||
    actor.id === parties.audit_manager_id ||
    (await isAssignee(engagementId, actor.id));
  const isAuditee = actor.id === parties.auditee_id;
  const pureAuditee = isAuditee && !isOversight && !isTeam;

  const role: ViewerContext['role'] = isOversight ? 'oversight' : pureAuditee ? 'auditee' : 'team';
  const full = !pureAuditee;
  return {
    role,
    canViewWorkingPapers: full,
    canViewInternalEvidence: full,
    canViewChecklists: full,
    canViewDraftFindings: full,
  };
};

/** Throws 403 for a pure auditee trying to read internal engagement artifacts. */
export const assertCanViewInternalArtifacts = async (engagementId: string, actor: ActorContext): Promise<void> => {
  const eng = await prisma.audit_Engagement.findFirst({
    where: { id: engagementId, deleted_at: null },
    select: { lead_auditor_id: true, audit_manager_id: true, auditee_id: true },
  });
  if (!eng) return; // existence handled by the caller's own lookup
  const ctx = await resolveViewerContext(engagementId, eng, actor);
  if (ctx.role === 'auditee') {
    const { AppError } = await import('../../../../../shared/errors/app.error');
    throw AppError.forbidden('Auditees cannot view internal audit working papers, checklists, or draft evidence');
  }
};
```

- [ ] **Step 3: Attach `viewerContext` in the service**

In `engagement.service.ts`, change `_withMetrics` to accept the actor and attach the context. Update its signature and the final `return`:

```ts
private async _withMetrics(
  engagement: Parameters<typeof mapEngagementToResponse>[0],
  actor: ActorContext,
): Promise<EngagementResponseDto> {
  // ... existing aggregate queries unchanged ...

  const viewerContext = await resolveViewerContext(
    engagement.id,
    {
      lead_auditor_id: engagement.lead_auditor_id,
      audit_manager_id: engagement.audit_manager_id,
      auditee_id: engagement.auditee_id,
    },
    actor,
  );

  const dto = mapEngagementToResponse(engagement, {
    findingCounts,
    workingPaperCount,
    checklistProgress: progress,
    workingPaperStats,
    findingStats,
    reportStatus: report?.status ?? null,
    evidenceCount,
    assetCount,
  });
  dto.viewerContext = viewerContext;
  return dto;
}
```

Add the import: `import { resolveViewerContext } from '../../utility/engagement-visibility.util';`. Confirm `engagementInclude` selects `lead_auditor_id`/`audit_manager_id`/`auditee_id` (they are scalar columns on `audit_Engagement`, so present on the row even though the include adds the relation objects). Update the two `_withMetrics(...)` call sites (`getEngagementById`, `updateStatus`) to pass `actor`.

- [ ] **Step 4: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 5: Manual verification**

`GET /api/v1/audit/engagements/:id` as the assigned auditee returns `viewerContext.role === 'auditee'` and all `canView*` false; as the lead auditor returns `role === 'team'` with all true; as a `read_all` holder returns `role === 'oversight'`.

- [ ] **Step 6: Commit**

```bash
git add src/modules/audit/engagement/dto/response/engagement.response.dto.ts src/modules/audit/engagement/service/implementation/engagement.service.ts src/modules/audit/engagement/utility/engagement-visibility.util.ts
git commit -m "feat(audit): per-viewer viewerContext on engagement detail"
```

---

## Task 7: Enforce auditee restriction on engagement-scoped reads

**Files:**
- Modify: `src/modules/audit/working-papers/service/implementation/working-paper.service.ts`
- Modify: `src/modules/audit/evidence/service/implementation/evidence.service.ts`
- Modify: `src/modules/audit/checklists/service/implementation/checklist.service.ts`
- Modify: `src/modules/audit/findings/service/implementation/finding.service.ts`
- (and their controllers, to pass `req.user` as actor if not already passed)

**Interfaces:**
- Consumes: `assertCanViewInternalArtifacts(engagementId, actor)` from Task 6.

- [ ] **Step 1: Guard working-paper and checklist and evidence engagement reads**

For each "list/get by engagement" read method in `working-paper.service.ts`, `evidence.service.ts`, and `checklist.service.ts` (`getChecklists`, `getChecklistProgress`), accept the `actor: ActorContext` (thread it from the controller via `req.user`) and call, before querying:

```ts
await assertCanViewInternalArtifacts(engagementId, actor);
```

Add `import { assertCanViewInternalArtifacts } from '../../../engagement/utility/engagement-visibility.util';` to each (adjust the relative depth per file). Update the matching controller handlers to pass `req.user` into these methods. Where a service method currently has no `actor` parameter, add it as the last parameter and update its interface in `service/interface/*.ts`.

- [ ] **Step 2: Restrict findings for a pure auditee to issued findings only**

In `finding.service.ts`, in the engagement-scoped list method, thread `actor` and apply:

```ts
import { resolveViewerContext } from '../../../engagement/utility/engagement-visibility.util';

// ...
const eng = await prisma.audit_Engagement.findFirst({
  where: { id: engagementId, deleted_at: null },
  select: { status: true, lead_auditor_id: true, audit_manager_id: true, auditee_id: true },
});
if (!eng) throw AppError.notFound('Audit engagement');
const viewer = await resolveViewerContext(engagementId, eng, actor);

// A pure auditee only sees findings once the report has been issued
// (engagement is reported/closed); before that, findings are still draft/internal.
const reportIssued = eng.status === 'reported' || eng.status === 'closed';
if (viewer.role === 'auditee' && !reportIssued) {
  return []; // or the paginated empty shape this method returns
}
```

Keep the existing query otherwise (a post-issue auditee sees their findings to remediate).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 4: Manual verification**

As the assigned auditee, before the report is issued: `GET /api/v1/audit/engagements/:id/working-papers` (and the checklists/evidence endpoints) returns 403; the findings endpoint returns an empty list. After issuing the report: the findings endpoint returns the engagement's findings; working papers/checklists/evidence still 403. As the lead auditor, all return data normally.

- [ ] **Step 5: Commit**

```bash
git add src/modules/audit/working-papers src/modules/audit/evidence src/modules/audit/checklists src/modules/audit/findings
git commit -m "feat(audit): enforce restricted auditee view on engagement artifacts"
```

---

## Task 8: Approval-chain resolver (names) + route + client

**Files:**
- Create: `src/modules/workflow/approval/dto/response/approval-chain.response.dto.ts`
- Modify: `src/modules/workflow/approval/service/implementation/approval.service.ts`
- Modify: `src/modules/workflow/approval/service/interface/approval.service.interface.ts`
- Modify: `src/modules/workflow/approval/controller/approval.controller.ts`

**Interfaces:**
- Produces:
  - `ApprovalService.resolveChainForEntity(entityType: WorkflowEntityType, entityId: string): Promise<ResolvedApprovalChainDto>`
  - Route `GET /workflow/approvals/chain/:entityType/:entityId` (`audit:read`).
  - `ResolvedApprovalChainDto = { entityType: string; entityId: string; exists: boolean; status: string | null; currentLevel: number | null; levels: ResolvedApprovalLevelDto[] }`
  - `ResolvedApprovalLevelDto = { level: number; kind: 'person' | 'permission'; status: 'pending' | 'approved' | 'rejected' | 'upcoming'; requiredPermission: string | null; resolvedApprover: WorkflowUserBrief | null; candidates: WorkflowUserBrief[] }`

- [ ] **Step 1: Create the chain DTO**

`approval-chain.response.dto.ts`:

```ts
import { WorkflowUserBrief } from '../../../domain/entity/workflow.entity';

export interface ResolvedApprovalLevelDto {
  level: number;
  kind: 'person' | 'permission';
  status: 'pending' | 'approved' | 'rejected' | 'upcoming';
  requiredPermission: string | null;
  resolvedApprover: WorkflowUserBrief | null;
  candidates: WorkflowUserBrief[];
}

export interface ResolvedApprovalChainDto {
  entityType: string;
  entityId: string;
  exists: boolean;
  status: string | null;
  currentLevel: number | null;
  levels: ResolvedApprovalLevelDto[];
}
```

- [ ] **Step 2: Add `_activeHoldersBrief` to `ApprovalService`**

```ts
private async _activeHoldersBrief(permissionSlug: string): Promise<WorkflowUserBrief[]> {
  const users = await prisma.user.findMany({
    where: this._activeHolderWhere(permissionSlug),
    select: workflowUserSelect,
    orderBy: { display_name: 'asc' },
  });
  return users.map(mapWorkflowUserBrief);
}
```

(Import `mapWorkflowUserBrief` from the approval response DTO — it already exists there.)

- [ ] **Step 3: Implement `resolveChainForEntity`**

```ts
async resolveChainForEntity(
  entityType: WorkflowEntityType,
  entityId: string,
): Promise<ResolvedApprovalChainDto> {
  const approval = await prisma.workflow_Approval.findFirst({
    where: { entity_type: entityType, entity_id: entityId },
    include: approvalInclude,
    orderBy: { created_at: 'desc' },
  });

  // Case A: an approval exists — render its actual steps as people.
  if (approval) {
    const levels: ResolvedApprovalLevelDto[] = [];
    for (const step of approval.steps) {
      const acted = step.status === 'approved' || step.status === 'rejected';
      const status: ResolvedApprovalLevelDto['status'] = acted
        ? (step.status as 'approved' | 'rejected')
        : approval.status === 'pending' && step.level === approval.current_level
          ? 'pending'
          : 'upcoming';

      if (step.approver) {
        // Pinned, or already acted by a specific person.
        levels.push({
          level: step.level, kind: 'person', status,
          requiredPermission: step.required_permission,
          resolvedApprover: mapWorkflowUserBrief(step.approver), candidates: [],
        });
      } else {
        // Open permission pool, not yet acted — show candidate holders.
        const candidates = step.required_permission ? await this._activeHoldersBrief(step.required_permission) : [];
        levels.push({
          level: step.level, kind: 'permission', status,
          requiredPermission: step.required_permission, resolvedApprover: null, candidates,
        });
      }
    }
    return {
      entityType, entityId, exists: true,
      status: approval.status, currentLevel: approval.current_level, levels,
    };
  }

  // Case B: no approval yet — render the prospective chain from the matrix.
  const matrix = await getApprovalMatrix();
  const chain = this._chainForEntity(matrix, entityType);
  const managerId = await this._resolveEngagementManager(prisma, entityType, entityId).catch(() => null);
  const levels: ResolvedApprovalLevelDto[] = [];
  let level = 1;
  for (const entry of chain) {
    if (entry === ENGAGEMENT_MANAGER_APPROVER) {
      const manager = managerId
        ? await prisma.user.findUnique({ where: { id: managerId }, select: workflowUserSelect })
        : null;
      levels.push({
        level, kind: 'person', status: 'upcoming',
        requiredPermission: ENGAGEMENT_MANAGER_PERMISSION[entityType] ?? null,
        resolvedApprover: manager ? mapWorkflowUserBrief(manager) : null, candidates: [],
      });
    } else {
      levels.push({
        level, kind: 'permission', status: 'upcoming',
        requiredPermission: entry, resolvedApprover: null,
        candidates: await this._activeHoldersBrief(entry),
      });
    }
    level += 1;
  }
  return { entityType, entityId, exists: false, status: null, currentLevel: null, levels };
}
```

Add imports at top of the file: `import { ResolvedApprovalChainDto, ResolvedApprovalLevelDto } from '../../dto/response/approval-chain.response.dto';` and ensure `mapWorkflowUserBrief` is imported from `'../../dto/response/approval.response.dto'`.

- [ ] **Step 4: Declare it on the interface**

In `approval.service.interface.ts`, add to `IApprovalService`:

```ts
resolveChainForEntity(entityType: WorkflowEntityType, entityId: string): Promise<ResolvedApprovalChainDto>;
```

(Import the DTO type there too.)

- [ ] **Step 5: Add the route**

In `approval.controller.ts`, register inside `_registerRoutes` (follow the existing `entity/:type/:id` route's permission + binding style):

```ts
this.router.get(
  '/chain/:entityType/:entityId',
  authenticate,
  requirePermission('audit:read'),
  this._getChain.bind(this),
);
```

And the handler:

```ts
private async _getChain(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { entityType, entityId } = req.params;
    const chain = await this.approvalService.resolveChainForEntity(entityType as WorkflowEntityType, entityId);
    res.status(200).json(buildResponse(chain, 'Approval chain resolved'));
  } catch (err) {
    next(err);
  }
}
```

Match the controller's existing import set (`WorkflowEntityType`, `buildResponse`, `authenticate`, `requirePermission`). Ensure `/chain/...` is registered before any `'/:id'`-style catch-all on the same router so it isn't shadowed.

- [ ] **Step 6: Build**

Run: `npm run build`
Expected: PASS.

- [ ] **Step 7: Manual verification**

`GET /api/v1/workflow/approvals/chain/audit_report/:reportId` for a report mid-approval returns `exists:true`, a `levels` array where the manager level is `kind:"person"` with a `resolvedApprover` name and the oversight/final levels are `kind:"permission"` with `candidates` names; the current level shows `status:"pending"`. For a report with no approval yet, returns `exists:false` with the prospective chain.

- [ ] **Step 8: Commit**

```bash
git add src/modules/workflow/approval
git commit -m "feat(workflow): resolve approval chain to named people for display"
```

---

## Task 9: Frontend types + API clients

**Files:**
- Modify: `frontend/lib/types/domain.ts`
- Modify: `frontend/lib/api/audit.ts`
- Modify: `frontend/lib/api/workflow.ts`

**Interfaces:**
- Produces: `ViewerContext`, `ResolvedApprovalChain`, `ResolvedApprovalLevel` types; `AuditEngagementDetail.viewerContext?`; `workflowApi.getApprovalChain(entityType, entityId)`.

- [ ] **Step 1: Add types**

In `frontend/lib/types/domain.ts`:

```ts
export interface ViewerContext {
  role: 'oversight' | 'team' | 'auditee';
  canViewWorkingPapers: boolean;
  canViewInternalEvidence: boolean;
  canViewChecklists: boolean;
  canViewDraftFindings: boolean;
}

export interface ApprovalUserBrief {
  id: string;
  displayName: string;
  jobTitle: string | null;
}

export interface ResolvedApprovalLevel {
  level: number;
  kind: 'person' | 'permission';
  status: 'pending' | 'approved' | 'rejected' | 'upcoming';
  requiredPermission: string | null;
  resolvedApprover: ApprovalUserBrief | null;
  candidates: ApprovalUserBrief[];
}

export interface ResolvedApprovalChain {
  entityType: string;
  entityId: string;
  exists: boolean;
  status: string | null;
  currentLevel: number | null;
  levels: ResolvedApprovalLevel[];
}
```

Add `viewerContext?: ViewerContext;` to the `AuditEngagementDetail` interface (the type returned by `engagementsApi.get`). The backend `WorkflowUserBrief` includes more fields than `ApprovalUserBrief`; only `id`/`displayName`/`jobTitle` are consumed here, so the narrower shape is intentional and compatible.

- [ ] **Step 2: Add the workflow client method**

In `frontend/lib/api/workflow.ts`, alongside the other `workflowApi` methods:

```ts
getApprovalChain: (entityType: string, entityId: string): Promise<ResolvedApprovalChain> =>
  apiGet<ResolvedApprovalChain>(`/workflow/approvals/chain/${entityType}/${entityId}`),
```

Match the file's existing fetch helper name (`apiGet` or equivalent) and import `ResolvedApprovalChain` from `@/lib/types/domain`.

- [ ] **Step 3: Confirm `engagementsApi.get` carries `viewerContext` through**

`engagementsApi.get` returns the raw detail payload; since `viewerContext` is now part of `AuditEngagementDetail`, no client change is needed beyond the type. Verify the response mapper (if any) in `audit.ts` does not strip unknown fields; if it explicitly maps fields, add `viewerContext: raw.viewerContext`.

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/types/domain.ts frontend/lib/api/audit.ts frontend/lib/api/workflow.ts
git commit -m "feat(frontend): viewerContext + approval-chain types and client"
```

---

## Task 10: Rebuild StatusStepper — progress bar + What's-next panel; remove advance button; strip role language

**Files:**
- Modify: `frontend/components/audit/engagements/StatusStepper.tsx`
- Create: `frontend/components/audit/engagements/WhatsNextPanel.tsx`
- Modify: `frontend/app/(app)/audit/engagements/[id]/page.tsx`

**Interfaces:**
- Consumes: `AuditEngagementDetail` (aggregates already present: `checklistProgress`, `workingPaperStats`, `reportStatus`, `findingStats`, names), `usePermissions`.
- Produces: `WhatsNextPanel` component; `StatusStepper` no longer renders the task list / rules banner / advance button.

- [ ] **Step 1: Reduce `StatusStepper` to the progress bar + the panel**

Replace `StatusStepper.tsx` so it keeps the 5-node graphic (the existing `STAGES`, nodes, connection bar markup) and the collapse toggle, but **deletes**: `getActiveTasks`, the task `<ul>`, the amber "Status Transition Rules" banner, the "Move to {next}" button, and all imports tied to them (`nextEngagementStatus`, the advance props). Its props become:

```ts
interface StatusStepperProps {
  engagement: AuditEngagementDetail;
}
```

Below the progress graphic, render the new panel:

```tsx
<WhatsNextPanel engagement={engagement} />
```

Remove `onAdvance`, `isAdvancing`, `canAdvance` from the component and its usage.

- [ ] **Step 2: Create `WhatsNextPanel.tsx`**

```tsx
'use client';

import Link from 'next/link';
import { Check, ArrowRight, Info } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { engagementsApi } from '@/lib/api/audit';
import { usePermissions } from '@/lib/hooks/usePermissions';
import type { AuditEngagementDetail } from '@/lib/types/domain';

interface Blocker {
  text: string;
  /** When true, this row is the current viewer's own action. */
  mine?: boolean;
  action?: React.ReactNode;
}

export const WhatsNextPanel = ({ engagement }: { engagement: AuditEngagementDetail }): JSX.Element => {
  const qc = useQueryClient();
  const { hasPermission } = usePermissions();
  const canManage = hasPermission('engagement:update');

  const startFieldwork = useMutation({
    mutationFn: () => engagementsApi.updateStatus(engagement.id, 'in_progress'),
    onSuccess: () => {
      toast.success('Fieldwork started');
      qc.invalidateQueries({ queryKey: ['engagements', engagement.id] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to start fieldwork'),
  });

  const blockers = buildBlockers(engagement, { canManage, startFieldwork });

  return (
    <Card className="mb-6 p-4 border border-border">
      <h4 className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-text-primary">
        <Info className="h-3.5 w-3.5 text-primary" /> What&apos;s next
      </h4>
      {blockers.length === 0 ? (
        <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-400">
          <Check className="h-4 w-4" /> Nothing is blocking this engagement — it advances automatically as work completes.
        </p>
      ) : (
        <ul className="space-y-2.5">
          {blockers.map((b, i) => (
            <li
              key={i}
              className={`flex items-center justify-between gap-3 rounded-lg border p-2.5 text-sm ${
                b.mine ? 'border-primary/40 bg-primary/5' : 'border-border bg-surface'
              }`}
            >
              <span className="flex items-center gap-2 text-text-primary">
                <ArrowRight className="h-3.5 w-3.5 text-text-muted" /> {b.text}
              </span>
              {b.action}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
};

function buildBlockers(
  e: AuditEngagementDetail,
  ctx: { canManage: boolean; startFieldwork: { mutate: () => void; isPending: boolean } },
): Blocker[] {
  const lead = e.leadAuditorName ?? 'the lead auditor';
  const manager = e.auditManagerName ?? 'the audit manager';

  switch (e.status) {
    case 'planned':
      return [
        {
          text: `Fieldwork hasn't started yet — ${lead} starts it when the team is ready.`,
          mine: ctx.canManage,
          action: ctx.canManage ? (
            <Button size="sm" onClick={() => ctx.startFieldwork.mutate()} isLoading={ctx.startFieldwork.isPending}>
              Start fieldwork
            </Button>
          ) : undefined,
        },
      ];
    case 'in_progress': {
      const cp = e.checklistProgress;
      const tested = (cp?.total ?? 0) - (cp?.notTested ?? 0);
      const wp = e.workingPaperStats;
      const out: Blocker[] = [];
      if ((cp?.total ?? 0) === 0 || (cp?.notTested ?? 0) > 0) {
        out.push({ text: `${lead} to finish testing controls (${tested}/${cp?.total ?? 0} done).` });
      }
      if ((wp?.total ?? 0) === 0) {
        out.push({ text: `${lead} to create at least one working paper.` });
      } else if ((wp?.approved ?? 0) < (wp?.total ?? 0)) {
        out.push({ text: `${manager} to approve working papers (${wp?.approved ?? 0}/${wp?.total ?? 0} approved).` });
      }
      if (out.length === 0) out.push({ text: 'Fieldwork complete — moving to Quality Review.' });
      return out;
    }
    case 'under_review': {
      const rs = e.reportStatus ?? null;
      if (!rs) return [{ text: `${lead} to draft the audit report.` }];
      if (rs === 'draft' || rs === 'rejected') return [{ text: `${lead} to submit the report for sign-off.` }];
      if (rs === 'submitted') return [{ text: `Report awaiting sign-off — see the approval chain on the Report tab.` }];
      if (rs === 'approved') {
        return [
          {
            text: 'Report approved and ready to issue to the auditee.',
            action: (
              <Link href={`/audit/engagements/${e.id}?tab=report`}>
                <Button size="sm" variant="secondary">Go to report</Button>
              </Link>
            ),
          },
        ];
      }
      return [{ text: 'Report issued — moving to Reporting.' }];
    }
    case 'reported': {
      const fs = e.findingStats;
      const unresolved = fs?.unresolved ?? 0;
      if ((fs?.total ?? 0) === 0) return [{ text: 'No findings to remediate.' }];
      if (unresolved > 0) {
        return [{ text: `${unresolved} of ${fs?.total} findings still need remediation and closure sign-off.` }];
      }
      return [{ text: 'All findings closed — engagement is closing.' }];
    }
    case 'closed':
    default:
      return [];
  }
}
```

(Confirm `AuditEngagementDetail` field names: `leadAuditorName`, `auditManagerName`, `checklistProgress.{total,notTested}`, `workingPaperStats.{total,approved}`, `reportStatus`, `findingStats.{total,unresolved}` — these match the page's existing usage in `StatusStepper`. If `usePermissions` does not expose `hasPermission`, use the same accessor the detail page uses.)

- [ ] **Step 3: Update the engagement detail page**

In `frontend/app/(app)/audit/engagements/[id]/page.tsx`: delete the `advanceMutation`, the `nextStatus`/`nextEngagementStatus` import and usage, and the `canAdvanceEngagement` wiring. Render the stepper simply:

```tsx
<StatusStepper engagement={data} />
```

- [ ] **Step 4: Build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 5: Grep for residual role language**

Run: `grep -rniE "cae|supervisor|level 1|level 2" frontend/components/audit frontend/app/\(app\)/audit`
Expected: no matches in engagement UI copy (matches only in unrelated code, if any). Fix any engagement-flow strings that remain by replacing with the assigned person's name/function.

- [ ] **Step 6: Commit**

```bash
git add frontend/components/audit/engagements/StatusStepper.tsx frontend/components/audit/engagements/WhatsNextPanel.tsx "frontend/app/(app)/audit/engagements/[id]/page.tsx"
git commit -m "feat(frontend): replace engagement guide with What's-next panel; remove manual advance"
```

---

## Task 11: Approval-chain component + Report tab integration

**Files:**
- Create: `frontend/components/audit/engagements/ApprovalChain.tsx`
- Modify: `frontend/components/audit/engagements/ReportTab.tsx`

**Interfaces:**
- Consumes: `workflowApi.getApprovalChain`, `ResolvedApprovalChain`.

- [ ] **Step 1: Create `ApprovalChain.tsx`**

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { Check, X, Clock } from 'lucide-react';
import { workflowApi } from '@/lib/api/workflow';
import type { ResolvedApprovalLevel } from '@/lib/types/domain';

const peopleLabel = (lvl: ResolvedApprovalLevel): string => {
  if (lvl.resolvedApprover) return lvl.resolvedApprover.displayName;
  if (lvl.candidates.length === 0) return 'No eligible approver configured';
  if (lvl.candidates.length === 1) return lvl.candidates[0].displayName;
  return `any of ${lvl.candidates.map((c) => c.displayName).join(', ')}`;
};

const statusIcon = (s: ResolvedApprovalLevel['status']): JSX.Element => {
  if (s === 'approved') return <Check className="h-3.5 w-3.5 text-emerald-600" />;
  if (s === 'rejected') return <X className="h-3.5 w-3.5 text-danger" />;
  if (s === 'pending') return <Clock className="h-3.5 w-3.5 text-primary" />;
  return <Clock className="h-3.5 w-3.5 text-text-muted" />;
};

export const ApprovalChain = ({ entityType, entityId }: { entityType: string; entityId: string }): JSX.Element => {
  const { data, isLoading } = useQuery({
    queryKey: ['approval-chain', entityType, entityId],
    queryFn: () => workflowApi.getApprovalChain(entityType, entityId),
    enabled: Boolean(entityId),
  });

  if (isLoading || !data) return <p className="text-xs text-text-muted">Loading approval chain…</p>;
  if (data.levels.length === 0) return <p className="text-xs text-text-muted">No approval chain configured.</p>;

  return (
    <ol className="space-y-1.5">
      {data.levels.map((lvl) => (
        <li key={lvl.level} className="flex items-center gap-2 text-sm">
          {statusIcon(lvl.status)}
          <span className="font-medium text-text-primary">{peopleLabel(lvl)}</span>
          {lvl.status === 'pending' && <span className="text-[11px] text-primary">· awaiting</span>}
          {lvl.status === 'approved' && <span className="text-[11px] text-emerald-600">· signed</span>}
          {lvl.status === 'rejected' && <span className="text-[11px] text-danger">· rejected</span>}
        </li>
      ))}
    </ol>
  );
};
```

- [ ] **Step 2: Render it in `ReportTab.tsx`**

Import `ApprovalChain` and render it where the report's approval status is shown (replacing any "Level N" / role text). For the report entity:

```tsx
<ApprovalChain entityType="audit_report" entityId={report.id} />
```

Keep the existing "Issue report" action (the manual act) intact. Remove any hardcoded "CAE"/"Level" copy in this tab.

- [ ] **Step 3: Build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 4: Manual verification**

Open an engagement with a report mid-approval → Report tab shows the chain as names (manager name, "any of …" for pools), with the current level marked "awaiting" and signed levels showing "signed".

- [ ] **Step 5: Commit**

```bash
git add frontend/components/audit/engagements/ApprovalChain.tsx frontend/components/audit/engagements/ReportTab.tsx
git commit -m "feat(frontend): show approval chain as named people on the report tab"
```

---

## Task 12: Gate engagement tabs on `viewerContext`

**Files:**
- Modify: `frontend/app/(app)/audit/engagements/[id]/page.tsx`

**Interfaces:**
- Consumes: `data.viewerContext`.

- [ ] **Step 1: Filter the tab list by viewerContext**

In the engagement detail page, where `tabs` is built from `TAB_DEFS`, extend the filter so a restricted auditee does not see internal tabs:

```tsx
const vc = data.viewerContext;
const tabs: TabItem[] = TAB_DEFS
  .filter((t) => t.key !== 'assets' || canReadAssets)
  .filter((t) => {
    if (!vc) return true;
    if (t.key === 'working-papers') return vc.canViewWorkingPapers;
    if (t.key === 'evidence') return vc.canViewInternalEvidence;
    if (t.key === 'checklists') return vc.canViewChecklists;
    return true;
  })
  .map((t) => ({ /* ...existing count mapping unchanged... */ }));
```

Also guard the active-tab render blocks so a deep-linked hidden tab falls back to overview:

```tsx
{tab === 'working-papers' && vc?.canViewWorkingPapers !== false && <WorkingPapersTab engagement={data} />}
{tab === 'evidence' && vc?.canViewInternalEvidence !== false && <EvidenceTab engagement={data} />}
{tab === 'checklists' && vc?.canViewChecklists !== false && <ChecklistsTab engagement={data} />}
```

(Findings tab stays visible; the backend already restricts a pre-issue auditee to an empty list per Task 7.)

- [ ] **Step 2: Build**

Run: `cd frontend && npm run build`
Expected: PASS.

- [ ] **Step 3: Manual verification**

Log in as the assigned auditee → the engagement shows Overview, Findings, Report, Follow-up, Assets (if permitted) but **not** Working Papers, Evidence, or Checklists. Log in as the lead auditor → all tabs present.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/(app)/audit/engagements/[id]/page.tsx"
git commit -m "feat(frontend): hide internal tabs from restricted auditee view"
```

---

## Final verification

- [ ] `npm run build` (backend) passes.
- [ ] `cd frontend && npm run build` passes.
- [ ] End-to-end manual pass: create/seed an engagement, start fieldwork (manual), test all controls + approve the working paper → auto-advances to under_review; generate/submit/approve/issue report → auto-advances to reported; close all findings → auto-advances to closed. No "Move to next stage" button anywhere.
- [ ] Update `docs/PROJECT_STATE.md` with a new rev changelog describing: status auto-advance via reconciler, three-tier visibility + restricted auditee view, and the approval-chain-by-name display.

---

## Self-Review

**Spec coverage:**
- §3 stage flow + `reconcileStatus` → Tasks 1–4. Two manual acts preserved (Start fieldwork = Task 10 panel + existing `updateStatus`; Issue report = unchanged + Task 2 trigger). ✅
- §4.1 What's-next panel / §4.2 language fix → Tasks 10, 11 (+ grep gate in Task 10 Step 5). ✅
- §5 approval chain with names → Tasks 8, 11. ✅
- §6.1 three tiers (oversight/involved/active approver) → Task 5. ✅
- §6.2 restricted auditee view (`viewerContext` + API enforcement + tab hiding) → Tasks 6, 7, 12. ✅
- §7 files map → reflected across tasks. §8 non-goals respected (no stage-set change, no matrix change, no auto-issue, no auto-regress, no new roles). §9 success criteria → covered by per-task + final verification. ✅

**Placeholder scan:** No "TBD/TODO/handle edge cases" left; each code step carries real code. Verification uses concrete commands + API checks (no test harness per Global Constraints). ✅

**Type consistency:** `ViewerContext` identical in backend DTO (Task 6) and frontend (Task 9). `ResolvedApprovalChainDto`/`ResolvedApprovalLevelDto` (Task 8) mirror frontend `ResolvedApprovalChain`/`ResolvedApprovalLevel` (Task 9), with the deliberate `WorkflowUserBrief` → narrower `ApprovalUserBrief` projection noted. `reconcileEngagementStatus(engagementId, actorId)` and `reconcileEngagementForApprovalEntity(entityType, entityId, actorId)` used consistently in Tasks 1–4. Gate names `canEnterUnderReview`/`canEnterReported`/`canClose` consistent across Tasks 1 and reconciler. ✅
