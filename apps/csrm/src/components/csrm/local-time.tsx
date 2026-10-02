'use client';

import { createContext, useContext, useEffect, useRef, type ReactNode } from 'react';

import { formatInstant, isValidTimeZone, type InstantStyle } from '@/lib/time/format-instant';
import { syncViewerTimeZoneAction } from '@/lib/time/time-zone-actions';

/*
 * The viewer's time zone on the client (D-19). The app layout reads the zone cookie on the server
 * and the shell provides it here, so the server render and the hydrated client format an instant
 * the same way. Outside a provider the zone is unknown and times render in UTC with the label.
 */

const ViewerTimeZoneContext = createContext<string | null>(null);

export function TimeZoneProvider({ zone, children }: { zone: string | null; children: ReactNode }) {
  return <ViewerTimeZoneContext value={zone}>{children}</ViewerTimeZoneContext>;
}

/** The viewer's IANA time zone, or null while it is unknown. */
export function useViewerTimeZone(): string | null {
  return useContext(ViewerTimeZoneContext);
}

/**
 * An instant in the viewer's zone inside a `<time>` element, or `fallback` when it is missing or invalid.
 *
 * The server (Node's ICU) and the browser (its own ICU and CLDR) can word the same instant differently, for
 * example `Sep` or `Sept`, or a narrow no-break space before `pm`. The zone is shared, so both are the same
 * instant: `suppressHydrationWarning` keeps the server's wording instead of raising a hydration error that would
 * client-render the page (WR-304). It covers this element's own text only, and `dateTime` stays machine-readable.
 * Rendering only after mount was not chosen: the server-rendered time is the useful first paint.
 */
export function LocalInstant({ value, style, fallback = null }: {
  value: string | null | undefined;
  style: InstantStyle;
  fallback?: ReactNode;
}) {
  const zone = useViewerTimeZone();
  const text = formatInstant(value, { zone, style });
  return value && text !== null ? <time dateTime={value} suppressHydrationWarning>{text}</time> : <>{fallback}</>;
}

/**
 * Sends the browser's zone to the server once per app load when it differs from the cookie
 * (UI-SPEC §4.5). The action sets the cookie, and a Server Action that sets a cookie makes Next
 * re-render the current route and its layouts in the same round trip, so the page refreshes in
 * place with local times. A second `router.refresh()` would only render the page again and abort
 * the first response. It renders nothing, moves no focus and announces nothing. A failed or refused
 * sync leaves times labelled UTC, which stays truthful.
 */
export function ViewerTimeZoneSync() {
  const zone = useViewerTimeZone();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const browserZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(browserZone) || browserZone === zone) return;

    syncViewerTimeZoneAction(browserZone).catch(() => undefined);
  }, [zone]);

  return null;
}
