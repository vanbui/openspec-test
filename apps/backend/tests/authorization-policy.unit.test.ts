import assert from "node:assert/strict";
import test from "node:test";

import myRequestsRoutes from "../src/api/csrm-assessment-request/routes/my-requests";
import assessmentRoutes from "../src/api/csrm-assessment/routes/csrm-assessment";
import questionnaireRoutes from "../src/api/csrm-questionnaire/routes/csrm-questionnaire";

import csrmAuthorization, { HUMAN_ANALYST_ONLY_OPERATIONS, isHumanSecurityAnalyst, SERVICE_IDENTITY_REFUSED_OPERATIONS, type AuthorizationStrapi } from "../src/policies/csrm-authorization";
import {
  applyAssessmentRequestCollectionScope,
  AssessmentRequestQueryError,
} from "../src/api/csrm-assessment-request/services/collection-scope";
import { CSRM_ASSESSMENT_REQUEST_OPERATIONS } from "../src/api/csrm-assessment-request/operations";
import {
  AssessmentRequestWorkflowError,
  prepareRequestorCreate,
} from "../src/api/csrm-assessment-request/services/request-workflow";
import {
  authorizationIdentities,
  createAuthorizationStrapi,
  createPolicyContext,
  FUNCTION_API_OPERATIONS,
  restrictedAssessmentRequest,
  type SeededIdentity,
} from "./fixtures/authorization";

/*
 * Fast direct-policy unit coverage; mounted HTTP coverage is in
 * authorization.integration.test.ts and authorization-matrix.integration.test.ts.
 *
 * The policy function and the two collection helpers are called directly with
 * the fixture's fake Strapi. Until Phase 8 these proofs lived in a CommonJS file
 * that `node --test` was handed under a build-output path no build emits, so
 * they never ran; this compiled file runs on every suite run through the
 * compiled-tests glob of the package's test script.
 */

type PolicyContext = Parameters<typeof csrmAuthorization>[0];
type PolicyConfig = Parameters<typeof csrmAuthorization>[1];
type PolicyStrapi = Parameters<typeof csrmAuthorization>[2]["strapi"];
type Role = SeededIdentity["roles"][number];

const FUNCTION_API_DENIED = "CSRM FunctionAPI access is denied.";
const REQUEST_ACCESS_DENIED = "CSRM assessment request access is denied.";
const RELEASE_REQUIRES_HUMAN = "CSRM assessment release requires a human Security Analyst.";

function fixtureStrapi(options?: Parameters<typeof createAuthorizationStrapi>[0]): PolicyStrapi {
  return createAuthorizationStrapi(options) as unknown as PolicyStrapi;
}

/** The decision the policy recorded on the context for the controller to read. */
function decisionOf(context: { state: unknown }): PolicyContext["state"]["csrmAuthorization"] {
  return (context.state as PolicyContext["state"]).csrmAuthorization;
}

test("Strapi denies a Requestor an ungranted FunctionAPI operation", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.requestor,
  );

  const allowed = await csrmAuthorization(
    context,
    { operation: FUNCTION_API_OPERATIONS.deleteAssessmentRequest },
    { strapi: fixtureStrapi() },
  );

  assert.equal(allowed, false);
  assert.deepEqual(forbiddenMessages, [FUNCTION_API_DENIED]);
});

test("Strapi permits an explicitly assigned Security Analyst FunctionAPI operation", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.securityAnalyst,
  );

  const allowed = await csrmAuthorization(
    context,
    { operation: FUNCTION_API_OPERATIONS.listAssessmentRequests },
    { strapi: fixtureStrapi() },
  );

  assert.equal(allowed, true);
  assert.deepEqual(forbiddenMessages, []);
});

test("Strapi denies a URL-substituted restricted assessment request", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.requestor,
    restrictedAssessmentRequest.documentId,
  );

  const allowed = await csrmAuthorization(
    context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestOwnership: true,
    },
    { strapi: fixtureStrapi() },
  );

  assert.equal(allowed, false);
  assert.deepEqual(forbiddenMessages, [REQUEST_ACCESS_DENIED]);
});

test("Strapi permits an active Requestor only on their own assessment request", async () => {
  const ownedRequest = {
    documentId: "assessment-request-owned-by-jane",
    requestor: { documentId: authorizationIdentities.requestor.documentId },
  };
  const strapi = fixtureStrapi({ assessmentRequests: [ownedRequest] });
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.requestor,
    ownedRequest.documentId,
  );

  const allowed = await csrmAuthorization(
    context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestOwnership: true,
    },
    { strapi },
  );

  assert.equal(allowed, true);
  assert.deepEqual(forbiddenMessages, []);
});

test("Strapi denies an analyst-named role without the current FunctionAPI grant", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.securityAnalystWithoutGrant,
    restrictedAssessmentRequest.documentId,
  );

  const allowed = await csrmAuthorization(
    context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestOwnership: true,
    },
    { strapi: fixtureStrapi() },
  );

  assert.equal(allowed, false);
  assert.deepEqual(forbiddenMessages, [REQUEST_ACCESS_DENIED]);
});

test("Strapi denies an inactive IdamBox User before evaluating grants", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.inactiveSecurityAnalyst,
    restrictedAssessmentRequest.documentId,
  );

  const allowed = await csrmAuthorization(
    context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestOwnership: true,
    },
    { strapi: fixtureStrapi() },
  );

  assert.equal(allowed, false);
  assert.deepEqual(forbiddenMessages, [FUNCTION_API_DENIED]);
});

test("Strapi emits trusted owner collection scope for every authorised My-route actor", async () => {
  const analyst = createPolicyContext(authorizationIdentities.securityAnalyst);
  const analystAllowed = await csrmAuthorization(
    analyst.context,
    {
      operation: FUNCTION_API_OPERATIONS.listAssessmentRequests,
      requireRequestCollectionScope: true,
    },
    { strapi: fixtureStrapi() },
  );
  assert.equal(analystAllowed, true);
  assert.equal(decisionOf(analyst.context)?.assessmentRequestCollectionScope, "own");

  const requestor = createPolicyContext(authorizationIdentities.requestor);
  const requestorAllowed = await csrmAuthorization(
    requestor.context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestCollectionScope: true,
    },
    { strapi: fixtureStrapi() },
  );
  assert.equal(requestorAllowed, true);
  assert.equal(decisionOf(requestor.context)?.assessmentRequestCollectionScope, "own");
});

test("Strapi scopes the Security Analyst Agent to its own requests on the My route", async () => {
  // The agent carries the same Function grants as the human analyst, so the
  // owner-scoping change tightens it from "all" to "own" as well. Without this
  // assertion an accidental widening for automation would pass unnoticed.
  const agent = createPolicyContext(authorizationIdentities.securityAnalystAgent);
  const allowed = await csrmAuthorization(
    agent.context,
    {
      operation: FUNCTION_API_OPERATIONS.listAssessmentRequests,
      requireRequestCollectionScope: true,
    },
    { strapi: fixtureStrapi() },
  );

  assert.equal(allowed, true);
  assert.equal(decisionOf(agent.context)?.assessmentRequestCollectionScope, "own");
  assert.equal(
    decisionOf(agent.context)?.assessmentRequestRequestorId,
    authorizationIdentities.securityAnalystAgent.id,
  );
});

