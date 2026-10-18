import assert from "node:assert/strict";
import path from "node:path";
import test, { after } from "node:test";
import { PAYMENT_FILE_RISK } from "../src/csrm/ai/risk-proposals/deterministic-risk-proposal-provider";
import { fieldRunId, parseRiskAiProvenance } from "../src/api/csrm-assessment/services/ai-provenance";
import { AiRunRecordError } from "../src/api/csrm-ai-run/services/ai-run-record";
import { startAuthorizationHttpHarness, type AuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 16 decisions on risk AI proposals on a mounted Strapi (16-10; D-23, D-25, D-28, D-33, D-36 to D-40, D-42,
 * G-14; ASSESS-09 criterion 2, ASSESS-10 criteria 1 and 2, success criterion 3). Phase 12's one decision operation
 * takes run-scoped targets `{ kind: "proposal", runId, item }`: a proposed risk is added or rejected, each rewrite
 * change is confirmed or rejected inside the transaction with its stale and Accept checks, Undo restores what it
 * honestly can, and release waits until every proposal is decided. Every case seeds its own UAT-A-like request and
 * drafts it with 12-06's deterministic job, so no case depends on another.
 */

// Emitted to `.tmp/tests-dist/tests`, so three parents up is the Strapi application.
const strapiDir = path.resolve(__dirname, "..", "..", "..");

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

type Json = Record<string, unknown>;
type Harness = AuthorizationHttpHarness;
type Reply = { status: number; data: Json | null; reason: string | null; message: string | null };

type CompiledWorkflow = { settledRiskProposalJob: (strapi: unknown, jobId: string) => Promise<Json | null> };
function workflowModule(): CompiledWorkflow {
  return require(path.join(strapiDir, "dist", "src", "csrm", "ai", "risk-proposals", "risk-proposal-workflow.js")) as CompiledWorkflow;
}

async function call(harness: Harness, identity: string, method: "GET" | "POST" | "PATCH" | "PUT", requestPath: string, body?: unknown): Promise<Reply> {
  const response = await harness.request({
    path: requestPath,
    identity,
    init: { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) },
  });
  const parsed = (await response.json().catch(() => null)) as { data?: Json; error?: { message?: string; details?: { reason?: string } } } | null;
  return { status: response.status, data: parsed?.data ?? null, reason: parsed?.error?.details?.reason ?? null, message: parsed?.error?.message ?? null };
}

const suggestionsPath = (assessmentId: string) => `/api/v1/risk_assessments/${assessmentId}/risk_suggestions`;
const rewritePath = (riskId: string) => `/api/v1/risks/${riskId}/rewrite`;
const proposalsPath = (assessmentId: string) => `/api/v1/risk_assessments/${assessmentId}/ai_proposals`;
const decisionsPath = (assessmentId: string) => `/api/v1/risk_assessments/${assessmentId}/ai_proposal_decisions`;
const jobPath = (jobId: string) => `/api/v1/risk_proposal_jobs/${jobId}`;
const historyPath = (riskId: string) => `/api/v1/risks/${riskId}/history`;
const assessmentPath = (assessmentId: string) => `/api/v1/risk_assessments/${assessmentId}`;

/* A UAT-A-like request drafted by 12-06's deterministic job: an editable draft assessment with its drafted Risks. */
async function draftedAssessment(harness: Harness, label: string): Promise<{ requestId: string; assessmentId: string; riskIds: string[] }> {
  const { requestId, questionnaireId } = await harness.seedUatALikeRequest(label);
  const { assessmentId } = await harness.runAssessmentDraftJobFixture(questionnaireId, harness.users.analyst);
  const assessment = await harness.getAssessment(assessmentId);
  const riskIds = ((assessment?.risks as Json[] | undefined) ?? []).map((risk) => String(risk.documentId));
  assert.ok(riskIds.length > 0, "DRAFT_HAS_NO_RISKS");
  return { requestId, assessmentId, riskIds };
}

async function waitForJob(harness: Harness, identity: string, started: Reply): Promise<Json> {
  assert.equal(started.status, 202, `JOB_NOT_ACCEPTED_${started.status}_${started.reason}_${started.message}`);
  const jobId = String(started.data?.jobId);
  const job = await harness.withBackendFixture((backend) => workflowModule().settledRiskProposalJob(backend, jobId));
  assert.ok(job, "RISK_PROPOSAL_JOB_NOT_FOUND");
  const read = await call(harness, identity, "GET", jobPath(jobId));
  assert.equal(read.status, 200, "JOB_READ_REFUSED");
  const data = read.data as Json;
  assert.equal(data.status, "completed", `JOB_${String(data.failureCode)}`);
  return data;
}

/* "Suggest more risks" with an instruction that names payment files; returns the completed run. */
async function suggest(harness: Harness, assessmentId: string, instruction = "Risks about payment file integrity"): Promise<Json> {
  const job = await waitForJob(harness, harness.identities.analyst, await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId), { instruction }));
  return storedRun(harness, String(job.runId));
}

/* "Rewrite this risk"; returns the completed run. */
async function rewrite(harness: Harness, riskId: string, body?: Json): Promise<Json> {
  const job = await waitForJob(harness, harness.identities.analyst, await call(harness, harness.identities.analyst, "POST", rewritePath(riskId), body));
  return storedRun(harness, String(job.runId));
}

async function storedRun(harness: Harness, runId: string): Promise<Json> {
  return harness.withBackendFixture(async (backend) => {
    const documents = (backend.documents as unknown as (uid: string) => { findOne: (query: Json) => Promise<Json | null> })("api::csrm-ai-run.csrm-ai-run");
    const run = await documents.findOne({ documentId: runId });
    assert.ok(run, "RUN_NOT_FOUND");
    return run;
  });
}

const itemsOf = (run: Json): Json[] => ((run.proposal as Json).items as Json[]);
const eventsOf = (run: Json): Json[] => (Array.isArray(run.decisions) ? run.decisions as Json[] : []);

function paymentItem(run: Json): string {
  const item = itemsOf(run).find((entry) => (entry.proposed as Json).riskStatement === PAYMENT_FILE_RISK.riskStatement);
  assert.ok(item, "PAYMENT_FILE_RISK_NOT_PROPOSED");
  return String(item.key);
}

type DecisionEntry = { target: Json; action: string; reason?: string; fields?: string[] };
const proposal = (runId: unknown, item: string, action: "accept" | "reject" | "restore", reason?: string): DecisionEntry =>
  ({ target: { kind: "proposal", runId, item }, action, ...(reason === undefined ? {} : { reason }) });

async function decide(harness: Harness, assessmentId: string, decisions: DecisionEntry[], identity = harness.identities.analyst): Promise<Reply> {
  return call(harness, identity, "POST", decisionsPath(assessmentId), { decisions });
}

async function readProposals(harness: Harness, assessmentId: string, identity = harness.identities.analyst): Promise<Json> {
  const read = await call(harness, identity, "GET", proposalsPath(assessmentId));
  assert.equal(read.status, 200, `PROPOSALS_READ_${read.status}_${read.message}`);
  return read.data as Json;
}

async function detail(harness: Harness, assessmentId: string): Promise<Json> {
  const read = await call(harness, harness.identities.analyst, "GET", assessmentPath(assessmentId));
  assert.equal(read.status, 200, `DETAIL_${read.status}_${read.message}`);
  return read.data as Json;
}

const requirement = (readiness: Json, key: string, riskNumber?: string): Json | undefined =>
  (readiness.requirements as Json[]).find((entry) => entry.key === key && (riskNumber === undefined || entry.riskNumber === riskNumber));

/* Everything a refused decision must leave as it was: the assessment, its request, every Risk and every run. */
async function persistence(harness: Harness, assessmentId: string, requestId: string): Promise<unknown> {
  const assessment = await harness.getAssessment(assessmentId);
  const runs = await harness.withBackendFixture(async (backend) => {
    const documents = (backend.documents as unknown as (uid: string) => { findMany: (query: Json) => Promise<Json[]> })("api::csrm-ai-run.csrm-ai-run");
    return documents.findMany({ filters: { assessment: { documentId: { $eq: assessmentId } } }, fields: ["documentId", "decisions"], sort: ["id:asc"], limit: 1_000 });
  });
  const risks = await Promise.all(((assessment?.risks as Json[]) ?? []).map((risk) => harness.getRisk(String(risk.documentId))));
  return JSON.parse(JSON.stringify([assessment, await harness.getRequest(requestId), risks, runs]));
}

/*
 * Completes every release requirement but the AI proposal decisions, as an analyst would by hand: the assessment's
 * fields, each active Risk's ratings, owner and treatment, and every Phase 12 field proposal confirmed. It ends with the
 * assessment `in-review` and complete on its fields.
 */
