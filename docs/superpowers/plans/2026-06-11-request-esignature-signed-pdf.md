# Request E-Signature: Signed-PDF Output — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce downloadable, visibly-signed PDF copies of IAMS workflow-request documents — each signer's drawn/uploaded signature stamped onto an appended signature page — while preserving the existing SHA-256 manifest tamper-evidence.

**Architecture:** Backend modular monolith (Node + Express + TypeScript + Prisma, SQL Server). A per-user signature lives in the `user` module and is stored via the existing document/storage layer. Signed-PDF generation lives in the `workflow/request` module as a pure `pdf-lib` utility plus a service that runs **once when a request completes**, reading attachment PDFs through `IDocumentService`, stamping them, and storing the signed copies as new Documents mapped back to the request. Originals are never modified. Frontend (Next.js) adds a Settings signature card, inline signature setup in the Sign dialog, and a download action on the request detail page.

**Tech Stack:** TypeScript (strict), Prisma, Zod, Express, multer, `pdf-lib` (new), Jest; Next.js 14, React Query, Tailwind, lucide-react.

**Status:** For management approval. Do **not** begin implementation until approved.

**Source spec:** `docs/superpowers/specs/2026-06-11-request-esignature-signed-pdf-design.md`

---

## Conventions reminder (from `audit-system/CLAUDE.md`)

- Prisma fields are `snake_case` with `@@map`. Every table has `id` (uuid), `created_at`; soft-delete via `deleted_at` where it applies.
- Services are class-based, stateless, throw `AppError.*`, log mutations via `logger` and `auditLogService`.
- Controllers are class-based, register routes in `_registerRoutes()`, handlers are `_action` private methods bound with `.bind(this)`, wrapped in `try/catch(next)`, respond with `buildResponse(...)`.
- Request DTOs are Zod schemas + inferred types; response DTOs are interfaces + `mapXxxToResponse()`.
- Tests: Jest. Run a single file with `npx jest <path>`.

---

## File Structure

**Backend — created**
- `src/modules/user/dto/request/signature.request.dto.ts` — Zod schema for signature upload metadata (`kind`).
- `src/modules/user/dto/response/signature.response.dto.ts` — `UserSignatureResponseDto` + mapper.
- `src/modules/user/service/interface/signature.service.interface.ts` — `IUserSignatureService`.
- `src/modules/user/service/implementation/signature.service.ts` — set / get / remove a user's active signature.
- `src/modules/user/service/implementation/signature.service.spec.ts` — tests.
- `src/modules/workflow/request/utility/signed-document.utility.ts` — pure `pdf-lib` helpers (`appendSignaturePage`, `buildCertificatePdf`).
- `src/modules/workflow/request/utility/signed-document.utility.spec.ts` — tests.
- `src/modules/workflow/request/service/interface/signed-document.service.interface.ts` — `ISignedDocumentService`.
- `src/modules/workflow/request/service/implementation/signed-document.service.ts` — orchestrates generation on completion.
- `src/modules/workflow/request/service/implementation/signed-document.service.spec.ts` — tests.

**Backend — modified**
- `prisma/schema.prisma` — new models `User_Signature`, `Workflow_Request_Signed_Document`; new column `Workflow_Request_Action.signature_id`; back-relations on `User`, `Document`, `Workflow_Request`, `Workflow_Request_Action`.
- `src/modules/user/service/implementation/user.service.ts` / `index.ts` — wire the signature service (or export it).
- `src/modules/user/controller/settings.controller.ts` — `GET/PUT/DELETE /settings/signature` (multipart upload via multer).
- `src/modules/workflow/request/service/implementation/request.service.ts` — (a) on `sign`, resolve and record the actor's active `signature_id`; (b) in the completion branch of `_advance`, fire signed-document generation.
- `src/modules/workflow/request/controller/request.controller.ts` — `GET /workflow/requests/:id/signed-documents`.
- `src/modules/workflow/request/service/interface/request.service.interface.ts` + response DTO — expose signed-document listing.
- `package.json` — add `pdf-lib`.

