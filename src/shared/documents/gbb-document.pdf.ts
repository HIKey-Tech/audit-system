// PDF (pdfmake) renderer for a GBB controlled document: the same cover, front matter,
// header/footer, numbered headings and contents list as the Word version.
//
// Fonts: pdfmake here only has the built-in Helvetica family (no font files are shipped), so
// the PDF uses Helvetica where Word uses Corbel/Calibri. Layout, wording and colours match.
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  GBB_APPROVAL_HEADERS,
  GBB_CHANGE_CONTROL_NOTE,
  GBB_CHANGE_HISTORY_HEADERS,
  GBB_COLOR,
  GBB_CONFIDENTIALITY_NOTICE,
  GBB_DISTRIBUTION_HEADERS,
  GBB_DOC_INFO_LABELS,
  GBB_LOGO,
  GBB_ORG_NAME,
  GBB_PAGE,
  GBB_TABLE_GRID,
  GBB_VALIDITY_HEADING,
  gbbValidityText,
  loadGbbLogo,
} from './gbb-document.constants';
import { GbbDocumentModel, GbbSignature, versionLabel } from './gbb-document.model';

/** One numbered section of the body; `content` is the caller's pdfmake content for it. */
export interface GbbPdfSection {
  title: string;
  level?: 1 | 2 | 3;
  content: Content[];
}

const pt = (twips: number): number => twips / 20;
const GREY = '#808080';
const BLACK = '#000000';
const HEADING_SIZE = { 1: 14, 2: 12, 3: 11 } as const;

const gridLayout = (color: string, paddingV = 3) => ({
  hLineWidth: () => 0.5,
  vLineWidth: () => 0.5,
  hLineColor: () => color,
  vLineColor: () => color,
  paddingLeft: () => 5,
  paddingRight: () => 5,
  paddingTop: () => paddingV,
  paddingBottom: () => paddingV,
});

const dataUrl = (s: GbbSignature): string => `data:${s.mime};base64,${s.buffer.toString('base64')}`;

const frontHeading = (value: string, size = 12, pageBreak = false): Content => ({
  text: value,
  bold: true,
  fontSize: size,
  margin: [0, 12, 0, 6],
  ...(pageBreak ? { pageBreak: 'before' as const } : {}),
});

const table = (
  widths: readonly number[],
  header: readonly string[] | null,
  rows: TableCell[][],
  color: string,
  indent = 0,
  minRowHeight = 0,
): Content => ({
  margin: [indent, 0, 0, 0],
  layout: gridLayout(color),
  table: {
    widths: widths.map(pt),
    headerRows: header ? 1 : 0,
    dontBreakRows: true,
    heights: minRowHeight ? (row: number) => (header && row === 0 ? 0 : minRowHeight) : undefined,
    body: [...(header ? [header.map((h) => ({ text: h, bold: true }) as TableCell)] : []), ...rows],
  },
});

const coverPage = (model: GbbDocumentModel): Content[] => {
  const org = model.orgName ?? GBB_ORG_NAME;
  const logoWidth = GBB_LOGO.inchesWidth * 72;
  const logoHeight = (logoWidth * GBB_LOGO.pxHeight) / GBB_LOGO.pxWidth;
  const rule = { hLineWidth: (i: number) => (i === 0 || i === 1 ? 4.5 : 0), vLineWidth: () => 0, hLineColor: () => `#${GBB_COLOR.rule}` };
  return [
    { image: `data:image/png;base64,${loadGbbLogo().toString('base64')}`, width: logoWidth, height: logoHeight, alignment: 'center', margin: [0, 40, 0, 6] },
    { text: org, bold: true, fontSize: 20, alignment: 'center', margin: [0, 6, 0, 36] },
    {
      margin: [pt(1818) - 36, 0, 0, 0],
      layout: { ...rule, paddingTop: () => 40, paddingBottom: () => 40, paddingLeft: () => 0, paddingRight: () => 0 },
      table: { widths: [pt(GBB_TABLE_GRID.coverTitle[0])], body: [[{ text: model.title, bold: true, fontSize: 20, alignment: 'center' }]] },
    },
    { text: versionLabel(model.version), bold: true, fontSize: 12, alignment: 'center', margin: [0, 18, 0, 30] },
    { text: 'DOCUMENT REFERENCE NUMBER:', italics: true, decoration: 'underline', fontSize: 12, alignment: 'center' },
    { text: model.documentId, italics: true, fontSize: 12, alignment: 'center', margin: [0, 0, 0, 18] },
    { text: 'Confidentiality', bold: true, fontSize: 12, alignment: 'center', margin: [0, 12, 0, 0] },
    { text: model.confidentialityNotice ?? GBB_CONFIDENTIALITY_NOTICE, fontSize: 12, alignment: 'center' },
  ];
};

