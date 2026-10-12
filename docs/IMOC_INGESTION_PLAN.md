# IMOC Ingestion, Rules & Browse — Implementation Brief

## PROMPT FOR ANTIGRAVITY (paste this first)

You are a staff engineer implementing a feature in IAMS, a modular-monolith audit system (Node/Express/TypeScript strict, Prisma on SQL Server, Next.js frontend) for Galaxy Backbone Limited. Read `CLAUDE.md` and `docs/PROJECT_STATE.md` before writing any code, then implement this document phase by phase (P0 → P1 → P2 → P3), in that order, one PR per phase.

How to work:
- Follow the repo's conventions exactly (the `user` module is the reference). Do not invent new patterns; if a requirement seems to need one, stop and ask.
- Verify, don't assume: read the vendor PDFs listed in §1.3 and check real IMOC response field names before coding against them. Where this brief says "verify" or lists an open item (§9), do not guess; raise it.
- IMOC is strictly read-only. Never disable TLS verification, never log or return secrets, never hardcode role names (permission slugs only).
- Keep scope tight: IMOC only, no Dynafin code, no speculative abstractions, no changes that break existing IMOC link/snapshot behaviour.
- Each phase must end with: backend type-check passing, existing Jest suites green plus new tests, `.env.example` and `docs/PROJECT_STATE.md` updated, and a short summary of what was verified and what was not.
- Never commit `docs/Keys-1.txt` or any credential file (now git-ignored). Put test credentials in a local untracked `.env` only.

Definition of done: the super admin can define ingestion rules, preview and run them, and see matching IMOC tickets in IAMS with filters and aggregates, link them to engagements as evidence, and raise risks from them, with no manual copying from IMOC.

---

> **Audience:** Antigravity (implementing engineer). **Author role:** staff-engineer hand-off.
> **Read first:** `CLAUDE.md` (non-negotiable conventions) and `docs/PROJECT_STATE.md` (revs 40, 41, 43 describe the existing IMOC work). Follow the `user` module layout and every rule in CLAUDE.md §4–§5. If anything here conflicts with CLAUDE.md, stop and ask.

---

## 0. TL;DR

UAT feedback (GBB, Fri): users must not hand-copy tickets from IMOC (ITSM) into IAMS. IAMS must **automatically ingest** IMOC tickets that match **rules set by the super admin**, store them locally, let users **browse / filter / aggregate** them, **use them as audit evidence or audit triggers**, and surface them on the **risk register with categories**. Dynafin (financial transactions, e.g. transfers > ₦5m) is **not active yet** but the design must accommodate it later. **Scope of this brief = IMOC only.**

Deliver in **four phases** (each independently shippable, each ends with type-check + jest + manual verification):

| Phase | Deliverable |
|---|---|
| **P0** | Fix live-lookup failure (TLS trust + error taxonomy + ticket-number lookup) |
| **P1** | Local ticket store + ingestion rules + scheduled/manual ingest (backend) |
| **P2** | Browse/aggregate API + Super-admin rules UI + Tickets workspace UI |
| **P3** | Risk-register link + saved views + hooks for audit/evidence |

All integrations stay **read-only**. IAMS never writes to IMOC.

---

## 1. Background findings (verified in this repo, 2026-10-11)