async function completeReleaseFields(harness: Harness, assessmentId: string): Promise<void> {
  const update = await call(harness, harness.identities.analyst, "PATCH", assessmentPath(assessmentId), {
    summary: "Ready for release once every AI proposal is decided",
    overallRating: "High",
    overallRiskRationale: "Every requirement on the fields is complete and analyst reviewed.",
  });
  assert.equal(update.status, 200, "ASSESSMENT_UPDATE_FAILED");
  const assessment = await harness.getAssessment(assessmentId);
  const risks = ((assessment?.risks as Json[]) ?? []).filter((risk) => !risk.withdrawnAt);
  for (const risk of risks) {
    const patch = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${String(risk.documentId)}`, {
      riskStatement: typeof risk.riskStatement === "string" && risk.riskStatement.length > 0 ? risk.riskStatement : "A completed risk statement",
      inherentLikelihood: "Likely", highestInherentConsequence: "Major", inherentRating: "High",
      residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRating: "Moderate",
      riskOwner: harness.users.owner, treatmentAction: "Accept", targetDate: "2027-08-30",
    });
    assert.equal(patch.status, 200, `RISK_UPDATE_FAILED_${String(risk.documentId)}`);
  }
  const decisions: DecisionEntry[] = [];
  const stored = await harness.getAssessment(assessmentId);
  const assessmentFields = Object.entries((stored?.aiProvenance as Json | null)?.fields as Json ?? {})
    .filter(([, fact]) => (fact as Json)?.state === "proposed").map(([field]) => field);
  if (assessmentFields.length) decisions.push({ target: { kind: "assessment" }, action: "accept", fields: assessmentFields });
  for (const risk of risks) {
    const fields = Object.entries(parseRiskAiProvenance((await harness.getRisk(String(risk.documentId)))?.aiProvenance)?.fields ?? {})
      .filter(([, fact]) => fact?.state === "proposed").map(([field]) => field);
    if (fields.length) decisions.push({ target: { kind: "risk", riskId: String(risk.documentId) }, action: "accept", fields });
  }
  if (decisions.length) assert.equal((await decide(harness, assessmentId, decisions)).status, 200, "FIELD_PROPOSALS_NOT_CONFIRMED");
  if ((await harness.getAssessment(assessmentId))?.assessmentStatus === "draft") {
    const fresh = await call(harness, harness.identities.analyst, "PATCH", assessmentPath(assessmentId), { recommendationsSummary: "Reviewed again after completion." });
    assert.equal(fresh.status, 200, "FRESH_REVIEW_FAILED");
  }
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "in-review", "NOT_IN_REVIEW");
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Task 1: "Add to assessment", and readiness waiting for every decision
 * ------------------------------------------------------------------------------------------------------------------- */

test("Add to assessment: Bob's accept of a suggestion creates the risk with the next number, AI provenance naming the run per field, its suggested controls, one created history row and one accepted event; a repeat changes nothing (D-33, D-39)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "DECIDE-ADD");
  const run = await suggest(harness, assessmentId);
  const runId = String(run.documentId);
  const item = paymentItem(run);
  const suggested = itemsOf(run).find((entry) => entry.key === item) as Json;
  const before = await harness.getAssessment(assessmentId);
  const numbers = ((before?.risks as Json[]) ?? []).map((risk) => String(risk.riskNumber));

  const added = await decide(harness, assessmentId, [proposal(runId, item, "accept")]);
  assert.equal(added.status, 200, `ADD_${added.status}_${added.reason}_${added.message}`);
  assert.deepEqual(added.data, { applied: 1, unchanged: 0 });

  const after = await harness.getAssessment(assessmentId);
  const risks = (after?.risks as Json[]) ?? [];
  assert.equal(risks.length, riskIds.length + 1, "NO_RISK_ADDED");
  const risk = risks.find((entry) => !riskIds.includes(String(entry.documentId))) as Json;
  assert.equal(risk.riskStatement, PAYMENT_FILE_RISK.riskStatement);
  assert.equal(risk.riskCause, PAYMENT_FILE_RISK.riskCause);
  assert.ok(!numbers.includes(String(risk.riskNumber)), "RISK_NUMBER_REUSED");
  assert.match(String(risk.riskNumber), /^RSK-/, "RISK_NUMBER_NOT_ALLOCATED");

  const provenance = parseRiskAiProvenance(risk.aiProvenance);
  assert.ok(provenance, "ADDED_RISK_HAS_NO_AI_PROVENANCE");
  assert.equal(provenance.runId, runId, "PROVENANCE_DOES_NOT_NAME_THE_SUGGESTION_RUN");
  assert.equal(provenance.proposalKey, item);
  const facts = Object.values(provenance.fields);
  assert.ok(facts.length > 0 && facts.every((fact) => fact?.state === "proposed" && fact.runId === runId), "FIELDS_NOT_PROPOSED_FROM_THE_RUN");
  const controls = ((suggested.proposed as Json).suggestedControls as Json[]).map((entry) => entry.controlNumber);
  assert.deepEqual(provenance.suggestions.map((entry) => entry.controlNumber), controls, "SUGGESTED_CONTROLS_NOT_PHASE_12_SUGGESTIONS");
  assert.ok(provenance.suggestions.every((entry) => entry.state === "proposed"));

  const history = await call(harness, harness.identities.analyst, "GET", historyPath(String(risk.documentId)));
  assert.equal(history.status, 200);
  const events = (Array.isArray(history.data) ? history.data : []) as Json[];
  assert.equal(events.length, 1, "NOT_ONE_HISTORY_ROW");
  assert.deepEqual([events[0].kind, events[0].sourceKind, events[0].aiRunId, events[0].proposalItem], ["created", "ai-run", runId, item]);
  // BE1-01, the approved record: a `created` row lists each starting value with `from: null`.
  const startingValues = ((events[0].changes as Json | null)?.fields ?? []) as Json[];
  assert.ok(startingValues.length > 0 && startingValues.every((change) => change.from === null && change.to !== null), "CREATED_ROW_LISTS_NO_STARTING_VALUES");
  assert.deepEqual(startingValues.find((change) => change.field === "riskStatement"), { field: "riskStatement", from: null, to: PAYMENT_FILE_RISK.riskStatement }, "CREATED_ROW_STATEMENT");
  assert.deepEqual(startingValues.find((change) => change.field === "riskCause"), { field: "riskCause", from: null, to: PAYMENT_FILE_RISK.riskCause }, "CREATED_ROW_CAUSE");

  const decided = eventsOf(await storedRun(harness, runId));
  assert.equal(decided.length, 1, "NOT_ONE_DECISION_EVENT");
  assert.deepEqual([decided[0].action, decided[0].item, (decided[0].applied as Json).riskDocumentId, decided[0].by], ["accepted", item, risk.documentId, harness.users.analyst]);

  const read = await readProposals(harness, assessmentId);
  const listed = (read.items as Json[]).find((entry) => entry.runId === runId && entry.itemKey === item) as Json;
  assert.equal(listed.state, "accepted");
  assert.equal((listed.addedRisk as Json).riskId, risk.documentId);
  assert.equal((listed.addedRisk as Json).riskNumber, risk.riskNumber);

  const repeated = await decide(harness, assessmentId, [proposal(runId, item, "accept")]);
  assert.equal(repeated.status, 200);
  assert.deepEqual(repeated.data, { applied: 0, unchanged: 1 }, "REPEAT_NOT_UNCHANGED");
  assert.equal(((await harness.getAssessment(assessmentId))?.risks as Json[]).length, riskIds.length + 1, "REPEAT_ADDED_A_SECOND_RISK");
  assert.equal(eventsOf(await storedRun(harness, runId)).length, 1, "REPEAT_STORED_AN_EVENT");
});

test("on a release-ready in-review assessment the addition returns it to draft, and the added risk makes Review of AI proposals outstanding (D-23, D-33)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "DECIDE-ADD-REVIEW");
  const run = await suggest(harness, assessmentId);
  await completeReleaseFields(harness, assessmentId);
  const item = paymentItem(run);
  const added = await decide(harness, assessmentId, [proposal(run.documentId, item, "accept")]);
  assert.equal(added.status, 200, `ADD_${added.status}_${added.reason}`);
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "draft", "ADDITION_DID_NOT_WITHDRAW_THE_REVIEW");
  const addedRiskId = String((eventsOf(await storedRun(harness, String(run.documentId)))[0].applied as Json).riskDocumentId);
  const risk = await harness.getRisk(addedRiskId);
  const readiness = (await detail(harness, assessmentId)).releaseReadiness as Json;
  assert.equal(requirement(readiness, "aiProposalsReviewed", String(risk?.riskNumber))?.state, "outstanding", "ADDED_RISK_REVIEW_NOT_OUTSTANDING");
});

test("readiness lists Decisions on AI proposals outstanding while a proposal is open and release refuses with nothing written; a batch rejecting the rest meets it and release succeeds (D-42)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId } = await draftedAssessment(harness, "DECIDE-READINESS");
  const run = await suggest(harness, assessmentId);
  await completeReleaseFields(harness, assessmentId);

  let readiness = (await detail(harness, assessmentId)).releaseReadiness as Json;
  const decided = requirement(readiness, "aiProposalsDecided");
  assert.deepEqual(decided, { scope: "assessment", key: "aiProposalsDecided", label: "Decisions on AI proposals", state: "outstanding", destination: "ai-proposals" });
  assert.equal(readiness.ready, false);
  const before = await persistence(harness, assessmentId, requestId);
  const refused = await call(harness, harness.identities.analyst, "POST", `${assessmentPath(assessmentId)}/release`);
  assert.equal(refused.status, 409, "RELEASED_WITH_AN_OPEN_PROPOSAL");
  assert.deepEqual(await persistence(harness, assessmentId, requestId), before, "REFUSED_RELEASE_WROTE");

  const open = itemsOf(run).map((entry) => String(entry.key));
  const rejected = await decide(harness, assessmentId, open.map((key) => proposal(run.documentId, key, "reject", "Not a risk for this request")));
  assert.equal(rejected.status, 200, `REJECT_${rejected.status}_${rejected.reason}`);
  assert.deepEqual(rejected.data, { applied: open.length, unchanged: 0 });
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "in-review", "REJECTIONS_WITHDREW_THE_REVIEW");
  readiness = (await detail(harness, assessmentId)).releaseReadiness as Json;
  assert.equal(requirement(readiness, "aiProposalsDecided")?.state, "met");
  assert.equal(readiness.ready, true, `NOT_READY_${JSON.stringify((readiness.requirements as Json[]).filter((entry) => entry.state === "outstanding"))}`);
  const released = await call(harness, harness.identities.analyst, "POST", `${assessmentPath(assessmentId)}/release`);
  assert.equal(released.status, 200, `RELEASE_${released.status}_${released.message}`);
});

/* ---------------------------------------------------------------------------------------------------------------------
 * Task 2: confirming, rejecting and undoing rewrite changes; staleness; the Accept rule; per-field run references
 * ------------------------------------------------------------------------------------------------------------------- */

async function historyOf(harness: Harness, riskId: string): Promise<Json[]> {
  const history = await call(harness, harness.identities.analyst, "GET", historyPath(riskId));
  assert.equal(history.status, 200, "HISTORY_READ_REFUSED");
  return (Array.isArray(history.data) ? history.data : []) as Json[];
}

function unitOf(run: Json, key: string): Json {
  const unit = itemsOf(run).find((entry) => entry.key === key);
  assert.ok(unit, `UNIT_${key}_NOT_PROPOSED`);
  return unit;
}

async function provenanceOf(harness: Harness, riskId: string) {
  const provenance = parseRiskAiProvenance((await harness.getRisk(riskId))?.aiProvenance);
  assert.ok(provenance, "RISK_HAS_NO_AI_PROVENANCE");
  return provenance;
}

/*
 * A completed "Rewrite this risk" run of `riskId` whose proposal is replaced by `items` (each unit's base the Risk's
 * values now), so a case can hold exactly the units its rule needs. The run itself is real: its job, run record and
 * assessment are the ones the operation wrote.
 */
async function craftedRewrite(harness: Harness, riskId: string, items: Json[]): Promise<Json> {
  const run = await rewrite(harness, riskId);
  await harness.updateFixtureDocument("api::csrm-ai-run.csrm-ai-run", String(run.documentId), {
    proposal: { schemaVersion: 1, operation: "risk-rewrite", outcome: "items", items, adjustments: [] },
    decisions: [],
  });
  return storedRun(harness, String(run.documentId));
}

const PLAN = "Review the payment controls each quarter.";
const ACCEPT_PLAN = "Accept the residual risk: it is within tolerance and reviewed at the next assessment.";
const residualUnit = (riskId: string, from: [string, string, string], to: [string, string, string]): Json => ({
  key: "u-residual-rating", kind: "change", riskDocumentId: riskId,
  fields: ["residualLikelihood", "highestResidualConsequence", "residualRating"],
  base: { residualLikelihood: from[0], highestResidualConsequence: from[1], residualRating: from[2] },
  proposed: { residualLikelihood: to[0], highestResidualConsequence: to[1], residualRating: to[2] },
});
const acceptUnit = (riskId: string): Json => ({
  key: "u-treatment", kind: "change", riskDocumentId: riskId, fields: ["treatmentAction", "treatmentPlan"],
  base: { treatmentAction: "Treat", treatmentPlan: PLAN }, proposed: { treatmentAction: "Accept", treatmentPlan: ACCEPT_PLAN }, aiAccept: true,
});

/* Sets a Risk to a Moderate residual (Possible, Moderate) treated with PLAN, as an analyst would by hand. */
async function treatedModerate(harness: Harness, riskId: string): Promise<void> {
  const patch = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${riskId}`, {
    residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRating: "Moderate", treatmentAction: "Treat", treatmentPlan: PLAN,
  });
  assert.equal(patch.status, 200, `RISK_PATCH_${patch.status}_${patch.message}`);
}

