import { AnalysisRecord, AnalyzerContext, AnalyzerDefinition } from '../domain/entity/system-audit.entity';
import { normaliseRecords, parseExtract, rawRecords, suggestMapping } from '../utility/extract-parser.utility';
import { accessListingAnalyzer, IAMS_SOD_RULES } from '../utility/analyzers/access-listing.analyzer';
import { changeLogAnalyzer } from '../utility/analyzers/change-log.analyzer';
import { backupLogAnalyzer } from '../utility/analyzers/backup-log.analyzer';
import { incidentLogAnalyzer, normalisePriority } from '../utility/analyzers/incident-log.analyzer';
import { securityEventLogAnalyzer } from '../utility/analyzers/security-event-log.analyzer';
import { configurationAnalyzer } from '../utility/analyzers/configuration.analyzer';
import { vulnerabilityScanAnalyzer } from '../utility/analyzers/vulnerability-scan.analyzer';
import { dataIntegrityAnalyzer } from '../utility/analyzers/data-integrity.analyzer';

const NOW = new Date(2026, 8, 28, 12, 0, 0); // 28 Sep 2026

/** CSV text → mapped records, exactly as an upload is processed. */
const load = <P>(analyzer: AnalyzerDefinition<P>, text: string) => {
  const { headers, rows } = parseExtract(Buffer.from(text.trim(), 'utf8'), 'extract.csv');
  const mapping = suggestMapping(headers, analyzer.fields);
  const { records } = normaliseRecords(rows, analyzer.fields, mapping);
  const mappedFields = new Set(Object.entries(mapping).filter(([, h]) => h).map(([k]) => k));
  return { records, context: { now: NOW, mappedFields } as AnalyzerContext };
};

const run = <P>(analyzer: AnalyzerDefinition<P>, text: string, params: unknown = {}, extra: Partial<AnalyzerContext> = {}) => {
  const { records, context } = load(analyzer, text);
  return analyzer.analyse(records, analyzer.parametersSchema.parse(params), { ...context, ...extra });
};

const codes = (result: { exceptions: Array<{ ruleCode: string }> }): string[] => result.exceptions.map((e) => e.ruleCode);

describe('access listing analyzer', () => {
  const listing = `
Username,Full Name,Email,Roles,Status,Last Logon
jdoe,John Doe,jdoe@gbb.gov.ng,Payment Creator;Payment Approver,Active,20/09/2026
asmith,Ann Smith,asmith@gbb.gov.ng,Viewer,Active,01/01/2026
bleaver,Bola Leaver,bleaver@gbb.gov.ng,Finance Clerk,Enabled,25/09/2026
test01,Test Account,,Domain Admins,Active,25/09/2026
cdisabled,Cee Disabled,cdisabled@gbb.gov.ng,Payment Approver,Disabled,01/01/2025
`;
  const directory = [
    { email: 'jdoe@gbb.gov.ng', displayName: 'John Doe', isActive: true },
    { email: 'asmith@gbb.gov.ng', displayName: 'Ann Smith', isActive: true },
    { email: 'bleaver@gbb.gov.ng', displayName: 'Bola Leaver', isActive: false },
  ];

  it('flags SoD conflicts, dormant, generic, privileged, and leaver accounts', () => {
    const result = run(accessListingAnalyzer, listing, {}, { directory });
    expect(result.summary.totalAccounts).toBe(5);
    expect(result.summary.activeAccounts).toBe(4);
    const byAccount = (id: string) => result.exceptions.filter((e) => e.recordRef === id).map((e) => e.ruleCode);
    expect(byAccount('jdoe')).toContain('SOD_CONFLICT');
    expect(byAccount('asmith')).toContain('DORMANT_ACCOUNT');
    expect(byAccount('bleaver')).toContain('TERMINATED_USER_ACTIVE');
    expect(byAccount('test01')).toEqual(expect.arrayContaining(['GENERIC_ACCOUNT', 'PRIVILEGED_ACCESS']));
    // Disabled accounts hold no live access, so nothing is raised against them.
    expect(byAccount('cdisabled')).toHaveLength(0);
    expect(result.accessItems).toHaveLength(5);
    expect(result.accessItems!.find((i) => i.accountId === 'jdoe')!.flags).toContain('SOD_CONFLICT');
  });

  it('merges one-row-per-role exports into single accounts', () => {
    const result = run(
      accessListingAnalyzer,
      `User,Role\njdoe,Payment Creator\njdoe,Payment Approver\nasmith,Viewer`,
      { checkDirectory: false },
    );
    expect(result.summary.totalAccounts).toBe(2);
    expect(codes(result)).toContain('SOD_CONFLICT');
  });

  it('applies permission-level SoD rules (IAMS source)', () => {
    const result = run(
      accessListingAnalyzer,
      `Account,Roles,Permissions\nlead@gbb.gov.ng,audit_lead,plan:read;plan:create;plan:approve`,
      { sodRules: IAMS_SOD_RULES, checkDirectory: false },
    );
    expect(result.exceptions.find((e) => e.ruleCode === 'SOD_CONFLICT')?.details?.rule).toBe('Create and approve audit plans');
  });

  it('does not report never-logged-in when the export has no login column', () => {
    const result = run(accessListingAnalyzer, `Username,Roles\njdoe,Viewer`, { checkDirectory: false });
    expect(codes(result)).not.toContain('NEVER_LOGGED_IN');
  });
});

