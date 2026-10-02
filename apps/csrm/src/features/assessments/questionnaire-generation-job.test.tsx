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

import { QuestionnaireGenerationJob } from './questionnaire-generation-job';

const queuedJob: QuestionnaireGenerationJobRecord = {
  jobId: 'job-one',
  requestId: 'request-one',
  providerName: 'Context provider',
  providerVersion: '1.0',
  attempt: 1,
  queuedAt: '2026-09-03T00:00:00.000Z',
  status: 'queued',
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
    const { unmount } = render(<QuestionnaireGenerationJob action="generate" initialJob={queuedJob} requestId="request-one" />);

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
    render(<QuestionnaireGenerationJob action="generate" initialJob={queuedJob} requestId="request-one" />);

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
        initialJob={queuedJob}
        requestId="request-one"
        timing={{ pollIntervalMs: 1_000, timeoutMs: 1_000, now: () => Date.now(), setTimeout, clearTimeout }}
      />,
    );

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(screen.getByText('Taking longer than expected')).toBeInTheDocument();
    const countAtTimeout = actionMocks.getQuestionnaireGenerationJobAction.mock.calls.length;
    await act(async () => { await vi.advanceTimersByTimeAsync(5_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(countAtTimeout);

    fireEvent.click(screen.getByRole('button', { name: 'Check again' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(countAtTimeout + 1);
  });

  it('cancels the replaced job schedule before polling the replacement', async () => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    const { rerender } = render(<QuestionnaireGenerationJob action="generate" initialJob={queuedJob} requestId="request-one" />);
    const replacement = { ...queuedJob, jobId: 'job-two', requestId: 'request-two', attempt: 2 };

    rerender(<QuestionnaireGenerationJob action="generate" initialJob={replacement} requestId="request-two" />);
    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledTimes(1);
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledWith({ jobId: 'job-two' });
  });

  it('does not let an obsolete status response replace a newer authoritative job', async () => {
    const poll = deferred<{ ok: true; data: QuestionnaireGenerationJobRecord }>();
    actionMocks.getQuestionnaireGenerationJobAction.mockReturnValue(poll.promise);
    const { rerender } = render(<QuestionnaireGenerationJob action="generate" initialJob={queuedJob} requestId="request-one" />);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    const replacement = { ...queuedJob, jobId: 'job-two', requestId: 'request-two', attempt: 2 };
    rerender(<QuestionnaireGenerationJob action="generate" initialJob={replacement} requestId="request-two" />);

    await act(async () => { poll.resolve({ ok: true, data: completedJob }); await poll.promise; });
    expect(screen.getAllByText('Questionnaire generation is queued')).not.toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'Review generated questionnaire' })).not.toBeInTheDocument();
  });

  it('offers a usable retry after failure', async () => {
    actionMocks.retryQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: queuedJob });
    render(<QuestionnaireGenerationJob action="generate" initialJob={failedJob} requestId="request-one" />);

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
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} initialJob={undefined} requestId="request-one" />);

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
const replacementOpening = 'This generates a new questionnaire from the request and replaces this one';
const replacementClosing = 'Requestor answers are never replaced. The new questionnaire stays in analyst review until you release it.';

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

  it.each([
    [0, `${replacementOpening}. No analyst has changed its questions since it was generated. ${replacementClosing}`],
    [1, `${replacementOpening}, discarding the 1 change an analyst made to its questions since it was generated. ${replacementClosing}`],
    [3, `${replacementOpening}, discarding the 3 changes analysts made to its questions since it was generated. ${replacementClosing}`],
    [null, `${replacementOpening}, discarding any changes analysts made to its questions since it was generated. ${replacementClosing}`],
  ])('states what a replacement discards when the served count is %s', (count, description) => {
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={count} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
    expect(dialog).toHaveAccessibleDescription(description);
    expect(within(dialog).getByRole('button', { name: 'Replace questionnaire' })).toHaveAttribute('data-variant', 'destructive');
    expect(within(dialog).getByRole('button', { name: 'Keep this questionnaire' })).toBeInTheDocument();
    expect(actionMocks.startQuestionnaireGenerationAction).not.toHaveBeenCalled();
  });

  it('keeps the questionnaire when the analyst dismisses the confirmation', async () => {
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={2} requestId="request-one" />);

    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    fireEvent.click(screen.getByRole('button', { name: 'Keep this questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
    expect(actionMocks.startQuestionnaireGenerationAction).not.toHaveBeenCalled();
  });

  it('shows Replacing questionnaire… while the confirmed replacement starts', async () => {
    const started = deferred<{ ok: true; data: QuestionnaireGenerationJobRecord }>();
    actionMocks.startQuestionnaireGenerationAction.mockReturnValue(started.promise);
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={2} requestId="request-one" />);

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
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={2} requestId="request-one" />);

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
    render(<QuestionnaireGenerationJob action="released" initialJob={notAcknowledged} questionnaireHref="/app/review/questionnaires/questionnaire-one" questionnaireNumber="QNR-2026-KX2AHV" requestId="request-one" />);

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
    ['provider-failed', 'The provider could not prepare a questionnaire.'],
  ])('words a %s failure for the analyst', (failureCode, copy) => {
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} initialJob={{ ...failedJob, failureCode }} requestId="request-one" />);

    // One alert: the failure. The polite live region repeats the title, so the title alone is not unique.
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Questionnaire generation failed');
    expect(alert).toHaveTextContent(copy);
    if (failureCode !== 'provider-failed') expect(alert).not.toHaveTextContent('The provider could not prepare a questionnaire.');
  });

  it('offers Replace questionnaire through the confirmation when the replacement was not acknowledged', async () => {
    actionMocks.startQuestionnaireGenerationAction.mockResolvedValue({ ok: true, data: queuedJob });
    const notAcknowledged = { ...failedJob, failureCode: 'QUESTIONNAIRE_REPLACEMENT_NOT_ACKNOWLEDGED' };
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={1} initialJob={notAcknowledged} requestId="request-one" />);

    expect(screen.queryByRole('button', { name: 'Retry questionnaire generation' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace and generate again' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Replace questionnaire' }));
    const dialog = screen.getByRole('alertdialog', { name: 'Replace this questionnaire?' });
    expect(dialog).toHaveTextContent('discarding the 1 change an analyst made to its questions since it was generated');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Replace questionnaire' }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledOnce();
    expect(actionMocks.startQuestionnaireGenerationAction).toHaveBeenCalledWith({ requestId: 'request-one', replaceUnansweredQuestionnaire: true });
  });
});

