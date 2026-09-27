import assert from "node:assert/strict";
import test, { after } from "node:test";

import {
  createWithAssessmentRequestNumber,
  REQUEST_NUMBER_CREATE_ATTEMPTS,
} from "../src/api/csrm-assessment-request/services/request-number";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

async function request(path: string, identity: string, init: RequestInit = {}) {
  const harness = await harnessPromise;
  return harness.request({ path, identity, init });
}

function jsonRequest(method: "POST" | "PUT", data: Record<string, unknown>): RequestInit {
  return {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data }),
  };
}

function revertRequest(body: unknown): RequestInit {
  return {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  };
}

function relationDocumentId(value: unknown): string | undefined {
  return typeof value === "object" && value !== null
    ? (value as { documentId?: string }).documentId
    : undefined;
}

function relationDocumentIds(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map(relationDocumentId).filter((documentId): documentId is string => documentId !== undefined).sort()
    : [];
}

function responseData(payload: unknown): Record<string, unknown>[] {
  assert.equal(typeof payload, "object", "UNEXPECTED_LIST_PAYLOAD_TYPE");
  assert.ok(payload !== null, "UNEXPECTED_LIST_PAYLOAD_NULL");
  const data = (payload as { data?: unknown }).data;
  assert.ok(Array.isArray(data), "UNEXPECTED_LIST_DATA");
  return data as Record<string, unknown>[];
}

