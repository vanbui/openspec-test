'use server';

import { revalidatePath } from 'next/cache';
import { revertReasonSchema } from '@/lib/schemas/revert-reason';
import { z } from 'zod';
import {
  saveQuestionnaireDraft,
  revertQuestionnaireToDraft,
  submitQuestionnaire,
  releaseQuestionnaire,
  returnQuestionnaireToAnalystReview,
  addQuestionnaireQuestion,
  editQuestionnaireQuestion,
  deleteQuestionnaireQuestion,
  type QuestionnaireGovernanceResult,
  type QuestionnaireQuestionMutationInput,
  type QuestionnaireMutationResult,
  type QuestionnaireRevertResult,
  type QuestionnaireSummary,
} from './questionnaire-service';

import {
  questionnaireAnswerInputSchema,
  type QuestionnaireAnswerInput,
} from './questionnaire-schema';

const questionnaireActionSchema = z.object({
  documentId: z.string().trim().min(1).max(255),
  answers: z.array(questionnaireAnswerInputSchema).max(10_000),
});
const questionnaireRevertSchema = z.object({ documentId: z.string().trim().min(1).max(255), reason: revertReasonSchema }).strip();
const governanceDocumentSchema = z.object({ documentId: z.string().trim().min(1).max(255) }).strict();
const governanceQuestionSchema = z.object({ documentId: z.string().trim().min(1).max(255), questionId: z.string().trim().min(1).max(255), input: z.object({
  questionText: z.string().trim().min(1).max(65_535).optional(), answerType: z.enum(['Text', 'Long text', 'Boolean', 'Single select', 'Multi select', 'Date']).optional(), helpText: z.string().trim().max(2_000).nullable().optional(), required: z.boolean().optional(),
  section: z.object({ key: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(255), description: z.string().trim().min(1).max(2_000).optional(), order: z.number().int().nonnegative() }).strict().optional(), order: z.number().int().nonnegative().optional(),
  choices: z.array(z.object({ value: z.string().trim().min(1).max(255), label: z.string().trim().min(1).max(255) }).strict()).min(1).max(1_000).optional(), visibility: z.object({ questionKey: z.string().trim().min(1).max(120), operator: z.enum(['equals', 'notEquals', 'includes', 'notIncludes']), value: z.union([z.string().max(65_535), z.boolean()]) }).strict().nullable().optional(),
}).strict() }).strict();
const addGovernanceQuestionSchema = governanceQuestionSchema.omit({ questionId: true }).refine(({ input }) => input.questionText !== undefined && input.answerType !== undefined && input.required !== undefined && input.section !== undefined && input.order !== undefined, 'Question details are incomplete.');

export interface QuestionnaireActionValues {
  documentId: string;
  answers: QuestionnaireAnswerInput[];
}

export type QuestionnaireActionResult =
  | { ok: true; data: QuestionnaireMutationResult }
  | {
      ok: false;
      values?: QuestionnaireActionValues;
      fieldErrors?: Record<string, string[] | undefined>;
      formError?: string;
    };

function validationFailure(error: z.ZodError, input: unknown): QuestionnaireActionResult {
  const answers = typeof input === 'object' && input !== null && Array.isArray((input as { answers?: unknown }).answers)
    ? (input as { answers: unknown[] }).answers
    : [];
  const fieldErrors: Record<string, string[]> = {};
  const formMessages: string[] = [];

  for (const issue of error.issues) {
    const [root, index] = issue.path;
    const answer = root === 'answers' && typeof index === 'number' ? answers[index] : undefined;
    const questionKey = typeof answer === 'object' && answer !== null && typeof (answer as { questionKey?: unknown }).questionKey === 'string'
      ? (answer as { questionKey: string }).questionKey
      : null;
    if (questionKey) {
      const path = `answers.${questionKey}`;
      fieldErrors[path] = [...(fieldErrors[path] ?? []), issue.message];
    } else {
      formMessages.push(issue.message);
    }
  }

  return {
    ok: false,
    ...(Object.keys(fieldErrors).length > 0 ? { fieldErrors } : {}),
    ...(formMessages.length > 0 ? { formError: 'Check the questionnaire details and try again.' } : {}),
  };
}

function serviceFailure(values: QuestionnaireActionValues, status?: number): QuestionnaireActionResult {
  if (status === 400) {
    return { ok: false, values, formError: 'The questionnaire answers are invalid. Check the fields and try again.' };
  }
  if (status === 403) {
    return { ok: false, values, formError: 'You do not have permission to save this questionnaire.' };
  }
  if (status === 404) {
    return { ok: false, values, formError: 'This questionnaire is no longer available.' };
  }
  if (status === 409) {
    return { ok: false, values, formError: 'This questionnaire changed or is no longer answerable. Reload and try again.' };
  }
  return { ok: false, values, formError: 'The questionnaire service is unavailable. Please try again later.' };
}

function revalidateQuestionnairePages(documentId: string, includeReview: boolean): void {
  const encodedId = encodeURIComponent(documentId);
  revalidatePath('/app');
  revalidatePath('/app/questionnaires');
  revalidatePath(`/app/questionnaires/${encodedId}`);
  if (includeReview) revalidatePath(`/app/review/questionnaires/${encodedId}`);
}

