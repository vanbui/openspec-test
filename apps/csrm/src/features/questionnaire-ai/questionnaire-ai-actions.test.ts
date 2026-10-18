import { afterEach, describe, expect, it, vi } from 'vitest';

import { contextTooLargeJobFixture, proposalsFixture, rewriteJobFixture } from './test-fixtures';

const listQuestionnaireAiProposals = vi.hoisted(() => vi.fn());
const startQuestionnaireAiProposals = vi.hoisted(() => vi.fn());
const startQuestionRewrite = vi.hoisted(() => vi.fn());
const getQuestionnaireProposalJob = vi.hoisted(() => vi.fn());
const retryQuestionnaireProposalJob = vi.hoisted(() => vi.fn());
const decideQuestionnaireAiProposals = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('./questionnaire-ai-service', () => ({
  listQuestionnaireAiProposals,
  startQuestionnaireAiProposals,
  startQuestionRewrite,
  getQuestionnaireProposalJob,
  retryQuestionnaireProposalJob,
  decideQuestionnaireAiProposals,
}));
vi.mock('next/cache', () => ({ revalidatePath }));

const actions = await import('./questionnaire-ai-actions');
const {
  decideQuestionnaireAiProposalsAction,
  getQuestionnaireProposalJobAction,
  listQuestionnaireAiProposalsAction,
  retryQuestionnaireProposalJobAction,
  startQuestionnaireAiProposalsAction,
  startQuestionRewriteAction,
} = actions;

afterEach(() => {
  for (const mock of [listQuestionnaireAiProposals, startQuestionnaireAiProposals, startQuestionRewrite, getQuestionnaireProposalJob, retryQuestionnaireProposalJob, decideQuestionnaireAiProposals, revalidatePath]) mock.mockReset();
});

const reviewPath = '/app/review/questionnaires/questionnaire-1';

describe('listQuestionnaireAiProposalsAction', () => {
  it('refuses a blank or 256-character id without calling the service', async () => {
    for (const documentId of ['', '   ', 'q'.repeat(256)]) {
      await expect(listQuestionnaireAiProposalsAction({ documentId })).resolves.toMatchObject({ ok: false, failure: 'blocked' });
    }
    await expect(listQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', extra: true })).resolves.toMatchObject({ ok: false });
    expect(listQuestionnaireAiProposals).not.toHaveBeenCalled();
  });

  it('returns the parsed view and revalidates nothing, because the read changes nothing', async () => {
    listQuestionnaireAiProposals.mockResolvedValueOnce({ data: proposalsFixture, error: null });
    await expect(listQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1' })).resolves.toEqual({ ok: true, data: proposalsFixture });
    expect(listQuestionnaireAiProposals).toHaveBeenCalledWith('questionnaire-1');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reads a 403 OWN_REQUEST as blocked with its reason, and a 5xx as retryable', async () => {
    listQuestionnaireAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 403, reason: 'OWN_REQUEST' } });
    await expect(listQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1' })).resolves.toMatchObject({ ok: false, failure: 'blocked', reason: 'OWN_REQUEST', status: 403 });
    listQuestionnaireAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 503 } });
    await expect(listQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1' })).resolves.toMatchObject({ ok: false, failure: 'retryable', message: 'We couldn’t load the AI proposals' });
  });
});

