import assert from "node:assert/strict";
import test, { after } from "node:test";
import { UAT_A_LIKE_NOTE_SENTINELS, uatALikeNotes } from "./fixtures/uat-a-like-context";
import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";
import { AiRunRecordError } from "../src/api/csrm-ai-run/services/ai-run-record";
import type { ContextSummary } from "../src/csrm/ai/assessment-context";
import { parseWritableAssessmentFields, parseWritableRiskFields } from "../src/api/csrm-assessment/services/assessment-workflow";

const harnessPromise = startAuthorizationHttpHarness();
after(async () => (await harnessPromise).close());

test("mounted storage persists run lifecycle and legacy null provenance", async () => {
  const harness = await harnessPromise;
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: harness.requests.owner });
  const input = { operation: "questionnaire-generation" as const, initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-generation", providerVersion: "2", assessmentRequest: harness.requests.owner, contextSummary: context.summary };
  const runId = await harness.createAiRunFixture(input);
  const running = await harness.getAiRun(runId);
  assert.equal(running?.status, "running");
  assert.equal((running?.assessmentRequest as { documentId: string }).documentId, harness.requests.owner);
  assert.deepEqual(running?.contextSummary, context.summary);
  assert.ok(running?.startedAt);
  const completed = await harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] });
  assert.equal(completed.status, "completed");
  assert.ok(completed.completedAt);
  const failedId = await harness.createAiRunFixture(input);
  const failed = await harness.failAiRunFixture(failedId, "PROVIDER_FAILED", "Generation could not be completed.");
  assert.equal(failed.status, "failed");
  assert.equal(failed.proposal, null);
  await assert.rejects(harness.createAiRunFixture({ ...input, assessmentRequest: "" }), AiRunRecordError);
  await assert.rejects(harness.createAiRunFixture({ ...input, contextSummary: { ...context.summary, digest: "x".repeat(70_000) } }), AiRunRecordError);
  const requestId = await harness.createAssessmentRequestFixture({ requestNumber: "REQ-AIRUN-LEGACY", title: "Existing assessment", requestStatus: "risk-assessment-drafted", requestor: "owner" });
  const assessmentId = await harness.createAssessmentFixture({ assessmentNumber: "ASSESS-AIRUN-LEGACY", assessmentStatus: "draft", assessmentRequest: requestId });
  const riskId = await harness.createRiskRegisterFixture(assessmentId, { riskNumber: "RSK-AIRUN-LEGACY", riskStatement: "Existing risk" });
  assert.equal((await harness.getAssessment(assessmentId))?.aiProvenance, null);
  assert.equal((await harness.getRisk(riskId))?.aiProvenance, null);
  const detail = await harness.request({ path: `/api/v1/risk_assessments/${assessmentId}`, identity: harness.identities.analyst });
  assert.equal(detail.status, 200);
  // 12-09: the analyst detail serves a legacy row's provenance as null.
  assert.equal(((await detail.json() as { data: Record<string, unknown> }).data).aiProvenance, null);
  const list = await harness.request({ path: `/api/v1/risk_assessments/${assessmentId}/risks`, identity: harness.identities.analyst });
  assert.equal(list.status, 200);
  assert.ok(!(await list.text()).includes("aiProvenance"));
  const updated = await harness.request({ path: `/api/v1/risks/${riskId}`, identity: harness.identities.analyst, init: { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ riskStatement: "Edited existing risk" }) } });
  assert.equal(updated.status, 200);
  assert.ok(!(await updated.text()).includes("aiProvenance"));
  assert.throws(() => parseWritableRiskFields({ aiProvenance: {} }));
  assert.throws(() => parseWritableAssessmentFields({ aiProvenance: {} }));
});

