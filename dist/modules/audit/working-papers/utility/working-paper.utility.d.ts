import type { TDocumentDefinitions } from 'pdfmake/interfaces';
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
/**
 * Escape a value for safe interpolation into HTML.
 */
export declare const escapeHtml: (value: unknown) => string;
/**
 * Converts an HTML fragment (from WordDocumentEditor) into clean Markdown text
 * plus an array of extracted base64 `data:image/...` URLs.
 */
export declare const htmlFragmentToMarkdownAndImages: (html: string) => {
    markdown: string;
    images: string[];
};
/**
 * Working paper `content` is stored as:
 * 1. Rich HTML from `WordDocumentEditor` (with `<h2>` section headings, tables, and inline images)
 * 2. A JSON string of `{ sections: [{ title, content }] }` (legacy / imported papers)
 * 3. Free-form Markdown / plain text
 * Normalise all formats into a list of `WorkingPaperSection`s.
 */
export declare const parseWorkingPaperSections: (content: string | null | undefined) => WorkingPaperSection[];
/**
 * Build a pdfmake document definition for a working paper.
 * Rendered to a PDF Buffer via `renderPdf` in the service layer.
 */
export declare const buildWorkingPaperDocDefinition: (data: WorkingPaperPdfData) => TDocumentDefinitions;
export declare const getGbbLogoBuffer: () => Buffer | null;
/**
 * Build a rich DOCX document for an audit working paper using the `docx` library.
 * Embeds official GBB logo, styled metadata table, real Word tables from Markdown,
 * inline images, and digital approver signatures.
 */
export declare const buildWorkingPaperDocx: (data: WorkingPaperPdfData) => Promise<Buffer>;
//# sourceMappingURL=working-paper.utility.d.ts.map