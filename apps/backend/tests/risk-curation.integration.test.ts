import assert from "node:assert/strict";
import path from "node:path";
import test, { after } from "node:test";
import { parseRiskHistoryChanges, RISK_HISTORY_FIELDS, riskChanges } from "../src/csrm/risk-history-changes";
import { startAuthorizationHttpHarness, type AuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 16 risk curation on a mounted Strapi (D-01, D-05, D-18, D-21, D-44). 16-03 proves the approved schema change:
 * the withdrawal facts on a Risk, the append-only history with its only writer and its paginated read, and that legacy
 * Risks read as active. Later Phase 16 plans extend this file with the curation operations.
 */

// Emitted to `.tmp/tests-dist/tests`, so three parents up is the Strapi application.
const strapiDir = path.resolve(__dirname, "..", "..", "..");

type HistoryEntry = {
  kind: string;
  riskDocumentId: string;
  assessmentDocumentId: string;
  actorDocumentId: string;
  sourceKind: string;
  aiRunDocumentId?: string | null;
  proposalItem?: string | null;
  reason?: string | null;
  undo?: boolean;
  occurredAt?: Date;
  changes: { fields: ReadonlyArray<{ field: string; from: unknown; to: unknown }>; control?: { documentId: string; controlNumber: string; name: string } };
};
type HistoryEventView = {
  id: string;
  kind: string;
  occurredAt: string;
  actor: { documentId: string; displayName: string } | null;
  sourceKind: string;
  aiRunId: string | null;
  proposalItem: string | null;
  reason: string | null;
  undo: boolean;
  changes: unknown;
};
type HistoryPage = { events: HistoryEventView[]; pagination: { page: number; pageSize: number; pageCount: number; total: number }; recordedFrom: string | null };
/* The compiled module Strapi runs, read the way attachment-quarantine reads its service (the type is structural). */
type CompiledRiskHistory = {
  RISK_HISTORY_PAGE_SIZE: number;
  RISK_HISTORY_PAGE_SIZE_MAX: number;
  recordRiskHistory: (strapi: unknown, entry: HistoryEntry) => Promise<string>;
  readRiskHistory: (strapi: unknown, input: { riskDocumentId: string; page?: number; pageSize?: number }) => Promise<HistoryPage>;
  latestWithdrawalReason: (strapi: unknown, riskDocumentId: string) => Promise<string | null>;
};

function compiledRiskHistory(): CompiledRiskHistory {
  return require(path.join(strapiDir, "dist", "src", "api", "csrm-risk-history-event", "services", "risk-history.js")) as CompiledRiskHistory;
}

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

const HISTORY_TABLE = "csrm_risk_history_events";

async function assertHistoryTable(harness: AuthorizationHttpHarness): Promise<void> {
  assert.ok((await harness.listTableColumns(HISTORY_TABLE)).includes("kind"), "RISK_HISTORY_TABLE_MISSING");
}

let draftedPromise: Promise<{ assessmentId: string; riskIds: string[] }> | null = null;

/* One assessment drafted by 12-06's deterministic job before any Phase 16 write: its Risks are the legacy rows. */
function draftedAssessment(harness: AuthorizationHttpHarness): Promise<{ assessmentId: string; riskIds: string[] }> {
  draftedPromise ??= (async () => {
    const fixture = await harness.seedUatALikeRequest("CURATION");
    const { assessmentId } = await harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst);
    const assessment = await harness.getAssessment(assessmentId);
    const riskIds = ((assessment?.risks as Array<Record<string, unknown>> | undefined) ?? []).map((risk) => String(risk.documentId));
    assert.ok(riskIds.length > 0, "CURATION_DRAFT_HAS_NO_RISKS");
    return { assessmentId, riskIds };
  })();
  return draftedPromise;
}

let riskSequence = 0;
async function freshRisk(harness: AuthorizationHttpHarness, assessmentId: string): Promise<string> {
  riskSequence += 1;
  return harness.createRiskRegisterFixture(assessmentId, { riskNumber: `RSK-CURATION-${String(riskSequence).padStart(3, "0")}`, riskStatement: `Curation risk ${riskSequence}` });
}

async function displayNameOf(harness: AuthorizationHttpHarness, userDocumentId: string): Promise<string> {
  return harness.withBackendFixture(async (backend) => {
    const user = await (backend.documents as unknown as (uid: string) => { findOne: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null> })("api::idambox-user.idambox-user")
      .findOne({ documentId: userDocumentId, fields: ["displayName"] });
    return String(user?.displayName ?? "");
  });
}

/* Runs `action` inside `strapi.db.transaction`, the way every Phase 16 write path joins the history to its change. */
function inTransaction<T>(harness: AuthorizationHttpHarness, action: (backend: unknown) => Promise<T>): Promise<T> {
  return harness.withBackendFixture((backend) => (backend.db as unknown as { transaction: <R>(work: () => Promise<R>) => Promise<R> }).transaction(() => action(backend)));
}

test("a fresh database boots with the withdrawal columns, their link table and the risk history table (D-01)", async () => {
  const harness = await harnessPromise;
  const riskColumns = await harness.listTableColumns("csrm_risks");
  for (const column of ["withdrawn_at", "withdrawal_reason"]) assert.ok(riskColumns.includes(column), `CSRM_RISKS_WITHOUT_${column}`);
  assert.ok((await harness.listTableColumns("csrm_risks_withdrawn_by_lnk")).length > 0, "WITHDRAWN_BY_LINK_TABLE_MISSING");
  const historyColumns = await harness.listTableColumns(HISTORY_TABLE);
  for (const column of ["kind", "occurred_at", "source_kind", "proposal_item", "batch_id", "reason", "undo", "changes"]) {
    assert.ok(historyColumns.includes(column), `${HISTORY_TABLE.toUpperCase()}_WITHOUT_${column}`);
  }
});

/*
 * 16-04 moved the drafted Risks out of this case: from 16-04 on a draft records each Risk's `created` row (D-19). A Risk
 * written before Phase 16 is now the row a direct write leaves (no workflow, no history), as the fixture writes it.
 */
test("a Risk written before Phase 16 reads as active with no history rows, and a drafted Risk as active (legacy rows, D-01 migration)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId, riskIds } = await draftedAssessment(harness);
  for (const riskId of riskIds) {
    assert.deepEqual(await harness.riskWithdrawalFactsFixture(riskId), { withdrawnAt: null, withdrawnBy: null, withdrawalReason: null }, "DRAFTED_RISK_NOT_ACTIVE");
  }
  const legacyRiskId = await freshRisk(harness, assessmentId);
  assert.deepEqual(await harness.riskWithdrawalFactsFixture(legacyRiskId), { withdrawnAt: null, withdrawnBy: null, withdrawalReason: null }, "LEGACY_RISK_NOT_ACTIVE");
  assert.deepEqual(await harness.riskHistoryRowsFixture(legacyRiskId), [], "LEGACY_RISK_HAS_HISTORY");
});

test("the only writer appends a row inside the caller's transaction, and a rolled-back transaction leaves none (D-18)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const history = compiledRiskHistory();
  const entry: HistoryEntry = {
    kind: "updated",
    riskDocumentId: riskId,
    assessmentDocumentId: assessmentId,
    actorDocumentId: harness.users.analyst,
    sourceKind: "analyst",
    changes: { fields: [{ field: "riskStatement", from: "Curation risk", to: "Curation risk, restated" }, { field: "riskType", from: null, to: { documentId: "rt-1", label: "Payment Integrity" } }] },
  };
  const rowId = await inTransaction(harness, (backend) => history.recordRiskHistory(backend, entry));
  const rows = await harness.riskHistoryRowsFixture(riskId);
  assert.equal(rows.length, 1, "HISTORY_ROW_NOT_WRITTEN");
  const [row] = rows;
  assert.equal(row.documentId, rowId, "HISTORY_WRITER_RETURNED_ANOTHER_ROW");
  assert.equal(row.kind, "updated");
  assert.equal(row.sourceKind, "analyst");
  assert.equal(row.actor, harness.users.analyst);
  assert.equal(row.assessment, assessmentId);
  assert.equal(row.risk, riskId);
  assert.equal(row.aiRun, null);
  assert.equal(row.undo, false);
  assert.ok(row.occurredAt, "HISTORY_ROW_WITHOUT_TIME");
  assert.deepEqual(parseRiskHistoryChanges(row.changes), { schemaVersion: 1, fields: entry.changes.fields }, "HISTORY_CHANGES_DO_NOT_ROUND_TRIP");

  await assert.rejects(
    inTransaction(harness, async (backend) => {
      await history.recordRiskHistory(backend, entry);
      throw new Error("FORCED_FAILURE_AFTER_THE_HISTORY_WRITE");
    }),
    /FORCED_FAILURE_AFTER_THE_HISTORY_WRITE/,
  );
  assert.equal((await harness.riskHistoryRowsFixture(riskId)).length, 1, "ROLLED_BACK_HISTORY_ROW_KEPT");
});

test("the writer refuses an invalid entry and writes nothing (D-18)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const history = compiledRiskHistory();
  const base = { riskDocumentId: riskId, assessmentDocumentId: assessmentId, actorDocumentId: harness.users.analyst, changes: { fields: [] } };
  const refusals: Array<[string, HistoryEntry]> = [
    ["WITHDRAWN_WITHOUT_REASON", { ...base, kind: "withdrawn", sourceKind: "analyst" }],
    ["WITHDRAWN_WITH_BLANK_REASON", { ...base, kind: "withdrawn", sourceKind: "analyst", reason: "   " }],
    ["WITHDRAWN_WITH_LONG_REASON", { ...base, kind: "withdrawn", sourceKind: "analyst", reason: "x".repeat(501) }],
    ["REINSTATED_WITHOUT_REASON", { ...base, kind: "reinstated", sourceKind: "analyst" }],
    ["AI_RUN_WITHOUT_RUN", { ...base, kind: "updated", sourceKind: "ai-run", changes: { fields: [{ field: "riskStatement", from: "a", to: "b" }] } }],
    ["ANALYST_WITH_RUN", { ...base, kind: "updated", sourceKind: "analyst", aiRunDocumentId: "run-1", changes: { fields: [{ field: "riskStatement", from: "a", to: "b" }] } }],
    ["UNKNOWN_KIND", { ...base, kind: "deleted", sourceKind: "analyst", reason: "Gone" }],
    ["UNKNOWN_SOURCE", { ...base, kind: "updated", sourceKind: "import", changes: { fields: [{ field: "riskStatement", from: "a", to: "b" }] } }],
    ["UPDATE_OF_NOTHING", { ...base, kind: "updated", sourceKind: "analyst" }],
  ];
  for (const [label, entry] of refusals) {
    await assert.rejects(inTransaction(harness, (backend) => history.recordRiskHistory(backend, entry)), { name: "RiskHistoryError" }, label);
  }
  assert.deepEqual(await harness.riskHistoryRowsFixture(riskId), [], "REFUSED_ENTRY_WROTE_A_ROW");
});

