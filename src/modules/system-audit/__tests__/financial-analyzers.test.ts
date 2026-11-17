import { AnalysisRecord, AnalyzerContext, FieldValue } from '../domain/entity/system-audit.entity';
import { ANALYZERS } from '../utility/analyzers';
import { AnalysisType } from '../domain/enum/system-audit.enum';
import { classifyExpenditure, DEFAULT_EXPENDITURE_CATEGORIES } from '../utility/analyzers/high-value-transactions.analyzer';
import { buildFixtureStaffAdvances, buildFixtureTransactions } from '../../integration/dynafin/utility/dynafin.fixture';

const hvt = ANALYZERS[AnalysisType.HighValueTransactions];
const dup = ANALYZERS[AnalysisType.DuplicatePostings];
const adv = ANALYZERS[AnalysisType.StaffAdvances];

const NOW = new Date('2026-11-13T23:59:59.999Z');
const day = (d: number, hour = 10): Date => new Date(Date.UTC(2026, 10, d, hour, 0, 0));

const ALL_TXN_FIELDS = ['reference', 'posting_date', 'amount', 'account_code', 'account_name', 'expense_category', 'description', 'payee', 'department', 'posted_by', 'approved_by', 'supporting_ref', 'invoice_number', 'is_reversal'];

const rec = (rowNumber: number, values: Record<string, FieldValue>): AnalysisRecord => ({ rowNumber, values });
const txn = (row: number, over: Record<string, FieldValue> = {}): AnalysisRecord =>
  rec(row, { reference: `T${row}`, posting_date: day(10), amount: 1_000, ...over });
const ctx = (fields: string[] = ALL_TXN_FIELDS): AnalyzerContext => ({ now: NOW, mappedFields: new Set(fields) });

const run = (analyzer: typeof hvt, records: AnalysisRecord[], params: Record<string, unknown> = {}, context = ctx()) =>
  analyzer.analyse(records, analyzer.parametersSchema.parse(params), context);
const codes = (r: ReturnType<typeof run>): string[] => r.exceptions.map((e) => e.ruleCode);

