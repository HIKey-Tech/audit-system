"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LiveSourceService = void 0;
const app_error_1 = require("../../../../../shared/errors/app.error");
const app_config_1 = require("../../../../../shared/config/app.config");
const system_audit_enum_1 = require("../../../domain/enum/system-audit.enum");
const analyzers_1 = require("../../../utility/analyzers");
const extract_parser_utility_1 = require("../../../utility/extract-parser.utility");
const MAX_SECURITY_EVENTS = 50_000;
const IMOC_PAGE_SIZE = 100;
const IMOC_MAX_PAGES = 20;
// Holding any of these lets an IAMS account change who can do what.
const IAMS_PRIVILEGED_PERMISSIONS = ['user:admin', 'role:assign', 'role:update', 'settings:manage'];
const toRecords = (rows) => rows.map((values, i) => ({ rowNumber: i + 2, values }));
const mappedFieldsOf = (records) => new Set(records.length ? Object.keys(records[0].values) : []);
/** IMOC's documented query timestamp format: `2019-10-01 00:00:00`. */
const imocTimestamp = (date) => {
    const pad = (n) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};
class LiveSourceService {
    userService;
    auditLogService;
    imocTicketService;
    directoryService;
    constructor(userService, auditLogService, imocTicketService, directoryService) {
        this.userService = userService;
        this.auditLogService = auditLogService;
        this.imocTicketService = imocTicketService;
        this.directoryService = directoryService;
    }
    supportedSources() {
        return {
            [system_audit_enum_1.AnalysisType.AccessListing]: [system_audit_enum_1.AnalysisSource.Iams, system_audit_enum_1.AnalysisSource.EntraId],
            [system_audit_enum_1.AnalysisType.SecurityEventLog]: [system_audit_enum_1.AnalysisSource.Iams],
            [system_audit_enum_1.AnalysisType.IncidentLog]: [system_audit_enum_1.AnalysisSource.Imoc],
        };
    }
    async fetch(type, source, options) {
        if (type === system_audit_enum_1.AnalysisType.AccessListing && source === system_audit_enum_1.AnalysisSource.Iams)
            return this._iamsAccess();
        if (type === system_audit_enum_1.AnalysisType.AccessListing && source === system_audit_enum_1.AnalysisSource.EntraId)
            return this._entraAccess();
        if (type === system_audit_enum_1.AnalysisType.SecurityEventLog && source === system_audit_enum_1.AnalysisSource.Iams)
            return this._iamsSecurityEvents(options.days);
        if (type === system_audit_enum_1.AnalysisType.IncidentLog && source === system_audit_enum_1.AnalysisSource.Imoc)
            return this._imocIncidents(options.days, options.actor);
        throw app_error_1.AppError.badRequest(`A ${type.replace(/_/g, ' ')} analysis cannot run against the ${source} source`);
    }
    async _iamsAccess() {
        const users = await this.userService.listAccessEntitlements();
        const records = toRecords(users.map((u) => ({
            account_id: u.email,
            display_name: u.displayName,
            email: u.email,
            department: u.department,
            account_status: u.isActive ? 'active' : 'disabled',
            entitlements: u.roles,
            permissions: u.permissions,
            last_login: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
            privileged: u.isSuperAdmin || u.permissions.some((p) => IAMS_PRIVILEGED_PERMISSIONS.includes(p)),
            created_at: new Date(u.createdAt),
            mfa_enabled: u.mfaEnabled,
        })));
        return {
            systemName: 'IAMS',
            records,
            mappedFields: mappedFieldsOf(records),
            // IAMS is itself the staff directory, so cross-checking would be circular.
            parameterDefaults: { sodRules: analyzers_1.IAMS_SOD_RULES, checkDirectory: false },
        };
    }
    async _entraAccess() {
        const accounts = await this.directoryService.listDirectoryAccounts();
        const records = toRecords(accounts.map((a) => ({
            account_id: a.email || a.oid,
            display_name: a.displayName,
            email: a.email || null,
            account_status: a.accountEnabled ? 'active' : 'disabled',
            entitlements: a.groups,
        })));
        return { systemName: 'Entra ID', records, mappedFields: mappedFieldsOf(records), parameterDefaults: {} };
    }
    async _iamsSecurityEvents(days) {
        const since = new Date(Date.now() - days * 86_400_000);
        const events = await this.auditLogService.listSecurityEvents(since, MAX_SECURITY_EVENTS);
        const records = toRecords(events.map((e) => {
            const values = (e.newValues ?? {});
            return {
                timestamp: new Date(e.createdAt),
                event_type: e.action,
                user: (typeof values.email === 'string' ? values.email : null) ?? e.userDisplayName ?? e.userId,
                outcome: e.status,
                source_ip: e.ipAddress,
            };
        }));
        return { systemName: 'IAMS', records, mappedFields: mappedFieldsOf(records), parameterDefaults: {} };
    }
    async _imocIncidents(days, actor) {
        if (!app_config_1.config.imoc.enabled) {
            throw app_error_1.AppError.badRequest('The IMOC integration is not enabled (IMOC_ENABLED=false) — upload an incident export instead');
        }
        const since = imocTimestamp(new Date(Date.now() - days * 86_400_000));
        const tickets = [];
        for (let page = 1; page <= IMOC_MAX_PAGES; page += 1) {
            const result = await this.imocTicketService.searchTickets({ page, pageSize: IMOC_PAGE_SIZE, beginStartDate: since }, { id: actor.id, roles: actor.roles, permissions: actor.permissions });
            tickets.push(...result.items);
            if (!result.hasNext)
                break;
        }
        const records = toRecords(tickets.map((t) => ({
            incident_id: t.orderNumber,
            title: t.orderName,
            category: t.modelName,
            reported_at: (0, extract_parser_utility_1.toDate)(t.beginTime),
            resolved_at: (0, extract_parser_utility_1.toDate)(t.endTime),
            status: t.orderStatus,
            sla_status: t.slaStatus,
            assignee: t.currentUser ?? t.currentHandlingGroup,
        })));
        return { systemName: 'IMOC', records, mappedFields: mappedFieldsOf(records), parameterDefaults: {} };
    }
}
exports.LiveSourceService = LiveSourceService;
//# sourceMappingURL=live-source.service.js.map