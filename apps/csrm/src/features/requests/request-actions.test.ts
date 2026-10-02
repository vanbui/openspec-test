import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as requestSchemas from './request-schema';

const createRequest = vi.hoisted(() => vi.fn());
const updateRequest = vi.hoisted(() => vi.fn());
const submitRequest = vi.hoisted(() => vi.fn());
const revertRequestToDraft = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() => vi.fn());

vi.mock('./request-service', () => ({ createRequest, updateRequest, submitRequest, revertRequestToDraft }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('next/navigation', () => ({ redirect }));

const actionsPath = resolve(process.cwd(), 'src/features/requests/request-actions.ts');

async function loadActions() {
  if (!existsSync(actionsPath)) {
    throw new Error('PHASE2_RED_W0_03A_MUTATION_ACTION_BEHAVIOR_ABSENT');
  }

  const actionsModule = './request-' + 'actions';
  return import(/* @vite-ignore */ actionsModule);
}

afterEach(() => {
  createRequest.mockReset();
  updateRequest.mockReset();
  submitRequest.mockReset();
  revertRequestToDraft.mockReset();
  revalidatePath.mockReset();
  redirect.mockReset();
});

describe('request mutation action contract', () => {
  it('maps trusted request mutations through validated Server Actions', async () => {
    const draft = {
      title: 'Customer portal review',
      description: 'Review the new customer portal.',
      assessmentType: 'Project',
      division: 'Digital',
      businessUnit: 'Customer platforms',
      businessPurpose: 'Serve customers online',
      businessCriticality: 'High',
      thirdPartyInvolvement: true,
      thirdPartyDetails: 'Hosted by an approved provider',
      regulatoryRequirements: 'Privacy Act',
      dueDate: '2026-09-12',
      informationSystems: ['system-1'],
      informationAssets: ['asset-1'],
      requestor: 'forged-requestor',
      requestNumber: 'FORGED',
      requestStatus: 'closed',
      submittedDate: '2020-01-01T00:00:00.000Z',
      sponsor: 'forged-sponsor',
      questionnaire: 'forged-questionnaire',
      assessment: 'forged-assessment',
    };

    const actions = await loadActions();
    if (!('requestDraftSchema' in requestSchemas) || !('requestSubmitSchema' in requestSchemas)) {
      throw new Error('PHASE2_RED_W0_03A_MUTATION_ACTION_BEHAVIOR_ABSENT');
    }
    const { requestDraftSchema, requestSubmitSchema } = requestSchemas as unknown as {
      requestDraftSchema: { parse: (input: unknown) => Record<string, unknown> };
      requestSubmitSchema: { safeParse: (input: unknown) => { success: boolean } };
    };
    const parsedDraft = requestDraftSchema.parse(draft);
    expect(parsedDraft).not.toHaveProperty('requestor');
    expect(parsedDraft).not.toHaveProperty('requestNumber');
    expect(parsedDraft).not.toHaveProperty('requestStatus');
    expect(parsedDraft).not.toHaveProperty('submittedDate');
    expect(parsedDraft).not.toHaveProperty('sponsor');
    expect(requestSubmitSchema.safeParse({ documentId: 'request-1', title: 'Title only is authoritative' }).success).toBe(true);
    expect(requestSubmitSchema.safeParse({ documentId: 'request-1', ...draft }).success).toBe(true);
    expect(requestSubmitSchema.safeParse({ documentId: 'request-1', ...draft, title: '' }).success).toBe(false);

    const saved = {
      documentId: 'request-1',
      requestNumber: 'RAR-2026-X7K4Q2',
      requestStatus: 'draft',
      title: parsedDraft.title,
      submittedDate: null,
    };
    const submitted = { ...saved, requestStatus: 'submitted', submittedDate: '2026-08-29T00:00:00.000Z' };
    createRequest.mockResolvedValueOnce({ data: saved, error: null });
    updateRequest.mockResolvedValueOnce({ data: saved, error: null });
    submitRequest.mockResolvedValueOnce({ data: submitted, error: null });

    await actions.createRequestAction(draft);
    await actions.updateRequestAction({ documentId: 'request-1', ...draft });
    await expect(actions.submitRequestAction({ documentId: 'request-1', ...draft })).resolves.toEqual({ ok: true, data: submitted });

    expect(createRequest).toHaveBeenCalledWith(parsedDraft);
    expect(updateRequest).toHaveBeenCalledWith('request-1', parsedDraft);
    expect(submitRequest).toHaveBeenCalledWith('request-1', parsedDraft);
    expect(revalidatePath.mock.calls).toEqual([
      ['/app'], ['/app/requests'],
      ['/app'], ['/app/requests'], ['/app/requests/request-1'],
      ['/app'], ['/app/requests'], ['/app/requests/request-1'],
    ]);
    expect(redirect.mock.calls).toEqual([
      ['/app/requests/request-1'], ['/app/requests/request-1'],
    ]);
    expect(revalidatePath.mock.invocationCallOrder[1]).toBeLessThan(redirect.mock.invocationCallOrder[0]);
    expect(revalidatePath.mock.invocationCallOrder[3]).toBeLessThan(redirect.mock.invocationCallOrder[1]);

    createRequest.mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 403 } });
    updateRequest.mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 409 } });
    submitRequest.mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 503 } });
    createRequest.mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 404 } });

    await expect(actions.createRequestAction(draft)).resolves.toEqual({
      ok: false,
      formError: 'You do not have permission to save this request.',
    });
    await expect(actions.updateRequestAction({ documentId: 'request-1', ...draft })).resolves.toEqual({
      ok: false,
      formError: 'This request can’t be saved in its current state.',
    });
    await expect(actions.submitRequestAction({ documentId: 'request-1', ...draft })).resolves.toEqual({
      ok: false,
      formError: 'The request service is unavailable. Please try again later.',
    });
    await expect(actions.createRequestAction(draft)).resolves.toEqual({
      ok: false,
      formError: 'This request is no longer available.',
    });
    await expect(actions.createRequestAction({ title: '' })).resolves.toMatchObject({
      ok: false,
      fieldErrors: { title: expect.any(Array) },
    });

    expect(revalidatePath).toHaveBeenCalledTimes(8);
    expect(redirect).toHaveBeenCalledTimes(2);
  });

  it('says a create or submit conflict cannot be saved in the request’s current state, not that it changed', async () => {
    const actions = await loadActions();
    const draft = { title: 'Customer portal review' };
    createRequest.mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 409 } });
    submitRequest.mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 409, reason: 'REQUEST_NOT_SUBMITTED' } });

    await expect(actions.createRequestAction(draft)).resolves.toEqual({ ok: false, formError: 'This request can’t be saved in its current state.' });
    await expect(actions.submitRequestAction({ documentId: 'request-1', ...draft })).resolves.toEqual({
      ok: false,
      formError: 'This request can’t be saved in its current state.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe('request return to draft refusals (UI-SPEC §10.2 A)', () => {
  const input = { documentId: 'request-1', reason: 'Scope changed' };
  const conflict = (reason?: string) => ({ data: null, error: { message: 'raw backend detail', status: 409, ...(reason ? { reason } : {}) } });

  it('states that work has started and returns the served reason', async () => {
    const actions = await loadActions();
    revertRequestToDraft.mockResolvedValueOnce(conflict('REQUEST_WORK_STARTED'));

    await expect(actions.revertRequestToDraftAction(input)).resolves.toEqual({
      ok: false,
      formError: 'Work on this request has started, so it can no longer return to draft.',
      reason: 'REQUEST_WORK_STARTED',
    });
    expect(revertRequestToDraft).toHaveBeenCalledWith('request-1', 'Scope changed');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('asks for a refresh only when the request is no longer submitted', async () => {
    const actions = await loadActions();
    revertRequestToDraft.mockResolvedValueOnce(conflict('REQUEST_NOT_SUBMITTED'));

    await expect(actions.revertRequestToDraftAction(input)).resolves.toEqual({
      ok: false,
      formError: 'Only a submitted request can return to draft, and this one is no longer submitted. Refresh the page to see where it is.',
      reason: 'REQUEST_NOT_SUBMITTED',
    });
  });

  it('falls back without a reason and never says the request changed', async () => {
    const actions = await loadActions();
    revertRequestToDraft.mockResolvedValueOnce(conflict());

    const result = await actions.revertRequestToDraftAction(input);
    expect(result).toEqual({ ok: false, formError: 'This request can’t return to draft in its current state.' });
    expect(result).not.toHaveProperty('reason');
  });

  it('keeps the existing permission, missing and unavailable messages', async () => {
    const actions = await loadActions();
    revertRequestToDraft
      .mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 403 } })
      .mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 404 } })
      .mockResolvedValueOnce({ data: null, error: { message: 'raw backend detail', status: 503 } });

    await expect(actions.revertRequestToDraftAction(input)).resolves.toEqual({ ok: false, formError: 'You do not have permission to save this request.' });
    await expect(actions.revertRequestToDraftAction(input)).resolves.toEqual({ ok: false, formError: 'This request is no longer available.' });
    await expect(actions.revertRequestToDraftAction(input)).resolves.toEqual({ ok: false, formError: 'The request service is unavailable. Please try again later.' });
  });
});
