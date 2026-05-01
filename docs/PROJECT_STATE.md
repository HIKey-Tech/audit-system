# IAMS — Project State

> Living snapshot of what has been built, what is stubbed, and what is next.
> **Update this file every time a module gains or loses capability.**
> Last updated: 2026-04-30 (rev 11)

---

## 1. One-line status

Foundation, User module, Document module, Audit module HTTP/services, Risk module HTTP/services, Workflow module HTTP/services, Messaging module (in-app notification HTTP/services + reliable notification queue), Background module HTTP/services, and app entry point (`server.ts`) are complete and production-shaped. Logging still exists as service-only scaffolding. Integration, Dashboard, Predictive, and the Next.js frontend are **not started**.

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
| JIT provisioning on first SSO login | Done | `user.service.ts#syncFromAzureAd` — creates user with default `viewer` role |
| User CRUD + soft-delete | Done | `controller/user.controller.ts`, `service/implementation/user.service.ts` |
| Self-service profile (`/users/me`, `/users/me/change-password`) | Done | `user.controller.ts` |
| Role assignment / removal | Done | `user.service.ts#assignRoles`, `#removeRole` |
| RBAC seed (8 roles, 20 permissions) | Done | `prisma/seed.ts` — `director` and `cae` include `audit:write` for audit report approval |
| Module factory | Done | `modules/user/index.ts` — `createUserModule(): Router` |

**Routes mounted by the module:**

```
/auth/login          POST   public
/auth/sso            GET    public   — returns Azure/OIDC authorization URL
/auth/callback       GET    public   — OIDC code exchange
/auth/refresh        POST   public
/auth/logout         POST   private
/auth/logout-all     POST   private

/users/me                     GET     private
/users/me                     PATCH   private
/users/me/change-password     POST    private
/users                        GET     user:read
/users                        POST    user:write
/users/:id                    GET     user:read
/users/:id                    PATCH   user:write
/users/:id                    DELETE  user:delete
/users/:id/roles              PUT     user:admin
/users/:id/roles/:roleId      DELETE  user:admin
```

**Permission catalogue (from seed):** `user:*`, `audit:*`, `finding:*`, `document:*`, `notification:read`, `log:*`, `job:*`, `predictive:*`.

**Roles:** `super_admin`, `audit_admin`, `audit_lead`, `auditor`, `director`, `cae`, `auditee`, `viewer`.

### 2.3 Logging module — COMPLETE (service-only)

Folder: `src/modules/logging/`

- `AuditLogService` (singleton export: `auditLogService`) — persists to `audit_logs`. Two methods:
  - `log(dto)` — awaited. Swallows internal errors so logging never crashes the app.
  - `logAsync(dto)` — fire-and-forget.
- `requestAuditLogger` middleware — drops into Express. Auto-logs every **mutating** request (POST/PUT/PATCH/DELETE) after the response is sent, including `userId`, `action`, `module` (derived from path), `status`, `durationMs`.

**Not yet built:**
- System-log persistence (application errors / warnings → DB).
- Warehouse pipeline (the module description calls for a feed to the data warehouse that trains the Predictive module).
- HTTP routes to read the audit trail (log viewer endpoints).

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
- `NotificationController` + `createMessagingModule()` — mounted at `/api/v1/notifications`.

**Routes mounted by the module:**

```
/notifications                                    GET     notification:read
/notifications/queue/stats                        GET     notification:read
/notifications/unread-count                       GET     notification:read
/notifications/read-all                           POST    notification:read
/notifications/:id/read                           POST    notification:read
```

**Not yet built:**
- Notification templates sub-module (per event type, per escalation level).
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
- File deletion of old versions (version history today retains `storage_path` references forever).

### 2.6 Background module — PARTIAL

Folder: `src/modules/background/`

