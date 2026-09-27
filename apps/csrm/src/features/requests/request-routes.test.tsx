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
  notFound: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/requests',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }),
}));
vi.mock('@/features/requests/request-service', () => ({
  getRequest: mocks.getRequest,
  hydrateInformationAssetSelections: mocks.hydrateInformationAssetSelections,
  hydrateInformationSystemSelections: mocks.hydrateInformationSystemSelections,
}));
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
  it('is titled by the page, and a missing request by the not-found page', async () => {
    const route = await detailRoute();
    expect(route.generateMetadata, 'the request detail declares its document title').toBeTypeOf('function');

    mocks.getRequest.mockResolvedValue(refused);
    await expect(route.generateMetadata!(props())).resolves.toEqual({ title: 'Assessment Request | IdamBox CSRM' });
    mocks.getRequest.mockResolvedValue(failed);
    await expect(route.generateMetadata!(props())).resolves.toEqual({ title: 'Assessment Request | IdamBox CSRM' });
    mocks.getRequest.mockResolvedValue(missing);
    await expect(route.generateMetadata!(props())).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.getRequest).toHaveBeenLastCalledWith('request-owned-by-another-requestor');
  });

  it.each([
    ['permission', refused, 'You don’t have access to this area'],
    ['error', failed, 'We couldn’t load this workspace'],
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
    ['error', failed, 'We couldn’t load this workspace'],
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
