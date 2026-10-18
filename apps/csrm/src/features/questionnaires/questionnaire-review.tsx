'use client';

import { AlertCircle, Clock3 } from 'lucide-react';
import { RevertAuditSummary } from '@/components/csrm/revert-audit-summary';
import { RecordLink } from '@/components/csrm/record-link';
import { useRouter } from 'next/navigation';
import { useId, useState, type ReactNode } from 'react';

import type { AiProvenanceHeaderProps } from '@/features/ai-assistance/ai-provenance-domain';
// This page spaces its blocks with a 24px bottom margin (the direction's section rhythm, §3.9); the header keeps it (walk D6).
import { AiProvenanceHeader } from '@/features/ai-assistance/ai-provenance-header';

import { PageHeader } from '@/components/csrm/page-header';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button, buttonVariants } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import Link from 'next/link';
import type { QuestionPlacement } from './questionnaire-placement';
import type { QuestionnaireDefinition } from './questionnaire-schema';
import type { QuestionnaireSummary } from './questionnaire-service';
// The read-only answers, not the Requestor's form: this review validates nothing, so it downloads no zod.
import { SubmittedQuestionnaireAnswers, submittedRowAnswered } from './questionnaire-submitted-answers';
import { ConfirmDialog } from '@/components/csrm/confirm-dialog';
import { revertQuestionnaireToDraftAction } from './questionnaire-actions';
import { availableAssessmentRequest } from './questionnaire-domain';
import dynamic from 'next/dynamic';
import type { QuestionRowAiFacts } from '@/features/questionnaire-ai/questionnaire-ai-domain';
import { QuestionFormScope, QuestionnaireGovernance, ReleasedQuestionList } from './questionnaire-governance';
import type { QuestionnaireQuestion } from './questionnaire-schema';
import { QuestionnaireRevisionTimeline, type ProposalAnchors } from './questionnaire-revision-timeline';
import type { AnalystRefusal } from '@/features/assessments/assessment-detail';
import { canRevertQuestionnaireToDraft } from './questionnaire-workflow-rules';

/* Phase 15 D-35: a question row's AI parts load on demand, so the review's first load carries none of their code. */
const QuestionAiRowExtras = dynamic(() => import('@/features/questionnaire-ai/question-rewrite-control').then((module) => module.QuestionAiRowExtras));

export type QuestionnaireReviewState = 'submitted' | 'analyst-review' | 'awaiting-submission' | 'empty' | 'error' | 'permission';

export interface QuestionnaireReviewProps {
  /**
   * Phase 15 D-33 (15-UI-SPEC §1): the AI proposals panel, rendered on the server by the page and placed directly after
   * the provenance header. A slot, so this client view carries none of its code.
   */
  aiProposals?: ReactNode;
  /**
   * Phase 15 (15-UI-SPEC §4.7, §6, §7.1): what the question rows need from the proposals read, and the draft owner key the
   * rewrite's instruction is kept under. Null facts (a requesting analyst, or a failed read) add nothing to the rows.
   */
  questionAi?: { facts: QuestionRowAiFacts | null; ownerKey: string | null };
  /** Phase 15 (15-UI-SPEC §8.1): the open proposals and active job the release control waits for; absent before Phase 15's read. */
  releaseGate?: { openCount: number | null; activeJob: boolean };
  /** The proposal groups and cards the panel lists, by anchor, so timeline entries can link to them (15-03). */
  proposalAnchors?: { runs: readonly string[]; items: readonly string[] };
  /**
   * Phase 13 D-29 (13-UI-SPEC §10.2): the "AI inputs changed" block, rendered on the server by the page and handed to the
   * provenance header as its last block. A slot, so this client view carries none of its code.
   */
  aiInputsChanged?: ReactNode;
  assessmentRequestHref?: string;
  /** The AI provenance header's props (12-UI-SPEC §1), derived on the server and rendered in this client tree. */
  provenance?: AiProvenanceHeaderProps | null;
  definition?: QuestionnaireDefinition;
  /** Where every question sits, removed ones included, so the editor can place an added question (D-05). */
  placements?: readonly QuestionPlacement[];
  questionnaire?: QuestionnaireSummary;
  /** Who a permission state is for: `role` when the route gate refused the viewer before any read (UI-SPEC §11.1). */
  refusal?: AnalystRefusal;
  /**
   * Phase 13 D-16, D-25 (13-UI-SPEC §11): who holds the request and its notes figure, rendered on the server by the page and
   * set under the request link. A slot, so this client view carries none of its code.
   */
  requestContext?: ReactNode;
  state: QuestionnaireReviewState;
}

