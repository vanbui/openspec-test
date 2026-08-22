#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const coveragePath = fileURLToPath(new URL("../../../.planning/phases/07-requestor-request-workflow/COVERAGE.md", import.meta.url));
const specificationPath = fileURLToPath(new URL("../docs/references/specification.json", import.meta.url));
const servicePath = fileURLToPath(new URL("../src/lib/api/csrm-service.ts", import.meta.url));
const cataloguePath = fileURLToPath(new URL("../docs/references/idambox-csrm-role-function-api-catalogue.json", import.meta.url));

const integratedOperations = [
  ["GET", "/csrm-assessment-requests", "listOwnedRequests"],
  ["POST", "/csrm-assessment-requests", "createDraft"],
  ["GET", "/csrm-assessment-requests/{id}", "getAccessibleRequest"],
  ["PUT", "/csrm-assessment-requests/{id}", "saveDraft"],
  ["GET", "/csrm-assessment-requests/dashboard", "getRequestorDashboard"],
  ["POST", "/csrm-assessment-requests/{id}/submit", "submitRequest"],
  ["POST", "/csrm-assessment-requests/{id}/withdraw", "withdrawRequest"],
  ["GET", "/csrm-information-systems", "listInformationSystems"],
  ["GET", "/csrm-information-assets", "listInformationAssets"],
];
const requiredCoverageDecisions = [
  "| `GET /csrm-assessment-requests` | INTEGRATE | `listOwnedRequests` |",
  "| `POST /csrm-assessment-requests` | INTEGRATE | `createDraft` |",
  "| `GET /csrm-assessment-requests/{id}` | INTEGRATE | `getAccessibleRequest` |",
  "| `PUT /csrm-assessment-requests/{id}` | INTEGRATE | `saveDraft` |",
  "| `DELETE /csrm-assessment-requests/{id}` | PROHIBIT | none |",
  "| `GET /csrm-assessment-requests/dashboard` | ADD + INTEGRATE | `getRequestorDashboard` |",
  "| `POST /csrm-assessment-requests/{id}/submit` | ADD + INTEGRATE | `submitRequest` |",
  "| `POST /csrm-assessment-requests/{id}/withdraw` | ADD + INTEGRATE | `withdrawRequest` |",
  "| `GET /csrm-information-systems` | INTEGRATE | `listInformationSystems` |",
  "| `GET /csrm-information-assets` | INTEGRATE | `listInformationAssets` |",
  "| All other Information System/Asset operations | OPT-OUT | none |",
  "| IdamBox user CRUD operations | OPT-OUT | none |",
];
const affectedFunctionApiNames = [
  "List My Assessment Requests", "Get My Request Status Summary", "Get Assessment Request Form Metadata",
  "Search Information Systems", "Search Information Assets", "Search Users", "Create Assessment Request",
  "Update Draft Assessment Request", "Add Request Information System", "Add Request Information Asset",
  "Get Assessment Request", "Update Assessment Request", "List Request Information Systems",
  "List Request Information Assets", "Submit Assessment Request", "Generate Request Questionnaire",
];

function assert(condition, message) { if (!condition) throw new Error(message); }
function operationCount(specification) {
  return Object.values(specification.paths).reduce((count, pathItem) => count + Object.values(pathItem).filter((operation) => operation && typeof operation === "object" && "responses" in operation).length, 0);
}
function assertOperation(specification, method, path) {
  assert(specification.paths[path]?.[method.toLowerCase()]?.responses, `Missing generated OpenAPI operation ${method} ${path}.`);
}

export async function verifyRequestApiCoverage() {
  const [coverage, specificationSource, serviceSource, catalogueSource] = await Promise.all([readFile(coveragePath, "utf8"), readFile(specificationPath, "utf8"), readFile(servicePath, "utf8"), readFile(cataloguePath, "utf8")]);
  const specification = JSON.parse(specificationSource);
  const catalogue = JSON.parse(catalogueSource);
  assert(operationCount(specification) === 105, "Phase 7 must retain the approved 105-operation OpenAPI contract.");
  for (const decision of requiredCoverageDecisions) assert(coverage.includes(decision), `Coverage matrix is missing or changed: ${decision}`);
  assert(coverage.includes("Withdraw Assessment Request | ADD + INTEGRATE"), "Coverage matrix must explicitly reconcile the withdraw operation absent from the historical FunctionApi catalogue.");
  const exports = new Set([...serviceSource.matchAll(/export async function (\w+)\(/g)].map((match) => match[1]));
  for (const [method, path, adapter] of integratedOperations) { assertOperation(specification, method, path); assert(exports.has(adapter), `Integrated ${method} ${path} has no focused ${adapter} service adapter.`); }
  assert(!specification.paths["/csrm-assessment-requests/{id}"]?.delete, "Request DELETE must remain absent from OpenAPI.");
  assert(!exports.has("deleteRequest"), "Request DELETE must not have a service adapter.");
  const catalogueNames = new Set(catalogue.functionApis.map((item) => item.name));
  for (const name of affectedFunctionApiNames) assert(catalogueNames.has(name), `FunctionApi catalogue is missing affected operation: ${name}.`);
  console.log(`Request API coverage passed: ${operationCount(specification)} operations, ${integratedOperations.length} integrated adapters, 1 prohibited DELETE, and ${affectedFunctionApiNames.length} reconciled FunctionApi rows.`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) verifyRequestApiCoverage().catch((error) => { console.error(error.message); process.exitCode = 1; });
