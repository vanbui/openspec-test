import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  AssessmentRequestQueryError,
  RELEASED_REQUEST_STATUSES,
  REVIEWABLE_REQUEST_STATUSES,
  REVIEW_QUEUE_BUCKETS,
  REVIEW_QUEUE_SORT_FIELDS,
  parseAnalystReviewQuery,
  selectReviewQueueBucket,
} from "../src/api/csrm-assessment-request/services/collection-scope";

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/strapi.
const appDir = path.resolve(__dirname, "..", "..", "..");

/** The request-status vocabulary is read from the frozen datamodel, never restated. */
const requestStatuses = (JSON.parse(readFileSync(
  path.join(appDir, "src", "api", "csrm-assessment-request", "content-types", "csrm-assessment-request", "schema.json"),
  "utf8",
)) as { attributes: { requestStatus: { enum: string[] } } }).attributes.requestStatus.enum;

const reviewable = ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"];
/** What each queue reads. No queue reads a draft: it belongs to its Requestor. */
const queueStatuses: Record<string, readonly string[]> = {
  "requires-attention": reviewable,
  "awaiting-requestor": reviewable,
  "generation-in-progress": reviewable,
  released: ["approved", "closed"],
};

const defaultSort = [
  { field: "submittedDate", direction: "asc" },
  { field: "requestNumber", direction: "asc" },
];

const analyst = { csrmAuthorization: { assessmentReviewCollectionScope: "all" as const } };

function request(overrides: Record<string, unknown> = {}) {
  return {
    documentId: "request-1",
    requestStatus: "submitted",
    questionnaire: null,
    assessment: null,
    ...overrides,
  };
}

test("review queue buckets select only their published lifecycle slices", () => {
  assert.deepEqual(REVIEW_QUEUE_BUCKETS, ["requires-attention", "awaiting-requestor", "generation-in-progress", "released"]);
  assert.equal(selectReviewQueueBucket("requires-attention", request(), () => false), true);
  assert.equal(selectReviewQueueBucket("requires-attention", request(), () => true), false);
  assert.equal(selectReviewQueueBucket("awaiting-requestor", request({ requestStatus: "draft" }), () => false), true);
  assert.equal(selectReviewQueueBucket("awaiting-requestor", request({ questionnaire: { releasedAt: "2026-09-21T00:00:00.000Z", questions: [] } }), () => false), true);
  assert.equal(selectReviewQueueBucket("generation-in-progress", request(), () => true), true);
  assert.equal(selectReviewQueueBucket("released", request({ requestStatus: "approved" }), () => false), true);
  assert.equal(selectReviewQueueBucket("released", request(), () => false), false);
});

/*
 * The two status sets are the queues' read bounds. They are exported so the
 * database repository and the Phase 7 alert rules bound their reads with the
 * same literal sets, and frozen so no consumer can widen them at run time.
 */