test("decision history only grows", async () => {
  const harness = await harnessPromise;
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: harness.requests.owner });
  const input = { operation: "questionnaire-generation" as const, initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-generation", providerVersion: "2", assessmentRequest: harness.requests.owner, contextSummary: context.summary };
  const runId = await harness.createAiRunFixture(input);
  const event = (day: string) => ({ schemaVersion: 1 as const, at: `2026-10-${day}T00:00:00.000Z`, by: harness.users.analyst, target: "assessment", kind: "accepted" as const });
  await harness.appendAiRunDecisionsFixture(runId, [event("05")]);
  await harness.appendAiRunDecisionsFixture(runId, [event("06"), event("07")]);
  assert.deepEqual((await harness.getAiRun(runId))?.decisions, [event("05"), event("06"), event("07")]);
  await assert.rejects(harness.appendAiRunDecisionsFixture(runId, Array(5_000).fill(event("08"))), AiRunRecordError);
  assert.equal(((await harness.getAiRun(runId))?.decisions as unknown[]).length, 3);
  await harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] });
});

/*
 * D-20 and WR-01: a run still `running` is closed as `interrupted` only once it is older than the AI request bound
 * (the request timeout plus a five-minute margin for its persistence transaction), so a pass never interrupts a run
 * another live process may still be working on. Each pass closes a run once; a second pass changes nothing.
 */
test("an unfinished run is reconciled once, and only when it is past the AI request bound", async () => {
  const harness = await harnessPromise;
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: harness.requests.owner });
  const input = { operation: "questionnaire-generation" as const, initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-generation", providerVersion: "2", assessmentRequest: harness.requests.owner, contextSummary: context.summary };
  // The harness keeps CSRM_AI_REQUEST_TIMEOUT_MS at its 60,000 ms default; the margin is five minutes.
  const bound = 60_000 + 300_000;
  const now = new Date();
  const live = await harness.createAiRunFixture(input);
  const orphan = await harness.createAiRunFixture(input);
  await harness.updateAiRunFixture(orphan, { startedAt: new Date(now.getTime() - bound - 1).toISOString() });
  const startedAt = (runId: string) => harness.getAiRun(runId).then((run) => Date.parse(String(run?.startedAt)));
  const status = (runId: string) => harness.getAiRun(runId).then((run) => run?.status);

  assert.equal(await harness.reconcileInterruptedAiRunsFixture(() => now), 1, "RECONCILED_A_RUN_WITHIN_THE_BOUND");
  assert.equal(await status(orphan), "interrupted", "RUN_PAST_THE_BOUND_LEFT_RUNNING");
  assert.equal(new Date(String((await harness.getAiRun(orphan))?.completedAt)).toISOString(), now.toISOString(), "INTERRUPTED_RUN_NOT_DATED");
  assert.equal(await status(live), "running", "RUN_WITHIN_THE_BOUND_INTERRUPTED");
  assert.equal(await harness.reconcileInterruptedAiRunsFixture(() => now), 0, "SECOND_PASS_CHANGED_RUNS");

  // At the bound itself the run may still be live; a millisecond past it, it is closed, once.
  const liveStartedAt = await startedAt(live);
  assert.equal(await harness.reconcileInterruptedAiRunsFixture(() => new Date(liveStartedAt + bound)), 0, "RECONCILED_A_RUN_AT_THE_BOUND");
  assert.equal(await status(live), "running");
  assert.equal(await harness.reconcileInterruptedAiRunsFixture(() => new Date(liveStartedAt + bound + 1)), 1, "RUN_PAST_THE_BOUND_NOT_RECONCILED");
  assert.equal(await status(live), "interrupted");
  assert.equal(await harness.reconcileInterruptedAiRunsFixture(() => new Date(liveStartedAt + bound + 1)), 0, "SECOND_PASS_CHANGED_RUNS");
});

/*
 * WR-105 (G-3): a draft run's summary names each answer source by its question's position, never its text. The
 * analyst's run read and the citations on the assessment read name it by the question's current text, from the
 * questionnaire the run used; a citation of a source the run never offered still reads "Source no longer available".
 */
