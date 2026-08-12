import { PROJECT_IDS, getProject } from '@/lib/projects';
import { computePortfolioTotals } from '@/lib/portfolio';
import { ProjectCard } from '@/components/ProjectCard';
import { PortfolioDashboard } from '@/components/PortfolioDashboard';
import { PortfolioFinanceChart } from '@/components/PortfolioFinanceChart';
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

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Finance by package</h2>
      <div style={{ marginBottom: 30 }}>
        <PortfolioFinanceChart projects={portfolio.projects} />
      </div>

      <div className="grid grid-3">
        {PROJECT_IDS.map((id) => {
          const data = getProject(id)!;
          const health = portfolio.projects.find((p) => p.projectId === id)!;
          return (
            <ProjectCard
              key={id}
              id={id}
              name={data.project.project_name}
              packageLabel={`${data.project.bid_package_number} · ${data.project.bid_package_description}`}
              bidCount={data.summary.active_bidders}
              alertCount={data.summary.high_severity_findings}
              health={{ scope: health.scope, cost: health.cost, risk: health.risk }}
            />
          );
        })}
      </div>
    </>
  );
}