test("Strapi records an explicit assessment owner collection decision independently of analyst actor facts", async () => {
  const analyst = createPolicyContext(authorizationIdentities.securityAnalyst);
  const allowed = await csrmAuthorization(
    analyst.context,
    {
      operation: FUNCTION_API_OPERATIONS.listAssessmentRequests,
      requireAssessmentOwnerCollectionScope: true,
    },
    { strapi: fixtureStrapi() },
  );

  assert.equal(allowed, true);
  assert.equal(decisionOf(analyst.context)?.assessmentRequestActor, "analyst");
  assert.equal(decisionOf(analyst.context)?.assessmentOwnerCollectionScope, "own");
  assert.equal(decisionOf(analyst.context)?.assessmentOwnerDocumentId, authorizationIdentities.securityAnalyst.documentId);
});

test("Strapi composes Requestor collection scope with client filters without allowing them to widen ownership", () => {
  const query = {
    filters: {
      requestor: { id: { $eq: 999 } },
      status: { $eq: "submitted" },
    },
    sort: ["createdAt:desc"],
    pagination: { page: 1, pageSize: 10 },
  };

  const scoped = applyAssessmentRequestCollectionScope(query, {
    idamboxUser: { documentId: authorizationIdentities.requestor.documentId },
    csrmAuthorization: { assessmentRequestCollectionScope: "own", assessmentRequestRequestorId: authorizationIdentities.requestor.id },
  });

  assert.deepEqual(scoped, {
    ...query,
    filters: {
      status: { $eq: "submitted" },
      requestor: {
        id: { $eq: authorizationIdentities.requestor.id },
      },
    },
  });
});

test("Strapi preserves an explicitly granted analyst collection query without Requestor filtering", () => {
  const query = { filters: { status: { $eq: "submitted" } } };

  assert.strictEqual(
    applyAssessmentRequestCollectionScope(query, {
      idamboxUser: { documentId: authorizationIdentities.securityAnalyst.documentId },
      csrmAuthorization: { assessmentRequestCollectionScope: "all" },
    }),
    query,
  );
});

test("Strapi fails closed when collection authorization state is absent or invalid", () => {
  // Since 02-05 (97a2f9e) the collection helpers throw AssessmentRequestQueryError,
  // which the controller answers as the safe constant 400, instead of the earlier
  // "collection scope is denied" Error. The proof is unchanged: nothing is scoped
  // when the authorization decision is absent or malformed.
  const failsClosed = (error: unknown) =>
    error instanceof AssessmentRequestQueryError
    && error.message === "CSRM assessment request query is invalid.";
  assert.throws(() => applyAssessmentRequestCollectionScope({}, {}), failsClosed);
  assert.throws(
    () =>
      applyAssessmentRequestCollectionScope({}, {
        idamboxUser: { documentId: authorizationIdentities.requestor.documentId },
        csrmAuthorization: { assessmentRequestCollectionScope: "all-users" },
      }),
    failsClosed,
  );
});

/*
 * The create controller builds every actor's new request with prepareRequestorCreate (T-08-A1): the
 * caller creates as a Requestor, the birthright role, so the request is the caller's own. These two
 * cases once exercised a helper no route had called since 97a2f9e; they now prove the live path.
 */
const TRUSTED_REQUEST_NUMBER = "RAR-2026-X7K4Q2";

test("Strapi overwrites a forged Requestor relation with trusted server identity", () => {
  const data = prepareRequestorCreate({
    requestor: restrictedAssessmentRequest.requestor.documentId,
    title: "Request a risk assessment",
    requestNumber: "FORGED-001",
    requestStatus: "approved",
    submittedDate: "2001-01-01T00:00:00.000Z",
    sponsor: restrictedAssessmentRequest.requestor.documentId,
    revertReason: "Forged reversal",
    revertedAt: "2001-01-01T00:00:00.000Z",
    revertedBy: restrictedAssessmentRequest.requestor.documentId,
    questionnaire: "forged-questionnaire",
    assessment: "forged-assessment",
  }, authorizationIdentities.requestor.documentId, TRUSTED_REQUEST_NUMBER);

  // Only the published create fields survive; ownership and every other fact come from the server.
  assert.deepEqual(data, {
    title: "Request a risk assessment",
    requestor: authorizationIdentities.requestor.documentId,
    requestNumber: TRUSTED_REQUEST_NUMBER,
    requestStatus: "draft",
    submittedDate: null,
  });
});

test("Strapi refuses assessment-request creation without a trusted IdamBox identity", () => {
  const refusedSafely = (error: unknown) =>
    error instanceof AssessmentRequestWorkflowError && error.message === "CSRM assessment request data is invalid.";
  for (const identity of [undefined, null, "", 42, { documentId: authorizationIdentities.requestor.documentId }]) {
    assert.throws(
      () => prepareRequestorCreate({ title: "Request a risk assessment" }, identity, TRUSTED_REQUEST_NUMBER),
      refusedSafely,
      `CREATE_ADMITTED_WITHOUT_A_TRUSTED_IDENTITY_${JSON.stringify(identity)}`,
    );
  }
});

test("Strapi uses five canonical FunctionAPI identifiers for its served assessment-request routes", () => {
  assert.deepEqual(CSRM_ASSESSMENT_REQUEST_OPERATIONS, {
    find: "GET:/api/csrm-assessment-requests",
    create: "POST:/api/csrm-assessment-requests",
    findOne: "GET:/api/csrm-assessment-requests/{id}",
    update: "PUT:/api/csrm-assessment-requests/{id}",
    delete: "DELETE:/api/csrm-assessment-requests/{id}",
    revertToDraft: "POST:/api/v1/assessment_requests/{requestId}/revert_to_draft",
  });
  assert.equal(
    CSRM_ASSESSMENT_REQUEST_OPERATIONS.delete,
    "DELETE:/api/csrm-assessment-requests/{id}",
  );
});

/*
 * Phase 8 D-17: Requestor is a birthright role, Security Analyst is explicit,
 * and the analyst service agent never holds a human-analyst grant. The identities
 * and the birthright role below exist only here; the shapes follow
 * tests/fixtures/authorization.ts.
 */

const MY_RELEASED_ASSESSMENTS = "GET:/api/v1/my_risk_assessments";
const MY_REQUEST_STATUS_SUMMARY = "GET:/api/v1/my_requests/status_summary";
const RELEASE_ASSESSMENT = "POST:/api/v1/risk_assessments/{assessmentId}/release";
/** Three representative operations the catalogue grants to the explicit Security Analyst role only. */
const EXPLICIT_ANALYST_OPERATIONS = [
  "GET:/api/v1/risks",
  "GET:/api/v1/risk_assessments",
  "POST:/api/v1/risk_types",
] as const;

