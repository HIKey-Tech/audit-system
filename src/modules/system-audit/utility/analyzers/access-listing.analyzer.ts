import { z } from 'zod';
import { AnalysisType, ExceptionSeverity } from '../../domain/enum/system-audit.enum';
import {
  AccessItemDraft,
  AnalysisRecord,
  AnalyzerContext,
  AnalyzerDefinition,
  DirectoryEntry,
  ExceptionDraft,
} from '../../domain/entity/system-audit.entity';
import { daysBetween, matchesAny, round } from '../system-audit.utility';

const SodRuleSchema = z.object({
  name: z.string().trim().min(1).max(200),
  sideA: z.array(z.string().trim().min(1)).min(1).max(50),
  sideB: z.array(z.string().trim().min(1)).min(1).max(50),
  severity: z.nativeEnum(ExceptionSeverity).default(ExceptionSeverity.High),
});
export type SodRule = z.infer<typeof SodRuleSchema>;

/** Generic duty conflicts that apply to most business systems; GBB tailors per system. */
export const DEFAULT_SOD_RULES: SodRule[] = [
  {
    name: 'Initiate and approve the same transaction',
    sideA: ['*creat*', '*initiat*', '*maker*', '*prepar*', '*input*', '*capture*'],
    sideB: ['*approv*', '*authoris*', '*authoriz*', '*checker*'],
    severity: ExceptionSeverity.High,
  },
  {
    name: 'Develop code and deploy it to production',
    sideA: ['*develop*', '*programmer*'],
    sideB: ['*deploy*', '*production*', '*release manager*'],
    severity: ExceptionSeverity.High,
  },
  {
    name: 'Administer security and review the audit logs',
    sideA: ['*security admin*', '*user admin*', '*access admin*', '*identity admin*'],
    sideB: ['*audit*log*', '*log review*', '*siem*'],
    severity: ExceptionSeverity.High,
  },
  {
    name: 'Maintain vendor master data and process payments',
    sideA: ['*vendor*maint*', '*vendor master*', '*supplier master*'],
    sideB: ['*payment*', '*pay run*', '*disburse*'],
    severity: ExceptionSeverity.High,
  },
];

/** Permission-level conflicts inside IAMS itself (used by the IAMS access-review source). */
export const IAMS_SOD_RULES: SodRule[] = [
  { name: 'Create and approve audit plans', sideA: ['plan:create'], sideB: ['plan:approve'], severity: ExceptionSeverity.High },
  {
    name: 'Generate and approve audit reports',
    sideA: ['report:create'],
    sideB: ['report:approve', 'report:approve:oversight', 'report:approve:final', 'report:issue'],
    severity: ExceptionSeverity.Medium,
  },
  { name: 'Prepare and approve working papers', sideA: ['working_paper:create'], sideB: ['working_paper:approve'], severity: ExceptionSeverity.Medium },
  { name: 'Raise and close findings', sideA: ['finding:create'], sideB: ['finding:close'], severity: ExceptionSeverity.Medium },
  { name: 'Create users and grant roles', sideA: ['user:create'], sideB: ['role:assign', 'user:admin'], severity: ExceptionSeverity.High },
];

const ParametersSchema = z.object({
  dormantDays: z.number().int().min(1).max(3650).default(90),
  sodRules: z.array(SodRuleSchema).max(100).default(DEFAULT_SOD_RULES),
  privilegedPatterns: z
    .array(z.string().trim().min(1))
    .max(100)
    .default(['*admin*', 'root', '*superuser*', '*dba*', 'sysadmin', 'domain admins', 'enterprise admins', 'schema admins', '*privileged*']),
  genericAccountPatterns: z
    .array(z.string().trim().min(1))
    .max(100)
    .default(['admin', 'administrator', 'test*', 'temp*', 'guest', 'shared*', 'generic*', 'training*', 'demo*', 'user', 'user1']),
  /** Cross-check accounts against the IAMS staff directory to find leavers and orphans. */
  checkDirectory: z.boolean().default(true),
});
export type AccessListingParameters = z.infer<typeof ParametersSchema>;

const ACTIVE_STATUS = /^(active|enabled|true|yes|1|normal|normal account|valid)$/i;
const INACTIVE_STATUS = /^(disabled|inactive|locked|suspended|terminated|expired|false|no|0|deleted|revoked)$/i;

