"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashImocTicket = exports.resolveTicketCategory = exports.MODEL_TYPE_CATEGORY_MAP = exports.matchesRuleCriteria = exports.buildUpstreamQueries = exports.parseImocDate = exports.formatImocDateRange = exports.formatImocDate = exports.validateRuleCriteria = exports.countRuleCombinations = exports.ImocRuleCriteriaSchema = exports.classifyImocUpstreamError = exports.classifyImocNetworkError = exports.hashSnapshot = exports.buildSafeImocSnapshot = exports.normalizeImocModel = exports.normalizeImocTicket = void 0;
const crypto_1 = require("crypto");
const zod_1 = require("zod");
const app_error_1 = require("../../../../shared/errors/app.error");
const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
const asString = (value) => typeof value === 'string' && value.trim() !== '' ? value : null;
const asNumber = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : null;
};
const asArray = (value) => (Array.isArray(value) ? value : []);
const nestedGroupName = (value) => {
    const first = asArray(value)[0];
    return isRecord(first) ? asString(first.groupName) : null;
};
const mapProcessingRecord = (value) => {
    if (!isRecord(value))
        return null;
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
const normalizeImocTicket = (value) => {
    if (!isRecord(value))
        throw new Error('IMOC returned an invalid ticket payload');
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
            .filter((record) => record !== null),
        retrievedAt: new Date().toISOString(),
    };
};
exports.normalizeImocTicket = normalizeImocTicket;
/** Model detail can be useful context, but field definitions may be sensitive. */
const normalizeImocModel = (value) => {
    if (!isRecord(value))
        throw new Error('IMOC returned an invalid model payload');
    const modelId = asString(value.modelId);
    if (!modelId)
        throw new Error('IMOC model response did not include modelId');
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
exports.normalizeImocModel = normalizeImocModel;
/**
 * Snapshot capture is intentionally much smaller than the raw ticket detail.
 * This lets audit retain a defensible point-in-time record without persisting
 * arbitrary IMOC form, secret, privacy, or dynamic-reference fields.
 */
const buildSafeImocSnapshot = (ticket) => ({
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
exports.buildSafeImocSnapshot = buildSafeImocSnapshot;
const hashSnapshot = (snapshot) => (0, crypto_1.createHash)('sha256').update(JSON.stringify(snapshot)).digest('hex');
exports.hashSnapshot = hashSnapshot;
const classifyImocNetworkError = (err) => {
    if (err instanceof app_error_1.AppError)
        return err;
    const errorObj = err;
    const cause = errorObj?.cause;
    const code = cause?.code || errorObj?.code || '';
    const message = (cause?.message || errorObj?.message || '').toLowerCase();
    const name = cause?.name || errorObj?.name || '';
    const isDnsConnect = code === 'ENOTFOUND' ||
        code === 'ECONNREFUSED' ||
        code === 'ETIMEDOUT' ||
        code === 'EHOSTUNREACH' ||
        code === 'ECONNRESET' ||
        code === 'UND_ERR_CONNECT_TIMEOUT' ||
        code === 'UND_ERR_SOCKET';
    if (isDnsConnect) {
        return app_error_1.AppError.serviceUnavailable('IMOC is unreachable from IAMS.');
    }
    const isTlsCert = code === 'SELF_SIGNED_CERT_IN_CHAIN' ||
        code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        code.startsWith('CERT_') ||
        code.startsWith('ERR_TLS_') ||
        code === 'DEPTH_ZERO_SELF_SIGNED_CERT' ||
        message.includes('certificate') ||
        message.includes('altnames') ||
        message.includes('self signed');
    if (isTlsCert) {
        return app_error_1.AppError.serviceUnavailable("IMOC's TLS certificate is not trusted by IAMS. Contact the administrator (CA not installed).");
    }
    if (name === 'AbortError' ||
        code === 'UND_ERR_HEADERS_TIMEOUT' ||
        code === 'UND_ERR_BODY_TIMEOUT' ||
        message.includes('aborted') ||
        message.includes('request timeout')) {
        return app_error_1.AppError.gatewayTimeout('IMOC did not respond before the configured timeout.');
    }
    return app_error_1.AppError.serviceUnavailable('Unable to reach IMOC.');
};
exports.classifyImocNetworkError = classifyImocNetworkError;
const classifyImocUpstreamError = (upstreamCode, upstreamMsg, isSingleTicketLookup = false) => {
    const codeStr = String(upstreamCode).trim();
    if (codeStr === '100' || codeStr === '5002') {
        const detail = typeof upstreamMsg === 'string' && upstreamMsg.trim() ? upstreamMsg.trim() : undefined;
        return app_error_1.AppError.badRequest('IMOC rejected the request parameters.', detail ? { detail } : undefined);
    }
    if (codeStr === '101') {
        return app_error_1.AppError.notFound('IMOC ticket model');
    }
    if (isSingleTicketLookup && (codeStr === '200' || codeStr === '0')) {
        return app_error_1.AppError.notFound('IMOC ticket');
    }
    if (codeStr === '500' || codeStr === '-1' || codeStr === '5001') {
        return app_error_1.AppError.badGateway(`IMOC reported an error (code ${codeStr}).`);
    }
    return app_error_1.AppError.badGateway(`IMOC request failed (upstream code ${codeStr}).`);
};
exports.classifyImocUpstreamError = classifyImocUpstreamError;
// ---------------------------------------------------------------------------
// Rule Criteria Schema, Combinations, and Matching
// ---------------------------------------------------------------------------
exports.ImocRuleCriteriaSchema = zod_1.z
    .object({
    orderStatus: zod_1.z
        .array(zod_1.z.enum([
        'processing',
        'dismissed',
        'reback',
        'completed',
        'suspend',
        'scrapped',
        'draft',
    ]))
        .optional(),
    slaStatus: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    modelIds: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    modelNames: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    modelTypes: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    orderSources: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    nameContains: zod_1.z.string().min(1).optional(),
    currentUsers: zod_1.z.array(zod_1.z.string().min(1)).optional(),
    createdWithinDays: zod_1.z.number().int().positive().optional(),
})
    .strict();
const countRuleCombinations = (criteria) => {
    const dims = [
        criteria.orderStatus?.length || 1,
        criteria.slaStatus?.length || 1,
        criteria.modelIds?.length || 1,
        criteria.modelNames?.length || 1,
        criteria.currentUsers?.length || 1,
    ];
    return dims.reduce((acc, len) => acc * len, 1);
};
exports.countRuleCombinations = countRuleCombinations;
const validateRuleCriteria = (criteria) => {
    const parsed = exports.ImocRuleCriteriaSchema.parse(criteria);
    const combos = (0, exports.countRuleCombinations)(parsed);
    if (combos > 20) {
        throw app_error_1.AppError.badRequest(`Rule criteria generates ${combos} query combinations (maximum allowed is 20). Narrow your multi-value filters.`);
    }
    return parsed;
};
exports.validateRuleCriteria = validateRuleCriteria;
// ---------------------------------------------------------------------------
// Date Utilities (UTC vs Local per IMOC tenant version)
// ---------------------------------------------------------------------------
const formatImocDate = (date, utc = true) => {
    const pad = (n) => String(n).padStart(2, '0');
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
exports.formatImocDate = formatImocDate;
const formatImocDateRange = (lookbackDays = 30, utc = true, now = new Date()) => {
    const past = new Date(now.getTime() - lookbackDays * 24 * 60 * 60 * 1000);
    return {
        beginStartDate: (0, exports.formatImocDate)(past, utc),
        beginEndDate: (0, exports.formatImocDate)(now, utc),
    };
};
exports.formatImocDateRange = formatImocDateRange;
const parseImocDate = (dateStr, utc = true) => {
    if (!dateStr || typeof dateStr !== 'string')
        return null;
    const trimmed = dateStr.trim();
    if (!trimmed)
        return null;
    // IMOC format: YYYY-MM-DD HH:mm:ss
    if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(trimmed)) {
        const isoString = trimmed.replace(' ', 'T') + (utc ? 'Z' : '');
        const d = new Date(isoString);
        return isNaN(d.getTime()) ? null : d;
    }
    const d = new Date(trimmed);
    return isNaN(d.getTime()) ? null : d;
};
exports.parseImocDate = parseImocDate;
// ---------------------------------------------------------------------------
// Query Generation for IMOC Upstream List API
// ---------------------------------------------------------------------------
const buildUpstreamQueries = (criteria, lookbackDays = 30, utc = true, now = new Date()) => {
    const effectiveLookback = criteria.createdWithinDays ?? lookbackDays;
    const { beginStartDate, beginEndDate } = (0, exports.formatImocDateRange)(effectiveLookback, utc, now);
    const orderStatuses = criteria.orderStatus?.length ? criteria.orderStatus : [undefined];
    const slaStatuses = criteria.slaStatus?.length ? criteria.slaStatus : [undefined];
    const modelIds = criteria.modelIds?.length ? criteria.modelIds : [undefined];
    const modelNames = criteria.modelNames?.length ? criteria.modelNames : [undefined];
    const currentUsers = criteria.currentUsers?.length ? criteria.currentUsers : [undefined];
    const queries = [];
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
exports.buildUpstreamQueries = buildUpstreamQueries;
// ---------------------------------------------------------------------------
// Pure Rule Evaluator (local filtering & validation)
// ---------------------------------------------------------------------------
const matchesRuleCriteria = (ticket, criteria, now = new Date()) => {
    if (criteria.orderStatus && criteria.orderStatus.length > 0) {
        if (!ticket.orderStatus)
            return false;
        const ticketStatusLower = ticket.orderStatus.toLowerCase();
        const matched = criteria.orderStatus.some((s) => s.toLowerCase() === ticketStatusLower);
        if (!matched)
            return false;
    }
    if (criteria.slaStatus && criteria.slaStatus.length > 0) {
        if (!ticket.slaStatus)
            return false;
        const ticketSlaLower = ticket.slaStatus.toLowerCase();
        const matched = criteria.slaStatus.some((s) => s.toLowerCase() === ticketSlaLower);
        if (!matched)
            return false;
    }
    if (criteria.modelIds && criteria.modelIds.length > 0) {
        if (!ticket.modelId)
            return false;
        if (!criteria.modelIds.includes(ticket.modelId))
            return false;
    }
    if (criteria.modelNames && criteria.modelNames.length > 0) {
        if (!ticket.modelName)
            return false;
        const nameLower = ticket.modelName.toLowerCase();
        const matched = criteria.modelNames.some((m) => m.toLowerCase() === nameLower);
        if (!matched)
            return false;
    }
    if (criteria.modelTypes && criteria.modelTypes.length > 0) {
        if (!ticket.modelType)
            return false;
        const typeLower = ticket.modelType.toLowerCase();
        const matched = criteria.modelTypes.some((t) => t.toLowerCase() === typeLower);
        if (!matched)
            return false;
    }
    if (criteria.orderSources && criteria.orderSources.length > 0) {
        const src1 = (ticket.sourceTenant || '').toLowerCase();
        const src2 = (ticket.processType || '').toLowerCase();
        const matched = criteria.orderSources.some((s) => {
            const sLower = s.toLowerCase();
            return (src1 && src1 === sLower) || (src2 && src2 === sLower);
        });
        if (!matched)
            return false;
    }
    if (criteria.nameContains) {
        if (!ticket.orderName)
            return false;
        if (!ticket.orderName.toLowerCase().includes(criteria.nameContains.toLowerCase())) {
            return false;
        }
    }
    if (criteria.currentUsers && criteria.currentUsers.length > 0) {
        if (!ticket.currentUser)
            return false;
        const userLower = ticket.currentUser.toLowerCase();
        const matched = criteria.currentUsers.some((u) => u.toLowerCase() === userLower);
        if (!matched)
            return false;
    }
    if (criteria.createdWithinDays !== undefined) {
        const parsedDate = (0, exports.parseImocDate)(ticket.beginTime);
        if (!parsedDate)
            return false;
        const minTimestamp = now.getTime() - criteria.createdWithinDays * 24 * 60 * 60 * 1000;
        if (parsedDate.getTime() < minTimestamp)
            return false;
    }
    return true;
};
exports.matchesRuleCriteria = matchesRuleCriteria;
// ---------------------------------------------------------------------------
// Category Resolution & Normalized Change Hash
// ---------------------------------------------------------------------------
exports.MODEL_TYPE_CATEGORY_MAP = {
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
const resolveTicketCategory = (matchedRules, ticket) => {
    const sorted = [...matchedRules].sort((a, b) => a.priority - b.priority);
    for (const r of sorted) {
        if (r.category && r.category.trim()) {
            return r.category.trim();
        }
    }
    if (ticket.modelType) {
        const norm = ticket.modelType.trim().toLowerCase();
        if (exports.MODEL_TYPE_CATEGORY_MAP[norm]) {
            return exports.MODEL_TYPE_CATEGORY_MAP[norm];
        }
        for (const [key, cat] of Object.entries(exports.MODEL_TYPE_CATEGORY_MAP)) {
            if (norm.includes(key))
                return cat;
        }
    }
    return 'Uncategorised';
};
exports.resolveTicketCategory = resolveTicketCategory;
const hashImocTicket = (ticket) => {
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
    return (0, crypto_1.createHash)('sha256').update(JSON.stringify(payload)).digest('hex');
};
exports.hashImocTicket = hashImocTicket;
//# sourceMappingURL=imoc.utility.js.map