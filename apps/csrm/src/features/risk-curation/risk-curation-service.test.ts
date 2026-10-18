import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { failedRewriteJobFixture, historyPageFixture, proposalsFixture, suggestionsJobFixture } from './test-fixtures';

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
  decideRiskProposals,
  getRiskHistory,
  getRiskProposalJob,
  listRiskAiProposals,
  reinstateRisks,
  retryRiskProposalJob,
  startRiskRewrite,
  startRiskSuggestions,
  withdrawRisks,
} = await import('./risk-curation-service');

afterEach(() => {
  get.mockReset();
  post.mockReset();
});

const withdrawalsPath = '/v1/risk_assessments/{assessmentId}/risk_withdrawals';

describe('withdrawRisks (D-05, D-09)', () => {
  it('POSTs the ids and the reason to the literal contract path and parses applied and unchanged', async () => {
    post.mockResolvedValueOnce({ data: { data: { applied: ['r1'], unchanged: [] } }, response: { status: 200 } });

    await expect(withdrawRisks('a1', { riskIds: ['r1'], reason: 'Duplicate' })).resolves.toEqual({ data: { applied: ['r1'], unchanged: [] }, error: null });
    expect(post).toHaveBeenCalledWith(withdrawalsPath, { params: { path: { assessmentId: 'a1' } }, body: { riskIds: ['r1'], reason: 'Duplicate' } });
  });

  it('refuses a response with a key the contract does not declare, at either level', async () => {
    for (const data of [
      { data: { applied: ['r1'], unchanged: [] }, meta: {} },
      { data: { applied: ['r1'], unchanged: [], withdrawn: 1 } },
      { data: { applied: [''], unchanged: [] } },
    ]) {
      post.mockResolvedValueOnce({ data, response: { status: 200 } });
      await expect(withdrawRisks('a1', { riskIds: ['r1'], reason: 'Duplicate' })).resolves.toMatchObject({ data: null, error: { operation: 'withdrawRisks' } });
    }
  });

  it('keeps a 409’s closed reason and sends nothing for a blank assessment id', async () => {
    post.mockResolvedValueOnce({ error: { error: { details: { reason: 'ASSESSMENT_NOT_MUTABLE' } } }, response: { status: 409 } });
    await expect(withdrawRisks('a1', { riskIds: ['r1'], reason: 'Duplicate' })).resolves.toMatchObject({ data: null, error: { status: 409, reason: 'ASSESSMENT_NOT_MUTABLE' } });

    await expect(withdrawRisks('  ', { riskIds: ['r1'], reason: 'Duplicate' })).resolves.toMatchObject({ data: null, error: { status: 400 } });
    expect(post).toHaveBeenCalledTimes(1);
  });
});

type Mutable = Record<string, unknown>;
const clone = <T>(value: T): Mutable => structuredClone(value) as unknown as Mutable;

describe('reinstateRisks and both Undo bodies (D-10, D-11)', () => {
  it('POSTs a reason to the reinstatements path, and the closed undo flag with no reason to either path', async () => {
    post.mockResolvedValue({ data: { data: { applied: ['r1'], unchanged: [] } }, response: { status: 200 } });

    await expect(reinstateRisks('a1', { riskIds: ['r1'], reason: 'Not a duplicate' })).resolves.toEqual({ data: { applied: ['r1'], unchanged: [] }, error: null });
    await reinstateRisks('a1', { riskIds: ['r1'], undo: true });
    await withdrawRisks('a1', { riskIds: ['r1'], undo: true });

    expect(post.mock.calls).toEqual([
      ['/v1/risk_assessments/{assessmentId}/risk_reinstatements', { params: { path: { assessmentId: 'a1' } }, body: { riskIds: ['r1'], reason: 'Not a duplicate' } }],
      ['/v1/risk_assessments/{assessmentId}/risk_reinstatements', { params: { path: { assessmentId: 'a1' } }, body: { riskIds: ['r1'], undo: true } }],
      [withdrawalsPath, { params: { path: { assessmentId: 'a1' } }, body: { riskIds: ['r1'], undo: true } }],
    ]);
  });
});

