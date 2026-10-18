/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearAllSessionDrafts, clearSessionDraft, readSessionDraft, writeSessionDraft, type SessionDraftKind } from './session-drafts';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

describe('the session-draft store (13-UI-SPEC §9.3, UI-D17, UI-D31)', () => {
  it('keys each draft by its kind, the signed-in person and the request', () => {
    writeSessionDraft('assign', 'owner-a', 'request-1', 'Sam covers this system.');
    expect(window.sessionStorage.getItem('csrm-draft:assign:owner-a:request-1')).toBe('Sam covers this system.');
    expect(readSessionDraft('assign', 'owner-a', 'request-1')).toBe('Sam covers this system.');
    expect(readSessionDraft('assign', 'owner-b', 'request-1')).toBeNull();
    expect(readSessionDraft('note', 'owner-a', 'request-1')).toBeNull();
    expect(readSessionDraft('assign', 'owner-a', 'request-2')).toBeNull();
  });

  it('clears one draft, and an empty draft is no draft', () => {
    writeSessionDraft('note', 'owner-a', 'request-1', 'Unsent note');
    clearSessionDraft('note', 'owner-a', 'request-1');
    expect(readSessionDraft('note', 'owner-a', 'request-1')).toBeNull();
    writeSessionDraft('note', 'owner-a', 'request-1', 'Unsent note');
    writeSessionDraft('note', 'owner-a', 'request-1', '');
    expect(window.sessionStorage.getItem('csrm-draft:note:owner-a:request-1')).toBeNull();
  });

  it('clears every csrm-draft key on sign-out and nothing else', () => {
    writeSessionDraft('note', 'owner-a', 'request-1', 'one');
    writeSessionDraft('assign', 'owner-b', 'request-2', 'two');
    window.sessionStorage.setItem('other-app-key', 'kept');
    clearAllSessionDrafts();
    expect(window.sessionStorage.length).toBe(1);
    expect(window.sessionStorage.getItem('other-app-key')).toBe('kept');
  });

  it('tolerates a browser whose session storage is unavailable', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(() => writeSessionDraft('assign', 'owner-a', 'request-1', 'text')).not.toThrow();
    expect(readSessionDraft('assign', 'owner-a', 'request-1')).toBeNull();
    expect(() => clearSessionDraft('assign', 'owner-a', 'request-1')).not.toThrow();
    expect(() => clearAllSessionDrafts()).not.toThrow();
  });

  it('tolerates a store that refuses a write (quota)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('full', 'QuotaExceededError'); });
    expect(() => writeSessionDraft('note', 'owner-a', 'request-1', 'text')).not.toThrow();
  });

  it('keeps every Phase 15 kind, a structured draft as JSON, and clears them at sign-out (SD-1)', () => {
    writeSessionDraft('questionnaire-ai-instruction', 'owner-a', 'questionnaire-1', 'Cover backups');
    const answers = JSON.stringify({ 'question-key': 'Yes' });
    writeSessionDraft('unsaved-answers', 'owner-a', 'questionnaire-1', answers);
    for (const kind of ['question-rewrite-instruction', 'proposal-edit', 'generation-instruction', 'replacement-instruction'] as const) writeSessionDraft(kind, 'owner-a', 'record-1', 'kept');
    expect(window.sessionStorage.getItem('csrm-draft:questionnaire-ai-instruction:owner-a:questionnaire-1')).toBe('Cover backups');
    expect(JSON.parse(readSessionDraft('unsaved-answers', 'owner-a', 'questionnaire-1') ?? '{}')).toEqual({ 'question-key': 'Yes' });
    expect(readSessionDraft('proposal-edit', 'owner-a', 'record-1')).toBe('kept');
    clearSessionDraft('questionnaire-ai-instruction', 'owner-a', 'questionnaire-1');
    expect(readSessionDraft('questionnaire-ai-instruction', 'owner-a', 'questionnaire-1')).toBeNull();
    clearAllSessionDrafts();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('keeps every Phase 16 kind per person and record, and clears them at sign-out (D-47)', () => {
    const kinds = ['risk-withdraw-reason', 'risk-reinstate-reason', 'risk-suggest-instruction', 'risk-rewrite-instruction', 'risk-reject-reason'] as const satisfies readonly SessionDraftKind[];
    for (const kind of kinds) writeSessionDraft(kind, 'owner-a', 'risk-1', `${kind} text`);
    for (const kind of kinds) expect(window.sessionStorage.getItem(`csrm-draft:${kind}:owner-a:risk-1`)).toBe(`${kind} text`);
    expect(readSessionDraft('risk-withdraw-reason', 'owner-b', 'risk-1')).toBeNull();
    clearAllSessionDrafts();
    expect(window.sessionStorage.length).toBe(0);
  });

  it('is zod-free and client-safe', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/session-drafts/session-drafts.ts'), 'utf8');
    expect(source).not.toMatch(/from 'zod'|server-only/);
  });
});
