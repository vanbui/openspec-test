import assert from "node:assert/strict";
import path from "node:path";
import test, { after } from "node:test";
import { PAYMENT_FILE_RISK } from "../src/csrm/ai/risk-proposals/deterministic-risk-proposal-provider";
import { startAuthorizationHttpHarness, type AuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 16 targeted AI re-runs on a mounted Strapi (16-09; D-22, D-24 to D-27, D-29, D-37, D-40, D-41, D-43; ASSESS-10
 * criterion 3, success criteria 2 and 4). A human Security Analyst who did not raise the request asks the AI to suggest
 * more risks or to rewrite one risk. Each start is a job on Phase 15's registry; each job records one run with its
 * operation, analyst, instruction, time, provider and context summary; completion writes proposals into the run under
 * the assessment's lock and changes no risk; the proposals read folds every item's state. Every case seeds its own
 * UAT-A-like request and drafts it with 12-06's deterministic job, so no case depends on another.
 */

// Emitted to `.tmp/tests-dist/tests`, so three parents up is the Strapi application.
const strapiDir = path.resolve(__dirname, "..", "..", "..");

const harnessPromise = startAuthorizationHttpHarness();
after(async () => {
  holdModule().setDeterministicRiskProposalHold(null);
  await (await harnessPromise).close();
});

type Json = Record<string, unknown>;
type Harness = AuthorizationHttpHarness;

/* The compiled modules the running Strapi loaded (the require cache is shared in this process). */
type CompiledWorkflow = {
  settledRiskProposalJob: (strapi: unknown, jobId: string) => Promise<Json | null>;
  activeRiskProposalJobs: (strapi: unknown, assessmentId: string) => readonly Json[];
};
function workflowModule(): CompiledWorkflow {
  return require(path.join(strapiDir, "dist", "src", "csrm", "ai", "risk-proposals", "risk-proposal-workflow.js")) as CompiledWorkflow;
}
function holdModule(): { setDeterministicRiskProposalHold: (promise: Promise<unknown> | null) => void } {
  return require(path.join(strapiDir, "dist", "src", "csrm", "ai", "risk-proposals", "deterministic-risk-proposal-provider.js")) as { setDeterministicRiskProposalHold: (promise: Promise<unknown> | null) => void };
}

/* Holds every deterministic risk proposal call until `release` runs. */
function holdProvider(): { release: () => void } {
  let release: () => void = () => undefined;
  holdModule().setDeterministicRiskProposalHold(new Promise<void>((resolve) => { release = resolve; }));
  return { release: () => { holdModule().setDeterministicRiskProposalHold(null); release(); } };
}

type Reply = { status: number; data: Json | null; reason: string | null; message: string | null };

async function call(harness: Harness, identity: string, method: "GET" | "POST", requestPath: string, body?: unknown): Promise<Reply> {
  const response = await harness.request({
    path: requestPath,
    identity,
    init: { method, ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }) },
  });
  const parsed = (await response.json().catch(() => null)) as { data?: Json; error?: { message?: string; details?: { reason?: string } } } | null;
  return { status: response.status, data: parsed?.data ?? null, reason: parsed?.error?.details?.reason ?? null, message: parsed?.error?.message ?? null };
}

const suggestionsPath = (assessmentId: string) => `/api/v1/risk_assessments/${assessmentId}/risk_suggestions`;
const proposalsPath = (assessmentId: string) => `/api/v1/risk_assessments/${assessmentId}/ai_proposals`;
const jobPath = (jobId: string) => `/api/v1/risk_proposal_jobs/${jobId}`;

/* A UAT-A-like request drafted by 12-06's deterministic job: an editable draft assessment with its drafted Risks. */
async function draftedAssessment(harness: Harness, label: string): Promise<{ requestId: string; questionnaireId: string; assessmentId: string; riskIds: string[] }> {
  const { requestId, questionnaireId } = await harness.seedUatALikeRequest(label);
  const { assessmentId } = await harness.runAssessmentDraftJobFixture(questionnaireId, harness.users.analyst);
  const assessment = await harness.getAssessment(assessmentId);
  const riskIds = ((assessment?.risks as Json[] | undefined) ?? []).map((risk) => String(risk.documentId));
  assert.ok(riskIds.length > 0, "DRAFT_HAS_NO_RISKS");
  return { requestId, questionnaireId, assessmentId, riskIds };
}

/* The assessment's risk proposal runs, oldest first, with their initiator. */
async function riskRuns(harness: Harness, assessmentId: string): Promise<Json[]> {
  return harness.withBackendFixture(async (backend) => {
    const documents = (backend.documents as unknown as (uid: string) => { findMany: (query: Json) => Promise<Json[]> })("api::csrm-ai-run.csrm-ai-run");
    return documents.findMany({
      filters: { assessment: { documentId: { $eq: assessmentId } }, operation: { $in: ["risk-suggestions", "risk-rewrite"] } },
      populate: { initiatedBy: { fields: ["documentId"] }, risk: { fields: ["documentId"] } },
      sort: ["startedAt:asc", "id:asc"], limit: 1_000,
    });
  });
}

async function settled(harness: Harness, jobId: string): Promise<Json> {
  const job = await harness.withBackendFixture((backend) => workflowModule().settledRiskProposalJob(backend, jobId));
  assert.ok(job, "RISK_PROPOSAL_JOB_NOT_FOUND");
  return job;
}

async function activeJobs(harness: Harness, assessmentId: string): Promise<readonly Json[]> {
  return harness.withBackendFixture(async (backend) => workflowModule().activeRiskProposalJobs(backend, assessmentId));
}

/* Starts "Suggest more risks" as `identity`, waits for the job and returns its final read over HTTP. */
async function suggestAndWait(harness: Harness, identity: string, assessmentId: string, body?: unknown): Promise<Json> {
  const started = await call(harness, identity, "POST", suggestionsPath(assessmentId), body);
  assert.equal(started.status, 202, `SUGGESTIONS_NOT_ACCEPTED_${started.status}_${started.message}`);
  const jobId = String(started.data?.jobId);
  await settled(harness, jobId);
  const read = await call(harness, identity, "GET", jobPath(jobId));
  assert.equal(read.status, 200, "JOB_READ_REFUSED");
  return read.data as Json;
}

