'use client';

import { useCallback, useState } from 'react';
import { useStore } from '@/lib/store';
import { SectionHead } from '@/components/Bits';
import { formatDate, money, shortHash } from '@/lib/format';

type ConnectorState = 'simulated' | 'planned';

interface Connector {
  name: string;
  state: ConnectorState;
  ingests: string;
  detail: string;
}

const CONNECTORS: Connector[] = [
  {
    name: 'Outlook / Microsoft 365',
    state: 'simulated',
    ingests: 'Inbound bid emails and attachments',
    detail:
      'A Graph subscription on the estimating mailbox fires a webhook per message. The demo replays the same payload shape from JSON fixtures, so the intake code path is already the real one.',
  },
  {
    name: 'Gmail / Google Workspace',
    state: 'simulated',
    ingests: 'Inbound bid emails and attachments',
    detail:
      'Gmail push notifications over Pub/Sub. Same normalized envelope as Graph, so downstream extraction does not know or care which mailbox a bid arrived from.',
  },
  {
    name: 'OneDrive / SharePoint',
    state: 'planned',
    ingests: 'Bid folders dropped by subcontractors',
    detail:
      'Watch a per-package folder and ingest on file creation. Useful for vendors who share a link instead of attaching.',
  },
  {
    name: 'Google Drive',
    state: 'planned',
    ingests: 'Shared bid folders',
    detail: 'Drive change notifications scoped to a package folder, same handler as OneDrive.',
  },
  {
    name: 'Procore',
    state: 'planned',
    ingests: 'Bid packages, vendors, awarded values',
    detail:
      'The system of record most GCs already run. Pulls package and vendor master data in, pushes leveled results and the award decision back out.',
  },
  {
    name: 'Autodesk Construction Cloud',
    state: 'planned',
    ingests: 'Drawings, specifications, revisions',
    detail:
      'Current drawing revision and spec sections drive the stale-revision and required-scope checks. Today those come from a curated fixture.',
  },
  {
    name: 'Notion',
    state: 'planned',
    ingests: 'Estimating notes and clarification logs',
    detail:
      'Push clarification requests and reviewer notes into the team workspace so the RFI trail lives where the team already works.',
  },
];

interface UploadedFile {
  name: string;
  size: number;
  sha256: string;
  type: string;
  at: string;
}

