import { afterEach, describe, expect, it, vi } from 'vitest';

const getAiRun = vi.hoisted(() => vi.fn());
const decideAiProposals = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const getRequest = vi.hoisted(() => vi.fn());
const getQuestionnaireGovernanceQuestions = vi.hoisted(() => vi.fn());
vi.mock('./ai-assistance-service', () => ({ getAiRun, decideAiProposals }));
vi.mock('next/cache', () => ({ revalidatePath }));
vi.mock('../requests/request-service', () => ({ getRequest }));
vi.mock('../questionnaires/questionnaire-service', () => ({ getQuestionnaireGovernanceQuestions }));

const { decideAiProposalsAction, getAiRunAction, readAiSourceAction } = await import('./ai-assistance-actions');

afterEach(() => {
  getAiRun.mockReset();
  decideAiProposals.mockReset();
  revalidatePath.mockReset();
  getRequest.mockReset();
  getQuestionnaireGovernanceQuestions.mockReset();
});

/* 12-UI-SPEC §4.2 (D-03): a citation's source, read through the existing analyst reads. */
describe('readAiSourceAction', () => {
  const request = {
    documentId: 'request-1', requestNumber: 'RAR-2026-0001', regulatoryRequirements: 'Privacy Act 1988', thirdPartyDetails: null, thirdPartyInvolvement: true,
    relationships: { questionnaire: { availability: 'available', documentId: 'questionnaire 1', questionnaireNumber: 'QNR-1', title: 'Q', state: 'submitted' }, assessment: { availability: 'absent' } },
  };
  const question = {
    questionKey: 'payment-files', questionText: 'Are payment files signed before upload?', section: { key: 'payment', title: 'Payment processing', order: 1 },
    helpText: 'Describe the integrity control.', answerType: 'Single select', choices: [{ value: 'no', label: 'No, not yet' }],
    answer: { schemaVersion: 1, value: 'no', state: 'submitted', updatedAt: '2026-10-01T00:00:00.000Z', submittedAt: '2026-10-01T00:00:00.000Z' },
  };

  it('reads a request field with its label and value', async () => {
    getRequest.mockResolvedValue({ data: request, error: null });
    await expect(readAiSourceAction({ requestId: 'request-1', sourceKey: 'request.regulatoryRequirements' })).resolves.toEqual({ ok: true, data: {
      kind: 'request', label: 'Regulatory requirements', value: 'Privacy Act 1988', requestNumber: 'RAR-2026-0001', href: '/app/review/requests/request-1',
    } });
    await expect(readAiSourceAction({ requestId: 'request-1', sourceKey: 'request.thirdPartyDetails' })).resolves.toMatchObject({ data: { value: null } });
    await expect(readAiSourceAction({ requestId: 'request-1', sourceKey: 'request.thirdPartyInvolvement' })).resolves.toMatchObject({ data: { value: 'Yes' } });
  });

  it('reads an answer with its section, help text and choice label', async () => {
    getRequest.mockResolvedValue({ data: request, error: null });
    getQuestionnaireGovernanceQuestions.mockResolvedValue({ data: { definition: [question], placements: [] }, error: null });
    await expect(readAiSourceAction({ requestId: 'request-1', sourceKey: 'answer.payment-files' })).resolves.toEqual({ ok: true, data: {
      kind: 'answer', questionText: 'Are payment files signed before upload?', section: 'Payment processing', helpText: 'Describe the integrity control.',
      answer: 'No, not yet', href: '/app/review/questionnaires/questionnaire%201',
    } });
    expect(getQuestionnaireGovernanceQuestions).toHaveBeenCalledWith('questionnaire 1');
  });

  it('reads a removed question, an unknown field or a 404 as missing, and a 403 as permission', async () => {
    getRequest.mockResolvedValue({ data: request, error: null });
    getQuestionnaireGovernanceQuestions.mockResolvedValue({ data: { definition: [question], placements: [] }, error: null });
    await expect(readAiSourceAction({ requestId: 'request-1', sourceKey: 'answer.gone' })).resolves.toEqual({ ok: true, data: { kind: 'missing' } });
    await expect(readAiSourceAction({ requestId: 'request-1', sourceKey: 'request.requestor' })).resolves.toEqual({ ok: true, data: { kind: 'missing' } });
    getRequest.mockResolvedValueOnce({ data: null, error: { message: 'x', status: 404 } });
    await expect(readAiSourceAction({ requestId: 'request-1', sourceKey: 'request.title' })).resolves.toEqual({ ok: true, data: { kind: 'missing' } });
    getRequest.mockResolvedValueOnce({ data: null, error: { message: 'x', status: 403 } });
    await expect(readAiSourceAction({ requestId: 'request-1', sourceKey: 'request.title' })).resolves.toEqual({ ok: false, status: 403, failure: 'permission' });
  });

  it.each([
    { requestId: 'request-1', sourceKey: 'system-1' },
    { requestId: 'request-1', sourceKey: 'answer.<script>' },
    { requestId: '', sourceKey: 'request.title' },
    { requestId: 'request-1', sourceKey: 'request.title', extra: true },
  ])('refuses %o without reading', async (input) => {
    await expect(readAiSourceAction(input)).resolves.toEqual({ ok: false, status: 400, failure: 'error' });
    expect(getRequest).not.toHaveBeenCalled();
  });
});

