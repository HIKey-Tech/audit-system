# System Audit â€” Progress & Resume Point

_Last updated: 2026-06-29 (full backend module deep-trace complete)._

---

## âœ… Completed & verified (system-wide, objective checks)

| Area | Method | Result |
|---|---|---|
| Type safety | `tsc --noEmit` backend + frontend | Both clean, 0 errors |
| FEâ†”BE contract | Scripted diff: 225 FE `api.*` calls vs 254 BE routes | All map, correct methods (see note on extractor blind spots) |
| Response shape | `buildResponse`/`PaginationMeta` vs `api.getPaginated` | Field-for-field match |
| Proxy | `frontend/app/api/proxy/[...path]/route.ts` | Correct (method/body/query/auth fwd, X-Forwarded-For, strips content-encoding) |
| Auth gating | Parsed all route blocks for guards | All business routes gated; public ones intentional (auth, /me, /signature, /public filters is_public) |
| Error path | `error-handler.middleware.ts` + 254 handlers | AppErrorâ†’status, Prisma caught, no stack leak, 0 handlers missing try/next |
| Permission lockouts | required vs seeded perms, both directions | 1 bug found+fixed; now required âŠ† seeded |
| Rename leftovers | all `x:y` literals in src vs seed; near-twins; TODO/legacy markers | Clean â€” only `audit:read` (fixed). `dashboard:analytics:org` is a cache key, not a perm |

---

## âœ… User / Auth module â€” deep-trace complete

### Files checked
`auth.service.ts`, `auth.controller.ts`, `mfa.service.ts`, `mfa.controller.ts`,
`password-reset.service.ts`, `user.service.ts`, `user.controller.ts`,
`settings.controller.ts`, `session-guard.ts`

### ðŸž Bug #2 â€” `completeMfaLogin` missing `deleted_at` filter (medium)
**File:** `auth.service.ts:146`

`completeMfaLogin` calls `findUniqueOrThrow({ where: { id: userId } })` â€” no `deleted_at: null`. If a user is soft-deleted between the password-OK step and the MFA-verify step (race window), the deleted account still receives a valid token pair.

```ts
// CURRENT (vulnerable):
const user = (await prisma.user.findUniqueOrThrow({
  where: { id: userId },
  include: userWithRolesInclude,
})) as UserWithRoles;

// FIX â€” add deleted_at check:
const user = await prisma.user.findUnique({
  where: { id: userId, deleted_at: null },
  include: userWithRolesInclude,
});
if (!user) throw AppError.unauthorized('Invalid credentials');
```

### âš ï¸ Observation #1 â€” Grace-period deadline written outside token issuance (low)
**File:** `auth.service.ts:106-114`

`_issueTokens` and the subsequent `user.update` (which persists `mfa_grace_until`) are not in the same transaction. A crash between the two leaves the user with tokens but no persisted deadline. On next login the grace window is recomputed fresh â€” effectively a double grace.

**Suggestion:** Wrap `_issueTokens` + the `user.update` in a single `$transaction`, or accept the low risk given short grace windows.

### âš ï¸ Observation #2 â€” `adminReset` (MFA) does not revoke sessions (low)
**File:** `mfa.service.ts:148-163`

When an admin resets a user's 2FA, no session watermark is set. The user's existing access tokens remain valid for their full TTL even though auth state changed.

**Suggestion:** Add `await revokeUserSessions(targetUserId)` at the end of `adminReset`.

### âœ… Correct â€” Token rotation & reuse detection
Full rotation-grace window (`config.jwt.refreshRotationGrace`), concurrent-rotation CAS (`updateMany(where: { id, revoked_at: null })`), and dead-token revoke-all are implemented correctly.

### âœ… Correct â€” SSO account-linking safeguards
`syncFromAzureAd` â€” strict OID-first lookup, refuses to link if email already bound to a different OID, refuses unverified email linkage. No account-hijack path found.

### âœ… Correct â€” Privilege-escalation guard on role assignment
`_assertCanGrantRoles` â€” non-super-admin actors cannot grant `super_admin` and cannot assign permissions they don't hold themselves. Covers both `assignRoles` and `createUser`.

