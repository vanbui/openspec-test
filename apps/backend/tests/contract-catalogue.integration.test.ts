import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { ALERT_LINK_TYPES, ALERT_SOURCE_TYPES } from "../src/api/csrm-analyst-insight/services/alert-repository";
import { HIGH_CRITICAL_RATINGS } from "../src/api/csrm-analyst-insight/services/dashboard-summary";
import { REPORT_DEFINITIONS, REPORT_KEYS } from "../src/api/csrm-analyst-insight/services/report-definitions";
import { RISK_REGISTER_STATES } from "../src/api/csrm-risk/services/risk-register-query";
import { ALERT_KINDS, ALERT_URGENCIES } from "../src/csrm/insights/alert-rules";
import {
  ALERT_PAGE_SIZES,
  DASHBOARD_WIDGET_ROW_LIMIT,
  EXPOSED_SYSTEMS_LIMIT,
  MOST_OVERDUE_TREATMENTS_LIMIT,
  RECENT_ACTIVITY_LIMIT,
  THROUGHPUT_DEFAULT_PERIOD,
  THROUGHPUT_PERIODS,
} from "../src/csrm/insights/insight-constants";
import { ACTIVITY_KINDS, ACTIVITY_RECORD_TYPES } from "../src/csrm/insights/recent-activity";
import { TREATMENT_DUE_STATES } from "../src/csrm/insights/treatment-due-state";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

