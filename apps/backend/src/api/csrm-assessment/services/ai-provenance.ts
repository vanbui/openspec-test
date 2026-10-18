import { currentQuestionLabels, RUN_QUESTIONNAIRE_LABELS_POPULATE } from "../../csrm-ai-run/services/ai-run-record";

export const RISK_AI_FIELDS = [
  "riskType", "issueStatement", "riskStatement", "riskCategory", "riskSubCategory",
  "riskCause", "potentialImpact", "informationSystemImpacted", "informationAssetImpacted",
  "dataClassification", "inherentLikelihood", "highestInherentConsequence", "inherentRating",
  "inherentRatingRationale", "residualLikelihood", "highestResidualConsequence", "residualRating",
  "residualRatingRationale", "treatmentAction", "treatmentPlan",
] as const;
export const RISK_STATEMENT_FIELDS = ["issueStatement", "riskStatement", "riskCause", "potentialImpact", "inherentRatingRationale", "residualRatingRationale", "treatmentPlan"] as const;
export const ASSESSMENT_AI_FIELDS = ["summary", "overallRating", "overallRiskRationale", "recommendationsSummary"] as const;
export const ASSESSMENT_STATEMENT_FIELDS = ["summary", "overallRiskRationale", "recommendationsSummary"] as const;
export const AI_FIELD_STATES = ["proposed", "accepted", "edited"] as const;
export const AI_SUGGESTION_STATES = ["proposed", "added", "dismissed"] as const;

type FieldState = typeof AI_FIELD_STATES[number];
type SuggestionState = typeof AI_SUGGESTION_STATES[number];
/*
 * `runId` (Phase 16 D-25, the approved Phase 16 amendment "Per-field run references"): the run that proposed the field's
 * value, on a Risk's facts only. A fact without it resolves to the envelope's run (`fieldRunId`).
 */
export type AiFieldFact = { state: FieldState; sources?: string[]; by?: string; at?: string; runId?: string };
export type AiSuggestionFact = { key: string; control: string; controlNumber: string; rationale: string; state: SuggestionState; by?: string; at?: string; implementation?: string; implementationSnapshot?: Record<string, string | number | boolean | null> };
export type RiskAiProvenanceV1 = { schemaVersion: 1; runId: string; proposalKey: string; fields: Partial<Record<typeof RISK_AI_FIELDS[number], AiFieldFact>>; uncitedClaims: string[]; suggestions: AiSuggestionFact[]; adjustments: string[] };
export type AssessmentAiProvenanceV1 = { schemaVersion: 1; runId: string; proposalKey: string; fields: Partial<Record<typeof ASSESSMENT_AI_FIELDS[number], AiFieldFact>> };
type Provenance = RiskAiProvenanceV1 | AssessmentAiProvenanceV1;
type Row = Record<string, unknown>;
const record = (value: unknown): value is Row => value !== null && typeof value === "object" && !Array.isArray(value);
const keys = (value: Row, required: readonly string[], optional: readonly string[] = []): boolean => required.every((key) => key in value) && Object.keys(value).every((key) => required.includes(key) || optional.includes(key));
const string = (value: unknown, max = 300): value is string => typeof value === "string" && value.length > 0 && value.length <= max;
const instant = (value: unknown): value is string => typeof value === "string" && !Number.isNaN(Date.parse(value));
const strings = (value: unknown, maxEntries: number, maxLength: number): value is string[] => Array.isArray(value) && value.length <= maxEntries && value.every((item) => string(item, maxLength));

