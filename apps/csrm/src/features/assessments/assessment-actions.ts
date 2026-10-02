'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';
import type { RelationPickerItem } from '@/components/csrm/relation-picker';
import { listAdministrationControls } from '@/features/administration/administration-service';
import { parseAdministrationQuery } from '@/features/administration/administration-schema';
import type { ConflictReason } from '@/lib/api/conflict-reasons';
import { refusalMessage } from '@/lib/api/refusal-copy';
import { generationFailureMessage, type GenerationOperation, type GenerationSubject } from './generation-failure-copy';

import {
  createControlImplementation,
  createRisk,
  deleteControlImplementation,
  getAssessmentDraftJob,
  getAnalystAssessment,
  releaseAssessment,
  searchActiveUsers,
  retryAssessmentDraftJob,
  getQuestionnaireGenerationJob,
  getRequestGenerationJobs,
  retryQuestionnaireGenerationJob,
  startQuestionnaireGeneration,
  startAssessmentDraft,
  updateAssessment,
  updateControlImplementation,
  updateRisk,
} from './assessment-service';

import {
  assessmentUpdateInputSchema,
  controlImplementationCreateInputSchema,
  controlImplementationUpdateInputSchema,
  documentIdSchema,
  riskCreateInputSchema,
  riskUpdateInputSchema,
  type AssessmentDetail,
  type AnalystAssessmentDetail,
  type AssessmentDraftJob,
  type QuestionnaireGenerationJob,
  type RequestGenerationJobs,
  type ActiveUser,
  type ControlImplementation,
  type ReleasedAssessmentDetail,
  type Risk,
} from './assessment-schema';
import { controlPickerItem } from './control-label';

export type AssessmentServerActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      values?: Record<string, unknown>;
      fieldErrors?: Record<string, string[]>;
      formError: string;
      /** The closed-list rule a refused workflow action named; never Strapi's message (T-10-17). */
      reason?: ConflictReason;
    };

const questionnaireIdInputSchema = z.object({ questionnaireId: documentIdSchema }).strict();
const jobIdInputSchema = z.object({ jobId: documentIdSchema }).strict();
const requestIdInputSchema = z.object({ requestId: documentIdSchema }).strict();
const questionnaireGenerationInputSchema = z.object({
  requestId: documentIdSchema,
  replaceUnansweredQuestionnaire: z.boolean(),
}).strict();
const assessmentInputSchema = z.object({
  assessmentId: documentIdSchema,
  values: assessmentUpdateInputSchema,
}).strict();
const createRiskInputSchema = z.object({
  assessmentId: documentIdSchema,
  values: riskCreateInputSchema,
}).strict();
const updateRiskInputSchema = z.object({
  assessmentId: documentIdSchema,
  riskId: documentIdSchema,
  values: riskUpdateInputSchema,
}).strict();
const createControlImplementationInputSchema = z.object({
  assessmentId: documentIdSchema,
  riskId: documentIdSchema,
  values: controlImplementationCreateInputSchema,
}).strict();
const updateControlImplementationInputSchema = z.object({
  assessmentId: documentIdSchema,
  implementationId: documentIdSchema,
  values: controlImplementationUpdateInputSchema,
}).strict();
const deleteControlImplementationInputSchema = z.object({
  assessmentId: documentIdSchema,
  implementationId: documentIdSchema,
}).strict();
const releaseInputSchema = z.object({ assessmentId: documentIdSchema }).strict();
const activeUserSearchInputSchema = z.object({
  search: z.string().trim().min(1).max(100),
}).strict();
/* The Control picker's search: the Administration list's own 200-character bound on its query. */
const controlSearchInputSchema = z.object({
  search: z.string().trim().min(1).max(200),
}).strict();
/** One bounded page per search; a full page tells the analyst to keep typing (UI-SPEC §13.1). */
const controlSearchPageSize = 10;

function submittedValues(input: unknown): Record<string, unknown> | undefined {
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return undefined;
  const values = (input as { values?: unknown }).values;
  return typeof values === 'object' && values !== null && !Array.isArray(values)
    ? values as Record<string, unknown>
    : undefined;
}

function validationFailure(error: z.ZodError, input: unknown): AssessmentServerActionResult<never> {
  const fieldErrors: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const path = issue.path[0] === 'values' ? issue.path.slice(1) : issue.path;
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) {
        fieldErrors[key] = [...(fieldErrors[key] ?? []), `Unrecognized field: ${key}`];
      }
      continue;
    }
    if (path.length > 0) {
      const key = path.join('.');
      fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message];
    }
  }

  return {
    ok: false,
    ...(submittedValues(input) ? { values: submittedValues(input) } : {}),
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    formError: 'Check the assessment details and try again.',
  };
}