describe('high-value transactions (spec §1.7, §1.8, §6)', () => {
  it('reports only transactions STRICTLY above ₦5,000,000 — exactly ₦5,000,000 does not qualify', () => {
    const r = run(hvt, [
      txn(1, { amount: 4_999_999.99 }),
      txn(2, { amount: 5_000_000 }),
      txn(3, { amount: 5_000_000.01 }),
    ]);
    expect(r.exceptions.filter((e) => e.ruleCode === 'HIGH_VALUE_TRANSACTION').map((e) => e.recordRef)).toEqual(['T3']);
    expect(r.summary.qualifying).toBe(1);
  });

  it('never adds transactions together to reach the threshold (§6.3)', () => {
    const r = run(hvt, [txn(1, { amount: 4_000_000 }), txn(2, { amount: 4_000_000 }), txn(3, { amount: 4_000_000 })]);
    expect(r.exceptions).toEqual([]);
    expect(r.summary.qualifying).toBe(0);
  });

  it('treats a negative (credit / bracketed) amount by its absolute value', () => {
    expect(run(hvt, [txn(1, { amount: -6_000_000 })]).summary.qualifying).toBe(1);
  });

  it('uses the configured threshold, not a hard-coded one (§6.6)', () => {
    const records = [txn(1, { amount: 2_000_000 }), txn(2, { amount: 3_000_000 })];
    expect(run(hvt, records, { threshold: 2_500_000 }).summary.qualifying).toBe(1);
    expect(run(hvt, records, { threshold: 1_000_000 }).summary.qualifying).toBe(2);
  });

  it('grades severity by how far above the threshold the transaction is', () => {
    const sev = (amount: number): string =>
      run(hvt, [txn(1, { amount })]).exceptions.find((e) => e.ruleCode === 'HIGH_VALUE_TRANSACTION')!.severity;
    expect(sev(6_000_000)).toBe('medium');
    expect(sev(11_000_000)).toBe('high');
    expect(sev(26_000_000)).toBe('critical');
  });

  it('flags a missing approver, but only when the approver column was supplied', () => {
    const records = [txn(1, { amount: 6_000_000, approved_by: null })];
    expect(codes(run(hvt, records))).toContain('MISSING_APPROVER');
    expect(codes(run(hvt, records, {}, ctx(['reference', 'posting_date', 'amount'])))).not.toContain('MISSING_APPROVER');
  });

  it('flags a transaction posted and approved by the same person (maker-checker, FIN-AP-001)', () => {
    const r = run(hvt, [txn(1, { amount: 6_000_000, posted_by: 'A. Poster', approved_by: 'a. poster' })]);
    expect(codes(r)).toContain('SELF_APPROVED');
    expect(codes(run(hvt, [txn(1, { amount: 6_000_000, posted_by: 'A', approved_by: 'B', supporting_ref: 'PO-1' })]))).toEqual(['HIGH_VALUE_TRANSACTION']);
  });

  it('flags missing supporting references', () => {
    expect(codes(run(hvt, [txn(1, { amount: 6_000_000, approved_by: 'B', supporting_ref: null, invoice_number: null })]))).toContain('MISSING_SUPPORT');
    expect(codes(run(hvt, [txn(1, { amount: 6_000_000, approved_by: 'B', supporting_ref: null, invoice_number: 'INV-1' })]))).not.toContain('MISSING_SUPPORT');
  });

  it('counts rows it cannot read instead of guessing', () => {
    const r = run(hvt, [rec(1, { reference: null, posting_date: day(1), amount: 9_000_000 }), txn(2, { amount: 6_000_000 })]);
    expect(r.summary.unreadableRows).toBe(1);
    expect(r.summary.qualifying).toBe(1);
  });

  describe('expenditure mode — threshold ₦10,000,000, nine named categories (§1.8, §2)', () => {
    const exp = (records: AnalysisRecord[]) => run(hvt, records, { mode: 'expenditure' });

    it('applies the ₦10,000,000 threshold strictly', () => {
      const r = exp([
        txn(1, { amount: 10_000_000, expense_category: 'Diesel Costs' }),
        txn(2, { amount: 10_000_000.01, expense_category: 'Diesel Costs' }),
      ]);
      expect(r.exceptions.filter((e) => e.ruleCode === 'HIGH_VALUE_EXPENDITURE').map((e) => e.recordRef)).toEqual(['T2']);
    });

    it('does not report large transactions outside the nine categories, but counts them', () => {
      const r = exp([txn(1, { amount: 50_000_000, description: 'Land purchase', account_name: 'Land' })]);
      expect(r.exceptions).toEqual([]);
      expect(r.summary.uncategorisedAboveThreshold).toBe(1);
    });

    it('recognises all nine categories', () => {
      expect(DEFAULT_EXPENDITURE_CATEGORIES.map((c) => c.name)).toEqual([
        'Local and Foreign Travel Costs', 'Diesel Costs', 'Fuelling Costs', 'Motor Vehicle Maintenance',
        'Network Equipment Maintenance', 'Computer Equipment', 'Local and Foreign Staff Training',
        'Entertainment and Refreshments', 'Inventory',
      ]);
    });

    it('classifies by exact category, then account-code prefix, then keyword', () => {
      const rules = [
        { name: 'Diesel Costs', accountCodePrefixes: ['5210'], keywords: ['diesel'] },
        { name: 'Inventory', accountCodePrefixes: [], keywords: ['stores'] },
      ];
      const base = { category: null, accountCode: null, accountName: null, description: null };
      expect(classifyExpenditure({ ...base, category: ' diesel  costs ' }, rules)).toBe('Diesel Costs');
      expect(classifyExpenditure({ ...base, accountCode: '521099' }, rules)).toBe('Diesel Costs');
      expect(classifyExpenditure({ ...base, description: 'Items from Central Stores' }, rules)).toBe('Inventory');
      expect(classifyExpenditure({ ...base, description: 'Something else' }, rules)).toBeNull();
    });

    it('tries Diesel before Fuelling so a diesel purchase is not mislabelled', () => {
      expect(classifyExpenditure({ category: null, accountCode: null, accountName: 'Diesel for generators', description: null }, DEFAULT_EXPENDITURE_CATEGORIES)).toBe('Diesel Costs');
    });
  });
});

