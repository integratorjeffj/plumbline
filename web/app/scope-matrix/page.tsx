import { EmptyState } from '@/components/EmptyState';
import { SectionHead } from '@/components/Bits';
import { PROJECT_IDS } from '@/lib/projects';

export default function ProgramScopeMatrixPage() {
  return (
    <>
      <SectionHead eyebrow="Program" title="Scope matrix">
        Required scope by bidder, read across every package at once.
      </SectionHead>
      <EmptyState
        icon="matrix"
        title="Scope keys are package-specific"
        body="Each package carries its own required-scope list, drawn from its specification sections. A program-wide matrix needs those lists mapped onto one shared taxonomy first, otherwise the same row would mean different things in different columns. The per-package matrix, with its live importance weighting, is fully built."
        actionLabel="Open the scope matrix for the first package"
        actionHref={`/p/${PROJECT_IDS[0]}/settings/`}
      />
    </>
  );
}
