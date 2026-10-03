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
import { describe, expect, it } from 'vitest';

import type { AlertItem } from '../alerts/alert-schema';
import {
  activityPhrase,
  activityRows,
  alertWidgetNote,
  analystDashboardCopy,
  analystHomePermissionAction,
  dashboardKpiTiles,
  dashboardWidgetCopy,
  dashboardWidgetOrder,
  emptyAnalystDashboard,
  highCriticalNote,
  highCriticalRiskRows,
  recentActivityNote,
  reviewQueueGroups,
  riskExposureRows,
  riskExposureUnit,
} from './analyst-dashboard-presentation';
import { activityKinds, type ActivityItem, type DashboardSummary } from './analyst-dashboard-schema';

const reviewQueue: DashboardSummary['reviewQueue'] = {
  requiresAttention: 2,
  awaitingRequestor: 1,
  generationInProgress: 0,
  questionnairesReadyForReview: 1,
  assessmentsDraft: 3,
  assessmentsInReview: 1_204,
};

function activityOf(overrides: Partial<ActivityItem> = {}): ActivityItem {
  return {
    kind: 'request-submitted',
    recordType: 'assessment-request',
    documentId: 'request-1',
    identifier: 'RAR-2026-AB12CD',
    title: 'Payroll platform assessment',
    actorDisplayName: 'Jane Doe',
    occurredAt: '2026-09-24T09:30:00.000Z',
    ...overrides,
  };
}

const treatmentAlert: AlertItem = {
  id: 'risk-treatment-overdue:risk-1',
  kind: 'risk-treatment-overdue',
  urgency: 'overdue',
  governingDate: '2026-09-12',
  dayOffset: -12,
  source: { type: 'risk', documentId: 'risk-1', identifier: 'RSK-2026-001', title: 'Customer identity data may be disclosed.', released: false },
  link: { type: 'risk', documentId: 'risk-1' },
  residualRating: 'High',
};

describe('analyst Home copy', () => {
  it('names its loading label and the area its error and permission states identify, and no page of its own', () => {
    // The page heading and description are Home's (UI-SPEC §5.1); the analyst dashboard name retires.
    expect(analystDashboardCopy).toEqual({
      loadingLabel: 'Loading Home',
      area: 'the review summary',
      needsAction: 'Needs action',
      summaryCountsNoun: 'the summary counts',
    });
  });

  it('offers Return to sign in from its permission state, since Home would loop (UI-D19)', () => {
    expect(analystHomePermissionAction).toEqual({ label: 'Return to sign in', href: '/sign-in' });
  });
});

describe('dashboardKpiTiles', () => {
  const counts = { requiresAttention: 4, overdue: 3, dueSoon: 5, attention: 2 };

  it('returns the four Needs action tiles in order, each linked to the list with its own predicate', () => {
    expect(dashboardKpiTiles(counts, 14)).toEqual([
      {
        key: 'requires-attention',
        caption: 'Requires my attention',
        value: 4,
        supportingText: 'Assessment Requests in your review queue',
        href: '/app/review/requests',
        icon: InboxIcon,
        iconTone: 'muted',
      },
      {
        key: 'overdue',
        caption: 'Overdue',
        value: 3,
        supportingText: 'Past a due, target or review date',
        href: '/app/alerts?urgency=overdue',
        icon: CalendarX2Icon,
        iconTone: 'danger',
      },
      {
        key: 'due-soon',
        caption: 'Due within 14 days',
        value: 5,
        supportingText: 'Upcoming due, target or review dates',
        href: '/app/alerts?urgency=due-soon',
        icon: CalendarClockIcon,
        iconTone: 'warning',
      },
      {
        key: 'attention',
        caption: 'Needs attention',
        value: 2,
        supportingText: 'Untreated Critical Risks and ineffective Control Implementations',
        href: '/app/alerts?urgency=attention',
        icon: FlagIcon,
        iconTone: 'info',
      },
    ]);
  });

  it('takes the due-soon window from the server, with a singular day, and keeps zero as a linked zero', () => {
    const tiles = dashboardKpiTiles({ requiresAttention: 0, overdue: 0, dueSoon: 0, attention: 0 }, 1);
    expect(tiles[2].caption).toBe('Due within 1 day');
    expect(dashboardKpiTiles(counts, 30)[2].caption).toBe('Due within 30 days');
    expect(tiles.map((tile) => tile.value)).toEqual([0, 0, 0, 0]);
    expect(tiles.every((tile) => tile.href.startsWith('/app/'))).toBe(true);
  });
});

