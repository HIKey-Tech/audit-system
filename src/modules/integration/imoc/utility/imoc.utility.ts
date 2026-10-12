import { createHash } from 'crypto';
import { z } from 'zod';
import { AppError } from '../../../../shared/errors/app.error';
import {
  ImocModelSummary,
  ImocProcessingRecord,
  ImocRuleCriteria,
  ImocTicket,
  ImocTicketSearch,
} from '../domain/entity/imoc.entity';

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() !== '' ? value : null;

const asNumber = (value: unknown): number | null => {
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : []);

const nestedGroupName = (value: unknown): string | null => {
  const first = asArray(value)[0];
  return isRecord(first) ? asString(first.groupName) : null;
};

const mapProcessingRecord = (value: unknown): ImocProcessingRecord | null => {
  if (!isRecord(value)) return null;
  return {
    handleOpinion: asString(value.handleOpinion),
    handleResult: asString(value.handleResult),
    handleTime: asString(value.handleTime),
    handleUser: asString(value.handleUser),
    handleGroupName: asString(value.handleGroupName),
    stepName: asString(value.stepName),
  };
};

/** Maps a vendor response into the allow-listed ticket projection. */
export const normalizeImocTicket = (value: unknown): ImocTicket => {
  if (!isRecord(value)) throw new Error('IMOC returned an invalid ticket payload');
  const orderId = asString(value.orderId);
  const orderNumber = asString(value.orderNumber);
  if (!orderId || !orderNumber) {
    throw new Error('IMOC ticket response did not include both orderId and orderNumber');
  }

  return {
    orderId,
    orderNumber,
    orderName: asString(value.orderName),
    modelId: asString(value.modelId),
    modelName: asString(value.modelName),
    modelType: asString(value.modelType),
    orderStatus: asString(value.orderStatus),
    slaStatus: asString(value.slaStatus),
    priority: asString(value.orderPriority) ?? asString(value.priority),
    currentStepId: asString(value.currentStepId),
    currentStepName: asString(value.currentStepName),
    currentStepSequence: asNumber(value.currentStepSeq),
    currentUser: asString(value.allCurrentUser) ?? asString(value.currentUser),
    currentHandlingGroup: nestedGroupName(value.processGroups),
    applicant: asString(value.applyUser),
    beginTime: asString(value.beginTime),
    endTime: asString(value.endTime),
    processType: asString(value.processType),
    sourceTenant: asString(value.iamTenant) ?? asString(value.tenant),
    processingHistory: asArray(value.logList)
      .map(mapProcessingRecord)
      .filter((record): record is ImocProcessingRecord => record !== null),
    retrievedAt: new Date().toISOString(),
  };
};

/** Model detail can be useful context, but field definitions may be sensitive. */
export const normalizeImocModel = (value: unknown): ImocModelSummary => {
  if (!isRecord(value)) throw new Error('IMOC returned an invalid model payload');
  const modelId = asString(value.modelId);
  if (!modelId) throw new Error('IMOC model response did not include modelId');
  return {
    modelId,
    modelName: asString(value.modelName),
    modelType: asString(value.modelType),
    isSensitive: value.isSensitive === 'yes' ? true : value.isSensitive === 'no' ? false : null,
    isEnabled: value.enableFlag === 'true' ? true : value.enableFlag === 'false' ? false : null,
    steps: asArray(value.stepList)
      .filter(isRecord)
      .map((step) => ({
        stepId: asString(step.stepId) ?? asString(step.id) ?? '',
        stepName: asString(step.stepName),
        sequence: asNumber(step.stepSeq),
        distributionMode: asString(step.distribuMode),
        signType: asString(step.signType),
      }))
      .filter((step) => step.stepId !== ''),
  };
};

/**
 * Snapshot capture is intentionally much smaller than the raw ticket detail.
 * This lets audit retain a defensible point-in-time record without persisting
 * arbitrary IMOC form, secret, privacy, or dynamic-reference fields.
 */
export const buildSafeImocSnapshot = (ticket: ImocTicket): Record<string, unknown> => ({
  sourceSystem: 'imoc',
  retrievedAt: ticket.retrievedAt,
  ticket: {
    orderId: ticket.orderId,
    orderNumber: ticket.orderNumber,
    orderName: ticket.orderName,
    modelId: ticket.modelId,
    modelName: ticket.modelName,
    modelType: ticket.modelType,
    status: ticket.orderStatus,
    slaStatus: ticket.slaStatus,
    currentStep: ticket.currentStepName,
    currentStepSequence: ticket.currentStepSequence,
    currentHandlingGroup: ticket.currentHandlingGroup,
    beginTime: ticket.beginTime,
    endTime: ticket.endTime,
    processType: ticket.processType,
    tenant: ticket.sourceTenant,
  },
  processingHistory: ticket.processingHistory,
});

