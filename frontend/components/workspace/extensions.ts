import { Extension, Node, mergeAttributes } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Decoration, DecorationSet } from '@tiptap/pm/view';
import Image from '@tiptap/extension-image';

/** US Letter at 96 dpi: the page the editor draws and the Word export uses. */
export const PAGE_WIDTH_PX = 816;
export const PAGE_HEIGHT_PX = 1056;

export type ImageLayout = 'inline' | 'behind' | 'front';

/** Font size in points, stored on the text style so it survives copy, paste and export. */
export const FontSize = Extension.create({
  name: 'fontSize',
  addGlobalAttributes() {
    return [
      {
        types: ['textStyle'],
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => (el as HTMLElement).style.fontSize || null,
            renderHTML: (attrs) => (attrs.fontSize ? { style: `font-size: ${attrs.fontSize}` } : {}),
          },
        },
      },
    ];
  },
});

/**
 * A manual page break: the next content starts on a new page, in the editor, in print and in Word. It is stored as
 * `<hr data-page-break="true">`, the same marker the report and working paper documents already use.
 */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'hr[data-page-break]', priority: 100 }, { tag: 'div[data-page-break]', priority: 100 }],
  renderHTML: () => ['hr', { 'data-page-break': 'true', class: 'page-break' }],
  // Ctrl/Cmd+Enter starts a new page, as in Word. An empty line follows so typing continues on the new page.
  addKeyboardShortcuts() {
    return {
      'Mod-Enter': () => this.editor.chain().focus().insertContent([{ type: 'pageBreak' }, { type: 'paragraph' }]).run(),
    };
  },
});

/** Geometry of the page the editor draws: US Letter at 96 dpi with 1 inch margins. */
const PAGE_MARGIN = 96;
const CONTENT_HEIGHT = PAGE_HEIGHT_PX - 2 * PAGE_MARGIN;
const PAGE_GAP = 28;

const pageGap = (remaining: number, page: number): HTMLElement => {
  const el = document.createElement('div');
  el.className = 'page-gap';
  el.contentEditable = 'false';
  el.style.height = `${remaining + PAGE_MARGIN + PAGE_GAP + PAGE_MARGIN}px`;
  el.innerHTML =
    `<div class="page-gap-foot" style="height:${remaining + PAGE_MARGIN}px"><span>Page ${page}</span></div>` +
    `<div class="page-gap-cut"></div><div style="height:${PAGE_MARGIN}px"></div>`;
  return el;
};

/**
 * Shows where one page ends and the next begins, like a word processor: content that would run past the bottom of a
 * page moves to the top of the next one, with the page edge and its number drawn between them. The break is only a
 * visual spacer: it is never saved in the document, so the text itself is unchanged.
 */