function fieldFact(value: unknown, statement: boolean, risk: boolean): value is AiFieldFact {
  if (!record(value) || !keys(value, ["state"], [...(statement ? ["sources"] : []), "by", "at", ...(risk ? ["runId"] : [])])) return false;
  if (!AI_FIELD_STATES.includes(value.state as FieldState)) return false;
  if (value.by !== undefined && !string(value.by, 255)) return false;
  if (value.runId !== undefined && !string(value.runId, 255)) return false;
  if (value.at !== undefined && !instant(value.at)) return false;
  return value.sources === undefined || (statement && strings(value.sources, 100, 255));
}
function suggestion(value: unknown): value is AiSuggestionFact {
  if (!record(value) || !keys(value, ["key", "control", "controlNumber", "rationale", "state"], ["by", "at", "implementation", "implementationSnapshot"])) return false;
  if (!string(value.key, 255) || !string(value.control, 255) || !string(value.controlNumber, 255) || !string(value.rationale, 500) || !AI_SUGGESTION_STATES.includes(value.state as SuggestionState)) return false;
  if (value.by !== undefined && !string(value.by, 255)) return false;
  if (value.at !== undefined && !instant(value.at)) return false;
  if (value.implementation !== undefined && !string(value.implementation, 255)) return false;
  if (value.implementationSnapshot !== undefined) {
    if (!record(value.implementationSnapshot) || Object.keys(value.implementationSnapshot).length > 40 || Object.values(value.implementationSnapshot).some((item) => item !== null && !["string", "number", "boolean"].includes(typeof item))) return false;
  }
  return true;
}
function parse(value: unknown, allowed: readonly string[], statements: readonly string[], risk: boolean): Provenance | null {
  if (!record(value) || !keys(value, ["schemaVersion", "runId", "proposalKey", "fields", ...(risk ? ["uncitedClaims", "suggestions", "adjustments"] : [])])) return null;
  if (value.schemaVersion !== 1 || !string(value.runId, 255) || !string(value.proposalKey, 255) || !record(value.fields)) return null;
  for (const [name, fact] of Object.entries(value.fields)) if (!allowed.includes(name) || !fieldFact(fact, statements.includes(name), risk)) return null;
  if (risk) {
    if (!strings(value.uncitedClaims, 5, 300) || !Array.isArray(value.suggestions) || value.suggestions.length > 5 || !value.suggestions.every(suggestion) || !strings(value.adjustments, 100, 255)) return null;
  }
  return value as Provenance;
}
/** Whether `value` is a valid per-field fact of the Risk AI field `field` (Phase 16: a rewrite unit's decision `before` holds them). */
export function isRiskAiFieldFact(field: string, value: unknown): value is AiFieldFact {
  return (RISK_AI_FIELDS as readonly string[]).includes(field) && fieldFact(value, (RISK_STATEMENT_FIELDS as readonly string[]).includes(field), true);
}
export function parseRiskAiProvenance(value: unknown): RiskAiProvenanceV1 | null {
  return parse(value, RISK_AI_FIELDS, RISK_STATEMENT_FIELDS, true) as RiskAiProvenanceV1 | null;
}
export function parseAssessmentAiProvenance(value: unknown): AssessmentAiProvenanceV1 | null {
  return parse(value, ASSESSMENT_AI_FIELDS, ASSESSMENT_STATEMENT_FIELDS, false) as AssessmentAiProvenanceV1 | null;
}
export function proposedFieldsOf(provenance: Provenance | null): string[] {
  return provenance ? Object.entries(provenance.fields).filter(([, fact]) => fact?.state === "proposed").map(([name]) => name) : [];
}
function markFields<T extends Provenance>(provenance: T, changedFields: readonly string[], state: FieldState, actorDocumentId: string, at: string): T {
  const fields: Record<string, AiFieldFact> = { ...provenance.fields };
  for (const name of changedFields) if (fields[name]) fields[name] = { ...fields[name], state, by: actorDocumentId, at };
  return { ...provenance, fields };
}
export function markEditedFields<T extends Provenance>(provenance: T, changedFields: readonly string[], actorDocumentId: string, at: string): T {
  return markFields(provenance, changedFields, "edited", actorDocumentId, at);
}

