import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const startRewrite = vi.hoisted(() => vi.fn());
const getJob = vi.hoisted(() => vi.fn());
const retryJob = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const startProposals = vi.hoisted(() => vi.fn());
vi.mock('./questionnaire-ai-actions', () => ({
  startQuestionnaireAiProposalsAction: startProposals,
  startQuestionRewriteAction: startRewrite,
  getQuestionnaireProposalJobAction: getJob,
  retryQuestionnaireProposalJobAction: retryJob,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));

import { QuestionAiRowExtras, QuestionRewriteControl } from './question-rewrite-control';
import { StartProposalsButton } from './start-proposals-button';
import { questionRowAiFactsOf, type QuestionnaireAiProposalsView } from './questionnaire-ai-domain';
import { proposalsFixture, rewriteJobFixture } from './test-fixtures';

const question = { id: 'question-3', text: 'Where is data stored?' };
const timing = { pollIntervalMs: 5, timeoutMs: 60 };
const runningJob = { ...rewriteJobFixture, status: 'running' as const };

function control(props: Partial<Parameters<typeof QuestionRewriteControl>[0]> = {}) {
  return render(<QuestionRewriteControl job={null} noChangeRunIds={[]} openItemAnchor={null} ownerKey="owner-a" question={question} questionnaireId="questionnaire-1" timing={timing} {...props} />);
}

beforeEach(() => { for (const mock of [startProposals, startRewrite, getJob, retryJob, refresh]) mock.mockReset(); });
afterEach(() => { window.sessionStorage.clear(); });

describe('Rewrite in plain language (§6; D-11)', () => {
  it('recovers a failed status read and completes the rewrite (FE-04)', async () => {
    getJob.mockResolvedValueOnce({ ok: false }).mockResolvedValue({ ok: true, data: { ...runningJob, status: 'completed', runId: 'run-7' } });
    control({ job: runningJob, timing: { pollIntervalMs: 10, timeoutMs: 1_000 } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Status unavailable');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('recovers a rejected status request without leaving the rewrite stuck (FE-04)', async () => {
    getJob.mockRejectedValueOnce(new Error('offline')).mockResolvedValue({ ok: true, data: { ...runningJob, status: 'completed', runId: 'run-7' } });
    control({ job: runningJob, timing: { pollIntervalMs: 10, timeoutMs: 1_000 } });
    expect(await screen.findByRole('alert')).toHaveTextContent('Status unavailable');
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it('bounds automatic checks, then Check again can discover completion (FE-04)', async () => {
    getJob.mockResolvedValue({ ok: true, data: runningJob });
    control({ job: runningJob });
    const check = await screen.findByRole('button', { name: 'Check again' });
    const checks = getJob.mock.calls.length;
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(getJob).toHaveBeenCalledTimes(checks);
    getJob.mockResolvedValue({ ok: true, data: { ...runningJob, status: 'completed', runId: 'run-7' } });
    fireEvent.click(check);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });
  it('opens the form with focus in the field, and Rewrite question starts the rewrite once', async () => {
    startRewrite.mockResolvedValueOnce({ ok: true, data: rewriteJobFixture });
    getJob.mockResolvedValue({ ok: true, data: runningJob });
    control();
    const trigger = screen.getByRole('button', { name: 'Rewrite in plain language: Where is data stored?' });
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    fireEvent.click(trigger);
    const field = await screen.findByLabelText('Instruction for the AI (optional)');
    await waitFor(() => expect(field).toHaveFocus());
    expect(screen.getByText('Leave it empty for plain words, one thing per question and help text for specialist terms. The answer type and choices stay the same.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Rewrite question' }));
    await waitFor(() => expect(startRewrite).toHaveBeenCalledExactlyOnceWith({ documentId: 'questionnaire-1', questionId: 'question-3', instruction: '' }));
    const rewriting = await screen.findByText('Rewriting…');
    await waitFor(() => expect(rewriting.closest('[tabindex="-1"]')).toHaveFocus());
  });

  it('Keep as is closes the form and returns focus to the trigger', async () => {
    control();
    const trigger = screen.getByRole('button', { name: 'Rewrite in plain language: Where is data stored?' });
    fireEvent.click(trigger);
    fireEvent.click(await screen.findByRole('button', { name: 'Keep as is' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: 'Rewrite question' })).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });

  it('refreshes once the job completes, then links to the proposal', async () => {
    getJob.mockResolvedValue({ ok: true, data: { ...runningJob, status: 'completed', runId: 'run-7' } });
    const { rerender } = control({ job: runningJob });
    expect(screen.getByText('Rewriting…')).toBeInTheDocument();
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(<QuestionRewriteControl job={null} noChangeRunIds={[]} openItemAnchor="ai-proposal-run-7-i-1" ownerKey="owner-a" question={question} questionnaireId="questionnaire-1" timing={timing} />);
    expect(screen.getByRole('link', { name: 'Open AI proposal' })).toHaveAttribute('href', '#ai-proposal-run-7-i-1');
  });

  it('says when the AI found nothing to simplify', async () => {
    getJob.mockResolvedValue({ ok: true, data: { ...runningJob, status: 'completed', runId: 'run-8' } });
    const { rerender } = control({ job: runningJob });
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(<QuestionRewriteControl job={null} noChangeRunIds={['run-8']} openItemAnchor={null} ownerKey="owner-a" question={question} questionnaireId="questionnaire-1" timing={timing} />);
    expect(screen.getByText('The AI found nothing to simplify in this question.')).toBeInTheDocument();
  });

  it('shows a failed rewrite with Retry, named by its question', async () => {
    retryJob.mockResolvedValueOnce({ ok: true, data: runningJob });
    getJob.mockResolvedValue({ ok: true, data: runningJob });
    control({ job: { ...runningJob, status: 'failed', failureCode: 'PROVIDER_OUTPUT_INVALID', failureMessage: 'x', canRetry: true } });
    expect(screen.getByText('The rewrite didn’t finish.')).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Retry rewrite: Where is data stored?' })); });
    expect(retryJob).toHaveBeenCalledWith({ jobId: 'job-1', documentId: 'questionnaire-1' });
    expect(await screen.findByText('Rewriting…')).toBeInTheDocument();
  });
});

describe('below 768px (§6.1; UI-D16)', () => {
  afterEach(() => { vi.unstubAllGlobals(); });

  it('opens a bottom sheet with a title row and Close, which returns focus to the trigger', async () => {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: query === '(max-width: 767px)', media: query, addEventListener: () => undefined, removeEventListener: () => undefined }));
    control();
    const trigger = screen.getByRole('button', { name: 'Rewrite in plain language: Where is data stored?' });
    fireEvent.click(trigger);
    const sheet = await screen.findByRole('dialog', { name: 'Rewrite in plain language' });
    expect(sheet).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(trigger).toHaveFocus());
  });
});

