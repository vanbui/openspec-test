import {
  getVisibleQuestionKeys,
  parseQuestionnaireDefinition,
  QuestionnaireDefinitionError,
  type QuestionnaireValue,
} from "./questionnaire-definition";
import { isAnsweredValue } from "./questionnaire-answer-preservation";
import {
  countAnalystChangesSinceGeneration,
  GovernanceLogError,
  GOVERNANCE_LOG_MAX_ENTRIES,
  GOVERNANCE_EVENT_KINDS,
  parseGovernanceEvent,
  parseGovernanceLog,
  projectGovernanceEventsForRequestor,
  questionTextSnapshot,
  summariseGovernanceLog,
  type GovernanceEvent,
} from "./questionnaire-governance-log";
import { loadAiInputsChanged, type AiInputsChanged, type AiInputsSignalStrapi } from "../../../csrm/ai/ai-inputs-signal";
import type { RequestSummaryFacts } from "../../csrm-assessment-request/services/request-summary-facts";

export type QuestionnaireActor = "requestor" | "analyst";
type CollectionScope = "own" | "all";
type RecordValue = Record<string, unknown>;

type AuthorizationState = {
  csrmAuthorization?: {
    questionnaireActor?: QuestionnaireActor;
    questionnaireCollectionScope?: CollectionScope;
    questionnaireRequestorId?: number;
  };
};

export type QuestionnairePagination = { page: number; pageSize: number };
export type QuestionnaireStatus = "not-started" | "draft" | "submitted";
export type QuestionnaireSort = "updatedAt:desc" | "updatedAt:asc" | "questionnaireNumber:asc" | "questionnaireNumber:desc" | "title:asc" | "title:desc" | "state:asc" | "state:desc";
export const QUESTIONNAIRE_SUMMARY_PAGE_SIZE = 100;
const QUESTIONNAIRE_STATUSES = ["not-started", "draft", "submitted"] as const;

export class QuestionnaireQueryError extends Error {
  constructor() {
    super("CSRM questionnaire query is invalid.");
    this.name = "QuestionnaireQueryError";
  }
}

export function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function positiveInteger(value: unknown, fallback: number, maximum: number): number {
  if (value === undefined) return fallback;
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) throw new QuestionnaireQueryError();
  return parsed;
}

function authorization(state: unknown): {
  actor: QuestionnaireActor;
  scope: CollectionScope;
  requestorId?: number;
} {
  if (!isRecord(state)) throw new QuestionnaireQueryError();
  const value = state as AuthorizationState;
  const actor = value.csrmAuthorization?.questionnaireActor;
  const scope = value.csrmAuthorization?.questionnaireCollectionScope;
  const requestorId = value.csrmAuthorization?.questionnaireRequestorId;
  if ((actor !== "requestor" && actor !== "analyst") || (scope !== "own" && scope !== "all")) {
    throw new QuestionnaireQueryError();
  }
  if (scope === "own" && !Number.isInteger(requestorId)) throw new QuestionnaireQueryError();
  return { actor, scope, requestorId };
}

function assertOnlyKeys(value: RecordValue, allowed: readonly string[]): void {
  if (Object.keys(value).some((key) => !allowed.includes(key))) throw new QuestionnaireQueryError();
}

function safeText(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.trim().length < 1 || value.length > 200) throw new QuestionnaireQueryError();
  return value.trim();
}

function safeSort(value: unknown): string[] {
  if (value === undefined) return ["updatedAt:desc"];
  const entries = Array.isArray(value) ? value : [value];
  const allowed = new Set(["updatedAt", "questionnaireNumber", "title", "state"]);
  return entries.map((entry) => {
    if (typeof entry !== "string") throw new QuestionnaireQueryError();
    const [field, direction = "asc", extra] = entry.split(":");
    if (!field || extra !== undefined || !allowed.has(field) || (direction !== "asc" && direction !== "desc")) {
      throw new QuestionnaireQueryError();
    }
    return `${field}:${direction}`;
  });
}

