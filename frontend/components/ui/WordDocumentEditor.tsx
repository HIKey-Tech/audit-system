'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Indent,
  Outdent,
  Table as TableIcon,
  Image as ImageIcon,
  Minus,
  Eraser,
  Save,
  FileText,
  Layout,
  Plus,
  Trash2,
  Type,
  Palette,
  Highlighter,
  Rows,
  Columns,
  Maximize2,
  Minimize2,
  FilePlus2,
} from 'lucide-react';
import { Button } from './Button';

export type PageMarginPreset = 'normal' | 'narrow' | 'moderate' | 'wide';

const MARGIN_CONFIG: Record<
  PageMarginPreset,
  { label: string; paddingClass: string; inches: string }
> = {
  normal: { label: 'Normal (1.0 in)', paddingClass: 'px-10 py-8 sm:px-14 sm:py-10', inches: '1.0"' },
  moderate: { label: 'Moderate (0.75 in)', paddingClass: 'px-7 py-6 sm:px-10 sm:py-8', inches: '0.75"' },
  narrow: { label: 'Narrow (0.5 in)', paddingClass: 'px-5 py-4 sm:px-6 sm:py-5', inches: '0.5"' },
  wide: { label: 'Wide (1.5 in)', paddingClass: 'px-12 py-10 sm:px-20 sm:py-12', inches: '1.5"' },
};

