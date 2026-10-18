import assert from "node:assert/strict";
import test from "node:test";

import {
  RELEASED_ASSESSMENT_FILTERS,
  RELEASED_ASSESSMENT_POPULATE,
  findReadableReleasedAssessment,
  isReadableReleasedAssessment,
  readableAssessmentFilters,
  type AssessmentViewer,
} from "../src/api/csrm-assessment/services/released-assessment-read";

/*
 * Phase 19 D-14 (19-10): one module decides who may read a released assessment. Today "released" is the complete release
 * fact on an approved request, and "readable" is the Requestor who raised it, or any analyst. Phases 17 and 17.1 widen
 * these two rules in this module alone, so these cases are the contract they widen from.
 */

type Json = Record<string, unknown>;

const JANE = "jane-document-id";
const OTHER = "other-requestor-document-id";
const jane: AssessmentViewer = { kind: "requestor", documentId: JANE };
const other: AssessmentViewer = { kind: "requestor", documentId: OTHER };
const analyst: AssessmentViewer = { kind: "analyst" };

function released(overrides: Json = {}, request: Json = {}): Json {
  return {
    documentId: "assessment-1",
    assessmentNumber: "ASM-2026-000001",
    assessmentStatus: "approved",
    approvalDate: "2026-08-30T00:00:00.000Z",
    assessmentDate: "2026-08-30T00:00:00.000Z",
    approvedBy: { documentId: "bob-document-id", displayName: "Bob" },
    assessmentRequest: { documentId: "request-1", requestStatus: "approved", requestor: { documentId: JANE }, ...request },
    ...overrides,
  };
}

test("isReadableReleasedAssessment admits the Requestor who raised a released assessment and every analyst, and nobody else", () => {
  assert.equal(isReadableReleasedAssessment(released(), jane), true, "JANE_REFUSED_HER_RELEASE");
  assert.equal(isReadableReleasedAssessment(released(), analyst), true, "ANALYST_REFUSED_A_RELEASE");
  assert.equal(isReadableReleasedAssessment(released(), other), false, "ANOTHER_REQUESTOR_READS_JANES_RELEASE");
  assert.equal(isReadableReleasedAssessment(released({}, { requestor: null }), jane), false, "A_REQUEST_WITHOUT_A_REQUESTOR_IS_JANES");
});

test("isReadableReleasedAssessment refuses every incomplete release fact, for the Requestor and the analyst alike", () => {
  for (const [label, document] of [
    ["NO_APPROVER", released({ approvedBy: null })],
    ["NO_APPROVAL_DATE", released({ approvalDate: null })],
    ["NO_ASSESSMENT_DATE", released({ assessmentDate: null })],
    ["IN_REVIEW", released({ assessmentStatus: "in-review" })],
    ["DRAFT", released({ assessmentStatus: "draft" })],
    ["REQUEST_UNDER_REVIEW", released({}, { requestStatus: "under-review" })],
    ["REQUEST_MISSING", released({ assessmentRequest: null })],
  ] as const) {
    assert.equal(isReadableReleasedAssessment(document, jane), false, `REQUESTOR_${label}`);
    assert.equal(isReadableReleasedAssessment(document, analyst), false, `ANALYST_${label}`);
  }
  for (const value of [null, undefined, "assessment-1", [released()]]) {
    assert.equal(isReadableReleasedAssessment(value, analyst), false, `NOT_A_RECORD_${JSON.stringify(value)}`);
  }
});

test("readableAssessmentFilters scopes a Requestor to the requests they raised and leaves the analyst unscoped", () => {
  assert.deepEqual(readableAssessmentFilters(analyst), {});
  assert.deepEqual(readableAssessmentFilters(jane), { assessmentRequest: { requestor: { documentId: { $eq: JANE } } } });
});

test("RELEASED_ASSESSMENT_FILTERS and RELEASED_ASSESSMENT_POPULATE are today's release facts, frozen", () => {
  assert.deepEqual(RELEASED_ASSESSMENT_FILTERS, {
    assessmentStatus: { $eq: "approved" },
    approvalDate: { $notNull: true },
    assessmentDate: { $notNull: true },
    approvedBy: { documentId: { $notNull: true } },
    assessmentRequest: { requestStatus: { $eq: "approved" } },
  });
  assert.deepEqual(RELEASED_ASSESSMENT_POPULATE, { assessmentRequest: { populate: { requestor: true } }, reviewedBy: true, approvedBy: true });
  assert.ok(Object.isFrozen(RELEASED_ASSESSMENT_FILTERS) && Object.isFrozen(RELEASED_ASSESSMENT_FILTERS.assessmentRequest), "RELEASED_FILTERS_NOT_FROZEN");
  assert.ok(Object.isFrozen(RELEASED_ASSESSMENT_POPULATE), "RELEASED_POPULATE_NOT_FROZEN");
});

test("findReadableReleasedAssessment reads once with both rules and checks the record it gets back", async () => {
  const queries: Json[] = [];
  const reading = (document: Json | null) => ({
    findOne: async (query: Json) => {
      queries.push(query);
      return document;
    },
  });

  assert.deepEqual(await findReadableReleasedAssessment({ documents: reading(released()), viewer: jane, documentId: "assessment-1" }), released());
  assert.deepEqual(queries[0], {
    documentId: "assessment-1",
    filters: {
      assessmentStatus: { $eq: "approved" },
      approvalDate: { $notNull: true },
      assessmentDate: { $notNull: true },
      approvedBy: { documentId: { $notNull: true } },
      assessmentRequest: { requestStatus: { $eq: "approved" }, requestor: { documentId: { $eq: JANE } } },
    },
    populate: RELEASED_ASSESSMENT_POPULATE,
  }, "REQUESTOR_READ_NOT_BOTH_RULES");

  assert.equal(await findReadableReleasedAssessment({ documents: reading(released()), viewer: analyst, documentId: "assessment-1" }) !== null, true);
  assert.deepEqual((queries[1].filters as Json).assessmentRequest, { requestStatus: { $eq: "approved" } }, "ANALYST_READ_SCOPED_TO_A_REQUESTOR");

  // A record the store returns that fails either rule in memory is still refused: the filter is never trusted alone.
  assert.equal(await findReadableReleasedAssessment({ documents: reading(released()), viewer: other, documentId: "assessment-1" }), null, "ANOTHER_REQUESTOR_GOT_JANES_RECORD");
  assert.equal(await findReadableReleasedAssessment({ documents: reading(released({ approvedBy: null })), viewer: analyst, documentId: "assessment-1" }), null, "PARTIAL_RELEASE_RETURNED");
  assert.equal(await findReadableReleasedAssessment({ documents: reading(null), viewer: jane, documentId: "missing" }), null);

  const populate = { assessmentRequest: { populate: { requestor: true } }, approvedBy: true };
  await findReadableReleasedAssessment({ documents: reading(released()), viewer: jane, documentId: "assessment-1", populate });
  assert.deepEqual(queries[queries.length - 1].populate, populate, "CALLER_POPULATE_NOT_USED");
});
