import type { QuestionnaireSummary } from './questionnaire-service';

/*
 * The backward questionnaire actions each actor is offered (10-CONTEXT D-22, UI-SPEC §10.1), read from the
 * served questionnaire and its request relationship, never from the legacy nullable fields. Strapi still
 * decides every transition; these only keep the page from offering a step the server would refuse. Anything
 * the read does not establish fails closed.
 *
 * This module stays zod-free (its only imports are types) so client components can use it on zod-free routes.
 */

type RequestRelationship = QuestionnaireSummary['assessmentRequest'];

/** The request statuses in which a released questionnaire can return to analyst review (Strapi `RELEASABLE_REQUEST_STATUSES`). */
const RELEASABLE_REQUEST_STATUSES: readonly string[] = ['submitted', 'questionnaire-in-progress'];

function servedRequestStatus(relationship: RequestRelationship | undefined): string | null {
  return relationship?.availability === 'available' ? relationship.requestStatus : null;
}

/**
 * Return questionnaire to draft: the questionnaire is submitted and its request is still
 * `questionnaire-in-progress`, so no assessment has started (Strapi `questionnaire-workflow.ts`).
 */
export function canRevertQuestionnaireToDraft(questionnaire: Pick<QuestionnaireSummary, 'state' | 'assessmentRequest'>): boolean {
  return questionnaire.state === 'submitted' && servedRequestStatus(questionnaire.assessmentRequest) === 'questionnaire-in-progress';
}

/**
 * Return to analyst review: the questionnaire has been released and no assessment exists yet, so its
 * request is `submitted` or `questionnaire-in-progress`.
 */
export function canReturnToAnalystReview(questionnaire: Pick<QuestionnaireSummary, 'release' | 'assessmentRequest'>): boolean {
  const status = servedRequestStatus(questionnaire.assessmentRequest);
  return questionnaire.release != null && status !== null && RELEASABLE_REQUEST_STATUSES.includes(status);
}

export type SubmittedNoticeVariant = 'requestor-revertible' | 'requestor-locked' | 'analyst';

/**
 * Which submitted notice a page shows (UI-SPEC §8.2). The notice only renders once the questionnaire is
 * submitted, so the Requestor's variant reads the rule as it applies to the submitted questionnaire: a page
 * whose props still describe the draft (an in-page submit before the refreshed read) already gets the
 * notice its next render will show.
 */
export function submittedNoticeVariant(
  actor: 'requestor' | 'analyst',
  questionnaire: Pick<QuestionnaireSummary, 'assessmentRequest'>,
): SubmittedNoticeVariant {
  if (actor === 'analyst') return 'analyst';
  return canRevertQuestionnaireToDraft({ state: 'submitted', assessmentRequest: questionnaire.assessmentRequest })
    ? 'requestor-revertible'
    : 'requestor-locked';
}
