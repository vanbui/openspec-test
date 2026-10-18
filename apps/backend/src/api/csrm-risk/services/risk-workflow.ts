import {
  AssessmentWorkflowError,
  appendAiRunDecisionsWithinMutation,
  parseWritableRiskFields,
  type AssessmentMutationStrapi,
  withMutableAssessmentMutation,
} from "../../csrm-assessment/services/assessment-workflow";
import { createWithRiskNumber } from "./risk-number";
import { isRegisteredSourceServiceUser, registeredSourceServiceUserDocumentIds } from "../../../iam/identity/source-principal";
import { RISK_AI_FIELDS, applyAiFieldEdit, fieldEventsByRun, parseRiskAiProvenance } from "../../csrm-assessment/services/ai-provenance";
import { isActiveRisk } from "../../../csrm/active-risk";
import { RISK_HISTORY_FIELDS, RISK_HISTORY_RELATIONS_POPULATE, riskChanges } from "../../../csrm/risk-history-changes";
import { recordRiskHistory, type RiskHistoryEntry } from "../../csrm-risk-history-event/services/risk-history";

type RecordValue = Record<string, unknown>;
type DocumentService = {
  create: (query: { data: RecordValue }) => Promise<RecordValue>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};
export type RiskWorkflowStrapi = {
  documents: (uid: string) => DocumentService;
  db: AssessmentMutationStrapi["db"];
};

const RISK_UID = "api::csrm-risk.csrm-risk";
const RELATION_UID = {
  riskType: "api::csrm-risk-type.csrm-risk-type",
  riskOwner: "api::idambox-user.idambox-user",
  informationSystemImpacted: "api::csrm-information-system.csrm-information-system",
  informationAssetImpacted: "api::csrm-information-asset.csrm-information-asset",
  treatmentOwner: "api::idambox-user.idambox-user",
} as const;

export class RiskWorkflowError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "RiskWorkflowError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function documentId(value: unknown): string | null {
  if (typeof value === "string" && value.length > 0) return value;
  return isRecord(value) && typeof value.documentId === "string" && value.documentId.length > 0
    ? value.documentId
    : null;
}

function assertDocumentId(value: unknown, message: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new RiskWorkflowError(400, message);
}

function assertRequiredRiskStatement(data: RecordValue, required: boolean): void {
  if ((required || "riskStatement" in data)
    && (typeof data.riskStatement !== "string" || data.riskStatement.length === 0)) {
    throw new RiskWorkflowError(400, "CSRM Risk mutation data is invalid.");
  }
}

async function resolveRelations(strapi: RiskWorkflowStrapi, data: RecordValue): Promise<RecordValue> {
  const resolved = { ...data };
  for (const [field, uid] of Object.entries(RELATION_UID)) {
    if (!(field in data)) continue;
    const value = data[field];
    if (value === null) {
      resolved[field] = null;
      continue;
    }
    const relationId = documentId(value);
    if (!relationId) throw new RiskWorkflowError(400, "CSRM Risk reference is invalid.");
    if ((field === "riskOwner" || field === "treatmentOwner") && await isRegisteredSourceServiceUser(strapi, relationId)) {
      throw new RiskWorkflowError(400, "CSRM Risk reference is invalid.");
    }
    const relation = await strapi.documents(uid).findOne({ documentId: relationId });
    if (!relation || ((field === "riskOwner" || field === "treatmentOwner") && relation.accountStatus !== "active")) {
      throw new RiskWorkflowError(400, "CSRM Risk reference is invalid.");
    }
    resolved[field] = relationId;
  }
  return resolved;
}


const MAX_ASSESSMENT_RISKS = 1_000;
const MAX_ASSESSMENT_OWNER_LABELS = 2_000;

function relationDocumentId(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  const valueDocumentId = typeof value === "string" ? value : isRecord(value) ? value.documentId : null;
  if (typeof valueDocumentId !== "string" || valueDocumentId.length === 0) {
    throw new RiskWorkflowError(400, "CSRM assessment Risk relation is invalid.");
  }
  return valueDocumentId;
}

/**
 * Loads the bounded persisted Risk aggregate used exclusively by the existing
 * authorised assessment-detail read.  The +1 probe makes an oversized
 * aggregate fail before any projection or owner identity resolution.
 */
