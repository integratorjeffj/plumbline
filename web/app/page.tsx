import { PROJECT_IDS, getProject } from '@/lib/projects';
import { computePortfolioTotals } from '@/lib/portfolio';
import { ProjectCard } from '@/components/ProjectCard';
import { PendingReviewsOverlay } from '@/components/PendingReviewsOverlay';
import { PortfolioFinanceChart } from '@/components/PortfolioFinanceChart';
import { HealthDot, Kpi, SectionHead } from '@/components/Bits';
import { money, signedMoney } from '@/lib/format';

export default function DirectoryPage() {
  const portfolio = computePortfolioTotals();

  return (
    <>
      <SectionHead eyebrow="Bid packages" title="Active projects">
        Select a package to open its review console. Every project below is entirely synthetic --
        no real bid data is represented anywhere in this demo.
      </SectionHead>

      <div className="grid grid-3" style={{ marginBottom: 26 }}>
        <Kpi value={String(portfolio.projectCount)} label="Bid packages tracked" />
        <Kpi value={money(portfolio.totalBudget)} label="Combined program budget" />
        <Kpi
          value={money(portfolio.totalBestValueExposure)}
          label="Leveled bid exposure (sum of each package's lowest adjusted bid)"
        />
        <Kpi
          value={signedMoney(portfolio.totalVarianceToBudget)}
          label={`Variance to budget${portfolio.projectsOverBudgetCount > 0 ? ` · ${portfolio.projectsOverBudgetCount} package(s) over` : ''}`}
          flag={portfolio.totalVarianceToBudget < 0}
        />
        <PendingReviewsOverlay defaultValue={portfolio.totalPendingReviewsDefault} projectIds={PROJECT_IDS} />
        <Kpi
          value={String(portfolio.totalHighFindings)}
          label="High-severity findings across all packages"
          flag={portfolio.totalHighFindings > 0}
        />
      </div>

      <h2 style={{ fontSize: 20, marginBottom: 12 }}>Package health</h2>
      <div className="card" style={{ marginBottom: 26, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Package</th>
                <th className="right">Budget</th>
                <th className="right">Leveled low bid</th>
                <th className="right">Variance</th>
                <th>Scope</th>
                <th>Cost</th>
                <th>Risk</th>
                <th className="right">Pending</th>
              </tr>
            </thead>
            <tbody>
              {portfolio.projects.map((p) => (
                <tr key={p.projectId}>
                  <td>
                    <a href={`/p/${p.projectId}/`} style={{ fontWeight: 600 }}>
                      {p.projectName}
                    </a>
                    <div className="small muted">{p.packageLabel}</div>
                  </td>
                  <td className="right num">{money(p.budget)}</td>
                  <td className="right num">{money(p.lowestAdjustedTotal)}</td>
                  <td className="right num" style={{ color: p.costVariance < 0 ? 'var(--danger)' : 'inherit' }}>
                    {signedMoney(p.costVariance)}
                  </td>
                  <td>
                    <HealthDot level={p.scope} label={`Scope: ${p.scopeCovered} of ${p.scopeRequired} required items covered`} />
                  </td>
                  <td>
                    <HealthDot level={p.cost} label={`Cost: ${p.costVariancePct.toFixed(1)}% vs budget`} />
                  </td>
                  <td>
                    <HealthDot level={p.risk} label={`Risk: ${p.highFindingsCount} high-severity findings`} />
                  </td>
                  <td className="right num">{p.pendingReviewsDefault}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

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
