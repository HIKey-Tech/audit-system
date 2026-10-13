// src/modules/user/service/client/ldap.client.ts
import { Client, InvalidCredentialsError, SearchOptions } from 'ldapts';
import { config } from '../../../../shared/config/app.config';
import { logger } from '../../../../shared/utils/logger.util';
import { LdapUserProfile } from '../interface/user.service.interface';

export interface LdapAuthResult {
  success: boolean;
  reason?:
    | 'invalid_credentials'
    | 'user_not_found'
    | 'account_disabled'
    | 'account_locked'
    | 'connection_failed';
  message?: string;
  profile?: LdapUserProfile;
}

export interface ILdapClient {
  authenticate(usernameOrEmail: string, password: string): Promise<LdapAuthResult>;
  searchUser(usernameOrEmail: string): Promise<LdapUserProfile | null>;
  listUsers(): Promise<LdapUserProfile[]>;
  testConnection(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }>;
}

/**
 * Escapes special LDAP filter characters per RFC 4515 to prevent LDAP injection.
 */
function escapeLdapFilter(input: string): string {
  return input
    .replace(/\\/g, '\\5c')
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\0/g, '\\00');
}

/**
 * Extracts both the full DN and the Common Name (CN) from memberOf group entries.
 * E.g. "CN=IAMS-Auditors,OU=Groups,DC=galaxybb,DC=local" yields both the full DN
 * and "IAMS-Auditors", enabling flexible mapping in the Directory Mappings table.
 */
function parseAdGroups(memberOf: unknown): string[] {
  if (!memberOf) return [];
  const rawList = Array.isArray(memberOf) ? memberOf : [memberOf];
  const identifiers: string[] = [];

  for (const item of rawList) {
    if (typeof item === 'string') {
      const trimmed = item.trim();
      identifiers.push(trimmed);
      const cnMatch = trimmed.match(/^CN=([^,]+)/i);
      if (cnMatch && cnMatch[1]) {
        identifiers.push(cnMatch[1].trim());
      }
    }
  }

  return [...new Set(identifiers)];
}

/**
 * Strips domain prefix e.g. "GALAXYBB\john.doe" -> "john.doe".
 */
function cleanUsernameInput(input: string): string {
  return input.trim().replace(/^[a-zA-Z0-9_.-]+\\/, '');
}

/**
 * Real LDAP client for on-premises Windows Server Active Directory Domain Services.
 */
export class LdapClient implements ILdapClient {
  private _createClient(): Client {
    return new Client({
      url: config.ldap.url,
      timeout: config.ldap.timeoutMs,
      connectTimeout: config.ldap.connectTimeoutMs,
      strictDN: config.ldap.strictDn,
    });
  }

