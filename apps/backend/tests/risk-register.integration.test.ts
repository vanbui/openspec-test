import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { TREATMENT_DUE_STATES } from "../src/csrm/insights/treatment-due-state";
import { addUtcDays, utcToday } from "../src/csrm/insights/utc-date";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());
let fixtureSequence = 0;

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/strapi,
// two more resolve the repository root.
const repositoryDir = path.resolve(__dirname, "..", "..", "..", "..", "..");
const specification = JSON.parse(
  readFileSync(path.join(repositoryDir, "docs", "references", "specification.json"), "utf8"),
) as Record<string, any>;

/** The published property names of a closed spec component, sorted: exactly what the server may serve. */
function specKeys(componentName: string): string[] {
  const component = specification.components?.schemas?.[componentName];
  assert.ok(component, `REGISTER_SPEC_COMPONENT_MISSING_${componentName}`);
  assert.equal(component.additionalProperties, false, `REGISTER_SPEC_COMPONENT_OPEN_${componentName}`);
  return Object.keys(component.properties ?? {}).sort();
}

/*
 * Pins every served level of a Risk Register page against the published
 * components, so a closed client parser can never reject what Strapi serves:
 * the envelope, each row, its assessment and treatment-owner branches, the
 * meta, the pagination and each selected label.
 */
function assertServedRegisterShape(body: Record<string, unknown>, diagnostic: string): void {
  assert.deepEqual(Object.keys(body).sort(), specKeys("RiskRegisterResponse"), `${diagnostic}_ENVELOPE_KEYS`);
  const dueStates: readonly string[] = specification.components.schemas.TreatmentDueState?.enum ?? [];
  for (const row of rows(body)) {
    assert.deepEqual(Object.keys(row).sort(), specKeys("RiskRegisterItem"), `${diagnostic}_ITEM_KEYS`);
    assert.deepEqual(Object.keys(row.assessment as Record<string, unknown>).sort(), specKeys("RiskRegisterAssessment"), `${diagnostic}_ASSESSMENT_KEYS`);
    if (row.treatmentOwner !== null) {
      assert.deepEqual(Object.keys(row.treatmentOwner as Record<string, unknown>).sort(), specKeys("RiskRegisterUser"), `${diagnostic}_TREATMENT_OWNER_KEYS`);
    }
    assert.ok(dueStates.includes(String(row.treatmentDueState)), `${diagnostic}_DUE_STATE_NOT_PUBLISHED_${String(row.treatmentDueState)}`);
  }
  const meta = body.meta as Record<string, Record<string, unknown>>;
  assert.deepEqual(Object.keys(meta).sort(), specKeys("RiskRegisterMeta"), `${diagnostic}_META_KEYS`);
  assert.deepEqual(Object.keys(meta.pagination).sort(), specKeys("RiskRegisterPagination"), `${diagnostic}_PAGINATION_KEYS`);
  const labelKeys = specKeys("RiskRegisterSelectedLabels");
  for (const [key, label] of Object.entries(meta.selectedLabels)) {
    assert.ok(labelKeys.includes(key), `${diagnostic}_SELECTED_LABEL_NOT_PUBLISHED_${key}`);
    assert.deepEqual(Object.keys(label as Record<string, unknown>).sort(), specKeys("RiskRegisterSelectedLabel"), `${diagnostic}_SELECTED_LABEL_KEYS_${key}`);
  }
}

async function request(path: string, identity?: string, init: RequestInit = {}) {
  const harness = await harnessPromise;
  return harness.request({ path, identity, init });
}

async function payload(response: Response): Promise<{ data?: unknown; meta?: unknown; error?: unknown }> {
  return response.json() as Promise<{ data?: unknown; meta?: unknown; error?: unknown }>;
}

function rows(body: { data?: unknown }): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(body.data), "UNEXPECTED_RISK_REGISTER_DATA");
  return body.data as Array<Record<string, unknown>>;
}

