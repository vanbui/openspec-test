import {
  assertRiskRegisterScope,
  projectRiskRegisterItem,
  type RiskRegisterHydrateRelation,
  type RiskRegisterItem,
  type RiskRegisterRepository,
} from "../../api/csrm-risk/services/risk-register";
import {
  parseRiskRegisterExportQuery,
  RiskRegisterQueryError,
  type RiskRegisterExportQuery,
  type RiskRegisterFilters,
} from "../../api/csrm-risk/services/risk-register-query";
import {
  AssessmentRequestQueryError,
  parseAnalystReviewExportQuery,
  projectAnalystReviewRequest,
  type AnalystReviewExportQuery,
  type ReviewQueueSort,
} from "../../api/csrm-assessment-request/services/collection-scope";
import {
  applyMyRequestsOrder,
  myRequestsReader,
  MyRequestsQueryError,
  ownRequestorId,
  parseMyRequestsExportQuery,
  projectMyRequest,
  type MyRequestsQuery,
  type MyRequestsReader,
} from "../../api/csrm-assessment-request/services/my-requests";
import { createReviewQueueRepository, MAX_REVIEW_QUEUE_HYDRATION } from "../../api/csrm-assessment-request/services/review-queue-repository";
import {
  buildQuestionnaireExportQuery,
  loadCompleteQuestionnaireScope,
  projectQuestionnaire,
  projectQuestionnaireCollection,
  QuestionnaireQueryError,
  type QuestionnaireExportQuery,
} from "../../api/csrm-questionnaire/services/questionnaire-scope";
import { AlertQueryError, parseAlertExportQuery, type AlertExportQuery } from "../../api/csrm-analyst-insight/services/alert-query";
import { createAlertRepository, projectAlertRow, type AlertItem } from "../../api/csrm-analyst-insight/services/alert-repository";
import { AnalystInsightError, assertAnalystInsightScope } from "../../api/csrm-analyst-insight/services/insight-scope";
import { ALERT_KINDS } from "../insights/alert-rules";
import { ALERT_PAGE_SIZES } from "../insights/insight-constants";
import { activeQuestionnaireGenerationRequestIds } from "../../api/csrm-questionnaire/services/questionnaire-generation-workflow";
import {
  AssessmentScopeError,
  assertAnalystAssessmentScope,
  assessmentOwnerCollectionDocumentId,
  buildAssessmentExportQuery,
  projectAssessmentSummary,
  projectRequestorAssessmentSummary,
  type AssessmentExportQuery,
  type AssessmentRiskSummary,
} from "../../api/csrm-assessment/services/assessment-scope";
import { isReadableReleasedAssessment } from "../../api/csrm-assessment/services/released-assessment-read";
import { riskSummariesFor } from "../../api/csrm-assessment/controllers/csrm-assessment";
import { isActiveRisk } from "../active-risk";
import type { AdministrationKind } from "../../api/csrm-administration/services/administration-config";
import {
  AdministrationValidationError,
  parseAdministrationExportQuery,
  projectAdministrationRecord,
  type AdministrationExportQuery,
  type AdministrationQuery,
} from "../../api/csrm-administration/services/administration-query";
import { createStrapiAdministrationRepository } from "../../api/csrm-administration/services/administration-repository";
import { assertAdministrationScope } from "../../api/csrm-administration/services/administration-workflow";
import { ExportForbiddenError, ExportQueryError } from "./export-errors";
import { exportLabel, exportViewColumns, exportViewMeta, type ExportColumn } from "./export-vocabulary";

/*
 * The export view registry (19-04; D-05, D-36). A view is a thin adapter over its list: the list's own scope check,
 * export parser, repository and projection. The pipeline (run-export.ts) never reads a record itself, so an export
 * holds exactly the rows the list would page through, and a later phase adds a view here rather than a new pipeline.
 */

/** One cell's value before the vocabulary types it: text, a number, a flag, or null for an empty cell. */
export type ExportCellValue = string | number | boolean | null;

/** What the About sheet says about the query (19-UI-SPEC §3.3): the list's own chip labels. */
export type ExportQueryDescription = {
  readonly search: string | null;
  readonly filters: readonly { readonly label: string; readonly value: string }[];
  readonly sort: { readonly label: string; readonly direction: "ascending" | "descending" } | null;
};

/** What the log records about the query (D-18): the closed, parsed values, never the raw query string. */
export type ExportAuditQuery = {
  readonly filters: Readonly<Record<string, string | readonly string[]>>;
  readonly search: string | null;
  readonly sort: string | null;
};

type Document = Record<string, unknown>;

/**
 * A list view an export can run. `P` is the list's parsed export query; `R` the projected row the extractors read.
 * Every method that reaches the list's repository takes the pipeline's one UTC `today` (G-16).
 */
export type ListExportView<P, R> = {
  readonly key: string;
  readonly slug: string;
  readonly heading: string;
  /** The list's own scope check; its refusal (403) is a policy denial, never an export event. */
  assertScope(state: unknown): void;
  /** The list's export parser: its filters and sort, never a page. A refusal is an ExportQueryError. */
  parseExportQuery(query: Readonly<Record<string, unknown>>, state: unknown): P;
  auditQuery(parsed: P): ExportAuditQuery;
  describe(parsed: P): Promise<ExportQueryDescription>;
  count(parsed: P, today: string): Promise<number>;
  selectIds(parsed: P, limit: number, today: string): Promise<readonly string[]>;
  /** The documents of `ids`, in the order of `ids`, with only the relations the chosen columns read. */
  hydrate(ids: readonly string[], columns: readonly ExportColumn[]): Promise<readonly Document[]>;
  project(document: Document, today: string): R;
  readonly extractors: Readonly<Record<string, (row: R) => ExportCellValue>>;
};

/** A register row: the list's own projection, and the hydrated document for the columns the list does not show. */
export type RiskRegisterExportRow = { readonly item: RiskRegisterItem; readonly document: Document };

