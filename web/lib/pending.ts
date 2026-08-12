'use client';

/**
 * Pending-review counts per bid package, read from the browser.
 *
 * The package table renders outside any ProjectStoreProvider, so at first
 * paint it can only know the static default: every active submission, since
 * nothing is reviewed until a human acts. This corrects those numbers after
 * mount by reading each project's persisted review state straight from
 * localStorage, using the same hydration-guard pattern ProjectStoreProvider
 * itself uses.
 *
 * Only review counts get this treatment. Budget, health, and findings are
 * computed by the engine and cannot drift from what a visitor has clicked.
 */

import { useEffect, useState } from 'react';
import { getProject } from './projects';
import { readPersistedReviews } from './store';

function countPending(projectId: string): number {
  const data = getProject(projectId);
  if (!data) return 0;
  const active = data.submissions.filter((s) => !s.superseded);
  const persisted = readPersistedReviews(projectId);
  if (!persisted) return active.length;
  return active.filter((s) => (persisted[s.bid_id]?.status ?? 'pending') === 'pending').length;
}

function defaults(projectIds: string[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const id of projectIds) {
    out[id] = getProject(id)?.submissions.filter((s) => !s.superseded).length ?? 0;
  }
  return out;
}

export function usePendingCounts(projectIds: string[]): Record<string, number> {
  const [counts, setCounts] = useState<Record<string, number>>(() => defaults(projectIds));

  useEffect(() => {
    try {
      const next: Record<string, number> = {};
      for (const id of projectIds) next[id] = countPending(id);
      setCounts(next);
    } catch {
      // Storage unavailable (private browsing, quota). The static defaults
      // already rendered and stay correct.
    }
    // Runs once after mount to overlay real browser state onto the static
    // defaults; projectIds is a stable module-level constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return counts;
}
