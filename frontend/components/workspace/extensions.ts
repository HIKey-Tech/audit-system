import { Extension, Node, mergeAttributes } from '@tiptap/core';
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

/** A manual page break: the next content starts on a new page, in the editor, in print and in Word. */
export const PageBreak = Node.create({
  name: 'pageBreak',
  group: 'block',
  atom: true,
  selectable: true,
  parseHTML: () => [{ tag: 'div[data-page-break]' }],
  renderHTML: () => ['div', { 'data-page-break': 'true', class: 'page-break' }],
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
