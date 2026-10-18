import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type { Action } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const decide = vi.hoisted(() => vi.fn());
const startProposals = vi.hoisted(() => vi.fn());
const getJob = vi.hoisted(() => vi.fn());
const retryJob = vi.hoisted(() => vi.fn());
const refresh = vi.hoisted(() => vi.fn());
const notifications = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), dismiss: vi.fn() }));
vi.mock('./questionnaire-ai-actions', () => ({
  decideQuestionnaireAiProposalsAction: decide,
  startQuestionnaireAiProposalsAction: startProposals,
  getQuestionnaireProposalJobAction: getJob,
  retryQuestionnaireProposalJobAction: retryJob,
  listQuestionnaireAiProposalsAction: vi.fn(),
  startQuestionRewriteAction: vi.fn(),
}));
vi.mock('sonner', () => ({ toast: notifications }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }));
const returnToReview = vi.hoisted(() => vi.fn());
vi.mock('../questionnaires/questionnaire-actions', () => ({ returnQuestionnaireToAnalystReviewAction: returnToReview }));

import { AiProposalsPanel } from './ai-proposals-panel';
import { AiProposalsPanelClient } from './ai-proposals-panel-client';
import { StartProposalsButton } from './start-proposals-button';
import type { QuestionnaireAiItemView, QuestionnaireAiProposalsView, QuestionnaireAiRunView } from './questionnaire-ai-domain';
import { contextTooLargeJobFixture, proposalsFixture, rewriteJobFixture } from './test-fixtures';

const base = proposalsFixture as unknown as QuestionnaireAiProposalsView;

function addItem(itemKey: string, questionText: string): QuestionnaireAiItemView {
  return {
    ...(base.items[0] as QuestionnaireAiItemView),
    itemKey,
    proposed: { questionText, helpText: null, answerType: 'Text', choices: [], required: false },
    placement: { sectionTitle: 'Offshore support', newSection: false, visibility: null },
    sources: [],
  };
}

const run: QuestionnaireAiRunView = {
  ...(base.runs[0] as QuestionnaireAiRunView),
  initiatedBy: { documentId: 'analyst-2', displayName: 'Bob Doe' },
  instruction: null,
  instructionSource: 'default-task',
  adjustments: [],
  counts: { items: 1, open: 1 },
};

function viewWith(items: readonly QuestionnaireAiItemView[]): QuestionnaireAiProposalsView {
  return { ...base, openCount: items.filter((item) => item.state === 'open').length, runs: [{ ...run, counts: { items: items.length, open: items.length } }], items, jobs: [], fixedQuestions: [{ questionId: 'question-9', questionText: 'Who owns the system?' }] };
}

const oneAdd = viewWith([addItem('i-1', 'Who supports the system offshore?')]);
const applied = { ok: true, data: { applied: 1, unchanged: 0 } };

function toastAction(call: unknown[] | undefined): Action | undefined {
  return (call?.[1] as { action?: Action } | undefined)?.action;
}

const fastTiming = { pollIntervalMs: 5, timeoutMs: 60 };

function renderClient(view: QuestionnaireAiProposalsView = oneAdd) {
  return render(<AiProposalsPanelClient ownerKey="owner-a" requestId="request-1" timing={fastTiming} view={view} />);
}

const empty: QuestionnaireAiProposalsView = { ...base, openCount: 0, runs: [], items: [], jobs: [], fixedQuestions: [] };
const queuedJob = { ...rewriteJobFixture, operation: 'questionnaire-proposals' as const, questionId: null, jobId: 'job-9' };

beforeEach(() => {
  for (const mock of [decide, startProposals, getJob, retryJob, refresh, notifications.success, notifications.error, notifications.dismiss]) mock.mockReset();
});

afterEach(() => {
  window.sessionStorage.clear();
  window.localStorage.clear();
});

