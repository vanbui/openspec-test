import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AlertUrgencyBadge } from '@/components/csrm/alert-urgency-badge';
import { BarChart } from '@/components/csrm/bar-chart';
import { KpiTile, KpiTileSkeleton, KpiTileStrip } from '@/components/csrm/kpi-tile';
import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { RetryableErrorState } from '@/components/states/retryable-error-state';
import { EmptyState, PermissionDeniedState } from '@/components/states/states';
import { cn } from '@/lib/utils';
import { AlertRow, type AlertRowVariant } from '../alerts/alert-row';
import { homeGridClassName, homeLinkRowClassName, homeRowClassName, HomeSection, HomeSectionFooter, HomeSectionSkeleton } from '../home/home-section';
import {
  activityRows,
  alertWidgetNote,
  analystDashboardCopy,
  analystHomePermissionAction,
  dashboardKpiTiles,
  dashboardWidgetCopy,
  dashboardWidgetOrder,
  highCriticalNote,
  highCriticalRiskRows,
  recentActivityNote,
  reviewQueueGroups,
  riskExposureListLabel,
  riskExposureRows,
  riskExposureUnit,
  underAssessmentRow,
  type ActivityRow,
  type DashboardWidgetCopy,
  type DashboardWidgetKey,
  type HighCriticalRiskRow,
  type UnderAssessmentRow,
} from './analyst-dashboard-presentation';
import type { DashboardReviewQueue, DashboardSummary } from './analyst-dashboard-schema';
import type {
  AnalystDashboardState,
  AnalystDashboardUnits,
  DashboardAlertList,
  DashboardKpiCounts,
  DashboardUnit,
} from './analyst-dashboard-service';

/*
 * The analyst dashboard (UI-SPEC §2): the Needs action tiles first, then seven widgets in the
 * Home widget frame both Homes share (HomeSection). The page grids follow the viewport; every widget is a
 * container, so its rows follow the widget's own width (UI-D14). Each unit renders its own figures,
 * its cleared state or its compact error, and never another unit's. Every row list states
 * `role="list"`, as the report index does: its markers are removed, and some screen readers then
 * drop list semantics, and the row count with them, unless the role is explicit.
 */

/*
 * Tiles: two by two below xl, so the Review queue starts within the first 375px screen, and four in a
 * row from xl (UI-D20). The strip's subgrid aligns their lines, and long captions wrap inside it.
 */
const kpiStripClassName = 'grid-cols-2 xl:grid-cols-4';

/* Widgets: one column, two from lg (the Home grid both Homes share), gaps at the grid gap (§3.9). */
const widgetGridClassName = homeGridClassName;

/* A record or alert row in the shipped DashboardItem rhythm: hairlines between rows, none outside. */
const rowClassName = homeRowClassName;

/* A link row (UI-SPEC §2.4), shared with Your own requests. */
const linkRowClassName = homeLinkRowClassName;

/* A standalone record link meets the touch-target height below md, as the shared alert row's does. */
const recordLinkClassName = 'inline-flex min-h-11 items-center tabular-nums md:min-h-6';

/** A failed unit: its compact error and "Try again", with no count and no record link (UI-SPEC §6.2). */
function WidgetError({ noun }: { noun: string }) {
  return <RetryableErrorState density="compact" headingLevel="h3" noun={noun} />;
}

/** A cleared widget: "No {noun}" and its domain fact, quiet and with no call to action (X-11). */
function WidgetCleared({ copy }: { copy: DashboardWidgetCopy }) {
  return copy.empty
    ? <EmptyState density="compact" description={copy.empty.description} headingLevel="h3" kind="cleared" noun={copy.empty.noun} />
    : null;
}

/* ------------------------------------------------------------------ KPI strip */

