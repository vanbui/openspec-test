/*
 * The risk proposal adapters (Phase 16 D-25, D-30 to D-38; the approved Phase 16 amendment to
 * docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Risk proposal envelope v1" and "Bounds").
 *
 * A provider, deterministic or hosted, returns model-facing wire JSON; these adapters are the only way it becomes the
 * risk proposal envelope v1 a run keeps (Phase 15's pattern, 15-RESEARCH Pitfall 9). They own every rule whatever the
 * model or the analyst instruction says (D-27): the exact structure (anything else fails the run with
 * `PROVIDER_OUTPUT_INVALID`), Phase 12's per-risk steps (ids, derived ratings, classification from the asset, sources
 * and suggested controls from the context), the two duplicate tiers, the one Accept rule and the cap of 8. Every detail
 * is CSRM's own sentence, built from closed values only: never model or Requestor text. The closed, context-aware
 * parser (`parseRiskProposal`) is the gate: a result it refuses fails the run.
 */
import { assessmentDraftRiskWireSchema, DRAFT_WIRE_RISK_KEYS, toAssessmentDraftRisk } from "../../../api/csrm-assessment/services/openai-compatible-assessment-draft-provider";
import { RISK_CATEGORY_MAX_CHARACTERS, STATEMENT_FIELDS, type AssessmentRiskDraftProposal } from "../../../api/csrm-assessment/services/assessment-draft-provider";
import { riskHasPlannedControl } from "../../../api/csrm-assessment/services/ai-proposal-decisions";
import { deriveRating, isConsequence, isLikelihood } from "../../risk-scale";
import type { AssessmentContext } from "../assessment-context";
import { ProposalJobFailure } from "../proposal-job-registry";
import { aiAcceptCheck, diffIntoUnits, residualRatingAfter } from "./field-units";
import { classifyProposedRisk, type DuplicateEntry, type DuplicatePoolKind } from "./risk-duplicates";
import type { RiskProposalContextAllowed } from "./risk-proposal-context";
import { parseRiskProposal, RISK_PROPOSAL_BOUNDS, RISK_SUGGESTIONS_MAX, type RiskChangeUnitItem, type RiskProposalAdjustment, type RiskProposalAdjustmentCode, type RiskProposalV1, type RiskSimilarity, type RiskSuggestionItem } from "./risk-proposal-envelope";

type RecordValue = Record<string, unknown>;

export const RISK_PROPOSAL_WIRE_SCHEMA_VERSION = 1;
/** Wire risks examined per run; any beyond them count as over the limit, unexamined. */
export const RISK_WIRE_RISKS_EXAMINED = 50;
const WIRE_ARRAY_MAX = 1_000;
/* At most 40 adjustments are recorded one by one; the rest are counted per code, so the envelope stays within its 60. */
const INDIVIDUAL_ADJUSTMENTS_MAX = 40;

export function invalidRiskProposalOutput(): ProposalJobFailure {
  return new ProposalJobFailure("PROVIDER_OUTPUT_INVALID", "Provider returned invalid output.");
}

const isRecord = (value: unknown): value is RecordValue => typeof value === "object" && value !== null && !Array.isArray(value);
const hasExactKeys = (value: RecordValue, keys: readonly string[]): boolean => Object.keys(value).length === keys.length && keys.every((key) => key in value);
const isStringArray = (value: unknown): value is string[] => Array.isArray(value) && value.length <= WIRE_ARRAY_MAX && value.every((entry) => typeof entry === "string");
const isNullableString = (value: unknown): boolean => value === null || typeof value === "string";

const NULLABLE_WIRE_FIELDS = ["riskTypeName", "informationSystem", "informationAsset"] as const;
const STRING_WIRE_FIELDS = DRAFT_WIRE_RISK_KEYS.filter((key) => !(NULLABLE_WIRE_FIELDS as readonly string[]).includes(key) && key !== "sources" && key !== "uncitedClaims" && key !== "suggestedControls");