### âœ… Correct â€” Deactivate / delete â†’ immediate token invalidation
`setUserActiveStatus` â†’ `setUserActiveSnapshot` + `revokeUserSessions`. `deleteUser` â†’ same. Works correctly.

### âœ… Correct â€” Session guard
`assertSessionValid` in `session-guard.ts` â€” checks revoke watermark (iat < `auth:revokeBefore:<userId>`) and the liveness snapshot. Cache-miss fallback reads DB. Degrades gracefully when cache is down.

### âœ… Correct â€” Password reset
Single-use token enforced with `updateMany(where: { used_at: null })` CAS. Revokes all refresh tokens + access-token watermark on success. Account-enumeration guard always returns identical response.

### âœ… Correct â€” MFA backup-code & email OTP consumption
Backup-code: CAS `updateMany(where: { used_at: null })` prevents double-use.
Email OTP: `attempts >= config.mfa.emailOtpMaxAttempts` check prevents brute-force before hash compare.

---

## âœ… Audit module â€” deep-trace complete

### Files checked
`universe.service.ts`, `planning.service.ts`, `engagement.service.ts`,
`engagement-gates.ts`, `engagement-status.reconciler.ts`, `engagement-visibility.util.ts`,
`checklist.service.ts`, `working-paper.service.ts`, `evidence.service.ts`,
`finding.service.ts`, `follow-up.service.ts`, `report.service.ts`,
`report-generation.service.ts`, and their corresponding controllers.

### ðŸž Bug #5 â€” `getFindingById` skips engagement-scoping for non-auditee auditors (medium)
**File:** `finding.service.ts:245`

Only auditees were scoped via `_auditeeMatch(actor.id)`. Any regular auditor with the generic `finding:read` permission could fetch **any** finding in the database by ID, regardless of their engagement involvement.

**Fix:** Added engagement team membership check (lead auditor, manager, or workflow assignee) for non-oversight auditors after fetching the finding.

### ðŸž Bug #6 â€” Report service methods missing actor context entirely (high)
**Files:** `report.service.ts`, `report.service.interface.ts`, `report.controller.ts`

`getReport`, `getReportById`, `listReports`, and `exportReport` accepted no `actor` parameter and applied zero visibility filtering. Any authenticated user with `report:read` could view/export every report, including drafts intended for internal audit team only.

**Fix:** Added `_actorReportScope(actor)` method implementing:
- Oversight (`engagement:read_all`) â†’ full access
- Audit team (lead, manager, assignee) â†’ all statuses for their engagements
- Auditees â†’ only `issued` status reports for their engagements

Updated the interface, service, and controller to thread `actor` through all four methods.

### ðŸž Bug #7 â€” Evidence repository bypasses engagement scoping (medium)
**File:** `evidence.service.ts`

`listRepository`, `getRepositoryEvidence`, and `getDownloadUrl` checked `evidence:read` permission but did not verify the user was a member of the evidence's engagement. Any auditor could search/view/download evidence from any engagement.

**Fix:** Applied `repositoryEngagementScope(actor)` from `engagement-visibility.util.ts` to all three methods. Non-oversight users now only see evidence belonging to engagements where they are lead auditor, manager, or assignee.

### ðŸž Bug #8 â€” Follow-up endpoints missing actor visibility (medium)
**Files:** `follow-up.service.ts`, `follow-up.service.interface.ts`, `follow-up.controller.ts`

`getFollowUp` and `listPendingFollowUps` accepted no actor and returned data without visibility checks. Also added engagement-team scoping to `verifyRemediation`.

**Fix:** Updated interface and service to accept `actor`. `getFollowUp` now checks oversight, finding creator, responder, or engagement team membership. `listPendingFollowUps` checks engagement membership. `verifyRemediation` checks engagement team membership.

### ðŸž Bug #9 â€” `createAdhoc` skips universe validation (low)
**File:** `engagement.service.ts:189-194`

The `universe_id` passed in the DTO was never validated â€” a soft-deleted or nonexistent universe could be linked to a new engagement.

**Fix:** Added `_assertUniverseActive(universeId)` check (verifies `deleted_at: null` and existence).

### âš ï¸ Observation #3 â€” Manager and lead auditor active-status not checked (low)
**File:** `engagement.service.ts:70-88`

