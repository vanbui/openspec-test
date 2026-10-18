import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CONFLICT_REASONS } from "../src/csrm/conflict-reasons";
import { ATTACHMENT_DETECTION_PATTERN } from "../src/csrm/files/attachment-policy";

// Tests compile into `.tmp/tests-dist/tests`; five parents resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const specification = JSON.parse(readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8")) as {
  components?: { schemas?: Record<string, { properties?: Record<string, any> }> };
};

function publishedReasons(schemaName: string): string[] {
  const reason = specification.components?.schemas?.[schemaName]?.properties?.error?.properties?.details?.properties?.reason;
  assert.equal(reason?.type, "string", `CONFLICT_REASON_NOT_A_STRING_IN_${schemaName}`);
  assert.ok(Array.isArray(reason?.enum), `CONFLICT_REASON_NOT_A_CLOSED_LIST_IN_${schemaName}`);
  return [...reason.enum as string[]].sort();
}

/** Phase 14's 24 refusal codes (14-05; the approved record's "Content, Limits and Refusals" and "Operations and Functions"). */
const PHASE_14_ATTACHMENT_REASONS = [
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
  "REQUEST_HAS_ATTACHMENTS",
  "ATTACHMENT_TOO_LARGE",
  "ATTACHMENT_EMPTY",
  "ATTACHMENT_TYPE_NOT_ALLOWED",
  "ATTACHMENT_CONTENT_MISMATCH",
  "ATTACHMENT_MACRO_ENABLED",
  "ATTACHMENT_ENCRYPTED",
  "ATTACHMENT_LEGACY_OFFICE",
  "ATTACHMENT_MALWARE_FOUND",
  "NOT_UPLOADER",
  "NOT_REMOVER",
] as const;

/*
 * WR-501 and IN-704 (contract item 4 of the stage B amendment, 2026-10-11): one detection pattern everywhere, with the
 * underscore real ClamAV names use (Win.Test.EICAR_HDB-1, a detection name, not the antivirus test string). A listed
 * file's detection is held to the same pattern as the 422's, and is null when the stored name does not match it.
 */
const DETECTION_PATTERN = "^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,127}$";

/*
 * Orchestrator Confirmations (14-RESEARCH Settled 8): a malware refusal is a 422 with the closed reason
 * ATTACHMENT_MALWARE_FOUND and a bounded detection name. The assessment error schema stays closed, so `detection` is a
 * declared property with its pattern; the questionnaire schema's details stay open.
 */
test("the assessment error schema publishes the malware detection as a bounded string beside the reason", () => {
  const details = specification.components?.schemas?.AssessmentWorkflowErrorResponse?.properties?.error?.properties?.details;
  assert.equal(details?.additionalProperties, false, "ASSESSMENT_ERROR_DETAILS_NOT_CLOSED");
  assert.deepEqual(details?.properties?.detection, {
    type: "string",
    pattern: DETECTION_PATTERN,
    description: details?.properties?.detection?.description,
  }, "DETECTION_NOT_PUBLISHED");
  assert.match(String(details?.properties?.detection?.description), /ATTACHMENT_MALWARE_FOUND/, "DETECTION_NOT_TIED_TO_MALWARE");
  const pattern = new RegExp(details.properties.detection.pattern);
  assert.ok(pattern.test("Csrm.Test.Signature"));
  assert.ok(!pattern.test("Csrm Test"), "DETECTION_ACCEPTS_A_SPACE");
  assert.ok(!pattern.test(`A${"b".repeat(128)}`), "DETECTION_ACCEPTS_129_CHARACTERS");
  assert.ok(pattern.test(`A${"b".repeat(127)}`));
});

test("one detection pattern, admitting the underscore of real ClamAV names, binds the 422's and the listed file's detection (WR-501, IN-704)", () => {
  const schemas = specification.components?.schemas ?? {};
  const malware = schemas.AssessmentWorkflowErrorResponse?.properties?.error?.properties?.details?.properties?.detection;
  assert.equal(malware?.pattern, DETECTION_PATTERN, "THE_422_DETECTION_PATTERN_IS_NOT_THE_ONE_PATTERN");
  const listed = schemas.RequestAttachment?.properties?.detection;
  assert.deepEqual([listed?.type, listed?.maxLength, listed?.pattern], [["string", "null"], 128, DETECTION_PATTERN], "THE_LISTED_DETECTION_IS_NOT_HELD_TO_THE_PATTERN");
  // Strapi serves and logs a detection under this one pattern (the 422, the list and the security event line).
  assert.equal(ATTACHMENT_DETECTION_PATTERN.source, DETECTION_PATTERN, "STRAPI_HOLDS_ANOTHER_DETECTION_PATTERN");
  const pattern = new RegExp(DETECTION_PATTERN);
  assert.ok(pattern.test("Win.Test.EICAR_HDB-1"), "THE_CLAMAV_NAME_IS_REFUSED");
  for (const outside of ["Win Test", "<b>Win</b>", "_Win", "Win\"x", `A${"b".repeat(128)}`]) assert.ok(!pattern.test(outside), `ACCEPTS_${outside}`);
});

