import { SystemDocumentWithRelations } from '../../../../../shared/prisma/prisma.types';
import { UserRef, daysBetween, toUserRef } from '../../../utility/system-audit.utility';

export const REVIEW_DUE_SOON_DAYS = 30;
export const CONTRACT_EXPIRING_DAYS = 60;

export interface SystemDocumentResponseDto {
  id: string;
  title: string;
  docType: string;
  description: string | null;
  versionLabel: string | null;
  owner: UserRef | null;
  universe: { id: string; name: string } | null;
  asset: { id: string; assetTag: string; name: string } | null;
  vendor: string | null;
  effectiveDate: string | null;
  reviewDueDate: string | null;
  expiryDate: string | null;
  status: string;
  file: {
    documentId: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    versionNumber: number;
    contentSha256: string | null;
  };
  /** Null when no review date is set. */
  reviewState: 'ok' | 'due_soon' | 'overdue' | null;
  /** Null when no expiry date is set. */
  contractState: 'ok' | 'expiring' | 'expired' | null;
  createdBy: UserRef | null;
  createdAt: string;
  updatedAt: string;
}

export interface SystemDocumentSummaryDto {
  total: number;
  byType: Record<string, number>;
  reviewOverdue: number;
  reviewDueSoon: number;
  contractsExpired: number;
  contractsExpiring: number;
}

const dateState = <T extends string>(
  date: Date | null,
  now: Date,
  soonDays: number,
  labels: { ok: T; soon: T; past: T },
): T | null => {
  if (!date) return null;
  if (date < now) return labels.past;
  return daysBetween(now, date) <= soonDays ? labels.soon : labels.ok;
};

export const mapSystemDocumentToResponse = (doc: SystemDocumentWithRelations, now = new Date()): SystemDocumentResponseDto => ({
  id: doc.id,
  title: doc.title,
  docType: doc.doc_type,
  description: doc.description,
  versionLabel: doc.version_label,
  owner: toUserRef(doc.owner),
  universe: doc.universe ? { id: doc.universe.id, name: doc.universe.name } : null,
  asset: doc.asset ? { id: doc.asset.id, assetTag: doc.asset.asset_tag, name: doc.asset.name } : null,
  vendor: doc.vendor,
  effectiveDate: doc.effective_date?.toISOString() ?? null,
  reviewDueDate: doc.review_due_date?.toISOString() ?? null,
  expiryDate: doc.expiry_date?.toISOString() ?? null,
  status: doc.status,
  file: {
    documentId: doc.document.id,
    fileName: doc.document.original_name,
    mimeType: doc.document.mime_type,
    fileSize: doc.document.file_size,
    versionNumber: doc.document.version_number,
    contentSha256: doc.document.content_sha256,
  },
  reviewState: dateState(doc.review_due_date, now, REVIEW_DUE_SOON_DAYS, { ok: 'ok', soon: 'due_soon', past: 'overdue' }),
  contractState: dateState(doc.expiry_date, now, CONTRACT_EXPIRING_DAYS, { ok: 'ok', soon: 'expiring', past: 'expired' }),
  createdBy: toUserRef(doc.created_by),
  createdAt: doc.created_at.toISOString(),
  updatedAt: doc.updated_at.toISOString(),
});
