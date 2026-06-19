import type { TDocumentDefinitions } from 'pdfmake/interfaces';
export { WP_REVIEWABLE_STATUSES } from '../../utility/audit.utility';
export interface WorkingPaperSection {
    title: string;
    content: string;
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
 * Working paper `content` is stored either as a JSON string of
 * `{ sections: [{ title, content }] }` (imported papers) or as free text
 * (manually created papers). Normalise both into a list of sections.
 */
export declare const parseWorkingPaperSections: (content: string | null | undefined) => WorkingPaperSection[];
/**
 * Build a pdfmake document definition for a working paper.
 * Rendered to a PDF Buffer via `renderPdf` in the service layer.
 */
export declare const buildWorkingPaperDocDefinition: (data: WorkingPaperPdfData) => TDocumentDefinitions;
//# sourceMappingURL=working-paper.utility.d.ts.map