**Frontend — created**
- `frontend/components/common/SignaturePad.tsx` — canvas draw + upload, emits a PNG `Blob`.
- `frontend/lib/api/signature.ts` — `signatureApi` (get/save/remove) + `requestsApi.signedDocuments` lives in `lib/api/workflow.ts`.
- `frontend/app/(app)/settings/_components/SignatureCard.tsx` — Settings signature section (or inline in the settings page if that's the existing pattern).

**Frontend — modified**
- `frontend/app/(app)/requests/[id]/page.tsx` — `SignModal` inline setup + "Download signed document" list.
- `frontend/lib/api/workflow.ts` — add `signedDocuments(id)`.
- `frontend/lib/types/domain.ts` — `UserSignature`, `SignedDocument` types.

**Docs — modified**
- `docs/PROJECT_STATE.md` — note the new capability.

---

## Phase 0 — Dependencies & database

### Task 1: Add `pdf-lib`

**Files:** Modify `audit-system/package.json` (+ lockfile).

- [ ] **Step 1: Install**

Run: `npm install pdf-lib@^1.17.1`
Expected: `pdf-lib` added to `dependencies`.

- [ ] **Step 2: Verify it imports** (sanity, no test file yet)

Run: `node -e "require('pdf-lib').PDFDocument && console.log('ok')"`
Expected: prints `ok`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "build: add pdf-lib for signed-PDF generation"
```

---

### Task 2: Prisma schema — signature & signed-document tables

**Files:** Modify `audit-system/prisma/schema.prisma`.

- [ ] **Step 1: Add the two new models** (place near the workflow-request models, after `Workflow_Request_Action`)

```prisma
model User_Signature {
  id          String    @id @default(uuid())
  user_id     String
  document_id String
  kind        String // drawn | uploaded
  created_at  DateTime  @default(now())
  updated_at  DateTime  @updatedAt
  deleted_at  DateTime?

  user     User     @relation("UserSignatureOwner", fields: [user_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  document Document @relation("UserSignatureImage", fields: [document_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([user_id])
  @@map("user_signatures")
}

model Workflow_Request_Signed_Document {
  id                 String   @id @default(uuid())
  request_id         String
  source_document_id String? // null = standalone certificate
  signed_document_id String
  generated_at       DateTime @default(now())

  request         Workflow_Request @relation("RequestSignedDocs", fields: [request_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  source_document Document?        @relation("SignedDocSource", fields: [source_document_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
  signed_document Document         @relation("SignedDocOutput", fields: [signed_document_id], references: [id], onDelete: NoAction, onUpdate: NoAction)

  @@index([request_id])
  @@map("workflow_request_signed_documents")
}
```

- [ ] **Step 2: Add `signature_id` to `Workflow_Request_Action`**

In `model Workflow_Request_Action`, add the column and relation:

```prisma
  signature_id       String? // FK -> user_signatures.id, set only when action_type = sign

  signature User_Signature? @relation("ActionSignature", fields: [signature_id], references: [id], onDelete: NoAction, onUpdate: NoAction)
```

- [ ] **Step 3: Add back-relations** to the existing models so Prisma validates:

In `model User` add:
```prisma
  signatures User_Signature[] @relation("UserSignatureOwner")
```
In `model Document` add:
```prisma
  signature_uses     User_Signature[]                   @relation("UserSignatureImage")
  signed_doc_sources Workflow_Request_Signed_Document[] @relation("SignedDocSource")
  signed_doc_outputs Workflow_Request_Signed_Document[] @relation("SignedDocOutput")
```
In `model Workflow_Request` add:
```prisma
  signed_documents Workflow_Request_Signed_Document[] @relation("RequestSignedDocs")
```
In `model User_Signature` add (back-relation for actions):
```prisma
  actions Workflow_Request_Action[] @relation("ActionSignature")
```

- [ ] **Step 4: Validate & create the migration**

Run: `npx prisma validate`
Expected: "The schema at prisma/schema.prisma is valid 🚀"

Run: `npx prisma migrate dev --name add_request_esignature`
Expected: migration created and applied; `prisma generate` runs.

> If the project applies schema via `prisma db push` rather than migrations, use `npx prisma db push` instead — match the existing workflow (check `package.json` scripts / `prisma/migrations/`).

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma prisma/migrations
git commit -m "feat(db): add user_signatures and workflow_request_signed_documents"
```

---

## Phase 1 — User signature (backend)

### Task 3: Signature DTOs

**Files:**
- Create `src/modules/user/dto/request/signature.request.dto.ts`
- Create `src/modules/user/dto/response/signature.response.dto.ts`

- [ ] **Step 1: Request DTO**

```ts
// src/modules/user/dto/request/signature.request.dto.ts
import { z } from 'zod';

export const SetSignatureMetadataSchema = z.object({
  kind: z.enum(['drawn', 'uploaded']),
});

export type SetSignatureMetadataDto = z.infer<typeof SetSignatureMetadataSchema>;

/** Service-layer input: the PNG/JPG buffer parsed out of req.file by multer. */
export interface SetSignatureDto {
  userId: string;
  kind: 'drawn' | 'uploaded';
  originalName: string;
  mimeType: string;
  fileSize: number;
  buffer: Buffer;
}
```

- [ ] **Step 2: Response DTO + mapper**

```ts
// src/modules/user/dto/response/signature.response.dto.ts
export interface UserSignatureResponseDto {
  id: string;
  kind: 'drawn' | 'uploaded';
  documentId: string;
  /** Proxy URL the frontend can render. */
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}

export interface UserSignatureRow {
  id: string;
  kind: string;
  document_id: string;
  created_at: Date;
  updated_at: Date;
}

export const mapSignatureToResponse = (row: UserSignatureRow): UserSignatureResponseDto => ({
  id: row.id,
  kind: row.kind === 'uploaded' ? 'uploaded' : 'drawn',
  documentId: row.document_id,
  imageUrl: `/api/proxy/documents/${row.document_id}/file`,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
});
```

- [ ] **Step 3: Commit**

```bash
git add src/modules/user/dto/request/signature.request.dto.ts src/modules/user/dto/response/signature.response.dto.ts
git commit -m "feat(user): add signature DTOs"
```

---

### Task 4: User signature service (TDD)

**Files:**
- Create `src/modules/user/service/interface/signature.service.interface.ts`
- Create `src/modules/user/service/implementation/signature.service.ts`
- Test `src/modules/user/service/implementation/signature.service.spec.ts`

Constraints: at most one active (`deleted_at = null`) signature per user. Replacing soft-deletes the prior row. Image is stored via `IDocumentService.upload(...)` with `module: 'user'`, `entityType: 'user_signature'`, `entityId: userId`.

- [ ] **Step 1: Interface**

```ts
// src/modules/user/service/interface/signature.service.interface.ts
import { SetSignatureDto } from '../../dto/request/signature.request.dto';
import { UserSignatureResponseDto } from '../../dto/response/signature.response.dto';

export interface IUserSignatureService {
  /** Create or replace the caller's active signature. */
  setSignature(dto: SetSignatureDto): Promise<UserSignatureResponseDto>;
  /** Active signature for a user, or null. */
  getActiveSignature(userId: string): Promise<UserSignatureResponseDto | null>;
  /** Active signature row id + document id (for the sign flow / generator). */
  getActiveSignatureRef(userId: string): Promise<{ id: string; documentId: string } | null>;
  /** Soft-delete the caller's active signature. */
  removeSignature(userId: string): Promise<void>;
}
```

- [ ] **Step 2: Write failing tests**

```ts
// src/modules/user/service/implementation/signature.service.spec.ts
import { UserSignatureService } from './signature.service';

const docService = {
  upload: jest.fn().mockResolvedValue({ id: 'doc-1' }),
} as never;

const tx = {
  user_Signature: {
    findFirst: jest.fn(),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    create: jest.fn(),
  },
};
jest.mock('../../../../shared/prisma/prisma.client', () => ({
  prisma: {
    $transaction: (fn: (t: typeof tx) => unknown) => fn(tx),
    user_Signature: tx.user_Signature,
  },
}));

const baseDto = {
  userId: 'u1', kind: 'drawn' as const, originalName: 'sig.png',
  mimeType: 'image/png', fileSize: 1234, buffer: Buffer.from('x'),
};

describe('UserSignatureService.setSignature', () => {
  beforeEach(() => jest.clearAllMocks());

  it('stores the image and creates an active row, soft-deleting any prior', async () => {
    tx.user_Signature.create.mockResolvedValue({
      id: 's1', kind: 'drawn', document_id: 'doc-1',
      created_at: new Date('2026-06-11'), updated_at: new Date('2026-06-11'),
    });

    const svc = new UserSignatureService(docService);
    const res = await svc.setSignature(baseDto);

    expect(docService.upload).toHaveBeenCalledWith(
      expect.objectContaining({ module: 'user', entityType: 'user_signature', entityId: 'u1' }),
    );
    expect(tx.user_Signature.updateMany).toHaveBeenCalledWith({
      where: { user_id: 'u1', deleted_at: null },
      data: { deleted_at: expect.any(Date) },
    });
    expect(res.kind).toBe('drawn');
    expect(res.documentId).toBe('doc-1');
  });
});
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npx jest src/modules/user/service/implementation/signature.service.spec.ts`
Expected: FAIL (`UserSignatureService` not found).

- [ ] **Step 4: Implement the service**

```ts
// src/modules/user/service/implementation/signature.service.ts
import { prisma } from '../../../../shared/prisma/prisma.client';
import { logger } from '../../../../shared/utils/logger.util';
import { AppError } from '../../../../shared/errors/app.error'; // FIX: file is app.error.ts, not app-error
import { IDocumentService } from '../../../document/service/interface/document.service.interface';
import { DocumentService } from '../../../document'; // FIX: no documentService singleton export; instantiate the class
import { SetSignatureDto } from '../../dto/request/signature.request.dto';
import {
  UserSignatureResponseDto,
  mapSignatureToResponse,
} from '../../dto/response/signature.response.dto';
import { IUserSignatureService } from '../interface/signature.service.interface';

const ALLOWED_MIME = new Set(['image/png', 'image/jpeg']);
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

export class UserSignatureService implements IUserSignatureService {
  constructor(private readonly documents: IDocumentService) {}

  async setSignature(dto: SetSignatureDto): Promise<UserSignatureResponseDto> {
    if (!ALLOWED_MIME.has(dto.mimeType)) {
      throw AppError.badRequest('Signature must be a PNG or JPG image');
    }
    if (dto.fileSize > MAX_BYTES) {
      throw AppError.badRequest('Signature image must be 2 MB or smaller');
    }

    const doc = await this.documents.upload({
      uploadedById: dto.userId,
      originalName: dto.originalName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize,
      buffer: dto.buffer,
      module: 'user',
      entityType: 'user_signature',
      entityId: dto.userId,
    });

    const row = await prisma.$transaction(async (tx) => {
      await tx.user_Signature.updateMany({
        where: { user_id: dto.userId, deleted_at: null },
        data: { deleted_at: new Date() },
      });
      return tx.user_Signature.create({
        data: { user_id: dto.userId, document_id: doc.id, kind: dto.kind },
      });
    });

    logger.info('User signature set', { userId: dto.userId, signatureId: row.id, kind: dto.kind });
    return mapSignatureToResponse(row);
  }

  async getActiveSignature(userId: string): Promise<UserSignatureResponseDto | null> {
    const row = await prisma.user_Signature.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' },
    });
    return row ? mapSignatureToResponse(row) : null;
  }

  async getActiveSignatureRef(userId: string): Promise<{ id: string; documentId: string } | null> {
    const row = await prisma.user_Signature.findFirst({
      where: { user_id: userId, deleted_at: null },
      orderBy: { created_at: 'desc' },
      select: { id: true, document_id: true },
    });
    return row ? { id: row.id, documentId: row.document_id } : null;
  }

  async removeSignature(userId: string): Promise<void> {
    await prisma.user_Signature.updateMany({
      where: { user_id: userId, deleted_at: null },
      data: { deleted_at: new Date() },
    });
    logger.info('User signature removed', { userId });
  }
}

export const userSignatureService = new UserSignatureService(new DocumentService());
```

> FIX (verified against codebase): `src/modules/document/index.ts` does **not** export a `documentService` singleton — only the `DocumentService` class and `IDocumentService` type. Every consumer (e.g. `request.service.ts`) does `new DocumentService()`. The prisma client path is `shared/prisma/prisma.client` and the error class is `shared/errors/app.error`.

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx jest src/modules/user/service/implementation/signature.service.spec.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/modules/user/service/interface/signature.service.interface.ts src/modules/user/service/implementation/signature.service.ts src/modules/user/service/implementation/signature.service.spec.ts
git commit -m "feat(user): signature service (set/get/remove, one active per user)"
```

---

### Task 5: Settings signature routes

**Files:** Modify `src/modules/user/controller/settings.controller.ts`.

Mirror the multipart pattern from `document.controller.ts` (multer `memoryStorage`, `req.file`).

- [ ] **Step 1: Add routes in `_registerRoutes()`**

```ts
// multer single-file, in-memory (top of file)
import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });
```
```ts
// inside _registerRoutes()
// NOTE: SettingsController already calls this.router.use(authenticate) globally,
// so the per-route `authenticate` below is redundant but harmless.
// FIX: route is POST, not PUT — the frontend api.upload() helper is POST-only.
this.router.get('/signature', this._getSignature.bind(this));
this.router.post(
  '/signature',
  upload.single('file'),
  validate(SetSignatureMetadataSchema),
  this._setSignature.bind(this),
);
this.router.delete('/signature', this._removeSignature.bind(this));
```

- [ ] **Step 2: Handlers**

```ts
private async _getSignature(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const sig = await userSignatureService.getActiveSignature(req.user!.id);
    res.status(200).json(buildResponse(sig));
  } catch (err) { next(err); }
}

private async _setSignature(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    if (!req.file) throw AppError.badRequest('Signature image file is required');
    const sig = await userSignatureService.setSignature({
      userId: req.user!.id,
      kind: (req.body.kind as 'drawn' | 'uploaded'),
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
      fileSize: req.file.size,
      buffer: req.file.buffer,
    });
    res.status(200).json(buildResponse(sig, 'Signature saved'));
  } catch (err) { next(err); }
}

private async _removeSignature(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await userSignatureService.removeSignature(req.user!.id);
    res.status(200).json(buildResponse(null, 'Signature removed'));
  } catch (err) { next(err); }
}
```

- [ ] **Step 3: Manual smoke (no auto-test for controllers per existing convention)**

Run the API, `PUT /api/v1/settings/signature` with a PNG and `kind=drawn`; expect 200 + body. `GET` returns it; `DELETE` clears it.

- [ ] **Step 4: Commit**

```bash
git add src/modules/user/controller/settings.controller.ts
git commit -m "feat(user): settings signature endpoints (get/put/delete)"
```

---

## Phase 2 — Record which signature was used on signing

### Task 6: Stamp `signature_id` onto the sign action

**Files:** Modify `src/modules/workflow/request/service/implementation/request.service.ts`.

The sign path calls `_advance(..., { stepStatus: Signed, signatureHash, signatureManifest })`. Resolve the actor's active signature and persist its id.

- [ ] **Step 1: Extend `_advance` opts and the action write**

Add `signatureId?: string` to the `opts` type of `_advance`, and in the `tx.workflow_Request_Action.create({ data: { ... } })` add:
```ts
          signature_id: opts.signatureId ?? null,
```

- [ ] **Step 2: Resolve the active signature in the `sign` method**

In the public `sign(...)` method, before calling `_advance`, look up the signature ref and pass it through:
```ts
import { userSignatureService } from '../../../../user/service/implementation/signature.service';
// ...
const sigRef = await userSignatureService.getActiveSignatureRef(actor.id);
// pass signatureId: sigRef?.id into the _advance opts alongside signatureHash/signatureManifest
```

> Cross-module call goes through the service singleton (allowed pattern). No behavioural change when the user has no signature — `signature_id` is simply null and the existing manifest-hash signature is unaffected.

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/modules/workflow/request/service/implementation/request.service.ts
git commit -m "feat(workflow): record signature_id on sign actions"
```

---

## Phase 3 — Signed-PDF generation (core)

### Task 7: `signed-document` pdf-lib utility (TDD)

**Files:**
- Create `src/modules/workflow/request/utility/signed-document.utility.ts`
- Test `src/modules/workflow/request/utility/signed-document.utility.spec.ts`

Pure functions, no DB/IO. `appendSignaturePage` adds one page to an existing PDF; `buildCertificatePdf` makes a standalone one. Both render the same signature panel.

- [ ] **Step 1: Define types + write failing tests**

```ts
// src/modules/workflow/request/utility/signed-document.utility.spec.ts
import { PDFDocument } from 'pdf-lib';
import { appendSignaturePage, buildCertificatePdf, SignaturePageData } from './signed-document.utility';

const data: SignaturePageData = {
  reference: 'REQ-2026-0142',
  title: 'Q2 Budget Memo',
  manifestHash: 'a1b2c3'.padEnd(64, '0'),
  fileChecksum: 'deadbeef'.padEnd(64, '0'),
  entries: [
    { name: 'Adewole Akande', role: 'Lead Auditor', actedAt: new Date('2026-06-11T14:32:00Z'), action: 'signed' },
    { name: 'Joseph Bello', role: 'Audit Manager', actedAt: new Date('2026-06-11T15:01:00Z'), action: 'approved' },
  ],
};

it('appends exactly one page to the source PDF', async () => {
  const src = await PDFDocument.create();
  src.addPage();
  const srcBytes = Buffer.from(await src.save());

  const out = await appendSignaturePage(srcBytes, data);
  const reloaded = await PDFDocument.load(out);

  expect(reloaded.getPageCount()).toBe(2);
  expect(out.length).toBeGreaterThan(srcBytes.length);
});

it('builds a one-page standalone certificate', async () => {
  const out = await buildCertificatePdf(data);
  const reloaded = await PDFDocument.load(out);
  expect(reloaded.getPageCount()).toBe(1);
});

it('embeds a signature image when provided', async () => {
  const png = await makeTinyPng();
  const withImg: SignaturePageData = {
    ...data,
    entries: [{ ...data.entries[0], signatureImage: { bytes: png, format: 'png' } }],
  };
  const out = await buildCertificatePdf(withImg);
  expect(out.length).toBeGreaterThan(0);
});

async function makeTinyPng(): Promise<Buffer> {
  const doc = await PDFDocument.create(); // borrow pdf-lib only to keep deps minimal
  void doc;
  // 1x1 transparent PNG
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
    'base64',
  );
}
```

- [ ] **Step 2: Run tests — expect FAIL**

Run: `npx jest src/modules/workflow/request/utility/signed-document.utility.spec.ts`
Expected: FAIL (module not found).

- [ ] **Step 3: Implement the utility**

```ts
// src/modules/workflow/request/utility/signed-document.utility.ts
import { PDFDocument, StandardFonts, rgb, PDFFont, PDFPage } from 'pdf-lib';

export interface SignaturePanelEntry {
  name: string;
  role: string;
  actedAt: Date;
  action: 'signed' | 'approved';
  signatureImage?: { bytes: Buffer; format: 'png' | 'jpg' };
}

export interface SignaturePageData {
  reference: string;
  title: string;
  manifestHash: string;
  fileChecksum?: string;
  entries: SignaturePanelEntry[];
}

const MARGIN = 50;
const A4: [number, number] = [595.28, 841.89];

const fmt = (d: Date): string =>
  d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

async function drawPanel(
  pdf: PDFDocument,
  page: PDFPage,
  font: PDFFont,
  bold: PDFFont,
  data: SignaturePageData,
): Promise<void> {
  const { width, height } = page.getSize();
  let y = height - MARGIN;

  page.drawText('CERTIFICATE OF SIGNATURES', { x: MARGIN, y, size: 16, font: bold, color: rgb(0.06, 0.09, 0.16) });
  y -= 26;
  page.drawText(`Request: ${data.reference}`, { x: MARGIN, y, size: 10, font });
  y -= 14;
  page.drawText(`Title: ${data.title}`, { x: MARGIN, y, size: 10, font });
  y -= 24;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 1, color: rgb(0.8, 0.84, 0.9) });
  y -= 24;

  for (const e of data.entries) {
    if (y < MARGIN + 90) {
      page = pdf.addPage(A4);
      y = page.getSize().height - MARGIN;
    }
    if (e.signatureImage) {
      const img =
        e.signatureImage.format === 'png'
          ? await pdf.embedPng(e.signatureImage.bytes)
          : await pdf.embedJpg(e.signatureImage.bytes);
      const dims = img.scaleToFit(180, 50);
      page.drawImage(img, { x: MARGIN, y: y - dims.height, width: dims.width, height: dims.height });
      y -= dims.height + 6;
    } else {
      page.drawText('(Approved — no signature)', { x: MARGIN, y: y - 14, size: 10, font, color: rgb(0.45, 0.5, 0.58) });
      y -= 22;
    }
    page.drawText(`${e.name} — ${e.role}`, { x: MARGIN, y, size: 11, font: bold });
    y -= 14;
    const verb = e.action === 'signed' ? 'Signed' : 'Approved';
    page.drawText(`${verb} ${fmt(e.actedAt)}`, { x: MARGIN, y, size: 9, font, color: rgb(0.4, 0.45, 0.53) });
    y -= 24;
  }

  y -= 6;
  page.drawLine({ start: { x: MARGIN, y }, end: { x: width - MARGIN, y }, thickness: 0.5, color: rgb(0.85, 0.88, 0.92) });
  y -= 16;
  page.drawText('Integrity', { x: MARGIN, y, size: 9, font: bold, color: rgb(0.4, 0.45, 0.53) });
  y -= 12;
  page.drawText(`Manifest SHA-256: ${data.manifestHash}`, { x: MARGIN, y, size: 7, font, color: rgb(0.4, 0.45, 0.53) });
  if (data.fileChecksum) {
    y -= 10;
    page.drawText(`File SHA-256: ${data.fileChecksum}`, { x: MARGIN, y, size: 7, font, color: rgb(0.4, 0.45, 0.53) });
  }
  y -= 12;
  page.drawText('Generated by IAMS. Verify in-app under the request.', { x: MARGIN, y, size: 7, font, color: rgb(0.55, 0.6, 0.66) });
}

export async function appendSignaturePage(sourcePdf: Buffer, data: SignaturePageData): Promise<Buffer> {
  const pdf = await PDFDocument.load(sourcePdf);
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(A4);
  await drawPanel(pdf, page, font, bold, data);
  return Buffer.from(await pdf.save());
}

export async function buildCertificatePdf(data: SignaturePageData): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const page = pdf.addPage(A4);
  await drawPanel(pdf, page, font, bold, data);
  return Buffer.from(await pdf.save());
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npx jest src/modules/workflow/request/utility/signed-document.utility.spec.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/modules/workflow/request/utility/signed-document.utility.ts src/modules/workflow/request/utility/signed-document.utility.spec.ts
git commit -m "feat(workflow): pdf-lib signature-page utility"
```

---

### Task 8: Signed-document service (TDD)

**Files:**
- Create `src/modules/workflow/request/service/interface/signed-document.service.interface.ts`
- Create `src/modules/workflow/request/service/implementation/signed-document.service.ts`
- Test `src/modules/workflow/request/service/implementation/signed-document.service.spec.ts`

Responsibilities: on a completed request, gather PDF attachments (Documents with `entity_type = ATTACHMENT_ENTITY_TYPE`, `entity_id = requestId`, `mime_type = application/pdf`), build the signature-panel entries from steps + actions (sign → embed the signer's signature image via the recorded `signature_id`; approve → no image), stamp each PDF, store the signed copy via `documentService.upload`, and write a `workflow_request_signed_documents` row. No attachment → one standalone certificate. Per-attachment `try/catch` so one failure never blocks the rest or the request flow.

- [ ] **Step 1: Interface**

```ts
// src/modules/workflow/request/service/interface/signed-document.service.interface.ts
export interface SignedDocumentSummary {
  id: string;
  sourceName: string | null; // null = standalone certificate
  signedDocumentId: string;
  downloadUrl: string;
  generatedAt: string;
}

export interface ISignedDocumentService {
  /** Idempotent-ish: generates signed copies for a completed request. Fire-and-forget safe. */
  generateForCompletedRequest(requestId: string): Promise<void>;
  list(requestId: string): Promise<SignedDocumentSummary[]>;
}
```

- [ ] **Step 2: Write failing tests** (focus on entry-building + per-attachment isolation; mock prisma + documentService + the utility)

```ts
// src/modules/workflow/request/service/implementation/signed-document.service.spec.ts
import { SignedDocumentService } from './signed-document.service';
import * as util from '../../utility/signed-document.utility';

jest.mock('../../utility/signed-document.utility');

const documents = {
  listByEntity: jest.fn(),
  getFileById: jest.fn(),
  upload: jest.fn().mockResolvedValue({ id: 'signed-doc' }),
} as never;

const prismaMock = {
  workflow_Request: { findUnique: jest.fn() },
  user_Signature: { findUnique: jest.fn() },
  workflow_Request_Signed_Document: { create: jest.fn(), findMany: jest.fn() },
};
jest.mock('../../../../../shared/prisma/prisma.client', () => ({ prisma: prismaMock }));

beforeEach(() => jest.clearAllMocks());

it('continues generating other attachments when one PDF fails', async () => {
  prismaMock.workflow_Request.findUnique.mockResolvedValue({
    id: 'r1', reference_number: 'REQ-1', title: 'T',
    steps: [], actions: [],
  });
  (documents.listByEntity as jest.Mock).mockResolvedValue([
    { id: 'a1', originalName: 'a.pdf', mimeType: 'application/pdf' },
    { id: 'a2', originalName: 'b.pdf', mimeType: 'application/pdf' },
  ]);
  (documents.getFileById as jest.Mock)
    .mockResolvedValueOnce({ buffer: Buffer.from('x') })   // a1 ok
    .mockRejectedValueOnce(new Error('corrupt'));          // a2 fails
  (util.appendSignaturePage as jest.Mock).mockResolvedValue(Buffer.from('signed'));

  const svc = new SignedDocumentService(documents);
  await svc.generateForCompletedRequest('r1');

  // one succeeded → one mapping row, no throw
  expect(prismaMock.workflow_Request_Signed_Document.create).toHaveBeenCalledTimes(1);
});

it('produces a standalone certificate when there are no attachments', async () => {
  prismaMock.workflow_Request.findUnique.mockResolvedValue({
    id: 'r1', reference_number: 'REQ-1', title: 'T', steps: [], actions: [],
  });
  (documents.listByEntity as jest.Mock).mockResolvedValue([]);
  (util.buildCertificatePdf as jest.Mock).mockResolvedValue(Buffer.from('cert'));

  const svc = new SignedDocumentService(documents);
  await svc.generateForCompletedRequest('r1');

  expect(util.buildCertificatePdf).toHaveBeenCalledTimes(1);
  expect(prismaMock.workflow_Request_Signed_Document.create).toHaveBeenCalledWith(
    expect.objectContaining({ data: expect.objectContaining({ source_document_id: null }) }),
  );
});
```

- [ ] **Step 3: Run tests — expect FAIL**

Run: `npx jest src/modules/workflow/request/service/implementation/signed-document.service.spec.ts`
Expected: FAIL (service not found).

- [ ] **Step 4: Implement the service**

```ts
// src/modules/workflow/request/service/implementation/signed-document.service.ts
import crypto from 'crypto';
import { prisma } from '../../../../../shared/prisma/prisma.client';
import { logger } from '../../../../../shared/utils/logger.util';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { DocumentService } from '../../../../document'; // FIX: instantiate the class; no singleton export
import {
  appendSignaturePage,
  buildCertificatePdf,
  SignaturePanelEntry,
  SignaturePageData,
} from '../../utility/signed-document.utility';
import {
  ISignedDocumentService,
  SignedDocumentSummary,
} from '../interface/signed-document.service.interface';

const ATTACHMENT_ENTITY_TYPE = 'workflow_request';
const SIGNED_ENTITY_TYPE = 'workflow_request_signed';

export class SignedDocumentService implements ISignedDocumentService {
  constructor(private readonly documents: IDocumentService) {}

  async generateForCompletedRequest(requestId: string): Promise<void> {
    try {
      const request = await prisma.workflow_Request.findUnique({
        where: { id: requestId },
        include: { steps: { include: { recipient: true } }, actions: true },
      });
      if (!request) return;

      const entries = await this._buildEntries(request);
      const manifestHash =
        [...request.actions].reverse().find((a) => a.action_type === 'sign')?.signature_hash ?? '—';

      const attachments = (await this.documents.listByEntity(ATTACHMENT_ENTITY_TYPE, requestId)).filter(
        (d) => d.mimeType === 'application/pdf',
      );

      if (attachments.length === 0) {
        const bytes = await buildCertificatePdf({
          reference: request.reference_number,
          title: request.title,
          manifestHash,
          entries,
        });
        await this._store(requestId, null, request.reference_number, bytes, request.initiator_id);
        return;
      }

      for (const att of attachments) {
        try {
          const file = await this.documents.getFileById(att.id);
          const data: SignaturePageData = {
            reference: request.reference_number,
            title: request.title,
            manifestHash,
            fileChecksum: crypto.createHash('sha256').update(file.buffer).digest('hex'),
            entries,
          };
          const signed = await appendSignaturePage(file.buffer, data);
          await this._store(requestId, att.id, att.originalName, signed, request.initiator_id);
        } catch (err) {
          logger.warn('Signed-PDF generation failed for attachment', { requestId, documentId: att.id, err });
        }
      }
    } catch (err) {
      logger.warn('Signed-PDF generation failed for request', { requestId, err });
    }
  }

  async list(requestId: string): Promise<SignedDocumentSummary[]> {
    const rows = await prisma.workflow_Request_Signed_Document.findMany({
      where: { request_id: requestId },
      include: { source_document: true },
      orderBy: { generated_at: 'asc' },
    });
    return rows.map((r) => ({
      id: r.id,
      sourceName: r.source_document?.original_name ?? null,
      signedDocumentId: r.signed_document_id,
      downloadUrl: `/api/proxy/documents/${r.signed_document_id}/file`,
      generatedAt: r.generated_at.toISOString(),
    }));
  }

  private async _buildEntries(request: {
    steps: Array<{ recipient_id: string; status: string; acted_at: Date | null; recipient: { display_name: string | null; first_name: string; last_name: string; job_title: string | null } }>;
    actions: Array<{ actor_id: string; action_type: string; signature_id: string | null; created_at: Date }>;
  }): Promise<SignaturePanelEntry[]> {
    const entries: SignaturePanelEntry[] = [];
    for (const step of request.steps) {
      if (step.status !== 'signed' && step.status !== 'approved') continue;
      const name = step.recipient.display_name?.trim() || `${step.recipient.first_name} ${step.recipient.last_name}`.trim();
      const role = step.recipient.job_title ?? '';
      const actedAt = step.acted_at ?? new Date();

      if (step.status === 'signed') {
        const action = [...request.actions].reverse().find((a) => a.actor_id === step.recipient_id && a.action_type === 'sign');
        let signatureImage: SignaturePanelEntry['signatureImage'];
        if (action?.signature_id) {
          const sig = await prisma.user_Signature.findUnique({ where: { id: action.signature_id } });
          if (sig) {
            const file = await this.documents.getFileById(sig.document_id);
            signatureImage = { bytes: file.buffer, format: file.mimeType === 'image/jpeg' ? 'jpg' : 'png' };
          }
        }
        entries.push({ name, role, actedAt, action: 'signed', signatureImage });
      } else {
        entries.push({ name, role, actedAt, action: 'approved' });
      }
    }
    return entries;
  }

  private async _store(requestId: string, sourceId: string | null, baseName: string, bytes: Buffer, uploadedById: string): Promise<void> {
    const signedName = baseName.replace(/\.pdf$/i, '') + ' (signed).pdf';
    const doc = await this.documents.upload({
      uploadedById, // FIX: Document.uploaded_by_id is a required FK to users; use the request initiator, not a fake 'system' id
      originalName: signedName,
      mimeType: 'application/pdf',
      fileSize: bytes.length,
      buffer: bytes,
      module: 'workflow',
      entityType: SIGNED_ENTITY_TYPE,
      entityId: requestId,
    });
    await prisma.workflow_Request_Signed_Document.create({
      data: { request_id: requestId, source_document_id: sourceId, signed_document_id: doc.id },
    });
    logger.info('Signed document generated', { requestId, sourceId, signedDocumentId: doc.id });
  }
}

export const signedDocumentService = new SignedDocumentService(new DocumentService());
```

> Integration details verified against the codebase: (1) `getFileById` returns `ServedFileDto` whose buffer field is `buffer` (see `document.response.dto.ts`) — used as-is. (2) `uploaded_by_id` is a required FK to `users`, so the signed copy is uploaded as the request **initiator** (threaded in as `uploadedById`), not a fake `'system'` id.

- [ ] **Step 5: Run tests — expect PASS**

Run: `npx jest src/modules/workflow/request/service/implementation/signed-document.service.spec.ts`
Expected: PASS (2 tests).

- [ ] **Step 6: Commit**

```bash
git add src/modules/workflow/request/service/interface/signed-document.service.interface.ts src/modules/workflow/request/service/implementation/signed-document.service.ts src/modules/workflow/request/service/implementation/signed-document.service.spec.ts
git commit -m "feat(workflow): signed-document generation service"
```

---

### Task 9: Trigger generation on completion + expose listing

**Files:** Modify `request.service.ts` and `request.controller.ts` (+ its interface/DTO).

- [ ] **Step 1: Fire generation in the completion branch of `_advance`**

In `_advance`, the `else` branch (no `nextStep`, request just completed) currently only notifies. Add a fire-and-forget call after the existing notify:
```ts
import { signedDocumentService } from './signed-document.service';
// ...
} else {
  void this._notifyRequestEvent(/* ...existing... */);
  void signedDocumentService
    .generateForCompletedRequest(requestId)
    .catch((err) => logger.warn('Signed-doc generation enqueue failed', { requestId, err }));
}
```

> Generation is intentionally outside the DB transaction and non-blocking — it must never delay or fail the user's sign action (consistent with how notifications are fired).

- [ ] **Step 2: Add the listing endpoint** in `request.controller.ts`:
```ts
this.router.get('/requests/:id/signed-documents', authenticate, requirePermission('request:read'), this._listSignedDocuments.bind(this));
```
```ts
private async _listSignedDocuments(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const docs = await signedDocumentService.list(req.params.id);
    res.status(200).json(buildResponse(docs));
  } catch (err) { next(err); }
}
```

> Access: reuse `request:read`; the request service already enforces participant scoping on the parent record. If a stricter participant check is wanted, gate inside the service.

- [ ] **Step 3: Typecheck + run the workflow test suite**

Run: `npx tsc --noEmit -p tsconfig.json`
Run: `npx jest src/modules/workflow`
Expected: no type errors; tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/modules/workflow/request/service/implementation/request.service.ts src/modules/workflow/request/controller/request.controller.ts
git commit -m "feat(workflow): generate signed PDFs on completion + list endpoint"
```

---

## Phase 4 — Frontend

### Task 10: Signature API client + domain types

**Files:**
- Create `frontend/lib/api/signature.ts`
- Modify `frontend/lib/api/workflow.ts`, `frontend/lib/types/domain.ts`

- [ ] **Step 1: Types** in `domain.ts`
```ts
export interface UserSignature {
  id: string;
  kind: 'drawn' | 'uploaded';
  documentId: string;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
}
export interface SignedDocument {
  id: string;
  sourceName: string | null;
  signedDocumentId: string;
  downloadUrl: string;
  generatedAt: string;
}
```

- [ ] **Step 2: `signatureApi`**
```ts
// frontend/lib/api/signature.ts
import { api } from './api-client';
import type { UserSignature } from '../types/domain';

export const signatureApi = {
  get: () => api.get<UserSignature | null>('/settings/signature'),
  save: (file: Blob, kind: 'drawn' | 'uploaded') => {
    const fd = new FormData();
    fd.append('file', file, 'signature.png');
    fd.append('kind', kind);
    return api.upload<UserSignature>('/settings/signature', fd); // FIX: api.upload is POST-only; route is POST
  },
  remove: () => api.delete('/settings/signature'),
};
```
> Confirm `api.upload` signature/method support; if it's POST-only, add a method arg or use the proxy route pattern already used by `requestsApi.addAttachment`.

- [ ] **Step 3: `signedDocuments` in `workflow.ts`**
```ts
signedDocuments: (id: string) => api.get<SignedDocument[]>(`/workflow/requests/${id}/signed-documents`),
```

- [ ] **Step 4: Commit**
```bash
git add frontend/lib/api/signature.ts frontend/lib/api/workflow.ts frontend/lib/types/domain.ts
git commit -m "feat(web): signature + signed-document api clients"
```

---

### Task 11: `SignaturePad` component (draw + upload)

**Files:** Create `frontend/components/common/SignaturePad.tsx`.

Minimal canvas (pointer events) with Draw/Upload tabs, emitting a PNG `Blob` and the chosen `kind`. No new dependency.

- [ ] **Step 1: Implement**
```tsx
'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/Button';

export function SignaturePad({ onChange }: { onChange: (blob: Blob, kind: 'drawn' | 'uploaded') => void }): JSX.Element {
  const [tab, setTab] = useState<'draw' | 'upload'>('draw');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const pos = (e: React.PointerEvent) => {
    const r = canvasRef.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const start = (e: React.PointerEvent) => { drawing.current = true; const c = canvasRef.current!.getContext('2d')!; const p = pos(e); c.beginPath(); c.moveTo(p.x, p.y); };
  const move = (e: React.PointerEvent) => { if (!drawing.current) return; const c = canvasRef.current!.getContext('2d')!; const p = pos(e); c.lineWidth = 2; c.lineCap = 'round'; c.strokeStyle = '#0f172a'; c.lineTo(p.x, p.y); c.stroke(); };
  const end = () => { drawing.current = false; };
  const clear = () => { const c = canvasRef.current!; c.getContext('2d')!.clearRect(0, 0, c.width, c.height); };
  const saveDrawn = () => canvasRef.current!.toBlob((b) => b && onChange(b, 'drawn'), 'image/png');

  return (
    <div>
      <div className="mb-2 flex gap-2 text-sm">
        <button type="button" onClick={() => setTab('draw')} className={tab === 'draw' ? 'font-semibold text-primary' : 'text-text-secondary'}>Draw</button>
        <button type="button" onClick={() => setTab('upload')} className={tab === 'upload' ? 'font-semibold text-primary' : 'text-text-secondary'}>Upload</button>
      </div>
      {tab === 'draw' ? (
        <div>
          <canvas ref={canvasRef} width={360} height={120} className="w-full rounded-md border border-border bg-white touch-none"
            onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} />
          <div className="mt-2 flex gap-2">
            <Button size="sm" variant="ghost" onClick={clear}>Clear</Button>
            <Button size="sm" onClick={saveDrawn}>Use signature</Button>
          </div>
        </div>
      ) : (
        <input type="file" accept="image/png,image/jpeg" onChange={(e) => { const f = e.target.files?.[0]; if (f) onChange(f, 'uploaded'); }} />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**
Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 3: Commit**
```bash
git add frontend/components/common/SignaturePad.tsx
git commit -m "feat(web): SignaturePad (draw + upload)"
```

---

### Task 12: Settings signature card

**Files:** Create `frontend/app/(app)/settings/_components/SignatureCard.tsx`; wire into the existing settings page (match its current section pattern).

- [ ] **Step 1: Implement the card** — query `signatureApi.get()`; if present show the image + Replace/Remove; else show `SignaturePad`; on change call `signatureApi.save(blob, kind)` and invalidate `['signature']`.
```tsx
'use client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Card, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { SignaturePad } from '@/components/common/SignaturePad';
import { signatureApi } from '@/lib/api/signature';

export function SignatureCard(): JSX.Element {
  const qc = useQueryClient();
  const { data: sig, isLoading } = useQuery({ queryKey: ['signature'], queryFn: () => signatureApi.get() });
  const save = useMutation({
    mutationFn: ({ blob, kind }: { blob: Blob; kind: 'drawn' | 'uploaded' }) => signatureApi.save(blob, kind),
    onSuccess: () => { toast.success('Signature saved'); qc.invalidateQueries({ queryKey: ['signature'] }); },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });
  const remove = useMutation({
    mutationFn: () => signatureApi.remove(),
    onSuccess: () => { toast.success('Signature removed'); qc.invalidateQueries({ queryKey: ['signature'] }); },
  });

  return (
    <Card>
      <CardHeader title="Signature" subtitle="Used when you sign requests. Drawn or uploaded." />
      {isLoading ? null : sig ? (
        <div className="space-y-3">
          <img src={sig.imageUrl} alt="Your signature" className="h-20 rounded-md border border-border bg-white object-contain p-2" />
          <div className="flex gap-2">
            <Button size="sm" variant="secondary" onClick={() => qc.setQueryData(['signature'], null)}>Replace</Button>
            <Button size="sm" variant="danger" isLoading={remove.isPending} onClick={() => remove.mutate()}>Remove</Button>
          </div>
        </div>
      ) : (
        <SignaturePad onChange={(blob, kind) => save.mutate({ blob, kind })} />
      )}
    </Card>
  );
}
```
> "Replace" clears the cached query to reveal the pad; the actual delete happens on the next save (which soft-deletes the prior row server-side). If you prefer an explicit delete-then-add, call `remove.mutate()` instead.

- [ ] **Step 2: Mount it** in the settings page following the existing layout. Typecheck.
Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`

- [ ] **Step 3: Commit**
```bash
git add frontend/app/(app)/settings
git commit -m "feat(web): settings signature card"
```

---

### Task 13: Inline setup in the Sign dialog + download list

**Files:** Modify `frontend/app/(app)/requests/[id]/page.tsx`.

- [ ] **Step 1: Inline setup in `SignModal`** — before signing, query `signatureApi.get()`. If null, render `SignaturePad` and require the user to save a signature first (its save invalidates `['signature']`); only enable "Sign now" once a signature exists (in addition to the existing typed-name affirmation match). No backend change needed — the server records `signature_id` from the user's active signature at sign time.
```tsx
// inside SignModal:
const { data: sig } = useQuery({ queryKey: ['signature'], queryFn: () => signatureApi.get() });
const save = useMutation({
  mutationFn: ({ blob, kind }: { blob: Blob; kind: 'drawn' | 'uploaded' }) => signatureApi.save(blob, kind),
  onSuccess: () => qc.invalidateQueries({ queryKey: ['signature'] }),
});
// if (!sig) render <SignaturePad onChange={(blob, kind) => save.mutate({ blob, kind })} /> with a note
// disable "Sign now" until: matches (typed name) && !!sig
```

- [ ] **Step 2: Download list** — when `req.status === 'completed'`, query `requestsApi.signedDocuments(id)` and render a "Signed documents" card with download links (`href={d.downloadUrl}` target=_blank), one per entry; label by `sourceName ?? 'Signature certificate'`.
```tsx
const signed = useQuery({
  queryKey: ['request', id, 'signed'],
  queryFn: () => requestsApi.signedDocuments(id),
  enabled: req?.status === 'completed',
});
// render Card with signed.data?.map(d => <a href={d.downloadUrl} target="_blank" rel="noopener noreferrer">{d.sourceName ?? 'Signature certificate'}</a>)
```

- [ ] **Step 3: Typecheck**
Run: `cd frontend && npx tsc --noEmit -p tsconfig.json`
Expected: no errors.

- [ ] **Step 4: Commit**
```bash
git add frontend/app/(app)/requests/[id]/page.tsx
git commit -m "feat(web): inline signature setup + signed-document downloads"
```

---

## Phase 5 — Docs

### Task 14: Update PROJECT_STATE

**Files:** Modify `docs/PROJECT_STATE.md`.

- [ ] **Step 1:** Add a line under the workflow/request module noting: visible e-signatures — per-user signature setup (Settings), recorded `signature_id` on sign, and `pdf-lib` signed-PDF generation on completion (PDF attachments; Word conversion + in-app editor are separate, not yet built).

- [ ] **Step 2: Commit**
```bash
git add docs/PROJECT_STATE.md
git commit -m "docs: note request e-signature signed-PDF capability"
```

---

## Manual end-to-end verification (after all tasks)

1. Settings → draw a signature → save → reload, it persists.
2. Create a request to yourself with a **PDF** attachment.
3. Sign it (single step) → request completes.
4. On the request detail page, a "Signed documents" card appears → download the PDF → the last page shows your stamped signature, name/role/time, and the SHA-256 integrity block; original pages unchanged.
5. Repeat with **no** attachment → a standalone "Signature certificate" PDF is produced.
6. Repeat where a recipient **approves** (not signs) → they appear as "Approved — no signature".
7. Upload a **Word** attachment → it is left untouched and excluded from signed copies (expected; feature #2).

---

## Out of scope (tracked for later specs)
- Feature #2: Word/non-PDF → PDF conversion before stamping.
- Feature #3: in-app rich-text editor authoring.
- Option B: PKI/PAdES cryptographic signatures (pending GBB identity/PKI decisions).
- Drawn-on-page signature placement (choosing where on each page a signature lands).
