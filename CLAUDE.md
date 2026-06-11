# CLAUDE.md — IAMS (Internal Audit Management Software)

> **Read this file before writing any code.** It captures the project's non-negotiable rules, conventions, and the mental model you need to contribute without breaking things.

---

## 1. What this project is

**IAMS** is a centralised enterprise audit system commissioned by **Galaxy Backbone Limited (GBB)** — a Federal Government of Nigeria enterprise. It automates the full internal audit lifecycle: planning → execution → findings → reporting → follow-up → closure.

- **Client:** Galaxy Backbone Limited (GBB)
- **Deployment target:** GBB internal cloud (GCS), on-prem
- **Compliance scope:** ISO 27001, ISO 9001, ISO 20000, ISO 22301, NDPR, COBIT, NIST, PCI DSS
- **Integrates with (read-only):** Dynafin (ERP), IMOC (ITSM), Active Directory, Project Plus, Shared Drive

---

## 2. Stack

| Layer | Choice |
|---|---|
| Backend | Node.js + Express + **TypeScript** (strict mode) |
| ORM | Prisma |
| Database | SQL Server (on-prem, hosted by GBB) — pending final GBB DBA confirmation |
| Auth | OIDC (Azure AD default, generic-OIDC fallback). Protocol final choice (LDAP / SAML / OIDC) pending GBB IT |
| Validation | Zod |
| Logging | Winston |
| Jobs | node-cron (persisted via `scheduled_jobs` table) |
| Email | nodemailer |
| Cache/session store | Redis (configured; currently uses in-memory maps for OIDC state) |
| Frontend | Next.js (App Router) — **in active development** under `audit-system/frontend/`. Uses a BFF auth proxy (`app/api/auth/*`) that stores tokens in httpOnly cookies; the browser never holds JWTs |
| Repo | Monorepo — backend in `audit-system/`; frontend in `audit-system/frontend/` |

---

## 3. Architecture — Modular Monolith

All modules share **one database** and **one process**. Modules are logically separated but physically co-located.

```
src/
├── modules/              ← one folder per business module
│   ├── user/             ← built (incl. forgot-password + mandatory 2FA)
│   ├── logging/          ← built (service + read-only HTTP)
│   ├── messaging/        ← built
│   ├── document/         ← built
│   ├── background/       ← built
│   ├── audit/            ← built
│   ├── risk/             ← built
│   ├── workflow/         ← built
│   ├── dashboard/        ← built (read-only HTTP)
│   ├── settings/         ← built
│   ├── integration/      ← not built
│   └── predictive/       ← not built
│
└── shared/               ← cross-cutting infrastructure
    ├── config/           ← app.config.ts (env-driven)
    ├── errors/           ← AppError + ErrorCode
    ├── middleware/       ← auth, validate, error-handler
    ├── prisma/           ← prisma client singleton + shared includes
    ├── types/            ← ApiResponse, pagination
    └── utils/            ← logger
```

**Hard rules:**

1. Never build a module before its dependencies exist. Audit depends on User + Document + Workflow. Predictive depends on Logging/Warehouse. If a dependency is missing, stop and ask.
2. Every module is self-contained under `modules/<name>/`. Cross-module calls go through the **service interface**, never by reaching into another module's Prisma queries directly.
3. All integrations with external systems are **read-only** (Dynafin, IMOC, AD, Project Plus, Shared Drive). IAMS is never a source of truth for those systems.
4. Integrations use the **adapter pattern** — each external system has an interface + factory so we can stub during dev and swap to real API calls later.

---

## 4. Folder & file conventions (the `user` module is the reference)

Every new module must follow this exact layout:

```
modules/<name>/
├── index.ts                                    ← factory: createXxxModule(): Router
├── controller/
│   └── <name>.controller.ts                    ← class, registers its own routes
├── service/
│   ├── interface/
│   │   └── <name>.service.interface.ts         ← IXxxService + any sub-interfaces
│   ├── implementation/
│   │   └── <name>.service.ts                   ← class implements IXxxService
│   └── client/                                 ← only if the module talks to an external system
│       └── <system>.client.ts                  ← I<system>Client + concrete + factory
├── dto/
│   ├── request/
│   │   └── <name>.request.dto.ts               ← Zod schemas + inferred types
│   └── response/
│       └── <name>.response.dto.ts              ← response interfaces + mapper fns
├── domain/
│   ├── entity/
│   │   └── <name>.entity.ts                    ← domain types (camelCase)
│   └── enum/
│       └── <name>.enum.ts
└── utility/
    └── <name>.utility.ts                       ← pure helpers
```

**File naming:** `kebab-case-name.<type>.ts` — e.g. `auth.middleware.ts`, `user.service.ts`, `oidc.client.ts`. Never `AuthMiddleware.ts`.

---

## 5. Coding conventions (copy the `user` module)

### 5.1 Controllers
- **Class-based.** Construct once per module. Expose `public readonly router: Router`.
- Register routes in a private `_registerRoutes()` method.
- Route handlers are private methods named `_<action>` and always `.bind(this)` when passed to express.
- Every handler wraps its body in `try { ... } catch (err) { next(err); }` — never let errors escape.
- Always respond with `buildResponse(data, message, meta?)` from `shared/types/api-response.type.ts`.
- Each route has a JSDoc header: `@route`, `@desc`, `@access`.

### 5.2 Services
- Export an interface (`IXxxService`) in `service/interface/` and a class implementation in `service/implementation/`.
- Services are **stateless** — take dependencies via constructor, never reach for `this.db` directly; import the shared `prisma` singleton.
- Throw `AppError.xxx(...)` for all business errors. Never throw plain `Error` or return error objects.
- Every mutation calls `logger.info(...)` with structured metadata (`{ userId, actorId, ... }`).
- For cross-module calls, inject the other service through the constructor (see `AuthService(userService)` in `user/index.ts`).

