// Fast direct-policy unit coverage; mounted HTTP coverage is in authorization.integration.test.ts.
const assert = require("node:assert/strict");
const test = require("node:test");

const authorizationPolicy = require("../dist/src/policies/csrm-authorization.js").default;
const {
  applyAssessmentRequestCollectionScope,
} = require("../dist/src/api/csrm-assessment-request/services/collection-scope.js");
const {
  applyTrustedRequestorOwnership,
} = require("../dist/src/api/csrm-assessment-request/request-ownership.js");
const {
  CSRM_ASSESSMENT_REQUEST_OPERATIONS,
} = require("../dist/src/api/csrm-assessment-request/operations.js");
const {
  authorizationIdentities,
  createAuthorizationStrapi,
  createPolicyContext,
  FUNCTION_API_OPERATIONS,
  restrictedAssessmentRequest,
} = require("../dist/tests/fixtures/authorization.js");

test("Strapi denies a Requestor an ungranted FunctionAPI operation", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.requestor,
  );

  const allowed = await authorizationPolicy(
    context,
    { operation: FUNCTION_API_OPERATIONS.deleteAssessmentRequest },
    { strapi: createAuthorizationStrapi() },
  );

  assert.equal(allowed, false);
  assert.deepEqual(forbiddenMessages, ["CSRM FunctionAPI access is denied."]);
});

test("Strapi permits an explicitly assigned Security Analyst FunctionAPI operation", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.securityAnalyst,
  );

  const allowed = await authorizationPolicy(
    context,
    { operation: FUNCTION_API_OPERATIONS.listAssessmentRequests },
    { strapi: createAuthorizationStrapi() },
  );

  assert.equal(allowed, true);
  assert.deepEqual(forbiddenMessages, []);
});

test("Strapi denies a URL-substituted restricted assessment request", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.requestor,
    restrictedAssessmentRequest.documentId,
  );

  const allowed = await authorizationPolicy(
    context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestOwnership: true,
    },
    { strapi: createAuthorizationStrapi() },
  );

  assert.equal(allowed, false);
  assert.deepEqual(forbiddenMessages, ["CSRM assessment request access is denied."]);
});

test("Strapi permits an active Requestor only on their own assessment request", async () => {
  const ownedRequest = {
    documentId: "assessment-request-owned-by-jane",
    requestor: { documentId: authorizationIdentities.requestor.documentId },
  };
  const strapi = createAuthorizationStrapi({ assessmentRequests: [ownedRequest] });
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.requestor,
    ownedRequest.documentId,
  );

  const allowed = await authorizationPolicy(
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

  const allowed = await authorizationPolicy(
    context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestOwnership: true,
    },
    { strapi: createAuthorizationStrapi() },
  );

  assert.equal(allowed, false);
  assert.deepEqual(forbiddenMessages, ["CSRM assessment request access is denied."]);
});

test("Strapi denies an inactive IdamBox User before evaluating grants", async () => {
  const { context, forbiddenMessages } = createPolicyContext(
    authorizationIdentities.inactiveSecurityAnalyst,
    restrictedAssessmentRequest.documentId,
  );

  const allowed = await authorizationPolicy(
    context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestOwnership: true,
    },
    { strapi: createAuthorizationStrapi() },
  );

  assert.equal(allowed, false);
  assert.deepEqual(forbiddenMessages, ["CSRM FunctionAPI access is denied."]);
});

test("Strapi emits trusted owner collection scope for every authorised My-route actor", async () => {
  const analyst = createPolicyContext(authorizationIdentities.securityAnalyst);
  const analystAllowed = await authorizationPolicy(
    analyst.context,
    {
      operation: FUNCTION_API_OPERATIONS.listAssessmentRequests,
      requireRequestCollectionScope: true,
    },
    { strapi: createAuthorizationStrapi() },
  );
  assert.equal(analystAllowed, true);
  assert.equal(
    analyst.context.state.csrmAuthorization.assessmentRequestCollectionScope,
    "own",
  );

  const requestor = createPolicyContext(authorizationIdentities.requestor);
  const requestorAllowed = await authorizationPolicy(
    requestor.context,
    {
      operation: FUNCTION_API_OPERATIONS.getAssessmentRequest,
      requireRequestCollectionScope: true,
    },
    { strapi: createAuthorizationStrapi() },
  );
  assert.equal(requestorAllowed, true);
  assert.equal(
    requestor.context.state.csrmAuthorization.assessmentRequestCollectionScope,
    "own",
  );
});

