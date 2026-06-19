"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.renderPdf = exports.severityBadge = exports.borderedTableLayout = exports.hexColor = exports.mm = void 0;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PdfPrinter = require('pdfmake');
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
const mm = (value) => value * 2.83465;
exports.mm = mm;
/** pdfmake needs a leading '#'; report header colours are stored without one. */
const hexColor = (value) => `#${value.replace(/^#/, '')}`;
exports.hexColor = hexColor;
/** Bordered table layout (light-grey 1px borders + comfortable cell padding). */
exports.borderedTableLayout = {
    hLineWidth: () => 1,
    vLineWidth: () => 1,
    hLineColor: () => '#cccccc',
    vLineColor: () => '#cccccc',
    paddingLeft: () => 8,
    paddingRight: () => 8,
    paddingTop: () => 6,
    paddingBottom: () => 6,
};
const SEVERITY_COLORS = {
    critical: { bg: '#DC2626', text: '#FFFFFF' },
    high: { bg: '#EA580C', text: '#FFFFFF' },
    medium: { bg: '#CA8A04', text: '#000000' },
    low: { bg: '#16A34A', text: '#FFFFFF' },
    informational: { bg: '#64748B', text: '#FFFFFF' },
};
/** A filled severity pill sized to its text (replaces the old CSS badge span). */
const severityBadge = (severity) => {
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
exports.severityBadge = severityBadge;
/** Render a pdfmake document definition to a Buffer. */
const renderPdf = (definition) => {
    const doc = printer.createPdfKitDocument({
        defaultStyle: { font: 'Helvetica', fontSize: 11, lineHeight: 1.3 },
        ...definition,
    });
    return new Promise((resolve, reject) => {
        const chunks = [];
        doc.on('data', (chunk) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);
        doc.end();
    });
};
exports.renderPdf = renderPdf;
//# sourceMappingURL=pdf.util.js.map