test("mounted run read and citations name an answer source by its question's current text, which the run never keeps", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeRequest("RUN-LABELS");
  const { context } = await harness.buildAssessmentContextFixture({ operation: "assessment-draft", requestId: fixture.requestId, questionnaireId: fixture.questionnaireId });
  const runId = await harness.createAiRunFixture({ operation: "assessment-draft", initiatedBy: harness.users.analyst, providerName: "deterministic-assessment-draft", providerVersion: "2", assessmentRequest: fixture.requestId, questionnaire: fixture.questionnaireId, contextSummary: context.summary });
  await harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { risks: [] }, adjustments: [] });
  const questionTexts = ["Are payment files signed?", "Are duties segregated?", "Has the pay-run fallback been tested?", "Other recovery notes?"];
  const stored = (await harness.getAiRun(runId))?.contextSummary as { questions: { sources: Array<{ key: string; label: string }> } };
  assert.ok(stored.questions.sources.every(({ label }) => /^Question [1-4]$/.test(label)), "RUN_STORED_A_QUESTION_TEXT");
  for (const text of questionTexts) assert.ok(!JSON.stringify(stored).includes(text), `RUN_STORED_THE_QUESTION_${text}`);

  const byKey = { "answer.payment-files": questionTexts[0], "answer.duties": questionTexts[1], "answer.recovery-tested": questionTexts[2], "answer.optional": questionTexts[3] };
  const read = await harness.request({ path: `/api/v1/ai_runs/${encodeURIComponent(runId)}`, identity: harness.identities.analyst });
  assert.equal(read.status, 200, "RUN_LABELS_READ_STATUS");
  const served = ((await read.json()) as { data: { contextSummary: { questions: { sources: Array<{ key: string; label: string; section: string }> } } } }).data.contextSummary;
  assert.deepEqual(Object.fromEntries(served.questions.sources.map(({ key, label }) => [key, label])), byKey, "RUN_READ_NOT_NAMED_BY_THE_QUESTIONS");
  assert.ok(served.questions.sources.every(({ section }) => section === "Payment processing"), "RUN_READ_SECTIONS");

  const requestId = await harness.createAssessmentRequestFixture({ requestNumber: "REQ-AIRUN-LABELS", title: "Run labels", requestStatus: "risk-assessment-drafted", requestor: "owner" });
  const assessmentId = await harness.createFixtureDocument("api::csrm-assessment.csrm-assessment", {
    assessmentNumber: "ASSESS-AIRUN-LABELS", assessmentStatus: "draft", assessmentRequest: requestId, generatedDate: "2026-10-08T00:00:00.000Z", providerName: "deterministic-assessment-draft", providerVersion: "2",
    aiProvenance: { schemaVersion: 1, runId, proposalKey: "assessment", fields: { summary: { state: "proposed", sources: ["answer.payment-files", "answer.recovery-tested", "answer.never-offered"] } } },
  });
  const detail = await harness.request({ path: `/api/v1/risk_assessments/${encodeURIComponent(assessmentId)}`, identity: harness.identities.analyst });
  assert.equal(detail.status, 200, "RUN_LABELS_DETAIL_STATUS");
  const review = ((await detail.json()) as { data: { aiProvenance: { fields: Array<{ field: string; sources: Array<{ kind: string; label: string }> | null }> } } }).data.aiProvenance;
  assert.deepEqual(review.fields.find(({ field }) => field === "summary")?.sources, [
    { key: "answer.payment-files", kind: "answer", label: questionTexts[0], section: "Payment processing", classification: null },
    { key: "answer.recovery-tested", kind: "answer", label: questionTexts[2], section: "Payment processing", classification: null },
    { key: "answer.never-offered", kind: "answer", label: "Source no longer available", section: null, classification: null },
  ], "CITATIONS_NOT_NAMED_BY_THE_QUESTIONS");
});

/*
 * D-25 and D-32: a human Security Analyst reads what an AI run used: its facts, its context summary and its
 * outcome, never the proposal or any Requestor free text. Everyone else is refused; an unknown run is 404.
 */
