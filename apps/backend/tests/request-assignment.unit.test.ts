import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  ASSIGNMENT_LOG_MAX_EVENTS,
  AssignmentLogError,
  appendAssignmentEvent,
  canAppendAssignmentEvent,
  parseAssignmentLog,
  readAssignmentHistory,
} from "../src/api/csrm-assessment-request/services/assignment-log";
import {
  AssignedAnalystRefusal,
  NOT_ASSIGNED_ANALYST,
  REQUEST_UNASSIGNED,
  allowedAssignmentActions,
  assertAssignedAnalyst,
  deriveAssignmentAction,
  isEligibleAssignee,
  pickUpState,
  type EligibilityUser,
} from "../src/api/csrm-assessment-request/services/request-assignment-policy";
import { isEligiblePerson } from "../src/csrm/people/eligible-person";

/* Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend. */
const appDir = path.resolve(__dirname, "..", "..", "..");

const REVIEW_QUEUE = "GET:/api/v1/assessment_requests";

function role(name: string, urls: readonly string[] = [REVIEW_QUEUE]) {
  return { name, functions: [{ functionApis: urls.map((url) => ({ url })) }] };
}

const analyst: EligibilityUser = { documentId: "analyst", accountStatus: "active", roles: [role("Security Analyst")] };
const inactive: EligibilityUser = { ...analyst, documentId: "inactive", accountStatus: "inactive" };
const requestorOnly: EligibilityUser = { documentId: "requestor-only", accountStatus: "active", roles: [] };
const agentOnly: EligibilityUser = { documentId: "agent", accountStatus: "active", roles: [role("Security Analyst Agent")] };
const agentAndHuman: EligibilityUser = { documentId: "agent-and-human", accountStatus: "active", roles: [role("Security Analyst"), role("Security Analyst Agent")] };
const humanWithoutGrant: EligibilityUser = { documentId: "no-grant", accountStatus: "active", roles: [role("Security Analyst", [])] };
const grantThroughAgent: EligibilityUser = { documentId: "grant-through-agent", accountStatus: "active", roles: [role("Security Analyst", []), role("Security Analyst Agent")] };

test("the eligible person is active and never the Security Analyst Agent (19.1 D-07's shared predicate)", () => {
  assert.equal(isEligiblePerson({ accountStatus: "active", roles: [] }), true);
  assert.equal(isEligiblePerson({ accountStatus: "active", roles: [{ name: "Security Analyst" }] }), true);
  assert.equal(isEligiblePerson({ accountStatus: "inactive", roles: [] }), false);
  assert.equal(isEligiblePerson({ accountStatus: "active", roles: [{ name: "Security Analyst Agent" }] }), false);
  assert.equal(isEligiblePerson({ accountStatus: "active", roles: [{ name: "Security Analyst" }, { name: "Security Analyst Agent" }] }), false);
  // Fails closed on what it cannot read.
  for (const user of [null, undefined, {}, { accountStatus: "active" }, { accountStatus: "active", roles: null }, { accountStatus: "Active", roles: [] }]) {
    assert.equal(isEligiblePerson(user as never), false, JSON.stringify(user));
  }
});

test("isEligibleAssignee holds only for an active human analyst who did not raise the request (D-06, D-07, G-1)", () => {
  const request = { requestorDocumentId: "jane" };
  assert.equal(isEligibleAssignee(analyst, request), true);
  assert.equal(isEligibleAssignee(inactive, request), false, "inactive");
  assert.equal(isEligibleAssignee(requestorOnly, request), false, "Requestor birthright only");
  assert.equal(isEligibleAssignee(agentOnly, request), false, "the Security Analyst Agent");
  assert.equal(isEligibleAssignee(agentAndHuman, request), false, "the agent role beside the human role");
  assert.equal(isEligibleAssignee(humanWithoutGrant, request), false, "the human role without the analyst grant");
  assert.equal(isEligibleAssignee(grantThroughAgent, request), false, "the analyst grant only through the agent role");
  assert.equal(isEligibleAssignee(analyst, { requestorDocumentId: "analyst" }), false, "the request's own requestor");
  assert.equal(isEligibleAssignee(null, request), false, "an unknown user");
});

test("deriveAssignmentAction names the four actions and null for the same target", () => {
  assert.equal(deriveAssignmentAction(null, "bob", "bob"), "pick-up");
  assert.equal(deriveAssignmentAction(null, "second", "bob"), "assign");
  assert.equal(deriveAssignmentAction("second", "third", "bob"), "reassign");
  assert.equal(deriveAssignmentAction("second", "bob", "bob"), "reassign");
  assert.equal(deriveAssignmentAction("second", null, "bob"), "unassign");
  assert.equal(deriveAssignmentAction("second", "second", "bob"), null);
  assert.equal(deriveAssignmentAction(null, null, "bob"), null);
});

