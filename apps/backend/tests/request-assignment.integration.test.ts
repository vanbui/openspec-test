import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 13 (D-01, D-05 to D-10, G-1): the one request assignment operation, mounted. Every case
 * seeds its own request, so the cases are independent of each other and of the order they run in.
 */

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

let sequence = 0;

type AssignmentBody = { analyst: string | null; expectedAnalyst: string | null; reason?: string };

function assigneePath(requestId: string): string {
  return `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/assignee`;
}

function assigneeChange(data: AssignmentBody | Record<string, unknown>): RequestInit {
  return { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) };
}

async function changeAssignee(requestId: string, identity: string, data: AssignmentBody | Record<string, unknown>): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: assigneePath(requestId), identity, init: assigneeChange(data) });
}

/** A submitted request raised by Jane (or the other Requestor), seeded directly. */
async function seedRequest(requestStatus = "submitted", requestor: "owner" | "otherRequestor" = "owner"): Promise<string> {
  const harness = await harnessPromise;
  sequence += 1;
  return harness.createAssessmentRequestFixture({
    requestNumber: `ASSIGN-${String(sequence).padStart(3, "0")}`,
    title: `Assignment request ${sequence}`,
    requestStatus,
    requestor,
    submittedDate: requestStatus === "draft" ? null : "2026-10-01T00:00:00.000Z",
  });
}

const ASSIGNMENT_KEYS = ["assignedAnalyst", "assignedAt", "assignedBy", "assignmentLog"] as const;

test("a fresh database reads every seeded request as unassigned and holds the approved columns and link tables (D-01)", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedRequestWorkflowFixtures();
  assert.deepEqual(await harness.getRequestAssignment(fixtures.requests.submitted), {
    assignedAnalyst: null, assignedBy: null, assignedAt: null, assignmentLog: null,
  }, "UNEXPECTED_LEGACY_ASSIGNMENT");

  const requestColumns = await harness.listTableColumns("csrm_assessment_requests");
  assert.ok(requestColumns.includes("assigned_at"), "UNEXPECTED_ASSIGNED_AT_COLUMN_MISSING");
  assert.ok(requestColumns.includes("assignment_log"), "UNEXPECTED_ASSIGNMENT_LOG_COLUMN_MISSING");
  for (const table of ["csrm_assessment_requests_assigned_analyst_lnk", "csrm_assessment_requests_assigned_by_lnk"]) {
    const columns = await harness.listTableColumns(table);
    assert.ok(columns.includes("csrm_assessment_request_id"), `UNEXPECTED_OWNER_COLUMN_MISSING_${table}`);
    assert.ok(columns.includes("idambox_user_id"), `UNEXPECTED_TARGET_COLUMN_MISSING_${table}`);
  }
});

test("a Security Analyst picks up a submitted request and the facts and one log event are recorded (D-05, D-09)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const response = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null });
  assert.equal(response.status, 200, "UNEXPECTED_PICK_UP_STATUS");
  const body = await response.json() as { data?: Record<string, unknown> };
  const assignment = body.data ?? {};
  assert.deepEqual(Object.keys(assignment).sort(), ["actions", "assignedAt", "assignedBy", "assignee", "history", "ownRequest", "viewer"], "UNEXPECTED_ASSIGNMENT_KEYS");
  assert.deepEqual(assignment.viewer, { documentId: harness.users.analyst, displayName: "Bob Doe" }, "UNEXPECTED_VIEWER");
  assert.deepEqual(assignment.assignee, { documentId: harness.users.analyst, displayName: "Bob Doe" }, "UNEXPECTED_ASSIGNEE");
  assert.deepEqual(assignment.assignedBy, { documentId: harness.users.analyst, displayName: "Bob Doe" }, "UNEXPECTED_ASSIGNED_BY");
  assert.ok(Number.isFinite(Date.parse(String(assignment.assignedAt))), "UNEXPECTED_ASSIGNED_AT");
  assert.deepEqual(assignment.actions, ["reassign", "unassign"], "UNEXPECTED_ACTIONS");
  assert.equal(assignment.ownRequest, false, "UNEXPECTED_OWN_REQUEST");
  assert.deepEqual(assignment.history, [{
    action: "pick-up",
    by: { documentId: harness.users.analyst, displayName: "Bob Doe" },
    at: assignment.assignedAt,
    from: null,
    to: { documentId: harness.users.analyst, displayName: "Bob Doe" },
    reason: null,
  }], "UNEXPECTED_HISTORY");

  const stored = await harness.getRequestAssignment(requestId);
  assert.ok(stored, "UNEXPECTED_ASSIGNED_REQUEST_ABSENT");
  assert.equal(stored.assignedAnalyst, harness.users.analyst, "UNEXPECTED_STORED_ASSIGNEE");
  assert.equal(stored.assignedBy, harness.users.analyst, "UNEXPECTED_STORED_ASSIGNED_BY");
  assert.equal(new Date(stored.assignedAt as string).toISOString(), assignment.assignedAt, "UNEXPECTED_STORED_ASSIGNED_AT");
  assert.deepEqual(stored.assignmentLog, {
    schemaVersion: 1,
    events: [{ schemaVersion: 1, action: "pick-up", by: harness.users.analyst, at: assignment.assignedAt, from: null, to: harness.users.analyst, reason: null }],
  }, "UNEXPECTED_STORED_LOG");
});

