import type { Metadata } from 'next';
import { cache, Suspense } from 'react';
import { notFound } from 'next/navigation';

import { aiInputsChangedSlot } from '@/features/ai-assistance/ai-inputs-changed';
import { AssessmentDetail, AssessmentDetailSkeleton } from '@/features/assessments/assessment-detail';
import { listRequestAttachments } from '@/features/attachments/attachments-service';
import { FilesSection, filesSectionFor, noteFilesFor } from '@/features/attachments/files-section';
import { getRequestGenerationJobs } from '@/features/assessments/assessment-service';
import { getQuestionnaire } from '@/features/questionnaires/questionnaire-service';
import { panelGuidance } from '@/features/questionnaire-ai/questionnaire-ai-domain';
import { listQuestionnaireAiProposals } from '@/features/questionnaire-ai/questionnaire-ai-service';
import { StartProposalsButton } from '@/features/questionnaire-ai/start-proposals-button';
import { isAnalystAssignmentView, questionnaireGenerationAction, type CsrmAssessmentRequest } from '@/features/requests/request-domain';
import { getRequest } from '@/features/requests/request-service';
import { NotesSection, notesAuthorNames } from '@/features/request-notes/notes-section';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { canViewerReviewAssessments } from '@/lib/capabilities/analyst-review-gate';
import { draftOwnerKey } from '@/lib/session-drafts/draft-owner-key';
import { recordRouteMetadata } from '@/lib/metadata/record-route-metadata';

export type AssessmentRequestDetailPageProps = { params: Promise<{ documentId: string }> };

const title = 'Assessment Request Review | IdamBox CSRM';

// One read per request, shared by the document title and the page.
const readRequest = cache(getRequest);

/*
 * A viewer without assessment:review keeps the static title and the request is never read (D-23), so an
 * existing id and a missing one look the same. For an analyst, a request id that does not exist takes the
 * not-found's title; any other outcome keeps the route's.
 */
export async function generateMetadata({ params }: AssessmentRequestDetailPageProps): Promise<Metadata> {
  if (!(await canViewerReviewAssessments())) return { title };
  return recordRouteMetadata(readRequest((await params).documentId), title);
}

