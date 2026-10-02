import assert from "node:assert/strict";
import test from "node:test";

import { createAssessmentDraftRegistry, type AssessmentDraftJobRecord } from "../src/api/csrm-assessment/services/assessment-draft-registry";
import { deterministicQuestionnaireGenerationProvider } from "../src/api/csrm-questionnaire/services/deterministic-questionnaire-generation-provider";
import { createQuestionnaireGenerationRegistry, QuestionnaireGenerationRegistryError } from "../src/api/csrm-questionnaire/services/questionnaire-generation-registry";
import { parseQuestionnaireGenerationProposal } from "../src/api/csrm-questionnaire/services/questionnaire-generation-provider";
import { generateQuestionnaireNumber } from "../src/api/csrm-questionnaire/services/questionnaire-number";
import {
  MAX_ACTIVE_GENERATION_REQUEST_IDS,
  QuestionnaireGenerationCapacityError,
  activeQuestionnaireGenerationRequestIds,
  assertActiveGenerationCapacity,
  generateQuestionnaire,
  getQuestionnaireGenerationJob,
  hasQuestionnaireAnswerEvidence,
  persistGeneratedQuestionnaire,
} from "../src/api/csrm-questionnaire/services/questionnaire-generation-workflow";

/** Lets every queued microtask and the next macrotask run. */
const settle = () => new Promise<void>((resolve) => setImmediate(resolve));

test("questionnaire generation validates deterministic contextual proposals", async () => {
  const proposal = await deterministicQuestionnaireGenerationProvider.generate({ title: "Payroll replacement", businessPurpose: "pay employees", businessCriticality: "High", thirdPartyInvolvement: true, thirdPartyDetails: "Hosted provider" });
  assert.equal(parseQuestionnaireGenerationProposal(proposal).questions.length, 4);
  assert.throws(() => parseQuestionnaireGenerationProposal({ ...proposal, unknown: true }), /invalid/);
  assert.match(generateQuestionnaireNumber(new Date("2026-09-03T00:00:00.000Z")), /^QNR-2026-/);
});

test("questionnaire generation jobs are actor-scoped and terminal jobs do not block a fresh request", async () => {
  let next = 0;
  const registry = createQuestionnaireGenerationRegistry({ createJobId: () => `job-${++next}`, execute: async () => ({ questionnaireId: "questionnaire-1" }) });
  const first = registry.enqueue({ requestId: "request-1", initiatingAnalystDocumentId: "analyst-1", providerName: "provider", providerVersion: "1", replaceUnansweredQuestionnaire: false });
  assert.equal(first.status, "queued");
  assert.throws(() => registry.get(first.jobId, { documentId: "analyst-2", canReadAllQuestionnaireGenerationJobs: false }), QuestionnaireGenerationRegistryError);
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(registry.get(first.jobId, { documentId: "analyst-1", canReadAllQuestionnaireGenerationJobs: false }).status, "completed");
  assert.equal(registry.enqueue({ requestId: "request-1", initiatingAnalystDocumentId: "analyst-1", providerName: "provider", providerVersion: "1", replaceUnansweredQuestionnaire: true }).jobId, "job-2");
});

/*
 * D-21: the review queues apply the registry as an id-set predicate, so the
 * registry exposes a sorted snapshot of the requests that have a queued or
 * running job. A finished job, successful or failed, leaves the snapshot.
 */
test("the generation registry exposes a sorted snapshot of the requests with an active job", async () => {
  const gates = new Map<string, { succeed: () => void; fail: () => void }>();
  let next = 0;
  const registry = createQuestionnaireGenerationRegistry({
    createJobId: () => `job-${++next}`,
    execute: (job) => new Promise((resolve, reject) => {
      gates.set(job.requestId, {
        succeed: () => resolve({ questionnaireId: `questionnaire-${job.requestId}` }),
        fail: () => reject(new Error("provider failed")),
      });
    }),
  });
  const input = (requestId: string) => ({ requestId, initiatingAnalystDocumentId: "analyst-1", providerName: "provider", providerVersion: "1", replaceUnansweredQuestionnaire: false });

  assert.deepEqual(registry.activeRequestIds(), [], "SNAPSHOT_NOT_EMPTY_INITIALLY");
  registry.enqueue(input("req-b"));
  registry.enqueue(input("req-a"));
  assert.deepEqual(registry.activeRequestIds(), ["req-a", "req-b"], "SNAPSHOT_NOT_SORTED");

  const snapshot = registry.activeRequestIds() as string[];
  snapshot.push("forged");
  assert.deepEqual(registry.activeRequestIds(), ["req-a", "req-b"], "SNAPSHOT_SHARES_REGISTRY_STATE");

  await settle();
  gates.get("req-a")?.succeed();
  await settle();
  assert.deepEqual(registry.activeRequestIds(), ["req-b"], "COMPLETED_JOB_STILL_ACTIVE");

  gates.get("req-b")?.fail();
  await settle();
  assert.deepEqual(registry.activeRequestIds(), [], "FAILED_JOB_STILL_ACTIVE");
});

/** A job execution held open until the test settles it. */
type Gate = { succeed: () => void; fail: () => void };