test("mounted Risk Register requires the exact analyst grant before query validation or record work", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const riskBefore = await harness.getRisk(fixtures.aggregate.risk);
  const countBefore = await harness.countRisksForAssessment(fixtures.releaseFacts.complete);

  for (const identity of [
    harness.identities.owner,
    harness.identities.otherRequestor,
    harness.identities.analystAgent,
    harness.identities.serviceAnalystAgent,
    harness.identities.inactiveAnalyst,
    undefined,
  ]) {
    const denied = await request("/api/v1/risks?populate=*&targetDateFrom=2020-01-01", identity);
    assert.equal(denied.status, 403, `RISK_REGISTER_DENIAL_FAILED_${identity ?? "missing"}`);
    const text = await denied.text();
    assert.doesNotMatch(text, /SQL|stack|database|riskNumber|RSK-2026|count|total|email|username/i);
    assert.deepEqual(await harness.getRisk(fixtures.aggregate.risk), riskBefore, "DENIED_REGISTER_MUTATED_RISK");
    assert.equal(await harness.countRisksForAssessment(fixtures.releaseFacts.complete), countBefore, "DENIED_REGISTER_CHANGED_PERSISTENCE");
  }

  const missingToken = await (await harnessPromise).request({ path: "/api/v1/risks", identity: harness.identities.analyst, omitApiToken: true });
  assert.equal(missingToken.status, 401, "RISK_REGISTER_TOKEN_GATE_MISSING");
});

test("mounted Risk Register rejects every non-contract query with one safe 400 envelope", async () => {
  const harness = await harnessPromise;
  await harness.seedAssessmentWorkflowFixtures();
  const invalid = [
    "targetDateFrom=",
    "targetDateFrom=2026-1-01",
    "targetDateFrom=2026-01-01T00%3A00%3A00Z",
    "targetDateFrom=2026-02-29",
    "targetDateTo=2026-13-01",
    "targetDateFrom=2026-01-01&targetDateFrom=2026-01-02",
    "targetDateTo%5B%5D=2026-12-31",
    "targetDateFrom=2026-12-31&targetDateTo=2026-01-01",
    "q=one&q=two",
    "q[]=one",
    "populate=*",
    "filters[riskNumber][$ne]=missing",
    "sort=createdAt:desc",
    "sort=riskNumber:sideways",
    "page=0",
    "page=1000001",
    "pageSize=11",
    "riskOwner=with%20spaces",
    `q=${encodeURIComponent("x".repeat(201))}`,
    "unknown=value",
    "state=Open",
    "state=",
    "state=all",
    "state=open&state=closed",
    "state[]=open",
    "state[$eq]=open",
  ];

  for (const query of invalid) {
    const rejected = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(rejected.status, 400, `RISK_REGISTER_QUERY_ACCEPTED_${query}`);
    const text = await rejected.text();
    assert.doesNotMatch(text, /SQL|stack|database|riskNumber|RSK-2026|count|total|email|username/i);
  }
});