export function buildQuestionnaireCollectionQuery(query: unknown, state: unknown): {
  dataQuery: RecordValue;
  countQuery: RecordValue;
  pagination: QuestionnairePagination;
  sort: QuestionnaireSort[];
  status?: QuestionnaireStatus;
} {
  if (!isRecord(query)) throw new QuestionnaireQueryError();
  assertOnlyKeys(query, ["q", "status", "sort", "page", "pageSize"]);
  const page = positiveInteger(query.page, 1, 1_000_000);
  const pageSize = positiveInteger(query.pageSize, 25, 100);
  const scoped = questionnaireCollectionScope(query, state);
  return {
    ...scoped,
    dataQuery: { ...scoped.dataQuery, start: (page - 1) * pageSize, limit: pageSize },
    pagination: { page, pageSize },
  };
}

/** The parsed export query of a questionnaire list: the list's own scope, search, status and sort, without a page. */
export type QuestionnaireExportQuery = {
  dataQuery: RecordValue;
  countQuery: RecordValue;
  sort: QuestionnaireSort[];
  status?: QuestionnaireStatus;
  /** The search term, trimmed, for the export's About sheet and log line. */
  q?: string;
};

/**
 * Phase 19 (D-04, D-05): the export variant of buildQuestionnaireCollectionQuery. It shares the list's closed parsing
 * and the policy's scope decision, refuses `page` and `pageSize`, and returns the filters, sort and count query without
 * pagination, so an export reads exactly the scope the list pages through.
 */
export function buildQuestionnaireExportQuery(query: unknown, state: unknown): QuestionnaireExportQuery {
  if (!isRecord(query)) throw new QuestionnaireQueryError();
  assertOnlyKeys(query, ["q", "status", "sort"]);
  const scoped = questionnaireCollectionScope(query, state);
  const q = safeText(query.q);
  return { ...scoped, ...(q === undefined ? {} : { q }) };
}

/** The list's scope, search and status, and its sort: shared by the list and its export. */
function questionnaireCollectionScope(query: RecordValue, state: unknown): {
  dataQuery: RecordValue;
  countQuery: RecordValue;
  sort: QuestionnaireSort[];
  status?: QuestionnaireStatus;
} {
  const decision = authorization(state);
  const q = safeText(query.q);
  const status = query.status;
  if (status !== undefined && (typeof status !== "string" || !QUESTIONNAIRE_STATUSES.includes(status as typeof QUESTIONNAIRE_STATUSES[number]))) {
    throw new QuestionnaireQueryError();
  }
  const filters: RecordValue = {
    ...(q ? { $or: [{ title: { $containsi: q } }, { questionnaireNumber: { $containsi: q } }] } : {}),
  };
  if (decision.scope === "own") {
    filters.$and = [
      ...(Array.isArray(filters.$or) ? [{ $or: filters.$or }] : []),
      { assessmentRequest: { requestor: { id: { $eq: decision.requestorId } } } },
      /*
       * A Requestor's own collection carries only released questionnaires, so
       * their My Questionnaires list, status summary and dashboard counts can
       * never contain analyst-only work. The analyst review collection is a
       * separate route and keeps the wider grant it already carries.
       */
      ...(decision.actor === "requestor" ? [{ releasedAt: { $notNull: true } }] : []),
    ];
    delete filters.$or;
  }
  const countQuery = { filters };
  const sort = safeSort(query.sort) as QuestionnaireSort[];
  return {
    countQuery,
    dataQuery: {
      filters,
      populate: { assessmentRequest: true, questions: true, revertedBy: true, releasedBy: true },
      sort,
    },
    sort,
    ...(status === undefined ? {} : { status: status as QuestionnaireStatus }),
  };
}

function answerValue(answer: unknown): unknown {
  return isRecord(answer) ? answer.value : null;
}

/* Phase 15 D-05: the one answered rule, shared with the AI's fixed set (questionnaire-answer-preservation.ts). */
function hasValue(answer: unknown): boolean {
  return isAnsweredValue(answer);
}

function isSubmittedAnswer(answer: unknown): boolean {
  return isRecord(answer) && answer.state === "submitted" && typeof answer.submittedAt === "string";
}

function questionsOf(document: RecordValue): RecordValue[] {
  return Array.isArray(document.questions) ? document.questions.filter(isRecord) : [];
}

export async function loadCompleteQuestionnaireScope(
  findMany: (query: RecordValue) => Promise<RecordValue[]>,
  dataQuery: RecordValue,
): Promise<RecordValue[]> {
  const documents: RecordValue[] = [];
  for (let start = 0; ; start += QUESTIONNAIRE_SUMMARY_PAGE_SIZE) {
    const page = await findMany({
      ...dataQuery,
      sort: ["documentId:asc"],
      start,
      limit: QUESTIONNAIRE_SUMMARY_PAGE_SIZE,
    });
    documents.push(...page);
    if (page.length < QUESTIONNAIRE_SUMMARY_PAGE_SIZE) return documents;
  }
}

