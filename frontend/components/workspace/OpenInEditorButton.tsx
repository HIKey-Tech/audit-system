'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { FilePenLine, Loader2 } from 'lucide-react';

import { cn } from '@/lib/utils/cn';
import { copyWordDocumentToEditor, isWordFile } from '@/lib/workspace/open-in-editor';

interface Props {
  documentId: string;
  fileName: string;
  className?: string;
  /** "link" matches the small text actions next to View/Download; "button" is a normal button. */
  variant?: 'link' | 'button';
  /** Called once the copy exists, just before navigating. */
  onOpened?: () => void;
}

/** "Open in Word editor": shown only for .docx files. Edits a copy in My Documents; the original is unchanged. */
export const OpenInEditorButton = ({ documentId, fileName, className, variant = 'link', onOpened }: Props): JSX.Element | null => {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  if (!isWordFile(fileName)) return null;

  const open = async (): Promise<void> => {
    setBusy(true);
    try {
      const id = await copyWordDocumentToEditor(documentId, fileName);
      toast.success('Opened a copy in My Documents. The original file is unchanged.');
      onOpened?.();
      router.push(`/workspace/${id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not open this file in the editor');
      setBusy(false);
    }
  };

  return (
    <button
      type="button"
      onClick={() => void open()}
      disabled={busy}
      title="Opens an editable copy in the Word editor. The original file is not changed."
      className={cn(
        variant === 'link'
          ? 'inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-semibold text-primary hover:bg-slate-100 hover:underline disabled:opacity-60'
          : 'inline-flex items-center gap-1.5 rounded-md border border-border bg-white px-3 py-1.5 text-xs font-semibold text-text-primary hover:bg-surface-alt disabled:opacity-60',
        className,
      )}
    >
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePenLine className="h-3.5 w-3.5" />}
      Open in Word editor
    </button>
  );
};