test("confirming two changes of a rewrite in one batch writes one updated history row per change with the run and item, names the rewrite runId on each confirmed field while a draft field keeps the draft run, and a rejection with a reason changes nothing (D-25, D-36, D-37)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "DECIDE-CONFIRM");
  await completeReleaseFields(harness, assessmentId);
  const riskId = riskIds[0];
  const draftRunId = (await provenanceOf(harness, riskId)).runId;
  const run = await rewrite(harness, riskId);
  const runId = String(run.documentId);
  const statement = unitOf(run, "u-risk-statement");
  const cause = unitOf(run, "u-risk-cause");
  unitOf(run, "u-residual-rating");
  const before = await harness.getRisk(riskId);
  const historyBefore = (await historyOf(harness, riskId)).length;

  const decided = await decide(harness, assessmentId, [
    proposal(runId, "u-risk-statement", "accept"),
    proposal(runId, "u-risk-cause", "accept"),
    proposal(runId, "u-residual-rating", "reject", "  The ratings stay as reviewed.  "),
  ]);
  assert.equal(decided.status, 200, `DECIDE_${decided.status}_${decided.reason}_${decided.message}`);
  assert.deepEqual(decided.data, { applied: 3, unchanged: 0 });

  const after = await harness.getRisk(riskId);
  assert.equal(after?.riskStatement, (statement.proposed as Json).riskStatement);
  assert.equal(after?.riskCause, (cause.proposed as Json).riskCause);
  for (const field of ["residualLikelihood", "highestResidualConsequence", "residualRating"]) assert.equal(after?.[field], before?.[field], `REJECTION_CHANGED_${field}`);

  const history = await historyOf(harness, riskId);
  const rows = history.slice(0, history.length - historyBefore);
  assert.equal(rows.length, 2, "NOT_ONE_ROW_PER_CONFIRMED_CHANGE");
  for (const [item, field] of [["u-risk-statement", "riskStatement"], ["u-risk-cause", "riskCause"]] as const) {
    const row = rows.find((entry) => entry.proposalItem === item) as Json;
    assert.ok(row, `NO_ROW_FOR_${item}`);
    assert.deepEqual([row.kind, row.sourceKind, row.aiRunId, row.undo], ["updated", "ai-run", runId, false]);
    assert.deepEqual(((row.changes as Json).fields as Json[]).map((change) => change.field), [field], `ROW_FOR_${item}_LISTS_OTHER_FIELDS`);
  }

  const provenance = await provenanceOf(harness, riskId);
  assert.equal(provenance.runId, draftRunId, "THE_ENVELOPE_RUN_MOVED");
  for (const field of ["riskStatement", "riskCause"] as const) {
    assert.equal(fieldRunId(provenance, field), runId, `${field}_DOES_NOT_NAME_THE_REWRITE_RUN`);
    assert.deepEqual([provenance.fields[field]?.state, provenance.fields[field]?.by], ["accepted", harness.users.analyst]);
  }
  assert.equal(fieldRunId(provenance, "potentialImpact"), draftRunId, "A_DRAFT_FIELD_NO_LONGER_RESOLVES_TO_THE_DRAFT_RUN");

  const events = eventsOf(await storedRun(harness, runId));
  assert.deepEqual(events.map((event) => [event.item, event.action]), [["u-risk-statement", "accepted"], ["u-risk-cause", "accepted"], ["u-residual-rating", "rejected"]]);
  assert.equal(events[2].reason, "The ratings stay as reviewed.");
  assert.deepEqual((events[0].before as Json).values, statement.base);
  assert.deepEqual((events[0].applied as Json).values, statement.proposed);
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "draft", "THE_CONTENT_BATCH_DID_NOT_WITHDRAW_THE_REVIEW_ONCE");
});