function isRecord(value: unknown): value is Document {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * The hydrated documents in the order of `ids` (BE1-10, Phase 19 code review): every view's one rule for a row that
 * disappears between selecting the ids and hydrating them. As the lists show it ("a record removed between the two
 * reads is not shown"), the row is left out, and the file, its row count and its log line count what was written.
 */
export function inIdOrder<T extends { readonly documentId?: unknown }>(ids: readonly string[], documents: readonly T[]): T[] {
  const byId = new Map(documents.map((document) => [document.documentId, document]));
  return ids.flatMap((id) => {
    const document = byId.get(id);
    return document ? [document] : [];
  });
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

function relationText(value: unknown, field: string): string | null {
  return isRecord(value) ? textOf(value[field]) : null;
}

/** The register's State column (Phase 16 D-08): withdrawn when the Risk is not active, else closed by its closure date. */
function riskStateOf(document: Document): "open" | "closed" | "withdrawn" {
  if (!isActiveRisk(document)) return "withdrawn";
  return document.closureDate ? "closed" : "open";
}

function requestOf(document: Document): Document | null {
  const assessment = document.assessment;
  return isRecord(assessment) && isRecord(assessment.assessmentRequest) ? assessment.assessmentRequest : null;
}

/** The register's extractors, one per vocabulary column. The due state is the projection's, never recomputed (G-16). */
const RISK_REGISTER_EXTRACTORS: Readonly<Record<string, (row: RiskRegisterExportRow) => ExportCellValue>> = Object.freeze({
  riskNumber: ({ item }) => item.riskNumber,
  riskStatement: ({ item }) => item.riskStatement,
  inherentRating: ({ item }) => item.inherentRating,
  residualRating: ({ item }) => item.residualRating,
  treatmentStatus: ({ item }) => item.treatmentStatus,
  treatmentOwner: ({ item }) => item.treatmentOwner?.displayName ?? null,
  targetDate: ({ item }) => item.targetDate,
  assessment: ({ item }) => item.assessment.assessmentNumber,
  stage: ({ item }) => item.stage,
  accepted: ({ item }) => item.accepted,
  treatmentDueState: ({ item }) => item.treatmentDueState,
  requestTitle: ({ item }) => item.assessment.title,
  assessmentType: ({ document }) => textOf(requestOf(document)?.assessmentType),
  riskOwner: ({ document }) => relationText(document.riskOwner, "displayName"),
  riskType: ({ document }) => relationText(document.riskType, "name"),
  treatmentAction: ({ item }) => item.treatmentAction,
  treatmentPlan: ({ document }) => textOf(document.treatmentPlan),
  informationSystem: ({ document }) => relationText(document.informationSystemImpacted, "name"),
  informationAsset: ({ document }) => relationText(document.informationAssetImpacted, "name"),
  treatmentResolveDate: ({ document }) => textOf(document.treatmentResolveDate),
  riskState: ({ document }) => riskStateOf(document),
});

/** The relation each column reads beyond the list's own hydrate. */
const RISK_REGISTER_COLUMN_RELATIONS: Readonly<Record<string, RiskRegisterHydrateRelation>> = Object.freeze({
  riskOwner: "riskOwner",
  riskType: "riskType",
  informationSystem: "informationSystemImpacted",
  informationAsset: "informationAssetImpacted",
});

/** The register's filter chip words (features/risks/risk-register.tsx), for the values no label family holds. */
const RATING_NONE = "Not rated";
const NOT_PROVIDED = "Not provided";
const MITIGATION_STATUS_LABELS: Readonly<Record<string, string>> = Object.freeze({
  none: "No mitigation controls",
  any: "Any mitigation control",
});

function ratingLabel(value: string): string {
  return value === "none" ? RATING_NONE : value;
}

/** The register's chips, in the order the list shows them (search apart). */
function registerFilters(filters: RiskRegisterFilters, selected: Record<string, { documentId: string; label: string }>): ExportQueryDescription["filters"] {
  const named = (key: "riskOwner" | "treatmentOwner" | "assessment" | "system" | "asset") => {
    const value = filters[key];
    return value === undefined ? undefined : selected[key]?.documentId === value ? selected[key].label : value;
  };
  const chips: Array<[string, string | undefined]> = [
    ["Treatment status", filters.treatmentStatus === undefined ? undefined : filters.treatmentStatus === "none" ? NOT_PROVIDED : exportLabel("treatmentStatus", filters.treatmentStatus)],
    ["Inherent rating", filters.inherentRating && ratingLabel(filters.inherentRating)],
    ["Residual rating", filters.residualRating && ratingLabel(filters.residualRating)],
    ["Risk owner", named("riskOwner")],
    ["Treatment owner", named("treatmentOwner")],
    ["Related assessment", named("assessment")],
    ["Impacted system", named("system")],
    ["Impacted system", filters.impactedSystem && "None"],
    ["Impacted asset", named("asset")],
    ["Mitigation-control status", filters.mitigationStatus && (MITIGATION_STATUS_LABELS[filters.mitigationStatus] ?? filters.mitigationStatus)],
    ["Risk state", filters.state && exportLabel("riskState", filters.state)],
    ["Stage", filters.stage && exportLabel("riskStage", filters.stage)],
    ["Treatment action", filters.treatmentAction],
    ["Due state", filters.dueState && exportLabel("treatmentDueState", filters.dueState)],
    ["Mitigation-control effectiveness", filters.mitigationEffectiveness && (filters.mitigationEffectiveness === "none" ? NOT_PROVIDED : filters.mitigationEffectiveness)],
    ["Target date from", filters.targetDateFrom],
    ["Target date to", filters.targetDateTo],
  ];
  return chips.filter((chip): chip is [string, string] => chip[1] !== undefined).map(([label, value]) => ({ label, value }));
}

/**
 * The Risk register's export view (D-05; Phase 16 D-08, D-13, D-14). It reads Risks only through the register's own
 * repository, so the export runs the register's one ruled base query: active Risks by default, and the withdrawn
 * Risks alone for the explicit `state=withdrawn`. No module here queries the Risk table itself.
 */
export function riskRegisterExportView(repository: RiskRegisterRepository): ListExportView<RiskRegisterExportQuery, RiskRegisterExportRow> {
  const meta = exportViewMeta("risk-register");
  return {
    key: meta.key,
    slug: meta.slug,
    heading: meta.heading,
    assertScope: (state) => assertRiskRegisterScope(state),
    parseExportQuery(query, state) {
      assertRiskRegisterScope(state);
      try {
        return parseRiskRegisterExportQuery(query);
      } catch (error) {
        if (error instanceof RiskRegisterQueryError) throw new ExportQueryError();
        throw error;
      }
    },
    auditQuery({ filters, sort }) {
      const { q, ...rest } = filters;
      const audited: Record<string, string> = {};
      for (const [key, value] of Object.entries(rest)) if (typeof value === "string") audited[key] = value;
      return { filters: audited, search: q ?? null, sort: `${sort.field}:${sort.direction}` };
    },
    async describe({ filters, sort }) {
      const selected = (await repository.selectedLabels?.(filters)) ?? {};
      const sortColumn = meta.columns.find((column) => column.key === sort.field);
      return {
        search: filters.q ?? null,
        filters: registerFilters(filters, selected),
        sort: sortColumn ? { label: sortColumn.label, direction: sort.direction === "asc" ? "ascending" : "descending" } : null,
      };
    },
    count: ({ filters }, today) => repository.count(filters, today),
    selectIds: ({ filters, sort }, limit, today) => repository.selectPage({ filters, sort, offset: 0, limit, today }),
    async hydrate(ids, columns) {
      const relations = columns.flatMap((column) => {
        const relation = RISK_REGISTER_COLUMN_RELATIONS[column.key];
        return relation ? [relation] : [];
      });
      return inIdOrder(ids, await repository.hydrate(ids, { relations }));
    },
    project: (document, today) => ({ item: projectRiskRegisterItem(document, today), document }),
    extractors: RISK_REGISTER_EXTRACTORS,
  };
}

/** A text value, or null for an absent or empty one. */
function textOrNull(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

type SortKey = { readonly field: string; readonly direction: "asc" | "desc" };

/** The sort the log records: each closed `field:direction`, joined in order. */
function sortText(sort: readonly SortKey[]): string {
  return sort.map(({ field, direction }) => `${field}:${direction}`).join(",");
}

/** The About sheet's Sorted by: the first sort key's column label. */
function sortDescription(sort: SortKey | undefined, labels: Readonly<Record<string, string>>): ExportQueryDescription["sort"] {
  const label = sort ? labels[sort.field] : undefined;
  return sort && label ? { label, direction: sort.direction === "asc" ? "ascending" : "descending" } : null;
}

/** Chips in the list's order, the absent ones dropped. */
function chipsOf(chips: ReadonlyArray<readonly [string, string | undefined]>): ExportQueryDescription["filters"] {
  return chips.filter((chip): chip is readonly [string, string] => chip[1] !== undefined).map(([label, value]) => ({ label, value }));
}

/** A queue or My requests item: the list's own projection, as the extractors read it. */
export type RequestListExportRow = Readonly<Record<string, unknown>>;

/** The display name of a projected person (`{ documentId, displayName }`), or null for nobody. */
function personName(value: unknown): string | null {
  return isRecord(value) ? textOrNull(value.displayName) : null;
}

/** The Requests extractors, one per vocabulary column, each from the queue's own projection (D-05, D-07). */
const REQUESTS_EXTRACTORS: Readonly<Record<string, (row: RequestListExportRow) => ExportCellValue>> = Object.freeze({
  requestNumber: (row) => textOrNull(row.requestNumber),
  title: (row) => textOrNull(row.title),
  requestor: (row) => textOrNull(row.requestorName),
  assessmentType: (row) => textOrNull(row.assessmentType),
  businessCriticality: (row) => textOrNull(row.businessCriticality),
  status: (row) => textOrNull(row.requestStatus),
  // Phase 13 (D-13): who holds the request, by display name; an unassigned request is an empty cell.
  assignee: (row) => personName(row.assignee),
  dueDate: (row) => textOrNull(row.dueDate),
  ageDays: (row) => (typeof row.daysSinceSubmission === "number" ? row.daysSinceSubmission : null),
  submittedAt: (row) => textOrNull(row.submittedDate),
});

/** The queue's chip words (features/assessments/assessment-list.tsx), for the About sheet. */
const REVIEW_QUEUE_LABELS: Readonly<Record<string, string>> = Object.freeze({
  "requires-attention": "Requires attention",
  "awaiting-requestor": "Awaiting Requestor",
  "generation-in-progress": "Generation in progress",
  open: "All open",
  released: "Released",
  all: "All requests",
});
const REVIEW_ASSIGNEE_LABELS: Readonly<Record<string, string>> = Object.freeze({ me: "Me", unassigned: "Not picked up" });
/** The queue's sort fields as the Requests columns name them. */
const REQUESTS_SORT_LABELS: Readonly<Record<ReviewQueueSort["field"], string>> = Object.freeze({
  dueDate: "Due date",
  submittedDate: "Submitted",
  requestNumber: "Request",
  title: "Title",
  requestStatus: "Status",
  updatedAt: "Updated",
});

/** No export column reads unread notes or the pick-up offer, so the queue's projection is given neither. */
const NO_UNREAD_NOTES: ReadonlyMap<string, number> = new Map();
const NO_VIEWER = Object.freeze({ documentId: "", humanAnalyst: false, eligibleHumanAnalyst: false });

/**
 * The analyst review queue's export view (19-07; D-04, D-05, D-07). It runs the queue's own parser (the export variant,
 * which refuses a page), the queue's one database definition (review-queue-repository.ts) and its projection, so the
 * file holds exactly the rows the queue pages through, in its order, Phase 13's assignee and notes filters included.
 * The active questionnaire generation snapshot is read once per export, so the count and the ids agree. It reads no
 * Risk, and a request's notes are never a column.
 */
export function requestsExportView(strapi: unknown): ListExportView<AnalystReviewExportQuery, RequestListExportRow> {
  const meta = exportViewMeta("requests");
  const repository = createReviewQueueRepository(strapi);
  let activeSnapshot: readonly string[] | null = null;
  // As the list reads it: only the two queues that read active questionnaire generation take the registry's snapshot.
  const activeIds = (bucket: string): readonly string[] => {
    if (bucket !== "generation-in-progress" && bucket !== "requires-attention") return [];
    activeSnapshot ??= activeQuestionnaireGenerationRequestIds(strapi as never);
    return activeSnapshot;
  };
  const assertScope = (state: unknown): void => {
    const facts = isRecord(state) && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
    if (facts?.assessmentReviewCollectionScope !== "all") throw new ExportForbiddenError();
  };
  return {
    key: meta.key,
    slug: meta.slug,
    heading: meta.heading,
    assertScope,
    parseExportQuery(query, state) {
      assertScope(state);
      try {
        return parseAnalystReviewExportQuery(query, state);
      } catch (error) {
        if (error instanceof AssessmentRequestQueryError) throw new ExportQueryError();
        throw error;
      }
    },
    auditQuery({ filters, sort }) {
      const { q, bucket, ...rest } = filters;
      const audited: Record<string, string> = { queue: bucket };
      for (const [key, value] of Object.entries(rest)) if (typeof value === "string") audited[key] = value;
      return { filters: audited, search: q ?? null, sort: sortText(sort) };
    },
    async describe({ filters, sort }) {
      return {
        search: filters.q ?? null,
        filters: chipsOf([
          ["Queue", REVIEW_QUEUE_LABELS[filters.bucket] ?? filters.bucket],
          ["Status", filters.requestStatus && exportLabel("requestStatus", filters.requestStatus)],
          ["Assigned to", filters.assignee && REVIEW_ASSIGNEE_LABELS[filters.assignee]],
          ["Notes", filters.notes && "New notes"],
          ["Title", filters.title],
          ["Request", filters.requestNumber],
          ["Due date", filters.dueDate],
        ]),
        sort: sortDescription(sort[0], REQUESTS_SORT_LABELS),
      };
    },
    async count({ read }) {
      return read.kind === "outside-queue" ? 0 : repository.count(read, activeIds(read.bucket));
    },
    async selectIds({ read }, limit) {
      if (read.kind === "outside-queue") return [];
      return repository.selectPage({ ...read, pagination: { page: 1, pageSize: limit } }, activeIds(read.bucket));
    },
    async hydrate(ids) {
      // The queue's own hydration (people as a documentId and a display name alone), in the batches it allows.
      const documents: Document[] = [];
      for (let start = 0; start < ids.length; start += MAX_REVIEW_QUEUE_HYDRATION) {
        documents.push(...await repository.hydrate(ids.slice(start, start + MAX_REVIEW_QUEUE_HYDRATION)));
      }
      return documents;
    },
    project: (document, today) => projectAnalystReviewRequest(document, today, NO_VIEWER, NO_UNREAD_NOTES),
    extractors: REQUESTS_EXTRACTORS,
  };
}

/** The My requests extractors, one per vocabulary column, each from the list's own projection (D-05, D-06, D-07). */
const MY_REQUESTS_EXTRACTORS: Readonly<Record<string, (row: RequestListExportRow) => ExportCellValue>> = Object.freeze({
  requestNumber: (row) => textOrNull(row.requestNumber),
  title: (row) => textOrNull(row.title),
  status: (row) => textOrNull(row.requestStatus),
  // The Security Analyst who holds the request, by display name alone (D-17); nobody is an empty cell.
  assignee: (row) => personName(row.assignee),
  // The server's own next-step sentence for the Requestor, never recomputed.
  nextStep: (row) => (isRecord(row.nextAction) ? textOrNull(row.nextAction.summary) : null),
  dueDate: (row) => textOrNull(row.dueDate),
  updatedAt: (row) => textOrNull(row.updatedAt),
  // D-20: who holds the request, worded by the requestHolder family.
  holder: (row) => textOrNull(row.holder),
});

/** My requests' sort fields as its columns name them. */
const MY_REQUESTS_SORT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  updatedAt: "Updated",
  dueDate: "Due date",
  requestNumber: "Request ID",
  title: "Title",
});

/**
 * My requests' parsed export query, the owner the policy decided (never a query value; T-19-23) and the list's own
 * owner-bound reader for that query.
 */
export type MyRequestsExportQuery = { readonly query: MyRequestsQuery; readonly requestorId: number; readonly reader: MyRequestsReader };

/**
 * The My requests export view (19-07; D-04, D-06, D-16). Every person, a Security Analyst included, exports only the
 * requests they raised: the owner is the numeric user id the policy resolved (`requireRequestCollectionScope`), and
 * the rows come through the list's own parser, owner-bound reader, order and projection, read from the Requestor's
 * side. It reads no Risk, and a request's notes are never a column.
 */
export function myRequestsExportView(strapi: unknown): ListExportView<MyRequestsExportQuery, RequestListExportRow> {
  const meta = exportViewMeta("my-requests");
  const owner = (state: unknown): number => {
    const requestorId = ownRequestorId(state);
    if (requestorId === null) throw new ExportForbiddenError();
    return requestorId;
  };
  // The pipeline parses once, before it counts, reads ids or hydrates; hydration reads through the same owner-bound reader.
  let parsedReader: MyRequestsReader | null = null;
  return {
    key: meta.key,
    slug: meta.slug,
    heading: meta.heading,
    assertScope: (state) => { owner(state); },
    parseExportQuery(query, state) {
      const requestorId = owner(state);
      let parsed: MyRequestsQuery;
      try {
        parsed = parseMyRequestsExportQuery(query);
      } catch (error) {
        if (error instanceof MyRequestsQueryError) throw new ExportQueryError();
        throw error;
      }
      parsedReader = myRequestsReader(strapi, requestorId, parsed);
      return { query: parsed, requestorId, reader: parsedReader };
    },
    auditQuery({ query }) {
      const filters: Record<string, string> = {};
      if (query.status !== undefined) filters.status = query.status;
      if (query.holder !== undefined) filters.holder = query.holder;
      if (query.notes !== undefined) filters.notes = query.notes;
      return { filters, search: query.q ?? null, sort: sortText([query.sort]) };
    },
    async describe({ query }) {
      return {
        search: query.q ?? null,
        filters: chipsOf([
          ["Status", query.status && exportLabel("requestStatus", query.status)],
          ["Show", query.holder && exportLabel("requestHolder", query.holder)],
          ["Notes", query.notes && "New notes"],
        ]),
        sort: sortDescription(query.sort, MY_REQUESTS_SORT_LABELS),
      };
    },
    async count({ reader }) {
      const row = await reader.selected().countDistinct({ total: "r.id" }).first() as Document | undefined;
      // PostgreSQL returns COUNT as a string.
      return Number(row?.total ?? 0);
    },
    async selectIds({ reader, query }, limit) {
      const ids = reader.selected().select("r.document_id");
      applyMyRequestsOrder(ids, query.sort);
      const rows = await ids.limit(limit) as Document[];
      return rows.map((row) => row.document_id).filter((documentId): documentId is string => typeof documentId === "string");
    },
    async hydrate(ids) {
      if (!parsedReader) throw new TypeError("CSRM My requests export hydrated before its query was parsed.");
      return parsedReader.hydrate(ids);
    },
    project: (document, today) => projectMyRequest(document, today),
    extractors: MY_REQUESTS_EXTRACTORS,
  };
}

/** A questionnaire list item: the list's own projection (projectQuestionnaire), as the extractors read it. */
export type QuestionnaireListExportRow = Readonly<Record<string, unknown>>;

/** The questionnaire's Status as every surface shows it: Analyst review until it is released, then its served state. */
function questionnaireStatus(row: QuestionnaireListExportRow): string | null {
  if (row.release === null) return "analyst-review";
  return textOrNull(row.state);
}

/** The Questionnaires extractors, one per vocabulary column, each from the list's own projection (D-05, D-07). */
const QUESTIONNAIRES_EXTRACTORS: Readonly<Record<string, (row: QuestionnaireListExportRow) => ExportCellValue>> = Object.freeze({
  questionnaireNumber: (row) => textOrNull(row.questionnaireNumber),
  title: (row) => textOrNull(row.title),
  // The related request by its number; a questionnaire without one is an empty cell.
  assessmentRequest: (row) => (isRecord(row.assessmentRequest) && row.assessmentRequest.availability === "available" ? textOrNull(row.assessmentRequest.requestNumber) : null),
  status: (row) => questionnaireStatus(row),
});

/** The My questionnaires extractors: the Questionnaires columns plus Progress, as the list writes it. */
const MY_QUESTIONNAIRES_EXTRACTORS: Readonly<Record<string, (row: QuestionnaireListExportRow) => ExportCellValue>> = Object.freeze({
  ...QUESTIONNAIRES_EXTRACTORS,
  progress: (row) => {
    const progress = isRecord(row.progress) ? row.progress : null;
    return progress && typeof progress.answered === "number" && typeof progress.total === "number" ? `${progress.answered} of ${progress.total} answered` : null;
  },
});

/** The questionnaire lists' sort fields as their columns name them. */
const QUESTIONNAIRE_SORT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  updatedAt: "Updated",
  questionnaireNumber: "Questionnaire ID",
  title: "Title",
  state: "Status",
});