test("the Requestor's request reads carry none of the private assignment facts after a pick-up (D-04)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const pickUp = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null });
  assert.equal(pickUp.status, 200, "UNEXPECTED_PICK_UP_STATUS");

  for (const path of [
    `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`,
    `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}?populate=*`,
  ]) {
    const response = await harness.request({ path, identity: harness.identities.owner });
    assert.equal(response.status, 200, `UNEXPECTED_OWNER_READ_STATUS_${path}`);
    const data = ((await response.json()) as { data?: Record<string, unknown> }).data ?? {};
    for (const key of ASSIGNMENT_KEYS) assert.equal(key in data, false, `UNEXPECTED_OWNER_READ_KEY_${key}_${path}`);
  }

  const list = await harness.request({ path: "/api/csrm-assessment-requests?pagination[page]=1&pagination[pageSize]=100", identity: harness.identities.owner });
  assert.equal(list.status, 200, "UNEXPECTED_OWNER_LIST_STATUS");
  const rows = ((await list.json()) as { data?: Array<Record<string, unknown>> }).data ?? [];
  const row = rows.find((candidate) => candidate.documentId === requestId);
  assert.ok(row, "UNEXPECTED_OWNER_LIST_ROW_MISSING");
  for (const key of ASSIGNMENT_KEYS) assert.equal(key in row, false, `UNEXPECTED_OWNER_LIST_KEY_${key}`);
});

async function persisted(requestId: string): Promise<unknown[]> {
  const harness = await harnessPromise;
  return harness.snapshot([() => harness.getRequest(requestId), () => harness.getRequestAssignment(requestId)]);
}

async function refusalDetails(response: Response): Promise<unknown> {
  const body = await response.json() as { error?: { details?: unknown } };
  return body.error?.details;
}

/** Asserts the refusal, its closed reason (when one is expected) and that nothing was written. */
async function assertRefused(
  requestId: string,
  identity: string,
  data: AssignmentBody | Record<string, unknown>,
  status: number,
  reason: string | undefined,
  label: string,
): Promise<void> {
  const before = await persisted(requestId);
  const response = await changeAssignee(requestId, identity, data);
  assert.equal(response.status, status, `UNEXPECTED_STATUS_${label}`);
  const details = await refusalDetails(response);
  if (reason !== undefined) assert.deepEqual(details, { reason }, `UNEXPECTED_REASON_${label}`);
  else assert.equal((details as { reason?: unknown } | undefined)?.reason, undefined, `UNEXPECTED_DETAILS_${label}`);
  assert.deepEqual(await persisted(requestId), before, `UNEXPECTED_WRITE_${label}`);
}

function eventCount(log: unknown): number {
  return typeof log === "object" && log !== null && Array.isArray((log as { events?: unknown }).events)
    ? (log as { events: unknown[] }).events.length
    : 0;
}

test("an analyst who raised a request is refused every assignment action on it with OWN_REQUEST (G-1)", async () => {
  const harness = await harnessPromise;
  const created = await harness.request({
    path: "/api/csrm-assessment-requests",
    identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { title: "An analyst's own request" } }) },
  });
  assert.equal(created.status, 200, "UNEXPECTED_OWN_CREATE_STATUS");
  const requestId = (await created.json() as { data?: { documentId?: string } }).data?.documentId;
  assert.ok(requestId, "UNEXPECTED_OWN_CREATED_ID");
  const submitted = await harness.request({
    path: `/api/csrm-assessment-requests/${requestId}`,
    identity: harness.identities.analyst,
    init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { requestStatus: "submitted" } }) },
  });
  assert.equal(submitted.status, 200, "UNEXPECTED_OWN_SUBMIT_STATUS");

  const bob = harness.users.analyst;
  const second = harness.users.secondAnalyst;
  await assertRefused(requestId, harness.identities.analyst, { analyst: bob, expectedAnalyst: null }, 403, "OWN_REQUEST", "OWN_PICK_UP");
  await assertRefused(requestId, harness.identities.analyst, { analyst: second, expectedAnalyst: null }, 403, "OWN_REQUEST", "OWN_ASSIGN");

  // Another analyst may pick up Bob's request: Bob raised it, so he is not its assessor.
  const pickUp = await changeAssignee(requestId, harness.identities.secondAnalyst, { analyst: second, expectedAnalyst: null });
  assert.equal(pickUp.status, 200, "UNEXPECTED_SECOND_ANALYST_PICK_UP_STATUS");
  await assertRefused(requestId, harness.identities.analyst, { analyst: bob, expectedAnalyst: second }, 403, "OWN_REQUEST", "OWN_REASSIGN");
  await assertRefused(requestId, harness.identities.analyst, { analyst: null, expectedAnalyst: second }, 403, "OWN_REQUEST", "OWN_UNASSIGN");
  // G-1 is decided before the compare-and-set: a stale view still learns only OWN_REQUEST.
  await assertRefused(requestId, harness.identities.analyst, { analyst: bob, expectedAnalyst: null }, 403, "OWN_REQUEST", "OWN_STALE");
});

test("naming the service agent, an inactive analyst, the requestor or another Requestor is refused with ASSIGNEE_NOT_ELIGIBLE", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  for (const [label, target] of [
    ["SERVICE_AGENT", harness.users.serviceAnalystAgent],
    ["INACTIVE_ANALYST", harness.users.inactiveAnalyst],
    ["REQUESTOR", harness.users.owner],
    ["OTHER_REQUESTOR", harness.users.otherRequestor],
    ["UNKNOWN_USER", "no-such-user"],
  ] as const) {
    await assertRefused(requestId, harness.identities.analyst, { analyst: target, expectedAnalyst: null }, 409, "ASSIGNEE_NOT_ELIGIBLE", `NOT_ELIGIBLE_${label}`);
  }
});