### 1.1 Existing IMOC adapter (do not rewrite; extend)
Path: `src/modules/integration/imoc/`
- `service/client/imoc.client.ts` — `IImocClient` + `HttpImocClient` + `DisabledImocClient` + `createImocClient()`. Machine-token provider `MachineUserImocTokenProvider` (POST `/esf/iamservice/v1/token/machine-user/apply`, success code `"1"`, token cached 30 min, `encodeURI` applied, refresh on 401/403 once). Methods: `listTickets`, `getTicket`, `getLightweightTickets`, `getTicketStatus`, `getCurrentTicketStatus`, `getModel`. **Every failure is collapsed into `AppError.serviceUnavailable(...)` (HTTP 503)** — this hides root cause.
- `service/implementation/imoc-ticket.service.ts` — search/detail/model passthroughs (no persistence), engagement link/unlink/refresh/capture/snapshots, `syncActiveLinks()` job helper. Permission checks via `assertPermission(actor, 'imoc:*')`.
- `controller/imoc-ticket.controller.ts` — routes under `/integration/imoc`: `GET /status`, `POST /tickets/search`, `POST /tickets/detail`, `POST /models/detail`, `POST /sync`, engagement link routes.
- `utility/imoc.utility.ts` — `normalizeImocTicket`, `normalizeImocModel`, `buildSafeImocSnapshot` (allow-list; **intentionally drops arbitrary IMOC form fields** — keep this principle), `hashSnapshot`.
- `domain/entity/imoc.entity.ts`, `dto/request|response/*`, `__tests__/imoc.utility.test.ts`, `__tests__/imoc-machine-token.test.ts`.
- Prisma: `imoc_ticket_links`, `imoc_ticket_snapshots` (migration `20260920120000_add_imoc_integration`).
- Config: `src/shared/config/app.config.ts` → `config.imoc.*` (`IMOC_ENABLED`, `IMOC_BASE_URL` default `https://service-imoc.gbb.com.ng:443`, tenant/machine creds, `IMOC_TIMEOUT_MS`, `IMOC_SYNC_*`). Startup validation at ~line 231.
- Scheduler: `src/modules/background/service/implementation/scheduler.service.ts` already registers `BG:INTEGRATION:IMOC:SYNC:HOURLY` — use as the template for the new job.
- System-audit already has an IMOC **live** source (`src/modules/system-audit/analytics/service/implementation/live-source.service.ts`) and `utility/analyzers/incident-log.analyzer.ts` (SLA per priority, `BREAK`, aged open). These query IMOC on demand and store nothing. Once P1 lands, repoint the live source to the local store (see P3).

### 1.2 Live-test results (this session, using the test keys)
Test credentials: `docs/Keys-1.txt` (tenant account `HWCloudInfra`, machine user `Machine_eticket`; **treated as secrets, never print/commit**).
- Calling `https://service-imoc.gbb.com.ng:443/esf/iamservice/v1/token/machine-user/apply` from Node 18+ `fetch` fails **before any HTTP exchange** with **`SELF_SIGNED_CERT_IN_CHAIN`**. IMOC presents a certificate chained to a private/self-signed CA that Node does not trust.
- Consequence: `HttpImocClient` / token provider hit the generic `catch` → `AppError.serviceUnavailable('Unable to reach IMOC.')` → **HTTP 503**. This exactly matches the UAT screenshot: `GET /api/proxy/integrations/…/tickets` → 503 while the status badge says "Connected" (status only checks that env vars exist, not reachability).
- This is the **leading hypothesis** for the UAT failure, not yet proven for production (prod may use a different path/CA). We could not complete the authenticated calls because disabling TLS verification was (rightly) blocked. **Do not "fix" with `NODE_TLS_REJECT_UNAUTHORIZED=0` or `rejectUnauthorized:false`.** Fix by trusting the CA (see P0).
- Still unverified (check once TLS is fixed): whether `/eticket/openapi/order/query/single` accepts `orderNumber` (UAT ticket `INCT2607220012` is a ticket **number**, not an `orderId` hex id). Docs for the list endpoint show `orderNumber` is a list filter (comma-separated allowed), so **resolve number → orderId via list, then fetch by id** if `single` rejects it.

