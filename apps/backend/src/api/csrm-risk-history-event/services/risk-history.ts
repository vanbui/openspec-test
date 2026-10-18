/*
 * The Risk history (Phase 16 D-18, D-19, D-21; the approved record "Risk History").
 *
 * This module is the only writer of `csrm_risk_history_events` and its only reader. `recordRiskHistory` validates one
 * entry completely and then appends one row through the Document Service without opening a transaction of its own,
 * so it joins the caller's `strapi.db.transaction` (the pattern of `withMutableAssessmentMutation`): the row commits
 * with the change it records and rolls back with it. It exports no update and no delete, and the type mounts no route,
 * so no code path rewrites or removes a row (append-only).
 *
 * `readRiskHistory` serves one Risk's events newest first in bounded pages, names each actor through one batched
 * people read, and projects a row whose `changes` does not parse as `changes: null` rather than failing the read (the
 * 06.8 posture). Two history reads run on a write path, and neither decides access: every gate reads the Risk's own
 * facts, never this history (D-18). `latestWithdrawalReason` restores a withdrawal's reason on its Undo, and
 * `aiRunCreatedItem` tells the run record which suggestion run added a Risk (the Phase 16 execution amendment of
 * 2026-10-16, item 1: which event family a run's record takes, never who may decide).
 */
import {
  buildRiskHistoryChanges,
  parseRiskHistoryChanges,
  RISK_HISTORY_KINDS,
  RISK_HISTORY_SOURCES,
  type RiskHistoryChangesV1,
  type RiskHistoryControl,
  type RiskHistoryFieldChange,
  type RiskHistoryKind,
  type RiskHistorySource,
} from "../../../csrm/risk-history-changes";
import { resolvePeople, type Person, type RequestPeopleStrapi } from "../../csrm-assessment-request/services/request-people";

const UID = "api::csrm-risk-history-event.csrm-risk-history-event";

/** The default page size of the history read (D-21). */
export const RISK_HISTORY_PAGE_SIZE = 25;
/** The largest page the history read serves; a larger or non-integer value is a 400 at the caller (D-21). */
export const RISK_HISTORY_PAGE_SIZE_MAX = 100;
/** The longest withdrawal or reinstatement reason, after trimming (the approved record, "Withdrawal Facts"). */
export const RISK_HISTORY_REASON_MAX_LENGTH = 500;

const PROPOSAL_ITEM_MAX_LENGTH = 64;
const DOCUMENT_ID_MAX_LENGTH = 255;
const REASON_KINDS: ReadonlySet<RiskHistoryKind> = new Set(["withdrawn", "reinstated"]);
const CONTROL_KINDS: ReadonlySet<RiskHistoryKind> = new Set(["control-implementation-added", "control-implementation-updated", "control-implementation-removed"]);
/* A change of nothing writes no row: an update kind always lists at least one field. */
const NON_EMPTY_KINDS: ReadonlySet<RiskHistoryKind> = new Set(["updated", "control-implementation-updated"]);

export type RiskHistoryErrorCode = "RISK_HISTORY_ENTRY_INVALID" | "RISK_HISTORY_PAGE_INVALID";

/**
 * An invalid history entry (a writer bug, never client input) or an invalid page request. Nothing is written when it
 * is thrown; a caller maps `RISK_HISTORY_PAGE_INVALID` to a 400.
 */
export class RiskHistoryError extends Error {
  readonly code: RiskHistoryErrorCode;
  readonly status: 400 | 500;
  constructor(code: RiskHistoryErrorCode, detail: string) {
    super(`${code}: ${detail}`);
    this.name = "RiskHistoryError";
    this.code = code;
    this.status = code === "RISK_HISTORY_PAGE_INVALID" ? 400 : 500;
  }
}

