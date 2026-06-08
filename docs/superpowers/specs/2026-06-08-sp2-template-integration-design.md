# SP2 — Template Integration — Design

> Status: Approved (design) · Date: 2026-06-08 · Branch: `sp2-template-integration`
> Author: Wole + Claude · Part of the IAMS frontend refinement programme (follows SP1)

---

## 1. Background & problem

IAMS has a managed template library — 11 working-paper templates and 5 report templates,
created/edited in the Settings UI — but the templates are barely used where work happens:

1. **Working papers:** the "New working paper" form silently loads only the **default**
   template for the engagement's audit type (`workingPaperTemplatesApi.getDefault(auditType)`
   in `WorkingPapersTab.tsx`). The other templates (walkthrough, control test, sampling,
   ITGC, finding-validation, follow-up-verification, …) are unreachable by auditors.
2. **Working-paper view/edit bug:** template-created working papers store content as
   `{"sections":[…]}` JSON, but `ViewPaperSlideOver` dumps that raw JSON into a monospace
   textarea instead of rendering the named sections.
3. **Reports:** `ReportTab.tsx` never selects a template — `reportsApi.generate` sends no
   `templateId`, and the report generator
   (`report-generation.service.ts → fetchTemplateAndConfig()`) is **hardcoded** to
   `reportTemplateService.getDefaultTemplate()`. The A4 preview hardcodes
   "Galaxy Backbone / CONFIDENTIAL / green". The 5 report templates in Settings are dead UI.

SP2 closes "templates exist but aren't used" for both working papers and reports.

It builds on SP1's primitives (`Tooltip`, `InfoHint`, richer `FormField`, `ReasonDialog`)
and follows existing module conventions (see `CLAUDE.md`). Working-paper changes are
frontend-only (the backend already accepts `templateId` on working-paper create). Report
changes are full-stack: an additive nullable column plus threading a chosen template id
through generation/export.

### Market validation (research, carried from SP1)

IIA working-paper guidance stresses standardized, selectable templates and work programs
that make the task explicit; reports are decision tools that must be clear and consistently
branded. Surfacing the template library at the point of work — not just in admin settings —
is the expected pattern in TeamMate+/AuditBoard.

---

## 2. Goals / non-goals

### Goals
- Let auditors **choose** a working-paper template (not just the silent default) when
  creating a working paper, with a "Blank (free text)" escape hatch.
- Render template-based working papers as **structured sections** in view/edit, not raw JSON.
- Let report authors **choose** a report template at generation (and change it on a
  draft/rejected report), persisted on the report.
- Make report **generation, export, and on-screen preview** all use the chosen template
  (falling back to the system default when none is set).

### Non-goals (deferred / out of scope)
- Editing template **definitions** — that already exists in the Settings UI.
- Rich-text / markdown rendering inside working-paper sections (plain textareas, as today).
- Template versioning or per-engagement template overrides.
- Re-generating a report after creation (one report per engagement; unchanged).
- Any change to the working-paper backend (it already accepts `templateId`).

---

## 3. Architecture & units

All frontend paths under `frontend/`; backend under `src/`.

| Unit | Files | Layer |
|---|---|---|
| **A1** WP template picker | `components/audit/engagements/WorkingPapersTab.tsx` (CreateOrEditPaperSlideOver) | FE |
| **A2** Structured WP view/edit | `components/audit/engagements/WorkingPapersTab.tsx` (ViewPaperSlideOver) | FE |
| **B1a** Schema migration | `prisma/schema.prisma` + `prisma/migrations/<new>/` | BE |
| **B1b** Generate DTO + service | `src/modules/audit/report/dto/request/report.request.dto.ts`, `…/controller/report.controller.ts`, `…/service/implementation/report.service.ts` | BE |
| **B1c** Generation threading | `src/modules/audit/report/service/implementation/report-generation.service.ts`, `…/service/interface/report-generation.service.interface.ts` | BE |
| **B1d** Response DTO | `src/modules/audit/report/dto/response/report.response.dto.ts` | BE |
| **B2** Report selector + branded preview | `components/audit/engagements/ReportTab.tsx`, `lib/api/audit.ts`, `lib/types/domain.ts` | FE |

