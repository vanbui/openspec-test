import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";

import { UAT_A_LIKE_NOTE_SENTINELS, uatALikeNotes } from "./fixtures/uat-a-like-context";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
import { projectReleaseReadiness, validateReleaseReadiness } from "../src/api/csrm-assessment/services/assessment-workflow";
import { updateControlImplementation as updateControlImplementationDocument } from "../src/api/csrm-control-implementation/services/control-implementation-workflow";
import { parseRiskAiProvenance, parseAssessmentAiProvenance } from "../src/api/csrm-assessment/services/ai-provenance";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());
let generatedAssessmentId = "";
let contextualRiskId = "";
let contextualControlImplementationId = "";

/*
 * D-34: the assessment's risk list item (AssessmentRiskListItem). The Risk create and update responses keep the
 * five RiskSummary fields (research Pitfall 9); only this list read carries the treatment and ownership facts.
 */
const RISK_SUMMARY_KEYS = ["documentId", "inherentRating", "residualRating", "riskNumber", "riskStatement"];
const ASSESSMENT_RISK_LIST_ITEM_KEYS = [
  "documentId", "riskNumber", "riskStatement", "informationSystemImpacted", "informationAssetImpacted",
  "inherentLikelihood", "highestInherentConsequence", "inherentRating", "residualLikelihood", "highestResidualConsequence",
  "residualRating", "treatmentAction", "treatmentPlan", "treatmentStatus", "riskOwner", "treatmentOwner", "targetDate",
].sort();
/*
 * D-02 item 2, D-31: an assessment list item (AssessmentSummary) on both list operations names its request's title,
 * how many Risks the assessment holds and the highest residual rating among them.
 */
const ASSESSMENT_SUMMARY_KEYS = [
  "approvalDate", "assessmentNumber", "assessmentStatus", "documentId", "generatedBy", "generatedDate", "highestResidualRating",
  "overallRating", "requestTitle", "riskCount", "summary",
];

async function request(path: string, identity?: string, init: RequestInit = {}) {
  const harness = await harnessPromise;
  return harness.request({ path, identity, init });
}

async function payload(response: Response): Promise<{ data?: unknown; meta?: unknown; error?: unknown }> {
  return response.json() as Promise<{ data?: unknown; meta?: unknown; error?: unknown }>;
}

function rows(body: { data?: unknown }): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(body.data), "UNEXPECTED_ASSESSMENT_QUEUE_DATA");
  return body.data as Array<Record<string, unknown>>;
}

async function waitForJob(jobId: string, status: "completed" | "failed") {
  let lastStatus: unknown;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const response = await request(`/api/v1/assessment_draft_jobs/${encodeURIComponent(jobId)}`, "analyst");
    assert.equal(response.status, 200, "UNEXPECTED_ASSESSMENT_DRAFT_JOB_STATUS");
    const body = await payload(response);
    const job = body.data as Record<string, unknown>;
    lastStatus = job.status;
    assert.ok(job && typeof job === "object", "UNEXPECTED_ASSESSMENT_DRAFT_JOB_DATA");
    if (job.status === status) return job;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.fail(`assessment draft job did not reach ${status}; last status was ${String(lastStatus)}`);
}

async function buildAssessmentDetailAccessFixture() {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const ownerRequest = await harness.getRequest(fixtures.requests.complete);
  const otherRequest = await harness.getRequest(fixtures.requests.crossOwnerComplete);
  assert.ok(ownerRequest && otherRequest, "ASSESSMENT_DETAIL_REQUEST_FIXTURES_MISSING");
  return {
    analyst: { assessmentId: fixtures.releaseFacts.complete, request: { ...ownerRequest } },
    owner: { assessmentId: fixtures.releaseFacts.complete, request: { ...ownerRequest } },
    otherRequestor: { assessmentId: fixtures.releaseFacts.crossOwnerComplete, request: { ...otherRequest } },
  };
}

test("mounted active user search stays bounded and assessment detail never accepts selected-owner query expansion", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();

  await Promise.all(Array.from({ length: 21 }, (_, index) => harness.createUserFixture({
    email: `active-search-${index}@example.test`,
    username: `active-search-${index}`,
    displayName: `Alpha Search ${String(index).padStart(2, "0")}`,
    accountStatus: "active",
  })));
  const persistedOwnerId = await harness.createUserFixture({
    email: "zulu-owner@example.test",
    username: "zulu-owner",
    displayName: "Zulu Alpha Owner",
    accountStatus: "active",
  });
  await harness.setRiskOwnerFixture(fixtures.aggregate.risk, persistedOwnerId);

  const search = await request("/api/v1/users?search=a", harness.identities.analyst);
  assert.equal(search.status, 200, "ACTIVE_USER_SEARCH_MISSING");
  const users = rows(await payload(search));
  assert.equal(users.length, 20, "ACTIVE_USER_SEARCH_CAP_MISSING");
  assert.ok(users.every((user) => Object.keys(user).sort().join(",") === "displayName,documentId"), "ACTIVE_USER_SEARCH_PROJECTION_OPEN");
  assert.deepEqual(users.map((user) => user.displayName), [...users.map((user) => user.displayName)].sort(), "ACTIVE_USER_SEARCH_UNSORTED");
  assert.equal(users.some((user) => user.documentId === persistedOwnerId), false, "PERSISTED_OWNER_LEAKED_THROUGH_SEARCH");

  for (const path of [
    "/api/v1/users?search=Jane&documentIds=forged-user",
    `/api/v1/risk_assessments/${encodeURIComponent(fixtures.aggregate.assessment)}?documentIds=forged-user`,
    `/api/v1/risk_assessments/${encodeURIComponent(fixtures.aggregate.assessment)}?selectedIds=forged-user`,
  ]) {
    const expanded = await request(path, harness.identities.analyst);
    assert.equal(expanded.status, 400, `SELECTED_OWNER_QUERY_EXPANSION_ACCEPTED_${path}`);
  }

  const detail = await request(`/api/v1/risk_assessments/${encodeURIComponent(fixtures.aggregate.assessment)}`, harness.identities.analyst);
  assert.equal(detail.status, 200, "AUTHORITATIVE_OWNER_LABEL_DETAIL_MISSING");
  const assessment = (await payload(detail)).data as Record<string, unknown>;
  assert.ok(Array.isArray(assessment.ownerLabels), "AUTHORITATIVE_OWNER_LABELS_MISSING");
  assert.ok((assessment.ownerLabels as Array<Record<string, unknown>>).some((label) => label.documentId === persistedOwnerId && label.displayName === "Zulu Alpha Owner"),
    "PERSISTED_OWNER_LABEL_MISSING_FROM_DETAIL");
  await harness.setUserAccountStatusFixture(persistedOwnerId, "inactive");
  const detailAfterDeactivation = await request(`/api/v1/risk_assessments/${encodeURIComponent(fixtures.aggregate.assessment)}`, harness.identities.analyst);
  assert.equal(detailAfterDeactivation.status, 200, "INACTIVE_PERSISTED_OWNER_DETAIL_MISSING");
  const inactiveOwnerLabels = ((await payload(detailAfterDeactivation)).data as Record<string, unknown>).ownerLabels as Array<Record<string, unknown>>;
  assert.ok(inactiveOwnerLabels.some((label) => label.documentId === persistedOwnerId && label.displayName === "Zulu Alpha Owner"),
    "INACTIVE_PERSISTED_OWNER_LABEL_MISSING");
  assert.equal(rows(await payload(await request("/api/v1/users?search=Zulu", harness.identities.analyst))).some((user) => user.documentId === persistedOwnerId), false,
    "INACTIVE_OWNER_SEARCH_DISCLOSURE");
  const requestorDetail = await request(`/api/v1/risk_assessments/${encodeURIComponent(fixtures.aggregate.assessment)}`, harness.identities.owner);
  assert.equal(requestorDetail.status, 200, "REQUESTOR_RELEASED_DETAIL_MISSING");
  assert.equal(Object.prototype.hasOwnProperty.call((await payload(requestorDetail)).data as Record<string, unknown>, "ownerLabels"), false,
    "REQUESTOR_OWNER_LABEL_DISCLOSURE");
});

test("shared descendant GET registrations are uniquely actor-aware", async () => {
  const routeFiles = [
    "src/api/csrm-assessment/routes/csrm-assessment.ts",
    "src/api/csrm-risk/routes/csrm-risk.ts",
    "src/api/csrm-control-implementation/routes/csrm-control-implementation.ts",
  ];
  const routeSources = await Promise.all(routeFiles.map(async (file) => readFile(path.resolve(process.cwd(), file), "utf8")));
  const allRoutes = routeSources.join("\n");
  for (const route of ["/v1/risk_assessments/:assessmentId/risks", "/v1/risks/:riskId/control_implementations"]) {
    const expression = new RegExp(`method:\\s*\"GET\",\\s*path:\\s*\"${route}\"`, "g");
    assert.equal([...allRoutes.matchAll(expression)].length, 1, `DUPLICATE_SHARED_DESCENDANT_GET_${route}`);
  }
});

test("mounted analyst review queue is exact, bounded, and follows existing detail links", async () => {
  const harness = await harnessPromise;
  const requestFixtures = await harness.seedRequestWorkflowFixtures();
  const questionnaireFixtures = await harness.seedQuestionnaireWorkflowFixtures();
  const assessmentFixtures = await harness.seedAssessmentWorkflowFixtures();

  // The request update route admits only the published submission intent (T-08-A2); the assessment
  // draft workflow moves a request to risk-assessment-drafted, so the fixture is set there directly.
  await harness.setRequestStatusFixture(requestFixtures.requests.illegalTransition, "risk-assessment-drafted");
  assert.equal((await harness.getRequest(requestFixtures.requests.illegalTransition))?.requestStatus, "risk-assessment-drafted",
    "ASSESSMENT_QUEUE_FIXTURE_TRANSITION_FAILED");

  const queueResponse = await request(
    "/api/v1/assessment_requests?pagination[page]=1&pagination[pageSize]=100&sort=requestNumber:asc",
    harness.identities.analyst,
  );
  assert.equal(queueResponse.status, 200, "UNEXPECTED_ANALYST_QUEUE_STATUS");
  const queueBody = await payload(queueResponse);
  const queueRows = rows(queueBody);
  assert.ok(queueRows.some((row) => row.documentId === requestFixtures.requests.submitted), "UNEXPECTED_SUBMITTED_REQUEST_ABSENT");
  /*
   * The queue now defaults to "Requires my attention" (D-12), and a released
   * questionnaire the Requestor is still drafting is waiting with them, not with
   * the Analyst. It must therefore be absent here and present under the explicit
   * awaiting-requestor filter: visible, but not diluting the action queue.
   */
  assert.equal(queueRows.some((row) => row.documentId === questionnaireFixtures.requests.ownerDraft), false, "UNEXPECTED_AWAITING_REQUESTOR_IN_ACTION_QUEUE");
  const awaitingResponse = await request(
    "/api/v1/assessment_requests?pagination[page]=1&pagination[pageSize]=100&sort=requestNumber:asc&filters[queue]=awaiting-requestor",
    harness.identities.analyst,
  );
  assert.equal(awaitingResponse.status, 200, "UNEXPECTED_AWAITING_REQUESTOR_QUEUE_STATUS");
  assert.ok(rows(await payload(awaitingResponse)).some((row) => row.documentId === questionnaireFixtures.requests.ownerDraft), "UNEXPECTED_IN_PROGRESS_REQUEST_ABSENT");
  assert.ok(queueRows.some((row) => row.documentId === requestFixtures.requests.illegalTransition), "UNEXPECTED_DRAFTED_REQUEST_ABSENT");
  assert.ok(queueRows.some((row) => row.documentId === assessmentFixtures.requests.concurrent), "UNEXPECTED_UNDER_REVIEW_REQUEST_ABSENT");
  assert.equal(queueRows.some((row) => row.documentId === requestFixtures.requests.editable), false, "UNEXPECTED_DRAFT_REQUEST_DISCLOSURE");
  // The thirteen published queue item keys (D-02 item 1; Phase 13 D-13): identity, status, the triage facts, the
  // holder, the viewer's pick-up state and new notes, and no requestor relation.
  assert.ok(queueRows.every((row) => [
    "documentId",
    "requestNumber",
    "requestStatus",
    "submittedDate",
    "title",
    "requestorName",
    "assessmentType",
    "businessCriticality",
    "dueDate",
    "daysSinceSubmission",
    "assignee",
    "pickUp",
    "unreadNotes",
  ].every((key) => key in row) && Object.keys(row).length === 13 && !("requestor" in row)), "UNEXPECTED_ASSESSMENT_QUEUE_PROJECTION");
  // The review queue is paged now, so it carries pagination meta. The row
  // projection above is what keeps it bounded.
  const queueMeta = (queueBody.meta as { pagination?: Record<string, unknown> } | undefined)?.pagination;
  assert.deepEqual(Object.keys(queueMeta ?? {}).sort(), ["page", "pageCount", "pageSize", "total"], "UNEXPECTED_ASSESSMENT_QUEUE_META");
  assert.equal(queueMeta?.page, 1, "UNEXPECTED_ASSESSMENT_QUEUE_PAGE");

  const linkedRow = queueRows.find((row) => row.documentId === questionnaireFixtures.requests.ownerSubmitted);
  assert.equal(typeof linkedRow?.documentId, "string", "UNEXPECTED_LINKED_REQUEST_ID");
  const detailResponse = await request(
    `/api/csrm-assessment-requests/${encodeURIComponent(linkedRow?.documentId as string)}?populate=questionnaire`,
    harness.identities.analyst,
  );
  assert.equal(detailResponse.status, 200, "UNEXPECTED_LINKED_REQUEST_STATUS");
  const linkedQuestionnaire = await harness.getQuestionnaire(questionnaireFixtures.questionnaires.ownerSubmitted);
  const linkedAssessmentRequest = linkedQuestionnaire?.assessmentRequest as Record<string, unknown> | undefined;
  assert.equal(linkedAssessmentRequest?.documentId, linkedRow?.documentId, "UNEXPECTED_LINKED_QUESTIONNAIRE_REQUEST_ID");
  for (const suffix of ["", "/questions"]) {
    const questionnaireResponse = await request(
      `/api/v1/questionnaires/${encodeURIComponent(questionnaireFixtures.questionnaires.ownerSubmitted)}${suffix}`,
      harness.identities.analyst,
    );
    assert.equal(questionnaireResponse.status, 200, "UNEXPECTED_LINKED_QUESTIONNAIRE_STATUS");
  }

  const filtered = await request(
    "/api/v1/assessment_requests?pagination[page]=1&pagination[pageSize]=1&filters[requestStatus]=submitted&filters[requestNumber]=WORKFLOW-SUBMITTED-001&sort=submittedDate:desc",
    harness.identities.analyst,
  );
  assert.equal(filtered.status, 200, "UNEXPECTED_FILTERED_QUEUE_STATUS");
  const filteredBody = await payload(filtered);
  assert.equal(rows(filteredBody).length, 1, "UNEXPECTED_FILTERED_QUEUE_SIZE");
  assert.deepEqual(
    filteredBody.meta,
    // The read names its viewer, Bob, as a documentId and a display name only (13-12).
    { pagination: { page: 1, pageSize: 1, pageCount: 1, total: 1 }, viewer: { documentId: harness.users.analyst, displayName: "Bob Doe" } },
    "UNEXPECTED_FILTERED_QUEUE_META",
  );

  for (const reviewDate of ["2026-02-30", "2027-13-01"]) {
    const rejected = await request(
      `/api/v1/assessment_requests?filters[dueDate]=${encodeURIComponent(reviewDate)}`,
      harness.identities.analyst,
    );
    assert.equal(rejected.status, 400, `IMPOSSIBLE_REVIEW_DATE_ACCEPTED_${reviewDate}`);
  }
  const leapDate = await request(
    "/api/v1/assessment_requests?filters[dueDate]=2028-02-29",
    harness.identities.analyst,
  );
  assert.equal(leapDate.status, 200, "VALID_LEAP_REVIEW_DATE_REJECTED");
});

test("mounted analyst review queue denies ungranted actors and rejects query expansion safely", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();

  for (const identity of [
    harness.identities.owner,
    harness.identities.otherRequestor,
    harness.identities.analystAgent,
    harness.identities.inactiveAnalyst,
    undefined,
  ]) {
    const denied = await request("/api/v1/assessment_requests", identity);
    assert.equal(denied.status, 403, "UNEXPECTED_ASSESSMENT_QUEUE_DENIAL_STATUS");
    assert.doesNotMatch(await denied.text(), /SQL|stack|database|requestor|questionnaire answer/i, "UNEXPECTED_ASSESSMENT_QUEUE_DENIAL_LEAK");
  }

  /*
   * `filters[requestStatus]=approved` (default queue) used to be listed here as
   * malformed. GAP-1's contract decision (06.9-04) retired that: every request
   * status is now accepted in every queue and intersected with it, so a known
   * status the queue does not read answers an empty page. The intersection test
   * below proves that, and that nothing outside the queue is ever returned.
   * What stays malformed is anything that is not exactly one known status.
   */
  for (const query of [
    "populate=*",
    "populate[requestor]=true",
    "filters[requestor][documentId][$ne]=missing",
    "filters[requestStatus]=bogus",
    "filters[requestStatus]=Approved",
    "filters[requestStatus]=",
    "filters[requestStatus][$eq]=approved",
    "filters[requestStatus][$in][0]=approved",
    "filters[requestStatus]=submitted&filters[requestStatus]=approved",
    "filters[queue]=released&filters[requestStatus]=bogus",
    "pagination[pageSize]=101",
    "sort=createdBy:desc",
    "unknown=value",
  ]) {
    const rejected = await request(`/api/v1/assessment_requests?${query}`, harness.identities.analyst);
    assert.equal(rejected.status, 400, `UNEXPECTED_ASSESSMENT_QUEUE_QUERY_STATUS_${query}`);
    assert.doesNotMatch(await rejected.text(), /SQL|stack|database|requestor|questionnaire answer/i, "UNEXPECTED_ASSESSMENT_QUEUE_QUERY_LEAK");
  }
});

const REQUEST_STATUSES = [
  "draft", "submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review", "approved", "closed",
] as const;
const REVIEWABLE_REQUEST_STATUSES: readonly string[] = ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review"];
/** What each queue reads. No queue reads a draft: it belongs to its Requestor until submitted. */
const REVIEW_QUEUE_STATUSES: Readonly<Record<string, readonly string[]>> = {
  "requires-attention": REVIEWABLE_REQUEST_STATUSES,
  "awaiting-requestor": REVIEWABLE_REQUEST_STATUSES,
  "generation-in-progress": REVIEWABLE_REQUEST_STATUSES,
  released: ["approved", "closed"],
};

/*
 * A dedicated fixture for the queue and status intersection: one owner request
 * in each of the seven statuses, and a draft owned by the other Requestor. It is
 * built here, not taken from a memoized seed, so no other test can change what
 * it proves.
 */
async function buildReviewQueueStatusFixture() {
  const harness = await harnessPromise;
  const byStatus = new Map<string, string>();
  for (const requestStatus of REQUEST_STATUSES) {
    byStatus.set(requestStatus, await harness.createAssessmentRequestFixture({
      requestNumber: `QUEUE-STATUS-${requestStatus.toUpperCase()}`,
      title: `Queue status intersection ${requestStatus}`,
      requestStatus,
      requestor: "owner",
    }));
  }
  const otherRequestorDraft = await harness.createAssessmentRequestFixture({
    requestNumber: "QUEUE-STATUS-OTHER-DRAFT",
    title: "Queue status intersection other Requestor draft",
    requestStatus: "draft",
    requestor: "otherRequestor",
  });
  return { byStatus, drafts: [byStatus.get("draft") as string, otherRequestorDraft] };
}

test("mounted analyst review queue intersects every request status with the selected queue and never returns a record outside it", async () => {
  const harness = await harnessPromise;
  const fixture = await buildReviewQueueStatusFixture();

  for (const [queue, queueStatuses] of Object.entries(REVIEW_QUEUE_STATUSES)) {
    for (const requestStatus of [undefined, ...REQUEST_STATUSES]) {
      const label = `${queue}_${requestStatus ?? "all"}`;
      const response = await request(
        `/api/v1/assessment_requests?filters[queue]=${queue}${requestStatus ? `&filters[requestStatus]=${requestStatus}` : ""}&pagination[pageSize]=100`,
        harness.identities.analyst,
      );
      assert.equal(response.status, 200, `QUEUE_STATUS_INTERSECTION_REJECTED_${label}`);
      const body = await payload(response);
      const found = rows(body);
      const pagination = (body.meta as { pagination: Record<string, number> }).pagination;
      // One page holds every match, so every record the queue returns is inspected.
      assert.ok(pagination.total <= 100, `QUEUE_STATUS_INTERSECTION_PAGE_TOO_SMALL_${label}`);
      assert.equal(found.length, pagination.total, `QUEUE_STATUS_INTERSECTION_TOTAL_${label}`);
      for (const row of found) {
        assert.ok(queueStatuses.includes(String(row.requestStatus)), `QUEUE_STATUS_OUTSIDE_QUEUE_RECORD_${label}_${String(row.requestNumber)}`);
        if (requestStatus) assert.equal(row.requestStatus, requestStatus, `QUEUE_STATUS_FILTER_IGNORED_${label}`);
        assert.equal(fixture.drafts.includes(String(row.documentId)), false, `QUEUE_STATUS_DRAFT_DISCLOSED_${label}`);
      }

      if (requestStatus && !queueStatuses.includes(requestStatus)) {
        // The read still names its viewer (13-12), whatever it finds.
        assert.deepEqual(body.meta, {
          pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 },
          viewer: (body.meta as { viewer?: unknown }).viewer,
        }, `OUTSIDE_QUEUE_STATUS_NOT_EMPTY_${label}`);
        assert.equal(typeof ((body.meta as { viewer?: { documentId?: unknown } }).viewer?.documentId), "string", `OUTSIDE_QUEUE_VIEWER_MISSING_${label}`);
        assert.deepEqual(found, [], `OUTSIDE_QUEUE_STATUS_RETURNED_ROWS_${label}`);
      }
      // A status the queue reads still reads: the intersection is not a blanket empty answer.
      if (requestStatus && queueStatuses.includes(requestStatus) && (queue === "requires-attention" || queue === "released")) {
        assert.ok(found.some((row) => row.documentId === fixture.byStatus.get(requestStatus)), `IN_QUEUE_STATUS_RECORD_MISSING_${label}`);
      }
    }
  }
});

