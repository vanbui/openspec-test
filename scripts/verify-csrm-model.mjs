import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

const read = (...parts) => readFileSync(join(root, ...parts), "utf8");

const readSchema = (apiName) =>
  JSON.parse(
    read(
      "apps",
      "backend",
      "src",
      "api",
      apiName,
      "content-types",
      apiName,
      "schema.json",
    ),
  );

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const assertIncludes = (source, value, label) => {
  assert(source.includes(value), `${label} must include ${value}`);
};

const assertEnum = (schema, attributeName, values, label) => {
  const attribute = schema.attributes[attributeName];

  assert(attribute?.type === "enumeration", `${label} must be an enum`);

  for (const value of values) {
    assert(
      attribute.enum?.includes(value),
      `${label} must include enum value ${value}`,
    );
  }
};

const assertRelationTarget = (schema, attributeName, target, label) => {
  const attribute = schema.attributes[attributeName];

  assert(attribute?.type === "relation", `${label} must be a relation`);
  assert(attribute.target === target, `${label} must target ${target}`);
};

const csrmSchemas = {
  "csrm-assessment-request": readSchema("csrm-assessment-request"),
  "csrm-information-asset": readSchema("csrm-information-asset"),
  "csrm-information-system": readSchema("csrm-information-system"),
  "csrm-questionnaire": readSchema("csrm-questionnaire"),
  "csrm-question": readSchema("csrm-question"),
  "csrm-assessment": readSchema("csrm-assessment"),
  "csrm-risk": readSchema("csrm-risk"),
  "csrm-control": readSchema("csrm-control"),
  "csrm-control-implementation": readSchema("csrm-control-implementation"),
};

const expectedCollectionNames = {
  "csrm-assessment-request": "csrm_assessment_requests",
  "csrm-information-asset": "csrm_information_assets",
  "csrm-information-system": "csrm_information_systems",
  "csrm-questionnaire": "csrm_questionnaires",
  "csrm-question": "csrm_questions",
  "csrm-assessment": "csrm_assessments",
  "csrm-risk": "csrm_risks",
  "csrm-control": "csrm_controls",
  "csrm-control-implementation": "csrm_control_implementations",
};

for (const [name, schema] of Object.entries(csrmSchemas)) {
  assert(schema.kind === "collectionType", `${name} must be a collection type`);
  assert(
    schema.collectionName === expectedCollectionNames[name],
    `${name} must use collectionName ${expectedCollectionNames[name]}`,
  );
  assert(
    !Object.hasOwn(schema.attributes, "status"),
    `${name} must not define a status attribute`,
  );
}

const request = csrmSchemas["csrm-assessment-request"];
const asset = csrmSchemas["csrm-information-asset"];
const system = csrmSchemas["csrm-information-system"];
const questionnaire = csrmSchemas["csrm-questionnaire"];
const question = csrmSchemas["csrm-question"];
const assessment = csrmSchemas["csrm-assessment"];
const risk = csrmSchemas["csrm-risk"];
const control = csrmSchemas["csrm-control"];
const controlImplementation = csrmSchemas["csrm-control-implementation"];

for (const field of [
  "requestNumber",
  "title",
  "description",
  "division",
  "businessUnit",
  "businessPurpose",
  "thirdPartyInvolvement",
  "thirdPartyDetails",
  "regulatoryRequirements",
  "submittedDate",
  "dueDate",
]) {
  assert(request.attributes[field], `Request must define ${field}`);
}
assert(request.attributes.requestNumber.required === true, "Request number must be required");
assert(request.attributes.requestNumber.unique === true, "Request number must be unique");
assertEnum(request, "assessmentType", ["BAU", "Project", "Other"], "Assessment type");
assertEnum(
  request,
  "businessCriticality",
  ["Low", "Moderate", "High", "Critical"],
  "Business criticality",
);
assertRelationTarget(
  request,
  "requestor",
  "api::idambox-user.idambox-user",
  "Request requestor",
);
assertRelationTarget(
  request,
  "sponsor",
  "api::idambox-user.idambox-user",
  "Request sponsor",
);
assertEnum(
  request,
  "requestStatus",
  [
    "draft",
    "submitted",
    "questionnaire-in-progress",
    "risk-assessment-drafted",
    "under-review",
    "approved",
    "closed",
  ],
  "Request status",
);
assert(request.attributes.requestStatus.default === "draft", "Request status must default to draft");

for (const field of [
  "name",
  "description",
  "location",
  "type",
  "confidentialityRating",
  "integrityRating",
  "availabilityRating",
  "containsPersonalData",
  "containsLegalData",
  "containsCreditCardData",
  "comments",
]) {
  assert(asset.attributes[field], `Information asset must define ${field}`);
}
assert(asset.attributes.containsPersonalData.default === false, "Asset personal data flag must default false");
assert(asset.attributes.containsLegalData.default === false, "Asset legal data flag must default false");
assert(asset.attributes.containsCreditCardData.default === false, "Asset credit card data flag must default false");
assertEnum(
  asset,
  "dataClassification",
  ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"],
  "Asset data classification",
);

