export type RepositoryCategory = 'audit_record' | 'supporting_document' | 'evidence';
/**
 * Maps each repository category to the underlying Document.entity_type values.
 * This is the single place that encodes "what counts as a record / supporting
 * document / evidence" — keep it in sync with the audit upload call-sites.
 */
export declare const REPOSITORY_CATEGORY_ENTITY_TYPES: Record<RepositoryCategory, string[]>;
export declare const ALL_REPOSITORY_ENTITY_TYPES: string[];
export declare const categoryForEntityType: (entityType: string | null) => RepositoryCategory | "other";
export interface RepositoryEngagementRef {
    id: string;
    referenceNumber: string;
    title: string;
}
export interface RepositoryItemResponseDto {
    id: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    category: RepositoryCategory | 'other';
    entityType: string | null;
    uploadedAt: string;
    uploadedBy: {
        id: string;
        name: string;
    } | null;
    engagement: RepositoryEngagementRef | null;
}
//# sourceMappingURL=repository.response.dto.d.ts.map