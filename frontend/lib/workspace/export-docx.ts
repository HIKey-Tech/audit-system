import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  Footer,
  Header,
  HeadingLevel,
  HorizontalPositionRelativeFrom,
  ImageRun,
  LevelFormat,
  Packer,
  PageBreak,
  PageNumber,
  Paragraph,
  ShadingType,
  Table,
  TableCell,
  TableRow,
  TextRun,
  TextWrappingType,
  UnderlineType,
  VerticalPositionRelativeFrom,
  WidthType,
  type ParagraphChild,
  type FileChild,
} from 'docx';

// The editor's document, as TipTap hands it over (ProseMirror JSON).
export interface DocNode {
  type: string;
  attrs?: Record<string, unknown>;
  content?: DocNode[];
  text?: string;
  marks?: Array<{ type: string; attrs?: Record<string, unknown> }>;
}

const PX_TO_EMU = 9525;
const GBB_GREEN = '4F6228';

const hex = (color: unknown): string | undefined => {
  if (typeof color !== 'string') return undefined;
  const m = color.trim().match(/^#?([0-9a-f]{6})$/i);
  if (m) return m[1].toUpperCase();
  const short = color.trim().match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (short) return `${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`.toUpperCase();
  const rgb = color.match(/rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)/i);
  if (rgb) return [rgb[1], rgb[2], rgb[3]].map((n) => Number(n).toString(16).padStart(2, '0')).join('').toUpperCase();
  return undefined;
};

const firstFont = (family: unknown): string | undefined =>
  typeof family === 'string' ? family.split(',')[0].replace(/["']/g, '').trim() || undefined : undefined;

/** Editor font sizes are in pt (e.g. "14pt"); Word wants half-points. */
const halfPoints = (size: unknown): number | undefined => {
  if (typeof size !== 'string') return undefined;
  const n = parseFloat(size);
  if (!Number.isFinite(n)) return undefined;
  return Math.round((size.includes('px') ? n * 0.75 : n) * 2);
};

const alignment = (align: unknown): (typeof AlignmentType)[keyof typeof AlignmentType] | undefined => {
  switch (align) {
    case 'center': return AlignmentType.CENTER;
    case 'right': return AlignmentType.RIGHT;
    case 'justify': return AlignmentType.JUSTIFIED;
    case 'left': return AlignmentType.LEFT;
    default: return undefined;
  }
};

const HEADINGS = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4, HeadingLevel.HEADING_5, HeadingLevel.HEADING_6];

interface Ctx {
  /** numbering references created for ordered lists, so each list restarts at 1 */
  orderedRefs: string[];
  images: Map<string, { data: Uint8Array; type: 'png' | 'jpg' | 'gif'; w: number; h: number }>;
}

const decodeDataUrl = (src: string): { data: Uint8Array; type: 'png' | 'jpg' | 'gif' } | null => {
  const m = src.match(/^data:image\/(png|jpe?g|gif);base64,(.*)$/i);
  if (!m) return null;
  const bin = atob(m[2]);
  const data = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) data[i] = bin.charCodeAt(i);
  const t = m[1].toLowerCase();
  return { data, type: t === 'png' ? 'png' : t === 'gif' ? 'gif' : 'jpg' };
};

/** Pixel size read straight from the picture's own header, so no browser image loading is needed. */
const imageSize = (data: Uint8Array, type: 'png' | 'jpg' | 'gif'): { w: number; h: number } => {
  const fallback = { w: 300, h: 200 };
  try {
    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    if (type === 'png') return { w: view.getUint32(16), h: view.getUint32(20) };
    if (type === 'gif') return { w: view.getUint16(6, true), h: view.getUint16(8, true) };
    let i = 2;
    while (i < data.length - 9) {
      if (data[i] !== 0xff) { i++; continue; }
      const marker = data[i + 1];
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: view.getUint16(i + 5), w: view.getUint16(i + 7) };
      }
      i += 2 + view.getUint16(i + 2);
    }
  } catch {
    /* fall through */
  }
  return fallback;
};

/** Only data-URL pictures can be embedded; each is decoded once and its size recorded. */
const collectImages = async (node: DocNode, ctx: Ctx): Promise<void> => {
  if (node.type === 'image' && typeof node.attrs?.src === 'string' && !ctx.images.has(node.attrs.src)) {
    const decoded = decodeDataUrl(node.attrs.src);
    if (decoded) ctx.images.set(node.attrs.src, { ...decoded, ...imageSize(decoded.data, decoded.type) });
  }
  for (const child of node.content ?? []) await collectImages(child, ctx);
};