function serviceFailure(
  status: number | undefined,
  values?: Record<string, unknown>,
  release = false,
): AssessmentServerActionResult<never> {
  let formError: string;
  if (status === 400) formError = 'The submitted assessment data is invalid. Check the fields and try again.';
  else if (status === 403) formError = 'You do not have permission to change this assessment.';
  else if (status === 404) formError = 'This assessment is no longer available.';
  else if (status === 409 && release) formError = 'This assessment changed or is not ready for release. Reload and try again.';
  else if (status === 409) formError = 'This assessment changed. Reload and try again.';
  else formError = 'The assessment service is unavailable. Please try again later.';

  return { ok: false, ...(values ? { values } : {}), formError };
}

/**
 * A failed questionnaire generation or assessment draft, start or retry (WR-205). A 409 reads the operation's
 * refusal family for the served reason (UI-SPEC §10.2 I for questionnaire generation) and returns it; any other
 * status names the request, the questionnaire or the generation, never an assessment that may not exist.
 */
function generationFailure(
  operation: 'questionnaireGeneration' | 'assessmentDraft',
  error: { status?: number; reason?: ConflictReason },
  subject: GenerationSubject,
): AssessmentServerActionResult<never> {
  if (error.status !== 409) return generationReadFailure(operation, error.status, subject);
  return { ok: false, formError: refusalMessage(operation, error.reason), ...(error.reason ? { reason: error.reason } : {}) };
}

/** A generation status check that failed: worded about what it reads (WR-205). */
function generationReadFailure(operation: GenerationOperation, status: number | undefined, subject: GenerationSubject): AssessmentServerActionResult<never> {
  return { ok: false, formError: generationFailureMessage(operation, status, subject) };
}

function revalidateJobStart(questionnaireId: string): void {
  revalidatePath('/app/review/requests');
  revalidatePath(`/app/review/questionnaires/${encodeURIComponent(questionnaireId)}`);
  revalidatePath('/app/review/assessments');
}

function revalidateJobRetry(): void {
  revalidatePath('/app/review/requests');
  revalidatePath('/app/review/assessments');
}

function revalidateAssessmentPages(assessmentId: string): void {
  const encodedId = encodeURIComponent(assessmentId);
  revalidatePath('/app');
  revalidatePath('/app/assessments');
  revalidatePath(`/app/assessments/${encodedId}`);
  revalidatePath('/app/review/requests');
  revalidatePath('/app/review/assessments');
  revalidatePath(`/app/review/assessments/${encodedId}`);
}

export async function startAssessmentDraftAction(input: unknown): Promise<AssessmentServerActionResult<AssessmentDraftJob>> {
  const parsed = questionnaireIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await startAssessmentDraft(parsed.data.questionnaireId);
  if (result.error) return generationFailure('assessmentDraft', result.error, 'record');
  revalidateJobStart(parsed.data.questionnaireId);
  return { ok: true, data: result.data };
}

export async function getAssessmentDraftJobAction(input: unknown): Promise<AssessmentServerActionResult<AssessmentDraftJob>> {
  const parsed = jobIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await getAssessmentDraftJob(parsed.data.jobId);
  if (result.error) return generationReadFailure('assessmentDraft', result.error.status, 'job');
  return { ok: true, data: result.data };
}

/** Returns the authoritative analyst projection after a mutation changes release facts. */
export async function refreshAnalystAssessmentAction(input: unknown): Promise<AssessmentServerActionResult<AnalystAssessmentDetail>> {
  const parsed = z.object({ assessmentId: documentIdSchema }).strict().safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await getAnalystAssessment(parsed.data.assessmentId);
  if (result.error) return serviceFailure(result.error.status);
  return { ok: true, data: result.data };
}

export async function retryAssessmentDraftJobAction(input: unknown): Promise<AssessmentServerActionResult<AssessmentDraftJob>> {
  const parsed = jobIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await retryAssessmentDraftJob(parsed.data.jobId);
  if (result.error) return generationFailure('assessmentDraft', result.error, 'job');
  revalidateJobRetry();
  return { ok: true, data: result.data };
}

function revalidateQuestionnaireGeneration(requestId: string, questionnaireId?: string): void {
  revalidatePath('/app/review/requests');
  revalidatePath(`/app/review/requests/${encodeURIComponent(requestId)}`);
  if (questionnaireId) revalidatePath(`/app/review/questionnaires/${encodeURIComponent(questionnaireId)}`);
}

export async function startQuestionnaireGenerationAction(input: unknown): Promise<AssessmentServerActionResult<QuestionnaireGenerationJob>> {
  const parsed = questionnaireGenerationInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await startQuestionnaireGeneration(parsed.data.requestId, parsed.data.replaceUnansweredQuestionnaire);
  if (result.error) return generationFailure('questionnaireGeneration', result.error, 'record');
  revalidateQuestionnaireGeneration(parsed.data.requestId, result.data.status === 'completed' ? result.data.questionnaire.documentId : undefined);
  return { ok: true, data: result.data };
}

