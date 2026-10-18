import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import catalogue from "../src/bootstrap/idambox-csrm-role-function-api-catalogue.json";
import { CSRM_ADMINISTRATION_OPERATIONS } from "../src/api/csrm-administration/operations";
import administrationRoutes from "../src/api/csrm-administration/routes/csrm-administration";
import { CSRM_ASSESSMENT_REQUEST_OPERATIONS } from "../src/api/csrm-assessment-request/operations";
import riskRoutes from "../src/api/csrm-risk/routes/csrm-risk";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

// This test is emitted to `.tmp/tests-dist/tests`, so three parents resolve
// the Strapi app root without depending on the process working directory.
const appDir = path.resolve(__dirname, "..", "..", "..");
const catalogueFilename = "idambox-csrm-role-function-api-catalogue.json";

async function request(path: string, identity?: string, init: RequestInit = {}) {
  const harness = await harnessPromise;
  return harness.request({ path, identity, init });
}

function documentIds(payload: unknown): string[] {
  assert.equal(typeof payload, "object");
  assert.ok(payload !== null);
  const data = (payload as { data?: unknown }).data;
  assert.ok(Array.isArray(data));
  return data.map((item) => (item as { documentId: string }).documentId).sort();
}

test("PHASE2 RED development identity bridge", async () => {
  const harness = await harnessPromise;
  const endpoint = `/api/csrm-assessment-requests/${harness.requests.owner}`;
  const requestAsDevelopmentIdentity = (email?: string) => harness.request({
    path: endpoint,
    init: { headers: email ? { "x-csrm-dev-identity": email } : {} },
  });

  const enabledJane = await harness.withDevelopmentEnvironment("development", "development", "true", () =>
    requestAsDevelopmentIdentity(harness.developmentEmails.jane));
  const enabledBob = await harness.withDevelopmentEnvironment("development", "development", "true", () =>
    requestAsDevelopmentIdentity(harness.developmentEmails.bob));
  assert.equal(enabledJane.status, 200, "UNEXPECTED_ENABLED_JANE_STATUS");
  assert.equal(enabledBob.status, 200, "UNEXPECTED_ENABLED_BOB_STATUS");

  const rejectedCases = [
    ["missing header", "development", "development", "true", undefined],
    ["unknown email", "development", "development", "true", harness.developmentEmails.unknown],
    ["inactive identity", "development", "development", "true", harness.developmentEmails.inactive],
    ["missing flag", "development", "development", undefined, harness.developmentEmails.jane],
    ["false flag", "development", "development", "false", harness.developmentEmails.jane],
    ["missing marker", "development", undefined, "true", harness.developmentEmails.jane],
    ["mismatched marker", "development", "production", "true", harness.developmentEmails.jane],
    ["non-development runtime", "production", "development", "true", harness.developmentEmails.jane],
    ["missing runtime", undefined, "development", "true", harness.developmentEmails.jane],
  ] as const;
  for (const [name, nodeEnv, environment, flag, email] of rejectedCases) {
    const response = await harness.withDevelopmentEnvironment(nodeEnv, environment, flag, () => requestAsDevelopmentIdentity(email));
    const diagnosticName = name.toUpperCase().replace(/ /g, "_");
    assert.equal(response.status, 403, `UNEXPECTED_${diagnosticName}_STATUS`);
    if (email) {
      assert.equal(harness.getObservedDevelopmentIdentity(email), undefined, `UNEXPECTED_${diagnosticName}_IDENTITY`);
    }
  }
});

test("historical development public permissions are deleted idempotently", async () => {
  const harness = await harnessPromise;
  const unrelatedAction = "plugin::users-permissions.auth.callback";
  const expectedActions = [
    ...harness.developmentPermissionActions,
    "api::csrm-questionnaire.csrm-questionnaire.saveAnswers",
    "api::csrm-questionnaire.csrm-questionnaire.submitQuestionnaire",
    "api::csrm-questionnaire.csrm-questionnaire.generateAssessment",
    "api::csrm-assessment.csrm-assessment.statusSummary",
    "api::csrm-assessment.csrm-assessment.listAssessments",
    "api::csrm-assessment.csrm-assessment.updateAssessment",
    "api::csrm-assessment.csrm-assessment.getAssessment",
    "api::csrm-assessment.csrm-assessment.releaseAssessment",
    "api::csrm-assessment.csrm-assessment.listMyReleasedAssessments",
    "api::csrm-assessment.csrm-assessment.myRatingSummary",
    "api::csrm-assessment.csrm-assessment.listAssessmentRisks",
    "api::csrm-assessment.csrm-assessment.listRiskControlImplementations",
    "api::csrm-assessment.csrm-assessment.getDraftJob",
    "api::csrm-assessment.csrm-assessment.retryDraftJob",
    "api::csrm-risk.csrm-risk.createAssessmentRisk",
    "api::csrm-risk.csrm-risk.updateRisk",
    "api::csrm-risk.csrm-risk.listRiskTypes",
    "api::csrm-risk.csrm-risk.listControls",
    "api::csrm-risk.csrm-risk.searchActiveUsers",
    "api::csrm-control-implementation.csrm-control-implementation.createRiskControlImplementation",
    "api::csrm-control-implementation.csrm-control-implementation.updateControlImplementation",
    "api::csrm-control-implementation.csrm-control-implementation.deleteControlImplementation",
  ] as const;
  await harness.ensurePublicPermission(unrelatedAction);

  for (const action of expectedActions) await harness.ensurePublicPermission(action);
  const declaredActions = await harness.withDevelopmentEnvironment("development", "development", "true", () =>
    harness.reconcileDevelopmentPermissions());
  assert.deepEqual([...declaredActions].sort(), [...expectedActions].sort(), "UNEXPECTED_DECLARED_PERMISSION_ALLOWLIST");
  const actionsAfterFirstReconciliation = await harness.getPublicPermissionActions();
  assert.equal(actionsAfterFirstReconciliation.includes(unrelatedAction), true, "UNEXPECTED_UNRELATED_PERMISSION_REMOVAL");
  assert.deepEqual(actionsAfterFirstReconciliation.filter((action) => (expectedActions as readonly string[]).includes(action)), []);

  for (const [nodeEnv, environment, flag] of [
    ["development", undefined, "true"],
    ["development", "development", "false"],
    ["production", "development", "true"],
  ] as const) {
    await harness.withDevelopmentEnvironment(nodeEnv, environment, flag, () => harness.reconcileDevelopmentPermissions());
    assert.deepEqual(await harness.getPublicPermissionActions(), actionsAfterFirstReconciliation, "UNEXPECTED_NON_IDEMPOTENT_PERMISSION_REMOVAL");
  }
});

