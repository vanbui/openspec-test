import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/*
 * Quick find's one Server Action (D-49, UI-SPEC §4.2, §4.3). The term is validated before anything is read; the
 * viewer's capabilities choose which existing list searches run, in parallel, each at page size 10; Strapi scopes
 * every read; the action returns display fields and hrefs only. The service modules and the session are mocked:
 * this proves which lists are asked and what leaves the server, never Strapi's scope itself (plan 11-20 does that
 * in the browser).
 */

const listMyRequests = vi.hoisted(() => vi.fn());
const listMyQuestionnaires = vi.hoisted(() => vi.fn());
const listQuestionnairesForReview = vi.hoisted(() => vi.fn());
const listAssessmentRequests = vi.hoisted(() => vi.fn());
const listAnalystAssessments = vi.hoisted(() => vi.fn());
const listMyReleasedAssessments = vi.hoisted(() => vi.fn());
const listRiskRegister = vi.hoisted(() => vi.fn());
const granted = vi.hoisted(() => ({ current: new Set<string>() }));
const signedIn = vi.hoisted(() => ({ current: true }));

vi.mock('../requests/request-service', () => ({ listMyRequests }));
vi.mock('../questionnaires/questionnaire-service', () => ({ listMyQuestionnaires, listQuestionnairesForReview }));
vi.mock('../assessments/assessment-service', () => ({ listAssessmentRequests, listAnalystAssessments, listMyReleasedAssessments }));
vi.mock('../risks/risk-service', () => ({ listRiskRegister }));
vi.mock('@/lib/auth/development-session-adapter', () => ({
  getSessionAdapter: () => ({
    current: async () => (signedIn.current ? { userId: 'user-1', displayName: 'Jane Doe' } : null),
    capabilitiesFor: () => ({ granted: async () => granted.current }),
  }),
}));

import { quickFindAction } from './quick-find-actions';
import { matchCountLabel, quickFindAnnouncement, quickFindOutcomeState, quickFindShowAllHref } from './quick-find-domain';

const requestor = ['assessment-request:read', 'assessment-request:create'];
const allReads = [listMyRequests, listMyQuestionnaires, listQuestionnairesForReview, listAssessmentRequests, listAnalystAssessments, listMyReleasedAssessments, listRiskRegister];

function pagination(total: number) {
  return { page: 1, pageSize: 10, pageCount: Math.ceil(total / 10), total };
}

function myRequest(index: number) {
  return {
    documentId: `request-${index}`,
    requestNumber: `RAR-2026-ABC${index}`,
    title: `Customer portal ${index}`,
    requestStatus: index === 1 ? 'approved' : 'submitted',
    submittedDate: null,
    dueDate: null,
    updatedAt: null,
    daysSinceSubmission: null,
    holder: 'analyst',
    stage: { key: 'submitted', label: 'Submitted' },
    nextAction: null,
    returned: null,
    questionnaire: null,
  };
}

beforeEach(() => {
  signedIn.current = true;
  granted.current = new Set(requestor);
  listMyRequests.mockResolvedValue({ data: { items: [], pagination: pagination(0) }, error: null });
  listMyQuestionnaires.mockResolvedValue({ data: { questionnaires: [], pagination: pagination(0) }, error: null });
  listMyReleasedAssessments.mockResolvedValue({ data: { records: [], pagination: pagination(0) }, error: null });
});

afterEach(() => {
  for (const read of allReads) read.mockReset();
});

