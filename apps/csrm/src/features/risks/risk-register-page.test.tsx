import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskRegisterContent } from '../../../app/(app)/app/risks/page';

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  current: vi.fn(),
  granted: vi.fn(),
  listRiskRegister: vi.fn(),
  listRiskRegisterAssessments: vi.fn(),
  listRiskRegisterAssets: vi.fn(),
  listRiskRegisterSystems: vi.fn(),
  searchRiskRegisterOwners: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/risks',
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/capabilities/capability-adapter', () => ({ can: mocks.can }));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({
    current: mocks.current,
    capabilitiesFor: () => ({ granted: mocks.granted }),
  }),
}));
vi.mock('@/features/risks/risk-service', () => ({
  listRiskRegister: mocks.listRiskRegister,
  listRiskRegisterAssessments: mocks.listRiskRegisterAssessments,
  listRiskRegisterAssets: mocks.listRiskRegisterAssets,
  listRiskRegisterSystems: mocks.listRiskRegisterSystems,
  searchRiskRegisterOwners: mocks.searchRiskRegisterOwners,
}));

const emptyOptions = { data: [], error: null };
const emptyRegister = {
  data: {
    data: [],
    meta: {
      pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 },
      selectedLabels: {},
    },
  },
  error: null,
};

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.current.mockResolvedValue({ displayName: 'Bob Doe' });
  mocks.granted.mockResolvedValue(new Set(['risk:manage']));
  mocks.can.mockReturnValue(true);
  mocks.listRiskRegister.mockResolvedValue(emptyRegister);
  mocks.listRiskRegisterAssessments.mockResolvedValue(emptyOptions);
  mocks.listRiskRegisterAssets.mockResolvedValue(emptyOptions);
  mocks.listRiskRegisterSystems.mockResolvedValue(emptyOptions);
  mocks.searchRiskRegisterOwners.mockResolvedValue(emptyOptions);
});

describe('Risk Register route date validation boundary', () => {
  it('keeps permission denial ahead of invalid filter disclosure and data requests', async () => {
    mocks.can.mockReturnValue(false);
    render(await RiskRegisterContent({ searchParams: Promise.resolve({ targetDateFrom: 'invalid' }) }));

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the Risk Register');
    expect(screen.queryByText('Risk Register filters are invalid')).not.toBeInTheDocument();
    expect(mocks.listRiskRegister).not.toHaveBeenCalled();
  });

  it.each([
    { targetDateFrom: '' },
    { targetDateFrom: '2026-02-30' },
    { targetDateTo: 'not-a-date' },
    { targetDateFrom: ['2026-01-01', '2026-01-02'] },
    { targetDateTo: ['2026-12-31', '2026-12-30'] },
    { targetDateFrom: '2026-12-31', targetDateTo: '2026-01-01' },
  ])('renders a non-data state and makes no Risk request for %j', async (searchParams) => {
    render(await RiskRegisterContent({ searchParams: Promise.resolve(searchParams) }));

    expect(screen.getByRole('alert')).toHaveTextContent('Risk Register filters are invalid');
    expect(screen.getByRole('link', { name: 'Clear invalid filters' })).toHaveAttribute('href', '/app/risks');
    expect(screen.queryByText(/results/i)).not.toBeInTheDocument();
    expect(mocks.listRiskRegister).not.toHaveBeenCalled();
    expect(mocks.searchRiskRegisterOwners).not.toHaveBeenCalled();
    expect(mocks.listRiskRegisterAssessments).not.toHaveBeenCalled();
    expect(mocks.listRiskRegisterSystems).not.toHaveBeenCalled();
    expect(mocks.listRiskRegisterAssets).not.toHaveBeenCalled();
  });

  it.each([
    { targetDateFrom: '2026-01-01' },
    { targetDateTo: '2026-12-31' },
    { targetDateFrom: '2026-06-30', targetDateTo: '2026-06-30' },
    { targetDateFrom: '2026-01-01', targetDateTo: '2026-12-31' },
  ])('requests data for canonical date state %j', async (searchParams) => {
    render(await RiskRegisterContent({ searchParams: Promise.resolve(searchParams) }));

    expect(mocks.listRiskRegister).toHaveBeenCalledWith(expect.objectContaining(searchParams));
  });
});
