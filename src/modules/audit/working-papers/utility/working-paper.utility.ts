import * as fs from 'fs';
import * as path from 'path';
import type { Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell as DocxTableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  Footer,
  PageNumber,
  convertInchesToTwip,
  ShadingType,
  ImageRun,
  HeadingLevel,
} from 'docx';
import { borderedTableLayout, mm } from '../../../../shared/utils/pdf.util';
import { markdownToPdfContent } from './markdown.utility';

export { WP_REVIEWABLE_STATUSES } from '../../utility/audit.utility';

export interface WorkingPaperSection {
  title: string;
  content: string;
  images?: string[];
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

let cachedGbbLogoDataUrl: string | null = null;
const getGbbLogoDataUrl = (): string | null => {
  if (cachedGbbLogoDataUrl) return cachedGbbLogoDataUrl;
  const candidates = [
    path.resolve(__dirname, '../../../../assets/gbb-logo.png'),
    path.resolve(__dirname, '../../../../../assets/gbb-logo.png'),
    path.resolve(process.cwd(), 'src/assets/gbb-logo.png'),
    path.resolve(process.cwd(), 'assets/gbb-logo.png'),
    path.resolve(process.cwd(), 'frontend/public/gbb-logo.png'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        const buf = fs.readFileSync(candidate);
        cachedGbbLogoDataUrl = `data:image/png;base64,${buf.toString('base64')}`;
        return cachedGbbLogoDataUrl;
      }
    } catch {
      // Try next path
    }
  }
  return null;
};

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

const decodeHtmlEntities = (str: string): string =>
  str
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/gi, "'");

/**
 * Converts an HTML fragment (from WordDocumentEditor) into clean Markdown text
 * plus an array of extracted base64 `data:image/...` URLs.
 */
export const htmlFragmentToMarkdownAndImages = (
  html: string,
): { markdown: string; images: string[] } => {
  const images: string[] = [];
  let working = (html ?? '').replace(/<!--[\s\S]*?-->/g, '');

  // Extract inline base64 images
  working = working.replace(/<img\b[^>]*src=["'](data:image\/[^"']+)["'][^>]*>/gi, (_m, src: string) => {
    images.push(src);
    return '\n';
  });

  // Convert HTML tables into GFM pipe tables
  working = working.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableInner: string) => {
    const rowMatches = [...tableInner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
    if (rowMatches.length === 0) return '';
    const parsedRows: string[][] = rowMatches.map((rm) => {
      const cellMatches = [...rm[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)];
      return cellMatches.map((cm) =>
        decodeHtmlEntities(cm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) || ' ',
      );
    });
    const colCount = Math.max(...parsedRows.map((r) => r.length), 1);
    const normalized = parsedRows.map((r) => {
      const padded = [...r];
      while (padded.length < colCount) padded.push(' ');
      return padded;
    });
    const headerLine = `| ${normalized[0].join(' | ')} |`;
    const dividerLine = `| ${normalized[0].map(() => '---').join(' | ')} |`;
    const bodyLines = normalized.slice(1).map((r) => `| ${r.join(' | ')} |`);
    return `\n\n${[headerLine, dividerLine, ...bodyLines].join('\n')}\n\n`;
  });

  // Headings, formatting, lists, paragraphs
  working = working
    .replace(/<h3\b[^>]*>([\s\S]*?)<\/h3>/gi, '\n### $1\n')
    .replace(/<h4\b[^>]*>([\s\S]*?)<\/h4>/gi, '\n#### $1\n')
    .replace(/<(?:strong|b)\b[^>]*>([\s\S]*?)<\/(?:strong|b)>/gi, '**$1**')
    .replace(/<(?:em|i)\b[^>]*>([\s\S]*?)<\/(?:em|i)>/gi, '*$1*')
    .replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, '\n- $1')
    .replace(/<hr\b[^>]*>/gi, '\n---\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:p|div|ul|ol|blockquote|tr)>/gi, '\n');

  const stripped = decodeHtmlEntities(working.replace(/<[^>]+>/g, ''))
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return { markdown: stripped, images };
};

