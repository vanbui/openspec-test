import assert from "node:assert/strict";
import test from "node:test";

import {
  parseRiskRegisterQuery,
  RISK_REGISTER_STATES,
  RiskRegisterQueryError,
} from "../src/api/csrm-risk/services/risk-register-query";
import {
  assertRiskRegisterScope,
  getRiskRegisterDetail,
  listRiskRegister,
  projectRiskRegisterItem,
  RiskRegisterError,
  type RiskRegisterDetailRepository,
  type RiskRegisterRepository,
} from "../src/api/csrm-risk/services/risk-register";

/* The UTC calendar date every register read below is evaluated on. */
const today = "2026-09-24";

const ratings = ["Low", "Moderate", "High", "Critical"] as const;
const treatmentStatuses = ["Not Started", "In Progress", "Overdue", "Complete"] as const;
const mitigationStatuses = ["Existing", "Planned", "Implemented", "Retired", "none"] as const;
const sorts = [
  "riskNumber",
  "riskStatement",
  "inherentRating",
  "residualRating",
  "treatmentStatus",
  "treatmentOwner",
  "targetDate",
  "assessment",
] as const;

const state = { csrmAuthorization: { riskRegisterCollectionScope: "all" } };

test("the Risk Register parser accepts the complete flat UI contract", () => {
  assert.deepEqual(parseRiskRegisterQuery({}), {
    filters: {},
    sort: { field: "targetDate", direction: "asc" },
    page: 1,
    pageSize: 25,
  });

  assert.deepEqual(parseRiskRegisterQuery({
    q: "  RSK material exposure  ",
    treatmentStatus: "In Progress",
    inherentRating: "Critical",
    residualRating: "Moderate",
    riskOwner: "owner_document-01",
    treatmentOwner: "treatment-owner_02",
    assessment: "assessment-document-03",
    system: "system-document-04",
    asset: "asset-document-05",
    mitigationStatus: "No mitigation controls",
    targetDateFrom: "2026-02-28",
    targetDateTo: "2028-02-29",
    sort: "assessment:desc",
    page: "7",
    pageSize: "50",
  }), {
    filters: {
      q: "RSK material exposure",
      treatmentStatus: "In Progress",
      inherentRating: "Critical",
      residualRating: "Moderate",
      riskOwner: "owner_document-01",
      treatmentOwner: "treatment-owner_02",
      assessment: "assessment-document-03",
      system: "system-document-04",
      asset: "asset-document-05",
      mitigationStatus: "none",
      targetDateFrom: "2026-02-28",
      targetDateTo: "2028-02-29",
    },
    sort: { field: "assessment", direction: "desc" },
    page: 7,
    pageSize: 50,
  });

  for (const rating of ratings) {
    assert.equal(parseRiskRegisterQuery({ inherentRating: rating }).filters.inherentRating, rating);
    assert.equal(parseRiskRegisterQuery({ residualRating: rating }).filters.residualRating, rating);
  }
  for (const treatmentStatus of treatmentStatuses) {
    assert.equal(parseRiskRegisterQuery({ treatmentStatus }).filters.treatmentStatus, treatmentStatus);
  }
  for (const mitigationStatus of mitigationStatuses) {
    assert.equal(parseRiskRegisterQuery({ mitigationStatus }).filters.mitigationStatus, mitigationStatus);
  }
  assert.equal(parseRiskRegisterQuery({ mitigationStatus: "No mitigation controls" }).filters.mitigationStatus, "none");
  for (const field of sorts) {
    for (const direction of ["asc", "desc"] as const) {
      assert.deepEqual(parseRiskRegisterQuery({ sort: `${field}:${direction}` }).sort, { field, direction });
    }
  }
  for (const pageSize of [10, 25, 50] as const) {
    assert.equal(parseRiskRegisterQuery({ pageSize }).pageSize, pageSize);
  }
});

test("the Risk Register parser accepts exactly the open and closed Risk states (D-36)", () => {
  assert.deepEqual([...RISK_REGISTER_STATES], ["open", "closed"]);
  assert.equal(parseRiskRegisterQuery({ state: "open" }).filters.state, "open");
  assert.equal(parseRiskRegisterQuery({ state: "closed" }).filters.state, "closed");
  // Absent means both, so no state predicate is recorded at all.
  assert.equal("state" in parseRiskRegisterQuery({}).filters, false);
  assert.deepEqual(parseRiskRegisterQuery({ state: "open", residualRating: "High" }).filters, { state: "open", residualRating: "High" });

  for (const invalid of ["Open", "CLOSED", "", " open", "all", "none", ["open", "closed"], ["open"], { $eq: "open" }, { $ne: "closed" }, null, true, 1]) {
    assert.throws(() => parseRiskRegisterQuery({ state: invalid }), RiskRegisterQueryError, JSON.stringify(invalid));
  }
});

