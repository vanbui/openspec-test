import { administrationConfig, type AdministrationKind } from "./administration-config";
import { boundServedText, warnServedTextBounded } from "./served-text";

type RecordValue = Record<string, unknown>;

export const ADMINISTRATION_MAX_RECORDS = 65_536;
export const ADMINISTRATION_PAGE_SIZES = [10, 25, 50, 100] as const;
export const ADMINISTRATION_MAX_RELATIONS = 1_000;

export type AdministrationQuery = {
  q: string;
  sort: string;
  page: number;
  pageSize: typeof ADMINISTRATION_PAGE_SIZES[number];
  framework?: string;
  controlType?: "Preventive" | "Detective" | "Corrective" | "Compensating";
  environment?: "Production" | "Non-production";
  deploymentModel?: "On-prem" | "Cloud" | "SaaS";
  lifecycleState?: "New" | "Changed" | "Existing" | "Decommissioning";
  internetFacing?: boolean;
  dataClassification?: "Public" | "Internal" | "Restricted" | "Critical Infrastructure Sensitive";
  containsPersonalData?: boolean;
  containsLegalData?: boolean;
  containsCreditCardData?: boolean;
};

const CONTROL_TYPES = ["Preventive", "Detective", "Corrective", "Compensating"] as const;
const SYSTEM_ENVIRONMENTS = ["Production", "Non-production"] as const;
const DEPLOYMENT_MODELS = ["On-prem", "Cloud", "SaaS"] as const;
const LIFECYCLE_STATES = ["New", "Changed", "Existing", "Decommissioning"] as const;
const DATA_CLASSIFICATIONS = ["Public", "Internal", "Restricted", "Critical Infrastructure Sensitive"] as const;

export class AdministrationValidationError extends Error {
  constructor(message = "CSRM Administration data is invalid.") {
    super(message);
    this.name = "AdministrationValidationError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function entries(input: unknown): Array<[string, string]> {
  if (input instanceof URLSearchParams) return [...input.entries()];
  if (!isRecord(input)) throw new AdministrationValidationError("CSRM Administration query is invalid.");
  const result: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(input)) {
    if (typeof value !== "string" && typeof value !== "number") {
      throw new AdministrationValidationError("CSRM Administration query is invalid.");
    }
    result.push([key, String(value)]);
  }
  return result;
}

function positiveInteger(value: string | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(value)) throw new AdministrationValidationError("CSRM Administration query is invalid.");
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed > 1_000_000) throw new AdministrationValidationError("CSRM Administration query is invalid.");
  return parsed;
}