test("mounted analyst run read serves the run facts and context summary and nothing of the proposal", async () => {
  const harness = await harnessPromise;
  const request = await harness.getRequest(harness.requests.owner);
  assert.ok(request);
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: harness.requests.owner });
  const runId = await harness.createAiRunFixture({ operation: "questionnaire-generation", initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-generation", providerVersion: "2", assessmentRequest: harness.requests.owner, contextSummary: context.summary });
  await harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { questions: [{ questionText: "PROPOSAL-SENTINEL" }] }, adjustments: [] });

  const read = await harness.request({ path: `/api/v1/ai_runs/${encodeURIComponent(runId)}`, identity: harness.identities.analyst });
  assert.equal(read.status, 200, "AI_RUN_READ_STATUS");
  const text = await read.text();
  const data = (JSON.parse(text) as { data: Record<string, unknown> }).data;
  assert.deepEqual(Object.keys(data).sort(), ["completedAt", "contextSummary", "documentId", "failureCode", "failureMessage", "initiatedBy", "instruction", "operation", "providerName", "providerVersion", "startedAt", "status", "targets"], "AI_RUN_READ_NOT_CLOSED");
  assert.equal(data.operation, "questionnaire-generation");
  assert.equal(data.status, "completed");
  assert.ok(typeof data.startedAt === "string" && typeof data.completedAt === "string", "AI_RUN_READ_TIMES");
  assert.equal((data.initiatedBy as Record<string, unknown>).documentId, harness.users.analyst, "AI_RUN_READ_INITIATOR");
  assert.ok((data.initiatedBy as Record<string, unknown>).displayName, "AI_RUN_READ_INITIATOR_NAME");
  // Phase 15: the builder writes v4, which the read serves as stored.
  assert.deepEqual(data.contextSummary, context.summary, "AI_RUN_READ_CONTEXT_SUMMARY");
  assert.deepEqual(data.targets, { assessmentRequest: harness.requests.owner, questionnaire: null, assessment: null, risk: null }, "AI_RUN_READ_TARGETS");
  assert.ok(!text.includes("proposal") && !text.includes("PROPOSAL-SENTINEL"), "AI_RUN_READ_SERVED_THE_PROPOSAL");
  for (const field of ["title", "description", "businessPurpose", "thirdPartyDetails", "regulatoryRequirements"]) {
    const value = request[field];
    if (typeof value === "string" && value.trim().length > 8) assert.ok(!text.includes(value), `AI_RUN_READ_SERVED_REQUESTOR_TEXT_${field}`);
  }

  for (const identity of [harness.identities.owner, harness.identities.otherRequestor, harness.identities.serviceAnalystAgent, undefined]) {
    const refused = await harness.request({ path: `/api/v1/ai_runs/${encodeURIComponent(runId)}`, identity });
    assert.equal(refused.status, 403, `AI_RUN_READ_NOT_REFUSED_${identity ?? "no-identity"}`);
    assert.ok(!(await refused.text()).includes(runId), `AI_RUN_READ_REFUSAL_DISCLOSED_${identity ?? "no-identity"}`);
  }
  const unknown = await harness.request({ path: "/api/v1/ai_runs/unknown-run", identity: harness.identities.analyst });
  assert.equal(unknown.status, 404, "AI_RUN_READ_UNKNOWN_STATUS");
  const otherUnknown = await harness.request({ path: "/api/v1/ai_runs/another-unknown-run", identity: harness.identities.analyst });
  assert.deepEqual(await unknown.json(), await otherUnknown.json(), "AI_RUN_READ_UNKNOWN_ENUMERATES");
  const hostile = await harness.request({ path: `/api/v1/ai_runs/${encodeURIComponent(runId)}?populate=proposal`, identity: harness.identities.analyst });
  assert.equal(hostile.status, 400, "AI_RUN_READ_QUERY_ACCEPTED");
});

/*
 * Phase 13 D-28 (G-3): Bob's read of a run names the marked notes it used, by documentId, part, sequence, posting time
 * and length, never their text. A run recorded before notes reached the context (a v1 summary) reads as having used none.
 */
