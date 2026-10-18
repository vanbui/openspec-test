import { foldItemStates, type ProposalItemState } from "../proposal-items";
import { isActiveRisk } from "../../active-risk";
import type { ConflictReason } from "../../conflict-reasons";
import { resolveGenerationJobInitiators } from "../../generation-job-viewer";
import { parseRunDecisionsFor, parseRunProposalFor } from "../../../api/csrm-ai-run/services/ai-run-record";
import { RISK_AI_FIELDS, RISK_STATEMENT_FIELDS, sourceCatalogueFromContextSummary, type AiSourceCitation } from "../../../api/csrm-assessment/services/ai-provenance";
import { riskHasPlannedControl } from "../../../api/csrm-assessment/services/ai-proposal-decisions";
import { isAssessmentEditable } from "../../../api/csrm-assessment/services/assessment-workflow";
import { aiAcceptCheck, isUnitStale, normaliseRiskValues, residualRatingAfter, type AiAcceptRefusal, type ChangeUnit } from "./field-units";
import type { RiskChangeUnitItem, RiskDecisionEvent, RiskProposalItem, RiskProposalOperation, RiskSimilarity, RiskSuggestionItem } from "./risk-proposal-envelope";
import {
  projectedRiskProposalJobs,
  RISK_PROPOSAL_RUN_LIMIT,
  RiskProposalWorkflowError,
  riskProposalPolicyRefusal,
  type RiskProposalStrapi,
  type RiskProposalViewer,
} from "./risk-proposal-workflow";

/*
 * Phase 16 D-41 (D-03 item 7): an assessment's risk AI proposals as a human Security Analyst reads them. Nothing is
 * stored beyond each run's immutable proposal and its append-only decisions: every item's state is the fold of its
 * decision events (Phase 15's one proposal model), and the open count and the per-risk open counts are derived on read.
 * Open items come first, grouped by run newest first, then the 50 most recently decided items. Each item says what it
 * would add or change (relations by name), whether a change still matches the Risk (`stale`), whether a proposed
 * Accept would be refused now, what it cites (by label), how it was decided and whether its Undo is open. A requesting
 * analyst is refused (G-1). This module writes nothing.
 */

type Row = Record<string, unknown>;

const ASSESSMENT_UID = "api::csrm-assessment.csrm-assessment";
const RUN_UID = "api::csrm-ai-run.csrm-ai-run";
const RISK_UID = "api::csrm-risk.csrm-risk";
const RISK_TYPE_UID = "api::csrm-risk-type.csrm-risk-type";
const SYSTEM_UID = "api::csrm-information-system.csrm-information-system";
const ASSET_UID = "api::csrm-information-asset.csrm-information-asset";
const CONTROL_UID = "api::csrm-control.csrm-control";
const RISK_PROPOSAL_RUN_OPERATIONS: readonly RiskProposalOperation[] = ["risk-suggestions", "risk-rewrite"];
/** The decided items the read lists, most recent first (UI-D28, as Phase 15's read). */
export const DECIDED_RISK_ITEMS_LISTED = 50;
/** One more than the run cap, so a cap that was passed still reads every run the cap allowed. */
export const RISK_PROPOSAL_RUNS_READ_LIMIT = RISK_PROPOSAL_RUN_LIMIT + 1;
const NO_LONGER_AVAILABLE = "No longer available";
const RELATION_FIELDS = ["riskType", "informationSystemImpacted", "informationAssetImpacted"] as const;

const record = (value: unknown): value is Row => typeof value === "object" && value !== null && !Array.isArray(value);
const relationId = (value: unknown): string | null => typeof value === "string" ? value : record(value) && typeof value.documentId === "string" ? value.documentId : null;
const instant = (value: unknown): string | null => {
  const time = value instanceof Date ? value.getTime() : typeof value === "string" && value.length > 0 ? Date.parse(value) : Number.NaN;
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
};

/** One completed risk proposal run as the fold reads it; `states` is null for a damaged run (it then holds no open item). */
export type LoadedRiskProposalRun = {
  runId: string;
  run: Row;
  operation: RiskProposalOperation;
  items: readonly RiskProposalItem[];
  events: readonly RiskDecisionEvent[];
  states: ReadonlyMap<string, ProposalItemState> | null;
  adjustments: ReadonlyArray<{ code: string; count?: number }>;
};

/**
 * The assessment's completed risk proposal runs, newest first: one bounded Document Service read (at most 101 rows),
 * with only the fields the fold and the projection need, each parsed by its operation and folded.
 */
