# IAMS — Project State

> Living snapshot of what has been built, what is stubbed, and what is next.
> **Update this file every time a module gains or loses capability.**
> Last updated: 2026-06-22 (rev 31)

> **rev 31 changelog:** Azure AD (Entra) group→role integration — new `integration/` module (backend). Identity/membership stays Azure's authority; roles→permissions stay IAMS's; bridged by an admin-managed `directory_group_mappings` table (Azure security-group Object ID → IAMS role). New `user_roles.source` column (`'manual'` | `'azure_ad'`) makes AD-driven and manual role assignments coexist — reconciliation only ever touches `azure_ad` rows, so local accounts and manual grants are never disturbed. Pure `reconcileAdRoles()` util (unit-tested, the repo's first Jest test + a minimal `jest.config.js`). `GraphDirectoryClient` (real + stub + factory, read-only) calls Microsoft Graph app-only. `DirectoryMappingService` owns mapping CRUD + `applyAdRolesToUser` + `runFullDirectorySync`. SSO login (`syncFromAzureAd`) now applies group→role from the token's `groups` claim with a Graph overage fallback; **unmapped SSO users now get zero roles (was auto-`viewer`)**. New nightly job `BG:INTEGRATION:DIRECTORY:SYNC:DAILY` reconciles + deprovisions (disabled-in-Azure → deactivated), gated by `DIRECTORY_SYNC_ENABLED`. Routes under `/api/v1/integration/directory/*` (`settings:read`/`settings:manage`). Migration `20260622145209_add_directory_group_mapping`. **Frontend:** Settings → **Directory** tab (`directoryApi` + `DirectoryMappingsTab` + `DirectoryMappingSlideOver`) lists mappings, create/edit/delete via slide-over (group Object ID, display name, role dropdown, active toggle), and a "Sync now" button; write actions gated on `settings:manage`. Backend build + reconciler test + frontend production build all pass. **SSO login is now reachable from the UI:** a "Sign in with Microsoft" button on `/login` drives a BFF flow (`/api/auth/sso` start → Entra → `/api/auth/callback` exchanges via backend and sets the httpOnly cookies) — so `AZURE_AD_REDIRECT_URI` must point at the frontend `/api/auth/callback`. **MFA:** SSO already bypasses IAMS 2FA (Entra owns it); `SSO_REQUIRE_IDP_MFA=true` additionally rejects SSO logins whose token `amr` lacks `mfa`. **Baseline access:** `SSO_DEFAULT_ROLE` (default `viewer`) grants every SSO user a read-only role on top of any group-mapped roles, so all employees get baseline access.

> **rev 30 changelog:** Engagement flow redesign. **Status is now derived, not toggled.** A cycle-free reconciler (`engagement-status.reconciler.ts` + `engagement-gates.ts`) auto-advances an engagement forward whenever the next stage's configurable lifecycle gates are satisfied; the only manual acts left are **Start fieldwork** (`planned → in_progress`) and **Issue report**. Reconciliation fires after a checklist test, after report issuance, after final working-paper / finding-closure approval (via dynamic import to avoid the audit↔workflow cycle), and hourly via `BG:AUDIT:RECONCILE:STATUS:HOURLY` as a safety net. Forward-only — never auto-regresses, never auto-issues, never auto-starts fieldwork. **Three-tier visibility:** oversight (`engagement:read_all`), involved parties (lead/manager/auditee/assignee), and active approvers (a user with a live pending approval step on one of the engagement's report/working-paper/finding entities can open the detail while that step is open). **Restricted auditee view:** engagement detail now carries a per-viewer `viewerContext`; a pure auditee is blocked (API-enforced, not just hidden tabs) from working papers, internal evidence, checklists, and pre-issue/draft findings. **Approval chain shown as people:** new `GET /workflow/approvals/chain/:entityType/:entityId` resolves each level to the signed/pinned person or candidate permission holders (no role names); frontend `StatusStepper` guide replaced by a names-based **What's next** panel, and the Report tab + detail page render the chain by name and hide internal tabs from auditees. No "Move to next stage" button anywhere. Backend + frontend builds pass.

> **rev 29 changelog:** Added formal workflow approval for audit finding closure. `audit_finding_closure` is now a workflow approval entity with configurable `approval_matrix.findingClosure` (default: engagement manager). Closing a verified finding now moves it to `pending_closure` and creates an approval transactionally; final workflow approval sets the finding to `closed`, while rejection returns it to `verified`. Engagement closure now requires findings to be fully closed, not merely verified. Settings UI exposes the finding-closure matrix and the finding detail UI requests closure through the close endpoint.

> **rev 28 changelog:** Tightened workflow approval consistency. Report-specific approve/reject endpoints now require generic workflow action permissions (`approval:approve` / `approval:reject`) and defer per-level report sign-off authorization to the configurable workflow approval matrix, so oversight/final approvers can use the report endpoint without needing generic `report:approve`. Working-paper submission now wraps status update + approval creation in one transaction and queues the approval notification after commit, preventing submitted papers without approval records.

> **rev 27 changelog:** Added the frontend Asset Registry module. The Next.js app now includes a permission-gated `/assets` registry, `/assets/:id` detail workspace, asset create/edit/delete flows, relationship management, attestations, source/provenance records, and audit-context display. Sidebar visibility and UI actions are driven by `asset:*` permissions. Audit engagement detail now includes an Assets tab for linking/unlinking assets in engagement scope. Frontend production build passes.

> **rev 26 changelog:** Added the backend Asset module. The new `src/modules/asset/` module exposes permission-gated asset registry CRUD, relationships, owner/custodian attestations, source/provenance records, and audit-context link APIs. Prisma migration `20260612120000_add_asset_module` adds `assets`, `asset_relationships`, `asset_attestations`, `asset_sources`, and link tables for audit universe, engagements, findings, risks, and evidence. Seed now includes granular `asset:*` permissions. The module is mounted under `/api/v1/assets` plus asset-scoped audit routes under `/api/v1/audit/.../assets`. Frontend screens for the asset registry are not built yet.

> **rev 25 changelog:** Added frontend self-service profile area at `/profile`. Users can view account details, edit display name/phone/skills, change password, start 2FA setup, regenerate backup codes, log out everywhere, and review roles/effective permissions. Header/sidebar user identity now links to the profile page; a small `/api/auth/session-user` route refreshes the display cookie after profile edits.

> **rev 24 changelog:** Password-reset email links now target the Next.js frontend instead of the Express API: local `.env` sets `FRONTEND_URL=http://localhost:3001`, `.env.example` documents the same, and `config.app.frontendUrl` falls back to `http://localhost:3001` to match the frontend dev/start port.

> **rev 23 changelog:** Forgot-password behavior changed per product requirement: unknown emails now return an explicit account-not-found error instead of the prior generic no-enumeration 200 response. Inactive accounts and SSO-only accounts also return actionable errors; successful local-account requests now say a reset link was sent.

> **rev 22 changelog:** Azure-hosted development database brought up to date with migration history via `prisma migrate deploy`; applied `20260611120000_add_audit_plan_description` and `20260611120533_add_password_reset_and_mfa`. `prisma migrate status` against the active Azure `DATABASE_URL` reports the database schema is up to date.

> **rev 21 changelog:** Migration drift repaired without resetting data: added `20260611120000_add_audit_plan_description` to record the existing `audit_plans.description` column in migration history, marked it applied locally, then generated/applied `20260611120533_add_password_reset_and_mfa`. `prisma migrate status` now reports the database schema is up to date.

