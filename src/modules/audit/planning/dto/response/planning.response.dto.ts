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

export const mapPlanItemToResponse = (item: {
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
  engagements?: Array<{ id: string }>;
}): PlanItemResponseDto => ({
  id: item.id,
  planId: item.plan_id,
  universeId: item.universe_id,
  universeName: item.universe?.name ?? null,
  auditType: item.audit_type,
  plannedStartDate: item.planned_start_date.toISOString(),
  plannedEndDate: item.planned_end_date.toISOString(),
  priority: item.priority,
  engagementCreated: item.engagement_created,
  engagementId: item.engagements?.[0]?.id ?? null,
  notes: item.notes ?? null,
  createdAt: item.created_at.toISOString(),
  updatedAt: item.updated_at.toISOString(),
  universe: item.universe ? mapUniverseToResponse(item.universe) : undefined,
});

export const mapPlanToResponse = (
  plan: {
    id: string;
    title: string;
    year: number;
    description: string | null;
    status: string;
    created_by_id: string;
    approved_by_id: string | null;
    approved_by?: { display_name: string | null; first_name: string; last_name: string } | null;
    approved_at: Date | null;
    rejection_reason: string | null;
    created_at: Date;
    updated_at: Date;
    items?: Array<Parameters<typeof mapPlanItemToResponse>[0]>;
    _count?: { items: number };
  },
  warnings?: string[],
): PlanResponseDto => ({
  id: plan.id,
  title: plan.title,
  year: plan.year,
  description: plan.description,
  status: plan.status,
  createdById: plan.created_by_id,
  approvedById: plan.approved_by_id,
  approvedByName: plan.approved_by
    ? plan.approved_by.display_name ?? `${plan.approved_by.first_name} ${plan.approved_by.last_name}`.trim()
    : null,
  approvedAt: plan.approved_at?.toISOString() ?? null,
  rejectionReason: plan.rejection_reason,
  itemsCount: plan.items?.length ?? plan._count?.items ?? 0,
  createdAt: plan.created_at.toISOString(),
  updatedAt: plan.updated_at.toISOString(),
  items: plan.items?.map(mapPlanItemToResponse),
  warnings,
});