test("the history read serves newest first with batched names, bounded pages, recordedFrom and a fail-safe projection (D-21)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const history = compiledRiskHistory();
  assert.equal(history.RISK_HISTORY_PAGE_SIZE, 25);
  assert.equal(history.RISK_HISTORY_PAGE_SIZE_MAX, 100);
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 1, 9, minute));
  const base = { riskDocumentId: riskId, assessmentDocumentId: assessmentId, sourceKind: "analyst" } as const;
  await inTransaction(harness, async (backend) => {
    await history.recordRiskHistory(backend, { ...base, kind: "updated", actorDocumentId: harness.users.analyst, occurredAt: at(0), changes: { fields: [{ field: "comments", from: null, to: "First" }] } });
    await history.recordRiskHistory(backend, { ...base, kind: "withdrawn", actorDocumentId: harness.users.secondAnalyst, occurredAt: at(5), reason: "  Duplicate of another risk.  ", changes: { fields: [] } });
    await history.recordRiskHistory(backend, { ...base, kind: "reinstated", actorDocumentId: harness.users.analyst, occurredAt: at(10), reason: "Not a duplicate after all.", undo: true, changes: { fields: [] } });
  });
  const [bob, second] = [await displayNameOf(harness, harness.users.analyst), await displayNameOf(harness, harness.users.secondAnalyst)];

  const page = await history.readRiskHistory(await backendOf(harness), { riskDocumentId: riskId });
  assert.deepEqual(page.events.map((event) => event.kind), ["reinstated", "withdrawn", "updated"], "HISTORY_NOT_NEWEST_FIRST");
  assert.deepEqual(page.events.map((event) => event.actor), [
    { documentId: harness.users.analyst, displayName: bob },
    { documentId: harness.users.secondAnalyst, displayName: second },
    { documentId: harness.users.analyst, displayName: bob },
  ], "HISTORY_ACTORS_NOT_NAMED");
  assert.deepEqual(page.pagination, { page: 1, pageSize: 25, pageCount: 1, total: 3 }, "HISTORY_PAGINATION");
  assert.equal(page.recordedFrom, at(0).toISOString(), "HISTORY_RECORDED_FROM");
  assert.deepEqual(page.events.map((event) => event.occurredAt), [at(10), at(5), at(0)].map((date) => date.toISOString()));
  assert.equal(page.events[1].reason, "Duplicate of another risk.", "WITHDRAWAL_REASON_NOT_TRIMMED");
  assert.equal(page.events[0].undo, true);
  assert.equal(page.events[1].undo, false);
  assert.deepEqual(page.events[2].changes, { schemaVersion: 1, fields: [{ field: "comments", from: null, to: "First" }] });
  assert.deepEqual(page.events[1].changes, { schemaVersion: 1, fields: [] });
  for (const event of page.events) {
    assert.deepEqual(Object.keys(event).sort(), ["actor", "aiRunId", "changes", "id", "kind", "occurredAt", "proposalItem", "reason", "sourceKind", "undo"], "HISTORY_EVENT_SHAPE");
    assert.equal(event.aiRunId, null);
    assert.equal(event.proposalItem, null);
  }

  const second2 = await history.readRiskHistory(await backendOf(harness), { riskDocumentId: riskId, page: 2, pageSize: 2 });
  assert.deepEqual(second2.events.map((event) => event.kind), ["updated"], "HISTORY_SECOND_PAGE");
  assert.deepEqual(second2.pagination, { page: 2, pageSize: 2, pageCount: 2, total: 3 });
  assert.equal(second2.recordedFrom, at(0).toISOString(), "RECORDED_FROM_DEPENDS_ON_THE_PAGE");
  for (const [label, input] of [["PAGE_SIZE_OVER_MAX", { pageSize: 101 }], ["PAGE_SIZE_NOT_INTEGER", { pageSize: 2.5 }], ["PAGE_ZERO", { page: 0 }]] as const) {
    await assert.rejects(history.readRiskHistory(await backendOf(harness), { riskDocumentId: riskId, ...input }), { name: "RiskHistoryError" }, label);
  }

  await harness.writeRawHistoryRowFixture({ kind: "updated", occurredAt: at(20).toISOString(), actor: harness.users.analyst, assessment: assessmentId, risk: riskId, sourceKind: "analyst", undo: false, changes: { schemaVersion: 9, fields: "not a list" } });
  const withMalformed = await history.readRiskHistory(await backendOf(harness), { riskDocumentId: riskId });
  assert.equal(withMalformed.pagination.total, 4);
  assert.equal(withMalformed.events[0].changes, null, "MALFORMED_CHANGES_NOT_NULL");
  assert.equal(withMalformed.events[0].kind, "updated");
  assert.deepEqual(withMalformed.events[0].actor, { documentId: harness.users.analyst, displayName: bob });
  assert.deepEqual(withMalformed.events.slice(1).map((event) => event.kind), ["reinstated", "withdrawn", "updated"], "MALFORMED_ROW_BROKE_THE_OTHERS");
  assert.ok(withMalformed.events.slice(1).every((event) => event.changes !== null), "WELL_FORMED_ROWS_READ_AS_NULL");

  const emptyRiskId = await freshRisk(harness, assessmentId);
  assert.deepEqual(await history.readRiskHistory(await backendOf(harness), { riskDocumentId: emptyRiskId }), {
    events: [],
    pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 },
    recordedFrom: null,
  }, "EMPTY_HISTORY_READ");
});

test("latestWithdrawalReason names the most recent withdrawal's reason, or null (the Undo source, D-18)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const history = compiledRiskHistory();
  const at = (minute: number) => new Date(Date.UTC(2026, 9, 2, 9, minute));
  const base = { riskDocumentId: riskId, assessmentDocumentId: assessmentId, actorDocumentId: harness.users.analyst, sourceKind: "analyst", changes: { fields: [] } } as const;
  await inTransaction(harness, async (backend) => {
    await history.recordRiskHistory(backend, { ...base, kind: "withdrawn", occurredAt: at(0), reason: "Out of scope." });
    await history.recordRiskHistory(backend, { ...base, kind: "reinstated", occurredAt: at(1), reason: "In scope again." });
    await history.recordRiskHistory(backend, { ...base, kind: "withdrawn", occurredAt: at(2), reason: "Duplicate of RSK-001." });
    await history.recordRiskHistory(backend, { ...base, kind: "reinstated", occurredAt: at(3), reason: "Restored by Undo.", undo: true });
  });
  assert.equal(await history.latestWithdrawalReason(await backendOf(harness), riskId), "Duplicate of RSK-001.", "LATEST_WITHDRAWAL_REASON");
  assert.equal(await history.latestWithdrawalReason(await backendOf(harness), await freshRisk(harness, assessmentId)), null, "NO_WITHDRAWAL_REASON");
});

function backendOf(harness: AuthorizationHttpHarness): Promise<unknown> {
  return harness.withBackendFixture(async (backend) => backend);
}

/*
 * D-44 (T-16-07): withdrawal facts are server-owned. The Risk update payload is closed (`RISK_WRITABLE_FIELDS`), so a
 * PATCH carrying any of the three facts, alone or beside a writable field, is a 400 and changes nothing: not the Risk,
 * not its facts, not its history.
 */
const WITHDRAWAL_FACT_BODIES = (withdrawnBy: string): Array<[string, Record<string, unknown>]> => [
  ["WITHDRAWN_AT", { withdrawnAt: "2026-10-01T00:00:00.000Z" }],
  ["WITHDRAWAL_REASON", { withdrawalReason: "x" }],
  ["WITHDRAWN_BY", { withdrawnBy }],
  ["WITHDRAWN_AT_BESIDE_A_WRITABLE_FIELD", { riskStatement: "Restated while withdrawing", withdrawnAt: "2026-10-01T00:00:00.000Z" }],
];

async function patchRisk(harness: AuthorizationHttpHarness, riskId: string, identity: string, body: unknown): Promise<Response> {
  return harness.request({ path: `/api/v1/risks/${encodeURIComponent(riskId)}`, identity, init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } });
}

function persistedRisk(harness: AuthorizationHttpHarness, riskId: string): Promise<unknown[]> {
  return harness.snapshot([() => harness.getRisk(riskId), () => harness.riskWithdrawalFactsFixture(riskId), () => harness.riskHistoryRowsFixture(riskId)]);
}

test("withdrawal facts are not client-writable: the human analyst's PATCH carrying any of them is a 400 that changes nothing (D-44)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { riskIds: [riskId] } = await draftedAssessment(harness);
  const before = await persistedRisk(harness, riskId);
  for (const [label, body] of WITHDRAWAL_FACT_BODIES(harness.users.analyst)) {
    const response = await patchRisk(harness, riskId, harness.identities.analyst, body);
    assert.equal(response.status, 400, `ANALYST_${label}_NOT_REFUSED`);
    assert.ok(!(await response.text()).includes("2026-10-01"), `ANALYST_${label}_ECHOED`);
  }
  assert.deepEqual(await persistedRisk(harness, riskId), before, "ANALYST_WITHDRAWAL_FACT_PATCH_CHANGED_THE_RISK");
  assert.deepEqual(await harness.riskWithdrawalFactsFixture(riskId), { withdrawnAt: null, withdrawnBy: null, withdrawalReason: null });
});

test("withdrawal facts are not writable by the service agent either: each PATCH is refused and changes nothing (D-44)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { riskIds: [riskId] } = await draftedAssessment(harness);
  const before = await persistedRisk(harness, riskId);
  for (const [label, body] of WITHDRAWAL_FACT_BODIES(harness.users.serviceAnalystAgent)) {
    const response = await patchRisk(harness, riskId, harness.identities.serviceAnalystAgent, body);
    assert.ok([400, 403].includes(response.status), `SERVICE_AGENT_${label}_ANSWERED_${response.status}`);
  }
  assert.deepEqual(await persistedRisk(harness, riskId), before, "SERVICE_AGENT_WITHDRAWAL_FACT_PATCH_CHANGED_THE_RISK");
});

/*
 * The record's "Migration": a Risk drafted before Phase 16 changes nothing in release readiness. The analyst detail
 * serves exactly the pre-Phase 16 checklist (the assessment items, each drafted Risk's items, "At least one Risk"), with
 * no withdrawal item, and a history row on one of its Risks moves nothing, because gates never read the history (D-18).
 */
// 16-10 (D-42) adds "Decisions on AI proposals" (aiProposalsDecided), met while no risk AI proposal is open.
const ASSESSMENT_READINESS_KEYS = ["assessmentStatus", "reviewedBy", "summary", "overallRating", "overallRiskRationale", "aiProposalsReviewed", "aiProposalsDecided", "risks"];
const RISK_READINESS_KEYS = ["riskStatement", "inherentLikelihood", "highestInherentConsequence", "inherentRating", "residualLikelihood", "highestResidualConsequence", "residualRating", "riskOwner", "treatmentAction", "targetDate"];
const TREAT_READINESS_KEYS = ["treatmentPlan", "treatmentOwner", "treatmentResolveDate", "controlImplementations"];

test("release readiness of a pre-Phase 16 drafted assessment is unchanged, and a history row moves nothing (D-01 migration, D-18)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const fixture = await harness.seedUatALikeRequest("CURATION-READINESS");
  const { assessmentId } = await harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst);
  type Requirement = { scope: string; key: string; state: string; riskNumber?: string };
  const readiness = async (): Promise<{ ready: boolean; requirements: Requirement[] }> => {
    const detail = await harness.request({ path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, identity: harness.identities.analyst });
    assert.equal(detail.status, 200, "READINESS_DETAIL_STATUS");
    return ((await detail.json()) as { data: { releaseReadiness: { ready: boolean; requirements: Requirement[] } } }).data.releaseReadiness;
  };
  const before = await readiness();
  const stored = ((await harness.getAssessment(assessmentId))?.risks as Array<Record<string, unknown>>);
  assert.ok(stored.length > 0, "READINESS_DRAFT_HAS_NO_RISKS");

  const assessmentKeys = before.requirements.filter((item) => item.scope === "assessment").map((item) => item.key);
  assert.ok(assessmentKeys.every((key) => ASSESSMENT_READINESS_KEYS.includes(key)), `READINESS_NEW_ASSESSMENT_ITEM_${assessmentKeys.join(",")}`);
  assert.equal(assessmentKeys.at(-1), "risks");
  for (const risk of stored) {
    const keys = before.requirements.filter((item) => item.scope === "risk" && item.riskNumber === risk.riskNumber).map((item) => item.key);
    const expected = [...RISK_READINESS_KEYS, ...(risk.treatmentAction === "Treat" ? TREAT_READINESS_KEYS : [])];
    assert.deepEqual(keys.filter((key) => key !== "aiProposalsReviewed"), expected, `READINESS_ITEMS_OF_${String(risk.riskNumber)}`);
  }
  assert.equal(before.requirements.filter((item) => item.scope === "risk").length,
    stored.reduce((count, risk) => count + RISK_READINESS_KEYS.length + (risk.treatmentAction === "Treat" ? TREAT_READINESS_KEYS.length : 0), 0)
      + before.requirements.filter((item) => item.scope === "risk" && item.key === "aiProposalsReviewed").length,
    "READINESS_COUNTS_A_RISK_TWICE_OR_NOT_AT_ALL");
  assert.ok(!JSON.stringify(before).toLowerCase().includes("withdraw"), "READINESS_HAS_A_WITHDRAWAL_ITEM");

  const [riskId] = stored.map((risk) => String(risk.documentId));
  await inTransaction(harness, (backend) => compiledRiskHistory().recordRiskHistory(backend, {
    kind: "updated", riskDocumentId: riskId, assessmentDocumentId: assessmentId, actorDocumentId: harness.users.analyst, sourceKind: "analyst",
    changes: { fields: [{ field: "comments", from: null, to: "Narrative only" }] },
  }));
  assert.deepEqual(await readiness(), before, "A_HISTORY_ROW_MOVED_RELEASE_READINESS");
});