test("mounted Risk Register searches, ANDs filters, avoids mitigation duplicates, and projects closed rows", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const requestFixtures = await harness.seedRequestWorkflowFixtures();

  const created = await createRisk(fixtures.releaseFacts.unreleased, {
    riskStatement: "Unique mounted perimeter exposure",
    inherentRating: "Critical",
    residualRating: "High",
    treatmentStatus: "In Progress",
    riskOwner: harness.users.owner,
    treatmentOwner: harness.users.otherRequestor,
    informationSystemImpacted: requestFixtures.relations.informationSystem,
    informationAssetImpacted: requestFixtures.relations.informationAsset,
    targetDate: "2027-03-01",
  });
  await harness.createRiskRegisterMitigationFixture(String(created.documentId), fixtures.aggregate.control, "Implemented");
  await harness.createRiskRegisterMitigationFixture(String(created.documentId), fixtures.aggregate.control, "Implemented");

  const query = new URLSearchParams({
    q: "perimeter exposure",
    treatmentStatus: "In Progress",
    inherentRating: "Critical",
    residualRating: "High",
    riskOwner: harness.users.owner,
    treatmentOwner: harness.users.otherRequestor,
    assessment: fixtures.releaseFacts.unreleased,
    system: requestFixtures.relations.informationSystem,
    asset: requestFixtures.relations.informationAsset,
    mitigationStatus: "Implemented",
    targetDateFrom: "2027-03-01",
    targetDateTo: "2027-03-01",
    sort: "riskNumber:asc",
    page: "1",
    pageSize: "10",
  });
  const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
  assert.equal(response.status, 200, `RISK_REGISTER_ROUTE_MISSING: ${await response.clone().text()}`);
  const body = await payload(response);
  const data = rows(body);
  assert.equal(data.length, 1, "RISK_REGISTER_AND_FILTER_OR_DUPLICATE_FAILED");
  assert.equal(data[0].documentId, created.documentId);
  // The nine Phase 5 keys plus the server-derived treatment due state (D-26).
  assert.deepEqual(Object.keys(data[0]).sort(), [
    "assessment", "documentId", "inherentRating", "residualRating", "riskNumber", "riskStatement",
    "targetDate", "treatmentDueState", "treatmentOwner", "treatmentStatus",
  ]);
  assert.deepEqual((body.meta as Record<string, Record<string, unknown>>).pagination, {
    page: 1, pageSize: 10, pageCount: 1, total: 1,
  });
  assert.deepEqual(Object.keys((body.meta as Record<string, Record<string, unknown>>).selectedLabels).sort(), [
    "assessment", "asset", "riskOwner", "system", "treatmentOwner",
  ]);
  assert.deepEqual(
    Object.keys((body.meta as Record<string, Record<string, unknown>>).selectedLabels).sort(),
    specKeys("RiskRegisterSelectedLabels"),
    "RISK_REGISTER_SELECTED_LABELS_NOT_THE_PUBLISHED_SET",
  );
  assertServedRegisterShape(body, "RISK_REGISTER_FILTERED_PAGE");
  assert.doesNotMatch(JSON.stringify(body), /email|username|createdAt|updatedAt|publishedAt|createdBy|updatedBy|\"id\":|evidence/i);

  const none = await request(
    `/api/v1/risks?assessment=${encodeURIComponent(fixtures.releaseFacts.unreleased)}&mitigationStatus=No+mitigation+controls`,
    harness.identities.analyst,
  );
  assert.equal(none.status, 200);
  assert.equal(rows(await payload(none)).some((row) => row.documentId === created.documentId), false, "NO_MITIGATION_TREATED_STATUS_NULL");
});

