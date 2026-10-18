import assert from "node:assert/strict";
import test from "node:test";

import { createProposalJobRegistry, ProposalJobFailure, ProposalJobRegistryError, type AssessmentProposalJobTarget, type ProposalJob } from "../src/csrm/ai/proposal-job-registry";

/*
 * Phase 15 D-16 (15-RESEARCH §K): the generic in-process proposal job registry. Single flight per key (a questionnaire
 * for questionnaire-wide runs, a question for rewrites), a retry as a new attempt initiated by the retrier, safe failure
 * codes that keep a too-large context's files, and bounded terminal retention. Phase 16 can instantiate it for risks.
 */

type Input = { note: string };

function gate() {
  let open: () => void = () => undefined;
  const opened = new Promise<void>((resolve) => { open = resolve; });
  return { opened, open };
}

function start(overrides: Partial<{ key: string; questionnaireId: string; analyst: string }> = {}) {
  return {
    key: overrides.key ?? "questionnaire:q-1",
    questionnaireId: overrides.questionnaireId ?? "q-1",
    operation: "questionnaire-proposals",
    questionId: null,
    input: { note: "first" },
    initiatingAnalystDocumentId: overrides.analyst ?? "bob",
  };
}

test("BE05: a deferred start and retry reserve their key but do not call the provider until admission commits", async () => {
  let calls = 0;
  const registry = createProposalJobRegistry<Input>({ execute: async () => { calls += 1; if (calls === 1) throw new ProposalJobFailure("PROVIDER_TIMEOUT", "The provider timed out."); return { runId: "retry-run" }; } });
  const queued = registry.enqueue(start(), true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 0, "PROVIDER_CALLED_BEFORE_START_COMMIT");
  assert.equal(registry.activeFor("q-1").length, 1);
  registry.launchReserved(queued.jobId);
  await registry.settled(queued.jobId);
  assert.equal(registry.get(queued.jobId)?.status, "failed");
  registry.retry(queued.jobId, "sam", true);
  await new Promise<void>((resolve) => setImmediate(resolve));
  assert.equal(calls, 1, "PROVIDER_CALLED_BEFORE_RETRY_COMMIT");
  assert.equal(registry.activeFor("q-1").length, 1);
  registry.launchReserved(queued.jobId);
  await registry.settled(queued.jobId);
  assert.equal(calls, 2);
  assert.equal(registry.get(queued.jobId)?.status, "completed");
});

test("a second start on the same key while the first is queued returns the same job; another key gets its own (D-16 single flight)", async () => {
  const held = gate();
  const registry = createProposalJobRegistry<Input>({ execute: async () => { await held.opened; return { runId: "run-1" }; } });
  const first = registry.enqueue(start());
  assert.equal(first.status, "queued");
  assert.equal(first.attempt, 1);
  const again = registry.enqueue({ ...start(), input: { note: "second" }, initiatingAnalystDocumentId: "alice" });
  assert.equal(again.jobId, first.jobId, "SINGLE_FLIGHT_BROKEN");
  assert.equal(again.initiatingAnalystDocumentId, "bob", "SECOND_START_TOOK_OVER_THE_JOB");
  const rewrite = registry.enqueue({ ...start({ key: "question:question-1" }), operation: "question-rewrite", questionId: "question-1" });
  assert.notEqual(rewrite.jobId, first.jobId, "ANOTHER_KEY_SHARED_THE_JOB");
  assert.deepEqual(registry.activeFor("q-1").map((job) => job.jobId).sort(), [first.jobId, rewrite.jobId].sort());
  held.open();
  await registry.settled(first.jobId);
  await registry.settled(rewrite.jobId);
  const completed = registry.get(first.jobId) as ProposalJob<Input>;
  assert.equal(completed.status, "completed");
  assert.equal(completed.runId, "run-1");
  assert.ok(completed.startedAt && completed.completedAt, "JOB_NOT_DATED");
  assert.deepEqual(registry.activeFor("q-1"), [], "TERMINAL_JOB_STILL_ACTIVE");
});

