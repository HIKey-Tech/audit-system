# SP2 — Template Integration — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let auditors choose working-paper and report templates at the point of work (not just admin settings), render templated working papers as structured sections, and make report generation/export/preview all honor the chosen template.

**Architecture:** Frontend-only for working papers (backend already accepts `templateId` on WP create). Full-stack for reports: an additive nullable `audit_reports.template_id` column, threaded through generate → generation/export, plus a frontend selector and a template-driven on-screen preview. All changes additive; null `template_id` = today's default-template behavior.

**Tech Stack:** Backend — Node/Express/TypeScript, Prisma (SQL Server). Frontend — Next.js 14, React 18, TypeScript, Tailwind, @tanstack/react-query, SP1 UI primitives (`FormField`, `InfoHint`, `Select`).

**Working dirs:** backend commands from `audit-system/` (repo root); frontend commands from `audit-system/frontend/`. Windows/PowerShell; git branch `sp2-template-integration`.

**Per-task verification (no relevant unit-test runner):**
- Backend type/client gate: from `audit-system/` run `npx prisma generate` (when schema changed) then `npm run build` (tsc) — expected: success.
- Frontend type gate: from `frontend/` run `npx tsc --noEmit` — expected: no errors.
- Final gate (last task): frontend `npm run build`. The DB migration is hand-authored SQL (matching repo precedent) and applied at deploy time via `prisma migrate deploy`; implementers do NOT need a live database.

---

## File map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | modify | add `template_id` + index to `Audit_Report` |
| `prisma/migrations/20260608120000_add_report_template_id/migration.sql` | create | additive column + index (SQL Server) |
| `src/modules/audit/report/dto/request/report.request.dto.ts` | modify | `GenerateReportRequestSchema`; `templateId` on update |
| `src/modules/audit/report/dto/response/report.response.dto.ts` | modify | `templateId` on response |
| `src/modules/audit/report/service/interface/report.service.interface.ts` | modify | generate signature uses new DTO |
| `src/modules/audit/report/service/implementation/report.service.ts` | modify | inject template service; validate + persist `template_id` |
| `src/modules/audit/report/controller/report.controller.ts` | modify | validate generate body |
| `src/modules/audit/report/service/interface/report-generation.service.interface.ts` | modify | `fetchTemplateAndConfig` signature |
| `src/modules/audit/report/service/implementation/report-generation.service.ts` | modify | thread chosen template id |
| `src/modules/audit/index.ts` | modify | pass template service into `ReportService` |
| `frontend/lib/api/audit.ts` | modify | `templateId` on `CreateReportDto` |
| `frontend/lib/types/domain.ts` | modify | `templateId` on `AuditReport` |
| `frontend/components/audit/engagements/WorkingPapersTab.tsx` | modify | WP template picker + structured view/edit |
| `frontend/components/audit/engagements/ReportTab.tsx` | modify | report template selector + branded preview |

---

## Task 1: Add `audit_reports.template_id` (schema + migration + client)

**Files:**
- Modify: `prisma/schema.prisma` (model `Audit_Report`, ~lines 630-655)
- Create: `prisma/migrations/20260608120000_add_report_template_id/migration.sql`

- [ ] **Step 1: Add the column + index to the schema**

In `prisma/schema.prisma`, in `model Audit_Report`, add the `template_id` field immediately after the `rejection_reason` line:

```prisma
  rejection_reason  String?   @db.NVarChar(Max)
  template_id       String?
```

And add this index alongside the existing `@@index` lines (after `@@index([created_by_id])`):

```prisma
  @@index([template_id])
```