/*
 * 16-04 (D-19, D-22, D-23, Pitfall 1): every analyst change to a Risk goes through the one editable guard and the lock
 * core, and the transaction-scoped inner update records exactly what changed, in the change's own transaction. The
 * compiled modules are read structurally, so this file compiles before the inner functions exist.
 */
type MutationContext = { assessment: Record<string, unknown> };
type CompiledMutationSeam = {
  withMutableAssessmentMutation: <T>(input: {
    strapi: unknown;
    assessmentDocumentId: string;
    analystDocumentId: string;
    transition?: (result: T) => "accepted-edit" | "none";
    mutate: (context: MutationContext) => Promise<T>;
  }) => Promise<T>;
};
type HistorySourceInput = { kind: "analyst" } | { kind: "ai-run"; runDocumentId: string; proposalItem?: string };
type CompiledRiskWorkflow = {
  updateRiskWithinMutation?: (input: {
    strapi: unknown;
    assessment: Record<string, unknown>;
    actorDocumentId: string;
    source: HistorySourceInput;
    riskDocumentId: string;
    fields: Record<string, unknown>;
    humanAnalyst: boolean;
  }) => Promise<Record<string, unknown> & { changed: boolean }>;
};

function compiledMutationSeam(): CompiledMutationSeam {
  return require(path.join(strapiDir, "dist", "src", "api", "csrm-assessment", "services", "assessment-workflow.js")) as CompiledMutationSeam;
}

function compiledRiskWorkflow(): CompiledRiskWorkflow {
  return require(path.join(strapiDir, "dist", "src", "api", "csrm-risk", "services", "risk-workflow.js")) as CompiledRiskWorkflow;
}

async function changesOf(harness: AuthorizationHttpHarness, riskId: string): Promise<Array<{ kind: unknown; sourceKind: unknown; actor: unknown; aiRun: unknown; changes: unknown }>> {
  return (await harness.riskHistoryRowsFixture(riskId)).map((row) => ({
    kind: row.kind, sourceKind: row.sourceKind, actor: row.actor, aiRun: row.aiRun, changes: parseRiskHistoryChanges(row.changes),
  }));
}

test("an analyst PATCH records one updated row with exactly the changed fields, and an identical PATCH records none (D-19)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const statement = String((await harness.getRisk(riskId))?.riskStatement);
  const body = { riskStatement: `${statement}, restated`, riskOwner: harness.users.owner };
  const first = await patchRisk(harness, riskId, harness.identities.analyst, body);
  assert.equal(first.status, 200, await first.clone().text());
  const rows = await harness.riskHistoryRowsFixture(riskId);
  assert.equal(rows.length, 1, "PATCH_WROTE_NO_HISTORY_ROW");
  assert.equal(rows[0].assessment, assessmentId);
  assert.equal(rows[0].risk, riskId);
  assert.equal(rows[0].undo, false);
  assert.deepEqual(await changesOf(harness, riskId), [{
    kind: "updated", sourceKind: "analyst", actor: harness.users.analyst, aiRun: null,
    changes: { schemaVersion: 1, fields: [
      { field: "riskStatement", from: statement, to: body.riskStatement },
      { field: "riskOwner", from: null, to: { documentId: harness.users.owner, label: await displayNameOf(harness, harness.users.owner) } },
    ] },
  }], "PATCH_HISTORY_ROW");

  const before = await persistedRisk(harness, riskId);
  const again = await patchRisk(harness, riskId, harness.identities.analyst, body);
  assert.equal(again.status, 200, await again.clone().text());
  assert.deepEqual(await persistedRisk(harness, riskId), before, "IDENTICAL_PATCH_CHANGED_THE_RISK_OR_ITS_HISTORY");
});

test("the Risk Register detail's PATCH records the same updated row (D-19)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const detail = await harness.request({ path: `/api/v1/risks/${encodeURIComponent(riskId)}`, identity: harness.identities.analyst });
  assert.equal(detail.status, 200, await detail.clone().text());
  const statement = String((await harness.getRisk(riskId))?.riskStatement);
  const body = { riskStatement: `${statement}, from the register`, riskOwner: harness.users.owner };
  const patched = await patchRisk(harness, riskId, harness.identities.analyst, body);
  assert.equal(patched.status, 200, await patched.clone().text());
  assert.deepEqual(await changesOf(harness, riskId), [{
    kind: "updated", sourceKind: "analyst", actor: harness.users.analyst, aiRun: null,
    changes: { schemaVersion: 1, fields: [
      { field: "riskStatement", from: statement, to: body.riskStatement },
      { field: "riskOwner", from: null, to: { documentId: harness.users.owner, label: await displayNameOf(harness, harness.users.owner) } },
    ] },
  }], "REGISTER_PATCH_HISTORY_ROW");
});

test("a batch that updates two Risks through the inner function inside one mutation completes with no nested serialisation (Pitfall 1)", { timeout: 30_000 }, async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const riskIds = [await freshRisk(harness, assessmentId), await freshRisk(harness, assessmentId)];
  const { updateRiskWithinMutation } = compiledRiskWorkflow();
  assert.equal(typeof updateRiskWithinMutation, "function", "UPDATE_RISK_WITHIN_MUTATION_NOT_EXPORTED");
  const backend = await backendOf(harness);
  const results = await compiledMutationSeam().withMutableAssessmentMutation({
    strapi: backend,
    assessmentDocumentId: assessmentId,
    analystDocumentId: harness.users.analyst,
    transition: (changed: boolean[]) => changed.some(Boolean) ? "accepted-edit" : "none",
    mutate: async ({ assessment }) => {
      const changed: boolean[] = [];
      for (const riskId of riskIds) {
        const result = await updateRiskWithinMutation!({
          strapi: backend, assessment, actorDocumentId: harness.users.analyst, source: { kind: "analyst" },
          riskDocumentId: riskId, fields: { comments: `Batch comment on ${riskId}` }, humanAnalyst: true,
        });
        changed.push(result.changed);
      }
      return changed;
    },
  });
  assert.deepEqual(results, [true, true], "BATCH_RESULTS");
  for (const riskId of riskIds) {
    assert.deepEqual(await changesOf(harness, riskId), [{
      kind: "updated", sourceKind: "analyst", actor: harness.users.analyst, aiRun: null,
      changes: { schemaVersion: 1, fields: [{ field: "comments", from: null, to: `Batch comment on ${riskId}` }] },
    }], `BATCH_HISTORY_OF_${riskId}`);
  }
});

/*
 * 16-04 Task 2 (D-19, D-20): every other analyst path records its change. Add risk and the draft write `created` rows;
 * the control implementation routes write `control-implementation-added`, `-updated` (only the changed fields) and
 * `-removed` (every value it held), each naming the control by number and name.
 */
function json(method: string, payload: unknown): RequestInit {
  return { method, headers: { "content-type": "application/json" }, body: JSON.stringify(payload) };
}

async function controlOf(harness: AuthorizationHttpHarness): Promise<{ documentId: string; controlNumber: string; name: string }> {
  const { controlIds: [controlId] } = await harness.seedUatALikeFixture();
  return harness.withBackendFixture(async (backend) => {
    const control = await (backend.documents as unknown as (uid: string) => { findOne: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null> })("api::csrm-control.csrm-control")
      .findOne({ documentId: controlId });
    assert.ok(control, "CONTROL_FIXTURE_MISSING");
    return { documentId: controlId, controlNumber: String(control.controlNumber), name: String(control.name) };
  });
}

/* The Risk as the history writer reads it: each relation populated, so a relation is recorded with its label. */
async function populatedRisk(harness: AuthorizationHttpHarness, riskId: string): Promise<Record<string, unknown>> {
  return harness.withBackendFixture(async (backend) => {
    const risk = await (backend.documents as unknown as (uid: string) => { findOne: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null> })("api::csrm-risk.csrm-risk")
      .findOne({ documentId: riskId, populate: { riskType: true, riskOwner: true, informationSystemImpacted: true, informationAssetImpacted: true, treatmentOwner: true } });
    assert.ok(risk, "RISK_NOT_FOUND");
    return risk;
  });
}

/* The approved record: a `created` row lists each field the Risk was created with that holds a value, with `from: null`. */
function assertStartingValues(fields: ReadonlyArray<{ field: string; from: unknown; to: unknown }>, risk: Record<string, unknown>, label: string): void {
  assert.ok(fields.length > 0, `${label}_RECORDS_NO_STARTING_VALUES`);
  assert.ok(fields.every((change) => change.from === null && change.to !== null), `${label}_STARTING_VALUE_NOT_FROM_NULL`);
  assert.deepEqual(fields, riskChanges(null, risk, RISK_HISTORY_FIELDS), `${label}_STARTING_VALUES`);
}

test("Add risk records one created row from the analyst listing its starting values with from null (D-19, BE1-01)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const created = await harness.request({ path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`, identity: harness.identities.analyst,
    init: json("POST", { riskStatement: "A risk the analyst adds by hand.", treatmentStatus: "Not Started", riskOwner: harness.users.owner }) });
  assert.equal(created.status, 201, await created.clone().text());
  const riskId = String(((await created.json()) as { data: { documentId: string } }).data.documentId);
  const ownerName = await displayNameOf(harness, harness.users.owner);
  assert.deepEqual(await changesOf(harness, riskId), [{
    kind: "created", sourceKind: "analyst", actor: harness.users.analyst, aiRun: null, changes: { schemaVersion: 1, fields: [
      { field: "riskStatement", from: null, to: "A risk the analyst adds by hand." },
      { field: "riskOwner", from: null, to: { documentId: harness.users.owner, label: ownerName } },
      { field: "treatmentStatus", from: null, to: "Not Started" },
    ] },
  }], "ADD_RISK_HISTORY");
});

test("a deterministic draft records one created row per drafted Risk from the draft run (D-19)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const fixture = await harness.seedUatALikeRequest("CURATION-DRAFT-HISTORY");
  const { assessmentId } = await harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst);
  const assessment = await harness.getAssessment(assessmentId);
  const runId = (assessment?.aiProvenance as { runId?: string } | null)?.runId;
  assert.ok(runId, "DRAFT_NAMES_NO_RUN");
  const riskIds = ((assessment?.risks as Array<Record<string, unknown>> | undefined) ?? []).map((risk) => String(risk.documentId));
  assert.ok(riskIds.length > 0, "DRAFT_HAS_NO_RISKS");
  for (const riskId of riskIds) {
    const rows = await changesOf(harness, riskId);
    assert.deepEqual(rows.map(({ kind, sourceKind, actor, aiRun }) => ({ kind, sourceKind, actor, aiRun })), [{
      kind: "created", sourceKind: "ai-run", actor: harness.users.analyst, aiRun: runId,
    }], `DRAFT_HISTORY_OF_${riskId}`);
    const risk = await populatedRisk(harness, riskId);
    const fields = (rows[0].changes as { fields: Array<{ field: string; from: unknown; to: unknown }> } | null)?.fields ?? [];
    assertStartingValues(fields, risk, `DRAFT_${riskId}`);
    assert.deepEqual(fields.find((change) => change.field === "treatmentStatus"), { field: "treatmentStatus", from: null, to: "Not Started" }, `DRAFT_${riskId}_TREATMENT_STATUS`);
    assert.deepEqual(fields.find((change) => change.field === "riskStatement")?.to, String(risk.riskStatement).trim(), `DRAFT_${riskId}_STATEMENT`);
  }
});

