import { z } from 'zod';
import { AnalysisType, ExceptionSeverity } from '../../domain/enum/system-audit.enum';
import { AnalysisField, AnalysisRecord, AnalyzerContext, AnalyzerDefinition, AnalysisResult, ExceptionDraft } from '../../domain/entity/system-audit.entity';
import { hoursBetween, round } from '../system-audit.utility';
import { amountKobo, dateOf, koboToNaira, naira, norm, text } from './financial-common';

// Spec §1.9: advances issued, retired, refunded and outstanding by employee, aged against
// GBB's 72-hour retirement requirement; highlight overdue advances, partial retirements,
// repeat advances, and new advances issued before the previous one is retired.
const ParametersSchema = z.object({
  /** GBB's prescribed retirement window. */
  retirementHours: z.number().min(1).max(24 * 365).default(72),
  /** An employee with at least this many advances in the extract is reported as a repeat borrower. */
  repeatThreshold: z.number().int().min(2).max(50).default(2),
});
export type StaffAdvancesParameters = z.infer<typeof ParametersSchema>;

const FIELDS: AnalysisField[] = [
  { key: 'advance_id', label: 'Advance reference', kind: 'text', required: true, synonyms: ['advance id', 'advance number', 'advance no', 'advance reference', 'reference', 'ref', 'id'] },
  { key: 'employee', label: 'Employee', kind: 'text', required: true, synonyms: ['employee', 'employee name', 'staff name', 'staff', 'name', 'beneficiary'] },
  { key: 'employee_id', label: 'Employee ID', kind: 'text', required: false, synonyms: ['employee id', 'staff id', 'employee number', 'staff number', 'payroll number'] },
  { key: 'issued_at', label: 'Date issued', kind: 'date', required: true, synonyms: ['issued at', 'issue date', 'date issued', 'advance date', 'date', 'issued'] },
  { key: 'amount', label: 'Advance amount (₦)', kind: 'number', required: true, synonyms: ['amount', 'advance amount', 'value', 'amount issued', 'amount (₦)', 'amount ngn'] },
  { key: 'retired_amount', label: 'Amount retired (₦)', kind: 'number', required: false, synonyms: ['retired amount', 'amount retired', 'retired', 'retirement amount'] },
  { key: 'refunded_amount', label: 'Amount refunded (₦)', kind: 'number', required: false, synonyms: ['refunded amount', 'amount refunded', 'refunded', 'refund'] },
  { key: 'retired_at', label: 'Date retired', kind: 'date', required: false, synonyms: ['retired at', 'retirement date', 'date retired', 'last retirement date', 'retired on'] },
  { key: 'purpose', label: 'Purpose', kind: 'text', required: false, synonyms: ['purpose', 'description', 'narration', 'reason'] },
];

interface Advance {
  row: number;
  id: string;
  employee: string;
  employeeKey: string;
  issuedAt: Date;
  kobo: number;
  settledKobo: number;
  outstandingKobo: number;
  retiredAt: Date | null;
  purpose: string | null;
}

