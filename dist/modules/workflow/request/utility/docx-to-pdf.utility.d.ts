export declare function isDocx(filename: string, mimeType?: string): boolean;
/**
 * Converts a Word (.docx) document into a PDF buffer while preserving:
 * - Cover pages and structured tags (w:sdt)
 * - Embedded logos and images (w:drawing -> a:blip)
 * - Text justification (w:jc val="both" / "justify")
 * - Centered and right-aligned text
 * - Bold, italic, underline, and relative font sizes
 * - Tables, margins, and paragraph spacing
 */
export declare function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer>;
//# sourceMappingURL=docx-to-pdf.utility.d.ts.map