describe('change log analyzer', () => {
  const log = `
Change Number,Summary,Type,Requested By,Approved By,Approved On,Implemented By,Implemented On,Tested,Backout Plan,State
CHG001,Patch DB,Normal,ade,bola,01/09/2026,chidi,03/09/2026,Yes,Restore snapshot,Closed
CHG002,Firewall rule,Normal,ade,,,chidi,04/09/2026,Yes,Revert rule,Closed
CHG003,App release,Normal,ade,bola,10/09/2026,chidi,05/09/2026,Yes,Rollback,Closed
CHG004,Hotfix,Emergency,ade,bola,20/09/2026,chidi,06/09/2026,Yes,,Closed
CHG005,Config tweak,Normal,chidi,chidi,01/09/2026,chidi,02/09/2026,No,,Closed
CHG006,Planned,Normal,ade,Not Yet Requested,,,,,,Cancelled
`;

  it('flags unapproved, late, unratified emergency, self-approved, and untested changes', () => {
    const result = run(changeLogAnalyzer, log);
    const byChange = (id: string) => result.exceptions.filter((e) => e.recordRef === id).map((e) => e.ruleCode);
    expect(byChange('CHG001')).toHaveLength(0);
    expect(byChange('CHG002')).toContain('CHANGE_NOT_APPROVED');
    expect(byChange('CHG003')).toContain('APPROVED_AFTER_IMPLEMENTATION');
    expect(byChange('CHG004')).toContain('EMERGENCY_NOT_RATIFIED');
    expect(byChange('CHG004')).not.toContain('NO_ROLLBACK_PLAN'); // emergency changes are exempt
    expect(byChange('CHG005')).toEqual(expect.arrayContaining(['SELF_APPROVED', 'NO_TEST_EVIDENCE', 'NO_ROLLBACK_PLAN']));
    expect(byChange('CHG006')).toHaveLength(0); // cancelled
    expect(result.summary.implementedChanges).toBe(5);
  });
});

describe('backup log analyzer', () => {
  const log = `
Server,Job,Start Time,End Time,Result,Type
DB01,Nightly,20/09/2026 01:00,20/09/2026 02:00,Success,Backup
DB01,Nightly,21/09/2026 01:00,21/09/2026 02:00,Success,Backup
DB01,Nightly,24/09/2026 01:00,24/09/2026 02:00,Success,Backup
DB01,Nightly,25/09/2026 01:00,25/09/2026 02:00,Failed,Backup
APP01,Nightly,24/09/2026 01:00,24/09/2026 02:00,Failed,Backup
APP01,Nightly,25/09/2026 01:00,25/09/2026 02:00,Error,Backup
FS01,Nightly,25/09/2026 01:00,25/09/2026 01:30,Success,Backup
FS01,Restore drill,15/09/2026 09:00,15/09/2026 13:00,Success,Restore test
`;

  it('finds failures, gaps, systems with no good backup, and restore-test issues', () => {
    const result = run(backupLogAnalyzer, log, { rtoMinutes: 120 });
    const bySystem = (s: string) => result.exceptions.filter((e) => e.recordRef === s).map((e) => e.ruleCode);
    expect(bySystem('DB01')).toEqual(expect.arrayContaining(['BACKUP_FAILED', 'BACKUP_GAP', 'RESTORE_TEST_OVERDUE']));
    expect(bySystem('APP01')).toEqual(expect.arrayContaining(['NO_SUCCESSFUL_BACKUP', 'BACKUP_FAILED']));
    expect(bySystem('FS01')).toContain('RTO_EXCEEDED'); // 4h restore against a 2h objective
    expect(bySystem('FS01')).not.toContain('RESTORE_TEST_OVERDUE');
    expect(result.summary.systems).toBe(3);
  });
});