test("the Risk Register parser accepts inclusive one-sided, closed, and equal date ranges", () => {
  assert.deepEqual(parseRiskRegisterQuery({ targetDateFrom: "2026-01-01" }).filters, {
    targetDateFrom: "2026-01-01",
  });
  assert.deepEqual(parseRiskRegisterQuery({ targetDateTo: "2026-12-31" }).filters, {
    targetDateTo: "2026-12-31",
  });
  assert.deepEqual(parseRiskRegisterQuery({ targetDateFrom: "2028-02-29", targetDateTo: "2028-02-29" }).filters, {
    targetDateFrom: "2028-02-29",
    targetDateTo: "2028-02-29",
  });
});

test("the Risk Register parser rejects expansion, duplicate or invalid dates, and unbounded values", () => {
  const invalid: unknown[] = [
    null,
    [],
    { unknown: "value" },
    { targetDateFrom: "" },
    { targetDateFrom: "2026-1-01" },
    { targetDateFrom: "2026-01-01T00:00:00Z" },
    { targetDateFrom: "2026-02-29" },
    { targetDateFrom: "2026-13-01" },
    { targetDateFrom: ["2026-01-01", "2026-01-02"] },
    { targetDateTo: 20260101 },
    { targetDateTo: "20260-01-01" },
    { targetDateFrom: "2026-12-31", targetDateTo: "2026-01-01" },
    { q: ["one", "two"] },
    { treatmentStatus: ["Complete"] },
    { page: ["1", "2"] },
    { q: "" },
    { q: " ".repeat(201) },
    { riskOwner: "with spaces" },
    { treatmentOwner: "x".repeat(201) },
    { assessment: "" },
    { inherentRating: "Very High" },
    { residualRating: "Unknown" },
    { treatmentStatus: "Closed" },
    { mitigationStatus: "Draft" },
    { sort: "createdAt:desc" },
    { sort: "riskNumber" },
    { sort: "riskNumber:sideways" },
    { sort: "riskNumber:asc:extra" },
    { page: 0 },
    { page: 1.5 },
    { page: 1_000_001 },
    { pageSize: 1 },
    { pageSize: 100 },
    { populate: "*" },
    { filters: { riskNumber: { $ne: "missing" } } },
  ];

  for (const query of invalid) {
    assert.throws(() => parseRiskRegisterQuery(query), RiskRegisterQueryError, JSON.stringify(query));
  }
});

test("scope is asserted before repository count or page selection", async () => {
  let calls = 0;
  const repository: RiskRegisterRepository = {
    async count() { calls += 1; return 0; },
    async selectPage() { calls += 1; return []; },
    async hydrate() { calls += 1; return []; },
  };

  assert.throws(() => assertRiskRegisterScope({}), /denied/i);
  await assert.rejects(
    listRiskRegister({ repository, state: {}, query: {}, today }),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 403,
  );
  // Scope is still decided first when the date is malformed as well.
  await assert.rejects(
    listRiskRegister({ repository, state: {}, query: {}, today: "not-a-date" }),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 403,
  );
  assert.equal(calls, 0, "DENIED_RISK_REGISTER_TOUCHED_REPOSITORY");
});

test("the register list requires a UTC calendar today before any repository read", async () => {
  let calls = 0;
  const repository: RiskRegisterRepository = {
    async count() { calls += 1; return 0; },
    async selectPage() { calls += 1; return []; },
    async hydrate() { calls += 1; return []; },
  };

  for (const invalid of ["", "2026-9-24", "2026-02-30", "2026-09-24T00:00:00.000Z", "24/09/2026", undefined, null, 20260924]) {
    await assert.rejects(
      listRiskRegister({ repository, state, query: {}, today: invalid as unknown as string }),
      (error: unknown) => error instanceof RiskRegisterError && error.status === 400,
      `INVALID_TODAY_ACCEPTED_${String(invalid)}`,
    );
  }
  assert.equal(calls, 0, "INVALID_TODAY_TOUCHED_REPOSITORY");
});

