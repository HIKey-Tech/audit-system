import { ChecklistProgress, FindingSeverityCount, FindingStats, WorkingPaperStats } from '../../../domain/entity/audit.entity';
import { UniverseResponseDto, mapUniverseToResponse } from '../../../universe/dto/response/universe.response.dto';
interface UserNameFields {
    first_name: string;
    last_name: string;
    display_name: string | null;
}
/** A permission-eligible candidate for a lead-auditor / audit-manager slot,
 *  scored for resource optimization (skill fit + workload + priority). */
export interface EligibleUserDto {
    id: string;
    displayName: string;
    department: string | null;
    jobTitle: string | null;
    skills: string[];
    matchedSkills: string[];
    activeEngagementCount: number;
    recommendationScore: number;
    recommended: boolean;
    overCapacity: boolean;
}
export interface ViewerContext {
    role: 'oversight' | 'team' | 'auditee';
    canViewWorkingPapers: boolean;
    canViewInternalEvidence: boolean;
    canViewChecklists: boolean;
    canViewDraftFindings: boolean;
}
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
    leadAuditorName?: string | null;
    auditManagerName?: string | null;
    auditeeName?: string | null;
    plannedStartDate: string;
    plannedEndDate: string;
    actualStartDate: string | null;
    actualEndDate: string | null;
    slaDeadline: string;
    isAdhoc: boolean;
    adhocReason: string | null;
    plannedHours: number | null;
    /** Sum of logged time entries; only populated on the detail response. */
    actualHours?: number;
    createdById: string;
    createdAt: string;
    updatedAt: string;
    universe?: UniverseResponseDto;
    findingCounts?: FindingSeverityCount[];
    workingPaperCount?: number;
    checklistProgress?: ChecklistProgress;
    workingPaperStats?: WorkingPaperStats;
    findingStats?: FindingStats;
    reportStatus?: string | null;
    evidenceCount?: number;
    assetCount?: number;
    viewerContext?: ViewerContext;
    /** Why the engagement hasn't auto-advanced to the next status yet (empty/absent
     * when there's no forward gate to report, e.g. status is planned or closed). */
    pendingGates?: string[];
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
    planned_hours: number | null;
    created_by_id: string;
    created_at: Date;
    updated_at: Date;
    universe?: Parameters<typeof mapUniverseToResponse>[0];
    plan_item?: {
        plan?: {
            title: string;
        } | null;
    } | null;
    lead_auditor?: UserNameFields | null;
    audit_manager?: UserNameFields | null;
    auditee?: UserNameFields | null;
}, extras?: {
    findingCounts?: FindingSeverityCount[];
    workingPaperCount?: number;
    checklistProgress?: ChecklistProgress;
    workingPaperStats?: WorkingPaperStats;
    findingStats?: FindingStats;
    reportStatus?: string | null;
    evidenceCount?: number;
    assetCount?: number;
    actualHours?: number;
}) => EngagementResponseDto;
export {};
//# sourceMappingURL=engagement.response.dto.d.ts.map