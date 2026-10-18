import { afterEach, describe, expect, it, vi } from 'vitest';

import { failedRewriteJobFixture, historyPageFixture, proposalsFixture, suggestionsJobFixture } from './test-fixtures';

const withdrawRisks = vi.hoisted(() => vi.fn());
const reinstateRisks = vi.hoisted(() => vi.fn());
const getRiskHistory = vi.hoisted(() => vi.fn());
const startRiskSuggestions = vi.hoisted(() => vi.fn());
const startRiskRewrite = vi.hoisted(() => vi.fn());
const getRiskProposalJob = vi.hoisted(() => vi.fn());
const retryRiskProposalJob = vi.hoisted(() => vi.fn());
const listRiskAiProposals = vi.hoisted(() => vi.fn());
const decideRiskProposals = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
vi.mock('./risk-curation-service', () => ({
  withdrawRisks,
  reinstateRisks,
  getRiskHistory,
  startRiskSuggestions,
  startRiskRewrite,
  getRiskProposalJob,
  retryRiskProposalJob,
  listRiskAiProposals,
  decideRiskProposals,
}));
vi.mock('next/cache', () => ({ revalidatePath }));

const actions = await import('./risk-curation-actions');
const {
  decideRiskProposalsAction,
  readRiskAiProposalsAction,
  readRiskHistoryAction,
  readRiskProposalJobAction,
  reinstateRisksAction,
  retryRiskProposalJobAction,
  startRiskRewriteAction,
  startRiskSuggestionsAction,
  undoReinstatementAction,
  undoWithdrawalAction,
  withdrawRisksAction,
} = actions;

const serviceMocks = [withdrawRisks, reinstateRisks, getRiskHistory, startRiskSuggestions, startRiskRewrite, getRiskProposalJob, retryRiskProposalJob, listRiskAiProposals, decideRiskProposals];

afterEach(() => {
  for (const mock of [...serviceMocks, revalidatePath]) mock.mockReset();
});

const assessmentPath = '/app/review/assessments/a1';

describe('withdrawRisksAction (D-05, D-09; UI-SPEC §6.1)', () => {
  it('refuses an empty reason, a 501-character reason and 201 ids before any call', async () => {
    await expect(withdrawRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: '   ' }))
      .resolves.toEqual({ ok: false, kind: 'field', status: 400, message: 'Give a reason for withdrawing this risk.' });
    await expect(withdrawRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: 'x'.repeat(501) }))
      .resolves.toEqual({ ok: false, kind: 'field', status: 400, message: 'Keep the reason to 500 characters or fewer. It has 501.' });
    const ids = Array.from({ length: 201 }, (_, index) => `r${index}`);
    await expect(withdrawRisksAction({ assessmentId: 'a1', riskIds: ids, reason: 'Duplicate' })).resolves.toMatchObject({ ok: false, kind: 'blocked', status: 400 });
    await expect(withdrawRisksAction({ assessmentId: 'a1', riskIds: [], reason: 'Duplicate' })).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(withdrawRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: 'Duplicate', undo: true })).resolves.toMatchObject({ ok: false, status: 400 });
    expect(withdrawRisks).not.toHaveBeenCalled();
  });

  it('sends the trimmed reason, then revalidates the assessment page and the Risk Register', async () => {
    withdrawRisks.mockResolvedValueOnce({ data: { applied: ['r1'], unchanged: [] }, error: null });

    await expect(withdrawRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: '  Duplicate of R-0002  ' }))
      .resolves.toEqual({ ok: true, data: { applied: ['r1'], unchanged: [] } });
    expect(withdrawRisks).toHaveBeenCalledWith('a1', { riskIds: ['r1'], reason: 'Duplicate of R-0002' });
    expect(revalidatePath).toHaveBeenCalledWith(assessmentPath);
    expect(revalidatePath).toHaveBeenCalledWith('/app/risks');
    expect(revalidatePath).toHaveBeenCalledWith('/app/risks/r1');
  });

  it('returns a 409 ASSESSMENT_NOT_MUTABLE as blocked with its reason and R1’s copy, and revalidates nothing', async () => {
    withdrawRisks.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' } });

    await expect(withdrawRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: 'Duplicate' })).resolves.toEqual({
      ok: false,
      kind: 'blocked',
      status: 409,
      reason: 'ASSESSMENT_NOT_MUTABLE',
      message: 'This assessment can no longer be changed, so the risk wasn’t withdrawn. Refresh the page to see its current state.',
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('returns a network failure as retryable', async () => {
    withdrawRisks.mockResolvedValueOnce({ data: null, error: { message: 'failed' } });
    await expect(withdrawRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: 'Duplicate' }))
      .resolves.toEqual({ ok: false, kind: 'retryable', message: 'We couldn’t withdraw the risk. Try again.' });
  });
});

