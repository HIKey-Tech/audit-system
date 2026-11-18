export interface WorkspaceDocumentSummaryDto {
  id: string;
  title: string;
  template: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceDocumentDto extends WorkspaceDocumentSummaryDto {
  /** The editor's HTML. */
  content: string;
}

export interface ImportedDocumentDto {
  title: string;
  /** The Word file converted to HTML, ready to open in the editor. */
  html: string;
  /** Things Word had that the editor could not carry over (for example unsupported shapes). */
  warnings: string[];
}

export const mapSummary = (d: { id: string; title: string; template: string; created_at: Date; updated_at: Date }): WorkspaceDocumentSummaryDto => ({
  id: d.id,
  title: d.title,
  template: d.template,
  createdAt: d.created_at.toISOString(),
  updatedAt: d.updated_at.toISOString(),
});

export const mapDocument = (d: { id: string; title: string; template: string; content: string; created_at: Date; updated_at: Date }): WorkspaceDocumentDto => ({
  ...mapSummary(d),
  content: d.content,
});
