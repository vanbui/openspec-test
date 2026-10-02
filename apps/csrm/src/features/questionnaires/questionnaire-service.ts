import 'server-only';
import { revertReasonSchema } from '@/lib/schemas/revert-reason';

import { z } from 'zod';
import type { ContractResponseParser } from '../assessments/assessment-service';
import {
  createStrapiClient,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import {
  questionnaireAnswerInputSchema,
  questionnaireDefinitionSchema,
  type QuestionnaireAnswerInput,
  type QuestionnaireDefinition,
} from './questionnaire-schema';
import { assessmentRequestRelationshipSchema } from './questionnaire-domain';
import type { QuestionPlacement } from './questionnaire-placement';

const documentIdSchema = z.string().trim().min(1).max(255);
const timestampSchema = z.iso.datetime({ offset: true });
const progressSchema = z.object({
  answered: z.number().int().nonnegative(),
  total: z.number().int().nonnegative(),
  percent: z.number().min(0).max(100),
});
const assessmentRequestSummarySchema = assessmentRequestRelationshipSchema;
const questionnaireTimelineEventSchema = z.object({
  kind: z.enum(['released', 'returned-to-review', 'question-added', 'question-edited', 'question-deleted', 'answer-cleared', 'regenerated']),
  at: timestampSchema,
  by: z.object({ documentId: documentIdSchema, displayName: z.string().max(255).nullable() }).nullable().optional(),
  reason: z.string().max(500).optional(),
  questionKey: z.string().max(120).optional(),
  questionText: z.string().min(1).max(500).optional(),
  explanation: z.string().max(500).optional(),
}).strict();
const questionnaireSummarySchema = z.object({
  documentId: documentIdSchema,
  questionnaireNumber: z.string().trim().min(1).max(255),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(65_535).nullable().optional(),
  state: z.enum(['not-started', 'draft', 'submitted']),
  progress: progressSchema,
  assessmentRequest: assessmentRequestSummarySchema,
  updatedAt: timestampSchema,
  revertReason: z.string().max(500).nullable().optional(),
  revertedAt: timestampSchema.nullable().optional(),
  revertedBy: z.object({ documentId: documentIdSchema, displayName: z.string().max(255).nullish() }).nullable().optional(),
  release: z.object({ releasedAt: timestampSchema, releasedBy: z.object({ documentId: documentIdSchema, displayName: z.string().max(255).nullable() }).nullable() }).strict().nullable().optional(),
  // analystChangesSinceGeneration is served on analyst reads only (D-16); the Replace confirmation reads it.
  revision: z.object({ eventCount: z.number().int().nonnegative(), lastEventAt: timestampSchema.nullable(), analystChangesSinceGeneration: z.number().int().nonnegative().optional() }).strict().nullable().optional(),
  // Left absent rather than defaulted: the timeline is served only where it is
  // authorised, and an empty array would tell every other projection that a
  // questionnaire has no revisions when it was simply never asked for.
  events: z.array(questionnaireTimelineEventSchema).max(1_000).optional(),
});
const questionnaireListResponseSchema = z.object({
  data: z.array(questionnaireSummarySchema).max(10_000),
  meta: z.object({ pagination: z.object({
    page: z.number().int().min(1),
    pageSize: z.number().int().min(1).max(100),
    pageCount: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }) }),
});
const requestorSummaryResponseSchema = z.object({
  data: z.object({
    notStarted: z.number().int().nonnegative(),
    draft: z.number().int().nonnegative(),
    submitted: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
});
const reviewSummaryResponseSchema = z.object({
  data: z.object({
    awaitingSubmission: z.number().int().nonnegative(),
    readyForReview: z.number().int().nonnegative(),
    total: z.number().int().nonnegative(),
  }),
});
const questionnaireResponseSchema = z.object({ data: questionnaireSummarySchema });

/*
 * A questionnaire's question list, as every response that carries one is
 * parsed. A deleted question is retained so its history survives, but it is no
 * longer part of the questionnaire: it must not render, count towards progress,
 * gate submission or reach the assessment (D-07). The server refuses to delete
 * a question an active question depends on, so dropping it here cannot orphan
 * a visibility condition.
 */
const questionnaireQuestionListSchema = z.array(z.object({
  documentId: z.unknown().optional(),
  questionText: z.unknown(),
  answerType: z.unknown(),
  options: z.unknown(),
  answer: z.unknown().nullable().optional(),
})).max(10_000)
  // The projection is still unvalidated; the pipe validates every field of it.
  .transform((questions) => questions
    .filter((question) => !(
      typeof question.options === 'object' && question.options !== null
      && (question.options as { deleted?: unknown }).deleted !== undefined
    ))
    .map((question) => ({
      ...(question.documentId !== undefined ? { documentId: question.documentId } : {}),
      questionText: question.questionText,
      answerType: question.answerType,
      options: question.options,
      answer: question.answer ?? null,
    })) as z.input<typeof questionnaireDefinitionSchema>)
  .pipe(questionnaireDefinitionSchema);

const questionnaireQuestionsResponseSchema = z.object({ data: questionnaireQuestionListSchema });

/*
 * The same question list read for placement (10-CONTEXT D-05): every question, removed ones included, because
 * Strapi's definition check counts them all. It reads only where each question sits, declares no bound of its
 * own, and accepts the `deleted` marker Strapi serves on a removed question (top level, or in the options of
 * a schemaVersion 2 envelope) without requiring it.
 */
const questionPlacementSectionSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string().optional(),
  order: z.number().int().nonnegative(),
});
const questionPlacementListSchema = z.array(z.object({
  documentId: z.string(),
  questionText: z.string(),
  options: z.object({
    questionKey: z.string(),
    section: questionPlacementSectionSchema,
    order: z.number().int().nonnegative(),
    deleted: z.unknown().optional(),
  }),
  deleted: z.unknown().optional(),
})).transform((questions): QuestionPlacement[] => questions.map((question) => ({
  documentId: question.documentId,
  questionKey: question.options.questionKey,
  questionText: question.questionText,
  section: {
    key: question.options.section.key,
    title: question.options.section.title,
    ...(question.options.section.description !== undefined ? { description: question.options.section.description } : {}),
    order: question.options.section.order,
  },
  order: question.options.order,
  removed: question.deleted !== undefined || question.options.deleted !== undefined,
})));
const questionnaireQuestionPlacementsResponseSchema = z.object({ data: questionPlacementListSchema });
const governanceEventSchema = z.object({
  schemaVersion: z.literal(1), kind: z.enum(['released', 'returned-to-review', 'question-added', 'question-edited', 'question-deleted', 'answer-cleared', 'regenerated']), at: timestampSchema, by: documentIdSchema,
  reason: z.string().max(500).optional(), questionKey: z.string().max(120).optional(), questionText: z.string().min(1).max(500).optional(), explanation: z.string().max(2_000).optional(),
}).strict();
const clearedAnswerSchema = z.object({ questionKey: z.string().trim().min(1).max(120), explanation: z.string().trim().min(1).max(2_000) }).strict();
const governanceResponseSchema = z.object({ data: questionnaireSummarySchema.extend({
  release: questionnaireSummarySchema.shape.release.unwrap(),
  events: z.array(governanceEventSchema).max(10_000), clearedAnswers: z.array(clearedAnswerSchema).max(10_000).optional(),
}).strict() }).strict();
const releaseResponseSchema = z.object({ data: questionnaireSummarySchema.extend({ release: questionnaireSummarySchema.shape.release.unwrap() }).strict() }).strict();

const supportedAnswerTypeSchema = z.enum(['Text', 'Long text', 'Boolean', 'Single select', 'Multi select', 'Date']);
const questionMutationInputSchema = z.object({
  questionText: z.string().trim().min(1).max(65_535).optional(), answerType: supportedAnswerTypeSchema.optional(), helpText: z.string().trim().max(2_000).nullable().optional(), required: z.boolean().optional(),
  section: z.object({ key: z.string().trim().min(1).max(120), title: z.string().trim().min(1).max(255), description: z.string().trim().min(1).max(2_000).optional(), order: z.number().int().nonnegative() }).strict().optional(),
  order: z.number().int().nonnegative().optional(), choices: z.array(z.object({ value: z.string().trim().min(1).max(255), label: z.string().trim().min(1).max(255) }).strict()).min(1).max(1_000).optional(),
  visibility: z.object({ questionKey: z.string().trim().min(1).max(120), operator: z.enum(['equals', 'notEquals', 'includes', 'notIncludes']), value: z.union([z.string().max(65_535), z.boolean()]) }).strict().nullable().optional(),
}).strict().superRefine((value, context) => {
  if (value.answerType && (value.answerType === 'Single select' || value.answerType === 'Multi select') !== Boolean(value.choices)) context.addIssue({ code: 'custom', path: ['choices'], message: 'Select questions require choices and other question types do not allow them.' });
});
const addQuestionInputSchema = questionMutationInputSchema.refine((value) => value.questionText !== undefined && value.answerType !== undefined && value.required !== undefined && value.section !== undefined && value.order !== undefined, 'Question details are incomplete.');

export type QuestionnaireSummary = Omit<z.infer<typeof questionnaireSummarySchema>, 'events'> & {
  events?: z.infer<typeof questionnaireTimelineEventSchema>[];
};
export type QuestionnairePagination = z.infer<typeof questionnaireListResponseSchema>['meta']['pagination'];
export type QuestionnaireStatus = 'not-started' | 'draft' | 'submitted';
export type QuestionnaireListQuery = { q?: string; status?: QuestionnaireStatus; page: number; pageSize: 10 | 25 | 50 | 100; sort: QuestionnaireSort };
export type QuestionnaireSort = 'updatedAt:desc' | 'updatedAt:asc' | 'questionnaireNumber:asc' | 'questionnaireNumber:desc' | 'title:asc' | 'title:desc';
export type QuestionnaireListResult = { questionnaires: readonly QuestionnaireSummary[]; pagination: QuestionnairePagination };
export type { QuestionnaireAnswerInput };
export type RequestorQuestionnaireSummary = z.infer<typeof requestorSummaryResponseSchema>['data'];
export type QuestionnaireReviewSummary = z.infer<typeof reviewSummaryResponseSchema>['data'];
export type QuestionnaireQuestionMutationInput = z.infer<typeof questionMutationInputSchema>;
export type QuestionnaireGovernanceResult = Omit<QuestionnaireSummary, 'events'> & { events: z.infer<typeof governanceEventSchema>[]; clearedAnswers: z.infer<typeof clearedAnswerSchema>[] };

export interface QuestionnaireMutationResult {
  questionnaireId: string;
  state: 'draft' | 'submitted';
  progress: z.infer<typeof progressSchema>;
  answers: QuestionnaireDefinition;
  updatedAt: string;
  submittedAt?: string;
}

export interface QuestionnaireRevertResult extends QuestionnaireMutationResult {
  revert: { reason: string; revertedAt: string; revertedBy: { documentId: string } };
}

const mutationResponseSchema = z.object({
  data: z.object({
    questionnaireId: documentIdSchema,
    state: z.enum(['draft', 'submitted']),
    progress: progressSchema,
    answers: z.unknown(),
    updatedAt: timestampSchema,
    submittedAt: timestampSchema.optional(),
  }),
});

function normalizeFailure(error: unknown, status?: number): TransportResult<never> {
  return normalizeTransportError(error, status);
}

async function read<T>(
  request: (client: StrapiClient) => Promise<{ data?: unknown; error?: unknown; response: { status: number } }>,
  parse: (value: unknown) => T,
): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await request(client);
    if (error || !data) return normalizeFailure(error, response.status);
    return { data: parse(data), error: null };
  } catch (error) {
    return normalizeFailure(error);
  }
}

