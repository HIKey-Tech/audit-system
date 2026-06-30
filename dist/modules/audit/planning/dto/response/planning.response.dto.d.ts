import { UniverseResponseDto, mapUniverseToResponse } from '../../../universe/dto/response/universe.response.dto';
export interface PlanItemResponseDto {
    id: string;
    planId: string;
    universeId: string;
    universeName: string | null;
    auditType: string;
    plannedStartDate: string;
    plannedEndDate: string;
    priority: string;
    engagementCreated: boolean;
    engagementId: string | null;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
    universe?: UniverseResponseDto;
}
export interface PlanResponseDto {
    id: string;
    title: string;
    year: number;
    description: string | null;
    status: string;
    createdById: string;
    approvedById: string | null;
    approvedByName: string | null;
    approvedAt: string | null;
    rejectionReason: string | null;
    itemsCount: number;
    createdAt: string;
    updatedAt: string;
    items?: PlanItemResponseDto[];
    warnings?: string[];
}
export declare const mapPlanItemToResponse: (item: {
    id: string;
    plan_id: string;
    universe_id: string;
    audit_type: string;
    planned_start_date: Date;
    planned_end_date: Date;
    priority: string;
    notes: string | null;
    engagement_created: boolean;
    created_at: Date;
    updated_at: Date;
    universe?: Parameters<typeof mapUniverseToResponse>[0];
    engagements?: Array<{
        id: string;
    }>;
}) => PlanItemResponseDto;
export declare const mapPlanToResponse: (plan: {
    id: string;
    title: string;
    year: number;
    description: string | null;
    status: string;
    created_by_id: string;
    approved_by_id: string | null;
    approved_by?: {
        display_name: string | null;
        first_name: string;
        last_name: string;
    } | null;
    approved_at: Date | null;
    rejection_reason: string | null;
    created_at: Date;
    updated_at: Date;
    items?: Array<Parameters<typeof mapPlanItemToResponse>[0]>;
    _count?: {
        items: number;
    };
}, warnings?: string[]) => PlanResponseDto;
//# sourceMappingURL=planning.response.dto.d.ts.map