/** Phase 16 D-25: the run that proposed a Risk field's value: the fact's own run, else the envelope's (facts written before Phase 16). */
export function fieldRunId(provenance: RiskAiProvenanceV1, field: typeof RISK_AI_FIELDS[number]): string {
  return provenance.fields[field]?.runId ?? provenance.runId;
}

/**
 * The Phase 16 code review amendment (2026-10-16, item 1; BE2-01, BE2-03): `fields` grouped by the run that proposed
 * each value (`fieldRunId`), in first-seen order, so each Phase 12 field event is appended to that run.
 */
export function fieldEventsByRun(provenance: RiskAiProvenanceV1, fields: readonly string[]): Map<string, string[]> {
  const byRun = new Map<string, string[]>();
  for (const field of fields) {
    const runId = fieldRunId(provenance, field as typeof RISK_AI_FIELDS[number]);
    byRun.set(runId, [...(byRun.get(runId) ?? []), field]);
  }
  return byRun;
}

/** The envelope a Risk created by hand gains at its first confirmed AI change, naming that run and unit (the amendment). */
export function emptyRiskAiProvenance(runId: string, proposalKey: string): RiskAiProvenanceV1 {
  return { schemaVersion: 1, runId, proposalKey, fields: {}, uncitedClaims: [], suggestions: [], adjustments: [] };
}

/**
 * Phase 16 D-25 and D-37: the named fields of a confirmed AI change, each `accepted` by the confirming analyst at `at`
 * and naming the run that proposed it. A statement field cites the change's own `sources` (none when it has none),
 * since the earlier citations belong to the earlier run; any other field takes no sources. Every other field, and the
 * envelope's run, stay as they are.
 */
export function markFieldsConfirmedFromRun(
  provenance: RiskAiProvenanceV1,
  fields: readonly string[],
  runId: string,
  actorDocumentId: string,
  at: string,
  options: { sources?: readonly string[] } = {},
): RiskAiProvenanceV1 {
  const next: Record<string, AiFieldFact> = { ...provenance.fields };
  for (const field of fields) {
    if (!(RISK_AI_FIELDS as readonly string[]).includes(field)) continue;
    const statement = (RISK_STATEMENT_FIELDS as readonly string[]).includes(field);
    next[field] = { state: "accepted", ...(statement ? { sources: [...(options.sources ?? [])] } : {}), by: actorDocumentId, at, runId };
  }
  return { ...provenance, fields: next };
}

/** Who changed a record through its update path: `humanAnalyst` holds the update through the human Security Analyst Role. */
export type AiFieldEditor = { documentId: string; humanAnalyst: boolean };
/*
 * D-21 and verifier W-3: an edit through the risk or assessment update path that changes the value of AI fields
 * (`valueChanged`). AI output is assistance a human must review (AGENTS.md, G-1), so only a human Security Analyst's edit
 * or decision moves a field out of `proposed`. A human analyst's edit marks a `proposed` or `accepted` field `edited`, by
 * that analyst (one already `edited` stays so, and records nothing more). Any other editor, such as the analyst service
 * agent holding the edit grant, leaves a changed AI field `proposed` or returns it there from `accepted` or `edited`, by
 * that editor, so a human reviews the value it wrote before release. Returns the next envelope and the fields the run's
 * `edited` event names; none means there is nothing to record.
 */
export function applyAiFieldEdit<T extends Provenance>(provenance: T, valueChanged: readonly string[], editor: AiFieldEditor, at: string): { provenance: T; fields: string[] } {
  const facts = provenance.fields as Record<string, AiFieldFact | undefined>;
  const fields = valueChanged.filter((name) => {
    const state = facts[name]?.state;
    return editor.humanAnalyst ? state === "proposed" || state === "accepted" : state !== undefined;
  });
  return { provenance: markFields(provenance, fields, editor.humanAnalyst ? "edited" : "proposed", editor.documentId, at), fields };
}