export default function SourcesPage() {
  const { data, mode, setMode } = useStore();
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);

  const ingest = useCallback(async (files: FileList | null) => {
    if (!files?.length) return;
    setBusy(true);
    const added: UploadedFile[] = [];

    for (const file of Array.from(files)) {
      // Real hashing, in the browser. This is the same provenance step the
      // pipeline performs first, so even in the static demo the number shown is
      // genuinely computed from the bytes the user picked.
      const buffer = await file.arrayBuffer();
      const digest = await crypto.subtle.digest('SHA-256', buffer);
      const sha256 = Array.from(new Uint8Array(digest))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join('');

      added.push({
        name: file.name,
        size: file.size,
        sha256,
        type: file.type || 'unknown',
        at: new Date().toISOString(),
      });
    }

    setUploads((u) => [...added, ...u]);
    setBusy(false);
  }, []);

  return (
    <>
      <SectionHead eyebrow="Step 01 · Intake" title="Where bids come from">
        The console runs against recorded pipeline output by default so it demonstrates without any
        setup. Switching to live mode shows the same interface wired to a real mailbox or an
        uploaded document.
      </SectionHead>

      {/* mode switch */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row row-wrap">
          <div style={{ flex: 1 }}>
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>Data source</h3>
            <div className="small muted">
              {mode === 'demo'
                ? 'Showing the four synthetic bids from the Falcon Medical Center package.'
                : 'Live mode. No connector is authorized yet, so no real bids can arrive.'}
            </div>
          </div>
          <div className="seg">
            <button data-active={mode === 'demo'} onClick={() => setMode('demo')}>
              Demo documents
            </button>
            <button data-active={mode === 'live'} onClick={() => setMode('live')}>
              Live sources
            </button>
          </div>
        </div>
      </div>

      {mode === 'demo' ? (
        <div className="card" style={{ marginBottom: 30, overflow: 'hidden' }}>
          <div className="card-pad" style={{ borderBottom: '1px solid var(--line)' }}>
            <h3 style={{ fontSize: 15 }}>Loaded demo documents</h3>
            <div className="small muted" style={{ marginTop: 4 }}>
              Hashed on arrival, so every downstream figure traces back to exact bytes.
            </div>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Document</th>
                  <th>Arrived</th>
                  <th>Format</th>
                  <th>SHA-256</th>
                  <th className="right">Stated bid</th>
                </tr>
              </thead>
              <tbody>
                {data.submissions.map((s) => (
                  <tr key={s.bid_id}>
                    <td>
                      <div>{s.filename}</div>
                      <div className="small muted">{s.vendor_name}</div>
                    </td>
                    <td className="small muted">{formatDate(s.email.received_at)}</td>
                    <td className="small muted">{s.format}</td>
                    <td className="mono small" title={s.sha256}>
                      {shortHash(s.sha256)}
                    </td>
                    <td className="right num">{money(s.base_bid)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="card card-pad" style={{ marginBottom: 30 }}>
          <h3 style={{ fontSize: 15, marginBottom: 4 }}>Upload a document</h3>
          <p className="small muted" style={{ marginTop: 0 }}>
            Drop a real subcontractor proposal to see the first pipeline step run for real. The file
            never leaves your browser.
          </p>

          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              void ingest(e.dataTransfer.files);
            }}
            style={{
              border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--line-2)'}`,
              background: dragging ? 'var(--accent-soft)' : 'var(--surface-2)',
              borderRadius: 'var(--radius)',
              padding: '28px 18px',
              textAlign: 'center',
              marginTop: 12,
            }}
          >
            <div style={{ marginBottom: 10, color: 'var(--ink-2)' }}>
              {busy ? 'Hashing…' : 'Drop a PDF or Excel file here'}
            </div>
            <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
              Choose a file
              <input
                type="file"
                multiple
                accept=".pdf,.xlsx,.xlsm"
                onChange={(e) => void ingest(e.target.files)}
                className="sr-only"
              />
            </label>
          </div>

          {uploads.length > 0 && (
            <div className="table-scroll" style={{ marginTop: 16 }}>
              <table>
                <thead>
                  <tr>
                    <th>File</th>
                    <th className="right">Size</th>
                    <th>SHA-256 (computed here)</th>
                    <th>Extraction</th>
                  </tr>
                </thead>
                <tbody>
                  {uploads.map((u) => (
                    <tr key={u.sha256 + u.at}>
                      <td>{u.name}</td>
                      <td className="right num">{(u.size / 1024).toFixed(1)} kB</td>
                      <td className="mono small" title={u.sha256}>
                        {shortHash(u.sha256, 20)}
                      </td>
                      <td>
                        <span className="pill p-sim">needs backend</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="note" style={{ marginTop: 16 }}>
            <b>What just happened, honestly.</b> The SHA-256 above is real, computed from your file
            in the browser. That is genuinely step one of the pipeline. Steps two and three are not
            possible here: parsing PDFs and calling Claude require the Python service, and this
            console is a static site with no server and no place to keep an API key. Running{' '}
            <span className="mono">python scripts/run_comparison.py</span> in the repo does the full
            job today.
          </div>
        </div>
      )}

      {/* connectors */}
      <h2 style={{ fontSize: 20, marginBottom: 4 }}>Connectors</h2>
      <p className="muted small" style={{ marginTop: 0, marginBottom: 14, maxWidth: '76ch' }}>
        Nothing below is authorized or transmitting. Each card describes what the integration would
        ingest and how far the code actually goes today.
      </p>
      <div className="grid grid-3">
        {CONNECTORS.map((c) => (
          <div key={c.name} className="card card-pad">
            <div className="row" style={{ marginBottom: 8 }}>
              <span className={`pill ${c.state === 'simulated' ? 'p-sim' : 'p-plan'}`}>
                {c.state}
              </span>
            </div>
            <h3 style={{ fontSize: 15, marginBottom: 4 }}>{c.name}</h3>
            <div className="small" style={{ color: 'var(--ink-2)', marginBottom: 8 }}>
              {c.ingests}
            </div>
            <p className="small muted" style={{ margin: 0 }}>
              {c.detail}
            </p>
            <button className="btn" disabled style={{ marginTop: 12 }}>
              Connect
            </button>
          </div>
        ))}
      </div>

      <div className="note" style={{ marginTop: 20 }}>
        <b>Why intake is simulated rather than stubbed.</b> The demo replays the exact webhook
        envelope Microsoft Graph and Gmail produce, so{' '}
        <span className="mono">src/intake/email_event.py</span> is production code running against
        recorded input. Swapping in a live mailbox is a credentials and subscription problem, not a
        rewrite.
      </div>
    </>
  );
}
