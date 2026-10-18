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
  projectAnalystReviewRequest,
  selectReviewQueueBucket,
} from "../src/api/csrm-assessment-request/services/collection-scope";

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
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
  // Every submitted request not yet released, at any step (13-12; D-13).
  open: reviewable,
  released: ["approved", "closed"],
  // Every request in review scope, reviewable or released, and never a draft (D-30).
  all: [...reviewable, "approved", "closed"],
};

const defaultSort = [
  { field: "submittedDate", direction: "asc" },
  { field: "requestNumber", direction: "asc" },
];

const analyst = { csrmAuthorization: { assessmentReviewCollectionScope: "all" as const } };

/** The queue's viewer (13-12): Bob, a human Security Analyst, with no new notes anywhere. */
const bob = { documentId: "bob", humanAnalyst: true, eligibleHumanAnalyst: true };
const noUnread: ReadonlyMap<string, number> = new Map();

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
  assert.deepEqual(REVIEW_QUEUE_BUCKETS, ["requires-attention", "awaiting-requestor", "generation-in-progress", "open", "released", "all"]);
  assert.equal(selectReviewQueueBucket("requires-attention", request(), () => false), true);
  assert.equal(selectReviewQueueBucket("requires-attention", request(), () => true), false);
  assert.equal(selectReviewQueueBucket("awaiting-requestor", request({ requestStatus: "draft" }), () => false), true);
  assert.equal(selectReviewQueueBucket("awaiting-requestor", request({ questionnaire: { releasedAt: "2026-09-21T00:00:00.000Z", questions: [] } }), () => false), true);
  assert.equal(selectReviewQueueBucket("generation-in-progress", request(), () => true), true);
  assert.equal(selectReviewQueueBucket("released", request({ requestStatus: "approved" }), () => false), true);
  assert.equal(selectReviewQueueBucket("released", request(), () => false), false);
  // All requests reads every lifecycle step inside its status bound, generating or not.
  assert.equal(selectReviewQueueBucket("all", request(), () => true), true);
  assert.equal(selectReviewQueueBucket("all", request({ requestStatus: "approved" }), () => false), true);
  assert.equal(selectReviewQueueBucket("all", request({ questionnaire: { releasedAt: "2026-09-21T00:00:00.000Z", questions: [] } }), () => false), true);
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

/*
 * D-02 item 1 and D-29: a queue row carries the facts the analyst triages by.
 * The days since submission are counted by the server from its own UTC today,
 * from the UTC calendar date of the submission instant, so every viewer reads
 * the same figure and no browser clock is consulted.
 */
test("a queue item carries the requestor's name, type, criticality, due date and days since submission", () => {
  const document = {
    documentId: "request-1",
    requestNumber: "RAR-2026-TRIAGE",
    title: "Customer portal",
    requestStatus: "submitted",
    submittedDate: "2026-09-27T23:30:00.000Z",
    assessmentType: "Project",
    businessCriticality: "High",
    dueDate: "2026-10-30",
    requestor: { displayName: "Jane Requestor" },
  };

  assert.deepEqual(projectAnalystReviewRequest(document, "2026-10-01", bob, noUnread), {
    documentId: "request-1",
    requestNumber: "RAR-2026-TRIAGE",
    title: "Customer portal",
    requestStatus: "submitted",
    submittedDate: "2026-09-27T23:30:00.000Z",
    requestorName: "Jane Requestor",
    assessmentType: "Project",
    businessCriticality: "High",
    dueDate: "2026-10-30",
    daysSinceSubmission: 4,
    assignee: null,
    pickUp: "allowed",
    unreadNotes: 0,
  }, "QUEUE_ITEM_TRIAGE_FIELDS");

  // Submitted today reads zero days; the count is never negative, even for a
  // submission stamped after the server's today.
  assert.equal(projectAnalystReviewRequest({ ...document, submittedDate: "2026-10-01T00:00:00.000Z" }, "2026-10-01", bob, noUnread).daysSinceSubmission, 0, "SUBMITTED_TODAY_NOT_ZERO");
  assert.equal(projectAnalystReviewRequest({ ...document, submittedDate: "2026-10-02T01:00:00.000Z" }, "2026-10-01", bob, noUnread).daysSinceSubmission, 0, "FUTURE_SUBMISSION_NEGATIVE");
});