---

## 4. A1 + A2 — Working-paper templates (frontend only)

### A1 — Template picker
- `CreateOrEditPaperSlideOver` (inside `WorkingPapersTab.tsx`) currently calls
  `workingPaperTemplatesApi.getDefault(auditType)` and renders that template's sections.
- Change to: fetch all templates via `wpTemplatesApi.list()` (already exists) and render a
  template `<Select>` at the top of the form. Options: every active template, plus a
  **"Blank (free text)"** option (value `''`).
- **Default selection:** preselect the template whose `isDefault === true` for the
  engagement's `auditType`; if none, fall back to "Blank".
- Changing the selection swaps the rendered section fields to the chosen template's
  `sections` (reset section contents). "Blank" shows the existing single free-text
  `Content` textarea.
- On save, pass the chosen `templateId` to `workingPapersApi.create({ title, content,
  templateId })` (the create API already accepts `templateId`; content remains the same
  JSON-sections shape for templated papers, or free text for blank).
- Use SP1's `FormField` for the picker label, with an `InfoHint` explaining template choice.

### A2 — Structured view/edit
- `ViewPaperSlideOver` receives a working paper whose `content` is either:
  - **Templated:** a JSON string `{"sections":[{ "title", "content" }, …]}`, or
  - **Free text:** any other string.
- Add a parse helper: try `JSON.parse(content)`; if it yields `{ sections: Array<{title, content}> }`, treat as templated.
- **Templated render:** show each section's `title` as a heading and its `content` in a
  textarea (read-only unless the paper is `draft`/`rejected` and the user can edit). On save,
  re-serialize to the same `{"sections":[…]}` JSON shape via `workingPapersApi.update`.
- **Free-text render:** unchanged — single textarea.
- This removes the raw-JSON dump. No backend change.

---

## 5. B1 — Report backend (additive, safe)

### B1a — Schema migration
- Add a nullable `template_id` column to the `audit_reports` model in
  `prisma/schema.prisma`, **typed exactly like the existing id / `*_id` columns in that
  model** (match their Prisma/`@db` typing — do not introduce a new column type). It is
  **nullable** with **no relation/FK** (avoids SQL Server "multiple cascade paths";
  validated in the service). Add `@@index([template_id])` for consistency with other
  FK-like columns.
- New migration `prisma/migrations/<timestamp>_add_report_template_id/` created via
  `prisma migrate dev`. Nullable column → no backfill; existing reports read as `null` →
  default-template behavior (unchanged).

### B1b — Generate DTO + service
- Add `GenerateReportRequestSchema` to `report.request.dto.ts`:
  `{ title?, executiveSummary?, scope?, methodology?, templateId?: string (uuid) }`
  (all optional; `templateId` is a uuid string). Export `GenerateReportRequestDto`.
- Add `templateId` (optional uuid) to `UpdateReportRequestSchema` so a `draft`/`rejected`
  report can switch template before submission.
- Wire `validate(GenerateReportRequestSchema)` on the generate route in
  `report.controller.ts` (currently the route has **no** validation middleware — this is a
  small correctness improvement).
- In `report.service.ts#generateReport`: if `dto.templateId` is provided, call
  `reportTemplateService.getTemplateById(dto.templateId)` (throws `notFound` if missing →
  surfaces as 404) to validate, then persist `template_id` on the created `audit_Report`.
  `updateReport` similarly persists `template_id` when provided (and editable).
- `ReportService` needs access to `IReportTemplateService` — inject it via the constructor
  (the module factory already constructs the report template service for the generation
  service; pass the same instance). Confirmed acceptable: follows the existing
  cross-service injection pattern (`CLAUDE.md` §5.2).

### B1c — Generation threading
- `IReportGenerationService` / `ReportGenerationService`:
  - `fetchReportData` already loads the report row; add `template_id` to the returned
    `ReportData.report` shape (`templateId: string | null`).
  - Change `fetchTemplateAndConfig()` → `fetchTemplateAndConfig(templateId?: string | null)`:
    if `templateId` is set, `reportTemplateService.getTemplateById(templateId)` inside a
    try/catch; on missing/error, fall back to `getDefaultTemplate()`. If null, default.
  - `generateDocx`, `generatePdf`, `exportReport` already call `fetchReportData(reportId)`
    first; pass `data.report.templateId` into `fetchTemplateAndConfig(...)`.
