import type { AiRunDecisionEventV1 } from "../../csrm-ai-run/services/ai-run-record";
import {
  ControlImplementationWorkflowError,
  controlImplementationIdsForRisk,
  controlImplementationWritableSnapshot,
  createControlImplementationWithinMutation,
  findControlImplementationForSnapshot,
  implementedControlIdsForRisk,
  removeControlImplementationWithinMutation,
  type ControlImplementationWorkflowStrapi,
} from "../../csrm-control-implementation/services/control-implementation-workflow";
import { ASSESSMENT_AI_FIELDS, RISK_AI_FIELDS, fieldEventsByRun, parseAssessmentAiProvenance, parseRiskAiProvenance, proposedFieldsOf, reconcileSuggestion, type AiFieldFact, type AiSuggestionFact, type AssessmentAiProvenanceV1, type RiskAiProvenanceV1 } from "./ai-provenance";
import { AssessmentWorkflowError, appendAiRunDecisionsWithinMutation, withMutableAssessmentMutation } from "./assessment-workflow";
import { assertRiskActive, type HistorySource } from "../../csrm-risk/services/risk-workflow";
import {
  applyRiskProposalDecisions,
  loadRiskProposalDecisionRuns,
  RISK_PROPOSAL_REASON_MAX_LENGTH,
  type RiskProposalDecision,
  type RiskProposalDecisionAction,
} from "../../../csrm/ai/risk-proposals/risk-proposal-decisions";

type Row = Record<string, unknown>;
type Target = { kind: "assessment" } | { kind: "risk"; riskId: string };
/** Phase 12's entries: a field or suggested-control decision on the assessment or one Risk. */
type FieldDecision = { target: Target; action: "accept" | "dismiss" | "restore"; fields?: string[]; suggestion?: string };
/** Phase 16 D-39: a run-scoped decision on one risk AI proposal item. */
type ProposalDecision = { target: { kind: "proposal"; runId: string; item: string }; action: RiskProposalDecisionAction; reason?: string };
type Decision = FieldDecision | ProposalDecision;
type Envelope = AssessmentAiProvenanceV1 | RiskAiProvenanceV1;
type Documents = {
  findOne: (query: Row) => Promise<Row | null>;
  findMany: (query: Row) => Promise<Row[]>;
  update: (query: { documentId: string; data: Row }) => Promise<Row>;
};
type DecisionStrapi = Parameters<typeof withMutableAssessmentMutation>[0]["strapi"] & { documents: (uid: string) => Documents };

export const AI_PROPOSAL_DECISION_BATCH_MAX = 200;
export const PLANNED_CONTROL_STATUS = "Planned";
const DECISION_ACTIONS: readonly FieldDecision["action"][] = ["accept", "dismiss", "restore"];
const PROPOSAL_ACTIONS: readonly RiskProposalDecisionAction[] = ["accept", "reject", "restore"];
/* A suggestion item `s-1` to `s-8`, or a change unit `u-…`; an item the run does not hold is refused once the run is read. */
const PROPOSAL_ITEM = /^(s-[1-8]|u-[a-z-]{3,40})$/;
const TARGET_KINDS: readonly Target["kind"][] = ["assessment", "risk"];
const record = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const exact = (value: Row, allowed: readonly string[]) => Object.keys(value).every((key) => allowed.includes(key));
const id = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0 && value.length <= 255;
/* WR-106: a closed string enumeration, read as given and never coerced: String(["accept"]) is "accept", ["accept"] is not. */
const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): value is T => typeof value === "string" && (allowed as readonly string[]).includes(value);
const invalid = (): never => { throw new AssessmentWorkflowError(400, "Proposal decision data is invalid."); };
const alreadyDecided = (): never => { throw new AssessmentWorkflowError(409, "Proposal field was already decided.", "AI_PROPOSAL_ALREADY_DECIDED"); };

/*
 * Phase 16 D-39: the run-scoped entry, closed per target kind. `reject` and `reason` belong to it alone, and `dismiss`
 * stays with Phase 12's suggested controls, so neither verb leaks across. A reason is trimmed, 1 to 500 characters,
 * and only on a rejection.
 */
