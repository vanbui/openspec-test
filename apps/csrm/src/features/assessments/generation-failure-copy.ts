/*
 * What a generation start, retry or status check that failed for a reason other than a refusal tells the analyst
 * (WR-205; D-22). Each sentence names the record the operation acts on: the request for questionnaire generation
 * and the request's jobs read, the questionnaire for an assessment draft, or the generation itself for a job read or
 * retry that finds no job. None names an assessment, which may not exist yet. A refusal (409) reads its family in
 * refusal-copy.ts instead.
 *
 * Plain and zod-free, so the Server Actions and the generation cards share it: a card whose Server Action throws
 * reads the operation's unavailable sentence through `settleGenerationAction` (WR-203).
 */

/** The generation operations a card runs. */
export type GenerationOperation = 'questionnaireGeneration' | 'assessmentDraft' | 'generationJobs';

/** What the operation acts on: its record (the request or the questionnaire), or a job named by id. */
export type GenerationSubject = 'record' | 'job';

type GenerationFailureCopy = {
  readonly forbidden: string;
  readonly recordMissing: string;
  readonly jobMissing: string;
  readonly unavailable: string;
};

const generationFailureCopy: Readonly<Record<GenerationOperation, GenerationFailureCopy>> = {
  questionnaireGeneration: {
    forbidden: 'You do not have permission to generate a questionnaire for this request.',
    recordMissing: 'This request is no longer available.',
    jobMissing: 'This questionnaire generation is no longer available.',
    unavailable: 'The questionnaire generation service is unavailable. Please try again later.',
  },
  assessmentDraft: {
    forbidden: 'You do not have permission to generate an assessment draft for this questionnaire.',
    recordMissing: 'This questionnaire is no longer available.',
    jobMissing: 'This draft generation is no longer available.',
    unavailable: 'The assessment service is unavailable. Please try again later.',
  },
  generationJobs: {
    forbidden: 'You do not have permission to check generation for this request.',
    recordMissing: 'This request is no longer available.',
    jobMissing: 'This request is no longer available.',
    unavailable: 'The request service is unavailable. Please try again later.',
  },
};

/** The sentence for a failed generation operation's status: a refusal of access, a missing record or job, or any other failure. */
export function generationFailureMessage(operation: GenerationOperation, status: number | undefined, subject: GenerationSubject = 'record'): string {
  const copy = generationFailureCopy[operation];
  if (status === 403) return copy.forbidden;
  if (status === 404) return subject === 'job' ? copy.jobMissing : copy.recordMissing;
  return copy.unavailable;
}

/** The sentence for an operation whose Server Action could not be reached or did not answer (WR-203). */
export function generationUnavailableMessage(operation: GenerationOperation): string {
  return generationFailureCopy[operation].unavailable;
}

type GenerationActionResult = { ok: true; data: unknown } | { ok: false; formError: string };

/**
 * Runs a generation Server Action and always settles with a result (WR-203). A call that throws or rejects (a
 * network failure, a deployment that no longer knows the action, a server crash) reads as the operation's
 * unavailable sentence, so a card never stays pending and a rejected status check is never unhandled.
 */
export async function settleGenerationAction<R extends GenerationActionResult>(
  operation: GenerationOperation,
  run: () => Promise<R>,
): Promise<R | { ok: false; formError: string }> {
  try {
    return await run();
  } catch {
    return { ok: false, formError: generationUnavailableMessage(operation) };
  }
}