test("PHASE2 RED request workflow guards", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedRequestWorkflowFixtures();
  const forgedSubmittedDate = "2001-01-01T00:00:00.000Z";

  const forgedCreate = await request("/api/csrm-assessment-requests", harness.identities.owner, jsonRequest("POST", {
    requestNumber: "FORGED-REQUEST-NUMBER",
    title: "Created safely",
    requestStatus: "approved",
    submittedDate: forgedSubmittedDate,
    requestor: harness.users.otherRequestor,
    sponsor: harness.users.otherRequestor,
    questionnaire: fixtures.relations.questionnaire,
    assessment: fixtures.relations.assessment,
  }));
  assert.equal(forgedCreate.status, 200, "UNEXPECTED_FORGED_CREATE_STATUS");
  const forgedCreatePayload = await forgedCreate.json() as { data?: { documentId?: string } };
  const createdDocumentId = forgedCreatePayload.data?.documentId;
  assert.ok(createdDocumentId, "UNEXPECTED_CREATED_DOCUMENT_ID");
  const created = await harness.getRequest(createdDocumentId);
  assert.ok(created, "UNEXPECTED_CREATED_ROW_ABSENT");
  assert.equal(relationDocumentId(created.requestor), harness.users.owner, "UNEXPECTED_CREATE_OWNER");
  assert.match(String(created.requestNumber), /^RAR-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/, "UNEXPECTED_CREATE_NUMBER_FORMAT");
  assert.notEqual(created.requestNumber, "FORGED-REQUEST-NUMBER", "UNEXPECTED_CREATE_NUMBER_OWNERSHIP");
  assert.equal(created.requestStatus, "draft", "UNEXPECTED_CREATE_STATUS_OWNERSHIP");
  assert.equal(created.submittedDate, null, "UNEXPECTED_CREATE_SUBMITTED_DATE");
  assert.equal(created.sponsor, null, "UNEXPECTED_CREATE_SPONSOR");
  assert.equal(created.questionnaire, null, "UNEXPECTED_CREATE_QUESTIONNAIRE");
  assert.equal(created.assessment, null, "UNEXPECTED_CREATE_ASSESSMENT");

  const secondCreate = await request("/api/csrm-assessment-requests", harness.identities.owner, jsonRequest("POST", {
    title: "Second safe create",
  }));
  assert.equal(secondCreate.status, 200, "UNEXPECTED_SECOND_CREATE_STATUS");
  const secondDocumentId = (await secondCreate.json() as { data?: { documentId?: string } }).data?.documentId;
  assert.ok(secondDocumentId, "UNEXPECTED_SECOND_CREATED_DOCUMENT_ID");
  const second = await harness.getRequest(secondDocumentId);
  assert.ok(second, "UNEXPECTED_SECOND_CREATED_ROW_ABSENT");
  assert.match(String(second.requestNumber), /^RAR-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/, "UNEXPECTED_SECOND_NUMBER_FORMAT");
  assert.notEqual(second.requestNumber, created.requestNumber, "UNEXPECTED_DUPLICATE_REQUEST_NUMBER");

  const allowedUpdate = await request(
    `/api/csrm-assessment-requests/${fixtures.requests.editable}`,
    harness.identities.owner,
    jsonRequest("PUT", {
      title: "Editable request updated",
      description: "Persisted description",
      businessCriticality: "High",
      informationSystems: [fixtures.relations.informationSystem],
      informationAssets: [fixtures.relations.informationAsset],
      requestor: harness.users.otherRequestor,
      requestNumber: "FORGED-UPDATE-NUMBER",
      submittedDate: forgedSubmittedDate,
      questionnaire: fixtures.relations.questionnaire,
      assessment: fixtures.relations.assessment,
      sponsor: harness.users.otherRequestor,
    }),
  );
  assert.equal(allowedUpdate.status, 200, "UNEXPECTED_ALLOWED_UPDATE_STATUS");
  const editable = await harness.getRequest(fixtures.requests.editable);
  assert.ok(editable, "UNEXPECTED_EDITABLE_ROW_ABSENT");
  assert.equal(editable.title, "Editable request updated", "UNEXPECTED_UPDATED_TITLE");
  assert.equal(editable.description, "Persisted description", "UNEXPECTED_UPDATED_DESCRIPTION");
  assert.deepEqual(relationDocumentIds(editable.informationSystems), [fixtures.relations.informationSystem], "UNEXPECTED_SYSTEM_RELATION");
  assert.deepEqual(relationDocumentIds(editable.informationAssets), [fixtures.relations.informationAsset], "UNEXPECTED_ASSET_RELATION");
  assert.equal(relationDocumentId(editable.requestor), harness.users.owner, "UNEXPECTED_UPDATE_OWNER");
  assert.equal(editable.requestNumber, "WORKFLOW-EDIT-001", "UNEXPECTED_UPDATE_NUMBER");
  assert.equal(editable.submittedDate, null, "UNEXPECTED_UPDATE_SUBMITTED_DATE");
  assert.equal(editable.sponsor, null, "UNEXPECTED_UPDATE_SPONSOR");
  assert.equal(editable.questionnaire, null, "UNEXPECTED_UPDATE_QUESTIONNAIRE");
  assert.equal(editable.assessment, null, "UNEXPECTED_UPDATE_ASSESSMENT");

  const otherBefore = await harness.getRequest(harness.requests.otherRequestor);
  const crossOwner = await request(
    `/api/csrm-assessment-requests/${harness.requests.otherRequestor}`,
    harness.identities.owner,
    jsonRequest("PUT", { title: "Cross-owner mutation" }),
  );
  assert.equal(crossOwner.status, 403, "UNEXPECTED_OWNER_IDOR_STATUS");
  assert.deepEqual(await harness.getRequest(harness.requests.otherRequestor), otherBefore, "UNEXPECTED_OWNER_IDOR_PERSISTENCE");

  const submittedBefore = await harness.getRequest(fixtures.requests.submitted);
  const submittedEdit = await request(
    `/api/csrm-assessment-requests/${fixtures.requests.submitted}`,
    harness.identities.owner,
    jsonRequest("PUT", { title: "Submitted mutation" }),
  );
  assert.ok([400, 403, 409].includes(submittedEdit.status), "UNEXPECTED_SUBMITTED_EDIT_STATUS");
  assert.deepEqual(await harness.getRequest(fixtures.requests.submitted), submittedBefore, "UNEXPECTED_SUBMITTED_EDIT_PERSISTENCE");

  const submitStarted = Date.now();
  const submit = await request(
    `/api/csrm-assessment-requests/${fixtures.requests.transition}`,
    harness.identities.owner,
    jsonRequest("PUT", { requestStatus: "submitted", submittedDate: forgedSubmittedDate }),
  );
  const submitFinished = Date.now();
  assert.equal(submit.status, 200, "UNEXPECTED_SUBMIT_STATUS");
  const transitioned = await harness.getRequest(fixtures.requests.transition);
  assert.ok(transitioned, "UNEXPECTED_TRANSITIONED_ROW_ABSENT");
  const submittedTimestamp = Date.parse(String(transitioned.submittedDate));
  assert.equal(transitioned.requestStatus, "submitted", "UNEXPECTED_SUBMIT_STATUS_VALUE");
  assert.ok(Number.isFinite(submittedTimestamp) && submittedTimestamp >= submitStarted && submittedTimestamp <= submitFinished + 1000, "UNEXPECTED_SERVER_SUBMIT_TIMESTAMP");
  assert.notEqual(transitioned.submittedDate, forgedSubmittedDate, "UNEXPECTED_FORGED_SUBMIT_TIMESTAMP");

  const repeatedBefore = await harness.getRequest(fixtures.requests.transition);
  const repeated = await request(
    `/api/csrm-assessment-requests/${fixtures.requests.transition}`,
    harness.identities.owner,
    jsonRequest("PUT", { requestStatus: "submitted" }),
  );
  assert.ok([400, 403, 409].includes(repeated.status), "UNEXPECTED_REPEAT_SUBMIT_STATUS");
  assert.deepEqual(await harness.getRequest(fixtures.requests.transition), repeatedBefore, "UNEXPECTED_REPEAT_SUBMIT_PERSISTENCE");

  const illegalBefore = await harness.getRequest(fixtures.requests.illegalTransition);
  const illegal = await request(
    `/api/csrm-assessment-requests/${fixtures.requests.illegalTransition}`,
    harness.identities.owner,
    jsonRequest("PUT", { requestStatus: "approved" }),
  );
  assert.ok([400, 403, 409].includes(illegal.status), "UNEXPECTED_ILLEGAL_TRANSITION_STATUS");
  assert.deepEqual(await harness.getRequest(fixtures.requests.illegalTransition), illegalBefore, "UNEXPECTED_ILLEGAL_TRANSITION_PERSISTENCE");

  const scopedTotal = await harness.countRequestsForUser(harness.users.owner);
  const list = await request(
    `/api/csrm-assessment-requests?filters[requestor][documentId][$eq]=${harness.users.otherRequestor}&pagination[page]=1&pagination[pageSize]=2&populate[sponsor]=true`,
    harness.identities.owner,
  );
  assert.equal(list.status, 200, "UNEXPECTED_SCOPED_LIST_STATUS");
  const listPayload = await list.json() as { data?: unknown; meta?: { pagination?: Record<string, unknown> } };
  const listed = responseData(listPayload);
  assert.equal(listed.length, Math.min(scopedTotal, 2), "UNEXPECTED_BOUNDED_PAGE_DATA");
  assert.equal(listed.some((item) => relationDocumentId(item.requestor) === harness.users.otherRequestor), false, "UNEXPECTED_HOSTILE_OWNER_FILTER");
  assert.equal(listed.some((item) => "sponsor" in item), false, "UNEXPECTED_SPONSOR_EXPANSION");
  const pagination = listPayload.meta?.pagination;
  const expectedPageCount = Math.ceil(scopedTotal / 2);
  assert.deepEqual(pagination, { page: 1, pageSize: 2, pageCount: expectedPageCount, total: scopedTotal }, "UNEXPECTED_SCOPED_PAGINATION");

  const generatedDashboardQuery = await request(
    "/api/csrm-assessment-requests?populate=questionnaire&populate=assessment&_q=Editable&sort[updatedAt]=desc&pagination[page]=1&pagination[pageSize]=50",
    harness.identities.owner,
  );
  assert.equal(generatedDashboardQuery.status, 200, "UNEXPECTED_GENERATED_DASHBOARD_QUERY_STATUS");
  const dashboardPayload = await generatedDashboardQuery.json() as { data?: unknown };
  const dashboardRows = responseData(dashboardPayload);
  assert.equal(dashboardRows.length, 1, "UNEXPECTED_DASHBOARD_ROW_COUNT");
  assert.equal(dashboardRows[0]?.title, "Editable request updated", "UNEXPECTED_DASHBOARD_PROJECTION");
  assert.equal(dashboardRows.some((item) => "sponsor" in item), false, "UNEXPECTED_DASHBOARD_SPONSOR_EXPANSION");

  const malformed = await request("/api/csrm-assessment-requests?filters=malformed", harness.identities.owner);
  assert.equal(malformed.status, 400, "UNEXPECTED_MALFORMED_QUERY_STATUS");

  let collisionAttempts = 0;
  const retried = await createWithAssessmentRequestNumber(async () => {
    collisionAttempts += 1;
    if (collisionAttempts < 3) {
      throw Object.assign(new Error("requestNumber unique constraint"), { code: "SQLITE_CONSTRAINT_UNIQUE" });
    }
    return "created";
  }, () => "RAR-2026-X7K4Q2");
  assert.equal(retried, "created", "UNEXPECTED_UNIQUE_RETRY_RESULT");
  assert.equal(collisionAttempts, 3, "UNEXPECTED_UNIQUE_RETRY_COUNT");

  let nonUniqueAttempts = 0;
  await assert.rejects(
    createWithAssessmentRequestNumber(async () => {
      nonUniqueAttempts += 1;
      throw new Error("database unavailable");
    }, () => "RAR-2026-X7K4Q2"),
    /database unavailable/,
    "UNEXPECTED_NON_UNIQUE_ERROR",
  );
  assert.equal(nonUniqueAttempts, 1, "UNEXPECTED_NON_UNIQUE_RETRY");

  let exhaustedAttempts = 0;
  await assert.rejects(createWithAssessmentRequestNumber(async () => {
    exhaustedAttempts += 1;
    throw Object.assign(new Error("requestNumber unique constraint"), { code: "SQLITE_CONSTRAINT_UNIQUE" });
  }, () => "RAR-2026-X7K4Q2"));
  assert.equal(exhaustedAttempts, REQUEST_NUMBER_CREATE_ATTEMPTS, "UNEXPECTED_UNIQUE_RETRY_BOUND");

});

