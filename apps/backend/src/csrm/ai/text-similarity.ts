import { normaliseForQuoteCheck } from "./analyst-instruction";
import { tokenize } from "./library-ranking";

/*
 * The near-duplicate scorer (Phase 15 D-15; the approved amendment's "Bounds": near-duplicate). Shared by Phase 15,
 * which leaves out a proposed question that repeats an active, open, rejected or removed question or an earlier
 * addition in the same run (adjustment `near-duplicate`), and by Phase 16, which applies the same 0.8 threshold to
 * its risk proposals.
 *
 * Tokens are Phase 12's `tokenize` (lower-case words of three or more letters or digits, without the stop list), so
 * punctuation, case and short words never count. When either text has fewer than three tokens, a set comparison
 * says too little, so the texts must match exactly once normalised (NFKC, lower case, single spaces).
 */

export const NEAR_DUPLICATE_THRESHOLD = 0.8;
export const NEAR_DUPLICATE_MIN_TOKENS = 3;

/** Jaccard similarity of the two texts' token sets: shared tokens over all tokens, and 0 when neither has one. */
export function tokenSetSimilarity(a: string, b: string): number {
  const left = new Set(tokenize(a));
  const right = new Set(tokenize(b));
  const union = new Set([...left, ...right]);
  if (union.size === 0) return 0;
  let shared = 0;
  for (const token of left) if (right.has(token)) shared += 1;
  return shared / union.size;
}

/** Whether `b` repeats `a`: a token-set similarity of 0.8 or more, or, for a short text, an exact normalised match. */
export function isNearDuplicate(a: string, b: string): boolean {
  if (new Set(tokenize(a)).size < NEAR_DUPLICATE_MIN_TOKENS || new Set(tokenize(b)).size < NEAR_DUPLICATE_MIN_TOKENS) {
    return normaliseForQuoteCheck(a) === normaliseForQuoteCheck(b);
  }
  return tokenSetSimilarity(a, b) >= NEAR_DUPLICATE_THRESHOLD;
}