function NeedsActionStrip({ dueSoonWindowDays, unit }: { dueSoonWindowDays: number; unit: DashboardUnit<DashboardKpiCounts> }) {
  const headingId = 'analyst-dashboard-needs-action-heading';

  return (
    <section aria-labelledby={headingId} data-slot="analyst-dashboard-needs-action">
      <h2 className="sr-only" id={headingId}>{analystDashboardCopy.needsAction}</h2>
      {unit.status === 'unavailable' ? <WidgetError noun={analystDashboardCopy.summaryCountsNoun} /> : (
        <KpiTileStrip className={kpiStripClassName}>
          {dashboardKpiTiles(unit.data, dueSoonWindowDays).map((tile) => (
            <KpiTile
              caption={tile.caption}
              href={tile.href}
              icon={tile.icon}
              iconTone={tile.iconTone}
              key={tile.key}
              supportingText={tile.supportingText}
              value={tile.value}
            />
          ))}
        </KpiTileStrip>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------- widgets */

function ReviewQueueBody({ queue }: { queue: DashboardReviewQueue }) {
  return (
    <div className="flex flex-col">
      {reviewQueueGroups(queue).map((group, index) => {
        const captionId = `analyst-dashboard-queue-${group.key}`;
        return (
          <div className={cn(index > 0 && 'mt-3 border-t border-border pt-3')} key={group.key}>
            <h3 className="micro-label text-muted-foreground" id={captionId}>{group.caption}</h3>
            <ul aria-labelledby={captionId} className="mt-1" role="list">
              {group.rows.map((row) => (
                <li key={row.key}>
                  <Link aria-label={row.accessibleName} className={linkRowClassName} href={row.href}>
                    <span className="min-w-0 flex-1 break-words">{row.label}</span>
                    {/* A word break the flex row does not draw: the link's text reads as its name begins (SC 2.5.3). */}
                    {' '}
                    <span className="shrink-0 font-medium tabular-nums">{row.countText}</span>
                    <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

/*
 * The open Risks under assessment, apart from the released rows (UI-SPEC §9.2): after a hairline, a link row
 * in the Review queue's pattern, then its caption, so the two stages are never read as one total.
 */
function UnderAssessmentLinkRow({ row }: { row: UnderAssessmentRow }) {
  return (
    <div className="mt-3 border-t border-border pt-3" data-slot="analyst-dashboard-under-assessment">
      <Link aria-label={row.accessibleName} className={linkRowClassName} href={row.href}>
        <span className="min-w-0 flex-1 break-words">{row.label}</span>
        {/* A word break the flex row does not draw: the link's text reads as its name begins (SC 2.5.3). */}
        {' '}
        <span className="shrink-0 font-medium tabular-nums">{row.countText}</span>
        <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
      </Link>
      <p className="text-xs text-foreground-secondary">{row.caption}</p>
    </div>
  );
}

function RiskExposureChart({ exposure }: { exposure: DashboardSummary['riskExposure'] }) {
  const bars = riskExposureRows(exposure).map((row) => ({
    key: row.key,
    // The badge keeps the rating's icon and word beside its colour; Not rated is plain text. The row's
    // link names the rating, so the badge inside it does not name itself (SC 2.5.3).
    label: row.rating ? <RiskRatingBadge labelled={false} rating={row.rating} /> : row.labelText,
    labelText: row.labelText,
    value: row.value,
    tone: row.tone,
    href: row.href,
    secondary: row.accepted,
  }));

  return <BarChart ariaLabel={riskExposureListLabel} data={bars} presentation="labelled-values" unit={riskExposureUnit} />;
}

/** Released rows, or the cleared released state, then the under-assessment row beneath either (UI-SPEC §9.2). */
function RiskExposureBody({ copy, exposure }: { copy: DashboardWidgetCopy; exposure: DashboardSummary['riskExposure'] }) {
  return (
    <div className="flex flex-col">
      {exposure.released.total === 0 ? <WidgetCleared copy={copy} /> : <RiskExposureChart exposure={exposure} />}
      <UnderAssessmentLinkRow row={underAssessmentRow(exposure)} />
    </div>
  );
}

function TargetDateLine({ row }: { row: HighCriticalRiskRow }) {
  const { targetDate } = row;

  return (
    <span className="inline-flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-foreground-secondary">
      {targetDate.kind === 'dated'
        ? <span>{targetDate.lead} <time dateTime={targetDate.dateTime}>{targetDate.text}</time></span>
        : <span>{targetDate.text}</span>}
      {/* The Risk Register's overdue marker (UI-SPEC §9 item 4), shown only when the D-04 rule says overdue. */}
      {row.overdue ? <AlertUrgencyBadge density="dense" urgency="overdue" /> : null}
    </span>
  );
}

/*
 * A High or Critical residual Risk: the identifier is the row's one link. Below @md the lines stack
 * with the badge and date beneath the text; from @md they sit at the end of the first line. The
 * identifier keeps its natural width there, so when the line is tight the date wraps beneath the
 * badge, still end-aligned, and the identifier never breaks.
 */
function HighCriticalRow({ row }: { row: HighCriticalRiskRow }) {
  return (
    <div className="grid grid-cols-1 gap-y-1 @md:grid-cols-[auto_minmax(0,1fr)] @md:gap-x-4">
      <RecordLink className={cn(recordLinkClassName, 'self-start text-sm @md:col-start-1 @md:row-start-1')} href={row.href}>
        {row.riskNumber}
      </RecordLink>
      {row.statement ? (
        <p className="line-clamp-2 min-w-0 text-sm text-foreground-secondary @md:col-span-2 @md:row-start-2">{row.statement}</p>
      ) : null}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 @md:col-start-2 @md:row-start-1 @md:justify-end">
        <RiskRatingBadge rating={row.rating} />
        <TargetDateLine row={row} />
      </div>
    </div>
  );
}

function HighCriticalBody({ list }: { list: DashboardSummary['highCriticalRisks'] }) {
  return (
    <ul role="list">
      {highCriticalRiskRows(list).map((row) => <li className={rowClassName} key={row.documentId}><HighCriticalRow row={row} /></li>)}
    </ul>
  );
}

function AlertListBody({ list, variant }: { list: DashboardAlertList; variant: AlertRowVariant }) {
  return (
    <ul role="list">
      {list.rows.map((alert) => <li className={rowClassName} key={alert.id}><AlertRow alert={alert} variant={variant} /></li>)}
    </ul>
  );
}

/*
 * One workflow event: "{identifier} {event phrase}", the date at the end from @md, then the record
 * type and title on one clamped line. The identifier, or the title when there is none, is the one link.
 */
function ActivityRowView({ row }: { row: ActivityRow }) {
  return (
    <div className="grid grid-cols-1 gap-y-1 @md:grid-cols-[minmax(0,1fr)_auto] @md:gap-x-4">
      <p className="flex min-w-0 flex-wrap items-center gap-x-1 text-sm text-foreground @md:col-start-1 @md:row-start-1">
        <RecordLink className={recordLinkClassName} href={row.href}>{row.linkText}</RecordLink>
        <span>{row.phrase}</span>
      </p>
      <p className="text-xs tabular-nums text-foreground-secondary @md:col-start-2 @md:row-start-1 @md:self-center @md:text-end">
        {/* The viewer's date, in its own <time dateTime> (D-55, X-3). */}
        <LocalInstant style="date" value={row.dateTime} />
      </p>
      {row.secondary ? (
        <p className="line-clamp-1 min-w-0 text-xs text-foreground-secondary @md:col-span-2 @md:row-start-2">{row.secondary}</p>
      ) : null}
    </div>
  );
}

function RecentActivityBody({ activity }: { activity: DashboardSummary['recentActivity'] }) {
  return (
    <ul role="list">
      {activityRows(activity).map((row) => <li className={rowClassName} key={row.key}><ActivityRowView row={row} /></li>)}
    </ul>
  );
}

type WidgetView = { body: ReactNode; footer?: ReactNode };

/** A ready unit's body and footer, its cleared state when its population is empty, or its compact error. */
function widgetView<T>(
  unit: DashboardUnit<T>,
  copy: DashboardWidgetCopy,
  view: { isEmpty?: (data: T) => boolean; body: (data: T) => ReactNode; note?: (data: T) => string | null },
): WidgetView {
  if (unit.status === 'unavailable') return { body: <WidgetError noun={copy.errorNoun} /> };
  if (view.isEmpty?.(unit.data)) return { body: <WidgetCleared copy={copy} /> };
  return { body: view.body(unit.data), footer: <HomeSectionFooter links={copy.links} note={view.note?.(unit.data) ?? null} /> };
}

function widgetViews(units: AnalystDashboardUnits, copy: Record<DashboardWidgetKey, DashboardWidgetCopy>): Record<DashboardWidgetKey, WidgetView> {
  const alertList = (variant: AlertRowVariant) => ({
    isEmpty: (list: DashboardAlertList) => list.total === 0,
    body: (list: DashboardAlertList) => <AlertListBody list={list} variant={variant} />,
    note: alertWidgetNote,
  });

  return {
    // Zero rows are data: the Review queue has no empty state.
    reviewQueue: widgetView(units.reviewQueue, copy.reviewQueue, { body: (queue) => <ReviewQueueBody queue={queue} /> }),
    // The cleared released state keeps the under-assessment row, so the body draws its own empty state.
    riskExposure: widgetView(units.riskExposure, copy.riskExposure, {
      body: (exposure) => <RiskExposureBody copy={copy.riskExposure} exposure={exposure} />,
    }),
    highCritical: widgetView(units.highCritical, copy.highCritical, {
      isEmpty: (list) => list.total === 0,
      body: (list) => <HighCriticalBody list={list} />,
      note: highCriticalNote,
    }),
    treatmentsDue: widgetView(units.treatmentsDue, copy.treatmentsDue, alertList('default')),
    // Every row here is due soon, so the agenda variant leads with the date.
    upcomingDueDates: widgetView(units.upcomingDueDates, copy.upcomingDueDates, alertList('agenda')),
    topAlerts: widgetView(units.topAlerts, copy.topAlerts, alertList('default')),
    recentActivity: widgetView(units.recentActivity, copy.recentActivity, {
      isEmpty: (activity) => activity.rows.length === 0,
      body: (activity) => <RecentActivityBody activity={activity} />,
      note: recentActivityNote,
    }),
  };
}

/** Recent activity reads best at full width, so it spans both columns from lg. */
const widgetSpans: Partial<Record<DashboardWidgetKey, string>> = { recentActivity: 'lg:col-span-2' };

/** Your own requests sits beneath Recent activity, in the left column from lg and full width below (UI-D21). */
export const ownRequestsPlacement = 'lg:col-start-1';

/**
 * The analyst Home's review summary for a composed state. The page error shows only when the summary
 * itself failed; a refused read shows the permission state; otherwise every unit renders on its own, and
 * `ownRequests` (the Home's Your own requests panel, D-18 item 7) ends the widget grid.
 */
export function AnalystDashboard({ ownRequests, state }: { ownRequests?: ReactNode; state: AnalystDashboardState }) {
  if (state.kind === 'permission-denied') return <PermissionDeniedState action={analystHomePermissionAction} area={analystDashboardCopy.area} />;
  if (state.kind === 'error') return <RetryableErrorState noun={analystDashboardCopy.area} />;

  const { dueSoonWindowDays, units } = state.dashboard;
  const copy = dashboardWidgetCopy(dueSoonWindowDays);
  const views = widgetViews(units, copy);

  return (
    <div className="space-y-8" data-slot="analyst-dashboard">
      <NeedsActionStrip dueSoonWindowDays={dueSoonWindowDays} unit={units.kpi} />
      <div className={widgetGridClassName} data-slot="analyst-dashboard-widgets">
        {dashboardWidgetOrder.map((key) => (
          <HomeSection className={widgetSpans[key]} copy={copy[key]} footer={views[key].footer} key={key}>
            {views[key].body}
          </HomeSection>
        ))}
        {ownRequests}
      </div>
    </div>
  );
}

/** The loading dashboard in its final layout: four tile skeletons, then the eight widget skeletons, Your own requests last. */
export function AnalystDashboardSkeleton() {
  return (
    <div aria-label={analystDashboardCopy.loadingLabel} aria-live="polite" className="space-y-8" role="status">
      <span className="sr-only">{analystDashboardCopy.loadingLabel}</span>
      <KpiTileStrip className={kpiStripClassName}>
        {Array.from({ length: 4 }, (_, index) => <KpiTileSkeleton key={index} />)}
      </KpiTileStrip>
      <div className={widgetGridClassName}>
        {dashboardWidgetOrder.map((key) => <HomeSectionSkeleton className={widgetSpans[key]} key={key} />)}
        <HomeSectionSkeleton className={ownRequestsPlacement} withFooter />
      </div>
    </div>
  );
}
