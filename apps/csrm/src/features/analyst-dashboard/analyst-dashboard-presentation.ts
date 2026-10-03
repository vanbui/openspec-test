import type { LucideIcon } from 'lucide-react';
import {
  BellIcon,
  CalendarClockIcon,
  CalendarDaysIcon,
  CalendarX2Icon,
  ChartBarIcon,
  FlagIcon,
  HistoryIcon,
  InboxIcon,
  Table2Icon,
  TimerIcon,
} from 'lucide-react';

import type { BarChartTone } from '@/components/csrm/bar-chart';
import type { KpiTileIconTone } from '@/components/csrm/kpi-tile';
import { alertsClearedDescription } from '../alerts/alert-presentation';
import { assessmentRequestHref } from '../assessments/assessment-domain';
import type { AssessmentRating } from '../assessments/assessment-schema';
import { formatRiskTargetDate } from '../risks/risk-domain';
import type { ActivityItem, ActivityKind, ActivityRecordType, DashboardReviewQueue, DashboardSummary } from './analyst-dashboard-schema';
import type {
  AnalystDashboard,
  AnalystDashboardUnits,
  DashboardAlertList,
  DashboardKpiCounts,
} from './analyst-dashboard-service';

/*
 * Every word, link and row the analyst dashboard shows (UI-SPEC §2, §7.2). Strapi computes every
 * figure, due state, order and date (D-02, D-34); these functions only word, link and format what
 * the dashboard carries, so no copy is assembled in JSX and the browser never re-derives a count.
 */

const countFormat = new Intl.NumberFormat('en-AU');

function formatCount(value: number): string {
  return countFormat.format(value);
}

/** "{n} {noun}", singular for exactly one. */
function counted(value: number, one: string, other: string): string {
  return `${formatCount(value)} ${value === 1 ? one : other}`;
}

/** The due-soon window in words: "1 day", "14 days". */
function days(window: number): string {
  return counted(window, 'day', 'days');
}

/*
 * The analyst Home's own words (UI-SPEC §5.4). Its heading and description are Home's, shared with the
 * Requestor Home (home-page-header.tsx), so the review summary names no page of its own.
 */
export const analystDashboardCopy = {
  loadingLabel: 'Loading Home',
  /** The noun the page error names and the area the permission state identifies. */
  area: 'the review summary',
  needsAction: 'Needs action',
  /** The KPI strip's error noun (§7.2). */
  summaryCountsNoun: 'the summary counts',
} as const;

/** The permission state's way out. It renders on Home, so a link back to Home would loop (UI-D19). */
export const analystHomePermissionAction = { label: 'Return to sign in', href: '/sign-in' } as const;

/* ---------------------------------------------------------------- KPI strip */

export type DashboardKpiTile = {
  key: 'requires-attention' | 'overdue' | 'due-soon' | 'attention';
  caption: string;
  value: number;
  supportingText: string;
  href: string;
  icon: LucideIcon;
  iconTone: KpiTileIconTone;
};

/**
 * The four Needs action tiles (UI-SPEC §2.3). Each opens a list whose total is computed with the
 * tile's own predicate (D-18, D-24); the caption icons are the urgency set, so a tile matches the
 * badges on the list it opens. No tile carries a delta (UI-D6).
 */
export function dashboardKpiTiles(counts: DashboardKpiCounts, dueSoonWindowDays: number): DashboardKpiTile[] {
  return [
    {
      key: 'requires-attention',
      caption: 'Requires my attention',
      value: counts.requiresAttention,
      supportingText: 'Assessment Requests in your review queue',
      href: '/app/review/requests',
      icon: InboxIcon,
      iconTone: 'muted',
    },
    {
      key: 'overdue',
      caption: 'Overdue',
      value: counts.overdue,
      supportingText: 'Past a due, target or review date',
      href: '/app/alerts?urgency=overdue',
      icon: CalendarX2Icon,
      iconTone: 'danger',
    },
    {
      key: 'due-soon',
      caption: `Due within ${days(dueSoonWindowDays)}`,
      value: counts.dueSoon,
      supportingText: 'Upcoming due, target or review dates',
      href: '/app/alerts?urgency=due-soon',
      icon: CalendarClockIcon,
      iconTone: 'warning',
    },
    {
      key: 'attention',
      caption: 'Needs attention',
      value: counts.attention,
      supportingText: 'Untreated Critical Risks and ineffective Control Implementations',
      href: '/app/alerts?urgency=attention',
      icon: FlagIcon,
      iconTone: 'info',
    },
  ];
}