`_assertManagerCanApprove` and `_assertLeadAuditorEligible` verified permissions but not `isActive`. A deactivated user could be assigned as manager or lead auditor.

**Fix:** Added `isActive` checks to both assertion helpers + new `_assertAuditeeActive` helper. Applied to both `createAdhoc` and `createFromPlanItem`.

### âœ… Correct â€” Engagement status transitions
`_assertLifecycleGate` correctly enforces checklist completion, working paper approval, and report issuance gates. `assertTransition` validates against the allowed state machine transitions.

### âœ… Correct â€” Working paper approval chain
Working paper create/update/submit/approve all properly check permissions, engagement status, and paper status transitions.

### âœ… Correct â€” Checklist scoping
Checklists are always scoped to the engagement via `engagement_id` in both queries and mutations.

### âœ… Correct â€” Evidence upload validation
Uploads check engagement status (`in_progress`), file size limits, and properly scope to engagement.


---

## Workflow module - deep-trace complete

### Files checked
`approval.service.ts`, `approval.controller.ts`, `assignment.service.ts`,
`assignment.controller.ts`, `request.service.ts`, `request.controller.ts`,
`signed-document.service.ts`, `escalation.service.ts`, and `escalation.controller.ts`.

### Bug #11 - Approval read endpoints missing actor visibility (high)
**Files:** `approval.service.ts`, `approval.service.interface.ts`, `approval.controller.ts`

`getApprovalById`, `getApprovalByEntity`, `listSignedDocuments`, and `resolveChainForEntity` accepted raw IDs without actor context. Any user with `approval:read` could fetch approval metadata/chains/signed-doc references for unrelated audit artifacts.

**Fix:** Threaded actor context through controller read paths. Existing approval records now allow only oversight (`engagement:read_all`), submitter, pinned approver, eligible permission-pool approver, or the engagement audit team. Prospective chain resolution now checks the underlying entity before returning named approvers/candidates. Internal audit services can still call the service without actor context for status/report generation.

### Bug #12 - Escalation history missing actor visibility (medium)
**Files:** `escalation.service.ts`, `escalation.service.interface.ts`, `escalation.controller.ts`

`getEscalationHistory(type, id)` returned every escalation for an entity to any `escalation:read` holder, regardless of whether they were the escalation target or involved in the underlying entity.

**Fix:** Added actor-scoped checks. Oversight remains unrestricted; otherwise the caller must be an escalation target, engagement team member, approval participant/candidate, or workflow request participant.

### Bug #13 - Workflow request step actions could double-submit under race (medium)
**File:** `request.service.ts`

`approve`/`sign` (`_advance`) and `reject` updated the current request step by primary key only. Two concurrent actions against the same pending step could both insert actions and advance/close the request.

**Fix:** Switched step updates to `updateMany({ id, status: pending })` and abort with `AppError.conflict(...)` when the step was already claimed, matching the approval module's CAS pattern.

### Bug #14 - Assignment reads/candidates overexposed staff data (medium)
**Files:** `assignment.service.ts`, `assignment.service.interface.ts`, `assignment.controller.ts`

`GET /workflow/assignments/engagement/:id` returned assignments for any engagement to any `assignment:read` holder. Candidate discovery also used `assignment:read` even though it exposes active staff profiles, skills, and workload and is only useful to users who can create assignments.

**Fix:** Engagement assignment reads now require oversight or engagement team membership. Candidate discovery now requires `assignment:create` at the route and service layers.

### Correct - Approval action state machine
`approve` / `reject` correctly require the current step, required permission, pinned approver match where applicable, pending approval status, and atomic pending-step claim.

### Correct - Workflow request participant scoping
Request detail, list, inbox, signature verification, comments, attachments, and signed-document listing are scoped to initiator/recipient participation or `request:admin` where appropriate.

### Correct - Escalation scheduler idempotence shape
Escalation batches compute latest escalation per entity and advance levels based on thresholds; per-entity failures are isolated and logged without aborting the full run.


---

## Risk module - deep-trace complete

### Files checked
`register.service.ts`, `register.controller.ts`, `assessment.service.ts`,
`assessment.controller.ts`, `category.service.ts`, `category.controller.ts`,
`monitoring.service.ts`, `monitoring.controller.ts`, and risk DTO/util files.