test("allowedAssignmentActions offers what the viewer may do, and nothing to a requestor, a non-human viewer or on a draft (D-08)", () => {
  const viewer = { documentId: "bob", humanAnalyst: true };
  const request = (requestStatus: string, assigneeDocumentId: string | null, requestorDocumentId = "jane") => ({ requestStatus, requestorDocumentId, assigneeDocumentId });
  assert.deepEqual(allowedAssignmentActions(request("submitted", null), viewer), ["pick-up", "assign"]);
  assert.deepEqual(allowedAssignmentActions(request("under-review", "bob"), viewer), ["reassign", "unassign"]);
  assert.deepEqual(allowedAssignmentActions(request("questionnaire-in-progress", "second"), viewer), ["assign-to-me", "reassign", "unassign"]);
  assert.deepEqual(allowedAssignmentActions(request("approved", "second"), viewer), ["assign-to-me", "reassign"]);
  assert.deepEqual(allowedAssignmentActions(request("closed", "bob"), viewer), ["reassign"]);
  assert.deepEqual(allowedAssignmentActions(request("approved", null), viewer), ["pick-up", "assign"]);
  assert.deepEqual(allowedAssignmentActions(request("draft", null), viewer), []);
  assert.deepEqual(allowedAssignmentActions(request("submitted", null, "bob"), viewer), [], "a requesting analyst");
  assert.deepEqual(allowedAssignmentActions(request("submitted", null), { documentId: "agent", humanAnalyst: false }), [], "a non-human viewer");
});

/*
 * Phase 13 D-13, D-07 (13-12): the review queue says whether this viewer may pick a request up, from the same rules as
 * the assignment operation (Pitfall 9), and says when the viewer raised it, so the queue reads "You raised it".
 */
test("pickUpState offers a pick-up exactly where the assignment operation would, and names the viewer's own request", () => {
  const bob = { documentId: "bob", humanAnalyst: true };
  const request = (requestStatus: string, assigneeDocumentId: string | null, requestorDocumentId: string | null = "jane") => ({ requestStatus, requestorDocumentId, assigneeDocumentId });
  assert.equal(pickUpState(request("submitted", null), bob), "allowed", "UNASSIGNED_SUBMITTED_NOT_ALLOWED");
  assert.equal(pickUpState(request("under-review", null), bob), "allowed", "UNASSIGNED_UNDER_REVIEW_NOT_ALLOWED");
  assert.equal(pickUpState(request("approved", null), bob), "allowed", "UNASSIGNED_RELEASED_NOT_ALLOWED");
  assert.equal(pickUpState(request("submitted", null, null), bob), "allowed", "REQUEST_WITHOUT_REQUESTOR_NOT_ALLOWED");
  assert.equal(pickUpState(request("submitted", null, "bob"), bob), "own-request", "REQUESTING_ANALYST_NOT_OWN_REQUEST");
  assert.equal(pickUpState(request("submitted", "second", "bob"), bob), "own-request", "HELD_OWN_REQUEST_NOT_OWN_REQUEST");
  assert.equal(pickUpState(request("submitted", "second"), bob), "not-offered", "HELD_REQUEST_OFFERED");
  assert.equal(pickUpState(request("submitted", "bob"), bob), "not-offered", "OWN_HOLD_OFFERED");
  assert.equal(pickUpState(request("draft", null), bob), "not-offered", "DRAFT_OFFERED");
  assert.equal(pickUpState(request("draft", null, "bob"), bob), "not-offered", "OWN_DRAFT_NOT_NOT_OFFERED");
  assert.equal(pickUpState(request("submitted", null), { documentId: "agent", humanAnalyst: false }), "not-offered", "NON_HUMAN_VIEWER_OFFERED");
  assert.equal(pickUpState(request("submitted", null, "agent"), { documentId: "agent", humanAnalyst: false }), "not-offered", "NON_HUMAN_REQUESTOR_OWN_REQUEST");
  // The same rule as the operation: "allowed" exactly when the viewer's actions hold a pick-up.
  for (const status of ["submitted", "questionnaire-in-progress", "risk-assessment-drafted", "under-review", "approved", "closed", "draft"]) {
    for (const assignee of [null, "bob", "second"]) {
      for (const requestor of ["jane", "bob", null]) {
        for (const viewer of [bob, { documentId: "agent", humanAnalyst: false }]) {
          const facts = request(status, assignee, requestor);
          assert.equal(
            pickUpState(facts, viewer) === "allowed",
            allowedAssignmentActions(facts, viewer).includes("pick-up"),
            `PICK_UP_STATE_DISAGREES_WITH_ACTIONS_${status}_${assignee}_${requestor}_${viewer.documentId}`,
          );
        }
      }
    }
  }
});