/* ------------------------------------------------------------------- widgets */

export type DashboardWidgetKey = Exclude<keyof AnalystDashboardUnits, 'kpi'>;

/**
 * The widgets in DOM and reading order (D-18, Phase 11 UI-SPEC §5.3): the queue first, then the
 * deadlines and alerts, then exposure, then activity.
 */
export const dashboardWidgetOrder = [
  'reviewQueue',
  'treatmentsDue',
  'upcomingDueDates',
  'topAlerts',
  'riskExposure',
  'highCritical',
  'recentActivity',
] as const satisfies readonly DashboardWidgetKey[];

export type DashboardLink = { label: string; href: string };

export type DashboardWidgetCopy = {
  heading: string;
  headingId: string;
  icon: LucideIcon;
  /** One line stating the widget's predicate. */
  description: string;
  /** Completes "We couldn’t load {noun}" (§7.2). */
  errorNoun: string;
  /** The cleared state, or null for the Review queue, whose zero rows are data. */
  empty: { noun: string; description: string } | null;
  /** Footer links, each opening exactly the widget's predicate. */
  links: readonly DashboardLink[];
};

/** Each widget's heading, icon, description, error noun, cleared copy and footer links (UI-SPEC §2.5, §7.2). */
export function dashboardWidgetCopy(dueSoonWindowDays: number): Record<DashboardWidgetKey, DashboardWidgetCopy> {
  const window = days(dueSoonWindowDays);

  return {
    reviewQueue: {
      heading: 'Review queue',
      headingId: 'analyst-dashboard-review-queue-heading',
      icon: InboxIcon,
      // Not every row is waiting work (Submitted counts finished work too), so the line names what each group counts.
      description: 'Assessment Requests by queue, and Questionnaires and Risk Assessments by status.',
      errorNoun: 'the review queue',
      empty: null,
      links: [],
    },
    riskExposure: {
      heading: 'Risk exposure',
      headingId: 'analyst-dashboard-risk-exposure-heading',
      icon: ChartBarIcon,
      description: 'Open contextual Risks by residual rating.',
      errorNoun: 'Risk exposure',
      empty: { noun: 'open contextual Risks', description: 'Risks appear here when a Risk Assessment identifies them.' },
      links: [],
    },
    highCritical: {
      heading: 'High and Critical residual Risks',
      headingId: 'analyst-dashboard-high-critical-heading',
      icon: Table2Icon,
      description: 'Open Risks rated High or Critical after treatment, highest first.',
      errorNoun: 'High and Critical residual Risks',
      empty: { noun: 'High or Critical residual Risks', description: 'Open Risks rated High or Critical after treatment appear here.' },
      // The register has no multi-rating filter, so this list holds every open Risk, High and Critical first.
      links: [{ label: 'Open Risk Register', href: '/app/risks?state=open&sort=residualRating:desc' }],
    },
    treatmentsDue: {
      heading: 'Treatments due',
      headingId: 'analyst-dashboard-treatments-due-heading',
      icon: TimerIcon,
      description: `Risk treatments past their target date or due within ${window}, most overdue first.`,
      errorNoun: 'treatments due',
      empty: { noun: 'treatments due', description: `Treatments past their target date, or due within ${window}, appear here.` },
      links: [
        { label: 'View overdue treatments', href: '/app/alerts?kind=risk-treatment-overdue' },
        { label: 'View treatments due soon', href: '/app/alerts?kind=risk-treatment-due-soon' },
      ],
    },
    upcomingDueDates: {
      heading: 'Upcoming due dates',
      headingId: 'analyst-dashboard-upcoming-due-dates-heading',
      icon: CalendarDaysIcon,
      description: `Due, target and review dates in the next ${window}, soonest first.`,
      errorNoun: 'upcoming due dates',
      empty: { noun: 'upcoming due dates', description: `Due, target and review dates in the next ${window} appear here.` },
      links: [{ label: 'View everything due soon', href: '/app/alerts?urgency=due-soon' }],
    },
    topAlerts: {
      heading: 'Top alerts',
      headingId: 'analyst-dashboard-top-alerts-heading',
      icon: BellIcon,
      description: 'The most urgent alerts across your scope.',
      errorNoun: 'alerts',
      empty: { noun: 'alerts', description: alertsClearedDescription(dueSoonWindowDays) },
      links: [{ label: 'View all alerts', href: '/app/alerts' }],
    },
    recentActivity: {
      heading: 'Recent activity',
      headingId: 'analyst-dashboard-recent-activity-heading',
      icon: HistoryIcon,
      description: 'Workflow events across your review scope, newest first.',
      errorNoun: 'recent activity',
      empty: { noun: 'recent activity', description: 'Submissions, generated drafts, releases and returns to draft appear here.' },
      // There is no activity page, so there is no link (UI-SPEC §2.5).
      links: [],
    },
  };
}