function parseProposalDecision(raw: Row): ProposalDecision {
  const target = raw.target;
  if (!exact(raw, ["target", "action", "reason"]) || !record(target) || !exact(target, ["kind", "runId", "item"])) return invalid();
  if (!id(target.runId) || typeof target.item !== "string" || !PROPOSAL_ITEM.test(target.item) || !oneOf(raw.action, PROPOSAL_ACTIONS)) return invalid();
  let reason: string | undefined;
  if (raw.reason !== undefined) {
    if (raw.action !== "reject" || typeof raw.reason !== "string") return invalid();
    reason = raw.reason.trim();
    if (reason.length < 1 || reason.length > RISK_PROPOSAL_REASON_MAX_LENGTH) return invalid();
  }
  return { target: { kind: "proposal", runId: target.runId, item: target.item }, action: raw.action, ...(reason === undefined ? {} : { reason }) };
}

const isProposalDecision = (decision: Decision): decision is ProposalDecision => decision.target.kind === "proposal";

export function parseAiProposalDecisionBatch(body: unknown): Decision[] {
  if (!record(body) || !exact(body, ["decisions"]) || !Array.isArray(body.decisions)
    || body.decisions.length < 1 || body.decisions.length > AI_PROPOSAL_DECISION_BATCH_MAX) return invalid();
  return body.decisions.map((raw: unknown): Decision => {
    if (record(raw) && record(raw.target) && raw.target.kind === "proposal") return parseProposalDecision(raw);
    if (!record(raw) || !exact(raw, ["target", "action", "fields", "suggestion"]) || !record(raw.target)) return invalid();
    const action = raw.action;
    const target = raw.target;
    if (!oneOf(action, DECISION_ACTIONS) || !oneOf(target.kind, TARGET_KINDS)) return invalid();
    if (!((target.kind === "assessment" && exact(target, ["kind"]))
      || (target.kind === "risk" && exact(target, ["kind", "riskId"]) && id(target.riskId)))) return invalid();
    const fields = raw.fields;
    if (raw.suggestion !== undefined) {
      if (!id(raw.suggestion) || fields !== undefined || target.kind !== "risk") return invalid();
    } else if (fields !== undefined && (!Array.isArray(fields) || fields.length < 1 || fields.length > 20
      || new Set(fields).size !== fields.length || !fields.every((field) => typeof field === "string"
        && (target.kind === "assessment" ? ASSESSMENT_AI_FIELDS : RISK_AI_FIELDS).includes(field as never)))) return invalid();
    /*
     * A dismissal names its suggestion. WR-102: a field restore names the fields it restores, as the editor's Undo does;
     * only an accept may leave them out ("Confirm remaining", the fields still proposed).
     */
    if (raw.suggestion === undefined && (action === "dismiss" || (action === "restore" && fields === undefined))) return invalid();
    return { target: target as Target, action, ...(fields === undefined ? {} : { fields }),
      ...(raw.suggestion === undefined ? {} : { suggestion: raw.suggestion as string }) };
  });
}

export function applyFieldDecision(fact: AiFieldFact, action: FieldDecision["action"], by: string, at: string): AiFieldFact | null {
  if (action === "dismiss") invalid();
  if (fact.state === "edited") alreadyDecided();
  if (action === "accept" && fact.state === "proposed") return { ...fact, state: "accepted", by, at };
  if (action === "restore" && fact.state === "accepted") return { ...fact, state: "proposed", by, at };
  return null;
}

/*
 * The suggestion state table (12-13, D-12, UI-D12). `present` means the suggested control is already a mitigation
 * control on the risk, which the analyst sees as "present" (12-09). Accepting a proposed suggestion and restoring
 * an added one change the risk's content (an implementation is created or removed); a dismissal and its restore
 * change only the review record. Null means the decision is already in effect.
 */
export type SuggestionStep = { state: AiSuggestionFact["state"]; effect: "create" | "remove" | null };
export function applySuggestionDecision(item: Pick<AiSuggestionFact, "state">, action: FieldDecision["action"], present: boolean): SuggestionStep | null {
  if (action === "accept") {
    if (item.state === "dismissed") return alreadyDecided();
    return item.state === "proposed" && !present ? { state: "added", effect: "create" } : null;
  }
  if (action === "dismiss") {
    if (item.state === "added") return alreadyDecided();
    return item.state === "proposed" ? { state: "dismissed", effect: null } : null;
  }
  if (item.state === "dismissed") return { state: "proposed", effect: null };
  return item.state === "added" ? { state: "proposed", effect: "remove" } : null;
}

export function riskHasPlannedControl(implementations: readonly unknown[]): boolean {
  return implementations.some((item) => record(item) && item.controlStatus === PLANNED_CONTROL_STATUS);
}

function sameSnapshot(stored: unknown, current: Row): boolean {
  if (!record(stored)) return false;
  return [...new Set([...Object.keys(stored), ...Object.keys(current)])].every((key) => (stored[key] ?? null) === (current[key] ?? null));
}

