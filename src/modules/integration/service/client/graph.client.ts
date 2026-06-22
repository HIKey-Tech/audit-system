import { ConfidentialClientApplication } from '@azure/msal-node';
import { config } from '../../../../shared/config/app.config';
import { logger } from '../../../../shared/utils/logger.util';

export interface DirectoryUser {
  oid: string;
  email: string;
  displayName?: string;
  accountEnabled: boolean;
  groupIds: string[];
}

export interface IGraphDirectoryClient {
  /** Overage fallback: fetch a single user's security-group ids. */
  getUserGroupIds(oid: string): Promise<string[]>;
  /** Nightly sync: all users with their group memberships + enabled flag. */
  listUsersWithGroups(): Promise<DirectoryUser[]>;
}

// ── Real client ────────────────────────────────────────────────
class GraphDirectoryClient implements IGraphDirectoryClient {
  private readonly msal: ConfidentialClientApplication;

  constructor() {
    this.msal = new ConfidentialClientApplication({
      auth: {
        clientId: config.directorySync.clientId,
        clientSecret: config.directorySync.clientSecret,
        authority: `https://login.microsoftonline.com/${config.directorySync.tenantId}`,
      },
    });
  }

  private async token(): Promise<string> {
    const res = await this.msal.acquireTokenByClientCredential({
      scopes: ['https://graph.microsoft.com/.default'],
    });
    if (!res?.accessToken) throw new Error('Graph token acquisition returned no token');
    return res.accessToken;
  }

  private async get<T>(path: string): Promise<T> {
    const token = await this.token();
    const res = await fetch(`${config.directorySync.graphBaseUrl}${path}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
    });
    if (!res.ok) {
      throw new Error(`Graph GET ${path} failed: ${res.status} ${await res.text()}`);
    }
    return res.json() as Promise<T>;
  }

  async getUserGroupIds(oid: string): Promise<string[]> {
    const data = await this.get<{ value: { id: string }[] }>(
      `/users/${oid}/transitiveMemberOf/microsoft.graph.group?$select=id&$top=999`,
    );
    return data.value.map((g) => g.id);
  }

  async listUsersWithGroups(): Promise<DirectoryUser[]> {
    const users = await this.get<{
      value: {
        id: string;
        mail?: string;
        userPrincipalName?: string;
        displayName?: string;
        accountEnabled: boolean;
      }[];
    }>(`/users?$select=id,mail,userPrincipalName,displayName,accountEnabled&$top=999`);

    const out: DirectoryUser[] = [];
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
class StubGraphDirectoryClient implements IGraphDirectoryClient {
  async getUserGroupIds(): Promise<string[]> {
    logger.warn('StubGraphDirectoryClient.getUserGroupIds() — directory sync disabled');
    return [];
  }
  async listUsersWithGroups(): Promise<DirectoryUser[]> {
    logger.warn('StubGraphDirectoryClient.listUsersWithGroups() — directory sync disabled');
    return [];
  }
}

export const createGraphDirectoryClient = (): IGraphDirectoryClient =>
  config.directorySync.enabled
    ? new GraphDirectoryClient()
    : new StubGraphDirectoryClient();
