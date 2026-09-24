import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType, ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

type RequestRow = {
  id: string;
  title: string;
  riskScore: number;
  submittedDate: string;
};

type TestColumn = {
  id?: string;
  accessorKey: keyof RequestRow;
  header: string;
  cell?: (value: unknown, row: RequestRow) => ReactNode;
  enableSorting?: boolean;
  numeric?: 'magnitude' | 'identity';
};

type TestDataTableProps = {
  ariaLabel: string;
  columns: TestColumn[];
  data: RequestRow[];
  densityUserId: string;
  filters?: Array<{ id: string; label: string; value: string }>;
  getRowId: (row: RequestRow) => string;
  onClearFilter?: (id: string) => void;
  onClearFilters?: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortingChange?: (sorting: Array<{ id: string; desc: boolean }>) => void;
  page: number;
  pageSize: number;
  renderMobileCard: (row: RequestRow) => ReactNode;
  sorting?: Array<{ id: string; desc: boolean }>;
  stickyFirstColumn?: boolean;
  state: 'populated' | 'loading' | 'empty' | 'error' | 'permission';
  loadingLabel: string;
  stateSlots: {
    empty: ReactNode;
    error: ReactNode;
    permission: ReactNode;
  };
  totalCount: number;
};

const rows: RequestRow[] = [
  { id: 'REQ-101', title: 'Customer portal', riskScore: 72, submittedDate: '2026-08-29' },
  { id: 'REQ-102', title: 'Identity refresh', riskScore: 18, submittedDate: '2026-08-28' },
];

const columns: TestColumn[] = [
  { accessorKey: 'id', header: 'Request ID', numeric: 'identity' },
  { accessorKey: 'title', header: 'Title', enableSorting: true },
  { accessorKey: 'riskScore', header: 'Risk score', enableSorting: true, numeric: 'magnitude' },
  { accessorKey: 'submittedDate', header: 'Submitted', numeric: 'identity' },
  {
    accessorKey: 'title',
    header: 'Actions',
    cell: (_value, row) => <button aria-label={`Open ${row.id}`}>Open</button>,
  },
];

async function loadDataTable(): Promise<ComponentType<TestDataTableProps>> {
  const sourcePath = resolve(process.cwd(), 'src/components/csrm/data-table.tsx');

  if (!existsSync(sourcePath)) {
    throw new Error('PHASE2_RED_02_04_01_DATA_TABLE_BEHAVIOR_ABSENT');
  }

  const moduleUrl = pathToFileURL(sourcePath).href;
  const module = (await import(/* @vite-ignore */ moduleUrl)) as {
    DataTable?: ComponentType<TestDataTableProps>;
  };

  if (!module.DataTable) {
    throw new Error('PHASE2_RED_02_04_01_DATA_TABLE_BEHAVIOR_ABSENT');
  }

  return module.DataTable;
}

