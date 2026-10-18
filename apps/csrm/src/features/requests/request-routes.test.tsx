import '@testing-library/jest-dom/vitest';

import { render, screen } from '@testing-library/react';
import type { ReactElement } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * The Requestor's request detail and edit routes (WCAG 2.4.2 Page Titled, 1.3.1 and 2.4.6): every
 * state keeps exactly one level-one heading, and a refused or failed page is headed by the page it
 * is, never by the record, because the record may be another Requestor's. The document title names
 * the route; a request the read reports missing takes the in-shell not-found's title instead.
 */

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  getRequest: vi.fn(),
  granted: vi.fn(),
  hydrateInformationAssetSelections: vi.fn(),
  hydrateInformationSystemSelections: vi.fn(),
  listMyRequests: vi.fn(),
  listRequestNotes: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/requests',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }),
}));
vi.mock('@/features/requests/request-service', () => ({
  getRequest: mocks.getRequest,
  hydrateInformationAssetSelections: mocks.hydrateInformationAssetSelections,
  hydrateInformationSystemSelections: mocks.hydrateInformationSystemSelections,
  listMyRequests: mocks.listMyRequests,
}));
vi.mock('@/features/request-notes/notes-service', () => ({ listRequestNotes: mocks.listRequestNotes }));
vi.mock('@/features/requests/request-actions', () => ({
  createRequestAction: vi.fn(),
  revertRequestToDraftAction: vi.fn(),
  searchInformationAssetsAction: vi.fn(),
  searchInformationSystemsAction: vi.fn(),
  submitRequestAction: vi.fn(),
  updateRequestAction: vi.fn(),
}));

type RouteProps = { params: Promise<{ documentId: string }> };
type RecordRoute = {
  default: (props: RouteProps) => Promise<ReactElement>;
  generateMetadata?: (props: RouteProps) => Promise<{ title?: unknown }>;
};

async function loadRoute(path: string): Promise<RecordRoute> {
  return import(/* @vite-ignore */ path) as Promise<RecordRoute>;
}

const detailRoute = () => loadRoute('../../../app/(app)/app/requests/[documentId]/page');
const editRoute = () => loadRoute('../../../app/(app)/app/requests/[documentId]/edit/page');
const props = (): RouteProps => ({ params: Promise.resolve({ documentId: 'request-owned-by-another-requestor' }) });
const refused = { data: null, error: { status: 403, message: 'Forbidden' } };
const failed = { data: null, error: { status: 500, message: 'Internal Server Error' } };
const missing = { data: null, error: { status: 404, message: 'Not Found' } };

function expectOneLevelOneHeading(name: string): void {
  const headings = screen.getAllByRole('heading', { level: 1 });
  expect(headings).toHaveLength(1);
  expect(headings[0]).toHaveTextContent(name);
  // The heading comes first, so the state reads as the page's content, not its title.
  expect(headings[0]!.compareDocumentPosition(screen.getByRole('alert')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  mocks.current.mockResolvedValue({ displayName: 'Maya Requestor' });
  mocks.granted.mockResolvedValue(new Set(['assessment-request:read']));
  mocks.hydrateInformationAssetSelections.mockResolvedValue({ data: [], error: null });
  mocks.hydrateInformationSystemSelections.mockResolvedValue({ data: [], error: null });
});

describe('the Requestor request detail route', () => {
  it('is titled by the page, and a missing or refused request by the not-found page', async () => {
    const route = await detailRoute();
    expect(route.generateMetadata, 'the request detail declares its document title').toBeTypeOf('function');

    /* O1 (13-UI-SPEC §8.6): a request Strapi refuses this viewer reads as a missing one, title included. */
    mocks.getRequest.mockResolvedValue(refused);
    await expect(route.generateMetadata!(props())).rejects.toThrow('NEXT_NOT_FOUND');
    mocks.getRequest.mockResolvedValue(failed);
    await expect(route.generateMetadata!(props())).resolves.toEqual({ title: 'Assessment Request | IdamBox CSRM' });
    mocks.getRequest.mockResolvedValue(missing);
    await expect(route.generateMetadata!(props())).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getRequest).toHaveBeenLastCalledWith('request-owned-by-another-requestor');
  });

  it.each([
    ['error', failed, 'We couldn’t load this page'],
  ] as const)('keeps the page heading above its %s state and names no record', async (kind, result, copy) => {
    mocks.getRequest.mockResolvedValue(result);
    const route = await detailRoute();
    render(await route.default(props()));

    expectOneLevelOneHeading('Assessment request');
    expect(screen.getByRole('alert')).toHaveAttribute('data-state-kind', kind);
    expect(screen.getByRole('alert')).toHaveTextContent(copy);
    expect(document.body).not.toHaveTextContent(/\b(?:RAR|QUES|ASM)-[0-9A-Z]/);
    expect(screen.queryByRole('region', { name: 'Request actions' })).not.toBeInTheDocument();
  });
});

