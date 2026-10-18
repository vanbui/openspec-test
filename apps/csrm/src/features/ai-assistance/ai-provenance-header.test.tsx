import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./ai-run-sheet-trigger', () => ({
  AiRunSheetTrigger: ({ runId }: { runId: string }) => <button data-print="hidden" data-run={runId} type="button">Show what the AI used</button>,
}));

const startRiskSuggestions = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
vi.mock('@/features/risk-curation/risk-curation-actions', () => ({ startRiskSuggestionsAction: startRiskSuggestions }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { SuggestMoreRisksButton } from '@/features/risk-curation/suggest-more-risks-button';
import { takeRiskSuggestionJob } from '@/features/risk-curation/risk-proposal-job-handoff';
import { aiInputsChangedSlot, assessmentSignalProps } from './ai-inputs-changed';
import { assessmentProvenanceHeaderProps, questionnaireProvenanceHeaderProps, type AiGenerationFactsView } from './ai-provenance-domain';
import { AiProvenanceHeader } from './ai-provenance-header';

const generation: AiGenerationFactsView = {
  generatedAt: '2026-10-05T03:30:00.000Z',
  generatedBy: { documentId: 'analyst-1', displayName: 'Bob Analyst' },
  providerName: 'openai-compatible',
  providerVersion: 'model-a',
  runId: 'run-1',
};

function assessment(overrides: Partial<Parameters<typeof assessmentProvenanceHeaderProps>[0]> = {}) {
  return assessmentProvenanceHeaderProps({
    assessmentStatus: 'in-review',
    generation,
    aiProvenance: { runId: 'run-1', outstanding: 3 },
    risks: [{ documentId: 'risk-1', aiProvenance: { runId: 'run-1', outstanding: 0 } }, { documentId: 'risk 2', aiProvenance: { runId: 'run-1', outstanding: 5 } }],
    ...overrides,
  });
}

describe('AiProvenanceHeader on the analyst editor (12-UI-SPEC §1)', () => {
  it('says who asked, when, with which provider and model, and links the review that remains', () => {
    render(<AiProvenanceHeader {...assessment()!} />);
    const region = screen.getByRole('region', { name: 'AI generation' });
    expect(region.tagName).toBe('SECTION');
    expect(within(region).getByText('Generated with AI at the request of Bob Analyst')).toBeInTheDocument();
    expect(region).toHaveTextContent('Provider: openai-compatible · Model: model-a');
    expect(region.querySelector('time')).toHaveAttribute('dateTime', generation.generatedAt);
    expect(within(region).getByRole('link', { name: '8 AI-proposed fields to review' })).toHaveAttribute('href', '#assessment-details');
    expect(region.querySelector('svg.lucide-sparkles')).toHaveAttribute('aria-hidden', 'true');
    expect(within(region).getByRole('button', { name: 'Show what the AI used' })).toHaveAttribute('data-print', 'hidden');
  });

  it('links the first Risk in editor order when only Risks hold proposals, and words one field in the singular', () => {
    const { rerender } = render(<AiProvenanceHeader {...assessment({ aiProvenance: { runId: 'run-1', outstanding: 0 } })!} />);
    expect(screen.getByRole('link', { name: '5 AI-proposed fields to review' })).toHaveAttribute('href', '#risk-risk%202');
    rerender(<AiProvenanceHeader {...assessment({ aiProvenance: { runId: 'run-1', outstanding: 1 }, risks: [] })!} />);
    expect(screen.getByRole('link', { name: '1 AI-proposed field to review' })).toBeInTheDocument();
  });

  it('says every proposal is reviewed when none remain', () => {
    render(<AiProvenanceHeader {...assessment({ aiProvenance: { runId: 'run-1', outstanding: 0 }, risks: [] })!} />);
    const line = screen.getByText('All AI proposals reviewed');
    expect(line.querySelector('svg.lucide-circle-check-big, svg.lucide-check-circle-2, svg')).toHaveClass('text-success');
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('explains an assessment generated before runs were recorded, without a sheet trigger', () => {
    render(<AiProvenanceHeader {...assessment({ generation: { ...generation, runId: null }, aiProvenance: null, risks: [{ documentId: 'risk-1', aiProvenance: null }] })!} />);
    expect(screen.getByText('This draft was generated before CSRM recorded what the AI used, so its fields aren’t marked.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Show what the AI used' })).not.toBeInTheDocument();
  });

  /*
   * IN-301 (with CR-01): the served run id comes from the assessment's own AI facts alone. When those are missing or
   * malformed but the Risks carry theirs, the record is tracked: the header keeps the counts, which the Risk cards'
   * markers agree with, and takes the run from the first Risk that has one.
   */
  it('keeps the counts and the run when only the Risks carry AI facts', () => {
    render(<AiProvenanceHeader {...assessment({
      generation: { ...generation, runId: null },
      aiProvenance: null,
      risks: [{ documentId: 'risk-1', aiProvenance: null }, { documentId: 'risk 2', aiProvenance: { runId: 'run-7', outstanding: 2 } }],
    })!} />);
    expect(screen.getByRole('link', { name: '2 AI-proposed fields to review' })).toHaveAttribute('href', '#risk-risk%202');
    expect(screen.queryByText(/generated before CSRM recorded what the AI used/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show what the AI used' })).toHaveAttribute('data-run', 'run-7');
  });

  it('omits the review line once the assessment is released and keeps the trigger', () => {
    render(<AiProvenanceHeader {...assessment({ assessmentStatus: 'approved' })!} />);
    expect(screen.queryByText(/to review|All AI proposals reviewed/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show what the AI used' })).toBeInTheDocument();
  });

  it('renders nothing for an assessment not generated with AI, and names no analyst it was not served', () => {
    expect(assessment({ generation: null })).toBeNull();
    render(<AiProvenanceHeader {...assessment({ generation: { ...generation, generatedBy: null } })!} />);
    expect(screen.getByText('Generated with AI')).toBeInTheDocument();
  });

  /*
   * Phase 13 D-29 (13-UI-SPEC §10.2): the page renders the AI-inputs signal on the server and hands it to the header as a
   * slot, which the header sets as its last block, after the review line; without one the header is unchanged.
   */
  it('sets the served AI-inputs signal slot as its last block, after the review line', () => {
    const { rerender } = render(<AiProvenanceHeader {...assessment()!} aiInputsChanged={<p data-testid="ai-inputs-slot">AI inputs changed since this draft was generated</p>} />);
    const region = screen.getByRole('region', { name: 'AI generation' });
    const slot = within(region).getByTestId('ai-inputs-slot');
    expect(region.lastElementChild).toContainElement(slot);
    const reviewLink = within(region).getByRole('link', { name: '8 AI-proposed fields to review' });
    expect(reviewLink.compareDocumentPosition(slot) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    rerender(<AiProvenanceHeader {...assessment()!} />);
    expect(screen.queryByText(/AI inputs changed/)).not.toBeInTheDocument();
  });

  it('is a server component with no zod and no hex colour', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/ai-assistance/ai-provenance-header.tsx'), 'utf8');
    expect(source).not.toMatch(/^'use client'/);
    expect(source).not.toMatch(/from 'zod'/);
    expect(source).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
  });
});

describe('AiProvenanceHeader on the questionnaire review page (12-UI-SPEC §1)', () => {
  const questions = [{ aiOrigin: 'generated' }, { aiOrigin: 'generated' }, { aiOrigin: 'generated-edited' }, { aiOrigin: null }] as const;

  it('counts the questions still as generated and edited in analyst review, omitting a zero part', () => {
    render(<AiProvenanceHeader {...questionnaireProvenanceHeaderProps({ generation, inAnalystReview: true, questions })!} />);
    expect(screen.getByText('2 AI proposed · 1 edited')).toBeInTheDocument();
  });

  /* Walk D11 (voice rules: written-out singular and plural forms): one question an analyst added is in the singular. */
  it('names all three parts when analysts added questions, one or many', () => {
    const { rerender } = render(<AiProvenanceHeader {...questionnaireProvenanceHeaderProps({ generation, inAnalystReview: true, questions: [...questions, { aiOrigin: 'analyst-added' }] })!} />);
    expect(screen.getByText('2 AI proposed · 1 edited · 1 added by an analyst')).toBeInTheDocument();
    rerender(<AiProvenanceHeader {...questionnaireProvenanceHeaderProps({ generation, inAnalystReview: true, questions: [...questions, { aiOrigin: 'analyst-added' }, { aiOrigin: 'analyst-added' }] })!} />);
    expect(screen.getByText('2 AI proposed · 1 edited · 2 added by analysts')).toBeInTheDocument();
  });

  it('explains an untracked questionnaire and omits counts once released', () => {
    const { rerender } = render(<AiProvenanceHeader {...questionnaireProvenanceHeaderProps({ generation: { ...generation, runId: null }, inAnalystReview: true, questions })!} />);
    expect(screen.getByText('This questionnaire was generated before CSRM recorded what the AI used, so its questions aren’t marked.')).toBeInTheDocument();
    rerender(<AiProvenanceHeader {...questionnaireProvenanceHeaderProps({ generation, inAnalystReview: false, questions })!} />);
    expect(screen.queryByText(/AI proposed/)).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Show what the AI used' })).toBeInTheDocument();
  });

  it('renders nothing without served generation facts', () => {
    expect(questionnaireProvenanceHeaderProps({ generation: undefined, inAnalystReview: true, questions })).toBeNull();
  });
});

/* Phase 15 (15-UI-SPEC §9.1; D-28): the open-proposal line and the third line's count of questions from AI proposals. */
describe('AiProvenanceHeader on the questionnaire review, with AI proposals (Phase 15)', () => {
  const origins = [
    ...Array.from({ length: 5 }, () => ({ aiOrigin: 'generated' as const })),
    { aiOrigin: 'generated-edited' as const },
    { aiOrigin: 'proposal-confirmed' as const },
    { aiOrigin: 'proposal-edited' as const },
  ];
  const props = () => questionnaireProvenanceHeaderProps({ generation, inAnalystReview: true, questions: origins })!;

  it('counts the questions from AI proposals in the third line, omitting zero parts', () => {
    render(<AiProvenanceHeader {...props()} />);
    expect(screen.getByText('5 AI proposed · 1 edited · 2 from AI proposals')).toBeInTheDocument();
  });

  it('links the open proposals to the panel, and shows nothing at zero or unserved', () => {
    const { rerender } = render(<AiProvenanceHeader {...props()} openProposals={3} />);
    expect(screen.getByRole('link', { name: '3 open AI proposals' })).toHaveAttribute('href', '#ai-proposals');
    rerender(<AiProvenanceHeader {...props()} openProposals={1} />);
    expect(screen.getByRole('link', { name: '1 open AI proposal' })).toBeInTheDocument();
    for (const openProposals of [0, null]) {
      rerender(<AiProvenanceHeader {...props()} openProposals={openProposals} />);
      expect(screen.queryByRole('link', { name: /open AI proposal/ })).toBeNull();
    }
  });
});

describe('the AI inputs signal on an assessment after a Phase 16 request (16-UI-SPEC §10.2; D-28, UI-D26)', () => {
  const signal = { count: 1, notes: [{ documentId: 'note-1', part: 'requestor' as const, sequence: 1, postedAt: '2026-10-05T04:00:00.000Z', change: 'marked' as const }], files: [] };
  const header = (slot: ReturnType<typeof aiInputsChangedSlot>) => render(<AiProvenanceHeader {...assessment()!} aiInputsChanged={slot} />);

  beforeEach(() => { startRiskSuggestions.mockReset(); refresh.mockReset(); });

  it('reads the Phase 16 heading once a later request is the baseline, and offers Suggest more risks with its caption', async () => {
    startRiskSuggestions.mockResolvedValue({ ok: true, data: { jobId: 'job-1', operation: 'risk-suggestions', assessmentId: 'a1', status: 'queued' } });
    header(aiInputsChangedSlot({
      requestId: 'request-1',
      signal,
      target: 'draft',
      ...assessmentSignalProps({ askedAt: '2026-10-06T00:00:00.000Z', generatedAt: generation.generatedAt, viewerRaisedRequest: false, action: <SuggestMoreRisksButton assessmentId="a1" /> }),
    }));
    const block = document.querySelector<HTMLElement>('[data-ai-inputs-changed="draft"]')!;
    expect(block).toHaveTextContent('AI inputs changed since the AI was last asked about this assessment');
    expect(block).not.toHaveTextContent('since this draft was generated');
    expect(within(block).getByText('To bring this into one risk, use Rewrite this risk on that risk.')).toBeInTheDocument();
    fireEvent.click(within(block).getByRole('button', { name: 'Suggest more risks' }));
    await waitFor(() => expect(startRiskSuggestions).toHaveBeenCalledExactlyOnceWith({ assessmentId: 'a1' }));
    await waitFor(() => expect(takeRiskSuggestionJob('a1')).toMatchObject({ jobId: 'job-1' }));
  });

  it('keeps the draft heading before any Phase 16 request', () => {
    header(aiInputsChangedSlot({ requestId: 'request-1', signal, target: 'draft', ...assessmentSignalProps({ askedAt: null, generatedAt: generation.generatedAt, viewerRaisedRequest: false }) }));
    expect(document.querySelector('[data-ai-inputs-changed="draft"]')).toHaveTextContent('AI inputs changed since this draft was generated');
  });

  it('shows the requesting analyst only the caption, with no Suggest more risks', () => {
    header(aiInputsChangedSlot({
      requestId: 'request-1',
      signal,
      target: 'draft',
      ...assessmentSignalProps({ askedAt: '2026-10-06T00:00:00.000Z', generatedAt: generation.generatedAt, viewerRaisedRequest: true, action: <SuggestMoreRisksButton assessmentId="a1" /> }),
    }));
    const block = document.querySelector<HTMLElement>('[data-ai-inputs-changed="draft"]')!;
    expect(within(block).getByText('You raised this request, so another Security Analyst asks the AI about these changes.')).toBeInTheDocument();
    expect(within(block).queryByRole('button', { name: 'Suggest more risks' })).toBeNull();
    expect(block).not.toHaveTextContent('To bring this into one risk');
  });

  it('stops waiting for the job status line after a while, so a later one takes no focus (FE4-02)', async () => {
    vi.useFakeTimers();
    startRiskSuggestions.mockResolvedValue({ ok: true, data: { jobId: 'job-1', operation: 'risk-suggestions', assessmentId: 'a1', status: 'queued' } });
    render(<SuggestMoreRisksButton assessmentId="a1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest more risks' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(takeRiskSuggestionJob('a1')).toMatchObject({ jobId: 'job-1' });
    await act(async () => { await vi.advanceTimersByTimeAsync(10_000); });
    vi.useRealTimers();
    const status = document.createElement('p');
    status.tabIndex = -1;
    status.setAttribute('data-ai-proposals-job-status', '');
    status.textContent = 'The AI is looking for more risks';
    Element.prototype.scrollIntoView ??= () => undefined;
    try {
      act(() => { document.body.append(status); });
      await act(async () => { await new Promise((resolve) => setTimeout(resolve, 0)); });
      expect(status).not.toHaveFocus();
    } finally {
      status.remove();
    }
  });

  it('says why the AI was not asked, keeping the action', async () => {
    startRiskSuggestions.mockResolvedValue({ ok: false, kind: 'blocked', status: 409, reason: 'ASSESSMENT_NOT_MUTABLE', message: 'This assessment can no longer be changed, so the AI can’t be asked about it.' });
    render(<SuggestMoreRisksButton assessmentId="a1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest more risks' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('This assessment can no longer be changed, so the AI can’t be asked about it.');
  });
});