test("a retry is refused for a completed job and for a failed job whose key is active again; it sets the retrier as initiator and increments the attempt", async () => {
  let calls = 0;
  const held = gate();
  const registry = createProposalJobRegistry<Input>({
    execute: async (job, report) => {
      calls += 1;
      if (calls === 1) { report.recordRun("run-failed"); throw new ProposalJobFailure("PROVIDER_UNAVAILABLE", "The AI provider is unavailable."); }
      if (calls === 2) return { runId: "run-done" };
      await held.opened;
      return { runId: `run-${job.attempt}` };
    },
  });
  const failed = registry.enqueue(start());
  await registry.settled(failed.jobId);
  const failedRecord = registry.get(failed.jobId) as ProposalJob<Input>;
  assert.deepEqual(failedRecord.failure, { code: "PROVIDER_UNAVAILABLE", message: "The AI provider is unavailable." });
  assert.equal(failedRecord.runId, "run-failed", "FAILED_ATTEMPT_LOST_ITS_RUN");
  assert.equal(registry.mayRetry(failedRecord), true);

  // A new job on the same key is active: the failed one cannot be retried until it ends.
  const other = registry.enqueue({ ...start(), initiatingAnalystDocumentId: "carol" });
  assert.notEqual(other.jobId, failed.jobId);
  assert.equal(registry.mayRetry(registry.get(failed.jobId) as ProposalJob<Input>), false, "RETRY_OFFERED_WHILE_KEY_ACTIVE");
  assert.throws(() => registry.retry(failed.jobId, "alice"), (error: unknown) => error instanceof ProposalJobRegistryError && error.status === 409);
  await registry.settled(other.jobId);
  assert.throws(() => registry.retry(other.jobId, "alice"), (error: unknown) => error instanceof ProposalJobRegistryError && error.status === 409, "COMPLETED_JOB_RETRIED");
  assert.throws(() => registry.retry("missing", "alice"), (error: unknown) => error instanceof ProposalJobRegistryError && error.status === 404);

  const retried = registry.retry(failed.jobId, "alice");
  assert.equal(retried.jobId, failed.jobId);
  assert.equal(retried.attempt, 2);
  assert.equal(retried.initiatingAnalystDocumentId, "alice", "RETRY_NOT_ATTRIBUTED_TO_THE_RETRIER");
  assert.equal(retried.status, "queued");
  assert.equal(retried.failure, undefined);
  assert.equal(retried.runId, undefined, "RETRY_KEPT_THE_FAILED_ATTEMPT_RUN");
  held.open();
  await registry.settled(failed.jobId);
  assert.equal((registry.get(failed.jobId) as ProposalJob<Input>).runId, "run-2");
});

test("only a safe failure code is kept; a too-large context keeps its files' ids, and anything else is the generic failure", async () => {
  const failures: unknown[] = [
    new ProposalJobFailure("CONTEXT_TOO_LARGE", "The AI context is too large.", ["file-1", "file-2"]),
    new ProposalJobFailure("not safe", "Message."),
    new Error("raw provider text <secret>"),
  ];
  const registry = createProposalJobRegistry<Input>({ execute: async () => { throw failures.shift(); } });
  const records = [];
  for (const key of ["a", "b", "c"]) {
    const job = registry.enqueue(start({ key: `questionnaire:${key}`, questionnaireId: key }));
    await registry.settled(job.jobId);
    records.push((registry.get(job.jobId) as ProposalJob<Input>).failure);
  }
  assert.deepEqual(records[0], { code: "CONTEXT_TOO_LARGE", message: "The AI context is too large.", attachmentDocumentIds: ["file-1", "file-2"] });
  assert.deepEqual(records[1], { code: "AI_PROPOSAL_FAILED", message: "The AI proposal failed safely." });
  assert.deepEqual(records[2], { code: "AI_PROPOSAL_FAILED", message: "The AI proposal failed safely." });
});