/*
 * The stage B amendment (2026-10-11, contract item 5; 14-PILOT-RULINGS.md): three new closed reasons. A ZIP whose
 * structure CSRM will not read (an archive comment, a bound, ZIP64 or an unusual method) is 415
 * ATTACHMENT_UNSUPPORTED_STRUCTURE (IN-202); Office active content beyond macros is 415 ATTACHMENT_ACTIVE_CONTENT
 * (WR-205); a full screening or extraction queue is 503 ATTACHMENT_BUSY, retryable (WR-204).
 */
const STAGE_B_ATTACHMENT_REASONS = ["ATTACHMENT_UNSUPPORTED_STRUCTURE", "ATTACHMENT_ACTIVE_CONTENT", "ATTACHMENT_BUSY"] as const;

test("the stage B attachment reasons join the one closed list (IN-202, WR-204, WR-205)", () => {
  for (const reason of STAGE_B_ATTACHMENT_REASONS) {
    assert.ok((CONFLICT_REASONS as readonly string[]).includes(reason), `${reason}_MISSING`);
  }
  for (const schemaName of ["AssessmentWorkflowErrorResponse", "QuestionnaireWorkflowErrorResponse"]) {
    const reason = specification.components?.schemas?.[schemaName]?.properties?.error?.properties?.details?.properties?.reason;
    for (const code of STAGE_B_ATTACHMENT_REASONS) {
      assert.ok((reason?.enum as string[] | undefined)?.includes(code), `${code}_NOT_PUBLISHED_IN_${schemaName}`);
      assert.ok(String(reason?.description).includes(code), `${code}_NOT_DESCRIBED_IN_${schemaName}`);
    }
  }
});

/*
 * Phase 15 (D-03 item 9; the run record's Phase 15 amendment, "Closed reasons"; orchestrator decision Q-1): twelve
 * reasons join the list in one contract change. Eleven are new; QUESTIONNAIRE_ANSWERED, until now a generation job
 * failure code only, is refused at enqueue too. The three instruction reasons are 400s, the others 409s. A proposal no
 * longer open keeps Phase 12's AI_PROPOSAL_ALREADY_DECIDED: there is no parallel code.
 */
const PHASE_15_REASONS = [
  "AI_PROPOSALS_OPEN",
  "AI_PROPOSAL_STALE",
  "QUESTIONNAIRE_HAS_ANALYST_CHANGES",
  "QUESTION_ANSWERED",
  "ASSESSMENT_DRAFT_IN_PROGRESS",
  "AI_PROPOSAL_RUN_LIMIT",
  "AI_PROPOSAL_UNDO_UNAVAILABLE",
  "ANSWERED_QUESTION_AFFECTED",
  "INSTRUCTION_TOO_LONG",
  "INSTRUCTION_CHARACTERS_NOT_ALLOWED",
  "INSTRUCTION_REPEATS_REQUESTOR_TEXT",
  "QUESTIONNAIRE_ANSWERED",
] as const;

test("the Phase 15 AI proposal, gate and instruction reasons join the one closed list (D-03 item 9, Q-1)", () => {
  for (const reason of PHASE_15_REASONS) {
    assert.ok((CONFLICT_REASONS as readonly string[]).includes(reason), `${reason}_MISSING`);
  }
  assert.equal((CONFLICT_REASONS as readonly string[]).includes("AI_PROPOSAL_NOT_OPEN"), false, "A_PARALLEL_NOT_OPEN_CODE_EXISTS");
  for (const schemaName of ["AssessmentWorkflowErrorResponse", "QuestionnaireWorkflowErrorResponse"]) {
    const reason = specification.components?.schemas?.[schemaName]?.properties?.error?.properties?.details?.properties?.reason;
    for (const code of PHASE_15_REASONS) {
      assert.ok((reason?.enum as string[] | undefined)?.includes(code), `${code}_NOT_PUBLISHED_IN_${schemaName}`);
    }
    // The 400s are named with their status, as Phase 14's are; every other new code is a 409.
    for (const code of ["INSTRUCTION_TOO_LONG", "INSTRUCTION_CHARACTERS_NOT_ALLOWED", "INSTRUCTION_REPEATS_REQUESTOR_TEXT"]) {
      assert.ok(String(reason?.description).includes(code), `${code}_NOT_DESCRIBED_IN_${schemaName}`);
    }
  }
});

