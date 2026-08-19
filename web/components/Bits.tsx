'use client';

import type {
  ConfidenceTier,
  CoverageHealth,
  GateStatus,
  ReviewStatus,
  ScopeStatus,
  Severity,
} from '@/lib/types';
import type { RagLevel } from '@/lib/portfolio';
import { Icon, type IconName } from './Icons';

const SCOPE_PILL: Record<ScopeStatus, { cls: string; label: string }> = {
  Included: { cls: 'p-included', label: 'Included' },
  Excluded: { cls: 'p-excluded', label: 'Excluded' },
  Unclear: { cls: 'p-unclear', label: 'Unclear' },
  NotFound: { cls: 'p-notfound', label: 'Not found' },
};

export function ScopePill({ status }: { status: ScopeStatus }) {
  const { cls, label } = SCOPE_PILL[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function ConfidencePill({ tier }: { tier: ConfidenceTier }) {
  const cls = tier === 'HIGH' ? 'p-ok' : tier === 'REVIEW' ? 'p-warn' : 'p-danger';
  return <span className={`pill ${cls}`}>{tier}</span>;
}

export function StatusPill({ status }: { status: ReviewStatus }) {
  const cls =
    status === 'approved' ? 'p-approved' : status === 'rejected' ? 'p-rejected' : 'p-pending';
  return <span className={`pill ${cls}`}>{status}</span>;
}

export function SeverityPill({ severity }: { severity: Severity }) {
  const cls = severity === 'HIGH' ? 'p-danger' : severity === 'MEDIUM' ? 'p-warn' : 'p-muted';
  return <span className={`pill ${cls}`}>{severity}</span>;
}

const RAG_PILL: Record<RagLevel, { cls: string; label: string }> = {
  green: { cls: 'p-ok', label: 'OK' },
  amber: { cls: 'p-warn', label: 'Watch' },
  red: { cls: 'p-danger', label: 'Flag' },
};

/**
 * RAG status as a labeled pill.
 *
 * A bare colored dot asks a reader to hold a color key in their head and
 * excludes anyone who cannot separate red from green. The word is the signal
 * and the color reinforces it, never the other way round.
 */
export function RagPill({ level, title }: { level: RagLevel; title: string }) {
  const { cls, label } = RAG_PILL[level];
  return (
    <span className={`pill ${cls}`} title={title}>
      {label}
      <span className="sr-only">. {title}</span>
    </span>
  );
}

/**
 * RAG status indicator. `showLabel` prints the dimension name beside the dot
 * -- used on the printable report, where color alone doesn't survive
 * black-and-white printing.
 */
export function HealthDot({
  level,
  label,
  showLabel = false,
}: {
  level: RagLevel;
  label: string;
  showLabel?: boolean;
}) {
  return (
    <span className="row" style={{ display: 'inline-flex', gap: 6 }}>
      <span className="health-dot" data-level={level} title={label} aria-label={label} />
      {showLabel && <span className="small muted">{label}</span>}
    </span>
  );
}

export type KpiTone = 'neutral' | 'ok' | 'warn' | 'danger';

/**
 * A portfolio metric tile.
 *
 * The label sits above the value rather than under it because a reader scans
 * this row left to right looking for the number they came for, and a label
 * they hit second is a label they read after already guessing. The icon and
 * the tone are the same signal in two channels, so the tile still reads when
 * printed in greyscale or seen by someone who cannot separate red from green.
 *
 * Passing `onFilter` turns the tile into a button that filters the table
 * below it. Only tiles that name a subset worth isolating should do that; a
 * tile that filters to "everything" is a button that does nothing.
 */
export function KpiTile({
  icon,
  label,
  value,
  note,
  tone = 'neutral',
  onFilter,
  active = false,
  filterLabel,
}: {
  icon: IconName;
  label: string;
  value: string;
  note?: string;
  tone?: KpiTone;
  onFilter?: () => void;
  active?: boolean;
  filterLabel?: string;
}) {
  const body = (
    <>
      <span className="kpi-head">
        <span className="kpi-chip">
          <Icon name={icon} />
        </span>
        <span className="kpi-label">{label}</span>
      </span>
      <span className="kpi-value">{value}</span>
      {note && <span className="kpi-note">{note}</span>}
      {onFilter && (
        <span className="kpi-action">{active ? 'Filtering the table' : filterLabel}</span>
      )}
    </>
  );

  if (!onFilter) {
    return (
      <div className="kpi" data-tone={tone}>
        {body}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="kpi"
      data-tone={tone}
      data-active={active}
      onClick={onFilter}
      aria-pressed={active}
    >
      {body}
    </button>
  );
}

export function Kpi({
  value,
  label,
  flag = false,
}: {
  value: string;
  label: string;
  flag?: boolean;
}) {
  return (
    <div className="card card-pad">
      <div
        className="num"
        style={{
          fontSize: 'var(--fs-metric)',
          fontWeight: 600,
          letterSpacing: '-0.02em',
          color: flag ? 'var(--danger)' : 'inherit',
        }}
      >
        {value}
      </div>
      <div className="small muted" style={{ marginTop: 3, lineHeight: 1.35 }}>
        {label}
      </div>
    </div>
  );
}

const GATE_PILL: Record<GateStatus, { cls: string; label: string }> = {
  pass: { cls: 'p-ok', label: 'Pass' },
  warn: { cls: 'p-warn', label: 'Condition' },
  fail: { cls: 'p-danger', label: 'Gated' },
};

/**
 * A prequalification gate outcome.
 *
 * "Condition" rather than "Warning" because that is what a warn actually is to
 * an estimator: something to clear before subcontract, not a reason to drop the
 * bidder. "Gated" rather than "Fail" because the bidder did not fail at
 * anything -- they are outside a policy the GC set.
 */
export function GatePill({ status }: { status: GateStatus }) {
  const { cls, label } = GATE_PILL[status];
  return <span className={`pill ${cls}`}>{label}</span>;
}

const COVERAGE_PILL: Record<CoverageHealth, { cls: string; label: string }> = {
  healthy: { cls: 'p-ok', label: 'Healthy' },
  thin: { cls: 'p-warn', label: 'Thin' },
  insufficient: { cls: 'p-danger', label: 'Insufficient' },
};

export function CoveragePill({ health }: { health: CoverageHealth }) {
  const { cls, label } = COVERAGE_PILL[health];
  return <span className={`pill ${cls}`}>{label}</span>;
}

/**
 * A 0-100 factor score as a labeled bar.
 *
 * The number is printed alongside rather than replaced by the bar: a bar is
 * good for comparing two rows at a glance and bad for reading an exact value,
 * and this table is asked to do both.
 */
export function ScoreBar({ score, muted = false }: { score: number; muted?: boolean }) {
  return (
    <span className="score-bar" data-muted={muted || undefined}>
      <span className="score-bar-track">
        <span className="score-bar-fill" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
      </span>
      <span className="num small score-bar-value">{score.toFixed(0)}</span>
    </span>
  );
}

export function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="page-head">
      {eyebrow && <div className="eyebrow">{eyebrow}</div>}
      <h1>{title}</h1>
      {children && <p>{children}</p>}
    </div>
  );
}