for (const field of [
  "name",
  "description",
  "systemType",
  "businessCriticality",
  "internetFacing",
  "externalAccessRequired",
  "hostingLocation",
]) {
  assert(system.attributes[field], `Information system must define ${field}`);
}
assertRelationTarget(
  system,
  "owner",
  "api::idambox-user.idambox-user",
  "System owner",
);
assertEnum(
  system,
  "environment",
  ["Production", "Non-production"],
  "System environment",
);
assertEnum(
  system,
  "deploymentModel",
  ["On-prem", "Cloud", "SaaS"],
  "System deployment model",
);
assertEnum(
  system,
  "lifecycleState",
  ["New", "Changed", "Existing", "Decommissioning"],
  "System lifecycle state",
);

assertRelationTarget(
  request,
  "informationAssets",
  "api::csrm-information-asset.csrm-information-asset",
  "Request information assets",
);
assertRelationTarget(
  request,
  "informationSystems",
  "api::csrm-information-system.csrm-information-system",
  "Request information systems",
);
assertRelationTarget(
  asset,
  "assessmentRequests",
  "api::csrm-assessment-request.csrm-assessment-request",
  "Asset assessment requests",
);
assertRelationTarget(
  system,
  "assessmentRequests",
  "api::csrm-assessment-request.csrm-assessment-request",
  "System assessment requests",
);

assertRelationTarget(
  request,
  "questionnaire",
  "api::csrm-questionnaire.csrm-questionnaire",
  "Request questionnaire",
);
assertRelationTarget(
  questionnaire,
  "assessmentRequest",
  "api::csrm-assessment-request.csrm-assessment-request",
  "Questionnaire assessment request",
);
assertRelationTarget(
  questionnaire,
  "questions",
  "api::csrm-question.csrm-question",
  "Questionnaire questions",
);
assertRelationTarget(
  question,
  "questionnaire",
  "api::csrm-questionnaire.csrm-questionnaire",
  "Question questionnaire",
);

for (const field of ["questionText", "helpText", "options", "order", "answer", "reviewComment"]) {
  assert(question.attributes[field], `Question must define ${field}`);
}
assert(question.attributes.options.type === "json", "Question options must be JSON");
assert(question.attributes.answer.type === "json", "Question answer must be JSON");
assertEnum(
  question,
  "answerType",
  ["Text", "Long text", "Boolean", "Single select", "Multi select", "Date", "File upload"],
  "Question answer type",
);

for (const field of [
  "assessmentNumber",
  "assessmentDate",
  "generatedDate",
  "nextReviewDate",
  "approvalDate",
  "summary",
  "overallRating",
  "overallControlEffectiveness",
  "recommendationsSummary",
  "overallRiskRationale",
]) {
  assert(assessment.attributes[field], `Assessment must define ${field}`);
}
assert(assessment.attributes.assessmentNumber.required === true, "Assessment number must be required");
assert(assessment.attributes.assessmentNumber.unique === true, "Assessment number must be unique");
assertEnum(
  assessment,
  "assessmentStatus",
  ["draft", "in-review", "approved", "closed"],
  "Assessment status",
);
assertEnum(
  assessment,
  "overallControlEffectiveness",
  ["Effective", "Partially Effective", "Ineffective", "Not Assessed"],
  "Overall control effectiveness",
);
for (const field of ["generatedBy", "reviewedBy", "approvedBy"]) {
  assertRelationTarget(
    assessment,
    field,
    "api::idambox-user.idambox-user",
    `Assessment ${field}`,
  );
}
assertRelationTarget(
  request,
  "assessment",
  "api::csrm-assessment.csrm-assessment",
  "Request assessment",
);
assertRelationTarget(
  assessment,
  "assessmentRequest",
  "api::csrm-assessment-request.csrm-assessment-request",
  "Assessment request",
);
assertRelationTarget(
  assessment,
  "risks",
  "api::csrm-risk.csrm-risk",
  "Assessment risks",
);
assertRelationTarget(
  risk,
  "assessment",
  "api::csrm-assessment.csrm-assessment",
  "Risk assessment",
);

