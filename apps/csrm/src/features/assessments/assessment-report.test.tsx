import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ReactElement } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AnalystAssessmentDetail,
  AnalystRiskDetail,
  AssessmentRiskListItem,
  ControlImplementation,
  ReleasedAssessmentDetailForActor,
} from './assessment-schema';

/*
 * Phase 19 (D-14, D-21, D-23, D-24; 19-UI-SPEC §1, §4): the released assessment as a file and as paper. The released
 * page and both report routes read through one shared loader; the report holds only what the released reads disclose.
 */

const mocks = vi.hoisted(() => ({
  canViewerReviewAssessments: vi.fn(),
  exportReleasedAssessmentAction: vi.fn(),
  getAnalystAssessment: vi.fn(),
  getReleasedAssessment: vi.fn(),
  listAssessmentRisks: vi.fn(),
  listControlImplementations: vi.fn(),
  listReleasedAssessmentRisks: vi.fn(),
  listReleasedControlImplementations: vi.fn(),
  notFound: vi.fn(),
  readViewerTimeZone: vi.fn(),
  viewerCapabilities: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/assessments/assessment-1',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock('@/features/assessments/assessment-service', () => ({
  getAnalystAssessment: mocks.getAnalystAssessment,
  getReleasedAssessment: mocks.getReleasedAssessment,
  listAssessmentRisks: mocks.listAssessmentRisks,
  listControlImplementations: mocks.listControlImplementations,
  listReleasedAssessmentRisks: mocks.listReleasedAssessmentRisks,
  listReleasedControlImplementations: mocks.listReleasedControlImplementations,
}));
vi.mock('@/lib/capabilities/viewer-capabilities', () => ({ viewerCapabilities: mocks.viewerCapabilities }));
vi.mock('@/lib/capabilities/analyst-review-gate', () => ({ canViewerReviewAssessments: mocks.canViewerReviewAssessments }));
vi.mock('@/lib/time/viewer-time-zone', () => ({ readViewerTimeZone: mocks.readViewerTimeZone }));
vi.mock('@/features/exports/export-actions', () => ({ exportReleasedAssessmentAction: mocks.exportReleasedAssessmentAction }));

type RouteProps = { params: Promise<{ documentId: string }> };
type PageModule = { default: (props: RouteProps) => Promise<ReactElement<Record<string, unknown>>> };
type ReportModelModule = typeof import('./released-assessment-report');

const webRoot = process.cwd();
const releasedPagePath = '../../../app/(app)/app/assessments/[documentId]/page';
const requestorReportPath = '../../../app/(app)/app/assessments/[documentId]/report/page';

async function load<T>(path: string): Promise<T> {
  return import(/* @vite-ignore */ path) as Promise<T>;
}

const loadModel = () => load<ReportModelModule>('./released-assessment-report');
const props = (): RouteProps => ({ params: Promise.resolve({ documentId: 'assessment-1' }) });
const ok = <T,>(data: T) => ({ data, error: null });
const failed = (status: number) => ({ data: null, error: { status, message: 'raw internal detail' } });
const mismatch = { data: null, error: { message: 'The response did not match the expected CSRM contract.', kind: 'response-contract-mismatch', operation: 'GET /v1/risk_assessments/{assessmentId}' } };

const analystPerson = { documentId: 'analyst-1', displayName: 'Bob Doe' };

const releasedDetail: Extract<ReleasedAssessmentDetailForActor, { actor: 'requestor' }> = {
  actor: 'requestor',
  aiAssisted: true,
  assessmentNumber: 'ASM-0042',
  assessmentStatus: 'approved',
  assessmentDate: '2026-08-30T01:00:00.000Z',
  nextReviewDate: '2027-02-28',
  approvalDate: '2026-08-30T01:00:00.000Z',
  summary: 'Released customer portal assessment.',
  overallRating: 'High',
  overallControlEffectiveness: 'Partially Effective',
  recommendationsSummary: 'Prioritise the planned access control.',
  overallRiskRationale: 'Internet exposure and privileged access drive the rating.',
  assessmentRequest: { documentId: 'request-42', requestNumber: 'RAR-2026-0042', title: 'Customer portal security assessment', requestStatus: 'approved' },
  reviewedBy: analystPerson,
  approvedBy: analystPerson,
};

const riskOne: AssessmentRiskListItem = {
  documentId: 'risk-1',
  riskNumber: 'RSK-0001',
  riskStatement: 'An attacker could misuse privileged access.',
  informationSystemImpacted: { documentId: 'system-1', name: 'Customer portal' },
  informationAssetImpacted: { documentId: 'asset-1', name: 'Customer records' },
  inherentLikelihood: 'Likely',
  highestInherentConsequence: 'Major',
  inherentRating: 'Critical',
  residualLikelihood: 'Possible',
  highestResidualConsequence: 'Moderate',
  residualRating: 'Moderate',
  treatmentAction: 'Treat',
  treatmentPlan: 'Enforce phishing-resistant MFA for administrators.',
  treatmentStatus: 'In Progress',
  riskOwner: { documentId: 'owner-2', displayName: 'Priya Nair' },
  treatmentOwner: { documentId: 'owner-3', displayName: 'Sam Lee' },
  targetDate: '2027-03-31',
};

