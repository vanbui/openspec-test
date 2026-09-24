import '@testing-library/jest-dom/vitest';

import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PageHeader } from '@/components/shell/app-shell';
import type { RiskPickerOption, RiskRegisterItem, RiskRegisterPayload, RiskRegisterQuery } from './risk-schema';
import { RiskRegisterTable } from './risk-register';

const replace = vi.fn();
let search = '';

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/risks',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search),
}));

const query: RiskRegisterQuery = {
  q: '',
  treatmentStatus: undefined,
  inherentRating: undefined,
  residualRating: undefined,
  riskOwner: undefined,
  treatmentOwner: undefined,
  assessment: undefined,
  system: undefined,
  asset: undefined,
  mitigationStatus: undefined,
  sort: 'targetDate:asc',
  page: 1,
  pageSize: 25,
};

const overdueRisk: RiskRegisterItem = {
  documentId: 'risk-alpha',
  riskNumber: 'RSK-2026-001',
  riskStatement: 'Customer identity data may be disclosed through a compromised service account.',
  inherentRating: 'Critical',
  residualRating: 'High',
  treatmentStatus: 'In Progress',
  treatmentOwner: { documentId: 'user-bob', displayName: 'Bob Doe' },
  targetDate: '2025-09-12',
  assessment: { documentId: 'assessment-alpha', assessmentNumber: 'RA-2026-001', title: 'Customer portal' },
};

const undatedRisk: RiskRegisterItem = {
  ...overdueRisk,
  documentId: 'risk-beta',
  riskNumber: 'RSK-2026-002',
  riskStatement: null,
  inherentRating: null,
  residualRating: 'Low',
  treatmentStatus: null,
  treatmentOwner: null,
  targetDate: null,
  assessment: { documentId: 'assessment-beta', assessmentNumber: 'RA-2026-002', title: 'Payments review' },
};

const selectedLabels: RiskRegisterPayload['meta']['selectedLabels'] = {
  riskOwner: { documentId: 'user-alice', label: 'Alice Analyst' },
  treatmentOwner: { documentId: 'user-bob', label: 'Bob Doe' },
  assessment: { documentId: 'assessment-alpha', label: 'RA-2026-001' },
  system: { documentId: 'system-portal', label: 'Customer portal' },
  asset: { documentId: 'asset-identity', label: 'Identity records' },
};

const options: {
  owners: readonly RiskPickerOption[];
  assessments: readonly RiskPickerOption[];
  systems: readonly RiskPickerOption[];
  assets: readonly RiskPickerOption[];
} = {
  owners: [{ documentId: 'user-bob', label: 'Bob Doe' }],
  assessments: [{ documentId: 'assessment-alpha', label: 'RA-2026-001' }],
  systems: [{ documentId: 'system-portal', label: 'Customer portal' }],
  assets: [{ documentId: 'asset-identity', label: 'Identity records' }],
};

function renderRegister(overrides: Partial<React.ComponentProps<typeof RiskRegisterTable>> = {}) {
  return render(
    <>
      <PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." />
      <RiskRegisterTable
        risks={[overdueRisk, undatedRisk]}
        query={query}
        pagination={{ page: 1, pageSize: 25, pageCount: 4, total: 82 }}
        selectedLabels={{}}
        pickerOptions={options}
        densityUserId="Bob Doe"
        {...overrides}
      />
    </>,
  );
}

beforeEach(() => {
  replace.mockReset();
  search = '';
});

