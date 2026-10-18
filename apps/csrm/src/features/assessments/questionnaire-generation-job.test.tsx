import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuestionnaireGenerationJob as QuestionnaireGenerationJobRecord } from './assessment-schema';

const actionMocks = vi.hoisted(() => ({
  getQuestionnaireGenerationJobAction: vi.fn(),
  getRequestGenerationJobsAction: vi.fn(),
  retryQuestionnaireGenerationJobAction: vi.fn(),
  startQuestionnaireGenerationAction: vi.fn(),
}));

vi.mock('./assessment-actions', () => actionMocks);
const aiActionMocks = vi.hoisted(() => ({ getQuestionnaireProposalJobAction: vi.fn(), retryQuestionnaireProposalJobAction: vi.fn(), startQuestionnaireAiProposalsAction: vi.fn() }));
vi.mock('../questionnaire-ai/questionnaire-ai-actions', () => aiActionMocks);
const routerRefresh = vi.hoisted(() => vi.fn());
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: routerRefresh }) }));

import type { QuestionnaireAiProposalsView } from '../questionnaire-ai/questionnaire-ai-domain';
import { QuestionnaireGenerationJob } from './questionnaire-generation-job';

const queuedJob: QuestionnaireGenerationJobRecord = {
  jobId: 'job-one',
  requestId: 'request-one',
  providerName: 'Context provider',
  providerVersion: '1.0',
  attempt: 1,
  queuedAt: '2026-09-03T00:00:00.000Z',
  status: 'queued',
  // D-18: the viewer's own job unless a case says otherwise.
  canRetry: false,
  initiatedBy: { documentId: 'analyst-id', displayName: 'Alex Analyst' },
  initiatedByViewer: true,
};

const completedJob: QuestionnaireGenerationJobRecord = {
  ...queuedJob,
  status: 'completed',
  startedAt: '2026-09-03T00:00:01.000Z',
  completedAt: '2026-09-03T00:00:02.000Z',
  questionnaire: {
    documentId: 'questionnaire-one',
    questionnaireNumber: 'QNR-2026-KX2AHV',
    title: 'Generated questionnaire',
    generatedDate: '2026-09-03T00:00:02.000Z',
    generatedBy: { documentId: 'bob-id', displayName: 'Bob Doe' },
  },
};

const failedJob: QuestionnaireGenerationJobRecord = {
  ...queuedJob,
  status: 'failed',
  startedAt: '2026-09-03T00:00:01.000Z',
  completedAt: '2026-09-03T00:00:02.000Z',
  failureCode: 'provider-failed',
  failureMessage: 'The provider could not prepare a questionnaire.',
  canRetry: true,
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolver) => { resolve = resolver; });
  return { promise, resolve };
}

describe('QuestionnaireGenerationJob lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('keeps one status request in flight and stops polling after unmount', async () => {
    const poll = deferred<{ ok: true; data: QuestionnaireGenerationJobRecord }>();
    actionMocks.getQuestionnaireGenerationJobAction.mockReturnValue(poll.promise);
    const { unmount } = render(<QuestionnaireGenerationJob action="generate" seededJob={{ job: queuedJob, canRetry: true }} requestId="request-one" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(1);

    unmount();
    await act(async () => { poll.resolve({ ok: true, data: queuedJob }); await poll.promise; });
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(1);
  });

  it('stops polling once a terminal status is returned', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: completedJob });
    render(<QuestionnaireGenerationJob action="generate" seededJob={{ job: queuedJob, canRetry: true }} requestId="request-one" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('link', { name: 'Review generated questionnaire' })).toHaveAttribute('href', '/app/review/questionnaires/questionnaire-one');
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(1);
  });

  it('stops at the timeout and lets the recovery control begin a fresh check', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    render(
      <QuestionnaireGenerationJob
        action="generate"
        seededJob={{ job: queuedJob, canRetry: true }}
        requestId="request-one"
        timing={{ pollIntervalMs: 1_000, timeoutMs: 1_000, now: () => Date.now(), setTimeout, clearTimeout }}
      />,
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByText('Taking longer than expected')).toBeInTheDocument();
    // UI-SPEC §12.1: the timed-out body no longer names the server-owned job.
    expect(screen.getByText('Automatic checks stopped after 30 seconds. Generation may still be running.')).toBeInTheDocument();
    const countAtTimeout = actionMocks.getQuestionnaireGenerationJobAction.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(countAtTimeout);

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(countAtTimeout + 1);
  });

  it('cancels the replaced job schedule before polling the replacement', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    const { rerender } = render(<QuestionnaireGenerationJob action="generate" seededJob={{ job: queuedJob, canRetry: true }} requestId="request-one" />);
    const replacement = { ...queuedJob, jobId: 'job-two', requestId: 'request-two', attempt: 2 };

    rerender(<QuestionnaireGenerationJob action="generate" seededJob={{ job: replacement, canRetry: true }} requestId="request-two" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(1);
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledWith({ jobId: 'job-two' });
  });

  /* WR-202: a tick that finds a status check in flight is never dropped for good. */
  it('keeps polling the new job when a refreshed seed arrives while a slow status check is in flight', async () => {
    const slow = deferred<{ ok: true; data: QuestionnaireGenerationJobRecord }>();
    const replacement = { ...queuedJob, jobId: 'job-two', attempt: 2 };
    actionMocks.getQuestionnaireGenerationJobAction.mockReturnValueOnce(slow.promise).mockResolvedValue({ ok: true, data: replacement });
    const { rerender } = render(<QuestionnaireGenerationJob action="generate" seededJob={{ job: queuedJob, canRetry: true }} requestId="request-one" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    rerender(<QuestionnaireGenerationJob action="generate" seededJob={{ job: replacement, canRetry: true }} requestId="request-one" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_500); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(1);

    await act(async () => { slow.resolve({ ok: true, data: queuedJob }); await slow.promise; });
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(2);
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenLastCalledWith({ jobId: 'job-two' });
  });

  it('does not let an obsolete status response replace a newer authoritative job', async () => {
    const poll = deferred<{ ok: true; data: QuestionnaireGenerationJobRecord }>();
    actionMocks.getQuestionnaireGenerationJobAction.mockReturnValue(poll.promise);
    const { rerender } = render(<QuestionnaireGenerationJob action="generate" seededJob={{ job: queuedJob, canRetry: true }} requestId="request-one" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    const replacement = { ...queuedJob, jobId: 'job-two', requestId: 'request-two', attempt: 2 };
    rerender(<QuestionnaireGenerationJob action="generate" seededJob={{ job: replacement, canRetry: true }} requestId="request-two" />);

    await act(async () => { poll.resolve({ ok: true, data: completedJob }); await poll.promise; });
    expect(screen.getAllByText('Questionnaire generation is queued')).not.toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'Review generated questionnaire' })).not.toBeInTheDocument();
  });

  it('offers a usable retry after failure', async () => {
    actionMocks.retryQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    render(<QuestionnaireGenerationJob action="generate" seededJob={{ job: failedJob, canRetry: true }} requestId="request-one" />);

    const retry = screen.getByRole('button', { name: 'Retry questionnaire generation' });
    expect(retry).toBeEnabled();
    fireEvent.click(retry);
    // The handler awaits the retry action before setting state, so the queued
    // status only appears once that promise chain settles. runAllTicks does not
    // flush it under fake timers; advancing by zero does.
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(actionMocks.retryQuestionnaireGenerationJobAction).toHaveBeenCalledWith({ jobId: 'job-one' });
    // The status appears twice by design: once in the panel and once in the
    // polite live region that announces the change.
    expect(screen.getByRole('status')).toHaveTextContent('Questionnaire generation is queued');
    expect(screen.getAllByText('Questionnaire generation is queued').length).toBeGreaterThan(1);
  });

  it('sends replacement acknowledgement only after the explicit confirmation', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: true, data: queuedJob });
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} seededJob={undefined} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    expect(actionMocks.startQuestionnaireGenerationAction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledOnce();
    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledWith({
      requestId: 'request-one',
      replaceUnansweredQuestionnaire: true,
    });
  });
});

