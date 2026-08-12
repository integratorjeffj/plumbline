'use client';

/**
 * Console state: review decisions, scope weighting, and data-source mode.
 *
 * Persisted to localStorage so a reviewer can close the tab mid-package and
 * come back to their decisions. Reads are deferred to an effect because the app
 * is statically exported and the first render happens with no browser storage
 * available.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import pipeline from '@/data/pipeline.json';
import { defaultSettings, buildComparison, verifyAgainstPipeline, type LevelingSettings } from './leveling';
import { computeFindings } from './findings';
import type { Finding, Importance, PipelineData, ReviewStatus, ScopeStatus, VendorComparison } from './types';

const DATA = pipeline as unknown as PipelineData;

const STORAGE_KEY = 'plumbline.console.v1';

export type SourceMode = 'demo' | 'live';

export interface FieldDecision {
  status: ReviewStatus;
  /** Reviewer-supplied replacement, used when the extraction got it wrong. */
  override?: string | number;
  note?: string;
}

export interface BidReview {
  status: ReviewStatus;
  reviewer: string;
  decidedAt: string | null;
  note: string;
  fields: Record<string, FieldDecision>;
  /** Scope statuses the reviewer corrected by hand. */
  scopeOverrides: Record<string, ScopeStatus>;
}

interface PersistedState {
  settings: LevelingSettings;
  reviews: Record<string, BidReview>;
  mode: SourceMode;
  theme: 'light' | 'dark';
}

function emptyReview(): BidReview {
  return {
    status: 'pending',
    reviewer: DATA.project.estimator,
    decidedAt: null,
    note: '',
    fields: {},
    scopeOverrides: {},
  };
}

function initialState(): PersistedState {
  return {
    settings: defaultSettings(DATA),
    reviews: Object.fromEntries(DATA.submissions.map((s) => [s.bid_id, emptyReview()])),
    mode: 'demo',
    theme: 'light',
  };
}

interface StoreValue extends PersistedState {
  data: PipelineData;
  vendors: VendorComparison[];
  findings: Finding[];
  parity: ReturnType<typeof verifyAgainstPipeline>;
  hydrated: boolean;
  isDirty: boolean;

  setImportance: (scopeKey: string, grade: Importance) => void;
  setAmount: (scopeKey: string, amount: number) => void;
  setPriceUnclearScope: (on: boolean) => void;
  resetSettings: () => void;

  setBidStatus: (bidId: string, status: ReviewStatus) => void;
  setBidNote: (bidId: string, note: string) => void;
  setFieldDecision: (bidId: string, field: string, decision: FieldDecision) => void;
  setScopeOverride: (bidId: string, scopeKey: string, status: ScopeStatus) => void;
  clearScopeOverride: (bidId: string, scopeKey: string) => void;

  setMode: (mode: SourceMode) => void;
  setTheme: (theme: 'light' | 'dark') => void;
}

const StoreContext = createContext<StoreValue | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(initialState);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        setState((current) => ({
          settings: { ...current.settings, ...parsed.settings },
          reviews: { ...current.reviews, ...parsed.reviews },
          mode: parsed.mode ?? current.mode,
          theme: parsed.theme ?? current.theme,
        }));
      }
    } catch {
      // A corrupt or blocked store is not worth failing the app over; the
      // console simply opens at pipeline defaults.
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* private browsing, quota, etc. */
    }
  }, [state, hydrated]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', state.theme);
  }, [state.theme]);

  // Scope corrections made during review feed straight back into leveling, so
  // fixing a misread exclusion re-ranks the package immediately.
  const overrides = useMemo(() => {
    const out: Record<string, { scope_assertions: Record<string, ScopeStatus> }> = {};
    for (const submission of DATA.submissions) {
      const review = state.reviews[submission.bid_id];
      if (!review || !Object.keys(review.scopeOverrides).length) continue;
      out[submission.bid_id] = {
        scope_assertions: { ...submission.scope_assertions, ...review.scopeOverrides },
      };
    }
    return out;
  }, [state.reviews]);

  const vendors = useMemo(
    () => buildComparison(DATA, state.settings, overrides),
    [state.settings, overrides]
  );
  const findings = useMemo(
    () => computeFindings(DATA, vendors, state.settings),
    [vendors, state.settings]
  );
  const parity = useMemo(() => verifyAgainstPipeline(DATA), []);

  const defaults = useMemo(() => defaultSettings(DATA), []);
  const isDirty = useMemo(
    () => JSON.stringify(state.settings) !== JSON.stringify(defaults),
    [state.settings, defaults]
  );

  const patchReview = useCallback((bidId: string, patch: Partial<BidReview>) => {
    setState((s) => ({
      ...s,
      reviews: {
        ...s.reviews,
        [bidId]: { ...(s.reviews[bidId] ?? emptyReview()), ...patch },
      },
    }));
  }, []);

  const value: StoreValue = {
    ...state,
    data: DATA,
    vendors,
    findings,
    parity,
    hydrated,
    isDirty,

    setImportance: (scopeKey, grade) =>
      setState((s) => ({
        ...s,
        settings: { ...s.settings, importance: { ...s.settings.importance, [scopeKey]: grade } },
      })),
    setAmount: (scopeKey, amount) =>
      setState((s) => ({
        ...s,
        settings: { ...s.settings, amounts: { ...s.settings.amounts, [scopeKey]: amount } },
      })),
    setPriceUnclearScope: (on) =>
      setState((s) => ({ ...s, settings: { ...s.settings, priceUnclearScope: on } })),
    resetSettings: () => setState((s) => ({ ...s, settings: defaultSettings(DATA) })),

    setBidStatus: (bidId, status) =>
      patchReview(bidId, { status, decidedAt: status === 'pending' ? null : new Date().toISOString() }),
    setBidNote: (bidId, note) => patchReview(bidId, { note }),
    setFieldDecision: (bidId, field, decision) =>
      setState((s) => {
        const review = s.reviews[bidId] ?? emptyReview();
        return {
          ...s,
          reviews: {
            ...s.reviews,
            [bidId]: { ...review, fields: { ...review.fields, [field]: decision } },
          },
        };
      }),
    setScopeOverride: (bidId, scopeKey, status) =>
      setState((s) => {
        const review = s.reviews[bidId] ?? emptyReview();
        return {
          ...s,
          reviews: {
            ...s.reviews,
            [bidId]: { ...review, scopeOverrides: { ...review.scopeOverrides, [scopeKey]: status } },
          },
        };
      }),
    clearScopeOverride: (bidId, scopeKey) =>
      setState((s) => {
        const review = s.reviews[bidId] ?? emptyReview();
        const next = { ...review.scopeOverrides };
        delete next[scopeKey];
        return { ...s, reviews: { ...s.reviews, [bidId]: { ...review, scopeOverrides: next } } };
      }),

    setMode: (mode) => setState((s) => ({ ...s, mode })),
    setTheme: (theme) => setState((s) => ({ ...s, theme })),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}

export function useReview(bidId: string): BidReview {
  const { reviews } = useStore();
  return reviews[bidId] ?? emptyReview();
}