describe('the AI proposals panel frame (§1, §2.1; D-33)', () => {
  it('renders the region, heading, description and status line, then the panel’s content', async () => {
    render(<AiProposalsPanel outcome={{ kind: 'view', view: oneAdd }} ownerKey="owner-a" requestId="request-1" />);
    const region = document.getElementById('ai-proposals');
    expect(region).not.toBeNull();
    expect(region).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('heading', { level: 2, name: 'AI proposals' })).toBeInTheDocument();
    expect(screen.getByText('Ask the AI to suggest questions, or to change or remove unanswered ones. Nothing changes until you confirm it, and the Requestor sees changes only when you release the questionnaire.')).toBeInTheDocument();
    expect(await screen.findByText('1 open proposal')).toBeInTheDocument();
    expect(await screen.findByRole('heading', { level: 3, name: 'Bob Doe asked the AI for follow-up questions' })).toBeInTheDocument();
  });
});

describe('reviewing a proposal (§4.1, §4.2, §5.1, §5.5)', () => {
  it('offers Confirm and Reject for a removal, with no unsupported edit path (FE-06)', async () => {
    decide.mockResolvedValue(applied);
    renderClient(viewWith([{ ...base.items[1]!, kind: 'remove', proposed: null, state: 'open', stale: false, decision: null, canUndo: false }]));
    expect(screen.queryByRole('button', { name: /^Edit, then confirm/ })).toBeNull();
    expect(screen.getByRole('button', { name: /^Reject:/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /^Confirm:/ }));
    await waitFor(() => expect(decide).toHaveBeenCalledWith(expect.objectContaining({ decisions: [{ runId: 'run-1', item: base.items[1]!.itemKey, action: 'accept' }] })));
  });
  it('groups the open proposal under its request and shows the card', () => {
    renderClient();
    const group = screen.getByRole('article');
    expect(group).toHaveAttribute('id', 'ai-run-run-1');
    expect(within(group).getByRole('heading', { level: 3, name: 'Bob Doe asked the AI for follow-up questions' })).toBeInTheDocument();
    const card = document.getElementById('ai-proposal-run-1-i-1');
    expect(card).not.toBeNull();
    expect(within(card!).getByText('New question')).toBeInTheDocument();
    expect(within(card!).getAllByText('Who supports the system offshore?').length).toBeGreaterThan(0);
  });

  it('confirms at once through one decision, then offers Undo, which restores it', async () => {
    let finish!: (value: unknown) => void;
    decide.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; })).mockResolvedValueOnce(applied);
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm: Who supports the system offshore?' }));
    expect(decide).toHaveBeenCalledExactlyOnceWith({ documentId: 'questionnaire-1', decisions: [{ runId: 'run-1', item: 'i-1', action: 'accept' }], intent: 'confirm' });
    // Applied at once: the card leaves the open list before the server answers.
    expect(screen.queryByRole('button', { name: 'Confirm: Who supports the system offshore?' })).toBeNull();
    await act(async () => finish(applied));
    await waitFor(() => expect(notifications.success).toHaveBeenCalled());
    const [message, options] = notifications.success.mock.calls[0]!;
    expect(message).toBe('New question confirmed and added to Offshore support.');
    expect(options.action.label).toBe('Undo');
    act(() => options.action.onClick());
    await waitFor(() => expect(decide).toHaveBeenCalledTimes(2));
    expect(decide.mock.calls[1]![0]).toEqual({ documentId: 'questionnaire-1', decisions: [{ runId: 'run-1', item: 'i-1', action: 'restore' }], intent: 'undo-confirmation' });
    await waitFor(() => expect(notifications.success).toHaveBeenCalledWith('Confirmation undone. The question was taken out again.', expect.any(Object)));
  });

  it('rolls a refused Confirm back with Q2’s copy and refreshes for a stale proposal', async () => {
    decide.mockResolvedValueOnce({ ok: false, failure: 'blocked', status: 409, reason: 'AI_PROPOSAL_STALE', message: 'This question has changed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.' });
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm: Who supports the system offshore?' }));
    await waitFor(() => expect(notifications.error).toHaveBeenCalled());
    const [title, options] = notifications.error.mock.calls[0]!;
    expect(title).toBe('Proposal not confirmed');
    expect(options.description).toBe('This question has changed since the AI proposed this, so it can’t be confirmed. Reject it, or ask the AI again.');
    expect(toastAction(notifications.error.mock.calls[0])?.label).toBe('Refresh page');
    expect(refresh).toHaveBeenCalled();
    expect(await screen.findByRole('button', { name: 'Confirm: Who supports the system offshore?' })).toBeInTheDocument();
  });

  it('moves focus to the next open proposal’s Confirm, and to the status line when none remains', async () => {
    decide.mockResolvedValue(applied);
    const { unmount } = renderClient(viewWith([addItem('i-1', 'First question?'), addItem('i-2', 'Second question?')]));
    fireEvent.click(screen.getByRole('button', { name: 'Confirm: First question?' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Confirm: Second question?' })).toHaveFocus());
    unmount();
    renderClient();
    fireEvent.click(screen.getByRole('button', { name: 'Confirm: Who supports the system offshore?' }));
    await waitFor(() => expect(document.querySelector('[data-ai-proposals-status]')).toHaveFocus());
  });
});

describe('asking the AI (§2.2, §3; UI-D3, X-25)', () => {
  it('hands a signal start to the mounted panel without waiting for an active server seed (D8)', async () => {
    startProposals.mockResolvedValueOnce({ ok: true, data: queuedJob });
    getJob.mockResolvedValue({ ok: true, data: queuedJob });
    render(<><StartProposalsButton questionnaireId={empty.questionnaireId} /><AiProposalsPanelClient ownerKey="owner-a" requestId="request-1" view={empty} /></>);
    const status = document.querySelector<HTMLElement>('[data-ai-proposals-job-status]')!;
    status.scrollIntoView = vi.fn();
    fireEvent.click(screen.getByRole('button', { name: 'Suggest follow-up questions' }));
    await waitFor(() => expect(status).toHaveTextContent('The AI is preparing proposals'));
    await waitFor(() => expect(status).toHaveFocus());
  });
  it('keeps the live status mounted and transfers start focus after rendering (D3, NVDA)', async () => {
    const { container } = renderClient(empty);
    const status = container.querySelector('[data-ai-proposals-job-status]');
    expect(status).not.toBeNull();
    expect(status).toHaveTextContent('');
    startProposals.mockResolvedValueOnce({ ok: true, data: queuedJob });
    getJob.mockResolvedValue({ ok: true, data: queuedJob });
    fireEvent.click(screen.getByRole('button', { name: 'Suggest more questions' }));
    await waitFor(() => expect(status).toHaveTextContent('The AI is preparing proposals'));
    expect(status).toHaveFocus();
    expect(container.querySelector('[data-ai-proposals-job-status]')).toBe(status);
  });
  it('labels the start by the field and the answered questions', () => {
    const { unmount } = renderClient(empty);
    expect(screen.getByRole('button', { name: 'Suggest more questions' })).toBeInTheDocument();
    unmount();
    renderClient({ ...empty, fixedQuestions: [{ questionId: 'question-9', questionText: 'Who owns the system?' }] });
    expect(screen.getByRole('button', { name: '1 answered question stays as it is' })).toHaveClass('min-h-6');
    expect(screen.getByRole('button', { name: 'Suggest follow-up questions' })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText('Instruction for the AI (optional)'), { target: { value: 'Cover the offshore team' } });
    expect(screen.getByRole('button', { name: 'Ask the AI' })).toBeInTheDocument();
    expect(screen.getByText('23 of 500 characters')).toBeInTheDocument();
  });

  it('sets no length limit on the field, refuses more than 500 characters on submit and focuses the field', () => {
    renderClient(empty);
    const field = screen.getByLabelText('Instruction for the AI (optional)');
    expect(field).not.toHaveAttribute('maxlength');
    fireEvent.change(field, { target: { value: 'x'.repeat(512) } });
    fireEvent.click(screen.getByRole('button', { name: 'Ask the AI' }));
    expect(screen.getByText('Keep the instruction to 500 characters or fewer. It has 512.')).toBeInTheDocument();
    expect(field).toHaveFocus();
    expect(startProposals).not.toHaveBeenCalled();
  });

  it('submits with Ctrl + Enter, shows a served refusal beside the field and keeps the text', async () => {
    startProposals.mockResolvedValueOnce({ ok: false, failure: 'field', status: 400, reason: 'INSTRUCTION_REPEATS_REQUESTOR_TEXT', message: 'The instruction repeats a long passage of the Requestor’s own words. The AI already reads the request and the marked notes and files, so say what to focus on in your own words.' });
    renderClient(empty);
    const field = screen.getByLabelText('Instruction for the AI (optional)');
    fireEvent.change(field, { target: { value: 'The vendor processes payroll.' } });
    fireEvent.keyDown(field, { key: 'Enter', ctrlKey: true });
    expect(startProposals).toHaveBeenCalledWith({ documentId: 'questionnaire-1', instruction: 'The vendor processes payroll.' });
    expect(await screen.findByText('The instruction repeats a long passage of the Requestor’s own words. The AI already reads the request and the marked notes and files, so say what to focus on in your own words.')).toBeInTheDocument();
    expect(field).toHaveValue('The vendor processes payroll.');
  });

  it('keeps the text for the session, restores it with its caption, and clears it once the AI is asked', async () => {
    const { unmount } = renderClient(empty);
    fireEvent.change(screen.getByLabelText('Instruction for the AI (optional)'), { target: { value: 'Cover backups' } });
    unmount();
    renderClient(empty);
    expect(screen.getByLabelText('Instruction for the AI (optional)')).toHaveValue('Cover backups');
    expect(screen.getByText('Restored from earlier in this session.')).toBeInTheDocument();
    startProposals.mockResolvedValueOnce({ ok: true, data: queuedJob });
    getJob.mockResolvedValue({ ok: true, data: queuedJob });
    fireEvent.click(screen.getByRole('button', { name: 'Ask the AI' }));
    expect(await screen.findByText('The AI is preparing proposals')).toBeInTheDocument();
    expect(window.sessionStorage.getItem('csrm-draft:questionnaire-ai-instruction:owner-a:questionnaire-1')).toBeNull();
  });
});

describe('the job state (§2.3)', () => {
  it('says the AI is preparing proposals, names who started it, and offers Check again after automatic checks stop', async () => {
    getJob.mockResolvedValue({ ok: true, data: { ...queuedJob, initiatedByViewer: false, initiatedBy: { documentId: 'analyst-2', displayName: 'Sam Analyst' } } });
    renderClient({ ...empty, jobs: [{ ...queuedJob, initiatedByViewer: false, initiatedBy: { documentId: 'analyst-2', displayName: 'Sam Analyst' } }] });
    expect(screen.getByText('The AI is preparing proposals')).toBeInTheDocument();
    expect(screen.getByText('Started by Sam Analyst.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
    expect(await screen.findByRole('button', { name: 'Check again' })).toBeInTheDocument();
    expect(screen.getByText('Automatic checks stopped after 30 seconds. The AI may still be working.')).toBeInTheDocument();
  });

  it('refreshes on completion and announces the proposals once they are listed, without moving focus', async () => {
    getJob.mockResolvedValue({ ok: true, data: { ...queuedJob, status: 'completed', runId: 'run-9' } });
    const view = { ...empty, jobs: [queuedJob] };
    const { rerender } = render(<AiProposalsPanelClient ownerKey="owner-a" requestId="request-1" timing={fastTiming} view={view} />);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    const ready = { ...view, jobs: [], openCount: 3, runs: [{ ...run, runId: 'run-9', counts: { items: 3, open: 3 } }], items: [addItem('i-1', 'One?'), addItem('i-2', 'Two?'), addItem('i-3', 'Three?')].map((item) => ({ ...item, runId: 'run-9' })) };
    const focused = document.activeElement;
    rerender(<AiProposalsPanelClient ownerKey="owner-a" requestId="request-1" timing={fastTiming} view={ready} />);
    expect(await screen.findByText('3 AI proposals are ready to review.')).toBeInTheDocument();
    expect(document.activeElement).toBe(focused);
  });

  it('says when the AI proposed nothing new', async () => {
    getJob.mockResolvedValue({ ok: true, data: { ...queuedJob, status: 'completed', runId: 'run-9' } });
    const view = { ...empty, jobs: [queuedJob] };
    const { rerender } = render(<AiProposalsPanelClient ownerKey="owner-a" requestId="request-1" timing={fastTiming} view={view} />);
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    rerender(<AiProposalsPanelClient ownerKey="owner-a" requestId="request-1" timing={fastTiming} view={{ ...view, jobs: [], runs: [{ ...run, runId: 'run-9', outcome: 'no-change', counts: { items: 0, open: 0 }, adjustments: [{ code: 'answered-target', count: 1 }, { code: 'invalid-item', count: 1 }] }] }} />);
    expect(await screen.findByText('The AI proposed nothing new for this questionnaire.')).toBeInTheDocument();
    const leftOut = screen.getByRole('button', { name: '2 left out' });
    fireEvent.click(leftOut);
    expect(screen.getByText('A change to an answered question. Answered questions stay as they are.')).toBeVisible();
    expect(document.getElementById(leftOut.getAttribute('aria-controls')!)?.querySelectorAll('li')).toHaveLength(2);
  });

  it('shows a failed job with Q3’s copy and Retry AI proposals, with the start form below it', async () => {
    retryJob.mockResolvedValueOnce({ ok: true, data: queuedJob });
    getJob.mockResolvedValue({ ok: true, data: queuedJob });
    renderClient({ ...empty, jobs: [{ ...queuedJob, status: 'failed', failureCode: 'PROVIDER_OUTPUT_INVALID', failureMessage: 'x', canRetry: true }] });
    const alert = screen.getByRole('alert');
    expect(within(alert).getByText('The AI request didn’t finish')).toBeInTheDocument();
    expect(within(alert).getByText('The AI’s reply couldn’t be read, so nothing was proposed. Try again.')).toBeInTheDocument();
    expect(screen.getByLabelText('Instruction for the AI (optional)')).toBeInTheDocument();
    fireEvent.click(within(alert).getByRole('button', { name: 'Retry AI proposals' }));
    await waitFor(() => expect(retryJob).toHaveBeenCalledWith({ jobId: 'job-9', documentId: 'questionnaire-1' }));
  });

  it('reads a failed job’s CONTEXT_TOO_LARGE by the shared rule: the notes sentence and files, the files alone, or Q1’s sentence', () => {
    const notes = 'The AI context is too large. 2 notes are marked as changing the AI inputs (notes 2 and 5) and 1 file is included in them; unmark or exclude some and try again.';
    const { unmount } = renderClient({ ...empty, jobs: [{ ...contextTooLargeJobFixture, failureMessage: notes, failureAttachments: [{ documentId: 'file-1', fileName: 'Vendor security pack.pdf' }] }] });
    let alert = screen.getByRole('alert');
    expect(within(alert).getByText(notes)).toBeInTheDocument();
    expect(within(alert).getByRole('link', { name: 'Vendor security pack.pdf' })).toHaveAttribute('href', '/app/review/requests/request-1#file-file-1');
    expect(alert).not.toHaveTextContent('The files included in the AI inputs hold more text than CSRM can send at once');
    unmount();
    const files = renderClient({ ...empty, jobs: [contextTooLargeJobFixture] });
    alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('The files included in the AI inputs hold more text than CSRM can send at once, so nothing was sent. Exclude a file, then try again.');
    files.unmount();
    renderClient({ ...empty, jobs: [{ ...contextTooLargeJobFixture, failureMessage: 'The request is too large for this operation.', failureAttachments: [] }] });
    expect(screen.getByRole('alert')).toHaveTextContent('This questionnaire and its request hold more than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.');
  });
});

describe('the panel by questionnaire state (§2.4, §2.5, §7.2, §12)', () => {
  it('lands on the stable panel status after the successful return dialog closes (D3)', async () => {
    returnToReview.mockResolvedValueOnce({ ok: true });
    renderClient({ ...empty, state: 'submitted' });
    fireEvent.click(screen.getByRole('button', { name: 'Return to analyst review' }));
    const dialog = screen.getByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText('Reason'), { target: { value: 'Review proposals' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Return to analyst review' }));
    await waitFor(() => expect(screen.queryByRole('alertdialog')).toBeNull());
    await waitFor(() => expect(document.querySelector('[data-ai-proposals-status]')).toHaveFocus());
  });
  it('while the Requestor is answering: the Clock line with Return to analyst review, Reject only, no staleness and no answered list', () => {
    renderClient({ ...oneAdd, state: 'awaiting-submission', fixedQuestions: null, items: oneAdd.items.map((item) => ({ ...item, stale: null })), actions: { ...oneAdd.actions, start: { allowed: false, reason: 'QUESTIONNAIRE_NOT_SUBMITTED' }, confirm: { allowed: false, reason: 'QUESTIONNAIRE_RELEASED' } } });
    expect(screen.getByText('The Requestor is answering this questionnaire. You can ask the AI once they submit it, or after you return it to analyst review.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Return to analyst review' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reject: Who supports the system offshore?' })).toBeInTheDocument();
    expect(screen.queryByText('Changed since proposed')).toBeNull();
    expect(screen.queryByText(/answered questions? stay/)).toBeNull();
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
  });

  it('on a submitted questionnaire: the Lock line once, the start form and Reject only', () => {
    renderClient({ ...oneAdd, state: 'submitted', actions: { ...oneAdd.actions, confirm: { allowed: false, reason: 'QUESTIONNAIRE_RELEASED' } } });
    expect(screen.getAllByText('To confirm proposals, return the questionnaire to analyst review. You can ask the AI and reject proposals now.')).toHaveLength(1);
    expect(screen.getByLabelText('Instruction for the AI (optional)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^Confirm/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Reject: Who supports the system offshore?' })).toBeInTheDocument();
  });

  it('once a draft started: its line and no actions', () => {
    renderClient({ ...oneAdd, state: 'draft-in-progress', actions: { ...oneAdd.actions, start: { allowed: false, reason: 'ASSESSMENT_DRAFT_IN_PROGRESS' } } });
    expect(screen.getByText('An assessment draft is being generated, so this questionnaire can’t change.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^(Confirm|Reject|Edit)/ })).toBeNull();
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
  });

  it('shows the first-use and cleared empty states, and the answered list only when there are answered questions', () => {
    const { unmount } = renderClient(empty);
    expect(screen.getByText('No AI proposals yet')).toBeInTheDocument();
    expect(screen.getByText('Ask the AI for follow-up questions, or give it an instruction such as “Add questions about the offshore support team”.')).toBeInTheDocument();
    expect(screen.queryByText(/answered questions? stay/)).toBeNull();
    unmount();
    const decided = { ...(base.items[1] as QuestionnaireAiItemView) };
    renderClient({ ...empty, runs: base.runs, items: [decided], fixedQuestions: [{ questionId: 'q-1', questionText: 'Who owns the system?' }, { questionId: 'q-2', questionText: 'Where is it hosted?' }] });
    expect(screen.getByText('No open AI proposals', { selector: 'p:not([data-ai-proposals-status])' })).toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: '2 answered questions stay as they are' });
    fireEvent.click(toggle);
    expect(screen.getByText('Where is it hosted?')).toBeInTheDocument();
  });

  it('for the requesting analyst, the heading and one line, and nothing else', () => {
    render(<AiProposalsPanel outcome={{ kind: 'requesting-analyst' }} ownerKey="owner-a" requestId="request-1" />);
    expect(screen.getByRole('heading', { level: 2, name: 'AI proposals' })).toBeInTheDocument();
    expect(screen.getByText('You raised this request, so another Security Analyst handles the AI for it.')).toBeInTheDocument();
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('textbox')).toBeNull();
  });

  it('shows the compact error with Try again when the proposals read failed', () => {
    render(<AiProposalsPanel outcome={{ kind: 'error' }} ownerKey="owner-a" requestId="request-1" />);
    expect(screen.getByText('We couldn’t load the AI proposals')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(refresh).toHaveBeenCalled();
  });
});
