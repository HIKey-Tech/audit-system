"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createImocClient = exports.MachineUserImocTokenProvider = exports.getImocDispatcher = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const tls_1 = __importDefault(require("tls"));
const undici_1 = require("undici");
const app_error_1 = require("../../../../../shared/errors/app.error");
const app_config_1 = require("../../../../../shared/config/app.config");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const imoc_utility_1 = require("../../utility/imoc.utility");
const success = (code) => String(code) === '200' || String(code) === '0';
const machineTokenSuccess = (code) => String(code) === '1';
let sharedImocDispatcher;
/**
 * Returns an undici Agent configured to trust the private IMOC CA and/or
 * verify against a pinned leaf certificate fingerprint when specified.
 */
const getImocDispatcher = () => {
    if (sharedImocDispatcher)
        return sharedImocDispatcher;
    const caPath = app_config_1.config.imoc.caCertPath;
    const pinnedFp = app_config_1.config.imoc.tlsPinnedFingerprint;
    if (!caPath && !pinnedFp)
        return undefined;
    let ca;
    if (caPath) {
        try {
            ca = fs_1.default.readFileSync(path_1.default.resolve(process.cwd(), caPath));
        }
        catch (err) {
            logger_util_1.logger.warn('Failed to read IMOC CA certificate file', { caPath, err });
        }
    }
    sharedImocDispatcher = new undici_1.Agent({
        connect: {
            ca,
            checkServerIdentity: (hostname, cert) => {
                if (pinnedFp) {
                    const cleanPin = pinnedFp.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
                    const cleanCertFp = (cert.fingerprint256 || '').replace(/[^a-fA-F0-9]/g, '').toUpperCase();
                    if (cleanPin && cleanCertFp && cleanPin === cleanCertFp) {
                        return undefined; // Pinned leaf match accepted
                    }
                }
                return tls_1.default.checkServerIdentity(hostname, cert);
            },
        },
    });
    return sharedImocDispatcher;
};
exports.getImocDispatcher = getImocDispatcher;
/**
 * Applies for and caches the documented IMOC machine-machine token. Credentials
 * are read from deployment configuration only; neither credentials nor tokens
 * are persisted, logged, returned by IAMS, or sent to the frontend.
 */
