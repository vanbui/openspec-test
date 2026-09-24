import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

type JsonObject = Record<string, any>;

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/strapi.
const appDir = path.resolve(__dirname, "..", "..", "..");
const repositoryDir = path.resolve(appDir, "..", "..");
const catalogueFilename = "idambox-csrm-role-function-api-catalogue.json";

function parseJsonFile(filename: string, diagnostic: string): JsonObject {
  try {
    return JSON.parse(readFileSync(filename, "utf8")) as JsonObject;
  } catch (error) {
    assert.fail(`${diagnostic}: ${(error as Error).message}`);
  }
}

function operation(specification: JsonObject, pathName: string, method: string): JsonObject {
  const value = specification.paths?.[pathName]?.[method];
  assert.ok(value, `UNEXPECTED_MISSING_${method.toUpperCase()}_${pathName}`);
  return value;
}

function parameter(operationValue: JsonObject, name: string): JsonObject | undefined {
  return operationValue.parameters?.find((entry: JsonObject) => entry.name === name);
}

function requestDataProperties(operationValue: JsonObject): JsonObject {
  const value = operationValue.requestBody?.content?.["application/json"]?.schema?.properties?.data?.properties;
  assert.ok(value, "UNEXPECTED_REQUEST_DATA_SCHEMA");
  return value;
}

function responseSchema(operationValue: JsonObject): JsonObject {
  const value = operationValue.responses?.["200"]?.content?.["application/json"]?.schema;
  assert.ok(value, "UNEXPECTED_RESPONSE_SCHEMA");
  return value;
}

function effectiveOperations(catalogue: JsonObject, roleId: string): Set<string> {
  const role = catalogue.roles.find((entry: JsonObject) => entry.id === roleId);
  assert.ok(role, `UNEXPECTED_MISSING_ROLE_${roleId}`);
  const functions = catalogue.functions.filter((entry: JsonObject) => role.functionIds.includes(entry.id));
  const functionIds = new Set(functions.map((entry: JsonObject) => entry.id));
  return new Set(
    catalogue.functionApis
      .filter((entry: JsonObject) => functionIds.has(entry.functionId))
      .map((entry: JsonObject) => entry.url),
  );
}

const phase3ServedRoutes = [
  {
    method: "get",
    path: "/v1/my_questionnaires",
    operationId: "questionnaire-workflow/get-my-questionnaires",
    grants: { "role.requestor": "function.questionnaire.my_questionnaires" },
  },
  {
    method: "get",
    path: "/v1/my_questionnaires/status_summary",
    operationId: "questionnaire-workflow/get-my-questionnaire-status-summary",
    grants: { "role.requestor": "function.questionnaire.my_questionnaires" },
  },
  {
    method: "get",
    path: "/v1/questionnaires",
    operationId: "questionnaire-workflow/get-questionnaires-for-review",
    grants: { "role.security_analyst": "function.questionnaires.questionnaires" },
  },
  {
    method: "get",
    path: "/v1/questionnaires/review_summary",
    operationId: "questionnaire-workflow/get-questionnaire-review-summary",
    grants: { "role.security_analyst": "function.questionnaires.questionnaires" },
  },
  {
    method: "get",
    path: "/v1/questionnaires/{questionnaireId}",
    operationId: "questionnaire-workflow/get-questionnaire",
    grants: {
      "role.requestor": "function.questionnaire.questionnaire_details",
      "role.security_analyst": "function.questionnaires.questionnaire_details",
    },
  },
  {
    method: "get",
    path: "/v1/questionnaires/{questionnaireId}/questions",
    operationId: "questionnaire-workflow/get-questionnaire-questions",
    grants: {
      "role.requestor": "function.questionnaire.questionnaire_details",
      "role.security_analyst": "function.questionnaires.questionnaire_details",
    },
  },
  {
    method: "patch",
    path: "/v1/questionnaires/{questionnaireId}/answers",
    operationId: "questionnaire-workflow/save-questionnaire-answers",
    grants: { "role.requestor": "function.questionnaire.questionnaire_details" },
  },
  {
    method: "post",
    path: "/v1/questionnaires/{questionnaireId}/submit",
    operationId: "questionnaire-workflow/submit-questionnaire",
    grants: { "role.requestor": "function.questionnaire.questionnaire_details" },
  },
  {
    method: "post",
    path: "/v1/questionnaires/{questionnaireId}/revert_to_draft",
    operationId: "questionnaire-workflow/revert-questionnaire-to-draft",
    /*
     * Reversal is its own API-only Function rather than part of the shared
     * questionnaire-details grants. Those are held by the service analyst agent
     * as well, and automation must not be able to return a submitted
     * questionnaire to draft. This mirrors the request reversal grant.
     */
    grants: {
      "role.requestor": "function.questionnaire.revert_to_draft_api",
      "role.security_analyst": "function.questionnaire.revert_to_draft_api",
    },
  },
] as const;

const phase4ServedRoutes = [
  { method: "get", path: "/v1/assessment_requests", operationId: "assessment-workflow/get-assessment-request-queue", grants: { "role.security_analyst": "function.risk_assessment_requests.requests" } },
  { method: "post", path: "/v1/questionnaires/{questionnaireId}/generate_assessment", operationId: "assessment-workflow/generate-assessment-draft", grants: { "role.security_analyst": "function.questionnaires.questionnaire_details" } },
  { method: "get", path: "/v1/assessment_draft_jobs/{jobId}", operationId: "assessment-workflow/get-assessment-draft-job", grants: { "role.security_analyst": "function.risk_assessments.risk_assessment_details" } },
  { method: "post", path: "/v1/assessment_draft_jobs/{jobId}/retry", operationId: "assessment-workflow/retry-assessment-draft-job", grants: { "role.security_analyst": "function.risk_assessments.risk_assessment_details" } },
  { method: "get", path: "/v1/risk_assessments", operationId: "assessment-workflow/get-risk-assessments", grants: { "role.security_analyst": "function.risk_assessments.risk_assessments" } },
  { method: "get", path: "/v1/risk_assessments/status_summary", operationId: "assessment-workflow/get-risk-assessment-status-summary", grants: { "role.security_analyst": "function.risk_assessments.risk_assessments" } },
  { method: "get", path: "/v1/risk_assessments/{assessmentId}", operationId: "assessment-workflow/get-risk-assessment", grants: { "role.requestor": "function.risk_assessments.risk_assessment_details_read_only", "role.security_analyst": "function.risk_assessments.risk_assessment_details" } },
  { method: "patch", path: "/v1/risk_assessments/{assessmentId}", operationId: "assessment-workflow/update-risk-assessment", grants: { "role.security_analyst": "function.risk_assessments.risk_assessment_details" } },
  { method: "get", path: "/v1/risk_assessments/{assessmentId}/risks", operationId: "assessment-workflow/get-assessment-risks", grants: { "role.requestor": "function.risk_assessments.risk_assessment_details_read_only", "role.security_analyst": "function.risk_assessments.risk_assessment_details" } },
  { method: "post", path: "/v1/risk_assessments/{assessmentId}/risks", operationId: "assessment-workflow/create-assessment-risk", grants: { "role.security_analyst": "function.risk_assessments.risk_assessment_details" } },
  { method: "patch", path: "/v1/risks/{riskId}", operationId: "assessment-workflow/update-risk", grants: { "role.security_analyst": "function.risk_register.risk_details" } },
  { method: "get", path: "/v1/risks/{riskId}/control_implementations", operationId: "assessment-workflow/get-risk-control-implementations", grants: { "role.requestor": "function.risk_assessments.risk_assessment_details_read_only", "role.security_analyst": "function.risk_register.risk_details" } },
  { method: "post", path: "/v1/risks/{riskId}/control_implementations", operationId: "assessment-workflow/create-risk-control-implementation", grants: { "role.security_analyst": "function.risk_register.risk_details" } },
  { method: "patch", path: "/v1/control_implementations/{implementationId}", operationId: "assessment-workflow/update-control-implementation", grants: { "role.security_analyst": "function.risk_register.mitigation_control_details" } },
  { method: "delete", path: "/v1/control_implementations/{implementationId}", operationId: "assessment-workflow/delete-control-implementation", grants: { "role.security_analyst": "function.risk_register.mitigation_control_details" } },
  { method: "get", path: "/v1/risk_types", operationId: "assessment-workflow/get-risk-types", grants: { "role.security_analyst": "function.administration.risk_types" } },
  { method: "get", path: "/v1/controls", operationId: "assessment-workflow/get-controls", grants: { "role.security_analyst": "function.administration.controls" } },
  { method: "get", path: "/v1/users", cataloguePath: "/v1/users?search={query}", operationId: "assessment-workflow/search-active-users", grants: { "role.requestor": "function.risk_assessment_requests.new_request", "role.security_analyst": "function.risk_assessments.risk_assessment_details" } },
  { method: "post", path: "/v1/risk_assessments/{assessmentId}/release", operationId: "assessment-workflow/release-risk-assessment", grants: { "role.security_analyst": "function.risk_assessments.risk_assessment_details" } },
  { method: "get", path: "/v1/my_risk_assessments", operationId: "assessment-workflow/get-my-released-risk-assessments", grants: { "role.requestor": "function.risk_assessments.my_risk_assessments" } },
  { method: "get", path: "/v1/my_risk_assessments/rating_summary", operationId: "assessment-workflow/get-my-risk-assessment-rating-summary", grants: { "role.requestor": "function.risk_assessments.my_risk_assessments" } },
] as const;

