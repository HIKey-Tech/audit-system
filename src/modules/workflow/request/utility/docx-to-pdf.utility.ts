// eslint-disable-next-line @typescript-eslint/no-var-requires
const mammoth = require('mammoth');
import { marked, Tokens } from 'marked';
import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { renderPdf } from '../../../../shared/utils/pdf.util';
import { logger } from '../../../../shared/utils/logger.util';

export function isDocx(filename: string, mimeType?: string): boolean {
  if (/\.docx?$/i.test(filename)) return true;
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    mimeType === 'application/msword'
  ) {
    return true;
  }
  return false;
}

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Buffer> {
  try {
    const mdResult = await mammoth.convertToMarkdown({ buffer: docxBuffer });
    const markdown = mdResult.value || '';
    const tokens = marked.lexer(markdown);

    const content: Content[] = [];

    for (const token of tokens) {
      if (token.type === 'heading') {
        const headingToken = token as Tokens.Heading;
        const fontSize = headingToken.depth === 1 ? 16 : headingToken.depth === 2 ? 14 : 12;
        content.push({
          text: headingToken.text,
          bold: true,
          fontSize,
          margin: [0, 10, 0, 4],
        });
      } else if (token.type === 'paragraph') {
        const pToken = token as Tokens.Paragraph;
        if (pToken.tokens && pToken.tokens.length > 0) {
          const inlines = pToken.tokens.map((t: any) => {
            if (t.type === 'strong') {
              return { text: t.text || '', bold: true };
            }
            if (t.type === 'em') {
              return { text: t.text || '', italics: true };
            }
            if (t.type === 'br') {
              return { text: '\n' };
            }
            return { text: t.text || '' };
          });
          content.push({
            text: inlines,
            fontSize: 11,
            lineHeight: 1.35,
            margin: [0, 4, 0, 6],
          });
        } else {
          content.push({
            text: pToken.text,
            fontSize: 11,
            lineHeight: 1.35,
            margin: [0, 4, 0, 6],
          });
        }
      } else if (token.type === 'list') {
        const listToken = token as Tokens.List;
        const listItems = listToken.items.map((it) => it.text);
        if (listToken.ordered) {
          content.push({
            ol: listItems,
            fontSize: 11,
            lineHeight: 1.3,
            margin: [0, 4, 0, 6],
          });
        } else {
          content.push({
            ul: listItems,
            fontSize: 11,
            lineHeight: 1.3,
            margin: [0, 4, 0, 6],
          });
        }
      } else if (token.type === 'table') {
        const tableToken = token as Tokens.Table;
        const headers = tableToken.header.map((h) => ({
          text: h.text,
          bold: true,
          fillColor: '#f1f5f9',
          fontSize: 10,
        }));
        const rows = tableToken.rows.map((row) =>
          row.map((cell) => ({
            text: cell.text,
            fontSize: 9,
          })),
        );
        content.push({
          table: {
            headerRows: 1,
            widths: Array(headers.length).fill('*'),
            body: [headers, ...rows],
          },
          margin: [0, 8, 0, 8],
        });
      } else if (token.type === 'hr') {
        content.push({
          canvas: [
            {
              type: 'line',
              x1: 0,
              y1: 5,
              x2: 515,
              y2: 5,
              lineWidth: 0.5,
              lineColor: '#cbd5e1',
            },
          ],
          margin: [0, 6, 0, 6],
        });
      }
    }

    if (content.length === 0) {
      content.push({
        text: 'Document content',
        fontSize: 11,
      });
    }

    const docDef: TDocumentDefinitions = {
      content,
      pageSize: 'A4',
      pageMargins: [48, 48, 48, 48],
      defaultStyle: {
        font: 'Helvetica',
        fontSize: 11,
        color: '#0f172a',
      },
    };

    return await renderPdf(docDef);
  } catch (err) {
    logger.error('Failed to convert docx to PDF', { err });
    throw err;
  }
}
