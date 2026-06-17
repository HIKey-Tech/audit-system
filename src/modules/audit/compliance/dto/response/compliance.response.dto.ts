import { Compliance_Control, Compliance_Framework } from '@prisma/client';
import { toIso } from '../../../utility/audit.utility';

export interface FrameworkResponseDto {
  id: string;
  code: string;
  name: string;
  description: string | null;
  category: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface ControlResponseDto {
  id: string;
  frameworkId: string;
  frameworkCode: string | null;
  frameworkName: string | null;
  controlReference: string;
  controlDescription: string;
  testProcedure: string;
  auditType: string;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export interface FrameworkCoverageDto {
  id: string;
  code: string;
  name: string;
  category: string;
  isActive: boolean;
  totalControls: number;
  activeControls: number;
  byAuditType: Record<string, number>;
}

export interface ComplianceCoverageDto {
  frameworks: FrameworkCoverageDto[];
  totalFrameworks: number;
  totalControls: number;
  activeControls: number;
}

export interface ControlRiskDto {
  riskId: string;
  title: string;
  currentScore: number;
  status: string;
  category: string | null;
}

export interface RiskCoverageItemDto {
  id: string;
  title: string;
  currentScore: number;
  status: string;
  category: string | null;
  mappedControls: number;
  testedControls: number;
}

export interface RiskCoverageDto {
  risks: RiskCoverageItemDto[];
  totalRisks: number;
  coveredRisks: number;
  uncoveredRisks: number;
}

export interface FrameworkTestedCoverageDto {
  id: string;
  code: string;
  name: string;
  category: string;
  totalControls: number;
  testedControls: number;
  coveragePct: number;
  passed: number;
  failed: number;
  notApplicable: number;
  passRatePct: number;
}

export interface TestedCoverageDto {
  frameworks: FrameworkTestedCoverageDto[];
  totalControls: number;
  testedControls: number;
  coveragePct: number;
  passed: number;
  failed: number;
  notApplicable: number;
}

export const mapFrameworkToResponse = (f: Compliance_Framework): FrameworkResponseDto => ({
  id: f.id,
  code: f.code,
  name: f.name,
  description: f.description,
  category: f.category,
  isActive: f.is_active,
  createdAt: toIso(f.created_at),
  updatedAt: toIso(f.updated_at),
});

export const mapControlToResponse = (
  c: Compliance_Control & { framework?: Pick<Compliance_Framework, 'code' | 'name'> | null },
): ControlResponseDto => ({
  id: c.id,
  frameworkId: c.framework_id,
  frameworkCode: c.framework?.code ?? null,
  frameworkName: c.framework?.name ?? null,
  controlReference: c.control_reference,
  controlDescription: c.control_description,
  testProcedure: c.test_procedure,
  auditType: c.audit_type,
  isActive: c.is_active,
  createdAt: toIso(c.created_at),
  updatedAt: toIso(c.updated_at),
});
