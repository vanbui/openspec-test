import assert from "node:assert/strict";
import test from "node:test";

import {
  parseRiskRegisterQuery,
  RISK_REGISTER_STATES,
  RiskRegisterQueryError,
} from "../src/api/csrm-risk/services/risk-register-query";
import {
  applyActiveRisk,
  applyDisclosableParent,
  applyWithdrawnRisk,
  assertRiskRegisterScope,
  getRiskRegisterDetail,
  listRiskRegister,
  projectRiskRegisterItem,
  RiskRegisterError,
  type RiskRegisterDetailRepository,
  type RiskRegisterRepository,
} from "../src/api/csrm-risk/services/risk-register";
import { TREATMENT_DUE_STATES } from "../src/csrm/insights/treatment-due-state";

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

test("the Risk Register parser accepts exactly the open, closed and withdrawn Risk states (D-36, Phase 16 D-08)", () => {
  assert.deepEqual([...RISK_REGISTER_STATES], ["open", "closed", "withdrawn"]);
  assert.equal(parseRiskRegisterQuery({ state: "open" }).filters.state, "open");
  assert.equal(parseRiskRegisterQuery({ state: "closed" }).filters.state, "closed");
  // Phase 16 D-08: withdrawn Risks are listed only under this explicit value.
  assert.equal(parseRiskRegisterQuery({ state: "withdrawn" }).filters.state, "withdrawn");
  assert.deepEqual(parseRiskRegisterQuery({ state: "withdrawn", stage: "under-assessment" }).filters, { state: "withdrawn", stage: "under-assessment" });
  // Absent means both, so no state predicate is recorded at all.
  assert.equal("state" in parseRiskRegisterQuery({}).filters, false);
  assert.deepEqual(parseRiskRegisterQuery({ state: "open", residualRating: "High" }).filters, { state: "open", residualRating: "High" });

  for (const invalid of ["Open", "CLOSED", "Withdrawn", "withdrawn ", "active", "", " open", "all", "none", ["open", "closed"], ["open"], ["withdrawn"], { $eq: "open" }, { $ne: "closed" }, null, true, 1]) {
    assert.throws(() => parseRiskRegisterQuery({ state: invalid }), RiskRegisterQueryError, JSON.stringify(invalid));
  }
});

/*
 * D-40, D-44: a Risk is released or under assessment, the two branches of the register's scope. The
 * filter is a closed enum, so no other value narrows or widens the scope; absent lists both.
 */
test("the Risk Register parser accepts exactly the released and under-assessment stages (D-40, D-44)", () => {
  const stageOf = (value: unknown) => (parseRiskRegisterQuery({ stage: value }).filters as Record<string, unknown>).stage;
  assert.equal(stageOf("released"), "released");
  assert.equal(stageOf("under-assessment"), "under-assessment");
  // Absent means both stages, so no stage predicate is recorded at all.
  assert.equal("stage" in parseRiskRegisterQuery({}).filters, false);
  assert.deepEqual(
    parseRiskRegisterQuery({ stage: "released", state: "open", residualRating: "Critical" }).filters,
    { stage: "released", state: "open", residualRating: "Critical" },
  );

  for (const invalid of [
    "closed", "", "Released", "RELEASED", " released", "under assessment", "under_assessment", "draft", "in-review", "all",
    ["released"], ["released", "under-assessment"], { $eq: "released" }, null, true, 1,
  ]) {
    assert.throws(() => parseRiskRegisterQuery({ stage: invalid }), RiskRegisterQueryError, JSON.stringify(invalid));
  }
});

/*
 * D-02 item 3, D-44: the treatment action is the JDL's closed Accept or Treat. Case matters, as it does
 * for every other register enum; absent lists every action, including none recorded.
 */
test("the Risk Register parser accepts exactly the Accept and Treat treatment actions (D-44)", () => {
  const actionOf = (value: unknown) => (parseRiskRegisterQuery({ treatmentAction: value }).filters as Record<string, unknown>).treatmentAction;
  assert.equal(actionOf("Accept"), "Accept");
  assert.equal(actionOf("Treat"), "Treat");
  assert.equal("treatmentAction" in parseRiskRegisterQuery({}).filters, false);
  assert.deepEqual(
    parseRiskRegisterQuery({ stage: "released", treatmentAction: "Accept", state: "open" }).filters,
    { stage: "released", treatmentAction: "Accept", state: "open" },
  );

  for (const invalid of [
    "accept", "ACCEPT", "treat", "Transfer", "Avoid", "", " Accept", "Accept ", "none",
    ["Accept"], ["Accept", "Treat"], { $eq: "Accept" }, null, true, 1,
  ]) {
    assert.throws(() => parseRiskRegisterQuery({ treatmentAction: invalid }), RiskRegisterQueryError, JSON.stringify(invalid));
  }
});

