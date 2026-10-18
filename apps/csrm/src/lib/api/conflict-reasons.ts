/**
 * The closed vocabulary of refusal reasons CSRM names in `error.details.reason`: a workflow conflict (409), an
 * identity-relative refusal (403), since Phase 14 the request attachment refusals (400, 403, 409, 413, 415, 422), and
 * since the stage B amendment (2026-10-11) the one retryable 503, ATTACHMENT_BUSY, since Phase 15 the AI proposal,
 * gate (409) and instruction (400) refusals, and since Phase 16 the risk curation refusals (409).
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
  'ASSESSMENT_NOT_MUTABLE',
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
  'AI_CLASSIFICATION_ABOVE_CEILING',
  'AI_POLICY_NOT_CONFIGURED',
  'AI_PROPOSAL_ALREADY_DECIDED',
  'AI_SUGGESTION_CONTROL_CHANGED',
  'AI_ACCEPT_WITH_PLANNED_CONTROL',
  'AI_RUN_RECORD_UNAVAILABLE',
  // Phase 13 (D-05 to D-08, G-1): the request assignment refusals. The list also covers 403 identity refusals
  // (2026-10-01 confirmation): OWN_REQUEST stays a 403, because no reload or state change resolves it.
  'OWN_REQUEST',
  'ASSIGNMENT_CHANGED',
  'ASSIGNEE_NOT_ELIGIBLE',
  'ASSIGNMENT_REQUIRED',
  // Phase 13 (D-21, D-22): a request that takes no new note now, and a request at its 500-note limit.
  'NOTES_CLOSED',
  'NOTES_LIMIT_REACHED',
  // Phase 13 (D-21): a request that holds a note is never deleted. D-20 (O-5): only a request's own requestor submits
  // it, a 403 identity refusal like OWN_REQUEST.
  'REQUEST_HAS_NOTES',
  'NOT_REQUEST_REQUESTOR',
  // Phase 14 (D-04 item 10, D-11): the request attachment refusals. Their statuses are 400 (ATTACHMENT_EMPTY), 403
  // (NOT_UPLOADER, NOT_REMOVER), 413 (ATTACHMENT_TOO_LARGE), 415 (the type and content refusals), 422
  // (ATTACHMENT_MALWARE_FOUND, served with a detection name) and 409 for the rest; Strapi's list documents them.
  'ATTACHMENTS_NOT_CONFIGURED',
  'ATTACHMENTS_CLOSED',
  'ATTACHMENT_NOTE_REQUIRED',
  'ATTACHMENT_NOTE_INVALID',
  'ATTACHMENT_LIMIT_REACHED',
  'ATTACHMENT_LIFETIME_LIMIT_REACHED',
  'ATTACHMENT_QUARANTINED',
  'ATTACHMENT_BLOCKED',
  'ATTACHMENT_REMOVED',
  'ATTACHMENT_UNAVAILABLE',
  'ATTACHMENT_INTEGRITY_FAILED',
  'ATTACHMENT_TEXT_UNAVAILABLE',
  'ATTACHMENT_NOT_TEXT_BEARING',
  'REQUEST_HAS_ATTACHMENTS',
  'ATTACHMENT_TOO_LARGE',
  'ATTACHMENT_EMPTY',
  'ATTACHMENT_TYPE_NOT_ALLOWED',
  'ATTACHMENT_CONTENT_MISMATCH',
  'ATTACHMENT_MACRO_ENABLED',
  'ATTACHMENT_ENCRYPTED',
  'ATTACHMENT_LEGACY_OFFICE',
  'ATTACHMENT_MALWARE_FOUND',
  'NOT_UPLOADER',
  'NOT_REMOVER',
  // The stage B amendment (2026-10-11, contract item 5): a ZIP structure CSRM will not read (415, IN-202), Office active
  // content beyond macros (415, WR-205) and a full screening or extraction queue (503, retryable, WR-204).
  'ATTACHMENT_UNSUPPORTED_STRUCTURE',
  'ATTACHMENT_ACTIVE_CONTENT',
  'ATTACHMENT_BUSY',
  /*
   * Phase 15 (D-03 item 9; the run record's Phase 15 amendment, "Closed reasons"): the AI proposal and gate refusals
   * (409) and, after QUESTIONNAIRE_ANSWERED, the instruction refusals (400). QUESTIONNAIRE_ANSWERED was a generation job
   * failure code only; a replacement of an answered questionnaire is now refused at enqueue too (Q-1).
   */
  'AI_PROPOSALS_OPEN',
  'AI_PROPOSAL_STALE',
  'QUESTIONNAIRE_HAS_ANALYST_CHANGES',
  'QUESTION_ANSWERED',
  'ASSESSMENT_DRAFT_IN_PROGRESS',
  'AI_PROPOSAL_RUN_LIMIT',
  'AI_PROPOSAL_UNDO_UNAVAILABLE',
  'ANSWERED_QUESTION_AFFECTED',
  'QUESTIONNAIRE_ANSWERED',
  'INSTRUCTION_TOO_LONG',
  'INSTRUCTION_CHARACTERS_NOT_ALLOWED',
  'INSTRUCTION_REPEATS_REQUESTOR_TEXT',
  // Phase 16 (D-03 item 10): the risk curation refusals, all 409s. A withdrawn Risk is read-only until reinstated; a
  // reinstatement whose Risks are all active; an AI-proposed Accept the residual rating forbids (D-38); a request that
  // holds a Risk Assessment is never deleted.
  'RISK_WITHDRAWN',
  'RISK_NOT_WITHDRAWN',
  'AI_ACCEPT_NOT_PERMITTED',
  'REQUEST_HAS_ASSESSMENT',
  // The Phase 16 code review amendment (2026-10-16, BE1-03): an Undo that is no longer the analyst's own latest act.
  'RISK_CURATION_UNDO_UNAVAILABLE',
  // Phase 19 (D-03 group 4): the export and import refusals. An export over the row cap is a 422 served with rowCount
  // and rowCap beside it (D-16, D-17); an unreleased assessment the analyst can read is a 409 Phase 17 reuses (D-15).
  'EXPORT_ROW_LIMIT',
  'ASSESSMENT_NOT_RELEASED',
  // The exports record's code review amendment (2026-10-17, 3b5c66fa): an xlsx export whose text cell is longer than
  // Excel's 32,767-character limit is a 422 served with the column's key and the cell limit beside it.
  'EXPORT_CELL_TOO_LONG',
  // The import file refusals (D-25 to D-27): 415 IMPORT_FILE_TYPE, 413 IMPORT_FILE_TOO_LARGE and 422 for the others, each
  // served with the closed found details where the import record names them.
  'IMPORT_FILE_TYPE',
  'IMPORT_FILE_TOO_LARGE',
  'IMPORT_TOO_MANY_ROWS',
  'IMPORT_ENCODING_WINDOWS_1252',
  'IMPORT_ENCODING_UTF16',
  'IMPORT_ENCODING_UNKNOWN',
  'IMPORT_DELIMITER',
  'IMPORT_LEGACY_XLS',
  'IMPORT_MACRO_WORKBOOK',
  'IMPORT_ENCRYPTED_WORKBOOK',
  'IMPORT_WORKBOOK_TOO_LARGE',
  'IMPORT_NO_HEADER',
  'IMPORT_NO_ROWS',
  'IMPORT_DUPLICATE_HEADER',
  'IMPORT_MISSING_COLUMN',
  // The import commit's 409s (D-30): a similar row without a decision, and an expired or unknown review.
  'IMPORT_DECISION_MISSING',
  'IMPORT_REVIEW_EXPIRED',
  // The import record's Phase 19 execution amendment (2026-10-17): a CSV the parser cannot read, a 422 served with
  // found.line (the 1-based source line) when the parser reports one.
  'IMPORT_CSV_MALFORMED',
] as const);

export type ConflictReason = (typeof CONFLICT_REASONS)[number];

const conflictReasons: ReadonlySet<string> = new Set(CONFLICT_REASONS);

/** True only for a value in the closed list; anything else a response carries is not a reason. */
export function isConflictReason(value: unknown): value is ConflictReason {
  return typeof value === 'string' && conflictReasons.has(value);
}

/**
 * The contract's one pattern for a scanner's detection name (the stage B amendment, contract item 4; WR-501, IN-704):
 * the 422's `details.detection` and a listed file's `detection` alike. A letter or digit, then at most 127 letters,
 * digits, underscores (ClamAV's `Win.Test.EICAR_HDB-1`), dots, colons, slashes or hyphens: no space, markup or quote,
 * so the name is safe to show as data. The transport and the attachments parser both hold a name to it.
 */
export const ATTACHMENT_DETECTION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$/;
