/*
 * Human decisions on risk AI proposals (Phase 16 D-23, D-25, D-33, D-36 to D-40, G-14; the approved Phase 16 amendment
 * to docs/contract-gaps/phase-12-ai-run-record-and-provenance.md, "Decisions and item states").
 *
 * Phase 12's one decision operation (`decideAiProposals`) routes its run-scoped targets `{ kind: "proposal", runId,
 * item }` here, inside the assessment's one mutation (`withMutableAssessmentMutation`): every function in this module
 * runs in the caller's locked transaction and never serialises again (16-RESEARCH Pitfall 1), so a Risk is created or
 * changed only through `createRiskWithinMutation` and `updateRiskWithinMutation`.
 *
 * An item's state is never stored: it is Phase 15's fold of the run's append-only decision events, the ones this batch
 * already decided included. A repeated decision is a no-op; a decision on an item that is no longer open (decided,
 * superseded or lapsed) is refused with AI_PROPOSAL_ALREADY_DECIDED. Each run takes one append of its new events. Any
 * refusal throws, and the caller's transaction rolls the whole batch back.
 *
 * - Add a suggestion ("Add to assessment", accept): creates the Risk with its `created` history row (source: the run
 *   and the item) and AI provenance naming the run on each field, its suggested controls as Phase 12 suggestions. It has
 *   no Undo: a wrong addition is withdrawn (D-33).
 * - Confirm a change (accept): only while the Risk still holds the unit's base (AI_PROPOSAL_STALE), through the Risk
 *   update path with an `updated` row from the run; each confirmed field's fact names the run (D-25, D-37).
 * - Reject: records the decision with its optional reason and changes nothing.
 * - Restore (Undo): a rejection returns to open; a confirmed change returns to its base values and earlier field facts
 *   only while the Risk still holds what it confirmed (AI_PROPOSAL_UNDO_UNAVAILABLE otherwise).
 * - After every decision, an AI-proposed Accept confirmed in the batch, or a confirmed residual rating under an Accept a
 *   person confirmed from an AI proposal, must pass the one Accept rule (D-38, G-14).
 *
 * Content decisions (an add, a confirm, the restore of a confirmed change) report `contentChanged`, so the caller takes
 * the accepted-edit transition once; rejections and restores of rejections take none (D-23).
 */
import { foldItemStates, nextState, type DecisionAction, type ProposalItemState } from "../proposal-items";
import { isActiveRisk } from "../../active-risk";
import { parseRunDecisionsFor, parseRunProposalFor } from "../../../api/csrm-ai-run/services/ai-run-record";
import { emptyRiskAiProvenance, markFieldsConfirmedFromRun, parseRiskAiProvenance, type AiFieldFact, type RiskAiProvenanceV1 } from "../../../api/csrm-assessment/services/ai-provenance";
import { riskHasPlannedControl } from "../../../api/csrm-assessment/services/ai-proposal-decisions";
import { AssessmentWorkflowError, appendAiRunDecisionsWithinMutation, initialRiskAiProvenance } from "../../../api/csrm-assessment/services/assessment-workflow";
import { createRiskWithinMutation, RiskWorkflowError, updateRiskWithinMutation, type RiskWorkflowStrapi } from "../../../api/csrm-risk/services/risk-workflow";
import { aiAcceptCheck, isUnitStale, normaliseRiskValues, residualRatingAfter, unitApplyValues, type AiAcceptRefusal, type ChangeUnit } from "./field-units";
import type { RiskChangeUnitItem, RiskDecisionEvent, RiskProposalItem, RiskProposalOperation, RiskSuggestionItem } from "./risk-proposal-envelope";

type Row = Record<string, unknown>;

/** A rejection's optional reason, after trimming: 1 to 500 characters (the amendment's bound). */
export const RISK_PROPOSAL_REASON_MAX_LENGTH = 500;

export type RiskProposalDecisionAction = "accept" | "reject" | "restore";
/** One parsed run-scoped decision, in the order the batch sent it. */
export type RiskProposalDecision = { runId: string; item: string; action: RiskProposalDecisionAction; reason?: string };
export type RiskProposalDecisionOutcome = { applied: number; unchanged: number; contentChanged: boolean };

/** A named run as the decisions read it: its items by key and its events, the ones this batch adds appended in order. */
export type RiskProposalDecisionRun = {
  runId: string;
  operation: RiskProposalOperation;
  items: ReadonlyMap<string, RiskProposalItem>;
  events: RiskDecisionEvent[];
  additions: RiskDecisionEvent[];
};

