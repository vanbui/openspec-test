import { randomBytes } from "node:crypto";

export const ASSESSMENT_DRAFT_JOB_MAX_TERMINAL = 500;
export const ASSESSMENT_DRAFT_JOB_TERMINAL_TTL_MS = 60 * 60 * 1_000;

export type AssessmentDraftJobStatus = "queued" | "running" | "completed" | "failed";
/* Phase 14 D-33: a CONTEXT_TOO_LARGE failure keeps the files included when the context was refused, by documentId. */
export type AssessmentDraftJobFailureRecord = { code: string; message: string; attachmentDocumentIds?: string[] };
export type AssessmentDraftJobRecord = {
  jobId: string;
  questionnaireId: string;
  initiatingAnalystDocumentId: string;
  providerName: string;
  providerVersion: string;
  status: AssessmentDraftJobStatus;
  attempt: number;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
  assessmentId?: string;
  failure?: AssessmentDraftJobFailureRecord;
};

export type AssessmentDraftJobActor = {
  documentId: string;
  canReadAllDraftJobs: boolean;
};

export type AssessmentDraftJobExecution = {
  jobId: string;
  questionnaireId: string;
  initiatingAnalystDocumentId: string;
  providerName: string;
  providerVersion: string;
  attempt: number;
};

type RegistryOptions = {
  execute: (job: AssessmentDraftJobExecution) => Promise<{ assessmentId: string }>;
  now?: () => Date;
  createJobId?: () => string;
  maxTerminal?: number;
  terminalTtlMs?: number;
};

type EnqueueInput = {
  questionnaireId: string;
  initiatingAnalystDocumentId: string;
  providerName: string;
  providerVersion: string;
};

type InternalJob = AssessmentDraftJobRecord & { lastAccess: number };

export class AssessmentDraftRegistryError extends Error {
  constructor(public readonly status: 400 | 403 | 404 | 409, message: string) {
    super(message);
    this.name = "AssessmentDraftRegistryError";
  }
}

export class AssessmentDraftJobFailure extends Error {
  constructor(public readonly code: string, public readonly safeMessage: string, public readonly attachmentDocumentIds: readonly string[] = []) {
    super(safeMessage);
    this.name = "AssessmentDraftJobFailure";
  }
}

function nonBlank(value: unknown, maximum = 255): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= maximum;
}

function publicRecord(job: InternalJob): AssessmentDraftJobRecord {
  return {
    jobId: job.jobId,
    questionnaireId: job.questionnaireId,
    initiatingAnalystDocumentId: job.initiatingAnalystDocumentId,
    providerName: job.providerName,
    providerVersion: job.providerVersion,
    status: job.status,
    attempt: job.attempt,
    queuedAt: job.queuedAt,
    ...(job.startedAt ? { startedAt: job.startedAt } : {}),
    ...(job.completedAt ? { completedAt: job.completedAt } : {}),
    ...(job.assessmentId ? { assessmentId: job.assessmentId } : {}),
    ...(job.failure ? { failure: { ...job.failure, ...(job.failure.attachmentDocumentIds ? { attachmentDocumentIds: [...job.failure.attachmentDocumentIds] } : {}) } } : {}),
  };
}

/*
 * IN-102: the one safe code and message a draft failure is recorded with, on the job and on its run alike, so the hub
 * and a count of failed runs agree. A failure with no safe code of its own (an unexpected error, a state change) is
 * DRAFT_GENERATION_FAILED; a safe message is one line of plain text, as the run record requires.
 */
export function safeAssessmentDraftFailure(error: unknown): AssessmentDraftJobFailureRecord {
  if (error instanceof AssessmentDraftJobFailure
    && /^[A-Z][A-Z0-9_]{0,63}$/.test(error.code)
    && nonBlank(error.safeMessage, 255)
    && !/[\r\n<>]/.test(error.safeMessage)) {
    // D-33: the included files, by documentId, at most as many as a request can hold (ATTACHMENT_LIMITS.maxActivePerRequest).
    const ids = error.attachmentDocumentIds;
    const attachmentDocumentIds = Array.isArray(ids) && ids.length <= 20 && ids.every((id) => nonBlank(id)) ? [...ids] : [];
    return { code: error.code, message: error.safeMessage, ...(attachmentDocumentIds.length ? { attachmentDocumentIds } : {}) };
  }
  return { code: "DRAFT_GENERATION_FAILED", message: "Assessment draft generation failed safely." };
}