test("a change whose base the analyst has since edited is refused with AI_PROPOSAL_STALE, nothing is written, and the read shows it stale (D-37)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId, riskIds } = await draftedAssessment(harness, "DECIDE-STALE");
  const riskId = riskIds[0];
  const run = await rewrite(harness, riskId);
  const edit = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${riskId}`, { riskStatement: "Bob's own wording of this risk." });
  assert.equal(edit.status, 200);
  const before = await persistence(harness, assessmentId, requestId);
  const refused = await decide(harness, assessmentId, [proposal(run.documentId, "u-risk-cause", "accept"), proposal(run.documentId, "u-risk-statement", "accept")]);
  assert.deepEqual([refused.status, refused.reason], [409, "AI_PROPOSAL_STALE"]);
  assert.deepEqual(await persistence(harness, assessmentId, requestId), before, "A_STALE_BATCH_WROTE");
  const listed = ((await readProposals(harness, assessmentId)).items as Json[]).find((item) => item.runId === run.documentId && item.itemKey === "u-risk-statement") as Json;
  assert.deepEqual([listed.state, listed.stale], ["open", true]);
});

test("Undo of a confirmed change restores its base value and earlier field fact with an undo row, and is AI_PROPOSAL_UNDO_UNAVAILABLE once the field is edited; a rejection's Undo reopens it; an added risk has no Undo (D-33, D-39)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "DECIDE-UNDO");
  const riskId = riskIds[0];
  const run = await rewrite(harness, riskId);
  const runId = String(run.documentId);
  const cause = unitOf(run, "u-risk-cause");
  const factBefore = (await provenanceOf(harness, riskId)).fields.riskCause;

  assert.equal((await decide(harness, assessmentId, [proposal(runId, "u-risk-cause", "accept")])).status, 200);
  const undone = await decide(harness, assessmentId, [proposal(runId, "u-risk-cause", "restore")]);
  assert.equal(undone.status, 200, `UNDO_${undone.status}_${undone.reason}`);
  assert.deepEqual(undone.data, { applied: 1, unchanged: 0 });
  assert.equal((await harness.getRisk(riskId))?.riskCause, (cause.base as Json).riskCause, "BASE_VALUE_NOT_RESTORED");
  assert.deepEqual((await provenanceOf(harness, riskId)).fields.riskCause, factBefore, "EARLIER_FIELD_FACT_NOT_RESTORED");
  const [undoRow] = await historyOf(harness, riskId);
  assert.deepEqual([undoRow.kind, undoRow.sourceKind, undoRow.aiRunId, undoRow.proposalItem, undoRow.undo], ["updated", "ai-run", runId, "u-risk-cause", true]);
  let listed = ((await readProposals(harness, assessmentId)).items as Json[]).find((item) => item.itemKey === "u-risk-cause") as Json;
  assert.equal(listed.state, "open", "UNDONE_CHANGE_NOT_OPEN");

  assert.equal((await decide(harness, assessmentId, [proposal(runId, "u-risk-cause", "accept")])).status, 200, "RECONFIRM_REFUSED");
  assert.equal((await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${riskId}`, { riskCause: "Bob's later cause." })).status, 200);
  const unavailable = await decide(harness, assessmentId, [proposal(runId, "u-risk-cause", "restore")]);
  assert.deepEqual([unavailable.status, unavailable.reason], [409, "AI_PROPOSAL_UNDO_UNAVAILABLE"]);
  assert.equal((await harness.getRisk(riskId))?.riskCause, "Bob's later cause.");

  assert.equal((await decide(harness, assessmentId, [proposal(runId, "u-risk-statement", "reject")])).status, 200);
  assert.equal((await decide(harness, assessmentId, [proposal(runId, "u-risk-statement", "restore")])).status, 200);
  listed = ((await readProposals(harness, assessmentId)).items as Json[]).find((item) => item.itemKey === "u-risk-statement") as Json;
  assert.equal(listed.state, "open", "RESTORED_REJECTION_NOT_OPEN");

  const suggestions = await suggest(harness, assessmentId);
  const item = paymentItem(suggestions);
  assert.equal((await decide(harness, assessmentId, [proposal(suggestions.documentId, item, "accept")])).status, 200);
  const noUndo = await decide(harness, assessmentId, [proposal(suggestions.documentId, item, "restore")]);
  assert.deepEqual([noUndo.status, noUndo.reason], [409, "AI_PROPOSAL_UNDO_UNAVAILABLE"]);
});

test("the Accept rule holds at confirmation in either order within a batch and across batches: AI_ACCEPT_NOT_PERMITTED for a High residual, AI_ACCEPT_WITH_PLANNED_CONTROL with a Planned control, and a Moderate residual with a plan confirms (D-38, G-14)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId, riskIds } = await draftedAssessment(harness, "DECIDE-ACCEPT");
  assert.ok(riskIds.length >= 3, "THREE_RISKS_NEEDED");
  const [high, moderate, planned] = riskIds;
  for (const riskId of riskIds.slice(0, 3)) await treatedModerate(harness, riskId);

  const run = await craftedRewrite(harness, high, [residualUnit(high, ["Possible", "Moderate", "Moderate"], ["Likely", "Moderate", "High"]), acceptUnit(high)]);
  const before = await persistence(harness, assessmentId, requestId);
  for (const order of [["u-treatment", "u-residual-rating"], ["u-residual-rating", "u-treatment"]]) {
    const refused = await decide(harness, assessmentId, order.map((key) => proposal(run.documentId, key, "accept")));
    assert.deepEqual([refused.status, refused.reason], [409, "AI_ACCEPT_NOT_PERMITTED"], `ORDER_${order.join("_")}`);
    assert.deepEqual(await persistence(harness, assessmentId, requestId), before, `ORDER_${order.join("_")}_WROTE`);
  }
  assert.equal((await decide(harness, assessmentId, [proposal(run.documentId, "u-residual-rating", "accept")])).status, 200);
  assert.equal((await harness.getRisk(high))?.residualRating, "High");
  const later = await decide(harness, assessmentId, [proposal(run.documentId, "u-treatment", "accept")]);
  assert.deepEqual([later.status, later.reason], [409, "AI_ACCEPT_NOT_PERMITTED"], "ACCEPT_CONFIRMED_ON_A_HIGH_RESIDUAL_IN_A_LATER_BATCH");

  // A Moderate residual with a plan confirms; a later residual change to High under that confirmed Accept is refused.
  const second = await craftedRewrite(harness, moderate, [residualUnit(moderate, ["Possible", "Moderate", "Moderate"], ["Likely", "Moderate", "High"]), acceptUnit(moderate)]);
  const confirmed = await decide(harness, assessmentId, [proposal(second.documentId, "u-treatment", "accept")]);
  assert.equal(confirmed.status, 200, `MODERATE_ACCEPT_${confirmed.status}_${confirmed.reason}`);
  assert.deepEqual([(await harness.getRisk(moderate))?.treatmentAction, (await harness.getRisk(moderate))?.treatmentPlan], ["Accept", ACCEPT_PLAN]);
  const raised = await decide(harness, assessmentId, [proposal(second.documentId, "u-residual-rating", "accept")]);
  assert.deepEqual([raised.status, raised.reason], [409, "AI_ACCEPT_NOT_PERMITTED"], "RESIDUAL_RAISED_UNDER_A_CONFIRMED_AI_ACCEPT");

  const control = await harness.withBackendFixture(async (backend) => {
    const documents = (backend.documents as unknown as (uid: string) => { findMany: (query: Json) => Promise<Json[]> })("api::csrm-control.csrm-control");
    const [first] = await documents.findMany({ fields: ["documentId"], limit: 1 });
    return String(first.documentId);
  });
  const implementation = await call(harness, harness.identities.analyst, "POST", `/api/v1/risks/${planned}/control_implementations`, { control, controlStatus: "Planned" });
  assert.ok([200, 201].includes(implementation.status), `PLANNED_CONTROL_${implementation.status}_${implementation.message}`);
  const third = await craftedRewrite(harness, planned, [acceptUnit(planned)]);
  const blocked = await decide(harness, assessmentId, [proposal(third.documentId, "u-treatment", "accept")]);
  assert.deepEqual([blocked.status, blocked.reason], [409, "AI_ACCEPT_WITH_PLANNED_CONTROL"]);
});

