import { RiskScoreBand } from '../domain/enum/risk.enum';
/** Permission-based authorization gate (see audit.utility for rationale). */
export declare const assertHasPermission: (permissions: string[], required: string, message?: string) => void;
export declare const calculateRiskScore: (likelihood: number, impact: number) => number;
export declare const getRiskScoreBand: (score: number) => RiskScoreBand;
export declare const toIso: (value: Date | null) => string | null;
//# sourceMappingURL=risk.utility.d.ts.map