test("the register list evaluates every row's due state on the today it is given", async () => {
  const repository: RiskRegisterRepository = {
    async count() { return 1; },
    async selectPage() { return ["risk-a"]; },
    // Target date 2027-01-31, In Progress, no closure date.
    async hydrate() { return [riskDocument("risk-a", "RSK-001")]; },
  };
  for (const [evaluatedOn, expected] of [
    ["2026-09-24", "later"],
    ["2027-01-17", "due-soon"],
    ["2027-01-31", "due-soon"],
    ["2027-02-01", "overdue"],
  ] as const) {
    const result = await listRiskRegister({ repository, state, query: {}, today: evaluatedOn });
    assert.equal(result.data[0]?.treatmentDueState, expected, `DUE_STATE_NOT_EVALUATED_ON_${evaluatedOn}`);
  }
});

test("the register projection derives the D-04 treatment due state from explicit facts", () => {
  const cases: ReadonlyArray<{ facts: Record<string, unknown>; expected: string; name: string }> = [
    { name: "past target, in progress", facts: { targetDate: "2026-09-23", treatmentStatus: "In Progress", closureDate: null }, expected: "overdue" },
    { name: "due today", facts: { targetDate: "2026-09-24", treatmentStatus: "In Progress" }, expected: "due-soon" },
    { name: "last day of the 14-day window", facts: { targetDate: "2026-10-08", treatmentStatus: "In Progress" }, expected: "due-soon" },
    { name: "first day after the window", facts: { targetDate: "2026-10-09", treatmentStatus: "In Progress" }, expected: "later" },
    { name: "no target date", facts: { targetDate: null, treatmentStatus: "In Progress" }, expected: "no-target-date" },
    { name: "complete with a past target", facts: { targetDate: "2026-09-23", treatmentStatus: "Complete" }, expected: "complete-or-closed" },
    { name: "closed with a past target", facts: { targetDate: "2026-09-23", treatmentStatus: "In Progress", closureDate: "2026-09-20" }, expected: "complete-or-closed" },
    { name: "no recorded status with a past target", facts: { targetDate: "2026-09-23", treatmentStatus: null }, expected: "overdue" },
    // The stored "Overdue" status is never read as a due state (D-04): only the dates decide.
    { name: "stored Overdue status with a later target", facts: { targetDate: "2026-12-01", treatmentStatus: "Overdue" }, expected: "later" },
    // A field that is not a string counts as absent.
    { name: "non-string target date", facts: { targetDate: 20260923, treatmentStatus: "In Progress" }, expected: "no-target-date" },
    { name: "non-string closure date", facts: { targetDate: "2026-09-23", treatmentStatus: "In Progress", closureDate: { date: "2026-09-20" } }, expected: "overdue" },
    { name: "non-string treatment status", facts: { targetDate: "2026-09-23", treatmentStatus: { value: "Complete" } }, expected: "overdue" },
  ];
  for (const scenario of cases) {
    const projected = projectRiskRegisterItem({ ...riskDocument("risk-1", "RSK-001"), ...scenario.facts }, today);
    assert.equal(projected.treatmentDueState, scenario.expected, scenario.name);
  }
});

test("list uses one parsed filter model, bounded page IDs, and restores database order", async () => {
  const observed: Array<{ operation: string; value: unknown }> = [];
  const repository: RiskRegisterRepository = {
    async count(filters: unknown) {
      observed.push({ operation: "count", value: filters });
      return 3;
    },
    async selectPage(input: unknown) {
      observed.push({ operation: "page", value: input });
      return ["risk-c", "risk-a"];
    },
    async hydrate(documentIds: readonly string[]) {
      observed.push({ operation: "hydrate", value: documentIds });
      return [
        riskDocument("risk-a", "RSK-001"),
        riskDocument("risk-c", "RSK-003"),
      ];
    },
  };

  const result = await listRiskRegister({
    repository,
    state,
    query: { q: "exposure", treatmentStatus: "Complete", sort: "inherentRating:desc", page: 2, pageSize: 10 },
    today,
  });

  assert.deepEqual(observed[0], { operation: "count", value: { q: "exposure", treatmentStatus: "Complete" } });
  assert.deepEqual(observed[1], {
    operation: "page",
    value: {
      filters: observed[0].value,
      sort: { field: "inherentRating", direction: "desc" },
      offset: 10,
      limit: 10,
    },
  });
  assert.deepEqual(observed[2], { operation: "hydrate", value: ["risk-c", "risk-a"] });
  assert.deepEqual(result.data.map((row: { documentId: string }) => row.documentId), ["risk-c", "risk-a"]);
  assert.deepEqual(result.meta.pagination, { page: 2, pageSize: 10, pageCount: 1, total: 3 });
});

