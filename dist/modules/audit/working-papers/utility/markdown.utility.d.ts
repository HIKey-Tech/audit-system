import type { Content } from 'pdfmake/interfaces';
/** Markdown → pdfmake Content blocks. Never throws; unknown constructs degrade to raw text. */
export declare const markdownToPdfContent: (markdown: string) => Content[];
/** Markdown → readable plain text (headings uppercased, lists bulleted, tables piped). */
export declare const markdownToPlainText: (markdown: string) => string;
//# sourceMappingURL=markdown.utility.d.ts.map