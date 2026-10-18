import { afterEach, describe, expect, it, vi } from 'vitest';

const changeRequestAssignee = vi.hoisted(() => vi.fn());
const listAssignableAnalysts = vi.hoisted(() => vi.fn());
const getRequest = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());

vi.mock('./assignment-service', () => ({ changeRequestAssignee, listAssignableAnalysts }));
vi.mock('@/features/requests/request-service', () => ({ getRequest }));
vi.mock('next/cache', () => ({ revalidatePath }));

import * as actions from './assignment-actions';

afterEach(() => {
  for (const mock of [changeRequestAssignee, listAssignableAnalysts, getRequest, revalidatePath]) mock.mockReset();
});

const bob = { documentId: 'u1', displayName: 'Bob Doe' };
const second = { documentId: 'u2', displayName: 'Second Analyst' };

describe('listAssignableAnalystsAction', () => {
  it('returns the eligible analysts the typed service read, and revalidates nothing', async () => {
    listAssignableAnalysts.mockResolvedValueOnce({ data: [bob, second], error: null });
    await expect(actions.listAssignableAnalystsAction({ requestId: 'r1' })).resolves.toEqual({ ok: true, data: [bob, second] });
    expect(listAssignableAnalysts).toHaveBeenCalledWith('r1', undefined);
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('passes the search term to the service', async () => {
    listAssignableAnalysts.mockResolvedValueOnce({ data: [second], error: null });
    await expect(actions.listAssignableAnalystsAction({ requestId: 'r1', q: 'sec' })).resolves.toEqual({ ok: true, data: [second] });
    expect(listAssignableAnalysts).toHaveBeenCalledWith('r1', 'sec');
  });

  it('returns a refusal as blocked with its closed reason', async () => {
    listAssignableAnalysts.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403, reason: 'OWN_REQUEST' } });
    await expect(actions.listAssignableAnalystsAction({ requestId: 'r1' })).resolves.toMatchObject({ ok: false, kind: 'blocked', reason: 'OWN_REQUEST' });
  });

  it('reads family K for a refused list, and the picker’s own sentence when Security Analysts couldn’t load (UI-SPEC §6, §7.4)', async () => {
    listAssignableAnalysts.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403, reason: 'OWN_REQUEST' } });
    await expect(actions.listAssignableAnalystsAction({ requestId: 'r1' })).resolves.toEqual({
      ok: false,
      kind: 'blocked',
      reason: 'OWN_REQUEST',
      message: 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.',
    });
    listAssignableAnalysts.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403 } });
    await expect(actions.listAssignableAnalystsAction({ requestId: 'r1' })).resolves.toEqual({
      ok: false, kind: 'blocked', message: 'You can’t change who this request is assigned to.',
    });
    listAssignableAnalysts.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, reason: 'REQUEST_NOT_SUBMITTED' } });
    await expect(actions.listAssignableAnalystsAction({ requestId: 'r1' })).resolves.toMatchObject({
      kind: 'blocked', message: 'This request is a draft now, so its assignment can’t change. Refresh the page to see where it is.',
    });
    listAssignableAnalysts.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    await expect(actions.listAssignableAnalystsAction({ requestId: 'r1' })).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t load Security Analysts.',
    });
  });

  it('refuses invalid input without calling the service', async () => {
    for (const input of [{ requestId: 'r1', extra: true }, { requestId: '' }, { requestId: 'r1', q: 'x'.repeat(101) }, null, 'r1']) {
      const result = await actions.listAssignableAnalystsAction(input);
      expect(result.ok).toBe(false);
    }
    expect(listAssignableAnalysts).not.toHaveBeenCalled();
  });
});

const assignment = {
  assignee: second,
  assignedBy: bob,
  assignedAt: '2026-10-09T01:02:03.000Z',
  actions: ['assign-to-me', 'reassign', 'unassign'],
  ownRequest: false,
  history: [{ action: 'assign', by: bob, at: '2026-10-09T01:02:03.000Z', from: null, to: second, reason: null }],
  viewer: bob,
};
const change = { requestId: 'r1', requestNumber: 'RAR-2026-0001', analyst: 'u2', expectedAnalyst: null };

