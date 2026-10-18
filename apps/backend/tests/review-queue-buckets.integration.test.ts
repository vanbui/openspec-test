import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness, type ReviewQueueBucketFixture } from "./helpers/strapi-http-harness";
import { selectReviewQueueBucket } from "../src/api/csrm-assessment-request/services/collection-scope";
import { utcToday } from "../src/csrm/insights/utc-date";

/*
 * D-21 and D-30: every analyst review queue is an exact database result at any
 * volume, and agrees with the semantic lifecycle rule at every lifecycle step.
 * The mounted seam is GET /api/v1/assessment_requests as the analyst; the
 * shared-counter seam is the application's own countReviewQueueBucket, which
 * the analyst dashboard reuses.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

type Bucket = ReviewQueueBucketFixture;
/** The four lifecycle queues: All requests is their status union, proved on its own below. */
const BUCKETS: readonly Bucket[] = ["requires-attention", "awaiting-requestor", "generation-in-progress", "released"];
const REVIEWABLE: readonly string[] = ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"];
/** What each queue reads, restated literally so the test never trusts the implementation's own sets. */
const QUEUE_STATUSES: Readonly<Record<Bucket, readonly string[]>> = {
  "requires-attention": REVIEWABLE,
  "awaiting-requestor": REVIEWABLE,
  "generation-in-progress": REVIEWABLE,
  open: REVIEWABLE,
  released: ["approved", "closed"],
  all: [...REVIEWABLE, "approved", "closed"],
};
const ITEM_KEYS = [
  "assessmentType", "assignee", "businessCriticality", "daysSinceSubmission", "documentId", "dueDate",
  "pickUp", "requestNumber", "requestStatus", "requestorName", "submittedDate", "title", "unreadNotes",
];
const DAY_MS = 86_400_000;

/**
 * Whole days from a UTC calendar date to `today`, counted here from the two
 * dates rather than by the implementation's own calendar helpers.
 */