/*
 * Phase 16 (D-03 item 10; the approved record "Operations, Functions and Reasons"; the Phase 12 record's Phase 16
 * amendment, "Closed reasons"): four 409s join the list in one contract change, ahead of the plans that throw them. A
 * mutation of a withdrawn Risk, a reinstatement of only active Risks, an AI-proposed Accept the residual rating forbids,
 * and the delete of a request that holds an assessment. A proposal no longer open keeps AI_PROPOSAL_ALREADY_DECIDED.
 */
const PHASE_16_REASONS = ["RISK_WITHDRAWN", "RISK_NOT_WITHDRAWN", "AI_ACCEPT_NOT_PERMITTED", "REQUEST_HAS_ASSESSMENT"] as const;

test("the Phase 16 risk curation reasons join the one closed list (D-03 item 10)", () => {
  for (const reason of PHASE_16_REASONS) {
    assert.ok((CONFLICT_REASONS as readonly string[]).includes(reason), `${reason}_MISSING`);
  }
  assert.equal((CONFLICT_REASONS as readonly string[]).includes("AI_PROPOSAL_NOT_OPEN"), false, "A_PARALLEL_NOT_OPEN_CODE_EXISTS");
  for (const schemaName of ["AssessmentWorkflowErrorResponse", "QuestionnaireWorkflowErrorResponse"]) {
    const reason = specification.components?.schemas?.[schemaName]?.properties?.error?.properties?.details?.properties?.reason;
    for (const code of PHASE_16_REASONS) {
      assert.ok((reason?.enum as string[] | undefined)?.includes(code), `${code}_NOT_PUBLISHED_IN_${schemaName}`);
      assert.ok(String(reason?.description).includes(code), `${code}_NOT_DESCRIBED_IN_${schemaName}`);
    }
  }
});

/*
 * Phase 19 (D-03 group 4, D-16, D-17; the approved record "Exports and the Export Log"): an export over the row cap is
 * refused 422 EXPORT_ROW_LIMIT with the rows it would hold and the cap beside it, as closed, non-negative integers in the
 * assessment error schema's closed details.
 */
test("the Phase 19 export row limit joins the one closed list with its row count and cap (D-16, D-17)", () => {
  assert.ok((CONFLICT_REASONS as readonly string[]).includes("EXPORT_ROW_LIMIT"), "EXPORT_ROW_LIMIT_MISSING");
  for (const schemaName of ["AssessmentWorkflowErrorResponse", "QuestionnaireWorkflowErrorResponse"]) {
    const reason = specification.components?.schemas?.[schemaName]?.properties?.error?.properties?.details?.properties?.reason;
    assert.ok((reason?.enum as string[] | undefined)?.includes("EXPORT_ROW_LIMIT"), `EXPORT_ROW_LIMIT_NOT_PUBLISHED_IN_${schemaName}`);
    assert.ok(String(reason?.description).includes("EXPORT_ROW_LIMIT"), `EXPORT_ROW_LIMIT_NOT_DESCRIBED_IN_${schemaName}`);
  }
  const details = specification.components?.schemas?.AssessmentWorkflowErrorResponse?.properties?.error?.properties?.details;
  assert.equal(details?.additionalProperties, false, "ASSESSMENT_ERROR_DETAILS_NOT_CLOSED");
  const { rowCount, rowCap } = details?.properties ?? {};
  assert.deepEqual([rowCount?.type, rowCount?.minimum], ["integer", 0], "ROW_COUNT_NOT_PUBLISHED");
  assert.deepEqual([rowCap?.type, rowCap?.minimum], ["integer", 1], "ROW_CAP_NOT_PUBLISHED");
  for (const [name, property] of [["rowCount", rowCount], ["rowCap", rowCap]] as const) {
    assert.match(String(property?.description), /EXPORT_ROW_LIMIT/, `${name.toUpperCase()}_NOT_TIED_TO_THE_ROW_LIMIT`);
  }
});