> **rev 20 changelog:** User-module auth hardening (full-stack). **Forgot password:** new `password_reset_tokens` table; `PasswordResetService`; public `POST /auth/forgot-password` + `POST /auth/reset-password` (single-use sha256-hashed token, 30-min TTL, revokes all refresh tokens on reset); reset email via the notification queue; frontend `/forgot-password` + `/reset-password` pages and a "Forgot password?" link on login. **Mandatory 2FA (TOTP + email OTP):** `User` gains `mfa_enabled` / `mfa_method` / `mfa_totp_secret` (AES-256-GCM encrypted at rest) / `mfa_enrolled_at`; new `mfa_backup_codes` (bcrypt, single-use) + `mfa_email_otps` (sha256, attempt-capped) tables; `MfaService` (TOTP via `otplib` v13, email OTP, hashed backup codes); `AuthService.login` now returns a discriminated union (`OK` / `MFA_REQUIRED` / `MFA_ENROLLMENT_REQUIRED`) and `completeMfaLogin` issues tokens after a passed challenge/enrolment; new `MfaController` mounted at `/auth/2fa` (`setup`, `enroll`, `verify`, `backup-codes/regenerate`, super-admin `admin-reset` lockout escape hatch); scope-restricted `requireMfaToken` guard, and `authenticate` now rejects scoped tokens. Frontend: login routes to `/login/2fa` (challenge) or `/login/2fa/enroll`; intermediate tokens carried in short-lived httpOnly cookies (`iams_mfa` / `iams_enroll`). New deps: `otplib`, `qrcode`. **Grace period:** `users.mfa_grace_until` + `MFA_GRACE_PERIOD_DAYS` (default 7) — not-yet-enrolled users (incl. all existing users) log in normally with a skippable "set up 2FA" prompt (`/login/2fa/enroll?optional=1`); the hard block only kicks in after the deadline. The deadline is lazily set on first login, so existing users are never blocked immediately. `setup`/`enroll` accept an access token too (`requireEnrollmentContext`) so voluntary setup works from an authenticated session. DB migration now applied; backend + frontend `tsc` both pass.

> **rev 19 changelog:** Two features added. **C2 — Skill-based staff assignment:** `User` model gains a `skills` column (`NVARCHAR(max)` JSON array of free-text tags, up to 30 × 100 chars each); user create/update DTOs accept `skills`; response DTOs parse/return `skills: string[]`; new `GET /workflow/assignments/candidates/:engagementId` endpoint returns un-assigned active users with parsed skills, department, job title, and active-engagement workload count (permission-gated by `assignment:read`). **E3 — Configurable version retention:** `version_retention` system config seed added (opt-in, disabled by default, `keepLastVersions: 10`); `DocumentService.pruneOldVersions()` reads the config, respects the enabled flag, iterates all documents with > N versions, deletes excess from storage then DB, returns `{ prunedCount, failedCount }`; `BG:DOCUMENT:VERSION:PRUNE:WEEKLY` cron job registered at Sunday 03:00, no-op when retention is disabled.

---

## 1. One-line status

Foundation, User module, Document module, Asset module backend + frontend, Audit module HTTP/services, Risk module HTTP/services, Workflow module HTTP/services, Messaging module (in-app notification HTTP/services + reliable notification queue), Background module HTTP/services, Logging module (services + read-only HTTP routes), Dashboard module (services + read-only HTTP routes), Settings module (role admin, working paper templates, report templates, system config), and app entry point (`server.ts`) are complete and production-shaped. The Next.js frontend is active for the existing workflows, including the asset registry and engagement asset scope. A full backend smoke test completed on 2026-05-01 against the local SQL Server database. Integration, Predictive, and automated Jest coverage are **not started**.

---

## 2. What is built

### 2.1 Shared / infrastructure layer — COMPLETE

| File | Purpose |
|---|---|
| `src/shared/config/app.config.ts` | Centralised env-driven config. Uses `requireEnv` / `optionalEnv` helpers. All env reads go through here. |
| `src/shared/errors/app.error.ts` | `AppError` class + `ErrorCode` enum + static factories (`unauthorized`, `notFound`, `conflict`, etc.). |
| `src/shared/middleware/auth.middleware.ts` | `authenticate` (JWT), `requirePermission(...)`, `requireRole(...)`. Attaches `req.user` with `{ id, email, displayName, roles[], permissions[] }`. |
| `src/shared/middleware/error-handler.middleware.ts` | Global error handler — serialises `AppError`, handles Prisma errors, falls back to 500. Also exports `notFoundMiddleware`. |
| `src/shared/middleware/validate.middleware.ts` | `validate(zodSchema, source)` — validates `body` / `query` / `params`, reassigns the parsed value, throws `AppError.validationError(details)` on failure. |
| `src/shared/prisma/prisma.client.ts` | Prisma singleton with query + error logging. Dev hot-reload safe via `globalThis.__prisma`. Exports `connectDatabase` / `disconnectDatabase`. |
| `src/shared/prisma/prisma.types.ts` | Shared Prisma `include` shapes. Currently: `userWithRolesInclude` + `UserWithRoles` (used by auth middleware + auth service + user service). |
| `src/shared/types/api-response.type.ts` | `ApiResponse<T>`, `PaginationMeta`, `PaginationQuery`, `buildResponse`, `buildPaginationMeta`, `parsePagination`. **Every HTTP response goes through `buildResponse`.** |
| `src/shared/utils/logger.util.ts` | Winston logger. Dev: colourised text. Prod: JSON + file transports. |

### 2.2 User module — COMPLETE

Folder: `src/modules/user/`

| Sub-feature | Status | Files |
|---|---|---|
| Local login (email + password) | Done | `controller/auth.controller.ts`, `service/implementation/auth.service.ts` |
| SSO — Azure AD OIDC | Done | `service/client/oidc.client.ts` (`AzureAdOidcClient`) |
| SSO — Generic OIDC (Okta / Auth0 / Keycloak) | Done | `service/client/oidc.client.ts` (`GenericOidcClient`) |
| Refresh tokens with rotation + reuse detection | Done | `auth.service.ts` — old token revoked on use; reuse of a revoked token revokes all tokens for that user |
| Logout / logout-all | Done | `auth.service.ts` |
| Forgot / reset password (local accounts) | Done | `service/implementation/password-reset.service.ts` — single-use hashed token (30-min TTL), no user enumeration, revokes all sessions on reset |
| Mandatory 2FA — TOTP + email OTP + backup codes | Done | `service/implementation/mfa.service.ts`, `controller/mfa.controller.ts`, `utility/mfa.utility.ts` — TOTP secrets AES-256-GCM encrypted at rest; super-admin reset escape hatch |
| JIT provisioning on first SSO login | Done | `user.service.ts#syncFromAzureAd` — creates user with default `viewer` role |
| User CRUD + soft-delete | Done | `controller/user.controller.ts`, `service/implementation/user.service.ts` |
| Self-service profile (`/users/me`, `/users/me/change-password`) | Done | `user.controller.ts` |
| Role assignment / removal | Done | `user.service.ts#assignRoles`, `#removeRole` |
| Role + permission catalogue endpoints | Done | `GET /users/roles`, `GET /users/permissions` |
| RBAC seed (8 roles, 20 permissions) | Done | `prisma/seed.ts` — `director` and `cae` include `audit:write` for audit report approval |
| Skills (free-text tags) | Done | `users.skills NVARCHAR(max)` JSON array; Zod-validated (max 30 tags, 100 chars each); parsed by `parseSkills()` in response DTO |
| Module factory | Done | `modules/user/index.ts` — `createUserModule(): Router` |

**Routes mounted by the module:**

