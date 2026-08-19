'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { SectionHead } from '@/components/Bits';
import { TabPanel, TabStrip, type TabDef } from '@/components/Tabs';
import { PROJECT_IDS } from '@/lib/projects';

type TabKey = 'pipeline' | 'integrations' | 'proof';
type Maturity = 'live' | 'ready' | 'simulated' | 'planned';

const MATURITY_LABEL: Record<Maturity, string> = {
  live: 'Live',
  ready: 'Ready, key required',
  simulated: 'Simulated',
  planned: 'Planned',
};

const MATURITY_PILL: Record<Maturity, string> = {
  live: 'p-ok',
  ready: 'p-warn',
  simulated: 'p-muted',
  planned: 'p-tag',
};

interface Capability {
  name: string;
  maturity: Maturity;
  body: string;
}

/**
 * The honest boundary of the system.
 *
 * A portfolio project that implies connections it does not have is worse than
 * one that states where the line is, so every capability carries its maturity
 * and the filter defaults to showing all of them rather than the flattering
 * subset.
 */
const CAPABILITIES: Capability[] = [
  {
    name: 'Document extraction',
    maturity: 'live',
    body: 'Real PDF and Excel parsing via pdfplumber and openpyxl. Page and sheet positions are preserved, so every extracted figure carries a citation back to where it was read.',
  },
  {
    name: 'Scope normalization and leveling',
    maturity: 'live',
    body: 'Deterministic Python. Maps free-text scope language onto a fixed 14-item taxonomy, then prices what each bidder left out.',
  },
  {
    name: 'Anomaly detection',
    maturity: 'live',
    body: 'Ten deterministic rules. No model is involved, so every finding is reproducible and explainable line by line.',
  },
  {
    name: 'Prequalification gates',
    maturity: 'live',
    body: 'EMR, insurance limits, certificate currency, single-project and aggregate bonding capacity, and review staleness, evaluated as of a stated date rather than "now".',
  },
  {
    name: 'Weighted award model',
    maturity: 'live',
    body: 'Scored in Python and mirrored in the browser so the weights move the ranking without a round trip. A parity check asserts the two agree on every load.',
  },
  {
    name: 'Bid coverage and addenda',
    maturity: 'live',
    body: 'Measured from the invitation out. Addendum acknowledgment is inferred from the drawing revision each proposal cited, rather than from a signature.',
  },
  {
    name: 'Claude extraction',
    maturity: 'ready',
    body: 'The Anthropic adapter is built and schema-constrained via tool use. This demo ships with recorded responses so it runs offline and deterministically; a live evaluation harness scores real model output against the same answer key.',
  },
  {
    name: 'Email intake',
    maturity: 'simulated',
    body: 'Inbound bids arrive as JSON fixtures shaped like real webhook payloads. Production swaps in a Microsoft Graph or Gmail subscription behind the same interface.',
  },
  {
    name: 'Document upload',
    maturity: 'simulated',
    body: 'A dropped file is hashed with a real SHA-256 in the browser. Parsing and extraction need the Python service behind it.',
  },
  {
    name: 'CRM writeback',
    maturity: 'planned',
    body: 'Pushing leveled results back to Procore or Autodesk Construction Cloud. The bid record already carries the identifiers this needs.',
  },
  {
    name: 'Workflow orchestration',
    maturity: 'planned',
    body: 'n8n would handle routing only: email arrives, call the API, notify the estimator. Business logic stays in the application, never in the automation tool.',
  },
];

const PIPELINE = [
  { n: '01', name: 'Intake', kind: 'Deterministic', body: 'A bid arrives with attachments and is hashed with SHA-256 before anything else touches it.' },
  { n: '02', name: 'Extract', kind: 'Deterministic', body: 'Page-aware text from PDF, sheet-aware from Excel, plus the email body when the pricing lives there instead of the attachment.' },
  { n: '03', name: 'Interpret', kind: 'AI', body: 'Claude maps prose onto the fixed scope taxonomy and pulls the figures, constrained by a schema passed as a tool definition.' },
  { n: '04', name: 'Level', kind: 'Deterministic', body: 'Scope gaps priced with estimator-entered values. Ranking, gates, and the award model are all ordinary code.' },
  { n: '05', name: 'Decide', kind: 'Human', body: 'A reviewer approves or rejects each extraction and records a soft award. The system never awards a bid.' },
];

const PROOF = [
  { figure: '204', label: 'deterministic tests', body: 'The full suite runs against recorded model responses, so continuous integration never depends on a live API call, a network connection, or a model’s mood on a given day.' },
  { figure: '113', label: 'golden assertions', body: 'A hand-authored answer key covers rankings, adjusted totals, the scope matrix, revision diffs, and every expected finding, including the one expected to stay silent.' },
  { figure: '2', label: 'parity checks', body: 'The browser re-implements leveling and award scoring for instant interactivity. Both are asserted against the Python pipeline on every load, so drift surfaces as a visible failure instead of a plausible number.' },
  { figure: '100%', label: 'inference lineage', body: 'Every AI output is stored separately from vendor-submitted fact, with provider, model, prompt version, source document hash, confidence tier, and review status.' },
];