### Bug #15 - Risk create/update trusted inactive or invalid references (medium)
**File:** `register.service.ts`

Risk create/update passed `categoryId`, `ownerId`, and `universeId` directly to Prisma. Invalid values failed as raw FK errors, and inactive categories/users could still be linked when the FK existed.

**Fix:** Added explicit reference validation: category must be active, owner must be active and not soft-deleted, and universe must exist/not be soft-deleted. Non-oversight creators/updaters cannot assign a risk to another owner.

### Bug #16 - Risk update/status/delete ignored owner scoping for future non-oversight writers (medium)
**File:** `register.service.ts`

Read paths scoped non-`risk:read_all` users to owned risks, but write paths only checked broad write permissions. If a role ever gained `risk:update`, `risk:delete`, or `risk:assess` without `risk:read_all`, it could mutate unrelated risks.

**Fix:** Added `_assertCanMutateRisk`: write actions require `risk:read_all` or ownership. Assessment creation now also uses the existing owner-aware risk lookup.

### Bug #17 - Audit universe risk score not reconciled after register mutations (medium)
**File:** `register.service.ts`

`audit_universe.risk_score` was recalculated after assessments, but not when risks were created, rescored through register update, moved to another universe, closed, or soft-deleted.

**Fix:** Wrapped risk create/update/status/delete in transactions and recalculated affected universe max active risk score after each mutation.

### Bug #18 - Attention-required monitoring ignored owner scoping (medium)
**File:** `monitoring.service.ts`

`getHighRiskItems`, trend, and summary applied owner scoping, but `getRisksRequiringAttention` returned all stale high risks to any `risk_monitoring:read` holder.

**Fix:** Added the same `risk:read_all` vs owner filter used by the other monitoring endpoints.

### Correct - Risk scoring math
`calculateRiskScore(likelihood, impact)` uses the expected 1-25 matrix. Bands are low 1-5, medium 6-12, high 13-19, critical 20-25.

### Correct - Assessment history immutability
Assessments are append-only snapshots. Creating an assessment updates the register's current score and `last_assessed_at` transactionally.

### Correct - Category lifecycle
Categories are soft-deactivated via `is_active`; list filtering supports active/inactive views, and register mutations now reject inactive categories.

---

## Asset module - deep-trace complete

### Files checked
`asset.service.ts`, `asset.controller.ts`, asset DTOs, asset utility helpers,
and asset response mappers.

### Bug #19 - Asset owner/custodian references trusted inactive users (medium)
**File:** `asset.service.ts`

Asset create/update accepted `ownerId` and `custodianId` directly. Invalid IDs failed as raw FK errors, and inactive or soft-deleted users could still be assigned when the FK existed.

**Fix:** Added `_assertUsersActive(...)` and call it from create/update so owner and custodian references must be active, non-deleted users.

### Bug #20 - Asset audit/risk link mutations lacked row-level scope (medium)
**File:** `asset.service.ts`

`asset:link` could link/unlink assets to any engagement, finding, evidence, or risk by ID. That made the broad asset permission enough to mutate relationships for audit/risk records outside the actor's scope.

**Fix:** Added scoped link assertions for engagement, finding, evidence, and risk links. Engagement-derived links require oversight or audit-team involvement. Risk links require `risk:read_all` or risk ownership.

### Bug #21 - Asset audit context leaked restricted link IDs (medium)
**File:** `asset.service.ts`

`getAuditContext(assetId)` returned every engagement/finding/evidence/risk link for the asset to any `asset:read` holder, even when the caller could not see the underlying audit or risk record.

**Fix:** Applied actor-scoped relation filters to engagement, finding, evidence, and risk context reads. Universe links remain unchanged because the current universe read model is not actor-owned.

### Correct - Asset lifecycle and soft delete
Asset delete is a soft delete (`deleted_at`) and asset read/list paths consistently filter deleted assets.

### Correct - Attestation semantics
Attestation records are append-only history entries. `last_attested_at` records the last review event, including negative outcomes such as `changes_required` or `rejected`.

---
## Document module - deep-trace complete