test("mounted assessment draft generation exposes a bounded analyst-owned lifecycle", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const deterministicFixture = await harness.seedConditionalQuestionnaireFixture();
  const saved = await request(
    `/api/v1/questionnaires/${encodeURIComponent(deterministicFixture.questionnaire)}/answers`,
    harness.identities.owner,
    {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ answers: [
        { questionKey: "internet-facing", value: true },
      ] }),
    },
  );
  assert.equal(saved.status, 200);
  const submitted = await request(
    `/api/v1/questionnaires/${encodeURIComponent(deterministicFixture.questionnaire)}/submit`,
    harness.identities.owner,
    { method: "POST" },
  );
  assert.equal(submitted.status, 200);
  const questionnaireId = deterministicFixture.questionnaire;
  const questionnaire = await harness.getQuestionnaire(questionnaireId);
  const requestDocumentId = (questionnaire?.assessmentRequest as Record<string, unknown> | undefined)?.documentId;
  assert.equal(typeof requestDocumentId, "string", "MISSING_DETERMINISTIC_QUESTIONNAIRE_REQUEST");

  let queuedJob: Record<string, unknown> | undefined;
  await harness.withDocumentWriteFailure("api::csrm-risk.csrm-risk", "create", 1, async () => {
    const [first, second] = await harness.simultaneousRequests([
      { path: `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`, identity: harness.identities.analyst, init: { method: "POST" } },
      { path: `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`, identity: harness.identities.analyst, init: { method: "POST" } },
    ]);
    assert.equal(first.status, 202, "ASSESSMENT_DRAFT_GENERATION_ROUTE_MISSING");
    assert.equal(second.status, 202, "UNEXPECTED_CONCURRENT_GENERATION_STATUS");
    queuedJob = (await payload(first)).data as Record<string, unknown>;
    const duplicate = (await payload(second)).data as Record<string, unknown>;
    assert.equal(queuedJob.jobId, duplicate.jobId, "CONCURRENT_GENERATION_CREATED_DUPLICATE_JOB");
    assert.doesNotMatch(JSON.stringify(queuedJob), /answer|provider|initiating|diagnostic|stack|database/i);
    await waitForJob(String(queuedJob.jobId), "failed");
  });
  assert.ok(queuedJob);

  const requestBeforeRetry = await harness.getRequest(String(requestDocumentId));
  assert.equal(requestBeforeRetry?.assessment, null, "FAILED_DRAFT_LEFT_PARTIAL_ASSESSMENT");
  assert.equal(requestBeforeRetry?.requestStatus, "questionnaire-in-progress", "FAILED_DRAFT_CHANGED_REQUEST_STATE");

  const retry = await request(
    `/api/v1/assessment_draft_jobs/${encodeURIComponent(String(queuedJob.jobId))}/retry`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(retry.status, 202);
  const retried = (await payload(retry)).data as Record<string, unknown>;
  assert.equal(retried.attempt, 2);
  const completed = await waitForJob(String(queuedJob.jobId), "completed");
  assert.equal(typeof completed.assessmentId, "string");
  generatedAssessmentId = String(completed.assessmentId);
  assert.deepEqual(Object.keys(completed).sort(), [
    "assessmentId", "attempt", "canRetry", "completedAt", "initiatedBy", "initiatedByViewer", "jobId", "questionnaireId", "queuedAt", "startedAt", "status",
  ]);
  assert.doesNotMatch(JSON.stringify(completed), /answer|provider|initiating|diagnostic/i);

  const assessment = await harness.getAssessment(String(completed.assessmentId));
  assert.equal(assessment?.assessmentStatus, "draft");
  assert.match(String(assessment?.assessmentNumber), /^ASM-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  assert.equal(typeof assessment?.generatedDate, "string");
  assert.equal(assessment?.providerName, "deterministic-assessment-draft");
  assert.equal(assessment?.providerVersion, "2");
  assert.ok(assessment?.generatedBy && typeof assessment.generatedBy === "object", "ASSESSMENT_GENERATING_ANALYST_MISSING");
  assert.equal(assessment?.approvedBy, null);
  assert.equal(assessment?.approvalDate, null);
  const requestAfterRetry = await harness.getRequest(String(requestDocumentId));
  assert.equal(requestAfterRetry?.requestStatus, "risk-assessment-drafted");
  assert.equal((requestAfterRetry?.assessment as Record<string, unknown>)?.documentId, completed.assessmentId);
  const risks = Array.isArray(assessment?.risks) ? assessment.risks as Record<string, unknown>[] : [];
  assert.ok(risks.length > 0);
  assert.ok(risks.every((risk) => /^RSK-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/.test(String(risk.riskNumber))));
  assert.ok(risks.every((risk) => typeof risk.treatmentPlan === "string" && risk.treatmentPlan.length > 0),
    "DETERMINISTIC_TREATMENT_PLAN_MISSING");
  // IN-208: exactly one run per provider call, so a duplicate or a run left open is seen: the failed first attempt, then the retry.
  const runs = (await harness.listAiRunsForRequest(String(requestDocumentId))).filter((run) => run.operation === "assessment-draft");
  assert.deepEqual(runs.map((run) => [run.attempt, run.status]), [[1, "failed"], [2, "completed"]], "ASSESSMENT_DRAFT_RUNS_NOT_ONE_PER_ATTEMPT");
  const completedRun = runs[1];
  assert.ok(risks.every((risk) => (risk.aiProvenance as Record<string, unknown>)?.runId === completedRun.documentId));

  const discovered = await request(
    `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(discovered.status, 202);
  assert.equal(((await payload(discovered)).data as Record<string, unknown>).jobId, queuedJob.jobId);

  const discoveredBySecondAnalyst = await request(
    `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`,
    harness.identities.secondAnalyst,
    { method: "POST" },
  );
  assert.equal(discoveredBySecondAnalyst.status, 202, "SECOND_AUTHORISED_ANALYST_IDEMPOTENT_JOB_DENIED");
  assert.equal(((await payload(discoveredBySecondAnalyst)).data as Record<string, unknown>).jobId, queuedJob.jobId);

  // Phase 12 D-32: every AI run names an accountable human, so the service agent cannot start or join a draft.
  const refusedAgent = await request(
    `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`,
    harness.identities.serviceAnalystAgent,
    { method: "POST" },
  );
  assert.equal(refusedAgent.status, 403, "SERVICE_AGENT_DRAFT_NOT_REFUSED");
  assert.ok(!(await refusedAgent.text()).includes(String(queuedJob.jobId)), "SERVICE_AGENT_DRAFT_REFUSAL_DISCLOSED_JOB");

  const bodyParserEmptyObject = await request(
    `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`,
    harness.identities.analyst,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  );
  assert.equal(bodyParserEmptyObject.status, 202, "UNEXPECTED_EMPTY_GENERATION_BODY_STATUS");
  assert.equal(((await payload(bodyParserEmptyObject)).data as Record<string, unknown>).jobId, queuedJob.jobId);

  const forged = await request(
    `/api/v1/questionnaires/${encodeURIComponent(fixtures.jobTargets.writeFailure)}/generate_assessment`,
    harness.identities.analyst,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ assessmentStatus: "approved", approvedBy: harness.identities.analyst }) },
  );
  assert.equal(forged.status, 400);
});

test("mounted analyst assessment metadata routes are bounded and transition the first accepted edit once", async () => {
  const harness = await harnessPromise;
  assert.notEqual(generatedAssessmentId, "", "ASSESSMENT_METADATA_FIXTURE_GENERATION_FAILED");
  const assessmentId = generatedAssessmentId;

  const listResponse = await request("/api/v1/risk_assessments", harness.identities.analyst);
  assert.equal(listResponse.status, 200, "ASSESSMENT_LIST_ROUTE_MISSING");
  const listBody = await payload(listResponse);
  const listRows = rows(listBody);
  const listRow = listRows.find((row) => row.documentId === assessmentId);
  assert.ok(listRow, "GENERATED_ASSESSMENT_MISSING_FROM_LIST");
  assert.deepEqual(Object.keys(listRow).sort(), ASSESSMENT_SUMMARY_KEYS);

  const summaryResponse = await request("/api/v1/risk_assessments/status_summary", harness.identities.analyst);
  assert.equal(summaryResponse.status, 200, "ASSESSMENT_STATUS_SUMMARY_ROUTE_MISSING");
  const statusSummary = (await payload(summaryResponse)).data as Record<string, unknown>;
  assert.deepEqual(Object.keys(statusSummary).sort(), ["approved", "draft", "inReview", "total"]);
  assert.ok(Number(statusSummary.draft) >= 1);
  assert.equal(Number(statusSummary.total), Number(statusSummary.draft) + Number(statusSummary.inReview) + Number(statusSummary.approved));

  const detailResponse = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst);
  assert.equal(detailResponse.status, 200, "ASSESSMENT_DETAIL_ROUTE_MISSING");
  const detail = (await payload(detailResponse)).data as Record<string, unknown>;
  assert.deepEqual(Object.keys(detail).sort(), [
    "actor", "aiProvenance", "approvalDate", "approvedBy", "assessmentDate", "assessmentNumber", "assessmentRequest", "assessmentStatus", "documentId", "generatedBy", "generatedDate", "generation",
    "nextReviewDate", "overallControlEffectiveness", "overallRating", "overallRiskRationale", "ownerLabels", "recommendationsSummary", "releaseReadiness",
    // 19-10 (D-14): whether the assessment is released, by the one record-read check.
    "released", "reviewedBy", "risks", "summary",
  ]);
  assert.equal(detail.released, false, "A_DRAFT_READS_AS_RELEASED");
  assert.equal(detail.actor, "analyst");
  const analystDocumentId = (detail.generatedBy as Record<string, unknown>)?.documentId;
  assert.equal(typeof analystDocumentId, "string", "GENERATING_ANALYST_PROJECTION_MISSING");
  const provenanceBeforeEdit = await harness.getAssessment(assessmentId);
  assert.ok(provenanceBeforeEdit, "GENERATED_ASSESSMENT_PROVENANCE_MISSING");

  const writable = {
    summary: "Analyst-reviewed mounted summary",
    overallRating: "High",
    overallControlEffectiveness: "Partially Effective",
    recommendationsSummary: "Complete the bounded mitigation plan.",
    overallRiskRationale: "Material residual exposure remains after review.",
    nextReviewDate: "2027-08-30",
  };
  const firstEdit = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(writable),
  });
  assert.equal(firstEdit.status, 200, "ASSESSMENT_UPDATE_ROUTE_MISSING");
  const firstEditData = (await payload(firstEdit)).data as Record<string, unknown>;
  for (const [field, value] of Object.entries(writable)) assert.equal(firstEditData[field], value, field);
  assert.equal(firstEditData.assessmentStatus, "in-review");
  assert.equal((firstEditData.reviewedBy as Record<string, unknown>)?.documentId, analystDocumentId);

  const persistedFirstEdit = await harness.getAssessment(assessmentId);
  const linkedRequestId = (persistedFirstEdit?.assessmentRequest as Record<string, unknown>)?.documentId;
  assert.equal(persistedFirstEdit?.assessmentStatus, "in-review");
  assert.equal(persistedFirstEdit?.summary, writable.summary);
  assert.equal(persistedFirstEdit?.providerName, provenanceBeforeEdit.providerName);
  assert.equal(persistedFirstEdit?.providerVersion, provenanceBeforeEdit.providerVersion);
  assert.equal(persistedFirstEdit?.generatedDate, provenanceBeforeEdit.generatedDate);
  assert.deepEqual(persistedFirstEdit?.generatedBy, provenanceBeforeEdit.generatedBy);
  const persistedDetail = (await payload(await request(
    `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`,
    harness.identities.analyst,
  ))).data as Record<string, unknown>;
  assert.equal((persistedDetail.reviewedBy as Record<string, unknown>)?.documentId, analystDocumentId);
  assert.equal((await harness.getRequest(String(linkedRequestId)))?.requestStatus, "under-review");

  const laterEdit = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "Later bounded analyst edit" }),
  });
  assert.equal(laterEdit.status, 200);
  const laterData = (await payload(laterEdit)).data as Record<string, unknown>;
  assert.equal(laterData.assessmentStatus, "in-review");
  assert.equal((laterData.reviewedBy as Record<string, unknown>)?.documentId, analystDocumentId);
  assert.equal((await harness.getRequest(String(linkedRequestId)))?.requestStatus, "under-review");
});

test("mounted assessment metadata update rejects hostile fields, invalid values, immutable releases, and ungranted actors safely", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const listResponse = await request("/api/v1/risk_assessments", harness.identities.analyst);
  assert.equal(listResponse.status, 200, "ASSESSMENT_LIST_ROUTE_MISSING");
  const mutable = rows(await payload(listResponse)).find((row) => row.assessmentStatus === "in-review" && row.summary === "Later bounded analyst edit");
  assert.equal(typeof mutable?.documentId, "string", "MUTABLE_ASSESSMENT_FIXTURE_MISSING");
  const mutableId = String(mutable?.documentId);

  for (const input of [
    { overallRating: "Very High" },
    { nextReviewDate: "2026-02-30" },
    { overallControlEffectiveness: "Unknown" },
    {},
  ]) {
    const rejected = await request(`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}`, harness.identities.analyst, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(input),
    });
    assert.equal(rejected.status, 400, `INVALID_ASSESSMENT_INPUT_ACCEPTED_${JSON.stringify(input)}`);
    assert.doesNotMatch(await rejected.text(), /SQL|stack|database|questionnaire answer/i);
  }

  for (const field of [
    "documentId", "id", "assessmentNumber", "assessmentStatus", "assessmentRequest", "risks", "generatedBy", "generatedDate", "providerName", "providerVersion",
    "reviewedBy", "approvedBy", "approvalDate", "assessmentDate", "createdAt", "updatedAt", "publishedAt", "requestStatus",
  ]) {
    const rejected = await request(`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}`, harness.identities.analyst, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ [field]: field === "id" ? 1 : "hostile" }),
    });
    assert.equal(rejected.status, 400, `SERVER_OWNED_ASSESSMENT_FIELD_ACCEPTED_${field}`);
  }

  for (const assessmentId of [
    fixtures.releaseFacts.approvedOnly,
    fixtures.releaseFacts.approverOnly,
    fixtures.releaseFacts.approvalDateOnly,
    fixtures.releaseFacts.approvedAndApprover,
    fixtures.releaseFacts.approvedAndApprovalDate,
    fixtures.releaseFacts.approverAndApprovalDate,
    fixtures.releaseFacts.complete,
  ]) {
    const beforeAssessment = await harness.getAssessment(assessmentId);
    const immutable = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ summary: "Hostile post-release mutation" }),
    });
    assert.equal(immutable.status, 409, `RELEASE_FACT_WAS_MUTABLE_${assessmentId}`);
    const immutableBody = await immutable.text();
    assert.doesNotMatch(immutableBody, /SQL|stack|database/i);
    assert.deepEqual(JSON.parse(immutableBody).error.details, { reason: "ASSESSMENT_NOT_MUTABLE" });
    assert.deepEqual(await harness.getAssessment(assessmentId), beforeAssessment, `REJECTED_ASSESSMENT_PATCH_PERSISTED_${assessmentId}`);
  }

  const missing = await request("/api/v1/risk_assessments/missing-assessment", harness.identities.analyst);
  assert.equal(missing.status, 404);
  for (const identity of [
    harness.identities.owner,
    harness.identities.otherRequestor,
    harness.identities.analystAgent,
    harness.identities.inactiveAnalyst,
    undefined,
  ]) {
    for (const [path, init] of [
      ["/api/v1/risk_assessments", undefined],
      ["/api/v1/risk_assessments/status_summary", undefined],
      [`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}`, undefined],
      [`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: "Denied" }),
      }],
    ] as const) {
      const denied = await request(path, identity, init);
      const requestorDetailRead = init === undefined
        && path === `/api/v1/risk_assessments/${encodeURIComponent(mutableId)}`
        && [harness.identities.owner, harness.identities.otherRequestor, harness.identities.analystAgent].includes(identity as string);
      assert.equal(denied.status, requestorDetailRead ? 404 : 403,
        `UNEXPECTED_ASSESSMENT_ACTOR_ACCESS_${identity ?? "missing"}_${path}`);
      assert.doesNotMatch(await denied.text(), /SQL|stack|database|requestor/i);
    }
  }

  for (const [path, init] of [
    ["/api/csrm-assessments", undefined],
    ["/api/csrm-assessments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { assessmentStatus: "approved" } }) }],
  ] as const) {
    const absent = await request(path, harness.identities.analyst, init);
    assert.ok(absent.status === 404 || absent.status === 405, `GENERIC_ASSESSMENT_CRUD_WAS_MOUNTED_${absent.status}`);
  }
});

test("mounted contextual Risk routes cover the frozen writable surface and bounded references", async () => {
  const harness = await harnessPromise;
  assert.notEqual(generatedAssessmentId, "", "CONTEXTUAL_RISK_ASSESSMENT_FIXTURE_MISSING");
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const requestFixtures = await harness.seedRequestWorkflowFixtures();
  const assessmentBefore = (await payload(await request(
    `/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}`,
    harness.identities.analyst,
  ))).data as Record<string, unknown>;
  const reviewedByBefore = (assessmentBefore.reviewedBy as Record<string, unknown> | undefined)?.documentId;
  assert.equal(assessmentBefore.assessmentStatus, "in-review");
  assert.equal(typeof reviewedByBefore, "string", "CONTEXTUAL_RISK_REVIEWER_MISSING");

  const riskTypesResponse = await request("/api/v1/risk_types", harness.identities.analyst);
  assert.equal(riskTypesResponse.status, 200, "RISK_TYPE_REFERENCE_ROUTE_MISSING");
  const riskTypes = rows(await payload(riskTypesResponse));
  assert.ok(riskTypes.some((riskType) => riskType.documentId === fixtures.aggregate.riskType));
  assert.ok(riskTypes.every((riskType) => Object.keys(riskType).sort().join(",") === "applicableControls,description,documentId,name"));
  // D-31: each Risk Type carries its bounded applicable-control summary, exactly four fields per control.
  assert.ok(riskTypes.every((riskType) => Array.isArray(riskType.applicableControls)
    && (riskType.applicableControls as Array<Record<string, unknown>>).every((control) =>
      Object.keys(control).sort().join(",") === "controlNumber,documentId,framework,name")));

  const controlsResponse = await request("/api/v1/controls", harness.identities.analyst);
  assert.equal(controlsResponse.status, 200, "CONTROL_REFERENCE_ROUTE_MISSING");
  const controls = rows(await payload(controlsResponse));
  assert.ok(controls.some((control) => control.documentId === fixtures.aggregate.control));
  assert.ok(controls.every((control) => Object.keys(control).sort().join(",") === "controlNumber,description,documentId,name"));

  const usersResponse = await request("/api/v1/users?search=Jane", harness.identities.analyst);
  assert.equal(usersResponse.status, 200, "ACTIVE_USER_REFERENCE_ROUTE_MISSING");
  const users = rows(await payload(usersResponse));
  assert.ok(users.some((user) => user.documentId === harness.users.owner));
  assert.ok(users.every((user) => Object.keys(user).sort().join(",") === "displayName,documentId"));
  const inactiveUsers = rows(await payload(await request("/api/v1/users?search=Inactive", harness.identities.analyst)));
  assert.deepEqual(inactiveUsers, [], "INACTIVE_USER_REFERENCE_DISCLOSED");

  const writableRisk = {
    issueStatement: "Mounted contextual issue",
    riskStatement: "Mounted contextual risk statement",
    riskCategory: "Cyber Security",
    riskSubCategory: "Boundary Protection",
    riskCause: "Uncontrolled internet exposure",
    potentialImpact: "Loss of confidentiality and availability",
    riskType: fixtures.aggregate.riskType,
    riskOwner: harness.users.owner,
    informationSystemImpacted: requestFixtures.relations.informationSystem,
    informationAssetImpacted: requestFixtures.relations.informationAsset,
    dataClassification: "Restricted",
    inherentLikelihood: "Likely",
    highestInherentConsequence: "Major",
    inherentRating: "High",
    inherentRatingRationale: "Exposure is likely before treatment.",
    residualLikelihood: "Possible",
    highestResidualConsequence: "Moderate",
    residualRating: "Moderate",
    residualRatingRationale: "Residual exposure remains reviewable.",
    controlEffectiveness: "Partially Effective",
    riskVelocity: "High",
    identifiedDate: "2026-08-30",
    targetDate: "2027-01-31",
    closureDate: "2027-02-28",
    isExempted: true,
    exemptionReviewDate: "2027-01-01T00:00:00.000Z",
    escalationDetails: "Escalate overdue treatment to the risk owner.",
    comments: "Mounted complete frozen Risk surface.",
    riskCommunicationDate: "2026-09-01",
    treatmentAction: "Treat",
    treatmentPlan: "Apply the bounded reusable control.",
    treatmentOwner: harness.users.owner,
    treatmentResolveDate: "2027-01-31",
    treatmentStatus: "In Progress",
  } as const;
  const createdResponse = await request(
    `/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}/risks`,
    harness.identities.analyst,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(writableRisk) },
  );
  assert.equal(createdResponse.status, 201, "CONTEXTUAL_RISK_CREATE_ROUTE_MISSING");
  const created = (await payload(createdResponse)).data as Record<string, unknown>;
  assert.deepEqual(Object.keys(created).sort(), ["documentId", "inherentRating", "residualRating", "riskNumber", "riskStatement"]);
  assert.match(String(created.riskNumber), /^RSK-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  assert.equal(created.riskStatement, writableRisk.riskStatement);
  const createdRiskId = String(created.documentId);
  contextualRiskId = createdRiskId;

  const persisted = await harness.getRisk(createdRiskId);
  for (const [field, value] of Object.entries(writableRisk)) {
    if (["riskType", "riskOwner"].includes(field)) {
      assert.equal((persisted?.[field] as Record<string, unknown> | undefined)?.documentId, value, `PERSISTED_RISK_RELATION_${field}`);
    } else if (["informationSystemImpacted", "informationAssetImpacted", "treatmentOwner"].includes(field)) {
      continue;
    } else {
      assert.equal(persisted?.[field], value, `PERSISTED_RISK_FIELD_${field}`);
    }
  }
  assert.equal((persisted?.assessment as Record<string, unknown> | undefined)?.documentId, generatedAssessmentId);

  const listResponse = await request(
    `/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}/risks`,
    harness.identities.analyst,
  );
  assert.equal(listResponse.status, 200, "CONTEXTUAL_RISK_LIST_ROUTE_MISSING");
  const listed = rows(await payload(listResponse));
  assert.ok(listed.some((risk) => risk.documentId === createdRiskId));
  assert.ok(listed.every((risk) => Object.keys(risk).sort().join(",") === ASSESSMENT_RISK_LIST_ITEM_KEYS.join(",")),
    "ASSESSMENT_RISK_LIST_ITEM_PROJECTION_IS_NOT_CLOSED");
  const wrongParentRows = rows(await payload(await request(
    `/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.unreleased)}/risks`,
    harness.identities.analyst,
  )));
  assert.equal(wrongParentRows.some((risk) => risk.documentId === createdRiskId), false, "RISK_ESCAPED_EXACT_PARENT_TRAVERSAL");

  const updatedResponse = await request(`/api/v1/risks/${encodeURIComponent(createdRiskId)}`, harness.identities.analyst, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ issueStatement: "Updated contextual issue", riskStatement: "  Updated contextual risk statement  ", isExempted: false }),
  });
  assert.equal(updatedResponse.status, 200, "CONTEXTUAL_RISK_UPDATE_ROUTE_MISSING");
  const updated = (await payload(updatedResponse)).data as Record<string, unknown>;
  assert.equal(updated.riskStatement, "Updated contextual risk statement");
  assert.deepEqual(Object.keys(updated).sort(), RISK_SUMMARY_KEYS, "RISK_UPDATE_RESPONSE_WIDENED");
  const persistedUpdate = await harness.getRisk(createdRiskId);
  assert.equal(persistedUpdate?.issueStatement, "Updated contextual issue");
  assert.equal(persistedUpdate?.riskStatement, "Updated contextual risk statement");
  assert.equal(persistedUpdate?.isExempted, false);

  const assessmentAfter = (await payload(await request(
    `/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}`,
    harness.identities.analyst,
  ))).data as Record<string, unknown>;
  assert.equal(assessmentAfter.assessmentStatus, "in-review");
  assert.equal((assessmentAfter.reviewedBy as Record<string, unknown> | undefined)?.documentId, reviewedByBefore);
  const reloadedRisks = assessmentAfter.risks as Array<Record<string, unknown>> | undefined;
  assert.ok(Array.isArray(reloadedRisks), "ANALYST_DETAIL_RISKS_MISSING");
  const reloaded = reloadedRisks.find((risk) => risk.documentId === createdRiskId);
  assert.ok(reloaded, "ANALYST_DETAIL_SAVED_RISK_MISSING");
  for (const [field, value] of Object.entries({
    ...writableRisk,
    issueStatement: "Updated contextual issue",
    riskStatement: "Updated contextual risk statement",
    isExempted: false,
  })) {
    assert.equal(reloaded[field], value, `ANALYST_DETAIL_SAVE_RELOAD_FIELD_${field}`);
  }
  assert.deepEqual(
    Object.keys(reloaded).sort(),
    ["documentId", "riskNumber", ...Object.keys(writableRisk), "aiProvenance", "withdrawal"].sort(),
    "ANALYST_DETAIL_RISK_PROJECTION_IS_NOT_CLOSED",
  );
  // Phase 16 D-03 item 9: an active Risk carries the withdrawal block as null.
  assert.equal(reloaded.withdrawal, null, "ANALYST_DETAIL_ACTIVE_RISK_WITHDRAWAL_IS_NOT_NULL");
  assert.ok(Array.isArray(assessmentAfter.ownerLabels), "ANALYST_DETAIL_OWNER_LABELS_MISSING");
  // Readiness is still server-owned; it is now the complete named requirement
  // set rather than the validator's raw list of missing paths.
  const persistedAssessmentAfter = await harness.getAssessment(generatedAssessmentId);
  const storedRisks = new Map(((persistedAssessmentAfter?.risks as Array<Record<string, unknown>> | undefined) ?? [])
    .map((risk) => [risk.documentId, risk.aiProvenance]));
  assert.deepEqual(
    assessmentAfter.releaseReadiness,
    projectReleaseReadiness({ ...assessmentAfter, aiProvenance: persistedAssessmentAfter?.aiProvenance,
      risks: reloadedRisks.map((risk) => ({ ...risk, aiProvenance: storedRisks.get(risk.documentId) })) },
    // Phase 16 D-42: no risk AI proposal run, so none is open.
    { openAiProposals: 0 }),
    "ANALYST_DETAIL_READINESS_MUST_BE_SERVER_OWNED",
  );
  const linkedRequestId = (persistedAssessmentAfter?.assessmentRequest as Record<string, unknown> | undefined)?.documentId;
  assert.equal((await harness.getRequest(String(linkedRequestId)))?.requestStatus, "under-review");
});