describe('duplicate & unusual postings (spec §1.6, §1.13)', () => {
  it('finds the same reference posted twice, and ignores a reference that appears once', () => {
    const r = run(dup, [txn(1, { reference: 'X1', amount: 750_000 }), txn(2, { reference: 'X1', amount: 750_000 }), txn(3, { reference: 'X2' })]);
    expect(r.exceptions.filter((e) => e.ruleCode === 'DUPLICATE_REFERENCE')).toHaveLength(1);
    expect(r.summary.duplicateReferenceGroups).toBe(1);
    expect(r.summary.valueAtRisk).toBe(750_000);
  });

  it('finds one vendor invoice posted under different references', () => {
    const r = run(dup, [
      txn(1, { reference: 'A', payee: 'Acme', invoice_number: 'INV-1', amount: 1_200_000, posting_date: day(8) }),
      txn(2, { reference: 'B', payee: 'ACME', invoice_number: 'inv-1', amount: 1_200_000, posting_date: day(9) }),
    ]);
    expect(codes(r)).toEqual(['DUPLICATE_INVOICE']);
  });

  it('finds same amount + account + day + payee, without re-flagging postings already caught', () => {
    const twins = [
      txn(1, { reference: 'A', amount: 300_000, account_code: '5600', payee: 'Twin' }),
      txn(2, { reference: 'B', amount: 300_000, account_code: '5600', payee: 'Twin' }),
    ];
    expect(codes(run(dup, twins))).toEqual(['SAME_AMOUNT_ACCOUNT_DATE_PAYEE']);
    // Same reference as well → reported once, as the stronger duplicate-reference finding.
    const sameRef = [twins[0], { ...twins[1], values: { ...twins[1].values, reference: 'A' } }];
    expect(codes(run(dup, sameRef))).toEqual(['DUPLICATE_REFERENCE']);
  });

  it('does not treat the same amount on different days as a duplicate', () => {
    expect(run(dup, [txn(1, { amount: 300_000, posting_date: day(8) }), txn(2, { amount: 300_000, posting_date: day(9) })]).exceptions).toEqual([]);
  });

  it('matches a reversal to the posting it undoes', () => {
    const r = run(dup, [
      txn(1, { reference: 'ORIG', amount: 640_000, payee: 'Rev Ltd', posting_date: day(8) }),
      txn(2, { reference: 'REV', amount: 640_000, payee: 'Rev Ltd', posting_date: day(9), is_reversal: true }),
    ]);
    const reversal = r.exceptions.find((e) => e.ruleCode === 'REVERSAL')!;
    expect(reversal.title).toContain('ORIG');
    expect(r.summary.reversals).toBe(1);
  });

  it('flags payments split below the limit that together exceed it', () => {
    const amounts = [4_000_000, 3_900_000, 4_200_000];
    const split = amounts.map((amount, i) => txn(i + 1, { reference: `S${i + 1}`, amount, payee: 'Splitter' }));
    expect(codes(run(dup, split))).toEqual(['SPLIT_PAYMENT']);
  });

  it('reports identical same-day payments to one payee under BOTH rules — possible duplicates and a possible split', () => {
    const split = [1, 2, 3].map((n) => txn(n, { reference: `S${n}`, amount: 4_000_000, payee: 'Splitter' }));
    expect(codes(run(dup, split)).sort()).toEqual(['SAME_AMOUNT_ACCOUNT_DATE_PAYEE', 'SPLIT_PAYMENT']);
  });

  it('does not flag small payments that stay under the limit in total, or a single payment', () => {
    expect(run(dup, [txn(1, { amount: 1_000_000, payee: 'P' }), txn(2, { reference: 'T2', amount: 1_500_000, payee: 'P' })]).exceptions).toEqual([]);
    expect(run(dup, [txn(1, { amount: 4_000_000, payee: 'P' })]).exceptions).toEqual([]);
  });

  it('skips rules whose columns were not supplied', () => {
    const onlyBasics = ctx(['reference', 'posting_date', 'amount']);
    const amounts = [4_000_000, 3_900_000, 4_200_000];
    const split = amounts.map((amount, i) => txn(i + 1, { reference: `S${i + 1}`, amount, payee: 'Splitter' }));
    expect(codes(run(dup, split, {}, onlyBasics))).not.toContain('SPLIT_PAYMENT');
  });
});

