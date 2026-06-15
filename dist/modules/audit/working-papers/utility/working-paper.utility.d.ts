export { WP_REVIEWABLE_STATUSES } from '../../utility/audit.utility';
export interface WorkingPaperSection {
    title: string;
    content: string;
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
}
/**
 * Escape a value for safe interpolation into HTML.
 */
export declare const escapeHtml: (value: unknown) => string;
/**
 * Working paper `content` is stored either as a JSON string of
 * `{ sections: [{ title, content }] }` (imported papers) or as free text
 * (manually created papers). Normalise both into a list of sections.
 */
export declare const parseWorkingPaperSections: (content: string | null | undefined) => WorkingPaperSection[];
/**
 * Build a self-contained, print-ready HTML document for a working paper.
 * Rendered to PDF via puppeteer in the service layer.
 */
export declare const buildWorkingPaperHtml: (data: WorkingPaperPdfData) => string;
//# sourceMappingURL=working-paper.utility.d.ts.map