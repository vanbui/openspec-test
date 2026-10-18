/*
 * The Risk curation rules (Phase 16 D-06, D-09 to D-11; the approved record "Operations, Functions and Reasons").
 *
 * - `parseRiskCurationBody` is the closed body of the withdraw and reinstate operations: 1 to
 *   `RISK_CURATION_BATCH_MAX` unique Risk documentIds and exactly one of a reason (the revert reasons' own rule,
 *   `parseReasonText`) or `undo: true`. A typed reason never marks an undo, whatever its words (16-RESEARCH
 *   Pitfall 5): only the closed flag does.
 * - `partitionWithdrawal` and `partitionReinstatement` split a batch into the Risks the operation changes and the
 *   ones it reports as unchanged (D-09, D-10). They read the Risk's current `withdrawnAt` fact through the one
 *   active-risk rule.
 *
 * Gates read the current withdrawal facts and never the Risk history, which is narrative only (D-18). The module is
 * pure: it imports nothing from Strapi.
 */
import { parseReasonText } from "../api/csrm-assessment-request/services/revert-reason";
import { isActiveRisk } from "./active-risk";

/** The most Risks one withdraw or reinstate request may name. */
export const RISK_CURATION_BATCH_MAX = 200;

/** The bound of one Risk documentId in a curation body. */
export const RISK_CURATION_ID_MAX_LENGTH = 255;

/** The fixed reason a reinstatement sent by the withdrawal's Undo records (D-11). */
export const UNDO_WITHDRAWAL_REASON = "Withdrawal undone";

const DATA_INVALID = "CSRM risk curation data is invalid.";
const REASON_INVALID = "CSRM risk curation reason is invalid.";

/** A refused curation body; the caller answers it with a 400 carrying the safe message. */
export class RiskCurationBodyError extends Error {
  readonly status = 400 as const;

  constructor(message: string) {
    super(message);
    this.name = "RiskCurationBodyError";
  }
}

export type RiskCurationBody =
  | { riskIds: string[]; mode: "reason"; reason: string }
  | { riskIds: string[]; mode: "undo" };

/** One Risk as the partition reads it: its documentId and its current withdrawal fact. */
export type CurationRiskRow = { documentId: string; withdrawnAt?: unknown };

export type CurationPartition = { applied: string[]; unchanged: string[] };

export type ReinstatementPartition = CurationPartition | { refusal: "RISK_NOT_WITHDRAWN" };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseRiskIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > RISK_CURATION_BATCH_MAX) {
    throw new RiskCurationBodyError(DATA_INVALID);
  }
  const seen = new Set<string>();
  for (const id of value) {
    if (typeof id !== "string" || id.length < 1 || id.length > RISK_CURATION_ID_MAX_LENGTH || seen.has(id)) {
      throw new RiskCurationBodyError(DATA_INVALID);
    }
    seen.add(id);
  }
  return [...seen];
}

/**
 * Parses the withdraw or reinstate body: exactly `{ riskIds, reason }` or `{ riskIds, undo: true }`. A repeated id is
 * refused, never merged; `undo` accepts only `true`. Anything else throws `RiskCurationBodyError`.
 */
export function parseRiskCurationBody(body: unknown): RiskCurationBody {
  if (!isRecord(body)) throw new RiskCurationBodyError(DATA_INVALID);
  const keys = Object.keys(body);
  if (keys.length !== 2 || !keys.includes("riskIds")) throw new RiskCurationBodyError(DATA_INVALID);
  const riskIds = parseRiskIds(body.riskIds);
  if (keys.includes("undo")) {
    if (body.undo !== true) throw new RiskCurationBodyError(DATA_INVALID);
    return { riskIds, mode: "undo" };
  }
  if (!keys.includes("reason")) throw new RiskCurationBodyError(DATA_INVALID);
  const reason = parseReasonText(body.reason);
  if (reason === null) throw new RiskCurationBodyError(REASON_INVALID);
  return { riskIds, mode: "reason", reason };
}

function inRequestOrder(risks: readonly CurationRiskRow[], order?: readonly string[]): CurationRiskRow[] {
  if (!order) return [...risks];
  const position = new Map(order.map((id, index) => [id, index] as const));
  return risks
    .map((risk, index) => ({ risk, index }))
    .sort((left, right) => {
      const leftPosition = position.get(left.risk.documentId) ?? order.length + left.index;
      const rightPosition = position.get(right.risk.documentId) ?? order.length + right.index;
      return leftPosition - rightPosition;
    })
    .map(({ risk }) => risk);
}

/**
 * Withdrawal: an active Risk is applied, an already withdrawn one is unchanged (it gets no history row). The lists
 * follow `order` (the request's `riskIds`) when it is given, otherwise the rows' order.
 */
export function partitionWithdrawal(risks: readonly CurationRiskRow[], order?: readonly string[]): CurationPartition {
  const partition: CurationPartition = { applied: [], unchanged: [] };
  for (const risk of inRequestOrder(risks, order)) {
    (isActiveRisk(risk) ? partition.applied : partition.unchanged).push(risk.documentId);
  }
  return partition;
}

/**
 * Reinstatement: a withdrawn Risk is applied, an active one is unchanged; when no named Risk is withdrawn the
 * operation refuses with `RISK_NOT_WITHDRAWN` (D-10).
 */
export function partitionReinstatement(risks: readonly CurationRiskRow[], order?: readonly string[]): ReinstatementPartition {
  const partition: CurationPartition = { applied: [], unchanged: [] };
  for (const risk of inRequestOrder(risks, order)) {
    (isActiveRisk(risk) ? partition.unchanged : partition.applied).push(risk.documentId);
  }
  return partition.applied.length === 0 ? { refusal: "RISK_NOT_WITHDRAWN" } : partition;
}