test("a control implementation's add, edit and removal record control-implementation-added, -updated and control-implementation-removed rows (D-20)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const control = await controlOf(harness);
  const controlValue = { documentId: control.documentId, label: control.name };

  const added = await harness.request({ path: `/api/v1/risks/${encodeURIComponent(riskId)}/control_implementations`, identity: harness.identities.analyst,
    init: json("POST", { control: control.documentId, controlStatus: "Planned", evidence: "Initial evidence" }) });
  assert.equal(added.status, 201, await added.clone().text());
  const implementationId = String(((await added.json()) as { data: { documentId: string } }).data.documentId);
  const path = `/api/v1/control_implementations/${encodeURIComponent(implementationId)}`;

  const edited = await harness.request({ path, identity: harness.identities.analyst, init: json("PATCH", { evidence: "Updated evidence", controlStatus: "Planned" }) });
  assert.equal(edited.status, 200, await edited.clone().text());
  const unchanged = await harness.request({ path, identity: harness.identities.analyst, init: json("PATCH", { evidence: "Updated evidence" }) });
  assert.equal(unchanged.status, 200, await unchanged.clone().text());
  const removed = await harness.request({ path, identity: harness.identities.analyst, init: { method: "DELETE" } });
  assert.equal(removed.status, 204, await removed.clone().text());

  const analyst = { sourceKind: "analyst", actor: harness.users.analyst, aiRun: null };
  assert.deepEqual(await changesOf(harness, riskId), [
    { kind: "control-implementation-added", ...analyst, changes: { schemaVersion: 1, control, fields: [
      { field: "control", from: null, to: controlValue },
      { field: "controlStatus", from: null, to: "Planned" },
      { field: "evidence", from: null, to: "Initial evidence" },
    ] } },
    { kind: "control-implementation-updated", ...analyst, changes: { schemaVersion: 1, control, fields: [
      { field: "evidence", from: "Initial evidence", to: "Updated evidence" },
    ] } },
    { kind: "control-implementation-removed", ...analyst, changes: { schemaVersion: 1, control, fields: [
      { field: "control", from: controlValue, to: null },
      { field: "controlStatus", from: "Planned", to: null },
      { field: "evidence", from: "Updated evidence", to: null },
    ] } },
  ], "CONTROL_IMPLEMENTATION_HISTORY");
});

/*
 * D-07, D-44 (T-16-09): a withdrawn Risk is read-only on every path. The Risk is withdrawn through the fixture (16-05
 * adds the operation), and each refusal leaves the Risk, its implementation, its AI provenance and its history equal.
 */
async function withdrawnRiskWithImplementation(harness: AuthorizationHttpHarness, assessmentId: string): Promise<{ riskId: string; implementationId: string }> {
  const riskId = await freshRisk(harness, assessmentId);
  const control = await controlOf(harness);
  const implementationId = await harness.createRiskRegisterMitigationFixture(riskId, control.documentId, "Planned");
  await harness.setRiskWithdrawalFactsFixture(riskId, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: "Duplicate of another risk." });
  return { riskId, implementationId };
}

function curationSnapshot(harness: AuthorizationHttpHarness, riskId: string, implementationId: string): Promise<unknown[]> {
  return harness.snapshot([
    () => harness.getRisk(riskId), () => harness.getControlImplementation(implementationId), () => harness.riskWithdrawalFactsFixture(riskId),
    () => harness.riskHistoryRowsFixture(riskId), () => harness.countControlImplementationsForRisk(riskId),
  ]);
}

async function refusals(harness: AuthorizationHttpHarness, riskId: string, implementationId: string, control: string): Promise<Array<[string, Response]>> {
  const riskPath = `/api/v1/risks/${encodeURIComponent(riskId)}`;
  const implementationPath = `/api/v1/control_implementations/${encodeURIComponent(implementationId)}`;
  const register = await harness.request({ path: riskPath, identity: harness.identities.analyst });
  return [
    ["EDITOR_PATCH", await patchRisk(harness, riskId, harness.identities.analyst, { comments: "Changed while withdrawn" })],
    ["REGISTER_PATCH", register.status === 200 ? await patchRisk(harness, riskId, harness.identities.analyst, { riskStatement: "Restated while withdrawn" }) : register],
    ["SERVICE_AGENT_PATCH", await patchRisk(harness, riskId, harness.identities.serviceAnalystAgent, { comments: "Agent change while withdrawn" })],
    ["CONTROL_CREATE", await harness.request({ path: `${riskPath}/control_implementations`, identity: harness.identities.analyst, init: json("POST", { control, controlStatus: "Planned" }) })],
    ["CONTROL_UPDATE", await harness.request({ path: implementationPath, identity: harness.identities.analyst, init: json("PATCH", { evidence: "Evidence while withdrawn" }) })],
    ["CONTROL_DELETE", await harness.request({ path: implementationPath, identity: harness.identities.analyst, init: { method: "DELETE" } })],
  ];
}

async function reasonOf(response: Response): Promise<string | undefined> {
  return ((await response.json()) as { error?: { details?: { reason?: string } } }).error?.details?.reason;
}

test("every mutation of a withdrawn Risk is refused 409 RISK_WITHDRAWN and changes nothing (D-07, D-44)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await draftedAssessment(harness);
  const control = await controlOf(harness);
  const active = await freshRisk(harness, assessmentId);
  const agentOnActive = await patchRisk(harness, active, harness.identities.serviceAnalystAgent, { comments: "The agent's grant still works on an active risk." });
  assert.equal(agentOnActive.status, 200, `SERVICE_AGENT_ACTIVE_RISK: ${await agentOnActive.clone().text()}`);

  const { riskId, implementationId } = await withdrawnRiskWithImplementation(harness, assessmentId);
  const before = await curationSnapshot(harness, riskId, implementationId);
  for (const [label, response] of await refusals(harness, riskId, implementationId, control.documentId)) {
    assert.equal(response.status, 409, `${label}_STATUS: ${await response.clone().text()}`);
    assert.equal(await reasonOf(response), "RISK_WITHDRAWN", `${label}_REASON`);
  }
  assert.deepEqual(await curationSnapshot(harness, riskId, implementationId), before, "A_REFUSED_MUTATION_CHANGED_THE_WITHDRAWN_RISK");
});

test("on a released assessment the same mutations answer ASSESSMENT_NOT_MUTABLE before the withdrawn check (D-22 before D-07)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const fixture = await harness.seedUatALikeRequest("CURATION-RELEASED");
  const { assessmentId } = await harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst);
  const control = await controlOf(harness);
  const { riskId, implementationId } = await withdrawnRiskWithImplementation(harness, assessmentId);
  await harness.updateFixtureDocument("api::csrm-assessment.csrm-assessment", assessmentId, {
    assessmentStatus: "approved", approvedBy: harness.users.analyst, approvalDate: "2026-10-01T00:00:00.000Z",
  });
  const before = await curationSnapshot(harness, riskId, implementationId);
  for (const [label, response] of await refusals(harness, riskId, implementationId, control.documentId)) {
    if (label === "REGISTER_PATCH" && response.status !== 409) continue;
    assert.equal(response.status, 409, `${label}_STATUS: ${await response.clone().text()}`);
    assert.equal(await reasonOf(response), "ASSESSMENT_NOT_MUTABLE", `${label}_REASON`);
  }
  assert.deepEqual(await curationSnapshot(harness, riskId, implementationId), before, "A_REFUSED_MUTATION_CHANGED_THE_RELEASED_RISK");
});

/*
 * 16-05 (D-05, D-06, D-09 to D-12, D-21, D-43, D-44): withdrawal, reinstatement with Undo and the history read are
 * served to human Security Analysts only. Every refusal leaves the Risk, its withdrawal facts, its history and the
 * assessment deep-equal.
 */
type CurationOperation = "risk_withdrawals" | "risk_reinstatements";
type CurationResult = { applied: string[]; unchanged: string[] };

