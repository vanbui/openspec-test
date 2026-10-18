import 'server-only';

import { z } from 'zod';

import {
  createStrapiClient,
  normalizeResponseParserError,
  normalizeTransportError,
  type StrapiClient,
  type TransportResult,
} from '../../lib/api/transport/server-client';
import type { AlertItem, AlertKind, AlertListPayload, AlertSummary } from '../alerts/alert-schema';
import { getAlertSummary, listAlerts } from '../alerts/alert-service';
import type { ContractResponseParser } from '../assessments/assessment-service';
import {
  dashboardSummaryResponseSchema,
  parseDashboardSummaryPayload,
  type DashboardReviewQueue,
  type DashboardSummary,
} from './analyst-dashboard-schema';

type ClientResponse = {
  data?: unknown;
  error?: unknown;
  response: { status: number };
};

/** The summary is parsed closed, with no narrowing, and guarded against the published contract. */
export const responseParserModule = {
  modulePath: 'features/analyst-dashboard/analyst-dashboard-service.ts',
  mode: 'parsers' as const,
  parsers: [
    {
      label: 'analystDashboard.getDashboardSummary',
      component: 'DashboardSummaryResponse',
      parser: dashboardSummaryResponseSchema,
      // The contract leaves the free-text risk statement, activity title and
      // actor display name unbounded: a Strapi text or string attribute
      // carries no server-enforced maximum, so the contract cannot declare
      // one (D-02). The client caps free text at 65,535 characters as every
      // feature schema does; registered so the parity guard's boundary mode
      // sees the narrowing (D-05).
      narrowedPaths: [
        'data.highCriticalRisks.rows.0.riskStatement',
        'data.recentActivity.rows.0.title',
        'data.recentActivity.rows.0.actorDisplayName',
      ],
    },
  ] as const satisfies readonly ContractResponseParser[],
};

async function request<T>(
  invoke: (client: StrapiClient) => Promise<ClientResponse>,
  parse: (payload: unknown) => T,
  operation: string,
): Promise<TransportResult<T>> {
  try {
    const client = await createStrapiClient();
    const { data, error, response } = await invoke(client);
    // A refusal keeps its status, so a 403 reaches the screen as permission denied.
    if (error !== undefined || data === undefined) return normalizeTransportError(error, response.status);
    return { data: parse(data), error: null };
  } catch (error) {
    if (error instanceof z.ZodError) return normalizeResponseParserError(operation);
    return normalizeTransportError(error);
  }
}

/** Every figure of the analyst dashboard, computed by Strapi on read (D-34). */
export async function getDashboardSummary(): Promise<TransportResult<DashboardSummary>> {
  return request(
    (client) => client.GET('/v1/dashboard/summary'),
    parseDashboardSummaryPayload,
    'analystDashboard.getDashboardSummary',
  );
}

/* ------------------------------------------------------------------ composition (D-34) */

/** One failure unit of the dashboard (UI-SPEC §6.2): its figures, or unavailable. Never zeroed. */
export type DashboardUnit<T> = { status: 'ready'; data: T } | { status: 'unavailable' };

/** A bounded alert page in a widget: the rows shown and the exact total of the list the widget opens. */
export type DashboardAlertList = { rows: readonly AlertItem[]; total: number };

/**
 * The four Needs action figures: the viewer's own Requires attention count (Phase 13 D-15) and the three alert
 * urgencies.
 */
export type DashboardKpiCounts = { needsYourAction: number; overdue: number; dueSoon: number; attention: number };

export type AnalystDashboardUnits = {
  kpi: DashboardUnit<DashboardKpiCounts>;
  reviewQueue: DashboardUnit<DashboardReviewQueue>;
  riskExposure: DashboardUnit<DashboardSummary['riskExposure']>;
  highCritical: DashboardUnit<DashboardSummary['highCriticalRisks']>;
  treatmentsDue: DashboardUnit<DashboardAlertList>;
  upcomingDueDates: DashboardUnit<DashboardAlertList>;
  topAlerts: DashboardUnit<DashboardAlertList>;
  recentActivity: DashboardUnit<DashboardSummary['recentActivity']>;
};

