import { ALERT_KINDS, ALERT_URGENCIES, type AlertKind, type AlertUrgency } from "../../../csrm/insights/alert-rules";
import { ALERT_DEFAULT_PAGE_SIZE, ALERT_PAGE_SIZES } from "../../../csrm/insights/insight-constants";

/*
 * The closed alert query (D-12). Every accepted value is a member of a closed
 * vocabulary or matches a closed pattern, so nothing a caller sends reaches the
 * SQL except as one of those members. Anything else is one safe 400.
 */

type RecordValue = Record<string, unknown>;

export type AlertPageSize = typeof ALERT_PAGE_SIZES[number];

export type AlertListQuery = {
  /** One to eight unique kinds, always in the closed ALERT_KINDS order. */
  kinds: readonly AlertKind[];
  urgency: AlertUrgency | undefined;
  page: number;
  pageSize: AlertPageSize;
};

/** The largest page a caller may ask for, as on the Risk Register. */
const MAX_ALERT_PAGE = 1_000_000;

const LIST_QUERY_KEYS: ReadonlySet<string> = new Set(["kind", "urgency", "page", "pageSize"]);
const KIND_SET: ReadonlySet<string> = new Set(ALERT_KINDS);
const URGENCY_SET: ReadonlySet<string> = new Set(ALERT_URGENCIES);

export class AlertQueryError extends Error {
  constructor() {
    super("CSRM alert query is invalid.");
    this.name = "AlertQueryError";
  }
}

function isRecord(value: unknown): value is RecordValue {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** `kind` is one string or a list of strings. An object, such as an operator, is refused. */
function parseKinds(value: unknown): readonly AlertKind[] {
  if (value === undefined) return [...ALERT_KINDS];
  const values = typeof value === "string" ? [value] : value;
  if (!Array.isArray(values) || values.length < 1 || values.length > ALERT_KINDS.length) throw new AlertQueryError();
  const requested = new Set<string>();
  for (const entry of values) {
    if (typeof entry !== "string" || !KIND_SET.has(entry) || requested.has(entry)) throw new AlertQueryError();
    requested.add(entry);
  }
  return ALERT_KINDS.filter((kind) => requested.has(kind));
}

function parseUrgency(value: unknown): AlertUrgency | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string" || !URGENCY_SET.has(value)) throw new AlertQueryError();
  return value as AlertUrgency;
}

function parsePage(value: unknown): number {
  if (value === undefined) return 1;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw new AlertQueryError();
  const page = Number(value);
  if (!Number.isSafeInteger(page) || page > MAX_ALERT_PAGE) throw new AlertQueryError();
  return page;
}

function parsePageSize(value: unknown): AlertPageSize {
  if (value === undefined) return ALERT_DEFAULT_PAGE_SIZE;
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) throw new AlertQueryError();
  const pageSize = ALERT_PAGE_SIZES.find((size) => size === Number(value));
  if (pageSize === undefined) throw new AlertQueryError();
  return pageSize;
}

/** GET /api/v1/alerts: `kind` (repeatable), `urgency`, `page` and `pageSize`, and nothing else. */
export function parseAlertListQuery(query: unknown): AlertListQuery {
  if (!isRecord(query) || Object.keys(query).some((key) => !LIST_QUERY_KEYS.has(key))) throw new AlertQueryError();
  return {
    kinds: parseKinds(query.kind),
    urgency: parseUrgency(query.urgency),
    page: parsePage(query.page),
    pageSize: parsePageSize(query.pageSize),
  };
}

/** An insight operation that takes no query refuses every key before it reads anything. */
export function assertEmptyInsightQuery(query: unknown): void {
  if (!isRecord(query) || Object.keys(query).length > 0) throw new AlertQueryError();
}
