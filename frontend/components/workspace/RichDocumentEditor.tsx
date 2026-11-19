'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useEditor, EditorContent, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import TextStyle from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import FontFamily from '@tiptap/extension-font-family';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import Placeholder from '@tiptap/extension-placeholder';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Table from '@tiptap/extension-table';
import TableRow from '@tiptap/extension-table-row';
import TableHeader from '@tiptap/extension-table-header';
import TableCell from '@tiptap/extension-table-cell';
import { toast } from 'sonner';
import {
  AlignCenter, AlignJustify, AlignLeft, AlignRight, ArrowLeft, Bold, Download, Eraser, FileUp, Highlighter, Image as ImageIcon,
  Indent, Italic, Link as LinkIcon, List, ListChecks, ListOrdered, Minus, Outdent, Printer, Quote, Redo2, Search,
  SeparatorHorizontal, Strikethrough, Subscript as SubIcon, Superscript as SupIcon, Table as TableIcon, Underline as UnderlineIcon, Undo2,
} from 'lucide-react';

import { Button } from '@/components/ui/Button';
import { DocImage, FontSize, PageBreak, Pagination, PAGE_WIDTH_PX, type ImageLayout } from './extensions';
import './editor.css';

const FONTS = ['Calibri', 'Corbel', 'Arial', 'Times New Roman', 'Georgia', 'Verdana', 'Courier New'];
const SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 24, 28, 32, 36, 48];

const Btn = ({ title, active, disabled, onClick, children }: { title: string; active?: boolean; disabled?: boolean; onClick: () => void; children: ReactNode }): JSX.Element => (
  <button
    type="button"
    title={title}
    aria-label={title}
    disabled={disabled}
    onMouseDown={(e) => e.preventDefault()}
    onClick={onClick}
    className={`inline-flex h-8 w-8 items-center justify-center rounded text-text-primary transition hover:bg-surface-alt disabled:opacity-40 ${active ? 'bg-primary/15 text-primary' : ''}`}
  >
    {children}
  </button>
);
const Sep = (): JSX.Element => <span className="mx-1 h-5 w-px bg-border" aria-hidden />;
const selectCls = 'h-8 rounded border border-border bg-white px-1.5 text-xs text-text-primary';

/** Photos from a phone can be several MB; keep pictures to a size that stays light inside the document. */
const readImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read that picture'));
    reader.onload = () => {
      const src = String(reader.result);
      if (file.type === 'image/gif' || file.type === 'image/svg+xml') return resolve(src);
      const img = new window.Image();
      img.onload = () => {
        const max = 1600;
        const scale = Math.min(1, max / img.naturalWidth);
        if (scale === 1 && file.size < 600_000) return resolve(src);
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.naturalWidth * scale);
        canvas.height = Math.round(img.naturalHeight * scale);
        canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88));
      };
      img.onerror = () => resolve(src);
      img.src = src;
    };
    reader.readAsDataURL(file);
  });

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

export interface RichDocumentEditorProps {
  /** The document as HTML. The editor owns what is typed; a changed `value` from outside replaces it. */
  value: string;
  onChange: (html: string) => void;
  readOnly?: boolean;
  /** Height of the editing area, e.g. "640px". Defaults to filling its container. */
  minHeight?: string;
  /** Shown above the toolbar (a title bar, save status, buttons). */
  topBar?: ReactNode;
  /** Gives the caller the editor, for actions such as download or print. */
  onEditor?: (editor: Editor | null) => void;
}

