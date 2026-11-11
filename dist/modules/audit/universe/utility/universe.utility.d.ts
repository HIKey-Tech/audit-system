export interface ResolvedUniverseOwners {
    primaryOwnerId: string;
    additionalOwnerIds: string[];
}
/**
 * Resolves either unified `ownerIds` (`[primary, ...coOwners]`) or explicit
 * `ownerId` + `additionalOwnerIds` into a deduplicated primary + co-owner list.
 */
export declare const resolveUniverseOwners: (input: {
    ownerId?: string;
    additionalOwnerIds?: string[];
    ownerIds?: string[];
}, existing?: {
    primaryOwnerId: string;
    additionalOwnerIds: string[];
}) => ResolvedUniverseOwners | null;
export interface UniverseReferenceCounts {
    planItems: number;
    engagements: number;
    risks: number;
    assets: number;
    systemDocs: number;
}
/** Formats non-zero downstream link counts into human-readable blocker clauses. */
export declare const listUniverseReferenceBlockers: (counts: UniverseReferenceCounts) => string[];
//# sourceMappingURL=universe.utility.d.ts.map