test("mounted Risk Register derives every row's treatment due state on the UTC date", async () => {
  const harness = await harnessPromise;
  const today = utcToday(new Date());
  const day = (offset: number) => addUtcDays(today, offset);
  // A fresh mutable parent, so no Risk another test creates shares this page.
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "DUE-STATE-REQUEST-001",
    title: "Treatment due state request",
    requestStatus: "under-review",
    requestor: "owner",
  });
  const assessment = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-DUE-STATE-001",
    assessmentStatus: "draft",
    assessmentRequest: requestId,
  });
  const cases = [
    { name: "past target, in progress", input: { targetDate: day(-1), treatmentStatus: "In Progress", treatmentOwner: harness.users.otherRequestor }, expected: "overdue" },
    { name: "last day of the window", input: { targetDate: day(14), treatmentStatus: "In Progress" }, expected: "due-soon" },
    { name: "first day after the window", input: { targetDate: day(15), treatmentStatus: "In Progress" }, expected: "later" },
    { name: "no target date", input: { targetDate: null, treatmentStatus: "In Progress" }, expected: "no-target-date" },
    { name: "complete with a past target", input: { targetDate: day(-10), treatmentStatus: "Complete" }, expected: "complete-or-closed" },
    { name: "closed with a past target", input: { targetDate: day(-10), treatmentStatus: "In Progress", closureDate: day(-2) }, expected: "complete-or-closed" },
    { name: "no recorded status with a past target", input: { targetDate: day(-3), treatmentStatus: null }, expected: "overdue" },
  ] as const;
  const expectedByRiskNumber = new Map<string, { name: string; expected: string }>();
  for (const scenario of cases) {
    const created = await createRisk(assessment, scenario.input);
    expectedByRiskNumber.set(String(created.riskNumber), { name: scenario.name, expected: scenario.expected });
  }

  const response = await request(
    `/api/v1/risks?${new URLSearchParams({ assessment, sort: "riskNumber:asc", pageSize: "10" })}`,
    harness.identities.analyst,
  );
  assert.equal(response.status, 200, `RISK_REGISTER_DUE_STATE_PAGE_FAILED: ${await response.clone().text()}`);
  // The server and this test read the clock on the same UTC day; a rollover
  // mid-test would shift every boundary, so it is reported as such.
  assert.equal(utcToday(new Date()), today, "UTC_DAY_ROLLED_OVER_DURING_TEST");
  const body = await payload(response);
  const data = rows(body);
  assert.equal(data.length, cases.length, "RISK_REGISTER_DUE_STATE_ROWS");
  assert.equal((body.meta as { pagination: { total: number } }).pagination.total, cases.length);
  for (const row of data) {
    const scenario = expectedByRiskNumber.get(String(row.riskNumber));
    assert.ok(scenario, `UNEXPECTED_DUE_STATE_ROW_${String(row.riskNumber)}`);
    assert.equal(row.treatmentDueState, scenario.expected, `TREATMENT_DUE_STATE_${scenario.name}`);
    assert.ok((TREATMENT_DUE_STATES as readonly string[]).includes(String(row.treatmentDueState)));
  }
  // Both treatment-owner branches are served on this page: one object and the rest null.
  assert.equal(data.filter((row) => row.treatmentOwner !== null).length, 1, "TREATMENT_OWNER_OBJECT_BRANCH");
  assertServedRegisterShape(body, "RISK_REGISTER_DUE_STATE_PAGE");
  assert.doesNotMatch(JSON.stringify(body), /closureDate/, "CLOSURE_DATE_DISCLOSED_IN_REGISTER_ROW");
});

