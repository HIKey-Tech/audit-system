export interface ResolvedUniverseOwners {
  primaryOwnerId: string;
  additionalOwnerIds: string[];
}

const dedupePreserveOrder = (ids: readonly string[]): string[] => {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const id of ids) {
    if (id && !seen.has(id)) {
      seen.add(id);
      out.push(id);
    }
  }
  return out;
};

/**
 * Resolves either unified `ownerIds` (`[primary, ...coOwners]`) or explicit
 * `ownerId` + `additionalOwnerIds` into a deduplicated primary + co-owner list.
 */
export const resolveUniverseOwners = (
  input: {
    ownerId?: string;
    additionalOwnerIds?: string[];
    ownerIds?: string[];
  },
  existing?: {
    primaryOwnerId: string;
    additionalOwnerIds: string[];
  },
): ResolvedUniverseOwners | null => {
  if (input.ownerIds !== undefined) {
    const unique = dedupePreserveOrder(input.ownerIds);
    if (unique.length === 0) return null;
    return {
      primaryOwnerId: unique[0],
      additionalOwnerIds: unique.slice(1),
    };
  }

  if (input.ownerId === undefined && input.additionalOwnerIds === undefined) {
    return null;
  }

  const primaryOwnerId = input.ownerId ?? existing?.primaryOwnerId;
  if (!primaryOwnerId) return null;

  const baseAdditional = input.additionalOwnerIds ?? existing?.additionalOwnerIds ?? [];
  const additionalOwnerIds = dedupePreserveOrder(baseAdditional).filter((id) => id !== primaryOwnerId);

  return { primaryOwnerId, additionalOwnerIds };
};

export interface UniverseReferenceCounts {
  planItems: number;
  engagements: number;
  risks: number;
  assets: number;
  systemDocs: number;
}

/** Formats non-zero downstream link counts into human-readable blocker clauses. */
export const listUniverseReferenceBlockers = (counts: UniverseReferenceCounts): string[] => {
  const parts: string[] = [];
  if (counts.planItems > 0) {
    parts.push(`${counts.planItems} audit plan item${counts.planItems === 1 ? '' : 's'}`);
  }
  if (counts.engagements > 0) {
    parts.push(`${counts.engagements} engagement${counts.engagements === 1 ? '' : 's'}`);
  }
  if (counts.risks > 0) {
    parts.push(`${counts.risks} linked risk${counts.risks === 1 ? '' : 's'}`);
  }
  if (counts.assets > 0) {
    parts.push(`${counts.assets} linked asset${counts.assets === 1 ? '' : 's'}`);
  }
  if (counts.systemDocs > 0) {
    parts.push(`${counts.systemDocs} system document${counts.systemDocs === 1 ? '' : 's'}`);
  }
  return parts;
};