class MachineUserImocTokenProvider {
    options;
    fetchImpl;
    now;
    token = null;
    expiresAtMs = 0;
    refreshInFlight = null;
    configured;
    constructor(options, fetchImpl = fetch, now = Date.now) {
        this.options = options;
        this.fetchImpl = fetchImpl;
        this.now = now;
        this.configured = Boolean(options.baseUrl
            && options.accessKey
            && options.secretKey
            && (options.tenantId || options.tenantAccount));
    }
    async getToken() {
        if (!this.configured) {
            throw app_error_1.AppError.serviceUnavailable('IMOC machine-user credentials are not configured.');
        }
        if (this.token && this.now() < this.expiresAtMs - this.options.refreshSkewMs) {
            return this.token;
        }
        if (!this.refreshInFlight) {
            this.refreshInFlight = this._applyForToken().finally(() => {
                this.refreshInFlight = null;
            });
        }
        return this.refreshInFlight;
    }
    invalidate() {
        this.token = null;
        this.expiresAtMs = 0;
    }
    async _applyForToken() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
        try {
            const dispatcher = (0, exports.getImocDispatcher)();
            const response = await this.fetchImpl(`${this.options.baseUrl}/esf/iamservice/v1/token/machine-user/apply`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json;charset=UTF-8',
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    ...(this.options.tenantId ? { tenantId: this.options.tenantId } : { tenantAccount: this.options.tenantAccount }),
                    accessKey: this.options.accessKey,
                    secretKey: this.options.secretKey,
                    ...(this.options.machineUserAccount ? { machineUserAccount: this.options.machineUserAccount } : {}),
                }),
                signal: controller.signal,
                ...(dispatcher ? { dispatcher } : {}),
            });
            const raw = await response.text();
            let envelope;
            try {
                envelope = JSON.parse(raw);
            }
            catch {
                throw app_error_1.AppError.badGateway(`IMOC token service returned a non-JSON response (${response.status}).`);
            }
            const rawToken = typeof envelope.data?.imoc_token === 'string' ? envelope.data.imoc_token : '';
            if (!response.ok || !machineTokenSuccess(envelope.code) || !rawToken) {
                logger_util_1.logger.warn('IMOC machine-token request failed', {
                    status: response.status,
                    upstreamCode: envelope.code,
                });
                throw app_error_1.AppError.badGateway('IMOC rejected the integration credentials.');
            }
            // The vendor contract explicitly requires EncodeURI before the token is
            // sent as the imoc_token header on eTicket requests.
            this.token = encodeURI(rawToken);
            this.expiresAtMs = this.now() + (30 * 60 * 1000);
            return this.token;
        }
        catch (err) {
            if (err instanceof app_error_1.AppError)
                throw err;
            throw (0, imoc_utility_1.classifyImocNetworkError)(err);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.MachineUserImocTokenProvider = MachineUserImocTokenProvider;
class StaticImocTokenProvider {
    token;
    expiresAt;
    configured;
    constructor(token, expiresAt) {
        this.token = token;
        this.expiresAt = expiresAt;
        this.configured = Boolean(token);
    }
    async getToken() {
        if (!this.configured)
            throw app_error_1.AppError.serviceUnavailable('IMOC token is not configured.');
        if (this.expiresAt && new Date(this.expiresAt).getTime() <= Date.now()) {
            throw app_error_1.AppError.serviceUnavailable('The configured IMOC token has expired.');
        }
        return this.token;
    }
    invalidate() {
        // Static break-glass tokens cannot be renewed by IAMS.
    }
}
let sharedMachineTokenProvider;
const createImocTokenProvider = () => {
    const machineOptions = {
        baseUrl: app_config_1.config.imoc.baseUrl,
        tenantId: app_config_1.config.imoc.tenantId,
        tenantAccount: app_config_1.config.imoc.tenantAccount,
        machineUserAccount: app_config_1.config.imoc.machineUserAccount,
        accessKey: app_config_1.config.imoc.accessKey,
        secretKey: app_config_1.config.imoc.secretKey,
        timeoutMs: app_config_1.config.imoc.timeoutMs,
        refreshSkewMs: app_config_1.config.imoc.tokenRefreshSkewMs,
    };
    const machineProvider = new MachineUserImocTokenProvider(machineOptions);
    if (machineProvider.configured) {
        sharedMachineTokenProvider ??= machineProvider;
        return sharedMachineTokenProvider;
    }
    return new StaticImocTokenProvider(app_config_1.config.imoc.token, app_config_1.config.imoc.tokenExpiresAt);
};
class DisabledImocClient {
    enabled = false;
    configured = false;
    unavailable() {
        throw app_error_1.AppError.serviceUnavailable('IMOC integration is not enabled.');
    }
    async listTickets() { return this.unavailable(); }
    async getTicket() { return this.unavailable(); }
    async resolveTicket() { return this.unavailable(); }
    async getLightweightTickets() { return this.unavailable(); }
    async getTicketStatus() { return this.unavailable(); }
    async getCurrentTicketStatus() { return this.unavailable(); }
    async getModel() { return this.unavailable(); }
    async checkStatus() {
        return {
            reachable: false,
            authenticated: false,
            lastError: 'IMOC integration is not enabled.',
            checkedAt: new Date().toISOString(),
        };
    }
}
/**
 * HTTP implementation for the documented read-only IMOC eTicket surface.
 * The documented machine-token provider is injected behind this adapter. The
 * remainder of the integration remains read-only and unchanged by token auth.
 */
class HttpImocClient {
    enabled = true;
    configured;
    tokenProvider;
    constructor() {
        this.tokenProvider = createImocTokenProvider();
        this.configured = Boolean(app_config_1.config.imoc.baseUrl && this.tokenProvider.configured);
    }
    async listTickets(query) {
        const data = await this._post(`/eticket/openapi/order/query/${query.pageSize}/${query.page}`, {
            orderStatus: query.orderStatus,
            modelId: query.modelId,
            modelName: query.modelName,
            orderNumber: query.orderNumber,
            orderName: query.orderName,
            currentUser: query.currentUser,
            slaStatus: query.slaStatus,
            beginStartDate: query.beginStartDate,
            beginEndDate: query.beginEndDate,
            endStartDate: query.endStartDate,
            endEndDate: query.endEndDate,
        });
        const page = Number(data.pageNum) || query.page;
        const pageSize = Number(data.pageSize) || query.pageSize;
        const total = Number(data.total) || 0;
        const totalPages = Number(data.pages) || Math.max(1, Math.ceil(total / pageSize));
        return {
            items: (Array.isArray(data.list) ? data.list : []).map(imoc_utility_1.normalizeImocTicket),
            page,
            pageSize,
            total,
            totalPages,
            hasNext: data.hasNextPage === true,
        };
    }
    async resolveTicket(lookup) {
        const orderId = lookup.orderId?.trim();
        const orderNumber = lookup.orderNumber?.trim();
        if (orderId) {
            return this.getTicket({ orderId });
        }
        if (!orderNumber) {
            throw app_error_1.AppError.badRequest('Provide an IMOC ticket ID or ticket number.');
        }
        const page = await this.listTickets({
            orderNumber,
            page: 1,
            pageSize: 10,
        });
        const matched = page.items.find((item) => item.orderNumber.toLowerCase() === orderNumber.toLowerCase());
        if (!matched) {
            throw app_error_1.AppError.notFound('IMOC ticket');
        }
        return this.getTicket({ orderId: matched.orderId });
    }
    async getTicket(lookup) {
        if (!lookup.orderId && lookup.orderNumber) {
            return this.resolveTicket(lookup);
        }
        return (0, imoc_utility_1.normalizeImocTicket)(await this._post('/eticket/openapi/order/query/single', { ...lookup }));
    }
    async getLightweightTickets(orderIds) {
        const data = await this._post('/eticket/openapi/order/query/single/oa', {
            orderIds: orderIds.join(','),
        });
        return (Array.isArray(data) ? data : [data]).map(imoc_utility_1.normalizeImocTicket);
    }
    async getTicketStatus(orderNumber) {
        return (0, imoc_utility_1.normalizeImocTicket)(await this._post('/eticket/openapi/order/status', { orderNumber }));
    }
    async getCurrentTicketStatus(orderNumber) {
        return (0, imoc_utility_1.normalizeImocTicket)(await this._post('/eticket/openapi/order/StatusForNow', { orderNumber }));
    }
    async getModel(modelId) {
        return (0, imoc_utility_1.normalizeImocModel)(await this._post('/eticket/openapi/model/queryByModelId', { modelId }));
    }
    async checkStatus() {
        const checkedAt = new Date().toISOString();
        if (!this.configured) {
            return {
                reachable: false,
                authenticated: false,
                lastError: 'IMOC machine-user credentials are not configured.',
                checkedAt,
            };
        }
        try {
            await this.tokenProvider.getToken();
            return {
                reachable: true,
                authenticated: true,
                lastError: null,
                checkedAt,
            };
        }
        catch (err) {
            const safeError = err instanceof app_error_1.AppError ? err.message : 'Unable to connect or authenticate with IMOC.';
            return {
                reachable: false,
                authenticated: false,
                lastError: safeError,
                checkedAt,
            };
        }
    }
    async _post(path, body, retried = false) {
        if (!this.configured) {
            throw app_error_1.AppError.serviceUnavailable('IMOC is enabled but not configured. Set its machine-user credentials or a valid break-glass token.');
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), app_config_1.config.imoc.timeoutMs);
        try {
            const token = await this.tokenProvider.getToken();
            const dispatcher = (0, exports.getImocDispatcher)();
            const response = await fetch(`${app_config_1.config.imoc.baseUrl}${path}`, {
                method: 'POST',
                headers: {
                    Accept: 'application/json;charset=UTF-8',
                    'Content-Type': 'application/json',
                    imoc_token: token,
                },
                body: JSON.stringify(Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined))),
                signal: controller.signal,
                ...(dispatcher ? { dispatcher } : {}),
            });
            const raw = await response.text();
            let envelope;
            try {
                envelope = JSON.parse(raw);
            }
            catch {
                throw app_error_1.AppError.badGateway(`IMOC returned a non-JSON response (${response.status}).`);
            }
            if ((response.status === 401 || response.status === 403) && !retried) {
                this.tokenProvider.invalidate();
                return this._post(path, body, true);
            }
            if (!response.ok || !success(envelope.code)) {
                const upstreamCode = envelope.code ?? envelope.status ?? response.status;
                logger_util_1.logger.warn('IMOC request failed', { path, status: response.status, upstreamCode });
                throw (0, imoc_utility_1.classifyImocUpstreamError)(upstreamCode, envelope.msg ?? envelope.error, path.includes('/query/single'));
            }
            if (envelope.data === undefined || envelope.data === null) {
                if (path.includes('/query/single')) {
                    throw app_error_1.AppError.notFound('IMOC ticket');
                }
                throw app_error_1.AppError.badGateway('IMOC returned a successful response without ticket data.');
            }
            return envelope.data;
        }
        catch (err) {
            if (err instanceof app_error_1.AppError)
                throw err;
            throw (0, imoc_utility_1.classifyImocNetworkError)(err);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
const createImocClient = () => app_config_1.config.imoc.enabled ? new HttpImocClient() : new DisabledImocClient();
exports.createImocClient = createImocClient;
//# sourceMappingURL=imoc.client.js.map