describe('incident log analyzer', () => {
  it('normalises common priority labels', () => {
    expect(normalisePriority('1 - Critical')).toBe('critical');
    expect(normalisePriority('P2')).toBe('high');
    expect(normalisePriority('4 - Low')).toBe('low');
    expect(normalisePriority(null)).toBe('medium');
  });

  it('measures response and resolution against SLA and ages open incidents', () => {
    const log = `
Incident Number,Priority,Opened,Acknowledged,Resolved,State,Resolution Notes
INC1,1 - Critical,01/09/2026 08:00,01/09/2026 08:10,01/09/2026 10:00,Resolved,Rebooted
INC2,1 - Critical,02/09/2026 08:00,02/09/2026 09:00,02/09/2026 20:00,Resolved,Patched
INC3,3 - Medium,01/08/2026 08:00,01/08/2026 09:00,,In Progress,
INC4,4 - Low,03/09/2026 08:00,03/09/2026 08:30,03/09/2026 12:00,Closed,
`;
    const result = run(incidentLogAnalyzer, log);
    const byIncident = (id: string) => result.exceptions.filter((e) => e.recordRef === id).map((e) => e.ruleCode);
    expect(byIncident('INC1')).toHaveLength(0);
    expect(byIncident('INC2')).toEqual(expect.arrayContaining(['RESPONSE_SLA_BREACH', 'RESOLUTION_SLA_BREACH']));
    expect(byIncident('INC3')).toContain('UNRESOLVED_AGED');
    expect(byIncident('INC4')).toContain('CLOSED_WITHOUT_RESOLUTION');
    expect(result.summary.slaCompliance).toBeCloseTo(66.7, 1);
  });
});

describe('security event log analyzer', () => {
  it('detects brute force, spraying, off-hours privileged activity, and log clearing', () => {
    const lines = ['Time,User,Event,Result,Source IP'];
    for (let i = 0; i < 6; i += 1) lines.push(`28/09/2026 10:0${i},jdoe,Logon,Failure,10.0.0.5`);
    ['a', 'b', 'c', 'd', 'e'].forEach((u, i) => lines.push(`28/09/2026 11:0${i},${u},4625 An account failed to log on,,10.9.9.9`));
    lines.push('27/09/2026 02:15,admin1,Added member to Domain Admins group,Success,10.0.0.9');
    lines.push('28/09/2026 03:00,admin1,1102 The audit log was cleared,Success,10.0.0.9');
    const result = run(securityEventLogAnalyzer, lines.join('\n'));
    expect(codes(result)).toEqual(
      expect.arrayContaining(['BRUTE_FORCE', 'PASSWORD_SPRAY', 'OFF_HOURS_PRIVILEGED', 'AUDIT_LOG_CLEARED']),
    );
    expect(result.exceptions.filter((e) => e.ruleCode === 'BRUTE_FORCE')).toHaveLength(1);
  });
});

describe('configuration analyzer', () => {
  it('compares against the expected column and flags insecure values', () => {
    const result = run(
      configurationAnalyzer,
      `Host,Setting,Current Value,Expected Value\nWEB01,MinPasswordLength,8,12\nWEB01,Protocols,TLSv1.0;TLSv1.2,TLSv1.2\nWEB01,Uptime,40 days,`,
    );
    expect(result.summary.comparison).toBe('expected_column');
    expect(result.exceptions.find((e) => e.ruleCode === 'CONFIG_DRIFT' && e.recordRef === 'WEB01/MinPasswordLength')?.severity).toBe('high');
    expect(codes(result)).toContain('INSECURE_VALUE');
    expect(result.summary.ignoredSettings).toBe(1);
  });

  it('compares against an approved baseline snapshot', () => {
    const baseline = { FW01: { telnet: 'disabled', snmp_community: 'gbbRO', ntp: 'pool.gbb' } };
    const result = run(
      configurationAnalyzer,
      `Device,Setting,Value\nFW01,telnet,enabled\nFW01,ntp,pool.gbb\nFW01,new_rule,allow 443`,
      {},
      { baseline },
    );
    expect(result.summary.comparison).toBe('baseline');
    expect(codes(result)).toEqual(expect.arrayContaining(['CONFIG_DRIFT', 'SETTING_MISSING', 'SETTING_ADDED']));
    expect(result.snapshot?.FW01.telnet).toBe('enabled');
  });
});

