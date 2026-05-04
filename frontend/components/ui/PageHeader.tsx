import Link from 'next/link';
import { ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Crumb {
  label: string;
  href?: string;
}

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  breadcrumbs?: Crumb[];
  className?: string;
}

export const PageHeader = ({
  title,
  subtitle,
  actions,
  breadcrumbs,
  className,
}: PageHeaderProps): JSX.Element => (
  <div className={cn('mb-6', className)}>
    {breadcrumbs && breadcrumbs.length > 0 && (
      <nav className="mb-2 flex items-center gap-1 text-xs text-text-secondary">
        {breadcrumbs.map((c, i) => (
          <span key={i} className="flex items-center gap-1">
            {c.href ? (
              <Link
                href={c.href}
                className="hover:text-primary transition-colors"
              >
                {c.label}
              </Link>
            ) : (
              <span className="text-text-primary">{c.label}</span>
            )}
            {i < breadcrumbs.length - 1 && (
              <ChevronRight className="h-3 w-3" aria-hidden />
            )}
          </span>
        ))}
      </nav>
    )}
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        )}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  </div>
);