test("Undo of a confirmed residual change that would leave a High residual under an Accept confirmed from an AI proposal is AI_ACCEPT_NOT_PERMITTED and writes nothing, while the same Undo under an Accept a person typed restores (16-REVIEW BE2-02; D-38, T-16-30)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId, riskIds } = await draftedAssessment(harness, "DECIDE-ACCEPT-UNDO");
  assert.ok(riskIds.length >= 2, "TWO_RISKS_NEEDED");
  const [aiAccept, typedAccept] = riskIds;
  const high = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${aiAccept}`, {
    residualLikelihood: "Likely", highestResidualConsequence: "Moderate", residualRating: "High", treatmentAction: "Treat", treatmentPlan: PLAN,
  });
  assert.equal(high.status, 200, `HIGH_PATCH_${high.status}_${high.message}`);

  const run = await craftedRewrite(harness, aiAccept, [residualUnit(aiAccept, ["Likely", "Moderate", "High"], ["Possible", "Moderate", "Moderate"]), acceptUnit(aiAccept)]);
  const confirmed = await decide(harness, assessmentId, [proposal(run.documentId, "u-residual-rating", "accept"), proposal(run.documentId, "u-treatment", "accept")]);
  assert.equal(confirmed.status, 200, `CONFIRM_BOTH_${confirmed.status}_${confirmed.reason}`);
  assert.deepEqual([(await harness.getRisk(aiAccept))?.residualRating, (await harness.getRisk(aiAccept))?.treatmentAction], ["Moderate", "Accept"]);

  const before = await persistence(harness, assessmentId, requestId);
  const undone = await decide(harness, assessmentId, [proposal(run.documentId, "u-residual-rating", "restore")]);
  assert.deepEqual([undone.status, undone.reason], [409, "AI_ACCEPT_NOT_PERMITTED"], "UNDO_LEFT_AN_AI_ACCEPT_ON_A_HIGH_RESIDUAL");
  assert.deepEqual(await persistence(harness, assessmentId, requestId), before, "THE_REFUSED_UNDO_WROTE");
  // Undoing the Accept first, then the residual change, is the honest order and succeeds.
  const ordered = await decide(harness, assessmentId, [proposal(run.documentId, "u-treatment", "restore"), proposal(run.documentId, "u-residual-rating", "restore")]);
  assert.equal(ordered.status, 200, `ORDERED_UNDO_${ordered.status}_${ordered.reason}`);
  assert.deepEqual([(await harness.getRisk(aiAccept))?.residualRating, (await harness.getRisk(aiAccept))?.treatmentAction], ["High", "Treat"]);

  // Control: an Accept a person typed is not an AI-confirmed Accept, so the residual Undo restores.
  const typed = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${typedAccept}`, {
    residualLikelihood: "Likely", highestResidualConsequence: "Moderate", residualRating: "High", treatmentAction: "Accept", treatmentPlan: ACCEPT_PLAN,
  });
  assert.equal(typed.status, 200, `TYPED_PATCH_${typed.status}_${typed.message}`);
  const second = await craftedRewrite(harness, typedAccept, [residualUnit(typedAccept, ["Likely", "Moderate", "High"], ["Possible", "Moderate", "Moderate"])]);
  assert.equal((await decide(harness, assessmentId, [proposal(second.documentId, "u-residual-rating", "accept")])).status, 200, "TYPED_CONFIRM_FAILED");
  const typedUndo = await decide(harness, assessmentId, [proposal(second.documentId, "u-residual-rating", "restore")]);
  assert.equal(typedUndo.status, 200, `TYPED_UNDO_${typedUndo.status}_${typedUndo.reason}`);
  assert.equal((await harness.getRisk(typedAccept))?.residualRating, "High");
});

test("deciding a superseded or lapsed item is refused with AI_PROPOSAL_ALREADY_DECIDED (D-40)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "DECIDE-CLOSED");
  const older = await rewrite(harness, riskIds[0]);
  await rewrite(harness, riskIds[0]);
  const superseded = eventsOf(await storedRun(harness, String(older.documentId)));
  assert.ok(superseded.length > 0 && superseded.every((event) => event.action === "superseded"), "OLDER_UNITS_NOT_SUPERSEDED");
  for (const action of ["accept", "reject", "restore"] as const) {
    const refused = await decide(harness, assessmentId, [proposal(older.documentId, "u-risk-statement", action)]);
    assert.deepEqual([refused.status, refused.reason], [409, "AI_PROPOSAL_ALREADY_DECIDED"], `SUPERSEDED_${action}`);
  }

  const lapsed = await rewrite(harness, riskIds[1]);
  await harness.updateFixtureDocument("api::csrm-ai-run.csrm-ai-run", String(lapsed.documentId), {
    decisions: itemsOf(lapsed).map((item) => ({ schemaVersion: 2, at: new Date().toISOString(), by: "system", item: item.key, action: "lapsed", cause: { kind: "assessment-not-editable" } })),
  });
  const refused = await decide(harness, assessmentId, [proposal(lapsed.documentId, "u-risk-statement", "accept")]);
  assert.deepEqual([refused.status, refused.reason], [409, "AI_PROPOSAL_ALREADY_DECIDED"], "LAPSED");
});

/* ---------------------------------------------------------------------------------------------------------------------
 * Task 3: the requesting analyst, the closed parser, withdrawn risks, supersession on withdrawal, released assessments,
 * the fail-open read and the AI-inputs baseline
 * ------------------------------------------------------------------------------------------------------------------- */

test("OWN_REQUEST refuses Bob a decision on a proposal of a request he raised and nothing changes, while his Phase 12 field confirmation applies as before (G-1, Phase 15 D-32)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId, riskIds } = await draftedAssessment(harness, "DECIDE-OWN");
  const run = await suggest(harness, assessmentId);
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, { requestor: harness.users.analyst });
  const before = await persistence(harness, assessmentId, requestId);
  for (const action of ["accept", "reject", "restore"] as const) {
    const refused = await decide(harness, assessmentId, [proposal(run.documentId, paymentItem(run), action)]);
    assert.deepEqual([refused.status, refused.reason], [403, "OWN_REQUEST"], `OWN_REQUEST_${action}`);
  }
  const mixed = await decide(harness, assessmentId, [{ target: { kind: "risk", riskId: riskIds[0] }, action: "accept", fields: ["riskStatement"] }, proposal(run.documentId, paymentItem(run), "reject")]);
  assert.deepEqual([mixed.status, mixed.reason], [403, "OWN_REQUEST"], "OWN_REQUEST_MIXED_BATCH");
  assert.deepEqual(await persistence(harness, assessmentId, requestId), before, "A_REFUSED_OWN_REQUEST_BATCH_WROTE");
  // The second analyst did not raise it.
  assert.equal((await decide(harness, assessmentId, [proposal(run.documentId, paymentItem(run), "reject")], harness.identities.secondAnalyst)).status, 200);
  const field = await decide(harness, assessmentId, [{ target: { kind: "risk", riskId: riskIds[0] }, action: "accept", fields: ["riskStatement"] }]);
  assert.equal(field.status, 200, "PHASE_12_FIELD_CONFIRMATION_REFUSED");
  assert.equal((await provenanceOf(harness, riskIds[0])).fields.riskStatement?.state, "accepted");
});

test("a run of another assessment is 404 for the whole batch; an unknown item, reject on a Phase 12 target, dismiss on a proposal and a 501-character reason are 400; nothing changes (D-39, T-16-28)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId, riskIds } = await draftedAssessment(harness, "DECIDE-SHAPE");
  const other = await draftedAssessment(harness, "DECIDE-SHAPE-OTHER");
  const own = await suggest(harness, assessmentId);
  const foreign = await suggest(harness, other.assessmentId);
  const item = paymentItem(own);
  const before = await persistence(harness, assessmentId, requestId);
  const cases: Array<[number, DecisionEntry[], string]> = [
    [404, [proposal(own.documentId, item, "reject"), proposal(foreign.documentId, paymentItem(foreign), "accept")], "FOREIGN_RUN"],
    [404, [proposal("no-such-run", "s-1", "accept")], "UNKNOWN_RUN"],
    [404, [proposal(((await harness.getAssessment(assessmentId))?.aiProvenance as Json).runId, "s-1", "accept")], "THE_DRAFT_RUN"],
    [400, [proposal(own.documentId, "u-risk-statement", "accept")], "UNKNOWN_ITEM"],
    [400, [proposal(own.documentId, "s-9", "accept")], "ITEM_OUTSIDE_THE_KEYS"],
    [400, [{ target: { kind: "risk", riskId: riskIds[0] }, action: "reject", fields: ["riskStatement"] }], "REJECT_ON_A_FIELD"],
    [400, [{ target: { kind: "risk", riskId: riskIds[0] }, action: "accept", fields: ["riskStatement"], reason: "No" }], "REASON_ON_A_FIELD"],
    [400, [{ target: { kind: "proposal", runId: own.documentId, item }, action: "dismiss" }], "DISMISS_ON_A_PROPOSAL"],
    [400, [proposal(own.documentId, item, "reject", "x".repeat(501))], "REASON_OF_501"],
    [400, [proposal(own.documentId, item, "reject", "   ")], "BLANK_REASON"],
    [400, [proposal(own.documentId, item, "accept", "A reason")], "REASON_ON_AN_ACCEPT"],
    [400, [{ target: { kind: "proposal", runId: own.documentId, item, extra: true }, action: "accept" }], "EXTRA_TARGET_KEY"],
  ];
  for (const [status, decisions, name] of cases) {
    const refused = await decide(harness, assessmentId, decisions);
    assert.equal(refused.status, status, `${name}_${refused.status}_${refused.message}`);
  }
  assert.deepEqual(await persistence(harness, assessmentId, requestId), before, "A_REFUSED_BATCH_WROTE");
  const exact = await decide(harness, assessmentId, [proposal(own.documentId, item, "reject", "x".repeat(500))]);
  assert.equal(exact.status, 200, "A_500_CHARACTER_REASON_REFUSED");
});

