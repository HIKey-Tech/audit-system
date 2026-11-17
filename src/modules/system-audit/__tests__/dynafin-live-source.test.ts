import { config } from '../../../shared/config/app.config';
import { DisabledDynafinClient, FixtureDynafinClient, IDynafinClient } from '../../integration/dynafin/service/client/dynafin.client';
import { DynafinStaffAdvance, DynafinTransaction } from '../../integration/dynafin/domain/entity/dynafin.entity';
import { LiveSourceService } from '../analytics/service/implementation/live-source.service';
import { RunLiveAnalysisSchema } from '../analytics/dto/request/analytics.request.dto';
import { MONITORING_CHECKS } from '../monitoring/service/implementation/monitoring.service';
import { ANALYZERS } from '../utility/analyzers';
import { AnalysisSource, AnalysisType } from '../domain/enum/system-audit.enum';

const ACTOR = { id: 'u1', roles: [], permissions: [] };
const TYPES = [AnalysisType.HighValueTransactions, AnalysisType.DuplicatePostings, AnalysisType.StaffAdvances];

const configWith = (values: Record<string, string | null | Error>) => ({
  getConfig: jest.fn(async (key: string) => {
    const v = values[key];
    if (v instanceof Error || v === undefined) throw v ?? new Error('not found');
    return { key, value: v };
  }),
});

const service = (dynafin: IDynafinClient, values: Record<string, string | null | Error> = {}) =>
  new LiveSourceService({} as never, {} as never, {} as never, {} as never, dynafin, configWith(values) as never);

const txn = (over: Partial<DynafinTransaction> = {}): DynafinTransaction => ({
  reference: 'R1', postingDate: '2026-11-10T10:00:00.000Z', amount: 6_000_000, currency: 'NGN', accountCode: null, accountName: null,
  expenseCategory: null, description: null, payee: 'P', department: null, postedBy: null, approvedBy: null, supportingRef: null,
  invoiceNumber: null, isReversal: false, ...over,
});

/** A client whose calls we can inspect, to prove what the live source asks Dynafin for. */
const stubClient = (txns: DynafinTransaction[] = [], advances: DynafinStaffAdvance[] = []): IDynafinClient & { listTransactions: jest.Mock; listStaffAdvances: jest.Mock } => ({
  enabled: true, configured: true, systemLabel: 'Dynafin',
  info: { enabled: true, configured: true, driver: 'http', sampleData: false },
  listTransactions: jest.fn(async () => txns),
  listStaffAdvances: jest.fn(async () => advances),
  checkStatus: jest.fn(),
});

