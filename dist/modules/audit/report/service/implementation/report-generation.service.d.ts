import { IReportTemplateService } from '../../../../settings/service/interface/report-template.service.interface';
import { ISystemConfigService } from '../../../../settings/service/interface/system-config.service.interface';
import { IApprovalService } from '../../../../workflow/approval/service/interface/approval.service.interface';
import { ReportTemplateResponseDto } from '../../../../settings/dto/response/settings.response.dto';
import { IDocumentService } from '../../../../document/service/interface/document.service.interface';
import { IReportGenerationService } from '../interface/report-generation.service.interface';
interface ReportUserBrief {
    displayName: string | null;
    firstName: string;
    lastName: string;
    jobTitle: string | null;
}
interface ReportFinding {
    id: string;
    title: string;
    description: string;
    category: string;
    severity: string;
    rootCause: string;
    riskImplication: string;
    recommendation: string;
    status: string;
    dueDate: Date;
    auditee: {
        displayName: string | null;
        firstName: string;
        lastName: string;
    };
    followUp: {
        managementResponse: string | null;
        managementResponseBy: {
            displayName: string | null;
            firstName: string;
            lastName: string;
        } | null;
        managementResponseAt: Date | null;
        verificationStatus: string;
        verifiedBy: {
            displayName: string | null;
            firstName: string;
            lastName: string;
        } | null;
        verifiedAt: Date | null;
        verificationNotes: string | null;
    } | null;
}
interface ReportData {
    report: {
        id: string;
        title: string;
        executiveSummary: string;
        scope: string;
        methodology: string;
        status: string;
        versionNumber: number;
        issuedAt: Date | null;
        createdById: string;
        templateId: string | null;
    };
    engagement: {
        id: string;
        referenceNumber: string;
        title: string;
        auditType: string;
        plannedStartDate: Date;
        plannedEndDate: Date;
        actualStartDate: Date | null;
        universe: {
            name: string;
        };
        leadAuditor: ReportUserBrief;
        auditManager: ReportUserBrief;
        auditee: ReportUserBrief;
    };
    findings: ReportFinding[];
    assetsInScope: ReportAsset[];
}
interface ReportAsset {
    assetTag: string;
    name: string;
    assetType: string;
    criticality: string;
    scopeRole: string;
}
interface TemplateConfig {
    template: ReportTemplateResponseDto;
    orgName: string;
    orgAddress: string;
    footerNotice: string;
}
export declare class ReportGenerationService implements IReportGenerationService {
    private readonly reportTemplateService;
    private readonly systemConfigService;
    private readonly approvalService;
    private readonly documentService;
    constructor(reportTemplateService: IReportTemplateService, systemConfigService: ISystemConfigService, approvalService: IApprovalService, documentService?: IDocumentService);
    /** Load each approved step's recorded signature image, keyed by step id. Never throws. */
    private _stepSignatures;
    /** The first reviewer (lowest approved level) and final approver (highest approved level). */
    private _signOffSteps;
    fetchReportData(reportId: string): Promise<ReportData>;
    fetchTemplateAndConfig(templateId?: string | null): Promise<TemplateConfig>;
    generateDocx(reportId: string): Promise<Buffer>;
    private _buildDocxDocument;
    private _buildDocxHeader;
    private _buildDocxMetadataTable;
    private _docxMetadataRow;
    private _buildDocxSectionContent;
    private _buildDocxFindingsSummaryTable;
    private _buildDocxAssetsInScopeTable;
    private _docxHeaderCell;
    private _severityDocxCell;
    private _buildDocxDetailedFindings;
    private _buildDocxFindingDetailsTable;
    private _buildDocxSignatureBlock;
    generatePdf(reportId: string): Promise<Buffer>;
    private _buildPdfDocDefinition;
    private _getHeaderConfig;
    private _getFooterNotice;
    private _getSignatureLabels;
    private _escapeHtml;
    exportReport(reportId: string, format: 'docx' | 'pdf'): Promise<{
        buffer: Buffer;
        filename: string;
        mimeType: string;
    }>;
}
export {};
//# sourceMappingURL=report-generation.service.d.ts.map