/** One change to record. Relations are documentIds; `occurredAt` defaults to the server's time now. */
export type RiskHistoryEntry = {
  kind: RiskHistoryKind;
  riskDocumentId: string;
  assessmentDocumentId: string;
  actorDocumentId: string;
  sourceKind: RiskHistorySource;
  /** Required exactly when `sourceKind` is `ai-run`. */
  aiRunDocumentId?: string | null;
  /** The run's proposal item key; only with an `ai-run` source. */
  proposalItem?: string | null;
  /** Required for `withdrawn` and `reinstated` (1 to 500 characters after trimming); refused on every other kind. */
  reason?: string | null;
  /**
   * True when the event reverses the previous withdrawal or reinstatement through Undo, or (Phase 16 D-39) is the
   * `updated` row, from its AI run, that undoes a confirmed AI change; no other row.
   */
  undo?: boolean;
  occurredAt?: Date;
  changes: { fields: readonly RiskHistoryFieldChange[]; control?: RiskHistoryControl };
};

export type RiskHistoryEventView = {
  id: string;
  kind: string;
  occurredAt: string | null;
  actor: Person | null;
  sourceKind: string;
  aiRunId: string | null;
  proposalItem: string | null;
  reason: string | null;
  undo: boolean;
  changes: RiskHistoryChangesV1 | null;
};

export type RiskHistoryPage = {
  events: RiskHistoryEventView[];
  pagination: { page: number; pageSize: number; pageCount: number; total: number };
  /** The earliest event's `occurredAt` for the Risk, or null when it has none ("History recorded from {date}"). */
  recordedFrom: string | null;
};

type Row = Record<string, unknown>;
type HistoryDocuments = {
  create: (input: { data: Row }) => Promise<Row & { documentId: string }>;
  findMany: (input: Row) => Promise<Row[]>;
  count: (input: Row) => Promise<number>;
};
type RiskHistoryStrapi = {
  documents: (uid: string) => unknown;
  log?: { warn?: (message: string) => void };
};

const documents = (strapi: unknown): HistoryDocuments => (strapi as RiskHistoryStrapi).documents(UID) as HistoryDocuments;

function isDocumentId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= DOCUMENT_ID_MAX_LENGTH;
}

function invalid(detail: string): never {
  throw new RiskHistoryError("RISK_HISTORY_ENTRY_INVALID", detail);
}

function validEntry(entry: RiskHistoryEntry): Row {
  if (!(RISK_HISTORY_KINDS as readonly unknown[]).includes(entry.kind)) invalid("kind");
  if (!(RISK_HISTORY_SOURCES as readonly unknown[]).includes(entry.sourceKind)) invalid("sourceKind");
  if (!isDocumentId(entry.riskDocumentId)) invalid("risk");
  if (!isDocumentId(entry.assessmentDocumentId)) invalid("assessment");
  if (!isDocumentId(entry.actorDocumentId)) invalid("actor");

  const aiRun = entry.aiRunDocumentId ?? null;
  if (entry.sourceKind === "ai-run" ? !isDocumentId(aiRun) : aiRun !== null) invalid("aiRun");
  const proposalItem = entry.proposalItem ?? null;
  if (proposalItem !== null && (entry.sourceKind !== "ai-run" || typeof proposalItem !== "string" || proposalItem.length < 1 || proposalItem.length > PROPOSAL_ITEM_MAX_LENGTH)) invalid("proposalItem");

  let reason: string | null = null;
  if (REASON_KINDS.has(entry.kind)) {
    reason = typeof entry.reason === "string" ? entry.reason.trim() : "";
    if (reason.length < 1 || reason.length > RISK_HISTORY_REASON_MAX_LENGTH) invalid("reason");
  } else if (entry.reason !== undefined && entry.reason !== null) {
    invalid("reason");
  }
  const undo = entry.undo ?? false;
  // A withdrawal's or reinstatement's Undo, or (Phase 16 D-39) the Undo of a confirmed AI change: an `updated` row from its run.
  const undoable = REASON_KINDS.has(entry.kind) || (entry.kind === "updated" && entry.sourceKind === "ai-run");
  if (typeof undo !== "boolean" || (undo && !undoable)) invalid("undo");

  const occurredAt = entry.occurredAt ?? new Date();
  if (!(occurredAt instanceof Date) || !Number.isFinite(occurredAt.getTime())) invalid("occurredAt");

  if (!entry.changes || !Array.isArray(entry.changes.fields)) invalid("changes");
  if (CONTROL_KINDS.has(entry.kind) !== (entry.changes.control !== undefined)) invalid("control");
  if (REASON_KINDS.has(entry.kind) && entry.changes.fields.length > 0) invalid("fields");
  if (NON_EMPTY_KINDS.has(entry.kind) && entry.changes.fields.length === 0) invalid("fields");
  let changes: RiskHistoryChangesV1;
  try {
    changes = buildRiskHistoryChanges(entry.changes);
  } catch {
    invalid("changes");
  }

  return {
    kind: entry.kind,
    occurredAt: occurredAt.toISOString(),
    actor: entry.actorDocumentId,
    assessment: entry.assessmentDocumentId,
    risk: entry.riskDocumentId,
    sourceKind: entry.sourceKind,
    aiRun,
    proposalItem,
    reason,
    undo,
    changes,
  };
}

