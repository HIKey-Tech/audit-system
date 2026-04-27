import { RiskScoreBand } from '../domain/enum/risk.enum';
export declare const RISK_ADMIN_ROLES: readonly string[];
export declare const RISK_ASSESSOR_ROLES: readonly string[];
export declare const AUDITEE_ROLE = "auditee";
export declare const hasAuditeeRole: (roles: string[]) => boolean;
export declare const assertHasRole: (roles: string[], allowedRoles: readonly string[], message?: string) => void;
export declare const calculateRiskScore: (likelihood: number, impact: number) => number;
export declare const getRiskScoreBand: (score: number) => RiskScoreBand;
export declare const toIso: (value: Date | null) => string | null;
//# sourceMappingURL=risk.utility.d.ts.map