'use client';

import { useRef } from 'react';
import dynamic from 'next/dynamic';
import type { Editor } from '@tiptap/react';
import { toast } from 'sonner';
import { FileUp, Save } from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { workspaceApi } from '@/lib/api/workspace';
import type { WordDocumentEditorProps } from '@/components/ui/WordDocumentEditor';

// Large, and only needed where a document is being written: loaded on demand and never on the server.
const RichDocumentEditor = dynamic(() => import('./RichDocumentEditor').then((m) => m.RichDocumentEditor), {
  ssr: false,
  loading: () => <p className="p-6 text-sm text-text-muted">Loading editor…</p>,
});

/**
 * The editor used for the Review (report) tab and for working papers: the same full editor as My Documents, so
 * anything can be deleted, retyped or pasted, tables added, and a Word file brought in. It takes the props the older
 * editor took, so those screens did not have to change.
 */
export const WordDocumentEditor = ({
  value,
  onChange,
  documentTitle,
  readOnly,
  onSaveDraft,
  savingDraft,
  minHeight,
}: WordDocumentEditorProps): JSX.Element => {
  const editorRef = useRef<Editor | null>(null);
  const wordInput = useRef<HTMLInputElement>(null);

  const importWord = async (file: File): Promise<void> => {
    try {
      const r = await workspaceApi.importWord(file);
      const ed = editorRef.current;
      if (ed) {
        // Add it after the block the caret is in, so a list or table at the caret is not split open.
        const { $to } = ed.state.selection;
        const at = $to.depth >= 1 ? $to.after(1) : $to.pos;
        ed.chain().focus().insertContentAt(at, r.html).run();
      }
      toast.success('Word file added at the cursor');
      if (r.warnings[0]) toast.warning(`Some Word features could not be carried over: ${r.warnings[0]}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not import that file');
    }
  };

  return (
    <RichDocumentEditor
      value={value}
      onChange={onChange}
      readOnly={readOnly}
      minHeight={minHeight?.includes('calc') ? minHeight : minHeight ? `max(${minHeight}, 70vh)` : '75vh'}
      onEditor={(e) => {
        editorRef.current = e;
      }}
      topBar={
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-3 py-2">
          <p className="truncate text-sm font-semibold text-text-primary">{documentTitle ?? 'Document'}</p>
          {!readOnly && (
            <div className="flex items-center gap-2">
              <input
                ref={wordInput}
                type="file"
                accept=".docx"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  e.target.value = '';
                  if (f) void importWord(f);
                }}
              />
              <Button size="sm" variant="secondary" leftIcon={<FileUp className="h-3.5 w-3.5" />} onClick={() => wordInput.current?.click()}>
                Import Word
              </Button>
              {onSaveDraft && (
                <Button size="sm" leftIcon={<Save className="h-3.5 w-3.5" />} isLoading={savingDraft} onClick={onSaveDraft}>
                  Save draft
                </Button>
              )}
            </div>
          )}
        </div>
      }
    />
  );
};