test("terminal jobs beyond 500 are evicted oldest first, and none is kept past an hour", async () => {
  let clock = Date.parse("2026-10-11T00:00:00.000Z");
  const registry = createProposalJobRegistry<Input>({ execute: async () => ({ runId: "run" }), now: () => new Date(clock) });
  const ids: string[] = [];
  for (let index = 0; index < 501; index += 1) {
    const job = registry.enqueue(start({ key: `questionnaire:${index}`, questionnaireId: `q-${index}` }));
    await registry.settled(job.jobId);
    ids.push(job.jobId);
  }
  assert.equal(registry.get(ids[0]), null, "OLDEST_TERMINAL_JOB_KEPT");
  assert.ok(registry.get(ids[1]), "SECOND_OLDEST_EVICTED");
  assert.ok(registry.get(ids[500]), "NEWEST_EVICTED");
  clock += 3_600_001;
  registry.cleanup();
  assert.equal(registry.get(ids[500]), null, "TERMINAL_JOB_KEPT_PAST_AN_HOUR");
});

/*
 * Phase 16 D-26 (16-PLAN-CHECK iteration 2, the pilot's registry ruling): one registry generalised with a discriminated
 * target. A risk proposal job carries `target: { kind: "assessment", assessmentId, riskId }` (riskId null for "Suggest
 * more risks"); Phase 15's questionnaire starts keep their top-level questionnaireId and questionId.
 */
type AssessmentTarget = { kind: "assessment"; assessmentId: string; riskId: string | null };

function assessmentStart(target: AssessmentTarget, key = `suggestions:${target.assessmentId}`) {
  return { key, operation: "risk-suggestions", target, input: { note: "risk" }, initiatingAnalystDocumentId: "bob" };
}

test("an assessment target round-trips, is single flight only while active, and is listed by its assessment only (Phase 16 D-26, Pitfall 8)", async () => {
  let held = gate();
  let runs = 0;
  const registry = createProposalJobRegistry<Input, AssessmentTarget>({ execute: async () => { await held.opened; runs += 1; return { runId: `run-${runs}` }; } });
  const first = registry.enqueue(assessmentStart({ kind: "assessment", assessmentId: "a1", riskId: null }));
  assert.deepEqual(first.target, { kind: "assessment", assessmentId: "a1", riskId: null }, "TARGET_DID_NOT_ROUND_TRIP");
  assert.equal("questionnaireId" in first, false, "ASSESSMENT_JOB_EXPOSES_A_QUESTIONNAIRE");
  const again = registry.enqueue(assessmentStart({ kind: "assessment", assessmentId: "a1", riskId: null }));
  assert.equal(again.jobId, first.jobId, "SINGLE_FLIGHT_BROKEN_FOR_AN_ASSESSMENT");
  const rewrite = registry.enqueue({ ...assessmentStart({ kind: "assessment", assessmentId: "a1", riskId: "r1" }, "rewrite:r1"), operation: "risk-rewrite" });
  assert.notEqual(rewrite.jobId, first.jobId);
  assert.deepEqual(registry.activeFor("a1").map((job) => job.jobId).sort(), [first.jobId, rewrite.jobId].sort());
  assert.deepEqual(registry.activeFor("q-1"), [], "A_QUESTIONNAIRE_SCOPE_LISTED_AN_ASSESSMENT_JOB");
  held.open();
  await registry.settled(first.jobId);
  await registry.settled(rewrite.jobId);
  assert.equal(registry.get(first.jobId)?.status, "completed");
  held = gate();
  const next = registry.enqueue(assessmentStart({ kind: "assessment", assessmentId: "a1", riskId: null }));
  assert.notEqual(next.jobId, first.jobId, "A_COMPLETED_JOB_BLOCKED_A_NEW_RUN");
  held.open();
  await registry.settled(next.jobId);
  assert.equal(registry.get(next.jobId)?.runId, "run-3");
});

test("an assessment target with a blank assessmentId, a blank non-null riskId or an unknown kind is refused with 400", () => {
  const registry = createProposalJobRegistry<Input, AssessmentTarget>({ execute: async () => ({ runId: "run" }) });
  const refused = (start: unknown) => assert.throws(() => registry.enqueue(start as never), (error: unknown) => error instanceof ProposalJobRegistryError && error.status === 400);
  refused(assessmentStart({ kind: "assessment", assessmentId: "  ", riskId: null }));
  refused(assessmentStart({ kind: "assessment", assessmentId: "a".repeat(256), riskId: null }));
  refused(assessmentStart({ kind: "assessment", assessmentId: "a1", riskId: " " }));
  refused({ ...assessmentStart({ kind: "assessment", assessmentId: "a1", riskId: null }), target: { kind: "request", requestId: "r" } });
});

