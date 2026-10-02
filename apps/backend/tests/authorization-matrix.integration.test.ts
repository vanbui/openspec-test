import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { CSRM_ANALYST_INSIGHT_OPERATIONS } from "../src/api/csrm-analyst-insight/operations";
import {
  FIXTURE_TITLE_PATTERN,
  HUMAN_ANALYST_ONLY_OPERATIONS,
  LEAK_PATTERN,
  MATRIX_ACTORS,
  MISSING_TOKEN_STATUS_BY_FAMILY,
  matrixRows,
  tokenFamilyOf,
  type MatrixActor,
  type MatrixFixtures,
  type MatrixProbe,
  type MatrixRow,
} from "./fixtures/authorization-matrix";
import { citedTestBody, provenanceFailures, type ProbeProvenance } from "./helpers/matrix-provenance";
import { startAuthorizationHttpHarness, type AuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 8 D-16, D-17 and the server half of D-18: every served operation of the
 * mounted Strapi is stated and proven for six callers, keyed to the checked-in
 * inventory docs/references/served-operations.json, so a route without a stated
 * outcome fails the suite. Denials are proven to leave persistence unchanged and
 * to disclose no record, and the "My" rows prove owner scoping for every actor.
 *
 * AUTHORIZATION_MATRIX_OBSERVE=1 records each observed status instead of
 * asserting it and prints the observations when the harness closes (D-51: the
 * missing-token status per family was recorded from such a run). It runs only
 * through `pnpm --filter @csrm/strapi authorization-matrix:observe`: the
 * everyday test script refuses it, CI refuses it here, and an observing run
 * still fails when any status differs from its row (SR-07).
 */

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend, two more the repository root.
const strapiDir = path.resolve(__dirname, "..", "..", "..");
const repositoryDir = path.resolve(strapiDir, "..", "..");
const testsDir = path.join(strapiDir, "tests");

type InventoryServedRow = {
  method: string;
  path: string;
  catalogueUrl: string;
  authStrategies: string[] | null;
  policyOperation: string | null;
};
type InventoryPluginRow = { method: string; path: string; plugin: string };
type Inventory = { served: InventoryServedRow[]; pluginRoutes: InventoryPluginRow[] };

const inventory = JSON.parse(
  readFileSync(path.join(repositoryDir, "docs", "references", "served-operations.json"), "utf8"),
) as Inventory;
const servedByOperation = new Map(inventory.served.map((row) => [row.catalogueUrl, row]));
const pluginOperations = new Set(inventory.pluginRoutes.map((row) => `${row.method}:${row.path}`));

const OBSERVE = process.env.AUTHORIZATION_MATRIX_OBSERVE === "1";
if (OBSERVE && process.env.CI) {
  throw new Error("MAINTENANCE_SWITCH_UNDER_CI: AUTHORIZATION_MATRIX_OBSERVE turns the matrix into a recorder and never runs in CI");
}
type Observation = { operation: string; actor: MatrixActor; expected: number; observed: number };
const observations: Observation[] = [];

const harnessPromise = startAuthorizationHttpHarness();
after(async () => {
  const mismatches = observations.filter((observation) => observation.expected !== observation.observed);
  if (OBSERVE) console.log(`MATRIX_OBSERVATIONS ${JSON.stringify({ requests: observations.length, mismatches })}`);
  await (await harnessPromise).close();
  // Observing records every status, but a status that differs from its row still fails the run.
  assert.deepEqual(mismatches, [], `MATRIX_OBSERVED_MISMATCHES: ${mismatches.length} observed statuses differ from their rows`);
});

let fixturesPromise: Promise<MatrixFixtures> | null = null;
/** Every fixture bundle the rows reference, seeded once and sequentially so SQLite sees one writer. */
function fixtures(): Promise<MatrixFixtures> {
  fixturesPromise ??= (async () => {
    const harness = await harnessPromise;
    const workflow = await harness.seedRequestWorkflowFixtures();
    const questionnaires = await harness.seedQuestionnaireWorkflowFixtures();
    const governance = await harness.seedQuestionnaireGovernanceFixtures();
    const assessments = await harness.seedAssessmentWorkflowFixtures();
    const administration = await harness.seedAdministrationFixtures();
    return { harness, users: harness.users, requests: harness.requests, workflow, questionnaires, governance, assessments, administration };
  })();
  return fixturesPromise;
}

function isSuccess(status: number): boolean {
  return status >= 200 && status < 300;
}

function probesOf(row: MatrixRow): Array<[label: string, probe: MatrixProbe]> {
  return [["", row], ...(row.variants ?? []).map((variant): [string, MatrixProbe] => [` (${variant.label})`, variant])];
}

function expectedStatus(row: MatrixRow, probe: MatrixProbe, actor: MatrixActor): number {
  if (actor !== "noToken") return probe.expect[actor];
  if (probe.expect.noToken !== undefined) return probe.expect.noToken;
  const served = servedByOperation.get(row.operation);
  assert.ok(served && !row.plugin, `MATRIX_NO_TOKEN_UNRECORDED_${row.operation}`);
  return MISSING_TOKEN_STATUS_BY_FAMILY[tokenFamilyOf(served.authStrategies)];
}

function callerOf(harness: AuthorizationHttpHarness, actor: MatrixActor): { identity?: string; omitApiToken?: boolean } {
  switch (actor) {
    case "owner": return { identity: harness.identities.owner };
    case "other": return { identity: harness.identities.otherRequestor };
    case "analyst": return { identity: harness.identities.analyst };
    case "serviceAgent": return { identity: harness.identities.serviceAnalystAgent };
    case "noIdentity": return {};
    case "noToken": return { identity: harness.identities.analyst, omitApiToken: true };
  }
}

test("every served operation has exactly one matrix row and every row names a served operation or a mounted plugin route", () => {
  const failures: string[] = [];
  const servedRows = matrixRows.filter((row) => !row.plugin);
  const pluginRows = matrixRows.filter((row) => row.plugin);
  for (const operation of servedByOperation.keys()) {
    const count = servedRows.filter((row) => row.operation === operation).length;
    if (count === 0) failures.push(`MATRIX_ROW_MISSING_${operation}`);
    if (count > 1) failures.push(`MATRIX_ROW_DUPLICATE_${operation}`);
  }
  for (const row of servedRows) {
    if (!servedByOperation.has(row.operation)) failures.push(`MATRIX_ROW_UNSERVED_${row.operation}`);
  }
  for (const operation of pluginOperations) {
    const count = pluginRows.filter((row) => row.operation === operation).length;
    if (count === 0) failures.push(`MATRIX_PLUGIN_ROW_MISSING_${operation}`);
    if (count > 1) failures.push(`MATRIX_PLUGIN_ROW_DUPLICATE_${operation}`);
  }
  for (const row of pluginRows) {
    if (!pluginOperations.has(row.operation)) failures.push(`MATRIX_PLUGIN_ROW_UNMOUNTED_${row.operation}`);
  }
  assert.deepEqual(failures, [], `MATRIX_INCOMPLETE\n${failures.join("\n")}`);
  assert.equal(servedRows.length, inventory.served.length, "MATRIX_SERVED_ROW_COUNT");
  assert.equal(pluginRows.length, inventory.pluginRoutes.length, "MATRIX_PLUGIN_ROW_COUNT");
});

/** The body of the test a `<file> › <test title>` citation names, or null when the file or the test is missing. */
function readCitedTest(citation: string): string | null {
  const [file, title] = citation.split(" › ");
  if (!file || !title) return null;
  const filePath = path.join(testsDir, file);
  return existsSync(filePath) ? citedTestBody(readFileSync(filePath, "utf8"), title) : null;
}

test("every success the matrix does not issue cites, for its actor, a mounted test that sends a request as that actor", () => {
  const probes: ProbeProvenance[] = matrixRows.flatMap((row) => probesOf(row).map(([label, probe]) => ({
    label: `${row.operation}${label}`,
    allowedActors: MATRIX_ACTORS.filter((actor) => isSuccess(expectedStatus(row, probe, actor))),
    exercisesAllowed: Boolean(probe.exercisesAllowed),
    provenBy: probe.provenBy ?? {},
    seeAlso: probe.seeAlso ?? [],
  })));
  const failures = provenanceFailures(probes, readCitedTest);
  assert.deepEqual(failures, [], failures.join("\n"));
});

test("every human-analyst-only operation is served and its row denies the owner, the other Requestor and the service agent", () => {
  const policySource = readFileSync(path.join(strapiDir, "src", "policies", "csrm-authorization.ts"), "utf8");
  assert.ok(policySource.includes("...ANALYST_INSIGHT_OPERATIONS,"), "HUMAN_ANALYST_GUARD_INSIGHTS_NOT_SPREAD");
  const insightOperations = new Set<string>(Object.values(CSRM_ANALYST_INSIGHT_OPERATIONS));
  assert.equal(HUMAN_ANALYST_ONLY_OPERATIONS.length, 7 + insightOperations.size, "HUMAN_ANALYST_ONLY_COUNT");
  for (const operation of HUMAN_ANALYST_ONLY_OPERATIONS) {
    if (!insightOperations.has(operation)) {
      assert.ok(policySource.includes(`"${operation}"`), `HUMAN_ANALYST_GUARD_LITERAL_MISSING_${operation}`);
    }
    assert.ok(servedByOperation.has(operation), `HUMAN_ANALYST_ONLY_OPERATION_UNSERVED_${operation}`);
    const row = matrixRows.find((candidate) => candidate.operation === operation);
    assert.ok(row, `HUMAN_ANALYST_ONLY_ROW_MISSING_${operation}`);
    assert.equal(row.expect.serviceAgent, 403, `HUMAN_ANALYST_ONLY_AGENT_NOT_DENIED_${operation}`);
    assert.equal(row.expect.owner, 403, `HUMAN_ANALYST_ONLY_OWNER_NOT_DENIED_${operation}`);
    assert.equal(row.expect.other, 403, `HUMAN_ANALYST_ONLY_OTHER_NOT_DENIED_${operation}`);
  }
});

async function probe(f: MatrixFixtures, row: MatrixRow, label: string, candidate: MatrixProbe): Promise<void> {
  for (const actor of MATRIX_ACTORS) {
    const expected = expectedStatus(row, candidate, actor);
    // A denial is always safe to issue; a success is issued only when the row may make it.
    if (isSuccess(expected) && !candidate.exercisesAllowed) continue;
    const { path: requestPath, init } = candidate.request(f, actor);
    const method = (init?.method ?? "GET").toUpperCase();
    const tag = `${row.operation}${label}_${actor}`;
    const guarded = method !== "GET" && !isSuccess(expected) && row.persistence !== undefined;
    const before = guarded && row.persistence ? await row.persistence(f) : null;

    const response = await f.harness.request({
      path: requestPath,
      ...callerOf(f.harness, actor),
      init: { redirect: "manual", ...init },
    });
    const text = await response.text();
    if (OBSERVE) {
      observations.push({ operation: `${row.operation}${label}`, actor, expected, observed: response.status });
    } else {
      assert.equal(response.status, expected, `MATRIX_STATUS_${tag}: ${text.slice(0, 300)}`);
    }
    if (!isSuccess(response.status)) {
      assert.doesNotMatch(text, LEAK_PATTERN, `MATRIX_DENIAL_LEAKED_INTERNALS_${tag}`);
      assert.doesNotMatch(text, FIXTURE_TITLE_PATTERN, `MATRIX_DENIAL_LEAKED_FIXTURE_${tag}`);
    }
    for (const secret of row.mustNotDisclose?.(f, actor) ?? []) {
      assert.ok(!text.includes(secret), `MATRIX_DISCLOSED_${tag}: ${secret}`);
    }
    if (row.ownedRecordTotal && isSuccess(response.status)) {
      // D-17 for a count-only summary: an owner-scoped total is zero for an actor who owns nothing.
      const total = (JSON.parse(text) as { data?: { total?: unknown } }).data?.total;
      if (row.ownedRecordTotal(actor) === "none") {
        assert.equal(total, 0, `MATRIX_SUMMARY_NOT_OWNER_SCOPED_${tag}: ${text.slice(0, 300)}`);
      } else {
        assert.ok(typeof total === "number" && total > 0, `MATRIX_SUMMARY_OWN_RECORDS_MISSING_${tag}: ${text.slice(0, 300)}`);
      }
    }
    if (before && row.persistence && !isSuccess(response.status)) {
      assert.deepEqual(await row.persistence(f), before, `MATRIX_DENIAL_MUTATED_${tag}`);
    }
  }
}

for (const row of matrixRows) {
  test(`${row.operation} answers each actor as stated${row.plugin ? " (plugin route, observed)" : ""}`, async () => {
    const f = await fixtures();
    for (const [label, candidate] of probesOf(row)) await probe(f, row, label, candidate);
  });
}
