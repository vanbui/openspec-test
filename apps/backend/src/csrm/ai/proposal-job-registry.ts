import { randomBytes } from "node:crypto";

/*
 * The generic in-process AI proposal job registry (Phase 15 D-16; 15-RESEARCH §K). Phase 15's questionnaire proposals and
 * question rewrites use it, and Phase 16's risk proposals can instantiate it as another target kind: it knows nothing of
 * questions. It copies the questionnaire generation registry's pattern (R-08-36): the states queued, running, completed
 * and failed; single flight per key, so a second start on the same key returns the active job; terminal jobs kept for an
 * hour, at most 500, the least recently touched evicted first; and only a safe failure code and message are kept.
 *
 * A job is keyed by a target string (`questionnaire:{id}` for a questionnaire-wide run, `question:{id}` for a rewrite;
 * Phase 16's `suggestions:{assessmentId}` and `rewrite:{riskId}`) and indexed by its target's questionnaire or
 * assessment. Single flight holds only while a job is queued or running: a finished job leaves `activeByKey`, so a
 * completed job never blocks a new run (16-RESEARCH Pitfall 8). A retry is a new attempt of the same job, initiated by the retrying analyst
 * (Phase 13 D-18), allowed only for a failed job whose key has no active job. The registry neither authorises nor
 * persists anything: who may start, read or retry a job is the workflow's rule, and the jobs are process-local.
 */

export type ProposalJobStatus = "queued" | "running" | "completed" | "failed";
/* Phase 14 D-33 (S-3): a CONTEXT_TOO_LARGE failure keeps the files included when the context was refused, by documentId. */
export type ProposalJobFailureRecord = { code: string; message: string; attachmentDocumentIds?: string[] };

/*
 * Phase 16 D-26 (the pilot's registry ruling): what a job works on. Phase 15's questionnaire proposals and question
 * rewrites target a questionnaire (and a question); Phase 16's risk suggestions and risk rewrites target an assessment
 * (and a Risk). `activeFor(scopeId)` lists the jobs of one questionnaire or one assessment.
 */
export type QuestionnaireProposalJobTarget = { kind: "questionnaire"; questionnaireId: string; questionId: string | null };
export type AssessmentProposalJobTarget = { kind: "assessment"; assessmentId: string; riskId: string | null };
export type ProposalJobTarget = QuestionnaireProposalJobTarget | AssessmentProposalJobTarget;

type ProposalJobBase<TInput> = {
  jobId: string;
  key: string;
  operation: string;
  input: TInput;
  initiatingAnalystDocumentId: string;
  status: ProposalJobStatus;
  attempt: number;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  /** The current attempt's AI run, once it exists. */
  runId?: string;
  failure?: ProposalJobFailureRecord;
};
/* A questionnaire job keeps Phase 15's top-level questionnaireId and questionId beside its target. */
type TargetFields<TTarget extends ProposalJobTarget> = TTarget extends QuestionnaireProposalJobTarget
  ? { target: TTarget; questionnaireId: string; questionId: string | null }
  : { target: TTarget };
export type ProposalJob<TInput, TTarget extends ProposalJobTarget = QuestionnaireProposalJobTarget> = ProposalJobBase<TInput> & TargetFields<TTarget>;
type StartBase<TInput> = Pick<ProposalJobBase<TInput>, "key" | "operation" | "input" | "initiatingAnalystDocumentId">;
/* A start without a target is a questionnaire start exactly as Phase 15 makes it; any other kind names its target. */
export type ProposalJobStart<TInput, TTarget extends ProposalJobTarget = QuestionnaireProposalJobTarget> = StartBase<TInput> & (TTarget extends QuestionnaireProposalJobTarget
  ? { questionnaireId: string; questionId: string | null; target?: TTarget }
  : { target: TTarget });
/** What an execution may report while it runs: the run it created, so a failed attempt still names it. */
export type ProposalJobReport = { recordRun: (runId: string) => void };
export type ProposalJobRegistryOptions<TInput, TTarget extends ProposalJobTarget = QuestionnaireProposalJobTarget> = {
  execute: (job: ProposalJob<TInput, TTarget>, report: ProposalJobReport) => Promise<{ runId: string }>;
  now?: () => Date;
  createJobId?: () => string;
  maxTerminal?: number;
  terminalTtlMs?: number;
};

export class ProposalJobRegistryError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "ProposalJobRegistryError";
  }
}

