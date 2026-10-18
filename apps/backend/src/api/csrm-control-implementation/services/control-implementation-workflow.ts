import {
  appendAiRunDecisionsWithinMutation,
  parseWritableControlImplementationFields,
  type AssessmentMutationStrapi,
  withMutableAssessmentMutation,
} from "../../csrm-assessment/services/assessment-workflow";
import { parseRiskAiProvenance, restoreSuggestionsOfRemovedImplementation } from "../../csrm-assessment/services/ai-provenance";
import { projectControlImplementationControlSummary } from "../../csrm-assessment/services/assessment-scope";
import { isRegisteredSourceServiceUser } from "../../../iam/identity/source-principal";
import { assertRiskActive, historySourceFields, type HistorySource } from "../../csrm-risk/services/risk-workflow";
import { controlImplementationChanges, type RiskHistoryControl } from "../../../csrm/risk-history-changes";
import { recordRiskHistory, type RiskHistoryEntry } from "../../csrm-risk-history-event/services/risk-history";

type RecordValue = Record<string, unknown>;
type DocumentService = {
  create: (query: { data: RecordValue }) => Promise<RecordValue>;
  delete: (query: { documentId: string }) => Promise<RecordValue>;
  findMany: (query: RecordValue) => Promise<RecordValue[]>;
  findOne: (query: RecordValue) => Promise<RecordValue | null>;
  update: (query: { documentId: string; data: RecordValue }) => Promise<RecordValue>;
};
export type ControlImplementationWorkflowStrapi = {
  documents: (uid: string) => DocumentService;
  db: AssessmentMutationStrapi["db"];
};

const IMPLEMENTATION_UID = "api::csrm-control-implementation.csrm-control-implementation";
const RISK_UID = "api::csrm-risk.csrm-risk";
const CONTROL_UID = "api::csrm-control.csrm-control";
const USER_UID = "api::idambox-user.idambox-user";