test("a draft is refused with REQUEST_NOT_SUBMITTED and a request reverted to draft keeps its assignee (D-08)", async () => {
  const harness = await harnessPromise;
  const draft = await seedRequest("draft");
  await assertRefused(draft, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null }, 409, "REQUEST_NOT_SUBMITTED", "DRAFT_PICK_UP");

  const requestId = await seedRequest();
  const pickUp = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null });
  assert.equal(pickUp.status, 200, "UNEXPECTED_PICK_UP_STATUS");
  const revert = await harness.request({
    path: `/api/v1/assessment_requests/${requestId}/revert_to_draft`,
    identity: harness.identities.owner,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Clarify the scope." }) },
  });
  assert.equal(revert.status, 200, "UNEXPECTED_REVERT_STATUS");
  const kept = await harness.getRequestAssignment(requestId);
  assert.equal(kept?.assignedAnalyst, harness.users.analyst, "UNEXPECTED_ASSIGNEE_LOST_ON_REVERT");
  assert.equal(eventCount(kept?.assignmentLog), 1, "UNEXPECTED_LOG_CHANGED_ON_REVERT");
  // Nobody changes the assignment of a draft.
  await assertRefused(requestId, harness.identities.analyst, { analyst: null, expectedAnalyst: harness.users.analyst }, 409, "REQUEST_NOT_SUBMITTED", "DRAFT_UNASSIGN");
});

test("a stale expectedAnalyst is refused with ASSIGNMENT_CHANGED carrying only its reason (D-05)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const pickUp = await changeAssignee(requestId, harness.identities.secondAnalyst, { analyst: harness.users.secondAnalyst, expectedAnalyst: null });
  assert.equal(pickUp.status, 200, "UNEXPECTED_SECOND_PICK_UP_STATUS");
  await assertRefused(requestId, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null }, 409, "ASSIGNMENT_CHANGED", "STALE_PICK_UP");
  await assertRefused(requestId, harness.identities.analyst, { analyst: null, expectedAnalyst: harness.users.analyst }, 409, "ASSIGNMENT_CHANGED", "STALE_UNASSIGN");

  // With the assignee Bob saw, the same change goes through: assign-to-me is a reassignment.
  const reassign = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: harness.users.secondAnalyst, reason: "Covering while Second is away." });
  assert.equal(reassign.status, 200, "UNEXPECTED_REASSIGN_STATUS");
  const body = await reassign.json() as { data?: { history?: Array<Record<string, unknown>>; actions?: unknown } };
  assert.deepEqual(body.data?.actions, ["reassign", "unassign"], "UNEXPECTED_REASSIGN_ACTIONS");
  assert.equal(body.data?.history?.length, 2, "UNEXPECTED_REASSIGN_HISTORY_LENGTH");
  assert.equal(body.data?.history?.[0]?.action, "reassign", "UNEXPECTED_NEWEST_FIRST");
  assert.equal(body.data?.history?.[0]?.reason, "Covering while Second is away.", "UNEXPECTED_REASSIGN_REASON");
  assert.deepEqual(body.data?.history?.[0]?.from, { documentId: harness.users.secondAnalyst, displayName: "Second Analyst" }, "UNEXPECTED_REASSIGN_FROM");
});

test("a released request can be reassigned but not unassigned, and one released before Phase 13 can be picked up (ASSIGNMENT_REQUIRED, D-08)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest("approved");
  const pickUp = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null });
  assert.equal(pickUp.status, 200, "UNEXPECTED_RELEASED_PICK_UP_STATUS");
  const picked = await pickUp.json() as { data?: { actions?: unknown } };
  assert.deepEqual(picked.data?.actions, ["reassign"], "UNEXPECTED_RELEASED_ACTIONS");
  await assertRefused(requestId, harness.identities.analyst, { analyst: null, expectedAnalyst: harness.users.analyst }, 409, "ASSIGNMENT_REQUIRED", "RELEASED_UNASSIGN");
  const reassign = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.secondAnalyst, expectedAnalyst: harness.users.analyst });
  assert.equal(reassign.status, 200, "UNEXPECTED_RELEASED_REASSIGN_STATUS");
  const stored = await harness.getRequestAssignment(requestId);
  assert.equal(stored?.assignedAnalyst, harness.users.secondAnalyst, "UNEXPECTED_RELEASED_ASSIGNEE");
  assert.equal(stored?.assignedBy, harness.users.analyst, "UNEXPECTED_RELEASED_ASSIGNED_BY");
});

test("naming the current assignee is a no-op that writes no event, and unassigning returns the request to the queue", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const assign = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.secondAnalyst, expectedAnalyst: null });
  assert.equal(assign.status, 200, "UNEXPECTED_ASSIGN_STATUS");
  const assigned = await assign.json() as { data?: { history?: Array<Record<string, unknown>>; actions?: unknown } };
  assert.equal(assigned.data?.history?.[0]?.action, "assign", "UNEXPECTED_ASSIGN_ACTION");
  assert.deepEqual(assigned.data?.actions, ["assign-to-me", "reassign", "unassign"], "UNEXPECTED_HELD_BY_ANOTHER_ACTIONS");

  const before = await persisted(requestId);
  const same = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.secondAnalyst, expectedAnalyst: harness.users.secondAnalyst });
  assert.equal(same.status, 200, "UNEXPECTED_NO_OP_STATUS");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_NO_OP_WRITE");

  const unassign = await changeAssignee(requestId, harness.identities.analyst, { analyst: null, expectedAnalyst: harness.users.secondAnalyst });
  assert.equal(unassign.status, 200, "UNEXPECTED_UNASSIGN_STATUS");
  const unassigned = await unassign.json() as { data?: Record<string, unknown> };
  assert.equal(unassigned.data?.assignee, null, "UNEXPECTED_UNASSIGNED_ASSIGNEE");
  assert.equal(unassigned.data?.assignedAt, null, "UNEXPECTED_UNASSIGNED_AT");
  assert.deepEqual(unassigned.data?.actions, ["pick-up", "assign"], "UNEXPECTED_UNASSIGNED_ACTIONS");
  const stored = await harness.getRequestAssignment(requestId);
  assert.deepEqual([stored?.assignedAnalyst, stored?.assignedBy, stored?.assignedAt, eventCount(stored?.assignmentLog)], [null, null, null, 2], "UNEXPECTED_UNASSIGNED_FACTS");
});