function parseQuestionnaireDefinition(value: unknown): QuestionnaireDefinition {
  return questionnaireQuestionListSchema.parse(value);
}

const questionnaireQuerySchema = z.object({
  q: z.string().trim().max(200).catch(''),
  status: z.enum(['not-started', 'draft', 'submitted']).optional().catch(undefined),
  page: z.coerce.number().int().min(1).max(1_000_000).catch(1),
  pageSize: z.coerce.number().pipe(z.union([z.literal(10), z.literal(25), z.literal(50), z.literal(100)])).catch(25),
  sort: z.enum(['updatedAt:desc', 'updatedAt:asc', 'questionnaireNumber:asc', 'questionnaireNumber:desc', 'title:asc', 'title:desc']).catch('updatedAt:desc'),
});

export function parseQuestionnaireListQuery(value: Record<string, string | string[] | undefined>): QuestionnaireListQuery {
  const parsed = questionnaireQuerySchema.parse({
    q: Array.isArray(value.q) ? value.q[0] : value.q,
    status: Array.isArray(value.status) ? undefined : value.status,
    page: Array.isArray(value.page) ? value.page[0] : value.page,
    pageSize: Array.isArray(value.pageSize) ? value.pageSize[0] : value.pageSize,
    sort: Array.isArray(value.sort) ? value.sort[0] : value.sort,
  });
  return parsed.q || parsed.status ? parsed : { page: parsed.page, pageSize: parsed.pageSize, sort: parsed.sort };
}

