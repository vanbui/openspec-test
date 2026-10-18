// Decision 8 owns this vocabulary and derivation. Phase 18 applies it to risk
// mutations; Phase 22 supplies scales, bands and appetite through these functions.
export const LIKELIHOODS = ["Rare", "Unlikely", "Possible", "Likely", "Almost certain"] as const;
export const CONSEQUENCES = ["Insignificant", "Minor", "Moderate", "Major", "Severe"] as const;
export const RISK_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;

export type Likelihood = typeof LIKELIHOODS[number];
export type Consequence = typeof CONSEQUENCES[number];
export type RiskRating = typeof RISK_RATINGS[number];

export function isLikelihood(value: unknown): value is Likelihood {
  return typeof value === "string" && LIKELIHOODS.includes(value as Likelihood);
}

export function isConsequence(value: unknown): value is Consequence {
  return typeof value === "string" && CONSEQUENCES.includes(value as Consequence);
}

export function isRiskRating(value: unknown): value is RiskRating {
  return typeof value === "string" && RISK_RATINGS.includes(value as RiskRating);
}

export function likelihoodScore(value: Likelihood): number {
  return LIKELIHOODS.indexOf(value) + 1;
}

export function consequenceScore(value: Consequence): number {
  return CONSEQUENCES.indexOf(value) + 1;
}

export function riskScore(likelihood: Likelihood, consequence: Consequence): number {
  return likelihoodScore(likelihood) * consequenceScore(consequence);
}

export function deriveRating(likelihood: Likelihood, consequence: Consequence): RiskRating {
  const score = riskScore(likelihood, consequence);
  if (score <= 4) return "Low";
  if (score <= 9) return "Moderate";
  if (score <= 16) return "High";
  return "Critical";
}

export function compareRiskRatings(left: RiskRating, right: RiskRating): number {
  return RISK_RATINGS.indexOf(left) - RISK_RATINGS.indexOf(right);
}

export function highestRating(ratings: readonly RiskRating[]): RiskRating | null {
  return ratings.reduce<RiskRating | null>((highest, rating) => highest === null || compareRiskRatings(rating, highest) > 0 ? rating : highest, null);
}

export function acceptProposalAllowed(rating: RiskRating): boolean {
  return compareRiskRatings(rating, "Moderate") <= 0;
}