test("a malformed body or a reason over 500 characters is refused with 400 before anything is written", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const bob = harness.users.analyst;
  for (const [label, data] of [
    ["REASON_501", { analyst: bob, expectedAnalyst: null, reason: "x".repeat(501) }],
    ["REASON_BLANK", { analyst: bob, expectedAnalyst: null, reason: "   " }],
    ["REASON_CONTROL", { analyst: bob, expectedAnalyst: null, reason: "tab\there" }],
    ["MISSING_EXPECTED", { analyst: bob }],
    ["EXTRA_KEY", { analyst: bob, expectedAnalyst: null, assignedBy: bob }],
    ["ID_TYPE", { analyst: 7, expectedAnalyst: null }],
  ] as const) {
    await assertRefused(requestId, harness.identities.analyst, data, 400, undefined, `MALFORMED_${label}`);
  }
  const reason500 = await changeAssignee(requestId, harness.identities.analyst, { analyst: bob, expectedAnalyst: null, reason: `Line one\n${"y".repeat(491)}` });
  assert.equal(reason500.status, 200, "UNEXPECTED_500_CHARACTER_REASON_STATUS");
});

/** A submitted request held through `length` valid alternating events between Bob and the second analyst. */
async function seedLoggedRequest(length: number): Promise<{ requestId: string; holder: string; target: string }> {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const bob = harness.users.analyst;
  const second = harness.users.secondAnalyst;
  const events: Array<Record<string, unknown>> = [
    { schemaVersion: 1, action: "pick-up", by: second, at: "2026-10-01T00:00:00.000Z", from: null, to: second, reason: null },
  ];
  while (events.length < length) {
    const from = events.length % 2 === 1 ? second : bob;
    const to = from === second ? bob : second;
    events.push({ schemaVersion: 1, action: "reassign", by: to, at: "2026-10-01T00:00:00.000Z", from, to, reason: null });
  }
  const holder = String(events[events.length - 1].to);
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, {
    assignedAnalyst: holder, assignedBy: holder, assignedAt: "2026-10-01T00:00:00.000Z", assignmentLog: { schemaVersion: 1, events },
  });
  return { requestId, holder, target: holder === bob ? second : bob };
}

/*
 * T-13-08, WR-205: the cap and an unreadable log refuse the same way (HISTORY_UNAVAILABLE), so each case first proves which
 * one it is: the fixture at the cap reads back as a 1,000-event history, one below it takes the change and appends exactly
 * one event, and a malformed log reads as "history unavailable" and refuses the change with nothing written.
 */
test("a log at its cap refuses the change with HISTORY_UNAVAILABLE and writes nothing, one below it takes the change, and a malformed log refuses it too (T-13-08, WR-205)", async () => {
  const harness = await harnessPromise;
  const atCap = await seedLoggedRequest(1_000);
  const capHistory = (await readAssignment(atCap.requestId, harness.identities.analyst)).data.assignment as Record<string, unknown>;
  assert.equal(Array.isArray(capHistory.history) ? capHistory.history.length : capHistory.history, 1_000, "UNEXPECTED_CAP_FIXTURE_UNREADABLE");
  await assertRefused(atCap.requestId, harness.identities.analyst, { analyst: atCap.target, expectedAnalyst: atCap.holder }, 409, "HISTORY_UNAVAILABLE", "LOG_AT_CAP");

  const belowCap = await seedLoggedRequest(999);
  const belowHistory = (await readAssignment(belowCap.requestId, harness.identities.analyst)).data.assignment as Record<string, unknown>;
  assert.equal(Array.isArray(belowHistory.history) ? belowHistory.history.length : belowHistory.history, 999, "UNEXPECTED_BELOW_CAP_FIXTURE_UNREADABLE");
  const taken = await changeAssignee(belowCap.requestId, harness.identities.analyst, { analyst: belowCap.target, expectedAnalyst: belowCap.holder });
  assert.equal(taken.status, 200, "UNEXPECTED_BELOW_CAP_STATUS");
  const stored = await harness.getRequestAssignment(belowCap.requestId);
  assert.equal(eventCount(stored?.assignmentLog), 1_000, "UNEXPECTED_BELOW_CAP_LOG_LENGTH");
  assert.equal(stored?.assignedAnalyst, belowCap.target, "UNEXPECTED_BELOW_CAP_ASSIGNEE");

  const malformed = await seedLoggedRequest(2);
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", malformed.requestId, {
    assignmentLog: { schemaVersion: 1, events: [{ schemaVersion: 1, action: "pick-up", by: malformed.holder, at: "not a time", from: null, to: malformed.holder, reason: null }] },
  });
  assert.equal(((await readAssignment(malformed.requestId, harness.identities.analyst)).data.assignment as Record<string, unknown>).history, null, "UNEXPECTED_MALFORMED_LOG_READABLE");
  await assertRefused(malformed.requestId, harness.identities.analyst, { analyst: malformed.target, expectedAnalyst: malformed.holder }, 409, "HISTORY_UNAVAILABLE", "LOG_MALFORMED");
});

