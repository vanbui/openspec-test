/**
 * The closed vocabulary of refusal reasons CSRM names in `error.details.reason`: a workflow conflict (409), an
 * identity-relative refusal (403, Phase 13's OWN_REQUEST), since Phase 14 the request attachment refusals, and since
 * the stage B amendment one retryable 503 (ATTACHMENT_BUSY).
 *
 * Each code names the one rule that refused the operation, and no more than the relationship state
 * the caller is already served: `REQUEST_WORK_STARTED` says that work has started, never which work,
 * because a Requestor sees an unreleased questionnaire or an assessment only as `unavailable`.
 *
 * Phase 14's statuses (D-04 item 10, D-11; 14-RESEARCH Settled 8):
 * - 400 `ATTACHMENT_EMPTY`;
 * - 403 `NOT_UPLOADER`, `NOT_REMOVER`;
 * - 409 `ATTACHMENTS_NOT_CONFIGURED`, `ATTACHMENTS_CLOSED`, `ATTACHMENT_NOTE_REQUIRED`, `ATTACHMENT_NOTE_INVALID`,
 *   `ATTACHMENT_LIMIT_REACHED`, `ATTACHMENT_LIFETIME_LIMIT_REACHED`, `ATTACHMENT_QUARANTINED`, `ATTACHMENT_BLOCKED`,
 *   `ATTACHMENT_REMOVED`, `ATTACHMENT_UNAVAILABLE`, `ATTACHMENT_INTEGRITY_FAILED`, `ATTACHMENT_TEXT_UNAVAILABLE`,
 *   `ATTACHMENT_NOT_TEXT_BEARING`, `REQUEST_HAS_ATTACHMENTS`;
 * - 413 `ATTACHMENT_TOO_LARGE`;
 * - 415 `ATTACHMENT_TYPE_NOT_ALLOWED`, `ATTACHMENT_CONTENT_MISMATCH`, `ATTACHMENT_MACRO_ENABLED`, `ATTACHMENT_ENCRYPTED`,
 *   `ATTACHMENT_LEGACY_OFFICE`, and since the stage B amendment (2026-10-11) `ATTACHMENT_UNSUPPORTED_STRUCTURE` (a ZIP
 *   structure CSRM will not read: an archive comment, a bound, ZIP64 or an unusual method; IN-202) and
 *   `ATTACHMENT_ACTIVE_CONTENT` (Office active content beyond macros; WR-205);
 * - 422 `ATTACHMENT_MALWARE_FOUND`, the only reason served with a `detection` name beside it;
 * - 503 `ATTACHMENT_BUSY` (the stage B amendment; WR-204): the screening or extraction queue is full, so the upload or
 *   the AI inclusion is refused at once and may be retried. It is the only reason a 5xx carries.
 *
 * Phase 15's statuses: 400 `INSTRUCTION_TOO_LONG`, `INSTRUCTION_CHARACTERS_NOT_ALLOWED`, `INSTRUCTION_REPEATS_REQUESTOR_TEXT`;
 * 409 for its other nine.
 *
 * Phase 16's statuses (D-03 item 10): 409 for all four, `RISK_WITHDRAWN`, `RISK_NOT_WITHDRAWN`, `AI_ACCEPT_NOT_PERMITTED`
 * and `REQUEST_HAS_ASSESSMENT`, and 409 for the code review amendment's `RISK_CURATION_UNDO_UNAVAILABLE`.
 *
 * Phase 19's statuses (D-03 group 4): 422 `EXPORT_ROW_LIMIT`, the only reason served with `rowCount` and `rowCap` beside
 * it; 422 `EXPORT_CELL_TOO_LONG` (the review amendment, 2026-10-17), the only one served with `column` and `cellLimit`;
 * 409 `ASSESSMENT_NOT_RELEASED`, `IMPORT_DECISION_MISSING` and `IMPORT_REVIEW_EXPIRED`; 415 `IMPORT_FILE_TYPE`;
 * 413 `IMPORT_FILE_TOO_LARGE`; 422 for the other thirteen import file refusals, and 422 `IMPORT_CSV_MALFORMED` (the
 * import record's Phase 19 execution amendment, 2026-10-17). Only an `IMPORT_` reason is served with the closed `found`
 * details beside it, and `found.line` only beside `IMPORT_CSV_MALFORMED`.
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
  "ASSESSMENT_NOT_MUTABLE",
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
  "AI_CLASSIFICATION_ABOVE_CEILING",
  "AI_POLICY_NOT_CONFIGURED",
  "AI_PROPOSAL_ALREADY_DECIDED",
  "AI_SUGGESTION_CONTROL_CHANGED",
  "AI_ACCEPT_WITH_PLANNED_CONTROL",
  // WR-103: the run's decision history can't take the record of a decision or an AI field edit, so it is refused.
  "AI_RUN_RECORD_UNAVAILABLE",
  /*
   * Phase 13 (D-05 to D-08, G-1): the request assignment refusals. The list also covers 403 identity refusals
   * (2026-10-01 confirmation): OWN_REQUEST refuses an analyst every assignment action on a request they raised,
   * which no reload or state change resolves, so it stays a 403.
   */
  "OWN_REQUEST",
  "ASSIGNMENT_CHANGED",
  "ASSIGNEE_NOT_ELIGIBLE",
  "ASSIGNMENT_REQUIRED",
  // Phase 13 (D-21, D-22): a request that takes no new note now, and a request at its 500-note limit.
  "NOTES_CLOSED",
  "NOTES_LIMIT_REACHED",
  // Phase 13 (D-21): a request that holds a note is never deleted, so no note is orphaned.
  "REQUEST_HAS_NOTES",
  /*
   * Phase 13 (D-20, O-5): only a request's own requestor submits it. An analyst may amend another person's draft but
   * never attest it; like OWN_REQUEST this is an identity-relative refusal that no reload resolves, so it is a 403.
   */
  "NOT_REQUEST_REQUESTOR",
  // Phase 14 (D-04 item 10, D-11): the request attachment refusals, with the statuses listed in the module comment.
  "ATTACHMENTS_NOT_CONFIGURED",
  "ATTACHMENTS_CLOSED",
  "ATTACHMENT_NOTE_REQUIRED",
  "ATTACHMENT_NOTE_INVALID",
  "ATTACHMENT_LIMIT_REACHED",
  "ATTACHMENT_LIFETIME_LIMIT_REACHED",
  "ATTACHMENT_QUARANTINED",
  "ATTACHMENT_BLOCKED",
  "ATTACHMENT_REMOVED",
  "ATTACHMENT_UNAVAILABLE",
  "ATTACHMENT_INTEGRITY_FAILED",
  "ATTACHMENT_TEXT_UNAVAILABLE",
  "ATTACHMENT_NOT_TEXT_BEARING",
  // A request that holds any file, removed and blocked ones included, is never deleted (beside REQUEST_HAS_NOTES).
  "REQUEST_HAS_ATTACHMENTS",
  "ATTACHMENT_TOO_LARGE",
  "ATTACHMENT_EMPTY",
  "ATTACHMENT_TYPE_NOT_ALLOWED",
  "ATTACHMENT_CONTENT_MISMATCH",
  "ATTACHMENT_MACRO_ENABLED",
  "ATTACHMENT_ENCRYPTED",
  "ATTACHMENT_LEGACY_OFFICE",
  "ATTACHMENT_MALWARE_FOUND",
  // Identity-relative 403s like OWN_REQUEST: only the uploader (or an analyst) removes, only the remover restores.
  "NOT_UPLOADER",
  "NOT_REMOVER",
  // The stage B amendment (2026-10-11; 14-PILOT-RULINGS.md, contract item 5): two 415s and the retryable 503.
  "ATTACHMENT_UNSUPPORTED_STRUCTURE",
  "ATTACHMENT_ACTIVE_CONTENT",
  "ATTACHMENT_BUSY",
  /*
   * Phase 15 (D-03 item 9; the run record's Phase 15 amendment, "Closed reasons"): the AI proposal and gate refusals
   * (409) and, after QUESTIONNAIRE_ANSWERED, the instruction refusals (400). QUESTIONNAIRE_ANSWERED was a generation job
   * failure code only; a replacement of an answered questionnaire is now refused at enqueue too (Q-1).
   */
  "AI_PROPOSALS_OPEN",
  "AI_PROPOSAL_STALE",
  "QUESTIONNAIRE_HAS_ANALYST_CHANGES",
  "QUESTION_ANSWERED",
  "ASSESSMENT_DRAFT_IN_PROGRESS",
  "AI_PROPOSAL_RUN_LIMIT",
  "AI_PROPOSAL_UNDO_UNAVAILABLE",
  "ANSWERED_QUESTION_AFFECTED",
  "QUESTIONNAIRE_ANSWERED",
  "INSTRUCTION_TOO_LONG",
  "INSTRUCTION_CHARACTERS_NOT_ALLOWED",
  "INSTRUCTION_REPEATS_REQUESTOR_TEXT",
  /*
   * Phase 16 (D-03 item 10; the approved record "Operations, Functions and Reasons" and the Phase 12 record's Phase 16
   * amendment): the risk curation refusals, all 409s, added in one contract change ahead of the plans that throw them.
   * A mutation, decision or rewrite that targets a withdrawn Risk; a reinstatement whose Risks are all active; an
   * AI-proposed Accept that would leave the residual rating High or Critical (D-38); the delete of a request that holds a
   * Risk Assessment (checked before REQUEST_HAS_NOTES and REQUEST_HAS_ATTACHMENTS).
   */
  "RISK_WITHDRAWN",
  "RISK_NOT_WITHDRAWN",
  "AI_ACCEPT_NOT_PERMITTED",
  "REQUEST_HAS_ASSESSMENT",
  /*
   * The Phase 16 code review amendment (2026-10-16; 16-REVIEW BE1-03), a 409: a withdrawal or reinstatement Undo of a
   * Risk whose latest act is not the acting analyst's own withdrawal or reinstatement refuses the whole batch.
   */
  "RISK_CURATION_UNDO_UNAVAILABLE",
  /*
   * Phase 19 (D-03 group 4; the approved records "Exports and the Export Log" and "Import Tolerance"): the export and
   * import refusals, added in one contract change ahead of the plans that throw them. An export over the row cap is a
   * 422 served with `rowCount` and `rowCap` beside it (D-16, D-17). An unreleased assessment the analyst can read is
   * a 409, one code Phase 17 D-29 reuses for a participant's export before release (D-15).
   */
  "EXPORT_ROW_LIMIT",
  "ASSESSMENT_NOT_RELEASED",
  /*
   * The Phase 19 review amendment (2026-10-17, G-6; BE1-02): an xlsx export whose text cell, as written, is longer than
   * Excel's 32,767-character limit is a 422 served with `column` (the column key) and `cellLimit` beside it. CSV is
   * written whole.
   */
  "EXPORT_CELL_TOO_LONG",
  /*
   * The import file refusals (D-25 to D-27; the import record's "File Refusals"): one code per file CSRM will not read,
   * each served with the closed `found` details where the record names them, and worded as fix-it copy by the web.
   */
  "IMPORT_FILE_TYPE",
  "IMPORT_FILE_TOO_LARGE",
  "IMPORT_TOO_MANY_ROWS",
  "IMPORT_ENCODING_WINDOWS_1252",
  "IMPORT_ENCODING_UTF16",
  "IMPORT_ENCODING_UNKNOWN",
  "IMPORT_DELIMITER",
  "IMPORT_LEGACY_XLS",
  "IMPORT_MACRO_WORKBOOK",
  "IMPORT_ENCRYPTED_WORKBOOK",
  "IMPORT_WORKBOOK_TOO_LARGE",
  "IMPORT_NO_HEADER",
  "IMPORT_NO_ROWS",
  "IMPORT_DUPLICATE_HEADER",
  "IMPORT_MISSING_COLUMN",
  /* The import commit's refusals (D-30): a `similar` row without a decision, and an expired or unknown review. */
  "IMPORT_DECISION_MISSING",
  "IMPORT_REVIEW_EXPIRED",
  /*
   * The import record's Phase 19 execution amendment (2026-10-17, G-6): a `.csv` whose UTF-8 text the CSV parser
   * refuses (an unclosed quote, an invalid closing quote, a record whose field count differs from the header's) is a
   * 422 served with `found.line`, the 1-based source line, when the parser reports one.
   */
  "IMPORT_CSV_MALFORMED",
] as const);

export type ConflictReason = (typeof CONFLICT_REASONS)[number];

/** The `details` argument of a conflict response: the reason when one is known, nothing otherwise. */
export function conflictDetails(reason: ConflictReason | undefined): { reason: ConflictReason } | undefined {
  return reason ? { reason } : undefined;
}
