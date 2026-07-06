import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import { borderedTableLayout, mm } from '../../../../shared/utils/pdf.util';
import { markdownToPdfContent } from './markdown.utility';

export { WP_REVIEWABLE_STATUSES } from '../../utility/audit.utility';

export interface WorkingPaperSection {
  title: string;
  content: string;
}

export interface WorkingPaperSignOff {
  name: string;
  role: string;
  date: string;
  /** data:image/...;base64 URL of the approver's signature, when one was recorded. */
  imageDataUrl?: string;
}

export interface WorkingPaperPdfData {
  title: string;
  engagementReference: string;
  engagementTitle: string;
  workingPaperType: string;
  auditorName: string;
  status: string;
  version: string;
  date: string;
  sections: WorkingPaperSection[];
  signOff?: WorkingPaperSignOff[];
}

/**
 * Escape a value for safe interpolation into HTML.
 */
export const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Working paper `content` is stored either as a JSON string of
 * `{ sections: [{ title, content }] }` (imported papers) or as free text
 * (manually created papers). Normalise both into a list of sections.
 */
export const parseWorkingPaperSections = (content: string | null | undefined): WorkingPaperSection[] => {
  const raw = (content ?? '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.sections)) {
      return parsed.sections
        .map((section: { title?: unknown; content?: unknown }) => ({
          title: String(section?.title ?? '').trim(),
          content: String(section?.content ?? '').trim(),
        }))
        .filter((section: WorkingPaperSection) => section.title || section.content);
    }
  } catch {
    // Not JSON — fall through to treat the whole thing as a single section.
  }

  return [{ title: '', content: raw }];
};

/** Brand navy used across the working-paper PDF. */
const BRAND = '#1E3A8A';

/** Render a section's Markdown body into pdfmake blocks (plain text degrades cleanly). */
const renderSectionBody = (content: string): Content[] => markdownToPdfContent(content);

/**
 * Build a pdfmake document definition for a working paper.
 * Rendered to a PDF Buffer via `renderPdf` in the service layer.
 */
export const buildWorkingPaperDocDefinition = (data: WorkingPaperPdfData): TDocumentDefinitions => {
  const sectionsContent: Content[] =
    data.sections.length === 0
      ? [{ text: 'This working paper has no content.', italics: true, color: '#64748B', margin: [0, 8, 0, 0] }]
      : data.sections.flatMap((section, idx) => {
          const heading = section.title || `Section ${idx + 1}`;
          return [
            { text: heading, style: 'sectionTitle', margin: [0, 16, 0, 6] },
            ...renderSectionBody(section.content),
          ];
        });

  const metaRow = (label: string, value: string): TableCell[] => [
    { text: label, bold: true, color: BRAND, fillColor: '#F8F9FA' },
    { text: value },
  ];

  const content: Content[] = [
    { text: 'Galaxy Backbone Limited', style: 'orgName', alignment: 'center' },
    { text: 'Audit Working Paper', style: 'docTitle', alignment: 'center', margin: [0, 2, 0, 8] },
    {
      canvas: [{ type: 'line', x1: 0, y1: 0, x2: 493, y2: 0, lineWidth: 2, lineColor: BRAND }],
      margin: [0, 0, 0, 14],
    },
    {
      table: {
        widths: [130, '*'],
        body: [
          metaRow('Title', data.title),
          metaRow('Engagement', `${data.engagementReference} — ${data.engagementTitle}`),
          metaRow('Working Paper Type', data.workingPaperType),
          metaRow('Prepared By', data.auditorName),
          metaRow('Status', data.status),
          metaRow('Version', data.version),
          metaRow('Exported On', data.date),
        ],
      },
      layout: borderedTableLayout,
    },
    ...sectionsContent,
  ];

  if (data.signOff && data.signOff.length > 0) {
    content.push({ text: 'Approvals & Signatures', style: 'sectionTitle', margin: [0, 22, 0, 8] });
    content.push({
      columns: data.signOff.map((s) => ({
        width: '*',
        stack: [
          s.imageDataUrl
            ? { image: s.imageDataUrl, fit: [120, 40], margin: [0, 0, 0, 2] }
            : { text: ' ', margin: [0, 0, 0, 24] },
          { text: s.role ? `${s.name} — ${s.role}` : s.name, bold: true },
          { text: `Approved & signed ${s.date}`, color: '#64748B', fontSize: 9 },
        ],
      })),
      columnGap: 8,
    });
  }

  return {
    pageSize: 'A4',
    pageMargins: [mm(18), mm(20), mm(18), mm(20)],
    footer: (currentPage, pageCount) => ({
      text: `Page ${currentPage} of ${pageCount}`,
      alignment: 'center',
      fontSize: 9,
      color: '#64748B',
      margin: [0, 10, 0, 0],
    }),
    content,
    styles: {
      orgName: { fontSize: 16, bold: true, color: BRAND },
      docTitle: { fontSize: 13, bold: true },
      sectionTitle: { fontSize: 13, bold: true, color: BRAND },
    },
  };
};
