'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ArrowLeft, Download, FileUp, Printer } from 'lucide-react';
import NextLink from 'next/link';

import { Button } from '@/components/ui/Button';
import { workspaceApi, type WorkspaceDocument } from '@/lib/api/workspace';
import { buildDocx, downloadBlob, type DocNode } from '@/lib/workspace/export-docx';
import { RichDocumentEditor } from './RichDocumentEditor';

const PRINT_CSS = `
@page { size: letter; margin: 0; }
html, body { margin: 0; }
.page { position: relative; padding: 96px; font-family: Calibri, Carlito, Arial, sans-serif; font-size: 11pt; line-height: 1.35; }
p { margin: 0 0 8pt; } h1 { font-size: 14pt; margin: 14pt 0 6pt; font-family: Corbel, Calibri, Arial; } h2 { font-size: 12pt; } h3 { font-size: 11pt; font-style: italic; }
ul { list-style: disc; padding-left: 1.6em; } ol { list-style: decimal; padding-left: 1.6em; }
table { border-collapse: collapse; width: 100%; table-layout: fixed; margin: 8pt 0; } td, th { border: 1px solid #9ca3af; padding: 4px 6px; vertical-align: top; } th { background: #eef1e6; text-align: left; }
td > p, th > p { margin: 0; } img { max-width: 100%; } img[data-layout='behind'], img[data-layout='front'] { max-width: none; }
.page-break { break-after: page; height: 0; border: 0; } ul[data-type='taskList'] { list-style: none; padding-left: 0; } ul[data-type='taskList'] li { display: flex; gap: 8px; }
`;

const printHtml = (html: string, title: string): void => {
  const frame = document.createElement('iframe');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(`<!doctype html><html><head><meta charset="utf-8"><title>${title.replace(/</g, '&lt;')}</title><style>${PRINT_CSS}</style></head><body><div class="page">${html}</div></body></html>`);
  doc.close();
  // Wait for embedded pictures, then print; the frame is removed afterwards.
  setTimeout(() => {
    frame.contentWindow?.focus();
    frame.contentWindow?.print();
    setTimeout(() => frame.remove(), 1500);
  }, 400);
};


/** The My Documents page: the editor plus a title, autosave, Word download and print. */
export const DocumentEditor = ({ doc }: { doc: WorkspaceDocument }): JSX.Element => {
  const [title, setTitle] = useState(doc.title);
  const [state, setState] = useState<'saved' | 'dirty' | 'saving' | 'error'>('saved');
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [html, setHtml] = useState(doc.content);
  const editorRef = useRef<Editor | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef({ title: doc.title, html: doc.content });
  const dirty = useRef(false);
  const wordInput = useRef<HTMLInputElement>(null);

  const save = useCallback(async (): Promise<void> => {
    if (!dirty.current) return;
    dirty.current = false;
    setState('saving');
    try {
      await workspaceApi.update(doc.id, { title: latest.current.title.trim() || 'Untitled', content: latest.current.html });
      setSavedAt(new Date());
      setState(dirty.current ? 'dirty' : 'saved');
    } catch {
      dirty.current = true;
      setState('error');
    }
  }, [doc.id]);

  const schedule = useCallback((): void => {
    dirty.current = true;
    setState('dirty');
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void save(), 1500);
  }, [save]);

  // Keep what has been typed: save on the way out, and warn before closing the tab with unsaved changes.
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent): void => {
      if (dirty.current) e.preventDefault();
    };
    const onKey = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        void save();
      }
    };
    window.addEventListener('beforeunload', warn);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('beforeunload', warn);
      window.removeEventListener('keydown', onKey);
      if (timer.current) clearTimeout(timer.current);
      void save();
    };
  }, [save]);

  const importWord = useMutation({
    mutationFn: (file: File) => workspaceApi.importWord(file),
    onSuccess: (r) => {
      editorRef.current?.chain().focus().insertContent(r.html).run();
      toast.success('Word file added at the cursor');
      if (r.warnings[0]) toast.warning(`Some Word features could not be carried over: ${r.warnings[0]}`);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Could not import that file'),
  });

  const exportWord = useMutation({
    mutationFn: async () => {
      const editor = editorRef.current;
      if (!editor) return;
      const blob = await buildDocx(editor.getJSON() as DocNode, { title: latest.current.title, template: doc.template });
      downloadBlob(blob, `${(latest.current.title || 'document').replace(/[\\/:*?"<>|]+/g, '-')}.docx`);
    },
    onError: () => toast.error('Could not build the Word file'),
  });

  const statusText =
    state === 'saving' ? 'Saving…' : state === 'dirty' ? 'Unsaved changes' : state === 'error' ? 'Could not save — retrying on next change' : savedAt ? `Saved ${savedAt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Saved';

  return (
    <RichDocumentEditor
      value={html}
      onChange={(next) => {
        latest.current.html = next;
        setHtml(next);
        schedule();
      }}
      onEditor={(e) => {
        editorRef.current = e;
      }}
      topBar={
        <div className="flex flex-wrap items-center gap-3 border-b border-border px-3 py-2">
          <NextLink href="/workspace" className="inline-flex items-center gap-1 text-xs text-text-secondary hover:text-primary">
            <ArrowLeft className="h-3.5 w-3.5" /> My Documents
          </NextLink>
          <input
            value={title}
            onChange={(e) => {
              setTitle(e.target.value);
              latest.current.title = e.target.value;
              schedule();
            }}
            aria-label="Document title"
            className="min-w-[200px] flex-1 rounded border border-transparent px-2 py-1 text-base font-semibold text-text-primary hover:border-border focus:border-primary focus:outline-none"
          />
          <span className={`text-xs ${state === 'error' ? 'text-danger' : 'text-text-muted'}`}>{statusText}</span>
          <input ref={wordInput} type="file" accept=".docx" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) importWord.mutate(f); e.target.value = ''; }} />
          <Button size="sm" variant="secondary" leftIcon={<FileUp className="h-3.5 w-3.5" />} isLoading={importWord.isPending} onClick={() => wordInput.current?.click()}>Insert Word file</Button>
          <Button size="sm" variant="secondary" leftIcon={<Printer className="h-3.5 w-3.5" />} onClick={() => editorRef.current && printHtml(editorRef.current.getHTML(), title)}>Print / PDF</Button>
          <Button size="sm" leftIcon={<Download className="h-3.5 w-3.5" />} isLoading={exportWord.isPending} onClick={() => exportWord.mutate()}>Download Word</Button>
        </div>
      }
    />
  );
};
