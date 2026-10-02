'use server';

import { revalidatePath } from 'next/cache';
import type { ConflictReason } from '@/lib/api/conflict-reasons';
import {
  answerSaveAttentionMessage,
  answerSaveRefusal,
  refusalMessage,
  type AnswerSaveFailure,
  type RefusalFamily,
} from '@/lib/api/refusal-copy';
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
      /** The closed-list rule a refused workflow action named; never Strapi's message (T-10-17). */
      reason?: ConflictReason;
      /** Answer saves only: whether autosave may try again or must stop until a refresh (UI-SPEC §6.1). */
      failure?: AnswerSaveFailure;
    };

/** What a failed service call carries into an action: its status and, on a 409, the served reason. */
type ServedFailure = { status?: number; reason?: ConflictReason };

function withReason(reason?: ConflictReason): { reason?: ConflictReason } {
  return reason ? { reason } : {};
}

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

/**
 * A refused revert or submit. A 409 reads its family's sentence for the served reason (UI-SPEC §10.2 B and D);
 * the other statuses keep their messages (§10.3).
 */
function serviceFailure(
  values: QuestionnaireActionValues,
  { status, reason }: ServedFailure,
  family: Extract<RefusalFamily, 'questionnaireRevert' | 'questionnaireSubmit'>,
): QuestionnaireActionResult {
  if (status === 409) {
    return { ok: false, values, formError: refusalMessage(family, reason), ...withReason(reason) };
  }
  if (status === 400) {
    return { ok: false, values, formError: 'The questionnaire answers are invalid. Check the fields and try again.' };
  }
  if (status === 403) {
    return { ok: false, values, formError: 'You do not have permission to save this questionnaire.' };
  }
  if (status === 404) {
    return { ok: false, values, formError: 'This questionnaire is no longer available.' };
  }
  return { ok: false, values, formError: 'The questionnaire service is unavailable. Please try again later.' };
}

/** A refused answer save, with whether autosave may try again (UI-SPEC §10.2 C, §6.1, D-11). */
function saveFailure(values: QuestionnaireActionValues, { status, reason }: ServedFailure): QuestionnaireActionResult {
  const { message, failure } = answerSaveRefusal(status, reason);
  return { ok: false, values, formError: message, failure, ...withReason(reason) };
}

/**
 * Answers that fail validation can be fixed and saved again, so the save is retryable and the attention list
 * names them (§10.2 C). A malformed save no answer change can fix is blocked.
 */