const QUESTIONNAIRE_UID = "api::csrm-questionnaire.csrm-questionnaire";

type QuestionnaireDocuments = {
  count: (query: Document) => Promise<number>;
  findMany: (query: Document) => Promise<Document[]>;
};

/** The parsed `field:direction` sort entries as sort keys. */
function questionnaireSortKeys(sort: readonly string[]): SortKey[] {
  return sort.map((entry) => {
    const [field, direction] = entry.split(":");
    return { field, direction: direction === "desc" ? "desc" : "asc" };
  });
}

/**
 * A questionnaire list's export view (19-08; D-04, D-05, D-07). The list reads its whole scope (the policy's decision:
 * the analyst review scope, or the caller's own questionnaires) and derives each questionnaire's state in memory, so
 * its status filter and its sort run on the projection (projectQuestionnaireCollection). The export reads that scope
 * the same way, once, through the list's own complete-scope read, and so holds exactly the list's rows in its order.
 * Without a status filter the scope's count is read first, so a scope above the cap is refused before it is loaded.
 * No answer, question or description is ever a column, and no Risk is read.
 */
function questionnaireListExportView(
  strapi: unknown,
  viewKey: "questionnaires" | "my-questionnaires",
  assertScope: (state: unknown) => void,
  extractors: Readonly<Record<string, (row: QuestionnaireListExportRow) => ExportCellValue>>,
): ListExportView<QuestionnaireExportQuery, QuestionnaireListExportRow> {
  const meta = exportViewMeta(viewKey);
  const documents = () => (strapi as { documents: (uid: string) => unknown }).documents(QUESTIONNAIRE_UID) as QuestionnaireDocuments;
  // The pipeline parses once and then counts, reads ids and hydrates the same query: the scope is read once.
  let ordered: Promise<readonly Document[]> | null = null;
  const read = (parsed: QuestionnaireExportQuery): Promise<readonly Document[]> => {
    ordered ??= (async () => {
      const scope = await loadCompleteQuestionnaireScope((query) => documents().findMany(query), parsed.dataQuery);
      const byId = new Map(scope.map((document) => [String(document.documentId), document]));
      return projectQuestionnaireCollection(scope, parsed.status, parsed.sort).flatMap((row) => {
        const document = byId.get(String(row.documentId));
        return document ? [document] : [];
      });
    })();
    return ordered;
  };
  let hydrated: ReadonlyMap<string, Document> | null = null;
  return {
    key: meta.key,
    slug: meta.slug,
    heading: meta.heading,
    assertScope,
    parseExportQuery(query, state) {
      assertScope(state);
      try {
        return buildQuestionnaireExportQuery(query, state);
      } catch (error) {
        if (error instanceof QuestionnaireQueryError) throw new ExportQueryError();
        throw error;
      }
    },
    auditQuery({ q, status, sort }) {
      const filters: Record<string, string> = {};
      if (status !== undefined) filters.status = status;
      return { filters, search: q ?? null, sort: sort.join(",") };
    },
    async describe({ q, status, sort }) {
      return {
        search: q ?? null,
        filters: chipsOf([["Status", status && exportLabel("questionnaireStatus", status)]]),
        sort: sortDescription(questionnaireSortKeys(sort)[0], QUESTIONNAIRE_SORT_LABELS),
      };
    },
    async count(parsed) {
      if (parsed.status === undefined) return documents().count(parsed.countQuery);
      return (await read(parsed)).length;
    },
    async selectIds(parsed, limit) {
      const rows = await read(parsed);
      hydrated = new Map(rows.map((document) => [String(document.documentId), document]));
      return rows.slice(0, limit).map((document) => String(document.documentId));
    },
    async hydrate(ids) {
      if (!hydrated) throw new TypeError(`CSRM ${viewKey} export hydrated before its ids were read.`);
      const byId = hydrated;
      return ids.flatMap((id) => {
        const document = byId.get(id);
        return document ? [document] : [];
      });
    },
    // The list's own projection, as projectQuestionnaireCollection writes each row.
    project: (document) => projectQuestionnaire(document),
    extractors,
  };
}