function role(name: string, urls: readonly string[]): Role {
  return { name, functions: [{ functionApis: urls.map((url) => ({ url })) }] };
}

/** The Requestor birthright as the catalogue shapes it: the My routes and nothing an analyst holds. */
const birthrightRole = role("Requestor", [
  FUNCTION_API_OPERATIONS.getAssessmentRequest,
  FUNCTION_API_OPERATIONS.listAssessmentRequests,
  MY_RELEASED_ASSESSMENTS,
  MY_REQUEST_STATUS_SUMMARY,
]);

/* IN-101: the five Phase 12 AI operations (D-24, D-25, D-32), human Security Analyst work only. */
const AI_ASSISTANCE_OPERATIONS = [
  "POST:/api/v1/questionnaires/{questionnaireId}/generate_assessment",
  "GET:/api/v1/assessment_draft_jobs/{jobId}",
  "POST:/api/v1/assessment_draft_jobs/{jobId}/retry",
  "GET:/api/v1/ai_runs/{runId}",
  "POST:/api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions",
] as const;

/* Phase 15 (D-31, W-9): asking the AI about a questionnaire and deciding its proposals, human Security Analyst work only. */
const QUESTIONNAIRE_AI_OPERATIONS = [
  "POST:/api/v1/questionnaires/{questionnaireId}/ai_proposals",
  "GET:/api/v1/questionnaires/{questionnaireId}/ai_proposals",
  "POST:/api/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite",
  "GET:/api/v1/questionnaire_proposal_jobs/{jobId}",
  "POST:/api/v1/questionnaire_proposal_jobs/{jobId}/retry",
  "POST:/api/v1/questionnaires/{questionnaireId}/ai_proposal_decisions",
] as const;

/* Phase 13 (G-1, D-30): changing who holds a request, human Security Analyst work only. */
const REQUEST_ASSIGNEE_OPERATION = "PUT:/api/v1/assessment_requests/{requestId}/assignee";
/* Phase 13 (D-06, D-07): the eligible-analyst read, the same human-only work. */
const REQUEST_ASSIGNABLE_ANALYSTS_OPERATION = "GET:/api/v1/assessment_requests/{requestId}/assignable_analysts";
const REQUEST_ASSIGNMENT_OPERATIONS = [REQUEST_ASSIGNEE_OPERATION, REQUEST_ASSIGNABLE_ANALYSTS_OPERATION] as const;
/* Phase 13 (D-26, D-30): marking a request note as changing the AI inputs, human Security Analyst work only. */
const NOTE_AI_INPUT_OPERATION = "PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input";
/* Phase 13 (D-21): posting a request note, granted to the Requestor and the human Security Analyst. */
const NOTE_CREATE_OPERATION = "POST:/api/v1/assessment_requests/{requestId}/notes";
/* Phase 14 (D-30, D-31, D-38): a file's AI inclusion and its text preview, human Security Analyst work only. */
const ATTACHMENT_AI_OPERATIONS = [
  "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input",
  "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text",
] as const;
/* Phase 14 (D-18): the attachment list, granted to the Requestor and the human Security Analyst. */
const ATTACHMENT_LIST_OPERATION = "GET:/api/v1/assessment_requests/{requestId}/attachments";

/* Verifier W-3: the Risk and assessment updates, which the analyst service agent keeps (D-33) beside the human analyst. */
const EDIT_OPERATIONS = ["PATCH:/api/v1/risks/{riskId}", "PATCH:/api/v1/risk_assessments/{assessmentId}"] as const;

const birthrightIdentities = {
  requestor: { id: 201, documentId: "birthright-requestor", accountStatus: "active", roles: [] },
  editingAnalyst: { id: 207, documentId: "editing-analyst", accountStatus: "active", roles: [role("Security Analyst", EDIT_OPERATIONS)] },
  editingAgent: { id: 208, documentId: "editing-agent", accountStatus: "active", roles: [role("Security Analyst Agent", EDIT_OPERATIONS)] },
  inactiveEditingAnalyst: { id: 209, documentId: "inactive-editing-analyst", accountStatus: "inactive", roles: [role("Security Analyst", EDIT_OPERATIONS)] },
  // Deliberately mis-granted: an automation role holding the release grant.
  misGrantedAgent: {
    id: 202,
    documentId: "mis-granted-release-agent",
    accountStatus: "active",
    roles: [role("Security Analyst Agent", [RELEASE_ASSESSMENT])],
  },
  releasingAnalyst: {
    id: 203,
    documentId: "releasing-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", [RELEASE_ASSESSMENT])],
  },
  // A real analyst (holding an explicit review grant) who also uses the My routes.
  analyst: {
    id: 204,
    documentId: "my-route-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", ["GET:/api/v1/risk_assessments"])],
  },
  // Deliberately mis-granted: an automation role holding the five Phase 12 AI operations (IN-101).
  misGrantedAiAgent: {
    id: 205,
    documentId: "mis-granted-ai-agent",
    accountStatus: "active",
    roles: [role("Security Analyst Agent", AI_ASSISTANCE_OPERATIONS)],
  },
  aiAnalyst: {
    id: 206,
    documentId: "ai-assistance-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", AI_ASSISTANCE_OPERATIONS)],
  },
  // Deliberately mis-granted: an automation role holding the six questionnaire AI operations (Phase 15, W-9).
  misGrantedQuestionnaireAiAgent: {
    id: 230,
    documentId: "mis-granted-questionnaire-ai-agent",
    accountStatus: "active",
    roles: [role("Security Analyst Agent", QUESTIONNAIRE_AI_OPERATIONS)],
  },
  questionnaireAiAnalyst: {
    id: 231,
    documentId: "questionnaire-ai-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", QUESTIONNAIRE_AI_OPERATIONS)],
  },
  // Deliberately mis-granted: an automation role holding the request assignment operation (Phase 13, G-1).
  misGrantedAssignmentAgent: {
    id: 210,
    documentId: "mis-granted-assignment-agent",
    accountStatus: "active",
    roles: [role("Security Analyst Agent", REQUEST_ASSIGNMENT_OPERATIONS)],
  },
  assigningAnalyst: {
    id: 211,
    documentId: "assigning-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", REQUEST_ASSIGNMENT_OPERATIONS)],
  },
  // Deliberately mis-granted: an automation role holding the note AI-input mark (Phase 13, D-26, D-30).
  misGrantedNoteAiInputAgent: {
    id: 212,
    documentId: "mis-granted-note-ai-input-agent",
    accountStatus: "active",
    roles: [role("Security Analyst Agent", [NOTE_AI_INPUT_OPERATION])],
  },
  markingAnalyst: {
    id: 213,
    documentId: "note-ai-input-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", [NOTE_AI_INPUT_OPERATION])],
  },
  // WR-101: misconfigured, holding the human Security Analyst role and the Security Analyst Agent role together.
  dualRoleAnalyst: {
    id: 214,
    documentId: "dual-role-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", [REQUEST_ASSIGNEE_OPERATION, NOTE_CREATE_OPERATION, NOTE_AI_INPUT_OPERATION]), role("Security Analyst Agent", [])],
  },
  // WR-102: a human analyst holding the notes grant and the mark's own grant, and one holding the notes grant alone.
  notesAndMarkAnalyst: {
    id: 215,
    documentId: "notes-and-mark-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", [NOTE_CREATE_OPERATION, NOTE_AI_INPUT_OPERATION])],
  },
  notesOnlyAnalyst: {
    id: 216,
    documentId: "notes-only-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", [NOTE_CREATE_OPERATION])],
  },
  // Deliberately mis-granted: an automation role holding the attachment AI inclusion and preview (Phase 14, D-38).
  misGrantedAttachmentAiAgent: {
    id: 217,
    documentId: "mis-granted-attachment-ai-agent",
    accountStatus: "active",
    roles: [role("Security Analyst Agent", [ATTACHMENT_LIST_OPERATION, ...ATTACHMENT_AI_OPERATIONS])],
  },
  // Phase 14 (D-28, D-30): a human analyst holding the list and the inclusion, one holding the list alone, and the
  // misconfigured dual-role holder of WR-101.
  attachmentAiAnalyst: {
    id: 218,
    documentId: "attachment-ai-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", [ATTACHMENT_LIST_OPERATION, ...ATTACHMENT_AI_OPERATIONS])],
  },
  attachmentsOnlyAnalyst: {
    id: 219,
    documentId: "attachments-only-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", [ATTACHMENT_LIST_OPERATION])],
  },
  dualRoleAttachmentAnalyst: {
    id: 220,
    documentId: "dual-role-attachment-analyst",
    accountStatus: "active",
    roles: [role("Security Analyst", [ATTACHMENT_LIST_OPERATION, ...ATTACHMENT_AI_OPERATIONS]), role("Security Analyst Agent", [])],
  },
} as const satisfies Record<string, SeededIdentity>;

