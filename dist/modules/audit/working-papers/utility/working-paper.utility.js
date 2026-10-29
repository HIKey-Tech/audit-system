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
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkingPaperDocx = exports.getGbbLogoBuffer = exports.buildWorkingPaperDocDefinition = exports.parseWorkingPaperSections = exports.htmlFragmentToMarkdownAndImages = exports.escapeHtml = exports.WP_REVIEWABLE_STATUSES = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const docx_1 = require("docx");
const pdf_util_1 = require("../../../../shared/utils/pdf.util");
const markdown_utility_1 = require("./markdown.utility");
var audit_utility_1 = require("../../utility/audit.utility");
Object.defineProperty(exports, "WP_REVIEWABLE_STATUSES", { enumerable: true, get: function () { return audit_utility_1.WP_REVIEWABLE_STATUSES; } });
let cachedGbbLogoDataUrl = null;
const getGbbLogoDataUrl = () => {
    if (cachedGbbLogoDataUrl)
        return cachedGbbLogoDataUrl;
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
        }
        catch {
            // Try next path
        }
    }
    return null;
};
/**
 * Escape a value for safe interpolation into HTML.
 */
const escapeHtml = (value) => String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
exports.escapeHtml = escapeHtml;
const decodeHtmlEntities = (str) => str
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
const htmlFragmentToMarkdownAndImages = (html) => {
    const images = [];
    let working = (html ?? '').replace(/<!--[\s\S]*?-->/g, '');
    // Extract inline base64 images
    working = working.replace(/<img\b[^>]*src=["'](data:image\/[^"']+)["'][^>]*>/gi, (_m, src) => {
        images.push(src);
        return '\n';
    });
    // Convert HTML tables into GFM pipe tables
    working = working.replace(/<table\b[^>]*>([\s\S]*?)<\/table>/gi, (_m, tableInner) => {
        const rowMatches = [...tableInner.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];
        if (rowMatches.length === 0)
            return '';
        const parsedRows = rowMatches.map((rm) => {
            const cellMatches = [...rm[1].matchAll(/<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi)];
            return cellMatches.map((cm) => decodeHtmlEntities(cm[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()) || ' ');
        });
        const colCount = Math.max(...parsedRows.map((r) => r.length), 1);
        const normalized = parsedRows.map((r) => {
            const padded = [...r];
            while (padded.length < colCount)
                padded.push(' ');
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
exports.htmlFragmentToMarkdownAndImages = htmlFragmentToMarkdownAndImages;
const isHtmlContent = (text) => text.startsWith('<!-- page-margin:') ||
    /<(h1|h2|h3|p|table|ul|ol|div|img|blockquote|hr)\b/i.test(text);
/**
 * Working paper `content` is stored as:
 * 1. Rich HTML from `WordDocumentEditor` (with `<h2>` section headings, tables, and inline images)
 * 2. A JSON string of `{ sections: [{ title, content }] }` (legacy / imported papers)
 * 3. Free-form Markdown / plain text
 * Normalise all formats into a list of `WorkingPaperSection`s.
 */
const parseWorkingPaperSections = (content) => {
    const raw = (content ?? '').trim();
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sections)) {
            return parsed.sections
                .map((section) => {
                const rawTitle = String(section?.title ?? '').trim();
                const rawBody = String(section?.content ?? '').trim();
                if (isHtmlContent(rawBody)) {
                    const { markdown, images } = (0, exports.htmlFragmentToMarkdownAndImages)(rawBody);
                    return { title: rawTitle, content: markdown, ...(images.length > 0 ? { images } : {}) };
                }
                return { title: rawTitle, content: rawBody };
            })
                .filter((section) => section.title || section.content || (section.images && section.images.length > 0));
        }
    }
    catch {
        // Not JSON — check for HTML or plain text below.
    }
    if (isHtmlContent(raw)) {
        const cleaned = raw.replace(/<!--\s*page-margin:\w+\s*-->/gi, '').trim();
        const headingRegex = /<h[12]\b[^>]*>([\s\S]*?)<\/h[12]>/gi;
        const matches = [...cleaned.matchAll(headingRegex)];
        if (matches.length > 0) {
            const sections = [];
            // Capture any preface content before the first heading
            const firstIndex = matches[0].index ?? 0;
            if (firstIndex > 0) {
                const prefaceHtml = cleaned.slice(0, firstIndex).trim();
                const { markdown, images } = (0, exports.htmlFragmentToMarkdownAndImages)(prefaceHtml);
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
                const { markdown, images } = (0, exports.htmlFragmentToMarkdownAndImages)(sectionHtml);
                sections.push({
                    title: cleanTitle,
                    content: markdown,
                    ...(images.length > 0 ? { images } : {}),
                });
            });
            return sections.filter((s) => s.title || s.content || (s.images && s.images.length > 0));
        }
        const { markdown, images } = (0, exports.htmlFragmentToMarkdownAndImages)(cleaned);
        return [{ title: '', content: markdown, ...(images.length > 0 ? { images } : {}) }];
    }
    return [{ title: '', content: raw }];
};
exports.parseWorkingPaperSections = parseWorkingPaperSections;
/** Brand navy used across the working-paper PDF. */
const BRAND = '#1E3A8A';
/** Render a section's Markdown body + inline images into pdfmake blocks. */
const renderSectionBody = (section) => {
    const blocks = [...(0, markdown_utility_1.markdownToPdfContent)(section.content)];
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
const buildWorkingPaperDocDefinition = (data) => {
    const logoDataUrl = getGbbLogoDataUrl();
    const sectionsContent = data.sections.length === 0
        ? [{ text: 'This working paper has no content.', italics: true, color: '#64748B', margin: [0, 8, 0, 0] }]
        : data.sections.flatMap((section, idx) => {
            const heading = section.title || `Section ${idx + 1}`;
            return [
                { text: `${idx + 1}. ${heading.replace(/^\d+\.\s*/, '')}`, style: 'sectionTitle', margin: [0, 16, 0, 6] },
                ...renderSectionBody(section),
            ];
        });
    const metaRow = (label, value) => [
        { text: label, bold: true, color: BRAND, fillColor: '#F8F9FA' },
        { text: value },
    ];
    const content = [
        ...(logoDataUrl
            ? [{ image: logoDataUrl, width: 110, alignment: 'center', margin: [0, 0, 0, 6] }]
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
            layout: pdf_util_1.borderedTableLayout,
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
        pageMargins: [(0, pdf_util_1.mm)(18), (0, pdf_util_1.mm)(20), (0, pdf_util_1.mm)(18), (0, pdf_util_1.mm)(20)],
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
exports.buildWorkingPaperDocDefinition = buildWorkingPaperDocDefinition;
let cachedGbbLogoBuffer = null;
const getGbbLogoBuffer = () => {
    if (cachedGbbLogoBuffer)
        return cachedGbbLogoBuffer;
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
        }
        catch {
            // Continue
        }
    }
    return null;
};
exports.getGbbLogoBuffer = getGbbLogoBuffer;
const parseInlineDocxRuns = (text, baseOpts = {}) => {
    if (!text)
        return [];
    const tokens = [];
    const regex = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|[^*`]+)/g;
    let match;
    while ((match = regex.exec(text)) !== null) {
        const chunk = match[0];
        if (chunk.startsWith('**') && chunk.endsWith('**') && chunk.length >= 4) {
            tokens.push(new docx_1.TextRun({
                text: chunk.slice(2, -2),
                bold: true,
                italics: baseOpts.italics,
                color: baseOpts.color ?? '1E293B',
                size: baseOpts.size ?? 20,
            }));
        }
        else if (chunk.startsWith('*') && chunk.endsWith('*') && chunk.length >= 2) {
            tokens.push(new docx_1.TextRun({
                text: chunk.slice(1, -1),
                bold: baseOpts.bold,
                italics: true,
                color: baseOpts.color ?? '1E293B',
                size: baseOpts.size ?? 20,
            }));
        }
        else if (chunk.startsWith('`') && chunk.endsWith('`') && chunk.length >= 2) {
            tokens.push(new docx_1.TextRun({
                text: chunk.slice(1, -1),
                font: 'Courier New',
                color: '0F172A',
                size: baseOpts.size ?? 18,
            }));
        }
        else {
            tokens.push(new docx_1.TextRun({
                text: chunk,
                bold: baseOpts.bold,
                italics: baseOpts.italics,
                color: baseOpts.color ?? '1E293B',
                size: baseOpts.size ?? 20,
            }));
        }
    }
    return tokens.length > 0
        ? tokens
        : [new docx_1.TextRun({ text, size: baseOpts.size ?? 20, color: baseOpts.color ?? '1E293B' })];
};
const parseMarkdownPipeTable = (lines) => {
    if (lines.length < 2)
        return null;
    const parseRow = (line) => line
        .trim()
        .replace(/^\|/, '')
        .replace(/\|$/, '')
        .split('|')
        .map((c) => c.trim());
    const headerCells = parseRow(lines[0]);
    if (headerCells.length === 0)
        return null;
    let dataLines = lines.slice(1);
    if (lines.length >= 2 && /^\|?(\s*:?-+:?\s*\|)+\s*:?-+:?\s*\|?$/.test(lines[1].trim())) {
        dataLines = lines.slice(2);
    }
    const border = { style: docx_1.BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
    const cellBorders = { top: border, bottom: border, left: border, right: border };
    const cellMargins = { top: 120, bottom: 120, left: 140, right: 140 };
    const tableRows = [
        new docx_1.TableRow({
            tableHeader: true,
            children: headerCells.map((hc) => new docx_1.TableCell({
                borders: cellBorders,
                margins: cellMargins,
                shading: { fill: 'F1F5F9', type: docx_1.ShadingType.CLEAR },
                children: [
                    new docx_1.Paragraph({
                        children: [new docx_1.TextRun({ text: hc, bold: true, color: '1E3A8A', size: 19 })],
                    }),
                ],
            })),
        }),
    ];
    for (const line of dataLines) {
        if (!line.trim())
            continue;
        const cells = parseRow(line);
        while (cells.length < headerCells.length)
            cells.push('');
        tableRows.push(new docx_1.TableRow({
            children: cells.slice(0, headerCells.length).map((c) => new docx_1.TableCell({
                borders: cellBorders,
                margins: cellMargins,
                children: [
                    new docx_1.Paragraph({
                        children: parseInlineDocxRuns(c, { size: 19 }),
                    }),
                ],
            })),
        }));
    }
    return new docx_1.Table({
        width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
        rows: tableRows,
        borders: cellBorders,
    });
};
const markdownToDocxBlocks = (markdown) => {
    const blocks = [];
    const lines = (markdown || '').split(/\r?\n/);
    let tableBuffer = [];
    const flushTable = () => {
        if (tableBuffer.length > 0) {
            const table = parseMarkdownPipeTable(tableBuffer);
            if (table)
                blocks.push(table);
            tableBuffer = [];
        }
    };
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();
        if (trimmed.startsWith('|') && trimmed.endsWith('|') && trimmed.length > 2) {
            tableBuffer.push(trimmed);
            continue;
        }
        else {
            flushTable();
        }
        if (!trimmed)
            continue;
        if (trimmed === '---' || trimmed === '***' || trimmed === '___' || trimmed.includes('PAGE_BREAK')) {
            blocks.push(new docx_1.Paragraph({ pageBreakBefore: true, children: [] }));
            continue;
        }
        if (trimmed.startsWith('#### ')) {
            blocks.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_4,
                spacing: { before: 180, after: 60 },
                children: [new docx_1.TextRun({ text: trimmed.slice(5), bold: true, color: '000000', size: 21 })],
            }));
        }
        else if (trimmed.startsWith('### ')) {
            blocks.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_3,
                spacing: { before: 200, after: 80 },
                children: [new docx_1.TextRun({ text: trimmed.slice(4), bold: true, color: '000000', size: 22 })],
            }));
        }
        else if (trimmed.startsWith('## ')) {
            blocks.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_2,
                spacing: { before: 240, after: 100 },
                children: [new docx_1.TextRun({ text: trimmed.slice(3), bold: true, color: '000000', size: 24 })],
            }));
        }
        else if (trimmed.startsWith('# ')) {
            blocks.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_1,
                spacing: { before: 280, after: 120 },
                children: [new docx_1.TextRun({ text: trimmed.slice(2), bold: true, color: '000000', size: 26 })],
            }));
        }
        else if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
            blocks.push(new docx_1.Paragraph({
                bullet: { level: 0 },
                spacing: { after: 60 },
                children: parseInlineDocxRuns(trimmed.slice(2)),
            }));
        }
        else if (/^\d+\.\s+/.test(trimmed)) {
            const match = trimmed.match(/^(\d+\.)\s+(.*)$/);
            if (match) {
                blocks.push(new docx_1.Paragraph({
                    spacing: { after: 60 },
                    children: [
                        new docx_1.TextRun({ text: `${match[1]} `, bold: true, color: '1E3A8A', size: 20 }),
                        ...parseInlineDocxRuns(match[2]),
                    ],
                }));
            }
        }
        else if (trimmed.startsWith('>')) {
            blocks.push(new docx_1.Paragraph({
                indent: { left: (0, docx_1.convertInchesToTwip)(0.3) },
                spacing: { before: 100, after: 100 },
                children: parseInlineDocxRuns(trimmed.replace(/^>\s*/, ''), { italics: true, color: '475569' }),
            }));
        }
        else {
            blocks.push(new docx_1.Paragraph({
                spacing: { after: 120, line: 276 },
                children: parseInlineDocxRuns(trimmed),
            }));
        }
    }
    flushTable();
    return blocks;
};
const renderDocxImages = (images) => {
    const result = [];
    for (const imgUrl of images) {
        try {
            const match = imgUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
            if (match) {
                const imgType = match[1] === 'jpeg' ? 'jpg' : match[1];
                const imgBuffer = Buffer.from(match[2], 'base64');
                result.push(new docx_1.Paragraph({
                    alignment: docx_1.AlignmentType.CENTER,
                    spacing: { before: 120, after: 120 },
                    children: [
                        new docx_1.ImageRun({
                            type: imgType,
                            data: imgBuffer,
                            transformation: {
                                width: 480,
                                height: 280,
                            },
                        }),
                    ],
                }));
            }
        }
        catch {
            // Ignore image render error
        }
    }
    return result;
};
const buildDocxSignOffTable = (signOff) => {
    const border = { style: docx_1.BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
    const cellBorders = { top: border, bottom: border, left: border, right: border };
    const cellMargins = { top: 120, bottom: 120, left: 140, right: 140 };
    const cols = signOff.map((s) => {
        const children = [];
        if (s.imageDataUrl) {
            try {
                const match = s.imageDataUrl.match(/^data:image\/(png|jpeg|jpg);base64,(.+)$/);
                if (match) {
                    const sigType = match[1] === 'jpeg' ? 'jpg' : match[1];
                    const sigBuf = Buffer.from(match[2], 'base64');
                    children.push(new docx_1.Paragraph({
                        alignment: docx_1.AlignmentType.CENTER,
                        children: [
                            new docx_1.ImageRun({
                                type: sigType,
                                data: sigBuf,
                                transformation: { width: 140, height: 45 },
                            }),
                        ],
                    }));
                }
            }
            catch {
                // Fallback below
            }
        }
        if (children.length === 0) {
            children.push(new docx_1.Paragraph({
                children: [new docx_1.TextRun({ text: 'Digitally Approved & Signed', italics: true, color: '1E3A8A', size: 18 })],
            }));
        }
        children.push(new docx_1.Paragraph({
            spacing: { before: 60 },
            children: [
                new docx_1.TextRun({ text: s.role ? `${s.name} — ${s.role}` : s.name, bold: true, color: '0F172A', size: 19 }),
            ],
        }), new docx_1.Paragraph({
            children: [new docx_1.TextRun({ text: `Approved & signed ${s.date}`, color: '64748B', size: 17 })],
        }));
        return new docx_1.TableCell({
            borders: cellBorders,
            margins: cellMargins,
            width: { size: Math.floor(100 / Math.max(1, signOff.length)), type: docx_1.WidthType.PERCENTAGE },
            children,
        });
    });
    return [
        new docx_1.Paragraph({
            heading: docx_1.HeadingLevel.HEADING_2,
            spacing: { before: 320, after: 120 },
            children: [new docx_1.TextRun({ text: 'Approvals & Signatures', bold: true, color: '1E3A8A', size: 24 })],
        }),
        new docx_1.Table({
            width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
            borders: cellBorders,
            rows: [new docx_1.TableRow({ children: cols })],
        }),
    ];
};
/**
 * Build a rich DOCX document for an audit working paper using the `docx` library.
 * Embeds official GBB logo, styled metadata table, real Word tables from Markdown,
 * inline images, and digital approver signatures.
 */
const buildWorkingPaperDocx = async (data) => {
    const logoBuf = (0, exports.getGbbLogoBuffer)();
    const children = [];
    if (logoBuf) {
        children.push(new docx_1.Paragraph({
            alignment: docx_1.AlignmentType.CENTER,
            spacing: { after: 120 },
            children: [
                new docx_1.ImageRun({
                    type: 'png',
                    data: logoBuf,
                    transformation: { width: 120, height: 40 },
                }),
            ],
        }));
    }
    children.push(new docx_1.Paragraph({
        alignment: docx_1.AlignmentType.CENTER,
        children: [
            new docx_1.TextRun({
                text: 'Galaxy Backbone Limited',
                bold: true,
                color: '1E3A8A',
                size: 32,
            }),
        ],
    }), new docx_1.Paragraph({
        alignment: docx_1.AlignmentType.CENTER,
        spacing: { after: 140 },
        children: [
            new docx_1.TextRun({
                text: 'Audit Working Paper',
                bold: true,
                color: '0F172A',
                size: 26,
            }),
        ],
    }));
    const border = { style: docx_1.BorderStyle.SINGLE, size: 4, color: 'CBD5E1' };
    const cellBorders = { top: border, bottom: border, left: border, right: border };
    const cellMargins = { top: 100, bottom: 100, left: 140, right: 140 };
    const metaDocxRow = (label, value) => new docx_1.TableRow({
        children: [
            new docx_1.TableCell({
                width: { size: 28, type: docx_1.WidthType.PERCENTAGE },
                shading: { fill: 'F8F9FA', type: docx_1.ShadingType.CLEAR },
                borders: cellBorders,
                margins: cellMargins,
                children: [
                    new docx_1.Paragraph({
                        children: [new docx_1.TextRun({ text: label, bold: true, color: '1E3A8A', size: 19 })],
                    }),
                ],
            }),
            new docx_1.TableCell({
                width: { size: 72, type: docx_1.WidthType.PERCENTAGE },
                borders: cellBorders,
                margins: cellMargins,
                children: [
                    new docx_1.Paragraph({
                        children: [new docx_1.TextRun({ text: value || '—', size: 19, color: '1E293B' })],
                    }),
                ],
            }),
        ],
    });
    children.push(new docx_1.Table({
        width: { size: 100, type: docx_1.WidthType.PERCENTAGE },
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
    }));
    if (data.sections.length === 0) {
        children.push(new docx_1.Paragraph({
            spacing: { before: 200 },
            children: [new docx_1.TextRun({ text: 'This working paper has no content.', italics: true, color: '64748B', size: 20 })],
        }));
    }
    else {
        data.sections.forEach((section, idx) => {
            const heading = section.title || `Section ${idx + 1}`;
            children.push(new docx_1.Paragraph({
                heading: docx_1.HeadingLevel.HEADING_2,
                spacing: { before: 280, after: 120 },
                children: [
                    new docx_1.TextRun({
                        text: `${idx + 1}. ${heading.replace(/^\d+\.\s*/, '')}`,
                        bold: true,
                        color: '000000',
                        size: 24,
                    }),
                ],
            }));
            children.push(...markdownToDocxBlocks(section.content));
            if (section.images && section.images.length > 0) {
                children.push(...renderDocxImages(section.images));
            }
        });
    }
    if (data.signOff && data.signOff.length > 0) {
        children.push(...buildDocxSignOffTable(data.signOff));
    }
    const doc = new docx_1.Document({
        sections: [
            {
                properties: {
                    page: {
                        margin: {
                            top: (0, docx_1.convertInchesToTwip)(0.8),
                            bottom: (0, docx_1.convertInchesToTwip)(0.8),
                            left: (0, docx_1.convertInchesToTwip)(0.8),
                            right: (0, docx_1.convertInchesToTwip)(0.8),
                        },
                    },
                },
                footers: {
                    default: new docx_1.Footer({
                        children: [
                            new docx_1.Paragraph({
                                alignment: docx_1.AlignmentType.CENTER,
                                children: [
                                    new docx_1.TextRun({
                                        text: 'Galaxy Backbone Limited — Internal Audit Working Paper · Page ',
                                        size: 16,
                                        color: '64748B',
                                    }),
                                    new docx_1.TextRun({
                                        children: [docx_1.PageNumber.CURRENT],
                                        size: 16,
                                        color: '64748B',
                                    }),
                                    new docx_1.TextRun({
                                        text: ' of ',
                                        size: 16,
                                        color: '64748B',
                                    }),
                                    new docx_1.TextRun({
                                        children: [docx_1.PageNumber.TOTAL_PAGES],
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
    const uint8 = await docx_1.Packer.toBuffer(doc);
    return Buffer.from(uint8);
};
exports.buildWorkingPaperDocx = buildWorkingPaperDocx;
//# sourceMappingURL=working-paper.utility.js.map