describe('quickFindAction for a Requestor', () => {
  it('distinguishes one failed list beside two successful empty lists from an all-list outage', async () => {
    const empty = await quickFindAction({ term: 'portal' });
    if (!empty.ok) throw new Error('expected completed search');
    expect(quickFindOutcomeState(empty.data)).toBe('no-matches');
    expect(quickFindAnnouncement(empty.data)).toBe('No matches for portal');
    listMyQuestionnaires.mockResolvedValue({ data: null, error: { status: 500, message: 'unavailable' } });

    const result = await quickFindAction({ term: 'portal' });
    if (!result.ok) throw new Error('expected completed search');
    expect(quickFindOutcomeState(result.data)).toBe('results');
    expect(quickFindAnnouncement(result.data)).toBe('0 matches. My questionnaires couldn’t be searched.');
    expect(result.data.groups).toEqual([
      { kind: 'my-requests', label: 'My requests', total: 0, status: 'ok', options: [] },
      { kind: 'my-questionnaires', label: 'My questionnaires', total: 0, status: 'failed', options: [] },
      { kind: 'my-assessments', label: 'My risk assessments', total: 0, status: 'ok', options: [] },
    ]);

    listMyRequests.mockResolvedValue({ data: null, error: { status: 500, message: 'unavailable' } });
    listMyReleasedAssessments.mockResolvedValue({ data: null, error: { status: 500, message: 'unavailable' } });
    const outage = await quickFindAction({ term: 'portal' });
    if (!outage.ok) throw new Error('expected completed search');
    expect(quickFindOutcomeState(outage.data)).toBe('unavailable');
  });

  it('asks My requests, My questionnaires and My risk assessments by the term at page size 10, and never an analyst list', async () => {
    await quickFindAction({ term: '  RAR-2026-ABC  ' });

    expect(listMyRequests).toHaveBeenCalledTimes(1);
    expect(listMyRequests).toHaveBeenCalledWith(expect.objectContaining({ q: 'RAR-2026-ABC', page: 1, pageSize: 10 }));
    expect(listMyQuestionnaires).toHaveBeenCalledWith(expect.objectContaining({ q: 'RAR-2026-ABC', page: 1, pageSize: 10 }));
    expect(listMyReleasedAssessments).toHaveBeenCalledWith(expect.objectContaining({ q: 'RAR-2026-ABC', page: 1, pageSize: 10 }));
    for (const analystRead of [listAssessmentRequests, listQuestionnairesForReview, listAnalystAssessments, listRiskRegister]) {
      expect(analystRead).not.toHaveBeenCalled();
    }
  });

  it('returns My requests with at most five options, the served total, and display fields and an href only', async () => {
    listMyRequests.mockResolvedValue({ data: { items: Array.from({ length: 7 }, (_, index) => myRequest(index + 1)), pagination: pagination(7) }, error: null });

    const result = await quickFindAction({ term: 'RAR-2026-ABC' });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.term).toBe('RAR-2026-ABC');
    expect(result.data.groups.map((group) => group.label)).toEqual(['My requests', 'My questionnaires', 'My risk assessments']);
    const [group] = result.data.groups;
    expect(group).toMatchObject({ kind: 'my-requests', label: 'My requests', total: 7, status: 'ok' });
    expect(group.options).toHaveLength(5);
    expect(group.options[0]).toEqual({
      id: 'request-1',
      href: '/app/requests/request-1',
      primary: 'RAR-2026-ABC1 · Customer portal 1',
      secondary: 'Released',
    });
    for (const option of group.options) expect(Object.keys(option).sort()).toEqual(['href', 'id', 'primary', 'secondary']);
  });

  it('lists the three groups in the sidebar’s order, retaining successful groups with no match', async () => {
    listMyRequests.mockResolvedValue({ data: { items: [myRequest(2)], pagination: pagination(1) }, error: null });
    listMyQuestionnaires.mockResolvedValue({
      data: {
        questionnaires: [{ documentId: 'questionnaire-1', questionnaireNumber: 'QUE-2026-0001', title: 'Customer portal questionnaire', state: 'draft' }],
        pagination: pagination(1),
      },
      error: null,
    });
    listMyReleasedAssessments.mockResolvedValue({
      data: {
        records: [{ documentId: 'assessment-1', assessmentNumber: 'ASM-2026-0001', assessmentStatus: 'approved', requestTitle: 'Customer portal' }],
        pagination: pagination(1),
      },
      error: null,
    });

    const result = await quickFindAction({ term: 'portal' });
    expect(result.ok && result.data.groups.map((group) => group.label)).toEqual(['My requests', 'My questionnaires', 'My risk assessments']);
    if (!result.ok) return;
    expect(result.data.groups[1].options[0]).toEqual({
      id: 'questionnaire-1', href: '/app/questionnaires/questionnaire-1', primary: 'QUE-2026-0001 · Customer portal questionnaire', secondary: 'Draft',
    });
    expect(result.data.groups[2].options[0]).toEqual({
      id: 'assessment-1', href: '/app/assessments/assessment-1', primary: 'ASM-2026-0001 · Customer portal', secondary: 'Released',
    });

    listMyQuestionnaires.mockResolvedValue({ data: { questionnaires: [], pagination: pagination(0) }, error: null });
    const fewer = await quickFindAction({ term: 'portal' });
    expect(fewer.ok && fewer.data.groups.map((group) => group.label)).toEqual(['My requests', 'My questionnaires', 'My risk assessments']);
    if (!fewer.ok) return;
    expect(fewer.data.groups[1]).toEqual({ kind: 'my-questionnaires', label: 'My questionnaires', total: 0, status: 'ok', options: [] });
  });

  it.each([
    ['one character after trimming', { term: '  R ' }],
    ['101 characters', { term: 'R'.repeat(101) }],
    ['no term', {}],
    ['a term that is not text', { term: 42 }],
    ['an unknown field', { term: 'RAR-2026', queue: 'all' }],
  ])('refuses %s and reads nothing', async (_case, input) => {
    const result = await quickFindAction(input);

    expect(result.ok).toBe(false);
    for (const read of allReads) expect(read).not.toHaveBeenCalled();
  });

  it('reads nothing without a session', async () => {
    signedIn.current = false;

    expect((await quickFindAction({ term: 'portal' })).ok).toBe(false);
    for (const read of allReads) expect(read).not.toHaveBeenCalled();
  });
});