function createBirthrightStrapi(): PolicyStrapi {
  return {
    documents(uid: string) {
      if (uid === "api::identity-source.identity-source") {
        return { findMany: async () => [] };
      }
      if (uid === "api::idambox-user.idambox-user") {
        return {
          findOne: async ({ documentId }: { documentId: string }) =>
            Object.values(birthrightIdentities).find((identity) => identity.documentId === documentId) ?? null,
        };
      }
      if (uid === "api::role.role") {
        return { findMany: async () => [birthrightRole] };
      }
      throw new Error(`Unexpected Strapi document service: ${uid}`);
    },
  } as unknown as PolicyStrapi;
}

async function authorizeBirthright(identity: SeededIdentity, config: PolicyConfig) {
  const { context, forbiddenMessages } = createPolicyContext(identity);
  const allowed = await csrmAuthorization(context, config, { strapi: createBirthrightStrapi() });
  return { allowed, forbiddenMessages, decision: decisionOf(context) };
}

test("Strapi denies a Requestor holding only the birthright role every explicit analyst operation", async () => {
  for (const operation of EXPLICIT_ANALYST_OPERATIONS) {
    const result = await authorizeBirthright(birthrightIdentities.requestor, { operation });
    assert.equal(result.allowed, false, operation);
    assert.deepEqual(result.forbiddenMessages, [FUNCTION_API_DENIED], operation);
    assert.equal(result.decision, undefined, operation);
  }
  // The same identity is active and known: its birthright operations are permitted.
  const birthright = await authorizeBirthright(birthrightIdentities.requestor, {
    operation: MY_RELEASED_ASSESSMENTS,
    requireAssessmentOwnerCollectionScope: true,
  });
  assert.equal(birthright.allowed, true);
  assert.deepEqual(birthright.forbiddenMessages, []);
});

test("Strapi denies a mis-granted Security Analyst Agent the assessment release a Security Analyst with the same grant is permitted", async () => {
  const agent = await authorizeBirthright(birthrightIdentities.misGrantedAgent, { operation: RELEASE_ASSESSMENT });
  assert.equal(agent.allowed, false);
  assert.deepEqual(agent.forbiddenMessages, [RELEASE_REQUIRES_HUMAN]);
  assert.equal(agent.decision, undefined);

  const analyst = await authorizeBirthright(birthrightIdentities.releasingAnalyst, { operation: RELEASE_ASSESSMENT });
  assert.equal(analyst.allowed, true);
  assert.deepEqual(analyst.forbiddenMessages, []);
  assert.equal(analyst.decision?.assessmentRequestActor, "analyst");
});

test("Strapi scopes the My routes to the caller's own records for a Security Analyst exactly as for a Requestor", async () => {
  for (const identity of [birthrightIdentities.analyst, birthrightIdentities.requestor]) {
    const released = await authorizeBirthright(identity, {
      operation: MY_RELEASED_ASSESSMENTS,
      requireAssessmentOwnerCollectionScope: true,
    });
    assert.equal(released.allowed, true, identity.documentId);
    // The Phase 13 facts (T-13-09) come from the resolved caller: a My route is never human analyst work.
    assert.deepEqual(released.decision, {
      assessmentRequestActor: "requestor",
      humanAnalyst: false,
      eligibleHumanAnalyst: false,
      canMarkNoteAiInputs: false,
      canUseAttachmentAiInputs: false,
      viewerId: identity.id,
      assessmentOwnerCollectionScope: "own",
      assessmentOwnerDocumentId: identity.documentId,
    }, identity.documentId);

    const summary = await authorizeBirthright(identity, {
      operation: MY_REQUEST_STATUS_SUMMARY,
      requireRequestCollectionScope: true,
    });
    assert.equal(summary.allowed, true, identity.documentId);
    assert.deepEqual(summary.decision, {
      assessmentRequestActor: "requestor",
      humanAnalyst: false,
      eligibleHumanAnalyst: false,
      canMarkNoteAiInputs: false,
      canUseAttachmentAiInputs: false,
      viewerId: identity.id,
      assessmentRequestCollectionScope: "own",
      assessmentRequestRequestorId: identity.id,
    }, identity.documentId);
  }
});

/*
 * Phase 15 (W-9): an automation identity refused one of the six questionnaire AI operations is told, in their own
 * sentence, that a human Security Analyst is needed, never the questionnaire governance sentence.
 */
test("Strapi tells a mis-granted Security Analyst Agent that asking the AI about a questionnaire requires a human Security Analyst", async () => {
  for (const operation of QUESTIONNAIRE_AI_OPERATIONS) {
    const agent = await authorizeBirthright(birthrightIdentities.misGrantedQuestionnaireAiAgent, { operation });
    assert.equal(agent.allowed, false, operation);
    assert.deepEqual(agent.forbiddenMessages, ["Asking the AI about a questionnaire or deciding its proposals requires a human Security Analyst."], operation);
    const analyst = await authorizeBirthright(birthrightIdentities.questionnaireAiAnalyst, { operation });
    assert.equal(analyst.allowed, true, operation);
    assert.deepEqual(analyst.forbiddenMessages, [], operation);
  }
});