```
/auth/login          POST   public   — returns tokens OR an MFA_REQUIRED / MFA_ENROLLMENT_REQUIRED state
/auth/sso            GET    public   — returns Azure/OIDC authorization URL
/auth/callback       GET    public   — OIDC code exchange
/auth/refresh        POST   public
/auth/logout         POST   private
/auth/logout-all     POST   private
/auth/forgot-password           POST   public        — always 200 (no user enumeration)
/auth/reset-password            POST   public        — single-use token
/auth/2fa/setup                 POST   mfa_enroll    — begin enrolment (TOTP QR / email OTP)
/auth/2fa/enroll                POST   mfa_enroll    — verify, enable 2FA, return backup codes + tokens
/auth/2fa/verify                POST   mfa_challenge — verify login code, issue tokens
/auth/2fa/backup-codes/regenerate  POST  private     — regenerate backup codes
/auth/2fa/admin-reset           POST   super_admin   — reset a user's 2FA (lockout recovery)

/users/me                     GET     private
/users/me                     PATCH   private
/users/me/change-password     POST    private
/users                        GET     user:read
/users/roles                  GET     user:read
/users/permissions            GET     user:read
/users                        POST    user:write
/users/:id                    GET     user:read
/users/:id                    PATCH   user:write
/users/:id                    DELETE  user:delete
/users/:id/roles              PUT     user:admin
/users/:id/roles/:roleId      DELETE  user:admin
```

**Permission catalogue (from seed):** `user:*`, `audit:*`, `finding:*`, `document:*`, `notification:read`, `log:*`, `job:*`, `predictive:*`.

**Roles:** `super_admin`, `audit_admin`, `audit_lead`, `auditor`, `director`, `cae`, `auditee`, `viewer`.

**Local smoke-test users present as of 2026-05-01:**

| Email | Display name | Roles | Status |
|---|---|---|---|
| `admin@example.com` | Super Admin | `super_admin`, `audit_admin` | Active system user |
| `auditor@gbb.gov.ng` | Test Auditor | `audit_lead` | Active |
| `auditee@gbb.gov.ng` | Test Auditee | `auditee` | Active |
| `director@gbb.gov.ng` | Test Director | `director` | Active |
| `cae@gbb.gov.ng` | Test CAE | `cae` | Active |

### 2.3 Logging module — COMPLETE (services + HTTP routes)

Folder: `src/modules/logging/`

- `AuditLogService` (singleton export: `auditLogService`) — persists to and reads from `audit_logs`. Methods:
  - `log(dto)` — awaited. Swallows internal errors so logging never crashes the app.
  - `logAsync(dto)` — fire-and-forget.
  - `listLogs(query)` — paginated, filterable (by `userId`, `module`, `entityType`, `entityId`, `action`, `status`, `dateFrom`, `dateTo`), sortable on `createdAt`.
  - `getLogById(id)` — single audit-log lookup.
  - `getDistinctModules()` — list of modules that have produced at least one log entry.
  - `getLogSummary(query)` — aggregate counts grouped by module and status, optionally bounded by date range.
- `requestAuditLogger` middleware — drops into Express. Auto-logs every **mutating** request (POST/PUT/PATCH/DELETE) after the response is sent, including `userId`, `action`, `module` (derived from path with aliases for `users → user`, `documents → document`, `notifications → messaging`, `jobs → background`, `logs → logging`), `status`, `durationMs`.
- `LoggingController` + `createLoggingModule()` — mounted at `/api/v1/logs`.

**Routes mounted by the module:**

```
/logs                   GET     log:read    — paginated, filterable, sortable list
/logs/modules           GET     log:read    — distinct modules that have produced log entries
/logs/summary           GET     log:admin   — aggregate counts grouped by module + status
/logs/:id               GET     log:read    — single audit-log entry
```

**Not yet built:**
- System-log persistence (application errors / warnings → DB).
- Warehouse pipeline (the module description calls for a feed to the data warehouse that trains the Predictive module).

### 2.4 Messaging module — COMPLETE (services + HTTP routes)

Folder: `src/modules/messaging/`

- `NotificationService` (singleton export: `notificationService`) — uses nodemailer.
  - `sendEmail(dto)` — persists to `email_logs` first (`pending`), then updates to `sent` / `failed` after SMTP.
  - `sendInAppNotification(dto)` — persists to `notifications` table.
  - `listForUser(userId, query)` — paginated list of the caller's notifications, optional `isRead` filter, sortable by `created_at` / `read_at`.
  - `markNotificationRead(id, userId)`.
  - `markAllRead(userId)` — bulk-marks every unread notification for the user; returns the count updated.
  - `getUnreadCount(userId)`.
- `NotificationQueueService` (singleton export: `notificationQueueService`) - persists notification work to `notification_queue`.
  - `enqueue(type, payload)` - fast DB write used by audit/workflow/background services instead of direct sending.
  - `processQueue()` - background processor for up to 50 pending items per run; retries failed work until `max_attempts`, then marks permanently failed.
  - `getQueueStats()` - returns counts by queue status for monitoring.
- Queue status after the 2026-05-01 smoke test: 18 queued notifications were processed and all are `sent`; there are no pending or failed queue items in the local database snapshot.
- `NotificationController` + `createMessagingModule()` — mounted at `/api/v1/notifications`.

**Routes mounted by the module:**

```
/notifications                                    GET     notification:read
/notifications/queue/stats                        GET     notification:read
/notifications/unread-count                       GET     notification:read
/notifications/read-all                           POST    notification:read
/notifications/:id/read                           POST    notification:read

/notifications/templates                          GET     notification:read
/notifications/templates                          POST    audit:admin
/notifications/templates/:id                      GET     notification:read
/notifications/templates/:id                      PATCH   audit:admin
/notifications/templates/:id                      DELETE  audit:admin
```

- `TemplateService` (singleton export: `templateService`) — DB-driven notification templates with `{{placeholder}}` substitution via `renderTemplate(body, variables)` in `utility/template.utility.ts`. Methods: `createTemplate`, `updateTemplate`, `deactivateTemplate` (soft delete), `getTemplateByEventAndChannel` (used internally by the queue), `getTemplateById`, `listTemplates`.
- Queue payloads (email + in_app) accept optional `eventKey` and `variables` fields. `processQueue` looks up the active template for `(eventKey, channel)`, renders body (and email subject) with the variables, and falls back to the raw subject/body when no template is found.
- Existing enqueue call sites updated to populate `eventKey` + `variables` for: workflow approval created/approved/rejected, workflow assignment created, audit engagement escalation levels 1-4, audit report issued, audit follow-up verified, and audit SLA reminder.
- Seeded default templates: 12 events × 2 channels = 24 templates (covers `workflow.approval.created/approved/rejected`, `workflow.assignment.created`, `audit.escalation.level_1..4`, `audit.report.issued`, `audit.followup.response.submitted`, `audit.followup.verified`, `audit.sla.reminder`).

**Not yet built:**
- SMS channel.

### 2.5 Document module — COMPLETE

Folder: `src/modules/document/`

- `DocumentService` — file CRUD (`upload`, `getById`, `getDownloadUrl`, `delete` soft, `listByEntity`), versioning (`uploadNewVersion`, `listVersions`, `getVersion`, `getVersionDownloadUrl`), templates (`createTemplate`, `getTemplateById`, `listTemplates`, `updateTemplate`, `deleteTemplate` soft).
- Storage adapter pattern via `IStorageClient`:
  - `LocalStorageClient` — fully implemented (filesystem + UUID-stamped filenames).
  - `AzureBlobStorageClient` — stub (methods log warnings / throw "not yet implemented").
  - `createStorageClient()` factory picks based on `config.storage.provider`.
- `DocumentController` + `createDocumentModule()` — mounted at `/api/v1/documents`.
- Versioning model: `Document` holds the current version; every historical version is snapshotted into `document_versions` on new upload, wrapped in `prisma.$transaction`. `Document.version_number` tracks the current count.
- Template model: `Document_Template` with soft-delete via `deleted_at`; unique `name`; optional `content` (text) or `document_id` (binary template); `TemplateCategory` enum in `domain/enum/document.enum.ts`.
- Soft-delete: `Document` uses `deleted_at` only (aligned with the `User` model and CLAUDE.md §5.4); the legacy `is_deleted` boolean has been removed from both schema and service.
- DTO layout matches the `user` module exactly: request DTOs (`UploadDocumentDto`, `UploadVersionDto`, Zod schemas) in `dto/request/document.request.dto.ts`; response DTOs + mappers (`DocumentResponseDto`, `DocumentVersionResponseDto`, `DocumentTemplateResponseDto`, `ServedFileDto`, `mapDocumentToResponse`, etc.) in `dto/response/document.response.dto.ts`. The service interface file contains only `IDocumentService`.

