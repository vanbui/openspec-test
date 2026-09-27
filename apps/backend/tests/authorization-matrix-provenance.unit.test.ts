import assert from "node:assert/strict";
import test from "node:test";

import { citedTestBody, provenanceFailures, type ProbeProvenance } from "./helpers/matrix-provenance";

/*
 * SR-02: the matrix's provenance rule must fail for every way a citation can claim a success nobody
 * observed. The fixture file below stands in for a mounted test file.
 */
const fixtureSource = [
  'test("the analyst creates a record", async () => {',
  '  await request("/x", harness.identities.analyst, { method: "POST" });',
  "});",
  "",
  'test("the role-less agent is refused", async () => {',
  '  await request("/x", harness.identities.analystAgent, { method: "POST" });',
  "});",
  "",
  'test("the service agent creates a record", async () => {',
  '  await request("/x", harness.identities.serviceAnalystAgent, { method: "POST" });',
  "});",
].join("\n");
const files: Readonly<Record<string, string>> = { "fixture.integration.test.ts": fixtureSource };

function readCitedTest(citation: string): string | null {
  const [file, title] = citation.split(" › ");
  const source = file ? files[file] : undefined;
  return source !== undefined && title ? citedTestBody(source, title) : null;
}
const cite = (title: string) => `fixture.integration.test.ts › ${title}`;
const probe = (overrides: Partial<ProbeProvenance>): ProbeProvenance => ({
  label: "POST:/x",
  allowedActors: ["analyst", "serviceAgent"],
  exercisesAllowed: false,
  provenBy: {},
  seeAlso: [],
  ...overrides,
});

test("a cited test's body ends at the next top-level test", () => {
  const body = citedTestBody(fixtureSource, "the analyst creates a record");
  assert.ok(body?.includes("identities.analyst,"));
  assert.ok(!body?.includes("analystAgent"));
  assert.equal(citedTestBody(fixtureSource, "no such test"), null);
});

test("each allowed actor cited by a test that sends a request as that actor passes", () => {
  assert.deepEqual(provenanceFailures([probe({
    provenBy: { analyst: [cite("the analyst creates a record")], serviceAgent: [cite("the service agent creates a record")] },
  })], readCitedTest), []);
});

test("an allowed outcome with no citation for its actor fails", () => {
  assert.deepEqual(provenanceFailures([probe({
    provenBy: { analyst: [cite("the analyst creates a record")] },
  })], readCitedTest), ["MATRIX_ALLOWED_OUTCOME_UNPROVEN_POST:/x_serviceAgent"]);
});

test("a citation whose test sends no request as the cited actor fails, including a role-less namesake", () => {
  assert.deepEqual(provenanceFailures([probe({
    provenBy: { analyst: [cite("the role-less agent is refused")], serviceAgent: [cite("the analyst creates a record")] },
  })], readCitedTest), [
    "MATRIX_CITATION_DOES_NOT_EXERCISE_ACTOR_POST:/x_analyst: fixture.integration.test.ts › the role-less agent is refused",
    "MATRIX_CITATION_DOES_NOT_EXERCISE_ACTOR_POST:/x_serviceAgent: fixture.integration.test.ts › the analyst creates a record",
  ]);
});

test("a citation of a test that does not exist fails", () => {
  assert.deepEqual(provenanceFailures([probe({
    allowedActors: ["analyst"],
    provenBy: { analyst: [cite("a renamed test")] },
    seeAlso: ["missing.integration.test.ts › anything"],
  })], readCitedTest), [
    "MATRIX_CITATION_NOT_FOUND_POST:/x_analyst: fixture.integration.test.ts › a renamed test",
    "MATRIX_CITATION_NOT_FOUND_POST:/x: missing.integration.test.ts › anything",
  ]);
});

test("a citation for a refused actor, or on a probe that issues its allowed requests, fails", () => {
  assert.deepEqual(provenanceFailures([probe({
    allowedActors: ["analyst"],
    provenBy: { analyst: [cite("the analyst creates a record")], serviceAgent: [cite("the service agent creates a record")] },
  })], readCitedTest), ["MATRIX_PROVEN_BY_FOR_A_REFUSED_ACTOR_POST:/x_serviceAgent"]);
  assert.deepEqual(provenanceFailures([probe({
    allowedActors: ["analyst"],
    exercisesAllowed: true,
    provenBy: { analyst: [cite("the analyst creates a record")] },
  })], readCitedTest), ["MATRIX_PROVEN_BY_ON_AN_ISSUED_PROBE_POST:/x_analyst"]);
});

test("a credential-less caller's success cannot be proven by citation", () => {
  assert.deepEqual(provenanceFailures([probe({
    allowedActors: ["noIdentity"],
    provenBy: { noIdentity: [cite("the analyst creates a record")] },
  })], readCitedTest), ["MATRIX_CITATION_DOES_NOT_EXERCISE_ACTOR_POST:/x_noIdentity: fixture.integration.test.ts › the analyst creates a record"]);
});

test("a probe that issues its allowed requests needs no citation", () => {
  assert.deepEqual(provenanceFailures([probe({
    exercisesAllowed: true,
    seeAlso: [cite("the analyst creates a record")],
  })], readCitedTest), []);
});