export const hashSnapshot = (snapshot: Record<string, unknown>): string =>
  createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');

export const classifyImocNetworkError = (err: unknown): AppError => {
  if (err instanceof AppError) return err;

  const errorObj = err as { name?: string; message?: string; code?: string; cause?: any } | undefined;
  const cause = errorObj?.cause as { code?: string; message?: string; name?: string } | undefined;
  const code = cause?.code || errorObj?.code || '';
  const message = (cause?.message || errorObj?.message || '').toLowerCase();
  const name = cause?.name || errorObj?.name || '';

  const isDnsConnect =
    code === 'ENOTFOUND' ||
    code === 'ECONNREFUSED' ||
    code === 'ETIMEDOUT' ||
    code === 'EHOSTUNREACH' ||
    code === 'ECONNRESET' ||
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_SOCKET';

  if (isDnsConnect) {
    return AppError.serviceUnavailable('IMOC is unreachable from IAMS.');
  }

  const isTlsCert =
    code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
    code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
    code.startsWith('CERT_') ||
    code.startsWith('ERR_TLS_') ||
    code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
    message.includes('certificate') ||
    message.includes('altnames') ||
    message.includes('self signed');

  if (isTlsCert) {
    return AppError.serviceUnavailable(
      "IMOC's TLS certificate is not trusted by IAMS. Contact the administrator (CA not installed).",
    );
  }

  if (
    name === 'AbortError' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    message.includes('aborted') ||
    message.includes('request timeout')
  ) {
    return AppError.gatewayTimeout('IMOC did not respond before the configured timeout.');
  }

  return AppError.serviceUnavailable('Unable to reach IMOC.');
};

export const classifyImocUpstreamError = (
  upstreamCode: string | number,
  upstreamMsg?: unknown,
  isSingleTicketLookup = false,
): AppError => {
  const codeStr = String(upstreamCode).trim();
  if (codeStr === '100' || codeStr === '5002') {
    const detail = typeof upstreamMsg === 'string' && upstreamMsg.trim() ? upstreamMsg.trim() : undefined;
    return AppError.badRequest('IMOC rejected the request parameters.', detail ? { detail } : undefined);
  }
  if (codeStr === '101') {
    return AppError.notFound('IMOC ticket model');
  }
  if (isSingleTicketLookup && (codeStr === '200' || codeStr === '0')) {
    return AppError.notFound('IMOC ticket');
  }
  if (codeStr === '500' || codeStr === '-1' || codeStr === '5001') {
    return AppError.badGateway(`IMOC reported an error (code ${codeStr}).`);
  }
  return AppError.badGateway(`IMOC request failed (upstream code ${codeStr}).`);
};

// ---------------------------------------------------------------------------
// Rule Criteria Schema, Combinations, and Matching
// ---------------------------------------------------------------------------

export const ImocRuleCriteriaSchema = z
  .object({
    orderStatus: z
      .array(
        z.enum([
          'processing',
          'dismissed',
          'reback',
          'completed',
          'suspend',
          'scrapped',
          'draft',
        ]),
      )
      .optional(),
    slaStatus: z.array(z.string().min(1)).optional(),
    modelIds: z.array(z.string().min(1)).optional(),
    modelNames: z.array(z.string().min(1)).optional(),
    modelTypes: z.array(z.string().min(1)).optional(),
    orderSources: z.array(z.string().min(1)).optional(),
    nameContains: z.string().min(1).optional(),
    currentUsers: z.array(z.string().min(1)).optional(),
    createdWithinDays: z.number().int().positive().optional(),
  })
  .strict();

export const countRuleCombinations = (criteria: ImocRuleCriteria): number => {
  const dims = [
    criteria.orderStatus?.length || 1,
    criteria.slaStatus?.length || 1,
    criteria.modelIds?.length || 1,
    criteria.modelNames?.length || 1,
    criteria.currentUsers?.length || 1,
  ];
  return dims.reduce((acc, len) => acc * len, 1);
};

