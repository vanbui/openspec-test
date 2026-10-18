import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test, { after } from "node:test";

import { ALERT_DUE_SOON_WINDOW_DAYS } from "../src/csrm/insights/insight-constants";
import { deriveTreatmentDueState, TREATMENT_DUE_STATES } from "../src/csrm/insights/treatment-due-state";
import { addUtcDays, utcToday } from "../src/csrm/insights/utc-date";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());
let fixtureSequence = 0;

// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend,
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
    for (const field of ["inherentRating", "residualRating"]) {
      assert.ok(
        row[field] === null || specification.components.schemas.AssessmentRating.enum.includes(row[field]),
        `${diagnostic}_${field}_NOT_PUBLISHED_${String(row[field])}`,
      );
    }
    assert.ok(
      specification.components.schemas.RiskRegisterItem.properties.treatmentStatus.enum.includes(row.treatmentStatus),
      `${diagnostic}_TREATMENT_STATUS_NOT_PUBLISHED_${String(row.treatmentStatus)}`,
    );
    // CR-101: every closed value of the row is inside its published enumeration, not only the ratings and status.
    for (const field of ["stage", "treatmentAction"]) {
      assert.ok(
        specification.components.schemas.RiskRegisterItem.properties[field].enum.includes(row[field]),
        `${diagnostic}_${field}_NOT_PUBLISHED_${String(row[field])}`,
      );
    }
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

/** The published values of one closed property: its own enum, or the enum of the component it references. */
function publishedValues(property: Record<string, any>): unknown[] | null {
  if (Array.isArray(property.enum)) return property.enum;
  const reference = (property.anyOf as Array<Record<string, any>> | undefined)?.find((branch) => typeof branch.$ref === "string");
  if (!reference) return null;
  const component = specification.components.schemas[String(reference.$ref).split("/").pop() as string];
  return Array.isArray(component?.enum) ? [...component.enum, null] : null;
}

/*
 * CR-101: a Risk listed under "Not rated" or "Not provided" opens. Every closed value of its detail, and of
 * each of its mitigation controls, is inside the published enumeration, so the closed client parser accepts it.
 */
