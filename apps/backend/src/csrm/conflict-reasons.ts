/**
 * The closed vocabulary of reasons a CSRM workflow conflict (409) names in `error.details.reason`.
 *
 * Each code names the one rule that refused the operation, and no more than the relationship state
 * the caller is already served: `REQUEST_WORK_STARTED` says that work has started, never which work,
 * because a Requestor sees an unreleased questionnaire or an assessment only as `unavailable`.
 *
 * The same list is declared in both conflict response schemas of `docs/references/specification.json`
 * and in the web's `apps/csrm/src/lib/api/conflict-reasons.ts`; `tests/conflict-reasons.unit.test.ts`
 * proves the three are one list. Adding, renaming or removing a code is a contract change in all three.
 */
export const CONFLICT_REASONS = Object.freeze([
  "REQUEST_NOT_SUBMITTED",
  "REQUEST_WORK_STARTED",
  "REQUEST_NOT_ELIGIBLE",
  "ASSESSMENT_STARTED",
  "QUESTIONNAIRE_NOT_SUBMITTED",
  "QUESTIONNAIRE_NOT_ANSWERABLE",
  "QUESTIONNAIRE_ALREADY_SUBMITTED",
  "QUESTIONNAIRE_INCOMPLETE",
  "QUESTIONNAIRE_HAS_NO_QUESTIONS",
  "QUESTIONNAIRE_RELEASED",
  "ALREADY_IN_ANALYST_REVIEW",
  "DEFINITION_INVALID",
  "DEFINITION_CONFLICT",
  "HISTORY_UNAVAILABLE",
  "QUESTION_REMOVED",
  "QUESTION_HAS_DEPENDENTS",
  "LAST_ACTIVE_QUESTION",
  "ANSWER_DATA_INVALID",
] as const);

export type ConflictReason = (typeof CONFLICT_REASONS)[number];

/** The `details` argument of a conflict response: the reason when one is known, nothing otherwise. */
export function conflictDetails(reason: ConflictReason | undefined): { reason: ConflictReason } | undefined {
  return reason ? { reason } : undefined;
}
