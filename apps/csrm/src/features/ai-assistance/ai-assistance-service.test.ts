import { afterEach, describe, expect, it, vi } from 'vitest';

import { aiRunFixture } from './test-fixtures';

const get = vi.hoisted(() => vi.fn());
const post = vi.hoisted(() => vi.fn());

vi.mock('server-only', () => ({}));
vi.mock('../../lib/api/transport/server-client', () => ({
  createStrapiClient: vi.fn(async () => ({ GET: get, POST: post })),
  /* Mirrors the real transport: only a 409's served reason crosses (10-06). */
  normalizeTransportError: (error: unknown, status?: number) => {
    const reason = status === 409 ? (error as { error?: { details?: { reason?: string } } } | undefined)?.error?.details?.reason : undefined;
    return { data: null, error: { message: 'failed', ...(status ? { status } : {}), ...(reason ? { reason } : {}) } };
  },
  normalizeResponseParserError: (operation: string) => ({ data: null, error: { message: 'contract', operation } }),
}));

const { decideAiProposals, getAiRun } = await import('./ai-assistance-service');

afterEach(() => {
  get.mockReset();
  post.mockReset();
});

describe('AI proposal decision service', () => {
  const decisions = [{ target: { kind: 'risk', riskId: 'risk-1' }, action: 'accept', suggestion: 'UATA-001' }] as const;

  it('sends one POST to the literal path and parses the closed counts (D-24)', async () => {
    post.mockResolvedValueOnce({ data: { data: { applied: 1, unchanged: 0 } }, response: { status: 200 } });
    await expect(decideAiProposals('assessment-1', [...decisions])).resolves.toEqual({ data: { applied: 1, unchanged: 0 }, error: null });
    expect(post).toHaveBeenCalledTimes(1);
    expect(post).toHaveBeenCalledWith('/v1/risk_assessments/{assessmentId}/ai_proposal_decisions', {
      params: { path: { assessmentId: 'assessment-1' } },
      body: { decisions: [...decisions] },
    });
  });

  it('surfaces a refusal’s served reason', async () => {
    const body = { data: null, error: { status: 409, details: { reason: 'AI_SUGGESTION_CONTROL_CHANGED' } } };
    post.mockResolvedValueOnce({ error: body, response: { status: 409 } });
    await expect(decideAiProposals('assessment-1', [...decisions])).resolves.toEqual({
      data: null, error: { message: 'failed', status: 409, reason: 'AI_SUGGESTION_CONTROL_CHANGED' },
    });
  });

  it('refuses a response with unknown keys', async () => {
    post.mockResolvedValueOnce({ data: { data: { applied: 1, unchanged: 0, contentChanged: true } }, response: { status: 200 } });
    await expect(decideAiProposals('assessment-1', [...decisions])).resolves.toMatchObject({ data: null, error: { operation: 'decideAiProposals' } });
  });
});

