export declare const DOCX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
/**
 * Render a docxtemplater-compatible document.xml body to a complete .docx
 * buffer. Placeholders use the default `{tag}` / `{#tag}{/tag}` delimiters.
 */
export declare const renderDocxFromDocumentXml: (documentXml: string, data: Record<string, unknown>) => Buffer;
//# sourceMappingURL=docx-template.utility.d.ts.map