/*
 * Phase 19 (D-03 group 4, D-15, D-25 to D-27, D-30; the two approved Phase 19 records): the 19 export and import
 * refusals, appended in this order after the codes Phases 10 to 16 added, in one contract change ahead of the plans that
 * throw them. ASSESSMENT_NOT_RELEASED is shared with Phase 17 D-29 (stop A ruling 1: no EXPORT_NOT_RELEASED).
 */
const PHASE_19_REASONS = [
  "EXPORT_ROW_LIMIT",
  "ASSESSMENT_NOT_RELEASED",
  // The Phase 19 review amendment (2026-10-17, G-6): an xlsx cell longer than Excel allows, after ASSESSMENT_NOT_RELEASED.
  "EXPORT_CELL_TOO_LONG",
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
  "IMPORT_DECISION_MISSING",
  "IMPORT_REVIEW_EXPIRED",
  // The import record's Phase 19 execution amendment (2026-10-17, G-6): a CSV the parser cannot read.
  "IMPORT_CSV_MALFORMED",
] as const;

test("the 21 Phase 19 export and import reasons close the one list, in their recorded order (D-03 group 4)", () => {
  assert.equal(PHASE_19_REASONS.length, 21);
  assert.deepEqual(CONFLICT_REASONS.slice(-PHASE_19_REASONS.length), [...PHASE_19_REASONS], "PHASE_19_REASONS_NOT_APPENDED_IN_ORDER");
  assert.equal(CONFLICT_REASONS.indexOf("RISK_CURATION_UNDO_UNAVAILABLE"), CONFLICT_REASONS.length - PHASE_19_REASONS.length - 1, "PHASE_19_REASONS_NOT_AFTER_PHASE_16");
  assert.equal((CONFLICT_REASONS as readonly string[]).includes("EXPORT_NOT_RELEASED"), false, "A_PARALLEL_NOT_RELEASED_CODE_EXISTS");
  for (const schemaName of ["AssessmentWorkflowErrorResponse", "QuestionnaireWorkflowErrorResponse"]) {
    const reason = specification.components?.schemas?.[schemaName]?.properties?.error?.properties?.details?.properties?.reason;
    for (const code of PHASE_19_REASONS) {
      assert.ok((reason?.enum as string[] | undefined)?.includes(code), `${code}_NOT_PUBLISHED_IN_${schemaName}`);
      assert.ok(String(reason?.description).includes(code), `${code}_NOT_DESCRIBED_IN_${schemaName}`);
    }
  }
});

/*
 * The Phase 19 review amendment (2026-10-17, G-6; BE1-02): EXPORT_CELL_TOO_LONG is served with the closed column key and
 * the cell limit beside it, each tied to that reason, in the assessment error schema's closed details.
 */
test("the assessment error schema publishes EXPORT_CELL_TOO_LONG's column and cellLimit (BE1-02)", () => {
  const details = specification.components?.schemas?.AssessmentWorkflowErrorResponse?.properties?.error?.properties?.details;
  assert.equal(details?.additionalProperties, false, "ASSESSMENT_ERROR_DETAILS_NOT_CLOSED");
  const { column, cellLimit } = details?.properties ?? {};
  assert.deepEqual([column?.type, column?.pattern], ["string", "^[a-zA-Z][a-zA-Z0-9]{0,63}$"], "COLUMN_NOT_PUBLISHED");
  assert.deepEqual([cellLimit?.type, cellLimit?.const], ["integer", 32_767], "CELL_LIMIT_NOT_PUBLISHED");
  for (const [name, property] of [["column", column], ["cellLimit", cellLimit]] as const) {
    assert.match(String(property?.description), /EXPORT_CELL_TOO_LONG/, `${name.toUpperCase()}_NOT_TIED_TO_ITS_REASON`);
  }
});

/*
 * D-26, D-27 (the approved import record, "File Refusals"; T-19-03, T-19-04): a file refusal names what it found in a
 * closed, bounded object: the uploader's own headers and the display labels (at most 20 strings of at most 200
 * characters), the delimiter (semicolon or tab), and the rows or bytes counted. No cell value is ever in it.
 */