/*
 * IN-101: an automation identity refused one of the five AI operations is told that AI assistance needs a human
 * Security Analyst, not that questionnaire governance does; the same grants held by a Security Analyst pass.
 */
test("Strapi tells a mis-granted Security Analyst Agent that AI assistance requires a human Security Analyst", async () => {
  for (const operation of AI_ASSISTANCE_OPERATIONS) {
    const agent = await authorizeBirthright(birthrightIdentities.misGrantedAiAgent, { operation });
    assert.equal(agent.allowed, false, operation);
    assert.deepEqual(agent.forbiddenMessages, ["CSRM AI assistance requires a human Security Analyst."], operation);
    assert.equal(agent.decision, undefined, operation);
    const analyst = await authorizeBirthright(birthrightIdentities.aiAnalyst, { operation });
    assert.equal(analyst.allowed, true, operation);
    assert.deepEqual(analyst.forbiddenMessages, [], operation);
  }
});

/*
 * Phase 13 (G-1, D-30; IN-101's pattern): an automation identity holding the request assignment operation by mistake
 * is told that request assignment needs a human Security Analyst, never the questionnaire governance sentence; the same
 * grant held by a Security Analyst passes, with the resolved caller's facts. The eligible-analyst read (D-06) is refused
 * the same way.
 */
test("Strapi tells a mis-granted Security Analyst Agent that request assignment requires a human Security Analyst", async () => {
  for (const operation of REQUEST_ASSIGNMENT_OPERATIONS) {
    assert.ok(HUMAN_ANALYST_ONLY_OPERATIONS.has(operation), `ASSIGNMENT_OPERATION_NOT_HUMAN_ONLY_${operation}`);
    const agent = await authorizeBirthright(birthrightIdentities.misGrantedAssignmentAgent, { operation });
    assert.equal(agent.allowed, false, operation);
    assert.deepEqual(agent.forbiddenMessages, ["CSRM request assignment requires a human Security Analyst."], operation);
    assert.equal(agent.decision, undefined, operation);
    const analyst = await authorizeBirthright(birthrightIdentities.assigningAnalyst, { operation });
    assert.equal(analyst.allowed, true, operation);
    assert.deepEqual(analyst.forbiddenMessages, [], operation);
    assert.deepEqual(analyst.decision, {
      assessmentRequestActor: "analyst", humanAnalyst: true, eligibleHumanAnalyst: true, canMarkNoteAiInputs: false, canUseAttachmentAiInputs: false, viewerId: 211,
    }, operation);
  }
});

/*
 * Phase 13 (D-26, D-30; IN-101's pattern): an automation identity holding the note AI-input mark by mistake is told that
 * marking a note for the AI needs a human Security Analyst, never the questionnaire governance sentence; the same grant
 * held by a Security Analyst passes, with the resolved caller's facts.
 */
test("Strapi tells a mis-granted Security Analyst Agent that marking a note as changing the AI inputs requires a human Security Analyst", async () => {
  assert.ok(HUMAN_ANALYST_ONLY_OPERATIONS.has(NOTE_AI_INPUT_OPERATION), "NOTE_AI_INPUT_OPERATION_NOT_HUMAN_ONLY");
  const agent = await authorizeBirthright(birthrightIdentities.misGrantedNoteAiInputAgent, { operation: NOTE_AI_INPUT_OPERATION });
  assert.equal(agent.allowed, false);
  assert.deepEqual(agent.forbiddenMessages, ["Marking a note as changing the AI inputs requires a human Security Analyst."]);
  assert.equal(agent.decision, undefined);
  const analyst = await authorizeBirthright(birthrightIdentities.markingAnalyst, { operation: NOTE_AI_INPUT_OPERATION });
  assert.equal(analyst.allowed, true);
  assert.deepEqual(analyst.forbiddenMessages, []);
  assert.deepEqual(analyst.decision, {
    assessmentRequestActor: "analyst", humanAnalyst: true, eligibleHumanAnalyst: true, canMarkNoteAiInputs: true, canUseAttachmentAiInputs: false, viewerId: 213,
  });
});

/*
 * Verifier W-3 (D-21, G-1): the Risk and assessment update paths ask whether the resolved IdamBox User edits as a human
 * Security Analyst, decided as the human-analyst-only guard decides it: an active user holding the operation through the
 * human Security Analyst Role. The analyst service agent holding the same update grants is not one, nor is an analyst whose
 * Role does not grant that operation, an inactive analyst, or anything that is not a resolved identity.
 */
test("a human Security Analyst edits as one, and the analyst service agent holding the same grants does not", async () => {
  const strapi = createBirthrightStrapi() as unknown as AuthorizationStrapi;
  const editsAsHuman = (identity: unknown, operation: string) => isHumanSecurityAnalyst(strapi, identity, operation);
  for (const operation of EDIT_OPERATIONS) {
    assert.equal(await editsAsHuman({ documentId: birthrightIdentities.editingAnalyst.documentId }, operation), true, `THE_HUMAN_ANALYST_IS_NOT_HUMAN_${operation}`);
    assert.equal(await editsAsHuman({ documentId: birthrightIdentities.editingAgent.documentId }, operation), false, `THE_SERVICE_AGENT_EDITS_AS_HUMAN_${operation}`);
    assert.equal(await editsAsHuman({ documentId: birthrightIdentities.analyst.documentId }, operation), false, `AN_UNGRANTED_ANALYST_EDITS_AS_HUMAN_${operation}`);
    assert.equal(await editsAsHuman({ documentId: birthrightIdentities.inactiveEditingAnalyst.documentId }, operation), false, `AN_INACTIVE_ANALYST_EDITS_AS_HUMAN_${operation}`);
    for (const identity of [undefined, null, {}, { documentId: 207 }, "editing-analyst"]) {
      assert.equal(await editsAsHuman(identity, operation), false, `NOT_AN_IDENTITY_EDITS_AS_HUMAN_${JSON.stringify(identity)}`);
    }
  }
});

/* IN-204: the proposal decision operation (D-24) is human analyst work like the other four Phase 12 operations. */
test("Phase 12 draft generation, its job read and retry, the AI run read and the proposal decisions are human analyst work only", () => {
  for (const operation of [
    "POST:/api/v1/questionnaires/{questionnaireId}/generate_assessment",
    "GET:/api/v1/assessment_draft_jobs/{jobId}",
    "POST:/api/v1/assessment_draft_jobs/{jobId}/retry",
    "GET:/api/v1/ai_runs/{runId}",
    "POST:/api/v1/risk_assessments/{assessmentId}/ai_proposal_decisions",
  ]) assert.ok(HUMAN_ANALYST_ONLY_OPERATIONS.has(operation), `HUMAN_ANALYST_ONLY_MISSING_${operation}`);
});