### 5.3 DTOs & validation
- **Request DTOs** are Zod schemas. Export both the schema and `z.infer<typeof Schema>` as the DTO type.
- DTOs use **camelCase** field names even though the DB is snake_case. The service is where the translation happens.
- **Response DTOs** are plain interfaces plus an explicit `mapXxxToResponse()` function that converts the Prisma payload → DTO.
- Validate with the shared `validate(schema, source?)` middleware. `source` can be `'body' | 'query' | 'params'`. Default is `body`.

### 5.4 Database / Prisma
- Schema uses **snake_case fields** and `@@map("snake_case_table")`.
- Every table has `id` (UUID, `@default(uuid())`), `created_at`, and — where it makes sense — `updated_at @updatedAt` and `deleted_at` (soft delete).
- **Soft delete** is the default: set `deleted_at` and `is_active = false`. Every read query filters `deleted_at: null`.
- Complex `include` shapes go in `shared/prisma/prisma.types.ts` (see `userWithRolesInclude` / `UserWithRoles`) so multiple services share one source of truth.
- Use `prisma.$transaction([...])` whenever two writes must succeed or fail together, and also for count + findMany pairs (pagination).

### 5.5 Errors
- Use `AppError` static factories: `.unauthorized()`, `.forbidden()`, `.notFound(resource)`, `.conflict(msg)`, `.badRequest(msg, details?)`, `.validationError(details)`, `.internal()`.
- Never log-and-rethrow. Either handle the error or let the global `errorHandlerMiddleware` serialise it.
- `isOperational = false` means "programmer error, page oncall" — only use it for genuine bugs.

### 5.6 Auth & permissions
- Protect routes with `authenticate` (JWT) + `requirePermission('user:read', ...)` or `requireRole('audit_admin', ...)`.
- Permission names follow **`<module>:<action>`** (e.g. `audit:read`, `document:write`). New permissions go in `prisma/seed.ts` under `PERMISSIONS` with the matching role assignments under `ROLES`.
- `req.user` is typed via a global declaration in `auth.middleware.ts` — it contains `{ id, email, displayName, roles[], permissions[] }`.

### 5.7 Logging
- Two distinct log sinks:
  - **Application logs** — Winston `logger` from `shared/utils/logger.util.ts`. For dev/ops visibility.
  - **Audit trail** — `auditLogService` singleton from `modules/logging/`. Required for compliance. Persists to `audit_logs` table.
- `requestAuditLogger` middleware auto-records every mutating request (POST/PUT/PATCH/DELETE) — don't double-log.
- Audit logging **must never crash the app**: `auditLogService.log()` swallows its own errors.
- For high-frequency logging, use `auditLogService.logAsync(...)` (fire-and-forget).

### 5.8 External adapters (`service/client/`)
- Define `IXxxClient` interface → one or more concrete classes → `createXxxClient()` factory that reads from `config`.
- Storage (`storage.client.ts`) and OIDC (`oidc.client.ts`) are the canonical examples.
- Stubs are valid during dev — mark with `logger.warn('XxxClient.method() not yet implemented')`.

### 5.9 Background jobs
- Register in `modules/background/service/implementation/scheduler.service.ts` via `schedulerService.register({...})` inside `registerAllJobs()`.
- Every job needs a unique **job key**: `BG:<MODULE>:<ACTION>:<FREQUENCY>` — e.g. `BG:AUDIT:REMINDER:DAILY`.
- The scheduler auto-persists job definitions + every run to `scheduled_jobs` / `scheduled_job_runs`. Don't write raw `cron.schedule` calls anywhere else.
- Jobs must be **idempotent** — assume they may run twice.
- Jobs must be **independently enable/disable-able** via DB (`scheduled_jobs.is_active`).

### 5.10 Configuration
- All env reads go through `shared/config/app.config.ts`. Don't sprinkle `process.env.X` across the codebase.
- Use `requireEnv(key)` for variables that must be set (app fails fast in prod).
- Use `optionalEnv(key, fallback)` when a safe default exists.
- New env vars are added to `.env` AND `app.config.ts`.

---



**Frontend (Next.js) starts only after step 12.**

---

## 7. Current state

See [`docs/PROJECT_STATE.md`](./docs/PROJECT_STATE.md) for the live snapshot of what's built, what's stubbed, and what's next. Update that file whenever a module gains / loses capabilities.

---

## 8. How to work with me

- **Always check `docs/PROJECT_STATE.md` first** before you plan any change. Don't re-read the whole tree.
- **Ask before diverging** from these conventions. If a requirement seems to demand a new pattern, raise it — don't invent one silently.
- **Never break existing functionality.** Every change runs through an existing module must keep its public contract.
- **Never introduce speculative abstractions** ("we might need this later"). Build for what is required now. Three repeated lines is better than a premature helper.
- **Never build a module whose dependencies are missing.** If you can't follow the build order, stop and tell me.
- **Never write backend code that writes to Dynafin / IMOC / AD / Project Plus / Shared Drive.** All external systems are read-only.
- **Never commit secrets.** `.env` is local-only. Use `.env.example` for shareable templates.
- **Tests:** Jest is installed. No tests written yet. Adding tests alongside any new service is welcome but not yet required.

---

## 9. Open questions pending GBB's answer

Record these against any ambiguous requirement — don't guess:

- Exact SQL engine on-prem (schema currently targets SQL Server, confirmation pending).
- Final identity system: on-prem AD vs Azure AD vs other.
- Dynafin & IMOC — live pull on demand vs periodic sync.
- API documentation for each internal system.
- Whether GBB DBA owns schema migrations.