/**
 * Appends one history row in the caller's transaction and returns its documentId. The entry is validated whole
 * before anything is written; an invalid one throws `RiskHistoryError` and writes nothing.
 */
export async function recordRiskHistory(strapi: unknown, entry: RiskHistoryEntry): Promise<string> {
  const data = validEntry(entry);
  const created = await documents(strapi).create({ data });
  return created.documentId;
}

function boundedInteger(value: unknown, fallback: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 1 || value > max) {
    throw new RiskHistoryError("RISK_HISTORY_PAGE_INVALID", "page");
  }
  return value;
}

function instant(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value === "number") return Number.isFinite(value) ? new Date(value).toISOString() : null;
  if (typeof value !== "string") return null;
  const time = Date.parse(value);
  return Number.isNaN(time) ? null : new Date(time).toISOString();
}

function relationId(value: unknown): string | null {
  return typeof value === "object" && value !== null && isDocumentId((value as { documentId?: unknown }).documentId)
    ? (value as { documentId: string }).documentId
    : null;
}

function optionalString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

const riskFilter = (riskDocumentId: string): Row => ({ risk: { documentId: { $eq: riskDocumentId } } });

/**
 * One page of a Risk's history, newest first (`occurredAt` then id, both descending). The caller has already decided
 * the reader may see the Risk; this read decides nothing.
 */