/* Everything an AI proposal must not change: the assessment, its request and every Risk with its relations. */
async function persistedState(harness: Harness, assessmentId: string): Promise<unknown> {
  const assessment = await harness.getAssessment(assessmentId);
  return JSON.parse(JSON.stringify(assessment));
}

test("Suggest more risks: Bob's start is a recorded job whose run names him, the instruction, the provider and the risks listed, and changes no risk (D-24 to D-27, ASSESS-10 criterion 3)", async () => {
  const harness = await harnessPromise;
  const bob = harness.users.analyst;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "SUGGEST-RECORDED");
  const before = await persistedState(harness, assessmentId);

  const job = await suggestAndWait(harness, harness.identities.analyst, assessmentId, { instruction: "Risks about payment file integrity" });
  assert.equal(job.status, "completed", `SUGGESTIONS_JOB_${String(job.failureCode)}`);
  assert.equal(job.operation, "risk-suggestions");
  assert.equal(job.assessmentId, assessmentId);
  assert.equal(job.riskId, null);
  assert.equal(job.attempt, 1);
  assert.equal((job.initiatedBy as Json | null)?.documentId, bob, "JOB_DOES_NOT_NAME_BOB");
  assert.equal(job.canRetry, false);
  assert.ok(typeof job.runId === "string" && job.runId.length > 0, "COMPLETED_JOB_WITHOUT_A_RUN");

  const runs = await riskRuns(harness, assessmentId);
  assert.equal(runs.length, 1, "ONE_START_ONE_RUN");
  const [run] = runs;
  assert.equal(run.documentId, job.runId);
  assert.equal(run.operation, "risk-suggestions");
  assert.equal(run.status, "completed");
  assert.equal((run.initiatedBy as Json | null)?.documentId, bob, "RUN_DOES_NOT_NAME_BOB");
  assert.equal(run.instruction, "Risks about payment file integrity");
  assert.equal(run.providerName, "deterministic-risk-proposals");
  assert.equal(run.jobId, job.jobId);
  assert.ok(run.startedAt && run.completedAt, "RUN_NOT_DATED");
  const summary = run.contextSummary as Json;
  assert.equal(summary.operation, "risk-suggestions");
  assert.equal((summary.riskProposals as Json).risksListed, riskIds.length, "SUMMARY_DOES_NOT_COUNT_THE_DRAFT_RISKS");

  assert.deepEqual(await persistedState(harness, assessmentId), before, "A_SUGGESTION_RUN_CHANGED_THE_ASSESSMENT_OR_A_RISK");
});

test("the proposals read folds the open suggestions with the payment-file risk, a similar flag with its risk number, the run's adjustments and the analyst's actions (D-41)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "SUGGEST-READ");
  const before = await persistedState(harness, assessmentId);
  const job = await suggestAndWait(harness, harness.identities.analyst, assessmentId, { instruction: "Risks about payment file integrity" });
  assert.equal(job.status, "completed");

  const read = await call(harness, harness.identities.analyst, "GET", proposalsPath(assessmentId));
  assert.equal(read.status, 200, `PROPOSALS_READ_${read.status}_${read.message}`);
  const proposals = read.data as Json;
  const [run] = await riskRuns(harness, assessmentId);
  const kept = ((run.proposal as Json).items as Json[]).length;
  assert.ok(kept > 0, "NO_SUGGESTION_KEPT");
  assert.equal(proposals.assessmentId, assessmentId);
  assert.equal(proposals.editable, true);
  assert.equal(proposals.openCount, kept, "OPEN_COUNT_IS_NOT_THE_KEPT_SUGGESTIONS");
  assert.deepEqual(proposals.openByRisk, [], "SUGGESTIONS_COUNTED_AGAINST_A_RISK");
  assert.ok(typeof proposals.lastAskedAt === "string", "LAST_ASKED_AT_NOT_SET");
  assert.deepEqual((proposals.actions as Json).suggest, { allowed: true, reason: null });
  assert.deepEqual((proposals.actions as Json).decide, { allowed: true, reason: null });

  const items = proposals.items as Json[];
  assert.equal(items.length, kept);
  assert.ok(items.every((item) => item.state === "open" && item.kind === "risk" && item.runId === run.documentId && item.stale === null && item.decision === null), "ITEMS_NOT_OPEN_SUGGESTIONS");
  const payment = items.find((item) => (item.proposed as Json).riskStatement === PAYMENT_FILE_RISK.riskStatement);
  assert.ok(payment, "PAYMENT_FILE_RISK_NOT_PROPOSED");
  assert.equal((payment.proposed as Json).riskType, null, "PAYMENT_FILE_RISK_HAS_A_RISK_TYPE");
  assert.ok((payment.sources as Json[]).length > 0, "PAYMENT_FILE_RISK_CITES_NOTHING");
  assert.ok((payment.sources as Json[]).every((source) => typeof source.label === "string" && source.label.length > 0), "SOURCE_WITHOUT_A_LABEL");
  const similar = items.find((item) => item.similarTo !== null);
  assert.ok(similar, "NO_SUGGESTION_FLAGGED_SIMILAR");
  const similarTo = similar.similarTo as Json;
  assert.equal(similarTo.kind, "active");
  const assessment = await harness.getAssessment(assessmentId);
  const numbers = ((assessment?.risks as Json[]) ?? []).map((risk) => risk.riskNumber);
  assert.ok(typeof similarTo.riskNumber === "string" && numbers.includes(similarTo.riskNumber), "SIMILAR_RISK_NUMBER_NOT_RESOLVED");

  const facts = (proposals.runs as Json[]).find((entry) => entry.runId === run.documentId) as Json;
  assert.ok(facts, "RUN_FACTS_MISSING");
  assert.equal(facts.operation, "risk-suggestions");
  assert.equal((facts.initiatedBy as Json).documentId, harness.users.analyst);
  assert.equal(facts.instruction, "Risks about payment file integrity");
  assert.equal(facts.providerName, "deterministic-risk-proposals");
  assert.equal(facts.outcome, "items");
  assert.deepEqual(facts.counts, { items: kept, open: kept });
  const codes = (facts.adjustments as Json[]).map((adjustment) => adjustment.code);
  assert.ok(codes.includes("near-duplicate-active"), "NEAR_DUPLICATE_NOT_REPORTED");
  assert.ok(codes.includes("accept-not-permitted"), "ACCEPT_DOWNGRADE_NOT_REPORTED");
  assert.deepEqual(proposals.jobs, [], "COMPLETED_JOB_LISTED_AS_ACTIVE");

  assert.deepEqual(await persistedState(harness, assessmentId), before, "THE_READ_OR_THE_RUN_CHANGED_THE_ASSESSMENT");
});

