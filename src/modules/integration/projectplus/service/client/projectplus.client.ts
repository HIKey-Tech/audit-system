import fs from 'fs';
import path from 'path';
import { Agent } from 'undici';
import { AppError } from '../../../../../shared/errors/app.error';
import { config } from '../../../../../shared/config/app.config';
import { logger } from '../../../../../shared/utils/logger.util';
import {
  ProjectPlusDocumentType,
  ProjectPlusEntity,
  ProjectPlusStatus,
} from '../../domain/entity/projectplus.entity';
import {
  classifyProjectPlusHttpStatus,
  classifyProjectPlusNetworkError,
  normalizeProjectPlusDocumentType,
  normalizeProjectPlusEntity,
} from '../../utility/projectplus.utility';

/**
 * Read-only contract with Project Plus (via the Hub360 gateway). Only GET
 * operations exist on this interface — the gateway's create/update/approve
 * endpoints are intentionally not representable, so IAMS cannot write to it.
 */
export interface IProjectPlusClient {
  readonly enabled: boolean;
  readonly configured: boolean;
  listEntities(customerType: string): Promise<ProjectPlusEntity[]>;
  getContractDocumentTypes(): Promise<ProjectPlusDocumentType[]>;
  checkStatus(): Promise<ProjectPlusStatus>;
}

export type ProjectPlusFetch = (input: string, init: RequestInit) => Promise<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
}>;

let sharedDispatcher: Agent | undefined;

const getDispatcher = (): Agent | undefined => {
  if (sharedDispatcher) return sharedDispatcher;
  const caPath = config.projectPlus.caCertPath;
  if (!caPath) return undefined;
  try {
    const ca = fs.readFileSync(path.resolve(process.cwd(), caPath));
    sharedDispatcher = new Agent({ connect: { ca } });
    return sharedDispatcher;
  } catch (err) {
    logger.warn('Failed to read Project Plus CA certificate file', { caPath, err });
    return undefined;
  }
};

class DisabledProjectPlusClient implements IProjectPlusClient {
  readonly enabled = false;
  readonly configured = false;

  private unavailable(): never {
    throw AppError.serviceUnavailable('Project Plus integration is not enabled.');
  }

  async listEntities(): Promise<ProjectPlusEntity[]> { return this.unavailable(); }
  async getContractDocumentTypes(): Promise<ProjectPlusDocumentType[]> { return this.unavailable(); }
  async checkStatus(): Promise<ProjectPlusStatus> {
    return {
      reachable: false,
      authenticated: false,
      lastError: 'Project Plus integration is not enabled.',
      checkedAt: new Date().toISOString(),
    };
  }
}

export class HttpProjectPlusClient implements IProjectPlusClient {
  readonly enabled = true;
  readonly configured: boolean;

  constructor(
    private readonly fetchImpl: ProjectPlusFetch = fetch as unknown as ProjectPlusFetch,
    private readonly settings = config.projectPlus,
  ) {
    this.configured = Boolean(
      settings.baseUrl && (settings.authMode === 'none' || settings.authSecret),
    );
  }

  async listEntities(customerType: string): Promise<ProjectPlusEntity[]> {
    const data = await this._get<unknown>(`/ProjectPlus/GetCustomers/${encodeURIComponent(customerType)}`);
    return (Array.isArray(data) ? data : []).map(normalizeProjectPlusEntity);
  }

  async getContractDocumentTypes(): Promise<ProjectPlusDocumentType[]> {
    const data = await this._get<unknown>('/ProjectPlus/GetContractDocumentTypes');
    return (Array.isArray(data) ? data : []).map(normalizeProjectPlusDocumentType);
  }

  async checkStatus(): Promise<ProjectPlusStatus> {
    const checkedAt = new Date().toISOString();
    if (!this.configured) {
      return { reachable: false, authenticated: false, lastError: 'Project Plus is not configured.', checkedAt };
    }
    try {
      await this._get<unknown>('/ProjectPlus/GetContractDocumentTypes');
      return { reachable: true, authenticated: true, lastError: null, checkedAt };
    } catch (err) {
      const message = err instanceof AppError ? err.message : 'Unable to connect to Project Plus.';
      const authFailed = message.includes('credentials');
      return { reachable: authFailed, authenticated: false, lastError: message, checkedAt };
    }
  }

  private _headers(): Record<string, string> {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (this.settings.authMode === 'api-key') headers[this.settings.authHeader] = this.settings.authSecret;
    if (this.settings.authMode === 'bearer') headers.Authorization = `Bearer ${this.settings.authSecret}`;
    return headers;
  }

  /** The only transport method — GET only, by construction. */
  private async _get<T>(requestPath: string): Promise<T> {
    if (!this.configured) {
      throw AppError.serviceUnavailable('Project Plus is enabled but not configured.');
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
      } as RequestInit);
      const raw = await response.text();
      if (!response.ok) {
        logger.warn('Project Plus request failed', { path: requestPath, status: response.status });
        throw classifyProjectPlusHttpStatus(response.status);
      }
      try {
        return JSON.parse(raw) as T;
      } catch {
        throw AppError.badGateway(`Project Plus returned a non-JSON response (${response.status}).`);
      }
    } catch (err) {
      if (err instanceof AppError) throw err;
      throw classifyProjectPlusNetworkError(err);
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const createProjectPlusClient = (): IProjectPlusClient =>
  config.projectPlus.enabled ? new HttpProjectPlusClient() : new DisabledProjectPlusClient();
