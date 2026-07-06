"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkingPaperDocDefinition = exports.parseWorkingPaperSections = exports.escapeHtml = exports.WP_REVIEWABLE_STATUSES = void 0;
const pdf_util_1 = require("../../../../shared/utils/pdf.util");
const markdown_utility_1 = require("./markdown.utility");
var audit_utility_1 = require("../../utility/audit.utility");
Object.defineProperty(exports, "WP_REVIEWABLE_STATUSES", { enumerable: true, get: function () { return audit_utility_1.WP_REVIEWABLE_STATUSES; } });
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
/**
 * Working paper `content` is stored either as a JSON string of
 * `{ sections: [{ title, content }] }` (imported papers) or as free text
 * (manually created papers). Normalise both into a list of sections.
 */
const parseWorkingPaperSections = (content) => {
    const raw = (content ?? '').trim();
    if (!raw)
        return [];
    try {
        const parsed = JSON.parse(raw);
        if (parsed && Array.isArray(parsed.sections)) {
            return parsed.sections
                .map((section) => ({
                title: String(section?.title ?? '').trim(),
                content: String(section?.content ?? '').trim(),
            }))
                .filter((section) => section.title || section.content);
        }
    }
    catch {
        // Not JSON — fall through to treat the whole thing as a single section.
    }
    return [{ title: '', content: raw }];
};
exports.parseWorkingPaperSections = parseWorkingPaperSections;
/** Brand navy used across the working-paper PDF. */
const BRAND = '#1E3A8A';
/** Render a section's Markdown body into pdfmake blocks (plain text degrades cleanly). */
const renderSectionBody = (content) => (0, markdown_utility_1.markdownToPdfContent)(content);
/**
 * Build a pdfmake document definition for a working paper.
 * Rendered to a PDF Buffer via `renderPdf` in the service layer.
 */
const buildWorkingPaperDocDefinition = (data) => {
    const sectionsContent = data.sections.length === 0
        ? [{ text: 'This working paper has no content.', italics: true, color: '#64748B', margin: [0, 8, 0, 0] }]
        : data.sections.flatMap((section, idx) => {
            const heading = section.title || `Section ${idx + 1}`;
            return [
                { text: heading, style: 'sectionTitle', margin: [0, 16, 0, 6] },
                ...renderSectionBody(section.content),
            ];
        });
    const metaRow = (label, value) => [
        { text: label, bold: true, color: BRAND, fillColor: '#F8F9FA' },
        { text: value },
    ];
    const content = [
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
exports.buildWorkingPaperDocDefinition = buildWorkingPaperDocDefinition;
//# sourceMappingURL=working-paper.utility.js.map