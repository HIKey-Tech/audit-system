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
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { humanizeStatus } from '@/lib/utils/status';
import type { AuditEngagementDetail } from '@/lib/types/domain';
import { WhatsNextPanel } from './WhatsNextPanel';

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
    description: 'Review fieldwork and obtain report sign-offs.',
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
}

export const StatusStepper = ({ engagement }: StatusStepperProps): JSX.Element => {
  const [isOpen, setIsOpen] = useState(true);
  const activeIndex = STAGES.findIndex((s) => s.key === engagement.status);
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

      {/* What's next */}
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
            <WhatsNextPanel engagement={engagement} />
          )}
        </div>
      )}
    </Card>
  );
};