function curate(harness: AuthorizationHttpHarness, operation: CurationOperation, assessmentId: string, identity: string, body: unknown): Promise<Response> {
  return harness.request({ path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/${operation}`, identity, init: json("POST", body) });
}

async function curationData(response: Response, label: string): Promise<CurationResult> {
  const text = await response.text();
  assert.equal(response.status, 200, `${label}: ${text}`);
  return (JSON.parse(text) as { data: CurationResult }).data;
}

let curationSequence = 0;
/*
 * An assessment of its own: by default a draft on a request in risk-assessment-drafted raised by Jane. `request` and
 * `assessment` add or override fields (a requestor, an assignee, a review state).
 */
async function curationAssessment(
  harness: AuthorizationHttpHarness,
  options: { request?: Record<string, unknown>; assessment?: Record<string, unknown> } = {},
): Promise<{ requestId: string; assessmentId: string }> {
  curationSequence += 1;
  const sequence = String(curationSequence).padStart(3, "0");
  const requestId = await harness.createFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", {
    requestNumber: `REQ-CURATION-${sequence}`, title: `Curation request ${sequence}`, requestStatus: "risk-assessment-drafted", requestor: harness.users.owner,
    ...options.request,
  });
  const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: `ASM-2026-CUR${sequence}`, assessmentStatus: "draft", assessmentRequest: requestId, ...options.assessment,
  });
  return { requestId, assessmentId };
}

/*
 * The Risk as stored, less the facts a withdrawal or reinstatement writes, the timestamps every Document Service update
 * moves (`updatedAt`, and `publishedAt` on a type without draft and publish) and its assessment's own state.
 */
async function riskContent(harness: AuthorizationHttpHarness, riskId: string): Promise<Record<string, unknown>> {
  const risk = await harness.getRisk(riskId);
  assert.ok(risk, "CURATION_RISK_MISSING");
  const { updatedAt: _updatedAt, publishedAt: _publishedAt, withdrawnAt: _withdrawnAt, withdrawalReason: _withdrawalReason, assessment, ...content } = risk;
  return { ...content, assessment: (assessment as { documentId?: unknown } | null)?.documentId ?? null };
}

function curationState(harness: AuthorizationHttpHarness, assessmentId: string, riskIds: readonly string[]): Promise<unknown[]> {
  return harness.snapshot([
    () => harness.getAssessment(assessmentId),
    ...riskIds.flatMap((riskId) => [() => harness.getRisk(riskId), () => harness.riskWithdrawalFactsFixture(riskId), () => harness.riskHistoryRowsFixture(riskId)]),
  ]);
}

async function curationRows(harness: AuthorizationHttpHarness, riskId: string, kind: "withdrawn" | "reinstated"): Promise<Array<Record<string, unknown>>> {
  return (await harness.riskHistoryRowsFixture(riskId)).filter((row) => row.kind === kind);
}

const WRONG_TYPE_REASON = "Proposed under the wrong Risk Type";

test("a human Security Analyst withdraws a Risk with a reason that keeps its number, fields, control implementations and AI provenance, and records one withdrawn row (D-05, D-06, D-09)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const fixture = await harness.seedUatALikeRequest("CURATION-WITHDRAW");
  const { assessmentId } = await harness.runAssessmentDraftJobFixture(fixture.questionnaireId, harness.users.analyst);
  const [riskId] = (((await harness.getAssessment(assessmentId))?.risks as Array<Record<string, unknown>> | undefined) ?? []).map((risk) => String(risk.documentId));
  assert.ok(riskId, "CURATION_WITHDRAW_DRAFT_HAS_NO_RISKS");
  const control = await controlOf(harness);
  await harness.createRiskRegisterMitigationFixture(riskId, control.documentId, "Planned");
  const content = await riskContent(harness, riskId);
  assert.ok(content.aiProvenance, "CURATION_WITHDRAW_RISK_WITHOUT_AI_PROVENANCE");
  assert.equal((content.controlImplementations as unknown[]).length > 0, true, "CURATION_WITHDRAW_RISK_WITHOUT_CONTROLS");
  const historyBefore = await harness.riskHistoryRowsFixture(riskId);

  const startedAt = Date.now();
  const withdrawn = await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: WRONG_TYPE_REASON });
  assert.deepEqual(await curationData(withdrawn, "WITHDRAWAL"), { applied: [riskId], unchanged: [] });
  const facts = await harness.riskWithdrawalFactsFixture(riskId);
  assert.ok(facts, "CURATION_WITHDRAWN_RISK_MISSING");
  assert.equal(facts.withdrawnBy, harness.users.analyst, "WITHDRAWN_BY");
  assert.equal(facts.withdrawalReason, WRONG_TYPE_REASON, "WITHDRAWAL_REASON");
  const withdrawnAt = Date.parse(String(facts.withdrawnAt));
  assert.ok(withdrawnAt >= startedAt - 1_000 && withdrawnAt <= Date.now() + 1_000, `WITHDRAWN_AT_NOT_THE_SERVER_CLOCK_${String(facts.withdrawnAt)}`);
  assert.deepEqual(await riskContent(harness, riskId), content, "WITHDRAWAL_CHANGED_THE_RISK_CONTENT");

  const history = await harness.riskHistoryRowsFixture(riskId);
  assert.deepEqual(history.slice(0, historyBefore.length), historyBefore, "WITHDRAWAL_REWROTE_HISTORY");
  assert.equal(history.length, historyBefore.length + 1, "WITHDRAWAL_HISTORY_ROW_COUNT");
  const [row] = history.slice(historyBefore.length);
  assert.equal(row.kind, "withdrawn");
  assert.equal(row.reason, WRONG_TYPE_REASON);
  assert.equal(row.actor, harness.users.analyst);
  assert.equal(row.sourceKind, "analyst");
  assert.equal(row.undo, false);
  assert.equal(row.assessment, assessmentId);
  assert.equal(Date.parse(String(row.occurredAt)), withdrawnAt, "WITHDRAWN_ROW_TIME_IS_NOT_THE_FACT_TIME");
  assert.deepEqual(parseRiskHistoryChanges(row.changes), { schemaVersion: 1, fields: [] });

  const before = await curationState(harness, assessmentId, [riskId]);
  const again = await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: WRONG_TYPE_REASON });
  assert.deepEqual(await curationData(again, "REPEATED_WITHDRAWAL"), { applied: [], unchanged: [riskId] });
  assert.deepEqual(await curationState(harness, assessmentId, [riskId]), before, "REPEATED_WITHDRAWAL_CHANGED_SOMETHING");
});

test("the request's Requestor, an unrelated Requestor and the service agent are refused the withdrawal with 403 and nothing changes (D-43)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const before = await curationState(harness, assessmentId, [riskId]);
  for (const [label, identity] of [["OWNER", harness.identities.owner], ["OTHER_REQUESTOR", harness.identities.otherRequestor], ["SERVICE_AGENT", harness.identities.serviceAnalystAgent]] as const) {
    const response = await curate(harness, "risk_withdrawals", assessmentId, identity, { riskIds: [riskId], reason: WRONG_TYPE_REASON });
    assert.equal(response.status, 403, `${label}_WITHDRAWAL_STATUS: ${await response.clone().text()}`);
    assert.ok(!(await response.text()).includes(riskId), `${label}_WITHDRAWAL_ECHOED_THE_RISK`);
  }
  assert.deepEqual(await curationState(harness, assessmentId, [riskId]), before, "A_REFUSED_WITHDRAWAL_CHANGED_SOMETHING");
});

test("the request's Requestor, an unrelated Requestor and the service agent are refused the reinstatement with 403 and nothing changes (D-43)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  await harness.setRiskWithdrawalFactsFixture(riskId, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: WRONG_TYPE_REASON });
  const before = await curationState(harness, assessmentId, [riskId]);
  for (const [label, identity] of [["OWNER", harness.identities.owner], ["OTHER_REQUESTOR", harness.identities.otherRequestor], ["SERVICE_AGENT", harness.identities.serviceAnalystAgent]] as const) {
    for (const body of [{ riskIds: [riskId], reason: "Reinstated by someone else" }, { riskIds: [riskId], undo: true }]) {
      const response = await curate(harness, "risk_reinstatements", assessmentId, identity, body);
      assert.equal(response.status, 403, `${label}_REINSTATEMENT_STATUS: ${await response.clone().text()}`);
      assert.ok(!(await response.text()).includes(riskId), `${label}_REINSTATEMENT_ECHOED_THE_RISK`);
    }
  }
  assert.deepEqual(await curationState(harness, assessmentId, [riskId]), before, "A_REFUSED_REINSTATEMENT_CHANGED_SOMETHING");
});

const NO_FACTS = { withdrawnAt: null, withdrawnBy: null, withdrawalReason: null };

test("reinstatement with a reason clears the three facts, records a reinstated row and keeps both rows in the history (D-10)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const content = await riskContent(harness, riskId);
  assert.deepEqual(await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: WRONG_TYPE_REASON }), "WITHDRAWAL"), { applied: [riskId], unchanged: [] });
  const reinstated = await curate(harness, "risk_reinstatements", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: "  New note changes the reason  " });
  assert.deepEqual(await curationData(reinstated, "REINSTATEMENT"), { applied: [riskId], unchanged: [] });
  assert.deepEqual(await harness.riskWithdrawalFactsFixture(riskId), NO_FACTS, "REINSTATEMENT_KEPT_A_FACT");
  assert.deepEqual(await riskContent(harness, riskId), content, "REINSTATEMENT_CHANGED_THE_RISK_CONTENT");
  const rows = await harness.riskHistoryRowsFixture(riskId);
  assert.deepEqual(rows.map((row) => [row.kind, row.reason, row.undo, row.actor, row.sourceKind]), [
    ["withdrawn", WRONG_TYPE_REASON, false, harness.users.analyst, "analyst"],
    ["reinstated", "New note changes the reason", false, harness.users.analyst, "analyst"],
  ], "REINSTATEMENT_HISTORY");
  assert.deepEqual(parseRiskHistoryChanges(rows[1].changes), { schemaVersion: 1, fields: [] });
});

test("undo both ways: undo: true reinstates with 'Withdrawal undone' and withdraws again with the earlier reason, both marked undo; a typed 'Withdrawal undone' is no undo (D-11)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  const reason = "Duplicate of an existing risk.";
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason }), "WITHDRAWAL");

  assert.deepEqual(await curationData(await curate(harness, "risk_reinstatements", assessmentId, harness.identities.analyst, { riskIds: [riskId], undo: true }), "UNDO_WITHDRAWAL"), { applied: [riskId], unchanged: [] });
  assert.deepEqual(await harness.riskWithdrawalFactsFixture(riskId), NO_FACTS, "UNDO_WITHDRAWAL_KEPT_A_FACT");
  assert.deepEqual((await curationRows(harness, riskId, "reinstated")).map((row) => [row.reason, row.undo]), [["Withdrawal undone", true]], "UNDO_WITHDRAWAL_ROW");

  assert.deepEqual(await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], undo: true }), "UNDO_REINSTATEMENT"), { applied: [riskId], unchanged: [] });
  const facts = await harness.riskWithdrawalFactsFixture(riskId);
  assert.equal(facts?.withdrawalReason, reason, "UNDO_REINSTATEMENT_DID_NOT_RESTORE_THE_REASON");
  assert.equal(facts?.withdrawnBy, harness.users.analyst);
  assert.deepEqual((await curationRows(harness, riskId, "withdrawn")).map((row) => [row.reason, row.undo]), [[reason, false], [reason, true]], "UNDO_REINSTATEMENT_ROW");

  await curationData(await curate(harness, "risk_reinstatements", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: "Withdrawal undone" }), "TYPED_UNDO_WORDS");
  assert.deepEqual((await curationRows(harness, riskId, "reinstated")).map((row) => [row.reason, row.undo]), [["Withdrawal undone", true], ["Withdrawal undone", false]], "A_TYPED_REASON_MARKED_AN_UNDO");

  const neverWithdrawn = await freshRisk(harness, assessmentId);
  const before = await curationState(harness, assessmentId, [neverWithdrawn]);
  const refused = await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [neverWithdrawn], undo: true });
  assert.equal(refused.status, 400, `UNDO_WITH_NOTHING_TO_RESTORE: ${await refused.clone().text()}`);
  assert.deepEqual(await curationState(harness, assessmentId, [neverWithdrawn]), before, "A_REFUSED_UNDO_CHANGED_SOMETHING");
});

/*
 * The Phase 16 code review amendment (2026-10-16; 16-REVIEW BE1-03): an Undo binds to the act it reverses. A
 * reinstatement Undo needs the Risk's current withdrawal to be the actor's and its latest history row; a withdrawal Undo
 * needs the latest history row to be the actor's reinstatement. Any Risk failing it refuses the batch with 409
 * RISK_CURATION_UNDO_UNAVAILABLE and nothing is written.
 */
async function refusedUndo(harness: AuthorizationHttpHarness, operation: CurationOperation, assessmentId: string, identity: string, riskIds: string[], label: string): Promise<void> {
  const before = await curationState(harness, assessmentId, riskIds);
  const response = await curate(harness, operation, assessmentId, identity, { riskIds, undo: true });
  assert.equal(response.status, 409, `${label}_STATUS: ${await response.clone().text()}`);
  assert.equal(await reasonOf(response), "RISK_CURATION_UNDO_UNAVAILABLE", `${label}_REASON`);
  assert.deepEqual(await curationState(harness, assessmentId, riskIds), before, `${label}_CHANGED_SOMETHING`);
}

test("another analyst's withdrawal cannot be reinstated by Undo: 409 RISK_CURATION_UNDO_UNAVAILABLE for the whole batch, nothing written (BE1-03 a)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const [bobs, own] = [await freshRisk(harness, assessmentId), await freshRisk(harness, assessmentId)];
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [bobs], reason: WRONG_TYPE_REASON }), "BOB_WITHDRAWAL");
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.secondAnalyst, { riskIds: [own], reason: WRONG_TYPE_REASON }), "SECOND_WITHDRAWAL");
  await refusedUndo(harness, "risk_reinstatements", assessmentId, harness.identities.secondAnalyst, [bobs], "ANOTHER_ANALYSTS_WITHDRAWAL");
  await refusedUndo(harness, "risk_reinstatements", assessmentId, harness.identities.secondAnalyst, [own, bobs], "A_MIXED_BATCH");
  // A reinstatement with a reason stays open to every Security Analyst (D-44).
  assert.deepEqual(await curationData(await curate(harness, "risk_reinstatements", assessmentId, harness.identities.secondAnalyst, { riskIds: [bobs], reason: "Back in scope" }), "REASONED_REINSTATEMENT"), { applied: [bobs], unchanged: [] });
});

test("a withdrawal Undo is refused once the Risk's latest act is not the actor's reinstatement: after an edit, or another analyst's reinstatement (BE1-03 b)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const [edited, reinstatedByOther] = [await freshRisk(harness, assessmentId), await freshRisk(harness, assessmentId)];
  for (const riskId of [edited, reinstatedByOther]) {
    await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: WRONG_TYPE_REASON }), "WITHDRAWAL");
  }
  await curationData(await curate(harness, "risk_reinstatements", assessmentId, harness.identities.analyst, { riskIds: [edited], reason: "Back in scope" }), "REINSTATEMENT");
  const patched = await patchRisk(harness, edited, harness.identities.analyst, { riskStatement: "Restated after its reinstatement." });
  assert.equal(patched.status, 200, await patched.clone().text());
  await refusedUndo(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, [edited], "UNDO_AFTER_AN_EDIT");
  await curationData(await curate(harness, "risk_reinstatements", assessmentId, harness.identities.secondAnalyst, { riskIds: [reinstatedByOther], reason: "Back in scope" }), "OTHER_REINSTATEMENT");
  await refusedUndo(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, [reinstatedByOther], "UNDO_OF_ANOTHER_ANALYSTS_REINSTATEMENT");
});

test("the immediate Undo of the actor's own act still applies both ways (BE1-03 c)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.secondAnalyst, { riskIds: [riskId], reason: WRONG_TYPE_REASON }), "WITHDRAWAL");
  assert.deepEqual(await curationData(await curate(harness, "risk_reinstatements", assessmentId, harness.identities.secondAnalyst, { riskIds: [riskId], undo: true }), "UNDO_WITHDRAWAL"), { applied: [riskId], unchanged: [] });
  assert.deepEqual(await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.secondAnalyst, { riskIds: [riskId], undo: true }), "UNDO_REINSTATEMENT"), { applied: [riskId], unchanged: [] });
  assert.deepEqual((await harness.riskHistoryRowsFixture(riskId)).map((row) => [row.kind, row.undo, row.actor]), [
    ["withdrawn", false, harness.users.secondAnalyst], ["reinstated", true, harness.users.secondAnalyst], ["withdrawn", true, harness.users.secondAnalyst],
  ], "SAME_ACTOR_UNDO_HISTORY");
});

test("reinstating only active Risks is refused 409 RISK_NOT_WITHDRAWN and changes nothing, and a mixed batch reinstates the withdrawn one and reports the active one unchanged (D-10)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const [active, withdrawn] = [await freshRisk(harness, assessmentId), await freshRisk(harness, assessmentId)];
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [withdrawn], reason: WRONG_TYPE_REASON }), "WITHDRAWAL");
  const before = await curationState(harness, assessmentId, [active, withdrawn]);
  for (const body of [{ riskIds: [active], reason: "Reinstate an active risk" }, { riskIds: [active], undo: true }]) {
    const refused = await curate(harness, "risk_reinstatements", assessmentId, harness.identities.analyst, body);
    assert.equal(refused.status, 409, `ACTIVE_REINSTATEMENT_STATUS: ${await refused.clone().text()}`);
    assert.equal(await reasonOf(refused), "RISK_NOT_WITHDRAWN");
  }
  assert.deepEqual(await curationState(harness, assessmentId, [active, withdrawn]), before, "RISK_NOT_WITHDRAWN_CHANGED_SOMETHING");

  const mixed = await curate(harness, "risk_reinstatements", assessmentId, harness.identities.analyst, { riskIds: [active, withdrawn], reason: "Back in scope" });
  assert.deepEqual(await curationData(mixed, "MIXED_REINSTATEMENT"), { applied: [withdrawn], unchanged: [active] });
  assert.deepEqual(await harness.riskWithdrawalFactsFixture(withdrawn), NO_FACTS);
  assert.deepEqual(await curationRows(harness, active, "reinstated"), [], "AN_UNCHANGED_RISK_GOT_A_ROW");
});

test("a batch naming a Risk of another assessment, or one that does not exist, is 404 for the whole batch, and every malformed body is a 400, each changing nothing (D-09)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const { assessmentId: otherAssessmentId } = await curationAssessment(harness);
  const own = await freshRisk(harness, assessmentId);
  const foreign = await freshRisk(harness, otherAssessmentId);
  await harness.setRiskWithdrawalFactsFixture(foreign, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: WRONG_TYPE_REASON });
  const before = await curationState(harness, assessmentId, [own, foreign]);
  for (const operation of ["risk_withdrawals", "risk_reinstatements"] as const) {
    for (const [label, riskIds] of [["FOREIGN", [own, foreign]], ["UNKNOWN", [own, "no-such-risk"]]] as const) {
      const response = await curate(harness, operation, assessmentId, harness.identities.analyst, { riskIds, reason: WRONG_TYPE_REASON });
      const text = await response.text();
      assert.equal(response.status, 404, `${operation}_${label}_STATUS: ${text}`);
      assert.ok(!text.includes(foreign) && !text.includes("no-such-risk"), `${operation}_${label}_NAMED_THE_FAILING_ID`);
    }
    const bodies: Array<[string, unknown]> = [
      ["TWO_HUNDRED_AND_ONE_IDS", { riskIds: Array.from({ length: 201 }, (_, index) => `risk-${index}`), reason: WRONG_TYPE_REASON }],
      ["DUPLICATE_ID", { riskIds: [own, own], reason: WRONG_TYPE_REASON }],
      ["NO_IDS", { riskIds: [], reason: WRONG_TYPE_REASON }],
      ["REASON_501", { riskIds: [own], reason: "x".repeat(501) }],
      ["BLANK_REASON", { riskIds: [own], reason: "   " }],
      ["REASON_AND_UNDO", { riskIds: [own], reason: WRONG_TYPE_REASON, undo: true }],
      ["UNDO_FALSE", { riskIds: [own], undo: false }],
      ["UNKNOWN_KEY", { riskIds: [own], reason: WRONG_TYPE_REASON, force: true }],
      ["NEITHER", { riskIds: [own] }],
    ];
    for (const [label, body] of bodies) {
      const response = await curate(harness, operation, assessmentId, harness.identities.analyst, body);
      assert.equal(response.status, 400, `${operation}_${label}_STATUS: ${await response.clone().text()}`);
    }
  }
  assert.deepEqual(await curationState(harness, assessmentId, [own, foreign]), before, "A_REFUSED_BATCH_CHANGED_SOMETHING");
});

async function reviewState(harness: AuthorizationHttpHarness, assessmentId: string): Promise<{ assessmentStatus: unknown; reviewedBy: string | null; requestStatus: unknown }> {
  return harness.withBackendFixture(async (backend) => {
    const assessment = await (backend.documents as unknown as (uid: string) => { findOne: (input: Record<string, unknown>) => Promise<Record<string, unknown> | null> })("api::csrm-assessment.csrm-assessment")
      .findOne({ documentId: assessmentId, populate: { reviewedBy: { fields: ["documentId"] }, assessmentRequest: { fields: ["requestStatus"] } } });
    return {
      assessmentStatus: assessment?.assessmentStatus,
      reviewedBy: (assessment?.reviewedBy as { documentId?: string } | null)?.documentId ?? null,
      requestStatus: (assessment?.assessmentRequest as { requestStatus?: unknown } | null)?.requestStatus,
    };
  });
}

let readyRiskSequence = 0;
async function readyRisk(harness: AuthorizationHttpHarness, assessmentId: string): Promise<string> {
  readyRiskSequence += 1;
  return harness.createRiskRegisterFixture(assessmentId, {
    riskNumber: `RSK-CURATION-READY-${String(readyRiskSequence).padStart(3, "0")}`, riskStatement: `Release-ready curation risk ${readyRiskSequence}`,
    inherentLikelihood: "Likely", highestInherentConsequence: "Major", inherentRating: "High",
    residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRating: "Moderate",
    riskOwner: harness.users.owner, treatmentAction: "Accept", targetDate: "2027-08-30",
  });
}

test("withdrawal takes the edit transition only when it applies something: a release-ready in-review assessment returns to draft, an all-unchanged batch leaves it in review, and the last active Risk may be withdrawn (D-12, D-23)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness, {
    request: { requestStatus: "under-review" },
    assessment: { assessmentStatus: "in-review", reviewedBy: harness.users.analyst, summary: "Reviewed curation fixture", overallRating: "High", overallRiskRationale: "Review is complete" },
  });
  const [first, last, alreadyWithdrawn] = [await readyRisk(harness, assessmentId), await readyRisk(harness, assessmentId), await readyRisk(harness, assessmentId)];
  await harness.setRiskWithdrawalFactsFixture(alreadyWithdrawn, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: WRONG_TYPE_REASON });
  const detail = await harness.request({ path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, identity: harness.identities.analyst });
  assert.equal(detail.status, 200, await detail.clone().text());
  assert.equal(((await detail.json()) as { data: { releaseReadiness: { ready: boolean } } }).data.releaseReadiness.ready, true, "THE_FIXTURE_IS_NOT_RELEASE_READY");
  const reviewed = { assessmentStatus: "in-review", reviewedBy: harness.users.analyst, requestStatus: "under-review" };
  assert.deepEqual(await reviewState(harness, assessmentId), reviewed);

  const before = await curationState(harness, assessmentId, [alreadyWithdrawn]);
  assert.deepEqual(await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [alreadyWithdrawn], reason: WRONG_TYPE_REASON }), "ALL_UNCHANGED"), { applied: [], unchanged: [alreadyWithdrawn] });
  assert.deepEqual(await curationState(harness, assessmentId, [alreadyWithdrawn]), before, "AN_ALL_UNCHANGED_WITHDRAWAL_CHANGED_SOMETHING");
  assert.deepEqual(await reviewState(harness, assessmentId), reviewed, "AN_ALL_UNCHANGED_WITHDRAWAL_WITHDREW_THE_REVIEW");

  assert.deepEqual(await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [first], reason: WRONG_TYPE_REASON }), "WITHDRAWAL"), { applied: [first], unchanged: [] });
  assert.deepEqual(await reviewState(harness, assessmentId), { ...reviewed, assessmentStatus: "draft" }, "A_WITHDRAWAL_DID_NOT_RETURN_THE_REVIEWED_ASSESSMENT_TO_DRAFT");

  assert.deepEqual(await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [last], reason: "The last active risk is wrong too" }), "LAST_ACTIVE_WITHDRAWAL"), { applied: [last], unchanged: [] });
  assert.equal((await harness.riskWithdrawalFactsFixture(last))?.withdrawalReason, "The last active risk is wrong too");
});

test("on a released assessment withdrawal and reinstatement answer 409 ASSESSMENT_NOT_MUTABLE and change nothing (success criterion 4, D-22)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const [active, withdrawn] = [await freshRisk(harness, assessmentId), await freshRisk(harness, assessmentId)];
  await harness.setRiskWithdrawalFactsFixture(withdrawn, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: WRONG_TYPE_REASON });
  await harness.updateFixtureDocument("api::csrm-assessment.csrm-assessment", assessmentId, {
    assessmentStatus: "approved", approvedBy: harness.users.analyst, approvalDate: "2026-10-01T00:00:00.000Z",
  });
  const before = await curationState(harness, assessmentId, [active, withdrawn]);
  const attempts: Array<[string, CurationOperation, unknown]> = [
    ["WITHDRAW", "risk_withdrawals", { riskIds: [active], reason: WRONG_TYPE_REASON }],
    ["WITHDRAW_UNDO", "risk_withdrawals", { riskIds: [active], undo: true }],
    ["REINSTATE", "risk_reinstatements", { riskIds: [withdrawn], reason: "Released risks stay as released" }],
    ["REINSTATE_UNDO", "risk_reinstatements", { riskIds: [withdrawn], undo: true }],
  ];
  for (const [label, operation, body] of attempts) {
    const response = await curate(harness, operation, assessmentId, harness.identities.analyst, body);
    assert.equal(response.status, 409, `${label}_STATUS: ${await response.clone().text()}`);
    assert.equal(await reasonOf(response), "ASSESSMENT_NOT_MUTABLE", `${label}_REASON`);
  }
  assert.deepEqual(await curationState(harness, assessmentId, [active, withdrawn]), before, "A_RELEASED_CURATION_CHANGED_SOMETHING");
});

test("every Security Analyst on the request may curate: the second analyst who is not the assignee, and the requesting analyst on a request he raised, withdraw and reinstate (D-44)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const cases: Array<[string, string, string, Record<string, unknown>]> = [
    ["SECOND_ANALYST", harness.identities.secondAnalyst, harness.users.secondAnalyst, { assignedAnalyst: harness.users.analyst }],
    ["REQUESTING_ANALYST", harness.identities.analyst, harness.users.analyst, { requestor: harness.users.analyst }],
  ];
  for (const [label, identity, user, request] of cases) {
    const { assessmentId } = await curationAssessment(harness, { request });
    const riskId = await freshRisk(harness, assessmentId);
    assert.deepEqual(await curationData(await curate(harness, "risk_withdrawals", assessmentId, identity, { riskIds: [riskId], reason: WRONG_TYPE_REASON }), `${label}_WITHDRAWAL`), { applied: [riskId], unchanged: [] });
    assert.equal((await harness.riskWithdrawalFactsFixture(riskId))?.withdrawnBy, user, `${label}_WITHDRAWN_BY`);
    assert.deepEqual(await curationData(await curate(harness, "risk_reinstatements", assessmentId, identity, { riskIds: [riskId], undo: true }), `${label}_REINSTATEMENT`), { applied: [riskId], unchanged: [] });
    assert.deepEqual((await harness.riskHistoryRowsFixture(riskId)).map((row) => [row.kind, row.actor]), [["withdrawn", user], ["reinstated", user]], `${label}_HISTORY`);
  }
});

/* 16-05 Task 3 (D-21): the history read, human Security Analyst only, newest first, with the honest start. */
type HistoryResponse = {
  data: Array<{ id: string; kind: string; occurredAt: string; actor: { documentId: string; displayName: string } | null; sourceKind: string; aiRunId: string | null; proposalItem: string | null; reason: string | null; undo: boolean; changes: unknown }>;
  meta: { pagination: { page: number; pageSize: number; pageCount: number; total: number }; recordedFrom: string | null };
};

function readHistory(harness: AuthorizationHttpHarness, riskId: string, identity: string, query = ""): Promise<Response> {
  return harness.request({ path: `/api/v1/risks/${encodeURIComponent(riskId)}/history${query}`, identity });
}

test("a human Security Analyst reads a Risk's history newest first with its pagination and recordedFrom, a withdrawn Risk's included (D-21)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: WRONG_TYPE_REASON }), "WITHDRAWAL");
  await curationData(await curate(harness, "risk_reinstatements", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: "Back in scope" }), "REINSTATEMENT");
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], undo: true }), "UNDO_REINSTATEMENT");
  assert.ok((await harness.riskWithdrawalFactsFixture(riskId))?.withdrawnAt, "THE_RISK_IS_NOT_WITHDRAWN");

  const response = await readHistory(harness, riskId, harness.identities.analyst);
  const text = await response.text();
  assert.equal(response.status, 200, text);
  const body = JSON.parse(text) as HistoryResponse;
  assert.deepEqual(Object.keys(body).sort(), ["data", "meta"]);
  const bob = { documentId: harness.users.analyst, displayName: await displayNameOf(harness, harness.users.analyst) };
  assert.deepEqual(body.data.map((event) => [event.kind, event.reason, event.undo]), [
    ["withdrawn", WRONG_TYPE_REASON, true],
    ["reinstated", "Back in scope", false],
    ["withdrawn", WRONG_TYPE_REASON, false],
  ], "HISTORY_NOT_NEWEST_FIRST");
  for (const event of body.data) {
    assert.deepEqual(event.actor, bob, "HISTORY_ACTOR");
    assert.equal(event.sourceKind, "analyst");
    assert.equal(event.aiRunId, null);
    assert.equal(event.proposalItem, null);
    assert.deepEqual(event.changes, { schemaVersion: 1, fields: [] });
  }
  assert.deepEqual(body.meta.pagination, { page: 1, pageSize: 25, pageCount: 1, total: 3 }, "HISTORY_PAGINATION");
  assert.equal(body.meta.recordedFrom, body.data[2].occurredAt, "HISTORY_RECORDED_FROM");

  const second = await readHistory(harness, riskId, harness.identities.analyst, "?page=2&pageSize=2");
  assert.equal(second.status, 200, await second.clone().text());
  const secondBody = (await second.json()) as HistoryResponse;
  assert.deepEqual(secondBody.data.map((event) => event.id), [body.data[2].id], "HISTORY_SECOND_PAGE");
  assert.deepEqual(secondBody.meta, { pagination: { page: 2, pageSize: 2, pageCount: 2, total: 3 }, recordedFrom: body.meta.recordedFrom });

  const emptyRiskId = await freshRisk(harness, assessmentId);
  const empty = await readHistory(harness, emptyRiskId, harness.identities.analyst);
  assert.equal(empty.status, 200, await empty.clone().text());
  assert.deepEqual(await empty.json(), { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }, recordedFrom: null } }, "EMPTY_HISTORY");
});

test("the history read refuses a malformed page with 400 and answers an unknown Risk with a 404 that names nothing (D-21)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  for (const query of ["?pageSize=101", "?pageSize=2.5", "?pageSize=0", "?page=0", "?page=abc", "?page=1&page=2", "?sort=occurredAt:asc", "?page=-1"]) {
    const response = await readHistory(harness, riskId, harness.identities.analyst, query);
    assert.equal(response.status, 400, `HISTORY_QUERY_${query}: ${await response.clone().text()}`);
  }
  const unknown = await readHistory(harness, "no-such-risk", harness.identities.analyst);
  const text = await unknown.text();
  assert.equal(unknown.status, 404, text);
  assert.ok(!text.includes("no-such-risk"), "UNKNOWN_RISK_ECHOED");
});

test("the request's Requestor, an unrelated Requestor and the service agent are refused the history read with 403 (D-43)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const riskId = await freshRisk(harness, assessmentId);
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [riskId], reason: WRONG_TYPE_REASON }), "WITHDRAWAL");
  for (const [label, identity] of [["OWNER", harness.identities.owner], ["OTHER_REQUESTOR", harness.identities.otherRequestor], ["SERVICE_AGENT", harness.identities.serviceAnalystAgent]] as const) {
    const response = await readHistory(harness, riskId, identity);
    const text = await response.text();
    assert.equal(response.status, 403, `${label}_HISTORY_STATUS: ${text}`);
    assert.ok(!text.includes(WRONG_TYPE_REASON) && !text.includes(riskId), `${label}_HISTORY_DISCLOSED`);
  }
});

/*
 * 16-06 (D-08, D-12, D-13, D-03 item 9): a withdrawn Risk leaves release readiness and the release path, while the
 * analyst's assessment detail still lists it with its withdrawal block (null on an active Risk).
 */
type ReadinessRow = { scope: string; key: string; state: string; riskNumber?: string };
type AnalystDetailRisk = { documentId: string; riskNumber: string; withdrawal: unknown };
type AnalystDetailView = { risks: AnalystDetailRisk[]; releaseReadiness: { ready: boolean; requirements: ReadinessRow[] } };

async function analystDetail(harness: AuthorizationHttpHarness, assessmentId: string): Promise<AnalystDetailView> {
  const response = await harness.request({ path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, identity: harness.identities.analyst });
  const text = await response.text();
  assert.equal(response.status, 200, `ANALYST_DETAIL: ${text}`);
  return (JSON.parse(text) as { data: AnalystDetailView }).data;
}

async function riskNumberOf(harness: AuthorizationHttpHarness, riskId: string): Promise<string> {
  return String((await harness.getRisk(riskId))?.riskNumber ?? "");
}

test("a withdrawn incomplete Risk leaves release readiness while the analyst detail lists it with its withdrawal, and the assessment releases (D-08, D-12, D-13, D-03 item 9)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness, {
    request: { requestStatus: "under-review" },
    assessment: { assessmentStatus: "in-review", reviewedBy: harness.users.analyst, summary: "Reviewed curation fixture", overallRating: "High", overallRiskRationale: "Review is complete" },
  });
  const active = await readyRisk(harness, assessmentId);
  const incomplete = await freshRisk(harness, assessmentId);
  const incompleteNumber = await riskNumberOf(harness, incomplete);
  const before = await analystDetail(harness, assessmentId);
  assert.equal(before.releaseReadiness.ready, false, "THE_INCOMPLETE_RISK_DOES_NOT_BLOCK_RELEASE_BEFORE_ITS_WITHDRAWAL");
  assert.ok(before.releaseReadiness.requirements.some((row) => row.riskNumber === incompleteNumber && row.state === "outstanding"));

  const reason = "Duplicates another risk on this assessment";
  assert.deepEqual(await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [incomplete], reason }), "WITHDRAWAL"), { applied: [incomplete], unchanged: [] });
  const facts = await harness.riskWithdrawalFactsFixture(incomplete);
  assert.ok(facts?.withdrawnAt, "THE_RISK_IS_NOT_WITHDRAWN");

  const detail = await analystDetail(harness, assessmentId);
  assert.deepEqual(detail.risks.map((risk) => risk.documentId).sort(), [active, incomplete].sort(), "THE_ANALYST_DETAIL_DOES_NOT_LIST_EVERY_RISK");
  const withdrawnView = detail.risks.find((risk) => risk.documentId === incomplete);
  assert.deepEqual(withdrawnView?.withdrawal, {
    at: new Date(String(facts.withdrawnAt)).toISOString(),
    by: { documentId: harness.users.analyst, displayName: await displayNameOf(harness, harness.users.analyst) },
    reason,
  }, "WITHDRAWAL_BLOCK");
  assert.equal(detail.risks.find((risk) => risk.documentId === active)?.withdrawal, null, "ACTIVE_RISK_WITHDRAWAL_IS_NOT_NULL");
  assert.equal(detail.releaseReadiness.requirements.some((row) => row.riskNumber === incompleteNumber), false, "THE_WITHDRAWN_RISK_HAS_A_READINESS_ROW");
  assert.equal(detail.releaseReadiness.ready, true, `THE_ACTIVE_RISKS_ARE_NOT_RELEASE_READY: ${JSON.stringify(detail.releaseReadiness.requirements.filter((row) => row.state === "outstanding"))}`);
  assert.equal((await reviewState(harness, assessmentId)).assessmentStatus, "in-review", "A_WITHDRAWAL_FROM_A_NOT_READY_REVIEW_LEFT_REVIEW");

  const released = await harness.request({ path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/release`, identity: harness.identities.analyst, init: { method: "POST" } });
  assert.equal(released.status, 200, `RELEASE_WITH_AN_INCOMPLETE_WITHDRAWN_RISK: ${await released.clone().text()}`);
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "approved");
});