describe('where the control appears (§6.1; D-32)', () => {
  const view = proposalsFixture as unknown as QuestionnaireAiProposalsView;
  const facts = questionRowAiFactsOf(view);
  const row = (props: { answered?: boolean; facts?: typeof facts | null }) => render(<QuestionAiRowExtras facts={props.facts === undefined ? facts : props.facts} ownerKey="owner-a" question={{ id: 'question-4', text: 'Who supports it?', answered: props.answered }} questionnaireId="questionnaire-1" />);

  it('offers the control on an unanswered row when the read allows a rewrite', () => {
    row({});
    expect(screen.getByRole('button', { name: 'Rewrite in plain language: Who supports it?' })).toBeInTheDocument();
  });

  it('never on an answered row', () => {
    row({ answered: true });
    expect(screen.queryByRole('button', { name: /Rewrite in plain language/ })).toBeNull();
  });

  it('never while the Requestor is answering, when the read refuses a rewrite', () => {
    row({ facts: questionRowAiFactsOf({ ...view, state: 'awaiting-submission', actions: { ...view.actions, rewrite: { allowed: false, reason: 'QUESTIONNAIRE_NOT_SUBMITTED' } } }) });
    expect(screen.queryByRole('button', { name: /Rewrite in plain language/ })).toBeNull();
  });

  it('never for a requesting analyst, who is served no proposals read', () => {
    row({ facts: null });
    expect(screen.queryByRole('button', { name: /Rewrite in plain language/ })).toBeNull();
  });
});