function questionKeyOf(question: RecordValue): string | null {
  return isRecord(question.options) && typeof question.options.questionKey === "string"
    ? question.options.questionKey
    : null;
}

function activeQuestionSet(questions: RecordValue[]): Set<string> {
  const definition = parseQuestionnaireDefinition(questions);
  const values = Object.fromEntries(definition.map((question) => [
    question.questionKey,
    answerValue(question.answer) as QuestionnaireValue,
  ]));
  return new Set(getVisibleQuestionKeys(definition, values));
}

function activeQuestions(questions: RecordValue[]): RecordValue[] {
  const activeKeys = activeQuestionSet(questions);
  return questions.filter((question) => {
    const questionKey = questionKeyOf(question);
    return questionKey !== null && activeKeys.has(questionKey);
  });
}

function safeActiveQuestions(questions: RecordValue[]): RecordValue[] | null {
  try {
    return activeQuestions(questions);
  } catch (error) {
    if (error instanceof QuestionnaireDefinitionError) return [];
    throw error;
  }
}

export function questionnaireState(document: RecordValue): QuestionnaireStatus {
  const questions = safeActiveQuestions(questionsOf(document)) ?? [];
  if (questions.length > 0 && questions.every((question) => isSubmittedAnswer(question.answer))) return "submitted";
  return questions.some((question) => hasValue(question.answer)) ? "draft" : "not-started";
}

/**
 * Applies the record-native state only after the closed repository query has
 * established the caller's authorisation and search scope. The resulting
 * projection is shared by collection rows and their authoritative total.
 */
export function projectQuestionnaireCollection(
  documents: readonly RecordValue[],
  status?: QuestionnaireStatus,
  sort: readonly QuestionnaireSort[] = ["updatedAt:desc"],
): RecordValue[] {
  const projected = documents
    .filter((document) => status === undefined || questionnaireState(document) === status)
    .map((document) => projectQuestionnaire(document));
  return projected.sort((left, right) => {
    for (const entry of sort) {
      const [field, direction] = entry.split(":") as ["updatedAt" | "questionnaireNumber" | "title" | "state", "asc" | "desc"];
      const leftValue = String(left[field] ?? "");
      const rightValue = String(right[field] ?? "");
      const comparison = leftValue.localeCompare(rightValue);
      if (comparison !== 0) return direction === "asc" ? comparison : -comparison;
    }
    return String(left.documentId ?? "").localeCompare(String(right.documentId ?? ""));
  });
}

/*
 * The latest reversal facts are authorised for both the owning Requestor and a
 * reviewing analyst, so they belong in the shared projection. Only the acting
 * identity's documentId and display name cross the boundary — never the rest of
 * the IdamBox user record.
 */
function projectRevertedBy(value: unknown): RecordValue | null {
  if (!isRecord(value) || typeof value.documentId !== "string") return null;
  return {
    documentId: value.documentId,
    displayName: typeof value.displayName === "string" ? value.displayName : null,
  };
}

/*
 * The events a timeline projection emits, parsed from the stored log. A future
 * event kind is harmless narrative data: it is omitted while recognised events
 * are kept. Any other malformed envelope still fails closed to no events.
 */
function projectableGovernanceEvents(document: RecordValue): GovernanceEvent[] {
  let events;
  try {
    events = parseGovernanceLog(document.governanceLog);
  } catch {
    if (!Array.isArray(document.governanceLog) || document.governanceLog.length > GOVERNANCE_LOG_MAX_ENTRIES) return [];
    const known = document.governanceLog.filter((value) => isRecord(value) && (GOVERNANCE_EVENT_KINDS as readonly string[]).includes(String(value.kind)));
    try {
      events = known.map(parseGovernanceEvent);
    } catch {
      return [];
    }
  }
  return events
    .filter((event) => (GOVERNANCE_EVENT_KINDS as readonly string[]).includes(event.kind))
    .slice(0, GOVERNANCE_LOG_MAX_ENTRIES);
}

/**
 * The distinct acting identities of the events the timeline projection emits,
 * in first-seen order: exactly the ids an analyst read looks up, once, to name
 * them (Phase 8 D-31).
 */