test("deterministic development API token seed is triple-gated, hashed, and idempotent", async () => {
  const harness = await harnessPromise;
  const previousToken = process.env.CSRM_DEV_API_TOKEN;
  const testAccessKey = "isolated-development-api-credential";
  try {
    await harness.clearDevelopmentApiTokens();
    process.env.CSRM_DEV_API_TOKEN = testAccessKey;
    for (const [nodeEnv, environment, flag] of [
      ["production", "development", "true"],
      ["development", "local", "true"],
      ["development", "development", "false"],
    ] as const) {
      await harness.withDevelopmentEnvironment(nodeEnv, environment, flag, () => harness.seedDevelopmentApiToken());
      assert.equal((await harness.getDevelopmentApiTokens()).length, 0);
    }

    await harness.withDevelopmentEnvironment("development", "development", "true", () => harness.seedDevelopmentApiToken());
    await harness.withDevelopmentEnvironment("development", "development", "true", () => harness.seedDevelopmentApiToken());
    const tokens = await harness.getDevelopmentApiTokens();
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0]?.kind, "content-api");
    assert.equal(tokens[0]?.type, "full-access");
    assert.equal(tokens[0]?.lifespan, null);
    assert.equal(tokens[0]?.expiresAt, null);
    assert.equal(tokens[0]?.encryptedKey, null);
    assert.equal(tokens[0]?.accessKey, harness.hashApiToken(testAccessKey));
    assert.notEqual(tokens[0]?.accessKey, testAccessKey);
  } finally {
    if (previousToken === undefined) delete process.env.CSRM_DEV_API_TOKEN;
    else process.env.CSRM_DEV_API_TOKEN = previousToken;
  }
});