const RUN_UID = "api::csrm-ai-run.csrm-ai-run";
const RISK_UID = "api::csrm-risk.csrm-risk";
const RISK_TYPE_UID = "api::csrm-risk-type.csrm-risk-type";
const OPERATIONS: readonly RiskProposalOperation[] = ["risk-suggestions", "risk-rewrite"];
const RUN_NOT_FOUND = "CSRM AI proposal run was not found.";
const INVALID = "Proposal decision data is invalid.";

const record = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const relationId = (value: unknown): string | null => typeof value === "string" ? value : record(value) && typeof value.documentId === "string" ? value.documentId : null;

const EVENT_ACTION: Readonly<Record<RiskProposalDecisionAction, DecisionAction>> = { accept: "accepted", reject: "rejected", restore: "restored" };

type DecisionRefusal = "AI_PROPOSAL_ALREADY_DECIDED" | "AI_PROPOSAL_STALE" | "AI_PROPOSAL_UNDO_UNAVAILABLE" | "AI_RUN_RECORD_UNAVAILABLE" | "AI_ACCEPT_NOT_PERMITTED" | "AI_ACCEPT_WITH_PLANNED_CONTROL";
const ACCEPT_REFUSALS: Readonly<Record<AiAcceptRefusal, { reason: DecisionRefusal; message: string }>> = {
  "accept-not-permitted": { reason: "AI_ACCEPT_NOT_PERMITTED", message: "A proposed Accept can be confirmed only for a Low or Moderate residual rating, with a treatment plan." },
  "accept-with-planned-control": { reason: "AI_ACCEPT_WITH_PLANNED_CONTROL", message: "A proposed Accept cannot be confirmed while the risk has a planned control." },
};
const UNREADABLE_PROVENANCE = "This risk's AI review record can't be read. An administrator needs to repair it.";

function refusal(message: string, reason: DecisionRefusal): never {
  throw new AssessmentWorkflowError(409, message, reason);
}

type DecisionStrapi = RiskWorkflowStrapi;

/**
 * Every run the batch names, read inside the transaction: each must exist, be a completed `risk-suggestions` or
 * `risk-rewrite` run and belong to the path's assessment, otherwise the whole batch is 404 and no run is named
 * (T-16-28). A run whose proposal or decisions do not read takes no decision (AI_RUN_RECORD_UNAVAILABLE). An item the
 * run's proposal does not hold is a 400.
 */
export async function loadRiskProposalDecisionRuns(strapi: DecisionStrapi, assessmentDocumentId: string, decisions: readonly RiskProposalDecision[]): Promise<Map<string, RiskProposalDecisionRun>> {
  const runs = new Map<string, RiskProposalDecisionRun>();
  const documents = strapi.documents(RUN_UID);
  for (const runId of new Set(decisions.map((decision) => decision.runId))) {
    const run = await documents.findOne({ documentId: runId, fields: ["documentId", "operation", "status", "proposal", "decisions"], populate: { assessment: { fields: ["documentId"] } } });
    const operation = OPERATIONS.find((candidate) => candidate === run?.operation);
    if (!run || !operation || run.status !== "completed" || relationId(run.assessment) !== assessmentDocumentId) {
      throw new AssessmentWorkflowError(404, RUN_NOT_FOUND);
    }
    const proposal = parseRunProposalFor(operation, run.proposal);
    const events = parseRunDecisionsFor(operation, run.decisions);
    if (!proposal || !events || !foldItemStates(proposal.items.map(({ key }) => key), events)) {
      refusal("This AI proposal's record can't take a decision. An administrator needs to repair it.", "AI_RUN_RECORD_UNAVAILABLE");
    }
    runs.set(runId, { runId, operation, items: new Map(proposal.items.map((item) => [item.key, item])), events: [...events], additions: [] });
  }
  for (const decision of decisions) {
    if (!runs.get(decision.runId)?.items.has(decision.item)) throw new AssessmentWorkflowError(400, INVALID);
  }
  return runs;
}

function stateOf(run: RiskProposalDecisionRun, item: string): ProposalItemState {
  const states = foldItemStates([...run.items.keys()], run.events);
  const state = states?.get(item);
  if (!state) return refusal("This AI proposal's record can't take a decision. An administrator needs to repair it.", "AI_RUN_RECORD_UNAVAILABLE");
  return state;
}

function addEvent(run: RiskProposalDecisionRun, event: Omit<RiskDecisionEvent, "schemaVersion">): void {
  const stored = { schemaVersion: 2, ...event } as RiskDecisionEvent;
  run.events.push(stored);
  run.additions.push(stored);
}

