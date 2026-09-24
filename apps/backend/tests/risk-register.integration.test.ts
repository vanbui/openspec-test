import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());
let fixtureSequence = 0;

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
  assert.deepEqual(Object.keys(data[0]).sort(), [
    "assessment", "documentId", "inherentRating", "residualRating", "riskNumber", "riskStatement",
    "targetDate", "treatmentOwner", "treatmentStatus",
  ]);
  assert.deepEqual((body.meta as Record<string, Record<string, unknown>>).pagination, {
    page: 1, pageSize: 10, pageCount: 1, total: 1,
  });
  assert.deepEqual(Object.keys((body.meta as Record<string, Record<string, unknown>>).selectedLabels).sort(), [
    "assessment", "asset", "riskOwner", "system", "treatmentOwner",
  ]);
  assert.doesNotMatch(JSON.stringify(body), /email|username|createdAt|updatedAt|publishedAt|createdBy|updatedBy|\"id\":|evidence/i);

  const none = await request(
    `/api/v1/risks?assessment=${encodeURIComponent(fixtures.releaseFacts.unreleased)}&mitigationStatus=No+mitigation+controls`,
    harness.identities.analyst,
  );
  assert.equal(none.status, 200);
  assert.equal(rows(await payload(none)).some((row) => row.documentId === created.documentId), false, "NO_MITIGATION_TREATED_STATUS_NULL");
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
    const ratingPage = await registerPage(fixtures.concurrency.assessment, `inherentRating:${direction}`, 1, 25);
    const rank = (value: unknown) => value === null ? 5 : ["Low", "Moderate", "High", "Critical"].indexOf(String(value)) + 1;
    const values = ratingPage.data.map((row) => rank(row.inherentRating));
    const expected = [...values].sort((left, right) => direction === "asc" ? left - right : right - left);
    assert.deepEqual(values, expected, `SEMANTIC_RATING_ORDER_FAILED_${direction}`);

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