describe('reinstateRisksAction (D-10; UI-SPEC §6.2)', () => {
  it('refuses an empty reason with §6.2’s copy, then reinstates with the trimmed reason and revalidates', async () => {
    await expect(reinstateRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: '' }))
      .resolves.toEqual({ ok: false, kind: 'field', status: 400, message: 'Give a reason for reinstating this risk.' });
    expect(reinstateRisks).not.toHaveBeenCalled();

    reinstateRisks.mockResolvedValueOnce({ data: { applied: ['r1'], unchanged: [] }, error: null });
    await expect(reinstateRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: ' Not a duplicate ' })).resolves.toMatchObject({ ok: true });
    expect(reinstateRisks).toHaveBeenCalledWith('a1', { riskIds: ['r1'], reason: 'Not a duplicate' });
    expect(withdrawRisks).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith(assessmentPath);
  });

  it('reads RISK_NOT_WITHDRAWN as blocked with R1’s copy', async () => {
    reinstateRisks.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 409, reason: 'RISK_NOT_WITHDRAWN' } });
    await expect(reinstateRisksAction({ assessmentId: 'a1', riskIds: ['r1'], reason: 'Back' })).resolves.toEqual({
      ok: false, kind: 'blocked', status: 409, reason: 'RISK_NOT_WITHDRAWN', message: 'This risk is already in the assessment. Refresh the page to see it.',
    });
  });
});

describe('Undo both ways sends the closed undo flag, never a reason (D-11, UI-D7)', () => {
  it('undoes a withdrawal by reinstating with undo: true', async () => {
    reinstateRisks.mockResolvedValueOnce({ data: { applied: ['r1'], unchanged: [] }, error: null });
    await expect(undoWithdrawalAction({ assessmentId: 'a1', riskIds: ['r1'] })).resolves.toEqual({ ok: true, data: { applied: ['r1'], unchanged: [] } });
    expect(reinstateRisks).toHaveBeenCalledWith('a1', { riskIds: ['r1'], undo: true });
    expect(withdrawRisks).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/app/risks/r1');
  });

  it('undoes a reinstatement by withdrawing with undo: true', async () => {
    withdrawRisks.mockResolvedValueOnce({ data: { applied: ['r1'], unchanged: [] }, error: null });
    await expect(undoReinstatementAction({ assessmentId: 'a1', riskIds: ['r1'] })).resolves.toMatchObject({ ok: true });
    expect(withdrawRisks).toHaveBeenCalledWith('a1', { riskIds: ['r1'], undo: true });
    expect(reinstateRisks).not.toHaveBeenCalled();
  });

  it('refuses a reason on an Undo, and reads its 400 as blocked rather than as the reason field’s error', async () => {
    await expect(undoWithdrawalAction({ assessmentId: 'a1', riskIds: ['r1'], reason: 'Back' })).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(undoReinstatementAction({ assessmentId: 'a1', riskIds: ['r1'], undo: false })).resolves.toMatchObject({ ok: false, status: 400 });
    expect(serviceMocks.every((mock) => mock.mock.calls.length === 0)).toBe(true);

    withdrawRisks.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 400 } });
    await expect(undoReinstatementAction({ assessmentId: 'a1', riskIds: ['r1'] }))
      .resolves.toEqual({ ok: false, kind: 'blocked', status: 400, message: 'This change can’t be made in the assessment’s current state.' });
  });
});