/* A Risk's create and update refusals answer in the decision operation's own error type; a gone record is stale. */
async function asDecisionError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof RiskWorkflowError) {
      if (error.status === 400) refusal("The records this AI proposal names have changed.", "AI_PROPOSAL_STALE");
      throw new AssessmentWorkflowError(error.status, error.message);
    }
    throw error;
  }
}

async function riskTypeIdByName(strapi: DecisionStrapi, name: string | null): Promise<string | null> {
  if (name === null) return null;
  const [type] = await strapi.documents(RISK_TYPE_UID).findMany({ filters: { name: { $eq: name } }, fields: ["documentId"], limit: 1 });
  const documentId = relationId(type);
  return documentId ?? refusal("The records this AI proposal names have changed.", "AI_PROPOSAL_STALE");
}

/* "Add to assessment" (D-33): the proposed Risk through the create path, then its AI provenance naming the run. */
async function addSuggestedRisk(input: ApplyInput, run: RiskProposalDecisionRun, item: RiskSuggestionItem): Promise<string> {
  const proposed = item.proposed;
  const created = await asDecisionError(async () => createRiskWithinMutation({
    strapi: input.strapi,
    assessment: input.assessment,
    actorDocumentId: input.analystDocumentId,
    source: { kind: "ai-run", runDocumentId: run.runId, proposalItem: item.key },
    fields: {
      riskType: await riskTypeIdByName(input.strapi, proposed.riskTypeName),
      issueStatement: proposed.issueStatement,
      riskStatement: proposed.riskStatement,
      riskCategory: proposed.riskCategory,
      riskSubCategory: proposed.riskSubCategory,
      riskCause: proposed.riskCause,
      potentialImpact: proposed.potentialImpact,
      informationSystemImpacted: proposed.informationSystem,
      informationAssetImpacted: proposed.informationAsset,
      dataClassification: proposed.dataClassification,
      inherentLikelihood: proposed.inherentLikelihood,
      highestInherentConsequence: proposed.highestInherentConsequence,
      inherentRating: proposed.inherentRating,
      inherentRatingRationale: proposed.inherentRatingRationale,
      residualLikelihood: proposed.residualLikelihood,
      highestResidualConsequence: proposed.highestResidualConsequence,
      residualRating: proposed.residualRating,
      residualRatingRationale: proposed.residualRatingRationale,
      treatmentAction: proposed.treatmentAction,
      treatmentPlan: proposed.treatmentPlan,
      // As a drafted Risk starts (Phase 12's draft persistence).
      treatmentStatus: "Not Started",
    },
  }));
  const riskDocumentId = relationId(created);
  if (!riskDocumentId) return refusal("This AI proposal's record can't take a decision. An administrator needs to repair it.", "AI_RUN_RECORD_UNAVAILABLE");
  await input.strapi.documents(RISK_UID).update({
    documentId: riskDocumentId,
    data: { aiProvenance: initialRiskAiProvenance(proposed, run.runId, { fieldRunIds: true, proposalKey: item.key }) },
  });
  return riskDocumentId;
}

async function loadRisk(strapi: DecisionStrapi, riskDocumentId: string): Promise<Row | null> {
  return strapi.documents(RISK_UID).findOne({
    documentId: riskDocumentId,
    populate: { assessment: { fields: ["documentId"] }, riskType: true, informationSystemImpacted: true, informationAssetImpacted: true, controlImplementations: true },
  });
}

/* A change decides only on an active Risk of this assessment (D-07). */
async function activeRiskOf(input: ApplyInput, unit: RiskChangeUnitItem): Promise<Row> {
  const risk = await loadRisk(input.strapi, unit.riskDocumentId);
  if (!risk || relationId(risk.assessment) !== relationId(input.assessment)) {
    return refusal("The risk this AI proposal changes is no longer in this assessment.", "AI_PROPOSAL_STALE");
  }
  if (!isActiveRisk(risk)) throw new AssessmentWorkflowError(409, "CSRM Risk has been withdrawn.", "RISK_WITHDRAWN");
  return risk;
}

/* The Risk's stored AI provenance: null when it has none (created by hand); one that does not parse takes no AI change. */
function storedProvenance(risk: Row): RiskAiProvenanceV1 | null {
  if (risk.aiProvenance === null || risk.aiProvenance === undefined) return null;
  return parseRiskAiProvenance(risk.aiProvenance) ?? refusal(UNREADABLE_PROVENANCE, "AI_RUN_RECORD_UNAVAILABLE");
}

/*
 * "Confirm" (D-25, D-37): only while the Risk still holds the unit's base, through the Risk update path with its
 * `updated` row from the run; each unit field's fact is then `accepted`, by the analyst, naming the run. The event's
 * `before` keeps the values and facts an Undo restores.
 */