export function parseAdministrationQuery(kind: AdministrationKind | string, input: unknown): AdministrationQuery {
  const config = administrationConfig(kind);
  const queryEntries = entries(input);
  const allowed = new Set(["q", "sort", "page", "pageSize", ...Object.keys(config.filterColumns)]);
  const values = new Map<string, string>();
  for (const [key, value] of queryEntries) {
    if (!allowed.has(key) || values.has(key)) throw new AdministrationValidationError("CSRM Administration query is invalid.");
    values.set(key, value);
  }
  const q = (values.get("q") ?? "").trim();
  if (q.length > 200) throw new AdministrationValidationError("CSRM Administration query is invalid.");
  const sortText = values.get("sort") ?? config.defaultSort;
  const [field, direction, extra] = sortText.split(":");
  if (extra !== undefined || !(field in config.sortColumns) || (direction !== "asc" && direction !== "desc")) {
    throw new AdministrationValidationError("CSRM Administration query is invalid.");
  }
  const pageSize = positiveInteger(values.get("pageSize"), 25);
  if (!ADMINISTRATION_PAGE_SIZES.includes(pageSize as typeof ADMINISTRATION_PAGE_SIZES[number])) {
    throw new AdministrationValidationError("CSRM Administration query is invalid.");
  }
  const result: AdministrationQuery = {
    q,
    sort: `${field}:${direction}`,
    page: positiveInteger(values.get("page"), 1),
    pageSize: pageSize as typeof ADMINISTRATION_PAGE_SIZES[number],
  };
  if (kind === "controls") {
    const framework = values.get("framework")?.trim();
    if (framework !== undefined && (framework.length < 1 || framework.length > 255)) throw new AdministrationValidationError("CSRM Administration query is invalid.");
    const controlType = values.get("controlType");
    if (controlType !== undefined && !CONTROL_TYPES.includes(controlType as typeof CONTROL_TYPES[number])) throw new AdministrationValidationError("CSRM Administration query is invalid.");
    if (framework) result.framework = framework;
    if (controlType) result.controlType = controlType as AdministrationQuery["controlType"];
  }
  if (kind === "information-systems") {
    const environment = values.get("environment");
    const deploymentModel = values.get("deploymentModel");
    const lifecycleState = values.get("lifecycleState");
    const internetFacing = values.get("internetFacing");
    if (environment !== undefined && !SYSTEM_ENVIRONMENTS.includes(environment as typeof SYSTEM_ENVIRONMENTS[number])) throw new AdministrationValidationError("CSRM Administration query is invalid.");
    if (deploymentModel !== undefined && !DEPLOYMENT_MODELS.includes(deploymentModel as typeof DEPLOYMENT_MODELS[number])) throw new AdministrationValidationError("CSRM Administration query is invalid.");
    if (lifecycleState !== undefined && !LIFECYCLE_STATES.includes(lifecycleState as typeof LIFECYCLE_STATES[number])) throw new AdministrationValidationError("CSRM Administration query is invalid.");
    if (internetFacing !== undefined && internetFacing !== "true" && internetFacing !== "false") throw new AdministrationValidationError("CSRM Administration query is invalid.");
    if (environment) result.environment = environment as AdministrationQuery["environment"];
    if (deploymentModel) result.deploymentModel = deploymentModel as AdministrationQuery["deploymentModel"];
    if (lifecycleState) result.lifecycleState = lifecycleState as AdministrationQuery["lifecycleState"];
    if (internetFacing !== undefined) result.internetFacing = internetFacing === "true";
  }
  if (kind === "information-assets") {
    const dataClassification = values.get("dataClassification");
    if (dataClassification !== undefined && !DATA_CLASSIFICATIONS.includes(dataClassification as typeof DATA_CLASSIFICATIONS[number])) throw new AdministrationValidationError("CSRM Administration query is invalid.");
    if (dataClassification) result.dataClassification = dataClassification as AdministrationQuery["dataClassification"];
    for (const field of ["containsPersonalData", "containsLegalData", "containsCreditCardData"] as const) {
      const value = values.get(field);
      if (value !== undefined && value !== "true" && value !== "false") throw new AdministrationValidationError("CSRM Administration query is invalid.");
      if (value !== undefined) result[field] = value === "true";
    }
  }
  return result;
}

/** An Administration list's query as its export takes it (19-14; D-05): the list's filters, search and sort, never a page. */
export type AdministrationExportQuery = Omit<AdministrationQuery, "page" | "pageSize">;

/**
 * The export twin of parseAdministrationQuery (19-14; D-04, D-05): the same closed parser, refusing `page` and `pageSize`,
 * so an export holds exactly the records the list would page through.
 */
export function parseAdministrationExportQuery(kind: AdministrationKind | string, input: unknown): AdministrationExportQuery {
  if (entries(input).some(([key]) => key === "page" || key === "pageSize")) {
    throw new AdministrationValidationError("CSRM Administration query is invalid.");
  }
  const { page: _page, pageSize: _pageSize, ...query } = parseAdministrationQuery(kind, input);
  return query;
}

function trimmedText(value: unknown, max: number, nullable: boolean): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string") throw new AdministrationValidationError();
  const trimmed = value.trim();
  if (trimmed.length < 1 || trimmed.length > max) throw new AdministrationValidationError();
  return trimmed;
}

