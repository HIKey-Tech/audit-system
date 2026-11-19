import PizZip from 'pizzip';
import { Packer, Paragraph, TextRun } from 'docx';
import { buildGbbDocxDocument } from '../gbb-document.docx';
import { buildGbbPdfDefinition } from '../gbb-document.pdf';
import { GBB_CONFIDENTIALITY_NOTICE, GBB_TABLE_GRID, gbbDocumentId, loadGbbLogo } from '../gbb-document.constants';
import { formatGbbDate, GbbDocumentModel, parseImageDataUrl } from '../gbb-document.model';
import { renderPdf } from '../../utils/pdf.util';
import { buildWorkingPaperDocx, buildWorkingPaperDocDefinition, WorkingPaperPdfData } from '../../../modules/audit/working-papers/utility/working-paper.utility';

// `marked` is ESM-only and cannot be loaded by Jest; the PDF markdown helper is not under test here.
jest.mock('../../../modules/audit/working-papers/utility/markdown.utility', () => ({
  markdownToPdfContent: (text: string) => [{ text }],
}));

const model: GbbDocumentModel = {
  title: 'Access Review Working Paper',
  documentId: 'GBB/IA/WP/AUD-2026-003/WP-3F2A9C1B',
  version: '1.0',
  versionDate: '17/11/2026',
  division: 'Internal Audit',
  owner: 'A. Auditor',
  author: 'A. Auditor',
  approvedBy: 'Head, Internal Audit',
  classification: 'Internal Use Only',
  status: 'Draft',
  changeHistory: [{ version: 'Version 1.0', date: '17/11/2026', createdBy: 'A. Auditor', change: 'Initial version' }],
  distribution: [{ name: 'A. Auditor', version: '1.0', date: '17/11/2026' }],
  approvals: [{ name: 'Head', position: 'Head, Internal Audit', date: '17/11/2026' }],
  lastReviewed: '17/11/2026',
};

const unzip = async (buf: Buffer): Promise<{ doc: string; settings: string; files: string[] }> => {
  const zip = new PizZip(buf);
  return {
    doc: zip.file('word/document.xml')!.asText(),
    settings: zip.file('word/settings.xml')!.asText(),
    files: Object.keys(zip.files),
  };
};