const riskTwo: AssessmentRiskListItem = {
  ...riskOne,
  documentId: 'risk-2',
  riskNumber: 'RSK-0002',
  riskStatement: 'Customer records could be exposed through a misconfigured export.',
  inherentRating: 'High',
  residualRating: 'Low',
  treatmentAction: 'Accept',
};

const implementation: ControlImplementation = {
  documentId: 'implementation-1',
  control: 'control-1',
  controlSummary: { documentId: 'control-1', controlNumber: 'ACCESS-1a', name: 'ACCESS-1a — Establish Identities and Manage Authentication', framework: 'Essential Eight' },
  controlOwner: { documentId: 'owner-1', displayName: 'Jane Doe' },
  controlStatus: 'Planned',
  effectivenessRating: 'Partially Effective',
  evidence: 'Implementation plan approved.',
  implementationDueDate: '2026-11-30',
  implementedDate: null,
  reviewDate: '2027-01-31',
};

/** The released reads for Jane's assessment: the risks arrive out of number order. */
function readsReturnReleasedAssessment() {
  mocks.getReleasedAssessment.mockResolvedValue(ok(releasedDetail));
  mocks.listReleasedAssessmentRisks.mockResolvedValue(ok([riskTwo, riskOne]));
  mocks.listReleasedControlImplementations.mockImplementation(async (riskId: string) => ok(riskId === 'risk-1' ? [implementation] : []));
}

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
  mocks.viewerCapabilities.mockResolvedValue(new Set(['released-assessment:export']));
  mocks.readViewerTimeZone.mockResolvedValue('Australia/Sydney');
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('the report model', () => {
  it('keeps every disclosed field, orders the risks by number and carries the AI flag', async () => {
    const { toAssessmentReportModel } = await loadModel();
    const generator = { documentId: 'analyst-9', displayName: 'Gen Analyst' };
    // A field the released read never discloses, as if a read had served one: the model must not copy it.
    const assessment = { ...releasedDetail, generatedBy: generator } as typeof releasedDetail;

    const model = toAssessmentReportModel({
      actor: 'requestor',
      assessment,
      risks: [riskTwo, riskOne],
      controlsByRisk: { 'risk-1': [implementation], 'risk-2': [] },
    });

    expect(model).toEqual({
      assessmentNumber: 'ASM-0042',
      requestNumber: 'RAR-2026-0042',
      requestTitle: 'Customer portal security assessment',
      releasedAt: '2026-08-30T01:00:00.000Z',
      releasedBy: 'Bob Doe',
      overallRating: 'High',
      overallRiskRationale: 'Internet exposure and privileged access drive the rating.',
      summary: 'Released customer portal assessment.',
      recommendations: 'Prioritise the planned access control.',
      overallControlEffectiveness: 'Partially Effective',
      nextReviewDate: '2027-02-28',
      aiAssisted: true,
      risks: [{ risk: riskOne, controls: [implementation] }, { risk: riskTwo, controls: [] }],
      controlCount: 1,
    });
    expect(JSON.stringify(model)).not.toMatch(/Gen Analyst|analyst-9|generatedBy|reviewedBy/);
  });
});

