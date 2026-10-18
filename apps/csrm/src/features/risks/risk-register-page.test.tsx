import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RiskRegisterContent } from '../../../app/(app)/app/risks/(register)/page';

const mocks = vi.hoisted(() => ({
  can: vi.fn(),
  current: vi.fn(),
  exportButton: vi.fn(),
  exportRiskRegisterAction: vi.fn(),
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
vi.mock('@/features/exports/export-actions', () => ({ exportRiskRegisterAction: mocks.exportRiskRegisterAction }));
vi.mock('@/components/csrm/export/export-button', () => ({
  ExportButton: (props: { heading: string }) => {
    mocks.exportButton(props);
    return <button type="button">Export <span className="sr-only">{props.heading}</span></button>;
  },
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

    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the Risk register');
    expect(screen.queryByText('Risk register filters are invalid')).not.toBeInTheDocument();
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

    expect(screen.getByRole('alert')).toHaveTextContent('Risk register filters are invalid');
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

/*
 * Phase 19 export placement (the pilot's ruling of 2026-10-16; D-16, D-20): the register's header carries Export only
 * when the session's capabilities grant the export and the register read returned data. The header renders inside the
 * Suspense-wrapped content, so no second read counts the rows, and the static fallback header carries no action.
 */
describe('the register header’s Export (19-06)', () => {
  const holding = (...capabilities: string[]) => {
    mocks.granted.mockResolvedValue(new Set(capabilities));
    mocks.can.mockImplementation((capability: string, granted: ReadonlySet<string>) => granted.has(capability));
  };
  const populated = {
    data: {
      data: [],
      meta: { pagination: { page: 1, pageSize: 25, pageCount: 3, total: 63 }, selectedLabels: {} },
    },
    error: null,
  };

  it('shows Export Risk register in the header for a session holding the export, given the read’s total, with one read', async () => {
    holding('risk:manage', 'risk-register:export');
    mocks.listRiskRegister.mockResolvedValue(populated);
    render(await RiskRegisterContent({ searchParams: Promise.resolve({ q: 'HYPERLINK' }) }));

    expect(screen.getByRole('heading', { level: 1, name: 'Risk register' })).toBeInTheDocument();
    const exportButton = screen.getByRole('button', { name: 'Export Risk register' });
    expect(exportButton.closest('.page-header')).not.toBeNull();
    expect(mocks.exportButton).toHaveBeenCalledWith(expect.objectContaining({
      heading: 'Risk register',
      view: 'risk-register',
      action: mocks.exportRiskRegisterAction,
      total: 63,
      multiplePages: true,
      searchActive: true,
      search: 'HYPERLINK',
      chips: [],
      query: expect.objectContaining({ q: 'HYPERLINK', sort: 'targetDate:asc' }),
    }));
    expect(mocks.exportButton.mock.calls[0]?.[0].query).not.toHaveProperty('page');
    expect(mocks.exportButton.mock.calls[0]?.[0].query).not.toHaveProperty('pageSize');
    expect(mocks.listRiskRegister).toHaveBeenCalledTimes(1);
  });

  it('shows the register without Export for a session holding the register read alone', async () => {
    holding('risk:manage');
    mocks.listRiskRegister.mockResolvedValue(populated);
    render(await RiskRegisterContent({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { level: 1, name: 'Risk register' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export Risk register' })).not.toBeInTheDocument();
  });

  it('shows the Requestor the register’s gate under the header, with no Export and no read', async () => {
    holding('assessment-request:create', 'assessment-request:read');
    render(await RiskRegisterContent({ searchParams: Promise.resolve({}) }));

    expect(screen.getByRole('heading', { level: 1, name: 'Risk register' })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the Risk register');
    expect(screen.queryByRole('button', { name: 'Export Risk register' })).not.toBeInTheDocument();
    expect(mocks.listRiskRegister).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'You don’t have access to the Risk register'],
    [500, 'We couldn’t load the Risk register'],
  ])('shows no Export when the register read fails with %i', async (status, text) => {
    holding('risk:manage', 'risk-register:export');
    mocks.listRiskRegister.mockResolvedValue({ data: null, error: { message: 'x', status } });
    render(await RiskRegisterContent({ searchParams: Promise.resolve({}) }));

    expect(await screen.findByText(text, { exact: false })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export Risk register' })).not.toBeInTheDocument();
  });

  it('keeps Export off the static header the Suspense fallback shows', () => {
    const source = readFileSync(resolve(process.cwd(), 'app/(app)/app/risks/(register)/page.tsx'), 'utf8');
    const page = source.slice(source.indexOf('export default function RisksPage'));
    const fallback = /fallback=\{([\s\S]*?)\}>\s*<RiskRegisterContent/.exec(page)?.[1] ?? '';
    expect(fallback).toContain('<PageHeader');
    expect(fallback).not.toContain('action=');
    expect(source).toContain("can('risk-register:export'");
  });
});
