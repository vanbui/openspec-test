import { useCallback, useEffect, useRef, useState } from 'react';

import type { SaveStatusValue } from '@/components/csrm/save-status';
import type { QuestionnaireDefinition } from './questionnaire-schema';

/*
 * Answer autosave (D-11, UI-SPEC §6.2). A change waits about 1.5 seconds and then saves; a field losing
 * focus saves at once. One save is in flight at a time, and changes made while it runs queue one
 * follow-up that is sent when it settles. A retryable failure saves again on the next change or on Retry
 * save; a blocked failure (403, 404 or a 409) stops autosave until the page is refreshed, so a refusal can
 * never loop (research Pitfall 7). When the page is hidden or the questionnaire unmounts, a waiting save is
 * sent at once.
 *
 * This module has no directive: it is a hook the client renderer imports, and it imports no validation
 * library (the questionnaire route's delivered-JavaScript budget).
 */

export type AutosaveStatus = SaveStatusValue;

/** What one save attempt came to, as the caller's save function reports it. */
export type AutosaveOutcome =
  | { ok: true; savedAt: string }
  | { ok: false; failure: 'retryable' }
  | { ok: false; failure: 'blocked'; message: string };

/** `auto` for a debounced or blur save, `explicit` for Save draft and the save before submit. */
export type AutosaveTrigger = 'auto' | 'explicit';

export type UseAnswerAutosaveOptions<Answers> = {
  save: (answers: Answers, trigger: AutosaveTrigger) => Promise<AutosaveOutcome>;
  getAnswers: () => Answers;
  debounceMs?: number;
};

export type AnswerAutosave = {
  status: AutosaveStatus;
  /** True while a change waits, a save is in flight, or the last save failed (UI-SPEC §6.3). */
  blocking: boolean;
  /** An answer changed: restart the wait. */
  schedule: () => void;
  /** A field lost focus: send a waiting change now. */
  flush: () => void;
  /** Save draft, and the save before submitting: wait for any save in flight, then save the current answers. */
  saveNow: () => Promise<AutosaveOutcome>;
  /** Retry save after a retryable failure. */
  retry: () => void;
  /** Hold autosave while the submit confirmation is open. */
  pause: () => void;
  resume: () => void;
  /** The form was seeded again from a refreshed page: forget waiting work and any block. */
  reset: () => void;
};

const retryableFailure: AutosaveOutcome = { ok: false, failure: 'retryable' };

