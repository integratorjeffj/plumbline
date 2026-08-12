'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useStore } from '@/lib/store';
import { computeProjectHealth } from '@/lib/portfolio';
import { HealthDot, Kpi, SeverityPill } from '@/components/Bits';
import { RankingTable } from '@/components/RankingTable';
import { money, signedMoney, formatDate } from '@/lib/format';
import { Plumb } from '@/components/Plumb';

export default function ReportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { data, vendors, findings } = useStore();
  const health = computeProjectHealth(projectId, data);

  // Computed client-side only, after mount: the export is statically
  // prerendered at build time, so baking "now" into that render would mismatch
  // the actual date a visitor opens the report on.
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  useEffect(() => setGeneratedAt(new Date().toISOString()), []);

  return (
    <>
      <div className="row row-wrap no-print" style={{ marginBottom: 18 }}>
        <span className="small muted" style={{ flex: 1 }}>
          A single-page summary for sharing with stakeholders outside the console. Nothing here is
          editable -- it reflects the same computed leveling shown throughout this package.
        </span>
        <button className="btn" data-variant="primary" onClick={() => window.print()}>
          Print / Save as PDF
        </button>
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row" style={{ marginBottom: 10 }}>
          <Plumb size={26} />
          <span className="wordmark">
            Plumb<span>line</span>
          </span>
          <span className="small muted" style={{ marginLeft: 'auto' }}>
            {generatedAt ? `Generated ${formatDate(generatedAt)}` : ''}
          </span>
        </div>
        <h1 style={{ marginBottom: 6 }}>{data.project.project_name}</h1>
        <div className="small muted">
          {data.project.bid_package_number} · {data.project.bid_package_description} ·{' '}
          {data.project.customer} · General contractor {data.project.general_contractor} · Estimator{' '}
          {data.project.estimator} · Drawings at {data.project.drawing_revision}
        </div>
      </div>

      <div className="grid grid-4" style={{ marginBottom: 20 }}>
        <Kpi value={money(data.project.budget)} label="Package budget" />
        <Kpi value={money(health.lowestAdjustedTotal)} label={`Leveled low bid (${health.lowestAdjustedVendor})`} />
        <Kpi
          value={signedMoney(health.costVariance)}
          label="Variance to budget"
          flag={health.costVariance < 0}
        />
        <Kpi
          value={String(health.highFindingsCount)}
          label="High-severity findings"
          flag={health.highFindingsCount > 0}
        />
      </div>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row row-wrap" style={{ gap: 20 }}>
          <HealthDot level={health.scope} label={`Scope: ${health.scopeCovered} of ${health.scopeRequired} required items covered`} showLabel />
          <HealthDot level={health.cost} label={`Cost: ${health.costVariancePct.toFixed(1)}% vs. budget`} showLabel />
          <HealthDot level={health.risk} label={`Risk: ${health.highFindingsCount} high-severity findings`} showLabel />
        </div>
      </div>

      <h2 style={{ marginBottom: 10 }}>Ranking</h2>
      <div style={{ marginBottom: 20 }}>
        <RankingTable vendors={vendors} />
      </div>

      <h2 style={{ marginBottom: 10 }}>Top findings</h2>
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="stack" style={{ gap: 10 }}>
          {findings.slice(0, 5).map((f, i) => (
            <div key={`${f.code}-${i}`} className="row" style={{ alignItems: 'flex-start', gap: 8 }}>
              <SeverityPill severity={f.severity} />
              <span className="small" style={{ color: 'var(--ink-2)' }}>
                {f.summary}
              </span>
            </div>
          ))}
          {findings.length === 0 && <span className="small muted">No findings raised for this package.</span>}
        </div>
      </div>

      <div className="note">
        <b>Human review required.</b> This report is decision support, generated from computed
        leveling and scope analysis. It never awards a bid, and every AI-extracted value carries a
        citation back to the page and section it came from so a reviewer can check it against the
        source.
      </div>
    </>
  );
}
