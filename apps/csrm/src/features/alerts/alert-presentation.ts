import { assessmentRequestHref } from '../assessments/assessment-domain';
import type { AlertItem, AlertKind, AlertSourceType, AlertUrgency } from './alert-schema';

/*
 * Every word the Alerts screen and the shared alert row show about an alert (UI-SPEC §3.2). The
 * server derives each alert, its urgency and its day count (D-02); these functions only word what
 * they are given, so no copy is assembled in JSX and the browser never compares dates.
 */

/** The alert type labels, used by the filter, its chip and wherever an alert type is named. */
export const alertKindLabels = {
  'risk-treatment-overdue': 'Treatment overdue',
  'risk-treatment-due-soon': 'Treatment due soon',
  'request-overdue': 'Request overdue',
  'request-due-soon': 'Request due soon',
  'control-implementation-overdue': 'Control Implementation overdue',
  'assessment-review-due': 'Risk Assessment review due',
  'critical-residual-risk-untreated': 'Critical Risk not treated',
  'ineffective-control': 'Ineffective Control Implementation',
} as const satisfies Record<AlertKind, string>;

/** The urgency labels (D-11), shared by the badge, the filter and its chip. */
export const alertUrgencyLabels = {
  overdue: 'Overdue',
  'due-soon': 'Due soon',
  attention: 'Needs attention',
} as const satisfies Record<AlertUrgency, string>;

const alertDateLabels = {
  'risk-treatment-overdue': 'Target date',
  'risk-treatment-due-soon': 'Target date',
  'request-overdue': 'Due date',
  'request-due-soon': 'Due date',
  'control-implementation-overdue': 'Implementation due',
  'assessment-review-due': 'Next review',
  'critical-residual-risk-untreated': 'Identified',
  'ineffective-control': 'Last reviewed',
} as const satisfies Record<AlertKind, string>;

const sourceTypeLabels = {
  risk: 'Risk',
  'assessment-request': 'Assessment Request',
  assessment: 'Risk Assessment',
  'control-implementation': 'Control Implementation',
} as const satisfies Record<AlertSourceType, string>;

const alertDateFormat = new Intl.DateTimeFormat('en-AU', { dateStyle: 'medium', timeZone: 'UTC' });

function dayCount(days: number): string {
  return days === 1 ? '1 day' : `${days} days`;
}

/** "{subject} overdue by {n} days", or the alert type alone when the server sent no day count. */
function overdueSentence(subject: string, dayOffset: number | null, kind: AlertKind): string {
  return dayOffset === null ? alertKindLabels[kind] : `${subject} overdue by ${dayCount(Math.abs(dayOffset))}`;
}

/** "{subject} due today" or "{subject} due in {n} days". */
function dueSoonSentence(subject: string, dayOffset: number | null, kind: AlertKind): string {
  if (dayOffset === null) return alertKindLabels[kind];
  const days = Math.abs(dayOffset);
  return days === 0 ? `${subject} due today` : `${subject} due in ${dayCount(days)}`;
}

/** What is wrong, in words: "Treatment overdue by 12 days". */
export function alertConditionSentence(alert: Pick<AlertItem, 'kind' | 'urgency' | 'dayOffset'>): string {
  const { dayOffset, kind } = alert;
  switch (kind) {
    case 'risk-treatment-overdue':
      return overdueSentence('Treatment', dayOffset, kind);
    case 'risk-treatment-due-soon':
      return dueSoonSentence('Treatment', dayOffset, kind);
    case 'request-overdue':
      return overdueSentence('Request', dayOffset, kind);
    case 'request-due-soon':
      return dueSoonSentence('Request', dayOffset, kind);
    case 'control-implementation-overdue':
      return overdueSentence('Control Implementation', dayOffset, kind);
    case 'assessment-review-due':
      // One kind, two urgencies: the server says which (D-11), the sentence follows it.
      return alert.urgency === 'overdue'
        ? overdueSentence('Review', dayOffset, kind)
        : dueSoonSentence('Review', dayOffset, kind);
    case 'critical-residual-risk-untreated':
      return 'Critical residual Risk with treatment not started';
    case 'ineffective-control':
      return 'Control Implementation rated Ineffective';
  }
}

/** Which date governs the alert: "Target date", "Next review" and so on. */
export function alertDateLabel(kind: AlertKind): string {
  return alertDateLabels[kind];
}

/** An ISO calendar date as en-AU medium text at UTC ("30 Oct 2026"), or "No date recorded". */
export function formatAlertDate(value: string | null): string {
  return value === null ? 'No date recorded' : alertDateFormat.format(new Date(`${value}T00:00:00.000Z`));
}

/**
 * The Security Analyst route for the alert's record. A Control Implementation opens its Risk at
 * the Mitigation controls section. Alerts are an analyst surface, so no Requestor route is used.
 */
export function alertSourceHref(alert: Pick<AlertItem, 'source' | 'link'>): string {
  const documentId = alert.link.documentId;
  switch (alert.link.type) {
    case 'risk': {
      const riskHref = `/app/risks/${encodeURIComponent(documentId)}`;
      return alert.source.type === 'control-implementation' ? `${riskHref}#mitigation-controls` : riskHref;
    }
    case 'assessment-request':
      return assessmentRequestHref('analyst', documentId);
    case 'assessment':
      return `/app/review/assessments/${encodeURIComponent(documentId)}`;
  }
}

/** The record type and its title ("Risk · {statement}"), or the type alone when there is no title. */
export function alertSourceSecondaryText(alert: Pick<AlertItem, 'source'>): string {
  const label = sourceTypeLabels[alert.source.type];
  const title = alert.source.title?.trim();
  return title ? `${label} · ${title}` : label;
}

export type AlertResidualDisplay =
  | { kind: 'rating'; rating: NonNullable<AlertItem['residualRating']> }
  | { kind: 'not-rated'; text: 'Not rated' }
  | { kind: 'not-applicable'; text: 'Not applicable' };

/**
 * The (parent) Risk's residual rating, shown beside the urgency and never merged into it (D-11).
 * Only Risk and Control Implementation sources have a Risk to rate.
 */
export function alertResidualDisplay(alert: Pick<AlertItem, 'source' | 'residualRating'>): AlertResidualDisplay {
  if (alert.source.type !== 'risk' && alert.source.type !== 'control-implementation') {
    return { kind: 'not-applicable', text: 'Not applicable' };
  }
  return alert.residualRating ? { kind: 'rating', rating: alert.residualRating } : { kind: 'not-rated', text: 'Not rated' };
}

/** D-27: an alert on released work states the fact and that the record is read-only. */
export function alertReleasedNote(alert: Pick<AlertItem, 'source'>): 'Released · read-only' | null {
  return alert.source.released ? 'Released · read-only' : null;
}

/** The cleared list's domain fact, with the due-soon window the server sent (never hard-coded). */
export function alertsClearedDescription(dueSoonWindowDays: number): string {
  return `Nothing is overdue, due within ${dayCount(dueSoonWindowDays)}, or flagged for attention.`;
}