/**
 * A job failure the registry keeps: a closed code (`/^[A-Z][A-Z0-9_]{0,63}$/`), a safe message, and for a too-large
 * context the files it counted (Phase 14 D-33 and D-34). Anything else fails as the generic code.
 */
export class ProposalJobFailure extends Error {
  constructor(public readonly code: string, public readonly safeMessage: string, public readonly attachmentDocumentIds: readonly string[] = []) {
    super(safeMessage);
    this.name = "ProposalJobFailure";
  }
}

export const PROPOSAL_JOB_GENERIC_FAILURE = Object.freeze({ code: "AI_PROPOSAL_FAILED", message: "The AI proposal failed safely." });
const SAFE_CODE = /^[A-Z][A-Z0-9_]{0,63}$/;
/* At most the files a request can hold (ATTACHMENT_LIMITS.maxActivePerRequest). */
const MAX_FAILURE_ATTACHMENTS = 20;

/* What the registry holds: the base, the target and, for a questionnaire, Phase 15's two top-level fields. */
/* `order` is when the job last started an attempt on its key (enqueue or retry); it is never served. */
type Job<TInput> = ProposalJobBase<TInput> & { target: ProposalJobTarget; questionnaireId?: string; questionId?: string | null; lastAccess: number; order: number };

const nonBlank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 255;
const terminal = (status: ProposalJobStatus): boolean => status === "completed" || status === "failed";

function safeFailure(error: unknown): ProposalJobFailureRecord {
  if (!(error instanceof ProposalJobFailure) || !SAFE_CODE.test(error.code) || !nonBlank(error.safeMessage) || /[\r\n<>]/.test(error.safeMessage)) return { ...PROPOSAL_JOB_GENERIC_FAILURE };
  const ids = Array.isArray(error.attachmentDocumentIds) && error.attachmentDocumentIds.length <= MAX_FAILURE_ATTACHMENTS && error.attachmentDocumentIds.every(nonBlank)
    ? [...error.attachmentDocumentIds]
    : [];
  return { code: error.code, message: error.safeMessage, ...(ids.length ? { attachmentDocumentIds: ids } : {}) };
}

export type ProposalJobRegistry<TInput, TTarget extends ProposalJobTarget = QuestionnaireProposalJobTarget> = ReturnType<typeof createProposalJobRegistry<TInput, TTarget>>;

const nullableId = (value: unknown): value is string | null => value === null || nonBlank(value);
const scopeOf = (target: ProposalJobTarget): string => target.kind === "questionnaire" ? target.questionnaireId : target.assessmentId;

/* The start's target, validated by kind (each id non-blank and at most 255 characters), or null when it is invalid. */
function startTarget(start: Record<string, unknown>): ProposalJobTarget | null {
  const target = start.target;
  if (target === undefined) {
    return nonBlank(start.questionnaireId) && nullableId(start.questionId) ? { kind: "questionnaire", questionnaireId: start.questionnaireId, questionId: start.questionId } : null;
  }
  if (typeof target !== "object" || target === null || Array.isArray(target)) return null;
  const candidate = target as Record<string, unknown>;
  if (candidate.kind === "questionnaire") {
    return nonBlank(candidate.questionnaireId) && nullableId(candidate.questionId) ? { kind: "questionnaire", questionnaireId: candidate.questionnaireId, questionId: candidate.questionId } : null;
  }
  if (candidate.kind === "assessment") {
    return nonBlank(candidate.assessmentId) && nullableId(candidate.riskId) ? { kind: "assessment", assessmentId: candidate.assessmentId, riskId: candidate.riskId } : null;
  }
  return null;
}