function daysFrom(date: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${date}T00:00:00.000Z`)) / DAY_MS);
}

/**
 * The days since submission the server may serve during a read: its UTC today
 * is read once per request, and the day can turn between the two clock reads.
 */
function servedDaysSince(date: string, before: string, after: string): number[] {
  return [...new Set([daysFrom(date, before), daysFrom(date, after)])];
}

type Pagination = { page: number; pageSize: number; pageCount: number; total: number };
type Person = { documentId: string; displayName: string };
type QueuePage = { rows: Array<Record<string, unknown>>; pagination: Pagination; viewer: Person | undefined };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function queueQuery(parameters: ReadonlyArray<readonly [string, string]>): string {
  return parameters.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

async function readQueue(parameters: ReadonlyArray<readonly [string, string]>, identity?: string): Promise<QueuePage> {
  const harness = await harnessPromise;
  const query = queueQuery(parameters);
  const response = await harness.request({ path: `/api/v1/assessment_requests?${query}`, identity: identity ?? harness.identities.analyst });
  assert.equal(response.status, 200, `REVIEW_QUEUE_READ_FAILED_${query}`);
  const body = await response.json() as { data?: unknown; meta?: { pagination?: Pagination; viewer?: Person } };
  assert.ok(Array.isArray(body.data), `REVIEW_QUEUE_DATA_NOT_A_LIST_${query}`);
  assert.ok(body.meta?.pagination, `REVIEW_QUEUE_PAGINATION_MISSING_${query}`);
  return { rows: body.data as Array<Record<string, unknown>>, pagination: body.meta.pagination, viewer: body.meta.viewer };
}

const idsOf = (page: QueuePage) => page.rows.map((row) => String(row.documentId));
const numbersOf = (page: QueuePage) => page.rows.map((row) => String(row.requestNumber));

type Expected = Bucket | "none";
type LifecycleFixture = { step: string; documentId: string; expected: Expected };

/*
 * One owner request per lifecycle step, with the questionnaire, answers and
 * assessment that step implies. The numbered steps are reachable states. X1 is
 * not (an assessment is only drafted from a submitted questionnaire); it is kept
 * because it is the only fixture whose action-queue membership rests on the
 * assessment existing alone.
 */
async function buildLifecycleFixtures(): Promise<LifecycleFixture[]> {
  const harness = await harnessPromise;
  const analyst = harness.users.analyst;
  const request = (step: string, requestStatus: string, day: number) => harness.createAssessmentRequestFixture({
    requestNumber: `RQB-STEP-${step}`,
    title: `Lifecycle step ${step}`,
    requestStatus,
    requestor: "owner",
    submittedDate: `2026-05-${String(day).padStart(2, "0")}T00:00:00.000Z`,
  });
  const questionnaire = (requestDocumentId: string, released: boolean, answerState: "none" | "draft" | "submitted") =>
    harness.createQuestionnaireLifecycleFixture({ requestDocumentId, released, answerState });
  const assessment = (step: string, requestDocumentId: string, facts: Record<string, unknown>) =>
    harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: `ASM-RQB-${step}`,
      summary: `Lifecycle step ${step} assessment`,
      assessmentRequest: requestDocumentId,
      ...facts,
    });
  const approval = { approvalDate: "2026-08-30T00:00:00.000Z", assessmentDate: "2026-08-30T00:00:00.000Z" };

  const fixtures: LifecycleFixture[] = [];
  const add = (step: string, documentId: string, expected: Expected) => { fixtures.push({ step, documentId, expected }); };

  // 1. Submitted, nothing generated yet: the analyst generates the questionnaire.
  add("01", await request("01", "submitted", 1), "requires-attention");

  // 2. Generated, not yet released: the analyst reviews and releases it.
  const step02 = await request("02", "questionnaire-in-progress", 2);
  await questionnaire(step02, false, "draft");
  add("02", step02, "requires-attention");

  // 3. Released, the Requestor is drafting answers.
  const step03 = await request("03", "questionnaire-in-progress", 3);
  await questionnaire(step03, true, "draft");
  add("03", step03, "awaiting-requestor");

  // 4. Released, the Requestor has not answered anything yet.
  const step04 = await request("04", "questionnaire-in-progress", 4);
  await questionnaire(step04, true, "none");
  add("04", step04, "awaiting-requestor");

  // 5. Released and submitted: the analyst drafts the assessment.
  const step05 = await request("05", "questionnaire-in-progress", 5);
  await questionnaire(step05, true, "submitted");
  add("05", step05, "requires-attention");

  // 6. Assessment drafted.
  const step06 = await request("06", "risk-assessment-drafted", 6);
  await questionnaire(step06, true, "submitted");
  await assessment("06", step06, { assessmentStatus: "draft" });
  add("06", step06, "requires-attention");

  // 7. Assessment in review.
  const step07 = await request("07", "under-review", 7);
  await questionnaire(step07, true, "submitted");
  await assessment("07", step07, { assessmentStatus: "in-review", reviewedBy: analyst });
  add("07", step07, "requires-attention");

  // 8. Approved but without an approver: partial release facts are not a release.
  const step08 = await request("08", "under-review", 8);
  await questionnaire(step08, true, "submitted");
  await assessment("08", step08, { assessmentStatus: "approved", ...approval });
  add("08", step08, "requires-attention");

  // 9. Released with the complete release triple.
  const step09 = await request("09", "approved", 9);
  await questionnaire(step09, true, "submitted");
  await assessment("09", step09, { assessmentStatus: "approved", approvedBy: analyst, reviewedBy: analyst, ...approval });
  add("09", step09, "released");

  // 10. Closed.
  const step10 = await request("10", "closed", 10);
  await questionnaire(step10, true, "submitted");
  await assessment("10", step10, { assessmentStatus: "approved", approvedBy: analyst, reviewedBy: analyst, ...approval });
  add("10", step10, "released");

  // 11. A draft belongs to its Requestor and is in no queue.
  add("11", await request("11", "draft", 11), "none");

  // X1. Released questionnaire still in draft, yet an assessment exists.
  const stepX1 = await request("X1", "questionnaire-in-progress", 12);
  await questionnaire(stepX1, true, "draft");
  await assessment("X1", stepX1, { assessmentStatus: "draft" });
  add("X1", stepX1, "requires-attention");

  return fixtures;
}

let lifecycleFixturesPromise: Promise<LifecycleFixture[]> | null = null;
const lifecycleFixtures = () => (lifecycleFixturesPromise ??= buildLifecycleFixtures());
const lifecycleId = async (step: string) => {
  const fixture = (await lifecycleFixtures()).find((candidate) => candidate.step === step);
  assert.ok(fixture, `LIFECYCLE_FIXTURE_MISSING_${step}`);
  return fixture.documentId;
};

/*
 * The oracle is the semantic rule over the fully populated document, applied
 * within the queue's own status bound, exactly as the application applies it:
 * the rule itself does not read the bound (to it, a draft is "awaiting the
 * Requestor"), because no queue ever reads a draft in the first place.
 */
function oracleMembership(bucket: Bucket, document: Record<string, unknown>): boolean {
  return QUEUE_STATUSES[bucket].includes(String(document.requestStatus))
    && selectReviewQueueBucket(bucket, document, () => false);
}

/** Proves the oracle is fed the relations it reads, not an under-populated document (research pitfall 4). */
function assertFullyPopulated(step: string, document: Record<string, unknown>): void {
  if (isRecord(document.questionnaire)) {
    assert.ok(Array.isArray(document.questionnaire.questions), `LIFECYCLE_QUESTIONS_NOT_POPULATED_${step}`);
  }
  if (isRecord(document.assessment)) {
    for (const relation of ["approvedBy", "reviewedBy", "risks"]) {
      assert.ok(relation in document.assessment, `LIFECYCLE_ASSESSMENT_${relation}_NOT_POPULATED_${step}`);
    }
  }
}

async function assertQueueMemberships(fixtures: readonly LifecycleFixture[]): Promise<void> {
  const harness = await harnessPromise;
  const members = new Map<Bucket, Set<string>>();
  for (const bucket of BUCKETS) {
    const page = await readQueue([["filters[queue]", bucket], ["pagination[pageSize]", "100"]]);
    // One page holds every member, so membership is read from the whole queue.
    assert.ok(page.pagination.total <= 100, `LIFECYCLE_QUEUE_TOO_LARGE_FOR_ONE_PAGE_${bucket}`);
    assert.equal(page.rows.length, page.pagination.total, `LIFECYCLE_QUEUE_PAGE_INCOMPLETE_${bucket}`);
    members.set(bucket, new Set(idsOf(page)));
  }
  for (const fixture of fixtures) {
    const document = await harness.getRequestLifecycleDocument(fixture.documentId);
    assert.ok(document, `LIFECYCLE_DOCUMENT_MISSING_${fixture.step}`);
    assertFullyPopulated(fixture.step, document);
    for (const bucket of BUCKETS) {
      const label = `${fixture.step}_${bucket}`;
      const served = members.get(bucket)?.has(fixture.documentId) ?? false;
      assert.equal(served, fixture.expected === bucket, `LIFECYCLE_BUCKET_MEMBERSHIP_${label}`);
      assert.equal(served, oracleMembership(bucket, document), `LIFECYCLE_ORACLE_DISAGREES_${label}`);
    }
  }
}

test("every lifecycle step lands in exactly the queue the semantic rule assigns (D-30)", async () => {
  await assertQueueMemberships(await lifecycleFixtures());
});

/*
 * A released assessment takes its request out of the action queues, even while
 * the request itself still reads "under review". The release transaction also
 * approves the request, so production never holds this state; it is the one
 * fixture that shows the queue implements the release rule itself. The former
 * scan populated the assessment without its approver, so to it no assessment
 * was ever released (research Q3).
 */
test("a request whose assessment is released is in no action queue, whatever its request status says", async () => {
  const harness = await harnessPromise;
  await lifecycleFixtures();
  const requestDocumentId = await harness.createAssessmentRequestFixture({
    requestNumber: "RQB-STEP-X2",
    title: "Lifecycle step X2",
    requestStatus: "under-review",
    requestor: "owner",
    submittedDate: "2026-05-13T00:00:00.000Z",
  });
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId, released: true, answerState: "submitted" });
  await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASM-RQB-X2",
    summary: "Lifecycle step X2 assessment",
    assessmentRequest: requestDocumentId,
    assessmentStatus: "approved",
    approvedBy: harness.users.analyst,
    reviewedBy: harness.users.analyst,
    approvalDate: "2026-08-30T00:00:00.000Z",
    assessmentDate: "2026-08-30T00:00:00.000Z",
  });
  await assertQueueMemberships([{ step: "X2", documentId: requestDocumentId, expected: "none" }]);
});

type FilterFixtures = {
  ordering: Record<"A" | "B" | "C" | "D" | "E", string>;
  escape: Record<"percent" | "percentWildcard" | "underscore" | "underscoreWildcard" | "bang", string>;
};

/*
 * Submitted requests with nothing generated, so every one of them requires
 * attention. The ordering probes are created A to E, so their ids ascend in that
 * order; B has no submission or due date, and A and D share a submission date.
 */
async function buildFilterFixtures(): Promise<FilterFixtures> {
  const harness = await harnessPromise;
  const submitted = (requestNumber: string, title: string, submittedDate: string | null, dueDate: string | null) =>
    harness.createAssessmentRequestFixture({ requestNumber, title, requestStatus: "submitted", requestor: "owner", submittedDate, dueDate });
  const A = await submitted("RQB-ORD-A", "Ordering probe A", "2026-03-01T00:00:00.000Z", "2026-11-10");
  const B = await submitted("RQB-ORD-B", "Ordering probe B", null, null);
  const C = await submitted("RQB-ORD-C", "Ordering probe C", "2026-02-01T00:00:00.000Z", "2026-10-05");
  const D = await submitted("RQB-ORD-D", "Ordering probe D", "2026-03-01T00:00:00.000Z", null);
  const E = await submitted("RQB-ORD-E", "Ordering probe E", "2026-01-15T00:00:00.000Z", "2026-12-01");
  const percent = await submitted("RQB-ESC_1", "Escape probe 50% complete", "2026-04-01T00:00:00.000Z", null);
  const percentWildcard = await submitted("RQB-ESCX1", "Escape probe 500 units", "2026-04-02T00:00:00.000Z", null);
  const underscore = await submitted("RQB-ESC-3", "Escape probe under_score", "2026-04-03T00:00:00.000Z", null);
  const underscoreWildcard = await submitted("RQB-ESC-4", "Escape probe underXscore", "2026-04-04T00:00:00.000Z", null);
  const bang = await submitted("RQB-ESC-5", "Escape probe bang! mark", "2026-04-05T00:00:00.000Z", null);
  return {
    ordering: { A, B, C, D, E },
    escape: { percent, percentWildcard, underscore, underscoreWildcard, bang },
  };
}

let filterFixturesPromise: Promise<FilterFixtures> | null = null;
const filterFixtures = () => (filterFixturesPromise ??= buildFilterFixtures());

test("the queue text, date and status filters match exactly as published", async () => {
  const { ordering } = await filterFixtures();
  const orderingIds = Object.values(ordering).sort();

  // Title and request number match case-insensitively, anywhere in the value.
  const byTitle = await readQueue([["filters[title]", "ORDERING PROBE"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(byTitle).sort(), orderingIds, "TITLE_FILTER_NOT_CASE_INSENSITIVE");
  const byNumber = await readQueue([["filters[requestNumber]", "rqb-ord-"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(byNumber).sort(), orderingIds, "REQUEST_NUMBER_FILTER_NOT_CASE_INSENSITIVE");

  // The due date is an exact match, not a range.
  const due = await readQueue([["filters[dueDate]", "2026-10-05"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(due), [ordering.C], "DUE_DATE_FILTER_NOT_EXACT");
  const dueBefore = await readQueue([["filters[dueDate]", "2026-10-04"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(dueBefore.pagination, { page: 1, pageSize: 100, pageCount: 0, total: 0 }, "DUE_DATE_FILTER_MATCHED_ANOTHER_DAY");

  // The status filter narrows the queue to that one status.
  const inProgress = await readQueue([
    ["filters[queue]", "requires-attention"], ["filters[requestStatus]", "questionnaire-in-progress"], ["pagination[pageSize]", "100"],
  ]);
  assert.ok(inProgress.rows.every((row) => row.requestStatus === "questionnaire-in-progress"), "STATUS_FILTER_NOT_APPLIED");
  assert.deepEqual(
    idsOf(inProgress).sort(),
    [await lifecycleId("02"), await lifecycleId("05"), await lifecycleId("X1")].sort(),
    "STATUS_FILTER_NOT_INTERSECTED_WITH_QUEUE",
  );
  const closed = await readQueue([["filters[queue]", "released"], ["filters[requestStatus]", "closed"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(closed), [await lifecycleId("10")], "RELEASED_STATUS_FILTER_NOT_INTERSECTED");

  // A status outside the queue answers the empty page.
  const outside = await readQueue([["filters[queue]", "requires-attention"], ["filters[requestStatus]", "approved"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(outside.rows, [], "OUTSIDE_QUEUE_STATUS_RETURNED_ROWS");
  assert.deepEqual(outside.pagination, { page: 1, pageSize: 100, pageCount: 0, total: 0 }, "OUTSIDE_QUEUE_STATUS_NOT_EMPTY");
});

test("a percent sign, underscore or exclamation mark in a text filter is matched literally", async () => {
  const { escape } = await filterFixtures();
  const percent = await readQueue([["filters[title]", "50%"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(percent), [escape.percent], "PERCENT_TREATED_AS_WILDCARD");
  const underscore = await readQueue([["filters[title]", "under_score"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(underscore), [escape.underscore], "UNDERSCORE_TREATED_AS_WILDCARD");
  const number = await readQueue([["filters[requestNumber]", "ESC_1"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(number), [escape.percent], "REQUEST_NUMBER_UNDERSCORE_TREATED_AS_WILDCARD");
  const bang = await readQueue([["filters[title]", "bang!"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(bang), [escape.bang], "ESCAPE_CHARACTER_NOT_LITERAL");
});

test("the queue orders, pages and projects exactly as published", async () => {
  const { ordering } = await filterFixtures();
  const { A, B, C, D, E } = ordering;
  const probes: Array<readonly [string, string]> = [["filters[title]", "Ordering probe"]];

  // The default order: submission date ascending with no date first, then request number.
  const todayBefore = utcToday(new Date());
  const byDefault = await readQueue([...probes, ["pagination[pageSize]", "100"]]);
  const todayAfter = utcToday(new Date());
  assert.deepEqual(idsOf(byDefault), [B, E, C, A, D], "DEFAULT_ORDER_CHANGED");

  // A page is the literal slice of that order.
  const secondPage = await readQueue([...probes, ["pagination[page]", "2"], ["pagination[pageSize]", "2"]]);
  assert.deepEqual(idsOf(secondPage), [C, A], "SECOND_PAGE_NOT_THIRD_AND_FOURTH_ROWS");
  assert.deepEqual(secondPage.pagination, { page: 2, pageSize: 2, pageCount: 3, total: 5 }, "SECOND_PAGE_META_CHANGED");

  // No due date sorts first ascending and last descending.
  const dueAscending = idsOf(await readQueue([...probes, ["sort", "dueDate:asc"], ["pagination[pageSize]", "100"]]));
  assert.deepEqual(dueAscending.slice(0, 2).sort(), [B, D].sort(), "NULL_DUE_DATES_NOT_FIRST_ASCENDING");
  assert.deepEqual(dueAscending.slice(2), [C, A, E], "DUE_DATE_ASCENDING_CHANGED");
  const dueDescending = idsOf(await readQueue([...probes, ["sort", "dueDate:desc"], ["pagination[pageSize]", "100"]]));
  assert.deepEqual(dueDescending.slice(0, 3), [E, A, C], "DUE_DATE_DESCENDING_CHANGED");
  assert.deepEqual(dueDescending.slice(3).sort(), [B, D].sort(), "NULL_DUE_DATES_NOT_LAST_DESCENDING");

  // Two explicit keys: no submission date sorts last descending, and the second key breaks the tie.
  const twoKeys = await readQueue([...probes, ["sort", "submittedDate:desc"], ["sort", "requestNumber:desc"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(twoKeys), [D, A, C, E, B], "TWO_KEY_ORDER_CHANGED");

  // The item keeps its ten published keys and values (D-02 item 1).
  for (const row of byDefault.rows) {
    assert.deepEqual(Object.keys(row).sort(), ITEM_KEYS, `REVIEW_QUEUE_ITEM_KEYS_CHANGED_${String(row.requestNumber)}`);
  }
  const rowA = byDefault.rows.find((row) => row.documentId === A);
  assert.ok(
    servedDaysSince("2026-03-01", todayBefore, todayAfter).includes(Number(rowA?.daysSinceSubmission)),
    "REVIEW_QUEUE_ITEM_AGE_WRONG",
  );
  assert.deepEqual(rowA, {
    documentId: A,
    requestNumber: "RQB-ORD-A",
    title: "Ordering probe A",
    requestStatus: "submitted",
    submittedDate: "2026-03-01T00:00:00.000Z",
    requestorName: "Jane Doe",
    assessmentType: null,
    businessCriticality: null,
    dueDate: "2026-11-10",
    daysSinceSubmission: rowA?.daysSinceSubmission,
    assignee: null,
    pickUp: "allowed",
    unreadNotes: 0,
  }, "REVIEW_QUEUE_ITEM_VALUES_CHANGED");
  const rowB = byDefault.rows.find((row) => row.documentId === B);
  assert.equal(rowB?.submittedDate, null, "MISSING_SUBMISSION_DATE_NOT_NULL");
  assert.equal(rowB?.daysSinceSubmission, null, "MISSING_SUBMISSION_AGE_NOT_NULL");
  assert.equal(rowB?.dueDate, null, "MISSING_DUE_DATE_NOT_NULL");

  // The total is the number of rows across every page, each row exactly once.
  const whole = await readQueue([["filters[queue]", "requires-attention"], ["pagination[pageSize]", "100"]]);
  assert.ok(whole.pagination.total <= 100, "REQUIRES_ATTENTION_TOO_LARGE_FOR_ONE_PAGE");
  const paged: string[] = [];
  const pageSize = 7;
  const pageCount = Math.ceil(whole.pagination.total / pageSize);
  for (let page = 1; page <= pageCount; page += 1) {
    const read = await readQueue([["filters[queue]", "requires-attention"], ["pagination[page]", String(page)], ["pagination[pageSize]", String(pageSize)]]);
    assert.deepEqual(read.pagination, { page, pageSize, pageCount, total: whole.pagination.total }, `PAGE_META_INCONSISTENT_${page}`);
    paged.push(...idsOf(read));
  }
  assert.deepEqual(paged, idsOf(whole), "PAGES_DO_NOT_TILE_THE_QUEUE");
  assert.equal(new Set(paged).size, whole.pagination.total, "PAGES_REPEAT_OR_DROP_ROWS");
});

/*
 * D-02 item 1 and D-29: the analyst triages a row by who raised it, its type,
 * its business criticality, its due date and its age. The requestor is named
 * by display name alone: the item carries no email, username or identifier of
 * the requestor (T-11-19).
 */
test("a submitted request reads with its triage facts, and no more of its requestor than the display name", async () => {
  const harness = await harnessPromise;
  const triage = await harness.createAssessmentRequestFixture({
    requestNumber: "RQB-TRIAGE-001",
    title: "Triage probe",
    requestStatus: "submitted",
    requestor: "owner",
    assessmentType: "Project",
    businessCriticality: "High",
    dueDate: "2026-12-15",
    // Late on 20 May in UTC: the age counts from that UTC calendar date.
    submittedDate: "2026-05-20T23:30:00.000Z",
  });

  const todayBefore = utcToday(new Date());
  const page = await readQueue([["filters[requestNumber]", "RQB-TRIAGE-001"]]);
  const todayAfter = utcToday(new Date());
  assert.deepEqual(idsOf(page), [triage], "TRIAGE_PROBE_NOT_READ");
  const [row] = page.rows;
  assert.ok(servedDaysSince("2026-05-20", todayBefore, todayAfter).includes(Number(row.daysSinceSubmission)), "TRIAGE_AGE_WRONG");
  assert.deepEqual(row, {
    documentId: triage,
    requestNumber: "RQB-TRIAGE-001",
    title: "Triage probe",
    requestStatus: "submitted",
    submittedDate: "2026-05-20T23:30:00.000Z",
    requestorName: "Jane Doe",
    assessmentType: "Project",
    businessCriticality: "High",
    dueDate: "2026-12-15",
    daysSinceSubmission: row.daysSinceSubmission,
    assignee: null,
    pickUp: "allowed",
    unreadNotes: 0,
  }, "TRIAGE_FIELDS_WRONG");

  const served = JSON.stringify(row);
  assert.equal(served.includes("jane.doe@idambox.com"), false, "REQUESTOR_EMAIL_SERVED");
  assert.equal(served.includes("jane.doe\""), false, "REQUESTOR_USERNAME_SERVED");
  assert.equal(served.includes(harness.users.owner), false, "REQUESTOR_IDENTIFIER_SERVED");
  assert.equal("requestor" in row, false, "REQUESTOR_RELATION_SERVED");
});

/*
 * D-30: one search box finds a request by its number or by a word of its
 * title, case-insensitively, so a search for "RAR-2026-..." finds the request.
 * The term is bound as a parameter and its wildcards are matched literally
 * (T-11-03).
 */
test("the queue search finds a request by its number or a word of its title, literally", async () => {
  const harness = await harnessPromise;
  const { escape } = await filterFixtures();
  const search = await harness.createAssessmentRequestFixture({
    requestNumber: "RQB-SRCH-001",
    title: "Search probe kestrel",
    requestStatus: "submitted",
    requestor: "owner",
    submittedDate: "2026-05-21T00:00:00.000Z",
  });
  const find = async (q: string, queue = "all") =>
    idsOf(await readQueue([["filters[q]", q], ["filters[queue]", queue], ["pagination[pageSize]", "100"]]));

  assert.deepEqual(await find("RQB-SRCH-001"), [search], "SEARCH_BY_NUMBER_MISSED");
  assert.deepEqual(await find("rqb-srch-001"), [search], "SEARCH_BY_NUMBER_NOT_CASE_INSENSITIVE");
  assert.deepEqual(await find("KESTREL"), [search], "SEARCH_BY_TITLE_WORD_MISSED");
  assert.deepEqual(await find("kestrel", "requires-attention"), [search], "SEARCH_NOT_APPLIED_IN_THE_DEFAULT_QUEUE");
  assert.deepEqual(await find("kestrel", "released"), [], "SEARCH_WIDENED_THE_QUEUE");

  // A percent sign, underscore or exclamation mark matches itself, in the number or the title.
  assert.deepEqual(await find("50%"), [escape.percent], "SEARCH_PERCENT_TREATED_AS_WILDCARD");
  assert.deepEqual(await find("ESC_1"), [escape.percent], "SEARCH_UNDERSCORE_IN_NUMBER_TREATED_AS_WILDCARD");
  assert.deepEqual(await find("under_score"), [escape.underscore], "SEARCH_UNDERSCORE_IN_TITLE_TREATED_AS_WILDCARD");
  assert.deepEqual(await find("bang!"), [escape.bang], "SEARCH_ESCAPE_CHARACTER_NOT_LITERAL");
});

/*
 * D-30: All requests lists every request in the analyst's review scope, the
 * reviewable and the released, and never a draft, which belongs to its
 * Requestor until it is submitted (T-11-03).
 */
test("All requests reads every reviewable and released request and no draft", async () => {
  const harness = await harnessPromise;
  const fixtures = await lifecycleFixtures();
  const all = await readQueue([["filters[queue]", "all"], ["pagination[pageSize]", "100"]]);
  assert.ok(all.pagination.total <= 100, "ALL_REQUESTS_TOO_LARGE_FOR_ONE_PAGE");
  assert.equal(all.rows.length, all.pagination.total, "ALL_REQUESTS_PAGE_INCOMPLETE");
  assert.ok(all.rows.every((row) => QUEUE_STATUSES.all.includes(String(row.requestStatus))), "ALL_REQUESTS_READ_A_DRAFT");

  const members = new Set(idsOf(all));
  for (const fixture of fixtures) {
    assert.equal(members.has(fixture.documentId), fixture.expected !== "none", `ALL_REQUESTS_MEMBERSHIP_${fixture.step}`);
  }

  // The total is the released queue's plus every reviewable status's.
  const released = await readQueue([["filters[queue]", "released"], ["pagination[pageSize]", "1"]]);
  let reviewable = 0;
  for (const requestStatus of REVIEWABLE) {
    reviewable += (await readQueue([["filters[queue]", "all"], ["filters[requestStatus]", requestStatus], ["pagination[pageSize]", "1"]])).pagination.total;
  }
  assert.equal(all.pagination.total, released.pagination.total + reviewable, "ALL_REQUESTS_TOTAL_NOT_THE_SUM");
  assert.equal(await harness.countReviewQueueBucketFixture("all", []), all.pagination.total, "SHARED_COUNTER_DISAGREES_all");

  // A released status narrows All requests to the released requests of that status; a draft selects nothing.
  const approvedInAll = await readQueue([["filters[queue]", "all"], ["filters[requestStatus]", "approved"], ["pagination[pageSize]", "100"]]);
  const approvedInReleased = await readQueue([["filters[queue]", "released"], ["filters[requestStatus]", "approved"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(approvedInAll), idsOf(approvedInReleased), "ALL_REQUESTS_APPROVED_DIFFERS_FROM_RELEASED");
  assert.ok(idsOf(approvedInAll).includes(await lifecycleId("09")), "ALL_REQUESTS_APPROVED_FIXTURE_ABSENT");
  const drafts = await readQueue([["filters[queue]", "all"], ["filters[requestStatus]", "draft"]]);
  assert.deepEqual(drafts.pagination, { page: 1, pageSize: 25, pageCount: 0, total: 0 }, "ALL_REQUESTS_DRAFT_FILTER_NOT_EMPTY");
});

/*
 * D-13, D-16, D-24 (13-12): each queue item names who holds the request, whether this viewer may pick it up (from the
 * assignment operation's own rule) and the viewer's unread notes on it, by the request read's unread rule. The read
 * names its viewer, whom the queue's Pick up sends as the analyst. People are a documentId and a display name only.
 */
const notesPath = (requestId: string, suffix = "") => `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes${suffix}`;
const jsonBody = (body: unknown, method = "POST"): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function addNote(requestId: string, identity: string, body: string): Promise<string> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: notesPath(requestId), identity, init: jsonBody({ data: { body } }) });
  assert.equal(response.status, 200, `NOTE_NOT_ADDED_${identity}`);
  return String(((await response.json()) as { data: { documentId: string } }).data.documentId);
}

async function markRead(requestId: string, identity: string, throughNoteId: string): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: notesPath(requestId, "/read"), identity, init: jsonBody({ data: { throughNoteId } }) });
  assert.equal(response.status, 200, `NOTES_NOT_MARKED_READ_${identity}`);
}

async function assignTo(requestId: string, identity: string, analyst: string, expectedAnalyst: string | null = null): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/assignee`,
    identity,
    init: jsonBody({ data: { analyst, expectedAnalyst } }, "PUT"),
  });
  assert.equal(response.status, 200, `ASSIGNMENT_FAILED_${identity}`);
}