/*
 * UAT-019 (D-08, UI-SPEC §3.2): before an analyst confirms a replacement, the dialog says how many analyst
 * changes to the questions it discards, that Requestor answers are never replaced, and what happens next.
 * The count is the served `analystChangesSinceGeneration`; when the read served none, the dialog says so
 * without guessing.
 */
const replacementDescription = 'This generates a new questionnaire from the request and replaces this one. No analyst has changed its questions and the Requestor hasn’t answered it, so nothing is lost. The new questionnaire stays in analyst review until you release it.';

describe('replacing a questionnaire in analyst review', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('describes a questionnaire generated from the request for Security Analyst review', () => {
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" />);

    expect(screen.getByText('Generate a questionnaire from this request for Security Analyst review.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
  });

  it('offers Replace questionnaire as an outline action instead of Generate questionnaire', () => {
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} requestId="request-one" />);

    expect(screen.getByRole('button', { name: 'Replace questionnaire' })).toHaveAttribute('data-variant', 'outline');
    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
    expect(screen.getByText('Generate a questionnaire from this request for Security Analyst review.')).toBeInTheDocument();
  });

  /* Phase 15 (15-UI-SPEC §8.3; D-09, UI-D21; U3): one description, since a replacement is offered only when nothing is lost. */
  it('states that nothing is lost, the only description a replacement now has, followed by the instruction field', () => {
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
    expect(dialog).toHaveAccessibleDescription(replacementDescription);
    expect(within(dialog).getByLabelText('Instruction for the AI (optional)')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Replace questionnaire' })).toHaveAttribute('data-variant', 'destructive');
    expect(within(dialog).getByRole('button', { name: 'Keep this questionnaire' })).toBeInTheDocument();
    expect(actionMocks.startQuestionnaireGenerationAction).not.toHaveBeenCalled();
  });

  it('keeps the questionnaire when the analyst dismisses the confirmation', async () => {
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep this questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(actionMocks.startQuestionnaireGenerationAction).not.toHaveBeenCalled();
  });

  it('shows Replacing questionnaire… while the confirmed replacement starts', async () => {
    const started = deferred<{ ok: true; data: QuestionnaireGenerationJobRecord }>();
    actionMocks.startQuestionnaireGenerationAction.mockReturnValue(started.promise);
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replace questionnaire' }));

    expect(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replacing questionnaire…' })).toBeDisabled();
    await act(async () => { started.resolve({ ok: true, data: queuedJob }); await vi.advanceTimersByTimeAsync(0); });
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Questionnaire generation is queued');
  });

  it('keeps the confirmation open with the refusal when Strapi refuses the replacement', async () => {
    const refusal = 'This questionnaire has been released to the Requestor, so it can’t be replaced. Return it to analyst review first.';
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: false, formError: refusal, reason: 'QUESTIONNAIRE_RELEASED' });
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replace questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const dialog = screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
    expect(within(dialog).getByRole('alert')).toHaveTextContent(refusal);
    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledOnce();
  });
});

/*
 * D-09 (UI-SPEC §3.3): a released questionnaire cannot be replaced, so the card offers nothing and says how
 * to get there, linking the questionnaire to return to analyst review.
 */
const releasedHint = 'This questionnaire has been released to the Requestor. To replace it, return QNR-2026-KX2AHV to analyst review first.';

/* IN-201: a questionnaire that exists but is not served as released gets a neutral line, never the released hint. */
/*
 * Phase 13 D-29 (13-UI-SPEC §10.2): the hub page renders the questionnaire's AI-inputs signal on the server and hands it
 * to this card as a slot, which the card sets above its idle action or its state line. The signal offers no action.
 */