export async function loadRiskProposalRuns(strapi: RiskProposalStrapi, assessmentDocumentId: string): Promise<LoadedRiskProposalRun[]> {
  const stored = await strapi.documents(RUN_UID).findMany({
    filters: { assessment: { documentId: { $eq: assessmentDocumentId } }, operation: { $in: [...RISK_PROPOSAL_RUN_OPERATIONS] }, status: { $eq: "completed" } },
    fields: ["documentId", "operation", "proposal", "decisions", "startedAt", "completedAt", "providerName", "providerVersion", "instruction", "contextSummary"],
    populate: { initiatedBy: { fields: ["documentId"] }, risk: { fields: ["documentId"] } },
    sort: ["completedAt:desc", "id:desc"], limit: RISK_PROPOSAL_RUNS_READ_LIMIT,
  });
  const runs: LoadedRiskProposalRun[] = [];
  for (const run of stored) {
    const operation = RISK_PROPOSAL_RUN_OPERATIONS.find((candidate) => candidate === run.operation);
    if (!operation || typeof run.documentId !== "string") continue;
    const proposal = parseRunProposalFor(operation, run.proposal);
    const events = parseRunDecisionsFor(operation, run.decisions);
    const states = proposal && events ? foldItemStates(proposal.items.map(({ key }) => key), events) : null;
    runs.push({ runId: run.documentId, run, operation, items: proposal?.items ?? [], events: events ?? [], states, adjustments: proposal?.adjustments ?? [] });
  }
  return runs;
}

type LoggingStrapi = RiskProposalStrapi & { log?: { warn?: (message: string) => unknown } };
const loggedDamagedRuns = new Set<string>();
function logDamagedRun(strapi: LoggingStrapi, runId: string): void {
  if (loggedDamagedRuns.has(runId)) return;
  loggedDamagedRuns.add(runId);
  strapi.log?.warn?.(`csrm.risk_ai_proposals: run ${runId} has a proposal or decisions that do not read; it holds no open item.`);
}

export type OpenRiskProposalSummary = { openCount: number; openByRisk: { riskId: string; count: number }[] };

function summarise(strapi: LoggingStrapi, runs: readonly LoadedRiskProposalRun[]): OpenRiskProposalSummary {
  let openCount = 0;
  const byRisk = new Map<string, number>();
  for (const loaded of runs) {
    if (!loaded.states) {
      logDamagedRun(strapi, loaded.runId);
      continue;
    }
    for (const item of loaded.items) {
      if (loaded.states.get(item.key) !== "open") continue;
      openCount += 1;
      if (item.kind === "change") byRisk.set(item.riskDocumentId, (byRisk.get(item.riskDocumentId) ?? 0) + 1);
    }
  }
  return { openCount, openByRisk: [...byRisk].map(([riskId, count]) => ({ riskId, count })) };
}

/**
 * D-41: the assessment's open risk AI proposal items, derived from the fold, with the open changes per Risk. A damaged
 * run counts no open item and is logged once per process: this fact protects no access, so it fails open.
 */
export async function openRiskProposalSummary(strapi: RiskProposalStrapi, assessmentDocumentId: string): Promise<OpenRiskProposalSummary> {
  return summarise(strapi as LoggingStrapi, await loadRiskProposalRuns(strapi, assessmentDocumentId));
}

/* ---------------------------------------------------------------------------------------------------------------------
 * The read's lookups: one batched read per record family
 * ------------------------------------------------------------------------------------------------------------------- */

type Lookups = {
  risks: ReadonlyMap<string, Row>;
  names: ReadonlyMap<string, string>;
  controls: ReadonlyMap<string, { controlNumber: string; name: string }>;
};

const RISK_READ_FIELDS = ["documentId", "riskNumber", "withdrawnAt", ...RISK_AI_FIELDS.filter((field) => !(RELATION_FIELDS as readonly string[]).includes(field))];

async function namesOf(strapi: RiskProposalStrapi, uid: string, ids: ReadonlySet<string>, field: "name"): Promise<[string, string][]> {
  if (ids.size === 0) return [];
  const rows = await strapi.documents(uid).findMany({ filters: { documentId: { $in: [...ids] } }, fields: ["documentId", field], limit: ids.size });
  return rows.filter((row) => typeof row.documentId === "string" && typeof row[field] === "string").map((row) => [row.documentId as string, row[field] as string]);
}

