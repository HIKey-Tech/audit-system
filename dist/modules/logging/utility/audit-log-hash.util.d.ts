/** The immutable fields of an audit-log row that the seal covers. */
export interface SealableLogFields {
    id: string;
    user_id: string | null;
    action: string;
    module: string;
    entity_type: string | null;
    entity_id: string | null;
    old_values: string | null;
    new_values: string | null;
    ip_address: string | null;
    user_agent: string | null;
    status: string;
    error_message: string | null;
    duration_ms: number | null;
    created_at: Date | string;
}
export type SealedLogRow = SealableLogFields & {
    prev_hash: string | null;
    row_hash: string | null;
};
export interface ChainVerificationResult {
    ok: boolean;
    sealedCount: number;
    verifiedCount: number;
    brokenAtId?: string;
    reason?: string;
}
/** SHA-256 hex seal for one row, committing the previous row's hash. */
export declare const computeRowHash: (fields: SealableLogFields, prevHash: string | null) => string;
export declare const verifyLogChain: (rows: SealedLogRow[]) => ChainVerificationResult;
//# sourceMappingURL=audit-log-hash.util.d.ts.map