import { TREATMENT_DUE_STATES } from "../../../csrm/insights/treatment-due-state";

type RecordValue = Record<string, unknown>;

/** The rating ladder. A stored rating off it, or none at all, is "not rated" (research Pitfall 11). */
export const RISK_REGISTER_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;
/** D-35: the rating filters' vocabulary: the ladder, then "none" for a rating null or off the ladder (the reports' notRated). */
export const RISK_REGISTER_RATING_FILTERS = [...RISK_REGISTER_RATINGS, "none"] as const;
export const RISK_REGISTER_TREATMENT_STATUSES = ["Not Started", "In Progress", "Overdue", "Complete"] as const;
/** D-35: the treatment status filter's vocabulary: the JDL's four, then "none" for a status null or off them (the reports' notProvided). */
export const RISK_REGISTER_TREATMENT_STATUS_FILTERS = [...RISK_REGISTER_TREATMENT_STATUSES, "none"] as const;
/** "none": no mitigation control; "any": at least one, whatever its status (D-35). */
export const RISK_REGISTER_MITIGATION_STATUSES = ["Existing", "Planned", "Implemented", "Retired", "none", "any"] as const;
/** The JDL effectiveness ratings of a mitigation control (csrm-control-implementation effectivenessRating). */
export const RISK_REGISTER_EFFECTIVENESS_RATINGS = ["Effective", "Partially Effective", "Ineffective", "Not Assessed"] as const;
/**
 * D-35: a Risk with a mitigation control of this effectiveness; "none" one whose rating is null or off the JDL
 * vocabulary (the report's notProvided). A Risk with several mitigation controls can match several values.
 */
export const RISK_REGISTER_MITIGATION_EFFECTIVENESS = [...RISK_REGISTER_EFFECTIVENESS_RATINGS, "none"] as const;
/**
 * D-35, research Pitfall 21: "none" lists the Risks with no impacted Information System. It is its own key, so a
 * system documentId can never collide with it, and it is refused beside a chosen system.
 */
export const RISK_REGISTER_IMPACTED_SYSTEM = ["none"] as const;
/**
 * D-36: open means no closure date is recorded, closed means one is. Absent returns both. Phase 16 D-08: every one
 * of those reads active Risks only; `withdrawn` is the only value that lists withdrawn Risks, and no figure links to it.
 */
export const RISK_REGISTER_STATES = ["open", "closed", "withdrawn"] as const;
/**
 * D-40, D-44: the two branches of the register's scope (risk-register.ts applyReleasedParent and
 * applyUnderAssessmentParent). Absent returns both, which is the whole scope.
 */
export const RISK_REGISTER_STAGES = ["released", "under-assessment"] as const;
/** D-02 item 3, D-44: the JDL treatment action (csrm-risk treatmentAction), case and all. Absent returns every action. */
export const RISK_REGISTER_TREATMENT_ACTIONS = ["Accept", "Treat"] as const;
/**
 * D-02 item 3, D-35, G-16: the treatment due state of the one rule (treatment-due-state.ts), evaluated on the
 * list's UTC today with the 14-day due-soon window. Absent returns every Risk.
 */
export const RISK_REGISTER_DUE_STATES = TREATMENT_DUE_STATES;
export const RISK_REGISTER_SORT_FIELDS = [
  "riskNumber",
  "riskStatement",
  "inherentRating",
  "residualRating",
  "treatmentStatus",
  "treatmentOwner",
  "targetDate",
  "assessment",
] as const;

