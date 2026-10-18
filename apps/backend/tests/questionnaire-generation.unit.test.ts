import assert from "node:assert/strict";
import test from "node:test";

import { createAssessmentDraftRegistry } from "../src/api/csrm-assessment/services/assessment-draft-registry";
import { deterministicQuestionnaireGenerationProvider } from "../src/api/csrm-questionnaire/services/deterministic-questionnaire-generation-provider";
import { createQuestionnaireGenerationRegistry, QuestionnaireGenerationRegistryError } from "../src/api/csrm-questionnaire/services/questionnaire-generation-registry";
import { parseQuestionnaireGenerationProposal } from "../src/api/csrm-questionnaire/services/questionnaire-generation-provider";
import { generateQuestionnaireNumber } from "../src/api/csrm-questionnaire/services/questionnaire-number";
import { questionnaireContextFixture } from "./helpers/questionnaire-context-fixture";
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
  const proposal = await deterministicQuestionnaireGenerationProvider.generate(questionnaireContextFixture({ businessPurpose: "pay employees", thirdPartyDetails: "Hosted provider" }));
  assert.equal(parseQuestionnaireGenerationProposal(proposal).questions.length, 7);
  assert.ok(proposal.questions.every((question) => typeof question.helpText === "string" && question.helpText.length > 0));
  assert.deepEqual(proposal.questions.map((question) => question.options.questionKey), ["security-objectives", "business-criticality", "third-party-involvement", "third-party-details", "regulatory-obligations", "asset-protection", "recovery-tested"]);
  assert.ok(proposal.questions.some((question) => question.options.required === false));
  assert.throws(() => parseQuestionnaireGenerationProposal({ ...proposal, unknown: true }), /invalid/);
  assert.match(generateQuestionnaireNumber(new Date("2026-09-03T00:00:00.000Z")), /^QNR-2026-/);
});

/*
 * WR-105 (G-3) and walk D12: the deterministic questionnaire writes its own text. It echoes no Requestor text into the
 * questions, title or description the run's proposal keeps (only the request's business criticality, a closed value,
 * and the selected asset's name, reference data), and it ends every sentence with one mark of its own.
 */