describe('LiveSourceService — Dynafin source', () => {
  it('offers Dynafin only while the integration is on, and keeps the existing sources', () => {
    const off = service(new DisabledDynafinClient()).supportedSources();
    for (const t of TYPES) expect(off[t]).toBeUndefined();
    expect(off[AnalysisType.IncidentLog]).toEqual([AnalysisSource.Imoc]);

    const on = service(new FixtureDynafinClient()).supportedSources();
    for (const t of TYPES) expect(on[t]).toEqual([AnalysisSource.Dynafin]);
    expect(on[AnalysisType.AccessListing]).toEqual([AnalysisSource.Iams, AnalysisSource.EntraId]);
  });

  it('refuses to run when the integration is off, and says how to proceed', async () => {
    await expect(service(new DisabledDynafinClient()).fetch(AnalysisType.HighValueTransactions, AnalysisSource.Dynafin, { days: 7, actor: ACTOR }))
      .rejects.toMatchObject({ message: expect.stringContaining('upload a Dynafin export') });
  });

  it('refuses a Dynafin source for an analysis that has no Dynafin data', async () => {
    await expect(service(new FixtureDynafinClient()).fetch(AnalysisType.ChangeLog, AnalysisSource.Dynafin, { days: 7, actor: ACTOR }))
      .rejects.toMatchObject({ message: expect.stringContaining('cannot run against') });
  });

  it('turns driver records into analysis rows the analyzer understands, labelled as sample data', async () => {
    const extract = await service(new FixtureDynafinClient()).fetch(AnalysisType.HighValueTransactions, AnalysisSource.Dynafin, { days: 14, actor: ACTOR });
    expect(extract.systemName).toBe('Dynafin (SAMPLE DATA)');
    expect(extract.records.length).toBeGreaterThan(10);
    expect(extract.records[0].values.posting_date).toBeInstanceOf(Date);
    const analyzerFields = ANALYZERS[AnalysisType.HighValueTransactions].fields.map((f) => f.key);
    expect(Object.keys(extract.records[0].values).sort()).toEqual([...analyzerFields].sort());
  });

  it('runs end to end: live source → analyzer → exceptions', async () => {
    const extract = await service(new FixtureDynafinClient()).fetch(AnalysisType.HighValueTransactions, AnalysisSource.Dynafin, { days: 14, actor: ACTOR });
    const analyzer = ANALYZERS[AnalysisType.HighValueTransactions];
    const result = analyzer.analyse(extract.records, analyzer.parametersSchema.parse(extract.parameterDefaults), { now: new Date(), mappedFields: extract.mappedFields });
    expect(result.summary.qualifying).toBe(11);
  });

  it('does not treat a field Dynafin never returns as "missing" — no flood of false MISSING_APPROVER', async () => {
    // Dynafin's real API might not expose approvers at all. Every record then has approvedBy = null.
    const extract = await service(stubClient([txn(), txn({ reference: 'R2' })])).fetch(AnalysisType.HighValueTransactions, AnalysisSource.Dynafin, { days: 7, actor: ACTOR });
    expect(extract.mappedFields.has('approved_by')).toBe(false);
    const analyzer = ANALYZERS[AnalysisType.HighValueTransactions];
    const result = analyzer.analyse(extract.records, analyzer.parametersSchema.parse({}), { now: new Date(), mappedFields: extract.mappedFields });
    expect(result.exceptions.map((e) => e.ruleCode)).not.toContain('MISSING_APPROVER');
    // …but once at least one record carries an approver, the column counts as supplied and gaps are real.
    const supplied = await service(stubClient([txn({ approvedBy: 'A' }), txn({ reference: 'R2' })])).fetch(AnalysisType.HighValueTransactions, AnalysisSource.Dynafin, { days: 7, actor: ACTOR });
    expect(supplied.mappedFields.has('approved_by')).toBe(true);
  });

  it('asks Dynafin for the requested window', async () => {
    const client = stubClient();
    await service(client).fetch(AnalysisType.DuplicatePostings, AnalysisSource.Dynafin, { days: 1, actor: ACTOR });
    const { from, to } = client.listTransactions.mock.calls[0][0];
    expect(new Date(to).getTime() - new Date(from).getTime()).toBe(86_400_000);
  });

  it('looks back at least 90 days for staff advances, so old unretired ones are never missed', async () => {
    const client = stubClient();
    await service(client).fetch(AnalysisType.StaffAdvances, AnalysisSource.Dynafin, { days: 7, actor: ACTOR });
    const { from, to } = client.listStaffAdvances.mock.calls[0][0];
    expect((new Date(to).getTime() - new Date(from).getTime()) / 86_400_000).toBeGreaterThanOrEqual(90);
  });
});