async function loadLookups(strapi: RiskProposalStrapi, runs: readonly LoadedRiskProposalRun[]): Promise<Lookups> {
  const riskIds = new Set<string>();
  const relationIds = { riskTypes: new Set<string>(), systems: new Set<string>(), assets: new Set<string>() };
  const controlIds = new Set<string>();
  const relation = (field: string, value: string | null | undefined) => {
    if (!value) return;
    if (field === "riskType") relationIds.riskTypes.add(value);
    if (field === "informationSystemImpacted") relationIds.systems.add(value);
    if (field === "informationAssetImpacted") relationIds.assets.add(value);
  };
  for (const loaded of runs) {
    const target = relationId(loaded.run.risk);
    if (target) riskIds.add(target);
    for (const item of loaded.items) {
      if (item.kind === "change") {
        riskIds.add(item.riskDocumentId);
        for (const field of item.fields) { relation(field, item.base[field]); relation(field, item.proposed[field]); }
      } else {
        relation("informationSystemImpacted", item.proposed.informationSystem);
        relation("informationAssetImpacted", item.proposed.informationAsset);
        for (const suggestion of item.proposed.suggestedControls) controlIds.add(suggestion.control);
        if (item.similarTo && "riskDocumentId" in item.similarTo) riskIds.add(item.similarTo.riskDocumentId);
      }
    }
    for (const event of loaded.events) if (event.action === "accepted" && event.applied?.riskDocumentId) riskIds.add(event.applied.riskDocumentId);
  }
  /*
   * The Risks the items name, by documentId, withdrawn ones included: a similar or added Risk may since have been
   * withdrawn, and a change on a withdrawn Risk is closed. Each row keeps its withdrawal fact, and a change reads as
   * current only against an active Risk (isActiveRisk below), so no withdrawn Risk counts as a live target.
   */
  const riskRows = riskIds.size
    ? await strapi.documents(RISK_UID).findMany({
      filters: { documentId: { $in: [...riskIds] } },
      fields: RISK_READ_FIELDS,
      populate: { riskType: { fields: ["documentId", "name"] }, informationSystemImpacted: { fields: ["documentId", "name"] }, informationAssetImpacted: { fields: ["documentId", "name"] }, controlImplementations: { fields: ["controlStatus"] } },
      limit: riskIds.size,
    })
    : [];
  const risks = new Map(riskRows.filter((row) => typeof row.documentId === "string").map((row) => [row.documentId as string, { ...row, active: isActiveRisk(row) }]));
  for (const row of riskRows) for (const field of RELATION_FIELDS) relation(field, relationId(row[field]));
  const names = new Map<string, string>([
    ...await namesOf(strapi, RISK_TYPE_UID, relationIds.riskTypes, "name"),
    ...await namesOf(strapi, SYSTEM_UID, relationIds.systems, "name"),
    ...await namesOf(strapi, ASSET_UID, relationIds.assets, "name"),
  ]);
  const controlRows = controlIds.size
    ? await strapi.documents(CONTROL_UID).findMany({ filters: { documentId: { $in: [...controlIds] } }, fields: ["documentId", "controlNumber", "name"], limit: controlIds.size })
    : [];
  const controls = new Map(controlRows
    .filter((row) => typeof row.documentId === "string" && typeof row.controlNumber === "string" && typeof row.name === "string")
    .map((row) => [row.documentId as string, { controlNumber: row.controlNumber as string, name: row.name as string }]));
  return { risks, names, controls };
}

/* ---------------------------------------------------------------------------------------------------------------------
 * Projection
 * ------------------------------------------------------------------------------------------------------------------- */

type DisplayValues = Record<string, string | null>;

/* A value as the analyst reads it: a relation by its record's name (or that it is gone), anything else as stored. */
function display(field: string, value: string | null | undefined, lookups: Lookups): string | null {
  if (value === null || value === undefined) return null;
  if ((RELATION_FIELDS as readonly string[]).includes(field)) return lookups.names.get(value) ?? NO_LONGER_AVAILABLE;
  return value;
}

function riskValues(risk: Row, fields: readonly string[], lookups: Lookups): DisplayValues {
  return Object.fromEntries(fields.map((field) => {
    if ((RELATION_FIELDS as readonly string[]).includes(field)) return [field, display(field, relationId(risk[field]), lookups)];
    const value = risk[field];
    return [field, typeof value === "string" && value.trim().length > 0 ? value : null];
  }));
}