test("honest pagination covers empty, exact, overflow, partial, and out-of-range totals", async () => {
  for (const scenario of [
    { total: 0, page: 1, pageSize: 10, ids: [] },
    { total: 1, page: 1, pageSize: 10, ids: ["risk-1"] },
    { total: 10, page: 1, pageSize: 10, ids: Array.from({ length: 10 }, (_, index) => `risk-${index}`) },
    { total: 11, page: 2, pageSize: 10, ids: ["risk-10"] },
    { total: 26, page: 2, pageSize: 25, ids: ["risk-25"] },
    { total: 11, page: 99, pageSize: 10, ids: [] },
  ] as const) {
    const repository: RiskRegisterRepository = {
      async count() { return scenario.total; },
      async selectPage() { return [...scenario.ids]; },
      async hydrate(ids: readonly string[]) { return ids.map((id) => riskDocument(id, id.toUpperCase())); },
    };
    const result = await listRiskRegister({
      repository,
      state,
      query: { page: scenario.page, pageSize: scenario.pageSize },
      today,
    });
    assert.equal(result.meta.pagination.total, scenario.total);
    assert.equal(result.meta.pagination.pageCount, Math.ceil(scenario.total / scenario.pageSize));
    assert.equal(result.data.length, scenario.ids.length);
  }
});