export function governanceActorIds(document: RecordValue): string[] {
  return [...new Set(projectableGovernanceEvents(document).map((event) => event.by))];
}

/* A Strapi string column's width, and the bound the web boundary parses an actor's display name against. */
const ACTOR_DISPLAY_NAME_MAX_LENGTH = 255;

/**
 * Builds the display-name resolver from the IdamBox users that one lookup of
 * `governanceActorIds` returned. Only a non-blank name within the column width
 * counts as a name. Any other value resolves to null, exactly like an id the
 * lookup did not return because the user is unknown or inactive, so the
 * timeline falls back to its neutral wording instead of failing the read.
 */
export function governanceActorNames(users: readonly unknown[]): (documentId: string) => string | null {
  const names = new Map<string, string>();
  for (const user of users) {
    if (!isRecord(user) || typeof user.documentId !== "string") continue;
    const { displayName } = user;
    if (typeof displayName === "string" && displayName.trim().length > 0 && displayName.length <= ACTOR_DISPLAY_NAME_MAX_LENGTH) {
      names.set(user.documentId, displayName);
    }
  }
  return (documentId) => names.get(documentId) ?? null;
}

/*
 * Names the question an analyst timeline event concerns (D-17). A snapshot written with the
 * event always wins. An event without one, written before snapshots existed, is resolved by its
 * key against every question the read populated, removed ones included, but only when it is not
 * older than the questionnaire's latest generation: keys are not versioned, so an older event's
 * key may belong to a question set that a replacement has since discarded. Such an event, an
 * unknown key, or a generation date that cannot be read names no question, and the timeline reads
 * it as a question from an earlier version. A resolved text is bounded like a snapshot.
 */
function questionTextResolver(document: RecordValue): (event: GovernanceEvent) => string | undefined {
  const generatedDate = document.generatedDate instanceof Date ? document.generatedDate.toISOString() : document.generatedDate;
  const generatedAt = typeof generatedDate === "string" && generatedDate.length > 0 ? Date.parse(generatedDate) : null;
  const unreadableGeneration = generatedDate !== null && generatedDate !== undefined && (generatedAt === null || Number.isNaN(generatedAt));
  const texts = new Map<string, string>();
  for (const question of questionsOf(document)) {
    const questionKey = questionKeyOf(question);
    if (questionKey !== null && typeof question.questionText === "string" && question.questionText.trim().length > 0 && !texts.has(questionKey)) {
      texts.set(questionKey, questionTextSnapshot(question.questionText));
    }
  }
  return (event) => {
    if (event.questionText !== undefined) return event.questionText;
    if (event.questionKey === undefined || unreadableGeneration) return undefined;
    if (generatedAt !== null && Date.parse(event.at) < generatedAt) return undefined;
    return texts.get(event.questionKey);
  };
}

function withQuestionText(questionText: string | undefined): RecordValue {
  return questionText === undefined ? {} : { questionText };
}

/*
 * The revision history is a narrative projection, never an authorization
 * input. It is read only after the questionnaire route has resolved the
 * caller's existing ownership or collection-scope grant.
 *
 * `resolveDisplayName` names an analyst actor. The caller builds it from its
 * one lookup (`governanceActorIds`, `governanceActorNames`); the projection
 * itself stays pure and consults it only for an analyst reader, because a
 * Requestor's timeline never carries the actor.
 */
