'use client';

import { useMemo, useRef, useState } from 'react';
import { useStore } from '@/lib/store';
import { ConfidencePill, ScopePill, SectionHead, StatusPill } from '@/components/Bits';
import { formatDate, money, shortHash } from '@/lib/format';
import type { ScopeStatus, Submission } from '@/lib/types';

const SCOPE_STATUSES: ScopeStatus[] = ['Included', 'Excluded', 'Unclear', 'NotFound'];

/** Extracted fields a reviewer signs off on individually. */
function extractedFields(s: Submission) {
  const fields: { key: string; label: string; value: string; citation?: string }[] = [
    { key: 'base_bid', label: 'Base bid', value: money(s.base_bid, 2), citation: 'base_bid' },
    {
      key: 'drawing_revision_referenced',
      label: 'Drawings cited',
      value: s.drawing_revision_referenced ?? 'not stated',
      citation: 'drawing_revision_referenced',
    },
    {
      key: 'line_item_total',
      label: 'Line-item sum',
      value: s.line_item_total === null ? 'lump sum, no breakdown' : money(s.line_item_total, 2),
      citation: 'line_items',
    },
  ];
  for (const a of s.allowances) {
    fields.push({
      key: `allowance:${a.name}`,
      label: a.name,
      value: `${money(a.amount, 2)}${a.included_in_base_bid ? ' (in base bid)' : ' (outside base bid)'}`,
      citation: 'lighting_fixture_allowance',
    });
  }
  for (const a of s.alternates) {
    fields.push({
      key: `alternate:${a.id}`,
      label: `Alternate ${a.id}`,
      value: `${money(a.amount, 2)}${a.included_in_base_bid ? ' (in base bid)' : ' (not in base bid)'}`,
      citation: `alternate_${a.id.toLowerCase()}`,
    });
  }
  return fields;
}