/** The analyst review scope the policy grants on the review routes (allowAnalystQuestionnaireReviewScope). */
function assertQuestionnaireReviewScope(state: unknown): void {
  const facts = isRecord(state) && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  if (facts?.questionnaireActor !== "analyst" || facts.questionnaireCollectionScope !== "all") throw new ExportForbiddenError();
}

/**
 * The analyst questionnaire review list's export view (19-08; D-04, D-05, D-13): Bob's whole review list, every
 * questionnaire in the analyst review scope, released or not, through the list's own parser, read and projection.
 */
export function questionnairesExportView(strapi: unknown): ListExportView<QuestionnaireExportQuery, QuestionnaireListExportRow> {
  return questionnaireListExportView(strapi, "questionnaires", assertQuestionnaireReviewScope, QUESTIONNAIRES_EXTRACTORS);
}

/** The owner scope the policy sets on every My list route: the caller's own numeric user id (T-19-26). */
function assertOwnQuestionnaireScope(state: unknown): void {
  const facts = isRecord(state) && isRecord(state.csrmAuthorization) ? state.csrmAuthorization : null;
  if (facts?.questionnaireCollectionScope !== "own" || !Number.isInteger(facts.questionnaireRequestorId)) throw new ExportForbiddenError();
}

/**
 * The My questionnaires export view (19-08; D-04, D-13, D-16). Every person, a Security Analyst included, exports only
 * the questionnaires of requests they raised, through the owner scope the policy resolved (never a query value) and the
 * list's own parser, read and projection; a Requestor's list holds only released questionnaires, and so does the file.
 */