- [ ] **Step 2: Create the migration SQL (matches the repo's SQL Server precedent)**

Create `prisma/migrations/20260608120000_add_report_template_id/migration.sql` with exactly:

```sql
BEGIN TRY

BEGIN TRAN;

-- AlterTable
ALTER TABLE [dbo].[audit_reports] ADD [template_id] NVARCHAR(1000);

-- CreateIndex
CREATE NONCLUSTERED INDEX [audit_reports_template_id_idx] ON [dbo].[audit_reports]([template_id]);

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

- [ ] **Step 3: Regenerate the Prisma client (no DB needed)**

Run (from `audit-system/`): `npx prisma generate`
Expected: "Generated Prisma Client" success. This makes `template_id` available on the `audit_Report` model types so the later backend tasks type-check.

- [ ] **Step 4: Validate schema**

Run (from `audit-system/`): `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid".

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/20260608120000_add_report_template_id/migration.sql
git commit -m "feat(db): add nullable audit_reports.template_id"
```

---

## Task 2: Report DTOs — generate schema, update field, response field

**Files:**
- Modify: `src/modules/audit/report/dto/request/report.request.dto.ts`
- Modify: `src/modules/audit/report/dto/response/report.response.dto.ts`

- [ ] **Step 1: Add the generate schema + `templateId` on update**

Replace the top of `report.request.dto.ts` (the `UpdateReportRequestSchema` block) with:

```ts
import { z } from 'zod';

export const GenerateReportRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  executiveSummary: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
  methodology: z.string().min(1).optional(),
  templateId: z.string().uuid().optional(),
});

export const UpdateReportRequestSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  executiveSummary: z.string().min(1).optional(),
  scope: z.string().min(1).optional(),
  methodology: z.string().min(1).optional(),
  templateId: z.string().uuid().optional(),
});
```

And add the inferred type alongside the existing exports at the bottom of the file:

```ts
export type GenerateReportRequestDto = z.infer<typeof GenerateReportRequestSchema>;
```

(Keep the existing `UpdateReportRequestDto`, `RejectReportRequestDto`, `ExportReportQueryDto`, `ReportQueryDto` exports.)

- [ ] **Step 2: Add `templateId` to the response DTO**

In `report.response.dto.ts`, add `templateId` to the `ReportResponseDto` interface (after `documentId`):

```ts
  documentId: string | null;
  templateId: string | null;
```

Add `template_id` to the `mapReportToResponse` input type (after `document_id: string | null;`):

```ts
    document_id: string | null;
    template_id: string | null;
```

And map it in the returned object (after `documentId: report.document_id,`):

```ts
  documentId: report.document_id,
  templateId: report.template_id ?? null,
```

- [ ] **Step 3: Type gate**

Run (from `audit-system/`): `npm run build`
Expected: success (the Prisma client from Task 1 now has `template_id`).

- [ ] **Step 4: Commit**

```bash
git add src/modules/audit/report/dto/request/report.request.dto.ts src/modules/audit/report/dto/response/report.response.dto.ts
git commit -m "feat(report): templateId on generate/update/response DTOs"
```

---

## Task 3: ReportService — validate + persist template_id; wire validation

**Files:**
- Modify: `src/modules/audit/report/service/interface/report.service.interface.ts`
- Modify: `src/modules/audit/report/service/implementation/report.service.ts`
- Modify: `src/modules/audit/report/controller/report.controller.ts`
- Modify: `src/modules/audit/index.ts`

- [ ] **Step 1: Update the service interface signature**

In `report.service.interface.ts`, find the `generateReport` declaration and change its `dto` type from `UpdateReportRequestDto` to `GenerateReportRequestDto`. Add the import for `GenerateReportRequestDto` from `../../dto/request/report.request.dto` (alongside the existing `UpdateReportRequestDto` import). Leave all other method signatures unchanged.

- [ ] **Step 2: Inject the report template service into ReportService**

In `report.service.ts`:

Add imports near the other service imports:

```ts
import { IReportTemplateService } from '../../../../settings/service/interface/report-template.service.interface';
import { GenerateReportRequestDto } from '../../dto/request/report.request.dto';
```

Change the constructor to accept the template service (insert it before the defaulted `approvalService` param):

```ts
  constructor(
    private readonly followUpService: IFollowUpService,
    private readonly documentService: IDocumentService,
    private readonly reportGenerationService: IReportGenerationService,
    private readonly reportTemplateService: IReportTemplateService,
    private readonly approvalService: IApprovalService = workflowApprovalService,
  ) {}
```

- [ ] **Step 3: Validate + persist template_id in generateReport**

In `report.service.ts#generateReport`, change the signature `dto` type to `GenerateReportRequestDto`:

```ts
  async generateReport(engagementId: string, dto: GenerateReportRequestDto, actor: ActorContext): Promise<ReportResponseDto> {
```

Immediately after the existing "report already exists" conflict check (the `if (existing) throw AppError.conflict(...)` line), add template validation:

```ts
    if (dto.templateId) {
      // Throws notFound (→ 404) if the template id is invalid.
      await this.reportTemplateService.getTemplateById(dto.templateId);
    }
```

In the `prisma.audit_Report.create({ data: { … } })` call, add the column (after `created_by_id: actor.id,`):

```ts
        created_by_id: actor.id,
        template_id: dto.templateId ?? null,
```

- [ ] **Step 4: Persist template_id on update**

In `report.service.ts#updateReport`, inside the `prisma.audit_Report.update({ data: { … } })` spread block, add (after the `methodology` line):

```ts
        ...(dto.methodology !== undefined && { methodology: dto.methodology }),
        ...(dto.templateId !== undefined && { template_id: dto.templateId }),
```

- [ ] **Step 5: Wire request validation on the generate route**

In `report.controller.ts`, add `GenerateReportRequestSchema` to the import from `../dto/request/report.request.dto`, and add the `validate(...)` middleware to the generate route:

```ts
    this.router.post('/engagements/:id/report/generate', requirePermission('report:create'), validate(GenerateReportRequestSchema), this._generateReport.bind(this));
```

- [ ] **Step 6: Pass the template service when constructing ReportService**

In `src/modules/audit/index.ts`, the `reportTemplateService` singleton is already imported. Update the `ReportService` construction:

```ts
  const reportService = new ReportService(followUpService, documentService, reportGenerationService, reportTemplateService);
```

- [ ] **Step 7: Type gate**

Run (from `audit-system/`): `npm run build`
Expected: success.

- [ ] **Step 8: Commit**

```bash
git add src/modules/audit/report/service/interface/report.service.interface.ts src/modules/audit/report/service/implementation/report.service.ts src/modules/audit/report/controller/report.controller.ts src/modules/audit/index.ts
git commit -m "feat(report): validate + persist chosen report template on generate/update"
```

---

## Task 4: Thread the chosen template through generation/export

**Files:**
- Modify: `src/modules/audit/report/service/interface/report-generation.service.interface.ts`
- Modify: `src/modules/audit/report/service/implementation/report-generation.service.ts`

- [ ] **Step 1: Update the interface if it declares `fetchTemplateAndConfig`**

Open `report-generation.service.interface.ts`. If it declares `fetchTemplateAndConfig(): Promise<…>`, change it to:

```ts
  fetchTemplateAndConfig(templateId?: string | null): Promise<TemplateConfig>;
```