describe('DataTable', () => {
  it('provides the accessible DataTable interaction contract', async () => {
    const baseline = document.createElement('button');
    baseline.textContent = 'Baseline interaction';
    document.body.append(baseline);
    baseline.focus();
    expect(baseline).toHaveFocus();
    baseline.remove();

    const DataTable = await loadDataTable();
    const user = userEvent.setup();
    const onSortingChange = vi.fn();
    const onClearFilter = vi.fn();
    const onClearFilters = vi.fn();
    const onPageChange = vi.fn();
    const onPageSizeChange = vi.fn();
    const stateSlots = {
      empty: <p>There are no assessment requests yet.</p>,
      error: <p role="alert">Assessment requests could not be loaded.</p>,
      permission: <p role="alert">You do not have permission to view these requests.</p>,
    };
    const props: TestDataTableProps = {
      ariaLabel: 'Assessment requests',
      columns,
      data: rows,
      densityUserId: 'requestor-1',
      filters: [{ id: 'status', label: 'Status', value: 'Draft' }],
      getRowId: (row) => row.id,
      onClearFilter,
      onClearFilters,
      onPageChange,
      onPageSizeChange,
      onSortingChange,
      page: 2,
      pageSize: 10,
      renderMobileCard: (row) => <article>Mobile {row.title}</article>,
      sorting: [],
      state: 'populated',
      loadingLabel: 'Loading risk register rows',
      stateSlots,
      totalCount: 23,
    };

    const view = render(<DataTable {...props} />);

    expect(screen.getByRole('table', { name: 'Assessment requests' })).toBeInTheDocument();
    expect(screen.getByText('23 results')).toHaveClass('tabular-nums');
    expect(screen.getByText('Page 2 of 3')).toHaveClass('tabular-nums');
    expect(screen.getByText('Status: Draft')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Remove Status filter' }));
    expect(onClearFilter).toHaveBeenCalledWith('status');
    await user.click(screen.getByRole('button', { name: 'Clear filters' }));
    expect(onClearFilters).toHaveBeenCalledOnce();

    const tableHeader = screen.getByRole('rowgroup', { name: 'Table header' });
    expect(tableHeader).toHaveClass('sticky', 'top-0', 'z-10', 'bg-surface/95', 'backdrop-blur-sm', 'border-b', 'border-border');
    expect(within(tableHeader).getAllByRole('columnheader')[0]).toHaveClass('h-10');

    const bodyRows = within(screen.getByRole('rowgroup', { name: 'Table body' })).getAllByRole('row');
    expect(bodyRows[0]).toHaveClass('h-11', 'scroll-mt-10');
    expect(bodyRows[0]).toHaveClass('[&_button]:min-h-6', '[&_button]:min-w-6');
    expect(screen.getByRole('button', { name: 'Open REQ-101' })).toBeInTheDocument();

    const magnitudeHeader = screen.getByRole('columnheader', { name: 'Risk score' });
    const identityHeader = screen.getByRole('columnheader', { name: 'Request ID' });
    expect(magnitudeHeader).toHaveClass('text-right', 'tabular-nums');
    expect(identityHeader).toHaveClass('text-left', 'tabular-nums');
    expect(screen.getByRole('cell', { name: '72' })).toHaveClass('text-right', 'tabular-nums');
    expect(screen.getByRole('cell', { name: 'REQ-101' })).toHaveClass('text-left', 'tabular-nums');
    expect(screen.getByRole('cell', { name: '2026-08-29' })).toHaveClass('text-left', 'tabular-nums');

    const sortTitle = screen.getByRole('button', { name: 'Sort by Title' });
    const nonSortableHeader = screen.getByRole('columnheader', { name: 'Request ID' });
    expect(nonSortableHeader).toHaveClass('uppercase');
    // Tailwind preflight resets text-transform on buttons, so this must be
    // declared on the sortable control rather than relying on its <th>.
    expect(sortTitle).toHaveClass('uppercase');
    sortTitle.focus();
    await user.keyboard('{Enter}');
    expect(onSortingChange).toHaveBeenLastCalledWith([{ id: 'title', desc: false }]);
    expect(sortTitle.closest('th')).toHaveClass('scroll-mt-10');

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(3);
    await user.click(screen.getByRole('button', { name: 'Previous page' }));
    expect(onPageChange).toHaveBeenCalledWith(1);
    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '25');
    expect(onPageSizeChange).toHaveBeenCalledWith(25);

    expect(screen.getByText('Mobile Customer portal').closest('[data-slot="data-table-mobile"]')).toHaveClass('md:hidden');
    expect(screen.getByRole('table', { name: 'Assessment requests' }).closest('[data-slot="data-table-desktop"]')).toHaveClass('hidden', 'md:block', 'scroll-pt-10');

    expect(localStorage.getItem('csrm:data-table-density:requestor-1')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Use compact density' }));
    expect(localStorage.getItem('csrm:data-table-density:requestor-1')).toBe('compact');
    expect(within(screen.getByRole('rowgroup', { name: 'Table body' })).getAllByRole('row')[0]).toHaveClass('h-9');
    expect(screen.getByRole('button', { name: 'Use default density' })).toBeInTheDocument();

    view.rerender(<DataTable {...props} densityUserId="requestor-2" />);
    expect(within(screen.getByRole('rowgroup', { name: 'Table body' })).getAllByRole('row')[0]).toHaveClass('h-11');

    for (const state of ['loading', 'empty', 'error', 'permission'] as const) {
      view.rerender(<DataTable {...props} state={state} data={[]} />);
      const visibleStates = [
        screen.queryByRole('status', { name: 'Loading risk register rows' }),
        screen.queryByText('There are no assessment requests yet.'),
        screen.queryByText('Assessment requests could not be loaded.'),
        screen.queryByText('You do not have permission to view these requests.'),
      ].filter(Boolean);
      expect(visibleStates).toHaveLength(1);
      expect(screen.queryByText('Customer portal')).not.toBeInTheDocument();
      if (state === 'loading') {
        expect(screen.getAllByTestId('data-table-skeleton-row')).toHaveLength(10);
        expect(screen.getAllByTestId('data-table-skeleton-row')[0]).toHaveClass('h-9');
        expect(screen.queryByText('23 results')).not.toBeInTheDocument();
        expect(screen.queryByText('Page 2 of 3')).not.toBeInTheDocument();
        expect(screen.getByRole('table', { name: 'Loading risk register rows layout' })).toBeInTheDocument();
      }
    }
  });

  it('enables sorting when a sorting handler is supplied after the first render', async () => {
    const DataTable = await loadDataTable();
    const baseProps: TestDataTableProps = {
      ariaLabel: 'Requests',
      columns,
      data: rows,
      densityUserId: 'requestor-sorting',
      getRowId: (row) => row.id,
      loadingLabel: 'Loading requests',
      onPageChange: vi.fn(),
      page: 1,
      pageSize: 10,
      renderMobileCard: (row) => <p>{row.title}</p>,
      state: 'populated',
      stateSlots: { empty: null, error: null, permission: null },
      totalCount: rows.length,
    };

    const view = render(<DataTable {...baseProps} />);
    expect(screen.queryByRole('button', { name: 'Sort by Title' })).not.toBeInTheDocument();

    // Same columns reference: sorting must follow the handler, not the first render.
    view.rerender(<DataTable {...baseProps} onSortingChange={vi.fn()} />);
    expect(screen.getByRole('button', { name: 'Sort by Title' })).toBeInTheDocument();
  });

  it('omits unsupported controls and provides an opt-in labelled sticky scroll region', async () => {
    const DataTable = await loadDataTable();
    const onPageChange = vi.fn();

    render(
      <DataTable
        ariaLabel="Risk Register"
        columns={columns}
        data={rows}
        densityUserId="risk-register-1"
        getRowId={(row) => row.id}
        onPageChange={onPageChange}
        page={1}
        pageSize={10}
        renderMobileCard={(row) => <article>{row.title}</article>}
        state="populated"
        loadingLabel="Loading risks"
        stateSlots={{ empty: null, error: null, permission: null }}
        stickyFirstColumn
        totalCount={23}
      />,
    );

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Rows per page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sort by Title' })).not.toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Risk Register, scrolls horizontally' })).toHaveAttribute('tabindex', '0');
    expect(screen.getByRole('columnheader', { name: 'Request ID' })).toHaveClass('sticky', 'left-0', 'border-r', 'bg-surface');
    expect(screen.getByRole('cell', { name: 'REQ-101' })).toHaveClass('sticky', 'left-0', 'border-r', 'bg-surface', 'group-hover:bg-[image:linear-gradient(var(--surface-hover),var(--surface-hover))]');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });
});
