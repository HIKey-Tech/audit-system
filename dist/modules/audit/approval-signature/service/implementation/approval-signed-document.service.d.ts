import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { ReportGenerationService } from '../../../report/service/implementation/report-generation.service';
import { WorkingPaperService } from '../../../working-papers/service/implementation/working-paper.service';
import { IApprovalSignedDocumentService } from '../interface/approval-signed-document.service.interface';
export declare class ApprovalSignedDocumentService implements IApprovalSignedDocumentService {
    private readonly documents;
    private readonly reportGen;
    private readonly workingPapers;
    constructor(documents?: IDocumentService, reportGen?: ReportGenerationService, workingPapers?: WorkingPaperService);
    generateForCompletedApproval(approvalId: string): Promise<void>;
    private _renderForEntity;
    private _certificateData;
    /** Signature-panel entries from approved steps, embedding each approver's recorded signature image. */
    private _approverEntries;
}
export declare const approvalSignedDocumentService: ApprovalSignedDocumentService;
//# sourceMappingURL=approval-signed-document.service.d.ts.map