const questionnaireGenerationRoutes = [
  { method: "post", path: "/v1/assessment_requests/{requestId}/generate_questionnaire", operationId: "questionnaire-generation/generate-questionnaire", functionId: "function.questionnaire_generation.generate_api" },
  { method: "get", path: "/v1/questionnaire_generation_jobs/{jobId}", operationId: "questionnaire-generation/get-questionnaire-generation-job", functionId: "function.questionnaire_generation.job_read_api" },
  { method: "post", path: "/v1/questionnaire_generation_jobs/{jobId}/retry", operationId: "questionnaire-generation/retry-questionnaire-generation-job", functionId: "function.questionnaire_generation.retry_api" },
] as const;

test("questionnaire generation routes have byte-identical catalogue and human-only effective grants", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "QUESTIONNAIRE_GENERATION_SPECIFICATION_PARSE");
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const catalogue = parseJsonFile(authoritativePath, "QUESTIONNAIRE_GENERATION_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "web", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "QUESTIONNAIRE_GENERATION_CATALOGUE_BYTE_DRIFT");

  for (const route of questionnaireGenerationRoutes) {
    const catalogueUrl = `${route.method.toUpperCase()}:/api${route.path}`;
    const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === route.functionId);
    const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
    assert.equal(functions.length, 1, `QUESTIONNAIRE_GENERATION_FUNCTION_MISSING_${route.functionId}`);
    assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], `QUESTIONNAIRE_GENERATION_ROLE_SCOPE_${route.functionId}`);
    assert.deepEqual(apis.map((entry: JsonObject) => entry.functionId), [route.functionId], `QUESTIONNAIRE_GENERATION_FUNCTION_API_${catalogueUrl}`);
    assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), `QUESTIONNAIRE_GENERATION_ANALYST_GRANT_${catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(catalogueUrl), `QUESTIONNAIRE_GENERATION_AGENT_GRANT_${catalogueUrl}`);
    const contract = operation(specification, route.path, route.method);
    assert.equal(contract.operationId, route.operationId, `QUESTIONNAIRE_GENERATION_OPERATION_${route.path}`);
    assert.ok(generatedSchema.includes(`\"${route.path}\": {`), `QUESTIONNAIRE_GENERATION_GENERATED_PATH_${route.path}`);
    assert.ok(generatedSchema.includes(`${route.method}: operations[\"${route.operationId}\"];`), `QUESTIONNAIRE_GENERATION_GENERATED_OPERATION_${route.path}`);
  }
});

