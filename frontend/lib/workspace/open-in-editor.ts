import { workspaceApi } from '@/lib/api/workspace';

export const isWordFile = (name: string): boolean => /\.docx$/i.test(name.trim());

/**
 * Opens a stored Word document (one somebody sent, attached or uploaded) in the editor. The original file is not
 * touched: its text is converted and saved as an editable copy in the person's own My Documents, and the id of that
 * copy is returned so the caller can open it.
 */
export const copyWordDocumentToEditor = async (documentId: string, fileName: string): Promise<string> => {
  const res = await fetch(`/api/proxy/documents/${documentId}/file`, { credentials: 'include' });
  if (!res.ok) throw new Error(`Could not fetch the file (status ${res.status})`);
  const blob = await res.blob();
  const file = new File([blob], fileName, {
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  const imported = await workspaceApi.importWord(file);
  const title = fileName.replace(/\.docx$/i, '').trim() || 'Untitled';
  const created = await workspaceApi.create({ title, template: 'blank', content: imported.html });
  return created.id;
};