const FONT_FAMILIES = [
  { label: 'Calibri (Body)', value: 'Calibri, sans-serif' },
  { label: 'Inter', value: 'Inter, system-ui, sans-serif' },
  { label: 'Arial', value: 'Arial, Helvetica, sans-serif' },
  { label: 'Times New Roman', value: '"Times New Roman", Times, serif' },
  { label: 'Georgia', value: 'Georgia, serif' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
];

const FONT_SIZES = [
  { label: '10 pt', execSize: '2' },
  { label: '11 pt', execSize: '3' },
  { label: '12 pt', execSize: '3' },
  { label: '14 pt', execSize: '4' },
  { label: '16 pt', execSize: '5' },
  { label: '18 pt', execSize: '5' },
  { label: '24 pt', execSize: '6' },
];

export interface DocumentSectionTemplate {
  title: string;
  description?: string;
  placeholder?: string;
  content?: string;
  required?: boolean;
}

const escapeHtml = (str: string): string =>
  str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

/**
 * Convert plain text or basic markdown into clean HTML paragraphs, lists, and tables.
 */
export function plainOrMarkdownToHtml(text: string): string {
  const trimmed = (text ?? '').trim();
  if (!trimmed) return '<p><br /></p>';
  if (isRichHtml(trimmed)) return trimmed;

  const lines = trimmed.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inUl = false;
  let inOl = false;
  let tableRows: string[][] = [];

  const flushLists = () => {
    if (inUl) {
      htmlParts.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      htmlParts.push('</ol>');
      inOl = false;
    }
  };

  const flushTable = () => {
    if (tableRows.length === 0) return;
    const filtered = tableRows.filter(
      (r) => !r.every((cell) => /^[-:\s]+$/.test(cell)),
    );
    if (filtered.length > 0) {
      let tbl =
        '<table style="width:100%;border-collapse:collapse;margin:12px 0;font-size:13px;">';
      filtered.forEach((row, rIdx) => {
        tbl += '<tr>';
        row.forEach((cell) => {
          const tag = rIdx === 0 ? 'th' : 'td';
          const bg = rIdx === 0 ? 'background:#f8fafc;font-weight:600;color:#000000;' : '';
          tbl += `<${tag} style="border:1px solid #cbd5e1;padding:8px 10px;text-align:left;${bg}">${formatInlineMarkdown(cell.trim())}</${tag}>`;
        });
        tbl += '</tr>';
      });
      tbl += '</table>';
      htmlParts.push(tbl);
    }
    tableRows = [];
  };

  const formatInlineMarkdown = (line: string): string => {
    let out = escapeHtml(line);
    out = out.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    out = out.replace(/\*(.+?)\*/g, '<em>$1</em>');
    out = out.replace(/`(.+?)`/g, '<code style="background:#f1f5f9;padding:1px 4px;border-radius:3px;">$1</code>');
    return out;
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (line.startsWith('|') && line.endsWith('|')) {
      flushLists();
      const cells = line
        .slice(1, -1)
        .split('|')
        .map((c) => c.trim());
      tableRows.push(cells);
      continue;
    } else {
      flushTable();
    }

    if (!line) {
      flushLists();
      continue;
    }

    if (line.startsWith('### ')) {
      flushLists();
      htmlParts.push(`<h3>${formatInlineMarkdown(line.slice(4))}</h3>`);
    } else if (line.startsWith('## ')) {
      flushLists();
      htmlParts.push(`<h2>${formatInlineMarkdown(line.slice(3))}</h2>`);
    } else if (line.startsWith('# ')) {
      flushLists();
      htmlParts.push(`<h1>${formatInlineMarkdown(line.slice(2))}</h1>`);
    } else if (/^[-*•]\s+/.test(line)) {
      if (inOl) {
        htmlParts.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        htmlParts.push('<ul>');
        inUl = true;
      }
      htmlParts.push(`<li>${formatInlineMarkdown(line.replace(/^[-*•]\s+/, ''))}</li>`);
    } else if (/^\d+\.\s+/.test(line)) {
      if (inUl) {
        htmlParts.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        htmlParts.push('<ol>');
        inOl = true;
      }
      htmlParts.push(`<li>${formatInlineMarkdown(line.replace(/^\d+\.\s+/, ''))}</li>`);
    } else {
      flushLists();
      htmlParts.push(`<p>${formatInlineMarkdown(line)}</p>`);
    }
  }

  flushLists();
  flushTable();

  return htmlParts.join('\n') || '<p><br /></p>';
}

/**
 * Checks whether a string looks like HTML produced by WordDocumentEditor.
 */
export function isRichHtml(content: string | null | undefined): boolean {
  if (!content) return false;
  const trimmed = content.trim();
  return (
    trimmed.startsWith('<!-- page-margin:') ||
    /<(h1|h2|h3|p|table|ul|ol|div|img|blockquote|hr)\b/i.test(trimmed)
  );
}

/**
 * Converts template sections (or existing section array) into a cohesive Word HTML document
 * with numbered section headers (`<h2>`) and body paragraphs so the template's headers
 * appear directly inside the Word editor.
 */
export function sectionsToWordHtml(
  sections: DocumentSectionTemplate[],
  margin: PageMarginPreset = 'normal',
): string {
  if (!sections || sections.length === 0) {
    return `<!-- page-margin:${margin} -->\n<p><br /></p>`;
  }

  const parts: string[] = [`<!-- page-margin:${margin} -->`];
  sections.forEach((sec, idx) => {
    const rawTitle = (sec.title ?? '').trim();
    const numberedTitle =
      rawTitle && !/^\d+\./.test(rawTitle) && sections.length > 1
        ? `${idx + 1}. ${rawTitle}`
        : rawTitle;

    if (numberedTitle) {
      parts.push(
        `<h2 style="color:#000000;border-bottom:1px solid #e2e8f0;padding-bottom:4px;margin-top:18px;margin-bottom:8px;font-size:15px;font-weight:700;">${escapeHtml(numberedTitle)}</h2>`,
      );
    }
    if (sec.description && !sec.content?.trim()) {
      parts.push(
        `<p style="color:#475569;font-size:12px;font-style:italic;margin-bottom:6px;">${escapeHtml(sec.description)}</p>`,
      );
    }
    if (sec.content && sec.content.trim()) {
      parts.push(plainOrMarkdownToHtml(sec.content));
    } else if (sec.placeholder) {
      parts.push(`<p style="color:#000000;">${escapeHtml(sec.placeholder)}</p>`);
    } else {
      parts.push('<p><br /></p>');
    }
  });

  return parts.join('\n');
}

/**
 * Converts any stored working-paper content (JSON `{sections:[...]}`, Markdown, or HTML)
 * into rich Word HTML for editing or display.
 */
export function legacyContentToWordHtml(
  raw: string | null | undefined,
  fallbackTemplates?: DocumentSectionTemplate[],
): string {
  const trimmed = (raw ?? '').trim();
  if (!trimmed) {
    if (fallbackTemplates && fallbackTemplates.length > 0) {
      return sectionsToWordHtml(fallbackTemplates);
    }
    return '<!-- page-margin:normal -->\n<p><br /></p>';
  }

  if (isRichHtml(trimmed)) {
    return trimmed;
  }

  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed.sections)) {
      return sectionsToWordHtml(
        parsed.sections.map((s: { title?: string; content?: string }) => ({
          title: String(s.title ?? ''),
          content: String(s.content ?? ''),
        })),
      );
    }
  } catch {
    // Not JSON — fall through to markdown/plain text conversion
  }

  return `<!-- page-margin:normal -->\n${plainOrMarkdownToHtml(trimmed)}`;
}

/**
 * Parses a Word HTML document back into `{ title, content }[]` sections by splitting on `<h2>` / `<h1>`.
 */
export function wordHtmlToSections(
  html: string,
): { title: string; content: string }[] {
  const cleaned = (html ?? '').replace(/<!--\s*page-margin:\w+\s*-->/gi, '').trim();
  if (!cleaned) return [];

  const headingRegex = /<h[12][^>]*>([\s\S]*?)<\/h[12]>/gi;
  const matches = [...cleaned.matchAll(headingRegex)];
  if (matches.length === 0) {
    return [{ title: '', content: cleaned }];
  }

  const sections: { title: string; content: string }[] = [];
  matches.forEach((match, idx) => {
    const rawHeading = match[1].replace(/<[^>]+>/g, '').trim();
    const title = rawHeading.replace(/^\d+\.\s*/, '').trim() || rawHeading;
    const startIdx = (match.index ?? 0) + match[0].length;
    const endIdx = idx + 1 < matches.length ? (matches[idx + 1].index ?? cleaned.length) : cleaned.length;
    const bodyHtml = cleaned.slice(startIdx, endIdx).trim();
    sections.push({ title, content: bodyHtml });
  });

  return sections;
}

