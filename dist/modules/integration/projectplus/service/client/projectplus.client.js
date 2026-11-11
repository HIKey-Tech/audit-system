"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProjectPlusClient = exports.HttpProjectPlusClient = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const undici_1 = require("undici");
const app_error_1 = require("../../../../../shared/errors/app.error");
const app_config_1 = require("../../../../../shared/config/app.config");
const logger_util_1 = require("../../../../../shared/utils/logger.util");
const projectplus_utility_1 = require("../../utility/projectplus.utility");
let sharedDispatcher;
const getDispatcher = () => {
    if (sharedDispatcher)
        return sharedDispatcher;
    const caPath = app_config_1.config.projectPlus.caCertPath;
    if (!caPath)
        return undefined;
    try {
        const ca = fs_1.default.readFileSync(path_1.default.resolve(process.cwd(), caPath));
        sharedDispatcher = new undici_1.Agent({ connect: { ca } });
        return sharedDispatcher;
    }
    catch (err) {
        logger_util_1.logger.warn('Failed to read Project Plus CA certificate file', { caPath, err });
        return undefined;
    }
};
class DisabledProjectPlusClient {
    enabled = false;
    configured = false;
    unavailable() {
        throw app_error_1.AppError.serviceUnavailable('Project Plus integration is not enabled.');
    }
    async listEntities() { return this.unavailable(); }
    async getContractDocumentTypes() { return this.unavailable(); }
    async checkStatus() {
        return {
            reachable: false,
            authenticated: false,
            lastError: 'Project Plus integration is not enabled.',
            checkedAt: new Date().toISOString(),
        };
    }
}
class HttpProjectPlusClient {
    fetchImpl;
    settings;
    enabled = true;
    configured;
    constructor(fetchImpl = fetch, settings = app_config_1.config.projectPlus) {
        this.fetchImpl = fetchImpl;
        this.settings = settings;
        this.configured = Boolean(settings.baseUrl && (settings.authMode === 'none' || settings.authSecret));
    }
    async listEntities(customerType) {
        const data = await this._get(`/ProjectPlus/GetCustomers/${encodeURIComponent(customerType)}`);
        return (Array.isArray(data) ? data : []).map(projectplus_utility_1.normalizeProjectPlusEntity);
    }
    async getContractDocumentTypes() {
        const data = await this._get('/ProjectPlus/GetContractDocumentTypes');
        return (Array.isArray(data) ? data : []).map(projectplus_utility_1.normalizeProjectPlusDocumentType);
    }
    async checkStatus() {
        const checkedAt = new Date().toISOString();
        if (!this.configured) {
            return { reachable: false, authenticated: false, lastError: 'Project Plus is not configured.', checkedAt };
        }
        try {
            await this._get('/ProjectPlus/GetContractDocumentTypes');
            return { reachable: true, authenticated: true, lastError: null, checkedAt };
        }
        catch (err) {
            const message = err instanceof app_error_1.AppError ? err.message : 'Unable to connect to Project Plus.';
            const authFailed = message.includes('credentials');
            return { reachable: authFailed, authenticated: false, lastError: message, checkedAt };
        }
    }
    _headers() {
        const headers = { Accept: 'application/json' };
        if (this.settings.authMode === 'api-key')
            headers[this.settings.authHeader] = this.settings.authSecret;
        if (this.settings.authMode === 'bearer')
            headers.Authorization = `Bearer ${this.settings.authSecret}`;
        return headers;
    }
    /** The only transport method — GET only, by construction. */
    async _get(requestPath) {
        if (!this.configured) {
            throw app_error_1.AppError.serviceUnavailable('Project Plus is enabled but not configured.');
        }
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), this.settings.timeoutMs);
        try {
            const dispatcher = getDispatcher();
            const response = await this.fetchImpl(`${this.settings.baseUrl}${requestPath}`, {
                method: 'GET',
                headers: this._headers(),
                signal: controller.signal,
                ...(dispatcher ? { dispatcher } : {}),
            });
            const raw = await response.text();
            if (!response.ok) {
                logger_util_1.logger.warn('Project Plus request failed', { path: requestPath, status: response.status });
                throw (0, projectplus_utility_1.classifyProjectPlusHttpStatus)(response.status);
            }
            try {
                return JSON.parse(raw);
            }
            catch {
                throw app_error_1.AppError.badGateway(`Project Plus returned a non-JSON response (${response.status}).`);
            }
        }
        catch (err) {
            if (err instanceof app_error_1.AppError)
                throw err;
            throw (0, projectplus_utility_1.classifyProjectPlusNetworkError)(err);
        }
        finally {
            clearTimeout(timeout);
        }
    }
}
exports.HttpProjectPlusClient = HttpProjectPlusClient;
const createProjectPlusClient = () => app_config_1.config.projectPlus.enabled ? new HttpProjectPlusClient() : new DisabledProjectPlusClient();
exports.createProjectPlusClient = createProjectPlusClient;
//# sourceMappingURL=projectplus.client.js.map