/** One wire risk's exact structure (keys and JSON types). Its values are judged by Phase 12's per-risk steps. */
export function checkWireRiskStructure(value: unknown): RecordValue {
  if (!isRecord(value) || !hasExactKeys(value, DRAFT_WIRE_RISK_KEYS)) throw invalidRiskProposalOutput();
  if (NULLABLE_WIRE_FIELDS.some((key) => !isNullableString(value[key])) || STRING_WIRE_FIELDS.some((key) => typeof value[key] !== "string")) throw invalidRiskProposalOutput();
  const sources = value.sources;
  if (!isRecord(sources) || !hasExactKeys(sources, STATEMENT_FIELDS) || STATEMENT_FIELDS.some((field) => !isStringArray(sources[field]))) throw invalidRiskProposalOutput();
  if (!isStringArray(value.uncitedClaims)) throw invalidRiskProposalOutput();
  if (!Array.isArray(value.suggestedControls) || value.suggestedControls.length > WIRE_ARRAY_MAX
    || !value.suggestedControls.every((item) => isRecord(item) && hasExactKeys(item, ["controlNumber", "rationale"]) && typeof item.controlNumber === "string" && typeof item.rationale === "string")) throw invalidRiskProposalOutput();
  return value;
}

/* The adjustments of one run: individual entries first, then the overflow per code, then the aggregated counts. */
class AdjustmentLog {
  private readonly individual: RiskProposalAdjustment[] = [];
  private readonly overflow = new Map<RiskProposalAdjustmentCode, number>();
  private readonly counted = new Map<RiskProposalAdjustmentCode, { count: number; detail: (count: number) => string }>();

  record(code: RiskProposalAdjustmentCode, wireIndex: number | undefined, detail: string): void {
    if (this.individual.length < INDIVIDUAL_ADJUSTMENTS_MAX) this.individual.push({ code, ...(wireIndex === undefined ? {} : { wireIndex }), detail });
    else this.overflow.set(code, (this.overflow.get(code) ?? 0) + 1);
  }

  count(code: RiskProposalAdjustmentCode, detail: (count: number) => string, by = 1): void {
    if (by <= 0) return;
    const current = this.counted.get(code);
    this.counted.set(code, { count: (current?.count ?? 0) + by, detail });
  }

  /* An adjustment that already carries its own count and sentence (a unit diff's no-change or outside-focus). */
  add(adjustment: RiskProposalAdjustment): void {
    this.individual.push(adjustment);
  }

  list(): RiskProposalAdjustment[] {
    const adjustments = [...this.individual];
    for (const [code, count] of this.overflow) adjustments.push({ code, count, detail: `${count} more proposed ${count === 1 ? "risk was" : "risks were"} changed or left out for the same reason.` });
    for (const [code, { count, detail }] of this.counted) adjustments.push({ code, count, detail: detail(count) });
    return adjustments;
  }
}

const risks = (count: number): string => `${count} proposed ${count === 1 ? "risk" : "risks"}`;
const DETAIL = {
  invalidItem: "A proposed risk used a value the request did not offer or broke a limit, so it was left out.",
  nearDuplicate: {
    active: "A proposed risk repeated a risk already in the assessment, so it was left out.",
    withdrawn: "A proposed risk repeated a risk the analyst withdrew, so it was left out.",
    rejected: "A proposed risk repeated a suggestion the analyst rejected, so it was left out.",
    open: "A proposed risk repeated a suggestion that is still open, so it was left out.",
    sameRun: "A proposed risk repeated another risk proposed in the same run, so it was left out.",
  } satisfies Record<DuplicatePoolKind, string>,
  acceptNotPermitted: "A proposed Accept was changed to Treat: the AI may propose Accept only for a Low or Moderate residual rating.",
  acceptWithSuggestedControls: "A proposed Accept was changed to Treat because the same risk also suggested controls.",
  acceptWithoutRationale: "A proposed Accept was changed to Treat because it gave no reason in the treatment plan.",
  overLimit: (count: number) => `${count} more proposed ${count === 1 ? "risk was" : "risks were"} beyond the limit of ${RISK_SUGGESTIONS_MAX} per run and left out.`,
  sourcesDropped: (count: number) => `Sources the request did not offer were removed from ${risks(count)}.`,
  suggestionsDropped: (count: number) => `Suggested controls the request did not offer, or offered twice, were removed from ${risks(count)}.`,
  suggestionsCapped: (count: number) => `Suggested controls past five were left out of ${risks(count)}.`,
} as const;

const NEAR_DUPLICATE_CODES: Readonly<Record<DuplicatePoolKind, RiskProposalAdjustmentCode>> = {
  active: "near-duplicate-active",
  withdrawn: "near-duplicate-withdrawn",
  rejected: "near-duplicate-rejected",
  open: "near-duplicate-proposed",
  sameRun: "near-duplicate-proposed",
};