const analyse = (records: AnalysisRecord[], params: StaffAdvancesParameters, context: AnalyzerContext): AnalysisResult => {
  const advances: Advance[] = [];
  let unreadable = 0;
  for (const r of records) {
    const v = r.values;
    const id = text(v.advance_id);
    const employee = text(v.employee);
    const issuedAt = dateOf(v.issued_at);
    const kobo = amountKobo(v.amount);
    if (!id || !employee || !issuedAt || kobo === null) {
      unreadable += 1;
      continue;
    }
    const settledKobo = (amountKobo(v.retired_amount) ?? 0) + (amountKobo(v.refunded_amount) ?? 0);
    advances.push({
      row: r.rowNumber,
      id,
      employee,
      employeeKey: norm(text(v.employee_id) ?? employee),
      issuedAt,
      kobo,
      settledKobo,
      outstandingKobo: Math.max(kobo - settledKobo, 0),
      retiredAt: dateOf(v.retired_at),
      purpose: text(v.purpose),
    });
  }

  const exceptions: ExceptionDraft[] = [];
  const limitHours = params.retirementHours;
  let overdue = 0;
  let partial = 0;
  let late = 0;
  let withinDeadline = 0;
  let newBeforeRetired = 0;
  let repeatEmployees = 0;
  let issuedKobo = 0;
  let outstandingKobo = 0;

  const detail = (a: Advance): Record<string, unknown> => ({
    advanceId: a.id,
    employee: a.employee,
    issuedAt: a.issuedAt.toISOString(),
    amount: koboToNaira(a.kobo),
    settled: koboToNaira(a.settledKobo),
    outstanding: koboToNaira(a.outstandingKobo),
    retiredAt: a.retiredAt?.toISOString() ?? null,
    purpose: a.purpose,
    row: a.row,
  });

  for (const a of advances) {
    issuedKobo += a.kobo;
    outstandingKobo += a.outstandingKobo;
    const ageHours = hoursBetween(a.issuedAt, context.now);

    if (a.outstandingKobo > 0) {
      if (ageHours <= limitHours) {
        withinDeadline += 1;
      } else if (a.settledKobo > 0) {
        partial += 1;
        exceptions.push({
          ruleCode: 'PARTIAL_RETIREMENT',
          severity: ExceptionSeverity.Medium,
          title: `${a.employee}'s advance ${a.id} is only partly retired — ${naira(koboToNaira(a.outstandingKobo))} of ${naira(koboToNaira(a.kobo))} still outstanding after ${Math.floor(ageHours)} hours`,
          recordRef: a.id,
          details: { ...detail(a), ageHours: round(ageHours), allowedHours: limitHours },
        });
      } else {
        overdue += 1;
        exceptions.push({
          ruleCode: 'ADVANCE_OVERDUE',
          severity: ExceptionSeverity.High,
          title: `${a.employee}'s advance ${a.id} of ${naira(koboToNaira(a.kobo))} has not been retired after ${Math.floor(ageHours)} hours (limit ${limitHours})`,
          recordRef: a.id,
          details: { ...detail(a), ageHours: round(ageHours), allowedHours: limitHours },
        });
      }
    } else if (a.retiredAt && hoursBetween(a.issuedAt, a.retiredAt) > limitHours) {
      late += 1;
      exceptions.push({
        ruleCode: 'LATE_RETIREMENT',
        severity: ExceptionSeverity.Medium,
        title: `${a.employee}'s advance ${a.id} was retired after ${Math.floor(hoursBetween(a.issuedAt, a.retiredAt))} hours (limit ${limitHours})`,
        recordRef: a.id,
        details: { ...detail(a), hoursToRetire: round(hoursBetween(a.issuedAt, a.retiredAt)), allowedHours: limitHours },
      });
    }
  }

  // Per-employee patterns.
  const byEmployee = new Map<string, Advance[]>();
  for (const a of advances) byEmployee.set(a.employeeKey, [...(byEmployee.get(a.employeeKey) ?? []), a]);
  for (const [, list] of byEmployee) {
    const sorted = [...list].sort((x, y) => x.issuedAt.getTime() - y.issuedAt.getTime());

    sorted.forEach((current, i) => {
      // An earlier advance still open the moment this one was issued.
      const stillOpen = sorted.slice(0, i).filter(
        (earlier) => earlier.outstandingKobo > 0 || (earlier.retiredAt !== null && earlier.retiredAt > current.issuedAt),
      );
      if (stillOpen.length === 0) return;
      newBeforeRetired += 1;
      exceptions.push({
        ruleCode: 'NEW_BEFORE_RETIRED',
        severity: ExceptionSeverity.High,
        title: `${current.employee} was issued advance ${current.id} (${naira(koboToNaira(current.kobo))}) while ${stillOpen.map((s) => s.id).join(', ')} was not yet retired`,
        recordRef: current.id,
        details: { ...detail(current), earlierOpenAdvances: stillOpen.map((s) => s.id) },
      });
    });

    if (sorted.length >= params.repeatThreshold) {
      repeatEmployees += 1;
      exceptions.push({
        ruleCode: 'REPEAT_ADVANCE',
        severity: ExceptionSeverity.Medium,
        title: `${sorted[0].employee} received ${sorted.length} advances totalling ${naira(koboToNaira(sorted.reduce((n, a) => n + a.kobo, 0)))}`,
        recordRef: sorted[0].employeeKey.slice(0, 500),
        details: { employee: sorted[0].employee, count: sorted.length, advances: sorted.slice(0, 25).map((a) => ({ advanceId: a.id, issuedAt: a.issuedAt.toISOString(), amount: koboToNaira(a.kobo) })) },
      });
    }
  }

  return {
    summary: {
      advances: advances.length,
      totalIssued: round(koboToNaira(issuedKobo), 2),
      totalOutstanding: round(koboToNaira(outstandingKobo), 2),
      overdueAdvances: overdue,
      partiallyRetired: partial,
      lateRetired: late,
      withinDeadline,
      newBeforePreviousRetired: newBeforeRetired,
      repeatEmployees,
      retirementHours: limitHours,
      unreadableRows: unreadable,
    },
    exceptions,
  };
};

export const staffAdvancesAnalyzer: AnalyzerDefinition<StaffAdvancesParameters> = {
  type: AnalysisType.StaffAdvances,
  label: 'Staff advances & retirement',
  description:
    "Ages every staff advance against GBB's 72-hour retirement requirement and reports overdue advances, partial retirements, late retirements, repeat advances, and new advances issued before the previous one was retired.",
  controls: [],
  fields: FIELDS,
  parametersSchema: ParametersSchema,
  rules: [
    { code: 'ADVANCE_OVERDUE', label: 'Advance not retired within the allowed hours', severity: ExceptionSeverity.High },
    { code: 'PARTIAL_RETIREMENT', label: 'Advance only partly retired after the deadline', severity: ExceptionSeverity.Medium },
    { code: 'LATE_RETIREMENT', label: 'Advance retired after the deadline', severity: ExceptionSeverity.Medium },
    { code: 'NEW_BEFORE_RETIRED', label: 'New advance issued before the previous one was retired', severity: ExceptionSeverity.High },
    { code: 'REPEAT_ADVANCE', label: 'Employee received repeated advances', severity: ExceptionSeverity.Medium },
  ],
  analyse,
};