test("mounted run read carries the notes a run used without their text, and a v1 summary reads as none", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeRequest("RUN-NOTES");
  const [jane, bob] = uatALikeNotes();
  const [janeId] = await harness.seedRequestNotes(fixture.requestId, [jane, bob]);
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: fixture.requestId });
  const input = { operation: "questionnaire-generation" as const, initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-generation", providerVersion: "2", assessmentRequest: fixture.requestId, contextSummary: context.summary };
  const runId = await harness.createAiRunFixture(input);
  await harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] });
  const read = await harness.request({ path: `/api/v1/ai_runs/${encodeURIComponent(runId)}`, identity: harness.identities.analyst });
  assert.equal(read.status, 200, "RUN_NOTES_READ_STATUS");
  const text = await read.text();
  const served = (JSON.parse(text) as { data: { contextSummary: { schemaVersion: number; notes: unknown } } }).data.contextSummary;
  // Phase 16: the builder now writes v5, the notes section unchanged.
  assert.equal(served.schemaVersion, 5, "RUN_READ_NOT_V5");
  assert.deepEqual(served.notes, { included: [{ documentId: janeId, part: "requestor", sequence: 1, postedAt: jane.postedAt, characters: jane.body.length }], marked: 1, bound: 50 }, "RUN_READ_NOTES");
  for (const sentinel of Object.values(UAT_A_LIKE_NOTE_SENTINELS)) assert.ok(!text.includes(sentinel), `RUN_READ_SERVED_NOTE_TEXT_${sentinel}`);

  // A summary stored before Phase 13: v1, with no notes section (nor Phase 14's attachments section, nor Phase 15's two).
  const { notes: _notes, attachments: _attachments, questionnaire: _questionnaire, instruction: _instruction, riskProposals: _riskProposalsV1, ...v1Fields } = context.summary as unknown as Record<string, unknown>;
  const legacyId = await harness.createAiRunFixture(input);
  await harness.updateAiRunFixture(legacyId, { contextSummary: { ...v1Fields, schemaVersion: 1 } });
  const legacy = await harness.request({ path: `/api/v1/ai_runs/${encodeURIComponent(legacyId)}`, identity: harness.identities.analyst });
  assert.equal(legacy.status, 200, "RUN_V1_READ_STATUS");
  const legacySummary = ((await legacy.json()) as { data: { contextSummary: { schemaVersion: number; notes: unknown } | null } }).data.contextSummary;
  assert.ok(legacySummary, "RUN_V1_SUMMARY_NOT_READ");
  assert.equal(legacySummary.schemaVersion, 1, "RUN_V1_VERSION");
  assert.deepEqual(legacySummary.notes, { included: [], marked: 0, bound: 50 }, "RUN_V1_NOT_READ_AS_NO_NOTES");
  await harness.completeAiRunFixture(legacyId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] });
});

/*
 * Phase 15 D-19 and D-20 (the approved amendment to the Phase 12 run record): a questionnaire proposal run is stored with
 * its instruction and a v4 summary, completed with the questionnaire proposal envelope v1 and decided by decision events
 * v2. Each run's proposal and decisions are parsed by its operation, never by schemaVersion (Phase 12's envelope in the
 * same column is schemaVersion 2), so either family on the other's run is refused and nothing is written.
 */
const FINGERPRINT = `sha256:${"c".repeat(64)}`;
function questionnaireProposal(operation: "questionnaire-proposals" | "question-rewrite" = "questionnaire-proposals") {
  return {
    schemaVersion: 1 as const, operation, outcome: "items" as const,
    items: [{
      key: "i-1", kind: "remove" as const,
      target: { questionDocumentId: "question-optional", questionKey: "optional", textSnapshot: "Other recovery notes?" },
      rationale: "The instruction asks for fewer optional questions.",
      sources: [{ kind: "instruction" as const, ref: "instruction" }],
      base: { kind: "question" as const, fingerprint: FINGERPRINT, unanswered: true as const },
    }],
    adjustments: [],
  };
}
const v2Accepted = (by: string) => ({ schemaVersion: 2 as const, at: "2026-10-11T00:00:00.000Z", by, item: "i-1", action: "accepted" as const, applied: { questionDocumentId: "question-optional", questionKey: "optional", fingerprint: FINGERPRINT } });