test("mounted picker Risk Type list names each Risk Type's applicable controls for the control picker (D-31)", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const name = `Mounted applicable picker ${process.pid}`;
  const created = await request("/api/v1/risk_types", harness.identities.analyst, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, description: "Risk Type whose applicable control leads the control picker", applicableControls: [fixtures.aggregate.control] }),
  });
  assert.equal(created.status, 201, await created.clone().text());
  const createdId = ((await payload(created)).data as Record<string, unknown>).documentId;
  assert.equal(typeof createdId, "string", "APPLICABLE_PICKER_RISK_TYPE_NOT_CREATED");

  const picker = await request("/api/v1/risk_types", harness.identities.analyst);
  assert.equal(picker.status, 200);
  const pickerBody = await payload(picker);
  assert.equal(pickerBody.meta, undefined, "PICKER_RISK_TYPE_LIST_BECAME_A_PAGE");
  const listed = rows(pickerBody).find((riskType) => riskType.documentId === createdId);
  assert.ok(listed, "APPLICABLE_PICKER_RISK_TYPE_NOT_LISTED");
  assert.deepEqual(Object.keys(listed).sort(), ["applicableControls", "description", "documentId", "name"]);
  assert.deepEqual(listed.applicableControls, [{
    documentId: fixtures.aggregate.control,
    controlNumber: "MOUNTED-CTRL-001",
    name: "Mounted boundary protection",
    framework: "Mounted test framework",
  }], "APPLICABLE_CONTROL_SUMMARY_NOT_SERVED");

  // A query still serves the Administration page, which names applicable controls by id only.
  const page = await request(`/api/v1/risk_types?q=${encodeURIComponent(name)}&sort=name%3Aasc&page=1&pageSize=25`, harness.identities.analyst);
  assert.equal(page.status, 200, await page.clone().text());
  const pageBody = await payload(page);
  assert.ok(pageBody.meta && typeof pageBody.meta === "object" && "pagination" in pageBody.meta, "ADMINISTRATION_RISK_TYPE_PAGE_MISSING");
  const pageRow = rows(pageBody).find((riskType) => riskType.documentId === createdId);
  assert.deepEqual(pageRow?.applicableControls, [fixtures.aggregate.control]);
});

test("mounted contextual Risk routes reject hostile parents, fields, references, releases, and actors", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  assert.notEqual(contextualRiskId, "", "MUTABLE_CONTEXTUAL_RISK_FIXTURE_MISSING");
  const assessmentRows = rows(await payload(await request("/api/v1/risk_assessments", harness.identities.analyst)));
  const mutable = assessmentRows.find((assessment) => assessment.assessmentStatus === "in-review" && assessment.summary === "Later bounded analyst edit");
  assert.equal(typeof mutable?.documentId, "string", "MUTABLE_CONTEXTUAL_RISK_ASSESSMENT_MISSING");
  const mutableId = String(mutable?.documentId);

  const risksBeforeWhitespaceCreate = rows(await payload(await request(
    `/api/v1/risk_assessments/${encodeURIComponent(mutableId)}/risks`,
    harness.identities.analyst,
  )));
  for (const riskStatement of ["   ", "\t", "\n\r"]) {
    const rejected = await request(`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}/risks`, harness.identities.analyst, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement }),
    });
    assert.equal(rejected.status, 400, `WHITESPACE_RISK_CREATE_ACCEPTED_${JSON.stringify(riskStatement)}`);
  }
  const risksAfterWhitespaceCreate = rows(await payload(await request(
    `/api/v1/risk_assessments/${encodeURIComponent(mutableId)}/risks`,
    harness.identities.analyst,
  )));
  assert.equal(risksAfterWhitespaceCreate.length, risksBeforeWhitespaceCreate.length, "WHITESPACE_RISK_CREATE_PERSISTED");

  const riskBeforeWhitespacePatch = await harness.getRisk(contextualRiskId);
  for (const riskStatement of ["   ", "\t", "\n\r"]) {
    const rejected = await request(`/api/v1/risks/${encodeURIComponent(contextualRiskId)}`, harness.identities.analyst, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement }),
    });
    assert.equal(rejected.status, 400, `WHITESPACE_RISK_PATCH_ACCEPTED_${JSON.stringify(riskStatement)}`);
  }
  assert.equal((await harness.getRisk(contextualRiskId))?.riskStatement, riskBeforeWhitespacePatch?.riskStatement,
    "WHITESPACE_RISK_PATCH_PERSISTED");

  for (const input of [
    {},
    { riskStatement: null },
    { inherentRating: "Very High" },
    { residualRating: "Unknown" },
    { dataClassification: "Secret" },
    { controlEffectiveness: "Unknown" },
    { riskVelocity: "Immediate" },
    { treatmentAction: "Transfer" },
    { treatmentStatus: "Closed" },
    { identifiedDate: "2026-02-30" },
    { exemptionReviewDate: "not-a-date" },
    { isExempted: "true" },
    { riskType: fixtures.aggregate.control },
    { riskOwner: fixtures.aggregate.riskType },
    { informationSystemImpacted: fixtures.aggregate.control },
    { informationAssetImpacted: fixtures.aggregate.control },
    { treatmentOwner: { documentId: harness.users.owner } },
  ]) {
    const rejected = await request(`/api/v1/risks/${encodeURIComponent(contextualRiskId)}`, harness.identities.analyst, {
      method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input),
    });
    assert.equal(rejected.status, 400, `HOSTILE_RISK_VALUE_ACCEPTED_${JSON.stringify(input)}`);
    assert.doesNotMatch(await rejected.text(), /SQL|stack|database|email|username/i);
  }

  for (const field of [
    "documentId", "id", "riskNumber", "assessment", "controlImplementations", "riskStatus", "assessmentStatus", "requestStatus",
    "generatedBy", "generatedDate", "providerName", "providerVersion", "reviewedBy", "approvedBy", "approvalDate", "assessmentDate", "createdAt", "updatedAt", "publishedAt",
  ]) {
    const rejected = await request(`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}/risks`, harness.identities.analyst, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Hostile", [field]: "forged" }),
    });
    assert.equal(rejected.status, 400, `SERVER_OWNED_RISK_FIELD_ACCEPTED_${field}`);
  }

  for (const assessmentId of [
    fixtures.releaseFacts.approvedOnly,
    fixtures.releaseFacts.approverOnly,
    fixtures.releaseFacts.approvalDateOnly,
    fixtures.releaseFacts.approvedAndApprover,
    fixtures.releaseFacts.approvedAndApprovalDate,
    fixtures.releaseFacts.approverAndApprovalDate,
    fixtures.releaseFacts.complete,
  ]) {
    const beforeCount = await harness.countRisksForAssessment(assessmentId);
    const immutable = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`, harness.identities.analyst, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Hostile release mutation" }),
    });
    assert.equal(immutable.status, 409, `RELEASE_ANCESTOR_ALLOWED_RISK_CREATE_${assessmentId}`);
    assert.equal(await harness.countRisksForAssessment(assessmentId), beforeCount, `REJECTED_RISK_CREATE_PERSISTED_${assessmentId}`);
  }
  const immutableChild = await request(`/api/v1/risks/${encodeURIComponent(fixtures.aggregate.risk)}`, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Hostile child mutation" }),
  });
  assert.equal(immutableChild.status, 409, "RELEASE_ANCESTOR_ALLOWED_DIRECT_CHILD_PATCH");
  assert.equal((await harness.getRisk(fixtures.aggregate.risk))?.riskStatement, "Mounted aggregate risk");

  const missingParent = await request("/api/v1/risk_assessments/missing-assessment/risks", harness.identities.analyst, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Missing parent" }),
  });
  assert.equal(missingParent.status, 404);
  const missingRisk = await request("/api/v1/risks/missing-risk", harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Missing child" }),
  });
  assert.equal(missingRisk.status, 404);
  const expanded = await request(`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}/risks?populate=*`, harness.identities.analyst);
  assert.equal(expanded.status, 400);
  for (const path of ["/api/v1/risk_types?populate=*", "/api/v1/controls?filters[name][$ne]=missing", "/api/v1/users", "/api/v1/users?search="]) {
    const rejected = await request(path, harness.identities.analyst);
    assert.equal(rejected.status, 400, `EXPANSIVE_RISK_REFERENCE_QUERY_ACCEPTED_${path}`);
  }

  for (const identity of [harness.identities.owner, harness.identities.analystAgent, harness.identities.inactiveAnalyst, undefined]) {
    for (const [path, init] of [
      [`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}/risks`, undefined],
      [`/api/v1/risk_assessments/${encodeURIComponent(mutableId)}/risks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Denied" }) }],
      [`/api/v1/risks/${encodeURIComponent(fixtures.aggregate.risk)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Denied" }) }],
      ["/api/v1/risk_types", undefined],
      ["/api/v1/controls", undefined],
      ["/api/v1/users?search=Jane", undefined],
    ] as const) {
      const denied = await request(path, identity, init);
      const requestorRiskRead = init === undefined
        && path === `/api/v1/risk_assessments/${encodeURIComponent(mutableId)}/risks`
        && [harness.identities.owner, harness.identities.analystAgent].includes(identity as string);
      const grantedUserSearch = path === "/api/v1/users?search=Jane"
        && [harness.identities.owner, harness.identities.analystAgent].includes(identity as string);
      assert.equal(denied.status, grantedUserSearch ? 200 : requestorRiskRead ? 404 : 403,
        `UNEXPECTED_CONTEXTUAL_RISK_ACTOR_ACCESS_${identity ?? "missing"}_${path}`);
      assert.doesNotMatch(await denied.text(), /SQL|stack|database|email|username/i);
    }
  }

  for (const [path, init] of [
    ["/api/csrm-risks", undefined],
    ["/api/csrm-risks", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { riskNumber: "RSK-2026-FORGED", riskStatement: "Forged" } }) }],
    [`/api/csrm-risks/${encodeURIComponent(fixtures.aggregate.risk)}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { riskStatement: "Forged" } }) }],
    [`/api/csrm-risks/${encodeURIComponent(fixtures.aggregate.risk)}`, { method: "DELETE" }],
  ] as const) {
    const absent = await request(path, harness.identities.analyst, init);
    assert.ok(absent.status === 404 || absent.status === 405, `GENERIC_RISK_CRUD_WAS_MOUNTED_${absent.status}`);
  }
});

test("mounted contextual ControlImplementation routes cover every frozen writable field and exact Risk parent", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  assert.notEqual(contextualRiskId, "", "CONTEXTUAL_CONTROL_RISK_FIXTURE_MISSING");

  const writableImplementation = {
    control: fixtures.aggregate.control,
    controlOwner: harness.users.owner,
    controlStatus: "Planned",
    effectivenessRating: "Not Assessed",
    evidence: "Mounted contextual implementation evidence",
    implementationDueDate: "2027-03-31",
    implementedDate: "2027-02-28",
    reviewDate: "2027-06-30",
  } as const;
  const createdResponse = await request(
    `/api/v1/risks/${encodeURIComponent(contextualRiskId)}/control_implementations`,
    harness.identities.analyst,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(writableImplementation) },
  );
  assert.equal(
    createdResponse.status,
    201,
    `CONTEXTUAL_CONTROL_IMPLEMENTATION_CREATE_ROUTE_MISSING: ${await createdResponse.clone().text()}`,
  );
  const created = (await payload(createdResponse)).data as Record<string, unknown>;
  assert.deepEqual(Object.keys(created).sort(), [
    "control", "controlOwner", "controlStatus", "controlSummary", "documentId", "effectivenessRating", "evidence",
    "implementationDueDate", "implementedDate", "reviewDate",
  ]);
  assert.equal(created.control, fixtures.aggregate.control, "REUSABLE_CONTROL_REFERENCE_PROJECTION_MISSING");
  // D-34: every control implementation response names its control, so no screen falls back to the id.
  const mountedControlSummary = {
    documentId: fixtures.aggregate.control,
    controlNumber: "MOUNTED-CTRL-001",
    name: "Mounted boundary protection",
    framework: "Mounted test framework",
  };
  assert.deepEqual(created.controlSummary, mountedControlSummary, "CREATED_CONTROL_SUMMARY_MISSING");
  assert.equal((created.controlOwner as Record<string, unknown>)?.documentId, harness.users.owner);
  contextualControlImplementationId = String(created.documentId);

  const persisted = await harness.getControlImplementation(contextualControlImplementationId);
  assert.equal((persisted?.risk as Record<string, unknown>)?.documentId, contextualRiskId);
  assert.equal((persisted?.control as Record<string, unknown>)?.documentId, fixtures.aggregate.control);
  assert.equal((persisted?.controlOwner as Record<string, unknown>)?.documentId, harness.users.owner);
  for (const field of [
    "controlStatus", "effectivenessRating", "evidence", "implementationDueDate", "implementedDate", "reviewDate",
  ] as const) assert.equal(persisted?.[field], writableImplementation[field], `PERSISTED_CONTROL_IMPLEMENTATION_FIELD_${field}`);

  const listResponse = await request(
    `/api/v1/risks/${encodeURIComponent(contextualRiskId)}/control_implementations`,
    harness.identities.analyst,
  );
  assert.equal(listResponse.status, 200, "CONTEXTUAL_CONTROL_IMPLEMENTATION_LIST_ROUTE_MISSING");
  const listed = rows(await payload(listResponse));
  assert.ok(listed.some((implementation) => implementation.documentId === contextualControlImplementationId));
  assert.ok(listed.every((implementation) => Object.keys(implementation).sort().join(",")
    === "control,controlOwner,controlStatus,controlSummary,documentId,effectivenessRating,evidence,implementationDueDate,implementedDate,reviewDate"));
  assert.deepEqual(
    listed.find((implementation) => implementation.documentId === contextualControlImplementationId)?.controlSummary,
    mountedControlSummary,
    "LISTED_CONTROL_SUMMARY_MISSING",
  );
  const wrongParent = rows(await payload(await request(
    `/api/v1/risks/${encodeURIComponent(fixtures.aggregate.risk)}/control_implementations`,
    harness.identities.analyst,
  )));
  assert.equal(wrongParent.some((implementation) => implementation.documentId === contextualControlImplementationId), false,
    "CONTROL_IMPLEMENTATION_ESCAPED_EXACT_RISK_PARENT");

  const update = {
    control: fixtures.aggregate.control,
    controlOwner: harness.users.otherRequestor,
    controlStatus: "Implemented",
    effectivenessRating: "Effective",
    evidence: "Updated bounded contextual evidence",
    implementationDueDate: "2027-04-30",
    implementedDate: "2027-03-31",
    reviewDate: "2027-07-31",
  } as const;
  const updatedResponse = await request(
    `/api/v1/control_implementations/${encodeURIComponent(contextualControlImplementationId)}`,
    harness.identities.analyst,
    { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(update) },
  );
  assert.equal(updatedResponse.status, 200, "CONTEXTUAL_CONTROL_IMPLEMENTATION_UPDATE_ROUTE_MISSING");
  const updated = (await payload(updatedResponse)).data as Record<string, unknown>;
  assert.equal(updated.control, fixtures.aggregate.control);
  assert.deepEqual(updated.controlSummary, mountedControlSummary, "UPDATED_CONTROL_SUMMARY_MISSING");
  assert.equal((updated.controlOwner as Record<string, unknown>)?.documentId, harness.users.otherRequestor);
  for (const field of [
    "controlStatus", "effectivenessRating", "evidence", "implementationDueDate", "implementedDate", "reviewDate",
  ] as const) assert.equal(updated[field], update[field], `UPDATED_CONTROL_IMPLEMENTATION_FIELD_${field}`);

  const disposable = await request(
    `/api/v1/risks/${encodeURIComponent(contextualRiskId)}/control_implementations`,
    harness.identities.analyst,
    { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ control: fixtures.aggregate.control }) },
  );
  assert.equal(disposable.status, 201);
  const disposableId = String(((await payload(disposable)).data as Record<string, unknown>).documentId);
  const removed = await request(
    `/api/v1/control_implementations/${encodeURIComponent(disposableId)}`,
    harness.identities.analyst,
    { method: "DELETE" },
  );
  assert.equal(removed.status, 204, "CONTEXTUAL_CONTROL_IMPLEMENTATION_DELETE_ROUTE_MISSING");
  assert.equal(await harness.getControlImplementation(disposableId), null, "CONTROL_IMPLEMENTATION_DELETE_DID_NOT_PERSIST");
});

test("mounted contextual ControlImplementation routes reject forged ancestry, hostile fields, releases, and actors", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  assert.notEqual(contextualRiskId, "", "HOSTILE_CONTROL_IMPLEMENTATION_RISK_FIXTURE_MISSING");
  assert.notEqual(contextualControlImplementationId, "", "HOSTILE_CONTROL_IMPLEMENTATION_FIXTURE_MISSING");

  for (const input of [
    {},
    { control: null },
    { control: fixtures.aggregate.riskType },
    { control: { documentId: fixtures.aggregate.control } },
    { controlOwner: fixtures.aggregate.control },
    { controlOwner: { documentId: harness.users.owner } },
    { controlStatus: "Draft" },
    { effectivenessRating: "Unknown" },
    { evidence: 1 },
    { implementationDueDate: "2026-02-30" },
    { implementedDate: "not-a-date" },
    { reviewDate: "2027-13-01" },
  ]) {
    const rejected = await request(
      `/api/v1/control_implementations/${encodeURIComponent(contextualControlImplementationId)}`,
      harness.identities.analyst,
      { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(input) },
    );
    assert.equal(rejected.status, 400, `HOSTILE_CONTROL_IMPLEMENTATION_VALUE_ACCEPTED_${JSON.stringify(input)}`);
    assert.doesNotMatch(await rejected.text(), /SQL|stack|database|email|username/i);
  }

  for (const field of [
    "documentId", "id", "risk", "assessment", "assessmentRequest", "riskNumber", "assessmentNumber", "controlImplementations",
    "assessmentStatus", "requestStatus", "generatedBy", "generatedDate", "providerName", "providerVersion", "reviewedBy", "approvedBy", "approvalDate",
    "assessmentDate", "createdAt", "updatedAt", "publishedAt",
  ]) {
    const rejected = await request(
      `/api/v1/risks/${encodeURIComponent(contextualRiskId)}/control_implementations`,
      harness.identities.analyst,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ control: fixtures.aggregate.control, [field]: field === "id" ? 1 : "forged" }),
      },
    );
    assert.equal(rejected.status, 400, `SERVER_OWNED_CONTROL_IMPLEMENTATION_FIELD_ACCEPTED_${field}`);
  }

  const missingRisk = await request("/api/v1/risks/missing-risk/control_implementations", harness.identities.analyst);
  assert.equal(missingRisk.status, 404);
  const missingImplementation = await request("/api/v1/control_implementations/missing-implementation", harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ evidence: "Missing" }),
  });
  assert.equal(missingImplementation.status, 404);
  const expanded = await request(
    `/api/v1/risks/${encodeURIComponent(contextualRiskId)}/control_implementations?populate=*`,
    harness.identities.analyst,
  );
  assert.equal(expanded.status, 400);

  for (const [method, path, body] of [
    ["POST", `/api/v1/risks/${encodeURIComponent(fixtures.aggregate.risk)}/control_implementations`, { control: fixtures.aggregate.control }],
    ["PATCH", `/api/v1/control_implementations/${encodeURIComponent(fixtures.aggregate.controlImplementation)}`, { evidence: "Hostile release mutation" }],
    ["DELETE", `/api/v1/control_implementations/${encodeURIComponent(fixtures.aggregate.controlImplementation)}`, undefined],
  ] as const) {
    const beforeControl = await harness.getControlImplementation(fixtures.aggregate.controlImplementation);
    const beforeCount = await harness.countControlImplementationsForRisk(fixtures.aggregate.risk);
    const immutable = await request(path, harness.identities.analyst, {
      method,
      ...(body ? { headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {}),
    });
    assert.equal(immutable.status, 409, `RELEASE_ANCESTOR_ALLOWED_CONTROL_IMPLEMENTATION_${method}`);
    assert.deepEqual(await harness.getControlImplementation(fixtures.aggregate.controlImplementation), beforeControl,
      `REJECTED_CONTROL_MUTATION_PERSISTED_${method}`);
    assert.equal(await harness.countControlImplementationsForRisk(fixtures.aggregate.risk), beforeCount,
      `REJECTED_CONTROL_CREATE_PERSISTED_${method}`);
  }
  assert.notEqual(await harness.getControlImplementation(fixtures.aggregate.controlImplementation), null,
    "RELEASED_CONTROL_IMPLEMENTATION_WAS_DELETED");

  for (const identity of [harness.identities.owner, harness.identities.analystAgent, harness.identities.inactiveAnalyst, undefined]) {
    for (const [path, init] of [
      [`/api/v1/risks/${encodeURIComponent(contextualRiskId)}/control_implementations`, undefined],
      [`/api/v1/risks/${encodeURIComponent(contextualRiskId)}/control_implementations`, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ control: fixtures.aggregate.control }),
      }],
      [`/api/v1/control_implementations/${encodeURIComponent(contextualControlImplementationId)}`, {
        method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ evidence: "Denied" }),
      }],
      [`/api/v1/control_implementations/${encodeURIComponent(contextualControlImplementationId)}`, { method: "DELETE" }],
    ] as const) {
      const denied = await request(path, identity, init);
      const requestorControlRead = init === undefined
        && path === `/api/v1/risks/${encodeURIComponent(contextualRiskId)}/control_implementations`
        && [harness.identities.owner, harness.identities.analystAgent].includes(identity as string);
      assert.equal(denied.status, requestorControlRead ? 404 : 403,
        `UNEXPECTED_CONTEXTUAL_CONTROL_ACTOR_ACCESS_${identity ?? "missing"}_${path}`);
      assert.doesNotMatch(await denied.text(), /SQL|stack|database|email|username/i);
    }
  }

  for (const [path, init] of [
    ["/api/csrm-control-implementations", undefined],
    ["/api/csrm-control-implementations", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { control: fixtures.aggregate.control, risk: contextualRiskId } }),
    }],
    [`/api/csrm-control-implementations/${encodeURIComponent(contextualControlImplementationId)}`, {
      method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { evidence: "Forged" } }),
    }],
    [`/api/csrm-control-implementations/${encodeURIComponent(contextualControlImplementationId)}`, { method: "DELETE" }],
  ] as const) {
    const absent = await request(path, harness.identities.analyst, init);
    assert.ok(absent.status === 404 || absent.status === 405, `GENERIC_CONTROL_IMPLEMENTATION_CRUD_WAS_MOUNTED_${absent.status}`);
  }
});