function allowedOf(context: AssessmentContext, operation: RiskProposalContextAllowed["operation"]): RiskProposalContextAllowed {
  const allowed = context.riskProposals;
  if (!allowed || allowed.operation !== operation || context.operation !== operation) throw new Error(`CSRM ${operation} context has no risk proposal part.`);
  return allowed;
}

/* The closed, context-aware parser is the gate (06.7 D-07): a result it refuses fails the run. */
function gated(envelope: unknown, context: AssessmentContext, riskDocumentId?: string): RiskProposalV1 {
  const parsed = parseRiskProposal(envelope, { context: context.allowed, ...(riskDocumentId ? { riskDocumentId } : {}) });
  if (parsed === null) throw invalidRiskProposalOutput();
  return parsed;
}

const roundedScore = (score: number): number => Math.round(score * 1_000) / 1_000;

/*
 * `similarTo` names a record or a stored item: an active or withdrawn Risk, or a rejected or open suggestion of an
 * earlier run. A similar match in the same run has no such target (the envelope has no same-run kind), so the
 * reviewer is pointed at the closest stored match instead, or at nothing: two similar suggestions of one run sit side
 * by side in the same review, while overlap with the register is what a reviewer must not miss (16-02's open point,
 * decided in 16-08).
 */
function similarityTo(allowed: RiskProposalContextAllowed, candidate: AssessmentRiskDraftProposal, pools: { sameRun: DuplicateEntry[] }): RiskSimilarity | null {
  const comparable = { riskType: candidate.riskTypeName, riskStatement: candidate.riskStatement, riskCause: candidate.riskCause };
  let verdict = classifyProposedRisk(comparable, { ...allowed.pools, ...pools });
  if (verdict.tier === "similar" && verdict.against.kind === "sameRun") verdict = classifyProposedRisk(comparable, allowed.pools);
  if (verdict.tier !== "similar") return null;
  const ref = allowed.refs.get(verdict.against.ref);
  if (!ref) return null;
  const score = roundedScore(verdict.score);
  return "riskDocumentId" in ref
    ? { kind: ref.kind, riskDocumentId: ref.riskDocumentId, score }
    : { kind: ref.kind, runId: ref.runId, itemKey: ref.itemKey, score };
}

/* The draft step's own Accept downgrades, as the envelope's one code with CSRM's sentence for each. */
const DRAFT_ACCEPT_ADJUSTMENTS: ReadonlyArray<[string, string]> = [
  ["accept-not-permitted", DETAIL.acceptNotPermitted],
  ["accept-with-suggested-controls", DETAIL.acceptWithSuggestedControls],
  ["accept-without-rationale", DETAIL.acceptWithoutRationale],
];

/**
 * The risk proposal envelope v1 of a `risk-suggestions` run. Per wire risk, in order: Phase 12's per-risk steps (a
 * value they refuse leaves the risk out as `invalid-item`); the duplicate tiers against the active, withdrawn, rejected
 * and open entries the context listed and the risks kept so far (near-identical: left out as `near-duplicate-*`;
 * similar: kept with `similarTo`); the Accept rule (`aiAcceptCheck` with no planned control: a refusal is Treat with
 * `accept-not-permitted`); the cap of 8 (the rest as one `over-limit` count). Kept risks are keyed `s-1` onwards in
 * order; nothing kept is `no-change`.
 */
