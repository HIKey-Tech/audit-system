import { AppError } from '../../../../shared/errors/app.error';
import {
  createDynafinClient,
  DisabledDynafinClient,
  DynafinFetch,
  FixtureDynafinClient,
  HttpDynafinClient,
} from '../service/client/dynafin.client';
import {
  normalizeDynafinStaffAdvance,
  normalizeDynafinTransaction,
  parseMoney,
  unwrapList,
} from '../utility/dynafin.utility';

type Settings = ConstructorParameters<typeof HttpDynafinClient>[1];
const settings = (over: Record<string, unknown> = {}): Settings => ({
  enabled: true,
  driver: 'http',
  baseUrl: 'https://dynafin.example.test',
  authMode: 'none',
  authHeader: 'X-Api-Key',
  authSecret: '',
  timeoutMs: 1000,
  caCertPath: '',
  ...over,
}) as Settings;

const reply = (status: number, body: unknown): DynafinFetch => jest.fn(async () => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
}));

const PERIOD = { from: '2026-11-01T00:00:00.000Z', to: '2026-11-07T23:59:59.999Z' };

describe('parseMoney', () => {
  it.each([
    [5_000_000, 5_000_000],
    ['5000000', 5_000_000],
    ['5,000,000.00', 5_000_000],
    ['₦5,000,000', 5_000_000],
    ['NGN 5,000,000.50', 5_000_000.5],
    ['(1,200.00)', 1_200], // accounting negative → absolute value
    [-250, 250],
  ])('reads %p as %p', (input, expected) => expect(parseMoney(input)).toBe(expected));

  it.each(['', 'abc', null, undefined, NaN, {}])('refuses %p instead of guessing', (input) => {
    expect(parseMoney(input)).toBeNull();
  });

  // A wrong guess would misread a figure by 100x and move it across the ₦5m/₦10m threshold.
  it.each(['1 234,50', '1.234,50', '1,23', '12,34,567', '1,2345', '5 000 000', '5,000,000,', '₦', '--5'])(
    'refuses the ambiguous or malformed amount %p',
    (input) => expect(parseMoney(input)).toBeNull(),
  );
});

describe('normalizeDynafinTransaction', () => {
  it('maps Dynafin-style field names onto the canonical record, whatever their case or separators', () => {
    const t = normalizeDynafinTransaction({
      Voucher_No: 'V-100', PostingDate: '2026-11-03', Amount: '₦6,500,000.00', GL_Code: '5101', AccountName: 'Travel',
      Vendor: 'Acme Travel', CostCentre: 'Finance', PostedBy: 'jdoe', ApprovedBy: 'asmith', PO_Number: 'PO-7', Reversal: 'No',
    });
    expect(t).toMatchObject({
      reference: 'V-100', amount: 6_500_000, currency: 'NGN', accountCode: '5101', payee: 'Acme Travel',
      department: 'Finance', postedBy: 'jdoe', approvedBy: 'asmith', supportingRef: 'PO-7', isReversal: false,
    });
    expect(t!.postingDate).toBe('2026-11-03T00:00:00.000Z');
  });

  it('recognises a reversal flag in several spellings', () => {
    const base = { reference: 'R', date: '2026-11-03', amount: 1 };
    expect(normalizeDynafinTransaction({ ...base, isReversal: true })!.isReversal).toBe(true);
    expect(normalizeDynafinTransaction({ ...base, reversed: 'Yes' })!.isReversal).toBe(true);
    expect(normalizeDynafinTransaction({ ...base })!.isReversal).toBe(false);
  });

  it('drops a record that lacks a reference, a readable date or a readable amount — never guesses', () => {
    expect(normalizeDynafinTransaction({ date: '2026-11-03', amount: 5 })).toBeNull();
    expect(normalizeDynafinTransaction({ reference: 'X', amount: 5 })).toBeNull();
    expect(normalizeDynafinTransaction({ reference: 'X', date: '2026-11-03', amount: 'n/a' })).toBeNull();
    expect(normalizeDynafinTransaction('garbage')).toBeNull();
    expect(normalizeDynafinTransaction(null)).toBeNull();
  });

  it('drops fields it does not know about (allow-list)', () => {
    const t = normalizeDynafinTransaction({ reference: 'X', date: '2026-11-03', amount: 5, secretToken: 'abc', password: 'p' });
    expect(JSON.stringify(t)).not.toContain('abc');
    expect(JSON.stringify(t)).not.toContain('"p"');
  });
});