test("withdrawing the last active Risk leaves 'At least one Risk' outstanding in the analyst detail's readiness (D-12)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const { assessmentId } = await curationAssessment(harness);
  const only = await readyRisk(harness, assessmentId);
  const atLeastOne = (view: AnalystDetailView) => view.releaseReadiness.requirements.find((row) => row.scope === "assessment" && row.key === "risks")?.state;
  assert.equal(atLeastOne(await analystDetail(harness, assessmentId)), "met");
  await curationData(await curate(harness, "risk_withdrawals", assessmentId, harness.identities.analyst, { riskIds: [only], reason: WRONG_TYPE_REASON }), "LAST_ACTIVE_WITHDRAWAL");
  const detail = await analystDetail(harness, assessmentId);
  assert.equal(atLeastOne(detail), "outstanding", "AT_LEAST_ONE_RISK_IS_NOT_OUTSTANDING");
  assert.equal(detail.releaseReadiness.ready, false);
  assert.equal(detail.releaseReadiness.requirements.some((row) => row.scope === "risk"), false, "A_WITHDRAWN_RISK_HAS_A_READINESS_ROW");
  assert.deepEqual(detail.risks.map((risk) => risk.documentId), [only], "THE_ANALYST_DETAIL_DROPPED_THE_WITHDRAWN_RISK");
});

