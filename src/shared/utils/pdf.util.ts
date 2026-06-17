import type { Content, CustomTableLayout, TDocumentDefinitions, TFontDictionary } from 'pdfmake/interfaces';

/**
 * pdfmake's published types model the browser `pdfMake` object, not the Node
 * `PdfPrinter` constructor that the package's main entry actually exports for
 * server use. We type the slice we need and require it directly.
 */
interface PdfKitDocument {
  on(event: 'data', listener: (chunk: Buffer) => void): void;
  on(event: 'end', listener: () => void): void;
  on(event: 'error', listener: (err: Error) => void): void;
  end(): void;
}
interface PdfPrinterConstructor {
  new (fonts: TFontDictionary): { createPdfKitDocument(definition: TDocumentDefinitions): PdfKitDocument };
}
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake') as PdfPrinterConstructor;

/**
 * Server-side PDF rendering via pdfmake.
 *
 * Replaces the previous Puppeteer/Chromium HTML→PDF pipeline. Puppeteer
 * bundled a ~300MB headless browser into the deploy image, which blew the
 * Railway container-image push past its timeout. pdfmake is pure JS.
 *
 * Fonts: we use the PDF standard-14 Helvetica family, which is built into
 * pdfkit (pdfmake's renderer). No .ttf files need to be bundled or shipped.
 */
const printer = new PdfPrinter({
  Helvetica: {
    normal: 'Helvetica',
    bold: 'Helvetica-Bold',
    italics: 'Helvetica-Oblique',
    bolditalics: 'Helvetica-BoldOblique',
  },
});

/** Millimetres → PDF points, for translating the old CSS mm margins. */
export const mm = (value: number): number => value * 2.83465;

/** pdfmake needs a leading '#'; report header colours are stored without one. */
export const hexColor = (value: string): string => `#${value.replace(/^#/, '')}`;

/** Bordered table layout (light-grey 1px borders + comfortable cell padding). */
export const borderedTableLayout: CustomTableLayout = {
  hLineWidth: () => 1,
  vLineWidth: () => 1,
  hLineColor: () => '#cccccc',
  vLineColor: () => '#cccccc',
  paddingLeft: () => 8,
  paddingRight: () => 8,
  paddingTop: () => 6,
  paddingBottom: () => 6,
};

const SEVERITY_COLORS: Record<string, { bg: string; text: string }> = {
  critical: { bg: '#DC2626', text: '#FFFFFF' },
  high: { bg: '#EA580C', text: '#FFFFFF' },
  medium: { bg: '#CA8A04', text: '#000000' },
  low: { bg: '#16A34A', text: '#FFFFFF' },
  informational: { bg: '#64748B', text: '#FFFFFF' },
};

/** A filled severity pill sized to its text (replaces the old CSS badge span). */
export const severityBadge = (severity: string): Content => {
  const c = SEVERITY_COLORS[severity.toLowerCase()] ?? SEVERITY_COLORS.informational;
  return {
    table: {
      widths: ['auto'],
      body: [
        [
          {
            text: severity.toUpperCase(),
            fillColor: c.bg,
            color: c.text,
            bold: true,
            fontSize: 8,
            margin: [4, 1, 4, 1],
          },
        ],
      ],
    },
    layout: 'noBorders',
  };
};

/** Render a pdfmake document definition to a Buffer. */
export const renderPdf = (definition: TDocumentDefinitions): Promise<Buffer> => {
  const doc = printer.createPdfKitDocument({
    defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.3 },
    ...definition,
  });

  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
};
