import { money } from '@/lib/format';
import type { VendorComparison } from '@/lib/types';

/** Shared by the Compare page and the printable stakeholder report. */
export function RankingTable({ vendors }: { vendors: VendorComparison[] }) {
  const bySubmitted = [...vendors].sort((a, b) => a.submitted_rank - b.submitted_rank);
  const byAdjusted = [...vendors].sort((a, b) => a.adjusted_rank - b.adjusted_rank);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div className="table-scroll">
        <table>
          <thead>
            <tr>
              <th>By submitted price</th>
              <th className="right">Submitted</th>
              <th>By adjusted price</th>
              <th className="right">Adjusted</th>
              <th className="right">Move</th>
            </tr>
          </thead>
          <tbody>
            {bySubmitted.map((v, i) => {
              const adj = byAdjusted[i];
              return (
                <tr key={v.vendor_id}>
                  <td>
                    <span className="muted mono small">{v.submitted_rank}.</span> {v.vendor_name}
                  </td>
                  <td className="right num">{money(v.submitted_total)}</td>
                  <td>
                    <span className="muted mono small">{adj.adjusted_rank}.</span> <b>{adj.vendor_name}</b>
                  </td>
                  <td className="right num">{money(adj.adjusted_total)}</td>
                  <td className="right num">
                    {adj.rank_movement === 0 ? (
                      <span className="muted">—</span>
                    ) : (
                      <span style={{ color: adj.rank_movement > 0 ? 'var(--ok)' : 'var(--danger)' }}>
                        {adj.rank_movement > 0 ? '+' : ''}
                        {adj.rank_movement}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
