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

  // The request is a draft again, so a second return names the rule that refuses it and writes nothing.
  const draftBefore = await harness.getRequest(rejectedRequest);
  assert.equal(draftBefore?.requestStatus, "draft", "UNEXPECTED_DRAFT_FIXTURE_STATUS");
  const draftResult = await request(requestPath(rejectedRequest), harness.identities.owner, revertRequest({ reason: "Already a draft" }));
  assert.equal(draftResult.status, 409, "UNEXPECTED_DRAFT_REVERT_STATUS");
  assert.deepEqual(await conflictDetails(draftResult), { reason: "REQUEST_NOT_SUBMITTED" }, "UNEXPECTED_DRAFT_REVERT_REASON");
  assert.deepEqual(await harness.getRequest(rejectedRequest), draftBefore, "UNEXPECTED_DRAFT_REVERT_WRITE");

  const relationRequest = await createSubmitted("Relation guarded revert");
  // A questionnaire is linked from its own side, as generation writes it. No request write can link
  // one: the link is a server-owned fact of the request (T-08-A2).
  await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: relationRequest, released: false, answerState: "none" });
  const relationBefore = await harness.getRequest(relationRequest);
  assert.ok(relationBefore?.questionnaire, "UNEXPECTED_QUESTIONNAIRE_FIXTURE_UNLINKED");
  for (const identity of [harness.identities.analyst, harness.identities.owner]) {
    const relationResult = await request(requestPath(relationRequest), identity, revertRequest({ reason: "Questionnaire exists" }));
    assert.equal(relationResult.status, 409, `UNEXPECTED_QUESTIONNAIRE_GUARD_STATUS_${identity}`);
    // Actor-neutral: the code says work has started, never which work, so the owner learns nothing
    // the request's relationship state does not already serve them.
    assert.deepEqual(await conflictDetails(relationResult), { reason: "REQUEST_WORK_STARTED" }, `UNEXPECTED_QUESTIONNAIRE_GUARD_REASON_${identity}`);
    assert.deepEqual(await harness.getRequest(relationRequest), relationBefore, `UNEXPECTED_QUESTIONNAIRE_GUARD_WRITE_${identity}`);
  }
});

/*
 * 13-RESEARCH §E: the revert and the assignment share one per-request lock module, so in-process
 * writers to one request serialise against each other instead of waiting on the single SQLite
 * connection until the pool times out. Whichever runs first, both answer, and the second sees
 * the first's committed state.
 *
 * Code review WR-201: this proves the serialised outcome and the absence of a deadlock only. On SQLite, knex's single
 * connection serialises every transaction, so it cannot show that both paths share the lock; the lock's in-process tail
 * is proven in request-lock.unit.test.ts, and its row lock is R-08-37's proof, on PostgreSQL.
 */
test("a revert and a pick-up sent together on one request are serialised and both answer, with no deadlock", async () => {
  const harness = await harnessPromise;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "WORKFLOW-SHARED-LOCK-001",
    title: "Shared lock request",
    requestStatus: "submitted",
    requestor: "owner",
    submittedDate: "2026-10-01T00:00:00.000Z",
  });
  const started = Date.now();
  const [revert, pickUp] = await harness.simultaneousRequests([
    { path: `/api/v1/assessment_requests/${requestId}/revert_to_draft`, identity: harness.identities.owner, init: revertRequest({ reason: "Shared lock revert" }) },
    {
      path: `/api/v1/assessment_requests/${requestId}/assignee`,
      identity: harness.identities.analyst,
      init: jsonRequest("PUT", { analyst: harness.users.analyst, expectedAnalyst: null }),
    },
  ]);
  assert.ok(Date.now() - started < 30_000, "UNEXPECTED_SHARED_LOCK_WAIT");
  assert.equal(revert.status, 200, "UNEXPECTED_SHARED_LOCK_REVERT_STATUS");
  const persisted = await harness.getRequest(requestId);
  const assignment = await harness.getRequestAssignment(requestId);
  assert.equal(persisted?.requestStatus, "draft", "UNEXPECTED_SHARED_LOCK_STATUS");
  if (pickUp.status === 200) {
    // The pick-up ran first: the return to draft keeps the assignee (D-08).
    assert.equal(assignment?.assignedAnalyst, harness.users.analyst, "UNEXPECTED_SHARED_LOCK_ASSIGNEE_LOST");
  } else {
    // The revert ran first: the pick-up found a draft and wrote nothing.
    assert.equal(pickUp.status, 409, "UNEXPECTED_SHARED_LOCK_PICK_UP_STATUS");
    assert.deepEqual(await conflictDetails(pickUp), { reason: "REQUEST_NOT_SUBMITTED" }, "UNEXPECTED_SHARED_LOCK_PICK_UP_REASON");
    assert.equal(assignment?.assignedAnalyst, null, "UNEXPECTED_SHARED_LOCK_ASSIGNEE_WRITTEN");
  }
});