test("a second start while the first is held returns the same job; after it completes a new start is a new job and a second run (D-26, 16-RESEARCH Pitfall 8)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "SUGGEST-SINGLE-FLIGHT");
  const hold = holdProvider();
  let firstJobId: string;
  try {
    const first = await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId));
    assert.equal(first.status, 202);
    firstJobId = String(first.data?.jobId);
    const second = await call(harness, harness.identities.secondAnalyst, "POST", suggestionsPath(assessmentId), { instruction: "Anything about suppliers" });
    assert.equal(second.status, 202);
    assert.equal(second.data?.jobId, firstJobId, "SINGLE_FLIGHT_BROKEN");
    assert.equal(((second.data?.initiatedBy as Json | null)?.documentId), harness.users.analyst, "SECOND_START_TOOK_OVER_THE_JOB");
    const active = await call(harness, harness.identities.analyst, "GET", proposalsPath(assessmentId));
    assert.deepEqual(((active.data?.jobs as Json[]) ?? []).map((job) => job.jobId), [firstJobId], "ACTIVE_JOB_NOT_IN_THE_READ");
  } finally {
    hold.release();
  }
  assert.equal((await settled(harness, firstJobId)).status, "completed");
  const next = await suggestAndWait(harness, harness.identities.analyst, assessmentId);
  assert.notEqual(next.jobId, firstJobId, "A_COMPLETED_JOB_BLOCKED_A_NEW_RUN");
  assert.equal(next.status, "completed");
  const runs = await riskRuns(harness, assessmentId);
  assert.equal(runs.length, 2, "TWO_STARTS_TWO_RUNS");
  assert.notEqual(runs[0].documentId, runs[1].documentId);
});

test("the Requestor, the Secondary Requestor and the service agent get 403 on the start and the read, and OWN_REQUEST refuses Bob on a request he raised; nothing is queued (D-43, G-1)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, requestId } = await draftedAssessment(harness, "SUGGEST-REFUSED");
  for (const identity of [harness.identities.owner, harness.identities.otherRequestor, harness.identities.serviceAnalystAgent]) {
    const start = await call(harness, identity, "POST", suggestionsPath(assessmentId), { instruction: "Payment files" });
    assert.equal(start.status, 403, `START_NOT_REFUSED_${identity}`);
    const read = await call(harness, identity, "GET", proposalsPath(assessmentId));
    assert.equal(read.status, 403, `READ_NOT_REFUSED_${identity}`);
  }
  assert.deepEqual(await activeJobs(harness, assessmentId), [], "A_REFUSED_START_QUEUED_A_JOB");
  assert.deepEqual(await riskRuns(harness, assessmentId), [], "A_REFUSED_START_CREATED_A_RUN");

  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", requestId, { requestor: harness.users.analyst });
  const own = await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId), { instruction: "Payment files" });
  assert.deepEqual([own.status, own.reason], [403, "OWN_REQUEST"], "OWN_REQUEST_START_NOT_REFUSED");
  const ownRead = await call(harness, harness.identities.analyst, "GET", proposalsPath(assessmentId));
  assert.deepEqual([ownRead.status, ownRead.reason], [403, "OWN_REQUEST"], "OWN_REQUEST_READ_NOT_REFUSED");
  assert.deepEqual(await activeJobs(harness, assessmentId), [], "OWN_REQUEST_QUEUED_A_JOB");
  assert.deepEqual(await riskRuns(harness, assessmentId), [], "OWN_REQUEST_CREATED_A_RUN");
  // The second analyst did not raise it, so the request is still theirs to work on.
  assert.equal((await call(harness, harness.identities.secondAnalyst, "GET", proposalsPath(assessmentId))).status, 200);
});

test("an unknown assessment is 404 and a body outside the closed shape is 400, with nothing queued", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "SUGGEST-SHAPE");
  assert.equal((await call(harness, harness.identities.analyst, "POST", suggestionsPath("no-such-assessment"))).status, 404);
  assert.equal((await call(harness, harness.identities.analyst, "GET", proposalsPath("no-such-assessment"))).status, 404);
  assert.equal((await call(harness, harness.identities.analyst, "GET", jobPath("no-such-job"))).status, 404);
  assert.equal((await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId), { instruction: "x", focus: ["statement"] })).status, 400);
  assert.equal((await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId), { instruction: 42 })).status, 400);
  assert.deepEqual(await activeJobs(harness, assessmentId), []);
  assert.deepEqual(await riskRuns(harness, assessmentId), []);
});

/* ---------------------------------------------------------------------------------------------------------------------
 * Task 2: "Rewrite this risk", retry, and the lifecycle refusals
 * ------------------------------------------------------------------------------------------------------------------- */

const rewritePath = (riskId: string) => `/api/v1/risks/${riskId}/rewrite`;
const retryPath = (jobId: string) => `/api/v1/risk_proposal_jobs/${jobId}/retry`;

type ProviderObject = { suggest: (...args: unknown[]) => Promise<unknown>; rewrite: (...args: unknown[]) => Promise<unknown> };
function providerObject(): ProviderObject {
  return (require(path.join(strapiDir, "dist", "src", "csrm", "ai", "risk-proposals", "deterministic-risk-proposal-provider.js")) as { deterministicRiskProposalProvider: ProviderObject }).deterministicRiskProposalProvider;
}

/* Counts every deterministic provider call while `action` runs; `failNext` makes the next calls throw. */
async function withProviderCalls<T>(action: (calls: { count: () => number; failNext: (times: number) => void }) => Promise<T>): Promise<T> {
  const provider = providerObject();
  const original = { suggest: provider.suggest, rewrite: provider.rewrite };
  let count = 0;
  let failures = 0;
  const wrap = (method: "suggest" | "rewrite") => async (...args: unknown[]) => {
    count += 1;
    if (failures > 0) { failures -= 1; throw new Error("injected risk proposal provider failure"); }
    return original[method].apply(provider, args);
  };
  provider.suggest = wrap("suggest");
  provider.rewrite = wrap("rewrite");
  try {
    return await action({ count: () => count, failNext: (times) => { failures = times; } });
  } finally {
    provider.suggest = original.suggest;
    provider.rewrite = original.rewrite;
  }
}

