/*
 * Risk curation (Phase 16 D-05, D-06, D-09 to D-12, D-21, D-43; the approved record "Operations, Functions and
 * Reasons").
 *
 * - `withdrawRisks` takes 1 to 200 Risks of one unreleased assessment out of it with one reason, in one transaction
 *   under the assessment's serialisation and the one editable guard (`withMutableAssessmentMutation`). Each applied
 *   Risk gets the three withdrawal facts and one `withdrawn` history row; its number, fields, control
 *   implementations and AI provenance are kept.
 * - `reinstateRisks` clears the three facts again with one `reinstated` row per applied Risk, with the typed reason
 *   or, for the withdrawal's Undo, the fixed `Withdrawal undone`. Reinstating only active Risks is refused 409
 *   `RISK_NOT_WITHDRAWN` (D-10).
 * - `getRiskHistory` serves one Risk's history page to a human Security Analyst, newest first, with the record-level
 *   check through the Risk's assessment: an unknown Risk is 404 with no enumeration (D-21). It serves a withdrawn
 *   Risk's history too.
 *
 * The batch is all or nothing: a Risk that does not exist or belongs to another assessment refuses the whole batch
 * with 404 and names no id. A batch whose `applied` list is empty writes nothing and takes no edit transition, so a
 * repeated withdrawal never withdraws a review (D-12, D-23). The facts are written only here; the Risk update payload
 * stays closed to them (D-44).
 */
import type { ConflictReason } from "../../../csrm/conflict-reasons";
import {
  parseRiskCurationBody,
  partitionReinstatement,
  partitionWithdrawal,
  UNDO_WITHDRAWAL_REASON,
  type CurationPartition,
  type CurationRiskRow,
  type RiskCurationBody,
} from "../../../csrm/risk-curation-rules";
import {
  appendAiRunDecisionsWithinMutation,
  withMutableAssessmentMutation,
  type AssessmentMutationStrapi,
} from "../../csrm-assessment/services/assessment-workflow";
import { loadRiskProposalRuns } from "../../../csrm/ai/risk-proposals/risk-proposals-read";
import type { RiskDecisionEvent } from "../../../csrm/ai/risk-proposals/risk-proposal-envelope";
import {
  latestRiskHistoryAct,
  latestWithdrawalReason,
  readRiskHistory,
  recordRiskHistory,
  RISK_HISTORY_PAGE_SIZE_MAX,
  RiskHistoryError,
  type RiskHistoryEventView,
  type RiskHistoryPage,
} from "../../csrm-risk-history-event/services/risk-history";

type RecordValue = Record<string, unknown>;

const RISK_UID = "api::csrm-risk.csrm-risk";
const RISK_NOT_FOUND = "CSRM Risk was not found.";
const NO_EARLIER_WITHDRAWAL = "CSRM Risk has no earlier withdrawal to restore.";
const NOT_WITHDRAWN = "CSRM Risk is not withdrawn.";
const UNDO_UNAVAILABLE = "CSRM Risk curation can no longer be undone.";
const HISTORY_QUERY_KEYS: ReadonlySet<string> = new Set(["page", "pageSize"]);
const PAGE_MAX = 1_000_000;

/** A refused curation the controller answers with its status, safe message and, for a 409, its closed reason. */
export class RiskCurationError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string, public readonly reason?: ConflictReason) {
    super(message);
    this.name = "RiskCurationError";
  }
}

export type RiskCurationStrapi = AssessmentMutationStrapi;

type RiskCurationInput = {
  strapi: RiskCurationStrapi;
  assessmentDocumentId: string;
  /** The acting human Security Analyst (`ctx.state.idamboxUser.documentId`). */
  actorDocumentId: string;
  body: unknown;
  /** The server clock; a test may pin it. */
  now?: () => Date;
};

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function relationDocumentId(value: unknown): string | null {
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0 ? value.documentId : null;
}

/*
 * Every named Risk with its current withdrawal fact, read inside the transaction. A missing Risk, or one of another
 * assessment, refuses the whole batch with the same 404 (T-16-13), so the answer never says which id failed.
 */
async function loadBatch(strapi: RiskCurationStrapi, assessmentDocumentId: string, riskIds: readonly string[]): Promise<CurationRiskRow[]> {
  const risks = strapi.documents(RISK_UID);
  if (typeof risks.findMany !== "function") throw new RiskCurationError(404, RISK_NOT_FOUND);
  const rows = await risks.findMany({
    filters: { documentId: { $in: [...riskIds] } },
    fields: ["documentId", "withdrawnAt"],
    populate: { assessment: { fields: ["documentId"] } },
    limit: riskIds.length,
  });
  const byId = new Map(rows.map((row) => [String(row.documentId), row] as const));
  return riskIds.map((riskId) => {
    const row = byId.get(riskId);
    if (!row || relationDocumentId(row.assessment) !== assessmentDocumentId) throw new RiskCurationError(404, RISK_NOT_FOUND);
    return { documentId: riskId, withdrawnAt: row.withdrawnAt ?? null };
  });
}