/* A suggestion's proposed Risk as the twenty AI-writable fields, its Risk Type by name and its system and asset by name. */
function suggestionValues(item: RiskSuggestionItem, lookups: Lookups): DisplayValues {
  const proposed = item.proposed;
  return {
    riskType: proposed.riskTypeName,
    issueStatement: proposed.issueStatement,
    riskStatement: proposed.riskStatement,
    riskCategory: proposed.riskCategory,
    riskSubCategory: proposed.riskSubCategory,
    riskCause: proposed.riskCause,
    potentialImpact: proposed.potentialImpact,
    informationSystemImpacted: display("informationSystemImpacted", proposed.informationSystem, lookups),
    informationAssetImpacted: display("informationAssetImpacted", proposed.informationAsset, lookups),
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
  };
}

function similarity(similarTo: RiskSimilarity | null, lookups: Lookups): Row | null {
  if (!similarTo) return null;
  if ("riskDocumentId" in similarTo) {
    const risk = lookups.risks.get(similarTo.riskDocumentId);
    return { kind: similarTo.kind, riskId: similarTo.riskDocumentId, riskNumber: risk && typeof risk.riskNumber === "string" ? risk.riskNumber : null, runId: null, itemKey: null, score: similarTo.score };
  }
  return { kind: similarTo.kind, riskId: null, riskNumber: null, runId: similarTo.runId, itemKey: similarTo.itemKey, score: similarTo.score };
}

function citations(keys: readonly string[], catalogue: ReadonlyMap<string, AiSourceCitation>): AiSourceCitation[] {
  return keys.map((key) => catalogue.get(key) ?? {
    key,
    kind: key.startsWith("answer.") ? "answer" : key.startsWith("system-") ? "system" : key.startsWith("asset-") ? "asset" : "request",
    label: "Source no longer available",
    section: null,
    classification: null,
  });
}

type Person = { documentId: string; displayName: string } | null;

type ItemContext = {
  loaded: LoadedRiskProposalRun;
  lookups: Lookups;
  catalogue: ReadonlyMap<string, AiSourceCitation>;
  editable: boolean;
  person: (documentId: string | null) => Person;
};