export default function ReviewPage() {
  const { data, reviews, setBidStatus, setBidNote, setFieldDecision, setScopeOverride, clearScopeOverride } =
    useStore();

  const [activeId, setActiveId] = useState(data.submissions[0].bid_id);
  const [highlight, setHighlight] = useState<{ page: number; section: string } | null>(null);
  const sourceRef = useRef<HTMLDivElement>(null);

  const submission = useMemo(
    () => data.submissions.find((s) => s.bid_id === activeId)!,
    [data.submissions, activeId]
  );
  const review = reviews[activeId] ?? {
    status: 'pending' as const,
    reviewer: data.project.estimator,
    decidedAt: null,
    note: '',
    fields: {},
    scopeOverrides: {},
  };

  const jumpToCitation = (citationKey?: string) => {
    if (!citationKey) return;
    const citation = submission.citations[citationKey];
    if (!citation) return;
    setHighlight({ page: citation.page, section: citation.section });
    const el = sourceRef.current?.querySelector(`[data-page="${citation.page}"]`);
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const fields = extractedFields(submission);
  const decidedCount = Object.values(review.fields).filter((f) => f.status !== 'pending').length;

  return (
    <>
      <SectionHead eyebrow="Step 05 · Human review" title="Source against extraction">
        Every figure the model produced sits beside the document it came from. Click any extracted
        value to jump to the page and section it was cited from, then approve it, correct it, or
        reject the whole submission. Nothing here is auto-accepted.
      </SectionHead>

      {/* ---- submission switcher ---- */}
      <div className="card" style={{ marginBottom: 18, overflow: 'hidden' }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Vendor</th>
                <th>Document</th>
                <th className="right">Stated bid</th>
                <th>Confidence</th>
                <th>Review</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.submissions.map((s) => {
                const r = reviews[s.bid_id];
                const isActive = s.bid_id === activeId;
                return (
                  <tr
                    key={s.bid_id}
                    style={{ background: isActive ? 'var(--accent-soft)' : undefined }}
                  >
                    <td>
                      <div style={{ fontWeight: isActive ? 600 : 400 }}>{s.vendor_name}</div>
                      {s.revision_label !== 'Original' && (
                        <div className="small muted">{s.revision_label}</div>
                      )}
                      {s.superseded && <span className="pill p-muted">superseded</span>}
                    </td>
                    <td className="small muted">{s.format}</td>
                    <td className="right num">{money(s.base_bid)}</td>
                    <td>
                      <ConfidencePill tier={s.confidence_tier} />
                    </td>
                    <td>
                      <StatusPill status={r?.status ?? 'pending'} />
                    </td>
                    <td className="right">
                      <button
                        className="btn"
                        data-active={isActive}
                        onClick={() => {
                          setActiveId(s.bid_id);
                          setHighlight(null);
                        }}
                      >
                        {isActive ? 'Reviewing' : 'Open'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ---- side by side ---- */}
      <div className="grid grid-2" style={{ alignItems: 'start' }}>
        {/* left: the actual document */}
        <div className="card no-stick-mobile" style={{ position: 'sticky', top: 108 }}>
          <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              Source truth
            </div>
            <h3>{submission.filename}</h3>
            <div className="small muted" style={{ marginTop: 6 }}>
              {submission.page_count} {submission.page_count === 1 ? 'page' : 'pages'} ·{' '}
              <span className="mono" title={submission.sha256}>
                {shortHash(submission.sha256)}
              </span>
            </div>
            <div className="small muted" style={{ marginTop: 8 }}>
              From {submission.email.sender_name} &lt;{submission.email.sender_email}&gt; ·{' '}
              {formatDate(submission.email.received_at)}
            </div>
          </div>

          <div
            ref={sourceRef}
            style={{ maxHeight: '58vh', overflowY: 'auto', padding: '4px 0' }}
          >
            {submission.email.pricing_in_body && (
              <div
                className="card-pad"
                style={{ borderBottom: '1px solid var(--line)', background: 'var(--warn-soft)' }}
              >
                <div className="small" style={{ color: 'var(--warn)', fontWeight: 600, marginBottom: 6 }}>
                  Pricing arrived in the email body, not the attachment
                </div>
                <pre
                  className="mono small"
                  style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--ink-2)' }}
                >
                  {submission.email.body_text}
                </pre>
              </div>
            )}

            {submission.page_text.map((page) => {
              const isHit = highlight?.page === page.page_number;
              return (
                <div
                  key={page.page_number}
                  data-page={page.page_number}
                  className="card-pad"
                  style={{
                    borderBottom: '1px solid var(--line)',
                    background: isHit ? 'var(--accent-soft)' : undefined,
                    transition: 'background 180ms',
                  }}
                >
                  <div className="row" style={{ marginBottom: 8 }}>
                    <span className="pill p-muted">Page {page.page_number}</span>
                    {isHit && <span className="pill p-tag">{highlight.section}</span>}
                  </div>
                  <pre
                    className="mono"
                    style={{
                      whiteSpace: 'pre-wrap',
                      margin: 0,
                      fontSize: 'var(--fs-micro)',
                      lineHeight: 1.6,
                      color: 'var(--ink-2)',
                    }}
                  >
                    {page.text}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>

        {/* right: what the model produced */}
        <div className="stack" style={{ gap: 14 }}>
          <div className="card card-pad">
            <div className="eyebrow" style={{ marginBottom: 6 }}>
              AI interpretation
            </div>
            <div className="row row-wrap" style={{ marginBottom: 12 }}>
              <ConfidencePill tier={submission.confidence_tier} />
              <span className="small muted mono">
                {submission.provider}/{submission.model} · {submission.prompt_version}
              </span>
            </div>
            <div className="small muted" style={{ marginBottom: 14 }}>
              Inference <span className="mono">{shortHash(submission.ai_inference_id, 8)}</span> is
              stored as a separate lineage record. It is never merged into the vendor&apos;s
              submitted facts.
            </div>

            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Extracted</th>
                    <th className="right">Decision</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map((field) => {
                    const decision = review.fields[field.key]?.status ?? 'pending';
                    const citation = field.citation ? submission.citations[field.citation] : undefined;
                    return (
                      <tr key={field.key}>
                        <td>
                          <div>{field.label}</div>
                          {citation && (
                            <button
                              className="small mono"
                              onClick={() => jumpToCitation(field.citation)}
                              style={{
                                background: 'none',
                                border: 0,
                                padding: 0,
                                color: 'var(--accent)',
                                cursor: 'pointer',
                                textAlign: 'left',
                              }}
                            >
                              p.{citation.page} · {citation.section}
                            </button>
                          )}
                        </td>
                        <td className="num">{field.value}</td>
                        <td className="right">
                          <div className="seg">
                            <button
                              data-active={decision === 'approved'}
                              onClick={() =>
                                setFieldDecision(activeId, field.key, { status: 'approved' })
                              }
                            >
                              OK
                            </button>
                            <button
                              data-active={decision === 'rejected'}
                              onClick={() =>
                                setFieldDecision(activeId, field.key, { status: 'rejected' })
                              }
                            >
                              Wrong
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* scope assertions, correctable */}
          <div className="card card-pad">
            <h3 style={{ marginBottom: 4 }}>Scope assertions</h3>
            <p className="small muted" style={{ marginTop: 0, marginBottom: 12 }}>
              Correcting a status here re-levels the package immediately.{' '}
              <b>Not found</b> and <b>Excluded</b> are never interchangeable: one is silence, the
              other is a refusal.
            </p>
            <div className="table-scroll">
              <table>
                <tbody>
                  {data.scope_items.map((item) => {
                    const original = submission.scope_assertions[item.key] ?? 'NotFound';
                    const override = review.scopeOverrides[item.key];
                    const current = override ?? original;
                    return (
                      <tr key={item.key}>
                        <td>
                          <div className="small">{item.label}</div>
                          {!item.in_package_scope && (
                            <span className="small muted">carried by another package</span>
                          )}
                        </td>
                        <td style={{ width: 110 }}>
                          <ScopePill status={current} />
                        </td>
                        <td className="right" style={{ width: 190 }}>
                          <select
                            value={current}
                            onChange={(e) => {
                              const next = e.target.value as ScopeStatus;
                              if (next === original) clearScopeOverride(activeId, item.key);
                              else setScopeOverride(activeId, item.key, next);
                            }}
                          >
                            {SCOPE_STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                          {override && (
                            <div className="small" style={{ color: 'var(--warn)', marginTop: 4 }}>
                              corrected from {original}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* sign off */}
          <div className="card card-pad">
            <h3 style={{ marginBottom: 10 }}>Sign off</h3>
            <div className="row row-wrap" style={{ marginBottom: 12 }}>
              <button
                className="btn"
                data-variant="ok"
                data-active={review.status === 'approved'}
                onClick={() => setBidStatus(activeId, 'approved')}
              >
                Approve extraction
              </button>
              <button
                className="btn"
                data-variant="danger"
                data-active={review.status === 'rejected'}
                onClick={() => setBidStatus(activeId, 'rejected')}
              >
                Reject
              </button>
              <button className="btn" onClick={() => setBidStatus(activeId, 'pending')}>
                Reset
              </button>
              <span className="small muted">
                {decidedCount} of {fields.length} fields decided
              </span>
            </div>

            <label className="small muted" htmlFor="review-note">
              Reviewer note
            </label>
            <textarea
              id="review-note"
              rows={3}
              value={review.note}
              placeholder="e.g. Confirmed bond exclusion with Curtis on 8/12. Sending RFI on temporary power."
              onChange={(e) => setBidNote(activeId, e.target.value)}
              style={{ marginTop: 6 }}
            />

            <div className="small muted" style={{ marginTop: 10 }}>
              {review.decidedAt
                ? `${review.status} by ${review.reviewer} · ${formatDate(review.decidedAt)}`
                : `Awaiting decision · assigned to ${review.reviewer}`}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