function listParams(query: QuestionnaireListQuery) {
  // The questionnaire collection route takes a closed, flat query. Sending the
  // older `pagination[page]` form is now an unrecognised key and fails the
  // whole request.
  return { ...(query.q ? { q: query.q } : {}), ...(query.status ? { status: query.status } : {}), page: query.page, pageSize: query.pageSize, sort: [query.sort] };
}

function parseQuestionnaireList(payload: unknown): QuestionnaireListResult {
  const parsed = questionnaireListResponseSchema.parse(payload);
  return { questionnaires: parsed.data, pagination: parsed.meta.pagination };
}

export function listMyQuestionnaires(): Promise<TransportResult<readonly QuestionnaireSummary[]>>;
export function listMyQuestionnaires(query: QuestionnaireListQuery): Promise<TransportResult<QuestionnaireListResult>>;
export async function listMyQuestionnaires(query?: QuestionnaireListQuery): Promise<TransportResult<QuestionnaireListResult | readonly QuestionnaireSummary[]>> {
  const resolved = query ?? { q: '', page: 1, pageSize: 50, sort: 'updatedAt:desc' as const };
  const result = await read((client) => client.GET('/v1/my_questionnaires', { params: { query: listParams(resolved) } } as never), parseQuestionnaireList);
  return query || result.error ? result : { data: result.data.questionnaires, error: null };
}