describe('readRiskHistoryAction (D-18 to D-21)', () => {
  it('passes the page and page size, returns the parsed page and revalidates nothing', async () => {
    const page = { events: historyPageFixture.data, pagination: historyPageFixture.meta.pagination, recordedFrom: null };
    getRiskHistory.mockResolvedValueOnce({ data: page, error: null });
    await expect(readRiskHistoryAction({ riskId: 'r1', page: 2, pageSize: 25 })).resolves.toEqual({ ok: true, data: page });
    expect(getRiskHistory).toHaveBeenCalledWith('r1', { page: 2, pageSize: 25 });
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reads a 403 as §8.5’s permission state, and refuses a page size over 100 before any call', async () => {
    getRiskHistory.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 403 } });
    await expect(readRiskHistoryAction({ riskId: 'r1' })).resolves.toEqual({
      ok: false,
      kind: 'blocked',
      status: 403,
      message: 'You don’t have access to this history',
      detail: 'Ask a Security Analyst working on this assessment if you need to see how this risk changed.',
    });
    await expect(readRiskHistoryAction({ riskId: 'r1', pageSize: 101 })).resolves.toMatchObject({ ok: false, status: 400 });
    expect(getRiskHistory).toHaveBeenCalledTimes(1);
  });
});

describe('startRiskSuggestionsAction (D-24 to D-27)', () => {
  it('sends the instruction only when it holds text, and revalidates the assessment page', async () => {
    startRiskSuggestions.mockResolvedValue({ data: suggestionsJobFixture, error: null });
    await expect(startRiskSuggestionsAction({ assessmentId: 'a1' })).resolves.toEqual({ ok: true, data: suggestionsJobFixture });
    await startRiskSuggestionsAction({ assessmentId: 'a1', instruction: '   ' });
    await startRiskSuggestionsAction({ assessmentId: 'a1', instruction: 'Risks about payment file integrity' });
    expect(startRiskSuggestions.mock.calls).toEqual([['a1', {}], ['a1', {}], ['a1', { instruction: 'Risks about payment file integrity' }]]);
    expect(revalidatePath).toHaveBeenCalledWith(assessmentPath);
  });

  it('keeps a 403 OWN_REQUEST and a 400 INSTRUCTION_TOO_LONG with their reasons and R2’s copy', async () => {
    startRiskSuggestions.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 403, reason: 'OWN_REQUEST' } });
    await expect(startRiskSuggestionsAction({ assessmentId: 'a1' })).resolves.toEqual({
      ok: false, kind: 'blocked', status: 403, reason: 'OWN_REQUEST',
      message: 'A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.',
    });
    startRiskSuggestions.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 400, reason: 'INSTRUCTION_TOO_LONG' } });
    await expect(startRiskSuggestionsAction({ assessmentId: 'a1', instruction: 'Risks' })).resolves.toEqual({
      ok: false, kind: 'field', field: 'instruction', status: 400, reason: 'INSTRUCTION_TOO_LONG', message: 'Keep the instruction to 500 characters or fewer. It has 5.',
    });
  });

  it('refuses an instruction over 500 characters before any call, as the server would', async () => {
    await expect(startRiskSuggestionsAction({ assessmentId: 'a1', instruction: 'x'.repeat(501) })).resolves.toEqual({
      ok: false, kind: 'field', field: 'instruction', status: 400, reason: 'INSTRUCTION_TOO_LONG', message: 'Keep the instruction to 500 characters or fewer. It has 501.',
    });
    expect(startRiskSuggestions).not.toHaveBeenCalled();
  });
});