const frontMatter = (model: GbbDocumentModel): Content[] => {
  const values = [
    model.documentId,
    versionLabel(model.version),
    model.versionDate,
    model.division,
    model.owner,
    model.author,
    model.approvedBy,
    model.classification,
    model.status,
  ];
  const rowsOr = (rows: TableCell[][], width: number): TableCell[][] => (rows.length ? rows : [Array.from({ length: width }, (_, i) => (i === 0 ? '—' : ''))]);
  return [
    frontHeading('Document Information', 12, true),
    table(
      GBB_TABLE_GRID.docInfo,
      null,
      GBB_DOC_INFO_LABELS.map((label, i) => [label, values[i] || '—']),
      GREY,
      pt(80),
      18.6,
    ),
    frontHeading('Change history'),
    table(
      GBB_TABLE_GRID.changeHistory,
      GBB_CHANGE_HISTORY_HEADERS,
      rowsOr(model.changeHistory.map((r) => [r.version, r.date, r.createdBy, r.change]), 4),
      BLACK,
    ),
    frontHeading('Distribution List'),
    table(
      GBB_TABLE_GRID.distribution,
      GBB_DISTRIBUTION_HEADERS,
      rowsOr(model.distribution.map((r) => [r.name, r.version, r.date]), 3),
      BLACK,
    ),
    frontHeading('Approval List'),
    table(
      GBB_TABLE_GRID.approval,
      GBB_APPROVAL_HEADERS,
      rowsOr(
        model.approvals.map((r) => [
          r.name,
          r.position,
          r.signature ? ({ image: dataUrl(r.signature), width: 90, height: 34 } as TableCell) : (r.signatureNote ?? ''),
          r.date,
        ]),
        4,
      ),
      BLACK,
      0,
      36,
    ),
    frontHeading('Change Control', 14),
    { text: GBB_CHANGE_CONTROL_NOTE, fontSize: 11, margin: [0, 0, 0, 8] },
    // Real contents list: pdfmake fills in the page numbers of every heading marked tocItem.
    { toc: { title: { text: 'Table of contents', bold: true, fontSize: 14, margin: [0, 12, 0, 6] }, numberStyle: { bold: false } } },
  ];
};

const numberedHeading = (text: string, level: 1 | 2 | 3, pageBreak: boolean): Content => ({
  text,
  tocItem: true,
  tocStyle: { fontSize: 11 },
  tocMargin: [level === 1 ? 0 : level === 2 ? 14 : 28, 0, 0, 0],
  bold: true,
  italics: level === 3,
  fontSize: HEADING_SIZE[level],
  margin: [0, level === 1 ? 14 : 10, 0, 5],
  ...(pageBreak ? { pageBreak: 'before' as const } : {}),
});

/** Builds the complete pdfmake document definition (render it with `renderPdf`). */
export const buildGbbPdfDefinition = (model: GbbDocumentModel, sections: GbbPdfSection[]): TDocumentDefinitions => {
  const counters = [0, 0, 0];
  const body: Content[] = [];
  const addHeading = (title: string, level: 1 | 2 | 3, first: boolean): void => {
    counters[level - 1] += 1;
    for (let i = level; i < 3; i++) counters[i] = 0;
    const label = `${counters.slice(0, level).join('.')}.`;
    body.push(numberedHeading(`${label} ${title}`, level, first));
  };
  sections.forEach((section, index) => {
    addHeading(section.title, section.level ?? 1, index === 0);
    body.push(...section.content);
  });
  addHeading(GBB_VALIDITY_HEADING, 1, false);
  body.push({ text: gbbValidityText(model.lastReviewed), fontSize: 11 });

  const org = model.orgName ?? GBB_ORG_NAME;
  const textWidth = pt(GBB_PAGE.width - GBB_PAGE.marginLeft - GBB_PAGE.marginRight);

  return {
    pageSize: 'LETTER',
    pageMargins: [pt(GBB_PAGE.marginLeft), 62, pt(GBB_PAGE.marginRight), 72],
    info: { title: model.title, author: org, subject: model.documentId },
    defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.2 },
    // The thin page border (every page, including the cover).
    background: () => ({
      canvas: [{ type: 'rect', x: 24, y: 24, w: pt(GBB_PAGE.width) - 48, h: pt(GBB_PAGE.height) - 48, lineWidth: 0.5, lineColor: BLACK }],
    }),
    // No header or footer on the cover, as in the template.
    header: (page: number): Content =>
      page === 1
        ? ''
        : {
            margin: [pt(GBB_PAGE.marginLeft), 30, pt(GBB_PAGE.marginRight), 0],
            columns: [
              { text: org, fontSize: 10, alignment: 'left' },
              { text: model.classification, fontSize: 10, alignment: 'right' },
            ],
          },
    footer: (page: number, pages: number): Content =>
      page === 1
        ? ''
        : {
            margin: [pt(GBB_PAGE.marginLeft), 0, pt(GBB_PAGE.marginRight), 0],
            stack: [
              { canvas: [{ type: 'line', x1: 0, y1: 0, x2: textWidth, y2: 0, lineWidth: 0.5, lineColor: BLACK }] },
              {
                margin: [0, 3, 0, 0],
                columns: [
                  { text: model.title, fontSize: 10, width: '*' },
                  { text: versionLabel(model.version), fontSize: 10, alignment: 'center', width: 110 },
                  { text: `Page ${page} of ${pages}`, fontSize: 10, alignment: 'right', width: 110 },
                ],
              },
            ],
          },
    content: [...coverPage(model), ...frontMatter(model), ...body],
  };
};
