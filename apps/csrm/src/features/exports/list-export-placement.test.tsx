import '@testing-library/jest-dom/vitest';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { render, screen, within } from '@testing-library/react';
import { cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  current: vi.fn(),
  exportButton: vi.fn(),
  granted: vi.fn(),
  listAnalystAssessments: vi.fn(),
  listAssessmentRequests: vi.fn(),
  listMyQuestionnaires: vi.fn(),
  listMyReleasedAssessments: vi.fn(),
  listMyRequests: vi.fn(),
  listQuestionnairesForReview: vi.fn(),
  resolveE2eUiState: vi.fn(),
}));

const actions = vi.hoisted(() => ({
  exportMyQuestionnairesAction: vi.fn(),
  exportMyRequestsAction: vi.fn(),
  exportMyRiskAssessmentsAction: vi.fn(),
  exportQuestionnairesAction: vi.fn(),
  exportReviewRequestsAction: vi.fn(),
  exportRiskAssessmentsAction: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({ current: mocks.current, capabilitiesFor: () => ({ granted: mocks.granted }) }),
}));
vi.mock('@/features/assessments/assessment-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/assessments/assessment-service')>(),
  listAnalystAssessments: mocks.listAnalystAssessments,
  listAssessmentRequests: mocks.listAssessmentRequests,
  listMyReleasedAssessments: mocks.listMyReleasedAssessments,
}));
vi.mock('@/features/questionnaires/questionnaire-service', async (importOriginal) => ({
  ...await importOriginal<typeof import('@/features/questionnaires/questionnaire-service')>(),
  listMyQuestionnaires: mocks.listMyQuestionnaires,
  listQuestionnairesForReview: mocks.listQuestionnairesForReview,
}));
vi.mock('@/features/requests/request-service', () => ({ listMyRequests: mocks.listMyRequests }));
vi.mock('@/features/exports/export-actions', () => actions);
vi.mock('@/components/csrm/export/export-button', () => ({
  ExportButton: (props: { heading: string }) => {
    mocks.exportButton(props);
    return <button type="button">Export <span className="sr-only">{props.heading}</span></button>;
  },
}));
vi.mock('@/lib/testing/e2e-ui-state', () => ({
  E2eUiStateBoundary: ({ children, state }: { children: ReactNode; state: string }) => <section data-ui-state={state}>{children}</section>,
  resolveE2eUiState: mocks.resolveE2eUiState,
}));

import { AssessmentListContent } from '../../../app/(app)/app/review/assessments/page';
import { AssessmentRequestListContent } from '../../../app/(app)/app/review/requests/page';
import { AssignedRequestListContent } from '../../../app/(app)/app/review/assigned/page';
import QuestionnaireReviewsPage from '../../../app/(app)/app/review/questionnaires/page';
import RequestsPage from '../../../app/(app)/app/requests/(my-requests)/page';
import QuestionnairesPage from '../../../app/(app)/app/questionnaires/page';
import AssessmentsPage from '../../../app/(app)/app/assessments/page';
import { AlertList } from '@/features/alerts/alert-list';
import { alertFilterChips } from '@/features/alerts/alert-list-chips';
import { AssessmentList, AssessmentRequestList } from '@/features/assessments/assessment-list';
import { assessmentCollectionFilterChips, reviewQueueFilterChips } from '@/features/assessments/assessment-list-chips';
import { ReleasedAssessmentList } from '@/features/assessments/released-assessment';
import { QuestionnaireList } from '@/features/questionnaires/questionnaire-list';
import { questionnaireFilterChips } from '@/features/questionnaires/questionnaire-list-chips';
import { QuestionnaireReviewList } from '@/features/questionnaires/questionnaire-review-list';
import { myRequestFilterChips } from '@/features/requests/my-request-chips';
import { RequestTable } from '@/features/requests/request-table';

/*
 * Phase 19 export placement (the pilot's ruling of 2026-10-16; 19-UI-SPEC §1, X-30; D-04, D-16, D-20): every list's
 * header carries Export last in its action, rendered after the list's read, only when the session holds that list's
 * own export capability and the read returned data. No second read counts the rows; the read's total goes to the
 * dialog. A gate, a refusal or a failure renders no Export. The capability decides presentation only.
 */