export const Pagination = Extension.create<{ onPages?: (pages: number) => void }>({
  name: 'pagination',
  addOptions() {
    return { onPages: undefined };
  },
  addProseMirrorPlugins() {
    const key = new PluginKey<DecorationSet>('pagination');
    const onPages = this.options.onPages;
    return [
      new Plugin({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => (tr.getMeta(key) as DecorationSet | undefined) ?? set.map(tr.mapping, tr.doc),
        },
        props: { decorations: (state) => key.getState(state) },
        view: (view) => {
          let timer: ReturnType<typeof setTimeout> | undefined;
          let last = '';
          const measure = (): void => {
            if (!view.dom.isConnected) return;
            const padTop = parseFloat(getComputedStyle(view.dom).paddingTop) || PAGE_MARGIN;
            // Spacers already inserted push later blocks down; take them out to get each block's natural position.
            let shift = 0;
            const natural = new Map<HTMLElement, number>();
            for (const child of [...view.dom.children] as HTMLElement[]) {
              if (child.classList.contains('page-gap')) shift += child.offsetHeight;
              else natural.set(child, child.offsetTop - shift - padTop);
            }
            const widgets: Decoration[] = [];
            let pageStart = 0;
            let page = 1;
            let prevBottom = 0;
            view.state.doc.forEach((node, offset) => {
              const el = view.nodeDOM(offset) as HTMLElement | null;
              if (!el || el.nodeType !== 1 || !natural.has(el)) return;
              const y0 = natural.get(el) ?? 0;
              const y1 = y0 + el.offsetHeight;
              if (node.type.name !== 'pageBreak' && y0 > pageStart && y1 - pageStart > CONTENT_HEIGHT) {
                const remaining = Math.max(0, CONTENT_HEIGHT - (prevBottom - pageStart));
                const ending = page;
                widgets.push(
                  Decoration.widget(offset, () => pageGap(remaining, ending), { side: -1, key: `g${offset}:${Math.round(remaining)}:${ending}` }),
                );
                pageStart = y0;
                page += 1;
              }
              if (node.type.name === 'pageBreak') {
                const remaining = Math.max(0, CONTENT_HEIGHT - (y1 - pageStart));
                const ending = page;
                widgets.push(
                  Decoration.widget(offset + node.nodeSize, () => pageGap(remaining, ending), { side: -1, key: `b${offset}:${Math.round(remaining)}:${ending}` }),
                );
                pageStart = y1;
                page += 1;
              }
              prevBottom = y1;
            });
            view.dom.style.minHeight = `${page * PAGE_HEIGHT_PX + (page - 1) * PAGE_GAP}px`;
            onPages?.(page);
            const signature = widgets.map((w) => (w.spec as { key: string }).key).join('|');
            if (signature === last) return;
            last = signature;
            view.dispatch(view.state.tr.setMeta(key, DecorationSet.create(view.state.doc, widgets)));
          };
          const schedule = (delay = 120): void => {
            if (timer) clearTimeout(timer);
            timer = setTimeout(measure, delay);
          };
          schedule(250);
          // Pictures and fonts can change heights after the first paint.
          const late = setTimeout(measure, 1200);
          return {
            update: (v, prev) => {
              if (!prev.doc.eq(v.state.doc)) schedule();
            },
            destroy: () => {
              if (timer) clearTimeout(timer);
              clearTimeout(late);
            },
          };
        },
      }),
    ];
  },
});

const positioned = (layout: string, x: number, y: number, width: number | null): string => {
  if (layout === 'inline') return '';
  return `position:absolute;left:${x}px;top:${y}px;z-index:${layout === 'behind' ? -1 : 2};${width ? `width:${width}px;` : ''}max-width:none;`;
};

/**
 * A picture that can sit in the line of text, behind the text, or in front of it. "Behind" is how a cover image or
 * watermark works in Word: the picture is placed on the page and the text is typed on top of it.
 * x and y are pixels from the top-left corner of the page.
 */
export const DocImage = Image.extend({
  inline: true,
  group: 'inline',
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => {
          const w = (el as HTMLElement).getAttribute('width') ?? (el as HTMLElement).style.width;
          const n = parseFloat(w || '');
          return Number.isFinite(n) ? n : null;
        },
        renderHTML: () => ({}),
      },
      layout: {
        default: 'inline',
        parseHTML: (el) => (el as HTMLElement).getAttribute('data-layout') || 'inline',
        renderHTML: () => ({}),
      },
      x: {
        default: 0,
        parseHTML: (el) => parseFloat((el as HTMLElement).getAttribute('data-x') || '0') || 0,
        renderHTML: () => ({}),
      },
      y: {
        default: 0,
        parseHTML: (el) => parseFloat((el as HTMLElement).getAttribute('data-y') || '0') || 0,
        renderHTML: () => ({}),
      },
    };
  },
  renderHTML({ HTMLAttributes, node }) {
    const { layout, x, y, width } = node.attrs as { layout: ImageLayout; x: number; y: number; width: number | null };
    const base = width ? `width:${width}px;height:auto;` : '';
    return [
      'img',
      mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, {
        'data-layout': layout,
        'data-x': String(x),
        'data-y': String(y),
        ...(width ? { width: String(width) } : {}),
        style: `${base}${positioned(layout, x, y, width)}`,
      }),
    ];
  },
});
