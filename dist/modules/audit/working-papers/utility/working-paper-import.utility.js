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
const MAX_HEADING_WORDS = 14;
const SECTION_ALIASES = {
    'audit objective': ['objective', 'purpose', 'test objective', 'work paper objective', 'working paper objective'],
    objective: ['audit objective', 'purpose', 'test objective'],
    scope: ['audit scope', 'scope of work', 'coverage'],
    'test procedure': ['procedure', 'procedures', 'procedure performed', 'procedures performed', 'test steps', 'work performed', 'audit procedure'],
    'procedure performed': ['procedures performed', 'test procedure', 'test steps', 'work performed'],
    'sample selection': ['sampling', 'sample', 'samples selected', 'sample details', 'selection method'],
    observations: ['observation', 'results', 'work performed results', 'testing result'],
    results: ['result', 'testing result', 'observations', 'exceptions noted'],
    conclusion: ['audit conclusion', 'overall conclusion', 'conclusions'],
    'control objective': ['objective', 'control aim', 'control purpose'],
    'control description': ['control tested', 'control details', 'control activity'],
    'control tested': ['control description', 'control activity', 'key control'],
    'evidence reviewed': ['evidence', 'evidence reference', 'documents reviewed', 'records reviewed', 'supporting evidence'],
    'evidence reference': ['evidence reviewed', 'evidence', 'supporting evidence', 'file reference'],
    exceptions: ['exceptions noted', 'exception noted', 'exceptions identified', 'issues noted'],
    'exceptions noted': ['exceptions', 'exception noted', 'exceptions identified', 'issues noted'],
    'risk rating': ['risk assessment', 'risk level', 'severity'],
    'risk addressed': ['risk', 'risk/control', 'risk and control', 'control risk'],
    'regulatory requirement': ['requirement', 'criteria', 'audit criteria', 'standard requirement'],
    'compliance criteria': ['criteria', 'audit criteria', 'requirement'],
    'compliance status': ['status', 'compliance result', 'result'],
    'system overview': ['system description', 'application overview', 'system in scope'],
    'technical findings': ['findings', 'technical observations', 'issues identified'],
    'impact assessment': ['impact', 'risk implication', 'effect'],
    condition: ['finding condition', 'observation', 'issue'],
    criteria: ['criterion', 'requirement', 'expected control', 'standard'],
    cause: ['root cause', 'reason', 'cause analysis'],
    'effect risk': ['effect', 'risk implication', 'impact', 'exposure'],
    recommendation: ['recommended action', 'action required', 'corrective action'],
    'management discussion': ['discussion', 'auditee discussion', 'management comment'],
    population: ['population source', 'population details', 'population used'],
    'population source': ['population', 'source data', 'data source'],
    'completeness check': ['population validation', 'completeness validation', 'reconciliation'],
    'sampling method': ['sample selection', 'selection method', 'sampling approach'],
    'sample details': ['samples selected', 'sample list', 'sample selection'],
    limitations: ['limitation', 'constraints', 'data limitations'],
    participants: ['interviewees', 'people interviewed', 'process owners'],
    'process narrative': ['narrative', 'process flow', 'walkthrough narrative'],
    'key controls identified': ['key controls', 'controls identified', 'control points'],
    'design gaps': ['gaps', 'control gaps', 'design weaknesses'],
    'itgc domain': ['domain', 'control domain', 'it general control domain'],
    'system in scope': ['system overview', 'application', 'platform in scope'],
    'testing result': ['results', 'test result', 'observations'],
    'finding reference': ['reference', 'finding id', 'issue reference'],
    'management action': ['agreed action', 'action plan', 'management response'],
    'evidence received': ['remediation evidence', 'evidence reviewed', 'supporting evidence'],
    'verification procedure': ['verification work', 'follow up procedure', 'test steps'],
    'verification result': ['verification status', 'result', 'follow up result'],
    'residual risk': ['remaining risk', 'residual exposure', 'open risk'],
};
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
    const headingCandidates = templateSections.map((section) => buildHeadingCandidates(section.title));
    return templateSections.map((section, index) => {
        const extracted = extractSectionContent(lines, headingCandidates, index);
        const fallback = extracted.content || extractLikelyParagraph(text, headingCandidates[index]);
        return {
            title: section.title,
            description: section.description,
            required: section.required,
            content: fallback,
            confidence: extracted.content ? extracted.confidence : fallback ? 0.45 : 0,
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
const extractSectionContent = (lines, headingCandidates, targetIndex) => {
    const start = lines.findIndex((line) => isAnyHeadingMatch(line, headingCandidates[targetIndex]));
    if (start === -1)
        return { content: '', confidence: 0 };
    const contentLines = [];
    for (let i = start + 1; i < lines.length; i += 1) {
        const isNextHeading = headingCandidates.some((candidates, index) => index !== targetIndex && isAnyHeadingMatch(lines[i], candidates));
        if (isNextHeading)
            break;
        contentLines.push(lines[i]);
    }
    return {
        content: contentLines.join('\n').trim(),
        confidence: isHeadingMatch(lines[start], headingCandidates[targetIndex][0]) ? 0.9 : 0.75,
    };
};
const extractLikelyParagraph = (text, headingCandidates) => {
    const paragraphs = text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
    const match = paragraphs.find((paragraph) => {
        const normalizedParagraph = normalizeHeading(paragraph);
        return headingCandidates.some((candidate) => normalizedParagraph.includes(candidate));
    });
    if (!match)
        return '';
    const heading = headingCandidates.find((candidate) => normalizeHeading(match).includes(candidate)) ?? headingCandidates[0];
    return match.replace(new RegExp(escapeRegExp(heading), 'i'), '').trim();
};
const isAnyHeadingMatch = (line, candidates) => candidates.some((candidate) => isHeadingMatch(line, candidate));
const isHeadingMatch = (line, normalizedTitle) => {
    const normalizedLine = normalizeHeading(line);
    const lineWordCount = normalizedLine.split(' ').filter(Boolean).length;
    const titleWordCount = normalizedTitle.split(' ').filter(Boolean).length;
    if (!normalizedLine || lineWordCount > MAX_HEADING_WORDS)
        return false;
    if (normalizedLine === normalizedTitle)
        return true;
    if (titleWordCount === 1)
        return false;
    const headingLengthLooksRight = lineWordCount <= titleWordCount + 3;
    const titleTokens = normalizedTitle.split(' ').filter(Boolean);
    const startsOrEndsLikeTitle = normalizedLine.startsWith(`${titleTokens[0]} `)
        || normalizedLine.endsWith(` ${titleTokens[titleTokens.length - 1]}`);
    return headingLengthLooksRight && (normalizedLine.startsWith(`${normalizedTitle} `)
        || normalizedLine.endsWith(` ${normalizedTitle}`)
        || (startsOrEndsLikeTitle && tokenOverlap(normalizedLine, normalizedTitle) >= 0.8));
};
const buildHeadingCandidates = (title) => {
    const normalizedTitle = normalizeHeading(title);
    const aliases = SECTION_ALIASES[normalizedTitle] ?? [];
    return [...new Set([normalizedTitle, ...aliases.map(normalizeHeading)].filter(Boolean))];
};
const normalizeHeading = (value) => value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/^\d+(\.\d+)*\s+/, '')
    .trim();
const normalizeExtractedText = (value) => value
    .replace(/\r\n/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00a0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tokenOverlap = (line, title) => {
    const lineTokens = new Set(line.split(' ').filter((token) => token.length > 2));
    const titleTokens = title.split(' ').filter((token) => token.length > 2);
    if (titleTokens.length === 0)
        return 0;
    const hits = titleTokens.filter((token) => lineTokens.has(token)).length;
    return hits / titleTokens.length;
};
//# sourceMappingURL=working-paper-import.utility.js.map