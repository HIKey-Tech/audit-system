import { z } from 'zod';
import { AnalysisType, ExceptionSeverity } from '../../domain/enum/system-audit.enum';
import { AnalysisRecord, AnalyzerContext, AnalyzerDefinition, AnalysisResult, ExceptionDraft } from '../../domain/entity/system-audit.entity';
import { daysBetween } from '../system-audit.utility';

const ParametersSchema = z.object({
  /** Emergency changes may be ratified after the fact, within this many days. */
  emergencyRatificationDays: z.number().int().min(0).max(60).default(3),
  requireTestEvidence: z.boolean().default(true),
  requireRollbackPlan: z.boolean().default(true),
  /** Optional approved change window (24h clock). Null disables the check. */
  changeWindow: z
    .object({
      startHour: z.number().int().min(0).max(23),
      endHour: z.number().int().min(0).max(23),
      weekendsAllowed: z.boolean().default(true),
    })
    .nullable()
    .default(null),
});
export type ChangeLogParameters = z.infer<typeof ParametersSchema>;

const IMPLEMENTED = /implement|complete|closed|deployed|done|success|resolved/i;
const CANCELLED = /cancel|reject|withdrawn|abandon/i;
const EMERGENCY = /emergency|urgent|expedite/i;
const NEGATIVE = /^(no|n|false|0|none|n\/a|na|-|not tested|pending)$/i;
// Some ITSM exports hold an approval *state* in the approver column.
const NOT_APPROVED_STATE = /^(not yet requested|requested|requested approval|pending|rejected|not approved|no|none|n\/a|na|-)$/i;
const APPROVED_STATE = /^(approved|yes|y|true)$/i;

const text = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);
const date = (v: unknown): Date | null => (v instanceof Date ? v : null);
const samePerson = (a: string | null, b: string | null): boolean =>
  Boolean(a && b && a.trim().toLowerCase() === b.trim().toLowerCase());

const inWindow = (when: Date, window: NonNullable<ChangeLogParameters['changeWindow']>): boolean => {
  const day = when.getDay();
  if ((day === 0 || day === 6) && window.weekendsAllowed) return true;
  const hour = when.getHours();
  // Windows may wrap midnight, e.g. 22:00 → 06:00.
  return window.startHour <= window.endHour
    ? hour >= window.startHour && hour < window.endHour
    : hour >= window.startHour || hour < window.endHour;
};

const analyse = (records: AnalysisRecord[], params: ChangeLogParameters, context: AnalyzerContext): AnalysisResult => {
  const exceptions: ExceptionDraft[] = [];
  const counts = { implemented: 0, emergency: 0, unapproved: 0, lateApproval: 0, selfApproved: 0, noTest: 0, noRollback: 0, outsideWindow: 0, emergencyUnratified: 0 };
  const hasTest = context.mappedFields.has('test_evidence');
  const hasRollback = context.mappedFields.has('rollback_plan');

  for (const r of records) {
    const v = r.values;
    const id = text(v.change_id) ?? `row ${r.rowNumber}`;
    const title = text(v.title);
    const label = title ? `${id} (${title})` : id;
    const status = text(v.status) ?? '';
    if (CANCELLED.test(status)) continue;

    const implementedAt = date(v.implementation_date);
    const implemented = Boolean(implementedAt) || IMPLEMENTED.test(status);
    if (!implemented) continue;
    counts.implemented += 1;

    const isEmergency = EMERGENCY.test(text(v.change_type) ?? '');
    if (isEmergency) counts.emergency += 1;
    const approverRaw = text(v.approved_by);
    const approver = approverRaw && NOT_APPROVED_STATE.test(approverRaw) ? null : approverRaw;
    const approverIsPerson = Boolean(approver && !APPROVED_STATE.test(approver));
    const approvedAt = date(v.approval_date);
    const base = { changeId: id, system: text(v.system), row: r.rowNumber };

    if (!approver && !approvedAt) {
      counts.unapproved += 1;
      exceptions.push({
        ruleCode: 'CHANGE_NOT_APPROVED',
        severity: ExceptionSeverity.High,
        title: `Change ${label} was implemented with no recorded approval`,
        recordRef: id,
        details: { ...base, changeType: text(v.change_type), implementedAt: implementedAt?.toISOString() ?? null },
      });
    } else if (approvedAt && implementedAt && approvedAt > implementedAt) {
      const lateDays = Math.round(daysBetween(implementedAt, approvedAt) * 10) / 10;
      if (!isEmergency) {
        counts.lateApproval += 1;
        exceptions.push({
          ruleCode: 'APPROVED_AFTER_IMPLEMENTATION',
          severity: ExceptionSeverity.High,
          title: `Change ${label} was approved ${lateDays} day(s) after it was implemented`,
          recordRef: id,
          details: { ...base, approvedAt: approvedAt.toISOString(), implementedAt: implementedAt.toISOString() },
        });
      } else if (lateDays > params.emergencyRatificationDays) {
        counts.emergencyUnratified += 1;
        exceptions.push({
          ruleCode: 'EMERGENCY_NOT_RATIFIED',
          severity: ExceptionSeverity.Medium,
          title: `Emergency change ${label} was ratified ${lateDays} day(s) after implementation (limit ${params.emergencyRatificationDays})`,
          recordRef: id,
          details: { ...base, approvedAt: approvedAt.toISOString(), implementedAt: implementedAt.toISOString() },
        });
      }
    }

    const requester = text(v.requested_by);
    const implementer = text(v.implemented_by);
    if (approverIsPerson && (samePerson(approver, requester) || samePerson(approver, implementer))) {
      counts.selfApproved += 1;
      exceptions.push({
        ruleCode: 'SELF_APPROVED',
        severity: ExceptionSeverity.High,
        title: `Change ${label} was approved by the same person who ${samePerson(approver, implementer) ? 'implemented' : 'requested'} it`,
        recordRef: id,
        details: { ...base, approvedBy: approver, requestedBy: requester, implementedBy: implementer },
      });
    }

    if (hasTest && params.requireTestEvidence) {
      const test = v.test_evidence;
      if (test === null || test === false || (typeof test === 'string' && NEGATIVE.test(test))) {
        counts.noTest += 1;
        exceptions.push({
          ruleCode: 'NO_TEST_EVIDENCE',
          severity: ExceptionSeverity.Medium,
          title: `Change ${label} has no evidence of testing`,
          recordRef: id,
          details: base,
        });
      }
    }

    if (hasRollback && params.requireRollbackPlan && !isEmergency) {
      const rollback = text(v.rollback_plan);
      if (!rollback || NEGATIVE.test(rollback)) {
        counts.noRollback += 1;
        exceptions.push({
          ruleCode: 'NO_ROLLBACK_PLAN',
          severity: ExceptionSeverity.Low,
          title: `Change ${label} has no documented rollback plan`,
          recordRef: id,
          details: base,
        });
      }
    }

    if (params.changeWindow && implementedAt && !isEmergency && !inWindow(implementedAt, params.changeWindow)) {
      counts.outsideWindow += 1;
      exceptions.push({
        ruleCode: 'OUTSIDE_CHANGE_WINDOW',
        severity: ExceptionSeverity.Low,
        title: `Change ${label} was implemented outside the approved change window`,
        recordRef: id,
        details: { ...base, implementedAt: implementedAt.toISOString(), window: params.changeWindow },
      });
    }
  }

  return {
    summary: {
      totalRecords: records.length,
      implementedChanges: counts.implemented,
      emergencyChanges: counts.emergency,
      unapproved: counts.unapproved,
      approvedAfterImplementation: counts.lateApproval,
      emergencyNotRatified: counts.emergencyUnratified,
      selfApproved: counts.selfApproved,
      noTestEvidence: counts.noTest,
      noRollbackPlan: counts.noRollback,
      outsideChangeWindow: counts.outsideWindow,
    },
    exceptions,
  };
};

