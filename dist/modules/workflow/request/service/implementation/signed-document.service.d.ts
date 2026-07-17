import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ISignedDocumentService, SignedDocumentSummary } from '../interface/signed-document.service.interface';
export declare class SignedDocumentService implements ISignedDocumentService {
    private readonly documents;
    constructor(documents: IDocumentService);
    generateForCompletedRequest(requestId: string): Promise<void>;
    /** Fire-and-forget generation means failures are otherwise invisible — tell the initiator. Best-effort. */
    private _notifyGenerationFailure;
    list(requestId: string): Promise<SignedDocumentSummary[]>;
    private _buildEntries;
    private _store;
}
export declare const signedDocumentService: SignedDocumentService;
//# sourceMappingURL=signed-document.service.d.ts.map