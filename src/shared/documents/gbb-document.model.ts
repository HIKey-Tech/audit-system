// What a GBB controlled document needs to know about itself. Callers (working paper, audit
// report, later others) fill this in from their own data; the Word and PDF builders then
// render it identically. Pure data — no rendering concerns here.

/** A drawn signature, as raw image bytes. */
export interface GbbSignature {
  buffer: Buffer;
  /** e.g. image/png, image/jpeg */
  mime: string;
}

export interface GbbChangeHistoryRow {
  /** e.g. "Version 2.0" */
  version: string;
  /** dd/mm/yyyy */
  date: string;
  createdBy: string;
  change: string;
}

export interface GbbDistributionRow {
  name: string;
  version: string;
  date: string;
}

export interface GbbApprovalRow {
  /** What this person did, shown above their signature at the end of the document: "Prepared by", "Reviewed by", "Approved by". */
  role?: string;
  name: string;
  position: string;
  /** dd/mm/yyyy, or empty while the approval is still pending */
  date: string;
  signature?: GbbSignature | null;
  /** Shown in the Signature column when there is no image, e.g. "Pending Approval". */
  signatureNote?: string;
}

export interface GbbDocumentModel {
  /** The document title shown on the cover and in the footer. */
  title: string;
  /** e.g. GBB/IA/RPT/AUD-2026-003 */
  documentId: string;
  /** e.g. "2.0" (the word "Version" is added by the builders) */
  version: string;
  /** dd/mm/yyyy */
  versionDate: string;
  division: string;
  owner: string;
  author: string;
  approvedBy: string;
  /** Shown top-right of every page header, e.g. "Internal Use Only". */
  classification: string;
  status: string;
  changeHistory: GbbChangeHistoryRow[];
  distribution: GbbDistributionRow[];
  approvals: GbbApprovalRow[];
  /** dd/mm/yyyy — for the closing "Validity and Document Management" section. */
  lastReviewed: string;
  /** Overrides the organisation name on the cover and in the header (defaults to Galaxy Backbone Limited). */
  orgName?: string;
  /** Overrides the standard confidentiality wording on the cover. */
  confidentialityNotice?: string;
}

/**
 * The people who signed (or still have to sign) the document, for the sign-off block at the end of the document.
 * Rows with no real name (the "—" placeholder) are left out.
 */
export const signOffRows = (model: GbbDocumentModel): GbbApprovalRow[] =>
  model.approvals.filter((a) => a.name && a.name !== '—');

/** `Version 2.0` */
export const versionLabel = (version: string): string => `Version ${version}`;

/** dd/mm/yyyy, in UTC, so a document never shows a different day to different readers. */
export const formatGbbDate = (value: Date | string | null | undefined): string => {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
};

/** Splits `data:image/png;base64,...` into bytes + mime, or null if it is not a usable image. */
export const parseImageDataUrl = (dataUrl: string | null | undefined): GbbSignature | null => {
  if (!dataUrl) return null;
  const m = /^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i.exec(dataUrl.trim());
  if (!m) return null;
  try {
    const buffer = Buffer.from(m[2], 'base64');
    return buffer.length > 0 ? { buffer, mime: m[1].toLowerCase() } : null;
  } catch {
    return null;
  }
};
