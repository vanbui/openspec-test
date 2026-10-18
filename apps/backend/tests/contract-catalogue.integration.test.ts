import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { SCIM_ROUTES } from "../src/iam/scim/routes";
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
  { method: "post", path: "/v1/questionnaires/{questionnaireId}/generate_assessment", operationId: "assessment-workflow/generate-assessment-draft", grants: { "role.security_analyst": "function.assessment_draft.generate_api" } },
  { method: "get", path: "/v1/assessment_draft_jobs/{jobId}", operationId: "assessment-workflow/get-assessment-draft-job", grants: { "role.security_analyst": "function.assessment_draft.job_read_api" } },
  { method: "post", path: "/v1/assessment_draft_jobs/{jobId}/retry", operationId: "assessment-workflow/retry-assessment-draft-job", grants: { "role.security_analyst": "function.assessment_draft.retry_api" } },
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
  { method: "get", path: "/v1/assessment_requests/{requestId}/generation_jobs", operationId: "questionnaire-generation/get-request-generation-jobs", functionId: "function.questionnaire_generation.request_jobs_read_api" },
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
  // target-date pair still sits directly before sort (the regex below). Phase 11
  // (D-44) adds the closed `stage` and `treatmentAction` filters after asset,
  // keeping both of those, and 11-15 (D-35) the closed `dueState`,
  // `mitigationEffectiveness` and `impactedSystem` filters after treatmentAction.
  assert.deepEqual(
    register.parameters.map((entry: JsonObject) => entry.name),
    [
      "q", "treatmentStatus", "inherentRating", "residualRating", "riskOwner", "treatmentOwner",
      "assessment", "system", "asset", "stage", "treatmentAction", "dueState", "mitigationEffectiveness", "impactedSystem", "mitigationStatus", "state", "targetDateFrom", "targetDateTo", "sort", "page", "pageSize",
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
    ["role.security_analyst"],
    "UNEXPECTED_DELETE_ROLE_SCOPE",
  );
  assert.deepEqual(
    deleteFunction.functionApiIds,
    ["function.risk_assessment_requests.delete_api.api.01"],
    "UNEXPECTED_DELETE_GRANT_SCOPE",
  );

  const referenceFunctionId = "function.risk_assessment_requests.reference_data_api";
  const referenceFunction = catalogue.functions.find((entry: JsonObject) => entry.id === referenceFunctionId);
  // Phase 12 D-33 (R-08-42): the service agent no longer holds the reference-data grant.
  const expectedRoles = ["role.requestor", "role.security_analyst"];
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
    // Phase 10 D-10 adds `regenerated` (the 06.8 record's Phase 10 amendment, part two); Phase 15 D-26 adds
    // `ai-proposal` and `question-restored` (the 06.8 record's Phase 15 amendment).
    ["released", "returned-to-review", "question-added", "question-edited", "question-deleted", "answer-cleared", "regenerated", "ai-proposal", "question-restored"],
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

  // The analyst queue declares exactly the four documented lifecycle queues,
  // Phase 13's open (13-12; D-13), and, since Phase 11 (D-30), All requests,
  // their status union.
  const queue = operation(specification, "/v1/assessment_requests", "get");
  assert.deepEqual(
    parameter(queue, "filters[queue]")?.schema?.enum,
    ["requires-attention", "awaiting-requestor", "generation-in-progress", "open", "released", "all"],
    "PHASE68_QUEUE_FILTER_VALUES",
  );
  // D-30: one search term matches the request number or the title.
  assert.deepEqual(
    parameter(queue, "filters[q]")?.schema,
    { type: "string", minLength: 1, maxLength: 200 },
    "PHASE11_QUEUE_SEARCH_PARAMETER",
  );
  // Phase 13 (13-12; D-13, D-24): who holds the request and new notes are closed values; the caller is never one.
  assert.deepEqual(parameter(queue, "filters[assignee]")?.schema?.enum, ["me", "unassigned"], "PHASE13_QUEUE_ASSIGNEE_VALUES");
  assert.deepEqual(parameter(queue, "filters[notes]")?.schema?.enum, ["unread"], "PHASE13_QUEUE_NOTES_VALUES");

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

  // 19-10: each assessment list's export takes its list's own status filter, so four operations publish it.
  const assessmentStatusPaths = ["/v1/risk_assessments", "/v1/my_risk_assessments", "/v1/risk_assessments/export", "/v1/my_risk_assessments/export"];
  for (const pathName of assessmentStatusPaths) {
    const status = parameter(operation(specification, pathName, "get"), "status");
    assert.deepEqual(status?.schema?.enum, assessmentStatuses, `PHASE69_ASSESSMENT_STATUS_FILTER_VOCABULARY_${pathName}`);
    assert.equal(typeof status?.description, "string", `PHASE69_ASSESSMENT_STATUS_FILTER_SEMANTICS_${pathName}`);
  }
  assert.equal(
    generatedSchema.split(`status?: ${union(assessmentStatuses)};`).length - 1,
    assessmentStatusPaths.length,
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

/*
 * D-06: catalogued, unserved, and kept under their menu Functions. Phase 19 (19-09) serves the report export, which moved
 * to function.reports.export_api (the Phase 19 export table below proves the move).
 */
const phase7UnservedOperations = [
  { method: "GET", path: "/v1/dashboard/reports", functionId: "function.dashboard.dashboard" },
  { method: "GET", path: "/v1/dashboard/alerts", functionId: "function.dashboard.dashboard" },
  { method: "GET", path: "/v1/alerts/{alertId}", functionId: "function.reports.alerts" },
  { method: "PATCH", path: "/v1/alerts/{alertId}/acknowledge", functionId: "function.reports.alerts" },
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
    // 19-09: the report export moved to function.reports.export_api, so the Reports menu Function carries no FunctionApi.
    ["function.reports.reports", []],
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
  // Phase 11 D-02 item 6 adds the holder counts beside the status counts (D-11); Phase 13 the requests with new notes (D-24).
  assert.deepEqual(Object.keys(counts.properties), [...keys, "byHolder", "withUnreadNotes"], "PHASE7_SUMMARY_COUNT_KEYS");
  for (const key of keys) {
    assert.deepEqual(counts.properties[key], { type: "integer", minimum: 0 }, `PHASE7_SUMMARY_COUNT_SHAPE_${key}`);
  }
  assert.deepEqual(counts.properties.byHolder, { $ref: "#/components/schemas/MyRequestHolderCounts" }, "PHASE11_SUMMARY_BY_HOLDER_REF");
  assert.deepEqual(
    [counts.properties.withUnreadNotes?.type, counts.properties.withUnreadNotes?.minimum],
    ["integer", 0],
    "PHASE13_SUMMARY_WITH_UNREAD_NOTES_SHAPE",
  );
  assert.deepEqual(counts.required, [...keys, "byHolder", "withUnreadNotes"], "PHASE7_SUMMARY_COUNTS_REQUIRED");
  assert.equal(counts.additionalProperties, false, "PHASE7_SUMMARY_COUNTS_OPEN");
  const holderCounts = specification.components.schemas.MyRequestHolderCounts;
  assert.equal(holderCounts?.type, "object", "PHASE11_HOLDER_COUNTS_TYPE");
  assert.deepEqual(Object.keys(holderCounts.properties), ["requestor", "analyst", "none"], "PHASE11_HOLDER_COUNTS_KEYS");
  for (const key of ["requestor", "analyst", "none"]) {
    assert.deepEqual(holderCounts.properties[key], { type: "integer", minimum: 0 }, `PHASE11_HOLDER_COUNT_SHAPE_${key}`);
  }
  assert.deepEqual(holderCounts.required, ["requestor", "analyst", "none"], "PHASE11_HOLDER_COUNTS_REQUIRED");
  assert.equal(holderCounts.additionalProperties, false, "PHASE11_HOLDER_COUNTS_OPEN");

  assert.ok(generatedSchema.includes('"/v1/my_requests/status_summary": {'), "PHASE7_SUMMARY_GENERATED_PATH");
  assert.ok(
    generatedSchema.includes('get: operations["assessment-workflow/get-my-request-status-summary"];'),
    "PHASE7_SUMMARY_GENERATED_OPERATION",
  );
  assert.ok(generatedSchema.includes("MyRequestStatusSummaryResponse: {"), "PHASE7_SUMMARY_GENERATED_RESPONSE");
  assert.ok(generatedSchema.includes("MyRequestStatusSummary: {"), "PHASE7_SUMMARY_GENERATED_COUNTS");
  assert.ok(generatedSchema.includes("MyRequestHolderCounts: {"), "PHASE11_SUMMARY_GENERATED_HOLDER_COUNTS");
});

/*
 * Phase 11 D-03: the catalogue-reserved GET /api/v1/my_requests is served under
 * its existing FunctionApi in the Requestor's My Requests Function. No grant,
 * Function, FunctionApi or role is added: the Requestor role alone holds it, and
 * the birthright extends it to every actor. Design note 9 records the served
 * route and no longer lists my_requests among the core-route aliases.
 */
test("Phase 11 my requests is published closed and granted through My Requests", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE11_MY_REQUESTS_SPECIFICATION_PARSE");
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  const catalogue = parseJsonFile(authoritativePath, "PHASE11_MY_REQUESTS_CATALOGUE_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE11_MY_REQUESTS_CATALOGUE_BYTE_DRIFT");

  const catalogueUrl = "GET:/api/v1/my_requests";
  const functionId = "function.risk_assessment_requests.my_requests";
  const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
  assert.deepEqual(apis.map((entry: JsonObject) => [entry.id, entry.functionId]), [[`${functionId}.api.01`, functionId]], "PHASE11_MY_REQUESTS_FUNCTION_API");
  const myRequests = catalogue.functions.find((entry: JsonObject) => entry.id === functionId);
  assert.ok(myRequests, "PHASE11_MY_REQUESTS_FUNCTION_MISSING");
  assert.deepEqual(myRequests.roleIds, ["role.requestor"], "PHASE11_MY_REQUESTS_FUNCTION_ROLES");
  assert.deepEqual(myRequests.functionApiIds, [`${functionId}.api.01`, `${functionId}.api.02`], "PHASE11_MY_REQUESTS_FUNCTION_APIS");
  assert.ok(effectiveOperations(catalogue, "role.requestor").has(catalogueUrl), "PHASE11_MY_REQUESTS_REQUESTOR_GRANT");
  assert.ok(!effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), "PHASE11_MY_REQUESTS_EXPLICIT_ANALYST_GRANT");
  assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(catalogueUrl), "PHASE11_MY_REQUESTS_EXPLICIT_AGENT_GRANT");

  const served = "Phase 11 serves GET /api/v1/my_requests as reserved, under the Requestor's My Requests Function, owner-scoped by the policy; it lists the caller's own requests with their lifecycle holder.";
  assert.equal(catalogue.designNotes.filter((note: string) => note.includes(served)).length, 1, "PHASE11_MY_REQUESTS_DESIGN_NOTE");
  assert.ok(catalogue.designNotes[8].includes(served), "PHASE11_MY_REQUESTS_NOT_IN_NOTE_9");
  assert.ok(!catalogue.designNotes[8].includes("aliases (my_requests,"), "PHASE11_MY_REQUESTS_STILL_A_CORE_ROUTE_ALIAS");

  const list = operation(specification, "/v1/my_requests", "get");
  assert.equal(list.operationId, "assessment-workflow/get-my-requests", "PHASE11_MY_REQUESTS_OPERATION_ID");
  assert.deepEqual(list.tags, ["assessment-workflow"], "PHASE11_MY_REQUESTS_TAGS");
  assert.deepEqual(list.parameters.map((parameter: JsonObject) => [parameter.name, parameter.in]), [
    ["q", "query"], ["status", "query"], ["holder", "query"], ["notes", "query"], ["sort", "query"], ["page", "query"], ["pageSize", "query"],
  ], "PHASE11_MY_REQUESTS_PARAMETERS");
  const parameter = (name: string) => list.parameters.find((entry: JsonObject) => entry.name === name).schema;
  assert.deepEqual(parameter("holder").enum, ["requestor", "analyst", "none"], "PHASE11_MY_REQUESTS_HOLDER_VALUES");
  // Phase 13 (D-24): the notes filter takes one closed value.
  assert.deepEqual(parameter("notes").enum, ["unread"], "PHASE13_MY_REQUESTS_NOTES_VALUES");
  assert.deepEqual(parameter("pageSize").enum, [10, 20, 50], "PHASE11_MY_REQUESTS_PAGE_SIZES");
  assert.deepEqual(parameter("sort").enum, [
    "updatedAt:desc", "updatedAt:asc", "dueDate:asc", "dueDate:desc", "requestNumber:asc", "requestNumber:desc", "title:asc", "title:desc",
  ], "PHASE11_MY_REQUESTS_SORT_VALUES");
  assert.deepEqual([parameter("q").minLength, parameter("q").maxLength], [1, 200], "PHASE11_MY_REQUESTS_SEARCH_BOUNDS");
  assert.equal(list.requestBody, undefined, "PHASE11_MY_REQUESTS_TAKES_NO_BODY");
  assert.deepEqual(Object.keys(list.responses).sort(), ["200", "400", "403"], "PHASE11_MY_REQUESTS_RESPONSES");
  assert.equal(responseSchema(list).$ref, "#/components/schemas/MyRequestListResponse", "PHASE11_MY_REQUESTS_SUCCESS_SCHEMA");
  assert.equal(list.responses["400"].$ref, "#/components/responses/AssessmentBadRequest", "PHASE11_MY_REQUESTS_400");
  assert.equal(list.responses["403"].$ref, "#/components/responses/AssessmentForbidden", "PHASE11_MY_REQUESTS_403");

  assert.deepEqual(specification.components.schemas.MyRequestListResponse, {
    type: "object",
    properties: { data: { type: "array", items: { $ref: "#/components/schemas/MyRequestItem" } }, meta: { $ref: "#/components/schemas/CollectionMeta" } },
    required: ["data", "meta"],
    additionalProperties: false,
  }, "PHASE11_MY_REQUESTS_RESPONSE_SHAPE");
  const item = specification.components.schemas.MyRequestItem;
  const itemKeys = [
    "documentId", "requestNumber", "title", "requestStatus", "submittedDate", "dueDate", "updatedAt", "daysSinceSubmission",
    "holder", "stage", "nextAction", "returned", "questionnaire",
    // Phase 13 (D-17, D-24): the assignee by display name alone, and the notes new to the Requestor.
    "assignee", "unreadNotes",
  ];
  assert.deepEqual(Object.keys(item.properties), itemKeys, "PHASE11_MY_REQUESTS_ITEM_KEYS");
  assert.deepEqual(item.required, itemKeys, "PHASE11_MY_REQUESTS_ITEM_REQUIRED");
  assert.equal(item.additionalProperties, false, "PHASE11_MY_REQUESTS_ITEM_OPEN");
  assert.deepEqual(item.properties.holder.enum, ["requestor", "analyst", "none"], "PHASE11_MY_REQUESTS_ITEM_HOLDER");
  assert.deepEqual(itemKeys.filter((key) => /assessment|risk/i.test(key)), [], "PHASE11_MY_REQUESTS_ITEM_ASSESSMENT_FIELD");
  assert.deepEqual(item.properties.assignee.anyOf, [{ $ref: "#/components/schemas/MyRequestAssignee" }, { type: "null" }], "PHASE13_MY_REQUESTS_ASSIGNEE_REF");
  const assignee = specification.components.schemas.MyRequestAssignee;
  assert.deepEqual(
    [assignee?.type, Object.keys(assignee?.properties ?? {}), assignee?.required, assignee?.additionalProperties],
    ["object", ["displayName"], ["displayName"], false],
    "PHASE13_MY_REQUESTS_ASSIGNEE_IS_THE_DISPLAY_NAME_ALONE",
  );
  assert.deepEqual([item.properties.unreadNotes.type, item.properties.unreadNotes.minimum], ["integer", 0], "PHASE13_MY_REQUESTS_UNREAD_NOTES_SHAPE");

  assert.ok(generatedSchema.includes('"/v1/my_requests": {'), "PHASE11_MY_REQUESTS_GENERATED_PATH");
  assert.ok(generatedSchema.includes('get: operations["assessment-workflow/get-my-requests"];'), "PHASE11_MY_REQUESTS_GENERATED_OPERATION");
  assert.ok(generatedSchema.includes("MyRequestListResponse: {"), "PHASE11_MY_REQUESTS_GENERATED_RESPONSE");
  assert.ok(generatedSchema.includes("MyRequestItem: {"), "PHASE11_MY_REQUESTS_GENERATED_ITEM");
  assert.ok(generatedSchema.includes("MyRequestAssignee: {"), "PHASE13_MY_REQUESTS_GENERATED_ASSIGNEE");
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
test("Phase 7 Risk Register publishes the closed open, closed and withdrawn state filter (Phase 16 D-08)", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE7_STATE_SPECIFICATION_PARSE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  const register = operation(specification, "/v1/risks", "get");

  assert.deepEqual(parameter(register, "state"), {
    name: "state",
    in: "query",
    required: false,
    schema: { type: "string", enum: ["open", "closed", "withdrawn"] },
    description: "open: an active Risk with no closure date recorded. closed: an active Risk with a closure date recorded. Absent returns both, active Risks only. withdrawn: the Risks withdrawn from their assessment, and only those (Phase 16 D-08); no figure links to it and no default view includes them.",
  }, "PHASE7_STATE_PARAMETER");
  assert.deepEqual(parameter(register, "state")?.schema?.enum, [...RISK_REGISTER_STATES], "PHASE7_STATE_DIVERGES_FROM_THE_PARSER");
  const names = register.parameters.map((entry: JsonObject) => entry.name);
  assert.equal(names.indexOf("state"), names.indexOf("mitigationStatus") + 1, "PHASE7_STATE_POSITION");
  assert.equal(names.filter((name: string) => name === "state").length, 1, "PHASE7_STATE_DUPLICATED");
  assert.match(generatedSchema, /mitigationStatus\?: "Existing" \| "Planned" \| "Implemented" \| "Retired" \| "none" \| "any";\s+\/\*\* @description open: an active Risk with no closure date recorded\. closed: an active Risk with a closure date recorded\. Absent returns both, active Risks only\. withdrawn: the Risks withdrawn from their assessment, and only those \(Phase 16 D-08\); no figure links to it and no default view includes them\. \*\/\s+state\?: "open" \| "closed" \| "withdrawn";\s+targetDateFrom\?: string;/, "PHASE7_STATE_GENERATED_QUERY");
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
    RiskExposureUnderAssessment: ["byResidualRating"],
    RiskExposureReport: ["key", "today", "byResidualRating", "byInherentRating", "acceptedByResidualRating", "residualByTreatmentStatus", "exposedSystems", "underAssessment"],
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
    acceptedByResidualRating: ref("RatingCounts"),
    residualByTreatmentStatus: ref("ResidualByTreatmentStatus"),
    exposedSystems: ref("ExposedSystems"),
    underAssessment: ref("RiskExposureUnderAssessment"),
  }, "PHASE7_REPORT_RISK_EXPOSURE");
  // D-42: the Risks under assessment are counted apart from the released sections, by residual rating.
  assert.deepEqual(schemas.RiskExposureUnderAssessment.properties, { byResidualRating: ref("RatingCounts") }, "PHASE11_REPORT_UNDER_ASSESSMENT");
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

  // Phase 19 (19-09): the report export Phase 7 kept unserved is published at its reserved URL and served by
  // function.reports.export_api.
  assert.equal(operation(specification, "/v1/reports/{reportKey}/export", "post").operationId, "analyst-insights/export-report", "PHASE7_REPORT_EXPORT_PUBLISHED");
  const reportExportCatalogue = parseJsonFile(path.join(repositoryDir, "docs", "references", catalogueFilename), "PHASE7_REPORT_EXPORT_CATALOGUE_PARSE");
  assert.deepEqual(
    reportExportCatalogue.functionApis.filter((entry: JsonObject) => entry.url === "POST:/api/v1/reports/{reportKey}/export").map((entry: JsonObject) => [entry.id, entry.functionId]),
    [["function.reports.export_api.api.01", "function.reports.export_api"]],
    "PHASE7_REPORT_EXPORT_SERVED_BY",
  );

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
 * exposure (three counts since 11-16: released, released and accepted, and
 * under assessment) and due-state shapes reuse the published RatingCounts and
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
      // Phase 13 (D-15): the viewer's own counts and the team's pick-up pool.
      "mine",
      "unassigned",
    ],
    DashboardReviewQueueMine: ["requiresAttention", "awaitingRequestor", "generationInProgress", "withUnreadNotes"],
    DashboardRiskExposure: ["released", "releasedAccepted", "underAssessment"],
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
    riskExposure: ref("DashboardRiskExposure"),
    highCriticalRisks: ref("DashboardHighCriticalRisks"),
    treatmentsDue: ref("DashboardTreatmentsDue"),
    recentActivity: ref("DashboardRecentActivity"),
  }, "PHASE7_DASHBOARD_SUMMARY");
  // D-40 to D-42 (11-16): exposure is three rating counts on the one published RatingCounts shape.
  assert.deepEqual(schemas.DashboardRiskExposure.properties, {
    released: ref("RatingCounts"),
    releasedAccepted: ref("RatingCounts"),
    underAssessment: ref("RatingCounts"),
  }, "PHASE11_DASHBOARD_RISK_EXPOSURE");
  for (const name of ["DashboardReviewQueue", "DashboardReviewQueueMine", "DashboardTreatmentsDue"]) {
    for (const [key, value] of Object.entries(schemas[name].properties)) {
      // Phase 13 (D-15): the review queue's one non-count is the viewer's own block, a closed component of counts.
      const expected = name === "DashboardReviewQueue" && key === "mine" ? ref("DashboardReviewQueueMine") : count;
      assert.deepEqual(value, expected, `PHASE7_DASHBOARD_COUNT_SHAPE_${name}_${key}`);
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

/*
 * Phase 12 D-24, D-25, D-32 and D-33: draft generation, its job read and its retry, the AI run read and the proposal
 * decision operation are each held by a human Security Analyst-only Function, and the service agent holds no
 * assessment-request grant.
 */
const assessmentDraftRoutes = [
  { method: "post", path: "/v1/questionnaires/{questionnaireId}/generate_assessment", functionId: "function.assessment_draft.generate_api", functionApiId: "function.assessment_draft.generate_api.api.01" },
  { method: "get", path: "/v1/assessment_draft_jobs/{jobId}", functionId: "function.assessment_draft.job_read_api", functionApiId: "function.assessment_draft.job_read_api.api.01" },
  { method: "post", path: "/v1/assessment_draft_jobs/{jobId}/retry", functionId: "function.assessment_draft.retry_api", functionApiId: "function.assessment_draft.retry_api.api.01" },
  { method: "get", path: "/v1/ai_runs/{runId}", functionId: "function.ai_runs.read_api", functionApiId: "function.ai_runs.read_api.api.01" },
  { method: "post", path: "/v1/risk_assessments/{assessmentId}/ai_proposal_decisions", functionId: "function.ai_proposals.decide_api", functionApiId: "function.ai_proposals.decide_api.api.01" },
] as const;

test("Phase 12 draft generation, the AI run read and the proposal decisions are human Security Analyst-only, and the agent holds no request grant", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE12_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE12_CATALOGUE_PARSE");
  // IN-108: the Phase 12 note records the decision Function the catalogue holds as done, not as a later plan's work.
  const phase12Notes = catalogue.designNotes.filter((note: string) => note.startsWith("Phase 12 "));
  assert.equal(phase12Notes.length, 1, "PHASE12_DESIGN_NOTE_COUNT");
  assert.ok(phase12Notes[0].includes("function.ai_proposals.decide_api"), "PHASE12_DESIGN_NOTE_DECISION_FUNCTION");
  assert.doesNotMatch(phase12Notes[0], /gets its own Function|in plan 12-12/, "PHASE12_DESIGN_NOTE_FUTURE_TENSE");
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE12_SPECIFICATION_PARSE");
  for (const route of assessmentDraftRoutes) {
    const catalogueUrl = `${route.method.toUpperCase()}:/api${route.path}`;
    const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === route.functionId);
    assert.equal(functions.length, 1, `PHASE12_FUNCTION_MISSING_${route.functionId}`);
    assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], `PHASE12_ROLE_SCOPE_${route.functionId}`);
    assert.equal("menuPath" in functions[0], false, `PHASE12_MENU_PATH_${route.functionId}`);
    assert.deepEqual(catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl).map((entry: JsonObject) => [entry.id, entry.functionId]), [[route.functionApiId, route.functionId]], `PHASE12_FUNCTION_API_${catalogueUrl}`);
    assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), `PHASE12_ANALYST_GRANT_${catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(catalogueUrl), `PHASE12_AGENT_GRANT_${catalogueUrl}`);
    assert.ok(operation(specification, route.path, route.method), `PHASE12_CONTRACT_MISSING_${route.path}`);
  }
  for (const id of ["function.questionnaires.questionnaire_details.api.05", "function.risk_assessments.risk_assessment_details.api.09", "function.risk_assessments.risk_assessment_details.api.10"]) {
    assert.equal(JSON.stringify(catalogue).includes(`"${id}"`), false, `PHASE12_MOVED_ID_REMAINS_${id}`);
  }
  const agent = catalogue.roles.find((entry: JsonObject) => entry.id === "role.security_analyst_agent");
  assert.ok(agent, "PHASE12_AGENT_ROLE_MISSING");
  for (const functionId of ["function.risk_assessment_requests.core_api", "function.risk_assessment_requests.delete_api", "function.risk_assessment_requests.reference_data_api"]) {
    assert.equal(agent.functionIds.includes(functionId), false, `PHASE12_AGENT_STILL_HOLDS_${functionId}`);
    const fn = catalogue.functions.find((entry: JsonObject) => entry.id === functionId);
    assert.equal(fn.roleIds.includes("role.security_analyst_agent"), false, `PHASE12_FUNCTION_STILL_GRANTS_AGENT_${functionId}`);
  }
  for (const functionId of ["function.risk_assessment_requests.core_api", "function.risk_assessment_requests.reference_data_api"]) {
    assert.ok(catalogue.functions.find((entry: JsonObject) => entry.id === functionId).roleIds.includes("role.requestor"), `PHASE12_REQUESTOR_LOST_${functionId}`);
  }
  assert.ok(agent.functionIds.includes("function.risk_assessments.risk_assessment_details"), "PHASE12_AGENT_LOST_ASSESSMENT_DETAILS");
  assert.ok(agent.functionIds.includes("function.current_user.access_api"), "PHASE12_AGENT_LOST_ACCESS");
});

/*
 * Phase 15 (D-02, D-31, C-1): the questionnaire AI operations are each held by a human Security Analyst-only,
 * API-only Function, granted both ways (the Function's roleIds and role.security_analyst's functionIds), and no other
 * role holds them.
 */
const questionnaireAiRoutes = [
  { method: "get", path: "/v1/questionnaires/{questionnaireId}/ai_proposals", functionId: "function.questionnaire_ai.proposals_read_api", functionApiId: "function.questionnaire_ai.proposals_read_api.api.01" },
  { method: "post", path: "/v1/questionnaires/{questionnaireId}/ai_proposals", functionId: "function.questionnaire_ai.propose_api", functionApiId: "function.questionnaire_ai.propose_api.api.01" },
  { method: "post", path: "/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite", functionId: "function.questionnaire_ai.propose_api", functionApiId: "function.questionnaire_ai.propose_api.api.02" },
  { method: "get", path: "/v1/questionnaire_proposal_jobs/{jobId}", functionId: "function.questionnaire_ai.job_read_api", functionApiId: "function.questionnaire_ai.job_read_api.api.01" },
  { method: "post", path: "/v1/questionnaire_proposal_jobs/{jobId}/retry", functionId: "function.questionnaire_ai.retry_api", functionApiId: "function.questionnaire_ai.retry_api.api.01" },
  { method: "post", path: "/v1/questionnaires/{questionnaireId}/ai_proposal_decisions", functionId: "function.questionnaire_ai.decide_api", functionApiId: "function.questionnaire_ai.decide_api.api.01" },
] as const;

test("Phase 15 questionnaire AI operations are human Security Analyst-only, granted both ways, and published in the contract", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE15_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE15_CATALOGUE_PARSE");
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE15_SPECIFICATION_PARSE");
  const analyst = catalogue.roles.find((entry: JsonObject) => entry.id === "role.security_analyst");
  for (const route of questionnaireAiRoutes) {
    const catalogueUrl = `${route.method.toUpperCase()}:/api${route.path}`;
    const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === route.functionId);
    assert.equal(functions.length, 1, `PHASE15_FUNCTION_MISSING_${route.functionId}`);
    assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], `PHASE15_ROLE_SCOPE_${route.functionId}`);
    assert.equal("menuPath" in functions[0], false, `PHASE15_MENU_PATH_${route.functionId}`);
    assert.ok(analyst.functionIds.includes(route.functionId), `PHASE15_ANALYST_FUNCTION_IDS_${route.functionId}`);
    for (const role of catalogue.roles) {
      if (role.id !== "role.security_analyst") assert.equal(role.functionIds.includes(route.functionId), false, `PHASE15_OTHER_ROLE_${role.id}_${route.functionId}`);
    }
    assert.deepEqual(catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl).map((entry: JsonObject) => [entry.id, entry.functionId]), [[route.functionApiId, route.functionId]], `PHASE15_FUNCTION_API_${catalogueUrl}`);
    assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), `PHASE15_ANALYST_GRANT_${catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(catalogueUrl), `PHASE15_AGENT_GRANT_${catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.requestor").has(catalogueUrl), `PHASE15_REQUESTOR_GRANT_${catalogueUrl}`);
    assert.ok(operation(specification, route.path, route.method), `PHASE15_CONTRACT_MISSING_${route.path}`);
  }
  const notes = catalogue.designNotes.filter((note: string) => note.startsWith("Phase 15 "));
  assert.equal(notes.length, 1, "PHASE15_DESIGN_NOTE_COUNT");
});

/*
 * Phase 16 (D-43, D-21; the approved record "Operations, Functions and Reasons"): withdrawing and reinstating Risks
 * and reading a Risk's history are each held by a human Security Analyst-only, API-only Function, granted both ways
 * (the Function's roleIds and role.security_analyst's functionIds), and no other role holds them.
 */
const riskCurationRoutes = [
  { method: "post", path: "/v1/risk_assessments/{assessmentId}/risk_withdrawals", operationId: "risk-curation/withdraw-risks", functionId: "function.risk_curation.withdraw_api", functionApiId: "function.risk_curation.withdraw_api.api.01" },
  { method: "post", path: "/v1/risk_assessments/{assessmentId}/risk_reinstatements", operationId: "risk-curation/reinstate-risks", functionId: "function.risk_curation.withdraw_api", functionApiId: "function.risk_curation.withdraw_api.api.02" },
  { method: "get", path: "/v1/risks/{riskId}/history", operationId: "risk-curation/get-risk-history", functionId: "function.risk_curation.history_read_api", functionApiId: "function.risk_curation.history_read_api.api.01" },
] as const;

test("Phase 16 risk curation operations are human Security Analyst-only, API-only, granted both ways, and published in the contract", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE16_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE16_CATALOGUE_PARSE");
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE16_SPECIFICATION_PARSE");
  const analyst = catalogue.roles.find((entry: JsonObject) => entry.id === "role.security_analyst");
  for (const route of riskCurationRoutes) {
    const catalogueUrl = `${route.method.toUpperCase()}:/api${route.path}`;
    const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === route.functionId);
    assert.equal(functions.length, 1, `PHASE16_FUNCTION_MISSING_${route.functionId}`);
    assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], `PHASE16_ROLE_SCOPE_${route.functionId}`);
    assert.equal("menuPath" in functions[0], false, `PHASE16_MENU_PATH_${route.functionId}`);
    assert.match(functions[0].description, /^Human analyst-only .*This API-only Function intentionally has no menuPath\.$/, `PHASE16_FUNCTION_DESCRIPTION_${route.functionId}`);
    assert.ok(analyst.functionIds.includes(route.functionId), `PHASE16_ANALYST_FUNCTION_IDS_${route.functionId}`);
    for (const role of catalogue.roles) {
      if (role.id !== "role.security_analyst") assert.equal(role.functionIds.includes(route.functionId), false, `PHASE16_OTHER_ROLE_${role.id}_${route.functionId}`);
    }
    assert.deepEqual(catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl).map((entry: JsonObject) => [entry.id, entry.functionId]), [[route.functionApiId, route.functionId]], `PHASE16_FUNCTION_API_${catalogueUrl}`);
    assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), `PHASE16_ANALYST_GRANT_${catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(catalogueUrl), `PHASE16_AGENT_GRANT_${catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.requestor").has(catalogueUrl), `PHASE16_REQUESTOR_GRANT_${catalogueUrl}`);
    const documented = operation(specification, route.path, route.method);
    assert.equal(documented.operationId, route.operationId, `PHASE16_OPERATION_ID_${route.path}`);
    assert.deepEqual(documented.tags, ["risk-curation"], `PHASE16_TAG_${route.path}`);
    for (const status of ["400", "403", "404", "409"]) {
      assert.ok(documented.responses?.[status], `PHASE16_RESPONSE_${status}_${route.path}`);
    }
  }
  // One design note records the curation Functions and that no route deletes a Risk (D-16).
  const notes = catalogue.designNotes.filter((note: string) => note.startsWith("Phase 16 "));
  assert.equal(notes.length, 1, "PHASE16_DESIGN_NOTE_COUNT");
  for (const functionId of ["function.risk_curation.withdraw_api", "function.risk_curation.history_read_api"]) {
    assert.ok(notes[0].includes(functionId), `PHASE16_DESIGN_NOTE_NAMES_${functionId}`);
  }
  assert.match(notes[0], /no route deletes a Risk/, "PHASE16_DESIGN_NOTE_NO_DELETE");
});

/*
 * Phase 16 (D-26, D-41, D-43; 16-09): asking the AI to suggest more risks or rewrite one, following and retrying its job
 * and reading the assessment's AI proposals are each held by a human Security Analyst-only, API-only Function, granted
 * both ways, and no other role holds them. The one Phase 16 design note names them and that a requesting analyst is
 * refused by record (G-1).
 */
const riskAiProposalRoutes = [
  { method: "post", path: "/v1/risk_assessments/{assessmentId}/risk_suggestions", operationId: "risk-ai-proposals/start-risk-suggestions", functionId: "function.risk_ai_proposals.propose_api", functionApiId: "function.risk_ai_proposals.propose_api.api.01" },
  { method: "post", path: "/v1/risks/{riskId}/rewrite", operationId: "risk-ai-proposals/start-risk-rewrite", functionId: "function.risk_ai_proposals.propose_api", functionApiId: "function.risk_ai_proposals.propose_api.api.02" },
  { method: "get", path: "/v1/risk_proposal_jobs/{jobId}", operationId: "risk-ai-proposals/get-risk-proposal-job", functionId: "function.risk_ai_proposals.job_read_api", functionApiId: "function.risk_ai_proposals.job_read_api.api.01" },
  { method: "post", path: "/v1/risk_proposal_jobs/{jobId}/retry", operationId: "risk-ai-proposals/retry-risk-proposal-job", functionId: "function.risk_ai_proposals.retry_api", functionApiId: "function.risk_ai_proposals.retry_api.api.01" },
  { method: "get", path: "/v1/risk_assessments/{assessmentId}/ai_proposals", operationId: "risk-ai-proposals/list-risk-ai-proposals", functionId: "function.risk_ai_proposals.proposals_read_api", functionApiId: "function.risk_ai_proposals.proposals_read_api.api.01" },
] as const;

test("Phase 16 risk AI proposal operations are human Security Analyst-only, API-only, granted both ways, and published in the contract", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE16_AI_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE16_AI_CATALOGUE_PARSE");
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE16_AI_SPECIFICATION_PARSE");
  const analyst = catalogue.roles.find((entry: JsonObject) => entry.id === "role.security_analyst");
  for (const route of riskAiProposalRoutes) {
    const catalogueUrl = `${route.method.toUpperCase()}:/api${route.path}`;
    const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === route.functionId);
    assert.equal(functions.length, 1, `PHASE16_AI_FUNCTION_MISSING_${route.functionId}`);
    assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], `PHASE16_AI_ROLE_SCOPE_${route.functionId}`);
    assert.equal("menuPath" in functions[0], false, `PHASE16_AI_MENU_PATH_${route.functionId}`);
    assert.match(functions[0].description, /^Human analyst-only .*This API-only Function intentionally has no menuPath\.$/, `PHASE16_AI_FUNCTION_DESCRIPTION_${route.functionId}`);
    assert.ok(analyst.functionIds.includes(route.functionId), `PHASE16_AI_ANALYST_FUNCTION_IDS_${route.functionId}`);
    for (const role of catalogue.roles) {
      if (role.id !== "role.security_analyst") assert.equal(role.functionIds.includes(route.functionId), false, `PHASE16_AI_OTHER_ROLE_${role.id}_${route.functionId}`);
    }
    assert.deepEqual(catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl).map((entry: JsonObject) => [entry.id, entry.functionId]), [[route.functionApiId, route.functionId]], `PHASE16_AI_FUNCTION_API_${catalogueUrl}`);
    assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), `PHASE16_AI_ANALYST_GRANT_${catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(catalogueUrl), `PHASE16_AI_AGENT_GRANT_${catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.requestor").has(catalogueUrl), `PHASE16_AI_REQUESTOR_GRANT_${catalogueUrl}`);
    const documented = operation(specification, route.path, route.method);
    assert.equal(documented.operationId, route.operationId, `PHASE16_AI_OPERATION_ID_${route.path}`);
    assert.deepEqual(documented.tags, ["risk-ai-proposals"], `PHASE16_AI_TAG_${route.path}`);
    for (const status of ["400", "403", "404", "409"]) {
      const declared = documented.responses?.[status];
      const response = typeof declared?.$ref === "string" ? specification.components.responses[declared.$ref.replace("#/components/responses/", "")] : declared;
      assert.equal(response?.content?.["application/json"]?.schema?.$ref, "#/components/schemas/AssessmentWorkflowErrorResponse", `PHASE16_AI_RESPONSE_${status}_${route.path}`);
    }
  }
  const notes = catalogue.designNotes.filter((note: string) => note.startsWith("Phase 16 "));
  assert.equal(notes.length, 1, "PHASE16_AI_DESIGN_NOTE_COUNT");
  for (const route of riskAiProposalRoutes) assert.ok(notes[0].includes(route.functionId), `PHASE16_AI_DESIGN_NOTE_NAMES_${route.functionId}`);
  assert.match(notes[0], /requesting analyst is refused by record with OWN_REQUEST \(G-1\)/, "PHASE16_AI_DESIGN_NOTE_OWN_REQUEST");
});

/*
 * Phase 13 (D-02, D-30, G-1): the request assignment operation is held by its own human Security Analyst-only
 * Function, granted both ways (the Function's roleIds and the role's functionIds, which the bootstrap seeds from),
 * and neither the Requestor birthright nor the service agent holds it.
 */
test("Phase 13 request assignment is held by one human Security Analyst-only Function and published in the contract", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE13_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE13_CATALOGUE_PARSE");
  const functionId = "function.risk_assessment_requests.assignment_api";
  const catalogueUrl = "PUT:/api/v1/assessment_requests/{requestId}/assignee";
  const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === functionId);
  assert.equal(functions.length, 1, "PHASE13_ASSIGNMENT_FUNCTION_MISSING");
  assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], "PHASE13_ASSIGNMENT_ROLE_SCOPE");
  assert.equal("menuPath" in functions[0], false, "PHASE13_ASSIGNMENT_MENU_PATH");
  assert.deepEqual(catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl).map((entry: JsonObject) => [entry.id, entry.functionId]),
    [[`${functionId}.api.01`, functionId]], "PHASE13_ASSIGNMENT_FUNCTION_API");
  assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), "PHASE13_ANALYST_ASSIGNMENT_GRANT");
  for (const roleId of ["role.requestor", "role.security_analyst_agent"]) {
    assert.ok(!effectiveOperations(catalogue, roleId).has(catalogueUrl), `PHASE13_ASSIGNMENT_GRANT_${roleId}`);
    assert.equal(catalogue.roles.find((entry: JsonObject) => entry.id === roleId).functionIds.includes(functionId), false, `PHASE13_ASSIGNMENT_FUNCTION_${roleId}`);
  }
  const phase13Notes = catalogue.designNotes.filter((note: string) => note.startsWith("Phase 13 "));
  assert.equal(phase13Notes.length, 1, "PHASE13_DESIGN_NOTE_COUNT");
  assert.ok(phase13Notes[0].includes(functionId), "PHASE13_DESIGN_NOTE_ASSIGNMENT_FUNCTION");

  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE13_SPECIFICATION_PARSE");
  const operationValue = operation(specification, "/v1/assessment_requests/{requestId}/assignee", "put");
  assert.equal(operationValue.operationId, "assessment-workflow/put-assessment-request-assignee", "PHASE13_ASSIGNMENT_OPERATION_ID");
  assert.equal(operationValue.requestBody.content["application/json"].schema.$ref, "#/components/schemas/AssessmentRequestAssigneeChangeRequest", "PHASE13_ASSIGNMENT_REQUEST_BODY");
  assert.equal(responseSchema(operationValue).$ref, "#/components/schemas/AssessmentRequestAssignmentResponse", "PHASE13_ASSIGNMENT_RESPONSE");
  for (const status of ["400", "403", "404", "409"]) assert.ok(operationValue.responses[status], `PHASE13_ASSIGNMENT_${status}_RESPONSE`);
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.ok(generatedSchema.includes('"/v1/assessment_requests/{requestId}/assignee": {'), "PHASE13_ASSIGNMENT_GENERATED_PATH");
  assert.ok(generatedSchema.includes('put: operations["assessment-workflow/put-assessment-request-assignee"];'), "PHASE13_ASSIGNMENT_GENERATED_OPERATION");
});

/*
 * Phase 13 (D-02, D-06, D-30): the eligible-analyst read is the assignment Function's second FunctionApi, so the
 * human Security Analyst alone holds it, and the contract publishes it with a closed, bounded list of people.
 */
test("Phase 13 eligible-analyst read is held by the assignment Function alone and published as a closed list of at most 50 people", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE13_ASSIGNABLE_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE13_ASSIGNABLE_CATALOGUE_PARSE");
  const functionId = "function.risk_assessment_requests.assignment_api";
  const catalogueUrl = "GET:/api/v1/assessment_requests/{requestId}/assignable_analysts";
  const assignmentFunction = catalogue.functions.find((entry: JsonObject) => entry.id === functionId);
  assert.ok(assignmentFunction, "PHASE13_ASSIGNABLE_FUNCTION_MISSING");
  assert.deepEqual(assignmentFunction.functionApiIds, [`${functionId}.api.01`, `${functionId}.api.02`], "PHASE13_ASSIGNABLE_FUNCTION_API_IDS");
  const functionApis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
  assert.deepEqual(functionApis.map((entry: JsonObject) => [entry.id, entry.functionId]), [[`${functionId}.api.02`, functionId]], "PHASE13_ASSIGNABLE_FUNCTION_API");
  assert.deepEqual(functionApis[0].sourceEntities, ["CsrmAssessmentRequest", "IdamBoxUser"], "PHASE13_ASSIGNABLE_SOURCE_ENTITIES");
  assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), "PHASE13_ANALYST_ASSIGNABLE_GRANT");
  for (const roleId of ["role.requestor", "role.security_analyst_agent"]) {
    assert.ok(!effectiveOperations(catalogue, roleId).has(catalogueUrl), `PHASE13_ASSIGNABLE_GRANT_${roleId}`);
  }

  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE13_ASSIGNABLE_SPECIFICATION_PARSE");
  const operationValue = operation(specification, "/v1/assessment_requests/{requestId}/assignable_analysts", "get");
  assert.equal(operationValue.operationId, "assessment-workflow/get-assignable-analysts", "PHASE13_ASSIGNABLE_OPERATION_ID");
  assert.deepEqual(operationValue.tags, ["assessment-workflow"], "PHASE13_ASSIGNABLE_TAGS");
  const search = parameter(operationValue, "q");
  assert.equal(search?.in, "query", "PHASE13_ASSIGNABLE_QUERY_IN");
  assert.equal(search?.required, false, "PHASE13_ASSIGNABLE_QUERY_REQUIRED");
  assert.deepEqual([search?.schema?.minLength, search?.schema?.maxLength], [1, 100], "PHASE13_ASSIGNABLE_QUERY_BOUNDS");
  assert.equal(responseSchema(operationValue).$ref, "#/components/schemas/AssignableAnalystListResponse", "PHASE13_ASSIGNABLE_RESPONSE");
  for (const status of ["400", "403", "404", "409"]) assert.ok(operationValue.responses[status], `PHASE13_ASSIGNABLE_${status}_RESPONSE`);
  const list = specification.components.schemas.AssignableAnalystListResponse;
  assert.equal(list.additionalProperties, false, "PHASE13_ASSIGNABLE_LIST_CLOSED");
  assert.deepEqual(list.required, ["data"], "PHASE13_ASSIGNABLE_LIST_REQUIRED");
  assert.equal(list.properties.data.maxItems, 50, "PHASE13_ASSIGNABLE_LIST_BOUND");
  assert.equal(list.properties.data.items.$ref, "#/components/schemas/ActiveUserSummary", "PHASE13_ASSIGNABLE_LIST_ITEMS");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.ok(generatedSchema.includes('"/v1/assessment_requests/{requestId}/assignable_analysts": {'), "PHASE13_ASSIGNABLE_GENERATED_PATH");
  assert.ok(generatedSchema.includes('get: operations["assessment-workflow/get-assignable-analysts"];'), "PHASE13_ASSIGNABLE_GENERATED_OPERATION");
});

/*
 * Phase 13 (D-02, D-30): request notes are held by one API-only Function granted both ways to the Security Analyst
 * and the Requestor, never to the Security Analyst Agent, and published closed in the contract. Design note 6 records
 * the notes as Phase 13's collaboration entity.
 */
test("Phase 13 request notes are held by one Function granted to the Security Analyst and the Requestor alone and published closed", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE13_NOTES_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE13_NOTES_CATALOGUE_PARSE");
  const functionId = "function.risk_assessment_requests.notes_api";
  const operations = [
    { url: "GET:/api/v1/assessment_requests/{requestId}/notes", id: `${functionId}.api.01`, name: "List Assessment Request Notes" },
    { url: "POST:/api/v1/assessment_requests/{requestId}/notes", id: `${functionId}.api.02`, name: "Add Assessment Request Note" },
    { url: "POST:/api/v1/assessment_requests/{requestId}/notes/read", id: `${functionId}.api.03`, name: "Mark Assessment Request Notes Read" },
  ];
  const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === functionId);
  assert.equal(functions.length, 1, "PHASE13_NOTES_FUNCTION_MISSING");
  assert.equal(functions[0].name, "Assessment Request Notes API", "PHASE13_NOTES_FUNCTION_NAME");
  assert.deepEqual(functions[0].roleIds, ["role.security_analyst", "role.requestor"], "PHASE13_NOTES_ROLE_SCOPE");
  assert.equal("menuPath" in functions[0], false, "PHASE13_NOTES_MENU_PATH");
  assert.deepEqual(functions[0].functionApiIds, operations.map((entry) => entry.id), "PHASE13_NOTES_FUNCTION_API_IDS");
  assert.deepEqual(functions[0].sourceEntities, ["CsrmAssessmentRequest", "CsrmRequestNote", "CsrmRequestNoteReadState"], "PHASE13_NOTES_SOURCE_ENTITIES");
  for (const { url, id, name } of operations) {
    const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === url);
    assert.deepEqual(apis.map((entry: JsonObject) => [entry.id, entry.functionId, entry.name]), [[id, functionId, name]], `PHASE13_NOTES_FUNCTION_API_${url}`);
    for (const roleId of ["role.security_analyst", "role.requestor"]) {
      assert.ok(effectiveOperations(catalogue, roleId).has(url), `PHASE13_NOTES_GRANT_${roleId}_${url}`);
    }
    assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(url), `PHASE13_NOTES_AGENT_GRANT_${url}`);
  }
  for (const roleId of ["role.security_analyst", "role.requestor"]) {
    assert.ok(catalogue.roles.find((entry: JsonObject) => entry.id === roleId).functionIds.includes(functionId), `PHASE13_NOTES_FUNCTION_${roleId}`);
  }
  assert.equal(catalogue.roles.find((entry: JsonObject) => entry.id === "role.security_analyst_agent").functionIds.includes(functionId), false, "PHASE13_NOTES_FUNCTION_AGENT");
  assert.ok(catalogue.designNotes[5].includes("docs/contract-gaps/phase-13-request-notes.md"), "PHASE13_NOTES_DESIGN_NOTE_6");
  assert.ok(catalogue.designNotes[5].includes("COLLAB-03"), "PHASE13_NOTES_DESIGN_NOTE_6_COLLAB_03");

  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE13_NOTES_SPECIFICATION_PARSE");
  const list = operation(specification, "/v1/assessment_requests/{requestId}/notes", "get");
  const add = operation(specification, "/v1/assessment_requests/{requestId}/notes", "post");
  const read = operation(specification, "/v1/assessment_requests/{requestId}/notes/read", "post");
  assert.deepEqual([list.operationId, add.operationId, read.operationId], [
    "assessment-workflow/list-request-notes",
    "assessment-workflow/add-request-note",
    "assessment-workflow/mark-request-notes-read",
  ], "PHASE13_NOTES_OPERATION_IDS");
  assert.deepEqual([parameter(list, "before")?.schema?.minimum, parameter(list, "limit")?.schema?.minimum, parameter(list, "limit")?.schema?.maximum], [1, 1, 50], "PHASE13_NOTES_LIST_QUERY");
  assert.equal(responseSchema(list).$ref, "#/components/schemas/RequestNoteListResponse", "PHASE13_NOTES_LIST_RESPONSE");
  assert.equal(add.requestBody.content["application/json"].schema.$ref, "#/components/schemas/RequestNoteCreateRequest", "PHASE13_NOTES_ADD_BODY");
  assert.equal(responseSchema(add).$ref, "#/components/schemas/RequestNoteResponse", "PHASE13_NOTES_ADD_RESPONSE");
  assert.equal(read.requestBody.content["application/json"].schema.$ref, "#/components/schemas/RequestNotesReadRequest", "PHASE13_NOTES_READ_BODY");
  assert.equal(responseSchema(read).$ref, "#/components/schemas/RequestNotesReadResponse", "PHASE13_NOTES_READ_RESPONSE");
  for (const value of [list, add, read]) {
    for (const status of ["400", "403", "404"]) assert.ok(value.responses[status], `PHASE13_NOTES_${status}_RESPONSE_${value.operationId}`);
  }
  assert.ok(add.responses["409"], "PHASE13_NOTES_ADD_409_RESPONSE");
  const schemas = specification.components.schemas;
  for (const name of ["RequestNote", "RequestNoteListMeta", "RequestNoteListResponse", "RequestNoteCreateRequest", "RequestNoteResponse", "RequestNotesReadRequest", "RequestNotesReadState", "RequestNotesReadResponse"]) {
    assert.ok(schemas[name], `PHASE13_NOTES_SCHEMA_MISSING_${name}`);
    assert.equal(schemas[name].additionalProperties, false, `PHASE13_NOTES_SCHEMA_OPEN_${name}`);
  }
  assert.deepEqual(schemas.RequestNotePart.enum, ["requestor", "security-analyst"], "PHASE13_NOTES_PART");
  assert.deepEqual([schemas.RequestNote.properties.body.minLength, schemas.RequestNote.properties.body.maxLength], [1, 5000], "PHASE13_NOTES_BODY_BOUNDS");
  assert.equal(schemas.RequestNoteListResponse.properties.data.maxItems, 50, "PHASE13_NOTES_PAGE_BOUND");
  assert.deepEqual(Object.keys(schemas.RequestNoteCreateRequest.properties.data.properties).sort(), ["body", "changesAiInputs"], "PHASE13_NOTES_CREATE_KEYS");
  assert.deepEqual(Object.keys(schemas.RequestNotesReadRequest.properties.data.properties), ["throughNoteId"], "PHASE13_NOTES_READ_KEYS");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.ok(generatedSchema.includes('"/v1/assessment_requests/{requestId}/notes": {'), "PHASE13_NOTES_GENERATED_PATH");
  assert.ok(generatedSchema.includes('"/v1/assessment_requests/{requestId}/notes/read": {'), "PHASE13_NOTES_READ_GENERATED_PATH");
  assert.ok(generatedSchema.includes('get: operations["assessment-workflow/list-request-notes"];'), "PHASE13_NOTES_GENERATED_LIST");
  assert.ok(generatedSchema.includes('post: operations["assessment-workflow/add-request-note"];'), "PHASE13_NOTES_GENERATED_ADD");
  assert.ok(generatedSchema.includes('post: operations["assessment-workflow/mark-request-notes-read"];'), "PHASE13_NOTES_GENERATED_READ");
});

/*
 * Phase 14 (D-03, D-38): request attachments are held by one API-only Function granted both ways to the Security
 * Analyst and the Requestor, never to the Security Analyst Agent, and published closed. Design note 6 records the
 * attachment as the recorded entity of docs/contract-gaps/phase-14-request-attachments.md.
 */
test("Phase 14 request attachments are held by one Function granted to the Security Analyst and the Requestor alone and published closed", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE14_ATTACHMENTS_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE14_ATTACHMENTS_CATALOGUE_PARSE");
  const functionId = "function.risk_assessment_requests.attachments_api";
  const operations = [
    { url: "GET:/api/v1/assessment_requests/{requestId}/attachments", id: `${functionId}.api.01`, name: "List Assessment Request Attachments" },
    { url: "POST:/api/v1/assessment_requests/{requestId}/attachments", id: `${functionId}.api.02`, name: "Upload Assessment Request Attachment" },
    { url: "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content", id: `${functionId}.api.03`, name: "Download Assessment Request Attachment" },
    { url: "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal", id: `${functionId}.api.04`, name: "Set Assessment Request Attachment Removal" },
  ];
  const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === functionId);
  assert.equal(functions.length, 1, "PHASE14_ATTACHMENTS_FUNCTION_MISSING");
  assert.equal(functions[0].name, "Assessment Request Attachments API", "PHASE14_ATTACHMENTS_FUNCTION_NAME");
  assert.equal(functions[0].description, "Requestor and Security Analyst request attachments. This API-only Function intentionally has no menuPath.", "PHASE14_ATTACHMENTS_FUNCTION_DESCRIPTION");
  assert.deepEqual(functions[0].roleIds, ["role.security_analyst", "role.requestor"], "PHASE14_ATTACHMENTS_ROLE_SCOPE");
  assert.equal("menuPath" in functions[0], false, "PHASE14_ATTACHMENTS_MENU_PATH");
  assert.deepEqual(functions[0].functionApiIds, operations.map((entry) => entry.id), "PHASE14_ATTACHMENTS_FUNCTION_API_IDS");
  assert.deepEqual(functions[0].sourceEntities, ["CsrmAssessmentRequest", "CsrmRequestAttachment"], "PHASE14_ATTACHMENTS_SOURCE_ENTITIES");
  for (const { url, id, name } of operations) {
    const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === url);
    assert.deepEqual(apis.map((entry: JsonObject) => [entry.id, entry.functionId, entry.name]), [[id, functionId, name]], `PHASE14_ATTACHMENTS_FUNCTION_API_${url}`);
    assert.deepEqual(apis[0].sourceEntities, ["CsrmAssessmentRequest", "CsrmRequestAttachment"], `PHASE14_ATTACHMENTS_FUNCTION_API_SOURCES_${url}`);
    for (const roleId of ["role.security_analyst", "role.requestor"]) {
      assert.ok(effectiveOperations(catalogue, roleId).has(url), `PHASE14_ATTACHMENTS_GRANT_${roleId}_${url}`);
    }
    assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(url), `PHASE14_ATTACHMENTS_AGENT_GRANT_${url}`);
  }
  for (const role of catalogue.roles as JsonObject[]) {
    const holds = role.id === "role.security_analyst" || role.id === "role.requestor";
    assert.equal(role.functionIds.includes(functionId), holds, `PHASE14_ATTACHMENTS_FUNCTION_${role.id}`);
  }
  assert.ok(catalogue.designNotes[5].includes("docs/contract-gaps/phase-14-request-attachments.md"), "PHASE14_ATTACHMENTS_DESIGN_NOTE_6");
  assert.ok(catalogue.designNotes[5].includes("CsrmRequestAttachment"), "PHASE14_ATTACHMENTS_DESIGN_NOTE_6_ENTITY");
  assert.ok(catalogue.designNotes[5].includes("docs/contract-gaps/phase-13-request-notes.md"), "PHASE14_ATTACHMENTS_DESIGN_NOTE_6_KEEPS_NOTES");

  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE14_ATTACHMENTS_SPECIFICATION_PARSE");
  const list = operation(specification, "/v1/assessment_requests/{requestId}/attachments", "get");
  const upload = operation(specification, "/v1/assessment_requests/{requestId}/attachments", "post");
  assert.deepEqual([list.operationId, upload.operationId], ["assessment-workflow/list-request-attachments", "assessment-workflow/upload-request-attachment"], "PHASE14_ATTACHMENTS_OPERATION_IDS");
  assert.equal(responseSchema(list).$ref, "#/components/schemas/RequestAttachmentListResponse", "PHASE14_ATTACHMENTS_LIST_RESPONSE");
  assert.deepEqual(Object.keys(list.responses).sort(), ["200", "403", "404"], "PHASE14_ATTACHMENTS_LIST_STATUSES");
  assert.deepEqual(Object.keys(upload.requestBody.content), ["multipart/form-data"], "PHASE14_ATTACHMENTS_UPLOAD_MEDIA_TYPE");
  assert.equal(upload.requestBody.content["multipart/form-data"].schema.$ref, "#/components/schemas/RequestAttachmentUploadRequest", "PHASE14_ATTACHMENTS_UPLOAD_BODY");
  assert.equal(upload.responses["201"].content["application/json"].schema.$ref, "#/components/schemas/RequestAttachmentResponse", "PHASE14_ATTACHMENTS_UPLOAD_RESPONSE");
  // The stage B amendment (2026-10-11, item 5): a full screening queue answers 503 ATTACHMENT_BUSY, retryable (WR-204).
  assert.deepEqual(Object.keys(upload.responses).sort(), ["201", "400", "403", "404", "409", "413", "415", "422", "503"], "PHASE14_ATTACHMENTS_UPLOAD_STATUSES");
  for (const [status, response] of [["400", "AssessmentBadRequest"], ["403", "AssessmentForbidden"], ["404", "AssessmentNotFound"], ["409", "AssessmentConflict"]]) {
    assert.equal(upload.responses[status].$ref, `#/components/responses/${response}`, `PHASE14_ATTACHMENTS_UPLOAD_${status}_RESPONSE`);
  }
  // 413, 415, 422 and 503 carry the closed reason in the same error envelope (422 is new to the contract, with details.detection).
  for (const status of ["413", "415", "422", "503"]) {
    assert.equal(upload.responses[status].content["application/json"].schema.$ref, "#/components/schemas/AssessmentWorkflowErrorResponse", `PHASE14_ATTACHMENTS_UPLOAD_${status}_SCHEMA`);
  }
  for (const reason of ["ATTACHMENT_UNSUPPORTED_STRUCTURE", "ATTACHMENT_ACTIVE_CONTENT"]) {
    assert.ok(String(upload.responses["415"].description).includes(reason), `PHASE14_ATTACHMENTS_UPLOAD_415_${reason}`);
    assert.ok(String(upload.description).includes(reason), `PHASE14_ATTACHMENTS_UPLOAD_DESCRIBES_${reason}`);
  }
  assert.ok(String(upload.responses["503"].description).includes("ATTACHMENT_BUSY"), "PHASE14_ATTACHMENTS_UPLOAD_503_REASON");
  assert.ok(String(upload.description).includes("ATTACHMENT_BUSY"), "PHASE14_ATTACHMENTS_UPLOAD_DESCRIBES_BUSY");
  const schemas = specification.components.schemas;
  // The list's total counts the files that are not removed (stage A's decision, confirmed by the pilot on 2026-10-11).
  assert.match(String(schemas.RequestAttachmentListMeta.properties.total.description), /not removed/, "PHASE14_ATTACHMENTS_TOTAL_DESCRIPTION");
  for (const name of [
    "RequestAttachmentActions", "RequestAttachment", "RequestAttachmentAddFacts", "RequestAttachmentListMeta", "RequestAttachmentListResponse",
    "RequestAttachmentResponse", "RequestAttachmentUploadRequest",
  ]) {
    assert.ok(schemas[name], `PHASE14_ATTACHMENTS_SCHEMA_MISSING_${name}`);
    assert.equal(schemas[name].additionalProperties, false, `PHASE14_ATTACHMENTS_SCHEMA_OPEN_${name}`);
  }
  assert.deepEqual(schemas.RequestAttachmentType.enum, ["pdf", "docx", "xlsx", "pptx", "csv", "txt", "png", "jpeg"], "PHASE14_ATTACHMENTS_TYPE");
  assert.deepEqual(schemas.RequestAttachmentState.enum, ["available", "pending", "blocked", "removed", "unavailable"], "PHASE14_ATTACHMENTS_STATE");
  assert.deepEqual(schemas.RequestAttachmentPart.enum, ["requestor", "security-analyst"], "PHASE14_ATTACHMENTS_PART");
  assert.deepEqual(Object.keys(schemas.RequestAttachmentUploadRequest.properties).sort(), ["file", "noteId"], "PHASE14_ATTACHMENTS_UPLOAD_PARTS");
  assert.deepEqual(schemas.RequestAttachmentUploadRequest.required, ["file"], "PHASE14_ATTACHMENTS_UPLOAD_REQUIRED");
  assert.equal(schemas.RequestAttachmentUploadRequest.properties.file.format, "binary", "PHASE14_ATTACHMENTS_UPLOAD_FILE");
  assert.deepEqual([schemas.RequestAttachment.properties.byteSize.minimum, schemas.RequestAttachment.properties.byteSize.maximum], [1, 26_214_400], "PHASE14_ATTACHMENTS_SIZE_BOUNDS");
  assert.equal(schemas.RequestAttachmentListResponse.properties.data.maxItems, 60, "PHASE14_ATTACHMENTS_LIST_BOUND");
  for (const secret of ["sha256", "hash", "url", "aiText", "file", "storageKey"]) {
    assert.equal(secret in schemas.RequestAttachment.properties, false, `PHASE14_ATTACHMENTS_SERVES_${secret}`);
  }
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.ok(generatedSchema.includes('"/v1/assessment_requests/{requestId}/attachments": {'), "PHASE14_ATTACHMENTS_GENERATED_PATH");
  assert.ok(generatedSchema.includes('get: operations["assessment-workflow/list-request-attachments"];'), "PHASE14_ATTACHMENTS_GENERATED_LIST");
  assert.ok(generatedSchema.includes('post: operations["assessment-workflow/upload-request-attachment"];'), "PHASE14_ATTACHMENTS_GENERATED_UPLOAD");

  // 14-07 (D-23; 14-RESEARCH Pitfall 12): the contract's first binary response. The 200 is the file under each allowed
  // type's media type, with the four hardening headers; every refusal is the JSON error envelope.
  const downloadPath = "/v1/assessment_requests/{requestId}/attachments/{attachmentId}/content";
  const contentOperation = operation(specification, downloadPath, "get");
  assert.equal(contentOperation.operationId, "assessment-workflow/download-request-attachment", "PHASE14_ATTACHMENTS_DOWNLOAD_OPERATION_ID");
  assert.equal(contentOperation.requestBody, undefined, "PHASE14_ATTACHMENTS_DOWNLOAD_BODY");
  assert.deepEqual(contentOperation.parameters.map((entry: JsonObject) => [entry.name, entry.in, entry.required]), [["requestId", "path", true], ["attachmentId", "path", true]], "PHASE14_ATTACHMENTS_DOWNLOAD_PARAMETERS");
  assert.deepEqual(Object.keys(contentOperation.responses).sort(), ["200", "403", "404", "409"], "PHASE14_ATTACHMENTS_DOWNLOAD_STATUSES");
  const mediaTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "text/csv",
    "text/plain",
    "image/png",
    "image/jpeg",
  ];
  const fileContent = contentOperation.responses["200"].content;
  assert.deepEqual(Object.keys(fileContent), mediaTypes, "PHASE14_ATTACHMENTS_DOWNLOAD_MEDIA_TYPES");
  for (const mediaType of mediaTypes) {
    assert.deepEqual(fileContent[mediaType].schema, { type: "string", contentMediaType: mediaType }, `PHASE14_ATTACHMENTS_DOWNLOAD_SCHEMA_${mediaType}`);
  }
  assert.deepEqual(Object.keys(contentOperation.responses["200"].headers).sort(), ["Cache-Control", "Content-Disposition", "Content-Security-Policy", "X-Content-Type-Options"], "PHASE14_ATTACHMENTS_DOWNLOAD_HEADERS");
  for (const [status, response] of [["403", "AssessmentForbidden"], ["404", "AssessmentNotFound"], ["409", "AssessmentConflict"]]) {
    assert.equal(contentOperation.responses[status].$ref, `#/components/responses/${response}`, `PHASE14_ATTACHMENTS_DOWNLOAD_${status}_RESPONSE`);
  }
  assert.ok(generatedSchema.includes(`"${downloadPath}": {`), "PHASE14_ATTACHMENTS_GENERATED_DOWNLOAD_PATH");
  assert.ok(generatedSchema.includes('get: operations["assessment-workflow/download-request-attachment"];'), "PHASE14_ATTACHMENTS_GENERATED_DOWNLOAD");

  // 14-08 (D-04 item 4, D-20): soft removal and restore, one closed body `{ data: { removed } }`, the file back.
  const removalPath = "/v1/assessment_requests/{requestId}/attachments/{attachmentId}/removal";
  const removal = operation(specification, removalPath, "put");
  assert.equal(removal.operationId, "assessment-workflow/set-request-attachment-removal", "PHASE14_ATTACHMENTS_REMOVAL_OPERATION_ID");
  assert.deepEqual(removal.parameters.map((entry: JsonObject) => [entry.name, entry.in, entry.required]), [["requestId", "path", true], ["attachmentId", "path", true]], "PHASE14_ATTACHMENTS_REMOVAL_PARAMETERS");
  assert.deepEqual(Object.keys(removal.requestBody.content), ["application/json"], "PHASE14_ATTACHMENTS_REMOVAL_MEDIA_TYPE");
  assert.equal(removal.requestBody.content["application/json"].schema.$ref, "#/components/schemas/RequestAttachmentRemovalRequest", "PHASE14_ATTACHMENTS_REMOVAL_BODY");
  assert.equal(removal.responses["200"].content["application/json"].schema.$ref, "#/components/schemas/RequestAttachmentResponse", "PHASE14_ATTACHMENTS_REMOVAL_RESPONSE");
  assert.deepEqual(Object.keys(removal.responses).sort(), ["200", "400", "403", "404", "409"], "PHASE14_ATTACHMENTS_REMOVAL_STATUSES");
  for (const [status, response] of [["400", "AssessmentBadRequest"], ["403", "AssessmentForbidden"], ["404", "AssessmentNotFound"], ["409", "AssessmentConflict"]]) {
    assert.equal(removal.responses[status].$ref, `#/components/responses/${response}`, `PHASE14_ATTACHMENTS_REMOVAL_${status}_RESPONSE`);
  }
  const removalRequest = schemas.RequestAttachmentRemovalRequest;
  assert.equal(removalRequest?.additionalProperties, false, "PHASE14_ATTACHMENTS_REMOVAL_REQUEST_OPEN");
  assert.deepEqual(removalRequest?.required, ["data"], "PHASE14_ATTACHMENTS_REMOVAL_REQUEST_REQUIRED");
  assert.deepEqual(removalRequest?.properties?.data, {
    type: "object",
    properties: { removed: { type: "boolean", description: removalRequest?.properties?.data?.properties?.removed?.description } },
    required: ["removed"],
    additionalProperties: false,
  }, "PHASE14_ATTACHMENTS_REMOVAL_REQUEST_DATA");
  assert.ok(generatedSchema.includes(`"${removalPath}": {`), "PHASE14_ATTACHMENTS_GENERATED_REMOVAL_PATH");
  assert.ok(generatedSchema.includes('put: operations["assessment-workflow/set-request-attachment-removal"];'), "PHASE14_ATTACHMENTS_GENERATED_REMOVAL");
});