### Files checked
`document.service.ts`, `document.controller.ts`, `document.service.interface.ts`,
`document.request.dto.ts`, storage client, response mappers, and template helper.

### Bug #22 - HTTP document upload could attach to unauthorized audit entities (medium)
**Files:** `document.service.ts`, `document.controller.ts`, `document.service.interface.ts`

The generic `POST /documents` route accepted `entityType` / `entityId` metadata and wrote the document before checking whether the caller could see or participate in the owning engagement. A user with `document:write` could attach files to audit entities outside their engagement scope.

**Fix:** HTTP upload now passes the full actor context into `DocumentService.upload`. When an actor is supplied, the service validates partial entity metadata and gates engagement-scoped entity attachments by oversight or engagement team membership before writing to storage or DB. Internal module uploads remain backward-compatible because those modules already perform their own authorization before calling the document service.

### Bug #23 - HTTP version upload lost the actor permission context (medium)
**Files:** `document.service.ts`, `document.controller.ts`, `document.service.interface.ts`

`POST /documents/:id/versions` called `uploadNewVersion` with only `uploadedById`, so the service checked access using an artificial actor with no permissions. That made oversight users fail legitimate version uploads, and kept the service from applying the same real actor context used by read paths.

**Fix:** `uploadNewVersion` now accepts an optional `DocumentAccessActor`; the HTTP route passes `req.user`. The previous uploader-only fallback remains for internal call sites.

### Correct - Raw file serving guard
`serveFile(storedName, actor)` resolves current and historical storage keys back to document records and applies parent document access before streaming bytes.

### Correct - Personal document listing
The standalone `GET /documents` listing is scoped to `uploaded_by_id = actor.id`, so users do not see other users' personal uploads.

---

## Messaging module - deep-trace complete

### Files checked
`notification.service.ts`, `notification.controller.ts`, `notification-queue.service.ts`,
`template.service.ts`, `template.controller.ts`, messaging DTOs, and Prisma queue/template models.

### Bug #24 - Queue rows could remain stuck in processing after a worker crash (medium)
**File:** `notification-queue.service.ts`

The queue atomically claimed pending rows by moving them to `processing`, but there was no recovery path if the process crashed after claim and before marking the row `sent` or `failed`. Those rows would be skipped forever by future drains.

**Fix:** Added stale-processing recovery at the start of each drain. Rows stuck in `processing` beyond the timeout are either rescheduled with the existing exponential backoff or marked failed if their max attempts are exhausted.

### Bug #25 - Mark-read reported success for missing or foreign notifications (low)
**File:** `notification.service.ts`

`markNotificationRead(id, userId)` used `updateMany` scoped by notification ID and user ID, but ignored the affected-row count. The API returned success even when the notification did not exist or belonged to another user.

**Fix:** The service now throws `AppError.notFound('Notification')` when the scoped update affects zero rows.

### Correct - Notification list scoping
Notification listing, unread counts, and bulk mark-read operations are all scoped to the authenticated user's `user_id`.

### Correct - Template admin permissions
Notification template routes use seeded `notification_template:*` permissions; queue stats use `notification_queue:read`.

---

## Settings module - deep-trace complete

### Files checked
`system-config.service.ts`, `system-config.controller.ts`,
`working-paper-template.service.ts`, `working-paper-template.controller.ts`,
`report-template.service.ts`, `report-template.controller.ts`, settings DTOs and utilities.

### Bug #26 - Template update name checks treated soft-deleted rows as active conflicts (low)
**Files:** `working-paper-template.service.ts`, `report-template.service.ts`

Update paths checked for duplicate names without filtering `deleted_at: null`. A soft-deleted template could therefore block renaming an active template to that name, even though create paths explicitly support restoring deleted template names.

**Fix:** Added `deleted_at: null` to working-paper and report template update conflict checks.

### Correct - Default template updates are transactional
Working-paper and report template default changes clear competing defaults and set the selected template inside transactions.

### Correct - System config public/private reads
Public config listing filters on `is_public`; full config listing and updates require settings permissions.

---

## Integration module - deep-trace complete

### Files checked
`directory-mapping.service.ts`, `directory-mapping.controller.ts`,
`graph.client.ts`, directory DTOs, role reconciler utility, and existing reconciler tests.

