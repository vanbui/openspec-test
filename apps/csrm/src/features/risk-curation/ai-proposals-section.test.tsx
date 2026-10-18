import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const actions = vi.hoisted(() => ({
  startRiskSuggestionsAction: vi.fn(),
  startRiskRewriteAction: vi.fn(),
  readRiskProposalJobAction: vi.fn(),
  retryRiskProposalJobAction: vi.fn(),
  readRiskAiProposalsAction: vi.fn(),
  decideRiskProposalsAction: vi.fn(),
}));
const refresh = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('./risk-curation-actions', () => actions);
vi.mock('sonner', () => ({ toast: notifications }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { readSessionDraft } from '@/lib/session-drafts/session-drafts';
import { handoffRiskSuggestionJob } from './risk-proposal-job-handoff';
import { AiProposalsSection } from './ai-proposals-section';
import { AiProposalsSectionClient } from './ai-proposals-section-client';
import { AiProposalsSectionLoader } from './ai-proposals-section-loader';
import type { RiskAiProposalItem, RiskAiProposals, RiskAiRunFacts, RiskProposalJob } from './risk-curation-domain';
import {
  causeChangeFixture,
  failedRewriteJobFixture,
  paymentFileRiskFixture,
  rewriteRunFixture,
  statementChangeFixture,
  similarRiskFixture,
  suggestionsJobFixture,
  suggestionsRunFixture,
  unratedRiskFixture,
} from './test-fixtures';

const allowed = { allowed: true, reason: null } as const;

function proposals(overrides: Partial<RiskAiProposals> = {}): RiskAiProposals {
  return {
    assessmentId: 'a1',
    editable: true,
    openCount: 0,
    openByRisk: [],
    lastAskedAt: null,
    actions: { suggest: allowed, rewrite: allowed, decide: allowed },
    runs: [],
    items: [],
    jobs: [],
    ...overrides,
  };
}

const run = suggestionsRunFixture as unknown as RiskAiRunFacts;
const items = [paymentFileRiskFixture, similarRiskFixture, unratedRiskFixture] as unknown as RiskAiProposalItem[];
const withProposals = proposals({ openCount: 3, runs: [run], items, lastAskedAt: run.completedAt });
const queued = { ...suggestionsJobFixture, assessmentId: 'a1', initiatedBy: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, initiatedByViewer: true } as unknown as RiskProposalJob;

function renderClient(view: RiskAiProposals | undefined = proposals(), extra: Partial<Parameters<typeof AiProposalsSectionClient>[0]> = {}) {
  return render(<AiProposalsSectionClient assessmentId="a1" ownerKey="owner-a" proposals={view} requestId="request-1" state="editable" {...extra} />);
}

beforeEach(() => {
  for (const mock of [...Object.values(actions), refresh, notifications.success, notifications.error, notifications.dismiss]) mock.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('the AI proposals section frame (16-UI-SPEC §2.1; D-45, UI-D2)', () => {
  it('renders the region every link lands on, the h2 and the description, then its body', () => {
    render(<AiProposalsSection assessmentId="a1" state="editable"><p>Body</p></AiProposalsSection>);
    const region = document.getElementById('ai-proposals');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('heading', { level: 2, name: 'AI proposals' })).toBeInTheDocument();
    expect(screen.getByText('Ask the AI for risks this assessment is missing. Nothing changes until you add a proposed risk or confirm a change, and every proposal needs your decision before release.')).toBeInTheDocument();
    expect(screen.getByText('Body')).toBeInTheDocument();
  });

  it('loads its body on demand through the loader', async () => {
    render(<AiProposalsSectionLoader assessmentId="a1" ownerKey="owner-a" proposals={withProposals} requestId="request-1" state="editable" />);
    expect(await screen.findByText('3 open proposals')).toBeInTheDocument();
  });
});

describe('asking the AI for more risks (§2.2, §2.3, §2.7; D-30)', () => {
  it('says what to do first when nothing was ever proposed, with the start form as its call to action', () => {
    renderClient();
    expect(screen.getByText('No AI proposals yet')).toBeInTheDocument();
    expect(screen.getByText('Ask the AI for risks this assessment may be missing, or give it an instruction such as “Risks about payment file integrity”.')).toBeInTheDocument();
    expect(screen.getByText('No open AI proposals')).toBeInTheDocument();
    const field = screen.getByLabelText('Instruction for the AI (optional)');
    expect(field).toHaveAttribute('id', 'ai-proposals-instruction');
    expect(field).toHaveAttribute('aria-keyshortcuts');
    expect(screen.getByText('Say what to look for, for example “Risks about payment file integrity”. The AI already reads the request, its answers, the marked notes and files, and the risks already in this assessment, withdrawn or rejected, so it doesn’t repeat them.')).toBeInTheDocument();
  });

  it('asks once with the instruction, says it is asking, then follows the job and offers Check again after 30 seconds', async () => {
    vi.useFakeTimers();
    let finish!: (value: unknown) => void;
    actions.startRiskSuggestionsAction.mockImplementation(() => new Promise((resolve) => { finish = resolve; }));
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'running' } });
    renderClient();
    fireEvent.change(screen.getByLabelText('Instruction for the AI (optional)'), { target: { value: 'Risks about payment file integrity' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suggest more risks' }));
    expect(actions.startRiskSuggestionsAction).toHaveBeenCalledExactlyOnceWith({ assessmentId: 'a1', instruction: 'Risks about payment file integrity' });
    expect(screen.getByRole('button', { name: 'Asking the AI…' })).toBeInTheDocument();
    await act(async () => { finish({ ok: true, data: queued }); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('The AI is looking for more risks')).toBeInTheDocument();
    expect(screen.getByText('You can leave this page. Proposed risks show here when you come back.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check again' })).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(30_000); });
    expect(actions.readRiskProposalJobAction).toHaveBeenCalledWith({ jobId: 'job-1' });
    expect(screen.getByRole('button', { name: 'Check again' })).toBeInTheDocument();
    expect(screen.getByText('Automatic checks stopped after 30 seconds. The AI may still be working.')).toBeInTheDocument();
    expect(readSessionDraft('risk-suggest-instruction', 'owner-a', 'a1') ?? '').toBe('');
  });

  it('keeps the instruction and shows a refusal under the field', async () => {
    actions.startRiskSuggestionsAction.mockResolvedValue({ ok: false, kind: 'field', status: 400, reason: 'INSTRUCTION_TOO_LONG', message: 'Keep the instruction to 500 characters or fewer.' });
    renderClient();
    fireEvent.change(screen.getByLabelText('Instruction for the AI (optional)'), { target: { value: 'Too long' } });
    fireEvent.click(screen.getByRole('button', { name: 'Suggest more risks' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Keep the instruction to 500 characters or fewer.');
    expect(screen.getByLabelText('Instruction for the AI (optional)')).toHaveValue('Too long');
  });

  it('lists the proposed risks once the job completes, announcing them without moving focus', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'completed', runId: 'run-s', completedAt: run.completedAt } });
    actions.readRiskAiProposalsAction.mockResolvedValue({ ok: true, data: withProposals });
    renderClient(proposals({ jobs: [queued] }));
    const before = document.activeElement;
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(actions.readRiskAiProposalsAction).toHaveBeenCalledWith({ assessmentId: 'a1' });
    expect(screen.getByText('3 open proposals')).toBeInTheDocument();
    expect(screen.getByText('3 proposed risks are ready to review.')).toBeInTheDocument();
    expect(document.activeElement).toBe(before);
    const group = screen.getByRole('article');
    expect(group).toHaveAttribute('id', 'ai-run-run-s');
    expect(within(group).getByRole('heading', { level: 3, name: 'Morgan Analyst asked the AI for more risks: “Risks about payment file integrity”' })).toBeInTheDocument();
    expect(group).toHaveTextContent('Provider: Deterministic · Model: v1 · 3 of 3 open');
    const leftOut = within(group).getByRole('button', { name: '1 left out' });
    expect(leftOut).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(leftOut);
    expect(leftOut).toHaveAttribute('aria-expanded', 'true');
    expect(within(group).getByText('A risk too close to one already in this assessment.')).toBeVisible();
    const card = document.getElementById('ai-proposal-run-s-s-1')!;
    expect(card.tagName).toBe('LI');
    expect(within(card).getByText('Proposed risk')).toBeInTheDocument();
    expect(within(card).getByText('Payment files altered before signing')).toBeInTheDocument();
    expect(card).toHaveTextContent('No Risk Type');
    expect(within(group).queryByRole('button', { name: /add all/i })).toBeNull();
  });

  it('says when the AI kept nothing, with its left-out list, and offers the start form again', async () => {
    vi.useFakeTimers();
    const nothing = { ...run, runId: 'run-n', instruction: null, outcome: 'no-change', counts: { items: 0, open: 0 }, adjustments: [{ code: 'near-duplicate-withdrawn', count: 2 }] } as RiskAiRunFacts;
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'completed', runId: 'run-n' } });
    actions.readRiskAiProposalsAction.mockResolvedValue({ ok: true, data: proposals({ runs: [nothing] }) });
    renderClient(proposals({ jobs: [queued] }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByText('The AI proposed no new risks for this assessment.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '2 left out' }));
    expect(screen.getByText('2 × A risk too close to one you withdrew.')).toBeInTheDocument();
    expect(screen.getByLabelText('Instruction for the AI (optional)')).toBeInTheDocument();
  });

  it('shows a failed request with R4’s copy and Retry AI proposals, keeping the start form', async () => {
    const failed = { ...failedRewriteJobFixture, jobId: 'job-f', operation: 'risk-suggestions', riskId: null, failureCode: 'PROVIDER_OUTPUT_INVALID' } as unknown as RiskProposalJob;
    actions.retryRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, jobId: 'job-r', attempt: 2 } });
    renderClient(proposals({ jobs: [failed] }));
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('The AI request didn’t finish')).toBeInTheDocument();
    expect(alert).toHaveTextContent('The AI’s reply couldn’t be read, so nothing was proposed. Try again.');
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry AI proposals' }));
    await waitFor(() => expect(actions.retryRiskProposalJobAction).toHaveBeenCalledWith({ assessmentId: 'a1', jobId: 'job-f' }));
    expect(await screen.findByText('The AI is looking for more risks')).toBeInTheDocument();
  });

  it('returns the start form below the failure when a followed job fails (FE4-01)', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'running' } });
    actions.readRiskProposalJobAction.mockResolvedValueOnce({ ok: true, data: { ...queued, status: 'failed', failureCode: 'PROVIDER_OUTPUT_INVALID', canRetry: true } });
    renderClient(proposals({ jobs: [queued] }));
    expect(document.getElementById('ai-proposals-instruction')).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('The AI request didn’t finish')).toBeInTheDocument();
    expect(screen.queryByText('The AI is looking for more risks')).toBeNull();
    expect(document.getElementById('ai-proposals-instruction')).not.toBeNull();
    expect(screen.getByRole('button', { name: 'Suggest more risks' })).toBeInTheDocument();
  });

  it('leaves the running state and reads the proposals again when the followed job is gone (FE4-01)', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: false, kind: 'blocked', status: 404, message: 'Status unavailable' });
    actions.readRiskAiProposalsAction.mockResolvedValue({ ok: true, data: proposals() });
    renderClient(proposals({ jobs: [queued] }));
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(actions.readRiskAiProposalsAction).toHaveBeenCalledWith({ assessmentId: 'a1' });
    expect(screen.queryByText('The AI is looking for more risks')).toBeNull();
    expect(screen.queryByText('Status unavailable')).toBeNull();
    expect(document.getElementById('ai-proposals-instruction')).not.toBeNull();
  });

  it('moves focus from the job status line to the status line when the job completes (FE4-08)', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'completed', runId: 'run-s', completedAt: run.completedAt } });
    actions.readRiskAiProposalsAction.mockResolvedValue({ ok: true, data: withProposals });
    renderClient(proposals({ jobs: [queued] }));
    act(() => screen.getByText('The AI is looking for more risks').focus());
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(document.activeElement).toBe(screen.getByText('3 open proposals'));
  });

  it('moves focus from the job status line to the failure’s title when the job fails (FE4-08)', async () => {
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'failed', failureCode: 'PROVIDER_OUTPUT_INVALID' } });
    renderClient(proposals({ jobs: [queued] }));
    act(() => screen.getByText('The AI is looking for more risks').focus());
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    expect(document.activeElement).toBe(screen.getByText('The AI request didn’t finish'));
  });

  it('names another analyst who started the request', () => {
    renderClient(proposals({ jobs: [{ ...queued, initiatedBy: { documentId: 'analyst-2', displayName: 'Riley Analyst' }, initiatedByViewer: false }] }));
    expect(screen.getByText('Started by Riley Analyst.')).toBeInTheDocument();
  });
});