/*
 * Phase 13 (D-26, D-30): the AI-input mark on a request note is held by its own API-only Function, granted both ways to
 * the human Security Analyst alone (never the Requestor, never the Security Analyst Agent), and published closed.
 */
test("Phase 13 note AI-input mark is held by one human Security Analyst-only Function and published closed", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE13_AI_INPUT_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE13_AI_INPUT_CATALOGUE_PARSE");
  const functionId = "function.risk_assessment_requests.note_ai_input_api";
  const catalogueUrl = "PUT:/api/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input";
  const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === functionId);
  assert.equal(functions.length, 1, "PHASE13_AI_INPUT_FUNCTION_MISSING");
  assert.equal(functions[0].name, "Assessment Request Note AI Input API", "PHASE13_AI_INPUT_FUNCTION_NAME");
  assert.equal(functions[0].description, "Human analyst-only AI-input mark on request notes. This API-only Function intentionally has no menuPath.", "PHASE13_AI_INPUT_FUNCTION_DESCRIPTION");
  assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], "PHASE13_AI_INPUT_ROLE_SCOPE");
  assert.equal("menuPath" in functions[0], false, "PHASE13_AI_INPUT_MENU_PATH");
  assert.deepEqual(functions[0].functionApiIds, [`${functionId}.api.01`], "PHASE13_AI_INPUT_FUNCTION_API_IDS");
  const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === catalogueUrl);
  assert.deepEqual(apis.map((entry: JsonObject) => [entry.id, entry.functionId, entry.name]), [[`${functionId}.api.01`, functionId, "Set Request Note AI Input Mark"]], "PHASE13_AI_INPUT_FUNCTION_API");
  assert.deepEqual(apis[0].sourceEntities, ["CsrmRequestNote", "CsrmAssessmentRequest"], "PHASE13_AI_INPUT_SOURCE_ENTITIES");
  assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(catalogueUrl), "PHASE13_ANALYST_AI_INPUT_GRANT");
  for (const role of catalogue.roles as JsonObject[]) {
    const holds = role.id === "role.security_analyst";
    assert.equal(role.functionIds.includes(functionId), holds, `PHASE13_AI_INPUT_FUNCTION_${role.id}`);
    assert.equal(effectiveOperations(catalogue, role.id).has(catalogueUrl), holds, `PHASE13_AI_INPUT_GRANT_${role.id}`);
  }

  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE13_AI_INPUT_SPECIFICATION_PARSE");
  const operationValue = operation(specification, "/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input", "put");
  assert.equal(operationValue.operationId, "assessment-workflow/set-request-note-ai-input", "PHASE13_AI_INPUT_OPERATION_ID");
  assert.deepEqual([parameter(operationValue, "requestId")?.in, parameter(operationValue, "noteId")?.in], ["path", "path"], "PHASE13_AI_INPUT_PARAMETERS");
  assert.equal(operationValue.requestBody.content["application/json"].schema.$ref, "#/components/schemas/RequestNoteAiInputRequest", "PHASE13_AI_INPUT_REQUEST_BODY");
  assert.equal(responseSchema(operationValue).$ref, "#/components/schemas/RequestNoteResponse", "PHASE13_AI_INPUT_RESPONSE");
  for (const status of ["400", "403", "404", "409"]) assert.ok(operationValue.responses[status], `PHASE13_AI_INPUT_${status}_RESPONSE`);
  const body = specification.components.schemas.RequestNoteAiInputRequest;
  assert.equal(body.additionalProperties, false, "PHASE13_AI_INPUT_BODY_CLOSED");
  assert.equal(body.properties.data.additionalProperties, false, "PHASE13_AI_INPUT_BODY_DATA_CLOSED");
  assert.deepEqual(body.properties.data.required, ["changesAiInputs"], "PHASE13_AI_INPUT_BODY_REQUIRED");
  assert.equal(body.properties.data.properties.changesAiInputs.type, "boolean", "PHASE13_AI_INPUT_BODY_TYPE");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.ok(generatedSchema.includes('"/v1/assessment_requests/{requestId}/notes/{noteId}/ai_input": {'), "PHASE13_AI_INPUT_GENERATED_PATH");
  assert.ok(generatedSchema.includes('put: operations["assessment-workflow/set-request-note-ai-input"];'), "PHASE13_AI_INPUT_GENERATED_OPERATION");
});