export function createProposalJobRegistry<TInput, TTarget extends ProposalJobTarget = QuestionnaireProposalJobTarget>(options: ProposalJobRegistryOptions<TInput, TTarget>) {
  if (!options || typeof options.execute !== "function") throw new ProposalJobRegistryError(400, "AI proposal job registry configuration is invalid.");
  const now = options.now ?? (() => new Date());
  const createJobId = options.createJobId ?? (() => randomBytes(18).toString("base64url"));
  const maxTerminal = options.maxTerminal ?? 500;
  const terminalTtlMs = options.terminalTtlMs ?? 3_600_000;
  const jobs = new Map<string, Job<TInput>>();
  const activeByKey = new Map<string, string>();
  const inFlight = new Map<string, Promise<void>>();
  let sequence = 0;
  let orderSequence = 0;

  const publicJob = (job: Job<TInput>): ProposalJob<TInput, TTarget> => {
    const { lastAccess: _lastAccess, order: _order, ...rest } = job;
    return {
      ...rest,
      target: { ...job.target },
      ...(job.failure ? { failure: { ...job.failure, ...(job.failure.attachmentDocumentIds ? { attachmentDocumentIds: [...job.failure.attachmentDocumentIds] } : {}) } } : {}),
    } as unknown as ProposalJob<TInput, TTarget>;
  };
  const remove = (job: Job<TInput>) => {
    jobs.delete(job.jobId);
    if (activeByKey.get(job.key) === job.jobId) activeByKey.delete(job.key);
  };
  const cleanup = (): void => {
    const current = now().getTime();
    for (const job of jobs.values()) if (terminal(job.status) && job.completedAt && current - Date.parse(job.completedAt) > terminalTtlMs) remove(job);
    const retained = [...jobs.values()].filter((job) => terminal(job.status)).sort((left, right) => left.lastAccess - right.lastAccess);
    while (retained.length > maxTerminal) remove(retained.shift() as Job<TInput>);
  };
  const launch = (job: Job<TInput>): void => {
    const execution = Promise.resolve().then(async () => {
      job.status = "running";
      job.startedAt = now().toISOString();
      job.failure = undefined;
      try {
        const result = await options.execute(publicJob(job), { recordRun: (runId) => { if (nonBlank(runId)) job.runId = runId; } });
        if (!result || !nonBlank(result.runId)) throw new Error("AI proposal job completed without a run.");
        job.runId = result.runId;
        job.status = "completed";
      } catch (error) {
        job.status = "failed";
        job.failure = safeFailure(error);
      } finally {
        job.completedAt = now().toISOString();
        job.lastAccess = ++sequence;
        if (activeByKey.get(job.key) === job.jobId) activeByKey.delete(job.key);
        inFlight.delete(job.jobId);
        cleanup();
      }
    });
    inFlight.set(job.jobId, execution);
  };

  /** Queues a job, or returns the active job on the same key (single flight while it is queued or running). */
  const enqueue = (start: ProposalJobStart<TInput, TTarget>, deferExecution = false): ProposalJob<TInput, TTarget> => {
    cleanup();
    const raw = (typeof start === "object" && start !== null ? start : {}) as Record<string, unknown>;
    const target = startTarget(raw);
    if (!target || !nonBlank(raw.key) || !nonBlank(raw.operation) || !nonBlank(raw.initiatingAnalystDocumentId)) throw new ProposalJobRegistryError(400, "AI proposal job request is invalid.");
    const existing = activeByKey.get(raw.key);
    const active = existing ? jobs.get(existing) : undefined;
    if (active) return publicJob(active);
    const jobId = createJobId();
    if (!nonBlank(jobId) || jobs.has(jobId)) throw new ProposalJobRegistryError(409, "AI proposal job could not be allocated.");
    const job: Job<TInput> = {
      key: raw.key, operation: raw.operation, target,
      ...(target.kind === "questionnaire" ? { questionnaireId: target.questionnaireId, questionId: target.questionId } : {}),
      input: start.input, initiatingAnalystDocumentId: raw.initiatingAnalystDocumentId, jobId, status: "queued", attempt: 1, queuedAt: now().toISOString(), lastAccess: ++sequence,
      order: ++orderSequence,
    };
    jobs.set(jobId, job);
    activeByKey.set(job.key, jobId);
    if (!deferExecution) launch(job);
    return publicJob(job);
  };

  /** A retained job, or null. Reading keeps it retained (it is touched), as the generation registry's read does. */
  const get = (jobId: string): ProposalJob<TInput, TTarget> | null => {
    cleanup();
    const job = jobs.get(jobId);
    if (!job) return null;
    job.lastAccess = ++sequence;
    return publicJob(job);
  };

  /** Whether the job may be retried now: it failed, and nothing else runs on its key. Who may retry is the caller's rule. */
  const mayRetry = (job: Pick<ProposalJobBase<TInput>, "status" | "key">): boolean => job.status === "failed" && !activeByKey.has(job.key);

  /* Phase 13 D-18: a retry is the retrying analyst's attempt, so the run it creates names them as its initiator. */
  const retry = (jobId: string, analystDocumentId: string, deferExecution = false): ProposalJob<TInput, TTarget> => {
    const job = jobs.get(jobId);
    if (!job) throw new ProposalJobRegistryError(404, "AI proposal job was not found.");
    if (!nonBlank(analystDocumentId)) throw new ProposalJobRegistryError(400, "AI proposal job retry is invalid.");
    if (!mayRetry(job)) throw new ProposalJobRegistryError(409, "Only a failed AI proposal job can be retried.");
    job.initiatingAnalystDocumentId = analystDocumentId;
    job.status = "queued";
    job.attempt += 1;
    job.queuedAt = now().toISOString();
    job.startedAt = undefined;
    job.completedAt = undefined;
    job.failure = undefined;
    job.runId = undefined;
    job.lastAccess = ++sequence;
    job.order = ++orderSequence;
    activeByKey.set(job.key, jobId);
    if (!deferExecution) launch(job);
    return publicJob(job);
  };

  /**
   * The queued and running jobs of one questionnaire or one assessment (the target's scope id), oldest first. Like every
   * read here it neither authorises nor retains.
   */
  const activeFor = (scopeId: string): ProposalJob<TInput, TTarget>[] => [...activeByKey.values()]
    .map((jobId) => jobs.get(jobId))
    .filter((job): job is Job<TInput> => job !== undefined && scopeOf(job.target) === scopeId)
    .sort((left, right) => left.queuedAt.localeCompare(right.queuedAt) || left.jobId.localeCompare(right.jobId))
    .map(publicJob);

  /**
   * Whether the retained job is the last one started (or retried) on its key: false once a later job on the key has
   * replaced it, and for a job no longer retained (Phase 16 D-41, 16-REVIEW BE2-08).
   */
  const isNewestOnKey = (job: Pick<ProposalJobBase<TInput>, "jobId" | "key">): boolean => {
    const own = jobs.get(job.jobId);
    if (!own || own.key !== job.key) return false;
    for (const other of jobs.values()) if (other.key === own.key && other.order > own.order) return false;
    return true;
  };

  /**
   * The failed job of each key of one questionnaire or assessment that no later job on its key has replaced, newest
   * first (Phase 16 D-41: the proposals read shows a failure until it is retried, replaced or expires). Like `activeFor`
   * it neither authorises nor retains.
   */
  const failedFor = (scopeId: string): ProposalJob<TInput, TTarget>[] => {
    const latest = new Map<string, Job<TInput>>();
    for (const job of jobs.values()) {
      if (job.status !== "failed" || scopeOf(job.target) !== scopeId || !isNewestOnKey(job)) continue;
      const current = latest.get(job.key);
      if (!current || (current.completedAt ?? "") < (job.completedAt ?? "")) latest.set(job.key, job);
    }
    return [...latest.values()]
      .sort((left, right) => (right.completedAt ?? "").localeCompare(left.completedAt ?? "") || left.jobId.localeCompare(right.jobId))
      .map(publicJob);
  };

  /** Settles once the job's current attempt has ended (at once when none is running). */
  const settled = async (jobId: string): Promise<void> => { await inFlight.get(jobId); };

  const launchReserved = (jobId: string): void => {
    const job = jobs.get(jobId);
    if (job?.status === "queued" && !inFlight.has(jobId)) launch(job);
  };
  const discardReserved = (jobId: string): void => {
    const job = jobs.get(jobId);
    if (job?.status === "queued" && !inFlight.has(jobId)) remove(job);
  };
  /**
   * Puts a deferred retry that never launched back as the failed job it was (`previous`, read before the retry), so a
   * failed admission (a commit error) neither loses the failure nor leaves the key reserved (16-REVIEW BE2-16).
   */
  const restoreFailed = (previous: ProposalJob<TInput, TTarget>): void => {
    const job = jobs.get(previous.jobId);
    if (!job || job.status !== "queued" || inFlight.has(job.jobId) || previous.status !== "failed") return;
    job.initiatingAnalystDocumentId = previous.initiatingAnalystDocumentId;
    job.status = "failed";
    job.attempt = previous.attempt;
    job.queuedAt = previous.queuedAt;
    job.startedAt = previous.startedAt;
    job.completedAt = previous.completedAt;
    job.runId = previous.runId;
    job.failure = previous.failure ? { ...previous.failure, ...(previous.failure.attachmentDocumentIds ? { attachmentDocumentIds: [...previous.failure.attachmentDocumentIds] } : {}) } : undefined;
    job.lastAccess = ++sequence;
    if (activeByKey.get(job.key) === job.jobId) activeByKey.delete(job.key);
  };
  return { enqueue, get, retry, mayRetry, isNewestOnKey, activeFor, failedFor, settled, cleanup, launchReserved, discardReserved, restoreFailed };
}