describe('asking the AI', () => {
  it('starts proposals with the instruction, revalidates the questionnaire page and returns the job', async () => {
    startQuestionnaireAiProposals.mockResolvedValueOnce({ data: rewriteJobFixture, error: null });
    await expect(startQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', instruction: 'Ask about payment file signing.' })).resolves.toEqual({ ok: true, data: rewriteJobFixture });
    expect(startQuestionnaireAiProposals).toHaveBeenCalledWith('questionnaire-1', 'Ask about payment file signing.');
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith(reviewPath);
  });

  it('sends a blank instruction as none, and leaves the length to the server so its reason reaches the field', async () => {
    startQuestionnaireAiProposals.mockResolvedValue({ data: rewriteJobFixture, error: null });
    await startQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', instruction: '   ' });
    expect(startQuestionnaireAiProposals).toHaveBeenLastCalledWith('questionnaire-1', undefined);
    await startQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', instruction: 'x'.repeat(600) });
    expect(startQuestionnaireAiProposals).toHaveBeenLastCalledWith('questionnaire-1', 'x'.repeat(600));
  });

  it('reads a 400 instruction refusal as a field error with its reason and sentence', async () => {
    startQuestionnaireAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 400, reason: 'INSTRUCTION_REPEATS_REQUESTOR_TEXT' } });
    await expect(startQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', instruction: 'The vendor processes payroll.' })).resolves.toEqual({
      ok: false,
      failure: 'field',
      status: 400,
      reason: 'INSTRUCTION_REPEATS_REQUESTOR_TEXT',
      message: 'The instruction repeats a long passage of the Requestor’s own words. The AI already reads the request and the marked notes and files, so say what to focus on in your own words.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('fills the instruction’s length into the too-long sentence', async () => {
    startQuestionnaireAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 400, reason: 'INSTRUCTION_TOO_LONG' } });
    await expect(startQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', instruction: 'x'.repeat(512) })).resolves.toMatchObject({
      failure: 'field', message: 'Keep the instruction to 500 characters or fewer. It has 512.',
    });
  });

  it('starts a rewrite through its own action and refuses a missing question id without calling', async () => {
    startQuestionRewrite.mockResolvedValueOnce({ data: rewriteJobFixture, error: null });
    await expect(startQuestionRewriteAction({ documentId: 'questionnaire-1', questionId: 'question-3' })).resolves.toEqual({ ok: true, data: rewriteJobFixture });
    expect(startQuestionRewrite).toHaveBeenCalledWith('questionnaire-1', 'question-3', undefined);
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith(reviewPath);
    await expect(startQuestionRewriteAction({ documentId: 'questionnaire-1' })).resolves.toMatchObject({ ok: false });
    expect(startQuestionRewrite).toHaveBeenCalledTimes(1);
  });

  it('reads a job and retries it', async () => {
    getQuestionnaireProposalJob.mockResolvedValueOnce({ data: contextTooLargeJobFixture, error: null });
    await expect(getQuestionnaireProposalJobAction({ jobId: 'job-2' })).resolves.toEqual({ ok: true, data: contextTooLargeJobFixture });
    retryQuestionnaireProposalJob.mockResolvedValueOnce({ data: rewriteJobFixture, error: null });
    await expect(retryQuestionnaireProposalJobAction({ jobId: 'job-2', documentId: 'questionnaire-1' })).resolves.toEqual({ ok: true, data: rewriteJobFixture });
    expect(revalidatePath).toHaveBeenCalledExactlyOnceWith(reviewPath);
    retryQuestionnaireProposalJob.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 409 } });
    await expect(retryQuestionnaireProposalJobAction({ jobId: 'job-2', documentId: 'questionnaire-1' })).resolves.toMatchObject({ ok: false, failure: 'blocked', message: 'The AI can’t be asked in this questionnaire’s current state.' });
  });
});

describe('decideQuestionnaireAiProposalsAction', () => {
  const decision = { runId: 'run-1', item: 'i-1', action: 'accept' } as const;

  it('sends one request for any number of decisions from 1 to 200, and revalidates the page once', async () => {
    for (const count of [1, 200]) {
      decideQuestionnaireAiProposals.mockResolvedValueOnce({ data: { applied: count, unchanged: 0 }, error: null });
      const decisions = Array.from({ length: count }, (_, index) => ({ ...decision, item: `i-${(index % 30) + 1}` }));
      await expect(decideQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', decisions })).resolves.toEqual({ ok: true, data: { applied: count, unchanged: 0 } });
      expect(decideQuestionnaireAiProposals).toHaveBeenLastCalledWith('questionnaire-1', decisions);
    }
    expect(decideQuestionnaireAiProposals).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledTimes(2);
    expect(revalidatePath).toHaveBeenCalledWith(reviewPath);
  });

  it('refuses 0 or 201 decisions, an unknown action or key, and an item key outside the pattern, without calling', async () => {
    for (const decisions of [[], Array.from({ length: 201 }, () => decision), [{ ...decision, action: 'approve' }], [{ ...decision, confidence: 1 }], [{ ...decision, item: 'i-31' }]]) {
      await expect(decideQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', decisions })).resolves.toMatchObject({ ok: false, failure: 'blocked' });
    }
    expect(decideQuestionnaireAiProposals).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reads a refusal with Q2’s sentence for the decision made, and a 5xx as retryable', async () => {
    decideQuestionnaireAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 409, reason: 'AI_PROPOSAL_UNDO_UNAVAILABLE' } });
    await expect(decideQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', decisions: [{ ...decision, action: 'restore' }], intent: 'undo-rejection' })).resolves.toEqual({
      ok: false, failure: 'blocked', status: 409, reason: 'AI_PROPOSAL_UNDO_UNAVAILABLE', message: 'This proposal can no longer be reopened, because the questionnaire has moved on.',
    });
    decideQuestionnaireAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 502 } });
    await expect(decideQuestionnaireAiProposalsAction({ documentId: 'questionnaire-1', decisions: [decision] })).resolves.toMatchObject({ ok: false, failure: 'retryable', message: 'We couldn’t record your decision. Try again.' });
  });

  it('exports exactly one decision action', () => {
    expect(Object.keys(actions).filter((name) => /^decide/.test(name))).toEqual(['decideQuestionnaireAiProposalsAction']);
  });
});