/*
 * Phase 14 (D-30, D-31, D-38): a request attachment's AI inclusion and its text preview are held by their own API-only
 * Function, granted both ways to the human Security Analyst alone (never the Requestor, never the Security Analyst
 * Agent), and published closed.
 */
test("Phase 14 attachment AI inclusion and preview are held by one human Security Analyst-only Function and published closed", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE14_AI_INPUT_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE14_AI_INPUT_CATALOGUE_PARSE");
  const functionId = "function.risk_assessment_requests.attachment_ai_input_api";
  const operations = [
    { url: "PUT:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input", id: `${functionId}.api.01`, name: "Set Assessment Request Attachment AI Input" },
    { url: "GET:/api/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text", id: `${functionId}.api.02`, name: "Read Assessment Request Attachment AI Text" },
  ];
  const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === functionId);
  assert.equal(functions.length, 1, "PHASE14_AI_INPUT_FUNCTION_MISSING");
  assert.equal(functions[0].name, "Assessment Request Attachment AI Input API", "PHASE14_AI_INPUT_FUNCTION_NAME");
  assert.equal(functions[0].description, "Security Analyst choice of which attachment text the AI may read. This API-only Function intentionally has no menuPath.", "PHASE14_AI_INPUT_FUNCTION_DESCRIPTION");
  assert.deepEqual(functions[0].roleIds, ["role.security_analyst"], "PHASE14_AI_INPUT_ROLE_SCOPE");
  assert.equal("menuPath" in functions[0], false, "PHASE14_AI_INPUT_MENU_PATH");
  assert.deepEqual(functions[0].functionApiIds, operations.map((entry) => entry.id), "PHASE14_AI_INPUT_FUNCTION_API_IDS");
  assert.deepEqual(functions[0].sourceEntities, ["CsrmAssessmentRequest", "CsrmRequestAttachment"], "PHASE14_AI_INPUT_SOURCE_ENTITIES");
  for (const { url, id, name } of operations) {
    const apis = catalogue.functionApis.filter((entry: JsonObject) => entry.url === url);
    assert.deepEqual(apis.map((entry: JsonObject) => [entry.id, entry.functionId, entry.name]), [[id, functionId, name]], `PHASE14_AI_INPUT_FUNCTION_API_${url}`);
    assert.deepEqual(apis[0].sourceEntities, ["CsrmAssessmentRequest", "CsrmRequestAttachment"], `PHASE14_AI_INPUT_FUNCTION_API_SOURCES_${url}`);
    for (const role of catalogue.roles as JsonObject[]) {
      assert.equal(effectiveOperations(catalogue, role.id).has(url), role.id === "role.security_analyst", `PHASE14_AI_INPUT_GRANT_${role.id}_${url}`);
    }
  }
  for (const role of catalogue.roles as JsonObject[]) {
    assert.equal(role.functionIds.includes(functionId), role.id === "role.security_analyst", `PHASE14_AI_INPUT_FUNCTION_${role.id}`);
  }
  assert.ok(catalogue.designNotes[5].includes(functionId), "PHASE14_AI_INPUT_DESIGN_NOTE_6");

  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE14_AI_INPUT_SPECIFICATION_PARSE");
  const schemas = specification.components.schemas;
  const aiInputPath = "/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_input";
  const aiTextPath = "/v1/assessment_requests/{requestId}/attachments/{attachmentId}/ai_text";
  const setAiInput = operation(specification, aiInputPath, "put");
  const getAiText = operation(specification, aiTextPath, "get");
  assert.deepEqual([setAiInput.operationId, getAiText.operationId], ["assessment-workflow/set-request-attachment-ai-input", "assessment-workflow/get-request-attachment-ai-text"], "PHASE14_AI_INPUT_OPERATION_IDS");
  for (const value of [setAiInput, getAiText]) {
    assert.deepEqual(value.parameters.map((entry: JsonObject) => [entry.name, entry.in, entry.required]), [["requestId", "path", true], ["attachmentId", "path", true]], `PHASE14_AI_INPUT_PARAMETERS_${value.operationId}`);
  }
  assert.equal(setAiInput.requestBody.content["application/json"].schema.$ref, "#/components/schemas/RequestAttachmentAiInputRequest", "PHASE14_AI_INPUT_REQUEST_BODY");
  assert.equal(responseSchema(setAiInput).$ref, "#/components/schemas/RequestAttachmentResponse", "PHASE14_AI_INPUT_RESPONSE");
  // The stage B amendment (2026-10-11, item 5): a full extraction queue answers 503 ATTACHMENT_BUSY, retryable (WR-204).
  assert.deepEqual(Object.keys(setAiInput.responses).sort(), ["200", "400", "403", "404", "409", "503"], "PHASE14_AI_INPUT_STATUSES");
  assert.equal(setAiInput.responses["503"].content["application/json"].schema.$ref, "#/components/schemas/AssessmentWorkflowErrorResponse", "PHASE14_AI_INPUT_503_SCHEMA");
  assert.ok(String(setAiInput.responses["503"].description).includes("ATTACHMENT_BUSY"), "PHASE14_AI_INPUT_503_REASON");
  assert.ok(String(setAiInput.description).includes("ATTACHMENT_BUSY"), "PHASE14_AI_INPUT_DESCRIBES_BUSY");
  assert.equal(getAiText.requestBody, undefined, "PHASE14_AI_TEXT_BODY");
  assert.equal(responseSchema(getAiText).$ref, "#/components/schemas/RequestAttachmentAiTextResponse", "PHASE14_AI_TEXT_RESPONSE");
  assert.deepEqual(Object.keys(getAiText.responses).sort(), ["200", "403", "404", "409"], "PHASE14_AI_TEXT_STATUSES");
  for (const [status, response] of [["400", "AssessmentBadRequest"], ["403", "AssessmentForbidden"], ["404", "AssessmentNotFound"], ["409", "AssessmentConflict"]]) {
    assert.equal(setAiInput.responses[status].$ref, `#/components/responses/${response}`, `PHASE14_AI_INPUT_${status}_RESPONSE`);
    if (status !== "400") assert.equal(getAiText.responses[status].$ref, `#/components/responses/${response}`, `PHASE14_AI_TEXT_${status}_RESPONSE`);
  }
  for (const name of ["RequestAttachmentAiInputRequest", "RequestAttachmentAiFacts", "RequestAttachmentAi", "RequestAttachmentAiTextResponse"]) {
    assert.ok(schemas[name], `PHASE14_AI_INPUT_SCHEMA_MISSING_${name}`);
    assert.equal(schemas[name].additionalProperties, false, `PHASE14_AI_INPUT_SCHEMA_OPEN_${name}`);
  }
  assert.deepEqual(schemas.RequestAttachmentAiInputRequest.properties.data, {
    type: "object",
    properties: { included: { type: "boolean", description: schemas.RequestAttachmentAiInputRequest.properties.data.properties.included.description } },
    required: ["included"],
    additionalProperties: false,
  }, "PHASE14_AI_INPUT_REQUEST_DATA");
  assert.deepEqual(Object.keys(schemas.RequestAttachmentAi.properties), ["included", "facts", "unavailableReason", "canChange"], "PHASE14_AI_FIELD_KEYS");
  assert.deepEqual(schemas.RequestAttachmentAi.properties.unavailableReason.enum, ["ATTACHMENT_NOT_TEXT_BEARING", "ATTACHMENT_QUARANTINED", null], "PHASE14_AI_UNAVAILABLE_REASONS");
  assert.deepEqual(Object.keys(schemas.RequestAttachmentAiFacts.properties), ["available", "kept", "truncated"], "PHASE14_AI_FACT_KEYS");
  // The list's meta gains the analysts' optional AI policy for the section (D-28, D-30).
  assert.equal(schemas.RequestAttachmentAiPolicy?.additionalProperties, false, "PHASE14_AI_POLICY_OPEN");
  assert.deepEqual(Object.keys(schemas.RequestAttachmentAiPolicy.properties), ["canChange", "refusal", "classification", "ceiling"], "PHASE14_AI_POLICY_KEYS");
  assert.deepEqual(schemas.RequestAttachmentAiPolicy.properties.refusal.enum, ["OWN_REQUEST", "REQUEST_NOT_SUBMITTED", "ATTACHMENTS_CLOSED", "AI_CLASSIFICATION_ABOVE_CEILING", "AI_POLICY_NOT_CONFIGURED", null], "PHASE14_AI_POLICY_REFUSALS");
  assert.equal(schemas.RequestAttachmentListMeta.properties.aiPolicy.$ref, "#/components/schemas/RequestAttachmentAiPolicy", "PHASE14_AI_POLICY_ON_META");
  assert.equal(schemas.RequestAttachmentListMeta.required.includes("aiPolicy"), false, "PHASE14_AI_POLICY_ON_META_REQUIRED");
  // The served attachment gains the analysts' optional AI facts, never the text itself (D-05, D-31).
  assert.equal(schemas.RequestAttachment.properties.ai.$ref, "#/components/schemas/RequestAttachmentAi", "PHASE14_AI_ON_ATTACHMENT");
  assert.equal(schemas.RequestAttachment.required.includes("ai"), false, "PHASE14_AI_ON_ATTACHMENT_REQUIRED");
  const preview = schemas.RequestAttachmentAiTextResponse.properties.data;
  assert.deepEqual(Object.keys(preview.properties), ["text", "facts"], "PHASE14_AI_TEXT_KEYS");
  assert.equal(preview.properties.text.maxLength, 20_000, "PHASE14_AI_TEXT_CAP");
  assert.deepEqual(Object.keys(preview.properties.facts.properties), ["available", "kept", "truncated", "extractor", "extractedAt"], "PHASE14_AI_TEXT_FACT_KEYS");
  // IN-703: the run read serves each file's current name, so the description says the stored summary holds no
  // Requestor, note or file free text, and that the names are resolved from the attachment records when the run is
  // read (D-35). It does not say "no free text" at all: the summary keeps section titles and register names.
  const runSummary = String(schemas.AiRunContextSummary.description);
  assert.equal(runSummary.includes("with no Requestor, note or file free text"), false, "PHASE14_RUN_SUMMARY_CLAIMS_NO_FILE_FREE_TEXT");
  assert.ok(runSummary.includes("The stored summary holds no Requestor, note or file free text"), "PHASE14_RUN_SUMMARY_STORED_TEXT");
  assert.ok(runSummary.includes("each file's current name is resolved from its attachment record"), "PHASE14_RUN_SUMMARY_NAMES_AT_READ");
  const generatedSchema = readFileSync(path.join(repositoryDir, "apps", "csrm", "src", "lib", "api", "generated", "schema.d.ts"), "utf8");
  assert.ok(generatedSchema.includes(`"${aiInputPath}": {`), "PHASE14_AI_INPUT_GENERATED_PATH");
  assert.ok(generatedSchema.includes('put: operations["assessment-workflow/set-request-attachment-ai-input"];'), "PHASE14_AI_INPUT_GENERATED_OPERATION");
  assert.ok(generatedSchema.includes(`"${aiTextPath}": {`), "PHASE14_AI_TEXT_GENERATED_PATH");
  assert.ok(generatedSchema.includes('get: operations["assessment-workflow/get-request-attachment-ai-text"];'), "PHASE14_AI_TEXT_GENERATED_OPERATION");
});