export async function getQuestionnaireGenerationJobAction(input: unknown): Promise<AssessmentServerActionResult<QuestionnaireGenerationJob>> {
  const parsed = jobIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await getQuestionnaireGenerationJob(parsed.data.jobId);
  if (result.error) return generationReadFailure('questionnaireGeneration', result.error.status, 'job');
  return { ok: true, data: result.data };
}

/**
 * D-25, D-26: polls a request's current generation jobs for the analyst hub,
 * including jobs another analyst started. It only reads, so nothing is
 * revalidated; Strapi decides who may read and who may retry.
 */
export async function getRequestGenerationJobsAction(input: unknown): Promise<AssessmentServerActionResult<RequestGenerationJobs>> {
  const parsed = requestIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await getRequestGenerationJobs(parsed.data.requestId);
  if (result.error) return generationReadFailure('generationJobs', result.error.status, 'record');
  return { ok: true, data: result.data };
}

export async function retryQuestionnaireGenerationJobAction(input: unknown): Promise<AssessmentServerActionResult<QuestionnaireGenerationJob>> {
  const parsed = jobIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await retryQuestionnaireGenerationJob(parsed.data.jobId);
  if (result.error) return generationFailure('questionnaireGeneration', result.error, 'job');
  revalidateQuestionnaireGeneration(result.data.requestId);
  return { ok: true, data: result.data };
}

export async function searchActiveUsersAction(input: unknown): Promise<AssessmentServerActionResult<readonly ActiveUser[]>> {
  const parsed = activeUserSearchInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await searchActiveUsers(parsed.data.search);
  if (result.error) return serviceFailure(result.error.status);
  return { ok: true, data: result.data };
}

/**
 * Searches the whole control library for the Control picker by number, name or framework (D-29), one page of
 * 10 through the Administration control search under the analyst's existing grant. Strapi enforces that grant;
 * a refusal reads as the request selector's permission message and returns no data (T-10-48).
 */
export async function searchControlsAction(input: unknown): Promise<AssessmentServerActionResult<readonly RelationPickerItem[]>> {
  const parsed = controlSearchInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await listAdministrationControls(parseAdministrationQuery('controls', {
    q: parsed.data.search,
    page: 1,
    pageSize: controlSearchPageSize,
  }));
  if (result.error || !result.data) {
    return {
      ok: false,
      formError: result.error?.status === 403
        ? 'You do not have permission to search these records.'
        : 'The selection service is unavailable. Please try again later.',
    };
  }
  return {
    ok: true,
    data: result.data.data.flatMap((record) => 'controlNumber' in record ? [controlPickerItem(record)] : []),
  };
}

export async function saveAssessmentAction(input: unknown): Promise<AssessmentServerActionResult<AssessmentDetail>> {
  const parsed = assessmentInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await updateAssessment(parsed.data.assessmentId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateAssessmentPages(parsed.data.assessmentId);
  return { ok: true, data: result.data };
}

export async function createRiskAction(input: unknown): Promise<AssessmentServerActionResult<Risk>> {
  const parsed = createRiskInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await createRisk(parsed.data.assessmentId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateAssessmentPages(parsed.data.assessmentId);
  return { ok: true, data: result.data };
}

export async function updateRiskAction(input: unknown): Promise<AssessmentServerActionResult<Risk>> {
  const parsed = updateRiskInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await updateRisk(parsed.data.riskId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateAssessmentPages(parsed.data.assessmentId);
  return { ok: true, data: result.data };
}

export async function createControlImplementationAction(input: unknown): Promise<AssessmentServerActionResult<ControlImplementation>> {
  const parsed = createControlImplementationInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await createControlImplementation(parsed.data.riskId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateAssessmentPages(parsed.data.assessmentId);
  return { ok: true, data: result.data };
}

export async function updateControlImplementationAction(input: unknown): Promise<AssessmentServerActionResult<ControlImplementation>> {
  const parsed = updateControlImplementationInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await updateControlImplementation(parsed.data.implementationId, parsed.data.values);
  if (result.error) return serviceFailure(result.error.status, parsed.data.values);
  revalidateAssessmentPages(parsed.data.assessmentId);
  return { ok: true, data: result.data };
}

export async function deleteControlImplementationAction(input: unknown): Promise<AssessmentServerActionResult<void>> {
  const parsed = deleteControlImplementationInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await deleteControlImplementation(parsed.data.implementationId);
  if (result.error) return serviceFailure(result.error.status);
  revalidateAssessmentPages(parsed.data.assessmentId);
  return { ok: true, data: undefined };
}

export async function releaseAssessmentAction(input: unknown): Promise<AssessmentServerActionResult<ReleasedAssessmentDetail>> {
  const parsed = releaseInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await releaseAssessment(parsed.data.assessmentId);
  if (result.error) return serviceFailure(result.error.status, undefined, true);
  revalidateAssessmentPages(parsed.data.assessmentId);
  return { ok: true, data: result.data };
}