test("mounted questionnaire proposal run is stored, completed with its envelope, decided by v2 events and read back", async () => {
  const harness = await harnessPromise;
  const fixture = await harness.seedUatALikeRequest("RUN-PROPOSALS");
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: fixture.requestId });
  const questionnaireSection = { scope: "questionnaire", questionsOffered: 4, answered: 3, answerContent: "included", openItemsListed: 0, rejectedItemsListed: 0, rejectedItemsTotal: 0, removedListed: 0 };
  // A v4 summary (written before Phase 16): the builder's v5 without its risk proposal section.
  const { riskProposals: _riskProposals, ...v5Fields } = context.summary as unknown as Record<string, unknown>;
  const summary = { ...v5Fields, schemaVersion: 4, operation: "questionnaire-proposals", attachments: { included: [], bound: 30_000 }, questionnaire: questionnaireSection, instruction: { source: "analyst" } } as unknown as ContextSummary;
  const instruction = "Add questions about the offshore support team";
  const input = { operation: "questionnaire-proposals" as const, initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-proposals", providerVersion: "1", assessmentRequest: fixture.requestId, questionnaire: fixture.questionnaireId, instruction, contextSummary: summary };

  // X-1: both new operations' attachments bound is 30,000; the section is closed and agrees with the operation.
  const refusedSummaries: Array<Record<string, unknown>> = [
    { attachments: { included: [], bound: 60_000 } },
    { questionnaire: null },
    { questionnaire: { ...questionnaireSection, scope: "question" } },
    { questionnaire: { ...questionnaireSection, instructionText: instruction } },
    { questionnaire: { ...questionnaireSection, answerContent: "drafts" } },
    { instruction: { source: "plain-language-preset" } },
    { instruction: null },
    { schemaVersion: 3 },
  ];
  for (const change of refusedSummaries) {
    await assert.rejects(harness.createAiRunFixture({ ...input, contextSummary: { ...(summary as unknown as Record<string, unknown>), ...change } as unknown as ContextSummary }), AiRunRecordError, `SUMMARY_ACCEPTED_${JSON.stringify(change)}`);
  }
  const runId = await harness.createAiRunFixture(input);
  assert.deepEqual((await harness.getAiRun(runId))?.contextSummary, summary, "PROPOSALS_SUMMARY_NOT_STORED");

  // Dispatch by operation: Phase 12's schemaVersion 2 envelope, or a rewrite envelope, is refused on this run.
  await assert.rejects(harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] }), AiRunRecordError, "PHASE_12_ENVELOPE_ON_A_PROPOSALS_RUN");
  await assert.rejects(harness.completeAiRunFixture(runId, questionnaireProposal("question-rewrite")), AiRunRecordError, "REWRITE_ENVELOPE_ON_A_PROPOSALS_RUN");
  assert.equal((await harness.getAiRun(runId))?.status, "running", "REFUSED_COMPLETION_WROTE");
  const completed = await harness.completeAiRunFixture(runId, questionnaireProposal());
  assert.equal(completed.status, "completed");
  assert.deepEqual((await harness.getAiRun(runId))?.proposal, questionnaireProposal(), "QUESTIONNAIRE_ENVELOPE_NOT_STORED");

  await harness.appendAiRunDecisionsFixture(runId, [v2Accepted(harness.users.analyst)]);
  const v1Event = { schemaVersion: 1 as const, at: "2026-10-11T01:00:00.000Z", by: harness.users.analyst, target: "assessment", kind: "accepted" as const };
  await assert.rejects(harness.appendAiRunDecisionsFixture(runId, [v1Event]), AiRunRecordError, "V1_EVENT_ON_A_PROPOSALS_RUN");
  assert.deepEqual((await harness.getAiRun(runId))?.decisions, [v2Accepted(harness.users.analyst)], "PROPOSALS_DECISIONS_CHANGED");

  // A v2 event on a Phase 12 run is refused, and its log stays empty.
  const generationInput = { operation: "questionnaire-generation" as const, initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-generation", providerVersion: "2", assessmentRequest: fixture.requestId, contextSummary: context.summary };
  const generationId = await harness.createAiRunFixture(generationInput);
  await assert.rejects(harness.completeAiRunFixture(generationId, questionnaireProposal()), AiRunRecordError, "QUESTIONNAIRE_ENVELOPE_ON_A_GENERATION_RUN");
  await harness.completeAiRunFixture(generationId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] });
  await assert.rejects(harness.appendAiRunDecisionsFixture(generationId, [v2Accepted(harness.users.analyst)]), AiRunRecordError, "V2_EVENT_ON_A_GENERATION_RUN");
  assert.deepEqual((await harness.getAiRun(generationId))?.decisions, [], "GENERATION_DECISIONS_CHANGED");

  // The human analyst's run read serves both operation fields, the instruction and the two Phase 15 sections.
  const read = await harness.request({ path: `/api/v1/ai_runs/${encodeURIComponent(runId)}`, identity: harness.identities.analyst });
  assert.equal(read.status, 200, "PROPOSALS_RUN_READ_STATUS");
  const text = await read.text();
  const data = (JSON.parse(text) as { data: { operation: string; instruction: string | null; contextSummary: { schemaVersion: number; operation: string; questionnaire: unknown; instruction: unknown } } }).data;
  assert.equal(data.operation, "questionnaire-proposals");
  assert.equal(data.instruction, instruction);
  assert.equal(data.contextSummary.schemaVersion, 4);
  assert.equal(data.contextSummary.operation, "questionnaire-proposals");
  assert.deepEqual(data.contextSummary.questionnaire, questionnaireSection, "PROPOSALS_RUN_READ_QUESTIONNAIRE");
  assert.deepEqual(data.contextSummary.instruction, { source: "analyst" }, "PROPOSALS_RUN_READ_INSTRUCTION");
  assert.ok(!text.includes("proposal\"") && !text.includes("textSnapshot") && !text.includes("decisions"), "PROPOSALS_RUN_READ_SERVED_THE_PROPOSAL");
});

