import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

const PROJECT_ID = 'falcon-medical';

vi.mock('next/navigation', () => ({
  useParams: () => ({ projectId: PROJECT_ID }),
  usePathname: () => `/p/${PROJECT_ID}/`,
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import AwardPage from '@/app/p/[projectId]/award/page';
import ComparePage from '@/app/p/[projectId]/compare/page';
import OverviewPage from '@/app/p/[projectId]/page';
import PrequalPage from '@/app/p/[projectId]/vendors/page';
import SettingsPage from '@/app/p/[projectId]/settings/page';
import { expectEveryTabRenders, renderProject } from './harness';

const render = (ui: Parameters<typeof renderProject>[0]) => renderProject(ui, PROJECT_ID);

describe('package routes render', () => {
  it('Overview leads with the leveling inversion', () => {
    render(<OverviewPage />);
    expect(
      screen.getByRole('heading', { name: /the cheapest bid is not the best value/i })
    ).toBeInTheDocument();
    expect(screen.getAllByText(/\$223,700/).length).toBeGreaterThan(0);
  });

  it('Overview reorders the bid chart when the price basis changes', async () => {
    const user = userEvent.setup();
    const { container } = render(<OverviewPage />);

    const labels = () =>
      [...container.querySelectorAll('.column-label')].map((el) => el.textContent);

    const leveled = labels();
    expect(leveled[0]).toMatch(/Ironclad/);

    await user.click(screen.getByRole('button', { name: /as submitted/i }));

    const submitted = labels();
    expect(submitted[0]).toMatch(/Voltage/);
    expect(submitted).not.toEqual(leveled);
  });

  it('Compare renders content behind every tab', async () => {
    const user = userEvent.setup();
    render(<ComparePage />);
    await expectEveryTabRenders(user, screen);
  });

  it('Compare opens a bidder drawer without losing the table', async () => {
    const user = userEvent.setup();
    render(<ComparePage />);

    await user.click(screen.getByRole('tab', { name: /ranking/i }));
    await user.click(screen.getAllByRole('button', { name: /^detail$/i })[0]);

    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('Compare closes the drawer on Escape and keeps the tab', async () => {
    const user = userEvent.setup();
    render(<ComparePage />);

    await user.click(screen.getByRole('tab', { name: /ranking/i }));
    await user.click(screen.getAllByRole('button', { name: /^detail$/i })[0]);
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('tab', { name: /ranking/i })).toHaveAttribute('aria-selected', 'true');
  });

  it('Award renders content behind every tab', async () => {
    const user = userEvent.setup();
    render(<AwardPage />);
    await expectEveryTabRenders(user, screen);
  });

  it('Award re-ranks when the weighting changes, and gates still hold', async () => {
    const user = userEvent.setup();
    render(<AwardPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: /ironclad power/i })
    ).toBeInTheDocument();

    await user.click(screen.getByRole('tab', { name: /weighting/i }));
    await user.click(screen.getByRole('button', { name: /track record first/i }));
    await user.click(screen.getByRole('tab', { name: /recommendation/i }));

    expect(
      screen.getByRole('heading', { level: 2, name: /apex electrical/i })
    ).toBeInTheDocument();

    // No weighting recovers a disqualified bidder.
    expect(screen.getByText(/never entered the ranking/i)).toBeInTheDocument();
  });

  it('Prequalification renders content behind every tab', async () => {
    const user = userEvent.setup();
    render(<PrequalPage />);
    await expectEveryTabRenders(user, screen);
  });

  it('Prequalification reports the EMR gate on a competitively priced bidder', async () => {
    const user = userEvent.setup();
    render(<PrequalPage />);

    await user.click(screen.getByRole('button', { name: /meridian electric/i }));
    expect(screen.getAllByText(/exceeds the 1\.00 maximum/i).length).toBeGreaterThan(0);
  });

  it('Scope and weighting renders content behind every tab', async () => {
    const user = userEvent.setup();
    render(<SettingsPage />);
    await expectEveryTabRenders(user, screen);
  });

  it('Scope and weighting charts what each scope item is worth', async () => {
    const user = userEvent.setup();
    const { container } = render(<SettingsPage />);

    await user.click(screen.getByRole('tab', { name: /impact/i }));

    const columns = [...container.querySelectorAll('.column-label')].map((el) => el.textContent);
    expect(columns.length).toBeGreaterThan(0);
    expect(columns[0]).toMatch(/lighting fixtures/i);
  });
});
