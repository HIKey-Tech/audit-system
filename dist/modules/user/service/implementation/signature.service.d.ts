import { IDocumentService } from '../../../document/service/interface/document.service.interface';
import { SetSignatureDto } from '../../dto/request/signature.request.dto';
import { UserSignatureResponseDto } from '../../dto/response/signature.response.dto';
import { IUserSignatureService } from '../interface/signature.service.interface';
export declare class UserSignatureService implements IUserSignatureService {
    private readonly documents;
    constructor(documents: IDocumentService);
    setSignature(dto: SetSignatureDto): Promise<UserSignatureResponseDto>;
    getActiveSignature(userId: string): Promise<UserSignatureResponseDto | null>;
    getActiveSignatureRef(userId: string): Promise<{
        id: string;
        documentId: string;
    } | null>;
    removeSignature(userId: string): Promise<void>;
}
export declare const userSignatureService: UserSignatureService;
//# sourceMappingURL=signature.service.d.ts.map