type JsonObject = Record<string, any>;

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
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
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
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
    path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"),
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
    path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"),
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
    path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"),
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
  // Phase 7 (D-36) adds the closed `state` filter after mitigationStatus, so the
  // target-date pair still sits directly before sort (the regex below).
  assert.deepEqual(
    register.parameters.map((entry: JsonObject) => entry.name),
    [
      "q", "treatmentStatus", "inherentRating", "residualRating", "riskOwner", "treatmentOwner",
      "assessment", "system", "asset", "mitigationStatus", "state", "targetDateFrom", "targetDateTo", "sort", "page", "pageSize",
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
    path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"),
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
  // The grants above stay catalogued for traceability, but D-44 unmounts the
  // generic reference-data reads: the served /v1/information_* selectors are
  // the only read surface, so every request to the generic bases, anonymous or
  // identified, meets no route at all. The IAM base meets no route either
  // (D-36); docs/references/served-operations.json records both as unserved.
  for (const url of ["/api/csrm-information-systems", "/api/csrm-information-assets"]) {
    const anonymous = await harness.request({ path: url, omitApiToken: true });
    assert.equal(anonymous.status, 404, `UNEXPECTED_ANONYMOUS_REFERENCE_READ_${url}`);
  }
  for (const identity of [harness.identities.owner, harness.identities.analyst]) {
    for (const url of ["/api/csrm-information-systems", "/api/csrm-information-assets"]) {
      const response = await mountedRequest(url, identity);
      assert.equal(response.status, 404, `UNEXPECTED_REFERENCE_READ_${identity}_${url}`);
    }
    const iam = await harness.request({ path: "/api/idambox-users", identity, omitApiToken: true });
    assert.equal(iam.status, 404, `UNEXPECTED_IAM_STATUS_${identity}`);
    // koa answers a mutation on any unmounted /api path with 405 and
    // `Allow: HEAD, GET`, exactly as it does for a path that never existed.
    for (const method of ["POST", "PUT", "DELETE"]) {
      for (const url of ["/api/csrm-information-systems", "/api/csrm-information-assets"]) {
        const response = await mountedRequest(url, identity, { method });
        assert.ok(
          response.status === 404 || response.status === 405,
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
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
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
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
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
    // Phase 10 D-10 adds `regenerated` (the 06.8 record's Phase 10 amendment, part two).
    ["released", "returned-to-review", "question-added", "question-edited", "question-deleted", "answer-cleared", "regenerated"],
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

/*
 * GAP-1 (06.9-04): the two Analyst list filters offer the complete datamodel
 * vocabularies, so the published parameters must accept exactly those values.
 * The request queue filter intersects with the selected queue, and the
 * description has to say so, because a client reading the enum alone would
 * expect every value to return records in every queue.
 */
test("Phase 06.9 list status filters publish the complete datamodel vocabularies", () => {
  const specification = parseJsonFile(
    path.join(repositoryDir, "docs", "references", "specification.json"),
    "UNEXPECTED_SPECIFICATION_PARSE",
  );
  const generatedSchema = readFileSync(
    path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"),
    "utf8",
  );
  const contentType = (name: string) => parseJsonFile(
    path.join(appDir, "src", "api", name, "content-types", name, "schema.json"),
    `UNEXPECTED_CONTENT_TYPE_PARSE_${name}`,
  );
  const requestStatuses: string[] = contentType("csrm-assessment-request").attributes.requestStatus.enum;
  const assessmentStatuses: string[] = contentType("csrm-assessment").attributes.assessmentStatus.enum;
  const union = (values: readonly string[]) => values.map((value) => `"${value}"`).join(" | ");

  const requestStatus = parameter(operation(specification, "/v1/assessment_requests", "get"), "filters[requestStatus]");
  assert.deepEqual(requestStatus?.schema?.enum, requestStatuses, "PHASE69_REQUEST_STATUS_FILTER_VOCABULARY");
  assert.match(String(requestStatus?.description ?? ""), /intersect/i, "PHASE69_REQUEST_STATUS_FILTER_SEMANTICS");
  assert.ok(
    generatedSchema.includes(`"filters[requestStatus]"?: ${union(requestStatuses)};`),
    "PHASE69_GENERATED_REQUEST_STATUS_FILTER",
  );

  for (const pathName of ["/v1/risk_assessments", "/v1/my_risk_assessments"]) {
    const status = parameter(operation(specification, pathName, "get"), "status");
    assert.deepEqual(status?.schema?.enum, assessmentStatuses, `PHASE69_ASSESSMENT_STATUS_FILTER_VOCABULARY_${pathName}`);
    assert.equal(typeof status?.description, "string", `PHASE69_ASSESSMENT_STATUS_FILTER_SEMANTICS_${pathName}`);
  }
  assert.equal(
    generatedSchema.split(`status?: ${union(assessmentStatuses)};`).length - 1,
    2,
    "PHASE69_GENERATED_ASSESSMENT_STATUS_FILTERS",
  );

  // The queue response carries every status a review queue reads. The Released
  // queue returns approved and closed requests, and no queue ever returns a draft,
  // so a closed client parser built from a narrower enum would turn every
  // populated Released queue into an error.
  assert.deepEqual(
    specification.components?.schemas?.AssessmentRequestQueueItem?.properties?.requestStatus?.enum,
    requestStatuses.filter((status) => status !== "draft"),
    "PHASE69_QUEUE_ITEM_STATUS_VOCABULARY",
  );
});

/* D-07: one API-only, human-analyst-only Function per served analyst insight operation. */
const phase7InsightFunctions = [
  { functionId: "function.dashboard.summary_api", url: "GET:/api/v1/dashboard/summary" },
  { functionId: "function.alerts.list_api", url: "GET:/api/v1/alerts" },
  { functionId: "function.alerts.summary_api", url: "GET:/api/v1/alerts/summary" },
  { functionId: "function.reports.list_api", url: "GET:/api/v1/reports" },
  { functionId: "function.reports.run_api", url: "GET:/api/v1/reports/{reportKey}" },
] as const;

/* D-06: catalogued, unserved, and kept under their menu Functions. */
const phase7UnservedOperations = [
  { method: "GET", path: "/v1/dashboard/reports", functionId: "function.dashboard.dashboard" },
  { method: "GET", path: "/v1/dashboard/alerts", functionId: "function.dashboard.dashboard" },
  { method: "GET", path: "/v1/alerts/{alertId}", functionId: "function.reports.alerts" },
  { method: "PATCH", path: "/v1/alerts/{alertId}/acknowledge", functionId: "function.reports.alerts" },
  { method: "POST", path: "/v1/reports/{reportKey}/export", functionId: "function.reports.reports" },
] as const;

test("Phase 7 analyst insight grants are API-only and human-analyst only", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE7_SPECIFICATION_PARSE");
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const catalogue = parseJsonFile(authoritativePath, "PHASE7_CATALOGUE_PARSE");
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE7_CATALOGUE_BYTE_DRIFT");

  const analystOperations = effectiveOperations(catalogue, "role.security_analyst");
  const agentOperations = effectiveOperations(catalogue, "role.security_analyst_agent");
  const requestorOperations = effectiveOperations(catalogue, "role.requestor");
  const menuFunctionNames = new Set(
    catalogue.functions.filter((entry: JsonObject) => "menuPath" in entry).map((entry: JsonObject) => entry.name),
  );

  for (const insight of phase7InsightFunctions) {
    const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === insight.functionId);
    assert.equal(functions.length, 1, `PHASE7_FUNCTION_MISSING_${insight.functionId}`);
    assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], `PHASE7_ROLE_SCOPE_${insight.functionId}`);
    assert.equal("menuPath" in functions[0], false, `PHASE7_UNEXPECTED_MENU_PATH_${insight.functionId}`);
    // D-33: the seed reconciles an API-only Function by name, so it must never share a menu Function's name.
    assert.equal(menuFunctionNames.has(functions[0].name), false, `PHASE7_NAME_COLLIDES_WITH_MENU_${insight.functionId}`);
    assert.equal(
      catalogue.functions.filter((entry: JsonObject) => entry.name === functions[0].name).length,
      1,
      `PHASE7_DUPLICATE_FUNCTION_NAME_${insight.functionId}`,
    );

    const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === insight.url);
    assert.equal(apis.length, 1, `PHASE7_FUNCTION_API_COUNT_${insight.url}`);
    assert.equal(apis[0].id, `${insight.functionId}.api.01`, `PHASE7_FUNCTION_API_ID_${insight.url}`);
    assert.equal(apis[0].functionId, insight.functionId, `PHASE7_FUNCTION_API_LINK_${insight.url}`);
    assert.deepEqual(functions[0].functionApiIds, [apis[0].id], `PHASE7_FUNCTION_API_BACKLINK_${insight.url}`);

    assert.ok(analystOperations.has(insight.url), `PHASE7_ANALYST_GRANT_${insight.url}`);
    assert.ok(!agentOperations.has(insight.url), `PHASE7_AGENT_GRANT_${insight.url}`);
    assert.ok(!requestorOperations.has(insight.url), `PHASE7_REQUESTOR_GRANT_${insight.url}`);
  }

  // The menu Functions stay as UI Functions and carry no served analyst insight API.
  for (const [functionId, functionApiIds] of [
    ["function.dashboard.dashboard", ["function.dashboard.dashboard.api.02", "function.dashboard.dashboard.api.03"]],
    ["function.reports.reports", ["function.reports.reports.api.03"]],
    ["function.reports.alerts", ["function.reports.alerts.api.03", "function.reports.alerts.api.04"]],
  ] as const) {
    const menuFunction = catalogue.functions.find((entry: JsonObject) => entry.id === functionId);
    assert.ok(menuFunction, `PHASE7_MENU_FUNCTION_MISSING_${functionId}`);
    assert.deepEqual(menuFunction.functionApiIds, functionApiIds, `PHASE7_MENU_FUNCTION_APIS_${functionId}`);
  }

  for (const unserved of phase7UnservedOperations) {
    const catalogueUrl = `${unserved.method}:/api${unserved.path}`;
    const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
    assert.equal(apis.length, 1, `PHASE7_UNSERVED_CATALOGUE_COUNT_${catalogueUrl}`);
    assert.equal(apis[0].functionId, unserved.functionId, `PHASE7_UNSERVED_OWNER_${catalogueUrl}`);
    assert.equal(specification.paths?.[unserved.path], undefined, `PHASE7_UNSERVED_PATH_PUBLISHED_${unserved.path}`);
  }

  // D-28 serves the reserved Requestor status summary unchanged.
  const statusSummaryUrl = "GET:/api/v1/my_requests/status_summary";
  const statusSummary = catalogue.functionApis.filter((entry: JsonObject) => entry.url === statusSummaryUrl);
  assert.deepEqual(
    statusSummary.map((entry: JsonObject) => [entry.id, entry.functionId]),
    [["function.risk_assessment_requests.my_requests.api.02", "function.risk_assessment_requests.my_requests"]],
    "PHASE7_REQUESTOR_STATUS_SUMMARY_ENTRY",
  );
  assert.ok(requestorOperations.has(statusSummaryUrl), "PHASE7_REQUESTOR_STATUS_SUMMARY_GRANT");

  // D-06: one design note names every unserved operation and says why.
  const unservedNames = phase7UnservedOperations.map((unserved) => `${unserved.method} /api${unserved.path}`);
  assert.equal(
    catalogue.designNotes.filter((note: string) => unservedNames.every((name) => note.includes(name))).length,
    1,
    "PHASE7_UNSERVED_DESIGN_NOTE",
  );
});

/*
 * D-05, D-28: the catalogue-reserved Requestor status summary is published
 * exactly as reserved. The Requestor role holds it through My Requests and the
 * birthright extends it to every actor, so no other role carries its own grant.
 * The counts are one closed key per datamodel request status, plus the total.
 */
test("Phase 7 Requestor status summary is published closed and granted through My Requests", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE7_SUMMARY_SPECIFICATION_PARSE");
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const catalogue = parseJsonFile(authoritativePath, "PHASE7_SUMMARY_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE7_SUMMARY_CATALOGUE_BYTE_DRIFT");

  const catalogueUrl = "GET:/api/v1/my_requests/status_summary";
  const functionId = "function.risk_assessment_requests.my_requests";
  const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
  assert.deepEqual(
    apis.map((entry: JsonObject) => [entry.id, entry.functionId]),
    [[`${functionId}.api.02`, functionId]],
    "PHASE7_SUMMARY_FUNCTION_API",
  );
  const myRequests = catalogue.functions.find((entry: JsonObject) => entry.id === functionId);
  assert.ok(myRequests, "PHASE7_SUMMARY_FUNCTION_MISSING");
  assert.deepEqual(myRequests.roleIds, ["role.requestor"], "PHASE7_SUMMARY_FUNCTION_ROLES");
  assert.ok(myRequests.functionApiIds.includes(`${functionId}.api.02`), "PHASE7_SUMMARY_FUNCTION_BACKLINK");
  assert.ok(effectiveOperations(catalogue, "role.requestor").has(catalogueUrl), "PHASE7_SUMMARY_REQUESTOR_GRANT");
  assert.ok(!effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), "PHASE7_SUMMARY_EXPLICIT_ANALYST_GRANT");
  assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(catalogueUrl), "PHASE7_SUMMARY_EXPLICIT_AGENT_GRANT");

  const summary = operation(specification, "/v1/my_requests/status_summary", "get");
  assert.equal(summary.operationId, "assessment-workflow/get-my-request-status-summary", "PHASE7_SUMMARY_OPERATION_ID");
  assert.deepEqual(summary.tags, ["assessment-workflow"], "PHASE7_SUMMARY_TAGS");
  assert.equal(summary.parameters, undefined, "PHASE7_SUMMARY_TAKES_NO_PARAMETERS");
  assert.equal(summary.requestBody, undefined, "PHASE7_SUMMARY_TAKES_NO_BODY");
  assert.deepEqual(Object.keys(summary.responses).sort(), ["200", "400", "403"], "PHASE7_SUMMARY_RESPONSES");
  assert.equal(responseSchema(summary).$ref, "#/components/schemas/MyRequestStatusSummaryResponse", "PHASE7_SUMMARY_SUCCESS_SCHEMA");
  assert.equal(summary.responses["400"].$ref, "#/components/responses/AssessmentBadRequest", "PHASE7_SUMMARY_400");
  assert.equal(summary.responses["403"].$ref, "#/components/responses/AssessmentForbidden", "PHASE7_SUMMARY_403");

  assert.deepEqual(specification.components.schemas.MyRequestStatusSummaryResponse, {
    type: "object",
    properties: { data: { $ref: "#/components/schemas/MyRequestStatusSummary" } },
    required: ["data"],
    additionalProperties: false,
  }, "PHASE7_SUMMARY_RESPONSE_SHAPE");
  const counts = specification.components.schemas.MyRequestStatusSummary;
  const requestStatuses: string[] = parseJsonFile(
    path.join(appDir, "src", "api", "csrm-assessment-request", "content-types", "csrm-assessment-request", "schema.json"),
    "PHASE7_SUMMARY_CONTENT_TYPE_PARSE",
  ).attributes.requestStatus.enum;
  const camelCase = (value: string) => value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  const keys = [...requestStatuses.map(camelCase), "total"];
  assert.deepEqual(keys, [
    "draft", "submitted", "questionnaireInProgress", "riskAssessmentDrafted", "underReview", "approved", "closed", "total",
  ], "PHASE7_SUMMARY_DATAMODEL_VOCABULARY");
  assert.equal(counts?.type, "object", "PHASE7_SUMMARY_COUNTS_TYPE");
  assert.deepEqual(Object.keys(counts.properties), keys, "PHASE7_SUMMARY_COUNT_KEYS");
  for (const key of keys) {
    assert.deepEqual(counts.properties[key], { type: "integer", minimum: 0 }, `PHASE7_SUMMARY_COUNT_SHAPE_${key}`);
  }
  assert.deepEqual(counts.required, keys, "PHASE7_SUMMARY_COUNTS_REQUIRED");
  assert.equal(counts.additionalProperties, false, "PHASE7_SUMMARY_COUNTS_OPEN");

  assert.ok(generatedSchema.includes('"/v1/my_requests/status_summary": {'), "PHASE7_SUMMARY_GENERATED_PATH");
  assert.ok(
    generatedSchema.includes('get: operations["assessment-workflow/get-my-request-status-summary"];'),
    "PHASE7_SUMMARY_GENERATED_OPERATION",
  );
  assert.ok(generatedSchema.includes("MyRequestStatusSummaryResponse: {"), "PHASE7_SUMMARY_GENERATED_RESPONSE");
  assert.ok(generatedSchema.includes("MyRequestStatusSummary: {"), "PHASE7_SUMMARY_GENERATED_COUNTS");
});