describe('dashboard widgets', () => {
  it('orders the seven widgets as UI-SPEC §2.2 sets them', () => {
    expect(dashboardWidgetOrder).toEqual([
      'reviewQueue',
      'riskExposure',
      'highCritical',
      'treatmentsDue',
      'upcomingDueDates',
      'topAlerts',
      'recentActivity',
    ]);
  });

  it('words each widget heading, icon, description, error noun, empty copy and footer links', () => {
    const copy = dashboardWidgetCopy(14);

    expect(copy.reviewQueue).toEqual({
      heading: 'Review queue',
      headingId: 'analyst-dashboard-review-queue-heading',
      icon: InboxIcon,
      description: 'Assessment Requests by queue, and Questionnaires and Risk Assessments by status.',
      errorNoun: 'the review queue',
      empty: null,
      links: [],
    });
    expect(copy.riskExposure).toEqual({
      heading: 'Risk exposure',
      headingId: 'analyst-dashboard-risk-exposure-heading',
      icon: ChartBarIcon,
      description: 'Open contextual Risks by residual rating.',
      errorNoun: 'Risk exposure',
      empty: { noun: 'open contextual Risks', description: 'Risks appear here when a Risk Assessment identifies them.' },
      links: [],
    });
    expect(copy.highCritical).toEqual({
      heading: 'High and Critical residual Risks',
      headingId: 'analyst-dashboard-high-critical-heading',
      icon: Table2Icon,
      description: 'Open Risks rated High or Critical after treatment, highest first.',
      errorNoun: 'High and Critical residual Risks',
      empty: { noun: 'High or Critical residual Risks', description: 'Open Risks rated High or Critical after treatment appear here.' },
      links: [{ label: 'Open Risk Register', href: '/app/risks?state=open&sort=residualRating:desc' }],
    });
    expect(copy.treatmentsDue).toEqual({
      heading: 'Treatments due',
      headingId: 'analyst-dashboard-treatments-due-heading',
      icon: TimerIcon,
      description: 'Risk treatments past their target date or due within 14 days, most overdue first.',
      errorNoun: 'treatments due',
      empty: { noun: 'treatments due', description: 'Treatments past their target date, or due within 14 days, appear here.' },
      links: [
        { label: 'View overdue treatments', href: '/app/alerts?kind=risk-treatment-overdue' },
        { label: 'View treatments due soon', href: '/app/alerts?kind=risk-treatment-due-soon' },
      ],
    });
    expect(copy.upcomingDueDates).toEqual({
      heading: 'Upcoming due dates',
      headingId: 'analyst-dashboard-upcoming-due-dates-heading',
      icon: CalendarDaysIcon,
      description: 'Due, target and review dates in the next 14 days, soonest first.',
      errorNoun: 'upcoming due dates',
      empty: { noun: 'upcoming due dates', description: 'Due, target and review dates in the next 14 days appear here.' },
      links: [{ label: 'View everything due soon', href: '/app/alerts?urgency=due-soon' }],
    });
    expect(copy.topAlerts).toEqual({
      heading: 'Top alerts',
      headingId: 'analyst-dashboard-top-alerts-heading',
      icon: BellIcon,
      description: 'The most urgent alerts across your scope.',
      errorNoun: 'alerts',
      empty: { noun: 'alerts', description: 'Nothing is overdue, due within 14 days, or flagged for attention.' },
      links: [{ label: 'View all alerts', href: '/app/alerts' }],
    });
    expect(copy.recentActivity).toEqual({
      heading: 'Recent activity',
      headingId: 'analyst-dashboard-recent-activity-heading',
      icon: HistoryIcon,
      description: 'Workflow events across your review scope, newest first.',
      errorNoun: 'recent activity',
      empty: { noun: 'recent activity', description: 'Submissions, generated drafts, releases and returns to draft appear here.' },
      links: [],
    });
  });

  it('never hard-codes the due-soon window in widget copy', () => {
    const copy = dashboardWidgetCopy(1);
    expect(copy.treatmentsDue.description).toBe('Risk treatments past their target date or due within 1 day, most overdue first.');
    expect(copy.upcomingDueDates.description).toBe('Due, target and review dates in the next 1 day, soonest first.');
    expect(copy.topAlerts.empty?.description).toBe('Nothing is overdue, due within 1 day, or flagged for attention.');
    expect(dashboardWidgetCopy(30).treatmentsDue.empty?.description).toBe('Treatments past their target date, or due within 30 days, appear here.');
  });
});