export function projectGovernanceEvents(
  document: RecordValue,
  actor: QuestionnaireActor,
  resolveDisplayName?: (documentId: string) => string | null,
): RecordValue[] {
  const questionText = actor === "analyst" ? questionTextResolver(document) : undefined;
  const events = projectableGovernanceEvents(document);
  // Phase 15 D-26, D-07: the Requestor's history never carries an AI kind or key, nor a change undone in its round.
  return (actor === "analyst" ? events : projectGovernanceEventsForRequestor(events))
    .map((event) => actor === "analyst"
      ? {
        kind: event.kind,
        at: event.at,
        /*
         * The log stores the acting identity as a documentId and nothing more.
         * The name comes from the caller's lookup; an id it could not name
         * (unknown, inactive, or no lookup made) keeps a null name. Reporting
         * the identifier as a display name would put an opaque string where a
         * person's name belongs and read as though it were one.
         */
        by: projectRevertedBy({ documentId: event.by, displayName: resolveDisplayName?.(event.by) ?? null }),
        ...(event.reason === undefined ? {} : { reason: event.reason }),
        ...(event.questionKey === undefined ? {} : { questionKey: event.questionKey }),
        ...withQuestionText(questionText?.(event)),
        ...(event.explanation === undefined ? {} : { explanation: event.explanation }),
        /*
         * Phase 15 D-26: the analyst projection carries every AI key the event has: which run and item a
         * confirmation or its Undo came from, and an AI request's scope, instruction or its source, provider and result.
         */
        ...(event.runId === undefined ? {} : { runId: event.runId }),
        ...(event.itemKey === undefined ? {} : { itemKey: event.itemKey }),
        ...(event.aiEdited === undefined ? {} : { aiEdited: event.aiEdited }),
        ...(event.aiUndo === undefined ? {} : { aiUndo: event.aiUndo }),
        ...(event.scope === undefined ? {} : { scope: event.scope }),
        ...(event.instruction === undefined ? {} : { instruction: event.instruction }),
        ...(event.instructionSource === undefined ? {} : { instructionSource: event.instructionSource }),
        ...(event.providerName === undefined ? {} : { providerName: event.providerName }),
        ...(event.providerVersion === undefined ? {} : { providerVersion: event.providerVersion }),
        ...(event.itemCount === undefined ? {} : { itemCount: event.itemCount }),
      }
      : {
        kind: event.kind,
        at: event.at,
        /*
         * A replacement's explanation counts analyst work the Requestor never saw (UI-SPEC §4.3), so the
         * Requestor learns only that the questionnaire was replaced, and when.
         */
        ...(event.explanation === undefined || event.kind === "regenerated" ? {} : { explanation: event.explanation }),
      });
}

/*
 * The release fact, projected for every authorised reader. Null means the
 * questionnaire has never been released. The releasing analyst crosses the
 * boundary through the same narrow identity helper the reversal facts use, so
 * no other IdamBox user field is disclosed.
 */
export function projectQuestionnaireRelease(document: RecordValue): RecordValue | null {
  const releasedAt = document.releasedAt;
  if (typeof releasedAt !== "string" || releasedAt.length === 0) return null;
  return { releasedAt, releasedBy: projectRevertedBy(document.releasedBy) };
}

/**
 * The related request as a three-state summary rather than a bag of possibly
 * undefined fields. Absent says the questionnaire has no request and discloses
 * nothing; unavailable would say one exists that this actor may not open, and
 * carries no identity. Projecting undefined identifiers for an absent relation
 * left the browser unable to tell those apart.
 *
 * Anyone authorised to read a questionnaire is authorised to read its request —
 * an analyst by grant, a Requestor because it is their own — so `unavailable`
 * is a state this projection models but does not currently produce. It is
 * declared so the contract can express it without a later shape change.
 *
 * Phase 13 D-16, D-25 and Phase 14 D-27: an available request also names who holds it, the notes figures and the files
 * figures, which only the analyst's questionnaire read loads (`loadAnalystRequestSummaryFacts`); every other projection,
 * a Requestor's included, carries null for all three.
 */
function projectAssessmentRequestRelationship(assessmentRequest: RecordValue, requestFacts?: RequestSummaryFacts): RecordValue {
  const documentId = assessmentRequest.documentId;
  if (typeof documentId !== "string" || documentId.length === 0) {
    return { availability: "absent" };
  }
  return {
    availability: "available",
    documentId,
    requestNumber: assessmentRequest.requestNumber,
    title: assessmentRequest.title,
    requestStatus: assessmentRequest.requestStatus,
    assignment: requestFacts?.assignment ?? null,
    notes: requestFacts?.notes ?? null,
    files: requestFacts?.files ?? null,
  };
}

/**
 * How many of the questionnaire's active questions hold an answer, out of how
 * many. Every reader of a questionnaire sees this one count, so the
 * questionnaire read and the owner's My requests item (D-02 item 6) agree.
 */
export function questionnaireProgress(document: RecordValue): { answered: number; total: number } {
  const questions = safeActiveQuestions(questionsOf(document)) ?? [];
  return { answered: questions.filter((question) => hasValue(question.answer)).length, total: questions.length };
}

/*
 * D-23: a questionnaire is AI-assisted when it was generated through a provider. A seeded or hand-built
 * questionnaire has neither fact, so both actors read false.
 */