/*
 * Phase 13 (D-18): any human Security Analyst on a request follows and retries its generation jobs, so no job
 * FunctionAPI describes itself as an initiating analyst's. No grant changes: every job Function stays the human
 * Security Analyst's alone, in both catalogue copies.
 */
test("Phase 13 generation job FunctionAPIs are neutral about who follows them and keep their grants (D-18)", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE13_JOB_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE13_JOB_CATALOGUE_PARSE");
  const description = (url: string) => (catalogue.functionApis as JsonObject[]).find((entry) => entry.url === url)?.description;
  assert.equal(description("GET:/api/v1/questionnaire_generation_jobs/{jobId}"), "Returns a retained questionnaire generation job.", "PHASE13_QUESTIONNAIRE_JOB_READ_DESCRIPTION");
  assert.equal(description("POST:/api/v1/questionnaire_generation_jobs/{jobId}/retry"), "Retries a failed questionnaire generation job.", "PHASE13_QUESTIONNAIRE_JOB_RETRY_DESCRIPTION");
  const jobFunctionIds = [
    "function.questionnaire_generation.generate_api",
    "function.questionnaire_generation.job_read_api",
    "function.questionnaire_generation.retry_api",
    "function.questionnaire_generation.request_jobs_read_api",
    "function.assessment_draft.generate_api",
    "function.assessment_draft.job_read_api",
    "function.assessment_draft.retry_api",
  ];
  for (const functionId of jobFunctionIds) {
    const entry = (catalogue.functions as JsonObject[]).find((candidate) => candidate.id === functionId);
    assert.deepEqual(entry?.roleIds, ["role.security_analyst"], `PHASE13_JOB_FUNCTION_ROLES_${functionId}`);
    for (const role of catalogue.roles as JsonObject[]) assert.equal(role.functionIds.includes(functionId), role.id === "role.security_analyst", `PHASE13_JOB_FUNCTION_GRANT_${functionId}_${role.id}`);
    for (const api of (catalogue.functionApis as JsonObject[]).filter((candidate) => candidate.functionId === functionId)) {
      assert.doesNotMatch(String(api.description), /initiating analyst/i, `PHASE13_JOB_FUNCTION_API_NAMES_THE_INITIATOR_${api.id}`);
    }
  }
});