/*
 * O1 (the 13-19 walk; 13-UI-SPEC §8.6, D-23): another Requestor opening a request's page gets the page's own not-found
 * state, as for a request that does not exist, never the permission state: no record, notes surface, count or flag, and
 * no notes read. Strapi still answers the request read with 403 (Phase 17's G-12 unifies that refusal in the API).
 */
describe('the Requestor request detail route for a request Strapi refuses this viewer', () => {
  it('renders the page’s not-found state, as for a missing request, and reads no notes', async () => {
    const route = await detailRoute();
    for (const result of [refused, missing]) {
      mocks.getRequest.mockResolvedValue(result);
      await expect(route.default(props())).rejects.toThrow('NEXT_NOT_FOUND');
    }
    expect(mocks.notFound).toHaveBeenCalledTimes(2);
    expect(mocks.listRequestNotes).not.toHaveBeenCalled();
  });
});

/*
 * 13-UI-SPEC §8.6 (D-23, G-12; the orchestrator's Phase 17 negative case): a request read whose notes summary is null,
 * the shape a participant's read will have, renders no Notes section, no hub Notes row, no count and no New marker, and
 * the page makes no notes read at all.
 */
describe('the Requestor request detail route for a viewer the read gives no notes', () => {
  it('renders no notes surface and reads no notes', async () => {
    mocks.getRequest.mockResolvedValue({
      data: {
        documentId: 'request-1', requestNumber: 'RAR-2026-0001', title: 'Portal assessment', description: null,
        assessmentType: 'Project', businessCriticality: 'High', requestStatus: 'submitted',
        submittedDate: '2026-09-01T00:00:00.000Z', dueDate: '2026-10-01', updatedAt: null, dueDateLabel: '1 Oct 2026',
        updatedDateLabel: null, requestorName: 'Jane Doe', informationSystems: [], informationAssets: [], questionnaire: null,
        assessment: null, relationships: { questionnaire: { availability: 'absent' }, assessment: { availability: 'absent' } },
        assignment: { assignee: null }, notes: null,
      },
      error: null,
    });
    const route = await detailRoute();
    render(await route.default(props()));
    expect(screen.getByRole('heading', { level: 1, name: 'Portal assessment' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Notes' })).not.toBeInTheDocument();
    expect(screen.queryByText('Notes', { selector: 'dt' })).not.toBeInTheDocument();
    expect(screen.queryByText(/notes?/i)).not.toBeInTheDocument();
    expect(screen.queryByText('New')).not.toBeInTheDocument();
    expect(document.getElementById('notes')).toBeNull();
    expect(mocks.listRequestNotes).not.toHaveBeenCalled();
  });
});

describe('the Requestor request edit route', () => {
  it('is titled by the page, and a missing request by the not-found page', async () => {
    const route = await editRoute();
    expect(route.generateMetadata, 'the request edit route declares its document title').toBeTypeOf('function');

    mocks.getRequest.mockResolvedValue(refused);
    await expect(route.generateMetadata!(props())).resolves.toEqual({ title: 'Edit Request | IdamBox CSRM' });
    mocks.getRequest.mockResolvedValue(missing);
    await expect(route.generateMetadata!(props())).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it.each([
    ['permission', refused, 'You don’t have access to this area'],
    ['error', failed, 'We couldn’t load this page'],
  ] as const)('keeps the page heading above its %s state', async (kind, result, copy) => {
    mocks.getRequest.mockResolvedValue(result);
    const route = await editRoute();
    render(await route.default(props()));

    expectOneLevelOneHeading('Edit assessment request');
    expect(screen.getByRole('alert')).toHaveAttribute('data-state-kind', kind);
    expect(screen.getByRole('alert')).toHaveTextContent(copy);
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
  });

  it('keeps the page heading above the refusal of a request that is no longer a draft, and names no record', async () => {
    mocks.getRequest.mockResolvedValue({
      data: {
        documentId: 'request-owned-by-another-requestor', requestNumber: 'RAR-2026-X7K4Q2', title: 'Submitted portal review',
        description: null, requestStatus: 'submitted', submittedDate: '2026-08-29T00:00:00.000Z', dueDate: null, updatedAt: null,
        dueDateLabel: null, updatedDateLabel: null, informationSystems: [], informationAssets: [], questionnaire: null, assessment: null,
      },
      error: null,
    });
    const route = await editRoute();
    render(await route.default(props()));

    expectOneLevelOneHeading('Edit assessment request');
    expect(screen.getByRole('alert')).toHaveAttribute('data-state-kind', 'permission');
    expect(screen.queryByRole('button', { name: 'Save draft' })).not.toBeInTheDocument();
    expect(document.body).not.toHaveTextContent('RAR-2026-X7K4Q2');
    expect(document.body).not.toHaveTextContent('Submitted portal review');
  });
});

type ListRoute = { default: (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<ReactElement> };
const myRequestsRoute = () => import(/* @vite-ignore */ '../../../app/(app)/app/requests/(my-requests)/page') as Promise<ListRoute>;
const listProps = (params: Record<string, string> = {}) => ({ searchParams: Promise.resolve(params) });

/** One served my requests item (D-02 item 6): submitted, so the Security Analyst holds it. */
const servedItem = {
  documentId: 'request-1',
  requestNumber: 'RAR-2026-X7K4Q2',
  title: 'Customer portal review',
  requestStatus: 'submitted',
  submittedDate: '2026-08-20T10:00:00.000Z',
  dueDate: '2026-09-12',
  updatedAt: '2026-08-21T11:30:00.000Z',
  daysSinceSubmission: 1,
  holder: 'analyst',
  stage: { key: 'submitted', label: 'Submitted' },
  nextAction: { summary: 'The Security Analyst is reviewing your request and will send you a questionnaire to answer.' },
  returned: null,
  questionnaire: null,
} as const;

describe('the My requests route', () => {
  it('reads GET /v1/my_requests with the parsed query and shows whose turn each request is (D-34)', async () => {
    mocks.listMyRequests.mockResolvedValue({
      data: { items: [servedItem], pagination: { page: 1, pageSize: 10, pageCount: 1, total: 1 } },
      error: null,
    });
    const route = await myRequestsRoute();
    render(await route.default(listProps({ q: '  portal  ', status: 'submitted', owner: 'another-requestor' })));

    expect(mocks.listMyRequests).toHaveBeenCalledTimes(1);
    expect(mocks.listMyRequests).toHaveBeenCalledWith({ q: 'portal', status: 'submitted', holder: undefined, sort: 'updatedAt:desc', page: 1, pageSize: 10 });
    const table = screen.getByRole('table', { name: 'My assessment requests' });
    expect(table).toHaveTextContent('With the Security Analyst');
    expect(table).toHaveTextContent('The Security Analyst is reviewing your request and will send you a questionnaire to answer.');
  });

  it('passes the Show filter’s holder to the read and drops one it does not know (D-35)', async () => {
    mocks.listMyRequests.mockResolvedValue({ data: { items: [], pagination: { page: 1, pageSize: 10, pageCount: 0, total: 0 } }, error: null });
    const route = await myRequestsRoute();
    render(await route.default(listProps({ holder: 'requestor' })));
    expect(mocks.listMyRequests).toHaveBeenLastCalledWith({ q: '', status: undefined, holder: 'requestor', sort: 'updatedAt:desc', page: 1, pageSize: 10 });

    render(await route.default(listProps({ holder: 'everyone' })));
    expect(mocks.listMyRequests.mock.lastCall?.[0]).toMatchObject({ holder: undefined });
  });

  it('shows the permission state when the read is refused, and no record', async () => {
    mocks.listMyRequests.mockResolvedValue(refused);
    const route = await myRequestsRoute();
    render(await route.default(listProps()));

    expect(screen.getByRole('alert')).toHaveAttribute('data-state-kind', 'permission');
    expect(screen.queryByRole('table', { name: 'My assessment requests' })).not.toBeInTheDocument();
  });
});