/*
 * WR-101 (G-1) and WR-102 (D-26, D-30): beside `humanAnalyst`, the policy records two facts of the resolved IdamBox User.
 * `eligibleHumanAnalyst` is false for a user who also holds the Security Analyst Agent role, though the human-only guard
 * admits them; `canMarkNoteAiInputs` is the mark's own grant through the human role, held by an eligible person, so the
 * notes grant alone never sets or offers the mark.
 */
test("the policy records the eligible human analyst and the AI-input mark's own grant as facts of the resolved user (WR-101, WR-102)", async () => {
  const assignee = await authorizeBirthright(birthrightIdentities.dualRoleAnalyst, { operation: REQUEST_ASSIGNEE_OPERATION });
  assert.equal(assignee.allowed, true, "DUAL_ROLE_REFUSED_BY_THE_GRANT_CHECK");
  assert.equal(assignee.decision?.humanAnalyst, true, "DUAL_ROLE_NOT_A_HUMAN_GRANT_HOLDER");
  assert.equal(assignee.decision?.eligibleHumanAnalyst, false, "DUAL_ROLE_ELIGIBLE");
  for (const operation of [NOTE_CREATE_OPERATION, NOTE_AI_INPUT_OPERATION]) {
    const dual = await authorizeBirthright(birthrightIdentities.dualRoleAnalyst, { operation });
    assert.equal(dual.allowed, true, `DUAL_ROLE_REFUSED_${operation}`);
    assert.equal(dual.decision?.canMarkNoteAiInputs, false, `DUAL_ROLE_MAY_MARK_${operation}`);
  }

  const granted = await authorizeBirthright(birthrightIdentities.notesAndMarkAnalyst, { operation: NOTE_CREATE_OPERATION });
  assert.equal(granted.allowed, true, "NOTES_ANALYST_REFUSED");
  assert.equal(granted.decision?.eligibleHumanAnalyst, true, "NOTES_ANALYST_NOT_ELIGIBLE");
  assert.equal(granted.decision?.canMarkNoteAiInputs, true, "NOTES_ANALYST_MAY_NOT_MARK");
  const notesOnly = await authorizeBirthright(birthrightIdentities.notesOnlyAnalyst, { operation: NOTE_CREATE_OPERATION });
  assert.equal(notesOnly.allowed, true, "NOTES_ONLY_ANALYST_REFUSED");
  assert.equal(notesOnly.decision?.humanAnalyst, true, "NOTES_ONLY_ANALYST_NOT_HUMAN");
  assert.equal(notesOnly.decision?.canMarkNoteAiInputs, false, "NOTES_GRANT_ALONE_MAY_MARK");
});

/*
 * Phase 14 (D-30, D-31, D-38; IN-101's pattern): an automation identity holding the attachment AI inclusion or its
 * preview by mistake is told that choosing which attachment text the AI may read needs a human Security Analyst; the
 * same grants held by a Security Analyst pass, with the inclusion's own fact set.
 */
test("Strapi tells a mis-granted Security Analyst Agent that choosing which attachment text the AI may read requires a human Security Analyst", async () => {
  for (const operation of ATTACHMENT_AI_OPERATIONS) {
    assert.ok(HUMAN_ANALYST_ONLY_OPERATIONS.has(operation), `ATTACHMENT_AI_OPERATION_NOT_HUMAN_ONLY_${operation}`);
    const agent = await authorizeBirthright(birthrightIdentities.misGrantedAttachmentAiAgent, { operation });
    assert.equal(agent.allowed, false, operation);
    assert.deepEqual(agent.forbiddenMessages, ["Choosing which attachment text the AI may read requires a human Security Analyst."], operation);
    assert.equal(agent.decision, undefined, operation);
    const analyst = await authorizeBirthright(birthrightIdentities.attachmentAiAnalyst, { operation });
    assert.equal(analyst.allowed, true, operation);
    assert.deepEqual(analyst.decision, {
      assessmentRequestActor: "analyst", humanAnalyst: true, eligibleHumanAnalyst: true, canMarkNoteAiInputs: false, canUseAttachmentAiInputs: true, viewerId: 218,
    }, operation);
  }
});

/*
 * Phase 14 (D-28, D-30; WR-102's pattern): `canUseAttachmentAiInputs` is the inclusion's own grant through the human
 * role, held by an eligible person. The attachments grant alone never serves a file's AI facts, and a holder of the
 * Security Analyst Agent role never gets them, whatever else they hold.
 */
test("the policy records the attachment AI inclusion's own grant, held by an eligible person, as a fact of the resolved user (D-28, D-30)", async () => {
  const granted = await authorizeBirthright(birthrightIdentities.attachmentAiAnalyst, { operation: ATTACHMENT_LIST_OPERATION });
  assert.equal(granted.allowed, true, "ATTACHMENT_AI_ANALYST_REFUSED");
  assert.equal(granted.decision?.canUseAttachmentAiInputs, true, "ATTACHMENT_AI_ANALYST_HAS_NO_AI_FACT");
  const listOnly = await authorizeBirthright(birthrightIdentities.attachmentsOnlyAnalyst, { operation: ATTACHMENT_LIST_OPERATION });
  assert.equal(listOnly.allowed, true, "ATTACHMENTS_ONLY_ANALYST_REFUSED");
  assert.equal(listOnly.decision?.humanAnalyst, true, "ATTACHMENTS_ONLY_ANALYST_NOT_HUMAN");
  assert.equal(listOnly.decision?.canUseAttachmentAiInputs, false, "ATTACHMENTS_GRANT_ALONE_SERVES_AI_FACTS");
  for (const operation of [ATTACHMENT_LIST_OPERATION, ...ATTACHMENT_AI_OPERATIONS]) {
    const dual = await authorizeBirthright(birthrightIdentities.dualRoleAttachmentAnalyst, { operation });
    assert.equal(dual.allowed, true, `DUAL_ROLE_REFUSED_${operation}`);
    assert.equal(dual.decision?.canUseAttachmentAiInputs, false, `DUAL_ROLE_MAY_INCLUDE_${operation}`);
  }
});

/*
 * Phase 19 (D-13; G-1; 19-PLAN-CHECK lane A W1, lane B W5): the exports. The service identity (a caller isEligiblePerson
 * rejects: the holder of the Security Analyst Agent role) is refused every SERVICE_IDENTITY_REFUSED_OPERATIONS member,
 * whatever it holds, its Requestor birthright included, in the exports' own sentence; a human holding a human-only export
 * other than through the Security Analyst role is told an analyst export needs a human Security Analyst; and an export
 * also needs its list read through the path that admitted it. Each case iterates the exported set, so every member a
 * later plan adds is covered.
 */