/*
 * The reason each applied withdrawal records: the typed one, or with `undo: true` the reason of the Risk's most
 * recent `withdrawn` event, the reason it held before its reinstatement (D-11). Every reason is read before any write;
 * a Risk with nothing to restore refuses the batch as invalid (400).
 */
async function withdrawalReasons(strapi: RiskCurationStrapi, body: RiskCurationBody, applied: readonly string[]): Promise<Map<string, string>> {
  const reasons = new Map<string, string>();
  for (const riskId of applied) {
    const reason = body.mode === "reason" ? body.reason : await latestWithdrawalReason(strapi, riskId);
    if (reason === null) throw new RiskCurationError(400, NO_EARLIER_WITHDRAWAL);
    reasons.set(riskId, reason);
  }
  return reasons;
}

/*
 * Phase 16 D-40 (16-RESEARCH Pitfall 12): withdrawing a Risk closes every open change an AI rewrite proposed for it,
 * recorded `superseded` by the withdrawing analyst with the cause `risk-withdrawn`, in the withdrawal's transaction, so
 * no proposal closes silently. A damaged run is left as it is (nothing may decide it). It is no content change of its
 * own: the withdrawal already is one. A reinstatement reopens nothing.
 */
async function supersedeOpenChanges(strapi: RiskCurationStrapi, assessmentDocumentId: string, riskIds: readonly string[], by: string, at: Date): Promise<void> {
  if (riskIds.length === 0) return;
  const withdrawn = new Set(riskIds);
  for (const run of await loadRiskProposalRuns(strapi as never, assessmentDocumentId)) {
    if (!run.states) continue;
    const states = run.states;
    const events: RiskDecisionEvent[] = run.items
      .filter((item) => item.kind === "change" && withdrawn.has(item.riskDocumentId) && states.get(item.key) === "open")
      .map((item) => ({
        schemaVersion: 2, at: at.toISOString(), by, item: item.key, action: "superseded",
        cause: { kind: "risk-withdrawn", riskDocumentId: (item as { riskDocumentId: string }).riskDocumentId },
      }));
    if (events.length) await appendAiRunDecisionsWithinMutation(strapi, run.runId, events);
  }
}

/*
 * The Phase 16 code review amendment (2026-10-16; 16-REVIEW BE1-03, T-16-15): an Undo reverses only the acting
 * analyst's own latest act on each Risk it applies to. A reinstatement Undo needs the Risk's current withdrawal to be the
 * actor's (`withdrawnBy`) and its most recent history row to be that `withdrawn` row; a withdrawal Undo needs the most
 * recent history row to be a `reinstated` row by the actor. Any Risk failing it refuses the whole batch with 409
 * RISK_CURATION_UNDO_UNAVAILABLE before anything is written. It reads the current facts and the latest row only.
 */
async function assertUndoOfOwnLatestAct(strapi: RiskCurationStrapi, actorDocumentId: string, applied: readonly string[], reverses: "withdrawn" | "reinstated"): Promise<void> {
  for (const riskDocumentId of applied) {
    if (reverses === "withdrawn") {
      const risk = await strapi.documents(RISK_UID).findOne({ documentId: riskDocumentId, fields: ["documentId"], populate: { withdrawnBy: { fields: ["documentId"] } } });
      if (relationDocumentId(risk?.withdrawnBy) !== actorDocumentId) throw new RiskCurationError(409, UNDO_UNAVAILABLE, "RISK_CURATION_UNDO_UNAVAILABLE");
    }
    const latest = await latestRiskHistoryAct(strapi, riskDocumentId);
    if (latest?.kind !== reverses || latest.actorDocumentId !== actorDocumentId) {
      throw new RiskCurationError(409, UNDO_UNAVAILABLE, "RISK_CURATION_UNDO_UNAVAILABLE");
    }
  }
}

/**
 * Withdraws the named Risks of one unreleased assessment (D-05, D-06, D-09, D-11). Returns the Risks it withdrew and
 * the ones that were already withdrawn, in the request's order.
 */