async function conflictDetails(response: Response): Promise<unknown> {
  const body = await response.json() as { error?: { details?: unknown } };
  return body.error?.details;
}

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
  const ownerAction = ownerLifecycle?.nextAction as { actor?: string; holder?: string; summary?: string; href?: string };
  const analystAction = analystLifecycle?.nextAction as { actor?: string; holder?: string; summary?: string; href?: string };
  assert.equal(ownerAction.actor, "requestor", "UNEXPECTED_OWNER_LIFECYCLE_ACTOR");
  assert.equal(ownerAction.holder, "requestor", "UNEXPECTED_OWNER_LIFECYCLE_HOLDER");
  assert.equal(ownerAction.href, `/app/questionnaires/${fixtures.questionnaires.released}`, "UNEXPECTED_OWNER_LIFECYCLE_HREF");
  assert.equal(analystAction.actor, "analyst", "UNEXPECTED_ANALYST_LIFECYCLE_ACTOR");
  assert.equal(analystAction.holder, "requestor", "UNEXPECTED_ANALYST_LIFECYCLE_HOLDER");
  // D-27: the analyst reads what the Requestor is doing, never "the other party", and gets no link.
  assert.equal(analystAction.summary, "The Requestor is answering the questionnaire.", "UNEXPECTED_ANALYST_LIFECYCLE_SUMMARY");
  assert.equal(analystAction.href, undefined, "UNEXPECTED_ANALYST_LIFECYCLE_HREF");
});

test("a submitted request names the Security Analyst as the holder of its next step for both readers, and the Requestor reads who picked it up (D-27, D-17)", async () => {
  const harness = await harnessPromise;
  const created = await request("/api/csrm-assessment-requests", harness.identities.owner, jsonRequest("POST", { title: "Holder named on submit" }));
  assert.equal(created.status, 200, "UNEXPECTED_HOLDER_CREATE_STATUS");
  const documentId = (await created.json() as { data?: { documentId?: string } }).data?.documentId;
  assert.ok(documentId, "UNEXPECTED_HOLDER_CREATED_ID");
  const submitted = await request(`/api/csrm-assessment-requests/${documentId}`, harness.identities.owner, jsonRequest("PUT", { requestStatus: "submitted" }));
  assert.equal(submitted.status, 200, "UNEXPECTED_HOLDER_SUBMIT_STATUS");

  const path = `/api/csrm-assessment-requests/${encodeURIComponent(documentId)}`;
  const nextActionFor = async (identity: string) => {
    const response = await request(path, identity);
    assert.equal(response.status, 200, `UNEXPECTED_HOLDER_READ_STATUS_${identity}`);
    const lifecycle = ((await response.json()) as { data?: { lifecycle?: { currentKey?: string; nextAction?: unknown } } }).data?.lifecycle;
    assert.equal(lifecycle?.currentKey, "submitted", `UNEXPECTED_HOLDER_CURRENT_${identity}`);
    return lifecycle?.nextAction;
  };
  // 13-UI-SPEC §12.1: nobody has picked the request up yet, and the Requestor is told so plainly.
  assert.deepEqual(await nextActionFor(harness.identities.owner), {
    actor: "requestor", holder: "analyst",
    summary: "Your request is waiting for a Security Analyst to pick it up. They’ll then send you a questionnaire to answer.",
  }, "UNEXPECTED_REQUESTOR_SUBMITTED_NEXT_ACTION");
  const analystNextAction = {
    actor: "analyst", holder: "analyst", summary: "Generate the questionnaire.", href: `/app/review/requests/${encodeURIComponent(documentId)}`,
  };
  assert.deepEqual(await nextActionFor(harness.identities.analyst), analystNextAction, "UNEXPECTED_ANALYST_SUBMITTED_NEXT_ACTION");

  // D-17: once Bob picks it up, Jane reads his display name; the analysts' sentence and the holder are unchanged.
  const pickedUp = await request(`/api/v1/assessment_requests/${encodeURIComponent(documentId)}/assignee`, harness.identities.analyst, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: { analyst: harness.users.analyst, expectedAnalyst: null } }),
  });
  assert.equal(pickedUp.status, 200, "UNEXPECTED_PICK_UP_STATUS");
  assert.deepEqual(await nextActionFor(harness.identities.owner), {
    actor: "requestor", holder: "analyst",
    summary: "Bob Doe is reviewing your request and will send you a questionnaire to answer.",
  }, "REQUESTOR_NEXT_ACTION_DOES_NOT_NAME_THE_ASSIGNEE");
  assert.deepEqual(await nextActionFor(harness.identities.analyst), analystNextAction, "ANALYST_NEXT_ACTION_CHANGED_BY_THE_ASSIGNEE");
  assert.deepEqual(await nextActionFor(harness.identities.secondAnalyst), analystNextAction, "SECOND_ANALYST_NEXT_ACTION_CHANGED_BY_THE_ASSIGNEE");
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