async function rewriteAndWait(harness: Harness, identity: string, riskId: string, body?: unknown): Promise<Json> {
  const started = await call(harness, identity, "POST", rewritePath(riskId), body);
  assert.equal(started.status, 202, `REWRITE_NOT_ACCEPTED_${started.status}_${started.reason}_${started.message}`);
  const jobId = String(started.data?.jobId);
  await settled(harness, jobId);
  return (await call(harness, identity, "GET", jobPath(jobId))).data as Json;
}

/* Waits until the assessment has a running risk proposal run, so a held job has reached its provider call. */
async function runningRun(harness: Harness, assessmentId: string): Promise<Json> {
  for (let attempt = 0; attempt < 400; attempt += 1) {
    const running = (await riskRuns(harness, assessmentId)).find((run) => run.status === "running");
    if (running) return running;
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error("NO_RUNNING_RISK_PROPOSAL_RUN");
}

/* The released facts, set directly: what the release path writes (Phase 04 D-04), without its readiness gate. */
async function releaseFixture(harness: Harness, assessmentId: string): Promise<void> {
  await harness.updateFixtureDocument("api::csrm-assessment.csrm-assessment", assessmentId, { assessmentStatus: "approved", approvedBy: harness.users.analyst, approvalDate: new Date().toISOString() });
}

async function readProposals(harness: Harness, identity: string, assessmentId: string): Promise<Json> {
  const read = await call(harness, identity, "GET", proposalsPath(assessmentId));
  assert.equal(read.status, 200, `PROPOSALS_READ_${read.status}_${read.message}`);
  return read.data as Json;
}

test("Rewrite this risk: Bob's focused rewrite is a recorded run whose changes read as fresh units of the risk, with the uncited cause, and openByRisk lists it (D-34 to D-37)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "REWRITE-READ");
  const riskId = riskIds[0];
  const before = await persistedState(harness, assessmentId);
  const job = await rewriteAndWait(harness, harness.identities.analyst, riskId, { focus: ["statement", "ratings"] });
  assert.equal(job.status, "completed", `REWRITE_JOB_${String(job.failureCode)}`);
  assert.equal(job.operation, "risk-rewrite");
  assert.equal(job.riskId, riskId);
  const [run] = await riskRuns(harness, assessmentId);
  assert.equal(run.operation, "risk-rewrite");
  assert.equal((run.risk as Json | null)?.documentId, riskId, "REWRITE_RUN_DOES_NOT_NAME_ITS_RISK");
  assert.equal((run.initiatedBy as Json).documentId, harness.users.analyst);

  const proposals = await readProposals(harness, harness.identities.analyst, assessmentId);
  const items = (proposals.items as Json[]).filter((item) => item.runId === run.documentId);
  assert.ok(items.length > 0, "REWRITE_PROPOSED_NOTHING");
  assert.ok(items.every((item) => item.kind === "change" && item.riskId === riskId && item.state === "open" && item.stale === false), "REWRITE_ITEMS_NOT_FRESH_OPEN_CHANGES");
  assert.ok(items.every((item) => item.current !== null && item.proposed !== null), "CHANGE_WITHOUT_VALUES");
  assert.ok(items.every((item) => !["u-treatment", "u-treatment-action", "u-treatment-plan"].includes(String(item.unitKey))), "CHANGE_OUTSIDE_THE_FOCUS");
  const statement = items.find((item) => item.unitKey === "u-risk-statement") as Json;
  assert.ok(statement, "NO_STATEMENT_CHANGE");
  assert.notEqual((statement.proposed as Json).riskStatement, (statement.current as Json).riskStatement);
  const cause = items.find((item) => item.unitKey === "u-risk-cause") as Json;
  assert.ok(cause, "NO_CAUSE_CHANGE");
  assert.deepEqual(cause.sources, [], "UNCITED_CAUSE_CITES");
  assert.ok((cause.uncited as string[]).length > 0, "UNCITED_CAUSE_WITHOUT_ITS_CLAIM");
  assert.deepEqual(proposals.openByRisk, [{ riskId, count: items.length }]);
  assert.equal(proposals.openCount, items.length);
  const facts = (proposals.runs as Json[]).find((entry) => entry.runId === run.documentId) as Json;
  assert.equal(facts.riskId, riskId);
  assert.deepEqual(facts.focus, ["statement", "ratings"]);
  assert.deepEqual(await persistedState(harness, assessmentId), before, "A_REWRITE_RUN_CHANGED_THE_RISK");
});

test("superseded: a newer rewrite of the same risk that completes with changes supersedes the older open changes, naming its run; a no-change rewrite leaves them open (D-40, Pitfall 12)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "REWRITE-SUPERSEDE");
  const riskId = riskIds[0];
  const first = await rewriteAndWait(harness, harness.identities.analyst, riskId, { focus: ["statement"] });
  assert.equal(first.status, "completed");
  const unchanged = await rewriteAndWait(harness, harness.identities.secondAnalyst, riskId, { focus: ["treatment"] });
  assert.equal(unchanged.status, "completed");
  let proposals = await readProposals(harness, harness.identities.analyst, assessmentId);
  const noChange = (proposals.runs as Json[]).find((entry) => entry.runId === unchanged.runId) as Json;
  assert.equal(noChange.outcome, "no-change", "TREATMENT_FOCUS_PROPOSED_A_CHANGE");
  const firstItems = () => (proposals.items as Json[]).filter((item) => item.runId === first.runId);
  assert.ok(firstItems().length > 0 && firstItems().every((item) => item.state === "open"), "A_NO_CHANGE_REWRITE_CLOSED_THE_OLDER_CHANGES");

  const newer = await rewriteAndWait(harness, harness.identities.secondAnalyst, riskId, { focus: ["statement"] });
  assert.equal(newer.status, "completed");
  proposals = await readProposals(harness, harness.identities.analyst, assessmentId);
  assert.ok(firstItems().every((item) => item.state === "superseded"), "OLDER_CHANGES_NOT_SUPERSEDED");
  for (const item of firstItems()) {
    const decision = item.decision as Json;
    assert.equal(decision.action, "superseded");
    assert.deepEqual(decision.cause, { kind: "newer-rewrite", runId: newer.runId, riskId: null });
    assert.equal((decision.by as Json).documentId, harness.users.secondAnalyst, "SUPERSESSION_NOT_BY_THE_NEWER_INITIATOR");
  }
  const newerOpen = (proposals.items as Json[]).filter((item) => item.runId === newer.runId && item.state === "open");
  assert.equal(proposals.openCount, newerOpen.length, "OPEN_COUNT_STILL_HOLDS_THE_SUPERSEDED_CHANGES");
});

