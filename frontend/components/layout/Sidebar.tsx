'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  LayoutDashboard,
  BarChart3,
  Globe,
  ClipboardList,
  Briefcase,
  AlertTriangle,
  FileText,
  ShieldAlert,
  GitBranch,
  FolderOpen,
  Bell,
  ScrollText,
  Plug,
  Brain,
  Settings,
  LogOut,
  ChevronsLeft,
  ChevronsRight,
  Users,
} from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils/cn';
import { initialsFromName } from '@/lib/utils/format';
import { authApi } from '@/lib/api/auth';
import { notificationsApi } from '@/lib/api/notifications';
import { useSession } from '@/components/providers/AuthProvider';
import { Avatar } from '@/components/ui/Avatar';
import { usePermissions, type NavVisibility } from '@/lib/hooks/usePermissions';
import { useLayout } from '@/components/providers/LayoutProvider';

interface NavLink {
  type: 'link';
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  badgeKey?: 'notifications';
  comingSoon?: boolean;
  matchPrefix?: string;
  /** Key into NavVisibility — if set the item is hidden when the value is false. */
  visKey?: keyof NavVisibility;
}

interface NavDivider {
  type: 'divider';
  label?: string;
  /** If provided, hide this divider when ALL listed visKeys are false. */
  sectionKeys?: (keyof NavVisibility)[];
}

type NavItem = NavLink | NavDivider;

const NAV: NavItem[] = [
  { type: 'link', label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard, visKey: 'dashboard' },
  { type: 'link', label: 'Analytics', href: '/analytics', icon: BarChart3, matchPrefix: '/analytics', visKey: 'analytics' },

  { type: 'divider', label: 'Audit', sectionKeys: ['auditUniverse', 'auditPlans', 'engagements', 'findings', 'reports'] },
  { type: 'link', label: 'Audit Universe', href: '/audit/universe', icon: Globe, matchPrefix: '/audit/universe', visKey: 'auditUniverse' },
  { type: 'link', label: 'Audit Plans', href: '/audit/plans', icon: ClipboardList, matchPrefix: '/audit/plans', visKey: 'auditPlans' },
  { type: 'link', label: 'Engagements', href: '/audit/engagements', icon: Briefcase, matchPrefix: '/audit/engagements', visKey: 'engagements' },
  { type: 'link', label: 'Findings', href: '/audit/findings', icon: AlertTriangle, matchPrefix: '/audit/findings', visKey: 'findings' },
  { type: 'link', label: 'Reports', href: '/audit/reports', icon: FileText, matchPrefix: '/audit/reports', visKey: 'reports' },

  { type: 'divider', label: 'Risk & Workflow', sectionKeys: ['riskRegister', 'workflow'] },
  { type: 'link', label: 'Risk Register', href: '/risk', icon: ShieldAlert, matchPrefix: '/risk', visKey: 'riskRegister' },
  { type: 'link', label: 'Workflow', href: '/workflow', icon: GitBranch, matchPrefix: '/workflow', visKey: 'workflow' },

  { type: 'divider', label: 'System', sectionKeys: ['documents', 'notifications', 'auditLogs', 'users'] },
  { type: 'link', label: 'Documents', href: '/documents', icon: FolderOpen, matchPrefix: '/documents', visKey: 'documents' },
  { type: 'link', label: 'Notifications', href: '/notifications', icon: Bell, badgeKey: 'notifications', visKey: 'notifications' },
  { type: 'link', label: 'Audit Logs', href: '/logs', icon: ScrollText, matchPrefix: '/logs', visKey: 'auditLogs' },
  { type: 'link', label: 'Users', href: '/users', icon: Users, matchPrefix: '/users', visKey: 'users' },

  { type: 'divider', sectionKeys: ['integrations', 'predictive', 'settings'] },
  { type: 'link', label: 'Integrations', href: '/integrations', icon: Plug, comingSoon: true, visKey: 'integrations' },
  { type: 'link', label: 'Predictive', href: '/predictive', icon: Brain, comingSoon: true, visKey: 'predictive' },
  { type: 'link', label: 'Settings', href: '/settings', icon: Settings, comingSoon: true, visKey: 'settings' },
];