test("direct ControlImplementation descendants reject every partial and complete release fact", async () => {
  const releaseFacts = [
    { approved: true, approvedBy: false, approvalDate: false },
    { approved: false, approvedBy: true, approvalDate: false },
    { approved: false, approvedBy: false, approvalDate: true },
    { approved: true, approvedBy: true, approvalDate: false },
    { approved: true, approvedBy: false, approvalDate: true },
    { approved: false, approvedBy: true, approvalDate: true },
    { approved: true, approvedBy: true, approvalDate: true },
  ] as const;

  for (const facts of releaseFacts) {
    const query = {
      select() { return query; },
      where() { return query; },
      forUpdate() { return query; },
      transacting() { return query; },
      async execute() { return []; },
    };
    const strapi = {
      documents(uid: string) {
        return {
          async findOne() {
            if (uid === "api::csrm-control-implementation.csrm-control-implementation") {
              return {
                documentId: "implementation",
                risk: { documentId: "risk", assessment: { documentId: "assessment" } },
                control: { documentId: "control" },
                controlOwner: null,
              };
            }
            if (uid === "api::csrm-assessment.csrm-assessment") {
              return {
                documentId: "assessment",
                assessmentStatus: facts.approved ? "approved" : "in-review",
                approvedBy: facts.approvedBy ? { documentId: "analyst" } : null,
                approvalDate: facts.approvalDate ? "2026-08-30T00:00:00.000Z" : null,
                reviewedBy: { documentId: "analyst" },
                assessmentRequest: { documentId: "request", requestStatus: "under-review" },
              };
            }
            return null;
          },
        };
      },
      db: {
        queryBuilder() { return query; },
        async transaction<T>(work: (context: { trx: unknown }) => Promise<T>) {
          return work({ trx: {} });
        },
      },
    };

    await assert.rejects(
      updateControlImplementationDocument({
        strapi: strapi as never,
        implementationDocumentId: "implementation",
        analystDocumentId: "analyst",
        body: { evidence: "Hostile descendant mutation" },
      }),
      (error: unknown) => error instanceof Error
        && "status" in error
        && (error as Error & { status: unknown }).status === 409,
      `PARTIAL_RELEASE_ALLOWED_DIRECT_CONTROL_IMPLEMENTATION_${JSON.stringify(facts)}`,
    );
  }
});

test("mounted provider failures are safe, observable, and retryable without enumeration", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  let jobId = "";
  await harness.withProviderFailure(async () => {
    const response = await request(
      `/api/v1/questionnaires/${encodeURIComponent(fixtures.jobTargets.providerFailure)}/generate_assessment`,
      harness.identities.analyst,
      { method: "POST" },
    );
    assert.equal(response.status, 202);
    jobId = String(((await payload(response)).data as Record<string, unknown>).jobId);
    const failed = await waitForJob(jobId, "failed");
    assert.equal(failed.failureCode, "DRAFT_GENERATION_FAILED");
    assert.equal(failed.failureMessage, "Assessment draft generation failed safely.");
    assert.doesNotMatch(JSON.stringify(failed), /injected|answer|stack|database/i);
    // IN-102: the run records the job's own code and message for the same failure, so the hub and a count of failed runs agree.
    assert.deepEqual(await draftRunOutcomes(fixtures.jobTargets.providerFailure), [["failed", "DRAFT_GENERATION_FAILED", "Assessment draft generation failed safely."]],
      "DRAFT_RUN_AND_JOB_RECORD_DIFFERENT_FAILURES");
  });

  const deniedLookup = await request(`/api/v1/assessment_draft_jobs/${encodeURIComponent(jobId)}`, harness.identities.owner);
  assert.equal(deniedLookup.status, 403);
  const missingLookup = await request("/api/v1/assessment_draft_jobs/not-a-real-job", harness.identities.analyst);
  assert.equal(missingLookup.status, 404);
  const retry = await request(`/api/v1/assessment_draft_jobs/${encodeURIComponent(jobId)}/retry`, harness.identities.analyst, { method: "POST" });
  assert.equal(retry.status, 202);
  assert.equal(((await payload(retry)).data as Record<string, unknown>).attempt, 2);
});

/*
 * D-18, G-3: any human Security Analyst on the request follows and retries its draft job. The second analyst reads
 * Bob's failed draft job by id (told Bob started it and that they may retry it), the generation-jobs read agrees,
 * and their retry is their own attempt: the job then reads as theirs, and the draft's generatedBy and the new run's
 * initiatedBy name them. The Requestor and the service agent stay refused, and an unknown job stays 404.
 */
test("mounted second analyst follows and retries Bob's failed draft job and the retry is theirs (D-18)", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const { requestId, questionnaireId } = await seedSubmittedSingleAnswerQuestionnaire("D18-COLLEAGUE-RETRY");
  const bob = { documentId: harness.users.analyst, displayName: "Bob Doe" };
  let jobId = "";
  await harness.withProviderFailure(async () => {
    const queued = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`, harness.identities.analyst, { method: "POST" });
    assert.equal(queued.status, 202, "BOB_DRAFT_NOT_QUEUED");
    jobId = String(((await payload(queued)).data as Record<string, unknown>).jobId);
    await waitForJob(jobId, "failed");
  });
  const jobPath = `/api/v1/assessment_draft_jobs/${encodeURIComponent(jobId)}`;

  const colleagueRead = await request(jobPath, harness.identities.secondAnalyst);
  assert.equal(colleagueRead.status, 200, "SECOND_ANALYST_DRAFT_JOB_READ_REFUSED");
  const colleague = (await payload(colleagueRead)).data as Record<string, unknown>;
  assert.equal(colleague.status, "failed", "SECOND_ANALYST_DRAFT_JOB_NOT_FAILED");
  assert.deepEqual(colleague.initiatedBy, bob, "SECOND_ANALYST_DRAFT_JOB_INITIATOR_NOT_NAMED");
  assert.equal(colleague.initiatedByViewer, false, "SECOND_ANALYST_TOLD_THEY_STARTED_BOBS_DRAFT");
  assert.equal(colleague.canRetry, true, "SECOND_ANALYST_MAY_NOT_RETRY_A_FAILED_DRAFT");
  const own = (await payload(await request(jobPath, harness.identities.analyst))).data as Record<string, unknown>;
  assert.equal(own.initiatedByViewer, true, "BOB_NOT_TOLD_HE_STARTED_THE_DRAFT");
  const jobsRead = await request(`/api/v1/assessment_requests/${encodeURIComponent(requestId)}/generation_jobs`, harness.identities.secondAnalyst);
  assert.equal(jobsRead.status, 200, "SECOND_ANALYST_GENERATION_JOBS_READ_REFUSED");
  const draftEntry = ((await payload(jobsRead)).data as Record<string, unknown>).assessmentDraft as Record<string, unknown>;
  assert.equal(draftEntry.canRetry, true, "SECOND_ANALYST_GENERATION_JOBS_DRAFT_NOT_RETRYABLE");

  for (const identity of [harness.identities.owner, harness.identities.serviceAnalystAgent]) {
    assert.equal((await request(jobPath, identity)).status, 403, `DRAFT_JOB_READ_NOT_REFUSED_${identity}`);
    assert.equal((await request(`${jobPath}/retry`, identity, { method: "POST" })).status, 403, `DRAFT_JOB_RETRY_NOT_REFUSED_${identity}`);
  }
  assert.equal((await request("/api/v1/assessment_draft_jobs/not-a-real-job", harness.identities.secondAnalyst)).status, 404, "SECOND_ANALYST_UNKNOWN_DRAFT_JOB_NOT_404");

  const retry = await request(`${jobPath}/retry`, harness.identities.secondAnalyst, { method: "POST" });
  assert.equal(retry.status, 202, "SECOND_ANALYST_DRAFT_RETRY_REFUSED");
  const retried = (await payload(retry)).data as Record<string, unknown>;
  assert.equal(retried.attempt, 2, "DRAFT_RETRY_NOT_A_NEW_ATTEMPT");
  assert.equal(retried.initiatedByViewer, true, "RETRIED_DRAFT_NOT_THE_RETRIERS");
  assert.deepEqual(retried.initiatedBy, { documentId: harness.users.secondAnalyst, displayName: "Second Analyst" }, "RETRIED_DRAFT_NOT_CREDITED_TO_THE_RETRIER");
  const completed = await waitForJob(jobId, "completed");
  const assessment = await harness.getAssessment(String(completed.assessmentId));
  assert.equal((assessment?.generatedBy as Record<string, unknown> | undefined)?.documentId, harness.users.secondAnalyst, "DRAFT_GENERATED_BY_NOT_THE_RETRIER");
  const runs = (await harness.listAiRunsForRequest(requestId)).filter((run) => run.operation === "assessment-draft");
  assert.deepEqual(runs.map((run) => [run.attempt, run.status, (run.initiatedBy as Record<string, unknown> | null)?.documentId]),
    [[1, "failed", harness.users.analyst], [2, "completed", harness.users.secondAnalyst]], "DRAFT_RUN_INITIATORS_NOT_BOB_THEN_THE_RETRIER");
});

test("mounted typed provider failures preserve safe taxonomy in the analyst job response", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const safeMessage = "Assessment draft provider is temporarily rate limited.";
  await harness.withProviderFailureCode("PROVIDER_RATE_LIMITED", safeMessage, async () => {
    const response = await request(
      `/api/v1/questionnaires/${encodeURIComponent(fixtures.jobTargets.providerFailureCode)}/generate_assessment`,
      harness.identities.analyst,
      { method: "POST" },
    );
    assert.equal(response.status, 202);
    const jobId = String(((await payload(response)).data as Record<string, unknown>).jobId);
    const failed = await waitForJob(jobId, "failed");
    assert.equal(failed.failureCode, "PROVIDER_RATE_LIMITED");
    assert.equal(failed.failureMessage, safeMessage);
    assert.doesNotMatch(JSON.stringify(failed), /127\.0\.0\.1|stack|at \w+ \(/i);
    assert.deepEqual(await draftRunOutcomes(fixtures.jobTargets.providerFailureCode), [["failed", "PROVIDER_RATE_LIMITED", safeMessage]],
      "DRAFT_RUN_AND_JOB_RECORD_DIFFERENT_FAILURES");
  });
});

/** The status, failure code and failure message of every draft run for a questionnaire's request, oldest first. */
async function draftRunOutcomes(questionnaireId: string): Promise<unknown[][]> {
  const harness = await harnessPromise;
  const questionnaire = await harness.getQuestionnaire(questionnaireId);
  const requestId = String((questionnaire?.assessmentRequest as Record<string, unknown> | undefined)?.documentId);
  return (await harness.listAiRunsForRequest(requestId))
    .filter((run) => run.operation === "assessment-draft")
    .map((run) => [run.status, run.failureCode, run.failureMessage]);
}

test("mounted zero-mapping draft generation persists an unreleasable assessment for human review", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const response = await request(
    `/api/v1/questionnaires/${encodeURIComponent(fixtures.jobTargets.zeroMapping)}/generate_assessment`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(response.status, 202);
  const queued = (await payload(response)).data as Record<string, unknown>;
  const completed = await waitForJob(String(queued.jobId), "completed");
  const assessment = await harness.getAssessment(String(completed.assessmentId));
  assert.ok(assessment, "ZERO_MAPPING_ASSESSMENT_NOT_PERSISTED");
  assert.deepEqual(assessment.risks, []);
  const readiness = validateReleaseReadiness(assessment);
  assert.equal(readiness.ready, false);
  assert.ok(readiness.missing.includes("risks"));
});

test("mounted assessment draft routes deny actors without the exact analyst grants", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const questionnaires = await harness.seedQuestionnaireWorkflowFixtures();

  for (const identity of [
    harness.identities.owner,
    harness.identities.otherRequestor,
    harness.identities.analystAgent,
    harness.identities.inactiveAnalyst,
    undefined,
  ]) {
    const denied = await request(
      `/api/v1/questionnaires/${encodeURIComponent(fixtures.jobTargets.completed)}/generate_assessment`,
      identity,
      { method: "POST" },
    );
    assert.equal(denied.status, 403, "UNEXPECTED_ASSESSMENT_DRAFT_GENERATION_DENIAL_STATUS");
    assert.doesNotMatch(await denied.text(), /SQL|stack|database|questionnaire answer|Submitted assessment job answer/i);
  }

  const nonSubmitted = await request(
    `/api/v1/questionnaires/${encodeURIComponent(questionnaires.questionnaires.ownerDraft)}/generate_assessment`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(nonSubmitted.status, 409);
  const missing = await request(
    "/api/v1/questionnaires/missing-questionnaire/generate_assessment",
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(missing.status, 404);
});

async function completeMountedReleaseReadiness(assessmentId: string): Promise<Array<Record<string, unknown>>> {
  const harness = await harnessPromise;
  const assessmentUpdate = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      summary: "Mounted assessment ready for explicit release",
      overallRating: "High",
      overallRiskRationale: "Mounted release readiness is complete and analyst reviewed.",
    }),
  });
  assert.equal(assessmentUpdate.status, 200, "RELEASE_READINESS_ASSESSMENT_UPDATE_FAILED");

  const riskResponse = await request(
    `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`,
    harness.identities.analyst,
  );
  assert.equal(riskResponse.status, 200, "RELEASE_READINESS_RISK_LIST_FAILED");
  const risks = rows(await payload(riskResponse));
  assert.ok(risks.length > 0, "RELEASE_READINESS_RISKS_MISSING");
  for (const risk of risks) {
    const riskUpdate = await request(`/api/v1/risks/${encodeURIComponent(String(risk.documentId))}`, harness.identities.analyst, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        riskStatement: typeof risk.riskStatement === "string" && risk.riskStatement.length > 0
          ? risk.riskStatement
          : "Mounted release risk statement",
        inherentLikelihood: "Likely",
        highestInherentConsequence: "Major",
        inherentRating: "High",
        residualLikelihood: "Possible",
        highestResidualConsequence: "Moderate",
        residualRating: "Moderate",
        riskOwner: harness.users.owner,
        treatmentAction: "Accept",
        targetDate: "2027-08-30",
      }),
    });
    assert.equal(riskUpdate.status, 200, `RELEASE_READINESS_RISK_UPDATE_FAILED_${risk.documentId}`);
  }

  const assessment = await harness.getAssessment(assessmentId);
  const assessmentFields = Object.entries(parseAssessmentAiProvenance(assessment?.aiProvenance)?.fields ?? {})
    .filter(([, fact]) => fact?.state === "proposed").map(([field]) => field);
  const decisions: Array<{ target: { kind: "assessment" } | { kind: "risk"; riskId: string }; action: "accept"; fields: string[] }> = [];
  if (assessmentFields.length) decisions.push({ target: { kind: "assessment" }, action: "accept", fields: assessmentFields });
  for (const risk of risks) {
    const riskId = String(risk.documentId);
    const stored = await harness.getRisk(riskId);
    const fields = Object.entries(parseRiskAiProvenance(stored?.aiProvenance)?.fields ?? {})
      .filter(([, fact]) => fact?.state === "proposed").map(([field]) => field);
    if (fields.length) decisions.push({ target: { kind: "risk", riskId }, action: "accept", fields });
  }
  if (decisions.length) {
    const outstanding = projectReleaseReadiness(assessment);
    assert.equal(outstanding.ready, false, "UNREVIEWED_PROPOSALS_WERE_RELEASE_READY");
    assert.ok(outstanding.requirements.some((item) => item.key === "aiProposalsReviewed" && item.state === "outstanding"), "AI_REVIEW_REQUIREMENT_MISSING");
    const reviewed = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/ai_proposal_decisions`, harness.identities.analyst, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ decisions }),
    });
    assert.equal(reviewed.status, 200, "RELEASE_READINESS_PROPOSALS_NOT_CONFIRMED");
  }

  // D-13: once every required field and review decision is complete the assessment is release-ready, so
  // any further accepted edit withdraws the completed review and stores `draft`.
  // Completing the last already-complete Risk is exactly such an edit, so this
  // helper ends by taking the fresh-review pass whenever it observes the
  // regression. That keeps the helper's contract — "in-review and release-ready"
  // — instead of leaving the caller to guess the edit parity.
  if ((await harness.getAssessment(assessmentId))?.assessmentStatus === "draft") {
    const freshReview = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ recommendationsSummary: "Mounted release readiness re-reviewed after completion." }),
    });
    assert.equal(freshReview.status, 200, "RELEASE_READINESS_FRESH_REVIEW_FAILED");
    assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "in-review",
      "RELEASE_READINESS_FRESH_REVIEW_DID_NOT_RESTORE_REVIEW");
  }
  return risks;
}

test("mounted explicit release is readiness-gated, atomic, and concurrent-safe", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  assert.notEqual(generatedAssessmentId, "", "RELEASE_ASSESSMENT_FIXTURE_MISSING");
  await completeMountedReleaseReadiness(generatedAssessmentId);
  const before = await harness.getAssessment(generatedAssessmentId);
  const requestId = String((before?.assessmentRequest as Record<string, unknown> | undefined)?.documentId);
  assert.notEqual(requestId, "undefined", "RELEASE_REQUEST_FIXTURE_MISSING");

  await harness.withDocumentWriteFailure(
    "api::csrm-assessment-request.csrm-assessment-request",
    "update",
    1,
    async () => {
      const failed = await request(
        `/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}/release`,
        harness.identities.analyst,
        { method: "POST" },
      );
      assert.equal(failed.status, 500, "RELEASE_SECOND_WRITE_FAILURE_NOT_OBSERVED");
      const failedText = await failed.text();
      assert.doesNotMatch(failedText, /SQL|stack|database|questionnaire answer|infrastructure detail/i);
      // D-20: an internal failure inside a production handler reaches the client as the bare envelope only.
      assert.deepEqual(JSON.parse(failedText), {
        data: null,
        error: { status: 500, name: "InternalServerError", message: "Internal Server Error" },
      }, "FAILED_RELEASE_ENVELOPE_NOT_BARE");
    },
  );
  const rolledBack = await harness.getAssessment(generatedAssessmentId);
  assert.equal(rolledBack?.assessmentStatus, "in-review", "FAILED_RELEASE_LEFT_APPROVED_STATUS");
  assert.equal(rolledBack?.approvedBy, null, "FAILED_RELEASE_LEFT_APPROVER");
  assert.equal(rolledBack?.approvalDate, null, "FAILED_RELEASE_LEFT_APPROVAL_DATE");
  assert.equal(rolledBack?.assessmentDate, null, "FAILED_RELEASE_LEFT_ASSESSMENT_DATE");
  assert.equal((await harness.getRequest(requestId))?.requestStatus, "under-review", "FAILED_RELEASE_APPROVED_REQUEST");

  const [first, second] = await harness.simultaneousRequests([
    { path: `/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}/release`, identity: harness.identities.analyst, init: { method: "POST" } },
    { path: `/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}/release`, identity: harness.identities.analyst, init: { method: "POST" } },
  ]);
  assert.deepEqual([first.status, second.status].sort((left, right) => left - right), [200, 409], "CONCURRENT_RELEASE_WAS_NOT_SINGLE_COMMIT");
  const releasedResponse = first.status === 200 ? first : second;
  const released = (await payload(releasedResponse)).data as Record<string, unknown>;
  assert.equal(released.assessmentStatus, "approved");
  assert.equal(typeof (released.approvedBy as Record<string, unknown>)?.documentId, "string", "RELEASING_ANALYST_MISSING");
  assert.notEqual((released.approvedBy as Record<string, unknown>)?.documentId, harness.users.owner, "REQUESTOR_BECAME_APPROVER");
  assert.notEqual((released.approvedBy as Record<string, unknown>)?.documentId, harness.users.otherRequestor, "OTHER_REQUESTOR_BECAME_APPROVER");
  assert.equal(released.assessmentDate, released.approvalDate, "RELEASE_TIMESTAMPS_DIVERGED");
  assert.ok(Number.isFinite(Date.parse(String(released.approvalDate))), "RELEASE_TIMESTAMP_INVALID");

  const persisted = await harness.getAssessment(generatedAssessmentId);
  assert.equal(persisted?.assessmentStatus, "approved");
  assert.equal((persisted?.approvedBy as Record<string, unknown>)?.documentId, (released.approvedBy as Record<string, unknown>)?.documentId);
  assert.equal(persisted?.assessmentDate, persisted?.approvalDate);
  assert.equal((await harness.getRequest(requestId))?.requestStatus, "approved");
  const repeat = await request(
    `/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}/release`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(repeat.status, 409, "REPEAT_RELEASE_DID_NOT_CONFLICT");

  for (const assessmentId of [
    fixtures.releaseFacts.unreleased,
    fixtures.releaseFacts.approvedOnly,
    fixtures.releaseFacts.approverOnly,
    fixtures.releaseFacts.approvalDateOnly,
    fixtures.releaseFacts.approvedAndApprover,
    fixtures.releaseFacts.approvedAndApprovalDate,
    fixtures.releaseFacts.approverAndApprovalDate,
    fixtures.releaseFacts.complete,
  ]) {
    const denied = await request(
      `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/release`,
      harness.identities.analyst,
      { method: "POST" },
    );
    assert.equal(denied.status, 409, `INVALID_RELEASE_STATE_ACCEPTED_${assessmentId}`);
  }

  for (const identity of [
    harness.identities.owner,
    harness.identities.otherRequestor,
    harness.identities.analystAgent,
    harness.identities.serviceAnalystAgent,
    harness.identities.inactiveAnalyst,
    undefined,
  ]) {
    const beforeAssessment = await harness.getAssessment(fixtures.releaseFacts.unreleased);
    const requestId = String((beforeAssessment?.assessmentRequest as Record<string, unknown> | undefined)?.documentId);
    const beforeRequest = await harness.getRequest(requestId);
    const denied = await request(
      `/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.unreleased)}/release`,
      identity,
      { method: "POST" },
    );
    assert.equal(denied.status, 403, `UNEXPECTED_RELEASE_ACTOR_${identity ?? "missing"}`);
    assert.deepEqual(await harness.getAssessment(fixtures.releaseFacts.unreleased), beforeAssessment,
      `DENIED_RELEASE_MUTATED_ASSESSMENT_${identity ?? "missing"}`);
    assert.deepEqual(await harness.getRequest(requestId), beforeRequest,
      `DENIED_RELEASE_MUTATED_REQUEST_${identity ?? "missing"}`);
  }
  for (const path of [
    `/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.unreleased)}/approve`,
    `/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.unreleased)}/submit_for_approval`,
  ]) {
    const absent = await request(path, harness.identities.analyst, { method: "POST" });
    assert.ok(absent.status === 404 || absent.status === 405, `AMBIGUOUS_RELEASE_VERB_MOUNTED_${path}`);
  }
});

/** A request whose released questionnaire holds one submitted answer, from which the deterministic draft proposes a Risk. */
async function seedSubmittedSingleAnswerQuestionnaire(key: string): Promise<{ requestId: string; questionnaireId: string }> {
  const harness = await harnessPromise;
  const at = "2026-10-01T00:00:00.000Z";
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: `REQ-${key}`, title: `Single answer draft ${key}`, requestStatus: "questionnaire-in-progress", requestor: harness.users.owner,
  });
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: `QUES-${key}`, title: `Single answer questionnaire ${key}`, assessmentRequest: requestId,
    releasedAt: at, releasedBy: harness.users.analyst, governanceLog: [{ schemaVersion: 1, kind: "released", at, by: harness.users.analyst }],
  });
  await harness.createFixtureDocument("api::csrm-question.csrm-question", {
    questionText: "Is the service reachable from the internet?", answerType: "Boolean", questionnaire: questionnaireId,
    options: { schemaVersion: 1, questionKey: "internet-facing", section: { key: "hosting", title: "Hosting", order: 1 }, order: 1, required: true },
    answer: { schemaVersion: 1, value: true, state: "submitted", updatedAt: at, submittedAt: at },
  });
  return { requestId, questionnaireId };
}