/*
 * D-25: the request read selects the active job first, else the retained job queued last. Here the clock steps
 * back between two jobs, so the failed job was queued later than the job now running, and the running one is
 * still the request's current job. canRetry is the viewer's fact alone: true only for the job's initiator.
 */
test("latestForRequest returns the active job, else the latest retained job, with the viewer's retry right", async () => {
  const gates = new Map<string, Gate>();
  let next = 0;
  let clock = Date.parse("2026-10-01T09:05:00.000Z");
  const registry = createQuestionnaireGenerationRegistry({
    createJobId: () => `job-${++next}`,
    now: () => new Date(clock),
    execute: (job) => new Promise((resolve, reject) => {
      gates.set(job.jobId, { succeed: () => resolve({ questionnaireId: `questionnaire-${job.jobId}` }), fail: () => reject(new Error("provider failed")) });
    }),
  });
  const input = (requestId: string, analyst: string) => ({ requestId, initiatingAnalystDocumentId: analyst, providerName: "provider", providerVersion: "1", replaceUnansweredQuestionnaire: false });

  assert.equal(registry.latestForRequest("request-1", "analyst-1"), null, "UNKNOWN_REQUEST_HAS_A_JOB");
  registry.enqueue(input("request-1", "analyst-1"));
  await settle();
  gates.get("job-1")?.fail();
  await settle();

  clock = Date.parse("2026-10-01T09:00:00.000Z");
  registry.enqueue(input("request-1", "analyst-2"));
  const active = registry.latestForRequest("request-1", "analyst-1");
  assert.equal(active?.job.jobId, "job-2", "ACTIVE_JOB_NOT_PREFERRED");
  assert.equal(active?.canRetry, false, "NON_INITIATOR_MAY_RETRY");
  assert.equal(registry.latestForRequest("request-1", "analyst-2")?.canRetry, true, "INITIATOR_MAY_NOT_RETRY");
  assert.equal(registry.latestForRequest("request-2", "analyst-1"), null, "ANOTHER_REQUESTS_JOB_LEAKED");

  await settle();
  gates.get("job-2")?.succeed();
  await settle();
  assert.equal(registry.latestForRequest("request-1", "analyst-1")?.job.jobId, "job-1", "RETAINED_JOB_NOT_THE_LATEST_QUEUED");

  clock = Date.parse("2026-10-01T09:10:00.000Z");
  registry.enqueue(input("request-1", "analyst-1"));
  await settle();
  gates.get("job-3")?.succeed();
  await settle();
  const latest = registry.latestForRequest("request-1", "analyst-1");
  assert.equal(latest?.job.jobId, "job-3", "LATEST_RETAINED_JOB_NOT_RETURNED");
  assert.equal(latest?.job.status, "completed", "LATEST_RETAINED_JOB_STATUS");
  assert.equal(latest?.canRetry, true, "INITIATOR_MAY_NOT_RETRY_A_RETAINED_JOB");
  assert.equal(registry.latestForRequest("request-1", ""), null, "BLANK_VIEWER_READ_A_JOB");
});

type LatestDraftJob = { job: AssessmentDraftJobRecord; canRetry: boolean } | null;

/* D-25: the draft registry answers the same question by questionnaire, for the request's questionnaire. */
test("latestForQuestionnaire returns the questionnaire's current draft job with the viewer's retry right", async () => {
  const gates = new Map<string, Gate>();
  let next = 0;
  const registry = createAssessmentDraftRegistry({
    createJobId: () => `draft-${++next}`,
    execute: (job) => new Promise((resolve, reject) => {
      gates.set(job.jobId, { succeed: () => resolve({ assessmentId: `assessment-${job.jobId}` }), fail: () => reject(new Error("provider failed")) });
    }),
  });
  const latestForQuestionnaire = (registry as unknown as { latestForQuestionnaire?: (questionnaireId: string, viewerDocumentId: string) => LatestDraftJob }).latestForQuestionnaire;
  assert.equal(typeof latestForQuestionnaire, "function", "DRAFT_REGISTRY_HAS_NO_LATEST_READ");
  const read = (questionnaireId: string, viewer: string) => latestForQuestionnaire!(questionnaireId, viewer);

  assert.equal(read("questionnaire-1", "analyst-1"), null, "UNKNOWN_QUESTIONNAIRE_HAS_A_JOB");
  registry.enqueue({ questionnaireId: "questionnaire-1", initiatingAnalystDocumentId: "analyst-1", providerName: "provider", providerVersion: "1" });
  assert.equal(read("questionnaire-1", "analyst-1")?.job.status, "queued", "ACTIVE_DRAFT_JOB_NOT_RETURNED");
  assert.equal(read("questionnaire-1", "analyst-1")?.canRetry, true, "DRAFT_INITIATOR_MAY_NOT_RETRY");
  assert.equal(read("questionnaire-1", "analyst-2")?.canRetry, false, "DRAFT_NON_INITIATOR_MAY_RETRY");
  assert.equal(read("questionnaire-2", "analyst-1"), null, "ANOTHER_QUESTIONNAIRES_DRAFT_JOB_LEAKED");

  await settle();
  gates.get("draft-1")?.fail();
  await settle();
  const failed = read("questionnaire-1", "analyst-2");
  assert.equal(failed?.job.jobId, "draft-1", "RETAINED_DRAFT_JOB_NOT_RETURNED");
  assert.equal(failed?.job.status, "failed", "RETAINED_DRAFT_JOB_STATUS");
  assert.equal(failed?.canRetry, false, "DRAFT_NON_INITIATOR_MAY_RETRY_A_FAILED_JOB");
});

