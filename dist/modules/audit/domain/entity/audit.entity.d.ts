export interface ActorContext {
    id: string;
    roles: string[];
    permissions: string[];
}
export interface ExportedAuditFile {
    fileName: string;
    mimeType: string;
    buffer: Buffer;
}
export interface FindingSeverityCount {
    severity: string;
    count: number;
}
export interface ChecklistProgress {
    passed: number;
    failed: number;
    notApplicable: number;
    notTested: number;
    total: number;
}
export interface WorkingPaperStats {
    total: number;
    approved: number;
    rejected: number;
}
export interface FindingStats {
    total: number;
    open: number;
    unresolved: number;
}
//# sourceMappingURL=audit.entity.d.ts.map