describe('AI run service', () => {
  it('reads the run through the generated client and parses the closed response (D-25)', async () => {
    get.mockResolvedValueOnce({ data: { data: aiRunFixture }, response: { status: 200 } });
    await expect(getAiRun('run-1')).resolves.toEqual({ data: aiRunFixture, error: null });
    expect(get).toHaveBeenCalledWith('/v1/ai_runs/{runId}', { params: { path: { runId: 'run-1' } } });
  });

  it('refuses a response that carries the proposal or any unknown key', async () => {
    get.mockResolvedValueOnce({ data: { data: { ...aiRunFixture, proposal: { risks: [] } } }, response: { status: 200 } });
    await expect(getAiRun('run-1')).resolves.toMatchObject({ data: null, error: { operation: 'getAiRun' } });
  });

  it('reads a run whose summary predates notes (v1) with the empty notes section the server projects (D-28)', async () => {
    const legacy = { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, schemaVersion: 1, notes: { included: [], marked: 0, bound: 50 } } };
    get.mockResolvedValueOnce({ data: { data: legacy }, response: { status: 200 } });
    await expect(getAiRun('run-1')).resolves.toEqual({ data: legacy, error: null });
  });

  it('refuses a summary without its version or notes section, or a note carrying its text (D-28, G-3)', async () => {
    const { notes: _notes, ...withoutNotes } = aiRunFixture.contextSummary;
    const { schemaVersion: _version, ...withoutVersion } = aiRunFixture.contextSummary;
    const withBody = { ...aiRunFixture.contextSummary, notes: { ...aiRunFixture.contextSummary.notes, included: [{ ...aiRunFixture.contextSummary.notes.included[0], body: 'Payroll files now go to Singapore.' }] } };
    const overBound = { ...aiRunFixture.contextSummary, notes: { ...aiRunFixture.contextSummary.notes, bound: 51 } };
    const unknownPart = { ...aiRunFixture.contextSummary, notes: { ...aiRunFixture.contextSummary.notes, included: [{ ...aiRunFixture.contextSummary.notes.included[0], part: 'service-agent' }] } };
    for (const contextSummary of [withoutNotes, withoutVersion, withBody, overBound, unknownPart, { ...aiRunFixture.contextSummary, schemaVersion: 6 }]) {
      get.mockResolvedValueOnce({ data: { data: { ...aiRunFixture, contextSummary } }, response: { status: 200 } });
      await expect(getAiRun('run-1')).resolves.toMatchObject({ data: null, error: { operation: 'getAiRun' } });
    }
  });

  it('returns the transport failure for a refused read', async () => {
    get.mockResolvedValueOnce({ error: { status: 403 }, response: { status: 403 } });
    await expect(getAiRun('run-1')).resolves.toMatchObject({ data: null, error: { status: 403 } });
  });

  /* Phase 14 D-35 (G-3): the files a run used, each by documentId, digest, type, part and counts, named as it is now. */
  const usedFile = {
    documentId: 'attachment-1', sha256: 'b'.repeat(64), type: 'pdf', part: 'requestor', charactersSent: 412, charactersAvailable: 412, truncated: false,
    fileName: 'vendor-security-pack.pdf', requestId: 'request-1', removed: false,
  } as const;
  const withFiles = (attachments: unknown, schemaVersion = 3) => ({ ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, schemaVersion, attachments } });

  it('reads a run that used files (v3), each by its current name, and a run from before files with none (D-35)', async () => {
    for (const run of [
      withFiles({ included: [usedFile, { ...usedFile, documentId: 'attachment-2', type: 'txt', part: 'security-analyst', charactersSent: 20_000, charactersAvailable: 31_000, truncated: true, fileName: null, requestId: null, removed: true }], bound: 30_000 }),
      withFiles({ included: [], bound: 60_000 }, 2),
    ]) {
      get.mockResolvedValueOnce({ data: { data: run }, response: { status: 200 } });
      await expect(getAiRun('run-1')).resolves.toEqual({ data: run, error: null });
    }
  });

  it('refuses a run whose files carry their text, an unknown key or an unknown type, part or bound (D-35, G-3)', async () => {
    for (const attachments of [
      { included: [{ ...usedFile, text: 'The vendor’s offshore support team has administrator access.' }], bound: 30_000 },
      { included: [{ ...usedFile, uploadedBy: 'Jane Doe' }], bound: 30_000 },
      { included: [{ ...usedFile, type: 'png' }], bound: 30_000 },
      { included: [{ ...usedFile, part: 'service-agent' }], bound: 30_000 },
      { included: [usedFile], bound: 45_000 },
      { included: [usedFile], bound: 30_000, extra: true },
      undefined,
    ]) {
      get.mockResolvedValueOnce({ data: { data: withFiles(attachments) }, response: { status: 200 } });
      await expect(getAiRun('run-1')).resolves.toMatchObject({ data: null, error: { operation: 'getAiRun' } });
    }
  });

  /*
   * Phase 15 D-19 (the approved amendment): a questionnaire proposal run, its v4 summary recording the questionnaire
   * section and the instruction's source (never its text), beside the run's own instruction.
   */
  const questionnaireSection = {
    scope: 'questionnaire', questionsOffered: 12, answered: 9, answerContent: 'included',
    openItemsListed: 2, rejectedItemsListed: 1, rejectedItemsTotal: 1, removedListed: 0,
  } as const;
  const proposalsRun = {
    ...aiRunFixture,
    operation: 'questionnaire-proposals',
    providerName: 'deterministic-questionnaire-proposals',
    instruction: 'Add questions about the offshore support team',
    contextSummary: {
      ...aiRunFixture.contextSummary,
      schemaVersion: 4,
      operation: 'questionnaire-proposals',
      budget: 100_000,
      attachments: { included: [], bound: 30_000 },
      questionnaire: questionnaireSection,
      instruction: { source: 'analyst' },
    },
  } as const;

  it('reads a questionnaire proposal run with its v4 summary, and a rewrite run on the preset (D-19)', async () => {
    const rewriteRun = {
      ...proposalsRun,
      operation: 'question-rewrite',
      instruction: null,
      contextSummary: {
        ...proposalsRun.contextSummary,
        operation: 'question-rewrite',
        riskTypes: { offered: 0, total: 4, names: [] },
        questionnaire: { ...questionnaireSection, scope: 'question', answered: 0, answerContent: 'withheld', openItemsListed: 0, rejectedItemsListed: 0, rejectedItemsTotal: 0 },
        instruction: { source: 'plain-language-preset' },
      },
    } as const;
    for (const run of [proposalsRun, rewriteRun]) {
      get.mockResolvedValueOnce({ data: { data: run }, response: { status: 200 } });
      await expect(getAiRun('run-1')).resolves.toEqual({ data: run, error: null });
    }
  });

  it('reads an earlier-version run with both Phase 15 sections null', async () => {
    for (const schemaVersion of [1, 2, 3]) {
      const run = { ...aiRunFixture, contextSummary: { ...aiRunFixture.contextSummary, schemaVersion } };
      get.mockResolvedValueOnce({ data: { data: run }, response: { status: 200 } });
      await expect(getAiRun('run-1')).resolves.toEqual({ data: run, error: null });
    }
  });

  it('refuses an unknown key, scope, answer content or source in the Phase 15 sections, or either section missing (G-3)', async () => {
    const { questionnaire: _questionnaire, ...withoutQuestionnaire } = proposalsRun.contextSummary;
    const { instruction: _instruction, ...withoutInstruction } = proposalsRun.contextSummary;
    for (const contextSummary of [
      { ...proposalsRun.contextSummary, questionnaire: { ...questionnaireSection, instructionText: 'Add questions about the offshore support team' } },
      { ...proposalsRun.contextSummary, questionnaire: { ...questionnaireSection, scope: 'section' } },
      { ...proposalsRun.contextSummary, questionnaire: { ...questionnaireSection, answerContent: 'drafts' } },
      { ...proposalsRun.contextSummary, questionnaire: { ...questionnaireSection, rejectedItemsListed: 101 } },
      { ...proposalsRun.contextSummary, instruction: { source: 'requestor' } },
      { ...proposalsRun.contextSummary, instruction: { source: 'analyst', text: 'Add questions about the offshore support team' } },
      withoutQuestionnaire,
      withoutInstruction,
    ]) {
      get.mockResolvedValueOnce({ data: { data: { ...proposalsRun, contextSummary } }, response: { status: 200 } });
      await expect(getAiRun('run-1')).resolves.toMatchObject({ data: null, error: { operation: 'getAiRun' } });
    }
  });

  it('refuses an unknown run operation', async () => {
    get.mockResolvedValueOnce({ data: { data: { ...proposalsRun, operation: 'risk-proposals' } }, response: { status: 200 } });
    await expect(getAiRun('run-1')).resolves.toMatchObject({ data: null, error: { operation: 'getAiRun' } });
  });

  /*
   * Phase 16 D-25 (the approved Phase 16 amendment, "Context summary: risk proposal section"): a "Suggest more risks"
   * run and a "Rewrite this risk" run, their v5 summaries recording what was listed as counts and closed values only.
   */
  const suggestionsSection = { scope: 'assessment', risksListed: 3, withdrawnListed: 1, rejectedListed: 1, openListed: 0, controlsListed: null, focus: null } as const;
  const suggestionsRun = {
    ...aiRunFixture,
    operation: 'risk-suggestions',
    providerName: 'deterministic-risk-proposals',
    instruction: 'Look for payment file integrity risks',
    contextSummary: {
      ...aiRunFixture.contextSummary,
      schemaVersion: 5,
      operation: 'risk-suggestions',
      instruction: { source: 'analyst' },
      riskProposals: suggestionsSection,
    },
  } as const;

  it('reads a risk suggestions run and a risk rewrite run with their v5 summaries (D-25)', async () => {
    const rewriteRun = {
      ...suggestionsRun,
      operation: 'risk-rewrite',
      instruction: null,
      contextSummary: {
        ...suggestionsRun.contextSummary,
        operation: 'risk-rewrite',
        instruction: { source: 'default-task' },
        riskProposals: { scope: 'risk', risksListed: 2, withdrawnListed: 0, rejectedListed: 0, openListed: 0, controlsListed: 2, focus: ['ratings'] },
      },
      targets: { ...suggestionsRun.targets, risk: 'risk-1' },
    } as const;
    for (const run of [suggestionsRun, rewriteRun]) {
      get.mockResolvedValueOnce({ data: { data: run }, response: { status: 200 } });
      await expect(getAiRun('run-1')).resolves.toEqual({ data: run, error: null });
    }
  });

  it('refuses an unknown key, scope or focus in the risk proposal section, or the section missing (G-3)', async () => {
    const { riskProposals: _riskProposals, ...withoutSection } = suggestionsRun.contextSummary;
    for (const contextSummary of [
      { ...suggestionsRun.contextSummary, riskProposals: { ...suggestionsSection, riskStatement: 'Unsigned payment files could be altered' } },
      { ...suggestionsRun.contextSummary, riskProposals: { ...suggestionsSection, scope: 'register' } },
      { ...suggestionsRun.contextSummary, riskProposals: { ...suggestionsSection, focus: ['owner'] } },
      { ...suggestionsRun.contextSummary, riskProposals: { ...suggestionsSection, risksListed: 201 } },
      withoutSection,
    ]) {
      get.mockResolvedValueOnce({ data: { data: { ...suggestionsRun, contextSummary } }, response: { status: 200 } });
      await expect(getAiRun('run-1')).resolves.toMatchObject({ data: null, error: { operation: 'getAiRun' } });
    }
  });
});
