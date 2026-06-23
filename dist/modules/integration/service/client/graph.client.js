"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGraphDirectoryClient = void 0;
const msal_node_1 = require("@azure/msal-node");
const app_config_1 = require("../../../../shared/config/app.config");
const logger_util_1 = require("../../../../shared/utils/logger.util");
// ── Real client ────────────────────────────────────────────────
class GraphDirectoryClient {
    msal;
    constructor() {
        this.msal = new msal_node_1.ConfidentialClientApplication({
            auth: {
                clientId: app_config_1.config.directorySync.clientId,
                clientSecret: app_config_1.config.directorySync.clientSecret,
                authority: `https://login.microsoftonline.com/${app_config_1.config.directorySync.tenantId}`,
            },
        });
    }
    async token() {
        const res = await this.msal.acquireTokenByClientCredential({
            scopes: ['https://graph.microsoft.com/.default'],
        });
        if (!res?.accessToken)
            throw new Error('Graph token acquisition returned no token');
        return res.accessToken;
    }
    async get(path) {
        const token = await this.token();
        const res = await fetch(`${app_config_1.config.directorySync.graphBaseUrl}${path}`, {
            headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
        });
        if (!res.ok) {
            throw new Error(`Graph GET ${path} failed: ${res.status} ${await res.text()}`);
        }
        return res.json();
    }
    async getUserGroupIds(oid) {
        const data = await this.get(`/users/${oid}/transitiveMemberOf/microsoft.graph.group?$select=id&$top=999`);
        return data.value.map((g) => g.id);
    }
    async listUsersWithGroups() {
        const users = await this.get(`/users?$select=id,mail,userPrincipalName,displayName,accountEnabled&$top=999`);
        const out = [];
        for (const u of users.value) {
            const groupIds = await this.getUserGroupIds(u.id);
            out.push({
                oid: u.id,
                email: (u.mail ?? u.userPrincipalName ?? '').toLowerCase(),
                displayName: u.displayName,
                accountEnabled: u.accountEnabled,
                groupIds,
            });
        }
        return out;
    }
}
// ── Stub (dev / sync disabled) ─────────────────────────────────
class StubGraphDirectoryClient {
    async getUserGroupIds() {
        logger_util_1.logger.warn('StubGraphDirectoryClient.getUserGroupIds() — directory sync disabled');
        return [];
    }
    async listUsersWithGroups() {
        logger_util_1.logger.warn('StubGraphDirectoryClient.listUsersWithGroups() — directory sync disabled');
        return [];
    }
}
const createGraphDirectoryClient = () => app_config_1.config.directorySync.enabled
    ? new GraphDirectoryClient()
    : new StubGraphDirectoryClient();
exports.createGraphDirectoryClient = createGraphDirectoryClient;
//# sourceMappingURL=graph.client.js.map