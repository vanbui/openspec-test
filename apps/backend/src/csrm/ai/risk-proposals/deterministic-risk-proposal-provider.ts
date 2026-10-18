import { REQUEST_FIELDS, type AssessmentContext } from "../assessment-context";
import { tokenize } from "../library-ranking";
import { LIKELIHOODS } from "../../risk-scale";
import { STATEMENT_FIELDS } from "../../../api/csrm-assessment/services/assessment-draft-provider";
import type { RiskListedEntry, RiskProposalContextAllowed } from "./risk-proposal-context";
import type { RiskProposalProvider, RiskProposalProviderInput } from "./risk-proposal-provider";

/*
 * The deterministic risk proposal provider every suite pins (Phase 16 D-50). It returns model-facing wire JSON, exactly
 * as a hosted model would, so the one adapter and every rule it owns (the duplicate tiers, the Accept rule, the cap, the
 * units and the focus) run in unit, integration and browser tests alike (15-RESEARCH Pitfall 9). Its sentences are
 * CSRM's own: request text, notes, file text and the instruction are read only for the rules' triggers, and only a
 * listed Risk's own statement is restated (rules S3 and S4, which exist to be dropped or flagged).
 *
 * "Suggest more risks", in order:
 * - S1: when the request text, the answers, the marked notes, the included file text or the instruction mention
 *   `payment file` (any case) and no listed entry does, the payment-file integrity risk: no Risk Type, the request's
 *   first system and asset, inherent Likely and Major, residual Possible and Major, Treat with a plan, citing the
 *   source that mentions payment files (an answer first, then a request field).
 * - S2: when `segregation of duties` is mentioned and no listed entry names it, a segregation-of-duties risk with
 *   residual Unlikely and Moderate and Accept with a rationale (the adapter keeps the Accept).
 * - S3: a verbatim restatement of `existing-1` with its Risk Type (the adapter drops it as near-identical).
 * - S4: a rewording of `existing-1` sharing about 60 per cent of its tokens, with residual High and Accept (the adapter
 *   keeps it, flags it similar and turns the Accept into Treat).
 *
 * "Rewrite this risk", on the target as the model is shown it: the statement (with an instruction mentioning payment
 * files, S1's statement; otherwise the target's statement and one added sentence) citing an answer; the cause with one
 * added sentence and no source (an uncited claim); the residual likelihood one step lower; with an instruction
 * containing `accept`, Accept with a plan; every other value as the target holds it.
 *
 * `setDeterministicRiskProposalHold` lets a test hold the provider before it returns (16-09's lapse proof). Production
 * code never calls it.
 */

type WireRisk = {
  riskTypeName: string | null;
  issueStatement: string; riskStatement: string; riskCategory: string; riskSubCategory: string; riskCause: string; potentialImpact: string;
  informationSystem: string | null; informationAsset: string | null;
  inherentLikelihood: string; highestInherentConsequence: string; inherentRatingRationale: string;
  residualLikelihood: string; highestResidualConsequence: string; residualRatingRationale: string;
  treatmentAction: "Accept" | "Treat"; treatmentPlan: string;
  sources: Record<(typeof STATEMENT_FIELDS)[number], string[]>;
  uncitedClaims: string[];
  suggestedControls: { controlNumber: string; rationale: string }[];
};

export const PAYMENT_FILE_RISK = Object.freeze({
  riskStatement: "Unsigned payment files reconciled by hand could be altered before the pay run without detection",
  riskCause: "Payment files are not signed and are reconciled by hand",
  potentialImpact: "Fraudulent or mistaken payments reach employees or third parties",
});
export const SEGREGATION_OF_DUTIES_RISK = Object.freeze({
  riskStatement: "Incomplete segregation of duties in pay processing could let one person prepare and release a pay run without an independent check",
  riskCause: "Duties in payment processing are only partly segregated",
});
export const REWRITE_STATEMENT_SENTENCE = "The request's answers describe this exposure.";
export const REWRITE_CAUSE_SENTENCE = "This cause is inferred from the request's description.";
export const REWRITE_UNCITED_CLAIM = "The cause is inferred from the request's description; no answer confirms it.";
export const REWRITE_ACCEPT_PLAN = "Accept the residual risk: it is within tolerance once the existing controls operate as described, and it is reviewed at the next assessment.";

