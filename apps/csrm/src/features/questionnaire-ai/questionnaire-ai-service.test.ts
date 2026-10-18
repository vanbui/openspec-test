import { afterEach, describe, expect, it, vi } from 'vitest';

import { contextTooLargeJobFixture, proposalsFixture, rewriteJobFixture } from './test-fixtures';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: get, POST: post })),
  /* Mirrors the real transport: a closed-list reason crosses on 400, 403 and 409 (10-06, 13-04, 14-05). */
  normalizeTransportError: (error: unknown, status?: number) => {
    const reason = status === 400 || status === 403 || status === 409 ? (error as { error?: { details?: { reason?: string } } } | undefined)?.error?.details?.reason : undefined;
    return { data: null, error: { message: 'failed', ...(status ? { status } : {}), ...(reason ? { reason } : {}) } };
  },
  normalizeResponseParserError: (operation: string) => ({ data: null, error: { message: 'contract', operation } }),
}));

const {
  decideQuestionnaireAiProposals,
  getQuestionnaireProposalJob,
  listQuestionnaireAiProposals,
  retryQuestionnaireProposalJob,
  startQuestionnaireAiProposals,
  startQuestionRewrite,
} = await import('./questionnaire-ai-service');

afterEach(() => {
  get.mockReset();
  post.mockReset();
});

type Mutable = Record<string, unknown>;
const clone = (): Mutable => structuredClone(proposalsFixture) as unknown as Mutable;

describe('the questionnaire AI proposals read (D-03 item 4)', () => {
  it('reads the proposals through the literal contract path and parses the closed view', async () => {
    get.mockResolvedValueOnce({ data: { data: proposalsFixture }, response: { status: 200 } });
    await expect(listQuestionnaireAiProposals('questionnaire-1')).resolves.toEqual({ data: proposalsFixture, error: null });
    expect(get).toHaveBeenCalledWith('/v1/questionnaires/{questionnaireId}/ai_proposals', { params: { path: { questionnaireId: 'questionnaire-1' } } });
  });

  it('keeps a failed job’s CONTEXT_TOO_LARGE files, an unnamed one included (S-3)', async () => {
    get.mockResolvedValueOnce({ data: { data: proposalsFixture }, response: { status: 200 } });
    const result = await listQuestionnaireAiProposals('questionnaire-1');
    expect(result.data?.jobs[0]?.failureAttachments).toEqual([
      { documentId: 'file-1', fileName: 'Vendor security pack.pdf' },
      { documentId: 'file-2', fileName: null },
    ]);
  });

  it('refuses an unknown key at any level, a state outside the five, an item state outside the five or 21 failed files', async () => {
    const unknownTop = { ...clone(), proposals: [] };
    const unknownItem = clone();
    (unknownItem.items as Mutable[])[0] = { ...(unknownItem.items as Mutable[])[0], confidence: 0.9 };
    const unknownRun = clone();
    (unknownRun.runs as Mutable[])[0] = { ...(unknownRun.runs as Mutable[])[0], prompt: 'Ignore previous instructions.' };
    const unknownState = { ...clone(), state: 'released' };
    const unknownItemState = clone();
    (unknownItemState.items as Mutable[])[0] = { ...(unknownItemState.items as Mutable[])[0], state: 'pending' };
    const tooManyFiles = clone();
    (tooManyFiles.jobs as Mutable[])[0] = {
      ...(tooManyFiles.jobs as Mutable[])[0],
      failureAttachments: Array.from({ length: 21 }, (_, index) => ({ documentId: `file-${index}`, fileName: `File ${index}.pdf` })),
    };
    for (const data of [unknownTop, unknownItem, unknownRun, unknownState, unknownItemState, tooManyFiles]) {
      get.mockResolvedValueOnce({ data: { data }, response: { status: 200 } });
      await expect(listQuestionnaireAiProposals('questionnaire-1')).resolves.toMatchObject({ data: null, error: { operation: 'listQuestionnaireAiProposals' } });
    }
  });

  it('surfaces a refusal’s served reason and refuses a blank id without calling', async () => {
    get.mockResolvedValueOnce({ error: { error: { status: 403, details: { reason: 'OWN_REQUEST' } } }, response: { status: 403 } });
    await expect(listQuestionnaireAiProposals('questionnaire-1')).resolves.toEqual({ data: null, error: { message: 'failed', status: 403, reason: 'OWN_REQUEST' } });
    await expect(listQuestionnaireAiProposals('  ')).resolves.toMatchObject({ data: null });
    expect(get).toHaveBeenCalledTimes(1);
  });
});