export async function getMyQuestionnaireSummary(): Promise<TransportResult<RequestorQuestionnaireSummary>> {
  return read(
    (client) => client.GET('/v1/my_questionnaires/status_summary'),
    (payload) => requestorSummaryResponseSchema.parse(payload).data,
  );
}

export function listQuestionnairesForReview(): Promise<TransportResult<readonly QuestionnaireSummary[]>>;
export function listQuestionnairesForReview(query: QuestionnaireListQuery): Promise<TransportResult<QuestionnaireListResult>>;
export async function listQuestionnairesForReview(query?: QuestionnaireListQuery): Promise<TransportResult<QuestionnaireListResult | readonly QuestionnaireSummary[]>> {
  const resolved = query ?? { q: '', page: 1, pageSize: 50, sort: 'updatedAt:desc' as const };
  const result = await read((client) => client.GET('/v1/questionnaires', { params: { query: listParams(resolved) } } as never), parseQuestionnaireList);
  return query || result.error ? result : { data: result.data.questionnaires, error: null };
}

export async function getReviewSummary(): Promise<TransportResult<QuestionnaireReviewSummary>> {
  return read(
    (client) => client.GET('/v1/questionnaires/review_summary'),
    (payload) => reviewSummaryResponseSchema.parse(payload).data,
  );
}

export async function getQuestionnaire(documentId: string): Promise<TransportResult<QuestionnaireSummary>> {
  return read(
    (client) => client.GET('/v1/questionnaires/{questionnaireId}', {
      params: { path: { questionnaireId: documentIdSchema.parse(documentId) } },
    }),
    (payload) => questionnaireResponseSchema.parse(payload).data,
  );
}

export async function getQuestionnaireQuestions(documentId: string): Promise<TransportResult<QuestionnaireDefinition>> {
  return read(
    (client) => client.GET('/v1/questionnaires/{questionnaireId}/questions', {
      params: { path: { questionnaireId: documentIdSchema.parse(documentId) } },
    }),
    (payload) => questionnaireQuestionsResponseSchema.parse(payload).data,
  );
}

export interface QuestionnaireGovernanceQuestions {
  /** The active questions, as every other question list is parsed. */
  definition: QuestionnaireDefinition;
  /** Where every question sits, removed ones included, for placing an added or moved question. */
  placements: QuestionPlacement[];
}

/** The analyst's question read: one request, parsed as the active definition and as the full placement set. */
export async function getQuestionnaireGovernanceQuestions(documentId: string): Promise<TransportResult<QuestionnaireGovernanceQuestions>> {
  return read(
    (client) => client.GET('/v1/questionnaires/{questionnaireId}/questions', {
      params: { path: { questionnaireId: documentIdSchema.parse(documentId) } },
    }),
    (payload) => ({
      definition: questionnaireQuestionsResponseSchema.parse(payload).data,
      placements: questionnaireQuestionPlacementsResponseSchema.parse(payload).data,
    }),
  );
}