test("a queue item reads null for each triage fact the request does not record", () => {
  const projected = projectAnalystReviewRequest({
    documentId: "request-2",
    requestNumber: "RAR-2026-BARE",
    title: "Bare request",
    requestStatus: "submitted",
  }, "2026-10-01", bob, noUnread);

  assert.deepEqual(projected, {
    documentId: "request-2",
    requestNumber: "RAR-2026-BARE",
    title: "Bare request",
    requestStatus: "submitted",
    submittedDate: null,
    requestorName: null,
    assessmentType: null,
    businessCriticality: null,
    dueDate: null,
    daysSinceSubmission: null,
    assignee: null,
    pickUp: "allowed",
    unreadNotes: 0,
  }, "QUEUE_ITEM_MISSING_FACTS_NOT_NULL");

  // The requestor contributes their display name alone, never another field.
  const withRequestor = projectAnalystReviewRequest({
    documentId: "request-3",
    requestNumber: "RAR-2026-WHO",
    title: "Who asked",
    requestStatus: "submitted",
    requestor: { id: 7, documentId: "jane", email: "jane.doe@idambox.com", displayName: "Jane Doe" },
  }, "2026-10-01", bob, noUnread);
  assert.equal(withRequestor.requestorName, "Jane Doe", "REQUESTOR_NAME_NOT_PROJECTED");
  assert.equal(JSON.stringify(withRequestor).includes("jane.doe@idambox.com"), false, "REQUESTOR_EMAIL_PROJECTED");
  assert.equal("requestor" in withRequestor, false, "REQUESTOR_RELATION_PROJECTED");
  assert.equal(projectAnalystReviewRequest({ ...withRequestor, requestor: { displayName: "" } }, "2026-10-01", bob, noUnread).requestorName, null, "BLANK_REQUESTOR_NAME_NOT_NULL");
  assert.equal(projectAnalystReviewRequest({ ...withRequestor, requestor: { displayName: "x".repeat(255) } }, "2026-10-01", bob, noUnread).requestorName, "x".repeat(255), "BOUNDED_REQUESTOR_NAME_DROPPED");
  assert.equal(projectAnalystReviewRequest({ ...withRequestor, requestor: { displayName: "x".repeat(256) } }, "2026-10-01", bob, noUnread).requestorName, null, "OVERLONG_REQUESTOR_NAME_NOT_NULL");
});

/*
 * D-13 (13-12): each item names who holds the request (documentId and display name only), whether this viewer may
 * pick it up (pickUpState, the assignment operation's own rule) and the viewer's new notes on it.
 */
test("a queue item names its assignee, whether the viewer may pick it up, and the viewer's new notes", () => {
  const base = { documentId: "request-4", requestNumber: "RAR-2026-HELD", title: "Held request", requestStatus: "submitted" };
  const unread = new Map([["request-4", 3]]);

  const held = projectAnalystReviewRequest({
    ...base,
    requestor: { documentId: "jane", displayName: "Jane Doe" },
    assignedAnalyst: { id: 9, documentId: "second", displayName: "Second Analyst", email: "second.analyst@example.test", username: "second-analyst" },
  }, "2026-10-01", bob, unread);
  assert.deepEqual(held.assignee, { documentId: "second", displayName: "Second Analyst" }, "ASSIGNEE_NOT_PROJECTED_AS_PERSON");
  assert.equal(held.pickUp, "not-offered", "HELD_REQUEST_OFFERED");
  assert.equal(held.unreadNotes, 3, "UNREAD_COUNT_NOT_READ_FROM_THE_MAP");
  assert.equal(JSON.stringify(held).includes("example.test"), false, "ASSIGNEE_EMAIL_PROJECTED");
  assert.equal(JSON.stringify(held).includes("second-analyst"), false, "ASSIGNEE_USERNAME_PROJECTED");

  const own = projectAnalystReviewRequest({ ...base, requestor: { documentId: "bob", displayName: "Bob Doe" } }, "2026-10-01", bob, noUnread);
  assert.equal(own.assignee, null, "UNASSIGNED_NOT_NULL");
  assert.equal(own.pickUp, "own-request", "OWN_REQUEST_NOT_NAMED");
  assert.equal(own.unreadNotes, 0, "MISSING_UNREAD_NOT_ZERO");

  const open = projectAnalystReviewRequest({ ...base, requestor: { documentId: "jane", displayName: "Jane Doe" } }, "2026-10-01", bob, noUnread);
  assert.equal(open.pickUp, "allowed", "UNASSIGNED_NOT_OFFERED");
  const toAgent = projectAnalystReviewRequest({ ...base, requestor: { documentId: "jane", displayName: "Jane Doe" } }, "2026-10-01", { documentId: "agent", humanAnalyst: false, eligibleHumanAnalyst: false }, noUnread);
  assert.equal(toAgent.pickUp, "not-offered", "NON_HUMAN_VIEWER_OFFERED");
  // WR-101: a human analyst who also holds the Agent role is not an eligible person, so nothing is offered to them.
  const toDualRole = projectAnalystReviewRequest({ ...base, requestor: { documentId: "jane", displayName: "Jane Doe" } }, "2026-10-01", { documentId: "dual", humanAnalyst: true, eligibleHumanAnalyst: false }, noUnread);
  assert.equal(toDualRole.pickUp, "not-offered", "DUAL_ROLE_VIEWER_OFFERED");
  assert.equal("requestor" in open || "assignedAnalyst" in open, false, "PERSON_RELATION_PROJECTED");
});