test("Phase 3 questionnaire routes have exact contract and effective-grant parity", () => {
  const specification = parseJsonFile(
    path.join(repositoryDir, "docs", "references", "specification.json"),
    "UNEXPECTED_SPECIFICATION_PARSE",
  );
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const authoritativeBytes = readFileSync(authoritativePath);
  const bootstrapBytes = readFileSync(bootstrapPath);
  const catalogue = parseJsonFile(authoritativePath, "UNEXPECTED_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(
    path.join(repositoryDir, "apps", "web", "src", "lib", "api", "generated", "schema.d.ts"),
    "utf8",
  );
  assert.equal(Buffer.compare(authoritativeBytes, bootstrapBytes), 0, "UNEXPECTED_CATALOGUE_BYTE_DRIFT");

  const effectiveByRole = new Map(
    ["role.requestor", "role.security_analyst"].map((roleId) => [roleId, effectiveOperations(catalogue, roleId)]),
  );
  for (const route of phase3ServedRoutes) {
    const catalogueUrl = `${route.method.toUpperCase()}:/api${route.path}`;
    const expectedGrants = Object.entries(route.grants);
    const exactApis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
    /*
     * Most questionnaire routes carry one FunctionAPI per role family, but a
     * route may instead be served by a single Function granted to several
     * roles. Compare the distinct Functions serving the route; the per-role
     * loop below still proves each role reaches it.
     */
    assert.deepEqual(
      [...new Set(exactApis.map((entry: JsonObject) => entry.functionId))].sort(),
      [...new Set(expectedGrants.map(([, functionId]) => functionId))].sort(),
      `UNEXPECTED_PHASE3_GRANTS_${catalogueUrl}`,
    );
    for (const [roleId, functionId] of expectedGrants) {
      assert.ok(effectiveByRole.get(roleId)?.has(catalogueUrl), `UNEXPECTED_MISSING_EFFECTIVE_GRANT_${roleId}_${catalogueUrl}`);
      const fn = catalogue.functions.find((entry: JsonObject) => entry.id === functionId);
      assert.ok(fn?.roleIds.includes(roleId), `UNEXPECTED_FUNCTION_ROLE_LINK_${functionId}_${roleId}`);
      assert.ok(
        exactApis.some((entry: JsonObject) => fn.functionApiIds.includes(entry.id)),
        `UNEXPECTED_FUNCTION_API_LINK_${functionId}_${catalogueUrl}`,
      );
    }
    const openApiOperation = specification.paths?.[route.path]?.[route.method];
    assert.ok(openApiOperation, `UNEXPECTED_MISSING_${route.method.toUpperCase()}_${route.path}`);
    assert.equal(openApiOperation.operationId, route.operationId, `UNEXPECTED_OPERATION_ID_${route.path}`);
    for (const status of ["400", "403"]) {
      assert.equal(
        openApiOperation.responses?.[status]?.$ref,
        status === "400"
          ? "#/components/responses/QuestionnaireBadRequest"
          : "#/components/responses/QuestionnaireForbidden",
        `UNEXPECTED_SAFE_ERROR_${status}_${route.path}`,
      );
    }
    if (route.path.includes("{questionnaireId}")) {
      assert.equal(
        openApiOperation.parameters?.[0]?.$ref,
        "#/components/parameters/QuestionnaireId",
        `UNEXPECTED_QUESTIONNAIRE_ID_PARAMETER_${route.path}`,
      );
      assert.equal(openApiOperation.responses?.["404"]?.$ref, "#/components/responses/QuestionnaireNotFound");
    }
    if (route.method === "patch" || route.method === "post") {
      assert.equal(openApiOperation.responses?.["409"]?.$ref, "#/components/responses/QuestionnaireConflict");
    }
    assert.ok(generatedSchema.includes(`"${route.path}": {`), `UNEXPECTED_GENERATED_PATH_${route.path}`);
    assert.ok(
      generatedSchema.includes(`${route.method}: operations["${route.operationId}"];`),
      `UNEXPECTED_GENERATED_OPERATION_${route.method}_${route.path}`,
    );
  }

  const answerDraft = specification.components?.schemas?.QuestionnaireAnswerDraftRequest;
  assert.deepEqual(Object.keys(answerDraft?.properties ?? {}), ["answers"], "UNEXPECTED_DRAFT_REQUEST_FIELDS");
  assert.equal(answerDraft?.additionalProperties, false, "UNEXPECTED_DRAFT_REQUEST_OPEN_SHAPE");
  const answerInput = specification.components?.schemas?.QuestionnaireAnswerInput;
  assert.deepEqual(Object.keys(answerInput?.properties ?? {}), ["questionKey", "value"], "UNEXPECTED_ANSWER_INPUT_FIELDS");
  assert.equal(answerInput?.additionalProperties, false, "UNEXPECTED_ANSWER_INPUT_OPEN_SHAPE");
  assert.equal(
    specification.paths["/v1/questionnaires/{questionnaireId}/answers"].patch.requestBody.content["application/json"]
      .schema.$ref,
    "#/components/schemas/QuestionnaireAnswerDraftRequest",
  );
  for (const schemaName of [
    "QuestionnaireListResponse",
    "QuestionnaireHeaderResponse",
    "QuestionnaireQuestionsResponse",
    "QuestionnaireAnswerDraftRequest",
    "QuestionnaireMutationResponse",
    "QuestionnaireSubmitResponse",
    "QuestionnaireRevertResponse",
  ]) {
    assert.ok(specification.components?.schemas?.[schemaName], `UNEXPECTED_MISSING_SCHEMA_${schemaName}`);
    assert.ok(generatedSchema.includes(`${schemaName}: {`), `UNEXPECTED_GENERATED_SCHEMA_${schemaName}`);
  }

  const revertOperation = operation(specification, "/v1/questionnaires/{questionnaireId}/revert_to_draft", "post");
  assert.equal(
    revertOperation.requestBody?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/RevertReasonRequest",
    "UNEXPECTED_QUESTIONNAIRE_REVERT_REASON_SCHEMA",
  );
  assert.deepEqual(
    specification.components?.schemas?.RevertReasonRequest,
    { type: "object", properties: { reason: { type: "string", minLength: 1, maxLength: 500 } }, required: ["reason"], additionalProperties: false },
    "UNEXPECTED_SHARED_REVERT_REASON_CONTRACT",
  );

  for (const analystInventoryUrl of [
    "GET:/api/v1/questionnaires",
    "GET:/api/v1/questionnaires/review_summary",
  ]) {
    assert.ok(
      !effectiveByRole.get("role.requestor")?.has(analystInventoryUrl),
      `UNEXPECTED_REQUESTOR_ANALYST_INVENTORY_GRANT_${analystInventoryUrl}`,
    );
  }

  const phase4Routes = [
    "PATCH:/api/v1/questionnaires/{questionnaireId}/review_comments",
    "POST:/api/v1/questionnaires/{questionnaireId}/complete_review",
  ];
  const servedUrls = new Set(phase3ServedRoutes.map((route) => `${route.method.toUpperCase()}:/api${route.path}`));
  for (const route of phase4Routes) {
    assert.ok(!servedUrls.has(route), `UNEXPECTED_PHASE4_SERVED_ROUTE_${route}`);
    const [, apiPath] = route.split(":/api");
    assert.ok(!specification.paths?.[apiPath], `UNEXPECTED_PHASE4_OPENAPI_PATH_${apiPath}`);
    assert.ok(!generatedSchema.includes(`"${apiPath}": {`), `UNEXPECTED_PHASE4_GENERATED_PATH_${apiPath}`);
  }
});