/*
 * CR-02 (D-12, UI-D12): the risk's record once an analyst has removed the control implementation `implementationId`.
 * Each suggestion that added it is proposed again, by that analyst, without its implementation and snapshot, as its
 * Undo leaves it, so the analyst can add it again or dismiss it. Null when no suggestion added that implementation.
 */
export function restoreSuggestionsOfRemovedImplementation(provenance: RiskAiProvenanceV1, implementationId: string, by: string, at: string): { provenance: RiskAiProvenanceV1; restored: string[] } | null {
  const restored: string[] = [];
  const suggestions = provenance.suggestions.map((item): AiSuggestionFact => {
    if (item.state !== "added" || item.implementation !== implementationId) return item;
    restored.push(item.key);
    const { implementation: _removed, implementationSnapshot: _snapshot, ...base } = item;
    return { ...base, state: "proposed", by, at };
  });
  return restored.length ? { provenance: { ...provenance, suggestions }, restored } : null;
}

/*
 * CR-02: a suggestion is `added` while the planned control it created exists on the risk (`implementationIds`). One whose
 * control is gone (removed before removals restored their suggestion, or with no implementation recorded) reads as
 * proposed again, with no implementation, actor or time, so the analyst can add it again or dismiss it. The analyst's
 * page and the decision operation both read a suggestion through this rule.
 */
export function reconcileSuggestion(item: AiSuggestionFact, implementationIds: ReadonlySet<string>): AiSuggestionFact {
  if (item.state !== "added" || (item.implementation !== undefined && implementationIds.has(item.implementation))) return item;
  const { implementation: _gone, implementationSnapshot: _snapshot, by: _by, at: _at, ...base } = item;
  return { ...base, state: "proposed" };
}

/*
 * The analyst's projection of the stored envelopes (D-12, D-14, D-21). Sources resolve against the
 * proposing run's context summary, actors and suggested controls against one bounded read each, and a
 * malformed envelope projects null so the assessment read never fails on it (Pitfall 11).
 */
export type AiSourceCitation = { key: string; kind: "request" | "answer" | "system" | "asset"; label: string; section: string | null; classification: string | null };
export type ProvenanceControlSummary = { documentId: string; controlNumber: string; name: string; description: string | null };
export type AiProvenanceLookups = {
  sources: ReadonlyMap<string, ReadonlyMap<string, AiSourceCitation>>;
  actors: ReadonlyMap<string, string>;
  controls: ReadonlyMap<string, ProvenanceControlSummary>;
};
type LookupDocuments = { findMany: (query: Row) => Promise<Row[]> };
type LookupStrapi = { documents: (uid: string) => LookupDocuments };

/* The request form's own labels (Phase 10 §9.1), as the web's run sheet names the fields sent (walk D11). */
export const REQUEST_FIELD_LABELS: Readonly<Record<string, string>> = {
  "request.title": "Request title",
  "request.description": "Description",
  "request.assessmentType": "Assessment type",
  "request.division": "Division",
  "request.businessUnit": "Business unit",
  "request.businessPurpose": "Business purpose",
  "request.businessCriticality": "Business criticality",
  "request.thirdPartyInvolvement": "Third-party involvement",
  "request.thirdPartyDetails": "Third-party details",
  "request.regulatoryRequirements": "Regulatory requirements",
};
const SOURCE_NO_LONGER_AVAILABLE = "Source no longer available";

/*
 * The source catalogue a run offered, rebuilt from its stored context summary, which holds no Requestor text. An
 * answer source reads by its question's current text (`questionLabels`, from the run's questionnaire), else by the
 * position label the summary stores (WR-105).
 */