(If `TemplateConfig` isn't exported/visible there, leave the interface as-is — the method is also reachable via the class; only change the signature that already exists. Do NOT add new exports.)

- [ ] **Step 2: Carry `template_id` out of `fetchReportData`**

In `report-generation.service.ts`, add `templateId` to the `ReportData` `report` shape. In the `interface ReportData { report: { … } }` block, add after `createdById: string;`:

```ts
    createdById: string;
    templateId: string | null;
```

In `fetchReportData`, in the returned `report: { … }` object, add after `createdById: report.created_by_id,`:

```ts
        createdById: report.created_by_id,
        templateId: report.template_id ?? null,
```

- [ ] **Step 3: Make `fetchTemplateAndConfig` accept a template id with default fallback**

Replace the `fetchTemplateAndConfig` method body with:

```ts
  async fetchTemplateAndConfig(templateId?: string | null): Promise<TemplateConfig> {
    let template;
    if (templateId) {
      try {
        template = await this.reportTemplateService.getTemplateById(templateId);
      } catch {
        template = await this.reportTemplateService.getDefaultTemplate();
      }
    } else {
      template = await this.reportTemplateService.getDefaultTemplate();
    }
    const configs = await this.systemConfigService.getAllConfig(false);
    const configMap = new Map(configs.map((c) => [c.key, c.value]));
    return {
      template,
      orgName: configMap.get('org_name') ?? 'Galaxy Backbone Limited',
      orgAddress: configMap.get('org_address') ?? '',
      footerNotice: configMap.get('report_footer_notice') ?? '',
    };
  }
```

- [ ] **Step 4: Pass the report's template id from the three entry points**

In `generateDocx`, `generatePdf`, and `exportReport`, each currently calls `await this.fetchReportData(reportId)` then `await this.fetchTemplateAndConfig()`. In all three, change the config line to pass the report's template id:

`generateDocx` and `generatePdf` (they have `const data = await this.fetchReportData(reportId);`):
```ts
    const config = await this.fetchTemplateAndConfig(data.report.templateId);
```

`exportReport` calls `fetchReportData` for the filename but not the config; it delegates to `generateDocx`/`generatePdf`, which now thread the id — no change needed there beyond what those methods do. Leave `exportReport` as-is.

- [ ] **Step 5: Type gate**

Run (from `audit-system/`): `npm run build`
Expected: success.

- [ ] **Step 6: Commit**

```bash
git add src/modules/audit/report/service/interface/report-generation.service.interface.ts src/modules/audit/report/service/implementation/report-generation.service.ts
git commit -m "feat(report): generation/export use the report's chosen template"
```

---

## Task 5: Working-paper template picker

**Files:**
- Modify: `frontend/components/audit/engagements/WorkingPapersTab.tsx` (the `CreateOrEditPaperSlideOver` component)

Context: today this component calls `workingPaperTemplatesApi.getDefault(auditType)` and silently renders only that template. Replace it with a picker over all templates (default preselected), plus a "Blank (free text)" option. `wpTemplatesApi` is already exported from `@/lib/api/settings`.

- [ ] **Step 1: Update imports**

In `WorkingPapersTab.tsx`, change the settings import to use `wpTemplatesApi` and add `Select`:

```tsx
import { wpTemplatesApi } from '@/lib/api/settings';
import { Input, Select, Textarea } from '@/components/ui/Input';
```

(Remove the old `workingPaperTemplatesApi` import if it is now unused.)

- [ ] **Step 2: Replace the `CreateOrEditPaperSlideOver` component**

Replace the entire `CreateOrEditPaperSlideOver` function with:

```tsx
const CreateOrEditPaperSlideOver = ({
  engagementId,
  auditType,
  open,
  onClose,
  onSaved,
}: {
  engagementId: string;
  auditType: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sectionContents, setSectionContents] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>('');
  const [touched, setTouched] = useState(false);
  const [saving, setSaving] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ['settings', 'working-paper-templates', 'list'],
    queryFn: () => wpTemplatesApi.list(),
    enabled: open,
    retry: false,
  });

  const templates = templatesQuery.data ?? [];
  const defaultTemplate =
    templates.find((t) => t.isDefault && t.auditType === auditType) ?? null;

  // Preselect the audit-type default once templates load (unless the user already chose).
  useEffect(() => {
    if (!open || touched || templatesQuery.isLoading) return;
    setSelectedTemplateId(defaultTemplate ? defaultTemplate.id : '');
  }, [open, touched, templatesQuery.isLoading, defaultTemplate]);

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) ?? null;

  // Reset section inputs when the chosen template changes.
  useEffect(() => {
    setSectionContents(selectedTemplate ? selectedTemplate.sections.map(() => '') : []);
  }, [selectedTemplate]);

  const reset = () => {
    setTitle('');
    setContent('');
    setSectionContents([]);
    setSelectedTemplateId('');
    setTouched(false);
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const updateSectionContent = (index: number, value: string) => {
    setSectionContents((current) => {
      const next = [...current];
      next[index] = value;
      return next;
    });
  };

  const submit = async (alsoSubmit: boolean) => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title required');
      return;
    }

    let payloadContent: string;
    if (selectedTemplate) {
      const missing = selectedTemplate.sections.find(
        (section, index) => section.required && !sectionContents[index]?.trim(),
      );
      if (missing) {
        toast.error(`${missing.title} required`);
        return;
      }
      payloadContent = JSON.stringify({
        sections: selectedTemplate.sections.map((section, index) => ({
          title: section.title,
          content: sectionContents[index] ?? '',
        })),
      });
    } else {
      if (!content.trim()) {
        toast.error('Content required');
        return;
      }
      payloadContent = content;
    }

    setSaving(true);
    try {
      const created = await workingPapersApi.create(engagementId, {
        title: trimmedTitle,
        content: payloadContent,
        templateId: selectedTemplate?.id,
      });
      if (alsoSubmit) {
        await workingPapersApi.submit(created.id);
      }
      toast.success(alsoSubmit ? 'Submitted for review' : 'Saved as draft');
      onSaved();
      reset();
      onClose();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={open}
      onClose={handleClose}
      title="New working paper"
      width="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" size="sm" onClick={handleClose}>
            Cancel
          </Button>
          <Button variant="secondary" size="sm" onClick={() => submit(false)} isLoading={saving} disabled={templatesQuery.isLoading}>
            Save as draft
          </Button>
          <Button size="sm" onClick={() => submit(true)} isLoading={saving} disabled={templatesQuery.isLoading}>
            Submit for review
          </Button>
        </div>
      }
    >
      {templatesQuery.isLoading ? (
        <div className="space-y-5">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-28 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <FormField
            label="Template"
            tooltip="Pick a structured template for this audit type, or Blank to write free-form notes. Templates standardize what every working paper captures."
          >
            <Select
              value={selectedTemplateId}
              onChange={(e) => {
                setTouched(true);
                setSelectedTemplateId(e.target.value);
              }}
            >
              <option value="">Blank (free text)</option>
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.isDefault && t.auditType === auditType ? ' (default)' : ''}
                </option>
              ))}
            </Select>
          </FormField>

          <FormField label="Title" required>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. WP-01 Sample Selection" />
          </FormField>

          {selectedTemplate ? (
            selectedTemplate.sections.map((section, index) => {
              const fieldId = `working-paper-section-${index}`;
              return (
                <FormField
                  key={`${section.title}-${index}`}
                  label={section.title}
                  required={section.required}
                  htmlFor={fieldId}
                  description={section.description}
                >
                  <Textarea
                    id={fieldId}
                    rows={4}
                    value={sectionContents[index] ?? ''}
                    placeholder={section.placeholder}
                    onChange={(e) => updateSectionContent(index, e.target.value)}
                  />
                </FormField>
              );
            })
          ) : (
            <FormField label="Content" hint="Plain text or markdown — exported into the DOCX template.">
              <Textarea rows={14} value={content} onChange={(e) => setContent(e.target.value)} className="font-mono text-xs" />
            </FormField>
          )}
        </div>
      )}
    </SlideOver>
  );
};
```

- [ ] **Step 3: Type gate**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/components/audit/engagements/WorkingPapersTab.tsx
git commit -m "feat(audit): choose any working-paper template (not just the default)"
```

---

## Task 6: Structured working-paper view/edit

**Files:**
- Modify: `frontend/components/audit/engagements/WorkingPapersTab.tsx` (the `ViewPaperSlideOver` component)

Context: today `ViewPaperSlideOver` dumps templated content (`{"sections":[…]}` JSON) into a mono textarea and uses a setState-during-render anti-pattern. Render structured sections instead, and sync state via `useEffect`.

- [ ] **Step 1: Replace the `ViewPaperSlideOver` component**

Replace the entire `ViewPaperSlideOver` function with:

```tsx
interface PaperSection {
  title: string;
  content: string;
}

const parsePaperSections = (raw: string | null | undefined): PaperSection[] | null => {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      Array.isArray(parsed.sections) &&
      parsed.sections.every(
        (s: unknown) =>
          typeof s === 'object' && s !== null && typeof (s as PaperSection).title === 'string',
      )
    ) {
      return (parsed.sections as PaperSection[]).map((s) => ({
        title: s.title,
        content: typeof s.content === 'string' ? s.content : '',
      }));
    }
  } catch {
    /* not JSON — treat as free text */
  }
  return null;
};