export const Sidebar = (): JSX.Element => {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const { nav } = usePermissions();
  const { isOpen, setIsOpen, isCollapsed, toggleCollapse } = useLayout();
  const [signingOut, setSigningOut] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Filter nav items based on role visibility
  const visibleNav = useMemo(() => {
    return NAV.filter((item) => {
      if (item.type === 'link') {
        // If no visKey, always show
        if (!item.visKey) return true;
        return nav[item.visKey];
      }
      // Divider: show if at least one child section key is visible
      if (item.sectionKeys) {
        return item.sectionKeys.some((k) => nav[k]);
      }
      // Dividers without section keys — show
      return true;
    });
  }, [nav]);

  const isActive = (item: NavLink) => {
    if (item.matchPrefix) return pathname?.startsWith(item.matchPrefix) ?? false;
    return pathname === item.href;
  };

  const onLogout = async () => {
    try {
      setSigningOut(true);
      await authApi.logout();
      router.push('/login');
      router.refresh();
    } catch {
      toast.error('Could not sign out');
      setSigningOut(false);
    }
  };

  const initials = initialsFromName(session.firstName, session.lastName, session.displayName);
  const primaryRole = session.roles[0] ?? 'viewer';

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-20 bg-slate-900/40 lg:hidden"
          onClick={() => setIsOpen(false)}
          aria-hidden="true"
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-30 flex flex-col bg-primary text-white shadow-sidebar',
          'transition-all duration-200 ease-out',
          isCollapsed ? 'lg:w-16' : 'lg:w-60',
          isOpen ? 'translate-x-0 w-60' : '-translate-x-full lg:translate-x-0',
        )}
      >
        {/* Brand */}
        <div className={cn('flex items-center justify-between px-4 h-16 border-b border-white/10', isCollapsed && 'lg:justify-center lg:px-0')}>
          {!isCollapsed ? (
            <Link href="/dashboard" className="flex flex-col leading-tight">
              <span className="text-lg font-bold tracking-tight">GBB</span>
              <span className="text-[10px] font-semibold tracking-widest text-accent uppercase">
                IAMS
              </span>
            </Link>
          ) : (
            <Link href="/dashboard" className="text-lg font-bold tracking-tight lg:block hidden">
              GBB
            </Link>
          )}
          {/* Mobile brand (always expanded display when visible on mobile) */}
          <Link href="/dashboard" className="flex flex-col leading-tight lg:hidden">
            <span className="text-lg font-bold tracking-tight">GBB</span>
            <span className="text-[10px] font-semibold tracking-widest text-accent uppercase">
              IAMS
            </span>
          </Link>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-3 scrollbar-thin">
          <ul className="space-y-0.5 px-2">
            {visibleNav.map((item, i) => {
              if (item.type === 'divider') {
                return (
                  <li key={`div-${i}`} className="px-2 pt-4 pb-1">
                    {!isCollapsed && item.label && (
                      <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">
                        {item.label}
                      </span>
                    )}
                    {((isCollapsed && !item.label) || (!item.label)) && (
                      <div className="border-t border-white/10" />
                    )}
                  </li>
                );
              }

              const Icon = item.icon;
              const active = isActive(item);
              const unreadCount =
                item.badgeKey === 'notifications' ? (unread?.unread ?? 0) : 0;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                      active
                        ? 'bg-white text-primary'
                        : 'text-white/85 hover:bg-white/10 hover:text-white',
                      isCollapsed && 'lg:justify-center lg:px-0',
                    )}
                    title={isCollapsed ? item.label : undefined}
                  >
                    {active && !isCollapsed && (
                      <span
                        className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accent lg:block hidden"
                        aria-hidden
                      />
                    )}
                    <Icon
                      className={cn('h-4 w-4 shrink-0', active ? 'text-primary' : 'text-white')}
                      aria-hidden
                    />
                    {/* Always show text on mobile, hide only on desktop collapsed */}
                    <span className={cn('flex-1 truncate', isCollapsed && 'lg:hidden')}>{item.label}</span>
                    {item.comingSoon && (
                      <span className={cn('text-[9px] font-semibold uppercase tracking-wide text-white/50', isCollapsed && 'lg:hidden')}>
                        Soon
                      </span>
                    )}
                    {!item.comingSoon && unreadCount > 0 && (
                      <span className={cn('inline-flex h-4 min-w-[18px] items-center justify-center rounded-full bg-accent px-1.5 text-[10px] font-semibold', isCollapsed && 'lg:hidden')}>
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                    {isCollapsed && unreadCount > 0 && (
                      <span className="absolute -right-0 -top-0 h-2 w-2 rounded-full bg-accent lg:block hidden" />
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {/* User block */}
        <div className="border-t border-white/10 px-3 py-3">
          <div className={cn('flex items-center gap-3', isCollapsed && 'lg:hidden')}>
            <Avatar initials={initials} tone="green" size="sm" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold">
                {session.displayName || `${session.firstName} ${session.lastName}`}
              </p>
              <p className="truncate text-[10px] uppercase tracking-wider text-white/60">
                {primaryRole.replace(/_/g, ' ')}
              </p>
            </div>
            <button
              type="button"
              onClick={onLogout}
              disabled={signingOut}
              aria-label="Sign out"
              className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>

          {isCollapsed && (
            <div className="flex-col items-center gap-2 lg:flex hidden">
              <Avatar initials={initials} tone="green" size="sm" />
              <button
                type="button"
                onClick={onLogout}
                disabled={signingOut}
                aria-label="Sign out"
                className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white disabled:opacity-50"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={toggleCollapse}
            className={cn(
              'mt-3 flex w-full items-center justify-center gap-2 rounded-md py-1.5 text-[11px] font-medium text-white/60 hover:bg-white/10 hover:text-white',
              'lg:flex hidden',
            )}
          >
            {isCollapsed ? (
              <ChevronsRight className="h-3.5 w-3.5" />
            ) : (
              <>
                <ChevronsLeft className="h-3.5 w-3.5" />
                <span>Collapse</span>
              </>
            )}
          </button>
        </div>
      </aside>
    </>
  );
};
