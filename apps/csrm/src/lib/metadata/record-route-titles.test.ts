import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * WCAG 2.4.2 on the record routes whose page raises notFound() for a record the read reports missing (WR-05,
 * residual R-08-16). Each page streams inside the (app)/app loading boundary, so its own notFound() comes too
 * late to change the document title; the route's metadata makes the same read through recordRouteMetadata and
 * raises notFound() itself, so Next renders the not-found's title, `Page not found | IdamBox CSRM`, in place of
 * the route's. A record that can be read, or is refused, keeps the route's title, which never names the record.
 */

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  getAnalystAssessment: vi.fn(),
  getQuestionnaire: vi.fn(),
  getQuestionnaireQuestions: vi.fn(),
  getRequest: vi.fn(),
  granted: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('server-only', () => ({}));
// The analyst routes gate on assessment:review before their read (D-23); these cases sign in as an analyst.
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({
    current: mocks.current,
    capabilitiesFor: () => ({ granted: mocks.granted }),
  }),
}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/questionnaires/questionnaire-service', () => ({
  getQuestionnaire: mocks.getQuestionnaire,
  getQuestionnaireQuestions: mocks.getQuestionnaireQuestions,
}));
vi.mock('@/features/requests/request-service', () => ({
  getRequest: mocks.getRequest,
  listInformationAssets: vi.fn(),
  listInformationSystems: vi.fn(),
}));
vi.mock('@/features/assessments/assessment-service', () => ({
  getAnalystAssessment: mocks.getAnalystAssessment,
  listControlImplementations: vi.fn(),
  listControls: vi.fn(),
  listRiskTypes: vi.fn(),
}));

type RouteProps = { params: Promise<{ documentId: string }> };
type RecordRoute = { generateMetadata?: (props: RouteProps) => Promise<{ title?: unknown }>; metadata?: unknown };

const recordRoutes = [
  { route: '/app/questionnaires/{documentId}', page: '(app)/app/questionnaires/[documentId]/page', title: 'Questionnaire | IdamBox CSRM', read: mocks.getQuestionnaire },
  { route: '/app/review/questionnaires/{documentId}', page: '(app)/app/review/questionnaires/[documentId]/page', title: 'Questionnaire Review | IdamBox CSRM', read: mocks.getQuestionnaire },
  { route: '/app/review/requests/{documentId}', page: '(app)/app/review/requests/[documentId]/page', title: 'Assessment Request Review | IdamBox CSRM', read: mocks.getRequest },
  { route: '/app/review/assessments/{documentId}', page: '(app)/app/review/assessments/[documentId]/page', title: 'Risk Assessment Review | IdamBox CSRM', read: mocks.getAnalystAssessment },
] as const;

async function loadRoute(page: string): Promise<RecordRoute> {
  const path = `../../../app/${page}`;
  return import(/* @vite-ignore */ path) as Promise<RecordRoute>;
}

const props = (): RouteProps => ({ params: Promise.resolve({ documentId: 'record-under-test' }) });

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  mocks.current.mockResolvedValue({ displayName: 'Bob Doe' });
  mocks.granted.mockResolvedValue(new Set(['assessment-request:read', 'assessment-request:create', 'assessment:review', 'risk:manage']));
});

describe.each(recordRoutes)('the $route title', ({ page, read, title }) => {
  it('names the page, never the record, while the record can be read, is refused or fails', async () => {
    const route = await loadRoute(page);
    expect(route.generateMetadata, 'the route resolves its title through the record read').toBeTypeOf('function');
    expect(route, 'a route exports its metadata one way only').not.toHaveProperty('metadata');

    read.mockResolvedValue({ data: { documentId: 'record-under-test', title: 'A record title that must not appear' }, error: null });
    await expect(route.generateMetadata!(props())).resolves.toEqual({ title });
    for (const status of [403, 500]) {
      read.mockResolvedValue({ data: null, error: { status, message: 'Refused' } });
      await expect(route.generateMetadata!(props())).resolves.toEqual({ title });
    }
    expect(read).toHaveBeenLastCalledWith('record-under-test');
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it('takes the not-found title when the read answers 404 for an id that does not exist', async () => {
    const route = await loadRoute(page);
    read.mockResolvedValue({ data: null, error: { status: 404, message: 'Not Found' } });

    await expect(route.generateMetadata!(props())).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });
});