const ViewPaperSlideOver = ({
  paper,
  canEdit,
  onClose,
  onSaved,
}: {
  paper: AuditWorkingPaper | null;
  canEdit: boolean;
  onClose: () => void;
  onSaved: () => void;
}): JSX.Element => {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [sections, setSections] = useState<PaperSection[]>([]);
  const [isStructured, setIsStructured] = useState(false);
  const [saving, setSaving] = useState(false);

  const editable = canEdit && Boolean(paper) && (paper?.status === 'draft' || paper?.status === 'rejected');

  // Sync local state whenever the viewed paper changes.
  useEffect(() => {
    if (!paper) return;
    const parsed = parsePaperSections(paper.content);
    setTitle(paper.title);
    if (parsed) {
      setIsStructured(true);
      setSections(parsed);
      setContent('');
    } else {
      setIsStructured(false);
      setContent(paper.content ?? '');
      setSections([]);
    }
  }, [paper]);

  const updateSection = (index: number, value: string) => {
    setSections((current) => {
      const next = [...current];
      next[index] = { ...next[index], content: value };
      return next;
    });
  };

  const handleSave = async () => {
    if (!paper) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toast.error('Title required');
      return;
    }

    let payloadContent: string;
    if (isStructured) {
      const missing = sections.find((s) => !s.content.trim());
      if (missing) {
        toast.error(`${missing.title} is empty`);
        return;
      }
      payloadContent = JSON.stringify({ sections });
    } else {
      if (!content.trim()) {
        toast.error('Content required');
        return;
      }
      payloadContent = content;
    }

    setSaving(true);
    try {
      await workingPapersApi.update(paper.id, { title: trimmedTitle, content: payloadContent });
      toast.success('Saved');
      onSaved();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SlideOver
      open={Boolean(paper)}
      onClose={onClose}
      title={paper?.title ?? 'Working paper'}
      description={paper ? `Version ${paper.version} · ${paper.status}` : undefined}
      width="xl"
      footer={
        editable ? (
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
            <Button size="sm" onClick={handleSave} isLoading={saving}>
              Save changes
            </Button>
          </div>
        ) : (
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={onClose}>
              Close
            </Button>
          </div>
        )
      }
    >
      {paper && (
        <div className="space-y-4">
          <FormField label="Title">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} disabled={!editable} />
          </FormField>

          {isStructured ? (
            sections.map((section, index) => (
              <FormField key={`${section.title}-${index}`} label={section.title}>
                <Textarea
                  rows={4}
                  value={section.content}
                  onChange={(e) => updateSection(index, e.target.value)}
                  disabled={!editable}
                />
              </FormField>
            ))
          ) : (
            <FormField label="Content">
              <Textarea
                rows={20}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="font-mono text-xs"
                disabled={!editable}
              />
            </FormField>
          )}

          {paper.reviewComment && (
            <FormField label="Reviewer comment">
              <p className="rounded-md border border-border bg-surface-alt px-3 py-2 text-xs text-text-secondary whitespace-pre-wrap">
                {paper.reviewComment}
              </p>
            </FormField>
          )}
        </div>
      )}
    </SlideOver>
  );
};
```

- [ ] **Step 2: Type gate**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/audit/engagements/WorkingPapersTab.tsx
git commit -m "fix(audit): render templated working papers as structured sections (not raw JSON)"
```