test("the deterministic questionnaire echoes no Requestor text and punctuates its own sentences", async () => {
  const SENTINEL = "SENTINEL-REQUESTOR-TEXT";
  const fields = Object.fromEntries(["title", "description", "division", "businessUnit", "businessPurpose", "thirdPartyDetails", "regulatoryRequirements", "businessCriticality"]
    .map((field) => [field, `${SENTINEL} in ${field}.`]));
  const proposal = await deterministicQuestionnaireGenerationProvider.generate(questionnaireContextFixture({ ...fields, businessPurpose: `Pay employees on time (${SENTINEL}).` }));
  assert.ok(!JSON.stringify(proposal).includes(SENTINEL), "REQUESTOR_TEXT_ECHOED_BY_THE_DETERMINISTIC_QUESTIONNAIRE");
  const sentences = [proposal.title, proposal.description ?? "", ...proposal.questions.map((question) => question.questionText)];
  for (const sentence of sentences) assert.doesNotMatch(sentence, /[.?!]\s*[.?!]/, `DOUBLE_PUNCTUATION: ${sentence}`);
  for (const question of proposal.questions) assert.match(question.questionText, /[^.?!][?.]$/, question.questionText);
  const criticality = (value: string) => deterministicQuestionnaireGenerationProvider.generate(questionnaireContextFixture({ businessCriticality: value }))
    .then((generated) => generated.questions.find((question) => question.options.questionKey === "business-criticality")?.questionText);
  assert.equal(await criticality("High"), "Is the stated business criticality (High) right?");
  assert.equal((await deterministicQuestionnaireGenerationProvider.generate(questionnaireContextFixture())).questions.find((question) => question.options.questionKey === "asset-protection")?.questionText, "How is Payroll records protected?");
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
 * D-25, D-18: the request read selects the active job first, else the retained job queued last. Here the clock steps
 * back between two jobs, so the failed job was queued later than the job now running, and the running one is
 * still the request's current job. canRetry means "the job failed and this viewer may retry it": false for a
 * queued, running or completed job whoever reads it, true for a failed job read by any human analyst, and false
 * for a failed job read by someone the registry would refuse.
 */
test("latestForRequest returns the active job, else the latest retained job, with whether the viewer may retry it", async () => {
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
  const latest = registry.latestForRequest;
  const input = (requestId: string, analyst: string) => ({ requestId, initiatingAnalystDocumentId: analyst, providerName: "provider", providerVersion: "1", replaceUnansweredQuestionnaire: false });
  const human = (documentId: string) => ({ documentId, canReadAllQuestionnaireGenerationJobs: true });
  const initiatorOnly = (documentId: string) => ({ documentId, canReadAllQuestionnaireGenerationJobs: false });

  assert.equal(latest("request-1", human("analyst-1")), null, "UNKNOWN_REQUEST_HAS_A_JOB");
  registry.enqueue(input("request-1", "analyst-1"));
  await settle();
  gates.get("job-1")?.fail();
  await settle();
  const failed = latest("request-1", human("analyst-2"));
  assert.equal(failed?.job.jobId, "job-1", "FAILED_JOB_NOT_RETURNED");
  assert.equal(failed?.canRetry, true, "ANOTHER_HUMAN_ANALYST_MAY_NOT_RETRY_A_FAILED_JOB");
  assert.equal(latest("request-1", human("analyst-1"))?.canRetry, true, "INITIATOR_MAY_NOT_RETRY_A_FAILED_JOB");
  assert.equal(latest("request-1", initiatorOnly("analyst-2"))?.canRetry, false, "A_REFUSED_VIEWER_MAY_RETRY");

  clock = Date.parse("2026-10-01T09:00:00.000Z");
  registry.enqueue(input("request-1", "analyst-2"));
  const active = latest("request-1", human("analyst-1"));
  assert.equal(active?.job.jobId, "job-2", "ACTIVE_JOB_NOT_PREFERRED");
  assert.equal(active?.canRetry, false, "AN_ACTIVE_JOB_MAY_BE_RETRIED");
  assert.equal(latest("request-1", human("analyst-2"))?.canRetry, false, "THE_INITIATOR_MAY_RETRY_AN_ACTIVE_JOB");
  assert.equal(latest("request-2", human("analyst-1")), null, "ANOTHER_REQUESTS_JOB_LEAKED");

  await settle();
  gates.get("job-2")?.succeed();
  await settle();
  assert.equal(latest("request-1", human("analyst-1"))?.job.jobId, "job-1", "RETAINED_JOB_NOT_THE_LATEST_QUEUED");

  clock = Date.parse("2026-10-01T09:10:00.000Z");
  registry.enqueue(input("request-1", "analyst-1"));
  await settle();
  gates.get("job-3")?.succeed();
  await settle();
  const completed = latest("request-1", human("analyst-1"));
  assert.equal(completed?.job.jobId, "job-3", "LATEST_RETAINED_JOB_NOT_RETURNED");
  assert.equal(completed?.job.status, "completed", "LATEST_RETAINED_JOB_STATUS");
  assert.equal(completed?.canRetry, false, "A_COMPLETED_JOB_MAY_BE_RETRIED");
  assert.equal(latest("request-1", human("")), null, "BLANK_VIEWER_READ_A_JOB");
});


/* D-25, D-18: the draft registry answers the same question by questionnaire, for the request's questionnaire. */
test("latestForQuestionnaire returns the questionnaire's current draft job with whether the viewer may retry it", async () => {
  const gates = new Map<string, Gate>();
  let next = 0;
  const registry = createAssessmentDraftRegistry({
    createJobId: () => `draft-${++next}`,
    execute: (job) => new Promise((resolve, reject) => {
      gates.set(job.jobId, { succeed: () => resolve({ assessmentId: `assessment-${job.jobId}` }), fail: () => reject(new Error("provider failed")) });
    }),
  });
  const read = registry.latestForQuestionnaire;
  const human = (documentId: string) => ({ documentId, canReadAllDraftJobs: true });

  assert.equal(read("questionnaire-1", human("analyst-1")), null, "UNKNOWN_QUESTIONNAIRE_HAS_A_JOB");
  registry.enqueue({ questionnaireId: "questionnaire-1", initiatingAnalystDocumentId: "analyst-1", providerName: "provider", providerVersion: "1" });
  assert.equal(read("questionnaire-1", human("analyst-1"))?.job.status, "queued", "ACTIVE_DRAFT_JOB_NOT_RETURNED");
  assert.equal(read("questionnaire-1", human("analyst-1"))?.canRetry, false, "AN_ACTIVE_DRAFT_JOB_MAY_BE_RETRIED");
  assert.equal(read("questionnaire-2", human("analyst-1")), null, "ANOTHER_QUESTIONNAIRES_DRAFT_JOB_LEAKED");

  await settle();
  gates.get("draft-1")?.fail();
  await settle();
  const failed = read("questionnaire-1", human("analyst-2"));
  assert.equal(failed?.job.jobId, "draft-1", "RETAINED_DRAFT_JOB_NOT_RETURNED");
  assert.equal(failed?.job.status, "failed", "RETAINED_DRAFT_JOB_STATUS");
  assert.equal(failed?.canRetry, true, "ANOTHER_HUMAN_ANALYST_MAY_NOT_RETRY_A_FAILED_DRAFT_JOB");
  assert.equal(read("questionnaire-1", { documentId: "analyst-2", canReadAllDraftJobs: false })?.canRetry, false, "A_REFUSED_VIEWER_MAY_RETRY_A_DRAFT_JOB");
});

/*
 * D-18, G-3 (13-RESEARCH Pitfall 6): a retry is the retrying analyst's attempt. Bob starts a job, it fails, the
 * second analyst retries it, and the execution receives the second analyst, so the questionnaire's generatedBy and
 * the new run's initiatedBy name the analyst who retried. The job then reads as the retrier's own.
 */
test("a retried questionnaire generation job is the retrying analyst's attempt", async () => {
  const executions: string[] = [];
  const registry = createQuestionnaireGenerationRegistry({
    createJobId: () => "job-retried",
    execute: async (job) => {
      executions.push(job.initiatingAnalystDocumentId);
      if (job.attempt === 1) throw new Error("provider failed");
      return { questionnaireId: "questionnaire-retried" };
    },
  });
  registry.enqueue({ requestId: "request-1", initiatingAnalystDocumentId: "bob", providerName: "provider", providerVersion: "1", replaceUnansweredQuestionnaire: false });
  await settle();
  const second = { documentId: "second-analyst", canReadAllQuestionnaireGenerationJobs: true };
  assert.equal(registry.get("job-retried", second).status, "failed", "BOB_JOB_DID_NOT_FAIL");
  const retried = registry.retry("job-retried", second);
  assert.equal(retried.initiatingAnalystDocumentId, "second-analyst", "RETRY_NOT_CREDITED_TO_THE_RETRIER");
  await settle();
  assert.deepEqual(executions, ["bob", "second-analyst"], "RETRY_EXECUTED_AS_THE_ORIGINAL_INITIATOR");
  assert.equal(registry.get("job-retried", second).status, "completed", "RETRIED_JOB_DID_NOT_COMPLETE");
  assert.throws(() => registry.get("job-retried", { documentId: "bob", canReadAllQuestionnaireGenerationJobs: false }), QuestionnaireGenerationRegistryError, "THE_FORMER_INITIATOR_STILL_OWNS_THE_JOB");
});

/*
 * D-18: the workflow widens the by-id read to every human Security Analyst from the policy's humanAnalyst fact,
 * never a constant, and projects who started the job, whether the viewer did, and whether the viewer may retry it.
 * Without the fact the read stays the initiator's alone (fail closed).
 */
test("the by-id generation job read is open to every human analyst and names the analyst who started it", async () => {
  const documents = (uid: string) => ({
    findOne: async (query: Record<string, unknown>) => {
      if (!uid.includes("assessment-request")) return null;
      const questionnaire = (query.populate as { questionnaire?: unknown } | undefined)?.questionnaire;
      // The job's own read finds no request, so the job fails before any provider call.
      return typeof questionnaire === "object" && questionnaire !== null && "populate" in questionnaire ? null : { documentId: "request-viewers", requestStatus: "submitted", title: "Viewers" };
    },
    findMany: async () => (uid === "api::idambox-user.idambox-user" ? [{ documentId: "bob", displayName: "Bob Doe" }] : []),
    create: async () => ({ documentId: "created" }),
    update: async () => ({ documentId: "updated" }),
    delete: async () => undefined,
  });
  const chain = { select: () => chain, where: () => chain, forUpdate: () => chain, transacting: () => chain, execute: async <T>() => [] as T };
  const strapi = { documents, config: { get: (key: string) => (key === "ai" ? { dataClassificationCeiling: "Critical Infrastructure Sensitive" } : undefined) }, db: { transaction: async <T>(work: (context: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => chain } };
  const bob = { analystDocumentId: "bob", humanAnalyst: true };
  const second = { analystDocumentId: "second-analyst", humanAnalyst: true };
  const withoutFact = { analystDocumentId: "second-analyst", humanAnalyst: false };

  const queued = await generateQuestionnaire({ strapi, requestId: "request-viewers", ...bob });
  await settle();
  const read = (viewer: typeof bob) => getQuestionnaireGenerationJob({ strapi, jobId: String(queued.jobId), ...viewer }).catch((error: unknown) => error);

  const colleague = await read(second) as Record<string, unknown>;
  assert.equal(colleague instanceof Error, false, `A_HUMAN_ANALYST_WAS_REFUSED_THE_JOB: ${String(colleague)}`);
  assert.equal(colleague.status, "failed", "VIEWERS_JOB_DID_NOT_FAIL");
  assert.deepEqual(colleague.initiatedBy, { documentId: "bob", displayName: "Bob Doe" }, "INITIATOR_NOT_NAMED");
  assert.equal(colleague.initiatedByViewer, false, "COLLEAGUE_READ_AS_THE_INITIATOR");
  assert.equal(colleague.canRetry, true, "COLLEAGUE_MAY_NOT_RETRY_A_FAILED_JOB");

  const own = await read(bob) as Record<string, unknown>;
  assert.equal(own.initiatedByViewer, true, "INITIATOR_NOT_TOLD_THEY_STARTED_IT");
  assert.equal(own.canRetry, true, "INITIATOR_MAY_NOT_RETRY_A_FAILED_JOB");

  const refused = await read(withoutFact);
  assert.ok(refused instanceof QuestionnaireGenerationRegistryError && refused.status === 403, "THE_READ_WIDENED_WITHOUT_THE_HUMAN_ANALYST_FACT");
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
  // The classification ceiling admits everything, so the 12-07 pre-queue policy check lets the job queue.
  const strapi = { documents, config: { get: (key: string) => (key === "ai" ? { dataClassificationCeiling: "Critical Infrastructure Sensitive" } : undefined) }, db: { transaction: async <T>(work: (context: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => chain } };

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

test("oversized questionnaire context refuses before creating a run", async () => {
  let writes = 0;
  const request = { documentId: "request-oversized", requestStatus: "submitted", title: "Oversized", informationSystems: [], informationAssets: Array.from({ length: 101 }, (_, index) => ({ documentId: `asset-${index}`, name: `Asset ${index}` })) };
  const strapi = {
    documents: (uid: string) => ({ findOne: async () => uid.includes("assessment-request") ? request : null, findMany: async () => [], create: async () => { writes++; return { documentId: "created" }; }, update: async () => ({ documentId: "updated" }), delete: async () => undefined }),
    config: { get: () => undefined },
    db: { transaction: async <T>(work: (context: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => { throw new Error("unexpected transaction"); } },
  };
  await assert.rejects(() => persistGeneratedQuestionnaire(strapi, "request-oversized", "analyst-1", false), (error: unknown) => (error as { code?: string }).code === "CONTEXT_TOO_LARGE");
  assert.equal(writes, 0);
});

/*
 * WR-104 (D-06): a request within every published limit whose run summary would pass the run record's 64 KB bound
 * (100 systems and 100 assets with long names in a non-Latin script) fails as CONTEXT_TOO_LARGE before any run is
 * created or the provider is called, not as a generic failure at the run.
 */
test("a context whose run summary would pass its bound refuses as too large before creating a run", async () => {
  let writes = 0;
  const name = (prefix: string, index: number) => `${prefix} ${index} ${"é".repeat(250)}`.slice(0, 255);
  const request = {
    documentId: "request-wide", requestStatus: "submitted", title: "Wide request",
    informationSystems: Array.from({ length: 100 }, (_, index) => ({ documentId: `system-${index}`, name: name("Système", index) })),
    informationAssets: Array.from({ length: 100 }, (_, index) => ({ documentId: `asset-${index}`, name: name("Données", index), dataClassification: "Internal" })),
  };
  const strapi = {
    documents: (uid: string) => ({ findOne: async () => uid.includes("assessment-request") ? request : null, findMany: async () => [], create: async () => { writes++; return { documentId: "created" }; }, update: async () => ({ documentId: "updated" }), delete: async () => undefined }),
    // The classification ceiling admits everything, so only the size can refuse it.
    config: { get: (key: string) => (key === "ai" ? { dataClassificationCeiling: "Critical Infrastructure Sensitive" } : undefined) },
    db: { transaction: async <T>(work: (context: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => { throw new Error("unexpected transaction"); } },
  };
  await assert.rejects(() => persistGeneratedQuestionnaire(strapi, "request-wide", "analyst-1", false), (error: unknown) => (error as { code?: string }).code === "CONTEXT_TOO_LARGE", "SUMMARY_BOUND_NOT_CONTEXT_TOO_LARGE");
  assert.equal(writes, 0, "a run was created");
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
  const strapi = { documents, config: { get: () => undefined }, db: { transaction: async <T>(work: (context: { trx: unknown }) => Promise<T>) => work({ trx: {} }), queryBuilder: () => chain } };
  await assert.rejects(
    () => persistGeneratedQuestionnaire(strapi, "request-1", "analyst-1", true),
    /Answered questionnaires cannot be regenerated/,
  );
  assert.equal(deleted, 0);
});
