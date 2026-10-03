import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentType } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CsrmAssessmentRequest, RequestListQuery, RequestPagination } from './request-domain';

const replace = vi.hoisted(() => vi.fn());
const search = vi.hoisted(() => ({ value: 'view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&page=2&pageSize=20&owner=forged' }));

vi.mock('next/navigation', () => ({
  usePathname: () => '/app/requests',
  useRouter: () => ({ replace }),
  useSearchParams: () => new URLSearchParams(search.value),
}));

type RequestTableProps = {
  requests: readonly CsrmAssessmentRequest[];
  query: RequestListQuery;
  pagination: RequestPagination;
  densityUserId: string;
  state?: 'populated' | 'loading' | 'empty' | 'error' | 'permission';
};

const query: RequestListQuery = {
  q: 'portal',
  status: 'submitted',
  sort: 'updatedAt:desc',
  page: 2,
  pageSize: 20,
};

const pagination: RequestPagination = { page: 2, pageSize: 20, pageCount: 3, total: 45 };

const request: CsrmAssessmentRequest = {
  documentId: 'request-1',
  requestNumber: 'RAR-2026-X7K4Q2',
  title: 'Customer portal review',
  description: 'Review the customer portal.',
  requestStatus: 'submitted',
  dueDate: '2026-09-12',
  updatedAt: '2026-08-21T11:30:00.000Z',
  dueDateLabel: '12 Sept 2026',
  updatedDateLabel: '21 Aug 2026',
  informationSystems: [],
  informationAssets: [],
  questionnaire: null,
  assessment: null,
};

async function loadRequestTable(): Promise<ComponentType<RequestTableProps>> {
  const sourcePath = resolve(process.cwd(), 'src/features/requests/request-table.tsx');
  if (!existsSync(sourcePath)) throw new Error('PHASE2_RED_W0_02B_REQUEST_TABLE_BEHAVIOR_ABSENT');

  const moduleName = './request-' + 'table';
  const module = await import(/* @vite-ignore */ moduleName) as { RequestTable?: ComponentType<RequestTableProps> };
  if (!module.RequestTable) throw new Error('PHASE2_RED_W0_02B_REQUEST_TABLE_BEHAVIOR_ABSENT');
  return module.RequestTable;
}

beforeEach(() => {
  replace.mockReset();
  search.value = 'view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&page=2&pageSize=20&owner=forged';
});