---

## Task 7: Frontend report API + type — `templateId`

**Files:**
- Modify: `frontend/lib/api/audit.ts`
- Modify: `frontend/lib/types/domain.ts`

- [ ] **Step 1: Add `templateId` to `CreateReportDto`**

In `frontend/lib/api/audit.ts`, extend the `CreateReportDto` interface:

```ts
export interface CreateReportDto {
  title: string;
  executiveSummary?: string;
  scope?: string;
  methodology?: string;
  templateId?: string;
}
```

(`reportsApi.generate` and `reportsApi.update` already use `CreateReportDto` / `Partial<CreateReportDto>`, so they accept `templateId` automatically.)

- [ ] **Step 2: Add `templateId` to the `AuditReport` type**

In `frontend/lib/types/domain.ts`, add to the `AuditReport` interface (after `engagementReference?`):

```ts
  engagementReference?: string;
  templateId: string | null;
```

- [ ] **Step 3: Type gate**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/api/audit.ts frontend/lib/types/domain.ts
git commit -m "feat(report): templateId on frontend report API + type"
```

---

## Task 8: Report template selector in the generate form

**Files:**
- Modify: `frontend/components/audit/engagements/ReportTab.tsx`

Context: the "no report yet" branch renders a generate form (`useForm<GenValues>`). Add a report-template selector and submit the chosen `templateId`. `reportTemplatesApi` is exported from `@/lib/api/settings`; the `Select` primitive from `@/components/ui/Input`.

- [ ] **Step 1: Add imports**

In `ReportTab.tsx` add:

```tsx
import { Select } from '@/components/ui/Input';
import { InfoHint } from '@/components/ui/InfoHint';
import { reportTemplatesApi } from '@/lib/api/settings';
```

- [ ] **Step 2: Add `templateId` to the form schema**

Change `GenSchema` to include the template id:

```tsx
const GenSchema = z.object({
  title: z.string().min(2).max(300),
  templateId: z.string().optional().or(z.literal('')),
  executiveSummary: z.string().optional().or(z.literal('')),
  scope: z.string().optional().or(z.literal('')),
  methodology: z.string().optional().or(z.literal('')),
});
```

- [ ] **Step 3: Load templates and default the selection**

Inside `ReportTab`, near the other queries, add:

```tsx
const reportTemplates = useQuery({
  queryKey: ['settings', 'report-templates', 'list'],
  queryFn: () => reportTemplatesApi.list(),
});
```

In the `useForm` `defaultValues`, add `templateId: ''`. After the `useForm` call, default the selection to the system default once templates load:

```tsx
useEffect(() => {
  const list = reportTemplates.data;
  if (!list || list.length === 0) return;
  const def = list.find((t) => t.isDefault) ?? list[0];
  setValue('templateId', def.id);
}, [reportTemplates.data, setValue]);
```

(Add `setValue` to the destructured `useForm` return: `const { register, handleSubmit, setValue, formState: { errors } } = useForm<GenValues>({...})`.)

- [ ] **Step 4: Pass `templateId` to the generate mutation**

In the `generate` mutation's `mutationFn`, include the template id:

```tsx
mutationFn: (v: GenValues) =>
  reportsApi.generate(engagement.id, {
    title: v.title,
    templateId: v.templateId || undefined,
    executiveSummary: v.executiveSummary || undefined,
    scope: v.scope || undefined,
    methodology: v.methodology || undefined,
  }),
