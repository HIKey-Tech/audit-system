import { Imoc_Ticket_Link, Imoc_Ticket_Snapshot } from '@prisma/client';
import { ImocTicket } from '../../domain/entity/imoc.entity';

export interface ImocTicketLinkResponseDto {
  id: string;
  engagementId: string;
  orderId: string;
  orderNumber: string;
  orderName: string | null;
  modelId: string | null;
  modelName: string | null;
  modelType: string | null;
  lastStatus: string | null;
  lastSlaStatus: string | null;
  lastStepName: string | null;
  lastStepSequence: number | null;
  lastSyncedAt: string | null;
  lastSyncError: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ImocTicketSnapshotResponseDto {
  id: string;
  ticketLinkId: string;
  auditEvidenceId: string | null;
  status: string | null;
  slaStatus: string | null;
  payloadSha256: string;
  sourceRetrievedAt: string;
  capturedById: string;
  createdAt: string;
}

export const mapImocTicketLinkToResponse = (link: Imoc_Ticket_Link): ImocTicketLinkResponseDto => ({
  id: link.id,
  engagementId: link.engagement_id,
  orderId: link.order_id,
  orderNumber: link.order_number,
  orderName: link.order_name,
  modelId: link.model_id,
  modelName: link.model_name,
  modelType: link.model_type,
  lastStatus: link.last_status,
  lastSlaStatus: link.last_sla_status,
  lastStepName: link.last_step_name,
  lastStepSequence: link.last_step_sequence,
  lastSyncedAt: link.last_synced_at?.toISOString() ?? null,
  lastSyncError: link.last_sync_error,
  isActive: link.is_active,
  createdAt: link.created_at.toISOString(),
  updatedAt: link.updated_at.toISOString(),
});

export const mapImocSnapshotToResponse = (
  snapshot: Imoc_Ticket_Snapshot,
): ImocTicketSnapshotResponseDto => ({
  id: snapshot.id,
  ticketLinkId: snapshot.imoc_ticket_link_id,
  auditEvidenceId: snapshot.audit_evidence_id,
  status: snapshot.status,
  slaStatus: snapshot.sla_status,
  payloadSha256: snapshot.payload_sha256,
  sourceRetrievedAt: snapshot.source_retrieved_at.toISOString(),
  capturedById: snapshot.captured_by_id,
  createdAt: snapshot.created_at.toISOString(),
});

export const ticketLinkFields = (ticket: ImocTicket) => ({
  order_id: ticket.orderId,
  order_number: ticket.orderNumber,
  order_name: ticket.orderName,
  model_id: ticket.modelId,
  model_name: ticket.modelName,
  model_type: ticket.modelType,
  last_status: ticket.orderStatus,
  last_sla_status: ticket.slaStatus,
  last_step_name: ticket.currentStepName,
  last_step_sequence: ticket.currentStepSequence,
  last_synced_at: new Date(ticket.retrievedAt),
  last_sync_error: null,
});

export interface ImocRealStatusResponseDto {
  reachable: boolean;
  authenticated: boolean;
  lastError: string | null;
  checkedAt: string;
}

// ---------------------------------------------------------------------------
// Ingestion Rule & Run Responses
// ---------------------------------------------------------------------------

export interface ImocIngestionRuleResponseDto {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  priority: number;
  criteria: Record<string, unknown>;
  category: string | null;
  riskCategoryId: string | null;
  lookbackDays: number;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  lastRunFetched: number | null;
  lastRunIngested: number | null;
  lastRunError: string | null;
  createdById: string;
  updatedById: string | null;
  createdAt: string;
  updatedAt: string;
}

export const mapImocRuleToResponse = (rule: any): ImocIngestionRuleResponseDto => {
  let criteria: Record<string, unknown> = {};
  try {
    criteria = typeof rule.criteria_json === 'string' ? JSON.parse(rule.criteria_json) : (rule.criteria_json || {});
  } catch {
    criteria = {};
  }

  return {
    id: rule.id,
    name: rule.name,
    description: rule.description,
    isActive: rule.is_active,
    priority: rule.priority,
    criteria,
    category: rule.category,
    riskCategoryId: rule.risk_category_id,
    lookbackDays: rule.lookback_days,
    lastRunAt: rule.last_run_at ? new Date(rule.last_run_at).toISOString() : null,
    lastRunStatus: rule.last_run_status,
    lastRunFetched: rule.last_run_fetched,
    lastRunIngested: rule.last_run_ingested,
    lastRunError: rule.last_run_error,
    createdById: rule.created_by_id,
    updatedById: rule.updated_by_id,
    createdAt: new Date(rule.created_at).toISOString(),
    updatedAt: new Date(rule.updated_at).toISOString(),
  };
};

export interface ImocIngestionRunResponseDto {
  id: string;
  trigger: string;
  triggeredById: string | null;
  startedAt: string;
  finishedAt: string | null;
  status: string;
  rulesEvaluated: number;
  fetched: number;
  created: number;
  updated: number;
  skipped: number;
  errorSummary: string | null;
  createdAt: string;
}

export const mapImocRunToResponse = (run: any): ImocIngestionRunResponseDto => ({
  id: run.id,
  trigger: run.trigger,
  triggeredById: run.triggered_by_id,
  startedAt: new Date(run.started_at).toISOString(),
  finishedAt: run.finished_at ? new Date(run.finished_at).toISOString() : null,
  status: run.status,
  rulesEvaluated: run.rules_evaluated,
  fetched: run.fetched,
  created: run.created,
  updated: run.updated,
  skipped: run.skipped,
  errorSummary: run.error_summary,
  createdAt: new Date(run.created_at).toISOString(),
});

// ---------------------------------------------------------------------------
// Stored Ticket Responses
// ---------------------------------------------------------------------------

export interface ImocStoredTicketResponseDto {
  id: string;
  orderId: string;
  orderNumber: string;
  orderName: string | null;
  modelId: string | null;
  modelName: string | null;
  modelType: string | null;
  orderSource: string | null;
  orderStatus: string | null;
  slaStatus: string | null;
  priority: string | null;
  currentHandler: string | null;
  createdByName: string | null;
  imocCreatedAt: string | null;
  imocEndedAt: string | null;
  category: string | null;
  matchedRuleIds: string[];
  matchedRuleNames?: string[];
  linkedEngagementCount: number;
  linkedRiskCount: number;
  firstIngestedAt: string;
  lastSyncedAt: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const mapImocStoredTicketToResponse = (
  ticket: any,
  ruleNameMap?: Map<string, string>,
): ImocStoredTicketResponseDto => {
  let matchedRuleIds: string[] = [];
  try {
    matchedRuleIds = typeof ticket.matched_rule_ids === 'string'
      ? JSON.parse(ticket.matched_rule_ids)
      : (Array.isArray(ticket.matched_rule_ids) ? ticket.matched_rule_ids : []);
  } catch {
    matchedRuleIds = [];
  }

  const matchedRuleNames = ruleNameMap
    ? matchedRuleIds.map((id) => ruleNameMap.get(id) || id)
    : undefined;

  const linkedEngagementCount =
    typeof ticket._count?.ticket_links === 'number'
      ? ticket._count.ticket_links
      : (Array.isArray(ticket.ticket_links) ? ticket.ticket_links.length : 0);

  const linkedRiskCount =
    typeof ticket._count?.risk_links === 'number'
      ? ticket._count.risk_links
      : (Array.isArray(ticket.risk_links) ? ticket.risk_links.length : 0);

  return {
    id: ticket.id,
    orderId: ticket.order_id,
    orderNumber: ticket.order_number,
    orderName: ticket.order_name,
    modelId: ticket.model_id,
    modelName: ticket.model_name,
    modelType: ticket.model_type,
    orderSource: ticket.order_source,
    orderStatus: ticket.order_status,
    slaStatus: ticket.sla_status,
    priority: ticket.priority,
    currentHandler: ticket.current_handler,
    createdByName: ticket.created_by_name,
    imocCreatedAt: ticket.imoc_created_at ? new Date(ticket.imoc_created_at).toISOString() : null,
    imocEndedAt: ticket.imoc_ended_at ? new Date(ticket.imoc_ended_at).toISOString() : null,
    category: ticket.category,
    matchedRuleIds,
    matchedRuleNames,
    linkedEngagementCount,
    linkedRiskCount,
    firstIngestedAt: new Date(ticket.first_ingested_at).toISOString(),
    lastSyncedAt: new Date(ticket.last_synced_at).toISOString(),
    isActive: ticket.is_active,
    createdAt: new Date(ticket.created_at).toISOString(),
    updatedAt: new Date(ticket.updated_at).toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Saved View Responses
// ---------------------------------------------------------------------------

export interface ImocSavedViewResponseDto {
  id: string;
  name: string;
  filters: Record<string, unknown>;
  ownerId: string;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
}

export const mapImocSavedViewToResponse = (view: any): ImocSavedViewResponseDto => {
  let filters: Record<string, unknown> = {};
  try {
    filters = typeof view.filters_json === 'string' ? JSON.parse(view.filters_json) : (view.filters_json || {});
  } catch {
    filters = {};
  }

  return {
    id: view.id,
    name: view.name,
    filters,
    ownerId: view.owner_id,
    isDefault: view.is_default,
    createdAt: new Date(view.created_at).toISOString(),
    updatedAt: new Date(view.updated_at).toISOString(),
  };
};

// ---------------------------------------------------------------------------
// Risk Link Responses
// ---------------------------------------------------------------------------

export interface ImocTicketRiskLinkResponseDto {
  id: string;
  imocTicketId: string;
  riskId: string;
  notes: string | null;
  createdById: string;
  createdAt: string;
  risk?: {
    id: string;
    title: string;
    status: string;
    currentScore: number;
  };
}

export const mapImocRiskLinkToResponse = (link: any): ImocTicketRiskLinkResponseDto => ({
  id: link.id,
  imocTicketId: link.imoc_ticket_id,
  riskId: link.risk_id,
  notes: link.notes,
  createdById: link.created_by_id,
  createdAt: new Date(link.created_at).toISOString(),
  risk: link.risk
    ? {
        id: link.risk.id,
        title: link.risk.title,
        status: link.risk.status,
        currentScore: link.risk.current_score,
      }
    : undefined,
});