/*
 * D-04, D-26: every Risk Register row carries the server-derived treatment due
 * state. The published vocabulary is exactly the one the shared insight rule
 * derives, so the contract, the server and the web client agree on one list.
 */
test("Phase 7 Risk Register rows publish the server-derived treatment due state", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE7_DUE_STATE_SPECIFICATION_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  const dueStates = ["overdue", "due-soon", "later", "no-target-date", "complete-or-closed"];

  const dueState = specification.components?.schemas?.TreatmentDueState;
  assert.ok(dueState, "PHASE7_DUE_STATE_COMPONENT_MISSING");
  assert.equal(dueState.type, "string", "PHASE7_DUE_STATE_TYPE");
  assert.deepEqual(dueState.enum, dueStates, "PHASE7_DUE_STATE_VOCABULARY");
  assert.deepEqual(dueState.enum, [...TREATMENT_DUE_STATES], "PHASE7_DUE_STATE_DIVERGES_FROM_THE_SHARED_RULE");

  const item = specification.components.schemas.RiskRegisterItem;
  assert.deepEqual(item.properties.treatmentDueState, { $ref: "#/components/schemas/TreatmentDueState" }, "PHASE7_DUE_STATE_PROPERTY");
  assert.ok(item.required.includes("treatmentDueState"), "PHASE7_DUE_STATE_NOT_REQUIRED");
  assert.deepEqual([...item.required].sort(), Object.keys(item.properties).sort(), "PHASE7_REGISTER_ROW_NOT_FULLY_REQUIRED");
  assert.equal(item.additionalProperties, false, "PHASE7_REGISTER_ROW_OPEN");
  assert.ok(!("closureDate" in item.properties), "PHASE7_REGISTER_ROW_DISCLOSES_CLOSURE_DATE");

  assert.ok(
    generatedSchema.includes(`TreatmentDueState: ${dueStates.map((value) => `"${value}"`).join(" | ")};`),
    "PHASE7_DUE_STATE_GENERATED_UNION",
  );
  assert.ok(
    generatedSchema.includes('treatmentDueState: components["schemas"]["TreatmentDueState"];'),
    "PHASE7_DUE_STATE_GENERATED_PROPERTY",
  );
});

/*
 * D-36: the Risk Register takes a closed `state` filter, so every open-exposure
 * figure can link to a list whose total equals it. The published values are
 * exactly the ones the server parser accepts.
 */
test("Phase 7 Risk Register publishes the closed open and closed state filter", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE7_STATE_SPECIFICATION_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  const register = operation(specification, "/v1/risks", "get");

  assert.deepEqual(parameter(register, "state"), {
    name: "state",
    in: "query",
    required: false,
    schema: { type: "string", enum: ["open", "closed"] },
    description: "open: no closure date recorded. closed: a closure date is recorded. Absent returns both.",
  }, "PHASE7_STATE_PARAMETER");
  assert.deepEqual(parameter(register, "state")?.schema?.enum, [...RISK_REGISTER_STATES], "PHASE7_STATE_DIVERGES_FROM_THE_PARSER");
  const names = register.parameters.map((entry: JsonObject) => entry.name);
  assert.equal(names.indexOf("state"), names.indexOf("mitigationStatus") + 1, "PHASE7_STATE_POSITION");
  assert.equal(names.filter((name: string) => name === "state").length, 1, "PHASE7_STATE_DUPLICATED");
  assert.match(generatedSchema, /mitigationStatus\?: "Existing" \| "Planned" \| "Implemented" \| "Retired" \| "none";\s+\/\*\* @description open: no closure date recorded\. closed: a closure date is recorded\. Absent returns both\. \*\/\s+state\?: "open" \| "closed";\s+targetDateFrom\?: string;/, "PHASE7_STATE_GENERATED_QUERY");
});

/*
 * D-05, D-08, D-10, D-11, D-12: the two served alert operations are published
 * with closed components. The kind and urgency vocabularies are exactly the
 * shared rule's, the source and link types exactly the repository's, and the
 * page sizes exactly the named constant. Every string is unpatterned, so the
 * web parsers never pin a format the contract does not promise.
 */