interface Account {
  accountId: string;
  displayName: string | null;
  email: string | null;
  department: string | null;
  status: string | null;
  privilegedFlag: boolean;
  lastLoginAt: Date | null;
  createdAt: Date | null;
  mfaEnabled: boolean | null;
  entitlements: Set<string>;
  permissions: Set<string>;
  rows: number[];
}

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const list = (v: unknown): string[] => (Array.isArray(v) ? (v as string[]) : []);

const normaliseStatus = (raw: string | null): string | null => {
  if (!raw) return null;
  if (ACTIVE_STATUS.test(raw)) return 'active';
  if (INACTIVE_STATUS.test(raw)) return 'disabled';
  return raw.toLowerCase();
};

/** Merges rows per account — exports often list one row per account-role pair. */
const groupAccounts = (records: AnalysisRecord[]): Account[] => {
  const accounts = new Map<string, Account>();
  for (const r of records) {
    const accountId = text(r.values.account_id);
    if (!accountId) continue;
    const key = accountId.toLowerCase();
    const acc = accounts.get(key) ?? {
      accountId,
      displayName: null,
      email: null,
      department: null,
      status: null,
      privilegedFlag: false,
      lastLoginAt: null,
      createdAt: null,
      mfaEnabled: null,
      entitlements: new Set<string>(),
      permissions: new Set<string>(),
      rows: [],
    };
    acc.displayName ??= text(r.values.display_name);
    acc.email ??= text(r.values.email)?.toLowerCase() ?? null;
    acc.department ??= text(r.values.department);
    const status = normaliseStatus(text(r.values.account_status));
    if (status === 'active' || acc.status === null) acc.status = status ?? acc.status;
    if (r.values.privileged === true) acc.privilegedFlag = true;
    if (typeof r.values.mfa_enabled === 'boolean') acc.mfaEnabled = acc.mfaEnabled === true || r.values.mfa_enabled;
    const login = r.values.last_login instanceof Date ? r.values.last_login : null;
    if (login && (!acc.lastLoginAt || login > acc.lastLoginAt)) acc.lastLoginAt = login;
    const created = r.values.created_at instanceof Date ? r.values.created_at : null;
    if (created && (!acc.createdAt || created < acc.createdAt)) acc.createdAt = created;
    list(r.values.entitlements).forEach((e) => acc.entitlements.add(e));
    list(r.values.permissions).forEach((p) => acc.permissions.add(p));
    acc.rows.push(r.rowNumber);
    accounts.set(key, acc);
  }
  return Array.from(accounts.values());
};

const directoryLookup = (directory: DirectoryEntry[]) => {
  const byEmail = new Map<string, DirectoryEntry>();
  const byLocal = new Map<string, DirectoryEntry>();
  for (const entry of directory) {
    const email = entry.email.toLowerCase();
    byEmail.set(email, entry);
    byLocal.set(email.split('@')[0], entry);
  }
  return (acc: Account): DirectoryEntry | undefined => {
    const id = acc.accountId.toLowerCase();
    return (
      (acc.email ? byEmail.get(acc.email) : undefined) ??
      byEmail.get(id) ??
      byLocal.get(id.split('@')[0].split('\\').pop() ?? id)
    );
  };
};