export function isAiAssistedQuestionnaire(document: RecordValue): boolean {
  const generated = document.generatedDate instanceof Date || (typeof document.generatedDate === "string" && document.generatedDate.length > 0);
  return generated && typeof document.providerName === "string" && document.providerName.trim().length > 0;
}

export type AiGenerationFacts = {
  generatedAt: string | null;
  generatedBy: { documentId: string; displayName: string } | null;
  providerName: string | null;
  providerVersion: string | null;
  runId: string | null;
  /**
   * Phase 13 D-29 and Phase 14 D-36: the notes whose mark changed, and the files whose inclusion changed, since this
   * generation, for a human Security Analyst; null otherwise.
   */
  aiInputsChanged: AiInputsChanged | null;
  /**
   * Phase 15 D-28 and D-32: the questionnaire's open AI proposal items, for a human Security Analyst who did not raise the
   * request; null otherwise. Absent from every other record's generation facts.
   */
  openProposals?: number | null;
};

/*
 * D-25: the run behind the latest generation, resolved at read time as the newest completed
 * questionnaire-generation run for this questionnaire. A questionnaire generated before Phase 12 has none.
 */
export async function latestCompletedGenerationRun(
  strapi: { documents: (uid: string) => { findMany: (query: RecordValue) => Promise<RecordValue[]> } },
  questionnaireId: string,
): Promise<{ documentId: string } | null> {
  const [run] = await strapi.documents("api::csrm-ai-run.csrm-ai-run").findMany({
    filters: { questionnaire: { documentId: { $eq: questionnaireId } }, operation: { $eq: "questionnaire-generation" }, status: { $eq: "completed" } },
    fields: ["documentId", "completedAt"],
    sort: ["completedAt:desc", "id:desc"],
    limit: 1,
  });
  return run && typeof run.documentId === "string" ? { documentId: run.documentId } : null;
}

/*
 * Phase 15 D-29 (S-2): the questionnaire's AI-inputs baseline, its newest completed context-wide run: a
 * questionnaire-generation or questionnaire-proposals run, so a completed questionnaire-wide proposal run clears the
 * signal and a question rewrite never does. The operation is filtered explicitly, because an assessment-draft run also
 * names the questionnaire. `generation.runId` keeps naming `latestCompletedGenerationRun` (D-27).
 */
export async function latestCompletedQuestionnaireContextRun(
  strapi: { documents: (uid: string) => { findMany: (query: RecordValue) => Promise<RecordValue[]> } },
  questionnaireId: string,
): Promise<{ documentId: string } | null> {
  const [run] = await strapi.documents("api::csrm-ai-run.csrm-ai-run").findMany({
    filters: { questionnaire: { documentId: { $eq: questionnaireId } }, operation: { $in: ["questionnaire-generation", "questionnaire-proposals"] }, status: { $eq: "completed" } },
    fields: ["documentId", "completedAt"],
    sort: ["completedAt:desc", "id:desc"],
    limit: 1,
  });
  return run && typeof run.documentId === "string" ? { documentId: run.documentId } : null;
}

/* The analyst header's generation facts (D-23); null when the questionnaire was never generated. */
export function projectAiGenerationFacts(
  document: RecordValue,
  run: { documentId: string } | null,
  generatorName: string | null,
  aiInputs: AiInputsChanged | null = null,
  openProposals?: number | null,
): AiGenerationFacts | null {
  if (!isAiAssistedQuestionnaire(document)) return null;
  const generatedAt = document.generatedDate instanceof Date ? document.generatedDate.toISOString() : String(document.generatedDate);
  const generator = isRecord(document.generatedBy) && typeof document.generatedBy.documentId === "string" ? document.generatedBy.documentId : null;
  return {
    generatedAt,
    generatedBy: generator && generatorName ? { documentId: generator, displayName: generatorName } : null,
    providerName: typeof document.providerName === "string" ? document.providerName : null,
    providerVersion: typeof document.providerVersion === "string" ? document.providerVersion : null,
    runId: run?.documentId ?? null,
    aiInputsChanged: aiInputs,
    ...(openProposals !== undefined ? { openProposals } : {}),
  };
}