export function sourceCatalogueFromContextSummary(summary: unknown, questionLabels: ReadonlyMap<string, string> = new Map()): Map<string, AiSourceCitation> {
  const catalogue = new Map<string, AiSourceCitation>();
  if (!record(summary)) return catalogue;
  const request = record(summary.request) && Array.isArray(summary.request.fields) ? summary.request.fields : [];
  for (const field of request) {
    if (record(field) && string(field.key, 255)) catalogue.set(field.key, { key: field.key, kind: "request", label: REQUEST_FIELD_LABELS[field.key] ?? field.key, section: null, classification: null });
  }
  const questions = record(summary.questions) && Array.isArray(summary.questions.sources) ? summary.questions.sources : [];
  for (const source of questions) {
    if (record(source) && string(source.key, 255) && string(source.label, 300)) catalogue.set(source.key, { key: source.key, kind: "answer", label: questionLabels.get(source.key) ?? source.label, section: string(source.section, 300) ? source.section : null, classification: null });
  }
  for (const system of Array.isArray(summary.systems) ? summary.systems : []) {
    if (record(system) && string(system.key, 255) && string(system.name, 300)) catalogue.set(system.key, { key: system.key, kind: "system", label: system.name, section: null, classification: null });
  }
  for (const asset of Array.isArray(summary.assets) ? summary.assets : []) {
    if (record(asset) && string(asset.key, 255) && string(asset.name, 300)) catalogue.set(asset.key, { key: asset.key, kind: "asset", label: asset.name, section: null, classification: string(asset.classification, 64) ? asset.classification : null });
  }
  return catalogue;
}

function kindOfKey(key: string): AiSourceCitation["kind"] {
  if (key.startsWith("answer.")) return "answer";
  if (key.startsWith("system-")) return "system";
  if (key.startsWith("asset-")) return "asset";
  return "request";
}

function citation(key: string, catalogue: ReadonlyMap<string, AiSourceCitation> | undefined): AiSourceCitation {
  return catalogue?.get(key) ?? { key, kind: kindOfKey(key), label: SOURCE_NO_LONGER_AVAILABLE, section: null, classification: null };
}

/* One read for every run, one for every actor and one for every suggested control on the assessment (08 D-31). */
export async function loadAiProvenanceLookups(strapi: LookupStrapi, input: { assessment: Row; risks: readonly Row[] }): Promise<AiProvenanceLookups> {
  const envelopes: Provenance[] = [];
  const assessment = parseAssessmentAiProvenance(input.assessment.aiProvenance);
  if (assessment) envelopes.push(assessment);
  for (const risk of input.risks) {
    const parsed = parseRiskAiProvenance(risk.aiProvenance);
    if (parsed) envelopes.push(parsed);
  }
  // Phase 16 D-25: a field confirmed from a later run cites that run's sources, so its run is read too.
  const runIds = [...new Set(envelopes.flatMap((envelope) => [envelope.runId, ...Object.values(envelope.fields as Record<string, AiFieldFact | undefined>).flatMap((fact) => fact?.runId ? [fact.runId] : [])]))];
  const actorIds = new Set<string>();
  const controlIds = new Set<string>();
  for (const envelope of envelopes) {
    for (const fact of Object.values(envelope.fields)) if (fact?.by) actorIds.add(fact.by);
    if ("suggestions" in envelope) {
      for (const item of envelope.suggestions) {
        controlIds.add(item.control);
        if (item.by) actorIds.add(item.by);
      }
    }
  }
  const [runs, users, controls] = await Promise.all([
    runIds.length ? strapi.documents("api::csrm-ai-run.csrm-ai-run").findMany({ filters: { documentId: { $in: runIds } }, fields: ["documentId", "contextSummary"], populate: { questionnaire: RUN_QUESTIONNAIRE_LABELS_POPULATE }, limit: runIds.length }) : [],
    actorIds.size ? strapi.documents("api::idambox-user.idambox-user").findMany({ filters: { documentId: { $in: [...actorIds] }, accountStatus: { $eq: "active" } }, fields: ["documentId", "displayName"], limit: actorIds.size }) : [],
    controlIds.size ? strapi.documents("api::csrm-control.csrm-control").findMany({ filters: { documentId: { $in: [...controlIds] } }, fields: ["documentId", "controlNumber", "name", "description"], limit: controlIds.size }) : [],
  ]);
  return {
    sources: new Map(runs.filter((run) => typeof run.documentId === "string").map((run) => [run.documentId as string, sourceCatalogueFromContextSummary(run.contextSummary, currentQuestionLabels(run.questionnaire))])),
    actors: new Map(users
      .filter((user) => string(user.documentId, 255) && string(user.displayName, 255) && (user.displayName as string).trim().length > 0)
      .map((user) => [user.documentId as string, user.displayName as string])),
    controls: new Map(controls
      .filter((control) => string(control.documentId, 255) && string(control.controlNumber, 255) && string(control.name, 255))
      .map((control) => [control.documentId as string, {
        documentId: control.documentId as string,
        controlNumber: control.controlNumber as string,
        name: control.name as string,
        description: typeof control.description === "string" ? control.description.slice(0, 65_535) : null,
      }])),
  };
}

