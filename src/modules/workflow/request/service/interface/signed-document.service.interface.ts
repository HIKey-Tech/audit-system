// src/modules/workflow/request/service/interface/signed-document.service.interface.ts
export interface SignedDocumentSummary {
  id: string;
  sourceName: string | null; // null = standalone certificate
  signedDocumentId: string;
  downloadUrl: string;
  generatedAt: string;
}

export interface ISignedDocumentService {
  /** Generate signed copies for a completed request. Fire-and-forget safe (never throws). */
  generateForCompletedRequest(requestId: string): Promise<void>;
  list(requestId: string): Promise<SignedDocumentSummary[]>;
}
