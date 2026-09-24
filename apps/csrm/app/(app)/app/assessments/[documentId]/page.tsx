import { notFound } from 'next/navigation';

import {
  ReleasedAssessmentDetailView,
  type ReleasedAssessmentDetailState,
} from '@/features/assessments/released-assessment';
import {
  getReleasedAssessment,
  listReleasedAssessmentRisks,
  listReleasedControlImplementations,
} from '@/features/assessments/assessment-service';
import type { ControlImplementation, Risk } from '@/features/assessments/assessment-schema';

type ReleasedAssessmentPageProps = { params: Promise<{ documentId: string }> };

export const metadata = { title: 'Released Risk Assessment | IdamBox CSRM' };

function stateForStatus(status: number): Extract<ReleasedAssessmentDetailState, 'error' | 'permission'> {
  return status === 403 ? 'permission' : 'error';
}

async function loadReleasedDescendants(risks: readonly Risk[]) {
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
  const assessmentResult = await getReleasedAssessment(documentId);
  if (assessmentResult.error?.status === 404) notFound();
  if (assessmentResult.error) return <ReleasedAssessmentDetailView diagnosticOperation={assessmentResult.error.operation} state={assessmentResult.error.kind === 'response-contract-mismatch' ? 'contract-mismatch' : stateForStatus(assessmentResult.error.status ?? 500)} />;
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