describe('the AI-inputs signal on the questionnaire card', () => {
  const allowedPolicy = { status: 'allowed', reason: null, requestClassification: 'Internal', classificationSource: 'default', ceiling: null } as const;
  const slot = <p data-testid="ai-inputs-slot">AI inputs changed since this questionnaire was generated</p>;

  it('sets the slot above the idle action', () => {
    render(<QuestionnaireGenerationJob action="replace" aiInputsChanged={slot} aiPolicy={allowedPolicy} analystChangesSinceGeneration={0} requestId="request-one" />);
    const replace = screen.getByRole('button', { name: 'Replace questionnaire' });
    expect(screen.getByTestId('ai-inputs-slot').compareDocumentPosition(replace) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('sets the slot above the state line of a job on the card', () => {
    render(<QuestionnaireGenerationJob action="replace" aiInputsChanged={slot} aiPolicy={allowedPolicy} requestId="request-one" seededJob={{ job: failedJob, canRetry: true }} />);
    const state = screen.getByText('Questionnaire generation failed', { selector: '[data-slot="alert-title"]' });
    expect(screen.getByTestId('ai-inputs-slot').compareDocumentPosition(state) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('shows nothing of the signal without a slot', () => {
    render(<QuestionnaireGenerationJob action="replace" aiPolicy={allowedPolicy} requestId="request-one" />);
    expect(screen.queryByText(/AI inputs changed/)).not.toBeInTheDocument();
  });
});

describe('a questionnaire that exists but is not served as released', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers no action and says only that a questionnaire exists', () => {
    render(<QuestionnaireGenerationJob action="exists" questionnaireHref="/app/review/questionnaires/questionnaire-one" questionnaireNumber="QNR-2026-KX2AHV" requestId="request-one" />);

    expect(screen.getByText('A questionnaire already exists for this request.')).toHaveClass('text-sm', 'text-foreground-secondary');
    expect(screen.queryByText(/released to the Requestor/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers no replacement after a not-acknowledged failure', () => {
    const notAcknowledged = { ...failedJob, failureCode: 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED', failureMessage: 'Replacement was not acknowledged.' };
    render(<QuestionnaireGenerationJob action="exists" requestId="request-one" seededJob={{ job: notAcknowledged, canRetry: true }} />);

    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    expect(screen.getByText('A questionnaire already exists for this request.')).toBeInTheDocument();
  });
});

describe('a questionnaire released to the Requestor', () => {
  beforeEach(() => vi.clearAllMocks());

  it('offers no action and says to return the questionnaire to analyst review first', () => {
    render(<QuestionnaireGenerationJob action="released" questionnaireHref="/app/review/questionnaires/questionnaire-one" questionnaireNumber="QNR-2026-KX2AHV" requestId="request-one" />);

    expect(screen.getByText((_content, element) => element?.tagName === 'P' && element.textContent === releasedHint)).toHaveClass('text-sm', 'text-foreground-secondary');
    expect(screen.getByRole('link', { name: 'QNR-2026-KX2AHV' })).toHaveAttribute('href', '/app/review/questionnaires/questionnaire-one');
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('offers no replacement after a not-acknowledged failure once the questionnaire is released', () => {
    const notAcknowledged = { ...failedJob, failureCode: 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED' };
    render(<QuestionnaireGenerationJob action="released" seededJob={{ job: notAcknowledged, canRetry: true }} questionnaireHref="/app/review/questionnaires/questionnaire-one" questionnaireNumber="QNR-2026-KX2AHV" requestId="request-one" />);

    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    expect(screen.getByText((_content, element) => element?.tagName === 'P' && element.textContent === releasedHint)).toBeInTheDocument();
  });
});

/*
 * UI-SPEC §12.4: a failed job's code reads as a sentence about the request, and any other code shows the
 * server's message unchanged. A missing acknowledgement can only be fixed by replacing, so that failure
 * offers the §3.2 confirmation instead of a retry that would fail the same way.
 */
describe('a failed questionnaire generation job', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ['REQUEST_NOT_ELIGIBLE', 'The request is no longer submitted, so a questionnaire can’t be generated for it.'],
    ['QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED', 'A questionnaire already exists for this request. Replace it to generate a new one.'],
    ['QUESTIONNAIRE_ANSWERED', 'The Requestor has started answering this questionnaire, so it can’t be replaced.'],
    ['QUESTIONNAIRE_RELEASED', 'The questionnaire was released before generation finished, so it wasn’t replaced. Return it to analyst review to replace it.'],
    // WR-102: a replacement the governance log refuses names the history, as every governance refusal does (UI-SPEC G).
    ['HISTORY_UNAVAILABLE', 'This questionnaire’s change history can’t record more changes. Contact your administrator.'],
    ['provider-failed', 'The provider could not prepare a questionnaire.'],
  ])('words a %s failure for the analyst', (failureCode, copy) => {
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} seededJob={{ job: { ...failedJob, failureCode }, canRetry: true }} requestId="request-one" />);

    // One alert: the failure. The polite live region repeats the title, so the title alone is not unique.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Questionnaire generation failed');
    expect(alert).toHaveTextContent(copy);
    if (failureCode !== 'provider-failed') expect(alert).not.toHaveTextContent('The provider could not prepare a questionnaire.');
  });

  it('offers Replace questionnaire through the confirmation when the replacement was not acknowledged', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: true, data: queuedJob });
    const notAcknowledged = { ...failedJob, failureCode: 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED' };
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} seededJob={{ job: notAcknowledged, canRetry: true }} requestId="request-one" />);

    expect(screen.queryByRole('button', { name: 'Retry questionnaire generation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace and generate again' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
    expect(dialog).toHaveAccessibleDescription(replacementDescription);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledOnce();
    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledWith({ requestId: 'request-one', replaceUnansweredQuestionnaire: true });
  });
});

/*
 * UAT-041 (D-26, UI-SPEC §12.1, Phase 13 §13): an analyst who leaves the request while a job runs and comes back
 * sees the job's status in place of Generate or Replace. The page seeds the card from the request's jobs read; a
 * job the viewer started (initiatedByViewer) is polled by id, and a job a colleague started is polled by request
 * and says who started it. The route is keyed on initiatedByViewer, never on canRetry.
 */
const runningJob: QuestionnaireGenerationJobRecord = { ...queuedJob, status: 'running', startedAt: '2026-09-03T00:00:01.000Z' };
const leaveAndReturn = 'You can leave this page. The status shows here when you come back.';
const bob = { documentId: 'bob-id', displayName: 'Bob Doe' };
const startedByBob = 'Started by Bob Doe.';
/* The two Phase 10 sentences Phase 13 retires (UI-SPEC §13); no state renders either. */
const retiredCopy = ['Started by another Security Analyst.', 'Only the Security Analyst who started it can retry it.'];
function expectNoRetiredCopy() {
  for (const sentence of retiredCopy) expect(document.body.textContent).not.toContain(sentence);
}

describe('a questionnaire generation job seeded when the analyst comes back', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ['queued', queuedJob, 'Questionnaire generation is queued'],
    ['running', runningJob, 'Questionnaire generation is running'],
  ] as const)('shows a %s job the viewer started in place of Generate and Replace, with no Started by line, polled by id', async (_status, job, title) => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: job });
    // An active job is never retryable (canRetry false), yet the viewer started it, so it is followed by id.
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} requestId="request-one" seededJob={{ job, canRetry: false }} />);

    expect(screen.getByText(title, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(leaveAndReturn)).toBeInTheDocument();
    expect(screen.queryByText(/^Started by/)).not.toBeInTheDocument();
    expectNoRetiredCopy();
    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/server-owned/i);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledWith({ jobId: 'job-one' });
    expect(actionMocks.getRequestGenerationJobsAction).not.toHaveBeenCalled();
  });

  it.each([
    ['queued', queuedJob, 'Questionnaire generation is queued'],
    ['running', runningJob, 'Questionnaire generation is running'],
  ] as const)('shows a %s job a colleague started with Started by {name}, and polls it by request, never by id', async (_status, job, title) => {
    actionMocks.getRequestGenerationJobsAction.mockResolvedValue({ ok: true, data: { questionnaireGeneration: { job: completedJob, canRetry: false }, assessmentDraft: null } });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: { ...job, initiatedBy: bob, initiatedByViewer: false }, canRetry: false }} />);

    expect(screen.getByText(title, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(leaveAndReturn)).toBeInTheDocument();
    expect(screen.getByText(startedByBob)).toBeInTheDocument();
    expectNoRetiredCopy();
    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getRequestGenerationJobsAction).toHaveBeenCalledWith({ requestId: 'request-one' });
    expect(actionMocks.getQuestionnaireGenerationJobAction).not.toHaveBeenCalled();
    expect(screen.getByRole('link', { name: 'Review generated questionnaire' })).toHaveAttribute('href', '/app/review/questionnaires/questionnaire-one');
  });

  it('does not reset the card when the page hands it a new but equal seeded job', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: completedJob });
    const { rerender } = render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: runningJob, canRetry: true }} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('link', { name: 'Review generated questionnaire' })).toBeInTheDocument();

    rerender(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: { ...runningJob }, canRetry: true }} />);
    expect(screen.getByRole('link', { name: 'Review generated questionnaire' })).toBeInTheDocument();
    expect(screen.queryByText('Questionnaire generation is running', { selector: 'p' })).not.toBeInTheDocument();
  });

  it('shows the idle action when nothing is seeded', () => {
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" />);

    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeInTheDocument();
    expect(screen.queryByText(leaveAndReturn)).not.toBeInTheDocument();
  });
});