function projectItem(item: RiskProposalItem, context: ItemContext): Row {
  const { loaded, lookups, editable, person } = context;
  const state = (loaded.states as ReadonlyMap<string, ProposalItemState>).get(item.key) as ProposalItemState;
  const itemEvents = loaded.events.filter((event) => event.item === item.key);
  const last = itemEvents.at(-1) ?? null;
  const accepted = [...itemEvents].reverse().find((event) => event.action === "accepted");
  const decision = state === "open" || !last ? null : {
    action: last.action,
    by: last.by === "system" ? null : person(last.by),
    at: last.at,
    reason: last.reason ?? null,
    cause: last.cause ? {
      kind: last.cause.kind,
      runId: last.cause.kind === "newer-rewrite" ? last.cause.runId : null,
      riskId: last.cause.kind === "risk-withdrawn" ? last.cause.riskDocumentId : null,
    } : null,
  };
  // Phase 16 (16-01, 16-10): a rejection is undone while the guard allows it; an added Risk never is (D-33).
  const canUndo = state === "rejected" && editable;
  if (item.kind === "risk") {
    const added = state === "accepted" && accepted?.applied ? lookups.risks.get(accepted.applied.riskDocumentId) : undefined;
    const proposed = item.proposed;
    const aiAccept = proposed.treatmentAction === "Accept";
    const acceptBlocked: AiAcceptRefusal | null = aiAccept ? aiAcceptCheck({ residualRating: proposed.residualRating, plan: proposed.treatmentPlan, hasPlannedControl: false }) : null;
    return {
      runId: loaded.runId,
      itemKey: item.key,
      kind: item.kind,
      state,
      stale: null,
      riskId: null,
      unitKey: null,
      fields: [...RISK_AI_FIELDS],
      current: null,
      proposed: suggestionValues(item, lookups),
      similarTo: similarity(item.similarTo, lookups),
      aiAccept,
      acceptBlocked,
      sources: citations([...new Set(RISK_STATEMENT_FIELDS.flatMap((field) => proposed.sources[field] ?? []))], context.catalogue),
      uncited: [...proposed.uncitedClaims],
      suggestedControls: proposed.suggestedControls.map((suggestion) => ({
        controlNumber: lookups.controls.get(suggestion.control)?.controlNumber ?? suggestion.controlNumber,
        name: lookups.controls.get(suggestion.control)?.name ?? suggestion.controlNumber,
        rationale: suggestion.rationale,
      })),
      decision,
      addedRisk: state === "accepted" && accepted?.applied ? { riskId: accepted.applied.riskDocumentId, riskNumber: added && typeof added.riskNumber === "string" ? added.riskNumber : null } : null,
      canUndo,
    };
  }
  const unit = item as RiskChangeUnitItem;
  const change = unit as unknown as ChangeUnit;
  const risk = lookups.risks.get(unit.riskDocumentId);
  // A change reads against the Risk as it is now, and only an active Risk is a live target (D-13, D-37).
  const live = risk !== undefined && risk.active === true;
  // 16-10 (D-39): a confirmed change is undone only while its active Risk still holds exactly what the confirmation wrote.
  const confirmedValues = state === "accepted" ? accepted?.applied?.values : undefined;
  const current = live && confirmedValues ? normaliseRiskValues(risk, unit.fields) : null;
  // A rejected change's Undo restores it onto its Risk, which the decision refuses while the Risk is withdrawn (BE2-07).
  const canUndoChange = (canUndo && live) || (editable && current !== null && confirmedValues !== undefined
    && unit.fields.every((field) => current[field] === (confirmedValues[field] ?? null)));
  const acceptBlocked: AiAcceptRefusal | null = unit.aiAccept && live
    ? aiAcceptCheck({ residualRating: residualRatingAfter(risk, [change]), plan: unit.proposed.treatmentPlan, hasPlannedControl: riskHasPlannedControl(Array.isArray(risk.controlImplementations) ? risk.controlImplementations : []) })
    : null;
  return {
    runId: loaded.runId,
    itemKey: unit.key,
    kind: unit.kind,
    state,
    stale: state === "open" ? !live || isUnitStale(change, risk) : null,
    riskId: unit.riskDocumentId,
    unitKey: unit.key,
    fields: [...unit.fields],
    current: risk ? riskValues(risk, unit.fields, lookups) : null,
    proposed: Object.fromEntries(unit.fields.map((field) => [field, display(field, unit.proposed[field], lookups)])),
    similarTo: null,
    aiAccept: unit.aiAccept === true,
    acceptBlocked,
    sources: citations(unit.sources ?? [], context.catalogue),
    uncited: [...(unit.uncited ?? [])],
    suggestedControls: [],
    decision,
    addedRisk: null,
    canUndo: canUndoChange,
  };
}

function focusOf(run: Row): string[] | null {
  const summary = record(run.contextSummary) && record(run.contextSummary.riskProposals) ? run.contextSummary.riskProposals : null;
  return summary && Array.isArray(summary.focus) ? summary.focus.filter((part): part is string => typeof part === "string") : null;
}

const action = (reason: ConflictReason | null) => ({ allowed: reason === null, reason });

/**
 * The proposals read (D-41). Refusals: no human analyst fact (403), an unknown assessment (404), a requesting analyst
 * (403 OWN_REQUEST). The actions say what the viewer may start or decide now: asking needs the editable guard, the run
 * cap and the AI data policy; deciding needs only the guard.
 */