test("Phase 4 assessment routes have closed DTOs and exact contract/catalogue parity", () => {
  const specification = parseJsonFile(
    path.join(repositoryDir, "docs", "references", "specification.json"),
    "UNEXPECTED_SPECIFICATION_PARSE",
  );
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const authoritativeBytes = readFileSync(authoritativePath);
  const bootstrapBytes = readFileSync(bootstrapPath);
  const catalogue = parseJsonFile(authoritativePath, "UNEXPECTED_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(
    path.join(repositoryDir, "apps", "web", "src", "lib", "api", "generated", "schema.d.ts"),
    "utf8",
  );
  assert.equal(Buffer.compare(authoritativeBytes, bootstrapBytes), 0, "UNEXPECTED_CATALOGUE_BYTE_DRIFT");

  const effectiveByRole = new Map(
    ["role.requestor", "role.security_analyst"].map((roleId) => [roleId, effectiveOperations(catalogue, roleId)]),
  );
  for (const route of phase4ServedRoutes) {
    const cataloguePath = "cataloguePath" in route ? route.cataloguePath : route.path;
    const catalogueUrl = `${route.method.toUpperCase()}:/api${cataloguePath}`;
    const expectedGrants = Object.entries(route.grants);
    const exactApis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
    assert.deepEqual(
      exactApis.map((entry: JsonObject) => entry.functionId).sort(),
      expectedGrants.map(([, functionId]) => functionId).sort(),
      `UNEXPECTED_PHASE4_GRANTS_${catalogueUrl}`,
    );
    for (const [roleId, functionId] of expectedGrants) {
      assert.ok(effectiveByRole.get(roleId)?.has(catalogueUrl), `UNEXPECTED_MISSING_EFFECTIVE_GRANT_${roleId}_${catalogueUrl}`);
      const fn = catalogue.functions.find((entry: JsonObject) => entry.id === functionId);
      assert.ok(fn?.roleIds.includes(roleId), `UNEXPECTED_FUNCTION_ROLE_LINK_${functionId}_${roleId}`);
      assert.ok(
        exactApis.some((entry: JsonObject) => fn.functionApiIds.includes(entry.id)),
        `UNEXPECTED_FUNCTION_API_LINK_${functionId}_${catalogueUrl}`,
      );
    }
    const openApiOperation = specification.paths?.[route.path]?.[route.method];
    assert.ok(openApiOperation, `UNEXPECTED_MISSING_${route.method.toUpperCase()}_${route.path}`);
    assert.equal(openApiOperation.operationId, route.operationId, `UNEXPECTED_OPERATION_ID_${route.path}`);
    for (const status of ["400", "403"]) {
      assert.equal(
        openApiOperation.responses?.[status]?.$ref,
        status === "400" ? "#/components/responses/AssessmentBadRequest" : "#/components/responses/AssessmentForbidden",
        `UNEXPECTED_SAFE_ERROR_${status}_${route.path}`,
      );
    }
    if (route.path.includes("{")) {
      assert.equal(openApiOperation.responses?.["404"]?.$ref, "#/components/responses/AssessmentNotFound");
    }
    if (["patch", "delete"].includes(route.method) || route.method === "post") {
      assert.equal(openApiOperation.responses?.["409"]?.$ref, "#/components/responses/AssessmentConflict");
    }
    if (route.operationId === "assessment-workflow/generate-assessment-draft" || route.operationId === "assessment-workflow/retry-assessment-draft-job") {
      assert.ok(openApiOperation.responses?.["202"], `UNEXPECTED_ASYNC_ACCEPTED_${route.path}`);
    }
    if (route.operationId === "assessment-workflow/get-assessment-draft-job") {
      assert.ok(openApiOperation.responses?.["200"], `UNEXPECTED_JOB_POLL_RESPONSE_${route.path}`);
    }
    assert.ok(generatedSchema.includes(`"${route.path}": {`), `UNEXPECTED_GENERATED_PATH_${route.path}`);
    assert.ok(
      generatedSchema.includes(`${route.method}: operations["${route.operationId}"];`),
      `UNEXPECTED_GENERATED_OPERATION_${route.method}_${route.path}`,
    );
  }

  const riskFields = [
    "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact",
    "riskType", "riskOwner", "informationSystemImpacted", "informationAssetImpacted", "dataClassification",
    "inherentLikelihood", "highestInherentConsequence", "inherentRating", "inherentRatingRationale",
    "residualLikelihood", "highestResidualConsequence", "residualRating", "residualRatingRationale",
    "controlEffectiveness", "riskVelocity", "identifiedDate", "targetDate", "closureDate", "isExempted",
    "exemptionReviewDate", "escalationDetails", "comments", "riskCommunicationDate", "treatmentAction",
    "treatmentPlan", "treatmentOwner", "treatmentResolveDate", "treatmentStatus",
  ];
  const controlImplementationFields = [
    "control", "controlOwner", "controlStatus", "effectivenessRating", "evidence", "implementationDueDate",
    "implementedDate", "reviewDate",
  ];
  const riskMutation = specification.components?.schemas?.RiskMutationRequest;
  const controlMutation = specification.components?.schemas?.ControlImplementationMutationRequest;
  assert.deepEqual(Object.keys(riskMutation?.properties ?? {}), riskFields, "UNEXPECTED_RISK_MUTATION_FIELDS");
  assert.equal(riskMutation?.additionalProperties, false, "UNEXPECTED_RISK_MUTATION_OPEN_SHAPE");
  assert.deepEqual(Object.keys(controlMutation?.properties ?? {}), controlImplementationFields, "UNEXPECTED_CONTROL_MUTATION_FIELDS");
  assert.equal(controlMutation?.additionalProperties, false, "UNEXPECTED_CONTROL_MUTATION_OPEN_SHAPE");
  for (const blockedField of [
    "id", "documentId", "riskNumber", "assessment", "risk", "assessmentStatus", "approvedBy", "approvalDate",
    "generatedBy", "reviewedBy", "createdAt", "updatedAt", "publishedAt",
  ]) {
    assert.ok(!(blockedField in (riskMutation?.properties ?? {})), `UNEXPECTED_RISK_SERVER_FIELD_${blockedField}`);
    assert.ok(!(blockedField in (controlMutation?.properties ?? {})), `UNEXPECTED_CONTROL_SERVER_FIELD_${blockedField}`);
  }

  assert.deepEqual(specification.components?.schemas?.AssessmentRating?.enum, ["Low", "Moderate", "High", "Critical"]);
  assert.deepEqual(
    Object.keys(specification.components?.schemas?.ActiveUserSummary?.properties ?? {}),
    ["documentId", "displayName"],
    "UNEXPECTED_ACTIVE_USER_PROJECTION",
  );
  assert.equal(specification.components?.schemas?.ActiveUserSummary?.additionalProperties, false);
  const jobUnion = specification.components?.schemas?.AssessmentDraftJob?.oneOf ?? [];
  assert.deepEqual(
    jobUnion.map((entry: JsonObject) => entry.$ref),
    [
      "#/components/schemas/AssessmentDraftJobQueued", "#/components/schemas/AssessmentDraftJobRunning",
      "#/components/schemas/AssessmentDraftJobCompleted", "#/components/schemas/AssessmentDraftJobFailed",
    ],
  );
  assert.deepEqual(
    ["Queued", "Running", "Completed", "Failed"].map(
      (suffix) => specification.components.schemas[`AssessmentDraftJob${suffix}`].properties.status.const,
    ),
    ["queued", "running", "completed", "failed"],
  );

  for (const ambiguousPath of [
    "/v1/risk_assessments/{assessmentId}/submit_for_approval",
    "/v1/risk_assessments/{assessmentId}/approve",
    "/v1/risk_assessments/{assessmentId}/regenerate_draft",
  ]) {
    assert.ok(!specification.paths?.[ambiguousPath], `UNEXPECTED_AMBIGUOUS_OPENAPI_PATH_${ambiguousPath}`);
    assert.ok(!generatedSchema.includes(`"${ambiguousPath}": {`), `UNEXPECTED_AMBIGUOUS_GENERATED_PATH_${ambiguousPath}`);
  }
  const servedUrls = new Set(phase4ServedRoutes.map((route) => `${route.method.toUpperCase()}:/api${route.path}`));
  for (const unsafeUrl of [
    "GET:/api/csrm-assessments", "POST:/api/csrm-assessments", "GET:/api/csrm-assessments/{id}",
    "PUT:/api/csrm-assessments/{id}", "DELETE:/api/csrm-assessments/{id}", "GET:/api/csrm-risks",
    "POST:/api/csrm-risks", "GET:/api/csrm-risks/{id}", "PUT:/api/csrm-risks/{id}",
    "DELETE:/api/csrm-risks/{id}", "GET:/api/csrm-control-implementations",
    "POST:/api/csrm-control-implementations", "GET:/api/csrm-control-implementations/{id}",
    "PUT:/api/csrm-control-implementations/{id}", "DELETE:/api/csrm-control-implementations/{id}",
  ]) {
    assert.ok(!servedUrls.has(unsafeUrl), `UNEXPECTED_GENERIC_SERVED_ROUTE_${unsafeUrl}`);
    assert.ok(!catalogue.functionApis.some((entry: JsonObject) => entry.url === unsafeUrl), `UNEXPECTED_GENERIC_CATALOGUE_GRANT_${unsafeUrl}`);
  }

  const developmentPermissionSource = readFileSync(
    path.join(appDir, "src", "bootstrap", "reconcile-development-public-permissions.ts"),
    "utf8",
  );
  const developmentArray = developmentPermissionSource.match(/HISTORICAL_DEVELOPMENT_CONTENT_API_ACTIONS = \[([\s\S]*?)\] as const/)?.[1] ?? "";
  const developmentActions = [...developmentArray.matchAll(/"([^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(developmentActions, [
    "api::csrm-assessment-request.csrm-assessment-request.find",
    "api::csrm-assessment-request.csrm-assessment-request.findOne",
    "api::csrm-assessment-request.csrm-assessment-request.create",
    "api::csrm-assessment-request.csrm-assessment-request.update",
    "api::csrm-information-system.csrm-information-system.find",
    "api::csrm-information-asset.csrm-information-asset.find",
    "api::csrm-questionnaire.csrm-questionnaire.listMine",
    "api::csrm-questionnaire.csrm-questionnaire.statusSummary",
    "api::csrm-questionnaire.csrm-questionnaire.listAll",
    "api::csrm-questionnaire.csrm-questionnaire.reviewSummary",
    "api::csrm-questionnaire.csrm-questionnaire.findWorkflowOne",
    "api::csrm-questionnaire.csrm-questionnaire.listQuestions",
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
  ], "UNEXPECTED_DEVELOPMENT_PERMISSION_SURFACE");
  assert.ok(developmentActions.every((action) => action.startsWith("api::csrm-")), "UNEXPECTED_IAM_DEVELOPMENT_PERMISSION");
  assert.deepEqual(developmentActions.filter((action) => /api::csrm-(assessment|risk|control-implementation)\./.test(action)), [
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
  ], "UNEXPECTED_PHASE4_DEVELOPMENT_PERMISSION");
});

