'use client';

/**
 * State the app shell owns and one page reads back.
 *
 * The global search box lives in the top bar, but the thing it filters -- the
 * bid-package table -- lives in a route. Rather than duplicate a search input
 * per page or push the query into the URL (which would make every keystroke a
 * history entry on a static export), the shell holds the query and the
 * Bid Packages route subscribes to it.
 */

import { createContext, useContext, useState, type ReactNode } from 'react';

interface ShellValue {
  query: string;
  setQuery: (q: string) => void;
}

const ShellContext = createContext<ShellValue | null>(null);

export function ShellProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  return <ShellContext.Provider value={{ query, setQuery }}>{children}</ShellContext.Provider>;
}

export function useShell(): ShellValue {
  const ctx = useContext(ShellContext);
  if (!ctx) throw new Error('useShell must be used inside ShellProvider');
  return ctx;
}