export function useAnswerAutosave<Answers>({ save, getAnswers, debounceMs = 1_500 }: UseAnswerAutosaveOptions<Answers>): AnswerAutosave {
  const [status, setStatus] = useState<AutosaveStatus>({ kind: 'idle' });

  const saveRef = useRef(save);
  const getAnswersRef = useRef(getAnswers);
  useEffect(() => {
    saveRef.current = save;
    getAnswersRef.current = getAnswers;
  });

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** A change is waiting for the timer (or for resume while paused). */
  const waiting = useRef(false);
  /** A change arrived while a save was in flight; one follow-up is owed. */
  const queued = useRef(false);
  const inFlight = useRef<Promise<AutosaveOutcome> | null>(null);
  const blocked = useRef(false);
  const paused = useRef(false);

  const showSaving = useCallback(() => {
    setStatus((current) => (current.kind === 'saving' ? current : { kind: 'saving' }));
  }, []);

  const clearTimer = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  /* `perform` and `settle` call each other through this ref, so neither closes over a stale copy. */
  const performRef = useRef<(trigger: AutosaveTrigger) => Promise<AutosaveOutcome>>(async () => retryableFailure);

  const settle = useCallback((outcome: AutosaveOutcome) => {
    if (!outcome.ok && outcome.failure === 'blocked') {
      blocked.current = true;
      waiting.current = false;
      queued.current = false;
      clearTimer();
      setStatus({ kind: 'failed', failure: 'blocked', message: outcome.message });
      return;
    }
    if (outcome.ok) blocked.current = false;
    if (queued.current) {
      queued.current = false;
      if (paused.current) {
        waiting.current = true;
        showSaving();
      } else {
        void performRef.current('auto');
      }
      return;
    }
    if (waiting.current) {
      showSaving();
      return;
    }
    setStatus(outcome.ok ? { kind: 'saved', at: outcome.savedAt } : { kind: 'failed', failure: 'retryable' });
  }, [clearTimer, showSaving]);

  const perform = useCallback(async (trigger: AutosaveTrigger): Promise<AutosaveOutcome> => {
    clearTimer();
    waiting.current = false;
    showSaving();
    const attempt = (async () => {
      try {
        return await saveRef.current(getAnswersRef.current(), trigger);
      } catch {
        return retryableFailure;
      }
    })();
    inFlight.current = attempt;
    const outcome = await attempt;
    inFlight.current = null;
    settle(outcome);
    return outcome;
  }, [clearTimer, settle, showSaving]);
  useEffect(() => { performRef.current = perform; }, [perform]);

  /** Sends the waiting change now, or owes it to the save in flight. */
  const sendWaiting = useCallback((ignorePause: boolean) => {
    if (blocked.current || (!waiting.current && !queued.current)) return;
    clearTimer();
    if (inFlight.current) {
      waiting.current = false;
      queued.current = true;
      return;
    }
    if (paused.current && !ignorePause) return;
    queued.current = false;
    void perform('auto');
  }, [clearTimer, perform]);

  const schedule = useCallback(() => {
    if (blocked.current) return;
    showSaving();
    clearTimer();
    if (inFlight.current) {
      queued.current = true;
      return;
    }
    waiting.current = true;
    if (paused.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      sendWaiting(false);
    }, debounceMs);
  }, [clearTimer, debounceMs, sendWaiting, showSaving]);

  const flush = useCallback(() => sendWaiting(false), [sendWaiting]);

  const saveNow = useCallback(async (): Promise<AutosaveOutcome> => {
    clearTimer();
    waiting.current = false;
    queued.current = false;
    while (inFlight.current) await inFlight.current;
    return perform('explicit');
  }, [clearTimer, perform]);

  const retry = useCallback(() => {
    if (blocked.current || inFlight.current) return;
    void perform('auto');
  }, [perform]);

  const pause = useCallback(() => {
    paused.current = true;
    clearTimer();
  }, [clearTimer]);

  const resume = useCallback(() => {
    paused.current = false;
    if (waiting.current && !blocked.current && !inFlight.current) {
      timer.current = setTimeout(() => {
        timer.current = null;
        sendWaiting(false);
      }, debounceMs);
    }
  }, [debounceMs, sendWaiting]);

  const reset = useCallback(() => {
    clearTimer();
    waiting.current = false;
    queued.current = false;
    blocked.current = false;
    paused.current = false;
    setStatus({ kind: 'idle' });
  }, [clearTimer]);

  /* Leaving: a hidden page or an unmount sends the waiting change with no prompt (UI-SPEC §6.2). */
  const sendWaitingRef = useRef(sendWaiting);
  useEffect(() => { sendWaitingRef.current = sendWaiting; });
  useEffect(() => {
    const leave = () => sendWaitingRef.current(true);
    const hidden = () => { if (document.visibilityState === 'hidden') leave(); };
    window.addEventListener('pagehide', leave);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      window.removeEventListener('pagehide', leave);
      document.removeEventListener('visibilitychange', hidden);
      leave();
    };
  }, []);

  const blocking = status.kind === 'saving' || status.kind === 'failed';
  return { status, blocking, schedule, flush, saveNow, retry, pause, resume, reset };
}

/*
 * The session record of the last save (Back and Forward after an autosave). An autosave revalidates
 * nothing, so the client router keeps the questionnaire page as it was last rendered, and a history
 * traversal reuses that payload however old it is. A restored page would seed the form with answers older
 * than the last save, and the next save would write them back. So each successful save is remembered here
 * for the tab, and the renderer prefers it at mount only when it is later than the page it was given. A
 * reload or a link navigation reads the server, whose answers are as new or newer, so the page wins.
 *
 * The record holds only the Requestor's own saved answers, in this tab's memory, and is gone on reload.
 */

export type SavedQuestionnaire = { updatedAt: string; answers: QuestionnaireDefinition };

const savedQuestionnaires = new Map<string, SavedQuestionnaire>();

const instant = (value: string | undefined): number => (value === undefined ? Number.NaN : Date.parse(value));

export function rememberSavedQuestionnaire(documentId: string, saved: SavedQuestionnaire): void {
  const known = savedQuestionnaires.get(documentId);
  if (known && instant(known.updatedAt) > instant(saved.updatedAt)) return;
  savedQuestionnaires.set(documentId, saved);
}

/*
 * When the page's answers last changed, the time the session record is compared with. A save's time is its
 * latest answer's time, and saving answers does not touch the questionnaire's own updatedAt, so this is the later
 * of the two, compared as instants (D-11). An unreadable time never wins over a readable one.
 */
export function answersUpdatedAt(questionnaire: { updatedAt: string }, definition: QuestionnaireDefinition): string {
  return definition.reduce((latest, question) => {
    const answered = question.answer?.updatedAt;
    if (!answered || Number.isNaN(instant(answered))) return latest;
    const current = instant(latest);
    return Number.isNaN(current) || instant(answered) > current ? answered : latest;
  }, questionnaire.updatedAt);
}

/** The remembered save for this questionnaire when it is later than `updatedAt`, else undefined. */
export function savedQuestionnaireAfter(documentId: string, updatedAt: string | undefined): SavedQuestionnaire | undefined {
  const saved = savedQuestionnaires.get(documentId);
  const page = instant(updatedAt);
  if (!saved || Number.isNaN(page)) return undefined;
  return instant(saved.updatedAt) > page ? saved : undefined;
}