const analyse = (
  records: AnalysisRecord[],
  params: AccessListingParameters,
  context: AnalyzerContext,
): { summary: Record<string, number | boolean>; exceptions: ExceptionDraft[]; accessItems: AccessItemDraft[] } => {
  const accounts = groupAccounts(records);
  const exceptions: ExceptionDraft[] = [];
  const accessItems: AccessItemDraft[] = [];
  const directoryChecked = params.checkDirectory && (context.directory?.length ?? 0) > 0;
  const lookup = directoryChecked ? directoryLookup(context.directory!) : undefined;
  const loginKnown = context.mappedFields.has('last_login');

  const counts = { sod: 0, dormant: 0, neverLoggedIn: 0, generic: 0, orphan: 0, terminated: 0, privileged: 0, active: 0, noMfa: 0 };

  for (const acc of accounts) {
    const flags: string[] = [];
    const ref = acc.accountId;
    const name = acc.displayName ?? acc.accountId;
    const entitlements = Array.from(acc.entitlements);
    const allAccess = [...entitlements, ...acc.permissions];
    // No status column means the export lists live accounts only.
    const isActive = acc.status === null || acc.status === 'active';
    const isPrivileged = acc.privilegedFlag || entitlements.some((e) => matchesAny(e, params.privilegedPatterns));
    const raise = (draft: ExceptionDraft): void => {
      exceptions.push(draft);
      if (!flags.includes(draft.ruleCode)) flags.push(draft.ruleCode);
    };

    if (isActive) {
      counts.active += 1;
      if (isPrivileged) {
        counts.privileged += 1;
        raise({
          ruleCode: 'PRIVILEGED_ACCESS',
          severity: ExceptionSeverity.Low,
          title: `${name} holds privileged access — confirm it is justified and approved`,
          recordRef: ref,
          details: { entitlements, rows: acc.rows },
        });
      }

      for (const rule of params.sodRules) {
        const sideA = allAccess.filter((e) => matchesAny(e, rule.sideA));
        const sideB = allAccess.filter((e) => matchesAny(e, rule.sideB));
        // One entitlement satisfying both sides is a naming artefact, not a conflict.
        const conflict = sideA.some((a) => sideB.some((b) => b !== a));
        if (conflict) {
          counts.sod += 1;
          raise({
            ruleCode: 'SOD_CONFLICT',
            severity: rule.severity,
            title: `${name} can both ${rule.name.charAt(0).toLowerCase()}${rule.name.slice(1)} (segregation of duties)`,
            recordRef: ref,
            details: { rule: rule.name, conflictingA: sideA, conflictingB: sideB },
          });
        }
      }

      if (acc.lastLoginAt) {
        const idleDays = Math.floor(daysBetween(acc.lastLoginAt, context.now));
        if (idleDays > params.dormantDays) {
          counts.dormant += 1;
          raise({
            ruleCode: 'DORMANT_ACCOUNT',
            severity: isPrivileged ? ExceptionSeverity.High : ExceptionSeverity.Medium,
            title: `${name} has not signed in for ${idleDays} days but is still active`,
            recordRef: ref,
            details: { lastLoginAt: acc.lastLoginAt.toISOString(), idleDays, thresholdDays: params.dormantDays, privileged: isPrivileged },
          });
        }
      } else if (loginKnown) {
        const ageDays = acc.createdAt ? Math.floor(daysBetween(acc.createdAt, context.now)) : null;
        if (ageDays === null || ageDays > params.dormantDays) {
          counts.neverLoggedIn += 1;
          raise({
            ruleCode: 'NEVER_LOGGED_IN',
            severity: ExceptionSeverity.Low,
            title: `${name} is active but has never signed in`,
            recordRef: ref,
            details: { createdAt: acc.createdAt?.toISOString() ?? null },
          });
        }
      }

      if (acc.mfaEnabled === false) {
        counts.noMfa += 1;
        raise({
          ruleCode: 'MFA_NOT_ENABLED',
          severity: isPrivileged ? ExceptionSeverity.High : ExceptionSeverity.Medium,
          title: `${name} signs in without multi-factor authentication`,
          recordRef: ref,
          details: { privileged: isPrivileged },
        });
      }

      const isGeneric = matchesAny(acc.accountId.split('@')[0].split('\\').pop() ?? acc.accountId, params.genericAccountPatterns);
      if (isGeneric) {
        counts.generic += 1;
        raise({
          ruleCode: 'GENERIC_ACCOUNT',
          severity: ExceptionSeverity.Medium,
          title: `${acc.accountId} looks like a generic or shared account — accountability cannot be traced to a person`,
          recordRef: ref,
          details: { entitlements },
        });
      }

      if (lookup) {
        const person = lookup(acc);
        if (person && !person.isActive) {
          counts.terminated += 1;
          raise({
            ruleCode: 'TERMINATED_USER_ACTIVE',
            severity: ExceptionSeverity.Critical,
            title: `${name} is inactive in the staff directory but still holds active access`,
            recordRef: ref,
            details: { directoryEmail: person.email, entitlements },
          });
        } else if (!person && !isGeneric) {
          counts.orphan += 1;
          raise({
            ruleCode: 'ORPHAN_ACCOUNT',
            severity: ExceptionSeverity.Medium,
            title: `${acc.accountId} does not match anyone in the staff directory`,
            recordRef: ref,
            details: { email: acc.email },
          });
        }
      }
    }

    accessItems.push({
      accountId: acc.accountId,
      displayName: acc.displayName,
      email: acc.email,
      department: acc.department,
      accountStatus: acc.status ?? 'active',
      isPrivileged,
      lastLoginAt: acc.lastLoginAt,
      entitlements: [...entitlements, ...Array.from(acc.permissions).filter((p) => !acc.entitlements.has(p))],
      flags,
    });
  }

  return {
    summary: {
      totalAccounts: accounts.length,
      activeAccounts: counts.active,
      disabledAccounts: accounts.length - counts.active,
      privilegedAccounts: counts.privileged,
      privilegedShare: accounts.length ? round((counts.privileged / accounts.length) * 100) : 0,
      sodConflicts: counts.sod,
      dormantAccounts: counts.dormant,
      neverLoggedIn: counts.neverLoggedIn,
      genericAccounts: counts.generic,
      orphanAccounts: counts.orphan,
      terminatedWithAccess: counts.terminated,
      withoutMfa: counts.noMfa,
      directoryChecked,
    },
    exceptions,
    accessItems,
  };
};

