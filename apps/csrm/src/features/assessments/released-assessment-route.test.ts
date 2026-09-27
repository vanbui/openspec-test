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
  listReleasedAssessmentRisks: vi.fn(),
  listReleasedControlImplementations: vi.fn(),
  notFound: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  notFound: mocks.notFound,
  usePathname: () => '/app/assessments',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock('@/features/assessments/assessment-service', () => ({
  getReleasedAssessment: mocks.getReleasedAssessment,
  listReleasedAssessmentRisks: mocks.listReleasedAssessmentRisks,
  listReleasedControlImplementations: mocks.listReleasedControlImplementations,
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