export const validateRuleCriteria = (criteria: unknown): ImocRuleCriteria => {
  const parsed = ImocRuleCriteriaSchema.parse(criteria);
  const combos = countRuleCombinations(parsed);
  if (combos > 20) {
    throw AppError.badRequest(
      `Rule criteria generates ${combos} query combinations (maximum allowed is 20). Narrow your multi-value filters.`,
    );
  }
  return parsed;
};

// ---------------------------------------------------------------------------
// Date Utilities (UTC vs Local per IMOC tenant version)
// ---------------------------------------------------------------------------

export const formatImocDate = (date: Date, utc = true): string => {
  const pad = (n: number) => String(n).padStart(2, '0');
  if (utc) {
    const y = date.getUTCFullYear();
    const m = pad(date.getUTCMonth() + 1);
    const d = pad(date.getUTCDate());
    const h = pad(date.getUTCHours());
    const min = pad(date.getUTCMinutes());
    const s = pad(date.getUTCSeconds());
    return `${y}-${m}-${d} ${h}:${min}:${s}`;
  }
  const y = date.getFullYear();
  const m = pad(date.getMonth() + 1);
  const d = pad(date.getDate());
  const h = pad(date.getHours());
  const min = pad(date.getMinutes());
  const s = pad(date.getSeconds());
  return `${y}-${m}-${d} ${h}:${min}:${s}`;
};

export const formatImocDateRange = (
  lookbackDays = 30,
  utc = true,
  now = new Date(),
): { beginStartDate: string; beginEndDate: string } => {
  const past = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
  return {
    beginStartDate: formatImocDate(past, utc),
    beginEndDate: formatImocDate(now, utc),
  };
};

export const parseImocDate = (
  dateStr: string | null | undefined,
  utc = true,
): Date | null => {
  if (!dateStr || typeof dateStr !== 'string') return null;
  const trimmed = dateStr.trim();
  if (!trimmed) return null;

  // IMOC format: YYYY-MM-DD HH:mm:ss
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
    const isoString = trimmed.replace(' ', 'T') + (utc ? 'Z' : '');
    const d = new Date(isoString);
    return isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(trimmed);
  return isNaN(d.getTime()) ? null : d;
};

// ---------------------------------------------------------------------------
// Query Generation for IMOC Upstream List API
// ---------------------------------------------------------------------------

export const buildUpstreamQueries = (
  criteria: ImocRuleCriteria,
  lookbackDays = 30,
  utc = true,
  now = new Date(),
): ImocTicketSearch[] => {
  const effectiveLookback = criteria.createdWithinDays ?? lookbackDays;
  const { beginStartDate, beginEndDate } = formatImocDateRange(effectiveLookback, utc, now);

  const orderStatuses = criteria.orderStatus?.length ? criteria.orderStatus : [undefined];
  const slaStatuses = criteria.slaStatus?.length ? criteria.slaStatus : [undefined];
  const modelIds = criteria.modelIds?.length ? criteria.modelIds : [undefined];
  const modelNames = criteria.modelNames?.length ? criteria.modelNames : [undefined];
  const currentUsers = criteria.currentUsers?.length ? criteria.currentUsers : [undefined];

  const queries: ImocTicketSearch[] = [];

  for (const orderStatus of orderStatuses) {
    for (const slaStatus of slaStatuses) {
      for (const modelId of modelIds) {
        for (const modelName of modelNames) {
          for (const currentUser of currentUsers) {
            queries.push({
              page: 1,
              pageSize: 100,
              orderStatus,
              slaStatus,
              modelId,
              modelName,
              currentUser,
              beginStartDate,
              beginEndDate,
            });
          }
        }
      }
    }
  }

  return queries;
};

// ---------------------------------------------------------------------------
// Pure Rule Evaluator (local filtering & validation)
// ---------------------------------------------------------------------------