test("ASSESSMENT_NOT_MUTABLE: on a released assessment both starts are refused with no job or run, and the read offers neither; RISK_WITHDRAWN refuses a rewrite of a withdrawn risk (D-22, D-29, success criterion 4)", async () => {
  const harness = await harnessPromise;
  const released = await draftedAssessment(harness, "REWRITE-RELEASED");
  await releaseFixture(harness, released.assessmentId);
  const suggestions = await call(harness, harness.identities.analyst, "POST", suggestionsPath(released.assessmentId));
  assert.deepEqual([suggestions.status, suggestions.reason], [409, "ASSESSMENT_NOT_MUTABLE"]);
  const rewrite = await call(harness, harness.identities.analyst, "POST", rewritePath(released.riskIds[0]), { focus: ["statement"] });
  assert.deepEqual([rewrite.status, rewrite.reason], [409, "ASSESSMENT_NOT_MUTABLE"]);
  assert.deepEqual(await activeJobs(harness, released.assessmentId), [], "RELEASED_START_QUEUED_A_JOB");
  assert.deepEqual(await riskRuns(harness, released.assessmentId), [], "RELEASED_START_CREATED_A_RUN");
  const proposals = await readProposals(harness, harness.identities.analyst, released.assessmentId);
  assert.equal(proposals.editable, false);
  assert.deepEqual((proposals.actions as Json).suggest, { allowed: false, reason: "ASSESSMENT_NOT_MUTABLE" });
  assert.deepEqual((proposals.actions as Json).rewrite, { allowed: false, reason: "ASSESSMENT_NOT_MUTABLE" });
  assert.deepEqual((proposals.actions as Json).decide, { allowed: false, reason: "ASSESSMENT_NOT_MUTABLE" });

  const editable = await draftedAssessment(harness, "REWRITE-WITHDRAWN");
  await harness.setRiskWithdrawalFactsFixture(editable.riskIds[0], { withdrawnAt: new Date().toISOString(), withdrawnBy: harness.users.analyst, withdrawalReason: "Duplicate of another risk." });
  const withdrawn = await call(harness, harness.identities.analyst, "POST", rewritePath(editable.riskIds[0]));
  assert.deepEqual([withdrawn.status, withdrawn.reason], [409, "RISK_WITHDRAWN"]);
  assert.equal((await call(harness, harness.identities.analyst, "POST", rewritePath("no-such-risk"))).status, 404);
  assert.deepEqual(await activeJobs(harness, editable.assessmentId), []);
  assert.deepEqual(await riskRuns(harness, editable.assessmentId), []);
});

test("lapsed: a run that completes after the assessment was released records every item lapsed by the system, the open count is 0 and nothing else changes (D-40, Pitfall 9)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "SUGGEST-LAPSED");
  const hold = holdProvider();
  let jobId: string;
  try {
    const started = await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId), { instruction: "Risks about payment file integrity" });
    assert.equal(started.status, 202);
    jobId = String(started.data?.jobId);
    await runningRun(harness, assessmentId);
    await releaseFixture(harness, assessmentId);
  } finally {
    hold.release();
  }
  const releasedState = await persistedState(harness, assessmentId);
  const job = await settled(harness, jobId);
  assert.equal(job.status, "completed", "A_LAPSED_RUN_FAILED_ITS_JOB");
  const proposals = await readProposals(harness, harness.identities.analyst, assessmentId);
  const items = proposals.items as Json[];
  assert.ok(items.length > 0, "LAPSED_RUN_KEPT_NO_ITEM");
  for (const item of items) {
    assert.equal(item.state, "lapsed");
    assert.deepEqual((item.decision as Json).cause, { kind: "assessment-not-editable", runId: null, riskId: null });
    assert.equal((item.decision as Json).by, null, "A_LAPSE_NAMES_A_PERSON");
  }
  assert.equal(proposals.openCount, 0);
  assert.deepEqual(await persistedState(harness, assessmentId), releasedState, "LAPSED_COMPLETION_CHANGED_THE_ASSESSMENT");
});

test("superseded with cause risk-withdrawn: a rewrite whose risk Bob withdraws while it runs records its units superseded by Bob (D-40)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "REWRITE-WITHDRAWN-MEANWHILE");
  const riskId = riskIds[0];
  const hold = holdProvider();
  let jobId: string;
  try {
    const started = await call(harness, harness.identities.analyst, "POST", rewritePath(riskId), { focus: ["statement"] });
    assert.equal(started.status, 202);
    jobId = String(started.data?.jobId);
    await runningRun(harness, assessmentId);
    const withdrawal = await call(harness, harness.identities.analyst, "POST", `/api/v1/risk_assessments/${assessmentId}/risk_withdrawals`, { riskIds: [riskId], reason: "Duplicate of another risk." });
    assert.equal(withdrawal.status, 200, `WITHDRAWAL_${withdrawal.status}_${withdrawal.message}`);
  } finally {
    hold.release();
  }
  assert.equal((await settled(harness, jobId)).status, "completed");
  const proposals = await readProposals(harness, harness.identities.analyst, assessmentId);
  const items = proposals.items as Json[];
  assert.ok(items.length > 0, "WITHDRAWN_REWRITE_KEPT_NO_UNIT");
  for (const item of items) {
    assert.equal(item.state, "superseded");
    assert.deepEqual((item.decision as Json).cause, { kind: "risk-withdrawn", runId: null, riskId });
    assert.equal(((item.decision as Json).by as Json).documentId, harness.users.analyst);
  }
  assert.equal(proposals.openCount, 0);
  assert.deepEqual(proposals.openByRisk, []);
});