export const accessListingAnalyzer: AnalyzerDefinition<AccessListingParameters> = {
  type: AnalysisType.AccessListing,
  label: 'User access review',
  description:
    'Reviews who has access to a system: segregation-of-duties conflicts, leavers who still hold access, dormant, generic, and privileged accounts. Read-only — decisions are recorded in IAMS, never pushed to the system.',
  controls: ['ISO27001-A.5.18', 'ISO27001-A.5.3', 'ISO27001-A.8.2', 'SOX-ITGC-AC', 'NIST-CSF-PR.AC'],
  fields: [
    { key: 'account_id', label: 'Account / username', kind: 'text', required: true, synonyms: ['username', 'user name', 'userid', 'user id', 'login', 'login id', 'logon name', 'account', 'account name', 'samaccountname', 'userprincipalname', 'upn', 'user'] },
    { key: 'entitlements', label: 'Roles / groups', kind: 'list', required: true, synonyms: ['role', 'roles', 'role name', 'entitlement', 'entitlements', 'group', 'groups', 'member of', 'memberof', 'profile', 'responsibility', 'responsibilities', 'access level'] },
    { key: 'display_name', label: 'Full name', kind: 'text', required: false, synonyms: ['name', 'full name', 'displayname', 'employee name', 'staff name'] },
    { key: 'email', label: 'Email', kind: 'text', required: false, synonyms: ['e-mail', 'mail', 'email address', 'emailaddress'] },
    { key: 'department', label: 'Department', kind: 'text', required: false, synonyms: ['dept', 'unit', 'division', 'business unit'] },
    { key: 'account_status', label: 'Account status', kind: 'text', required: false, synonyms: ['status', 'enabled', 'active', 'state', 'account enabled', 'user status'] },
    { key: 'permissions', label: 'Permissions / privileges', kind: 'list', required: false, synonyms: ['permission', 'rights', 'privilege', 'privileges'] },
    { key: 'last_login', label: 'Last login', kind: 'date', required: false, synonyms: ['last logon', 'lastlogon', 'lastlogontimestamp', 'last login date', 'last sign in', 'last signin', 'last access', 'last activity', 'last used'] },
    { key: 'privileged', label: 'Privileged flag', kind: 'boolean', required: false, synonyms: ['is admin', 'administrator', 'is privileged', 'superuser', 'admin flag'] },
    { key: 'created_at', label: 'Account created', kind: 'date', required: false, synonyms: ['created', 'created date', 'date created', 'creation date', 'whencreated', 'account created'] },
    { key: 'mfa_enabled', label: 'MFA enabled', kind: 'boolean', required: false, synonyms: ['mfa', '2fa', 'two factor', 'mfa status', 'mfa registered', 'mfa enabled'] },
  ],
  parametersSchema: ParametersSchema,
  rules: [
    { code: 'SOD_CONFLICT', label: 'Segregation-of-duties conflict', severity: 'varies' },
    { code: 'TERMINATED_USER_ACTIVE', label: 'Leaver still holds active access', severity: ExceptionSeverity.Critical },
    { code: 'DORMANT_ACCOUNT', label: 'Dormant but active account', severity: 'varies' },
    { code: 'NEVER_LOGGED_IN', label: 'Active account never used', severity: ExceptionSeverity.Low },
    { code: 'GENERIC_ACCOUNT', label: 'Generic or shared account', severity: ExceptionSeverity.Medium },
    { code: 'ORPHAN_ACCOUNT', label: 'Account not linked to a person', severity: ExceptionSeverity.Medium },
    { code: 'MFA_NOT_ENABLED', label: 'Signs in without MFA', severity: 'varies' },
    { code: 'PRIVILEGED_ACCESS', label: 'Privileged access needing justification', severity: ExceptionSeverity.Low },
  ],
  analyse,
};
