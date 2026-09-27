import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const get = vi.hoisted(() => vi.fn());
const replace = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/app/review',
  useRouter: () => ({ refresh: vi.fn(), replace }),
}));
// Only the network edge is replaced: the real parsers, service and closed
// response schemas all run.
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: get })),
  normalizeResponseParserError: vi.fn(() => ({ data: null, error: { message: 'Response contract mismatch.', status: 502 } })),
  normalizeTransportError: vi.fn(() => ({ data: null, error: { message: 'The CSRM service is unavailable.', status: 503 } })),
}));

import { AssessmentListContent } from '../../../app/(app)/app/review/assessments/page';
import { AssessmentRequestListContent } from '../../../app/(app)/app/review/requests/page';
import { AssessmentList, AssessmentRequestList } from './assessment-list';
import {
  listAnalystAssessments,
  listAssessmentRequests,
  parseAssessmentCollectionQuery,
  parseAssessmentRequestReviewQuery,
  type AssessmentRequestReviewQuery,
} from './assessment-service';

/*
 * GAP-1 (06.9-04). The two Analyst lists offer the complete labelled status
 * vocabularies (06.9 D-1). These tests follow each offered value the way an
 * Analyst's choice travels: from the rendered option, through navigation and the
 * closed query parser, into the typed client call. The published contract is
 * the authority on what that call may carry, so each value is checked against it.
 */

type OperationParameter = { name: string; schema?: { enum?: string[] } };
const specification = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../docs/references/specification.json'), 'utf8'),
) as { paths: Record<string, { get?: { parameters?: OperationParameter[] } }> };

function publishedEnum(path: string, name: string): readonly string[] {
  const values = specification.paths[path]?.get?.parameters?.find((parameter) => parameter.name === name)?.schema?.enum;
  if (!values) throw new Error(`GET ${path} publishes no ${name} enum.`);
  return values;
}

const emptyPage = {
  data: { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } } },
  response: { status: 200 },
};
const emptyResult = { data: { records: [], pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 } }, error: null };
const queues = ['requires-attention', 'awaiting-requestor', 'generation-in-progress', 'released'] as const;

function offeredStatuses(): string[] {
  const select = screen.getByRole('combobox', { name: 'Filter by status' });
  return [...select.querySelectorAll('option')].map((option) => option.value).filter(Boolean);
}

/** Choose a status as an Analyst does, and return the search parameters the list navigates to. */
function choose(status: string): Record<string, string> {
  fireEvent.change(screen.getByRole('combobox', { name: 'Filter by status' }), { target: { value: status } });
  const [href] = replace.mock.lastCall as [string];
  return Object.fromEntries(new URL(href, 'http://localhost').searchParams);
}

afterEach(() => {
  get.mockReset();
  replace.mockReset();
});

describe('Analyst request review status filter', () => {
  it.each(queues)('sends every offered status in the %s queue as a value the published contract accepts', async (queue) => {
    const published = publishedEnum('/v1/assessment_requests', 'filters[requestStatus]');
    const query: AssessmentRequestReviewQuery = { q: '', queue, sort: 'submittedDate:desc', page: 1, pageSize: 25 };
    render(<AssessmentRequestList query={query} requests={[]} />);
    const offered = offeredStatuses();

    for (const status of offered) {
      get.mockResolvedValueOnce(emptyPage);
      const result = await listAssessmentRequests(parseAssessmentRequestReviewQuery(choose(status)));

      expect(get).toHaveBeenLastCalledWith('/v1/assessment_requests', {
        params: {
          query: {
            'filters[queue]': queue,
            'filters[requestStatus]': status,
            sort: 'submittedDate:desc',
            'pagination[page]': 1,
            'pagination[pageSize]': 25,
          },
        },
      });
      expect(published, `${status} offered in the ${queue} queue`).toContain(status);
      expect(result).toEqual(emptyResult);
    }
    expect(offered).toEqual([...published]);
  });
});

