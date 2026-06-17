import { Compliance_Control, Compliance_Framework } from '@prisma/client';
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
export declare const mapFrameworkToResponse: (f: Compliance_Framework) => FrameworkResponseDto;
export declare const mapControlToResponse: (c: Compliance_Control & {
    framework?: Pick<Compliance_Framework, "code" | "name"> | null;
}) => ControlResponseDto;
//# sourceMappingURL=compliance.response.dto.d.ts.map