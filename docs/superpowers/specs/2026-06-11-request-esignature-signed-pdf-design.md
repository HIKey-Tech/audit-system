# Design — Request E-Signature: Signed-PDF Output (Feature #1)

**Date:** 2026-06-11
**Status:** Approved (design); pending implementation plan
**Module(s):** `user`, `workflow/request`, frontend (Settings, Requests)

---

## 1. Context & problem

IAMS workflow **Requests** let a user route a document/note to colleagues who **Approve**, **Sign**, or **Reject** it in sequence. Signing today produces an *invisible* e-signature: the request service builds a manifest (title + each attachment's SHA-256 + signer identity + timestamp), hashes it, and stores the hash. "Verify signatures" re-hashes current content to detect tampering. See `src/modules/workflow/request/utility/signature.utility.ts`.

**Gap:** when a signed document is downloaded and leaves IAMS, it shows no visible sign of being signed. Stakeholders outside the system (auditees, management, regulators) can't see *who* signed it.

**Goal of this feature:** produce a **downloadable signed PDF** that visibly shows each signer's real handwritten signature, so the document is self-evidently signed when opened outside IAMS — without losing the existing tamper-evident hash.

### Driver (confirmed)
Signed documents leave IAMS and must look signed externally.

### Scope decomposition
This is feature **#1 of 3**. The other two are separate specs:
- **#2 — Word/non-PDF support:** convert uploaded Word docs (and images) to PDF so they can be signed. Needs a file-conversion capability (e.g. LibreOffice headless) — an infrastructure dependency pending GBB.
- **#3 — In-app text editor:** author documents inside IAMS that render to PDF and feed the same sign flow.

All three share one foundation: **at signing time, everything becomes a PDF that gets stamped.** This spec builds that foundation for **PDF attachments only**.

---

## 2. Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Driver | Signed doc leaves IAMS; must look signed externally |
| Scope now | PDF attachments only (Word + editor are later features) |
| Signature creation | Each user sets up a signature once in **Settings**: **Draw** (canvas) or **Upload** (image) |
| No signature yet at sign time | **Set it up inline** in the Sign dialog, save to profile, continue signing |
| Appearance | Real signature image, **appended** on a signature page (originals untouched) |
| Multi-attachment | **Sign each PDF attachment** (append signature page to each); if no attachment, generate a **standalone certificate PDF** |
| Timing | Generate **once, when the request completes** |
| Integrity model | **Option A** — visible signature image **+** keep existing SHA-256 manifest hash printed on the page. No PKI/PAdES (deferred; Option B layered later if GBB mandates qualified signatures) |
| PDF library | **`pdf-lib`** (pure TypeScript, in-process, no headless Chromium) |

---

## 3. Architecture

Modular monolith conventions apply (`audit-system/CLAUDE.md`). Originals are never modified; signed copies are new documents.

### Component placement
- **User signature** → `user` module. New service methods to set/get/clear the active signature. Image stored via the existing **storage client / document module** (not a raw DB blob).
- **Signed-PDF generation** → `workflow/request` module. New `signed-document` utility (pure pdf-lib helpers) + a service method invoked on request completion.
- **Frontend** → three touch-points:
  - Settings → **Signature** section.
  - Sign dialog → **inline setup** when no signature exists.
  - Request detail → **Download signed document** (once completed).

### What stays untouched
The manifest-hash signing and "Verify signatures" are unchanged. The signed PDF simply *prints* the manifest hash + per-file checksum as its integrity block. Non-PDF attachments are skipped (feature #2).

---

## 4. Data model (Prisma, snake_case, soft-delete)

### `user_signatures` — one active signature per user
| Column | Notes |
|---|---|
| `id` | UUID PK |
| `user_id` | FK → users |
| `document_id` | FK → documents (the stored PNG/JPG) |
| `kind` | `'drawn' \| 'uploaded'` |
| `created_at`, `updated_at`, `deleted_at` | soft-delete; replacing a signature soft-deletes the prior row (history auditable) |

Invariant: at most one row per user with `deleted_at = null`.

### `workflow_request_signed_documents` — original → signed mapping
| Column | Notes |
|---|---|
| `id` | UUID PK |
| `request_id` | FK → workflow_requests |
| `source_document_id` | FK → documents; **null** for the standalone certificate |
| `signed_document_id` | FK → documents (the generated signed PDF) |
| `generated_at` | timestamp |

### Sign action → signature linkage
Record which `user_signatures` row was used when a step is signed (e.g. a nullable `signature_id` on the existing request action/step record), so generation knows which image to stamp even if the user later changes their signature.

---

## 5. Flows

### Flow A — Set up signature (Settings)
1. "Signature" card. If none: **Draw** tab (canvas: draw, Clear, Save) and **Upload** tab (PNG/JPG, transparent PNG recommended; type + size validated client *and* server, max ~2 MB).
2. On save: image stored via storage client as a Document; `user_signatures` row created (prior soft-deleted if replacing).
3. Card then shows a preview with **Replace** / **Remove**.
4. Self-service — every user manages their own; no special permission.

### Flow B — Signing a request (upgraded Sign dialog)
1. On **Sign**, dialog checks for an existing signature.
2. **None:** inline Draw/Upload appears; user creates it, it saves to profile, signing continues (no dead-end).
3. **Exists:** preview shown ("Sign as ✍️ *[signature]*"). User still **types full name to affirm** (preserves the manifest-hash signature) and confirms.
4. Backend records the sign action exactly as today, **plus** associates the `user_signatures` row used.

### Flow C — Produce signed PDF (on completion)
1. When the final step completes and status → **Completed**, the workflow service calls the `signed-document` generator.
2. For **each PDF attachment**: load with `pdf-lib`, append a **signature page** listing every participant:
   - **Signers:** stamped signature image + name, role, timestamp.
   - **Approvers:** "Approved (no signature)" + name + timestamp.
   - **Integrity block:** request reference + SHA-256 manifest hash + per-file checksum.
3. **No attachment:** generate a standalone **certificate PDF** from request details with the same signature page.
4. Each signed copy saved as a new Document and linked via `workflow_request_signed_documents`.
5. Request detail page shows **Download signed document**.

Deliberate: the typed-name affirmation is kept *in addition* to the stored image — it is what keeps the tamper-evident hash valid. Generation is one-shot (completed requests are locked).

---

## 6. Error handling & edge cases

| Case | Handling |
|---|---|
| Non-PDF attachment (Word/image) | Skipped, left untouched; not included in signed-documents mapping. UI notes "Signed copy available for PDF attachments only." (→ feature #2) |
| Corrupt / encrypted / password-protected PDF | `pdf-lib` throws; catch **per-attachment**, log, mark that one failed, still generate the others + certificate. Never crashes the request flow. |
| Signer used Approve, not Sign | Shown as "Approved (no signature)" + name + timestamp; only true signers get a stamped image. |
| User removes signature after signing | Signed copy already embedded the image at generation time → unaffected. `user_signatures` is soft-deleted, preserving audit trail. |
| Bad signature upload (type/size) | Validated client + server (PNG/JPG, ≤ ~2 MB). |
| Regeneration | Not needed — completed requests are locked; one-shot. |

**Permissions:** signature setup is self-service. Downloading a signed document reuses existing request-participant access (initiator or a recipient).

---

## 7. Testing (Jest, service-level focus)

- `signed-document` utility: appends a page, embeds a PNG, prints correct metadata, emits a valid PDF byte stream; standalone-certificate path when no attachment.
- Per-attachment failure isolation: one corrupt PDF → others still generated.
- `user` signature service: create / replace (soft-deletes prior) / remove.
- Workflow completion: a completed request creates the expected `workflow_request_signed_documents` rows; approvers vs signers render correctly on the page.

---

## 8. Out of scope (this feature)

- Word / non-PDF conversion (feature #2).
- In-app document text editor (feature #3).
- True cryptographic/PKI digital signatures (PAdES) — Option B, deferred pending GBB identity/PKI decisions; the design keeps this addable later.
- Drawn-on-page signature placement (clicking where on the page each signature goes) — appended page only for now.