test("mounted Risk Register filters open and closed Risks with totals equal to the rows it pages (D-36)", async () => {
  const harness = await harnessPromise;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RISK-STATE-REQUEST-001",
    title: "Risk state filter request",
    requestStatus: "under-review",
    requestor: "owner",
  });
  const assessment = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-RISK-STATE-001",
    assessmentStatus: "in-review",
    assessmentRequest: requestId,
  });
  const openHigh = await createRisk(assessment, { residualRating: "High", treatmentStatus: "In Progress", targetDate: "2097-05-01" });
  const openLow = await createRisk(assessment, { residualRating: "Low", treatmentStatus: null, targetDate: null });
  const closedHigh = await createRisk(assessment, { residualRating: "High", treatmentStatus: "Complete", targetDate: "2097-01-01", closureDate: "2026-09-01" });

  async function statePage(extra: Record<string, string>) {
    const query = new URLSearchParams({ assessment, sort: "riskNumber:asc", pageSize: "10", ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_STATE_PAGE_FAILED_${JSON.stringify(extra)}: ${await response.clone().text()}`);
    const body = await payload(response);
    assertServedRegisterShape(body, `RISK_STATE_PAGE_${JSON.stringify(extra)}`);
    const data = rows(body);
    const total = (body.meta as { pagination: { total: number } }).pagination.total;
    // The total and the page share one predicate, so a tile linking here can equal the list.
    assert.equal(total, data.length, `RISK_STATE_TOTAL_NOT_THE_PAGED_ROWS_${JSON.stringify(extra)}`);
    return data.map((row) => row.documentId);
  }

  assert.deepEqual(await statePage({ state: "open" }), [openHigh.documentId, openLow.documentId], "RISK_STATE_OPEN");
  assert.deepEqual(await statePage({ state: "closed" }), [closedHigh.documentId], "RISK_STATE_CLOSED");
  assert.deepEqual(
    await statePage({}),
    [openHigh.documentId, openLow.documentId, closedHigh.documentId],
    "RISK_STATE_ABSENT_IS_ALL",
  );
  assert.deepEqual(await statePage({ state: "open", residualRating: "High" }), [openHigh.documentId], "RISK_STATE_NOT_ANDED");
  assert.deepEqual(await statePage({ state: "closed", residualRating: "Low" }), [], "RISK_STATE_CLOSED_NOT_ANDED");

  const rejected = await request(`/api/v1/risks?${new URLSearchParams({ assessment, state: "Open" })}`, harness.identities.analyst);
  assert.equal(rejected.status, 400, "RISK_STATE_CASE_ACCEPTED");
  assert.doesNotMatch(await rejected.text(), /SQL|stack|database|closure_date|riskNumber|RSK-/i);
});

test("mounted Risk Register applies inclusive target-date ranges before totals and pagination", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const assessment = fixtures.releaseFacts.unreleased;
  const before = await createRisk(assessment, { targetDate: "2097-02-28" });
  const lower = await createRisk(assessment, { targetDate: "2097-03-01" });
  const upper = await createRisk(assessment, { targetDate: "2097-03-31" });
  const after = await createRisk(assessment, { targetDate: "2097-04-01" });
  await createRisk(assessment, { targetDate: null });

  const closed = await registerDatePage(assessment, "2097-03-01", "2097-03-31", 1, 10);
  assert.deepEqual(closed.data.map((row) => row.documentId), [lower.documentId, upper.documentId]);
  assert.deepEqual(closed.meta, { page: 1, pageSize: 10, pageCount: 1, total: 2 });

  const fromOnly = await registerDatePage(assessment, "2097-03-31", undefined, 1, 10);
  assert.deepEqual(fromOnly.data.map((row) => row.documentId), [upper.documentId, after.documentId]);
  assert.equal(fromOnly.meta.total, 2);

  const toOnly = await registerDatePage(assessment, "2097-01-01", "2097-03-01", 1, 10);
  assert.deepEqual(toOnly.data.map((row) => row.documentId), [before.documentId, lower.documentId]);
  assert.equal(toOnly.meta.total, 2);

  const equal = await registerDatePage(assessment, "2097-03-01", "2097-03-01", 1, 10);
  assert.deepEqual(equal.data.map((row) => row.documentId), [lower.documentId]);
  assert.equal(equal.meta.total, 1);

  const empty = await registerDatePage(assessment, "2190-01-01", "2190-12-31", 3, 10);
  assert.deepEqual(empty.data, []);
  assert.deepEqual(empty.meta, { page: 3, pageSize: 10, pageCount: 0, total: 0 });
});

test("mounted Risk Register excludes parents that detail deliberately treats as unavailable", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  for (const assessment of [
    fixtures.releaseFacts.approvedOnly,
    fixtures.releaseFacts.approverOnly,
    fixtures.releaseFacts.approvalDateOnly,
    fixtures.releaseFacts.approvedAndApprover,
    fixtures.releaseFacts.approvedAndApprovalDate,
    fixtures.releaseFacts.approverAndApprovalDate,
  ]) {
    const risk = await createRisk(assessment, { targetDate: "2027-03-01" });
    const page = await registerDatePage(assessment, "2027-03-01", "2027-03-01", 1, 10);
    assert.equal(page.data.some((row) => row.documentId === risk.documentId), false);
    assert.equal(page.meta.total, 0);
  }
});

test("mounted SQLite repository orders all fields globally and reports honest pages", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const ratings = ["Low", "Moderate", "High", "Critical"] as const;
  const created: Array<Record<string, unknown>> = [];
  for (let index = 0; index < 12; index += 1) {
    created.push(await createRisk(fixtures.concurrency.assessment, {
      riskStatement: `Ordering statement ${String.fromCharCode(90 - index)}`,
      inherentRating: ratings[index % ratings.length],
      residualRating: ratings[(index + 2) % ratings.length],
      treatmentStatus: ["Not Started", "In Progress", "Overdue", "Complete"][index % 4],
      treatmentOwner: index % 2 === 0 ? harness.users.owner : harness.users.otherRequestor,
      targetDate: index % 4 === 0 ? null : `2027-${String((index % 9) + 1).padStart(2, "0")}-15`,
    }));
  }

  const sortFields = [
    "riskNumber", "riskStatement", "inherentRating", "residualRating", "treatmentStatus", "treatmentOwner", "targetDate", "assessment",
  ];
  for (const field of sortFields) {
    for (const direction of ["asc", "desc"]) {
      const first = await registerPage(fixtures.concurrency.assessment, `${field}:${direction}`, 1, 10);
      const second = await registerPage(fixtures.concurrency.assessment, `${field}:${direction}`, 2, 10);
      assert.equal(first.meta.total, created.length, `UNTRUTHFUL_TOTAL_${field}_${direction}`);
      assert.equal(new Set([...first.data, ...second.data].map((row) => row.documentId)).size, created.length,
        `CROSS_PAGE_ORDER_DUPLICATE_${field}_${direction}`);
      assert.deepEqual(
        [...first.data, ...second.data].map((row) => row.riskNumber),
        [...new Set([...first.data, ...second.data].map((row) => row.riskNumber))],
        `UNSTABLE_TIE_BREAK_${field}_${direction}`,
      );
    }
  }

  for (const direction of ["asc", "desc"]) {
    /*
     * Rated Risks follow the Low to Critical ladder in the sort's direction, and an unrated Risk (rank
     * 0: no rating, or one off the ladder) follows every rated one in both directions, as an undated
     * Risk does in the target-date sort. This model used to rank an unrated Risk 5, which put it
     * first in a descending sort; the dashboard's "High and Critical first" register link needs
     * Critical first.
     */
    const rank = (value: unknown) => ["Low", "Moderate", "High", "Critical"].indexOf(String(value)) + 1;
    for (const field of ["inherentRating", "residualRating"] as const) {
      const ratingPage = await registerPage(fixtures.concurrency.assessment, `${field}:${direction}`, 1, 25);
      const values = ratingPage.data.map((row) => rank(row[field]));
      const rated = values.filter((value) => value > 0).sort((left, right) => direction === "asc" ? left - right : right - left);
      const expected = [...rated, ...values.filter((value) => value === 0)];
      assert.deepEqual(values, expected, `SEMANTIC_RATING_ORDER_FAILED_${field}_${direction}`);
    }

    const dates = (await registerPage(fixtures.concurrency.assessment, `targetDate:${direction}`, 1, 25)).data.map((row) => row.targetDate);
    const firstNull = dates.indexOf(null);
    assert.ok(firstNull === -1 || dates.slice(firstNull).every((value) => value === null), `TARGET_DATE_NULLS_NOT_LAST_${direction}`);
  }

  for (const pageSize of [10, 25, 50]) {
    const page = await registerPage(fixtures.concurrency.assessment, "riskNumber:asc", 1, pageSize);
    assert.equal(page.meta.pageSize, pageSize);
    assert.equal(page.meta.total, created.length);
  }
  const final = await registerPage(fixtures.concurrency.assessment, "riskNumber:asc", 2, 10);
  assert.equal(final.data.length, 2);
  const outOfRange = await registerPage(fixtures.concurrency.assessment, "riskNumber:asc", 99, 10);
  assert.equal(outOfRange.data.length, 0);
  assert.equal(outOfRange.meta.total, created.length);
  assert.equal(outOfRange.meta.pageCount, 2);
});

test("mounted Risk Register sorts unrated Risks after every rated Risk in both directions of each rating sort", async () => {
  const harness = await harnessPromise;
  // A fresh mutable parent, so no Risk another test creates shares these pages.
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RATING-ORDER-REQUEST-001",
    title: "Rating order request",
    requestStatus: "under-review",
    requestor: "owner",
  });
  const assessment = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-RATING-ORDER-001",
    assessmentStatus: "in-review",
    assessmentRequest: requestId,
  });
  /*
   * Created in Risk-number order, which breaks ties. Each rating column holds one Risk with no
   * rating and one with a rating off the ladder, and the two columns rank the rated Risks
   * differently, so each sort must read its own column.
   */
  const risks = {
    unrated: await createRisk(assessment, {}),
    b: await createRisk(assessment, { inherentRating: "Moderate", residualRating: "Critical" }),
    c: await createRisk(assessment, { inherentRating: "Critical", residualRating: "Low" }),
    d: await createRisk(assessment, { inherentRating: "Extreme", residualRating: "High" }),
    e: await createRisk(assessment, { inherentRating: "Low", residualRating: "Extreme" }),
    f: await createRisk(assessment, { inherentRating: "High", residualRating: "Moderate" }),
  };
  const expected: Record<string, Array<keyof typeof risks>> = {
    // The dashboard's "Open Risk Register" link: Critical first, and nothing unrated above it.
    "residualRating:desc": ["b", "d", "f", "c", "unrated", "e"],
    "residualRating:asc": ["c", "f", "d", "b", "unrated", "e"],
    "inherentRating:desc": ["c", "f", "b", "e", "unrated", "d"],
    "inherentRating:asc": ["e", "b", "f", "c", "unrated", "d"],
  };

  for (const [sort, names] of Object.entries(expected)) {
    const page = await registerPage(assessment, sort, 1, 10);
    assert.equal(page.meta.total, names.length, `RATING_ORDER_TOTAL_${sort}`);
    assert.deepEqual(
      page.data.map((row) => row.documentId),
      names.map((name) => risks[name].documentId),
      `UNRATED_RISK_NOT_LAST_${sort}`,
    );
  }
});

test("mounted Risk detail requires the exact analyst grant before query or record lookup", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const riskBefore = await harness.getRisk(fixtures.aggregate.risk);

  for (const identity of [
    harness.identities.owner,
    harness.identities.otherRequestor,
    harness.identities.analystAgent,
    harness.identities.serviceAnalystAgent,
    harness.identities.inactiveAnalyst,
    undefined,
  ]) {
    for (const riskId of [fixtures.aggregate.risk, "random-risk-document-id"]) {
      const denied = await request(`/api/v1/risks/${riskId}?populate=*`, identity);
      assert.equal(denied.status, 403, `RISK_DETAIL_DENIAL_FAILED_${identity ?? "missing"}_${riskId}`);
      const text = await denied.text();
      assert.doesNotMatch(text, /SQL|stack|database|RSK-2026|Mounted aggregate risk|email|username/i);
      assert.deepEqual(await harness.getRisk(fixtures.aggregate.risk), riskBefore, "DENIED_RISK_DETAIL_CHANGED_PERSISTENCE");
    }
  }

  const missingToken = await harness.request({
    path: `/api/v1/risks/${fixtures.aggregate.risk}`,
    identity: harness.identities.analyst,
    omitApiToken: true,
  });
  assert.equal(missingToken.status, 401, "RISK_DETAIL_TOKEN_GATE_MISSING");
});

test("mounted Risk detail returns one closed complete released aggregate", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const response = await request(`/api/v1/risks/${fixtures.aggregate.risk}`, harness.identities.analyst);
  assert.equal(response.status, 200, `RISK_DETAIL_ROUTE_MISSING: ${await response.clone().text()}`);
  const body = await payload(response);
  assert.ok(body.data && typeof body.data === "object" && !Array.isArray(body.data), "RISK_DETAIL_NOT_COMPLETE_OBJECT");
  const detail = body.data as Record<string, unknown>;
  assert.equal(detail.parentLock, "released");
  assert.deepEqual(detail.riskType, {
    documentId: fixtures.aggregate.riskType,
    name: "Mounted Internet Exposure",
    description: "Reusable mounted risk type for assessment workflow security tests",
  });
  assert.deepEqual(detail.riskOwner, { documentId: harness.users.owner, displayName: "Jane Doe" });
  assert.deepEqual(detail.assessment, {
    documentId: fixtures.aggregate.assessment,
    assessmentNumber: "ASM-2026-FULL07",
    title: "Assessment release fixture FULL07",
  });
  assert.ok(Array.isArray(detail.controlImplementations));
  assert.deepEqual((detail.controlImplementations as Array<Record<string, unknown>>)[0]?.control, {
    documentId: fixtures.aggregate.control,
    controlNumber: "MOUNTED-CTRL-001",
    name: "Mounted boundary protection",
  });
  assert.doesNotMatch(JSON.stringify(body), /email|username|createdAt|updatedAt|publishedAt|createdBy|updatedBy|requestor|"id":/i);
});

test("mounted Risk detail returns no projection for missing Risks or every partial release parent", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const partialParents = [
    fixtures.releaseFacts.approvedOnly,
    fixtures.releaseFacts.approverOnly,
    fixtures.releaseFacts.approvalDateOnly,
    fixtures.releaseFacts.approvedAndApprover,
    fixtures.releaseFacts.approvedAndApprovalDate,
    fixtures.releaseFacts.approverAndApprovalDate,
  ];
  for (const [index, assessmentId] of partialParents.entries()) {
    const riskId = await harness.createRiskRegisterFixture(assessmentId, {
      riskNumber: `RSK-DETAIL-PARTIAL-${index}`,
      riskStatement: "Must never be disclosed",
      riskType: fixtures.aggregate.riskType,
      riskOwner: harness.users.owner,
    });
    const response = await request(`/api/v1/risks/${riskId}`, harness.identities.analyst);
    assert.equal(response.status, 404, `PARTIAL_RELEASE_DETAIL_DISCLOSED_${index}`);
    const text = await response.text();
    assert.doesNotMatch(text, /RSK-DETAIL|Must never|mutable|released|invalid|parentLock|riskNumber/i);
    assert.ok(await harness.getRisk(riskId), `PARTIAL_RELEASE_DETAIL_CHANGED_PERSISTENCE_${index}`);
  }

  const missing = await request("/api/v1/risks/random-risk-document-id", harness.identities.analyst);
  assert.equal(missing.status, 404);
  assert.doesNotMatch(await missing.text(), /random-risk|riskNumber|parentLock|mutable|released|invalid/i);
});

async function createRisk(assessmentId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const harness = await harnessPromise;
  fixtureSequence += 1;
  const riskNumber = `RSK-REGISTER-${String(fixtureSequence).padStart(4, "0")}`;
  const documentId = await harness.createRiskRegisterFixture(assessmentId, {
    riskNumber,
    riskStatement: "Mounted register fixture",
    ...input,
  });
  return { documentId, riskNumber };
}

async function registerPage(assessment: string, sort: string, page: number, pageSize: number) {
  const harness = await harnessPromise;
  const query = new URLSearchParams({ assessment, sort, page: String(page), pageSize: String(pageSize) });
  const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
  assert.equal(response.status, 200, `RISK_REGISTER_PAGE_FAILED_${sort}_${page}_${pageSize}: ${await response.clone().text()}`);
  const body = await payload(response);
  return {
    data: rows(body),
    meta: (body.meta as { pagination: { page: number; pageSize: number; pageCount: number; total: number } }).pagination,
  };
}

async function registerDatePage(
  assessment: string,
  targetDateFrom: string | undefined,
  targetDateTo: string | undefined,
  page: number,
  pageSize: number,
) {
  const harness = await harnessPromise;
  const query = new URLSearchParams({ assessment, sort: "targetDate:asc", page: String(page), pageSize: String(pageSize) });
  if (targetDateFrom) query.set("targetDateFrom", targetDateFrom);
  if (targetDateTo) query.set("targetDateTo", targetDateTo);
  const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
  assert.equal(response.status, 200, `RISK_REGISTER_DATE_PAGE_FAILED: ${await response.clone().text()}`);
  const body = await payload(response);
  return {
    data: rows(body),
    meta: (body.meta as { pagination: { page: number; pageSize: number; pageCount: number; total: number } }).pagination,
  };
}