- `SchedulerService` — wraps `node-cron`. Persists job definitions to `scheduled_jobs` and every run to `scheduled_job_runs`. Exposes `register({...})`, `startAll()`, `stopAll()`.
- **Job key convention:** `BG:<MODULE>:<ACTION>:<FREQUENCY>`.
- `BackgroundJobController` + `createBackgroundModule()` - mounted at `/api/v1/jobs` with list/detail/run-history and enable/disable routes.
- Notification queue processing is registered as `BG:MESSAGING:NOTIFICATION:QUEUE:EVERY_MINUTE` and runs every minute.
- Registered jobs (via `registerAllJobs()`):
  - `BG:TOKEN:CLEANUP:HOURLY` — deletes expired / revoked refresh tokens. **Working.**
  - `BG:AUDIT:REMINDER:DAILY` — registered + cron-scheduled, but the handler is **stubbed** (logs "skipped" and returns). The original due-date query was removed; needs to be restored now that `Audit_Engagement` exists. See `scheduler.service.ts:165`.
  - `BG:WORKFLOW:ESCALATION:HOURLY` — calls `workflowEscalationService.checkAndEscalate()` every hour for breached engagement SLAs and stalled approvals. **Working logic; runtime depends on database connectivity.**
  - `BG:LOG:ARCHIVE:WEEKLY` — pulls audit logs older than 90 days. **Partially working** — reads logs, does not yet push to data warehouse (TODO).

**Not yet built:**
- Migration sub-module (bulk import of legacy audit spreadsheets).
- Jobs sub-module (bulk processing + report generation).

### 2.7 Audit module — COMPLETE (services + HTTP routes)

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

**Verification:**
- `npm run build` passes.
- `npm start` was attempted but local startup is blocked by Prisma `P1011` during database initialization in the current environment.

### 2.8 Risk module — COMPLETE (services + HTTP routes)

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

### 2.9 Workflow module — COMPLETE (services + HTTP routes)

Folder: `src/modules/workflow/`

- Approval service creates ordered approval chains for audit plans, working papers, and reports; validates current-level approvers; advances or rejects approval chains; updates the underlying audit entity status when approval completes or rejects.
- Assignment service assigns and removes engagement staff, lists engagement/user assignments, and returns active workload grouped by engagement status.
- Escalation service checks overdue engagements and stalled approvals, escalates levels 1-4, sends in-app/email notifications through Messaging, and persists immutable escalation history.
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
/workflow/assignments/:id                         DELETE  audit:write

