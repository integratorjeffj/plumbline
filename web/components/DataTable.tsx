'use client';

import { useMemo, useState, type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  /** Numeric columns right-align so magnitudes line up down the column. */
  numeric?: boolean;
  /** Omit to make the column unsortable. */
  sortValue?: (row: T) => number | string;
  render: (row: T) => ReactNode;
  /** Hidden below 900px. Identity and the number a reader came for are never secondary. */
  secondary?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Array<Column<T>>;
  rowKey: (row: T) => string;
  /** Describes the table for screen readers; not shown. */
  caption: string;
  initialSortKey?: string;
  initialDirection?: 'asc' | 'desc';
  emptyMessage?: string;
  /** Opening a row raises a drawer rather than navigating away. */
  onOpenRow?: (row: T) => void;
  rowAttrs?: (row: T) => Record<string, string | undefined>;
}

type Direction = 'asc' | 'desc';

/**
 * A sortable, keyboard-operable table.
 *
 * Sorting lives here rather than in each page so every comparative surface
 * behaves the same way, and so sort state survives opening a row's drawer.
 * Losing your place in a long table is the problem the drawer exists to avoid,
 * and re-sorting underneath the reader would reintroduce it.
 */
export function DataTable<T>({
  rows,
  columns,
  rowKey,
  caption,
  initialSortKey,
  initialDirection = 'asc',
  emptyMessage = 'Nothing matches the current filters.',
  onOpenRow,
  rowAttrs,
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState(initialSortKey ?? '');
  const [direction, setDirection] = useState<Direction>(initialDirection);

  const sorted = useMemo(() => {
    const column = columns.find((c) => c.key === sortKey);
    if (!column?.sortValue) return rows;
    const factor = direction === 'asc' ? 1 : -1;
    return [...rows].sort((left, right) => {
      const a = column.sortValue!(left);
      const b = column.sortValue!(right);
      if (typeof a === 'number' && typeof b === 'number') return (a - b) * factor;
      return String(a).localeCompare(String(b)) * factor;
    });
  }, [rows, columns, sortKey, direction]);

  function toggle(key: string) {
    if (key === sortKey) {
      setDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setDirection('asc');
    }
  }

  if (rows.length === 0) {
    return <p className="table-empty muted">{emptyMessage}</p>;
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => {
              const active = column.key === sortKey;
              return (
                <th
                  key={column.key}
                  data-numeric={column.numeric || undefined}
                  data-secondary={column.secondary || undefined}
                  aria-sort={
                    active ? (direction === 'asc' ? 'ascending' : 'descending') : undefined
                  }
                >
                  {column.sortValue ? (
                    <button
                      type="button"
                      className="th-sort"
                      data-active={active || undefined}
                      onClick={() => toggle(column.key)}
                    >
                      {column.header}
                      <span aria-hidden="true" className="th-arrow">
                        {active ? (direction === 'asc' ? '↑' : '↓') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.header
                  )}
                </th>
              );
            })}
            {onOpenRow && <th className="th-open sr-only">Detail</th>}
          </tr>
        </thead>
        <tbody>
          {sorted.map((row) => (
            <tr key={rowKey(row)} {...(rowAttrs ? rowAttrs(row) : {})}>
              {columns.map((column) => (
                <td
                  key={column.key}
                  data-numeric={column.numeric || undefined}
                  data-secondary={column.secondary || undefined}
                  className={column.numeric ? 'num' : undefined}
                >
                  {column.render(row)}
                </td>
              ))}
              {onOpenRow && (
                <td className="td-open">
                  <button type="button" className="table-open" onClick={() => onOpenRow(row)}>
                    Detail
                  </button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