- No change to the DOCX/PDF rendering internals — they already read
  header/footer/signature/colors/sections from the resolved template.

### B1d — Response DTO
- Add `templateId: string | null` to `ReportResponseDto` and map it in
  `mapReportToResponse` (`report.template_id ?? null`). The existing `reportInclude` uses
  `include` (not `select`), so scalar `template_id` is already returned by Prisma — update
  the `mapReportToResponse` input type to include `template_id`.

---

## 6. B2 — Report frontend

### Selector
- `reportsApi.generate(engagementId, { title, executiveSummary, scope, methodology,
  templateId })` — add `templateId` to the payload type in `lib/api/audit.ts`.
- In `ReportTab.tsx`'s generate form, add a report-template `<Select>` from
  `reportTemplatesApi.list()`. Default selection = the template with `isDefault === true`
  (else first). Include an SP1 `InfoHint` noting the template controls report
  branding/sections. Submit the selected `templateId` with the generate mutation.

### Branded preview
- `AuditReport` type in `lib/types/domain.ts` gains `templateId: string | null`.
- The A4 "Preview" view in `ReportTab.tsx` currently hardcodes org name, "CONFIDENTIAL",
  and colors. Resolve the **applied template**: if `report.templateId`, find it in
  `reportTemplatesApi.list()` (already fetched for the selector) or fetch by id; else use the
  default template. Drive from its config:
  - org name + address (header) and report title,
  - `classification` (replaces hardcoded "CONFIDENTIAL"),
  - primary/accent colors (replaces hardcoded green) for headings/rules,
  - section titles/order from `template.sections`,
  - footer notice.
- Result: the on-screen preview matches the exported DOCX/PDF. Where a template field is
  absent, use the same fallbacks the backend uses (org name "Galaxy Backbone Limited",
  classification "CONFIDENTIAL", title "INTERNAL AUDIT REPORT", colors `#003087`).

---

## 7. Data flow, errors, compatibility

- **Data flow (report):** generate form → `POST …/report/generate` with `templateId` →
  service validates + persists `template_id` → on export/preview, the stored `template_id`
  resolves the template (default fallback) for DOCX/PDF/preview.
- **Errors:** invalid `templateId` at generate → 404 (`getTemplateById`). If a referenced
  template is later deleted, generation/export/preview fall back to the default template
  rather than failing.
- **Compatibility:** the migration is a nullable additive column; existing reports
  (`template_id = null`) behave exactly as today. Existing free-text working papers still
  render in the plain textarea. No breaking API changes; `templateId` is optional everywhere.

---

## 8. Verification

- **Backend:** `npm run build` (tsc) passes; `npx prisma validate`; migration applies
  cleanly via `prisma migrate dev`.
- **Frontend:** `npx tsc --noEmit` + `npm run build` pass.
- **Manual:**
  - Create a working paper choosing a **non-default** template; confirm its sections render;
    reopen it (view/edit) and confirm structured sections (not raw JSON); edit + save a
    draft.
  - Create a working paper with **"Blank"**; confirm free-text path still works.
  - Generate a report selecting a specific template; confirm the on-screen preview reflects
    that template's title/classification/colors/sections, and the exported PDF + DOCX match.
  - Generate a report with the default (no explicit pick) → unchanged behavior.
- **Tech debt (unchanged from SP1):** no automated frontend tests; backend has Jest but no
  report tests — manual verification + build gates apply.

---

## 9. Roadmap context

SP2 is the second of four sub-projects (each its own spec → plan → build):
- **SP1 — UI foundations & help layer** — done, merged to `dev`.
- **SP2 — Template integration** (this doc).
- **SP3 — Start-Audit guided wizard** (create-and-assign; introduces combobox /
  multi-user-select; small additive backend). Depends on SP1.
- **SP4 — Navigation & IA clarity.** Depends on SP1.
