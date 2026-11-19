'use client';

import { BookOpen, Download } from 'lucide-react';

import { useSession } from '@/components/providers/AuthProvider';
import { Card } from '@/components/ui/Card';
import { cn } from '@/lib/utils/cn';

interface Guide {
  role: string;
  title: string;
  file: string;
  blurb: string;
  pages: string;
}

const GUIDES: Guide[] = [
  { role: 'financial_auditor', title: 'Financial Auditor guide', file: 'IAMS_Manual_Financial_Auditor.pdf', pages: '45 pages', blurb: 'From signing in to a full financial audit, alone or with a team.' },
  { role: 'system_auditor', title: 'System Auditor guide', file: 'IAMS_Manual_System_Auditor.pdf', pages: '47 pages', blurb: 'From signing in to a full systems audit, with the System Audit toolkit.' },
  { role: 'compliance_auditor', title: 'Compliance Auditor guide', file: 'IAMS_Manual_Compliance_Auditor.pdf', pages: '45 pages', blurb: 'From signing in to a full compliance audit, with the Control Library.' },
  { role: 'head_internal_audit', title: 'Head of Internal Audit guide', file: 'IAMS_Manual_Head_of_Internal_Audit.pdf', pages: '21 pages', blurb: 'Watching every audit, approving programmes and signing reports.' },
  { role: 'dg', title: 'Director General guide', file: 'IAMS_Manual_Director_General.pdf', pages: '17 pages', blurb: 'Reading and signing the reports sent to you.' },
  { role: 'auditee', title: 'Auditee guide', file: 'IAMS_Manual_Auditee.pdf', pages: '15 pages', blurb: 'Sending the documents asked of you and responding to findings.' },
];

/** Downloadable PDF guides, one per role. The signed-in person's own guide is shown first and highlighted. */
export const RoleGuides = ({ className }: { className?: string }): JSX.Element => {
  const session = useSession();
  const mine = GUIDES.filter((g) => session.roles.includes(g.role));
  const others = GUIDES.filter((g) => !session.roles.includes(g.role));
  const ordered = [...mine, ...others];

  return (
    <Card padded className={className}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <BookOpen className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-text-primary">Guides you can download (PDF)</p>
          <p className="mt-0.5 text-xs text-text-secondary">
            A short, step-by-step guide for each role, with a picture of every screen and every permission explained.
            {mine.length > 0 ? ' Yours is shown first.' : ''}
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {ordered.map((g) => {
              const isMine = session.roles.includes(g.role);
              return (
                <li key={g.file}>
                  <a
                    href={`/manuals/${g.file}`}
                    download
                    className={cn(
                      'flex items-start gap-2 rounded-lg border px-3 py-2 text-left transition hover:bg-surface-alt',
                      isMine ? 'border-primary bg-primary/5' : 'border-border bg-white',
                    )}
                  >
                    <Download className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-text-primary">
                        {g.title}
                        {isMine && <span className="ml-1.5 rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-primary">Yours</span>}
                      </span>
                      <span className="block text-xs text-text-secondary">{g.blurb}</span>
                      <span className="block text-[11px] text-text-muted">{g.pages}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </Card>
  );
};