/** The request read's unread count for `identity`: the figure the queue's unreadNotes must equal. */
async function requestReadUnread(requestId: string, identity: string): Promise<unknown> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`, identity });
  assert.equal(response.status, 200, `REQUEST_READ_FAILED_${identity}`);
  return ((await response.json()) as { data?: { notes?: { unread?: unknown } | null } }).data?.notes?.unread;
}

const rowOf = (page: QueuePage, documentId: string) => {
  const row = page.rows.find((candidate) => candidate.documentId === documentId);
  assert.ok(row, `QUEUE_ROW_MISSING_${documentId}`);
  return row;
};

test("each queue item names who holds it, whether the viewer may pick it up and the viewer's new notes (D-13)", async () => {
  const harness = await harnessPromise;
  const bob = { documentId: harness.users.analyst, displayName: "Bob Doe" };
  const seed = (suffix: string) => harness.createAssessmentRequestFixture({
    requestNumber: `RQB-HOLD-${suffix}`,
    title: `Holder probe ${suffix}`,
    requestStatus: "submitted",
    requestor: "owner",
    submittedDate: "2026-06-02T00:00:00.000Z",
  });
  const janes = await seed("001");
  const quiet = await seed("002");
  const bobs = await seed("003");
  // Bob raised this one (G-1, D-07): the requestor link names him.
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", bobs, { requestor: harness.users.analyst });
  const probes: Array<readonly [string, string]> = [["filters[requestNumber]", "RQB-HOLD-"], ["filters[queue]", "all"], ["pagination[pageSize]", "100"]];

  const before = await readQueue(probes);
  assert.deepEqual(before.viewer, bob, "QUEUE_VIEWER_NOT_NAMED");
  assert.deepEqual(idsOf(before).sort(), [janes, quiet, bobs].sort(), "HOLDER_PROBES_NOT_READ");
  assert.deepEqual([rowOf(before, janes).assignee, rowOf(before, janes).pickUp, rowOf(before, janes).unreadNotes], [null, "allowed", 0], "UNASSIGNED_ROW_WRONG");
  assert.deepEqual([rowOf(before, bobs).assignee, rowOf(before, bobs).pickUp], [null, "own-request"], "OWN_REQUEST_ROW_WRONG");

  // Jane writes; Bob's own note in the analysts' part is never new to him.
  const janeNote = await addNote(janes, harness.identities.owner, "The vendor support team works from Manila.");
  await addNote(janes, harness.identities.analyst, "Thanks, noted.");
  const afterNotes = await readQueue(probes);
  assert.equal(rowOf(afterNotes, janes).unreadNotes, 1, "JANES_NOTE_NOT_NEW_TO_BOB");
  assert.equal(rowOf(afterNotes, quiet).unreadNotes, 0, "QUIET_REQUEST_HAS_NEW_NOTES");
  assert.equal(await requestReadUnread(janes, harness.identities.analyst), 1, "REQUEST_READ_DISAGREES");

  await assignTo(janes, harness.identities.analyst, harness.users.analyst);
  const held = await readQueue(probes);
  assert.deepEqual(rowOf(held, janes).assignee, bob, "PICKED_UP_ROW_NOT_NAMED");
  assert.equal(rowOf(held, janes).pickUp, "not-offered", "PICKED_UP_ROW_STILL_OFFERED");

  // The second analyst sees Bob as the holder, is offered nothing, and has Jane's note still to read.
  const second = await readQueue(probes, harness.identities.secondAnalyst);
  assert.deepEqual(second.viewer, { documentId: harness.users.secondAnalyst, displayName: "Second Analyst" }, "SECOND_VIEWER_NOT_NAMED");
  assert.deepEqual(rowOf(second, janes).assignee, bob, "SECOND_ANALYST_SEES_ANOTHER_HOLDER");
  assert.equal(rowOf(second, janes).pickUp, "not-offered", "SECOND_ANALYST_OFFERED_A_HELD_REQUEST");
  assert.equal(rowOf(second, bobs).pickUp, "allowed", "SECOND_ANALYST_NOT_OFFERED_BOBS_REQUEST");
  assert.equal(rowOf(second, janes).unreadNotes, 1, "SECOND_ANALYST_UNREAD_WRONG");
  assert.equal(await requestReadUnread(janes, harness.identities.secondAnalyst), 1, "SECOND_REQUEST_READ_DISAGREES");

  // Reading is personal: Bob's read leaves the second analyst's count alone.
  await markRead(janes, harness.identities.analyst, janeNote);
  assert.equal(rowOf(await readQueue(probes), janes).unreadNotes, 0, "READ_NOTE_STILL_NEW_TO_BOB");
  assert.equal(rowOf(await readQueue(probes, harness.identities.secondAnalyst), janes).unreadNotes, 1, "BOBS_READ_CLEARED_ANOTHER_ANALYST");

  // No person crosses the queue as more than a documentId and a display name (T-13-42).
  const served = JSON.stringify(await readQueue(probes));
  assert.equal(served.includes("@"), false, "QUEUE_SERVED_AN_EMAIL");
  for (const row of held.rows) assert.deepEqual(Object.keys(row).sort(), ITEM_KEYS, `HOLDER_ITEM_KEYS_${String(row.requestNumber)}`);
});

/*
 * D-13, D-24 (13-12): the open queue and the assignee and notes filters are database predicates with exact totals.
 * Every combination of the six queues with {anyone, me, not picked up} and {all, new notes} returns, for each analyst,
 * exactly the requests the semantic oracle names: the lifecycle rule within the queue's status bound, the assignee as
 * the Document Service holds it, and the viewer's unread count as the request read states it (summarizeRequestNotes,
 * the Document Service path, not the queue's SQL). The viewer is the policy's, never a query value (T-13-40).
 */
const ALL_BUCKETS: readonly Bucket[] = ["requires-attention", "awaiting-requestor", "generation-in-progress", "open", "released", "all"];
const ASSIGNEE_FILTERS = [undefined, "me", "unassigned"] as const;
const NOTES_FILTERS = [undefined, "unread"] as const;

type MixFixture = { label: string; documentId: string };

async function buildMixFixtures(): Promise<MixFixture[]> {
  const harness = await harnessPromise;
  const { analyst, secondAnalyst } = harness.users;
  const ids = harness.identities;
  const fixtures: MixFixture[] = [];
  const request = async (label: string, requestStatus: string, day: number) => {
    const documentId = await harness.createAssessmentRequestFixture({
      requestNumber: `RQB-MIX-${label}`,
      title: `Mixed holder probe ${label}`,
      requestStatus,
      requestor: "owner",
      submittedDate: requestStatus === "draft" ? null : `2026-07-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    });
    fixtures.push({ label, documentId });
    return documentId;
  };
  const release = { approvalDate: "2026-08-30T00:00:00.000Z", assessmentDate: "2026-08-30T00:00:00.000Z" };
  const assessment = (label: string, requestDocumentId: string, facts: Record<string, unknown>) =>
    harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: `ASM-RQB-MIX-${label}`, summary: `Mixed holder probe ${label} assessment`, assessmentRequest: requestDocumentId, ...facts,
    });

  // M01: waiting for pick-up, with a note from Jane that both analysts have still to read.
  const m01 = await request("01", "submitted", 1);
  await addNote(m01, ids.owner, "The platform stores payroll data for 4,000 staff.");
  // M02: Bob holds it and has read Jane's note; the second analyst has not.
  const m02 = await request("02", "submitted", 2);
  await assignTo(m02, ids.analyst, analyst);
  await markRead(m02, ids.analyst, await addNote(m02, ids.owner, "Single sign-on goes through Entra ID."));
  // M03: the second analyst holds it; no notes.
  const m03 = await request("03", "submitted", 3);
  await assignTo(m03, ids.secondAnalyst, secondAnalyst);
  // M04: with the Requestor, Bob holds it and has read the first of Jane's two notes.
  const m04 = await request("04", "questionnaire-in-progress", 4);
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: m04, released: true, answerState: "draft" });
  await assignTo(m04, ids.analyst, analyst);
  const firstNote = await addNote(m04, ids.owner, "I will answer the hosting questions tomorrow.");
  await addNote(m04, ids.owner, "Hosting answers are in.");
  await markRead(m04, ids.analyst, firstNote);
  // M05: with the Requestor, nobody holds it; no notes.
  const m05 = await request("05", "questionnaire-in-progress", 5);
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: m05, released: true, answerState: "none" });
  // M06: assessment drafted, the second analyst holds it and has answered Jane in the analysts' part.
  const m06 = await request("06", "risk-assessment-drafted", 6);
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: m06, released: true, answerState: "submitted" });
  await assessment("06", m06, { assessmentStatus: "draft" });
  await assignTo(m06, ids.secondAnalyst, secondAnalyst);
  await addNote(m06, ids.owner, "Is the draft ready?");
  await addNote(m06, ids.secondAnalyst, "Nearly; one control is still open.");
  // M07: released and held by Bob, with a note Jane wrote before release that nobody has read.
  const m07 = await request("07", "approved", 7);
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: m07, released: true, answerState: "submitted" });
  await assessment("07", m07, { assessmentStatus: "approved", approvedBy: analyst, reviewedBy: analyst, ...release });
  await assignTo(m07, ids.analyst, analyst);
  await harness.createRequestNoteFixtures(m07, 1);
  // M08: closed, and nobody holds it.
  const m08 = await request("08", "closed", 8);
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: m08, released: true, answerState: "submitted" });
  await assessment("08", m08, { assessmentStatus: "approved", approvedBy: analyst, reviewedBy: analyst, ...release });
  // M09: a draft is in no queue, whatever the filters say.
  await request("09", "draft", 9);
  // M10: Bob raised it; the second analyst holds it; Bob's note is in the Requestor's part, so it is new to the second
  // analyst and never to Bob (G-1, D-07). WR-206: the second analyst's reply is in the Security Analysts' part, so it is
  // new to Bob, who views his own request as its Requestor: only the viewer's part decided by the requestor link says so.
  const m10 = await request("10", "submitted", 10);
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", m10, { requestor: analyst });
  await assignTo(m10, ids.secondAnalyst, secondAnalyst);
  await addNote(m10, ids.analyst, "Raised for the vendor onboarding project.");
  await addNote(m10, ids.secondAnalyst, "Picked up; one question on the vendor contract.");
  return fixtures;
}