describe('reviewQueueGroups', () => {
  it('groups the six review list counts, each row opening its list with exactly the figure’s predicate', () => {
    expect(reviewQueueGroups(reviewQueue)).toEqual([
      {
        key: 'assessment-requests',
        caption: 'Assessment Requests',
        rows: [
          { key: 'requires-attention', label: 'Requires my attention', count: 2, countText: '2', href: '/app/review/requests', accessibleName: 'Requires my attention: 2 Assessment Requests' },
          { key: 'awaiting-requestor', label: 'Awaiting Requestor', count: 1, countText: '1', href: '/app/review/requests?queue=awaiting-requestor', accessibleName: 'Awaiting Requestor: 1 Assessment Request' },
          { key: 'generation-in-progress', label: 'Generation in progress', count: 0, countText: '0', href: '/app/review/requests?queue=generation-in-progress', accessibleName: 'Generation in progress: 0 Assessment Requests' },
        ],
      },
      {
        key: 'questionnaires',
        caption: 'Questionnaires',
        rows: [
          { key: 'submitted', label: 'Submitted', count: 1, countText: '1', href: '/app/review/questionnaires?status=submitted', accessibleName: 'Submitted: 1 Questionnaire' },
        ],
      },
      {
        key: 'risk-assessments',
        caption: 'Risk Assessments',
        rows: [
          { key: 'draft', label: 'Draft', count: 3, countText: '3', href: '/app/review/assessments?status=draft', accessibleName: 'Draft: 3 Risk Assessments' },
          { key: 'in-review', label: 'In review', count: 1_204, countText: '1,204', href: '/app/review/assessments?status=in-review', accessibleName: 'In review: 1,204 Risk Assessments' },
        ],
      },
    ]);
  });

  it('calls the submitted Questionnaires a count, never work awaiting review, because answers stay submitted after release', () => {
    const [, questionnaires] = reviewQueueGroups({ ...reviewQueue, questionnairesReadyForReview: 7 });

    // The figure still opens the submitted list, so the row keeps its count and link.
    expect(questionnaires.rows).toEqual([
      { key: 'submitted', label: 'Submitted', count: 7, countText: '7', href: '/app/review/questionnaires?status=submitted', accessibleName: 'Submitted: 7 Questionnaires' },
    ]);
    for (const text of [questionnaires.rows[0].label, questionnaires.rows[0].accessibleName]) {
      expect(text).not.toMatch(/ready|review|waiting/i);
    }
    expect(dashboardWidgetCopy(14).reviewQueue.description).not.toMatch(/waiting/i);
  });
});

describe('riskExposureRows', () => {
  it('runs Critical to Low, each a severity row linked to the open register list of that rating', () => {
    expect(riskExposureRows({ Critical: 1, High: 2, Moderate: 0, Low: 4, notRated: 0, total: 7 })).toEqual([
      { key: 'Critical', rating: 'Critical', labelText: 'Critical', value: 1, href: '/app/risks?residualRating=Critical&state=open', tone: 'risk-critical' },
      { key: 'High', rating: 'High', labelText: 'High', value: 2, href: '/app/risks?residualRating=High&state=open', tone: 'risk-high' },
      { key: 'Moderate', rating: 'Moderate', labelText: 'Moderate', value: 0, href: '/app/risks?residualRating=Moderate&state=open', tone: 'risk-moderate' },
      { key: 'Low', rating: 'Low', labelText: 'Low', value: 4, href: '/app/risks?residualRating=Low&state=open', tone: 'risk-low' },
    ]);
    // The label text is the badge's visible word, so the link's name opens with what it shows (SC 2.5.3).
    expect(riskExposureUnit).toEqual({ one: 'open Risk by residual rating', other: 'open Risks by residual rating' });
  });

  it('adds a plain, unlinked Not rated row in ink only when it counts something', () => {
    const rows = riskExposureRows({ Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 3, total: 3 });
    expect(rows.at(-1)).toEqual({ key: 'notRated', rating: null, labelText: 'Not rated', value: 3, tone: 'ink' });
    expect(rows.at(-1)).not.toHaveProperty('href');
    expect(rows).toHaveLength(5);
  });
});