test("Phase 7 analyst alerts are published closed and match the shared alert vocabulary", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE7_ALERT_SPECIFICATION_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  const schemas = specification.components?.schemas ?? {};
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });

  const list = operation(specification, "/v1/alerts", "get");
  assert.equal(list.operationId, "analyst-insights/get-alerts", "PHASE7_ALERT_LIST_OPERATION_ID");
  assert.deepEqual(list.tags, ["analyst-insights"], "PHASE7_ALERT_LIST_TAGS");
  assert.equal(list.requestBody, undefined, "PHASE7_ALERT_LIST_TAKES_NO_BODY");
  assert.deepEqual(list.parameters.map((entry: JsonObject) => entry.name), ["kind", "urgency", "page", "pageSize"], "PHASE7_ALERT_LIST_PARAMETERS");
  assert.deepEqual(parameter(list, "kind"), {
    name: "kind",
    in: "query",
    required: false,
    style: "form",
    explode: true,
    description: "One or more alert kinds, each at most once. Absent lists every kind.",
    schema: { type: "array", items: ref("AlertKind"), minItems: 1, maxItems: 8, uniqueItems: true },
  }, "PHASE7_ALERT_KIND_PARAMETER");
  assert.deepEqual(parameter(list, "urgency"), { name: "urgency", in: "query", required: false, schema: ref("AlertUrgency") }, "PHASE7_ALERT_URGENCY_PARAMETER");
  assert.deepEqual(parameter(list, "page"), {
    name: "page", in: "query", required: false, schema: { type: "integer", minimum: 1, maximum: 1000000, default: 1 },
  }, "PHASE7_ALERT_PAGE_PARAMETER");
  assert.deepEqual(parameter(list, "pageSize"), {
    name: "pageSize", in: "query", required: false, schema: { type: "integer", enum: [5, 10, 25, 50], minimum: 5, default: 25 },
  }, "PHASE7_ALERT_PAGE_SIZE_PARAMETER");
  assert.deepEqual(parameter(list, "pageSize")?.schema?.enum, [...ALERT_PAGE_SIZES], "PHASE7_ALERT_PAGE_SIZES_DIVERGE_FROM_THE_CONSTANT");
  assert.deepEqual(Object.keys(list.responses).sort(), ["200", "400", "403"], "PHASE7_ALERT_LIST_RESPONSES");
  assert.deepEqual(responseSchema(list), ref("AlertListResponse"), "PHASE7_ALERT_LIST_SUCCESS_SCHEMA");
  assert.equal(list.responses["400"].$ref, "#/components/responses/AnalystInsightBadRequest", "PHASE7_ALERT_LIST_400");
  assert.equal(list.responses["403"].$ref, "#/components/responses/AnalystInsightForbidden", "PHASE7_ALERT_LIST_403");

  const summary = operation(specification, "/v1/alerts/summary", "get");
  assert.equal(summary.operationId, "analyst-insights/get-alert-summary", "PHASE7_ALERT_SUMMARY_OPERATION_ID");
  assert.deepEqual(summary.tags, ["analyst-insights"], "PHASE7_ALERT_SUMMARY_TAGS");
  assert.equal(summary.parameters, undefined, "PHASE7_ALERT_SUMMARY_TAKES_NO_PARAMETERS");
  assert.equal(summary.requestBody, undefined, "PHASE7_ALERT_SUMMARY_TAKES_NO_BODY");
  assert.deepEqual(Object.keys(summary.responses).sort(), ["200", "400", "403"], "PHASE7_ALERT_SUMMARY_RESPONSES");
  assert.deepEqual(responseSchema(summary), ref("AlertSummaryResponse"), "PHASE7_ALERT_SUMMARY_SUCCESS_SCHEMA");
  assert.equal(summary.responses["400"].$ref, "#/components/responses/AnalystInsightBadRequest", "PHASE7_ALERT_SUMMARY_400");
  assert.equal(summary.responses["403"].$ref, "#/components/responses/AnalystInsightForbidden", "PHASE7_ALERT_SUMMARY_403");

  for (const name of ["AnalystInsightBadRequest", "AnalystInsightForbidden"]) {
    const response = specification.components?.responses?.[name];
    assert.ok(response, `PHASE7_ALERT_ERROR_RESPONSE_MISSING_${name}`);
    assert.deepEqual(
      response.content,
      { "application/json": { schema: ref("AssessmentWorkflowErrorResponse") } },
      `PHASE7_ALERT_ERROR_RESPONSE_SCHEMA_${name}`,
    );
  }

  const enumeration = (name: string) => {
    assert.equal(schemas[name]?.type, "string", `PHASE7_ALERT_ENUM_TYPE_${name}`);
    return schemas[name].enum;
  };
  assert.deepEqual(enumeration("AlertKind"), [...ALERT_KINDS], "PHASE7_ALERT_KINDS_DIVERGE_FROM_THE_SHARED_RULE");
  assert.deepEqual(enumeration("AlertUrgency"), [...ALERT_URGENCIES], "PHASE7_ALERT_URGENCIES_DIVERGE_FROM_THE_SHARED_RULE");
  assert.deepEqual(enumeration("AlertSourceType"), [...ALERT_SOURCE_TYPES], "PHASE7_ALERT_SOURCE_TYPES_DIVERGE_FROM_THE_REPOSITORY");
  assert.deepEqual(enumeration("AlertLinkType"), [...ALERT_LINK_TYPES], "PHASE7_ALERT_LINK_TYPES_DIVERGE_FROM_THE_REPOSITORY");

  const closedComponents: Record<string, string[]> = {
    AlertSource: ["type", "documentId", "identifier", "title", "released"],
    AlertLink: ["type", "documentId"],
    AlertItem: ["id", "kind", "urgency", "governingDate", "dayOffset", "source", "link", "residualRating"],
    AlertPagination: ["page", "pageSize", "pageCount", "total"],
    AlertListMeta: ["pagination", "today", "dueSoonWindowDays"],
    AlertListResponse: ["data", "meta"],
    AlertCountsByKind: [...ALERT_KINDS],
    AlertCountsByUrgency: [...ALERT_URGENCIES],
    AlertSummary: ["byKind", "byUrgency", "total", "today", "dueSoonWindowDays"],
    AlertSummaryResponse: ["data"],
  };
  for (const [name, keys] of Object.entries(closedComponents)) {
    const component = schemas[name];
    assert.ok(component, `PHASE7_ALERT_COMPONENT_MISSING_${name}`);
    assert.equal(component.type, "object", `PHASE7_ALERT_COMPONENT_TYPE_${name}`);
    assert.equal(component.additionalProperties, false, `PHASE7_ALERT_COMPONENT_OPEN_${name}`);
    assert.deepEqual(Object.keys(component.properties), keys, `PHASE7_ALERT_COMPONENT_KEYS_${name}`);
    assert.deepEqual(component.required, keys, `PHASE7_ALERT_COMPONENT_NOT_FULLY_REQUIRED_${name}`);
  }
  for (const name of [...Object.keys(closedComponents), "AlertKind", "AlertUrgency", "AlertSourceType", "AlertLinkType"]) {
    assert.equal(JSON.stringify(schemas[name]).includes('"pattern"'), false, `PHASE7_ALERT_COMPONENT_PATTERNED_${name}`);
  }

  const item = schemas.AlertItem.properties;
  assert.deepEqual(item.kind, ref("AlertKind"), "PHASE7_ALERT_ITEM_KIND");
  assert.deepEqual(item.urgency, ref("AlertUrgency"), "PHASE7_ALERT_ITEM_URGENCY");
  assert.deepEqual(item.governingDate, { type: ["string", "null"], format: "date" }, "PHASE7_ALERT_ITEM_GOVERNING_DATE");
  assert.deepEqual(item.dayOffset, { type: ["integer", "null"] }, "PHASE7_ALERT_ITEM_DAY_OFFSET");
  assert.deepEqual(item.source, ref("AlertSource"), "PHASE7_ALERT_ITEM_SOURCE");
  assert.deepEqual(item.link, ref("AlertLink"), "PHASE7_ALERT_ITEM_LINK");
  assert.deepEqual(item.residualRating, { anyOf: [ref("AssessmentRating"), { type: "null" }] }, "PHASE7_ALERT_ITEM_RESIDUAL_RATING");
  const source = schemas.AlertSource.properties;
  assert.deepEqual(source.type, ref("AlertSourceType"), "PHASE7_ALERT_SOURCE_TYPE");
  assert.deepEqual(source.title, { type: ["string", "null"] }, "PHASE7_ALERT_SOURCE_TITLE");
  assert.deepEqual(source.released, { type: "boolean" }, "PHASE7_ALERT_SOURCE_RELEASED");
  assert.deepEqual(schemas.AlertLink.properties.type, ref("AlertLinkType"), "PHASE7_ALERT_LINK_TYPE");
  // The parity guard synthesises max(minimum, 1) for an integer, so the page-size enum declares its own minimum.
  assert.deepEqual(schemas.AlertPagination.properties.pageSize, { type: "integer", enum: [5, 10, 25, 50], minimum: 5 }, "PHASE7_ALERT_PAGINATION_PAGE_SIZE");
  assert.deepEqual(schemas.AlertListResponse.properties.data, { type: "array", items: ref("AlertItem"), maxItems: 50 }, "PHASE7_ALERT_LIST_DATA");
  assert.deepEqual(schemas.AlertListResponse.properties.meta, ref("AlertListMeta"), "PHASE7_ALERT_LIST_META");
  for (const name of ["AlertListMeta", "AlertSummary"]) {
    assert.deepEqual(schemas[name].properties.today, { type: "string", format: "date" }, `PHASE7_ALERT_TODAY_${name}`);
    assert.deepEqual(schemas[name].properties.dueSoonWindowDays, { type: "integer", minimum: 1 }, `PHASE7_ALERT_WINDOW_${name}`);
  }
  for (const name of ["AlertCountsByKind", "AlertCountsByUrgency"]) {
    for (const [key, count] of Object.entries(schemas[name].properties)) {
      assert.deepEqual(count, { type: "integer", minimum: 0 }, `PHASE7_ALERT_COUNT_SHAPE_${name}_${key}`);
    }
  }
  assert.deepEqual(schemas.AlertSummary.properties.byKind, ref("AlertCountsByKind"), "PHASE7_ALERT_SUMMARY_BY_KIND");
  assert.deepEqual(schemas.AlertSummary.properties.byUrgency, ref("AlertCountsByUrgency"), "PHASE7_ALERT_SUMMARY_BY_URGENCY");
  assert.deepEqual(schemas.AlertSummaryResponse.properties.data, ref("AlertSummary"), "PHASE7_ALERT_SUMMARY_DATA");

  assert.ok(generatedSchema.includes('"/v1/alerts": {'), "PHASE7_ALERT_LIST_GENERATED_PATH");
  assert.ok(generatedSchema.includes('"/v1/alerts/summary": {'), "PHASE7_ALERT_SUMMARY_GENERATED_PATH");
  assert.ok(generatedSchema.includes('get: operations["analyst-insights/get-alerts"];'), "PHASE7_ALERT_LIST_GENERATED_OPERATION");
  assert.ok(generatedSchema.includes('get: operations["analyst-insights/get-alert-summary"];'), "PHASE7_ALERT_SUMMARY_GENERATED_OPERATION");
  assert.ok(generatedSchema.includes("AlertListResponse: {"), "PHASE7_ALERT_LIST_GENERATED_RESPONSE");
  assert.ok(generatedSchema.includes("AlertSummaryResponse: {"), "PHASE7_ALERT_SUMMARY_GENERATED_RESPONSE");

  // The development public-permission reconciler never opens an analyst insight action.
  const reconciler = readFileSync(path.join(appDir, "src", "bootstrap", "reconcile-development-public-permissions.ts"), "utf8");
  assert.equal(reconciler.includes("csrm-analyst-insight"), false, "PHASE7_ALERT_PUBLIC_PERMISSION");
});

