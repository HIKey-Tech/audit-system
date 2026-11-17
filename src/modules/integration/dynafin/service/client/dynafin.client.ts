import fs from 'fs';
import path from 'path';
import { Agent } from 'undici';
import { AppError } from '../../../../../shared/errors/app.error';
import { config } from '../../../../../shared/config/app.config';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  DynafinConnectionInfo,
  DynafinPeriodQuery,
  DynafinStaffAdvance,
  DynafinStatus,
  DynafinTransaction,
} from '../../domain/entity/dynafin.entity';
import {
  classifyDynafinHttpStatus,
  classifyDynafinNetworkError,
  normalizeDynafinStaffAdvance,
  normalizeDynafinTransaction,
  unwrapList,
} from '../../utility/dynafin.utility';
import { buildFixtureStaffAdvances, buildFixtureTransactions } from '../../utility/dynafin.fixture';

/**
 * Read-only contract with Dynafin. Only GET operations exist on this interface, so IAMS
 * cannot write to the finance system by construction.
 *
 * Everything the financial analyses need from Dynafin is expressed here in IAMS's own
 * canonical shapes (domain/entity/dynafin.entity.ts). To connect the real system, make
 * `HttpDynafinClient` return those shapes — nothing else in IAMS needs to change.
 */
export interface IDynafinClient {
  readonly enabled: boolean;
  readonly configured: boolean;
  readonly info: DynafinConnectionInfo;
  /** Name shown on analysis runs, e.g. "Dynafin" or "Dynafin (SAMPLE DATA)". */
  readonly systemLabel: string;
  listTransactions(period: DynafinPeriodQuery): Promise<DynafinTransaction[]>;
  listStaffAdvances(period: DynafinPeriodQuery): Promise<DynafinStaffAdvance[]>;
  checkStatus(): Promise<DynafinStatus>;
}

/**
 * Where Dynafin serves each dataset. ► TODO(Dynafin API): replace these placeholder paths
 * with the real ones when the vendor publishes the API, and adjust the field aliases in
 * utility/dynafin.utility.ts if the response shape differs. These are the only two places
 * that need to change.
 */
export const DYNAFIN_ENDPOINTS = {
  transactions: '/transactions',
  staffAdvances: '/staff-advances',
  health: '/health',
} as const;

export type DynafinFetch = (input: string, init: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

let sharedDispatcher: Agent | undefined;

const getDispatcher = (): Agent | undefined => {
  if (sharedDispatcher) return sharedDispatcher;
  const caPath = config.dynafin.caCertPath;
  if (!caPath) return undefined;
  try {
    const ca = fs.readFileSync(path.resolve(process.cwd(), caPath));
    sharedDispatcher = new Agent({ connect: { ca } });
    return sharedDispatcher;
  } catch (err) {
    logger.warn('Failed to read Dynafin CA certificate file', { caPath, err });
    return undefined;
  }
};

export class DisabledDynafinClient implements IDynafinClient {
  readonly enabled = false;
  readonly configured = false;
  readonly systemLabel = 'Dynafin';
  readonly info: DynafinConnectionInfo = { enabled: false, configured: false, driver: 'disabled', sampleData: false };

  private unavailable(): never {
    throw AppError.serviceUnavailable('The Dynafin integration is not enabled.');
  }

  async listTransactions(): Promise<DynafinTransaction[]> { return this.unavailable(); }
  async listStaffAdvances(): Promise<DynafinStaffAdvance[]> { return this.unavailable(); }
  async checkStatus(): Promise<DynafinStatus> {
    return {
      reachable: false,
      authenticated: false,
      lastError: 'The Dynafin integration is not enabled.',
      checkedAt: new Date().toISOString(),
    };
  }
}

export class HttpDynafinClient implements IDynafinClient {
  readonly enabled = true;
  readonly configured: boolean;
  readonly systemLabel = 'Dynafin';
  readonly info: DynafinConnectionInfo;

  constructor(
    private readonly fetchImpl: DynafinFetch = fetch as unknown as DynafinFetch,
    private readonly settings = config.dynafin,
  ) {
    this.configured = Boolean(settings.baseUrl && (settings.authMode === 'none' || settings.authSecret));
    this.info = { enabled: true, configured: this.configured, driver: 'http', sampleData: false };
  }

  async listTransactions(period: DynafinPeriodQuery): Promise<DynafinTransaction[]> {
    const payload = await this._get<unknown>(DYNAFIN_ENDPOINTS.transactions, { from: period.from, to: period.to });
    return this._normalise(unwrapList(payload), normalizeDynafinTransaction, 'transactions');
  }

  async listStaffAdvances(period: DynafinPeriodQuery): Promise<DynafinStaffAdvance[]> {
    const payload = await this._get<unknown>(DYNAFIN_ENDPOINTS.staffAdvances, { from: period.from, to: period.to });
    return this._normalise(unwrapList(payload), normalizeDynafinStaffAdvance, 'staff advances');
  }

  async checkStatus(): Promise<DynafinStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.configured) {
      return { reachable: false, authenticated: false, lastError: 'Dynafin is not configured.', checkedAt };
    }
    try {
      await this._get<unknown>(DYNAFIN_ENDPOINTS.health);
      return { reachable: true, authenticated: true, lastError: null, checkedAt };
    } catch (err) {
      const message = err instanceof AppError ? err.message : 'Unable to connect to Dynafin.';
      const authFailed = message.includes('credentials');
      return { reachable: authFailed, authenticated: false, lastError: message, checkedAt };
    }
  }

  /** Normalises a list and says so when records had to be dropped — they are never guessed at. */
  private _normalise<T>(rows: unknown[], normalise: (raw: unknown) => T | null, what: string): T[] {
    const kept = rows.map(normalise).filter((r): r is T => r !== null);
    if (kept.length < rows.length) {
      logger.warn('Dynafin records skipped (missing reference, date or amount)', { what, skipped: rows.length - kept.length, received: rows.length });
    }
    return kept;
  }

  private _headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.settings.authMode === 'api-key') headers[this.settings.authHeader] = this.settings.authSecret;
    if (this.settings.authMode === 'bearer') headers.Authorization = `Bearer ${this.settings.authSecret}`;
    return headers;
  }

  /** The only transport method — GET only, by construction. */
  private async _get<T>(requestPath: string, query?: Record<string, string>): Promise<T> {
    if (!this.configured) {
      throw AppError.serviceUnavailable('Dynafin is enabled but not configured.');
    }
    const qs = query ? `?${new URLSearchParams(query).toString()}` : '';
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.settings.timeoutMs);
    try {
      const dispatcher = getDispatcher();
      const response = await this.fetchImpl(`${this.settings.baseUrl}${requestPath}${qs}`, {
        method: 'GET',
        headers: this._headers(),
        signal: controller.signal,
        ...(dispatcher ? { dispatcher } : {}),
      } as RequestInit);
      const raw = await response.text();
      if (!response.ok) {
        logger.warn('Dynafin request failed', { path: requestPath, status: response.status });
        throw classifyDynafinHttpStatus(response.status);
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        throw AppError.badGateway(`Dynafin returned a non-JSON response (${response.status}).`);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw classifyDynafinNetworkError(err);
    } finally {
      clearTimeout(timeout);
    }
  }
}