describe('Open AI rewrites (§2.5; X-10)', () => {
  it('indexes every Risk with open AI changes, so the list equals the status line’s figure', () => {
    const changes = [statementChangeFixture, causeChangeFixture] as unknown as RiskAiProposalItem[];
    renderClient(proposals({ openCount: 5, runs: [run, rewriteRunFixture as unknown as RiskAiRunFacts], items: [...items, ...changes], openByRisk: [{ riskId: 'r3', count: 2 }] }), { risks: [{ id: 'r3', riskNumber: 'R-3' }] });
    expect(screen.getByText('5 open proposals')).toBeInTheDocument();
    const index = screen.getByRole('heading', { level: 3, name: 'Open AI rewrites' }).closest('section')!;
    const link = within(index).getByRole('link', { name: 'R-3 · 2 AI changes to review' });
    expect(link).toHaveAttribute('href', '#risk-r3-rewrite');
  });

  it('is not rendered when no Risk has open AI changes', () => {
    renderClient(withProposals);
    expect(screen.queryByRole('heading', { name: 'Open AI rewrites' })).toBeNull();
  });
});

describe('the section by assessment state (§2.4, §12.1)', () => {
  const rejected = { ...items[0]!, state: 'rejected', canUndo: true, decision: { action: 'rejected', by: { documentId: 'analyst-1', displayName: 'Morgan Analyst' }, at: '2026-10-14T07:00:00.000Z', reason: 'Covered by R-1', cause: null } } as RiskAiProposalItem;

  it('a released assessment shows the Lock line, no start form and no decision, and keeps Decided proposals', () => {
    render(<AiProposalsSection assessmentId="a1" state="released"><AiProposalsSectionClient assessmentId="a1" ownerKey="owner-a" proposals={proposals({ editable: false, runs: [run], items: [rejected] })} requestId="request-1" state="released" /></AiProposalsSection>);
    const line = screen.getByText('This assessment has been released, so the AI can no longer propose changes and its risks can’t be withdrawn or reinstated.');
    expect(line.querySelector('svg.lucide-lock')).toHaveAttribute('aria-hidden', 'true');
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Suggest more risks' })).toBeNull();
    const decided = screen.getByRole('button', { name: 'Show decided proposals (1)' });
    fireEvent.click(decided);
    expect(screen.getByText('Reason: “Covered by R-1”')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Undo/ })).toBeNull();
    expect(screen.queryByRole('button', { name: /^(Add to assessment|Reject)/ })).toBeNull();
  });

  it('another state the server serves as not editable shows its line and read-only proposals', () => {
    render(<AiProposalsSection assessmentId="a1" state="not-editable"><AiProposalsSectionClient assessmentId="a1" ownerKey="owner-a" proposals={withProposals} requestId="request-1" state="not-editable" /></AiProposalsSection>);
    expect(screen.getByText('This assessment can’t be changed now, so the AI can’t be asked and proposals can’t be decided.')).toBeInTheDocument();
    expect(document.getElementById('ai-proposal-run-s-s-1')).not.toBeNull();
    expect(screen.queryByRole('button', { name: /^(Add to assessment|Reject)/ })).toBeNull();
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
  });

  it('the AI policy refusal shows Phase 12’s alert in place of the start form while decisions remain', () => {
    renderClient(withProposals, { policy: { status: 'refused', reason: 'AI_POLICY_NOT_CONFIGURED', requestClassification: 'Internal', classificationSource: 'default', ceiling: null } });
    expect(screen.getByText('AI generation isn’t available for this request')).toBeInTheDocument();
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add to assessment: Payment files altered before signing' })).toBeInTheDocument();
  });

  it('the requesting analyst sees only the h2 and one line: no status, start, job, retry, groups or decided list', () => {
    render(<AiProposalsSection assessmentId="a1" state="editable" viewerRaisedRequest><AiProposalsSectionClient assessmentId="a1" ownerKey="owner-a" proposals={withProposals} requestId="request-1" state="editable" /></AiProposalsSection>);
    const region = document.getElementById('ai-proposals')!;
    expect(within(region).getByRole('heading', { level: 2, name: 'AI proposals' })).toBeInTheDocument();
    expect(region).toHaveTextContent('You raised this request, so another Security Analyst asks the AI about this assessment and decides its proposals. You can still edit, withdraw and reinstate its risks.');
    expect(region.querySelector('svg.lucide-lock')).not.toBeNull();
    expect(region).not.toHaveTextContent('Ask the AI for risks this assessment is missing.');
    expect(region).not.toHaveTextContent('open proposals');
    expect(within(region).queryAllByRole('button')).toEqual([]);
    expect(within(region).queryByRole('article')).toBeNull();
  });

  it('says every proposal is decided when none is open', () => {
    renderClient(proposals({ runs: [run], items: [rejected] }));
    expect(screen.getAllByText('No open AI proposals').length).toBe(2);
    expect(screen.getByText('Every proposal has been decided. They’re listed under Decided proposals.')).toBeInTheDocument();
  });

  it('shows the compact read error with Try again, which reads the proposals again', async () => {
    actions.readRiskAiProposalsAction.mockResolvedValueOnce({ ok: false, kind: 'retryable', status: 503, message: 'We couldn’t load the AI proposals' }).mockResolvedValueOnce({ ok: true, data: withProposals });
    render(<AiProposalsSectionClient assessmentId="a1" ownerKey="owner-a" requestId="request-1" state="editable" />);
    const alert = await screen.findByRole('alert');
    expect(alert).toHaveTextContent('We couldn’t load the AI proposals');
    fireEvent.click(within(alert).getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('3 open proposals')).toBeInTheDocument();
    expect(actions.readRiskAiProposalsAction).toHaveBeenCalledTimes(2);
  });
});

