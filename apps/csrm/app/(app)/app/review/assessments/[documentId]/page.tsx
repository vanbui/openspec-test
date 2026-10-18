import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';

import {
  AssessmentEditor,
  AssessmentEditorSkeleton,
  RISK_FILTER_PARAM,
  type RiskFilter,
} from '@/features/assessments/assessment-editor';
import { canMutateAssessment, relationLabelsFromRiskList } from '@/features/assessments/assessment-domain';
import {
  getAnalystAssessment,
  listAssessmentRisks,
  listControlImplementations,
  listRiskTypes,
} from '@/features/assessments/assessment-service';
import { searchActiveUsersAction, searchControlsAction } from '@/features/assessments/assessment-actions';
import { searchInformationAssetsAction, searchInformationSystemsAction } from '@/features/requests/request-actions';
import { getRequest } from '@/features/requests/request-service';
import { assessmentProvenanceHeaderProps } from '@/features/ai-assistance/ai-provenance-domain';
import { aiInputsChangedSlot, assessmentSignalProps } from '@/features/ai-assistance/ai-inputs-changed';
import { RequestContextLines } from '@/features/assessments/request-context-lines';
import { analystReportHref, releasedAssessmentActions, toAssessmentReportModel } from '@/features/assessments/assessment-report-model';
import { ReleasedAssessmentHeaderActions } from '@/features/assessments/released-assessment-actions';
import { latestSuggestionsAskedAt } from '@/features/risk-curation/risk-curation-domain';
import { listRiskAiProposals } from '@/features/risk-curation/risk-curation-service';
import { SuggestMoreRisksButton } from '@/features/risk-curation/suggest-more-risks-button';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { draftOwnerKey } from '@/lib/session-drafts/draft-owner-key';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