function saveValidationFailure(error: z.ZodError, input: unknown): QuestionnaireActionResult {
  const result = validationFailure(error, input);
  if (result.ok) return result;
  return result.formError === undefined
    ? { ...result, formError: answerSaveAttentionMessage, failure: 'retryable' }
    : { ...result, failure: 'blocked' };
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
export type QuestionnaireGovernanceActionResult =
  | { ok: true; data: QuestionnaireGovernanceResult | QuestionnaireSummary }
  | { ok: false; formError: string; reason?: ConflictReason };

/**
 * A refused governance action. A 409 reads the action's family sentence for the served reason (UI-SPEC §10.2
 * E to H), and returns the reason so the question form can offer Reload questions (D-06).
 */
function governanceFailure({ status, reason }: ServedFailure, family: RefusalFamily): QuestionnaireGovernanceActionResult {
  if (status === 403) return { ok: false, formError: 'You do not have permission to govern this questionnaire.' };
  if (status === 404) return { ok: false, formError: 'This questionnaire is no longer available.' };
  if (status === 409) return { ok: false, formError: refusalMessage(family, reason), ...withReason(reason) };
  if (status === 400) return { ok: false, formError: 'The questionnaire details are invalid. Check the fields and try again.' };
  return { ok: false, formError: 'The questionnaire service is unavailable. Please try again later.' };
}

function governanceValidation(error: z.ZodError): QuestionnaireGovernanceActionResult { return { ok: false, formError: error.issues[0]?.message ?? 'Check the questionnaire details and try again.' }; }

export async function releaseQuestionnaireAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> {
  const parsed = governanceDocumentSchema.safeParse(input); if (!parsed.success) return governanceValidation(parsed.error);
  const result = await releaseQuestionnaire(parsed.data.documentId); if (result.error) return governanceFailure(result.error, 'questionnaireRelease');
  revalidateQuestionnaireReversalPages(result.data.documentId); return { ok: true, data: result.data };
}

export async function returnQuestionnaireToAnalystReviewAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> {
  const parsed = questionnaireRevertSchema.safeParse(input); if (!parsed.success) return governanceValidation(parsed.error);
  const result = await returnQuestionnaireToAnalystReview(parsed.data.documentId, parsed.data.reason); if (result.error) return governanceFailure(result.error, 'returnToReview');
  revalidateQuestionnaireReversalPages(result.data.documentId); return { ok: true, data: result.data };
}

async function questionAction(input: unknown, kind: 'add' | 'edit' | 'delete'): Promise<QuestionnaireGovernanceActionResult> {
  if (kind === 'delete') {
    const parsed = z.object({ documentId: z.string().trim().min(1).max(255), questionId: z.string().trim().min(1).max(255) }).strict().safeParse(input); if (!parsed.success) return governanceValidation(parsed.error);
    const result = await deleteQuestionnaireQuestion(parsed.data.documentId, parsed.data.questionId); if (result.error) return governanceFailure(result.error, 'questionDelete'); revalidateQuestionnaireReversalPages(result.data.documentId); return { ok: true, data: result.data };
  }
  const parsed = (kind === 'add' ? addGovernanceQuestionSchema : governanceQuestionSchema).safeParse(input); if (!parsed.success) return governanceValidation(parsed.error);
  const value = parsed.data as { documentId: string; questionId?: string; input: QuestionnaireQuestionMutationInput };
  const result = kind === 'add' ? await addQuestionnaireQuestion(value.documentId, value.input) : await editQuestionnaireQuestion(value.documentId, value.questionId as string, value.input);
  if (result.error) return governanceFailure(result.error, 'questionChange'); revalidateQuestionnaireReversalPages(result.data.documentId); return { ok: true, data: result.data };
}

export async function addQuestionnaireQuestionAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> { return questionAction(input, 'add'); }
export async function editQuestionnaireQuestionAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> { return questionAction(input, 'edit'); }
export async function deleteQuestionnaireQuestionAction(input: unknown): Promise<QuestionnaireGovernanceActionResult> { return questionAction(input, 'delete'); }

export async function revertQuestionnaireToDraftAction(input: unknown): Promise<QuestionnaireRevertActionResult> {
  const parsed = questionnaireRevertSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);
  const result = await revertQuestionnaireToDraft(parsed.data.documentId, parsed.data.reason);
  if (result.error !== null) return serviceFailure({ documentId: parsed.data.documentId, answers: [] }, result.error, 'questionnaireRevert');
  revalidateQuestionnaireReversalPages(result.data.questionnaireId);
  return { ok: true, data: result.data };
}

export async function saveQuestionnaireDraftAction(input: unknown): Promise<QuestionnaireActionResult> {
  const parsed = questionnaireActionSchema.safeParse(input);
  if (!parsed.success) return saveValidationFailure(parsed.error, input);

  const result = await saveQuestionnaireDraft(parsed.data.documentId, parsed.data.answers);
  if (result.error !== null) return saveFailure(parsed.data, result.error);

  revalidateQuestionnairePages(result.data.questionnaireId, false);
  return { ok: true, data: result.data };
}

export async function submitQuestionnaireAction(input: unknown): Promise<QuestionnaireActionResult> {
  const parsed = questionnaireActionSchema.safeParse(input);
  if (!parsed.success) return validationFailure(parsed.error, input);

  const result = await submitQuestionnaire(parsed.data.documentId);
  if (result.error !== null) return serviceFailure(parsed.data, result.error, 'questionnaireSubmit');

  revalidateQuestionnairePages(result.data.questionnaireId, true);
  return { ok: true, data: result.data };
}
