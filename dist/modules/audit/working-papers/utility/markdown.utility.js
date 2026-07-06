"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.markdownToPlainText = exports.markdownToPdfContent = void 0;
// Markdown rendering for working-paper exports.
//
// Working-paper section content is authored as Markdown in the frontend (with
// live preview). This utility converts that Markdown for the two export paths:
//   - `markdownToPdfContent` — pdfmake Content blocks (the high-fidelity path:
//     real headings, bold/italic runs, bullet/numbered lists, GFM tables).
//   - `markdownToPlainText` — readable plain text for the docxtemplater path,
//     whose `{content}` placeholder only accepts text with line breaks.
//
// Supported subset: headings, paragraphs, bold/italic/inline code, links,
// bullet + numbered lists, GFM tables, fenced code blocks, blockquotes, hr.
// Anything else degrades to its raw text — never throws.
const marked_1 = require("marked");
const pdf_util_1 = require("../../../../shared/utils/pdf.util");
const lex = (markdown) => {
    try {
        return new marked_1.Lexer({ gfm: true }).lex(markdown ?? '');
    }
    catch {
        // Malformed input must never break an export — fall back to one text token.
        return [{ type: 'paragraph', raw: markdown, text: markdown, tokens: [] }];
    }
};
// ─────────────────────────────────────────────────────────────
// Inline tokens → pdfmake text runs
// ─────────────────────────────────────────────────────────────
const inlineToRuns = (tokens, base = {}) => {
    if (!tokens || tokens.length === 0)
        return [];
    const runs = [];
    for (const token of tokens) {
        switch (token.type) {
            case 'strong':
                runs.push(...inlineToRuns(token.tokens, { ...base, bold: true }));
                break;
            case 'em':
                runs.push(...inlineToRuns(token.tokens, { ...base, italics: true }));
                break;
            case 'del':
                runs.push(...inlineToRuns(token.tokens, { ...base, decoration: 'lineThrough' }));
                break;
            case 'codespan':
                runs.push({ ...base, text: token.text, color: '#334155' });
                break;
            case 'link': {
                const link = token;
                const inner = inlineToRuns(link.tokens, { ...base, color: '#1D4ED8', decoration: 'underline' });
                runs.push(...inner.map((r) => ({ ...r, link: link.href })));
                break;
            }
            case 'br':
                runs.push({ ...base, text: '\n' });
                break;
            case 'text': {
                const t = token;
                if (t.tokens && t.tokens.length > 0)
                    runs.push(...inlineToRuns(t.tokens, base));
                else
                    runs.push({ ...base, text: t.text });
                break;
            }
            case 'escape':
                runs.push({ ...base, text: token.text });
                break;
            default:
                runs.push({ ...base, text: 'raw' in token ? String(token.raw) : '' });
        }
    }
    return runs;
};
/** Marked HTML-escapes text token content (e.g. `&` → `&amp;`); undo for PDF/plain text. */
const unescapeRuns = (runs) => runs.map((r) => ({
    ...r,
    text: r.text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'"),
}));
const inlineContent = (tokens) => {
    const runs = unescapeRuns(inlineToRuns(tokens));
    return runs.length > 0 ? runs : '';
};
// ─────────────────────────────────────────────────────────────
// Block tokens → pdfmake Content
// ─────────────────────────────────────────────────────────────
const HEADING_SIZES = { 1: 14, 2: 13, 3: 12, 4: 11, 5: 11, 6: 11 };
const listToContent = (list) => {
    const items = list.items.map((item) => {
        // A list item's tokens are block tokens (usually one 'text' with inline tokens).
        const blocks = tokensToContent(item.tokens);
        return blocks.length === 1 ? blocks[0] : { stack: blocks };
    });
    return list.ordered
        ? { ol: items, margin: [0, 2, 0, 4] }
        : { ul: items, margin: [0, 2, 0, 4] };
};
const tableToContent = (table) => {
    const headerCells = table.header.map((cell) => ({
        text: inlineContent(cell.tokens),
        bold: true,
        fillColor: '#F1F5F9',
    }));
    const bodyRows = table.rows.map((row) => row.map((cell) => ({ text: inlineContent(cell.tokens) })));
    return {
        table: {
            headerRows: 1,
            widths: Array(table.header.length).fill('*'),
            body: [headerCells, ...bodyRows],
        },
        layout: pdf_util_1.borderedTableLayout,
        fontSize: 9,
        margin: [0, 4, 0, 6],
    };
};
const tokensToContent = (tokens) => {
    const content = [];
    for (const token of tokens) {
        switch (token.type) {
            case 'heading': {
                const h = token;
                content.push({
                    text: inlineContent(h.tokens),
                    bold: true,
                    fontSize: HEADING_SIZES[h.depth] ?? 11,
                    margin: [0, 8, 0, 3],
                });
                break;
            }
            case 'paragraph':
                content.push({ text: inlineContent(token.tokens), margin: [0, 3, 0, 3] });
                break;
            case 'list':
                content.push(listToContent(token));
                break;
            case 'table':
                content.push(tableToContent(token));
                break;
            case 'code':
                content.push({
                    text: token.text,
                    fontSize: 9,
                    color: '#334155',
                    margin: [8, 4, 0, 4],
                });
                break;
            case 'blockquote':
                content.push({
                    stack: tokensToContent(token.tokens),
                    margin: [12, 3, 0, 3],
                    color: '#475569',
                });
                break;
            case 'hr':
                content.push({
                    canvas: [{ type: 'line', x1: 0, y1: 0, x2: 493, y2: 0, lineWidth: 0.5, lineColor: '#CBD5E1' }],
                    margin: [0, 6, 0, 6],
                });
                break;
            case 'space':
                break;
            case 'text': {
                const t = token;
                content.push({ text: inlineContent(t.tokens && t.tokens.length > 0 ? t.tokens : [token]), margin: [0, 1, 0, 1] });
                break;
            }
            default:
                if ('raw' in token && String(token.raw).trim()) {
                    content.push({ text: String(token.raw), margin: [0, 3, 0, 3] });
                }
        }
    }
    return content;
};
/** Markdown → pdfmake Content blocks. Never throws; unknown constructs degrade to raw text. */
const markdownToPdfContent = (markdown) => {
    const trimmed = (markdown ?? '').trim();
    if (!trimmed)
        return [];
    return tokensToContent(lex(trimmed));
};
exports.markdownToPdfContent = markdownToPdfContent;
// ─────────────────────────────────────────────────────────────
// Markdown → readable plain text (DOCX {content} placeholder path)
// ─────────────────────────────────────────────────────────────
const inlineToText = (tokens) => unescapeRuns(inlineToRuns(tokens)).map((r) => r.text).join('');
const tokensToPlainText = (tokens) => {
    const lines = [];
    for (const token of tokens) {
        switch (token.type) {
            case 'heading':
                lines.push(inlineToText(token.tokens).toUpperCase());
                break;
            case 'paragraph':
                lines.push(inlineToText(token.tokens));
                break;
            case 'list': {
                const list = token;
                list.items.forEach((item, idx) => {
                    const marker = list.ordered ? `${idx + 1}. ` : '• ';
                    lines.push(marker + tokensToPlainText(item.tokens).replace(/\n+/g, ' ').trim());
                });
                break;
            }
            case 'table': {
                const table = token;
                lines.push(table.header.map((c) => inlineToText(c.tokens)).join(' | '));
                lines.push(table.header.map(() => '---').join(' | '));
                for (const row of table.rows) {
                    lines.push(row.map((c) => inlineToText(c.tokens)).join(' | '));
                }
                break;
            }
            case 'code':
                lines.push(token.text);
                break;
            case 'blockquote':
                lines.push(tokensToPlainText(token.tokens)
                    .split('\n')
                    .map((l) => `> ${l}`)
                    .join('\n'));
                break;
            case 'hr':
                lines.push('----------------------------------------');
                break;
            case 'space':
                break;
            case 'text': {
                const t = token;
                lines.push(t.tokens && t.tokens.length > 0 ? inlineToText(t.tokens) : t.text);
                break;
            }
            default:
                if ('raw' in token)
                    lines.push(String(token.raw).trim());
        }
    }
    return lines.filter((l) => l.length > 0).join('\n');
};
/** Markdown → readable plain text (headings uppercased, lists bulleted, tables piped). */
const markdownToPlainText = (markdown) => {
    const trimmed = (markdown ?? '').trim();
    if (!trimmed)
        return '';
    return tokensToPlainText(lex(trimmed));
};
exports.markdownToPlainText = markdownToPlainText;
//# sourceMappingURL=markdown.utility.js.map