/* The control-implementation helpers raise their own error type; the decision operation answers in its own. */
async function asDecisionError<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    if (error instanceof ControlImplementationWorkflowError) throw new AssessmentWorkflowError(error.status, error.message);
    throw error;
  }
}

/* The history source of a control a suggestion adds: the run that suggested it, and the suggestion as its item (D-19). */
const PROPOSAL_ITEM_MAX_LENGTH = 64;
function suggestionSource(runId: string, key: string): HistorySource {
  return { kind: "ai-run", runDocumentId: runId, ...(key.length <= PROPOSAL_ITEM_MAX_LENGTH ? { proposalItem: key } : {}) };
}

function eventKind(action: FieldDecision["action"]): AiRunDecisionEventV1["kind"] {
  return action === "accept" ? "accepted" : action === "dismiss" ? "dismissed" : "restored";
}

type Counts = { applied: number; unchanged: number; contentChanged: boolean };

/*
 * Phase 16 (G-1; Phase 15 D-32): an analyst who raised the request takes no decision on its risk AI proposals. Checked
 * before the mutation, read only, for a batch that names a proposal; Phase 12's field decisions are unchanged.
 */
async function refuseRequestingAnalyst(strapi: DecisionStrapi, assessmentDocumentId: string, analystDocumentId: string): Promise<void> {
  const assessment = await strapi.documents("api::csrm-assessment.csrm-assessment").findOne({
    documentId: assessmentDocumentId,
    populate: { assessmentRequest: { populate: { requestor: { fields: ["documentId"] } } } },
  });
  const request = assessment && record(assessment.assessmentRequest) ? assessment.assessmentRequest : null;
  const requestor = request && record(request.requestor) ? request.requestor.documentId : null;
  if (requestor === analystDocumentId) {
    throw new AssessmentWorkflowError(403, "CSRM risk AI proposals are denied on a request you raised.", "OWN_REQUEST");
  }
}

export async function decideAiProposals(input: {
  strapi: DecisionStrapi;
  assessmentDocumentId: string;
  analystDocumentId: string;
  /** Verifier W-3 (W4): the policy's human Security Analyst fact (`ctx.state.csrmAuthorization.humanAnalyst`). */
  humanAnalyst?: boolean;
  body: unknown;
}): Promise<{ applied: number; unchanged: number }> {
  const decisions = parseAiProposalDecisionBatch(input.body);
  const fieldDecisions = decisions.filter((decision): decision is FieldDecision => !isProposalDecision(decision));
  const proposalDecisions: RiskProposalDecision[] = decisions.filter(isProposalDecision).map((decision) => ({
    runId: decision.target.runId, item: decision.target.item, action: decision.action, ...(decision.reason === undefined ? {} : { reason: decision.reason }),
  }));
  if (proposalDecisions.length) {
    // D-43: only a human Security Analyst decides a risk AI proposal (the route's policy already requires it).
    if (input.humanAnalyst !== true) throw new AssessmentWorkflowError(403, "CSRM AI assistance requires a human Security Analyst.");
    await refuseRequestingAnalyst(input.strapi, input.assessmentDocumentId, input.analystDocumentId);
  }
  const outcome = await withMutableAssessmentMutation<Counts>({
    strapi: input.strapi,
    assessmentDocumentId: input.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    /* Phase 16 D-23: only a change to the assessment's content records or withdraws a review. */
    transition: (result) => result.contentChanged ? "accepted-edit" : "none",
    mutate: async ({ assessment }) => {
      const strapi = input.strapi as unknown as Parameters<typeof loadRiskProposalDecisionRuns>[0];
      /*
       * D-39 (T-16-28): every named run is read first: one that is missing, not completed, not a risk proposal run or of
       * another assessment refuses the whole batch with 404; an unknown item is a 400. Phase 12's entries then apply as
       * before, and the run-scoped decisions after them, in the order sent, against the Risks as those left them.
       */
      const runs = proposalDecisions.length ? await loadRiskProposalDecisionRuns(strapi, input.assessmentDocumentId, proposalDecisions) : null;
      const fields = fieldDecisions.length ? await applyFieldDecisions(input, assessment, fieldDecisions) : { applied: 0, unchanged: 0, contentChanged: false };
      const proposals = runs ? await applyRiskProposalDecisions({
        strapi, assessment, analystDocumentId: input.analystDocumentId, humanAnalyst: input.humanAnalyst === true, runs, decisions: proposalDecisions,
      }) : { applied: 0, unchanged: 0, contentChanged: false };
      return {
        applied: fields.applied + proposals.applied,
        unchanged: fields.unchanged + proposals.unchanged,
        contentChanged: fields.contentChanged || proposals.contentChanged,
      };
    },
  });
  return { applied: outcome.applied, unchanged: outcome.unchanged };
}