/*
 * CR-01: release fails closed on an AI review record that is present but can't be read. An AI-generated assessment
 * that is otherwise release-ready is refused with a 409, and nothing is written, while its own record is unreadable,
 * and again while one Risk's is. With both records readable again, the same assessment releases.
 */
test("mounted release refuses an AI-generated assessment whose AI review record can't be read and writes nothing", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const { requestId, questionnaireId } = await seedSubmittedSingleAnswerQuestionnaire("CR01-UNREADABLE-REVIEW");
  const queued = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`, harness.identities.analyst, { method: "POST" });
  assert.equal(queued.status, 202, await queued.clone().text());
  const job = await waitForJob(String(((await payload(queued)).data as Record<string, unknown>).jobId), "completed");
  const assessmentId = String(job.assessmentId);
  await completeMountedReleaseReadiness(assessmentId);
  const readinessOf = async () => {
    const detail = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst);
    assert.equal(detail.status, 200);
    return ((await payload(detail)).data as { releaseReadiness: { ready: boolean; requirements: Array<Record<string, unknown>> } }).releaseReadiness;
  };
  assert.equal((await readinessOf()).ready, true, "CR01_FIXTURE_NOT_RELEASE_READY");

  const ready = await harness.getAssessment(assessmentId);
  assert.ok(ready);
  const assessmentRecord = parseAssessmentAiProvenance(ready.aiProvenance);
  assert.ok(assessmentRecord, "CR01_FIXTURE_HAS_NO_ASSESSMENT_REVIEW_RECORD");
  const riskId = String((ready.risks as Array<Record<string, unknown>>)[0]?.documentId);
  const riskRecord = parseRiskAiProvenance((await harness.getRisk(riskId))?.aiProvenance);
  assert.ok(riskRecord, "CR01_FIXTURE_HAS_NO_RISK_REVIEW_RECORD");
  const snapshot = () => harness.snapshot([() => harness.getAssessment(assessmentId), () => harness.getRequest(requestId), () => harness.getRisk(riskId)]);
  // Present, and naming the run, but no longer a record the parser can read.
  const unreadable = { schemaVersion: 1, runId: assessmentRecord.runId };

  for (const [scope, uid, documentId, readable] of [
    ["assessment", "api::csrm-assessment.csrm-assessment", assessmentId, assessmentRecord],
    ["risk", "api::csrm-risk.csrm-risk", riskId, riskRecord],
  ] as const) {
    await harness.updateFixtureDocument(uid, documentId, { aiProvenance: unreadable });
    const before = await snapshot();
    const refused = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/release`, harness.identities.analyst, { method: "POST" });
    assert.equal(refused.status, 409, `CR01_UNREADABLE_${scope.toUpperCase()}_RECORD_RELEASED`);
    assert.deepEqual(await snapshot(), before, `CR01_UNREADABLE_${scope.toUpperCase()}_RECORD_REFUSAL_WROTE`);
    const readiness = await readinessOf();
    assert.equal(readiness.ready, false, `CR01_UNREADABLE_${scope.toUpperCase()}_RECORD_SHOWN_READY`);
    assert.deepEqual(
      readiness.requirements.filter((item) => item.key === "aiProposalsReviewed" && item.state === "outstanding").map((item) => item.scope),
      [scope],
      `CR01_UNREADABLE_${scope.toUpperCase()}_RECORD_REVIEW_NOT_OUTSTANDING`,
    );
    await harness.updateFixtureDocument(uid, documentId, { aiProvenance: readable });
  }

  const released = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/release`, harness.identities.analyst, { method: "POST" });
  assert.equal(released.status, 200, `CR01_READABLE_RECORDS_NOT_RELEASED: ${await released.clone().text()}`);
  // Walk D13(a): once released, the assessment can no longer change, so the analyst's read presents no release requirement.
  assert.deepEqual(await readinessOf(), { ready: false, requirements: [] }, "D13A_RELEASED_ASSESSMENT_PRESENTS_RELEASE_REQUIREMENTS");
});

/*
 * WR-206 and IN-103 (D-20: every provider call has exactly one run, which completes or fails). The request gains an
 * assessment from elsewhere after the draft's run is created, while the provider answers. The draft saves nothing and
 * leaves that assessment as it is, the job reports the assessment the request holds (as its pre-check would), and the
 * run is closed as failed with the closed code ASSESSMENT_ALREADY_EXISTS rather than left running.
 */
test("a draft whose request gains an assessment while the provider answers saves nothing and closes its run as failed", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const { requestId, questionnaireId } = await seedSubmittedSingleAnswerQuestionnaire("WR206-ASSESSMENT-EXISTS");
  const draftRuns = async () => (await harness.listAiRunsForRequest(requestId)).filter((run) => run.operation === "assessment-draft");
  let jobId = "";
  let otherAssessmentId = "";
  await harness.withHeldAssessmentDraftProvider(async (reached) => {
    const queued = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`, harness.identities.analyst, { method: "POST" });
    assert.equal(queued.status, 202, await queued.clone().text());
    jobId = String(((await payload(queued)).data as Record<string, unknown>).jobId);
    await reached;
    assert.deepEqual((await draftRuns()).map((run) => run.status), ["running"], "WR206_NO_OPEN_RUN_WHILE_THE_PROVIDER_ANSWERS");
    otherAssessmentId = await harness.createAssessmentFixture({ assessmentNumber: "ASSESS-WR206-OTHER", assessmentStatus: "draft", assessmentRequest: requestId });
  });

  const job = await waitForJob(jobId, "completed");
  assert.equal(job.assessmentId, otherAssessmentId, "WR206_JOB_DID_NOT_REPORT_THE_REQUEST_ASSESSMENT");
  const runs = await draftRuns();
  assert.equal(runs.length, 1, "WR206_DRAFT_RUNS_NOT_ONE_PER_PROVIDER_CALL");
  assert.equal(runs[0].status, "failed", "WR206_RUN_NOT_CLOSED");
  assert.equal(runs[0].failureCode, "ASSESSMENT_ALREADY_EXISTS", "WR206_RUN_FAILURE_CODE");
  assert.equal(runs[0].failureMessage, "An assessment already exists for this request, so this draft was not saved.", "WR206_RUN_FAILURE_MESSAGE");
  assert.ok(runs[0].completedAt, "WR206_RUN_NOT_DATED");
  assert.equal(runs[0].proposal, null, "WR206_RUN_KEPT_A_DISCARDED_PROPOSAL");
  assert.equal((await harness.getAiRun(String(runs[0].documentId)))?.assessment, null, "WR206_RUN_LINKED_TO_THE_OTHER_ASSESSMENT");
  assert.equal(await harness.countRisksForAssessment(otherAssessmentId), 0, "WR206_DRAFT_WROTE_INTO_THE_OTHER_ASSESSMENT");
  const after = await harness.getRequest(requestId);
  assert.equal((after?.assessment as Record<string, unknown> | null)?.documentId, otherAssessmentId, "WR206_REQUEST_LOST_ITS_ASSESSMENT");
  assert.equal(after?.requestStatus, "questionnaire-in-progress", "WR206_DRAFT_MOVED_THE_REQUEST");
});

/*
 * WR-104 (D-06): a draft within the parser's bounds but over the run record's 1 MB proposal bound (50 risks whose
 * statements are 2,000 characters in a non-Latin script) is refused as invalid provider output before the transaction
 * that would save it: nothing is saved, and its run records that code rather than the generic draft failure.
 */
test("a draft over the run record's proposal bound fails as invalid provider output and saves nothing", async () => {
  const harness = await harnessPromise;
  // The seeded Risk Types the deterministic draft maps to, so its proposal has risks to inflate.
  await harness.seedAssessmentWorkflowFixtures();
  const fixture = await harness.seedUatALikeRequest("OVERSIZED-DRAFT");
  const long = "€".repeat(2_000);
  const inflate = (proposal: Record<string, unknown>) => {
    const first = (proposal.risks as Array<Record<string, unknown>>)[0];
    const risks = Array.from({ length: 50 }, (_, index) => ({ ...first, proposalKey: `risk-${index + 1}`, issueStatement: long, riskStatement: long, riskCause: long, potentialImpact: long, inherentRatingRationale: long, residualRatingRationale: long, treatmentPlan: long }));
    return { ...proposal, overallRating: first.residualRating, risks };
  };
  await harness.withAssessmentDraftProviderOutput(inflate, async () => {
    await assert.rejects(harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst), { code: "PROVIDER_OUTPUT_INVALID" }, "OVERSIZED_DRAFT_NOT_INVALID_OUTPUT");
  });
  const runs = (await harness.listAiRunsForRequest(fixture.requestId)).filter((run) => run.operation === "assessment-draft");
  assert.deepEqual(runs.map((run) => [run.status, run.failureCode, run.proposal]), [["failed", "PROVIDER_OUTPUT_INVALID", null]], "OVERSIZED_DRAFT_RUN");
  const after = await harness.getRequest(fixture.requestId);
  assert.equal(after?.assessment ?? null, null, "OVERSIZED_DRAFT_SAVED_AN_ASSESSMENT");
  assert.equal(after?.requestStatus, "questionnaire-in-progress", "OVERSIZED_DRAFT_MOVED_THE_REQUEST");
});

/*
 * WR-205 (D-06): a request past a context bound (here 101 information assets, one more than the draft may send) is too
 * large for the draft. Run directly or through the registry, the draft fails with CONTEXT_TOO_LARGE before any run or
 * provider call, and nothing is saved.
 */
test("a draft whose request selects 101 information assets fails as too large before a run or a provider call", async () => {
  const harness = await harnessPromise;
  const at = "2026-10-01T00:00:00.000Z";
  const assets: string[] = [];
  for (let index = 0; index < 101; index += 1) {
    assets.push(await harness.createFixtureDocument("api::csrm-information-asset.csrm-information-asset", { name: `Context bound asset ${index}`, dataClassification: "Internal" }));
  }
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "REQ-CONTEXT-TOO-LARGE", title: "Context bound", requestStatus: "questionnaire-in-progress", requestor: harness.users.owner, informationAssets: assets,
  });
  const questionnaireId = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", {
    questionnaireNumber: "QUES-CONTEXT-TOO-LARGE", title: "Context bound questionnaire", assessmentRequest: requestId,
    releasedAt: at, releasedBy: harness.users.analyst, governanceLog: [{ schemaVersion: 1, kind: "released", at, by: harness.users.analyst }],
  });
  await harness.createFixtureDocument("api::csrm-question.csrm-question", {
    questionText: "Describe the service.", answerType: "Text", questionnaire: questionnaireId,
    options: { schemaVersion: 1, questionKey: "service", section: { key: "context", title: "Context", order: 1 }, order: 1, required: true },
    answer: { schemaVersion: 1, value: "A payroll service", state: "submitted", updatedAt: at, submittedAt: at },
  });
  const persisted = () => harness.snapshot([() => harness.getRequest(requestId), () => harness.getQuestionnaire(questionnaireId)]);
  const before = await persisted();
  await harness.withProviderCallRecorder(async (counts) => {
    await assert.rejects(harness.runAssessmentDraftJobFixture(questionnaireId, harness.users.analyst), { code: "CONTEXT_TOO_LARGE" }, "DIRECT_DRAFT_NOT_TOO_LARGE");
    const response = await request(`/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`, harness.identities.analyst, { method: "POST" });
    assert.equal(response.status, 202, await response.clone().text());
    const job = await waitForJob(String(((await payload(response)).data as Record<string, unknown>).jobId), "failed");
    assert.deepEqual([job.failureCode, job.failureMessage], ["CONTEXT_TOO_LARGE", "The request is too large for this operation."], "DRAFT_JOB_NOT_TOO_LARGE");
    assert.equal(counts.assessment(), 0, "CONTEXT_TOO_LARGE_CALLED_THE_PROVIDER");
  });
  assert.deepEqual(await harness.listAiRunsForRequest(requestId), [], "CONTEXT_TOO_LARGE_CREATED_A_RUN");
  assert.deepEqual(await persisted(), before, "CONTEXT_TOO_LARGE_SAVED_SOMETHING");
});

/*
 * Phase 13 D-27 and D-28 (COLLAB-01 criterion 3; G-3): draft generation builds its context through the same builder, so
 * it sends Jane's marked note, never Bob's unmarked reply, and its run's v2 summary names the note without its text.
 */
test("mounted draft generation sends the marked note and records it in the draft run's v2 summary", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const fixture = await harness.seedUatALikeRequest("NOTES-DRAFT");
  const [jane, bob] = uatALikeNotes();
  const [janeId] = await harness.seedRequestNotes(fixture.requestId, [jane, bob]);
  const { context } = await harness.buildAssessmentContextFixture({ operation: "assessment-draft", requestId: fixture.requestId, questionnaireId: fixture.questionnaireId });
  assert.ok(context.userPrompt.includes(UAT_A_LIKE_NOTE_SENTINELS.jane), "DRAFT_CONTEXT_WITHOUT_THE_MARKED_NOTE");
  assert.ok(!context.userPrompt.includes(UAT_A_LIKE_NOTE_SENTINELS.bob), "DRAFT_CONTEXT_WITH_THE_UNMARKED_NOTE");
  await harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst);
  const runs = (await harness.listAiRunsForRequest(fixture.requestId)).filter((run) => run.operation === "assessment-draft");
  assert.deepEqual(runs.map((run) => run.status), ["completed"], "NOTES_DRAFT_RUN");
  const summary = runs[0].contextSummary as Record<string, unknown>;
  assert.equal(summary.schemaVersion, 5, "DRAFT_RUN_SUMMARY_NOT_V5");
  assert.equal(summary.digest, context.digest, "DRAFT_RUN_DID_NOT_SEND_THE_CONTEXT_WITH_THE_MARKED_NOTE");
  assert.deepEqual(summary.notes, { included: [{ documentId: janeId, part: "requestor", sequence: 1, postedAt: jane.postedAt, characters: jane.body.length }], marked: 1, bound: 50 }, "DRAFT_RUN_SUMMARY_NOTES");
  for (const [part, stored] of [["SUMMARY", runs[0].contextSummary], ["PROPOSAL", runs[0].proposal]] as const) {
    for (const sentinel of Object.values(UAT_A_LIKE_NOTE_SENTINELS)) assert.equal(JSON.stringify(stored).includes(sentinel), false, `DRAFT_RUN_${part}_KEPT_NOTE_TEXT: ${sentinel}`);
  }
});

/*
 * Phase 13 D-27 (T-13-53): with 51 notes marked, the draft fails with CONTEXT_TOO_LARGE before any run or provider call,
 * run directly or through the registry, and the job's message names the marked notes so the analyst can unmark some.
 */
test("a draft with 51 marked notes fails as too large, naming them, before a run or a provider call", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const fixture = await harness.seedUatALikeRequest("NOTES-BOUND");
  await harness.seedRequestNotes(fixture.requestId, Array.from({ length: 51 }, (_, index) => ({ part: "requestor" as const, sequence: index + 1, postedAt: new Date(Date.UTC(2026, 8, 1, 0, 0, index)).toISOString(), body: `Marked note ${index + 1}.`, changesAiInputs: true })));
  const message = "The AI context is too large. 51 notes are marked as changing the AI inputs (notes 1 to 51); unmark some and try again.";
  const persisted = () => harness.snapshot([() => harness.getRequest(fixture.requestId), () => harness.getQuestionnaire(fixture.questionnaireId)]);
  const before = await persisted();
  await harness.withProviderCallRecorder(async (counts) => {
    await assert.rejects(harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst), { code: "CONTEXT_TOO_LARGE", safeMessage: message }, "DIRECT_NOTES_DRAFT_NOT_TOO_LARGE");
    const response = await request(`/api/v1/questionnaires/${encodeURIComponent(fixture.questionnaireId)}/generate_assessment`, harness.identities.analyst, { method: "POST" });
    assert.equal(response.status, 202, await response.clone().text());
    const job = await waitForJob(String(((await payload(response)).data as Record<string, unknown>).jobId), "failed");
    assert.deepEqual([job.failureCode, job.failureMessage], ["CONTEXT_TOO_LARGE", message], "NOTES_DRAFT_JOB_NOT_TOO_LARGE");
    assert.equal(counts.assessment(), 0, "MARKED_NOTES_BOUND_CALLED_THE_PROVIDER");
  });
  assert.deepEqual(await harness.listAiRunsForRequest(fixture.requestId), [], "MARKED_NOTES_BOUND_CREATED_A_RUN");
  assert.deepEqual(await persisted(), before, "MARKED_NOTES_BOUND_SAVED_SOMETHING");
});

test("mounted Requestor reads require owner scope and the complete release aggregate", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const detailFixtures = await buildAssessmentDetailAccessFixture();
  const ownerList = rows(await payload(await request("/api/v1/my_risk_assessments", harness.identities.owner)));
  assert.ok(ownerList.some((assessment) => assessment.documentId === fixtures.releaseFacts.complete), "OWNER_COMPLETE_RELEASE_MISSING");
  assert.ok(ownerList.some((assessment) => assessment.documentId === generatedAssessmentId), "OWNER_NEW_RELEASE_MISSING");
  assert.equal(ownerList.some((assessment) => assessment.documentId === fixtures.releaseFacts.crossOwnerComplete), false, "CROSS_OWNER_RELEASE_DISCLOSED");
  for (const assessmentId of [
    fixtures.releaseFacts.unreleased,
    fixtures.releaseFacts.approvedOnly,
    fixtures.releaseFacts.approverOnly,
    fixtures.releaseFacts.approvalDateOnly,
    fixtures.releaseFacts.approvedAndApprover,
    fixtures.releaseFacts.approvedAndApprovalDate,
    fixtures.releaseFacts.approverAndApprovalDate,
  ]) assert.equal(ownerList.some((assessment) => assessment.documentId === assessmentId), false, `PARTIAL_RELEASE_DISCLOSED_${assessmentId}`);

  const otherList = rows(await payload(await request("/api/v1/my_risk_assessments", harness.identities.otherRequestor)));
  assert.deepEqual(otherList.map((assessment) => assessment.documentId), [fixtures.releaseFacts.crossOwnerComplete]);
  // D-23, WR-304, D10: the Requestor's own list never names who generated a draft, the drafted release included.
  for (const assessment of [...ownerList, ...otherList]) {
    assert.equal(assessment.generatedBy, null, `OWNER_LIST_DISCLOSED_THE_GENERATOR_${String(assessment.documentId)}`);
  }
  const rating = (await payload(await request("/api/v1/my_risk_assessments/rating_summary", harness.identities.owner))).data;
  assert.deepEqual(Object.keys(rating as Record<string, unknown>).sort(), ["Critical", "High", "Low", "Moderate", "total"]);
  assert.equal((rating as Record<string, unknown>).total, ownerList.length);

  const detail = await request(`/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.complete)}`, harness.identities.owner);
  assert.equal(detail.status, 200, "OWNER_RELEASE_DETAIL_MISSING");
  const ownerDetail = (await payload(detail)).data as Record<string, unknown>;
  // The released detail now carries every release fact the contract promises.
  // The bounded route only admits an assessment that has all of them, so a
  // partially released row is absent rather than served unparseable.
  assert.equal(ownerDetail.assessmentStatus, "approved", "RELEASED_DETAIL_STATUS_NOT_APPROVED");
  assert.notEqual(ownerDetail.approvalDate, null, "RELEASED_DETAIL_APPROVAL_DATE_MISSING");
  assert.notEqual(ownerDetail.approvedBy, null, "RELEASED_DETAIL_APPROVER_MISSING");
  assert.deepEqual(ownerDetail.assessmentRequest, {
    documentId: detailFixtures.owner.request.documentId,
    requestNumber: detailFixtures.owner.request.requestNumber,
    title: detailFixtures.owner.request.title,
    requestStatus: detailFixtures.owner.request.requestStatus,
    // Phase 13 D-16, D-25 and Phase 14 D-27: the assignee, the notes and the files figures are the analyst's; the
    // Requestor's read carries null.
    assignment: null,
    notes: null,
    files: null,
  }, "OWNER_BOUNDED_REQUEST_SUMMARY_MISMATCH");
  assert.deepEqual(Object.keys(ownerDetail.assessmentRequest as Record<string, unknown>).sort(), ["assignment", "documentId", "files", "notes", "requestNumber", "requestStatus", "title"], "OWNER_REQUEST_SUMMARY_NOT_BOUNDED");
  // D-23: a seeded release was not drafted with AI; a drafted one says so, and nothing else of the AI facts.
  assert.equal(ownerDetail.aiAssisted, false, "SEEDED_RELEASE_AI_ASSISTED");
  const drafted = await request(`/api/v1/risk_assessments/${encodeURIComponent(generatedAssessmentId)}`, harness.identities.owner);
  assert.equal(drafted.status, 200, "OWNER_DRAFTED_RELEASE_DETAIL_MISSING");
  const draftedBody = await drafted.text();
  assert.equal((JSON.parse(draftedBody) as { data: Record<string, unknown> }).data.aiAssisted, true, "DRAFTED_RELEASE_NOT_AI_ASSISTED");
  // WR-304, IN-107 (D-23, UAT-032): nor who generated the draft. The stored record names one, so the read withholds it.
  const draftingAnalyst = ((await harness.getAssessment(generatedAssessmentId))?.generatedBy as Record<string, unknown> | null)?.documentId;
  assert.ok(typeof draftingAnalyst === "string" && draftingAnalyst.length > 0, "DRAFTED_RELEASE_HAS_NO_GENERATOR_TO_WITHHOLD");
  for (const forbidden of ['"generation"', '"aiProvenance"', '"runId"', "deterministic-assessment-draft", "providerName", "providerVersion", '"generatedBy"']) {
    assert.ok(!draftedBody.includes(forbidden), `REQUESTOR_SAW_${forbidden}`);
  }

  const analystDetailResponse = await request(`/api/v1/risk_assessments/${encodeURIComponent(detailFixtures.analyst.assessmentId)}`, harness.identities.analyst);
  assert.equal(analystDetailResponse.status, 200, "ANALYST_ASSESSMENT_DETAIL_MISSING");
  const analystDetail = (await payload(analystDetailResponse)).data as Record<string, unknown>;
  const { assignment: analystAssignment, notes: analystNotes, files: analystFiles, ...analystRequest } = analystDetail.assessmentRequest as Record<string, unknown>;
  assert.deepEqual(analystRequest, {
    documentId: detailFixtures.analyst.request.documentId,
    requestNumber: detailFixtures.analyst.request.requestNumber,
    title: detailFixtures.analyst.request.title,
    requestStatus: detailFixtures.analyst.request.requestStatus,
  }, "ANALYST_BOUNDED_REQUEST_SUMMARY_MISMATCH");
  // Phase 13 D-16, D-25: the analyst's read names who holds the request and its notes figures (the closed shapes only).
  assert.deepEqual(Object.keys(analystAssignment as Record<string, unknown>).sort(), ["assignee", "pickUp"], "ANALYST_REQUEST_SUMMARY_ASSIGNMENT");
  assert.deepEqual(Object.keys(analystNotes as Record<string, unknown>).sort(), ["total", "unread"], "ANALYST_REQUEST_SUMMARY_NOTES");
  // Phase 14 D-27: and how many files the request holds and how many are in the AI inputs.
  assert.deepEqual(Object.keys(analystFiles as Record<string, unknown>).sort(), ["count", "included"], "ANALYST_REQUEST_SUMMARY_FILES");
  assert.notEqual(ownerDetail.assessmentDate, null, "RELEASED_DETAIL_ASSESSMENT_DATE_MISSING");
  assert.equal(ownerDetail.actor, "requestor");
  for (const analystOnlyKey of ["ownerLabels", "releaseReadiness", "risks", "generatedBy"]) {
    assert.equal(Object.prototype.hasOwnProperty.call(ownerDetail, analystOnlyKey), false, `OWNER_DETAIL_DISCLOSED_${analystOnlyKey}`);
  }
  const risks = rows(await payload(await request(
    `/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.complete)}/risks`,
    harness.identities.owner,
  )));
  assert.ok(risks.some((risk) => risk.documentId === fixtures.aggregate.risk), "OWNER_RELEASE_RISK_MISSING");
  const controls = rows(await payload(await request(
    `/api/v1/risks/${encodeURIComponent(fixtures.aggregate.risk)}/control_implementations`,
    harness.identities.owner,
  )));
  assert.ok(controls.some((control) => control.documentId === fixtures.aggregate.controlImplementation), "OWNER_RELEASE_CONTROL_MISSING");
  // D-34: the owning Requestor reads each mitigation control by number, name and framework, never by id alone.
  assert.deepEqual(
    controls.find((control) => control.documentId === fixtures.aggregate.controlImplementation)?.controlSummary,
    {
      documentId: fixtures.aggregate.control,
      controlNumber: "MOUNTED-CTRL-001",
      name: "Mounted boundary protection",
      framework: "Mounted test framework",
    },
    "OWNER_RELEASE_CONTROL_SUMMARY_MISSING",
  );
  // Another Requestor still gets 404 on both released descendant reads, so the richer facts never cross owners.
  for (const path of [
    `/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.complete)}/risks`,
    `/api/v1/risks/${encodeURIComponent(fixtures.aggregate.risk)}/control_implementations`,
  ]) {
    const crossOwner = await request(path, harness.identities.otherRequestor);
    assert.equal(crossOwner.status, 404, `CROSS_OWNER_RELEASED_DESCENDANT_DISCLOSED_${path}`);
    assert.doesNotMatch(await crossOwner.text(), /Mounted aggregate risk|MOUNTED-CTRL-001|Mounted boundary protection/, `CROSS_OWNER_RELEASED_FACTS_DISCLOSED_${path}`);
  }

  for (const assessmentId of [fixtures.releaseFacts.unreleased, fixtures.releaseFacts.approvedOnly, fixtures.releaseFacts.crossOwnerComplete]) {
    const hidden = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.owner);
    assert.equal(hidden.status, 404, `OWNER_SCOPE_OR_COMPLETE_RELEASE_BYPASSED_${assessmentId}`);
    const body = await hidden.text();
    assert.doesNotMatch(body, new RegExp(`${detailFixtures.otherRequestor.request.title}|${detailFixtures.otherRequestor.request.requestNumber}|${detailFixtures.otherRequestor.request.documentId}`), "CROSS_OWNER_REQUEST_SUMMARY_DISCLOSED");
  }
  const birthrightRequestor = await request("/api/v1/my_risk_assessments", harness.identities.analystAgent);
  assert.equal(birthrightRequestor.status, 200, "IMPLICIT_REQUESTOR_RELEASED_COLLECTION_DENIED");
  assert.deepEqual(rows(await payload(birthrightRequestor)), [], "NON_OWNER_BIRTHRIGHT_REQUESTOR_DISCLOSURE");
  for (const identity of [harness.identities.inactiveAnalyst, undefined]) {
    const denied = await request("/api/v1/my_risk_assessments", identity);
    assert.equal(denied.status, 403, `UNEXPECTED_RELEASED_COLLECTION_ACTOR_${identity ?? "missing"}`);
  }
});