/*
 * Phase 13 §13 (D-18; U4 changed deliberately): a failed job offers its retry to every analyst on the request, and
 * a colleague's failed job says who started it. canRetry ("the job failed and this viewer may retry it") alone
 * decides the retry; a failed job the viewer may not retry offers a new start. After the viewer's own retry the
 * card shows no Started by line. When the jobs read failed, the idle action says what starting does. The card
 * reports its job's status so the hub can say generation is in progress.
 */
const colleagueFailedJob: QuestionnaireGenerationJobRecord = { ...failedJob, initiatedBy: bob, initiatedByViewer: false };
const readFailed = 'We couldn’t check whether a generation is already running. If one is, starting generation shows its progress instead of starting another.';

describe('retry rights, a failed jobs read and the reported status', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ['generate', 'Generate questionnaire'],
    ['replace', 'Replace questionnaire'],
  ] as const)('shows a colleague’s failed job with Started by {name} and offers Retry questionnaire generation, not %s', (action, label) => {
    render(<QuestionnaireGenerationJob action={action} analystChangesSinceGeneration={0} requestId="request-one" seededJob={{ job: colleagueFailedJob, canRetry: true }} />);

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Questionnaire generation failed');
    expect(alert).toHaveTextContent('The provider could not prepare a questionnaire.');
    expect(alert).toHaveTextContent(startedByBob);
    expect(screen.getByRole('button', { name: 'Retry questionnaire generation' })).toBeEnabled();
    expect(screen.queryByRole('button', { name: label })).not.toBeInTheDocument();
    expectNoRetiredCopy();
  });

  it('retries a colleague’s failed job, after which the card shows the attempt as the viewer’s own', async () => {
    actionMocks.retryQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: { ...queuedJob, attempt: 2, initiatedBy: { documentId: 'analyst-id', displayName: 'Alex Analyst' }, initiatedByViewer: true } });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: colleagueFailedJob, canRetry: true }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry questionnaire generation' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(actionMocks.retryQuestionnaireGenerationJobAction).toHaveBeenCalledWith({ jobId: 'job-one' });
    expect(screen.getByText('Attempt 2')).toBeInTheDocument();
    expect(screen.queryByText(/^Started by/)).not.toBeInTheDocument();
    expectNoRetiredCopy();
  });

  it('offers a new start, and no retry, for a failed job the viewer may not retry', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: true, data: { ...queuedJob, jobId: 'job-two' } });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: { ...colleagueFailedJob, canRetry: false }, canRetry: false }} />);

    expect(screen.queryByRole('button', { name: 'Retry questionnaire generation' })).not.toBeInTheDocument();
    expectNoRetiredCopy();

    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledWith({ requestId: 'request-one', replaceUnansweredQuestionnaire: false });
    expect(actionMocks.retryQuestionnaireGenerationJobAction).not.toHaveBeenCalled();
    expect(screen.getByText('Questionnaire generation is queued', { selector: 'p' })).toBeInTheDocument();
  });

  it('offers the initiator Retry questionnaire generation with no Started by line', () => {
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: failedJob, canRetry: true }} />);

    expect(screen.getByRole('button', { name: 'Retry questionnaire generation' })).toBeEnabled();
    expect(screen.queryByText(/^Started by/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
    expectNoRetiredCopy();
  });

  /* D-18: the by-id poll takes canRetry from the served job, never assuming the viewer may retry it. */
  it('shows no retry when the by-id poll serves a failed job the viewer may not retry', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: { ...failedJob, canRetry: false } });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: runningJob, canRetry: false }} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledWith({ jobId: 'job-one' });
    expect(screen.getByRole('alert')).toHaveTextContent('Questionnaire generation failed');
    expect(screen.queryByRole('button', { name: 'Retry questionnaire generation' })).not.toBeInTheDocument();
  });

  it.each([
    ['generate', 'Generate questionnaire'],
    ['replace', 'Replace questionnaire'],
  ] as const)('says what starting does above %s when the jobs read failed', (action, label) => {
    render(<QuestionnaireGenerationJob action={action} analystChangesSinceGeneration={0} jobsReadFailed requestId="request-one" />);

    const line = screen.getByText(readFailed);
    expect(line).toHaveClass('text-sm', 'text-foreground-secondary');
    expect(line.compareDocumentPosition(screen.getByRole('button', { name: label })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it('does not show the failed-read line while a job is shown', () => {
    render(<QuestionnaireGenerationJob action="generate" jobsReadFailed requestId="request-one" seededJob={{ job: queuedJob, canRetry: true }} />);

    expect(screen.queryByText(readFailed)).not.toBeInTheDocument();
  });

  it('titles a refused start as a start that could not begin, not as a failed status check', async () => {
    const refusal = 'A questionnaire can be generated only while the request is submitted, and this request has moved on.';
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: false, formError: refusal, reason: 'REQUEST_NOT_ELIGIBLE' });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Questionnaire generation couldn’t start');
    expect(alert).toHaveTextContent(refusal);
    expect(alert).not.toHaveTextContent('Status unavailable');
  });

  /* WR-203: a Server Action that throws (a network failure, a stale deployment) never leaves the card pending. */
  it('restores Generate questionnaire with a visible error when the start action throws, and lets the analyst start again', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockRejectedValueOnce(new Error('network')).mockResolvedValueOnce({ ok: true, data: queuedJob });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Questionnaire generation couldn’t start');
    expect(alert).toHaveTextContent('The questionnaire generation service is unavailable. Please try again later.');
    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeEnabled();

    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledTimes(2);
    expect(screen.getAllByText('Questionnaire generation is queued')).not.toHaveLength(0);
  });

  it('shows the error inside the replacement confirmation when the replacement action throws', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockRejectedValueOnce(new Error('network'));
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    fireEvent.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Replace questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(within(screen.getByRole('alertdialog')).getByText('The questionnaire generation service is unavailable. Please try again later.')).toBeInTheDocument();
  });

  it('restores Retry questionnaire generation with a visible error when the retry action throws', async () => {
    actionMocks.retryQuestionnaireGenerationJobAction.mockRejectedValueOnce(new Error('network'));
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: failedJob, canRetry: true }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry questionnaire generation' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getAllByRole('alert').at(-1)).toHaveTextContent('The questionnaire generation service is unavailable. Please try again later.');
    expect(screen.getByRole('button', { name: 'Retry questionnaire generation' })).toBeEnabled();
  });

  it('reads a status check whose action throws as Status unavailable, and keeps checking', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockRejectedValueOnce(new Error('network')).mockResolvedValue({ ok: true, data: completedJob });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: queuedJob, canRetry: true }} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Status unavailable');
    expect(screen.getByRole('alert')).toHaveTextContent('The questionnaire generation service is unavailable. Please try again later.');

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('link', { name: 'Review generated questionnaire' })).toBeInTheDocument();
  });

  it('keeps Status unavailable for a status check that failed', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: false, formError: 'The assessment service is unavailable.' });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: queuedJob, canRetry: true }} />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByRole('alert')).toHaveTextContent('Status unavailable');
  });

  it('reports the job status as it changes, and no job when nothing is seeded', async () => {
    const onJobStatusChange = vi.fn();
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: completedJob });
    const { unmount } = render(<QuestionnaireGenerationJob action="generate" onJobStatusChange={onJobStatusChange} requestId="request-one" seededJob={{ job: runningJob, canRetry: true }} />);

    expect(onJobStatusChange).toHaveBeenLastCalledWith('running');
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(onJobStatusChange).toHaveBeenLastCalledWith('completed');
    unmount();

    const idle = vi.fn();
    render(<QuestionnaireGenerationJob action="generate" onJobStatusChange={idle} requestId="request-one" />);
    expect(idle).toHaveBeenLastCalledWith(null);
  });
});