/*
 * Phase 19 (D-13; phase-19-exports-and-export-log.md, "Functions, Grants and the Service Identity"): the reserved Risk
 * register export moved, with its name, URL and description unchanged, from the Risk Register menu Function (which the
 * Security Analyst Agent holds) into a human Security Analyst-only, API-only Function granted both ways, and the one
 * Phase 19 design note names the export Functions and the service-identity refusal set. 19-07 adds the request lists'
 * exports: the review queue's in the human analyst-only Analyst List Export API, and My requests' in the Requestor
 * birthright's My List Export API (every person exports their own records; the policy refuses the service identity).
 * 19-10 adds the released assessment's export, in the one Function granted to both Roles (the record-read check decides
 * which assessments each caller may export), and the two assessment lists' exports.
 * This is the operation-to-Function table of every served export.
 */
type Phase19Role = "role.security_analyst" | "role.requestor";

type Phase19ExportRoute = {
  /** Every list export is a GET; the report export is the catalogue's reserved POST with a closed JSON body (19-09). */
  method: "get" | "post";
  path: string;
  catalogueUrl: string;
  operationId: string;
  functionId: string;
  functionApiId: string;
  /** The Roles whose functionIds grant the Function: one, or both for the released assessment's export (19-10). */
  roleIds: readonly Phase19Role[];
  /** A fixed-table export takes no columns parameter (UI-D5): the report and the released assessment. */
  fixedTables?: true;
  /** The reserved entry the FunctionApi moved from, unchanged; absent for an operation Phase 19 adds. */
  reserved?: { functionId: string; functionApiId: string };
  name: string;
  description: string;
};

