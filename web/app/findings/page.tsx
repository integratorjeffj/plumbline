import { EmptyState } from '@/components/EmptyState';
import { SectionHead } from '@/components/Bits';
import { PROJECT_IDS } from '@/lib/projects';

export default function ProgramFindingsPage() {
  return (
    <>
      <SectionHead eyebrow="Program" title="Findings">
        A single queue of every anomaly the rules engine raises, across all bid packages.
      </SectionHead>
      <EmptyState
        icon="findings"
        title="Findings are still scoped to one package at a time"
        body="The rules engine raises findings per bid package: missing required scope, base bids that disagree with their own line-item totals, bidders quoting a superseded drawing revision. Rolling them into one program-wide queue means deciding how two packages' severities rank against each other, and that ordering is not defined yet. Until it is, findings live on each package's overview."
        actionLabel="Open findings for the first package"
        actionHref={`/p/${PROJECT_IDS[0]}/`}
      />
    </>
  );
}