function parseMutation(payload: unknown): QuestionnaireMutationResult {
  const parsed = mutationResponseSchema.parse(payload).data;
  return {
    questionnaireId: parsed.questionnaireId,
    state: parsed.state,
    progress: parsed.progress,
    answers: parseQuestionnaireDefinition(parsed.answers),
    updatedAt: parsed.updatedAt,
    ...(parsed.submittedAt ? { submittedAt: parsed.submittedAt } : {}),
  };
}

export async function saveQuestionnaireDraft(
  documentId: string,
  answers: readonly QuestionnaireAnswerInput[],
): Promise<TransportResult<QuestionnaireMutationResult>> {
  return read(
    (client) => client.PATCH('/v1/questionnaires/{questionnaireId}/answers', {
      params: { path: { questionnaireId: documentIdSchema.parse(documentId) } },
      body: { answers: z.array(questionnaireAnswerInputSchema).max(10_000).parse(answers) },
    }),
    parseMutation,
  );
}

export async function submitQuestionnaire(documentId: string): Promise<TransportResult<QuestionnaireMutationResult>> {
  return read(
    (client) => client.POST('/v1/questionnaires/{questionnaireId}/submit', {
      params: { path: { questionnaireId: documentIdSchema.parse(documentId) } },
    }),
    parseMutation,
  );
}

const revertInputSchema = z.object({ documentId: documentIdSchema, reason: revertReasonSchema }).strip();
const revertResponseSchema = z.object({ data: mutationResponseSchema.shape.data.extend({
  state: z.literal('draft').optional(),
  revert: z.object({ reason: z.string().min(1).max(500), revertedAt: timestampSchema, revertedBy: z.object({ documentId: documentIdSchema }) }),
}) }).strip();

export async function revertQuestionnaireToDraft(documentId: string, reason: string): Promise<TransportResult<QuestionnaireRevertResult>> {
  try {
    const input = revertInputSchema.parse({ documentId, reason });
    const client = await createStrapiClient();
    const { data, error, response } = await client.POST('/v1/questionnaires/{questionnaireId}/revert_to_draft', {
      params: { path: { questionnaireId: input.documentId } }, body: { reason: input.reason },
    });
    if (error || !data) return normalizeFailure(error, response.status);
    const parsed = revertResponseSchema.parse(data).data;
    return { data: { ...parseMutation({ data: parsed }), revert: parsed.revert }, error: null };
  } catch (error) { return normalizeFailure(error); }
}

function parseGovernance(payload: unknown): QuestionnaireGovernanceResult {
  const parsed = governanceResponseSchema.parse(payload).data;
  return { ...parsed, clearedAnswers: parsed.clearedAnswers ?? [] };
}

export async function releaseQuestionnaire(documentId: string): Promise<TransportResult<QuestionnaireSummary>> {
  return read((client) => client.POST('/v1/questionnaires/{questionnaireId}/release', { params: { path: { questionnaireId: documentIdSchema.parse(documentId) } } }), (payload) => releaseResponseSchema.parse(payload).data);
}

export async function returnQuestionnaireToAnalystReview(documentId: string, reason: string): Promise<TransportResult<QuestionnaireGovernanceResult>> {
  return read((client) => client.POST('/v1/questionnaires/{questionnaireId}/return_to_review', { params: { path: { questionnaireId: documentIdSchema.parse(documentId) } }, body: { reason: revertReasonSchema.parse(reason) } }), parseGovernance);
}

export async function addQuestionnaireQuestion(documentId: string, input: QuestionnaireQuestionMutationInput): Promise<TransportResult<QuestionnaireGovernanceResult>> {
  const body = addQuestionInputSchema.parse(input);
  return read((client) => client.POST('/v1/questionnaires/{questionnaireId}/questions', { params: { path: { questionnaireId: documentIdSchema.parse(documentId) } }, body: body as never }), parseGovernance);
}

export async function editQuestionnaireQuestion(documentId: string, questionId: string, input: QuestionnaireQuestionMutationInput): Promise<TransportResult<QuestionnaireGovernanceResult>> {
  const body = questionMutationInputSchema.refine((value) => Object.keys(value).length > 0, 'Question details are required.').parse(input);
  return read((client) => client.PATCH('/v1/questionnaires/{questionnaireId}/questions/{questionId}', { params: { path: { questionnaireId: documentIdSchema.parse(documentId), questionId: documentIdSchema.parse(questionId) } }, body: body as never }), parseGovernance);
}

