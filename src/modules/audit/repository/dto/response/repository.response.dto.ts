export type RepositoryCategory = 'audit_record' | 'supporting_document' | 'evidence';

/**
 * Maps each repository category to the underlying Document.entity_type values.
 * This is the single place that encodes "what counts as a record / supporting
 * document / evidence" — keep it in sync with the audit upload call-sites.
 */
export const REPOSITORY_CATEGORY_ENTITY_TYPES: Record<RepositoryCategory, string[]> = {
  audit_record: ['audit_report', 'audit_working_paper_snapshot'],
  supporting_document: ['audit_working_paper_source'],
  evidence: ['audit_engagement', 'audit_follow_up_evidence'],
};

export const ALL_REPOSITORY_ENTITY_TYPES: string[] = Object.values(REPOSITORY_CATEGORY_ENTITY_TYPES).flat();

const ENTITY_TYPE_TO_CATEGORY: Record<string, RepositoryCategory> = Object.entries(
  REPOSITORY_CATEGORY_ENTITY_TYPES,
).reduce((acc, [category, types]) => {
  for (const type of types) acc[type] = category as RepositoryCategory;
  return acc;
}, {} as Record<string, RepositoryCategory>);

export const categoryForEntityType = (entityType: string | null): RepositoryCategory | 'other' =>
  (entityType && ENTITY_TYPE_TO_CATEGORY[entityType]) || 'other';

export interface RepositoryEngagementRef {
  id: string;
  referenceNumber: string;
  title: string;
}

export interface RepositoryItemResponseDto {
  id: string; // document id — download via GET /audit/repository/:id/download
  fileName: string;
  mimeType: string;
  fileSize: number;
  category: RepositoryCategory | 'other';
  entityType: string | null;
  uploadedAt: string;
  uploadedBy: { id: string; name: string } | null;
  engagement: RepositoryEngagementRef | null;
}
