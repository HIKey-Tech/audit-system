# IAMS — Project State

> Living snapshot of what has been built, what is stubbed, and what is next.
> **Update this file every time a module gains or loses capability.**
> Last updated: 2026-04-21 (rev 2)

---

## 1. One-line status

Foundation, User module, Document module, and app entry point (`server.ts`) are complete and production-shaped. Logging, Messaging, and Background still exist as service-only scaffolds (no HTTP routes). Audit, Risk, Workflow, Integration, Dashboard, Predictive, and the Next.js frontend are **not started**.

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
| RBAC seed (6 roles, 19 permissions) | Done | `prisma/seed.ts` |
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

**Roles:** `super_admin`, `audit_admin`, `audit_lead`, `auditor`, `auditee`, `viewer`.

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

### 2.4 Messaging module — COMPLETE (service-only)

Folder: `src/modules/messaging/`

- `NotificationService` (singleton export: `notificationService`) — uses nodemailer.
  - `sendEmail(dto)` — persists to `email_logs` first (`pending`), then updates to `sent` / `failed` after SMTP.
  - `sendInAppNotification(dto)` — persists to `notifications` table.
  - `markNotificationRead(id, userId)`.
  - `getUnreadCount(userId)`.

**Not yet built:**
- Notification templates sub-module (per event type, per escalation level).
- HTTP routes to read / mark-read in-app notifications.
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
- Registered jobs (via `registerAllJobs()`):
  - `BG:TOKEN:CLEANUP:HOURLY` — deletes expired / revoked refresh tokens. **Working.**
  - `BG:AUDIT:REMINDER:DAILY` — queries `audit_engagement` for engagements with due dates in the next 3 days. **Broken** — references `prisma.audit_engagement`, which does not exist in the schema yet. Will fail at runtime until the Audit module adds that model.
  - `BG:LOG:ARCHIVE:WEEKLY` — pulls audit logs older than 90 days. **Partially working** — reads logs, does not yet push to data warehouse (TODO).

**Not yet built:**
- Migration sub-module (bulk import of legacy audit spreadsheets).
- Jobs sub-module (bulk processing + report generation).
- Admin HTTP routes to enable/disable jobs (spec requires `job:admin` permission).

### 2.7 Database schema

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
| `documents` | File metadata. `storage_path` points to the provider-specific key. Indexed on `(entity_type, entity_id)`. |
| `scheduled_jobs` | Background job catalogue + last-run status. |
| `scheduled_job_runs` | Per-execution history. |

**Conventions observed:**
- UUID primary keys (`@default(uuid())`).
- snake_case columns + `@@map("snake_case")` tables.
- Soft-delete via `deleted_at` on `users` and `documents` (other mutable tables will follow the same pattern).
- No explicit DB migrations yet (`prisma/migrations/` does not exist) — only `schema.prisma`. First migration will need to be generated.

---

## 3. What is NOT yet built

### 3.1 Application entry point — COMPLETE

`src/server.ts` is wired up. Boot order: validate config → `connectDatabase()` → build Express app → listen → `registerAllJobs()` + `schedulerService.startAll()`. Shutdown order (SIGTERM/SIGINT/uncaughtException/unhandledRejection): stop accepting connections → `schedulerService.stopAll()` → `disconnectDatabase()`, with a 10s force-exit timeout.

App wiring:
- Security + parsing: `helmet`, `cors` (origin = `config.app.url`, credentials on), `compression`, `cookie-parser`, `express.json`, `express.urlencoded`.
- Logging: `morgan` (`dev` in dev, `combined` in prod) piped into the Winston logger; `requestAuditLogger` attached globally.
- Rate limiting: `express-rate-limit` applied to the `/api/<version>` prefix.
- Routes: `GET /health`, `GET /docs.json`, `GET /docs` (Swagger UI via `buildOpenApiDocument()`), then `createUserModule()` and `createDocumentModule()` mounted under `/api/<version>`.
- Tail middleware: `notFoundMiddleware`, `errorHandlerMiddleware`.

### 3.2 Module routers not yet created

- `modules/logging/index.ts` — for a future log-viewer endpoint.
- `modules/messaging/index.ts` — for in-app notification endpoints.
- `modules/background/index.ts` — for admin job-control endpoints.

### 3.3 Modules entirely missing

- `audit/` — universe, planning, execution, findings, reporting, follow-up, domains (IT / Financial / Compliance / Systems).
- `risk/` — register, assessment, monitoring.
- `workflow/` — approval, assignment, escalation (with configurable SLA-driven 4-level escalation chain).
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
