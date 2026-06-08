# Ad-hoc Request Workflow — Design Spec

> Status: approved for implementation (2026-06-07). Approach A (new `request` sub-module inside Workflow, reusing existing plumbing).

## 1. Summary

A general-purpose, **user-initiated** workflow. Any eligible user can raise a request with a title, description, and attachments (docs/images), routed as a **sequential chain** of recipients they choose. Each current recipient may **approve, sign, or reject** (approve/sign advance the chain; reject ends it) and anyone on the request may add a non-advancing **comment**. "Sign" produces an audit-grade **e-signature** (affirmation + SHA-256 content hash, immutable). It reuses the existing **unified approval inbox, escalation engine, notification queue, and Document module**. The audit-specific `Workflow_Approval` engine is left untouched.

## 2. Module layout

```
src/modules/workflow/request/
├── controller/request.controller.ts
├── service/interface/request.service.interface.ts
├── service/implementation/request.service.ts
├── dto/request/request.request.dto.ts        (Zod)
├── dto/response/request.response.dto.ts       (interfaces + mappers)
├── domain/enum/request.enum.ts
└── utility/signature.utility.ts
```
Mounted by `createWorkflowModule()` at `/workflow/requests`.

## 3. Data model (Prisma, SQL Server)

All: UUID PK, snake_case + `@@map`, `onDelete/onUpdate: NoAction` on FKs, indexes on FKs + status.

### `Workflow_Request` (`workflow_requests`)
- `id`, `reference_number` (unique, `REQ-<year>-<seq>`)
- `title`, `description` (NVarChar(Max), nullable)
- `initiator_id` → User
- `current_level` Int @default(1)
- `status` String @default("pending") — `pending | completed | rejected | cancelled`
- `locked_at` DateTime? — set on first recipient action; content frozen thereafter
- `created_at`, `updated_at`, `deleted_at`

### `Workflow_Request_Step` (`workflow_request_steps`)
- `id`, `request_id` → Workflow_Request
- `level` Int, `recipient_id` → User
- `status` String @default("pending") — `pending | approved | signed | rejected`
- `acted_at` DateTime?
- `created_at`
- `@@unique([request_id, level])`

### `Workflow_Request_Action` (`workflow_request_actions`) — append-only
- `id`, `request_id` → Workflow_Request, `step_id` → Workflow_Request_Step (nullable, comments may be unattached)
- `actor_id` → User
- `action_type` String — `approve | reject | sign | comment`
- `comment` String? @db.NVarChar(Max)
- `signature_hash` String? — SHA-256 hex, set only when `action_type = sign`
- `signature_manifest` String? @db.NVarChar(Max) — canonical JSON that was hashed
- `created_at`

### Attachments
Reuse `Document` with `module='workflow', entity_type='workflow_request', entity_id=<request.id>`. No new file table.

### User back-relations
`requests_initiated`, `request_steps`, `request_actions`.

## 4. Lifecycle

- **Create (= submit):** validate each recipient is active, holds `request:receive`, is not the initiator, and chain has no duplicates. Transaction: create header (`current_level=1`) + one step per recipient. Queue notification to level-1 recipient. Status `pending`.
- **Attachments:** initiator uploads via `POST /:id/attachments` while `locked_at` is null. First recipient action sets `locked_at` → content frozen.
- **Acting** (only the recipient whose step is `pending` at `current_level`):
  - `approve` → step `approved`; advance (next recipient notified) or `completed` (initiator notified)
  - `sign` → as approve, step `signed`, signature record written
  - `reject` → step `rejected`, request `rejected` (terminal), initiator notified
  - `comment` → append-only, non-advancing; initiator + any recipient while `pending`; notifies initiator + current recipient (minus commenter)
- **Cancel:** initiator or `request:admin` while `pending` → `cancelled`, notify pending recipient.

## 5. E-signature

On `sign`:
1. Require `affirmation` (typed full name) — checked against signer account, recorded.
2. Build canonical manifest `{ requestId, title, description, attachments:[{documentId, originalName, fileSize, sha256}], signerId, signedAt }`; each `sha256` computed from file bytes via storage client at sign time.
3. `signature_hash = SHA-256(canonical JSON)`; store hash + manifest immutably; mirror to `audit_logs`.
4. `GET /:id/verify-signatures` recomputes from current content and flags mismatches (tamper-evidence).

## 6. Integration points

- **Notifications:** `notificationQueueService.enqueue('in_app'|'email', ...)` with new template event keys: `workflow.request.created`, `.approved`, `.signed`, `.rejected`, `.commented`, `.completed`, `.cancelled`, `.escalation.level_1`, `.escalation.level_2`. Seed in/email templates (raw-text fallback exists).
- **Documents:** attachments via `DocumentService.upload(...)`; list via existing by-entity query.
- **Escalation:** add `workflow_request` to `WorkflowEscalationEntityType`; new sweep in `checkAndEscalate()` over `pending` requests using the `all` policy thresholds. Targets: L1 → current recipient, L2 → initiator (cap at 2).
- **Unified inbox:** `GET /workflow/requests/inbox` (requests where caller is current recipient); extend `dashboardService.getApprovalInboxSummary` to add a `requests` pending count.
- **Audit trail:** `auditLogService.logAsync(...)` on every state change.

## 7. API surface (`/workflow/requests`)

| Method | Path | Permission |
|---|---|---|
| POST | `/` | `request:create` |
| POST | `/:id/attachments` (multipart) | `request:create` (initiator, pre-lock) |
| GET | `/` (mine: initiated + received) | `request:read` |
| GET | `/inbox` (current recipient) | `request:read` |
| GET | `/candidates` (eligible recipients) | `request:create` |
| GET | `/:id` (detail: steps, actions, attachments) | `request:read` |
| POST | `/:id/approve` | `request:act` |
| POST | `/:id/sign` | `request:act` |
| POST | `/:id/reject` | `request:act` |
| POST | `/:id/comment` | `request:act` |
| POST | `/:id/cancel` | `request:create` (initiator) or `request:admin` |
| GET | `/:id/verify-signatures` | `request:read` |

Visibility: a caller sees a request if they are the initiator, a step recipient, or hold `request:admin`.

## 8. Permissions (seed)

New permissions in module `workflow`: `request:create`, `request:read`, `request:receive`, `request:act`, `request:admin`. Granted to all seeded roles **except `viewer`** (`request:admin` to `super_admin` + `audit_manager`). RBAC remains GBB-configurable.

## 9. Frontend (Next.js, built with `/ui-ux-pro-max`)

Requests area:
- **List / Inbox** — tabs for "My requests" (initiated) and "To action" (inbox), status chips.
- **Create wizard** — title/description, ordered recipient picker (from `/candidates`), attachment upload.
- **Detail** — content + attachments, a vertical **timeline** of steps and the action/comment ledger, and contextual action buttons (approve / sign / reject / comment) for the current recipient.
- **Sign modal** — affirmation (typed name) + content summary before signing.
Built after the backend is complete and verified.

## 10. Conventions & non-goals

- Follows the `user`/`approval` module layout exactly; permission-based gates (`assertHasPermission`); all mutations logged; transactions for multi-write ops; soft-delete via `deleted_at`.
- **Non-goals (YAGNI):** parallel/branching routing, PKI/cryptographic signatures, password re-auth on sign, editing content after lock, delegation/re-assignment of steps, SMS.
