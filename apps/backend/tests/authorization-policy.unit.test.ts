import assert from "node:assert/strict";
import test from "node:test";

import csrmAuthorization from "../src/policies/csrm-authorization";
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

const birthrightIdentities = {
  requestor: { id: 201, documentId: "birthright-requestor", accountStatus: "active", roles: [] },
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
} as const satisfies Record<string, SeededIdentity>;

function createBirthrightStrapi(): PolicyStrapi {
  return {
    documents(uid: string) {
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
    assert.deepEqual(released.decision, {
      assessmentRequestActor: "requestor",
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
      assessmentRequestCollectionScope: "own",
      assessmentRequestRequestorId: identity.id,
    }, identity.documentId);
  }
});