describe('highCriticalRiskRows', () => {
  const highCritical: DashboardSummary['highCriticalRisks'] = {
    rows: [
      { documentId: 'risk-c1', riskNumber: 'RSK-2026-C1', riskStatement: 'Payroll servers are unpatched.', residualRating: 'Critical', targetDate: '2026-10-30', treatmentDueState: 'later' },
      { documentId: 'risk/h1', riskNumber: 'RSK-2026-H1', riskStatement: null, residualRating: 'High', targetDate: '2026-09-12', treatmentDueState: 'overdue' },
      { documentId: 'risk-h2', riskNumber: 'RSK-2026-H2', riskStatement: 'Backups are not tested.', residualRating: 'High', targetDate: null, treatmentDueState: 'no-target-date' },
    ],
    total: 3,
    truncated: false,
  };

  it('keeps the server order and marks overdue exactly when the server’s due state says so', () => {
    expect(highCriticalRiskRows(highCritical)).toEqual([
      {
        documentId: 'risk-c1',
        riskNumber: 'RSK-2026-C1',
        href: '/app/risks/risk-c1',
        statement: 'Payroll servers are unpatched.',
        rating: 'Critical',
        targetDate: { kind: 'dated', lead: 'Target date', text: '30 Oct 2026', dateTime: '2026-10-30' },
        overdue: false,
      },
      {
        documentId: 'risk/h1',
        riskNumber: 'RSK-2026-H1',
        href: '/app/risks/risk%2Fh1',
        statement: null,
        rating: 'High',
        targetDate: { kind: 'dated', lead: 'Target date', text: '12 Sept 2026', dateTime: '2026-09-12' },
        overdue: true,
      },
      {
        documentId: 'risk-h2',
        riskNumber: 'RSK-2026-H2',
        href: '/app/risks/risk-h2',
        statement: 'Backups are not tested.',
        rating: 'High',
        targetDate: { kind: 'undated', text: 'No target date' },
        overdue: false,
      },
    ]);
  });

  it('notes a truncated list only when the server marks it truncated', () => {
    expect(highCriticalNote(highCritical)).toBeNull();
    expect(highCriticalNote({ ...highCritical, total: 1_206, truncated: true })).toBe('Showing 3 of 1,206');
  });
});

describe('alertWidgetNote', () => {
  it('notes a bounded alert page only when its list holds more than the rows shown', () => {
    expect(alertWidgetNote({ rows: [treatmentAlert], total: 1 })).toBeNull();
    expect(alertWidgetNote({ rows: [], total: 0 })).toBeNull();
    expect(alertWidgetNote({ rows: [treatmentAlert, treatmentAlert], total: 12 })).toBe('Showing 2 of 12');
  });
});