test("Phase 5 Risk Register list has a closed generated contract and exact catalogue parity", () => {
  const specification = parseJsonFile(
    path.join(repositoryDir, "docs", "references", "specification.json"),
    "UNEXPECTED_SPECIFICATION_PARSE",
  );
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const authoritativeBytes = readFileSync(authoritativePath);
  const bootstrapBytes = readFileSync(bootstrapPath);
  const catalogue = parseJsonFile(authoritativePath, "UNEXPECTED_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(
    path.join(repositoryDir, "apps", "web", "src", "lib", "api", "generated", "schema.d.ts"),
    "utf8",
  );

  assert.equal(Buffer.compare(authoritativeBytes, bootstrapBytes), 0, "UNEXPECTED_CATALOGUE_BYTE_DRIFT");
  const catalogueUrl = "GET:/api/v1/risks";
  const exactApis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
  assert.deepEqual(exactApis.map((entry: JsonObject) => entry.id), ["function.risk_register.risk_register.api.01"]);
  assert.deepEqual(exactApis.map((entry: JsonObject) => entry.functionId), ["function.risk_register.risk_register"]);
  assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl));
  assert.ok(!effectiveOperations(catalogue, "role.requestor").has(catalogueUrl));

  const register = operation(specification, "/v1/risks", "get");
  assert.equal(register.operationId, "risk-register/get-risks");
  assert.deepEqual(
    register.parameters.map((entry: JsonObject) => entry.name),
    [
      "q", "treatmentStatus", "inherentRating", "residualRating", "riskOwner", "treatmentOwner",
      "assessment", "system", "asset", "mitigationStatus", "targetDateFrom", "targetDateTo", "sort", "page", "pageSize",
    ],
  );
  for (const name of ["targetDateFrom", "targetDateTo"]) {
    assert.deepEqual(parameter(register, name), {
      name,
      in: "query",
      required: false,
      schema: { type: "string", format: "date" },
    });
  }
  assert.deepEqual(parameter(register, "sort")?.schema?.enum, [
    "riskNumber:asc", "riskNumber:desc", "riskStatement:asc", "riskStatement:desc",
    "inherentRating:asc", "inherentRating:desc", "residualRating:asc", "residualRating:desc",
    "treatmentStatus:asc", "treatmentStatus:desc", "treatmentOwner:asc", "treatmentOwner:desc",
    "targetDate:asc", "targetDate:desc", "assessment:asc", "assessment:desc",
  ]);
  assert.equal(parameter(register, "sort")?.schema?.default, "targetDate:asc");
  assert.deepEqual(parameter(register, "pageSize")?.schema?.enum, [10, 25, 50]);
  assert.equal(parameter(register, "pageSize")?.schema?.default, 25);
  assert.equal(parameter(register, "page")?.schema?.default, 1);
  assert.equal(register.responses?.["400"]?.$ref, "#/components/responses/RiskRegisterBadRequest");
  assert.equal(register.responses?.["403"]?.$ref, "#/components/responses/RiskRegisterForbidden");
  assert.equal(
    register.responses?.["200"]?.content?.["application/json"]?.schema?.$ref,
    "#/components/schemas/RiskRegisterResponse",
  );

  for (const schemaName of [
    "RiskRegisterResponse", "RiskRegisterItem", "RiskRegisterAssessment", "RiskRegisterUser",
    "RiskRegisterMeta", "RiskRegisterPagination", "RiskRegisterSelectedLabels", "RiskRegisterSelectedLabel",
  ]) {
    assert.equal(specification.components?.schemas?.[schemaName]?.additionalProperties, false, `UNEXPECTED_OPEN_${schemaName}`);
  }
  assert.ok("targetDate" in specification.components.schemas.RiskRegisterItem.properties);
  assert.ok(!("targetDateFrom" in specification.components.schemas.RiskRegisterItem.properties));
  assert.ok(!("targetDateTo" in specification.components.schemas.RiskRegisterItem.properties));
  assert.ok(generatedSchema.includes('"/v1/risks": {'));
  assert.ok(generatedSchema.includes('get: operations["risk-register/get-risks"];'));
  assert.ok(generatedSchema.includes("RiskRegisterResponse: {"));
  assert.match(generatedSchema, /targetDateFrom\?: string;\s+targetDateTo\?: string;\s+sort\?:/);

  const developmentPermissionSource = readFileSync(
    path.join(appDir, "src", "bootstrap", "reconcile-development-public-permissions.ts"),
    "utf8",
  );
  assert.ok(!developmentPermissionSource.includes("api::csrm-risk.csrm-risk.listRiskRegister"));
});