function relationIds(value: unknown): string[] {
  if (!Array.isArray(value) || value.length > ADMINISTRATION_MAX_RELATIONS) throw new AdministrationValidationError();
  const ids = value.map((entry) => {
    if (typeof entry !== "string") throw new AdministrationValidationError();
    const trimmed = entry.trim();
    if (trimmed.length < 1 || trimmed.length > 200 || !/^[A-Za-z0-9_-]+$/.test(trimmed)) throw new AdministrationValidationError();
    return trimmed;
  });
  if (new Set(ids).size !== ids.length) throw new AdministrationValidationError();
  return ids;
}

function documentId(value: unknown, nullable = true): string | null {
  if (nullable && value === null) return null;
  if (typeof value !== "string") throw new AdministrationValidationError();
  const trimmed = value.trim();
  if (!/^[A-Za-z0-9_-]{1,200}$/.test(trimmed)) throw new AdministrationValidationError();
  return trimmed;
}

function optionalEnum<T extends readonly string[]>(value: unknown, values: T): T[number] | null {
  if (value === null) return null;
  if (typeof value !== "string" || !values.includes(value as T[number])) throw new AdministrationValidationError();
  return value as T[number];
}

export function parseAdministrationMutation(
  kind: AdministrationKind | string,
  input: unknown,
  mode: "create" | "update" = "create",
): RecordValue {
  const config = administrationConfig(kind);
  if (!isRecord(input)) throw new AdministrationValidationError();
  const keys = Object.keys(input);
  if (keys.some((key) => !config.writableFields.includes(key)) || (mode === "update" && keys.length === 0)) {
    throw new AdministrationValidationError();
  }
  if (mode === "create" && (kind === "controls" ? !["controlNumber", "name", "framework"].every((key) => keys.includes(key)) : !keys.includes("name"))) throw new AdministrationValidationError();
  const result: RecordValue = {};
  if ("name" in input) result.name = trimmedText(input.name, 255, false);
  if ("description" in input) result.description = input.description === null ? null : trimmedText(input.description, 10_000, false);
  if (kind === "risk-types" && "applicableControls" in input) result.applicableControls = relationIds(input.applicableControls);
  if (kind === "controls") {
    if ("controlNumber" in input) result.controlNumber = trimmedText(input.controlNumber, 255, false);
    if ("controlType" in input) {
      if (input.controlType !== null && !CONTROL_TYPES.includes(input.controlType as typeof CONTROL_TYPES[number])) throw new AdministrationValidationError();
      result.controlType = input.controlType;
    }
    for (const [field, maxLength] of [["controlReference", 500], ["frameworkVersion", 255], ["frameworkSource", 2_000]] as const) {
      if (field in input) result[field] = input[field] === null ? null : trimmedText(input[field], maxLength, false);
    }
    if ("framework" in input) result.framework = trimmedText(input.framework, 255, false);
  }
  if (kind === "information-systems") {
    for (const field of ["systemType", "businessCriticality"] as const) {
      if (field in input) result[field] = input[field] === null ? null : trimmedText(input[field], 255, false);
    }
    if ("hostingLocation" in input) result.hostingLocation = input.hostingLocation === null ? null : trimmedText(input.hostingLocation, 500, false);
    if ("owner" in input) result.owner = documentId(input.owner);
    if ("environment" in input) result.environment = optionalEnum(input.environment, SYSTEM_ENVIRONMENTS);
    if ("deploymentModel" in input) result.deploymentModel = optionalEnum(input.deploymentModel, DEPLOYMENT_MODELS);
    if ("lifecycleState" in input) result.lifecycleState = optionalEnum(input.lifecycleState, LIFECYCLE_STATES);
    for (const field of ["internetFacing", "externalAccessRequired"] as const) {
      if (field in input) {
        if (typeof input[field] !== "boolean") throw new AdministrationValidationError();
        result[field] = input[field];
      }
    }
  }
  if (kind === "information-assets") {
    for (const [field, max] of [["location", 500], ["type", 255], ["confidentialityRating", 255], ["integrityRating", 255], ["availabilityRating", 255], ["comments", 10_000]] as const) {
      if (field in input) result[field] = input[field] === null ? null : trimmedText(input[field], max, false);
    }
    if ("dataClassification" in input) result.dataClassification = optionalEnum(input.dataClassification, DATA_CLASSIFICATIONS);
    for (const field of ["containsPersonalData", "containsLegalData", "containsCreditCardData"] as const) {
      if (field in input) {
        if (typeof input[field] !== "boolean") throw new AdministrationValidationError();
        result[field] = input[field];
      }
    }
  }
  return result;
}

