import { Prisma } from '@prisma/client';
import { decimalToNumber, toIso } from '../../../utility/audit.utility';
import { RiskRegisterResponseDto } from '../../../../risk/register/dto/response/register.response.dto';

export interface UniverseResponseDto {
  id: string;
  name: string;
  description: string | null;
  category: string;
  ownerId: string;
  riskScore: number | null;
  lastAuditedAt: string | null;
  auditFrequency: string;
  status: string;
  createdById: string;
  createdAt: string;
  updatedAt: string;
  risks?: RiskRegisterResponseDto[];
}

export const mapUniverseToResponse = (entity: {
  id: string;
  name: string;
  description: string | null;
  category: string;
  owner_id: string;
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
  riskScore: decimalToNumber(entity.risk_score),
  lastAuditedAt: toIso(entity.last_audited_at),
  auditFrequency: entity.audit_frequency,
  status: entity.status,
  createdById: entity.created_by_id,
  createdAt: entity.created_at.toISOString(),
  updatedAt: entity.updated_at.toISOString(),
});
