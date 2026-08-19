'use client';

import { useState } from 'react';
import { useStore } from '@/lib/store';
import { EmptyState } from '@/components/EmptyState';
import { GatePill, SectionHead } from '@/components/Bits';
import { money } from '@/lib/format';
import type { VendorPrequalification } from '@/lib/types';

const INSURANCE_ROWS: { key: string; label: string }[] = [
  { key: 'general_liability_occurrence', label: 'General liability, per occurrence' },
  { key: 'general_liability_aggregate', label: 'General liability, aggregate' },
  { key: 'auto_liability', label: 'Automobile liability' },
  { key: 'umbrella', label: 'Umbrella / excess liability' },
  { key: 'workers_comp_employers_liability', label: "Workers' comp, employer's liability" },
];

/** Where an EMR sits between the high-risk ceiling and the disqualifying line. */
function emrPosition(emr: number, best: number, worst: number): number {
  return Math.max(0, Math.min(100, ((emr - best) / (worst - best)) * 100));
}

export default function VendorsPage() {
  const { data, vendors, award } = useStore();
  const prequalification = data.prequalification;
  const policy = data.policy?.prequalification;

  const [activeId, setActiveId] = useState<string>(
    () => [...vendors].sort((a, b) => a.adjusted_rank - b.adjusted_rank)[0]?.vendor_id ?? ''
  );

  if (!prequalification || !policy) {
    return (
      <>
        <SectionHead eyebrow="Configuration" title="Prequalification">
          Eligibility to be awarded this package, decided separately from price.
        </SectionHead>
        <EmptyState
          icon="vendors"
          title="This package carries no prequalification records"
          body="Prequalification needs a vetted record per subcontractor -- experience modification rate, bonding capacity, insurance limits, and performance history -- plus the general contractor's written policy to measure them against. This package was authored without them, and inventing a gate result the evidence cannot support would be worse than showing nothing. The Falcon Medical electrical package carries the full record set."
          actionLabel="Open a package with prequalification records"
          actionHref="/p/falcon-medical/vendors/"
        />
      </>
    );
  }

  const ordered = [...vendors]
    .sort((a, b) => a.adjusted_rank - b.adjusted_rank)
    .map((v) => prequalification[v.vendor_id])
    .filter(Boolean) as VendorPrequalification[];

  const active = prequalification[activeId] ?? ordered[0];
  const activeVendor = vendors.find((v) => v.vendor_id === active?.vendor_id);
  const activeScore = award?.scores.find((s) => s.vendor_id === active?.vendor_id);

  const eligibleCount = ordered.filter((p) => p.eligible).length;

  return (
    <>
      <SectionHead eyebrow="Configuration" title="Prequalification">
        Whether a subcontractor may be carried on this package at all. These are gates, not
        weights: a failing gate removes a bidder from award consideration before price is
        discussed, because carrying that risk is not something a lower number buys back.
      </SectionHead>

      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row row-wrap">
          <b style={{ flex: 1 }}>
            {eligibleCount} of {ordered.length} bidders clear prequalification
          </b>
          <span className="small muted">
            Policy owned by {policy.policy_owner}, effective {policy.effective_date}
          </span>
        </div>
        <p className="small" style={{ color: 'var(--ink-2)', marginTop: 8, marginBottom: 0 }}>
          {policy.policy_note}
        </p>
      </div>

      {/* ---------- bidder selector ---------- */}
      <div className="row row-wrap" style={{ gap: 8, marginBottom: 18 }}>
        {ordered.map((prequal) => {
          const vendor = vendors.find((v) => v.vendor_id === prequal.vendor_id);
          const selected = prequal.vendor_id === active?.vendor_id;
          return (
            <button
              key={prequal.vendor_id}
              type="button"
              className="card card-pad vendor-chip"
              data-selected={selected || undefined}
              onClick={() => setActiveId(prequal.vendor_id)}
              aria-pressed={selected}
              style={{ flex: '1 1 220px', textAlign: 'left', boxShadow: 'none', cursor: 'pointer' }}
            >
              <div className="row" style={{ marginBottom: 4 }}>
                <b style={{ flex: 1 }}>{prequal.vendor_name}</b>
                <GatePill status={prequal.status} />
              </div>
              <div className="small muted num">
                {vendor ? `${money(vendor.adjusted_total)} leveled` : ''} · EMR{' '}
                {prequal.emr.toFixed(2)}
              </div>
            </button>
          );
        })}
      </div>

      {active && (
        <>
          {/* ---------- headline ---------- */}
          <div
            className="card card-pad"
            style={{
              marginBottom: 20,
              borderLeft: `3px solid ${active.eligible ? 'var(--ok)' : 'var(--danger)'}`,
            }}
          >
            <div className="row row-wrap" style={{ marginBottom: 6 }}>
              <h2 style={{ flex: 1, margin: 0 }}>{active.vendor_name}</h2>
              <GatePill status={active.status} />
            </div>
            <div className="small muted num" style={{ marginBottom: 8 }}>
              {activeVendor && (
                <>
                  {money(activeVendor.submitted_total)} submitted →{' '}
                  {money(activeVendor.adjusted_total)} leveled · rank{' '}
                  {activeVendor.adjusted_rank} of {vendors.length}
                </>
              )}
              {activeScore && ` · award score ${activeScore.total_score.toFixed(1)}`}
            </div>
            <div style={{ color: 'var(--ink-2)' }}>
              {active.eligible
                ? 'Eligible for award. Any conditions below must still be cleared before subcontract execution.'
                : active.disqualifying_reason}
            </div>
            {active.participation_certifications.length > 0 && (
              <div className="row row-wrap" style={{ gap: 6, marginTop: 10 }}>
                {active.participation_certifications.map((cert) => (
                  <span key={cert} className="pill p-tag">
                    {cert}
                  </span>
                ))}
                {active.certifications.certifying_agency && (
                  <span className="small muted">
                    certified by {active.certifications.certifying_agency}
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ---------- gates ---------- */}
          <h2 style={{ marginBottom: 12 }}>Gates</h2>
          <div className="stack" style={{ gap: 8, marginBottom: 30 }}>
            {active.gates.map((gate) => (
              <div
                key={gate.code}
                className="card card-pad"
                style={{
                  borderLeft:
                    gate.status === 'fail'
                      ? '3px solid var(--danger)'
                      : gate.status === 'warn'
                        ? '3px solid var(--warn)'
                        : '3px solid transparent',
                }}
              >
                <div className="row row-wrap" style={{ alignItems: 'flex-start' }}>
                  <b style={{ flex: 1 }}>{gate.label}</b>
                  <GatePill status={gate.status} />
                  <span className="mono small muted">{gate.code}</span>
                </div>
                <div className="small" style={{ color: 'var(--ink-2)', marginTop: 6 }}>
                  {gate.summary}
                </div>
              </div>
            ))}
          </div>

          {/* ---------- safety ---------- */}
          <h2 style={{ marginBottom: 12 }}>Safety</h2>
          <div className="card card-pad" style={{ marginBottom: 30 }}>
            <div className="row row-wrap" style={{ marginBottom: 10 }}>
              <span className="num" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600, flex: 1 }}>
                EMR {active.emr.toFixed(2)}
                <span className="small muted" style={{ fontWeight: 400 }}>
                  {' '}
                  ({active.safety.emr_year})
                </span>
              </span>
              <span className="small muted">
                TRIR {active.safety.trir} · {active.safety.osha_recordables_3yr} recordables /{' '}
                {active.safety.lost_time_incidents_3yr} lost-time (3 yr)
              </span>
            </div>

            <div className="emr-scale">
              <div className="emr-track">
                <div
                  className="emr-band emr-band-ok"
                  style={{
                    width: `${emrPosition(policy.emr_maximum, policy.emr_high_risk_maximum, policy.emr_disqualifying)}%`,
                  }}
                />
                <div
                  className="emr-marker"
                  style={{
                    left: `${emrPosition(active.emr, policy.emr_high_risk_maximum, policy.emr_disqualifying)}%`,
                  }}
                  title={`EMR ${active.emr.toFixed(2)}`}
                />
              </div>
              <div className="row small muted" style={{ justifyContent: 'space-between', marginTop: 6 }}>
                <span>{policy.emr_high_risk_maximum.toFixed(2)} high-risk ceiling</span>
                <span>{policy.emr_maximum.toFixed(2)} maximum</span>
                <span>{policy.emr_disqualifying.toFixed(2)} disqualifying</span>
              </div>
            </div>
          </div>

          {/* ---------- bonding + insurance ---------- */}
          <div className="row row-wrap" style={{ gap: 16, alignItems: 'stretch', marginBottom: 30 }}>
            <div className="card card-pad" style={{ flex: '1 1 320px' }}>
              <h3 style={{ marginTop: 0 }}>Bonding</h3>
              <div className="small muted" style={{ marginBottom: 10 }}>
                {active.bonding.surety} · {active.bonding.am_best_rating}
              </div>
              <table>
                <tbody>
                  <tr>
                    <td>Single-project limit</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {money(active.bonding.single_project_limit)}
                    </td>
                  </tr>
                  <tr>
                    <td>Aggregate limit</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {money(active.bonding.aggregate_limit)}
                    </td>
                  </tr>
                  <tr>
                    <td>Current backlog</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {money(active.bonding.current_backlog)}
                    </td>
                  </tr>
                  <tr>
                    {/* Backlog alone. The gate above reports the same ratio with
                        this bid added, which is a slightly higher number -- both
                        are labeled so the difference reads as intent. */}
                    <td>Aggregate utilization, before this bid</td>
                    <td
                      className="num"
                      style={{
                        textAlign: 'right',
                        color:
                          active.bond_utilization_pct > 85 ? 'var(--warn)' : 'inherit',
                      }}
                    >
                      {active.bond_utilization_pct.toFixed(1)}%
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card card-pad" style={{ flex: '1 1 320px' }}>
              <h3 style={{ marginTop: 0 }}>Insurance</h3>
              <div className="small muted" style={{ marginBottom: 10 }}>
                Certificate expires {String(active.insurance.certificate_expires)}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Coverage</th>
                    <th style={{ textAlign: 'right' }}>Carried</th>
                    <th style={{ textAlign: 'right' }}>Required</th>
                  </tr>
                </thead>
                <tbody>
                  {INSURANCE_ROWS.map((row) => {
                    const carried = Number(active.insurance[row.key] ?? 0);
                    const required = policy.insurance_minimums_usd[row.key] ?? 0;
                    const short = carried < required;
                    return (
                      <tr key={row.key}>
                        <td>{row.label}</td>
                        <td
                          className="num"
                          style={{ textAlign: 'right', color: short ? 'var(--danger)' : 'inherit' }}
                        >
                          {money(carried)}
                        </td>
                        <td className="num muted" style={{ textAlign: 'right' }}>
                          {money(required)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ---------- performance + schedule ---------- */}
          <div className="row row-wrap" style={{ gap: 16, alignItems: 'stretch' }}>
            <div className="card card-pad" style={{ flex: '1 1 320px' }}>
              <h3 style={{ marginTop: 0 }}>Past performance</h3>
              <table>
                <tbody>
                  <tr>
                    <td>Change-order rate</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.performance.change_order_rate_pct.toFixed(1)}%
                    </td>
                  </tr>
                  <tr>
                    <td>On-time closeout</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.performance.on_time_closeout_pct.toFixed(0)}%
                    </td>
                  </tr>
                  <tr>
                    <td>Packages bid / awarded / completed</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.performance.packages_bid} / {active.performance.packages_awarded} /{' '}
                      {active.performance.packages_completed}
                    </td>
                  </tr>
                  <tr>
                    <td>Average RFIs per package</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.performance.avg_rfi_per_package.toFixed(1)}
                    </td>
                  </tr>
                  <tr>
                    <td>Years working together</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.performance.years_working_together}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="card card-pad" style={{ flex: '1 1 320px' }}>
              <h3 style={{ marginTop: 0 }}>Schedule and capacity</h3>
              <div className="small muted" style={{ marginBottom: 10 }}>
                Package requires {data.policy?.schedule_requirement.required_duration_weeks} weeks,
                mobilizing within {data.policy?.schedule_requirement.max_mobilization_weeks}
              </div>
              <table>
                <tbody>
                  <tr>
                    <td>Proposed duration</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.schedule.proposed_duration_weeks} weeks
                    </td>
                  </tr>
                  <tr>
                    <td>Mobilization</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.schedule.mobilization_weeks} weeks
                    </td>
                  </tr>
                  <tr>
                    <td>Crew committed</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.schedule.crew_size_committed}
                    </td>
                  </tr>
                  <tr>
                    <td>Concurrent awarded packages</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.schedule.concurrent_awarded_packages}
                    </td>
                  </tr>
                  <tr>
                    <td>Last prequalified</td>
                    <td className="num" style={{ textAlign: 'right' }}>
                      {active.last_reviewed}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </>
  );
}