function actorSummary(id: string | undefined, lookups: AiProvenanceLookups): { documentId: string; displayName: string } | null {
  const name = id ? lookups.actors.get(id) : undefined;
  return id && name ? { documentId: id, displayName: name } : null;
}

function fieldReviews(envelope: Provenance, order: readonly string[], statements: readonly string[], lookups: AiProvenanceLookups) {
  const fields = envelope.fields as Record<string, AiFieldFact | undefined>;
  return order.flatMap((field) => {
    const fact = fields[field];
    if (!fact) return [];
    // Phase 16 D-25: each field cites against the run that proposed its value (`fieldRunId`).
    const catalogue = lookups.sources.get(fact.runId ?? envelope.runId);
    return [{
      field,
      state: fact.state,
      by: actorSummary(fact.by, lookups),
      at: fact.at ?? null,
      sources: statements.includes(field) ? (fact.sources ?? []).map((key) => citation(key, catalogue)) : null,
    }];
  });
}

/*
 * A risk's review state for the analyst. `presentControlIds` are the controls already mitigating the risk, and
 * `implementationIds` its control implementations, when the read holds them: an `added` suggestion whose control is gone
 * then reads as proposed again (CR-02).
 */
export function projectRiskAiProvenance(stored: unknown, lookups: AiProvenanceLookups, presentControlIds: ReadonlySet<string> = new Set(), implementationIds?: ReadonlySet<string>) {
  const envelope = parseRiskAiProvenance(stored);
  if (!envelope) return null;
  const fields = fieldReviews(envelope, RISK_AI_FIELDS, RISK_STATEMENT_FIELDS, lookups);
  return {
    runId: envelope.runId,
    proposalKey: envelope.proposalKey,
    fields,
    uncitedClaims: envelope.uncitedClaims,
    suggestions: envelope.suggestions.map((storedItem) => {
      const item = implementationIds ? reconcileSuggestion(storedItem, implementationIds) : storedItem;
      return {
        key: item.key,
        control: lookups.controls.get(item.control) ?? { documentId: item.control, controlNumber: item.controlNumber, name: item.controlNumber, description: null },
        rationale: item.rationale,
        state: item.state === "proposed" && presentControlIds.has(item.control) ? "present" : item.state,
        by: actorSummary(item.by, lookups),
        at: item.at ?? null,
        implementation: item.implementation ?? null,
      };
    }),
    adjustments: envelope.adjustments,
    outstanding: fields.filter((field) => field.state === "proposed").length,
  };
}

/* The assessment's own review state; its envelope records no adjustments, so the list is always empty. */
export function projectAssessmentAiProvenance(stored: unknown, lookups: AiProvenanceLookups) {
  const envelope = parseAssessmentAiProvenance(stored);
  if (!envelope) return null;
  const fields = fieldReviews(envelope, ASSESSMENT_AI_FIELDS, ASSESSMENT_STATEMENT_FIELDS, lookups);
  return { runId: envelope.runId, fields, adjustments: [] as string[], outstanding: fields.filter((field) => field.state === "proposed").length };
}