describe('the open-proposal link and the Answered note on a row (§4.7, §7.1)', () => {
  const view = proposalsFixture as unknown as QuestionnaireAiProposalsView;
  const facts = questionRowAiFactsOf(view);

  it('links a question with one open proposal to its card, and moves focus there', () => {
    const card = document.createElement('li');
    card.id = 'ai-proposal-run-1-i-9';
    card.tabIndex = -1;
    document.body.append(card);
    render(<QuestionAiRowExtras facts={{ ...facts, open: { 'question-4': { count: 1, anchor: 'ai-proposal-run-1-i-9' } } }} ownerKey="owner-a" question={{ id: 'question-4', text: 'Who supports it?' }} questionnaireId="questionnaire-1" />);
    const link = screen.getByRole('link', { name: 'Open AI proposal' });
    expect(link).toHaveAttribute('href', '#ai-proposal-run-1-i-9');
    fireEvent.click(link);
    expect(card).toHaveFocus();
    card.remove();
  });

  it('counts two open proposals', () => {
    render(<QuestionAiRowExtras facts={{ ...facts, open: { 'question-4': { count: 2, anchor: 'ai-proposal-run-1-i-2' } } }} ownerKey="owner-a" question={{ id: 'question-4', text: 'Who supports it?' }} questionnaireId="questionnaire-1" />);
    expect(screen.getByRole('link', { name: '2 open AI proposals' })).toHaveAttribute('href', '#ai-proposal-run-1-i-2');
  });

  it('shows the Answered note in the submitted view when asked, and no rewrite', () => {
    render(<QuestionAiRowExtras facts={facts} ownerKey="owner-a" question={{ id: 'question-4', text: 'Who supports it?', answered: true }} questionnaireId="questionnaire-1" withAnsweredNote />);
    expect(screen.getByText('Answered')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Rewrite in plain language/ })).toBeNull();
  });
});

describe('Suggest follow-up questions from the signal (§9.1; UI-D20)', () => {
  it('waits for a delayed job holder to mount and lands it in view (D8)', async () => {
    startProposals.mockResolvedValueOnce({ ok: true, data: { ...rewriteJobFixture, operation: 'questionnaire-proposals', questionId: null } });
    const scroll = vi.fn();
    const section = document.createElement('section');
    section.id = 'ai-proposals';
    section.tabIndex = -1;
    document.body.append(section);
    const { unmount } = render(<StartProposalsButton questionnaireId="questionnaire-1" />);
    fireEvent.click(screen.getByRole('button', { name: 'Suggest follow-up questions' }));
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    // More than the old 60-frame cap, with no intermediate fallback landing.
    await act(async () => { await new Promise((resolve) => setTimeout(resolve, 1_100)); });
    expect(section).not.toHaveFocus();
    const status = document.createElement('p');
    status.dataset.aiProposalsJobStatus = '';
    status.textContent = 'The AI is preparing proposals';
    status.tabIndex = -1;
    status.scrollIntoView = scroll;
    section.append(status);
    await waitFor(() => expect(status).toHaveFocus());
    expect(scroll).toHaveBeenCalledWith({ block: 'start' });
    unmount();
    section.remove();
  });
  it('starts the default task without an instruction and moves focus to the panel’s job status line', async () => {
    startProposals.mockResolvedValueOnce({ ok: true, data: { ...rewriteJobFixture, operation: 'questionnaire-proposals', questionId: null } });
    const status = document.createElement('p');
    status.setAttribute('data-ai-proposals-job-status', '');
    status.textContent = 'The AI is preparing proposals';
    status.scrollIntoView = vi.fn();
    status.tabIndex = -1;
    document.body.append(status);
    render(<StartProposalsButton questionnaireId="questionnaire-1" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Suggest follow-up questions' })); });
    expect(startProposals).toHaveBeenCalledExactlyOnceWith({ documentId: 'questionnaire-1' });
    expect(refresh).toHaveBeenCalled();
    await waitFor(() => expect(status).toHaveFocus());
    status.remove();
  });

  it('says why when the start is refused', async () => {
    startProposals.mockResolvedValueOnce({ ok: false, failure: 'blocked', status: 409, reason: 'QUESTIONNAIRE_NOT_SUBMITTED', message: 'The Requestor is still answering this questionnaire. Wait for them to submit it, or return it to analyst review.' });
    render(<StartProposalsButton questionnaireId="questionnaire-1" />);
    await act(async () => { fireEvent.click(screen.getByRole('button', { name: 'Suggest follow-up questions' })); });
    expect(screen.getByRole('alert')).toHaveTextContent('The Requestor is still answering this questionnaire. Wait for them to submit it, or return it to analyst review.');
  });
});