export function toRiskSuggestionsProposal(raw: unknown, context: AssessmentContext): RiskProposalV1 {
  const allowed = allowedOf(context, "risk-suggestions");
  if (!isRecord(raw) || !hasExactKeys(raw, ["schemaVersion", "risks"]) || raw.schemaVersion !== RISK_PROPOSAL_WIRE_SCHEMA_VERSION || !Array.isArray(raw.risks) || raw.risks.length > WIRE_ARRAY_MAX) throw invalidRiskProposalOutput();
  const wire = raw.risks.map(checkWireRiskStructure);
  const log = new AdjustmentLog();
  const items: RiskSuggestionItem[] = [];
  const sameRun: DuplicateEntry[] = [];
  let overLimit = Math.max(0, wire.length - RISK_WIRE_RISKS_EXAMINED);
  for (const [wireIndex, value] of wire.slice(0, RISK_WIRE_RISKS_EXAMINED).entries()) {
    let risk: AssessmentRiskDraftProposal;
    try {
      risk = toAssessmentDraftRisk(value, context);
    } catch {
      log.record("invalid-item", wireIndex, DETAIL.invalidItem);
      continue;
    }
    const comparable = { riskType: risk.riskTypeName, riskStatement: risk.riskStatement, riskCause: risk.riskCause };
    const verdict = classifyProposedRisk(comparable, { ...allowed.pools, sameRun });
    if (verdict.tier === "near-identical") {
      log.record(NEAR_DUPLICATE_CODES[verdict.against.kind], wireIndex, DETAIL.nearDuplicate[verdict.against.kind]);
      continue;
    }
    if (items.length >= RISK_SUGGESTIONS_MAX) {
      overLimit += 1;
      continue;
    }
    let proposed: AssessmentRiskDraftProposal = { ...risk, proposalKey: `risk-${items.length + 1}` };
    for (const [adjustment, detail] of DRAFT_ACCEPT_ADJUSTMENTS) if (risk.adjustments.includes(adjustment)) log.record("accept-not-permitted", wireIndex, detail);
    // D-38: the one Accept rule; a suggestion creates a new Risk, which has no control implementation yet.
    if (proposed.treatmentAction === "Accept") {
      const refusal = aiAcceptCheck({ residualRating: proposed.residualRating, plan: proposed.treatmentPlan, hasPlannedControl: false });
      if (refusal) {
        proposed = { ...proposed, treatmentAction: "Treat", adjustments: [...new Set([...proposed.adjustments, refusal])] };
        log.record(refusal, wireIndex, DETAIL.acceptNotPermitted);
      }
    }
    if (proposed.adjustments.includes("sources-dropped")) log.count("sources-dropped", DETAIL.sourcesDropped);
    if (proposed.adjustments.includes("suggestions-dropped")) log.count("suggestions-dropped", DETAIL.suggestionsDropped);
    if (proposed.adjustments.includes("suggestions-capped")) log.count("suggestions-capped", DETAIL.suggestionsCapped);
    const key = `s-${items.length + 1}`;
    items.push({ key, kind: "risk", proposed, similarTo: similarityTo(allowed, proposed, { sameRun }) });
    sameRun.push({ ref: key, ...comparable });
  }
  log.count("over-limit", DETAIL.overLimit, overLimit);
  return gated({ schemaVersion: 1, operation: "risk-suggestions", outcome: items.length ? "items" : "no-change", items, adjustments: log.list() }, context);
}

/* A rewrite whose one risk breaks a value rule is left out whole, as `invalid-item`. */
class RewriteValueRefused extends Error {}
const refuse = (): never => { throw new RewriteValueRefused(); };

const REWRITE_DETAIL = {
  acceptNotPermitted: "The proposed Accept was changed to Treat: the AI may propose Accept only for a Low or Moderate residual rating, with a reason in the treatment plan.",
  acceptWithPlannedControl: "The proposed Accept was changed to Treat because the risk has a planned control implementation.",
  invalidItem: "The rewritten risk used a value the request did not offer or broke a limit, so nothing was proposed.",
  sourcesDropped: () => "Sources the request did not offer were removed from the rewrite.",
  suggestionsDropped: () => "A rewrite changes no control, so the controls it suggested were left out.",
} as const;

/* The rewrite's text fields as the wire names them, with their bounds (Phase 12's draft bounds). */
const REWRITE_TEXT_FIELDS: ReadonlyArray<readonly [string, number]> = [
  ["issueStatement", 2_000], ["riskStatement", 2_000], ["riskCategory", RISK_CATEGORY_MAX_CHARACTERS], ["riskSubCategory", RISK_CATEGORY_MAX_CHARACTERS],
  ["riskCause", 2_000], ["potentialImpact", 2_000], ["inherentRatingRationale", 2_000], ["residualRatingRationale", 2_000], ["treatmentPlan", 2_000],
];
const RATING_FIELDS: ReadonlyArray<readonly [string, (value: unknown) => boolean]> = [
  ["inherentLikelihood", isLikelihood], ["highestInherentConsequence", isConsequence], ["residualLikelihood", isLikelihood], ["highestResidualConsequence", isConsequence],
];
const MAX_UNCITED_CLAIMS = 5;

type RewriteMapping = { proposed: Record<string, string | null>; sources: Record<string, string[]>; uncited: string[] };