async function assertLegacyDetailOpens(documentId: string, diagnostic: string): Promise<Record<string, unknown>> {
  const harness = await harnessPromise;
  const response = await request(`/api/v1/risks/${documentId}`, harness.identities.analyst);
  assert.equal(response.status, 200, `${diagnostic}_DETAIL_FAILED: ${await response.clone().text()}`);
  const detail = (await payload(response)).data as Record<string, unknown>;
  const closedOf = (componentName: string) => Object.entries(specification.components.schemas[componentName].properties as Record<string, Record<string, any>>)
    .map(([field, property]) => [field, publishedValues(property)] as const)
    .filter((entry): entry is readonly [string, unknown[]] => entry[1] !== null);
  for (const [field, values] of closedOf("RiskDetail")) {
    assert.ok(values.includes(detail[field]), `${diagnostic}_DETAIL_${field}_NOT_PUBLISHED_${String(detail[field])}`);
  }
  for (const implementation of detail.controlImplementations as Array<Record<string, unknown>>) {
    for (const [field, values] of closedOf("RiskDetailControlImplementation")) {
      assert.ok(values.includes(implementation[field]), `${diagnostic}_CONTROL_${field}_NOT_PUBLISHED_${String(implementation[field])}`);
    }
  }
  return detail;
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
    "stage=closed",
    "stage=",
    "stage=Released",
    "stage=under%20assessment",
    "stage=released&stage=under-assessment",
    "stage[]=released",
    "stage[$eq]=released",
    "treatmentAction=accept",
    "treatmentAction=ACCEPT",
    "treatmentAction=",
    "treatmentAction=Transfer",
    "treatmentAction=Accept&treatmentAction=Treat",
    "treatmentAction[]=Accept",
    "dueState=Overdue",
    "dueState=",
    "dueState=due_soon",
    "dueState=due%20soon",
    "dueState=overdue&dueState=later",
    "dueState[]=overdue",
    "dueState[$eq]=overdue",
    "residualRating=None",
    "inherentRating=NONE",
    "treatmentStatus=Not%20provided",
    "mitigationStatus=Any",
    "mitigationStatus=any&mitigationStatus=none",
    "mitigationEffectiveness=effective",
    "mitigationEffectiveness=Not%20provided",
    "mitigationEffectiveness=",
    "mitigationEffectiveness[]=Effective",
    "impactedSystem=None",
    "impactedSystem=all",
    "impactedSystem=",
    "impactedSystem[]=none",
    "impactedSystem=none&system=system-document-04",
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
  // The nine Phase 5 keys, the server-derived treatment due state (D-26), the parent's stage and the
  // recorded treatment action (D-44), and the server-derived Accepted marker (D-41).
  assert.deepEqual(Object.keys(data[0]).sort(), [
    "accepted", "assessment", "documentId", "inherentRating", "residualRating", "riskNumber", "riskStatement",
    "stage", "targetDate", "treatmentAction", "treatmentDueState", "treatmentOwner", "treatmentStatus",
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

/*
 * Phase 16 D-08, D-13, D-45: a withdrawn Risk leaves the register's default view and its open and closed values,
 * with every total following the rows it pages; the explicit withdrawn value lists withdrawn Risks only. The register
 * detail of a withdrawn Risk names who withdrew it, when and why and keeps its parent lock; an active Risk's is null.
 */
test("mounted Risk Register hides withdrawn Risks unless the withdrawn state is asked for, and its detail carries the withdrawal (Phase 16 D-08, D-45)", async () => {
  const harness = await harnessPromise;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RISK-WITHDRAWN-REQUEST-001",
    title: "Risk withdrawn filter request",
    requestStatus: "risk-assessment-drafted",
    requestor: "owner",
  });
  const assessment = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-RISK-WITHDRAWN-001",
    assessmentStatus: "draft",
    assessmentRequest: requestId,
  });
  const activeOpen = await createRisk(assessment, { residualRating: "Critical", treatmentStatus: "In Progress", targetDate: "2097-05-01" });
  const activeClosed = await createRisk(assessment, { residualRating: "Low", treatmentStatus: "Complete", targetDate: "2097-01-01", closureDate: "2026-09-01" });
  const withdrawnOpen = await createRisk(assessment, { residualRating: "Critical", treatmentStatus: "In Progress", targetDate: "2097-06-01" });
  const withdrawnClosed = await createRisk(assessment, { residualRating: "High", treatmentStatus: "Complete", targetDate: "2097-02-01", closureDate: "2026-09-02" });
  const reason = "Proposed under the wrong Risk Type";
  const withdrawal = await request(
    `/api/v1/risk_assessments/${encodeURIComponent(assessment)}/risk_withdrawals`,
    harness.identities.analyst,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ riskIds: [withdrawnOpen.documentId, withdrawnClosed.documentId], reason }),
    },
  );
  assert.equal(withdrawal.status, 200, `RISK_WITHDRAWN_FIXTURE_FAILED: ${await withdrawal.clone().text()}`);

  async function statePage(extra: Record<string, string>) {
    const query = new URLSearchParams({ assessment, sort: "riskNumber:asc", pageSize: "10", ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_WITHDRAWN_PAGE_FAILED_${JSON.stringify(extra)}: ${await response.clone().text()}`);
    const body = await payload(response);
    assertServedRegisterShape(body, `RISK_WITHDRAWN_PAGE_${JSON.stringify(extra)}`);
    const data = rows(body);
    const total = (body.meta as { pagination: { total: number } }).pagination.total;
    assert.equal(total, data.length, `RISK_WITHDRAWN_TOTAL_NOT_THE_PAGED_ROWS_${JSON.stringify(extra)}`);
    return data.map((row) => row.documentId);
  }

  assert.deepEqual(await statePage({}), [activeOpen.documentId, activeClosed.documentId], "RISK_WITHDRAWN_IN_THE_DEFAULT_VIEW");
  assert.deepEqual(await statePage({ state: "open" }), [activeOpen.documentId], "RISK_WITHDRAWN_IN_OPEN");
  assert.deepEqual(await statePage({ state: "closed" }), [activeClosed.documentId], "RISK_WITHDRAWN_IN_CLOSED");
  assert.deepEqual(
    await statePage({ state: "withdrawn" }),
    [withdrawnOpen.documentId, withdrawnClosed.documentId],
    "RISK_WITHDRAWN_FILTER_NOT_WITHDRAWN_ONLY",
  );
  assert.deepEqual(await statePage({ residualRating: "Critical" }), [activeOpen.documentId], "RISK_WITHDRAWN_IN_A_FIGURE_FILTER");
  assert.deepEqual(await statePage({ stage: "under-assessment" }), [activeOpen.documentId, activeClosed.documentId], "RISK_WITHDRAWN_IN_THE_STAGE");
  assert.deepEqual(
    await statePage({ state: "withdrawn", residualRating: "Critical" }),
    [withdrawnOpen.documentId],
    "RISK_WITHDRAWN_FILTER_NOT_ANDED",
  );
  assert.deepEqual(await statePage({ state: "withdrawn", stage: "released" }), [], "RISK_WITHDRAWN_FILTER_LEFT_ITS_STAGE");

  const rejected = await request(`/api/v1/risks?${new URLSearchParams({ assessment, state: "Withdrawn" })}`, harness.identities.analyst);
  assert.equal(rejected.status, 400, "RISK_WITHDRAWN_STATE_CASE_ACCEPTED");

  const detailOf = async (documentId: unknown) => {
    const response = await request(`/api/v1/risks/${String(documentId)}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_WITHDRAWN_DETAIL_FAILED_${String(documentId)}: ${await response.clone().text()}`);
    const detail = (await payload(response)).data as Record<string, unknown>;
    assert.deepEqual(Object.keys(detail).sort(), specKeys("RiskDetail"), "RISK_WITHDRAWN_DETAIL_KEYS");
    return detail;
  };
  const withdrawnDetail = await detailOf(withdrawnOpen.documentId);
  assert.equal(withdrawnDetail.parentLock, "mutable", "RISK_WITHDRAWN_DETAIL_PARENT_LOCK");
  const block = withdrawnDetail.withdrawal as Record<string, unknown> | null;
  assert.ok(block, "RISK_WITHDRAWN_DETAIL_WITHOUT_WITHDRAWAL");
  assert.deepEqual(Object.keys(block).sort(), specKeys("RiskWithdrawal"), "RISK_WITHDRAWAL_KEYS");
  assert.equal(block.reason, reason, "RISK_WITHDRAWAL_REASON");
  assert.ok(Number.isFinite(Date.parse(String(block.at))), `RISK_WITHDRAWAL_AT_${String(block.at)}`);
  const by = block.by as Record<string, unknown> | null;
  assert.equal(by?.documentId, harness.users.analyst, "RISK_WITHDRAWAL_BY");
  assert.equal(typeof by?.displayName, "string", "RISK_WITHDRAWAL_BY_NAME");
  assert.deepEqual(Object.keys(by ?? {}).sort(), ["displayName", "documentId"], "RISK_WITHDRAWAL_BY_KEYS");
  assert.equal((await detailOf(activeOpen.documentId)).withdrawal, null, "RISK_ACTIVE_DETAIL_WITHDRAWAL");
});

/*
 * BE1-02: a Risk withdrawn before its assessment was released stays withdrawn after release. RiskRegisterItem.accepted
 * is "true only for a released, open Risk" and Phase 16 made "open" an active Risk, so the Withdrawn view never serves
 * a withdrawn Accept Risk as accepted.
 */
test("mounted Risk Register never serves a withdrawn Accept Risk under a released assessment as accepted (Phase 16 D-08, BE1-02)", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const assessment = fixtures.releaseFacts.complete;
  const withdrawn = await createRisk(assessment, {
    riskStatement: "Withdrawn before release",
    treatmentAction: "Accept",
    treatmentStatus: "In Progress",
    targetDate: "2020-01-01",
    withdrawnAt: "2026-09-01T09:00:00.000Z",
    withdrawalReason: "Recorded twice under another Risk",
  });
  const active = await createRisk(assessment, { riskStatement: "Accepted at release", treatmentAction: "Accept", treatmentStatus: "In Progress", targetDate: "2097-01-01" });
  for (const extra of [{ state: "withdrawn" }, { state: "withdrawn", treatmentAction: "Accept", stage: "released" }] as Array<Record<string, string>>) {
    const query = new URLSearchParams({ assessment, sort: "riskNumber:asc", pageSize: "50", ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_WITHDRAWN_ACCEPT_PAGE_FAILED_${JSON.stringify(extra)}: ${await response.clone().text()}`);
    const body = await payload(response);
    assertServedRegisterShape(body, `RISK_WITHDRAWN_ACCEPT_PAGE_${JSON.stringify(extra)}`);
    const row = rows(body).find((entry) => entry.documentId === withdrawn.documentId);
    assert.ok(row, `RISK_WITHDRAWN_ACCEPT_NOT_LISTED_${JSON.stringify(extra)}`);
    assert.equal(row.stage, "released", "RISK_WITHDRAWN_ACCEPT_STAGE");
    assert.equal(row.accepted, false, `RISK_WITHDRAWN_SERVED_AS_ACCEPTED_${JSON.stringify(extra)}`);
  }
  const activeQuery = new URLSearchParams({ assessment, treatmentAction: "Accept", sort: "riskNumber:asc", pageSize: "50" });
  const activeRows = rows(await payload(await request(`/api/v1/risks?${activeQuery}`, harness.identities.analyst)));
  assert.equal(activeRows.find((entry) => entry.documentId === active.documentId)?.accepted, true, "RISK_ACTIVE_ACCEPT_NOT_ACCEPTED");
});