const AT = "2026-10-09T01:02:03.000Z";
const pickUp = { schemaVersion: 1, action: "pick-up", by: "bob", at: AT, from: null, to: "bob", reason: null };
const reassign = { schemaVersion: 1, action: "reassign", by: "second", at: "2026-10-09T02:00:00.000Z", from: "bob", to: "second", reason: "Covering." };

test("parseAssignmentLog accepts null and a valid v1 log and rejects anything outside the closed schema", () => {
  assert.deepEqual(parseAssignmentLog(null), []);
  assert.deepEqual(parseAssignmentLog(undefined), []);
  assert.deepEqual(parseAssignmentLog({ schemaVersion: 1, events: [pickUp, reassign] }), [pickUp, reassign]);
  assert.ok(Object.isFrozen(parseAssignmentLog({ schemaVersion: 1, events: [pickUp] })[0]));
  const many = Array.from({ length: ASSIGNMENT_LOG_MAX_EVENTS + 1 }, (_, index) => (index === 0 ? pickUp : { ...reassign, from: index % 2 ? "bob" : "second", to: index % 2 ? "second" : "bob" }));
  for (const [label, value] of [
    ["an array envelope", [pickUp]],
    ["an unknown envelope key", { schemaVersion: 1, events: [], extra: true }],
    ["schema version 2", { schemaVersion: 2, events: [pickUp] }],
    ["an unknown event key", { schemaVersion: 1, events: [{ ...pickUp, note: "x" }] }],
    ["a missing event key", { schemaVersion: 1, events: [{ schemaVersion: 1, action: "pick-up", by: "bob", at: AT, from: null, to: "bob" }] }],
    ["an event schema version 2", { schemaVersion: 1, events: [{ ...pickUp, schemaVersion: 2 }] }],
    ["a bad action", { schemaVersion: 1, events: [{ ...pickUp, action: "take" }] }],
    ["a reason over 500 characters", { schemaVersion: 1, events: [{ ...reassign, reason: "x".repeat(501) }] }],
    ["a bad instant", { schemaVersion: 1, events: [{ ...pickUp, at: "yesterday" }] }],
    ["an action that disagrees with its transition", { schemaVersion: 1, events: [{ ...pickUp, to: "second" }] }],
    ["1,001 events", { schemaVersion: 1, events: many }],
  ] as const) {
    assert.throws(() => parseAssignmentLog(value), AssignmentLogError, label);
  }
});

test("readAssignmentHistory reads newest first and fails safe to null on a malformed log", () => {
  assert.deepEqual(readAssignmentHistory({ schemaVersion: 1, events: [pickUp, reassign] }), [reassign, pickUp]);
  assert.deepEqual(readAssignmentHistory(null), []);
  assert.equal(readAssignmentHistory({ schemaVersion: 2, events: [] }), null);
  assert.equal(readAssignmentHistory("not a log"), null);
});

test("appendAssignmentEvent appends without touching earlier events and refuses at the cap", () => {
  const stored = { schemaVersion: 1, events: [pickUp] };
  const appended = appendAssignmentEvent(stored, reassign);
  assert.deepEqual(appended, { schemaVersion: 1, events: [pickUp, reassign] });
  assert.deepEqual(stored, { schemaVersion: 1, events: [pickUp] }, "the stored envelope is not mutated");
  const full = { schemaVersion: 1, events: Array.from({ length: ASSIGNMENT_LOG_MAX_EVENTS }, (_, index) => (index === 0 ? pickUp : { ...reassign, from: index % 2 ? "bob" : "second", to: index % 2 ? "second" : "bob" })) };
  assert.equal(parseAssignmentLog(full).length, ASSIGNMENT_LOG_MAX_EVENTS);
  assert.throws(() => appendAssignmentEvent(full, { ...reassign, from: "bob", to: "second" }), AssignmentLogError);
  assert.throws(() => appendAssignmentEvent({ schemaVersion: 2, events: [] }, pickUp), AssignmentLogError);
});

function refusalOf(action: () => void): AssignedAnalystRefusal {
  try {
    action();
  } catch (error) {
    assert.ok(error instanceof AssignedAnalystRefusal, String(error));
    return error;
  }
  assert.fail("expected an AssignedAnalystRefusal");
}

const assignedRequest = { requestorDocumentId: "jane", assigneeDocumentId: "analyst" };
const asAnalyst = { documentId: "analyst", humanAnalyst: true };

test("assertAssignedAnalyst holds for the current, still-eligible assignee reaching it as a human analyst (D-10)", () => {
  assert.doesNotThrow(() => assertAssignedAnalyst({ request: assignedRequest, caller: asAnalyst, callerUser: analyst }));
});