describe('vulnerability scan analyzer', () => {
  it('groups findings, ignores fixed items, and flags overdue remediation', () => {
    const scan = `
Host,Plugin Name,Risk,CVSS,First Seen,Status
10.0.0.1,OpenSSL Heartbleed,Critical,9.8,01/07/2026,Open
10.0.0.2,OpenSSL Heartbleed,Critical,9.8,15/09/2026,Open
10.0.0.1,Weak SSH Ciphers,Low,2.6,01/01/2026,Open
10.0.0.3,Old Apache,High,7.5,20/09/2026,Fixed
10.0.0.4,SMB Signing Disabled,4,,01/09/2026,Open
`;
    const result = run(vulnerabilityScanAnalyzer, scan);
    const heartbleed = result.exceptions.find((e) => e.ruleCode === 'VULNERABILITY' && e.recordRef === 'OpenSSL Heartbleed');
    expect(heartbleed?.details?.affectedCount).toBe(2);
    expect(codes(result)).toContain('REMEDIATION_OVERDUE');
    // Low findings are counted but not raised at the default minimum (medium).
    expect(result.exceptions.some((e) => e.recordRef === 'Weak SSH Ciphers')).toBe(false);
    expect(result.summary.fixedOrAccepted).toBe(1);
    // Numeric "4" on a 0–4 (Nessus) scale is critical.
    expect(result.exceptions.find((e) => e.recordRef === 'SMB Signing Disabled')?.severity).toBe('critical');
  });
});

describe('data integrity analyzer', () => {
  const extract = (text: string): AnalysisRecord[] =>
    rawRecords(parseExtract(Buffer.from(text.trim(), 'utf8'), 'data.csv').rows);
  const ctx: AnalyzerContext = { now: NOW, mappedFields: new Set() };

  it('finds duplicates, gaps, missing values, control-total and period breaks', () => {
    const records = extract(`
Voucher,Vendor,Amount,Date
PV-0001,Acme,1000,01/09/2026
PV-0002,Beta,2000,02/09/2026
PV-0002,Beta,2000,02/09/2026
PV-0005,,500,15/10/2026
`);
    const params = dataIntegrityAnalyzer.parametersSchema.parse({
      keyColumns: ['Voucher'],
      requiredColumns: ['Vendor'],
      sequenceColumn: 'Voucher',
      amountColumn: 'Amount',
      expectedTotal: 5000,
      expectedCount: 4,
      dateColumn: 'Date',
      periodStart: '01/09/2026',
      periodEnd: '30/09/2026',
    });
    const result = dataIntegrityAnalyzer.analyse(records, params, ctx);
    expect(codes(result)).toEqual(
      expect.arrayContaining(['DUPLICATE_KEY', 'MISSING_VALUE', 'SEQUENCE_GAP', 'CONTROL_TOTAL_MISMATCH', 'OUT_OF_PERIOD']),
    );
    expect(codes(result)).not.toContain('RECORD_COUNT_MISMATCH');
    expect(result.summary.missingSequenceNumbers).toBe(2);
    expect(result.summary.totalDifference).toBe(500);
  });

  it('rejects unknown columns and empty configurations', () => {
    const records = extract('A,B\n1,2');
    expect(() => dataIntegrityAnalyzer.analyse(records, dataIntegrityAnalyzer.parametersSchema.parse({ keyColumns: ['C'] }), ctx)).toThrow(/not found/);
    expect(() => dataIntegrityAnalyzer.analyse(records, dataIntegrityAnalyzer.parametersSchema.parse({}), ctx)).toThrow(/at least one/);
  });
});