describe('RequestTable', () => {
  it('renders responsive request content and writes bounded controls to the URL', async () => {
    const RequestTable = await loadRequestTable();
    const user = userEvent.setup();
    render(<RequestTable requests={[request]} query={query} pagination={pagination} densityUserId="requestor" />);

    expect(replace).not.toHaveBeenCalled();
    expect(screen.getByRole('table', { name: 'My assessment requests' })).toBeInTheDocument();
    expect(screen.getAllByRole('link', { name: /Customer portal review/ })).toHaveLength(2);
    expect(screen.getAllByText('RAR-2026-X7K4Q2')).toHaveLength(2);
    expect(screen.getAllByText('Submitted').filter((element) => element.closest('[data-slot="data-table-mobile"], [data-slot="data-table-desktop"]'))).toHaveLength(2);
    expect(screen.getAllByText('Due 12 Sept 2026')).toHaveLength(2);
    expect(screen.getByText('45 results')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();

    const searchInput = screen.getByRole('searchbox', { name: 'Search requests' });
    await user.clear(searchInput);
    await user.type(searchInput, 'identity');
    await user.click(screen.getByRole('button', { name: 'Search' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=identity&status=submitted&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'draft');
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=draft&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Sort by Title' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=title%3Aasc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Sort by Due date' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=dueDate%3Aasc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Sort by Updated' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=updatedAt%3Aasc&pageSize=20', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Next page' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&page=3&pageSize=20', { scroll: false });

    await user.selectOptions(screen.getByRole('combobox', { name: 'Rows per page' }), '50');
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&pageSize=50', { scroll: false });

    await user.click(screen.getByRole('button', { name: 'Remove Search filter' }));
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&status=submitted&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });
  });

  it('labels a released request Released in its badge, the status options and the chip, while the URL keeps approved (D-46)', async () => {
    const RequestTable = await loadRequestTable();
    const user = userEvent.setup();
    search.value = 'sort=updatedAt%3Adesc&pageSize=20';
    const released: CsrmAssessmentRequest = { ...request, requestStatus: 'approved' };
    const unfiltered = { ...query, q: '', status: undefined, page: 1 };
    const view = render(<RequestTable requests={[released]} query={unfiltered} pagination={pagination} densityUserId="requestor" />);

    const releasedOption = [...screen.getByRole('combobox', { name: 'Filter by status' }).querySelectorAll('option')].find((option) => option.value === 'approved');
    expect(releasedOption?.textContent).toBe('Released');
    expect(screen.getAllByText('Released').filter((element) => element.closest('[data-slot="data-table-mobile"], [data-slot="data-table-desktop"]'))).toHaveLength(2);

    // Only the label changes: choosing Released still writes the stored value to the URL.
    await user.selectOptions(screen.getByRole('combobox', { name: 'Filter by status' }), 'approved');
    expect(replace).toHaveBeenLastCalledWith('/app/requests?status=approved&sort=updatedAt%3Adesc&pageSize=20', { scroll: false });

    view.rerender(<RequestTable requests={[released]} query={{ ...unfiltered, status: 'approved' }} pagination={pagination} densityUserId="requestor" />);
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('approved');
    expect(screen.getByText('Status: Released')).toBeInTheDocument();
    expect(screen.queryByText(/Approved/)).not.toBeInTheDocument();
  });

  it('reflects canonical date sorting and recovers a stale page', async () => {
    const RequestTable = await loadRequestTable();
    const view = render(<RequestTable requests={[request]} query={{ ...query, sort: 'dueDate:desc' }} pagination={pagination} densityUserId="requestor" />);
    expect(screen.getByRole('columnheader', { name: 'Due date' })).toHaveAttribute('aria-sort', 'descending');

    view.rerender(<RequestTable requests={[]} query={{ ...query, page: 5 }} pagination={{ page: 5, pageSize: 20, pageCount: 2, total: 35 }} densityUserId="requestor" />);
    expect(replace).toHaveBeenLastCalledWith('/app/requests?view=cards&q=portal&status=submitted&sort=updatedAt%3Adesc&page=2&pageSize=20', { scroll: false });
    expect(screen.getByRole('status', { name: 'Loading assessment requests' })).toBeInTheDocument();
    expect(screen.queryByText('Create your first assessment request')).not.toBeInTheDocument();
    expect(screen.queryByText('35 results')).not.toBeInTheDocument();
  });

  it('distinguishes first-use, filtered, transport, and permission states', async () => {
    const RequestTable = await loadRequestTable();
    const view = render(<RequestTable requests={[]} query={{ ...query, q: '', status: undefined, page: 1 }} pagination={{ page: 1, pageSize: 20, pageCount: 0, total: 0 }} densityUserId="requestor" state="empty" />);

    expect(screen.getByRole('heading', { name: 'No assessment requests yet' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'New request' })).toHaveAttribute('href', '/app/requests/new');
    view.rerender(<RequestTable requests={[]} query={{ ...query, page: 1 }} pagination={{ page: 1, pageSize: 20, pageCount: 0, total: 0 }} densityUserId="requestor" state="empty" />);
    expect(screen.getByRole('heading', { name: 'No assessment requests match these filters' })).toBeInTheDocument();
    view.rerender(<RequestTable requests={[]} query={query} pagination={pagination} densityUserId="requestor" state="error" />);
    expect(screen.getByRole('alert')).toHaveTextContent('couldn’t load assessment requests');
    view.rerender(<RequestTable requests={[]} query={query} pagination={pagination} densityUserId="requestor" state="permission" />);
    expect(screen.getByRole('alert')).toHaveTextContent('access to assessment requests');
    view.rerender(<RequestTable requests={[]} query={query} pagination={pagination} densityUserId="requestor" state="loading" />);
    expect(screen.getByRole('status', { name: 'Loading assessment requests' })).toBeInTheDocument();
    expect(screen.getByRole('searchbox', { name: 'Search requests' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Search' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toBeDisabled();
  });

  it('keeps the route server-owned and validates awaited search parameters', () => {
    const pagePath = resolve(process.cwd(), 'app/(app)/app/requests/page.tsx');
    if (!existsSync(pagePath)) throw new Error('PHASE2_RED_W0_02B_REQUEST_PAGE_BEHAVIOR_ABSENT');
    const source = readFileSync(pagePath, 'utf8');
    expect(source).toContain('await searchParams');
    expect(source).toContain('parseRequestListQuery');
    expect(source).toContain('listRequests');
    expect(source).not.toContain("'use client'");
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
