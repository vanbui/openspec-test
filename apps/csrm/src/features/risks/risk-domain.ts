import type { RiskRegisterQuery } from './risk-schema';

/*
 * The Risk Register's vocabularies and pure helpers, free of zod (plan 08-13, D-24). The register's
 * client components, its loading state and the analyst dashboard read them from here, so none of
 * those pages downloads the validation library; risk-schema.ts builds its parsers from the same
 * values and re-exports them for server code.
 */

export const riskRegisterRatings = ['Low', 'Moderate', 'High', 'Critical'] as const;
export const riskRegisterTreatmentStatuses = ['Not Started', 'In Progress', 'Overdue', 'Complete'] as const;
/**
 * The server-derived treatment due state of a register row (D-04, D-26). The
 * server evaluates it on its UTC date; the client renders it and never compares
 * dates itself.
 */
export const riskTreatmentDueStates = ['overdue', 'due-soon', 'later', 'no-target-date', 'complete-or-closed'] as const;
export type RiskTreatmentDueState = (typeof riskTreatmentDueStates)[number];
export const riskRegisterMitigationStatuses = ['Existing', 'Planned', 'Implemented', 'Retired', 'none'] as const;
/** D-36: open means no closure date is recorded, closed means one is. Absent means both. */
export const riskRegisterStates = ['open', 'closed'] as const;
export const riskRegisterStateLabels = {
  open: 'Open',
  closed: 'Closed',
} as const satisfies Record<(typeof riskRegisterStates)[number], string>;
export const riskRegisterSortValues = [
  'riskNumber:asc', 'riskNumber:desc', 'riskStatement:asc', 'riskStatement:desc',
  'inherentRating:asc', 'inherentRating:desc', 'residualRating:asc', 'residualRating:desc',
  'treatmentStatus:asc', 'treatmentStatus:desc', 'treatmentOwner:asc', 'treatmentOwner:desc',
  'targetDate:asc', 'targetDate:desc', 'assessment:asc', 'assessment:desc',
] as const;

export type RiskPickerOption = { documentId: string; label: string };

/** The value itself when it is a real `YYYY-MM-DD` calendar date, otherwise undefined. */
export function calendarDate(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return undefined;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1) return undefined;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
    ? value
    : undefined;
}

export function formatRiskTargetDate(value: string | null): string {
  if (value === null) return 'No target date';
  return new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' }).format(new Date(`${value}T00:00:00.000Z`));
}

const firstValue = (value: unknown): unknown => Array.isArray(value) ? value[0] : value;
const oneOf = <T extends string>(values: readonly T[], value: unknown): T | undefined => {
  const first = firstValue(value);
  return typeof first === 'string' && (values as readonly string[]).includes(first) ? first as T : undefined;
};
const opaqueId = (value: unknown): string | undefined => {
  const first = firstValue(value);
  const trimmed = typeof first === 'string' ? first.trim() : '';
  return trimmed.length >= 1 && trimmed.length <= 200 && /^[A-Za-z0-9_-]+$/.test(trimmed) ? trimmed : undefined;
};
const targetDate = (value: unknown, field: 'targetDateFrom' | 'targetDateTo'): string | undefined => {
  if (value === undefined) return undefined;
  if (calendarDate(value) !== value) throw new Error(`RISK_REGISTER_QUERY_INVALID:${field}`);
  return value as string;
};

/**
 * The register's URL read without zod, for the loading state the browser renders before the page
 * arrives. It reads exactly as `parseRiskRegisterQuery` does (risk-domain.test.ts holds the two to
 * the same results): an unknown value falls back to its default, and an impossible target date or a
 * range whose start follows its end is refused.
 */
export function readRiskRegisterQuery(input: Record<string, unknown>): RiskRegisterQuery {
  const text = firstValue(input.q);
  const q = typeof text === 'string' && text.trim().length <= 200 ? text.trim() : '';
  const targetDateFrom = targetDate(input.targetDateFrom, 'targetDateFrom');
  const targetDateTo = targetDate(input.targetDateTo, 'targetDateTo');
  if (targetDateFrom && targetDateTo && targetDateFrom > targetDateTo) throw new Error('RISK_REGISTER_QUERY_INVALID:targetDateTo');
  const page = Number(firstValue(input.page));
  const pageSize = Number(firstValue(input.pageSize));
  return {
    q,
    treatmentStatus: oneOf(riskRegisterTreatmentStatuses, input.treatmentStatus),
    inherentRating: oneOf(riskRegisterRatings, input.inherentRating),
    residualRating: oneOf(riskRegisterRatings, input.residualRating),
    riskOwner: opaqueId(input.riskOwner),
    treatmentOwner: opaqueId(input.treatmentOwner),
    assessment: opaqueId(input.assessment),
    system: opaqueId(input.system),
    asset: opaqueId(input.asset),
    mitigationStatus: oneOf(riskRegisterMitigationStatuses, input.mitigationStatus),
    state: oneOf(riskRegisterStates, input.state),
    targetDateFrom,
    targetDateTo,
    sort: oneOf(riskRegisterSortValues, input.sort) ?? 'targetDate:asc',
    page: Number.isInteger(page) && page >= 1 && page <= 1_000_000 ? page : 1,
    pageSize: pageSize === 10 || pageSize === 25 || pageSize === 50 ? pageSize : 25,
  };
}