const PAYMENT_FILE = /payment file/i;
const SEGREGATION = /segregation of duties/i;
const ACCEPT_WORD = /\baccept\b/i;
/* Words S4 adds to existing-1's statement: distinct, three letters or more, none on the tokeniser's stop list. */
const REWORDING_VOCABULARY = ["oversight", "escalation", "ownership", "unclear", "inconsistent", "periodic", "sampling", "exceptions", "handover", "weekend", "contractor", "turnover", "backlog", "fatigue", "informal", "undocumented", "legacy", "tooling", "visibility", "reporting", "thresholds", "alerts", "triage", "workload", "rotation", "coverage", "training", "awareness", "budget", "priorities", "renewal", "findings", "drift", "baseline", "staffing", "deadlines", "approvals", "complexity", "dependencies", "documentation"];

let hold: Promise<unknown> | null = null;
/** Holds every deterministic risk proposal call before it returns, until the promise settles; null releases. Tests only. */
export function setDeterministicRiskProposalHold(promise: Promise<unknown> | null): void {
  hold = promise;
}
async function held(): Promise<void> {
  if (hold) await hold.catch(() => undefined);
}

const noSources = (): WireRisk["sources"] => Object.fromEntries(STATEMENT_FIELDS.map((field) => [field, []])) as unknown as WireRisk["sources"];
const sourcesOn = (keys: string[], ...fields: (typeof STATEMENT_FIELDS)[number][]): WireRisk["sources"] => ({ ...noSources(), ...Object.fromEntries(fields.map((field) => [field, [...keys]])) });

function allowedOf(context: AssessmentContext): RiskProposalContextAllowed {
  if (!context.riskProposals) throw new Error("CSRM risk proposal context has no risk proposal part.");
  return context.riskProposals;
}

/* Where the rules look for their triggers: each piece of text with the source key the context offers for it, if any. */
function evidence(input: RiskProposalProviderInput): { key: string | null; text: string }[] {
  const { context, records } = input;
  const sourceKeys = new Set(context.allowed.sourceKeys);
  const cite = (key: string): string | null => sourceKeys.has(key) ? key : null;
  return [
    ...(records.answers ?? []).map((answer) => ({ key: cite(`answer.${answer.questionKey}`), text: `${answer.questionText} ${answer.answerLabel}` })),
    ...REQUEST_FIELDS.map((field) => ({ key: cite(`request.${field}`), text: typeof records.request[field] === "string" ? records.request[field] as string : "" })),
    ...(records.notes ?? []).map((note) => ({ key: null, text: note.body })),
    ...(records.attachments ?? []).map((file) => ({ key: null, text: file.text })),
    ...(input.instruction ? [{ key: null, text: input.instruction as string }] : []),
  ];
}

const listedEntries = (allowed: RiskProposalContextAllowed): RiskListedEntry[] => [...allowed.listed.existing, ...allowed.listed.withdrawn, ...allowed.listed.rejected, ...allowed.listed.open];
const listedMentions = (allowed: RiskProposalContextAllowed, pattern: RegExp): boolean => listedEntries(allowed).some((entry) => pattern.test(`${entry.riskStatement} ${entry.riskCause}`));

function triggered(input: RiskProposalProviderInput, pattern: RegExp): { citation: string[] } | null {
  const found = evidence(input).filter(({ text }) => pattern.test(text));
  if (found.length === 0 || listedMentions(allowedOf(input.context), pattern)) return null;
  const cited = found.find(({ key }) => key !== null)?.key;
  return { citation: cited ? [cited] : [] };
}