### Bug #27 - Directory mapping update could hit raw unique constraint errors (low)
**File:** `directory-mapping.service.ts`

Create prevented duplicate Azure group-to-role mappings, but update could change a mapping's role onto an existing `(ad_group_id, role_id)` pair. The database unique constraint would reject it as a raw Prisma error instead of a controlled business conflict.

**Fix:** Added a pre-update duplicate check and return `AppError.conflict(...)` for an existing group-role pair.

### Correct - Reconciliation preserves manual roles
`reconcileAdRoles` only adds/removes `azure_ad` source rows and never mutates manual grants.

### Correct - External directory adapter is read-only
The Graph client only reads users and group memberships. IAMS role writes remain local to `user_roles`.

---

## Dashboard module - deep-trace complete

### Files checked
`dashboard.service.ts`, `dashboard.controller.ts`, dashboard DTOs, and dashboard utility helpers.

### Bug #28 - Risk dashboard ignored owner scoping for non-oversight users (medium)
**Files:** `dashboard.service.ts`, `dashboard.controller.ts`

The Risk module scopes non-`risk:read_all` users to owned risks, but dashboard risk overview and risk matrix were org-wide for every `dashboard:read` holder. That exposed risk titles, owners, scores, and matrix counts outside the caller's risk scope.

**Fix:** Added a shared dashboard risk filter. Risk overview and risk matrix now use org-wide data only for `risk:read_all`; other users see only risks they own. Risk matrix cache keys are separated between org-wide and per-user scoped payloads.

### Correct - Personal work and approval inbox
`my-work` and approval inbox summaries are scoped by the authenticated user's ID.

### Correct - Analytics cache scope split
Audit analytics cache keys already distinguish org-wide oversight results from scoped per-user results.

---

## Background module - deep-trace complete

### Files checked
`scheduler.service.ts`, `job.service.ts`, `job.controller.ts`, job DTOs, scheduler registration list, and scheduled job Prisma models.

### Bug #29 - Scheduler allowed overlapping runs of the same job in one process (medium)
**File:** `scheduler.service.ts`

The scheduler triggered jobs directly from cron without a per-job in-process guard. A long-running handler, especially the 15-second notification queue drain or external directory sync, could overlap with the next cron tick in the same process.

**Fix:** Added a process-local `runningJobs` guard. A second tick for the same job key is skipped while the previous run is active, and the guard is cleared in `finally`. The scheduler also marks the job's persisted `last_status` as `running` when a run begins.

### Correct - Persisted enable/disable controls
Registered jobs are upserted into `scheduled_jobs`; disabled DB rows are not started, and API enable/disable calls update DB state and start/stop the scheduled task.

### Correct - Run history persistence
Each actual run writes a `scheduled_job_runs` row and records success/failure completion status and error text.

---

## ðŸž Bugs found â€” cumulative list