function SafeReviewState({ aiInputsChanged, aiProposals, assessmentRequestHref, definition = [], placements = [], proposalAnchors, provenance, questionnaire, refusal = 'record', requestContext, state }: Pick<QuestionnaireReviewProps, 'aiInputsChanged' | 'aiProposals' | 'assessmentRequestHref' | 'placements' | 'proposalAnchors' | 'provenance' | 'refusal' | 'requestContext'> & { definition?: QuestionnaireDefinition; questionnaire?: QuestionnaireSummary; state: Exclude<QuestionnaireReviewState, 'submitted' | 'analyst-review'> }) {
  const roleRefusal = state === 'permission' && refusal === 'role';
  const content = (() => {
  if (state === 'permission') {
    const description = roleRefusal
      ? 'Reviewing questionnaires is for Security Analysts. To answer a questionnaire sent to you, open it from My questionnaires.'
      : 'You can’t review this questionnaire with your current access. Choose another from the questionnaire reviews.';
    return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>You don’t have permission to review this questionnaire</AlertTitle><AlertDescription>{description}</AlertDescription></Alert>;
  }
  if (state === 'error') {
    return <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>We couldn’t load this questionnaire review</AlertTitle><AlertDescription>Try again. If the problem continues, contact your administrator.</AlertDescription></Alert>;
  }
  if (state === 'awaiting-submission') {
    return <Alert><Clock3 aria-hidden="true" /><AlertTitle>Awaiting questionnaire submission</AlertTitle><AlertDescription>The Requestor’s answers stay private until they submit the questionnaire. Their progress is shown below.</AlertDescription></Alert>;
  }
  return <Alert><AlertCircle aria-hidden="true" /><AlertTitle>No submitted answers are available</AlertTitle><AlertDescription>This questionnaire does not contain a complete submitted response.</AlertDescription></Alert>;
  })();
  /*
   * The awaiting-submission state is an authorised read of a questionnaire that simply
   * has no submitted answers yet, so name it: the number and its request are
   * metadata the review list already shows, and an analyst who has just
   * generated a questionnaire needs to see which one this is. Every other safe
   * state deliberately discards whatever was supplied, so those keep the
   * generic heading and reveal nothing about the record.
   */
  /*
   * A released questionnaire the Requestor has not submitted is still governable:
   * returning it to analyst review is the only way to correct its questions, and
   * withholding that control here left the Analyst with no route back (D-15).
   */
  const governable = state === 'awaiting-submission' && questionnaire && definition.length > 0 ? questionnaire : null;
  const identify = state === 'awaiting-submission' && questionnaire;
  const heading = identify
    ? { title: questionnaire.title, description: `${questionnaire.questionnaireNumber} · ${availableAssessmentRequest(questionnaire.assessmentRequest)?.requestNumber ?? ''}` }
    : { title: 'Questionnaire review', description: 'Review an authorised questionnaire submission.' };
  return <QuestionFormScope><PageHeader status={identify ? <StatusBadge family="questionnaire" value={identify.state} /> : undefined} title={heading.title} description={heading.description} />{identify ? <QuestionnaireRequestRelationship assessmentRequestHref={assessmentRequestHref} questionnaire={identify} requestContext={requestContext} /> : null}{identify && provenance ? <AiProvenanceHeader aiInputsChanged={aiInputsChanged} className="mb-6" {...provenance} /> : null}{identify ? aiProposals : null}{governable ? <QuestionnaireGovernance definition={definition} placements={placements} questionnaire={governable} /> : null}{content}{governable ? <ReleasedQuestions definition={definition} progress={governable.progress} /> : null}<RevertAuditSummary className="my-6" facts={questionnaire ?? {}} />{questionnaire ? <QuestionnaireRevisionTimeline depth="detail" proposalAnchors={anchorSets(proposalAnchors)} questionnaire={questionnaire} /> : null}{roleRefusal ? <Link className={buttonVariants({ variant: 'outline' })} href="/app/questionnaires">Go to My questionnaires</Link> : <Link className={buttonVariants({ variant: 'outline' })} href="/app/review/questionnaires">Back to questionnaire reviews</Link>}</QuestionFormScope>;
}

