# Design — Approval E-Signatures: "Approve & Sign" for audit approvals (Feature #4)

**Date:** 2026-06-17
**Status:** Draft — for review (no implementation until approved)
**Module(s):** `workflow/approval`, `audit/report`, `audit/working-papers`, `user` (reuse), frontend (approvals + report/WP views, Profile)
**Builds on:** [2026-06-11-request-esignature-signed-pdf-design.md](2026-06-11-request-esignature-signed-pdf-design.md) (feature #1). Reuses the per-user signature foundation that feature shipped.

---

## 1. Context & problem

IAMS has **two unrelated approval engines**:

| Engine | Used by | Verbs today | Output |
|---|---|---|---|
| `Workflow_Request` | ad-hoc routed documents | Approve / **Sign** / Reject | signed PDF (feature #1 ✅) |
| `Workflow_Approval` | **audit plans, working papers, reports, finding closures** | Approve / Reject only | generated on demand |

Feature #1 added visible signatures to **requests** only. Everything that a head user actually signs off in the audit lifecycle — plans, working papers, **reports**, finding closures — flows through `Workflow_Approval`, which has **no signature concept at all**: no "sign" action, no per-user signature recorded, nothing visible on the output.

**Goal:** make every approval in `Workflow_Approval` an **"Approve & Sign" in one action** — the head user's approval stamps their real signature onto the entity's output (or records it visibly where there is no document), across **all four approval entity types**. Reuse the signature each user already sets up in their Profile.

### Confirmed decisions (from the user)
- **All flows** matter: audit plans, working papers, reports, finding closures.
- **Approve and sign are one action** — there is no separate "sign" step; approving *is* signing.
- **Require a signature to approve reports & working papers** (inline setup in the dialog; no dead-end). Plans/finding closures may approve without one.
- **No typed-name affirmation** — clicking **"Approve & Sign"** is the affirming act.
- **Freeze the output**: at final-level approval, generate an **immutable signed copy** (stored Document + mapping table), like feature #1. Live re-export is not the record of truth.
- Because we freeze, **every flow gets a downloadable signed artifact**: reports & working papers → the generated PDF with signatures embedded; plans & finding closures → a standalone certificate PDF (reusing feature #1's `buildCertificatePdf`).
- This document is a **design doc**; implementation follows after approval.

---

## 2. Why this is NOT just "feature #1 again"

Feature #1 appends a `pdf-lib` page to an **uploaded** PDF attachment. Approval entities have **no uploaded attachment to stamp** — their output is **system-generated**, and the generators already know the approvers:

- **Reports & working papers** are generated on demand via **Puppeteer** (`page.pdf()`) and `docx` `Packer`. The report generator **already renders a signature block** that iterates `approval.steps.filter(s => s.status === 'approved')` with "Prepared by / Reviewed by / Approved by" labels (`_buildDocxSignatureBlock`, the HTML `.signature-table`). **The slots already exist — they're just text today.**
- **Plans & finding closures** have **no generated document** at all; approval is a pure state change.

So the work is fundamentally different from feature #1:
1. **Record** which signature each approver used (one small schema change, shared across all four types).
2. **Reports / working papers:** drop the approver's signature **image** into the *existing* signature block (HTML `<img>` for the Puppeteer PDF; `ImageRun` for the DOCX). No appended page, no new stored Document.
3. **Plans / finding closures:** record + display the signature in-app; optionally emit a standalone certificate PDF (reusing feature #1's `buildCertificatePdf`).

---

## 3. Decisions (proposed — please confirm the ⚑ items)

| Topic | Decision |
|---|---|
| Action model | **Approve & Sign = one action.** Extend `ApprovalService.approve()` to resolve and record the approver's active signature on the step. Reject is unchanged (no signature). |
| Signature source | **Reuse `user_signatures`** + the Profile → Signature setup shipped in feature #1. Nothing new for signature capture. |
| Where it shows | Reports & working papers: signature **image embedded in the existing signature block**. Plans & finding closures: recorded + shown in-app (signed-off chip + image). |
| Schema | One nullable column `signature_id` on `workflow_approval_steps` (FK → `user_signatures`). No new tables. |
| ⚑ Require a signature to approve? | **Recommended: yes for report & working paper** (the whole point is visible sign-off) via **inline setup** in the approve dialog (no dead-end, mirrors feature #1). Plans/finding closures: **optional** (approve still works without one). |
| ⚑ Typed-name affirmation? | Requests require typing your full name to affirm. **Recommended: yes**, for parity and evidentiary weight, on report & WP approvals. |
| ⚑ Integrity hash? | Requests print a SHA-256 manifest. Approvals have none today. **Recommended: defer** (Option A — visible signature only) to keep scope sane; revisit if GBB mandates it. |
| ⚑ Certificate for plans/finding closures? | **Recommended: defer** — record + in-app display first; add a downloadable certificate later only if needed. |
| PDF/DOCX libs | No new dependency — reports/WP already use Puppeteer + `docx`; image embedding is native to both. `pdf-lib` only if we later add the optional plan/finding certificate. |

---

## 4. Architecture

Modular-monolith conventions apply. Originals/data are never destructively modified; signatures are additive.

### Component placement
- **Record the signature** → `workflow/approval`. `ApprovalService.approve()` resolves `userSignatureService.getActiveSignatureRef(actor.id)` and writes `signature_id` on the claimed step (inside the existing atomic `updateMany`).
- **Embed in output** → `audit/report` + `audit/working-papers` generators. They already fetch the approval; extend their signature-block builders to load each approver's signature image (via `IDocumentService.getFileById(sig.document_id)`) and render it.
- **Expose the signature image to the generator** → the approval response DTO (or a small lookup) must carry each step's `signature_id` so the generator can resolve the image. Cross-module reads go through service interfaces (no reaching into another module's Prisma).
- **Frontend** → the existing approve action UI (pending-approvals list, report/WP approval buttons) gains inline signature setup + an "Approve & Sign" affirmation, mirroring the request Sign dialog. Signature setup itself already lives in **Profile → Signature**.

### What stays untouched
The approver chain resolution, level claiming/concurrency guard, `approvalStatusService.markApproved/markRejected`, and notifications are all unchanged. Reject is untouched.

---

## 5. Data model (Prisma, snake_case)

### `workflow_approval_steps` — add one column
| Column | Notes |
|---|---|
| `signature_id` | `String?` FK → `user_signatures.id`. Set only on **approve**, only when the approver has an active signature. Null = approved without a stored image (allowed for plans/finding closures, or legacy rows). |

Back-relation on `User_Signature` (`approval_steps Workflow_Approval_Step[]`). No new tables. The signature image already lives as a `Document` (feature #1); we reference it, never copy bytes into the DB.

> Rationale for "no signed-output table" (unlike feature #1): report/WP output is **generated live** every download and already reflects current approval state, so there is nothing to persist a mapping for. If we later decide to **freeze** a signed PDF at approval time (immutability), that becomes a follow-up — see Open Questions.

---

## 6. Flows

### Flow A — Set up signature
Unchanged from feature #1: **Profile → Signature** (draw or upload, one active per user, soft-delete history). Already shipped.

### Flow B — Approve & Sign (the core change)
1. Head user opens a pending approval (report / WP / plan / finding closure).
2. Dialog checks for an active signature:
   - **None + entity requires it (report/WP):** inline Draw/Upload appears; saving stores it to their profile; then they can proceed (no dead-end).
   - **Exists:** preview shown ("Approving & signing as ✍️ *[image]*").
3. ⚑ User types full name to affirm (if we keep affirmation), then clicks **Approve & Sign**.
4. `ApprovalService.approve()` claims the step atomically (as today) **and** writes `signature_id` = the approver's active signature. Final-level completion still calls `markApproved`.
5. Reject path is unchanged and needs no signature.

### Flow C — See the signature
- **Report / working paper:** on next **export/preview** (PDF or DOCX), the existing signature block renders each approver's **image** above their name/role/label/timestamp instead of a blank line. Because generation is live, the document is always current.
- **Plan / finding closure:** the approval timeline / detail view shows each approver's stamped signature image + name + timestamp in-app.

---

## 7. Per-entity output matrix

| Entity | Has generated doc? | What "sign" does |
|---|---|---|
| **Audit report** | Yes (Puppeteer PDF + `docx`) | Embed approver image in the existing signature block (HTML `<img>` / `ImageRun`) |
| **Working paper** | Yes (Puppeteer PDF) | Same — embed in its signature/sign-off area |
| **Audit plan** | No | Record + in-app display; ⚑ optional certificate later |
| **Finding closure** | No | Record + in-app display; ⚑ optional certificate later |

---

## 8. Error handling & edge cases

| Case | Handling |
|---|---|
| Approver has no signature (plan/finding) | Approve still succeeds; `signature_id` null; in-app shows "Approved (no signature)". |
| Approver has no signature (report/WP) and we require it | Approve blocked client-side until inline setup saves one (mirrors feature #1). Server still tolerates null for safety. |
| Signature image missing/unreadable at generation | Generator falls back to the current text-only block for that approver; never fails the export. |
| Approver changes signature later | The step stored the `signature_id` used at approval time, so the embedded image stays the one they signed with. |
| Permission-pool step (`approver_id` null) | Whoever actually acts is recorded as `approver_id`; their signature is the one stamped. Unchanged claim logic. |
| Concurrent approve/reject | Existing atomic `updateMany` guard is untouched; `signature_id` is written in the same claim. |
| Reject | No signature, no change. |

**Permissions:** signing rights = existing approval rights (`report:approve`, `working_paper:approve`, `finding:close`, plan chain). Signature setup remains self-service.

---

## 9. Testing (manual per current convention; user runs it)

- Approve a **report** with a signature set → exported PDF **and** DOCX show the stamped image in the signature block; multi-level chain stamps each approver in order.
- Approve a **working paper** → same in its output.
- Approve a **plan** / **finding closure** with and without a signature → recorded + shown in-app; "no signature" rendered when absent.
- Reject → unaffected, no signature.
- Change signature after approving → previously-signed output keeps the original image.
- Permission-pool level → the actual actor's signature is the one stamped.

---

## 10. Out of scope (this feature)
- Freezing/immutable signed snapshots of reports/WP at approval time (live generation only — see Open Questions).
- Integrity/manifest hash for approvals (Option A: visible signature only; deferrable like feature #1's Option B).
- Standalone certificates for plans/finding closures (recordable later).
- PKI/PAdES cryptographic signatures.
- Changing the approver chain, matrix, or notification behavior.

---

## 11. Open questions — RESOLVED (2026-06-17)

1. **Require a signature to approve reports & working papers?** → **Yes**, with inline setup (no dead-end). Plans/finding closures may approve without one.
2. **Keep the typed-name affirmation?** → **No.** Clicking **"Approve & Sign"** is the affirming act.
3. **Live vs frozen output?** → **Freeze.** A signed artifact is generated and stored at final approval (mapping table `workflow_approval_signed_documents`).
4. **Plans & finding closures — certificates?** → **Yes**, since we freeze: a standalone certificate PDF is generated for them too.
5. **Affirmation/legal wording** → moot (no affirmation step).

Implementation plan: `docs/superpowers/plans/2026-06-17-approval-esignature.md`.

---

## 12. Rough implementation outline (for the eventual plan — not part of this design)
1. Schema: `signature_id` on `workflow_approval_steps` + back-relation; migration.
2. `ApprovalService.approve()`: resolve + persist `signature_id`; surface it on `ApprovalResponseDto`/steps.
3. Report generator: embed image in `_buildDocxSignatureBlock` + `_buildPdfHtml` signature table.
4. Working-paper generator: embed image in its sign-off block.
5. Frontend: "Approve & Sign" dialog (inline setup + affirmation) on the approval action surfaces; in-app signature display for plans/finding closures.
6. Docs: update `PROJECT_STATE.md`.