| # | Location | Severity | Status | Summary |
|---|---|---|---|---|
| 1 | `approval.controller.ts:51` | Medium | âœ… Fixed | Required unseeded `audit:read` perm â†’ endpoint dead for all |
| 2 | `auth.service.ts:146` | Medium | âœ… Fixed | `completeMfaLogin` missing `deleted_at: null` filter |
| 3 | `auth.service.ts:106` | Low | âœ… Fixed | Grace-period deadline now atomic with token issuance via `$transaction` |
| 4 | `mfa.service.ts:148` | Low | âœ… Fixed | `adminReset` now calls `revokeUserSessions` |
| 5 | `finding.service.ts:245` | Medium | âœ… Fixed | `getFindingById` skips engagement-scoping for non-auditee auditors |
| 6 | `report.service.ts:300-356` | High | âœ… Fixed | Report get/list/export missing actor context â€” no visibility filtering |
| 7 | `evidence.service.ts:125-188` | Medium | âœ… Fixed | Evidence repository bypasses engagement scoping |
| 8 | `follow-up.service.ts:270-289` | Medium | âœ… Fixed | Follow-up get/list missing actor visibility checks |
| 9 | `engagement.service.ts:189` | Low | âœ… Fixed | `createAdhoc` skips universe existence/active validation |
| 10 | `engagement.service.ts:70-88` | Low | âœ… Fixed | Manager/lead/auditee `isActive` not checked on assignment |
| 11 | `approval.service.ts` read methods | High | Fixed | Approval get/entity/chain/signed-doc reads missing actor visibility |
| 12 | `escalation.service.ts:getEscalationHistory` | Medium | Fixed | Escalation history exposed by entity ID without participant checks |
| 13 | `request.service.ts` approve/sign/reject | Medium | Fixed | Request step actions lacked atomic pending-step claim |
| 14 | `assignment.service.ts` / controller | Medium | Fixed | Assignment reads/candidates exposed engagement/staff data too broadly |
| 15 | `register.service.ts` references | Medium | Fixed | Risk create/update trusted inactive or invalid category/owner/universe references |
| 16 | `register.service.ts` write paths | Medium | Fixed | Risk update/status/delete/assess lacked owner-scope guard for non-oversight writers |
| 17 | `register.service.ts` universe sync | Medium | Fixed | Audit universe risk score not reconciled after register mutations |
| 18 | `monitoring.service.ts:getRisksRequiringAttention` | Medium | Fixed | Attention-required monitor ignored owner scoping |
| 19 | `asset.service.ts` owner/custodian refs | Medium | Fixed | Asset create/update trusted inactive or invalid user references |
| 20 | `asset.service.ts` link mutations | Medium | Fixed | Asset audit/risk link mutations lacked row-level scope |
| 21 | `asset.service.ts:getAuditContext` | Medium | Fixed | Asset audit context leaked restricted audit/risk link IDs |
| 22 | `document.service.ts` upload path | Medium | Fixed | Generic document upload could attach files to unauthorized audit entities |
| 23 | `document.service.ts` version upload | Medium | Fixed | HTTP version upload lost real actor permission context |
| 24 | `notification-queue.service.ts` processing recovery | Medium | Fixed | Queue rows could remain stuck in processing after a worker crash |
| 25 | `notification.service.ts:markNotificationRead` | Low | Fixed | Mark-read returned success for missing or foreign notification IDs |
| 26 | `working-paper-template.service.ts` / `report-template.service.ts` | Low | Fixed | Template update name checks treated soft-deleted rows as active conflicts |
| 27 | `directory-mapping.service.ts:updateMapping` | Low | Fixed | Directory mapping update could hit raw unique constraint errors |
| 28 | `dashboard.service.ts` risk overview/matrix | Medium | Fixed | Risk dashboard ignored owner scoping for non-oversight users |
| 29 | `scheduler.service.ts:_runJob` | Medium | Fixed | Scheduler allowed overlapping runs of the same job in one process |

---

## â³ NOT yet done â€” per-handler business logic deep-trace

- [x] **User/Auth** â€” login, MFA enroll/verify, refresh rotation, password reset token expiry, session guard, 2FA reset. âœ… Done
- [x] **Audit** â€” universe, planning, engagement lifecycle gating, working papers, evidence, findings, follow-up, report sign-off. âœ… Done
- [x] **Workflow** - approval state machine + signature, assignment, request, escalation. Done
- [x] **Risk** - categories, register, assessments, monitoring (scoring math). Done
- [x] **Asset** - linking routes (including AssetController `auditRouter`), attestation. Done
- [x] **Document** - uploads, downloads, versions, templates, storage serving. Done
- [x] **Messaging** - notification dispatch, templates, queue drain/retry behavior. Done
- [x] **Settings** - system config, working-paper templates, report templates. Done
- [x] **Integration** - directory mappings, Graph read adapter, AD role reconciliation. Done
- [x] **Dashboard** - summary, findings, risks, matrix, activity, escalations, my-work, analytics. Done
- [x] **Background** - scheduler jobs. Done

### What to look for per module
data scoping (does a non-admin see only their rows?), missing `await`, state-transition guards, Prisma filter correctness, N+1, status codes, FE permission-gate vs BE require-permission per action.

### Extractor blind spots (for re-running contract diff)
The route-diff script (`C:\tmp\contract.js`) missed: (a) aliased imports `X as Y`, (b) secondary routers like `AssetController.auditRouter`. All 13 "misses" were manually confirmed to exist. Fix the script before trusting a fresh run.