const isHtmlContent = (text: string): boolean =>
  text.startsWith('<!-- page-margin:') ||
  /<(h1|h2|h3|p|table|ul|ol|div|img|blockquote|hr)\b/i.test(text);

/**
 * Working paper `content` is stored as:
 * 1. Rich HTML from `WordDocumentEditor` (with `<h2>` section headings, tables, and inline images)
 * 2. A JSON string of `{ sections: [{ title, content }] }` (legacy / imported papers)
 * 3. Free-form Markdown / plain text
 * Normalise all formats into a list of `WorkingPaperSection`s.
 */
export const parseWorkingPaperSections = (content: string | null | undefined): WorkingPaperSection[] => {
  const raw = (content ?? '').trim();
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.sections)) {
      return parsed.sections
        .map((section: { title?: unknown; content?: unknown }): WorkingPaperSection => {
          const rawTitle = String(section?.title ?? '').trim();
          const rawBody = String(section?.content ?? '').trim();
          if (isHtmlContent(rawBody)) {
            const { markdown, images } = htmlFragmentToMarkdownAndImages(rawBody);
            return { title: rawTitle, content: markdown, ...(images.length > 0 ? { images } : {}) };
          }
          return { title: rawTitle, content: rawBody };
        })
        .filter((section: WorkingPaperSection) => section.title || section.content || (section.images && section.images.length > 0));
    }
  } catch {
    // Not JSON — check for HTML or plain text below.
  }

  if (isHtmlContent(raw)) {
    const cleaned = raw.replace(/<!--\s*page-margin:\w+\s*-->/gi, '').trim();
    const headingRegex = /<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi;
    const matches = [...cleaned.matchAll(headingRegex)];

    if (matches.length > 0) {
      const sections: WorkingPaperSection[] = [];
      // Capture any preface content before the first heading
      const firstIndex = matches[0].index ?? 0;
      if (firstIndex > 0) {
        const prefaceHtml = cleaned.slice(0, firstIndex).trim();
        const { markdown, images } = htmlFragmentToMarkdownAndImages(prefaceHtml);
        if (markdown || images.length > 0) {
          sections.push({
            title: 'Overview',
            content: markdown,
            ...(images.length > 0 ? { images } : {}),
          });
        }
      }

      matches.forEach((match, idx) => {
        const rawHeading = decodeHtmlEntities(match[1].replace(/<[^>]+>/g, '').trim());
        const cleanTitle = rawHeading.replace(/^\d+\.\s*/, '').trim() || rawHeading;
        const startIdx = (match.index ?? 0) + match[0].length;
        const endIdx = idx + 1 < matches.length ? (matches[idx + 1].index ?? cleaned.length) : cleaned.length;
        const sectionHtml = cleaned.slice(startIdx, endIdx).trim();
        const { markdown, images } = htmlFragmentToMarkdownAndImages(sectionHtml);
        sections.push({
          title: cleanTitle,
          content: markdown,
          ...(images.length > 0 ? { images } : {}),
        });
      });

      return sections.filter((s) => s.title || s.content || (s.images && s.images.length > 0));
    }

    const { markdown, images } = htmlFragmentToMarkdownAndImages(cleaned);
    return [{ title: '', content: markdown, ...(images.length > 0 ? { images } : {}) }];
  }

  return [{ title: '', content: raw }];
};

/** Brand navy used across the working-paper PDF. */
const BRAND = '#1E3A8A';

/** Render a section's Markdown body + inline images into pdfmake blocks. */
const renderSectionBody = (section: WorkingPaperSection): Content[] => {
  const blocks: Content[] = [...markdownToPdfContent(section.content)];
  if (section.images && section.images.length > 0) {
    for (const dataUrl of section.images) {
      blocks.push({
        image: dataUrl,
        fit: [440, 280],
        alignment: 'center',
        margin: [0, 6, 0, 8],
      });
    }
  }
  return blocks;
};