/*
 * Code review WR-201: this proves the serialised outcome only. On SQLite, knex's single connection serialises every
 * transaction, so it cannot fail without the request lock; the lock's in-process tail is proven in
 * request-lock.unit.test.ts, and its row lock is R-08-37's proof, on PostgreSQL.
 */
test("two pick-ups sent at once are serialised: one succeeds and the other is told ASSIGNMENT_CHANGED, never an overwrite (D-05)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const [bob, second] = await harness.simultaneousRequests([
    { path: assigneePath(requestId), identity: harness.identities.analyst, init: assigneeChange({ analyst: harness.users.analyst, expectedAnalyst: null }) },
    { path: assigneePath(requestId), identity: harness.identities.secondAnalyst, init: assigneeChange({ analyst: harness.users.secondAnalyst, expectedAnalyst: null }) },
  ]);
  assert.deepEqual([bob.status, second.status].sort(), [200, 409], "UNEXPECTED_RACE_STATUSES");
  const [winner, loser] = bob.status === 200 ? [harness.users.analyst, second] : [harness.users.secondAnalyst, bob];
  assert.deepEqual(await refusalDetails(loser), { reason: "ASSIGNMENT_CHANGED" }, "UNEXPECTED_RACE_REASON");
  const stored = await harness.getRequestAssignment(requestId);
  assert.equal(stored?.assignedAnalyst, winner, "UNEXPECTED_RACE_ASSIGNEE");
  assert.equal(eventCount(stored?.assignmentLog), 1, "UNEXPECTED_RACE_LOG_LENGTH");
});

test("the Requestor, the other Requestor, the service agent and an inactive analyst are refused by grant before anything is written", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  for (const identity of [harness.identities.owner, harness.identities.otherRequestor, harness.identities.serviceAnalystAgent, harness.identities.inactiveAnalyst]) {
    const target = identity === harness.identities.serviceAnalystAgent ? harness.users.serviceAnalystAgent : harness.users.analyst;
    await assertRefused(requestId, identity, { analyst: target, expectedAnalyst: null }, 403, undefined, `GRANT_${identity}`);
  }
  // A request that does not exist is a 404, after the grant.
  const missing = await changeAssignee("no-such-request", harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null });
  assert.equal(missing.status, 404, "UNEXPECTED_MISSING_REQUEST_STATUS");
});

/* Phase 13 (D-06, D-07): the eligible-analyst read, the list a picker offers. */

function assignableAnalystsPath(requestId: string, query = ""): string {
  return `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/assignable_analysts${query}`;
}

async function listAssignable(requestId: string, identity: string, query = ""): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: assignableAnalystsPath(requestId, query), identity });
}

test("a Security Analyst lists exactly the analysts who may hold a request, by name only and searchable (D-06)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const bob = { documentId: harness.users.analyst, displayName: "Bob Doe" };
  const second = { documentId: harness.users.secondAnalyst, displayName: "Second Analyst" };

  const response = await listAssignable(requestId, harness.identities.analyst);
  assert.equal(response.status, 200, "UNEXPECTED_ASSIGNABLE_STATUS");
  const body = await response.json() as { data?: Array<Record<string, unknown>> } & Record<string, unknown>;
  assert.deepEqual(Object.keys(body), ["data"], "UNEXPECTED_ASSIGNABLE_BODY_KEYS");
  assert.deepEqual(body.data, [bob, second], "UNEXPECTED_ASSIGNABLE_ANALYSTS");
  const serialised = JSON.stringify(body);
  for (const absent of [harness.users.serviceAnalystAgent, harness.users.inactiveAnalyst, harness.users.owner, harness.users.otherRequestor, "@", "kc-subject"]) {
    assert.equal(serialised.includes(absent), false, `UNEXPECTED_ASSIGNABLE_DISCLOSES_${absent}`);
  }

  const searched = await listAssignable(requestId, harness.identities.analyst, "?q=second");
  assert.equal(searched.status, 200, "UNEXPECTED_ASSIGNABLE_SEARCH_STATUS");
  assert.deepEqual((await searched.json() as { data?: unknown }).data, [second], "UNEXPECTED_ASSIGNABLE_SEARCH");

  // The current assignee stays eligible: the picker, not the server, leaves them out.
  const pickUp = await changeAssignee(requestId, harness.identities.secondAnalyst, { analyst: harness.users.secondAnalyst, expectedAnalyst: null });
  assert.equal(pickUp.status, 200, "UNEXPECTED_PICK_UP_STATUS");
  const held = await listAssignable(requestId, harness.identities.analyst);
  assert.deepEqual((await held.json() as { data?: unknown }).data, [bob, second], "UNEXPECTED_ASSIGNABLE_WITH_ASSIGNEE");

  for (const [label, query] of [
    ["TERM_101", `?q=${"x".repeat(101)}`],
    ["TERM_BLANK", "?q=%20%20"],
    ["UNKNOWN_KEY", "?other=1"],
    ["TERM_AND_UNKNOWN_KEY", "?q=bob&populate=roles"],
  ] as const) {
    const refused = await listAssignable(requestId, harness.identities.analyst, query);
    assert.equal(refused.status, 400, `UNEXPECTED_ASSIGNABLE_QUERY_${label}`);
  }

  const draft = await seedRequest("draft");
  const draftResponse = await listAssignable(draft, harness.identities.analyst);
  assert.equal(draftResponse.status, 409, "UNEXPECTED_ASSIGNABLE_DRAFT_STATUS");
  assert.deepEqual(await refusalDetails(draftResponse), { reason: "REQUEST_NOT_SUBMITTED" }, "UNEXPECTED_ASSIGNABLE_DRAFT_REASON");

  const missing = await listAssignable("no-such-request", harness.identities.analyst);
  assert.equal(missing.status, 404, "UNEXPECTED_ASSIGNABLE_MISSING_STATUS");
});

