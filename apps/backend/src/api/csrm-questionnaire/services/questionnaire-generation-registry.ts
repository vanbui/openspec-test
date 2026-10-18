import { randomBytes } from "node:crypto";

export type QuestionnaireGenerationJobStatus = "queued" | "running" | "completed" | "failed";
/* Phase 14 D-33: a CONTEXT_TOO_LARGE failure keeps the files included when the context was refused, by documentId. */
export type QuestionnaireGenerationJobFailureRecord = { code: string; message: string; attachmentDocumentIds?: string[] };
export type QuestionnaireGenerationJobRecord = { jobId: string; requestId: string; initiatingAnalystDocumentId: string; providerName: string; providerVersion: string; replaceUnansweredQuestionnaire: boolean; instruction?: string | null; status: QuestionnaireGenerationJobStatus; attempt: number; queuedAt: string; startedAt?: string; completedAt?: string; questionnaireId?: string; failure?: QuestionnaireGenerationJobFailureRecord };
export type QuestionnaireGenerationJobActor = { documentId: string; canReadAllQuestionnaireGenerationJobs: boolean };
export class QuestionnaireGenerationRegistryError extends Error { constructor(public readonly status: 400 | 403 | 404 | 409, message: string) { super(message); } }
export class QuestionnaireGenerationJobFailure extends Error { constructor(public readonly code: string, public readonly safeMessage: string, public readonly attachmentDocumentIds: readonly string[] = []) { super(safeMessage); } }
type Job = QuestionnaireGenerationJobRecord & { lastAccess: number };
type Options = { execute: (job: Pick<QuestionnaireGenerationJobRecord, "jobId" | "requestId" | "initiatingAnalystDocumentId" | "providerName" | "providerVersion" | "replaceUnansweredQuestionnaire" | "instruction" | "attempt">) => Promise<{ questionnaireId: string }>; now?: () => Date; createJobId?: () => string; maxTerminal?: number; terminalTtlMs?: number };
const nonBlank = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 255;
const terminal = (status: QuestionnaireGenerationJobStatus) => status === "completed" || status === "failed";
/* At most the files a request can hold (ATTACHMENT_LIMITS.maxActivePerRequest), each a documentId. */
const failureAttachmentIds = (ids: readonly string[]): string[] => Array.isArray(ids) && ids.length <= 20 && ids.every((id) => nonBlank(id)) ? [...ids] : [];
const safeFailure = (error: unknown): QuestionnaireGenerationJobFailureRecord => {
  if (!(error instanceof QuestionnaireGenerationJobFailure) || !/^[A-Z][A-Z0-9_]{0,63}$/.test(error.code) || !nonBlank(error.safeMessage)) return { code: "QUESTIONNAIRE_GENERATION_FAILED", message: "Questionnaire generation failed safely." };
  const attachmentDocumentIds = failureAttachmentIds(error.attachmentDocumentIds);
  return { code: error.code, message: error.safeMessage, ...(attachmentDocumentIds.length ? { attachmentDocumentIds } : {}) };
};
const copyFailure = (failure: QuestionnaireGenerationJobFailureRecord): QuestionnaireGenerationJobFailureRecord => ({ ...failure, ...(failure.attachmentDocumentIds ? { attachmentDocumentIds: [...failure.attachmentDocumentIds] } : {}) });
export function createQuestionnaireGenerationRegistry(options: Options) {
  if (!options || typeof options.execute !== "function") throw new QuestionnaireGenerationRegistryError(400, "Questionnaire generation registry configuration is invalid.");
  const now = options.now ?? (() => new Date()); const createJobId = options.createJobId ?? (() => randomBytes(18).toString("base64url")); const maxTerminal = options.maxTerminal ?? 500; const terminalTtlMs = options.terminalTtlMs ?? 3600000;
  const jobs = new Map<string, Job>(); const activeByRequest = new Map<string, string>(); const inFlight = new Map<string, Promise<void>>(); let sequence = 0;
  const publicJob = (job: Job): QuestionnaireGenerationJobRecord => ({ ...job, ...(job.failure ? { failure: copyFailure(job.failure) } : {}) });
  const remove = (job: Job) => { jobs.delete(job.jobId); if (activeByRequest.get(job.requestId) === job.jobId) activeByRequest.delete(job.requestId); };
  const cleanup = () => { const current = now().getTime(); for (const job of jobs.values()) if (terminal(job.status) && job.completedAt && current - Date.parse(job.completedAt) > terminalTtlMs) remove(job); const retained = [...jobs.values()].filter((job) => terminal(job.status)).sort((a, b) => a.lastAccess - b.lastAccess); while (retained.length > maxTerminal) remove(retained.shift() as Job); };
  const authorized = (job: Pick<QuestionnaireGenerationJobRecord, "initiatingAnalystDocumentId">, actor: QuestionnaireGenerationJobActor) => Boolean(actor) && nonBlank(actor.documentId) && typeof actor.canReadAllQuestionnaireGenerationJobs === "boolean" && (actor.documentId === job.initiatingAnalystDocumentId || actor.canReadAllQuestionnaireGenerationJobs);
  const authorize = (job: Job, actor: QuestionnaireGenerationJobActor) => { if (!authorized(job, actor)) throw new QuestionnaireGenerationRegistryError(403, "Questionnaire generation job access is denied."); };
  /*
   * D-18: "the job failed and this viewer may retry it", the rule `retry` itself applies: the job failed, nothing else
   * is generating for its request, and the viewer passes `authorize` (the initiator, or any human Security Analyst
   * once the workflow passes the policy's humanAnalyst fact). It says nothing about who started the job.
   */
  const mayRetry = (job: QuestionnaireGenerationJobRecord, actor: QuestionnaireGenerationJobActor): boolean => job.status === "failed" && !activeByRequest.has(job.requestId) && authorized(job, actor);
  const launch = (job: Job) => { if (inFlight.has(job.requestId)) return; const execution = Promise.resolve().then(async () => { job.status = "running"; job.startedAt = now().toISOString(); job.failure = undefined; try { const result = await options.execute(job); if (!result || !nonBlank(result.questionnaireId)) throw new Error(); job.status = "completed"; job.questionnaireId = result.questionnaireId; } catch (error) { job.status = "failed"; job.failure = safeFailure(error); } finally { job.completedAt = now().toISOString(); job.lastAccess = ++sequence; activeByRequest.delete(job.requestId); inFlight.delete(job.requestId); cleanup(); } }); inFlight.set(job.requestId, execution); };
  const enqueue = (input: Pick<QuestionnaireGenerationJobRecord, "requestId" | "initiatingAnalystDocumentId" | "providerName" | "providerVersion" | "replaceUnansweredQuestionnaire" | "instruction">) => { cleanup(); if (!input || !nonBlank(input.requestId) || !nonBlank(input.initiatingAnalystDocumentId) || !nonBlank(input.providerName) || !nonBlank(input.providerVersion) || typeof input.replaceUnansweredQuestionnaire !== "boolean") throw new QuestionnaireGenerationRegistryError(400, "Questionnaire generation job request is invalid."); const existing = activeByRequest.get(input.requestId); if (existing) { const job = jobs.get(existing); if (job) return publicJob(job); } const jobId = createJobId(); if (!nonBlank(jobId) || jobs.has(jobId)) throw new QuestionnaireGenerationRegistryError(409, "Questionnaire generation job could not be allocated."); const job: Job = { ...input, jobId, status: "queued", attempt: 1, queuedAt: now().toISOString(), lastAccess: ++sequence }; jobs.set(jobId, job); activeByRequest.set(job.requestId, jobId); launch(job); return publicJob(job); };
  const get = (jobId: string, actor: QuestionnaireGenerationJobActor) => { cleanup(); const job = jobs.get(jobId); if (!job) throw new QuestionnaireGenerationRegistryError(404, "Questionnaire generation job was not found."); authorize(job, actor); job.lastAccess = ++sequence; return publicJob(job); };
  const retry = (jobId: string, actor: QuestionnaireGenerationJobActor) => { const job = jobs.get(jobId); if (!job) throw new QuestionnaireGenerationRegistryError(404, "Questionnaire generation job was not found."); authorize(job, actor); if (job.status !== "failed" || activeByRequest.has(job.requestId)) throw new QuestionnaireGenerationRegistryError(409, "Only failed jobs can be retried."); /* D-18, G-3: a retry is the retrying analyst's attempt, so execute writes them as generatedBy and the run's initiatedBy. */ job.initiatingAnalystDocumentId = actor.documentId; job.status = "queued"; job.attempt += 1; job.queuedAt = now().toISOString(); job.startedAt = undefined; job.completedAt = undefined; job.failure = undefined; job.questionnaireId = undefined; job.lastAccess = ++sequence; activeByRequest.set(job.requestId, jobId); launch(job); return publicJob(job); };
  // This is intentionally process-local. It is a transient operational hint,
  // never an authorisation input or a persisted workflow fact. The review
  // queues read the snapshot below as a bound id-set predicate, so the
  // generation-in-progress queue is exact for one Strapi process only; a
  // multi-process deployment needs a shared job store (a Phase 8 concern).
  const hasActiveJob = (requestId: string): boolean => activeByRequest.has(requestId);
  /** A sorted copy of the request ids with a queued or running job. */
  const activeRequestIds = (): readonly string[] => [...activeByRequest.keys()].sort();
  /*
   * D-25: the request's current job for any analyst who may review it — the
   * active job, else the retained terminal job queued last (a tie keeps the job
   * registered last). D-18: `canRetry` is `mayRetry` for this viewer, so it is
   * true only for a failed job the viewer passes `authorize` for; who started the
   * job is the projection's business (`initiatedBy`, `initiatedByViewer`). The
   * route's grant and human-analyst guard decide who reads this at all, and this
   * read neither authorises nor touches `lastAccess`, so a status poll never
   * keeps a job retained.
   */
  const latestForRequest = (requestId: string, viewer: QuestionnaireGenerationJobActor): { job: QuestionnaireGenerationJobRecord; canRetry: boolean } | null => {
    cleanup();
    if (!nonBlank(requestId) || !viewer || !nonBlank(viewer.documentId)) return null;
    const activeJobId = activeByRequest.get(requestId);
    let selected = activeJobId ? jobs.get(activeJobId) : undefined;
    if (!selected) {
      for (const job of jobs.values()) {
        if (job.requestId === requestId && terminal(job.status) && (!selected || job.queuedAt >= selected.queuedAt)) selected = job;
      }
    }
    return selected ? { job: publicJob(selected), canRetry: mayRetry(selected, viewer) } : null;
  };
  return { enqueue, get, retry, cleanup, hasActiveJob, activeRequestIds, latestForRequest, mayRetry };
}