/*
 * D-02 item 3, D-35, G-16: the due state is the one rule's closed vocabulary (treatment-due-state.ts), so a
 * figure can open the Risks behind each due state; absent lists every Risk.
 */
test("the Risk Register parser accepts exactly the five treatment due states (D-35, G-16)", () => {
  const dueStateOf = (value: unknown) => (parseRiskRegisterQuery({ dueState: value }).filters as Record<string, unknown>).dueState;
  for (const dueState of TREATMENT_DUE_STATES) assert.equal(dueStateOf(dueState), dueState, dueState);
  assert.equal("dueState" in parseRiskRegisterQuery({}).filters, false);
  assert.deepEqual(
    parseRiskRegisterQuery({ dueState: "later", stage: "released", state: "open" }).filters,
    { dueState: "later", stage: "released", state: "open" },
  );

  for (const invalid of [
    "Overdue", "OVERDUE", "due soon", "due_soon", "dueSoon", "", " overdue", "none", "all", "open",
    ["overdue"], ["overdue", "later"], { $eq: "overdue" }, null, true, 1,
  ]) {
    assert.throws(() => parseRiskRegisterQuery({ dueState: invalid }), RiskRegisterQueryError, JSON.stringify(invalid));
  }
});

/*
 * D-02 item 3, D-35, research Pitfalls 11 and 21: every figure that counts Risks has a closed register value.
 * "none" lists a rating or treatment status that is null or off its vocabulary, "any" any mitigation control,
 * and impactedSystem a separate key whose one value is "none", never a documentId, refused beside a system.
 */
