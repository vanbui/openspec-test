import 'server-only';

import { cache } from 'react';

import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';

import type { AnalystAssessmentDetail, AssessmentRiskListItem, ControlImplementation, ReleasedAssessmentDetailForActor } from './assessment-schema';
import type { ControlsByRisk } from './assessment-report-model';
import {
  getAnalystAssessment,
  getReleasedAssessment,
  listAssessmentRisks,
  listControlImplementations,
  listReleasedAssessmentRisks,
  listReleasedControlImplementations,
  type TransportResult,
} from './assessment-service';

export {
  analystReportHref,
  releasedAssessmentActions,
  releasedAssessmentScopeSentence,
  requestorReportHref,
  toAssessmentReportModel,
  type AssessmentReportModel,
  type ControlsByRisk,
  type ReleasedAssessmentActions,
} from './assessment-report-model';

/*
 * The released assessment's one loader (Phase 19 D-14, D-23; the pilot's ruling W5 of 2026-10-16), shared by the
 * Requestor's released page and both report routes, so they make the same reads and branch the same way. Every read
 * goes through Strapi, which gates the released reads with the one released-assessment record-read check: another
 * person's assessment, or an unreleased one, is the missing record's 404.
 */

/** One detail read per request, shared by a route's generateMetadata and its page. */
export const readReleasedAssessment = cache(getReleasedAssessment);

type TransportFailure = { status?: number; kind?: string; operation?: string };

export type RequestorReleasedAssessment =
  | { readonly state: 'not-found' }
  | { readonly state: 'contract-mismatch'; readonly operation: string }
  | { readonly state: 'permission' }
  | { readonly state: 'error' }
  | { readonly state: 'unavailable' }
  | {
    readonly state: 'populated';
    readonly assessment: ReleasedAssessmentDetailForActor;
    readonly risks: readonly AssessmentRiskListItem[];
    readonly controlsByRisk: ControlsByRisk;
  };

const notFoundResult = { state: 'not-found' } as const;

function stateForStatus(status: number | undefined): { readonly state: 'permission' | 'error' } {
  return { state: status === 403 ? 'permission' : 'error' };
}

/** UI-SPEC §15.3: the reader sees the ordinary error state; the failing operation stays in the server log. */
export function logContractMismatch(operation: string): void {
  console.error(`[csrm-contract] response contract mismatch: ${operation}`);
}

async function readControlsByRisk(
  risks: readonly AssessmentRiskListItem[],
  read: (riskId: string) => Promise<TransportResult<readonly ControlImplementation[]>>,
): Promise<{ readonly state: 'populated'; readonly controlsByRisk: ControlsByRisk } | { readonly state: 'not-found' | 'permission' | 'error' }> {
  const results = await Promise.all(risks.map(async (risk) => ({ result: await read(risk.documentId), riskId: risk.documentId })));
  if (results.some(({ result }) => result.error?.status === 404)) return notFoundResult;
  const failed = results.find(({ result }) => result.error || !result.data);
  if (failed) return stateForStatus(failed.result.error?.status ?? 500);
  const controlsByRisk: ControlsByRisk = Object.fromEntries(results.map(({ result, riskId }) => [riskId, result.data ?? []]));
  return { state: 'populated', controlsByRisk };
}

/**
 * The Requestor's released reads exactly as the released page made them before 19-12: the detail, the risks, then each
 * Risk's control implementations. Any 404 is not-found; a contract mismatch at the detail names its operation.
 */
export async function loadRequestorReleasedAssessment(documentId: string): Promise<RequestorReleasedAssessment> {
  const assessmentResult = await readReleasedAssessment(documentId);
  if (assessmentResult.error?.status === 404) return notFoundResult;
  if (assessmentResult.error?.kind === 'response-contract-mismatch') {
    return { state: 'contract-mismatch', operation: assessmentResult.error.operation ?? 'unknown operation' };
  }
  if (assessmentResult.error) return stateForStatus(assessmentResult.error.status ?? 500);
  if (!assessmentResult.data) return notFoundResult;

  const risksResult = await listReleasedAssessmentRisks(documentId);
  if (risksResult.error?.status === 404) return notFoundResult;
  if (risksResult.error) return stateForStatus(risksResult.error.status ?? 500);
  if (!risksResult.data) return { state: 'unavailable' };

  const descendants = await readControlsByRisk(risksResult.data, listReleasedControlImplementations);
  if (descendants.state !== 'populated') return descendants;
  return { state: 'populated', assessment: assessmentResult.data, risks: risksResult.data, controlsByRisk: descendants.controlsByRisk };
}

/*
 * The analyst's own cached detail read, as the analyst page makes it. Wrapped lazily so a module that never calls it
 * (the Requestor's routes) never touches the analyst read.
 */
export const readAnalystReleasedAssessment = cache((documentId: string) => getAnalystAssessment(documentId));

export type AnalystReleasedAssessment = {
  readonly assessment: AnalystAssessmentDetail;
  readonly risks: readonly AssessmentRiskListItem[];
  readonly controlsByRisk: ControlsByRisk;
};

/**
 * The analyst's released reads (D-14, D-15): the review gate first, then the analyst detail and its server-computed
 * `released`, then the released risks read and each Risk's control implementations. Null when the gate, the read or
 * the released flag refuses: the report route renders the in-shell not-found. A failure that is not a refusal throws,
 * so the route's error boundary renders.
 */
export async function loadAnalystReleasedAssessment(documentId: string): Promise<AnalystReleasedAssessment | null> {
  if (!(await canViewerReviewAssessments())) return null;
  const assessmentResult = await readAnalystReleasedAssessment(documentId);
  const refused = (error: TransportFailure | null) => error?.status === 404 || error?.status === 403;
  if (refused(assessmentResult.error) || (!assessmentResult.error && !assessmentResult.data)) return null;
  if (assessmentResult.error) {
    if (assessmentResult.error.kind === 'response-contract-mismatch') logContractMismatch(assessmentResult.error.operation ?? 'unknown operation');
    throw new Error('The released assessment could not be read.');
  }
  if (!assessmentResult.data?.released) return null;

  const risksResult = await listAssessmentRisks(documentId);
  if (refused(risksResult.error)) return null;
  if (risksResult.error || !risksResult.data) throw new Error('The released assessment’s risks could not be read.');

  const descendants = await readControlsByRisk(risksResult.data, listControlImplementations);
  if (descendants.state === 'not-found' || descendants.state === 'permission') return null;
  if (descendants.state !== 'populated') throw new Error('The released assessment’s mitigation controls could not be read.');
  return { assessment: assessmentResult.data, risks: risksResult.data, controlsByRisk: descendants.controlsByRisk };
}