describe('startRiskRewriteAction (D-34 to D-38)', () => {
  it('refuses focus: [] with §4.1’s copy before any call', async () => {
    await expect(startRiskRewriteAction({ assessmentId: 'a1', riskId: 'r1', focus: [] }))
      .resolves.toEqual({ ok: false, kind: 'field', field: 'focus', status: 400, message: 'Choose at least one part to rewrite.' });
    await expect(startRiskRewriteAction({ assessmentId: 'a1', riskId: 'r1', focus: ['ratings', 'ratings'] })).resolves.toMatchObject({ ok: false, status: 400 });
    await expect(startRiskRewriteAction({ assessmentId: 'a1', riskId: 'r1', focus: ['owners'] })).resolves.toMatchObject({ ok: false, status: 400 });
    expect(startRiskRewrite).not.toHaveBeenCalled();
  });

  it('sends the instruction and focus it was given, and revalidates the assessment page', async () => {
    startRiskRewrite.mockResolvedValueOnce({ data: failedRewriteJobFixture, error: null });
    await expect(startRiskRewriteAction({ assessmentId: 'a1', riskId: 'r1', instruction: 'Make it specific', focus: ['statement'] })).resolves.toMatchObject({ ok: true });
    expect(startRiskRewrite).toHaveBeenCalledWith('r1', { instruction: 'Make it specific', focus: ['statement'] });
    expect(revalidatePath).toHaveBeenCalledWith(assessmentPath);
  });

  it('reads RISK_WITHDRAWN with R2’s rewrite copy', async () => {
    startRiskRewrite.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 409, reason: 'RISK_WITHDRAWN' } });
    await expect(startRiskRewriteAction({ assessmentId: 'a1', riskId: 'r1' })).resolves.toMatchObject({
      ok: false, kind: 'blocked', reason: 'RISK_WITHDRAWN', message: 'This risk has been withdrawn, so the AI can’t rewrite it. Reinstate it first.',
    });
  });
});

describe('the job and proposals reads, and the retry (D-26, D-41)', () => {
  it('follows a job and reads the proposals without revalidating', async () => {
    getRiskProposalJob.mockResolvedValueOnce({ data: suggestionsJobFixture, error: null });
    await expect(readRiskProposalJobAction({ jobId: 'job-1' })).resolves.toEqual({ ok: true, data: suggestionsJobFixture });
    listRiskAiProposals.mockResolvedValueOnce({ data: proposalsFixture, error: null });
    await expect(readRiskAiProposalsAction({ assessmentId: 'a1' })).resolves.toEqual({ ok: true, data: proposalsFixture });
    expect(listRiskAiProposals).toHaveBeenCalledWith('a1');
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it('reads a failed job status check and a failed proposals read in §2.3’s and §2.7’s words', async () => {
    getRiskProposalJob.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 503 } });
    await expect(readRiskProposalJobAction({ jobId: 'job-1' })).resolves.toEqual({ ok: false, kind: 'retryable', status: 503, message: 'Status unavailable' });
    listRiskAiProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 403, reason: 'OWN_REQUEST' } });
    await expect(readRiskAiProposalsAction({ assessmentId: 'a1' }))
      .resolves.toEqual({ ok: false, kind: 'blocked', status: 403, reason: 'OWN_REQUEST', message: 'We couldn’t load the AI proposals' });
  });

  it('retries a failed job and revalidates the assessment page; a refusal reads R2', async () => {
    retryRiskProposalJob.mockResolvedValueOnce({ data: suggestionsJobFixture, error: null });
    await expect(retryRiskProposalJobAction({ assessmentId: 'a1', jobId: 'job-2' })).resolves.toMatchObject({ ok: true });
    expect(retryRiskProposalJob).toHaveBeenCalledWith('job-2');
    expect(revalidatePath).toHaveBeenCalledWith(assessmentPath);

    retryRiskProposalJob.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 409, reason: 'AI_PROPOSAL_RUN_LIMIT' } });
    await expect(retryRiskProposalJobAction({ assessmentId: 'a1', jobId: 'job-2' })).resolves.toMatchObject({
      ok: false, kind: 'blocked', message: 'This assessment has reached the most AI requests it can keep, so the AI can’t be asked again. Contact your administrator.',
    });
  });
});