describe('normalizeDynafinStaffAdvance', () => {
  it('maps an advance and defaults unretired amounts to zero', () => {
    const a = normalizeDynafinStaffAdvance({ AdvanceNo: 'ADV-1', StaffName: 'A. Person', StaffId: 'E1', IssueDate: '2026-11-01', Amount: '150,000' });
    expect(a).toMatchObject({ advanceId: 'ADV-1', employee: 'A. Person', employeeId: 'E1', amount: 150_000, retiredAmount: 0, refundedAmount: 0, retiredAt: null });
  });
  it('drops an advance that cannot be identified, dated or valued', () => {
    expect(normalizeDynafinStaffAdvance({ employee: 'X', issueDate: '2026-11-01', amount: 5 })).toBeNull();
    expect(normalizeDynafinStaffAdvance({ advanceId: '1', employee: 'X', amount: 5 })).toBeNull();
  });
});

describe('unwrapList', () => {
  it('accepts a bare array or a common envelope, and tolerates anything else', () => {
    expect(unwrapList([1, 2])).toEqual([1, 2]);
    expect(unwrapList({ items: [1] })).toEqual([1]);
    expect(unwrapList({ data: [2] })).toEqual([2]);
    expect(unwrapList({ results: [3] })).toEqual([3]);
    expect(unwrapList({ nothing: true })).toEqual([]);
    expect(unwrapList(null)).toEqual([]);
  });
});

describe('HttpDynafinClient', () => {
  const rows = [
    { reference: 'A', date: '2026-11-02', amount: 9_000_000 },
    { reference: 'B', amount: 1 }, // no date — must be dropped
  ];

  it('issues GET requests only, to the configured base URL, with the period as query parameters', async () => {
    const fetchImpl = reply(200, rows);
    const out = await new HttpDynafinClient(fetchImpl, settings()).listTransactions(PERIOD);
    const [url, init] = (fetchImpl as jest.Mock).mock.calls[0];
    expect(init.method).toBe('GET');
    expect(init.body).toBeUndefined();
    expect(url).toContain('https://dynafin.example.test/');
    expect(url).toContain('from=2026-11-01T00%3A00%3A00.000Z');
    expect(url).toContain('to=2026-11-07T23%3A59%3A59.999Z');
    expect(out.map((t) => t.reference)).toEqual(['A']);
  });

  it('exposes no way to write: the only public operations are list* and checkStatus', () => {
    const publicMethods = Object.getOwnPropertyNames(HttpDynafinClient.prototype).filter((n) => n !== 'constructor' && !n.startsWith('_'));
    expect(publicMethods.sort()).toEqual(['checkStatus', 'listStaffAdvances', 'listTransactions']);
  });

  it('sends the API key or bearer token in the configured form, and nothing when auth is none', async () => {
    const send = async (over: Record<string, unknown>): Promise<Record<string, string>> => {
      const fetchImpl = reply(200, []);
      await new HttpDynafinClient(fetchImpl, settings(over)).listTransactions(PERIOD);
      return (fetchImpl as jest.Mock).mock.calls[0][1].headers;
    };
    expect(await send({ authMode: 'api-key', authSecret: 'k1', authHeader: 'X-Api-Key' })).toMatchObject({ 'X-Api-Key': 'k1' });
    expect(await send({ authMode: 'bearer', authSecret: 'tok' })).toMatchObject({ Authorization: 'Bearer tok' });
    const none = await send({ authMode: 'none' });
    expect(none).not.toHaveProperty('Authorization');
    expect(none).not.toHaveProperty('X-Api-Key');
  });

  it('unwraps an enveloped response and normalises staff advances', async () => {
    const fetchImpl = reply(200, { items: [{ advanceId: 'A1', employee: 'E', issueDate: '2026-11-01', amount: 10 }] });
    const out = await new HttpDynafinClient(fetchImpl, settings()).listStaffAdvances(PERIOD);
    expect(out).toHaveLength(1);
    expect(out[0].advanceId).toBe('A1');
  });

  it('turns failures into safe, actionable errors', async () => {
    const call = (fetchImpl: DynafinFetch) => new HttpDynafinClient(fetchImpl, settings()).listTransactions(PERIOD);
    await expect(call(reply(401, {}))).rejects.toMatchObject({ message: expect.stringContaining('credentials') });
    await expect(call(reply(404, {}))).rejects.toBeInstanceOf(AppError);
    await expect(call(reply(500, {}))).rejects.toMatchObject({ message: expect.stringContaining('HTTP 500') });
    await expect(call(reply(200, 'not json'))).rejects.toMatchObject({ message: expect.stringContaining('non-JSON') });
    await expect(call(jest.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'ECONNREFUSED' })))).rejects.toMatchObject({ message: expect.stringContaining('unreachable') });
    await expect(call(jest.fn().mockRejectedValue(Object.assign(new Error('x'), { name: 'AbortError' })))).rejects.toMatchObject({ message: expect.stringContaining('timeout') });
  });

  it('never leaks the response body or credentials in an error', async () => {
    const fetchImpl = reply(500, { secret: 'TOP-SECRET-BODY' });
    let message = '';
    try {
      await new HttpDynafinClient(fetchImpl, settings({ authMode: 'bearer', authSecret: 'my-token' })).listTransactions(PERIOD);
    } catch (e) {
      message = (e as Error).message;
    }
    expect(message).not.toBe(''); // it did fail
    expect(message).not.toContain('TOP-SECRET-BODY');
    expect(message).not.toContain('my-token');
  });

  it('refuses to call out when enabled but not configured', async () => {
    const fetchImpl = reply(200, []);
    const client = new HttpDynafinClient(fetchImpl, settings({ baseUrl: '' }));
    expect(client.configured).toBe(false);
    await expect(client.listTransactions(PERIOD)).rejects.toMatchObject({ message: expect.stringContaining('not configured') });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect((await client.checkStatus()).lastError).toContain('not configured');
  });

  it('reports status: reachable and authenticated, or reachable but credentials rejected', async () => {
    expect(await new HttpDynafinClient(reply(200, {}), settings()).checkStatus()).toMatchObject({ reachable: true, authenticated: true, lastError: null });
    expect(await new HttpDynafinClient(reply(401, {}), settings()).checkStatus()).toMatchObject({ reachable: true, authenticated: false });
    expect(await new HttpDynafinClient(jest.fn().mockRejectedValue(Object.assign(new Error('x'), { code: 'ETIMEDOUT' })), settings()).checkStatus()).toMatchObject({ reachable: false, authenticated: false });
  });
});