**Routes mounted by the module:**

```
/documents                                              POST    multipart   document:write
/documents/:id                                          GET                 document:read
/documents/:id                                          DELETE              document:delete
/documents/:id/download                                 GET                 document:read
/documents/by-entity/:entityType/:entityId              GET                 document:read
/documents/serve/:storedName                            GET                 document:read   — streams raw file bytes (target of LocalStorageClient.getUrl)

/documents/:id/versions                                 POST    multipart   document:write
/documents/:id/versions                                 GET                 document:read
/documents/:id/versions/:version                        GET                 document:read
/documents/:id/versions/:version/download               GET                 document:read

/documents/templates                                    POST                document:write
/documents/templates                                    GET                 document:read
/documents/templates/:id                                GET                 document:read
/documents/templates/:id                                PATCH               document:write
/documents/templates/:id                                DELETE              document:delete
```

**Not yet built:**
- AWS S3 adapter (`service/client/storage.client.ts` has only `LocalStorageClient` + `AzureBlobStorageClient` stub).
- ~~File deletion of old versions~~ — now implemented via opt-in `version_retention` system config + `DocumentService.pruneOldVersions()` + weekly background job `BG:DOCUMENT:VERSION:PRUNE:WEEKLY`.

### 2.6 Asset module — COMPLETE (backend + frontend)

Folder: `src/modules/asset/`

- `AssetService` implements the first-class asset registry backend: create, update, soft-delete, detail, paginated listing, relationships, owner/custodian attestations, source/provenance records, and audit-context links.
- Permission-based access only. Routes use granular `asset:*` permissions; roles remain seed-time permission bundles.
- Asset records support owner/custodian accountability, classification/criticality, lifecycle state, CIA ratings, source system/source ID, last-seen and last-attested dates, and flexible `metadata` stored as validated JSON string (`NVARCHAR(MAX)`).
- Attestation enforces both `asset:attest` and business ownership: the actor must be owner, custodian, or hold `asset:admin`.
- Sensitive fields (`criticality`, CIA ratings, data classification, lifecycle state, source fields) require `asset:admin` when updating.
- Asset relationships support dependency/hosting/data-flow style links (`depends_on`, `runs_on`, `stores_data_in`, `protected_by`, etc.).
- Asset source/provenance records prepare for future read-only integrations with Dynafin, IMOC, Active Directory, Project Plus, Shared Drive, or a GBB CMDB.
- Audit integration is implemented through link tables, not by replacing `audit_universe`: assets can link to audit universe entities, audit engagements, findings, risk-register records, and evidence.
- Every mutation logs through Winston and `auditLogService.logAsync(...)`.
- Frontend registry is implemented at `/assets` with search, filters, pagination, create/edit/delete actions, and permission-aware controls.
- Frontend detail workspace is implemented at `/assets/:id` with overview, relationships, attestations, sources, and audit-context tabs.
- Audit engagement detail includes an Assets tab that lists linked assets and supports engagement-scope link/unlink actions when the user has `asset:link`.

**Routes mounted by the module:**

```
/assets                                      GET     asset:read
/assets                                      POST    asset:create
/assets/:id                                  GET     asset:read
/assets/:id                                  PATCH   asset:update
/assets/:id                                  DELETE  asset:delete

/assets/:id/relationships                    GET     asset:read
/assets/:id/relationships                    POST    asset:update
/assets/:id/relationships/:relationshipId    DELETE  asset:update

/assets/:id/attestations                     GET     asset:read
/assets/:id/attest                           POST    asset:attest

/assets/:id/sources                          GET     asset:read
/assets/:id/sources                          POST    asset:admin

/assets/:id/audit-context                    GET     asset:read
/assets/:id/universe/:universeId             POST    asset:link
/assets/:id/universe/:universeId             DELETE  asset:link
/assets/:id/findings/:findingId              POST    asset:link
/assets/:id/findings/:findingId              DELETE  asset:link
/assets/:id/risks/:riskId                    POST    asset:link
/assets/:id/risks/:riskId                    DELETE  asset:link
/assets/:id/evidence/:evidenceId             POST    asset:link
/assets/:id/evidence/:evidenceId             DELETE  asset:link

/audit/universe/:id/assets                   GET     asset:read
/audit/engagements/:id/assets                GET     asset:read
/audit/engagements/:id/assets                POST    asset:link
/audit/engagements/:id/assets/:assetId       DELETE  asset:link
```

**Seeded asset permissions:** `asset:read`, `asset:create`, `asset:update`, `asset:delete`, `asset:admin`, `asset:attest`, `asset:import`, `asset:link`, `asset:export`.

**Not yet built:**
- CSV/import workflow and external read-only adapter implementations.
- Dashboard asset analytics cards.
- Report-generation inclusion of "Assets in Scope".

### 2.7 Background module — COMPLETE HTTP/control plane, PARTIAL job catalogue

Folder: `src/modules/background/`

- `SchedulerService` — wraps `node-cron`. Persists job definitions to `scheduled_jobs` and every run to `scheduled_job_runs`. Exposes `register({...})`, `startAll()`, `stopAll()`.
- **Job key convention:** `BG:<MODULE>:<ACTION>:<FREQUENCY>`.
- `BackgroundJobController` + `createBackgroundModule()` - mounted at `/api/v1/jobs` with list/detail/run-history and enable/disable routes.
- Notification queue processing is registered as `BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE` and runs every minute.
- Local database snapshot as of 2026-05-01 has 5 registered jobs and 303 recorded job runs. `BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE`, `BG:TOKEN:CLEANUP:HOURLY`, and `BG:WORKFLOW:ESCALATION:HOURLY` have successful last runs.
- Registered jobs (via `registerAllJobs()`):
  - `BG:TOKEN:CLEANUP:HOURLY` — deletes expired / revoked refresh tokens. **Working.**
  - `BG:AUDIT:REMINDER:DAILY` — sends in-app + email reminders for audit engagements with SLA deadlines within 3 days. **Working.**
  - `BG:WORKFLOW:ESCALATION:HOURLY` — calls `workflowEscalationService.checkAndEscalate()` every hour for breached engagement SLAs and stalled approvals. **Working logic; runtime depends on database connectivity.**
  - `BG:LOG:ARCHIVE:WEEKLY` — pulls audit logs older than 90 days. **Partially working** — reads logs, does not yet push to data warehouse (TODO).
  - `BG:DOCUMENT:VERSION:PRUNE:WEEKLY` — calls `DocumentService.pruneOldVersions()` every Sunday at 03:00. Reads `version_retention` from `system_config`; no-op when disabled (default). **Working.**

**Routes mounted by the module:**

```
/jobs                         GET     job:read
/jobs/:id                     GET     job:read
/jobs/:id/runs                GET     job:read
/jobs/:id/enable              POST    job:admin
/jobs/:id/disable             POST    job:admin
```

**Not yet built:**
- Migration sub-module (bulk import of legacy audit spreadsheets).
- Jobs sub-module (bulk processing + report generation).

### 2.8 Audit module — COMPLETE (services + HTTP routes)

Folder: `src/modules/audit/`