/**
 * Build a pdfmake document definition for a working paper.
 * Rendered to a PDF Buffer via `renderPdf` in the service layer.
 */
export const buildWorkingPaperDocDefinition = (data: WorkingPaperPdfData): TDocumentDefinitions => {
  const logoDataUrl = getGbbLogoDataUrl();

  const sectionsContent: Content[] =
    data.sections.length === 0
      ? [{ text: 'This working paper has no content.', italics: true, color: '#64748B', margin: [0, 8, 0, 0] }]
      : data.sections.flatMap((section, idx) => {
          const heading = section.title || `Section ${idx + 1}`;
          return [
            { text: `${idx + 1}. ${heading.replace(/^\d+\.\s*/, '')}`, style: 'sectionTitle', margin: [0, 16, 0, 6] },
            ...renderSectionBody(section),
          ];
        });

  const metaRow = (label: string, value: string): TableCell[] => [
    { text: label, bold: true, color: BRAND, fillColor: '#F8F9FA' },
    { text: value },
  ];

  const content: Content[] = [
    ...(logoDataUrl
      ? [{ image: logoDataUrl, width: 110, alignment: 'center' as const, margin: [0, 0, 0, 6] as [number, number, number, number] }]
      : []),
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
          metaRow('Status', data.status.toUpperCase()),
          metaRow('Version', `v${data.version}.0`),
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
      text: `Galaxy Backbone Limited — Internal Audit Working Paper · Page ${currentPage} of ${pageCount}`,
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

let cachedGbbLogoBuffer: Buffer | null = null;
export const getGbbLogoBuffer = (): Buffer | null => {
  if (cachedGbbLogoBuffer) return cachedGbbLogoBuffer;
  const candidates = [
    path.resolve(__dirname, '../../../../assets/gbb-logo.png'),
    path.resolve(__dirname, '../../../../../assets/gbb-logo.png'),
    path.resolve(process.cwd(), 'src/assets/gbb-logo.png'),
    path.resolve(process.cwd(), 'assets/gbb-logo.png'),
    path.resolve(process.cwd(), 'frontend/public/gbb-logo.png'),
  ];
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) {
        cachedGbbLogoBuffer = fs.readFileSync(candidate);
        return cachedGbbLogoBuffer;
      }
    } catch {
      // Continue
    }
  }
  return null;
};

