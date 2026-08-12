import Link from 'next/link';
import { Icon, type IconName } from './Icons';

/**
 * Used by the program-level sidebar sections that do not have a rollup yet.
 *
 * Each one names the per-package view that already does this work and links
 * straight to it, so a visitor who clicks Findings in the sidebar lands
 * somewhere real rather than on a dead end.
 */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  actionHref,
}: {
  icon: IconName;
  title: string;
  body: string;
  actionLabel: string;
  actionHref: string;
}) {
  return (
    <div className="empty-state card">
      <span className="empty-state-icon">
        <Icon name={icon} size={22} />
      </span>
      <h2 className="empty-state-title">{title}</h2>
      <p className="empty-state-body">{body}</p>
      <Link className="btn" data-variant="primary" href={actionHref}>
        {actionLabel}
      </Link>
    </div>
  );
}