describe('RiskRegisterTable', () => {
  it('renders the honest responsive register contract with eight sortable columns', () => {
    renderRegister();

    expect(screen.getByRole('heading', { level: 1, name: 'Risk Register' })).toBeInTheDocument();
    expect(screen.getByRole('table', { name: 'Risk Register results' })).toBeInTheDocument();
    expect(screen.getByText('82 results')).toBeInTheDocument();
    expect(screen.getByText('Page 1 of 4')).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Rows per page' })).toHaveValue('25');

    for (const name of ['Risk number', 'Statement', 'Inherent rating', 'Residual rating', 'Treatment status', 'Treatment owner', 'Target date', 'Related assessment']) {
      expect(screen.getByRole('columnheader', { name })).toHaveAttribute('aria-sort');
      expect(screen.getByRole('button', { name: `Sort by ${name}` })).toBeInTheDocument();
    }
    expect(screen.getByRole('columnheader', { name: 'Target date' })).toHaveAttribute('aria-sort', 'ascending');
    expect(screen.getAllByLabelText('Severity: critical (4 of 4)')).not.toHaveLength(0);
    expect(screen.getAllByLabelText('Severity: high (3 of 4)')).not.toHaveLength(0);
    expect(screen.getAllByText('12 Sept 2025')).not.toHaveLength(0);
    expect(screen.getAllByText('Overdue')).not.toHaveLength(0);
    expect(screen.getAllByText('No target date')).not.toHaveLength(0);
    expect(screen.getAllByText('Unassigned')).not.toHaveLength(0);
    expect(screen.getAllByText('Not provided')).not.toHaveLength(0);

    const mobile = document.querySelector<HTMLElement>('[data-slot="data-table-mobile"]');
    expect(mobile).not.toBeNull();
    if (!mobile) throw new Error('Mobile Risk Register surface is missing.');
    expect(within(mobile).getByRole('link', { name: 'RSK-2026-001' })).toHaveAttribute('href', '/app/risks/risk-alpha');
    expect(within(mobile).getByRole('link', { name: 'RA-2026-001' })).toHaveAttribute('href', '/app/review/assessments/assessment-alpha');
    expect(within(mobile).getByRole('link', { name: 'RSK-2026-001' }).closest('article')).not.toHaveAttribute('href');
  });

  it('writes canonical search, filter, sort, page-size and paging state with replace', async () => {
    const user = userEvent.setup();
    search = 'q=portal&treatmentStatus=In%20Progress&sort=targetDate%3Aasc&page=3&pageSize=25';
    renderRegister({ query: { ...query, q: 'portal', treatmentStatus: 'In Progress', page: 3 }, pagination: { page: 3, pageSize: 25, pageCount: 4, total: 82 } });

    const searchbox = screen.getByRole('searchbox', { name: 'Search Risks' });
    await user.clear(searchbox);
    await user.type(searchbox, ' identity {Enter}');
    expect(replace).toHaveBeenLastCalledWith('/app/risks?q=identity&treatmentStatus=In+Progress&sort=targetDate%3Aasc&pageSize=25', { scroll: false });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Treatment status' }), 'Complete');
    expect(replace).toHaveBeenLastCalledWith('/app/risks?q=portal&treatmentStatus=Complete&sort=targetDate%3Aasc&pageSize=25', { scroll: false });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Inherent rating' }), 'High');
    expect(replace).toHaveBeenLastCalledWith('/app/risks?q=portal&treatmentStatus=In+Progress&inherentRating=High&sort=targetDate%3Aasc&pageSize=25', { scroll: false });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Residual rating' }), 'Low');
    expect(replace).toHaveBeenLastCalledWith('/app/risks?q=portal&treatmentStatus=In+Progress&residualRating=Low&sort=targetDate%3Aasc&pageSize=25', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Sort by Target date' }));
    expect(replace).toHaveBeenLastCalledWith('/app/risks?q=portal&treatmentStatus=In+Progress&sort=targetDate%3Adesc&pageSize=25', { scroll: false });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    expect(replace).toHaveBeenLastCalledWith('/app/risks?q=portal&treatmentStatus=In+Progress&sort=targetDate%3Aasc&pageSize=50', { scroll: false });
    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(replace).toHaveBeenLastCalledWith('/app/risks?q=portal&treatmentStatus=In+Progress&sort=targetDate%3Aasc&page=4&pageSize=25', { scroll: false });
  });

  it('serializes every allowlisted sort and preserves server null-last target-date order', async () => {
    const user = userEvent.setup();
    renderRegister();

    for (const [heading, field] of [
      ['Risk number', 'riskNumber'],
      ['Statement', 'riskStatement'],
      ['Inherent rating', 'inherentRating'],
      ['Residual rating', 'residualRating'],
      ['Treatment status', 'treatmentStatus'],
      ['Treatment owner', 'treatmentOwner'],
      ['Related assessment', 'assessment'],
    ] as const) {
      await user.click(screen.getByRole('button', { name: `Sort by ${heading}` }));
      expect(replace).toHaveBeenLastCalledWith(`/app/risks?sort=${field}%3Aasc&pageSize=25`, { scroll: false });
    }

    await user.click(screen.getByRole('button', { name: 'Sort by Target date' }));
    expect(replace).toHaveBeenLastCalledWith('/app/risks?sort=targetDate%3Adesc&pageSize=25', { scroll: false });
    const tableRows = within(screen.getByRole('table', { name: 'Risk Register results' })).getAllByRole('row');
    expect(tableRows[1]).toHaveTextContent('RSK-2026-001');
    expect(tableRows[2]).toHaveTextContent('RSK-2026-002');
  });

  it('preserves selected labels, exposes target-date controls, and clears all twelve filters', async () => {
    const user = userEvent.setup();
    const allFilters: RiskRegisterQuery = {
      ...query,
      q: 'portal',
      treatmentStatus: 'In Progress',
      inherentRating: 'Critical',
      residualRating: 'High',
      riskOwner: 'user-alice',
      treatmentOwner: 'user-bob',
      assessment: 'assessment-alpha',
      system: 'system-portal',
      asset: 'asset-identity',
      mitigationStatus: 'none',
      targetDateFrom: '2025-01-01',
      targetDateTo: '2025-12-31',
      sort: 'assessment:desc',
      page: 7,
      pageSize: 50,
    };
    search = 'q=portal&treatmentStatus=In%20Progress&inherentRating=Critical&residualRating=High&riskOwner=user-alice&treatmentOwner=user-bob&assessment=assessment-alpha&system=system-portal&asset=asset-identity&mitigationStatus=none&sort=assessment%3Adesc&page=7&pageSize=50&targetDateFrom=2025-01-01&targetDateTo=2025-12-31';
    renderRegister({ query: allFilters, selectedLabels, pagination: { page: 7, pageSize: 50, pageCount: 8, total: 382 } });

    expect(screen.getByRole('button', { name: 'Filters (12)' })).toBeInTheDocument();
    expect(screen.getByText('Risk owner: Alice Analyst')).toBeInTheDocument();
    expect(screen.getByText('Related assessment: RA-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Target date from: 2025-01-01')).toBeInTheDocument();
    expect(screen.getByText('Target date to: 2025-12-31')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'More filters' }));
    const dateFrom = screen.getByLabelText('Target date from');
    const dateTo = screen.getByLabelText('Target date to');
    expect(dateFrom).toHaveAttribute('type', 'date');
    expect(dateFrom).toHaveValue('2025-01-01');
    expect(dateTo).toHaveAttribute('type', 'date');
    expect(dateTo).toHaveValue('2025-12-31');
    fireEvent.change(dateFrom, { target: { value: '2025-02-01' } });
    expect(replace).toHaveBeenLastCalledWith(expect.stringMatching(/targetDateFrom=2025-02-01.*targetDateTo=2025-12-31.*sort=assessment%3Adesc.*pageSize=50/), { scroll: false });
    expect(replace.mock.calls.at(-1)?.[0]).not.toContain('page=7');

    for (const [label, value, search, optionLabel] of [
      ['Risk owner', 'user-bob', 'Bob', 'Bob Doe'],
      ['Treatment owner', 'user-bob', 'Bob', 'Bob Doe'],
      ['Related assessment', 'assessment-alpha', 'RA', 'RA-2026-001'],
      ['Impacted system', 'system-portal', 'Portal', 'Customer portal'],
      ['Impacted asset', 'asset-identity', 'Identity', 'Identity records'],
    ] as const) {
      const combobox = screen.getByRole('combobox', { name: label });
      await user.type(combobox, search);
      await user.click(await screen.findByRole('option', { name: optionLabel }));
      expect(replace).toHaveBeenLastCalledWith(expect.stringContaining(`${label === 'Risk owner' ? 'riskOwner' : label === 'Treatment owner' ? 'treatmentOwner' : label === 'Related assessment' ? 'assessment' : label === 'Impacted system' ? 'system' : 'asset'}=${value}`), { scroll: false });
    }
    await user.selectOptions(screen.getByRole('combobox', { name: 'Mitigation-control status' }), 'Implemented');
    expect(replace).toHaveBeenLastCalledWith(expect.stringContaining('mitigationStatus=Implemented'), { scroll: false });
    await user.click(screen.getByRole('button', { name: 'Clear target dates' }));
    expect(replace.mock.calls.at(-1)?.[0]).not.toMatch(/targetDateFrom|targetDateTo|page=7/);
    expect(replace).toHaveBeenLastCalledWith(expect.stringMatching(/sort=assessment%3Adesc.*pageSize=50/), { scroll: false });
    await user.keyboard('{Escape}');
    expect(screen.getByRole('button', { name: 'More filters' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Remove Target date from filter' }));
    expect(replace.mock.calls.at(-1)?.[0]).not.toContain('targetDateFrom');
    expect(replace.mock.calls.at(-1)?.[0]).toContain('targetDateTo=2025-12-31');

    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(replace).toHaveBeenLastCalledWith('/app/risks?sort=assessment%3Adesc&pageSize=50', { scroll: false });
  });

  it('reuses labelled date controls in the mobile Sheet and preserves values while loading', async () => {
    const user = userEvent.setup();
    const datedQuery = { ...query, targetDateFrom: '2025-01-01', targetDateTo: '2025-12-31' };
    const view = renderRegister({ query: datedQuery });

    await user.click(screen.getByRole('button', { name: 'Filters (2)' }));
    const sheet = screen.getByRole('dialog', { name: 'Risk Register filters' });
    expect(within(sheet).getByLabelText('Target date from')).toHaveValue('2025-01-01');
    expect(within(sheet).getByLabelText('Target date to')).toHaveValue('2025-12-31');

    view.rerender(<><PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." /><RiskRegisterTable risks={[overdueRisk, undatedRisk]} query={datedQuery} pagination={{ page: 1, pageSize: 25, pageCount: 4, total: 82 }} selectedLabels={{}} pickerOptions={options} densityUserId="Bob Doe" state="loading" /></>);
    expect(within(sheet).getByLabelText('Target date from')).toBeDisabled();
    expect(within(sheet).getByLabelText('Target date from')).toHaveValue('2025-01-01');
    expect(within(sheet).getByLabelText('Target date to')).toBeDisabled();
    expect(within(sheet).getByLabelText('Target date to')).toHaveValue('2025-12-31');
  });

  it('corrects stale pages and keeps loading, empty, error, and permission states deliberate', () => {
    const view = renderRegister({ risks: [], query: { ...query, page: 9 }, pagination: { page: 9, pageSize: 25, pageCount: 2, total: 30 } });
    expect(replace).toHaveBeenLastCalledWith('/app/risks?sort=targetDate%3Aasc&page=2&pageSize=25', { scroll: false });
    expect(screen.getByRole('status', { name: 'Loading Risk Register' })).toBeInTheDocument();
    expect(screen.queryByText('30 results')).not.toBeInTheDocument();

    view.rerender(<><PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." /><RiskRegisterTable risks={[]} query={query} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={options} densityUserId="Bob Doe" state="empty" /></>);
    expect(screen.getByRole('heading', { name: 'No Risks yet' })).toBeInTheDocument();

    view.rerender(<><PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." /><RiskRegisterTable risks={[]} query={{ ...query, q: 'missing' }} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={options} densityUserId="Bob Doe" state="empty" /></>);
    expect(screen.getByRole('heading', { name: 'No Risks match these filters' })).toBeInTheDocument();

    view.rerender(<><PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." /><RiskRegisterTable risks={[]} query={query} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={options} densityUserId="Bob Doe" state="error" /></>);
    expect(screen.getByRole('alert')).toHaveTextContent('We couldn’t load the Risk Register');
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();

    view.rerender(<><PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." /><RiskRegisterTable risks={[]} query={query} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={options} densityUserId="Bob Doe" state="permission" /></>);
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access to the Risk Register');
    expect(screen.queryByRole('search')).not.toBeInTheDocument();
    expect(screen.queryByText(/results/)).not.toBeInTheDocument();

    view.rerender(<><PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." /><RiskRegisterTable risks={[]} query={query} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={options} densityUserId="Bob Doe" state="loading" /></>);
    expect(screen.getByRole('status', { name: 'Loading Risk Register' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search Risks' })).toBeDisabled();
  });

  it('keeps the route server-owned, capability-gated, canonical, and typed', () => {
    const page = readFileSync(resolve(process.cwd(), 'app/(app)/app/risks/page.tsx'), 'utf8');
    expect(page).toContain('await searchParams');
    expect(page).toContain('riskRegisterQuerySchema');
    expect(page).toContain('searchRiskRegisterRelationsAction');
    expect(page).not.toContain("searchRiskRegisterOwners('doe')");
    expect(page).toContain("'risk:manage'");
    expect(page).toContain('listRiskRegister');
    expect(page).not.toContain("'use client'");
    expect(page).not.toMatch(/\bfetch\s*\(/);
    expect(page).not.toContain('targetDateFrom');
    expect(page).not.toContain('targetDateTo');
  });
});