export function normalizeAdministrationNaturalKey(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-AU");
}

/** The exact tier of an import's natural-key match (19-13; D-30): the trimmed key in Unicode NFC. */
export function administrationExactKey(value: string): string {
  return value.trim().normalize("NFC");
}

/**
 * The similar tier (19-13; D-30): NFKC, `en-AU` lower case and collapsed whitespace. A name equal to a stored one only
 * under this key is "Matched by similar name" and waits for a decision. JavaScript has no full case folding, so `ß`/`SS`
 * and the dotless `ı` are not folded (19-RESEARCH Pitfall 20). Uniqueness keeps normalizeAdministrationNaturalKey.
 */
export function administrationSimilarKey(value: string): string {
  return value.trim().normalize("NFKC").toLocaleLowerCase("en-AU").replace(/\s+/gu, " ");
}

function projectedControlIds(value: unknown): string[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.length > ADMINISTRATION_MAX_RELATIONS) throw new AdministrationValidationError();
  const ids = value.map((entry) => isRecord(entry) ? entry.documentId : entry);
  if (ids.some((entry) => typeof entry !== "string")) throw new AdministrationValidationError();
  return ids as string[];
}

/**
 * The Information System owner's display name (D-37): only the trimmed name crosses, bounded at 255.
 * An owner whose name is blank or beyond the bound has no name to serve, so the record reads null.
 */
function projectedOwnerName(owner: unknown): string | null {
  if (!isRecord(owner) || typeof owner.displayName !== "string") return null;
  const displayName = owner.displayName.trim();
  return displayName.length >= 1 && displayName.length <= 255 ? displayName : null;
}

/*
 * The bound on every text field a Controls record serves (ControlsAdministrationRecord in the specification;
 * the writes above refuse a value beyond the same bounds). The web's closed parser refuses a whole page for
 * one field beyond its bound, so a stored value no valid write could produce is served shortened, visibly.
 */
const CONTROL_RECORD_TEXT_BOUNDS = [
  ["controlNumber", 255],
  ["name", 255],
  ["description", 10_000],
  ["controlReference", 500],
  ["framework", 255],
  ["frameworkVersion", 255],
  ["frameworkSource", 2_000],
] as const;

function boundedControlRecord(record: RecordValue): RecordValue {
  const shortened: string[] = [];
  const bounded: RecordValue = { ...record };
  for (const [field, maxLength] of CONTROL_RECORD_TEXT_BOUNDS) {
    const value = record[field];
    if (typeof value === "string" && value.length > maxLength) {
      bounded[field] = boundServedText(value, maxLength);
      shortened.push(field);
    }
  }
  if (shortened.length > 0) {
    const controlNumber = typeof record.controlNumber === "string" && record.controlNumber.length <= 255 ? ` (${record.controlNumber})` : "";
    warnServedTextBounded(`CSRM control ${String(record.documentId)}${controlNumber}`, shortened);
  }
  return bounded;
}