test("request revert returns only eligible submitted requests to draft with server-owned audit facts", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedRequestWorkflowFixtures();
  const requestPath = (documentId: string) => `/api/v1/assessment_requests/${documentId}/revert_to_draft`;

  const ownerResult = await request(requestPath(fixtures.requests.submitted), harness.identities.owner, revertRequest({ reason: "  Clarify the business impact.  " }));
  assert.equal(ownerResult.status, 200, "UNEXPECTED_OWNER_REQUEST_REVERT_STATUS");
  const ownerPersisted = await harness.getRequest(fixtures.requests.submitted);
  assert.ok(ownerPersisted, "UNEXPECTED_OWNER_REVERTED_REQUEST_ABSENT");
  assert.equal(ownerPersisted.requestStatus, "draft", "UNEXPECTED_OWNER_REVERTED_STATUS");
  assert.equal(ownerPersisted.submittedDate, null, "UNEXPECTED_OWNER_REVERTED_SUBMITTED_DATE");
  assert.equal(ownerPersisted.revertReason, "Clarify the business impact.", "UNEXPECTED_OWNER_REVERT_REASON");
  assert.equal(relationDocumentId(ownerPersisted.revertedBy), harness.users.owner, "UNEXPECTED_OWNER_REVERTED_BY");
  assert.ok(Number.isFinite(Date.parse(String(ownerPersisted.revertedAt))), "UNEXPECTED_OWNER_REVERTED_AT");

  /*
   * The typed web boundary parses this response and treats a shape mismatch as
   * a service failure, which would report a reversal that actually happened as
   * one that did not. Assert the response body itself carries the audit facts,
   * with revertedBy populated as a relation rather than left unresolved.
   */
  const ownerBody = await ownerResult.json() as { data?: Record<string, unknown> };
  const reverted = ownerBody.data ?? {};
  assert.equal(reverted.requestStatus, "draft", "UNEXPECTED_REVERT_RESPONSE_STATUS");
  assert.equal(reverted.submittedDate, null, "UNEXPECTED_REVERT_RESPONSE_SUBMITTED_DATE");
  assert.equal(reverted.revertReason, "Clarify the business impact.", "UNEXPECTED_REVERT_RESPONSE_REASON");
  assert.ok(Number.isFinite(Date.parse(String(reverted.revertedAt))), "UNEXPECTED_REVERT_RESPONSE_REVERTED_AT");
  assert.equal(relationDocumentId(reverted.revertedBy), harness.users.owner, "UNEXPECTED_REVERT_RESPONSE_REVERTED_BY");

  async function createSubmitted(title: string): Promise<string> {
    const created = await request("/api/csrm-assessment-requests", harness.identities.owner, jsonRequest("POST", { title }));
    assert.equal(created.status, 200, `UNEXPECTED_CREATE_${title}`);
    const documentId = (await created.json() as { data?: { documentId?: string } }).data?.documentId;
    assert.ok(documentId, `UNEXPECTED_CREATED_ID_${title}`);
    const submitted = await request(`/api/csrm-assessment-requests/${documentId}`, harness.identities.owner, jsonRequest("PUT", { requestStatus: "submitted" }));
    assert.equal(submitted.status, 200, `UNEXPECTED_SUBMIT_${title}`);
    return documentId;
  }

  const analystRequest = await createSubmitted("Analyst request revert");
  const analystResult = await request(requestPath(analystRequest), harness.identities.analyst, revertRequest({ reason: "Analyst needs clarification" }));
  assert.equal(analystResult.status, 200, "UNEXPECTED_ANALYST_REQUEST_REVERT_STATUS");
  const analystPersisted = await harness.getRequest(analystRequest);
  assert.ok(analystPersisted, "UNEXPECTED_ANALYST_REVERTED_REQUEST_ABSENT");
  assert.equal(relationDocumentId(analystPersisted.revertedBy), harness.users.analyst, "UNEXPECTED_ANALYST_REVERTED_BY");

  const rejectedRequest = await createSubmitted("Rejected request revert");
  for (const identity of [harness.identities.otherRequestor, harness.identities.serviceAnalystAgent]) {
    const before = await harness.getRequest(rejectedRequest);
    const response = await request(requestPath(rejectedRequest), identity, revertRequest({ reason: "Not permitted" }));
    assert.equal(response.status, 403, `UNEXPECTED_UNAUTHORISED_REVERT_${identity}`);
    assert.deepEqual(await harness.getRequest(rejectedRequest), before, `UNEXPECTED_UNAUTHORISED_REVERT_WRITE_${identity}`);
  }

  const malformedBefore = await harness.getRequest(rejectedRequest);
  for (const body of [{}, { reason: "   " }, { reason: "x".repeat(501) }, { reason: "valid", extra: true }]) {
    const response = await request(requestPath(rejectedRequest), harness.identities.owner, revertRequest(body));
    assert.equal(response.status, 400, "UNEXPECTED_MALFORMED_REVERT_STATUS");
    assert.deepEqual(await harness.getRequest(rejectedRequest), malformedBefore, "UNEXPECTED_MALFORMED_REVERT_WRITE");
  }

  const maxReason = "x".repeat(500);
  const maxLengthResult = await request(requestPath(rejectedRequest), harness.identities.owner, revertRequest({ reason: maxReason }));
  assert.equal(maxLengthResult.status, 200, "UNEXPECTED_500_CHARACTER_REVERT_STATUS");

  const relationRequest = await createSubmitted("Relation guarded revert");
  // A questionnaire is linked from its own side, as generation writes it. No request write can link
  // one: the link is a server-owned fact of the request (T-08-A2).
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: relationRequest, released: false, answerState: "none" });
  const relationBefore = await harness.getRequest(relationRequest);
  assert.ok(relationBefore?.questionnaire, "UNEXPECTED_QUESTIONNAIRE_FIXTURE_UNLINKED");
  const relationResult = await request(requestPath(relationRequest), harness.identities.analyst, revertRequest({ reason: "Questionnaire exists" }));
  assert.equal(relationResult.status, 409, "UNEXPECTED_QUESTIONNAIRE_GUARD_STATUS");
  assert.deepEqual(await harness.getRequest(relationRequest), relationBefore, "UNEXPECTED_QUESTIONNAIRE_GUARD_WRITE");
});