const runFor = (node: DocNode, extra: { bold?: boolean; italics?: boolean } = {}): ParagraphChild => {
  const marks = node.marks ?? [];
  const has = (t: string) => marks.some((m) => m.type === t);
  const style = marks.find((m) => m.type === 'textStyle')?.attrs ?? {};
  const highlight = marks.find((m) => m.type === 'highlight')?.attrs?.color;
  const link = marks.find((m) => m.type === 'link')?.attrs?.href;
  const run = new TextRun({
    text: node.text ?? '',
    bold: has('bold') || extra.bold,
    italics: has('italic') || extra.italics,
    underline: has('underline') || link ? { type: UnderlineType.SINGLE } : undefined,
    strike: has('strike'),
    subScript: has('subscript'),
    superScript: has('superscript'),
    color: hex(style.color) ?? (link ? '0563C1' : undefined),
    font: firstFont(style.fontFamily),
    size: halfPoints(style.fontSize),
    shading: highlight ? { type: ShadingType.CLEAR, fill: hex(highlight) ?? 'FFFF00', color: 'auto' } : undefined,
  });
  return typeof link === 'string' ? new ExternalHyperlink({ link, children: [run as TextRun] }) : run;
};

const inline = (nodes: DocNode[] | undefined, ctx: Ctx, extra: { bold?: boolean; italics?: boolean } = {}): ParagraphChild[] => {
  const out: ParagraphChild[] = [];
  for (const n of nodes ?? []) {
    if (n.type === 'text') out.push(runFor(n, extra));
    else if (n.type === 'hardBreak') out.push(new TextRun({ break: 1 }));
    else if (n.type === 'image') {
      const src = typeof n.attrs?.src === 'string' ? n.attrs.src : '';
      const img = ctx.images.get(src);
      if (!img) continue;
      const wantW = Number(n.attrs?.width) || Math.min(img.w, 600);
      const w = Math.max(8, Math.round(wantW));
      const h = Math.max(8, Math.round((w * img.h) / img.w));
      const layout = (n.attrs?.layout as string) || 'inline';
      const base = { data: img.data, type: img.type, transformation: { width: w, height: h } };
      out.push(
        layout === 'inline'
          ? new ImageRun(base)
          : new ImageRun({
              ...base,
              floating: {
                horizontalPosition: { relative: HorizontalPositionRelativeFrom.PAGE, offset: Math.round((Number(n.attrs?.x) || 0) * PX_TO_EMU) },
                verticalPosition: { relative: VerticalPositionRelativeFrom.PAGE, offset: Math.round((Number(n.attrs?.y) || 0) * PX_TO_EMU) },
                behindDocument: layout === 'behind',
                allowOverlap: true,
                wrap: { type: TextWrappingType.NONE },
              },
            }),
      );
    }
  }
  return out;
};

const paragraph = (node: DocNode, ctx: Ctx, opts: Record<string, unknown> = {}): Paragraph =>
  new Paragraph({
    children: inline(node.content, ctx, opts.runExtra as { bold?: boolean; italics?: boolean }),
    alignment: alignment(node.attrs?.textAlign),
    spacing: { after: 120 },
    ...(opts.paragraph as object),
  });

const convertList = (node: DocNode, ctx: Ctx, depth: number, ordered: boolean, ref: string): FileChild[] => {
  const out: FileChild[] = [];
  for (const item of node.content ?? []) {
    for (const child of item.content ?? []) {
      if (child.type === 'bulletList' || child.type === 'orderedList') {
        const r = child.type === 'orderedList' ? `ol-${ctx.orderedRefs.length}` : 'bullets';
        if (child.type === 'orderedList') ctx.orderedRefs.push(r);
        out.push(...convertList(child, ctx, depth + 1, child.type === 'orderedList', r));
      } else if (child.type === 'taskList') {
        out.push(...convertBlock(child, ctx, depth + 1));
      } else {
        out.push(paragraph(child, ctx, { paragraph: { numbering: { reference: ref, level: Math.min(depth, 8) }, spacing: { after: 60 } } }));
      }
    }
  }
  void ordered;
  return out;
};

const cell = (node: DocNode, ctx: Ctx): TableCell => {
  const isHeader = node.type === 'tableHeader';
  const blocks = (node.content ?? []).flatMap((c) => convertBlock(c, ctx, 0, isHeader));
  return new TableCell({
    columnSpan: Number(node.attrs?.colspan) > 1 ? Number(node.attrs?.colspan) : undefined,
    rowSpan: Number(node.attrs?.rowspan) > 1 ? Number(node.attrs?.rowspan) : undefined,
    shading: isHeader ? { type: ShadingType.CLEAR, fill: 'EEF1E6', color: 'auto' } : undefined,
    // A cell must contain at least one paragraph.
    children: (blocks.length > 0 ? blocks : [new Paragraph('')]) as Paragraph[],
  });
};

