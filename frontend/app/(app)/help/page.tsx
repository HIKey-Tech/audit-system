import Link from 'next/link';
import {
  Globe,
  ClipboardList,
  Briefcase,
  AlertTriangle,
  FileText,
  RefreshCw,
  Inbox,
  Users,
  User,
  ShieldCheck,
  type LucideIcon,
} from 'lucide-react';

import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { RoleGuides } from '@/components/help/RoleGuides';

interface LifecycleStep {
  icon: LucideIcon;
  title: string;
  href: string;
  what: string;
  who: string;
  image?: { src: string; alt: string };
  more?: string;
}

// Static explainer page: no data fetching, the content is the product.
const STEPS: LifecycleStep[] = [
  {
    icon: Globe,
    title: '1. Audit Universe',
    href: '/audit/universe',
    what: 'The register of everything that can be audited: departments, units, systems, processes, assets and projects. Each entry has a risk score and a staff in charge, the Internal Audit person responsible for it. People named as staff in charge are told by email and in the app.',
    who: 'Auditors add and maintain entries. The people being audited are chosen later, when an audit starts.',
    image: { src: '/help/v2-fin-universe-list.jpg', alt: 'The Audit Universe with the staff in charge of each entity' },
  },
  {
    icon: ClipboardList,
    title: '2. Audit Programme',
    href: '/audit/plans',
    what: 'The yearly plan for one audit type. An auditor creates it, fills it straight from the universe with “Populate from Universe”, and submits it. It is approved before any audit can start from it.',
    who: 'Any auditor creates and submits. The Head of Internal Audit approves, then the Director General gives final approval.',
    image: { src: '/help/v2-fin-populate-universe.jpg', alt: 'Populate from Audit Universe' },
  },
  {
    icon: Briefcase,
    title: '3. Engagements (fieldwork)',
    href: '/audit/engagements',
    what: 'One engagement is one audit. Inside it you test controls, write working papers, collect evidence and raise findings. The audit moves forward by itself when its requirements are met; the only manual steps are “Start fieldwork” and issuing the report. You can do an audit alone or with a team (see below).',
    who: 'An auditor alone (a sole auditor), or a lead auditor with an audit manager and supporting auditors.',
    image: { src: '/help/v2-eng-overview.jpg', alt: 'The stage tracker, What’s next and the engagement tabs' },
    more: 'ch-sole',
  },
  {
    icon: AlertTriangle,
    title: '4. Findings',
    href: '/audit/findings',
    what: 'Problems raised during fieldwork, often straight from a failed control. Each is assigned to an auditee, who responds with a remediation plan and evidence. Findings stay inside the audit team until the report is issued.',
    who: 'Raised by auditors; answered by the auditee; verified and closed by the auditor.',
  },
  {
    icon: FileText,
    title: '5. Reports (the Review tab)',
    href: '/audit/reports',
    what: 'The report is drafted from the audit and sent for sign-off. A sole auditor’s report goes straight to the Head of Internal Audit; a team’s report is approved by the audit manager first. The auditor chooses one level or two (Head only, or Head then Director General).',
    who: 'Drafted by the lead auditor; signed through the chain; issued by the Head of Internal Audit.',
    image: { src: '/help/v2-sole-review-signoff.jpg', alt: 'Choosing one or two levels of sign-off' },
  },
  {
    icon: RefreshCw,
    title: '6. Follow-up & closure',
    href: '/audit/findings',
    what: 'After the report is issued, the auditee shows each finding has been fixed. The auditor verifies it and closes it. When every finding is closed, the audit closes.',
    who: 'The auditee remediates; the auditor verifies and closes.',
  },
];

interface RoleCard {
  icon: LucideIcon;
  title: string;
  lines: string[];
}

const ROLES: RoleCard[] = [
  {
    icon: User,
    title: 'Financial, System and Compliance Auditors',
    lines: [
      'Do the audits from start to finish: universe, programme, fieldwork, report, closure.',
      'See only the audits they are part of.',
      'Can work alone or with a team.',
    ],
  },
  {
    icon: ShieldCheck,
    title: 'Head of Internal Audit',
    lines: [
      'Never carries out an audit: oversight only.',
      'Sees every audit and is told when each is created, starts, changes stage or closes, with the people named.',
      'Approves programmes, signs reports and issues them.',
    ],
  },
  {
    icon: Inbox,
    title: 'Director General',
    lines: [
      'Never carries out an audit.',
      'Is told only when a report (or programme) needs final approval.',
      'Can look through the one audit sent to them to sign, read-only.',
    ],
  },
  {
    icon: Users,
    title: 'Auditee',
    lines: [
      'The person being audited; named when an audit starts and emailed.',
      'Sends the documents asked for, responds to findings and shows they are fixed.',
    ],
  },
];