export async function loadAnalystAssessmentRiskDetails(
  strapi: RiskWorkflowStrapi,
  assessmentDocumentId: string,
): Promise<RecordValue[]> {
  assertDocumentId(assessmentDocumentId, "CSRM assessment identifier is invalid.");
  const risks = await strapi.documents(RISK_UID).findMany({
    filters: { assessment: { documentId: { $eq: assessmentDocumentId } } },
    sort: ["riskNumber:asc"],
    limit: MAX_ASSESSMENT_RISKS + 1,
    populate: {
      riskType: true,
      riskOwner: true,
      informationSystemImpacted: true,
      informationAssetImpacted: true,
      treatmentOwner: true,
      controlImplementations: { populate: { control: true } },
      // Phase 16 D-08: the withdrawing analyst, named in the analyst detail's withdrawal block (id and name only).
      withdrawnBy: { fields: ["documentId", "displayName"] },
    },
  });
  if (risks.length > MAX_ASSESSMENT_RISKS) {
    throw new RiskWorkflowError(400, "CSRM assessment Risk limit is exceeded.");
  }
  return risks;
}

/** Resolves only persisted Risk owner references; active-search policy is not used here. */
export async function loadAnalystAssessmentOwnerLabels(
  strapi: RiskWorkflowStrapi,
  risks: RecordValue[],
): Promise<RecordValue[]> {
  const ownerIds = new Set<string>();
  for (const risk of risks) {
    if (!isRecord(risk)) throw new RiskWorkflowError(400, "CSRM assessment Risk is invalid.");
    for (const field of ["riskOwner", "treatmentOwner"] as const) {
      const ownerId = relationDocumentId(risk[field]);
      if (ownerId) ownerIds.add(ownerId);
    }
  }
  if (ownerIds.size > MAX_ASSESSMENT_OWNER_LABELS) {
    throw new RiskWorkflowError(400, "CSRM assessment owner label limit is exceeded.");
  }
  const users = strapi.documents("api::idambox-user.idambox-user");
  const labels: RecordValue[] = [];
  for (const ownerId of [...ownerIds].sort((left, right) => left.localeCompare(right))) {
    const owner = await users.findOne({ documentId: ownerId });
    if (!owner || typeof owner.documentId !== "string" || typeof owner.displayName !== "string") {
      throw new RiskWorkflowError(400, "CSRM assessment Risk owner is invalid.");
    }
    labels.push({ documentId: owner.documentId, displayName: owner.displayName });
  }
  return labels;
}

/**
 * Where a change to a Risk comes from, for its history row (D-19): the analyst, or an AI run whose proposal the
 * analyst accepted (the run, and the proposal item when there is one).
 */
export type HistorySource = { kind: "analyst" } | { kind: "ai-run"; runDocumentId: string; proposalItem?: string };

/** The history row's source fields for `source`. */
export function historySourceFields(source: HistorySource): Pick<RiskHistoryEntry, "sourceKind" | "aiRunDocumentId" | "proposalItem"> {
  return source.kind === "ai-run"
    ? { sourceKind: "ai-run", aiRunDocumentId: source.runDocumentId, ...(source.proposalItem ? { proposalItem: source.proposalItem } : {}) }
    : { sourceKind: "analyst" };
}

/**
 * D-07: a withdrawn Risk is read-only. Every inner Risk and control implementation function and Phase 12's decisions
 * call this on the Risk they loaded inside the transaction, after the editable guard, so a released assessment still
 * answers ASSESSMENT_NOT_MUTABLE first. Reinstating the Risk is the only way to change it again.
 */
export function assertRiskActive(risk: unknown): void {
  if (!isActiveRisk(risk)) throw new AssessmentWorkflowError(409, "CSRM Risk has been withdrawn.", "RISK_WITHDRAWN");
}

type InnerRiskInput = {
  strapi: RiskWorkflowStrapi;
  /** The assessment withMutableAssessmentMutation (or withAssessmentLock) loaded and locked. */
  assessment: RecordValue;
  actorDocumentId: string;
  source: HistorySource;
};

const RISK_HISTORY_POPULATE = { assessment: true, ...RISK_HISTORY_RELATIONS_POPULATE } as const;

function lockedAssessmentId(assessment: RecordValue): string {
  const assessmentDocumentId = documentId(assessment);
  if (!assessmentDocumentId) throw new RiskWorkflowError(409, "CSRM Risk ancestor is invalid.");
  return assessmentDocumentId;
}

/**
 * Creates one Risk inside the caller's locked transaction and records its `created` history row there (D-19). It
 * never serialises, so a batch may call it repeatedly. The caller owns the guard and the transition.
 */