/*
 * Phase 13 D-04 (13-RESEARCH §D, T-13-10): no person crosses the request read as more than a documentId and a
 * display name. The caller's populate is limited to informationSystems, informationAssets, questionnaire and
 * assessment, so populate=revertedBy and populate=* reach no IdamBox User record, and revertedBy is projected by
 * the server on the read and on the revert response alike.
 */
test("the request read projects people: revertedBy is a documentId and a display name, and populate=* returns no email (D-04)", async () => {
  const harness = await harnessPromise;
  const created = await request("/api/csrm-assessment-requests", harness.identities.owner, jsonRequest("POST", { title: "People projection request" }));
  assert.equal(created.status, 200, "UNEXPECTED_PROJECTION_CREATE_STATUS");
  const requestId = (await created.json() as { data?: { documentId?: string } }).data?.documentId;
  assert.ok(requestId, "UNEXPECTED_PROJECTION_CREATED_ID");
  const submitted = await request(`/api/csrm-assessment-requests/${requestId}`, harness.identities.owner, jsonRequest("PUT", { requestStatus: "submitted" }));
  assert.equal(submitted.status, 200, "UNEXPECTED_PROJECTION_SUBMIT_STATUS");

  const reverted = await request(`/api/v1/assessment_requests/${requestId}/revert_to_draft`, harness.identities.analyst, revertRequest({ reason: "Clarify the people involved." }));
  assert.equal(reverted.status, 200, "UNEXPECTED_PROJECTION_REVERT_STATUS");
  const revertBody = await reverted.json() as { data?: { revertedBy?: Record<string, unknown> } };
  assert.deepEqual(Object.keys(revertBody.data?.revertedBy ?? {}).sort(), ["displayName", "documentId"], "UNEXPECTED_REVERT_RESPONSE_PERSON_KEYS");
  assert.deepEqual(revertBody.data?.revertedBy, { documentId: harness.users.analyst, displayName: "Bob Doe" }, "UNEXPECTED_REVERT_RESPONSE_PERSON");

  for (const identity of [harness.identities.analyst, harness.identities.owner]) {
    const read = await request(`/api/csrm-assessment-requests/${requestId}?populate=revertedBy`, identity);
    assert.equal(read.status, 200, `UNEXPECTED_PROJECTION_READ_STATUS_${identity}`);
    const body = await read.json() as { data?: { revertedBy?: Record<string, unknown> } };
    assert.deepEqual(Object.keys(body.data?.revertedBy ?? {}).sort(), ["displayName", "documentId"], `UNEXPECTED_READ_PERSON_KEYS_${identity}`);
    assert.deepEqual(body.data?.revertedBy, { documentId: harness.users.analyst, displayName: "Bob Doe" }, `UNEXPECTED_READ_PERSON_${identity}`);

    for (const query of [
      "populate=*",
      "populate=requestor",
      "populate=sponsor",
      "populate[revertedBy]=true",
      "populate[requestor][populate]=*",
      "populate[0]=revertedBy&populate[1]=requestor",
      "populate[informationSystems]=true&populate[assessment][populate][owner]=true",
    ]) {
      const wide = await request(`/api/csrm-assessment-requests/${requestId}?${query}`, identity);
      assert.equal(wide.status, 200, `UNEXPECTED_WIDE_READ_STATUS_${identity}_${query}`);
      const text = await wide.text();
      for (const key of ["email", "username", "externalSubject", "accountStatus", "firstName", "lastName"]) {
        assert.equal(text.includes(`"${key}"`), false, `UNEXPECTED_${key}_IN_READ_${identity}_${query}`);
      }
    }
  }

  // An allowed populate still populates.
  const allowed = await request(`/api/csrm-assessment-requests/${requestId}?populate[0]=informationSystems&populate[1]=informationAssets`, harness.identities.analyst);
  assert.equal(allowed.status, 200, "UNEXPECTED_ALLOWED_POPULATE_STATUS");
  const allowedBody = await allowed.json() as { data?: Record<string, unknown> };
  assert.ok(Array.isArray(allowedBody.data?.informationSystems), "UNEXPECTED_ALLOWED_POPULATE_SYSTEMS");
  assert.ok(Array.isArray(allowedBody.data?.informationAssets), "UNEXPECTED_ALLOWED_POPULATE_ASSETS");
});