const viewer = { documentId: 'user-bob', displayName: 'Bob Doe' };
const pagination = { page: 1, pageSize: 25, pageCount: 2, total: 30 };
const analyst = ['assessment-request:create', 'assessment-request:read', 'assessment:review'];
const requestor = ['assessment-request:create', 'assessment-request:read'];

type Params = Record<string, string | string[] | undefined>;

async function resolveServerTree(node: ReactNode): Promise<ReactNode> {
  if (Array.isArray(node)) return Promise.all(node.map((child) => resolveServerTree(child)));
  if (!isValidElement(node)) return node;
  const element = node as ReactElement<{ children?: ReactNode }>;
  if (typeof element.type === 'function' && element.type.constructor.name === 'AsyncFunction') {
    return resolveServerTree(await (element.type as (props: unknown) => Promise<ReactNode>)(element.props));
  }
  if (element.props.children === undefined) return element;
  const children = await resolveServerTree(element.props.children);
  return cloneElement(element, undefined, ...(Array.isArray(children) ? children : [children]));
}

type ListCase = {
  name: string;
  heading: string;
  view: string;
  capability: string;
  readCapabilities: string[];
  action: unknown;
  read: ReturnType<typeof vi.fn>;
  data: unknown;
  render: (searchParams: Promise<Params>) => Promise<ReactNode>;
  searchParams: Params;
  expected: Record<string, unknown>;
  gated: boolean;
};

const cases: ListCase[] = [
  {
    name: 'Requests',
    heading: 'Requests',
    view: 'requests',
    capability: 'assessment-requests:export',
    readCapabilities: analyst,
    action: actions.exportReviewRequestsAction,
    read: mocks.listAssessmentRequests,
    data: { records: [], pagination, viewer },
    render: (searchParams) => AssessmentRequestListContent({ searchParams }),
    searchParams: { q: 'portal', queue: 'open', assignee: 'unassigned', page: '2' },
    expected: {
      query: { q: 'portal', queue: 'open', assignee: 'unassigned', sort: 'submittedDate:desc' },
      search: 'portal',
      searchActive: true,
      chips: [{ label: 'Assigned to', value: 'Not picked up' }],
    },
    gated: true,
  },
  {
    name: 'Assigned to me',
    heading: 'Assigned to me',
    view: 'requests',
    capability: 'assessment-requests:export',
    readCapabilities: analyst,
    action: actions.exportReviewRequestsAction,
    read: mocks.listAssessmentRequests,
    data: { records: [], pagination, viewer },
    render: (searchParams) => AssignedRequestListContent({ searchParams }),
    searchParams: {},
    expected: {
      // The page's own scope travels with the export, but never as a chip, and Assigned to is not a visible column.
      query: { q: '', queue: 'open', assignee: 'me', sort: 'submittedDate:desc' },
      searchActive: false,
      chips: [],
      visibleColumns: ['requestNumber', 'title', 'requestor', 'assessmentType', 'businessCriticality', 'status', 'dueDate', 'ageDays', 'submittedAt'],
    },
    gated: true,
  },
  {
    name: 'Risk assessments',
    heading: 'Risk assessments',
    view: 'risk-assessments',
    capability: 'risk-assessments:export',
    readCapabilities: analyst,
    action: actions.exportRiskAssessmentsAction,
    read: mocks.listAnalystAssessments,
    data: { records: [], pagination },
    render: (searchParams) => AssessmentListContent({ searchParams }),
    searchParams: { overallRating: 'High', status: 'approved' },
    expected: {
      query: { q: '', status: 'approved', overallRating: 'High', sort: 'generatedDate:desc' },
      searchActive: false,
      chips: [{ label: 'Status', value: 'Released' }, { label: 'Overall rating', value: 'High' }],
    },
    gated: true,
  },
  {
    name: 'Questionnaires',
    heading: 'Questionnaires',
    view: 'questionnaires',
    capability: 'questionnaires:export',
    readCapabilities: analyst,
    action: actions.exportQuestionnairesAction,
    read: mocks.listQuestionnairesForReview,
    data: { questionnaires: [], pagination },
    render: (searchParams) => QuestionnaireReviewsPage({ searchParams }),
    searchParams: { status: 'submitted' },
    expected: {
      query: { q: '', status: 'submitted', sort: 'updatedAt:desc' },
      searchActive: false,
      chips: [{ label: 'Status', value: 'Submitted' }],
    },
    gated: true,
  },
  {
    name: 'My requests',
    heading: 'My requests',
    view: 'my-requests',
    capability: 'my-requests:export',
    readCapabilities: requestor,
    action: actions.exportMyRequestsAction,
    read: mocks.listMyRequests,
    data: { items: [], pagination: { page: 1, pageSize: 10, pageCount: 3, total: 30 } },
    render: (searchParams) => RequestsPage({ searchParams }),
    searchParams: { holder: 'analyst', q: 'portal' },
    expected: {
      query: { q: 'portal', holder: 'analyst', sort: 'updatedAt:desc' },
      search: 'portal',
      searchActive: true,
      chips: [{ label: 'Show', value: expect.any(String) }],
    },
    gated: false,
  },
  {
    name: 'My questionnaires',
    heading: 'My questionnaires',
    view: 'my-questionnaires',
    capability: 'my-questionnaires:export',
    readCapabilities: requestor,
    action: actions.exportMyQuestionnairesAction,
    read: mocks.listMyQuestionnaires,
    data: { questionnaires: [], pagination },
    render: (searchParams) => QuestionnairesPage({ searchParams }),
    searchParams: {},
    expected: { query: { sort: 'updatedAt:desc' }, searchActive: false, chips: [] },
    gated: false,
  },
  {
    name: 'My risk assessments',
    heading: 'My risk assessments',
    view: 'my-risk-assessments',
    capability: 'my-risk-assessments:export',
    readCapabilities: requestor,
    action: actions.exportMyRiskAssessmentsAction,
    read: mocks.listMyReleasedAssessments,
    data: { records: [], pagination },
    render: (searchParams) => AssessmentsPage({ searchParams }),
    searchParams: { q: 'portal' },
    expected: { query: { q: 'portal', sort: 'generatedDate:desc' }, search: 'portal', searchActive: true, chips: [] },
    gated: false,
  },
];

