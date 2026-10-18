import 'server-only';

import { cache } from 'react';

import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import type { Capability } from '@/lib/capabilities/capability-adapter';

/**
 * The signed-in viewer's capabilities, read as Home reads them (app/(app)/app/page.tsx): the session, then its granted
 * set; no session grants nothing. React's cache() lets a route's gate and its list's Export share one session read per
 * request. Presentation only: Strapi authorises every read and every export (D-16).
 */
export const viewerCapabilities = cache(async (): Promise<ReadonlySet<Capability>> => {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  return session ? sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
});