describe('decideRiskProposalsAction (D-39, D-40)', () => {
  const decisions = [
    { runId: 'run-1', item: 's-1', action: 'reject', reason: 'Out of scope' },
    { runId: 'run-1', item: 's-2', action: 'reject', reason: 'Out of scope' },
    { runId: 'run-2', item: 'u-risk-statement', action: 'reject', reason: 'Out of scope' },
  ] as const;

  it('sends a batch of three decisions in one request, then revalidates the assessment page and the Risk Register', async () => {
    decideRiskProposals.mockResolvedValueOnce({ data: { applied: 3, unchanged: 0 }, error: null });
    await expect(decideRiskProposalsAction({ assessmentId: 'a1', decisions })).resolves.toEqual({ ok: true, data: { applied: 3, unchanged: 0 } });
    expect(decideRiskProposals).toHaveBeenCalledTimes(1);
    expect(decideRiskProposals).toHaveBeenCalledWith('a1', decisions);
    expect(revalidatePath).toHaveBeenCalledWith(assessmentPath);
    expect(revalidatePath).toHaveBeenCalledWith('/app/risks');
  });

  it('refuses 201 decisions, none, an empty or 501-character reason and an unknown key before any call', async () => {
    const many = Array.from({ length: 201 }, () => decisions[0]);
    for (const input of [
      { assessmentId: 'a1', decisions: many },
      { assessmentId: 'a1', decisions: [] },
      { assessmentId: 'a1', decisions: [{ ...decisions[0], reason: '  ' }] },
      { assessmentId: 'a1', decisions: [{ ...decisions[0], reason: 'x'.repeat(501) }] },
      { assessmentId: 'a1', decisions: [{ ...decisions[0], edits: {} }] },
      // FE4-09: a reason goes only with a rejection (AiProposalRunDecision).
      { assessmentId: 'a1', decisions: [{ runId: 'run-1', item: 's-1', action: 'accept', reason: 'x' }] },
      { assessmentId: 'a1', decisions: [{ runId: 'run-2', item: 'u-risk-statement', action: 'restore', reason: 'x' }] },
    ]) {
      await expect(decideRiskProposalsAction(input)).resolves.toMatchObject({ ok: false, status: 400 });
    }
    expect(decideRiskProposals).not.toHaveBeenCalled();
  });

  it('reads a 403 OWN_REQUEST and a refused Undo of a confirmation with R3’s copy', async () => {
    decideRiskProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 403, reason: 'OWN_REQUEST' } });
    await expect(decideRiskProposalsAction({ assessmentId: 'a1', decisions })).resolves.toMatchObject({
      ok: false, kind: 'blocked', reason: 'OWN_REQUEST', message: 'A Security Analyst can’t steer the AI on a request they raised. Another Security Analyst handles it.',
    });
    decideRiskProposals.mockResolvedValueOnce({ data: null, error: { message: 'failed', status: 409, reason: 'AI_PROPOSAL_UNDO_UNAVAILABLE' } });
    await expect(decideRiskProposalsAction({
      assessmentId: 'a1',
      decisions: [{ runId: 'run-2', item: 'u-risk-statement', action: 'restore' }],
      intent: 'undo-confirmation',
      label: 'Risk statement',
      riskNumber: 'R-0001',
    })).resolves.toMatchObject({
      ok: false, kind: 'blocked', message: 'Risk statement has changed since the change was confirmed, so it can’t be undone here. Change it in the risk form instead.',
    });
  });
});
