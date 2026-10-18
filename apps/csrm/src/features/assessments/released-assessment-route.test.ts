import { beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * WCAG 2.4.2 on the Requestor's released assessment route. Strapi answers another Requestor's
 * assessment read with 404, so the page renders the in-shell not-found. That notFound() is raised
 * after the page has started streaming, so it cannot change the document title; the route's metadata
 * therefore makes the same read and raises notFound() itself, and Next renders the not-found's title,
 * `Page not found | IdamBox CSRM`, in place of the route's.
 */

const mocks = vi.hoisted(() => ({
  getReleasedAssessment: vi.fn(),
  listMyReleasedAssessments: vi.fn(),
  listReleasedAssessmentRisks: vi.fn(),
  listReleasedControlImplementations: vi.fn(),
  notFound: vi.fn(),
  parseAssessmentCollectionQuery: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/assessments',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/features/assessments/assessment-service', () => ({
  getReleasedAssessment: mocks.getReleasedAssessment,
  listMyReleasedAssessments: mocks.listMyReleasedAssessments,
  listReleasedAssessmentRisks: mocks.listReleasedAssessmentRisks,
  listReleasedControlImplementations: mocks.listReleasedControlImplementations,
  parseAssessmentCollectionQuery: mocks.parseAssessmentCollectionQuery,
}));

type RouteProps = { params: Promise<{ documentId: string }> };
type AssessmentRoute = { generateMetadata?: (props: RouteProps) => Promise<{ title?: unknown }> };

async function loadRoute(): Promise<AssessmentRoute> {
  const path = '../../../app/(app)/app/assessments/[documentId]/page';
  return import(/* @vite-ignore */ path) as Promise<AssessmentRoute>;
}

const props = (): RouteProps => ({ params: Promise.resolve({ documentId: 'assessment-of-another-requestor' }) });

beforeEach(() => {
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.notFound.mockImplementation(() => {
    throw new Error('NEXT_NOT_FOUND');
  });
});

describe('the Requestor released assessment route title', () => {
  it('names the page while the assessment can be read or is refused', async () => {
    const route = await loadRoute();
    expect(route.generateMetadata, 'the route resolves its title through the record read').toBeTypeOf('function');

    mocks.getReleasedAssessment.mockResolvedValue({ data: { documentId: 'assessment-of-another-requestor' }, error: null });
    await expect(route.generateMetadata!(props())).resolves.toEqual({ title: 'Released Risk Assessment | IdamBox CSRM' });
    mocks.getReleasedAssessment.mockResolvedValue({ data: null, error: { status: 403, message: 'Forbidden' } });
    await expect(route.generateMetadata!(props())).resolves.toEqual({ title: 'Released Risk Assessment | IdamBox CSRM' });
    expect(mocks.getReleasedAssessment).toHaveBeenLastCalledWith('assessment-of-another-requestor');
  });

  it('takes the not-found title when the read answers 404, as Strapi does for another Requestor', async () => {
    const route = await loadRoute();
    mocks.getReleasedAssessment.mockResolvedValue({ data: null, error: { status: 404, message: 'Not Found' } });

    await expect(route.generateMetadata!(props())).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mocks.notFound).toHaveBeenCalledTimes(1);
  });
});

/*
 * D10, WR-304 (D-23, UAT-032): the released page hands its client view only what the view renders. The read is the
 * real parser's output, as the service returns it, for either actor, so the serialised props carry no generating
 * analyst and no AI fact beyond the Requestor's aiAssisted.
 */
describe('the released assessment route passes its client view only what it renders', () => {
  type PageRoute = { default: (props: RouteProps) => Promise<{ props: Record<string, unknown> }> };
  const reviewer = { documentId: 'analyst-1', displayName: 'Rae Reviewer' };
  const generator = { documentId: 'analyst-9', displayName: 'Gen Analyst' };
  const released = {
    documentId: 'assessment-1', assessmentNumber: 'ASM-0001', assessmentStatus: 'approved', assessmentDate: '2026-09-01T00:00:00.000Z',
    generatedDate: '2026-08-30T00:00:00.000Z', nextReviewDate: null, approvalDate: '2026-09-01T00:00:00.000Z', summary: 'Released summary.',
    overallRating: 'High', overallControlEffectiveness: null, recommendationsSummary: null, overallRiskRationale: null,
    assessmentRequest: { documentId: 'request-1', requestNumber: 'RAR-2026-0001', title: 'Customer portal', requestStatus: 'approved' },
    reviewedBy: reviewer, approvedBy: reviewer,
  };
  const generation = { generatedAt: '2026-08-30T00:00:00.000Z', generatedBy: generator, providerName: 'deterministic-assessment-draft', providerVersion: '2', runId: 'run-1', aiInputsChanged: null };

  it.each([
    ['the Requestor', { ...released, actor: 'requestor', aiAssisted: true }],
    ['an analyst', {
      ...released, actor: 'analyst', released: true, generatedBy: generator, generation, aiProvenance: null, risks: [], ownerLabels: [reviewer],
      releaseReadiness: { ready: true, requirements: [{ scope: 'assessment', key: 'summary', label: 'Assessment summary', state: 'met' }] },
    }],
  ])('for %s, the serialised props carry no generating analyst and no AI internals', async (_actor, payload) => {
    const { releasedAssessmentDetailForActorSchema } = await import('@/features/assessments/assessment-server-schema');
    mocks.getReleasedAssessment.mockResolvedValue({ data: releasedAssessmentDetailForActorSchema.parse(payload), error: null });
    mocks.listReleasedAssessmentRisks.mockResolvedValue({ data: [], error: null });
    const route = await loadRoute() as unknown as PageRoute;

    const page = await route.default(props());
    const serialised = JSON.stringify(page.props);

    expect(page.props.state).toBe('populated');
    expect(serialised).toContain('ASM-0001');
    expect(serialised).not.toMatch(/generatedBy|generatedDate|Gen Analyst|analyst-9|generation|providerName|deterministic|run-1|ownerLabels|releaseReadiness|aiProvenance/);
  });
});

/*
 * D-23, WR-304, D10: the Requestor's released assessment list hands its client list only what the list renders, so
 * no generating analyst reaches her browser, even from a read that served one.
 */
describe('the Requestor’s released assessment list passes its client list only what it renders', () => {
  type ListRoute = { default: (props: { searchParams: Promise<Record<string, string | string[] | undefined>> }) => Promise<{ props: { children: Array<{ props: Record<string, unknown> }> } }> };

  it('serialises no generating analyst and no field the list does not render', async () => {
    const served = {
      documentId: 'assessment-1', assessmentNumber: 'ASM-0001', assessmentStatus: 'approved', summary: 'Released summary text.',
      overallRating: 'High', generatedDate: '2026-08-30T00:00:00.000Z', generatedBy: { documentId: 'analyst-9', displayName: 'Gen Analyst' },
      approvalDate: '2026-09-01T00:00:00.000Z', requestTitle: 'Customer portal', riskCount: 2, highestResidualRating: 'Moderate',
    };
    mocks.parseAssessmentCollectionQuery.mockReturnValue({ q: '', sort: 'approvalDate:desc', page: 1, pageSize: 25 });
    mocks.listMyReleasedAssessments.mockResolvedValue({ data: { records: [served], pagination: { page: 1, pageSize: 25, pageCount: 1, total: 1 } }, error: null });
    const path = '../../../app/(app)/app/assessments/page';
    const route = await import(/* @vite-ignore */ path) as ListRoute;

    const page = await route.default({ searchParams: Promise.resolve({}) });
    const list = page.props.children[1];
    const assessments = list?.props.assessments as Array<Record<string, unknown>>;

    expect(assessments.map((assessment) => Object.keys(assessment).sort())).toEqual([['approvalDate', 'assessmentNumber', 'documentId', 'overallRating', 'requestTitle']]);
    const serialised = JSON.stringify(page.props);
    expect(serialised).toContain('ASM-0001');
    expect(serialised).not.toMatch(/Gen Analyst|analyst-9|generatedBy|Released summary text|riskCount|highestResidualRating/);
  });
});
