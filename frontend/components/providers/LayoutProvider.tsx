'use client';

import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

import { DEFAULT_OPEN_GROUPS } from '@/lib/navigation';

interface LayoutContextType {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  toggleSidebar: () => void;
  isCollapsed: boolean;
  setIsCollapsed: (isCollapsed: boolean) => void;
  toggleCollapse: () => void;
  /** Sidebar groups the user has expanded — persisted across sessions. */
  openGroups: string[];
  toggleGroup: (label: string) => void;
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

const LayoutContext = createContext<LayoutContextType | undefined>(undefined);

const COLLAPSED_KEY = 'iams.sidebar.collapsed';
const GROUPS_KEY = 'iams.sidebar.groups';

/** localStorage is unavailable during SSR and in locked-down browsers. */
const readStored = <T,>(key: string, fallback: T): T => {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
};

const writeStored = (key: string, value: unknown): void => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota or private mode — preference just won't persist */
  }
};

export function LayoutProvider({ children }: { children: React.ReactNode }): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  // Start from the SSR-safe default, then hydrate from storage in an effect so
  // server and first client render agree.
  const [isCollapsed, setIsCollapsed] = useState(false);
  // The daily-path groups start open so nothing needs a click to be found. A
  // stored preference (including a deliberately empty one) overrides this.
  const [openGroups, setOpenGroups] = useState<string[]>(DEFAULT_OPEN_GROUPS);
  const [hydrated, setHydrated] = useState(false);
  const pathname = usePathname();

  useEffect(() => {
    setIsCollapsed(readStored(COLLAPSED_KEY, false));
    setOpenGroups(readStored<string[] | null>(GROUPS_KEY, null) ?? DEFAULT_OPEN_GROUPS);
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated) writeStored(COLLAPSED_KEY, isCollapsed);
  }, [isCollapsed, hydrated]);

  useEffect(() => {
    if (hydrated) writeStored(GROUPS_KEY, openGroups);
  }, [openGroups, hydrated]);

  // Automatically close the mobile sidebar drawer on navigation/route change
  useEffect(() => {
    setIsOpen(false);
  }, [pathname]);

  const toggleSidebar = useCallback(() => setIsOpen((prev) => !prev), []);
  const toggleCollapse = useCallback(() => setIsCollapsed((prev) => !prev), []);
  const toggleGroup = useCallback((label: string) => {
    setOpenGroups((prev) =>
      prev.includes(label) ? prev.filter((l) => l !== label) : [...prev, label],
    );
  }, []);

  return (
    <LayoutContext.Provider
      value={{
        isOpen,
        setIsOpen,
        toggleSidebar,
        isCollapsed,
        setIsCollapsed,
        toggleCollapse,
        openGroups,
        toggleGroup,
        commandPaletteOpen,
        setCommandPaletteOpen,
      }}
    >
      {children}
    </LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextType {
  const context = useContext(LayoutContext);
  if (!context) {
    throw new Error('useLayout must be used within a LayoutProvider');
  }
  return context;
}