const analyst = ['assessment-request:read', 'assessment-request:create', 'assessment:review', 'risk:manage'];

function queueItem(index: number) {
  return {
    documentId: `review-${index}`,
    requestNumber: `RAR-2026-REV${index}`,
    title: `Payroll platform ${index}`,
    requestStatus: 'under-review',
    submittedDate: null,
    requestorName: 'Jane Doe',
    assessmentType: 'BAU',
    businessCriticality: 'High',
    dueDate: null,
    daysSinceSubmission: null,
    // Even requests are held by Bob Doe; odd ones wait for pick-up (D-13).
    assignee: index % 2 === 0 ? { documentId: 'bob-id', displayName: 'Bob Doe' } : null,
    pickUp: 'not-offered',
    unreadNotes: 0,
  };
}

function risk(index: number, overrides: Record<string, unknown> = {}) {
  return {
    documentId: `risk-${index}`,
    riskNumber: `RSK-2026-000${index}`,
    riskStatement: `Payroll platform backups are not tested ${index}.`,
    inherentRating: 'High',
    residualRating: 'High',
    treatmentStatus: 'In Progress',
    treatmentOwner: null,
    targetDate: null,
    treatmentDueState: 'later',
    assessment: { documentId: 'assessment-1', assessmentNumber: 'ASM-2026-0001', title: 'Payroll platform' },
    stage: 'released',
    treatmentAction: null,
    ...overrides,
  };
}

function stubAnalystLists() {
  listAssessmentRequests.mockResolvedValue({ data: { records: Array.from({ length: 10 }, (_, index) => queueItem(index + 1)), pagination: pagination(12) }, error: null });
  listQuestionnairesForReview.mockResolvedValue({
    data: {
      questionnaires: [{ documentId: 'questionnaire-9', questionnaireNumber: 'QUE-2026-0009', title: 'Payroll platform questionnaire', state: 'submitted', release: null }],
      pagination: pagination(1),
    },
    error: null,
  });
  listAnalystAssessments.mockResolvedValue({
    data: { records: [{ documentId: 'assessment-1', assessmentNumber: 'ASM-2026-0001', assessmentStatus: 'in-review', requestTitle: 'Payroll platform' }], pagination: pagination(1) },
    error: null,
  });
  listRiskRegister.mockResolvedValue({
    data: { data: [risk(1), risk(2, { residualRating: null, stage: 'under-assessment' })], meta: { pagination: pagination(2), selectedLabels: {} } },
    error: null,
  });
  listMyRequests.mockResolvedValue({ data: { items: [myRequest(4)], pagination: pagination(1) }, error: null });
}