type OracleFacts = { documentId: string; document: Record<string, unknown>; assignee: string | null; unread: Map<string, number> };

async function oracleFacts(fixtures: readonly MixFixture[], viewers: ReadonlyArray<{ identity: string }>): Promise<OracleFacts[]> {
  const harness = await harnessPromise;
  const facts: OracleFacts[] = [];
  for (const { documentId, label } of fixtures) {
    const document = await harness.getRequestLifecycleDocument(documentId);
    assert.ok(document, `MIX_DOCUMENT_MISSING_${label}`);
    const assignment = await harness.getRequestAssignment(documentId);
    const unread = new Map<string, number>();
    for (const { identity } of viewers) unread.set(identity, Number(await requestReadUnread(documentId, identity) ?? 0));
    facts.push({ documentId, document, assignee: assignment?.assignedAnalyst ?? null, unread });
  }
  return facts;
}

test("every queue with every assignee and notes filter returns exactly the oracle's requests, with exact totals (D-13, D-24)", async () => {
  const harness = await harnessPromise;
  const fixtures = await buildMixFixtures();
  const viewers = [
    { identity: harness.identities.analyst, documentId: harness.users.analyst },
    { identity: harness.identities.secondAnalyst, documentId: harness.users.secondAnalyst },
  ];
  const facts = await oracleFacts(fixtures, viewers);
  const scope: Array<readonly [string, string]> = [["filters[requestNumber]", "RQB-MIX-"], ["pagination[pageSize]", "100"]];
  let combinations = 0;

  for (const viewer of viewers) {
    for (const bucket of ALL_BUCKETS) {
      for (const assignee of ASSIGNEE_FILTERS) {
        for (const notes of NOTES_FILTERS) {
          const label = `${viewer.identity}_${bucket}_${assignee ?? "anyone"}_${notes ?? "all"}`;
          const expected = facts.filter((fact) => QUEUE_STATUSES[bucket].includes(String(fact.document.requestStatus))
            && selectReviewQueueBucket(bucket, fact.document, () => false)
            && (assignee === undefined || (assignee === "me" ? fact.assignee === viewer.documentId : fact.assignee === null))
            && (notes === undefined || (fact.unread.get(viewer.identity) ?? 0) > 0)).map((fact) => fact.documentId).sort();
          const page = await readQueue([
            ...scope,
            ["filters[queue]", bucket],
            ...(assignee ? [["filters[assignee]", assignee] as const] : []),
            ...(notes ? [["filters[notes]", notes] as const] : []),
          ], viewer.identity);
          assert.equal(page.pagination.total, expected.length, `MIX_TOTAL_${label}`);
          assert.deepEqual(idsOf(page).sort(), expected, `MIX_MEMBERS_${label}`);
          for (const row of page.rows) {
            const fact = facts.find((candidate) => candidate.documentId === row.documentId);
            assert.equal(row.unreadNotes, fact?.unread.get(viewer.identity), `MIX_UNREAD_COUNT_${label}_${String(row.requestNumber)}`);
          }
          combinations += 1;
        }
      }
    }
  }
  assert.equal(combinations, 72, "MIX_COMBINATIONS_SKIPPED");

  // The mix is not degenerate: each filter selects some requests and leaves others out.
  const bob = viewers[0];
  const mine = await readQueue([...scope, ["filters[queue]", "open"], ["filters[assignee]", "me"]], bob.identity);
  assert.deepEqual(numbersOf(mine).sort(), ["RQB-MIX-02", "RQB-MIX-04"], "BOB_OPEN_ASSIGNED_TO_ME");
  const unread = await readQueue([...scope, ["filters[queue]", "all"], ["filters[notes]", "unread"]], bob.identity);
  assert.deepEqual(numbersOf(unread).sort(), ["RQB-MIX-01", "RQB-MIX-04", "RQB-MIX-06", "RQB-MIX-07", "RQB-MIX-10"], "BOB_NEW_NOTES");
  const waiting = await readQueue([...scope, ["filters[queue]", "requires-attention"], ["filters[assignee]", "unassigned"]], bob.identity);
  assert.deepEqual(numbersOf(waiting).sort(), ["RQB-MIX-01"], "BOB_WAITING_FOR_PICK_UP");

  // open and released partition All requests.
  for (const viewer of viewers) {
    const open = idsOf(await readQueue([...scope, ["filters[queue]", "open"]], viewer.identity));
    const released = idsOf(await readQueue([...scope, ["filters[queue]", "released"]], viewer.identity));
    const all = idsOf(await readQueue([...scope, ["filters[queue]", "all"]], viewer.identity));
    assert.deepEqual([...open, ...released].sort(), [...all].sort(), `OPEN_AND_RELEASED_NOT_ALL_${viewer.identity}`);
    assert.equal(open.filter((id) => released.includes(id)).length, 0, `OPEN_AND_RELEASED_OVERLAP_${viewer.identity}`);
  }

  // "Me" is whoever the policy resolved: the second analyst asking for assignee=me sees only their own requests,
  // and no query parameter names anyone else.
  const theirs = await readQueue([...scope, ["filters[queue]", "all"], ["filters[assignee]", "me"]], harness.identities.secondAnalyst);
  assert.deepEqual(numbersOf(theirs).sort(), ["RQB-MIX-03", "RQB-MIX-06", "RQB-MIX-10"], "SECOND_ANALYST_ASSIGNED_TO_ME");
  for (const forged of [[["filters[viewer]", harness.users.analyst]], [["filters[assignee]", harness.users.analyst]], [["filters[viewerId]", "1"]]] as const) {
    const response = await harness.request({
      path: `/api/v1/assessment_requests?${queueQuery([...scope, ...forged])}`,
      identity: harness.identities.secondAnalyst,
    });
    assert.equal(response.status, 400, `FORGED_VIEWER_ACCEPTED_${forged[0][0]}`);
  }

  // The shared counter (13-13's and the dashboard's) counts with the same predicates.
  for (const viewer of viewers) {
    for (const bucket of ALL_BUCKETS) {
      for (const assignee of ASSIGNEE_FILTERS) {
        for (const notes of NOTES_FILTERS) {
          if (!assignee && !notes) continue;
          const whole = await readQueue([["filters[queue]", bucket], ["pagination[pageSize]", "1"],
            ...(assignee ? [["filters[assignee]", assignee] as const] : []), ...(notes ? [["filters[notes]", notes] as const] : [])], viewer.identity);
          const counted = await harness.countReviewQueueBucketFixture(bucket, [], {
            viewerDocumentId: viewer.documentId,
            ...(assignee ? { assignee } : {}),
            ...(notes ? { notesUnread: true } : {}),
          });
          assert.equal(counted, whole.pagination.total, `SHARED_COUNTER_DISAGREES_${viewer.identity}_${bucket}_${assignee ?? "anyone"}_${notes ?? "all"}`);
        }
      }
    }
  }
});