/* 12-UI-SPEC §11.1 and §11.2, D-29: the served AI data policy gates the idle action. */
describe('questionnaire generation under the AI data policy', () => {
  const restricted = { status: 'allowed', reason: null, requestClassification: 'Restricted', classificationSource: 'assets', ceiling: null } as const;
  const aboveCeiling = { status: 'refused', reason: 'AI_CLASSIFICATION_ABOVE_CEILING', requestClassification: 'Restricted', classificationSource: 'assets', ceiling: 'Public' } as const;
  const notConfigured = { status: 'refused', reason: 'AI_POLICY_NOT_CONFIGURED', requestClassification: 'Internal', classificationSource: 'default', ceiling: null } as const;
  const aboveCeilingText = 'This request’s information is classified Restricted, above the Public limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.';
  const notConfiguredText = 'The AI provider hasn’t been approved for any information classification yet, so nothing can be sent to it. Contact your administrator.';

  beforeEach(() => vi.clearAllMocks());

  it('captions an allowed action with the request’s classification', () => {
    const { rerender } = render(<QuestionnaireGenerationJob action="generate" aiPolicy={restricted} requestId="request-one" />);
    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeEnabled();
    expect(screen.getByText('This request’s information is classified Restricted.')).toBeInTheDocument();
    rerender(<QuestionnaireGenerationJob action="generate" aiPolicy={{ ...restricted, requestClassification: 'Internal', classificationSource: 'default' }} requestId="request-one" />);
    expect(screen.getByText('This request’s information is classified Internal. No information asset on it is classified, so Internal applies.')).toBeInTheDocument();
  });

  it.each([
    ['generate', aboveCeiling, aboveCeilingText],
    ['replace', aboveCeiling, aboveCeilingText],
    ['generate', notConfigured, notConfiguredText],
  ] as const)('replaces %s with the refusal alert (%#)', (action, policy, description) => {
    render(<QuestionnaireGenerationJob action={action} aiPolicy={policy} analystChangesSinceGeneration={0} requestId="request-one" />);
    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    const alert = screen.getByRole('note');
    expect(within(alert).getByText('AI generation isn’t available for this request')).toBeInTheDocument();
    expect(within(alert).getByText(description)).toBeInTheDocument();
    expect(alert).toHaveTextContent('Contact your administrator.');
    expect(alert.querySelector('svg.lucide-shield-ban')).not.toBeNull();
    expect(alert).not.toHaveTextContent(/manual|another way|instead/i);
  });

  it('keeps the action as Phase 10 has it when the jobs read served no policy', () => {
    render(<QuestionnaireGenerationJob action="generate" jobsReadFailed requestId="request-one" />);
    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeEnabled();
    expect(screen.queryByText(/is classified/)).not.toBeInTheDocument();
  });

  it.each([
    ['AI_CLASSIFICATION_ABOVE_CEILING', 'This request’s information is now classified above the limit the AI provider is approved for, so nothing was sent to the AI. Contact your administrator.'],
    ['AI_POLICY_NOT_CONFIGURED', 'The AI provider isn’t approved for any information classification yet, so nothing was sent to the AI. Contact your administrator.'],
    ['CONTEXT_TOO_LARGE', 'This request holds more information than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.'],
  ])('reads the %s failure in plain words', (failureCode, sentence) => {
    render(<QuestionnaireGenerationJob action="generate" aiPolicy={restricted} requestId="request-one" seededJob={{ job: { ...failedJob, failureCode }, canRetry: true }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(sentence);
    expect(screen.queryByText(failedJob.failureMessage)).not.toBeInTheDocument();
  });
});

/*
 * WR-408, IN-303, WR-308 (12-UI-SPEC §11.1, §11.3; D-28, D-29; G-20). A generation the AI data policy refuses at
 * enqueue reads §11.1's description, naming the request's classification, the approved limit and whom to contact.
 * The served policy names them only when it is that same refusal; one that allowed generation is out of date, so
 * the card reads the policy again. Retry and the failed state's Replace are generations too, so the served policy
 * gates them as it gates Generate.
 */
describe('questionnaire generation the AI data policy refuses', () => {
  const stale = { status: 'allowed', reason: null, requestClassification: 'Restricted', classificationSource: 'assets', ceiling: null } as const;
  const aboveCeiling = { status: 'refused', reason: 'AI_CLASSIFICATION_ABOVE_CEILING', requestClassification: 'Restricted', classificationSource: 'assets', ceiling: 'Public' } as const;
  const fixedAboveCeiling = 'This request’s information is classified above the limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.';
  const namedAboveCeiling = 'This request’s information is classified Restricted, above the Public limit the AI provider is approved for, so it can’t be sent to the AI. Contact your administrator.';
  const notConfigured = 'The AI provider hasn’t been approved for any information classification yet, so nothing can be sent to it. Contact your administrator.';
  const refusedByPolicy = (reason: string, formError: string) => ({ ok: false, formError, reason });

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it('names the classification and the approved limit when a start is refused, reading the policy the served one no longer matches', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue(refusedByPolicy('AI_CLASSIFICATION_ABOVE_CEILING', fixedAboveCeiling));
    actionMocks.getRequestGenerationJobsAction.mockResolvedValue({ ok: true, data: { questionnaireGeneration: null, assessmentDraft: null, aiPolicy: aboveCeiling } });
    render(<QuestionnaireGenerationJob action="generate" aiPolicy={stale} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Questionnaire generation couldn’t start');
    expect(alert).toHaveTextContent(namedAboveCeiling);
    expect(alert).not.toHaveTextContent(/now classified|nothing was sent/);
    expect(actionMocks.getRequestGenerationJobsAction).toHaveBeenCalledWith({ requestId: 'request-one' });
  });

  it('keeps §11.1’s fixed sentence when the policy can’t be read, and its own sentence for an unconfigured provider', async () => {
    actionMocks.startQuestionnaireGenerationAction
      .mockResolvedValueOnce(refusedByPolicy('AI_CLASSIFICATION_ABOVE_CEILING', fixedAboveCeiling))
      .mockResolvedValueOnce(refusedByPolicy('AI_POLICY_NOT_CONFIGURED', notConfigured));
    actionMocks.getRequestGenerationJobsAction.mockResolvedValue({ ok: false, formError: 'The request service is unavailable. Please try again later.' });
    render(<QuestionnaireGenerationJob action="generate" jobsReadFailed requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('alert')).toHaveTextContent(fixedAboveCeiling);

    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('alert')).toHaveTextContent(notConfigured);
  });

  it('names them in the Replace confirmation when a replacement is refused', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue(refusedByPolicy('AI_CLASSIFICATION_ABOVE_CEILING', fixedAboveCeiling));
    actionMocks.getRequestGenerationJobsAction.mockResolvedValue({ ok: true, data: { questionnaireGeneration: null, assessmentDraft: null, aiPolicy: aboveCeiling } });
    render(<QuestionnaireGenerationJob action="replace" aiPolicy={stale} analystChangesSinceGeneration={0} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' })).toHaveTextContent(namedAboveCeiling);
  });

  it('offers no Retry for a failed job while the served policy refuses, and shows the refusal once', () => {
    render(<QuestionnaireGenerationJob action="generate" aiPolicy={aboveCeiling} requestId="request-one" seededJob={{ job: { ...failedJob, failureCode: 'AI_CLASSIFICATION_ABOVE_CEILING' }, canRetry: true }} />);

    expect(screen.queryByRole('button', { name: 'Retry questionnaire generation' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('note')).toHaveLength(1);
    expect(screen.getByRole('note')).toHaveTextContent(namedAboveCeiling);
  });

  it('offers no Replace for a refused acknowledgement while the served policy refuses', () => {
    render(<QuestionnaireGenerationJob action="replace" aiPolicy={aboveCeiling} analystChangesSinceGeneration={0} requestId="request-one" seededJob={{ job: { ...failedJob, failureCode: 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED' }, canRetry: true }} />);

    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('note')).toHaveLength(1);
  });

  it('keeps Retry under an allowed policy without the idle state’s classification caption (§11.1)', () => {
    render(<QuestionnaireGenerationJob action="generate" aiPolicy={stale} requestId="request-one" seededJob={{ job: failedJob, canRetry: true }} />);

    expect(screen.getByRole('button', { name: 'Retry questionnaire generation' })).toBeEnabled();
    expect(screen.queryByText(/is classified/)).not.toBeInTheDocument();
  });

  it('names the classification and the approved limit when the server refuses a retry', async () => {
    actionMocks.retryQuestionnaireGenerationJobAction.mockResolvedValue(refusedByPolicy('AI_CLASSIFICATION_ABOVE_CEILING', fixedAboveCeiling));
    actionMocks.getRequestGenerationJobsAction.mockResolvedValue({ ok: true, data: { questionnaireGeneration: null, assessmentDraft: null, aiPolicy: aboveCeiling } });
    render(<QuestionnaireGenerationJob action="generate" aiPolicy={stale} requestId="request-one" seededJob={{ job: failedJob, canRetry: true }} />);

    fireEvent.click(screen.getByRole('button', { name: 'Retry questionnaire generation' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    const refusal = screen.getAllByRole('alert').find((alert) => alert.textContent?.includes('Questionnaire generation couldn’t start'));
    expect(refusal).toHaveTextContent(namedAboveCeiling);
  });
});

/* Phase 15 (15-UI-SPEC §3.3, §12; D-12, D-32): the instruction on the hub's Generate. */
describe('generating with an instruction from the hub', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    window.sessionStorage.clear();
  });

  afterEach(() => vi.useRealTimers());

  it('clears an acknowledged replacement instruction and reopens with the same approved guidance as Generate', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: true, data: queuedJob });
    const page = render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} ownerKey="owner-a" requestId="request-one" />);
    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    let dialog = screen.getByRole('alertdialog');
    fireEvent.change(within(dialog).getByLabelText('Instruction for the AI (optional)'), { target: { value: 'Cover offshore payroll.' } });
    expect(window.sessionStorage.getItem('csrm-draft:replacement-instruction:owner-a:request-one')).toBe('Cover offshore payroll.');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(window.sessionStorage.getItem('csrm-draft:replacement-instruction:owner-a:request-one')).toBeNull();
    page.unmount();
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} ownerKey="owner-a" requestId="request-one" />);
    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    dialog = screen.getByRole('alertdialog');
    expect(within(dialog).getByLabelText('Instruction for the AI (optional)')).toHaveValue('');
    expect(within(dialog).getByText('Say what the questionnaire should focus on, for example “Cover the offshore support team and payroll data”. The AI already reads the request and the marked notes and files.')).toBeInTheDocument();
  });

  it('explains instruction availability on the requesting analyst’s Replace action and dialog', () => {
    const caption = 'You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.';
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} ownRequest requestId="request-one" />);
    expect(screen.getByText(caption)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    expect(within(screen.getByRole('alertdialog')).getByText(caption)).toBeInTheDocument();
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
  });

  it('shows the optional instruction field above Generate questionnaire and sends what was typed, then clears it', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: true, data: queuedJob });
    render(<QuestionnaireGenerationJob action="generate" ownerKey="owner-a" requestId="request-one" seededJob={undefined} />);
    const field = screen.getByLabelText('Instruction for the AI (optional)');
    expect(screen.getByText('Say what the questionnaire should focus on, for example “Cover the offshore support team and payroll data”. The AI already reads the request and the marked notes and files.')).toBeInTheDocument();
    expect(field.compareDocumentPosition(screen.getByRole('button', { name: 'Generate questionnaire' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    fireEvent.change(field, { target: { value: 'Cover the offshore support team and payroll data' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledWith({ requestId: 'request-one', replaceUnansweredQuestionnaire: false, instruction: 'Cover the offshore support team and payroll data' });
    expect(window.sessionStorage.getItem('csrm-draft:generation-instruction:owner-a:request-one')).toBeNull();
  });

  it('shows an instruction refusal beside the field and keeps the text', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: false, formError: 'The instruction repeats a long passage of the Requestor’s own words. The AI already reads the request and the marked notes and files, so say what to focus on in your own words.', reason: 'INSTRUCTION_REPEATS_REQUESTOR_TEXT' });
    render(<QuestionnaireGenerationJob action="generate" ownerKey="owner-a" requestId="request-one" seededJob={undefined} />);
    const field = screen.getByLabelText('Instruction for the AI (optional)');
    fireEvent.change(field, { target: { value: 'The vendor processes payroll.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(field).toHaveAccessibleDescription(/repeats a long passage of the Requestor’s own words/);
    expect(field).toHaveValue('The vendor processes payroll.');
  });

  it('shows family I’s sentence when the analyst raised the request', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: false, formError: 'A Security Analyst can’t give the AI an instruction on a request they raised. Generate without one, or ask another Security Analyst.', reason: 'OWN_REQUEST' });
    render(<QuestionnaireGenerationJob action="generate" ownerKey="owner-a" requestId="request-one" seededJob={undefined} />);
    fireEvent.change(screen.getByLabelText('Instruction for the AI (optional)'), { target: { value: 'Cover payroll.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Generate questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });
    expect(screen.getByRole('alert')).toHaveTextContent('A Security Analyst can’t give the AI an instruction on a request they raised. Generate without one, or ask another Security Analyst.');
  });

  it('offers a requesting analyst no field, and says they can generate without one', () => {
    render(<QuestionnaireGenerationJob action="generate" ownRequest ownerKey="owner-a" requestId="request-one" seededJob={undefined} />);
    expect(screen.queryByLabelText('Instruction for the AI (optional)')).toBeNull();
    expect(screen.getByText('You raised this request, so you can generate without an instruction. Another Security Analyst can give the AI one.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Generate questionnaire' })).toBeInTheDocument();
  });
});

/* Phase 15 (15-UI-SPEC §8.3, §8.4, §13; D-09, D-29, D-33; U3): the hub card with the proposals read. */
describe('the hub card with AI proposals', () => {
  const allowed = { allowed: true, reason: null };
  const view = (overrides: Partial<QuestionnaireAiProposalsView> = {}): QuestionnaireAiProposalsView => ({
    questionnaireId: 'q-1', state: 'analyst-review', openCount: 0,
    actions: { start: allowed, rewrite: allowed, confirm: allowed, reject: allowed, replace: allowed },
    runs: [], items: [], jobs: [], fixedQuestions: [], ...overrides,
  });
  const card = (aiProposals: QuestionnaireAiProposalsView | null, props: Partial<Parameters<typeof QuestionnaireGenerationJob>[0]> = {}) => render(
    <QuestionnaireGenerationJob action="replace" aiProposals={aiProposals} analystChangesSinceGeneration={0} questionnaireHref="/app/review/questionnaires/q-1" questionnaireNumber="QNR-1" requestId="request-one" timing={{ ...fastTiming }} {...props} />,
  );
  const fastTiming = { pollIntervalMs: 5, timeoutMs: 60, now: () => Date.now(), setTimeout: (callback: () => void, delay: number) => globalThis.setTimeout(callback, delay), clearTimeout: (handle: ReturnType<typeof setTimeout>) => globalThis.clearTimeout(handle) };

  beforeEach(() => { vi.clearAllMocks(); });

  it('offers Replace when the read allows it', () => {
    card(view());
    expect(screen.getByRole('button', { name: 'Replace questionnaire' })).toBeInTheDocument();
  });

  it.each([
    ['QUESTIONNAIRE_ANSWERED', 'The Requestor has answered this questionnaire, so it can’t be replaced. Ask the AI for follow-up questions instead.', 'Open AI proposals'],
    ['QUESTIONNAIRE_HAS_ANALYST_CHANGES', 'Analysts have changed this questionnaire since it was generated, so replacing it would discard their work. Use AI proposals to change it instead.', 'Open AI proposals'],
    ['AI_PROPOSALS_OPEN', 'This questionnaire has open AI proposals. Decide them before replacing it.', '2 open AI proposals'],
  ])('says why Replace is not offered for %s, linking to the AI proposals', (reason, line, link) => {
    card(view({ openCount: 2, actions: { start: allowed, rewrite: allowed, confirm: allowed, reject: allowed, replace: { allowed: false, reason } } }));
    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: link })).toHaveAttribute('href', '/app/review/questionnaires/q-1#ai-proposals');
  });

  it('counts the open AI proposals as a link to the panel, or says none are open, and shows neither for a requesting analyst', () => {
    const { unmount } = card(view({ openCount: 3 }));
    expect(screen.getByRole('link', { name: 'AI proposals: 3 open' })).toHaveAttribute('href', '/app/review/questionnaires/q-1#ai-proposals');
    unmount();
    const none = card(view());
    expect(screen.getByText('AI proposals: none open')).toBeInTheDocument();
    none.unmount();
    card(null, { ownRequest: true });
    expect(screen.queryByText(/^AI proposals:/)).toBeNull();
  });

  it('follows a hub-started proposal job to its proposals', async () => {
    const queued = { jobId: 'pj-1', questionnaireId: 'q-1', operation: 'questionnaire-proposals' as const, questionId: null, status: 'queued' as const, attempt: 1, queuedAt: '2026-10-12T00:00:00.000Z', startedAt: null, completedAt: null, runId: null, failureCode: null, failureMessage: null, initiatedBy: { documentId: 'analyst-2', displayName: 'Sam Analyst' }, initiatedByViewer: false, canRetry: false };
    aiActionMocks.getQuestionnaireProposalJobAction.mockResolvedValue({ ok: true, data: { ...queued, status: 'completed', runId: 'run-9' } });
    const { rerender } = card(view({ jobs: [queued] }));
    expect(screen.getByText('The AI is preparing follow-up questions.')).toBeInTheDocument();
    const statusHolder = screen.getByText('The AI is preparing follow-up questions.');
    statusHolder.focus();
    expect(statusHolder).toHaveFocus();
    expect(screen.getByText('Started by Sam Analyst.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Open AI proposals' })).toHaveAttribute('href', '/app/review/questionnaires/q-1#ai-proposals');
    await act(async () => { await new Promise((resolve) => globalThis.setTimeout(resolve, 30)); });
    expect(routerRefresh).toHaveBeenCalled();
    expect(statusHolder).toBeInTheDocument();
    expect(statusHolder).toHaveFocus();
    const run = { runId: 'run-9', operation: 'questionnaire-proposals' as const, scope: 'questionnaire' as const, initiatedBy: null, startedAt: null, completedAt: null, providerName: null, providerVersion: null, instruction: null, instructionSource: 'default-task' as const, targetQuestion: null, outcome: 'items' as const, counts: { items: 3, open: 3 }, adjustments: [], sourcesDropped: 0 };
    rerender(<QuestionnaireGenerationJob action="replace" aiProposals={view({ openCount: 3, runs: [run] })} analystChangesSinceGeneration={0} questionnaireHref="/app/review/questionnaires/q-1" requestId="request-one" timing={fastTiming} />);
    expect(screen.getByText('3 AI proposals are ready to review.')).toBeInTheDocument();
    expect(screen.getByText('3 AI proposals are ready to review.')).toBe(statusHolder);
    expect(statusHolder).toHaveFocus();
    expect(screen.getByRole('link', { name: 'Review AI proposals' })).toHaveAttribute('href', '/app/review/questionnaires/q-1#ai-proposals');
  });

  it('shows a failed hub proposal job with Q3’s copy and Retry AI proposals, and CONTEXT_TOO_LARGE with Q1’s sentence', () => {
    const failed = { jobId: 'pj-1', questionnaireId: 'q-1', operation: 'questionnaire-proposals' as const, questionId: null, status: 'failed' as const, attempt: 1, queuedAt: '2026-10-12T00:00:00.000Z', startedAt: null, completedAt: null, runId: null, failureCode: 'PROVIDER_OUTPUT_INVALID', failureMessage: 'x', initiatedBy: null, initiatedByViewer: true, canRetry: true };
    const { unmount } = card(view({ jobs: [failed] }));
    expect(screen.getByText('The AI’s reply couldn’t be read, so nothing was proposed. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry AI proposals' })).toBeInTheDocument();
    unmount();
    card(view({ jobs: [{ ...failed, failureCode: 'CONTEXT_TOO_LARGE', failureMessage: 'The request is too large for this operation.' }] }));
    expect(screen.getByText('This questionnaire and its request hold more than CSRM can send to the AI at once, so nothing was sent. Contact your administrator.')).toBeInTheDocument();
  });

  it('restores the questionnaire-wide completed hub outcome after reload, independently of later rewrites', () => {
    const run = { runId: 'run-hub', operation: 'questionnaire-proposals' as const, scope: 'questionnaire' as const, initiatedBy: null, startedAt: null, completedAt: null, providerName: null, providerVersion: null, instruction: null, instructionSource: 'default-task' as const, targetQuestion: null, outcome: 'items' as const, counts: { items: 3, open: 3 }, adjustments: [], sourcesDropped: 0 };
    card(view({ state: 'submitted', openCount: 3, runs: [
      { ...run, runId: 'run-rewrite', operation: 'question-rewrite', scope: 'question', counts: { items: 1, open: 1 }, targetQuestion: { questionId: 'question-1', questionText: 'Question' } },
      run,
      { ...run, runId: 'older-run', counts: { items: 2, open: 0 } },
    ] }));
    expect(screen.getByText('3 AI proposals are ready to review.')).toHaveAttribute('data-ai-proposals-job-status');
    expect(screen.getByRole('link', { name: 'Review AI proposals' })).toBeInTheDocument();
  });
});