export class ControlImplementationWorkflowError extends Error {
  constructor(public readonly status: 400 | 404 | 409, message: string) {
    super(message);
    this.name = "ControlImplementationWorkflowError";
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
  if (typeof value !== "string" || value.length === 0) throw new ControlImplementationWorkflowError(400, message);
}

function riskAssessmentId(risk: RecordValue): string {
  const assessmentDocumentId = documentId(risk.assessment);
  if (!assessmentDocumentId) throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor is invalid.");
  return assessmentDocumentId;
}

async function requireRisk(
  strapi: ControlImplementationWorkflowStrapi,
  riskDocumentId: string,
): Promise<{ risk: RecordValue; assessmentDocumentId: string }> {
  const risk = await strapi.documents(RISK_UID).findOne({
    documentId: riskDocumentId,
    populate: { assessment: true },
  });
  if (!risk) throw new ControlImplementationWorkflowError(404, "CSRM Risk was not found.");
  return { risk, assessmentDocumentId: riskAssessmentId(risk) };
}

async function requireImplementation(
  strapi: ControlImplementationWorkflowStrapi,
  implementationDocumentId: string,
): Promise<{ implementation: RecordValue; riskDocumentId: string; assessmentDocumentId: string }> {
  const implementation = await strapi.documents(IMPLEMENTATION_UID).findOne({
    documentId: implementationDocumentId,
    populate: { risk: { populate: { assessment: true } }, control: true, controlOwner: true },
  });
  if (!implementation) throw new ControlImplementationWorkflowError(404, "CSRM ControlImplementation was not found.");
  const risk = isRecord(implementation.risk) ? implementation.risk : null;
  const riskDocumentId = documentId(risk);
  if (!risk || !riskDocumentId) throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor is invalid.");
  return { implementation, riskDocumentId, assessmentDocumentId: riskAssessmentId(risk) };
}

async function loadProjectedImplementation(
  strapi: ControlImplementationWorkflowStrapi,
  value: RecordValue,
): Promise<RecordValue> {
  const implementationDocumentId = documentId(value);
  if (!implementationDocumentId) {
    throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation persistence is invalid.");
  }
  const implementation = await strapi.documents(IMPLEMENTATION_UID).findOne({
    documentId: implementationDocumentId,
    populate: { control: true, controlOwner: true },
  });
  if (!implementation) throw new ControlImplementationWorkflowError(404, "CSRM ControlImplementation was not found.");
  return implementation;
}

async function resolveReferences(
  strapi: ControlImplementationWorkflowStrapi,
  parsed: RecordValue,
  requireControl: boolean,
): Promise<RecordValue> {
  const data = { ...parsed };
  if (requireControl && !("control" in data)) {
    throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation control is invalid.");
  }
  if ("control" in data) {
    const controlDocumentId = documentId(data.control);
    if (!controlDocumentId) throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation control is invalid.");
    const control = await strapi.documents(CONTROL_UID).findOne({ documentId: controlDocumentId });
    if (!control) throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation control is invalid.");
    data.control = controlDocumentId;
  }
  if ("controlOwner" in data && data.controlOwner !== null) {
    const ownerDocumentId = documentId(data.controlOwner);
    if (!ownerDocumentId) throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation owner is invalid.");
    if (await isRegisteredSourceServiceUser(strapi, ownerDocumentId)) {
      throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation owner is invalid.");
    }
    const owner = await strapi.documents(USER_UID).findOne({ documentId: ownerDocumentId });
    if (!owner || owner.accountStatus !== "active") {
      throw new ControlImplementationWorkflowError(400, "CSRM ControlImplementation owner is invalid.");
    }
    data.controlOwner = ownerDocumentId;
  }
  return data;
}

function sameAncestor(
  implementation: RecordValue,
  riskDocumentId: string,
  assessmentDocumentId: string,
): boolean {
  const risk = isRecord(implementation.risk) ? implementation.risk : null;
  return documentId(risk) === riskDocumentId
    && risk !== null
    && documentId(risk.assessment) === assessmentDocumentId;
}

export function projectControlImplementationSummary(document: RecordValue): RecordValue {
  const controlDocumentId = documentId(document.control);
  if (!controlDocumentId) throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation control is invalid.");
  const owner = isRecord(document.controlOwner)
    && typeof document.controlOwner.documentId === "string"
    && typeof document.controlOwner.displayName === "string"
    ? { documentId: document.controlOwner.documentId, displayName: document.controlOwner.displayName }
    : null;
  return {
    documentId: document.documentId,
    control: controlDocumentId,
    controlSummary: projectControlImplementationControlSummary(document.control),
    controlOwner: owner,
    controlStatus: document.controlStatus ?? null,
    effectivenessRating: document.effectivenessRating ?? null,
    evidence: document.evidence ?? null,
    implementationDueDate: document.implementationDueDate ?? null,
    implementedDate: document.implementedDate ?? null,
    reviewDate: document.reviewDate ?? null,
  };
}

export async function listRiskControlImplementationDocuments(
  strapi: ControlImplementationWorkflowStrapi,
  riskDocumentId: string,
): Promise<RecordValue[]> {
  assertDocumentId(riskDocumentId, "CSRM Risk identifier is invalid.");
  await requireRisk(strapi, riskDocumentId);
  return strapi.documents(IMPLEMENTATION_UID).findMany({
    filters: { risk: { documentId: { $eq: riskDocumentId } } },
    populate: { control: true, controlOwner: true },
    sort: ["createdAt:asc"],
    limit: 1_000,
  });
}

/** Who changes the implementation and where the change comes from, for the Risk's history row (D-19, D-20). */
type InnerHistoryInput = { actorDocumentId: string; source: HistorySource };

/* The control a history row names (D-20): by number and name, as the analyst knows it. */
function historyControl(implementation: RecordValue): RiskHistoryControl {
  const control = isRecord(implementation.control) ? implementation.control : null;
  const controlDocumentId = documentId(control);
  if (!control || !controlDocumentId || typeof control.controlNumber !== "string" || control.controlNumber.length === 0) {
    throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation control is invalid.");
  }
  return { documentId: controlDocumentId, controlNumber: control.controlNumber, name: typeof control.name === "string" ? control.name : "" };
}

async function recordImplementationHistory(
  strapi: ControlImplementationWorkflowStrapi,
  input: InnerHistoryInput & {
    kind: "control-implementation-added" | "control-implementation-updated" | "control-implementation-removed";
    riskDocumentId: string;
    assessmentDocumentId: string;
    implementation: RecordValue;
    fields: RiskHistoryEntry["changes"]["fields"];
  },
): Promise<void> {
  await recordRiskHistory(strapi, {
    kind: input.kind,
    riskDocumentId: input.riskDocumentId,
    assessmentDocumentId: input.assessmentDocumentId,
    actorDocumentId: input.actorDocumentId,
    ...historySourceFields(input.source),
    changes: { fields: input.fields, control: historyControl(input.implementation) },
  });
}

/*
 * The create, update and remove steps shared by the manual routes and the AI suggestion decisions (12-13, D-12;
 * Phase 16 D-07, D-19, D-20). They run inside the caller's withMutableAssessmentMutation, never their own: a nested
 * mutation would wait on the serialisation queue the caller already holds. Each refuses a withdrawn Risk
 * (RISK_WITHDRAWN) and records its change in the Risk's history in the caller's transaction.
 */
export async function createControlImplementationWithinMutation(
  strapi: ControlImplementationWorkflowStrapi,
  input: InnerHistoryInput & { riskDocumentId: string; assessmentDocumentId: string; body: unknown },
): Promise<RecordValue & { changed: boolean }> {
  const parsed = parseWritableControlImplementationFields(input.body);
  const authoritativeRisk = await requireRisk(strapi, input.riskDocumentId);
  if (authoritativeRisk.assessmentDocumentId !== input.assessmentDocumentId) {
    throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor changed.");
  }
  assertRiskActive(authoritativeRisk.risk);
  const data = await resolveReferences(strapi, parsed, true);
  const created = await strapi.documents(IMPLEMENTATION_UID).create({ data: {
    ...data,
    risk: input.riskDocumentId,
  } });
  const implementation = await loadProjectedImplementation(strapi, created);
  await recordImplementationHistory(strapi, {
    ...input,
    kind: "control-implementation-added",
    implementation,
    fields: controlImplementationChanges(null, implementation),
  });
  return { ...implementation, changed: true };
}

export async function updateControlImplementationWithinMutation(
  strapi: ControlImplementationWorkflowStrapi,
  input: InnerHistoryInput & { implementationDocumentId: string; riskDocumentId: string; assessmentDocumentId: string; body: unknown },
): Promise<RecordValue & { changed: boolean }> {
  const parsed = parseWritableControlImplementationFields(input.body);
  const authoritative = await requireImplementation(strapi, input.implementationDocumentId);
  if (!sameAncestor(authoritative.implementation, input.riskDocumentId, input.assessmentDocumentId)) {
    throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor changed.");
  }
  assertRiskActive(authoritative.implementation.risk);
  const data = await resolveReferences(strapi, parsed, false);
  const before = authoritative.implementation;
  // Relations compare by documentId, so whether anything changes is known before any label is read.
  if (controlImplementationChanges(before, { ...before, ...data }).length === 0) {
    return { ...(await loadProjectedImplementation(strapi, before)), changed: false };
  }
  const updated = await strapi.documents(IMPLEMENTATION_UID).update({
    documentId: input.implementationDocumentId,
    data,
  });
  const after = await loadProjectedImplementation(strapi, updated);
  const fields = controlImplementationChanges(before, after);
  if (fields.length === 0) return { ...after, changed: false };
  await recordImplementationHistory(strapi, { ...input, kind: "control-implementation-updated", implementation: after, fields });
  return { ...after, changed: true };
}

export async function removeControlImplementationWithinMutation(
  strapi: ControlImplementationWorkflowStrapi,
  input: InnerHistoryInput & { implementationDocumentId: string; riskDocumentId: string; assessmentDocumentId: string },
): Promise<{ documentId: string; changed: boolean }> {
  const authoritative = await requireImplementation(strapi, input.implementationDocumentId);
  if (!sameAncestor(authoritative.implementation, input.riskDocumentId, input.assessmentDocumentId)) {
    throw new ControlImplementationWorkflowError(409, "CSRM ControlImplementation ancestor changed.");
  }
  assertRiskActive(authoritative.implementation.risk);
  // D-20: the removal stays a hard delete of the implementation; its row keeps every value it held.
  await recordImplementationHistory(strapi, {
    ...input,
    kind: "control-implementation-removed",
    implementation: authoritative.implementation,
    fields: controlImplementationChanges(authoritative.implementation, null),
  });
  await strapi.documents(IMPLEMENTATION_UID).delete({ documentId: input.implementationDocumentId });
  return { documentId: input.implementationDocumentId, changed: true };
}

/* The writable fields of an implementation, relations as document ids: equal snapshots mean nobody changed it. */
export function controlImplementationWritableSnapshot(implementation: RecordValue): Record<string, string | null> {
  const text = (value: unknown): string | null => typeof value === "string" ? value : null;
  return {
    control: documentId(implementation.control),
    controlOwner: documentId(implementation.controlOwner),
    controlStatus: text(implementation.controlStatus),
    effectivenessRating: text(implementation.effectivenessRating),
    evidence: text(implementation.evidence),
    implementationDueDate: text(implementation.implementationDueDate),
    implementedDate: text(implementation.implementedDate),
    reviewDate: text(implementation.reviewDate),
  };
}

/* An implementation with its control and owner populated, or null when it no longer exists. */
export async function findControlImplementationForSnapshot(
  strapi: ControlImplementationWorkflowStrapi,
  implementationDocumentId: string,
): Promise<RecordValue | null> {
  return strapi.documents(IMPLEMENTATION_UID).findOne({
    documentId: implementationDocumentId,
    populate: { control: true, controlOwner: true, risk: true },
  });
}

/* The documentIds of the risk's control implementations (CR-02: whether the control a suggestion added is still there). */
export async function controlImplementationIdsForRisk(
  strapi: ControlImplementationWorkflowStrapi,
  riskDocumentId: string,
): Promise<Set<string>> {
  const rows = await strapi.documents(IMPLEMENTATION_UID).findMany({
    filters: { risk: { documentId: { $eq: riskDocumentId } } },
    limit: 1_000,
  });
  return new Set(rows.map((row) => documentId(row)).filter((id): id is string => id !== null));
}

/* The control document ids already implemented on the risk, so a suggestion of one of them changes nothing. */
export async function implementedControlIdsForRisk(
  strapi: ControlImplementationWorkflowStrapi,
  riskDocumentId: string,
): Promise<Set<string>> {
  const rows = await strapi.documents(IMPLEMENTATION_UID).findMany({
    filters: { risk: { documentId: { $eq: riskDocumentId } } },
    populate: { control: true },
    limit: 1_000,
  });
  return new Set(rows.map((row) => documentId(row.control)).filter((id): id is string => id !== null));
}

function withoutChanged(result: RecordValue & { changed: boolean }): RecordValue {
  const { changed: _changed, ...record } = result;
  return record;
}

export async function createRiskControlImplementation(input: {
  strapi: ControlImplementationWorkflowStrapi;
  riskDocumentId: string;
  analystDocumentId: string;
  body: unknown;
}): Promise<RecordValue> {
  assertDocumentId(input.riskDocumentId, "CSRM Risk identifier is invalid.");
  parseWritableControlImplementationFields(input.body);
  const { assessmentDocumentId } = await requireRisk(input.strapi, input.riskDocumentId);
  return withoutChanged(await withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    transition: (result) => result.changed ? "accepted-edit" : "none",
    mutate: () => createControlImplementationWithinMutation(input.strapi, {
      riskDocumentId: input.riskDocumentId,
      assessmentDocumentId,
      body: input.body,
      actorDocumentId: input.analystDocumentId,
      source: { kind: "analyst" },
    }),
  }));
}

