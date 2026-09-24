'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

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
  type ActiveUser,
  type ControlImplementation,
  type ReleasedAssessmentDetail,
  type Risk,
} from './assessment-schema';

export type AssessmentServerActionResult<T> =
  | { ok: true; data: T }
  | {
      ok: false;
      values?: Record<string, unknown>;
      fieldErrors?: Record<string, string[]>;
      formError: string;
    };

const questionnaireIdInputSchema = z.object({ questionnaireId: documentIdSchema }).strict();
const jobIdInputSchema = z.object({ jobId: documentIdSchema }).strict();
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
  if (result.error) return serviceFailure(result.error.status);
  revalidateJobStart(parsed.data.questionnaireId);
  return { ok: true, data: result.data };
}

export async function getAssessmentDraftJobAction(input: unknown): Promise<AssessmentServerActionResult<AssessmentDraftJob>> {
  const parsed = jobIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await getAssessmentDraftJob(parsed.data.jobId);
  if (result.error) return serviceFailure(result.error.status);
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
  if (result.error) return serviceFailure(result.error.status);
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
  if (result.error) return serviceFailure(result.error.status);
  revalidateQuestionnaireGeneration(parsed.data.requestId, result.data.status === 'completed' ? result.data.questionnaire.documentId : undefined);
  return { ok: true, data: result.data };
}

export async function getQuestionnaireGenerationJobAction(input: unknown): Promise<AssessmentServerActionResult<QuestionnaireGenerationJob>> {
  const parsed = jobIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await getQuestionnaireGenerationJob(parsed.data.jobId);
  if (result.error) return serviceFailure(result.error.status);
  return { ok: true, data: result.data };
}

export async function retryQuestionnaireGenerationJobAction(input: unknown): Promise<AssessmentServerActionResult<QuestionnaireGenerationJob>> {
  const parsed = jobIdInputSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await retryQuestionnaireGenerationJob(parsed.data.jobId);
  if (result.error) return serviceFailure(result.error.status);
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
