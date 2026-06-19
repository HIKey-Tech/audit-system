export interface SignedDocumentSummary {
    id: string;
    sourceName: string | null;
    signedDocumentId: string;
    downloadUrl: string;
    generatedAt: string;
}
export interface ISignedDocumentService {
    /** Generate signed copies for a completed request. Fire-and-forget safe (never throws). */
    generateForCompletedRequest(requestId: string): Promise<void>;
    list(requestId: string): Promise<SignedDocumentSummary[]>;
}
//# sourceMappingURL=signed-document.service.interface.d.ts.map