test("an analyst who raised a request cannot list who may hold it (OWN_REQUEST), and the Requestors and the service agent are refused (D-07)", async () => {
  const harness = await harnessPromise;
  const created = await harness.request({
    path: "/api/csrm-assessment-requests",
    identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { title: "An analyst's request to list" } }) },
  });
  assert.equal(created.status, 200, "UNEXPECTED_OWN_CREATE_STATUS");
  const ownRequestId = (await created.json() as { data?: { documentId?: string } }).data?.documentId;
  assert.ok(ownRequestId, "UNEXPECTED_OWN_CREATED_ID");
  const submitted = await harness.request({
    path: `/api/csrm-assessment-requests/${ownRequestId}`,
    identity: harness.identities.analyst,
    init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { requestStatus: "submitted" } }) },
  });
  assert.equal(submitted.status, 200, "UNEXPECTED_OWN_SUBMIT_STATUS");

  const own = await listAssignable(ownRequestId, harness.identities.analyst);
  assert.equal(own.status, 403, "UNEXPECTED_OWN_LIST_STATUS");
  assert.deepEqual(await refusalDetails(own), { reason: "OWN_REQUEST" }, "UNEXPECTED_OWN_LIST_REASON");
  // Another analyst may list who holds Bob's request, and Bob, who raised it, is not among them.
  const forSecond = await listAssignable(ownRequestId, harness.identities.secondAnalyst);
  assert.equal(forSecond.status, 200, "UNEXPECTED_SECOND_LIST_STATUS");
  assert.deepEqual((await forSecond.json() as { data?: unknown }).data, [{ documentId: harness.users.secondAnalyst, displayName: "Second Analyst" }], "UNEXPECTED_SECOND_LIST");

  const requestId = await seedRequest();
  for (const identity of [harness.identities.owner, harness.identities.otherRequestor, harness.identities.serviceAnalystAgent, harness.identities.inactiveAnalyst]) {
    const refused = await listAssignable(requestId, identity);
    assert.equal(refused.status, 403, `UNEXPECTED_LIST_GRANT_${identity}`);
    const text = await refused.text();
    assert.equal(text.includes("Bob Doe") || text.includes("Second Analyst"), false, `UNEXPECTED_LIST_DISCLOSURE_${identity}`);
  }
});

/* Phase 13 (D-09, D-16, D-17): the request read names who holds the request. */

async function readAssignment(requestId: string, identity: string): Promise<{ status: number; data: Record<string, unknown> }> {
  const harness = await harnessPromise;
  const response = await harness.request({ path: `/api/csrm-assessment-requests/${encodeURIComponent(requestId)}`, identity });
  const body = await response.json() as { data?: Record<string, unknown> };
  return { status: response.status, data: body.data ?? {} };
}

test("the request read names who holds the request: the analyst view for analysts and the display name alone for the Requestor (D-09, D-16, D-17)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const bob = { documentId: harness.users.analyst, displayName: "Bob Doe" };

  const unassigned = await readAssignment(requestId, harness.identities.analyst);
  assert.equal(unassigned.status, 200, "UNEXPECTED_UNASSIGNED_READ_STATUS");
  assert.deepEqual(unassigned.data.assignment, {
    assignee: null, assignedBy: null, assignedAt: null, actions: ["pick-up", "assign"], ownRequest: false, history: [], viewer: bob,
  }, "UNEXPECTED_UNASSIGNED_ANALYST_VIEW");
  assert.equal(unassigned.data.revertedBy, null, "UNEXPECTED_UNREVERTED_REVERTED_BY");
  assert.deepEqual((await readAssignment(requestId, harness.identities.owner)).data.assignment, { assignee: null }, "UNEXPECTED_UNASSIGNED_REQUESTOR_VIEW");

  const pickUp = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null });
  assert.equal(pickUp.status, 200, "UNEXPECTED_PICK_UP_STATUS");

  const forBob = (await readAssignment(requestId, harness.identities.analyst)).data.assignment as Record<string, unknown>;
  assert.deepEqual(Object.keys(forBob).sort(), ["actions", "assignedAt", "assignedBy", "assignee", "history", "ownRequest", "viewer"], "UNEXPECTED_ANALYST_VIEW_KEYS");
  assert.deepEqual(forBob.viewer, bob, "UNEXPECTED_ANALYST_VIEW_VIEWER");
  assert.deepEqual(forBob.assignee, bob, "UNEXPECTED_ANALYST_VIEW_ASSIGNEE");
  assert.deepEqual(forBob.assignedBy, bob, "UNEXPECTED_ANALYST_VIEW_ASSIGNED_BY");
  assert.ok(Number.isFinite(Date.parse(String(forBob.assignedAt))), "UNEXPECTED_ANALYST_VIEW_ASSIGNED_AT");
  assert.deepEqual(forBob.actions, ["reassign", "unassign"], "UNEXPECTED_ANALYST_VIEW_ACTIONS");
  assert.equal(forBob.ownRequest, false, "UNEXPECTED_ANALYST_VIEW_OWN_REQUEST");
  assert.equal(Array.isArray(forBob.history) ? forBob.history.length : -1, 1, "UNEXPECTED_ANALYST_VIEW_HISTORY");

  const forSecond = (await readAssignment(requestId, harness.identities.secondAnalyst)).data.assignment as Record<string, unknown>;
  assert.deepEqual(forSecond.actions, ["assign-to-me", "reassign", "unassign"], "UNEXPECTED_SECOND_ANALYST_ACTIONS");
  // 13-09: each analyst's view names its own viewer, so the page can pick up or take the request for them.
  assert.deepEqual(forSecond.viewer, { documentId: harness.users.secondAnalyst, displayName: "Second Analyst" }, "UNEXPECTED_SECOND_ANALYST_VIEWER");

  const forJane = await readAssignment(requestId, harness.identities.owner);
  assert.equal(forJane.status, 200, "UNEXPECTED_REQUESTOR_READ_STATUS");
  assert.deepEqual(forJane.data.assignment, { assignee: { displayName: "Bob Doe" } }, "UNEXPECTED_REQUESTOR_VIEW");
  assert.equal(JSON.stringify(forJane.data).includes(harness.users.analyst), false, "UNEXPECTED_REQUESTOR_VIEW_ANALYST_ID");
});