export async function updateControlImplementation(input: {
  strapi: ControlImplementationWorkflowStrapi;
  implementationDocumentId: string;
  analystDocumentId: string;
  body: unknown;
}): Promise<RecordValue> {
  assertDocumentId(input.implementationDocumentId, "CSRM ControlImplementation identifier is invalid.");
  parseWritableControlImplementationFields(input.body);
  const candidate = await requireImplementation(input.strapi, input.implementationDocumentId);
  return withoutChanged(await withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId: candidate.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    // D-23: an edit that changes nothing withdraws no review.
    transition: (result) => result.changed ? "accepted-edit" : "none",
    mutate: () => updateControlImplementationWithinMutation(input.strapi, {
      implementationDocumentId: input.implementationDocumentId,
      riskDocumentId: candidate.riskDocumentId,
      assessmentDocumentId: candidate.assessmentDocumentId,
      body: input.body,
      actorDocumentId: input.analystDocumentId,
      source: { kind: "analyst" },
    }),
  }));
}

/*
 * CR-02 (D-12, UI-D12): an analyst who removes a Planned control that an AI suggestion added sends that suggestion back
 * to proposed, as its Undo does, and the run's history records the `restored` event, in the removal's transaction. So
 * the review record never says a removed control is added, and the analyst can add the suggestion again. A history that
 * can't take the event refuses the removal with AI_RUN_RECORD_UNAVAILABLE, and the transaction rolls it back (WR-103).
 */
