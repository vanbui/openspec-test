/**
 * The closed vocabulary of reasons a CSRM workflow conflict (409) names in `error.details.reason`.
 *
 * It mirrors the list Strapi raises (`apps/backend/src/csrm/conflict-reasons.ts`) and both conflict
 * response schemas of `docs/references/specification.json`; `conflict-reasons.test.ts` proves they
 * are one list. Plain and import-free so the transport, Server Actions and client copy can share it.
 */
export const CONFLICT_REASONS = Object.freeze([
  'REQUEST_NOT_SUBMITTED',
  'REQUEST_WORK_STARTED',
  'REQUEST_NOT_ELIGIBLE',
  'ASSESSMENT_STARTED',
  'QUESTIONNAIRE_NOT_SUBMITTED',
  'QUESTIONNAIRE_NOT_ANSWERABLE',
  'QUESTIONNAIRE_ALREADY_SUBMITTED',
  'QUESTIONNAIRE_INCOMPLETE',
  'QUESTIONNAIRE_HAS_NO_QUESTIONS',
  'QUESTIONNAIRE_RELEASED',
  'ALREADY_IN_ANALYST_REVIEW',
  'DEFINITION_INVALID',
  'DEFINITION_CONFLICT',
  'HISTORY_UNAVAILABLE',
  'QUESTION_REMOVED',
  'QUESTION_HAS_DEPENDENTS',
  'LAST_ACTIVE_QUESTION',
  'ANSWER_DATA_INVALID',
] as const);

export type ConflictReason = (typeof CONFLICT_REASONS)[number];

const conflictReasons: ReadonlySet<string> = new Set(CONFLICT_REASONS);

/** True only for a value in the closed list; anything else a response carries is not a reason. */
export function isConflictReason(value: unknown): value is ConflictReason {
  return typeof value === 'string' && conflictReasons.has(value);
}
