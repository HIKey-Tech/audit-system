// Word (.docx) renderer for a GBB controlled document, matching GBB's
// "Internal Documents Template": Letter page with a thin page border, a header and footer on
// every page except the cover, the logo/title cover, the four front-matter tables, a real
// table of contents, and numbered headings.
//
// Callers supply a GbbDocumentModel plus their own body content (docx paragraphs/tables per
// section). This file owns everything that makes the document look like GBB's.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Footer,
  Header,
  HeadingLevel,
  HeightRule,
  ImageRun,
  LevelFormat,
  PageBorderDisplay,
  PageBorderOffsetFrom,
  PageBorderZOrder,
  PageNumber,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableOfContents,
  TableRow,
  TextRun,
  UnderlineType,
  VerticalAlign,
  WidthType,
} from 'docx';
import {
  GBB_APPROVAL_HEADERS,
  GBB_CHANGE_CONTROL_NOTE,
  GBB_CHANGE_HISTORY_HEADERS,
  GBB_COLOR,
  GBB_CONFIDENTIALITY_NOTICE,
  GBB_DISTRIBUTION_HEADERS,
  GBB_DOC_INFO_LABELS,
  GBB_FONT,
  GBB_INDENT,
  GBB_LOGO,
  GBB_ORG_NAME,
  GBB_PAGE,
  GBB_RULE_SIZE,
  GBB_SIZE,
  GBB_TABLE_GRID,
  GBB_TEXT_WIDTH,
  GBB_VALIDITY_HEADING,
  gbbValidityText,
  loadGbbLogo,
} from './gbb-document.constants';
import { GbbDocumentModel, GbbSignature, versionLabel } from './gbb-document.model';

/** One numbered section of the body. `children` is the section's content, built by the caller. */
export interface GbbDocxSection {
  title: string;
  /** 1 = "1.", 2 = "1.1.", 3 = "1.1.1." (default 1). */
  level?: 1 | 2 | 3;
  children: (Paragraph | Table)[];
}

const NUMBERING_REF = 'gbb-headings';
const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'auto' } as const;
const NO_BORDERS = {
  top: NO_BORDER,
  bottom: NO_BORDER,
  left: NO_BORDER,
  right: NO_BORDER,
  insideHorizontal: NO_BORDER,
  insideVertical: NO_BORDER,
} as const;

const dxa = (size: number) => ({ size, type: WidthType.DXA }) as const;

interface RunOptions {
  size?: number;
  bold?: boolean;
  italics?: boolean;
  underline?: boolean;
  font?: string;
  characterSpacing?: number;
}

/** Front matter, cover, header and footer are set in Corbel (as the template); body text in Calibri. */
const text = (value: string, o: RunOptions = {}): TextRun =>
  new TextRun({
    text: value,
    font: o.font ?? GBB_FONT.heading,
    size: o.size ?? GBB_SIZE.table,
    bold: o.bold,
    italics: o.italics,
    underline: o.underline ? { type: UnderlineType.SINGLE } : undefined,
    characterSpacing: o.characterSpacing,
  });

const centred = (children: TextRun[], spacing: { before?: number; after?: number } = {}): Paragraph =>
  new Paragraph({ alignment: AlignmentType.CENTER, spacing, children });

const blank = (): Paragraph => new Paragraph({ alignment: AlignmentType.CENTER, children: [] });

/** Section headings inside the front matter ("Document Information" …) — styled like the template, not part of the contents list. */
const frontHeading = (value: string, o: { size?: number; pageBreakBefore?: boolean } = {}): Paragraph =>
  new Paragraph({
    pageBreakBefore: o.pageBreakBefore,
    keepNext: true,
    spacing: { before: 240, after: 120 },
    children: [text(value, { size: o.size ?? GBB_SIZE.frontHeading, bold: true })],
  });

const imageType = (mime: string): 'png' | 'jpg' | 'gif' | 'bmp' =>
  /jpe?g/i.test(mime) ? 'jpg' : /gif/i.test(mime) ? 'gif' : /bmp/i.test(mime) ? 'bmp' : 'png';

const signatureParagraph = (signature: GbbSignature): Paragraph =>
  new Paragraph({
    spacing: { after: 0, line: 240 },
    children: [
      new ImageRun({
        type: imageType(signature.mime),
        data: signature.buffer,
        transformation: { width: 108, height: 40 },
      }),
    ],
  });

interface GridTableOptions {
  grid: readonly number[];
  header?: readonly string[];
  rows: ReadonlyArray<ReadonlyArray<string | Paragraph>>;
  borderColor: string;
  /** Border thickness in eighths of a point. */
  borderSize: number;
  rowHeight?: number;
  indent?: number;
  cellMargin?: number;
  fixed?: boolean;
  justify?: boolean;
  centreVertically?: boolean;
}