test("Phase 5 Risk detail has a closed generated contract and exact catalogue parity", () => {
  const specification = parseJsonFile(
    path.join(repositoryDir, "docs", "references", "specification.json"),
    "UNEXPECTED_SPECIFICATION_PARSE",
  );
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const catalogue = parseJsonFile(authoritativePath, "UNEXPECTED_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(
    path.join(repositoryDir, "apps", "web", "src", "lib", "api", "generated", "schema.d.ts"),
    "utf8",
  );

  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "UNEXPECTED_CATALOGUE_BYTE_DRIFT");
  const catalogueUrl = "GET:/api/v1/risks/{riskId}";
  const exactApis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
  assert.deepEqual(exactApis.map((entry: JsonObject) => entry.id), ["function.risk_register.risk_details.api.01"]);
  assert.deepEqual(exactApis.map((entry: JsonObject) => entry.functionId), ["function.risk_register.risk_details"]);
  assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl));
  assert.ok(!effectiveOperations(catalogue, "role.requestor").has(catalogueUrl));

  const detail = operation(specification, "/v1/risks/{riskId}", "get");
  assert.equal(detail.operationId, "risk-register/get-risk");
  assert.deepEqual(detail.parameters, [{ "$ref": "#/components/parameters/RiskId" }]);
  assert.equal(detail.responses?.["200"]?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/RiskDetailResponse");
  assert.equal(detail.responses?.["403"]?.$ref, "#/components/responses/RiskRegisterForbidden");
  assert.equal(detail.responses?.["404"]?.$ref, "#/components/responses/RiskDetailNotAvailable");
  assert.equal(detail.responses?.["409"]?.$ref, "#/components/responses/RiskDetailConflict");

  for (const schemaName of [
    "RiskDetailResponse", "RiskDetail", "RiskDetailRiskType", "RiskDetailNamedRelation",
    "RiskDetailUser", "RiskDetailAssessment", "RiskDetailControl", "RiskDetailControlImplementation",
    "RiskDetailErrorResponse",
  ]) {
    assert.equal(specification.components?.schemas?.[schemaName]?.additionalProperties, false, `UNEXPECTED_OPEN_${schemaName}`);
  }
  assert.deepEqual(specification.components.schemas.RiskDetail.properties.parentLock.enum, ["mutable", "released"]);
  assert.equal(specification.components.schemas.RiskDetail.properties.controlImplementations.maxItems, 1_000);
  assert.ok(!("data" in specification.components.schemas.RiskDetailErrorResponse.properties));
  assert.ok(generatedSchema.includes('get: operations["risk-register/get-risk"];'));
  assert.ok(generatedSchema.includes("RiskDetailResponse: {"));
});

test("PHASE2 RED contract and reference-data grants", async () => {
  const specification = parseJsonFile(
    path.join(repositoryDir, "docs", "references", "specification.json"),
    "UNEXPECTED_SPECIFICATION_PARSE",
  );
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const authoritativeBytes = readFileSync(authoritativePath);
  const bootstrapBytes = readFileSync(bootstrapPath);
  const catalogue = parseJsonFile(authoritativePath, "UNEXPECTED_CATALOGUE_PARSE");
  parseJsonFile(bootstrapPath, "UNEXPECTED_BOOTSTRAP_CATALOGUE_PARSE");
  assert.equal(Buffer.compare(authoritativeBytes, bootstrapBytes), 0, "UNEXPECTED_CATALOGUE_BYTE_DRIFT");

  const collectionGet = operation(specification, "/csrm-assessment-requests", "get");
  const detailGet = operation(specification, "/csrm-assessment-requests/{id}", "get");
  const create = operation(specification, "/csrm-assessment-requests", "post");
  const update = operation(specification, "/csrm-assessment-requests/{id}", "put");
  const missingFacts: string[] = [];

  for (const name of ["_q", "filters", "sort", "pagination[page]", "pagination[pageSize]"]) {
    if (!parameter(collectionGet, name)) missingFacts.push(`query:${name}`);
  }
  const collectionResponse = responseSchema(collectionGet);
  const pagination = collectionResponse.properties?.meta?.properties?.pagination;
  if (!pagination) missingFacts.push("response:meta.pagination");

  const populateItems = parameter(detailGet, "populate")?.schema?.anyOf
    ?.find((entry: JsonObject) => entry.type === "array")?.items?.enum;
  assert.ok(Array.isArray(populateItems), "UNEXPECTED_DETAIL_POPULATE_SCHEMA");
  for (const relation of ["informationSystems", "informationAssets", "questionnaire", "assessment"]) {
    if (!populateItems.includes(relation)) missingFacts.push(`populate:${relation}`);
  }

  const serverOwnedCreateFields = [
    "requestor",
    "requestNumber",
    "requestStatus",
    "submittedDate",
    "questionnaire",
    "assessment",
  ];
  const createProperties = requestDataProperties(create);
  for (const field of serverOwnedCreateFields) {
    if (field in createProperties) missingFacts.push(`create-server-owned:${field}`);
  }
  const createRequired = create.requestBody.content["application/json"].schema.properties.data.required ?? [];
  for (const field of serverOwnedCreateFields) {
    if (createRequired.includes(field)) missingFacts.push(`create-required-server-owned:${field}`);
  }
  const updateProperties = requestDataProperties(update);
  for (const field of ["requestor", "requestNumber", "submittedDate", "questionnaire", "assessment"]) {
    if (field in updateProperties) missingFacts.push(`update-server-owned:${field}`);
  }
  if (JSON.stringify(updateProperties.requestStatus?.enum) !== JSON.stringify(["submitted"])) {
    missingFacts.push("update:submitted-intent");
  }

  const deleteFunction = catalogue.functions.find(
    (entry: JsonObject) => entry.id === "function.risk_assessment_requests.delete_api",
  );
  assert.ok(deleteFunction, "UNEXPECTED_MISSING_DELETE_FUNCTION");
  assert.deepEqual(
    [...deleteFunction.roleIds].sort(),
    ["role.security_analyst", "role.security_analyst_agent"],
    "UNEXPECTED_DELETE_ROLE_SCOPE",
  );
  assert.deepEqual(
    deleteFunction.functionApiIds,
    ["function.risk_assessment_requests.delete_api.api.01"],
    "UNEXPECTED_DELETE_GRANT_SCOPE",
  );

  const referenceFunctionId = "function.risk_assessment_requests.reference_data_api";
  const referenceFunction = catalogue.functions.find((entry: JsonObject) => entry.id === referenceFunctionId);
  const expectedRoles = ["role.requestor", "role.security_analyst", "role.security_analyst_agent"];
  const expectedApis = [
    ["function.risk_assessment_requests.reference_data_api.api.01", "GET:/api/csrm-information-systems"],
    ["function.risk_assessment_requests.reference_data_api.api.02", "GET:/api/csrm-information-assets"],
  ] as const;
  if (!referenceFunction) {
    missingFacts.push("catalogue:reference-data-function");
  } else {
    if (referenceFunction.name !== "Assessment Request Reference Data API") missingFacts.push("catalogue:reference-data-name");
    if ("menuPath" in referenceFunction) missingFacts.push("catalogue:reference-data-menuPath");
    if (JSON.stringify([...referenceFunction.roleIds].sort()) !== JSON.stringify(expectedRoles)) missingFacts.push("catalogue:reference-data-roles");
    if (JSON.stringify(referenceFunction.functionApiIds) !== JSON.stringify(expectedApis.map(([id]) => id))) missingFacts.push("catalogue:reference-data-api-links");
  }
  for (const roleId of expectedRoles) {
    const role = catalogue.roles.find((entry: JsonObject) => entry.id === roleId);
    assert.ok(role, `UNEXPECTED_MISSING_ROLE_${roleId}`);
    if (!role.functionIds.includes(referenceFunctionId)) missingFacts.push(`catalogue:reciprocal-role:${roleId}`);
  }
  for (const [id, url] of expectedApis) {
    const exactMatches = catalogue.functionApis.filter((entry: JsonObject) => entry.url === url);
    if (exactMatches.length !== 1 || exactMatches[0]?.id !== id || exactMatches[0]?.functionId !== referenceFunctionId) {
      missingFacts.push(`catalogue:canonical-operation:${url}`);
    }
  }
  for (const roleId of expectedRoles) {
    const operations = effectiveOperations(catalogue, roleId);
    for (const [, url] of expectedApis) {
      if (!operations.has(url)) missingFacts.push(`catalogue:effective:${roleId}:${url}`);
    }
  }

  const harness = await harnessPromise;
  const mountedRequest = (url: string, identity: string, init: RequestInit = {}) =>
    harness.request({ path: url, identity, init });
  for (const url of ["/api/csrm-information-systems", "/api/csrm-information-assets"]) {
    const anonymous = await harness.request({ path: url, omitApiToken: true });
    assert.equal(anonymous.status, 403, `UNEXPECTED_ANONYMOUS_REFERENCE_READ_${url}`);
  }
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    for (const url of ["/api/csrm-information-systems", "/api/csrm-information-assets"]) {
      const response = await mountedRequest(url, identity);
      assert.equal(response.status, 200, `UNEXPECTED_REFERENCE_READ_${identity}_${url}`);
    }
    const iam = await harness.request({ path: "/api/idambox-users", identity, omitApiToken: true });
    assert.equal(iam.status, 403, `UNEXPECTED_IAM_STATUS_${identity}`);
    for (const method of ["POST", "PUT", "DELETE"]) {
      for (const url of ["/api/csrm-information-systems", "/api/csrm-information-assets"]) {
        const response = await mountedRequest(url, identity, { method });
        assert.ok(
          response.status === 403 || response.status === 405,
          `UNEXPECTED_INVENTORY_${method}_${identity}_${url}_${response.status}`,
        );
      }
    }
  }

  if (missingFacts.length > 0) {
    assert.fail(`PHASE2_RED_CONTRACT_REFERENCE_GRANTS_ABSENT: ${missingFacts.join(", ")}`);
  }
});