/*
 * D-30: the queue search matches the request number or the title through
 * filters[q], so a search for a request number finds the request. The term is
 * one string of 1 to 200 characters; anything else is malformed.
 */
test("the review search term is one string of 1 to 200 characters", () => {
  for (const q of ["R", "RAR-2026-5WWFVQ", "payroll 50%_off", "x".repeat(200)]) {
    const parsed = parseAnalystReviewQuery({ filters: { q } }, analyst);
    assert.equal(parsed.kind, "read", `SEARCH_NOT_READ_${q.length}`);
    assert.equal(parsed.kind === "read" ? parsed.q : undefined, q, `SEARCH_TERM_NOT_CARRIED_${q.length}`);
  }
  for (const q of ["", "x".repeat(201), ["RAR"], { $containsi: "RAR" }, 7, null]) {
    assert.throws(
      () => parseAnalystReviewQuery({ filters: { q } }, analyst),
      AssessmentRequestQueryError,
      `MALFORMED_SEARCH_ACCEPTED_${JSON.stringify(q)?.slice(0, 20)}`,
    );
  }
  // The search still meets the rest of the validation before an outside-queue answer.
  assert.throws(
    () => parseAnalystReviewQuery({ filters: { q: "", requestStatus: "approved" } }, analyst),
    AssessmentRequestQueryError,
    "OUTSIDE_QUEUE_STATUS_SKIPPED_SEARCH_VALIDATION",
  );
});

test("the All requests queue reads every reviewable and released status and never a draft", () => {
  assert.deepEqual(parseAnalystReviewQuery({ filters: { queue: "all" } }, analyst), {
    kind: "read",
    pagination: { page: 1, pageSize: 25 },
    bucket: "all",
    statuses: ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review", "approved", "closed"],
    sort: defaultSort,
  }, "ALL_QUEUE_BOUND_CHANGED");
  assert.deepEqual(parseAnalystReviewQuery({ filters: { queue: "all", requestStatus: "approved", q: "RAR-2026" } }, analyst), {
    kind: "read",
    pagination: { page: 1, pageSize: 25 },
    bucket: "all",
    statuses: ["approved"],
    q: "RAR-2026",
    sort: defaultSort,
  }, "ALL_QUEUE_STATUS_NOT_NARROWED");
  assert.deepEqual(parseAnalystReviewQuery({ filters: { queue: "all", requestStatus: "draft" } }, analyst), {
    kind: "outside-queue",
    pagination: { page: 1, pageSize: 25 },
    bucket: "all",
  }, "ALL_QUEUE_READS_A_DRAFT");
  for (const queue of ["All", "Open", "assigned-to-me", "mine", ["all"], ""]) {
    assert.throws(
      () => parseAnalystReviewQuery({ filters: { queue } }, analyst),
      AssessmentRequestQueryError,
      `UNKNOWN_QUEUE_ACCEPTED_${JSON.stringify(queue)}`,
    );
  }
});

/*
 * D-13 (13-12): the open queue is every submitted request not yet released, at any step; the assignee and notes
 * filters are orthogonal to the queue, closed enums, and read the viewer from the policy, never from the query
 * (T-13-40, T-13-41). "Assigned to me" is assignee=me over open, not a queue (2026-10-01 confirmation).
 */
