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
  treatmentDueState: 'overdue',
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
  treatmentDueState: 'no-target-date',
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

  it('lays the desktop filters out in two rows up to 1279px and one row of four tracks from 1280px, labels on one line (D-28)', () => {
    renderRegister();

    const search = screen.getByRole('searchbox', { name: 'Search Risks' });
    expect(search).toHaveAttribute('name', 'q');
    const form = search.closest('form') as HTMLElement;
    const grid = form.parentElement as HTMLElement;

    // md to lg: the search form alone on the first row, the three selects on the next; xl: one row.
    expect(grid).toHaveClass('hidden', 'gap-3', 'md:grid', 'md:grid-cols-3', 'xl:grid-cols-[2fr_1fr_1fr_1fr]');
    expect(grid.className).not.toMatch(/\blg:grid-cols-/);
    expect(form).toHaveClass('md:col-span-3', 'xl:col-span-1');
    expect(form.className).not.toMatch(/\blg:col-span-/);

    const labels = [
      search.closest('label'),
      ...['Treatment status', 'Inherent rating', 'Residual rating'].map((name) => screen.getByRole('combobox', { name }).closest('label')),
    ];
    expect(labels.map((label) => label?.firstChild?.textContent?.trim())).toEqual(['Search Risks', 'Treatment status', 'Inherent rating', 'Residual rating']);
    for (const label of labels) expect(label).toHaveClass('whitespace-nowrap');
  });

  it('wraps the statement within its bounds and clamps it to two lines in the table and three on cards (D-28, X-3)', () => {
    renderRegister();

    const statement = overdueRisk.riskStatement as string;
    const table = screen.getByRole('table', { name: 'Risk Register results' });
    const link = within(table).getByRole('link', { name: statement });
    // The clamp is visual: the whole statement stays in the DOM and the link opens the record.
    expect(link).toHaveTextContent(statement);
    expect(link).toHaveClass('line-clamp-2');
    expect(link).toHaveAttribute('href', '/app/risks/risk-alpha');
    expect(link.closest('td')).toHaveClass('whitespace-normal', 'min-w-56', 'max-w-md');
    expect(screen.getByRole('columnheader', { name: 'Statement' })).not.toHaveClass('whitespace-normal');
    expect(within(table).getByRole('link', { name: 'RSK-2026-001' }).closest('td')).not.toHaveClass('whitespace-normal');

    const mobile = document.querySelector<HTMLElement>('[data-slot="data-table-mobile"]') as HTMLElement;
    expect(within(mobile).getByText(statement)).toHaveClass('line-clamp-3');

    // The register no longer opts into a permanent region: in jsdom the table fits, so there is none.
    expect(screen.queryByRole('region', { name: 'Risk Register results, scrolls horizontally' })).not.toBeInTheDocument();
  });

  it('shows the Overdue marker exactly when the server says the treatment is overdue', () => {
    /*
     * The register renders the server's treatmentDueState and never compares
     * dates itself (D-04, D-26): a Complete or closed Risk with a past target
     * date is not overdue, a due-soon Risk carries no marker, and an overdue
     * state is shown whatever the browser's own clock says.
     */
    const completeRisk: RiskRegisterItem = {
      ...overdueRisk, documentId: 'risk-complete', riskNumber: 'RSK-2026-010',
      treatmentStatus: 'Complete', targetDate: '2025-09-12', treatmentDueState: 'complete-or-closed',
    };
    const closedRisk: RiskRegisterItem = {
      ...overdueRisk, documentId: 'risk-closed', riskNumber: 'RSK-2026-011',
      treatmentStatus: 'In Progress', targetDate: '2025-09-12', treatmentDueState: 'complete-or-closed',
    };
    const dueSoonRisk: RiskRegisterItem = {
      ...overdueRisk, documentId: 'risk-due-soon', riskNumber: 'RSK-2026-012',
      targetDate: '2099-01-10', treatmentDueState: 'due-soon',
    };
    const laterRisk: RiskRegisterItem = {
      ...overdueRisk, documentId: 'risk-later', riskNumber: 'RSK-2026-013',
      targetDate: '2099-06-30', treatmentDueState: 'later',
    };
    const serverOverdueRisk: RiskRegisterItem = {
      ...overdueRisk, documentId: 'risk-server-overdue', riskNumber: 'RSK-2026-014',
      targetDate: '2099-03-01', treatmentDueState: 'overdue',
    };
    renderRegister({ risks: [overdueRisk, completeRisk, closedRisk, dueSoonRisk, laterRisk, serverOverdueRisk, undatedRisk] });

    const table = screen.getByRole('table', { name: 'Risk Register results' });
    const mobile = document.querySelector<HTMLElement>('[data-slot="data-table-mobile"]');
    if (!mobile) throw new Error('Mobile Risk Register surface is missing.');
    const desktopRow = (riskNumber: string) => within(table).getByRole('row', { name: new RegExp(riskNumber) });
    const mobileCard = (riskNumber: string) => {
      const card = within(mobile).getByRole('link', { name: riskNumber }).closest('article');
      if (!card) throw new Error(`Mobile card for ${riskNumber} is missing.`);
      return card as HTMLElement;
    };
    for (const [riskNumber, marked] of [
      ['RSK-2026-001', true],
      ['RSK-2026-010', false],
      ['RSK-2026-011', false],
      ['RSK-2026-012', false],
      ['RSK-2026-013', false],
      ['RSK-2026-014', true],
      ['RSK-2026-002', false],
    ] as const) {
      for (const [surface, container] of [['desktop', desktopRow(riskNumber)], ['mobile', mobileCard(riskNumber)]] as const) {
        const markers = within(container).queryAllByText('Overdue', { exact: true });
        expect(markers, `${riskNumber} ${surface} marker`).toHaveLength(marked ? 1 : 0);
        // The marker is never colour alone: it carries its icon beside the word.
        if (marked) expect(markers[0]?.querySelector('svg'), `${riskNumber} ${surface} marker icon`).not.toBeNull();
      }
    }
  });

  it('draws the overdue marker in the urgency presentation, never the High severity triangle (UI-D13)', () => {
    renderRegister({ risks: [overdueRisk, undatedRisk] });

    const table = screen.getByRole('table', { name: 'Risk Register results' });
    const mobile = document.querySelector<HTMLElement>('[data-slot="data-table-mobile"]');
    if (!mobile) throw new Error('Mobile Risk Register surface is missing.');
    const surfaces = [
      ['desktop', within(table).getByRole('row', { name: /RSK-2026-001/ })],
      ['mobile', within(mobile).getByRole('link', { name: 'RSK-2026-001' }).closest('article') as HTMLElement],
    ] as const;
    for (const [surface, container] of surfaces) {
      const marker = within(container).getByText('Overdue', { exact: true });
      // The dense urgency form: the danger fg colour, the CalendarX2 icon and a hidden prefix.
      expect(marker, `${surface} marker colour`).toHaveClass('text-destructive');
      expect(marker.querySelectorAll('svg'), `${surface} marker icon count`).toHaveLength(1);
      expect(marker.querySelector('svg'), `${surface} marker icon`).toHaveClass('lucide-calendar-x-2');
      expect(marker.parentElement, `${surface} marker prefix`).toHaveTextContent('Urgency: Overdue');
      expect(marker.closest('[data-slot="alert-urgency"]'), `${surface} marker slot`).toHaveAttribute('data-urgency', 'overdue');
      // No severity triangle beside the target date: urgency is a status, not a severity.
      const targetDate = within(container).getByText('12 Sept 2025').parentElement as HTMLElement;
      expect(targetDate.querySelector('.lucide-triangle-alert'), `${surface} severity triangle`).toBeNull();
      expect(targetDate.querySelector('.text-warning'), `${surface} warning tone`).toBeNull();
    }
  });

  it('shows every treatment status through the shared tinted badge, Overdue as a clock and never a triangle', () => {
    const treatmentRisk = (riskNumber: string, treatmentStatus: RiskRegisterItem['treatmentStatus'], treatmentDueState: RiskRegisterItem['treatmentDueState']): RiskRegisterItem => ({
      ...overdueRisk, documentId: `risk-${riskNumber}`, riskNumber, treatmentStatus, treatmentDueState,
    });
    renderRegister({
      risks: [
        treatmentRisk('RSK-2026-020', 'Not Started', 'later'),
        treatmentRisk('RSK-2026-021', 'In Progress', 'later'),
        treatmentRisk('RSK-2026-022', 'Overdue', 'overdue'),
        treatmentRisk('RSK-2026-023', 'Complete', 'complete-or-closed'),
        undatedRisk,
      ],
    });

    const table = screen.getByRole('table', { name: 'Risk Register results' });
    const mobile = document.querySelector<HTMLElement>('[data-slot="data-table-mobile"]');
    if (!mobile) throw new Error('Mobile Risk Register surface is missing.');
    for (const [riskNumber, label, tone] of [
      ['RSK-2026-020', 'Not Started', 'neutral'],
      ['RSK-2026-021', 'In Progress', 'info'],
      ['RSK-2026-022', 'Overdue', 'danger'],
      ['RSK-2026-023', 'Complete', 'success'],
    ] as const) {
      const surfaces = [
        ['desktop', within(table).getByRole('row', { name: new RegExp(riskNumber) })],
        ['mobile', within(mobile).getByRole('link', { name: riskNumber }).closest('article') as HTMLElement],
      ] as const;
      for (const [surface, container] of surfaces) {
        // Rating badges carry no tone; the one toned badge in a row or card is its treatment status.
        const badges = container.querySelectorAll<HTMLElement>('[data-slot="badge"][data-tone]');
        expect(badges, `${riskNumber} ${surface} status badge`).toHaveLength(1);
        const badge = badges[0];
        expect(badge, `${riskNumber} ${surface}`).toHaveTextContent(new RegExp(`^${label}$`));
        expect(badge, `${riskNumber} ${surface} tone`).toHaveAttribute('data-tone', tone);
        expect(badge, `${riskNumber} ${surface} variant`).toHaveAttribute('data-variant', tone === 'neutral' ? 'outline' : tone);
        if (tone === 'neutral') expect(badge, `${riskNumber} ${surface} neutral tint`).toHaveClass('bg-surface-muted', 'text-foreground-secondary');
        expect(badge.querySelectorAll('svg'), `${riskNumber} ${surface} icon`).toHaveLength(1);
        expect(badge.querySelector('.lucide-triangle-alert'), `${riskNumber} ${surface} severity triangle`).toBeNull();
      }
    }
    // Overdue is a clock; its target-date urgency marker beside it stays a separate fact.
    const overdueRow = within(table).getByRole('row', { name: /RSK-2026-022/ });
    expect(overdueRow.querySelector('[data-slot="badge"][data-tone="danger"] svg')).toHaveClass('lucide-clock-alert');
    expect(overdueRow.querySelector('[data-slot="alert-urgency"]')).toHaveAttribute('data-urgency', 'overdue');

    // A Risk with no recorded treatment status says so in plain text, with no badge.
    for (const container of [within(table).getByRole('row', { name: /RSK-2026-002/ }), within(mobile).getByRole('link', { name: 'RSK-2026-002' }).closest('article') as HTMLElement]) {
      expect(container.querySelector('[data-slot="badge"][data-tone]')).toBeNull();
      expect(within(container).getAllByText('Not provided').length).toBeGreaterThan(0);
    }
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

  it('preserves selected labels, exposes target-date controls, and clears all thirteen filters', async () => {
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
      state: 'open',
      targetDateFrom: '2025-01-01',
      targetDateTo: '2025-12-31',
      sort: 'assessment:desc',
      page: 7,
      pageSize: 50,
    };
    search = 'q=portal&treatmentStatus=In%20Progress&inherentRating=Critical&residualRating=High&riskOwner=user-alice&treatmentOwner=user-bob&assessment=assessment-alpha&system=system-portal&asset=asset-identity&mitigationStatus=none&state=open&sort=assessment%3Adesc&page=7&pageSize=50&targetDateFrom=2025-01-01&targetDateTo=2025-12-31';
    renderRegister({ query: allFilters, selectedLabels, pagination: { page: 7, pageSize: 50, pageCount: 8, total: 382 } });

    expect(screen.getByRole('button', { name: 'Filters (13)' })).toBeInTheDocument();
    expect(screen.getByText('Risk owner: Alice Analyst')).toBeInTheDocument();
    expect(screen.getByText('Related assessment: RA-2026-001')).toBeInTheDocument();
    expect(screen.getByText('Risk state: Open')).toBeInTheDocument();
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

  it('offers the closed Risk state filter in More filters, as a chip and in the mobile Sheet (D-36)', async () => {
    const user = userEvent.setup();
    const view = renderRegister();

    await user.click(screen.getByRole('button', { name: 'More filters' }));
    const stateSelect = screen.getByRole('combobox', { name: 'Risk state' });
    expect(stateSelect).toHaveValue('');
    expect(within(stateSelect).getAllByRole('option').map((option) => [option.getAttribute('value'), option.textContent])).toEqual([
      ['', 'All'],
      ['open', 'Open'],
      ['closed', 'Closed'],
    ]);
    await user.selectOptions(stateSelect, 'Closed');
    expect(replace).toHaveBeenLastCalledWith('/app/risks?state=closed&sort=targetDate%3Aasc&pageSize=25', { scroll: false });
    await user.keyboard('{Escape}');

    replace.mockReset();
    view.unmount();
    const openQuery: RiskRegisterQuery = { ...query, state: 'open', page: 3 };
    renderRegister({ query: openQuery, pagination: { page: 3, pageSize: 25, pageCount: 4, total: 82 } });
    expect(screen.getByText('Risk state: Open')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Filters (1)' })).toBeInTheDocument();

    // The mobile Sheet reuses the same labelled control with the active value.
    await user.click(screen.getByRole('button', { name: 'Filters (1)' }));
    const sheet = screen.getByRole('dialog', { name: 'Risk Register filters' });
    expect(within(sheet).getByRole('combobox', { name: 'Risk state' })).toHaveValue('open');
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Remove Risk state filter' }));
    expect(replace).toHaveBeenLastCalledWith('/app/risks?sort=targetDate%3Aasc&pageSize=25', { scroll: false });
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