test("authorised request reads carry one lifecycle truth with actor-specific next actions", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedQuestionnaireGovernanceFixtures();
  const path = `/api/csrm-assessment-requests/${encodeURIComponent(fixtures.requests.released)}`;
  const ownerResponse = await request(path, harness.identities.owner);
  const analystResponse = await request(path, harness.identities.analyst);
  assert.equal(ownerResponse.status, 200, "UNEXPECTED_OWNER_LIFECYCLE_READ_STATUS");
  assert.equal(analystResponse.status, 200, "UNEXPECTED_ANALYST_LIFECYCLE_READ_STATUS");
  const ownerLifecycle = ((await ownerResponse.json()) as { data?: { lifecycle?: Record<string, unknown> } }).data?.lifecycle;
  const analystLifecycle = ((await analystResponse.json()) as { data?: { lifecycle?: Record<string, unknown> } }).data?.lifecycle;
  assert.equal(ownerLifecycle?.currentKey, "questionnaire-released", "UNEXPECTED_OWNER_LIFECYCLE_CURRENT");
  assert.equal(analystLifecycle?.currentKey, "questionnaire-released", "UNEXPECTED_ANALYST_LIFECYCLE_CURRENT");
  const ownerSteps = ownerLifecycle?.steps as Array<{ key: string; state: string }>;
  assert.deepEqual(ownerSteps.map(({ state }) => state), ["completed", "completed", "completed", "current", "future", "future", "future", "future"], "UNEXPECTED_OWNER_LIFECYCLE_STEPS");
  const ownerAction = ownerLifecycle?.nextAction as { actor?: string; href?: string };
  const analystAction = analystLifecycle?.nextAction as { actor?: string; href?: string };
  assert.equal(ownerAction.actor, "requestor", "UNEXPECTED_OWNER_LIFECYCLE_ACTOR");
  assert.equal(ownerAction.href, `/app/questionnaires/${fixtures.questionnaires.released}`, "UNEXPECTED_OWNER_LIFECYCLE_HREF");
  assert.equal(analystAction.actor, "analyst", "UNEXPECTED_ANALYST_LIFECYCLE_ACTOR");
  assert.equal(analystAction.href, undefined, "UNEXPECTED_ANALYST_LIFECYCLE_HREF");
});

test("available assessment relationships include only their populated contextual control count", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const response = await request(`/api/csrm-assessment-requests/${encodeURIComponent(fixtures.requests.complete)}`, harness.identities.owner);
  assert.equal(response.status, 200, "UNEXPECTED_CONTROL_COUNT_READ_STATUS");
  const relationship = ((await response.json()) as { data?: { relationships?: { assessment?: Record<string, unknown> } } }).data?.relationships?.assessment;
  assert.equal(relationship?.availability, "available", "UNEXPECTED_CONTROL_COUNT_AVAILABILITY");
  assert.equal(relationship?.controlImplementationCount, 1, "UNEXPECTED_CONTROL_IMPLEMENTATION_COUNT");
  assert.equal(typeof relationship?.documentId, "string", "UNEXPECTED_AVAILABLE_ASSESSMENT_IDENTIFIER");
});
