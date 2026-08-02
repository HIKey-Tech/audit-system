'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { LogOut, ChevronsLeft, ChevronsRight, ChevronDown } from 'lucide-react';
import { toast } from 'sonner';

import { cn } from '@/lib/utils/cn';
import { initialsFromName } from '@/lib/utils/format';
import { authApi } from '@/lib/api/auth';
import { notificationsApi } from '@/lib/api/notifications';
import { useSession } from '@/components/providers/AuthProvider';
import { Avatar } from '@/components/ui/Avatar';
import { Tooltip } from '@/components/ui/Tooltip';
import { usePermissions } from '@/lib/hooks/usePermissions';
import { useLayout } from '@/components/providers/LayoutProvider';
import { NAV, type NavGroup, type NavItem, type NavLink } from '@/lib/navigation';

export const Sidebar = (): JSX.Element => {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const { nav } = usePermissions();
  const {
    isOpen,
    setIsOpen,
    isCollapsed,
    setIsCollapsed,
    toggleCollapse,
    openGroups,
    toggleGroup,
  } = useLayout();
  const [signingOut, setSigningOut] = useState(false);

  const { data: unread } = useQuery({
    queryKey: ['notifications', 'unread-count'],
    queryFn: () => notificationsApi.unreadCount(),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });

  // Filter nav items based on role visibility. For groups, drop hidden children
  // and remove the whole group if nothing remains visible.
  const visibleNav = useMemo(() => {
    return NAV.map((item) => {
      if (item.type === 'group') {
        const children = item.children.filter((c) => !c.visKey || nav[c.visKey]);
        return children.length ? { ...item, children } : null;
      }
      if (!item.visKey || nav[item.visKey]) return item;
      return null;
    }).filter((item): item is NavItem => item !== null);
  }, [nav]);

  const isActive = (item: NavLink): boolean => {
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

  const renderLink = (item: NavLink, indented = false): JSX.Element => {
    const Icon = item.icon;
    const active = isActive(item);
    const unreadCount = item.badgeKey === 'notifications' ? (unread?.unread ?? 0) : 0;

    return (
      <li key={item.href}>
        <Tooltip content={item.description} side="right">
          <Link
            href={item.href}
            className={cn(
              'group relative flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              active
                ? 'bg-white text-primary'
                : 'text-white/85 hover:bg-white/10 hover:text-white',
              indented && 'pl-9',
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
        </Tooltip>
      </li>
    );
  };

  const renderGroup = (item: NavGroup): JSX.Element => {
    const Icon = item.icon;
    const hasActiveChild = item.children.some((child) => isActive(child));
    const expanded = openGroups.includes(item.label) || hasActiveChild;

    const onParentClick = () => {
      // When the sidebar is icon-collapsed, expand it first so the children are usable.
      if (isCollapsed) {
        setIsCollapsed(false);
        if (!openGroups.includes(item.label)) toggleGroup(item.label);
        return;
      }
      toggleGroup(item.label);
    };

    return (
      <li key={`group-${item.label}`}>
        <Tooltip content={item.description} side="right">
          <button
            type="button"
            onClick={onParentClick}
            aria-expanded={expanded}
            className={cn(
              'group relative flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
              hasActiveChild ? 'text-white' : 'text-white/85 hover:bg-white/10 hover:text-white',
              isCollapsed && 'lg:justify-center lg:px-0',
            )}
            title={isCollapsed ? item.label : undefined}
          >
            {hasActiveChild && !isCollapsed && (
              <span
                className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r bg-accent lg:block hidden"
                aria-hidden
              />
            )}
            <Icon
              className={cn('h-4 w-4 shrink-0', hasActiveChild ? 'text-accent' : 'text-white')}
              aria-hidden
            />
            <span className={cn('flex-1 truncate text-left', isCollapsed && 'lg:hidden')}>{item.label}</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 transition-transform duration-200',
                expanded && 'rotate-180',
                isCollapsed && 'lg:hidden',
              )}
              aria-hidden
            />
            {isCollapsed && hasActiveChild && (
              <span className="absolute -right-0 -top-0 h-2 w-2 rounded-full bg-accent lg:block hidden" />
            )}
          </button>
        </Tooltip>
        {expanded && (
          <ul className={cn('mt-0.5 space-y-0.5', isCollapsed && 'lg:hidden')}>
            {item.children.map((child) => renderLink(child, true))}
          </ul>
        )}
      </li>
    );
  };

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
            {visibleNav.map((item) =>
              item.type === 'group' ? renderGroup(item) : renderLink(item),
            )}
          </ul>
        </nav>

        {/* User block */}
        <div className="border-t border-white/10 px-3 py-3">
          <div className={cn('flex items-center gap-3', isCollapsed && 'lg:hidden')}>
            <Link
              href="/profile"
              className="flex min-w-0 flex-1 items-center gap-3 rounded-md py-1 pr-2 hover:bg-white/10"
            >
              <Avatar initials={initials} tone="green" size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold">
                  {session.displayName || `${session.firstName} ${session.lastName}`}
                </p>
                <p className="truncate text-[10px] uppercase tracking-wider text-white/60">
                  {primaryRole.replace(/_/g, ' ')}
                </p>
              </div>
            </Link>
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
              <Link href="/profile" aria-label="Profile" className="rounded-full hover:ring-2 hover:ring-white/20">
                <Avatar initials={initials} tone="green" size="sm" />
              </Link>
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
