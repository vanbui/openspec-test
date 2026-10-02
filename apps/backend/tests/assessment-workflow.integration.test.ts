import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
import { projectReleaseReadiness, validateReleaseReadiness } from "../src/api/csrm-assessment/services/assessment-workflow";
import { updateControlImplementation as updateControlImplementationDocument } from "../src/api/csrm-control-implementation/services/control-implementation-workflow";

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
  assert.ok(queueRows.every((row) => [
    "documentId",
    "requestNumber",
    "requestStatus",
    "submittedDate",
    "title",
  ].every((key) => key in row) && Object.keys(row).length === 5), "UNEXPECTED_ASSESSMENT_QUEUE_PROJECTION");
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
    { pagination: { page: 1, pageSize: 1, pageCount: 1, total: 1 } },
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
        assert.deepEqual(body.meta, { pagination: { page: 1, pageSize: 100, pageCount: 0, total: 0 } }, `OUTSIDE_QUEUE_STATUS_NOT_EMPTY_${label}`);
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
    "assessmentId", "attempt", "completedAt", "jobId", "questionnaireId", "queuedAt", "startedAt", "status",
  ]);
  assert.doesNotMatch(JSON.stringify(completed), /answer|provider|initiating|diagnostic/i);

  const assessment = await harness.getAssessment(String(completed.assessmentId));
  assert.equal(assessment?.assessmentStatus, "draft");
  assert.match(String(assessment?.assessmentNumber), /^ASM-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/);
  assert.equal(typeof assessment?.generatedDate, "string");
  assert.equal(assessment?.providerName, "deterministic-assessment-draft");
  assert.equal(assessment?.providerVersion, "1");
  assert.ok(assessment?.generatedBy && typeof assessment.generatedBy === "object", "ASSESSMENT_GENERATING_ANALYST_MISSING");
  assert.equal(assessment?.approvedBy, null);
  assert.equal(assessment?.approvalDate, null);
  const requestAfterRetry = await harness.getRequest(String(requestDocumentId));
  assert.equal(requestAfterRetry?.requestStatus, "risk-assessment-drafted");
  assert.equal((requestAfterRetry?.assessment as Record<string, unknown>)?.documentId, completed.assessmentId);
  const risks = Array.isArray(assessment?.risks) ? assessment.risks as Record<string, unknown>[] : [];
  assert.ok(risks.length > 0);
  assert.ok(risks.every((risk) => /^RSK-\d{4}-[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{6}$/.test(String(risk.riskNumber))));
  assert.ok(risks.every((risk) => /Suggested reusable controls: MOUNTED-CTRL-001/.test(String(risk.treatmentPlan))),
    "DETERMINISTIC_CONTROL_SUGGESTIONS_NOT_PERSISTED");

  const discovered = await request(
    `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`,
    harness.identities.analyst,
    { method: "POST" },
  );
  assert.equal(discovered.status, 202);
  assert.equal(((await payload(discovered)).data as Record<string, unknown>).jobId, queuedJob.jobId);

  const discoveredBySecondAnalyst = await request(
    `/api/v1/questionnaires/${encodeURIComponent(questionnaireId)}/generate_assessment`,
    harness.identities.serviceAnalystAgent,
    { method: "POST" },
  );
  assert.equal(discoveredBySecondAnalyst.status, 202, "SECOND_AUTHORISED_ANALYST_IDEMPOTENT_JOB_DENIED");
  assert.equal(((await payload(discoveredBySecondAnalyst)).data as Record<string, unknown>).jobId, queuedJob.jobId);

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
  assert.deepEqual(Object.keys(listRow).sort(), [
    "approvalDate", "assessmentNumber", "assessmentStatus", "documentId", "generatedBy", "generatedDate", "overallRating", "summary",
  ]);

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
    "actor", "approvalDate", "approvedBy", "assessmentDate", "assessmentNumber", "assessmentRequest", "assessmentStatus", "documentId", "generatedBy", "generatedDate",
    "nextReviewDate", "overallControlEffectiveness", "overallRating", "overallRiskRationale", "ownerLabels", "recommendationsSummary", "releaseReadiness", "reviewedBy", "risks", "summary",
  ]);
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
    assert.doesNotMatch(await immutable.text(), /SQL|stack|database/i);
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
  assert.ok(riskTypes.every((riskType) => Object.keys(riskType).sort().join(",") === "description,documentId,name"));

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
    ["documentId", "riskNumber", ...Object.keys(writableRisk)].sort(),
    "ANALYST_DETAIL_RISK_PROJECTION_IS_NOT_CLOSED",
  );
  assert.ok(Array.isArray(assessmentAfter.ownerLabels), "ANALYST_DETAIL_OWNER_LABELS_MISSING");
  // Readiness is still server-owned; it is now the complete named requirement
  // set rather than the validator's raw list of missing paths.
  assert.deepEqual(
    assessmentAfter.releaseReadiness,
    projectReleaseReadiness({ ...assessmentAfter, risks: reloadedRisks }),
    "ANALYST_DETAIL_READINESS_MUST_BE_SERVER_OWNED",
  );
  const persistedAssessmentAfter = await harness.getAssessment(generatedAssessmentId);
  const linkedRequestId = (persistedAssessmentAfter?.assessmentRequest as Record<string, unknown> | undefined)?.documentId;
  assert.equal((await harness.getRequest(String(linkedRequestId)))?.requestStatus, "under-review");
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
  });

  const deniedLookup = await request(`/api/v1/assessment_draft_jobs/${encodeURIComponent(jobId)}`, harness.identities.owner);
  assert.equal(deniedLookup.status, 403);
  const missingLookup = await request("/api/v1/assessment_draft_jobs/not-a-real-job", harness.identities.analyst);
  assert.equal(missingLookup.status, 404);
  const retry = await request(`/api/v1/assessment_draft_jobs/${encodeURIComponent(jobId)}/retry`, harness.identities.analyst, { method: "POST" });
  assert.equal(retry.status, 202);
  assert.equal(((await payload(retry)).data as Record<string, unknown>).attempt, 2);
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
  });
});

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

  // D-13: once every field above is complete the assessment is release-ready, so
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
  }, "OWNER_BOUNDED_REQUEST_SUMMARY_MISMATCH");
  assert.deepEqual(Object.keys(ownerDetail.assessmentRequest as Record<string, unknown>).sort(), ["documentId", "requestNumber", "requestStatus", "title"], "OWNER_REQUEST_SUMMARY_NOT_BOUNDED");

  const analystDetailResponse = await request(`/api/v1/risk_assessments/${encodeURIComponent(detailFixtures.analyst.assessmentId)}`, harness.identities.analyst);
  assert.equal(analystDetailResponse.status, 200, "ANALYST_ASSESSMENT_DETAIL_MISSING");
  const analystDetail = (await payload(analystDetailResponse)).data as Record<string, unknown>;
  assert.deepEqual(analystDetail.assessmentRequest, {
    documentId: detailFixtures.analyst.request.documentId,
    requestNumber: detailFixtures.analyst.request.requestNumber,
    title: detailFixtures.analyst.request.title,
    requestStatus: detailFixtures.analyst.request.requestStatus,
  }, "ANALYST_BOUNDED_REQUEST_SUMMARY_MISMATCH");
  assert.notEqual(ownerDetail.assessmentDate, null, "RELEASED_DETAIL_ASSESSMENT_DATE_MISSING");
  assert.equal(ownerDetail.actor, "requestor");
  for (const analystOnlyKey of ["ownerLabels", "releaseReadiness", "risks"]) {
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