describe('changeAssigneeAction', () => {
  /*
   * The request pages, the queues and Home, and (IN-307) the analyst questionnaire and assessment pages, whose request
   * context line names the assignee or offers Pick up (13-UI-SPEC §11), as the notes actions revalidate them.
   */
  it('changes the assignee once through the typed service and revalidates every page that shows the assignee', async () => {
    changeRequestAssignee.mockResolvedValueOnce({ data: assignment, error: null });
    await expect(actions.changeAssigneeAction({ ...change, reason: 'Covering the queue.' })).resolves.toEqual({ ok: true, data: assignment });
    expect(changeRequestAssignee).toHaveBeenCalledTimes(1);
    expect(changeRequestAssignee).toHaveBeenCalledWith({ requestId: 'r1', analyst: 'u2', expectedAnalyst: null, reason: 'Covering the queue.' });
    expect(revalidatePath.mock.calls.map((call) => call.join(' ')).sort()).toEqual([
      '/app',
      '/app/requests/r1',
      '/app/review/assessments layout',
      '/app/review/assigned',
      '/app/review/questionnaires layout',
      '/app/review/requests',
      '/app/review/requests/r1',
    ]);
    expect(getRequest).not.toHaveBeenCalled();
  });

  it('re-reads the request once on ASSIGNMENT_CHANGED and names who holds it now', async () => {
    changeRequestAssignee.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, reason: 'ASSIGNMENT_CHANGED' } });
    getRequest.mockResolvedValueOnce({ data: { documentId: 'r1', assignment }, error: null });
    await expect(actions.changeAssigneeAction(change)).resolves.toEqual({
      ok: false,
      kind: 'blocked',
      reason: 'ASSIGNMENT_CHANGED',
      currentHolder: 'Second Analyst',
      message: 'Second Analyst now holds this request, so your change wasn’t made.',
    });
    expect(getRequest).toHaveBeenCalledTimes(1);
    expect(getRequest).toHaveBeenCalledWith('r1');
  });

  it('says the request went back to the queue when the re-read shows nobody holds it', async () => {
    changeRequestAssignee.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, reason: 'ASSIGNMENT_CHANGED' } });
    getRequest.mockResolvedValueOnce({ data: { documentId: 'r1', assignment: { ...assignment, assignee: null, assignedBy: null, assignedAt: null } }, error: null });
    await expect(actions.changeAssigneeAction(change)).resolves.toEqual({
      ok: false,
      kind: 'blocked',
      reason: 'ASSIGNMENT_CHANGED',
      currentHolder: null,
      message: 'This request was returned to the queue, so your change wasn’t made.',
    });
  });

  it('reads the family fallback when the re-read after ASSIGNMENT_CHANGED fails', async () => {
    changeRequestAssignee.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, reason: 'ASSIGNMENT_CHANGED' } });
    getRequest.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    await expect(actions.changeAssigneeAction(change)).resolves.toEqual({
      ok: false,
      kind: 'blocked',
      reason: 'ASSIGNMENT_CHANGED',
      message: 'This request’s assignment can’t change in its current state.',
    });
  });

  it('names the analyst who can’t be assigned, and reads the other refusals in family K', async () => {
    changeRequestAssignee.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, reason: 'ASSIGNEE_NOT_ELIGIBLE' } });
    await expect(actions.changeAssigneeAction({ ...change, analystName: 'Second Analyst' })).resolves.toMatchObject({
      ok: false, kind: 'blocked', reason: 'ASSIGNEE_NOT_ELIGIBLE', message: 'Second Analyst can’t be assigned this request. Choose another Security Analyst.',
    });
    changeRequestAssignee.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 403, reason: 'OWN_REQUEST' } });
    await expect(actions.changeAssigneeAction(change)).resolves.toMatchObject({
      ok: false, kind: 'blocked', reason: 'OWN_REQUEST', message: 'A Security Analyst can’t pick up or assign a request they raised. Another Security Analyst picks it up.',
    });
    changeRequestAssignee.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 409, reason: 'ASSIGNMENT_REQUIRED' } });
    await expect(actions.changeAssigneeAction({ ...change, analyst: null, expectedAnalyst: 'u2' })).resolves.toMatchObject({
      kind: 'blocked', message: 'A released request keeps an assigned Security Analyst. Reassign it instead.',
    });
    changeRequestAssignee.mockResolvedValueOnce({ data: null, error: { message: 'unavailable', status: 404 } });
    await expect(actions.changeAssigneeAction(change)).resolves.toMatchObject({ kind: 'blocked', message: 'This request is no longer available.' });
    expect(getRequest).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a network failure as retryable', async () => {
    changeRequestAssignee.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    await expect(actions.changeAssigneeAction(change)).resolves.toEqual({
      ok: false, kind: 'retryable', message: 'We couldn’t change the assignment. Try again.',
    });
  });

  it('refuses invalid input without calling the service', async () => {
    for (const input of [
      { ...change, assignedBy: 'u1' },
      { requestId: 'r1', analyst: 'u2', expectedAnalyst: null },
      { ...change, expectedAnalyst: undefined },
      { ...change, analyst: 7 },
      null,
    ]) {
      const result = await actions.changeAssigneeAction(input);
      expect(result.ok).toBe(false);
    }
    await expect(actions.changeAssigneeAction({ ...change, reason: 'x'.repeat(501) })).resolves.toMatchObject({
      ok: false, kind: 'blocked', message: 'Keep the reason to 500 characters or fewer.',
    });
    expect(changeRequestAssignee).not.toHaveBeenCalled();
  });
});