export type RiskRegisterSortField = typeof RISK_REGISTER_SORT_FIELDS[number];
export type RiskRegisterSort = { field: RiskRegisterSortField; direction: "asc" | "desc" };
export type RiskRegisterFilters = {
  q?: string;
  treatmentStatus?: typeof RISK_REGISTER_TREATMENT_STATUS_FILTERS[number];
  inherentRating?: typeof RISK_REGISTER_RATING_FILTERS[number];
  residualRating?: typeof RISK_REGISTER_RATING_FILTERS[number];
  riskOwner?: string;
  treatmentOwner?: string;
  assessment?: string;
  system?: string;
  asset?: string;
  mitigationStatus?: typeof RISK_REGISTER_MITIGATION_STATUSES[number];
  state?: typeof RISK_REGISTER_STATES[number];
  stage?: typeof RISK_REGISTER_STAGES[number];
  treatmentAction?: typeof RISK_REGISTER_TREATMENT_ACTIONS[number];
  dueState?: typeof RISK_REGISTER_DUE_STATES[number];
  mitigationEffectiveness?: typeof RISK_REGISTER_MITIGATION_EFFECTIVENESS[number];
  impactedSystem?: typeof RISK_REGISTER_IMPACTED_SYSTEM[number];
  targetDateFrom?: string;
  targetDateTo?: string;
};
export type RiskRegisterQuery = {
  filters: RiskRegisterFilters;
  sort: RiskRegisterSort;
  page: number;
  pageSize: 10 | 25 | 50;
};
/** The register's export query (19-04; D-05): the list's own filters and sort, and never a page. */
export type RiskRegisterExportQuery = {
  filters: RiskRegisterFilters;
  sort: RiskRegisterSort;
};

export class RiskRegisterQueryError extends Error {
  constructor() {
    super("CSRM Risk Register query is invalid.");
    this.name = "RiskRegisterQueryError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** The filter and sort keys the list and its export share. */
const FILTER_AND_SORT_KEYS = [
  "q", "treatmentStatus", "inherentRating", "residualRating", "riskOwner", "treatmentOwner",
  "assessment", "system", "asset", "stage", "treatmentAction", "dueState", "mitigationEffectiveness", "impactedSystem", "mitigationStatus", "state", "targetDateFrom", "targetDateTo", "sort",
] as const;
const LIST_KEYS: ReadonlySet<string> = new Set([...FILTER_AND_SORT_KEYS, "page", "pageSize"]);
/** D-05: an export is the whole list, so it takes no page and no pageSize. */
const EXPORT_KEYS: ReadonlySet<string> = new Set(FILTER_AND_SORT_KEYS);

function assertOnlyKeys(value: RecordValue, allowed: ReadonlySet<string>): void {
  if (Object.keys(value).some((key) => !allowed.has(key))) throw new RiskRegisterQueryError();
}

function scalar(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" && typeof value !== "number") throw new RiskRegisterQueryError();
  return String(value);
}

function enumValue<const T extends readonly string[]>(value: unknown, allowed: T): T[number] | undefined {
  const parsed = scalar(value);
  if (parsed === undefined) return undefined;
  if (!allowed.includes(parsed)) throw new RiskRegisterQueryError();
  return parsed as T[number];
}

function opaqueId(value: unknown): string | undefined {
  const parsed = scalar(value);
  if (parsed === undefined) return undefined;
  if (parsed.length < 1 || parsed.length > 200 || !/^[A-Za-z0-9_-]+$/.test(parsed)) throw new RiskRegisterQueryError();
  return parsed;
}

function positiveInteger(value: unknown, fallback: number): number {
  const parsedValue = scalar(value);
  if (parsedValue === undefined) return fallback;
  if (!/^[1-9]\d*$/.test(parsedValue)) throw new RiskRegisterQueryError();
  const parsed = Number(parsedValue);
  if (!Number.isSafeInteger(parsed) || parsed > 1_000_000) throw new RiskRegisterQueryError();
  return parsed;
}

function searchText(value: unknown): string | undefined {
  const parsed = scalar(value);
  if (parsed === undefined) return undefined;
  const trimmed = parsed.trim();
  if (trimmed.length < 1 || trimmed.length > 200) throw new RiskRegisterQueryError();
  return trimmed;
}

function calendarDate(value: unknown): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new RiskRegisterQueryError();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RiskRegisterQueryError();
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) throw new RiskRegisterQueryError();
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new RiskRegisterQueryError();
  }
  return value;
}

