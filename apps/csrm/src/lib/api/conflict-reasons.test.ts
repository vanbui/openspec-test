import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ATTACHMENT_DETECTION_PATTERN, CONFLICT_REASONS, isConflictReason } from './conflict-reasons';

type Specification = {
  components: { schemas: Record<string, { properties: { error: { properties: { details: { properties?: { reason?: { type?: string; enum?: string[] } } } } } } }> };
};

const specification = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../docs/references/specification.json'), 'utf8'),
) as Specification;

function publishedReasons(schemaName: string): string[] {
  const reason = specification.components.schemas[schemaName]?.properties.error.properties.details.properties?.reason;
  expect(reason?.type).toBe('string');
  return [...(reason?.enum ?? [])].sort();
}

describe('conflict reasons', () => {
  it('recognises both AI data policy refusals', () => {
    expect(isConflictReason('AI_CLASSIFICATION_ABOVE_CEILING')).toBe(true);
    expect(isConflictReason('AI_POLICY_NOT_CONFIGURED')).toBe(true);
  });
  /* WR-103: AI_RUN_RECORD_UNAVAILABLE refuses a decision or AI field edit whose run history cannot take its record. */
  it.each(['ASSESSMENT_NOT_MUTABLE', 'AI_PROPOSAL_ALREADY_DECIDED', 'AI_SUGGESTION_CONTROL_CHANGED', 'AI_ACCEPT_WITH_PLANNED_CONTROL', 'AI_RUN_RECORD_UNAVAILABLE'])(
    'recognises %s',
    (reason) => expect(isConflictReason(reason)).toBe(true),
  );
  /* Phase 13 (D-05 to D-08, G-1): the request assignment refusals; OWN_REQUEST is a 403 identity refusal on the same list. */
  it.each(['OWN_REQUEST', 'ASSIGNMENT_CHANGED', 'ASSIGNEE_NOT_ELIGIBLE', 'ASSIGNMENT_REQUIRED'])(
    'recognises the request assignment refusal %s',
    (reason) => expect(isConflictReason(reason)).toBe(true),
  );
  /* Phase 13 (D-21, D-22, D-20): the request notes refusals, the kept request with notes and the requestor-only submission. */
  it.each(['NOTES_CLOSED', 'NOTES_LIMIT_REACHED', 'REQUEST_HAS_NOTES', 'NOT_REQUEST_REQUESTOR'])(
    'recognises the request notes refusal %s',
    (reason) => expect(isConflictReason(reason)).toBe(true),
  );
  /* Phase 14 (D-04 item 10, D-11): the request attachment refusals, from the 400 empty file to the 422 malware refusal. */
  it.each([
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
  ])('recognises the request attachment refusal %s', (reason) => expect(isConflictReason(reason)).toBe(true));
  /*
   * The stage B amendment (2026-10-11, contract item 5): a ZIP structure CSRM will not read (415, IN-202), Office active
   * content (415, WR-205) and a full screening or extraction queue (503, retryable, WR-204).
   */
  it.each(['ATTACHMENT_UNSUPPORTED_STRUCTURE', 'ATTACHMENT_ACTIVE_CONTENT', 'ATTACHMENT_BUSY'])(
    'recognises the stage B attachment refusal %s',
    (reason) => expect(isConflictReason(reason)).toBe(true),
  );
  /*
   * Phase 15 (D-03 item 9; orchestrator decision Q-1): the AI proposal, gate and instruction refusals in one contract
   * change, QUESTIONNAIRE_ANSWERED (until now a generation job failure code only) among them. A proposal no longer open
   * keeps Phase 12's one code, AI_PROPOSAL_ALREADY_DECIDED; there is no parallel "not open" code.
   */
  it.each([
    'AI_PROPOSALS_OPEN',
    'AI_PROPOSAL_STALE',
    'QUESTIONNAIRE_HAS_ANALYST_CHANGES',
    'QUESTION_ANSWERED',
    'ASSESSMENT_DRAFT_IN_PROGRESS',
    'AI_PROPOSAL_RUN_LIMIT',
    'AI_PROPOSAL_UNDO_UNAVAILABLE',
    'ANSWERED_QUESTION_AFFECTED',
    'INSTRUCTION_TOO_LONG',
    'INSTRUCTION_CHARACTERS_NOT_ALLOWED',
    'INSTRUCTION_REPEATS_REQUESTOR_TEXT',
    'QUESTIONNAIRE_ANSWERED',
  ])('recognises the Phase 15 refusal %s', (reason) => expect(isConflictReason(reason)).toBe(true));
  /*
   * Phase 16 (D-03 item 10): the risk curation refusals in one contract change, all 409s: a withdrawn Risk, a
   * reinstatement of only active Risks, an AI-proposed Accept the residual rating forbids, and a request that holds an
   * assessment.
   */
  it.each(['RISK_WITHDRAWN', 'RISK_NOT_WITHDRAWN', 'AI_ACCEPT_NOT_PERMITTED', 'REQUEST_HAS_ASSESSMENT'])(
    'recognises the Phase 16 refusal %s',
    (reason) => expect(isConflictReason(reason)).toBe(true),
  );
  /* Phase 19 (D-03 group 4, D-16, D-17): an export over the row cap, refused 422 with its row count and cap. */
  it('recognises the Phase 19 export row limit', () => {
    expect(isConflictReason('EXPORT_ROW_LIMIT')).toBe(true);
  });
  /*
   * Phase 19 (D-03 group 4, D-15, D-25 to D-27, D-30): the 19 export and import refusals, appended in their recorded
   * order after Phase 16's. ASSESSMENT_NOT_RELEASED is shared with Phase 17 D-29; there is no EXPORT_NOT_RELEASED.
   */
  const phase19Reasons = [
    'EXPORT_ROW_LIMIT',
    'ASSESSMENT_NOT_RELEASED',
    // The exports record's code review amendment (2026-10-17, 3b5c66fa): an xlsx text cell over Excel's cell limit.
    'EXPORT_CELL_TOO_LONG',
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
    'IMPORT_DECISION_MISSING',
    'IMPORT_REVIEW_EXPIRED',
    // The import record's Phase 19 execution amendment (2026-10-17): a CSV the parser cannot read.
    'IMPORT_CSV_MALFORMED',
  ];
  it.each(phase19Reasons)('recognises the Phase 19 refusal %s', (reason) => expect(isConflictReason(reason)).toBe(true));
  it('appends the Phase 19 refusals in their recorded order, with no parallel not-released code', () => {
    expect(CONFLICT_REASONS.slice(-phase19Reasons.length)).toEqual(phase19Reasons);
    expect(isConflictReason('EXPORT_NOT_RELEASED')).toBe(false);
  });
  it('keeps one "no longer open" code for a proposal', () => {
    expect(isConflictReason('AI_PROPOSAL_NOT_OPEN')).toBe(false);
    expect(isConflictReason('AI_PROPOSAL_ALREADY_DECIDED')).toBe(true);
  });
  it.each(['AssessmentWorkflowErrorResponse', 'QuestionnaireWorkflowErrorResponse'])(
    'match the closed list %s publishes',
    (schemaName) => {
      expect(publishedReasons(schemaName)).toEqual([...CONFLICT_REASONS].sort());
    },
  );

  /*
   * The stage B amendment (2026-10-11, contract item 4; WR-501, IN-704): the transport and the attachments parser hold a
   * detection to the one pattern both the 422's details.detection and a listed file's detection publish.
   */
  it('hold a detection to the one pattern the contract publishes for the 422 and the listed file', () => {
    type Node = { pattern?: string; properties?: Record<string, Node> };
    const schemas = specification.components.schemas as unknown as Record<string, Node>;
    const malware = schemas.AssessmentWorkflowErrorResponse?.properties?.error?.properties?.details?.properties?.detection?.pattern;
    const listed = schemas.RequestAttachment?.properties?.detection?.pattern;
    expect([malware, listed]).toEqual([ATTACHMENT_DETECTION_PATTERN.source, ATTACHMENT_DETECTION_PATTERN.source]);
    expect(ATTACHMENT_DETECTION_PATTERN.test('Win.Test.EICAR_HDB-1')).toBe(true);
  });

  it('list each code once in a frozen list', () => {
    expect(new Set(CONFLICT_REASONS).size).toBe(CONFLICT_REASONS.length);
    expect(Object.isFrozen(CONFLICT_REASONS)).toBe(true);
  });

  it.each(CONFLICT_REASONS.map((reason) => [reason]))('accept %s', (reason) => {
    expect(isConflictReason(reason)).toBe(true);
  });

  it.each([
    ['an unknown code', 'OTHER'],
    ['an empty string', ''],
    ['a code in the wrong case', 'request_work_started'],
    ['a code with padding', ' REQUEST_WORK_STARTED'],
    ['null', null],
    ['undefined', undefined],
    ['a number', 409],
    ['an array holding a code', ['REQUEST_WORK_STARTED']],
    ['an object holding a code', { reason: 'REQUEST_WORK_STARTED' }],
  ])('reject %s', (_scenario, value) => {
    expect(isConflictReason(value)).toBe(false);
  });
});
