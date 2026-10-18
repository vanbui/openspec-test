import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { Capability } from '@/lib/capabilities/capability-adapter';

const mocks = vi.hoisted(() => ({
  getMyRequestStatusSummary: vi.fn(),
  getMyQuestionnaireSummary: vi.fn(),
  getAlertSummary: vi.fn(),
  countReviewQueue: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/features/requests/request-service', () => ({ getMyRequestStatusSummary: mocks.getMyRequestStatusSummary }));
vi.mock('@/features/questionnaires/questionnaire-service', () => ({ getMyQuestionnaireSummary: mocks.getMyQuestionnaireSummary }));
vi.mock('@/features/alerts/alert-service', () => ({ getAlertSummary: mocks.getAlertSummary }));
vi.mock('@/features/assessments/assessment-service', () => ({ countReviewQueue: mocks.countReviewQueue }));

import { loadNavigationCounts } from './navigation-counts';

const requestorGranted = new Set<Capability>(['assessment-request:create', 'assessment-request:read']);
const analystGranted = new Set<Capability>([
  'assessment-request:create',
  'assessment-request:read',
  'assessment:review',
  'risk:manage',
  'administration:manage',
]);

const failure = (status?: number) => ({ data: null, error: { message: 'The CSRM service is unavailable. Please try again later.', ...(status ? { status } : {}) } });

function statusSummary(byHolder: { requestor: number; analyst: number; none: number }) {
  return { data: { statuses: [], byHolder }, error: null };
}

function questionnaireSummary(counts: { notStarted: number; draft: number; submitted: number }) {
  return { data: { ...counts, total: counts.notStarted + counts.draft + counts.submitted }, error: null };
}

function alertSummary(overdue: number) {
  return {
    data: { byKind: {}, byUrgency: { overdue, 'due-soon': 4, attention: 2 }, total: overdue + 6, today: '2026-10-03', dueSoonWindowDays: 14 },
    error: null,
  };
}

/** The queue's total for each assignee filter, as the one-row page's served total. */
function queueCounts(totals: { me: number; unassigned: number }) {
  mocks.countReviewQueue.mockImplementation(async (_queue: string, options: { assignee: 'me' | 'unassigned' }) => ({ data: totals[options.assignee], error: null }));
}

beforeEach(() => {
  vi.resetAllMocks();
});

describe('loadNavigationCounts for a Requestor (D-10, D-11)', () => {
  it('reads the status summary and the questionnaire summary only, and counts what waits on the Requestor', async () => {
    mocks.getMyRequestStatusSummary.mockResolvedValue(statusSummary({ requestor: 3, analyst: 5, none: 2 }));
    mocks.getMyQuestionnaireSummary.mockResolvedValue(questionnaireSummary({ notStarted: 1, draft: 1, submitted: 4 }));

    await expect(loadNavigationCounts(requestorGranted)).resolves.toEqual({ myRequestsNeedingAction: 3, questionnairesToAnswer: 2 });

    expect(mocks.getMyRequestStatusSummary).toHaveBeenCalledTimes(1);
    expect(mocks.getMyQuestionnaireSummary).toHaveBeenCalledTimes(1);
    // A Requestor's layout issues no analyst read (T-11-07).
    expect(mocks.countReviewQueue).not.toHaveBeenCalled();
    expect(mocks.getAlertSummary).not.toHaveBeenCalled();
  });

  it('keeps a zero as zero: the badge, not the read, hides it', async () => {
    mocks.getMyRequestStatusSummary.mockResolvedValue(statusSummary({ requestor: 0, analyst: 1, none: 0 }));
    mocks.getMyQuestionnaireSummary.mockResolvedValue(questionnaireSummary({ notStarted: 0, draft: 0, submitted: 3 }));

    await expect(loadNavigationCounts(requestorGranted)).resolves.toEqual({ myRequestsNeedingAction: 0, questionnairesToAnswer: 0 });
  });

  it('leaves a refused read’s key undefined and keeps the other count', async () => {
    mocks.getMyRequestStatusSummary.mockResolvedValue(failure(403));
    mocks.getMyQuestionnaireSummary.mockResolvedValue(questionnaireSummary({ notStarted: 2, draft: 0, submitted: 0 }));

    await expect(loadNavigationCounts(requestorGranted)).resolves.toEqual({ questionnairesToAnswer: 2 });
  });

  it('leaves a failed read’s key undefined and keeps the other count', async () => {
    mocks.getMyRequestStatusSummary.mockResolvedValue(statusSummary({ requestor: 1, analyst: 0, none: 0 }));
    mocks.getMyQuestionnaireSummary.mockResolvedValue(failure());

    await expect(loadNavigationCounts(requestorGranted)).resolves.toEqual({ myRequestsNeedingAction: 1 });
  });

  it('never rejects, even when every read throws', async () => {
    mocks.getMyRequestStatusSummary.mockRejectedValue(new Error('socket hang up'));
    mocks.getMyQuestionnaireSummary.mockImplementation(() => { throw new Error('boom'); });

    await expect(loadNavigationCounts(requestorGranted)).resolves.toEqual({});
  });

  it('reads nothing for a viewer who can see no counted item', async () => {
    await expect(loadNavigationCounts(new Set<Capability>())).resolves.toEqual({});

    expect(mocks.getMyRequestStatusSummary).not.toHaveBeenCalled();
    expect(mocks.getMyQuestionnaireSummary).not.toHaveBeenCalled();
    expect(mocks.countReviewQueue).not.toHaveBeenCalled();
    expect(mocks.getAlertSummary).not.toHaveBeenCalled();
  });
});

describe('loadNavigationCounts for a Security Analyst (D-10, D-11)', () => {
  it('reads the assigned and waiting Requires attention totals, the overdue alerts and the own requests summary, and no questionnaire summary', async () => {
    queueCounts({ me: 3, unassigned: 4 });
    mocks.getAlertSummary.mockResolvedValue(alertSummary(6));
    mocks.getMyRequestStatusSummary.mockResolvedValue(statusSummary({ requestor: 1, analyst: 2, none: 0 }));

    await expect(loadNavigationCounts(analystGranted)).resolves.toEqual({
      assignedToMeNeedingAction: 3,
      requestsWaitingForPickUp: 4,
      overdueAlerts: 6,
      myRequestsNeedingAction: 1,
    });

    // D-14 (13-UI-SPEC §1): one bounded queue read per count, each with its own assignee filter.
    expect(mocks.countReviewQueue).toHaveBeenCalledTimes(2);
    expect(mocks.countReviewQueue).toHaveBeenCalledWith('requires-attention', { assignee: 'me' });
    expect(mocks.countReviewQueue).toHaveBeenCalledWith('requires-attention', { assignee: 'unassigned' });
    expect(mocks.getAlertSummary).toHaveBeenCalledTimes(1);
    expect(mocks.getMyRequestStatusSummary).toHaveBeenCalledTimes(1);
    // The analyst's own section has no My questionnaires item, so its figure is never read.
    expect(mocks.getMyQuestionnaireSummary).not.toHaveBeenCalled();
  });

  it('leaves only a rejected read’s key undefined', async () => {
    mocks.countReviewQueue.mockRejectedValue(new Error('ECONNRESET'));
    mocks.getAlertSummary.mockResolvedValue(alertSummary(6));
    mocks.getMyRequestStatusSummary.mockResolvedValue(statusSummary({ requestor: 1, analyst: 0, none: 0 }));

    await expect(loadNavigationCounts(analystGranted)).resolves.toEqual({ overdueAlerts: 6, myRequestsNeedingAction: 1 });
  });

  it('keeps each queue count apart: a rejected or refused assigned read leaves the waiting count, and the reverse', async () => {
    mocks.getAlertSummary.mockResolvedValue(alertSummary(0));
    mocks.getMyRequestStatusSummary.mockResolvedValue(statusSummary({ requestor: 0, analyst: 0, none: 0 }));

    mocks.countReviewQueue.mockImplementation(async (_queue: string, options: { assignee: string }) => {
      if (options.assignee === 'me') throw new Error('ECONNRESET');
      return { data: 4, error: null };
    });
    await expect(loadNavigationCounts(analystGranted)).resolves.toEqual({ requestsWaitingForPickUp: 4, overdueAlerts: 0, myRequestsNeedingAction: 0 });

    mocks.countReviewQueue.mockImplementation(async (_queue: string, options: { assignee: string }) => (options.assignee === 'unassigned' ? failure(403) : { data: 0, error: null }));
    await expect(loadNavigationCounts(analystGranted)).resolves.toEqual({ assignedToMeNeedingAction: 0, overdueAlerts: 0, myRequestsNeedingAction: 0 });
  });

  it('leaves a refused or failed read’s key undefined and keeps the others', async () => {
    queueCounts({ me: 2, unassigned: 3 });
    mocks.getAlertSummary.mockResolvedValue(failure(403));
    mocks.getMyRequestStatusSummary.mockResolvedValue(failure(503));

    await expect(loadNavigationCounts(analystGranted)).resolves.toEqual({ assignedToMeNeedingAction: 2, requestsWaitingForPickUp: 3 });
  });

  it('reads the queue and the alerts only for an analyst who can see those items', async () => {
    mocks.getMyRequestStatusSummary.mockResolvedValue(statusSummary({ requestor: 2, analyst: 0, none: 0 }));

    // The analyst profile without its own read grant shows Requests and Alerts and no own My requests.
    queueCounts({ me: 1, unassigned: 4 });
    mocks.getAlertSummary.mockResolvedValue(alertSummary(0));
    await expect(loadNavigationCounts(new Set<Capability>(['assessment:review']))).resolves.toEqual({ assignedToMeNeedingAction: 1, requestsWaitingForPickUp: 4, overdueAlerts: 0 });
    expect(mocks.getMyRequestStatusSummary).not.toHaveBeenCalled();
  });
});
