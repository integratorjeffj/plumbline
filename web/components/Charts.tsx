'use client';

import { useId, useState, type ReactNode } from 'react';

export interface Segment {
  key: string;
  label: string;
  value: number;
  /** A CSS color or custom property reference. */
  color: string;
  /** Extra lines shown in the hover card. */
  detail?: string;
}

/**
 * Charts here are hand-drawn SVG rather than a charting library.
 *
 * The app ships as a static export with a deliberately short dependency list,
 * and every chart it needs is a bar or a ring. A library would add more weight
 * than the four shapes below cost to write.
 *
 * Every chart carries a text equivalent. A hover card is unreachable by
 * keyboard-only and screen-reader users, so the same numbers are also in an
 * aria-label and, where the chart is load-bearing, in a legend beneath it.
 */

function HoverCard({ children, x }: { children: ReactNode; x: number }) {
  return (
    <div className="chart-hover" style={{ left: `${x}%` }} role="presentation">
      {children}
    </div>
  );
}

/**
 * A single horizontal bar split into segments, each hoverable.
 *
 * Used where one quantity decomposes into named parts -- a leveled total into
 * its priced scope gaps, an invitation list into responded/declined/silent.
 */
export function SegmentedBar({
  segments,
  total,
  height = 14,
  ariaLabel,
  formatValue = (v) => String(v),
}: {
  segments: Segment[];
  total?: number;
  height?: number;
  ariaLabel: string;
  formatValue?: (value: number) => string;
}) {
  const [active, setActive] = useState<string | null>(null);
  const sum = total ?? segments.reduce((acc, s) => acc + s.value, 0);
  const activeSegment = segments.find((s) => s.key === active);

  let offset = 0;
  const placed = segments.map((segment) => {
    const width = sum > 0 ? (segment.value / sum) * 100 : 0;
    const mid = offset + width / 2;
    const item = { segment, width, left: offset, mid };
    offset += width;
    return item;
  });

  return (
    <div className="chart-wrap">
      <div
        className="seg-bar"
        style={{ height }}
        role="img"
        aria-label={`${ariaLabel}. ${segments.map((s) => `${s.label} ${formatValue(s.value)}`).join(', ')}.`}
      >
        {placed.map(({ segment, width, left }) => (
          <span
            key={segment.key}
            className="seg-fill"
            data-active={active === segment.key || undefined}
            style={{ left: `${left}%`, width: `${width}%`, background: segment.color }}
            onMouseEnter={() => setActive(segment.key)}
            onMouseLeave={() => setActive(null)}
          />
        ))}
      </div>

      {activeSegment && (
        <HoverCard x={placed.find((p) => p.segment.key === active)?.mid ?? 50}>
          <b>{activeSegment.label}</b>
          <span className="num">{formatValue(activeSegment.value)}</span>
          {activeSegment.detail && <span className="small muted">{activeSegment.detail}</span>}
        </HoverCard>
      )}
    </div>
  );
}

/**
 * A ring chart for a small set of mutually exclusive categories.
 *
 * Capped at a handful of segments on purpose: past that, angle comparison stops
 * working and a bar chart is the honest choice.
 */
export function DonutChart({
  segments,
  size = 132,
  thickness = 16,
  centerLabel,
  centerValue,
  ariaLabel,
  onSelect,
  selected,
}: {
  segments: Segment[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string;
  ariaLabel: string;
  onSelect?: (key: string | null) => void;
  selected?: string | null;
}) {
  const [hovered, setHovered] = useState<string | null>(null);
  const gradientId = useId();
  const total = segments.reduce((acc, s) => acc + s.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;

  let consumed = 0;
  const arcs = segments.map((segment) => {
    const fraction = total > 0 ? segment.value / total : 0;
    const arc = {
      segment,
      dash: fraction * circumference,
      gap: circumference - fraction * circumference,
      offset: -consumed * circumference,
      fraction,
    };
    consumed += fraction;
    return arc;
  });

  const focus = segments.find((s) => s.key === (hovered ?? selected));

  return (
    <div className="donut-wrap">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${ariaLabel}. ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}.`}
        aria-describedby={gradientId}
      >
        <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={thickness}
          />
          {arcs.map(({ segment, dash, gap, offset }) => {
            const dim = focus !== undefined && focus.key !== segment.key;
            return (
              <circle
                key={segment.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={segment.color}
                strokeWidth={thickness}
                strokeDasharray={`${dash} ${gap}`}
                strokeDashoffset={offset}
                opacity={dim ? 0.28 : 1}
                style={{ cursor: onSelect ? 'pointer' : 'default', transition: 'opacity 120ms ease' }}
                onMouseEnter={() => setHovered(segment.key)}
                onMouseLeave={() => setHovered(null)}
                onClick={() => onSelect?.(selected === segment.key ? null : segment.key)}
              />
            );
          })}
        </g>
      </svg>

      <div className="donut-center">
        <span className="num donut-value">{focus ? focus.value : (centerValue ?? total)}</span>
        <span className="small muted">{focus ? focus.label : (centerLabel ?? 'total')}</span>
      </div>
    </div>
  );
}

/**
 * A vertical column chart with hoverable columns.
 *
 * The scale is printed rather than implied: a bar without a readable axis asks
 * the reader to trust a proportion they cannot check.
 */
export function ColumnChart({
  columns,
  height = 140,
  ariaLabel,
  formatValue = (v) => String(v),
  onSelect,
}: {
  columns: Segment[];
  height?: number;
  ariaLabel: string;
  formatValue?: (value: number) => string;
  onSelect?: (key: string) => void;
}) {
  const [active, setActive] = useState<string | null>(null);
  const max = Math.max(...columns.map((c) => c.value), 1);

  return (
    <div className="column-chart" style={{ height }} role="img"
         aria-label={`${ariaLabel}. ${columns.map((c) => `${c.label} ${formatValue(c.value)}`).join(', ')}.`}>
      {columns.map((column) => {
        const pct = (column.value / max) * 100;
        return (
          <div
            key={column.key}
            className="column-slot"
            data-active={active === column.key || undefined}
            onMouseEnter={() => setActive(column.key)}
            onMouseLeave={() => setActive(null)}
            onClick={() => onSelect?.(column.key)}
            style={{ cursor: onSelect ? 'pointer' : 'default' }}
          >
            <span className="column-value num">{formatValue(column.value)}</span>
            <span className="column-fill" style={{ height: `${pct}%`, background: column.color }} />
            <span className="column-label small">{column.label}</span>
          </div>
        );
      })}
    </div>
  );
}
