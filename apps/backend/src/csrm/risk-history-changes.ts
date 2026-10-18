/*
 * The Risk history change envelope (Phase 16 D-18, D-19; the approved record "Risk History").
 *
 * One history row records one change to a Risk or to one of its control implementations. Its `changes` JSON is the
 * closed, versioned envelope v1 built and parsed here:
 *
 *   { schemaVersion: 1, fields: [{ field, from, to }] (at most 40), control?: { documentId, controlNumber, name } }
 *
 * - `riskChanges` and `controlImplementationChanges` list only the fields whose value differs after the update
 *   path's own normalisation (strings trimmed, an empty string as null, a relation compared by documentId and
 *   recorded as `{ documentId, label }` with the label it had at the time, a date as `YYYY-MM-DD`), so a value sent
 *   unchanged is not a change. Text is recorded whole: the history is the audit trail.
 * - `parseRiskHistoryChanges` is the read-side parser: closed, frozen, and it never throws. A malformed envelope is
 *   null and the read serves the row with `changes: null` rather than failing (the 06.8 posture).
 *
 * Gates read the current facts on the Risk (its `withdrawnAt`, its values) and never this history, which is
 * narrative only (D-18). The module is pure: it imports nothing from Strapi.
 */

export const RISK_HISTORY_KINDS = Object.freeze([
  "created",
  "updated",
  "withdrawn",
  "reinstated",
  "control-implementation-added",
  "control-implementation-updated",
  "control-implementation-removed",
] as const);

export type RiskHistoryKind = (typeof RISK_HISTORY_KINDS)[number];

export const RISK_HISTORY_SOURCES = Object.freeze(["analyst", "ai-run"] as const);

export type RiskHistorySource = (typeof RISK_HISTORY_SOURCES)[number];

export const RISK_HISTORY_CHANGES_SCHEMA_VERSION = 1 as const;

/** The most field changes one history row records. */
export const RISK_HISTORY_MAX_FIELDS = 40;

const FIELD_NAME_MAX_LENGTH = 64;
const DOCUMENT_ID_MAX_LENGTH = 255;

/** The Risk fields an analyst update writes, in the update path's order (`RISK_WRITABLE_FIELDS`). */
export const RISK_HISTORY_FIELDS = Object.freeze([
  "issueStatement", "riskStatement", "riskCategory", "riskSubCategory", "riskCause", "potentialImpact", "riskType", "riskOwner",
  "informationSystemImpacted", "informationAssetImpacted", "dataClassification", "inherentLikelihood", "highestInherentConsequence",
  "inherentRating", "inherentRatingRationale", "residualLikelihood", "highestResidualConsequence", "residualRating", "residualRatingRationale",
  "controlEffectiveness", "riskVelocity", "identifiedDate", "targetDate", "closureDate", "isExempted", "exemptionReviewDate",
  "escalationDetails", "comments", "riskCommunicationDate", "treatmentAction", "treatmentPlan", "treatmentOwner", "treatmentResolveDate",
  "treatmentStatus",
] as const);

/** The Risk relations a history row records with the label each has at the time of the change (D-19). */
export const RISK_HISTORY_RELATIONS_POPULATE = Object.freeze({
  riskType: true,
  riskOwner: true,
  informationSystemImpacted: true,
  informationAssetImpacted: true,
  treatmentOwner: true,
} as const);

/** The control implementation fields an analyst writes (`CONTROL_IMPLEMENTATION_WRITABLE_FIELDS`), in order. */
export const CONTROL_IMPLEMENTATION_HISTORY_FIELDS = Object.freeze([
  "control", "controlOwner", "controlStatus", "effectivenessRating", "evidence", "implementationDueDate", "implementedDate", "reviewDate",
] as const);

const RELATION_FIELDS: ReadonlySet<string> = new Set([
  "riskType", "riskOwner", "informationSystemImpacted", "informationAssetImpacted", "treatmentOwner", "control", "controlOwner",
]);