export function QuestionnaireReview({ aiInputsChanged, aiProposals, assessmentRequestHref, questionAi, releaseGate, definition = [], placements = [], proposalAnchors, provenance, questionnaire, refusal, requestContext, state }: QuestionnaireReviewProps) {
  if (state === 'analyst-review' && questionnaire) {
    if (definition.length === 0) return <SafeReviewState assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} state="empty" />;
    /*
     * The governance question editor is the single list of questions here (D-32): an unreleased
     * questionnaire has no answers to show, and the read-only renderer would repeat every question
     * under a Submitted notice that is untrue before release.
     */
    return <QuestionFormScope><PageHeader status={<StatusBadge family="questionnaire" value="analyst-review" />} description={questionnaire.questionnaireNumber} title={questionnaire.title} /><QuestionnaireRequestRelationship assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} requestContext={requestContext} />{provenance ? <AiProvenanceHeader aiInputsChanged={aiInputsChanged} className="mb-6" {...provenance} /> : null}{aiProposals}<QuestionnaireGovernance definition={definition} placements={placements} questionnaire={questionnaire} releaseGate={releaseGate} rowExtras={rowExtrasFor(questionAi, questionnaire.documentId)} /><QuestionnaireRevisionTimeline depth="detail" proposalAnchors={anchorSets(proposalAnchors)} questionnaire={questionnaire} /></QuestionFormScope>;
  }
  if (state !== 'submitted' || !questionnaire || questionnaire.state !== 'submitted') {
    return <SafeReviewState aiInputsChanged={aiInputsChanged} aiProposals={aiProposals} assessmentRequestHref={assessmentRequestHref} definition={definition} placements={placements} proposalAnchors={proposalAnchors} provenance={provenance} questionnaire={questionnaire} refusal={refusal} requestContext={requestContext} state={state === 'submitted' || state === 'analyst-review' ? 'empty' : state} />;
  }
  if (definition.length === 0) return <SafeReviewState assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} state="empty" />;

  return (
    <QuestionFormScope>
      <PageHeader
        status={<StatusBadge family="questionnaire" value="submitted" />}
        description={questionnaire.questionnaireNumber}
        title={questionnaire.title}
      />
      <QuestionnaireRequestRelationship assessmentRequestHref={assessmentRequestHref} questionnaire={questionnaire} requestContext={requestContext} />
      {provenance ? <AiProvenanceHeader aiInputsChanged={aiInputsChanged} className="mb-6" {...provenance} /> : null}
      {/*
        * Two backward transitions can apply to a submitted questionnaire: the
        * Phase 06.1 reversal that hands the answers back to the Requestor, and
        * the governance return that takes the questionnaire back for question
        * editing. The established reversal keeps its position as the first
        * action on this screen; the AI proposals panel (Phase 15 D-33) and the
        * governance panel follow it.
        */}
      {canRevertQuestionnaireToDraft(questionnaire) ? <AnalystQuestionnaireRevert documentId={questionnaire.documentId} /> : null}
      {aiProposals}
      <QuestionnaireGovernance definition={definition} placements={placements} questionnaire={questionnaire} />
      {questionnaire.description ? <p className="mb-6 max-w-3xl text-sm text-muted-foreground">{questionnaire.description}</p> : null}
      <QuestionnaireRevisionTimeline depth="detail" proposalAnchors={anchorSets(proposalAnchors)} questionnaire={questionnaire} />
      <SubmittedQuestionnaireAnswers definition={definition} questionExtras={rowExtrasFor(questionAi, questionnaire.documentId, true)} submittedNotice="analyst" />
    </QuestionFormScope>
  );
}