describe('DisabledDynafinClient (the default)', () => {
  it('is off, reads nothing and says so', async () => {
    const c = new DisabledDynafinClient();
    expect(c.enabled).toBe(false);
    expect(c.info).toMatchObject({ enabled: false, driver: 'disabled', sampleData: false });
    await expect(c.listTransactions()).rejects.toMatchObject({ message: expect.stringContaining('not enabled') });
    await expect(c.listStaffAdvances()).rejects.toMatchObject({ message: expect.stringContaining('not enabled') });
    expect(await c.checkStatus()).toMatchObject({ reachable: false, authenticated: false });
  });
});

describe('FixtureDynafinClient (sample data for UAT only)', () => {
  const c = new FixtureDynafinClient();
  it('is unmistakably labelled sample data', async () => {
    expect(c.systemLabel).toContain('SAMPLE');
    expect(c.info.sampleData).toBe(true);
    const txns = await c.listTransactions({ from: '2026-11-01', to: '2026-11-13' });
    expect(txns.length).toBeGreaterThan(10);
    expect(txns.every((t) => /SAMPLE|^SMP-/.test(`${t.description} ${t.reference}`))).toBe(true);
  });
  it('returns only postings inside the requested window, and a shorter window returns fewer', async () => {
    // Sample data is anchored to the END of the window, so any recent period shows something.
    const wide = await c.listTransactions({ from: '2026-11-01', to: '2026-11-13' });
    const narrow = await c.listTransactions({ from: '2026-11-12', to: '2026-11-13' });
    const inside = (from: string, to: string) => (t: { postingDate: string }) => t.postingDate >= from && t.postingDate <= `${to}T23:59:59.999Z`;
    expect(wide.every(inside('2026-11-01', '2026-11-13'))).toBe(true);
    expect(narrow.every(inside('2026-11-12', '2026-11-13'))).toBe(true);
    expect(narrow.length).toBeGreaterThan(0);
    expect(narrow.length).toBeLessThan(wide.length);
  });
  it('always includes advances that are still unretired, even if issued before the window', async () => {
    const advances = await c.listStaffAdvances({ from: '2026-11-12', to: '2026-11-13' });
    expect(advances.some((a) => a.retiredAmount + a.refundedAmount < a.amount)).toBe(true);
  });
});

describe('createDynafinClient', () => {
  it('is disabled unless explicitly enabled', () => {
    expect(createDynafinClient({ enabled: false, driver: 'http' }, false)).toBeInstanceOf(DisabledDynafinClient);
    expect(createDynafinClient({ enabled: false, driver: 'fixture' }, false)).toBeInstanceOf(DisabledDynafinClient);
  });
  it('builds the HTTP driver for the real API', () => {
    expect(createDynafinClient({ enabled: true, driver: 'http' }, true)).toBeInstanceOf(HttpDynafinClient);
  });
  it('allows sample data outside production', () => {
    expect(createDynafinClient({ enabled: true, driver: 'fixture' }, false)).toBeInstanceOf(FixtureDynafinClient);
  });
  it('refuses sample data in production', () => {
    expect(() => createDynafinClient({ enabled: true, driver: 'fixture' }, true)).toThrow(/not allowed in production/);
  });
});
