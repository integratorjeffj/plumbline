'use client';

/**
 * The Directory route renders outside any ProjectStoreProvider, so its
 * "pending reviews" tile can only know the static default (every active
 * submission, since nothing is reviewed until a human acts) at first paint.
 * This corrects that number after mount by reading each project's persisted
 * review state directly from localStorage -- same hydration-guard pattern
 * ProjectStoreProvider itself uses, so no new pattern is invented, and no
 * other portfolio figure (budget, RAG health, findings) is treated this way,
 * since a demo visitor is far less likely to have already changed those.
 */

import { useEffect, useState } from 'react';
import { Kpi } from './Bits';
import { getProject } from '@/lib/projects';
import { readPersistedReviews } from '@/lib/store';

function countPending(projectId: string): number {
  const data = getProject(projectId);
  if (!data) return 0;
  const active = data.submissions.filter((s) => !s.superseded);
  const persisted = readPersistedReviews(projectId);
  if (!persisted) return active.length;
  return active.filter((s) => (persisted[s.bid_id]?.status ?? 'pending') === 'pending').length;
}

export function PendingReviewsOverlay({
  defaultValue,
  projectIds,
}: {
  defaultValue: number;
  projectIds: string[];
}) {
  const [pending, setPending] = useState(defaultValue);

  useEffect(() => {
    try {
      const total = projectIds.reduce((sum, id) => sum + countPending(id), 0);
      setPending(total);
    } catch {
      // Storage unavailable (private browsing, etc.) -- the static default
      // already rendered and stays correct.
    }
    // Runs once after mount to overlay real browser state onto the static
    // default; projectIds is a stable module-level constant.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <Kpi value={String(pending)} label="Pending reviews across all packages" />;
}