function sortValue(value: unknown): RiskRegisterSort {
  if (value === undefined) return { field: "targetDate", direction: "asc" };
  if (typeof value !== "string") throw new RiskRegisterQueryError();
  const [field, direction, extra] = value.split(":");
  if (extra !== undefined || !RISK_REGISTER_SORT_FIELDS.includes(field as RiskRegisterSortField)
    || (direction !== "asc" && direction !== "desc")) throw new RiskRegisterQueryError();
  return { field: field as RiskRegisterSortField, direction };
}

/** The closed filters and sort the list and its export both read; the caller has already checked the keys. */
function parseFiltersAndSort(value: RecordValue): RiskRegisterExportQuery {
  const mitigationInput = value.mitigationStatus === "No mitigation controls" ? "none" : value.mitigationStatus;
  const filters: RiskRegisterFilters = {};
  const parsed = {
    q: searchText(value.q),
    treatmentStatus: enumValue(value.treatmentStatus, RISK_REGISTER_TREATMENT_STATUS_FILTERS),
    inherentRating: enumValue(value.inherentRating, RISK_REGISTER_RATING_FILTERS),
    residualRating: enumValue(value.residualRating, RISK_REGISTER_RATING_FILTERS),
    riskOwner: opaqueId(value.riskOwner),
    treatmentOwner: opaqueId(value.treatmentOwner),
    assessment: opaqueId(value.assessment),
    system: opaqueId(value.system),
    asset: opaqueId(value.asset),
    mitigationStatus: enumValue(mitigationInput, RISK_REGISTER_MITIGATION_STATUSES),
    state: enumValue(value.state, RISK_REGISTER_STATES),
    stage: enumValue(value.stage, RISK_REGISTER_STAGES),
    treatmentAction: enumValue(value.treatmentAction, RISK_REGISTER_TREATMENT_ACTIONS),
    dueState: enumValue(value.dueState, RISK_REGISTER_DUE_STATES),
    mitigationEffectiveness: enumValue(value.mitigationEffectiveness, RISK_REGISTER_MITIGATION_EFFECTIVENESS),
    impactedSystem: enumValue(value.impactedSystem, RISK_REGISTER_IMPACTED_SYSTEM),
    targetDateFrom: calendarDate(value.targetDateFrom),
    targetDateTo: calendarDate(value.targetDateTo),
  };
  for (const [key, entry] of Object.entries(parsed)) {
    if (entry !== undefined) (filters as RecordValue)[key] = entry;
  }
  if (filters.targetDateFrom && filters.targetDateTo && filters.targetDateFrom > filters.targetDateTo) {
    throw new RiskRegisterQueryError();
  }
  // No impacted system and a chosen system can never both hold (research Pitfall 21).
  if (filters.impactedSystem && filters.system) throw new RiskRegisterQueryError();
  return { filters, sort: sortValue(value.sort) };
}

export function parseRiskRegisterQuery(value: unknown): RiskRegisterQuery {
  if (!isRecord(value)) throw new RiskRegisterQueryError();
  assertOnlyKeys(value, LIST_KEYS);
  const pageSize = positiveInteger(value.pageSize, 25);
  if (pageSize !== 10 && pageSize !== 25 && pageSize !== 50) throw new RiskRegisterQueryError();
  const { filters, sort } = parseFiltersAndSort(value);
  return { filters, sort, page: positiveInteger(value.page, 1), pageSize };
}

/**
 * The register's export query (19-04; D-05): exactly the list's filters and sort, parsed by the same closed rules,
 * and a refusal for `page` or `pageSize`, because an export is the whole filtered list.
 */
export function parseRiskRegisterExportQuery(value: unknown): RiskRegisterExportQuery {
  if (!isRecord(value)) throw new RiskRegisterQueryError();
  assertOnlyKeys(value, EXPORT_KEYS);
  return parseFiltersAndSort(value);
}