/*
 * The last three groups change the queue volumes, so they run after every test
 * above. D-21: the former scan read at most 1,000 reviewable requests, so beyond
 * that bound a queue reported what it had read rather than the truth.
 */
test("every queue is exact beyond a thousand reviewable requests, and the shared counter agrees", async () => {
  const harness = await harnessPromise;
  await lifecycleFixtures();
  await filterFixtures();
  const baseline = (await readQueue([["filters[queue]", "requires-attention"], ["pagination[pageSize]", "1"]])).pagination.total;
  const direct = 1_050;
  const { requestNumbers } = await harness.seedReviewableRequestsDirectly(direct, "P7Q");
  const total = baseline + direct;
  assert.ok(total > 1_000 && total - 1_000 <= 100, "BEYOND_BOUND_FIXTURE_MUST_END_ON_PAGE_ELEVEN");

  const first = await readQueue([["filters[queue]", "requires-attention"], ["pagination[pageSize]", "100"]]);
  assert.equal(first.pagination.total, total, "REQUIRES_ATTENTION_TOTAL_CAPPED");
  assert.equal(first.pagination.pageCount, Math.ceil(total / 100), "REQUIRES_ATTENTION_PAGE_COUNT_CAPPED");

  // Every direct request was submitted after every other fixture, so the rows
  // beyond the 1,000th are the last direct requests, in submission order.
  const eleventh = await readQueue([["filters[queue]", "requires-attention"], ["pagination[page]", "11"], ["pagination[pageSize]", "100"]]);
  assert.equal(eleventh.rows.length, total - 1_000, "ROWS_BEYOND_THE_THOUSANDTH_NOT_SERVED");
  assert.deepEqual(numbersOf(eleventh), requestNumbers.slice(direct - (total - 1_000)), "ROWS_BEYOND_THE_THOUSANDTH_OUT_OF_ORDER");
  assert.deepEqual(eleventh.pagination, { page: 11, pageSize: 100, pageCount: 11, total }, "ELEVENTH_PAGE_META_WRONG");

  // One definition serves the page, its total and the dashboard's count.
  assert.equal(await harness.countReviewQueueBucketFixture("requires-attention", []), total, "SHARED_COUNTER_DISAGREES_WITH_QUEUE_TOTAL");
  for (const bucket of BUCKETS) {
    const queueTotal = (await readQueue([["filters[queue]", bucket], ["pagination[pageSize]", "1"]])).pagination.total;
    assert.equal(await harness.countReviewQueueBucketFixture(bucket, []), queueTotal, `SHARED_COUNTER_DISAGREES_${bucket}`);
  }
  // An active generation job takes its request out of the action queue count.
  assert.equal(
    await harness.countReviewQueueBucketFixture("requires-attention", [await lifecycleId("01")]),
    total - 1,
    "SHARED_COUNTER_IGNORES_ACTIVE_GENERATION",
  );
});

