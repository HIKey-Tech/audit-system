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

export interface UniverseResponseDto {
  id: string;
  name: string;
  description: string | null;
  category: string;
  ownerId: string;
  ownerName: string | null;
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

export const mapUniverseToResponse = (entity: {
  id: string;
  name: string;
  description: string | null;
  category: string;
  owner_id: string;
  owner?: { display_name: string | null; first_name: string; last_name: string } | null;
  risk_score: Prisma.Decimal | null;
  last_audited_at: Date | null;
  audit_frequency: string;
  status: string;
  created_by_id: string;
  created_at: Date;
  updated_at: Date;
}): UniverseResponseDto => ({
  id: entity.id,
  name: entity.name,
  description: entity.description,
  category: entity.category,
  ownerId: entity.owner_id,
  ownerName: entity.owner
    ? entity.owner.display_name ?? `${entity.owner.first_name} ${entity.owner.last_name}`.trim()
    : null,
  riskScore: decimalToNumber(entity.risk_score),
  lastAuditedAt: toIso(entity.last_audited_at),
  auditFrequency: entity.audit_frequency,
  status: entity.status,
  createdById: entity.created_by_id,
  createdAt: entity.created_at.toISOString(),
  updatedAt: entity.updated_at.toISOString(),
});