/** A front-matter table in the template's fonts, with its exact column widths. */
const gridTable = (o: GridTableOptions): Table => {
  const total = o.grid.reduce((sum, w) => sum + w, 0);
  const border = { style: BorderStyle.SINGLE, size: o.borderSize, color: o.borderColor };
  const cell = (value: string | Paragraph, index: number, bold: boolean): TableCell =>
    new TableCell({
      width: dxa(o.grid[index]),
      verticalAlign: o.centreVertically ? VerticalAlign.CENTER : VerticalAlign.TOP,
      margins: { left: o.cellMargin ?? 100, right: o.cellMargin ?? 100, top: 40, bottom: 40 },
      children: [
        typeof value === 'string'
          ? new Paragraph({
              alignment: o.justify ? AlignmentType.BOTH : AlignmentType.LEFT,
              spacing: { after: 0, line: 240 },
              children: [text(value, { bold })],
            })
          : value,
      ],
    });

  const rows: TableRow[] = [];
  if (o.header) {
    rows.push(
      new TableRow({
        tableHeader: true,
        cantSplit: true,
        children: o.header.map((h, i) => cell(h, i, true)),
      }),
    );
  }
  for (const row of o.rows) {
    rows.push(
      new TableRow({
        cantSplit: true,
        height: o.rowHeight ? { value: o.rowHeight, rule: HeightRule.ATLEAST } : undefined,
        children: row.map((v, i) => cell(v, i, false)),
      }),
    );
  }
  return new Table({
    width: dxa(total),
    columnWidths: [...o.grid],
    layout: o.fixed ? TableLayoutType.FIXED : TableLayoutType.AUTOFIT,
    indent: o.indent ? dxa(o.indent) : undefined,
    borders: {
      top: border,
      bottom: border,
      left: border,
      right: border,
      insideHorizontal: border,
      insideVertical: border,
    },
    rows,
  });
};

const coverPage = (model: GbbDocumentModel): (Paragraph | Table)[] => {
  const org = model.orgName ?? GBB_ORG_NAME;
  const items: (Paragraph | Table)[] = [];

  const logo = loadGbbLogo();
  items.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 1200, after: 120 },
      children: [
        new ImageRun({
          type: 'png',
          data: logo,
          // Keeps the image's own 360:252 proportions (the old exports squashed it).
          transformation: {
            width: Math.round(GBB_LOGO.inchesWidth * 96),
            height: Math.round((GBB_LOGO.inchesWidth * 96 * GBB_LOGO.pxHeight) / GBB_LOGO.pxWidth),
          },
        }),
      ],
    }),
    centred([text(org, { size: GBB_SIZE.cover, bold: true, characterSpacing: 4 })], { before: 120, after: 0 }),
    blank(),
    blank(),
  );

  // The title sits in a one-cell box whose only borders are the two dark-green rules.
  const rule = { style: BorderStyle.SINGLE, size: GBB_RULE_SIZE, color: GBB_COLOR.rule };
  items.push(
    new Table({
      width: dxa(GBB_TABLE_GRID.coverTitle[0]),
      columnWidths: [...GBB_TABLE_GRID.coverTitle],
      indent: dxa(GBB_INDENT.coverTitle),
      borders: { ...NO_BORDERS, top: rule, bottom: rule },
      rows: [
        new TableRow({
          height: { value: 2000, rule: HeightRule.ATLEAST },
          children: [
            new TableCell({
              width: dxa(GBB_TABLE_GRID.coverTitle[0]),
              verticalAlign: VerticalAlign.CENTER,
              borders: { top: rule, bottom: rule, left: NO_BORDER, right: NO_BORDER },
              children: [centred([text(model.title, { size: GBB_SIZE.cover, bold: true })], { after: 0 })],
            }),
          ],
        }),
      ],
    }),
    blank(),
    centred([text(versionLabel(model.version), { size: GBB_SIZE.coverMeta, bold: true })], { before: 240, after: 600 }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 0, line: 240 },
      children: [text('DOCUMENT REFERENCE NUMBER:', { size: GBB_SIZE.coverMeta, italics: true, underline: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 360, line: 240 },
      children: [text(model.documentId, { size: GBB_SIZE.coverMeta, italics: true })],
    }),
    centred([text('Confidentiality', { size: GBB_SIZE.coverMeta, bold: true })], { before: 240, after: 0 }),
    centred([text(model.confidentialityNotice ?? GBB_CONFIDENTIALITY_NOTICE, { size: GBB_SIZE.coverMeta })], { after: 0 }),
  );
  return items;
};