const phase19ExportRoutes: readonly Phase19ExportRoute[] = [
  {
    method: "get",
    path: "/v1/risks/export",
    catalogueUrl: "GET:/api/v1/risks/export?format={format}",
    operationId: "risk-register/export-risk-register",
    functionId: "function.risk_register.export_api",
    functionApiId: "function.risk_register.export_api.api.01",
    roleIds: ["role.security_analyst"],
    reserved: { functionId: "function.risk_register.risk_register", functionApiId: "function.risk_register.risk_register.api.04" },
    name: "Export Risk Register",
    description: "Exports the current authorized and filtered risk register view.",
  },
  {
    method: "get",
    path: "/v1/assessment_requests/export",
    catalogueUrl: "GET:/api/v1/assessment_requests/export",
    operationId: "assessment-workflow/export-assessment-request-queue",
    functionId: "function.analyst_exports.list_export_api",
    functionApiId: "function.analyst_exports.list_export_api.api.01",
    roleIds: ["role.security_analyst"],
    name: "Export Requests",
    description: "Exports the current authorized request queue view in the requested supported format.",
  },
  {
    method: "get",
    path: "/v1/my_requests/export",
    catalogueUrl: "GET:/api/v1/my_requests/export",
    operationId: "assessment-workflow/export-my-requests",
    functionId: "function.my_exports.list_export_api",
    functionApiId: "function.my_exports.list_export_api.api.01",
    roleIds: ["role.requestor"],
    name: "Export My Requests",
    description: "Exports the caller's own requests in the current view.",
  },
  // 19-08: the questionnaire review list's and the alert list's exports join the Analyst List Export API, My
  // questionnaires' joins the My List Export API.
  {
    method: "get",
    path: "/v1/questionnaires/export",
    catalogueUrl: "GET:/api/v1/questionnaires/export",
    operationId: "questionnaire-workflow/export-questionnaires-for-review",
    functionId: "function.analyst_exports.list_export_api",
    functionApiId: "function.analyst_exports.list_export_api.api.02",
    roleIds: ["role.security_analyst"],
    name: "Export Questionnaires",
    description: "Exports the current authorized questionnaire review view in the requested supported format.",
  },
  {
    method: "get",
    path: "/v1/alerts/export",
    catalogueUrl: "GET:/api/v1/alerts/export",
    operationId: "analyst-insights/export-alerts",
    functionId: "function.analyst_exports.list_export_api",
    functionApiId: "function.analyst_exports.list_export_api.api.03",
    roleIds: ["role.security_analyst"],
    name: "Export Alerts",
    description: "Exports the current authorized alert view in the requested supported format.",
  },
  {
    method: "get",
    path: "/v1/my_questionnaires/export",
    catalogueUrl: "GET:/api/v1/my_questionnaires/export",
    operationId: "questionnaire-workflow/export-my-questionnaires",
    functionId: "function.my_exports.list_export_api",
    functionApiId: "function.my_exports.list_export_api.api.02",
    roleIds: ["role.requestor"],
    name: "Export My Questionnaires",
    description: "Exports the caller's own questionnaires in the current view.",
  },
  // 19-09: the reserved report export moved, unchanged, from the Reports menu Function into the Report Export API.
  {
    method: "post",
    path: "/v1/reports/{reportKey}/export",
    catalogueUrl: "POST:/api/v1/reports/{reportKey}/export",
    operationId: "analyst-insights/export-report",
    functionId: "function.reports.export_api",
    functionApiId: "function.reports.export_api.api.01",
    roleIds: ["role.security_analyst"],
    reserved: { functionId: "function.reports.reports", functionApiId: "function.reports.reports.api.03" },
    fixedTables: true,
    name: "Export Report",
    description: "Generates an export of a selected report in the requested supported format.",
  },
  // 19-10: the released assessment's export, in a Function of its own granted to both Roles, and the two assessment
  // lists' exports, joining the Analyst List Export API and the My List Export API.
  {
    method: "get",
    path: "/v1/risk_assessments/{assessmentId}/export",
    catalogueUrl: "GET:/api/v1/risk_assessments/{assessmentId}/export",
    operationId: "assessment-workflow/export-released-risk-assessment",
    functionId: "function.risk_assessments.export_api",
    functionApiId: "function.risk_assessments.export_api.api.01",
    roleIds: ["role.security_analyst", "role.requestor"],
    fixedTables: true,
    name: "Export Risk Assessment",
    description: "Exports a released risk assessment in the requested supported format.",
  },
  {
    method: "get",
    path: "/v1/risk_assessments/export",
    catalogueUrl: "GET:/api/v1/risk_assessments/export",
    operationId: "assessment-workflow/export-risk-assessments",
    functionId: "function.analyst_exports.list_export_api",
    functionApiId: "function.analyst_exports.list_export_api.api.04",
    roleIds: ["role.security_analyst"],
    name: "Export Risk Assessments",
    description: "Exports the current authorized risk assessment review view in the requested supported format.",
  },
  {
    method: "get",
    path: "/v1/my_risk_assessments/export",
    catalogueUrl: "GET:/api/v1/my_risk_assessments/export",
    operationId: "assessment-workflow/export-my-released-risk-assessments",
    functionId: "function.my_exports.list_export_api",
    functionApiId: "function.my_exports.list_export_api.api.03",
    roleIds: ["role.requestor"],
    name: "Export My Risk Assessments",
    description: "Exports the caller's own released risk assessments in the current view.",
  },
];

