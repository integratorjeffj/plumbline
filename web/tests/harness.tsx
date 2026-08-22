import { render as rtlRender, screen as rtlScreen } from '@testing-library/react';
import type { UserEvent } from '@testing-library/user-event';
import type { ReactElement, ReactNode } from 'react';
import { expect } from 'vitest';

type Screen = typeof rtlScreen;

import { PrefsProvider } from '@/lib/prefs';
import { ShellProvider } from '@/lib/shell';
import { ProjectStoreProvider } from '@/lib/store';

/**
 * Renders a route the way the application shell does.
 *
 * The layouts these mirror live in app/layout.tsx and app/p/[projectId]/layout.tsx.
 * If a provider is ever added there and not here, these tests fail loudly on a
 * missing context rather than passing against a shape the app never renders.
 */
function ProgramProviders({ children }: { children: ReactNode }) {
  return (
    <PrefsProvider>
      <ShellProvider>{children}</ShellProvider>
    </PrefsProvider>
  );
}

/** A program-level route: no project in scope. */
export function renderProgram(ui: ReactElement) {
  return rtlRender(ui, { wrapper: ProgramProviders });
}

/** A package-scoped route, inside the project store the real layout supplies. */
export function renderProject(ui: ReactElement, projectId: string) {
  return rtlRender(ui, {
    wrapper: ({ children }) => (
      <ProgramProviders>
        <ProjectStoreProvider projectId={projectId}>{children}</ProjectStoreProvider>
      </ProgramProviders>
    ),
  });
}

/**
 * Every tab on a tabbed page renders something.
 *
 * This is the assertion the suite exists for. A JSX restructure once left two
 * of three panels rendering nothing: valid TypeScript, valid markup, silently
 * empty. Only clicking each tab and looking at the result catches it.
 */
export async function expectEveryTabRenders(user: UserEvent, screen: Screen) {
  const tabs = screen.getAllByRole('tab');
  expect(tabs.length).toBeGreaterThan(1);

  for (const tab of tabs) {
    await user.click(tab);
    const panel = screen.getByRole('tabpanel');
    expect(panel, `panel for tab "${tab.textContent}"`).toBeInTheDocument();
    expect(
      (panel.textContent ?? '').trim().length,
      `tab "${tab.textContent}" rendered an empty panel`
    ).toBeGreaterThan(40);
  }
}