test("an analyst reading a request they raised sees ownRequest and no actions, and a malformed history reads as unavailable", async () => {
  const harness = await harnessPromise;
  const created = await harness.request({
    path: "/api/csrm-assessment-requests",
    identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { title: "An analyst's request to read" } }) },
  });
  assert.equal(created.status, 200, "UNEXPECTED_OWN_CREATE_STATUS");
  const ownRequestId = (await created.json() as { data?: { documentId?: string } }).data?.documentId;
  assert.ok(ownRequestId, "UNEXPECTED_OWN_CREATED_ID");
  const submitted = await harness.request({
    path: `/api/csrm-assessment-requests/${ownRequestId}`,
    identity: harness.identities.analyst,
    init: { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { requestStatus: "submitted" } }) },
  });
  assert.equal(submitted.status, 200, "UNEXPECTED_OWN_SUBMIT_STATUS");
  const own = (await readAssignment(ownRequestId, harness.identities.analyst)).data.assignment as Record<string, unknown>;
  assert.equal(own.ownRequest, true, "UNEXPECTED_OWN_REQUEST_FLAG");
  assert.deepEqual(own.actions, [], "UNEXPECTED_OWN_REQUEST_ACTIONS");

  const requestId = await seedRequest();
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, {
    assignmentLog: { schemaVersion: 2, events: "not a list" },
  });
  const malformed = await readAssignment(requestId, harness.identities.analyst);
  assert.equal(malformed.status, 200, "UNEXPECTED_MALFORMED_LOG_READ_STATUS");
  assert.equal((malformed.data.assignment as Record<string, unknown>).history, null, "UNEXPECTED_MALFORMED_LOG_HISTORY");
});

/*
 * WR-101 (G-1, D-05, D-06; IN-204's dual-role case): an identity holding both the human Security Analyst role and the
 * Security Analyst Agent role passes the human-only grant check, but it is not an eligible person (isEligiblePerson
 * excludes the Agent role whatever else is held). So it takes no assignment action and reads no eligible list, with
 * nothing written, and no read offers it one (Pitfall 9: a projection offers exactly what the operation takes). Naming
 * it as the assignee is refused, and no eligible list names it.
 */
let dualRoleUser: Promise<string> | null = null;
const DUAL_ROLE_IDENTITY = "dual-role-analyst";

function dualRoleAnalyst(): Promise<string> {
  dualRoleUser ??= (async () => {
    const harness = await harnessPromise;
    const documentId = await harness.createUserFixture({
      email: "dual.role@example.test", username: "dual-role", displayName: "Dual Role Analyst", accountStatus: "active",
      roles: ["Security Analyst", "Security Analyst Agent"],
    });
    harness.registerTestIdentity(DUAL_ROLE_IDENTITY, documentId);
    return documentId;
  })();
  return dualRoleUser;
}