test("stale generic Administration detail, mutation, and delete routes are absent without persistence disclosure", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAdministrationFixtures();
  const resources = [
    {
      kind: "risk-types" as const,
      base: "/api/csrm-risk-types",
      documentId: fixtures.riskTypes.update,
    },
    {
      kind: "controls" as const,
      base: "/api/csrm-controls",
      documentId: fixtures.controls.update,
    },
    {
      kind: "information-systems" as const,
      base: "/api/csrm-information-systems",
      documentId: fixtures.informationSystems.update,
    },
    {
      kind: "information-assets" as const,
      base: "/api/csrm-information-assets",
      documentId: fixtures.informationAssets.update,
    },
  ] as const;

  for (const resource of resources) {
    const countBefore = await harness.countAdministrationRecords(resource.kind);
    const recordBefore = await harness.getAdministrationRecord(resource.kind, resource.documentId);
    assert.ok(recordBefore, `NON_TAUTOLOGICAL_FIXTURE_MISSING_${resource.kind}`);
    const cases = [
      [`${resource.base}/${resource.documentId}`, { method: "GET" }],
      [resource.base, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { name: "Stale create" } }) }],
      [`${resource.base}/${resource.documentId}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { name: "Stale update" } }) }],
      [`${resource.base}/${resource.documentId}`, { method: "DELETE" }],
    ] as const;
    for (const [url, init] of cases) {
      const response = await request(url, harness.identities.analyst, init);
      assert.ok([404, 405].includes(response.status), `STALE_GENERIC_ROUTE_${init.method}_${url}_${response.status}`);
      assert.equal(await harness.countAdministrationRecords(resource.kind), countBefore);
      assert.deepEqual(await harness.getAdministrationRecord(resource.kind, resource.documentId), recordBefore);
    }
  }

  // D-44: the generic reference-data reads are unmounted as well; the served
  // /v1/information_* selectors are the only read surface for every actor.
  for (const base of ["/api/csrm-information-systems", "/api/csrm-information-assets"]) {
    assert.equal((await request(base, harness.identities.owner)).status, 404, `GENERIC_REFERENCE_READ_STILL_MOUNTED_${base}`);
  }
});

test("catalogue provides exactly one API-only grant for every served operation", () => {
  const authoritativeBytes = readFileSync(path.resolve(appDir, "..", "..", "docs", "references", catalogueFilename));
  const bootstrapBytes = readFileSync(path.resolve(appDir, "src", "bootstrap", catalogueFilename));
  assert.equal(Buffer.compare(authoritativeBytes, bootstrapBytes), 0, "catalogue copies must be byte-identical");

  const coreFunctionId = "function.risk_assessment_requests.core_api";
  const deleteFunctionId = "function.risk_assessment_requests.delete_api";
  // Reversal is a separate grant from ordinary request writes so that it can be
  // withdrawn without withdrawing create/update, and so an analyst agent never
  // inherits it from the core API grant.
  const revertFunctionId = "function.risk_assessment_requests.revert_to_draft_api";
  const core = catalogue.functions.find((entry) => entry.id === "function.risk_assessment_requests.core_api");
  assert.ok(core);
  assert.equal("menuPath" in core, false);
  // Phase 12 D-33 (R-08-42): the service agent holds neither request grant.
  assert.deepEqual([...core.roleIds].sort(), ["role.requestor", "role.security_analyst"]);
  assert.deepEqual(core.functionApiIds, [
    "function.risk_assessment_requests.core_api.api.01",
    "function.risk_assessment_requests.core_api.api.02",
    "function.risk_assessment_requests.core_api.api.03",
    "function.risk_assessment_requests.core_api.api.04",
  ], "RED_EXPECTED_CATALOGUE_REQUESTOR_DELETE_OVERGRANT");

  const deleteFunction = catalogue.functions.find((entry) => entry.id === deleteFunctionId);
  assert.ok(deleteFunction);
  assert.equal("menuPath" in deleteFunction, false);
  assert.deepEqual([...deleteFunction.roleIds].sort(), ["role.security_analyst"]);
  assert.deepEqual(deleteFunction.functionApiIds, ["function.risk_assessment_requests.delete_api.api.01"]);

  const requestor = catalogue.roles.find((entry) => entry.id === "role.requestor");
  const analyst = catalogue.roles.find((entry) => entry.id === "role.security_analyst");
  const analystAgent = catalogue.roles.find((entry) => entry.id === "role.security_analyst_agent");
  assert.ok(requestor && analyst && analystAgent);
  assert.equal(requestor.functionIds.includes(coreFunctionId), true);
  assert.equal(requestor.functionIds.includes(deleteFunctionId), false);
  assert.equal(analyst.functionIds.includes(coreFunctionId), true);
  assert.equal(analyst.functionIds.includes(deleteFunctionId), true);
  assert.equal(analystAgent.functionIds.includes(coreFunctionId), false);
  assert.equal(analystAgent.functionIds.includes(deleteFunctionId), false);
  // REQ-06: the owning Requestor and a human Security Analyst may return a
  // submitted request to draft; the service analyst agent must not.
  assert.equal(requestor.functionIds.includes(revertFunctionId), true);
  assert.equal(analyst.functionIds.includes(revertFunctionId), true);
  assert.equal(analystAgent.functionIds.includes(revertFunctionId), false);

  for (const operation of Object.values(CSRM_ASSESSMENT_REQUEST_OPERATIONS)) {
    const matches = catalogue.functionApis.filter((entry) => entry.url === operation);
    assert.equal(matches.length, 1, `${operation} must have exactly one canonical FunctionAPI`);
    const expectedFunctionId = operation === CSRM_ASSESSMENT_REQUEST_OPERATIONS.delete
      ? deleteFunctionId
      : operation === CSRM_ASSESSMENT_REQUEST_OPERATIONS.revertToDraft
        ? revertFunctionId
        : coreFunctionId;
    assert.equal(matches[0]?.functionId, expectedFunctionId);
  }
  assert.equal(catalogue.functionApis.some((entry) => entry.id === "function.risk_assessment_requests.new_request.api.06"), false);
  assert.ok(catalogue.functionApis.some((entry) => entry.id === "function.risk_assessment_requests.request_details.api.02"));
});

/*
 * Phase 06's 24 Administration operations, plus Phase 19's 12 (19-14; D-31 to D-33): each collection's import template,
 * error report and reference-list export, in the same Functions and human-analyst-only.
 */
const ADMINISTRATION_OPERATION_COUNT = 24 + 12;

test("ADMIN-01 ADMIN-02 ADMIN-03 ADMIN-04 catalogue grants exactly 36 no-delete human-analyst Administration operations", () => {
  const operations = Object.values(CSRM_ADMINISTRATION_OPERATIONS).sort();
  assert.equal(operations.length, ADMINISTRATION_OPERATION_COUNT, "PHASE6_OPERATION_INVENTORY_MISSING");
  assert.equal(new Set(operations).size, ADMINISTRATION_OPERATION_COUNT, "DUPLICATE_ADMINISTRATION_OPERATION");
  assert.equal(operations.some((operation) => operation.startsWith("DELETE:")), false, "T-06-08_DELETE_OPERATION_EXPOSED");

  for (const operation of operations) {
    const matches = catalogue.functionApis.filter((entry) => entry.url === operation);
    assert.equal(matches.length, 1, `${operation} must have exactly one canonical FunctionAPI grant`);
    assert.match(matches[0]!.functionId, /^function\.administration\./);
  }
  const administrationFunctions = catalogue.functions.filter((entry) => entry.id.startsWith("function.administration."));
  assert.equal(administrationFunctions.length, 8);
  for (const entry of administrationFunctions) {
    assert.deepEqual(entry.roleIds, ["role.security_analyst"], `${entry.id} must exclude Requestor and analyst agents`);
    assert.equal("menuPath" in entry, entry.id.endsWith("risk_types") || entry.id.endsWith("controls")
      || entry.id.endsWith("information_systems") || entry.id.endsWith("information_assets"));
  }
});

test("Administration route inventory is token-only, exact-grant, human-only, and duplicate-free", () => {
  type RoutePolicy = string | {
    name: string;
    config?: { operation?: string; administrationListOperation?: string; requireAnalystAdministrationScope?: boolean };
  };
  type RouteConfig = {
    method: string;
    path: string;
    config?: { auth?: unknown; policies?: RoutePolicy[] };
  };
  const administrationRouteList = (administrationRoutes as { routes: RouteConfig[] }).routes;
  const riskRouteList = (riskRoutes as { routes: RouteConfig[] }).routes;
  const routes = [...administrationRouteList, ...riskRouteList];
  const administrationOperations = new Set(Object.values(CSRM_ADMINISTRATION_OPERATIONS));
  const mountedOperations: string[] = [];

  for (const route of routes) {
    const policies = route.config?.policies ?? [];
    const authorization = policies.find((policy: RoutePolicy) => typeof policy === "object" && policy !== null
      && "name" in policy && policy.name === "global::csrm-authorization") as {
        config?: { operation?: string; administrationListOperation?: string; requireAnalystAdministrationScope?: boolean };
      } | undefined;
    for (const operation of [authorization?.config?.operation, authorization?.config?.administrationListOperation]) {
      if (operation && administrationOperations.has(operation as never)) mountedOperations.push(operation);
    }
    if (!authorization || ![authorization.config?.operation, authorization.config?.administrationListOperation]
      .some((operation) => operation && administrationOperations.has(operation as never))) continue;
    assert.deepEqual(route.config?.auth, { strategies: ["content-api-token"] });
    assert.equal(policies[0], "global::csrm-app-enabled");
    if (!authorization.config?.administrationListOperation) {
      assert.equal(authorization.config?.requireAnalystAdministrationScope, true);
    }
    assert.notEqual(route.method, "DELETE");
  }

  assert.equal(mountedOperations.length, ADMINISTRATION_OPERATION_COUNT);
  assert.equal(new Set(mountedOperations).size, ADMINISTRATION_OPERATION_COUNT);
  for (const path of ["/v1/risk_types", "/v1/controls"]) {
    assert.equal(routes.filter((route) => route.method === "GET" && route.path === path).length, 1);
    assert.equal(administrationRouteList.some((route: RouteConfig) => route.method === "GET" && route.path === path), false);
  }
});

test("single-owner picker routes keep the legacy envelope and deny canonical Administration queries to agents", async () => {
  const harness = await harnessPromise;
  for (const path of ["risk_types", "controls"] as const) {
    const legacy = await harness.request({ path: `/api/v1/${path}`, identity: harness.identities.serviceAnalystAgent });
    assert.equal(legacy.status, 200, `LEGACY_${path}_PICKER_GRANT_CHANGED`);
    assert.deepEqual(Object.keys(await legacy.json() as Record<string, unknown>), ["data"]);

    const canonical = await harness.request({
      path: `/api/v1/${path}?q=&sort=name%3Aasc&page=1&pageSize=25`,
      identity: harness.identities.serviceAnalystAgent,
    });
    assert.equal(canonical.status, 403, `AGENT_REACHED_${path}_ADMINISTRATION_LIST`);
  }
});

test("mounted GET routes enforce owner scope and explicit analyst collection scope", async () => {
  const harness = await harnessPromise;
  const owner = await request(`/api/csrm-assessment-requests/${harness.requests.owner}`, harness.identities.owner);
  assert.equal(owner.status, 200);
  const other = await request(`/api/csrm-assessment-requests/${harness.requests.owner}`, harness.identities.otherRequestor);
  assert.equal(other.status, 403);

  const ownCollection = await request(`/api/csrm-assessment-requests?filters[requestor][documentId][$eq]=${harness.requests.otherRequestor}`, harness.identities.owner);
  assert.equal(ownCollection.status, 200);
  assert.deepEqual(documentIds(await ownCollection.json()), [harness.requests.owner]);

  const missingGrantCollection = await request("/api/csrm-assessment-requests", harness.identities.analystAgent);
  assert.equal(missingGrantCollection.status, 200);
  assert.deepEqual(documentIds(await missingGrantCollection.json()), []);

  // The My route is owner-scoped for every actor now, including the analyst:
  // their own screens behave like a Requestor's. This analyst owns no requests,
  // so their My collection is empty rather than the whole estate.
  const analystCollection = await request("/api/csrm-assessment-requests", harness.identities.analyst);
  assert.equal(analystCollection.status, 200);
  assert.deepEqual(documentIds(await analystCollection.json()), []);

  // The analyst still reviews other people's requests through the review queue,
  // which is a separate route carrying the wider grant. Both requests seeded
  // here are drafts, which the queue excludes by status, so this asserts the
  // surface is reachable and paged rather than naming a row.
  const analystQueue = await request("/api/v1/assessment_requests?pagination[page]=1&pagination[pageSize]=100", harness.identities.analyst);
  assert.equal(analystQueue.status, 200, "ANALYST_REVIEW_QUEUE_UNREACHABLE");
  const queueBody = await analystQueue.json() as { data?: unknown; meta?: { pagination?: unknown } };
  assert.ok(Array.isArray(queueBody.data), "ANALYST_REVIEW_QUEUE_SHAPE");
  assert.ok(queueBody.meta?.pagination, "ANALYST_REVIEW_QUEUE_UNPAGED");

  const inactive = await request("/api/csrm-assessment-requests", harness.identities.inactiveAnalyst);
  assert.equal(inactive.status, 403);
});

test("mounted POST derives requestor ownership and rejects PATCH", async () => {
  const harness = await harnessPromise;
  const created = await request("/api/csrm-assessment-requests", harness.identities.owner, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ data: { requestNumber: "AUTH-FORGED-001", title: "Forged owner", requestStatus: "draft", requestor: harness.users.otherRequestor } }),
  });
  assert.equal(created.status, 200);
  const createdDocument = (await created.json() as { data: { documentId: string } }).data;
  const persisted = await harness.getRequest(createdDocument.documentId);
  assert.equal((persisted?.requestor as { documentId?: string } | undefined)?.documentId, harness.users.owner);
  const ownerCanRead = await request(`/api/csrm-assessment-requests/${createdDocument.documentId}`, harness.identities.owner);
  assert.equal(ownerCanRead.status, 200);
  const otherCannotRead = await request(`/api/csrm-assessment-requests/${createdDocument.documentId}`, harness.identities.otherRequestor);
  assert.equal(otherCannotRead.status, 403);

  const patch = await request(`/api/csrm-assessment-requests/${harness.requests.owner}`, harness.identities.owner, { method: "PATCH" });
  assert.notEqual(patch.status, 200);
});

test("mounted canonical PUT persists only owner and exact-grant analyst changes", async () => {
  const harness = await harnessPromise;
  const ownerUpdate = await request(`/api/csrm-assessment-requests/${harness.requests.owner}`, harness.identities.owner, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { title: "Owner updated" } }) });
  assert.equal(ownerUpdate.status, 200);
  assert.equal((await harness.getRequest(harness.requests.owner))?.title, "Owner updated");

  const crossRequestor = await request(`/api/csrm-assessment-requests/${harness.requests.owner}`, harness.identities.otherRequestor, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { title: "Cross requestor update" } }) });
  assert.equal(crossRequestor.status, 403);
  assert.equal((await harness.getRequest(harness.requests.owner))?.title, "Owner updated");

  const analystUpdate = await request(`/api/csrm-assessment-requests/${harness.requests.otherRequestor}`, harness.identities.analyst, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { title: "Analyst updated" } }) });
  assert.equal(analystUpdate.status, 200);
  assert.equal((await harness.getRequest(harness.requests.otherRequestor))?.title, "Analyst updated");

  const missingGrant = await request(`/api/csrm-assessment-requests/${harness.requests.otherRequestor}`, harness.identities.analystAgent, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify({ data: { title: "Missing grant update" } }) });
  assert.equal(missingGrant.status, 403);
  assert.equal((await harness.getRequest(harness.requests.otherRequestor))?.title, "Analyst updated");
});

test("mounted DELETE denies an owning Requestor before an exact-grant analyst removes the record", async () => {
  const harness = await harnessPromise;
  const denied = await request(`/api/csrm-assessment-requests/${harness.requests.owner}`, harness.identities.owner, { method: "DELETE" });
  if (denied.status === 204) {
    assert.fail("RED_EXPECTED_OWNER_REQUESTOR_DELETE_DENIED");
  }
  assert.equal(denied.status, 403, "UNEXPECTED_OWNER_REQUESTOR_DELETE_STATUS");
  assert.ok(await harness.getRequest(harness.requests.owner));

  const allowed = await request(`/api/csrm-assessment-requests/${harness.requests.owner}`, harness.identities.analyst, { method: "DELETE" });
  assert.equal(allowed.status, 204);
  assert.equal(await harness.getRequest(harness.requests.owner), null);
});

test("mounted route fails closed when no test identity is mapped", async () => {
  const harness = await harnessPromise;
  const response = await request(`/api/csrm-assessment-requests/${harness.requests.owner}`);
  assert.equal(response.status, 403);
});

test("mounted route requires a token before IdamBox authorization", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedQuestionnaireWorkflowFixtures();
  const path = `/api/v1/questionnaires/${fixture.questionnaires.ownerSubmitted}/generate_assessment`;
  const identityWithoutToken = await harness.request({
    path,
    identity: harness.identities.owner,
    init: { method: "POST" },
    omitApiToken: true,
  });
  assert.equal(identityWithoutToken.status, 401);
  const tokenWithoutIdentity = await harness.request({ path, init: { method: "POST" } });
  assert.equal(tokenWithoutIdentity.status, 403);
  const tokenWithIdentity = await harness.request({ path, identity: harness.identities.analyst, init: { method: "POST" } });
  assert.equal(tokenWithIdentity.status, 202);
});

test("Requestor selector routes return bounded summaries and reject invalid inventory input", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAdministrationFixtures();
  for (const [path, fixture, extra] of [
    ["information_systems", fixtures.informationSystems.update, "systemType"],
    ["information_assets", fixtures.informationAssets.update, "type"],
  ] as const) {
    const response = await harness.request({ path: `/api/v1/${path}?q=Administration&page=1&pageSize=10`, identity: harness.identities.owner });
    assert.equal(response.status, 200, await response.clone().text());
    const body = await response.json() as { data: Array<Record<string, unknown>> };
    assert.ok(body.data.length > 0);
    assert.deepEqual(Object.keys(body.data[0] ?? {}).sort(), ["documentId", "name", extra].sort());
    for (const invalidPath of [`/api/v1/${path}?q=${"x".repeat(101)}`, `/api/v1/${path}?q=x&page=0`, `/api/v1/${path}?q=x&pageSize=100`, `/api/v1/${path}?q=x&unexpected=true`]) {
      assert.equal((await harness.request({ path: invalidPath, identity: harness.identities.owner })).status, 400);
    }
    const denied = await harness.request({ path: `/api/v1/${path}?q=Administration`, identity: harness.identities.inactiveAnalyst });
    assert.equal(denied.status, 403);
    const selected = await harness.request({ path: `/api/v1/${path}/selected`, identity: harness.identities.owner, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedIds: [fixture] }) } });
    assert.equal(selected.status, 200, await selected.clone().text());
    assert.equal(((await selected.json() as { data: Array<{ documentId: string }> }).data[0]?.documentId), fixture);
    for (const selectedIds of [[fixture, fixture], ["missing-record"], Array.from({ length: 51 }, (_, index) => `selected-${index}`)]) {
      const invalid = await harness.request({ path: `/api/v1/${path}/selected`, identity: harness.identities.owner, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ selectedIds }) } });
      assert.equal(invalid.status, 400);
    }
  }
});

/*
 * The authorization matrix states these successes but does not issue them, because each would spend a
 * fixture it depends on (SR-02). Kept last, so the requests it creates reach no earlier list or count.
 */
test("mounted request writes admit every granted actor, the service agent included", async () => {
  const harness = await harnessPromise;
  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(body) });

  // Create is granted to every identity. The other Requestor's request is her own whatever the body names.
  const forged = await request("/api/csrm-assessment-requests", harness.identities.otherRequestor, json("POST", {
    data: { requestNumber: "AUTH-WRITE-OTHER", title: "Write proof other Requestor", requestStatus: "draft", requestor: harness.users.owner },
  }));
  assert.equal(forged.status, 200, "REQUEST_CREATE_REFUSED_OTHER_REQUESTOR");
  const forgedId = (await forged.json() as { data: { documentId: string } }).data.documentId;
  assert.equal(
    ((await harness.getRequest(forgedId))?.requestor as { documentId?: string } | undefined)?.documentId,
    harness.users.otherRequestor,
    "REQUEST_OWNER_NOT_DERIVED_OTHER_REQUESTOR",
  );

  // The analyst creates through the explicit analyst grant; the service agent, whose request grants Phase 12
  // withdrew (D-33, R-08-42), through the Requestor birthright every identity holds.
  for (const [actor, identity] of [
    ["ANALYST", harness.identities.analyst],
    ["SERVICE_AGENT", harness.identities.serviceAnalystAgent],
  ] as const) {
    const created = await request("/api/csrm-assessment-requests", identity, json("POST", {
      data: { requestNumber: `AUTH-WRITE-${actor}`, title: `Write proof ${actor}`, requestStatus: "draft" },
    }));
    assert.equal(created.status, 200, `REQUEST_CREATE_REFUSED_${actor}`);
    const createdId = (await created.json() as { data: { documentId: string } }).data.documentId;
    assert.equal((await harness.getRequest(createdId))?.title, `Write proof ${actor}`, `REQUEST_CREATE_NOT_PERSISTED_${actor}`);
  }

  // Phase 12 D-33 (R-08-42): the service agent no longer holds the update or delete grant, so a request it does
  // not own is refused and left exactly as it was.
  const target = await harness.createAssessmentRequestFixture({
    requestNumber: "AUTH-SERVICE-AGENT-WRITE-001",
    title: "Service agent write target",
    requestStatus: "draft",
    requestor: "owner",
  });
  const before = await harness.getRequest(target);
  const updated = await request(`/api/csrm-assessment-requests/${target}`, harness.identities.serviceAnalystAgent, json("PUT", { data: { title: "Service agent updated" } }));
  assert.equal(updated.status, 403, "SERVICE_AGENT_UPDATE_NOT_REFUSED");
  const removed = await request(`/api/csrm-assessment-requests/${target}`, harness.identities.serviceAnalystAgent, { method: "DELETE" });
  assert.equal(removed.status, 403, "SERVICE_AGENT_DELETE_NOT_REFUSED");
  assert.deepEqual(await harness.getRequest(target), before, "SERVICE_AGENT_REFUSAL_WROTE");
});

/*
 * T-08-A1 and T-08-A2 (Phase 8 security audit). Requestor is every identity's birthright, so a request
 * belongs to the identity that creates it, whichever role it also holds. No actor creates a request for
 * someone else or moves one to another owner, and no server-owned fact is taken from a request body.
 * These tests follow the request-writes proof above and create their own records, so nothing they add
 * reaches an earlier list or count.
 */
const REQUEST_NUMBER_FORMAT = /^RAR-\d{4}-[0-9A-HJKMNP-TV-Z]{6}$/;
const FORGED_DATE = "2001-01-01T00:00:00.000Z";

function jsonBody(method: "POST" | "PUT", data: Record<string, unknown>): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify({ data }) };
}

function relationDocumentId(value: unknown): string | undefined {
  return typeof value === "object" && value !== null ? (value as { documentId?: string }).documentId : undefined;
}

async function createdDocumentId(response: Response, tag: string): Promise<string> {
  assert.equal(response.status, 200, `${tag}_STATUS: ${await response.clone().text()}`);
  const documentId = (await response.json() as { data?: { documentId?: unknown } }).data?.documentId;
  assert.equal(typeof documentId, "string", `${tag}_DOCUMENT_ID`);
  return documentId as string;
}

/** The caller's own My Requests, one page wide enough for every request this file creates. */
async function myRequestIds(identity: string): Promise<string[]> {
  const response = await request("/api/csrm-assessment-requests?pagination[page]=1&pagination[pageSize]=100", identity);
  assert.equal(response.status, 200, `MY_REQUESTS_UNREADABLE_${identity}`);
  return documentIds(await response.json());
}

/*
 * The two identities that reach the create and update routes through the explicit analyst grant are named
 * in each test body, because the authorization matrix cites these tests as the proofs of their successes.
 */

test("T-08-A1 mounted create binds an analyst's or the service agent's request to its creator whatever the body names", async () => {
  const harness = await harnessPromise;
  const forgedQuestionnaire = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", { title: "T-08-A1 forged questionnaire" });
  const forgedAssessment = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", { assessmentNumber: "T08A1-FORGED-ASSESSMENT", assessmentStatus: "draft" });

  for (const { actor, identity, documentId } of [
    { actor: "ANALYST", identity: harness.identities.analyst, documentId: harness.users.analyst },
    { actor: "SERVICE_AGENT", identity: harness.identities.serviceAnalystAgent, documentId: harness.users.serviceAnalystAgent },
  ] as const) {
    const title = `T-08-A1 forged create ${actor}`;
    const createdId = await createdDocumentId(await request("/api/csrm-assessment-requests", identity, jsonBody("POST", {
      title,
      requestor: harness.users.owner,
      requestNumber: `FORGED-CREATE-${actor}`,
      requestStatus: "submitted",
      submittedDate: FORGED_DATE,
      sponsor: harness.users.otherRequestor,
      revertReason: "Forged reversal",
      revertedAt: FORGED_DATE,
      revertedBy: harness.users.otherRequestor,
      questionnaire: forgedQuestionnaire,
      assessment: forgedAssessment,
    })), `T08A1_FORGED_CREATE_${actor}`);

    const persisted = await harness.getRequest(createdId);
    assert.ok(persisted, `T08A1_CREATED_ROW_ABSENT_${actor}`);
    assert.equal(relationDocumentId(persisted.requestor), documentId, `T08A1_OWNER_IS_NOT_THE_CREATOR_${actor}`);
    assert.equal(persisted.title, title, `T08A1_TITLE_NOT_WRITTEN_${actor}`);
    assert.match(String(persisted.requestNumber), REQUEST_NUMBER_FORMAT, `T08A1_REQUEST_NUMBER_NOT_SERVER_OWNED_${actor}`);
    assert.equal(persisted.requestStatus, "draft", `T08A1_STATUS_NOT_SERVER_OWNED_${actor}`);
    assert.equal(persisted.submittedDate, null, `T08A1_SUBMITTED_DATE_NOT_SERVER_OWNED_${actor}`);
    assert.equal(persisted.sponsor, null, `T08A1_SPONSOR_WRITTEN_${actor}`);
    assert.equal(persisted.revertReason, null, `T08A1_REVERT_REASON_WRITTEN_${actor}`);
    assert.equal(persisted.revertedAt, null, `T08A1_REVERTED_AT_WRITTEN_${actor}`);
    assert.equal(persisted.revertedBy, null, `T08A1_REVERTED_BY_WRITTEN_${actor}`);
    assert.equal(persisted.questionnaire, null, `T08A1_QUESTIONNAIRE_WRITTEN_${actor}`);
    assert.equal(persisted.assessment, null, `T08A1_ASSESSMENT_WRITTEN_${actor}`);

    // The Requestor the body named neither lists the request nor reads it.
    assert.equal((await myRequestIds(harness.identities.owner)).includes(createdId), false, `T08A1_LISTED_FOR_THE_NAMED_REQUESTOR_${actor}`);
    const namedRead = await request(`/api/csrm-assessment-requests/${createdId}`, harness.identities.owner);
    assert.equal(namedRead.status, 403, `T08A1_READABLE_BY_THE_NAMED_REQUESTOR_${actor}`);
  }
});

test("T-08-A1 an analyst's or the service agent's own new request appears in their own My Requests", async () => {
  const harness = await harnessPromise;
  for (const [actor, identity] of [
    ["ANALYST", harness.identities.analyst],
    ["SERVICE_AGENT", harness.identities.serviceAnalystAgent],
  ] as const) {
    // The body the web sends from New Request: the published create fields and nothing else.
    const createdId = await createdDocumentId(
      await request("/api/csrm-assessment-requests", identity, jsonBody("POST", { title: `T-08-A1 own request ${actor}` })),
      `T08A1_OWN_CREATE_${actor}`,
    );
    assert.ok((await myRequestIds(identity)).includes(createdId), `T08A1_OWN_REQUEST_NOT_IN_MY_REQUESTS_${actor}`);
    const summary = await request("/api/v1/my_requests/status_summary", identity);
    assert.equal(summary.status, 200, `T08A1_OWN_SUMMARY_UNREADABLE_${actor}`);
    const drafts = (await summary.json() as { data?: { draft?: unknown } }).data?.draft;
    assert.ok(typeof drafts === "number" && drafts >= 1, `T08A1_OWN_DRAFT_NOT_COUNTED_${actor}`);
    for (const requestor of [harness.identities.owner, harness.identities.otherRequestor]) {
      assert.equal((await myRequestIds(requestor)).includes(createdId), false, `T08A1_OWN_REQUEST_LISTED_FOR_${requestor}_${actor}`);
    }
  }
});

test("T-08-A2 mounted update keeps a request's owner when an analyst names another Requestor", async () => {
  const harness = await harnessPromise;
  for (const [actor, identity, suffix] of [
    ["ANALYST", harness.identities.analyst, "AN"],
  ] as const) {
    // The owner's released work: an approved request, its released questionnaire and its released assessment.
    const requestId = await harness.createAssessmentRequestFixture({
      requestNumber: `T08A2-RELEASED-${suffix}`,
      title: `T-08-A2 released request ${actor}`,
      requestStatus: "approved",
      requestor: "owner",
    });
    const { questionnaire } = await harness.createQuestionnaireLifecycleFixture({ requestDocumentId: requestId, released: true, answerState: "submitted" });
    const assessment = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
      assessmentNumber: `ASM-2026-T8A2${suffix}`,
      assessmentStatus: "approved",
      summary: `T-08-A2 released assessment ${actor}`,
      overallRating: "Moderate",
      assessmentRequest: requestId,
      approvedBy: harness.users.analyst,
      approvalDate: "2026-08-30T00:00:00.000Z",
      assessmentDate: "2026-08-30T00:00:00.000Z",
    });
    // The matrix conventions: another Requestor is refused a request or a questionnaire (403) and never learns an assessment exists (404).
    const reads = [
      [`/api/csrm-assessment-requests/${requestId}`, 403],
      [`/api/v1/questionnaires/${questionnaire}`, 403],
      [`/api/v1/risk_assessments/${assessment}`, 404],
    ] as const;
    for (const [path, otherStatus] of reads) {
      assert.equal((await request(path, harness.identities.owner)).status, 200, `T08A2_PRECONDITION_OWNER_READ_${actor}_${path}`);
      assert.equal((await request(path, harness.identities.otherRequestor)).status, otherStatus, `T08A2_PRECONDITION_OTHER_READ_${actor}_${path}`);
    }

    const title = `T-08-A2 amended ${actor}`;
    const moved = await request(`/api/csrm-assessment-requests/${requestId}`, identity, jsonBody("PUT", { title, requestor: harness.users.otherRequestor }));
    assert.equal(moved.status, 200, `T08A2_MOVE_STATUS_${actor}: ${await moved.clone().text()}`);
    const persisted = await harness.getRequest(requestId);
    assert.equal(relationDocumentId(persisted?.requestor), harness.users.owner, `T08A2_OWNER_MOVED_${actor}`);
    // The published field in the same body is written: the analyst's reach over a request is unchanged.
    assert.equal(persisted?.title, title, `T08A2_PUBLISHED_FIELD_NOT_WRITTEN_${actor}`);

    for (const [path, otherStatus] of reads) {
      assert.equal((await request(path, harness.identities.otherRequestor)).status, otherStatus, `T08A2_OTHER_REQUESTOR_REACHED_${actor}_${path}`);
      assert.equal((await request(path, harness.identities.owner)).status, 200, `T08A2_OWNER_LOST_${actor}_${path}`);
    }
    assert.equal((await myRequestIds(harness.identities.otherRequestor)).includes(requestId), false, `T08A2_LISTED_FOR_OTHER_REQUESTOR_${actor}`);
    assert.ok((await myRequestIds(harness.identities.owner)).includes(requestId), `T08A2_NOT_LISTED_FOR_OWNER_${actor}`);
  }
});

/*
 * The published update body is closed: the thirteen Requestor fields and the submission intent
 * (`requestStatus: "submitted"`; omitted, the request stays a draft). A server-owned fact is not
 * part of it, so it is ignored, as the Requestor branch has ignored it since Phase 2. A status the
 * contract does not allow is refused (400) with nothing written, and submission is a transition
 * from draft only, dated by the server.
 */
test("T-08-A2 mounted update ignores server-owned facts and honours only the published submission intent from an analyst", async () => {
  const harness = await harnessPromise;
  const forgedQuestionnaire = await harness.createFixtureDocument("api::csrm-questionnaire.csrm-questionnaire", { title: "T-08-A2 forged questionnaire" });
  const forgedAssessment = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", { assessmentNumber: "T08A2-FORGED-ASSESSMENT", assessmentStatus: "draft" });

  for (const [actor, identity, suffix] of [
    ["ANALYST", harness.identities.analyst, "AN"],
  ] as const) {
    const requestNumber = `T08A2-DRAFT-${suffix}`;
    const target = await harness.createAssessmentRequestFixture({ requestNumber, title: `T-08-A2 draft ${actor}`, requestStatus: "draft", requestor: "owner" });
    const description = `Amended by ${actor}`;
    const forged = await request(`/api/csrm-assessment-requests/${target}`, identity, jsonBody("PUT", {
      description,
      requestor: harness.users.otherRequestor,
      requestNumber: `FORGED-UPDATE-${suffix}`,
      submittedDate: FORGED_DATE,
      sponsor: harness.users.otherRequestor,
      revertReason: "Forged reversal",
      revertedAt: FORGED_DATE,
      revertedBy: harness.users.otherRequestor,
      questionnaire: forgedQuestionnaire,
      assessment: forgedAssessment,
    }));
    assert.equal(forged.status, 200, `T08A2_FORGED_UPDATE_STATUS_${actor}: ${await forged.clone().text()}`);
    const persisted = await harness.getRequest(target);
    assert.ok(persisted, `T08A2_TARGET_ABSENT_${actor}`);
    assert.equal(persisted.description, description, `T08A2_PUBLISHED_FIELD_NOT_WRITTEN_${actor}`);
    assert.equal(relationDocumentId(persisted.requestor), harness.users.owner, `T08A2_REQUESTOR_WRITTEN_${actor}`);
    assert.equal(persisted.requestNumber, requestNumber, `T08A2_REQUEST_NUMBER_WRITTEN_${actor}`);
    assert.equal(persisted.requestStatus, "draft", `T08A2_STATUS_WRITTEN_${actor}`);
    assert.equal(persisted.submittedDate, null, `T08A2_SUBMITTED_DATE_WRITTEN_${actor}`);
    assert.equal(persisted.sponsor, null, `T08A2_SPONSOR_WRITTEN_${actor}`);
    assert.equal(persisted.revertReason, null, `T08A2_REVERT_REASON_WRITTEN_${actor}`);
    assert.equal(persisted.revertedAt, null, `T08A2_REVERTED_AT_WRITTEN_${actor}`);
    assert.equal(persisted.revertedBy, null, `T08A2_REVERTED_BY_WRITTEN_${actor}`);
    assert.equal(persisted.questionnaire, null, `T08A2_QUESTIONNAIRE_WRITTEN_${actor}`);
    assert.equal(persisted.assessment, null, `T08A2_ASSESSMENT_WRITTEN_${actor}`);

    for (const requestStatus of ["approved", "risk-assessment-drafted"]) {
      const before = await harness.getRequest(target);
      const refused = await request(`/api/csrm-assessment-requests/${target}`, identity, jsonBody("PUT", { title: "Refused status change", requestStatus }));
      assert.equal(refused.status, 400, `T08A2_UNPUBLISHED_STATUS_ADMITTED_${actor}_${requestStatus}`);
      assert.deepEqual(await harness.getRequest(target), before, `T08A2_UNPUBLISHED_STATUS_WROTE_${actor}_${requestStatus}`);
    }

    // The caller's own New Request, submitted through the same route: the server dates the submission.
    const ownId = await createdDocumentId(
      await request("/api/csrm-assessment-requests", identity, jsonBody("POST", { title: `T-08-A2 own submission ${actor}` })),
      `T08A2_OWN_CREATE_${actor}`,
    );
    const submitStarted = Date.now();
    const submitted = await request(`/api/csrm-assessment-requests/${ownId}`, identity, jsonBody("PUT", { requestStatus: "submitted", submittedDate: FORGED_DATE }));
    const submitFinished = Date.now();
    assert.equal(submitted.status, 200, `T08A2_OWN_SUBMIT_STATUS_${actor}: ${await submitted.clone().text()}`);
    const own = await harness.getRequest(ownId);
    assert.equal(own?.requestStatus, "submitted", `T08A2_OWN_SUBMIT_NOT_APPLIED_${actor}`);
    const submittedAt = Date.parse(String(own?.submittedDate));
    assert.ok(Number.isFinite(submittedAt) && submittedAt >= submitStarted && submittedAt <= submitFinished + 1000, `T08A2_OWN_SUBMIT_NOT_SERVER_DATED_${actor}`);

    // Submission is a transition from draft: a second one is refused and writes nothing.
    const before = await harness.getRequest(ownId);
    const repeated = await request(`/api/csrm-assessment-requests/${ownId}`, identity, jsonBody("PUT", { requestStatus: "submitted" }));
    assert.equal(repeated.status, 400, `T08A2_REPEATED_SUBMIT_ADMITTED_${actor}`);
    assert.deepEqual(await harness.getRequest(ownId), before, `T08A2_REPEATED_SUBMIT_WROTE_${actor}`);
  }
});

/*
 * Phase 13 D-20 (O-5): the analyst branch of the request update may amend another person's draft, but only the
 * request's own requestor submits it, so an analyst never attests a request they did not raise. The refusal is a 403
 * with the closed reason NOT_REQUEST_REQUESTOR and nothing written. T-08-A2's cases above stay as they are: another
 * status on another person's draft is still 400, and an analyst still submits their own draft.
 */
test("D-20 an analyst submitting a draft they did not raise is refused with NOT_REQUEST_REQUESTOR, while amending it and the requestor's own submission stay allowed", async () => {
  const harness = await harnessPromise;
  const target = await harness.createAssessmentRequestFixture({ requestNumber: "D20-DRAFT", title: "D-20 draft", requestStatus: "draft", requestor: "owner" });
  for (const body of [{ requestStatus: "submitted" }, { title: "Submitted by Bob", requestStatus: "submitted" }]) {
    const before = await harness.getRequest(target);
    const refused = await request(`/api/csrm-assessment-requests/${target}`, harness.identities.analyst, jsonBody("PUT", body));
    assert.equal(refused.status, 403, `D20_SUBMISSION_STATUS_${JSON.stringify(body)}`);
    assert.deepEqual(((await refused.json()) as { error?: { details?: unknown } }).error?.details, { reason: "NOT_REQUEST_REQUESTOR" }, "D20_SUBMISSION_REASON");
    assert.deepEqual(await harness.getRequest(target), before, `D20_SUBMISSION_WROTE_${JSON.stringify(body)}`);
  }

  const amended = await request(`/api/csrm-assessment-requests/${target}`, harness.identities.analyst, jsonBody("PUT", { title: "D-20 amended by Bob" }));
  assert.equal(amended.status, 200, "D20_AMENDMENT_STATUS");
  assert.equal((await harness.getRequest(target))?.title, "D-20 amended by Bob", "D20_AMENDMENT_NOT_WRITTEN");
  const kept = await request(`/api/csrm-assessment-requests/${target}`, harness.identities.analyst, jsonBody("PUT", { requestStatus: "draft" }));
  assert.equal(kept.status, 200, "D20_DRAFT_INTENT_STATUS");

  const submitted = await request(`/api/csrm-assessment-requests/${target}`, harness.identities.owner, jsonBody("PUT", { requestStatus: "submitted" }));
  assert.equal(submitted.status, 200, "D20_REQUESTOR_SUBMISSION_STATUS");
  assert.equal((await harness.getRequest(target))?.requestStatus, "submitted", "D20_REQUESTOR_SUBMISSION_NOT_APPLIED");
});