function paymentFileRisk(input: RiskProposalProviderInput, citation: string[]): WireRisk {
  const { allowed } = input.context;
  const candidates = Object.entries(allowed.controlCandidates).filter(([, control]) => /integrity|reconcil/i.test(control.name)).slice(0, 2);
  return {
    riskTypeName: null,
    issueStatement: "Payment files are not signed before they are released for payment.",
    riskStatement: PAYMENT_FILE_RISK.riskStatement, riskCategory: "Payment integrity", riskSubCategory: "Payment file tampering",
    riskCause: PAYMENT_FILE_RISK.riskCause, potentialImpact: PAYMENT_FILE_RISK.potentialImpact,
    informationSystem: Object.keys(allowed.systems)[0] ?? null, informationAsset: Object.keys(allowed.assets)[0] ?? null,
    inherentLikelihood: "Likely", highestInherentConsequence: "Major", inherentRatingRationale: "Without signing, an altered file would be paid as received.",
    residualLikelihood: "Possible", highestResidualConsequence: "Major", residualRatingRationale: "Reconciling by hand catches some alterations, but not reliably before the pay run.",
    treatmentAction: "Treat", treatmentPlan: "Sign payment files when they are created, verify the signature before release and reconcile them automatically.",
    sources: sourcesOn(citation, "issueStatement", "riskStatement", "riskCause"), uncitedClaims: [],
    suggestedControls: candidates.map(([controlNumber, control]) => ({ controlNumber, rationale: `${control.name} detects or prevents an altered payment file.` })),
  };
}

function segregationRisk(citation: string[]): WireRisk {
  return {
    riskTypeName: null,
    issueStatement: "Duties in pay processing are only partly segregated.",
    riskStatement: SEGREGATION_OF_DUTIES_RISK.riskStatement, riskCategory: "Payment integrity", riskSubCategory: "Segregation of duties",
    riskCause: SEGREGATION_OF_DUTIES_RISK.riskCause, potentialImpact: "An incorrect or improper pay run could be released without an independent check.",
    informationSystem: null, informationAsset: null,
    inherentLikelihood: "Possible", highestInherentConsequence: "Moderate", inherentRatingRationale: "One person can complete several steps of a pay run.",
    residualLikelihood: "Unlikely", highestResidualConsequence: "Moderate", residualRatingRationale: "The partial segregation and the payroll reconciliation limit the exposure.",
    treatmentAction: "Accept", treatmentPlan: "Accept the residual risk: the remaining overlap in duties is small and the payroll reconciliation checks every pay run.",
    sources: sourcesOn(citation, "issueStatement", "riskStatement", "riskCause"), uncitedClaims: [], suggestedControls: [],
  };
}

function restatement(entry: RiskListedEntry, overrides: Partial<WireRisk>): WireRisk {
  return {
    riskTypeName: entry.riskTypeName,
    issueStatement: "This exposure may need to be recorded.", riskStatement: entry.riskStatement, riskCategory: "Restated risk", riskSubCategory: "Restated risk",
    riskCause: entry.riskCause, potentialImpact: "The exposure described could affect the service.",
    informationSystem: null, informationAsset: null,
    inherentLikelihood: "Possible", highestInherentConsequence: "Moderate", inherentRatingRationale: "As described for the existing risk.",
    residualLikelihood: "Possible", highestResidualConsequence: "Moderate", residualRatingRationale: "As described for the existing risk.",
    treatmentAction: "Treat", treatmentPlan: "Review the existing treatment for this exposure.",
    sources: noSources(), uncitedClaims: [], suggestedControls: [],
    ...overrides,
  };
}

/* S4's statement: existing-1's statement and one sentence of new words, so the token sets share about 60 per cent. */
function rewording(entry: RiskListedEntry): string {
  const shared = new Set(tokenize(`${entry.riskStatement} ${entry.riskCause}`));
  const prefix = "Contributing factors include";
  const prefixNew = tokenize(prefix).filter((token) => !shared.has(token)).length;
  const wanted = Math.max(1, Math.ceil(shared.size * 2 / 3) - prefixNew);
  const words = REWORDING_VOCABULARY.filter((word) => !shared.has(word)).slice(0, wanted);
  return `${entry.riskStatement} ${prefix} ${words.join(", ")}.`;
}

