import type { components } from '../../lib/api/generated/schema';

type Schemas = components['schemas'];

/*
 * The alert vocabularies and the Alerts screen's URL reader, with no zod (UI-SPEC Notes carried). A client module
 * that imports a value from a module defining a zod schema downloads the whole library, so the Alerts list reads
 * these from here; `alert-schema.ts` re-exports them beside the transport schemas, which keep the contract checks.
 */
export const alertKinds = [
  'risk-treatment-overdue',
  'risk-treatment-due-soon',
  'request-overdue',
  'request-due-soon',
  'control-implementation-overdue',
  'assessment-review-due',
  'critical-residual-risk-untreated',
  'ineffective-control',
] as const satisfies readonly Schemas['AlertKind'][];
export type AlertKind = (typeof alertKinds)[number];

export const alertUrgencies = ['overdue', 'due-soon', 'attention'] as const satisfies readonly Schemas['AlertUrgency'][];
export type AlertUrgency = (typeof alertUrgencies)[number];

/** The highest page the alert list accepts. */
export const MAX_ALERT_PAGE = 1_000_000;

/** The page sizes the Alerts screen offers; any other reads as the default. */
export type AlertListUrlPageSize = 10 | 25 | 50;
export type AlertListUrlQuery = { kind?: AlertKind; urgency?: AlertUrgency; page: number; pageSize: AlertListUrlPageSize };

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value;

function member<Value extends string>(values: readonly Value[], value: unknown): Value | undefined {
  return values.find((candidate) => candidate === value);
}

/**
 * The Alerts screen's URL (`?kind=`, `?urgency=`, `?page=`, `?pageSize=`). The screen filters by one kind at a
 * time. An unknown kind or urgency reads as all, a page outside 1 to MAX_ALERT_PAGE reads as 1, and any page size
 * other than 10, 25 or 50 reads as 25, as the other list filters do. Any other parameter is ignored.
 */
export function readAlertListUrlQuery(params: Readonly<Record<string, unknown>>): AlertListUrlQuery {
  const kind = member(alertKinds, firstValue(params.kind));
  const urgency = member(alertUrgencies, firstValue(params.urgency));
  const page = Number(firstValue(params.page));
  const pageSize = Number(firstValue(params.pageSize));
  return {
    ...(kind ? { kind } : {}),
    ...(urgency ? { urgency } : {}),
    page: Number.isInteger(page) && page >= 1 && page <= MAX_ALERT_PAGE ? page : 1,
    pageSize: pageSize === 10 || pageSize === 25 || pageSize === 50 ? pageSize : 25,
  };
}