describe('recent activity', () => {
  it.each([
    ['request-submitted', 'submitted by Jane Doe'],
    ['request-returned-to-draft', 'returned to draft by Jane Doe'],
    ['questionnaire-generated', 'draft generated for Security Analyst review'],
    ['questionnaire-released', 'released to the Requestor by Jane Doe'],
    ['questionnaire-returned-to-draft', 'returned to draft by Jane Doe'],
    ['assessment-draft-generated', 'draft generated for Security Analyst review'],
    ['assessment-released', 'released by Jane Doe'],
  ] as const)('words %s as UI-SPEC §2.5.1 does', (kind, phrase) => {
    expect(activityPhrase(activityOf({ kind }))).toBe(phrase);
  });

  it('omits " by {name}" when the event records no actor, and never invents one', () => {
    expect(activityPhrase(activityOf({ kind: 'request-submitted', actorDisplayName: null }))).toBe('submitted');
    expect(activityPhrase(activityOf({ kind: 'request-returned-to-draft', actorDisplayName: null }))).toBe('returned to draft');
    expect(activityPhrase(activityOf({ kind: 'questionnaire-released', actorDisplayName: null }))).toBe('released to the Requestor');
    expect(activityPhrase(activityOf({ kind: 'assessment-released', actorDisplayName: null }))).toBe('released');
  });

  it('never describes a generated draft as approved, released or final, and names no one for it', () => {
    for (const kind of ['questionnaire-generated', 'assessment-draft-generated'] as const) {
      const phrase = activityPhrase(activityOf({ kind, actorDisplayName: 'Bob Doe' }));
      expect(phrase).toBe('draft generated for Security Analyst review');
      expect(phrase).not.toMatch(/approved|released|final|Bob Doe/i);
    }
    expect(activityKinds).toHaveLength(7);
  });

  it('links each event to the analyst route for its record, dated absolutely in UTC', () => {
    const rows = activityRows({
      rows: [
        activityOf({ occurredAt: '2026-09-24T23:30:00.000-05:00' }),
        activityOf({ kind: 'questionnaire-released', recordType: 'questionnaire', documentId: 'ques-1', identifier: 'QUE-2026-0001', title: 'Payroll questionnaire', actorDisplayName: 'Bob Doe', occurredAt: '2026-09-23T09:00:00.000Z' }),
        activityOf({ kind: 'assessment-released', recordType: 'assessment', documentId: 'asm 1', identifier: 'ASM-2026-AB12CD', title: 'Payroll platform assessment', actorDisplayName: 'Bob Doe', occurredAt: '2026-09-04T09:00:00.000Z' }),
      ],
      truncated: false,
    });

    expect(rows).toEqual([
      {
        key: 'request-submitted:request-1:2026-09-24T23:30:00.000-05:00',
        linkText: 'RAR-2026-AB12CD',
        href: '/app/review/requests/request-1',
        phrase: 'submitted by Jane Doe',
        date: '25 Sept 2026',
        dateTime: '2026-09-24T23:30:00.000-05:00',
        secondary: 'Assessment Request · Payroll platform assessment',
      },
      {
        key: 'questionnaire-released:ques-1:2026-09-23T09:00:00.000Z',
        linkText: 'QUE-2026-0001',
        href: '/app/review/questionnaires/ques-1',
        phrase: 'released to the Requestor by Bob Doe',
        date: '23 Sept 2026',
        dateTime: '2026-09-23T09:00:00.000Z',
        secondary: 'Questionnaire · Payroll questionnaire',
      },
      {
        key: 'assessment-released:asm 1:2026-09-04T09:00:00.000Z',
        linkText: 'ASM-2026-AB12CD',
        href: '/app/review/assessments/asm%201',
        phrase: 'released by Bob Doe',
        date: '4 Sept 2026',
        dateTime: '2026-09-04T09:00:00.000Z',
        secondary: 'Risk Assessment · Payroll platform assessment',
      },
    ]);
  });

  it('lets the title carry a numberless row, and falls back to the record type when there is no title either', () => {
    const [titled, bare, untitled] = activityRows({
      rows: [
        activityOf({ kind: 'questionnaire-returned-to-draft', recordType: 'questionnaire', documentId: 'ques-2', identifier: null, title: 'Payroll questionnaire' }),
        activityOf({ kind: 'questionnaire-generated', recordType: 'questionnaire', documentId: 'ques-3', identifier: null, title: null, actorDisplayName: null }),
        activityOf({ kind: 'assessment-draft-generated', recordType: 'assessment', documentId: 'asm-2', identifier: 'ASM-2026-EF34GH', title: null, actorDisplayName: null }),
      ],
      truncated: false,
    });

    expect(titled).toMatchObject({ linkText: 'Payroll questionnaire', href: '/app/review/questionnaires/ques-2', secondary: 'Questionnaire' });
    expect(bare).toMatchObject({ linkText: 'Questionnaire', href: '/app/review/questionnaires/ques-3', secondary: null });
    expect(untitled).toMatchObject({ linkText: 'ASM-2026-EF34GH', href: '/app/review/assessments/asm-2', secondary: 'Risk Assessment' });
  });

  it('says how many events it shows only when the server marks the feed truncated', () => {
    expect(recentActivityNote({ rows: [activityOf()], truncated: false })).toBeNull();
    expect(recentActivityNote({ rows: Array.from({ length: 8 }, () => activityOf()), truncated: true })).toBe('Showing the 8 most recent events');
  });
});

describe('emptyAnalystDashboard', () => {
  it('is the safe empty dashboard: every unit ready, every count zero, no row, and the server’s window kept', () => {
    expect(emptyAnalystDashboard(14)).toEqual({
      dueSoonWindowDays: 14,
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
    });
  });
});