describe('Analyst assessment status filter', () => {
  it('sends every offered status as a value the published contract accepts', async () => {
    const published = publishedEnum('/v1/risk_assessments', 'status');
    render(<AssessmentList assessments={[]} />);
    const offered = offeredStatuses();

    for (const status of offered) {
      get.mockResolvedValueOnce(emptyPage);
      const result = await listAnalystAssessments(parseAssessmentCollectionQuery(choose(status)));

      expect(get).toHaveBeenLastCalledWith('/v1/risk_assessments', {
        params: { query: { sort: 'generatedDate:desc', page: 1, pageSize: 25, status } },
      });
      expect(published, `${status} offered on the assessment list`).toContain(status);
      expect(result).toEqual(emptyResult);
    }
    expect(offered).toEqual([...published]);
  });
});

describe('the Released queue', () => {
  const releasedRequest = (requestStatus: 'approved' | 'closed', index: number) => ({
    documentId: `released-request-${index}`,
    requestNumber: `REQ-RELEASED-00${index}`,
    title: `Released request ${index}`,
    requestStatus,
    submittedDate: '2026-09-01T00:00:00.000Z',
  });
  const page = (data: readonly unknown[]) => ({
    data: { data, meta: { pagination: { page: 1, pageSize: 25, pageCount: 1, total: data.length } } },
    response: { status: 200 },
  });

  it('parses the approved and closed requests the Released queue returns', async () => {
    const records = [releasedRequest('approved', 1), releasedRequest('closed', 2)];
    get.mockResolvedValueOnce(page(records));

    await expect(listAssessmentRequests(parseAssessmentRequestReviewQuery({ queue: 'released' }))).resolves.toEqual({
      data: { records, pagination: { page: 1, pageSize: 25, pageCount: 1, total: 2 } },
      error: null,
    });
  });

  it('lists an approved request when Approved is chosen in the Released queue', async () => {
    get.mockResolvedValueOnce(page([releasedRequest('approved', 1)]));
    render(await AssessmentRequestListContent({ searchParams: Promise.resolve({ queue: 'released', status: 'approved' }) }));

    expect(screen.getAllByRole('link', { name: 'REQ-RELEASED-001' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('[data-state-kind]')).toBeNull();
  });
});

describe('an Analyst status choice that matches nothing', () => {
  it('renders the shared empty-filter state, not the error state, for a request status outside the queue', async () => {
    get.mockResolvedValueOnce(emptyPage);
    render(await AssessmentRequestListContent({ searchParams: Promise.resolve({ status: 'approved' }) }));

    expect(get).toHaveBeenCalledWith('/v1/assessment_requests', {
      params: {
        query: {
          'filters[queue]': 'requires-attention',
          'filters[requestStatus]': 'approved',
          sort: 'submittedDate:desc',
          'pagination[page]': 1,
          'pagination[pageSize]': 25,
        },
      },
    });
    expect(screen.getByRole('heading', { name: 'No assessment requests match these filters' })).toBeInTheDocument();
    // The chip names the filter; the empty state and the chip row each clear it (verdict 4a).
    expect(screen.getByText('Status: Approved')).toBeInTheDocument();
    expect(within(document.querySelector<HTMLElement>('[data-state-kind="empty"]')!).getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('approved');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('[data-state-kind="error"]')).toBeNull();
  });

  it('renders the shared empty-filter state, not the error state, for a closed assessment status', async () => {
    get.mockResolvedValueOnce(emptyPage);
    render(await AssessmentListContent({ searchParams: Promise.resolve({ status: 'closed' }) }));

    expect(get).toHaveBeenCalledWith('/v1/risk_assessments', {
      params: { query: { sort: 'generatedDate:desc', page: 1, pageSize: 25, status: 'closed' } },
    });
    expect(screen.getByRole('heading', { name: 'No risk assessments match these filters' })).toBeInTheDocument();
    expect(screen.getByText('Status: Closed')).toBeInTheDocument();
    expect(within(document.querySelector<HTMLElement>('[data-state-kind="empty"]')!).getByRole('button', { name: 'Clear filters' })).toBeInTheDocument();
    expect(screen.getByRole('combobox', { name: 'Filter by status' })).toHaveValue('closed');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(document.querySelector('[data-state-kind="error"]')).toBeNull();
  });
});