async function restoreSuggestionsOfRemovedImplementationWithinMutation(
  strapi: ControlImplementationWorkflowStrapi,
  input: { implementationDocumentId: string; riskDocumentId: string; analystDocumentId: string },
): Promise<void> {
  const risk = await strapi.documents(RISK_UID).findOne({ documentId: input.riskDocumentId });
  const provenance = risk ? parseRiskAiProvenance(risk.aiProvenance) : null;
  if (!provenance) return;
  const at = new Date().toISOString();
  const outcome = restoreSuggestionsOfRemovedImplementation(provenance, input.implementationDocumentId, input.analystDocumentId, at);
  if (!outcome) return;
  await strapi.documents(RISK_UID).update({ documentId: input.riskDocumentId, data: { aiProvenance: outcome.provenance } });
  await appendAiRunDecisionsWithinMutation(strapi, provenance.runId, outcome.restored.map((item) => ({
    schemaVersion: 1 as const, kind: "restored" as const, at, by: input.analystDocumentId, target: input.riskDocumentId,
    item, implementation: input.implementationDocumentId,
  })));
}

export async function deleteControlImplementation(input: {
  strapi: ControlImplementationWorkflowStrapi;
  implementationDocumentId: string;
  analystDocumentId: string;
}): Promise<void> {
  assertDocumentId(input.implementationDocumentId, "CSRM ControlImplementation identifier is invalid.");
  const candidate = await requireImplementation(input.strapi, input.implementationDocumentId);
  await withMutableAssessmentMutation({
    strapi: input.strapi,
    assessmentDocumentId: candidate.assessmentDocumentId,
    analystDocumentId: input.analystDocumentId,
    transition: (result) => result.changed ? "accepted-edit" : "none",
    mutate: async () => {
      const removed = await removeControlImplementationWithinMutation(input.strapi, {
        implementationDocumentId: input.implementationDocumentId,
        riskDocumentId: candidate.riskDocumentId,
        assessmentDocumentId: candidate.assessmentDocumentId,
        actorDocumentId: input.analystDocumentId,
        source: { kind: "analyst" },
      });
      await restoreSuggestionsOfRemovedImplementationWithinMutation(input.strapi, {
        implementationDocumentId: input.implementationDocumentId,
        riskDocumentId: candidate.riskDocumentId,
        analystDocumentId: input.analystDocumentId,
      });
      return removed;
    },
  });
}
