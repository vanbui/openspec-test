import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
import {
  deriveRequestLifecycle,
  holderFor,
  type LifecycleKey,
  type RequestHolder,
  type RequestLifecycleFacts,
} from "../src/api/csrm-assessment-request/services/request-lifecycle";
import { utcToday } from "../src/csrm/insights/utc-date";

/*
 * GET /api/v1/my_requests (D-02 item 6, D-03, D-20). The mounted seam is the
 * served route as each of the six matrix actors. Every actor lists only the
 * requests it raised, whatever else its roles reach; each item names who holds
 * it, and that holder equals the lifecycle's own holderFor(currentKey) at every
 * lifecycle step. An item never carries an unreleased Risk Assessment's identity.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

const MY_REQUESTS_PATH = "/api/v1/my_requests";
/** The fifteen published item keys, sorted, restated literally rather than read from the implementation. */
const ITEM_KEYS = [
  "assignee", "daysSinceSubmission", "documentId", "dueDate", "holder", "nextAction", "questionnaire", "requestNumber",
  "requestStatus", "returned", "stage", "submittedDate", "title", "unreadNotes", "updatedAt",
];
const DAY_MS = 86_400_000;

type Pagination = { page: number; pageSize: number; pageCount: number; total: number };
type Item = Record<string, any>;
type ListPage = { rows: Item[]; pagination: Pagination };

function queryString(parameters: ReadonlyArray<readonly [string, string]>): string {
  return parameters.length === 0 ? "" : `?${parameters.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join("&")}`;
}

async function readRaw(identity: string | undefined, parameters: ReadonlyArray<readonly [string, string]> = []): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: `${MY_REQUESTS_PATH}${queryString(parameters)}`, identity });
}

/** Reads one page as `identity` and pins the envelope and every item's key set. */
async function readMyRequests(identity: string, parameters: ReadonlyArray<readonly [string, string]> = []): Promise<ListPage> {
  const query = queryString(parameters);
  const response = await readRaw(identity, parameters);
  assert.equal(response.status, 200, `MY_REQUESTS_READ_FAILED_${identity}_${query}: ${await response.clone().text()}`);
  const body = await response.json() as { data?: unknown; meta?: { pagination?: Pagination } };
  assert.deepEqual(Object.keys(body).sort(), ["data", "meta"], `MY_REQUESTS_ENVELOPE_${identity}_${query}`);
  assert.ok(Array.isArray(body.data), `MY_REQUESTS_DATA_NOT_A_LIST_${identity}_${query}`);
  assert.ok(body.meta?.pagination, `MY_REQUESTS_PAGINATION_MISSING_${identity}_${query}`);
  for (const row of body.data as Item[]) {
    assert.deepEqual(Object.keys(row).sort(), ITEM_KEYS, `MY_REQUESTS_ITEM_KEYS_${identity}_${String(row.requestNumber)}`);
  }
  return { rows: body.data as Item[], pagination: body.meta.pagination };
}

const idsOf = (page: ListPage) => page.rows.map((row) => String(row.documentId));

/** Whole days from a UTC calendar date to `today`, counted from the two dates alone. */
function daysFrom(date: string, today: string): number {
  return Math.round((Date.parse(`${today}T00:00:00.000Z`) - Date.parse(`${date}T00:00:00.000Z`)) / DAY_MS);
}

type StepFixture = {
  step: string;
  documentId: string;
  requestNumber: string;
  facts: RequestLifecycleFacts;
  /** The D-20 holder, written out independently of the lifecycle map. */
  expectedHolder: RequestHolder;
  expectedKey: LifecycleKey;
  questionnaire?: string;
  assessment?: string;
};

type Fixtures = {
  steps: StepFixture[];
  otherRequests: string[];
  analystRequest: { documentId: string; questionnaire: string };
};

const NO_FACTS = {
  questionnaireExists: false, questionnaireReleased: false, questionnaireSubmitted: false,
  assessmentExists: false, assessmentReviewedAndReady: false, assessmentReleased: false,
} as const;

