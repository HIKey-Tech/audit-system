'use client';

import Link from 'next/link';
import {
  Plus,
  ClipboardList,
  AlertTriangle,
  ShieldAlert,
  CheckSquare,
  Send,
  FileUp,
  Boxes,
  type LucideIcon,
} from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { usePermissions } from '@/lib/hooks/usePermissions';

// Icon per action key — kept here (presentation) rather than in the permission
// layer (logic), so the action registry stays free of React concerns.
const ACTION_ICONS: Record<string, LucideIcon> = {
  'start-audit': Plus,
  'new-plan': ClipboardList,
  'raise-finding': AlertTriangle,
  'new-risk': ShieldAlert,
  'review-approvals': CheckSquare,
  'new-request': Send,
  'upload-document': FileUp,
  'new-asset': Boxes,
};

interface QuickActionsProps {
  /** Invoked when a `wizard` action (e.g. Start audit) is clicked. */
  onStartAudit?: () => void;
}

export const QuickActions = ({ onStartAudit }: QuickActionsProps): JSX.Element | null => {
  const { quickActions } = usePermissions();

  // Nothing to show for a permission-light user (e.g. pure auditee) — hide the
  // whole card rather than render an empty shell.
  if (quickActions.length === 0) return null;

  const tileClass =
    'group flex flex-col items-center justify-center gap-2 rounded-lg border border-border ' +
    'bg-surface-alt px-3 py-4 text-center transition-colors hover:border-primary-200 ' +
    'hover:bg-primary-50 focus-visible:outline-none focus-visible:ring-2 ' +
    'focus-visible:ring-primary/30 cursor-pointer';

  const iconWrapClass =
    'flex h-9 w-9 items-center justify-center rounded-md bg-white text-primary ' +
    'ring-1 ring-border transition-colors group-hover:bg-primary group-hover:text-white group-hover:ring-primary';

  const labelClass = 'text-xs font-medium text-text-primary';

  return (
    <Card>
      <CardHeader title="Quick Actions" subtitle="Jump straight to what you do most" />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {quickActions.map((action) => {
          const Icon = ACTION_ICONS[action.key] ?? Plus;

          if (action.wizard && onStartAudit) {
            return (
              <button
                key={action.key}
                type="button"
                onClick={onStartAudit}
                className={tileClass}
              >
                <span className={iconWrapClass}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className={labelClass}>{action.label}</span>
              </button>
            );
          }

          return (
            <Link key={action.key} href={action.href} className={tileClass}>
              <span className={iconWrapClass}>
                <Icon className="h-4 w-4" aria-hidden />
              </span>
              <span className={labelClass}>{action.label}</span>
            </Link>
          );
        })}
      </div>
    </Card>
  );
};