/**
 * A Phase 19 export Function's description: human analyst-only, the Requestor birthright's, or (granted to both Roles)
 * the released assessment's, which the record-read check scopes; always API-only.
 */
function phase19FunctionDescription(roleIds: readonly Phase19Role[]): RegExp {
  if (roleIds.length > 1) return /^Export grant for a released risk assessment; the record-read check decides .*This API-only Function intentionally has no menuPath\.$/;
  return roleIds[0] === "role.security_analyst"
    ? /^Human analyst-only .*This API-only Function intentionally has no menuPath\.$/
    : /^Requestor birthright .*This API-only Function intentionally has no menuPath\.$/;
}

test("Phase 19 exports are API-only, granted to one Role, human Security Analyst-only or the birthright's, moved unchanged where reserved, and published as files", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "PHASE19_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "PHASE19_CATALOGUE_PARSE");
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "PHASE19_SPECIFICATION_PARSE");
  for (const route of phase19ExportRoutes) {
    const functions = catalogue.functions.filter((entry: JsonObject) => entry.id === route.functionId);
    assert.equal(functions.length, 1, `PHASE19_FUNCTION_MISSING_${route.functionId}`);
    // 19-10: function.risk_assessments.export_api holds exactly role.security_analyst and role.requestor.
    assert.deepEqual(functions[0].roleIds, route.roleIds, `PHASE19_ROLE_SCOPE_${route.functionId}`);
    assert.equal("menuPath" in functions[0], false, `PHASE19_MENU_PATH_${route.functionId}`);
    assert.match(functions[0].description, phase19FunctionDescription(route.roleIds), `PHASE19_FUNCTION_DESCRIPTION_${route.functionId}`);
    // A Function lists exactly the table's FunctionApis for it, in their id order (19-08 added the second and third).
    const tabled = phase19ExportRoutes.filter((entry) => entry.functionId === route.functionId).map((entry) => entry.functionApiId).sort();
    assert.deepEqual(functions[0].functionApiIds, tabled, `PHASE19_FUNCTION_APIS_${route.functionId}`);
    for (const role of catalogue.roles) {
      assert.equal(role.functionIds.includes(route.functionId), route.roleIds.includes(role.id), `PHASE19_ROLE_GRANT_${role.id}_${route.functionId}`);
    }
    assert.deepEqual(
      catalogue.functionApis.filter((entry: JsonObject) => entry.url === route.catalogueUrl).map((entry: JsonObject) => ({ id: entry.id, functionId: entry.functionId, name: entry.name, description: entry.description })),
      [{ id: route.functionApiId, functionId: route.functionId, name: route.name, description: route.description }],
      `PHASE19_FUNCTION_API_${route.catalogueUrl}`,
    );
    // A reserved entry moved with its name, URL and description unchanged, and its old menu Function no longer lists it.
    const reservedEntry = route.reserved;
    if (reservedEntry) {
      const reserved = catalogue.functions.find((entry: JsonObject) => entry.id === reservedEntry.functionId);
      assert.ok(reserved, `PHASE19_RESERVED_FUNCTION_MISSING_${reservedEntry.functionId}`);
      for (const id of [route.functionApiId, reservedEntry.functionApiId]) {
        assert.equal(reserved.functionApiIds.includes(id), false, `PHASE19_RESERVED_FUNCTION_STILL_LISTS_${id}`);
      }
      assert.equal(catalogue.functionApis.some((entry: JsonObject) => entry.id === reservedEntry.functionApiId), false, `PHASE19_RESERVED_ID_KEPT_${reservedEntry.functionApiId}`);
    }
    // The agent's role never holds an export; the human analyst's role holds an analyst export, the Requestor birthright its own.
    assert.equal(effectiveOperations(catalogue, "role.security_analyst").has(route.catalogueUrl), route.roleIds.includes("role.security_analyst"), `PHASE19_ANALYST_GRANT_${route.catalogueUrl}`);
    assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(route.catalogueUrl), `PHASE19_AGENT_GRANT_${route.catalogueUrl}`);
    assert.equal(effectiveOperations(catalogue, "role.requestor").has(route.catalogueUrl), route.roleIds.includes("role.requestor"), `PHASE19_REQUESTOR_GRANT_${route.catalogueUrl}`);
    // The specification publishes the export as a file under exactly the two media types the server sends.
    const documented = operation(specification, route.path, route.method);
    assert.equal(documented.operationId, route.operationId, `PHASE19_OPERATION_ID_${route.path}`);
    const content = documented.responses?.["200"]?.content ?? {};
    assert.deepEqual(Object.keys(content).sort(), ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv; charset=utf-8"], `PHASE19_MEDIA_TYPES_${route.path}`);
    for (const [mediaType, value] of Object.entries(content)) {
      assert.equal((value as JsonObject).schema?.contentMediaType, mediaType, `PHASE19_CONTENT_MEDIA_TYPE_${route.path}_${mediaType}`);
    }
    if (route.method === "get") {
      assert.equal(parameter(documented, "format")?.required, true, `PHASE19_FORMAT_REQUIRED_${route.path}`);
    } else {
      // The report export's controls are a closed JSON body: format required, and no columns (UI-D5).
      const body = documented.requestBody?.content?.["application/json"]?.schema;
      assert.equal(documented.requestBody?.required, true, `PHASE19_BODY_REQUIRED_${route.path}`);
      assert.equal(body?.additionalProperties, false, `PHASE19_BODY_OPEN_${route.path}`);
      assert.deepEqual(body?.required, ["format"], `PHASE19_FORMAT_REQUIRED_${route.path}`);
      assert.deepEqual(Object.keys(body?.properties ?? {}).sort(), ["format", "query", "table", "timeZone"], `PHASE19_BODY_KEYS_${route.path}`);
    }
    // A fixed-table export takes no columns (UI-D5); the report export's controls are its body.
    for (const absent of ["page", "pageSize", "pagination[page]", "pagination[pageSize]", ...(route.fixedTables ? ["columns"] : []), ...(route.method === "post" ? ["format"] : [])]) {
      assert.equal(parameter(documented, absent), undefined, `PHASE19_PAGED_EXPORT_${route.path}_${absent}`);
    }
    for (const status of ["400", "403", "422"]) {
      assert.ok(documented.responses?.[status], `PHASE19_RESPONSE_${status}_${route.path}`);
    }
  }
  // One design note, appended last, records the export Functions and the service-identity refusal set.
  const notes = catalogue.designNotes.filter((note: string) => note.startsWith("Phase 19 "));
  assert.equal(notes.length, 1, "PHASE19_DESIGN_NOTE_COUNT");
  assert.equal(catalogue.designNotes[catalogue.designNotes.length - 1], notes[0], "PHASE19_DESIGN_NOTE_NOT_LAST");
  for (const named of ["function.risk_register.export_api", "function.reports.export_api", "function.analyst_exports.list_export_api", "function.my_exports.list_export_api", "function.risk_assessments.export_api", "SERVICE_IDENTITY_REFUSED_OPERATIONS"]) {
    assert.ok(notes[0].includes(named), `PHASE19_DESIGN_NOTE_NAMES_${named}`);
  }
});