async function buildFixtures(): Promise<Fixtures> {
  const harness = await harnessPromise;
  const analyst = harness.users.analyst;
  const request = (step: string, requestStatus: string, day: number) => harness.createAssessmentRequestFixture({
    requestNumber: `MYR-STEP-${step}`,
    title: `My requests step ${step}`,
    requestStatus,
    requestor: "owner",
    submittedDate: requestStatus === "draft" ? null : `2026-05-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    dueDate: `2026-12-${String(day).padStart(2, "0")}`,
  });
  const questionnaire = async (requestDocumentId: string, released: boolean, answerState: "none" | "draft" | "submitted") =>
    (await harness.createQuestionnaireLifecycleFixture({ requestDocumentId, released, answerState })).questionnaire;
  const assessment = (step: string, requestDocumentId: string, facts: Record<string, unknown>) =>
    harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: `ASM-MYR-${step}`,
      summary: `My requests step ${step} assessment`,
      assessmentRequest: requestDocumentId,
      ...facts,
    });
  const approval = { approvalDate: "2026-08-30T00:00:00.000Z", assessmentDate: "2026-08-30T00:00:00.000Z" };
  const steps: StepFixture[] = [];
  const add = (fixture: Omit<StepFixture, "requestNumber">) => steps.push({ ...fixture, requestNumber: `MYR-STEP-${fixture.step}` });

  // A draft the Requestor has not submitted: theirs to complete.
  add({ step: "00", documentId: await request("00", "draft", 1), facts: { requestStatus: "draft", ...NO_FACTS }, expectedHolder: "requestor", expectedKey: "draft" });

  // A draft the Security Analyst returned with a reason.
  const returned = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "MYR-STEP-RT",
    title: "My requests step RT",
    requestStatus: "draft",
    requestor: harness.users.owner,
    revertReason: "Add the hosting provider before resubmitting.",
    revertedAt: "2026-06-02T03:04:05.000Z",
    revertedBy: analyst,
  });
  add({ step: "RT", documentId: returned, facts: { requestStatus: "draft", ...NO_FACTS }, expectedHolder: "requestor", expectedKey: "draft" });

  // Submitted, nothing generated: with the analyst.
  add({ step: "01", documentId: await request("01", "submitted", 2), facts: { requestStatus: "submitted", ...NO_FACTS }, expectedHolder: "analyst", expectedKey: "submitted" });

  // Generated but not released: with the analyst, and invisible to the Requestor.
  const step02 = await request("02", "questionnaire-in-progress", 3);
  const q02 = await questionnaire(step02, false, "draft");
  add({ step: "02", documentId: step02, questionnaire: q02, facts: { requestStatus: "questionnaire-in-progress", ...NO_FACTS, questionnaireExists: true }, expectedHolder: "analyst", expectedKey: "questionnaire-generated" });

  // Released with a draft answer: with the Requestor.
  const step03 = await request("03", "questionnaire-in-progress", 4);
  const q03 = await questionnaire(step03, true, "draft");
  add({ step: "03", documentId: step03, questionnaire: q03, facts: { requestStatus: "questionnaire-in-progress", ...NO_FACTS, questionnaireExists: true, questionnaireReleased: true }, expectedHolder: "requestor", expectedKey: "questionnaire-released" });

  // Released with no questions answered (and none asked): with the Requestor.
  const step04 = await request("04", "questionnaire-in-progress", 5);
  const q04 = await questionnaire(step04, true, "none");
  add({ step: "04", documentId: step04, questionnaire: q04, facts: { requestStatus: "questionnaire-in-progress", ...NO_FACTS, questionnaireExists: true, questionnaireReleased: true }, expectedHolder: "requestor", expectedKey: "questionnaire-released" });

  // Released and submitted: with the analyst.
  const step05 = await request("05", "questionnaire-in-progress", 6);
  const q05 = await questionnaire(step05, true, "submitted");
  const submittedFacts = { ...NO_FACTS, questionnaireExists: true, questionnaireReleased: true, questionnaireSubmitted: true };
  add({ step: "05", documentId: step05, questionnaire: q05, facts: { requestStatus: "questionnaire-in-progress", ...submittedFacts }, expectedHolder: "analyst", expectedKey: "questionnaire-submitted" });

  // Assessment drafted.
  const step06 = await request("06", "risk-assessment-drafted", 7);
  const q06 = await questionnaire(step06, true, "submitted");
  const a06 = await assessment("06", step06, { assessmentStatus: "draft" });
  add({ step: "06", documentId: step06, questionnaire: q06, assessment: a06, facts: { requestStatus: "risk-assessment-drafted", ...submittedFacts, assessmentExists: true }, expectedHolder: "analyst", expectedKey: "assessment-drafted" });

  // Assessment reviewed and ready for release.
  const step07 = await request("07", "under-review", 8);
  const q07 = await questionnaire(step07, true, "submitted");
  const a07 = await assessment("07", step07, {
    assessmentStatus: "in-review", reviewedBy: analyst, overallRating: "Moderate", overallRiskRationale: "One accepted risk.",
  });
  await harness.createFixtureDocument("api::csrm-risk.csrm-risk", {
    riskNumber: "RSK-MYR-07", riskStatement: "Customer data could be exposed.", assessment: a07,
    inherentLikelihood: "Possible", highestInherentConsequence: "Major", residualLikelihood: "Unlikely", highestResidualConsequence: "Moderate",
    inherentRating: "High", residualRating: "Moderate", riskOwner: harness.users.owner, treatmentAction: "Accept", targetDate: "2026-12-31",
  });
  add({ step: "07", documentId: step07, questionnaire: q07, assessment: a07, facts: { requestStatus: "under-review", ...submittedFacts, assessmentExists: true, assessmentReviewedAndReady: true }, expectedHolder: "analyst", expectedKey: "assessment-reviewed" });

  // Released.
  const step08 = await request("08", "approved", 9);
  const q08 = await questionnaire(step08, true, "submitted");
  const a08 = await assessment("08", step08, { assessmentStatus: "approved", approvedBy: analyst, reviewedBy: analyst, ...approval });
  add({ step: "08", documentId: step08, questionnaire: q08, assessment: a08, facts: { requestStatus: "approved", ...submittedFacts, assessmentExists: true, assessmentReleased: true }, expectedHolder: "none", expectedKey: "assessment-released" });

  // Closed.
  const step09 = await request("09", "closed", 10);
  const q09 = await questionnaire(step09, true, "submitted");
  const a09 = await assessment("09", step09, { assessmentStatus: "approved", approvedBy: analyst, reviewedBy: analyst, ...approval });
  add({ step: "09", documentId: step09, questionnaire: q09, assessment: a09, facts: { requestStatus: "closed", ...submittedFacts, assessmentExists: true, assessmentReleased: true }, expectedHolder: "none", expectedKey: "assessment-released" });

  // The second Requestor's own requests, one with a released questionnaire.
  const otherSubmitted = await harness.createAssessmentRequestFixture({
    requestNumber: "MYR-OTHER-001", title: "Second Requestor my requests probe", requestStatus: "submitted", requestor: "otherRequestor",
    submittedDate: "2026-05-11T00:00:00.000Z",
  });
  const otherReleased = await harness.createAssessmentRequestFixture({
    requestNumber: "MYR-OTHER-002", title: "Second Requestor released questionnaire probe", requestStatus: "questionnaire-in-progress", requestor: "otherRequestor",
    submittedDate: "2026-05-12T00:00:00.000Z",
  });
  await questionnaire(otherReleased, true, "draft");

  // The Security Analyst's own request, whose questionnaire waits on the analyst as its Requestor.
  const analystRequest = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "MYR-ANALYST-001",
    title: "Analyst-raised my requests probe",
    requestStatus: "questionnaire-in-progress",
    requestor: analyst,
    submittedDate: "2026-05-13T00:00:00.000Z",
  });
  const analystQuestionnaire = await questionnaire(analystRequest, true, "draft");

  return { steps, otherRequests: [otherSubmitted, otherReleased], analystRequest: { documentId: analystRequest, questionnaire: analystQuestionnaire } };
}

let fixturesPromise: Promise<Fixtures> | null = null;
const fixtures = () => (fixturesPromise ??= buildFixtures());

/** The owner's whole list in one page: the steps plus the harness's own AUTH-OWNER-001 draft. */
async function ownerList(parameters: ReadonlyArray<readonly [string, string]> = []): Promise<ListPage> {
  const harness = await harnessPromise;
  return readMyRequests(harness.identities.owner, [...parameters, ["pageSize", "50"]]);
}

test("each of my requests names who holds it, equal to the lifecycle's holder at every step (D-20)", async () => {
  const harness = await harnessPromise;
  const { steps } = await fixtures();
  const page = await ownerList();
  const byId = new Map(page.rows.map((row) => [String(row.documentId), row]));

  for (const fixture of steps) {
    const lifecycle = deriveRequestLifecycle(fixture.facts);
    // The oracle agrees with the D-20 holder written out by hand, so neither can drift alone.
    assert.equal(lifecycle.currentKey, fixture.expectedKey, `ORACLE_KEY_${fixture.step}`);
    assert.equal(holderFor(lifecycle.currentKey), fixture.expectedHolder, `ORACLE_HOLDER_${fixture.step}`);

    const row = byId.get(fixture.documentId);
    assert.ok(row, `MY_REQUEST_MISSING_${fixture.step}`);
    assert.equal(row.holder, holderFor(lifecycle.currentKey), `MY_REQUEST_HOLDER_${fixture.step}`);
    assert.deepEqual(row.stage, { key: lifecycle.currentKey, label: lifecycle.currentLabel }, `MY_REQUEST_STAGE_${fixture.step}`);
    assert.equal(row.requestNumber, fixture.requestNumber, `MY_REQUEST_NUMBER_${fixture.step}`);
  }

  // The SQL holder predicate selects exactly the items of each holder, with exact totals.
  const expected = new Map<string, RequestHolder>(steps.map((fixture) => [fixture.documentId, fixture.expectedHolder]));
  expected.set(harness.requests.owner, "requestor");
  assert.deepEqual(idsOf(page).sort(), [...expected.keys()].sort(), "OWNER_LIST_NOT_EXACTLY_THE_OWNER_REQUESTS");
  assert.equal(page.pagination.total, expected.size, "OWNER_LIST_TOTAL");
  for (const holder of ["requestor", "analyst", "none"] as const) {
    const filtered = await ownerList([["holder", holder]]);
    const members = [...expected].filter(([, value]) => value === holder).map(([documentId]) => documentId).sort();
    assert.deepEqual(idsOf(filtered).sort(), members, `HOLDER_FILTER_MEMBERS_${holder}`);
    assert.equal(filtered.pagination.total, members.length, `HOLDER_FILTER_TOTAL_${holder}`);
    assert.ok(filtered.rows.every((row) => row.holder === holder), `HOLDER_FILTER_ROW_DISAGREES_${holder}`);
  }
});

test("my requests carry the Requestor's next step, age, return facts and released questionnaire progress", async () => {
  const harness = await harnessPromise;
  const { steps } = await fixtures();
  const step = (name: string) => {
    const fixture = steps.find((candidate) => candidate.step === name);
    assert.ok(fixture, `STEP_MISSING_${name}`);
    return fixture;
  };
  const todayBefore = utcToday(new Date());
  const page = await ownerList();
  const todayAfter = utcToday(new Date());
  const row = (name: string) => {
    const found = page.rows.find((candidate) => candidate.documentId === step(name).documentId);
    assert.ok(found, `ROW_MISSING_${name}`);
    return found;
  };

  // The holder's own step is verb-first and links; a waiting Requestor reads what the analyst is doing, with no link.
  assert.deepEqual(row("00").nextAction, { summary: "Complete and submit this request.", href: `/app/requests/${step("00").documentId}` }, "DRAFT_NEXT_ACTION");
  // Nobody has picked these requests up (13-UI-SPEC §12.1).
  assert.deepEqual(row("01").nextAction, { summary: "Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer." }, "SUBMITTED_NEXT_ACTION");
  assert.deepEqual(row("03").nextAction, { summary: "Answer and submit the questionnaire.", href: `/app/questionnaires/${step("03").questionnaire}` }, "RELEASED_NEXT_ACTION");
  assert.deepEqual(row("07").nextAction, { summary: "A Security Analyst is finalising your risk assessment before releasing it to you." }, "REVIEWED_NEXT_ACTION");
  for (const name of ["00", "01", "07", "08", "09"]) {
    assert.equal(row(name).assignee, null, `UNASSIGNED_REQUEST_NAMES_AN_ASSIGNEE_${name}`);
    assert.equal(row(name).unreadNotes, 0, `REQUEST_WITHOUT_NOTES_HAS_NEW_NOTES_${name}`);
  }
  assert.deepEqual(row("08").nextAction, { summary: "No action is required." }, "RELEASED_ASSESSMENT_NEXT_ACTION");
  assert.equal(row("09").nextAction, null, "CLOSED_NEXT_ACTION");
  assert.deepEqual(row("09").stage, { key: "assessment-released", label: "Assessment released" }, "CLOSED_STAGE");

  // Age in whole UTC days from submission; a draft has none.
  assert.ok([daysFrom("2026-05-02", todayBefore), daysFrom("2026-05-02", todayAfter)].includes(row("01").daysSinceSubmission), "SUBMITTED_AGE");
  assert.equal(row("00").daysSinceSubmission, null, "DRAFT_AGE_NOT_NULL");
  assert.equal(row("01").submittedDate, "2026-05-02T00:00:00.000Z", "SUBMITTED_DATE");
  assert.equal(row("01").dueDate, "2026-12-02", "DUE_DATE");
  assert.equal(row("01").requestStatus, "submitted", "REQUEST_STATUS");
  assert.equal(row("01").title, "My requests step 01", "TITLE");
  assert.ok(typeof row("01").updatedAt === "string" && !Number.isNaN(Date.parse(row("01").updatedAt)), "UPDATED_AT");

  // A returned draft carries its reason and date; nothing else is returned.
  assert.deepEqual(row("RT").returned, { reason: "Add the hosting provider before resubmitting.", at: "2026-06-02T03:04:05.000Z" }, "RETURNED_FACTS");
  for (const name of ["00", "01", "03", "08"]) assert.equal(row(name).returned, null, `NOT_RETURNED_${name}`);

  // The questionnaire appears once it is released to the Requestor, with its progress; never before.
  assert.equal(row("01").questionnaire, null, "NO_QUESTIONNAIRE_YET");
  assert.equal(row("02").questionnaire, null, "UNRELEASED_QUESTIONNAIRE_DISCLOSED");
  assert.deepEqual(row("03").questionnaire, { documentId: step("03").questionnaire, answered: 1, total: 1 }, "RELEASED_QUESTIONNAIRE_PROGRESS");
  assert.deepEqual(row("04").questionnaire, { documentId: step("04").questionnaire, answered: 0, total: 0 }, "EMPTY_QUESTIONNAIRE_PROGRESS");
  assert.deepEqual(row("05").questionnaire, { documentId: step("05").questionnaire, answered: 1, total: 1 }, "SUBMITTED_QUESTIONNAIRE_PROGRESS");

  // No item carries a Risk Assessment's number, identity or any Risk field (T-11-06, T-11-53).
  const served = JSON.stringify(page.rows);
  for (const fixture of steps) {
    if (fixture.assessment) assert.equal(served.includes(fixture.assessment), false, `ASSESSMENT_ID_SERVED_${fixture.step}`);
    assert.equal(served.includes(`ASM-MYR-${fixture.step}`), false, `ASSESSMENT_NUMBER_SERVED_${fixture.step}`);
  }
  assert.equal(served.includes(String(step("02").questionnaire)), false, "UNRELEASED_QUESTIONNAIRE_ID_SERVED");
  for (const secret of ["RSK-MYR-07", "Customer data could be exposed", "residualRating", "overallRating", "assessmentNumber", "/app/assessments/"]) {
    assert.equal(served.includes(secret), false, `RISK_FACT_SERVED_${secret}`);
  }
  assert.equal(served.includes(harness.users.owner), false, "REQUESTOR_IDENTIFIER_SERVED");
});

test("every actor lists only the requests it raised, an analyst from the Requestor's side (D-03, T-11-05, T-11-27)", async () => {
  const harness = await harnessPromise;
  const { steps, otherRequests, analystRequest } = await fixtures();
  const ownerIds = [harness.requests.owner, ...steps.map((fixture) => fixture.documentId)];

  const other = await readMyRequests(harness.identities.otherRequestor, [["pageSize", "50"]]);
  assert.deepEqual(idsOf(other).sort(), [harness.requests.otherRequestor, ...otherRequests].sort(), "SECOND_REQUESTOR_LIST_NOT_OWNER_SCOPED");
  assert.equal(other.pagination.total, 3, "SECOND_REQUESTOR_TOTAL");
  const otherServed = JSON.stringify(other.rows);
  for (const documentId of ownerIds) assert.equal(otherServed.includes(documentId), false, `OWNER_REQUEST_DISCLOSED_TO_SECOND_REQUESTOR_${documentId}`);
  assert.equal(otherServed.includes("MYR-STEP-"), false, "OWNER_REQUEST_NUMBER_DISCLOSED_TO_SECOND_REQUESTOR");

  const owner = await ownerList();
  const ownerServed = JSON.stringify(owner.rows);
  for (const documentId of [harness.requests.otherRequestor, ...otherRequests, analystRequest.documentId]) {
    assert.equal(ownerServed.includes(documentId), false, `FOREIGN_REQUEST_DISCLOSED_TO_OWNER_${documentId}`);
  }

  // The analyst reaches every request by grant, yet lists only its own, and reads it as its Requestor.
  const analyst = await readMyRequests(harness.identities.analyst, [["pageSize", "50"]]);
  assert.deepEqual(idsOf(analyst), [analystRequest.documentId], "ANALYST_LIST_NOT_OWNER_SCOPED");
  assert.equal(analyst.pagination.total, 1, "ANALYST_TOTAL");
  const [analystRow] = analyst.rows;
  assert.equal(analystRow.holder, "requestor", "ANALYST_OWN_REQUEST_HOLDER");
  assert.deepEqual(analystRow.nextAction, {
    summary: "Answer and submit the questionnaire.",
    href: `/app/questionnaires/${analystRequest.questionnaire}`,
  }, "ANALYST_OWN_REQUEST_NOT_FROM_THE_REQUESTOR_SIDE");
  assert.equal(JSON.stringify(analyst.rows).includes("/app/review/"), false, "ANALYST_OWN_REQUEST_LINKS_TO_REVIEW");

  // The service agent and the analyst-named identity without an analyst role own nothing.
  for (const identity of [harness.identities.serviceAnalystAgent, harness.identities.analystAgent]) {
    const empty = await readMyRequests(identity, [["pageSize", "50"]]);
    assert.deepEqual(empty.rows, [], `LIST_WIDENED_FOR_${identity}`);
    assert.deepEqual(empty.pagination, { page: 1, pageSize: 50, pageCount: 0, total: 0 }, `EMPTY_PAGINATION_${identity}`);
  }
});

test("my requests refuse a missing identity, an inactive identity and a missing token", async () => {
  const harness = await harnessPromise;
  await fixtures();
  for (const identity of [harness.identities.inactiveAnalyst, undefined]) {
    const denied = await readRaw(identity);
    assert.equal(denied.status, 403, `MY_REQUESTS_DENIAL_FAILED_${identity ?? "missing"}`);
    const text = await denied.text();
    assert.doesNotMatch(text, /SQL|stack|database/i, `MY_REQUESTS_DENIAL_LEAKED_INTERNALS_${identity ?? "missing"}`);
    assert.doesNotMatch(text, /MYR-|Owner request/, `MY_REQUESTS_DENIAL_LEAKED_RECORDS_${identity ?? "missing"}`);
  }
  const missingToken = await harness.request({ path: MY_REQUESTS_PATH, identity: harness.identities.owner, omitApiToken: true });
  assert.equal(missingToken.status, 401, "MY_REQUESTS_TOKEN_GATE_MISSING");
});

test("my requests accept page sizes 10, 20 and 50 and refuse any other key or value with one safe 400", async () => {
  const harness = await harnessPromise;
  await fixtures();

  for (const pageSize of ["10", "20", "50"]) {
    const page = await readMyRequests(harness.identities.owner, [["pageSize", pageSize]]);
    assert.equal(page.pagination.pageSize, Number(pageSize), `PAGE_SIZE_NOT_HONOURED_${pageSize}`);
    assert.ok(page.rows.length <= Number(pageSize), `PAGE_SIZE_EXCEEDED_${pageSize}`);
  }
  const defaults = await readMyRequests(harness.identities.owner);
  assert.equal(defaults.pagination.page, 1, "DEFAULT_PAGE");
  assert.equal(defaults.pagination.pageSize, 10, "DEFAULT_PAGE_SIZE");

  for (const query of [
    "?x=1",
    "?holder=security-analyst",
    "?holder=requestor&holder=analyst",
    "?holder[$eq]=requestor",
    "?pageSize=25",
    "?pageSize=100",
    "?page=0",
    "?page=abc",
    "?requestor=someone-else",
    "?filters[requestor][documentId][$eq]=someone-else",
    "?populate=*",
    "?pagination[page]=1",
    // D-24: notes takes one closed value; the review queue's filters[...] shape is not this operation's.
    "?notes=read",
    "?notes=",
    "?notes=unread&notes=unread",
    "?notes[$eq]=unread",
    "?filters[notes]=unread",
  ]) {
    for (const identity of [harness.identities.owner, harness.identities.analyst]) {
      const rejected = await harness.request({ path: `${MY_REQUESTS_PATH}${query}`, identity });
      assert.equal(rejected.status, 400, `MY_REQUESTS_QUERY_ACCEPTED_${identity}_${query}`);
      const body = await rejected.json() as { error?: Record<string, unknown> };
      assert.equal(body.error?.message, "CSRM assessment request query is invalid.", `MY_REQUESTS_QUERY_MESSAGE_${identity}_${query}`);
      const text = JSON.stringify(body);
      assert.doesNotMatch(text, /SQL|stack|database/i, `MY_REQUESTS_QUERY_LEAKED_INTERNALS_${identity}_${query}`);
      assert.doesNotMatch(text, /MYR-|Owner request/, `MY_REQUESTS_QUERY_LEAKED_RECORDS_${identity}_${query}`);
    }
  }
});

type QueryFixtures = {
  ordering: Record<"A" | "B" | "C" | "D" | "E" | "F", string>;
  escape: Record<"percent" | "percentWildcard" | "underscore" | "underscoreWildcard" | "bang", string>;
};

/*
 * Owner requests created A to F, so their ids ascend in that order. B and D
 * have no due date; C and F share a due date; B and F share a title. Their
 * numbers, titles and due dates each order differently, so every sort value is
 * told apart, and each tie is broken by the id alone.
 */
async function buildQueryFixtures(): Promise<QueryFixtures> {
  const harness = await harnessPromise;
  await fixtures();
  const submitted = (requestNumber: string, title: string, dueDate: string | null) =>
    harness.createAssessmentRequestFixture({ requestNumber, title, requestStatus: "submitted", requestor: "owner", submittedDate: "2026-04-01T00:00:00.000Z", dueDate });
  const A = await submitted("MYR-ORD-A", "Ordering kiwi", "2026-11-10");
  const B = await submitted("MYR-ORD-B", "Ordering apple", null);
  const C = await submitted("MYR-ORD-C", "Ordering mango", "2026-10-05");
  const D = await submitted("MYR-ORD-D", "Ordering banana", null);
  const E = await submitted("MYR-ORD-E", "Ordering cherry", "2026-12-01");
  const F = await submitted("MYR-ORD-F", "Ordering apple", "2026-10-05");
  const percent = await submitted("MYR-ESC_1", "Escape probe 50% complete", null);
  const percentWildcard = await submitted("MYR-ESCX1", "Escape probe 500 units", null);
  const underscore = await submitted("MYR-ESC-3", "Escape probe under_score", null);
  const underscoreWildcard = await submitted("MYR-ESC-4", "Escape probe underXscore", null);
  const bang = await submitted("MYR-ESC-5", "Escape probe bang! mark", null);
  return { ordering: { A, B, C, D, E, F }, escape: { percent, percentWildcard, underscore, underscoreWildcard, bang } };
}

let queryFixturesPromise: Promise<QueryFixtures> | null = null;
const queryFixtures = () => (queryFixturesPromise ??= buildQueryFixtures());

test("my requests search by number or a word of the title, case-insensitively and literally (D-34)", async () => {
  const harness = await harnessPromise;
  const { steps } = await fixtures();
  const { escape } = await queryFixtures();
  const find = async (q: string, extra: ReadonlyArray<readonly [string, string]> = []) =>
    idsOf(await ownerList([["q", q], ...extra])).sort();
  const step = (name: string) => String(steps.find((fixture) => fixture.step === name)?.documentId);

  assert.deepEqual(await find("MYR-STEP-03"), [step("03")], "SEARCH_BY_NUMBER_MISSED");
  assert.deepEqual(await find("myr-step-03"), [step("03")], "SEARCH_BY_NUMBER_NOT_CASE_INSENSITIVE");
  assert.deepEqual(await find("STEP RT"), [step("RT")], "SEARCH_BY_TITLE_WORDS_MISSED");
  assert.deepEqual(await find("MYR-STEP", [["holder", "none"]]), [step("08"), step("09")].sort(), "SEARCH_NOT_INTERSECTED_WITH_HOLDER");
  assert.deepEqual(await find("50%"), [escape.percent], "SEARCH_PERCENT_TREATED_AS_WILDCARD");
  assert.deepEqual(await find("ESC_1"), [escape.percent], "SEARCH_UNDERSCORE_IN_NUMBER_TREATED_AS_WILDCARD");
  assert.deepEqual(await find("under_score"), [escape.underscore], "SEARCH_UNDERSCORE_IN_TITLE_TREATED_AS_WILDCARD");
  assert.deepEqual(await find("bang!"), [escape.bang], "SEARCH_ESCAPE_CHARACTER_NOT_LITERAL");

  // A search never reaches another Requestor's request.
  const other = await readMyRequests(harness.identities.otherRequestor, [["q", "MYR-STEP"], ["pageSize", "50"]]);
  assert.deepEqual(other.rows, [], "SEARCH_CROSSED_THE_OWNER");
});

test("my requests filter by status, a released status returning released requests", async () => {
  const { steps } = await fixtures();
  const step = (name: string) => String(steps.find((fixture) => fixture.step === name)?.documentId);
  const approved = await ownerList([["status", "approved"]]);
  assert.deepEqual(idsOf(approved), [step("08")], "APPROVED_STATUS_FILTER");
  assert.equal(approved.rows[0]?.holder, "none", "APPROVED_HOLDER");
  const closed = await ownerList([["status", "closed"]]);
  assert.deepEqual(idsOf(closed), [step("09")], "CLOSED_STATUS_FILTER");
  const inProgress = await ownerList([["status", "questionnaire-in-progress"], ["q", "MYR-STEP"]]);
  assert.deepEqual(idsOf(inProgress).sort(), [step("02"), step("03"), step("04"), step("05")].sort(), "IN_PROGRESS_STATUS_FILTER");
  const answering = await ownerList([["status", "questionnaire-in-progress"], ["holder", "requestor"]]);
  assert.deepEqual(idsOf(answering).sort(), [step("03"), step("04")].sort(), "STATUS_NOT_INTERSECTED_WITH_HOLDER");
  assert.equal(answering.pagination.total, 2, "STATUS_AND_HOLDER_TOTAL");
});

test("my requests order by each sort value with the id as the final tiebreak", async () => {
  const { ordering } = await queryFixtures();
  const { A, B, C, D, E, F } = ordering;
  const ordered = async (sort: string) => idsOf(await ownerList([["q", "MYR-ORD-"], ["sort", sort]]));

  assert.deepEqual(await ordered("requestNumber:asc"), [A, B, C, D, E, F], "REQUEST_NUMBER_ASC");
  assert.deepEqual(await ordered("requestNumber:desc"), [F, E, D, C, B, A], "REQUEST_NUMBER_DESC");
  // B and F share a title: the earlier id comes first in both directions.
  assert.deepEqual(await ordered("title:asc"), [B, F, D, E, A, C], "TITLE_ASC");
  assert.deepEqual(await ordered("title:desc"), [C, A, E, D, B, F], "TITLE_DESC");
  // No due date sorts first ascending and last descending; C and F share a date.
  assert.deepEqual(await ordered("dueDate:asc"), [B, D, C, F, A, E], "DUE_DATE_ASC");
  assert.deepEqual(await ordered("dueDate:desc"), [E, A, C, F, B, D], "DUE_DATE_DESC");

  // updatedAt: the served instants decide the order, the creation order breaks a tie.
  const creation = [A, B, C, D, E, F];
  for (const direction of ["asc", "desc"] as const) {
    const page = await ownerList([["q", "MYR-ORD-"], ["sort", `updatedAt:${direction}`]]);
    const expected = [...page.rows].sort((left, right) => {
      const difference = Date.parse(String(left.updatedAt)) - Date.parse(String(right.updatedAt));
      if (difference !== 0) return direction === "asc" ? difference : -difference;
      return creation.indexOf(String(left.documentId)) - creation.indexOf(String(right.documentId));
    }).map((row) => String(row.documentId));
    assert.deepEqual(idsOf(page), expected, `UPDATED_AT_${direction.toUpperCase()}`);
  }
  // The default order is the most recently updated first.
  assert.deepEqual(idsOf(await ownerList([["q", "MYR-ORD-"]])), await ordered("updatedAt:desc"), "DEFAULT_ORDER_NOT_UPDATED_DESC");
});

test("my requests pages tile the whole list, each row exactly once", async () => {
  const harness = await harnessPromise;
  await queryFixtures();
  const whole = await ownerList([["sort", "requestNumber:asc"]]);
  assert.ok(whole.pagination.total > 20 && whole.pagination.total <= 50, "TILING_FIXTURE_SIZE");
  const pageSize = 10;
  const pageCount = Math.ceil(whole.pagination.total / pageSize);
  const paged: string[] = [];
  for (let page = 1; page <= pageCount; page += 1) {
    const read = await readMyRequests(harness.identities.owner, [["sort", "requestNumber:asc"], ["page", String(page)], ["pageSize", String(pageSize)]]);
    assert.deepEqual(read.pagination, { page, pageSize, pageCount, total: whole.pagination.total }, `PAGE_META_${page}`);
    paged.push(...idsOf(read));
  }
  assert.deepEqual(paged, idsOf(whole), "PAGES_DO_NOT_TILE_THE_LIST");
  const beyond = await readMyRequests(harness.identities.owner, [["page", String(pageCount + 1)], ["pageSize", String(pageSize)]]);
  assert.deepEqual(beyond.rows, [], "PAGE_BEYOND_THE_LAST_NOT_EMPTY");
  assert.equal(beyond.pagination.total, whole.pagination.total, "PAGE_BEYOND_THE_LAST_TOTAL");
});

test("my requests refuse an empty or over-long search, an unknown status and an unknown sort with one safe 400", async () => {
  const harness = await harnessPromise;
  await fixtures();
  // The longest search is accepted.
  await readMyRequests(harness.identities.owner, [["q", "x".repeat(200)]]);
  for (const query of [
    "?q=",
    `?q=${"x".repeat(201)}`,
    "?q=one&q=two",
    "?status=archived",
    "?status=draft&status=submitted",
    "?sort=createdAt:desc",
    "?sort=title",
    "?sort=title:asc&sort=dueDate:asc",
  ]) {
    const rejected = await harness.request({ path: `${MY_REQUESTS_PATH}${query}`, identity: harness.identities.owner });
    assert.equal(rejected.status, 400, `MY_REQUESTS_QUERY_ACCEPTED_${query.slice(0, 40)}`);
    const body = await rejected.json() as { error?: Record<string, unknown> };
    assert.equal(body.error?.message, "CSRM assessment request query is invalid.", `MY_REQUESTS_QUERY_MESSAGE_${query.slice(0, 40)}`);
    assert.doesNotMatch(JSON.stringify(body), /MYR-|SQL|stack|database/i, `MY_REQUESTS_QUERY_LEAKED_${query.slice(0, 40)}`);
  }
});

/*
 * D-17, D-24, D-23 (13-15): each of my requests names the Security Analyst who holds it by display name alone, and
 * counts the notes new to its Requestor by the request read's own rule. notes=unread lists exactly the requests with
 * new notes, and its total equals the status summary's withUnreadNotes. Another Requestor sees none of it.
 */
const notesPath = (requestId: string, suffix = "") => `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes${suffix}`;
const jsonBody = (body: unknown, method = "POST"): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

async function addNote(requestId: string, identity: string, body: string): Promise<string> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: notesPath(requestId), identity, init: jsonBody({ data: { body } }) });
  assert.equal(response.status, 200, `NOTE_NOT_ADDED_${identity}: ${await response.clone().text()}`);
  return String(((await response.json()) as { data: { documentId: string } }).data.documentId);
}

async function markRead(requestId: string, identity: string, throughNoteId: string): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: notesPath(requestId, "/read"), identity, init: jsonBody({ data: { throughNoteId } }) });
  assert.equal(response.status, 200, `NOTES_NOT_MARKED_READ_${identity}`);
}

async function pickUp(requestId: string, identity: string, analyst: string): Promise<void> {
  const harness = await harnessPromise;
  const response = await harness.request({
    path: `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/assignee`,
    identity,
    init: jsonBody({ data: { analyst, expectedAnalyst: null } }, "PUT"),
  });
  assert.equal(response.status, 200, `PICK_UP_FAILED_${identity}`);
}

async function withUnreadNotes(identity: string): Promise<unknown> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: "/api/v1/my_requests/status_summary", identity });
  assert.equal(response.status, 200, `SUMMARY_READ_FAILED_${identity}`);
  return ((await response.json()) as { data?: { withUnreadNotes?: unknown } }).data?.withUnreadNotes;
}

test("my requests name the assigned Security Analyst and count the Requestor's new notes, equal to the summary (D-17, D-24, D-23)", async () => {
  const harness = await harnessPromise;
  await queryFixtures();
  const seed = (suffix: string) => harness.createAssessmentRequestFixture({
    requestNumber: `MYR-NOTE-${suffix}`,
    title: `My requests notes probe ${suffix}`,
    requestStatus: "submitted",
    requestor: "owner",
    submittedDate: "2026-05-20T00:00:00.000Z",
  });
  const held = await seed("001");
  const quiet = await seed("002");
  const read = await seed("003");
  const two = await seed("004");
  const probe = async () => ownerList([["q", "MYR-NOTE-"]]);
  const rowOf = (page: ListPage, documentId: string) => {
    const found = page.rows.find((candidate) => candidate.documentId === documentId);
    assert.ok(found, `NOTES_PROBE_ROW_MISSING_${documentId}`);
    return found;
  };

  const before = await probe();
  for (const row of before.rows) assert.deepEqual([row.assignee, row.unreadNotes], [null, 0], `PROBE_NOT_FRESH_${String(row.requestNumber)}`);
  assert.equal(await withUnreadNotes(harness.identities.owner), 0, "OWNER_HAS_NEW_NOTES_BEFORE_ANY_NOTE");

  // Bob picks one up and writes on it; two analysts write on another; on a third Bob writes and Jane reads;
  // on the fourth only Jane writes, and her own note is never new to her.
  await pickUp(held, harness.identities.analyst, harness.users.analyst);
  await addNote(held, harness.identities.analyst, "Which team supports the vendor platform out of hours?");
  await addNote(two, harness.identities.analyst, "Please confirm the data residency.");
  await addNote(two, harness.identities.secondAnalyst, "And the backup region, please.");
  const readNote = await addNote(read, harness.identities.analyst, "Thanks, nothing further for now.");
  await markRead(read, harness.identities.owner, readNote);
  await addNote(quiet, harness.identities.owner, "The vendor support team works from Manila.");

  const after = await probe();
  assert.deepEqual(rowOf(after, held).assignee, { displayName: "Bob Doe" }, "ASSIGNEE_NOT_NAMED");
  assert.deepEqual(Object.keys(rowOf(after, held).assignee), ["displayName"], "ASSIGNEE_CARRIES_MORE_THAN_THE_DISPLAY_NAME");
  assert.deepEqual(rowOf(after, held).nextAction, { summary: "Bob Doe is reviewing your request and will send you a questionnaire to answer." }, "NEXT_STEP_DOES_NOT_NAME_THE_ASSIGNEE");
  assert.deepEqual(rowOf(after, quiet).nextAction, { summary: "Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer." }, "WAITING_SENTENCE_MISSING");
  assert.equal(rowOf(after, held).holder, "analyst", "HOLDER_CHANGED_BY_THE_ASSIGNEE");
  for (const documentId of [quiet, read, two]) assert.equal(rowOf(after, documentId).assignee, null, `UNASSIGNED_REQUEST_NAMED_${documentId}`);
  assert.deepEqual(
    [rowOf(after, held).unreadNotes, rowOf(after, two).unreadNotes, rowOf(after, read).unreadNotes, rowOf(after, quiet).unreadNotes],
    [1, 2, 0, 0],
    "UNREAD_NOTES_WRONG",
  );

  // The filter lists exactly the owner's requests with new notes, and its total is the summary's count.
  const whole = await ownerList();
  assert.ok(whole.pagination.total <= 50, "OWNER_LIST_FITS_ONE_PAGE");
  const expected = whole.rows.filter((row) => row.unreadNotes > 0).map((row) => String(row.documentId)).sort();
  assert.deepEqual(expected, [held, two].sort(), "ORACLE_UNREAD_SET");
  const unread = await ownerList([["notes", "unread"]]);
  assert.deepEqual(idsOf(unread).sort(), expected, "NOTES_FILTER_MEMBERS");
  assert.equal(unread.pagination.total, expected.length, "NOTES_FILTER_TOTAL");
  assert.equal(await withUnreadNotes(harness.identities.owner), unread.pagination.total, "SUMMARY_DISAGREES_WITH_NOTES_FILTER");
  assert.deepEqual(idsOf(await ownerList([["notes", "unread"], ["q", "MYR-NOTE-004"]])), [two], "NOTES_FILTER_NOT_INTERSECTED_WITH_SEARCH");
  assert.deepEqual(idsOf(await ownerList([["notes", "unread"], ["holder", "requestor"]])), [], "NOTES_FILTER_NOT_INTERSECTED_WITH_HOLDER");

  // Reading clears the flag, the filter and the count together.
  const latest = await addNote(held, harness.identities.analyst, "One more question about the vendor.");
  assert.equal(rowOf(await probe(), held).unreadNotes, 2, "SECOND_NOTE_NOT_COUNTED");
  await markRead(held, harness.identities.owner, latest);
  assert.equal(rowOf(await probe(), held).unreadNotes, 0, "READ_NOTES_STILL_NEW");
  assert.deepEqual(idsOf(await ownerList([["notes", "unread"]])), [two], "READ_REQUEST_STILL_FILTERED");
  assert.equal(await withUnreadNotes(harness.identities.owner), 1, "SUMMARY_NOT_CLEARED_BY_READING");

  // D-23: the second Requestor and the analyst who wrote the notes see none of Jane's requests, flags or counts.
  for (const identity of [harness.identities.otherRequestor, harness.identities.analyst]) {
    const theirs = await readMyRequests(identity, [["notes", "unread"], ["pageSize", "50"]]);
    assert.deepEqual(theirs.rows, [], `NOTES_FILTER_CROSSED_THE_OWNER_${identity}`);
    assert.equal(await withUnreadNotes(identity), 0, `SUMMARY_COUNTED_ANOTHER_REQUESTORS_NOTES_${identity}`);
    const served = JSON.stringify(await readMyRequests(identity, [["pageSize", "50"]]));
    for (const documentId of [held, quiet, read, two]) assert.equal(served.includes(documentId), false, `OWNER_REQUEST_DISCLOSED_${identity}_${documentId}`);
  }

  // No person crosses My requests as more than a display name (T-13-49).
  const served = JSON.stringify(await ownerList());
  assert.equal(served.includes("@"), false, "MY_REQUESTS_SERVED_AN_EMAIL");
  assert.equal(served.includes(harness.users.analyst), false, "MY_REQUESTS_SERVED_THE_ASSIGNEE_IDENTIFIER");
});