function revalidateQuestionnaireReversalPages(documentId: string): void {
  revalidateQuestionnairePages(documentId, true);
  revalidatePath('/app/review/questionnaires');
  revalidatePath('/app/review/requests');
  revalidatePath('/app/requests');
}

export type QuestionnaireRevertActionResult = QuestionnaireActionResult | { ok: true; data: QuestionnaireRevertResult };
export type QuestionnaireGovernanceActionResult = { ok: true; data: QuestionnaireGovernanceResult | QuestionnaireSummary } | { ok: false; formError: string };

function governanceFailure(status?: number, release = false): QuestionnaireGovernanceActionResult {
  if (status === 403) return { ok: false, formError: 'You do not have permission to govern this questionnaire.' };
  if (status === 404) return { ok: false, formError: 'This questionnaire is no longer available.' };
  if (status === 409) return { ok: false, formError: release ? 'This questionnaire is already released or is no longer eligible. Reload and try again.' : 'This questionnaire changed or cannot be governed in its current state. Reload and try again.' };
  if (status === 400) return { ok: false, formError: 'The questionnaire details are invalid. Check the fields and try again.' };
  return { ok: false, formError: 'The questionnaire service is unavailable. Please try again later.' };
}

function governanceValidation(error: z.ZodError): QuestionnaireGovernanceActionResult { return { ok: false, formError: error.issues[0]?.message ?? 'Check the questionnaire details and try again.' }; }

export async function releaseQuestionnaireAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> {
  const parsed = governanceDocumentSchema.safeParse(input); if (!parsed.success) return governanceValidation(parsed.error);
  const result = await releaseQuestionnaire(parsed.data.documentId); if (result.error) return governanceFailure(result.error.status, true);
  revalidateQuestionnaireReversalPages(result.data.documentId); return { ok: true, data: result.data };
}

export async function returnQuestionnaireToAnalystReviewAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> {
  const parsed = questionnaireRevertSchema.safeParse(input); if (!parsed.success) return governanceValidation(parsed.error);
  const result = await returnQuestionnaireToAnalystReview(parsed.data.documentId, parsed.data.reason); if (result.error) return governanceFailure(result.error.status);
  revalidateQuestionnaireReversalPages(result.data.documentId); return { ok: true, data: result.data };
}

async function questionAction(input: unknown, kind: 'add' | 'edit' | 'delete'): Promise<QuestionnaireGovernanceActionResult> {
  if (kind === 'delete') {
    const parsed = z.object({ documentId: z.string().trim().min(1).max(255), questionId: z.string().trim().min(1).max(255) }).strict().safeParse(input); if (!parsed.success) return governanceValidation(parsed.error);
    const result = await deleteQuestionnaireQuestion(parsed.data.documentId, parsed.data.questionId); if (result.error) return governanceFailure(result.error.status); revalidateQuestionnaireReversalPages(result.data.documentId); return { ok: true, data: result.data };
  }
  const parsed = (kind === 'add' ? addGovernanceQuestionSchema : governanceQuestionSchema).safeParse(input); if (!parsed.success) return governanceValidation(parsed.error);
  const value = parsed.data as { documentId: string; questionId?: string; input: QuestionnaireQuestionMutationInput };
  const result = kind === 'add' ? await addQuestionnaireQuestion(value.documentId, value.input) : await editQuestionnaireQuestion(value.documentId, value.questionId as string, value.input);
  if (result.error) return governanceFailure(result.error.status); revalidateQuestionnaireReversalPages(result.data.documentId); return { ok: true, data: result.data };
}

export async function addQuestionnaireQuestionAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> { return questionAction(input, 'add'); }
export async function editQuestionnaireQuestionAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> { return questionAction(input, 'edit'); }
export async function deleteQuestionnaireQuestionAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> { return questionAction(input, 'delete'); }

export async function revertQuestionnaireToDraftAction(input: unknown): Promise<QuestionnaireRevertActionResult> {
  const parsed = questionnaireRevertSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await revertQuestionnaireToDraft(parsed.data.documentId, parsed.data.reason);
  if (result.error !== null) return serviceFailure({ documentId: parsed.data.documentId, answers: [] }, result.error.status);
  revalidateQuestionnaireReversalPages(result.data.questionnaireId);
  return { ok: true, data: result.data };
}

export async function saveQuestionnaireDraftAction(input: unknown): Promise<QuestionnaireActionResult> {
  const parsed = questionnaireActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);

  const result = await saveQuestionnaireDraft(parsed.data.documentId, parsed.data.answers);
  if (result.error !== null) return serviceFailure(parsed.data, result.error.status);

  revalidateQuestionnairePages(result.data.questionnaireId, false);
  return { ok: true, data: result.data };
}

export async function submitQuestionnaireAction(input: unknown): Promise<QuestionnaireActionResult> {
  const parsed = questionnaireActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);

  const result = await submitQuestionnaire(parsed.data.documentId);
  if (result.error !== null) return serviceFailure(parsed.data, result.error.status);

  revalidateQuestionnairePages(result.data.questionnaireId, true);
  return { ok: true, data: result.data };
}