/*
 * D-05, D-08, D-13: the two served report operations are published with closed
 * components. The report keys are exactly the server's closed set, the period
 * exactly the named throughput periods, and each capped list's maxItems exactly
 * its named cap. Every report is a closed branch of one union discriminated by
 * its key, so the web parses each report with its own closed parser. The
 * partitions name exactly the datamodel's vocabularies.
 */
test("Phase 7 analyst reports are published closed and match the served report set", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE7_REPORT_SPECIFICATION_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  const schemas = specification.components?.schemas ?? {};
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const count = { type: "integer", minimum: 0 };

  const index = operation(specification, "/v1/reports", "get");
  assert.equal(index.operationId, "analyst-insights/get-reports", "PHASE7_REPORT_INDEX_OPERATION_ID");
  assert.deepEqual(index.tags, ["analyst-insights"], "PHASE7_REPORT_INDEX_TAGS");
  assert.equal(index.parameters, undefined, "PHASE7_REPORT_INDEX_TAKES_NO_PARAMETERS");
  assert.equal(index.requestBody, undefined, "PHASE7_REPORT_INDEX_TAKES_NO_BODY");
  assert.deepEqual(Object.keys(index.responses).sort(), ["200", "400", "403"], "PHASE7_REPORT_INDEX_RESPONSES");
  assert.deepEqual(responseSchema(index), ref("ReportDefinitionListResponse"), "PHASE7_REPORT_INDEX_SUCCESS_SCHEMA");
  assert.equal(index.responses["400"].$ref, "#/components/responses/AnalystInsightBadRequest", "PHASE7_REPORT_INDEX_400");
  assert.equal(index.responses["403"].$ref, "#/components/responses/AnalystInsightForbidden", "PHASE7_REPORT_INDEX_403");

  const detail = operation(specification, "/v1/reports/{reportKey}", "get");
  assert.equal(detail.operationId, "analyst-insights/get-report", "PHASE7_REPORT_OPERATION_ID");
  assert.deepEqual(detail.tags, ["analyst-insights"], "PHASE7_REPORT_TAGS");
  assert.equal(detail.requestBody, undefined, "PHASE7_REPORT_TAKES_NO_BODY");
  assert.deepEqual(detail.parameters.map((entry: JsonObject) => entry.name), ["reportKey", "period"], "PHASE7_REPORT_PARAMETERS");
  assert.deepEqual(parameter(detail, "reportKey"), { name: "reportKey", in: "path", required: true, schema: ref("ReportKey") }, "PHASE7_REPORT_KEY_PARAMETER");
  const period = parameter(detail, "period");
  assert.equal(typeof period?.description, "string", "PHASE7_REPORT_PERIOD_DESCRIPTION");
  assert.deepEqual({ ...period, description: undefined }, {
    name: "period",
    in: "query",
    required: false,
    description: undefined,
    // The parity guard synthesises max(minimum, 1) for an integer, so the enum declares its own minimum.
    schema: { type: "integer", enum: [6, 12], minimum: 6, default: 6 },
  }, "PHASE7_REPORT_PERIOD_PARAMETER");
  assert.deepEqual(period?.schema?.enum, [...THROUGHPUT_PERIODS], "PHASE7_REPORT_PERIODS_DIVERGE_FROM_THE_CONSTANT");
  assert.equal(period?.schema?.default, THROUGHPUT_DEFAULT_PERIOD, "PHASE7_REPORT_DEFAULT_PERIOD_DIVERGES_FROM_THE_CONSTANT");
  assert.deepEqual(Object.keys(detail.responses).sort(), ["200", "400", "403", "404"], "PHASE7_REPORT_RESPONSES");
  assert.deepEqual(responseSchema(detail), ref("ReportResponse"), "PHASE7_REPORT_SUCCESS_SCHEMA");
  assert.equal(detail.responses["400"].$ref, "#/components/responses/AnalystInsightBadRequest", "PHASE7_REPORT_400");
  assert.equal(detail.responses["403"].$ref, "#/components/responses/AnalystInsightForbidden", "PHASE7_REPORT_403");
  assert.equal(detail.responses["404"].$ref, "#/components/responses/ReportNotFound", "PHASE7_REPORT_404");
  assert.deepEqual(
    specification.components?.responses?.ReportNotFound?.content,
    { "application/json": { schema: ref("AssessmentWorkflowErrorResponse") } },
    "PHASE7_REPORT_NOT_FOUND_SCHEMA",
  );

  assert.equal(schemas.ReportKey?.type, "string", "PHASE7_REPORT_KEY_TYPE");
  assert.deepEqual(schemas.ReportKey?.enum, [...REPORT_KEYS], "PHASE7_REPORT_KEYS_DIVERGE_FROM_THE_SERVER");
  assert.deepEqual(REPORT_DEFINITIONS.map(({ key }) => key), [...REPORT_KEYS], "PHASE7_REPORT_DEFINITIONS_ORDER");

  const reportComponents = {
    "risk-exposure": "RiskExposureReport",
    "treatment-performance": "TreatmentPerformanceReport",
    "assessment-throughput": "AssessmentThroughputReport",
    "control-effectiveness": "ControlEffectivenessReport",
  } as const satisfies Record<typeof REPORT_KEYS[number], string>;
  const closedComponents: Record<string, string[]> = {
    ReportDefinition: ["key", "title", "description"],
    ReportDefinitionListResponse: ["data"],
    RatingCounts: ["Critical", "High", "Moderate", "Low", "notRated", "total"],
    TreatmentStatusCounts: ["notStarted", "inProgress", "overdue", "complete", "notProvided", "total"],
    ControlStatusCounts: ["existing", "planned", "implemented", "retired", "notProvided", "total"],
    EffectivenessCounts: ["effective", "partiallyEffective", "ineffective", "notAssessed", "notProvided", "total"],
    RequestStatusCounts: ["submitted", "questionnaireInProgress", "riskAssessmentDrafted", "underReview", "approved", "closed", "total"],
    ResidualByTreatmentStatus: ["Critical", "High", "Moderate", "Low", "notRated"],
    ExposedSystem: ["documentId", "name", "critical", "high", "total"],
    ExposedSystems: ["rows", "total", "truncated", "risksWithoutSystem"],
    TreatmentDueStateCounts: ["overdue", "dueWithinWindow", "later", "noTargetDate", "total"],
    MostOverdueTreatments: ["rows", "total", "truncated"],
    ThroughputMonth: ["monthStart", "count", "partial"],
    ThroughputReleased: ["months", "total"],
    MedianDaysToRelease: ["value", "sampleSize", "truncated"],
    RiskExposureReport: ["key", "today", "byResidualRating", "byInherentRating", "residualByTreatmentStatus", "exposedSystems"],
    TreatmentPerformanceReport: ["key", "today", "dueWindowDays", "dueState", "treatmentStatus", "mostOverdue"],
    AssessmentThroughputReport: ["key", "today", "period", "periodStart", "released", "medianDaysToRelease", "requestsByStatus"],
    ControlEffectivenessReport: ["key", "today", "implementationStatus", "effectivenessRating"],
    ReportResponse: ["data"],
  };
  for (const [name, keys] of Object.entries(closedComponents)) {
    const component = schemas[name];
    assert.ok(component, `PHASE7_REPORT_COMPONENT_MISSING_${name}`);
    assert.equal(component.type, "object", `PHASE7_REPORT_COMPONENT_TYPE_${name}`);
    assert.equal(component.additionalProperties, false, `PHASE7_REPORT_COMPONENT_OPEN_${name}`);
    assert.deepEqual(Object.keys(component.properties), keys, `PHASE7_REPORT_COMPONENT_KEYS_${name}`);
    assert.deepEqual(component.required, keys, `PHASE7_REPORT_COMPONENT_NOT_FULLY_REQUIRED_${name}`);
  }
  for (const name of [...Object.keys(closedComponents), "ReportKey"]) {
    assert.equal(JSON.stringify(schemas[name]).includes('"pattern"'), false, `PHASE7_REPORT_COMPONENT_PATTERNED_${name}`);
  }

  // Every partition names exactly the datamodel vocabulary it folds, then its total.
  const frozenEnum = (api: string, attribute: string): string[] => parseJsonFile(
    path.join(appDir, "src", "api", api, "content-types", api, "schema.json"),
    `PHASE7_REPORT_CONTENT_TYPE_PARSE_${api}`,
  ).attributes[attribute].enum;
  const camelCase = (value: string) => value.replace(/[- ]([a-zA-Z])/g, (_match, letter: string) => letter.toUpperCase())
    .replace(/^[A-Z]/, (letter) => letter.toLowerCase());
  assert.deepEqual(
    Object.keys(schemas.TreatmentStatusCounts.properties),
    [...frozenEnum("csrm-risk", "treatmentStatus").map(camelCase), "notProvided", "total"],
    "PHASE7_REPORT_TREATMENT_STATUS_VOCABULARY",
  );
  assert.deepEqual(
    Object.keys(schemas.ControlStatusCounts.properties),
    [...frozenEnum("csrm-control-implementation", "controlStatus").map(camelCase), "notProvided", "total"],
    "PHASE7_REPORT_CONTROL_STATUS_VOCABULARY",
  );
  assert.deepEqual(
    Object.keys(schemas.EffectivenessCounts.properties),
    [...frozenEnum("csrm-control-implementation", "effectivenessRating").map(camelCase), "notProvided", "total"],
    "PHASE7_REPORT_EFFECTIVENESS_VOCABULARY",
  );
  assert.deepEqual(
    Object.keys(schemas.RequestStatusCounts.properties),
    [...frozenEnum("csrm-assessment-request", "requestStatus").filter((status) => status !== "draft").map(camelCase), "total"],
    "PHASE7_REPORT_REQUEST_STATUS_VOCABULARY",
  );
  for (const name of ["RatingCounts", "TreatmentStatusCounts", "ControlStatusCounts", "EffectivenessCounts", "RequestStatusCounts", "TreatmentDueStateCounts"]) {
    for (const [key, value] of Object.entries(schemas[name].properties)) {
      assert.deepEqual(value, count, `PHASE7_REPORT_COUNT_SHAPE_${name}_${key}`);
    }
  }
  for (const [key, value] of Object.entries(schemas.ResidualByTreatmentStatus.properties)) {
    assert.deepEqual(value, ref("TreatmentStatusCounts"), `PHASE7_REPORT_RESIDUAL_BY_STATUS_${key}`);
  }

  // Lists are bounded by their named caps.
  assert.deepEqual(schemas.ReportDefinitionListResponse.properties.data, { type: "array", items: ref("ReportDefinition"), maxItems: REPORT_KEYS.length }, "PHASE7_REPORT_DEFINITION_LIST");
  assert.deepEqual(schemas.ReportDefinition.properties, {
    key: ref("ReportKey"),
    title: { type: "string", minLength: 1 },
    description: { type: "string", minLength: 1 },
  }, "PHASE7_REPORT_DEFINITION");
  assert.deepEqual(schemas.ExposedSystem.properties, {
    documentId: { type: "string", minLength: 1, maxLength: 255 },
    name: { type: "string", minLength: 1, maxLength: 255 },
    critical: count,
    high: count,
    total: count,
  }, "PHASE7_REPORT_EXPOSED_SYSTEM");
  assert.deepEqual(schemas.ExposedSystems.properties, {
    rows: { type: "array", items: ref("ExposedSystem"), maxItems: EXPOSED_SYSTEMS_LIMIT },
    total: count,
    truncated: { type: "boolean" },
    risksWithoutSystem: count,
  }, "PHASE7_REPORT_EXPOSED_SYSTEMS");
  assert.deepEqual(schemas.MostOverdueTreatments.properties, {
    rows: { type: "array", items: ref("AlertItem"), maxItems: MOST_OVERDUE_TREATMENTS_LIMIT },
    total: count,
    truncated: { type: "boolean" },
  }, "PHASE7_REPORT_MOST_OVERDUE");
  assert.deepEqual(schemas.ThroughputMonth.properties, {
    monthStart: { type: "string", format: "date" },
    count,
    partial: { type: "boolean" },
  }, "PHASE7_REPORT_THROUGHPUT_MONTH");
  assert.deepEqual(schemas.ThroughputReleased.properties, {
    months: { type: "array", items: ref("ThroughputMonth"), maxItems: Math.max(...THROUGHPUT_PERIODS) },
    total: count,
  }, "PHASE7_REPORT_THROUGHPUT_RELEASED");
  assert.deepEqual(schemas.MedianDaysToRelease.properties, {
    value: { type: ["number", "null"], minimum: 0 },
    sampleSize: count,
    truncated: { type: "boolean" },
  }, "PHASE7_REPORT_MEDIAN");

  // Each report is keyed by its own single value and carries the server's today.
  for (const [key, name] of Object.entries(reportComponents)) {
    assert.deepEqual(schemas[name].properties.key, { type: "string", enum: [key] }, `PHASE7_REPORT_BRANCH_KEY_${name}`);
    assert.deepEqual(schemas[name].properties.today, { type: "string", format: "date" }, `PHASE7_REPORT_BRANCH_TODAY_${name}`);
  }
  assert.deepEqual(schemas.RiskExposureReport.properties, {
    key: { type: "string", enum: ["risk-exposure"] },
    today: { type: "string", format: "date" },
    byResidualRating: ref("RatingCounts"),
    byInherentRating: ref("RatingCounts"),
    residualByTreatmentStatus: ref("ResidualByTreatmentStatus"),
    exposedSystems: ref("ExposedSystems"),
  }, "PHASE7_REPORT_RISK_EXPOSURE");
  assert.deepEqual(schemas.TreatmentPerformanceReport.properties, {
    key: { type: "string", enum: ["treatment-performance"] },
    today: { type: "string", format: "date" },
    dueWindowDays: { type: "integer", minimum: 1 },
    dueState: ref("TreatmentDueStateCounts"),
    treatmentStatus: ref("TreatmentStatusCounts"),
    mostOverdue: ref("MostOverdueTreatments"),
  }, "PHASE7_REPORT_TREATMENT_PERFORMANCE");
  assert.deepEqual(schemas.AssessmentThroughputReport.properties, {
    key: { type: "string", enum: ["assessment-throughput"] },
    today: { type: "string", format: "date" },
    period: { type: "integer", enum: [...THROUGHPUT_PERIODS], minimum: 6 },
    periodStart: { type: "string", format: "date" },
    released: ref("ThroughputReleased"),
    medianDaysToRelease: ref("MedianDaysToRelease"),
    requestsByStatus: ref("RequestStatusCounts"),
  }, "PHASE7_REPORT_ASSESSMENT_THROUGHPUT");
  assert.deepEqual(schemas.ControlEffectivenessReport.properties, {
    key: { type: "string", enum: ["control-effectiveness"] },
    today: { type: "string", format: "date" },
    implementationStatus: ref("ControlStatusCounts"),
    effectivenessRating: ref("EffectivenessCounts"),
  }, "PHASE7_REPORT_CONTROL_EFFECTIVENESS");
  assert.deepEqual(schemas.ReportResponse.properties.data, {
    oneOf: REPORT_KEYS.map((key) => ref(reportComponents[key])),
    discriminator: {
      propertyName: "key",
      mapping: Object.fromEntries(REPORT_KEYS.map((key) => [key, `#/components/schemas/${reportComponents[key]}`])),
    },
  }, "PHASE7_REPORT_RESPONSE_UNION");

  // D-06: report export stays catalogued and unserved.
  assert.equal(specification.paths?.["/v1/reports/{reportKey}/export"], undefined, "PHASE7_REPORT_EXPORT_PUBLISHED");

  assert.ok(generatedSchema.includes('"/v1/reports": {'), "PHASE7_REPORT_INDEX_GENERATED_PATH");
  assert.ok(generatedSchema.includes('"/v1/reports/{reportKey}": {'), "PHASE7_REPORT_GENERATED_PATH");
  assert.ok(generatedSchema.includes('get: operations["analyst-insights/get-reports"];'), "PHASE7_REPORT_INDEX_GENERATED_OPERATION");
  assert.ok(generatedSchema.includes('get: operations["analyst-insights/get-report"];'), "PHASE7_REPORT_GENERATED_OPERATION");
  assert.ok(generatedSchema.includes("ReportDefinitionListResponse: {"), "PHASE7_REPORT_INDEX_GENERATED_RESPONSE");
  assert.ok(generatedSchema.includes("ReportResponse: {"), "PHASE7_REPORT_GENERATED_RESPONSE");
  assert.ok(
    generatedSchema.includes(`ReportKey: ${REPORT_KEYS.map((key) => `"${key}"`).join(" | ")};`),
    "PHASE7_REPORT_KEY_GENERATED_UNION",
  );
});