test("register projection is a closed positive allowlist", () => {
  const projected = projectRiskRegisterItem({
    ...riskDocument("risk-1", "RSK-001"),
    id: 42,
    createdAt: "2026-01-01",
    updatedAt: "2026-01-02",
    createdBy: { email: "secret@example.test" },
    riskOwner: { id: 99, documentId: "owner", displayName: "Risk owner", email: "secret@example.test" },
    controlImplementations: [{ id: 12, evidence: "private" }],
    closureDate: null,
  }, today);

  // The nine Phase 5 keys plus the server-derived treatment due state (D-26); closureDate
  // is read to derive it but never disclosed.
  assert.deepEqual(Object.keys(projected).sort(), [
    "assessment",
    "documentId",
    "inherentRating",
    "residualRating",
    "riskNumber",
    "riskStatement",
    "targetDate",
    "treatmentDueState",
    "treatmentOwner",
    "treatmentStatus",
  ]);
  assert.equal(projected.treatmentDueState, "later");
  assert.deepEqual(projected.treatmentOwner, { documentId: "treatment-owner", displayName: "Treatment Owner" });
  assert.deepEqual(projected.assessment, { documentId: "assessment-1", assessmentNumber: "ASM-001", title: "Assessment title" });
  assert.doesNotMatch(JSON.stringify(projected), /secret|email|createdAt|updatedAt|\"id\":|controlImplementations|closureDate/i);
});

test("detail scope is asserted before the caller-selected Risk identifier is looked up", async () => {
  let calls = 0;
  const repository: RiskRegisterDetailRepository = {
    async findRisk() { calls += 1; return null; },
    async findControlImplementations() { calls += 1; return []; },
  };

  for (const deniedState of [{}, { csrmAuthorization: {} }, null]) {
    await assert.rejects(
      getRiskRegisterDetail({ repository, state: deniedState, riskDocumentId: "existing-risk" }),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 403,
    );
  }
  assert.equal(calls, 0, "DENIED_RISK_DETAIL_TOUCHED_REPOSITORY");
});

test("detail projects every Risk group and bounded relation summary as one closed aggregate", async () => {
  const repository = detailRepository(detailRiskDocument(), [detailControlImplementation()]);
  const detail = await getRiskRegisterDetail({ repository, state, riskDocumentId: "risk-detail-1" });

  assert.deepEqual(Object.keys(detail).sort(), [
    "assessment", "closureDate", "comments", "controlEffectiveness", "controlImplementations", "dataClassification",
    "documentId", "escalationDetails", "exemptionReviewDate", "highestInherentConsequence", "highestResidualConsequence",
    "identifiedDate", "informationAssetImpacted", "informationSystemImpacted", "inherentLikelihood", "inherentRating",
    "inherentRatingRationale", "isExempted", "issueStatement", "parentLock", "potentialImpact", "residualLikelihood",
    "residualRating", "residualRatingRationale", "riskCategory", "riskCause", "riskCommunicationDate", "riskNumber",
    "riskOwner", "riskStatement", "riskSubCategory", "riskType", "riskVelocity", "targetDate", "treatmentAction",
    "treatmentOwner", "treatmentPlan", "treatmentResolveDate", "treatmentStatus",
  ].sort());
  assert.equal(detail.parentLock, "mutable");
  assert.deepEqual(detail.riskType, { documentId: "risk-type-1", name: "Internet exposure", description: "External attack surface" });
  assert.deepEqual(detail.riskOwner, { documentId: "owner-1", displayName: "Risk Owner" });
  assert.deepEqual(detail.treatmentOwner, { documentId: "treatment-owner-1", displayName: "Treatment Owner" });
  assert.deepEqual(detail.informationSystemImpacted, { documentId: "system-1", name: "Customer portal" });
  assert.deepEqual(detail.informationAssetImpacted, { documentId: "asset-1", name: "Customer records" });
  assert.deepEqual(detail.assessment, { documentId: "assessment-1", assessmentNumber: "ASM-001", title: "Internet-facing service" });
  assert.deepEqual(detail.controlImplementations, [{
    documentId: "implementation-1",
    control: { documentId: "control-1", controlNumber: "CTRL-001", name: "Boundary protection" },
    controlOwner: { documentId: "control-owner-1", displayName: "Control Owner" },
    controlStatus: "Implemented",
    effectivenessRating: "Effective",
    evidence: "Validated configuration",
    implementationDueDate: "2026-09-30",
    implementedDate: "2026-08-01",
    reviewDate: "2027-08-01",
  }]);
  assert.doesNotMatch(JSON.stringify(detail), /secret@example|username|createdAt|updatedAt|publishedAt|createdBy|updatedBy|requestor|"id":/i);
});

test("detail accepts only complete mutable or released parent facts", async () => {
  const combinations: ReadonlyArray<{
    approved: boolean;
    approvedBy: boolean;
    approvalDate: boolean;
    expected?: "mutable" | "released";
  }> = [
    { approved: false, approvedBy: false, approvalDate: false, expected: "mutable" },
    { approved: true, approvedBy: true, approvalDate: true, expected: "released" },
    { approved: true, approvedBy: false, approvalDate: false },
    { approved: false, approvedBy: true, approvalDate: false },
    { approved: false, approvedBy: false, approvalDate: true },
    { approved: true, approvedBy: true, approvalDate: false },
    { approved: true, approvedBy: false, approvalDate: true },
    { approved: false, approvedBy: true, approvalDate: true },
  ] as const;

  for (const combination of combinations) {
    const document = detailRiskDocument();
    document.assessment = {
      ...(document.assessment as Record<string, unknown>),
      assessmentStatus: combination.approved ? "approved" : "in-review",
      approvedBy: combination.approvedBy ? { documentId: "analyst-1" } : null,
      approvalDate: combination.approvalDate ? "2026-08-30T00:00:00.000Z" : null,
    };
    const action = getRiskRegisterDetail({ repository: detailRepository(document, []), state, riskDocumentId: "risk-detail-1" });
    if (combination.expected) {
      assert.equal((await action).parentLock, combination.expected);
    } else {
      await assert.rejects(action, (error: unknown) => error instanceof Error && "status" in error && error.status === 404);
    }
  }

  const malformedReleased = detailRiskDocument();
  malformedReleased.assessment = {
    ...(malformedReleased.assessment as Record<string, unknown>),
    assessmentStatus: "approved",
    approvedBy: { documentId: "analyst-1" },
    approvalDate: "not-a-date",
  };
  await assert.rejects(
    getRiskRegisterDetail({ repository: detailRepository(malformedReleased, []), state, riskDocumentId: "risk-detail-1" }),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 404,
  );
});

test("detail descendant bounds and malformed relations fail the complete aggregate without partial data", async () => {
  const malformed = [
    { field: "assessment", value: null },
    { field: "riskType", value: { documentId: "risk-type-1", name: null } },
    { field: "riskOwner", value: { documentId: "owner-1", displayName: null } },
    { field: "informationSystemImpacted", value: { documentId: "system-1", name: null } },
  ] as const;
  for (const scenario of malformed) {
    const document = detailRiskDocument();
    document[scenario.field] = scenario.value;
    await assert.rejects(
      getRiskRegisterDetail({ repository: detailRepository(document, []), state, riskDocumentId: "risk-detail-1" }),
      (error: unknown) => error instanceof Error && "status" in error && error.status === 404,
    );
  }

  let requestedLimit = 0;
  const repository = detailRepository(
    detailRiskDocument(),
    Array.from({ length: 1_001 }, (_, index) => detailControlImplementation(`implementation-${index}`)),
    (limit) => { requestedLimit = limit; },
  );
  await assert.rejects(
    getRiskRegisterDetail({ repository, state, riskDocumentId: "risk-detail-1" }),
    (error: unknown) => error instanceof Error && "status" in error && error.status === 404,
  );
  assert.equal(requestedLimit, 1_001, "RISK_DETAIL_DESCENDANT_PLUS_ONE_PROBE_MISSING");
});

function riskDocument(documentId: string, riskNumber: string): Record<string, unknown> {
  return {
    documentId,
    riskNumber,
    riskStatement: `${riskNumber} statement`,
    inherentRating: "High",
    residualRating: "Moderate",
    treatmentStatus: "In Progress",
    treatmentOwner: { documentId: "treatment-owner", displayName: "Treatment Owner" },
    targetDate: "2027-01-31",
    assessment: {
      documentId: "assessment-1",
      assessmentNumber: "ASM-001",
      assessmentRequest: { title: "Assessment title" },
    },
  };
}

function detailRepository(
  risk: Record<string, unknown> | null,
  implementations: Record<string, unknown>[],
  observeLimit?: (limit: number) => void,
): RiskRegisterDetailRepository {
  return {
    async findRisk(documentId: string) {
      assert.equal(documentId, "risk-detail-1");
      return risk;
    },
    async findControlImplementations(documentId: string, limit: number) {
      assert.equal(documentId, "risk-detail-1");
      observeLimit?.(limit);
      return implementations.slice(0, limit);
    },
  };
}

function detailRiskDocument(): Record<string, unknown> {
  return {
    documentId: "risk-detail-1",
    riskNumber: "RSK-001",
    issueStatement: "Unprotected service",
    riskStatement: "An external actor could compromise the service",
    riskCategory: "Cyber Security",
    riskSubCategory: "Network Security",
    riskCause: "Missing boundary control",
    potentialImpact: "Customer data disclosure",
    dataClassification: "Restricted",
    inherentLikelihood: "Likely",
    highestInherentConsequence: "Major",
    inherentRating: "High",
    inherentRatingRationale: "Internet exposure",
    residualLikelihood: "Possible",
    highestResidualConsequence: "Moderate",
    residualRating: "Moderate",
    residualRatingRationale: "Control reduces likelihood",
    controlEffectiveness: "Effective",
    riskVelocity: "High",
    identifiedDate: "2026-07-01",
    targetDate: "2026-09-30",
    closureDate: null,
    isExempted: false,
    exemptionReviewDate: null,
    escalationDetails: null,
    comments: "Review quarterly",
    riskCommunicationDate: "2026-07-02",
    treatmentAction: "Treat",
    treatmentPlan: "Implement boundary protection",
    treatmentResolveDate: "2026-09-30",
    treatmentStatus: "In Progress",
    riskType: { documentId: "risk-type-1", name: "Internet exposure", description: "External attack surface", id: 10 },
    riskOwner: { documentId: "owner-1", displayName: "Risk Owner", email: "secret@example.test" },
    treatmentOwner: { documentId: "treatment-owner-1", displayName: "Treatment Owner", username: "hidden" },
    informationSystemImpacted: { documentId: "system-1", name: "Customer portal", createdAt: "hidden" },
    informationAssetImpacted: { documentId: "asset-1", name: "Customer records", updatedAt: "hidden" },
    assessment: {
      documentId: "assessment-1",
      assessmentNumber: "ASM-001",
      assessmentStatus: "in-review",
      approvedBy: null,
      approvalDate: null,
      assessmentRequest: { title: "Internet-facing service", requestor: { email: "secret@example.test" } },
    },
    id: 100,
    createdAt: "hidden",
    updatedAt: "hidden",
  };
}

function detailControlImplementation(documentId = "implementation-1"): Record<string, unknown> {
  return {
    documentId,
    control: { documentId: "control-1", controlNumber: "CTRL-001", name: "Boundary protection", description: "not projected" },
    controlOwner: { documentId: "control-owner-1", displayName: "Control Owner", email: "secret@example.test" },
    controlStatus: "Implemented",
    effectivenessRating: "Effective",
    evidence: "Validated configuration",
    implementationDueDate: "2026-09-30",
    implementedDate: "2026-08-01",
    reviewDate: "2027-08-01",
    id: 200,
    createdAt: "hidden",
  };
}