describe('the released page reads through the shared loader', () => {
  it('renders the populated view from the loader’s reads', async () => {
    readsReturnReleasedAssessment();
    const page = await (await load<PageModule>(releasedPagePath)).default(props());

    expect(page.props.state).toBe('populated');
    expect(page.props.risks).toEqual([riskTwo, riskOne]);
    expect(page.props.controlsByRisk).toEqual({ 'risk-1': [implementation], 'risk-2': [] });
  });

  it.each([
    ['the detail', () => mocks.getReleasedAssessment.mockResolvedValue(failed(404))],
    ['the risks', () => mocks.listReleasedAssessmentRisks.mockResolvedValue(failed(404))],
    ['a control-implementation read', () => mocks.listReleasedControlImplementations.mockResolvedValue(failed(404))],
  ])('renders the in-shell not-found when %s answers 404', async (_read, refuse) => {
    readsReturnReleasedAssessment();
    refuse();
    const route = await load<PageModule>(releasedPagePath);

    await expect(route.default(props())).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it.each([
    [403, 'permission'],
    [500, 'error'],
  ])('renders a %s from a read as the %s state', async (status, state) => {
    readsReturnReleasedAssessment();
    mocks.listReleasedControlImplementations.mockResolvedValue(failed(status));
    const page = await (await load<PageModule>(releasedPagePath)).default(props());
    expect(page.props.state).toBe(state);

    mocks.getReleasedAssessment.mockResolvedValue(failed(status));
    const fromDetail = await (await load<PageModule>(releasedPagePath)).default(props());
    expect(fromDetail.props.state).toBe(state);
  });

  it('renders a contract mismatch as its state and logs the same line', async () => {
    readsReturnReleasedAssessment();
    mocks.getReleasedAssessment.mockResolvedValue(mismatch);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const page = await (await load<PageModule>(releasedPagePath)).default(props());

    expect(page.props.state).toBe('contract-mismatch');
    expect(log).toHaveBeenCalledWith('[csrm-contract] response contract mismatch: GET /v1/risk_assessments/{assessmentId}');
  });

  it('renders risks without data as unavailable', async () => {
    readsReturnReleasedAssessment();
    mocks.listReleasedAssessmentRisks.mockResolvedValue({ data: null, error: null });

    const page = await (await load<PageModule>(releasedPagePath)).default(props());

    expect(page.props.state).toBe('unavailable');
  });

  it('shares one cached detail read between generateMetadata and the page', () => {
    const page = readFileSync(resolve(webRoot, 'app/(app)/app/assessments/[documentId]/page.tsx'), 'utf8');
    const loader = readFileSync(resolve(webRoot, 'src/features/assessments/released-assessment-report.ts'), 'utf8');

    expect(page).not.toContain('cache(');
    expect(page).toContain('readReleasedAssessment(');
    expect(page).toContain('loadRequestorReleasedAssessment(');
    expect(loader.match(/cache\(getReleasedAssessment\)/g)).toHaveLength(1);
    expect(loader).toMatch(/await readReleasedAssessment\(/);
  });
});

describe('the released view’s header actions', () => {
  async function renderReleasedPage() {
    readsReturnReleasedAssessment();
    const page = await (await load<PageModule>(releasedPagePath)).default(props());
    return render(page);
  }

  it('offers Print report, then Export {number}, when the session holds the export', async () => {
    await renderReleasedPage();

    const print = screen.getByRole('link', { name: 'Print report' });
    const exportButton = screen.getByRole('button', { name: 'Export ASM-0042' });
    expect(print).toHaveAttribute('href', '/app/assessments/assessment-1/report');
    expect(print.compareDocumentPosition(exportButton) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mocks.viewerCapabilities).toHaveBeenCalled();
  });

  it('offers Print report alone without the export', async () => {
    mocks.viewerCapabilities.mockResolvedValue(new Set());
    await renderReleasedPage();

    expect(screen.getByRole('link', { name: 'Print report' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export/ })).not.toBeInTheDocument();
  });

  it('renders neither action in a refused or failed state', async () => {
    readsReturnReleasedAssessment();
    mocks.getReleasedAssessment.mockResolvedValue(failed(403));
    render(await (await load<PageModule>(releasedPagePath)).default(props()));

    expect(screen.queryByRole('link', { name: 'Print report' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Export/ })).not.toBeInTheDocument();
  });
});

describe('the Requestor’s report route', () => {
  it.each([
    ['missing', 404],
    ['refused', 403],
  ])('renders the in-shell not-found for a %s assessment', async (_case, status) => {
    readsReturnReleasedAssessment();
    mocks.getReleasedAssessment.mockResolvedValue(failed(status));
    const route = await load<PageModule>(requestorReportPath);

    await expect(route.default(props())).rejects.toThrow('NEXT_NOT_FOUND');
  });

  it.each([
    ['a failed read', () => mocks.getReleasedAssessment.mockResolvedValue(failed(500))],
    ['a contract mismatch', () => mocks.getReleasedAssessment.mockResolvedValue(mismatch)],
    ['risks without data', () => mocks.listReleasedAssessmentRisks.mockResolvedValue({ data: null, error: null })],
  ])('lets %s reach the route’s error boundary', async (_case, fail) => {
    readsReturnReleasedAssessment();
    fail();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const route = await load<PageModule>(requestorReportPath);

    const result = route.default(props());
    await expect(result).rejects.toThrow();
    await expect(result).rejects.not.toThrow('NEXT_NOT_FOUND');
  });

  it('renders the screen toolbar, then the document, and prints from the toolbar', async () => {
    readsReturnReleasedAssessment();
    const print = vi.fn();
    vi.stubGlobal('print', print);
    const route = await load<PageModule>(requestorReportPath);

    render(await route.default(props()));

    const toolbarTitle = screen.getByRole('heading', { level: 1, name: 'Print report' });
    const documentTitle = screen.getByRole('heading', { level: 1, name: 'Cyber security risk assessment' });
    expect(toolbarTitle.closest('[data-print="hidden"]')).not.toBeNull();
    expect(documentTitle.closest('[data-print="hidden"]')).toBeNull();
    expect(toolbarTitle.compareDocumentPosition(documentTitle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Back to the risk assessment' })).toHaveAttribute('href', '/app/assessments/assessment-1');

    fireEvent.click(screen.getByRole('button', { name: 'Print or save as PDF' }));
    expect(print).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  /* 19-UI-REVIEW UI-05 (pilot ruling, 2026-10-17): one h1 on screen, the toolbar's; on paper the document title is the h1. */
  it('gives the screen one h1, with the document title an h2 there and the h1 only in print (UI-05)', async () => {
    readsReturnReleasedAssessment();
    const route = await load<PageModule>(requestorReportPath);

    render(await route.default(props()));

    // jsdom applies no stylesheet, so the print-only heading is told apart by its classes.
    const onScreen = (heading: HTMLElement) => !heading.classList.contains('hidden');
    expect(screen.getAllByRole('heading', { level: 1 }).filter(onScreen).map((heading) => heading.textContent)).toEqual(['Print report']);
    const screenTitle = screen.getByRole('heading', { level: 2, name: 'Cyber security risk assessment' });
    expect(screenTitle).toHaveClass('print:hidden');
    const paperTitle = screen.getByRole('heading', { level: 1, name: 'Cyber security risk assessment' });
    expect(paperTitle).toHaveClass('hidden', 'print:block');
    expect(screenTitle.closest('article')).toHaveAccessibleName('Cyber security risk assessment');
  });

  it('names the report in the document title', async () => {
    readsReturnReleasedAssessment();
    const route = await load<{ generateMetadata: (props: RouteProps) => Promise<{ title?: unknown }> }>(requestorReportPath);

    await expect(route.generateMetadata(props())).resolves.toEqual({ title: 'Print report ASM-0042 | IdamBox CSRM' });
    mocks.getReleasedAssessment.mockResolvedValue(failed(404));
    await expect(route.generateMetadata(props())).rejects.toThrow('NEXT_NOT_FOUND');
  });
});

describe('the report modules', () => {
  it('keeps the toolbar the only client module the report adds', () => {
    const toolbar = readFileSync(resolve(webRoot, 'src/features/assessments/report-toolbar.tsx'), 'utf8');
    const report = readFileSync(resolve(webRoot, 'src/features/assessments/assessment-report.tsx'), 'utf8');

    expect(toolbar.startsWith('\'use client\'')).toBe(true);
    expect(toolbar).not.toMatch(/from 'zod'/);
    expect(report).not.toMatch(/^['"]use client['"]/);
    // Route budgets (19-12): a Server Component importing a client module makes every export of it a client entry, which
    // regrouped the shared chunks of /app/requests/{documentId} and /app/risks/{documentId}. The document imports none.
    expect(report).not.toMatch(/@\/components\/ui\/table|horizontal-scroll-region/);
  });
});

/*
 * Task 2 (X-31; D-24; 19-UI-SPEC §4.3, §4.4): the whole document, its states and its print rules.
 */
describe('the A4 report document', () => {
  type ReportModule = typeof import('./assessment-report');
  type ModelInput = Parameters<ReportModelModule['toAssessmentReportModel']>[0];
  const loadReport = () => load<ReportModule>('./assessment-report');
  const generatedAt = '2026-10-17T03:04:00.000Z';

  async function releasedModel(overrides: Record<string, unknown> = {}) {
    const { toAssessmentReportModel } = await loadModel();
    return toAssessmentReportModel({
      actor: 'requestor',
      assessment: releasedDetail,
      risks: [riskTwo, riskOne],
      controlsByRisk: { 'risk-1': [implementation], 'risk-2': [] },
      ...overrides,
    } as ModelInput);
  }

  it('renders the X-31 parts in order, with a captioned overview table and each Risk in detail', async () => {
    const { AssessmentReport } = await loadReport();
    const { container } = render(<AssessmentReport generatedAt={generatedAt} model={await releasedModel()} timeZone="Australia/Sydney" />);

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Cyber security risk assessment');
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
      'Cyber security risk assessment',
      'Summary',
      'Overall rating and rationale',
      'Recommendations',
      'Control effectiveness and next review',
      'Risks overview',
      'Risks in detail',
      'Notes',
    ]);
    expect(screen.getByText('IdamBox CSRM')).toBeInTheDocument();
    expect(screen.getByText('ASM-0042 · RAR-2026-0042 · Customer portal security assessment')).toBeInTheDocument();

    const table = screen.getByRole('table', { name: 'Risks overview' });
    expect(within(table).getAllByRole('columnheader').map((header) => header.textContent)).toEqual(['Risk', 'Risk statement', 'Inherent rating', 'Residual rating', 'Treatment']);
    expect(within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[0]?.textContent)).toEqual(['RSK-0001', 'RSK-0002']);

    const risks = [...container.querySelectorAll<HTMLElement>('[data-report-risk]')];
    expect(risks.map((risk) => within(risk).getByRole('heading', { level: 3 }).textContent)).toEqual(['RSK-0001', 'RSK-0002']);
    for (const risk of risks) {
      expect(within(risk).getAllByRole('heading', { level: 4 }).map((heading) => heading.textContent)).toEqual(['Ratings', 'Ownership and treatment', 'Mitigation control implementations']);
    }
    expect(within(risks[0]!).getByText('An attacker could misuse privileged access.')).toBeInTheDocument();
    expect(within(risks[0]!).getByText(/Establish Identities and Manage Authentication/)).toBeInTheDocument();
    expect(container.querySelector('[data-report-section="risks-in-detail"]')).not.toBeNull();
  });

  it('prints a long statement whole: never clamped', async () => {
    const { AssessmentReport } = await loadReport();
    const statement = 'A privileged session could be replayed. '.repeat(50).slice(0, 2_000);
    const model = await releasedModel({ risks: [{ ...riskOne, riskStatement: statement }] });
    const { container } = render(<AssessmentReport generatedAt={generatedAt} model={model} timeZone="Australia/Sydney" />);

    expect(statement).toHaveLength(2_000);
    const table = screen.getByRole('table', { name: 'Risks overview' });
    const cell = within(within(table).getAllByRole('row')[1]!).getAllByRole('cell')[1]!;
    expect(cell.textContent).toBe(statement.trim());
    expect(container.querySelector('[class*="line-clamp"], [class*="truncate"]')).toBeNull();
  });

  it('reads absent values as Not recorded', async () => {
    const { AssessmentReport } = await loadReport();
    const sparse = { ...releasedDetail, summary: null, overallRating: null, overallRiskRationale: null, recommendationsSummary: null, overallControlEffectiveness: null, nextReviewDate: null };
    const model = await releasedModel({ assessment: sparse, risks: [{ ...riskOne, riskStatement: null, inherentRating: null, residualRating: null, treatmentAction: null }] });
    render(<AssessmentReport generatedAt={generatedAt} model={model} timeZone="Australia/Sydney" />);

    for (const name of ['Summary', 'Recommendations', 'Overall rating and rationale', 'Control effectiveness and next review']) {
      expect(screen.getByRole('region', { name })).toHaveTextContent('Not recorded');
    }
    const table = screen.getByRole('table', { name: 'Risks overview' });
    const cells = within(within(table).getAllByRole('row')[1]!).getAllByRole('cell').map((cell) => cell.textContent);
    expect(cells).toEqual(['RSK-0001', 'Not recorded', 'Not recorded', 'Not recorded', 'Not recorded']);
  });

  it('says so defensively when there are no risks', async () => {
    const { AssessmentReport } = await loadReport();
    render(<AssessmentReport generatedAt={generatedAt} model={await releasedModel({ risks: [], controlsByRisk: {} })} timeZone="Australia/Sydney" />);

    expect(screen.getByRole('region', { name: 'Risks overview' })).toHaveTextContent('No risks were recorded in this assessment.');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('carries the AI notice in Notes when AI assisted, and the generation time with its zone', async () => {
    const { AssessmentReport } = await loadReport();
    const { formatInstant } = await import('@/lib/time/format-instant');
    render(<AssessmentReport generatedAt={generatedAt} model={await releasedModel()} timeZone="Australia/Sydney" />);

    const notes = screen.getByRole('region', { name: 'Notes' });
    expect(notes).toHaveTextContent('AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.');
    expect(notes).toHaveTextContent(`This report shows the risk assessment as released. Generated ${formatInstant(generatedAt, { zone: 'Australia/Sydney', style: 'date-time' })} (Australia/Sydney).`);
  });

  it('has no AI notice line without AI assistance, and names UTC when the zone is unknown', async () => {
    const { AssessmentReport } = await loadReport();
    const { formatInstant } = await import('@/lib/time/format-instant');
    render(<AssessmentReport generatedAt={generatedAt} model={await releasedModel({ assessment: { ...releasedDetail, aiAssisted: false } })} timeZone={null} />);

    const notes = screen.getByRole('region', { name: 'Notes' });
    expect(notes).not.toHaveTextContent(/AI helped/);
    expect(notes).toHaveTextContent(`Generated ${formatInstant(generatedAt, { zone: 'UTC', style: 'date-time' })} (UTC).`);
    expect(notes).not.toHaveTextContent(/UTC \(UTC\)/);
  });

  it('mirrors the document in its skeleton: the header block, three text sections and a five-column table', async () => {
    const { AssessmentReportSkeleton } = await loadReport();
    const { container } = render(<AssessmentReportSkeleton />);

    expect(screen.getByRole('status', { name: 'Loading report' })).toBeInTheDocument();
    expect(container.querySelectorAll('[data-report-skeleton="header"]')).toHaveLength(1);
    expect(container.querySelectorAll('[data-report-skeleton="section"]')).toHaveLength(3);
    expect(container.querySelectorAll('[data-report-skeleton="column"]')).toHaveLength(5);
  });

  it('renders the toolbar shape and the skeleton while the route loads, and its error with Try again', async () => {
    const { default: Loading } = await load<{ default: () => ReactElement }>('../../../app/(app)/app/assessments/[documentId]/report/loading');
    const { container, unmount } = render(<Loading />);
    expect(container.querySelector('[data-print="hidden"]')).not.toBeNull();
    expect(screen.getByRole('status', { name: 'Loading report' })).toBeInTheDocument();
    unmount();

    const reset = vi.fn();
    const { default: ReportError } = await load<{ default: (props: { error: Error; reset: () => void }) => ReactElement }>('../../../app/(app)/app/assessments/[documentId]/report/error');
    render(<ReportError error={new Error('raw internal detail')} reset={reset} />);
    expect(screen.getByRole('heading', { name: 'We couldn’t load this report' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/raw internal detail/)).not.toBeInTheDocument();
  });

  it('holds the X-31 print rules in globals.css, with tokens only', () => {
    const css = readFileSync(resolve(webRoot, 'app/globals.css'), 'utf8');
    const pageRule = css.slice(css.indexOf('@page'), css.indexOf('}', css.indexOf('@bottom-right')) + 1);
    const print = css.slice(css.lastIndexOf('@media print'));

    expect(pageRule).toContain('size: A4 portrait');
    expect(pageRule).toContain('margin: 16mm');
    expect(pageRule).toContain('counter(page)');
    expect(pageRule).toContain('counter(pages)');
    expect(pageRule).not.toMatch(/#[0-9a-f]{3,8}\b|rgb\(/i);
    expect(css).toContain('table-header-group');
    expect(print).toMatch(/\[data-report-document\]\s*\{[^}]*border: 0/);
    expect(print).toMatch(/\[data-report-risk\]\s*\{[^}]*break-inside: avoid/);
    expect(print).toMatch(/\[data-report-section="risks-in-detail"\]\s*\{[^}]*break-before: page/);
  });

  it('is guarded by the interface copy guard', () => {
    const guard = readFileSync(resolve(webRoot, 'src/lib/performance/interface-copy-guard.test.ts'), 'utf8');
    for (const file of [
      'src/features/assessments/assessment-report.tsx',
      'src/features/assessments/assessment-report-model.ts',
      'src/features/assessments/released-assessment-actions.tsx',
      'src/features/assessments/report-toolbar.tsx',
      'app/(app)/app/assessments/[documentId]/report/error.tsx',
    ]) expect(guard).toContain(`'${file}'`);
  });
});

/*
 * Task 3 (D-14, D-15, D-23; W4): the analyst's report, only once the analyst detail's server-computed `released` is
 * true, with the same paper as the Requestor's: the model drops a withdrawn Risk, as Strapi's active-risk rule does.
 */
describe('the analyst’s released assessment', () => {
  const analystReportPath = '../../../app/(app)/app/review/assessments/[documentId]/report/page';
  const generator = { documentId: 'analyst-9', displayName: 'Gen Analyst' };

  /** Every AnalystRiskDetail carries its required withdrawal: null for an active Risk. */
  function analystRisk(documentId: string, riskNumber: string, withdrawal: AnalystRiskDetail['withdrawal'] = null): AnalystRiskDetail {
    return {
      documentId, riskNumber, issueStatement: null, riskStatement: 'Analyst statement.', riskCategory: null, riskSubCategory: null,
      riskCause: null, potentialImpact: null, riskType: null, riskOwner: 'owner-2', informationSystemImpacted: 'system-1',
      informationAssetImpacted: 'asset-1', dataClassification: null, inherentLikelihood: null, highestInherentConsequence: null,
      inherentRating: null, inherentRatingRationale: null, residualLikelihood: null, highestResidualConsequence: null, residualRating: null,
      residualRatingRationale: null, controlEffectiveness: null, riskVelocity: null, identifiedDate: null, targetDate: null, closureDate: null,
      isExempted: null, exemptionReviewDate: null, escalationDetails: null, comments: 'Analyst-only comment.', riskCommunicationDate: null,
      treatmentAction: null, treatmentPlan: null, treatmentOwner: null, treatmentResolveDate: null, treatmentStatus: null, aiProvenance: null,
      withdrawal,
    };
  }

  const { actor: _actor, aiAssisted: _aiAssisted, ...releasedFacts } = releasedDetail;
  const analystDetail: AnalystAssessmentDetail = {
    ...releasedFacts,
    actor: 'analyst',
    released: true,
    documentId: 'assessment-1',
    generatedDate: '2026-08-29T23:00:00.000Z',
    generatedBy: generator,
    risks: [analystRisk('risk-1', 'RSK-0001'), analystRisk('risk-2', 'RSK-0002')],
    ownerLabels: [analystPerson],
    releaseReadiness: { ready: true, requirements: [] },
    generation: { generatedAt: '2026-08-29T23:00:00.000Z', generatedBy: generator, providerName: 'deterministic-assessment-draft', providerVersion: '2', runId: 'run-1', aiInputsChanged: null },
    aiProvenance: null,
  };

  const withdrawnRisk: AssessmentRiskListItem = { ...riskOne, documentId: 'risk-3', riskNumber: 'RSK-0003', riskStatement: 'A withdrawn statement.' };
  const withdrawal = { at: '2026-08-29T23:30:00.000Z', by: analystPerson, reason: 'Duplicate of RSK-0001.' };

  function analystReadsReturn(detail: AnalystAssessmentDetail, risks: readonly AssessmentRiskListItem[] = [riskTwo, riskOne]) {
    mocks.canViewerReviewAssessments.mockResolvedValue(true);
    mocks.getAnalystAssessment.mockResolvedValue(ok(detail));
    mocks.listAssessmentRisks.mockResolvedValue(ok(risks));
    mocks.listControlImplementations.mockImplementation(async (riskId: string) => ok(riskId === 'risk-1' ? [implementation] : []));
  }

  async function requestorModel() {
    const { toAssessmentReportModel } = await loadModel();
    return toAssessmentReportModel({ actor: 'requestor', assessment: releasedDetail, risks: [riskTwo, riskOne], controlsByRisk: { 'risk-1': [implementation], 'risk-2': [] } });
  }

  it('loads nothing for a detail the server says is not released, and the released model otherwise', async () => {
    const { loadAnalystReleasedAssessment, toAssessmentReportModel } = await loadModel();
    analystReadsReturn({ ...analystDetail, released: false });
    await expect(loadAnalystReleasedAssessment('assessment-1')).resolves.toBeNull();
    expect(mocks.listAssessmentRisks).not.toHaveBeenCalled();

    analystReadsReturn(analystDetail);
    const loaded = await loadAnalystReleasedAssessment('assessment-1');
    expect(loaded).not.toBeNull();
    const model = toAssessmentReportModel({ actor: 'analyst', ...loaded! });
    expect(model).toEqual(await requestorModel());
    expect(JSON.stringify(model)).not.toMatch(/Gen Analyst|Analyst-only comment|deterministic|run-1|withdrawal/);
  });

  it('loads nothing without the review gate, or for a refused or missing detail', async () => {
    const { loadAnalystReleasedAssessment } = await loadModel();
    analystReadsReturn(analystDetail);
    mocks.canViewerReviewAssessments.mockResolvedValue(false);
    await expect(loadAnalystReleasedAssessment('assessment-1')).resolves.toBeNull();
    expect(mocks.getAnalystAssessment).not.toHaveBeenCalled();

    for (const status of [403, 404]) {
      analystReadsReturn(analystDetail);
      mocks.getAnalystAssessment.mockResolvedValue(failed(status));
      await expect(loadAnalystReleasedAssessment('assessment-1')).resolves.toBeNull();
    }
  });

  it('drops a withdrawn Risk, so its count and paper equal the Requestor’s', async () => {
    const { loadAnalystReleasedAssessment, releasedAssessmentScopeSentence, toAssessmentReportModel } = await loadModel();
    const detail = { ...analystDetail, risks: [...analystDetail.risks, analystRisk('risk-3', 'RSK-0003', withdrawal)] };
    // Defensive: even a list read that returned the withdrawn Risk gives a report without it.
    analystReadsReturn(detail, [riskTwo, withdrawnRisk, riskOne]);

    const model = toAssessmentReportModel({ actor: 'analyst', ...(await loadAnalystReleasedAssessment('assessment-1'))! });

    expect(model.risks.map(({ risk }) => risk.riskNumber)).toEqual(['RSK-0001', 'RSK-0002']);
    expect(releasedAssessmentScopeSentence(model)).toBe('ASM-0042 as released: its summary, 2 risks and 1 mitigation control.');
    expect(model).toEqual(await requestorModel());
  });

  it('renders the same document at the analyst’s report route', async () => {
    analystReadsReturn(analystDetail);
    const route = await load<PageModule>(analystReportPath);

    render(await route.default(props()));

    expect(screen.getByRole('heading', { level: 1, name: 'Print report' }).closest('[data-print="hidden"]')).not.toBeNull();
    expect(screen.getByRole('heading', { level: 1, name: 'Cyber security risk assessment' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the risk assessment' })).toHaveAttribute('href', '/app/review/assessments/assessment-1');
    expect(screen.getByRole('region', { name: 'Notes' })).toHaveTextContent('AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.');
  });

  /*
   * FE4-01 (19-UI-SPEC §4.3): the notice follows the assessment, not the reader. An analyst printing their own request's
   * released assessment from the My route is served the analyst detail, and the paper still discloses the AI draft.
   */
  it('carries the AI notice on the My route’s paper when the analyst’s own released assessment was AI assisted (FE4-01)', async () => {
    const { releasedAssessmentDetailForActorSchema } = await import('./assessment-server-schema');
    mocks.getReleasedAssessment.mockResolvedValue(ok(releasedAssessmentDetailForActorSchema.parse(analystDetail)));
    mocks.listReleasedAssessmentRisks.mockResolvedValue(ok([riskTwo, riskOne]));
    mocks.listReleasedControlImplementations.mockImplementation(async (riskId: string) => ok(riskId === 'risk-1' ? [implementation] : []));
    const route = await load<PageModule>(requestorReportPath);

    render(await route.default(props()));

    expect(screen.getByRole('region', { name: 'Notes' })).toHaveTextContent('AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.');
  });

  /*
   * Review amendment R1 part 4: every printed report carries the paper-neutral notice, whichever route printed it, and
   * never addresses the reader as "you". The screen is unchanged: §10.1's sentence for the Requestor, and no notice for an
   * analyst reading the released view (IN-302).
   */
  it('prints the paper-neutral notice for either actor, while the released screen keeps §10.1 and IN-302', async () => {
    const { releasedAssessmentDetailForActorSchema } = await import('./assessment-server-schema');
    const { toAssessmentReportModel } = await loadModel();
    const { AssessmentReport } = await import('./assessment-report');
    const { ReleasedAssessmentDetailView } = await import('./released-assessment');
    const analystRead = releasedAssessmentDetailForActorSchema.parse(analystDetail)!;
    const reads = { risks: [riskTwo, riskOne], controlsByRisk: { 'risk-1': [implementation], 'risk-2': [] } };

    for (const model of [
      toAssessmentReportModel({ actor: 'requestor', assessment: releasedDetail, ...reads }),
      toAssessmentReportModel({ actor: 'requestor', assessment: analystRead, ...reads }),
      toAssessmentReportModel({ actor: 'analyst', assessment: analystDetail, ...reads }),
    ]) {
      const { unmount } = render(<AssessmentReport generatedAt="2026-10-17T03:04:00.000Z" model={model} timeZone="UTC" />);
      const notes = screen.getByRole('region', { name: 'Notes' });
      expect(notes).toHaveTextContent('AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before it was released.');
      expect(notes).not.toHaveTextContent(/to you/);
      unmount();
    }

    const requestorScreen = render(<ReleasedAssessmentDetailView assessment={releasedDetail} controlsByRisk={reads.controlsByRisk} risks={reads.risks} state="populated" />);
    expect(screen.getByText('AI helped prepare the first draft of this assessment. A Security Analyst reviewed it before releasing it to you.')).toBeInTheDocument();
    expect(screen.queryByText(/before it was released/)).not.toBeInTheDocument();
    requestorScreen.unmount();

    render(<ReleasedAssessmentDetailView assessment={analystRead} controlsByRisk={reads.controlsByRisk} risks={reads.risks} state="populated" />);
    expect(screen.queryByText(/AI helped prepare/)).not.toBeInTheDocument();
  });

  it('has no AI notice on the My route’s paper for the analyst’s own assessment written without AI (FE4-01)', async () => {
    const { releasedAssessmentDetailForActorSchema } = await import('./assessment-server-schema');
    const { toAssessmentReportModel } = await loadModel();
    const unassisted = releasedAssessmentDetailForActorSchema.parse({ ...analystDetail, generation: null });
    const unnamed = releasedAssessmentDetailForActorSchema.parse({ ...analystDetail, generation: { ...analystDetail.generation!, providerName: '  ' } });
    const assisted = releasedAssessmentDetailForActorSchema.parse(analystDetail);

    for (const [assessment, aiAssisted] of [[unassisted, false], [unnamed, false], [assisted, true]] as const) {
      expect(toAssessmentReportModel({ actor: 'requestor', assessment: assessment!, risks: [], controlsByRisk: {} }).aiAssisted).toBe(aiAssisted);
    }
  });

  it('renders the in-shell not-found at the analyst’s report route before release or without the gate', async () => {
    const route = await load<PageModule & { generateMetadata: (props: RouteProps) => Promise<{ title?: unknown }> }>(analystReportPath);
    analystReadsReturn({ ...analystDetail, released: false });
    await expect(route.default(props())).rejects.toThrow('NEXT_NOT_FOUND');
    await expect(route.generateMetadata(props())).rejects.toThrow('NEXT_NOT_FOUND');

    analystReadsReturn(analystDetail);
    mocks.canViewerReviewAssessments.mockResolvedValue(false);
    await expect(route.default(props())).rejects.toThrow('NEXT_NOT_FOUND');

    analystReadsReturn(analystDetail);
    await expect(route.generateMetadata(props())).resolves.toEqual({ title: 'Print report ASM-0042 | IdamBox CSRM' });
  });

  it('lets a failed read reach the analyst route’s error boundary', async () => {
    analystReadsReturn(analystDetail);
    mocks.listAssessmentRisks.mockResolvedValue(failed(500));
    const route = await load<PageModule>(analystReportPath);

    const result = route.default(props());
    await expect(result).rejects.toThrow();
    await expect(result).rejects.not.toThrow('NEXT_NOT_FOUND');
  });
});
