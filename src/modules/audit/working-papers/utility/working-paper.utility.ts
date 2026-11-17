import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import {
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell as DocxTableCell,
  WidthType,
  BorderStyle,
  AlignmentType,
  convertInchesToTwip,
  ShadingType,
  ImageRun,
  HeadingLevel,
} from 'docx';
import { GBB_DEFAULT_CLASSIFICATION, gbbDocumentId } from '../../../../shared/documents/gbb-document.constants';
import { buildGbbDocxDocument } from '../../../../shared/documents/gbb-document.docx';
import { buildGbbPdfDefinition } from '../../../../shared/documents/gbb-document.pdf';
import { formatGbbDate, GbbDocumentModel, parseImageDataUrl } from '../../../../shared/documents/gbb-document.model';
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
  /** Used to build the document reference number. */
  workingPaperId?: string;
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
/** The paper's sections, numbered by the document template (so any "1." typed into a title is dropped). */
const workingPaperSections = (data: WorkingPaperPdfData): WorkingPaperSection[] => {
  if (data.sections.length === 0) {
    return [{ title: 'Content', content: '_This working paper has no content._' }];
  }
  return data.sections.map((section, idx) => ({
    ...section,
    title: (section.title || `Section ${idx + 1}`).replace(/^\d+\.\s*/, ''),
  }));
};

/**
 * Maps a working paper onto the GBB document front matter. Only facts held by the
 * system are shown — the change history is this version, never invented earlier ones.
 */
export const toGbbModel = (data: WorkingPaperPdfData): GbbDocumentModel => {
  const date = formatGbbDate(data.date) || data.date;
  const versionNumber = `${data.version}.0`;
  const approvers = (data.signOff ?? []).map((s) => s.name);
  const documentId = gbbDocumentId(
    'WP',
    data.engagementReference,
    data.workingPaperId ? `WP-${data.workingPaperId.slice(0, 8).toUpperCase()}` : undefined,
  );
  return {
    title: data.title,
    documentId,
    version: versionNumber,
    versionDate: date,
    division: 'Internal Audit',
    owner: data.auditorName,
    author: data.auditorName,
    approvedBy: approvers.length > 0 ? approvers.join(', ') : 'Pending approval',
    classification: GBB_DEFAULT_CLASSIFICATION,
    status: data.status.charAt(0).toUpperCase() + data.status.slice(1).replace(/_/g, ' '),
    changeHistory: [
      {
        version: `Version ${versionNumber}`,
        date,
        createdBy: data.auditorName,
        change: Number(data.version) > 1 ? 'Revised following review' : 'Initial version',
      },
    ],
    distribution: [
      { name: data.auditorName, version: versionNumber, date },
      ...(data.signOff ?? []).map((s) => ({ name: s.name, version: versionNumber, date })),
    ],
    approvals: (data.signOff ?? []).map((s) => ({
      name: s.name,
      position: s.role,
      date: s.date,
      signature: parseImageDataUrl(s.imageDataUrl),
    })),
    lastReviewed: date,
  };
};

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
 * Build a pdfmake document definition for a working paper, in GBB's internal
 * document template. Rendered to a PDF Buffer via `renderPdf` in the service layer.
 */
export const buildWorkingPaperDocDefinition = (data: WorkingPaperPdfData): TDocumentDefinitions =>
  buildGbbPdfDefinition(
    toGbbModel(data),
    workingPaperSections(data).map((section) => ({ title: section.title, content: renderSectionBody(section) })),
  );

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
                children: [new TextRun({ text: hc, bold: true, color: '4F6228', size: 19 })],
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
              new TextRun({ text: `${match[1]} `, bold: true, color: '4F6228', size: 20 }),
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

/**
 * Build the Word version of an audit working paper in GBB's internal document template.
 * Section bodies keep their real Word tables, lists and inline images.
 */
export const buildWorkingPaperDocx = async (data: WorkingPaperPdfData): Promise<Buffer> => {
  const sections = workingPaperSections(data).map((section) => ({
    title: section.title,
    children: [...markdownToDocxBlocks(section.content), ...renderDocxImages(section.images ?? [])],
  }));
  const uint8 = await Packer.toBuffer(buildGbbDocxDocument(toGbbModel(data), sections));
  return Buffer.from(uint8);
};