export function extractMarginFromHtml(html: string | null | undefined): PageMarginPreset {
  if (!html) return 'normal';
  const match = /<!--\s*page-margin:(normal|narrow|moderate|wide)\s*-->/i.exec(html);
  return (match?.[1]?.toLowerCase() as PageMarginPreset) ?? 'normal';
}

function stripMarginComment(html: string): string {
  return (html ?? '').replace(/<!--\s*page-margin:\w+\s*-->\n?/gi, '');
}

function injectMarginComment(html: string, margin: PageMarginPreset): string {
  const body = stripMarginComment(html);
  return `<!-- page-margin:${margin} -->\n${body}`;
}

export interface WordDocumentEditorProps {
  value: string;
  onChange: (html: string) => void;
  documentTitle?: string;
  engagementReference?: string;
  engagementTitle?: string;
  classification?: string;
  preparedBy?: string;
  status?: string;
  version?: number;
  readOnly?: boolean;
  onSaveDraft?: () => void;
  savingDraft?: boolean;
  minHeight?: string;
  showHeaderFooter?: boolean;
}

export const WordDocumentEditor: React.FC<WordDocumentEditorProps> = ({
  value,
  onChange,
  documentTitle = 'Audit Document',
  engagementReference = 'GBB-AUDIT',
  engagementTitle,
  classification = 'INTERNAL AUDIT CONFIDENTIAL',
  preparedBy,
  status = 'draft',
  version = 1,
  readOnly = false,
  onSaveDraft,
  savingDraft = false,
  minHeight = '560px',
  showHeaderFooter: initialShowHeaderFooter = true,
}) => {
  const editorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastEmittedRef = useRef<string>('');
  const isSyncingDomRef = useRef<boolean>(false);
  const savedInsertRangeRef = useRef<Range | null>(null);

  const [margin, setMargin] = useState<PageMarginPreset>(() => extractMarginFromHtml(value));
  const [fontFamily, setFontFamily] = useState<string>(FONT_FAMILIES[0].value);
  const [fontSize, setFontSize] = useState<string>('3');
  const [lineSpacing, setLineSpacing] = useState<string>('1.5');
  const [showHeaderFooter, setShowHeaderFooter] = useState<boolean>(initialShowHeaderFooter);
  const [showTableMenu, setShowTableMenu] = useState<boolean>(false);
  const [tableRows, setTableRows] = useState<number>(3);
  const [tableCols, setTableCols] = useState<number>(3);
  const [headerNote, setHeaderNote] = useState<string>('Galaxy Backbone Limited — Internal Audit Management System');
  const [footerNote, setFooterNote] = useState<string>(
    'Confidential — Property of Galaxy Backbone Limited. Unauthorized distribution is prohibited.',
  );
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);

  // Sync external `value` into the contentEditable DOM when it changes from outside
  useEffect(() => {
    const detectedMargin = extractMarginFromHtml(value);
    setMargin((prev) => (prev === detectedMargin ? prev : detectedMargin));
    if (!editorRef.current) return;
    if (value === lastEmittedRef.current) return;
    // Do not clobber the active contentEditable DOM while the user is actively typing
    if (document.activeElement === editorRef.current && lastEmittedRef.current !== '') {
      lastEmittedRef.current = value;
      return;
    }
    const targetHtml = stripMarginComment(value) || '<p><br /></p>';
    if (editorRef.current.innerHTML !== targetHtml) {
      isSyncingDomRef.current = true;
      editorRef.current.innerHTML = targetHtml;
      isSyncingDomRef.current = false;
    }
    lastEmittedRef.current = value;
  }, [value]);

  const emitChange = useCallback(
    (nextMargin?: PageMarginPreset) => {
      if (!editorRef.current || isSyncingDomRef.current) return;
      const activeMargin = nextMargin ?? margin;
      const fullHtml = injectMarginComment(editorRef.current.innerHTML, activeMargin);
      if (fullHtml === lastEmittedRef.current) return;
      lastEmittedRef.current = fullHtml;
      onChange(fullHtml);
    },
    [margin, onChange],
  );

  const clampSelectionAwayFromNextHeading = () => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    if (range.startContainer === range.endContainer) return;
    // Check if the selection end landed at offset 0 of a heading (H1/H2/H3)
    let endBlock: Node | null = range.endContainer;
    while (endBlock && endBlock !== editorRef.current && !/^(H1|H2|H3|P|DIV|LI|TABLE)$/i.test(endBlock.nodeName)) {
      endBlock = endBlock.parentNode;
    }
    let startBlock: Node | null = range.startContainer;
    while (startBlock && startBlock !== editorRef.current && !/^(H1|H2|H3|P|DIV|LI|TABLE)$/i.test(startBlock.nodeName)) {
      startBlock = startBlock.parentNode;
    }
    if (
      endBlock &&
      startBlock &&
      endBlock !== startBlock &&
      /^(H1|H2|H3)$/i.test(endBlock.nodeName) &&
      range.endOffset === 0 &&
      endBlock.previousSibling
    ) {
      const fixed = range.cloneRange();
      fixed.setEndAfter(endBlock.previousSibling);
      sel.removeAllRanges();
      sel.addRange(fixed);
    }
  };

  const execCmd = (command: string, arg?: string) => {
    if (readOnly) return;
    editorRef.current?.focus();
    document.execCommand(command, false, arg);
    emitChange();
  };

  const handleMarginChange = (next: PageMarginPreset) => {
    setMargin(next);
    emitChange(next);
  };

  const captureCollapsedCursor = () => {
    if (!editorRef.current) return;
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        const cloned = range.cloneRange();
        cloned.collapse(false);
        savedInsertRangeRef.current = cloned;
        if (!sel.isCollapsed) {
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
      }
    }
  };

  const collapseSelectionToEnd = () => {
    if (!editorRef.current) return;
    editorRef.current.focus();
    const sel = window.getSelection();
    if (!sel) return;
    if (sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current.contains(range.commonAncestorContainer)) {
        if (!range.collapsed) {
          range.collapse(false);
          sel.removeAllRanges();
          sel.addRange(range);
        }
        savedInsertRangeRef.current = null;
        return;
      }
    }
    if (savedInsertRangeRef.current && editorRef.current.contains(savedInsertRangeRef.current.commonAncestorContainer)) {
      const restored = savedInsertRangeRef.current.cloneRange();
      restored.collapse(false);
      sel.removeAllRanges();
      sel.addRange(restored);
      savedInsertRangeRef.current = null;
    }
  };

  const handleInsertTable = (rows: number, cols: number) => {
    if (readOnly) return;
    const rCount = Math.max(1, Math.min(20, rows));
    const cCount = Math.max(1, Math.min(10, cols));
    let tableHtml =
      '<table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;"><thead><tr>';
    for (let c = 0; c < cCount; c++) {
      tableHtml += `<th style="border:1px solid #94a3b8;background:#f8fafc;padding:8px 10px;text-align:left;font-weight:700;color:#000000;">Header ${c + 1}</th>`;
    }
    tableHtml += '</tr></thead><tbody>';
    for (let r = 0; r < rCount - 1; r++) {
      tableHtml += '<tr>';
      for (let c = 0; c < cCount; c++) {
        tableHtml +=
          '<td style="border:1px solid #cbd5e1;padding:8px 10px;min-width:60px;">&nbsp;</td>';
      }
      tableHtml += '</tr>';
    }
    tableHtml += '</tbody></table><p><br /></p>';
    collapseSelectionToEnd();
    execCmd('insertHTML', tableHtml);
    setShowTableMenu(false);
  };

  const findClosestCellAndTable = (): {
    cell: HTMLTableCellElement | null;
    row: HTMLTableRowElement | null;
    table: HTMLTableElement | null;
  } => {
    const sel = window.getSelection();
    if (!sel || !sel.anchorNode) return { cell: null, row: null, table: null };
    let node: Node | null = sel.anchorNode;
    let cell: HTMLTableCellElement | null = null;
    let row: HTMLTableRowElement | null = null;
    let table: HTMLTableElement | null = null;
    while (node && node !== editorRef.current) {
      if (node.nodeName === 'TD' || node.nodeName === 'TH') cell = node as HTMLTableCellElement;
      if (node.nodeName === 'TR') row = node as HTMLTableRowElement;
      if (node.nodeName === 'TABLE') {
        table = node as HTMLTableElement;
        break;
      }
      node = node.parentNode;
    }
    return { cell, row, table };
  };

  const handleAddTableRow = () => {
    const { row, table } = findClosestCellAndTable();
    if (!table) return;
    const targetRow = row ?? table.rows[table.rows.length - 1];
    if (!targetRow) return;
    const cols = targetRow.cells.length || 2;
    const newRow = table.insertRow(targetRow.rowIndex + 1);
    for (let c = 0; c < cols; c++) {
      const td = newRow.insertCell(c);
      td.style.cssText = 'border:1px solid #cbd5e1;padding:8px 10px;min-width:60px;';
      td.innerHTML = '&nbsp;';
    }
    emitChange();
  };

  const handleAddTableColumn = () => {
    const { table } = findClosestCellAndTable();
    if (!table) return;
    Array.from(table.rows).forEach((r, idx) => {
      const isHeader = idx === 0 && r.parentElement?.tagName === 'THEAD';
      const cell = isHeader ? document.createElement('th') : r.insertCell(-1);
      if (isHeader) {
        cell.style.cssText =
          'border:1px solid #94a3b8;background:#f8fafc;padding:8px 10px;text-align:left;font-weight:700;color:#000000;';
        cell.textContent = `Header ${r.cells.length + 1}`;
        r.appendChild(cell);
      } else {
        cell.style.cssText = 'border:1px solid #cbd5e1;padding:8px 10px;min-width:60px;';
        cell.innerHTML = '&nbsp;';
      }
    });
    emitChange();
  };

  const handleDeleteTableRow = () => {
    const { row, table } = findClosestCellAndTable();
    if (!table || !row) return;
    if (table.rows.length <= 1) {
      table.remove();
    } else {
      table.deleteRow(row.rowIndex);
    }
    emitChange();
  };

  const handleDeleteTable = () => {
    const { table } = findClosestCellAndTable();
    if (!table) return;
    table.remove();
    emitChange();
  };

  const handleImageFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const rawDataUrl = reader.result as string;
      const img = new window.Image();
      img.onload = () => {
        const maxWidth = 760;
        let targetW = img.width;
        let targetH = img.height;
        if (targetW > maxWidth) {
          const ratio = maxWidth / targetW;
          targetW = maxWidth;
          targetH = Math.round(targetH * ratio);
        }
        const canvas = document.createElement('canvas');
        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        let finalDataUrl = rawDataUrl;
        if (ctx) {
          ctx.drawImage(img, 0, 0, targetW, targetH);
          finalDataUrl = canvas.toDataURL('image/png', 0.9);
        }
        const imgHtml = `<p style="margin:12px 0;"><img src="${finalDataUrl}" alt="${escapeHtml(file.name)}" style="max-width:100%;height:auto;border:1px solid #e2e8f0;border-radius:4px;padding:2px;" /></p><p><br /></p>`;
        if (editorRef.current) {
          collapseSelectionToEnd();
          const success = document.execCommand('insertHTML', false, imgHtml);
          if (!success) {
            editorRef.current.innerHTML += imgHtml;
          }
          emitChange();
        }
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const handleInsertPageBreak = () => {
    if (readOnly) return;
    const breakHtml = '<p><br /></p><hr data-page-break="true" /><p><br /></p>';
    collapseSelectionToEnd();
    execCmd('insertHTML', breakHtml);
    emitChange();
  };

  const handleEditorKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    clampSelectionAwayFromNextHeading();
    // Ctrl+Enter or Cmd+Enter to create a new page (Page Break)
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      handleInsertPageBreak();
    }
  };

  // Compute word count and page estimate from plain text & page breaks
  const plainText = stripMarginComment(value)
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const wordCount = plainText ? plainText.split(' ').length : 0;
  const charCount = plainText.length;
  const pageBreakCount = (value.match(/data-page-break="true"/g) || []).length;
  const estimatedPages = Math.max(1, Math.ceil(wordCount / 350));
  const pageCount = Math.max(pageBreakCount + 1, estimatedPages);

  return (
    <div
      className={
        isFullscreen
          ? 'fixed inset-0 z-50 flex flex-col bg-slate-100 h-screen w-screen rounded-none border-0 shadow-2xl overflow-hidden'
          : 'flex flex-col rounded-lg border border-slate-300 bg-slate-100 shadow-sm overflow-hidden flex-1 h-full min-h-0'
      }
    >
      {/* Microsoft Word-style Ribbon Toolbar */}
      {!readOnly && (
        <div className="border-b border-slate-300 bg-white px-3 py-2 space-y-2">
          {/* Top Ribbon Tab Indicator & Quick Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-1.5">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 rounded bg-[#1E3A8A] px-2.5 py-0.5 text-[11px] font-semibold text-white">
                <FileText className="h-3 w-3" /> Word Document Editor
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Rich formatting, tables, margins, headers &amp; inline images
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowHeaderFooter((v) => !v)}
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                  showHeaderFooter
                    ? 'border-blue-200 bg-blue-50 text-blue-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                title="Toggle Document Header & Footer Preview"
              >
                <Layout className="h-3 w-3" />
                Header &amp; Footer
              </button>
              <button
                type="button"
                onClick={() => setIsFullscreen((v) => !v)}
                className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-[11px] font-medium transition-colors ${
                  isFullscreen
                    ? 'border-indigo-200 bg-indigo-50 text-indigo-800'
                    : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                }`}
                title={isFullscreen ? 'Exit Fullscreen' : 'Enter Fullscreen Document Mode'}
              >
                {isFullscreen ? (
                  <>
                    <Minimize2 className="h-3 w-3" />
                    <span>Exit Fullscreen</span>
                  </>
                ) : (
                  <>
                    <Maximize2 className="h-3 w-3" />
                    <span>Fullscreen Studio</span>
                  </>
                )}
              </button>
              {onSaveDraft && (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  leftIcon={<Save className="h-3.5 w-3.5" />}
                  onClick={onSaveDraft}
                  isLoading={savingDraft}
                >
                  Save as Draft
                </Button>
              )}
            </div>
          </div>

          {/* Main Formatting Controls Row */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {/* Heading / Block Style */}
            <select
              aria-label="Paragraph Style"
              onChange={(e) => {
                if (e.target.value) execCmd('formatBlock', e.target.value);
              }}
              defaultValue="P"
              className="h-7 rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-primary focus:outline-none"
            >
              <option value="P">Normal Text</option>
              <option value="H1">Heading 1</option>
              <option value="H2">Heading 2 (Section)</option>
              <option value="H3">Heading 3 (Sub-section)</option>
              <option value="BLOCKQUOTE">Quote / Callout</option>
            </select>

            {/* Font Family */}
            <select
              aria-label="Font Family"
              value={fontFamily}
              onChange={(e) => {
                setFontFamily(e.target.value);
                execCmd('fontName', e.target.value);
              }}
              className="h-7 max-w-[130px] rounded border border-slate-200 bg-white px-2 text-xs text-slate-700 focus:border-primary focus:outline-none"
            >
              {FONT_FAMILIES.map((f) => (
                <option key={f.label} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>

            {/* Font Size */}
            <select
              aria-label="Font Size"
              value={fontSize}
              onChange={(e) => {
                setFontSize(e.target.value);
                execCmd('fontSize', e.target.value);
              }}
              className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-primary focus:outline-none"
            >
              {FONT_SIZES.map((s) => (
                <option key={s.label} value={s.execSize}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="h-5 w-px bg-slate-200 mx-0.5" />

            {/* Bold / Italic / Underline / Strike */}
            <button
              type="button"
              onClick={() => execCmd('bold')}
              title="Bold (Ctrl+B)"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Bold className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('italic')}
              title="Italic (Ctrl+I)"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Italic className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('underline')}
              title="Underline (Ctrl+U)"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Underline className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('strikeThrough')}
              title="Strikethrough"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Strikethrough className="h-3.5 w-3.5" />
            </button>

            {/* Text Color & Highlight */}
            <label
              title="Text Color"
              className="inline-flex h-7 cursor-pointer items-center gap-0.5 rounded border border-transparent px-1.5 hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Palette className="h-3.5 w-3.5 text-slate-800" />
              <input
                type="color"
                defaultValue="#000000"
                onChange={(e) => execCmd('foreColor', e.target.value)}
                className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <label
              title="Highlight Color"
              className="inline-flex h-7 cursor-pointer items-center gap-0.5 rounded border border-transparent px-1.5 hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Highlighter className="h-3.5 w-3.5 text-amber-500" />
              <input
                type="color"
                defaultValue="#fef08a"
                onChange={(e) => execCmd('hiliteColor', e.target.value)}
                className="h-4 w-4 cursor-pointer border-0 bg-transparent p-0"
              />
            </label>
            <button
              type="button"
              onClick={() => execCmd('removeFormat')}
              title="Clear Formatting"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Eraser className="h-3.5 w-3.5" />
            </button>

            <div className="h-5 w-px bg-slate-200 mx-0.5" />

            {/* Alignment */}
            <button
              type="button"
              onClick={() => execCmd('justifyLeft')}
              title="Align Left"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyCenter')}
              title="Align Center"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyRight')}
              title="Align Right"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('justifyFull')}
              title="Justify"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <AlignJustify className="h-3.5 w-3.5" />
            </button>

            <div className="h-5 w-px bg-slate-200 mx-0.5" />

            {/* Lists & Indentation */}
            <button
              type="button"
              onClick={() => execCmd('insertUnorderedList')}
              title="Bullet List"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <List className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('insertOrderedList')}
              title="Numbered List (1. 2. 3.)"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <ListOrdered className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('outdent')}
              title="Decrease Indent"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Outdent className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => execCmd('indent')}
              title="Increase Indent"
              className="inline-flex h-7 w-7 items-center justify-center rounded border border-transparent hover:border-slate-200 hover:bg-slate-100 text-slate-700"
            >
              <Indent className="h-3.5 w-3.5" />
            </button>

            <div className="h-5 w-px bg-slate-200 mx-0.5" />

            {/* Page Margins Selector */}
            <div className="inline-flex items-center gap-1">
              <span className="text-[11px] font-medium text-slate-500">Margins:</span>
              <select
                aria-label="Page Margins"
                value={margin}
                onChange={(e) => handleMarginChange(e.target.value as PageMarginPreset)}
                className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-primary focus:outline-none"
              >
                {(Object.keys(MARGIN_CONFIG) as PageMarginPreset[]).map((mKey) => (
                  <option key={mKey} value={mKey}>
                    {MARGIN_CONFIG[mKey].label}
                  </option>
                ))}
              </select>
            </div>

            {/* Line Spacing */}
            <div className="inline-flex items-center gap-1">
              <Type className="h-3.5 w-3.5 text-slate-400" />
              <select
                aria-label="Line Spacing"
                value={lineSpacing}
                onChange={(e) => setLineSpacing(e.target.value)}
                title="Line Spacing"
                className="h-7 rounded border border-slate-200 bg-white px-1.5 text-xs text-slate-700 focus:border-primary focus:outline-none"
              >
                <option value="1.15">1.15x</option>
                <option value="1.5">1.5x</option>
                <option value="1.75">1.75x</option>
                <option value="2.0">2.0x</option>
              </select>
            </div>

            <div className="h-5 w-px bg-slate-200 mx-0.5" />

            {/* Insert Table Popover */}
            <div className="relative">
              <button
                type="button"
                onMouseDown={captureCollapsedCursor}
                onClick={() => setShowTableMenu((v) => !v)}
                className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
              >
                <TableIcon className="h-3.5 w-3.5 text-primary" />
                Table
              </button>
              {showTableMenu && (
                <div className="absolute left-0 top-full z-30 mt-1 w-64 rounded-md border border-slate-200 bg-white p-3 shadow-lg space-y-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Insert Table
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      [2, 2],
                      [3, 3],
                      [4, 4],
                      [5, 4],
                    ].map(([r, c]) => (
                      <button
                        key={`${r}x${c}`}
                        type="button"
                        onClick={() => handleInsertTable(r, c)}
                        className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700 hover:border-primary hover:bg-blue-50"
                      >
                        {r} × {c}
                      </button>
                    ))}
                  </div>
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <label className="text-[11px] text-slate-600">
                      Rows:
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={tableRows}
                        onChange={(e) => setTableRows(Number(e.target.value) || 2)}
                        className="ml-1 w-12 rounded border border-slate-200 px-1 py-0.5 text-xs"
                      />
                    </label>
                    <label className="text-[11px] text-slate-600">
                      Cols:
                      <input
                        type="number"
                        min={1}
                        max={10}
                        value={tableCols}
                        onChange={(e) => setTableCols(Number(e.target.value) || 2)}
                        className="ml-1 w-12 rounded border border-slate-200 px-1 py-0.5 text-xs"
                      />
                    </label>
                    <button
                      type="button"
                      onClick={() => handleInsertTable(tableRows, tableCols)}
                      className="ml-auto rounded bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary/90"
                    >
                      Insert
                    </button>
                  </div>
                  <div className="border-t border-slate-100 pt-2 space-y-1">
                    <p className="text-[10px] font-semibold uppercase text-slate-400">
                      Active Table Tools (click inside table first)
                    </p>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        type="button"
                        onClick={handleAddTableRow}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                      >
                        <Rows className="h-3 w-3" /> + Row Below
                      </button>
                      <button
                        type="button"
                        onClick={handleAddTableColumn}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-slate-700 hover:bg-slate-50"
                      >
                        <Columns className="h-3 w-3" /> + Column
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteTableRow}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" /> Delete Row
                      </button>
                      <button
                        type="button"
                        onClick={handleDeleteTable}
                        className="inline-flex items-center gap-1 rounded border border-slate-200 px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                      >
                        <Trash2 className="h-3 w-3" /> Delete Table
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Insert Image */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Insert Inline Image (appends into document & exports to PDF/DOCX)"
              className="inline-flex h-7 items-center gap-1 rounded border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              <ImageIcon className="h-3.5 w-3.5 text-emerald-600" />
              Insert Image
            </button>

            {/* Insert Page Break */}
            <button
              type="button"
              onClick={handleInsertPageBreak}
              title="Insert Page Break (Creates Page 2 / Ctrl+Enter)"
              className="inline-flex h-7 items-center gap-1 rounded border border-blue-200 bg-blue-50/70 px-2 text-xs font-semibold text-[#1E3A8A] hover:bg-blue-100 transition-colors"
            >
              <FilePlus2 className="h-3.5 w-3.5 text-[#1E3A8A]" />
              Page Break
            </button>
          </div>
        </div>
      )}

      {/* Horizontal Ruler Bar */}
      <div className="hidden sm:flex items-center justify-between border-b border-slate-200 bg-slate-200/70 px-8 py-0.5 text-[9px] font-mono text-slate-400 select-none">
        <span>0&quot;</span>
        <span>1&quot;</span>
        <span>2&quot;</span>
        <span>3&quot;</span>
        <span>4&quot;</span>
        <span>5&quot;</span>
        <span>6&quot;</span>
        <span>7&quot;</span>
        <span>8.27&quot; (A4)</span>
      </div>

      {/* Scrollable Gray Desk Canvas with A4 Paper Sheet */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100">
        <style>{`
          .word-editor-surface hr[data-page-break="true"] {
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            height: 48px !important;
            margin: 36px -48px !important;
            background-color: #f1f5f9 !important;
            border: none !important;
            border-top: 2px dashed #94a3b8 !important;
            border-bottom: 2px dashed #94a3b8 !important;
            position: relative !important;
            user-select: none !important;
            cursor: pointer !important;
          }
          .word-editor-surface hr[data-page-break="true"]::after {
            content: "📄 PAGE BREAK · NEXT PAGE (Ctrl+Enter)" !important;
            font-size: 11px !important;
            font-weight: 700 !important;
            letter-spacing: 0.06em !important;
            color: #1e3a8a !important;
            background: #ffffff !important;
            padding: 3px 14px !important;
            border-radius: 9999px !important;
            border: 1px solid #93c5fd !important;
            box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08) !important;
          }
          @media (max-width: 768px) {
            .word-editor-surface hr[data-page-break="true"] {
              margin: 28px -16px !important;
            }
          }
        `}</style>
        <div
          className={`mx-auto w-full max-w-[820px] rounded-sm border border-slate-300 bg-white shadow-[0_4px_20px_rgba(15,23,42,0.08)] transition-all ${MARGIN_CONFIG[margin].paddingClass}`}
          style={{ fontFamily, lineHeight: lineSpacing }}
        >
          {/* Official GBB Document Header */}
          {showHeaderFooter && (
            <div className="mb-6 border-b-2 border-[#1E3A8A] pb-4 select-none">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-2">
                {!readOnly ? (
                  <input
                    type="text"
                    value={headerNote}
                    onChange={(e) => setHeaderNote(e.target.value)}
                    className="flex-1 min-w-[280px] border-b border-transparent bg-transparent text-[10px] font-semibold uppercase tracking-wider text-slate-500 focus:border-slate-300 focus:outline-none"
                    title="Click to customize running header note"
                  />
                ) : (
                  <span className="flex-1 min-w-[280px]">{headerNote}</span>
                )}
                <span className="shrink-0 rounded bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-700 border border-red-200">
                  {classification}
                </span>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-1">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/gbb-logo.png"
                    alt="Galaxy Backbone Limited"
                    className="h-12 w-auto object-contain"
                  />
                  <div>
                    <div className="text-xs font-bold uppercase tracking-wide text-slate-800">
                      Galaxy Backbone Limited
                    </div>
                    <div className="text-sm font-extrabold text-[#1E3A8A]">
                      {documentTitle || 'Untitled Audit Document'}
                    </div>
                    {engagementTitle && (
                      <div className="text-[11px] text-slate-500">
                        Engagement: {engagementReference} — {engagementTitle}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-right text-[11px] text-slate-500 space-y-0.5">
                  <div>
                    <span className="font-semibold text-slate-700">Ref:</span> {engagementReference}
                  </div>
                  {preparedBy && (
                    <div>
                      <span className="font-semibold text-slate-700">Author:</span> {preparedBy}
                    </div>
                  )}
                  <div>
                    <span className="font-semibold text-slate-700">Version:</span> v{version}.0 ·{' '}
                    <span className="uppercase font-semibold">{status}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Editable Word Document Surface */}
          <div
            ref={editorRef}
            contentEditable={!readOnly}
            suppressContentEditableWarning
            onMouseUp={clampSelectionAwayFromNextHeading}
            onKeyDown={handleEditorKeyDown}
            onInput={() => emitChange()}
            onBlur={() => emitChange()}
            style={{ minHeight }}
            className="word-editor-surface prose prose-slate max-w-none text-sm text-black focus:outline-none [&_*]:text-black [&_h1]:text-xl [&_h1]:font-bold [&_h1]:text-black [&_h1]:mt-4 [&_h1]:mb-2 [&_h2]:text-base [&_h2]:font-bold [&_h2]:text-black [&_h2]:border-b [&_h2]:border-slate-300 [&_h2]:pb-1 [&_h2]:mt-5 [&_h2]:mb-2 [&_h3]:text-sm [&_h3]:font-semibold [&_h3]:text-black [&_h3]:mt-3 [&_h3]:mb-1 [&_p]:my-2 [&_p]:text-black [&_ul]:list-disc [&_ul]:pl-6 [&_ul]:my-2 [&_ol]:list-decimal [&_ol]:pl-6 [&_ol]:my-2 [&_blockquote]:border-l-4 [&_blockquote]:border-slate-700 [&_blockquote]:bg-slate-50 [&_blockquote]:pl-3 [&_blockquote]:py-1 [&_blockquote]:italic [&_blockquote]:text-black [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-300 [&_th]:bg-slate-100 [&_th]:text-black [&_th]:p-2 [&_td]:border [&_td]:border-slate-300 [&_td]:text-black [&_td]:p-2 [&_img]:max-w-full [&_img]:rounded"
          />

          {/* Official GBB Document Footer */}
          {showHeaderFooter && (
            <div className="mt-10 border-t border-slate-200 pt-3 flex flex-wrap items-center justify-between gap-2 text-[10px] text-slate-400 select-none">
              {!readOnly ? (
                <input
                  type="text"
                  value={footerNote}
                  onChange={(e) => setFooterNote(e.target.value)}
                  className="flex-1 min-w-[280px] border-b border-transparent bg-transparent text-[10px] text-slate-400 focus:border-slate-300 focus:outline-none"
                  title="Click to customize running footer note"
                />
              ) : (
                <span className="flex-1 min-w-[280px]">{footerNote}</span>
              )}
              <span className="shrink-0 font-medium">
                {engagementReference} · Page 1 of {pageCount}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Word Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-300 bg-[#1E3A8A] px-3 py-1.5 text-[11px] text-white">
        <div className="flex items-center gap-3">
          <span className="font-semibold">
            Page 1 of {pageCount}
          </span>
          <span className="text-blue-200">
            ({wordCount} {wordCount === 1 ? 'word' : 'words'}, {charCount} chars)
          </span>
          {!readOnly && (
            <button
              type="button"
              onClick={handleInsertPageBreak}
              className="inline-flex items-center gap-1 rounded bg-white/15 hover:bg-white/25 px-2 py-0.5 text-[10px] font-semibold text-white transition-colors"
              title="Insert Page Break (creates Page 2 / Ctrl+Enter)"
            >
              <FilePlus2 className="h-3 w-3" />
              + Add Page Break (Ctrl+Enter)
            </button>
          )}
          <span className="hidden sm:inline text-blue-200">
            Margins: {MARGIN_CONFIG[margin].inches}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-blue-200">
            {readOnly ? 'Read-Only Print Layout' : 'Print Layout · Ready'}
          </span>
        </div>
      </div>
    </div>
  );
};