describe('getRiskHistory (D-18 to D-21)', () => {
  it('GETs one page with page and pageSize and parses the events, a malformed envelope as null', async () => {
    get.mockResolvedValueOnce({ data: historyPageFixture, response: { status: 200 } });

    const result = await getRiskHistory('r1', { page: 2, pageSize: 25 });
    expect(get).toHaveBeenCalledWith('/v1/risks/{riskId}/history', { params: { path: { riskId: 'r1' }, query: { page: 2, pageSize: 25 } } });
    expect(result.data?.events.map((event) => event.kind)).toEqual(['withdrawn', 'updated', 'control-implementation-added']);
    expect(result.data?.events[2]?.changes).toBeNull();
    expect(result.data?.pagination).toEqual({ page: 1, pageSize: 25, pageCount: 1, total: 3 });
    expect(result.data?.recordedFrom).toBe('2026-10-14T01:00:00.000Z');
  });

  it('reads recordedFrom null for a Risk with no history, and refuses a date that is not one', async () => {
    get.mockResolvedValueOnce({ data: { data: [], meta: { pagination: { page: 1, pageSize: 25, pageCount: 0, total: 0 }, recordedFrom: null } }, response: { status: 200 } });
    await expect(getRiskHistory('r1', {})).resolves.toMatchObject({ data: { events: [], recordedFrom: null }, error: null });
    expect(get).toHaveBeenLastCalledWith('/v1/risks/{riskId}/history', { params: { path: { riskId: 'r1' }, query: {} } });

    const notADate = clone(historyPageFixture);
    (notADate.meta as Mutable).recordedFrom = 'yesterday';
    const unknownKey = clone(historyPageFixture);
    (unknownKey.data as Mutable[])[0] = { ...(unknownKey.data as Mutable[])[0], ip: '10.0.0.1' };
    const unknownKind = clone(historyPageFixture);
    (unknownKind.data as Mutable[])[0] = { ...(unknownKind.data as Mutable[])[0], kind: 'deleted' };
    for (const data of [notADate, unknownKey, unknownKind]) {
      get.mockResolvedValueOnce({ data, response: { status: 200 } });
      await expect(getRiskHistory('r1', {})).resolves.toMatchObject({ data: null, error: { operation: 'getRiskHistory' } });
    }
  });

  it('sends nothing for a page or page size outside the contract', async () => {
    for (const query of [{ page: 0 }, { pageSize: 101 }, { page: 1.5 }]) {
      await expect(getRiskHistory('r1', query)).resolves.toMatchObject({ data: null, error: { status: 400 } });
    }
    expect(get).not.toHaveBeenCalled();
  });
});

describe('the two AI operations and their jobs (D-24 to D-27)', () => {
  it('starts Suggest more risks with an empty body, or with the instruction', async () => {
    post.mockResolvedValue({ data: { data: suggestionsJobFixture }, response: { status: 202 } });

    await expect(startRiskSuggestions('a1', {})).resolves.toEqual({ data: suggestionsJobFixture, error: null });
    await startRiskSuggestions('a1', { instruction: 'Risks about payment file integrity' });
    expect(post.mock.calls).toEqual([
      ['/v1/risk_assessments/{assessmentId}/risk_suggestions', { params: { path: { assessmentId: 'a1' } }, body: {} }],
      ['/v1/risk_assessments/{assessmentId}/risk_suggestions', { params: { path: { assessmentId: 'a1' } }, body: { instruction: 'Risks about payment file integrity' } }],
    ]);
  });

  it('starts a rewrite with the instruction and the focus it was given', async () => {
    post.mockResolvedValueOnce({ data: { data: failedRewriteJobFixture }, response: { status: 202 } });

    await expect(startRiskRewrite('r1', { instruction: 'Make it specific', focus: ['statement', 'ratings'] })).resolves.toEqual({ data: failedRewriteJobFixture, error: null });
    expect(post).toHaveBeenCalledWith('/v1/risks/{riskId}/rewrite', { params: { path: { riskId: 'r1' } }, body: { instruction: 'Make it specific', focus: ['statement', 'ratings'] } });
  });

  it('follows and retries a job, keeping a 403 OWN_REQUEST’s reason', async () => {
    get.mockResolvedValueOnce({ data: { data: suggestionsJobFixture }, response: { status: 200 } });
    await expect(getRiskProposalJob('job-1')).resolves.toEqual({ data: suggestionsJobFixture, error: null });
    expect(get).toHaveBeenCalledWith('/v1/risk_proposal_jobs/{jobId}', { params: { path: { jobId: 'job-1' } } });

    post.mockResolvedValueOnce({ error: { error: { details: { reason: 'OWN_REQUEST' } } }, response: { status: 403 } });
    await expect(retryRiskProposalJob('job-2')).resolves.toMatchObject({ data: null, error: { status: 403, reason: 'OWN_REQUEST' } });
    expect(post).toHaveBeenCalledWith('/v1/risk_proposal_jobs/{jobId}/retry', { params: { path: { jobId: 'job-2' } } });
  });

  it('refuses a job with an unknown status, an unknown key, or 21 failed files', async () => {
    const tooManyFiles = { ...failedRewriteJobFixture, failureAttachments: Array.from({ length: 21 }, (_, index) => ({ documentId: `file-${index}`, fileName: null })) };
    for (const job of [{ ...suggestionsJobFixture, status: 'paused' }, { ...suggestionsJobFixture, prompt: 'x' }, tooManyFiles]) {
      get.mockResolvedValueOnce({ data: { data: job }, response: { status: 200 } });
      await expect(getRiskProposalJob('job-1')).resolves.toMatchObject({ data: null, error: { operation: 'getRiskProposalJob' } });
    }
  });
});