describe('configurable thresholds (spec §6.6)', () => {
  const HV = 'dynafin.high_value_threshold';
  const HVE = 'dynafin.high_value_expenditure_threshold';

  it('use the configured values for live runs and for uploads alike', async () => {
    const s = service(new FixtureDynafinClient(), { [HV]: '7,500,000', [HVE]: '₦12000000' });
    expect(await s.parameterDefaultsFor(AnalysisType.HighValueTransactions)).toEqual({ threshold: 7_500_000, expenditureThreshold: 12_000_000 });
    expect(await s.parameterDefaultsFor(AnalysisType.DuplicatePostings)).toEqual({ splitThreshold: 7_500_000 });
    const live = await s.fetch(AnalysisType.HighValueTransactions, AnalysisSource.Dynafin, { days: 14, actor: ACTOR });
    expect(live.parameterDefaults).toMatchObject({ threshold: 7_500_000 });
  });

  it('a changed threshold changes the result', async () => {
    const extractAt = async (value: string) => {
      const s = service(new FixtureDynafinClient(), { [HV]: value, [HVE]: '10000000' });
      const e = await s.fetch(AnalysisType.HighValueTransactions, AnalysisSource.Dynafin, { days: 14, actor: ACTOR });
      const a = ANALYZERS[AnalysisType.HighValueTransactions];
      return a.analyse(e.records, a.parametersSchema.parse(e.parameterDefaults), { now: new Date(), mappedFields: e.mappedFields }).summary.qualifying;
    };
    expect(await extractAt('5000000')).toBe(11);
    expect(await extractAt('20000000')).toBe(1); // only the ₦25m inventory purchase
  });

  it('fall back to the spec defaults when a row is missing, unreadable or nonsense — never fail a run', async () => {
    const unusable: Array<Record<string, string | null | Error>> = [
      {},
      { [HV]: new Error('db down'), [HVE]: new Error('db down') },
      { [HV]: 'abc', [HVE]: '-1' },
      { [HV]: null, [HVE]: '' },
      { [HV]: '0', [HVE]: '   ' }, // a zero threshold would flag every transaction
    ];
    for (const values of unusable) {
      expect(await service(new FixtureDynafinClient(), values).parameterDefaultsFor(AnalysisType.HighValueTransactions))
        .toEqual({ threshold: 5_000_000, expenditureThreshold: 10_000_000 });
    }
  });

  it('add nothing for analyses that have no configurable threshold', async () => {
    const s = service(new FixtureDynafinClient(), { [HV]: '9' });
    expect(await s.parameterDefaultsFor(AnalysisType.StaffAdvances)).toEqual({});
    expect(await s.parameterDefaultsFor(AnalysisType.IncidentLog)).toEqual({});
  });
});

describe('wiring', () => {
  it('a live run can name Dynafin as its source', () => {
    expect(RunLiveAnalysisSchema.safeParse({ analysisType: 'high_value_transactions', source: 'dynafin' }).success).toBe(true);
    expect(RunLiveAnalysisSchema.safeParse({ analysisType: 'high_value_transactions', source: 'nonsense' }).success).toBe(false);
  });

  it('every financial analysis is registered with a usable upload definition', () => {
    for (const t of TYPES) {
      const a = ANALYZERS[t];
      expect(a.type).toBe(t);
      expect(a.fields.filter((f) => f.required).length).toBeGreaterThanOrEqual(3);
      expect(a.fields.every((f) => f.synonyms.length > 0)).toBe(true);
      expect(a.rules.length).toBeGreaterThan(0);
      expect(a.parametersSchema.safeParse({}).success).toBe(true); // runs with no parameters at all
    }
  });

  it('continuous monitoring has a DAILY duplicate-posting check that only runs when Dynafin is enabled', () => {
    const check = MONITORING_CHECKS.find((c) => c.key === 'dynafin_duplicate_postings')!;
    expect(check).toBeDefined();
    expect(check).toMatchObject({ analysisType: AnalysisType.DuplicatePostings, source: AnalysisSource.Dynafin, fixedDays: 1 });
    expect(check.connection().connected).toBe(config.dynafin.enabled);
  });

  it('the existing monitoring checks are unchanged', () => {
    expect(MONITORING_CHECKS.map((c) => c.key)).toEqual(['iams_access', 'iams_security_events', 'entra_access', 'imoc_incidents', 'dynafin_duplicate_postings']);
  });
});
