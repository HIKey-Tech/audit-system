import { ExceptionSeverity } from '../domain/enum/system-audit.enum';
export declare const SEVERITY_RANK: Record<ExceptionSeverity, number>;
export declare const maxSeverity: (a: ExceptionSeverity, b: ExceptionSeverity) => ExceptionSeverity;
/** Lower-case alphanumerics only — how headers and names are compared. */
export declare const normaliseKey: (value: string) => string;
/**
 * Case-insensitive wildcard match (`*` = any run of characters). Used for SoD
 * rules and privileged-entitlement patterns, which GBB edits as plain text.
 */
export declare const matchesPattern: (value: string, pattern: string) => boolean;
export declare const matchesAny: (value: string, patterns: string[]) => boolean;
export declare const hoursBetween: (from: Date, to: Date) => number;
export declare const daysBetween: (from: Date, to: Date) => number;
export declare const round: (value: number, places?: number) => number;
export declare const parseJson: <T>(value: string | null | undefined, fallback: T) => T;
/**
 * Next yearly reference for a prefix, e.g. SAR-2026-0007. Callers retry once on
 * a unique-constraint clash (two runs created in the same instant).
 */
export declare const nextReference: (prefix: string, latest: string | null | undefined, now?: Date) => string;
export interface UserRef {
    id: string;
    name: string;
}
export declare const toUserRef: (user: {
    id: string;
    display_name: string | null;
    first_name: string;
    last_name: string;
    email: string;
} | null | undefined) => UserRef | null;
//# sourceMappingURL=system-audit.utility.d.ts.map