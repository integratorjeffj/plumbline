'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { GatePill, SectionHead } from '@/components/Bits';
import { DataTable, type Column } from '@/components/DataTable';
import { Drawer } from '@/components/Drawer';
import { ColumnChart, SegmentedBar } from '@/components/Charts';
import { PROJECTS, PROJECT_IDS } from '@/lib/projects';
import { allVendors, vendorsBiddingMultiplePackages, type ProgramVendor } from '@/lib/program';
import { money } from '@/lib/format';
import type { GateStatus } from '@/lib/types';

const STATUS_COLOR: Record<GateStatus, string> = {
  pass: 'var(--ok)',
  warn: 'var(--warn)',
  fail: 'var(--danger)',
};

const STATUS_LABEL: Record<GateStatus, string> = {
  pass: 'Clear',
  warn: 'Conditions',
  fail: 'Gated',
};

export default function ProgramVendorsPage() {
  const vendors = useMemo(() => allVendors(), []);
  const [statusFilter, setStatusFilter] = useState<GateStatus | 'all'>('all');
  const [projectId, setProjectId] = useState('all');
  const [certOnly, setCertOnly] = useState(false);
  const [open, setOpen] = useState<ProgramVendor | null>(null);

  const duplicated = useMemo(() => vendorsBiddingMultiplePackages(vendors), [vendors]);

  const visible = useMemo(
    () =>
      vendors.filter((v) => {
        if (projectId !== 'all' && v.projectId !== projectId) return false;
        if (statusFilter !== 'all' && v.prequal?.status !== statusFilter) return false;
        if (certOnly && !(v.prequal?.participation_certifications.length ?? 0)) return false;
        return true;
      }),
    [vendors, statusFilter, projectId, certOnly]
  );

  const statusTally = useMemo(() => {
    const out: Record<GateStatus, number> = { pass: 0, warn: 0, fail: 0 };
    for (const v of vendors) if (v.prequal) out[v.prequal.status] += 1;
    return out;
  }, [vendors]);

  const emrColumns = useMemo(
    () =>
      [...vendors]
        .filter((v) => v.prequal)
        .sort((a, b) => (a.prequal!.emr ?? 0) - (b.prequal!.emr ?? 0))
        .map((v) => ({
          key: v.vendorId,
          // Two firms in the demo start with the same word (Meridian Mechanical
          // and Meridian Electric), so one word is not an identifier.
          label: v.vendorName.split(' ').slice(0, 2).join(' '),
          value: v.prequal!.emr,
          color: STATUS_COLOR[v.prequal!.status],
        })),
    [vendors]
  );

  const columns: Column<ProgramVendor>[] = [
    {
      key: 'vendor',
      header: 'Subcontractor',
      sortValue: (v) => v.vendorName,
      render: (v) => (
        <>
          <b>{v.vendorName}</b>
          <div className="small muted">{v.trade}</div>
        </>
      ),
    },
    {
      key: 'status',
      header: 'Prequalification',
      sortValue: (v) => ({ fail: 0, warn: 1, pass: 2 })[v.prequal?.status ?? 'pass'],
      render: (v) =>
        v.prequal ? <GatePill status={v.prequal.status} /> : <span className="muted">no record</span>,
    },
    {
      key: 'emr',
      header: 'EMR',
      numeric: true,
      sortValue: (v) => v.prequal?.emr ?? 99,
      render: (v) => (v.prequal ? v.prequal.emr.toFixed(2) : '--'),
    },
    {
      key: 'package',
      header: 'Package',
      secondary: true,
      sortValue: (v) => v.projectName,
      render: (v) => (
        <>
          <div>{v.projectName}</div>
          <div className="small muted">{v.packageLabel}</div>
        </>
      ),
    },
    {
      key: 'leveled',
      header: 'Leveled bid',
      numeric: true,
      sortValue: (v) => v.adjustedTotal,
      render: (v) => (
        <>
          {money(v.adjustedTotal)}
          <div className="small muted">
            rank {v.adjustedRank} of {v.bidderCount}
          </div>
        </>
      ),
    },
    {
      key: 'score',
      header: 'Award score',
      numeric: true,
      secondary: true,
      sortValue: (v) => v.awardScore ?? -1,
      render: (v) =>
        v.awardScore === null ? (
          <span className="muted">--</span>
        ) : (
          <>
            {v.awardScore.toFixed(1)}
            <div className="small muted">{v.awardRank ? `ranked ${v.awardRank}` : 'not ranked'}</div>
          </>
        ),
    },
  ];

  return (
    <>
      <SectionHead eyebrow="Program" title="Vendors">
        One row per subcontractor bid, across every package. Identity is resolved at intake to a
        stable vendor id rather than by matching names, which is what makes this roster exact.
      </SectionHead>

      <div className="row row-wrap" style={{ gap: 16, alignItems: 'stretch', marginBottom: 20 }}>
        <div className="card card-pad" style={{ flex: '1 1 280px' }}>
          <h3 style={{ marginTop: 0, marginBottom: 10 }}>Prequalification across the program</h3>
          <SegmentedBar
            ariaLabel="Subcontractors by prequalification outcome"
            segments={(['pass', 'warn', 'fail'] as GateStatus[]).map((s) => ({
              key: s,
              label: STATUS_LABEL[s],
              value: statusTally[s],
              color: STATUS_COLOR[s],
              detail: `${statusTally[s]} of ${vendors.length} bids`,
            }))}
            height={16}
          />
          <div className="legend" style={{ marginTop: 12 }}>
            {(['pass', 'warn', 'fail'] as GateStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                className="legend-item"
                data-dim={statusFilter !== 'all' && statusFilter !== s ? '' : undefined}
                aria-pressed={statusFilter === s}
                onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
              >
                <span className="legend-swatch" style={{ background: STATUS_COLOR[s] }} />
                {STATUS_LABEL[s]}
                <span className="num muted">{statusTally[s]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="card card-pad" style={{ flex: '1 1 340px' }}>
          <h3 style={{ marginTop: 0, marginBottom: 4 }}>Experience modification rate</h3>
          <p className="small muted" style={{ marginTop: 0, marginBottom: 12 }}>
            Lower is better. Bars are coloured by prequalification outcome, so a tall red bar is a
            firm the EMR gate stopped.
          </p>
          <ColumnChart
            columns={emrColumns}
            ariaLabel="Experience modification rate by subcontractor"
            formatValue={(v) => v.toFixed(2)}
          />
        </div>
      </div>

      {duplicated.length === 0 && (
        <p className="small muted" style={{ marginTop: 0, marginBottom: 14 }}>
          No firm in this demo bids more than one package, so every row is a distinct company. If
          that ever changes, this roster needs real entity resolution behind it -- the same firm
          signs its proposals differently from one bid to the next, and merging on name would fuse
          two companies&rsquo; histories.
        </p>
      )}

      <div className="row row-wrap" style={{ gap: 10, marginBottom: 14, alignItems: 'flex-end' }}>
        <label className="field" style={{ flex: '0 1 280px' }}>
          <span className="small muted">Package</span>
          <select value={projectId} onChange={(e) => setProjectId(e.target.value)}>
            <option value="all">All packages ({vendors.length})</option>
            {PROJECT_IDS.map((id) => (
              <option key={id} value={id}>
                {PROJECTS[id].project.project_name}
              </option>
            ))}
          </select>
        </label>

        <label className="field" style={{ flex: '0 1 220px' }}>
          <span className="small muted">Prequalification</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as GateStatus | 'all')}
          >
            <option value="all">Any outcome</option>
            <option value="pass">Clear</option>
            <option value="warn">Conditions</option>
            <option value="fail">Gated</option>
          </select>
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={certOnly}
            onChange={(e) => setCertOnly(e.target.checked)}
          />
          <span className="switch-track" aria-hidden="true">
            <span className="switch-thumb" />
          </span>
          <span>DBE / MBE / WBE only</span>
        </label>

        <span className="small muted" style={{ marginLeft: 'auto' }}>
          {visible.length} of {vendors.length} shown
        </span>
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <DataTable
          rows={visible}
          columns={columns}
          rowKey={(v) => `${v.projectId}-${v.vendorId}`}
          caption="Every subcontractor bid across the program"
          initialSortKey="vendor"
          onOpenRow={setOpen}
          emptyMessage="No subcontractors match these filters."
        />
      </div>

      <Drawer
        open={open !== null}
        onClose={() => setOpen(null)}
        eyebrow={open?.trade}
        title={open?.vendorName ?? ''}
        footer={
          open && (
            <Link href={`/p/${open.projectId}/vendors/`} className="btn" data-variant="primary">
              Open full prequalification record
            </Link>
          )
        }
      >
        {open && (
          <>
            <div className="card card-pad" style={{ marginBottom: 16 }}>
              <div className="row row-wrap">
                <span className="muted small" style={{ flex: 1 }}>
                  {open.projectName}
                </span>
                {open.prequal && <GatePill status={open.prequal.status} />}
              </div>
              <div className="num" style={{ marginTop: 8 }}>
                {money(open.submittedTotal)} submitted → <b>{money(open.adjustedTotal)}</b> leveled
              </div>
              <div className="small muted">
                rank {open.adjustedRank} of {open.bidderCount}
                {open.awardScore !== null && ` · award score ${open.awardScore.toFixed(1)}`}
              </div>
            </div>

            {open.prequal ? (
              <>
                {!open.prequal.eligible && (
                  <div
                    className="card card-pad"
                    style={{ marginBottom: 16, borderLeft: '3px solid var(--danger)' }}
                  >
                    {open.prequal.disqualifying_reason}
                  </div>
                )}

                <h3 style={{ marginTop: 0 }}>Gates</h3>
                <div className="stack" style={{ gap: 6, marginBottom: 16 }}>
                  {open.prequal.gates.map((gate) => (
                    <div key={gate.code} className="row row-wrap small">
                      <span style={{ flex: 1 }}>{gate.label}</span>
                      <GatePill status={gate.status} />
                    </div>
                  ))}
                </div>

                <h3>Record</h3>
                <table>
                  <tbody>
                    <tr>
                      <td>EMR</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {open.prequal.emr.toFixed(2)}
                      </td>
                    </tr>
                    <tr>
                      <td>Change-order rate</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {open.prequal.performance.change_order_rate_pct.toFixed(1)}%
                      </td>
                    </tr>
                    <tr>
                      <td>On-time closeout</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {open.prequal.performance.on_time_closeout_pct.toFixed(0)}%
                      </td>
                    </tr>
                    <tr>
                      <td>Years working together</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {open.prequal.performance.years_working_together}
                      </td>
                    </tr>
                    <tr>
                      <td>Surety</td>
                      <td className="num" style={{ textAlign: 'right' }}>
                        {open.prequal.bonding.am_best_rating}
                      </td>
                    </tr>
                  </tbody>
                </table>

                {open.prequal.participation_certifications.length > 0 && (
                  <div className="row row-wrap" style={{ gap: 6, marginTop: 14 }}>
                    {open.prequal.participation_certifications.map((cert) => (
                      <span key={cert} className="pill p-tag">
                        {cert}
                      </span>
                    ))}
                  </div>
                )}
              </>
            ) : (
              <p className="muted">
                This package carries no prequalification records, so there is nothing to gate this
                bid against.
              </p>
            )}
          </>
        )}
      </Drawer>
    </>
  );
}
