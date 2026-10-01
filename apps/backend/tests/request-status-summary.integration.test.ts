import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend,
// two more resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const specification = JSON.parse(
  readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8"),
) as Record<string, any>;

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

const SUMMARY_PATH = "/api/v1/my_requests/status_summary";
/** The seven request statuses as camelCase keys, plus the total, sorted. */
const SUMMARY_KEYS = [
  "approved", "closed", "draft", "questionnaireInProgress", "riskAssessmentDrafted", "submitted", "total", "underReview",
];
const EMPTY_SUMMARY = Object.freeze({
  draft: 0,
  submitted: 0,
  questionnaireInProgress: 0,
  riskAssessmentDrafted: 0,
  underReview: 0,
  approved: 0,
  closed: 0,
  total: 0,
});

/** The published property names of a closed spec component, sorted: exactly what the server may serve. */
function specKeys(componentName: string): string[] {
  const component = specification.components?.schemas?.[componentName];
  assert.ok(component, `SUMMARY_SPEC_COMPONENT_MISSING_${componentName}`);
  assert.equal(component.additionalProperties, false, `SUMMARY_SPEC_COMPONENT_OPEN_${componentName}`);
  return Object.keys(component.properties ?? {}).sort();
}

async function readSummary(identity: string | undefined, query = ""): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: `${SUMMARY_PATH}${query}`, identity });
}

/** Reads the caller's summary and pins every served level against the published contract. */
async function summaryFor(identity: string): Promise<Record<string, unknown>> {
  const response = await readSummary(identity);
  assert.equal(response.status, 200, `SUMMARY_READ_FAILED_${identity}: ${await response.clone().text()}`);
  const body = await response.json() as Record<string, unknown>;
  assert.deepEqual(Object.keys(body).sort(), specKeys("MyRequestStatusSummaryResponse"), `SUMMARY_ENVELOPE_KEYS_${identity}`);
  const data = body.data as Record<string, unknown>;
  assert.ok(data && typeof data === "object" && !Array.isArray(data), `SUMMARY_DATA_NOT_OBJECT_${identity}`);
  assert.deepEqual(Object.keys(data).sort(), specKeys("MyRequestStatusSummary"), `SUMMARY_DATA_KEYS_${identity}`);
  assert.deepEqual(Object.keys(data).sort(), SUMMARY_KEYS, `SUMMARY_DATA_KEYS_LITERAL_${identity}`);
  for (const [key, value] of Object.entries(data)) {
    assert.ok(Number.isInteger(value) && (value as number) >= 0, `SUMMARY_COUNT_NOT_A_WHOLE_NUMBER_${identity}_${key}`);
  }
  return data;
}

let summaryFixtures: Promise<void> | null = null;

/*
 * Besides the harness's own AUTH-OWNER-001 and AUTH-OTHER-001 drafts, the owner
 * holds two submitted requests, one under review and one approved, and the
 * second Requestor holds one closed request.
 */
function seedSummaryFixtures(): Promise<void> {
  summaryFixtures ??= (async () => {
    const harness = await harnessPromise;
    const fixtures = [
      { requestNumber: "SUMMARY-OWNER-SUBMITTED-001", title: "Owner submitted summary request one", requestStatus: "submitted", requestor: "owner" },
      { requestNumber: "SUMMARY-OWNER-SUBMITTED-002", title: "Owner submitted summary request two", requestStatus: "submitted", requestor: "owner" },
      { requestNumber: "SUMMARY-OWNER-REVIEW-001", title: "Owner summary request under review", requestStatus: "under-review", requestor: "owner" },
      { requestNumber: "SUMMARY-OWNER-APPROVED-001", title: "Owner approved summary request", requestStatus: "approved", requestor: "owner" },
      { requestNumber: "SUMMARY-OTHER-CLOSED-001", title: "Second Requestor closed summary request", requestStatus: "closed", requestor: "otherRequestor" },
    ] as const;
    for (const fixture of fixtures) await harness.createAssessmentRequestFixture({ ...fixture });
  })();
  return summaryFixtures;
}