test("withdrawing a risk records its two open rewrite changes superseded with cause risk-withdrawn by the withdrawing analyst; deciding one is AI_PROPOSAL_ALREADY_DECIDED and restoring its rejected change is RISK_WITHDRAWN (D-07, D-40)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "DECIDE-WITHDRAWN");
  const riskId = riskIds[0];
  const run = await rewrite(harness, riskId);
  const runId = String(run.documentId);
  assert.equal((await decide(harness, assessmentId, [proposal(runId, "u-residual-rating", "reject")])).status, 200);
  const open = itemsOf(run).map((item) => String(item.key)).filter((key) => key !== "u-residual-rating");
  assert.equal(open.length, 2, "TWO_OPEN_CHANGES_EXPECTED");
  const openBefore = Number((await readProposals(harness, assessmentId)).openCount);

  const withdrawn = await call(harness, harness.identities.secondAnalyst, "POST", `/api/v1/risk_assessments/${assessmentId}/risk_withdrawals`, { riskIds: [riskId], reason: "A duplicate of another risk." });
  assert.equal(withdrawn.status, 200, `WITHDRAW_${withdrawn.status}_${withdrawn.message}`);
  const events = eventsOf(await storedRun(harness, runId)).slice(1);
  assert.deepEqual(events.map((event) => [event.item, event.action, event.by, event.cause]),
    open.map((key) => [key, "superseded", harness.users.secondAnalyst, { kind: "risk-withdrawn", riskDocumentId: riskId }]), "NOT_SUPERSEDED_BY_THE_WITHDRAWING_ANALYST");
  const read = await readProposals(harness, assessmentId);
  assert.equal(Number(read.openCount), openBefore - 2, "OPEN_COUNT_DID_NOT_DROP_BY_TWO");
  for (const key of open) {
    const listed = (read.items as Json[]).find((item) => item.runId === runId && item.itemKey === key) as Json;
    assert.equal(listed.state, "superseded");
    assert.equal(((listed.decision as Json).cause as Json).kind, "risk-withdrawn");
  }
  // BE2-07: the rejected change stays rejected, but its Undo is not offered while its Risk is withdrawn.
  const rejectedRow = (read.items as Json[]).find((item) => item.runId === runId && item.itemKey === "u-residual-rating") as Json;
  assert.equal(rejectedRow.state, "rejected");
  assert.equal(rejectedRow.canUndo, false, "UNDO_OFFERED_ON_A_WITHDRAWN_RISK");
  const decided = await decide(harness, assessmentId, [proposal(runId, open[0], "accept")]);
  assert.deepEqual([decided.status, decided.reason], [409, "AI_PROPOSAL_ALREADY_DECIDED"]);
  const restored = await decide(harness, assessmentId, [proposal(runId, "u-residual-rating", "restore")]);
  assert.deepEqual([restored.status, restored.reason], [409, "RISK_WITHDRAWN"]);
  // A repeated withdrawal supersedes nothing more.
  assert.equal((await call(harness, harness.identities.analyst, "POST", `/api/v1/risk_assessments/${assessmentId}/risk_withdrawals`, { riskIds: [riskId], reason: "Again." })).status, 200);
  assert.equal(eventsOf(await storedRun(harness, runId)).length, 3, "A_REPEATED_WITHDRAWAL_RECORDED_MORE");
});

test("on a released assessment every proposal decision is ASSESSMENT_NOT_MUTABLE, and a rejection-only batch leaves a release-ready in-review assessment in review (D-22, D-23)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId } = await draftedAssessment(harness, "DECIDE-RELEASED");
  const run = await suggest(harness, assessmentId);
  await completeReleaseFields(harness, assessmentId);
  const item = paymentItem(run);
  assert.equal((await decide(harness, assessmentId, [proposal(run.documentId, item, "reject")])).status, 200);
  assert.equal((await decide(harness, assessmentId, [proposal(run.documentId, item, "restore")])).status, 200);
  assert.equal((await harness.getAssessment(assessmentId))?.assessmentStatus, "in-review", "A_REJECTION_OR_ITS_UNDO_WITHDREW_THE_REVIEW");

  await harness.updateFixtureDocument("api::csrm-assessment.csrm-assessment", assessmentId, { assessmentStatus: "approved", approvedBy: harness.users.analyst, approvalDate: new Date().toISOString() });
  const before = await persistence(harness, assessmentId, requestId);
  for (const action of ["accept", "reject", "restore"] as const) {
    const refused = await decide(harness, assessmentId, [proposal(run.documentId, item, action)]);
    assert.deepEqual([refused.status, refused.reason], [409, "ASSESSMENT_NOT_MUTABLE"], `RELEASED_${action}`);
  }
  assert.deepEqual(await persistence(harness, assessmentId, requestId), before);
});

test("a run whose stored decisions do not read counts no open item, readiness ignores it, the read logs it once, and its items take no decision (fail open, D-42)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "DECIDE-DAMAGED");
  const run = await suggest(harness, assessmentId);
  const runId = String(run.documentId);
  assert.ok(Number((await readProposals(harness, assessmentId)).openCount) > 0);
  await harness.updateFixtureDocument("api::csrm-ai-run.csrm-ai-run", runId, { decisions: [{ schemaVersion: 2, item: "s-1", action: "accepted" }] });
  const warnings: string[] = [];
  const restore = await harness.withBackendFixture(async (backend) => {
    const log = (backend as unknown as { log: { warn: (message: string) => unknown } }).log;
    const original = log.warn;
    log.warn = (message: string) => { warnings.push(String(message)); return original.call(log, message); };
    return () => { log.warn = original; };
  });
  try {
    const read = await readProposals(harness, assessmentId);
    assert.equal(read.openCount, 0, "A_DAMAGED_RUN_COUNTED_OPEN_ITEMS");
    await readProposals(harness, assessmentId);
    const readiness = (await detail(harness, assessmentId)).releaseReadiness as Json;
    assert.equal(requirement(readiness, "aiProposalsDecided")?.state, "met", "A_DAMAGED_RUN_BLOCKS_RELEASE");
  } finally {
    restore();
  }
  assert.equal(warnings.filter((message) => message.includes(runId)).length, 1, "THE_DAMAGED_RUN_WAS_NOT_LOGGED_ONCE");
  const refused = await decide(harness, assessmentId, [proposal(runId, "s-1", "accept")]);
  assert.deepEqual([refused.status, refused.reason], [409, "AI_RUN_RECORD_UNAVAILABLE"]);
});

test("AI inputs: a note marked after the draft raises the signal on the assessment and request reads; a completed Suggest more risks run clears it while generation.runId still names the draft run; a later note raises it again and a Rewrite this risk run leaves it raised (D-28)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId, riskIds } = await draftedAssessment(harness, "DECIDE-AI-INPUTS");
  const draftRunId = ((await harness.getAssessment(assessmentId))?.aiProvenance as Json).runId;
  const addMarkedNote = async (body: string): Promise<string> => {
    const note = await call(harness, harness.identities.owner, "POST", `/api/v1/assessment_requests/${requestId}/notes`, { data: { body } });
    assert.equal(note.status, 200, `NOTE_${note.status}_${note.message}`);
    const noteId = String((note.data as Json).documentId);
    const marked = await call(harness, harness.identities.analyst, "PUT", `/api/v1/assessment_requests/${requestId}/notes/${noteId}/ai_input`, { data: { changesAiInputs: true } });
    assert.equal(marked.status, 200, `MARK_${marked.status}_${marked.message}`);
    return noteId;
  };
  const signal = async (): Promise<{ assessment: Json | null; request: Json | null; runId: unknown }> => {
    const generation = (await detail(harness, assessmentId)).generation as Json;
    const requestRead = await call(harness, harness.identities.analyst, "GET", `/api/csrm-assessment-requests/${requestId}`);
    assert.equal(requestRead.status, 200);
    return { assessment: generation.aiInputsChanged as Json | null, request: ((requestRead.data as Json).aiInputs as Json).assessment as Json | null, runId: generation.runId };
  };
  const listed = (value: Json | null): string[] => ((value?.notes as Json[] | undefined) ?? []).map((note) => String(note.documentId));

  const first = await addMarkedNote("The payroll processor now also stores payment files offshore.");
  let now = await signal();
  assert.deepEqual([listed(now.assessment), listed(now.request), now.runId], [[first], [first], draftRunId], "THE_MARKED_NOTE_DOES_NOT_RAISE_THE_SIGNAL");

  await suggest(harness, assessmentId);
  now = await signal();
  assert.deepEqual([now.assessment, now.request, now.runId], [null, null, draftRunId], "A_SUGGESTIONS_RUN_DID_NOT_CLEAR_THE_SIGNAL");

  const second = await addMarkedNote("Payment files are now also sent to a second bank.");
  now = await signal();
  assert.deepEqual([listed(now.assessment), listed(now.request)], [[second], [second]], "A_NOTE_AFTER_THE_SUGGESTIONS_RUN_DOES_NOT_RAISE_THE_SIGNAL");
  await rewrite(harness, riskIds[0]);
  now = await signal();
  assert.deepEqual([listed(now.assessment), listed(now.request), now.runId], [[second], [second], draftRunId], "A_REWRITE_RUN_MOVED_THE_BASELINE");
});

/* ---------------------------------------------------------------------------------------------------------------------
 * The Phase 16 execution amendment (2026-10-16, item 1; pilot ruling 729ef6e0): an added Risk is reviewed per field with
 * Phase 12's decisions on the suggestion run that proposed it
 * ------------------------------------------------------------------------------------------------------------------- */