export default function HelpPage(): JSX.Element {
  return (
    <div>
      <PageHeader
        title="How IAMS works"
        subtitle="The internal audit lifecycle, from planning to closure, who does what, and where each step lives."
      />

      <Card padded className="mb-4">
        <p className="text-sm text-text-secondary">
          IAMS follows one continuous flow. Nothing moves to the next stage by hand: the system advances an engagement
          automatically once the current stage&apos;s requirements are met, so if something looks stuck, open it and check
          the <span className="font-medium text-text-primary">What&apos;s next</span> panel. It names the exact requirement,
          and the person, the work is waiting on.
        </p>
      </Card>

      <h2 className="mb-2 mt-6 text-base font-semibold text-text-primary">Who does what</h2>
      <div className="mb-6 grid grid-cols-1 gap-3 md:grid-cols-2">
        {ROLES.map((r) => {
          const Icon = r.icon;
          return (
            <Card key={r.title} padded>
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text-primary">{r.title}</p>
                  <ul className="mt-1 list-disc space-y-0.5 pl-4 text-sm text-text-secondary">
                    {r.lines.map((l) => (
                      <li key={l}>{l}</li>
                    ))}
                  </ul>
                </div>
              </div>
            </Card>
          );
        })}
      </div>

      <h2 className="mb-2 text-base font-semibold text-text-primary">The six steps</h2>
      <ol className="space-y-3">
        {STEPS.map((s) => {
          const Icon = s.icon;
          return (
            <li key={s.title}>
              <Card padded>
                <div className="flex items-start gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4.5 w-4.5" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={s.href} className="text-sm font-semibold text-primary hover:underline">
                      {s.title}
                    </Link>
                    <p className="mt-1 text-sm text-text-secondary">{s.what}</p>
                    <p className="mt-1 text-xs text-text-muted">
                      <span className="font-semibold uppercase tracking-wider">Who:</span> {s.who}
                    </p>
                    {s.image && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={s.image.src}
                        alt={s.image.alt}
                        loading="lazy"
                        className="mt-3 w-full max-w-3xl rounded-md border border-border shadow-sm"
                      />
                    )}
                    {s.more && (
                      <Link href={`/help/center?a=${s.more}`} className="mt-2 inline-block text-xs font-medium text-primary hover:underline">
                        Step-by-step guide: working alone or with a team →
                      </Link>
                    )}
                  </div>
                </div>
              </Card>
            </li>
          );
        })}
      </ol>

      <h2 className="mb-2 mt-6 text-base font-semibold text-text-primary">Working alone or with a team</h2>
      <Card padded className="mb-4">
        <p className="text-sm text-text-secondary">
          When you start an audit you decide whether you will do it alone or with a team. The audit is the same either
          way; what changes is who reviews the work.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[34rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-text-muted">
                <th className="py-2 pr-3 font-semibold" />
                <th className="py-2 pr-3 font-semibold">Sole auditor</th>
                <th className="py-2 font-semibold">Team</th>
              </tr>
            </thead>
            <tbody className="align-top text-text-secondary">
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium text-text-primary">Audit manager</td>
                <td className="py-2 pr-3">None: you are lead and manager</td>
                <td className="py-2">Chosen when starting the audit</td>
              </tr>
              <tr className="border-b border-border/60">
                <td className="py-2 pr-3 font-medium text-text-primary">Working papers</td>
                <td className="py-2 pr-3">
                  Press <span className="font-medium">Mark complete</span>. No approval step.
                </td>
                <td className="py-2">
                  Press <span className="font-medium">Submit for review</span>. The audit manager approves.
                </td>
              </tr>
              <tr>
                <td className="py-2 pr-3 font-medium text-text-primary">Report sign-off</td>
                <td className="py-2 pr-3">Straight to the Head of Internal Audit (then the Director General, if you chose two levels)</td>
                <td className="py-2">The audit manager first, then the Head of Internal Audit (and the Director General, if two levels)</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/help/v2-wiz-3-review-sole.jpg" alt="A sole-auditor audit: Audit manager reads None: sole auditor" loading="lazy" className="w-full rounded-md border border-border shadow-sm" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/help/v2-sole-wp-mark-complete.jpg" alt="For a sole auditor the working paper button reads Mark complete" loading="lazy" className="w-full rounded-md border border-border shadow-sm" />
        </div>
      </Card>

      <Card padded className="mb-4">
        <div className="flex items-start gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <Inbox className="h-4.5 w-4.5" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text-primary">Approvals run alongside everything</p>
            <p className="mt-1 text-sm text-text-secondary">
              Programmes, team working papers and reports pass through the{' '}
              <Link href="/workflow/approvals" className="text-primary hover:underline">
                approvals inbox
              </Link>
              . When something reaches your level you get a notification (and an email). Open the item, read it with
              &ldquo;Review before signing&rdquo;, then Approve &amp; Sign or Reject with a reason. You can never approve
              something you submitted yourself.
            </p>
          </div>
        </div>
      </Card>

      <RoleGuides className="mb-4" />

      <Card padded>
        <p className="text-sm text-text-secondary">
          Want the full step-by-step with screenshots? Open the{' '}
          <Link href="/help/center" className="font-medium text-primary hover:underline">
            Help Centre
          </Link>{' '}
          and ask a question in your own words, or browse the guide.
        </p>
      </Card>
    </div>
  );
}
