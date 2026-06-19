export interface IApprovalSignedDocumentService {
    /** Generate + store the frozen signed artifact for a completed approval. Fire-and-forget safe (never throws). */
    generateForCompletedApproval(approvalId: string): Promise<void>;
}
//# sourceMappingURL=approval-signed-document.service.interface.d.ts.map