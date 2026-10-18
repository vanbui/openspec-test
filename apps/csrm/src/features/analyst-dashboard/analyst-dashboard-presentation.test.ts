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
  UserRoundCheckIcon,
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
  riskExposureListLabel,
  riskExposureRows,
  riskExposureUnit,
  underAssessmentRow,
} from './analyst-dashboard-presentation';
import { activityKinds, type ActivityItem, type DashboardSummary } from './analyst-dashboard-schema';

const reviewQueue: DashboardSummary['reviewQueue'] = {
  requiresAttention: 2,
  awaitingRequestor: 1,
  generationInProgress: 0,
  questionnairesReadyForReview: 1,
  assessmentsDraft: 3,
  assessmentsInReview: 1_204,
  mine: { requiresAttention: 3, awaitingRequestor: 1, generationInProgress: 0, withUnreadNotes: 1 },
  unassigned: 5,
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
  const counts = { needsYourAction: 4, overdue: 3, dueSoon: 5, attention: 2 };

  // Phase 13 (D-15; UI-SPEC §3, U1 changed deliberately): tile 1 is the viewer's own work, not the team's queue.
  it('returns the four Needs action tiles in order, each linked to the list with its own predicate', () => {
    expect(dashboardKpiTiles(counts, 14)).toEqual([
      {
        key: 'needs-your-action',
        caption: 'Needs your action',
        value: 4,
        supportingText: 'Requests assigned to you that need analyst action',
        href: '/app/review/assigned?queue=requires-attention',
        icon: UserRoundCheckIcon,
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
        supportingText: 'Untreated Critical Risks and ineffective mitigation controls',
        href: '/app/alerts?urgency=attention',
        icon: FlagIcon,
        iconTone: 'info',
      },
    ]);
  });

  it('takes the due-soon window from the server, with a singular day, and keeps zero as a linked zero', () => {
    const tiles = dashboardKpiTiles({ needsYourAction: 0, overdue: 0, dueSoon: 0, attention: 0 }, 1);
    expect(tiles[2].caption).toBe('Due within 1 day');
    expect(dashboardKpiTiles(counts, 30)[2].caption).toBe('Due within 30 days');
    expect(tiles.map((tile) => tile.value)).toEqual([0, 0, 0, 0]);
    expect(tiles.every((tile) => tile.href.startsWith('/app/'))).toBe(true);
  });
});