/*
 * Phase 19 D-14 (19-10): one module (released-assessment-read.ts) decides who may read a released assessment. Moving
 * My risk assessments, its rating summary and the three released reads onto it changes none of them, and the analyst's
 * detail says whether the assessment is released by the same rule.
 */
test("the one record-read check keeps My risk assessments and its rating summary to the caller's own releases, and the analyst detail says whether it is released", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const ratingOf = (assessments: Array<Record<string, unknown>>) => {
    const summary: Record<string, number> = { Low: 0, Moderate: 0, High: 0, Critical: 0, total: assessments.length };
    for (const assessment of assessments) {
      if (typeof assessment.overallRating === "string" && assessment.overallRating in summary) summary[assessment.overallRating] += 1;
    }
    return summary;
  };

  for (const [label, identity, own, foreign] of [
    ["JANE", harness.identities.owner, fixtures.releaseFacts.complete, fixtures.releaseFacts.crossOwnerComplete],
    ["SECONDARY_REQUESTOR", harness.identities.otherRequestor, fixtures.releaseFacts.crossOwnerComplete, fixtures.releaseFacts.complete],
  ] as const) {
    const list = rows(await payload(await request("/api/v1/my_risk_assessments?pageSize=100", identity)));
    const ids = list.map((assessment) => assessment.documentId);
    assert.ok(ids.includes(own), `${label}_OWN_RELEASE_MISSING`);
    assert.equal(ids.includes(foreign), false, `${label}_LISTS_ANOTHER_REQUESTORS_RELEASE`);
    assert.equal(ids.includes(fixtures.releaseFacts.unreleased), false, `${label}_LISTS_AN_UNRELEASED_ASSESSMENT`);
    for (const assessment of list) assert.equal(assessment.assessmentStatus, "approved", `${label}_LISTS_${String(assessment.assessmentStatus)}`);

    // The rating summary counts exactly the caller's released assessments, by overall rating, in today's shape.
    const rating = (await payload(await request("/api/v1/my_risk_assessments/rating_summary", identity))).data;
    assert.deepEqual(rating, ratingOf(list), `${label}_RATING_SUMMARY_NOT_THE_OWN_RELEASES`);
  }

  // D-14: the analyst detail carries the record-read check's answer for the analyst viewer.
  for (const [assessmentId, expected] of [
    [fixtures.releaseFacts.complete, true],
    [fixtures.releaseFacts.crossOwnerComplete, true],
    [fixtures.releaseFacts.unreleased, false],
    [fixtures.releaseFacts.approvedOnly, false],
    [fixtures.releaseFacts.approvedAndApprover, false],
  ] as const) {
    const response = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst);
    assert.equal(response.status, 200, `ANALYST_DETAIL_${assessmentId}`);
    const detail = (await payload(response)).data as Record<string, unknown>;
    assert.equal(detail.released, expected, `ANALYST_DETAIL_RELEASED_FLAG_${assessmentId}`);
  }
  // The Requestor's released read stays as it was: no released flag, which only the analyst's detail carries.
  const ownerDetail = (await payload(await request(`/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.complete)}`, harness.identities.owner))).data as Record<string, unknown>;
  assert.equal(Object.prototype.hasOwnProperty.call(ownerDetail, "released"), false, "REQUESTOR_DETAIL_GAINED_A_RELEASED_FLAG");
});

test("Requestor release capability remains read-only at every aggregate route", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  for (const [path, init] of [
    [`/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.unreleased)}/release`, { method: "POST" }],
    [`/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.complete)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: "Denied" }) }],
    [`/api/v1/risk_assessments/${encodeURIComponent(fixtures.releaseFacts.complete)}/risks`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Denied" }) }],
    [`/api/v1/risks/${encodeURIComponent(fixtures.aggregate.risk)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Denied" }) }],
    [`/api/v1/risks/${encodeURIComponent(fixtures.aggregate.risk)}/control_implementations`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ control: fixtures.aggregate.control }) }],
    [`/api/v1/control_implementations/${encodeURIComponent(fixtures.aggregate.controlImplementation)}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ evidence: "Denied" }) }],
    [`/api/v1/control_implementations/${encodeURIComponent(fixtures.aggregate.controlImplementation)}`, { method: "DELETE" }],
  ] as const) {
    const beforeAssessment = await harness.getAssessment(fixtures.releaseFacts.complete);
    const beforeRisk = await harness.getRisk(fixtures.aggregate.risk);
    const beforeControl = await harness.getControlImplementation(fixtures.aggregate.controlImplementation);
    const beforeRiskCount = await harness.countRisksForAssessment(fixtures.releaseFacts.complete);
    const beforeControlCount = await harness.countControlImplementationsForRisk(fixtures.aggregate.risk);
    const denied = await request(path, harness.identities.owner, init);
    assert.equal(denied.status, 403, `REQUESTOR_MUTATION_CAPABILITY_PRESENT_${init.method}_${path}`);
    assert.deepEqual(await harness.getAssessment(fixtures.releaseFacts.complete), beforeAssessment, `DENIED_MUTATION_CHANGED_ASSESSMENT_${path}`);
    assert.deepEqual(await harness.getRisk(fixtures.aggregate.risk), beforeRisk, `DENIED_MUTATION_CHANGED_RISK_${path}`);
    assert.deepEqual(await harness.getControlImplementation(fixtures.aggregate.controlImplementation), beforeControl, `DENIED_MUTATION_CHANGED_CONTROL_${path}`);
    assert.equal(await harness.countRisksForAssessment(fixtures.releaseFacts.complete), beforeRiskCount, `DENIED_MUTATION_CREATED_RISK_${path}`);
    assert.equal(await harness.countControlImplementationsForRisk(fixtures.aggregate.risk), beforeControlCount, `DENIED_MUTATION_CREATED_CONTROL_${path}`);
  }
});

test("mounted accepted edit withdraws a completed review, blocks release, and a fresh review restores it", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();

  // A dedicated aggregate, because the sequence below ends in a real release and
  // must not consume the assessment the concurrency release test owns.
  const queued = await request(
    `/api/v1/questionnaires/${encodeURIComponent(fixtures.jobTargets.completed)}/generate_assessment`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(queued.status, 202, "REVIEW_WITHDRAWAL_GENERATION_ROUTE_MISSING");
  const job = await waitForJob(String(((await payload(queued)).data as Record<string, unknown>).jobId), "completed");
  const assessmentId = String(job.assessmentId);
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "draft", "REVIEW_WITHDRAWAL_FIXTURE_NOT_DRAFT");

  // This questionnaire carries no mappable answer, so the draft has no Risk. One
  // minimal Risk is the fixture the shared completion helper then completes.
  const seededRisk = await request(
    `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`,
    harness.identities.analyst,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ riskStatement: "Withdrawn-review sequence risk statement" }),
    },
  );
  assert.equal(seededRisk.status, 201, "REVIEW_WITHDRAWAL_RISK_FIXTURE_MISSING");
  await completeMountedReleaseReadiness(assessmentId);

  const detailPath = `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`;
  const analystDetail = async () => (await payload(await request(detailPath, harness.identities.analyst))).data as Record<string, unknown>;
  const readyDetail = await analystDetail();
  assert.equal(readyDetail.assessmentStatus, "in-review", "REVIEW_WITHDRAWAL_FIXTURE_NOT_IN_REVIEW");
  assert.equal((readyDetail.releaseReadiness as { ready?: unknown } | undefined)?.ready, true,
    "REVIEW_WITHDRAWAL_FIXTURE_NOT_RELEASE_READY");
  const reviewerOfRecord = (readyDetail.reviewedBy as Record<string, unknown> | undefined)?.documentId;
  assert.equal(typeof reviewerOfRecord, "string", "REVIEW_WITHDRAWAL_FIXTURE_HAS_NO_REVIEWER");
  const requestId = String(((await harness.getAssessment(assessmentId))
    ?.assessmentRequest as Record<string, unknown> | undefined)?.documentId ?? "");
  assert.notEqual(requestId, "", "REVIEW_WITHDRAWAL_REQUEST_FIXTURE_MISSING");

  // One accepted edit to the reviewed, release-ready assessment.
  const withdrawing = await request(detailPath, harness.identities.analyst, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "Amended after the analyst review had completed" }),
  });
  assert.equal(withdrawing.status, 200, "ACCEPTED_EDIT_AFTER_REVIEW_WAS_REFUSED");
  const withdrawn = (await payload(withdrawing)).data as Record<string, unknown>;
  assert.equal(withdrawn.assessmentStatus, "draft", "COMPLETED_REVIEW_WAS_NOT_WITHDRAWN");
  assert.equal((withdrawn.reviewedBy as Record<string, unknown> | undefined)?.documentId, reviewerOfRecord,
    "WITHDRAWN_REVIEW_LOST_ITS_REVIEWER");
  const withdrawnReload = await analystDetail();
  assert.equal(withdrawnReload.assessmentStatus, "draft", "WITHDRAWN_REVIEW_WAS_NOT_PERSISTED");
  assert.equal((withdrawnReload.reviewedBy as Record<string, unknown> | undefined)?.documentId, reviewerOfRecord,
    "PERSISTED_WITHDRAWN_REVIEW_LOST_ITS_REVIEWER");
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "draft", "WITHDRAWN_REVIEW_STATUS_NOT_STORED");
  assert.equal((await harness.getRequest(requestId))?.requestStatus, "under-review", "WITHDRAWN_REVIEW_REGRESSED_THE_REQUEST");
  assert.deepEqual(
    (withdrawnReload.releaseReadiness as { requirements: Array<Record<string, unknown>> }).requirements
      .filter((requirement) => requirement.state === "outstanding")
      .map((requirement) => requirement.key),
    ["assessmentStatus"],
    "WITHDRAWN_REVIEW_DID_NOT_LEAVE_STATUS_AS_THE_ONLY_OUTSTANDING_REQUIREMENT",
  );

  const refused = await request(`${detailPath}/release`, harness.identities.analyst, { method: "POST" });
  assert.equal(refused.status, 409, "RELEASE_AFTER_WITHDRAWN_REVIEW_WAS_NOT_REFUSED");
  const refusedBody = await refused.text();
  assert.match(refusedBody, /not ready for release/i, "WITHDRAWN_REVIEW_REFUSAL_CHANGED_ITS_VOCABULARY");
  assert.doesNotMatch(refusedBody, /SQL|stack|database/i);
  assert.equal((await harness.getAssessment(assessmentId))?.approvalDate, null, "REFUSED_RELEASE_LEFT_AN_APPROVAL_DATE");

  // The fresh-review pass: the next accepted edit records the new review.
  const freshReview = await request(detailPath, harness.identities.analyst, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "Re-reviewed after the amendment" }),
  });
  assert.equal(freshReview.status, 200, "FRESH_REVIEW_EDIT_WAS_REFUSED");
  assert.equal(((await payload(freshReview)).data as Record<string, unknown>).assessmentStatus, "in-review",
    "FRESH_REVIEW_DID_NOT_RESTORE_THE_REVIEW");
  const restored = await analystDetail();
  assert.equal(restored.assessmentStatus, "in-review", "RESTORED_REVIEW_WAS_NOT_PERSISTED");
  assert.equal((restored.reviewedBy as Record<string, unknown> | undefined)?.documentId, reviewerOfRecord,
    "FRESH_REVIEW_REPLACED_THE_REVIEWER_OF_RECORD");
  assert.equal((restored.releaseReadiness as { ready?: unknown } | undefined)?.ready, true, "RESTORED_REVIEW_IS_NOT_RELEASE_READY");

  const released = await request(`${detailPath}/release`, harness.identities.analyst, { method: "POST" });
  assert.equal(released.status, 200, "RELEASE_AFTER_FRESH_REVIEW_WAS_REFUSED");
  assert.equal(((await payload(released)).data as Record<string, unknown>).assessmentStatus, "approved");
  const releasedRecord = await harness.getAssessment(assessmentId);
  assert.equal(releasedRecord?.assessmentStatus, "approved", "RELEASE_AFTER_FRESH_REVIEW_WAS_NOT_PERSISTED");
  assert.equal((await harness.getRequest(requestId))?.requestStatus, "approved", "RELEASED_REQUEST_DID_NOT_FOLLOW");
});

/*
 * Kept last on purpose. The closed assessment this seeds would otherwise change
 * the totals the earlier status-summary assertion sums (draft, in review and
 * approved), and it must not reach any earlier list read.
 */
async function buildClosedAssessmentFixture() {
  const harness = await harnessPromise;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "ASSESSMENT-STATUS-CLOSED-001",
    title: "Closed assessment status filter request",
    requestStatus: "closed",
    requestor: "owner",
  });
  const assessmentId = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-2026-CLOSED",
    assessmentStatus: "closed",
    assessmentRequest: requestId,
    summary: "Closed assessment status filter fixture",
  });
  return { requestId, assessmentId };
}

test("mounted analyst assessment list accepts closed within its scope while the owner list stays released-only", async () => {
  const harness = await harnessPromise;
  const fixture = await buildClosedAssessmentFixture();

  for (const status of ["draft", "in-review", "approved", "closed"]) {
    const response = await request(`/api/v1/risk_assessments?status=${status}&pageSize=100`, harness.identities.analyst);
    assert.equal(response.status, 200, `ANALYST_ASSESSMENT_STATUS_REJECTED_${status}`);
    const body = await payload(response);
    const found = rows(body);
    const pagination = (body.meta as { pagination: Record<string, number> }).pagination;
    // One page holds every match, so every returned assessment is inspected.
    assert.ok(pagination.total <= 100, `ANALYST_ASSESSMENT_STATUS_PAGE_TOO_SMALL_${status}`);
    assert.ok(found.every((row) => row.assessmentStatus === status), `ANALYST_ASSESSMENT_STATUS_FILTER_IGNORED_${status}`);
    assert.equal(found.some((row) => row.documentId === fixture.assessmentId), status === "closed", `CLOSED_ASSESSMENT_PLACEMENT_${status}`);
  }

  for (const query of ["status=bogus", "status=Closed", "status=", "status[$eq]=closed", "status=closed&status=approved"]) {
    const rejected = await request(`/api/v1/risk_assessments?${query}`, harness.identities.analyst);
    assert.equal(rejected.status, 400, `MALFORMED_ASSESSMENT_STATUS_ACCEPTED_${query}`);
    assert.doesNotMatch(await rejected.text(), /SQL|stack|database/i, `MALFORMED_ASSESSMENT_STATUS_LEAK_${query}`);
  }

  // The owner collection shares the status vocabulary but keeps its released-owner bound.
  const ownerClosed = await request("/api/v1/my_risk_assessments?status=closed", harness.identities.owner);
  assert.equal(ownerClosed.status, 200, "OWNER_CLOSED_STATUS_REJECTED");
  const ownerClosedBody = await payload(ownerClosed);
  assert.deepEqual(rows(ownerClosedBody), [], "OWNER_CLOSED_STATUS_WIDENED_THE_RELEASED_SCOPE");
  assert.equal((ownerClosedBody.meta as { pagination: Record<string, number> }).pagination.total, 0, "OWNER_CLOSED_STATUS_TOTAL");
  const ownerAll = rows(await payload(await request("/api/v1/my_risk_assessments?pageSize=100", harness.identities.owner)));
  assert.equal(ownerAll.some((row) => row.documentId === fixture.assessmentId), false, "OWNER_LIST_DISCLOSED_A_CLOSED_ASSESSMENT");
});

/*
 * The authorization matrix states these two successes of the service agent but does not issue them,
 * because each would change the unreleased fixture its other rows read (SR-02). The test drafts its
 * own assessment, and runs last so no earlier list or summary counts it.
 */
test("mounted assessment writes admit the service agent's exact grants", async () => {
  const harness = await harnessPromise;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "ASSESSMENT-SERVICE-AGENT-WRITE-001",
    title: "Service agent assessment write request",
    requestStatus: "risk-assessment-drafted",
    requestor: "owner",
  });
  const assessmentId = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-2026-AGENTW",
    assessmentStatus: "draft",
    assessmentRequest: requestId,
    summary: "Service agent write fixture",
  });

  const edited = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.serviceAnalystAgent, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ summary: "Service agent reviewed summary" }),
  });
  assert.equal(edited.status, 200, "SERVICE_AGENT_ASSESSMENT_EDIT_REFUSED");
  const persisted = await harness.getAssessment(assessmentId);
  assert.equal(persisted?.summary, "Service agent reviewed summary");
  assert.equal(persisted?.assessmentStatus, "in-review", "SERVICE_AGENT_FIRST_EDIT_DID_NOT_TRANSITION");

  const created = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`, harness.identities.serviceAnalystAgent, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ riskStatement: "Service agent contextual risk" }),
  });
  assert.equal(created.status, 201, "SERVICE_AGENT_RISK_CREATE_REFUSED");
  assert.equal(await harness.countRisksForAssessment(assessmentId), 1);
});

test("mounted released risk list carries each Risk's treatment and ownership for both actors and no one else", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const { relations } = await harness.seedRequestWorkflowFixtures();
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "ASSESSMENT-RELEASE-TREAT1",
    title: "Released treatment and ownership fixture",
    requestStatus: "approved",
    requestor: "owner",
  });
  const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASM-2026-TREAT1",
    assessmentStatus: "approved",
    summary: "Released treatment and ownership fixture",
    overallRating: "Moderate",
    assessmentRequest: requestId,
    approvedBy: harness.users.analyst,
    approvalDate: "2026-09-30T00:00:00.000Z",
    assessmentDate: "2026-09-30T00:00:00.000Z",
  });
  const fullRiskId = await harness.createRiskRegisterFixture(assessmentId, {
    riskNumber: "RSK-2026-TREAT1",
    riskStatement: "Released treated risk",
    informationSystemImpacted: relations.informationSystem,
    informationAssetImpacted: relations.informationAsset,
    inherentLikelihood: "Likely",
    highestInherentConsequence: "Major",
    inherentRating: "High",
    residualLikelihood: "Possible",
    highestResidualConsequence: "Moderate",
    residualRating: "Moderate",
    treatmentAction: "Treat",
    treatmentPlan: "Enforce phishing-resistant MFA for administrators.",
    treatmentStatus: "In Progress",
    riskOwner: harness.users.owner,
    treatmentOwner: harness.users.analyst,
    targetDate: "2027-08-30",
    // Analyst working facts the released list never carries.
    issueStatement: "Analyst-only issue statement",
    riskCause: "Analyst-only risk cause",
    inherentRatingRationale: "Analyst-only rating rationale",
    escalationDetails: "Analyst-only escalation",
    comments: "Analyst-only comment",
    dataClassification: "Restricted",
  });
  const sparseRiskId = await harness.createRiskRegisterFixture(assessmentId, {
    riskNumber: "RSK-2026-TREAT2",
    riskStatement: "Released risk with nothing else recorded",
  });

  const expected = [
    {
      documentId: fullRiskId,
      riskNumber: "RSK-2026-TREAT1",
      riskStatement: "Released treated risk",
      informationSystemImpacted: { documentId: relations.informationSystem, name: "Workflow system" },
      informationAssetImpacted: { documentId: relations.informationAsset, name: "Workflow asset" },
      inherentLikelihood: "Likely",
      highestInherentConsequence: "Major",
      inherentRating: "High",
      residualLikelihood: "Possible",
      highestResidualConsequence: "Moderate",
      residualRating: "Moderate",
      treatmentAction: "Treat",
      treatmentPlan: "Enforce phishing-resistant MFA for administrators.",
      treatmentStatus: "In Progress",
      riskOwner: { documentId: harness.users.owner, displayName: "Jane Doe" },
      treatmentOwner: { documentId: harness.users.analyst, displayName: "Bob Doe" },
      targetDate: "2027-08-30",
    },
    {
      documentId: sparseRiskId,
      riskNumber: "RSK-2026-TREAT2",
      riskStatement: "Released risk with nothing else recorded",
      informationSystemImpacted: null,
      informationAssetImpacted: null,
      inherentLikelihood: null,
      highestInherentConsequence: null,
      inherentRating: null,
      residualLikelihood: null,
      highestResidualConsequence: null,
      residualRating: null,
      treatmentAction: null,
      treatmentPlan: null,
      treatmentStatus: null,
      riskOwner: null,
      treatmentOwner: null,
      targetDate: null,
    },
  ];
  // The owning Requestor and the analyst read the same released facts (D-34).
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    const response = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`, identity);
    assert.equal(response.status, 200, `RELEASED_RISK_LIST_UNAVAILABLE_${identity}`);
    const body = await response.text();
    assert.deepEqual((JSON.parse(body) as { data: unknown }).data, expected, `RELEASED_RISK_LIST_ITEM_MISMATCH_${identity}`);
    assert.doesNotMatch(body, /Analyst-only|Restricted/, `RELEASED_RISK_LIST_DISCLOSED_ANALYST_FACTS_${identity}`);
  }

  // Another Requestor, and a birthright Requestor with no stake in the request, get 404 and no released fact.
  for (const identity of [harness.identities.otherRequestor, harness.identities.analystAgent]) {
    const response = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`, identity);
    assert.equal(response.status, 404, `CROSS_OWNER_RELEASED_RISK_LIST_${identity}`);
    assert.doesNotMatch(await response.text(), /Released treated risk|phishing-resistant|Jane Doe|Bob Doe|Workflow system/, `CROSS_OWNER_RELEASED_RISK_FACTS_${identity}`);
  }
});