/*
 * The workflow accessor is what the review queue reads. It is exercised here
 * without any provider call: the job's own request read is held, then answers
 * that the request is gone, so the job fails before generation starts.
 */
test("the workflow exposes the active generation request ids and fails closed beyond its cap", async () => {
  let releaseJobRead: (value: null) => void = () => undefined;
  const heldJobRead = new Promise<null>((resolve) => { releaseJobRead = resolve; });
  /*
   * The synchronous read populates the request's questionnaire (D-09 refuses a released one); only the job's
   * read populates that questionnaire's questions, and that is the read this test holds.
   */
  const isJobRead = (query: Record<string, unknown>) => {
    const questionnaire = (query.populate as { questionnaire?: unknown } | undefined)?.questionnaire;
    return typeof questionnaire === "object" && questionnaire !== null && "populate" in questionnaire;
  };
  const documents = () => ({
    findOne: async (query: Record<string, unknown>) => isJobRead(query)
      ? heldJobRead
      : { documentId: "request-1", requestStatus: "submitted", title: "Payroll replacement" },
    findMany: async () => [],
    create: async () => ({ documentId: "created" }),
    update: async () => ({ documentId: "updated" }),
    delete: async () => undefined,
  });
  const chain = { select: () => chain, where: () => chain, forUpdate: () => chain, transacting: () => chain, execute: async <T>() => [] as T };
  const strapi = { documents, db: { transaction: async <T>(work: (context: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => chain } };

  assert.deepEqual(activeQuestionnaireGenerationRequestIds(strapi), [], "WORKFLOW_SNAPSHOT_NOT_EMPTY");
  const queued = await generateQuestionnaire({ strapi, requestId: "request-1", analystDocumentId: "analyst-1" });
  await settle();
  assert.deepEqual(activeQuestionnaireGenerationRequestIds(strapi), ["request-1"], "HELD_JOB_NOT_ACTIVE");

  releaseJobRead(null);
  await settle();
  const finished = await getQuestionnaireGenerationJob({ strapi, jobId: String(queued.jobId), analystDocumentId: "analyst-1" });
  assert.equal(finished.status, "failed", "HELD_JOB_DID_NOT_FAIL");
  assert.deepEqual(activeQuestionnaireGenerationRequestIds(strapi), [], "FINISHED_JOB_STILL_ACTIVE");

  assert.equal(MAX_ACTIVE_GENERATION_REQUEST_IDS, 1_000);
  const atCap = Array.from({ length: MAX_ACTIVE_GENERATION_REQUEST_IDS }, (_, index) => `request-${index}`);
  assert.deepEqual(assertActiveGenerationCapacity(atCap), atCap, "SNAPSHOT_AT_CAP_REFUSED");
  assert.deepEqual(assertActiveGenerationCapacity([]), [], "EMPTY_SNAPSHOT_REFUSED");
  assert.throws(
    () => assertActiveGenerationCapacity([...atCap, "request-over-cap"]),
    QuestionnaireGenerationCapacityError,
    "SNAPSHOT_OVER_CAP_ACCEPTED",
  );
});

test("replacement guard preserves every requestor answer envelope", () => {
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: null }]), false);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: "  " } }]), false);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: [], state: "draft" } }]), true);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: ["cloud"] } }]), true);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: false } }]), true);
  assert.equal(hasQuestionnaireAnswerEvidence([{ answer: { schemaVersion: 1, value: null, state: "submitted" } }]), true);
});

test("locked replacement refuses answered work before deleting question rows", async () => {
  let deleted = 0;
  const request = {
    documentId: "request-1",
    requestStatus: "submitted",
    title: "Payroll replacement",
    questionnaire: {
      documentId: "questionnaire-1",
      questions: [{ documentId: "question-1", answer: { schemaVersion: 1, value: "do not replace", state: "draft" } }],
    },
  };
  const documents = (uid: string) => ({
    findOne: async () => uid.includes("assessment-request") ? request : null,
    findMany: async () => [],
    create: async () => ({ documentId: "created" }),
    update: async () => ({ documentId: "updated" }),
    delete: async () => { deleted += 1; },
  });
  const chain = { select: () => chain, where: () => chain, forUpdate: () => chain, transacting: () => chain, execute: async <T>() => [] as T };
  const strapi = { documents, db: { transaction: async <T>(work: (context: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => chain } };
  await assert.rejects(
    () => persistGeneratedQuestionnaire(strapi, "request-1", "analyst-1", true),
    /Answered questionnaires cannot be regenerated/,
  );
  assert.equal(deleted, 0);
});
