'use client';

import { useState } from 'react';
import {
  Check,
  ChevronDown,
  ChevronUp,
  FilePlus,
  ShieldCheck,
  ClipboardCheck,
  FileText,
  FolderCheck,
  AlertTriangle,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { humanizeStatus, nextEngagementStatus } from '@/lib/utils/status';
import type { AuditEngagementDetail } from '@/lib/types/domain';

type StageKey = 'planned' | 'in_progress' | 'under_review' | 'reported' | 'closed';

interface StageConfig {
  key: StageKey;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
}

const STAGES: StageConfig[] = [
  {
    key: 'planned',
    label: 'Planning & Setup',
    description: 'Establish objective, timeline, and assign audit team members.',
    icon: FilePlus
  },
  {
    key: 'in_progress',
    label: 'Fieldwork & Testing',
    description: 'Execute audit procedures, test controls, and document working papers.',
    icon: ShieldCheck
  },
  {
    key: 'under_review',
    label: 'Quality Review',
    description: 'Perform supervisory review and obtain report sign-offs.',
    icon: ClipboardCheck
  },
  {
    key: 'reported',
    label: 'Reporting & Findings',
    description: 'Issue report to auditee and track remediation action plans.',
    icon: FileText
  },
  {
    key: 'closed',
    label: 'Audit Closure',
    description: 'Remediate all findings and archive the engagement file.',
    icon: FolderCheck
  }
];


interface StatusStepperProps {
  engagement: AuditEngagementDetail;
  onAdvance?: () => void;
  isAdvancing?: boolean;
  canAdvance?: boolean;
}

export const StatusStepper = ({
  engagement,
  onAdvance,
  isAdvancing = false,
  canAdvance = false,
}: StatusStepperProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(true);
  const activeIndex = STAGES.findIndex((s) => s.key === engagement.status);

  // Computing stats for fieldwork checklist task
  const checklists = engagement.checklists ?? [];
  const totalChecklists = checklists.length;
  const testedChecklists = checklists.filter((c) => c.result !== 'not_tested').length;
  const checklistsDone = totalChecklists > 0 && testedChecklists === totalChecklists;

  // Computing stats for working papers task
  const wps = engagement.workingPapers ?? [];
  const totalWps = wps.length;
  const approvedWps = wps.filter((w) => w.status === 'approved').length;
  const wpsDone = totalWps > 0 && approvedWps === totalWps;

  // Computing stats for reporting tasks
  const report = engagement.report;
  const reportExists = !!report;
  const reportApproved = report?.status === 'approved' || report?.status === 'issued';
  const reportIssued = report?.status === 'issued';

  // Computing stats for remediation tasks
  const findings = engagement.findings ?? [];
  const totalFindings = findings.length;
  const openFindings = findings.filter((f) => f.status !== 'closed' && f.status !== 'verified').length;
  const findingsDone = totalFindings > 0 && openFindings === 0;

  // Generate dynamic tasks list based on current active status
  const getActiveTasks = () => {
    switch (engagement.status) {
      case 'planned':
        return [
          {
            label: 'Assign Lead Auditor, Audit Manager, and Auditee',
            done: !!(engagement.leadAuditorId && engagement.auditManagerId && engagement.auditeeId),
            hint: `Lead: ${engagement.leadAuditorName ?? 'None'}, Manager: ${engagement.auditManagerName ?? 'None'}, Auditee: ${engagement.auditeeName ?? 'None'}`
          },
          {
            label: 'Define scope start date, end date, and SLA deadline',
            done: !!(engagement.plannedStartDate && engagement.plannedEndDate && engagement.slaDeadline),
            hint: `Start: ${engagement.plannedStartDate ? new Date(engagement.plannedStartDate).toLocaleDateString() : 'None'}, SLA: ${engagement.slaDeadline ? new Date(engagement.slaDeadline).toLocaleDateString() : 'None'}`
          },
        ];
      case 'in_progress':
        return [
          {
            label: `Test all compliance control checklists (${testedChecklists}/${totalChecklists} completed)`,
            done: checklistsDone,
            hint: totalChecklists === 0 
              ? 'No checklists are populated. Ensure checklists are initialized for this engagement type.' 
              : 'Complete testing of every control reference in the Checklists tab.'
          },
          {
            label: `Submit and approve all working papers (${approvedWps}/${totalWps} approved)`,
            done: wpsDone,
            hint: totalWps === 0
              ? 'At least one working paper is required to progress. Create one in the Working Papers tab.'
              : 'Submit draft working papers for manager approval.'
          },
          {
            label: 'Resolve open QA / manager review comments',
            done: totalWps > 0 && wps.filter((w) => w.status === 'rejected').length === 0,
            hint: 'Ensure there are no rejected working papers awaiting revision.'
          }
        ];
      case 'under_review':
        return [
          {
            label: 'Create the Audit Report draft',
            done: reportExists,
            hint: reportExists ? 'Report draft has been created.' : 'Generate the draft report in the Report tab.'
          },
          {
            label: 'Submit and obtain supervisor and CAE sign-off',
            done: reportApproved,
            hint: reportExists 
              ? `Current report status: ${humanizeStatus(report.status)}.` 
              : 'Submit draft report for approval chain reviews.'
          },
          {
            label: 'Formally issue final report to auditees',
            done: reportIssued,
            hint: reportApproved 
              ? 'CAE must click "Issue Report" to distribute it to the auditee.' 
              : 'The report must be approved before it can be issued.'
          }
        ];
      case 'reported':
        return [
          {
            label: 'Auditee submits remediation management action plans',
            done: findings.length > 0 && findings.filter((f) => f.status === 'open').length === 0,
            hint: `${findings.filter((f) => f.status === 'open').length}/${totalFindings} findings awaiting management response.`
          },
          {
            label: `Remediate and verify all raised findings (${totalFindings - openFindings}/${totalFindings} resolved)`,
            done: findingsDone,
            hint: openFindings > 0 
              ? 'Auditee must upload remediation evidence, and auditor must verify and close the findings.' 
              : 'All findings resolved.'
          },
        ];
      case 'closed':
      default:
        return [];
    }
  };

  const tasks = getActiveTasks();
  const allTasksDone = tasks.length > 0 && tasks.every((t) => t.done);
  const nextStatus = nextEngagementStatus(engagement.status);
  const progressPercent = Math.round((activeIndex / (STAGES.length - 1)) * 100);

  return (
    <Card className="mb-6 p-4 border border-border shadow-sm bg-surface-elevated/70 backdrop-blur-sm transition-all duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Badge tone={activeIndex === 4 ? 'green' : 'blue'} className="px-2.5 py-0.5 text-xs font-semibold">
            {humanizeStatus(engagement.status)}
          </Badge>
          <span className="text-xs text-text-secondary font-medium">
            Active Stage: <strong className="text-text-primary">{STAGES[activeIndex]?.label}</strong>
          </span>
        </div>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="flex items-center gap-1 text-[11px] font-semibold text-primary hover:text-primary-hover transition-colors"
        >
          {isOpen ? (
            <>
              Hide Guide <ChevronUp className="h-3.5 w-3.5" />
            </>
          ) : (
            <>
              Show Guide <ChevronDown className="h-3.5 w-3.5" />
            </>
          )}
        </button>
      </div>

      {/* Stepper Graphic */}
      <div className="relative mt-5 mb-3 px-4">
        {/* Connection Bar */}
        <div className="absolute top-[18px] left-[32px] right-[32px] h-[2px] bg-slate-200 dark:bg-slate-700 -z-10">
          <div
            className="h-full bg-primary transition-all duration-500 ease-out"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Nodes */}
        <div className="flex justify-between items-center">
          {STAGES.map((stage, idx) => {
            const isCompleted = idx < activeIndex;
            const isActive = idx === activeIndex;
            const isUpcoming = idx > activeIndex;
            const Icon = stage.icon;

            return (
              <div key={stage.key} className="flex flex-col items-center max-w-[120px] text-center group">
                <div
                  className={cn(
                    'h-9 w-9 rounded-full flex items-center justify-center border-2 transition-all duration-300',
                    isCompleted && 'bg-emerald-500 border-emerald-500 text-white shadow-sm',
                    isActive && 'bg-primary border-primary text-white shadow-md scale-110 ring-4 ring-primary/20 animate-pulse-subtle',
                    isUpcoming && 'bg-surface border-slate-300 dark:border-slate-600 text-text-muted hover:border-slate-400'
                  )}
                  title={`${stage.label}: ${stage.description}`}
                >
                  {isCompleted ? <Check className="h-4.5 w-4.5 stroke-[3]" /> : <Icon className="h-4.5 w-4.5" />}
                </div>
                <span
                  className={cn(
                    'mt-2 text-[10px] font-semibold tracking-tight transition-colors',
                    isCompleted && 'text-text-primary',
                    isActive && 'text-primary font-bold',
                    isUpcoming && 'text-text-muted'
                  )}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Guide Panel */}
      {isOpen && (
        <div className="mt-4 pt-3 border-t border-border/80 transition-all duration-300 animate-fadeIn">
          {engagement.status === 'closed' ? (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 text-emerald-800 dark:text-emerald-300 border border-emerald-200/50">
              <Check className="h-5 w-5 stroke-[2.5] shrink-0" />
              <div className="text-xs">
                <h4 className="font-semibold">Engagement Completed</h4>
                <p className="mt-0.5 opacity-90">All audit checklists have been verified, working papers approved, report issued, and findings remediated. This engagement file is fully closed.</p>
              </div>
            </div>
          ) : (
            <div>
              <h4 className="text-xs font-semibold text-text-primary flex items-center gap-1.5 mb-2.5">
                <Info className="h-3.5 w-3.5 text-primary" />
                Task List for {STAGES[activeIndex]?.label}
              </h4>
              <ul className="space-y-2.5 pl-1">
                {tasks.map((task, idx) => (
                  <li key={idx} className="flex items-start gap-2.5 text-xs">
                    <div
                      className={cn(
                        'mt-0.5 h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-colors',
                        task.done
                          ? 'bg-emerald-500 border-emerald-500 text-white'
                          : 'border-slate-300 dark:border-slate-600 bg-surface'
                      )}
                    >
                      {task.done && <Check className="h-3 w-3 stroke-[3]" />}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className={cn('font-medium text-text-primary', task.done && 'line-through opacity-60')}>
                        {task.label}
                      </span>
                      {task.hint && (
                        <span className="text-[10px] text-text-secondary mt-0.5">
                          {task.hint}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>

              {/* Transition Enforcements Banner */}
              <div className="mt-4 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/10 border border-amber-200/40 text-[11px] text-amber-800 dark:text-amber-300 flex gap-2">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-500" />
                <div>
                  <span className="font-semibold">Status Transition Rules:</span>{' '}
                  {engagement.status === 'planned' && (
                    <span>Requires complete team assignment and timeline settings before starting the fieldwork phase.</span>
                  )}
                  {engagement.status === 'in_progress' && (
                    <span>Requires all checklists tested ({testedChecklists}/{totalChecklists}) and all working papers approved ({approvedWps}/{totalWps}) before you can submit the engagement for Quality Review.</span>
                  )}
                  {engagement.status === 'under_review' && (
                    <span>Requires a finalized audit report to be approved by the CAE and issued to the auditee.</span>
                  )}
                  {engagement.status === 'reported' && (
                    <span>Requires all findings ({totalFindings}) to be verified as resolved and closed before closing the engagement.</span>
                  )}
                </div>
              </div>

              {/* Lifecycle Transition Button */}
              {canAdvance && nextStatus && onAdvance && (
                <div className="mt-4">
                  <Button
                    className="w-full"
                    onClick={onAdvance}
                    isLoading={isAdvancing}
                    disabled={!allTasksDone && !isAdvancing}
                    title={
                      !allTasksDone
                        ? 'Complete all tasks above before advancing'
                        : undefined
                    }
                  >
                    Move to {humanizeStatus(nextStatus)}
                  </Button>
                  {!allTasksDone && (
                    <p className="mt-1.5 text-center text-[11px] text-text-muted">
                      Complete all tasks above to unlock this action.
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
