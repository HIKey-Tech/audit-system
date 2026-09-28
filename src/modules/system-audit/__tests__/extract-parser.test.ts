import {
  missingRequiredFields,
  normaliseRecords,
  parseExtract,
  suggestMapping,
  toBoolean,
  toDate,
  toList,
  toNumber,
} from '../utility/extract-parser.utility';
import { accessListingAnalyzer } from '../utility/analyzers/access-listing.analyzer';
import { changeLogAnalyzer } from '../utility/analyzers/change-log.analyzer';

const csv = (text: string): Buffer => Buffer.from(text.trim(), 'utf8');

describe('extract-parser.utility', () => {
  it('reads CSV headers and rows as raw text', () => {
    const { headers, rows } = parseExtract(csv('Username,Roles,Last Logon\njdoe,Admin;Viewer,03/04/2026'), 'users.csv');
    expect(headers).toEqual(['Username', 'Roles', 'Last Logon']);
    expect(rows[0]['Last Logon']).toBe('03/04/2026');
  });

  it('rejects unsupported files and header-only files', () => {
    expect(() => parseExtract(csv('a,b'), 'notes.pdf')).toThrow(/Unsupported/);
    expect(() => parseExtract(csv('a,b'), 'empty.csv')).toThrow(/no data rows/);
  });

  it('parses slash dates day-first by default and detects unambiguous order', () => {
    expect(toDate('03/04/2026')?.getMonth()).toBe(3); // 3 April
    expect(toDate('03/04/2026', 'mdy')?.getMonth()).toBe(2); // 4 March
    expect(toDate('25/12/2025')?.getDate()).toBe(25);
    expect(toDate('12/25/2025')?.getDate()).toBe(25); // month-first is the only valid reading
    expect(toDate('2026-09-01 14:30')?.getHours()).toBe(14);
    expect(toDate('31/02/2026')).toBeNull();
    expect(toDate(45000)?.getFullYear()).toBe(2023); // Excel serial
    expect(toDate('07/01/2026 2:15 PM')?.getHours()).toBe(14);
  });

  it('coerces numbers, booleans, and lists', () => {
    expect(toNumber('₦1,250.50')).toBe(1250.5);
    expect(toNumber('(300)')).toBe(-300);
    expect(toNumber('n/a')).toBeNull();
    expect(toBoolean('Enabled')).toBe(true);
    expect(toBoolean('no')).toBe(false);
    expect(toList('Domain Admins; Finance | HR')).toEqual(['Domain Admins', 'Finance', 'HR']);
  });

  it('auto-maps common export headers to analysis fields', () => {
    const mapping = suggestMapping(
      ['sAMAccountName', 'DisplayName', 'MemberOf', 'Enabled', 'LastLogonTimestamp', 'Department'],
      accessListingAnalyzer.fields,
    );
    expect(mapping.account_id).toBe('sAMAccountName');
    expect(mapping.entitlements).toBe('MemberOf');
    expect(mapping.account_status).toBe('Enabled');
    expect(mapping.last_login).toBe('LastLogonTimestamp');
    expect(missingRequiredFields(accessListingAnalyzer.fields, mapping)).toHaveLength(0);
  });

  it('reports required fields it could not map', () => {
    const mapping = suggestMapping(['Number', 'Summary'], changeLogAnalyzer.fields);
    const missing = missingRequiredFields(changeLogAnalyzer.fields, mapping).map((f) => f.key);
    expect(missing).toEqual(expect.arrayContaining(['implementation_date', 'approved_by']));
  });

  it('counts present-but-unreadable values instead of hiding them', () => {
    const { rows } = parseExtract(csv('Username,Roles,Last Logon\njdoe,Admin,not a date'), 'users.csv');
    const mapping = suggestMapping(['Username', 'Roles', 'Last Logon'], accessListingAnalyzer.fields);
    const { records, unreadableValues } = normaliseRecords(rows, accessListingAnalyzer.fields, mapping);
    expect(records[0].values.last_login).toBeNull();
    expect(unreadableValues).toBe(1);
  });
});