### 1.3 Vendor docs (Huawei IMOC) — where to look
All under `docs/` (PDFs; use `pdftotext -layout "<file>" -`):
| File | Use for |
|---|---|
| `docs/Token Management-1/Token Management.pdf` | Machine-token apply (`/esf/iamservice/v1/token/machine-user/apply`), 30-min validity, `imoc_token` must be `EncodeURI`d, 50 req/s limit, token verify endpoints |
| `docs/API Docs-1/Authentication Mode.pdf` | Tenant authentication (recommended), how headers are built, AK/SK creation |
| `docs/API Docs-1/Query Ticket list.pdf` | **Primary ingestion endpoint** `POST /eticket/openapi/order/query/{pageSize}/{pageNum}`; body filters (`orderStatus`, `orderSource`, `modelType`, `modelId`, `modelName`, `currentUser`, `orderName`, `orderNumber`, `slaStatus` ∈ NC/BREAK/…, `beginStartDate/EndDate`, `endStartDate/EndDate` format `YYYY-MM-DD HH:mm:ss`, `createBy`+`handleValue`+`authorGroup`); response `list,total,createTime,orderSource,orderStatus,slaStatus…`; 200 req/s limit; **UTC time for IMOC ≥ 25.2.RC1, local time before** |
| `docs/API Docs-1/Query  Detail about single ticket (lightweight).pdf` | `POST /eticket/openapi/order/query/single/oa` body `{orderIds: "id1,id2"}` — detail + submission records |
| `docs/API Docs-1/Query  Single ticket status.pdf`, `Query current Ticket Status.pdf`, `Query Ticket Status.pdf` | Status history vs current status endpoints |
| `docs/API Docs-1/Query Model List.pdf` | Ticket model (type/category) metadata — **source for category mapping** |
| `docs/API Docs-1/ReturnCodes.pdf` | Codes: `200`/`0` ok, `500`/`-1` error, `100` mandatory param empty, `101` model missing/disabled, `5002` bad param. Map these to distinct IAMS errors (P0). |

Read the list and detail PDFs fully before coding P1 — field names in `normalizeImocTicket` must be checked against the real response (print one **redacted** sample once TLS works).

---

## 2. Non-negotiable constraints
1. Follow CLAUDE.md layout/naming; new code lives inside `src/modules/integration/imoc/` (sub-folders `rules/`, `ingestion/`, or flat files per existing style — pick one and stay consistent). Controller classes with `_registerRoutes`, `try/catch → next(err)`, `buildResponse`, JSDoc `@route/@desc/@access`.
2. **Permission-based, never role names** (project memory). New permission slugs: `imoc:rules` (manage rules — **super admin only by default seed**), `imoc:ingest` (trigger manual ingest), plus reuse `imoc:read`. Add to `prisma/seed.ts` `PERMISSIONS` and assign to the super-admin role only; admins can later grant to custom roles. Gate routes with `requirePermission(...)`. Do not write `if role === ...` anywhere (backend or frontend).
3. Read-only toward IMOC. Allow-list fields. Never persist raw IMOC form payloads, phone numbers, emails or free-text bodies unless explicitly allow-listed and reviewed for NDPR.
4. Never log secrets/tokens. Never return credentials to the frontend.
5. Soft-delete (`deleted_at`, `is_active`) and `deleted_at: null` on every read. UUID `id`, `created_at`, `updated_at`.
6. Jobs: key `BG:INTEGRATION:IMOC:INGEST:HOURLY`, registered in `registerAllJobs()`, idempotent, DB-toggleable (`scheduled_jobs.is_active`), no raw `cron.schedule`.
7. Config via `app.config.ts` + `.env.example` only. Add vars there.
8. Every mutation: `logger.info` structured metadata **and** `auditLogService.logAsync` (see `imoc-ticket.service.ts` for pattern). `requestAuditLogger` already logs HTTP mutations — don't double-log the HTTP layer.
9. Ask before diverging; no speculative abstractions. No Dynafin code in this brief — only keep the rule model generic enough (§4.2) that a `source` column can be added.
10. Update `docs/PROJECT_STATE.md` (new rev entry) when done. Migrations: create but **do not apply to any shared DB**; local Docker `iams-mssql` only.
11. Add Jest tests with each service (tests are welcome per CLAUDE.md §8).

---

## 3. Phase P0 — Make live IMOC access work (and diagnosable)