test("a Phase 15 start without a target still exposes questionnaireId and questionId, with its questionnaire target", () => {
  const registry = createProposalJobRegistry<Input>({ execute: async () => ({ runId: "run" }) });
  const job = registry.enqueue({ ...start({ key: "question:question-1" }), operation: "question-rewrite", questionId: "question-1" }, true);
  assert.equal(job.questionnaireId, "q-1");
  assert.equal(job.questionId, "question-1");
  assert.deepEqual(job.target, { kind: "questionnaire", questionnaireId: "q-1", questionId: "question-1" });
  assert.throws(() => registry.enqueue({ ...start({ key: "questionnaire:blank" }), questionnaireId: " " }), (error: unknown) => error instanceof ProposalJobRegistryError && error.status === 400);
  registry.discardReserved(job.jobId);
});

test("a failed job a later job on its key has replaced is no longer listed as failed and is not the key's newest (Phase 16 D-41, BE2-08)", async () => {
  let calls = 0;
  const registry = createProposalJobRegistry<Input, AssessmentProposalJobTarget>({ execute: async () => { calls += 1; if (calls === 1) throw new ProposalJobFailure("PROVIDER_TIMEOUT", "The provider timed out."); return { runId: `run-${calls}` }; } });
  const assessmentStart = { key: "suggestions:a-1", operation: "risk-suggestions", target: { kind: "assessment" as const, assessmentId: "a-1", riskId: null }, input: { note: "first" }, initiatingAnalystDocumentId: "bob" };
  const failed = registry.enqueue(assessmentStart);
  await registry.settled(failed.jobId);
  assert.deepEqual(registry.failedFor("a-1").map((job) => job.jobId), [failed.jobId], "THE_FAILURE_IS_NOT_LISTED");
  assert.equal(registry.isNewestOnKey(failed), true);

  const fresh = registry.enqueue({ ...assessmentStart, initiatingAnalystDocumentId: "sam" });
  assert.notEqual(fresh.jobId, failed.jobId);
  await registry.settled(fresh.jobId);
  assert.equal(registry.get(fresh.jobId)?.status, "completed");
  assert.deepEqual(registry.failedFor("a-1"), [], "A_REPLACED_FAILURE_IS_STILL_LISTED");
  assert.equal(registry.isNewestOnKey(registry.get(failed.jobId) as ProposalJob<Input, AssessmentProposalJobTarget>), false, "A_REPLACED_FAILURE_IS_THE_NEWEST");
  assert.equal(registry.isNewestOnKey(registry.get(fresh.jobId) as ProposalJob<Input, AssessmentProposalJobTarget>), true);
  assert.equal(registry.isNewestOnKey({ jobId: "missing", key: "suggestions:a-1" }), false);
});

test("a deferred retry whose admission fails is put back as the failed job it was, with its failure, attempt and initiator (BE2-16)", async () => {
  const registry = createProposalJobRegistry<Input>({ execute: async () => { throw new ProposalJobFailure("PROVIDER_TIMEOUT", "The provider timed out."); } });
  const queued = registry.enqueue(start());
  await registry.settled(queued.jobId);
  const failed = registry.get(queued.jobId) as ProposalJob<Input>;
  registry.retry(queued.jobId, "sam", true);
  registry.restoreFailed(failed);
  const restored = registry.get(queued.jobId) as ProposalJob<Input> | null;
  assert.ok(restored, "THE_FAILED_JOB_WAS_REMOVED");
  assert.deepEqual(
    [restored.status, restored.failure, restored.attempt, restored.initiatingAnalystDocumentId, restored.completedAt],
    ["failed", failed.failure, 1, "bob", failed.completedAt],
    "THE_FAILED_JOB_WAS_NOT_RESTORED",
  );
  assert.deepEqual(registry.activeFor("q-1"), [], "THE_KEY_STAYED_RESERVED");
  assert.equal(registry.mayRetry(restored), true, "THE_RESTORED_JOB_CANNOT_BE_RETRIED");
});
