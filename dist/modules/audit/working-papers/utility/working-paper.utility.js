"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildWorkingPaperHtml = exports.parseWorkingPaperSections = exports.escapeHtml = exports.WP_REVIEWABLE_STATUSES = void 0;
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
const renderSectionBody = (content) => {
    const paragraphs = content
        .split(/\n{2,}/)
        .map((paragraph) => paragraph.trim())
        .filter(Boolean);
    if (paragraphs.length === 0)
        return '';
    return paragraphs
        .map((paragraph) => `<p>${(0, exports.escapeHtml)(paragraph).replace(/\n/g, '<br>')}</p>`)
        .join('');
};
/**
 * Build a self-contained, print-ready HTML document for a working paper.
 * Rendered to PDF via puppeteer in the service layer.
 */
const buildWorkingPaperHtml = (data) => {
    const sectionsHtml = data.sections.length === 0
        ? '<p class="empty">This working paper has no content.</p>'
        : data.sections
            .map((section, idx) => {
            const heading = section.title || `Section ${idx + 1}`;
            return `
            <div class="section">
              <div class="section-title">${(0, exports.escapeHtml)(heading)}</div>
              ${renderSectionBody(section.content)}
            </div>`;
        })
            .join('');
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <style>
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a1a; font-size: 11pt; line-height: 1.5; margin: 0; }
    .header { text-align: center; border-bottom: 3px solid #1E3A8A; padding-bottom: 12px; margin-bottom: 20px; }
    .org-name { font-size: 16pt; font-weight: bold; color: #1E3A8A; }
    .doc-title { font-size: 13pt; font-weight: 600; margin-top: 4px; }
    table.meta-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
    table.meta-table td { border: 1px solid #ccc; padding: 7px 10px; text-align: left; vertical-align: top; }
    table.meta-table td.label { width: 25%; font-weight: bold; color: #1E3A8A; background-color: #f8f9fa; }
    .section { margin-top: 22px; }
    .section-title { font-size: 13pt; font-weight: bold; color: #1E3A8A; margin-bottom: 8px; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
    .section p { margin: 6px 0; }
    .empty { font-style: italic; color: #64748B; }
    .footer { margin-top: 30px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 9pt; color: #64748B; text-align: center; }
  </style>
</head>
<body>
  <div class="header">
    <div class="org-name">Galaxy Backbone Limited</div>
    <div class="doc-title">Audit Working Paper</div>
  </div>

  <table class="meta-table">
    <tr><td class="label">Title</td><td>${(0, exports.escapeHtml)(data.title)}</td></tr>
    <tr><td class="label">Engagement</td><td>${(0, exports.escapeHtml)(data.engagementReference)} — ${(0, exports.escapeHtml)(data.engagementTitle)}</td></tr>
    <tr><td class="label">Working Paper Type</td><td>${(0, exports.escapeHtml)(data.workingPaperType)}</td></tr>
    <tr><td class="label">Prepared By</td><td>${(0, exports.escapeHtml)(data.auditorName)}</td></tr>
    <tr><td class="label">Status</td><td>${(0, exports.escapeHtml)(data.status)}</td></tr>
    <tr><td class="label">Version</td><td>${(0, exports.escapeHtml)(data.version)}</td></tr>
    <tr><td class="label">Exported On</td><td>${(0, exports.escapeHtml)(data.date)}</td></tr>
  </table>

  ${sectionsHtml}

  <div class="footer">
    Galaxy Backbone Limited — Internal Audit Management System. This document is confidential.
  </div>
</body>
</html>`;
};
exports.buildWorkingPaperHtml = buildWorkingPaperHtml;
//# sourceMappingURL=working-paper.utility.js.map