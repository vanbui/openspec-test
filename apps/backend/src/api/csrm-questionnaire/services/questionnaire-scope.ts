import {
  getVisibleQuestionKeys,
  parseQuestionnaireDefinition,
  QuestionnaireDefinitionError,
  type QuestionnaireValue,
} from "./questionnaire-definition";
import {
  GOVERNANCE_LOG_MAX_ENTRIES,
  GOVERNANCE_EVENT_KINDS,
  parseGovernanceEvent,
  parseGovernanceLog,
  summariseGovernanceLog,
} from "./questionnaire-governance-log";

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
  const decision = authorization(state);
  assertOnlyKeys(query, ["q", "status", "sort", "page", "pageSize"]);
  const page = positiveInteger(query.page, 1, 1_000_000);
  const pageSize = positiveInteger(query.pageSize, 25, 100);
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
      start: (page - 1) * pageSize,
      limit: pageSize,
    },
    pagination: { page, pageSize },
    sort,
    ...(status === undefined ? {} : { status: status as QuestionnaireStatus }),
  };
}

function answerValue(answer: unknown): unknown {
  return isRecord(answer) ? answer.value : null;
}

function hasValue(answer: unknown): boolean {
  const value = answerValue(answer);
  return value !== null && value !== "" && (!Array.isArray(value) || value.length > 0);
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
    .map(projectQuestionnaire);
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
 * The revision history is a narrative projection, never an authorization
 * input. It is read only after the questionnaire route has resolved the
 * caller's existing ownership or collection-scope grant.
 */
export function projectGovernanceEvents(document: RecordValue, actor: QuestionnaireActor): RecordValue[] {
  let events;
  try {
    events = parseGovernanceLog(document.governanceLog);
  } catch {
    /* A future event kind is harmless narrative data: omit it while preserving
       recognised events. Any other malformed envelope still fails closed. */
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
    .slice(0, GOVERNANCE_LOG_MAX_ENTRIES)
    .map((event) => actor === "analyst"
      ? {
        kind: event.kind,
        at: event.at,
        /*
         * The log stores the acting identity as a documentId and nothing more,
         * so the name is genuinely unknown here. Reporting the identifier as a
         * display name would put an opaque string where a person's name belongs
         * and read as though it were one; resolving the name needs a lookup
         * this projection does not perform.
         */
        by: projectRevertedBy({ documentId: event.by, displayName: null }),
        ...(event.reason === undefined ? {} : { reason: event.reason }),
        ...(event.questionKey === undefined ? {} : { questionKey: event.questionKey }),
        ...(event.explanation === undefined ? {} : { explanation: event.explanation }),
      }
      : {
        kind: event.kind,
        at: event.at,
        ...(event.explanation === undefined ? {} : { explanation: event.explanation }),
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
 */
function projectAssessmentRequestRelationship(assessmentRequest: RecordValue): RecordValue {
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
  };
}

export function projectQuestionnaire(document: RecordValue): RecordValue {
  const allQuestions = questionsOf(document);
  const questions = safeActiveQuestions(allQuestions) ?? [];
  const answered = questions.filter((question) => hasValue(question.answer)).length;
  const assessmentRequest = isRecord(document.assessmentRequest) ? document.assessmentRequest : {};
  return {
    documentId: document.documentId,
    questionnaireNumber: document.questionnaireNumber,
    title: document.title,
    description: document.description ?? null,
    state: questionnaireState(document),
    progress: { answered, total: questions.length, percent: questions.length ? Math.round(answered * 100 / questions.length) : 0 },
    assessmentRequest: projectAssessmentRequestRelationship(assessmentRequest),
    revertReason: typeof document.revertReason === "string" ? document.revertReason : null,
    revertedAt: typeof document.revertedAt === "string" ? document.revertedAt : null,
    revertedBy: projectRevertedBy(document.revertedBy),
    release: projectQuestionnaireRelease(document),
    revision: summariseGovernanceLog(document.governanceLog),
    updatedAt: document.updatedAt,
  };
}

export function projectQuestions(questions: RecordValue[], actor: QuestionnaireActor): RecordValue[] {
  const active = safeActiveQuestions(questions);
  if (active === null) return [];
  const submittedBatch = active.length > 0 && active.every((question) => isSubmittedAnswer(question.answer));
  let definition;
  try { definition = parseQuestionnaireDefinition(questions); } catch { return []; }
  const deletionByDocumentId = new Map(definition.map((question) => [question.documentId, question.deleted]));
  return [...questions]
    .sort((left, right) => {
      const leftOrder = isRecord(left.options) && typeof left.options.order === "number" ? left.options.order : 0;
      const rightOrder = isRecord(right.options) && typeof right.options.order === "number" ? right.options.order : 0;
      return leftOrder - rightOrder;
    })
    .map((question) => ({
      documentId: question.documentId,
      questionText: question.questionText,
      answerType: question.answerType,
      options: question.options,
      ...(deletionByDocumentId.get(String(question.documentId)) ? { deleted: deletionByDocumentId.get(String(question.documentId)) } : {}),
      answer: actor === "analyst" && !submittedBatch ? null : question.answer ?? null,
    }));
}

export function questionnaireActor(state: unknown): QuestionnaireActor {
  if (!isRecord(state)) throw new QuestionnaireQueryError();
  const actor = (state as AuthorizationState).csrmAuthorization?.questionnaireActor;
  if (actor !== "requestor" && actor !== "analyst") throw new QuestionnaireQueryError();
  return actor;
}