test("the assessment error schema publishes a file refusal's found details as a closed, bounded object (D-26, D-27)", () => {
  const details = specification.components?.schemas?.AssessmentWorkflowErrorResponse?.properties?.error?.properties?.details;
  assert.equal(details?.additionalProperties, false, "ASSESSMENT_ERROR_DETAILS_NOT_CLOSED");
  const found = details?.properties?.found;
  assert.equal(found?.type, "object", "FOUND_NOT_AN_OBJECT");
  assert.equal(found?.additionalProperties, false, "FOUND_NOT_CLOSED");
  assert.match(String(found?.description), /IMPORT_/, "FOUND_NOT_TIED_TO_AN_IMPORT_REASON");
  assert.deepEqual(Object.keys(found?.properties ?? {}).sort(), ["bytes", "delimiter", "headers", "labels", "line", "rows"], "FOUND_KEYS_DIFFER");
  for (const name of ["headers", "labels"]) {
    const list = found.properties[name];
    assert.deepEqual([list.type, list.maxItems, list.items?.type, list.items?.maxLength], ["array", 20, "string", 200], `FOUND_${name.toUpperCase()}_NOT_BOUNDED`);
  }
  assert.deepEqual(found.properties.delimiter.enum, ["semicolon", "tab"], "FOUND_DELIMITER_NOT_CLOSED");
  for (const name of ["rows", "bytes"]) {
    assert.deepEqual([found.properties[name].type, found.properties[name].minimum], ["integer", 0], `FOUND_${name.toUpperCase()}_NOT_A_COUNT`);
  }
  // The 2026-10-17 amendment: a positive line number, tied to IMPORT_CSV_MALFORMED alone and never the line's content.
  assert.deepEqual([found.properties.line.type, found.properties.line.minimum], ["integer", 1], "FOUND_LINE_NOT_A_POSITIVE_INTEGER");
  assert.match(String(found.properties.line.description), /IMPORT_CSV_MALFORMED/, "FOUND_LINE_NOT_TIED_TO_ITS_REASON");
});

/*
 * D-22: the reason a 409 names is one closed list. Strapi raises it, both conflict response schemas
 * publish it, and the web keeps only what it accepts; a code added in one place and not the others
 * would be dropped by the client or rejected by the contract.
 */
test("the conflict reason list Strapi raises is the list both conflict response schemas publish", () => {
  assert.ok(CONFLICT_REASONS.includes("AI_CLASSIFICATION_ABOVE_CEILING"));
  assert.ok(CONFLICT_REASONS.includes("AI_POLICY_NOT_CONFIGURED"));
  // WR-103: a decision or AI field edit whose run history cannot take its record is refused with its own reason.
  for (const reason of ["ASSESSMENT_NOT_MUTABLE", "AI_PROPOSAL_ALREADY_DECIDED", "AI_SUGGESTION_CONTROL_CHANGED", "AI_ACCEPT_WITH_PLANNED_CONTROL", "AI_RUN_RECORD_UNAVAILABLE"]) {
    assert.ok((CONFLICT_REASONS as readonly string[]).includes(reason), `${reason}_MISSING`);
  }
  // Phase 13 (D-05 to D-08, G-1): the request assignment refusals; OWN_REQUEST is a 403 identity refusal on the same list.
  for (const reason of ["OWN_REQUEST", "ASSIGNMENT_CHANGED", "ASSIGNEE_NOT_ELIGIBLE", "ASSIGNMENT_REQUIRED"]) {
    assert.ok((CONFLICT_REASONS as readonly string[]).includes(reason), `${reason}_MISSING`);
  }
  // Phase 13 (D-21, D-22): the request notes refusals; D-21 and D-20: a request with notes is kept, and only its
  // requestor submits it (NOT_REQUEST_REQUESTOR is a 403 identity refusal on the same list).
  for (const reason of ["NOTES_CLOSED", "NOTES_LIMIT_REACHED", "REQUEST_HAS_NOTES", "NOT_REQUEST_REQUESTOR"]) {
    assert.ok((CONFLICT_REASONS as readonly string[]).includes(reason), `${reason}_MISSING`);
  }
  // Phase 14 (D-04 item 10, D-11): the request attachment refusals, one closed vocabulary with the statuses the list's
  // module comment records (400, 403, 409, 413, 415 and the malware 422).
  for (const reason of PHASE_14_ATTACHMENT_REASONS) {
    assert.ok((CONFLICT_REASONS as readonly string[]).includes(reason), `${reason}_MISSING`);
  }
  const raised = [...CONFLICT_REASONS].sort();
  assert.equal(new Set(raised).size, raised.length, "CONFLICT_REASON_LISTED_TWICE");
  assert.ok(Object.isFrozen(CONFLICT_REASONS), "CONFLICT_REASONS_NOT_FROZEN");
  for (const schemaName of ["AssessmentWorkflowErrorResponse", "QuestionnaireWorkflowErrorResponse"]) {
    assert.deepEqual(publishedReasons(schemaName), raised, `CONFLICT_REASONS_DIVERGE_FROM_${schemaName}`);
  }
});
