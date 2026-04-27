import { Prisma } from '@prisma/client';
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
export declare const mapUniverseToResponse: (entity: {
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
}) => UniverseResponseDto;
//# sourceMappingURL=universe.response.dto.d.ts.map