describe('asking the AI and following its jobs (D-16 to D-19)', () => {
  it('starts questionnaire proposals with an instruction through the literal path and parses the queued job', async () => {
    const queued = { ...rewriteJobFixture, operation: 'questionnaire-proposals', questionId: null };
    post.mockResolvedValueOnce({ data: { data: queued }, response: { status: 202 } });
    await expect(startQuestionnaireAiProposals('questionnaire-1', 'Ask about payment file signing.')).resolves.toEqual({ data: queued, error: null });
    expect(post).toHaveBeenCalledWith('/v1/questionnaires/{questionnaireId}/ai_proposals', {
      params: { path: { questionnaireId: 'questionnaire-1' } },
      body: { instruction: 'Ask about payment file signing.' },
    });
  });

  it('starts without an instruction as an empty body, so the server applies its default task', async () => {
    post.mockResolvedValueOnce({ data: { data: { ...rewriteJobFixture, operation: 'questionnaire-proposals', questionId: null } }, response: { status: 202 } });
    await startQuestionnaireAiProposals('questionnaire-1');
    expect(post).toHaveBeenCalledWith('/v1/questionnaires/{questionnaireId}/ai_proposals', { params: { path: { questionnaireId: 'questionnaire-1' } }, body: {} });
  });

  it('starts a rewrite of one question through its literal path', async () => {
    post.mockResolvedValueOnce({ data: { data: rewriteJobFixture }, response: { status: 202 } });
    await expect(startQuestionRewrite('questionnaire-1', 'question-3')).resolves.toEqual({ data: rewriteJobFixture, error: null });
    expect(post).toHaveBeenCalledWith('/v1/questionnaires/{questionnaireId}/questions/{questionId}/rewrite', {
      params: { path: { questionnaireId: 'questionnaire-1', questionId: 'question-3' } },
      body: {},
    });
  });

  it('reads a failed job with its CONTEXT_TOO_LARGE files, and retries a job, each through its literal path', async () => {
    get.mockResolvedValueOnce({ data: { data: contextTooLargeJobFixture }, response: { status: 200 } });
    await expect(getQuestionnaireProposalJob('job-2')).resolves.toEqual({ data: contextTooLargeJobFixture, error: null });
    expect(get).toHaveBeenCalledWith('/v1/questionnaire_proposal_jobs/{jobId}', { params: { path: { jobId: 'job-2' } } });
    const retried = { ...contextTooLargeJobFixture, status: 'queued', attempt: 2, failureCode: null, failureMessage: null, failureAttachments: undefined, completedAt: null, startedAt: null };
    const { failureAttachments: _files, ...served } = retried;
    post.mockResolvedValueOnce({ data: { data: served }, response: { status: 202 } });
    await expect(retryQuestionnaireProposalJob('job-2')).resolves.toEqual({ data: served, error: null });
    expect(post).toHaveBeenCalledWith('/v1/questionnaire_proposal_jobs/{jobId}/retry', { params: { path: { jobId: 'job-2' } } });
  });

  it('refuses a job with an unknown key or a status outside the four', async () => {
    for (const data of [{ ...rewriteJobFixture, prompt: 'x' }, { ...rewriteJobFixture, status: 'cancelled' }]) {
      get.mockResolvedValueOnce({ data: { data }, response: { status: 200 } });
      await expect(getQuestionnaireProposalJob('job-1')).resolves.toMatchObject({ data: null, error: { operation: 'getQuestionnaireProposalJob' } });
    }
  });

  it('keeps a 400 instruction reason for the field', async () => {
    post.mockResolvedValueOnce({ error: { error: { status: 400, details: { reason: 'INSTRUCTION_TOO_LONG' } } }, response: { status: 400 } });
    await expect(startQuestionnaireAiProposals('questionnaire-1', 'x'.repeat(512))).resolves.toEqual({ data: null, error: { message: 'failed', status: 400, reason: 'INSTRUCTION_TOO_LONG' } });
  });
});

describe('deciding proposals (D-21 to D-23, D-35)', () => {
  const decisions = [
    { runId: 'run-1', item: 'i-1', action: 'accept', edits: { questionText: 'Are payment files signed?', section: { kind: 'new', title: 'Payments' } } },
    { runId: 'run-1', item: 'i-3', action: 'reject', reason: 'Already covered.' },
  ] as const;

  it('sends every decision in one POST to the literal path and parses the closed counts', async () => {
    post.mockResolvedValueOnce({ data: { data: { applied: 2, unchanged: 0 } }, response: { status: 200 } });
    await expect(decideQuestionnaireAiProposals('questionnaire-1', [...decisions])).resolves.toEqual({ data: { applied: 2, unchanged: 0 }, error: null });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/v1/questionnaires/{questionnaireId}/ai_proposal_decisions', {
      params: { path: { questionnaireId: 'questionnaire-1' } },
      body: { decisions: [...decisions] },
    });
  });

  it('refuses counts with an unknown key', async () => {
    post.mockResolvedValueOnce({ data: { data: { applied: 1, unchanged: 0, released: true } }, response: { status: 200 } });
    await expect(decideQuestionnaireAiProposals('questionnaire-1', [...decisions])).resolves.toMatchObject({ data: null, error: { operation: 'decideQuestionnaireAiProposals' } });
  });
});