/*
 * Phase 13 D-29 and Phase 14 D-36: the notes and files that changed the questionnaire's AI inputs since the AI last read
 * them (one value, `loadAiInputsChanged`), against `baselineRun`, the questionnaire's newest completed context-wide run
 * (`latestCompletedQuestionnaireContextRun`; Phase 15 D-29, S-2). Since Phase 15 that is not always the run
 * `generation.runId` names: a completed questionnaire-wide proposal run moves the baseline, never `generation.runId`.
 * Null for a questionnaire that was never generated or has no request. Callers serve it to human Security Analysts only.
 */
export async function questionnaireAiInputsChanged(
  strapi: AiInputsSignalStrapi,
  document: RecordValue,
  baselineRun: { documentId: string } | null,
): Promise<AiInputsChanged | null> {
  if (!isAiAssistedQuestionnaire(document)) return null;
  const request = isRecord(document.assessmentRequest) ? document.assessmentRequest : null;
  const requestDocumentId = request && typeof request.documentId === "string" ? request.documentId : null;
  if (!requestDocumentId) return null;
  return loadAiInputsChanged(strapi, { requestDocumentId, baselineRunId: baselineRun?.documentId ?? null, generatedDate: document.generatedDate });
}

export type QuestionAiOrigin = "generated" | "generated-edited" | "analyst-added" | "proposal-confirmed" | "proposal-edited";

/*
 * D-22: which questions are still the AI's, read from the governance log on Phase 10's change-count basis.
 * Only a generation with a run has origins; after it, an added question is the analyst's, an edited one is
 * generated-edited, and every other question is generated. A log that cannot be read gives no origins and
 * never denies the read (Pitfall 12).
 */
export function deriveQuestionAiOrigins(document: RecordValue, hasRun: boolean, questions: readonly RecordValue[] = questionsOf(document)): Map<string, QuestionAiOrigin> | null {
  if (!hasRun || !isAiAssistedQuestionnaire(document)) return null;
  let events: GovernanceEvent[];
  try {
    events = parseGovernanceLog(document.governanceLog);
  } catch (error) {
    if (error instanceof GovernanceLogError) return null;
    throw error;
  }
  const since = document.generatedDate instanceof Date ? document.generatedDate.getTime() : Date.parse(String(document.generatedDate));
  if (Number.isNaN(since)) return null;
  /*
   * Phase 15 D-27: a confirmed AI proposal and its Undo cancel out (the Undo names the same run and item), so a question
   * reads what it read before the confirmation. Of the content events that remain, in log order, the latest decides: an
   * AI-sourced add or edit reads proposal-confirmed, or proposal-edited when the analyst edited the proposal first; a
   * manual edit reads generated-edited; and a question an analyst added by hand stays analyst-added through later manual
   * edits (Phase 12's rule).
   */
  const content = events.filter((event) => event.questionKey && Date.parse(event.at) >= since && (event.kind === "question-added" || event.kind === "question-edited"));
  const cancelled = new Set<GovernanceEvent>();
  for (const [index, event] of content.entries()) {
    if (event.aiUndo !== true || !event.runId || !event.itemKey) continue;
    cancelled.add(event);
    const confirmation = content.slice(0, index).reverse().find((candidate) => !cancelled.has(candidate) && candidate.aiUndo !== true && candidate.runId === event.runId && candidate.itemKey === event.itemKey);
    if (confirmation) cancelled.add(confirmation);
  }
  const latest = new Map<string, QuestionAiOrigin>();
  for (const event of content) {
    if (cancelled.has(event) || event.aiUndo === true) continue;
    const key = event.questionKey as string;
    if (event.runId && event.itemKey) latest.set(key, event.aiEdited ? "proposal-edited" : "proposal-confirmed");
    else if (event.kind === "question-added") latest.set(key, "analyst-added");
    else if (latest.get(key) !== "analyst-added") latest.set(key, "generated-edited");
  }
  const origins = new Map<string, QuestionAiOrigin>();
  for (const question of questions) {
    const key = isRecord(question.options) && typeof question.options.questionKey === "string" ? question.options.questionKey : null;
    if (!key) continue;
    origins.set(key, latest.get(key) ?? "generated");
  }
  return origins;
}

export function projectQuestionHelpText(question: RecordValue): string | null {
  return typeof question.helpText === "string" && question.helpText.trim().length > 0 ? question.helpText.slice(0, 2_000) : null;
}