describe('GBB document kit — Word', () => {
  let doc: string;
  let settings: string;

  beforeAll(async () => {
    const built = await Packer.toBuffer(
      buildGbbDocxDocument(model, [
        { title: 'Objective', children: [new Paragraph({ children: [new TextRun('Body text')] })] },
        { title: 'Scope', level: 2, children: [new Paragraph('Sub')] },
      ]),
    );
    ({ doc, settings } = await unzip(Buffer.from(built)));
  });

  it('uses the template page: US Letter, different first page, page border', () => {
    expect(doc).toContain('w:w="12240" w:h="15840"');
    expect(doc).toContain('<w:titlePg/>');
    expect(doc).toContain('w:pgBorders');
    expect(doc).toContain('w:top="432"');
  });

  it('has the template front matter in order with its exact column grids', () => {
    const order = ['Document Information', 'Change history', 'Distribution List', 'Approval List', 'Change Control', 'Table of contents'];
    const positions = order.map((label) => doc.indexOf(label));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    for (const grid of [GBB_TABLE_GRID.docInfo, GBB_TABLE_GRID.changeHistory, GBB_TABLE_GRID.distribution, [3600, 3400, 2360]]) {
      grid.forEach((w) => expect(doc).toContain(`w:w="${w}"`));
    }
    expect(doc).toContain(GBB_CONFIDENTIALITY_NOTICE);
    expect(doc).toContain('DOCUMENT REFERENCE NUMBER:');
    expect(doc).toContain(model.documentId);
  });

  it('frames the cover title with the two dark-green rules', () => {
    expect((doc.match(/w:color="4F6228"/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('has a real, auto-updating table of contents and numbered headings', () => {
    expect(doc).toContain('TOC \\h \\o &quot;1-3&quot;');
    expect(settings).toContain('<w:updateFields/>');
    expect(doc).toContain('Heading1');
    expect(doc).toContain('Heading2');
    expect(doc).toContain('Validity and Document Management');
    expect(doc).toContain('This document was last reviewed on 17/11/2026');
  });

  it('puts the header text and Page X of Y fields in header/footer parts', async () => {
    const built = await Packer.toBuffer(buildGbbDocxDocument(model, []));
    const zip = new PizZip(Buffer.from(built));
    const parts = Object.keys(zip.files).filter((f) => /word\/(header|footer)\d*\.xml$/.test(f)).map((f) => zip.file(f)!.asText());
    const joined = parts.join('');
    expect(joined).toContain('Galaxy Backbone Limited');
    expect(joined).toContain('Internal Use Only');
    expect(joined).toContain('Version 1.0');
    expect(joined).toContain('PAGE');
    expect(joined).toContain('NUMPAGES');
  });

  it('keeps the logo at its own 360:252 proportions', () => {
    const m = /<wp:extent cx="(\d+)" cy="(\d+)"/.exec(doc);
    expect(m).not.toBeNull();
    expect(Number(m![1]) / Number(m![2])).toBeCloseTo(360 / 252, 1);
  });
});

describe('GBB document kit — PDF', () => {
  it('renders a Letter PDF with cover, front matter, contents and page numbers', async () => {
    const def = buildGbbPdfDefinition(model, [
      { title: 'Objective', content: [{ text: 'Body text' }] },
      { title: 'Scope', level: 2, content: [{ text: 'Sub' }] },
    ]);
    expect(def.pageSize).toBe('LETTER');
    const buf = await renderPdf(def);
    expect(buf.subarray(0, 5).toString()).toBe('%PDF-');
    expect((buf.toString('latin1').match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThanOrEqual(3);

    const text = JSON.stringify(def.content);
    for (const expected of ['Document Information', 'Change history', 'Distribution List', 'Approval List', 'Table of contents', '1. Objective', '1.1. Scope', 'Validity and Document Management']) {
      expect(text).toContain(expected);
    }
    expect(text).toContain('"toc"');

    const footer = (def.footer as (page: number, pages: number) => unknown)(2, 5);
    expect(JSON.stringify(footer)).toContain('Page 2 of 5');
    expect((def.footer as (page: number, pages: number) => unknown)(1, 5)).toBe('');
  });
});

describe('GBB document helpers', () => {
  it('embeds the logo byte-for-byte and builds references in the GBB form', () => {
    expect(loadGbbLogo().subarray(0, 8).toString('hex')).toBe('89504e470d0a1a0a');
    expect(gbbDocumentId('RPT', 'AUD-2026-003')).toBe('GBB/IA/RPT/AUD-2026-003');
    expect(gbbDocumentId('WP', 'AUD-2026-003', 'WP-AB12CD34')).toBe('GBB/IA/WP/AUD-2026-003/WP-AB12CD34');
  });

  it('formats dates dd/mm/yyyy in UTC and rejects bad input', () => {
    expect(formatGbbDate('2026-11-17')).toBe('17/11/2026');
    expect(formatGbbDate(new Date('2026-01-05T23:30:00Z'))).toBe('05/01/2026');
    expect(formatGbbDate('nonsense')).toBe('');
    expect(formatGbbDate(null)).toBe('');
  });

  it('parses signature data URLs and ignores anything else', () => {
    const png = 'data:image/png;base64,' + Buffer.from('abc').toString('base64');
    expect(parseImageDataUrl(png)?.mime).toBe('image/png');
    expect(parseImageDataUrl('not-a-data-url')).toBeNull();
    expect(parseImageDataUrl(undefined)).toBeNull();
  });
});

describe('working paper in the GBB template', () => {
  const paper: WorkingPaperPdfData = {
    title: 'User access review',
    engagementReference: 'AUD-2026-003',
    engagementTitle: 'IT General Controls',
    workingPaperType: 'Test of controls',
    auditorName: 'A. Auditor',
    status: 'approved',
    version: '2',
    date: '2026-11-17',
    workingPaperId: '3f2a9c1b-0000-0000-0000-000000000000',
    sections: [
      { title: '1. Objective', content: 'Confirm leavers lose access.\n\n| Control | Result |\n|---|---|\n| Removal | Pass |' },
      { title: 'Conclusion', content: 'Effective.' },
    ],
    signOff: [{ name: 'Head of IA', role: 'Head, Internal Audit', date: '17/11/2026' }],
  };

  it('Word export has template front matter, numbered sections and the approver', async () => {
    const { doc } = await unzip(await buildWorkingPaperDocx(paper));
    expect(doc).toContain('GBB/IA/WP/AUD-2026-003/WP-3F2A9C1B');
    expect(doc).toContain('Version 2.0');
    expect(doc).toContain('Revised following review');
    expect(doc).toContain('Head of IA');
    expect(doc).toContain('Objective');
    expect(doc).not.toContain('1. Objective');
  });

  it('PDF definition numbers sections itself and drops typed numbers', () => {
    const def = buildWorkingPaperDocDefinition(paper);
    const text = JSON.stringify(def.content);
    expect(text).toContain('1. Objective');
    expect(text).toContain('2. Conclusion');
    expect(text).not.toContain('1. 1. Objective');
  });

  it('an empty paper still produces a valid document', async () => {
    const empty = { ...paper, sections: [], signOff: [], status: 'draft', version: '1' };
    const { doc } = await unzip(await buildWorkingPaperDocx(empty));
    expect(doc).toContain('This working paper has no content.');
    expect(doc).toContain('Pending approval');
  });
});

describe('signatures sit at the bottom of the document, not in a table', () => {
  const signed = {
    ...model,
    approvals: [
      { role: 'Prepared by', name: 'Ada Lead', position: 'Lead Auditor', date: '17/11/2026' },
      { role: 'Approved by', name: 'Kolawole Head', position: 'Head of Internal Audit', date: '18/11/2026', signature: { buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGP4z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64'), mime: 'image/png' } },
    ],
  };

  it('the approval list has Name, Position and Date only: no signature column', async () => {
    const { doc } = await unzip(Buffer.from(await Packer.toBuffer(buildGbbDocxDocument(signed, []))));
    const table = doc.slice(doc.indexOf('Approval List'), doc.indexOf('Change Control'));
    expect(table).not.toContain('Signature');
    expect(table).not.toContain('<w:drawing>');
  });

  it('a sign-off block at the very end names what each person did, with their signature and name beneath', async () => {
    const { doc } = await unzip(Buffer.from(await Packer.toBuffer(buildGbbDocxDocument(signed, []))));
    const validity = doc.indexOf('Validity and Document Management');
    const signOff = doc.indexOf('Sign-off');
    expect(signOff).toBeGreaterThan(validity);
    const tail = doc.slice(signOff);
    expect(tail).toContain('Prepared by:');
    expect(tail).toContain('Approved by:');
    expect(tail).toContain('Kolawole Head');
    expect(tail).toContain('<w:drawing>'); // the signature image
    expect(tail).not.toContain('<w:tbl>'); // not in a table
  });

  it('the PDF has the same sign-off block at the end', () => {
    const text = JSON.stringify(buildGbbPdfDefinition(signed, []).content);
    expect(text.indexOf('Sign-off')).toBeGreaterThan(text.indexOf('Validity and Document Management'));
    expect(text).toContain('Prepared by:');
    expect(text).toContain('Kolawole Head');
  });
});

