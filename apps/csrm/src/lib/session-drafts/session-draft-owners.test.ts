/** @vitest-environment jsdom */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { clearOtherOwnersSessionDrafts } from './session-draft-owners';

afterEach(() => {
  vi.restoreAllMocks();
  window.sessionStorage.clear();
});

/*
 * IN-402 (T-13-32): a session can end, or a development identity change, without Sign out, leaving the previous person's
 * unsent note or reason in the tab's store. The owner key already keeps it out of the next person's screens; when a
 * composer or picker opens for a signed-in person, every other person's kept text is removed from the store as well.
 */
describe('clearing other people’s kept drafts (IN-402)', () => {
  it('removes every draft another owner kept, of either kind, and keeps the signed-in person’s and other keys', () => {
    window.sessionStorage.setItem('csrm-draft:note:owner-b:request-1', 'Someone else’s note');
    window.sessionStorage.setItem('csrm-draft:assign:owner-b:request-2', '{"reason":"Someone else’s reason","analyst":null}');
    window.sessionStorage.setItem('csrm-draft:note:owner-c:request-1', 'A third person’s note');
    window.sessionStorage.setItem('csrm-draft:note:owner-a:request-1', 'My note');
    window.sessionStorage.setItem('csrm-draft:assign:owner-a:request-3', '{"reason":"My reason","analyst":null}');
    window.sessionStorage.setItem('other-app-key', 'kept');

    clearOtherOwnersSessionDrafts('owner-a');

    expect(Object.keys(window.sessionStorage).sort()).toEqual([
      'csrm-draft:assign:owner-a:request-3',
      'csrm-draft:note:owner-a:request-1',
      'other-app-key',
    ]);
  });

  it('tolerates a browser whose session storage is unavailable', () => {
    vi.spyOn(window, 'sessionStorage', 'get').mockImplementation(() => { throw new DOMException('denied', 'SecurityError'); });
    expect(() => clearOtherOwnersSessionDrafts('owner-a')).not.toThrow();
  });

  it('is loaded only by the modules that keep text, never by the shell', () => {
    const shellStore = readFileSync(resolve(process.cwd(), 'src/lib/session-drafts/session-drafts.ts'), 'utf8');
    expect(shellStore).not.toContain('clearOtherOwnersSessionDrafts');
    for (const user of ['src/features/request-assignment/assign-picker.tsx', 'src/features/request-notes/note-composer.tsx']) {
      expect(readFileSync(resolve(process.cwd(), user), 'utf8')).toContain("from '@/lib/session-drafts/session-draft-owners'");
    }
  });
});