const v1Of = (run: Json): Json[] => eventsOf(run).filter((event) => event.schemaVersion === 1);
const v2Of = (run: Json): Json[] => eventsOf(run).filter((event) => event.schemaVersion === 2);
const ADDED_STATEMENT = "Payment files on the shared drive could be altered before upload, so a payment could reach the wrong account.";

test("an added risk is reviewed on its suggestion run: a human analyst's edit of a proposed field and Phase 12's Confirm remaining append v1 events to that run, its Review of AI proposals clears, the run's items fold as before, and the assessment releases with the added risk kept (amendment 2026-10-16, item 1)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "DECIDE-ADDED-REVIEW");
  const run = await suggest(harness, assessmentId);
  const runId = String(run.documentId);
  const item = paymentItem(run);
  const added = await decide(harness, assessmentId, [proposal(runId, item, "accept")]);
  assert.equal(added.status, 200, `ADD_${added.status}_${added.reason}`);
  const riskId = String((v2Of(await storedRun(harness, runId))[0].applied as Json).riskDocumentId);
  const riskNumber = String((await harness.getRisk(riskId))?.riskNumber);
  const foldBefore = await readProposals(harness, assessmentId);
  assert.equal((await provenanceOf(harness, riskId)).fields.riskStatement?.state, "proposed", "THE_STATEMENT_IS_NOT_PROPOSED");

  // A human analyst's edit of a proposed AI field: Phase 12's `edited` event lands on the suggestion run.
  const edited = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${riskId}`, { riskStatement: ADDED_STATEMENT });
  assert.equal(edited.status, 200, `EDIT_${edited.status}_${edited.reason}_${edited.message}`);
  assert.equal((await harness.getRisk(riskId))?.riskStatement, ADDED_STATEMENT);
  assert.equal((await provenanceOf(harness, riskId)).fields.riskStatement?.state, "edited", "THE_EDIT_WAS_NOT_MARKED");

  // Phase 12's "Confirm remaining": every field still proposed is confirmed, and its `accepted` event lands on the run.
  const confirmed = await decide(harness, assessmentId, [{ target: { kind: "risk", riskId }, action: "accept" }]);
  assert.equal(confirmed.status, 200, `CONFIRM_${confirmed.status}_${confirmed.reason}_${confirmed.message}`);
  const provenance = await provenanceOf(harness, riskId);
  assert.ok(Object.values(provenance.fields).every((fact) => fact?.state !== "proposed"), "A_FIELD_IS_STILL_PROPOSED");
  assert.equal(provenance.runId, runId, "THE_ENVELOPE_LEFT_THE_SUGGESTION_RUN");

  const stored = await storedRun(harness, runId);
  const fieldReview = v1Of(stored);
  assert.deepEqual(fieldReview.map((event) => [event.kind, event.target, event.by]), [["edited", riskId, harness.users.analyst], ["accepted", riskId, harness.users.analyst]], "THE_FIELD_REVIEW_IS_NOT_ON_THE_SUGGESTION_RUN");
  assert.deepEqual(fieldReview[0].fields, ["riskStatement"]);
  const remaining = fieldReview[1].fields as string[];
  assert.ok(Array.isArray(remaining) && remaining.length > 0 && !remaining.includes("riskStatement"), "CONFIRM_REMAINING_DID_NOT_NAME_THE_REMAINING_FIELDS");
  assert.equal(v2Of(stored).length, 1, "THE_FIELD_REVIEW_WROTE_AN_ITEM_EVENT");

  // The item fold reads only the v2 events: the proposals read is as it was before the field review.
  assert.deepEqual(await readProposals(harness, assessmentId), foldBefore, "THE_FIELD_REVIEW_CHANGED_THE_ITEM_FOLD");
  const readiness = (await detail(harness, assessmentId)).releaseReadiness as Json;
  assert.notEqual(requirement(readiness, "aiProposalsReviewed", riskNumber)?.state, "outstanding", "THE_ADDED_RISK_REVIEW_IS_STILL_OUTSTANDING");

  // The E1 journey ends in release with the added risk kept.
  await completeReleaseFields(harness, assessmentId);
  const open = ((await readProposals(harness, assessmentId)).items as Json[]).filter((entry) => entry.runId === runId && entry.state === "open").map((entry) => String(entry.itemKey));
  if (open.length) assert.equal((await decide(harness, assessmentId, open.map((key) => proposal(runId, key, "reject", "Not a risk for this request")))).status, 200, "REJECT_REST_FAILED");
  const ready = (await detail(harness, assessmentId)).releaseReadiness as Json;
  assert.equal(ready.ready, true, `NOT_READY_${JSON.stringify((ready.requirements as Json[]).filter((entry) => entry.state === "outstanding"))}`);
  const released = await call(harness, harness.identities.analyst, "POST", `${assessmentPath(assessmentId)}/release`);
  assert.equal(released.status, 200, `RELEASE_${released.status}_${released.message}`);
  assert.ok(!(await harness.getRisk(riskId))?.withdrawnAt, "THE_ADDED_RISK_WAS_WITHDRAWN_TO_RELEASE");
});

test("Phase 12's v1 events stay refused elsewhere and nothing is written: on a suggestions run for a drafted risk, the assessment or a risk another run added; on a rewrite run for another risk, the assessment, a suggested control or a field outside its units; and a v2 event on the draft run. A rewrite run takes a v1 field event for its own risk's unit fields; a mounted edit or confirm through a suggestions envelope, or of fields outside a rewrite's units, answers 409 AI_RUN_RECORD_UNAVAILABLE (amendment 2026-10-16, item 1; code review amendment 2026-10-16, BE2-01)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId, riskIds } = await draftedAssessment(harness, "DECIDE-ADDED-REFUSED");
  const draftRunId = String(((await harness.getAssessment(assessmentId))?.aiProvenance as Json).runId);
  const first = await suggest(harness, assessmentId);
  const firstId = String(first.documentId);
  assert.equal((await decide(harness, assessmentId, [proposal(firstId, paymentItem(first), "accept")])).status, 200, "ADD_FAILED");
  const addedId = String((v2Of(await storedRun(harness, firstId))[0].applied as Json).riskDocumentId);
  const secondId = String((await suggest(harness, assessmentId, "Risks about supplier access")).documentId);
  const rewriteId = String((await rewrite(harness, riskIds[0])).documentId);

  const at = new Date().toISOString();
  const v1 = (target: string) => ({ schemaVersion: 1 as const, at, by: harness.users.analyst, target, kind: "accepted" as const, fields: ["riskStatement"] });
  const refusals: [string, string, string][] = [
    [firstId, riskIds[0], "A_DRAFTED_RISK_ON_A_SUGGESTIONS_RUN"],
    [firstId, "assessment", "THE_ASSESSMENT_ON_A_SUGGESTIONS_RUN"],
    [secondId, addedId, "A_RISK_ANOTHER_RUN_ADDED"],
    [rewriteId, addedId, "AN_ADDED_RISK_ON_A_REWRITE_RUN"],
    [rewriteId, "assessment", "THE_ASSESSMENT_ON_A_REWRITE_RUN"],
  ];
  for (const [runId, target, label] of refusals) {
    const before = eventsOf(await storedRun(harness, runId));
    await assert.rejects(harness.appendAiRunDecisionsFixture(runId, [v1(target)]), AiRunRecordError, label);
    assert.deepEqual(eventsOf(await storedRun(harness, runId)), before, `${label}_WROTE`);
  }
  // The code review amendment (BE2-01): a rewrite run takes a v1 field event only for its own Risk and its units' fields.
  const rewriteBefore = eventsOf(await storedRun(harness, rewriteId));
  for (const [event, label] of [
    [{ ...v1(riskIds[0]), fields: ["issueStatement"] }, "A_FIELD_OUTSIDE_THE_REWRITE_UNITS"],
    [{ ...v1(riskIds[0]), fields: ["riskStatement", "issueStatement"] }, "A_FIELD_PARTLY_OUTSIDE_THE_REWRITE_UNITS"],
    [{ schemaVersion: 1 as const, at, by: harness.users.analyst, target: riskIds[0], kind: "dismissed" as const, item: "CTRL-001" }, "A_SUGGESTED_CONTROL_EVENT_ON_A_REWRITE_RUN"],
  ] as const) {
    await assert.rejects(harness.appendAiRunDecisionsFixture(rewriteId, [event as never]), AiRunRecordError, label);
    assert.deepEqual(eventsOf(await storedRun(harness, rewriteId)), rewriteBefore, `${label}_WROTE`);
  }
  await harness.appendAiRunDecisionsFixture(rewriteId, [v1(riskIds[0])]);
  const rewriteAfter = eventsOf(await storedRun(harness, rewriteId));
  assert.deepEqual(rewriteAfter, [...rewriteBefore, v1(riskIds[0])], "THE_REWRITE_RUN_REFUSED_ITS_OWN_RISK_FIELD_EVENT");
  // A batch whose v1 event for the added risk rides with a refused one writes nothing either.
  const firstBefore = eventsOf(await storedRun(harness, firstId));
  await assert.rejects(harness.appendAiRunDecisionsFixture(firstId, [v1(addedId), v1(riskIds[0])]), AiRunRecordError, "A_MIXED_BATCH_PASSED");
  assert.deepEqual(eventsOf(await storedRun(harness, firstId)), firstBefore, "A_MIXED_BATCH_WROTE");
  const draftBefore = eventsOf(await storedRun(harness, draftRunId));
  await assert.rejects(harness.appendAiRunDecisionsFixture(draftRunId, [{ schemaVersion: 2, at, by: harness.users.analyst, item: "s-1", action: "rejected", reason: "Not here." } as never]), AiRunRecordError, "A_V2_EVENT_ON_THE_DRAFT_RUN");
  assert.deepEqual(eventsOf(await storedRun(harness, draftRunId)), draftBefore, "THE_DRAFT_RUN_CHANGED");

  // Mounted: a drafted risk whose envelope names the suggestions run cannot be edited or confirmed.
  const target = riskIds.find((riskId) => riskId !== riskIds[0]) ?? riskIds[0];
  const envelope = (await harness.getRisk(target))?.aiProvenance as Json;
  const proposed = Object.entries(envelope.fields as Json).filter(([, fact]) => (fact as Json)?.state === "proposed").map(([field]) => field);
  assert.ok(proposed.includes("riskStatement"), "THE_DRAFTED_STATEMENT_IS_NOT_PROPOSED");
  await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", target, { aiProvenance: { ...envelope, runId: firstId } });
  const before = await persistence(harness, assessmentId, requestId);
  const edit = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${target}`, { riskStatement: ADDED_STATEMENT });
  assert.deepEqual([edit.status, edit.reason], [409, "AI_RUN_RECORD_UNAVAILABLE"], "EDIT_THROUGH_A_SUGGESTIONS_RUN");
  const confirm = await decide(harness, assessmentId, [{ target: { kind: "risk", riskId: target }, action: "accept" }]);
  assert.deepEqual([confirm.status, confirm.reason], [409, "AI_RUN_RECORD_UNAVAILABLE"], "CONFIRM_THROUGH_A_SUGGESTIONS_RUN");
  assert.deepEqual(await persistence(harness, assessmentId, requestId), before, "REFUSED_THROUGH_A_SUGGESTIONS_RUN_WROTE");

  // Mounted, the code review amendment (BE2-01): the rewrite run's own Risk, its envelope naming that run, takes the edit
  // of a field within the run's units on that run; Confirm remaining of the drafted fields outside its units is refused.
  const own = riskIds[0];
  const ownEnvelope = (await harness.getRisk(own))?.aiProvenance as Json;
  await harness.updateFixtureDocument("api::csrm-risk.csrm-risk", own, { aiProvenance: { ...ownEnvelope, runId: rewriteId } });
  const draftBefore2 = eventsOf(await storedRun(harness, draftRunId));
  const ownEdit = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${own}`, { riskStatement: ADDED_STATEMENT });
  assert.equal(ownEdit.status, 200, `EDIT_THROUGH_THE_REWRITE_RUN_${ownEdit.status}_${ownEdit.reason}`);
  assert.equal((await provenanceOf(harness, own)).fields.riskStatement?.state, "edited", "THE_EDIT_WAS_NOT_MARKED");
  const recorded = v1Of(await storedRun(harness, rewriteId)).at(-1) as Json;
  assert.deepEqual([recorded.kind, recorded.target, recorded.fields], ["edited", own, ["riskStatement"]], "THE_EDIT_IS_NOT_ON_THE_REWRITE_RUN");
  assert.deepEqual(eventsOf(await storedRun(harness, draftRunId)), draftBefore2, "THE_EDIT_WAS_RECORDED_ON_THE_DRAFT_RUN");
  const ownBefore = await persistence(harness, assessmentId, requestId);
  const ownConfirm = await decide(harness, assessmentId, [{ target: { kind: "risk", riskId: own }, action: "accept" }]);
  assert.deepEqual([ownConfirm.status, ownConfirm.reason], [409, "AI_RUN_RECORD_UNAVAILABLE"], "CONFIRM_OUTSIDE_THE_REWRITE_UNITS");
  assert.deepEqual(await persistence(harness, assessmentId, requestId), ownBefore, "REFUSED_CONFIRM_OUTSIDE_THE_UNITS_WROTE");
});

/*
 * The Phase 16 code review amendment (2026-10-16; 16-REVIEW BE2-01, BE2-03): Phase 12's field events for a value a
 * rewrite confirmed go to the rewrite run, whether the Risk was written by hand (its envelope names the rewrite run) or
 * drafted (its envelope names the draft run, the field's fact the rewrite run).
 */
test("a Risk written by hand whose rewrite change was confirmed takes Phase 12's restore and a later edit of that field, each recorded on the rewrite run (BE2-01)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "DECIDE-HAND-REVIEW");
  const created = await call(harness, harness.identities.analyst, "POST", `${assessmentPath(assessmentId)}/risks`, {
    riskStatement: "Staff could share payroll exports by email.", riskCause: "There is no approved channel for payroll exports.",
  });
  assert.equal(created.status, 201, `CREATE_${created.status}_${created.message}`);
  const riskId = String(created.data?.documentId);
  const run = await rewrite(harness, riskId);
  const runId = String(run.documentId);
  const confirmed = await decide(harness, assessmentId, [proposal(runId, "u-risk-statement", "accept"), proposal(runId, "u-risk-cause", "accept")]);
  assert.equal(confirmed.status, 200, `CONFIRM_${confirmed.status}_${confirmed.reason}`);
  assert.equal((await provenanceOf(harness, riskId)).runId, runId, "THE_HAND_RISK_ENVELOPE_DOES_NOT_NAME_THE_REWRITE_RUN");
  const itemsBefore = v2Of(await storedRun(harness, runId));

  const restored = await decide(harness, assessmentId, [{ target: { kind: "risk", riskId }, action: "restore", fields: ["riskStatement"] }]);
  assert.equal(restored.status, 200, `RESTORE_${restored.status}_${restored.reason}_${restored.message}`);
  const edited = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${riskId}`, { riskCause: "Payroll exports have no approved channel." });
  assert.equal(edited.status, 200, `EDIT_${edited.status}_${edited.reason}_${edited.message}`);
  assert.equal((await harness.getRisk(riskId))?.riskCause, "Payroll exports have no approved channel.");
  const provenance = await provenanceOf(harness, riskId);
  assert.deepEqual([provenance.fields.riskStatement?.state, provenance.fields.riskCause?.state], ["proposed", "edited"]);

  const stored = await storedRun(harness, runId);
  assert.deepEqual(v1Of(stored).map((event) => [event.kind, event.target, event.fields, event.by]),
    [["restored", riskId, ["riskStatement"], harness.users.analyst], ["edited", riskId, ["riskCause"], harness.users.analyst]], "THE_FIELD_REVIEW_IS_NOT_ON_THE_REWRITE_RUN");
  assert.deepEqual(v2Of(stored), itemsBefore, "THE_FIELD_REVIEW_WROTE_AN_ITEM_EVENT");
  const listed = ((await readProposals(harness, assessmentId)).items as Json[]).filter((entry) => entry.runId === runId);
  assert.deepEqual(listed.filter((entry) => ["u-risk-statement", "u-risk-cause"].includes(String(entry.itemKey))).map((entry) => entry.state), ["accepted", "accepted"], "THE_ITEM_FOLD_CHANGED");
});

