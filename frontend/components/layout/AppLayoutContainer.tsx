'use client';

import React from 'react';
import { useLayout } from '@/components/providers/LayoutProvider';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { cn } from '@/lib/utils/cn';

export const AppLayoutContainer = ({
  children,
}: {
  children: React.ReactNode;
}): JSX.Element => {
  const { isCollapsed } = useLayout();

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar />
      <div
        className={cn(
          'flex w-full flex-col transition-[padding] duration-200 ease-out',
          isCollapsed ? 'lg:pl-16' : 'lg:pl-60',
        )}
      >
        <Header />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
};