export function projectAdministrationRecord(kind: AdministrationKind | string, input: RecordValue): RecordValue {
  if (typeof input.documentId !== "string" || typeof input.name !== "string") {
    throw new AdministrationValidationError("CSRM Administration record is invalid.");
  }
  const result: RecordValue = {
    documentId: input.documentId,
    name: input.name,
    description: typeof input.description === "string" ? input.description : null,
  };
  if (kind === "controls") {
    if (typeof input.controlNumber !== "string" || typeof input.framework !== "string") throw new AdministrationValidationError("CSRM Administration record is invalid.");
    return boundedControlRecord({
      ...result,
      controlNumber: input.controlNumber,
      controlType: CONTROL_TYPES.includes(input.controlType as typeof CONTROL_TYPES[number]) ? input.controlType : null,
      controlReference: typeof input.controlReference === "string" ? input.controlReference : null,
      framework: input.framework,
      frameworkVersion: typeof input.frameworkVersion === "string" ? input.frameworkVersion : null,
      frameworkSource: typeof input.frameworkSource === "string" ? input.frameworkSource : null,
    });
  }
  if (kind === "information-systems") {
    const owner = isRecord(input.owner) ? input.owner.documentId : input.owner;
    if (owner !== null && owner !== undefined && typeof owner !== "string") throw new AdministrationValidationError("CSRM Administration record is invalid.");
    if (typeof input.internetFacing !== "boolean" || typeof input.externalAccessRequired !== "boolean" || typeof input.updatedAt !== "string") throw new AdministrationValidationError("CSRM Administration record is invalid.");
    return {
      ...result,
      systemType: typeof input.systemType === "string" ? input.systemType : null,
      owner: typeof owner === "string" ? owner : null,
      ownerName: typeof owner === "string" ? projectedOwnerName(input.owner) : null,
      environment: SYSTEM_ENVIRONMENTS.includes(input.environment as typeof SYSTEM_ENVIRONMENTS[number]) ? input.environment : null,
      deploymentModel: DEPLOYMENT_MODELS.includes(input.deploymentModel as typeof DEPLOYMENT_MODELS[number]) ? input.deploymentModel : null,
      businessCriticality: typeof input.businessCriticality === "string" ? input.businessCriticality : null,
      internetFacing: input.internetFacing,
      externalAccessRequired: input.externalAccessRequired,
      hostingLocation: typeof input.hostingLocation === "string" ? input.hostingLocation : null,
      lifecycleState: LIFECYCLE_STATES.includes(input.lifecycleState as typeof LIFECYCLE_STATES[number]) ? input.lifecycleState : null,
      updatedAt: input.updatedAt,
    };
  }
  if (kind === "information-assets") {
    if (typeof input.containsPersonalData !== "boolean" || typeof input.containsLegalData !== "boolean" || typeof input.containsCreditCardData !== "boolean" || typeof input.updatedAt !== "string") throw new AdministrationValidationError("CSRM Administration record is invalid.");
    return {
      ...result,
      location: typeof input.location === "string" ? input.location : null,
      type: typeof input.type === "string" ? input.type : null,
      dataClassification: DATA_CLASSIFICATIONS.includes(input.dataClassification as typeof DATA_CLASSIFICATIONS[number]) ? input.dataClassification : null,
      confidentialityRating: typeof input.confidentialityRating === "string" ? input.confidentialityRating : null,
      integrityRating: typeof input.integrityRating === "string" ? input.integrityRating : null,
      availabilityRating: typeof input.availabilityRating === "string" ? input.availabilityRating : null,
      containsPersonalData: input.containsPersonalData,
      containsLegalData: input.containsLegalData,
      containsCreditCardData: input.containsCreditCardData,
      comments: typeof input.comments === "string" ? input.comments : null,
      updatedAt: input.updatedAt,
    };
  }
  const controls = projectedControlIds(input.applicableControls);
  if (controls !== undefined) result.applicableControls = controls;
  return result;
}