test("an identity holding both the human analyst and the agent role takes no assignment action, lists nobody and is offered nothing (WR-101, IN-204)", async () => {
  const harness = await harnessPromise;
  const dual = await dualRoleAnalyst();
  const bob = harness.users.analyst;
  const second = harness.users.secondAnalyst;
  const requestId = await seedRequest();

  await assertRefused(requestId, DUAL_ROLE_IDENTITY, { analyst: dual, expectedAnalyst: null }, 403, undefined, "DUAL_ROLE_PICK_UP");
  await assertRefused(requestId, DUAL_ROLE_IDENTITY, { analyst: bob, expectedAnalyst: null }, 403, undefined, "DUAL_ROLE_ASSIGN");
  const offered = await readAssignment(requestId, DUAL_ROLE_IDENTITY);
  assert.equal(offered.status, 200, "UNEXPECTED_DUAL_ROLE_READ_STATUS");
  assert.deepEqual((offered.data.assignment as Record<string, unknown>).actions, [], "UNEXPECTED_DUAL_ROLE_OFFERED_ACTIONS_UNASSIGNED");

  const queue = await harness.request({ path: `/api/v1/assessment_requests?filters[requestNumber]=${encodeURIComponent(String((await harness.getRequest(requestId))?.requestNumber))}&filters[queue]=all`, identity: DUAL_ROLE_IDENTITY });
  assert.equal(queue.status, 200, "UNEXPECTED_DUAL_ROLE_QUEUE_STATUS");
  const rows = (await queue.json() as { data?: Array<Record<string, unknown>> }).data ?? [];
  assert.deepEqual(rows.map((row) => [row.documentId, row.pickUp]), [[requestId, "not-offered"]], "UNEXPECTED_DUAL_ROLE_QUEUE_PICK_UP");

  const { questionnaire } = await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: requestId, released: false, answerState: "none" });
  const questionnaireRead = await harness.request({ path: `/api/v1/questionnaires/${encodeURIComponent(questionnaire)}`, identity: DUAL_ROLE_IDENTITY });
  assert.equal(questionnaireRead.status, 200, "UNEXPECTED_DUAL_ROLE_QUESTIONNAIRE_STATUS");
  const summary = ((await questionnaireRead.json() as { data?: { assessmentRequest?: { assignment?: Record<string, unknown> } } }).data?.assessmentRequest?.assignment);
  assert.equal(summary?.pickUp, "not-offered", "UNEXPECTED_DUAL_ROLE_QUESTIONNAIRE_PICK_UP");

  const listed = await listAssignable(requestId, DUAL_ROLE_IDENTITY);
  assert.equal(listed.status, 403, "UNEXPECTED_DUAL_ROLE_LIST_STATUS");
  assert.equal((await refusalDetails(listed) as { reason?: unknown } | undefined)?.reason, undefined, "UNEXPECTED_DUAL_ROLE_LIST_REASON");

  // IN-204: the eligible list never names the dual-role identity, and naming it is refused with nothing written.
  const forBob = await listAssignable(requestId, harness.identities.analyst);
  assert.deepEqual((await forBob.json() as { data?: unknown }).data, [
    { documentId: bob, displayName: "Bob Doe" }, { documentId: second, displayName: "Second Analyst" },
  ], "UNEXPECTED_DUAL_ROLE_LISTED");
  await assertRefused(requestId, harness.identities.analyst, { analyst: dual, expectedAnalyst: null }, 409, "ASSIGNEE_NOT_ELIGIBLE", "DUAL_ROLE_AS_ASSIGNEE");

  // Held by Bob: the dual-role identity cannot take it, move it or return it to the queue.
  assert.equal((await changeAssignee(requestId, harness.identities.analyst, { analyst: bob, expectedAnalyst: null })).status, 200, "UNEXPECTED_PICK_UP_STATUS");
  await assertRefused(requestId, DUAL_ROLE_IDENTITY, { analyst: dual, expectedAnalyst: bob }, 403, undefined, "DUAL_ROLE_ASSIGN_TO_ME");
  await assertRefused(requestId, DUAL_ROLE_IDENTITY, { analyst: second, expectedAnalyst: bob }, 403, undefined, "DUAL_ROLE_REASSIGN");
  await assertRefused(requestId, DUAL_ROLE_IDENTITY, { analyst: null, expectedAnalyst: bob }, 403, undefined, "DUAL_ROLE_UNASSIGN");
  const held = await readAssignment(requestId, DUAL_ROLE_IDENTITY);
  assert.deepEqual((held.data.assignment as Record<string, unknown>).actions, [], "UNEXPECTED_DUAL_ROLE_OFFERED_ACTIONS_HELD");
});

/*
 * IN-101 (D-08, the record's no-op rule): a change that names the current assignee is a no-op that succeeds and writes no
 * event, before the release rule is asked. So "unassign" sent for a request released before Phase 13, which nobody holds,
 * changes nothing and answers 200, never ASSIGNMENT_REQUIRED.
 */
test("unassigning a released request nobody holds is the no-op the record publishes, not ASSIGNMENT_REQUIRED (IN-101)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest("approved");
  const before = await persisted(requestId);
  const response = await changeAssignee(requestId, harness.identities.analyst, { analyst: null, expectedAnalyst: null });
  assert.equal(response.status, 200, "UNEXPECTED_RELEASED_NO_OP_STATUS");
  const view = (await response.json() as { data?: Record<string, unknown> }).data ?? {};
  assert.deepEqual([view.assignee, view.history, view.actions], [null, [], ["pick-up", "assign"]], "UNEXPECTED_RELEASED_NO_OP_VIEW");
  assert.deepEqual(await persisted(requestId), before, "UNEXPECTED_RELEASED_NO_OP_WRITE");
});

/*
 * Decision 10 (REQ-08 (4)): the assignment names who is accountable; it never restricts who may contribute.
 * While Bob holds Jane's request, the second analyst, who holds nothing, still changes it as before.
 */
test("an analyst who does not hold a request still changes it while a colleague holds it: assignment is not exclusive (decision 10)", async () => {
  const harness = await harnessPromise;
  const requestId = await seedRequest();
  const pickUp = await changeAssignee(requestId, harness.identities.analyst, { analyst: harness.users.analyst, expectedAnalyst: null });
  assert.equal(pickUp.status, 200, "UNEXPECTED_PICK_UP_STATUS");

  const reverted = await harness.request({
    path: `/api/v1/assessment_requests/${encodeURIComponent(requestId)}/revert_to_draft`,
    identity: harness.identities.secondAnalyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ reason: "Clarify the vendor's hosting." }) },
  });
  assert.equal(reverted.status, 200, "NON_ASSIGNEE_REVERT_REFUSED");
  assert.equal((await harness.getRequest(requestId))?.requestStatus, "draft", "NON_ASSIGNEE_REVERT_NOT_WRITTEN");
  const stored = await harness.getRequestAssignment(requestId);
  assert.equal(stored?.assignedAnalyst, harness.users.analyst, "NON_ASSIGNEE_CHANGE_MOVED_THE_ASSIGNMENT");
  assert.equal((stored?.assignmentLog as { events?: unknown[] } | null)?.events?.length, 1, "NON_ASSIGNEE_CHANGE_LOGGED_AN_ASSIGNMENT_EVENT");
});