  async testConnection(): Promise<{ success: boolean; message: string; details?: Record<string, unknown> }> {
    const client = this._createClient();
    try {
      await client.bind(config.ldap.bindDn, config.ldap.bindPassword);
      const { searchEntries } = await client.search(config.ldap.baseDn, {
        scope: 'base',
        filter: '(objectClass=*)',
        attributes: ['defaultNamingContext', 'namingContexts', 'supportedLDAPVersion'],
      });

      return {
        success: true,
        message: 'Successfully connected and bound to Active Directory Domain Controller',
        details: {
          url: config.ldap.url,
          bindDn: config.ldap.bindDn,
          baseDn: config.ldap.baseDn,
          rootDse: searchEntries[0] ?? null,
        },
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('LDAP testConnection failed', { err, url: config.ldap.url });
      return {
        success: false,
        message: `Failed to connect/bind to Active Directory: ${message}`,
        details: { url: config.ldap.url, bindDn: config.ldap.bindDn },
      };
    } finally {
      await client.unbind().catch(() => {});
    }
  }

  async searchUser(usernameOrEmail: string): Promise<LdapUserProfile | null> {
    const cleanUser = cleanUsernameInput(usernameOrEmail);
    if (!cleanUser) return null;

    const client = this._createClient();
    try {
      await client.bind(config.ldap.bindDn, config.ldap.bindPassword);
      const safe = escapeLdapFilter(cleanUser);
      const filter = `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe})))`;

      const searchOptions: SearchOptions = {
        scope: 'sub',
        filter,
        attributes: [
          'dn',
          'distinguishedName',
          'sAMAccountName',
          'userPrincipalName',
          'mail',
          'displayName',
          'givenName',
          'sn',
          'title',
          'department',
          'telephoneNumber',
          'memberOf',
          'userAccountControl',
        ],
      };

      const { searchEntries } = await client.search(config.ldap.baseDn, searchOptions);
      if (searchEntries.length === 0) {
        return null;
      }

      return this._mapEntryToProfile(searchEntries[0], cleanUser);
    } catch (err) {
      logger.error('LDAP searchUser failed', { user: cleanUser, err });
      return null;
    } finally {
      await client.unbind().catch(() => {});
    }
  }

  async authenticate(usernameOrEmail: string, password: string): Promise<LdapAuthResult> {
    const cleanUser = cleanUsernameInput(usernameOrEmail);
    if (!cleanUser || !password) {
      return { success: false, reason: 'invalid_credentials' };
    }

    const adminClient = this._createClient();
    let userDn: string;
    let profile: LdapUserProfile;

    try {
      await adminClient.bind(config.ldap.bindDn, config.ldap.bindPassword);
    } catch (err) {
      logger.error('LDAP admin bind failed', { err, bindDn: config.ldap.bindDn, url: config.ldap.url });
      await adminClient.unbind().catch(() => {});
      return {
        success: false,
        reason: 'connection_failed',
        message: 'Could not connect to domain controller service account',
      };
    }

    try {
      const safe = escapeLdapFilter(cleanUser);
      const filter = `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe})))`;

      const { searchEntries } = await adminClient.search(config.ldap.baseDn, {
        scope: 'sub',
        filter,
        attributes: [
          'dn',
          'distinguishedName',
          'sAMAccountName',
          'userPrincipalName',
          'mail',
          'displayName',
          'givenName',
          'sn',
          'title',
          'department',
          'telephoneNumber',
          'memberOf',
          'userAccountControl',
        ],
      });

      if (searchEntries.length === 0) {
        logger.warn('LDAP user not found in Active Directory', { user: cleanUser });
        return { success: false, reason: 'user_not_found' };
      }

      const entry = searchEntries[0];
      userDn = String(entry.dn || entry.distinguishedName);
      profile = this._mapEntryToProfile(entry, cleanUser);

      if (!profile.accountEnabled) {
        logger.warn('LDAP login rejected: account is disabled in Active Directory', {
          user: cleanUser,
          dn: userDn,
        });
        return {
          success: false,
          reason: 'account_disabled',
          message: 'Active Directory account is disabled',
        };
      }

      if (profile.accountLocked) {
        logger.warn('LDAP login rejected: account is locked in Active Directory', {
          user: cleanUser,
          dn: userDn,
        });
        return {
          success: false,
          reason: 'account_locked',
          message: 'Active Directory account is locked out',
        };
      }
    } catch (err) {
      logger.error('LDAP user search during auth failed', { user: cleanUser, err });
      return { success: false, reason: 'connection_failed' };
    } finally {
      await adminClient.unbind().catch(() => {});
    }

    // Now attempt user bind to verify password
    const userClient = this._createClient();
    try {
      // User can bind with full DN or userPrincipalName
      await userClient.bind(userDn, password);
      logger.info('LDAP user credentials verified successfully', {
        user: cleanUser,
        email: profile.email,
        dn: userDn,
      });
      return { success: true, profile };
    } catch (err) {
      if (err instanceof InvalidCredentialsError || (err instanceof Error && /invalid/i.test(err.message))) {
        logger.warn('LDAP user bind failed: invalid credentials', { user: cleanUser });
        return { success: false, reason: 'invalid_credentials' };
      }
      logger.error('LDAP user bind error', { user: cleanUser, err });
      return { success: false, reason: 'invalid_credentials' };
    } finally {
      await userClient.unbind().catch(() => {});
    }
  }

  async listUsers(): Promise<LdapUserProfile[]> {
    const client = this._createClient();
    try {
      await client.bind(config.ldap.bindDn, config.ldap.bindPassword);
      const filter = '(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))';

      const { searchEntries } = await client.search(config.ldap.baseDn, {
        scope: 'sub',
        filter,
        attributes: [
          'dn',
          'distinguishedName',
          'sAMAccountName',
          'userPrincipalName',
          'mail',
          'displayName',
          'givenName',
          'sn',
          'title',
          'department',
          'telephoneNumber',
          'memberOf',
          'userAccountControl',
        ],
      });

      return searchEntries.map((e) => this._mapEntryToProfile(e, String(e.sAMAccountName ?? '')));
    } catch (err) {
      logger.error('LDAP listUsers failed', { err });
      return [];
    } finally {
      await client.unbind().catch(() => {});
    }
  }

  private _mapEntryToProfile(entry: Record<string, unknown>, fallbackUsername: string): LdapUserProfile {
    const sAMAccountName = String(entry.sAMAccountName || fallbackUsername);
    const userPrincipalName = entry.userPrincipalName ? String(entry.userPrincipalName) : undefined;
    const mail = entry.mail ? String(entry.mail) : undefined;

    // Email resolution: mail -> userPrincipalName -> construct default
    const email = (mail || userPrincipalName || `${sAMAccountName}@galaxybb.local`).toLowerCase();

    const uac =
      typeof entry.userAccountControl === 'number'
        ? entry.userAccountControl
        : parseInt(String(entry.userAccountControl ?? 512), 10);

    const accountEnabled = (uac & 2) === 0;
    const accountLocked = (uac & 16) !== 0;

    return {
      sAMAccountName,
      userPrincipalName,
      distinguishedName: String(entry.dn || entry.distinguishedName || ''),
      email,
      givenName: entry.givenName ? String(entry.givenName) : undefined,
      familyName: entry.sn ? String(entry.sn) : undefined,
      displayName: entry.displayName ? String(entry.displayName) : undefined,
      jobTitle: entry.title ? String(entry.title) : undefined,
      department: entry.department ? String(entry.department) : undefined,
      phone: entry.telephoneNumber ? String(entry.telephoneNumber) : undefined,
      groups: parseAdGroups(entry.memberOf),
      accountEnabled,
      accountLocked,
    };
  }
}

/**
 * Stub LDAP client for test or disabled environments.
 */
export class StubLdapClient implements ILdapClient {
  async authenticate(): Promise<LdapAuthResult> {
    logger.debug('StubLdapClient.authenticate() called (LDAP disabled)');
    return { success: false, reason: 'user_not_found' };
  }

  async searchUser(): Promise<LdapUserProfile | null> {
    return null;
  }

  async listUsers(): Promise<LdapUserProfile[]> {
    return [];
  }

  async testConnection(): Promise<{ success: boolean; message: string }> {
    return { success: false, message: 'LDAP is disabled in configuration' };
  }
}

export const createLdapClient = (): ILdapClient =>
  config.ldap.enabled ? new LdapClient() : new StubLdapClient();

export const ldapClient = createLdapClient();
