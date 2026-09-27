import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { RiskRegisterLoading } from './risk-register-loading';

const navigation = vi.hoisted(() => ({ params: new URLSearchParams() }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/risks',
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => navigation.params,
}));

beforeEach(() => {
  navigation.params = new URLSearchParams();
});

/*
 * The loading fallback streams before the page decides anything. A URL the page refuses (an
 * impossible target date, or a range whose start follows its end) must still draw the loading
 * register: throwing here abandons the server render of the whole route, and the page renders the
 * invalid-filter state for that URL itself.
 */
describe('Risk Register loading fallback', () => {
  it('draws the loading register from the URL it can read', () => {
    navigation.params = new URLSearchParams({ q: 'patch', treatmentStatus: 'In Progress' });
    render(<RiskRegisterLoading />);

    expect(screen.getByLabelText('Search Risks')).toHaveValue('patch');
    expect(screen.getByLabelText('Treatment status')).toHaveValue('In Progress');
  });

  it.each([
    ['an impossible target date', { q: 'patch', targetDateFrom: '2026-02-30' }],
    ['a range whose start follows its end', { q: 'patch', targetDateFrom: '2026-12-02', targetDateTo: '2026-12-01' }],
  ])('draws the loading register without the refused bounds for %s', (_label, params) => {
    navigation.params = new URLSearchParams(params);

    expect(() => render(<RiskRegisterLoading />)).not.toThrow();
    expect(screen.getByLabelText('Search Risks')).toHaveValue('patch');
    expect(screen.getByLabelText('Search Risks')).toBeDisabled();
  });

  /*
   * WR-10: Next gives the page a repeated key as an array, and the page reads its first value; a repeated
   * target date is not a date, so the page refuses it. The fallback reads the URL in the same shape.
   */
  it('reads a repeated parameter by its first value, as the page does', () => {
    navigation.params = new URLSearchParams([['treatmentStatus', 'Complete'], ['treatmentStatus', 'Overdue'], ['q', 'patch'], ['q', 'later']]);
    render(<RiskRegisterLoading />);

    expect(screen.getByLabelText('Treatment status')).toHaveValue('Complete');
    expect(screen.getByLabelText('Search Risks')).toHaveValue('patch');
  });

  it('draws a repeated target date as the refused bound the page treats it as', () => {
    navigation.params = new URLSearchParams([['q', 'patch'], ['targetDateFrom', '2026-01-01'], ['targetDateFrom', '2026-02-01']]);

    expect(() => render(<RiskRegisterLoading />)).not.toThrow();
    expect(screen.getByLabelText('Search Risks')).toHaveValue('patch');
    expect(screen.queryByText(/Target date from/)).not.toBeInTheDocument();
  });
});