export function myQuestionnairesExportView(strapi: unknown): ListExportView<QuestionnaireExportQuery, QuestionnaireListExportRow> {
  return questionnaireListExportView(strapi, "my-questionnaires", assertOwnQuestionnaireScope, MY_QUESTIONNAIRES_EXTRACTORS);
}

/** The Alerts extractors, one per vocabulary column, each from the alert list's own projection (projectAlertRow). */
const ALERTS_EXTRACTORS: Readonly<Record<string, (row: AlertItem) => ExportCellValue>> = Object.freeze({
  urgency: (row) => row.urgency,
  // D-11: the (parent) Risk's residual rating, carried apart from the urgency; a request or assessment has none.
  residualRating: (row) => row.residualRating,
  condition: (row) => row.kind,
  record: (row) => textOrNull(row.source.identifier),
  // The governing date the list derived; an undated alert is an empty cell.
  governingDate: (row) => row.governingDate,
});

/** The largest page the alert repository reads. */
const ALERT_EXPORT_PAGE_SIZE = Math.max(...ALERT_PAGE_SIZES);

/**
 * The alert list's export view (19-08; D-04, D-07, D-13; G-16). Alerts are derived on read, so the view runs the alert
 * list's own derivation for the parsed filters: the alert repository's count, and its pages in the list's order, read
 * at the repository's largest page size. The ids are the alerts' stable keys (`kind:sourceDocumentId`, as the list
 * serves them), and hydration returns those derived rows; each row is projected by the list's projectAlertRow with the
 * pipeline's one `today`, so the urgency, the condition and the dates are the list's own and nothing here derives a due
 * state. Risks are read only through the repository, whose branches apply the active-risk rule (applyActiveRisk), so a
 * withdrawn Risk raises no row.
 */