export function projectQuestionnaire(
  document: RecordValue,
  actor: QuestionnaireActor = "requestor",
  generation?: AiGenerationFacts | null,
  requestFacts?: RequestSummaryFacts,
): RecordValue {
  const { answered, total } = questionnaireProgress(document);
  const assessmentRequest = isRecord(document.assessmentRequest) ? document.assessmentRequest : {};
  return {
    documentId: document.documentId,
    questionnaireNumber: document.questionnaireNumber,
    title: document.title,
    description: document.description ?? null,
    state: questionnaireState(document),
    progress: { answered, total, percent: total ? Math.round(answered * 100 / total) : 0 },
    // D-16, D-25: the assignee and notes figures are the analyst's alone.
    assessmentRequest: projectAssessmentRequestRelationship(assessmentRequest, actor === "analyst" ? requestFacts : undefined),
    revertReason: typeof document.revertReason === "string" ? document.revertReason : null,
    revertedAt: typeof document.revertedAt === "string" ? document.revertedAt : null,
    revertedBy: projectRevertedBy(document.revertedBy),
    release: projectQuestionnaireRelease(document),
    revision: summariseGovernanceLog(document.governanceLog),
    aiAssisted: isAiAssistedQuestionnaire(document),
    // D-23: the generation facts are the analyst's alone.
    ...(actor === "analyst" && generation ? { generation } : {}),
    updatedAt: document.updatedAt,
  };
}

/*
 * The revision facts an analyst read carries (D-16): the narrative summary every reader gets, plus how many
 * question changes analysts made since the latest generation, which a replacement would discard. Only analyst
 * paths call this; `projectQuestionnaire` serves both actors and never carries the count. A log that cannot
 * be read gives no count, so the optional field is omitted and the web says how many is unknown (WR-102).
 */
export function projectAnalystRevision(document: RecordValue): RecordValue {
  const generatedDate = document.generatedDate instanceof Date || typeof document.generatedDate === "string" ? document.generatedDate : null;
  const analystChangesSinceGeneration = countAnalystChangesSinceGeneration(document.governanceLog, generatedDate);
  return {
    ...summariseGovernanceLog(document.governanceLog),
    ...(analystChangesSinceGeneration === null ? {} : { analystChangesSinceGeneration }),
  };
}

/**
 * `answeredVisible` (Phase 15 D-30): whether an analyst may learn which questions are answered, true only in analyst review
 * and on a submitted questionnaire (`deriveProposalQuestionnaireState`), never while the Requestor is still answering.
 */
export function projectQuestions(questions: RecordValue[], actor: QuestionnaireActor, origins?: Map<string, QuestionAiOrigin> | null, answeredVisible = false): RecordValue[] {
  const active = safeActiveQuestions(questions);
  if (active === null) return [];
  const submittedBatch = active.length > 0 && active.every((question) => isSubmittedAnswer(question.answer));
  let definition;
  try { definition = parseQuestionnaireDefinition(questions); } catch { return []; }
  const deletionByDocumentId = new Map(definition.map((question) => [question.documentId, question.deleted]));
  return [...questions]
    .filter((question) => actor !== "requestor" || !deletionByDocumentId.get(String(question.documentId)))
    .sort((left, right) => {
      const leftOrder = isRecord(left.options) && typeof left.options.order === "number" ? left.options.order : 0;
      const rightOrder = isRecord(right.options) && typeof right.options.order === "number" ? right.options.order : 0;
      return leftOrder - rightOrder;
    })
    .map((question) => ({
      documentId: question.documentId,
      questionText: question.questionText,
      helpText: projectQuestionHelpText(question),
      answerType: question.answerType,
      options: question.options,
      ...(actor === "analyst" && origins && isRecord(question.options) && origins.has(String(question.options.questionKey))
        ? { aiOrigin: origins.get(String(question.options.questionKey)) }
        : {}),
      ...(deletionByDocumentId.get(String(question.documentId)) ? { deleted: deletionByDocumentId.get(String(question.documentId)) } : {}),
      answer: actor === "analyst" && !submittedBatch ? null : question.answer ?? null,
      ...(actor === "analyst" && answeredVisible ? { answered: isAnsweredValue(question.answer) } : {}),
    }));
}

export function questionnaireActor(state: unknown): QuestionnaireActor {
  if (!isRecord(state)) throw new QuestionnaireQueryError();
  const actor = (state as AuthorizationState).csrmAuthorization?.questionnaireActor;
  if (actor !== "requestor" && actor !== "analyst") throw new QuestionnaireQueryError();
  return actor;
}