- `createAuditModule()` is mounted under `/api/v1` and exposes the full audit lifecycle routes: universe, planning, engagements, working papers, evidence, findings, reports, follow-up, and checklists.
- Services enforce the local lifecycle rules and delegate plan / working-paper / report approvals to Workflow:
  - Engagement transitions: `planned -> in_progress -> under_review -> reported -> closed`.
  - Finding transitions: `open -> management_response_received -> in_remediation -> verified -> closed`.
  - Working paper review flow: `draft/rejected -> submitted`, then Workflow approval updates `approved/rejected`.
  - Report flow includes `rejected` in code because the requested workflow needs it, although the schema comment omitted it; rejection reason is now persisted directly on `audit_reports.rejection_reason` (migration `20260428085630_add_rejection_reason_to_audit_reports`) and mirrored on `workflow_approvals.rejection_reason`.
- Checklist default control sets are defined for IT, Financial, Compliance, and Systems audit types.
- State-changing service methods call `auditLogService.logAsync(...)`.
- Workflow owns approval notifications for plan/report submissions, rejections, and working-paper review. Audit queues report-issue and remediation-verification notifications through Messaging.
- Evidence upload and working-paper snapshots delegate file storage to `DocumentService.upload(...)`.
- Working-paper/report export returns a `.docx`-typed buffer using template content plus populated data, rendered via the shared `docx-template.utility.ts`. Two default DOCX templates (`Working Paper - GBB Default`, `Audit Report - GBB Default`) are seeded into `document_templates` from `prisma/templates/`.
- Working-paper export (`GET /audit/working-papers/:id/export?format=docx|pdf`) lets any user with `working_paper:read` download an **approved** working paper as DOCX (default, via the seeded template) or PDF (rendered from working-paper sections via puppeteer in `working-paper.utility.ts`). Non-approved papers return `400`; an unknown `format` returns `400`.
- Working-paper import preview accepts uploaded DOCX, XLS/XLSX, PDF, TXT/CSV, and Markdown files, stores the source file through DocumentService, maps extracted content into the selected/default working-paper template, and returns a reviewable draft preview before creating the working paper.
- Working papers now persist optional template linkage, source document linkage, working-paper type, and import metadata for traceability.
- Engagement status transitions now enforce configurable lifecycle gates from `system_config.audit_lifecycle_rules`: checklist completion and approved working papers before review, issued reports before reported status, and verified/closed findings before closure.
- Engagement checklist population now reads admin-configurable control templates from `system_config.checklist_templates`, with code defaults as fallback.
- Report generation accepts optional report body fields (`executiveSummary`, `scope`, `methodology`) and falls back to generated defaults when omitted. DOCX/PDF report output now reads template header, footer, signature, classification, and colour configuration from the selected/default report template.
- Audit plans now support draft-only update and soft delete via backend routes, matching the frontend client surface.
- Findings and reports now have global list/detail HTTP routes (`GET /audit/findings`, `GET /audit/reports`, `GET /audit/reports/:id`) so managers can review consolidated registers without selecting one engagement first.
- Follow-up remediation evidence now supports both linking an existing evidence record and direct auditee upload through `POST /audit/findings/:id/followup/evidence/upload`; uploaded files are stored through DocumentService, recorded as Audit Evidence, and linked to the follow-up.
- The Audit frontend uses the global findings/report routes, aligns Universe and Plan update calls with backend `PUT` routes, and shows report approval actions to the current Workflow approver instead of only users with `report:approve`.

**Verification:**
- `npm run build` passes.
- Full backend smoke test completed on 2026-05-01 against the local SQL Server database. Verified end-to-end path: login/RBAC, risk category/register/assessment, audit universe, audit plan + approval, engagement creation, assignment, checklist creation/testing, working-paper submission/approval/export, finding lifecycle, report generation/submission/three-level approval/issue/export, follow-up creation, notifications, email logs, queue processing, and scheduled job runs.
- Smoke-test data currently includes 1 audit universe item, 2 audit plans, 2 plan items, 1 engagement, 1 working paper, 1 finding, 1 issued report, 1 follow-up, 3 checklist rows, 1 risk category, 1 risk, 1 risk assessment, 3 workflow approvals, 5 approval steps, 1 assignment, 15 in-app notifications, 13 email logs, 18 sent queue rows, 5 scheduled jobs, 303 scheduled job runs, and 145 audit-log rows.
- Smoke-test bug fixes completed: nullable `users.azure_oid` is no longer unique so multiple local users can exist without Azure IDs; role/permission listing endpoints were added for RBAC setup; plan-derived engagements now take `universeId`, `auditType`, and `priority` from the plan item instead of requiring duplicate request fields; report generation now accepts the request body; plan/report approval creation is transactional with the parent status update; approval-required notifications are queued after transaction commit; submitted reports without an approval can be resubmitted once to repair the missing approval; all audit/workflow/background notification send paths now enqueue work instead of blocking on SMTP; Director and CAE seeded roles can approve reports via `audit:write`; Prisma seed command is registered in `prisma.config.ts`; document template content is widened to `NVARCHAR(max)` so seeded DOCX XML templates fit.

### 2.9 Risk module — COMPLETE (services + HTTP routes)

Folder: `src/modules/risk/`

- `createRiskModule()` is mounted under `/api/v1` and exposes categories, register, assessments, and monitoring routes.
- Categories support create, update, deactivate, and authenticated listing with `is_active` filtering.
- Register supports create, update, status update, soft-delete, paginated listing, single-risk lookup with latest assessment, and universe-linked risk lookup.
- Assessments are immutable snapshots; creation calculates `score = likelihood * impact`.
- Assessment creation uses a single Prisma transaction to create the assessment, update the parent risk, and update linked `audit_universe.risk_score` when a linked universe entity exists.
- Monitoring supports high-risk listing, stale high/critical risks requiring attention, score trends, and organization summary by band/status.
- Audit Universe bridge is wired: `UniverseService.getEntityById()` calls the Risk register service to return linked risks for the universe entity.
- State-changing service methods call `auditLogService.logAsync(...)`.

**Routes mounted by the module:**

```
/risk/categories                                  POST    audit:write
/risk/categories                                  GET     audit:read
/risk/categories/:id                              PUT     audit:write
/risk/categories/:id                              DELETE  audit:write

/risk/register                                    POST    audit:write
/risk/register                                    GET     audit:read
/risk/register/:id                                GET     audit:read
/risk/register/:id                                PUT     audit:write
/risk/register/:id/status                         PATCH   audit:write
/risk/register/:id                                DELETE  audit:delete
/risk/register/universe/:universeId               GET     audit:read

/risk/register/:id/assessments                    POST    audit:write
/risk/register/:id/assessments                    GET     audit:read
/risk/assessments/:id                             GET     audit:read
/risk/register/:id/assessments/latest             GET     audit:read
/risk/register/:id/trend                          GET     audit:read

/risk/monitoring/high-risk                        GET     audit:read
/risk/monitoring/attention-required               GET     audit:read
/risk/monitoring/summary                          GET     audit:read
```

### 2.10 Workflow module — COMPLETE (services + HTTP routes)

Folder: `src/modules/workflow/`

- Approval service creates ordered approval chains for audit plans, working papers, and reports; validates current-level approvers; advances or rejects approval chains; updates the underlying audit entity status when approval completes or rejects.
- Approval creation can run inside a caller-owned Prisma transaction so plan/report status changes and approval records commit together. Approval notifications are queued after commit to avoid orphaned or missing workflow state.
- Assignment service assigns and removes engagement staff, lists engagement/user assignments, returns active workload grouped by engagement status, and queues in-app/email assignment notifications through Messaging.
- Escalation service checks overdue engagements and stalled approvals, escalates levels 1-4, queues in-app/email notifications through Messaging, and persists immutable escalation history.
- Escalation policies are configurable per audit type (`it`, `financial`, `compliance`, `systems`, `all`) and use defaults in the checker when no DB policy exists yet.
- Audit trail logging is wired via `auditLogService.logAsync(...)` for approval, assignment, escalation, and policy state changes.