/* -------------------------------------------------------------- review queue */

export type ReviewQueueRow = {
  key: string;
  label: string;
  count: number;
  countText: string;
  href: string;
  /** "{label}: {n} {record noun}" (§7.2), which contains the visible label and count. */
  accessibleName: string;
};

export type ReviewQueueGroup = { key: string; caption: string; rows: ReviewQueueRow[] };

function queueRow(key: string, label: string, count: number, href: string, noun: { one: string; other: string }): ReviewQueueRow {
  return { key, label, count, countText: formatCount(count), href, accessibleName: `${label}: ${counted(count, noun.one, noun.other)}` };
}

const requestNoun = { one: 'Assessment Request', other: 'Assessment Requests' };
const questionnaireNoun = { one: 'Questionnaire', other: 'Questionnaires' };
const assessmentNoun = { one: 'Risk Assessment', other: 'Risk Assessments' };

/**
 * Each analyst review list's count (UI-SPEC §2.5, widget 1). Every row opens its list with exactly
 * the figure's predicate: the D-21 buckets for Assessment Requests, the submitted-answer filter for
 * Questionnaires and the status filters for Risk Assessments. Zero rows still render.
 *
 * Answers stay submitted after the Risk Assessment is drafted, reviewed and released, so the
 * Questionnaires figure includes finished work. It is labelled `Submitted`, as the list's Status
 * filter names it, and never as work awaiting review: the actionable request-level work is
 * `Requires my attention`. The contract keeps the field's name, `questionnairesReadyForReview`.
 */
export function reviewQueueGroups(queue: DashboardReviewQueue): ReviewQueueGroup[] {
  return [
    {
      key: 'assessment-requests',
      caption: 'Assessment Requests',
      rows: [
        queueRow('requires-attention', 'Requires my attention', queue.requiresAttention, '/app/review/requests', requestNoun),
        queueRow('awaiting-requestor', 'Awaiting Requestor', queue.awaitingRequestor, '/app/review/requests?queue=awaiting-requestor', requestNoun),
        queueRow('generation-in-progress', 'Generation in progress', queue.generationInProgress, '/app/review/requests?queue=generation-in-progress', requestNoun),
      ],
    },
    {
      key: 'questionnaires',
      caption: 'Questionnaires',
      rows: [
        queueRow('submitted', 'Submitted', queue.questionnairesReadyForReview, '/app/review/questionnaires?status=submitted', questionnaireNoun),
      ],
    },
    {
      key: 'risk-assessments',
      caption: 'Risk Assessments',
      rows: [
        queueRow('draft', 'Draft', queue.assessmentsDraft, '/app/review/assessments?status=draft', assessmentNoun),
        queueRow('in-review', 'In review', queue.assessmentsInReview, '/app/review/assessments?status=in-review', assessmentNoun),
      ],
    },
  ];
}

/* ------------------------------------------------------------- risk exposure */

type RatingCounts = DashboardSummary['riskExposure'];

export type RiskExposureRow = {
  key: AssessmentRating | 'notRated';
  /** The rating whose badge labels the row, or null for Risks with none. */
  rating: AssessmentRating | null;
  labelText: string;
  value: number;
  /** Only rated rows link: the register has no "not rated" filter. */
  href?: string;
  tone: BarChartTone;
};