describe('quickFindAction for a Security Analyst', () => {
  beforeEach(() => {
    granted.current = new Set(analyst);
    stubAnalystLists();
  });

  it('reads the five lists in parallel, Requests across every queue, and returns them in the sidebar’s order', async () => {
    const result = await quickFindAction({ term: 'Payroll' });

    expect(listAssessmentRequests).toHaveBeenCalledWith(expect.objectContaining({ q: 'Payroll', queue: 'all', page: 1, pageSize: 10 }));
    expect(listQuestionnairesForReview).toHaveBeenCalledWith(expect.objectContaining({ q: 'Payroll', page: 1, pageSize: 10 }));
    expect(listAnalystAssessments).toHaveBeenCalledWith(expect.objectContaining({ q: 'Payroll', page: 1, pageSize: 10 }));
    expect(listRiskRegister).toHaveBeenCalledWith(expect.objectContaining({ q: 'Payroll', page: 1, pageSize: 10 }));
    expect(listMyRequests).toHaveBeenCalledWith(expect.objectContaining({ q: 'Payroll', page: 1, pageSize: 10 }));
    expect(listMyQuestionnaires).not.toHaveBeenCalled();
    expect(listMyReleasedAssessments).not.toHaveBeenCalled();
    expect(result.ok && result.data.groups.map((group) => group.label)).toEqual(['Requests', 'Questionnaires', 'Risk assessments', 'Risk register', 'My requests']);
  });

  it('starts every read before any settles', async () => {
    const started: string[] = [];
    const never = <T,>(name: string) => () => { started.push(name); return new Promise<T>(() => undefined); };
    listAssessmentRequests.mockImplementation(never('requests'));
    listQuestionnairesForReview.mockImplementation(never('questionnaires'));
    listAnalystAssessments.mockImplementation(never('assessments'));
    listRiskRegister.mockImplementation(never('risks'));
    listMyRequests.mockImplementation(never('my-requests'));

    void quickFindAction({ term: 'Payroll' });
    await vi.waitFor(() => expect(started.sort()).toEqual(['assessments', 'my-requests', 'questionnaires', 'requests', 'risks']));
  });

  it('never asks the Risk register without risk:manage', async () => {
    granted.current = new Set(['assessment-request:read', 'assessment-request:create', 'assessment:review']);

    const result = await quickFindAction({ term: 'Payroll' });
    expect(listRiskRegister).not.toHaveBeenCalled();
    expect(result.ok && result.data.groups.map((group) => group.label)).toEqual(['Requests', 'Questionnaires', 'Risk assessments', 'My requests']);
  });

  it('shows five options of a larger group, its served total and a Show all link to its list filtered by the term', async () => {
    const result = await quickFindAction({ term: 'Payroll platform' });
    if (!result.ok) throw new Error('expected results');
    const [requests, questionnaires] = result.data.groups;

    expect(requests).toMatchObject({ kind: 'review-requests', total: 12, status: 'ok', showAllHref: '/app/review/requests?queue=all&q=Payroll%20platform' });
    expect(requests.options).toHaveLength(5);
    // D-13 (13-UI-SPEC §4): line 2 says who holds the request, from the queue's own projection.
    expect(requests.options[0]).toEqual({ id: 'review-1', href: '/app/review/requests/review-1', primary: 'RAR-2026-REV1 · Payroll platform 1', secondary: 'Under review · Not picked up' });
    expect(requests.options[1].secondary).toBe('Under review · Assigned to Bob Doe');
    expect(listAssessmentRequests, 'the holder comes with the search, with no read of its own').toHaveBeenCalledTimes(1);
    expect(questionnaires.showAllHref, 'five or fewer: the options are everything').toBeUndefined();
    expect(questionnaires.options[0]).toEqual({
      id: 'questionnaire-9', href: '/app/review/questionnaires/questionnaire-9', primary: 'QUE-2026-0009 · Payroll platform questionnaire', secondary: 'Analyst review',
    });
  });

  it('opens each analyst kind on its own route, and says a Risk’s residual rating and stage', async () => {
    const result = await quickFindAction({ term: 'Payroll' });
    if (!result.ok) throw new Error('expected results');
    const byLabel = Object.fromEntries(result.data.groups.map((group) => [group.label, group]));

    expect(byLabel['Risk assessments'].options[0]).toEqual({
      id: 'assessment-1', href: '/app/review/assessments/assessment-1', primary: 'ASM-2026-0001 · Payroll platform', secondary: 'In review',
    });
    expect(byLabel['Risk register'].options).toEqual([
      { id: 'risk-1', href: '/app/risks/risk-1', primary: 'RSK-2026-0001 · Payroll platform backups are not tested 1.', secondary: 'Residual rating: High · Released' },
      { id: 'risk-2', href: '/app/risks/risk-2', primary: 'RSK-2026-0002 · Payroll platform backups are not tested 2.', secondary: 'Residual rating: Not rated · Under assessment' },
    ]);
    expect(byLabel['My requests'].options[0].href).toBe('/app/requests/request-4');
  });

  it('marks a list whose read failed or threw, and still returns the others', async () => {
    listRiskRegister.mockRejectedValue(new Error('socket hang up'));
    listQuestionnairesForReview.mockResolvedValue({ data: null, error: { message: 'private failure detail', status: 503 } });

    const result = await quickFindAction({ term: 'Payroll' });
    if (!result.ok) throw new Error('expected results');
    const byLabel = Object.fromEntries(result.data.groups.map((group) => [group.label, group]));

    expect(byLabel['Risk register']).toEqual({ kind: 'risks', label: 'Risk register', total: 0, status: 'failed', options: [] });
    expect(byLabel.Questionnaires).toEqual({ kind: 'review-questionnaires', label: 'Questionnaires', total: 0, status: 'failed', options: [] });
    expect(byLabel.Requests.status).toBe('ok');
    expect(JSON.stringify(result)).not.toContain('private failure detail');
  });

  it('leaves out a list Strapi refuses', async () => {
    listRiskRegister.mockResolvedValue({ data: null, error: { message: 'Forbidden', status: 403 } });

    const result = await quickFindAction({ term: 'Payroll' });
    expect(result.ok && result.data.groups.map((group) => group.label)).toEqual(['Requests', 'Questionnaires', 'Risk assessments', 'My requests']);
  });
});

describe('quick find’s Show all destinations and match counts (UI-SPEC §4.3, §4.4)', () => {
  it.each([
    ['review-requests', '/app/review/requests?queue=all&q=RAR%202026'],
    ['review-questionnaires', '/app/review/questionnaires?q=RAR%202026'],
    ['review-assessments', '/app/review/assessments?q=RAR%202026'],
    ['risks', '/app/risks?q=RAR%202026'],
    ['my-requests', '/app/requests?q=RAR%202026'],
    ['my-questionnaires', '/app/questionnaires?q=RAR%202026'],
    ['my-assessments', '/app/assessments?q=RAR%202026'],
  ] as const)('%s opens %s', (kind, href) => {
    expect(quickFindShowAllHref(kind, 'RAR 2026')).toBe(href);
  });

  it('says match for one and matches otherwise', () => {
    expect(matchCountLabel(1)).toBe('1 match');
    expect(matchCountLabel(0)).toBe('0 matches');
    expect(matchCountLabel(1234)).toBe('1,234 matches');
  });
});
