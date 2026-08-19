'use client';

import type { ReactNode } from 'react';

export interface TabDef<K extends string> {
  key: K;
  label: string;
  /** Optional count rendered beside the label, e.g. the number of findings. */
  count?: number;
}

interface TabStripProps<K extends string> {
  tabs: readonly TabDef<K>[];
  active: K;
  onChange: (key: K) => void;
  /** Names the tablist for screen readers, e.g. "Compare sections". */
  label: string;
}

/**
 * Section switcher for a workspace.
 *
 * The alternative these replace is stacking every section of a page vertically,
 * which turns "what did the scope matrix say" into a scroll hunt. Tabs make the
 * sections a reader can choose between visible up front, and keep the answer
 * one click away instead of one scroll-and-search away.
 *
 * Counts sit in the tab rather than only inside the panel so a reader can see
 * there are five findings without opening the findings tab to discover it.
 */
export function TabStrip<K extends string>({ tabs, active, onChange, label }: TabStripProps<K>) {
  return (
    <div className="tab-strip" role="tablist" aria-label={label}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <button
            key={tab.key}
            id={`tab-${tab.key}`}
            type="button"
            role="tab"
            aria-selected={selected}
            aria-controls={`tab-panel-${tab.key}`}
            className="tab-button"
            data-active={selected || undefined}
            onClick={() => onChange(tab.key)}
          >
            {tab.label}
            {typeof tab.count === 'number' && <span className="tab-count num">{tab.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function TabPanel({ tabKey, children }: { tabKey: string; children: ReactNode }) {
  return (
    <div
      id={`tab-panel-${tabKey}`}
      role="tabpanel"
      aria-labelledby={`tab-${tabKey}`}
      tabIndex={0}
      className="tab-panel"
    >
      {children}
    </div>
  );
}