test("the review queue status sets are the four reviewable and the two released statuses", () => {
  assert.deepEqual(REVIEWABLE_REQUEST_STATUSES, ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"]);
  assert.deepEqual(RELEASED_REQUEST_STATUSES, ["approved", "closed"]);
  assert.equal(Object.isFrozen(REVIEWABLE_REQUEST_STATUSES), true, "REVIEWABLE_STATUSES_MUTABLE");
  assert.equal(Object.isFrozen(RELEASED_REQUEST_STATUSES), true, "RELEASED_STATUSES_MUTABLE");
  assert.deepEqual(REVIEW_QUEUE_SORT_FIELDS, ["dueDate", "submittedDate", "requestNumber", "title", "requestStatus", "updatedAt"]);
});

/*
 * GAP-1 (06.9-04): the status filter accepts the complete request-status
 * vocabulary in every queue and intersects it with the queue. A status the queue
 * does not read selects nothing, so the parser answers "outside-queue" and no
 * read is described at all; a status the queue does read narrows the queue's
 * own status set to exactly that status.
 */
test("the review status filter accepts every request status and intersects it with the selected queue", () => {
  assert.deepEqual(requestStatuses, [
    "draft", "submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review", "approved", "closed",
  ], "REQUEST_STATUS_VOCABULARY_CHANGED");

  for (const queue of REVIEW_QUEUE_BUCKETS) {
    for (const requestStatus of requestStatuses) {
      const label = `${queue}_${requestStatus}`;
      const parsed = parseAnalystReviewQuery({
        filters: { queue, requestStatus },
        pagination: { page: 2, pageSize: 10 },
      }, analyst);
      if (queueStatuses[queue].includes(requestStatus)) {
        assert.deepEqual(parsed, {
          kind: "read",
          pagination: { page: 2, pageSize: 10 },
          bucket: queue,
          statuses: [requestStatus],
          sort: defaultSort,
        }, `IN_QUEUE_STATUS_NOT_NARROWED_${label}`);
      } else {
        assert.deepEqual(parsed, {
          kind: "outside-queue",
          pagination: { page: 2, pageSize: 10 },
          bucket: queue,
        }, `OUTSIDE_QUEUE_STATUS_NOT_EMPTY_${label}`);
      }
    }

    const unfiltered = parseAnalystReviewQuery({ filters: { queue } }, analyst);
    assert.deepEqual(unfiltered, {
      kind: "read",
      pagination: { page: 1, pageSize: 25 },
      bucket: queue,
      statuses: [...queueStatuses[queue]],
      sort: defaultSort,
    }, `UNFILTERED_QUEUE_BOUND_${queue}`);
  }
});

test("the review status filter still rejects anything that is not exactly one request status", () => {
  for (const requestStatus of ["bogus", "Approved", "", " approved", ["approved"], ["submitted", "approved"], { $eq: "approved" }, { $in: ["approved"] }, 1, null]) {
    assert.throws(
      () => parseAnalystReviewQuery({ filters: { requestStatus } }, analyst),
      AssessmentRequestQueryError,
      `MALFORMED_STATUS_ACCEPTED_${JSON.stringify(requestStatus)}`,
    );
  }

  // An outside-queue status answers without reading, but never before the rest
  // of the query has been validated.
  for (const query of [
    { filters: { requestStatus: "approved" }, sort: "createdBy:desc" },
    { filters: { requestStatus: "approved" }, sort: "createdAt:asc" },
    { filters: { requestStatus: "approved" }, sort: ["title", "dueDate", "requestNumber"] },
    { filters: { requestStatus: "approved" }, sort: "title:sideways" },
    { filters: { requestStatus: "approved", dueDate: "2026-02-30" } },
    { filters: { requestStatus: "approved", title: "" } },
    { filters: { requestStatus: "approved", requestor: "forged" } },
    { filters: { requestStatus: "approved" }, pagination: { pageSize: 101 } },
    { filters: { requestStatus: "approved" }, pagination: { page: 0 } },
    { filters: { requestStatus: "draft", queue: "unknown" } },
  ]) {
    assert.throws(
      () => parseAnalystReviewQuery(query, analyst),
      AssessmentRequestQueryError,
      `OUTSIDE_QUEUE_STATUS_SKIPPED_VALIDATION_${JSON.stringify(query)}`,
    );
  }
});

test("the parsed review read carries the default order and round-trips the text and date filters", () => {
  assert.deepEqual(parseAnalystReviewQuery({}, analyst), {
    kind: "read",
    pagination: { page: 1, pageSize: 25 },
    bucket: "requires-attention",
    statuses: reviewable,
    sort: defaultSort,
  }, "DEFAULT_READ_CHANGED");

  assert.deepEqual(parseAnalystReviewQuery({
    filters: { queue: "released", title: "Payroll 50%_off", requestNumber: "rar-2026", dueDate: "2026-10-01" },
    sort: ["dueDate:desc", "title"],
    pagination: { page: "3", pageSize: "100" },
  }, analyst), {
    kind: "read",
    pagination: { page: 3, pageSize: 100 },
    bucket: "released",
    statuses: ["approved", "closed"],
    title: "Payroll 50%_off",
    requestNumber: "rar-2026",
    dueDate: "2026-10-01",
    sort: [{ field: "dueDate", direction: "desc" }, { field: "title", direction: "asc" }],
  }, "FILTERED_READ_CHANGED");

  for (const field of REVIEW_QUEUE_SORT_FIELDS) {
    const parsed = parseAnalystReviewQuery({ sort: `${field}:desc` }, analyst);
    assert.equal(parsed.kind, "read", `SORT_FIELD_NOT_READ_${field}`);
    assert.deepEqual(parsed.kind === "read" ? parsed.sort : null, [{ field, direction: "desc" }], `SORT_FIELD_NOT_PARSED_${field}`);
  }
});

test("the review read is refused without the analyst review scope", () => {
  for (const state of [undefined, null, {}, { csrmAuthorization: {} }, { csrmAuthorization: { assessmentReviewCollectionScope: "own" } }]) {
    assert.throws(
      () => parseAnalystReviewQuery({}, state),
      AssessmentRequestQueryError,
      `REVIEW_READ_WITHOUT_SCOPE_${JSON.stringify(state)}`,
    );
  }
  assert.throws(() => parseAnalystReviewQuery("filters[queue]=released", analyst), AssessmentRequestQueryError, "NON_OBJECT_QUERY_ACCEPTED");
  assert.throws(() => parseAnalystReviewQuery({ populate: "requestor" }, analyst), AssessmentRequestQueryError, "UNKNOWN_QUERY_KEY_ACCEPTED");
});