function suggestions(input: RiskProposalProviderInput): WireRisk[] {
  const allowed = allowedOf(input.context);
  const risks: WireRisk[] = [];
  const payment = triggered(input, PAYMENT_FILE);
  if (payment) risks.push(paymentFileRisk(input, payment.citation));
  const segregation = triggered(input, SEGREGATION);
  if (segregation) risks.push(segregationRisk(segregation.citation));
  const first = allowed.listed.existing[0];
  const typeOffered = first && (first.riskTypeName === null || Object.prototype.hasOwnProperty.call(input.context.allowed.riskTypes, first.riskTypeName));
  if (first && typeOffered && first.riskStatement && first.riskCause) {
    risks.push(restatement(first, {}));
    risks.push(restatement(first, {
      riskStatement: rewording(first), residualLikelihood: "Likely", highestResidualConsequence: "Moderate",
      treatmentAction: "Accept", treatmentPlan: "Accept the residual risk while the existing reviews continue.",
    }));
  }
  return risks;
}

function rewrite(input: RiskProposalProviderInput): WireRisk {
  const target = allowedOf(input.context).target;
  if (!target) throw new Error("CSRM risk rewrite context has no target.");
  const wire = target.wire;
  const instruction = typeof input.instruction === "string" ? input.instruction : "";
  const sourceKeys = input.context.allowed.sourceKeys;
  const answer = sourceKeys.find((key) => key.startsWith("answer.")) ?? sourceKeys.find((key) => key.startsWith("request."));
  const statement = PAYMENT_FILE.test(instruction) ? PAYMENT_FILE_RISK.riskStatement : [wire.riskStatement, REWRITE_STATEMENT_SENTENCE].filter(Boolean).join(" ");
  const likelihood = (value: string | null): string => value && (LIKELIHOODS as readonly string[]).includes(value) ? value : "Possible";
  const residual = likelihood(wire.residualLikelihood);
  const accept = ACCEPT_WORD.test(instruction);
  return {
    riskTypeName: wire.riskTypeName,
    issueStatement: wire.issueStatement, riskStatement: statement, riskCategory: wire.riskCategory, riskSubCategory: wire.riskSubCategory,
    riskCause: [wire.riskCause, REWRITE_CAUSE_SENTENCE].filter(Boolean).join(" "), potentialImpact: wire.potentialImpact,
    informationSystem: wire.informationSystem, informationAsset: wire.informationAsset,
    inherentLikelihood: likelihood(wire.inherentLikelihood), highestInherentConsequence: wire.highestInherentConsequence ?? "Moderate", inherentRatingRationale: wire.inherentRatingRationale,
    residualLikelihood: LIKELIHOODS[Math.max(0, LIKELIHOODS.indexOf(residual as (typeof LIKELIHOODS)[number]) - 1)],
    highestResidualConsequence: wire.highestResidualConsequence ?? "Moderate", residualRatingRationale: wire.residualRatingRationale,
    treatmentAction: accept ? "Accept" : wire.treatmentAction === "Accept" ? "Accept" : "Treat",
    treatmentPlan: accept ? REWRITE_ACCEPT_PLAN : wire.treatmentPlan,
    sources: sourcesOn(answer ? [answer] : [], "riskStatement"), uncitedClaims: [REWRITE_UNCITED_CLAIM], suggestedControls: [],
  };
}

export const deterministicRiskProposalProvider: RiskProposalProvider = {
  name: "deterministic-risk-proposals",
  version: "1",
  async suggest(input) {
    const risks = suggestions(input);
    await held();
    return { schemaVersion: 1, risks };
  },
  async rewrite(input) {
    const risk = rewrite(input);
    await held();
    return { schemaVersion: 1, risk };
  },
};