/*
 * D-02 item 2, D-31: both assessment lists name each assessment's request title, count its Risks and show the
 * highest residual rating among them, from one grouped aggregate over the page. A Risk with no residual rating, or
 * one off the Low to Critical ladder, counts but never rates; an assessment with no rated Risk reads null.
 */
test("assessment lists carry the request title, the Risk count and the highest residual rating", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const ratedRequestId = await harness.createAssessmentRequestFixture({
    requestNumber: "ASSESSMENT-LIST-AGG1",
    title: "Brightwage payroll aggregate fixture",
    requestStatus: "approved",
    requestor: "owner",
  });
  const ratedAssessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASM-2026-AGGLIST1",
    assessmentStatus: "approved",
    summary: "Aggregate fixture with rated Risks",
    overallRating: "High",
    assessmentRequest: ratedRequestId,
    generatedBy: harness.users.analyst,
    generatedDate: "2026-09-26T00:30:00.000Z",
    approvedBy: harness.users.analyst,
    approvalDate: "2026-09-27T00:30:00.000Z",
    assessmentDate: "2026-09-27T00:30:00.000Z",
  });
  for (const [index, residualRating] of ["Moderate", "Critical", null, "Extreme"].entries()) {
    await harness.createRiskRegisterFixture(ratedAssessmentId, {
      riskNumber: `RSK-2026-AGGLIST${index + 1}`,
      riskStatement: `Aggregate list risk ${index + 1}`,
      ...(residualRating === null ? {} : { residualRating }),
    });
  }
  const emptyRequestId = await harness.createAssessmentRequestFixture({
    requestNumber: "ASSESSMENT-LIST-AGG2",
    title: "Aggregate fixture without Risks",
    requestStatus: "submitted",
    requestor: "owner",
  });
  const emptyAssessmentId = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-2026-AGGLIST2",
    assessmentStatus: "draft",
    assessmentRequest: emptyRequestId,
  });

  const analystResponse = await request("/api/v1/risk_assessments?q=ASM-2026-AGGLIST&pageSize=100", harness.identities.analyst);
  assert.equal(analystResponse.status, 200, "ASSESSMENT_LIST_AGGREGATE_READ_FAILED");
  const analystRows = rows(await payload(analystResponse));
  const rated = analystRows.find((row) => row.documentId === ratedAssessmentId);
  const empty = analystRows.find((row) => row.documentId === emptyAssessmentId);
  assert.ok(rated && empty, "ASSESSMENT_LIST_AGGREGATE_FIXTURES_MISSING");
  for (const row of [rated, empty]) assert.deepEqual(Object.keys(row).sort(), ASSESSMENT_SUMMARY_KEYS, "ASSESSMENT_LIST_ITEM_KEYS");
  assert.deepEqual(
    { requestTitle: rated.requestTitle, riskCount: rated.riskCount, highestResidualRating: rated.highestResidualRating },
    { requestTitle: "Brightwage payroll aggregate fixture", riskCount: 4, highestResidualRating: "Critical" },
    "ASSESSMENT_LIST_RISK_AGGREGATE_WRONG",
  );
  assert.deepEqual(
    { requestTitle: empty.requestTitle, riskCount: empty.riskCount, highestResidualRating: empty.highestResidualRating },
    { requestTitle: "Aggregate fixture without Risks", riskCount: 0, highestResidualRating: null },
    "ASSESSMENT_LIST_EMPTY_AGGREGATE_WRONG",
  );

  // The owner's released list carries the same projection for the same assessment, and nothing unreleased, except the
  // generating analyst: only the analyst list names who generated a draft ("Draft initiated by"); the Requestor's own
  // list serves null (D-23, WR-304, D10).
  assert.equal((rated.generatedBy as Record<string, unknown> | null)?.documentId, harness.users.analyst, "ANALYST_LIST_LOST_THE_GENERATOR");
  const ownerResponse = await request("/api/v1/my_risk_assessments?q=ASM-2026-AGGLIST&pageSize=100", harness.identities.owner);
  assert.equal(ownerResponse.status, 200, "OWNER_ASSESSMENT_LIST_AGGREGATE_READ_FAILED");
  const ownerRows = rows(await payload(ownerResponse));
  assert.deepEqual(ownerRows.map((row) => row.documentId), [ratedAssessmentId], "OWNER_ASSESSMENT_LIST_SCOPE_WRONG");
  assert.deepEqual(ownerRows[0], { ...rated, generatedBy: null }, "OWNER_ASSESSMENT_LIST_PROJECTION_DIFFERS");
});

/*
 * D-02 item 2 and T-11-04: q on both assessment lists also matches the request title; overallRating, approvedFrom
 * and approvedTo narrow both lists, the dates bounding the approval instant's UTC date inclusively. The owner list's
 * released, owner-scoped predicate sits in the same conjunction as every filter, so a filter only ever narrows it.
 */
async function buildAssessmentListFilterFixture() {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const released = async (suffix: string, title: string, overallRating: string, approvalDate: string) => {
    const requestId = await harness.createAssessmentRequestFixture({
      requestNumber: `ASSESSMENT-LIST-${suffix}`,
      title,
      requestStatus: "approved",
      requestor: "owner",
    });
    return harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: `ASM-2026-${suffix}`,
      assessmentStatus: "approved",
      summary: `Filter fixture ${suffix}`,
      overallRating,
      assessmentRequest: requestId,
      approvedBy: harness.users.analyst,
      approvalDate,
      assessmentDate: approvalDate,
    });
  };
  // The approval instant late on 10 September UTC, which is 11 September in Brisbane: the filter reads the UTC date.
  const highReleased = await released("FLTHIGH", "Quokka ledger filter fixture", "High", "2026-09-10T23:30:00.000Z");
  const lowReleased = await released("FLTLOW", "Wombat roster filter fixture", "Low", "2026-09-20T00:00:00.000Z");
  const draftRequestId = await harness.createAssessmentRequestFixture({
    requestNumber: "ASSESSMENT-LIST-FLTDRAFT",
    title: "Quokka draft filter fixture",
    requestStatus: "submitted",
    requestor: "owner",
  });
  const highDraft = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASM-2026-FLTDRAFT",
    assessmentStatus: "draft",
    summary: "Filter fixture draft",
    overallRating: "High",
    assessmentRequest: draftRequestId,
  });
  return { highReleased, lowReleased, highDraft };
}

let assessmentListFilterFixture: Promise<{ highReleased: string; lowReleased: string; highDraft: string }> | null = null;

/** The filter fixtures, built once for the four filter proofs below. */
function assessmentListFilterFixtures() {
  assessmentListFilterFixture ??= buildAssessmentListFilterFixture();
  return assessmentListFilterFixture;
}

async function listedFilterFixtures(path: "/api/v1/risk_assessments" | "/api/v1/my_risk_assessments", query: string, identity: string, fixtureIds: readonly string[]) {
  const response = await request(`${path}?${query}${query ? "&" : ""}pageSize=100`, identity);
  assert.equal(response.status, 200, `ASSESSMENT_LIST_FILTER_READ_FAILED_${path}?${query}`);
  const listed = rows(await payload(response));
  return { listed, ids: listed.map((row) => String(row.documentId)).filter((id) => fixtureIds.includes(id)).sort() };
}

test("both assessment lists find an assessment by a word of its request title", async () => {
  const harness = await harnessPromise;
  const fixtures = await assessmentListFilterFixtures();
  const all = Object.values(fixtures);

  const analyst = await listedFilterFixtures("/api/v1/risk_assessments", "q=quokka", harness.identities.analyst, all);
  assert.deepEqual(analyst.ids, [fixtures.highReleased, fixtures.highDraft].sort(), "ANALYST_REQUEST_TITLE_SEARCH_WRONG");
  const owner = await listedFilterFixtures("/api/v1/my_risk_assessments", "q=quokka", harness.identities.owner, all);
  assert.deepEqual(owner.ids, [fixtures.highReleased], "OWNER_REQUEST_TITLE_SEARCH_WRONG");
  // The number and the summary still match, as before.
  const byNumber = await listedFilterFixtures("/api/v1/risk_assessments", "q=ASM-2026-FLTLOW", harness.identities.analyst, all);
  assert.deepEqual(byNumber.ids, [fixtures.lowReleased], "ANALYST_NUMBER_SEARCH_WRONG");
  const bySummary = await listedFilterFixtures("/api/v1/risk_assessments", "q=Filter%20fixture%20draft", harness.identities.analyst, all);
  assert.deepEqual(bySummary.ids, [fixtures.highDraft], "ANALYST_SUMMARY_SEARCH_WRONG");
});

test("both assessment lists narrow by overall rating and by the approval's UTC date, inclusively", async () => {
  const harness = await harnessPromise;
  const fixtures = await assessmentListFilterFixtures();
  const all = Object.values(fixtures);
  const analyst = (query: string) => listedFilterFixtures("/api/v1/risk_assessments", query, harness.identities.analyst, all);
  const owner = (query: string) => listedFilterFixtures("/api/v1/my_risk_assessments", query, harness.identities.owner, all);

  const high = await analyst("q=ASM-2026-FLT&overallRating=High");
  assert.deepEqual(high.ids, [fixtures.highReleased, fixtures.highDraft].sort(), "ANALYST_OVERALL_RATING_FILTER_WRONG");
  assert.ok(high.listed.every((row) => row.overallRating === "High"), "ANALYST_OVERALL_RATING_FILTER_LEAKED");
  assert.deepEqual((await analyst("q=ASM-2026-FLT&overallRating=Low")).ids, [fixtures.lowReleased], "ANALYST_LOW_RATING_FILTER_WRONG");
  assert.deepEqual((await owner("overallRating=High")).ids, [fixtures.highReleased], "OWNER_OVERALL_RATING_FILTER_WRONG");

  const dateCases: ReadonlyArray<readonly [string, readonly string[]]> = [
    ["approvedFrom=2026-09-10&approvedTo=2026-09-10", [fixtures.highReleased]],
    ["approvedFrom=2026-09-11", [fixtures.lowReleased]],
    ["approvedTo=2026-09-19", [fixtures.highReleased]],
    ["approvedFrom=2026-09-20&approvedTo=2026-09-20", [fixtures.lowReleased]],
    ["approvedFrom=2026-09-01&approvedTo=2026-09-30", [fixtures.highReleased, fixtures.lowReleased].sort()],
    ["approvedFrom=2026-09-21", []],
  ];
  for (const [query, expected] of dateCases) {
    assert.deepEqual((await analyst(`q=ASM-2026-FLT&${query}`)).ids, expected, `ANALYST_RELEASE_DATE_FILTER_WRONG_${query}`);
    assert.deepEqual((await owner(query)).ids, expected, `OWNER_RELEASE_DATE_FILTER_WRONG_${query}`);
  }
});

test("an invalid rating, a malformed date or an inverted release range is refused on both lists", async () => {
  const harness = await harnessPromise;
  await assessmentListFilterFixtures();
  const refusedQueries = [
    "overallRating=Extreme",
    "overallRating=high",
    "overallRating=High&overallRating=Low",
    "overallRating%5B%24eq%5D=High",
    "approvedFrom=2026-02-30",
    "approvedFrom=2026-9-1",
    "approvedTo=20260930",
    "approvedTo=2026-09-30T00%3A00%3A00Z",
    "approvedFrom=2026-09-21&approvedTo=2026-09-20",
    "approvedFrom=",
  ];
  const lists: ReadonlyArray<readonly [string, string]> = [
    ["/api/v1/risk_assessments", harness.identities.analyst],
    ["/api/v1/my_risk_assessments", harness.identities.owner],
  ];
  for (const query of refusedQueries) {
    for (const [path, identity] of lists) {
      const response = await request(`${path}?${query}`, identity);
      assert.equal(response.status, 400, `ASSESSMENT_LIST_FILTER_NOT_REFUSED_${path}?${query}`);
      assert.doesNotMatch(await response.text(), /Quokka|Wombat|ASM-2026-FLT/, `ASSESSMENT_LIST_FILTER_REFUSAL_DISCLOSED_${path}?${query}`);
    }
  }
});

test("no filter combination widens the owner list: a second Requestor sees none of the owner's assessments and the owner no unreleased one", async () => {
  const harness = await harnessPromise;
  const fixtures = await assessmentListFilterFixtures();
  const all = Object.values(fixtures);
  const combinations = [
    "",
    "q=quokka",
    "q=ASM-2026-FLT",
    "overallRating=High",
    "overallRating=Low",
    "approvedFrom=2026-09-01&approvedTo=2026-09-30",
    "q=quokka&overallRating=High&approvedFrom=2026-09-01&approvedTo=2026-09-30",
    "status=approved&overallRating=High&approvedTo=2026-09-30",
    "status=draft&q=quokka&overallRating=High",
  ];
  for (const query of combinations) {
    for (const identity of [harness.identities.otherRequestor, harness.identities.analystAgent]) {
      const other = await listedFilterFixtures("/api/v1/my_risk_assessments", query, identity, all);
      assert.deepEqual(other.ids, [], `SECOND_REQUESTOR_SAW_OWNER_ASSESSMENT_${identity}_${query}`);
      assert.doesNotMatch(JSON.stringify(other.listed), /Quokka|Wombat|ASM-2026-FLT/, `SECOND_REQUESTOR_FACTS_DISCLOSED_${identity}_${query}`);
    }
    const owner = await listedFilterFixtures("/api/v1/my_risk_assessments", query, harness.identities.owner, all);
    assert.equal(owner.ids.includes(fixtures.highDraft), false, `OWNER_SAW_UNRELEASED_ASSESSMENT_${query}`);
    assert.ok(owner.listed.every((row) => row.assessmentStatus === "approved" && row.approvalDate !== null), `OWNER_LIST_NOT_RELEASED_ONLY_${query}`);
  }
});

test("mounted full-context draft records linked risks, provenance and a completed run", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const fixture = await harness.seedUatALikeFixture();
  const response = await request(`/api/v1/questionnaires/${fixture.questionnaireId}/generate_assessment`, harness.identities.analyst, { method: "POST" });
  assert.equal(response.status, 202);
  const queued = (await payload(response)).data as Record<string, unknown>;
  const job = await waitForJob(String(queued.jobId), "completed");
  const assessment = await harness.getAssessment(String(job.assessmentId));
  assert.ok(assessment);
  /* WR-210: the Risks in an explicit order, each found by what it is, never by where a relation populate put it. */
  const risks = await harness.listRisksForAssessment(String(job.assessmentId));
  const typeOf = (risk: Record<string, unknown>) => (risk.riskType as Record<string, unknown> | null)?.name ?? null;
  // WR-204: the untested pay-run fallback adds a Risk of no type.
  assert.deepEqual(risks.map((risk) => typeOf(risk) ?? "(no type)").sort(), [
    "(no type)", "Internet Exposure", "Personal Information Handling", "Personal Information Handling", "Third-Party Dependency",
  ], "FULL_CONTEXT_RISK_TYPES");
  const riskWhere = (name: string, predicate: (risk: Record<string, unknown>) => boolean) => {
    const found = risks.filter(predicate);
    assert.equal(found.length, 1, `FULL_CONTEXT_RISK_${name}`);
    return found[0];
  };
  const internetRisk = riskWhere("INTERNET_EXPOSURE", (risk) => typeOf(risk) === "Internet Exposure");
  const personalRisk = riskWhere("PERSONAL_DATA", (risk) => typeOf(risk) === "Personal Information Handling" && risk.riskSubCategory === "Personal information handling");
  const acceptRisk = riskWhere("THIRD_PARTY", (risk) => typeOf(risk) === "Third-Party Dependency");
  const recoveryRisk = riskWhere("RECOVERY", (risk) => typeOf(risk) === null);
  /*
   * WR-204 (success criterion 2, UAT-042): the draft cites the fallback answer, and lists the claim no source supports
   * as uncited, field by field in the stored record.
   */
  const recoveryFacts = recoveryRisk.aiProvenance as { fields: Record<string, { sources?: string[] }>; uncitedClaims: string[] };
  assert.deepEqual(recoveryFacts.fields.issueStatement?.sources, ["answer.recovery-tested"], "DRAFT_CITES_NO_ANSWER");
  assert.deepEqual(recoveryFacts.fields.potentialImpact?.sources, [], "THE_UNCITED_FIELD_GAINED_A_SOURCE");
  assert.deepEqual(recoveryFacts.uncitedClaims, ["Recovery time objectives for the service are not documented."], "DRAFT_LISTS_NO_UNCITED_CLAIM");
  assert.equal((internetRisk.informationSystemImpacted as Record<string, unknown>)?.documentId, fixture.systemIds[0]);
  assert.equal((internetRisk.informationSystemImpacted as Record<string, unknown>)?.name, "HR and payroll platform");
  assert.equal((personalRisk.informationAssetImpacted as Record<string, unknown>)?.documentId, fixture.assetIds[0]);
  assert.equal(personalRisk.dataClassification, "Restricted");
  /*
   * IN-203 and verifier W-1 (success criterion 1, D-13): the draft links each Risk to a system or an asset the request
   * selected, and every link it makes is to the request's own selection. The UAT-A-like request's HR and payroll platform
   * is the service's internet-facing system, run as SaaS, so the third-party and untested-recovery Risks link it too.
   */
  for (const risk of risks) {
    const links = ([
      ["system", (risk.informationSystemImpacted as Record<string, unknown> | null)?.documentId],
      ["asset", (risk.informationAssetImpacted as Record<string, unknown> | null)?.documentId],
    ] as const).filter(([, documentId]) => documentId);
    assert.ok(links.length > 0, `A_RISK_LINKS_NO_SELECTED_SYSTEM_OR_ASSET_${typeOf(risk) ?? "(no type)"}_${String(risk.riskSubCategory)}`);
    for (const [kind, documentId] of links) {
      assert.ok((kind === "system" ? fixture.systemIds : fixture.assetIds).includes(String(documentId)), `LINKED_A_${kind.toUpperCase()}_THE_REQUEST_DID_NOT_SELECT`);
    }
  }
  for (const [name, risk] of [["THIRD_PARTY", acceptRisk], ["RECOVERY", recoveryRisk]] as const) {
    assert.equal((risk.informationSystemImpacted as Record<string, unknown> | null)?.documentId, fixture.systemIds[0], `${name}_RISK_DOES_NOT_LINK_THE_PAYROLL_PLATFORM`);
  }
  assert.equal(acceptRisk.treatmentAction, "Accept");
  assert.ok(risks.every((risk) => parseRiskAiProvenance(risk.aiProvenance)));
  const registerRead = await request(`/api/v1/risks?assessment=${assessment.documentId}`, harness.identities.analyst);
  assert.equal(registerRead.status, 200);
  const registerRisks = rows(await payload(registerRead));
  assert.ok(registerRisks.some((risk) => risk.documentId === internetRisk.documentId));
  assert.ok(registerRisks.every((risk) => !("aiProvenance" in risk)));
  assert.ok(risks.every((risk) => Object.values((risk.aiProvenance as { fields: Record<string, { state: string }> }).fields)
    .every((field) => field.state === "proposed")));
  assert.ok(risks.every((risk) => Array.isArray(risk.controlImplementations) && risk.controlImplementations.length === 0));
  assert.ok(parseAssessmentAiProvenance(assessment.aiProvenance));
  // IN-208: one provider call, one run, and it is the one the assessment links.
  const requestRuns = (await harness.listAiRunsForRequest(fixture.requestId)).filter((item) => item.operation === "assessment-draft");
  assert.deepEqual(requestRuns.map((item) => item.status), ["completed"], "FULL_CONTEXT_DRAFT_RUNS_NOT_ONE");
  const runs = await harness.listAiRunsForAssessment(String(job.assessmentId));
  assert.equal(runs.length, 1, "FULL_CONTEXT_ASSESSMENT_RUNS_NOT_ONE");
  const run = runs[0];
  assert.equal(run.documentId, requestRuns[0].documentId, "FULL_CONTEXT_ASSESSMENT_RUN_NOT_THE_REQUEST_RUN");
  assert.ok(risks.every((risk) => (risk.aiProvenance as Record<string, unknown>).runId === run.documentId));
  assert.equal((assessment.aiProvenance as Record<string, unknown>).runId, run.documentId);
  assert.equal(acceptRisk.aiProvenance && (acceptRisk.aiProvenance as Record<string, unknown>).suggestions instanceof Array, true);
  const riskId = String(personalRisk.documentId);
  const changedStatement = await request(`/api/v1/risks/${riskId}`, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ riskStatement: "Analyst revised the risk statement", riskCategory: personalRisk.riskCategory }),
  });
  assert.equal(changedStatement.status, 200, await changedStatement.clone().text());
  const revisedRisk = await harness.getRisk(riskId);
  assert.ok(revisedRisk);
  const riskFacts = (revisedRisk.aiProvenance as { fields: Record<string, { state: string; by?: string; at?: string }> }).fields;
  assert.equal(riskFacts.riskStatement.state, "edited");
  assert.equal(riskFacts.riskStatement.by, harness.users.analyst);
  assert.ok(Date.parse(String(riskFacts.riskStatement.at)));
  assert.equal(riskFacts.riskCategory.state, "proposed");
  const alternateAsset = await harness.createFixtureDocument("api::csrm-information-asset.csrm-information-asset", {
    name: "Analyst selected asset", dataClassification: "Restricted",
  });
  const changedAsset = await request(`/api/v1/risks/${riskId}`, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" },
    body: JSON.stringify({ informationAssetImpacted: alternateAsset, comments: "Analyst context" }),
  });
  assert.equal(changedAsset.status, 200, await changedAsset.clone().text());
  const assetRisk = await harness.getRisk(riskId);
  assert.ok(assetRisk);
  const assetFacts = (assetRisk.aiProvenance as { fields: Record<string, { state: string }> }).fields;
  assert.equal(assetFacts.informationAssetImpacted.state, "edited");
  assert.equal(assetFacts.riskCategory.state, "proposed");

  const changedAssessment = await request(`/api/v1/risk_assessments/${assessment.documentId}`, harness.identities.analyst, {
    method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ summary: "Analyst revised the summary" }),
  });
  assert.equal(changedAssessment.status, 200, await changedAssessment.clone().text());
  const revisedAssessment = await harness.getAssessment(String(assessment.documentId));
  assert.ok(revisedAssessment);
  const assessmentFacts = (revisedAssessment.aiProvenance as { fields: Record<string, { state: string; by?: string; at?: string }> }).fields;
  assert.equal(assessmentFacts.summary.state, "edited");
  assert.equal(assessmentFacts.summary.by, harness.users.analyst);
  assert.equal(assessmentFacts.overallRating.state, "proposed");
  const revisedRun = await harness.getAiRun(String(run.documentId));
  assert.ok(revisedRun);
  const events = revisedRun.decisions as Array<{ kind: string; target: string; fields: string[] }>;
  assert.deepEqual(events.slice(-3).map((event) => [event.kind, event.target, event.fields]), [
    ["edited", riskId, ["riskStatement"]], ["edited", riskId, ["informationAssetImpacted"]], ["edited", "assessment", ["summary"]],
  ]);

  // D-12, D-14, D-21, D-23 and D-25: the analyst's read resolves the review state, sources and suggestions.
  type Review = { field: string; state: string; by: { documentId: string; displayName: string } | null; sources: Array<{ kind: string; label: string }> | null };
  type RiskReview = { runId: string; fields: Review[]; uncitedClaims: string[]; suggestions: Array<{ control: { controlNumber: string; name: string }; state: string }>; outstanding: number };
  const detailRead = await request(`/api/v1/risk_assessments/${assessment.documentId}`, harness.identities.analyst);
  assert.equal(detailRead.status, 200, "ANALYST_PROVENANCE_DETAIL_READ");
  const detail = (await payload(detailRead)).data as Record<string, unknown>;
  const generation = detail.generation as Record<string, unknown>;
  assert.equal(generation.runId, run.documentId, "ANALYST_GENERATION_RUN");
  assert.equal((generation.generatedBy as Record<string, unknown>).documentId, harness.users.analyst, "ANALYST_GENERATION_ACTOR");
  assert.equal(generation.providerName, "deterministic-assessment-draft", "ANALYST_GENERATION_PROVIDER");
  assert.equal(generation.providerVersion, "2", "ANALYST_GENERATION_VERSION");
  const assessmentReview = detail.aiProvenance as { fields: Review[]; outstanding: number };
  assert.equal(assessmentReview.fields.length, 4, "ANALYST_ASSESSMENT_FIELDS");
  assert.equal(assessmentReview.outstanding, 3, "ANALYST_ASSESSMENT_OUTSTANDING");
  const summaryReview = assessmentReview.fields.find((field) => field.field === "summary");
  assert.equal(summaryReview?.state, "edited", "ANALYST_SUMMARY_STATE");
  assert.equal(summaryReview?.by?.documentId, harness.users.analyst, "ANALYST_SUMMARY_ACTOR");
  assert.ok(summaryReview?.by?.displayName, "ANALYST_SUMMARY_ACTOR_NAME");
  const detailRisks = detail.risks as Array<{ documentId: string; aiProvenance: RiskReview | null }>;
  assert.equal(detailRisks.length, 5, "ANALYST_DETAIL_RISKS");
  const citations = detailRisks.flatMap((risk) => risk.aiProvenance?.fields.flatMap((field) => field.sources ?? []) ?? []);
  assert.ok(citations.length > 0, "ANALYST_NO_CITATIONS");
  assert.ok(citations.every((source) => source.label !== "Source no longer available"), "ANALYST_CITATION_UNRESOLVED");
  assert.ok(citations.some((source) => source.kind === "system" && source.label === "HR and payroll platform"), "ANALYST_SYSTEM_CITATION");
  assert.ok(citations.some((source) => source.kind === "request" && source.label === "Regulatory requirements"), "ANALYST_REQUEST_CITATION");
  // WR-204: an answer source reads as an answer, named by its question's current text, which the read resolves (WR-105).
  assert.deepEqual(citations.find((source) => source.kind === "answer"), {
    key: "answer.recovery-tested", kind: "answer", label: "Has the pay-run fallback been tested?", section: "Payment processing", classification: null,
  }, "ANALYST_ANSWER_CITATION");
  assert.deepEqual(detailRisks.find((risk) => risk.documentId === recoveryRisk.documentId)?.aiProvenance?.uncitedClaims,
    ["Recovery time objectives for the service are not documented."], "ANALYST_UNCITED_CLAIM");
  // IN-207: the UAT-A-like library's own Risk Types and controls reach the draft: each typed Treat Risk suggests its type's controls.
  const suggestedFor = (riskId: unknown) => detailRisks.find((risk) => risk.documentId === riskId)?.aiProvenance?.suggestions.map((suggestion) => suggestion.control.controlNumber) ?? [];
  for (const [name, riskId, controlNumbers] of [
    ["INTERNET_EXPOSURE", internetRisk.documentId, ["UATA-001", "UATA-002", "UATA-003"]],
    ["PERSONAL_DATA", personalRisk.documentId, ["UATA-002", "UATA-003", "UATA-004"]],
  ] as const) {
    for (const controlNumber of controlNumbers) assert.ok(suggestedFor(riskId).includes(controlNumber), `${name}_DOES_NOT_SUGGEST_${controlNumber}`);
  }
  assert.deepEqual(suggestedFor(acceptRisk.documentId), [], "AN_AI_ACCEPT_GAINED_A_SUGGESTION");
  for (const risk of detailRisks) {
    const review = risk.aiProvenance;
    assert.ok(review, `ANALYST_RISK_PROVENANCE_${risk.documentId}`);
    assert.equal(review.runId, run.documentId, "ANALYST_RISK_RUN");
    assert.equal(review.outstanding, review.fields.filter((field) => field.state === "proposed").length, "ANALYST_RISK_OUTSTANDING");
    assert.ok(review.suggestions.every((suggestion) => suggestion.control.controlNumber && suggestion.control.name), "ANALYST_SUGGESTION_CONTROL");
  }
  const editedRisk = detailRisks.find((risk) => risk.documentId === riskId)!.aiProvenance!;
  const statementReview = editedRisk.fields.find((field) => field.field === "riskStatement");
  assert.equal(statementReview?.state, "edited", "ANALYST_RISK_STATEMENT_STATE");
  assert.ok(statementReview?.by?.displayName, "ANALYST_RISK_STATEMENT_ACTOR_NAME");
});

