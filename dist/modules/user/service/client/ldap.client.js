"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ldapClient = exports.createLdapClient = exports.StubLdapClient = exports.LdapClient = void 0;
// src/modules/user/service/client/ldap.client.ts
const ldapts_1 = require("ldapts");
const app_config_1 = require("../../../../shared/config/app.config");
const logger_util_1 = require("../../../../shared/utils/logger.util");
/**
 * Escapes special LDAP filter characters per RFC 4515 to prevent LDAP injection.
 */
function escapeLdapFilter(input) {
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
function parseAdGroups(memberOf) {
    if (!memberOf)
        return [];
    const rawList = Array.isArray(memberOf) ? memberOf : [memberOf];
    const identifiers = [];
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
function cleanUsernameInput(input) {
    return input.trim().replace(/^[a-zA-Z0-9_.-]+\\/, '');
}
/**
 * Real LDAP client for on-premises Windows Server Active Directory Domain Services.
 */
class LdapClient {
    _createClient() {
        return new ldapts_1.Client({
            url: app_config_1.config.ldap.url,
            timeout: app_config_1.config.ldap.timeoutMs,
            connectTimeout: app_config_1.config.ldap.connectTimeoutMs,
            strictDN: app_config_1.config.ldap.strictDn,
        });
    }
    async _bindServiceAccount(client) {
        const candidates = [
            app_config_1.config.ldap.bindDn,
            'GALAXYBB\\gbb-iams',
            'gbb-iams',
            `CN=gbb-iams,CN=Users,${app_config_1.config.ldap.baseDn}`,
        ].filter((v, i, a) => a.indexOf(v) === i);
        let lastError;
        for (const dn of candidates) {
            try {
                await client.bind(dn, app_config_1.config.ldap.bindPassword);
                return dn;
            }
            catch (err) {
                lastError = err;
            }
        }
        throw lastError;
    }
    async testConnection() {
        const client = this._createClient();
        try {
            const boundDn = await this._bindServiceAccount(client);
            const { searchEntries } = await client.search(app_config_1.config.ldap.baseDn, {
                scope: 'base',
                filter: '(objectClass=*)',
                attributes: ['defaultNamingContext', 'namingContexts', 'supportedLDAPVersion'],
            });
            return {
                success: true,
                message: 'Successfully connected and bound to Active Directory Domain Controller',
                details: {
                    url: app_config_1.config.ldap.url,
                    bindDn: app_config_1.config.ldap.bindDn,
                    baseDn: app_config_1.config.ldap.baseDn,
                    rootDse: searchEntries[0] ?? null,
                },
            };
        }
        catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            logger_util_1.logger.error('LDAP testConnection failed', { err, url: app_config_1.config.ldap.url });
            return {
                success: false,
                message: `Failed to connect/bind to Active Directory: ${message}`,
                details: { url: app_config_1.config.ldap.url, bindDn: app_config_1.config.ldap.bindDn },
            };
        }
        finally {
            await client.unbind().catch(() => { });
        }
    }
    async searchUser(usernameOrEmail) {
        const cleanUser = cleanUsernameInput(usernameOrEmail);
        if (!cleanUser)
            return null;
        const client = this._createClient();
        try {
            await this._bindServiceAccount(client);
            const safe = escapeLdapFilter(cleanUser);
            const filter = `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe})))`;
            const searchOptions = {
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
            const { searchEntries } = await client.search(app_config_1.config.ldap.baseDn, searchOptions);
            if (searchEntries.length === 0) {
                return null;
            }
            return this._mapEntryToProfile(searchEntries[0], cleanUser);
        }
        catch (err) {
            logger_util_1.logger.error('LDAP searchUser failed', { user: cleanUser, err });
            return null;
        }
        finally {
            await client.unbind().catch(() => { });
        }
    }
    async authenticate(usernameOrEmail, password) {
        const cleanUser = cleanUsernameInput(usernameOrEmail);
        if (!cleanUser || !password) {
            return { success: false, reason: 'invalid_credentials' };
        }
        const adminClient = this._createClient();
        let userDn;
        let profile;
        try {
            await this._bindServiceAccount(adminClient);
        }
        catch (err) {
            logger_util_1.logger.error('LDAP admin bind failed', { err, bindDn: app_config_1.config.ldap.bindDn, url: app_config_1.config.ldap.url });
            await adminClient.unbind().catch(() => { });
            return {
                success: false,
                reason: 'connection_failed',
                message: 'Could not connect to domain controller service account',
            };
        }
        try {
            const safe = escapeLdapFilter(cleanUser);
            const filter = `(&(objectCategory=person)(objectClass=user)(|(sAMAccountName=${safe})(userPrincipalName=${safe})(mail=${safe})))`;
            const { searchEntries } = await adminClient.search(app_config_1.config.ldap.baseDn, {
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
                logger_util_1.logger.warn('LDAP user not found in Active Directory', { user: cleanUser });
                return { success: false, reason: 'user_not_found' };
            }
            const entry = searchEntries[0];
            userDn = String(entry.dn || entry.distinguishedName);
            profile = this._mapEntryToProfile(entry, cleanUser);
            if (!profile.accountEnabled) {
                logger_util_1.logger.warn('LDAP login rejected: account is disabled in Active Directory', {
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
                logger_util_1.logger.warn('LDAP login rejected: account is locked in Active Directory', {
                    user: cleanUser,
                    dn: userDn,
                });
                return {
                    success: false,
                    reason: 'account_locked',
                    message: 'Active Directory account is locked out',
                };
            }
        }
        catch (err) {
            logger_util_1.logger.error('LDAP user search during auth failed', { user: cleanUser, err });
            return { success: false, reason: 'connection_failed' };
        }
        finally {
            await adminClient.unbind().catch(() => { });
        }
        // Now attempt user bind to verify password
        const userClient = this._createClient();
        try {
            // User can bind with full DN or userPrincipalName
            await userClient.bind(userDn, password);
            logger_util_1.logger.info('LDAP user credentials verified successfully', {
                user: cleanUser,
                email: profile.email,
                dn: userDn,
            });
            return { success: true, profile };
        }
        catch (err) {
            if (err instanceof ldapts_1.InvalidCredentialsError || (err instanceof Error && /invalid/i.test(err.message))) {
                logger_util_1.logger.warn('LDAP user bind failed: invalid credentials', { user: cleanUser });
                return { success: false, reason: 'invalid_credentials' };
            }
            logger_util_1.logger.error('LDAP user bind error', { user: cleanUser, err });
            return { success: false, reason: 'invalid_credentials' };
        }
        finally {
            await userClient.unbind().catch(() => { });
        }
    }
    async listUsers() {
        const client = this._createClient();
        try {
            await this._bindServiceAccount(client);
            const filter = '(&(objectCategory=person)(objectClass=user)(!(userAccountControl:1.2.840.113556.1.4.803:=2)))';
            const { searchEntries } = await client.search(app_config_1.config.ldap.baseDn, {
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
        }
        catch (err) {
            logger_util_1.logger.error('LDAP listUsers failed', { err });
            return [];
        }
        finally {
            await client.unbind().catch(() => { });
        }
    }
    _mapEntryToProfile(entry, fallbackUsername) {
        const sAMAccountName = String(entry.sAMAccountName || fallbackUsername);
        const userPrincipalName = entry.userPrincipalName ? String(entry.userPrincipalName) : undefined;
        const mail = entry.mail ? String(entry.mail) : undefined;
        // Email resolution: mail -> userPrincipalName -> construct default
        const email = (mail || userPrincipalName || `${sAMAccountName}@galaxybb.local`).toLowerCase();
        const uac = typeof entry.userAccountControl === 'number'
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
exports.LdapClient = LdapClient;
/**
 * Stub LDAP client for test or disabled environments.
 */
class StubLdapClient {
    async authenticate() {
        logger_util_1.logger.debug('StubLdapClient.authenticate() called (LDAP disabled)');
        return { success: false, reason: 'user_not_found' };
    }
    async searchUser() {
        return null;
    }
    async listUsers() {
        return [];
    }
    async testConnection() {
        return { success: false, message: 'LDAP is disabled in configuration' };
    }
}
exports.StubLdapClient = StubLdapClient;
const createLdapClient = () => app_config_1.config.ldap.enabled ? new LdapClient() : new StubLdapClient();
exports.createLdapClient = createLdapClient;
exports.ldapClient = (0, exports.createLdapClient)();
//# sourceMappingURL=ldap.client.js.map