const frontMatter = (model: GbbDocumentModel): (Paragraph | Table)[] => {
  const values = [
    model.documentId,
    versionLabel(model.version),
    model.versionDate,
    model.division,
    model.owner,
    model.author,
    model.approvedBy,
    model.classification,
    model.status,
  ];
  const hasRows = <T,>(rows: T[], empty: T): T[] => (rows.length > 0 ? rows : [empty]);

  return [
    frontHeading('Document Information', { pageBreakBefore: true }),
    gridTable({
      grid: GBB_TABLE_GRID.docInfo,
      rows: GBB_DOC_INFO_LABELS.map((label, i) => [label, values[i] || '—']),
      borderColor: GBB_COLOR.gridGrey,
      borderSize: 6,
      rowHeight: 372,
      indent: GBB_INDENT.docInfo,
      cellMargin: 80,
      fixed: true,
      justify: true,
      centreVertically: true,
    }),

    frontHeading('Change history'),
    gridTable({
      grid: GBB_TABLE_GRID.changeHistory,
      header: GBB_CHANGE_HISTORY_HEADERS,
      rows: hasRows(
        model.changeHistory.map((r) => [r.version, r.date, r.createdBy, r.change]),
        ['—', '', '', ''],
      ),
      borderColor: GBB_COLOR.gridBlack,
      borderSize: 4,
      rowHeight: 440,
    }),

    frontHeading('Distribution List'),
    gridTable({
      grid: GBB_TABLE_GRID.distribution,
      header: GBB_DISTRIBUTION_HEADERS,
      rows: hasRows(
        model.distribution.map((r) => [r.name, r.version, r.date]),
        ['—', '', ''],
      ),
      borderColor: GBB_COLOR.gridBlack,
      borderSize: 4,
    }),

    frontHeading('Approval List'),
    gridTable({
      grid: GBB_TABLE_GRID.approval,
      header: GBB_APPROVAL_HEADERS,
      rows: hasRows(
        model.approvals.map((r) => [r.name, r.position, r.signature ? signatureParagraph(r.signature) : (r.signatureNote ?? ''), r.date]),
        ['—', '', '', ''],
      ),
      borderColor: GBB_COLOR.gridBlack,
      borderSize: 4,
      rowHeight: 720,
    }),

    frontHeading('Change Control', { size: GBB_SIZE.bigHeading }),
    new Paragraph({ spacing: { after: 200, line: 240 }, children: [text(GBB_CHANGE_CONTROL_NOTE, { font: GBB_FONT.body, size: GBB_SIZE.body })] }),

    frontHeading('Table of contents', { size: GBB_SIZE.bigHeading }),
    // A real Word contents field. It is filled in when Word updates fields (the document asks once on open).
    new TableOfContents('Table of contents', { hyperlink: true, headingStyleRange: '1-3' }),
  ];
};

const heading = (title: string, level: 1 | 2 | 3, pageBreakBefore = false): Paragraph =>
  new Paragraph({
    heading: level === 1 ? HeadingLevel.HEADING_1 : level === 2 ? HeadingLevel.HEADING_2 : HeadingLevel.HEADING_3,
    numbering: { reference: NUMBERING_REF, level: level - 1 },
    pageBreakBefore,
    children: [new TextRun({ text: title })],
  });