for (const field of [
  "riskNumber",
  "issueStatement",
  "riskStatement",
  "riskCategory",
  "riskSubCategory",
  "riskCause",
  "potentialImpact",
  "inherentLikelihood",
  "highestInherentConsequence",
  "inherentRating",
  "inherentRatingRationale",
  "residualLikelihood",
  "highestResidualConsequence",
  "residualRating",
  "residualRatingRationale",
  "controlEffectiveness",
  "riskVelocity",
  "identifiedDate",
  "targetDate",
  "closureDate",
  "escalationDetails",
  "comments",
  "riskCommunicationDate",
  "treatmentPlan",
  "treatmentResolveDate",
]) {
  assert(risk.attributes[field], `Risk must define ${field}`);
}
assert(risk.attributes.riskNumber.required === true, "Risk number must be required");
assert(risk.attributes.riskNumber.unique === true, "Risk number must be unique");
assert(risk.attributes.riskStatement.required === true, "Risk statement must be required");
assertRelationTarget(
  risk,
  "riskOwner",
  "api::idambox-user.idambox-user",
  "Risk owner",
);
assertRelationTarget(
  risk,
  "treatmentOwner",
  "api::idambox-user.idambox-user",
  "Risk treatment owner",
);
assertRelationTarget(
  risk,
  "informationSystemImpacted",
  "api::csrm-information-system.csrm-information-system",
  "Risk impacted system",
);
assertRelationTarget(
  risk,
  "informationAssetImpacted",
  "api::csrm-information-asset.csrm-information-asset",
  "Risk impacted asset",
);
assertEnum(
  risk,
  "dataClassification",
  ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"],
  "Risk data classification",
);
assertEnum(risk, "treatmentAction", ["Accept", "Treat"], "Risk treatment action");
assertEnum(
  risk,
  "treatmentStatus",
  ["Not Started", "In Progress", "Overdue", "Complete"],
  "Risk treatment status",
);
assertEnum(
  risk,
  "controlEffectiveness",
  ["Effective", "Partially Effective", "Ineffective", "Not Assessed"],
  "Risk control effectiveness",
);
assertEnum(
  risk,
  "riskVelocity",
  ["Low", "Moderate", "High", "Very High"],
  "Risk velocity",
);
assertRelationTarget(
  risk,
  "controlImplementations",
  "api::csrm-control-implementation.csrm-control-implementation",
  "Risk control implementations",
);

for (const field of [
  "controlNumber",
  "name",
  "description",
  "controlReference",
]) {
  assert(control.attributes[field], `Control must define ${field}`);
}
for (const field of [
  "controlStatus",
  "controlOwner",
  "effectivenessRating",
  "evidence",
  "implementationDueDate",
  "implementedDate",
  "reviewDate",
]) {
  assert(
    !Object.hasOwn(control.attributes, field),
    `Control must not define implementation field ${field}`,
  );
  assert(
    controlImplementation.attributes[field],
    `Control implementation must define ${field}`,
  );
}
assert(control.attributes.controlNumber.required === true, "Control number must be required");
assert(control.attributes.controlNumber.unique === true, "Control number must be unique");
assertEnum(
  control,
  "controlType",
  ["Preventive", "Detective", "Corrective", "Compensating"],
  "Control type",
);
assertRelationTarget(
  control,
  "implementations",
  "api::csrm-control-implementation.csrm-control-implementation",
  "Control implementations",
);
assertRelationTarget(
  controlImplementation,
  "control",
  "api::csrm-control.csrm-control",
  "Control implementation control",
);
assert(
  controlImplementation.attributes.control.required === true,
  "Control implementation control must be required",
);
assertRelationTarget(
  controlImplementation,
  "risk",
  "api::csrm-risk.csrm-risk",
  "Control implementation risk",
);
assert(
  controlImplementation.attributes.risk.required === true,
  "Control implementation risk must be required",
);
assertEnum(
  controlImplementation,
  "controlStatus",
  ["Existing", "Planned", "Implemented", "Retired"],
  "Control implementation status",
);
assertEnum(
  controlImplementation,
  "effectivenessRating",
  ["Effective", "Partially Effective", "Ineffective", "Not Assessed"],
  "Control implementation effectiveness",
);
assertRelationTarget(
  controlImplementation,
  "controlOwner",
  "api::idambox-user.idambox-user",
  "Control implementation owner",
);

const routeNames = Object.keys(csrmSchemas);
for (const routeName of routeNames) {
  const routeSource = read(
    "apps",
    "backend",
    "src",
    "api",
    routeName,
    "routes",
    `${routeName}.ts`,
  );
  assertIncludes(routeSource, "global::csrm-app-enabled", `${routeName} route`);
  assert(!routeSource.includes("auth: false"), `${routeName} route must not disable auth`);
}

const configSource = read("apps", "backend", "src", "csrm", "config.ts");
const policySource = read("apps", "backend", "src", "policies", "csrm-app-enabled.ts");
const envExample = read("apps", "backend", ".env.example");
const backendReadme = read("apps", "backend", "README.md");
const rootReadme = read("README.md");
const rootPackage = JSON.parse(read("package.json"));

assertIncludes(
  configSource,
  "process.env.csrmAppIsEnabled",
  "CSRM feature flag config",
);
assertIncludes(policySource, "csrmAppIsEnabled", "CSRM feature flag policy");
assertIncludes(envExample, "csrmAppIsEnabled", "Backend env example");
assertIncludes(backendReadme, "csrmAppIsEnabled", "Backend README");
assertIncludes(rootReadme, "verify:csrm-model", "Root README");
assertIncludes(rootReadme, "Phase 6", "Root README");
assert(
  rootPackage.scripts?.["verify:csrm-model"] ===
    "node scripts/verify-csrm-model.mjs",
  "package.json must define verify:csrm-model",
);

console.log("IdamBox CSRM model verification passed");