test("mounted request status summary counts only the caller's own requests, for every actor", async () => {
  const harness = await harnessPromise;
  await seedSummaryFixtures();

  assert.deepEqual(await summaryFor(harness.identities.owner), {
    draft: 1,
    submitted: 2,
    questionnaireInProgress: 0,
    riskAssessmentDrafted: 0,
    underReview: 1,
    approved: 1,
    closed: 0,
    total: 5,
  }, "OWNER_SUMMARY_NOT_OWNER_SCOPED");
  assert.deepEqual(
    await summaryFor(harness.identities.otherRequestor),
    { ...EMPTY_SUMMARY, draft: 1, closed: 1, total: 2 },
    "SECOND_REQUESTOR_SUMMARY_NOT_OWNER_SCOPED",
  );

  // The analyst, the service agent and the analyst-named identity without an
  // analyst role own none of these requests. Their scope is their own, never all.
  for (const identity of [harness.identities.analyst, harness.identities.serviceAnalystAgent, harness.identities.analystAgent]) {
    assert.deepEqual(await summaryFor(identity), EMPTY_SUMMARY, `SUMMARY_WIDENED_FOR_${identity}`);
  }
});

test("mounted request status summary counts an analyst's own requests and nobody else's", async () => {
  const harness = await harnessPromise;
  await seedSummaryFixtures();
  await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: "SUMMARY-ANALYST-REVIEW-001",
    title: "Analyst-owned summary request under review",
    requestStatus: "under-review",
    requestor: harness.users.analyst,
  });

  assert.deepEqual(
    await summaryFor(harness.identities.analyst),
    { ...EMPTY_SUMMARY, underReview: 1, total: 1 },
    "ANALYST_SUMMARY_NOT_OWNER_SCOPED",
  );
  assert.deepEqual((await summaryFor(harness.identities.owner)).total, 5, "ANALYST_REQUEST_COUNTED_FOR_OWNER");
  assert.deepEqual((await summaryFor(harness.identities.otherRequestor)).total, 2, "ANALYST_REQUEST_COUNTED_FOR_SECOND_REQUESTOR");
  assert.deepEqual(await summaryFor(harness.identities.serviceAnalystAgent), EMPTY_SUMMARY, "ANALYST_REQUEST_COUNTED_FOR_AGENT");
});

test("mounted request status summary refuses an inactive identity, a missing identity and a missing token", async () => {
  const harness = await harnessPromise;
  await seedSummaryFixtures();

  for (const identity of [harness.identities.inactiveAnalyst, undefined]) {
    const denied = await readSummary(identity);
    assert.equal(denied.status, 403, `SUMMARY_DENIAL_FAILED_${identity ?? "missing"}`);
    const text = await denied.text();
    assert.doesNotMatch(text, /SQL|stack|database/i, `SUMMARY_DENIAL_LEAKED_INTERNALS_${identity ?? "missing"}`);
    assert.doesNotMatch(text, /"total"|questionnaireInProgress|underReview/, `SUMMARY_DENIAL_LEAKED_COUNTS_${identity ?? "missing"}`);
  }

  const missingToken = await harness.request({ path: SUMMARY_PATH, identity: harness.identities.owner, omitApiToken: true });
  assert.equal(missingToken.status, 401, "SUMMARY_TOKEN_GATE_MISSING");
});

test("mounted request status summary rejects every query key with one safe 400", async () => {
  const harness = await harnessPromise;
  await seedSummaryFixtures();

  for (const query of [
    "?x=1",
    "?filters[requestStatus]=draft",
    "?filters[requestor][documentId][$eq]=someone-else",
    "?requestor=someone-else",
    "?populate=*",
    "?status=draft",
  ]) {
    for (const identity of [harness.identities.owner, harness.identities.otherRequestor]) {
      const rejected = await readSummary(identity, query);
      assert.equal(rejected.status, 400, `SUMMARY_QUERY_ACCEPTED_${identity}_${query}`);
      const body = await rejected.json() as { error?: Record<string, unknown> };
      assert.equal(body.error?.message, "CSRM assessment request query is invalid.", `SUMMARY_QUERY_MESSAGE_${identity}_${query}`);
      const text = JSON.stringify(body);
      assert.doesNotMatch(text, /SQL|stack|database/i, `SUMMARY_QUERY_LEAKED_INTERNALS_${identity}_${query}`);
      assert.doesNotMatch(text, /"total"|questionnaireInProgress|underReview/, `SUMMARY_QUERY_LEAKED_COUNTS_${identity}_${query}`);
    }
  }
});
