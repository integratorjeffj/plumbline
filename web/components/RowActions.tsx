'use client';

/**
 * The per-row overflow menu on the package table.
 *
 * Every destination it offers already exists as a route, so this is a
 * shortcut rather than a new capability: it saves opening a package just to
 * navigate one level further into it.
 */

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import { Icon } from './Icons';

export function RowActions({
  projectId,
  projectName,
  open,
  onToggle,
  onClose,
}: {
  projectId: string;
  projectName: string;
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  const items = [
    { href: `/p/${projectId}/`, label: 'Open package overview' },
    { href: `/p/${projectId}/review/`, label: 'Review submissions' },
    { href: `/p/${projectId}/settings/`, label: 'Scope and weighting' },
    { href: `/p/${projectId}/report/`, label: 'Stakeholder report' },
  ];

  return (
    <div className="row-actions" ref={ref} onClick={(e) => e.stopPropagation()}>
      <button
        type="button"
        className="row-actions-btn"
        onClick={onToggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Actions for ${projectName}`}
      >
        <Icon name="more" />
      </button>
      {open && (
        <div className="row-actions-menu" role="menu">
          {items.map((item) => (
            <Link key={item.href} href={item.href} role="menuitem" onClick={onClose}>
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