const convertBlock = (node: DocNode, ctx: Ctx, depth = 0, bold = false): FileChild[] => {
  switch (node.type) {
    case 'paragraph':
      return [paragraph(node, ctx, { runExtra: { bold } })];
    case 'heading': {
      const level = Math.min(Math.max(Number(node.attrs?.level) || 1, 1), 6);
      return [
        new Paragraph({
          heading: HEADINGS[level - 1],
          alignment: alignment(node.attrs?.textAlign),
          children: inline(node.content, ctx),
          spacing: { before: 240, after: 120 },
        }),
      ];
    }
    case 'bulletList':
      return convertList(node, ctx, depth, false, 'bullets');
    case 'orderedList': {
      const ref = `ol-${ctx.orderedRefs.length}`;
      ctx.orderedRefs.push(ref);
      return convertList(node, ctx, depth, true, ref);
    }
    case 'taskList':
      return (node.content ?? []).flatMap((item) =>
        (item.content ?? []).map((child) =>
          new Paragraph({
            children: [new TextRun({ text: item.attrs?.checked ? '☑ ' : '☐ ' }), ...inline(child.content, ctx)],
            indent: { left: 360 * (depth + 1) },
            spacing: { after: 60 },
          }),
        ),
      );
    case 'blockquote':
      return (node.content ?? []).flatMap((c) =>
        c.type === 'paragraph'
          ? [paragraph(c, ctx, { runExtra: { italics: true }, paragraph: { indent: { left: 720 }, border: { left: { style: BorderStyle.SINGLE, size: 12, color: 'CCCCCC', space: 8 } } } })]
          : convertBlock(c, ctx, depth),
      );
    case 'codeBlock':
      return [
        new Paragraph({
          children: [new TextRun({ text: (node.content ?? []).map((t) => t.text ?? '').join(''), font: 'Courier New', size: 20 })],
          shading: { type: ShadingType.CLEAR, fill: 'F3F4F6', color: 'auto' },
          spacing: { after: 120 },
        }),
      ];
    case 'horizontalRule':
      return [new Paragraph({ border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '999999', space: 1 } }, spacing: { after: 120 } })];
    case 'pageBreak':
      return [new Paragraph({ children: [new PageBreak()] })];
    case 'table':
      return [
        new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: (node.content ?? []).map((row) => new TableRow({ children: (row.content ?? []).map((c) => cell(c, ctx)) })),
        }),
        new Paragraph({ spacing: { after: 120 } }),
      ];
    default:
      return node.content ? node.content.flatMap((c) => convertBlock(c, ctx, depth)) : [];
  }
};

export interface ExportOptions {
  title: string;
  /** 'gbb' adds the Galaxy Backbone header and a footer with the title and page numbers. */
  template: string;
}

/** Builds a real Word (.docx) file from the editor's content, at US Letter size. */
export const buildDocx = async (doc: DocNode, opts: ExportOptions): Promise<Blob> => {
  const ctx: Ctx = { orderedRefs: [], images: new Map() };
  await collectImages(doc, ctx);
  const children = (doc.content ?? []).flatMap((n) => convertBlock(n, ctx));
  const gbb = opts.template === 'gbb';

  const numberingLevels = (format: (typeof LevelFormat)[keyof typeof LevelFormat], text: (n: number) => string) =>
    Array.from({ length: 9 }, (_, level) => ({
      level,
      format,
      text: text(level),
      alignment: AlignmentType.LEFT,
      style: { paragraph: { indent: { left: 720 + level * 360, hanging: 360 } } },
    }));

  const document = new Document({
    creator: 'Galaxy Backbone Limited',
    title: opts.title,
    styles: {
      default: { document: { run: { font: 'Calibri', size: 22 } } },
      paragraphStyles: [
        { id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: gbb ? 'Corbel' : 'Calibri', size: 28, bold: true, color: gbb ? '000000' : '1F3864' } },
        { id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 24, bold: true, color: '000000' } },
        { id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true, run: { font: 'Calibri', size: 22, bold: true, italics: true, color: '000000' } },
      ],
    },
    numbering: {
      config: [
        { reference: 'bullets', levels: numberingLevels(LevelFormat.BULLET, (l) => (l % 2 === 0 ? '•' : '◦')) },
        ...ctx.orderedRefs.map((reference) => ({
          reference,
          levels: numberingLevels(LevelFormat.DECIMAL, (l) => `%${l + 1}.`),
        })),
      ],
    },
    sections: [
      {
        properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
        headers: gbb
          ? {
              default: new Header({
                children: [
                  new Paragraph({
                    border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: GBB_GREEN, space: 2 } },
                    children: [
                      new TextRun({ text: 'Galaxy Backbone Limited', font: 'Corbel', size: 20 }),
                      new TextRun({ text: '\tInternal Use Only', font: 'Corbel', size: 20 }),
                    ],
                    tabStops: [{ type: 'right', position: 9360 }],
                  }),
                ],
              }),
            }
          : undefined,
        footers: {
          default: new Footer({
            children: [
              new Paragraph({
                alignment: gbb ? AlignmentType.LEFT : AlignmentType.CENTER,
                tabStops: gbb ? [{ type: 'right', position: 9360 }] : undefined,
                children: gbb
                  ? [
                      new TextRun({ text: opts.title, font: 'Corbel', size: 20 }),
                      new TextRun({ children: ['\tPage ', PageNumber.CURRENT, ' of ', PageNumber.TOTAL_PAGES], font: 'Corbel', size: 20 }),
                    ]
                  : [new TextRun({ children: [PageNumber.CURRENT], size: 20 })],
              }),
            ],
          }),
        },
        children: children.length > 0 ? children : [new Paragraph('')],
      },
    ],
  });
  return Packer.toBlob(document);
};

export const downloadBlob = (blob: Blob, fileName: string): void => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
};
