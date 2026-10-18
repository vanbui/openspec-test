import 'server-only';

import {
  navigationProfileFor,
  profileItems,
  type NavigationCountKey,
  type NavigationCounts,
} from '@/config/navigation/navigation';
import { getAlertSummary } from '@/features/alerts/alert-service';
import { countReviewQueue } from '@/features/assessments/assessment-service';
import { getMyQuestionnaireSummary } from '@/features/questionnaires/questionnaire-service';
import { getMyRequestStatusSummary } from '@/features/requests/request-service';
import type { TransportResult } from '@/lib/api/transport/server-client';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';

export type { NavigationCounts } from '@/config/navigation/navigation';

/*
 * The sidebar's counts (D-10, D-11). Each figure is read through an existing feature service function,
 * so no new module calls the client, and Strapi scopes and authorises every read: these are the viewer's
 * own figures or the review figures their grants allow.
 *
 * The reads follow what the viewer's navigation shows: a key is read only when an item the viewer can see
 * carries it, so a Requestor's layout issues no analyst read (T-11-07). Each read settles to a number or
 * to nothing, so a refused or failed read hides its own count and leaves the others.
 */

/** One figure: the service's result picked to a number, or undefined when the read is refused, fails or throws. */
async function figure<T>(read: () => Promise<TransportResult<T>>, pick: (data: T) => number): Promise<number | undefined> {
  try {
    const result = await read();
    return result.error === null ? pick(result.data) : undefined;
  } catch {
    return undefined;
  }
}

/* Two reads for a Requestor; four for an analyst. All are aggregates except the queues' one-row pages (T-11-32, T-13-45). */
const readers: Record<NavigationCountKey, () => Promise<number | undefined>> = {
  // The requests whose next action is the Requestor's, by the same holder rule as My requests' filter.
  myRequestsNeedingAction: () => figure(getMyRequestStatusSummary, (summary) => summary.byHolder.requestor),
  // Questionnaires to answer: not started, or started and not yet submitted.
  questionnairesToAnswer: () => figure(getMyQuestionnaireSummary, (summary) => summary.notStarted + summary.draft),
  // D-14: the requests the viewer holds that need analyst action, and those that need it with nobody holding them.
  // Strapi resolves both assignee filters against the policy's own viewer (13-12).
  assignedToMeNeedingAction: () => figure(() => countReviewQueue('requires-attention', { assignee: 'me' }), (total) => total),
  requestsWaitingForPickUp: () => figure(() => countReviewQueue('requires-attention', { assignee: 'unassigned' }), (total) => total),
  // Overdue alerts, the figure the Alerts list's overdue filter totals.
  overdueAlerts: () => figure(getAlertSummary, (summary) => summary.byUrgency.overdue),
};

/** The count keys of the items the viewer's navigation shows, collapsed sections included. */
function shownCountKeys(granted: ReadonlySet<Capability>): NavigationCountKey[] {
  const keys = profileItems(navigationProfileFor(granted))
    .filter((item) => can(item.capability, granted))
    .flatMap((item) => (item.count ? [item.count] : []));
  return [...new Set(keys)];
}

/**
 * Starts the viewer's count reads and resolves their figures. It never rejects: the layout passes the
 * promise unawaited to the navigation, which renders each count once it settles, so no page waits on it.
 */
export async function loadNavigationCounts(granted: ReadonlySet<Capability>): Promise<NavigationCounts> {
  try {
    const entries = await Promise.all(shownCountKeys(granted).map(async (key) => [key, await readers[key]()] as const));
    const counts: NavigationCounts = {};
    for (const [key, value] of entries) {
      if (value !== undefined) counts[key] = value;
    }
    return counts;
  } catch {
    return {};
  }
}
