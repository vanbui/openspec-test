import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness, type ReviewQueueBucketFixture } from "./helpers/strapi-http-harness";
import { selectReviewQueueBucket } from "../src/api/csrm-assessment-request/services/collection-scope";

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
const BUCKETS: readonly Bucket[] = ["requires-attention", "awaiting-requestor", "generation-in-progress", "released"];
const REVIEWABLE: readonly string[] = ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"];
/** What each queue reads, restated literally so the test never trusts the implementation's own sets. */
const QUEUE_STATUSES: Readonly<Record<Bucket, readonly string[]>> = {
  "requires-attention": REVIEWABLE,
  "awaiting-requestor": REVIEWABLE,
  "generation-in-progress": REVIEWABLE,
  released: ["approved", "closed"],
};
const ITEM_KEYS = ["documentId", "requestNumber", "requestStatus", "submittedDate", "title"];

type Pagination = { page: number; pageSize: number; pageCount: number; total: number };
type QueuePage = { rows: Array<Record<string, unknown>>; pagination: Pagination };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

function queueQuery(parameters: ReadonlyArray<readonly [string, string]>): string {
  return parameters.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&");
}

async function readQueue(parameters: ReadonlyArray<readonly [string, string]>): Promise<QueuePage> {
  const harness = await harnessPromise;
  const query = queueQuery(parameters);
  const response = await harness.request({ path: `/api/v1/assessment_requests?${query}`, identity: harness.identities.analyst });
  assert.equal(response.status, 200, `REVIEW_QUEUE_READ_FAILED_${query}`);
  const body = await response.json() as { data?: unknown; meta?: { pagination?: Pagination } };
  assert.ok(Array.isArray(body.data), `REVIEW_QUEUE_DATA_NOT_A_LIST_${query}`);
  assert.ok(body.meta?.pagination, `REVIEW_QUEUE_PAGINATION_MISSING_${query}`);
  return { rows: body.data as Array<Record<string, unknown>>, pagination: body.meta.pagination };
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
  const byDefault = await readQueue([...probes, ["pagination[pageSize]", "100"]]);
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

  // The item keeps its five published keys and values.
  for (const row of byDefault.rows) {
    assert.deepEqual(Object.keys(row).sort(), ITEM_KEYS, `REVIEW_QUEUE_ITEM_KEYS_CHANGED_${String(row.requestNumber)}`);
  }
  const rowA = byDefault.rows.find((row) => row.documentId === A);
  assert.deepEqual(rowA, {
    documentId: A,
    requestNumber: "RQB-ORD-A",
    title: "Ordering probe A",
    requestStatus: "submitted",
    submittedDate: "2026-03-01T00:00:00.000Z",
  }, "REVIEW_QUEUE_ITEM_VALUES_CHANGED");
  assert.equal(byDefault.rows.find((row) => row.documentId === B)?.submittedDate, null, "MISSING_SUBMISSION_DATE_NOT_NULL");

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