### P0.1 TLS trust (the likely 503 cause)
- Add config `IMOC_CA_CERT_PATH` (optional) in `app.config.ts` + `.env.example`. When set, read the PEM file at startup and build an `undici` `Agent` (`connect: { ca }`) used **only** for IMOC calls (both token provider and `_post`) via `dispatcher` in `fetch`. Node's built-in `fetch` accepts `dispatcher` through undici; if `undici` isn't a dependency, add it (pin exact version) — or use `https.Agent` with `node:https` request. Pick one; keep it inside `imoc.client.ts`.
- Startup validation: if path set but unreadable → fail fast in prod (existing `requireEnv` style). Log (not secrets) `IMOC trust: custom CA loaded (subject=…)`.
- Document in `docs/VPS_DEPLOYMENT_RUNBOOK.md`: obtain GBB's IMOC root/intermediate CA (ask GBB IT; or `openssl s_client -showcerts -connect service-imoc.gbb.com.ng:443`), mount it into the backend container (`docker-compose.prod.yml` volume), set `IMOC_CA_CERT_PATH`. Also mention `NODE_EXTRA_CA_CERTS` as an acceptable alternative.
- **Never** add an "insecure/skip verify" flag.

### P0.2 Error taxonomy (stop the blanket 503)
Replace the catch-all with distinct, safe, user-actionable errors (extend `AppError`/`ErrorCode` only if existing factories don't fit — check `src/shared/errors/`):
| Cause | HTTP | Message (no secrets) |
|---|---|---|
| TLS/cert (`err.cause.code` ∈ `SELF_SIGNED_CERT_IN_CHAIN`, `UNABLE_TO_VERIFY_LEAF_SIGNATURE`, `CERT_*`) | 503 | "IMOC's TLS certificate is not trusted by IAMS. Contact the administrator (CA not installed)." |
| DNS/connect (`ENOTFOUND`, `ECONNREFUSED`, `ETIMEDOUT`) | 503 | "IMOC is unreachable from IAMS." |
| Timeout (AbortError) | 504 | existing timeout message |
| Token rejected / bad credentials (token apply code ≠ "1") | 502 | "IMOC rejected the integration credentials." |
| Upstream `100/5002` | 400 | "IMOC rejected the request parameters." (+ safe detail) |
| Upstream `101` | 404 | model missing/disabled |
| Upstream 200 with empty/`null` data for a single-ticket lookup | **404** `AppError.notFound('IMOC ticket')` | (currently 503 "successful response without ticket data" — wrong) |
| Upstream 500/-1 | 502 | "IMOC reported an error." + upstream code |
Log `{ path, status, upstreamCode, causeCode }` at `warn`; never body/headers. Add unit tests with an injected fetch (pattern exists in `imoc-machine-token.test.ts`).

### P0.3 Real status check
`getStatus()` currently reports "Connected" if env vars exist. Add `POST/GET /integration/imoc/status/check` (perm `integration:read`) that attempts a token apply (cached) and returns `{ reachable, authenticated, lastError(safe), checkedAt }`. Frontend badge must reflect it ("Configured" vs "Connected").

### P0.4 Ticket-number lookup
- Re-read `Query single ticket` docs (`Query Single ticket status.pdf`, plus the `/order/query/single` section in the list/detail PDFs) to confirm accepted keys.
- Implement `resolveTicket(lookup)`: if only `orderNumber` supplied → `listTickets({ orderNumber, pageSize:1, page:1 })`; take the exact match (case-insensitive) → get `orderId` → `getTicket({orderId})`. If none → 404. Cache nothing here.
- Frontend "Link ticket" input (`engagement ?tab=imoc`) must accept either number or id and show the specific error message from P0.2.

### P0 acceptance
- With CA mounted, token apply + list + single (by number) succeed against `service-imoc.gbb.com.ng` using `docs/Keys-1.txt` creds put in a **local, untracked** `.env`.
- Unit tests for each error mapping pass; `npm run build` type-check passes.
- Print **one redacted sample** list response into the PR description to validate field names used in P1.

---

## 4. Phase P1 — Local store, ingestion rules, scheduled ingest

### 4.1 Data model (Prisma, SQL Server — follow snake_case + `@@map`)
Create one migration `…_add_imoc_ingestion` (do not apply to shared DBs). Look at `prisma/schema.prisma` `imoc_ticket_links` for style.

**`imoc_tickets`** (local copy, allow-listed fields only)
- `id` uuid, `order_id` (IMOC id, **unique**), `order_number` (unique, indexed), `order_name`, `model_id`, `model_name`, `model_type`, `order_source`, `order_status`, `sla_status`, `priority` (nullable; if IMOC returns it), `current_handler` (display name only), `created_by_name` (display name only), `imoc_created_at`, `imoc_ended_at` (UTC, see §4.5), `category` (resolved, nullable, indexed), `matched_rule_ids` (JSON array string — SQL Server has no arrays), `first_ingested_at`, `last_synced_at`, `source_hash` (SHA-256 of normalized allow-list for change detection), `created_at`, `updated_at`, `deleted_at`, `is_active`.
- Indexes: `(order_status)`, `(sla_status)`, `(category)`, `(imoc_created_at)`, `(model_id)`.
- Link existing `imoc_ticket_links` to this table: add nullable `imoc_ticket_id` FK; backfill from `order_id`; keep existing columns for backward compatibility (**do not break existing contract**).

**`imoc_ingestion_rules`** (super-admin configured)
- `id`, `name` (unique among non-deleted), `description`, `is_active`, `priority` (int, evaluation order), `criteria_json` (validated Zod schema, see §4.2), `category` (string assigned to tickets matched by this rule, nullable), `risk_category_id` (nullable FK to risk categories — wire in P3), `lookback_days` (int, default 30; bounds the first fetch), `last_run_at`, `last_run_status`, `last_run_fetched`, `last_run_ingested`, `last_run_error`, `created_by_id`, `updated_by_id`, `created_at`, `updated_at`, `deleted_at`.

**`imoc_ingestion_runs`** (observability)
- `id`, `trigger` (`scheduled|manual`), `triggered_by_id` nullable, `started_at`, `finished_at`, `status` (`success|partial|failed`), `rules_evaluated`, `fetched`, `created`, `updated`, `skipped`, `error_summary` (≤1000 chars, no secrets).

**`imoc_saved_views`** (P3) — see §6.

### 4.2 Rule criteria schema (Zod, `criteria_json`)
Keep it a **flat, whitelisted set that maps 1:1 to the IMOC list endpoint filters** so filtering happens upstream where possible (documented in `Query Ticket list.pdf`):
```
{
  orderStatus?: ('processing'|'dismissed'|'reback'|'completed'|'suspend'|'scrapped'|'draft')[],
  slaStatus?: string[],          // e.g. ['BREAK']  (verify full value set from docs)
  modelIds?: string[], modelNames?: string[], modelTypes?: string[],
  orderSources?: string[],
  nameContains?: string,         // applied locally (IMOC orderName filter is exact/ambiguous — verify)
  currentUsers?: string[],
  createdWithinDays?: number     // overrides lookback
}
```
Rules are OR-ed across rules, AND-ed within a rule. Because the API takes **one value per filter**, execute one upstream query per (rule × multi-value filter combination) — cap combos (e.g. ≤ 20 queries/rule) and reject larger rules at validation time. Local post-filtering only for fields IMOC can't filter. Rule evaluation is pure and lives in `utility/` (unit-tested).
**Future Dynafin note (do not build):** keep `criteria_json` namespaced by source so an `amount_gt` criterion can be added later without migration churn.

### 4.3 Ingestion service
`ImocIngestionService` (interface in `service/interface`, implementation in `service/implementation`), dependencies: `IImocClient`, shared prisma, logger, `auditLogService`.
- `runIngestion(trigger, actorId?)`:
  1. Guard: client enabled + configured, else return `{status:'skipped'}`.
  2. Take an **in-process + DB lock** so overlapping runs can't happen (e.g., reject if an `imoc_ingestion_runs` row is `running` < 30 min old). Add `running` to status or a `locked_until` — pick the simplest that survives restarts.
  3. For each active rule (ordered by `priority`): build upstream queries, paginate with `pageSize` ≤ 100 until `hasNext` false or **safety cap** (`IMOC_INGEST_MAX_PAGES` default 50, configurable), `lookback_days` window using `beginStartDate/beginEndDate` formatted per §4.5. **Throttle** (≤ ~20 req/s, far below the 200/s vendor cap; sleep between pages).
  4. Normalize via existing `normalizeImocTicket`; compute `source_hash`; **upsert by `order_id`** (idempotent — jobs may run twice); append rule id to `matched_rule_ids` set; resolve `category` (rule category → else model-type mapping → else `Uncategorised`; first matching by priority wins).
  5. Update rule `last_run_*`; write one `imoc_ingestion_runs` row; `logger.info` summary; `auditLogService.logAsync('integration.imoc.ingest.run')`.
  6. Per-rule failures must not abort other rules → `partial`.
- Tickets that no longer match any rule are **not deleted** (they may already be evidence). Optionally a rule-deactivate leaves data intact.
- Refresh path: existing `syncActiveLinks` should refresh from the local store/upstream and update the same `imoc_tickets` row.
- **Detail enrichment is out of scope for bulk ingest** (list payload only). Detail (history/submission records) continues to be fetched on demand and captured as snapshot evidence via the existing capture flow.

### 4.4 Job + manual trigger
- Register `BG:INTEGRATION:IMOC:INGEST:HOURLY` in `scheduler.service.ts` (copy the sync job shape). Guard with new `config.imoc.ingestEnabled` (`IMOC_INGEST_ENABLED`, default false) in addition to the DB `is_active` flag.
- `POST /integration/imoc/ingestion/run` (perm `imoc:ingest`) triggers `runIngestion('manual', actor.id)` and returns the run summary (do not block >~30 s: if long, return `202` with run id and poll `GET /ingestion/runs/:id`).

### 4.5 Time handling (must get right)
Vendor docs: IMOC ≥ 25.2.RC1 uses **UTC** in request and response; earlier tenants use local time. Add `IMOC_TIMESTAMPS_UTC` (default `true`) in config, store `imoc_*_at` as UTC `DateTime`, and format request windows as `YYYY-MM-DD HH:mm:ss`. Verify with a real sample (compare ticket `INCT2607220012` create time with the IMOC UI). Unit-test conversions.

### 4.6 Rules & ingestion API (all under `/integration/imoc`, `authenticate` first)
| Route | Method | Permission | Notes |
|---|---|---|---|
| `/rules` | GET | `imoc:rules` | list (non-deleted) |
| `/rules` | POST | `imoc:rules` | create, Zod-validate criteria, enforce combo cap |
| `/rules/:id` | GET/PUT | `imoc:rules` | update |
| `/rules/:id/toggle` | POST | `imoc:rules` | activate/deactivate |
| `/rules/:id` | DELETE | `imoc:rules` | soft delete |
| `/rules/preview` | POST | `imoc:rules` | **dry-run**: run criteria upstream with `pageSize=10, page=1`, return `{ total, sample[] }` without persisting — lets the admin see what a rule would pull |
| `/ingestion/run` | POST | `imoc:ingest` | manual run |
| `/ingestion/runs` | GET | `imoc:rules` | history (paginated) |
Every rule mutation → `logger.info` + `auditLogService.logAsync` with old/new values. DTOs per CLAUDE.md §5.3 (camelCase request/response, mapper functions).

### 4.7 Config additions (`app.config.ts` + `.env.example`)
`IMOC_CA_CERT_PATH`, `IMOC_INGEST_ENABLED` (false), `IMOC_INGEST_MAX_PAGES` (50), `IMOC_INGEST_PAGE_SIZE` (100), `IMOC_INGEST_REQUESTS_PER_SECOND` (20), `IMOC_TIMESTAMPS_UTC` (true).

### P1 acceptance
- Migration generates cleanly (`prisma validate`, `prisma generate`); existing linking/snapshot flows unchanged (regression test).
- Given 2 rules against a mocked client with overlapping tickets: running twice yields identical row counts (idempotent), `matched_rule_ids` merged, run rows recorded.
- Rule validation rejects oversized combos and unknown criteria keys.
- Jest: rule-criteria validation, query builder, category resolution, upsert idempotency, time conversion, error mapping.

---

## 5. Phase P2 — Browse/aggregate API + UI

### 5.1 Read API (perm `imoc:read`) — local store only (no live IMOC call, fast)
- `GET /integration/imoc/store/tickets` — query params (Zod `validate(..., 'query')`): `page, pageSize≤100, status[], slaStatus[], category[], modelId, search (number/name), createdFrom/To, handler, sort, order`. Returns paginated `ImocStoredTicketResponse` (include `matchedRuleNames`, `linkedEngagementIds` count).
- `GET /integration/imoc/store/summary` — aggregates in **one `prisma.$transaction`**: counts grouped by `category`, `order_status`, `sla_status`, by month (`imoc_created_at`), SLA-breach count, and top models. Accept the same filters so the dashboard reflects the active filter ("aggregate, filter, analyze").
- `GET /integration/imoc/store/tickets/:id` — row + linked engagements + snapshots; "Open in IMOC" uses `order_number` (display only — do **not** invent a deep-link URL unless GBB provides the pattern; ask).
- `GET /integration/imoc/store/export` — CSV/XLSX, 10k-row cap, formula-injection safe. **Reuse the existing export helper** used by findings/risks/logs (see rev 43 in PROJECT_STATE; locate with grep `export` in `modules/logging` / `modules/audit`). New permission `imoc:export`.
Note the old `POST /tickets/search` (live) stays for ad-hoc lookup/linking.

### 5.2 Frontend (Next.js App Router, `frontend/`)
First read how the existing **Integrations → IMOC** workspace and the engagement **IMOC Tickets** tab are built (grep `imoc` under `frontend/`) and the BFF proxy `app/api/proxy/*`. Reuse the table, filter bar, badge, empty/error-state and permission-gate components; do not introduce a new UI library.
1. **Integrations → IMOC → "Tickets" tab** (default): filter bar (status, SLA, category, model, date range, search), results table (ticket #, name, category, status, SLA badge with BREAK highlighted, handler, created, rules matched, linked-engagement count), row drawer with detail + "Link to engagement" + "Capture snapshot" + "Raise risk" (P3).
2. **Summary panel above the table**: KPI tiles (total, SLA-breached, open/processing) + bar/stacked charts by category and by month (follow the `dataviz` conventions already used on the dashboard). Clicking a chart segment applies that filter.
3. **"Rules" tab — rendered only if `can('imoc:rules')`** (permission helper already used elsewhere; never role names): rules table, create/edit drawer (multi-select status/SLA, model, source, date lookback, category, priority, active toggle), **Preview** button (calls `/rules/preview`, shows total + sample), last-run status badge per rule.
4. **"Ingestion" tab (same permission)**: "Run now" button, run history table, current job enabled/disabled indicator (read `scheduled_jobs`).
5. Status header: show Configured / Connected / TLS-error using P0.3.
6. Engagement tab: "Link ticket" can now pick from the local store (typeahead) **or** type a number (P0.4); show specific errors.
7. Accessibility: keyboard-operable filters, SLA state not conveyed by colour alone. Loading skeletons + empty state ("No tickets match these rules yet — ask an administrator to configure rules").

### P2 acceptance
- With seeded fixtures, filters and summary counts agree with each other (same filter ⇒ table total == sum of summary buckets).
- Non-privileged user sees Tickets tab only; no Rules/Ingestion tabs and 403 on those APIs.
- Next.js production build + backend type-check pass.

---

## 6. Phase P3 — Risk register, saved views, audit/evidence hooks

### 6.1 Risk register link
Read first: `src/modules/risk/` service interface and the risk category model (rev 43 added `business_objective`; grep `risk_categor`). Per CLAUDE.md, **call the risk service interface — never its Prisma tables.**
- Add `imoc_ticket_risk_links` (`imoc_ticket_id`, `risk_id`, `created_by_id`, unique pair, soft-delete). Rule field `risk_category_id` pre-fills the category.
- Action **"Raise risk from ticket"** (perm = existing `risk:create` **and** `imoc:read`): opens risk form prefilled (title from ticket name, description with ticket number/status/SLA, category from rule). Creating through `IRiskService`. **Default is manual** (auditor decides); an **optional** rule flag `auto_flag_risk` (default off) can create *risk suggestions* only — if the risk module has no "suggestion" concept, skip auto entirely and ask. Do not auto-create register entries without a human.
- Risk detail page shows linked IMOC tickets (read-only list); register list can filter by "has IMOC ticket".

### 6.2 Saved views (chosen interpretation of "artifact/programme saved")
Decision: **saved filter views** (per-user, private; shareable flag out of scope). Table `imoc_saved_views`: `id, owner_id, name, filters_json (same Zod schema as store query), is_default, created_at, updated_at, deleted_at`, unique `(owner_id, name)`. API: `GET/POST/PUT/DELETE /integration/imoc/views` (perm `imoc:read`, owner-scoped — enforce owner check in the service, 404 for others' rows). UI: "Save view" and a views dropdown on the Tickets tab. *Rule sets are already persisted as ingestion rules (super admin).* Do not build "audit programme" generation from tickets — out of scope per the product owner.

### 6.3 Audit/evidence hooks
- Existing link/capture flow stays. Add engagement-side button "Attach from IMOC store" (uses local store typeahead).
- System-audit: change `live-source.service.ts` IMOC source to read from `imoc_tickets` (via a new service method, e.g. `listStoredTickets(filters)` on `IImocTicketService` — **cross-module through the service interface**) so continuous monitoring (`BG:SYSAUDIT:MONITORING:DAILY`) no longer needs live IMOC calls and keeps working when IMOC is down. Fall back to live only if the store is empty. Re-run `incident-log.analyzer` tests.

---

## 7. Security & compliance checklist
- [ ] No secrets in repo/logs/responses. `docs/Keys-1.txt` and `docs/Token Management-1/Access key.txt` hold **real-looking credentials and are untracked but not git-ignored** — add both (or `docs/Keys*`, `docs/**/Access key*`) to `.gitignore` **now**, move to a secret store, and ask GBB to rotate keys if they ever reached a shared channel.
- [ ] TLS: custom CA only, no verify-off.
- [ ] Allow-list fields; no free-text bodies/phones/emails (NDPR). Add the `imoc_tickets` table to `docs/NDPR_RETENTION_SCHEDULE.md` with a retention period; implement purge in an idempotent job only if a period is agreed (ask; do not guess).
- [ ] Permissions seeded; super admin only for `imoc:rules`, `imoc:ingest`; verified 403 for others.
- [ ] Audit trail entries for rule CRUD, ingestion runs, risk raise, view CRUD.
- [ ] Rate limits respected (200 req/s data APIs, 50 req/s token API).

## 8. Test & verification matrix
| Area | How |
|---|---|
| Unit | rule schema, query builder, category resolver, time conversion, error mapper, token provider (existing) |
| Service | upsert idempotency, partial failure, overlap lock, owner-scoped views (mocked prisma/client) |
| Integration (local) | against live IMOC once CA mounted: token → list(1 page) → single by number `INCT2607220012` → one ingest run into local Docker `iams-mssql` |
| Regression | existing 12 Jest suites / 73 tests stay green; link/snapshot flows unchanged |
| Build | backend `tsc` strict; Next.js build |
| Manual UAT | super admin creates rule "SLA breached" → preview → run now → tickets appear → filter/aggregate → raise risk → link to engagement → capture evidence; auditor cannot see Rules tab |

## 9. Open items to raise with the product owner (do not guess)
1. GBB IT: provide IMOC CA chain; confirm IMOC version (UTC vs local time) and whether a ticket deep-link URL pattern exists.
2. Full `slaStatus` value set and which field carries priority/category (verify on real payload).
3. Retention period for ingested tickets (NDPR).
4. Whether auto-risk suggestions are wanted at all (default: manual only).
5. Dynafin: API docs outstanding; not part of this work.

## 10. Suggested PR sequence
1. `fix(imoc): trust private CA, typed errors, number lookup, real status check` (P0)
2. `feat(imoc): ingestion data model, rules engine, scheduled ingest` (P1)
3. `feat(imoc): store browse/summary API and UI, rules admin UI` (P2)
4. `feat(imoc): risk link, saved views, system-audit reads store` (P3)
Each PR: tests, `PROJECT_STATE.md` rev entry, `.env.example` updates, migration notes.
