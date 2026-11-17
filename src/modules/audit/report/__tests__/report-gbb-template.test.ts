import PizZip from 'pizzip';
import { Packer } from 'docx';
import { ReportGenerationService } from '../service/implementation/report-generation.service';
import { renderPdf } from '../../../../shared/utils/pdf.util';

// `marked` is ESM-only and cannot be loaded by Jest; the markdown helper is not under test here.
jest.mock('../../working-papers/utility/markdown.utility', () => ({
  markdownToPdfContent: (text: string) => [{ text }],
}));

const person = (first: string, last: string, jobTitle: string | null = null) => ({ displayName: `${first} ${last}`, firstName: first, lastName: last, jobTitle });

const data = {
  report: {
    id: 'r1',
    title: 'IT General Controls Audit Report',
    executiveSummary: 'All good.',
    scope: 'Scope text',
    methodology: 'Method text',
    status: 'approved',
    versionNumber: 2,
    issuedAt: new Date('2026-11-17T10:00:00Z'),
    createdById: 'u1',
    templateId: null,
    signOffMode: 'cae_and_dg' as const,
  },
  engagement: {
    id: 'e1',
    referenceNumber: 'AUD-2026-003',
    title: 'ITGC',
    auditType: 'it',
    plannedStartDate: new Date('2026-09-01'),
    plannedEndDate: new Date('2026-10-01'),
    actualStartDate: new Date('2026-09-02T00:00:00Z'),
    universe: { name: 'Information Technology' },
    leadAuditor: person('Ada', 'Lead'),
    auditManager: person('Bola', 'Manager'),
    auditee: person('Chidi', 'Auditee'),
  },
  findings: [],
  assetsInScope: [{ assetTag: 'SRV-1', name: 'Core server', assetType: 'server', criticality: 'high', scopeRole: 'primary' }],
};

const config = {
  template: {
    sections: [
      { key: 'executive_summary', title: 'Executive Summary' },
      { key: 'objectives', title: 'Audit Scope' },
      { key: 'methodology', title: 'Methodology' },
    ],
    headerConfig: { classification: 'CONFIDENTIAL' },
    footerConfig: {},
    signatureConfig: {},
  },
  orgName: 'Galaxy Backbone Limited',
  orgAddress: '',
  footerNotice: '',
};

const approval = {
  steps: [
    { id: 's1', level: 1, status: 'approved', actedAt: '2026-11-10T09:00:00Z', approver: { displayName: 'Bola Manager', jobTitle: 'Audit Manager' } },
    { id: 's2', level: 2, status: 'pending', actedAt: null, approver: { displayName: 'Head Of IA', jobTitle: 'Head, Internal Audit' } },
  ],
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const service = new ReportGenerationService({} as any, {} as any, {} as any, {} as any) as any;

describe('audit report in the GBB template', () => {
  it('maps the report onto the document front matter', () => {
    const sigMap = new Map([['s1', { buffer: Buffer.from('x'), dataUrl: 'data:image/png;base64,eA==', type: 'png' as const }]]);
    const model = service._buildGbbModel(data, config, approval, sigMap);
    expect(model.documentId).toBe('GBB/IA/RPT/AUD-2026-003');
    expect(model.version).toBe('2.0');
    expect(model.versionDate).toBe('17/11/2026');
    expect(model.owner).toBe('Ada Lead');
    expect(model.approvedBy).toBe('Bola Manager');
    expect(model.status).toBe('Approved');
    expect(model.changeHistory.map((r: { version: string }) => r.version)).toEqual(['Version 1.0', 'Version 2.0']);
    expect(model.approvals).toHaveLength(2);
    expect(model.approvals[0].signature).not.toBeNull();
    expect(model.approvals[1].signatureNote).toBe('Pending Approval');
  });

  it('falls back to pending approvers before submission, honouring the sign-off mode', () => {
    const caeOnly = service._buildGbbModel({ ...data, report: { ...data.report, signOffMode: 'cae_only' } }, config, null, new Map());
    const withDg = service._buildGbbModel(data, config, null, new Map());
    expect(caeOnly.approvals).toHaveLength(2);
    expect(withDg.approvals).toHaveLength(3);
    expect(withDg.approvals.every((a: { signatureNote: string }) => a.signatureNote === 'Pending Submission')).toBe(true);
  });

  it('Word export uses Letter, numbered template sections, assets, and a real contents field', async () => {
    const doc = service._buildDocxDocument(data, config, approval, new Map());
    const xml = new PizZip(Buffer.from(await Packer.toBuffer(doc))).file('word/document.xml')!.asText();
    expect(xml).toContain('w:w="12240" w:h="15840"');
    expect(xml).toContain('TOC \\h \\o &quot;1-3&quot;');
    for (const title of ['Executive Summary', 'Audit Scope', 'Methodology', 'Assets in Scope', 'Validity and Document Management']) {
      expect(xml).toContain(title);
    }
    expect(xml).not.toContain('1. Executive Summary');
    expect(xml).toContain('GBB/IA/RPT/AUD-2026-003');
    expect(xml).toContain('Pending Approval');
  });

  it('PDF export is a Letter document with the same numbered sections', async () => {
    const def = service._buildPdfDocDefinition(data, config, approval, new Map());
    expect(def.pageSize).toBe('LETTER');
    const text = JSON.stringify(def.content);
    for (const expected of ['1. Executive Summary', '2. Audit Scope', '3. Methodology', '4. Assets in Scope', '5. Validity and Document Management']) {
      expect(text).toContain(expected);
    }
    const buf = await renderPdf(def);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