test("a request with a running questionnaire generation job is generating, not requiring attention", async () => {
  const harness = await harnessPromise;
  const held = await harness.createAssessmentRequestFixture({
    requestNumber: "RQB-HELD-001",
    title: "Held generation probe",
    requestStatus: "submitted",
    requestor: "owner",
    submittedDate: "2026-06-01T00:00:00.000Z",
  });
  const heldAttention: Array<readonly [string, string]> = [["filters[queue]", "requires-attention"], ["filters[requestNumber]", "RQB-HELD-001"]];

  await harness.withHeldQuestionnaireGeneration(held, async () => {
    const generating = await readQueue([["filters[queue]", "generation-in-progress"], ["pagination[pageSize]", "100"]]);
    assert.deepEqual(idsOf(generating), [held], "HELD_REQUEST_NOT_GENERATING");
    assert.equal(generating.pagination.total, 1, "GENERATING_TOTAL_WRONG");
    const attention = await readQueue(heldAttention);
    assert.deepEqual(attention.rows, [], "HELD_REQUEST_REQUIRES_ATTENTION");
    assert.equal(attention.pagination.total, 0, "HELD_REQUEST_COUNTED_AS_REQUIRING_ATTENTION");
    assert.equal(await harness.countReviewQueueBucketFixture("generation-in-progress", [held]), 1, "SHARED_COUNTER_MISSES_GENERATION");
  });

  // Once the job completes the questionnaire awaits the analyst's review.
  const generated = await readQueue([["filters[queue]", "generation-in-progress"], ["pagination[pageSize]", "100"]]);
  assert.deepEqual(idsOf(generated), [], "COMPLETED_GENERATION_STILL_IN_PROGRESS");
  assert.deepEqual(idsOf(await readQueue(heldAttention)), [held], "GENERATED_REQUEST_NOT_BACK_WITH_THE_ANALYST");
});

test("the awaiting-requestor and released counts ignore active generation jobs", async () => {
  const harness = await harnessPromise;
  const step03 = await lifecycleId("03");
  const awaiting = await harness.countReviewQueueBucketFixture("awaiting-requestor", []);
  assert.equal(await harness.countReviewQueueBucketFixture("awaiting-requestor", [step03]), awaiting, "AWAITING_REQUESTOR_EXCLUDES_ACTIVE_JOBS");
  const awaitingPage = await readQueue([["filters[queue]", "awaiting-requestor"], ["pagination[pageSize]", "100"]]);
  assert.ok(idsOf(awaitingPage).includes(step03), "AWAITING_REQUESTOR_FIXTURE_ABSENT");
  assert.equal(awaitingPage.pagination.total, awaiting, "AWAITING_REQUESTOR_COUNT_DISAGREES");
  const released = await harness.countReviewQueueBucketFixture("released", []);
  assert.equal(await harness.countReviewQueueBucketFixture("released", [await lifecycleId("09")]), released, "RELEASED_EXCLUDES_ACTIVE_JOBS");
});
