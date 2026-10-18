/*
 * The two-tier duplicate classifier for proposed Risks (Phase 16 D-32; the approved Phase 16 amendment to
 * docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Bounds").
 *
 * - Near-identical (the proposal is dropped): the Risk Types match, both null counting as a match, and Phase 15's
 *   `isNearDuplicate` holds on statement plus cause (a token-set Jaccard of 0.8 or more, or an exact normalised match
 *   for a short text).
 * - Similar (kept and flagged with `similarTo`): the token-set Jaccard of statement plus cause is at least
 *   `RISK_SIMILARITY_THRESHOLD`, whatever the Risk Types.
 *
 * Tokens and scores are Phase 15's `text-similarity.ts` over Phase 12's tokeniser: no second tokeniser, no dependency.
 * Deterministic and pure; the fixtures in `risk-duplicates.unit.test.ts` pin both thresholds.
 */
import { isNearDuplicate, tokenSetSimilarity } from "../text-similarity";

/** The score at or above which a proposed Risk is flagged as similar to another. */
export const RISK_SIMILARITY_THRESHOLD = 0.5;

/** The pools a proposal is compared against, in the order a near-identical match is looked for. */
export const DUPLICATE_POOL_KINDS = Object.freeze(["active", "withdrawn", "rejected", "open", "sameRun"] as const);
export type DuplicatePoolKind = (typeof DUPLICATE_POOL_KINDS)[number];

/**
 * A Risk as the classifier compares it. `riskType` is the Risk Type's identity, the same form (name or documentId) in
 * every pool, or null. `ref` names the entry to the caller: a Risk's documentId, or a run and item for a suggestion.
 */
export type DuplicateComparable = { riskType?: string | null; riskStatement?: string | null; riskCause?: string | null };
export type DuplicateEntry = DuplicateComparable & { ref: string };
export type DuplicatePools = Partial<Record<DuplicatePoolKind, readonly DuplicateEntry[]>>;

export type DuplicateVerdict =
  | { tier: "near-identical"; against: { kind: DuplicatePoolKind; ref: string } }
  | { tier: "similar"; against: { kind: DuplicatePoolKind; ref: string }; score: number }
  | { tier: "distinct" };

function text(value: string | null | undefined): string {
  return typeof value === "string" ? value.trim() : "";
}

/** The text two Risks are compared on: the risk statement and cause joined by a space. */
export function riskComparisonText(risk: DuplicateComparable): string {
  return [text(risk.riskStatement), text(risk.riskCause)].filter((part) => part.length > 0).join(" ");
}

function riskTypeOf(risk: DuplicateComparable): string | null {
  return typeof risk.riskType === "string" && risk.riskType.trim().length > 0 ? risk.riskType.trim() : null;
}

/**
 * The verdict on `candidate`: the first near-identical entry in pool order (active, withdrawn, rejected, open, same
 * run, each in its own order), else the highest-scoring similar entry (the earlier one on a tie), else distinct.
 */
export function classifyProposedRisk(candidate: DuplicateComparable, pools: DuplicatePools): DuplicateVerdict {
  const candidateText = riskComparisonText(candidate);
  const candidateType = riskTypeOf(candidate);
  let similar: { kind: DuplicatePoolKind; ref: string; score: number } | null = null;
  for (const kind of DUPLICATE_POOL_KINDS) {
    for (const entry of pools[kind] ?? []) {
      const entryText = riskComparisonText(entry);
      if (riskTypeOf(entry) === candidateType && isNearDuplicate(entryText, candidateText)) {
        return { tier: "near-identical", against: { kind, ref: entry.ref } };
      }
      const score = tokenSetSimilarity(candidateText, entryText);
      if (score >= RISK_SIMILARITY_THRESHOLD && (similar === null || score > similar.score)) similar = { kind, ref: entry.ref, score };
    }
  }
  if (similar === null) return { tier: "distinct" };
  return { tier: "similar", against: { kind: similar.kind, ref: similar.ref }, score: similar.score };
}