test("the AI data policy refuses a start with 409 and, changed after enqueue, fails the job with its code before any provider call or run (D-25, T-16-26)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "RISK-POLICY");
  await withProviderCalls(async (calls) => {
    // The UAT-A-like request is Restricted; a ceiling of Internal refuses it at the start.
    await harness.withAiDataClassificationCeiling("Internal", async () => {
      const suggestions = await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId));
      assert.deepEqual([suggestions.status, suggestions.reason], [409, "AI_CLASSIFICATION_ABOVE_CEILING"]);
      const rewrite = await call(harness, harness.identities.analyst, "POST", rewritePath(riskIds[0]));
      assert.deepEqual([rewrite.status, rewrite.reason], [409, "AI_CLASSIFICATION_ABOVE_CEILING"]);
      const proposals = await readProposals(harness, harness.identities.analyst, assessmentId);
      assert.deepEqual((proposals.actions as Json).suggest, { allowed: false, reason: "AI_CLASSIFICATION_ABOVE_CEILING" });
    });
    assert.deepEqual(await activeJobs(harness, assessmentId), []);
    // A ceiling pinned while the job waits to build its context: the job fails with the policy's code and sends nothing.
    const job = await harness.withHeldAiContext(async ({ reached, release }) => {
      const started = await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId));
      assert.equal(started.status, 202);
      await reached;
      return harness.withAiDataClassificationCeiling("Internal", async () => {
        release();
        return settled(harness, String(started.data?.jobId));
      });
    });
    assert.deepEqual([job.status, (job.failure as Json).code], ["failed", "AI_CLASSIFICATION_ABOVE_CEILING"]);
    assert.equal(calls.count(), 0, "POLICY_REFUSED_JOB_CALLED_THE_PROVIDER");
  });
  assert.deepEqual(await riskRuns(harness, assessmentId), [], "POLICY_REFUSED_JOB_CREATED_A_RUN");
});

/*
 * BE2-05 (T-16-26, G-3): a risk proposal context sends Risk content, so the AI data policy weighs each Risk the context
 * lists (its own classification and its linked asset's) beside the request's assets: at the start, in the proposals
 * read and when the job builds its context. Nothing above the ceiling reaches the provider.
 */
async function patchRisk(harness: Harness, riskId: string, body: Json): Promise<void> {
  const response = await harness.request({ path: `/api/v1/risks/${riskId}`, identity: harness.identities.analyst,
    init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } });
  assert.equal(response.status, 200, `RISK_PATCH_${response.status}_${await response.clone().text()}`);
}

test("the AI data policy weighs the Risks a risk proposal context lists and their linked assets, at the start, in the read and in the job (T-16-26, BE2-05)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "RISK-POLICY-RISKS");
  const riskId = riskIds[0];
  const classification = (await harness.getRisk(riskId))?.dataClassification ?? null;
  const highAsset = await harness.withBackendFixture(async (backend) => {
    const created = await (backend.documents as unknown as (uid: string) => { create: (input: Json) => Promise<Json> })("api::csrm-information-asset.csrm-information-asset")
      .create({ data: { name: "Grid control telemetry", type: "Data", dataClassification: "Critical Infrastructure Sensitive" } });
    return String(created.documentId);
  });
  const refusedBoth = async (label: string) => {
    const rewrite = await call(harness, harness.identities.analyst, "POST", rewritePath(riskId));
    assert.deepEqual([rewrite.status, rewrite.reason], [409, "AI_CLASSIFICATION_ABOVE_CEILING"], `${label}_REWRITE_STARTED`);
    const suggestions = await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId));
    assert.deepEqual([suggestions.status, suggestions.reason], [409, "AI_CLASSIFICATION_ABOVE_CEILING"], `${label}_SUGGESTIONS_STARTED`);
    const actions = (await readProposals(harness, harness.identities.analyst, assessmentId)).actions as Json;
    assert.deepEqual([actions.suggest, actions.rewrite], [{ allowed: false, reason: "AI_CLASSIFICATION_ABOVE_CEILING" }, { allowed: false, reason: "AI_CLASSIFICATION_ABOVE_CEILING" }], `${label}_READ_OFFERS_THE_AI`);
  };
  await withProviderCalls(async (calls) => {
    await harness.withAiDataClassificationCeiling("Restricted", async () => {
      const baseline = (await readProposals(harness, harness.identities.analyst, assessmentId)).actions as Json;
      assert.deepEqual([baseline.suggest, baseline.rewrite], [{ allowed: true, reason: null }, { allowed: true, reason: null }], "THE_RESTRICTED_REQUEST_IS_NOT_ALLOWED");
      // A Risk classified above the ceiling.
      await patchRisk(harness, riskId, { dataClassification: "Critical Infrastructure Sensitive" });
      await refusedBoth("RISK_CLASSIFICATION");
      await patchRisk(harness, riskId, { dataClassification: classification });
      // A Risk linked to an asset above the ceiling that the request does not select.
      await patchRisk(harness, riskId, { informationAssetImpacted: highAsset });
      await refusedBoth("LINKED_ASSET");
      await patchRisk(harness, riskId, { informationAssetImpacted: null });
      // Raised while the job waits to build its context: the job fails with the policy's code and sends nothing.
      const job = await harness.withHeldAiContext(async ({ reached, release }) => {
        const started = await call(harness, harness.identities.analyst, "POST", rewritePath(riskId));
        assert.equal(started.status, 202, `REWRITE_NOT_STARTED_${started.status}_${started.reason}`);
        await reached;
        await patchRisk(harness, riskId, { dataClassification: "Critical Infrastructure Sensitive" });
        release();
        return settled(harness, String(started.data?.jobId));
      });
      assert.deepEqual([job.status, (job.failure as Json | null)?.code], ["failed", "AI_CLASSIFICATION_ABOVE_CEILING"], "THE_JOB_BUILT_A_CONTEXT_ABOVE_THE_CEILING");
    });
    assert.equal(calls.count(), 0, "A_RISK_ABOVE_THE_CEILING_REACHED_THE_PROVIDER");
  });
  assert.deepEqual(await riskRuns(harness, assessmentId), [], "A_POLICY_REFUSED_JOB_CREATED_A_RUN");
});