type AssessmentReviewPageProps = {
  params: Promise<{ documentId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** Phase 16 (16-UI-SPEC §6.3): `?risks=withdrawn` opens the Withdrawn list; anything else is the Active list. */
function riskFilterOf(query: Record<string, string | string[] | undefined> | undefined): RiskFilter {
  return query?.[RISK_FILTER_PARAM] === 'withdrawn' ? 'withdrawn' : 'active';
}

const title = 'Risk Assessment Review | IdamBox CSRM';

// One read per request, shared by the document title and the page.
const readAnalystAssessment = cache(getAnalystAssessment);

/*
 * A viewer without assessment:review keeps the static title and the assessment is never read (D-23), so an
 * existing id and a missing one look the same. For an analyst, an assessment id that does not exist takes the
 * not-found's title; any other outcome keeps the route's.
 */
export async function generateMetadata({ params }: AssessmentReviewPageProps): Promise<Metadata> {
  if (!(await canViewerReviewAssessments())) return { title };
  return recordRouteMetadata(readAnalystAssessment((await params).documentId), title);
}

export async function AssessmentEditorContent({ params, searchParams }: AssessmentReviewPageProps) {
  // The gate comes before any read (D-23). It is presentation only: Strapi authorises every read itself.
  if (!(await canViewerReviewAssessments())) return <AssessmentEditor refusal="role" state="permission" />;
  const { documentId } = await params;
  const assessmentResult = await readAnalystAssessment(documentId);
  if (assessmentResult.error?.status === 404) notFound();
  if (assessmentResult.error) return <AssessmentEditor state={assessmentResult.error.status === 403 ? 'permission' : 'error'} />;
  if (!assessmentResult.data) notFound();

  // No option list is loaded whole (D-28): the Control picker searches the library (D-29) and each Risk Type
  // carries its applicable controls (D-31); the system and asset pickers search the inventory and offer the
  // originating request's selections first (D-30). The served Risk list names each Risk's system and asset, and
  // a released assessment reads as it does for the Requestor (D-34), so no editor ever shows an id.
  const mutable = canMutateAssessment(assessmentResult.data);
  const [riskTypesResult, riskListResult, requestResult, proposalsResult, session, query] = await Promise.all([
    listRiskTypes(),
    listAssessmentRisks(documentId),
    mutable ? getRequest(assessmentResult.data.assessmentRequest.documentId) : undefined,
    // Phase 16 D-41 (16-UI-SPEC §1, §2): the AI proposals read, beside the assessment. Strapi decides who may read it.
    listRiskAiProposals(documentId),
    getSessionAdapter().current(),
    searchParams,
  ]);
  /*
   * WR-206: only the reads the editor cannot work without block it. The Risk Types always do. The served Risk list
   * does when the assessment is read-only, because the released view reads it (D-34); for an editable assessment
   * it only names the saved systems and assets, so its failure leaves those names unavailable (never an id), while
   * Strapi refusing it still shows the permission state. The originating request only feeds the pickers'
   * suggestions (D-30): a failed or refused request read leaves the editor searching only, as the Risk Register's
   * Risk page does (research Open Question 2).
   */
  const riskListBlocks = !mutable || riskListResult.error?.status === 403;
  const blocking = [riskTypesResult, ...(riskListBlocks ? [riskListResult] : [])];
  if (blocking.some((result) => result.error?.status === 403)) return <AssessmentEditor state="permission" />;
  if (blocking.some((result) => result.error)) return <AssessmentEditor state="error" />;
  const riskListItems = riskListResult.error ? [] : riskListResult.data ?? [];
  const requestSelections = requestResult && !requestResult.error ? requestResult.data : undefined;

  const risks = assessmentResult.data.risks;
  const implementationResults = await Promise.all(risks.map(async (risk) => ({
    riskId: risk.documentId,
    result: await listControlImplementations(risk.documentId),
  })));
  if (implementationResults.some(({ result }) => result.error?.status === 403)) return <AssessmentEditor state="permission" />;
  if (implementationResults.some(({ result }) => result.error)) return <AssessmentEditor state="error" />;
  const controlImplementations = Object.fromEntries(implementationResults.map(({ result, riskId }) => [riskId, result.data ?? []]));
  // D-23: who asked for an AI generation and how much review remains, rendered here on the server.
  const provenance = assessmentProvenanceHeaderProps(assessmentResult.data);
  /*
   * Phase 13 D-29 (13-UI-SPEC §10.2): which notes changed the draft's AI inputs since it was generated, rendered here on the
   * server and handed to the editor's provenance header as a slot, so the editor's first load carries none of its code
   * (D-34). Strapi serves the signal to human Security Analysts only.
   */
  const originatingRequest = assessmentResult.data.assessmentRequest;
  /*
   * Phase 16 (16-UI-SPEC §1, §2.4, §12.3; T-16-39): a 403 with OWN_REQUEST says the viewer raised the originating request,
   * so the editor shows that analyst's state and is handed no proposal; any other failure shows the section's compact
   * error while readiness still shows the served item and Strapi still refuses a release with open proposals.
   */
  const proposals = proposalsResult.data ?? null;
  const viewerRaisedRequest = proposalsResult.error?.status === 403 && proposalsResult.error.reason === 'OWN_REQUEST';
  const proposalsError = proposals === null && !viewerRaisedRequest;
  /*
   * §10.2 (UI-D26): the signal's heading follows the latest Suggest more risks request, and it offers that request where the
   * read allows a start; the analyst who raised the request reads the caption in its place.
   */
  const suggestAllowed = mutable && proposals !== null && proposals.editable && proposals.actions.suggest.allowed;
  const aiInputsChanged = aiInputsChangedSlot({
    requestId: originatingRequest.documentId,
    signal: assessmentResult.data.generation?.aiInputsChanged,
    target: 'draft',
    ...assessmentSignalProps({
      askedAt: proposals ? latestSuggestionsAskedAt(proposals.runs) : null,
      generatedAt: assessmentResult.data.generation?.generatedAt ?? null,
      viewerRaisedRequest,
      action: suggestAllowed ? <SuggestMoreRisksButton assessmentId={documentId} /> : undefined,
    }),
  });
  // Phase 13 D-16, D-25 (13-UI-SPEC §11) and Phase 14 D-27 (14-UI-SPEC §6.1): who holds the request, its notes figure and its
  // files figure, under its link, rendered here too.
  const requestContext = <RequestContextLines assignment={originatingRequest.assignment} files={originatingRequest.files} notes={originatingRequest.notes} requestId={originatingRequest.documentId} />;
  /*
   * Phase 19 (D-15, D-21; 19-UI-SPEC §1, §4.1): Print report, then Export {number}, only when the analyst detail's
   * server-computed `released` says so (Strapi's one released-assessment record-read check), Export only with
   * released-assessment:export. Its counts come from the report model over the reads above, which the read-only view
   * required, so they match the report and the file: active Risks only. Presentation only; the export is the control.
   */
  const headerAction = assessmentResult.data.released
    ? <ReleasedAssessmentHeaderActions actions={releasedAssessmentActions({
      canExport: can('released-assessment:export', await viewerCapabilities()),
      documentId,
      model: toAssessmentReportModel({ actor: 'analyst', assessment: assessmentResult.data, risks: riskListItems, controlsByRisk: controlImplementations }),
      reportHref: analystReportHref(documentId),
    })} />
    : undefined;

  return (
    <AssessmentEditor
      aiInputsChanged={aiInputsChanged}
      assessment={assessmentResult.data}
      controlImplementations={controlImplementations}
      headerAction={headerAction}
      provenance={provenance}
      relationLabels={relationLabelsFromRiskList(riskListItems)}
      requestContext={requestContext}
      requestAssets={requestSelections?.informationAssets ?? []}
      requestSystems={requestSelections?.informationSystems ?? []}
      risks={risks}
      riskListItems={riskListItems}
      riskTypes={riskTypesResult.data ?? []}
      ownerKey={session ? draftOwnerKey(session) : null}
      proposals={proposals}
      proposalsError={proposalsError}
      riskFilter={riskFilterOf(query)}
      viewer={session ? { documentId: '', displayName: session.displayName } : null}
      viewerRaisedRequest={viewerRaisedRequest}
      searchOwners={searchActiveUsersAction}
      searchControls={searchControlsAction}
      searchSystems={searchInformationSystemsAction}
      searchAssets={searchInformationAssetsAction}
    />
  );
}

export default function AssessmentReviewPage({ params, searchParams }: AssessmentReviewPageProps) {
  return <Suspense fallback={<AssessmentEditorSkeleton />}><AssessmentEditorContent params={params} searchParams={searchParams} /></Suspense>;
}