export const RichDocumentEditor = ({ value, onChange, readOnly = false, minHeight, topBar, onEditor }: RichDocumentEditorProps): JSX.Element => {
  const [words, setWords] = useState(0);
  const [pages, setPages] = useState(1);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [findOpen, setFindOpen] = useState(false);
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [findNote, setFindNote] = useState('');
  const imageInput = useRef<HTMLInputElement>(null);
  const [surfaceEl, setSurfaceEl] = useState<HTMLDivElement | null>(null);
  const lastEmitted = useRef(value);
  // View size: "fit" widens the page to the screen like a word processor; or a fixed percentage.
  const [zoomMode, setZoomMode] = useState<'fit' | number>('fit');
  const [fitZoom, setFitZoom] = useState(1);

  useEffect(() => {
    const el = surfaceEl;
    if (!el) return;
    const update = (): void => setFitZoom(Math.min(1.6, Math.max(0.5, (el.clientWidth - 48) / PAGE_WIDTH_PX)));
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [surfaceEl]);
  const zoom = zoomMode === 'fit' ? fitZoom : zoomMode;

  const extensions = useMemo(
    () => [
      StarterKit.configure({ heading: { levels: [1, 2, 3, 4] } }),
      Underline,
      Link.configure({ openOnClick: false, autolink: true }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle, Color, FontFamily, FontSize,
      Highlight.configure({ multicolor: true }),
      Subscript, Superscript,
      TaskList, TaskItem.configure({ nested: true }),
      Table.configure({ resizable: true }), TableRow, TableHeader, TableCell,
      DocImage.configure({ allowBase64: true }), PageBreak,
      Pagination.configure({ onPages: setPages }),
      Placeholder.configure({ placeholder: 'Start writing…' }),
    ],
    [],
  );

  const editor = useEditor({
    extensions,
    content: value,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: { attributes: { spellcheck: 'true' } },
    onUpdate: ({ editor: e }) => {
      const html = e.getHTML();
      lastEmitted.current = html;
      setWords(e.getText().trim().split(/\s+/).filter(Boolean).length);
      onChange(html);
    },
    onCreate: ({ editor: e }) => setWords(e.getText().trim().split(/\s+/).filter(Boolean).length),
  });

  useEffect(() => {
    onEditor?.(editor ?? null);
    return () => onEditor?.(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editor]);

  // A change that did not come from typing here (for example "re-sync findings") replaces the content.
  useEffect(() => {
    if (!editor || value === lastEmitted.current) return;
    lastEmitted.current = value;
    editor.commands.setContent(value, false);
  }, [value, editor]);

  useEffect(() => {
    editor?.setEditable(!readOnly);
  }, [editor, readOnly]);

  if (!editor) return <p className="p-6 text-sm text-text-muted">Loading editor…</p>;

  const chain = () => editor.chain().focus();
  const inTable = editor.isActive('table');
  const onImage = editor.isActive('image');
  const img = editor.getAttributes('image') as { layout?: ImageLayout; width?: number | null; x?: number; y?: number };
  const textStyle = editor.getAttributes('textStyle') as { fontFamily?: string; fontSize?: string; color?: string };
  const blockValue = editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : editor.isActive('heading', { level: 4 }) ? 'h4' : 'p';

  const setBlock = (v: string): void => {
    if (v === 'p') chain().setParagraph().run();
    else chain().setHeading({ level: Number(v.slice(1)) as 1 | 2 | 3 | 4 }).run();
  };
  const setImage = (attrs: Partial<{ layout: ImageLayout; width: number | null; x: number; y: number }>): void => {
    editor.chain().focus().updateAttributes('image', attrs).run();
  };
  const applyLink = (): void => {
    const href = linkUrl.trim();
    if (!href) chain().unsetLink().run();
    else chain().extendMarkRange('link').setLink({ href: /^(https?:|mailto:)/i.test(href) ? href : `https://${href}` }).run();
    setLinkOpen(false);
  };

  // Find and replace over the text of the document.
  const matches = (): Array<{ from: number; to: number }> => {
    const out: Array<{ from: number; to: number }> = [];
    if (!findText) return out;
    const needle = findText.toLowerCase();
    editor.state.doc.descendants((node, pos) => {
      if (!node.isText || !node.text) return;
      const hay = node.text.toLowerCase();
      let i = hay.indexOf(needle);
      while (i !== -1) {
        out.push({ from: pos + i, to: pos + i + needle.length });
        i = hay.indexOf(needle, i + needle.length);
      }
    });
    return out;
  };
  const findNext = (): void => {
    const all = matches();
    if (all.length === 0) return setFindNote('Not found');
    const cur = editor.state.selection.to;
    const next = all.find((m) => m.from >= cur) ?? all[0];
    editor.chain().focus().setTextSelection(next).scrollIntoView().run();
    setFindNote(`${all.length} found`);
  };
  const replaceOne = (): void => {
    const { from, to } = editor.state.selection;
    if (findText && editor.state.doc.textBetween(from, to).toLowerCase() === findText.toLowerCase()) {
      editor.chain().focus().insertContentAt({ from, to }, replaceText).run();
    }
    findNext();
  };
  const replaceAll = (): void => {
    const all = matches();
    if (all.length === 0) return setFindNote('Not found');
    const c = editor.chain().focus();
    [...all].reverse().forEach((m) => c.insertContentAt({ from: m.from, to: m.to }, replaceText));
    c.run();
    setFindNote(`${all.length} replaced`);
  };


  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-border bg-white" style={{ height: minHeight ?? 'calc(100vh - 7rem)' }}>
      {topBar}
      {/* Toolbar */}
      {!readOnly && (
      <div className="flex flex-wrap items-center gap-0.5 border-b border-border bg-surface-alt/60 px-2 py-1">
        <Btn title="Undo" disabled={!editor.can().undo()} onClick={() => chain().undo().run()}><Undo2 className="h-4 w-4" /></Btn>
        <Btn title="Redo" disabled={!editor.can().redo()} onClick={() => chain().redo().run()}><Redo2 className="h-4 w-4" /></Btn>
        <Sep />
        <select aria-label="Paragraph style" className={selectCls} value={blockValue} onChange={(e) => setBlock(e.target.value)}>
          <option value="p">Normal</option><option value="h1">Heading 1</option><option value="h2">Heading 2</option><option value="h3">Heading 3</option><option value="h4">Heading 4</option>
        </select>
        <select aria-label="Font" className={`${selectCls} ml-1 w-28`} value={FONTS.find((f) => textStyle.fontFamily?.includes(f)) ?? ''} onChange={(e) => (e.target.value ? chain().setFontFamily(e.target.value).run() : chain().unsetFontFamily().run())}>
          <option value="">Default</option>{FONTS.map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <select aria-label="Font size" className={`${selectCls} ml-1 w-16`} value={parseFloat(textStyle.fontSize ?? '') || ''} onChange={(e) => (e.target.value ? chain().setMark('textStyle', { fontSize: `${e.target.value}pt` }).run() : chain().setMark('textStyle', { fontSize: null }).run())}>
          <option value="">Size</option>{SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
        <Sep />
        <Btn title="Bold (Ctrl+B)" active={editor.isActive('bold')} onClick={() => chain().toggleBold().run()}><Bold className="h-4 w-4" /></Btn>
        <Btn title="Italic (Ctrl+I)" active={editor.isActive('italic')} onClick={() => chain().toggleItalic().run()}><Italic className="h-4 w-4" /></Btn>
        <Btn title="Underline (Ctrl+U)" active={editor.isActive('underline')} onClick={() => chain().toggleUnderline().run()}><UnderlineIcon className="h-4 w-4" /></Btn>
        <Btn title="Strikethrough" active={editor.isActive('strike')} onClick={() => chain().toggleStrike().run()}><Strikethrough className="h-4 w-4" /></Btn>
        <Btn title="Subscript" active={editor.isActive('subscript')} onClick={() => chain().toggleSubscript().run()}><SubIcon className="h-4 w-4" /></Btn>
        <Btn title="Superscript" active={editor.isActive('superscript')} onClick={() => chain().toggleSuperscript().run()}><SupIcon className="h-4 w-4" /></Btn>
        <label title="Text colour" className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded hover:bg-surface-alt">
          <span className="text-sm font-bold" style={{ color: textStyle.color ?? '#000' }}>A</span>
          <span className="absolute bottom-1 h-0.5 w-4 rounded" style={{ background: textStyle.color ?? '#000' }} />
          <input type="color" aria-label="Text colour" className="absolute inset-0 cursor-pointer opacity-0" value={textStyle.color && /^#[0-9a-f]{6}$/i.test(textStyle.color) ? textStyle.color : '#000000'} onChange={(e) => chain().setColor(e.target.value).run()} />
        </label>
        <label title="Highlight colour" className="relative inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded hover:bg-surface-alt">
          <Highlighter className="h-4 w-4" />
          <input type="color" aria-label="Highlight colour" className="absolute inset-0 cursor-pointer opacity-0" defaultValue="#ffff00" onChange={(e) => chain().setHighlight({ color: e.target.value }).run()} />
        </label>
        <Btn title="Clear formatting" onClick={() => chain().unsetAllMarks().clearNodes().run()}><Eraser className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Align left" active={editor.isActive({ textAlign: 'left' })} onClick={() => chain().setTextAlign('left').run()}><AlignLeft className="h-4 w-4" /></Btn>
        <Btn title="Centre" active={editor.isActive({ textAlign: 'center' })} onClick={() => chain().setTextAlign('center').run()}><AlignCenter className="h-4 w-4" /></Btn>
        <Btn title="Align right" active={editor.isActive({ textAlign: 'right' })} onClick={() => chain().setTextAlign('right').run()}><AlignRight className="h-4 w-4" /></Btn>
        <Btn title="Justify" active={editor.isActive({ textAlign: 'justify' })} onClick={() => chain().setTextAlign('justify').run()}><AlignJustify className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Bullet list" active={editor.isActive('bulletList')} onClick={() => chain().toggleBulletList().run()}><List className="h-4 w-4" /></Btn>
        <Btn title="Numbered list" active={editor.isActive('orderedList')} onClick={() => chain().toggleOrderedList().run()}><ListOrdered className="h-4 w-4" /></Btn>
        <Btn title="Checklist" active={editor.isActive('taskList')} onClick={() => chain().toggleTaskList().run()}><ListChecks className="h-4 w-4" /></Btn>
        <Btn title="Increase indent" onClick={() => (editor.isActive('taskItem') ? chain().sinkListItem('taskItem') : chain().sinkListItem('listItem')).run()}><Indent className="h-4 w-4" /></Btn>
        <Btn title="Decrease indent" onClick={() => (editor.isActive('taskItem') ? chain().liftListItem('taskItem') : chain().liftListItem('listItem')).run()}><Outdent className="h-4 w-4" /></Btn>
        <Btn title="Quote" active={editor.isActive('blockquote')} onClick={() => chain().toggleBlockquote().run()}><Quote className="h-4 w-4" /></Btn>
        <Sep />
        <Btn title="Insert table" onClick={() => chain().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}><TableIcon className="h-4 w-4" /></Btn>
        <input ref={imageInput} type="file" accept="image/*" className="hidden" onChange={async (e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (!f) return;
          try { chain().setImage({ src: await readImage(f), alt: f.name } as never).run(); } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not add the picture'); }
        }} />
        <Btn title="Insert picture" onClick={() => imageInput.current?.click()}><ImageIcon className="h-4 w-4" /></Btn>
        <Btn title="Link" active={editor.isActive('link')} onClick={() => { setLinkUrl((editor.getAttributes('link').href as string) ?? ''); setLinkOpen((v) => !v); }}><LinkIcon className="h-4 w-4" /></Btn>
        <Btn title="Horizontal line" onClick={() => chain().setHorizontalRule().run()}><Minus className="h-4 w-4" /></Btn>
        <Btn title="Page break" onClick={() => chain().insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run()}><SeparatorHorizontal className="h-4 w-4" /></Btn>
        <Btn title="Find and replace" active={findOpen} onClick={() => setFindOpen((v) => !v)}><Search className="h-4 w-4" /></Btn>
      </div>

      )}

      {linkOpen && (
        <div className="flex items-center gap-2 border-b border-border bg-white px-3 py-1.5 text-xs">
          <span className="text-text-secondary">Link to</span>
          <input autoFocus value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && applyLink()} placeholder="https://…" className="h-7 w-72 rounded border border-border px-2" />
          <Button size="sm" onClick={applyLink}>{linkUrl.trim() ? 'Apply' : 'Remove link'}</Button>
          <button type="button" className="text-text-muted hover:text-text-primary" onClick={() => setLinkOpen(false)}>Close</button>
        </div>
      )}

      {findOpen && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-white px-3 py-1.5 text-xs">
          <input value={findText} onChange={(e) => { setFindText(e.target.value); setFindNote(''); }} onKeyDown={(e) => e.key === 'Enter' && findNext()} placeholder="Find" className="h-7 w-44 rounded border border-border px-2" />
          <input value={replaceText} onChange={(e) => setReplaceText(e.target.value)} placeholder="Replace with" className="h-7 w-44 rounded border border-border px-2" />
          <Button size="sm" variant="secondary" onClick={findNext}>Find next</Button>
          <Button size="sm" variant="secondary" onClick={replaceOne}>Replace</Button>
          <Button size="sm" variant="secondary" onClick={replaceAll}>Replace all</Button>
          <span className="text-text-muted">{findNote}</span>
        </div>
      )}

      {/* Context strips: shown only when a table or a picture is selected */}
      {inTable && (
        <div className="flex flex-wrap items-center gap-1 border-b border-border bg-emerald-50 px-3 py-1 text-xs">
          <span className="font-medium text-text-secondary">Table:</span>
          {[
            ['Row above', () => chain().addRowBefore().run()], ['Row below', () => chain().addRowAfter().run()], ['Delete row', () => chain().deleteRow().run()],
            ['Column left', () => chain().addColumnBefore().run()], ['Column right', () => chain().addColumnAfter().run()], ['Delete column', () => chain().deleteColumn().run()],
            ['Merge cells', () => chain().mergeCells().run()], ['Split cell', () => chain().splitCell().run()], ['Header row', () => chain().toggleHeaderRow().run()], ['Delete table', () => chain().deleteTable().run()],
          ].map(([label, fn]) => (
            <button key={label as string} type="button" onMouseDown={(e) => e.preventDefault()} onClick={fn as () => void} className="rounded border border-border bg-white px-2 py-0.5 hover:border-primary">{label as string}</button>
          ))}
        </div>
      )}
      {onImage && (
        <div className="flex flex-wrap items-center gap-2 border-b border-border bg-emerald-50 px-3 py-1 text-xs">
          <span className="font-medium text-text-secondary">Picture:</span>
          <select aria-label="Picture position" className={selectCls} value={img.layout ?? 'inline'} onChange={(e) => setImage({ layout: e.target.value as ImageLayout })}>
            <option value="inline">In line with text</option><option value="behind">Behind text</option><option value="front">In front of text</option>
          </select>
          <label className="flex items-center gap-1">Width <input type="number" min={20} max={PAGE_WIDTH_PX} value={Math.round(img.width ?? 0) || ''} placeholder="auto" onChange={(e) => setImage({ width: Number(e.target.value) || null })} className="h-7 w-20 rounded border border-border px-1" /> px</label>
          {(img.layout ?? 'inline') !== 'inline' && (
            <>
              <label className="flex items-center gap-1">From left <input type="number" value={Math.round(img.x ?? 0)} onChange={(e) => setImage({ x: Number(e.target.value) || 0 })} className="h-7 w-20 rounded border border-border px-1" /> px</label>
              <label className="flex items-center gap-1">From top <input type="number" value={Math.round(img.y ?? 0)} onChange={(e) => setImage({ y: Number(e.target.value) || 0 })} className="h-7 w-20 rounded border border-border px-1" /> px</label>
              <button type="button" className="rounded border border-border bg-white px-2 py-0.5 hover:border-primary" onClick={() => setImage({ layout: 'behind', x: 0, y: 0, width: PAGE_WIDTH_PX })}>Fill the page (cover)</button>
              <button type="button" className="rounded border border-border bg-white px-2 py-0.5 hover:border-primary" onClick={() => setImage({ x: Math.max(0, Math.round((PAGE_WIDTH_PX - (img.width ?? 300)) / 2)) })}>Centre across</button>
            </>
          )}
          <button type="button" className="rounded border border-border bg-white px-2 py-0.5 text-danger hover:border-danger" onClick={() => chain().deleteSelection().run()}>Remove picture</button>
        </div>
      )}

      {/* The page */}
      <div className="doc-surface min-h-0 flex-1" ref={setSurfaceEl}>
        {/* The page is drawn at US Letter size and scaled to the screen, like a word processor's "fit width". */}
        <div style={{ zoom, width: PAGE_WIDTH_PX, margin: '0 auto' }}>
          <div className="doc-page">
            <EditorContent editor={editor as Editor} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-border bg-surface-alt/60 px-3 py-1 text-[11px] text-text-muted">
        <span>
          {pages} {pages === 1 ? 'page' : 'pages'} · {words.toLocaleString()} {words === 1 ? 'word' : 'words'}
        </span>
        <span className="flex items-center gap-1.5">
          View
          <select
            aria-label="Page size on screen"
            className="h-6 rounded border border-border bg-white px-1 text-[11px] text-text-primary"
            value={zoomMode === 'fit' ? 'fit' : String(zoomMode)}
            onChange={(e) => setZoomMode(e.target.value === 'fit' ? 'fit' : Number(e.target.value))}
          >
            <option value="fit">Fit width</option>
            <option value="0.75">75%</option>
            <option value="1">100%</option>
            <option value="1.25">125%</option>
            <option value="1.5">150%</option>
          </select>
          <span className="hidden sm:inline">· US Letter</span>
        </span>
      </div>
    </div>
  );
};