export function alertsExportView(strapi: unknown): ListExportView<AlertExportQuery, AlertItem> {
  const meta = exportViewMeta("alerts");
  const repository = createAlertRepository(strapi);
  const assertScope = (state: unknown): void => {
    try {
      assertAnalystInsightScope(state);
    } catch (error) {
      if (error instanceof AnalystInsightError) throw new ExportForbiddenError();
      throw error;
    }
  };
  const derived = new Map<string, Document>();
  return {
    key: meta.key,
    slug: meta.slug,
    heading: meta.heading,
    assertScope,
    parseExportQuery(query, state) {
      assertScope(state);
      try {
        return parseAlertExportQuery(query);
      } catch (error) {
        if (error instanceof AlertQueryError) throw new ExportQueryError();
        throw error;
      }
    },
    auditQuery({ kinds, urgency }) {
      const filters: Record<string, string | readonly string[]> = {};
      if (kinds.length < ALERT_KINDS.length) filters.kind = [...kinds];
      if (urgency !== undefined) filters.urgency = urgency;
      return { filters, search: null, sort: null };
    },
    async describe({ kinds, urgency }) {
      return {
        search: null,
        filters: chipsOf([
          ["Alert type", kinds.length < ALERT_KINDS.length ? kinds.map((kind) => exportLabel("alertKind", kind)).join(", ") : undefined],
          ["Urgency", urgency && exportLabel("alertUrgency", urgency)],
        ]),
        // The server owns the alert order (D-12): no column sorts.
        sort: null,
      };
    },
    count: ({ kinds, urgency }, today) => repository.count({ kinds, urgency, today }),
    async selectIds({ kinds, urgency }, limit, today) {
      const ids: string[] = [];
      for (let page = 1; ids.length < limit; page += 1) {
        const rows = await repository.listPage({ kinds, urgency, page, pageSize: ALERT_EXPORT_PAGE_SIZE, today });
        for (const row of rows) {
          const id = projectAlertRow(row, today).id;
          derived.set(id, row);
          ids.push(id);
        }
        if (rows.length < ALERT_EXPORT_PAGE_SIZE) break;
      }
      return ids.slice(0, limit);
    },
    async hydrate(ids) {
      return ids.flatMap((id) => {
        const row = derived.get(id);
        return row ? [row] : [];
      });
    },
    project: (row, today) => projectAlertRow(row, today),
    extractors: ALERTS_EXTRACTORS,
  };
}

/** An assessment list item: the list's own projection (projectAssessmentSummary or its Requestor variant). */
export type AssessmentListExportRow = Readonly<Record<string, unknown>>;

/** The analyst Risk assessments extractors, one per vocabulary column, each from the list's own projection. */
const RISK_ASSESSMENTS_EXTRACTORS: Readonly<Record<string, (row: AssessmentListExportRow) => ExportCellValue>> = Object.freeze({
  assessmentNumber: (row) => textOrNull(row.assessmentNumber),
  requestTitle: (row) => textOrNull(row.requestTitle),
  // The status family words approved as Released, as the list shows it.
  status: (row) => textOrNull(row.assessmentStatus),
  // Phase 16 D-13: both figures are the list's own, from riskSummariesFor, which counts and rates active Risks only.
  riskCount: (row) => (typeof row.riskCount === "number" ? row.riskCount : null),
  highestResidualRating: (row) => textOrNull(row.highestResidualRating),
  draftInitiatedBy: (row) => personName(row.generatedBy),
  releasedAt: (row) => instantText(row.approvalDate),
});

/** The My risk assessments extractors: the Requestor's own list, which never names who generated a draft. */
const MY_RISK_ASSESSMENTS_EXTRACTORS: Readonly<Record<string, (row: AssessmentListExportRow) => ExportCellValue>> = Object.freeze({
  assessmentNumber: (row) => textOrNull(row.assessmentNumber),
  requestTitle: (row) => textOrNull(row.requestTitle),
  overallRating: (row) => textOrNull(row.overallRating),
  releasedAt: (row) => instantText(row.approvalDate),
});

/** An instant as ISO text, whether the store returned a string or a Date. */
function instantText(value: unknown): string | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString();
  return textOrNull(value);
}

/** The assessment lists' sort fields as their columns name them (generatedDate has no column, so it names none). */
const ASSESSMENT_SORT_LABELS: Readonly<Record<string, string>> = Object.freeze({
  approvalDate: "Released",
  assessmentNumber: "Assessment",
  assessmentStatus: "Status",
});