describe('dashboard widgets', () => {
  it('leads with the queue, then deadlines and alerts, then exposure and activity (D-18, UI-SPEC §5.3)', () => {
    expect(dashboardWidgetOrder).toEqual([
      'reviewQueue',
      'treatmentsDue',
      'upcomingDueDates',
      'topAlerts',
      'riskExposure',
      'highCritical',
      'recentActivity',
    ]);
  });

  it('words each widget heading, icon, description, error noun, empty copy and footer links', () => {
    const copy = dashboardWidgetCopy(14);

    expect(copy.reviewQueue).toEqual({
      heading: 'Review queue',
      headingId: 'analyst-dashboard-review-queue-heading',
      icon: InboxIcon,
      description: 'Your assigned requests first, then the team’s queue.',
      errorNoun: 'the review queue',
      empty: null,
      links: [],
    });
    expect(copy.riskExposure).toEqual({
      heading: 'Risk exposure',
      headingId: 'analyst-dashboard-risk-exposure-heading',
      icon: ChartBarIcon,
      description: 'Released Risks only. Open Risks by residual rating, with accepted Risks marked.',
      errorNoun: 'Risk exposure',
      empty: { noun: 'released open Risks', description: 'Risks count here once their risk assessment is released.' },
      links: [],
    });
    expect(copy.highCritical).toEqual({
      heading: 'High and Critical residual Risks',
      headingId: 'analyst-dashboard-high-critical-heading',
      icon: Table2Icon,
      description: 'Released open Risks rated High or Critical after treatment, highest first.',
      errorNoun: 'High and Critical residual Risks',
      empty: { noun: 'released High or Critical residual Risks', description: 'Released open Risks rated High or Critical after treatment appear here.' },
      // D-37: the total stays plain; each rating opens its own released open list (UI-SPEC §8.2).
      links: [
        { label: 'View Critical Risks', href: '/app/risks?residualRating=Critical&state=open&stage=released' },
        { label: 'View High Risks', href: '/app/risks?residualRating=High&state=open&stage=released' },
      ],
    });
    expect(copy.treatmentsDue).toEqual({
      heading: 'Treatments due',
      headingId: 'analyst-dashboard-treatments-due-heading',
      icon: TimerIcon,
      description: 'Risk treatments past their target date or due within 14 days, most overdue first. Includes Risks under assessment.',
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
      description: 'Due, target and review dates in the next 14 days, soonest first. Includes Risks under assessment.',
      errorNoun: 'upcoming due dates',
      empty: { noun: 'upcoming due dates', description: 'Due, target and review dates in the next 14 days appear here.' },
      links: [{ label: 'View everything due soon', href: '/app/alerts?urgency=due-soon' }],
    });
    expect(copy.topAlerts).toEqual({
      heading: 'Top alerts',
      headingId: 'analyst-dashboard-top-alerts-heading',
      icon: BellIcon,
      description: 'The most urgent alerts across your scope, including Risks under assessment.',
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

  it('says in words which stage each Risk figure counts, and never says contextual (D-42, D-43, D-54)', () => {
    const copy = dashboardWidgetCopy(14);
    expect(copy.riskExposure.description.startsWith('Released Risks only.')).toBe(true);
    expect(copy.highCritical.description.startsWith('Released open Risks')).toBe(true);
    for (const key of ['treatmentsDue', 'upcomingDueDates'] as const) {
      expect(copy[key].description.endsWith('Includes Risks under assessment.'), key).toBe(true);
    }
    expect(copy.topAlerts.description).toContain('including Risks under assessment');
    const words = JSON.stringify(Object.values(copy).map(({ description, empty, links }) => ({ description, empty, links })));
    expect(words).not.toMatch(/contextual/i);
  });

  it('never hard-codes the due-soon window in widget copy', () => {
    const copy = dashboardWidgetCopy(1);
    expect(copy.treatmentsDue.description).toBe('Risk treatments past their target date or due within 1 day, most overdue first. Includes Risks under assessment.');
    expect(copy.upcomingDueDates.description).toBe('Due, target and review dates in the next 1 day, soonest first. Includes Risks under assessment.');
    expect(copy.topAlerts.empty?.description).toBe('Nothing is overdue, due within 1 day, or flagged for attention.');
    expect(dashboardWidgetCopy(30).treatmentsDue.empty?.description).toBe('Treatments past their target date, or due within 30 days, appear here.');
  });
});

describe('reviewQueueGroups', () => {
  // Phase 13 (D-15, D-13; UI-SPEC §3, U1 changed deliberately): the viewer's own work leads, then the team's pool.
  it('groups the eleven review list counts, each row opening its list with exactly the figure’s predicate', () => {
    expect(reviewQueueGroups(reviewQueue)).toEqual([
      {
        key: 'assigned-to-you',
        caption: 'Assigned to you',
        rows: [
          { key: 'needs-your-action', label: 'Needs your action', count: 3, countText: '3', href: '/app/review/assigned?queue=requires-attention', accessibleName: 'Needs your action: 3 Assessment Requests' },
          { key: 'with-new-notes', label: 'With new notes', count: 1, countText: '1', href: '/app/review/assigned?notes=unread', accessibleName: 'With new notes: 1 Assessment Request assigned to you' },
          { key: 'awaiting-requestor', label: 'Awaiting Requestor', count: 1, countText: '1', href: '/app/review/assigned?queue=awaiting-requestor', accessibleName: 'Awaiting Requestor: 1 Assessment Request' },
          { key: 'generation-in-progress', label: 'Generation in progress', count: 0, countText: '0', href: '/app/review/assigned?queue=generation-in-progress', accessibleName: 'Generation in progress: 0 Assessment Requests' },
        ],
      },
      {
        key: 'assessment-requests',
        caption: 'Assessment Requests',
        rows: [
          { key: 'waiting-for-pick-up', label: 'Waiting for pick-up', count: 5, countText: '5', href: '/app/review/requests?assignee=unassigned', accessibleName: 'Waiting for pick-up: 5 Assessment Requests' },
          { key: 'requires-attention', label: 'Requires attention', count: 2, countText: '2', href: '/app/review/requests', accessibleName: 'Requires attention: 2 Assessment Requests' },
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
    const [, , questionnaires] = reviewQueueGroups({ ...reviewQueue, questionnairesReadyForReview: 7 });

    // The figure still opens the submitted list, so the row keeps its count and link.
    expect(questionnaires.rows).toEqual([
      { key: 'submitted', label: 'Submitted', count: 7, countText: '7', href: '/app/review/questionnaires?status=submitted', accessibleName: 'Submitted: 7 Questionnaires' },
    ]);
    for (const text of [questionnaires.rows[0].label, questionnaires.rows[0].accessibleName]) {
      expect(text).not.toMatch(/ready|review|waiting/i);
    }
    expect(dashboardWidgetCopy(14).reviewQueue.description).not.toMatch(/waiting/i);
  });

  it('words every Assigned to you row for the viewer and keeps zero rows as linked data (D-15, X-10)', () => {
    const zero = { ...reviewQueue, mine: { requiresAttention: 0, awaitingRequestor: 0, generationInProgress: 0, withUnreadNotes: 0 }, unassigned: 0 };
    const groups = reviewQueueGroups(zero);
    expect(groups.map((group) => group.caption)).toEqual(['Assigned to you', 'Assessment Requests', 'Questionnaires', 'Risk Assessments']);
    expect(groups.flatMap((group) => group.rows)).toHaveLength(11);
    const [mine, team] = groups;
    expect(mine.rows.map((row) => [row.countText, row.accessibleName])).toEqual([
      ['0', 'Needs your action: 0 Assessment Requests'],
      ['0', 'With new notes: 0 Assessment Requests assigned to you'],
      ['0', 'Awaiting Requestor: 0 Assessment Requests'],
      ['0', 'Generation in progress: 0 Assessment Requests'],
    ]);
    expect(team.rows[0]).toMatchObject({ label: 'Waiting for pick-up', count: 0, href: '/app/review/requests?assignee=unassigned' });
    // The team's figures never read the viewer's, and the viewer's never read the team's.
    expect(reviewQueueGroups({ ...reviewQueue, requiresAttention: 40 })[0].rows[0].count).toBe(3);
    expect(reviewQueueGroups({ ...reviewQueue, mine: { ...reviewQueue.mine, requiresAttention: 40 } })[1].rows[1].count).toBe(2);
    const words = groups.flatMap((group) => [group.caption, ...group.rows.flatMap((row) => [row.label, row.accessibleName])]);
    expect(words.filter((word) => /my attention/i.test(word))).toEqual([]);
  });
});

describe('riskExposureRows', () => {
  const none = { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 };
  function exposureOf(released: DashboardSummary['riskExposure']['released']): DashboardSummary['riskExposure'] {
    return { released, releasedAccepted: none, underAssessment: none };
  }

  it('runs Critical to Low, each a severity row linked to the released open register list of that rating (D-42, UI-SPEC §9.2)', () => {
    expect(riskExposureRows(exposureOf({ Critical: 1, High: 2, Moderate: 0, Low: 4, notRated: 0, total: 7 }))).toEqual([
      { key: 'Critical', rating: 'Critical', labelText: 'Critical', value: 1, href: '/app/risks?residualRating=Critical&state=open&stage=released', tone: 'risk-critical' },
      { key: 'High', rating: 'High', labelText: 'High', value: 2, href: '/app/risks?residualRating=High&state=open&stage=released', tone: 'risk-high' },
      { key: 'Moderate', rating: 'Moderate', labelText: 'Moderate', value: 0, href: '/app/risks?residualRating=Moderate&state=open&stage=released', tone: 'risk-moderate' },
      { key: 'Low', rating: 'Low', labelText: 'Low', value: 4, href: '/app/risks?residualRating=Low&state=open&stage=released', tone: 'risk-low' },
    ]);
    // The label text is the badge's visible word, so the link's name opens with what it shows (SC 2.5.3).
    expect(riskExposureUnit).toEqual({ one: 'released open Risk by residual rating', other: 'released open Risks by residual rating' });
    expect(riskExposureListLabel).toBe('Released open Risks by residual rating');
  });

  it('counts the released Risks only: a Risk under assessment never lifts a released row (D-42)', () => {
    const rows = riskExposureRows({
      released: { Critical: 0, High: 1, Moderate: 0, Low: 0, notRated: 0, total: 1 },
      releasedAccepted: none,
      underAssessment: { Critical: 5, High: 5, Moderate: 5, Low: 5, notRated: 5, total: 25 },
    });
    expect(rows.map((row) => [row.key, row.value])).toEqual([['Critical', 0], ['High', 1], ['Moderate', 0], ['Low', 0]]);
  });

  it('follows a row whose accepted figure is above zero with an accepted link to its accepted released list (D-41, UI-D34)', () => {
    const rows = riskExposureRows({
      released: { Critical: 2, High: 0, Moderate: 3, Low: 1, notRated: 2, total: 8 },
      releasedAccepted: { Critical: 1, High: 0, Moderate: 2, Low: 0, notRated: 1, total: 4 },
      underAssessment: none,
    });
    expect(rows.map((row) => [row.key, row.accepted ?? null])).toEqual([
      ['Critical', {
        label: '1 accepted',
        href: '/app/risks?residualRating=Critical&state=open&stage=released&treatmentAction=Accept',
        accessibleName: '1 accepted Critical Risk',
      }],
      ['High', null],
      ['Moderate', {
        label: '2 accepted',
        href: '/app/risks?residualRating=Moderate&state=open&stage=released&treatmentAction=Accept',
        accessibleName: '2 accepted Moderate Risks',
      }],
      // An accepted figure of zero shows no link (UI-SPEC UI Considerations, analyst Home partial).
      ['Low', null],
      ['notRated', {
        label: '1 accepted',
        href: '/app/risks?residualRating=none&state=open&stage=released&treatmentAction=Accept',
        accessibleName: '1 accepted Not rated Risk',
      }],
    ]);
    expect(rows[1]).not.toHaveProperty('accepted');
  });

  it('adds a Not rated row in ink, linked to the released Risks with no rating, only when it counts something (D-35)', () => {
    const rows = riskExposureRows(exposureOf({ Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 3, total: 3 }));
    expect(rows.at(-1)).toEqual({
      key: 'notRated',
      rating: null,
      labelText: 'Not rated',
      value: 3,
      href: '/app/risks?residualRating=none&state=open&stage=released',
      tone: 'ink',
    });
    expect(rows).toHaveLength(5);
    expect(riskExposureRows(exposureOf({ Critical: 1, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 1 }))).toHaveLength(4);
  });
});

describe('underAssessmentRow', () => {
  const none = { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 };

  it('counts the open Risks under assessment apart, linked to their register list, with its caption (D-41, UI-SPEC §9.2)', () => {
    expect(underAssessmentRow({ released: none, releasedAccepted: none, underAssessment: { ...none, High: 1_203, notRated: 1, total: 1_204 } })).toEqual({
      label: 'Under assessment',
      count: 1_204,
      countText: '1,204',
      href: '/app/risks?state=open&stage=under-assessment',
      accessibleName: 'Under assessment: 1,204 open Risks not yet released',
      caption: 'Not yet released, so not counted above.',
    });
  });

  it('renders at zero and in the singular too, and never counts a released Risk', () => {
    const released = { Critical: 4, High: 4, Moderate: 4, Low: 4, notRated: 4, total: 20 };
    expect(underAssessmentRow({ released, releasedAccepted: none, underAssessment: none })).toMatchObject({
      count: 0,
      countText: '0',
      accessibleName: 'Under assessment: 0 open Risks not yet released',
    });
    expect(underAssessmentRow({ released, releasedAccepted: none, underAssessment: { ...none, Low: 1, total: 1 } }).accessibleName)
      .toBe('Under assessment: 1 open Risk not yet released');
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

  it('links each event to the analyst route for its record and keeps its instant for the viewer’s zone (D-55)', () => {
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
        dateTime: '2026-09-24T23:30:00.000-05:00',
        secondary: 'Assessment Request · Payroll platform assessment',
      },
      {
        key: 'questionnaire-released:ques-1:2026-09-23T09:00:00.000Z',
        linkText: 'QUE-2026-0001',
        href: '/app/review/questionnaires/ques-1',
        phrase: 'released to the Requestor by Bob Doe',
        dateTime: '2026-09-23T09:00:00.000Z',
        secondary: 'Questionnaire · Payroll questionnaire',
      },
      {
        key: 'assessment-released:asm 1:2026-09-04T09:00:00.000Z',
        linkText: 'ASM-2026-AB12CD',
        href: '/app/review/assessments/asm%201',
        phrase: 'released by Bob Doe',
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
        kpi: { status: 'ready', data: { needsYourAction: 0, overdue: 0, dueSoon: 0, attention: 0 } },
        reviewQueue: {
          status: 'ready',
          data: {
            requiresAttention: 0,
            awaitingRequestor: 0,
            generationInProgress: 0,
            questionnairesReadyForReview: 0,
            assessmentsDraft: 0,
            assessmentsInReview: 0,
            mine: { requiresAttention: 0, awaitingRequestor: 0, generationInProgress: 0, withUnreadNotes: 0 },
            unassigned: 0,
          },
        },
        riskExposure: {
          status: 'ready',
          data: {
            released: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 },
            releasedAccepted: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 },
            underAssessment: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 },
          },
        },
        highCritical: { status: 'ready', data: { rows: [], total: 0, truncated: false } },
        treatmentsDue: { status: 'ready', data: { rows: [], total: 0 } },
        upcomingDueDates: { status: 'ready', data: { rows: [], total: 0 } },
        topAlerts: { status: 'ready', data: { rows: [], total: 0 } },
        recentActivity: { status: 'ready', data: { rows: [], truncated: false } },
      },
    });
  });
});
