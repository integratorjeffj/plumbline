'use client';

/**
 * Project-scoped console state: review decisions and scope weighting.
 *
 * Persisted to localStorage, namespaced per project, so a reviewer can close
 * the tab mid-package and come back to their decisions -- and so decisions on
 * one bid package never bleed into another (see ./prefs.tsx for the global,
 * project-independent state that intentionally does persist across
 * projects). Reads are deferred to an effect because the app is statically
 * exported and the first render happens with no browser storage available.
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

import { getProject } from './projects';
import { defaultSettings, buildComparison, verifyAgainstPipeline, type LevelingSettings } from './leveling';
import { computeFindings } from './findings';
import type { Finding, Importance, PipelineData, ReviewStatus, ScopeStatus, VendorComparison } from './types';

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
}

export function projectStorageKey(projectId: string): string {
  return `plumbline.console.v1.project.${projectId}`;
}

/**
 * Read a project's persisted review decisions directly, without a mounted
 * ProjectStoreProvider. Used by the Directory route's pending-reviews tile,
 * which renders above/outside any project's provider and still wants to
 * reflect review progress a visitor has already made in this browser.
 * Returns null if nothing is stored yet or storage is unavailable.
 */
export function readPersistedReviews(projectId: string): Record<string, BidReview> | null {
  try {
    const raw = window.localStorage.getItem(projectStorageKey(projectId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PersistedState>;
    return parsed.reviews ?? null;
  } catch {
    return null;
  }
}

function emptyReview(estimator: string): BidReview {
  return {
    status: 'pending',
    reviewer: estimator,
    decidedAt: null,
    note: '',
    fields: {},
    scopeOverrides: {},
  };
}

function initialState(data: PipelineData): PersistedState {
  return {
    settings: defaultSettings(data),
    reviews: Object.fromEntries(
      data.submissions.map((s) => [s.bid_id, emptyReview(data.project.estimator)])
    ),
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
}

const StoreContext = createContext<StoreValue | null>(null);

export function ProjectStoreProvider({
  projectId,
  children,
}: {
  projectId: string;
  children: ReactNode;
}) {
  const data = getProject(projectId);
  if (!data) {
    // generateStaticParams only ever builds routes for known project ids, so
    // this indicates a manifest/route mismatch, not a reachable user state.
    throw new Error(`Unknown project: ${projectId}`);
  }

  const storageKey = projectStorageKey(projectId);
  const [state, setState] = useState<PersistedState>(() => initialState(data));
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<PersistedState>;
        setState((current) => ({
          settings: { ...current.settings, ...parsed.settings },
          reviews: { ...current.reviews, ...parsed.reviews },
        }));
      }
    } catch {
      // A corrupt or blocked store is not worth failing the app over; the
      // console simply opens at pipeline defaults.
    }
    setHydrated(true);
    // storageKey only changes if this component is remounted under a
    // different projectId (the route tree keys the provider on projectId),
    // so this effect intentionally runs once per mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(storageKey, JSON.stringify(state));
    } catch {
      /* private browsing, quota, etc. */
    }
  }, [state, hydrated, storageKey]);

  // Scope corrections made during review feed straight back into leveling, so
  // fixing a misread exclusion re-ranks the package immediately.
  const overrides = useMemo(() => {
    const out: Record<string, { scope_assertions: Record<string, ScopeStatus> }> = {};
    for (const submission of data.submissions) {
      const review = state.reviews[submission.bid_id];
      if (!review || !Object.keys(review.scopeOverrides).length) continue;
      out[submission.bid_id] = {
        scope_assertions: { ...submission.scope_assertions, ...review.scopeOverrides },
      };
    }
    return out;
  }, [data.submissions, state.reviews]);

  const vendors = useMemo(
    () => buildComparison(data, state.settings, overrides),
    [data, state.settings, overrides]
  );
  const findings = useMemo(
    () => computeFindings(data, vendors, state.settings),
    [data, vendors, state.settings]
  );
  const parity = useMemo(() => verifyAgainstPipeline(data), [data]);

  const defaults = useMemo(() => defaultSettings(data), [data]);
  const isDirty = useMemo(
    () => JSON.stringify(state.settings) !== JSON.stringify(defaults),
    [state.settings, defaults]
  );

  const patchReview = useCallback((bidId: string, patch: Partial<BidReview>) => {
    setState((s) => ({
      ...s,
      reviews: {
        ...s.reviews,
        [bidId]: { ...(s.reviews[bidId] ?? emptyReview(data.project.estimator)), ...patch },
      },
    }));
  }, [data.project.estimator]);

  const value: StoreValue = {
    ...state,
    data,
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
    resetSettings: () => setState((s) => ({ ...s, settings: defaultSettings(data) })),

    setBidStatus: (bidId, status) =>
      patchReview(bidId, { status, decidedAt: status === 'pending' ? null : new Date().toISOString() }),
    setBidNote: (bidId, note) => patchReview(bidId, { note }),
    setFieldDecision: (bidId, field, decision) =>
      setState((s) => {
        const review = s.reviews[bidId] ?? emptyReview(data.project.estimator);
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
        const review = s.reviews[bidId] ?? emptyReview(data.project.estimator);
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
        const review = s.reviews[bidId] ?? emptyReview(data.project.estimator);
        const next = { ...review.scopeOverrides };
        delete next[scopeKey];
        return { ...s, reviews: { ...s.reviews, [bidId]: { ...review, scopeOverrides: next } } };
      }),
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside ProjectStoreProvider');
  return ctx;
}

export function useReview(bidId: string): BidReview {
  const { reviews, data } = useStore();
  return reviews[bidId] ?? emptyReview(data.project.estimator);
}