describe('listRiskAiProposals (D-41)', () => {
  it('reads the proposals through the literal contract path and parses the closed view', async () => {
    get.mockResolvedValueOnce({ data: { data: proposalsFixture }, response: { status: 200 } });
    await expect(listRiskAiProposals('a1')).resolves.toEqual({ data: proposalsFixture, error: null });
    expect(get).toHaveBeenCalledWith('/v1/risk_assessments/{assessmentId}/ai_proposals', { params: { path: { assessmentId: 'a1' } } });
  });

  it('refuses an unknown key at any level and an item state or adjustment code outside the contract', async () => {
    const unknownTop = { ...clone(proposalsFixture), proposals: [] };
    const unknownItem = clone(proposalsFixture);
    (unknownItem.items as Mutable[])[0] = { ...(unknownItem.items as Mutable[])[0], confidence: 0.9 };
    const unknownState = clone(proposalsFixture);
    (unknownState.items as Mutable[])[0] = { ...(unknownState.items as Mutable[])[0], state: 'pending' };
    const unknownCode = clone(proposalsFixture);
    (unknownCode.runs as Mutable[])[0] = { ...(unknownCode.runs as Mutable[])[0], adjustments: [{ code: 'hallucinated', count: 1 }] };
    const unknownAction = clone(proposalsFixture);
    (unknownAction.actions as Mutable).withdraw = { allowed: true, reason: null };
    for (const data of [unknownTop, unknownItem, unknownState, unknownCode, unknownAction]) {
      get.mockResolvedValueOnce({ data: { data }, response: { status: 200 } });
      await expect(listRiskAiProposals('a1')).resolves.toMatchObject({ data: null, error: { operation: 'listRiskAiProposals' } });
    }
  });
});

describe('decideRiskProposals (D-39, D-40)', () => {
  it('sends every decision of one act in one request on Phase 12’s decision operation, as proposal entries', async () => {
    post.mockResolvedValueOnce({ data: { data: { applied: 3, unchanged: 0 } }, response: { status: 200 } });

    await expect(decideRiskProposals('a1', [
      { runId: 'run-1', item: 's-1', action: 'accept' },
      { runId: 'run-1', item: 's-2', action: 'reject', reason: 'Out of scope' },
      { runId: 'run-2', item: 'u-risk-statement', action: 'restore' },
    ])).resolves.toEqual({ data: { applied: 3, unchanged: 0 }, error: null });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/v1/risk_assessments/{assessmentId}/ai_proposal_decisions', {
      params: { path: { assessmentId: 'a1' } },
      body: {
        decisions: [
          { target: { kind: 'proposal', runId: 'run-1', item: 's-1' }, action: 'accept' },
          { target: { kind: 'proposal', runId: 'run-1', item: 's-2' }, action: 'reject', reason: 'Out of scope' },
          { target: { kind: 'proposal', runId: 'run-2', item: 'u-risk-statement' }, action: 'restore' },
        ],
      },
    });
  });

  it('sends nothing for no decisions, 201 decisions or an item key outside the contract', async () => {
    const many = Array.from({ length: 201 }, () => ({ runId: 'run-1', item: 's-1', action: 'reject' as const }));
    for (const decisions of [[], many, [{ runId: 'run-1', item: 's-9', action: 'accept' as const }]]) {
      await expect(decideRiskProposals('a1', decisions)).resolves.toMatchObject({ data: null, error: { status: 400 } });
    }
    expect(post).not.toHaveBeenCalled();
  });
});

describe('request deletion is not offered (UI-D34)', () => {
  it('has no service under src/features that calls DELETE on an assessment request path', () => {
    const featuresDirectory = resolve(process.cwd(), 'src/features');
    const services = readdirSync(featuresDirectory, { recursive: true, encoding: 'utf8' }).filter((name) => name.endsWith('-service.ts'));
    expect(services.length).toBeGreaterThan(10);
    for (const name of services) {
      const source = readFileSync(resolve(featuresDirectory, name), 'utf8');
      expect(source, name).not.toMatch(/\.DELETE\(\s*'\/v1\/assessment_requests\/\{[A-Za-z]+\}'/);
    }
  });
});