describe('phones and density (§2.1, §2.6, §3.5; D-47, UI-D27, UI-D29)', () => {
  function phoneWidth() {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 767px)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
  }
  afterEach(() => vi.unstubAllGlobals());

  it('at 375 the section is a summary card whose Review AI proposals opens the full-screen sheet on its title, returning focus on close', async () => {
    phoneWidth();
    renderClient(withProposals);
    expect(screen.getByText('3 open proposals')).toBeInTheDocument();
    expect(screen.queryByRole('article')).toBeNull();
    expect(screen.getByRole('button', { name: 'Suggest more risks' })).toBeInTheDocument();
    expect(screen.queryByRole('radiogroup', { name: 'Density' })).toBeNull();
    const review = screen.getByRole('button', { name: 'Review AI proposals' });
    fireEvent.click(review);
    const sheet = await screen.findByRole('dialog', { name: 'AI proposals' });
    await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('heading', { level: 2, name: 'AI proposals' })));
    expect(within(sheet).getByRole('article')).toHaveAttribute('id', 'ai-run-run-s');
    fireEvent.click(within(sheet).getByRole('button', { name: 'Close AI proposals' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(review));
  });

  it('at 375 follows a handed-over job with the sheet closed, and Review AI proposals still lands on the sheet’s title (FE4-02)', async () => {
    phoneWidth();
    vi.useFakeTimers();
    actions.readRiskProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'completed', runId: 'run-s', completedAt: run.completedAt } });
    actions.readRiskAiProposalsAction.mockResolvedValue({ ok: true, data: withProposals });
    renderClient(proposals({ runs: [run], items: [{ ...items[0]!, state: 'rejected' } as RiskAiProposalItem] }));
    act(() => handoffRiskSuggestionJob(queued));
    expect(screen.getByText('The AI is looking for more risks')).toBeInTheDocument();
    await act(async () => { await vi.advanceTimersByTimeAsync(2_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(actions.readRiskProposalJobAction).toHaveBeenCalledWith({ jobId: 'job-1' });
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByText('The AI is looking for more risks')).toBeNull();
    expect(screen.getByText('3 open proposals')).toBeInTheDocument();
    vi.useRealTimers();
    fireEvent.click(screen.getByRole('button', { name: 'Review AI proposals' }));
    const sheet = await screen.findByRole('dialog', { name: 'AI proposals' });
    await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByRole('heading', { level: 2, name: 'AI proposals' })));
  });

  it('at 375 Suggest more risks opens the sheet with focus in the instruction field', async () => {
    phoneWidth();
    renderClient(withProposals);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest more risks' }));
    const sheet = await screen.findByRole('dialog', { name: 'AI proposals' });
    await waitFor(() => expect(document.activeElement).toBe(within(sheet).getByLabelText('Instruction for the AI (optional)')));
  });

  it('offers Density from 768px, and Compact collapses the facts into the details', () => {
    renderClient(withProposals);
    const control = screen.getByRole('radiogroup', { name: 'Density' });
    const card = () => document.getElementById('ai-proposal-run-s-s-1')!;
    expect(card()).toHaveTextContent('No Risk Type · Supplier payment file');
    fireEvent.click(within(control).getByRole('radio', { name: 'Compact' }));
    expect(card()).not.toHaveTextContent('No Risk Type · Supplier payment file');
    expect(card().className).toContain('p-3');
    fireEvent.click(within(card()).getByRole('button', { name: 'Show proposed details' }));
    expect(card()).toHaveTextContent('No Risk Type · Supplier payment file');
    expect(window.localStorage.getItem('csrm:risk-ai-proposals-density:owner-a')).toBe('compact');
  });

  it('names the reason row Reject remaining opens, present while it is collapsed (UI-01, Accessibility contract 4.1.2)', () => {
    renderClient(withProposals);
    const button = screen.getByRole('button', { name: /^Reject remaining \(3\)/ });
    const controls = button.getAttribute('aria-controls');
    expect(controls, 'REJECT_REMAINING_NO_ARIA_CONTROLS').toBeTruthy();
    expect(document.getElementById(controls!), 'REJECT_REMAINING_TARGET_MISSING').not.toBeNull();
    fireEvent.click(button);
    expect(button).toHaveAttribute('aria-expanded', 'true');
    expect(within(document.getElementById(controls!)!).getByRole('textbox')).toHaveFocus();
  });

  it('keeps eight proposals in one group readable in compact density', () => {
    const eight = Array.from({ length: 8 }, (_, index) => ({ ...items[2]!, itemKey: `s-${index + 1}`, proposed: { ...items[2]!.proposed, riskStatement: `Proposed risk number ${index + 1}` } })) as RiskAiProposalItem[];
    window.localStorage.setItem('csrm:risk-ai-proposals-density:owner-a', 'compact');
    renderClient(proposals({ runs: [{ ...run, counts: { items: 8, open: 8 } }], items: eight }));
    const group = screen.getByRole('article');
    expect(group.querySelectorAll('ol > li')).toHaveLength(8);
    expect(group).toHaveTextContent('8 of 8 open');
    expect(screen.getByText('8 open proposals')).toBeInTheDocument();
  });
});
