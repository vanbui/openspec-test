import { SESSION_DRAFT_PREFIX } from './session-drafts';

/*
 * Other people's kept drafts (IN-402; T-13-32). Sign out clears every draft in the tab, but a session can also end
 * without it: it expires, Keycloak signs the person out in another tab, the form posts before the page hydrates, or a
 * development role switch changes who is signed in. The owner key keeps that text out of the next person's screens
 * already; this removes it from the store too, whenever a module that keeps text (the note composer, the assign
 * picker) opens for a signed-in person. It lives apart from session-drafts.ts, which the shell loads on every route.
 */
export function clearOtherOwnersSessionDrafts(ownerKey: string): void {
  try {
    const store = window.sessionStorage;
    const keys = Array.from({ length: store.length }, (_, index) => store.key(index) ?? '');
    for (const key of keys) {
      if (key.startsWith(SESSION_DRAFT_PREFIX) && key.split(':')[2] !== ownerKey) store.removeItem(key);
    }
  } catch {
    /* No usable store: nothing is kept, so nothing is left behind. */
  }
}
