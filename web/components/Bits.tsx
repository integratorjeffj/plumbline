'use client';

import type { ConfidenceTier, ReviewStatus, ScopeStatus, Severity } from '@/lib/types';

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
          fontSize: 25,
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
