import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { act, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType, ReactNode } from 'react';
import { renderToString } from 'react-dom/server';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { installTestResizeObserver, stubHorizontalGeometry, TestResizeObserver } from '@/test/layout-stubs';
import type { DataTableProps } from './data-table';

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
  wrap?: boolean;
  headerHidden?: boolean;
};

type TestDataTableProps = {
  ariaLabel: string;
  columns: TestColumn[];
  data: RequestRow[];
  densityUserId: string;
  filters?: Array<{ id: string; label: string; value: string }>;
  getRowId: (row: RequestRow) => string;
  getRowProps?: (row: RequestRow) => { className?: string; 'data-pending'?: true };
  paginated?: boolean;
  onClearFilter?: (id: string) => void;
  onClearFilters?: () => void;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (pageSize: number) => void;
  onSortingChange?: (sorting: Array<{ id: string; desc: boolean }>) => void;
  page: number;
  pageSize: number;
  renderMobileCard: (row: RequestRow) => ReactNode;
  tableFrom?: '54rem' | '60rem' | '65rem' | '70rem' | 'never';
  sorting?: Array<{ id: string; desc: boolean }>;
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

function resize() {
  act(() => TestResizeObserver.notifyAll());
}

beforeEach(() => {
  installTestResizeObserver();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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
    expect(tableHeader).toHaveClass('sticky', 'top-0', 'z-10', 'bg-surface/95', 'backdrop-blur-sm');
    expect(within(tableHeader).getAllByRole('columnheader')[0]).toHaveClass('h-10');

    /*
     * Separated borders (W-2): every rule is drawn by its own cell, so the pinned identifier column's end
     * hairline moves with the column. A collapsed border belongs to the table's grid line instead, and it
     * slid under the pinned column as soon as the table scrolled.
     */
    expect(screen.getByRole('table', { name: 'Assessment requests' })).toHaveClass('border-separate', 'border-spacing-0');
    for (const header of within(tableHeader).getAllByRole('columnheader')) expect(header).toHaveClass('border-b', 'border-border');

    const bodyRows = within(screen.getByRole('rowgroup', { name: 'Table body' })).getAllByRole('row');
    for (const cell of within(bodyRows[0]).getAllByRole('cell')) expect(cell).toHaveClass('border-b', 'border-border', 'group-last:border-b-0');
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
    // A one-cell grid, so the end-edge scroll cue can share the table's cell and stick to the edge.
    expect(screen.getByRole('table', { name: 'Assessment requests' }).closest('[data-slot="data-table-desktop"]')).toHaveClass('hidden', 'md:grid', 'scroll-pt-10');

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

  it('prints the sorted column\'s direction cue and never an unsorted column\'s (X-4, verdict 4c)', async () => {
    const DataTable = await loadDataTable();
    render(
      <DataTable
        ariaLabel="Assessment requests"
        columns={columns}
        data={rows}
        densityUserId="requestor-print"
        getRowId={(row) => row.id}
        loadingLabel="Loading assessment requests"
        onPageChange={vi.fn()}
        onSortingChange={vi.fn()}
        page={1}
        pageSize={10}
        renderMobileCard={(row) => <article>{row.title}</article>}
        sorting={[{ id: 'title', desc: false }]}
        state="populated"
        stateSlots={{ empty: <p>None</p>, error: <p>Failed</p>, permission: <p>Refused</p> }}
        totalCount={rows.length}
      />,
    );

    // The sorted column's cue states the printed order, so it prints; the unsorted cue is interaction-only.
    expect(screen.getByRole('button', { name: 'Sort by Title' }).querySelector('svg')).not.toHaveAttribute('data-print');
    expect(screen.getByRole('button', { name: 'Sort by Risk score' }).querySelector('svg')).toHaveAttribute('data-print', 'hidden');
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

  function registerProps(overrides: Partial<TestDataTableProps> = {}): TestDataTableProps {
    return {
      ariaLabel: 'Risk Register',
      columns,
      data: rows,
      densityUserId: 'risk-register-1',
      getRowId: (row) => row.id,
      onPageChange: vi.fn(),
      page: 1,
      pageSize: 10,
      renderMobileCard: (row) => <article>{row.title}</article>,
      state: 'populated',
      loadingLabel: 'Loading risks',
      stateSlots: { empty: null, error: null, permission: null },
      totalCount: 23,
      ...overrides,
    };
  }

  it('omits unsupported controls', async () => {
    const DataTable = await loadDataTable();
    const onPageChange = vi.fn();

    render(<DataTable {...registerProps({ onPageChange })} />);

    expect(screen.queryByText('Clear filters')).not.toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Rows per page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sort by Title' })).not.toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Next page' }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('makes the scroller a labelled, focusable region with a sticky identifier column only while the table overflows', async () => {
    const DataTable = await loadDataTable();
    render(<DataTable {...registerProps()} />);

    const scroller = document.querySelector<HTMLElement>('[data-slot="data-table-desktop"]')!;
    const identifierHeader = screen.getByRole('columnheader', { name: 'Request ID' });
    const identifierCell = screen.getByRole('cell', { name: 'REQ-101' });
    const regionAttributes = ['role', 'aria-label', 'tabindex'];

    // jsdom lays nothing out, so the table fits: no region, no tab stop, no sticky column, no hairline.
    expect(scroller).toHaveAttribute('data-overflow', 'false');
    for (const attribute of regionAttributes) expect(scroller).not.toHaveAttribute(attribute);
    expect(screen.queryByRole('region', { name: /scrolls horizontally/ })).not.toBeInTheDocument();
    for (const cell of [identifierHeader, identifierCell]) {
      expect(cell).not.toHaveClass('sticky');
      expect(cell).not.toHaveClass('border-r');
    }

    stubHorizontalGeometry(scroller, { scrollWidth: 1400, clientWidth: 688 });
    resize();

    const region = screen.getByRole('region', { name: 'Risk Register, scrolls horizontally' });
    expect(region).toBe(scroller);
    expect(region).toHaveAttribute('tabindex', '0');
    expect(region).toHaveAttribute('data-overflow', 'true');
    expect(region).toHaveAttribute('data-overflow-end', 'false');
    expect(region).toHaveClass('focus-visible:ring-2', 'focus-visible:ring-ring');
    expect(identifierHeader).toHaveClass('sticky', 'left-0', 'border-r', 'border-border', 'bg-surface');
    expect(identifierCell).toHaveClass(
      'sticky',
      'left-0',
      'border-r',
      'border-border',
      'bg-surface',
      'group-hover:bg-[image:linear-gradient(var(--surface-hover),var(--surface-hover))]',
    );
    // Only the identifier column sticks.
    expect(screen.getByRole('cell', { name: 'Customer portal' })).not.toHaveClass('sticky');

    // At the end of the scroll no column is hidden, so the end-edge cue goes.
    region.scrollLeft = 712;
    fireEvent.scroll(region);
    expect(region).toHaveAttribute('data-overflow-end', 'true');

    stubHorizontalGeometry(scroller, { scrollWidth: 688, clientWidth: 688 });
    resize();
    expect(scroller).toHaveAttribute('data-overflow', 'false');
    for (const attribute of regionAttributes) expect(scroller).not.toHaveAttribute(attribute);
    expect(identifierHeader).not.toHaveClass('sticky');
  });

  it('never makes the loading skeleton a region or a tab stop', async () => {
    const DataTable = await loadDataTable();
    render(<DataTable {...registerProps({ state: 'loading', data: [] })} />);

    expect(document.querySelector('[data-slot="data-table-desktop"]')).toBeNull();
    const skeleton = document.querySelector('[data-slot="data-table-loading-desktop"]')!;
    stubHorizontalGeometry(skeleton, { scrollWidth: 1400, clientWidth: 688 });
    resize();

    expect(screen.queryByRole('region', { name: /scrolls horizontally/ })).not.toBeInTheDocument();
    expect(skeleton).not.toHaveAttribute('data-overflow');
    expect(document.querySelectorAll('[tabindex]')).toHaveLength(0);
  });

  it('wraps a long-text column within its bounds and leaves its header and the other columns on one line', async () => {
    const DataTable = await loadDataTable();
    const wrappingColumns = columns.map((column) => (column.header === 'Title' ? { ...column, wrap: true } : column));
    render(<DataTable {...registerProps({ columns: wrappingColumns })} />);

    expect(screen.getByRole('cell', { name: 'Customer portal' })).toHaveClass('whitespace-normal', 'min-w-56', 'max-w-md');
    expect(screen.getByRole('columnheader', { name: 'Title' })).not.toHaveClass('whitespace-normal');
    expect(screen.getByRole('cell', { name: 'REQ-101' })).not.toHaveClass('whitespace-normal');
  });

  it('renders on the server without the region, which appears only once overflow is measured', async () => {
    const DataTable = await loadDataTable();
    const host = document.createElement('div');
    host.innerHTML = renderToString(<DataTable {...registerProps()} />);
    const scroller = host.querySelector('[data-slot="data-table-desktop"]');

    expect(scroller).toHaveAttribute('data-overflow', 'false');
    for (const attribute of ['role', 'aria-label', 'tabindex']) expect(scroller).not.toHaveAttribute(attribute);
    expect(host.querySelector('[role="region"]')).toBeNull();
  });

  /*
   * 14-UI-SPEC §3.2: a list that is never paged (a request's files, at most 20 active ones) shows no pager and no
   * results count of its own; its section counts it. The density toggle stays.
   */
  it('shows no pager and no results count when the list is not paged, and keeps the density toggle', async () => {
    const DataTable = await loadDataTable();
    render(<DataTable {...registerProps({ paginated: false, totalCount: 2, pageSize: 2 })} />);

    expect(screen.queryByText(/^Page \d+ of \d+$/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next page' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous page' })).not.toBeInTheDocument();
    expect(screen.queryByText(/^\d+ results?$/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Use compact density' })).toBeInTheDocument();
  });

  /*
   * The Phase 14 pilot's walk, O5 (G-4: purpose-built phone layouts): below 768px every list shows cards, whose layout no
   * density changes, so the density toggle shows only where the table does.
   */
  it('shows the density toggle only where the table shows, never with the cards below 768px (O5)', async () => {
    const DataTable = await loadDataTable();
    const { container } = render(<DataTable {...registerProps({ paginated: false, totalCount: 2, pageSize: 2 })} />);

    const toggle = screen.getByRole('button', { name: 'Use compact density' });
    expect(container.querySelector('[data-slot="data-table-mobile"]'), 'the cards below 768px').toHaveClass('md:hidden');
    expect(toggle, 'the toggle is hidden with the table below 768px').toHaveClass('max-md:hidden');
    expect(toggle, 'and shows with it from 768px').not.toHaveClass('hidden');
  });

  /*
   * The Phase 14 pilot's walk, D2 (X-21; 14-UI-SPEC §3.2): a list in a column narrower than the page names the width its
   * table needs, and its own width then chooses: the table from that width, the cards below it, and the density toggle
   * only with the table. `never` keeps the cards at every width.
   */
  it('chooses between the cards and the table by its own width when it names the width its table needs (D2)', async () => {
    const DataTable = await loadDataTable();
    const { container } = render(<DataTable {...registerProps({ paginated: false, totalCount: 2, pageSize: 2, tableFrom: '65rem' })} />);

    expect(screen.getByRole('region', { name: 'Risk Register controls' }), 'the list is its own container').toHaveClass('@container');
    const cards = container.querySelector('[data-slot="data-table-mobile"]');
    expect(cards).toHaveClass('@min-[65rem]:hidden');
    expect(cards).not.toHaveClass('md:hidden');
    const scroller = container.querySelector('[data-slot="data-table-desktop"]');
    expect(scroller).toHaveClass('hidden', '@min-[65rem]:grid');
    expect(scroller).not.toHaveClass('md:grid');
    expect(screen.getByRole('button', { name: 'Use compact density' })).toHaveClass('@max-[65rem]:hidden');
  });

  it('keeps the cards at every width, and no density toggle, when its table may never show (D2)', async () => {
    const DataTable = await loadDataTable();
    const { container } = render(<DataTable {...registerProps({ paginated: false, totalCount: 2, pageSize: 2, tableFrom: 'never' })} />);

    expect(container.querySelector('[data-slot="data-table-mobile"]')!.className).not.toMatch(/hidden/);
    expect(container.querySelector('[data-slot="data-table-desktop"]')).toHaveClass('hidden');
    expect(container.querySelector('[data-slot="data-table-desktop"]')!.className).not.toMatch(/:grid/);
    expect(screen.getByRole('button', { name: 'Use compact density' })).toHaveClass('hidden');
  });

  /* 14-UI-SPEC §3.2, 1.3.1: an actions column keeps its header for assistive technology and shows none. */
  /*
   * 14-UI-REVIEW UI-04 (the pilot's ruling): a list may ask for a row-level hook, so a whole row can read as pending (the
   * §5 Optimistic UI pending opacity) where its cells alone would leave part of it looking settled. The hook is opt-in:
   * a table that does not ask renders every row exactly as before, attribute for attribute and class for class, so no
   * other table's markup changes.
   */
  it('adds nothing to a row unless the list asks for the row hook, so every other table’s rows are unchanged (UI-04)', async () => {
    const DataTable = await loadDataTable();
    render(<DataTable {...registerProps()} />);
    const bodyRows = within(screen.getByRole('table', { name: 'Risk Register' })).getAllByRole('rowgroup')[1]!.querySelectorAll('tr');
    expect(bodyRows).toHaveLength(2);
    for (const row of bodyRows) {
      expect(row.getAttributeNames().sort(), 'a row keeps only its slot and its classes').toEqual(['class', 'data-slot']);
      expect(row.getAttribute('class')).toBe(
        'border-b has-aria-expanded:bg-muted/50 data-[state=selected]:bg-muted scroll-mt-10 transition-colors duration-80 ease-standard hover:bg-surface-hover [&_button]:min-h-6 [&_button]:min-w-6 group h-11',
      );
    }
  });

  it('sets the row hook’s data attribute and class on the whole row when the list asks for it (UI-04)', async () => {
    const DataTable = await loadDataTable();
    const pendingClass = 'data-[pending=true]:opacity-60';
    render(<DataTable {...registerProps({ getRowProps: (row) => (row.id === 'REQ-102' ? { className: pendingClass, 'data-pending': true } : { className: pendingClass }) })} />);
    const row = (name: string) => screen.getByRole('cell', { name }).closest('tr')!;
    expect(row('REQ-102')).toHaveAttribute('data-pending', 'true');
    expect(row('REQ-102')).toHaveClass(pendingClass, 'group', 'h-11');
    expect(row('REQ-101')).not.toHaveAttribute('data-pending');
    expect(row('REQ-101')).toHaveClass(pendingClass, 'group', 'h-11');
    expect(screen.getByRole('cell', { name: 'REQ-102' }), 'the cells stay as they were').not.toHaveAttribute('data-pending');
  });

  it('keeps a hidden column header for assistive technology only', async () => {
    const DataTable = await loadDataTable();
    const hidden: TestColumn[] = [...columns.slice(0, -1), { ...columns.at(-1)!, headerHidden: true }];
    render(<DataTable {...registerProps({ columns: hidden })} />);

    const header = screen.getByRole('columnheader', { name: 'Actions' });
    expect(header.querySelector('.sr-only')).toHaveTextContent('Actions');
    expect(screen.getByRole('columnheader', { name: 'Title' }).querySelector('.sr-only')).toBeNull();
  });

  it('no longer accepts stickyFirstColumn: every DataTable sticks its identifier column while it overflows', () => {
    const retired: Partial<DataTableProps<RequestRow>> = {
      // @ts-expect-error stickyFirstColumn is retired (UI-SPEC section 5.2).
      stickyFirstColumn: true,
    };
    expect(retired).not.toHaveProperty('ariaLabel');
  });
});

/*
 * A phone card's first row holds the record's number and its status badge at opposite ends (UI-SPEC §7). When a long
 * number and a long badge cannot share the row, the row wraps and the badge drops below the number; without the wrap,
 * the badge left the Requests queue card at 320px (11-21, WCAG 1.4.10). A row that keeps the number in a column with
 * the title lets that column grow from a small basis, so the badge stays beside it whenever the number fits and drops
 * below only when it would cover the number. jsdom measures no layout, so this reads the source of every phone card;
 * the e2e reflow proof measures them (accessibility.spec.ts).
 */
describe('phone card rows', () => {
  type JsxNode = ts.JsxElement | ts.JsxSelfClosingElement;
  type CardRow = { at: string; wraps: boolean; column?: { at: string; growsFromBasis: boolean } };

  const tagName = (node: JsxNode, file: ts.SourceFile) => (ts.isJsxElement(node) ? node.openingElement.tagName : node.tagName).getText(file);
  const classText = (node: JsxNode, file: ts.SourceFile) => {
    const attributes = ts.isJsxElement(node) ? node.openingElement.attributes : node.attributes;
    const className = attributes.properties.find((attribute) => ts.isJsxAttribute(attribute) && attribute.name.getText(file) === 'className');
    return className && ts.isJsxAttribute(className) ? className.initializer?.getText(file) ?? '' : '';
  };
  const descendantTags = (node: ts.Node, file: ts.SourceFile) => {
    const names: string[] = [];
    const visit = (child: ts.Node): void => {
      if (ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child)) names.push(tagName(child, file));
      ts.forEachChild(child, visit);
    };
    ts.forEachChild(node, visit);
    return names;
  };
  const isBadge = (name: string) => name.endsWith('Badge') || name === 'TreatmentStatus';
  const lineOf = (node: ts.Node, file: ts.SourceFile) => file.getLineAndCharacterOfPosition(node.getStart(file)).line + 1;

  /** Every row of a renderMobileCard that sets a record link and a badge at its two ends. */
  function cardRows(path: string): CardRow[] {
    const source = readFileSync(resolve(process.cwd(), path), 'utf8');
    if (!source.includes('renderMobileCard=')) return [];
    const file = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    const rows: CardRow[] = [];
    const visitCard = (node: ts.Node): void => {
      if (ts.isJsxElement(node) && /\bjustify-between\b/.test(classText(node, file))) {
        const inside = descendantTags(node, file);
        if (inside.includes('RecordLink') && inside.some(isBadge)) {
          const children = node.children.filter((child): child is JsxNode => ts.isJsxElement(child) || ts.isJsxSelfClosingElement(child));
          const column = children.some((child) => tagName(child, file) === 'RecordLink')
            ? undefined
            : children.find((child) => descendantTags(child, file).includes('RecordLink'));
          const columnClass = column ? classText(column, file) : '';
          rows.push({
            at: `${path}:${lineOf(node, file)}`,
            wraps: /\bflex-wrap\b/.test(classText(node, file)),
            // `grow`, not `flex-1`: Tailwind 4's flex-1 is `flex: 1`, whose zero basis would contend with the basis.
            ...(column ? { column: { at: `${path}:${lineOf(column, file)}`, growsFromBasis: /\bgrow\b/.test(columnClass) && /\bbasis-/.test(columnClass) } } : {}),
          });
        }
      }
      ts.forEachChild(node, visitCard);
    };
    const visit = (node: ts.Node): void => {
      if (ts.isJsxAttribute(node) && node.name.getText(file) === 'renderMobileCard' && node.initializer) visitCard(node.initializer);
      else ts.forEachChild(node, visit);
    };
    visit(file);
    return rows;
  }

  const rows = ['src', 'app'].flatMap((root) => readdirSync(resolve(process.cwd(), root), { encoding: 'utf8', recursive: true })
    .filter((path) => path.endsWith('.tsx') && !path.endsWith('.test.tsx'))
    .flatMap((path) => cardRows(`${root}/${path.split(sep).join('/')}`)));

  it('finds the number-and-badge row of every list’s phone card', () => {
    expect(rows.map(({ at }) => at.replace(/:\d+$/, '')).sort()).toEqual([
      'src/features/assessments/assessment-list.tsx',
      'src/features/assessments/assessment-list.tsx',
      'src/features/assessments/released-assessment.tsx',
      'src/features/questionnaires/questionnaire-list.tsx',
      'src/features/questionnaires/questionnaire-review-list.tsx',
      'src/features/requests/request-table.tsx',
      'src/features/risks/risk-register.tsx',
    ]);
  });

  it('wraps each row, so a long badge drops below a long number instead of leaving the card', () => {
    expect(rows.filter(({ wraps }) => !wraps).map(({ at }) => at)).toEqual([]);
  });

  it('grows a number-and-title column from a basis, so the badge stays beside it while the number fits', () => {
    expect(rows.flatMap(({ column }) => (column && !column.growsFromBasis ? [column.at] : []))).toEqual([]);
  });
});