export async function readRiskAiProposals(input: { strapi: RiskProposalStrapi; assessmentDocumentId: string; viewer: RiskProposalViewer }): Promise<Row> {
  const { strapi, assessmentDocumentId, viewer } = input;
  if (!record(viewer) || viewer.humanAnalyst !== true || typeof viewer.documentId !== "string" || viewer.documentId.trim().length === 0) {
    throw new RiskProposalWorkflowError(403, "CSRM risk AI proposals are denied.");
  }
  const assessment = typeof assessmentDocumentId === "string" && assessmentDocumentId.length > 0 && assessmentDocumentId.length <= 255
    ? await strapi.documents(ASSESSMENT_UID).findOne({ documentId: assessmentDocumentId, populate: { assessmentRequest: { populate: { requestor: { fields: ["documentId"] } } }, approvedBy: { fields: ["documentId"] } } })
    : null;
  const request = assessment && record(assessment.assessmentRequest) ? assessment.assessmentRequest : null;
  const requestId = request ? relationId(request) : null;
  if (!assessment || !request || !requestId) throw new RiskProposalWorkflowError(404, "CSRM assessment was not found.");
  if (relationId(request.requestor) === viewer.documentId) {
    throw new RiskProposalWorkflowError(403, "CSRM risk AI proposals are denied on a request you raised.", "OWN_REQUEST");
  }
  const editable = isAssessmentEditable({ assessment, actor: { documentId: viewer.documentId } });
  const runs = await loadRiskProposalRuns(strapi, assessmentDocumentId);
  const lookups = await loadLookups(strapi, runs);

  const people = new Set<string>();
  for (const { run, events } of runs) {
    const initiator = relationId(run.initiatedBy);
    if (initiator) people.add(initiator);
    for (const event of events) if (event.by !== "system") people.add(event.by);
  }
  const resolved = await resolveGenerationJobInitiators(strapi, people);
  const person = (documentId: string | null): Person => {
    const found = documentId ? resolved.get(documentId) : undefined;
    return found ? { documentId: found.documentId, displayName: found.displayName } : null;
  };

  type Listed = { order: number; at: number; item: Row };
  const open: Listed[] = [];
  const decided: Listed[] = [];
  for (const [runIndex, loaded] of runs.entries()) {
    if (!loaded.states) continue;
    const catalogue = sourceCatalogueFromContextSummary(loaded.run.contextSummary);
    for (const [itemIndex, item] of loaded.items.entries()) {
      const projected = projectItem(item, { loaded, lookups, catalogue, editable, person });
      const order = runIndex * 1_000 + itemIndex;
      if (projected.state === "open") open.push({ order, at: 0, item: projected });
      else {
        const last = loaded.events.filter((event) => event.item === item.key).at(-1);
        decided.push({ order, at: last ? Date.parse(last.at) : 0, item: projected });
      }
    }
  }
  open.sort((left, right) => left.order - right.order);
  decided.sort((left, right) => right.at - left.at || left.order - right.order);

  const runFacts = runs.map((loaded) => {
    const counts = new Map<string, number>();
    for (const adjustment of loaded.adjustments) counts.set(adjustment.code, (counts.get(adjustment.code) ?? 0) + (adjustment.count ?? 1));
    return {
      runId: loaded.runId,
      operation: loaded.operation,
      initiatedBy: person(relationId(loaded.run.initiatedBy)),
      startedAt: instant(loaded.run.startedAt),
      completedAt: instant(loaded.run.completedAt),
      providerName: typeof loaded.run.providerName === "string" ? loaded.run.providerName : null,
      providerVersion: typeof loaded.run.providerVersion === "string" ? loaded.run.providerVersion : null,
      instruction: typeof loaded.run.instruction === "string" && loaded.run.instruction.length > 0 ? loaded.run.instruction : null,
      focus: focusOf(loaded.run),
      riskId: relationId(loaded.run.risk),
      outcome: loaded.items.length > 0 ? "items" : "no-change",
      counts: { items: loaded.items.length, open: loaded.states ? [...loaded.states.values()].filter((value) => value === "open").length : 0 },
      adjustments: [...counts].map(([code, count]) => ({ code, count })),
    };
  });

  const summary = summarise(strapi as LoggingStrapi, runs);
  // Each operation's context lists its own Risks, so the AI data policy is weighed per operation (BE2-05).
  const askReason = async (operation: "risk-suggestions" | "risk-rewrite"): Promise<ConflictReason | null> => !editable
    ? "ASSESSMENT_NOT_MUTABLE"
    : runs.length >= RISK_PROPOSAL_RUN_LIMIT
      ? "AI_PROPOSAL_RUN_LIMIT"
      : (await riskProposalPolicyRefusal(strapi, requestId, { assessmentId: assessmentDocumentId, operation }))?.reason ?? null;
  const suggestReason = await askReason("risk-suggestions");
  const rewriteReason = await askReason("risk-rewrite");
  return {
    assessmentId: assessmentDocumentId,
    editable,
    openCount: summary.openCount,
    openByRisk: summary.openByRisk,
    lastAskedAt: runFacts[0]?.completedAt ?? null,
    actions: {
      suggest: action(suggestReason),
      rewrite: action(rewriteReason),
      decide: action(editable ? null : "ASSESSMENT_NOT_MUTABLE"),
    },
    runs: runFacts,
    items: [...open.map(({ item }) => item), ...decided.slice(0, DECIDED_RISK_ITEMS_LISTED).map(({ item }) => item)],
    jobs: await projectedRiskProposalJobs(strapi, assessmentDocumentId, viewer.documentId),
  };
}
