"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.classifyProjectPlusHttpStatus = exports.classifyProjectPlusNetworkError = exports.matchesProjectPlusSearch = exports.normalizeProjectPlusDocumentType = exports.normalizeProjectPlusEntity = void 0;
const app_error_1 = require("../../../../shared/errors/app.error");
const str = (value) => {
    if (value === undefined || value === null)
        return null;
    const text = String(value).trim();
    return text.length > 0 ? text : null;
};
/** Allow-list normaliser: anything not named here is dropped, never passed through. */
const normalizeProjectPlusEntity = (raw) => {
    const r = (raw && typeof raw === 'object' ? raw : {});
    const fullName = str(r.fullName) ??
        ([str(r.firstName), str(r.otherName), str(r.surname)].filter(Boolean).join(' ') || 'Unnamed entity');
    return {
        referenceCode: str(r.referenceCode),
        pin: str(r.pin),
        fullName,
        entityType: str(r.entityType),
        entitySubType: str(r.entitySubType),
        rcNumber: str(r.rcNumber),
        tin: str(r.tin),
        website: str(r.website),
        contactPersonFullName: str(r.contactPersonFullName),
        status: str(r.status),
        recordDate: str(r.recordDate),
        createdBy: str(r.createdBy),
        finClientId: str(r.finClientId),
        finVendorId: str(r.finvendorId ?? r.finVendorId),
        finCustomerId: str(r.finCustomerId),
    };
};
exports.normalizeProjectPlusEntity = normalizeProjectPlusEntity;
const normalizeProjectPlusDocumentType = (raw) => {
    const r = (raw && typeof raw === 'object' ? raw : {});
    return { code: str(r.code) ?? '', description: str(r.description) ?? '' };
};
exports.normalizeProjectPlusDocumentType = normalizeProjectPlusDocumentType;
/** Case-insensitive match across the searchable identity fields. */
const matchesProjectPlusSearch = (entity, search) => {
    const needle = search.trim().toLowerCase();
    if (!needle)
        return true;
    return [entity.fullName, entity.referenceCode, entity.pin, entity.rcNumber, entity.tin]
        .some((v) => v?.toLowerCase().includes(needle));
};
exports.matchesProjectPlusSearch = matchesProjectPlusSearch;
/** Maps transport failures to safe, actionable errors. Never includes bodies or headers. */
const classifyProjectPlusNetworkError = (err) => {
    if (err instanceof app_error_1.AppError)
        return err;
    const e = err;
    const code = e?.cause?.code || e?.code || '';
    const message = (e?.cause?.message || e?.message || '').toLowerCase();
    const name = e?.cause?.name || e?.name || '';
    if (['ENOTFOUND', 'ECONNREFUSED', 'ETIMEDOUT', 'EHOSTUNREACH', 'ECONNRESET', 'UND_ERR_CONNECT_TIMEOUT', 'UND_ERR_SOCKET'].includes(code)) {
        return app_error_1.AppError.serviceUnavailable('Project Plus is unreachable from IAMS.');
    }
    if (code === 'SELF_SIGNED_CERT_IN_CHAIN' || code === 'UNABLE_TO_VERIFY_LEAF_SIGNATURE' ||
        code === 'DEPTH_ZERO_SELF_SIGNED_CERT' || code.startsWith('CERT_') || code.startsWith('ERR_TLS_') ||
        message.includes('certificate') || message.includes('self signed')) {
        return app_error_1.AppError.serviceUnavailable("Project Plus's TLS certificate is not trusted by IAMS. Contact the administrator (CA not installed).");
    }
    if (name === 'AbortError' || code === 'UND_ERR_HEADERS_TIMEOUT' || code === 'UND_ERR_BODY_TIMEOUT' || message.includes('aborted')) {
        return app_error_1.AppError.gatewayTimeout('Project Plus did not respond before the configured timeout.');
    }
    return app_error_1.AppError.serviceUnavailable('Unable to reach Project Plus.');
};
exports.classifyProjectPlusNetworkError = classifyProjectPlusNetworkError;
/** Maps non-2xx HTTP responses from the gateway to safe errors. */
const classifyProjectPlusHttpStatus = (status) => {
    if (status === 401 || status === 403)
        return app_error_1.AppError.badGateway('Project Plus rejected the integration credentials.');
    if (status === 404)
        return app_error_1.AppError.notFound('Project Plus resource');
    if (status === 400 || status === 422)
        return app_error_1.AppError.badRequest('Project Plus rejected the request parameters.');
    if (status === 429)
        return app_error_1.AppError.tooManyRequests('Project Plus rate limit reached. Try again shortly.');
    return app_error_1.AppError.badGateway(`Project Plus reported an error (HTTP ${status}).`);
};
exports.classifyProjectPlusHttpStatus = classifyProjectPlusHttpStatus;
//# sourceMappingURL=projectplus.utility.js.map