test("assertAssignedAnalyst refuses with REQUEST_UNASSIGNED (409) when nobody is assigned", () => {
  const refusal = refusalOf(() => assertAssignedAnalyst({ request: { ...assignedRequest, assigneeDocumentId: null }, caller: asAnalyst, callerUser: analyst }));
  assert.equal(refusal.reason, REQUEST_UNASSIGNED);
  assert.equal(refusal.reason, "REQUEST_UNASSIGNED");
  assert.equal(refusal.status, 409);
});

test("assertAssignedAnalyst refuses with NOT_ASSIGNED_ANALYST (403) another analyst, a lapsed assignee and a caller without the human grant", () => {
  const cases: Array<[string, Parameters<typeof assertAssignedAnalyst>[0]]> = [
    ["another analyst", { request: { ...assignedRequest, assigneeDocumentId: "second" }, caller: asAnalyst, callerUser: analyst }],
    ["the assignee now inactive", { request: assignedRequest, caller: asAnalyst, callerUser: { ...analyst, accountStatus: "inactive" } }],
    ["the assignee without the human role", { request: assignedRequest, caller: asAnalyst, callerUser: { ...analyst, roles: [] } }],
    ["the assignee who now holds the agent role", { request: assignedRequest, caller: asAnalyst, callerUser: { ...analyst, roles: [role("Security Analyst"), role("Security Analyst Agent")] } }],
    ["the assignee reaching it without the human grant", { request: assignedRequest, caller: { ...asAnalyst, humanAnalyst: false }, callerUser: analyst }],
    ["a caller user that is not the caller", { request: assignedRequest, caller: asAnalyst, callerUser: { ...analyst, documentId: "second" } }],
  ];
  for (const [label, input] of cases) {
    const refusal = refusalOf(() => assertAssignedAnalyst(input));
    assert.equal(refusal.reason, NOT_ASSIGNED_ANALYST, label);
    assert.equal(refusal.reason, "NOT_ASSIGNED_ANALYST", label);
    assert.equal(refusal.status, 403, label);
  }
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const full = path.join(directory, entry);
    return statSync(full).isDirectory() ? sourceFiles(full) : full.endsWith(".ts") ? [full] : [];
  });
}

test("no questionnaire, assessment, Risk or control implementation code reads the assignment policy (decision 10)", () => {
  for (const api of ["csrm-questionnaire", "csrm-assessment", "csrm-risk", "csrm-control-implementation"]) {
    for (const file of sourceFiles(path.join(appDir, "src", "api", api))) {
      assert.equal(readFileSync(file, "utf8").includes("request-assignment-policy"), false, file);
    }
  }
});

/* WR-205 (T-13-08): whether the log takes one more event, at every boundary the assignment operation asks it at. */
test("canAppendAssignmentEvent takes an event on no log and below the cap, and refuses at the cap and on a malformed log", () => {
  const events = (length: number) => Array.from({ length }, (_, index) => ({
    schemaVersion: 1, action: index === 0 ? "pick-up" : "reassign", by: index % 2 === 0 ? "second" : "bob", at: "2026-10-01T00:00:00.000Z",
    from: index === 0 ? null : index % 2 === 1 ? "second" : "bob", to: index % 2 === 0 ? "second" : "bob", reason: null,
  }));
  assert.equal(parseAssignmentLog({ schemaVersion: 1, events: events(ASSIGNMENT_LOG_MAX_EVENTS) }).length, ASSIGNMENT_LOG_MAX_EVENTS, "CAP_FIXTURE_MALFORMED");
  assert.equal(canAppendAssignmentEvent(null), true, "NO_LOG_REFUSED");
  assert.equal(canAppendAssignmentEvent(undefined), true, "ABSENT_LOG_REFUSED");
  assert.equal(canAppendAssignmentEvent({ schemaVersion: 1, events: events(ASSIGNMENT_LOG_MAX_EVENTS - 1) }), true, "BELOW_CAP_REFUSED");
  assert.equal(canAppendAssignmentEvent({ schemaVersion: 1, events: events(ASSIGNMENT_LOG_MAX_EVENTS) }), false, "AT_CAP_TAKEN");
  assert.equal(canAppendAssignmentEvent({ schemaVersion: 1, events: events(ASSIGNMENT_LOG_MAX_EVENTS + 1) }), false, "OVER_CAP_TAKEN");
  for (const [label, log] of [
    ["VERSION", { schemaVersion: 2, events: [] }],
    ["NOT_A_LIST", { schemaVersion: 1, events: "none" }],
    ["BAD_EVENT", { schemaVersion: 1, events: [{ ...events(1)[0], at: "not a time" }] }],
    ["EXTRA_KEY", { schemaVersion: 1, events: [], extra: true }],
  ] as const) {
    assert.equal(canAppendAssignmentEvent(log), false, `MALFORMED_TAKEN_${label}`);
  }
});
