# IAMS — Project State

> Living snapshot of what has been built, what is stubbed, and what is next.
> **Update this file every time a module gains or loses capability.**
> Last updated: 2026-04-20

---

## 1. One-line status

Foundation + User module are complete and production-shaped. Logging, Messaging, Document, and Background exist as service-only scaffolds (no HTTP routes). No app entry point (`server.ts`) has been wired up yet. Audit, Risk, Workflow, Integration, Dashboard, Predictive, and the Next.js frontend are **not started**.

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

### 2.5 Document module — COMPLETE (service-only)

Folder: `src/modules/document/`

- `DocumentService` — `upload`, `getById`, `getDownloadUrl`, `delete` (soft), `listByEntity(entityType, entityId)`.
- Storage adapter pattern via `IStorageClient`:
  - `LocalStorageClient` — fully implemented (filesystem + UUID-stamped filenames).
  - `AzureBlobStorageClient` — stub (methods log warnings / throw "not yet implemented").
  - `createStorageClient()` factory picks based on `config.storage.provider`.

**Not yet built:**
- Versioning (the spec requires version control for working papers; `Document` table has no `version` column yet).
- Templates (admin-configurable audit report / working paper templates).
- HTTP controller + routes (no `document.controller.ts`, no `createDocumentModule()`).
- AWS S3 adapter.

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

### 3.1 Application entry point

**`src/server.ts` does not exist yet** — but `package.json` references it via `dev: ts-node-dev ... src/server.ts` and `main: dist/server.js`. This is the next mechanical piece of work.

Expected responsibilities when it is written:
1. Load config.
2. `await connectDatabase()`.
3. Bootstrap Express with: `helmet`, `cors`, `compression`, `cookie-parser`, `morgan`/`pino-http`, `express-rate-limit` (config already present).
4. Mount `/api/v1/` → `createUserModule()` and any other module routers that exist.
5. Attach `requestAuditLogger` middleware.
6. Attach `errorHandlerMiddleware` + `notFoundMiddleware` last.
7. `schedulerService.startAll()` on boot.
8. Graceful shutdown: `schedulerService.stopAll()` + `disconnectDatabase()` on SIGTERM/SIGINT.

### 3.2 Module routers not yet created

- `modules/document/index.ts` — no `createDocumentModule()` yet.
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

## 4. Known gaps / bugs to fix

| # | Issue | Location | Fix |
|---|---|---|---|
| 1 | `BG:AUDIT:REMINDER:DAILY` references `prisma.audit_engagement` which is not in the schema | `modules/background/service/implementation/scheduler.service.ts:169` | Either disable the job until Audit module adds the model, or guard it so the cron tick no-ops when the table is missing. |
| 2 | OIDC state is kept in an in-memory `Map` | `modules/user/service/client/oidc.client.ts:191-192` | Move to Redis before prod (Redis client is already installed & configured in `app.config.ts`). |
| 3 | JWT `expiresIn` handling mixes raw `string` and `number` in the token utility | `modules/user/utility/token.utility.ts:55` | `buildTokenPair` does `parseInt(config.jwt.expiresIn) / 1000` but `config.jwt.expiresIn` is a ms-format string like `"15m"`. Should use `ms()` to convert properly. |
| 4 | `.env` committed with placeholder secrets | `.env` | Move placeholders to `.env.example`; add `.env` to `.gitignore` (currently empty). |
| 5 | `user.service.ts` has a stray commented-out `const where` duplicate | `modules/user/service/implementation/user.service.ts:96-97` | Cosmetic — remove on next pass. |

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
