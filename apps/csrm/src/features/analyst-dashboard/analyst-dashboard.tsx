import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { AlertUrgencyBadge } from '@/components/csrm/alert-urgency-badge';
import { BarChart } from '@/components/csrm/bar-chart';
import { KpiTile, KpiTileSkeleton, KpiTileStrip } from '@/components/csrm/kpi-tile';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { RetryableErrorState } from '@/components/states/retryable-error-state';
import { EmptyState, PermissionDeniedState } from '@/components/states/states';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { AlertRow, type AlertRowVariant } from '../alerts/alert-row';
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
  type ActivityRow,
  type DashboardLink,
  type DashboardWidgetCopy,
  type DashboardWidgetKey,
  type HighCriticalRiskRow,
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
 * widget frame of the Requestor dashboard. The page grids follow the viewport; every widget is a
 * container, so its rows follow the widget's own width (UI-D14). Each unit renders its own figures,
 * its cleared state or its compact error, and never another unit's. Every row list states
 * `role="list"`, as the report index does: its markers are removed, and some screen readers then
 * drop list semantics, and the row count with them, unless the role is explicit.
 */

/* Tiles: one column below sm, two from sm, four from xl. The strip's subgrid aligns their lines. */
const kpiStripClassName = 'sm:grid-cols-2 xl:grid-cols-4';

/* Widgets: one column, two from lg (the Requestor dashboard's grid), gaps at the grid gap (§3.9). */
const widgetGridClassName = 'grid min-w-0 grid-cols-1 gap-gutter-xs sm:gap-gutter-sm lg:grid-cols-2';

/* A record or alert row in the shipped DashboardItem rhythm: hairlines between rows, none outside. */
const rowClassName = 'border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0';

/*
 * A link row (UI-SPEC §2.4): the whole row is one link at least the default table row height, with
 * the chevron as its at-rest cue. The hover tint reaches past the text edge, as the bar rows' does.
 */
const linkRowClassName =
  '-mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-foreground '
  + 'transition-colors duration-(--duration-micro) ease-standard hover:bg-surface-hover';

/*
 * A footer text link: ink with its at-rest underline, the button type size, and the touch-target
 * height below md. Written out rather than merged, because a merge drops the type token beside a
 * text colour.
 */
const footerLinkClassName =
  'inline-flex min-h-11 items-center text-button text-foreground underline decoration-muted-foreground underline-offset-3 '
  + 'transition-colors duration-(--duration-micro) ease-standard hover:decoration-foreground md:min-h-6';

/* A standalone record link meets the touch-target height below md, as the shared alert row's does. */
const recordLinkClassName = 'inline-flex min-h-11 items-center tabular-nums md:min-h-6';

/** The widget frame: the card, its icon and heading, the one-line predicate, the body and any footer. */
function DashboardWidget({ children, className, copy, footer }: {
  children: ReactNode;
  className?: string;
  copy: DashboardWidgetCopy;
  footer?: ReactNode;
}) {
  const Icon = copy.icon;

  return (
    <Card className={cn('min-w-0 gap-0 py-5', className)}>
      <section aria-labelledby={copy.headingId} className="@container flex min-w-0 flex-1 flex-col px-5" data-slot="dashboard-widget">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="text-heading-sm text-foreground" id={copy.headingId}>{copy.heading}</h2>
        </div>
        <p className="mt-2 text-sm text-foreground-secondary">{copy.description}</p>
        {/*
         * The footer follows the rows rather than pinning to the card's bottom edge. Paired
         * widgets share a row height, so a sparse widget's spare height falls after its footer,
         * where it reads as room to grow, instead of opening a band between rows and links
         * (07-UI-REVIEW finding 1).
         */}
        <div className="mt-4">{children}</div>
        {footer}
      </section>
    </Card>
  );
}

/** The truncation note, then the links that open the widget's own predicate. */
function WidgetFooter({ links, note }: { links: readonly DashboardLink[]; note: string | null }) {
  if (!note && links.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4" data-slot="dashboard-widget-footer">
      {note ? <p className="text-xs tabular-nums text-foreground-secondary">{note}</p> : null}
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-x-4">
          {links.map((link) => <Link className={footerLinkClassName} href={link.href} key={link.href}>{link.label}</Link>)}
        </div>
      ) : null}
    </div>
  );
}

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

function RiskExposureBody({ counts }: { counts: DashboardSummary['riskExposure'] }) {
  const bars = riskExposureRows(counts).map((row) => ({
    key: row.key,
    // The badge keeps the rating's icon and word beside its colour; Not rated is plain text. The row's
    // link names the rating, so the badge inside it does not name itself (SC 2.5.3).
    label: row.rating ? <RiskRatingBadge labelled={false} rating={row.rating} /> : row.labelText,
    labelText: row.labelText,
    value: row.value,
    tone: row.tone,
    href: row.href,
  }));

  return <BarChart ariaLabel={riskExposureListLabel} data={bars} presentation="labelled-values" unit={riskExposureUnit} />;
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
        <time dateTime={row.dateTime}>{row.date}</time>
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
  return { body: view.body(unit.data), footer: <WidgetFooter links={copy.links} note={view.note?.(unit.data) ?? null} /> };
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
    riskExposure: widgetView(units.riskExposure, copy.riskExposure, {
      isEmpty: (counts) => counts.total === 0,
      body: (counts) => <RiskExposureBody counts={counts} />,
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

/**
 * The analyst Home's review summary for a composed state. The page error shows only when the summary
 * itself failed; a refused read shows the permission state; otherwise every unit renders on its own.
 */
export function AnalystDashboard({ state }: { state: AnalystDashboardState }) {
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
          <DashboardWidget className={widgetSpans[key]} copy={copy[key]} footer={views[key].footer} key={key}>
            {views[key].body}
          </DashboardWidget>
        ))}
      </div>
    </div>
  );
}

/** A loading widget in the same card: the icon and title, the description, then three rows. */
function WidgetSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn('min-w-0 gap-0 py-5', className)} data-slot="dashboard-widget-skeleton">
      <div className="px-5">
        <div className="flex h-6 items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="mt-2 h-5 w-full max-w-sm" />
        <div className="mt-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div className={rowClassName} key={index}>
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** The loading dashboard in its final layout: four tile skeletons, then the seven widget skeletons. */
export function AnalystDashboardSkeleton() {
  return (
    <div aria-label={analystDashboardCopy.loadingLabel} aria-live="polite" className="space-y-8" role="status">
      <span className="sr-only">{analystDashboardCopy.loadingLabel}</span>
      <KpiTileStrip className={kpiStripClassName}>
        {Array.from({ length: 4 }, (_, index) => <KpiTileSkeleton key={index} />)}
      </KpiTileStrip>
      <div className={widgetGridClassName}>
        {dashboardWidgetOrder.map((key) => <WidgetSkeleton className={widgetSpans[key]} key={key} />)}
      </div>
    </div>
  );
}