function holding(...capabilities: string[]) {
  mocks.granted.mockResolvedValue(new Set(capabilities));
}

async function renderCase(testCase: ListCase, searchParams: Params = testCase.searchParams) {
  return render(await resolveServerTree(await testCase.render(Promise.resolve(searchParams))));
}

function headerOf(heading: string): HTMLElement {
  return screen.getByRole('heading', { level: 1, name: heading }).closest('.page-header') as HTMLElement;
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.current.mockResolvedValue({ displayName: 'Bob Doe' });
  mocks.resolveE2eUiState.mockReturnValue(undefined);
});

describe('the header Export on every list (19-11)', () => {
  it.each(cases)('$name: Export is the header’s last action, with the read’s total and filters, from one read', async (testCase) => {
    holding(...testCase.readCapabilities, testCase.capability);
    testCase.read.mockResolvedValue({ data: testCase.data, error: null });

    await renderCase(testCase);

    const buttons = within(headerOf(testCase.heading)).getAllByRole('button');
    expect(buttons.at(-1)).toHaveAccessibleName(`Export ${testCase.heading}`);
    expect(testCase.read).toHaveBeenCalledTimes(1);
    const props = mocks.exportButton.mock.calls[0]?.[0];
    expect(props).toEqual(expect.objectContaining({
      heading: testCase.heading,
      view: testCase.view,
      action: testCase.action,
      total: 30,
      multiplePages: true,
      ...testCase.expected,
    }));
    expect(props.query).not.toHaveProperty('page');
    expect(props.query).not.toHaveProperty('pageSize');
    expect(props).not.toHaveProperty('fixedTables');
  });

  it.each(cases)('$name: the list shows without Export to a session holding its read but not its export', async (testCase) => {
    holding(...testCase.readCapabilities);
    testCase.read.mockResolvedValue({ data: testCase.data, error: null });

    await renderCase(testCase);

    expect(screen.getByRole('heading', { level: 1, name: testCase.heading })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Export ${testCase.heading}` })).not.toBeInTheDocument();
    expect(mocks.exportButton).not.toHaveBeenCalled();
  });

  it.each(cases.flatMap((testCase) => [[testCase.name, 403, testCase], [testCase.name, 500, testCase]] as const))('%s: a read that fails with %i renders the header without Export', async (_name, status, testCase) => {
    holding(...testCase.readCapabilities, testCase.capability);
    testCase.read.mockResolvedValue({ data: null, error: { message: 'x', status } });

    await renderCase(testCase);

    expect(screen.getByRole('heading', { level: 1, name: testCase.heading })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: `Export ${testCase.heading}` })).not.toBeInTheDocument();
  });

  it.each(cases)('$name: an E2E presentation fixture that replaces the list renders no Export', async (testCase) => {
    holding(...testCase.readCapabilities, testCase.capability);
    testCase.read.mockResolvedValue({ data: testCase.data, error: null });
    mocks.resolveE2eUiState.mockReturnValue('empty');

    await renderCase(testCase, { ...testCase.searchParams, __e2eState: 'empty' });

    expect(screen.queryByRole('button', { name: `Export ${testCase.heading}` })).not.toBeInTheDocument();
  });

  it.each(cases.filter((testCase) => testCase.gated))('$name: a Requestor gets the gate under the header with no Export and no read', async (testCase) => {
    mocks.current.mockResolvedValue({ displayName: 'Jane Doe' });
    holding(...requestor, 'my-requests:export', 'my-questionnaires:export', 'my-risk-assessments:export', 'released-assessment:export');

    await renderCase(testCase);

    expect(screen.getByRole('heading', { level: 1, name: testCase.heading })).toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('You don’t have access');
    expect(screen.queryByRole('button', { name: /^Export/ })).not.toBeInTheDocument();
    expect(testCase.read).not.toHaveBeenCalled();
  });

  it('keeps New request first and Export last in My requests’ header', async () => {
    const myRequests = cases.find((testCase) => testCase.name === 'My requests')!;
    holding(...requestor, 'my-requests:export');
    mocks.listMyRequests.mockResolvedValue({ data: myRequests.data, error: null });

    await renderCase(myRequests);

    const actionsInHeader = [...headerOf('My requests').querySelectorAll('a, button')];
    expect(actionsInHeader.map((element) => element.textContent?.replace(/\s+/g, ' ').trim())).toEqual(['New request', 'Export My requests']);
  });

  it.each([
    ['review/requests', 'AssessmentRequestListContent', 'AssessmentRequestListHeader', "can('assessment-requests:export'"],
    ['review/assigned', 'AssignedRequestListContent', 'AssignedRequestListHeader', "can('assessment-requests:export'"],
    ['review/assessments', 'AssessmentListContent', 'AssessmentListHeader', "can('risk-assessments:export'"],
  ])('%s keeps Export off the static header its Suspense fallback shows', (route, content, header, capability) => {
    const source = readFileSync(resolve(process.cwd(), `app/(app)/app/${route}/page.tsx`), 'utf8');
    const page = source.slice(source.indexOf('export default function'));
    const fallback = new RegExp(`fallback=\\{([\\s\\S]*?)\\}>\\s*<${content}`).exec(page)?.[1] ?? '';
    expect(fallback).toContain(`<${header} />`);
    expect(fallback).not.toContain('action=');
    expect(source.slice(source.indexOf(`export async function ${content}`), source.indexOf('export default function'))).toContain(capability);
  });

  /*
   * The server pages word the dialog's filters with server-only chip builders, so the client lists keep their own chips
   * and no shared module reaches the chunks every route loads (19-11's route budgets). Each list is rendered here with
   * every filter set, and its chips must read exactly as the builder's.
   */
  it.each([
    {
      name: 'Requests',
      list: () => <AssessmentRequestList query={{ q: 'portal', queue: 'open', status: 'submitted', assignee: 'unassigned', notes: 'unread', sort: 'submittedDate:desc', page: 1, pageSize: 25 }} requests={[]} viewer={viewer} />,
      chips: () => reviewQueueFilterChips({ q: 'portal', status: 'submitted', assignee: 'unassigned', notes: 'unread' }),
    },
    {
      name: 'Assigned to me',
      list: () => <AssessmentRequestList query={{ q: '', queue: 'open', status: 'approved', assignee: 'me', notes: 'unread', sort: 'submittedDate:desc', page: 1, pageSize: 25 }} requests={[]} view="assigned" viewer={viewer} />,
      chips: () => reviewQueueFilterChips({ q: '', status: 'approved', assignee: undefined, notes: 'unread' }),
    },
    {
      name: 'Risk assessments',
      list: () => <AssessmentList assessments={[]} query={{ q: 'portal', status: 'approved', overallRating: 'High', approvedFrom: '2026-01-01', approvedTo: '2026-06-30', sort: 'generatedDate:desc', page: 1, pageSize: 25 }} />,
      chips: () => assessmentCollectionFilterChips({ q: 'portal', status: 'approved', overallRating: 'High', approvedFrom: '2026-01-01', approvedTo: '2026-06-30' }),
    },
    {
      name: 'My risk assessments',
      list: () => <ReleasedAssessmentList assessments={[]} query={{ q: 'portal', status: 'approved', overallRating: 'Low', approvedFrom: '2026-01-01', approvedTo: '2026-06-30', sort: 'generatedDate:desc', page: 1, pageSize: 25 }} />,
      chips: () => assessmentCollectionFilterChips({ q: 'portal', status: 'approved', overallRating: 'Low', approvedFrom: '2026-01-01', approvedTo: '2026-06-30' }),
    },
    {
      name: 'Questionnaires',
      list: () => <QuestionnaireReviewList pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} query={{ q: 'portal', status: 'submitted', sort: 'updatedAt:desc', page: 1, pageSize: 25 }} questionnaires={[]} />,
      chips: () => questionnaireFilterChips({ q: 'portal', status: 'submitted' }),
    },
    {
      name: 'My questionnaires',
      list: () => <QuestionnaireList pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} query={{ q: 'portal', status: 'draft', sort: 'updatedAt:desc', page: 1, pageSize: 25 }} questionnaires={[]} />,
      chips: () => questionnaireFilterChips({ q: 'portal', status: 'draft' }),
    },
    {
      name: 'My requests',
      list: () => <RequestTable densityUserId="requestor" pagination={{ page: 1, pageSize: 10, pageCount: 0, total: 0 }} query={{ q: 'portal', status: 'submitted', holder: 'analyst', notes: 'unread', sort: 'updatedAt:desc', page: 1, pageSize: 10 }} requests={[]} />,
      chips: () => myRequestFilterChips({ q: 'portal', status: 'submitted', holder: 'analyst', notes: 'unread' }),
    },
    {
      name: 'Alerts',
      list: () => <AlertList alerts={[]} dueSoonWindowDays={14} pagination={{ page: 1, pageSize: 25, pageCount: 0, total: 0 }} query={{ kind: 'risk-treatment-overdue', urgency: 'overdue', page: 1, pageSize: 25 }} />,
      chips: () => alertFilterChips({ kind: 'risk-treatment-overdue', urgency: 'overdue' }),
    },
  ])('$name: the Export’s filters read exactly as the list’s chips', ({ chips, list }) => {
    render(list());

    const rendered = screen.getAllByRole('button', { name: /^Remove .+ filter$/ }).map((button) => button.parentElement?.textContent?.trim());
    const expected = chips();
    expect(expected.length).toBeGreaterThan(0);
    expect(rendered).toEqual(expected.map((chip) => `${chip.label}: ${chip.value}`));
  });

  it('gates no Export on a list read capability', () => {
    for (const route of ['review/requests', 'review/assigned', 'review/assessments', 'review/questionnaires', 'requests/(my-requests)', 'questionnaires', 'assessments', 'alerts', 'reports/[reportKey]']) {
      const source = readFileSync(resolve(process.cwd(), `app/(app)/app/${route}/page.tsx`), 'utf8');
      const exportLines = source.split('\n').filter((line) => /ExportButton|Export\b.*=.*can\(|can\('[a-z-]+:export'/.test(line));
      expect(exportLines.length, route).toBeGreaterThan(0);
      for (const line of exportLines) {
        expect(line, route).not.toMatch(/canViewerReviewAssessments|'assessment:review'|'assessment-request:read'|canReadReports/);
      }
    }
  });
});