test("the Risk Register parser accepts the none, any, effectiveness and no-system figure filters (D-35)", () => {
  const filtersOf = (value: Record<string, unknown>) => parseRiskRegisterQuery(value).filters as Record<string, unknown>;
  assert.deepEqual(
    filtersOf({ inherentRating: "none", residualRating: "none", treatmentStatus: "none" }),
    { inherentRating: "none", residualRating: "none", treatmentStatus: "none" },
  );
  assert.equal(filtersOf({ mitigationStatus: "any" }).mitigationStatus, "any");
  for (const rating of ["Effective", "Partially Effective", "Ineffective", "Not Assessed", "none"]) {
    assert.equal(filtersOf({ mitigationEffectiveness: rating }).mitigationEffectiveness, rating, rating);
  }
  assert.equal(filtersOf({ impactedSystem: "none" }).impactedSystem, "none");
  // system stays an opaque id: "none" there is a documentId search, not the no-system rule.
  assert.deepEqual(filtersOf({ system: "none" }), { system: "none" });
  for (const key of ["mitigationEffectiveness", "impactedSystem"]) {
    assert.equal(key in parseRiskRegisterQuery({}).filters, false, key);
  }

  for (const [key, invalid] of [
    ["inherentRating", "None"], ["residualRating", "NONE"], ["residualRating", "Not rated"], ["treatmentStatus", "Not provided"],
    ["treatmentStatus", "none "], ["mitigationStatus", "Any"], ["mitigationStatus", "all"],
    ["mitigationEffectiveness", "effective"], ["mitigationEffectiveness", "Not provided"], ["mitigationEffectiveness", ""],
    ["mitigationEffectiveness", ["Effective"]], ["impactedSystem", "None"], ["impactedSystem", "all"], ["impactedSystem", ""],
    ["impactedSystem", "system-document-04"], ["impactedSystem", ["none"]], ["impactedSystem", { $eq: "none" }],
  ] as const) {
    assert.throws(() => parseRiskRegisterQuery({ [key]: invalid }), RiskRegisterQueryError, `${key}=${JSON.stringify(invalid)}`);
  }
  assert.throws(() => parseRiskRegisterQuery({ impactedSystem: "none", system: "system-document-04" }), RiskRegisterQueryError, "IMPACTED_SYSTEM_WITH_SYSTEM");
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

test("the Accepted marker is served only for released, open Accept Risks", () => {
  for (const [changes, expected] of [
    [{ treatmentAction: "Accept" }, true],
    [{ treatmentAction: "Accept", closureDate: "2026-09-20" }, false],
    [{ treatmentAction: "Accept", treatmentStatus: "Complete" }, true],
    [{ treatmentAction: "Treat" }, false],
    // BE1-02: a withdrawn Risk is not open, so it is never accepted.
    [{ treatmentAction: "Accept", withdrawnAt: "2026-09-10T08:00:00.000Z" }, false],
    [{ treatmentAction: "Accept", withdrawnAt: null }, true],
    [{ treatmentAction: "Accept", assessment: { documentId: "draft", assessmentNumber: "ASM-DRAFT", assessmentRequest: { title: "Draft" }, assessmentStatus: "draft", approvalDate: null, approver: null } }, false],
  ] as const) {
    const projected = projectRiskRegisterItem({ ...riskDocument("risk-a", "RSK-001"), assessment: { documentId: "released", assessmentNumber: "ASM-RELEASED", assessmentStatus: "approved", approvedBy: { documentId: "bob" }, approvalDate: "2026-09-20T10:00:00.000Z", assessmentRequest: { title: "Released" } }, ...changes }, today);
    assert.equal((projected as unknown as Record<string, unknown>).accepted, expected, `ACCEPTED_OPEN_RELEASED_PREDICATE_${JSON.stringify(changes)}`);
  }
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

test("none-filtered legacy values project as null without changing stored facts or due state", async () => {
  const legacy = {
    ...riskDocument("risk-legacy", "RSK-LEGACY"),
    inherentRating: "Extreme",
    residualRating: "Severe",
    treatmentStatus: "Deferred",
    targetDate: "2026-09-23",
  };
  const repository: RiskRegisterRepository = {
    async count() { return 1; },
    async selectPage() { return ["risk-legacy"]; },
    async hydrate() { return [legacy]; },
  };
  for (const field of ["inherentRating", "residualRating", "treatmentStatus"]) {
    const result = await listRiskRegister({ repository, state, query: { [field]: "none" }, today });
    assert.deepEqual(
      [result.data[0]?.inherentRating, result.data[0]?.residualRating, result.data[0]?.treatmentStatus],
      [null, null, null],
      field,
    );
    assert.equal(result.data[0]?.treatmentDueState, "overdue");
    assert.equal(result.meta.pagination.total, 1);
  }
  assert.equal(legacy.inherentRating, "Extreme");
  assert.equal(legacy.residualRating, "Severe");
  assert.equal(legacy.treatmentStatus, "Deferred");
});

test("list uses one parsed filter model, bounded page IDs, and restores database order", async () => {
  const observed: Array<{ operation: string; value: unknown; today?: unknown }> = [];
  const repository: RiskRegisterRepository = {
    async count(filters: unknown, evaluatedOn?: unknown) {
      observed.push({ operation: "count", value: filters, today: evaluatedOn });
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

  // The count and the page share the parsed filters and the list's today, which the dueState filter reads (G-16).
  assert.deepEqual(observed[0], { operation: "count", value: { q: "exposure", treatmentStatus: "Complete" }, today });
  assert.deepEqual(observed[1], {
    operation: "page",
    value: {
      filters: observed[0].value,
      sort: { field: "inherentRating", direction: "desc" },
      offset: 10,
      limit: 10,
      today,
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

  // The nine Phase 5 keys, the server-derived treatment due state (D-26), the parent's stage and the
  // recorded treatment action (D-44); closureDate is read to derive the due state but never disclosed.
  assert.deepEqual(Object.keys(projected).sort(), [
    "accepted",
    "assessment",
    "documentId",
    "inherentRating",
    "residualRating",
    "riskNumber",
    "riskStatement",
    "stage",
    "targetDate",
    "treatmentAction",
    "treatmentDueState",
    "treatmentOwner",
    "treatmentStatus",
  ]);
  assert.equal(projected.treatmentDueState, "later");
  assert.deepEqual(projected.treatmentOwner, { documentId: "treatment-owner", displayName: "Treatment Owner" });
  assert.deepEqual(projected.assessment, { documentId: "assessment-1", assessmentNumber: "ASM-001", title: "Assessment title" });
  assert.doesNotMatch(JSON.stringify(projected), /secret|email|createdAt|updatedAt|\"id\":|controlImplementations|closureDate/i);
});

/*
 * D-40, D-44: each row says which branch of the register's scope it is in, decided from the populated
 * parent exactly as the detail's parent gate decides it. A parent in neither branch cannot be listed,
 * so a row built from one is a data defect, refused without a partial page.
 */
test("register rows carry the recorded treatment action, Accept, Treat or none (D-44)", () => {
  const actionOf = (value: unknown) => (projectRiskRegisterItem({ ...riskDocument("risk-1", "RSK-001"), treatmentAction: value }, today) as Record<string, unknown>).treatmentAction;
  assert.equal(actionOf("Accept"), "Accept");
  assert.equal(actionOf("Treat"), "Treat");
  assert.equal(actionOf(null), null);
  assert.equal(actionOf(undefined), null);
  // CR-101, WR-103: a stored value outside the JDL's enumeration (legacy or directly written data) is served in the
  // contract's "none recorded" form, as an off-vocabulary rating or status is, so it never fails the page.
  for (const legacy of ["accept", "Transfer", "", 1, { value: "Accept" }]) {
    assert.equal(actionOf(legacy), null, `LEGACY_TREATMENT_ACTION_SERVED_${JSON.stringify(legacy)}`);
  }
});

test("register rows carry the parent's stage: released, or under assessment for a draft or in-review parent", () => {
  const withParent = (facts: Record<string, unknown>) => {
    const document = riskDocument("risk-1", "RSK-001");
    document.assessment = { ...(document.assessment as Record<string, unknown>), ...facts };
    return document;
  };
  const stageOf = (facts: Record<string, unknown>) => (projectRiskRegisterItem(withParent(facts), today) as Record<string, unknown>).stage;

  assert.equal(stageOf({ assessmentStatus: "draft", approvedBy: null, approvalDate: null }), "under-assessment");
  assert.equal(stageOf({ assessmentStatus: "in-review", approvedBy: null, approvalDate: null }), "under-assessment");
  assert.equal(
    stageOf({ assessmentStatus: "approved", approvedBy: { documentId: "analyst-1" }, approvalDate: "2026-08-30T00:00:00.000Z" }),
    "released",
  );

  for (const partial of [
    { assessmentStatus: "approved", approvedBy: null, approvalDate: null },
    { assessmentStatus: "in-review", approvedBy: { documentId: "analyst-1" }, approvalDate: null },
    { assessmentStatus: "in-review", approvedBy: null, approvalDate: "2026-08-30T00:00:00.000Z" },
    { assessmentStatus: "approved", approvedBy: { documentId: "analyst-1" }, approvalDate: null },
    { assessmentStatus: "approved", approvedBy: null, approvalDate: "2026-08-30T00:00:00.000Z" },
    { assessmentStatus: "draft", approvedBy: { documentId: "analyst-1" }, approvalDate: "2026-08-30T00:00:00.000Z" },
    { assessmentStatus: "closed", approvedBy: null, approvalDate: null },
    { assessmentStatus: undefined, approvedBy: null, approvalDate: null },
  ]) {
    assert.throws(
      () => projectRiskRegisterItem(withParent(partial), today),
      (error: unknown) => error instanceof RiskRegisterError && error.status === 400,
      `PARTIAL_PARENT_LISTED_${JSON.stringify(partial)}`,
    );
  }
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
    "treatmentOwner", "treatmentPlan", "treatmentResolveDate", "treatmentStatus", "withdrawal",
  ].sort());
  assert.equal(detail.parentLock, "mutable");
  // Phase 16 D-45: an active Risk carries no withdrawal block.
  assert.equal(detail.withdrawal, null);
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

/*
 * CR-101: a Risk the register lists under "Not rated" or "Not provided" because a stored value is off its
 * vocabulary must open too. Every closed value of the detail is served inside its published enumeration, an
 * off-vocabulary one as not provided (null), so the closed client parser never refuses the record.
 */
test("detail serves an off-vocabulary closed value as not provided, so a legacy record opens", async () => {
  const legacy = {
    ...detailRiskDocument(),
    dataClassification: "Secret",
    inherentRating: "Extreme",
    residualRating: "Severe",
    controlEffectiveness: "Mostly Effective",
    riskVelocity: "Glacial",
    treatmentAction: "accept",
    treatmentStatus: "Deferred",
  };
  const implementation = { ...detailControlImplementation(), controlStatus: "Paused", effectivenessRating: "Unrated" };
  const detail = await getRiskRegisterDetail({ repository: detailRepository(legacy, [implementation]), state, riskDocumentId: "risk-detail-1" });

  for (const field of ["dataClassification", "inherentRating", "residualRating", "controlEffectiveness", "riskVelocity", "treatmentAction", "treatmentStatus"]) {
    assert.equal(detail[field], null, `LEGACY_DETAIL_VALUE_SERVED_${field}`);
  }
  const [served] = detail.controlImplementations as Array<Record<string, unknown>>;
  assert.equal(served.controlStatus, null, "LEGACY_CONTROL_STATUS_SERVED");
  assert.equal(served.effectivenessRating, null, "LEGACY_EFFECTIVENESS_SERVED");
  // The values inside the vocabulary are served as they are.
  const current = await getRiskRegisterDetail({ repository: detailRepository(detailRiskDocument(), [detailControlImplementation()]), state, riskDocumentId: "risk-detail-1" });
  assert.deepEqual(
    [current.dataClassification, current.inherentRating, current.residualRating, current.controlEffectiveness, current.riskVelocity, current.treatmentAction, current.treatmentStatus],
    ["Restricted", "High", "Moderate", "Effective", "High", "Treat", "In Progress"],
  );
});

/*
 * Phase 16 D-45, D-03 item 9: the register detail of a withdrawn Risk carries who withdrew it, when and why, as
 * the analyst assessment detail does; its parent lock keeps its two values.
 */
test("detail of a withdrawn Risk carries its withdrawal block and keeps its parent lock (Phase 16 D-45)", async () => {
  const withdrawn = {
    ...detailRiskDocument(),
    withdrawnAt: "2026-10-15T01:02:03.000Z",
    withdrawnBy: { documentId: "analyst-1", displayName: "Bob Analyst", email: "secret@example.test" },
    withdrawalReason: "Proposed under the wrong Risk Type",
  };
  const detail = await getRiskRegisterDetail({ repository: detailRepository(withdrawn, []), state, riskDocumentId: "risk-detail-1" });
  assert.equal(detail.parentLock, "mutable");
  assert.deepEqual(detail.withdrawal, {
    at: "2026-10-15T01:02:03.000Z",
    by: { documentId: "analyst-1", displayName: "Bob Analyst" },
    reason: "Proposed under the wrong Risk Type",
  });
  assert.doesNotMatch(JSON.stringify(detail), /secret@example/);

  // The withdrawing person can no longer be named: the block stays, with no person.
  const unnamed = await getRiskRegisterDetail({
    repository: detailRepository({ ...withdrawn, withdrawnBy: null }, []),
    state,
    riskDocumentId: "risk-detail-1",
  });
  assert.deepEqual(unnamed.withdrawal, { at: "2026-10-15T01:02:03.000Z", by: null, reason: "Proposed under the wrong Risk Type" });
});

/*
 * Phase 16 D-13: the SQL form of the active-risk rule sits beside the disclosure predicate as two helpers that add
 * one constant fragment on the outer alias `r`; the disclosure predicate itself never names the withdrawal fact, so
 * the Withdrawn filter can still reach withdrawn rows.
 */
test("the active and withdrawn SQL helpers add one constant predicate on the outer Risk alias (Phase 16 D-13)", () => {
  const recorded: string[] = [];
  const recorder = { whereRaw(sql: string) { recorded.push(sql); return recorder; } };
  assert.equal(applyActiveRisk(recorder), recorder);
  assert.equal(applyWithdrawnRisk(recorder), recorder);
  assert.deepEqual(recorded, ["r.withdrawn_at IS NULL", "r.withdrawn_at IS NOT NULL"]);
  assert.doesNotMatch(applyDisclosableParent.toString(), /withdrawn/);
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
    treatmentAction: "Treat",
    treatmentOwner: { documentId: "treatment-owner", displayName: "Treatment Owner" },
    targetDate: "2027-01-31",
    // A mutable parent (in review, no release facts), as hydrate populates it.
    assessment: {
      documentId: "assessment-1",
      assessmentNumber: "ASM-001",
      assessmentStatus: "in-review",
      approvedBy: null,
      approvalDate: null,
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