/*
 * Phase 13 T-13-F1 (13-SECURITY.md; 13-04 threat flag): the read by id names one request, so the caller's filters
 * decide nothing. A relation filter on a person (the requestor's email, whether a sponsor is set) must not turn the
 * answer into yes or no about that person: a true and a false predicate both read the same request, as no filter does.
 */
test("the request read ignores the caller's filters, so a relation filter is no oracle about a person (T-13-F1)", async () => {
  const harness = await harnessPromise;
  const requestId = encodeURIComponent(harness.requests.owner);
  const plain = await request(`/api/csrm-assessment-requests/${requestId}`, harness.identities.owner);
  assert.equal(plain.status, 200, "UNEXPECTED_FILTER_ORACLE_BASELINE_STATUS");

  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    for (const query of [
      "filters[requestor][email][$eq]=jane.doe@idambox.com",
      "filters[requestor][email][$eq]=nobody@example.test",
      "filters[requestor][email][$startsWith]=zzz",
      "filters[requestor][displayName][$eq]=Not Jane",
      "filters[sponsor][email][$null]=true",
      "filters[sponsor][email][$notNull]=true",
      "filters[requestStatus][$eq]=released",
      "filters[$or][0][requestor][email][$eq]=nobody@example.test",
    ]) {
      const read = await request(`/api/csrm-assessment-requests/${requestId}?${query}`, identity);
      assert.equal(read.status, 200, `UNEXPECTED_FILTER_ORACLE_STATUS_${identity}_${query}`);
      const body = await read.json() as { data?: { documentId?: string } };
      assert.equal(body.data?.documentId, harness.requests.owner, `UNEXPECTED_FILTER_ORACLE_DOCUMENT_${identity}_${query}`);
    }
  }
});

/*
 * Phase 16 D-16 and the Orchestrator Confirmation "Request deletion": a request that has a Risk Assessment, in any
 * state, is never deleted, so no assessment, Risk or history row loses its request. The refusal comes before the notes
 * and files checks (13-06, 14-08), so a request with an assessment, a note and a file reports REQUEST_HAS_ASSESSMENT.
 * A request with no assessment keeps today's rule, and a Requestor is refused as today.
 */