export async function AssessmentRequestDetailContent({ params }: AssessmentRequestDetailPageProps) {
  // The gate comes before any read (D-23). It is presentation only: Strapi authorises the read itself.
  if (!(await canViewerReviewAssessments())) return <AssessmentDetail refusal="role" state="permission" />;
  const { documentId } = await params;
  const result = await readRequest(documentId);
  if (result.error?.status === 404) notFound();
  if (result.error) return <AssessmentDetail state={result.error.status === 403 ? 'permission' : 'error'} />;
  if (!result.data) notFound();
  const request = result.data;
  // Past the gate, every record link is an analyst link: the viewer holds assessment:review.
  const relationships = request.relationships;
  const questionnaireHref = relationships?.questionnaire.availability === 'available'
    ? `/app/review/questionnaires/${encodeURIComponent(relationships.questionnaire.documentId)}` : undefined;
  const assessmentHref = relationships?.assessment.availability === 'available'
    ? `/app/review/assessments/${encodeURIComponent(relationships.assessment.documentId)}` : undefined;
  /*
   * D-26: the request's current generation jobs seed the hub's two cards, so an analyst who comes back
   * mid-generation sees the job instead of a second Generate. The read follows the gate and the request read.
   */
  const [analystChangesSinceGeneration, generationJobs, session, files, proposals] = await Promise.all([
    readAnalystChangesSinceGeneration(request),
    getRequestGenerationJobs(request.documentId),
    getSessionAdapter().current(),
    /* Phase 14 D-18: the files are read only for a viewer the request read gave a file summary. */
    request.attachments ? listRequestAttachments(request.documentId) : Promise.resolve(null),
    /*
     * Phase 15 (15-UI-SPEC §8.2 to §8.4; D-08, D-09, D-29, D-32): the questionnaire's AI proposals read decides Replace and
     * carries the proposals line, the hub's proposal job and the draft card's gate. A failure leaves them absent (Strapi
     * still gates); an OWN_REQUEST refusal marks the requesting analyst.
     */
    relationships?.questionnaire.availability === 'available' ? listQuestionnaireAiProposals(relationships.questionnaire.documentId) : Promise.resolve(null),
  ]);
  const aiProposals = proposals?.data ?? null;
  /* D-32: the request read's assignment view says the viewer raised it even before a questionnaire exists. */
  const ownRequest = (request.assignment != null && isAnalystAssignmentView(request.assignment) && request.assignment.ownRequest)
    || (proposals?.error?.status === 403 && proposals.error.reason === 'OWN_REQUEST');
  /*
   * A request with no linked questionnaire is still a request the analyst is
   * authorised to review and, while it is submitted, to return to draft — it is
   * in fact the only state that is eligible. The detail view carries its own
   * deliberate treatment for the missing questionnaire, so the empty state here
   * is reserved for a missing request rather than a missing questionnaire.
   */
  /*
   * 13-UI-SPEC §6, §9.3 (UI-D17, UI-D31): the picker's reason and the composer's note are kept per person and request;
   * the key names nobody in clear.
   */
  const ownerKey = session ? draftOwnerKey(session) : null;
  const filesSection = filesSectionFor(request, files, { viewer: 'analyst', draftOwnerKey: ownerKey });
  /* 14-UI-SPEC §4 (D-17, D-27): each note's files from the same list, and whether the composer takes files. */
  const noteFiles = noteFilesFor(filesSection);
  /*
   * Phase 13 D-29 (13-UI-SPEC §10.2): which notes changed each target's AI inputs since it was generated, rendered here on
   * the server and handed to the questionnaire and draft cards as slots (D-34). Strapi serves `aiInputs` to human Security
   * Analysts only, so a requesting analyst's or a refused read carries none.
   */
  const guidance = aiProposals && !aiProposals.actions.start.allowed ? panelGuidance(aiProposals.state, { formOpen: false }) : null;
  const questionnaireAiInputs = aiInputsChangedSlot({
    requestId: request.documentId,
    signal: request.aiInputs?.questionnaire,
    target: 'questionnaire',
    /* 15-UI-SPEC §9.1 (D-29; UI-D20): Suggest follow-up questions where a start is allowed, otherwise why not. */
    action: aiProposals?.actions.start.allowed
      ? <StartProposalsButton questionnaireId={aiProposals.questionnaireId} />
      : guidance ? <p className="text-xs text-foreground-secondary">{guidance.line}</p> : undefined,
  });
  const draftAiInputs = aiInputsChangedSlot({ requestId: request.documentId, signal: request.aiInputs?.assessment, target: 'draft' });
  return (
    <>
      <AssessmentDetail aiProposals={aiProposals} ownRequest={ownRequest} analystChangesSinceGeneration={analystChangesSinceGeneration} assessmentHref={assessmentHref} draftAiInputs={draftAiInputs} draftOwnerKey={ownerKey} generationJobs={generationJobs.data ?? null} jobsReadFailed={Boolean(generationJobs.error)} questionnaireAiInputs={questionnaireAiInputs} questionnaireHref={questionnaireHref} request={request} state="populated" />
      {/*
        * 14-UI-SPEC §3 (UI-D2): Files sits directly before Notes, as on the Requestor's page; nothing renders for a viewer
        * the read gave no file summary (D-18). A failed files read keeps the section with its compact error.
        */}
      {filesSection ? (
        <div className="mt-6">
          <FilesSection {...filesSection} />
        </div>
      ) : null}
      {/* 13-UI-SPEC §8 (UI-D13): Notes is the last section, after the detail; nothing renders without a notes summary (D-23). */}
      {request.notes ? (
        <div className="mt-6">
          <NotesSection attach={noteFiles.attach} authorNames={notesAuthorNames(request)} draftOwnerKey={ownerKey} filesByNote={noteFiles.byNote} requestId={request.documentId} requestNumber={request.requestNumber} summary={request.notes} viewer="analyst" />
        </div>
      ) : null}
    </>
  );
}

/*
 * The Replace confirmation states how many analyst changes a replacement discards (D-08, D-16). The count is
 * on the analyst questionnaire summary, so it is read here, on the server, only when the hub offers Replace:
 * the request is submitted and its questionnaire is still in analyst review. A failed read or a summary
 * without the count gives `null`, and the dialog then says it cannot count the changes.
 */
async function readAnalystChangesSinceGeneration(request: CsrmAssessmentRequest): Promise<number | null> {
  const questionnaire = request.relationships?.questionnaire;
  if (request.requestStatus !== 'submitted' || !questionnaire || questionnaire.availability !== 'available') return null;
  if (questionnaireGenerationAction(questionnaire) !== 'replace') return null;
  const summary = await getQuestionnaire(questionnaire.documentId);
  return summary.data?.revision?.analystChangesSinceGeneration ?? null;
}

export default function AssessmentRequestDetailPage(props: AssessmentRequestDetailPageProps) {
  return <Suspense fallback={<AssessmentDetailSkeleton />}><AssessmentRequestDetailContent {...props} /></Suspense>;
}
