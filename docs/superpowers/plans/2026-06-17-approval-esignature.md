# Approval E-Signatures ("Approve & Sign") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every `Workflow_Approval` action an "Approve & Sign" — the approver's stored signature is recorded on the step and, at final approval, frozen into an immutable signed artifact (report/working-paper PDF with signatures embedded, or a certificate PDF for plans/finding closures), downloadable from the entity.

**Architecture:** Backend modular monolith (Node + Express + TypeScript + Prisma, SQL Server). Reuses the per-user signature foundation already shipped (`user_signatures`, Profile → Signature, `userSignatureService`). `ApprovalService.approve()` records the approver's active `signature_id` on the claimed step. On final-level approval it fires (fire-and-forget, post-commit, via dynamic import to avoid an import cycle) a new audit-side `ApprovalSignedDocumentService` that generates the frozen output per entity type, stores it as a new Document, and maps it via `workflow_approval_signed_documents`. Report & working-paper generators embed each approver's signature image into their existing signature block. Frontend turns the existing Approve button into "Approve & Sign" with inline signature setup, and adds a signed-document download.

**Tech Stack:** TypeScript (strict), Prisma, Express, Puppeteer (existing, report/WP PDF), `docx` (existing, report DOCX), `pdf-lib` (existing from feature #1, certificate path); Next.js 14, React Query, Tailwind, lucide-react.

**Source spec:** `docs/superpowers/specs/2026-06-17-approval-esignature-design.md`

## Global Constraints

- **No automated tests / no Jest** — per project owner: build + manual verification only. Each task ends with `npx tsc --noEmit` and a manual smoke step, not a test file.
- Prisma fields are `snake_case` with `@@map`; every table has `id` (uuid) + `created_at`; soft-delete via `deleted_at` where it applies. SQL Server FKs use `onDelete: NoAction, onUpdate: NoAction`.
- Services are class-based, stateless, throw `AppError.*`, log mutations via `logger`; controllers register routes in `_registerRoutes()`, handlers are `_action` private methods `.bind(this)`, wrapped in `try/catch(next)`, respond with `buildResponse(...)`.
- The signature image is stored as a `Document` (feature #1). Never copy image bytes into other tables — reference `user_signatures.id` / `documents.id`.
- Error class path is `shared/errors/app.error`. Prisma client is `shared/prisma/prisma.client`. There is **no** `documentService` singleton export — use `new DocumentService()`.
- Decisions (locked): require a signature to approve **reports & working papers** (inline setup, no dead-end); **no typed-name affirmation** (clicking "Approve & Sign" is the act); **freeze** an immutable signed copy at final approval; every entity type yields a downloadable artifact.

---

## File Structure

**Backend — created**
- `src/modules/audit/approval-signature/service/interface/approval-signed-document.service.interface.ts` — `IApprovalSignedDocumentService`.
- `src/modules/audit/approval-signature/service/implementation/approval-signed-document.service.ts` — generates + stores the frozen signed artifact per entity type.

**Backend — modified**
- `prisma/schema.prisma` — `signature_id` on `Workflow_Approval_Step`; new `Workflow_Approval_Signed_Document`; back-relations on `User_Signature`, `Workflow_Approval`, `Document`.
- `prisma/migrations/<ts>_add_approval_esignature/migration.sql` — hand-written (DB applies via `migrate deploy`).
- `src/modules/workflow/approval/service/implementation/approval.service.ts` — record `signature_id` on approve; fire freeze on completion; `listSignedDocuments()`.
- `src/modules/workflow/approval/service/interface/approval.service.interface.ts` — add `listSignedDocuments`.
- `src/modules/workflow/approval/dto/response/approval.response.dto.ts` — `signatureId` on step DTO + a `SignedApprovalDocumentDto`.
- `src/modules/workflow/approval/controller/approval.controller.ts` — `GET /workflow/approvals/:id/signed-documents`.
- `src/modules/audit/report/service/implementation/report-generation.service.ts` — add `documentService` dep; embed signature images in PDF + DOCX signature blocks.
- `src/modules/audit/working-papers/service/implementation/working-paper.service.ts` — fetch approval, embed signature images in the WP PDF sign-off block.
- `src/modules/audit/index.ts` — pass `documentService` into `ReportGenerationService`.

**Frontend — modified**
- `frontend/lib/types/domain.ts` — `signatureId` on approval step type; `SignedApprovalDocument` type.
- `frontend/lib/api/workflow.ts` — `approveAndSign` flow (reuse `signatureApi`), `signedApprovalDocuments(id)`.
- The approval action surfaces (pending approvals list + report/working-paper approval buttons) — "Approve & Sign" dialog with inline signature setup; signed-document download.

---

## Phase 0 — Database

### Task 1: Schema — `signature_id` + signed-document mapping

**Files:** Modify `prisma/schema.prisma`; create the migration SQL.

**Interfaces:**
- Produces: `Workflow_Approval_Step.signature_id` (nullable FK → `user_signatures`); model `Workflow_Approval_Signed_Document` with `prisma.workflow_Approval_Signed_Document` accessor.

- [ ] **Step 1: Add `signature_id` to `Workflow_Approval_Step`**

In `model Workflow_Approval_Step`, after `acted_at`:
```prisma
  signature_id        String? // FK -> user_signatures.id, set on approve when the approver has a signature
```
and add the relation alongside `approver`:
```prisma
  signature User_Signature? @relation("ApprovalStepSignature", fields: [signature_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

- [ ] **Step 2: Add the mapping model** (place after `Workflow_Approval_Step`)
```prisma
model Workflow_Approval_Signed_Document {
  id                 String   @id @default(uuid())
  approval_id        String
  signed_document_id String
  generated_at       DateTime @default(now())

  approval        Workflow_Approval @relation("ApprovalSignedDocs", fields: [approval_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  signed_document Document          @relation("ApprovalSignedDocOutput", fields: [signed_document_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([approval_id])
  @@map("workflow_approval_signed_documents")
}
```

- [ ] **Step 3: Add back-relations**

In `model Workflow_Approval` add:
```prisma
  signed_documents Workflow_Approval_Signed_Document[] @relation("ApprovalSignedDocs")
```
In `model Document` add:
```prisma
  approval_signed_outputs Workflow_Approval_Signed_Document[] @relation("ApprovalSignedDocOutput")
```
In `model User_Signature` add:
```prisma
  approval_steps Workflow_Approval_Step[] @relation("ApprovalStepSignature")
```

- [ ] **Step 4: Validate + generate client**

Run: `npx prisma validate` → Expected: "valid 🚀"
Run: `npx prisma generate` → Expected: client regenerated.

- [ ] **Step 5: Hand-write the migration** (DB is offline in dev; matches existing SQL Server dialect)

Create `prisma/migrations/20260617130000_add_approval_esignature/migration.sql`:
```sql
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[workflow_approval_steps] ADD [signature_id] NVARCHAR(1000);

-- CreateTable
CREATE TABLE [dbo].[workflow_approval_signed_documents] (
    [id] NVARCHAR(1000) NOT NULL,
    [approval_id] NVARCHAR(1000) NOT NULL,
    [signed_document_id] NVARCHAR(1000) NOT NULL,
    [generated_at] DATETIME2 NOT NULL CONSTRAINT [workflow_approval_signed_documents_generated_at_df] DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT [workflow_approval_signed_documents_pkey] PRIMARY KEY CLUSTERED ([id])
);

-- CreateIndex
CREATE NONCLUSTERED INDEX [workflow_approval_signed_documents_approval_id_idx] ON [dbo].[workflow_approval_signed_documents]([approval_id]);

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approval_steps] ADD CONSTRAINT [workflow_approval_steps_signature_id_fkey] FOREIGN KEY ([signature_id]) REFERENCES [dbo].[user_signatures]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approval_signed_documents] ADD CONSTRAINT [workflow_approval_signed_documents_approval_id_fkey] FOREIGN KEY ([approval_id]) REFERENCES [dbo].[workflow_approvals]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE [dbo].[workflow_approval_signed_documents] ADD CONSTRAINT [workflow_approval_signed_documents_signed_document_id_fkey] FOREIGN KEY ([signed_document_id]) REFERENCES [dbo].[documents]([id]) ON DELETE NO ACTION ON UPDATE NO ACTION;

COMMIT TRAN;

END TRY
BEGIN CATCH

IF @@TRANCOUNT > 0
BEGIN
    ROLLBACK TRAN;
END;
THROW

END CATCH
```

- [ ] **Step 6: Commit**
```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): approval signature_id + signed-document mapping"
```

---

## Phase 1 — Record the signature on approve (delivers in-app "Approve & Sign")

### Task 2: Persist `signature_id` on approve + expose on the DTO

**Files:** Modify `approval.service.ts`, `approval.response.dto.ts`.

**Interfaces:**
- Consumes: `userSignatureService.getActiveSignatureRef(userId): Promise<{ id: string; documentId: string } | null>` (shipped in feature #1).
- Produces: `ApprovalStepResponseDto.signatureId: string | null`.

- [ ] **Step 1: Import the signature service** in `approval.service.ts` (top, with other imports)
```ts
import { userSignatureService } from '../../../../user/service/implementation/signature.service';
```

- [ ] **Step 2: Resolve + persist the signature in `approve()`**

In `approve()`, before the `prisma.$transaction`, add:
```ts
    const sigRef = await userSignatureService.getActiveSignatureRef(actor.id);
```
Then in the atomic claim `updateMany` `data`, add `signature_id`:
```ts
        data: {
          status: WorkflowApprovalStepStatus.Approved,
          approver_id: actor.id,
          comment: comment ?? null,
          acted_at: now,
          signature_id: sigRef?.id ?? null,
        },
```
> Reject is unchanged — no signature on rejection.

- [ ] **Step 3: Add `signatureId` to the step DTO + mapper**

In `approval.response.dto.ts`, in `ApprovalStepResponseDto` add:
```ts
  signatureId: string | null;
```
In the step mapper object add (matching the existing `mapStepToResponse`/inline map shape — the source row has `signature_id`):
```ts
  signatureId: step.signature_id ?? null,
```
> If the mapper's input type is a literal, widen it to include `signature_id: string | null`.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` → Expected: no errors.

- [ ] **Step 5: Commit**
```bash
git add src/modules/workflow/approval
git commit -m "feat(workflow): record approver signature_id on approve"
```

---

## Phase 2 — Freeze infrastructure (orchestrator + mapping + listing + trigger)

### Task 3: `ApprovalSignedDocumentService` (audit) — generate + store the frozen artifact

**Files:** Create the interface + implementation under `src/modules/audit/approval-signature/`.

**Interfaces:**
- Consumes: `reportGenerationService.generatePdf(reportId): Promise<Buffer>`; `workingPaperService.exportWorkingPaper(id, 'pdf'): Promise<{ buffer: Buffer; filename: string; mimeType: string }>`; `buildCertificatePdf(data): Promise<Buffer>` (from `workflow/request/utility/signed-document.utility`); `IDocumentService.upload(...)`.
- Produces: `approvalSignedDocumentService.generateForCompletedApproval(approvalId: string): Promise<void>` (never throws).

- [ ] **Step 1: Interface**
```ts
// src/modules/audit/approval-signature/service/interface/approval-signed-document.service.interface.ts
export interface IApprovalSignedDocumentService {
  /** Generate + store the frozen signed artifact for a completed approval. Fire-and-forget safe. */
  generateForCompletedApproval(approvalId: string): Promise<void>;
}
```

- [ ] **Step 2: Implementation**
```ts
// src/modules/audit/approval-signature/service/implementation/approval-signed-document.service.ts
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { logger } from '../../../../../shared/utils/logger.util';
import { DocumentService } from '../../../../document';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { reportTemplateService } from '../../../../settings/service/implementation/report-template.service';
import { systemConfigService } from '../../../../settings/service/implementation/system-config.service';
import { workingPaperTemplateService } from '../../../../settings/service/implementation/working-paper-template.service';
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
import { buildCertificatePdf } from '../../../../workflow/request/utility/signed-document.utility';
import { ReportGenerationService } from '../../../report/service/implementation/report-generation.service';
import { WorkingPaperService } from '../../../working-papers/service/implementation/working-paper.service';
import { IApprovalSignedDocumentService } from '../interface/approval-signed-document.service.interface';

const SIGNED_ENTITY_TYPE = 'workflow_approval_signed';

export class ApprovalSignedDocumentService implements IApprovalSignedDocumentService {
  constructor(
    private readonly documents: IDocumentService = new DocumentService(),
    private readonly reportGen = new ReportGenerationService(
      reportTemplateService,
      systemConfigService,
      workflowApprovalService,
    ),
    private readonly workingPapers = new WorkingPaperService(new DocumentService(), workingPaperTemplateService),
  ) {}

  async generateForCompletedApproval(approvalId: string): Promise<void> {
    try {
      const approval = await prisma.workflow_Approval.findUnique({
        where: { id: approvalId },
        include: { submitted_by: true },
      });
      if (!approval || approval.status !== 'approved') return;

      const { bytes, baseName } = await this._renderForEntity(approval.entity_type, approval.entity_id);
      if (!bytes) return;

      const doc = await this.documents.upload({
        uploadedById: approval.submitted_by_id,
        originalName: baseName.replace(/\.pdf$/i, '') + ' (signed).pdf',
        mimeType: 'application/pdf',
        fileSize: bytes.length,
        buffer: bytes,
        module: 'workflow',
        entityType: SIGNED_ENTITY_TYPE,
        entityId: approvalId,
      });

      await prisma.workflow_Approval_Signed_Document.create({
        data: { approval_id: approvalId, signed_document_id: doc.id },
      });
      logger.info('Approval signed document generated', { approvalId, signedDocumentId: doc.id });
    } catch (err) {
      logger.warn('Approval signed-document generation failed', { approvalId, err });
    }
  }

  private async _renderForEntity(
    entityType: string,
    entityId: string,
  ): Promise<{ bytes: Buffer | null; baseName: string }> {
    if (entityType === 'audit_report') {
      return { bytes: await this.reportGen.generatePdf(entityId), baseName: 'audit-report' };
    }
    if (entityType === 'audit_working_paper') {
      const out = await this.workingPapers.exportWorkingPaper(entityId, 'pdf');
      return { bytes: out.buffer, baseName: out.filename };
    }
    // audit_plan | audit_finding_closure → standalone certificate (no source document)
    const { reference, title, entries } = await this._certificateData(entityType, entityId);
    return { bytes: await buildCertificatePdf({ reference, title, manifestHash: '—', entries }), baseName: title };
  }

  private async _certificateData(
    entityType: string,
    entityId: string,
  ): Promise<{ reference: string; title: string; entries: Awaited<ReturnType<ApprovalSignedDocumentService['_approverEntries']>> }> {
    const approval = await prisma.workflow_Approval.findFirst({
      where: { entity_type: entityType, entity_id: entityId },
      orderBy: { created_at: 'desc' },
    });
    const entries = approval ? await this._approverEntries(approval.id) : [];
    if (entityType === 'audit_plan') {
      const plan = await prisma.audit_Plan.findUnique({ where: { id: entityId }, select: { title: true } });
      return { reference: entityId.slice(0, 8), title: plan?.title ?? 'Audit Plan', entries };
    }
    const finding = await prisma.audit_Finding.findUnique({
      where: { id: entityId },
      select: { title: true, engagement: { select: { reference_number: true } } },
    });
    return {
      reference: finding?.engagement.reference_number ?? entityId.slice(0, 8),
      title: finding?.title ?? 'Finding Closure',
      entries,
    };
  }

  /** Build signature-panel entries from approved steps, embedding each approver's signature image. */
  private async _approverEntries(approvalId: string) {
    const steps = await prisma.workflow_Approval_Step.findMany({
      where: { approval_id: approvalId, status: 'approved' },
      include: { approver: true },
      orderBy: { level: 'asc' },
    });
    const entries = [];
    for (const s of steps) {
      if (!s.approver) continue;
      const name = s.approver.display_name?.trim() || `${s.approver.first_name} ${s.approver.last_name}`.trim();
      const role = s.approver.job_title ?? '';
      const actedAt = s.acted_at ?? new Date();
      let signatureImage;
      if (s.signature_id) {
        const sig = await prisma.user_Signature.findUnique({ where: { id: s.signature_id } });
        if (sig) {
          const file = await this.documents.getFileById(sig.document_id);
          signatureImage = { bytes: file.buffer, format: file.mimeType === 'image/jpeg' ? 'jpg' as const : 'png' as const };
        }
      }
      entries.push({ name, role, actedAt, action: 'signed' as const, signatureImage });
    }
    return entries;
  }
}

export const approvalSignedDocumentService = new ApprovalSignedDocumentService();
```
> The `SignaturePanelEntry`/`SignaturePageData` shapes are exported from `workflow/request/utility/signed-document.utility` (feature #1) — `_approverEntries` returns that entry shape.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` → Expected: no errors.
> If TS complains about the inferred `_approverEntries` return type in `_certificateData`, import `SignaturePanelEntry` from the utility and annotate `entries: SignaturePanelEntry[]`.

- [ ] **Step 4: Commit**
```bash
git add src/modules/audit/approval-signature
git commit -m "feat(audit): approval signed-document generator (freeze on completion)"
```

---

### Task 4: Fire generation on completion + listing endpoint

**Files:** Modify `approval.service.ts` (trigger + `listSignedDocuments`), `approval.service.interface.ts`, `approval.response.dto.ts` (`SignedApprovalDocumentDto`), `approval.controller.ts`.

**Interfaces:**
- Produces: `ApprovalService.listSignedDocuments(approvalId): Promise<SignedApprovalDocumentDto[]>`; route `GET /workflow/approvals/:id/signed-documents`.

- [ ] **Step 1: Fire freeze in the completion branch of `approve()`**

In `approve()`, the `else` branch (no `nextStep`) currently flips status to Approved + calls `markApproved` inside the tx. After the tx completes and the existing `void this._queueApprovalApprovedAsync(...)` in the `else` of the post-tx block, add a fire-and-forget via **dynamic import** (breaks the audit↔workflow import cycle; safe because it runs long after startup):
```ts
    } else {
      void this._queueApprovalApprovedAsync(approval, actor.id, comment);
      void import('../../../../audit/approval-signature/service/implementation/approval-signed-document.service')
        .then((m) => m.approvalSignedDocumentService.generateForCompletedApproval(approvalId))
        .catch((err: unknown) => logger.warn('Approval freeze enqueue failed', { approvalId, err }));
    }
```

- [ ] **Step 2: Add `SignedApprovalDocumentDto`** in `approval.response.dto.ts`
```ts
export interface SignedApprovalDocumentDto {
  id: string;
  signedDocumentId: string;
  downloadUrl: string;
  generatedAt: string;
}
```

- [ ] **Step 3: Implement `listSignedDocuments`** in `approval.service.ts`
```ts
  async listSignedDocuments(approvalId: string): Promise<SignedApprovalDocumentDto[]> {
    const rows = await prisma.workflow_Approval_Signed_Document.findMany({
      where: { approval_id: approvalId },
      orderBy: { generated_at: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      signedDocumentId: r.signed_document_id,
      downloadUrl: `/api/proxy/documents/${r.signed_document_id}/file`,
      generatedAt: r.generated_at.toISOString(),
    }));
  }
```
Add `SignedApprovalDocumentDto` to the imports from the response DTO, and add to `IApprovalService`:
```ts
  listSignedDocuments(approvalId: string): Promise<SignedApprovalDocumentDto[]>;
```

- [ ] **Step 4: Add the controller route**

In `approval.controller.ts` `_registerRoutes()`:
```ts
    this.router.get('/:id/signed-documents', requirePermission('audit:read'), this._listSignedDocuments.bind(this));
```
Handler:
```ts
  private async _listSignedDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const docs = await this.approvalService.listSignedDocuments(req.params.id);
      res.status(200).json(buildResponse(docs));
    } catch (err) {
      next(err);
    }
  }
```
> Use the same permission the other approval reads use (`audit:read`); confirm against the existing routes in this controller and match.

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json` → Expected: no errors.

- [ ] **Step 6: Commit**
```bash
git add src/modules/workflow/approval
git commit -m "feat(workflow): freeze signed approval doc on completion + list endpoint"
```

---

## Phase 3 — Embed signatures in report output (PDF + DOCX)

### Task 5: Give the report generator the document service + signature images

**Files:** Modify `report-generation.service.ts`, `audit/index.ts`.

**Interfaces:**
- Consumes: `ApprovalResponseDto.steps[].signatureId`, `ApprovalResponseDto.steps[].approverId`, `IDocumentService.getFileById`.
- Produces: report PDF/DOCX signature block renders the approver's signature image.

- [ ] **Step 1: Add `documentService` to the constructor**

In `report-generation.service.ts` constructor, add a param:
```ts
  constructor(
    private readonly reportTemplateService: IReportTemplateService,
    private readonly systemConfigService: ISystemConfigService,
    private readonly approvalService: IApprovalService,
    private readonly documentService: IDocumentService = new DocumentService(),
  ) {}
```
Add imports:
```ts
import { DocumentService } from '../../../../document';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
```

- [ ] **Step 2: Update the wiring** in `audit/index.ts`
```ts
  const reportGenerationService = new ReportGenerationService(
    reportTemplateService,
    systemConfigService,
    workflowApprovalService,
    documentService,
  );
```

- [ ] **Step 3: Resolve signature data URLs for approved steps** (add a private helper)

In `report-generation.service.ts`:
```ts
  /** Map approverId -> data:image URL for approved steps that recorded a signature. */
  private async _signatureDataUrls(approval: ApprovalResponseDto | null): Promise<Record<string, string>> {
    const out: Record<string, string> = {};
    if (!approval?.steps) return out;
    for (const s of approval.steps) {
      if (s.status !== 'approved' || !s.signatureId || !s.approverId) continue;
      try {
        const sig = await prisma.user_Signature.findUnique({ where: { id: s.signatureId } });
        if (!sig) continue;
        const file = await this.documentService.getFileById(sig.document_id);
        out[s.approverId] = `data:${file.mimeType};base64,${file.buffer.toString('base64')}`;
      } catch {
        // skip this approver's image; the text block still renders
      }
    }
    return out;
  }
```

- [ ] **Step 4: Embed in the HTML signature table** (`_buildPdfHtml`)

`_buildPdfHtml` is currently sync and iterates `approval.steps.filter(s => s.status === 'approved')`. Thread a `sigUrls: Record<string,string>` argument into it (resolved in `generatePdf` via `await this._signatureDataUrls(approval)`), and in each approved step's cell render the image above the name when present:
```ts
        ${sigUrls[step.approverId ?? ''] ? `<img src="${sigUrls[step.approverId ?? '']}" style="height:42px;object-fit:contain;display:block;margin-bottom:4px;" />` : ''}
```
Update the `generatePdf` call site:
```ts
    const sigUrls = await this._signatureDataUrls(approval);
    const html = this._buildPdfHtml(data, config, approval, sigUrls);
```
and the signature of `_buildPdfHtml(data, config, approval, sigUrls)`.

- [ ] **Step 5: Embed in the DOCX signature block** (`_buildDocxSignatureBlock`)

`_buildDocxSignatureBlock` builds a `docx` `Table`. Make `generateDocx` resolve `sigUrls`/buffers and pass them; for each approved step with an image, prepend an `ImageRun` to that cell:
```ts
import { ImageRun } from 'docx';
// in the approver cell children, when a buffer exists:
new Paragraph({ children: [ new ImageRun({ data: buffer, transformation: { width: 120, height: 42 } }) ] }),
```
> `_buildDocxSignatureBlock` needs the raw image **buffers** (not data URLs). Resolve a `Record<string, Buffer>` with the same loop as Step 3 but storing `file.buffer`, and thread it into the builder. Reuse one helper that returns both buffer and dataUrl maps to stay DRY.

- [ ] **Step 6: Typecheck + manual smoke**

Run: `npx tsc --noEmit -p tsconfig.json` → Expected: no errors.
Manual (after DB up): approve a report whose approver has a signature, export PDF and DOCX → the signature block shows the stamped image.

- [ ] **Step 7: Commit**
```bash
git add src/modules/audit/report/service/implementation/report-generation.service.ts src/modules/audit/index.ts
git commit -m "feat(audit): embed approver signatures in report PDF + DOCX"
```

---

## Phase 4 — Embed signatures in working-paper output

### Task 6: Working-paper PDF sign-off block embeds approver signatures

**Files:** Modify `working-paper.service.ts`.

**Interfaces:**
- Consumes: `workflowApprovalService.getApprovalByEntity('audit_working_paper', id)`, `IDocumentService.getFileById`.
- Produces: WP export PDF shows approver signature images.

- [ ] **Step 1: Inject the approval service** (constructor already has `documentService`)

Add `workflowApprovalService` use. Import the singleton:
```ts
import { workflowApprovalService } from '../../../../workflow/approval/service/implementation/approval.service';
```
> Working-paper service is constructed in `createAuditModule`; importing the workflow approval singleton at top-level is the same cross-module pattern already used by `report-generation.service.ts`.

- [ ] **Step 2: Resolve approver signatures in `exportWorkingPaper`**

Before `_renderWorkingPaperPdf`, fetch the approval and build a `{ name, role, actedAt, dataUrl }[]` list for approved steps with a `signatureId` (same resolution loop as Task 5 Step 3, producing data URLs for the HTML renderer). Pass it into `_renderWorkingPaperPdf`.

- [ ] **Step 3: Render the sign-off block**

In `_renderWorkingPaperPdf`'s HTML, add (or extend the existing prepared/reviewed area with) a sign-off section listing each approver: `<img src="${dataUrl}" style="height:42px;...">` + name + role + date. If the WP HTML has no signature area yet, add a simple block before the closing body.

- [ ] **Step 4: Typecheck + manual smoke**

Run: `npx tsc --noEmit -p tsconfig.json` → Expected: no errors.
Manual: approve a working paper (approver has a signature) → export PDF shows the stamped signature(s).

- [ ] **Step 5: Commit**
```bash
git add src/modules/audit/working-papers/service/implementation/working-paper.service.ts
git commit -m "feat(audit): embed approver signatures in working-paper PDF"
```

---

## Phase 5 — Frontend ("Approve & Sign" + downloads)

### Task 7: Types + API client

**Files:** Modify `frontend/lib/types/domain.ts`, `frontend/lib/api/workflow.ts`.

- [ ] **Step 1: Types** — add `signatureId: string | null` to the approval step type; add:
```ts
export interface SignedApprovalDocument {
  id: string;
  signedDocumentId: string;
  downloadUrl: string;
  generatedAt: string;
}
```

- [ ] **Step 2: API** — in `workflow.ts` `workflowApi`, add:
```ts
  signedDocuments: (approvalId: string) =>
    api.get<SignedApprovalDocument[]>(`/workflow/approvals/${approvalId}/signed-documents`),
```
(Import `SignedApprovalDocument` from domain.) The signature get/save reuses `signatureApi` from `frontend/lib/api/signature.ts` (feature #1).

- [ ] **Step 3: Typecheck + commit**
```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
git add frontend/lib/types/domain.ts frontend/lib/api/workflow.ts
git commit -m "feat(web): approval signed-document types + api"
```

---

### Task 8: "Approve & Sign" dialog + download on the approval surfaces

**Files:** Modify the component(s) that render the approval Approve/Reject buttons (locate the consumers of `workflowApi.approve` — pending-approvals list and the report/working-paper approval UI).

**Interfaces:**
- Consumes: `signatureApi.get/save` (feature #1), `SignaturePad` (`@/components/common/SignaturePad`), `workflowApi.approve`, `workflowApi.signedDocuments`.

- [ ] **Step 1: Replace "Approve" with an "Approve & Sign" dialog**

Mirror the request `SignModal` (no typed affirmation). Query `signatureApi.get()`; if null, render `<SignaturePad onChange={(blob, kind) => saveSig.mutate({ blob, kind })} />` and a note. **For report & working-paper approvals, disable "Approve & Sign" until a signature exists** (`disabled={!sig}`); for plan / finding-closure approvals, allow approving without one. On confirm, call the existing `workflowApi.approve(approvalId, comment)` — the backend records `signature_id` automatically from the active signature.

- [ ] **Step 2: Show the frozen signed document**

Where an approval is `approved`, query `workflowApi.signedDocuments(approvalId)` and render download links (`href={d.downloadUrl}` target=_blank, label "Signed document"). Reuse the request page's `SignedDocumentsCard` pattern.

- [ ] **Step 3: Typecheck + manual smoke**
```bash
cd frontend && npx tsc --noEmit -p tsconfig.json
```
Manual: as a head user, approve a report → dialog requires a signature (inline setup works) → after completion the signed PDF is downloadable with the signature embedded.

- [ ] **Step 4: Commit**
```bash
git add frontend
git commit -m "feat(web): Approve & Sign dialog + signed-document download"
```

---

## Phase 6 — Docs

### Task 9: Update PROJECT_STATE

**Files:** Modify `docs/PROJECT_STATE.md`.

- [ ] **Step 1:** Under the workflow approval section, note: approvals are now "Approve & Sign" — `signature_id` recorded per step, frozen signed artifact generated on completion (reports/WP embed approver signatures; plans/finding closures get a certificate PDF), new route `GET /workflow/approvals/:id/signed-documents`, table `workflow_approval_signed_documents`, migration `20260617130000_add_approval_esignature`. Reuses the per-user signature from feature #1.

- [ ] **Step 2: Commit**
```bash
git add docs/PROJECT_STATE.md
git commit -m "docs: note approval e-signature capability"
```

---

## Manual end-to-end verification (after all tasks, DB up)

1. Profile → Signature set up (from feature #1).
2. Submit an audit **report** for approval → as each approver, "Approve & Sign" requires a signature (inline setup offered) → after final approval a **signed PDF** appears with every approver's signature in the signature block. Export DOCX → same.
3. Repeat for a **working paper**.
4. Approve an **audit plan** and a **finding closure** (signature optional) → a **certificate PDF** is downloadable listing the approvers (with images where present).
5. An approver who approves **without** a signature (plan/finding) → shown as approved without an image; report/WP path blocks approval until a signature exists.
6. Reject → unaffected; no signature, no frozen document.

---

## Out of scope (tracked for later)
- Integrity/manifest hash for approvals (Option A: visible signature only).
- PKI/PAdES cryptographic signatures.
- Re-freeze/versioning of an already-frozen approval (completed approvals are one-shot).