test("Strapi scopes the Security Analyst Agent to its own requests on the My route", async () => {
  // The agent carries the same Function grants as the human analyst, so the
  // owner-scoping change tightens it from "all" to "own" as well. Without this
  // assertion an accidental widening for automation would pass unnoticed.
  const agent = createPolicyContext(authorizationIdentities.securityAnalystAgent);
  const allowed = await authorizationPolicy(
    agent.context,
    {
      operation: FUNCTION_API_OPERATIONS.listAssessmentRequests,
      requireRequestCollectionScope: true,
    },
    { strapi: createAuthorizationStrapi() },
  );

  assert.equal(allowed, true);
  assert.equal(agent.context.state.csrmAuthorization.assessmentRequestCollectionScope, "own");
  assert.equal(
    agent.context.state.csrmAuthorization.assessmentRequestRequestorId,
    authorizationIdentities.securityAnalystAgent.id,
  );
});

test("Strapi records an explicit assessment owner collection decision independently of analyst actor facts", async () => {
  const analyst = createPolicyContext(authorizationIdentities.securityAnalyst);
  const allowed = await authorizationPolicy(
    analyst.context,
    {
      operation: FUNCTION_API_OPERATIONS.listAssessmentRequests,
      requireAssessmentOwnerCollectionScope: true,
    },
    { strapi: createAuthorizationStrapi() },
  );

  assert.equal(allowed, true);
  assert.equal(analyst.context.state.csrmAuthorization.assessmentRequestActor, "analyst");
  assert.equal(analyst.context.state.csrmAuthorization.assessmentOwnerCollectionScope, "own");
  assert.equal(analyst.context.state.csrmAuthorization.assessmentOwnerDocumentId, authorizationIdentities.securityAnalyst.documentId);
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
  assert.throws(
    () => applyAssessmentRequestCollectionScope({}, {}),
    /collection scope is denied/,
  );
  assert.throws(
    () =>
      applyAssessmentRequestCollectionScope({}, {
        idamboxUser: { documentId: authorizationIdentities.requestor.documentId },
        csrmAuthorization: { assessmentRequestCollectionScope: "all-users" },
      }),
    /collection scope is denied/,
  );
});

test("Strapi overwrites a forged Requestor relation with trusted server identity", () => {
  const context = {
    state: {
      idamboxUser: { documentId: authorizationIdentities.requestor.documentId },
    },
    request: {
      body: {
        data: {
          requestor: restrictedAssessmentRequest.requestor.documentId,
          title: "Request a risk assessment",
        },
      },
    },
  };

  applyTrustedRequestorOwnership(context);

  assert.deepEqual(context.request.body.data, {
    requestor: authorizationIdentities.requestor.documentId,
    title: "Request a risk assessment",
  });
});

test("Strapi refuses assessment-request creation without a trusted IdamBox identity", () => {
  assert.throws(
    () => applyTrustedRequestorOwnership({ request: { body: { data: {} } }, state: {} }),
    /ownership is denied/,
  );
});

test("Strapi uses five canonical FunctionAPI identifiers for its served assessment-request routes", () => {
  assert.deepEqual(CSRM_ASSESSMENT_REQUEST_OPERATIONS, {
    find: "GET:/api/csrm-assessment-requests",
    create: "POST:/api/csrm-assessment-requests",
    findOne: "GET:/api/csrm-assessment-requests/{id}",
    update: "PUT:/api/csrm-assessment-requests/{id}",
    delete: "DELETE:/api/csrm-assessment-requests/{id}",
  });
  assert.equal(
    CSRM_ASSESSMENT_REQUEST_OPERATIONS.delete,
    "DELETE:/api/csrm-assessment-requests/{id}",
  );
});
