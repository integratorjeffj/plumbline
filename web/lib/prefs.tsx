'use client';

/**
 * Global, project-independent UI preferences: theme and data-source mode.
 *
 * Split out from the project-scoped store (./store.tsx) because these two
 * kinds of state have genuinely different lifetimes. A reviewer's dark-mode
 * preference and demo/live toggle are UI chrome that should survive
 * switching between bid packages; review decisions and scope weights are
 * specific to one package and must not bleed into another. This provider
 * wraps the whole app, above the Directory route too, since the directory
 * needs the theme toggle without ever loading a project.
 */

import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'plumbline.console.v1.prefs';

export type SourceMode = 'demo' | 'live';
export type Theme = 'light' | 'dark';

interface Prefs {
  theme: Theme;
  mode: SourceMode;
}

interface PrefsValue extends Prefs {
  setTheme: (theme: Theme) => void;
  setMode: (mode: SourceMode) => void;
}

const PrefsContext = createContext<PrefsValue | null>(null);

function defaultPrefs(): Prefs {
  return { theme: 'light', mode: 'demo' };
}

export function PrefsProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Prefs>(defaultPrefs);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) setPrefs((p) => ({ ...p, ...JSON.parse(raw) }));
    } catch {
      // A corrupt or blocked store is not worth failing the app over; the
      // console simply opens at its defaults.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* private browsing, quota, etc. */
    }
  }, [prefs]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', prefs.theme);
  }, [prefs.theme]);

  const value: PrefsValue = {
    ...prefs,
    setTheme: (theme) => setPrefs((p) => ({ ...p, theme })),
    setMode: (mode) => setPrefs((p) => ({ ...p, mode })),
  };

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs(): PrefsValue {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error('usePrefs must be used inside PrefsProvider');
  return ctx;
}