/*
 * D-40, research Pitfall 20: the register's scope is exactly its two named branches. Released is a
 * parent with the complete release facts; under assessment is a draft or in-review parent with none.
 * Each Risk in scope is in exactly one branch, the two totals sum to the unfiltered total, and a partly
 * released parent's Risks stay in neither, as they stay out of the register today.
 */
test("mounted Risk Register partitions its scope into released and under-assessment stages (D-40)", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RISK-STAGE-REQUEST-001",
    title: "Risk stage partition request",
    requestStatus: "under-review",
    requestor: "owner",
  });
  const draft = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-RISK-STAGE-DRAFT-001",
    assessmentStatus: "draft",
    assessmentRequest: requestId,
  });
  const marker = "Stage partition fixture";
  const draftRisk = await createRisk(draft, { riskStatement: `${marker} under a draft` });
  const inReviewRisk = await createRisk(fixtures.releaseFacts.unreleased, { riskStatement: `${marker} under review` });
  const releasedRisk = await createRisk(fixtures.releaseFacts.complete, { riskStatement: `${marker} released` });
  const partlyReleased: string[] = [];
  for (const assessment of [
    fixtures.releaseFacts.approvedOnly,
    fixtures.releaseFacts.approvedAndApprover,
    fixtures.releaseFacts.approvedAndApprovalDate,
    fixtures.releaseFacts.approverAndApprovalDate,
  ]) {
    partlyReleased.push(String((await createRisk(assessment, { riskStatement: `${marker} partly released` })).documentId));
  }

  async function stagePage(extra: Record<string, string>) {
    const query = new URLSearchParams({ q: marker, sort: "riskNumber:asc", pageSize: "50", ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_STAGE_PAGE_FAILED_${JSON.stringify(extra)}: ${await response.clone().text()}`);
    const body = await payload(response);
    assertServedRegisterShape(body, `RISK_STAGE_PAGE_${JSON.stringify(extra)}`);
    const data = rows(body);
    assert.equal((body.meta as { pagination: { total: number } }).pagination.total, data.length, `RISK_STAGE_TOTAL_NOT_THE_PAGED_ROWS_${JSON.stringify(extra)}`);
    return data;
  }
  const ids = (data: Array<Record<string, unknown>>) => data.map((row) => row.documentId);

  const released = await stagePage({ stage: "released" });
  const underAssessment = await stagePage({ stage: "under-assessment" });
  const all = await stagePage({});
  assert.deepEqual(ids(released), [releasedRisk.documentId], "RISK_STAGE_RELEASED");
  assert.deepEqual(ids(underAssessment), [draftRisk.documentId, inReviewRisk.documentId], "RISK_STAGE_UNDER_ASSESSMENT");
  assert.deepEqual(ids(all), [draftRisk.documentId, inReviewRisk.documentId, releasedRisk.documentId], "RISK_STAGE_ABSENT_IS_BOTH");
  for (const row of released) assert.equal(row.stage, "released", `RISK_STAGE_ROW_${String(row.riskNumber)}`);
  for (const row of underAssessment) assert.equal(row.stage, "under-assessment", `RISK_STAGE_ROW_${String(row.riskNumber)}`);
  assert.deepEqual(
    Object.fromEntries(all.map((row) => [row.documentId, row.stage])),
    { [String(draftRisk.documentId)]: "under-assessment", [String(inReviewRisk.documentId)]: "under-assessment", [String(releasedRisk.documentId)]: "released" },
    "RISK_STAGE_UNFILTERED_ROWS",
  );
  for (const id of partlyReleased) {
    assert.equal([...ids(released), ...ids(underAssessment), ...ids(all)].includes(id), false, `RISK_STAGE_PARTLY_RELEASED_LISTED_${id}`);
  }
  assert.deepEqual(ids(await stagePage({ stage: "released", state: "closed" })), [], "RISK_STAGE_NOT_ANDED");

  // The whole register: every Risk in scope is in exactly one stage, and nothing leaves the register.
  async function everyId(extra: Record<string, string>): Promise<{ ids: Set<unknown>; total: number }> {
    const collected = new Set<unknown>();
    let total = 0;
    for (let page = 1; ; page += 1) {
      const query = new URLSearchParams({ sort: "riskNumber:asc", pageSize: "50", page: String(page), ...extra });
      const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
      assert.equal(response.status, 200, `RISK_STAGE_REGISTER_PAGE_FAILED_${JSON.stringify(extra)}_${page}`);
      const body = await payload(response);
      const pagination = (body.meta as { pagination: { pageCount: number; total: number } }).pagination;
      total = pagination.total;
      for (const row of rows(body)) {
        if (extra.stage) assert.equal(row.stage, extra.stage, `RISK_STAGE_REGISTER_ROW_${String(row.riskNumber)}`);
        collected.add(row.documentId);
      }
      if (page >= pagination.pageCount) break;
    }
    assert.equal(collected.size, total, `RISK_STAGE_REGISTER_PAGES_NOT_THE_TOTAL_${JSON.stringify(extra)}`);
    return { ids: collected, total };
  }
  const register = await everyId({});
  const registerReleased = await everyId({ stage: "released" });
  const registerUnderAssessment = await everyId({ stage: "under-assessment" });
  assert.equal(registerReleased.total + registerUnderAssessment.total, register.total, "RISK_STAGE_TOTALS_DO_NOT_SUM_TO_THE_REGISTER");
  assert.deepEqual([...registerReleased.ids].filter((id) => registerUnderAssessment.ids.has(id)), [], "RISK_STAGE_BRANCHES_OVERLAP");
  assert.deepEqual(
    [...register.ids].filter((id) => !registerReleased.ids.has(id) && !registerUnderAssessment.ids.has(id)),
    [],
    "RISK_STAGE_RISK_IN_NEITHER_BRANCH",
  );
  assert.ok(registerReleased.total > 0 && registerUnderAssessment.total > 0, "RISK_STAGE_BRANCH_EMPTY");
});

/*
 * D-02 item 3, D-44: the register filters by the recorded treatment action and serves it on each row.
 * "Accepted" is a released, open Risk with Accept (UI-SPEC section 9.1): a draft's Accept is only its
 * treatment action, so the stage and state filters together list exactly the accepted Risks.
 */
test("mounted Risk Register filters by treatment action and serves each row's action (D-44)", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RISK-ACTION-REQUEST-001",
    title: "Risk treatment action request",
    requestStatus: "under-review",
    requestor: "owner",
  });
  const draft = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-RISK-ACTION-DRAFT-001",
    assessmentStatus: "draft",
    assessmentRequest: requestId,
  });
  const marker = "Treatment action fixture";
  const releasedOpenAccept = await createRisk(fixtures.releaseFacts.complete, { riskStatement: `${marker} released open accept`, treatmentAction: "Accept" });
  const releasedClosedAccept = await createRisk(fixtures.releaseFacts.complete, { riskStatement: `${marker} released closed accept`, treatmentAction: "Accept", closureDate: "2026-09-01" });
  const releasedOpenTreat = await createRisk(fixtures.releaseFacts.complete, { riskStatement: `${marker} released open treat`, treatmentAction: "Treat" });
  const releasedOpenNone = await createRisk(fixtures.releaseFacts.complete, { riskStatement: `${marker} released open none` });
  const draftAccept = await createRisk(draft, { riskStatement: `${marker} draft accept`, treatmentAction: "Accept" });

  async function actionPage(extra: Record<string, string>) {
    const query = new URLSearchParams({ q: marker, sort: "riskNumber:asc", pageSize: "50", ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_ACTION_PAGE_FAILED_${JSON.stringify(extra)}: ${await response.clone().text()}`);
    const body = await payload(response);
    assertServedRegisterShape(body, `RISK_ACTION_PAGE_${JSON.stringify(extra)}`);
    const data = rows(body);
    assert.equal((body.meta as { pagination: { total: number } }).pagination.total, data.length, `RISK_ACTION_TOTAL_NOT_THE_PAGED_ROWS_${JSON.stringify(extra)}`);
    return data;
  }
  const ids = (data: Array<Record<string, unknown>>) => data.map((row) => row.documentId);

  const all = await actionPage({});
  assert.deepEqual(Object.fromEntries(all.map((row) => [row.documentId, row.accepted])), {
    [String(releasedOpenAccept.documentId)]: true,
    [String(releasedClosedAccept.documentId)]: false,
    [String(releasedOpenTreat.documentId)]: false,
    [String(releasedOpenNone.documentId)]: false,
    [String(draftAccept.documentId)]: false,
  }, "RISK_ACTION_ACCEPTED_MARKER_IS_RELEASED_OPEN_ACCEPT");
  assert.deepEqual(
    Object.fromEntries(all.map((row) => [row.documentId, row.treatmentAction])),
    {
      [String(releasedOpenAccept.documentId)]: "Accept",
      [String(releasedClosedAccept.documentId)]: "Accept",
      [String(releasedOpenTreat.documentId)]: "Treat",
      [String(releasedOpenNone.documentId)]: null,
      [String(draftAccept.documentId)]: "Accept",
    },
    "RISK_ACTION_ROWS",
  );
  assert.deepEqual(
    ids(await actionPage({ treatmentAction: "Accept" })),
    [releasedOpenAccept.documentId, releasedClosedAccept.documentId, draftAccept.documentId],
    "RISK_ACTION_ACCEPT",
  );
  assert.deepEqual(ids(await actionPage({ treatmentAction: "Treat" })), [releasedOpenTreat.documentId], "RISK_ACTION_TREAT");
  assert.deepEqual(
    ids(await actionPage({ stage: "released", treatmentAction: "Accept", state: "open" })),
    [releasedOpenAccept.documentId],
    "RISK_ACTION_ACCEPTED_IS_RELEASED_OPEN_ACCEPT",
  );
  assert.deepEqual(
    ids(await actionPage({ stage: "under-assessment", treatmentAction: "Accept" })),
    [draftAccept.documentId],
    "RISK_ACTION_DRAFT_ACCEPT_IS_UNDER_ASSESSMENT",
  );

  for (const invalid of ["accept", "Transfer"]) {
    const rejected = await request(`/api/v1/risks?${new URLSearchParams({ q: marker, treatmentAction: invalid })}`, harness.identities.analyst);
    assert.equal(rejected.status, 400, `RISK_ACTION_ACCEPTED_${invalid}`);
    assert.doesNotMatch(await rejected.text(), /SQL|stack|database|treatment_action|riskNumber|RSK-/i);
  }
});