/*
 * 16-06 (D-08, D-13, D-14, Phase 11 D-31, 16-RESEARCH Pitfall 3): every Requestor read, both assessment lists and the
 * request relationship counts exclude a withdrawn Risk. The scenario: a released assessment of Jane's request with two
 * active Risks (residual Moderate and High, one control implementation each) and one withdrawn Risk (residual
 * Critical, two control implementations), so a count or rating that includes it shows.
 */
type ReleasedCurationScenario = {
  requestId: string; assessmentId: string; assessmentNumber: string;
  activeIds: string[]; activeImplementations: string[]; withdrawnId: string; withdrawnNumber: string; withdrawnImplementations: string[];
};
const WITHDRAWN_OUT_OF_SCOPE = "Out of scope for this request";
let releasedScenarioPromise: Promise<ReleasedCurationScenario> | null = null;

async function ratedRisk(harness: AuthorizationHttpHarness, assessmentId: string, residualRating: "Moderate" | "High" | "Critical"): Promise<string> {
  readyRiskSequence += 1;
  return harness.createRiskRegisterFixture(assessmentId, {
    riskNumber: `RSK-CURATION-RATED-${String(readyRiskSequence).padStart(3, "0")}`, riskStatement: `Rated curation risk ${readyRiskSequence}`,
    inherentLikelihood: "Likely", highestInherentConsequence: "Major", inherentRating: "Critical",
    residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRating,
    riskOwner: harness.users.owner, treatmentAction: "Accept", targetDate: "2027-08-30",
  });
}