/** Vertical severity lists run Critical to Low (UI-D5). */
const exposureOrder = ['Critical', 'High', 'Moderate', 'Low'] as const satisfies readonly AssessmentRating[];

/* A severity mark fills with the rating's own fg token; an unrated Risk is ink (§3.14). */
const exposureTones = {
  Critical: 'risk-critical',
  High: 'risk-high',
  Moderate: 'risk-moderate',
  Low: 'risk-low',
} as const satisfies Record<AssessmentRating, BarChartTone>;

/*
 * Names each exposure link "{Rating}: {n} open {Risk|Risks} by residual rating". The Phase 7 wording
 * (§7.2) put "residual rating" between the rating and its count, so the link's visible words ("Critical
 * 2") were not the start of its name, which WCAG 2.5.3 Label in Name asks for (axe
 * label-content-name-mismatch, 08-12). The context now follows the count.
 */
export const riskExposureUnit = { one: 'open Risk by residual rating', other: 'open Risks by residual rating' } as const;

/** The exposure list's name: what its rows count. */
export const riskExposureListLabel = 'Open contextual Risks by residual rating';

/**
 * Open contextual Risks by residual rating (D-36). Each rated row opens the register with its own
 * rating and `state=open`, so the row and the list count the same Risks. Not rated is plain text and
 * appears only when it counts something.
 */
export function riskExposureRows(counts: RatingCounts): RiskExposureRow[] {
  const rows: RiskExposureRow[] = exposureOrder.map((rating) => ({
    key: rating,
    rating,
    // The badge's visible word, so the link's name opens with what it shows.
    labelText: rating,
    value: counts[rating],
    href: `/app/risks?residualRating=${rating}&state=open`,
    tone: exposureTones[rating],
  }));
  return counts.notRated > 0
    ? [...rows, { key: 'notRated', rating: null, labelText: 'Not rated', value: counts.notRated, tone: 'ink' }]
    : rows;
}

/* ------------------------------------------------------ High and Critical Risks */

export type DashboardTargetDate =
  | { kind: 'dated'; lead: 'Target date'; text: string; dateTime: string }
  | { kind: 'undated'; text: 'No target date' };

export type HighCriticalRiskRow = {
  documentId: string;
  riskNumber: string;
  href: string;
  statement: string | null;
  rating: 'Critical' | 'High';
  targetDate: DashboardTargetDate;
  /** The server's D-04 due state says overdue: the row carries the dense urgency marker. */
  overdue: boolean;
};

/** The High and Critical residual Risks in the server's order: Critical first, then soonest target date. */
export function highCriticalRiskRows(list: DashboardSummary['highCriticalRisks']): HighCriticalRiskRow[] {
  return list.rows.map((risk) => ({
    documentId: risk.documentId,
    riskNumber: risk.riskNumber,
    href: `/app/risks/${encodeURIComponent(risk.documentId)}`,
    statement: risk.riskStatement,
    rating: risk.residualRating,
    targetDate: risk.targetDate === null
      ? { kind: 'undated', text: 'No target date' }
      : { kind: 'dated', lead: 'Target date', text: formatRiskTargetDate(risk.targetDate), dateTime: risk.targetDate },
    overdue: risk.treatmentDueState === 'overdue',
  }));
}

/** "Showing {n} of {total}" (D-03). */
function showingNote(shown: number, total: number): string {
  return `Showing ${formatCount(shown)} of ${formatCount(total)}`;
}

/** The High and Critical note, only when the server marks the list truncated. */
export function highCriticalNote(list: DashboardSummary['highCriticalRisks']): string | null {
  return list.truncated ? showingNote(list.rows.length, list.total) : null;
}

/** A bounded alert page's note, only when the list it opens holds more than the rows shown. */
export function alertWidgetNote(list: DashboardAlertList): string | null {
  return list.total > list.rows.length ? showingNote(list.rows.length, list.total) : null;
}

/* ----------------------------------------------------------- recent activity */

const recordTypeLabels = {
  'assessment-request': 'Assessment Request',
  questionnaire: 'Questionnaire',
  assessment: 'Risk Assessment',
} as const satisfies Record<ActivityRecordType, string>;