/*
 * D-02 item 3, D-35, D-38, G-16: the dueState filter is the SQL mirror of the one due-state rule
 * (treatment-due-state.ts). On fixtures spanning every state and both ends of the 14-day window, under
 * both stages, each value lists exactly the Risks deriveTreatmentDueState gives that state on the
 * server's UTC today, with a total equal to the rows, so a figure linking here can equal its list.
 */
test("mounted Risk Register lists each due state exactly as the one due-state rule derives it (D-35, G-16)", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const today = utcToday(new Date());
  const day = (offset: number) => addUtcDays(today, offset);
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RISK-DUE-FILTER-REQUEST-001",
    title: "Risk due state filter request",
    requestStatus: "under-review",
    requestor: "owner",
  });
  const draft = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-RISK-DUE-FILTER-DRAFT-001",
    assessmentStatus: "draft",
    assessmentRequest: requestId,
  });
  const marker = "Due state filter fixture";
  const boundaries = [
    { name: "closed with a past target", targetDate: day(-10), treatmentStatus: "In Progress", closureDate: day(-2) },
    { name: "complete with a past target", targetDate: day(-10), treatmentStatus: "Complete", closureDate: null },
    { name: "closed with no target", targetDate: null, treatmentStatus: null, closureDate: day(-1) },
    { name: "no target date", targetDate: null, treatmentStatus: "In Progress", closureDate: null },
    { name: "no target date or status", targetDate: null, treatmentStatus: null, closureDate: null },
    { name: "target yesterday", targetDate: day(-1), treatmentStatus: "Not Started", closureDate: null },
    { name: "target yesterday with no status", targetDate: day(-1), treatmentStatus: null, closureDate: null },
    { name: "target today", targetDate: today, treatmentStatus: "In Progress", closureDate: null },
    { name: "last day of the window", targetDate: day(ALERT_DUE_SOON_WINDOW_DAYS), treatmentStatus: "In Progress", closureDate: null },
    { name: "first day after the window", targetDate: day(ALERT_DUE_SOON_WINDOW_DAYS + 1), treatmentStatus: "Not Started", closureDate: null },
    // D-04: the stored "Overdue" status is never read as a due state; only the dates decide.
    { name: "stored Overdue with a later target", targetDate: day(60), treatmentStatus: "Overdue", closureDate: null },
  ] as const;
  const created: Array<{ documentId: unknown; stage: string; expected: string; name: string }> = [];
  for (const [stage, assessment] of [["under-assessment", draft], ["released", fixtures.releaseFacts.complete]] as const) {
    for (const facts of boundaries) {
      const risk = await createRisk(assessment, {
        riskStatement: `${marker} ${stage} ${facts.name}`,
        targetDate: facts.targetDate,
        treatmentStatus: facts.treatmentStatus,
        closureDate: facts.closureDate,
      });
      created.push({ documentId: risk.documentId, stage, expected: deriveTreatmentDueState(facts, today), name: `${stage} ${facts.name}` });
    }
  }
  for (const state of TREATMENT_DUE_STATES) {
    for (const stage of ["under-assessment", "released"]) {
      assert.ok(created.some((risk) => risk.expected === state && risk.stage === stage), `DUE_FILTER_FIXTURE_MISSING_${state}_${stage}`);
    }
  }

  async function duePage(extra: Record<string, string>) {
    const query = new URLSearchParams({ q: marker, sort: "riskNumber:asc", pageSize: "50", ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_DUE_PAGE_FAILED_${JSON.stringify(extra)}: ${await response.clone().text()}`);
    const body = await payload(response);
    assertServedRegisterShape(body, `RISK_DUE_PAGE_${JSON.stringify(extra)}`);
    const data = rows(body);
    assert.equal((body.meta as { pagination: { total: number } }).pagination.total, data.length, `RISK_DUE_TOTAL_NOT_THE_PAGED_ROWS_${JSON.stringify(extra)}`);
    return data;
  }

  assert.equal((await duePage({})).length, created.length, "RISK_DUE_UNFILTERED_FIXTURES");
  for (const state of TREATMENT_DUE_STATES) {
    const listed = await duePage({ dueState: state });
    const expected = created.filter((risk) => risk.expected === state);
    assert.deepEqual(
      listed.map((row) => row.documentId),
      expected.map((risk) => risk.documentId),
      `RISK_DUE_STATE_${state}: expected ${expected.map((risk) => risk.name).join(", ")}`,
    );
    for (const row of listed) assert.equal(row.treatmentDueState, state, `RISK_DUE_ROW_STATE_${state}_${String(row.riskNumber)}`);
    for (const stage of ["under-assessment", "released"]) {
      assert.deepEqual(
        (await duePage({ dueState: state, stage })).map((row) => row.documentId),
        expected.filter((risk) => risk.stage === stage).map((risk) => risk.documentId),
        `RISK_DUE_STATE_NOT_ANDED_${state}_${stage}`,
      );
    }
  }
  // The server and this test read the clock on the same UTC day; a rollover mid-test shifts every boundary.
  assert.equal(utcToday(new Date()), today, "UTC_DAY_ROLLED_OVER_DURING_TEST");

  for (const invalid of ["Overdue", "due soon", "dueSoon"]) {
    const rejected = await request(`/api/v1/risks?${new URLSearchParams({ q: marker, dueState: invalid })}`, harness.identities.analyst);
    assert.equal(rejected.status, 400, `RISK_DUE_STATE_ACCEPTED_${invalid}`);
    assert.doesNotMatch(await rejected.text(), /SQL|stack|database|target_date|riskNumber|RSK-/i);
  }
});

/** Every Risk the whole register lists for a query, paged to the end; the total must equal the rows. */
async function registerTotal(extra: Record<string, string>): Promise<number> {
  const harness = await harnessPromise;
  const collected = new Set<unknown>();
  let total = 0;
  for (let page = 1; ; page += 1) {
    const query = new URLSearchParams({ sort: "riskNumber:asc", pageSize: "50", page: String(page), ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `REGISTER_TOTAL_PAGE_FAILED_${JSON.stringify(extra)}_${page}: ${await response.clone().text()}`);
    const body = await payload(response);
    const pagination = (body.meta as { pagination: { pageCount: number; total: number } }).pagination;
    total = pagination.total;
    for (const row of rows(body)) collected.add(row.documentId);
    if (page >= pagination.pageCount) break;
  }
  assert.equal(collected.size, total, `REGISTER_TOTAL_NOT_THE_ROWS_${JSON.stringify(extra)}`);
  return total;
}

async function reportFigures(reportKey: string): Promise<Record<string, any>> {
  const harness = await harnessPromise;
  const response = await request(`/api/v1/reports/${reportKey}`, harness.identities.analyst);
  assert.equal(response.status, 200, `REPORT_FAILED_${reportKey}: ${await response.clone().text()}`);
  return (await payload(response)).data as Record<string, any>;
}

test("mounted Risk Register preserves a full valid compound assessment label, even on an empty page", async () => {
  const harness = await harnessPromise;
  const title = "T".repeat(255);
  const assessmentNumber = "A".repeat(255);
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RISK-LONG-LABEL-REQUEST-001", title, requestStatus: "under-review", requestor: "owner",
  });
  const assessmentId = await harness.createAssessmentFixture({
    assessmentNumber, assessmentStatus: "draft", assessmentRequest: requestId,
  });
  const risk = await createRisk(assessmentId, { riskStatement: "Long compound assessment label fixture" });
  for (const empty of [false, true]) {
    const query = new URLSearchParams({ assessment: assessmentId });
    if (empty) query.set("q", "no-risk-matches-this-compound-label-filter");
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200);
    const body = await payload(response);
    assertServedRegisterShape(body, "RISK_LONG_ASSESSMENT_LABEL");
    assert.deepEqual(rows(body).map((row) => row.documentId), empty ? [] : [risk.documentId]);
    const selected = (body.meta as { selectedLabels: { assessment: { documentId: string; label: string } } }).selectedLabels.assessment;
    assert.deepEqual(selected, { documentId: assessmentId, label: `${assessmentNumber} · ${title}` });
    assert.equal(selected.label.length, 513);
  }
});

/*
 * D-02 item 3, D-35, research Pitfall 11: a figure that counts Risks with no rating or no treatment status opens
 * the register's "none" value. A rating is "none" when it is null or off the Low to Critical ladder; a treatment
 * status when it is null or off the JDL vocabulary. Over the open register, each total equals the report's.
 */
test("mounted Risk Register lists the Risks with no rating or treatment status, as the reports count them (D-35)", async () => {
  const harness = await harnessPromise;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RISK-NONE-FILTER-REQUEST-001",
    title: "Risk none filter request",
    requestStatus: "under-review",
    requestor: "owner",
  });
  const draft = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-RISK-NONE-FILTER-001",
    assessmentStatus: "draft",
    assessmentRequest: requestId,
  });
  const marker = "None filter fixture";
  const noResidual = await createRisk(draft, { riskStatement: `${marker} one`, residualRating: null, inherentRating: "Low", treatmentStatus: null });
  const offResidual = await createRisk(draft, { riskStatement: `${marker} two`, residualRating: "Extreme", inherentRating: null, treatmentStatus: "In Progress" });
  const offInherent = await createRisk(draft, { riskStatement: `${marker} three`, residualRating: "High", inherentRating: "Extreme", treatmentStatus: "Overdue" });
  const rated = await createRisk(draft, { riskStatement: `${marker} four`, residualRating: "Low", inherentRating: "Critical", treatmentStatus: "Complete" });
  // A legacy status off the JDL vocabulary, which the Document Service would refuse.
  await harness.writeStoredValueFixture("csrm_risks", String(offResidual.documentId), "treatment_status", "Deferred");
  // CR-101, WR-103: a legacy treatment action off the JDL vocabulary (lowercase), which the Document Service would refuse.
  await harness.writeStoredValueFixture("csrm_risks", String(offInherent.documentId), "treatment_action", "accept");

  async function nonePage(extra: Record<string, string>) {
    const query = new URLSearchParams({ q: marker, sort: "riskNumber:asc", pageSize: "50", ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_NONE_PAGE_FAILED_${JSON.stringify(extra)}: ${await response.clone().text()}`);
    const body = await payload(response);
    assertServedRegisterShape(body, `RISK_NONE_${JSON.stringify(extra)}`);
    const data = rows(body);
    for (const field of ["inherentRating", "residualRating", "treatmentStatus"]) {
      if (extra[field] === "none") assert.ok(data.every((row) => row[field] === null), `RISK_NONE_${field}_NOT_NULL`);
    }
    const legacyAction = data.find((row) => row.documentId === offInherent.documentId);
    if (legacyAction) assert.equal(legacyAction.treatmentAction, null, "RISK_LEGACY_TREATMENT_ACTION_NOT_NONE");
    assert.equal((body.meta as { pagination: { total: number } }).pagination.total, data.length, `RISK_NONE_TOTAL_NOT_THE_PAGED_ROWS_${JSON.stringify(extra)}`);
    return data.map((row) => row.documentId);
  }

  assert.deepEqual(await nonePage({ residualRating: "none" }), [noResidual.documentId, offResidual.documentId], "RISK_NONE_RESIDUAL");
  assert.deepEqual(await nonePage({ inherentRating: "none" }), [offResidual.documentId, offInherent.documentId], "RISK_NONE_INHERENT");
  assert.deepEqual(await nonePage({ treatmentStatus: "none" }), [noResidual.documentId, offResidual.documentId], "RISK_NONE_TREATMENT_STATUS");
  assert.deepEqual(await nonePage({ residualRating: "High" }), [offInherent.documentId], "RISK_RATED_RESIDUAL_UNCHANGED");
  assert.deepEqual(await nonePage({ residualRating: "none", treatmentStatus: "none" }), [noResidual.documentId, offResidual.documentId], "RISK_NONE_NOT_ANDED");
  assert.deepEqual(await nonePage({ inherentRating: "none", residualRating: "none" }), [offResidual.documentId], "RISK_NONE_BOTH_RATINGS");
  assert.ok(!(await nonePage({ treatmentStatus: "none" })).includes(rated.documentId), "RISK_NONE_LISTED_A_RECORDED_STATUS");

  // CR-101: each legacy record a "none" list holds opens, its off-vocabulary values served as not provided.
  const residualDetail = await assertLegacyDetailOpens(String(offResidual.documentId), "RISK_NONE_RESIDUAL_RECORD");
  assert.deepEqual([residualDetail.residualRating, residualDetail.treatmentStatus], [null, null], "RISK_NONE_RESIDUAL_RECORD_VALUES");
  const inherentDetail = await assertLegacyDetailOpens(String(offInherent.documentId), "RISK_NONE_INHERENT_RECORD");
  assert.deepEqual([inherentDetail.inherentRating, inherentDetail.treatmentAction], [null, null], "RISK_NONE_INHERENT_RECORD_VALUES");

  // Over the whole open register, each "none" list equals the report figure that links to it. The exposure
  // report counts each stage apart (D-42), so its lists carry the stage; treatment performance keeps both (D-43).
  const exposure = await reportFigures("risk-exposure");
  const performance = await reportFigures("treatment-performance");
  assert.equal(await registerTotal({ residualRating: "none", state: "open", stage: "released" }), exposure.byResidualRating.notRated, "RISK_NONE_RESIDUAL_NOT_THE_REPORT");
  assert.equal(await registerTotal({ inherentRating: "none", state: "open", stage: "released" }), exposure.byInherentRating.notRated, "RISK_NONE_INHERENT_NOT_THE_REPORT");
  assert.equal(
    await registerTotal({ residualRating: "none", state: "open", stage: "under-assessment" }),
    exposure.underAssessment.byResidualRating.notRated,
    "RISK_NONE_UNDER_ASSESSMENT_NOT_THE_REPORT",
  );
  assert.equal(await registerTotal({ treatmentStatus: "none", state: "open" }), performance.treatmentStatus.notProvided, "RISK_NONE_STATUS_NOT_THE_REPORT");
  // This test's fixtures sit on a draft, so they count under assessment.
  assert.ok(exposure.underAssessment.byResidualRating.notRated >= 2 && performance.treatmentStatus.notProvided >= 2, "RISK_NONE_REPORT_FIXTURES_UNCOUNTED");
});