export async function deleteQuestionnaireQuestion(documentId: string, questionId: string): Promise<TransportResult<QuestionnaireGovernanceResult>> {
  return read((client) => client.DELETE('/v1/questionnaires/{questionnaireId}/questions/{questionId}', { params: { path: { questionnaireId: documentIdSchema.parse(documentId), questionId: documentIdSchema.parse(questionId) } } }), parseGovernance);
}

/*
 * The draft-save, submit and revert responses are parsed in two steps: the
 * envelope, then its answers through questionnaireQuestionListSchema. The guard
 * reads the same two schemas composed, so it sees every question they carry.
 */
const mutationContractSchema = z.object({ data: mutationResponseSchema.shape.data.extend({ answers: questionnaireQuestionListSchema }) });
const revertContractSchema = z.object({ data: revertResponseSchema.shape.data.extend({ answers: questionnaireQuestionListSchema }) }).strip();

/*
 * A question list's own rules, which JSON Schema cannot express: choices only on
 * a select question, a visibility condition that references an earlier, other
 * question without a cycle, and an answer envelope whose fields follow its
 * state. The one question the guard is served (a Text question that carries
 * choices, depends on itself and holds a draft answer with a submittedAt)
 * breaks each of them.
 */
const questionListNarrowings = (listPath: string) => [
  `${listPath}.0.options.choices`,
  // The contract's one QuestionnaireAnswerEnvelope leaves submittedAt optional in
  // either state; the server writes it only on a submitted answer, so a draft refuses it.
  `${listPath}.0.answer.submittedAt`,
  `${listPath}.0.options.visibility`,
  `${listPath}.0.options.visibility.questionKey`,
  `${listPath}.options.visibility`,
];

export const contractResponseParsers: readonly ContractResponseParser[] = [
  { label: 'listMyQuestionnaires', component: 'QuestionnaireListResponse', parser: questionnaireListResponseSchema },
  { label: 'getMyQuestionnaireSummary', component: 'QuestionnaireStatusSummaryResponse', parser: requestorSummaryResponseSchema },
  { label: 'listQuestionnairesForReview', component: 'QuestionnaireListResponse', parser: questionnaireListResponseSchema },
  { label: 'getQuestionnaireReviewSummary', component: 'QuestionnaireReviewSummaryResponse', parser: reviewSummaryResponseSchema },
  { label: 'getQuestionnaire', component: 'QuestionnaireHeaderResponse', parser: questionnaireResponseSchema },
  { label: 'getQuestionnaireQuestions', component: 'QuestionnaireQuestionsResponse', parser: questionnaireQuestionsResponseSchema, narrowedPaths: questionListNarrowings('data') },
  { label: 'getQuestionnaireQuestionPlacements', component: 'QuestionnaireQuestionsResponse', parser: questionnaireQuestionPlacementsResponseSchema },
  { label: 'saveQuestionnaireDraft', component: 'QuestionnaireMutationResponse', parser: mutationContractSchema, narrowedPaths: questionListNarrowings('data.answers') },
  { label: 'submitQuestionnaire', component: 'QuestionnaireSubmitResponse', parser: mutationContractSchema, narrowedPaths: questionListNarrowings('data.answers') },
  { label: 'revertQuestionnaireToDraft', component: 'QuestionnaireRevertResponse', parser: revertContractSchema, narrowedPaths: questionListNarrowings('data.answers') },
  { label: 'releaseQuestionnaire', component: 'QuestionnaireReleaseResponse', parser: releaseResponseSchema },
  { label: 'returnQuestionnaireToAnalystReview', component: 'QuestionnaireGovernanceResponse', parser: governanceResponseSchema },
  { label: 'addQuestionnaireQuestion', component: 'QuestionnaireGovernanceResponse', parser: governanceResponseSchema },
  { label: 'editQuestionnaireQuestion', component: 'QuestionnaireGovernanceResponse', parser: governanceResponseSchema },
  { label: 'deleteQuestionnaireQuestion', component: 'QuestionnaireGovernanceResponse', parser: governanceResponseSchema },
];

export const responseParserModule = {
  modulePath: 'features/questionnaires/questionnaire-service.ts',
  mode: 'parsers' as const,
  parsers: contractResponseParsers,
};
