import 'server-only';

import type { TransportResult } from '../../lib/api/transport/server-client';
import { getMyAssessmentRatingSummary, listMyReleasedAssessments } from '../assessments/assessment-service';
import type { MyRequestListQuery } from '../requests/request-domain';
import { getMyRequestStatusSummary, listMyRequests } from '../requests/request-service';
import type { ContractResponseParser } from '../assessments/assessment-service';
import type { RequestorHomeReleased, RequestorHomeSection, RequestorHomeState } from './requestor-home-presentation';

export type { RequestorHomeSection, RequestorHomeState } from './requestor-home-presentation';

/** The Home composes already parsed service results; it parses no transport response itself. */
export const responseParserModule = {
  modulePath: 'features/home/requestor-home-service.ts',
  mode: 'no-direct-response-parser' as const,
  parsers: [] as const satisfies readonly ContractResponseParser[],
  reason: 'The Requestor Home composes the request and assessment services’ parsed results and makes no direct transport response parse.',
};

/*
 * The first page of the Requestor's own requests, newest first (D-19, D-20), read once per holder. Ten is the
 * most any section shows: Needs your action shows ten, With the Security Analyst five.
 */
const firstPage = { q: '', status: undefined, notes: undefined, sort: 'updatedAt:desc', page: 1, pageSize: 10 } as const satisfies Omit<MyRequestListQuery, 'holder'>;

function sectionOf<T>(result: TransportResult<T>): RequestorHomeSection<T> {
  return result.error || !result.data ? { status: 'unavailable' } : { status: 'ready', data: result.data };
}

function refused(results: readonly TransportResult<unknown>[]): boolean {
  return results.some((result) => result.error?.status === 403);
}

/**
 * The Requestor Home's reads (D-19 to D-21): the Requestor's own requests held by them and by the Security
 * Analyst from GET /v1/my_requests, and their newest released assessments with the counts by overall rating.
 * Every read is owner-scoped by Strapi, and none is an analyst read (T-11-01, T-11-52). The four run in
 * parallel and settle on their own: a refusal of any read is the permission state, every read failing is the
 * page error, and otherwise each section is ready or unavailable by itself.
 *
 * A fifth read in the same batch, the status summary, gives the count of requests with new notes (D-24). It is
 * an enhancement, not a section: it joins neither the refusal check nor the page error, and its failure, refusal
 * or rejection (caught on its own, so it never rejects the batch) leaves the new-notes row absent and changes
 * nothing else (13-UI-SPEC §12.3).
 */
export async function getRequestorHome(): Promise<RequestorHomeState> {
  try {
    const [needsAction, withAnalyst, released, ratings, summary] = await Promise.all([
      listMyRequests({ ...firstPage, holder: 'requestor' }),
      listMyRequests({ ...firstPage, holder: 'analyst' }),
      listMyReleasedAssessments({ q: '', status: undefined, overallRating: undefined, approvedFrom: undefined, approvedTo: undefined, sort: 'approvalDate:desc', page: 1, pageSize: 10 }),
      getMyAssessmentRatingSummary(),
      getMyRequestStatusSummary().catch(() => null),
    ]);

    if (refused([needsAction, withAnalyst, released, ratings])) return { kind: 'permission-denied' };

    const releasedSection: RequestorHomeSection<RequestorHomeReleased> = released.error || !released.data || ratings.error || !ratings.data
      ? { status: 'unavailable' }
      : {
        status: 'ready',
        data: {
          records: released.data.records,
          total: released.data.pagination.total,
          ratings: { Low: ratings.data.Low, Moderate: ratings.data.Moderate, High: ratings.data.High, Critical: ratings.data.Critical },
        },
      };
    const sections = { needsAction: sectionOf(needsAction), withAnalyst: sectionOf(withAnalyst), released: releasedSection };
    const withUnreadNotes = summary && !summary.error && summary.data ? summary.data.withUnreadNotes : 0;

    return Object.values(sections).every((section) => section.status === 'unavailable')
      ? { kind: 'error' }
      : { kind: 'ready', home: { ...sections, withUnreadNotes } };
  } catch {
    return { kind: 'error' };
  }
}