export const changeLogAnalyzer: AnalyzerDefinition<ChangeLogParameters> = {
  type: AnalysisType.ChangeLog,
  label: 'Change management review',
  description:
    'Tests a change log from the ITSM tool: changes implemented without approval, approved after the fact, self-approved, or missing test and rollback evidence.',
  controls: ['SYS-CHG-001', 'COBIT-BAI06', 'SOX-ITGC-PC', 'ISO27001-A.8.9'],
  fields: [
    { key: 'change_id', label: 'Change ID', kind: 'text', required: true, synonyms: ['change number', 'change no', 'change ref', 'ticket', 'ticket id', 'rfc', 'cr number', 'cr', 'number', 'id', 'reference'] },
    { key: 'implementation_date', label: 'Implemented on', kind: 'date', required: true, synonyms: ['implemented date', 'implementation date', 'implemented', 'implemented on', 'completed date', 'completed', 'actual end', 'closed date', 'deployment date', 'deployed on'] },
    { key: 'approved_by', label: 'Approved by', kind: 'text', required: true, synonyms: ['approver', 'cab approver', 'authorised by', 'authorized by', 'approved'] },
    { key: 'approval_date', label: 'Approved on', kind: 'date', required: false, synonyms: ['approved date', 'approved on', 'approval date', 'cab date', 'authorised on', 'authorized on'] },
    { key: 'title', label: 'Title', kind: 'text', required: false, synonyms: ['summary', 'short description', 'description', 'subject'] },
    { key: 'change_type', label: 'Change type', kind: 'text', required: false, synonyms: ['type', 'category', 'change category', 'classification'] },
    { key: 'status', label: 'Status', kind: 'text', required: false, synonyms: ['state', 'change status'] },
    { key: 'requested_by', label: 'Requested by', kind: 'text', required: false, synonyms: ['requester', 'raised by', 'requestor', 'opened by', 'initiator'] },
    { key: 'implemented_by', label: 'Implemented by', kind: 'text', required: false, synonyms: ['implementer', 'engineer', 'assignee', 'assigned to', 'performed by'] },
    { key: 'test_evidence', label: 'Test evidence', kind: 'text', required: false, synonyms: ['tested', 'test result', 'test results', 'uat', 'uat sign off', 'testing'] },
    { key: 'rollback_plan', label: 'Rollback plan', kind: 'text', required: false, synonyms: ['backout plan', 'back out plan', 'rollback', 'backout'] },
    { key: 'system', label: 'System', kind: 'text', required: false, synonyms: ['ci', 'configuration item', 'application', 'service', 'asset'] },
  ],
  parametersSchema: ParametersSchema,
  rules: [
    { code: 'CHANGE_NOT_APPROVED', label: 'Implemented without approval', severity: ExceptionSeverity.High },
    { code: 'APPROVED_AFTER_IMPLEMENTATION', label: 'Approved after implementation', severity: ExceptionSeverity.High },
    { code: 'EMERGENCY_NOT_RATIFIED', label: 'Emergency change ratified late', severity: ExceptionSeverity.Medium },
    { code: 'SELF_APPROVED', label: 'Approver also requested or implemented', severity: ExceptionSeverity.High },
    { code: 'NO_TEST_EVIDENCE', label: 'No test evidence', severity: ExceptionSeverity.Medium },
    { code: 'NO_ROLLBACK_PLAN', label: 'No rollback plan', severity: ExceptionSeverity.Low },
    { code: 'OUTSIDE_CHANGE_WINDOW', label: 'Outside approved change window', severity: ExceptionSeverity.Low },
  ],
  analyse,
};
