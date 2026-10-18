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
 * D-35, research Pitfall 11: the rating and treatment status filters add "none", which the server reads as a value
 * null or off its vocabulary, exactly as the reports count Not rated and Not provided. The rows keep the closed
 * vocabularies above.
 */
export const riskRegisterRatingFilterValues = [...riskRegisterRatings, 'none'] as const;
export type RiskRegisterRatingFilter = (typeof riskRegisterRatingFilterValues)[number];
export const riskRegisterTreatmentStatusFilterValues = [...riskRegisterTreatmentStatuses, 'none'] as const;
export type RiskRegisterTreatmentStatusFilter = (typeof riskRegisterTreatmentStatusFilterValues)[number];
/** UI-SPEC §9.5: a rating filter's words; "none" reads Not rated. */
export function riskRegisterRatingFilterLabel(value: RiskRegisterRatingFilter): string {
  return value === 'none' ? 'Not rated' : value;
}
/** UI-SPEC §9.5: the words for a treatment status filter of "none"; the four statuses read through the shared status mapping. */
export const riskRegisterTreatmentStatusNoneLabel = 'Not provided';
/**
 * The server-derived treatment due state of a register row (D-04, D-26). The
 * server evaluates it on its UTC date; the client renders it and never compares
 * dates itself.
 */
export const riskTreatmentDueStates = ['overdue', 'due-soon', 'later', 'no-target-date', 'complete-or-closed'] as const;
export type RiskTreatmentDueState = (typeof riskTreatmentDueStates)[number];
/** D-35, UI-SPEC §9.5: the Due state filter's words for each state; the server applies the one rule. */
export const riskTreatmentDueStateLabels = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  later: 'Due later',
  'no-target-date': 'No target date',
  'complete-or-closed': 'Complete or closed',
} as const satisfies Record<RiskTreatmentDueState, string>;
/** "none": no mitigation control; "any": at least one, whatever its status (D-35). */
export const riskRegisterMitigationStatuses = ['Existing', 'Planned', 'Implemented', 'Retired', 'none', 'any'] as const;
export const riskRegisterMitigationStatusLabels = {
  Existing: 'Existing',
  Planned: 'Planned',
  Implemented: 'Implemented',
  Retired: 'Retired',
  none: 'No mitigation controls',
  any: 'Any mitigation control',
} as const satisfies Record<(typeof riskRegisterMitigationStatuses)[number], string>;
/**
 * D-35: a Risk with a mitigation control of this effectiveness; "none", one whose rating is not recorded. A Risk
 * with several mitigation controls can match several values, so these lists never sum to the register.
 */
export const riskRegisterEffectivenessValues = ['Effective', 'Partially Effective', 'Ineffective', 'Not Assessed', 'none'] as const;
export const riskRegisterEffectivenessLabels = {
  Effective: 'Effective',
  'Partially Effective': 'Partially Effective',
  Ineffective: 'Ineffective',
  'Not Assessed': 'Not Assessed',
  none: 'Not provided',
} as const satisfies Record<(typeof riskRegisterEffectivenessValues)[number], string>;
/** D-35, research Pitfall 21: "none" lists the Risks with no impacted system; it never travels with a chosen system. */
export const riskRegisterImpactedSystemValues = ['none'] as const;
/** D-36: open means no closure date is recorded, closed means one is. Absent means both. */
/** Open and closed read active Risks only; withdrawn lists the withdrawn Risks alone (Phase 16 D-08, UI-D9). */
export const riskRegisterStates = ['open', 'closed', 'withdrawn'] as const;
export const riskRegisterStateLabels = {
  open: 'Open',
  closed: 'Closed',
  withdrawn: 'Withdrawn',
} as const satisfies Record<(typeof riskRegisterStates)[number], string>;
/** 16-UI-SPEC §11.1: the Risk state filter's default, which lists open and closed Risks and never a withdrawn one. */
export const riskRegisterStateDefaultLabel = 'Open and closed';
/** 16-UI-SPEC §11.2: the notice above the register while it lists withdrawn Risks (D-08, D-45). */
export const riskRegisterWithdrawnNotice = 'Withdrawn risks don’t count in any assessment, figure or export. Only Security Analysts see them.';
/**
 * D-40, D-44: the two branches of the register's scope, decided by the server from the Risk's assessment.
 * Released: the assessment carries the complete release facts. Under assessment: a draft or in-review
 * assessment with none. Absent means both, which is every Risk the register lists.
 */
export const riskRegisterStages = ['released', 'under-assessment'] as const;
export type RiskRegisterStage = (typeof riskRegisterStages)[number];
export const riskRegisterStageLabels = {
  released: 'Released',
  'under-assessment': 'Under assessment',
} as const satisfies Record<RiskRegisterStage, string>;
/** D-02 item 3, D-44: the JDL treatment action, shown as recorded. */
export const riskTreatmentActions = ['Accept', 'Treat'] as const;
export type RiskTreatmentAction = (typeof riskTreatmentActions)[number];
type RiskRegisterMarkerRow = { stage: RiskRegisterStage; treatmentAction: RiskTreatmentAction | null; accepted?: boolean };
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

/** The words a register row carries for the Risk's stage, under its Related assessment link (UI-SPEC §9.5); never colour alone. */
export function riskRegisterStageMarker(row: { stage: RiskRegisterStage }): string {
  return riskRegisterStageLabels[row.stage];
}

/**
 * D-41, D-44: Accepted is the interim marker of the released treatment action, on a released Risk whose action
 * is Accept and has no closure date. Strapi supplies this fact, including openness; a client never guesses it.
 */
export function isAcceptedRiskRow(row: RiskRegisterMarkerRow): boolean {
  return row.accepted === true;
}

/** The card's one marker line: the stage, then " · Accepted" for an accepted Risk (UI-SPEC §9.5). */
export function riskRegisterCardMarker(row: RiskRegisterMarkerRow): string {
  return isAcceptedRiskRow(row) ? `${riskRegisterStageMarker(row)} · Accepted` : riskRegisterStageMarker(row);
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
  const system = opaqueId(input.system);
  return {
    q,
    treatmentStatus: oneOf(riskRegisterTreatmentStatusFilterValues, input.treatmentStatus),
    inherentRating: oneOf(riskRegisterRatingFilterValues, input.inherentRating),
    residualRating: oneOf(riskRegisterRatingFilterValues, input.residualRating),
    riskOwner: opaqueId(input.riskOwner),
    treatmentOwner: opaqueId(input.treatmentOwner),
    assessment: opaqueId(input.assessment),
    system,
    asset: opaqueId(input.asset),
    mitigationStatus: oneOf(riskRegisterMitigationStatuses, input.mitigationStatus),
    state: oneOf(riskRegisterStates, input.state),
    stage: oneOf(riskRegisterStages, input.stage),
    treatmentAction: oneOf(riskTreatmentActions, input.treatmentAction),
    dueState: oneOf(riskTreatmentDueStates, input.dueState),
    mitigationEffectiveness: oneOf(riskRegisterEffectivenessValues, input.mitigationEffectiveness),
    // A chosen system wins over no impacted system, which Strapi refuses beside it.
    impactedSystem: system ? undefined : oneOf(riskRegisterImpactedSystemValues, input.impactedSystem),
    targetDateFrom,
    targetDateTo,
    sort: oneOf(riskRegisterSortValues, input.sort) ?? 'targetDate:asc',
    page: Number.isInteger(page) && page >= 1 && page <= 1_000_000 ? page : 1,
    pageSize: pageSize === 10 || pageSize === 25 || pageSize === 50 ? pageSize : 25,
  };
}