async function implementationsOf(harness: AuthorizationHttpHarness, riskId: string, count: number): Promise<string[]> {
  const control = await controlOf(harness);
  const ids: string[] = [];
  for (let index = 0; index < count; index += 1) ids.push(await harness.createRiskRegisterMitigationFixture(riskId, control.documentId, "Planned"));
  return ids;
}

function releasedCurationScenario(harness: AuthorizationHttpHarness): Promise<ReleasedCurationScenario> {
  releasedScenarioPromise ??= (async () => {
    const { requestId, assessmentId } = await curationAssessment(harness, {
      request: { requestStatus: "under-review" },
      assessment: { assessmentStatus: "in-review", reviewedBy: harness.users.analyst, summary: "Released curation fixture", overallRating: "High", overallRiskRationale: "Review is complete" },
    });
    const activeIds = [await ratedRisk(harness, assessmentId, "Moderate"), await ratedRisk(harness, assessmentId, "High")];
    const withdrawnId = await ratedRisk(harness, assessmentId, "Critical");
    const activeImplementations = [...await implementationsOf(harness, activeIds[0], 1), ...await implementationsOf(harness, activeIds[1], 1)];
    const withdrawnImplementations = await implementationsOf(harness, withdrawnId, 2);
    await harness.setRiskWithdrawalFactsFixture(withdrawnId, { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: WITHDRAWN_OUT_OF_SCOPE });
    const released = await harness.request({ path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/release`, identity: harness.identities.analyst, init: { method: "POST" } });
    assert.equal(released.status, 200, `SCENARIO_RELEASE: ${await released.clone().text()}`);
    const assessment = await harness.getAssessment(assessmentId);
    assert.equal(assessment?.assessmentStatus, "approved", "THE_SCENARIO_IS_NOT_RELEASED");
    return {
      requestId, assessmentId, assessmentNumber: String(assessment?.assessmentNumber),
      activeIds, activeImplementations, withdrawnId, withdrawnNumber: await riskNumberOf(harness, withdrawnId), withdrawnImplementations,
    };
  })();
  return releasedScenarioPromise;
}

async function readAs(harness: AuthorizationHttpHarness, path: string, identity: string): Promise<{ status: number; text: string; body: unknown }> {
  const response = await harness.request({ path, identity });
  const text = await response.text();
  return { status: response.status, text, body: text ? JSON.parse(text) as unknown : null };
}

function assertNoWithdrawnTrace(scenario: ReleasedCurationScenario, text: string, label: string): void {
  for (const trace of [scenario.withdrawnId, scenario.withdrawnNumber, WITHDRAWN_OUT_OF_SCOPE, ...scenario.withdrawnImplementations]) {
    assert.ok(!text.includes(trace), `${label}_DISCLOSES_THE_WITHDRAWN_RISK`);
  }
}

const riskListPath = (assessmentId: string) => `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}/risks`;
const implementationsPath = (riskId: string) => `/api/v1/risks/${encodeURIComponent(riskId)}/control_implementations`;

test("a Requestor's released reads exclude a withdrawn Risk: the detail, the risk list, my_risk_assessments' count and highest rating, and its control implementations read as an unknown Risk's (D-08, D-13)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const scenario = await releasedCurationScenario(harness);
  const jane = harness.identities.owner;

  const detail = await readAs(harness, `/api/v1/risk_assessments/${encodeURIComponent(scenario.assessmentId)}`, jane);
  assert.equal(detail.status, 200, `JANE_DETAIL: ${detail.text}`);
  assertNoWithdrawnTrace(scenario, detail.text, "JANE_DETAIL");

  const list = await readAs(harness, riskListPath(scenario.assessmentId), jane);
  assert.equal(list.status, 200, `JANE_RISK_LIST: ${list.text}`);
  assert.deepEqual((list.body as { data: Array<{ documentId: string }> }).data.map((risk) => risk.documentId).sort(), [...scenario.activeIds].sort(), "JANE_RISK_LIST_IS_NOT_THE_ACTIVE_RISKS");
  assertNoWithdrawnTrace(scenario, list.text, "JANE_RISK_LIST");

  const withdrawnImplementations = await readAs(harness, implementationsPath(scenario.withdrawnId), jane);
  const unknownImplementations = await readAs(harness, implementationsPath("no-such-risk"), jane);
  assert.equal(unknownImplementations.status, 404, unknownImplementations.text);
  assert.equal(withdrawnImplementations.status, 404, `JANE_WITHDRAWN_IMPLEMENTATIONS: ${withdrawnImplementations.text}`);
  assert.deepEqual(withdrawnImplementations.body, unknownImplementations.body, "THE_WITHDRAWN_RISK_404_DIFFERS_FROM_AN_UNKNOWN_RISK");
  assertNoWithdrawnTrace(scenario, withdrawnImplementations.text, "JANE_WITHDRAWN_IMPLEMENTATIONS");
  const activeImplementations = await readAs(harness, implementationsPath(scenario.activeIds[0]), jane);
  assert.equal(activeImplementations.status, 200, `JANE_ACTIVE_IMPLEMENTATIONS: ${activeImplementations.text}`);
  assert.deepEqual((activeImplementations.body as { data: Array<{ documentId: string }> }).data.map((entry) => entry.documentId), [scenario.activeImplementations[0]]);

  const mine = await readAs(harness, `/api/v1/my_risk_assessments?q=${encodeURIComponent(scenario.assessmentNumber)}`, jane);
  assert.equal(mine.status, 200, `JANE_MY_RISK_ASSESSMENTS: ${mine.text}`);
  const item = (mine.body as { data: Array<Record<string, unknown>> }).data.find((candidate) => candidate.documentId === scenario.assessmentId);
  assert.ok(item, "THE_RELEASED_ASSESSMENT_IS_NOT_IN_THE_REQUESTOR_LIST");
  assert.equal(item.riskCount, 2, "JANE_RISK_COUNT_INCLUDES_THE_WITHDRAWN_RISK");
  assert.equal(item.highestResidualRating, "High", "JANE_HIGHEST_RESIDUAL_RATING_INCLUDES_THE_WITHDRAWN_RISK");
});

test("the request relationship counts count active Risks and only their control implementations, for the Requestor and the analyst (D-13, Pitfall 3)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const scenario = await releasedCurationScenario(harness);
  for (const [label, identity] of [["JANE", harness.identities.owner], ["BOB", harness.identities.analyst]] as const) {
    const read = await readAs(harness, `/api/csrm-assessment-requests/${encodeURIComponent(scenario.requestId)}`, identity);
    assert.equal(read.status, 200, `${label}_REQUEST_READ: ${read.text}`);
    const relationship = (read.body as { data: { relationships: { assessment: Record<string, unknown> } } }).data.relationships.assessment;
    assert.equal(relationship.availability, "available", `${label}_RELATIONSHIP_AVAILABILITY`);
    assert.deepEqual(relationship.residualRiskCounts, { Low: 0, Moderate: 1, High: 1, Critical: 0, total: 2 }, `${label}_RESIDUAL_RISK_COUNTS`);
    assert.equal(relationship.controlImplementationCount, scenario.activeImplementations.length, `${label}_CONTROL_IMPLEMENTATION_COUNT`);
  }
});

test("the analyst list counts active Risks only, a withdrawn Critical Risk does not set its highest residual rating, and the analyst still reads the withdrawn Risk's control implementations (D-08, D-13, Phase 11 D-31)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const scenario = await releasedCurationScenario(harness);
  const bob = harness.identities.analyst;

  const list = await readAs(harness, `/api/v1/risk_assessments?q=${encodeURIComponent(scenario.assessmentNumber)}`, bob);
  assert.equal(list.status, 200, `BOB_LIST: ${list.text}`);
  const item = (list.body as { data: Array<Record<string, unknown>> }).data.find((candidate) => candidate.documentId === scenario.assessmentId);
  assert.ok(item, "THE_ASSESSMENT_IS_NOT_IN_THE_ANALYST_LIST");
  assert.equal(item.riskCount, 2, "BOB_RISK_COUNT_INCLUDES_THE_WITHDRAWN_RISK");
  assert.equal(item.highestResidualRating, "High", "A_WITHDRAWN_CRITICAL_RISK_SET_THE_HIGHEST_RESIDUAL_RATING");

  const risks = await readAs(harness, riskListPath(scenario.assessmentId), bob);
  assert.equal(risks.status, 200, `BOB_RISK_LIST: ${risks.text}`);
  assert.deepEqual((risks.body as { data: Array<{ documentId: string }> }).data.map((risk) => risk.documentId).sort(), [...scenario.activeIds].sort(), "BOB_RISK_LIST_IS_NOT_THE_ACTIVE_RISKS");

  const implementations = await readAs(harness, implementationsPath(scenario.withdrawnId), bob);
  assert.equal(implementations.status, 200, `BOB_WITHDRAWN_IMPLEMENTATIONS: ${implementations.text}`);
  assert.deepEqual((implementations.body as { data: Array<{ documentId: string }> }).data.map((entry) => entry.documentId).sort(), [...scenario.withdrawnImplementations].sort());

  const detail = await analystDetail(harness, scenario.assessmentId);
  assert.equal(detail.risks.length, 3, "BOB_DETAIL_DOES_NOT_LIST_THE_WITHDRAWN_RISK");
});

test("the Secondary Requestor gets the missing-record refusal for the assessment, its risk list and the control implementations of a withdrawn and an active Risk, with identical bodies (D-08)", async () => {
  const harness = await harnessPromise;
  await assertHistoryTable(harness);
  const scenario = await releasedCurationScenario(harness);
  const other = harness.identities.otherRequestor;

  const unknownAssessment = await readAs(harness, "/api/v1/risk_assessments/no-such-assessment", other);
  assert.equal(unknownAssessment.status, 404, unknownAssessment.text);
  const detail = await readAs(harness, `/api/v1/risk_assessments/${encodeURIComponent(scenario.assessmentId)}`, other);
  assert.equal(detail.status, 404, `SECONDARY_DETAIL: ${detail.text}`);
  assert.deepEqual(detail.body, unknownAssessment.body, "SECONDARY_DETAIL_BODY");

  const unknownList = await readAs(harness, riskListPath("no-such-assessment"), other);
  assert.equal(unknownList.status, 404, unknownList.text);
  const list = await readAs(harness, riskListPath(scenario.assessmentId), other);
  assert.equal(list.status, 404, `SECONDARY_RISK_LIST: ${list.text}`);
  assert.deepEqual(list.body, unknownList.body, "SECONDARY_RISK_LIST_BODY");

  const unknownImplementations = await readAs(harness, implementationsPath("no-such-risk"), other);
  assert.equal(unknownImplementations.status, 404, unknownImplementations.text);
  for (const [label, riskId] of [["WITHDRAWN", scenario.withdrawnId], ["ACTIVE", scenario.activeIds[0]]] as const) {
    const read = await readAs(harness, implementationsPath(riskId), other);
    assert.equal(read.status, 404, `SECONDARY_${label}_IMPLEMENTATIONS: ${read.text}`);
    assert.deepEqual(read.body, unknownImplementations.body, `SECONDARY_${label}_IMPLEMENTATIONS_BODY`);
  }
  for (const read of [detail, list]) assertNoWithdrawnTrace(scenario, read.text, "SECONDARY");
});
