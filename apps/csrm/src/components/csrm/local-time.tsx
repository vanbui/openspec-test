'use client';

import { useRouter } from 'next/navigation';
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

/** An instant in the viewer's zone inside a `<time>` element, or `fallback` when it is missing or invalid. */
export function LocalInstant({ value, style, fallback = null }: {
  value: string | null | undefined;
  style: InstantStyle;
  fallback?: ReactNode;
}) {
  const zone = useViewerTimeZone();
  const text = formatInstant(value, { zone, style });
  return value && text !== null ? <time dateTime={value}>{text}</time> : <>{fallback}</>;
}

/**
 * Sends the browser's zone to the server once per app load when it differs from the cookie, then
 * refreshes the route so the server renders local times (UI-SPEC §4.5). It renders nothing, moves
 * no focus and announces nothing. A failed or refused sync leaves times labelled UTC, which stays
 * truthful.
 */
export function ViewerTimeZoneSync() {
  const zone = useViewerTimeZone();
  const router = useRouter();
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const browserZone = new Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!isValidTimeZone(browserZone) || browserZone === zone) return;

    syncViewerTimeZoneAction(browserZone).then(
      (result) => { if (result.ok) router.refresh(); },
      () => undefined,
    );
  }, [router, zone]);

  return null;
}
