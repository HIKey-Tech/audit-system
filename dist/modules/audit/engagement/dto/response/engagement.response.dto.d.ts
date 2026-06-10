import { ChecklistProgress, FindingSeverityCount } from '../../../domain/entity/audit.entity';
import { UniverseResponseDto, mapUniverseToResponse } from '../../../universe/dto/response/universe.response.dto';
export interface EngagementResponseDto {
    id: string;
    referenceNumber: string;
    title: string;
    universeId: string;
    planItemId: string | null;
    planTitle: string | null;
    auditType: string;
    status: string;
    priority: string;
    leadAuditorId: string;
    auditManagerId: string;
    auditeeId: string;
    plannedStartDate: string;
    plannedEndDate: string;
    actualStartDate: string | null;
    actualEndDate: string | null;
    slaDeadline: string;
    isAdhoc: boolean;
    adhocReason: string | null;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    universe?: UniverseResponseDto;
    findingCounts?: FindingSeverityCount[];
    workingPaperCount?: number;
    checklistProgress?: ChecklistProgress;
}
export declare const mapEngagementToResponse: (engagement: {
    id: string;
    reference_number: string;
    title: string;
    universe_id: string;
    plan_item_id: string | null;
    audit_type: string;
    status: string;
    priority: string;
    lead_auditor_id: string;
    audit_manager_id: string;
    auditee_id: string;
    planned_start_date: Date;
    planned_end_date: Date;
    actual_start_date: Date | null;
    actual_end_date: Date | null;
    sla_deadline: Date;
    is_adhoc: boolean;
    adhoc_reason: string | null;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
    universe?: Parameters<typeof mapUniverseToResponse>[0];
    plan_item?: {
        plan?: {
            title: string;
        } | null;
    } | null;
}, extras?: {
    findingCounts?: FindingSeverityCount[];
    workingPaperCount?: number;
    checklistProgress?: ChecklistProgress;
}) => EngagementResponseDto;
//# sourceMappingURL=engagement.response.dto.d.ts.map