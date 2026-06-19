import type { Content, CustomTableLayout, TDocumentDefinitions } from 'pdfmake/interfaces';
/** Millimetres → PDF points, for translating the old CSS mm margins. */
export declare const mm: (value: number) => number;
/** pdfmake needs a leading '#'; report header colours are stored without one. */
export declare const hexColor: (value: string) => string;
/** Bordered table layout (light-grey 1px borders + comfortable cell padding). */
export declare const borderedTableLayout: CustomTableLayout;
/** A filled severity pill sized to its text (replaces the old CSS badge span). */
export declare const severityBadge: (severity: string) => Content;
/** Render a pdfmake document definition to a Buffer. */
export declare const renderPdf: (definition: TDocumentDefinitions) => Promise<Buffer>;
//# sourceMappingURL=pdf.util.d.ts.map