describe('getAiRunAction', () => {
  it('returns the run the service read', async () => {
    getAiRun.mockResolvedValueOnce({ data: { documentId: 'run-1' }, error: null });
    await expect(getAiRunAction({ runId: 'run-1' })).resolves.toEqual({ ok: true, data: { documentId: 'run-1' } });
    expect(getAiRun).toHaveBeenCalledWith('run-1');
  });

  it('names a refused read in the UI-SPEC permission copy and keeps its status', async () => {
    getAiRun.mockResolvedValueOnce({ data: null, error: { message: 'denied', status: 403 } });
    await expect(getAiRunAction({ runId: 'run-1' })).resolves.toEqual({ ok: false, status: 403, formError: 'You don’t have access to this AI run' });
  });

  it('names any other failure in the UI-SPEC error copy', async () => {
    getAiRun.mockResolvedValueOnce({ data: null, error: { message: 'missing', status: 404 } });
    await expect(getAiRunAction({ runId: 'run-1' })).resolves.toEqual({ ok: false, status: 404, formError: 'We couldn’t load what the AI used' });
  });

  it('refuses invalid input without reading', async () => {
    await expect(getAiRunAction({ runId: '', extra: true })).resolves.toMatchObject({ ok: false, status: 400 });
    expect(getAiRun).not.toHaveBeenCalled();
  });
});

describe('decideAiProposalsAction', () => {
  const addSuggestion = { target: { kind: 'risk', riskId: 'risk-1' }, action: 'accept', suggestion: 'UATA-001' } as const;

  it('records a batch with one service call and revalidates the editor', async () => {
    decideAiProposals.mockResolvedValueOnce({ data: { applied: 1, unchanged: 0 }, error: null });
    await expect(decideAiProposalsAction({ assessmentId: 'assessment 1', decisions: [addSuggestion] }))
      .resolves.toEqual({ ok: true, data: { applied: 1, unchanged: 0 } });
    expect(decideAiProposals).toHaveBeenCalledTimes(1);
    expect(decideAiProposals).toHaveBeenCalledWith('assessment 1', [addSuggestion]);
    expect(revalidatePath).toHaveBeenCalledWith('/app/review/assessments/assessment%201');
  });

  it('carries a refused Undo’s reason with its family J copy', async () => {
    decideAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'conflict', status: 409, reason: 'AI_SUGGESTION_CONTROL_CHANGED' } });
    await expect(decideAiProposalsAction({ assessmentId: 'assessment-1', decisions: [{ ...addSuggestion, action: 'restore' }] })).resolves.toEqual({
      ok: false,
      status: 409,
      reason: 'AI_SUGGESTION_CONTROL_CHANGED',
      formError: 'The planned control has changed since it was added, so it stays. Remove it from the risk if it should go.',
      kind: 'blocked',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('explains an AI Accept refused beside a planned control (G-14)', async () => {
    decideAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'conflict', status: 409, reason: 'AI_ACCEPT_WITH_PLANNED_CONTROL' } });
    await expect(decideAiProposalsAction({ assessmentId: 'assessment-1', decisions: [addSuggestion] })).resolves.toMatchObject({
      ok: false,
      formError: 'This Risk has a planned control, so the AI’s proposed Accept can’t be confirmed. Change the treatment action to Treat, or remove the planned control.',
      kind: 'blocked',
    });
  });

  it('offers a retry when the service is unreachable', async () => {
    decideAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'unavailable' } });
    await expect(decideAiProposalsAction({ assessmentId: 'assessment-1', decisions: [addSuggestion] }))
      .resolves.toEqual({ ok: false, formError: 'We couldn’t record your review. Try again.', kind: 'retryable' });
  });

  it.each([
    ['201 decisions', { assessmentId: 'assessment-1', decisions: Array.from({ length: 201 }, () => addSuggestion) }],
    ['no decisions', { assessmentId: 'assessment-1', decisions: [] }],
    ['an unknown key', { assessmentId: 'assessment-1', decisions: [addSuggestion], extra: true }],
    ['an unknown action', { assessmentId: 'assessment-1', decisions: [{ ...addSuggestion, action: 'release' }] }],
  ])('refuses %s without calling the service', async (_label, input) => {
    await expect(decideAiProposalsAction(input)).resolves.toMatchObject({ ok: false, status: 400, kind: 'blocked' });
    expect(decideAiProposals).not.toHaveBeenCalled();
  });
});