**Routes mounted by the module:**

```
/workflow/approvals/pending                       GET     audit:read
/workflow/approvals/:id                           GET     audit:read
/workflow/approvals/entity/:type/:id              GET     audit:read
/workflow/approvals/:id/approve                   POST    audit:write
/workflow/approvals/:id/reject                    POST    audit:write
/workflow/approvals/:id/cancel                    POST    audit:admin

/workflow/assignments                             POST    audit:write
/workflow/assignments/engagement/:id              GET     audit:read
/workflow/assignments/mine                        GET     audit:read
/workflow/assignments/workload/:userId            GET     audit:read
/workflow/assignments/candidates/:engagementId    GET     assignment:read  — un-assigned users with skills + workload
/workflow/assignments/:id                         DELETE  audit:write

/workflow/escalations/entity/:type/:id            GET     audit:read
/workflow/escalations/:id/acknowledge             POST    audit:write
/workflow/escalation-policy                       GET     audit:read
/workflow/escalation-policy                       POST    audit:admin
```

**Known decisions / gaps:**
- **Ad-hoc requests now produce visible signed PDFs (e-signature, feature #1 of 3).** Each user sets up one active signature in **Settings → My Signature** (draw on canvas or upload PNG/JPG ≤ 2 MB), stored via the document module (`user_signatures` table, soft-delete, one active per user). On **Sign**, the request service records the active signature's id on the action (`workflow_request_actions.signature_id`) in addition to the existing SHA-256 manifest hash. When a request **completes**, `SignedDocumentService.generateForCompletedRequest()` fires (fire-and-forget, outside the txn): for each **PDF** attachment it appends a signature page (pdf-lib) stamping each signer's image + approvers + an integrity block (manifest + per-file SHA-256), stores the copy as a new Document (uploaded as the request **initiator**), and maps it via `workflow_request_signed_documents`. No attachment → a standalone certificate PDF. Per-attachment try/catch isolates corrupt PDFs; non-PDF attachments are skipped (Word→PDF conversion is feature #2). New route: `GET /workflow/requests/:id/signed-documents` (`request:read`). Self-service signature routes: `GET/POST/DELETE /settings/signature`. New dep: `pdf-lib`. Migration: `20260617120000_add_request_esignature`. Originals are never modified; the manifest-hash "Verify signatures" flow is unchanged.
- **Approvals are now "Approve & Sign" (e-signature, feature #4).** Every `Workflow_Approval` approve records the approver's active signature on the step (`workflow_approval_steps.signature_id` → `user_signatures`, reused from the request e-signature feature; recorded for all entity types: plan, working paper, report, finding closure). On **final-level** approval, `ApprovalSignedDocumentService` (`src/modules/audit/approval-signature/`) fires fire-and-forget (post-commit, via dynamic import to avoid the audit↔workflow cycle) and **freezes** an immutable signed artifact: audit **reports** and **working papers** regenerate their PDF with each approver's signature embedded in the signature block (report also embeds in DOCX); **plans** and **finding closures** get a standalone certificate PDF (`buildCertificatePdf`). The signed copy is stored as a new Document (uploaded as the approval submitter) and mapped via `workflow_approval_signed_documents`. New route: `GET /workflow/approvals/:id/signed-documents` (`approval:read`). Frontend: the approvals inbox and report tab use an "Approve & Sign" panel (inline signature setup; signature **required** for reports & working papers, optional for plans/finding closures); the report tab shows the signed-document download. Migration: `20260617130000_add_approval_esignature`. Reject is unchanged (no signature).
- Level 3 escalations notify users with the seeded `director` role; Level 4 escalations notify users with the seeded `cae` role. Both roles ship in `prisma/seed.ts`.
- Audit report rejection reason is stored on both `audit_reports.rejection_reason` and `workflow_approvals.rejection_reason` for audit-side and workflow-side reads respectively.
- Local smoke-test approvals as of 2026-05-01: audit plan approved, audit working paper approved, and audit report approved through all three levels (audit manager -> director -> CAE).

### 2.11 Dashboard module — COMPLETE (services + HTTP routes)

Folder: `src/modules/dashboard/`

- `DashboardService` (singleton export: `dashboardService`) — pure read aggregator; queries data already owned by the Audit, Risk, Workflow, and Logging modules; no new tables, no writes. Methods:
  - `getAuditSummary(actor)` — engagement counts this year, status breakdown, overdue / due-soon counts, completion rate, plan counts.
  - `getFindingsSummary(actor)` — total open, severity / status breakdowns, overdue, average days to close (raw `DATEDIFF` SQL), resolved this month.
  - `getRiskOverview(actor)` — total risks, score-band breakdown (critical 20-25 / high 13-19 / medium 6-12 / low 1-5), status breakdown, top five risks with category + owner names, stale risk count (90-day cutoff).
  - `getRecentActivity(actor, limit)` — last N audit-log entries scoped to modules audit / workflow / risk / document / user.
  - `getEscalationOverview(actor)` — count of active escalations (engagement still open or approval still pending), level breakdown, recent 10.
  - `getMyWork(userId)` — current user's active engagements, current-level pending approval steps, overdue engagements, findings in remediation on engagements they lead.
  - `getApprovalInboxSummary(userId)` — current-level pending approval-step count for the caller plus oldest-pending days.
- Role-aware filtering enforced in the service: `super_admin` / `audit_admin` / `director` / `cae` see everything; `audit_lead` / `auditor` see only engagements / activity / escalations they lead; `auditee` sees only findings against them.
- `DashboardController` + `createDashboardModule()` — mounted at `/api/v1/dashboard`.

**Routes mounted by the module:**

```
/dashboard/summary               GET     audit:read     — audit programme summary
/dashboard/findings              GET     finding:read   — findings summary
/dashboard/risks                 GET     audit:read     — risk overview + top 5
/dashboard/activity              GET     audit:read     — recent audit-trail entries (limit ≤ 50)
/dashboard/escalations           GET     audit:read     — active escalations + breakdown
/dashboard/my-work               GET     audit:read     — caller's personal work bundle
/dashboard/approval-inbox        GET     audit:read     — caller's approval inbox summary
```

### 2.12 Settings module - COMPLETE

Folder: `src/modules/settings/`

- `createSettingsModule()` owns the `/api/v1/settings/*` URL space and preserves Phase 1 role/permission administration by wiring the existing user service/controller.
- `WorkingPaperTemplateService` supports create, update, deactivate, set-default-per-audit-type, default lookup by audit type, single lookup, and paginated listing filtered by `audit_type` and `is_active`.
- `ReportTemplateService` supports create, update, deactivate, single system default, default lookup, available-variable lookup from the default template, single lookup, and paginated listing filtered by `is_active`.
- `SystemConfigService` supports private/public config reads, single-key update, and transactional bulk update.
- SQL Server does not support Prisma `Json`, so template JSON payloads are validated at the API boundary and stored as `NVARCHAR(MAX)` JSON strings, matching the existing metadata/audit-log convention.
- Seeded defaults: 11 working paper templates (financial, IT, compliance, systems, general, walkthrough, control test, sampling, ITGC, finding validation, follow-up verification), 5 report templates, and 16 system config keys.
- Admin customization now includes JSON-backed lifecycle gates, SLA rules, checklist templates, approval matrix documentation, audit taxonomy, and analytics KPI visibility through the Settings UI.

**Routes mounted by the module:**

```
/settings/roles                                      GET     settings:read
/settings/roles/:id                                  GET     settings:read
/settings/roles                                      POST    settings:manage
/settings/roles/:id                                  PUT     settings:manage
/settings/roles/:id                                  DELETE  settings:manage
/settings/roles/:id/permissions                      PUT     settings:manage
/settings/permissions                                GET     settings:read

/settings/working-paper-templates                    GET     settings:read
/settings/working-paper-templates/default/:auditType GET     settings:read
/settings/working-paper-templates/:id                GET     settings:read
/settings/working-paper-templates                    POST    settings:manage
/settings/working-paper-templates/:id                PUT     settings:manage
/settings/working-paper-templates/:id/set-default    POST    settings:manage
/settings/working-paper-templates/:id                DELETE  settings:manage

/settings/report-templates                           GET     settings:read
/settings/report-templates/default                   GET     settings:read
/settings/report-templates/variables                 GET     settings:read
/settings/report-templates/:id                       GET     settings:read
/settings/report-templates                           POST    settings:manage
/settings/report-templates/:id                       PUT     settings:manage
/settings/report-templates/:id/set-default           POST    settings:manage
/settings/report-templates/:id                       DELETE  settings:manage

/settings/config                                     GET     settings:read
/settings/config/public                              GET     authenticated
/settings/config/:key                                GET     settings:read
/settings/config/:key                                PUT     settings:manage
/settings/config/bulk-update                         POST    settings:manage
```

### 2.13 Database schema

`prisma/schema.prisma` — targets SQL Server.

**Models present:**

| Table | Purpose |
|---|---|
| `users` | Core user record. Supports SSO-only (`password_hash` nullable) + local. Soft-delete via `deleted_at`. 2FA columns: `mfa_enabled`, `mfa_method`, `mfa_totp_secret` (AES-256-GCM encrypted), `mfa_enrolled_at`. |
| `password_reset_tokens` | Single-use sha256-hashed reset tokens with `expires_at` / `used_at` / `ip_address`. Indexed on `user_id`. |
| `mfa_backup_codes` | Single-use 2FA recovery codes (bcrypt-hashed), `used_at`. Indexed on `user_id`. |
| `mfa_email_otps` | Email 2FA one-time codes (sha256-hashed), `expires_at` / `consumed_at` / `attempts` (capped). Indexed on `user_id`. |
| `roles` | Named roles. `is_system` flag for seeded roles. |
| `permissions` | `<module>:<action>` granular permissions. |
| `user_roles` | Join. Supports optional `expires_at` for time-bound role assignments. |
| `role_permissions` | Join. |
| `refresh_tokens` | Hashed refresh tokens with `ip_address`, `user_agent`, `revoked_at`. |
| `audit_logs` | Tamper-evident action log. Indexed on `user_id`, `module`, `created_at`. |
| `notifications` | In-app notifications. Indexed on `(user_id, is_read)`. |
| `email_logs` | Email audit trail. |
| `notification_queue` | Reliable queued email/in-app notification work. Indexed on `(status, scheduled_at)`. |
| `notification_templates` | DB-driven email/in-app notification templates. Unique `(event_key, channel)`. Indexed on `event_key`, `channel`, `is_active`. Soft-delete via `deleted_at`. |
| `documents` | File metadata. `storage_path` points to the provider-specific key. Soft-delete via `deleted_at`. Indexed on `(entity_type, entity_id)`. |
| `document_versions` | Historical version snapshots. Unique on `(document_id, version_number)`. Current version lives on `documents`, not here. |
| `document_templates` | Named reusable templates (working paper / audit report / finding / etc.). Soft-delete via `deleted_at`. Unique `name`. |
| `assets` | Asset registry records with ownership, classification, lifecycle, CIA ratings, source/provenance, last-seen/last-attested dates, and soft-delete. |
| `asset_relationships` | Directed asset dependency/relationship records, unique by source + target + relationship type. |
| `asset_attestations` | Owner/custodian/admin attestations with immutable JSON snapshots of the confirmed asset state. |
| `asset_sources` | Source-system provenance records for future read-only imports/syncs. |
| `audit_universe_assets` | Many-to-many links between asset registry records and auditable universe entities. |
| `audit_engagement_assets` | Asset scope records for audit engagements, with scope role/reason. |
| `audit_finding_assets` | Affected-asset links for audit findings, with optional impact summary. |
| `risk_asset_links` | Links between enterprise risks and affected/supporting assets. |
| `audit_evidence_assets` | Links between audit evidence and assets. |
| `scheduled_jobs` | Background job catalogue + last-run status. |
| `scheduled_job_runs` | Per-execution history. |
| `working_paper_templates` | Settings-managed working paper section templates. JSON sections stored as `NVARCHAR(MAX)`. One default enforced per audit type by service transaction. |
| `report_templates` | Settings-managed audit report templates with section/header/footer/signature/variable JSON stored as `NVARCHAR(MAX)`. One default enforced by service transaction. |
| `system_config` | Key/value system configuration with public/private visibility and updater tracking. |

**Audit module — schema complete, migrated `20260427083830_add_audit_module_tables`, application services/controllers/routes built:**

| Table | Purpose |
|---|---|
| `audit_universe` | Auditable entities (departments / systems / processes / assets / projects). Risk-scored, owner-assigned, frequency-driven. |
| `audit_plans` | Annual plan headers. Status: `draft → submitted → approved/rejected`. |
| `audit_plan_items` | Line items inside a plan, each tied to a universe entry. `engagement_created` flag tracks rollover. |
| `audit_engagements` | Active audit instances. Reference number, lead/manager/auditee triplet, SLA deadline, ad-hoc support. |
| `audit_working_papers` | Versioned working papers per engagement. Status: `draft → submitted → approved/rejected`. Optional links to a working-paper template and uploaded source document support import traceability. |
| `audit_evidence` | Files supporting an engagement / working paper / finding. Wraps `Document`, supports dispute. |
| `audit_findings` | Issues raised. Category × severity × status workflow ending in `closed`. Each has a single follow-up. |
| `audit_reports` | One per engagement (`engagement_id` is `@unique`). Status: `draft → submitted → approved → issued`. Includes `rejection_reason` (NVarChar(Max)) for rejected submissions. |
| `audit_follow_ups` | Management response + remediation evidence + verification per finding. |
| `audit_checklists` | Control test register per engagement (control reference, test procedure, pass/fail/n_a/not_tested). |

Schema includes:
- Audit-side back-relations on `User` (18 named relations covering owner / created_by / approved_by / lead / manager / auditee / reviewer / closed_by / verified_by / tested_by / etc.).
- `Document.evidence` and `Document.reports` back-relations to `Audit_Evidence` and `Audit_Report`.
- Enum-like fields modelled as `String` with allowed values listed inline (SQL Server has no native enums); mirrored in `src/modules/audit/domain/enum/audit.enum.ts`.
- `@db.NVarChar(Max)` on long-text columns (descriptions, root cause, recommendations, executive summary, etc.).
- `onUpdate: NoAction, onDelete: NoAction` on every audit-side FK to avoid SQL Server's "multiple cascade paths" error.
- Indexes on every FK + status / severity / due_date / SLA / category / reference_number lookup column.

**Risk module — schema complete, migrated `20260427141955_add_risk_module_tables`, application services/controllers/routes built:**

| Table | Purpose |
|---|---|
| `risk_categories` | Active/deactivated lookup categories for enterprise risks. |
| `risk_register` | Master list of risks with owner, category, status, current score, and optional audit-universe link. |
| `risk_assessments` | Immutable historical assessment snapshots with likelihood, impact, calculated score, assessor, and assessment date. |

Risk schema includes:
- Risk-side back-relations on `User` for category creator, risk owner, risk creator, and assessor.
- `Audit_Universe.risks` back-relation to support universe-linked risks.
- Enum-like fields modelled as `String`; mirrored in `src/modules/risk/domain/enum/risk.enum.ts`.
- `@db.NVarChar(Max)` on long-text risk and assessment notes fields.
- `onUpdate: NoAction, onDelete: NoAction` on every risk-side FK.
- Indexes on category, owner, status, score, universe, assessed-by, assessed-at, and assessment score lookup columns.

**Workflow module — schema complete, migrated `20260427170000_add_workflow_module_tables`, application services/controllers/routes built:**

| Table | Purpose |
|---|---|
| `workflow_approvals` | Header record for approval instances against audit plans, working papers, and reports. |
| `workflow_approval_steps` | Immutable ordered approver steps for each approval chain. |
| `workflow_assignments` | Immutable staff assignment records for audit engagements. |
| `workflow_escalations` | Immutable escalation event history for engagements and approvals. |
| `escalation_policies` | Configurable escalation wait times per audit type. |

Workflow schema includes:
- Workflow-side back-relations on `User` for submitter, approver, assignee, assigner, escalation target, and policy creator.
- `Audit_Engagement.workflow_assignments` back-relation.
- Enum-like fields modelled as `String`; mirrored in `src/modules/workflow/domain/enum/workflow.enum.ts`.
- `@db.NVarChar(Max)` on approval rejection/comment fields.
- `onUpdate: NoAction, onDelete: NoAction` on every workflow-side FK.
- Indexes on entity type/id, status, level, assignment role, escalation level/target, and policy active/audit-type lookup columns.

**Conventions observed:**
- UUID primary keys (`@default(uuid())`).
- snake_case columns + `@@map("snake_case")` tables.
- Notification queue migration added via `prisma/migrations/20260430111912_add_notification_queue/`.
- Document template content widened to `NVARCHAR(max)` via `prisma/migrations/20260430170000_widen_document_template_content/` so seeded DOCX XML templates fit.
- Notification templates table added via `prisma/migrations/20260501191923_add_notification_templates/`.
- Settings tables added via `prisma/migrations/20260511083936_add_settings_module_tables/`.
- Soft-delete via `deleted_at` on `users`, `documents`, `document_templates` (other mutable tables will follow the same pattern). No module uses an `is_deleted` boolean.
- Migrations baselined at `prisma/migrations/20260421000000_init/` (14 base tables) and marked applied via `prisma migrate resolve`. Audit-module tables added via `prisma/migrations/20260427083830_add_audit_module_tables/` (10 tables, 35 FKs, all `NO ACTION`). Risk-module tables added via `prisma/migrations/20260427141955_add_risk_module_tables/` (3 tables, 7 FKs, all `NO ACTION`). Workflow-module tables added via `prisma/migrations/20260427170000_add_workflow_module_tables/` (5 tables, 8 FKs, all `NO ACTION`). `audit_reports.rejection_reason` added via `prisma/migrations/20260428085630_add_rejection_reason_to_audit_reports/`. `migration_lock.toml` pins `provider = "mssql"`. All future schema changes go through `prisma migrate dev` — no more `db push`. Drift for the pre-existing `audit_plans.description` column is recorded by `prisma/migrations/20260611120000_add_audit_plan_description/`. Password reset and MFA tables/columns are migrated by `prisma/migrations/20260611120533_add_password_reset_and_mfa/`.

---

### 2.14 Application entry point — COMPLETE

`src/server.ts` is wired up. Boot order: validate config → `connectDatabase()` → build Express app → listen → `registerAllJobs()` + `schedulerService.startAll()`. Shutdown order (SIGTERM/SIGINT/uncaughtException/unhandledRejection): stop accepting connections → `schedulerService.stopAll()` → `disconnectDatabase()`, with a 10s force-exit timeout.

App wiring:
- Security + parsing: `helmet`, `cors` (origin = `config.app.url`, credentials on), `compression`, `cookie-parser`, `express.json`, `express.urlencoded`.
- Logging: `morgan` (`dev` in dev, `combined` in prod) piped into the Winston logger; `requestAuditLogger` attached globally.
- Rate limiting: `express-rate-limit` applied to the `/api/<version>` prefix.
- Routes: `GET /health`, `GET /docs.json`, `GET /docs` (Swagger UI via `buildOpenApiDocument()`), then `createUserModule()`, `createDocumentModule()`, `createAuditModule()`, `createRiskModule()`, `createWorkflowModule()`, `createMessagingModule()`, `createLoggingModule()`, `createBackgroundModule()`, `createDashboardModule()`, and `createSettingsModule()` mounted under `/api/<version>`.
- Tail middleware: `notFoundMiddleware`, `errorHandlerMiddleware`.

---

## 3. Current local database snapshot

Snapshot queried on 2026-05-01 after the full smoke test:

| Area | Current state |
|---|---|
| Users/RBAC | 5 active users, 8 roles, 20 permissions |
| Audit | 1 universe item, 2 plans, 2 plan items, 1 engagement, 1 working paper, 1 finding, 1 issued report, 1 follow-up, 3 checklist rows |
| Risk | 1 category, 1 risk register item, 1 assessment |
| Workflow | 3 approvals, 5 approval steps, 1 assignment, 0 escalations, 0 custom escalation policies |
| Messaging | 15 in-app notifications, 13 email logs, 18 notification-queue rows, all queue rows `sent` |
| Documents | 2 seeded document templates, 0 uploaded documents, 0 document versions |
| Background/logging | 5 scheduled jobs, 303 job-run rows, 145 audit-log rows |
| Settings | 11 working paper templates, 5 report templates, 16 system config keys |

---

## 4. What is NOT yet built

### 4.1 Module routers not yet created

- _None._ Every built module now mounts an HTTP router under `/api/v1`.

### 4.2 Modules entirely missing

- `integration/` — **partially built (rev 31):** Azure AD (Entra) directory sync — group→role mapping (backend + Settings → Directory frontend tab), Graph client, login + nightly reconcile — is done. Dynafin, IMOC, Project Plus, and Shared Drive adapters are still missing.
- `predictive/` — risk model, anomaly detection, NLP.

### 4.3 Tests

- Jest is installed. Zero automated tests are written; `__tests__/` directories do not exist.
- Manual/API smoke testing was completed on 2026-05-01 and drove the fixes listed in the Audit module verification section.

### 4.4 Frontend

- Next.js frontend is scaffolded and active for dashboard, audit, risk, workflow, documents, logs, notifications, users, and settings workflows. Asset registry screens are not built yet. Integration and predictive pages remain placeholders.

---


## 5. Rules of engagement for future sessions

1. **Open `CLAUDE.md` first** — it states the non-negotiables.
2. **Update this file** after each work session — add new rows to the built / gaps tables.
3. **Do not build dependent modules before their dependencies.** See `CLAUDE.md` §6 build order.
4. **Do not diverge from the `user` module's folder layout or conventions** without flagging it to Wole.
5. **All external integrations are read-only.** No code ever writes back to Dynafin / IMOC / AD / Project Plus / Shared Drive.

---

## 6. Team

| Name | Role |
|---|---|
| Wole | Lead + Fullstack — owns architecture calls |
| Ridwan | Fullstack |
| Joseph | Fullstack |

---

## 7. Tech reference (quick lookup)

| Question | Answer |
|---|---|
| How do I issue an HTTP response? | `res.status(X).json(buildResponse(data, message))` |
| How do I throw an error? | `throw AppError.notFound('User')` or similar factory |
| How do I validate input? | `validate(MyZodSchema)` middleware, then read `req.body` typed as `z.infer<typeof MyZodSchema>` |
| How do I protect a route? | `authenticate, requirePermission('module:action')` |
| How do I access the DB? | `import { prisma } from '@shared/prisma/prisma.client'` |
| How do I log to the audit trail? | `auditLogService.logAsync({ ... })` — don't `await` unless you must |
| How do I send an email? | `notificationService.sendEmail({ to, subject, html, text })` |
| How do I register a background job? | Add a `schedulerService.register({...})` call inside `registerAllJobs()` with a `BG:<MODULE>:<ACTION>:<FREQUENCY>` key |
| Where does a new module go? | `src/modules/<name>/` — copy the `user` module's folder layout exactly |