/* Phase 15 (15-UI-SPEC §13 amendment of 2026-10-11; D-29): CONTEXT_TOO_LARGE on the generation card. */
describe('the generation card’s CONTEXT_TOO_LARGE by the shared rule', () => {
  beforeEach(() => { vi.clearAllMocks(); });
  const notes = 'The AI context is too large. 2 notes are marked as changing the AI inputs (notes 2 and 5) and 1 file is included in them; unmark or exclude some and try again.';

  it('shows the served sentence when it names notes marked as changing the AI inputs, then the files without 14-16’s sentence', () => {
    render(<QuestionnaireGenerationJob action="generate" requestId="request-1" seededJob={{ job: { ...failedJob, failureCode: 'CONTEXT_TOO_LARGE', failureMessage: notes, failureAttachments: [{ documentId: 'att-pack', fileName: 'vendor-security-pack.pdf' }] }, canRetry: true }} />);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent(notes);
    expect(within(alert).getByRole('link', { name: 'vendor-security-pack.pdf' })).toHaveAttribute('href', '/app/review/requests/request-1#file-att-pack');
    expect(alert).not.toHaveTextContent('The files included in the AI inputs hold more text than CSRM can send at once');
    expect(alert).not.toHaveTextContent('Contact your administrator');
  });

  it('shows a notes-only sentence alone, marked as changing the AI inputs', () => {
    const one = 'The AI context is too large. 1 note is marked as changing the AI inputs (note 7); unmark some and try again.';
    render(<QuestionnaireGenerationJob action="generate" requestId="request-1" seededJob={{ job: { ...failedJob, failureCode: 'CONTEXT_TOO_LARGE', failureMessage: one }, canRetry: true }} />);
    expect(screen.getByRole('alert')).toHaveTextContent(one);
    expect(within(screen.getByRole('alert')).queryByRole('list')).toBeNull();
  });
});
