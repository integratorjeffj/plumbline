import Link from 'next/link';

export function ProjectCard({
  id,
  name,
  packageLabel,
  bidCount,
  alertCount,
}: {
  id: string;
  name: string;
  packageLabel: string;
  bidCount: number;
  alertCount: number;
}) {
  return (
    <Link href={`/p/${id}/`} className="card card-pad project-card">
      <div className="project-card-head">
        <div className="project-card-name">{name}</div>
        {alertCount > 0 && <span className="pill p-danger">{alertCount} alert{alertCount === 1 ? '' : 's'}</span>}
      </div>
      <div className="project-card-meta">{packageLabel}</div>
      <div className="project-card-stats">
        <div>
          <div className="project-card-stat-v">{bidCount}</div>
          <div className="project-card-stat-l">Bids received</div>
        </div>
        <div>
          <div className="project-card-stat-v" style={{ color: alertCount > 0 ? 'var(--danger)' : 'inherit' }}>
            {alertCount}
          </div>
          <div className="project-card-stat-l">High-severity findings</div>
        </div>
      </div>
    </Link>
  );
}
