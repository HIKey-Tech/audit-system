import { AppError } from '../../../../../shared/errors/app.error';
import { config } from '../../../../../shared/config/app.config';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IAuditLogService } from '../../../../logging/service/interface/audit-log.service.interface';
import { IImocTicketService } from '../../../../integration/imoc/service/interface/imoc-ticket.service.interface';
import { IDirectoryMappingService } from '../../../../integration/service/interface/directory.service.interface';
import { ImocTicket } from '../../../../integration/imoc/domain/entity/imoc.entity';
import { AnalysisRecord, FieldValue, SystemAuditActor } from '../../../domain/entity/system-audit.entity';
import { AnalysisSource, AnalysisType } from '../../../domain/enum/system-audit.enum';
import { IAMS_SOD_RULES } from '../../../utility/analyzers';
import { toDate } from '../../../utility/extract-parser.utility';
import { ILiveSourceService, LiveExtract } from '../interface/live-source.service.interface';

const MAX_SECURITY_EVENTS = 50_000;
const IMOC_PAGE_SIZE = 100;
const IMOC_MAX_PAGES = 20;
// Holding any of these lets an IAMS account change who can do what.
const IAMS_PRIVILEGED_PERMISSIONS = ['user:admin', 'role:assign', 'role:update', 'settings:manage'];

const toRecords = (rows: Array<Record<string, FieldValue>>): AnalysisRecord[] =>
  rows.map((values, i) => ({ rowNumber: i + 2, values }));

const mappedFieldsOf = (records: AnalysisRecord[]): Set<string> =>
  new Set(records.length ? Object.keys(records[0].values) : []);

/** IMOC's documented query timestamp format: `2019-10-01 00:00:00`. */
const imocTimestamp = (date: Date): string => {
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
};

export class LiveSourceService implements ILiveSourceService {
  constructor(
    private readonly userService: IUserService,
    private readonly auditLogService: IAuditLogService,
    private readonly imocTicketService: IImocTicketService,
    private readonly directoryService: IDirectoryMappingService,
  ) {}

  supportedSources(): Partial<Record<AnalysisType, AnalysisSource[]>> {
    return {
      [AnalysisType.AccessListing]: [AnalysisSource.Iams, AnalysisSource.EntraId],
      [AnalysisType.SecurityEventLog]: [AnalysisSource.Iams],
      [AnalysisType.IncidentLog]: [AnalysisSource.Imoc],
    };
  }

  async fetch(
    type: AnalysisType,
    source: AnalysisSource,
    options: { days: number; actor: SystemAuditActor },
  ): Promise<LiveExtract> {
    if (type === AnalysisType.AccessListing && source === AnalysisSource.Iams) return this._iamsAccess();
    if (type === AnalysisType.AccessListing && source === AnalysisSource.EntraId) return this._entraAccess();
    if (type === AnalysisType.SecurityEventLog && source === AnalysisSource.Iams) return this._iamsSecurityEvents(options.days);
    if (type === AnalysisType.IncidentLog && source === AnalysisSource.Imoc) return this._imocIncidents(options.days, options.actor);
    throw AppError.badRequest(`A ${type.replace(/_/g, ' ')} analysis cannot run against the ${source} source`);
  }

  private async _iamsAccess(): Promise<LiveExtract> {
    const users = await this.userService.listAccessEntitlements();
    const records = toRecords(
      users.map((u) => ({
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
      })),
    );
    return {
      systemName: 'IAMS',
      records,
      mappedFields: mappedFieldsOf(records),
      // IAMS is itself the staff directory, so cross-checking would be circular.
      parameterDefaults: { sodRules: IAMS_SOD_RULES, checkDirectory: false },
    };
  }

  private async _entraAccess(): Promise<LiveExtract> {
    const accounts = await this.directoryService.listDirectoryAccounts();
    const records = toRecords(
      accounts.map((a) => ({
        account_id: a.email || a.oid,
        display_name: a.displayName,
        email: a.email || null,
        account_status: a.accountEnabled ? 'active' : 'disabled',
        entitlements: a.groups,
      })),
    );
    return { systemName: 'Entra ID', records, mappedFields: mappedFieldsOf(records), parameterDefaults: {} };
  }

  private async _iamsSecurityEvents(days: number): Promise<LiveExtract> {
    const since = new Date(Date.now() - days * 86_400_000);
    const events = await this.auditLogService.listSecurityEvents(since, MAX_SECURITY_EVENTS);
    const records = toRecords(
      events.map((e) => {
        const values = (e.newValues ?? {}) as Record<string, unknown>;
        return {
          timestamp: new Date(e.createdAt),
          event_type: e.action,
          user: (typeof values.email === 'string' ? values.email : null) ?? e.userDisplayName ?? e.userId,
          outcome: e.status,
          source_ip: e.ipAddress,
        };
      }),
    );
    return { systemName: 'IAMS', records, mappedFields: mappedFieldsOf(records), parameterDefaults: {} };
  }

  private async _imocIncidents(days: number, actor: SystemAuditActor): Promise<LiveExtract> {
    if (!config.imoc.enabled) {
      throw AppError.badRequest('The IMOC integration is not enabled (IMOC_ENABLED=false) — upload an incident export instead');
    }
    const since = imocTimestamp(new Date(Date.now() - days * 86_400_000));
    const tickets: ImocTicket[] = [];
    for (let page = 1; page <= IMOC_MAX_PAGES; page += 1) {
      const result = await this.imocTicketService.searchTickets(
        { page, pageSize: IMOC_PAGE_SIZE, beginStartDate: since },
        { id: actor.id, roles: actor.roles, permissions: actor.permissions },
      );
      tickets.push(...result.items);
      if (!result.hasNext) break;
    }
    const records = toRecords(
      tickets.map((t) => ({
        incident_id: t.orderNumber,
        title: t.orderName,
        category: t.modelName,
        reported_at: toDate(t.beginTime),
        resolved_at: toDate(t.endTime),
        status: t.orderStatus,
        sla_status: t.slaStatus,
        assignee: t.currentUser ?? t.currentHandlingGroup,
      })),
    );
    return { systemName: 'IMOC', records, mappedFields: mappedFieldsOf(records), parameterDefaults: {} };
  }
}
