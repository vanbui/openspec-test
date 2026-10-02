import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

import { CONFLICT_REASONS } from "../src/csrm/conflict-reasons";

// Tests compile into `.tmp/tests-dist/tests`; five parents resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const specification = JSON.parse(readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8")) as {
  components?: { schemas?: Record<string, { properties?: Record<string, any> }> };
};

function publishedReasons(schemaName: string): string[] {
  const reason = specification.components?.schemas?.[schemaName]?.properties?.error?.properties?.details?.properties?.reason;
  assert.equal(reason?.type, "string", `CONFLICT_REASON_NOT_A_STRING_IN_${schemaName}`);
  assert.ok(Array.isArray(reason?.enum), `CONFLICT_REASON_NOT_A_CLOSED_LIST_IN_${schemaName}`);
  return [...reason.enum as string[]].sort();
}

/*
 * D-22: the reason a 409 names is one closed list. Strapi raises it, both conflict response schemas
 * publish it, and the web keeps only what it accepts; a code added in one place and not the others
 * would be dropped by the client or rejected by the contract.
 */
test("the conflict reason list Strapi raises is the list both conflict response schemas publish", () => {
  const raised = [...CONFLICT_REASONS].sort();
  assert.equal(new Set(raised).size, raised.length, "CONFLICT_REASON_LISTED_TWICE");
  assert.ok(Object.isFrozen(CONFLICT_REASONS), "CONFLICT_REASONS_NOT_FROZEN");
  for (const schemaName of ["AssessmentWorkflowErrorResponse", "QuestionnaireWorkflowErrorResponse"]) {
    assert.deepEqual(publishedReasons(schemaName), raised, `CONFLICT_REASONS_DIVERGE_FROM_${schemaName}`);
  }
});
