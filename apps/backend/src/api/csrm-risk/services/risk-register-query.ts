type RecordValue = Record<string, unknown>;

export const RISK_REGISTER_RATINGS = ["Low", "Moderate", "High", "Critical"] as const;
export const RISK_REGISTER_TREATMENT_STATUSES = ["Not Started", "In Progress", "Overdue", "Complete"] as const;
export const RISK_REGISTER_MITIGATION_STATUSES = ["Existing", "Planned", "Implemented", "Retired", "none"] as const;
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
  treatmentStatus?: typeof RISK_REGISTER_TREATMENT_STATUSES[number];
  inherentRating?: typeof RISK_REGISTER_RATINGS[number];
  residualRating?: typeof RISK_REGISTER_RATINGS[number];
  riskOwner?: string;
  treatmentOwner?: string;
  assessment?: string;
  system?: string;
  asset?: string;
  mitigationStatus?: typeof RISK_REGISTER_MITIGATION_STATUSES[number];
  targetDateFrom?: string;
  targetDateTo?: string;
};
export type RiskRegisterQuery = {
  filters: RiskRegisterFilters;
  sort: RiskRegisterSort;
  page: number;
  pageSize: 10 | 25 | 50;
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

function assertOnlyKeys(value: RecordValue): void {
  const allowed = new Set([
    "q", "treatmentStatus", "inherentRating", "residualRating", "riskOwner", "treatmentOwner",
    "assessment", "system", "asset", "mitigationStatus", "targetDateFrom", "targetDateTo", "sort", "page", "pageSize",
  ]);
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

export function parseRiskRegisterQuery(value: unknown): RiskRegisterQuery {
  if (!isRecord(value)) throw new RiskRegisterQueryError();
  assertOnlyKeys(value);
  const mitigationInput = value.mitigationStatus === "No mitigation controls" ? "none" : value.mitigationStatus;
  const filters: RiskRegisterFilters = {};
  const parsed = {
    q: searchText(value.q),
    treatmentStatus: enumValue(value.treatmentStatus, RISK_REGISTER_TREATMENT_STATUSES),
    inherentRating: enumValue(value.inherentRating, RISK_REGISTER_RATINGS),
    residualRating: enumValue(value.residualRating, RISK_REGISTER_RATINGS),
    riskOwner: opaqueId(value.riskOwner),
    treatmentOwner: opaqueId(value.treatmentOwner),
    assessment: opaqueId(value.assessment),
    system: opaqueId(value.system),
    asset: opaqueId(value.asset),
    mitigationStatus: enumValue(mitigationInput, RISK_REGISTER_MITIGATION_STATUSES),
    targetDateFrom: calendarDate(value.targetDateFrom),
    targetDateTo: calendarDate(value.targetDateTo),
  };
  for (const [key, entry] of Object.entries(parsed)) {
    if (entry !== undefined) (filters as RecordValue)[key] = entry;
  }
  const pageSize = positiveInteger(value.pageSize, 25);
  if (pageSize !== 10 && pageSize !== 25 && pageSize !== 50) throw new RiskRegisterQueryError();
  if (filters.targetDateFrom && filters.targetDateTo && filters.targetDateFrom > filters.targetDateTo) {
    throw new RiskRegisterQueryError();
  }
  return { filters, sort: sortValue(value.sort), page: positiveInteger(value.page, 1), pageSize };
}