/*
 * D-05, D-08, D-34: the served analyst dashboard summary is published with
 * closed components. Its capped lists' maxItems are exactly their named caps,
 * the activity kinds and record types exactly the server's closed
 * vocabularies, the High and Critical ratings exactly the served pair, and the
 * exposure and due-state shapes reuse the published RatingCounts and
 * TreatmentDueState, so the dashboard and the reports and register it links to
 * describe one shape.
 */
test("Phase 7 analyst dashboard summary is published closed and matches the served summary", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE7_DASHBOARD_SPECIFICATION_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  const schemas = specification.components?.schemas ?? {};
  const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
  const count = { type: "integer", minimum: 0 };

  const summary = operation(specification, "/v1/dashboard/summary", "get");
  assert.equal(summary.operationId, "analyst-insights/get-dashboard-summary", "PHASE7_DASHBOARD_OPERATION_ID");
  assert.deepEqual(summary.tags, ["analyst-insights"], "PHASE7_DASHBOARD_TAGS");
  assert.equal(summary.parameters, undefined, "PHASE7_DASHBOARD_TAKES_NO_PARAMETERS");
  assert.equal(summary.requestBody, undefined, "PHASE7_DASHBOARD_TAKES_NO_BODY");
  assert.deepEqual(Object.keys(summary.responses).sort(), ["200", "400", "403"], "PHASE7_DASHBOARD_RESPONSES");
  assert.deepEqual(responseSchema(summary), ref("DashboardSummaryResponse"), "PHASE7_DASHBOARD_SUCCESS_SCHEMA");
  assert.equal(summary.responses["400"].$ref, "#/components/responses/AnalystInsightBadRequest", "PHASE7_DASHBOARD_400");
  assert.equal(summary.responses["403"].$ref, "#/components/responses/AnalystInsightForbidden", "PHASE7_DASHBOARD_403");

  const closedComponents: Record<string, string[]> = {
    DashboardSummaryResponse: ["data"],
    DashboardSummary: ["today", "dueSoonWindowDays", "reviewQueue", "riskExposure", "highCriticalRisks", "treatmentsDue", "recentActivity"],
    DashboardReviewQueue: [
      "requiresAttention",
      "awaitingRequestor",
      "generationInProgress",
      "questionnairesReadyForReview",
      "assessmentsDraft",
      "assessmentsInReview",
    ],
    DashboardHighCriticalRisks: ["rows", "total", "truncated"],
    DashboardRiskRow: ["documentId", "riskNumber", "riskStatement", "residualRating", "targetDate", "treatmentDueState"],
    DashboardTreatmentsDue: ["overdue", "dueSoon", "total"],
    DashboardRecentActivity: ["rows", "truncated"],
    ActivityItem: ["kind", "recordType", "documentId", "identifier", "title", "actorDisplayName", "occurredAt"],
  };
  for (const [name, keys] of Object.entries(closedComponents)) {
    const component = schemas[name];
    assert.ok(component, `PHASE7_DASHBOARD_COMPONENT_MISSING_${name}`);
    assert.equal(component.type, "object", `PHASE7_DASHBOARD_COMPONENT_TYPE_${name}`);
    assert.equal(component.additionalProperties, false, `PHASE7_DASHBOARD_COMPONENT_OPEN_${name}`);
    assert.deepEqual(Object.keys(component.properties), keys, `PHASE7_DASHBOARD_COMPONENT_KEYS_${name}`);
    assert.deepEqual(component.required, keys, `PHASE7_DASHBOARD_COMPONENT_NOT_FULLY_REQUIRED_${name}`);
  }
  for (const name of [...Object.keys(closedComponents), "ActivityKind"]) {
    assert.equal(JSON.stringify(schemas[name]).includes('"pattern"'), false, `PHASE7_DASHBOARD_COMPONENT_PATTERNED_${name}`);
  }

  assert.equal(schemas.ActivityKind?.type, "string", "PHASE7_DASHBOARD_ACTIVITY_KIND_TYPE");
  assert.deepEqual(schemas.ActivityKind?.enum, [...ACTIVITY_KINDS], "PHASE7_DASHBOARD_ACTIVITY_KINDS_DIVERGE_FROM_THE_SERVER");

  assert.deepEqual(schemas.DashboardSummaryResponse.properties.data, ref("DashboardSummary"), "PHASE7_DASHBOARD_RESPONSE_DATA");
  assert.deepEqual(schemas.DashboardSummary.properties, {
    today: { type: "string", format: "date" },
    dueSoonWindowDays: { type: "integer", minimum: 1 },
    reviewQueue: ref("DashboardReviewQueue"),
    riskExposure: ref("RatingCounts"),
    highCriticalRisks: ref("DashboardHighCriticalRisks"),
    treatmentsDue: ref("DashboardTreatmentsDue"),
    recentActivity: ref("DashboardRecentActivity"),
  }, "PHASE7_DASHBOARD_SUMMARY");
  for (const name of ["DashboardReviewQueue", "DashboardTreatmentsDue"]) {
    for (const [key, value] of Object.entries(schemas[name].properties)) {
      assert.deepEqual(value, count, `PHASE7_DASHBOARD_COUNT_SHAPE_${name}_${key}`);
    }
  }
  assert.deepEqual(schemas.DashboardHighCriticalRisks.properties, {
    rows: { type: "array", items: ref("DashboardRiskRow"), maxItems: DASHBOARD_WIDGET_ROW_LIMIT },
    total: count,
    truncated: { type: "boolean" },
  }, "PHASE7_DASHBOARD_HIGH_CRITICAL_RISKS");
  assert.deepEqual(schemas.DashboardRiskRow.properties, {
    documentId: { type: "string", minLength: 1, maxLength: 255 },
    riskNumber: { type: "string", minLength: 1, maxLength: 255 },
    riskStatement: { type: ["string", "null"] },
    residualRating: { type: "string", enum: [...HIGH_CRITICAL_RATINGS] },
    targetDate: { type: ["string", "null"], format: "date" },
    treatmentDueState: ref("TreatmentDueState"),
  }, "PHASE7_DASHBOARD_RISK_ROW");
  assert.deepEqual(schemas.DashboardRecentActivity.properties, {
    rows: { type: "array", items: ref("ActivityItem"), maxItems: RECENT_ACTIVITY_LIMIT },
    truncated: { type: "boolean" },
  }, "PHASE7_DASHBOARD_RECENT_ACTIVITY");
  assert.deepEqual(schemas.ActivityItem.properties, {
    kind: ref("ActivityKind"),
    recordType: { type: "string", enum: [...ACTIVITY_RECORD_TYPES] },
    documentId: { type: "string", minLength: 1, maxLength: 255 },
    identifier: { type: ["string", "null"], minLength: 1, maxLength: 255 },
    title: { type: ["string", "null"] },
    actorDisplayName: { type: ["string", "null"] },
    occurredAt: { type: "string", format: "date-time" },
  }, "PHASE7_DASHBOARD_ACTIVITY_ITEM");

  // D-06: the dashboard's report and alert reads stay catalogued and unserved.
  assert.equal(specification.paths?.["/v1/dashboard/reports"], undefined, "PHASE7_DASHBOARD_REPORTS_PUBLISHED");
  assert.equal(specification.paths?.["/v1/dashboard/alerts"], undefined, "PHASE7_DASHBOARD_ALERTS_PUBLISHED");

  assert.ok(generatedSchema.includes('"/v1/dashboard/summary": {'), "PHASE7_DASHBOARD_GENERATED_PATH");
  assert.ok(generatedSchema.includes('get: operations["analyst-insights/get-dashboard-summary"];'), "PHASE7_DASHBOARD_GENERATED_OPERATION");
  assert.ok(generatedSchema.includes("DashboardSummaryResponse: {"), "PHASE7_DASHBOARD_GENERATED_RESPONSE");
  assert.ok(
    generatedSchema.includes(`ActivityKind: ${ACTIVITY_KINDS.map((kind) => `"${kind}"`).join(" | ")};`),
    "PHASE7_DASHBOARD_ACTIVITY_KIND_GENERATED_UNION",
  );
});
