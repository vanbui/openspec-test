import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { QuestionnaireDefinition } from './questionnaire-schema';
import {
  answersUpdatedAt,
  rememberSavedQuestionnaire,
  savedQuestionnaireAfter,
  useAnswerAutosave,
  type AutosaveOutcome,
  type AutosaveTrigger,
} from './use-answer-autosave';

/*
 * D-11 and UI-SPEC §6.2: a change saves about 1.5 seconds after the last one, a blur saves at once, one save
 * is in flight with at most one queued follow-up, and a blocked failure stops autosave until the page is
 * refreshed (research Pitfall 7).
 */

type Deferred = { promise: Promise<AutosaveOutcome>; resolve: (outcome: AutosaveOutcome) => void; reject: (error: unknown) => void };

function deferred(): Deferred {
  let resolve!: Deferred['resolve'];
  let reject!: Deferred['reject'];
  const promise = new Promise<AutosaveOutcome>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

const saved = (at = '2026-09-28T01:00:05.000Z'): AutosaveOutcome => ({ ok: true, savedAt: at });

function setup(save: (answers: string, trigger: AutosaveTrigger) => Promise<AutosaveOutcome>, answers: { current: string } = { current: 'first' }) {
  return renderHook(() => useAnswerAutosave({ save, getAnswers: () => answers.current }));
}

/** Lets the save promise's continuations run inside act. */
async function settle(): Promise<void> {
  await act(async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve(); });
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('useAnswerAutosave timing (UI-SPEC §6.2)', () => {
  it('starts in idle and does not block navigation', () => {
    const save = vi.fn();
    const { result } = setup(save);
    expect(result.current.status).toEqual({ kind: 'idle' });
    expect(result.current.blocking).toBe(false);
  });

  it('shows saving at once and saves once, 1,500 ms after a change', async () => {
    const save = vi.fn(async () => saved());
    const { result } = setup(save);

    act(() => result.current.schedule());
    expect(result.current.status).toEqual({ kind: 'saving' });
    expect(result.current.blocking).toBe(true);
    act(() => { vi.advanceTimersByTime(1_499); });
    expect(save).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith('first', 'auto');
    await settle();
    expect(result.current.status).toEqual({ kind: 'saved', at: '2026-09-28T01:00:05.000Z' });
    expect(result.current.blocking).toBe(false);
  });

  it('debounces three changes 500 ms apart into one save, 1,500 ms after the last', async () => {
    const save = vi.fn(async () => saved());
    const { result } = setup(save);

    act(() => result.current.schedule());
    act(() => { vi.advanceTimersByTime(500); });
    act(() => result.current.schedule());
    act(() => { vi.advanceTimersByTime(500); });
    act(() => result.current.schedule());
    act(() => { vi.advanceTimersByTime(1_499); });
    expect(save).not.toHaveBeenCalled();
    act(() => { vi.advanceTimersByTime(1); });
    expect(save).toHaveBeenCalledTimes(1);
    await settle();
  });

  it('saves at once when a field loses focus and cancels the timer', async () => {
    const save = vi.fn(async () => saved());
    const { result } = setup(save);

    act(() => result.current.schedule());
    act(() => result.current.flush());
    expect(save).toHaveBeenCalledTimes(1);
    await settle();
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it('a blur with no waiting change sends nothing', () => {
    const save = vi.fn(async () => saved());
    const { result } = setup(save);

    act(() => result.current.flush());
    expect(save).not.toHaveBeenCalled();
    expect(result.current.status).toEqual({ kind: 'idle' });
  });

  it('queues exactly one follow-up for changes made while a save is in flight, sent when it settles', async () => {
    const first = deferred();
    const second = deferred();
    const answers = { current: 'first' };
    const save = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise);
    const { result } = setup(save, answers);

    act(() => result.current.schedule());
    act(() => { vi.advanceTimersByTime(1_500); });
    expect(save).toHaveBeenCalledTimes(1);

    answers.current = 'second';
    act(() => result.current.schedule());
    act(() => result.current.schedule());
    act(() => result.current.flush());
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.blocking).toBe(true);

    await act(async () => { first.resolve(saved('2026-09-28T01:00:05.000Z')); await first.promise; });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('second', 'auto');
    expect(result.current.status).toEqual({ kind: 'saving' });

    await act(async () => { second.resolve(saved('2026-09-28T01:00:09.000Z')); await second.promise; });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toEqual({ kind: 'saved', at: '2026-09-28T01:00:09.000Z' });
    expect(result.current.blocking).toBe(false);
  });
});

describe('useAnswerAutosave failures (UI-SPEC §6.1, research Pitfall 7)', () => {
  it('a retryable failure keeps blocking and saves again on the next change', async () => {
    const save = vi.fn()
      .mockResolvedValueOnce({ ok: false, failure: 'retryable' })
      .mockResolvedValueOnce(saved());
    const { result } = setup(save);

    act(() => result.current.schedule());
    act(() => { vi.advanceTimersByTime(1_500); });
    await settle();
    expect(result.current.status).toEqual({ kind: 'failed', failure: 'retryable' });
    expect(result.current.blocking).toBe(true);

    act(() => { vi.advanceTimersByTime(10_000); });
    expect(save).toHaveBeenCalledTimes(1);

    act(() => result.current.schedule());
    act(() => { vi.advanceTimersByTime(1_500); });
    await settle();
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toEqual({ kind: 'saved', at: '2026-09-28T01:00:05.000Z' });
  });

  it('a thrown save is a retryable failure, and Retry save sends it again at once', async () => {
    const save = vi.fn()
      .mockRejectedValueOnce(new Error('network down'))
      .mockResolvedValueOnce(saved());
    const { result } = setup(save);

    act(() => result.current.schedule());
    act(() => result.current.flush());
    await settle();
    expect(result.current.status).toEqual({ kind: 'failed', failure: 'retryable' });

    act(() => result.current.retry());
    expect(save).toHaveBeenCalledTimes(2);
    await settle();
    expect(result.current.status).toEqual({ kind: 'saved', at: '2026-09-28T01:00:05.000Z' });
  });

  it('a blocked failure keeps its message, blocks navigation and ignores later changes and retries', async () => {
    const message = 'This questionnaire is no longer open for answers, so your latest answers weren’t saved.';
    const save = vi.fn().mockResolvedValue({ ok: false, failure: 'blocked', message });
    const { result } = setup(save);

    act(() => result.current.schedule());
    act(() => { vi.advanceTimersByTime(1_500); });
    await settle();
    expect(result.current.status).toEqual({ kind: 'failed', failure: 'blocked', message });
    expect(result.current.blocking).toBe(true);

    act(() => result.current.schedule());
    act(() => result.current.flush());
    act(() => result.current.retry());
    act(() => { vi.advanceTimersByTime(10_000); });
    await settle();
    expect(save).toHaveBeenCalledTimes(1);
    expect(result.current.status).toEqual({ kind: 'failed', failure: 'blocked', message });
  });
});

describe('useAnswerAutosave explicit saves, pauses and leaving the page', () => {
  it('Save draft saves at once, cancels the waiting save and waits for one in flight', async () => {
    const first = deferred();
    const answers = { current: 'first' };
    const save = vi.fn().mockReturnValueOnce(first.promise).mockResolvedValue(saved('2026-09-28T01:00:09.000Z'));
    const { result } = setup(save, answers);

    act(() => result.current.schedule());
    act(() => result.current.flush());
    answers.current = 'second';
    act(() => result.current.schedule());

    let explicit: Promise<AutosaveOutcome> | undefined;
    act(() => { explicit = result.current.saveNow(); });
    expect(save).toHaveBeenCalledTimes(1);
    await act(async () => { first.resolve(saved()); await first.promise; });
    await settle();
    await act(async () => { await explicit; });

    expect(save).toHaveBeenCalledTimes(2);
    expect(save).toHaveBeenLastCalledWith('second', 'explicit');
    await expect(explicit).resolves.toEqual(saved('2026-09-28T01:00:09.000Z'));
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(save).toHaveBeenCalledTimes(2);
    expect(result.current.status).toEqual({ kind: 'saved', at: '2026-09-28T01:00:09.000Z' });
  });

  it('holds changes while paused for the submit confirmation and saves them after resume', async () => {
    const save = vi.fn(async () => saved());
    const { result } = setup(save);

    act(() => result.current.pause());
    act(() => result.current.schedule());
    act(() => { vi.advanceTimersByTime(5_000); });
    expect(save).not.toHaveBeenCalled();
    expect(result.current.blocking).toBe(true);

    act(() => result.current.resume());
    act(() => { vi.advanceTimersByTime(1_500); });
    expect(save).toHaveBeenCalledTimes(1);
    await settle();
  });

  it.each([
    ['pagehide', () => window.dispatchEvent(new Event('pagehide'))],
    ['visibilitychange to hidden', () => {
      vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
      document.dispatchEvent(new Event('visibilitychange'));
    }],
  ])('sends a waiting save at once on %s', async (_event, leave) => {
    const save = vi.fn(async () => saved());
    const { result } = setup(save);

    act(() => result.current.schedule());
    act(() => leave());
    expect(save).toHaveBeenCalledTimes(1);
    await settle();
    vi.restoreAllMocks();
  });

  it('sends a waiting save at once when the questionnaire unmounts', () => {
    const save = vi.fn(async () => saved());
    const { result, unmount } = setup(save);

    act(() => result.current.schedule());
    unmount();
    expect(save).toHaveBeenCalledTimes(1);
  });
});

describe('the session record of the last save (Back and Forward after an autosave)', () => {
  const answers = [{ questionKey: 'service_name' }] as unknown as QuestionnaireDefinition;

  it('returns the remembered save only when it is later than the page it is compared with', () => {
    rememberSavedQuestionnaire('q-1', { updatedAt: '2026-09-28T01:00:05.000Z', answers });

    expect(savedQuestionnaireAfter('q-1', '2026-09-28T01:00:00.000Z')).toEqual({ updatedAt: '2026-09-28T01:00:05.000Z', answers });
    expect(savedQuestionnaireAfter('q-1', '2026-09-28T01:00:05.000Z')).toBeUndefined();
    expect(savedQuestionnaireAfter('q-1', '2026-09-28T01:00:06.000Z')).toBeUndefined();
    expect(savedQuestionnaireAfter('q-2', '2026-09-28T01:00:00.000Z')).toBeUndefined();
  });

  it('compares the times as instants, not as text', () => {
    rememberSavedQuestionnaire('q-3', { updatedAt: '2026-09-28T01:00:05.000Z', answers });

    expect(savedQuestionnaireAfter('q-3', '2026-09-28T11:00:06.000+10:00')).toBeUndefined();
    expect(savedQuestionnaireAfter('q-3', '2026-09-28T11:00:04.000+10:00')).toEqual({ updatedAt: '2026-09-28T01:00:05.000Z', answers });
  });

  it('a page with no readable time keeps the page payload', () => {
    rememberSavedQuestionnaire('q-4', { updatedAt: '2026-09-28T01:00:05.000Z', answers });

    expect(savedQuestionnaireAfter('q-4', undefined)).toBeUndefined();
    expect(savedQuestionnaireAfter('q-4', 'not a time')).toBeUndefined();
  });
});

/*
 * IN-303: the page's own time for the session-record comparison is the later of the questionnaire's updatedAt and
 * its latest answer's (saving answers does not touch the questionnaire's updatedAt). It sits beside
 * savedQuestionnaireAfter, out of the JSX module, and compares instants, never text.
 */
describe('answersUpdatedAt (the page time the session record is compared with)', () => {
  const question = (updatedAt: string | null) => ({ questionKey: 'q', answer: updatedAt === null ? null : { value: 'yes', updatedAt } }) as unknown as QuestionnaireDefinition[number];

  it('is the latest answer time when that is later than the questionnaire', () => {
    expect(answersUpdatedAt({ updatedAt: '2026-09-28T00:30:00.000Z' }, [question('2026-09-28T01:00:00.000Z'), question('2026-09-28T00:45:00.000Z'), question(null)]))
      .toBe('2026-09-28T01:00:00.000Z');
  });

  it('compares offset times as instants, not as text', () => {
    // 11:00+10:00 is 01:00Z, earlier than 01:30Z, although its text sorts later.
    expect(answersUpdatedAt({ updatedAt: '2026-09-28T01:30:00.000Z' }, [question('2026-09-28T11:00:00.000+10:00')])).toBe('2026-09-28T01:30:00.000Z');
    expect(answersUpdatedAt({ updatedAt: '2026-09-28T00:30:00.000Z' }, [question('2026-09-28T11:00:00.000+10:00')])).toBe('2026-09-28T11:00:00.000+10:00');
  });

  it('ignores an unreadable answer time, and prefers a readable answer time to an unreadable questionnaire time', () => {
    expect(answersUpdatedAt({ updatedAt: '2026-09-28T00:30:00.000Z' }, [question('not a time')])).toBe('2026-09-28T00:30:00.000Z');
    expect(answersUpdatedAt({ updatedAt: 'not a time' }, [question('2026-09-28T01:00:00.000Z')])).toBe('2026-09-28T01:00:00.000Z');
  });
});