const buildHeader = (model: GbbDocumentModel): Header => {
  const rightWidth = 2517;
  const cell = (value: string, width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType]): TableCell =>
    new TableCell({
      width: dxa(width),
      borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
      children: [new Paragraph({ alignment: align, spacing: { after: 0 }, children: [text(value, { size: GBB_SIZE.header })] })],
    });
  return new Header({
    children: [
      new Table({
        width: dxa(GBB_TEXT_WIDTH),
        columnWidths: [GBB_TEXT_WIDTH - rightWidth, rightWidth],
        borders: NO_BORDERS,
        rows: [
          new TableRow({
            children: [
              cell(model.orgName ?? GBB_ORG_NAME, GBB_TEXT_WIDTH - rightWidth, AlignmentType.LEFT),
              cell(model.classification, rightWidth, AlignmentType.RIGHT),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 0 }, children: [] }),
    ],
  });
};

const buildFooter = (model: GbbDocumentModel): Footer => {
  const widths = [4400, 2400, GBB_TEXT_WIDTH - 4400 - 2400];
  const small = (value: string, bold = false): TextRun => text(value, { size: GBB_SIZE.header, bold });
  const cell = (children: TextRun[], width: number, align: (typeof AlignmentType)[keyof typeof AlignmentType]): TableCell =>
    new TableCell({
      width: dxa(width),
      borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER },
      children: [new Paragraph({ alignment: align, spacing: { before: 60, after: 0 }, children })],
    });
  const rule = { style: BorderStyle.SINGLE, size: 6, color: GBB_COLOR.gridBlack };
  return new Footer({
    children: [
      new Table({
        width: dxa(GBB_TEXT_WIDTH),
        columnWidths: widths,
        borders: { ...NO_BORDERS, top: rule },
        rows: [
          new TableRow({
            children: [
              cell([small(model.title)], widths[0], AlignmentType.LEFT),
              cell([small(versionLabel(model.version))], widths[1], AlignmentType.CENTER),
              cell(
                [
                  small('Page '),
                  new TextRun({ children: [PageNumber.CURRENT], font: GBB_FONT.heading, size: GBB_SIZE.header, bold: true }),
                  small(' of '),
                  new TextRun({ children: [PageNumber.TOTAL_PAGES], font: GBB_FONT.heading, size: GBB_SIZE.header, bold: true }),
                ],
                widths[2],
                AlignmentType.RIGHT,
              ),
            ],
          }),
        ],
      }),
      new Paragraph({ spacing: { after: 0 }, children: [] }),
    ],
  });
};

/** Builds the complete Word document. */
export const buildGbbDocxDocument = (model: GbbDocumentModel, sections: GbbDocxSection[]): Document => {
  const body: (Paragraph | Table)[] = [];
  sections.forEach((section, index) => {
    body.push(heading(section.title, section.level ?? 1, index === 0), ...section.children);
  });
  // The template always ends with this section.
  body.push(
    heading(GBB_VALIDITY_HEADING, 1),
    new Paragraph({ children: [new TextRun({ text: gbbValidityText(model.lastReviewed) })] }),
  );

  const pageBorder = { style: BorderStyle.SINGLE, size: 4, color: 'auto', space: GBB_PAGE.borderSpacePt };

  return new Document({
    creator: model.orgName ?? GBB_ORG_NAME,
    title: model.title,
    description: model.documentId,
    // Makes Word offer to fill in the table of contents (page numbers) when the file is first opened.
    features: { updateFields: true },
    styles: {
      default: {
        document: { run: { font: GBB_FONT.body, size: GBB_SIZE.body }, paragraph: { spacing: { after: 200, line: 276 } } },
        heading1: {
          run: { font: GBB_FONT.heading, size: GBB_SIZE.bigHeading, bold: true },
          paragraph: { keepNext: true, spacing: { before: 360, after: 120 } },
        },
        heading2: {
          run: { font: GBB_FONT.body, size: GBB_SIZE.heading2, bold: true },
          paragraph: { keepNext: true, spacing: { before: 240, after: 80 } },
        },
        heading3: {
          run: { font: GBB_FONT.body, size: GBB_SIZE.body, bold: true, italics: true },
          paragraph: { keepNext: true, spacing: { before: 200, after: 60 } },
        },
      },
      paragraphStyles: ['TOC1', 'TOC2', 'TOC3'].map((id, i) => ({
        id,
        name: `toc ${i + 1}`,
        basedOn: 'Normal',
        next: 'Normal',
        paragraph: { spacing: { after: 100 } },
      })),
    },
    numbering: {
      config: [
        {
          reference: NUMBERING_REF,
          levels: [
            { level: 0, format: LevelFormat.DECIMAL, text: '%1.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 360 } } } },
            { level: 1, format: LevelFormat.DECIMAL, text: '%1.%2.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 360, hanging: 360 } } } },
            { level: 2, format: LevelFormat.DECIMAL, text: '%1.%2.%3.', alignment: AlignmentType.LEFT, style: { paragraph: { indent: { left: 720, hanging: 720 } } } },
          ],
        },
      ],
    },
    sections: [
      {
        properties: {
          // The cover has no header or footer, exactly like the template ("different first page").
          titlePage: true,
          page: {
            size: { width: GBB_PAGE.width, height: GBB_PAGE.height },
            margin: {
              top: GBB_PAGE.marginTop,
              right: GBB_PAGE.marginRight,
              bottom: GBB_PAGE.marginBottom,
              left: GBB_PAGE.marginLeft,
              header: GBB_PAGE.header,
              footer: GBB_PAGE.footer,
              gutter: 0,
            },
            borders: {
              pageBorders: {
                display: PageBorderDisplay.ALL_PAGES,
                offsetFrom: PageBorderOffsetFrom.PAGE,
                zOrder: PageBorderZOrder.FRONT,
              },
              pageBorderTop: pageBorder,
              pageBorderRight: pageBorder,
              pageBorderBottom: pageBorder,
              pageBorderLeft: pageBorder,
            },
          },
        },
        headers: { default: buildHeader(model), first: new Header({ children: [new Paragraph({ children: [] })] }) },
        footers: { default: buildFooter(model), first: new Footer({ children: [new Paragraph({ children: [] })] }) },
        children: [...coverPage(model), ...frontMatter(model), ...body],
      },
    ],
  });
};