const periodBounds = (period: DynafinPeriodQuery): { from: number; to: number } => {
  const from = new Date(period.from).getTime();
  // A bare date means "through the end of that day".
  const toRaw = /^\d{4}-\d{2}-\d{2}$/.test(period.to) ? `${period.to}T23:59:59.999Z` : period.to;
  return { from, to: new Date(toRaw).getTime() };
};

/**
 * Made-up, clearly labelled data for UAT and demos so the financial analyses can be shown
 * before Dynafin is connected. Never constructed in production (see the factory and the
 * config validation).
 */
export class FixtureDynafinClient implements IDynafinClient {
  readonly enabled = true;
  readonly configured = true;
  readonly systemLabel = 'Dynafin (SAMPLE DATA)';
  readonly info: DynafinConnectionInfo = { enabled: true, configured: true, driver: 'fixture', sampleData: true };

  private anchor(period: DynafinPeriodQuery): Date {
    return new Date(periodBounds(period).to);
  }

  async listTransactions(period: DynafinPeriodQuery): Promise<DynafinTransaction[]> {
    const { from, to } = periodBounds(period);
    return buildFixtureTransactions(this.anchor(period)).filter((t) => {
      const at = new Date(t.postingDate).getTime();
      return at >= from && at <= to;
    });
  }

  async listStaffAdvances(period: DynafinPeriodQuery): Promise<DynafinStaffAdvance[]> {
    const { from, to } = periodBounds(period);
    // Issued in the window, OR still unretired — an old unretired advance is exactly what the report is for.
    return buildFixtureStaffAdvances(this.anchor(period)).filter((a) => {
      const at = new Date(a.issuedAt).getTime();
      const outstanding = a.amount - a.retiredAmount - a.refundedAmount > 0;
      return at <= to && (at >= from || outstanding);
    });
  }

  async checkStatus(): Promise<DynafinStatus> {
    return { reachable: true, authenticated: true, lastError: null, checkedAt: new Date().toISOString() };
  }
}

export const createDynafinClient = (
  settings: Pick<typeof config.dynafin, 'enabled' | 'driver'> = config.dynafin,
  isProd: boolean = config.app.isProd,
): IDynafinClient => {
  if (!settings.enabled) return new DisabledDynafinClient();
  if (settings.driver === 'fixture') {
    // Defence in depth: config validation already refuses this, but sample data must never reach production.
    if (isProd) throw new Error('DYNAFIN_DRIVER=fixture is not allowed in production.');
    return new FixtureDynafinClient();
  }
  return new HttpDynafinClient();
};