export const matchesRuleCriteria = (
  ticket: ImocTicket,
  criteria: ImocRuleCriteria,
  now = new Date(),
): boolean => {
  if (criteria.orderStatus && criteria.orderStatus.length > 0) {
    if (!ticket.orderStatus) return false;
    const ticketStatusLower = ticket.orderStatus.toLowerCase();
    const matched = criteria.orderStatus.some((s) => s.toLowerCase() === ticketStatusLower);
    if (!matched) return false;
  }

  if (criteria.slaStatus && criteria.slaStatus.length > 0) {
    if (!ticket.slaStatus) return false;
    const ticketSlaLower = ticket.slaStatus.toLowerCase();
    const matched = criteria.slaStatus.some((s) => s.toLowerCase() === ticketSlaLower);
    if (!matched) return false;
  }

  if (criteria.modelIds && criteria.modelIds.length > 0) {
    if (!ticket.modelId) return false;
    if (!criteria.modelIds.includes(ticket.modelId)) return false;
  }

  if (criteria.modelNames && criteria.modelNames.length > 0) {
    if (!ticket.modelName) return false;
    const nameLower = ticket.modelName.toLowerCase();
    const matched = criteria.modelNames.some((m) => m.toLowerCase() === nameLower);
    if (!matched) return false;
  }

  if (criteria.modelTypes && criteria.modelTypes.length > 0) {
    if (!ticket.modelType) return false;
    const typeLower = ticket.modelType.toLowerCase();
    const matched = criteria.modelTypes.some((t) => t.toLowerCase() === typeLower);
    if (!matched) return false;
  }

  if (criteria.orderSources && criteria.orderSources.length > 0) {
    const src1 = (ticket.sourceTenant || '').toLowerCase();
    const src2 = (ticket.processType || '').toLowerCase();
    const matched = criteria.orderSources.some((s) => {
      const sLower = s.toLowerCase();
      return (src1 && src1 === sLower) || (src2 && src2 === sLower);
    });
    if (!matched) return false;
  }

  if (criteria.nameContains) {
    if (!ticket.orderName) return false;
    if (!ticket.orderName.toLowerCase().includes(criteria.nameContains.toLowerCase())) {
      return false;
    }
  }

  if (criteria.currentUsers && criteria.currentUsers.length > 0) {
    if (!ticket.currentUser) return false;
    const userLower = ticket.currentUser.toLowerCase();
    const matched = criteria.currentUsers.some((u) => u.toLowerCase() === userLower);
    if (!matched) return false;
  }

  if (criteria.createdWithinDays !== undefined) {
    const parsedDate = parseImocDate(ticket.beginTime);
    if (!parsedDate) return false;
    const minTimestamp = now.getTime() - criteria.createdWithinDays * 24 * 60 * 60 * 1000;
    if (parsedDate.getTime() < minTimestamp) return false;
  }

  return true;
};

// ---------------------------------------------------------------------------
// Category Resolution & Normalized Change Hash
// ---------------------------------------------------------------------------

export const MODEL_TYPE_CATEGORY_MAP: Record<string, string> = {
  incident: 'Incident Management',
  '1': 'Incident Management',
  problem: 'Problem Management',
  '2': 'Problem Management',
  change: 'Change Management',
  '3': 'Change Management',
  release: 'Release Management',
  '4': 'Release Management',
  service: 'Service Request',
  req: 'Service Request',
  request: 'Service Request',
  event: 'Event Management',
};

export const resolveTicketCategory = (
  matchedRules: Array<{ priority: number; category: string | null }>,
  ticket: ImocTicket,
): string => {
  const sorted = [...matchedRules].sort((a, b) => a.priority - b.priority);
  for (const r of sorted) {
    if (r.category && r.category.trim()) {
      return r.category.trim();
    }
  }

  if (ticket.modelType) {
    const norm = ticket.modelType.trim().toLowerCase();
    if (MODEL_TYPE_CATEGORY_MAP[norm]) {
      return MODEL_TYPE_CATEGORY_MAP[norm];
    }
    for (const [key, cat] of Object.entries(MODEL_TYPE_CATEGORY_MAP)) {
      if (norm.includes(key)) return cat;
    }
  }

  return 'Uncategorised';
};

export const hashImocTicket = (ticket: ImocTicket): string => {
  const payload = {
    orderId: ticket.orderId,
    orderNumber: ticket.orderNumber,
    orderName: ticket.orderName ?? null,
    modelId: ticket.modelId ?? null,
    modelName: ticket.modelName ?? null,
    modelType: ticket.modelType ?? null,
    orderStatus: ticket.orderStatus ?? null,
    slaStatus: ticket.slaStatus ?? null,
    priority: ticket.priority ?? null,
    currentStepName: ticket.currentStepName ?? null,
    currentStepSequence: ticket.currentStepSequence ?? null,
    currentUser: ticket.currentUser ?? null,
    applicant: ticket.applicant ?? null,
    beginTime: ticket.beginTime ?? null,
    endTime: ticket.endTime ?? null,
    processType: ticket.processType ?? null,
    sourceTenant: ticket.sourceTenant ?? null,
  };
  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
};

