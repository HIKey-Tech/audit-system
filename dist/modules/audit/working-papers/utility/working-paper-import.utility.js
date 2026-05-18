"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.truncateExtractedText = exports.averageSectionConfidence = exports.buildWorkingPaperContentFromSections = exports.mapTextToWorkingPaperSections = exports.extractWorkingPaperText = void 0;
const mammoth_1 = __importDefault(require("mammoth"));
const XLSX = __importStar(require("xlsx"));
const pdf_parse_1 = require("pdf-parse");
const MAX_EXTRACTED_TEXT_LENGTH = 20_000;
const extractWorkingPaperText = async (buffer, mimeType, originalName) => {
    const name = originalName.toLowerCase();
    const warnings = [];
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        || name.endsWith('.docx')) {
        const result = await mammoth_1.default.extractRawText({ buffer });
        return {
            text: normalizeExtractedText(result.value),
            warnings: result.messages.map((message) => message.message),
        };
    }
    if (mimeType === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        || mimeType === 'application/vnd.ms-excel'
        || name.endsWith('.xlsx')
        || name.endsWith('.xls')) {
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheetTexts = workbook.SheetNames.map((sheetName) => {
            const sheet = workbook.Sheets[sheetName];
            const csv = XLSX.utils.sheet_to_csv(sheet);
            return `Sheet: ${sheetName}\n${csv}`;
        });
        return { text: normalizeExtractedText(sheetTexts.join('\n\n')), warnings };
    }
    if (mimeType === 'application/pdf' || name.endsWith('.pdf')) {
        const parser = new pdf_parse_1.PDFParse({ data: buffer });
        try {
            const result = await parser.getText();
            if (!result.text.trim()) {
                warnings.push('No selectable text was found in the PDF. Scanned PDFs may require OCR.');
            }
            return { text: normalizeExtractedText(result.text), warnings };
        }
        finally {
            await parser.destroy();
        }
    }
    if (mimeType.startsWith('text/')
        || name.endsWith('.txt')
        || name.endsWith('.csv')
        || name.endsWith('.md')) {
        return { text: normalizeExtractedText(buffer.toString('utf8')), warnings };
    }
    warnings.push('Unsupported file type; imported as plain text where possible.');
    return { text: normalizeExtractedText(buffer.toString('utf8')), warnings };
};
exports.extractWorkingPaperText = extractWorkingPaperText;
const mapTextToWorkingPaperSections = (text, templateSections) => {
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
exports.mapTextToWorkingPaperSections = mapTextToWorkingPaperSections;
const buildWorkingPaperContentFromSections = (sections) => JSON.stringify({
    sections: sections.map((section) => ({
        title: section.title,
        content: section.content,
    })),
});
exports.buildWorkingPaperContentFromSections = buildWorkingPaperContentFromSections;
const averageSectionConfidence = (sections) => {
    if (sections.length === 0)
        return 0;
    const average = sections.reduce((sum, section) => sum + section.confidence, 0) / sections.length;
    return Math.round(average * 100) / 100;
};
exports.averageSectionConfidence = averageSectionConfidence;
const truncateExtractedText = (text) => text.length > MAX_EXTRACTED_TEXT_LENGTH
    ? `${text.slice(0, MAX_EXTRACTED_TEXT_LENGTH)}\n\n[Truncated for preview]`
    : text;
exports.truncateExtractedText = truncateExtractedText;
const extractSectionContent = (lines, normalizedTitles, targetIndex) => {
    const start = lines.findIndex((line) => isHeadingMatch(line, normalizedTitles[targetIndex]));
    if (start === -1)
        return '';
    const contentLines = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        const normalizedLine = normalizeHeading(lines[i]);
        const isNextHeading = normalizedTitles.some((title, index) => index !== targetIndex && isHeadingMatch(normalizedLine, title));
        if (isNextHeading)
            break;
        contentLines.push(lines[i]);
    }
    return contentLines.join('\n').trim();
};
const extractLikelyParagraph = (text, title) => {
    const normalizedTitle = normalizeHeading(title);
    const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const match = paragraphs.find((paragraph) => normalizeHeading(paragraph).includes(normalizedTitle));
    if (!match)
        return '';
    return match.replace(new RegExp(escapeRegExp(title), 'i'), '').trim();
};
const isHeadingMatch = (line, normalizedTitle) => {
    const normalizedLine = normalizeHeading(line);
    return normalizedLine === normalizedTitle
        || normalizedLine.startsWith(`${normalizedTitle} `)
        || normalizedLine.endsWith(` ${normalizedTitle}`);
};
const normalizeHeading = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^\d+\s+/, '')
    .trim();
const normalizeExtractedText = (value) => value
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
//# sourceMappingURL=working-paper-import.utility.js.map