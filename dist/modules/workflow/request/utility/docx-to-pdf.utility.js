"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.isDocx = isDocx;
exports.convertDocxToPdf = convertDocxToPdf;
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');
const xmldom_1 = require("@xmldom/xmldom");
const pdf_util_1 = require("../../../../shared/utils/pdf.util");
const logger_util_1 = require("../../../../shared/utils/logger.util");
function isDocx(filename, mimeType) {
    if (/\.docx?$/i.test(filename))
        return true;
    if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
        mimeType === 'application/msword') {
        return true;
    }
    return false;
}
/**
 * Converts a Word (.docx) document into a PDF buffer while preserving:
 * - Text justification (w:jc val="both" / "justify")
 * - Centered and right-aligned text
 * - Bold, italic, underline, and relative font sizes
 * - Tables, margins, and paragraph spacing
 */
async function convertDocxToPdf(docxBuffer) {
    try {
        const zip = new PizZip(docxBuffer);
        const documentXmlFile = zip.file('word/document.xml');
        if (!documentXmlFile) {
            throw new Error('word/document.xml not found in docx archive');
        }
        const xmlStr = documentXmlFile.asText();
        const dom = new xmldom_1.DOMParser().parseFromString(xmlStr, 'application/xml');
        const body = dom.getElementsByTagName('w:body')[0];
        if (!body) {
            throw new Error('w:body element missing in word/document.xml');
        }
        const content = [];
        // Parse page margins if present in sectPr
        let pageMargins = [48, 48, 48, 48];
        const sectPrNodes = dom.getElementsByTagName('w:sectPr');
        if (sectPrNodes.length > 0) {
            const pgMar = sectPrNodes[0].getElementsByTagName('w:pgMar')[0];
            if (pgMar) {
                const topDxa = parseInt(pgMar.getAttribute('w:top') || '1440', 10);
                const rightDxa = parseInt(pgMar.getAttribute('w:right') || '1440', 10);
                const bottomDxa = parseInt(pgMar.getAttribute('w:bottom') || '1440', 10);
                const leftDxa = parseInt(pgMar.getAttribute('w:left') || '1440', 10);
                if (!isNaN(topDxa) && !isNaN(rightDxa) && !isNaN(bottomDxa) && !isNaN(leftDxa)) {
                    // 20 dxa = 1 pt. Clamp between 36 and 72pt.
                    pageMargins = [
                        Math.max(36, Math.min(72, Math.round(leftDxa / 20))),
                        Math.max(36, Math.min(72, Math.round(topDxa / 20))),
                        Math.max(36, Math.min(72, Math.round(rightDxa / 20))),
                        Math.max(36, Math.min(72, Math.round(bottomDxa / 20))),
                    ];
                }
            }
        }
        for (let i = 0; i < body.childNodes.length; i++) {
            const node = body.childNodes[i];
            if (node.nodeName === 'w:p') {
                let alignment = 'left';
                const jcNodes = node.getElementsByTagName('w:jc');
                if (jcNodes.length > 0) {
                    const val = jcNodes[0].getAttribute('w:val');
                    if (val === 'both' || val === 'justify')
                        alignment = 'justify';
                    else if (val === 'center')
                        alignment = 'center';
                    else if (val === 'right')
                        alignment = 'right';
                }
                const runs = [];
                const rNodes = node.getElementsByTagName('w:r');
                for (let j = 0; j < rNodes.length; j++) {
                    const r = rNodes[j];
                    const isBold = r.getElementsByTagName('w:b').length > 0;
                    const isItalic = r.getElementsByTagName('w:i').length > 0;
                    const isUnderline = r.getElementsByTagName('w:u').length > 0;
                    const szNodes = r.getElementsByTagName('w:sz');
                    let fontSize = 11;
                    if (szNodes.length > 0) {
                        const halfPts = parseInt(szNodes[0].getAttribute('w:val') || '22', 10);
                        if (!isNaN(halfPts) && halfPts > 0) {
                            fontSize = Math.max(8, Math.min(28, Math.round(halfPts / 2)));
                        }
                    }
                    const colorNodes = r.getElementsByTagName('w:color');
                    let color = undefined;
                    if (colorNodes.length > 0) {
                        const hex = colorNodes[0].getAttribute('w:val');
                        if (hex && hex !== 'auto' && /^[0-9A-Fa-f]{6}$/.test(hex)) {
                            color = `#${hex}`;
                        }
                    }
                    const tNodes = r.getElementsByTagName('w:t');
                    let text = '';
                    for (let k = 0; k < tNodes.length; k++) {
                        text += tNodes[k].textContent || '';
                    }
                    if (text) {
                        runs.push({
                            text,
                            bold: isBold,
                            italics: isItalic,
                            decoration: isUnderline ? 'underline' : undefined,
                            fontSize,
                            color,
                        });
                    }
                }
                if (runs.length > 0) {
                    content.push({
                        text: runs,
                        alignment,
                        margin: [0, 2, 0, 3],
                        lineHeight: 1.3,
                    });
                }
                else {
                    // Empty paragraph spacing
                    content.push({ text: ' ', margin: [0, 4, 0, 4] });
                }
            }
            else if (node.nodeName === 'w:tbl') {
                const rows = [];
                const trNodes = node.getElementsByTagName('w:tr');
                for (let r = 0; r < trNodes.length; r++) {
                    const tr = trNodes[r];
                    const rowCells = [];
                    const tcNodes = tr.getElementsByTagName('w:tc');
                    for (let c = 0; c < tcNodes.length; c++) {
                        const tc = tcNodes[c];
                        const cellText = [];
                        const pNodes = tc.getElementsByTagName('w:p');
                        for (let p = 0; p < pNodes.length; p++) {
                            const isBold = pNodes[p].getElementsByTagName('w:b').length > 0;
                            const tNodes = pNodes[p].getElementsByTagName('w:t');
                            let t = '';
                            for (let k = 0; k < tNodes.length; k++) {
                                t += tNodes[k].textContent || '';
                            }
                            if (t) {
                                cellText.push({ text: t, bold: isBold, fontSize: 10 });
                            }
                        }
                        rowCells.push({ text: cellText.length > 0 ? cellText : ' ' });
                    }
                    if (rowCells.length > 0)
                        rows.push(rowCells);
                }
                if (rows.length > 0) {
                    const colCount = rows[0].length;
                    content.push({
                        table: {
                            widths: Array(colCount).fill('*'),
                            body: rows,
                        },
                        margin: [0, 8, 0, 8],
                    });
                }
            }
        }
        if (content.length === 0) {
            content.push({ text: 'Document content', fontSize: 11 });
        }
        const docDef = {
            content,
            pageSize: 'A4',
            pageMargins,
            defaultStyle: {
                font: 'Helvetica',
                fontSize: 11,
                color: '#0f172a',
            },
        };
        return await (0, pdf_util_1.renderPdf)(docDef);
    }
    catch (err) {
        logger_util_1.logger.error('Failed to convert docx to PDF via OpenXML parser', { err });
        throw err;
    }
}
//# sourceMappingURL=docx-to-pdf.utility.js.map