async function confirmChange(input: ApplyInput, run: RiskProposalDecisionRun, unit: RiskChangeUnitItem, risk: Row, at: string): Promise<void> {
  const change = unit as unknown as ChangeUnit;
  if (isUnitStale(change, risk)) refusal("The risk has changed since the AI proposed this, so it can only be rejected.", "AI_PROPOSAL_STALE");
  const provenance = storedProvenance(risk);
  const fieldFacts: Record<string, AiFieldFact | null> = Object.fromEntries(unit.fields.map((field) => [field, (provenance?.fields as Record<string, AiFieldFact | undefined> | undefined)?.[field] ?? null]));
  await asDecisionError(() => updateRiskWithinMutation({
    strapi: input.strapi,
    assessment: input.assessment,
    actorDocumentId: input.analystDocumentId,
    source: { kind: "ai-run", runDocumentId: run.runId, proposalItem: unit.key },
    riskDocumentId: unit.riskDocumentId,
    fields: unitApplyValues(change),
    humanAnalyst: input.humanAnalyst,
  }));
  const confirmed = markFieldsConfirmedFromRun(provenance ?? emptyRiskAiProvenance(run.runId, unit.key), unit.fields, run.runId, input.analystDocumentId, at, { sources: unit.sources ?? [] });
  await input.strapi.documents(RISK_UID).update({ documentId: unit.riskDocumentId, data: { aiProvenance: confirmed } });
  addEvent(run, {
    at, by: input.analystDocumentId, item: unit.key, action: "accepted",
    before: { riskDocumentId: unit.riskDocumentId, values: unit.base, fieldFacts },
    applied: { riskDocumentId: unit.riskDocumentId, values: unit.proposed },
  });
}

/*
 * Undo of a confirmed change (D-39): only while the Risk still holds exactly what the confirmation wrote, it writes the
 * base values back (an `updated` row marked `undo`) and returns each field's fact to what it was before.
 */
async function undoConfirmedChange(input: ApplyInput, run: RiskProposalDecisionRun, unit: RiskChangeUnitItem, risk: Row, at: string): Promise<void> {
  const confirmation = [...run.events].reverse().find((event) => event.item === unit.key && event.action === "accepted");
  const before = confirmation?.before;
  const confirmedValues = confirmation?.applied?.values;
  const current = normaliseRiskValues(risk, unit.fields);
  if (!before || !confirmedValues || unit.fields.some((field) => current[field] !== (confirmedValues[field] ?? null))) {
    refusal("The risk has changed since this was confirmed, so it can't be undone.", "AI_PROPOSAL_UNDO_UNAVAILABLE");
  }
  await asDecisionError(() => updateRiskWithinMutation({
    strapi: input.strapi,
    assessment: input.assessment,
    actorDocumentId: input.analystDocumentId,
    source: { kind: "ai-run", runDocumentId: run.runId, proposalItem: unit.key },
    riskDocumentId: unit.riskDocumentId,
    fields: { ...before.values },
    humanAnalyst: input.humanAnalyst,
    undo: true,
  }));
  const provenance = storedProvenance(risk);
  if (provenance) {
    const fields = { ...provenance.fields } as Record<string, AiFieldFact | undefined>;
    for (const field of unit.fields) {
      const fact = before.fieldFacts[field];
      if (fact) fields[field] = { ...fact };
      else delete fields[field];
    }
    await input.strapi.documents(RISK_UID).update({ documentId: unit.riskDocumentId, data: { aiProvenance: { ...provenance, fields } } });
  }
  addEvent(run, { at, by: input.analystDocumentId, item: unit.key, action: "restored", applied: { riskDocumentId: unit.riskDocumentId, values: before.values } });
}

const RESIDUAL_FIELDS: readonly string[] = ["residualLikelihood", "highestResidualConsequence", "residualRating"];

/*
 * D-38 and G-14, after every decision of the batch, against each Risk as the batch leaves it (so either order inside a
 * batch, and an earlier batch's values, count): a confirmed AI-proposed Accept must have a Low or Moderate residual
 * rating and a plan, and no planned control; and a confirmed residual change may not leave a High or Critical rating
 * under an Accept a person confirmed from an AI proposal (16-RESEARCH Pitfall 11).
 */
