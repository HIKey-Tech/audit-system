import { Prisma } from '@prisma/client';
import { decimalToNumber, toIso } from '../../../utility/audit.utility';

export interface UniverseLinkedRiskDto {
  id: string;
  title: string;
  currentScore: number;
  status: string;
  categoryName: string | null;
}

export interface UniverseEngagementHistoryDto {
  id: string;
  referenceNumber: string;
  title: string;
  auditType: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
}

export interface UniverseOwnerDto {
  id: string;
  name: string | null;
  isPrimary: boolean;
}

export interface UniverseResponseDto {
  id: string;
  name: string;
  description: string | null;
  category: string;
  ownerId: string;
  ownerName: string | null;
  ownerIds: string[];
  owners: UniverseOwnerDto[];
  riskScore: number | null;
  lastAuditedAt: string | null;
  auditFrequency: string;
  status: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  linkedRisks?: UniverseLinkedRiskDto[];
  engagementHistory?: UniverseEngagementHistoryDto[];
  /** Findings not yet closed across all of this entity's engagements — audit
   * results feeding back into the risk view of the entity. */
  openFindingsCount?: number;
}

type UserNameShape = {
  id?: string;
  display_name: string | null;
  first_name: string;
  last_name: string;
};

const formatOwnerName = (user?: UserNameShape | null): string | null =>
  user ? (user.display_name ?? `${user.first_name} ${user.last_name}`.trim()) || null : null;

export const mapUniverseToResponse = (entity: {
  id: string;
  name: string;
  description: string | null;
  category: string;
  owner_id: string;
  owner?: UserNameShape | null;
  additional_owners?: Array<{
    user_id: string;
    user?: UserNameShape | null;
  }>;
  risk_score: Prisma.Decimal | null;
  last_audited_at: Date | null;
  audit_frequency: string;
  status: string;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}): UniverseResponseDto => {
  const seen = new Set<string>([entity.owner_id]);
  const owners: UniverseOwnerDto[] = [
    {
      id: entity.owner_id,
      name: formatOwnerName(entity.owner),
      isPrimary: true,
    },
  ];

  for (const extra of entity.additional_owners ?? []) {
    if (!extra.user_id || seen.has(extra.user_id)) continue;
    seen.add(extra.user_id);
    owners.push({
      id: extra.user_id,
      name: formatOwnerName(extra.user),
      isPrimary: false,
    });
  }

  return {
    id: entity.id,
    name: entity.name,
    description: entity.description,
    category: entity.category,
    ownerId: entity.owner_id,
    ownerName: formatOwnerName(entity.owner),
    ownerIds: owners.map((o) => o.id),
    owners,
    riskScore: decimalToNumber(entity.risk_score),
    lastAuditedAt: toIso(entity.last_audited_at),
    auditFrequency: entity.audit_frequency,
    status: entity.status,
    createdById: entity.created_by_id,
    createdAt: entity.created_at.toISOString(),
    updatedAt: entity.updated_at.toISOString(),
  };
};
