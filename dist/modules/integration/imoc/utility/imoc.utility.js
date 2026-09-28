"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashSnapshot = exports.buildSafeImocSnapshot = exports.normalizeImocModel = exports.normalizeImocTicket = void 0;
const crypto_1 = require("crypto");
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
//# sourceMappingURL=imoc.utility.js.map