/* §4.7, §6, §7.1: a question row's AI parts, from the read's facts; none without them. */
function rowExtrasFor(questionAi: QuestionnaireReviewProps['questionAi'], questionnaireId: string, withAnsweredNote = false): ((question: QuestionnaireQuestion) => ReactNode) | undefined {
  if (!questionAi) return undefined;
  return (question) => <QuestionAiRowExtras facts={questionAi.facts} ownerKey={questionAi.ownerKey} question={{ id: question.documentId ?? question.questionKey, text: question.questionText, answered: withAnsweredNote ? submittedRowAnswered(question) : question.answered }} questionnaireId={questionnaireId} withAnsweredNote={withAnsweredNote} />;
}

/* The panel's anchors as the timeline reads them (15-03): sets, built here because a slot's props cross as plain arrays. */
function anchorSets(anchors: QuestionnaireReviewProps['proposalAnchors']): ProposalAnchors | undefined {
  return anchors ? { runs: new Set(anchors.runs), items: new Set(anchors.items) } : undefined;
}

/*
 * What the analyst sees while the Requestor answers (D-07, UI-SPEC §2): the released questions and the served
 * answered count. Only that aggregate crosses before submission; no answer, checked state or per-question count.
 */
function ReleasedQuestions({ definition, progress }: { definition: QuestionnaireDefinition; progress: QuestionnaireSummary['progress'] }) {
  const headingId = useId();
  const answered = `${progress.answered} of ${progress.total}`;
  return (
    <section aria-labelledby={headingId} className="mt-6 grid gap-4 rounded-xl border border-border bg-card p-4">
      <h2 className="text-heading-sm text-foreground" id={headingId}>Released questions</h2>
      <div className="grid gap-2">
        <p className="text-sm font-medium tabular-nums text-foreground">{`${answered} answered`}</p>
        <Progress aria-label={`${answered} questions answered by the Requestor`} aria-valuemax={100} aria-valuemin={0} aria-valuenow={progress.percent} value={progress.percent} />
      </div>
      <ReleasedQuestionList definition={definition} />
    </section>
  );
}

function QuestionnaireRequestRelationship({ assessmentRequestHref, questionnaire, requestContext }: Pick<QuestionnaireReviewProps, 'assessmentRequestHref' | 'requestContext'> & { questionnaire: QuestionnaireSummary }) {
  const request = availableAssessmentRequest(questionnaire.assessmentRequest);
  if (questionnaire.assessmentRequest.availability === 'absent') {
    return <p className="mb-6 text-sm text-muted-foreground">No assessment request is linked to this questionnaire.</p>;
  }
  if (!request || !assessmentRequestHref) return null;

  return (
    <div className="mb-6">
      <RecordLink
        className="inline-flex min-h-11 items-center font-medium text-foreground underline underline-offset-4 hover:underline focus-visible:rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        href={assessmentRequestHref}
      >
        Assessment request {request.requestNumber}
      </RecordLink>
      {requestContext}
    </div>
  );
}

function AnalystQuestionnaireRevert({ documentId }: { documentId: string }) {
  const router = useRouter(); const [error, setError] = useState<string | null>(null);
  async function revert(reason?: string) { const result = await revertQuestionnaireToDraftAction({ documentId, reason }); if (!result.ok) { setError(result.formError ?? 'The questionnaire could not be reverted.'); throw new Error('Questionnaire revert failed'); } router.refresh(); }
  return <div className="mb-4"><ConfirmDialog confirmLabel="Return questionnaire to draft" confirmVariant="destructive" description="The Requestor’s answers go back to draft so they can change them and submit again. Their answers are kept." errorMessage={error} onConfirm={revert} pendingLabel="Returning questionnaire to draft…" reasonRequired title="Return this questionnaire to draft?" trigger={<Button type="button">Return to draft</Button>} /></div>;
}