export async function createRiskWithinMutation(input: InnerRiskInput & { fields: unknown }): Promise<RecordValue & { changed: boolean }> {
  const assessmentDocumentId = lockedAssessmentId(input.assessment);
  const parsed = parseWritableRiskFields(input.fields);
  assertRequiredRiskStatement(parsed, true);
  const data = await resolveRelations(input.strapi, parsed);
  const created = await createWithRiskNumber((riskNumber) => input.strapi.documents(RISK_UID).create({ data: {
    ...data,
    riskNumber,
    assessment: assessmentDocumentId,
  } }));
  const riskDocumentId = documentId(created);
  if (!riskDocumentId) throw new RiskWorkflowError(409, "CSRM Risk persistence is invalid.");
  // The approved record: a `created` row lists each starting value that holds one, with `from: null`.
  const stored = await input.strapi.documents(RISK_UID).findOne({ documentId: riskDocumentId, populate: RISK_HISTORY_POPULATE });
  if (!stored) throw new RiskWorkflowError(409, "CSRM Risk persistence is invalid.");
  await recordRiskHistory(input.strapi, {
    kind: "created",
    riskDocumentId,
    assessmentDocumentId,
    actorDocumentId: input.actorDocumentId,
    ...historySourceFields(input.source),
    changes: { fields: riskChanges(null, stored, RISK_HISTORY_FIELDS) },
  });
  return { ...created, changed: true };
}

/**
 * Updates one Risk inside the caller's locked transaction (D-19, D-07, Phase 12 D-21). It re-reads the Risk with its
 * assessment and relations, refuses a moved Risk (409) and a withdrawn one (RISK_WITHDRAWN), resolves the relations
 * (a registered source service user is never an owner), marks the AI fields the change edits, and writes only when a
 * value changes. The `updated` history row lists exactly the changed fields, each relation with the label it has now;
 * a change of nothing writes nothing and returns `changed: false`.
 *
 * An `ai-run` source (Phase 16 D-25, D-37) is a confirmed or undone AI proposal: the caller records each field's
 * per-field fact itself (`markFieldsConfirmedFromRun`, or the facts an Undo restores) with its decision event, so Phase
 * 12's `edited` marking and its run event are skipped. `undo` marks the history row of an Undo of a confirmed change.
 */
export async function updateRiskWithinMutation(input: InnerRiskInput & {
  riskDocumentId: string;
  fields: unknown;
  /** Verifier W-3: only a human Security Analyst's edit reviews an AI field. */
  humanAnalyst: boolean;
  /** The history row reverses a confirmed AI change (only with an `ai-run` source). */
  undo?: boolean;
}): Promise<RecordValue & { changed: boolean }> {
  assertDocumentId(input.riskDocumentId, "CSRM Risk identifier is invalid.");
  const assessmentDocumentId = lockedAssessmentId(input.assessment);
  const parsed = parseWritableRiskFields(input.fields);
  assertRequiredRiskStatement(parsed, false);
  const risks = input.strapi.documents(RISK_UID);
  const before = await risks.findOne({ documentId: input.riskDocumentId, populate: RISK_HISTORY_POPULATE });
  if (!before) throw new RiskWorkflowError(404, "CSRM Risk was not found.");
  if (documentId(before.assessment) !== assessmentDocumentId) throw new RiskWorkflowError(409, "CSRM Risk ancestor changed.");
  assertRiskActive(before);
  const data = await resolveRelations(input.strapi, parsed);
  // Relations compare by documentId, so whether anything changes is known before any label is read.
  if (riskChanges(before, { ...before, ...data }, RISK_HISTORY_FIELDS).length === 0) return { ...before, changed: false };

  const provenance = input.source.kind === "ai-run" ? null : parseRiskAiProvenance(before.aiProvenance);
  const relationFields = new Set(["riskType", "informationSystemImpacted", "informationAssetImpacted"]);
  const valueChanged = provenance ? RISK_AI_FIELDS.filter((field) => field in data && (relationFields.has(field)
    ? documentId(data[field]) !== documentId(before[field])
    : data[field] !== before[field])) : [];
  const at = new Date().toISOString();
  // D-21, verifier W-3: who edits decides each changed AI field's review state, in this transaction with its run event.
  const edit = provenance ? applyAiFieldEdit(provenance, valueChanged, { documentId: input.actorDocumentId, humanAnalyst: input.humanAnalyst }, at) : null;
  await risks.update({ documentId: input.riskDocumentId, data: {
    ...data, ...(edit?.fields.length ? { aiProvenance: edit.provenance } : {}),
  } });
  // The Phase 16 code review amendment (2026-10-16, item 1; BE2-01, BE2-03): each field's event goes to the run that
  // proposed its value, one event per run, in this transaction.
  if (provenance && edit?.fields.length) {
    for (const [runId, fields] of fieldEventsByRun(provenance, edit.fields)) {
      await appendAiRunDecisionsWithinMutation(input.strapi, runId, [
        { schemaVersion: 1, kind: "edited", at, by: input.actorDocumentId, target: input.riskDocumentId, fields },
      ]);
    }
  }
  const after = await risks.findOne({ documentId: input.riskDocumentId, populate: RISK_HISTORY_POPULATE });
  if (!after) throw new RiskWorkflowError(404, "CSRM Risk was not found.");
  const fields = riskChanges(before, after, RISK_HISTORY_FIELDS);
  if (fields.length === 0) return { ...after, changed: false };
  await recordRiskHistory(input.strapi, {
    kind: "updated",
    riskDocumentId: input.riskDocumentId,
    assessmentDocumentId,
    actorDocumentId: input.actorDocumentId,
    ...historySourceFields(input.source),
    ...(input.undo ? { undo: true } : {}),
    occurredAt: new Date(at),
    changes: { fields },
  });
  return { ...after, changed: true };
}

