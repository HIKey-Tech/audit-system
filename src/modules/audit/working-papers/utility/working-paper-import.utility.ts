import mammoth from 'mammoth';
import * as XLSX from 'xlsx';
import { PDFParse } from 'pdf-parse';
import { WorkingPaperTemplateSection } from '../../../settings/domain/entity/settings.entity';

export interface ExtractedWorkingPaperFile {
  text: string;
  warnings: string[];
}

export interface MappedWorkingPaperSection {
  title: string;
  description: string;
  required: boolean;
  content: string;
  confidence: number;
}

const MAX_EXTRACTED_TEXT_LENGTH = 20_000;

export const extractWorkingPaperText = async (
  buffer: Buffer,
  mimeType: string,
  originalName: string,
): Promise<ExtractedWorkingPaperFile> => {
  const name = originalName.toLowerCase();
  const warnings: string[] = [];

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    || name.endsWith('.docx')
  ) {
    const result = await mammoth.extractRawText({ buffer });
    return {
      text: normalizeExtractedText(result.value),
      warnings: result.messages.map((message) => message.message),
    };
  }

  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    || mimeType === 'application/vnd.ms-excel'
    || name.endsWith('.xlsx')
    || name.endsWith('.xls')
  ) {
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const sheetTexts = workbook.SheetNames.map((sheetName) => {
      const sheet = workbook.Sheets[sheetName];
      const csv = XLSX.utils.sheet_to_csv(sheet);
      return `Sheet: ${sheetName}\n${csv}`;
    });
    return { text: normalizeExtractedText(sheetTexts.join('\n\n')), warnings };
  }

  if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
    const parser = new PDFParse({ data: buffer });
    try {
      const result = await parser.getText();
      if (!result.text.trim()) {
        warnings.push('No selectable text was found in the PDF. Scanned PDFs may require OCR.');
      }
      return { text: normalizeExtractedText(result.text), warnings };
    } finally {
      await parser.destroy();
    }
  }

  if (
    mimeType.startsWith('text/')
    || name.endsWith('.txt')
    || name.endsWith('.csv')
    || name.endsWith('.md')
  ) {
    return { text: normalizeExtractedText(buffer.toString('utf8')), warnings };
  }

  warnings.push('Unsupported file type; imported as plain text where possible.');
  return { text: normalizeExtractedText(buffer.toString('utf8')), warnings };
};

export const mapTextToWorkingPaperSections = (
  text: string,
  templateSections: WorkingPaperTemplateSection[],
): MappedWorkingPaperSection[] => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const normalizedTitles = templateSections.map((section) => normalizeHeading(section.title));

  return templateSections.map((section, index) => {
    const content = extractSectionContent(lines, normalizedTitles, index);
    const fallback = content || extractLikelyParagraph(text, section.title);
    return {
      title: section.title,
      description: section.description,
      required: section.required,
      content: fallback,
      confidence: content ? 0.85 : fallback ? 0.45 : 0,
    };
  });
};

export const buildWorkingPaperContentFromSections = (
  sections: MappedWorkingPaperSection[],
): string => JSON.stringify({
  sections: sections.map((section) => ({
    title: section.title,
    content: section.content,
  })),
});

export const averageSectionConfidence = (sections: MappedWorkingPaperSection[]): number => {
  if (sections.length === 0) return 0;
  const average = sections.reduce((sum, section) => sum + section.confidence, 0) / sections.length;
  return Math.round(average * 100) / 100;
};

export const truncateExtractedText = (text: string): string =>
  text.length > MAX_EXTRACTED_TEXT_LENGTH
    ? `${text.slice(0, MAX_EXTRACTED_TEXT_LENGTH)}\n\n[Truncated for preview]`
    : text;

const extractSectionContent = (
  lines: string[],
  normalizedTitles: string[],
  targetIndex: number,
): string => {
  const start = lines.findIndex((line) => isHeadingMatch(line, normalizedTitles[targetIndex]));
  if (start === -1) return '';

  const contentLines: string[] = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const normalizedLine = normalizeHeading(lines[i]);
    const isNextHeading = normalizedTitles.some((title, index) =>
      index !== targetIndex && isHeadingMatch(normalizedLine, title),
    );
    if (isNextHeading) break;
    contentLines.push(lines[i]);
  }

  return contentLines.join('\n').trim();
};

const extractLikelyParagraph = (text: string, title: string): string => {
  const normalizedTitle = normalizeHeading(title);
  const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
  const match = paragraphs.find((paragraph) => normalizeHeading(paragraph).includes(normalizedTitle));
  if (!match) return '';
  return match.replace(new RegExp(escapeRegExp(title), 'i'), '').trim();
};

const isHeadingMatch = (line: string, normalizedTitle: string): boolean => {
  const normalizedLine = normalizeHeading(line);
  return normalizedLine === normalizedTitle
    || normalizedLine.startsWith(`${normalizedTitle} `)
    || normalizedLine.endsWith(` ${normalizedTitle}`);
};

const normalizeHeading = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^\d+\s+/, '')
    .trim();

const normalizeExtractedText = (value: string): string =>
  value
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

const escapeRegExp = (value: string): string =>
  value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