const DATE_FIELDS: ReadonlySet<string> = new Set([
  "identifiedDate", "targetDate", "closureDate", "riskCommunicationDate", "treatmentResolveDate",
  "implementationDueDate", "implementedDate", "reviewDate",
]);

const LABEL_KEYS = ["displayName", "name", "title", "label"] as const;

export type HistoryRelationValue = { readonly documentId: string; readonly label: string | null };

export type HistoryValue = string | number | boolean | null | HistoryRelationValue;

export type RiskHistoryFieldChange = { readonly field: string; readonly from: HistoryValue; readonly to: HistoryValue };

export type RiskHistoryControl = { readonly documentId: string; readonly controlNumber: string; readonly name: string };

export type RiskHistoryChangesV1 = {
  readonly schemaVersion: 1;
  readonly fields: readonly RiskHistoryFieldChange[];
  readonly control?: RiskHistoryControl;
};

export type HistoryChangeOptions = {
  /** The label a related record had at the time of the change; the related record's own name is the fallback. */
  relationLabel?: (field: string, documentId: string) => string | null | undefined;
};

type RecordValue = Record<string, unknown>;

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function ownLabel(value: unknown): string | null {
  if (!isRecord(value)) return null;
  for (const key of LABEL_KEYS) {
    const label = value[key];
    if (typeof label === "string" && label.trim().length > 0) return label.trim();
  }
  return null;
}

function relationValue(field: string, value: unknown, options?: HistoryChangeOptions): HistoryRelationValue | null {
  const documentId = typeof value === "string"
    ? value.trim()
    : isRecord(value) && typeof value.documentId === "string" ? value.documentId.trim() : "";
  if (documentId.length === 0) return null;
  const supplied = options?.relationLabel?.(field, documentId);
  const label = typeof supplied === "string" && supplied.trim().length > 0 ? supplied.trim() : ownLabel(value);
  return { documentId, label };
}

function dateValue(value: unknown): string | null {
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString().slice(0, 10) : null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return /^\d{4}-\d{2}-\d{2}/.test(trimmed) ? trimmed.slice(0, 10) : trimmed;
}

/**
 * One field's value as the history records it: a string trimmed (an empty one as null), a relation as
 * `{ documentId, label }`, a date as `YYYY-MM-DD`, a boolean or finite number as stored, anything else as null.
 */
export function normaliseHistoryValue(field: string, value: unknown, options?: HistoryChangeOptions): HistoryValue {
  if (value === null || value === undefined) return null;
  if (RELATION_FIELDS.has(field) || (isRecord(value) && "documentId" in value)) return relationValue(field, value, options);
  if (DATE_FIELDS.has(field)) return dateValue(value);
  if (value instanceof Date) return Number.isFinite(value.getTime()) ? value.toISOString() : null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  return null;
}

function sameHistoryValue(left: HistoryValue, right: HistoryValue): boolean {
  if (isRecord(left) || isRecord(right)) {
    return isRecord(left) && isRecord(right) && left.documentId === right.documentId;
  }
  return left === right;
}

function fieldOf(record: unknown, field: string): unknown {
  return isRecord(record) ? record[field] : undefined;
}

/** The changes between `before` and `after` over `fields`, in `fields` order; unchanged fields are left out. */
export function riskChanges(
  before: unknown,
  after: unknown,
  fields: readonly string[],
  options?: HistoryChangeOptions,
): RiskHistoryFieldChange[] {
  const changes: RiskHistoryFieldChange[] = [];
  for (const field of fields) {
    const from = normaliseHistoryValue(field, fieldOf(before, field), options);
    const to = normaliseHistoryValue(field, fieldOf(after, field), options);
    if (!sameHistoryValue(from, to)) changes.push({ field, from, to });
  }
  return changes;
}

/**
 * The changes of one control implementation: `before` null for an addition (each value with `from: null`), `after`
 * null for a removal (each value it held with `to: null`, so the record survives the removal), both given for an
 * update.
 */