/*
 * 19-14 (D-13, D-31 to D-33): each collection's reference-list export, import template and error report is a FunctionApi
 * of the collection's own Administration Function, which only role.security_analyst holds, so the Security Analyst
 * Agent and the Requestor birthright never reach one. The export's catalogue URL carries `?format={format}`, as the
 * register export's does. Each is published as a file under exactly the two export media types.
 */
const administrationFileCollections = [
  { segment: "risk_types", slug: "risk-types", plural: "Risk Types", lower: "risk types" },
  { segment: "controls", slug: "controls", plural: "Controls", lower: "controls" },
  { segment: "information_systems", slug: "information-systems", plural: "Information Systems", lower: "information systems" },
  { segment: "information_assets", slug: "information-assets", plural: "Information Assets", lower: "information assets" },
] as const;

test("19-14 the reference-list exports, import templates and error reports map to their Administration Function, human Security Analyst only, and are published as files", () => {
  const authoritativePath = path.join(repositoryDir, "docs", "references", catalogueFilename);
  const bootstrapPath = path.join(appDir, "src", "bootstrap", catalogueFilename);
  assert.equal(Buffer.compare(readFileSync(authoritativePath), readFileSync(bootstrapPath)), 0, "ADMIN_FILES_CATALOGUE_BYTE_DRIFT");
  const catalogue = parseJsonFile(authoritativePath, "ADMIN_FILES_CATALOGUE_PARSE");
  const specification = parseJsonFile(path.join(repositoryDir, "docs", "references", "specification.json"), "ADMIN_FILES_SPECIFICATION_PARSE");
  const media = ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "text/csv; charset=utf-8"];
  for (const collection of administrationFileCollections) {
    const functionId = `function.administration.${collection.segment}`;
    const fn = catalogue.functions.find((entry: JsonObject) => entry.id === functionId);
    assert.ok(fn, `ADMIN_FILES_FUNCTION_MISSING_${functionId}`);
    assert.deepEqual(fn.roleIds, ["role.security_analyst"], `ADMIN_FILES_ROLE_SCOPE_${functionId}`);
    const operations = [
      {
        url: `GET:/api/v1/${collection.segment}/import/template`, method: "get", path: `/v1/${collection.segment}/import/template`,
        operationId: `administration/download-${collection.slug}-import-template`,
        name: `Download ${collection.plural} Import Template`, description: `Generates the ${collection.lower} import template in the requested supported format.`,
      },
      {
        url: `POST:/api/v1/${collection.segment}/import/error_report`, method: "post", path: `/v1/${collection.segment}/import/error_report`,
        operationId: `administration/download-${collection.slug}-import-error-report`,
        name: `Download ${collection.plural} Import Error Report`, description: `Rebuilds the rows of an uploaded ${collection.lower} file that were not imported, with their issues.`,
      },
      {
        url: `GET:/api/v1/${collection.segment}/export?format={format}`, method: "get", path: `/v1/${collection.segment}/export`,
        operationId: `administration/export-${collection.slug}`,
        name: `Export ${collection.plural}`, description: `Exports the ${collection.lower} list in the requested supported format, with its import columns.`,
      },
    ] as const;
    for (const expected of operations) {
      const entries = catalogue.functionApis.filter((entry: JsonObject) => entry.url === expected.url);
      assert.equal(entries.length, 1, `ADMIN_FILES_FUNCTION_API_COUNT_${expected.url}`);
      assert.deepEqual(
        { functionId: entries[0].functionId, name: entries[0].name, description: entries[0].description },
        { functionId, name: expected.name, description: expected.description },
        `ADMIN_FILES_FUNCTION_API_${expected.url}`,
      );
      assert.ok(fn.functionApiIds.includes(entries[0].id), `ADMIN_FILES_FUNCTION_LISTS_${entries[0].id}`);
      assert.ok(effectiveOperations(catalogue, "role.security_analyst").has(expected.url), `ADMIN_FILES_ANALYST_GRANT_${expected.url}`);
      assert.ok(!effectiveOperations(catalogue, "role.security_analyst_agent").has(expected.url), `ADMIN_FILES_AGENT_GRANT_${expected.url}`);
      assert.ok(!effectiveOperations(catalogue, "role.requestor").has(expected.url), `ADMIN_FILES_REQUESTOR_GRANT_${expected.url}`);

      const documented = operation(specification, expected.path, expected.method);
      assert.equal(documented.operationId, expected.operationId, `ADMIN_FILES_OPERATION_ID_${expected.path}`);
      const content = documented.responses?.["200"]?.content ?? {};
      assert.deepEqual(Object.keys(content).sort(), media, `ADMIN_FILES_MEDIA_TYPES_${expected.path}`);
      for (const [mediaType, value] of Object.entries(content)) {
        assert.equal((value as JsonObject).schema?.contentMediaType, mediaType, `ADMIN_FILES_CONTENT_MEDIA_TYPE_${expected.path}_${mediaType}`);
      }
      const rowCount = documented.responses?.["200"]?.headers?.["X-CSRM-Row-Count"];
      assert.equal(rowCount !== undefined, !expected.url.includes("/import/template"), `ADMIN_FILES_ROW_COUNT_${expected.path}`);
      for (const status of ["400", "403"]) assert.ok(documented.responses?.[status], `ADMIN_FILES_RESPONSE_${status}_${expected.path}`);
      if (expected.method === "get") {
        assert.equal(parameter(documented, "format")?.required, true, `ADMIN_FILES_FORMAT_REQUIRED_${expected.path}`);
        for (const absent of ["page", "pageSize"]) assert.equal(parameter(documented, absent), undefined, `ADMIN_FILES_PAGED_${expected.path}_${absent}`);
      } else {
        // The error report's body is closed: the file and exactly one record token, never client issues (D-32).
        const body = documented.requestBody?.content?.["multipart/form-data"]?.schema;
        assert.equal(body?.additionalProperties, false, `ADMIN_FILES_BODY_OPEN_${expected.path}`);
        assert.deepEqual(body?.required, ["file"], `ADMIN_FILES_BODY_REQUIRED_${expected.path}`);
        assert.deepEqual(Object.keys(body?.properties ?? {}).sort(), ["file", "previewDigest", "resultToken", "timeZone"], `ADMIN_FILES_BODY_KEYS_${expected.path}`);
        assert.ok(documented.responses?.["409"], `ADMIN_FILES_RESPONSE_409_${expected.path}`);
      }
      if (expected.url.includes("/export?")) assert.ok(documented.responses?.["422"], `ADMIN_FILES_RESPONSE_422_${expected.path}`);
    }
  }
});

test("IAM root SCIM contract is additive and preserves all existing operations and grants", () => {
  const specification = parseJsonFile(path.join(repositoryDir, "docs/references/specification.json"), "SCIM_SPEC");
  const catalogue = parseJsonFile(path.join(repositoryDir, "docs/references", catalogueFilename), "SCIM_CATALOGUE");
  const legacy = { ...specification, paths: Object.fromEntries(Object.entries(specification.paths).filter(([key]) => !key.startsWith("/scim/"))),
    components: { ...Object.fromEntries(Object.entries(specification.components).filter(([key]) => key !== "securitySchemes")),
      schemas: Object.fromEntries(Object.entries(specification.components.schemas).filter(([key]) => !key.startsWith("Scim"))),
      ...(Object.keys(specification.components.securitySchemes ?? {}).some(key => key !== "scimSourceBearer") ? { securitySchemes: Object.fromEntries(Object.entries(specification.components.securitySchemes).filter(([key]) => key !== "scimSourceBearer")) } : {}),
    } };
  const digest = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
  assert.equal(digest(legacy), "e8435422ad1e716db9f0fa138cf70fffa4f396f1a6c74be2c5a77318eeb3c604", "existing contract changed");
  const preserved = { ...catalogue, functionApis: catalogue.functionApis.map((entry: JsonObject) => {
    if (!entry.url.includes(":/scim/")) return entry;
    const { description: _description, ...rest } = entry; return rest;
  }) };
  assert.equal(digest(preserved), "e35454762ad74a9bdd16c46c094fe525f5ec1e600742f1ce6d99d4592c7b5a51", "existing capability or grant changed");
  assert.equal(Buffer.compare(readFileSync(path.join(repositoryDir, "docs/references", catalogueFilename)), readFileSync(path.join(appDir, "src/bootstrap", catalogueFilename))), 0);
  const ids = new Set<string>();
  for (const route of SCIM_ROUTES) {
    const wirePath = `/scim/v2${route.path.replace(":id", "{id}")}`;
    const value = operation(specification, wirePath, route.method.toLowerCase());
    assert.deepEqual(value.servers, [{ url: "/" }]);
    assert.deepEqual(value.security, [{ scimSourceBearer: [] }]);
    assert.ok(value.operationId.startsWith("scim/"));
    assert.equal(ids.has(value.operationId), false); ids.add(value.operationId);
    assert.ok(catalogue.functionApis.some((entry: JsonObject) => entry.url === `${route.method}:${wirePath}`));
    for (const status of ["400", "401", "403", "406", "413", "415", "429", "500"]) {
      assert.equal(value.responses[status].content["application/scim+json"].schema.$ref, "#/components/schemas/ScimError");
      assert.deepEqual(Object.keys(value.responses[status].content), ["application/scim+json", "application/json"]);
    }
    assert.ok(value.responses["401"].headers["WWW-Authenticate"]);
    assert.ok(value.responses["429"].headers["Retry-After"]);
    if (wirePath.includes("Groups") && route.method !== "GET") {
      assert.ok(value.responses["501"]); assert.equal(value.responses["200"], undefined);
    } else if (route.method === "DELETE") assert.equal(value.responses["204"].content, undefined);
    else if (wirePath === "/scim/v2/Groups/{id}") assert.equal(value.responses["200"], undefined);
    else {
      const response = value.responses[route.method === "POST" ? "201" : "200"];
      assert.ok(response.content["application/scim+json"]);
      assert.equal(response.content["application/json"].schema.$ref, response.content["application/scim+json"].schema.$ref);
      assert.equal(response.content["application/json"].schema.properties?.data, undefined);
    }
    if (route.method === "POST" && wirePath.endsWith("Users")) assert.ok(value.responses["201"].headers.Location);
    if (wirePath.includes("Users") && route.method !== "GET") {
      assert.ok(value.responses["503"].headers["Retry-After"]);
      if (route.method !== "DELETE") assert.deepEqual(Object.keys(value.requestBody.content), ["application/scim+json", "application/json"]);
    }
  }
  assert.equal(ids.size, 21);
  assert.deepEqual(specification.components.securitySchemes.scimSourceBearer, { type: "http", scheme: "bearer", description: "Identity Source bearer credential; independent of CSRM authentication." });
  const schemas = specification.components.schemas;
  assert.match(schemas.ScimReplaceUser.description, /omitted.*keep/i);
  assert.match(schemas.ScimReplaceUser.description, /active/);
  assert.equal(schemas.ScimPatchRequest.properties.Operations.maxItems, 100);
  assert.equal(schemas.ScimError.properties.status.type, "string");
  assert.equal(schemas.ScimUser.properties.externalId.readOnly, true);
  assert.equal(schemas.ScimUser.properties.emails.maxItems, 1);
  const list = operation(specification, "/scim/v2/Users", "get");
  assert.deepEqual(list.parameters.map((entry: JsonObject) => entry.name), ["filter", "startIndex", "count", "attributes", "excludedAttributes"]);
  assert.equal(parameter(list, "count")?.schema.default, 100);
  assert.match(parameter(list, "filter")?.description, /4096/);
  assert.equal(Object.keys(specification.paths).filter(key => key.startsWith("/api/scim/")).length, 0);
});