/workflow/escalations/entity/:type/:id            GET     audit:read
/workflow/escalations/:id/acknowledge             POST    audit:write
/workflow/escalation-policy                       GET     audit:read
/workflow/escalation-policy                       POST    audit:admin
```

**Known decisions / gaps:**
- Level 3 escalations notify users with the seeded `director` role; Level 4 escalations notify users with the seeded `cae` role. Both roles ship in `prisma/seed.ts`.
- Audit report rejection reason is stored on both `audit_reports.rejection_reason` and `workflow_approvals.rejection_reason` for audit-side and workflow-side reads respectively.

### 2.10 Database schema

`prisma/schema.prisma` — targets SQL Server.

**Models present:**

| Table | Purpose |
|---|---|
| `users` | Core user record. Supports SSO-only (`password_hash` nullable) + local. Soft-delete via `deleted_at`. |
| `roles` | Named roles. `is_system` flag for seeded roles. |
| `permissions` | `<module>:<action>` granular permissions. |
| `user_roles` | Join. Supports optional `expires_at` for time-bound role assignments. |
| `role_permissions` | Join. |
| `refresh_tokens` | Hashed refresh tokens with `ip_address`, `user_agent`, `revoked_at`. |
| `audit_logs` | Tamper-evident action log. Indexed on `user_id`, `module`, `created_at`. |
| `notifications` | In-app notifications. Indexed on `(user_id, is_read)`. |
| `email_logs` | Email audit trail. |
| `notification_queue` | Reliable queued email/in-app notification work. Indexed on `(status, scheduled_at)`. |
| `documents` | File metadata. `storage_path` points to the provider-specific key. Soft-delete via `deleted_at`. Indexed on `(entity_type, entity_id)`. |
| `document_versions` | Historical version snapshots. Unique on `(document_id, version_number)`. Current version lives on `documents`, not here. |
| `document_templates` | Named reusable templates (working paper / audit report / finding / etc.). Soft-delete via `deleted_at`. Unique `name`. |
| `scheduled_jobs` | Background job catalogue + last-run status. |
| `scheduled_job_runs` | Per-execution history. |

**Audit module — schema complete, migrated `20260427083830_add_audit_module_tables`, application services/controllers/routes built:**

| Table | Purpose |
|---|---|
| `audit_universe` | Auditable entities (departments / systems / processes / assets / projects). Risk-scored, owner-assigned, frequency-driven. |
| `audit_plans` | Annual plan headers. Status: `draft → submitted → approved/rejected`. |
| `audit_plan_items` | Line items inside a plan, each tied to a universe entry. `engagement_created` flag tracks rollover. |
| `audit_engagements` | Active audit instances. Reference number, lead/manager/auditee triplet, SLA deadline, ad-hoc support. |
| `audit_working_papers` | Versioned working papers per engagement. Status: `draft → submitted → approved/rejected`. |
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
- Soft-delete via `deleted_at` on `users`, `documents`, `document_templates` (other mutable tables will follow the same pattern). No module uses an `is_deleted` boolean.
- Migrations baselined at `prisma/migrations/20260421000000_init/` (14 base tables) and marked applied via `prisma migrate resolve`. Audit-module tables added via `prisma/migrations/20260427083830_add_audit_module_tables/` (10 tables, 35 FKs, all `NO ACTION`). Risk-module tables added via `prisma/migrations/20260427141955_add_risk_module_tables/` (3 tables, 7 FKs, all `NO ACTION`). Workflow-module tables added via `prisma/migrations/20260427170000_add_workflow_module_tables/` (5 tables, 8 FKs, all `NO ACTION`). `audit_reports.rejection_reason` added via `prisma/migrations/20260428085630_add_rejection_reason_to_audit_reports/`. `migration_lock.toml` pins `provider = "mssql"`. All future schema changes go through `prisma migrate dev` — no more `db push`.

---

## 3. What is NOT yet built

### 3.1 Application entry point — COMPLETE

`src/server.ts` is wired up. Boot order: validate config → `connectDatabase()` → build Express app → listen → `registerAllJobs()` + `schedulerService.startAll()`. Shutdown order (SIGTERM/SIGINT/uncaughtException/unhandledRejection): stop accepting connections → `schedulerService.stopAll()` → `disconnectDatabase()`, with a 10s force-exit timeout.

App wiring:
- Security + parsing: `helmet`, `cors` (origin = `config.app.url`, credentials on), `compression`, `cookie-parser`, `express.json`, `express.urlencoded`.
- Logging: `morgan` (`dev` in dev, `combined` in prod) piped into the Winston logger; `requestAuditLogger` attached globally.
- Rate limiting: `express-rate-limit` applied to the `/api/<version>` prefix.
- Routes: `GET /health`, `GET /docs.json`, `GET /docs` (Swagger UI via `buildOpenApiDocument()`), then `createUserModule()`, `createDocumentModule()`, `createAuditModule()`, `createRiskModule()`, `createWorkflowModule()`, and `createMessagingModule()` mounted under `/api/<version>`.
- Tail middleware: `notFoundMiddleware`, `errorHandlerMiddleware`.

### 3.2 Module routers not yet created

- `modules/logging/index.ts` — for a future log-viewer endpoint.
- `modules/background/index.ts` — for admin job-control endpoints.

### 3.3 Modules entirely missing

- `integration/` — Dynafin, IMOC, Active Directory, Project Plus, Shared Drive adapters.
- `dashboard/` — analytics, reports, widgets.
- `predictive/` — risk model, anomaly detection, NLP.

### 3.4 Tests

- Jest is installed. Zero tests written. `__tests__/` directories do not exist.

### 3.5 Frontend

- Next.js not yet scaffolded. Not started until backend is complete (build order rule).

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
