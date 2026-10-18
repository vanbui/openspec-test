'use client';

import { useEffect } from 'react';

import { leavingOnPurpose } from '@/lib/session-drafts/session-drafts';

/*
 * The browser's own warning before the tab closes, reloads or leaves the app (13-UI-SPEC §9.3, UI-D18), for text kept
 * in the session store: that text survives in-app navigation, so only the `beforeunload` prompt is armed, never the
 * leave guard's in-app dialog (navigation-guard.tsx). It lives apart from the shell's guard so it reaches only the
 * lazily loaded modules that keep text (the assign picker, then the note composer), and no route's first load grows
 * (performance.spec.ts; plan 13-09 "Budget").
 */
export function useUnloadWarning(active: boolean): void {
  useEffect(() => {
    if (!active) return undefined;
    /* Once the person has chosen Sign out and its text is discarded, the redirect is not asked about again (WR-401). */
    const warn = (event: BeforeUnloadEvent) => {
      if (!leavingOnPurpose()) event.preventDefault();
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [active]);
}
