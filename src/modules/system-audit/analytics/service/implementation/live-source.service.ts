import { AppError } from '../../../../../shared/errors/app.error';
import { config } from '../../../../../shared/config/app.config';
import { IUserService } from '../../../../user/service/interface/user.service.interface';
import { IAuditLogService } from '../../../../logging/service/interface/audit-log.service.interface';
import { IImocTicketService } from '../../../../integration/imoc/service/interface/imoc-ticket.service.interface';
import { IDirectoryMappingService } from '../../../../integration/service/interface/directory.service.interface';
import { IDynafinClient } from '../../../../integration/dynafin/service/client/dynafin.client';
import { ISystemConfigService } from '../../../../settings/service/interface/system-config.service.interface';
import { DEFAULT_HIGH_VALUE_EXPENDITURE_THRESHOLD, DEFAULT_HIGH_VALUE_THRESHOLD } from '../../../utility/analyzers/high-value-transactions.analyzer';
import { DYNAFIN_CONFIG_KEYS, parseThreshold } from '../../../utility/dynafin-config.utility';
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

/**
 * Fields that carry at least one real value. A live source "supplies" a field only when the
 * system actually returned data for it — otherwise a rule such as "missing approver" would
 * fire on every record just because Dynafin's API does not expose approvers at all.
 */
const suppliedFields = (records: AnalysisRecord[]): Set<string> => {
  const supplied = new Set<string>();
  for (const r of records) {
    for (const [key, value] of Object.entries(r.values)) {
      if (value !== null && value !== undefined && value !== '') supplied.add(key);
    }
  }
  return supplied;
};

const DYNAFIN_TYPES: readonly AnalysisType[] = [
  AnalysisType.HighValueTransactions,
  AnalysisType.DuplicatePostings,
  AnalysisType.StaffAdvances,
];
export const isDynafinAnalysis = (type: AnalysisType): boolean => DYNAFIN_TYPES.includes(type);

/** Advances still unretired are the point of the report, however long ago they were issued. */
const ADVANCE_MIN_LOOKBACK_DAYS = 90;

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
    private readonly dynafin: IDynafinClient,
    private readonly systemConfig: ISystemConfigService,
  ) {}

  supportedSources(): Partial<Record<AnalysisType, AnalysisSource[]>> {
    const sources: Partial<Record<AnalysisType, AnalysisSource[]>> = {
      [AnalysisType.AccessListing]: [AnalysisSource.Iams, AnalysisSource.EntraId],
      [AnalysisType.SecurityEventLog]: [AnalysisSource.Iams],
      [AnalysisType.IncidentLog]: [AnalysisSource.Imoc],
    };
    // Offered only while the integration is on, so the UI never suggests a source that cannot run.
    if (this.dynafin.enabled) {
      for (const type of DYNAFIN_TYPES) sources[type] = [AnalysisSource.Dynafin];
    }
    return sources;
  }

  async parameterDefaultsFor(type: AnalysisType): Promise<Record<string, unknown>> {
    if (!isDynafinAnalysis(type)) return {};
    const highValue = await this._threshold(DYNAFIN_CONFIG_KEYS.highValue, DEFAULT_HIGH_VALUE_THRESHOLD);
    if (type === AnalysisType.HighValueTransactions) {
      const expenditure = await this._threshold(DYNAFIN_CONFIG_KEYS.highValueExpenditure, DEFAULT_HIGH_VALUE_EXPENDITURE_THRESHOLD);
      return { threshold: highValue, expenditureThreshold: expenditure };
    }
    if (type === AnalysisType.DuplicatePostings) return { splitThreshold: highValue };
    return {};
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
    if (source === AnalysisSource.Dynafin && isDynafinAnalysis(type)) return this._dynafin(type, options.days);
    throw AppError.badRequest(`A ${type.replace(/_/g, ' ')} analysis cannot run against the ${source} source`);
  }

  private async _threshold(key: string, fallback: number): Promise<number> {
    try {
      return parseThreshold((await this.systemConfig.getConfig(key)).value) ?? fallback;
    } catch {
      return fallback; // no row yet, or unreadable: the built-in default applies
    }
  }

  private async _dynafin(type: AnalysisType, days: number): Promise<LiveExtract> {
    if (!this.dynafin.enabled) {
      throw AppError.badRequest('The Dynafin integration is not enabled (DYNAFIN_ENABLED=false) — upload a Dynafin export instead');
    }
    const to = new Date();
    const lookbackDays = type === AnalysisType.StaffAdvances ? Math.max(days, ADVANCE_MIN_LOOKBACK_DAYS) : days;
    const period = { from: new Date(to.getTime() - lookbackDays * 86_400_000).toISOString(), to: to.toISOString() };
    const parameterDefaults = await this.parameterDefaultsFor(type);

    if (type === AnalysisType.StaffAdvances) {
      const advances = await this.dynafin.listStaffAdvances(period);
      const records = toRecords(
        advances.map((a) => ({
          advance_id: a.advanceId,
          employee: a.employee,
          employee_id: a.employeeId,
          issued_at: new Date(a.issuedAt),
          amount: a.amount,
          retired_amount: a.retiredAmount,
          refunded_amount: a.refundedAmount,
          retired_at: a.retiredAt ? new Date(a.retiredAt) : null,
          purpose: a.purpose,
        })),
      );
      return { systemName: this.dynafin.systemLabel, records, mappedFields: suppliedFields(records), parameterDefaults };
    }

    const transactions = await this.dynafin.listTransactions(period);
    const records = toRecords(
      transactions.map((t) => ({
        reference: t.reference,
        posting_date: new Date(t.postingDate),
        amount: t.amount,
        account_code: t.accountCode,
        account_name: t.accountName,
        expense_category: t.expenseCategory,
        description: t.description,
        payee: t.payee,
        department: t.department,
        posted_by: t.postedBy,
        approved_by: t.approvedBy,
        supporting_ref: t.supportingRef,
        invoice_number: t.invoiceNumber,
        is_reversal: t.isReversal,
      })),
    );
    return { systemName: this.dynafin.systemLabel, records, mappedFields: suppliedFields(records), parameterDefaults };
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
    const actorContext = { id: actor.id, roles: actor.roles, permissions: actor.permissions };
    const sinceDate = new Date(Date.now() - days * 86_400_000);

    // Prefer local ticket store so continuous monitoring functions independently of live IMOC connectivity
    try {
      const stored = await this.imocTicketService.listStoredTickets(
        { createdFrom: sinceDate.toISOString() },
        actorContext,
      );
      if (stored.length > 0) {
        const records = toRecords(
          stored.map((t) => ({
            incident_id: t.orderNumber,
            title: t.orderName,
            category: t.category ?? t.modelName,
            reported_at: toDate(t.imocCreatedAt),
            resolved_at: toDate(t.imocEndedAt),
            status: t.orderStatus,
            sla_status: t.slaStatus,
            assignee: t.currentHandler,
          })),
        );
        return { systemName: 'IMOC', records, mappedFields: mappedFieldsOf(records), parameterDefaults: {} };
      }
    } catch {
      // Fall through to live fetch if store read errors or is empty
    }

    if (!config.imoc.enabled) {
      throw AppError.badRequest('The IMOC integration is not enabled (IMOC_ENABLED=false) — upload an incident export instead');
    }
    const since = imocTimestamp(sinceDate);
    const tickets: ImocTicket[] = [];
    for (let page = 1; page <= IMOC_MAX_PAGES; page += 1) {
      const result = await this.imocTicketService.searchTickets(
        { page, pageSize: IMOC_PAGE_SIZE, beginStartDate: since },
        actorContext,
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
