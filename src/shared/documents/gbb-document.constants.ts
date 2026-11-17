// The GBB "Internal Documents Template", as constants.
//
// Every value here was read from GBB's own template file
// (GBB Internal Documents Template.docx: page setup, styles, front-matter tables,
// cover, header/footer, wording), so generated documents look like it. Do not "tidy"
// these numbers — they are what makes the output match the template.
//
// Twips (1/20 pt) are used for Word measurements; pdfmake uses points (twips / 20).
import { GBB_LOGO_BASE64 } from './gbb-logo.data';

/** US Letter, exactly as the template. (Word scales it to A4 when printing.) */
export const GBB_PAGE = {
  width: 12240,
  height: 15840,
  marginTop: 432,
  marginBottom: 1440,
  marginLeft: 1440,
  marginRight: 1440,
  header: 720,
  footer: 720,
  /** A thin box is drawn around every page, 24 pt in from the edge. */
  borderSpacePt: 24,
} as const;

/** Printable width between the left and right margins. */
export const GBB_TEXT_WIDTH = GBB_PAGE.width - GBB_PAGE.marginLeft - GBB_PAGE.marginRight; // 9360

export const GBB_FONT = {
  /** Cover, front matter, header/footer and Heading 1. */
  heading: 'Corbel',
  /** Body text, Heading 2/3 and tables in the body. */
  body: 'Calibri',
} as const;

export const GBB_COLOR = {
  /** The dark-green rules above and below the cover title (theme accent 3, darkened). */
  rule: '4F6228',
  gridBlack: '000000',
  gridGrey: '808080',
} as const;

/** Font sizes in half-points (Word's unit). */
export const GBB_SIZE = {
  cover: 40, // 20 pt — organisation name and document title
  coverMeta: 24, // 12 pt
  frontHeading: 24, // 12 pt — "Document Information", "Change history", …
  bigHeading: 28, // 14 pt — "Change Control", "Table of contents", Heading 1
  heading2: 24, // 12 pt
  body: 22, // 11 pt
  table: 24, // 12 pt — front-matter tables
  header: 20, // 10 pt — header and footer
} as const;

export const GBB_ORG_NAME = 'Galaxy Backbone Limited';
export const GBB_DEFAULT_CLASSIFICATION = 'Internal Use Only';

export const GBB_CONFIDENTIALITY_NOTICE =
  'No part of this document may be disclosed verbally or in writing, including by reproduction, to any third party without the prior written consent of Galaxy Backbone Limited. This document, its associated appendices and any attachments remain the property of Galaxy Backbone Limited and shall be returned upon request.';

export const GBB_CHANGE_CONTROL_NOTE = 'The contents of this document are subject to change control';

export const GBB_VALIDITY_HEADING = 'Validity and Document Management';
export const gbbValidityText = (lastReviewed: string): string => `This document was last reviewed on ${lastReviewed}`;

/** Column widths (twips) of the four front-matter tables, from the template. */
export const GBB_TABLE_GRID = {
  docInfo: [2977, 6293],
  changeHistory: [1728, 2070, 2160, 3960],
  distribution: [4518, 2070, 2502],
  approval: [3044, 2317, 2286, 1703],
  /** The single-cell box whose top and bottom rules frame the cover title. */
  coverTitle: [5940],
} as const;

/** Indent (twips) of the cover title box and the document-information table. */
export const GBB_INDENT = { coverTitle: 1818, docInfo: 80 } as const;

/** Rule thickness around the cover title: 4.5 pt, in eighths of a point as Word stores it. */
export const GBB_RULE_SIZE = 36;

/** The nine Document Information labels, in the template's order and exact spelling. */
export const GBB_DOC_INFO_LABELS = [
  'Document ID:',
  'Document Version:',
  'Date of Version:',
  'Document Division',
  'Document Owner:',
  'Document Author:',
  'Approved by:',
  'Document Classification',
  'Document Status',
] as const;

export const GBB_CHANGE_HISTORY_HEADERS = ['Version', 'Date', 'Created by', 'Change from Previous Version'] as const;
export const GBB_DISTRIBUTION_HEADERS = ['Name', 'Version', 'Date'] as const;
export const GBB_APPROVAL_HEADERS = ['Name', 'Position', 'Signature', 'Date'] as const;

/** The logo is 360×252 px; the template shows it 3.06 × 2.14 in. */
export const GBB_LOGO = { pxWidth: 360, pxHeight: 252, inchesWidth: 3.06, inchesHeight: 2.14 } as const;

let cachedLogo: Buffer | undefined;

/** The GBB logo PNG (embedded in the code — see gbb-logo.data.ts for why). */
export const loadGbbLogo = (): Buffer => {
  if (!cachedLogo) cachedLogo = Buffer.from(GBB_LOGO_BASE64, 'base64');
  return cachedLogo;
};

export type GbbDocumentKind = 'RPT' | 'WP';

/**
 * Document reference in GBB's `GBB/DEPT/TYPE/DOC` form, with Internal Audit as the department:
 * `GBB/IA/RPT/AUD-2026-003` for a report, `GBB/IA/WP/AUD-2026-003/WP-3F2A9C1B` for a working paper.
 */
export const gbbDocumentId = (kind: GbbDocumentKind, engagementReference: string, suffix?: string): string =>
  ['GBB', 'IA', kind, engagementReference, suffix].filter((part): part is string => Boolean(part && part.trim())).join('/');