describe('staff advances & retirement (spec §1.9 — 72-hour rule)', () => {
  const ADV_FIELDS = ['advance_id', 'employee', 'employee_id', 'issued_at', 'amount', 'retired_amount', 'refunded_amount', 'retired_at', 'purpose'];
  const a = (row: number, over: Record<string, FieldValue> = {}): AnalysisRecord =>
    rec(row, { advance_id: `ADV${row}`, employee: `Staff ${row}`, issued_at: day(1), amount: 100_000, retired_amount: 0, refunded_amount: 0, retired_at: null, ...over });
  const runAdv = (records: AnalysisRecord[], params: Record<string, unknown> = {}) =>
    adv.analyse(records, adv.parametersSchema.parse(params), { now: NOW, mappedFields: new Set(ADV_FIELDS) });

  it('flags an unretired advance older than 72 hours, but not one inside the window', () => {
    const r = runAdv([a(1, { issued_at: day(1) }), a(2, { issued_at: new Date(NOW.getTime() - 71 * 3_600_000) })]);
    expect(r.exceptions.map((e) => [e.recordRef, e.ruleCode])).toEqual([['ADV1', 'ADVANCE_OVERDUE']]);
    expect(r.summary.withinDeadline).toBe(1);
  });

  it('honours a different retirement window', () => {
    const issued = new Date(NOW.getTime() - 100 * 3_600_000);
    expect(codes(runAdv([a(1, { issued_at: issued })]))).toEqual(['ADVANCE_OVERDUE']);
    expect(runAdv([a(1, { issued_at: issued })], { retirementHours: 120 }).exceptions).toEqual([]);
  });

  it('reports a partly retired advance as a partial retirement, not as untouched', () => {
    const r = runAdv([a(1, { retired_amount: 60_000 })]);
    expect(codes(r)).toEqual(['PARTIAL_RETIREMENT']);
    expect(r.summary.totalOutstanding).toBe(40_000);
  });

  it('counts refunds towards settling an advance', () => {
    expect(runAdv([a(1, { retired_amount: 60_000, refunded_amount: 40_000, retired_at: day(2) })]).exceptions).toEqual([]);
  });

  it('flags a fully settled advance that was retired late', () => {
    const r = runAdv([a(1, { issued_at: day(1), retired_amount: 100_000, retired_at: day(8) })]);
    expect(codes(r)).toEqual(['LATE_RETIREMENT']);
  });

  it('accepts a prompt retirement', () => {
    expect(runAdv([a(1, { issued_at: day(1), retired_amount: 100_000, retired_at: day(2) })]).exceptions).toEqual([]);
  });

  it('flags a new advance issued while an earlier one was still open', () => {
    const r = runAdv([
      a(1, { employee: 'Same Person', employee_id: 'E9', issued_at: day(2), retired_amount: 100_000, retired_at: day(9) }),
      a(2, { employee: 'Same Person', employee_id: 'E9', issued_at: day(5), retired_amount: 100_000, retired_at: day(6) }),
    ]);
    expect(codes(r)).toContain('NEW_BEFORE_RETIRED');
    expect(r.exceptions.find((e) => e.ruleCode === 'NEW_BEFORE_RETIRED')!.recordRef).toBe('ADV2');
  });

  it('does not flag a new advance once the previous one was fully retired', () => {
    const r = runAdv([
      a(1, { employee_id: 'E9', issued_at: day(2), retired_amount: 100_000, retired_at: day(3) }),
      a(2, { employee_id: 'E9', issued_at: day(5), retired_amount: 100_000, retired_at: day(6) }),
    ]);
    expect(codes(r)).not.toContain('NEW_BEFORE_RETIRED');
  });

  it('flags repeat advances per employee (matched by employee id, not by name spelling)', () => {
    const r = runAdv([
      a(1, { employee: 'A. Person', employee_id: 'E1', issued_at: day(2), retired_amount: 100_000, retired_at: day(3) }),
      a(2, { employee: 'Person, A.', employee_id: 'E1', issued_at: day(6), retired_amount: 100_000, retired_at: day(7) }),
    ]);
    expect(codes(r)).toEqual(['REPEAT_ADVANCE']);
    expect(runAdv([a(1, { employee_id: 'E1', issued_at: day(2), retired_amount: 100_000, retired_at: day(3) })]).summary.repeatEmployees).toBe(0);
  });
});