test("mounted analyst detail projects missing or malformed provenance as null without failing the read", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const response = await request(`/api/v1/risk_assessments/${encodeURIComponent(fixtures.aggregate.assessment)}`, harness.identities.analyst);
  assert.equal(response.status, 200, "SEEDED_DETAIL_READ");
  const detail = (await payload(response)).data as Record<string, unknown>;
  assert.equal(detail.aiProvenance, null, "SEEDED_ASSESSMENT_PROVENANCE");
  assert.ok((detail.risks as Array<Record<string, unknown>>).every((risk) => risk.aiProvenance === null), "SEEDED_RISK_PROVENANCE");

  const requestId = await harness.createAssessmentRequestFixture({ requestNumber: "REQ-PROVENANCE-MALFORMED", title: "Malformed provenance", requestStatus: "risk-assessment-drafted", requestor: "owner" });
  const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASSESS-PROVENANCE-MALFORMED", assessmentStatus: "draft", assessmentRequest: requestId,
    generatedDate: "2026-09-01T00:00:00.000Z", providerName: "legacy-provider", providerVersion: "1", aiProvenance: { schemaVersion: 99 },
  });
  await harness.createRiskRegisterFixture(assessmentId, { riskNumber: "RSK-PROVENANCE-MALFORMED", riskStatement: "Existing risk", aiProvenance: { schemaVersion: 1, runId: "run-x" } });
  const malformed = await request(`/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, harness.identities.analyst);
  assert.equal(malformed.status, 200, "MALFORMED_DETAIL_READ");
  const malformedDetail = (await payload(malformed)).data as Record<string, unknown>;
  assert.equal(malformedDetail.aiProvenance, null, "MALFORMED_ASSESSMENT_PROVENANCE");
  assert.equal((malformedDetail.generation as Record<string, unknown>).runId, null, "MALFORMED_GENERATION_RUN");
  assert.ok((malformedDetail.risks as Array<Record<string, unknown>>).every((risk) => risk.aiProvenance === null), "MALFORMED_RISK_PROVENANCE");
});

/*
 * Phase 13 D-29, D-16 and D-25: after a draft generated with no note marked, marking Jane's note makes Bob's assessment
 * read list it, measured against the run the assessment's aiProvenance names (the read's generation.runId), and the
 * request read's aiInputs.assessment agrees. An assessment generated before run records compares by its generation date.
 * The analyst's request summary names the assignee, whether Bob may pick the request up, and the notes figures.
 */
test("mounted assessment read says which notes changed its AI inputs since the draft, and names the assignee and the notes (D-29, D-16, D-25)", async () => {
  const harness = await harnessPromise;
  const { analyst, owner } = harness.identities;
  await harness.seedAssessmentWorkflowFixtures();
  const fixture = await harness.seedUatALikeRequest("AI-INPUTS");
  const { assessmentId } = await harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst);
  const assessmentPath = `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`;
  const read = async (path: string, identity: string, diagnostic: string) => {
    const response = await request(path, identity);
    assert.equal(response.status, 200, diagnostic);
    return (await payload(response)).data as Record<string, unknown>;
  };
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const addNote = async (requestId: string, body: string) => {
    const response = await request(`/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes`, owner, json("POST", { data: { body } }));
    assert.equal(response.status, 200, "AI_INPUTS_JANE_NOTE");
    return (await payload(response)).data as Record<string, unknown>;
  };
  const markNote = async (requestId: string, noteId: unknown) => {
    const response = await request(`/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes/${encodeURIComponent(String(noteId))}/ai_input`, analyst, json("PUT", { data: { changesAiInputs: true } }));
    assert.equal(response.status, 200, "AI_INPUTS_MARK");
  };
  const draftRuns = (await harness.listAiRunsForAssessment(assessmentId)).filter((run) => run.operation === "assessment-draft" && run.status === "completed");
  assert.equal(draftRuns.length, 1, "AI_INPUTS_DRAFT_RUN");

  const first = await read(assessmentPath, analyst, "AI_INPUTS_ASSESSMENT_READ_BEFORE");
  const firstGeneration = first.generation as Record<string, unknown>;
  assert.equal(firstGeneration.runId, draftRuns[0].documentId, "AI_INPUTS_BASELINE_IS_NOT_THE_PROVENANCE_RUN");
  assert.equal(firstGeneration.aiInputsChanged, null, "AI_INPUTS_CHANGED_BEFORE_ANY_NOTE");
  assert.deepEqual((first.assessmentRequest as Record<string, unknown>).assignment, { assignee: null, pickUp: "allowed" }, "AI_INPUTS_SUMMARY_ASSIGNMENT_BEFORE");
  assert.deepEqual((first.assessmentRequest as Record<string, unknown>).notes, { total: 0, unread: 0 }, "AI_INPUTS_SUMMARY_NOTES_BEFORE");

  const note = await addNote(fixture.requestId, "The payroll processor now also stores files offshore.");
  await markNote(fixture.requestId, note.documentId);
  const pickUp = await request(`/api/v1/assessment_requests/${encodeURIComponent(fixture.requestId)}/assignee`, analyst, json("PUT", { data: { analyst: harness.users.analyst, expectedAnalyst: null } }));
  assert.equal(pickUp.status, 200, "AI_INPUTS_PICK_UP");

  const marked = { count: 1, notes: [{ documentId: note.documentId, part: "requestor", sequence: 1, postedAt: note.postedAt, change: "marked" }], files: [] };
  const after = await read(assessmentPath, analyst, "AI_INPUTS_ASSESSMENT_READ_AFTER");
  assert.equal((after.generation as Record<string, unknown>).runId, draftRuns[0].documentId, "AI_INPUTS_RUN_MOVED");
  assert.deepEqual((after.generation as Record<string, unknown>).aiInputsChanged, marked, "AI_INPUTS_MARKED_NOTE_NOT_LISTED");
  // WR-202: the Security Analyst Agent reads the analyst assessment too, but the signal is human analyst work only.
  const agentResponse = await request(assessmentPath, harness.identities.serviceAnalystAgent);
  assert.equal(agentResponse.status, 200, "AI_INPUTS_AGENT_ASSESSMENT_READ");
  const agentText = await agentResponse.text();
  const agentGeneration = (JSON.parse(agentText) as { data: Record<string, unknown> }).data.generation as Record<string, unknown> | null;
  assert.ok(agentGeneration !== null && typeof agentGeneration === "object", "AI_INPUTS_AGENT_ASSESSMENT_GENERATION_MISSING");
  assert.equal(agentGeneration.aiInputsChanged, null, "AI_INPUTS_AGENT_ASSESSMENT_SIGNAL");
  assert.ok(!agentText.includes(String(note.documentId)), "AI_INPUTS_AGENT_ASSESSMENT_SAW_THE_NOTE");
  assert.deepEqual((after.assessmentRequest as Record<string, unknown>).assignment, { assignee: { documentId: harness.users.analyst, displayName: "Bob Doe" }, pickUp: "not-offered" }, "AI_INPUTS_SUMMARY_ASSIGNMENT_AFTER");
  assert.deepEqual((after.assessmentRequest as Record<string, unknown>).notes, { total: 1, unread: 1 }, "AI_INPUTS_SUMMARY_NOTES_AFTER");
  const requestRead = await read(`/api/csrm-assessment-requests/${encodeURIComponent(fixture.requestId)}`, analyst, "AI_INPUTS_REQUEST_READ");
  assert.deepEqual((requestRead.aiInputs as Record<string, unknown>).assessment, marked, "AI_INPUTS_REQUEST_READ_DISAGREES");

  // Generated before run records existed: no aiProvenance, so the generation date is the baseline.
  const legacyRequest = await harness.createAssessmentRequestFixture({ requestNumber: "REQ-AI-INPUTS-LEGACY", title: "AI inputs legacy draft", requestStatus: "risk-assessment-drafted", requestor: "owner" });
  const legacyAssessment = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASSESS-AI-INPUTS-LEGACY", assessmentStatus: "draft", assessmentRequest: legacyRequest,
    generatedDate: "2026-09-01T00:00:00.000Z", providerName: "legacy-provider", providerVersion: "1",
  });
  const legacyNote = await addNote(legacyRequest, "A note after the legacy draft.");
  await markNote(legacyRequest, legacyNote.documentId);
  const legacy = await read(`/api/v1/risk_assessments/${encodeURIComponent(legacyAssessment)}`, analyst, "AI_INPUTS_LEGACY_ASSESSMENT_READ");
  assert.equal((legacy.generation as Record<string, unknown>).runId, null, "AI_INPUTS_LEGACY_HAS_A_RUN");
  assert.deepEqual((legacy.generation as Record<string, unknown>).aiInputsChanged, {
    count: 1, notes: [{ documentId: legacyNote.documentId, part: "requestor", sequence: 1, postedAt: legacyNote.postedAt, change: "marked" }], files: [],
  }, "AI_INPUTS_LEGACY_MARKED_NOTE_NOT_LISTED");
});

const ATTACHMENT_FIXTURES = path.resolve(__dirname, "..", "..", "..", "tests", "fixtures", "attachments");

/*
 * Phase 14 D-27 (14-UI-SPEC §6.1): the analyst's assessment read's request summary says how many files the request holds
 * and how many are included in the AI inputs, for the page to server-render under the request link; Jane's carries neither.
 */
test("mounted analyst assessment read's request summary counts the request's files and those in the AI inputs; Jane's carries none (D-27)", async () => {
  const harness = await harnessPromise;
  const { analyst, owner } = harness.identities;
  const requestId = await harness.createAssessmentRequestFixture({ requestNumber: "REQ-FILES-SUMMARY", title: "Files summary draft", requestStatus: "risk-assessment-drafted", submittedDate: "2026-09-01T00:00:00.000Z", requestor: "owner" });
  const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASSESS-FILES-SUMMARY", assessmentStatus: "draft", assessmentRequest: requestId,
    generatedDate: "2026-09-01T00:00:00.000Z", providerName: "legacy-provider", providerVersion: "1",
  });
  const assessmentPath = `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`;
  const attachmentsPath = `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/attachments`;
  const send = async (path: string, identity: string, init: RequestInit, status: number, diagnostic: string) => {
    const response = await request(path, identity, init);
    assert.equal(response.status, status, `${diagnostic}: ${await response.clone().text()}`);
    return (await payload(response)).data as Record<string, unknown>;
  };
  const addFile = async (fileName: string) => {
    const note = await send(`/api/v1/assessment_requests/${encodeURIComponent(requestId)}/notes`, owner, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { body: `${fileName} is attached.` } }) }, 200, "FILES_NOTE");
    const form = new FormData();
    form.set("file", new File([await readFile(path.join(ATTACHMENT_FIXTURES, fileName))], fileName));
    form.set("noteId", String(note.documentId));
    return String((await send(attachmentsPath, owner, { method: "POST", body: form }, 201, `FILES_UPLOAD_${fileName}`)).documentId);
  };
  const put = (attachmentId: string, action: string, identity: string, data: Record<string, unknown>) => send(
    `${attachmentsPath}/${encodeURIComponent(attachmentId)}/${action}`, identity, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) }, 200, `FILES_${action.toUpperCase()}`,
  );
  const filesFor = async (diagnostic: string) => ((await send(assessmentPath, analyst, {}, 200, diagnostic)).assessmentRequest as Record<string, unknown>).files;

  assert.deepEqual(await filesFor("FILES_BOB_BEFORE_ANY_FILE"), { count: 0, included: 0 }, "FILES_BEFORE_ANY_FILE");
  const packId = await addFile("vendor-security-pack.pdf");
  const dataFlowId = await addFile("data-flow.docx");
  await put(packId, "ai_input", analyst, { included: true });
  assert.deepEqual(await filesFor("FILES_BOB_TWO_FILES"), { count: 2, included: 1 }, "FILES_TWO_FILES_ONE_INCLUDED");
  // A removed file no longer counts.
  await put(dataFlowId, "removal", owner, { removed: true });
  assert.deepEqual(await filesFor("FILES_BOB_AFTER_REMOVAL"), { count: 1, included: 1 }, "FILES_AFTER_REMOVAL");

  // Jane reads her assessment only once it is released, and that read's summary serves files null (the released-read
  // shape test above, OWNER_BOUNDED_REQUEST_SUMMARY_MISMATCH).
  assert.equal((await request(assessmentPath, owner)).status, 404, "FILES_JANE_READ_THE_DRAFT");
});

/*
 * Phase 15 (15-08 Task 2; D-08): the assessment draft waits for every AI proposal on its questionnaire, refused before
 * queueing and failed inside the job's transaction when an item is open; after the items are decided it generates.
 */

const GATE_OFFSHORE_NOTE = "Jane: the vendor now uses an offshore support team with administrator access to the payroll system.";

async function draftGateRequest(path: string, identity: string, method = "POST"): Promise<Response> {
  return (await harnessPromise).request({ path, identity, init: { method } });
}

async function terminalDraftGateJob(jobId: string): Promise<Record<string, unknown>> {
  const harness = await harnessPromise;
  for (let attempt = 0; attempt < 200; attempt += 1) {
    const response = await draftGateRequest(`/api/v1/assessment_draft_jobs/${encodeURIComponent(jobId)}`, harness.identities.analyst, "GET");
    assert.equal(response.status, 200, "ASSESSMENT_DRAFT_JOB_UNREADABLE");
    const data = ((await response.json()) as { data: Record<string, unknown> }).data;
    if (data.status === "completed" || data.status === "failed") return data;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  assert.fail("ASSESSMENT_DRAFT_JOB_DID_NOT_REACH_TERMINAL_STATE");
}

test("mounted assessment draft is refused with AI_PROPOSALS_OPEN while an AI proposal item is open, fails in its transaction when an item reopens while it runs, and generates once every item is decided (D-08)", async () => {
  const harness = await harnessPromise;
  const { requestId, questionnaireId } = await harness.seedUatALikeRequest("DRAFT-GATE");
  await harness.seedRequestNotes(requestId, [{ part: "requestor", sequence: 1, postedAt: "2026-09-01T00:00:00.000Z", body: GATE_OFFSHORE_NOTE, changesAiInputs: true }]);
  const started = await harness.startQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId);
  assert.equal(started.status, 202, `PROPOSALS_NOT_STARTED: ${JSON.stringify(started)}`);
  const ended = await harness.waitForProposalJobFixture(String(started.data?.jobId));
  assert.equal(ended.status, "completed");
  const runId = String(ended.runId);
  const draftPath = `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`;

  const refused = await draftGateRequest(draftPath, harness.identities.analyst);
  assert.equal(refused.status, 409, `DRAFT_NOT_REFUSED: ${await refused.clone().text()}`);
  assert.equal(((await refused.json()) as { error?: { details?: { reason?: unknown } } }).error?.details?.reason, "AI_PROPOSALS_OPEN");

  const rejected = await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions: ["i-1", "i-2", "i-3"].map((item) => ({ runId, item, action: "reject" })) });
  assert.equal(rejected.status, 200, `REJECT_REMAINING_FAILED: ${JSON.stringify(rejected)}`);

  // An item reopened while the draft job runs: the job fails in its transaction and creates no assessment.
  const heldJobId = await harness.withHeldAssessmentDraftProvider(async (reached) => {
    const queued = await draftGateRequest(draftPath, harness.identities.analyst);
    assert.equal(queued.status, 202, `DRAFT_NOT_QUEUED: ${await queued.clone().text()}`);
    await reached;
    await harness.appendAiRunDecisionsFixture(runId, [{ schemaVersion: 2, at: new Date().toISOString(), by: harness.users.analyst, item: "i-1", action: "restored" } as never]);
    return String(((await queued.json()) as { data: Record<string, unknown> }).data.jobId);
  });
  const failed = await terminalDraftGateJob(heldJobId);
  assert.deepEqual([failed.status, failed.failureCode], ["failed", "AI_PROPOSALS_OPEN"], "HELD_DRAFT_DID_NOT_FAIL_ON_THE_OPEN_ITEM");
  assert.equal((await harness.getRequest(requestId))?.assessment ?? null, null, "HELD_DRAFT_CREATED_AN_ASSESSMENT");

  const rejectedAgain = await harness.decideQuestionnaireProposalsFixture(harness.users.analyst, questionnaireId, { decisions: [{ runId, item: "i-1", action: "reject" }] });
  assert.equal(rejectedAgain.status, 200);
  // The failed job is the questionnaire's job until it is retried (13-08): the retry generates the draft.
  const retried = await draftGateRequest(`/api/v1/assessment_draft_jobs/${encodeURIComponent(heldJobId)}/retry`, harness.identities.analyst);
  assert.equal(retried.status, 202, `DRAFT_RETRY_NOT_QUEUED: ${await retried.clone().text()}`);
  const completed = await terminalDraftGateJob(heldJobId);
  assert.equal(completed.status, "completed", `DRAFT_AFTER_DECISIONS_FAILED: ${String(completed.failureCode)}`);
});

/*
 * Phase 16 D-42 (16-10): release readiness takes the assessment's open risk AI proposal count as a fact. While it is above
 * zero, `aiProposalsDecided` ("Decisions on AI proposals", destination `ai-proposals`) is outstanding and the assessment is
 * not ready; at zero it is met. Without the fact (the pre-edit transition's field completeness), nothing changes.
 */
test("release readiness gains Decisions on AI proposals, outstanding while any risk AI proposal is open (D-42)", () => {
  const ready = {
    documentId: "assessment-ready", assessmentStatus: "in-review", reviewedBy: { documentId: "bob" },
    summary: "Summary", overallRating: "Moderate", overallRiskRationale: "Rationale", aiProvenance: null,
    risks: [{
      documentId: "risk-ready", riskNumber: "RSK-2026-AAAAAAAA", riskStatement: "Statement", inherentLikelihood: "Likely",
      highestInherentConsequence: "Major", inherentRating: "High", residualLikelihood: "Possible", highestResidualConsequence: "Moderate",
      residualRating: "Moderate", riskOwner: { documentId: "owner" }, treatmentAction: "Accept", targetDate: "2027-08-30", aiProvenance: null,
    }],
  };
  assert.deepEqual(validateReleaseReadiness(ready), { ready: true, missing: [] });
  assert.deepEqual(validateReleaseReadiness(ready, { openAiProposals: 0 }), { ready: true, missing: [] });
  assert.deepEqual(validateReleaseReadiness(ready, { openAiProposals: 3 }), { ready: false, missing: ["aiProposalsDecided"] });

  const outstanding = projectReleaseReadiness(ready, { openAiProposals: 2 });
  assert.equal(outstanding.ready, false);
  assert.deepEqual(outstanding.requirements.find((item) => item.key === "aiProposalsDecided"),
    { scope: "assessment", key: "aiProposalsDecided", label: "Decisions on AI proposals", state: "outstanding", destination: "ai-proposals" });
  const met = projectReleaseReadiness(ready, { openAiProposals: 0 });
  assert.equal(met.ready, true);
  assert.equal(met.requirements.find((item) => item.key === "aiProposalsDecided")?.state, "met");
  assert.equal(projectReleaseReadiness(ready).requirements.some((item) => item.key === "aiProposalsDecided"), false, "REQUIREMENT_WITHOUT_THE_FACT");
});
