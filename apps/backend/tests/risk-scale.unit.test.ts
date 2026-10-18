import assert from "node:assert/strict";
import test from "node:test";

import { LIKELIHOODS, CONSEQUENCES, RISK_RATINGS, deriveRating, highestRating, acceptProposalAllowed, isLikelihood, isConsequence, isRiskRating, compareRiskRatings } from "../src/csrm/risk-scale";

/*
 * IN-201 (decision 8): the scale's words and their order are pinned, and every cell of the 5 x 5 grid is written out
 * rather than recomputed from the arrays under test, so a reordered or renamed scale fails here.
 */
test("the scale vocabularies are pinned in order", () => {
  assert.deepEqual(LIKELIHOODS, ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"], "LIKELIHOOD_SCALE_CHANGED");
  assert.deepEqual(CONSEQUENCES, ["Insignificant", "Minor", "Moderate", "Major", "Severe"], "CONSEQUENCE_SCALE_CHANGED");
  assert.deepEqual(RISK_RATINGS, ["Low", "Moderate", "High", "Critical"], "RATING_BANDS_CHANGED");
});

test("the 5 x 5 scale derives every named cell", () => {
  // Rows are likelihoods; columns are Insignificant, Minor, Moderate, Major and Severe.
  const grid: Record<string, readonly string[]> = {
    "Rare": ["Low", "Low", "Low", "Low", "Moderate"],
    "Unlikely": ["Low", "Low", "Moderate", "Moderate", "High"],
    "Possible": ["Low", "Moderate", "Moderate", "High", "High"],
    "Likely": ["Low", "Moderate", "High", "High", "Critical"],
    "Almost certain": ["Moderate", "High", "High", "Critical", "Critical"],
  };
  const consequences = ["Insignificant", "Minor", "Moderate", "Major", "Severe"] as const;
  for (const [likelihood, row] of Object.entries(grid)) {
    for (const [index, consequence] of consequences.entries()) {
      assert.equal(deriveRating(likelihood as never, consequence), row[index], `${likelihood} × ${consequence}`);
    }
  }
  assert.equal(deriveRating("Possible", "Major"), "High");
  assert.equal(deriveRating("Unlikely", "Minor"), "Low");
  assert.equal(deriveRating("Almost certain", "Severe"), "Critical");
});

test("rating order and Accept policy use the same scale", () => {
  assert.equal(highestRating([]), null);
  assert.equal(highestRating(["Low", "High", "Moderate"]), "High");
  assert.equal(compareRiskRatings("Low", "Critical") < 0, true);
  for (const rating of ["Low", "Moderate", "High", "Critical"] as const) {
    assert.equal(isRiskRating(rating), true);
    assert.equal(acceptProposalAllowed(rating), rating === "Low" || rating === "Moderate");
  }
  assert.equal(isLikelihood("High"), false);
  assert.equal(isConsequence("High"), false);
});