describe('end to end on the sample data (the plug-and-play proof)', () => {
  const TO = new Date('2026-11-13T23:59:59.999Z');
  const toTxnRecords = (): AnalysisRecord[] =>
    buildFixtureTransactions(TO).map((t, i) =>
      rec(i + 2, {
        reference: t.reference, posting_date: new Date(t.postingDate), amount: t.amount, account_code: t.accountCode,
        account_name: t.accountName, expense_category: t.expenseCategory, description: t.description, payee: t.payee,
        department: t.department, posted_by: t.postedBy, approved_by: t.approvedBy, supporting_ref: t.supportingRef,
        invoice_number: t.invoiceNumber, is_reversal: t.isReversal,
      }),
    );

  it('weekly high-value report: the ₦5m boundary is exact and splits are not aggregated', () => {
    const r = run(hvt, toTxnRecords());
    const flagged = r.exceptions.filter((e) => e.ruleCode === 'HIGH_VALUE_TRANSACTION').map((e) => e.recordRef).sort();
    expect(flagged).toEqual(['SMP-0001', 'SMP-0002', 'SMP-0003', 'SMP-0005', 'SMP-0006', 'SMP-0007', 'SMP-0008', 'SMP-0009', 'SMP-0010', 'SMP-0011', 'SMP-0012']);
    expect(flagged).not.toContain('SMP-0004'); // exactly ₦5,000,000
    expect(flagged).not.toEqual(expect.arrayContaining(['SMP-0040'])); // ₦4m split payments
    const missing = r.exceptions.filter((e) => e.ruleCode === 'MISSING_APPROVER').map((e) => e.recordRef);
    expect(missing).toEqual(['SMP-0006']);
  });

  it('weekly expenditure report: exactly one transaction in each of the nine categories, ₦10,000,000 itself excluded', () => {
    const r = run(hvt, toTxnRecords(), { mode: 'expenditure' });
    const flagged = r.exceptions.filter((e) => e.ruleCode === 'HIGH_VALUE_EXPENDITURE');
    expect(flagged.map((e) => e.recordRef).sort()).toEqual(['SMP-0001', 'SMP-0003', 'SMP-0006', 'SMP-0007', 'SMP-0008', 'SMP-0009', 'SMP-0010', 'SMP-0011', 'SMP-0012']);
    expect(new Set(flagged.map((e) => (e.details as { category: string }).category)).size).toBe(9);
  });

  it('daily duplicate alert finds every planted duplicate, reversal and split', () => {
    const r = run(dup, toTxnRecords());
    expect(r.summary).toMatchObject({ duplicateReferenceGroups: 1, duplicateInvoiceGroups: 1, sameAmountGroups: 1, reversals: 1, splitPaymentGroups: 1 });
    expect(codes(r).sort()).toEqual(['DUPLICATE_INVOICE', 'DUPLICATE_REFERENCE', 'REVERSAL', 'SAME_AMOUNT_ACCOUNT_DATE_PAYEE', 'SPLIT_PAYMENT']);
  });

  it('staff advances: overdue, partial, repeat and new-before-retired are found; the clean advance is not', () => {
    const records = buildFixtureStaffAdvances(TO).map((x, i) =>
      rec(i + 2, {
        advance_id: x.advanceId, employee: x.employee, employee_id: x.employeeId, issued_at: new Date(x.issuedAt), amount: x.amount,
        retired_amount: x.retiredAmount, refunded_amount: x.refundedAmount, retired_at: x.retiredAt ? new Date(x.retiredAt) : null, purpose: x.purpose,
      }),
    );
    const r = adv.analyse(records, adv.parametersSchema.parse({}), { now: TO, mappedFields: new Set(Object.keys(records[0].values)) });
    expect(r.summary).toMatchObject({ overdueAdvances: 3, partiallyRetired: 1, newBeforePreviousRetired: 1, repeatEmployees: 1, lateRetired: 0 });
    expect(r.exceptions.map((e) => e.recordRef)).not.toContain('SMP-ADV-05');
  });
});
