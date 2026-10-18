import assert from "node:assert/strict";
import test from "node:test";
import { isNearDuplicate, NEAR_DUPLICATE_MIN_TOKENS, NEAR_DUPLICATE_THRESHOLD, tokenSetSimilarity } from "../src/csrm/ai/text-similarity";

/*
 * Phase 15 D-15 (the approved amendment's "Bounds": near-duplicate): token-set Jaccard of 0.8 or more, and an exact
 * normalised match when either side has fewer than three tokens. Phase 16 reuses the scorer.
 */

test("the threshold is 0.8 and short texts have fewer than three tokens", () => {
  assert.equal(NEAR_DUPLICATE_THRESHOLD, 0.8);
  assert.equal(NEAR_DUPLICATE_MIN_TOKENS, 3);
});

test("a verbatim repeat with different punctuation scores 1 and is a near-duplicate", () => {
  const original = "Where is the offshore support team based?";
  const repeat = "Where is the offshore support team based.";
  assert.equal(tokenSetSimilarity(original, repeat), 1);
  assert.equal(isNearDuplicate(original, repeat), true);
});

test("a question that asks something more scores below 0.8 and is kept", () => {
  const original = "Where is the offshore support team based?";
  const other = "In which country is the offshore support team based?";
  // {where, offshore, support, team, based} against {which, country, offshore, support, team, based}: 4 of 7.
  assert.ok(Math.abs(tokenSetSimilarity(original, other) - 4 / 7) < 1e-9);
  assert.equal(isNearDuplicate(original, other), false);
});

test("short texts compare exactly after normalisation", () => {
  assert.equal(isNearDuplicate("Is MFA used?", "Is MFA enforced?"), false);
  assert.equal(isNearDuplicate("Is MFA used?", "is mfa  USED?"), true);
});

test("two texts with no token score 0", () => {
  assert.equal(tokenSetSimilarity("", "?"), 0);
});