```

- [ ] **Step 5: Render the selector in the generate form**

In the generate `<form>` (the `!report.data` + `canGenerateReport` branch), add this as the first field, above the Title field:

```tsx
<FormField
  label={
    <span className="inline-flex items-center gap-1">
      Report template
      <InfoHint content="Controls the report's branding, classification, and section layout for the on-screen preview and the exported PDF/DOCX." />
    </span>
  }
>
  <Select {...register('templateId')}>
    {(reportTemplates.data ?? []).map((t) => (
      <option key={t.id} value={t.id}>
        {t.name}
        {t.isDefault ? ' (default)' : ''}
      </option>
    ))}
  </Select>
</FormField>
```

- [ ] **Step 6: Type gate**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/audit/engagements/ReportTab.tsx
git commit -m "feat(report): choose a report template when generating"
```

---

## Task 9: Drive the A4 preview from the applied template

**Files:**
- Modify: `frontend/components/audit/engagements/ReportTab.tsx`

Context: the "Preview" view hardcodes org name "Galaxy Backbone Limited", "CONFIDENTIAL", "Corporate Headquarters, Abuja", and green/`text-danger`. Resolve the applied template (`report.templateId` → from the already-loaded `reportTemplates`, else the default) and read its config with the same fallbacks the backend uses.

- [ ] **Step 1: Add a template-config resolver**

Inside `ReportTab`, after `const r = report.data;` (where `r` is defined in the rendered report branch), add:

```tsx
const appliedTemplate =
  (reportTemplates.data ?? []).find((t) => t.id === r.templateId) ??
  (reportTemplates.data ?? []).find((t) => t.isDefault) ??
  null;

const readStr = (cfg: unknown, key: string, fallback: string): string => {
  if (cfg && typeof cfg === 'object' && !Array.isArray(cfg)) {
    const v = (cfg as Record<string, unknown>)[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return fallback;
};
const normalizeHex = (value: string, fallback: string): string => {
  const v = value.replace(/^#/, '').trim();
  return /^[0-9a-fA-F]{6}$/.test(v) ? `#${v}` : fallback;
};