/*
 * UAT-041 (D-26, D-27, UI-SPEC §12.1): an analyst who leaves the request while a job runs and comes back sees
 * the job's status in place of Generate or Replace. The page seeds the card from the request's jobs read; a
 * job the viewer started is polled by id, and a job another Security Analyst started is polled by request.
 */
const runningJob: QuestionnaireGenerationJobRecord = { ...queuedJob, status: 'running', startedAt: '2026-09-03T00:00:01.000Z' };
const leaveAndReturn = 'You can leave this page. The status shows here when you come back.';
const startedByAnother = 'Started by another Security Analyst.';

describe('a questionnaire generation job seeded when the analyst comes back', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => vi.useRealTimers());

  it.each([
    ['queued', queuedJob, 'Questionnaire generation is queued'],
    ['running', runningJob, 'Questionnaire generation is running'],
  ] as const)('shows a %s job the viewer started in place of Generate and Replace, polled by id', async (_status, job, title) => {
    actionMocks.getQuestionnaireGenerationJobAction.mockResolvedValue({ ok: true, data: job });
    render(<QuestionnaireGenerationJob action="replace" analystChangesSinceGeneration={0} requestId="request-one" seededJob={{ job, canRetry: true }} />);

    expect(screen.getByText(title, { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(leaveAndReturn)).toBeInTheDocument();
    expect(screen.queryByText(startedByAnother)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Generate questionnaire' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Replace questionnaire' })).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/server-owned/i);

    await act(async () => { await vi.advanceTimersByTimeAsync(1_000); });
    expect(actionMocks.getQuestionnaireGenerationJobAction).toHaveBeenCalledWith({ jobId: 'job-one' });
    expect(actionMocks.getRequestGenerationJobsAction).not.toHaveBeenCalled();
  });

  it('shows a running job another Security Analyst started and polls it by request, never by id', async () => {
    actionMocks.getRequestGenerationJobsAction.mockResolvedValue({ ok: true, data: { questionnaireGeneration: { job: completedJob, canRetry: false }, assessmentDraft: null } });
    render(<QuestionnaireGenerationJob action="generate" requestId="request-one" seededJob={{ job: runningJob, canRetry: false }} />);

    expect(screen.getByText('Questionnaire generation is running', { selector: 'p' })).toBeInTheDocument();
    expect(screen.getByText(leaveAndReturn)).toBeInTheDocument();
    expect(screen.getByText(startedByAnother)).toBeInTheDocument();
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