test("CONTEXT_TOO_LARGE fails a rewrite with no run when 201 other active Risks would be listed, its target among the first rows read (Pitfall 13, BE2-06)", async () => {
  const harness = await harnessPromise;
  const large = await draftedAssessment(harness, "REWRITE-TOO-LARGE");
  for (let index = large.riskIds.length; index < 202; index += 1) {
    await harness.createRiskRegisterFixture(large.assessmentId, { riskNumber: `RSK-RWLARGE-${String(index).padStart(4, "0")}`, riskStatement: `Bounded rewrite risk ${index}`, riskCause: `Cause ${index}` });
  }
  const targetId = await harness.withBackendFixture(async (backend) => {
    const [first] = await (backend.documents as unknown as (uid: string) => { findMany: (query: Json) => Promise<Json[]> })("api::csrm-risk.csrm-risk")
      .findMany({ filters: { assessment: { documentId: { $eq: large.assessmentId } } }, fields: ["documentId"], sort: ["id:asc"], limit: 1 });
    return String(first?.documentId);
  });
  await withProviderCalls(async (calls) => {
    const job = await rewriteAndWait(harness, harness.identities.analyst, targetId);
    assert.deepEqual([job.status, job.failureCode], ["failed", "CONTEXT_TOO_LARGE"], "A_REWRITE_CONTEXT_WAS_TRUNCATED");
    assert.equal(calls.count(), 0);
  });
  assert.deepEqual(await riskRuns(harness, large.assessmentId), [], "TOO_LARGE_REWRITE_CREATED_A_RUN");
});

test("CONTEXT_TOO_LARGE fails the job with no run when the assessment lists 201 risks, and AI_PROPOSAL_RUN_LIMIT refuses both starts at 100 completed runs (D-25, D-31, T-16-27)", async () => {
  const harness = await harnessPromise;
  const large = await draftedAssessment(harness, "RISK-TOO-LARGE");
  for (let index = large.riskIds.length; index < 201; index += 1) {
    await harness.createRiskRegisterFixture(large.assessmentId, { riskNumber: `RSK-LARGE-${String(index).padStart(4, "0")}`, riskStatement: `Bounded context risk ${index}`, riskCause: `Cause ${index}` });
  }
  await withProviderCalls(async (calls) => {
    const job = await suggestAndWait(harness, harness.identities.analyst, large.assessmentId);
    assert.deepEqual([job.status, job.failureCode], ["failed", "CONTEXT_TOO_LARGE"]);
    assert.equal(calls.count(), 0);
  });
  assert.deepEqual(await riskRuns(harness, large.assessmentId), [], "TOO_LARGE_CONTEXT_CREATED_A_RUN");

  const capped = await draftedAssessment(harness, "RISK-RUN-LIMIT");
  const built = await harness.buildAssessmentContextFixture({ operation: "risk-suggestions", requestId: capped.requestId, assessmentId: capped.assessmentId });
  for (let index = 0; index < 100; index += 1) {
    const runId = await harness.createAiRunFixture({ operation: "risk-suggestions", initiatedBy: harness.users.analyst, providerName: "deterministic-risk-proposals", providerVersion: "1", assessmentRequest: capped.requestId, assessment: capped.assessmentId, contextSummary: built.context.summary });
    await harness.completeAiRunFixture(runId, { schemaVersion: 1, operation: "risk-suggestions", outcome: "no-change", items: [], adjustments: [] });
  }
  const suggestions = await call(harness, harness.identities.analyst, "POST", suggestionsPath(capped.assessmentId));
  assert.deepEqual([suggestions.status, suggestions.reason], [409, "AI_PROPOSAL_RUN_LIMIT"]);
  const rewrite = await call(harness, harness.identities.analyst, "POST", rewritePath(capped.riskIds[0]));
  assert.deepEqual([rewrite.status, rewrite.reason], [409, "AI_PROPOSAL_RUN_LIMIT"]);
  assert.deepEqual(await activeJobs(harness, capped.assessmentId), []);
  const proposals = await readProposals(harness, harness.identities.analyst, capped.assessmentId);
  assert.deepEqual((proposals.actions as Json).suggest, { allowed: false, reason: "AI_PROPOSAL_RUN_LIMIT" });
  assert.deepEqual((proposals.actions as Json).decide, { allowed: true, reason: null });
});

test("an instruction over 500 characters, one quoting 60 characters of a submitted answer, and an empty or unknown focus are refused with 400 (D-27)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, questionnaireId, riskIds } = await draftedAssessment(harness, "RISK-INSTRUCTION");
  const tooLong = await call(harness, harness.identities.analyst, "POST", suggestionsPath(assessmentId), { instruction: "a".repeat(501) });
  assert.deepEqual([tooLong.status, tooLong.reason], [400, "INSTRUCTION_TOO_LONG"]);
  const answer = "The payroll processor emails the bank file to a shared mailbox before the finance lead approves the run.";
  const questionnaire = await harness.getQuestionnaire(questionnaireId);
  const optional = ((questionnaire?.questions as Json[]) ?? []).find((question) => question.questionText === "Other recovery notes?") as Json;
  await harness.updateFixtureDocument("api::csrm-question.csrm-question", String(optional.documentId), { answer: { schemaVersion: 1, value: answer, state: "submitted", updatedAt: "2026-08-30T00:00:00.000Z", submittedAt: "2026-08-30T00:00:00.000Z" } });
  const repeats = await call(harness, harness.identities.analyst, "POST", rewritePath(riskIds[0]), { instruction: `Focus on this: ${answer.slice(0, 64)}` });
  assert.deepEqual([repeats.status, repeats.reason], [400, "INSTRUCTION_REPEATS_REQUESTOR_TEXT"]);
  for (const focus of [[], ["statement", "statement"], ["owners"], "statement"]) {
    assert.equal((await call(harness, harness.identities.analyst, "POST", rewritePath(riskIds[0]), { focus })).status, 400, `FOCUS_NOT_REFUSED_${JSON.stringify(focus)}`);
  }
  assert.equal((await call(harness, harness.identities.analyst, "POST", rewritePath(riskIds[0]), { focus: ["statement"], extra: true })).status, 400);
  assert.deepEqual(await activeJobs(harness, assessmentId), []);
  assert.deepEqual(await riskRuns(harness, assessmentId), []);
});