function withoutChanged(result: RecordValue & { changed: boolean }): RecordValue {
  const { changed: _changed, ...record } = result;
  return record;
}

export async function createAssessmentRisk(input: {
  strapi: RiskWorkflowStrapi;
  assessmentDocumentId: string;
  analystDocumentId: string;
  body: unknown;
}): Promise<RecordValue> {
  assertDocumentId(input.assessmentDocumentId, "CSRM assessment identifier is invalid.");
  const parsed = parseWritableRiskFields(input.body);
  assertRequiredRiskStatement(parsed, true);
  return withoutChanged(await withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId: input.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    transition: (result) => result.changed ? "accepted-edit" : "none",
    mutate: ({ assessment }) => createRiskWithinMutation({
      strapi: input.strapi,
      assessment,
      actorDocumentId: input.analystDocumentId,
      source: { kind: "analyst" },
      fields: parsed,
    }),
  }));
}

export async function updateRisk(input: {
  strapi: RiskWorkflowStrapi;
  riskDocumentId: string;
  analystDocumentId: string;
  /** Verifier W-3: the editor holds the update through the human Security Analyst Role, so its edit reviews an AI field. */
  humanAnalyst: boolean;
  body: unknown;
}): Promise<RecordValue> {
  assertDocumentId(input.riskDocumentId, "CSRM Risk identifier is invalid.");
  const parsed = parseWritableRiskFields(input.body);
  assertRequiredRiskStatement(parsed, false);
  const candidate = await input.strapi.documents(RISK_UID).findOne({
    documentId: input.riskDocumentId,
    populate: { assessment: true },
  });
  if (!candidate) throw new RiskWorkflowError(404, "CSRM Risk was not found.");
  const assessmentDocumentId = documentId(candidate.assessment);
  if (!assessmentDocumentId) throw new RiskWorkflowError(409, "CSRM Risk ancestor is invalid.");
  return withoutChanged(await withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    // D-23: a PATCH that changes nothing withdraws no review.
    transition: (result) => result.changed ? "accepted-edit" : "none",
    mutate: ({ assessment }) => updateRiskWithinMutation({
      strapi: input.strapi,
      assessment,
      actorDocumentId: input.analystDocumentId,
      source: { kind: "analyst" },
      riskDocumentId: input.riskDocumentId,
      fields: parsed,
      humanAnalyst: input.humanAnalyst,
    }),
  }));
}

/**
 * The picker's Risk Types (D-31): each carries the controls that apply to it, so the mitigation control picker
 * can offer them first. Only the fields of the bounded applicable-control summary are loaded.
 */
export async function listRiskTypeDocuments(strapi: RiskWorkflowStrapi): Promise<RecordValue[]> {
  return strapi.documents("api::csrm-risk-type.csrm-risk-type").findMany({
    sort: ["name:asc"],
    limit: 1_000,
    populate: {
      applicableControls: {
        fields: ["controlNumber", "name", "framework"],
        sort: ["controlNumber:asc"],
      },
    },
  });
}

export async function listControlDocuments(strapi: RiskWorkflowStrapi): Promise<RecordValue[]> {
  return strapi.documents("api::csrm-control.csrm-control").findMany({
    sort: ["controlNumber:asc"],
    limit: 5_000,
  });
}

export async function searchActiveUserDocuments(strapi: RiskWorkflowStrapi, search: string): Promise<RecordValue[]> {
  const serviceIds = await registeredSourceServiceUserDocumentIds(strapi);
  return strapi.documents("api::idambox-user.idambox-user").findMany({
    filters: {
      ...(serviceIds.length === 0 ? {} : { documentId: { $notIn: serviceIds } }),
      accountStatus: { $eq: "active" },
      displayName: { $containsi: search },
    },
    sort: ["displayName:asc"],
    limit: 20,
  });
}

export { AssessmentWorkflowError };