test("on a drafted Risk, an edit of a field a rewrite confirmed is recorded on the rewrite run and nothing is appended to the draft run (BE2-03)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "DECIDE-DRAFTED-REVIEW");
  const riskId = riskIds[0];
  const draftRunId = (await provenanceOf(harness, riskId)).runId;
  const run = await rewrite(harness, riskId);
  const runId = String(run.documentId);
  assert.equal((await decide(harness, assessmentId, [proposal(runId, "u-risk-cause", "accept")])).status, 200, "CONFIRM_FAILED");
  assert.equal(fieldRunId(await provenanceOf(harness, riskId), "riskCause"), runId);
  const draftBefore = eventsOf(await storedRun(harness, draftRunId));

  const edited = await call(harness, harness.identities.analyst, "PATCH", `/api/v1/risks/${riskId}`, { riskCause: "An analyst's own account of the cause." });
  assert.equal(edited.status, 200, `EDIT_${edited.status}_${edited.reason}_${edited.message}`);
  assert.equal((await provenanceOf(harness, riskId)).fields.riskCause?.state, "edited");
  assert.deepEqual(v1Of(await storedRun(harness, runId)).map((event) => [event.kind, event.target, event.fields]), [["edited", riskId, ["riskCause"]]], "THE_EDIT_IS_NOT_ON_THE_REWRITE_RUN");
  assert.deepEqual(eventsOf(await storedRun(harness, draftRunId)), draftBefore, "THE_EDIT_WAS_APPENDED_TO_THE_DRAFT_RUN");
});
