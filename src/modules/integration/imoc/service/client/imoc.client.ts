import { AppError } from '../../../../../shared/errors/app.error';
import { config } from '../../../../../shared/config/app.config';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  ImocModelSummary,
  ImocTicket,
  ImocTicketLookup,
  ImocTicketPage,
  ImocTicketSearch,
} from '../../domain/entity/imoc.entity';
import { normalizeImocModel, normalizeImocTicket } from '../../utility/imoc.utility';

interface ImocEnvelope<T> {
  code?: string | number;
  data?: T;
  error?: string;
  msg?: string;
  status?: string | number;
}

interface ImocMachineTokenEnvelope {
  code?: string | number;
  msg?: string;
  data?: { imoc_token?: unknown } | null;
}

type ImocFetch = (input: string, init: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

export interface IImocTokenProvider {
  readonly configured: boolean;
  getToken(): Promise<string>;
  invalidate(): void;
}

export interface ImocMachineTokenOptions {
  baseUrl: string;
  tenantId?: string;
  tenantAccount?: string;
  machineUserAccount?: string;
  accessKey?: string;
  secretKey?: string;
  timeoutMs: number;
  refreshSkewMs: number;
}

export interface IImocClient {
  readonly enabled: boolean;
  readonly configured: boolean;
  listTickets(query: ImocTicketSearch): Promise<ImocTicketPage>;
  getTicket(lookup: ImocTicketLookup): Promise<ImocTicket>;
  getLightweightTickets(orderIds: string[]): Promise<ImocTicket[]>;
  getTicketStatus(orderNumber: string): Promise<ImocTicket>;
  getCurrentTicketStatus(orderNumber: string): Promise<ImocTicket>;
  getModel(modelId: string): Promise<ImocModelSummary>;
}

const success = (code: unknown): boolean => String(code) === '200' || String(code) === '0';
const machineTokenSuccess = (code: unknown): boolean => String(code) === '1';

/**
 * Applies for and caches the documented IMOC machine-machine token. Credentials
 * are read from deployment configuration only; neither credentials nor tokens
 * are persisted, logged, returned by IAMS, or sent to the frontend.
 */
export class MachineUserImocTokenProvider implements IImocTokenProvider {
  private token: string | null = null;
  private expiresAtMs = 0;
  private refreshInFlight: Promise<string> | null = null;

  readonly configured: boolean;

  constructor(
    private readonly options: ImocMachineTokenOptions,
    private readonly fetchImpl: ImocFetch = fetch,
    private readonly now: () => number = Date.now,
  ) {
    this.configured = Boolean(
      options.baseUrl
        && options.accessKey
        && options.secretKey
        && (options.tenantId || options.tenantAccount),
    );
  }

  async getToken(): Promise<string> {
    if (!this.configured) {
      throw AppError.serviceUnavailable('IMOC machine-user credentials are not configured.');
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

  invalidate(): void {
    this.token = null;
    this.expiresAtMs = 0;
  }

  private async _applyForToken(): Promise<string> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.options.timeoutMs);
    try {
      const response = await this.fetchImpl(
        `${this.options.baseUrl}/esf/iamservice/v1/token/machine-user/apply`,
        {
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
        },
      );
      const raw = await response.text();
      let envelope: ImocMachineTokenEnvelope;
      try {
        envelope = JSON.parse(raw) as ImocMachineTokenEnvelope;
      } catch {
        throw AppError.serviceUnavailable(`IMOC token service returned a non-JSON response (${response.status}).`);
      }
      const rawToken = typeof envelope.data?.imoc_token === 'string' ? envelope.data.imoc_token : '';
      if (!response.ok || !machineTokenSuccess(envelope.code) || !rawToken) {
        logger.warn('IMOC machine-token request failed', {
          status: response.status,
          upstreamCode: envelope.code,
        });
        throw AppError.serviceUnavailable('IMOC could not issue a machine token.');
      }

      // The vendor contract explicitly requires EncodeURI before the token is
      // sent as the imoc_token header on eTicket requests.
      this.token = encodeURI(rawToken);
      this.expiresAtMs = this.now() + (30 * 60 * 1000);
      return this.token;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw AppError.serviceUnavailable('IMOC token service did not respond before the configured timeout.');
      }
      throw AppError.serviceUnavailable('Unable to reach the IMOC token service.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

class StaticImocTokenProvider implements IImocTokenProvider {
  readonly configured: boolean;

  constructor(private readonly token: string, private readonly expiresAt: string) {
    this.configured = Boolean(token);
  }

  async getToken(): Promise<string> {
    if (!this.configured) throw AppError.serviceUnavailable('IMOC token is not configured.');
    if (this.expiresAt && new Date(this.expiresAt).getTime() <= Date.now()) {
      throw AppError.serviceUnavailable('The configured IMOC token has expired.');
    }
    return this.token;
  }

  invalidate(): void {
    // Static break-glass tokens cannot be renewed by IAMS.
  }
}

let sharedMachineTokenProvider: MachineUserImocTokenProvider | undefined;

const createImocTokenProvider = (): IImocTokenProvider => {
  const machineOptions: ImocMachineTokenOptions = {
    baseUrl: config.imoc.baseUrl,
    tenantId: config.imoc.tenantId,
    tenantAccount: config.imoc.tenantAccount,
    machineUserAccount: config.imoc.machineUserAccount,
    accessKey: config.imoc.accessKey,
    secretKey: config.imoc.secretKey,
    timeoutMs: config.imoc.timeoutMs,
    refreshSkewMs: config.imoc.tokenRefreshSkewMs,
  };
  const machineProvider = new MachineUserImocTokenProvider(machineOptions);
  if (machineProvider.configured) {
    sharedMachineTokenProvider ??= machineProvider;
    return sharedMachineTokenProvider;
  }
  return new StaticImocTokenProvider(config.imoc.token, config.imoc.tokenExpiresAt);
};

class DisabledImocClient implements IImocClient {
  readonly enabled = false;
  readonly configured = false;

  private unavailable(): never {
    throw AppError.serviceUnavailable('IMOC integration is not enabled.');
  }

  async listTickets(): Promise<ImocTicketPage> { return this.unavailable(); }
  async getTicket(): Promise<ImocTicket> { return this.unavailable(); }
  async getLightweightTickets(): Promise<ImocTicket[]> { return this.unavailable(); }
  async getTicketStatus(): Promise<ImocTicket> { return this.unavailable(); }
  async getCurrentTicketStatus(): Promise<ImocTicket> { return this.unavailable(); }
  async getModel(): Promise<ImocModelSummary> { return this.unavailable(); }
}

/**
 * HTTP implementation for the documented read-only IMOC eTicket surface.
 * The documented machine-token provider is injected behind this adapter. The
 * remainder of the integration remains read-only and unchanged by token auth.
 */
class HttpImocClient implements IImocClient {
  readonly enabled = true;
  readonly configured: boolean;
  private readonly tokenProvider: IImocTokenProvider;

  constructor() {
    this.tokenProvider = createImocTokenProvider();
    this.configured = Boolean(config.imoc.baseUrl && this.tokenProvider.configured);
  }

  async listTickets(query: ImocTicketSearch): Promise<ImocTicketPage> {
    const data = await this._post<{
      list?: unknown[];
      pageNum?: unknown;
      pageSize?: unknown;
      total?: unknown;
      pages?: unknown;
      hasNextPage?: unknown;
    }>(`/eticket/openapi/order/query/${query.pageSize}/${query.page}`, {
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
      items: (Array.isArray(data.list) ? data.list : []).map(normalizeImocTicket),
      page,
      pageSize,
      total,
      totalPages,
      hasNext: data.hasNextPage === true,
    };
  }

  async getTicket(lookup: ImocTicketLookup): Promise<ImocTicket> {
    return normalizeImocTicket(await this._post('/eticket/openapi/order/query/single', { ...lookup }));
  }

  async getLightweightTickets(orderIds: string[]): Promise<ImocTicket[]> {
    const data = await this._post<unknown>('/eticket/openapi/order/query/single/oa', {
      orderIds: orderIds.join(','),
    });
    return (Array.isArray(data) ? data : [data]).map(normalizeImocTicket);
  }

  async getTicketStatus(orderNumber: string): Promise<ImocTicket> {
    return normalizeImocTicket(await this._post('/eticket/openapi/order/status', { orderNumber }));
  }

  async getCurrentTicketStatus(orderNumber: string): Promise<ImocTicket> {
    return normalizeImocTicket(await this._post('/eticket/openapi/order/StatusForNow', { orderNumber }));
  }

  async getModel(modelId: string): Promise<ImocModelSummary> {
    return normalizeImocModel(await this._post('/eticket/openapi/model/queryByModelId', { modelId }));
  }

  private async _post<T>(path: string, body: Record<string, unknown>, retried = false): Promise<T> {
    if (!this.configured) {
      throw AppError.serviceUnavailable(
        'IMOC is enabled but not configured. Set its machine-user credentials or a valid break-glass token.',
      );
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.imoc.timeoutMs);
    try {
      const token = await this.tokenProvider.getToken();
      const response = await fetch(`${config.imoc.baseUrl}${path}`, {
        method: 'POST',
        headers: {
          Accept: 'application/json;charset=UTF-8',
          'Content-Type': 'application/json',
          imoc_token: token,
        },
        body: JSON.stringify(Object.fromEntries(Object.entries(body).filter(([, value]) => value !== undefined))),
        signal: controller.signal,
      });
      const raw = await response.text();
      let envelope: ImocEnvelope<T>;
      try {
        envelope = JSON.parse(raw) as ImocEnvelope<T>;
      } catch {
        throw AppError.serviceUnavailable(`IMOC returned a non-JSON response (${response.status}).`);
      }
      if ((response.status === 401 || response.status === 403) && !retried) {
        this.tokenProvider.invalidate();
        return this._post<T>(path, body, true);
      }
      if (!response.ok || !success(envelope.code)) {
        const upstreamCode = envelope.code ?? envelope.status ?? response.status;
        logger.warn('IMOC request failed', { path, status: response.status, upstreamCode });
        throw AppError.serviceUnavailable(`IMOC request failed (upstream code ${upstreamCode}).`);
      }
      if (envelope.data === undefined || envelope.data === null) {
        throw AppError.serviceUnavailable('IMOC returned a successful response without ticket data.');
      }
      return envelope.data;
    } catch (err) {
      if (err instanceof AppError) throw err;
      if (err instanceof Error && err.name === 'AbortError') {
        throw AppError.serviceUnavailable('IMOC did not respond before the configured timeout.');
      }
      throw AppError.serviceUnavailable('Unable to reach IMOC.');
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const createImocClient = (): IImocClient =>
  config.imoc.enabled ? new HttpImocClient() : new DisabledImocClient();