/* A generated draft is advisory (AI output never releases anything), so its phrase names no one. */
const generatedDraftPhrase = 'draft generated for Security Analyst review';

const activityVerbs = {
  'request-submitted': 'submitted',
  'request-returned-to-draft': 'returned to draft',
  'questionnaire-generated': null,
  'questionnaire-released': 'released to the Requestor',
  'questionnaire-returned-to-draft': 'returned to draft',
  'assessment-draft-generated': null,
  'assessment-released': 'released',
} as const satisfies Record<ActivityKind, string | null>;

/**
 * What happened, after the identifier (UI-SPEC §2.5.1). " by {name}" follows only when the server
 * recorded who acted; a generated draft is never attributed, approved or released.
 */
export function activityPhrase(item: Pick<ActivityItem, 'kind' | 'actorDisplayName'>): string {
  const verb = activityVerbs[item.kind];
  if (verb === null) return generatedDraftPhrase;
  const actor = item.actorDisplayName?.trim();
  return actor ? `${verb} by ${actor}` : verb;
}

function activityHref(item: Pick<ActivityItem, 'recordType' | 'documentId'>): string {
  switch (item.recordType) {
    case 'assessment-request':
      return assessmentRequestHref('analyst', item.documentId);
    case 'questionnaire':
      return `/app/review/questionnaires/${encodeURIComponent(item.documentId)}`;
    case 'assessment':
      return `/app/review/assessments/${encodeURIComponent(item.documentId)}`;
  }
}

export type ActivityRow = {
  key: string;
  /** The record's number, else its title, else its type: the row's one link. */
  linkText: string;
  href: string;
  phrase: string;
  /** The event's instant; the row renders it as a date in the viewer's time zone (D-55, X-3). */
  dateTime: string;
  /** "{record type} · {title}", the type alone when the title is the link or absent, or null when the link is the type. */
  secondary: string | null;
};

/** The feed as rows, newest first as the server ordered it, each linked to the analyst route for its record. */
export function activityRows(activity: DashboardSummary['recentActivity']): ActivityRow[] {
  return activity.rows.map((item) => {
    const type = recordTypeLabels[item.recordType];
    const title = item.title?.trim() || null;
    const identifier = item.identifier;
    const linkText = identifier ?? title ?? type;
    const secondary = identifier ? (title ? `${type} · ${title}` : type) : title ? type : null;

    return {
      key: `${item.kind}:${item.documentId}:${item.occurredAt}`,
      linkText,
      href: activityHref(item),
      phrase: activityPhrase(item),
      dateTime: item.occurredAt,
      secondary,
    };
  });
}

/** "Showing the {n} most recent events", only when the server marks the feed truncated. */
export function recentActivityNote(activity: DashboardSummary['recentActivity']): string | null {
  return activity.truncated ? `Showing the ${formatCount(activity.rows.length)} most recent events` : null;
}

/* ------------------------------------------------------ guarded empty fixture */

/**
 * The dashboard with every count at zero and no row: the safe data the guarded E2E `empty` fixture
 * renders after a successful, authorised read. The server's window is kept, so the cleared copy
 * still states it.
 */
export function emptyAnalystDashboard(dueSoonWindowDays: number): AnalystDashboard {
  return {
    dueSoonWindowDays,
    units: {
      kpi: { status: 'ready', data: { requiresAttention: 0, overdue: 0, dueSoon: 0, attention: 0 } },
      reviewQueue: {
        status: 'ready',
        data: { requiresAttention: 0, awaitingRequestor: 0, generationInProgress: 0, questionnairesReadyForReview: 0, assessmentsDraft: 0, assessmentsInReview: 0 },
      },
      riskExposure: { status: 'ready', data: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 } },
      highCritical: { status: 'ready', data: { rows: [], total: 0, truncated: false } },
      treatmentsDue: { status: 'ready', data: { rows: [], total: 0 } },
      upcomingDueDates: { status: 'ready', data: { rows: [], total: 0 } },
      topAlerts: { status: 'ready', data: { rows: [], total: 0 } },
      recentActivity: { status: 'ready', data: { rows: [], truncated: false } },
    },
  };
}