async function draftedRequest(label: string): Promise<{ requestId: string; assessmentId: string; riskIds: string[] }> {
  const harness = await harnessPromise;
  const { requestId, questionnaireId } = await harness.seedUatALikeRequest(label);
  const { assessmentId } = await harness.runAssessmentDraftJobFixture(questionnaireId, harness.users.analyst);
  const riskIds = (((await harness.getAssessment(assessmentId))?.risks as Array<Record<string, unknown>> | undefined) ?? []).map((risk) => String(risk.documentId));
  assert.ok(riskIds.length > 0, `DRAFT_HAS_NO_RISKS_${label}`);
  return { requestId, assessmentId, riskIds };
}

async function requestAggregate(requestId: string, assessmentId: string, riskIds: string[]): Promise<unknown[]> {
  const harness = await harnessPromise;
  return harness.snapshot([
    () => harness.getRequest(requestId), () => harness.getAssessment(assessmentId),
    ...riskIds.flatMap((riskId) => [() => harness.getRisk(riskId), () => harness.riskHistoryRowsFixture(riskId)]),
    () => harness.listRequestNotes(requestId), () => harness.listRequestAttachments(requestId),
  ]);
}

async function deleteRequest(requestId: string, identity: string): Promise<Response> {
  return request(`/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`, identity, { method: "DELETE" });
}

async function reasonOf(response: Response): Promise<unknown> {
  return ((await response.json()) as { error?: { details?: { reason?: unknown } } }).error?.details?.reason;
}

test("a request that has a risk assessment is never deleted: 409 REQUEST_HAS_ASSESSMENT and the request, assessment, risks and history stay (D-16)", async () => {
  const harness = await harnessPromise;
  const { requestId, assessmentId, riskIds } = await draftedRequest("DELETE-WITH-ASSESSMENT");
  assert.ok((await harness.riskHistoryRowsFixture(riskIds[0])).length > 0, "DRAFTED_RISK_HAS_NO_HISTORY");
  const before = await requestAggregate(requestId, assessmentId, riskIds);

  const refused = await deleteRequest(requestId, harness.identities.analyst);
  assert.equal(refused.status, 409, `UNEXPECTED_DELETE_STATUS: ${await refused.clone().text()}`);
  assert.equal(await reasonOf(refused), "REQUEST_HAS_ASSESSMENT", "UNEXPECTED_DELETE_REASON");
  assert.deepEqual(await requestAggregate(requestId, assessmentId, riskIds), before, "A_REFUSED_DELETE_CHANGED_THE_AGGREGATE");

  const requestor = await deleteRequest(requestId, harness.identities.owner);
  assert.equal(requestor.status, 403, "UNEXPECTED_REQUESTOR_DELETE_STATUS");
  assert.deepEqual(await requestAggregate(requestId, assessmentId, riskIds), before, "A_REQUESTOR_DELETE_CHANGED_THE_AGGREGATE");

  const empty = await harness.createAssessmentRequestFixture({ requestNumber: "DELETE-EMPTY-001", title: "A draft with nothing yet", requestStatus: "draft", requestor: "owner", submittedDate: null });
  const deleted = await deleteRequest(empty, harness.identities.analyst);
  assert.ok(deleted.status >= 200 && deleted.status < 300, `UNEXPECTED_EMPTY_DELETE_STATUS_${deleted.status}`);
  assert.equal(await harness.getRequest(empty), null, "UNEXPECTED_EMPTY_REQUEST_KEPT");
});

test("a request with an assessment, a note and a file reports REQUEST_HAS_ASSESSMENT first (D-16)", async () => {
  const harness = await harnessPromise;
  const { requestId, assessmentId, riskIds } = await draftedRequest("DELETE-WITH-EVERYTHING");
  await harness.createRequestNoteFixtures(requestId, 1);
  await harness.seedRequestAttachments(requestId, 1);
  const before = await requestAggregate(requestId, assessmentId, riskIds);
  const refused = await deleteRequest(requestId, harness.identities.analyst);
  assert.equal(refused.status, 409, `UNEXPECTED_DELETE_STATUS: ${await refused.clone().text()}`);
  assert.equal(await reasonOf(refused), "REQUEST_HAS_ASSESSMENT", "UNEXPECTED_DELETE_REASON");
  assert.deepEqual(await requestAggregate(requestId, assessmentId, riskIds), before, "A_REFUSED_DELETE_CHANGED_THE_AGGREGATE");
});
