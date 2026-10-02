import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';

import {
  ReleasedAssessmentDetailView,
  type ReleasedAssessmentDetailState,
} from '@/features/assessments/released-assessment';
import {
  getReleasedAssessment,
  listReleasedAssessmentRisks,
  listReleasedControlImplementations,
} from '@/features/assessments/assessment-service';
import type { AssessmentRiskListItem, ControlImplementation } from '@/features/assessments/assessment-schema';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

type ReleasedAssessmentPageProps = { params: Promise<{ documentId: string }> };

// One read per request, shared by the document title and the page.
const readReleasedAssessment = cache(getReleasedAssessment);

/*
 * Strapi answers another Requestor's assessment with 404, so the page renders the in-shell not-found.
 * The title follows it (Page not found | IdamBox CSRM) only because this metadata makes the same read.
 */
export async function generateMetadata({ params }: ReleasedAssessmentPageProps): Promise<Metadata> {
  return recordRouteMetadata(readReleasedAssessment((await params).documentId), 'Released Risk Assessment | IdamBox CSRM');
}

function stateForStatus(status: number): Extract<ReleasedAssessmentDetailState, 'error' | 'permission'> {
  return status === 403 ? 'permission' : 'error';
}

async function loadReleasedDescendants(risks: readonly AssessmentRiskListItem[]) {
  const controlResults = await Promise.all(
    risks.map(async (risk) => ({
      result: await listReleasedControlImplementations(risk.documentId),
      riskId: risk.documentId,
    })),
  );

  const missing = controlResults.find(({ result }) => result.error?.status === 404);
  if (missing) notFound();

  const failed = controlResults.find(({ result }) => result.error || !result.data);
  if (failed) {
    return { state: stateForStatus(failed.result.error?.status ?? 500) } as const;
  }

  const controlsByRisk = Object.fromEntries(
    controlResults.map(({ result, riskId }) => [riskId, result.data ?? []]),
  ) as Readonly<Record<string, readonly ControlImplementation[]>>;

  return { controlsByRisk, state: 'populated' } as const;
}

export default async function ReleasedAssessmentPage({ params }: ReleasedAssessmentPageProps) {
  const { documentId } = await params;
  const assessmentResult = await readReleasedAssessment(documentId);
  if (assessmentResult.error?.status === 404) notFound();
  if (assessmentResult.error?.kind === 'response-contract-mismatch') {
    // UI-SPEC §15.3: the reader sees the ordinary error state; the failing operation stays in the server log.
    console.error(`[csrm-contract] response contract mismatch: ${assessmentResult.error.operation ?? 'unknown operation'}`);
    return <ReleasedAssessmentDetailView state="contract-mismatch" />;
  }
  if (assessmentResult.error) return <ReleasedAssessmentDetailView state={stateForStatus(assessmentResult.error.status ?? 500)} />;
  if (!assessmentResult.data) notFound();

  const risksResult = await listReleasedAssessmentRisks(documentId);
  if (risksResult.error?.status === 404) notFound();
  if (risksResult.error) return <ReleasedAssessmentDetailView state={stateForStatus(risksResult.error.status ?? 500)} />;
  if (!risksResult.data) return <ReleasedAssessmentDetailView state="unavailable" />;

  const descendants = await loadReleasedDescendants(risksResult.data);
  if (descendants.state !== 'populated') return <ReleasedAssessmentDetailView state={descendants.state} />;

  return (
    <ReleasedAssessmentDetailView
      assessment={assessmentResult.data}
      controlsByRisk={descendants.controlsByRisk}
      risks={risksResult.data}
      state="populated"
    />
  );
}