/* Phase 12's field and suggested-control decisions (12-12, 12-13), inside the caller's mutation. */
async function applyFieldDecisions(
  input: { strapi: DecisionStrapi; assessmentDocumentId: string; analystDocumentId: string },
  assessment: Row,
  decisions: readonly FieldDecision[],
): Promise<Counts> {
  const implementationStrapi = input.strapi as unknown as ControlImplementationWorkflowStrapi;
  const changed = new Map<string, { uid: string; documentId: string; envelope: Envelope }>();
  const events = new Map<string, AiRunDecisionEventV1[]>();
  const acceptCandidates = new Set<string>();
  // The envelopes this batch changed; their events may land on several runs (the code review amendment, item 1).
  const written = new Set<string>();
  let applied = 0;
  let unchanged = 0;
  let contentChanged = false;
  const riskDocuments = input.strapi.documents("api::csrm-risk.csrm-risk");
  const addEvent = (runId: string, event: AiRunDecisionEventV1) => {
    const list = events.get(runId) ?? [];
    list.push(event);
    events.set(runId, list);
  };
  /*
   * Phase 16 D-07: before any write, every Risk the batch names must be active. A withdrawn Risk refuses the whole
   * batch with RISK_WITHDRAWN; a Risk that is missing or of another assessment stays the batch's 400.
   */
  for (const riskId of new Set(decisions.flatMap((decision) => decision.target.kind === "risk" ? [decision.target.riskId] : []))) {
    const risk = await riskDocuments.findOne({ documentId: riskId, populate: { assessment: true } });
    if (!risk || !record(risk.assessment) || risk.assessment.documentId !== input.assessmentDocumentId) return invalid();
    assertRiskActive(risk);
  }
  for (const decision of decisions) {
    const riskId = decision.target.kind === "risk" ? decision.target.riskId : null;
    const key = riskId ?? "assessment";
    const uid = riskId ? "api::csrm-risk.csrm-risk" : "api::csrm-assessment.csrm-assessment";
    let entry = changed.get(key);
    if (!entry) {
      const document = riskId ? await riskDocuments.findOne({ documentId: riskId, populate: { assessment: true } }) : assessment;
      if (!document) return invalid();
      if (riskId && (!record(document.assessment) || document.assessment.documentId !== input.assessmentDocumentId)) return invalid();
      const envelope = riskId ? parseRiskAiProvenance(document.aiProvenance) : parseAssessmentAiProvenance(document.aiProvenance);
      if (!envelope) return invalid();
      entry = { uid, documentId: riskId ?? input.assessmentDocumentId, envelope };
      changed.set(key, entry);
    }
    const envelope = entry.envelope;
    const at = new Date().toISOString();

    if (decision.suggestion !== undefined) {
      if (!riskId || !("suggestions" in envelope)) return invalid();
      const index = envelope.suggestions.findIndex((item) => item.key === decision.suggestion);
      if (index < 0) return invalid();
      const recorded = envelope.suggestions[index];
      /* CR-02: an added suggestion whose planned control is gone is proposed again, as the analyst's page reads it. */
      const item = recorded.state === "added" ? reconcileSuggestion(recorded, await controlImplementationIdsForRisk(implementationStrapi, riskId)) : recorded;
      const present = decision.action === "accept" && item.state === "proposed"
        && (await implementedControlIdsForRisk(implementationStrapi, riskId)).has(item.control);
      const step = applySuggestionDecision(item, decision.action, present);
      if (!step) {
        unchanged += 1;
        continue;
      }
      const { implementation: previousImplementation, implementationSnapshot: _previousSnapshot, ...base } = item;
      let next: AiSuggestionFact = { ...base, state: step.state, by: input.analystDocumentId, at };
      let implementation: string | undefined;
      if (step.effect === "create") {
        const created = await asDecisionError(() => createControlImplementationWithinMutation(implementationStrapi, {
          riskDocumentId: riskId,
          assessmentDocumentId: input.assessmentDocumentId,
          body: { control: item.control, controlStatus: PLANNED_CONTROL_STATUS },
          actorDocumentId: input.analystDocumentId,
          source: suggestionSource(envelope.runId, item.key),
        }));
        implementation = String(created.documentId);
        const stored = await findControlImplementationForSnapshot(implementationStrapi, implementation);
        if (!stored) return invalid();
        next = { ...next, implementation, implementationSnapshot: controlImplementationWritableSnapshot(stored) };
      } else if (step.effect === "remove") {
        implementation = previousImplementation;
        const stored = implementation ? await findControlImplementationForSnapshot(implementationStrapi, implementation) : null;
        /* UI-D12: Undo removes only the implementation it added, and only while nobody has changed it. */
        if (stored && implementation) {
          if (!sameSnapshot(item.implementationSnapshot, controlImplementationWritableSnapshot(stored))) {
            throw new AssessmentWorkflowError(409, "The planned control changed after it was added.", "AI_SUGGESTION_CONTROL_CHANGED");
          }
          const removed = implementation;
          /* The Undo is the analyst's removal: the AI proposed adding the control, never removing it. */
          await asDecisionError(() => removeControlImplementationWithinMutation(implementationStrapi, {
            implementationDocumentId: removed,
            riskDocumentId: riskId,
            assessmentDocumentId: input.assessmentDocumentId,
            actorDocumentId: input.analystDocumentId,
            source: { kind: "analyst" },
          }));
        }
      }
      if (step.effect) contentChanged = true;
      const suggestions = [...envelope.suggestions];
      suggestions[index] = next;
      entry.envelope = { ...envelope, suggestions };
      addEvent(envelope.runId, { schemaVersion: 1, kind: eventKind(decision.action), at, by: input.analystDocumentId,
        target: key, item: item.key, ...(implementation ? { implementation } : {}) });
      written.add(key);
      applied += 1;
      continue;
    }

    if (decision.fields?.some((name) => !(name in envelope.fields))) invalid();
    /*
     * WR-102 (D-24: an exact repeat is a no-op): an accept without fields confirms the fields still proposed, so once
     * none is left it changes nothing, and the rest of its batch still applies.
     */
    const names = decision.fields ?? proposedFieldsOf(envelope);
    if (names.length === 0) {
      unchanged += 1;
      continue;
    }
    const fields = { ...envelope.fields } as Record<string, AiFieldFact>;
    const updated: string[] = [];
    for (const name of names) {
      const fact = fields[name];
      if (!fact) invalid();
      const next = applyFieldDecision(fact, decision.action, input.analystDocumentId, at);
      if (next) {
        fields[name] = next;
        updated.push(name);
        if (riskId && name === "treatmentAction" && decision.action === "accept") acceptCandidates.add(riskId);
      }
    }
    if (updated.length) {
      entry.envelope = { ...envelope, fields } as Envelope;
      // The code review amendment (2026-10-16, item 1): a Risk's field event goes to the run that proposed each value.
      const byRun = riskId ? fieldEventsByRun(envelope as RiskAiProvenanceV1, updated) : new Map([[envelope.runId, updated]]);
      for (const [runId, runFields] of byRun) {
        addEvent(runId, { schemaVersion: 1, kind: eventKind(decision.action), at, by: input.analystDocumentId, target: key, fields: runFields });
      }
      written.add(key);
      applied += 1;
      contentChanged = true;
    } else unchanged += 1;
  }
  /* G-14 runs after the whole batch, so a planned control just added from a suggestion counts too. */
  for (const riskId of acceptCandidates) {
    const finalFact = (changed.get(riskId)?.envelope as RiskAiProvenanceV1 | undefined)?.fields.treatmentAction;
    if (finalFact?.state !== "accepted") continue;
    const risk = await riskDocuments.findOne({ documentId: riskId, populate: { controlImplementations: true } });
    if (!risk) return invalid();
    if (risk.treatmentAction === "Accept" && riskHasPlannedControl(Array.isArray(risk.controlImplementations) ? risk.controlImplementations : [])) {
      throw new AssessmentWorkflowError(409, "A proposed Accept cannot be confirmed while the risk has a planned control.", "AI_ACCEPT_WITH_PLANNED_CONTROL");
    }
  }
  for (const [key, entry] of changed) {
    if (written.has(key)) {
      await input.strapi.documents(entry.uid).update({ documentId: entry.documentId, data: { aiProvenance: entry.envelope } });
    }
  }
  /* WR-103: a history that can't take these events refuses the whole batch, and the transaction rolls it back. */
  for (const [runId, additions] of events) await appendAiRunDecisionsWithinMutation(input.strapi, runId, additions);
  return { applied, unchanged, contentChanged };
}