/*
 * The one wire risk as the target's twenty AI-writable values, mapped as Phase 12 maps a drafted risk: a Risk Type by
 * its offered name, a system or asset by its short key (the classification follows the asset only when the asset
 * changes; otherwise the target keeps its own), ratings derived later by the units. A rewrite never clears a value: an
 * empty text, or a null Risk Type, system or asset, keeps what the target holds. Sources are filtered to the context's.
 */
function mapRewrite(wire: RecordValue, context: AssessmentContext, base: Readonly<Record<string, string | null>>, log: AdjustmentLog): RewriteMapping {
  const proposed: Record<string, string | null> = { ...base };
  const { allowed } = context;
  if (wire.riskTypeName !== null) proposed.riskType = Object.prototype.hasOwnProperty.call(allowed.riskTypes, wire.riskTypeName as string) ? allowed.riskTypes[wire.riskTypeName as string] : refuse();
  for (const [field, maximum] of REWRITE_TEXT_FIELDS) {
    const text = (wire[field] as string).trim();
    if (text.length > maximum) refuse();
    if (text) proposed[field] = text;
  }
  if (wire.informationSystem !== null) proposed.informationSystemImpacted = Object.prototype.hasOwnProperty.call(allowed.systems, wire.informationSystem as string) ? allowed.systems[wire.informationSystem as string] : refuse();
  if (wire.informationAsset !== null) {
    const asset = Object.prototype.hasOwnProperty.call(allowed.assets, wire.informationAsset as string) ? allowed.assets[wire.informationAsset as string] : refuse();
    if (asset.documentId !== base.informationAssetImpacted) {
      proposed.informationAssetImpacted = asset.documentId;
      proposed.dataClassification = asset.classification;
    }
  }
  for (const [field, valid] of RATING_FIELDS) proposed[field] = valid(wire[field]) ? wire[field] as string : refuse();
  proposed.treatmentAction = wire.treatmentAction === "Accept" || wire.treatmentAction === "Treat" ? wire.treatmentAction : refuse();
  const wireSources = wire.sources as Record<string, string[]>;
  let dropped = false;
  const sources = Object.fromEntries(STATEMENT_FIELDS.map((field) => {
    const kept = wireSources[field].filter((key) => allowed.sourceKeys.includes(key));
    if (kept.length !== wireSources[field].length) dropped = true;
    return [field, [...new Set(kept)]];
  }));
  if (dropped) log.count("sources-dropped", REWRITE_DETAIL.sourcesDropped);
  const claims = wire.uncitedClaims as string[];
  if (!claims.every((claim) => claim.trim().length > 0 && claim.length <= RISK_PROPOSAL_BOUNDS.uncitedClaim)) refuse();
  if ((wire.suggestedControls as unknown[]).length > 0) log.count("suggestions-dropped", REWRITE_DETAIL.suggestionsDropped);
  return { proposed, sources, uncited: claims.slice(0, MAX_UNCITED_CLAIMS) };
}

const STATEMENT_FIELD_NAMES: readonly string[] = STATEMENT_FIELDS;

/**
 * The risk proposal envelope v1 of a `risk-rewrite` run: the exact structure (`PROVIDER_OUTPUT_INVALID` otherwise); the
 * one risk mapped as Phase 12 maps a drafted risk (a value it refuses: no item, `invalid-item`); the Accept rule when
 * the AI changes the action to Accept (`aiAcceptCheck` with the target's `riskHasPlannedControl`: a refusal is Treat,
 * with the target's own plan, and `accept-not-permitted` or `accept-with-planned-control`); then `diffIntoUnits`
 * against the base captured when the context was built, with the focus. A statement unit carries its sources (an empty
 * list when it cites nothing, with the risk's uncited claims). No unit left is `no-change`.
 */