const EXPORT_REFUSED_TO_AUTOMATION = "CSRM exports are refused to automation identities.";
const ANALYST_EXPORT_REQUIRES_HUMAN = "CSRM analyst exports require a human Security Analyst.";
const EXPORT_REQUIRES_LIST_READ = "CSRM export requires the list read.";
const QUESTIONNAIRE_GOVERNANCE_REQUIRES_HUMAN = "CSRM questionnaire governance requires a human Security Analyst.";
const REGISTER_EXPORT = "GET:/api/v1/risks/export?format={format}";
const REGISTER_READ = "GET:/api/v1/risks";

/** A fake Strapi resolving `identities` by documentId, whose Requestor birthright role holds `requestorUrls`. */
function exportPolicyStrapi(identities: readonly SeededIdentity[], requestorUrls: readonly string[]): PolicyStrapi {
  return {
    documents(uid: string) {
      if (uid === "api::identity-source.identity-source") return { findMany: async () => [] };
      if (uid === "api::idambox-user.idambox-user") {
        return { findOne: async ({ documentId }: { documentId: string }) => identities.find((identity) => identity.documentId === documentId) ?? null };
      }
      if (uid === "api::role.role") return { findMany: async () => [role("Requestor", requestorUrls)] };
      throw new Error(`Unexpected Strapi document service: ${uid}`);
    },
  } as unknown as PolicyStrapi;
}

async function authorizeExport(identity: SeededIdentity, config: PolicyConfig, requestorUrls: readonly string[] = []) {
  const { context, forbiddenMessages } = createPolicyContext(identity);
  const allowed = await csrmAuthorization(context, config, { strapi: exportPolicyStrapi([identity], requestorUrls) });
  return { allowed, forbiddenMessages, decision: decisionOf(context) };
}

test("Strapi tells the service identity that CSRM exports are refused to automation identities, through its agent grant or the Requestor birthright", async () => {
  assert.ok(SERVICE_IDENTITY_REFUSED_OPERATIONS.has(REGISTER_EXPORT), "REGISTER_EXPORT_NOT_REFUSED_TO_THE_SERVICE_IDENTITY");
  for (const operation of SERVICE_IDENTITY_REFUSED_OPERATIONS) {
    const throughAgentRole: SeededIdentity = {
      id: 240, documentId: "export-agent", accountStatus: "active", roles: [role("Security Analyst Agent", [operation, REGISTER_READ])],
    };
    const throughBirthright: SeededIdentity = {
      id: 241, documentId: "export-birthright-agent", accountStatus: "active", roles: [role("Security Analyst Agent", [])],
    };
    const cases: ReadonlyArray<readonly [string, SeededIdentity, readonly string[]]> = [
      ["AGENT_ROLE", throughAgentRole, []],
      ["BIRTHRIGHT", throughBirthright, [operation, REGISTER_READ]],
    ];
    for (const [label, identity, requestorUrls] of cases) {
      const result = await authorizeExport(identity, { operation, underlyingRead: REGISTER_READ }, requestorUrls);
      assert.equal(result.allowed, false, `${label}_${operation}`);
      assert.deepEqual(result.forbiddenMessages, [EXPORT_REFUSED_TO_AUTOMATION], `${label}_${operation}`);
      assert.equal(result.decision, undefined, `${label}_${operation}`);
      assert.ok(!result.forbiddenMessages.includes(QUESTIONNAIRE_GOVERNANCE_REQUIRES_HUMAN), `${label}_GOVERNANCE_WORDING_${operation}`);
    }
  }
});

test("Strapi tells a human holding an export outside the Security Analyst role that analyst exports require a human Security Analyst", async () => {
  let checked = 0;
  for (const operation of SERVICE_IDENTITY_REFUSED_OPERATIONS) {
    if (!HUMAN_ANALYST_ONLY_OPERATIONS.has(operation)) continue;
    checked += 1;
    const viewer: SeededIdentity = { id: 242, documentId: "export-viewer", accountStatus: "active", roles: [role("Risk Viewer", [operation, REGISTER_READ])] };
    const result = await authorizeExport(viewer, { operation });
    assert.equal(result.allowed, false, operation);
    assert.deepEqual(result.forbiddenMessages, [ANALYST_EXPORT_REQUIRES_HUMAN], operation);
    assert.ok(!result.forbiddenMessages.includes(QUESTIONNAIRE_GOVERNANCE_REQUIRES_HUMAN), `GOVERNANCE_WORDING_${operation}`);
    // The same refusal reaches a human Requestor holding it only through the birthright.
    const requestor: SeededIdentity = { id: 243, documentId: "export-requestor", accountStatus: "active", roles: [] };
    const birthright = await authorizeExport(requestor, { operation }, [operation, REGISTER_READ]);
    assert.deepEqual(birthright.forbiddenMessages, [ANALYST_EXPORT_REQUIRES_HUMAN], `BIRTHRIGHT_${operation}`);
  }
  assert.ok(checked >= 1, "NO_HUMAN_ONLY_EXPORT_CHECKED");
});

test("Strapi admits a human Security Analyst to the register export only with the register read as well, and leaves other agent operations alone", async () => {
  const config = { operation: REGISTER_EXPORT, requireAnalystRiskRegisterScope: true, underlyingRead: REGISTER_READ };
  const exportOnly: SeededIdentity = { id: 244, documentId: "export-only-analyst", accountStatus: "active", roles: [role("Security Analyst", [REGISTER_EXPORT])] };
  const denied = await authorizeExport(exportOnly, config);
  assert.equal(denied.allowed, false, "EXPORT_WITHOUT_LIST_READ_ADMITTED");
  assert.deepEqual(denied.forbiddenMessages, [EXPORT_REQUIRES_LIST_READ]);
  assert.equal(denied.decision, undefined);

  // The read through the birthright does not count for an export admitted through the analyst role.
  const birthrightRead = await authorizeExport(exportOnly, config, [REGISTER_READ]);
  assert.deepEqual(birthrightRead.forbiddenMessages, [EXPORT_REQUIRES_LIST_READ], "BIRTHRIGHT_READ_WIDENED_AN_ANALYST_EXPORT");

  const both: SeededIdentity = { id: 245, documentId: "export-analyst", accountStatus: "active", roles: [role("Security Analyst", [REGISTER_EXPORT, REGISTER_READ])] };
  const admitted = await authorizeExport(both, config);
  assert.equal(admitted.allowed, true);
  assert.deepEqual(admitted.forbiddenMessages, []);
  assert.equal(admitted.decision?.riskRegisterCollectionScope, "all");
  assert.equal(admitted.decision?.humanAnalyst, true);

  // An operation outside the refusal set is unaffected for the agent: it keeps the edits it holds (D-33).
  for (const operation of EDIT_OPERATIONS) {
    assert.equal(SERVICE_IDENTITY_REFUSED_OPERATIONS.has(operation), false, operation);
    const agent = await authorizeBirthright(birthrightIdentities.editingAgent, { operation });
    assert.equal(agent.allowed, true, `AGENT_EDIT_REFUSED_${operation}`);
    assert.deepEqual(agent.forbiddenMessages, [], operation);
  }
});

