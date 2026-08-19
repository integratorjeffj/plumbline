'use client';

import { useMemo, useState } from 'react';
import { useStore } from '@/lib/store';
import { SectionHead } from '@/components/Bits';
import { ColumnChart } from '@/components/Charts';
import { TabPanel, TabStrip, type TabDef } from '@/components/Tabs';
import { IMPORTANCE_LABEL, IMPORTANCE_WEIGHT } from '@/lib/leveling';
import { money, percent } from '@/lib/format';
import type { Importance } from '@/lib/types';

const GRADES: Importance[] = ['critical', 'standard', 'optional', 'ignored'];

type TabKey = 'weighting' | 'impact' | 'master';

export default function SettingsPage() {
  const {
    data,
    settings,
    vendors,
    setImportance,
    setAmount,
    setPriceUnclearScope,
    resetSettings,
    isDirty,
  } = useStore();

  const [tab, setTab] = useState<TabKey>('weighting');

  const requiredKeys = new Set(data.required_scope.map((r) => r.scope_key));

  // What each scope item actually contributes once its grade multiplier is
  // applied. Items that level to nothing are dropped rather than drawn as
  // zero-height bars, which read as data rather than as absence.
  const impact = useMemo(
    () =>
      data.scope_items
        .filter((item) => item.in_package_scope)
        .map((item) => {
          const grade = settings.importance[item.key] ?? 'ignored';
          const amount = settings.amounts[item.key] ?? 0;
          return {
            key: item.key,
            label: item.label,
            value: Math.round(amount * IMPORTANCE_WEIGHT[grade] * 100) / 100,
            color:
              grade === 'critical'
                ? 'var(--danger)'
                : grade === 'optional'
                  ? 'var(--ink-3)'
                  : 'var(--accent)',
          };
        })
        .filter((column) => column.value > 0)
        .sort((a, b) => b.value - a.value),
    [data.scope_items, settings]
  );

  const tabs: TabDef<TabKey>[] = [
    { key: 'weighting', label: 'Weighting' },
    { key: 'impact', label: 'Impact', count: impact.length || undefined },
    { key: 'master', label: 'Master data' },
  ];
  const byAdjusted = [...vendors].sort((a, b) => a.adjusted_rank - b.adjusted_rank);

  return (
    <>
      <SectionHead eyebrow="Configuration" title="Scope and weighting">
        Importance grades decide how hard a missing scope item counts against a bidder. Dollar
        values stay estimator-entered: the platform can detect that a bid excluded permit fees, but
        assigning that gap a price is a human judgment, and it is recorded as one.
      </SectionHead>

      {/* live consequence of the settings */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row row-wrap" style={{ marginBottom: 10 }}>
          <h3 style={{ flex: 1 }}>Current leveled ranking</h3>
          {isDirty ? (
            <>
              <span className="pill p-warn">modified</span>
              <button className="btn" onClick={resetSettings}>
                Reset to pipeline defaults
              </button>
            </>
          ) : (
            <span className="pill p-ok">pipeline defaults</span>
          )}
        </div>
        <div className="row row-wrap" style={{ gap: 10 }}>
          {byAdjusted.map((v) => (
            <div
              key={v.vendor_id}
              className="card card-pad"
              style={{ flex: '1 1 200px', boxShadow: 'none' }}
            >
              <div className="small muted">{v.adjusted_rank}. {v.vendor_name}</div>
              <div className="num" style={{ fontSize: 'var(--fs-h3)', fontWeight: 600 }}>
                {money(v.adjusted_total)}
              </div>
              <div className="small muted">
                {money(v.submitted_total)} submitted · {percent(v.leveling_delta_pct)}
              </div>
            </div>
          ))}
        </div>
      </div>

      <TabStrip tabs={tabs} active={tab} onChange={setTab} label="Scope and weighting sections" />

      {tab === 'weighting' && (
        <TabPanel tabKey="weighting">
      {/* policy toggle */}
      <div className="card card-pad" style={{ marginBottom: 20 }}>
        <div className="row" style={{ alignItems: 'flex-start', gap: 12 }}>
          <label className="switch" style={{ marginTop: 2 }}>
            <input
              type="checkbox"
              checked={settings.priceUnclearScope}
              onChange={(e) => setPriceUnclearScope(e.target.checked)}
            />
            <span className="switch-track" aria-hidden="true">
              <span className="switch-thumb" />
            </span>
            <span className="sr-only">Price ambiguous scope as a gap</span>
          </label>
          <div style={{ flex: 1 }}>
            <b>Price ambiguous scope as a gap</b>
            <div className="small muted" style={{ marginTop: 3 }}>
              Off by default, and that is a policy rather than an oversight. When a proposal says
              temporary power &quot;will be coordinated with the general contractor,&quot; it names a
              future conversation, not a commitment. The default treats that as a clarification to
              send the vendor rather than a cost to assume against them.
            </div>
          </div>
        </div>
      </div>

      {/* taxonomy + weights */}
      <h2 style={{ marginBottom: 4 }}>Scope taxonomy</h2>
      <p className="muted small" style={{ marginTop: 0, marginBottom: 12, maxWidth: '76ch' }}>
        The fourteen canonical items every proposal is normalized into. A fixed vocabulary is what
        makes a comparison matrix possible; the model maps onto it and is not free to invent
        categories.
      </p>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Scope item</th>
                <th>Importance</th>
                <th className="right">Gap value</th>
                <th className="right">Applied</th>
              </tr>
            </thead>
            <tbody>
              {data.scope_items.map((item) => {
                const grade = settings.importance[item.key] ?? 'ignored';
                const amount = settings.amounts[item.key] ?? 0;
                const effective = Math.round(amount * IMPORTANCE_WEIGHT[grade] * 100) / 100;
                const spec = data.required_scope.find((r) => r.scope_key === item.key);

                return (
                  <tr key={item.key}>
                    <td>
                      <div>{item.label}</div>
                      <div className="small muted mono">{item.key}</div>
                      <div className="row row-wrap" style={{ gap: 6, marginTop: 4 }}>
                        {requiredKeys.has(item.key) && (
                          <span className="pill p-tag">spec {spec?.spec_section}</span>
                        )}
                        {!item.in_package_scope && (
                          <span className="pill p-muted">other package</span>
                        )}
                      </div>
                    </td>
                    <td>
                      {item.in_package_scope ? (
                        <div className="seg">
                          {GRADES.map((g) => (
                            <button
                              key={g}
                              data-active={grade === g}
                              onClick={() => setImportance(item.key, g)}
                              title={`Weight ${IMPORTANCE_WEIGHT[g]}×`}
                            >
                              {IMPORTANCE_LABEL[g]}
                            </button>
                          ))}
                        </div>
                      ) : (
                        <span className="small muted">
                          Never leveled here; pricing it would double-count another package&apos;s
                          budget.
                        </span>
                      )}
                    </td>
                    <td className="right" style={{ width: 150 }}>
                      {item.in_package_scope && grade !== 'ignored' ? (
                        <input
                          type="number"
                          value={amount}
                          min={0}
                          step={100}
                          onChange={(e) => setAmount(item.key, Number(e.target.value) || 0)}
                          className="num"
                        />
                      ) : (
                        <span className="muted small">not priced</span>
                      )}
                    </td>
                    <td className="right num" style={{ width: 120 }}>
                      {effective > 0 ? (
                        <>
                          {money(effective)}
                          {IMPORTANCE_WEIGHT[grade] !== 1 && (
                            <div className="small muted">{IMPORTANCE_WEIGHT[grade]}× weighted</div>
                          )}
                        </>
                      ) : (
                        <span className="muted">not leveled</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="note" style={{ marginTop: 14, marginBottom: 30 }}>
        <b>Provenance.</b> Baseline values entered by {data.adjustment_rules.entered_by},{' '}
        {data.adjustment_rules.entered_role}, recorded as{' '}
        <span className="mono">{data.adjustment_rules.source}</span>. The loader in{' '}
        <span className="mono">src/comparison/adjustments.py</span> refuses any adjustment file not
        marked that way, so an AI-suggested number cannot enter the pricing path by accident.
      </div>
        </TabPanel>
      )}

      {tab === 'impact' && (
        <TabPanel tabKey="impact">
          <div className="card card-pad">
            <h3 style={{ marginTop: 0, marginBottom: 4 }}>What each scope item is worth</h3>
            <p className="small muted" style={{ marginTop: 0, marginBottom: 16 }}>
              The value a missing item adds to a bid, after its importance multiplier. Red is
              critical scope carried at a risk premium, grey is optional scope discounted because
              the estimator may accept it as-is. Change a grade on the Weighting tab and these move.
            </p>
            {impact.length === 0 ? (
              <p className="muted">
                Nothing is priced right now. Every in-package item is graded &ldquo;not
                leveled&rdquo; or carries no estimator value.
              </p>
            ) : (
              <ColumnChart
                columns={impact}
                height={190}
                ariaLabel="Leveling value by scope item"
                formatValue={(v) => money(v)}
              />
            )}
          </div>
        </TabPanel>
      )}

      {tab === 'master' && (
        <TabPanel tabKey="master">
      {/* master data */}
      <h2 style={{ marginBottom: 12 }}>Project master data</h2>
      <div className="grid grid-2">
        <div className="card card-pad">
          <h3 style={{ marginBottom: 10 }}>Package</h3>
          <table>
            <tbody>
              {[
                ['Project', `${data.project.project_name} (${data.project.project_number})`],
                ['Customer', data.project.customer],
                ['General contractor', data.project.general_contractor],
                ['Bid package', `${data.project.bid_package_number} · ${data.project.bid_package_description}`],
                ['Drawing revision', data.project.drawing_revision],
                ['Budget', money(data.project.budget)],
                ['Estimator', data.project.estimator],
              ].map(([k, v]) => (
                <tr key={k}>
                  <td className="muted small">{k}</td>
                  <td>{v}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card card-pad">
          <h3 style={{ marginBottom: 10 }}>Bidders</h3>
          <table>
            <tbody>
              {vendors.map((v) => (
                <tr key={v.vendor_id}>
                  <td>
                    <div>{v.vendor_name}</div>
                    <div className="small muted mono">{v.vendor_id}</div>
                  </td>
                  <td className="right num">{money(v.submitted_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="small muted" style={{ marginTop: 10 }}>
            Master data is read-only in this build. Editing vendors and packages arrives with the
            CRM integration.
          </div>
        </div>
      </div>
        </TabPanel>
      )}
    </>
  );
}