test("mounted run read serves a v1 or v3 summary with both Phase 15 sections null", async () => {
  const harness = await harnessPromise;
  const { context } = await harness.buildAssessmentContextFixture({ operation: "questionnaire-generation", requestId: harness.requests.owner });
  const { questionnaire: _questionnaire, instruction: _instruction, riskProposals: _riskProposalsV3, ...v3Fields } = context.summary as unknown as Record<string, unknown>;
  const { notes: _notes, attachments: _attachments, ...v1Fields } = v3Fields;
  const input = { operation: "questionnaire-generation" as const, initiatedBy: harness.users.analyst, providerName: "deterministic-questionnaire-generation", providerVersion: "2", assessmentRequest: harness.requests.owner, contextSummary: context.summary };
  for (const [version, stored] of [[3, { ...v3Fields, schemaVersion: 3 }], [1, { ...v1Fields, schemaVersion: 1 }]] as const) {
    const runId = await harness.createAiRunFixture(input);
    await harness.updateAiRunFixture(runId, { contextSummary: stored });
    const read = await harness.request({ path: `/api/v1/ai_runs/${encodeURIComponent(runId)}`, identity: harness.identities.analyst });
    assert.equal(read.status, 200, `RUN_V${version}_READ_STATUS`);
    const served = ((await read.json()) as { data: { contextSummary: Record<string, unknown> | null } }).data.contextSummary;
    assert.ok(served, `RUN_V${version}_SUMMARY_NOT_READ`);
    assert.equal(served.schemaVersion, version);
    assert.equal(served.questionnaire, null, `RUN_V${version}_QUESTIONNAIRE_NOT_NULL`);
    assert.equal(served.instruction, null, `RUN_V${version}_INSTRUCTION_NOT_NULL`);
    await harness.completeAiRunFixture(runId, { schemaVersion: 2, proposal: { questions: [] }, adjustments: [] });
  }
});