test("the second analyst reads Bob's failed job and retries it as their own new run; a completed job is not retried (409); OWN_REQUEST refuses Bob's rewrite, job read and retry (D-26, Phase 13 D-18)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "RISK-RETRY");
  const failed = await withProviderCalls(async (calls) => {
    calls.failNext(1);
    return suggestAndWait(harness, harness.identities.analyst, assessmentId);
  });
  assert.deepEqual([failed.status, failed.failureCode], ["failed", "AI_PROPOSAL_FAILED"]);
  assert.equal(failed.canRetry, true);
  const [failedRun] = await riskRuns(harness, assessmentId);
  assert.equal(failedRun.status, "failed", "FAILED_ATTEMPT_RUN_NOT_CLOSED");
  const jobId = String(failed.jobId);

  const seen = await call(harness, harness.identities.secondAnalyst, "GET", jobPath(jobId));
  assert.equal(seen.status, 200);
  assert.equal(seen.data?.canRetry, true, "SECOND_ANALYST_CANNOT_RETRY");
  assert.equal(seen.data?.initiatedByViewer, false);
  assert.ok(((await readProposals(harness, harness.identities.secondAnalyst, assessmentId)).jobs as Json[]).some((job) => job.jobId === jobId && job.status === "failed"), "FAILED_JOB_NOT_IN_THE_READ");
  const retried = await call(harness, harness.identities.secondAnalyst, "POST", retryPath(jobId));
  assert.equal(retried.status, 202, `RETRY_${retried.status}_${retried.reason}`);
  assert.equal(retried.data?.attempt, 2);
  assert.equal((retried.data?.initiatedBy as Json | null)?.documentId, harness.users.secondAnalyst, "RETRY_NOT_THE_RETRIERS");
  const done = await settled(harness, jobId);
  assert.equal(done.status, "completed");
  const runs = await riskRuns(harness, assessmentId);
  assert.equal(runs.length, 2, "RETRY_DID_NOT_CREATE_A_NEW_RUN");
  assert.equal((runs[1].initiatedBy as Json).documentId, harness.users.secondAnalyst, "NEW_RUN_DOES_NOT_NAME_THE_RETRIER");
  assert.equal(runs[1].attempt, 2);
  const again = await call(harness, harness.identities.analyst, "POST", retryPath(jobId));
  assert.equal(again.status, 409, "COMPLETED_JOB_RETRIED");
  assert.equal((await call(harness, harness.identities.analyst, "POST", retryPath("no-such-job"))).status, 404);

  const own = await draftedAssessment(harness, "RISK-RETRY-OWN");
  const ownFailed = await withProviderCalls(async (calls) => {
    calls.failNext(1);
    return suggestAndWait(harness, harness.identities.secondAnalyst, own.assessmentId);
  });
  assert.equal(ownFailed.status, "failed");
  await harness.updateFixtureDocument("api::csrm-assessment-request.csrm-assessment-request", own.requestId, { requestor: harness.users.analyst });
  const ownRead = await call(harness, harness.identities.analyst, "GET", jobPath(String(ownFailed.jobId)));
  assert.deepEqual([ownRead.status, ownRead.reason], [403, "OWN_REQUEST"]);
  const ownRetry = await call(harness, harness.identities.analyst, "POST", retryPath(String(ownFailed.jobId)));
  assert.deepEqual([ownRetry.status, ownRetry.reason], [403, "OWN_REQUEST"]);
  const ownRewrite = await call(harness, harness.identities.analyst, "POST", rewritePath(own.riskIds[0]), { focus: ["statement"] });
  assert.deepEqual([ownRewrite.status, ownRewrite.reason], [403, "OWN_REQUEST"]);
  assert.equal((await settled(harness, String(ownFailed.jobId))).attempt, 1, "OWN_REQUEST_RETRY_STARTED_AN_ATTEMPT");
  assert.deepEqual(await activeJobs(harness, own.assessmentId), []);
});

test("a failed job that a fresh start on its target has replaced leaves the read, is not offered for retry and its retry is 409 (D-41, BE2-08)", async () => {
  const harness = await harnessPromise;
  const { assessmentId } = await draftedAssessment(harness, "RISK-RETRY-REPLACED");
  const failed = await withProviderCalls(async (calls) => {
    calls.failNext(1);
    return suggestAndWait(harness, harness.identities.analyst, assessmentId);
  });
  assert.deepEqual([failed.status, failed.canRetry], ["failed", true]);
  const jobId = String(failed.jobId);
  const fresh = await suggestAndWait(harness, harness.identities.analyst, assessmentId);
  assert.equal(fresh.status, "completed");
  assert.notEqual(String(fresh.jobId), jobId);
  const jobs = (await readProposals(harness, harness.identities.analyst, assessmentId)).jobs as Json[];
  assert.ok(!jobs.some((job) => job.jobId === jobId), "A_REPLACED_FAILURE_IS_STILL_LISTED");
  const seen = await call(harness, harness.identities.analyst, "GET", jobPath(jobId));
  assert.deepEqual([seen.status, seen.data?.status, seen.data?.canRetry], [200, "failed", false], "A_REPLACED_FAILURE_IS_OFFERED_FOR_RETRY");
  const runsBefore = (await riskRuns(harness, assessmentId)).length;
  const retried = await call(harness, harness.identities.analyst, "POST", retryPath(jobId));
  assert.equal(retried.status, 409, "A_REPLACED_FAILURE_WAS_RETRIED");
  assert.equal((await settled(harness, jobId)).attempt, 1);
  assert.equal((await riskRuns(harness, assessmentId)).length, runsBefore, "A_REFUSED_RETRY_CREATED_A_RUN");
});

test("the Requestor, the Secondary Requestor and the service agent get 403 on the rewrite and the retry, with nothing queued (D-43)", async () => {
  const harness = await harnessPromise;
  const { assessmentId, riskIds } = await draftedAssessment(harness, "RISK-REWRITE-REFUSED");
  const failed = await withProviderCalls(async (calls) => {
    calls.failNext(1);
    return suggestAndWait(harness, harness.identities.analyst, assessmentId);
  });
  for (const identity of [harness.identities.owner, harness.identities.otherRequestor, harness.identities.serviceAnalystAgent]) {
    assert.equal((await call(harness, identity, "POST", rewritePath(riskIds[0]), { focus: ["statement"] })).status, 403, `REWRITE_NOT_REFUSED_${identity}`);
    assert.equal((await call(harness, identity, "POST", retryPath(String(failed.jobId)))).status, 403, `RETRY_NOT_REFUSED_${identity}`);
    assert.equal((await call(harness, identity, "GET", jobPath(String(failed.jobId)))).status, 403, `JOB_READ_NOT_REFUSED_${identity}`);
  }
  assert.deepEqual(await activeJobs(harness, assessmentId), []);
  assert.equal((await settled(harness, String(failed.jobId))).attempt, 1);
  assert.equal((await riskRuns(harness, assessmentId)).length, 1);
});