const analystViewer = { csrmAuthorization: { assessmentReviewCollectionScope: "all" as const, viewerId: 7, humanAnalyst: true } };

test("the open queue reads every reviewable status and no released status or draft, and its oracle agrees", () => {
  assert.deepEqual(parseAnalystReviewQuery({ filters: { queue: "open" } }, analyst), {
    kind: "read",
    pagination: { page: 1, pageSize: 25 },
    bucket: "open",
    statuses: reviewable,
    sort: defaultSort,
  }, "OPEN_QUEUE_BOUND_CHANGED");
  for (const requestStatus of requestStatuses) {
    const expected = reviewable.includes(requestStatus);
    assert.equal(selectReviewQueueBucket("open", request({ requestStatus }), () => false), expected, `OPEN_ORACLE_${requestStatus}`);
    // Generating or not, released to the Requestor or not: open reads every step.
    assert.equal(selectReviewQueueBucket("open", request({ requestStatus, questionnaire: { releasedAt: "2026-09-21T00:00:00.000Z", questions: [] } }), () => true), expected, `OPEN_ORACLE_ANY_STEP_${requestStatus}`);
  }
});

test("the assignee and notes filters are closed values that carry the policy's viewer, never one from the query", () => {
  for (const assignee of ["me", "unassigned"] as const) {
    assert.deepEqual(parseAnalystReviewQuery({ filters: { queue: "open", assignee } }, analystViewer), {
      kind: "read",
      pagination: { page: 1, pageSize: 25 },
      bucket: "open",
      statuses: reviewable,
      assignee,
      viewerId: 7,
      sort: defaultSort,
    }, `ASSIGNEE_FILTER_NOT_READ_${assignee}`);
  }
  assert.deepEqual(parseAnalystReviewQuery({ filters: { notes: "unread", assignee: "me", queue: "requires-attention" } }, analystViewer), {
    kind: "read",
    pagination: { page: 1, pageSize: 25 },
    bucket: "requires-attention",
    statuses: reviewable,
    assignee: "me",
    notesUnread: true,
    viewerId: 7,
    humanAnalyst: true,
    sort: defaultSort,
  }, "NOTES_FILTER_NOT_READ");

  for (const filters of [
    { assignee: "anyone" }, { assignee: "Me" }, { assignee: "" }, { assignee: ["me"] }, { assignee: { $eq: "me" } }, { assignee: 7 },
    { assignee: "second-analyst-document-id" },
    { notes: "read" }, { notes: "all" }, { notes: "" }, { notes: ["unread"] }, { notes: true },
    { viewer: "7" }, { viewerId: 7 },
  ]) {
    assert.throws(
      () => parseAnalystReviewQuery({ filters }, analystViewer),
      AssessmentRequestQueryError,
      `MALFORMED_FILTER_ACCEPTED_${JSON.stringify(filters)}`,
    );
  }
  // Without the policy's viewer id there is nobody to filter for: refused, never widened.
  for (const filters of [{ assignee: "me" }, { assignee: "unassigned" }, { notes: "unread" }]) {
    assert.throws(() => parseAnalystReviewQuery({ filters }, analyst), AssessmentRequestQueryError, `FILTER_WITHOUT_VIEWER_${JSON.stringify(filters)}`);
    for (const viewerId of [0, -1, 1.5, "7", null]) {
      const state = { csrmAuthorization: { assessmentReviewCollectionScope: "all" as const, viewerId, humanAnalyst: true } };
      assert.throws(() => parseAnalystReviewQuery({ filters }, state), AssessmentRequestQueryError, `FILTER_WITH_BAD_VIEWER_${String(viewerId)}`);
    }
  }
  // A status outside the queue still meets the filter validation first.
  assert.throws(
    () => parseAnalystReviewQuery({ filters: { queue: "open", requestStatus: "approved", assignee: "anyone" } }, analystViewer),
    AssessmentRequestQueryError,
    "OUTSIDE_QUEUE_STATUS_SKIPPED_FILTER_VALIDATION",
  );
  // Reads without either filter are unchanged by the viewer's facts.
  assert.deepEqual(parseAnalystReviewQuery({}, analystViewer), parseAnalystReviewQuery({}, analyst), "VIEWER_FACTS_CHANGED_AN_UNFILTERED_READ");
});