/** The csrm-authorization config a route carries, read from the router file itself. */
function routePolicyConfig(routes: { routes: readonly unknown[] }, method: string, routePath: string): PolicyConfig {
  const route = routes.routes.find((candidate) => {
    const value = candidate as { method?: string; path?: string };
    return value.method === method && value.path === routePath;
  }) as { config?: { policies?: readonly unknown[] } } | undefined;
  assert.ok(route, `ROUTE_NOT_FOUND_${method}_${routePath}`);
  const policy = (route.config?.policies ?? []).find((entry) => (entry as { name?: string }).name === "global::csrm-authorization") as { config?: PolicyConfig } | undefined;
  assert.ok(policy?.config, `ROUTE_HAS_NO_AUTHORIZATION_CONFIG_${method}_${routePath}`);
  return policy.config;
}

const RELEASED_EXPORT = "GET:/api/v1/risk_assessments/{assessmentId}/export";
const RELEASED_READS = [
  "GET:/api/v1/risk_assessments/{assessmentId}",
  "GET:/api/v1/risk_assessments/{assessmentId}/risks",
  "GET:/api/v1/risks/{riskId}/control_implementations",
] as const;

test("the released export requires all three released reads it discloses, through the path that admitted it (BE2-01)", async () => {
  const config = routePolicyConfig(assessmentRoutes as unknown as { routes: readonly unknown[] }, "GET", "/v1/risk_assessments/:assessmentId/export");
  assert.equal(config.operation, RELEASED_EXPORT);
  const requestor: SeededIdentity = { id: 250, documentId: "released-requestor", accountStatus: "active", roles: [] };
  for (const missing of RELEASED_READS) {
    const held = RELEASED_READS.filter((read) => read !== missing);
    const refused = await authorizeExport(requestor, config, [RELEASED_EXPORT, ...held]);
    assert.equal(refused.allowed, false, `REQUESTOR_ADMITTED_WITHOUT_${missing}`);
    assert.deepEqual(refused.forbiddenMessages, [EXPORT_REQUIRES_LIST_READ], missing);
    const analyst: SeededIdentity = { id: 251, documentId: "released-analyst", accountStatus: "active", roles: [role("Security Analyst", [RELEASED_EXPORT, ...held])] };
    const analystRefused = await authorizeExport(analyst, config);
    assert.equal(analystRefused.allowed, false, `ANALYST_ADMITTED_WITHOUT_${missing}`);
    assert.deepEqual(analystRefused.forbiddenMessages, [EXPORT_REQUIRES_LIST_READ], `ANALYST_${missing}`);
  }
  const admitted = await authorizeExport(requestor, config, [RELEASED_EXPORT, ...RELEASED_READS]);
  assert.equal(admitted.allowed, true, "REQUESTOR_WITH_ALL_THREE_READS_REFUSED");
  const analyst: SeededIdentity = { id: 252, documentId: "released-analyst-all", accountStatus: "active", roles: [role("Security Analyst", [RELEASED_EXPORT, ...RELEASED_READS])] };
  assert.equal((await authorizeExport(analyst, config)).allowed, true, "ANALYST_WITH_ALL_THREE_READS_REFUSED");
});

test("the human-only refusal words an operation as an export only when it is a human-only export, whatever else refuses the service identity (BE2-06)", async () => {
  // Phases 17 and 19.1 add non-export members to the service-identity refusal set; one such member that is also
  // human-only must keep its own wording. A human-only, non-export operation stands in for it here.
  const operation = "POST:/api/v1/questionnaires/{questionnaireId}/release";
  assert.ok(HUMAN_ANALYST_ONLY_OPERATIONS.has(operation));
  const refusedSet = SERVICE_IDENTITY_REFUSED_OPERATIONS as Set<string>;
  assert.equal(refusedSet.has(operation), false);
  refusedSet.add(operation);
  try {
    const viewer: SeededIdentity = { id: 253, documentId: "release-viewer", accountStatus: "active", roles: [role("Risk Viewer", [operation])] };
    const result = await authorizeExport(viewer, { operation });
    assert.equal(result.allowed, false);
    assert.deepEqual(result.forbiddenMessages, [QUESTIONNAIRE_GOVERNANCE_REQUIRES_HUMAN], "A_NON_EXPORT_MEMBER_WAS_REFUSED_IN_THE_EXPORTS_WORDS");
  } finally {
    refusedSet.delete(operation);
  }
});

test("each Requestor-reachable export refuses a birthright that holds the export but not its list read (BE2-02)", async () => {
  const cases: ReadonlyArray<readonly [label: string, routes: { routes: readonly unknown[] }, path: string]> = [
    ["MY_REQUESTS", myRequestsRoutes as unknown as { routes: readonly unknown[] }, "/v1/my_requests/export"],
    ["MY_QUESTIONNAIRES", questionnaireRoutes as unknown as { routes: readonly unknown[] }, "/v1/my_questionnaires/export"],
    ["MY_RISK_ASSESSMENTS", assessmentRoutes as unknown as { routes: readonly unknown[] }, "/v1/my_risk_assessments/export"],
    ["RELEASED_ASSESSMENT", assessmentRoutes as unknown as { routes: readonly unknown[] }, "/v1/risk_assessments/:assessmentId/export"],
  ];
  for (const [label, routes, routePath] of cases) {
    const config = routePolicyConfig(routes, "GET", routePath);
    assert.equal(typeof config.underlyingRead, "string", `${label}_NAMES_NO_LIST_READ`);
    const reads = [config.underlyingRead as string, ...(config.additionalUnderlyingReads ?? [])];
    const requestor: SeededIdentity = { id: 254, documentId: `birthright-${label.toLowerCase()}`, accountStatus: "active", roles: [] };
    const exportOnly = await authorizeExport(requestor, config, [config.operation]);
    assert.equal(exportOnly.allowed, false, `${label}_ADMITTED_WITHOUT_ITS_READ`);
    assert.deepEqual(exportOnly.forbiddenMessages, [EXPORT_REQUIRES_LIST_READ], label);
    // The read through the birthright (or an explicit role) satisfies the rule; any later refusal is the list's scope.
    const explicit: SeededIdentity = { ...requestor, roles: [role("Risk Viewer", reads)] };
    const paths: ReadonlyArray<readonly [string, SeededIdentity, readonly string[]]> = [
      ["BIRTHRIGHT", requestor, [config.operation, ...reads]],
      ["EXPLICIT", explicit, [config.operation]],
    ];
    for (const [path, identity, birthright] of paths) {
      const withRead = await authorizeExport(identity, config, birthright);
      assert.ok(!withRead.forbiddenMessages.includes(EXPORT_REQUIRES_LIST_READ), `${label}_${path}_READ_NOT_COUNTED`);
    }
  }
});
