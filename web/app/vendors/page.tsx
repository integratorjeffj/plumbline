import { EmptyState } from '@/components/EmptyState';
import { SectionHead } from '@/components/Bits';
import { PROJECT_IDS } from '@/lib/projects';

export default function ProgramVendorsPage() {
  return (
    <>
      <SectionHead eyebrow="Program" title="Vendors">
        One record per subcontractor, with their history across every package they have bid.
      </SectionHead>
      <EmptyState
        icon="vendors"
        title="Vendor identity is resolved per package, not yet across them"
        body="The pipeline matches a submission to a vendor inside the package it arrived for. Carrying that identity across packages means real entity resolution, since the same firm signs its proposals differently from one bid to the next, and getting that wrong would silently merge two companies' pricing history. Vendor comparisons are exact within a package today."
        actionLabel="Compare vendors on the first package"
        actionHref={`/p/${PROJECT_IDS[0]}/compare/`}
      />
    </>
  );
}