const parseInlineDocxRuns = (
  text: string,
  baseOpts: { bold?: boolean; italics?: boolean; color?: string; size?: number } = {},
): TextRun[] => {
  if (!text) return [];
  const tokens: TextRun[] = [];
  const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|[^*`]+)/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    const chunk = match[0];
    if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length >= 4) {
      tokens.push(
        new TextRun({
          text: chunk.slice(2, -2),
          bold: true,
          italics: baseOpts.italics,
          color: baseOpts.color ?? '1E293B',
          size: baseOpts.size ?? 20,
        }),
      );
    } else if (chunk.startsWith('*') && chunk.endsWith('*') && chunk.length >= 2) {
      tokens.push(
        new TextRun({
          text: chunk.slice(1, -1),
          bold: baseOpts.bold,
          italics: true,
          color: baseOpts.color ?? '1E293B',
          size: baseOpts.size ?? 20,
        }),
      );
    } else if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length >= 2) {
      tokens.push(
        new TextRun({
          text: chunk.slice(1, -1),
          font: 'Courier New',
          color: '0F172A',
          size: baseOpts.size ?? 18,
        }),
      );
    } else {
      tokens.push(
        new TextRun({
          text: chunk,
          bold: baseOpts.bold,
          italics: baseOpts.italics,
          color: baseOpts.color ?? '1E293B',
          size: baseOpts.size ?? 20,
        }),
      );
    }
  }
  return tokens.length > 0
    ? tokens
    : [new TextRun({ text, size: baseOpts.size ?? 20, color: baseOpts.color ?? '1E293B' })];
};

const parseMarkdownPipeTable = (lines: string[]): Table | null => {
  if (lines.length < 2) return null;
  const parseRow = (line: string): string[] =>
    line
      .trim()
      .replace(/^\|/, '')
      .replace(/\|$/, '')
      .split('|')
      .map((c) => c.trim());

  const headerCells = parseRow(lines[0]);
  if (headerCells.length === 0) return null;

  let dataLines = lines.slice(1);
  if (lines.length >= 2 && /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(lines[1].trim())) {
    dataLines = lines.slice(2);
  }

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const cellMargins = { top: 120, bottom: 120, left: 140, right: 140 };

  const tableRows: TableRow[] = [
    new TableRow({
      tableHeader: true,
      children: headerCells.map(
        (hc) =>
          new DocxTableCell({
            borders: cellBorders,
            margins: cellMargins,
            shading: { fill: 'F1F5F9', type: ShadingType.CLEAR },
            children: [
              new Paragraph({
                children: [new TextRun({ text: hc, bold: true, color: '1E3A8A', size: 19 })],
              }),
            ],
          }),
      ),
    }),
  ];

  for (const line of dataLines) {
    if (!line.trim()) continue;
    const cells = parseRow(line);
    while (cells.length < headerCells.length) cells.push('');
    tableRows.push(
      new TableRow({
        children: cells.slice(0, headerCells.length).map(
          (c) =>
            new DocxTableCell({
              borders: cellBorders,
              margins: cellMargins,
              children: [
                new Paragraph({
                  children: parseInlineDocxRuns(c, { size: 19 }),
                }),
              ],
            }),
        ),
      }),
    );
  }

  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: tableRows,
    borders: cellBorders,
  });
};

const markdownToDocxBlocks = (markdown: string): (Paragraph | Table)[] => {
  const blocks: (Paragraph | Table)[] = [];
  const lines = (markdown || '').split(/\r?\n/);
  let tableBuffer: string[] = [];

  const flushTable = () => {
    if (tableBuffer.length > 0) {
      const table = parseMarkdownPipeTable(tableBuffer);
      if (table) blocks.push(table);
      tableBuffer = [];
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
      tableBuffer.push(trimmed);
      continue;
    } else {
      flushTable();
    }

    if (!trimmed) continue;

    if (trimmed === '---' || trimmed === '***' || trimmed === '___' || trimmed.includes('PAGE_BREAK')) {
      blocks.push(new Paragraph({ pageBreakBefore: true, children: [] }));
      continue;
    }

    if (trimmed.startsWith('#### ')) {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_4,
          spacing: { before: 180, after: 60 },
          children: [new TextRun({ text: trimmed.slice(5), bold: true, color: '000000', size: 21 })],
        }),
      );
    } else if (trimmed.startsWith('### ')) {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_3,
          spacing: { before: 200, after: 80 },
          children: [new TextRun({ text: trimmed.slice(4), bold: true, color: '000000', size: 22 })],
        }),
      );
    } else if (trimmed.startsWith('## ')) {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 100 },
          children: [new TextRun({ text: trimmed.slice(3), bold: true, color: '000000', size: 24 })],
        }),
      );
    } else if (trimmed.startsWith('# ')) {
      blocks.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_1,
          spacing: { before: 280, after: 120 },
          children: [new TextRun({ text: trimmed.slice(2), bold: true, color: '000000', size: 26 })],
        }),
      );
    } else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      blocks.push(
        new Paragraph({
          bullet: { level: 0 },
          spacing: { after: 60 },
          children: parseInlineDocxRuns(trimmed.slice(2)),
        }),
      );
    } else if (/^\d+\.\s+/.test(trimmed)) {
      const match = trimmed.match(/^(\d+\.)\s+(.*)$/);
      if (match) {
        blocks.push(
          new Paragraph({
            spacing: { after: 60 },
            children: [
              new TextRun({ text: `${match[1]} `, bold: true, color: '1E3A8A', size: 20 }),
              ...parseInlineDocxRuns(match[2]),
            ],
          }),
        );
      }
    } else if (trimmed.startsWith('>')) {
      blocks.push(
        new Paragraph({
          indent: { left: convertInchesToTwip(0.3) },
          spacing: { before: 100, after: 100 },
          children: parseInlineDocxRuns(trimmed.replace(/^>\s*/, ''), { italics: true, color: '475569' }),
        }),
      );
    } else {
      blocks.push(
        new Paragraph({
          spacing: { after: 120, line: 276 },
          children: parseInlineDocxRuns(trimmed),
        }),
      );
    }
  }

  flushTable();
  return blocks;
};

const renderDocxImages = (images: string[]): Paragraph[] => {
  const result: Paragraph[] = [];
  for (const imgUrl of images) {
    try {
      const match = imgUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
      if (match) {
        const imgType: 'png' | 'jpg' = match[1] === 'jpeg' ? 'jpg' : (match[1] as 'png' | 'jpg');
        const imgBuffer = Buffer.from(match[2], 'base64');
        result.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 120, after: 120 },
            children: [
              new ImageRun({
                type: imgType,
                data: imgBuffer,
                transformation: {
                  width: 480,
                  height: 280,
                },
              }),
            ],
          }),
        );
      }
    } catch {
      // Ignore image render error
    }
  }
  return result;
};

const buildDocxSignOffTable = (signOff: WorkingPaperSignOff[]): (Paragraph | Table)[] => {
  const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const cellMargins = { top: 120, bottom: 120, left: 140, right: 140 };

  const cols = signOff.map((s) => {
    const children: Paragraph[] = [];
    if (s.imageDataUrl) {
      try {
        const match = s.imageDataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
        if (match) {
          const sigType: 'png' | 'jpg' = match[1] === 'jpeg' ? 'jpg' : (match[1] as 'png' | 'jpg');
          const sigBuf = Buffer.from(match[2], 'base64');
          children.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [
                new ImageRun({
                  type: sigType,
                  data: sigBuf,
                  transformation: { width: 140, height: 45 },
                }),
              ],
            }),
          );
        }
      } catch {
        // Fallback below
      }
    }
    if (children.length === 0) {
      children.push(
        new Paragraph({
          children: [new TextRun({ text: 'Digitally Approved & Signed', italics: true, color: '1E3A8A', size: 18 })],
        }),
      );
    }
    children.push(
      new Paragraph({
        spacing: { before: 60 },
        children: [
          new TextRun({ text: s.role ? `${s.name} — ${s.role}` : s.name, bold: true, color: '0F172A', size: 19 }),
        ],
      }),
      new Paragraph({
        children: [new TextRun({ text: `Approved & signed ${s.date}`, color: '64748B', size: 17 })],
      }),
    );

    return new DocxTableCell({
      borders: cellBorders,
      margins: cellMargins,
      width: { size: Math.floor(100 / Math.max(1, signOff.length)), type: WidthType.PERCENTAGE },
      children,
    });
  });

  return [
    new Paragraph({
      heading: HeadingLevel.HEADING_2,
      spacing: { before: 320, after: 120 },
      children: [new TextRun({ text: 'Approvals & Signatures', bold: true, color: '1E3A8A', size: 24 })],
    }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      rows: [new TableRow({ children: cols })],
    }),
  ];
};

/**
 * Build a rich DOCX document for an audit working paper using the `docx` library.
 * Embeds official GBB logo, styled metadata table, real Word tables from Markdown,
 * inline images, and digital approver signatures.
 */
export const buildWorkingPaperDocx = async (data: WorkingPaperPdfData): Promise<Buffer> => {
  const logoBuf = getGbbLogoBuffer();
  const children: (Paragraph | Table)[] = [];

  if (logoBuf) {
    children.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { after: 120 },
        children: [
          new ImageRun({
            type: 'png',
            data: logoBuf,
            transformation: { width: 120, height: 40 },
          }),
        ],
      }),
    );
  }

  children.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [
        new TextRun({
          text: 'Galaxy Backbone Limited',
          bold: true,
          color: '1E3A8A',
          size: 32,
        }),
      ],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 140 },
      children: [
        new TextRun({
          text: 'Audit Working Paper',
          bold: true,
          color: '0F172A',
          size: 26,
        }),
      ],
    }),
  );

  const border = { style: BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
  const cellBorders = { top: border, bottom: border, left: border, right: border };
  const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };

  const metaDocxRow = (label: string, value: string): TableRow =>
    new TableRow({
      children: [
        new DocxTableCell({
          width: { size: 28, type: WidthType.PERCENTAGE },
          shading: { fill: 'F8F9FA', type: ShadingType.CLEAR },
          borders: cellBorders,
          margins: cellMargins,
          children: [
            new Paragraph({
              children: [new TextRun({ text: label, bold: true, color: '1E3A8A', size: 19 })],
            }),
          ],
        }),
        new DocxTableCell({
          width: { size: 72, type: WidthType.PERCENTAGE },
          borders: cellBorders,
          margins: cellMargins,
          children: [
            new Paragraph({
              children: [new TextRun({ text: value || '—', size: 19, color: '1E293B' })],
            }),
          ],
        }),
      ],
    });

  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: cellBorders,
      rows: [
        metaDocxRow('Title', data.title),
        metaDocxRow('Engagement', `${data.engagementReference} — ${data.engagementTitle}`),
        metaDocxRow('Working Paper Type', data.workingPaperType),
        metaDocxRow('Prepared By', data.auditorName),
        metaDocxRow('Status', data.status.toUpperCase()),
        metaDocxRow('Version', `v${data.version}.0`),
        metaDocxRow('Exported On', data.date),
      ],
    }),
  );

  if (data.sections.length === 0) {
    children.push(
      new Paragraph({
        spacing: { before: 200 },
        children: [new TextRun({ text: 'This working paper has no content.', italics: true, color: '64748B', size: 20 })],
      }),
    );
  } else {
    data.sections.forEach((section, idx) => {
      const heading = section.title || `Section ${idx + 1}`;
      children.push(
        new Paragraph({
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 280, after: 120 },
          children: [
            new TextRun({
              text: `${idx + 1}. ${heading.replace(/^\d+\.\s*/, '')}`,
              bold: true,
              color: '000000',
              size: 24,
            }),
          ],
        }),
      );
      children.push(...markdownToDocxBlocks(section.content));
      if (section.images && section.images.length > 0) {
        children.push(...renderDocxImages(section.images));
      }
    });
  }

  if (data.signOff && data.signOff.length > 0) {
    children.push(...buildDocxSignOffTable(data.signOff));
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: convertInchesToTwip(0.8),
              bottom: convertInchesToTwip(0.8),
              left: convertInchesToTwip(0.8),
              right: convertInchesToTwip(0.8),
            },
          },
        },
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({
                    text: 'Galaxy Backbone Limited — Internal Audit Working Paper · Page ',
                    size: 16,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.CURRENT],
                    size: 16,
                    color: '64748B',
                  }),
                  new TextRun({
                    text: ' of ',
                    size: 16,
                    color: '64748B',
                  }),
                  new TextRun({
                    children: [PageNumber.TOTAL_PAGES],
                    size: 16,
                    color: '64748B',
                  }),
                ],
              }),
            ],
          }),
        },
        children,
      },
    ],
  });

  const uint8 = await Packer.toBuffer(doc);
  return Buffer.from(uint8);
};