/*
 * D-02 item 3, D-35, research Pitfall 21: the register lists Risks by whether any mitigation control exists, by
 * a mitigation control's effectiveness, and by having no impacted Information System. impactedSystem is its own
 * key, so an Information System whose documentId is "none" can never collide with the no-system rule.
 */
test("mounted Risk Register lists Risks by mitigation control, its effectiveness and no impacted system (D-35)", async () => {
  const harness = await harnessPromise;
  const fixtures = await harness.seedAssessmentWorkflowFixtures();
  const requestFixtures = await harness.seedRequestWorkflowFixtures();
  const system = requestFixtures.relations.informationSystem;
  const control = fixtures.aggregate.control;
  const requestId = await harness.createAssessmentRequestFixture({
    requestNumber: "RISK-FIGURE-FILTER-REQUEST-001",
    title: "Risk figure filter request",
    requestStatus: "under-review",
    requestor: "owner",
  });
  const draft = await harness.createAssessmentFixture({
    assessmentNumber: "ASM-RISK-FIGURE-FILTER-001",
    assessmentStatus: "draft",
    assessmentRequest: requestId,
  });
  const marker = "Figure filter fixture";
  const bare = await createRisk(draft, { riskStatement: `${marker} bare` });
  const effective = await createRisk(draft, { riskStatement: `${marker} effective`, informationSystemImpacted: system });
  await harness.createRiskRegisterMitigationFixture(String(effective.documentId), control, "Implemented", { effectivenessRating: "Effective" });
  const mixed = await createRisk(draft, { riskStatement: `${marker} mixed` });
  await harness.createRiskRegisterMitigationFixture(String(mixed.documentId), control, "Planned", { effectivenessRating: "Ineffective" });
  await harness.createRiskRegisterMitigationFixture(String(mixed.documentId), control, "Existing");
  const legacy = await createRisk(draft, { riskStatement: `${marker} legacy`, informationSystemImpacted: system });
  const legacyImplementation = await harness.createRiskRegisterMitigationFixture(String(legacy.documentId), control, "Existing", { effectivenessRating: "Not Assessed" });
  // A legacy rating off the JDL vocabulary, which the Document Service would refuse.
  await harness.writeStoredValueFixture("csrm_control_implementations", legacyImplementation, "effectiveness_rating", "Unrated");

  async function figurePage(extra: Record<string, string>) {
    const query = new URLSearchParams({ q: marker, sort: "riskNumber:asc", pageSize: "50", ...extra });
    const response = await request(`/api/v1/risks?${query}`, harness.identities.analyst);
    assert.equal(response.status, 200, `RISK_FIGURE_PAGE_FAILED_${JSON.stringify(extra)}: ${await response.clone().text()}`);
    const body = await payload(response);
    assertServedRegisterShape(body, `RISK_FIGURE_PAGE_${JSON.stringify(extra)}`);
    const data = rows(body);
    assert.equal((body.meta as { pagination: { total: number } }).pagination.total, data.length, `RISK_FIGURE_TOTAL_NOT_THE_PAGED_ROWS_${JSON.stringify(extra)}`);
    return { ids: data.map((row) => row.documentId), body };
  }
  const ids = async (extra: Record<string, string>) => (await figurePage(extra)).ids;

  // A Risk with two mitigation controls is listed once.
  assert.deepEqual(await ids({ mitigationStatus: "any" }), [effective.documentId, mixed.documentId, legacy.documentId], "RISK_ANY_MITIGATION");
  assert.deepEqual(await ids({ mitigationStatus: "none" }), [bare.documentId], "RISK_NO_MITIGATION");
  assert.deepEqual(await ids({ mitigationEffectiveness: "Effective" }), [effective.documentId], "RISK_EFFECTIVE");
  assert.deepEqual(await ids({ mitigationEffectiveness: "Ineffective" }), [mixed.documentId], "RISK_INEFFECTIVE");
  assert.deepEqual(await ids({ mitigationEffectiveness: "Partially Effective" }), [], "RISK_PARTIALLY_EFFECTIVE");
  assert.deepEqual(await ids({ mitigationEffectiveness: "Not Assessed" }), [], "RISK_NOT_ASSESSED");
  assert.deepEqual(await ids({ mitigationEffectiveness: "none" }), [mixed.documentId, legacy.documentId], "RISK_EFFECTIVENESS_NOT_RECORDED");
  // CR-101: the legacy record the "Not provided" effectiveness list holds opens, its rating served as not provided.
  const legacyDetail = await assertLegacyDetailOpens(String(legacy.documentId), "RISK_EFFECTIVENESS_NOT_RECORDED_RECORD");
  assert.deepEqual(
    (legacyDetail.controlImplementations as Array<Record<string, unknown>>).map((implementation) => implementation.effectivenessRating),
    [null],
    "RISK_EFFECTIVENESS_NOT_RECORDED_RECORD_VALUE",
  );
  assert.deepEqual(await ids({ impactedSystem: "none" }), [bare.documentId, mixed.documentId], "RISK_NO_IMPACTED_SYSTEM");
  assert.deepEqual(await ids({ system }), [effective.documentId, legacy.documentId], "RISK_IMPACTED_SYSTEM");
  assert.deepEqual(await ids({ impactedSystem: "none", mitigationStatus: "any" }), [mixed.documentId], "RISK_FIGURE_NOT_ANDED");
  // system stays an id search: "none" is an opaque documentId, never the no-system rule.
  assert.deepEqual(await ids({ system: "none" }), [], "RISK_SYSTEM_NONE_IS_AN_ID");

  const conflicting = await request(`/api/v1/risks?${new URLSearchParams({ q: marker, impactedSystem: "none", system })}`, harness.identities.analyst);
  assert.equal(conflicting.status, 400, "RISK_IMPACTED_SYSTEM_WITH_SYSTEM_ACCEPTED");
  assert.doesNotMatch(await conflicting.text(), /SQL|stack|database|information_system|riskNumber|RSK-/i);

  // D-32, UI-SPEC section 7.4: the Related assessment label reads its number, then its request title.
  const labelled = await figurePage({ assessment: draft });
  assert.equal(labelled.ids.length, 4, "RISK_FIGURE_ASSESSMENT_ROWS");
  assert.deepEqual(
    (labelled.body.meta as { selectedLabels: Record<string, unknown> }).selectedLabels.assessment,
    { documentId: draft, label: "ASM-RISK-FIGURE-FILTER-001 · Risk figure filter request" },
    "RISK_ASSESSMENT_LABEL_WITHOUT_ITS_REQUEST_TITLE",
  );
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
  assert.equal("aiProvenance" in detail, false);
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