export function toRiskRewriteProposal(raw: unknown, context: AssessmentContext): RiskProposalV1 {
  const allowed = allowedOf(context, "risk-rewrite");
  const target = allowed.target;
  if (!target) throw new Error("CSRM risk rewrite context has no target.");
  if (!isRecord(raw) || !hasExactKeys(raw, ["schemaVersion", "risk"]) || raw.schemaVersion !== RISK_PROPOSAL_WIRE_SCHEMA_VERSION) throw invalidRiskProposalOutput();
  const wire = checkWireRiskStructure(raw.risk);
  const log = new AdjustmentLog();
  const noChange = (): RiskProposalV1 => gated({ schemaVersion: 1, operation: "risk-rewrite", outcome: "no-change", items: [], adjustments: log.list() }, context, target.riskDocumentId);
  let mapping: RewriteMapping;
  try {
    mapping = mapRewrite(wire, context, target.base, log);
  } catch (error) {
    if (!(error instanceof RewriteValueRefused)) throw error;
    log.record("invalid-item", 0, REWRITE_DETAIL.invalidItem);
    return noChange();
  }
  const { proposed, sources, uncited } = mapping;
  // D-38 and G-14: the one Accept rule, when the AI changes the action to Accept (a human's Accept is not the AI's).
  // The rating the Accept is checked against is the one the run can leave: the AI's residual only while the ratings are
  // in focus; otherwise the focus drops that unit and the target keeps its own (the decision step's residualRatingAfter).
  if (proposed.treatmentAction === "Accept" && target.base.treatmentAction !== "Accept") {
    const ratingsInFocus = !allowed.focus || allowed.focus.length === 0 || allowed.focus.includes("ratings");
    const likelihood = proposed.residualLikelihood, consequence = proposed.highestResidualConsequence;
    const refusal = aiAcceptCheck({
      residualRating: !ratingsInFocus
        ? residualRatingAfter(target.base, [])
        : isLikelihood(likelihood) && isConsequence(consequence) ? deriveRating(likelihood, consequence) : null,
      plan: (wire.treatmentPlan as string).trim(),
      hasPlannedControl: riskHasPlannedControl(target.controls.map((control) => ({ controlStatus: control.status }))),
    });
    if (refusal) {
      proposed.treatmentAction = "Treat";
      proposed.treatmentPlan = target.base.treatmentPlan;
      log.record(refusal, undefined, refusal === "accept-with-planned-control" ? REWRITE_DETAIL.acceptWithPlannedControl : REWRITE_DETAIL.acceptNotPermitted);
    }
  }
  const diff = diffIntoUnits(target.base, proposed, { focus: allowed.focus ?? undefined });
  for (const adjustment of diff.adjustments) log.add({ code: adjustment.code, count: adjustment.count, detail: adjustment.detail });
  const items: RiskChangeUnitItem[] = diff.units.map((unit) => {
    const statementFields = unit.fields.filter((field) => STATEMENT_FIELD_NAMES.includes(field));
    const cited = [...new Set(statementFields.flatMap((field) => sources[field] ?? []))].slice(0, RISK_PROPOSAL_BOUNDS.sources);
    return {
      key: unit.key, kind: "change", riskDocumentId: target.riskDocumentId, fields: unit.fields, base: unit.base, proposed: unit.proposed,
      ...(statementFields.length ? { sources: cited, ...(cited.length === 0 && uncited.length ? { uncited } : {}) } : {}),
      ...(unit.aiAccept ? { aiAccept: true as const } : {}),
    };
  });
  if (items.length === 0) return noChange();
  return gated({ schemaVersion: 1, operation: "risk-rewrite", outcome: "items", items, adjustments: log.list() }, context, target.riskDocumentId);
}

/*
 * The two wires (Phase 16 D-25): Phase 12's draft wire v2 risk object, reused unchanged, inside the strict
 * structured-output subset (every field required, nullable as a type pair, no length, count, pattern or format
 * keyword). Suggestions: `{ schemaVersion: 1, risks: [risk] }` (`risk_suggestions`); a rewrite: `{ schemaVersion: 1,
 * risk }` (`risk_rewrite`). The wire carries no rating, id or classification: the adapter derives and maps them.
 */
const versionSchema = { type: "integer", enum: [RISK_PROPOSAL_WIRE_SCHEMA_VERSION] };
const wireObject = (properties: Record<string, unknown>) => ({ type: "object", additionalProperties: false, required: Object.keys(properties), properties });
export function riskSuggestionsWireSchema(context: AssessmentContext): Record<string, unknown> {
  return wireObject({ schemaVersion: versionSchema, risks: { type: "array", items: assessmentDraftRiskWireSchema(context) } });
}
export function riskRewriteWireSchema(context: AssessmentContext): Record<string, unknown> {
  return wireObject({ schemaVersion: versionSchema, risk: assessmentDraftRiskWireSchema(context) });
}