async function assertAcceptRule(input: ApplyInput, confirmed: ReadonlyMap<string, { aiAccept: boolean; residual: boolean }>): Promise<void> {
  for (const [riskDocumentId, units] of confirmed) {
    const risk = await loadRisk(input.strapi, riskDocumentId);
    if (!risk || risk.treatmentAction !== "Accept") continue;
    const residualRating = residualRatingAfter(risk, []);
    let refused: AiAcceptRefusal | null = null;
    if (units.aiAccept) {
      refused = aiAcceptCheck({ residualRating, plan: risk.treatmentPlan, hasPlannedControl: riskHasPlannedControl(Array.isArray(risk.controlImplementations) ? risk.controlImplementations : []) });
    } else if (units.residual && storedProvenance(risk)?.fields.treatmentAction?.state === "accepted") {
      refused = aiAcceptCheck({ residualRating, plan: risk.treatmentPlan, hasPlannedControl: false });
    }
    if (refused) refusal(ACCEPT_REFUSALS[refused].message, ACCEPT_REFUSALS[refused].reason);
  }
}

type ApplyInput = {
  strapi: DecisionStrapi;
  /** The assessment the mutation loaded and locked. */
  assessment: Row;
  analystDocumentId: string;
  /** Verifier W-3: the deciding analyst holds the operation through the human Security Analyst Role. */
  humanAnalyst: boolean;
  runs: ReadonlyMap<string, RiskProposalDecisionRun>;
  decisions: readonly RiskProposalDecision[];
};

/**
 * Applies the batch's run-scoped decisions in the order sent, inside the caller's mutation, and appends each run's new
 * events once. Throws on any refusal, so the caller's transaction rolls the whole batch back.
 */
export async function applyRiskProposalDecisions(input: ApplyInput): Promise<RiskProposalDecisionOutcome> {
  let applied = 0;
  let unchanged = 0;
  let contentChanged = false;
  const confirmed = new Map<string, { aiAccept: boolean; residual: boolean }>();
  for (const decision of input.decisions) {
    const run = input.runs.get(decision.runId) as RiskProposalDecisionRun;
    const item = run.items.get(decision.item) as RiskProposalItem;
    const action = EVENT_ACTION[decision.action];
    const state = stateOf(run, item.key);
    const next = nextState(state, action, { withEdits: false });
    if (next === "no-op") {
      unchanged += 1;
      continue;
    }
    if (next === "not-open") refusal("This AI proposal was already decided.", "AI_PROPOSAL_ALREADY_DECIDED");
    const at = new Date().toISOString();
    const by = input.analystDocumentId;

    if (item.kind === "risk") {
      if (action === "accepted") {
        const riskDocumentId = await addSuggestedRisk(input, run, item);
        addEvent(run, { at, by, item: item.key, action, applied: { riskDocumentId } });
        contentChanged = true;
      } else if (action === "rejected") {
        addEvent(run, { at, by, item: item.key, action, ...(decision.reason ? { reason: decision.reason } : {}) });
      } else {
        // D-33: an added Risk is never removed by Undo; it is withdrawn instead.
        if (state === "accepted") refusal("An added risk can't be undone. Withdraw it instead.", "AI_PROPOSAL_UNDO_UNAVAILABLE");
        addEvent(run, { at, by, item: item.key, action });
      }
      applied += 1;
      continue;
    }

    const risk = await activeRiskOf(input, item);
    if (action === "rejected") {
      addEvent(run, { at, by, item: item.key, action, ...(decision.reason ? { reason: decision.reason } : {}) });
    } else if (action === "restored" && state === "rejected") {
      addEvent(run, { at, by, item: item.key, action });
    } else if (action === "accepted") {
      await confirmChange(input, run, item, risk, at);
      const units = confirmed.get(item.riskDocumentId) ?? { aiAccept: false, residual: false };
      confirmed.set(item.riskDocumentId, {
        aiAccept: units.aiAccept || item.aiAccept === true,
        residual: units.residual || item.fields.some((field) => RESIDUAL_FIELDS.includes(field)),
      });
      contentChanged = true;
    } else {
      await undoConfirmedChange(input, run, item, risk, at);
      // 16-REVIEW BE2-02 (D-38, T-16-30): an Undo that writes a residual rating back is a residual change, so the Accept rule re-checks it.
      const units = confirmed.get(item.riskDocumentId) ?? { aiAccept: false, residual: false };
      confirmed.set(item.riskDocumentId, { aiAccept: units.aiAccept, residual: units.residual || item.fields.some((field) => RESIDUAL_FIELDS.includes(field)) });
      contentChanged = true;
    }
    applied += 1;
  }
  await assertAcceptRule(input, confirmed);
  // WR-103: one append per run; a history that can't take the events refuses the whole batch.
  for (const run of input.runs.values()) {
    if (run.additions.length) await appendAiRunDecisionsWithinMutation(input.strapi, run.runId, run.additions);
  }
  return { applied, unchanged, contentChanged };
}