test("request revert contract, catalogue, generated types, and mounted route stay aligned", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "UNEXPECTED_REVERT_SPEC_PARSE");
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const catalogue = parseJsonFile(authoritativePath, "UNEXPECTED_REVERT_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "web", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  const route = "POST:/api/v1/assessment_requests/{requestId}/revert_to_draft";

  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "UNEXPECTED_REVERT_CATALOGUE_BYTE_DRIFT");
  const functionId = "function.risk_assessment_requests.revert_to_draft_api";
  const grant = catalogue.functionApis.filter((entry: JsonObject) => entry.url === route);
  assert.deepEqual(grant.map((entry: JsonObject) => entry.id), [`${functionId}.api.01`]);
  assert.deepEqual(grant.map((entry: JsonObject) => entry.functionId), [functionId]);
  assert.ok(effectiveOperations(catalogue, "role.requestor").has(route), "UNEXPECTED_REQUESTOR_REVERT_GRANT");
  assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(route), "UNEXPECTED_HUMAN_ANALYST_REVERT_GRANT");
  assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(route), "UNEXPECTED_AGENT_REVERT_GRANT");

  const operationValue = operation(specification, "/v1/assessment_requests/{requestId}/revert_to_draft", "post");
  assert.equal(operationValue.operationId, "assessment-workflow/revert-assessment-request-to-draft");
  assert.deepEqual(operationValue.parameters, [{ "$ref": "#/components/parameters/AssessmentRequestId" }]);
  assert.equal(operationValue.requestBody.content["application/json"].schema.$ref, "#/components/schemas/RevertReasonRequest");
  assert.deepEqual(specification.components.schemas.RevertReasonRequest, {
    type: "object",
    properties: { reason: { type: "string", minLength: 1, maxLength: 500 } },
    required: ["reason"],
    additionalProperties: false,
  });
  for (const status of ["400", "403", "404", "409"]) assert.ok(operationValue.responses[status], `UNEXPECTED_REVERT_${status}_RESPONSE`);
  assert.equal(operationValue.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/AssessmentRequestRevertResponse");
  assert.ok(generatedSchema.includes('"/v1/assessment_requests/{requestId}/revert_to_draft": {'), "UNEXPECTED_REVERT_GENERATED_PATH");
  assert.ok(generatedSchema.includes('post: operations["assessment-workflow/revert-assessment-request-to-draft"];'), "UNEXPECTED_REVERT_GENERATED_OPERATION");
});

const phase68GovernanceRoutes = [
  {
    method: "post",
    path: "/v1/questionnaires/{questionnaireId}/release",
    operationId: "questionnaire-workflow/release-questionnaire",
    functionId: "function.questionnaire_governance.release_api",
    requestBody: null,
  },
  {
    method: "post",
    path: "/v1/questionnaires/{questionnaireId}/return_to_review",
    operationId: "questionnaire-workflow/return-questionnaire-to-review",
    functionId: "function.questionnaire_governance.return_to_review_api",
    requestBody: "#/components/schemas/RevertReasonRequest",
  },
  {
    method: "post",
    path: "/v1/questionnaires/{questionnaireId}/questions",
    operationId: "questionnaire-workflow/add-questionnaire-question",
    functionId: "function.questionnaire_governance.add_question_api",
    requestBody: "#/components/schemas/QuestionnaireQuestionMutationRequest",
  },
  {
    method: "patch",
    path: "/v1/questionnaires/{questionnaireId}/questions/{questionId}",
    operationId: "questionnaire-workflow/edit-questionnaire-question",
    functionId: "function.questionnaire_governance.edit_question_api",
    requestBody: "#/components/schemas/QuestionnaireQuestionMutationRequest",
  },
  {
    method: "delete",
    path: "/v1/questionnaires/{questionnaireId}/questions/{questionId}",
    operationId: "questionnaire-workflow/delete-questionnaire-question",
    functionId: "function.questionnaire_governance.delete_question_api",
    requestBody: null,
  },
] as const;

/*
 * The whole Phase 06.8 governance surface is published once, before any later
 * plan mounts a handler. Each operation is granted to the human Security
 * Analyst and to nobody else: automation cannot release a questionnaire or
 * rewrite its questions, and the Requestor reaches none of these operations.
 */
