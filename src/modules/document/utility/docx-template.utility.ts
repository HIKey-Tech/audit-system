// src/modules/document/utility/docx-template.utility.ts
//
// Builds a valid .docx archive from a single document.xml body and renders
// it through docxtemplater. The template is provided by the caller as a
// string (typically Document_Template.content) so DOCX generation needs no
// binary assets on disk.

import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { AppError } from '../../../shared/errors/app.error';
import { logger } from '../../../shared/utils/logger.util';

const CONTENT_TYPES_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '</Types>';

const ROOT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  '</Relationships>';

const DOCUMENT_RELS_XML =
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>';

export const DOCX_MIME_TYPE =
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

/**
 * Render a docxtemplater-compatible document.xml body to a complete .docx
 * buffer. Placeholders use the default `{tag}` / `{#tag}{/tag}` delimiters.
 */
export const renderDocxFromDocumentXml = (
  documentXml: string,
  data: Record<string, unknown>,
): Buffer => {
  const zip = new PizZip();
  zip.file('[Content_Types].xml', CONTENT_TYPES_XML);
  zip.file('_rels/.rels', ROOT_RELS_XML);
  zip.file('word/_rels/document.xml.rels', DOCUMENT_RELS_XML);
  zip.file('word/document.xml', documentXml);

  let doc: Docxtemplater;
  try {
    doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
    });
    doc.render(data);
  } catch (err) {
    logger.error('Failed to render DOCX template', { err });
    throw AppError.internal();
  }

  return doc.getZip().generate({ type: 'nodebuffer', compression: 'DEFLATE' });
};