export async function readRiskHistory(
  strapi: unknown,
  input: { riskDocumentId: string; page?: number; pageSize?: number },
): Promise<RiskHistoryPage> {
  const page = boundedInteger(input.page, 1, Number.MAX_SAFE_INTEGER);
  const pageSize = boundedInteger(input.pageSize, RISK_HISTORY_PAGE_SIZE, RISK_HISTORY_PAGE_SIZE_MAX);
  if (!isDocumentId(input.riskDocumentId)) throw new RiskHistoryError("RISK_HISTORY_PAGE_INVALID", "risk");
  const history = documents(strapi);
  const filters = riskFilter(input.riskDocumentId);
  const total = await history.count({ filters });
  if (total === 0) return { events: [], pagination: { page, pageSize, pageCount: 0, total: 0 }, recordedFrom: null };

  const rows = await history.findMany({
    filters,
    fields: ["documentId", "kind", "occurredAt", "sourceKind", "proposalItem", "reason", "undo", "changes"],
    populate: { actor: { fields: ["documentId"] }, aiRun: { fields: ["documentId"] } },
    sort: ["occurredAt:desc", "id:desc"],
    start: (page - 1) * pageSize,
    limit: pageSize,
  });
  const [earliest] = await history.findMany({ filters, fields: ["occurredAt"], sort: ["occurredAt:asc", "id:asc"], limit: 1 });
  const people = await resolvePeople(strapi as RequestPeopleStrapi, rows.map((row) => relationId(row.actor)).filter(isDocumentId));

  let malformed = 0;
  const events = rows.map((row): RiskHistoryEventView => {
    const changes = parseRiskHistoryChanges(row.changes);
    if (!changes) malformed += 1;
    const actorId = relationId(row.actor);
    return {
      id: String(row.documentId),
      kind: String(row.kind),
      occurredAt: instant(row.occurredAt),
      actor: actorId ? people.get(actorId) ?? null : null,
      sourceKind: String(row.sourceKind),
      aiRunId: relationId(row.aiRun),
      proposalItem: optionalString(row.proposalItem),
      reason: optionalString(row.reason),
      undo: row.undo === true,
      changes,
    };
  });
  if (malformed > 0) {
    (strapi as RiskHistoryStrapi).log?.warn?.(`CSRM risk history: ${malformed} event(s) with an unreadable change envelope served without changes.`);
  }
  return {
    events,
    pagination: { page, pageSize, pageCount: Math.ceil(total / pageSize), total },
    recordedFrom: instant(earliest?.occurredAt),
  };
}

/**
 * The reason of the Risk's most recent `withdrawn` event, or null when it has none. The Undo of a reinstatement
 * restores it; it decides no access (D-18).
 */
export async function latestWithdrawalReason(strapi: unknown, riskDocumentId: string): Promise<string | null> {
  if (!isDocumentId(riskDocumentId)) return null;
  const [latest] = await documents(strapi).findMany({
    filters: { ...riskFilter(riskDocumentId), kind: { $eq: "withdrawn" } },
    fields: ["reason"],
    sort: ["occurredAt:desc", "id:desc"],
    limit: 1,
  });
  return optionalString(latest?.reason);
}

/**
 * The Risk's most recent history row as its kind and actor, or null when it has none. The Phase 16 code review
 * amendment (2026-10-16; 16-REVIEW BE1-03) binds a curation Undo to the act it reverses: the acting analyst's own
 * latest withdrawal or reinstatement.
 */
export async function latestRiskHistoryAct(strapi: unknown, riskDocumentId: string): Promise<{ kind: string; actorDocumentId: string | null } | null> {
  if (!isDocumentId(riskDocumentId)) return null;
  const [latest] = await documents(strapi).findMany({
    filters: riskFilter(riskDocumentId),
    fields: ["kind"],
    populate: { actor: { fields: ["documentId"] } },
    sort: ["occurredAt:desc", "id:desc"],
    limit: 1,
  });
  if (!latest) return null;
  const actor = latest.actor as { documentId?: unknown } | null | undefined;
  return { kind: String(latest.kind), actorDocumentId: typeof actor?.documentId === "string" ? actor.documentId : null };
}

/**
 * The Phase 16 execution amendment (2026-10-16, item 1): the proposal item named by the Risk's `created` row when an
 * AI run (`runDocumentId`) created it ("Add to assessment"), or null when the Risk was not created by that run. The
 * run record reads it to take Phase 12's v1 events for a Risk its `risk-suggestions` run added; it decides no access.
 */
export async function aiRunCreatedItem(strapi: unknown, riskDocumentId: string, runDocumentId: string): Promise<string | null> {
  if (!isDocumentId(riskDocumentId) || !isDocumentId(runDocumentId)) return null;
  const [created] = await documents(strapi).findMany({
    filters: { ...riskFilter(riskDocumentId), kind: { $eq: "created" }, sourceKind: { $eq: "ai-run" }, aiRun: { documentId: { $eq: runDocumentId } } },
    fields: ["proposalItem"],
    sort: ["id:asc"],
    limit: 1,
  });
  return optionalString(created?.proposalItem);
}