test("Phase 06.8 questionnaire governance surface is published and human-analyst only", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE68_SPECIFICATION_PARSE");
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const catalogue = parseJsonFile(authoritativePath, "PHASE68_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "web", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE68_CATALOGUE_BYTE_DRIFT");

  const analystOperations = effectiveOperations(catalogue, "role.security_analyst");
  const agentOperations = effectiveOperations(catalogue, "role.security_analyst_agent");
  const requestorOperations = effectiveOperations(catalogue, "role.requestor");

  for (const route of phase68GovernanceRoutes) {
    const catalogueUrl = `${route.method.toUpperCase()}:/api${route.path}`;
    const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === route.functionId);
    assert.equal(functions.length, 1, `PHASE68_FUNCTION_MISSING_${route.functionId}`);
    assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], `PHASE68_ROLE_SCOPE_${route.functionId}`);
    assert.equal("menuPath" in functions[0], false, `PHASE68_UNEXPECTED_MENU_PATH_${route.functionId}`);
    const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
    assert.equal(apis.length, 1, `PHASE68_FUNCTION_API_COUNT_${catalogueUrl}`);
    assert.equal(apis[0].functionId, route.functionId, `PHASE68_FUNCTION_API_LINK_${catalogueUrl}`);
    assert.deepEqual(functions[0].functionApiIds, [apis[0].id], `PHASE68_FUNCTION_API_BACKLINK_${catalogueUrl}`);
    assert.ok(analystOperations.has(catalogueUrl), `PHASE68_ANALYST_GRANT_${catalogueUrl}`);
    assert.ok(!agentOperations.has(catalogueUrl), `PHASE68_AGENT_GRANT_${catalogueUrl}`);
    assert.ok(!requestorOperations.has(catalogueUrl), `PHASE68_REQUESTOR_GRANT_${catalogueUrl}`);

    const contract = operation(specification, route.path, route.method);
    assert.equal(contract.operationId, route.operationId, `PHASE68_OPERATION_${route.method}_${route.path}`);
    assert.equal(
      contract.parameters?.[0]?.$ref,
      "#/components/parameters/QuestionnaireId",
      `PHASE68_QUESTIONNAIRE_ID_PARAMETER_${route.path}`,
    );
    if (route.path.includes("{questionId}")) {
      assert.equal(
        contract.parameters?.[1]?.$ref,
        "#/components/parameters/QuestionId",
        `PHASE68_QUESTION_ID_PARAMETER_${route.path}`,
      );
    }
    for (const [status, reference] of [
      ["400", "#/components/responses/QuestionnaireBadRequest"],
      ["403", "#/components/responses/QuestionnaireForbidden"],
      ["404", "#/components/responses/QuestionnaireNotFound"],
      ["409", "#/components/responses/QuestionnaireConflict"],
    ] as const) {
      assert.equal(contract.responses?.[status]?.$ref, reference, `PHASE68_SAFE_ERROR_${status}_${route.method}_${route.path}`);
    }
    const success = contract.responses?.["200"]?.content?.["application/json"]?.schema?.$ref;
    assert.equal(
      success,
      route.operationId === "questionnaire-workflow/release-questionnaire"
        ? "#/components/schemas/QuestionnaireReleaseResponse"
        : "#/components/schemas/QuestionnaireGovernanceResponse",
      `PHASE68_SUCCESS_SCHEMA_${route.method}_${route.path}`,
    );
    const body = contract.requestBody?.content?.["application/json"]?.schema;
    if (route.requestBody === null) {
      assert.equal(contract.requestBody, undefined, `PHASE68_UNEXPECTED_REQUEST_BODY_${route.method}_${route.path}`);
    } else {
      const references = body?.$ref
        ? [body.$ref]
        : (body?.allOf ?? []).map((entry: JsonObject) => entry.$ref).filter(Boolean);
      assert.ok(references.includes(route.requestBody), `PHASE68_REQUEST_BODY_${route.method}_${route.path}`);
    }
    assert.ok(generatedSchema.includes(`"${route.path}": {`), `PHASE68_GENERATED_PATH_${route.path}`);
    assert.ok(
      generatedSchema.includes(`${route.method}: operations["${route.operationId}"];`),
      `PHASE68_GENERATED_OPERATION_${route.method}_${route.path}`,
    );
  }

  // Every new request and response component is a closed shape: an unexpected
  // key is a rejection rather than a silently accepted extra field.
  for (const schemaName of [
    "QuestionnaireQuestionMutationRequest",
    "QuestionnaireGovernanceEvent",
    "QuestionnaireClearedAnswer",
    "QuestionnaireRevision",
    "QuestionnaireGovernanceResponse",
    "QuestionnaireRelease",
    "QuestionnaireReleaseActor",
    "QuestionnaireReleaseResponse",
    "AssessmentRequestLifecycle",
    "AssessmentRequestLifecycleStep",
    "AssessmentRequestLifecycleNextAction",
  ]) {
    const schema = specification.components?.schemas?.[schemaName];
    assert.ok(schema, `PHASE68_MISSING_SCHEMA_${schemaName}`);
    assert.equal(schema.additionalProperties, false, `PHASE68_OPEN_SHAPE_${schemaName}`);
    assert.ok(generatedSchema.includes(`${schemaName}: {`), `PHASE68_GENERATED_SCHEMA_${schemaName}`);
  }
  /*
   * These two were originally an allOf of QuestionnaireSummary plus a second
   * additionalProperties:false branch. Under JSON Schema, allOf requires an
   * instance to satisfy every branch INDEPENDENTLY: each closed branch only
   * recognises its own declared properties, so a real response carrying
   * fields from both branches (e.g. `title` from the summary branch alongside
   * `clearedAnswers` from the second) was rejected by whichever branch didn't
   * declare it — the composition was unsatisfiable by any real payload
   * (06.8-REVIEW.md CR-02). Both are now flattened into one closed object
   * schema that declares every field the server actually returns.
   */
  for (const schemaName of ["QuestionnaireGovernanceResult", "QuestionnaireReleaseResult"]) {
    const schema = specification.components?.schemas?.[schemaName];
    assert.ok(schema, `PHASE68_MISSING_RESULT_${schemaName}`);
    assert.equal(schema.allOf, undefined, `PHASE68_RESULT_STILL_UNSATISFIABLE_ALLOF_${schemaName}`);
    assert.equal(schema.type, "object", `PHASE68_RESULT_NOT_OBJECT_${schemaName}`);
    assert.equal(schema.additionalProperties, false, `PHASE68_OPEN_RESULT_${schemaName}`);
  }

  assert.deepEqual(
    specification.components.schemas.QuestionnaireGovernanceEvent.properties.kind.enum,
    ["released", "returned-to-review", "question-added", "question-edited", "question-deleted", "answer-cleared"],
    "PHASE68_GOVERNANCE_EVENT_KINDS",
  );
  assert.deepEqual(
    specification.components.schemas.AssessmentRequestLifecycleStep.properties.state.enum,
    ["completed", "current", "future"],
    "PHASE68_LIFECYCLE_STEP_STATES",
  );

  // The request-detail read declares the derived lifecycle projection.
  const requestDetail = operation(specification, "/csrm-assessment-requests/{id}", "get");
  const detailProperties = requestDetail.responses["200"].content["application/json"].schema.properties.data.properties;
  assert.equal(detailProperties.lifecycle?.$ref, "#/components/schemas/AssessmentRequestLifecycle", "PHASE68_REQUEST_LIFECYCLE_PROPERTY");

  // The analyst queue declares exactly the four documented filters.
  const queue = operation(specification, "/v1/assessment_requests", "get");
  assert.deepEqual(
    parameter(queue, "filters[queue]")?.schema?.enum,
    ["requires-attention", "awaiting-requestor", "generation-in-progress", "released"],
    "PHASE68_QUEUE_FILTER_VALUES",
  );

  // The controls tally belongs to the available assessment relation only: an
  // unavailable relation must carry no fact about the record it hides.
  const available = specification.components.schemas.RequestAssessmentRelationAvailable;
  assert.ok(available.properties.controlImplementationCount, "PHASE68_MISSING_CONTROL_IMPLEMENTATION_COUNT");
  assert.deepEqual(
    available.properties.controlImplementationCount,
    { type: "integer", minimum: 0 },
    "PHASE68_CONTROL_IMPLEMENTATION_COUNT_SHAPE",
  );
  assert.equal(available.required.includes("controlImplementationCount"), false, "PHASE68_CONTROL_IMPLEMENTATION_COUNT_REQUIRED");
  assert.deepEqual(
    Object.keys(specification.components.schemas.RelationUnavailable.properties),
    ["availability"],
    "PHASE68_UNAVAILABLE_RELATION_DISCLOSURE",
  );
  assert.deepEqual(
    Object.keys(specification.components.schemas.RelationAbsent.properties),
    ["availability"],
    "PHASE68_ABSENT_RELATION_DISCLOSURE",
  );
});