export default function HowItWorksPage() {
  const [tab, setTab] = useState<TabKey>('pipeline');
  const [maturityFilter, setMaturityFilter] = useState<Maturity | 'all'>('all');

  const counts = useMemo(() => {
    const out: Record<string, number> = { all: CAPABILITIES.length };
    for (const c of CAPABILITIES) out[c.maturity] = (out[c.maturity] ?? 0) + 1;
    return out;
  }, []);

  const visible = useMemo(
    () =>
      maturityFilter === 'all'
        ? CAPABILITIES
        : CAPABILITIES.filter((c) => c.maturity === maturityFilter),
    [maturityFilter]
  );

  const tabs: TabDef<TabKey>[] = [
    { key: 'pipeline', label: 'The pipeline' },
    { key: 'integrations', label: 'What is real', count: CAPABILITIES.length },
    { key: 'proof', label: 'How it is proven' },
  ];

  return (
    <>
      <SectionHead eyebrow="Program" title="How Plumbline works">
        A general contractor&rsquo;s estimator receives four bids for the same electrical package in
        four different formats. The cheapest one is rarely the cheapest one. Plumbline normalizes
        every bid onto a single scope vocabulary, prices the gaps each vendor left out, and re-ranks
        them on what they would actually cost.
      </SectionHead>

      <div className="card card-pad" style={{ marginBottom: 20, borderLeft: '3px solid var(--accent)' }}>
        <b>The low bidder moved from first to last.</b>{' '}
        <span style={{ color: 'var(--ink-2)' }}>
          It also found the arc-flash study required by specification 26 05 73 that none of the four
          bidders covered, which no side-by-side price comparison can surface.
        </span>{' '}
        <Link href={`/p/${PROJECT_IDS[0]}/compare/`}>See the leveled comparison</Link>.
      </div>

      <TabStrip tabs={tabs} active={tab} onChange={setTab} label="How it works sections" />

      {tab === 'pipeline' && (
        <TabPanel tabKey="pipeline">
          <p className="muted" style={{ marginTop: 0, marginBottom: 16, maxWidth: '76ch' }}>
            The division of labor is deliberate. The model reads prose and decides what a sentence
            means. Everything that produces a number is ordinary code, which is what makes the
            output reproducible and auditable.
          </p>
          <div className="grid grid-stages">
            {PIPELINE.map((stage) => (
              <div key={stage.n} className="card card-pad">
                <div className="row" style={{ marginBottom: 6 }}>
                  <span className="mono small muted" style={{ flex: 1 }}>
                    {stage.n}
                  </span>
                  <span
                    className={`pill ${stage.kind === 'AI' ? 'p-warn' : stage.kind === 'Human' ? 'p-tag' : 'p-ok'}`}
                  >
                    {stage.kind}
                  </span>
                </div>
                <h3 style={{ marginTop: 0, marginBottom: 6 }}>{stage.name}</h3>
                <p className="small" style={{ color: 'var(--ink-2)', margin: 0 }}>
                  {stage.body}
                </p>
              </div>
            ))}
          </div>
        </TabPanel>
      )}

      {tab === 'integrations' && (
        <TabPanel tabKey="integrations">
          <p className="muted" style={{ marginTop: 0, marginBottom: 14, maxWidth: '76ch' }}>
            A portfolio project that implies connections it does not have is worse than one that
            states where the line is. Filter by maturity.
          </p>

          <div className="row row-wrap" style={{ gap: 8, marginBottom: 16 }}>
            {(['all', 'live', 'ready', 'simulated', 'planned'] as const).map((key) => (
              <button
                key={key}
                type="button"
                className="btn"
                data-active={maturityFilter === key || undefined}
                onClick={() => setMaturityFilter(key)}
                aria-pressed={maturityFilter === key}
              >
                {key === 'all' ? 'Everything' : MATURITY_LABEL[key]}
                <span className="tab-count num" style={{ marginLeft: 7 }}>
                  {counts[key] ?? 0}
                </span>
              </button>
            ))}
          </div>

          <div className="stack" style={{ gap: 8 }}>
            {visible.map((capability) => (
              <div key={capability.name} className="card card-pad">
                <div className="row row-wrap" style={{ alignItems: 'flex-start' }}>
                  <b style={{ flex: 1 }}>{capability.name}</b>
                  <span className={`pill ${MATURITY_PILL[capability.maturity]}`}>
                    {MATURITY_LABEL[capability.maturity]}
                  </span>
                </div>
                <div className="small" style={{ color: 'var(--ink-2)', marginTop: 6 }}>
                  {capability.body}
                </div>
              </div>
            ))}
          </div>
        </TabPanel>
      )}

      {tab === 'proof' && (
        <TabPanel tabKey="proof">
          <div className="grid grid-4" style={{ marginBottom: 20 }}>
            {PROOF.map((item) => (
              <div key={item.label} className="card card-pad">
                <div
                  className="num"
                  style={{ fontSize: 'var(--fs-metric)', fontWeight: 600, letterSpacing: '-0.02em' }}
                >
                  {item.figure}
                </div>
                <div className="small muted" style={{ marginTop: 3 }}>
                  {item.label}
                </div>
                <p className="small" style={{ color: 'var(--ink-2)', marginTop: 10, marginBottom: 0 }}>
                  {item.body}
                </p>
              </div>
            ))}
          </div>

          <div className="card card-pad">
            <h3 style={{ marginTop: 0 }}>All demo data is synthetic</h3>
            <p style={{ color: 'var(--ink-2)', marginBottom: 0 }}>
              Crestmark Construction Partners, the three projects, and every bidder are fictional.
              No real bid data is represented anywhere in this repository.
            </p>
          </div>
        </TabPanel>
      )}
    </>
  );
}