export function controlImplementationChanges(
  before: unknown,
  after: unknown,
  options?: HistoryChangeOptions,
): RiskHistoryFieldChange[] {
  return riskChanges(before ?? null, after ?? null, CONTROL_IMPLEMENTATION_HISTORY_FIELDS, options);
}

function parseHistoryValue(value: unknown): HistoryValue | undefined {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 2 || !keys.includes("documentId") || !keys.includes("label")) return undefined;
  const { documentId, label } = value;
  if (typeof documentId !== "string" || documentId.length < 1 || documentId.length > DOCUMENT_ID_MAX_LENGTH) return undefined;
  if (label !== null && typeof label !== "string") return undefined;
  return Object.freeze({ documentId, label });
}

function parseFieldChange(value: unknown): RiskHistoryFieldChange | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 3 || !keys.includes("field") || !keys.includes("from") || !keys.includes("to")) return undefined;
  const { field } = value;
  if (typeof field !== "string" || field.length < 1 || field.length > FIELD_NAME_MAX_LENGTH) return undefined;
  const from = parseHistoryValue(value.from);
  const to = parseHistoryValue(value.to);
  if (from === undefined || to === undefined) return undefined;
  return Object.freeze({ field, from, to });
}

function parseControl(value: unknown): RiskHistoryControl | undefined {
  if (!isRecord(value)) return undefined;
  const keys = Object.keys(value);
  if (keys.length !== 3 || !keys.includes("documentId") || !keys.includes("controlNumber") || !keys.includes("name")) return undefined;
  const { documentId, controlNumber, name } = value;
  if (typeof documentId !== "string" || documentId.length < 1 || documentId.length > DOCUMENT_ID_MAX_LENGTH) return undefined;
  if (typeof controlNumber !== "string" || controlNumber.length < 1) return undefined;
  if (typeof name !== "string") return undefined;
  return Object.freeze({ documentId, controlNumber, name });
}

function parseEnvelope(value: unknown): RiskHistoryChangesV1 | null {
  if (!isRecord(value)) return null;
  const keys = Object.keys(value);
  if (!keys.every((key) => key === "schemaVersion" || key === "fields" || key === "control")) return null;
  if (value.schemaVersion !== RISK_HISTORY_CHANGES_SCHEMA_VERSION) return null;
  const rawFields = value.fields;
  if (!Array.isArray(rawFields) || rawFields.length > RISK_HISTORY_MAX_FIELDS) return null;
  const fields: RiskHistoryFieldChange[] = [];
  const seen = new Set<string>();
  for (const raw of rawFields) {
    const change = parseFieldChange(raw);
    if (!change || seen.has(change.field)) return null;
    seen.add(change.field);
    fields.push(change);
  }
  if (!keys.includes("control")) {
    return Object.freeze({ schemaVersion: RISK_HISTORY_CHANGES_SCHEMA_VERSION, fields: Object.freeze(fields) });
  }
  const control = parseControl(value.control);
  if (!control) return null;
  return Object.freeze({ schemaVersion: RISK_HISTORY_CHANGES_SCHEMA_VERSION, fields: Object.freeze(fields), control });
}

/** The frozen change envelope v1, or null for anything else. It never throws. */
export function parseRiskHistoryChanges(value: unknown): RiskHistoryChangesV1 | null {
  try {
    return parseEnvelope(value);
  } catch {
    return null;
  }
}

/**
 * Builds the change envelope v1 a history row stores. It throws on more than `RISK_HISTORY_MAX_FIELDS` fields, a
 * repeated field or any malformed change or control: a writer bug, never a client input.
 */
export function buildRiskHistoryChanges(input: {
  fields: readonly RiskHistoryFieldChange[];
  control?: RiskHistoryControl;
}): RiskHistoryChangesV1 {
  const candidate: RecordValue = { schemaVersion: RISK_HISTORY_CHANGES_SCHEMA_VERSION, fields: input.fields };
  if (input.control !== undefined) candidate.control = input.control;
  const envelope = parseEnvelope(candidate);
  if (!envelope) throw new Error("The Risk history change envelope is invalid.");
  return envelope;
}