const tplHeader = appliedTemplate?.headerConfig ?? null;
const tplFooter = appliedTemplate?.footerConfig ?? null;
const previewOrgName = readStr(tplHeader, 'orgName', 'Galaxy Backbone Limited');
const previewOrgAddress = readStr(tplHeader, 'address', 'Corporate Headquarters, Abuja');
const previewClassification = readStr(tplHeader, 'classification', 'Confidential');
const previewPrimary = normalizeHex(readStr(tplHeader, 'primaryColor', '#003087'), '#003087');
const previewFooter = readStr(tplFooter, 'confidentialityNotice', '');
```

- [ ] **Step 2: Use the resolved values in the preview header + classification**

In the preview block (`activeView === 'preview'`), replace the hardcoded header strings:

- Replace the org-name line text `Galaxy Backbone Limited` with `{previewOrgName}`.
- Replace `Corporate Headquarters, Abuja` with `{previewOrgAddress}`.
- For the report title `<h1>`, set its colour from the template: add `style={{ color: previewPrimary }}` to the existing `<h1 className="text-xl font-bold tracking-tight text-text-primary uppercase">` (keep the classes, add the inline style).
- Replace the hardcoded Classification value. The current line is:
  ```tsx
  <span className="text-text-primary font-bold tracking-wider uppercase text-danger">Confidential</span>
  ```
  Replace with:
  ```tsx
  <span className="text-text-primary font-bold tracking-wider uppercase text-danger">{previewClassification}</span>
  ```

- [ ] **Step 3: Use the template's section titles + footer**

- The preview hardcodes section headings "1. Executive Summary", "2. Audit Scope", etc. If `appliedTemplate?.sections` is present, render the section number + `section.title` from the template for the four standard sections in order; otherwise keep the existing hardcoded titles. Implement by computing, before the JSX:

```tsx
const sectionTitle = (index: number, fallback: string): string => {
  const s = appliedTemplate?.sections?.[index];
  return s ? `${index + 1}. ${s.title}` : fallback;
};
```

Then replace the four hardcoded `<h2>` headings with `{sectionTitle(0, '1. Executive Summary')}`, `{sectionTitle(1, '2. Audit Scope')}`, `{sectionTitle(2, '3. Methodology')}`, `{sectionTitle(3, '4. Findings Summary Table')}` respectively.

- If `previewFooter` is non-empty, add a footer line at the very bottom of the A4 preview card (before its closing `</div>`):

```tsx
{previewFooter && (
  <div className="pt-4 mt-6 border-t border-slate-200 text-center text-[11px] text-slate-400">
    {previewFooter}
  </div>
)}
```

- [ ] **Step 4: Type gate**

Run (from `frontend/`): `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/audit/engagements/ReportTab.tsx
git commit -m "feat(report): drive the A4 preview from the applied template branding"
```

---

## Task 10: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Backend gate**

Run (from `audit-system/`): `npx prisma generate && npm run build`
Expected: client generates; tsc build succeeds.

- [ ] **Step 2: Frontend gate**

Run (from `frontend/`): `npx tsc --noEmit && npm run build`
Expected: type check clean; production build succeeds.

- [ ] **Step 3: Manual smoke (documented; requires a running app + DB)**

- New working paper → pick a non-default template → sections render → save draft.
- Reopen that working paper (View) → structured sections shown (not raw JSON) → edit + save.
- New working paper → "Blank (free text)" → free-text path still works.
- Generate a report → pick a specific template → preview shows that template's title colour / classification / section titles → export PDF + DOCX reflect it.
- Generate a report leaving the default selected → unchanged output.

- [ ] **Step 4: Commit any verification fixes**

```bash
git add -A
git commit -m "chore(sp2): verification fixes"
```

(Skip if none.)

---

## Self-review notes (author)

- **Spec coverage:** A1 picker (T5), A2 structured view/edit (T6), B1a migration (T1), B1b generate DTO + persist (T2/T3), B1c generation threading (T4), B1d response DTO (T2), B2 selector (T8) + branded preview (T9), frontend API/type (T7). Verification (T10). All spec §4–§6 items map to a task.
- **Type consistency:** `templateId` (camel, frontend + DTOs) ↔ `template_id` (snake, Prisma/SQL) used consistently; `GenerateReportRequestDto` defined in T2 and consumed in T3 (service + interface); `fetchTemplateAndConfig(templateId?)` defined in T4 and called from the three entry points in the same task; `parsePaperSections`/`PaperSection` defined and used within T6; `appliedTemplate` resolver (T9) uses `reportTemplates` query introduced in T8.
- **DB independence:** Task 1 uses hand-authored SQL (matching the repo's `migration.sql` precedent) + `prisma generate` (no DB). `prisma migrate deploy` happens at deploy time; implementers never need a live DB. This is the established pattern in `docs/PROJECT_STATE.md` §2.12.
- **No placeholders:** every code step contains complete code. Task 4 Step 1 is conditional only because the interface's optional declaration can't be seen from the plan; the new signature is given explicitly.