export type AnalystDashboard = {
  /** The due-soon window the server applied, which every caption and description states. */
  dueSoonWindowDays: number;
  units: AnalystDashboardUnits;
};

export type AnalystDashboardState =
  | { kind: 'ready'; dashboard: AnalystDashboard }
  | { kind: 'error' }
  | { kind: 'permission-denied' };

/** The two kinds whose alerts are the treatments the summary counts in `treatmentsDue`. */
const treatmentAlertKinds = ['risk-treatment-overdue', 'risk-treatment-due-soon'] as const satisfies readonly AlertKind[];

/** Each alert widget shows one bounded page; its footer opens the whole list (UI-SPEC §2.4). */
const DASHBOARD_ALERT_PAGE_SIZE = 5;

const unavailable = { status: 'unavailable' } as const;

function ready<T>(data: T): DashboardUnit<T> {
  return { status: 'ready', data };
}

/** A read that rejects outright counts as a failed read, so it can fail only its own unit. */
async function settled<T>(read: () => Promise<TransportResult<T>>): Promise<TransportResult<T>> {
  try {
    return await read();
  } catch (error) {
    return normalizeTransportError(error);
  }
}

function alertList(result: TransportResult<AlertListPayload>): DashboardUnit<DashboardAlertList> {
  return result.error ? unavailable : ready({ rows: result.data.data, total: result.data.meta.pagination.total });
}

function kpiCounts(summary: DashboardSummary, alertSummary: TransportResult<AlertSummary>): DashboardUnit<DashboardKpiCounts> {
  if (alertSummary.error) return unavailable;
  const { byUrgency } = alertSummary.data;
  return ready({
    // Tile 1 is the viewer's own work, Assigned to me's Requires attention total, never the team's queue (D-15).
    needsYourAction: summary.reviewQueue.mine.requiresAttention,
    overdue: byUrgency.overdue,
    dueSoon: byUrgency['due-soon'],
    attention: byUrgency.attention,
  });
}

/**
 * The analyst dashboard (DASH-01, D-34). The summary, the alert summary and three bounded alert
 * pages are read in parallel, so each widget fails on its own read alone. A refused read means the
 * viewer may not see the dashboard at all; a failed summary leaves no unit that can render, so it
 * is the page error. Every figure is the server's: nothing here counts, orders or derives.
 */
export async function getAnalystDashboard(): Promise<AnalystDashboardState> {
  try {
    const [summary, alertSummary, treatments, dueSoon, topAlerts] = await Promise.all([
      getDashboardSummary(),
      settled(() => getAlertSummary()),
      settled(() => listAlerts({ kinds: [...treatmentAlertKinds], page: 1, pageSize: DASHBOARD_ALERT_PAGE_SIZE })),
      settled(() => listAlerts({ urgency: 'due-soon', page: 1, pageSize: DASHBOARD_ALERT_PAGE_SIZE })),
      settled(() => listAlerts({ page: 1, pageSize: DASHBOARD_ALERT_PAGE_SIZE })),
    ]);

    if ([summary, alertSummary, treatments, dueSoon, topAlerts].some((result) => result.error?.status === 403)) {
      return { kind: 'permission-denied' };
    }
    if (summary.error) return { kind: 'error' };

    const figures = summary.data;
    const treatmentRows = alertList(treatments);
    return {
      kind: 'ready',
      dashboard: {
        dueSoonWindowDays: figures.dueSoonWindowDays,
        units: {
          kpi: kpiCounts(figures, alertSummary),
          reviewQueue: ready(figures.reviewQueue),
          riskExposure: ready(figures.riskExposure),
          highCritical: ready(figures.highCriticalRisks),
          // The rows are the bounded page; the total is the summary's treatment count (D-34), which
          // the mounted test proves equal to that list's own total.
          treatmentsDue: treatmentRows.status === 'ready'
            ? ready({ rows: treatmentRows.data.rows, total: figures.treatmentsDue.total })
            : unavailable,
          upcomingDueDates: alertList(dueSoon),
          topAlerts: alertList(topAlerts),
          recentActivity: ready(figures.recentActivity),
        },
      },
    };
  } catch {
    return { kind: 'error' };
  }
}
