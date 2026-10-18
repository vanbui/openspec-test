/*
 * Unsent text kept for the browser session (13-UI-SPEC §9.3, UI-D17, UI-D31): a note being written and the assign
 * picker's reason, keyed `csrm-draft:{kind}:{ownerKey}:{requestId}` in the tab's sessionStorage, so in-app navigation
 * never loses them. The owner key is draft-owner-key.ts's opaque key, so no personal value is stored in clear, and
 * signing out clears every key with the prefix (T-13-32). A browser without usable storage, or a store that refuses a
 * write, keeps nothing and never fails. Zod-free and client-safe.
 *
 * The account menu ships on every route and imports `clearAllSessionDrafts`, so this module stays as small as it can
 * (performance.spec.ts budgets every route's first load; plan 13-09 "Budget").
 */

/*
 * Phase 15 (SD-1) adds every kind it keeps, so no later plan changes this module: the AI proposals panel's instruction
 * (record: the questionnaire), a rewrite's instruction (the question), an Edit, then confirm draft (`{runId}:{itemKey}`, as
 * JSON), the Generate and Replace instructions (the request) and the Requestor's unsaved answers (the questionnaire, as
 * JSON). Values stay strings; a structured draft's reader parses it defensively. The record id is any record's id.
 */
export type SessionDraftKind =
  | 'note'
  | 'assign'
  | 'questionnaire-ai-instruction'
  | 'question-rewrite-instruction'
  | 'proposal-edit'
  | 'generation-instruction'
  | 'replacement-instruction'
  | 'unsaved-answers'
  /*
   * Phase 16 (D-47): a withdrawal's and a reinstatement's reason and a rewrite's instruction (the Risk), the Suggest more
   * risks instruction (the assessment) and a rejection's reason (`{runId}:{itemKey}`, or the run for Reject remaining).
   */
  | 'risk-withdraw-reason'
  | 'risk-reinstate-reason'
  | 'risk-suggest-instruction'
  | 'risk-rewrite-instruction'
  | 'risk-reject-reason';

/** Every kept draft's key starts with it: `csrm-draft:{kind}:{ownerKey}:{requestId}`. */
export const SESSION_DRAFT_PREFIX = 'csrm-draft:';

/* Runs `use` against the tab's store, or returns `fallback` when there is none or it refuses (also on the server). */
function withStore<T>(use: (store: Storage) => T, fallback: T): T {
  try {
    return use(window.sessionStorage);
  } catch {
    return fallback;
  }
}

const draftKey = (kind: SessionDraftKind, ownerKey: string, requestId: string) => `${SESSION_DRAFT_PREFIX}${kind}:${ownerKey}:${requestId}`;

export function readSessionDraft(kind: SessionDraftKind, ownerKey: string, requestId: string): string | null {
  return withStore((store) => store.getItem(draftKey(kind, ownerKey, requestId)), null);
}

/** Keeps `value`; an empty value is no draft, so it clears the key. */
export function writeSessionDraft(kind: SessionDraftKind, ownerKey: string, requestId: string, value: string): void {
  const key = draftKey(kind, ownerKey, requestId);
  withStore((store) => (value ? store.setItem(key, value) : store.removeItem(key)), undefined);
}

export function clearSessionDraft(kind: SessionDraftKind, ownerKey: string, requestId: string): void {
  withStore((store) => store.removeItem(draftKey(kind, ownerKey, requestId)), undefined);
}

const draftKeys = (store: Storage) => Array.from({ length: store.length }, (_, index) => store.key(index) ?? '').filter((key) => key.startsWith(SESSION_DRAFT_PREFIX));

/** Whether this tab keeps any unsent text, of any person: Sign out asks before it discards it (WR-401). */
export const hasSessionDrafts = (): boolean => withStore((store) => draftKeys(store).length > 0, false);

/* Until when the page is being left on purpose (signing out), so the unload warnings do not ask a second time. */
let leavingUntil = 0;
export const leavingOnPurpose = (): boolean => Date.now() < leavingUntil;

/**
 * Removes every kept draft of every person in this tab: run once the person has chosen to sign out. The sign-out's
 * redirect then leaves the page, so the unload warnings stand down for ten seconds; a page that stays warns again.
 */
export function clearAllSessionDrafts(): void {
  leavingUntil = Date.now() + 10_000;
  withStore((store) => draftKeys(store).forEach((key) => store.removeItem(key)), undefined);
}