export function createAssessmentDraftRegistry(options: RegistryOptions) {
  if (!options || typeof options.execute !== "function") throw new AssessmentDraftRegistryError(400, "Assessment draft registry configuration is invalid.");
  const now = options.now ?? (() => new Date());
  const createJobId = options.createJobId ?? (() => randomBytes(18).toString("base64url"));
  const maxTerminal = options.maxTerminal ?? ASSESSMENT_DRAFT_JOB_MAX_TERMINAL;
  const terminalTtlMs = options.terminalTtlMs ?? ASSESSMENT_DRAFT_JOB_TERMINAL_TTL_MS;
  if (!Number.isInteger(maxTerminal) || maxTerminal < 1 || !Number.isFinite(terminalTtlMs) || terminalTtlMs < 1) {
    throw new AssessmentDraftRegistryError(400, "Assessment draft registry configuration is invalid.");
  }

  const jobs = new Map<string, InternalJob>();
  const jobsByQuestionnaire = new Map<string, string>();
  const inFlight = new Map<string, Promise<void>>();
  let accessSequence = 0;

  function remove(job: InternalJob): void {
    jobs.delete(job.jobId);
    if (jobsByQuestionnaire.get(job.questionnaireId) === job.jobId) jobsByQuestionnaire.delete(job.questionnaireId);
  }

  function cleanup(): void {
    const currentTime = now().getTime();
    const terminal = [...jobs.values()].filter((job) => job.status === "completed" || job.status === "failed");
    for (const job of terminal) {
      const terminalTime = job.completedAt ? Date.parse(job.completedAt) : Number.NaN;
      if (Number.isFinite(terminalTime) && currentTime - terminalTime > terminalTtlMs) remove(job);
    }
    const retainedTerminal = [...jobs.values()]
      .filter((job) => job.status === "completed" || job.status === "failed")
      .sort((left, right) => left.lastAccess - right.lastAccess);
    while (retainedTerminal.length > maxTerminal) remove(retainedTerminal.shift() as InternalJob);
  }

  function authorized(job: Pick<AssessmentDraftJobRecord, "initiatingAnalystDocumentId">, actor: AssessmentDraftJobActor): boolean {
    if (!actor || !nonBlank(actor.documentId) || typeof actor.canReadAllDraftJobs !== "boolean") return false;
    return actor.documentId === job.initiatingAnalystDocumentId || actor.canReadAllDraftJobs;
  }

  function authorize(job: InternalJob, actor: AssessmentDraftJobActor): void {
    if (!authorized(job, actor)) throw new AssessmentDraftRegistryError(403, "Assessment draft job access is denied.");
  }

  /*
   * D-18: "the job failed and this viewer may retry it", the rule `retry` itself applies: the job failed, no draft
   * is running for its questionnaire, and the viewer passes `authorize` (the initiator, or any human Security
   * Analyst once the workflow passes the policy's humanAnalyst fact). It says nothing about who started the job.
   */
  function mayRetry(job: AssessmentDraftJobRecord, actor: AssessmentDraftJobActor): boolean {
    return job.status === "failed" && !inFlight.has(job.questionnaireId) && authorized(job, actor);
  }

  function launch(job: InternalJob): void {
    if (inFlight.has(job.questionnaireId)) return;
    const execution = Promise.resolve().then(async () => {
      job.status = "running";
      job.startedAt = now().toISOString();
      job.failure = undefined;
      job.assessmentId = undefined;
      try {
        const result = await options.execute({
          jobId: job.jobId,
          questionnaireId: job.questionnaireId,
          initiatingAnalystDocumentId: job.initiatingAnalystDocumentId,
          providerName: job.providerName,
          providerVersion: job.providerVersion,
          attempt: job.attempt,
        });
        if (!result || !nonBlank(result.assessmentId)) throw new Error("Invalid assessment draft execution result.");
        job.status = "completed";
        job.assessmentId = result.assessmentId;
      } catch (error) {
        job.status = "failed";
        job.failure = safeAssessmentDraftFailure(error);
      } finally {
        job.completedAt = now().toISOString();
        job.lastAccess = ++accessSequence;
        inFlight.delete(job.questionnaireId);
        cleanup();
      }
    });
    inFlight.set(job.questionnaireId, execution);
  }

  function enqueue(input: EnqueueInput): AssessmentDraftJobRecord {
    cleanup();
    if (!input || !nonBlank(input.questionnaireId) || !nonBlank(input.initiatingAnalystDocumentId)
      || !nonBlank(input.providerName) || !nonBlank(input.providerVersion)) {
      throw new AssessmentDraftRegistryError(400, "Assessment draft job request is invalid.");
    }
    const existingId = jobsByQuestionnaire.get(input.questionnaireId);
    if (existingId) {
      const existing = jobs.get(existingId);
      if (existing) {
        existing.lastAccess = ++accessSequence;
        return publicRecord(existing);
      }
    }
    const jobId = createJobId();
    if (!nonBlank(jobId) || jobs.has(jobId)) throw new AssessmentDraftRegistryError(409, "Assessment draft job could not be allocated.");
    const job: InternalJob = {
      jobId,
      questionnaireId: input.questionnaireId,
      initiatingAnalystDocumentId: input.initiatingAnalystDocumentId,
      providerName: input.providerName,
      providerVersion: input.providerVersion,
      status: "queued",
      attempt: 1,
      queuedAt: now().toISOString(),
      lastAccess: ++accessSequence,
    };
    jobs.set(jobId, job);
    jobsByQuestionnaire.set(job.questionnaireId, jobId);
    launch(job);
    return publicRecord(job);
  }

  function get(jobId: string, actor: AssessmentDraftJobActor): AssessmentDraftJobRecord {
    cleanup();
    const job = jobs.get(jobId);
    if (!job) throw new AssessmentDraftRegistryError(404, "Assessment draft job was not found.");
    authorize(job, actor);
    job.lastAccess = ++accessSequence;
    return publicRecord(job);
  }

  function retry(jobId: string, actor: AssessmentDraftJobActor): AssessmentDraftJobRecord {
    cleanup();
    const job = jobs.get(jobId);
    if (!job) throw new AssessmentDraftRegistryError(404, "Assessment draft job was not found.");
    authorize(job, actor);
    if (job.status !== "failed" || inFlight.has(job.questionnaireId)) {
      throw new AssessmentDraftRegistryError(409, "Only failed jobs can be retried.");
    }
    // D-18, G-3: a retry is the retrying analyst's attempt, so execute writes them as generatedBy and the run's initiatedBy.
    job.initiatingAnalystDocumentId = actor.documentId;
    job.status = "queued";
    job.attempt += 1;
    job.queuedAt = now().toISOString();
    job.startedAt = undefined;
    job.completedAt = undefined;
    job.failure = undefined;
    job.assessmentId = undefined;
    job.lastAccess = ++accessSequence;
    launch(job);
    return publicRecord(job);
  }

  /*
   * D-25: the questionnaire's current draft job for any analyst who may review
   * its request — the job the questionnaire is mapped to (active or retained),
   * else the retained job queued last. D-18: `canRetry` is `mayRetry` for this
   * viewer; who started the job is the projection's business. Like the
   * questionnaire registry's request read, it neither authorises nor touches
   * `lastAccess`.
   */
  function latestForQuestionnaire(questionnaireId: string, viewer: AssessmentDraftJobActor): { job: AssessmentDraftJobRecord; canRetry: boolean } | null {
    cleanup();
    if (!nonBlank(questionnaireId) || !viewer || !nonBlank(viewer.documentId)) return null;
    const mappedId = jobsByQuestionnaire.get(questionnaireId);
    let selected = mappedId ? jobs.get(mappedId) : undefined;
    if (!selected) {
      for (const job of jobs.values()) {
        if (job.questionnaireId === questionnaireId && (!selected || job.queuedAt >= selected.queuedAt)) selected = job;
      }
    }
    return selected ? { job: publicRecord(selected), canRetry: mayRetry(selected, viewer) } : null;
  }

  return { enqueue, get, retry, cleanup, latestForQuestionnaire, mayRetry };
}