/** The lists' released-date chips name the UTC calendar date, as the list's chips do (assessment-list.tsx). */
const RELEASED_DATE_CHIP = new Intl.DateTimeFormat("en-AU", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

function releasedDateChip(value: string | undefined): string | undefined {
  return value === undefined ? undefined : RELEASED_DATE_CHIP.format(new Date(`${value}T00:00:00.000Z`));
}

const ASSESSMENT_UID = "api::csrm-assessment.csrm-assessment";

type AssessmentDocuments = {
  count: (query: Document) => Promise<number>;
  findMany: (query: Document) => Promise<Document[]>;
};

/**
 * An assessment list's export view (19-10; D-04, D-05, D-13; Phase 16 D-13). It runs the list's own parser (the export
 * variant, which refuses a page), scope, count, order and populate, and projects each assessment exactly as the list
 * does: its Risks and Highest residual rating come from riskSummariesFor, the lists' one active-risk-ruled aggregate,
 * read once per hydrated batch, so a withdrawn Risk counts in neither. No Risk is read here otherwise.
 */
function assessmentListExportView(
  strapi: unknown,
  viewKey: "risk-assessments" | "my-risk-assessments",
  scope: "analyst" | "owner",
  extractors: Readonly<Record<string, (row: AssessmentListExportRow) => ExportCellValue>>,
): ListExportView<AssessmentExportQuery, AssessmentListExportRow> {
  const meta = exportViewMeta(viewKey);
  const documents = () => (strapi as { documents: (uid: string) => unknown }).documents(ASSESSMENT_UID) as AssessmentDocuments;
  const connection = () => (strapi as { db: { connection: Parameters<typeof riskSummariesFor>[0] } }).db.connection;
  const project = scope === "owner" ? projectRequestorAssessmentSummary : projectAssessmentSummary;
  // The Risk summaries of the batch hydration last read, by the assessment's numeric id.
  let summaries: ReadonlyMap<number, AssessmentRiskSummary> = new Map();
  let populate: Document | null = null;
  // The parsed scope, for the hydrate's second read (BE1-06): the list's own filters, and the owner the policy resolved.
  let scopeFilters: Document | null = null;
  let ownerDocumentId: string | null = null;
  const assertScope = (state: unknown): void => {
    try {
      if (scope === "owner") assessmentOwnerCollectionDocumentId(state);
      else assertAnalystAssessmentScope(state);
    } catch (error) {
      if (error instanceof AssessmentScopeError) throw new ExportForbiddenError();
      throw error;
    }
  };
  return {
    key: meta.key,
    slug: meta.slug,
    heading: meta.heading,
    assertScope,
    parseExportQuery(query, state) {
      assertScope(state);
      try {
        const parsed = buildAssessmentExportQuery(query, state, scope);
        populate = parsed.populate;
        scopeFilters = isRecord(parsed.countQuery.filters) ? parsed.countQuery.filters : null;
        ownerDocumentId = scope === "owner" ? assessmentOwnerCollectionDocumentId(state) : null;
        return parsed;
      } catch (error) {
        if (error instanceof AssessmentScopeError && error.status === 400) throw new ExportQueryError();
        if (error instanceof AssessmentScopeError) throw new ExportForbiddenError();
        throw error;
      }
    },
    auditQuery({ q, status, overallRating, approvedFrom, approvedTo, sort }) {
      const filters: Record<string, string> = {};
      if (status !== undefined) filters.status = status;
      if (overallRating !== undefined) filters.overallRating = overallRating;
      if (approvedFrom !== undefined) filters.approvedFrom = approvedFrom;
      if (approvedTo !== undefined) filters.approvedTo = approvedTo;
      return { filters, search: q ?? null, sort: sort.join(",") };
    },
    async describe({ q, status, overallRating, approvedFrom, approvedTo, sort }) {
      const [field, direction] = (sort[0] ?? "").split(":");
      return {
        search: q ?? null,
        filters: chipsOf([
          ["Status", status && exportLabel("assessmentStatus", status)],
          ["Overall rating", overallRating],
          ["Released from (UTC)", releasedDateChip(approvedFrom)],
          ["Released to (UTC)", releasedDateChip(approvedTo)],
        ]),
        sort: sortDescription({ field, direction: direction === "desc" ? "desc" : "asc" }, ASSESSMENT_SORT_LABELS),
      };
    },
    count: ({ countQuery }) => documents().count(countQuery),
    async selectIds({ countQuery, sort }, limit) {
      const rows = await documents().findMany({
        ...countQuery,
        // The sorted fields are read with the id, so every database orders by selected columns.
        fields: ["documentId", "generatedDate", "approvalDate", "assessmentNumber", "assessmentStatus"],
        sort: [...sort],
        start: 0,
        limit,
      });
      return rows.map((row) => row.documentId).filter((documentId): documentId is string => typeof documentId === "string");
    },
    async hydrate(ids) {
      if (!populate || !scopeFilters) throw new TypeError(`CSRM ${viewKey} export hydrated before its query was parsed.`);
      if (scope === "owner" && !ownerDocumentId) throw new TypeError(`CSRM ${viewKey} export hydrated without its owner.`);
      // BE1-06: the ids are re-read within the list's own scope and filters, and the owner's records are checked again
      // in memory by the one released-read rule, so a record that left the scope between the two reads is not written.
      const owner = ownerDocumentId;
      const read = await documents().findMany({
        filters: { $and: [structuredClone(scopeFilters), { documentId: { $in: [...ids] } }] },
        populate: structuredClone(populate),
        limit: ids.length,
      });
      const found = owner === null ? read : read.filter((document) => isReadableReleasedAssessment(document, { kind: "requestor", documentId: owner }));
      // As the list does (listDocuments): one grouped aggregate over the batch's assessments.
      summaries = await riskSummariesFor(connection(), found.map((document) => document.id));
      return inIdOrder(ids, found);
    },
    project: (document) => project(document, summaries.get(Number(document.id))),
    extractors,
  };
}

/**
 * The analyst Risk assessments export view (19-10; D-04, D-05, D-13): every assessment in the analyst assessment scope
 * the list's filters select, whole, in the list's order. Human Security Analyst only (the policy's refusal sets).
 */
export function riskAssessmentsExportView(strapi: unknown): ListExportView<AssessmentExportQuery, AssessmentListExportRow> {
  return assessmentListExportView(strapi, "risk-assessments", "analyst", RISK_ASSESSMENTS_EXTRACTORS);
}

/**
 * The My risk assessments export view (19-10; D-04, D-13, D-14): every person, a Security Analyst included, exports
 * exactly the released assessments the one record-read check lets them read as a Requestor, through the owner scope the
 * policy resolved (never a query value) and the list's own projection, which never names who generated a draft.
 */
export function myRiskAssessmentsExportView(strapi: unknown): ListExportView<AssessmentExportQuery, AssessmentListExportRow> {
  return assessmentListExportView(strapi, "my-risk-assessments", "owner", MY_RISK_ASSESSMENTS_EXTRACTORS);
}

/** A reference-list row: the Administration record as the admin list projects it. */
export type ReferenceListExportRow = Readonly<Record<string, unknown>>;

/**
 * A reference list's extractors (19-14; D-33), one per vocabulary column: the import columns read the stored values as
 * the import writes them (flags as booleans, which the cell types write as Yes and No), then the read-only columns, an
 * Information System's owner by display name and a Risk Type's applicable controls as a count.
 */
function referenceListExtractors(kind: AdministrationKind): Readonly<Record<string, (row: ReferenceListExportRow) => ExportCellValue>> {
  const extractors: Record<string, (row: ReferenceListExportRow) => ExportCellValue> = {};
  for (const column of exportViewColumns(kind)) {
    if (column.key === "owner") extractors.owner = (row) => textOrNull(row.ownerName);
    else if (column.key === "applicableControls") extractors.applicableControls = (row) => (Array.isArray(row.applicableControls) ? row.applicableControls.length : 0);
    else {
      const key = column.key;
      extractors[key] = (row) => {
        const value = row[key];
        return typeof value === "string" || typeof value === "boolean" || typeof value === "number" ? value : null;
      };
    }
  }
  return Object.freeze(extractors);
}

const REFERENCE_LIST_KINDS: readonly AdministrationKind[] = ["risk-types", "controls", "information-systems", "information-assets"];

/** The admin lists' filter chips as the About sheet names them: the column's label, flags as Yes and No. */
const REFERENCE_FILTER_LABELS: Readonly<Record<string, string>> = Object.freeze({
  framework: "Framework",
  controlType: "Type",
  environment: "Environment",
  deploymentModel: "Deployment model",
  lifecycleState: "Lifecycle",
  internetFacing: "Internet-facing",
  dataClassification: "Classification",
  containsPersonalData: "Contains personal data",
  containsLegalData: "Contains legal data",
  containsCreditCardData: "Contains credit card data",
});

function referenceFilters(query: AdministrationExportQuery): Array<readonly [string, string | boolean]> {
  return Object.keys(REFERENCE_FILTER_LABELS).flatMap((key) => {
    const value = (query as Readonly<Record<string, unknown>>)[key];
    return typeof value === "string" || typeof value === "boolean" ? [[key, value] as const] : [];
  });
}

/**
 * A reference list's export view (19-14; D-04, D-05, D-13, D-33): the admin list's own scope, closed parser (its export
 * twin, which refuses a page), repository count, order and hydration, and projection. The file holds the import columns
 * under the template's labels, then the read-only columns, so an exported list imports back by natural key. Human
 * Security Analyst only (the policy's refusal sets and the Administration scope).
 */
export function referenceListExportView(strapi: unknown, kind: AdministrationKind): ListExportView<AdministrationExportQuery, ReferenceListExportRow> {
  const meta = exportViewMeta(kind);
  const repository = createStrapiAdministrationRepository(strapi, kind);
  // The repository pages by page and pageSize; the export reads one page of the whole list from the first record.
  const fromStart = (query: AdministrationExportQuery, limit: number): AdministrationQuery => ({ ...query, page: 1, pageSize: limit as AdministrationQuery["pageSize"] });
  const sortLabel = (field: string) => (field === "updatedAt" ? "Updated" : meta.columns.find((column) => column.key === field)?.label);
  return {
    key: meta.key,
    slug: meta.slug,
    heading: meta.heading,
    assertScope: (state) => assertAdministrationScope(state),
    parseExportQuery(query, state) {
      assertAdministrationScope(state);
      try {
        return parseAdministrationExportQuery(kind, query);
      } catch (error) {
        if (error instanceof AdministrationValidationError) throw new ExportQueryError();
        throw error;
      }
    },
    auditQuery(query) {
      const filters: Record<string, string> = {};
      for (const [key, value] of referenceFilters(query)) filters[key] = String(value);
      return { filters, search: query.q === "" ? null : query.q, sort: query.sort };
    },
    async describe(query) {
      const [field, direction] = query.sort.split(":");
      const label = sortLabel(field ?? "");
      return {
        search: query.q === "" ? null : query.q,
        filters: referenceFilters(query).map(([key, value]) => ({ label: REFERENCE_FILTER_LABELS[key]!, value: typeof value === "boolean" ? (value ? "Yes" : "No") : value })),
        sort: label ? { label, direction: direction === "desc" ? "descending" : "ascending" } : null,
      };
    },
    count: (query) => repository.count(fromStart(query, 1)),
    selectIds: (query, limit) => repository.selectPage(fromStart(query, limit)),
    async hydrate(ids) {
      return inIdOrder(ids, await repository.hydrate(ids));
    },
    project: (document) => projectAdministrationRecord(kind, document),
    extractors: referenceListExtractors(kind),
  };
}

/** Every registered view's key and extractors, for the vocabulary's closure test (D-36: Phases 18, 20 and 22 add theirs). */
export function registeredExportViews(): readonly { readonly key: string; readonly extractors: readonly string[] }[] {
  return [
    { key: "risk-register", extractors: Object.keys(RISK_REGISTER_EXTRACTORS) },
    { key: "requests", extractors: Object.keys(REQUESTS_EXTRACTORS) },
    { key: "my-requests", extractors: Object.keys(MY_REQUESTS_EXTRACTORS) },
    { key: "questionnaires", extractors: Object.keys(QUESTIONNAIRES_EXTRACTORS) },
    { key: "my-questionnaires", extractors: Object.keys(MY_QUESTIONNAIRES_EXTRACTORS) },
    { key: "alerts", extractors: Object.keys(ALERTS_EXTRACTORS) },
    { key: "risk-assessments", extractors: Object.keys(RISK_ASSESSMENTS_EXTRACTORS) },
    { key: "my-risk-assessments", extractors: Object.keys(MY_RISK_ASSESSMENTS_EXTRACTORS) },
    // 19-14: the four reference lists.
    ...REFERENCE_LIST_KINDS.map((kind) => ({ key: kind, extractors: Object.keys(referenceListExtractors(kind)) })),
  ];
}
