import { computePortfolioTotals } from '@/lib/portfolio';
import { PortfolioDashboard } from '@/components/PortfolioDashboard';
import { ActivityStrip } from '@/components/ActivityStrip';
import { SectionHead } from '@/components/Bits';

export default function DirectoryPage() {
  const portfolio = computePortfolioTotals();

  return (
    <>
      <SectionHead eyebrow="Bid packages" title="Active projects">
        Select a package to open its review console. Every project below is entirely synthetic --
        no real bid data is represented anywhere in this demo.
      </SectionHead>

      <PortfolioDashboard portfolio={portfolio} />
      <ActivityStrip />
    </>
  );
}