export async function withdrawRisks(input: RiskCurationInput): Promise<CurationPartition> {
  const body = parseRiskCurationBody(input.body);
  return withMutableAssessmentMutation<CurationPartition>({
    strapi: input.strapi,
    assessmentDocumentId: input.assessmentDocumentId,
    analystDocumentId: input.actorDocumentId,
    transition: (result) => (result.applied.length > 0 ? "accepted-edit" : "none"),
    mutate: async () => {
      const risks = await loadBatch(input.strapi, input.assessmentDocumentId, body.riskIds);
      const partition = partitionWithdrawal(risks, body.riskIds);
      const reasons = await withdrawalReasons(input.strapi, body, partition.applied);
      if (body.mode === "undo") await assertUndoOfOwnLatestAct(input.strapi, input.actorDocumentId, partition.applied, "reinstated");
      const at = (input.now ?? (() => new Date()))();
      for (const riskDocumentId of partition.applied) {
        const reason = reasons.get(riskDocumentId) as string;
        await input.strapi.documents(RISK_UID).update({
          documentId: riskDocumentId,
          data: { withdrawnAt: at.toISOString(), withdrawnBy: input.actorDocumentId, withdrawalReason: reason },
        });
        await recordRiskHistory(input.strapi, {
          kind: "withdrawn",
          riskDocumentId,
          assessmentDocumentId: input.assessmentDocumentId,
          actorDocumentId: input.actorDocumentId,
          sourceKind: "analyst",
          reason,
          undo: body.mode === "undo",
          occurredAt: at,
          changes: { fields: [] },
        });
      }
      await supersedeOpenChanges(input.strapi, input.assessmentDocumentId, partition.applied, input.actorDocumentId, at);
      return partition;
    },
  });
}

/**
 * Reinstates the named withdrawn Risks of one unreleased assessment (D-10, D-11): their three facts are cleared and
 * each gets one `reinstated` row. Active Risks in a mixed batch are reported as unchanged; a batch of active Risks
 * only is refused with 409 `RISK_NOT_WITHDRAWN` and writes nothing.
 */
export async function reinstateRisks(input: RiskCurationInput): Promise<CurationPartition> {
  const body = parseRiskCurationBody(input.body);
  const reason = body.mode === "reason" ? body.reason : UNDO_WITHDRAWAL_REASON;
  return withMutableAssessmentMutation<CurationPartition>({
    strapi: input.strapi,
    assessmentDocumentId: input.assessmentDocumentId,
    analystDocumentId: input.actorDocumentId,
    transition: (result) => (result.applied.length > 0 ? "accepted-edit" : "none"),
    mutate: async () => {
      const risks = await loadBatch(input.strapi, input.assessmentDocumentId, body.riskIds);
      const partition = partitionReinstatement(risks, body.riskIds);
      if ("refusal" in partition) throw new RiskCurationError(409, NOT_WITHDRAWN, partition.refusal);
      if (body.mode === "undo") await assertUndoOfOwnLatestAct(input.strapi, input.actorDocumentId, partition.applied, "withdrawn");
      const at = (input.now ?? (() => new Date()))();
      for (const riskDocumentId of partition.applied) {
        await input.strapi.documents(RISK_UID).update({
          documentId: riskDocumentId,
          data: { withdrawnAt: null, withdrawnBy: null, withdrawalReason: null },
        });
        await recordRiskHistory(input.strapi, {
          kind: "reinstated",
          riskDocumentId,
          assessmentDocumentId: input.assessmentDocumentId,
          actorDocumentId: input.actorDocumentId,
          sourceKind: "analyst",
          reason,
          undo: body.mode === "undo",
          occurredAt: at,
          changes: { fields: [] },
        });
      }
      return partition;
    },
  });
}

export type RiskHistoryResponse = {
  data: RiskHistoryEventView[];
  meta: { pagination: RiskHistoryPage["pagination"]; recordedFrom: string | null };
};

function pageParameter(value: unknown, max: number): number | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value) || Number(value) > max) {
    throw new RiskHistoryError("RISK_HISTORY_PAGE_INVALID", "query");
  }
  return Number(value);
}

/*
 * The closed history query: only `page` (1 to 1,000,000) and `pageSize` (1 to 100), each once, as positive integers.
 * Anything else is a 400 before any read.
 */
function parseHistoryQuery(query: unknown): { page?: number; pageSize?: number } {
  if (query === undefined || query === null) return {};
  if (!isRecord(query) || Object.keys(query).some((key) => !HISTORY_QUERY_KEYS.has(key))) {
    throw new RiskHistoryError("RISK_HISTORY_PAGE_INVALID", "query");
  }
  return { page: pageParameter(query.page, PAGE_MAX), pageSize: pageParameter(query.pageSize, RISK_HISTORY_PAGE_SIZE_MAX) };
}

/**
 * One page of a Risk's history for a human Security Analyst (D-21). The route policy and the analyst assessment scope
 * have already admitted the reader; the Risk must exist and belong to an assessment, otherwise the answer is the same
 * 404 for every unknown id.
 */
export async function getRiskHistory(input: { strapi: RiskCurationStrapi; riskDocumentId: string; query: unknown }): Promise<RiskHistoryResponse> {
  const query = parseHistoryQuery(input.query);
  const risk = await input.strapi.documents(RISK_UID).findOne({
    documentId: input.riskDocumentId,
    fields: ["documentId"],
    populate: { assessment: { fields: ["documentId"] } },
  });
  if (!risk || relationDocumentId(risk.assessment) === null) throw new RiskCurationError(404, RISK_NOT_FOUND);
  const page = await readRiskHistory(input.strapi, { riskDocumentId: input.riskDocumentId, ...query });
  return { data: page.events, meta: { pagination: page.pagination, recordedFrom: page.recordedFrom } };
}
