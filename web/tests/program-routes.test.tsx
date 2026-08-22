import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('next/navigation', () => ({
  useParams: () => ({}),
  usePathname: () => '/',
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn(), back: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));

import FindingsPage from '@/app/findings/page';
import HowItWorksPage from '@/app/how-it-works/page';
import ScopeMatrixPage from '@/app/scope-matrix/page';
import VendorsPage from '@/app/vendors/page';
import { expectEveryTabRenders, renderProgram } from './harness';

describe('program routes render', () => {
  it('Findings lists every finding across every package', () => {
    renderProgram(<FindingsPage />);
    expect(screen.getByRole('heading', { name: /^findings$/i })).toBeInTheDocument();

    // The rollup these pages replaced an empty state to provide.
    expect(screen.getByText(/26 of 26 shown/i)).toBeInTheDocument();
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('Findings filters the table when a severity is chosen', async () => {
    const user = userEvent.setup();
    renderProgram(<FindingsPage />);

    const before = screen.getAllByRole('row').length;
    await user.click(screen.getByRole('button', { name: /show only HIGH severity/i }));
    const after = screen.getAllByRole('row').length;

    expect(after).toBeLessThan(before);
    expect(screen.getByText(/10 of 26 shown/i)).toBeInTheDocument();
  });

  it('Vendors lists every bid and reports the roster is exact', () => {
    renderProgram(<VendorsPage />);
    expect(screen.getByText(/11 of 11 shown/i)).toBeInTheDocument();
    expect(screen.getByText(/no firm in this demo bids more than one package/i)).toBeInTheDocument();
  });

  it('Vendors narrows to gated bidders', async () => {
    const user = userEvent.setup();
    renderProgram(<VendorsPage />);

    await user.selectOptions(
      screen.getByRole('combobox', { name: /prequalification/i }),
      'fail'
    );
    expect(screen.getByText(/3 of 11 shown/i)).toBeInTheDocument();
  });

  it('Scope matrix reports required scope no bidder covered', () => {
    renderProgram(<ScopeMatrixPage />);
    expect(screen.getByText(/12 of 12 shown/i)).toBeInTheDocument();
    expect(screen.getAllByText(/no bidder included it/i).length).toBeGreaterThan(0);
  });

  it('Scope matrix narrows to the uncovered items', async () => {
    const user = userEvent.setup();
    renderProgram(<ScopeMatrixPage />);

    await user.click(screen.getByRole('checkbox', { name: /uncovered only/i }));
    expect(screen.getByText(/2 of 12 shown/i)).toBeInTheDocument();
  });

  it('How it works renders content behind every tab', async () => {
    const user = userEvent.setup();
    renderProgram(<HowItWorksPage />);
    await expectEveryTabRenders(user, screen);
  });

  it('How it works filters capabilities by maturity', async () => {
    const user = userEvent.setup();
    renderProgram(<HowItWorksPage />);

    await user.click(screen.getByRole('tab', { name: /what is real/i }));
    const panel = screen.getByRole('tabpanel');
    const before = within(panel).getAllByText(/Live|Simulated|Planned|Ready/).length;

    await user.click(within(panel).getByRole('button', { name: /^Planned/ }));
    const after = within(screen.getByRole('tabpanel')).getAllByText(
      /Live|Simulated|Planned|Ready/
    ).length;

    expect(after).toBeLessThan(before);
  });
});
