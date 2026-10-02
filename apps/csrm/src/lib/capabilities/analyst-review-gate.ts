import 'server-only';

import { cache } from 'react';

import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';

/**
 * Whether the viewer may open the analyst review routes (10-CONTEXT D-23, 07 D-16). The three analyst
 * detail routes and their metadata await this before any record read, so a Requestor gets the route's
 * permission state and static title, and an existing id looks the same as a missing one.
 *
 * The check is presentation only: Strapi authorises every read and refuses an analyst operation to a
 * Requestor itself. React's cache() lets a route's metadata and page share one session read per request.
 */
export const canViewerReviewAssessments = cache(async (): Promise<boolean> => {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();
  const granted = session ? await sessionAdapter.capabilitiesFor(session).granted() : new Set<Capability>();
  return can('assessment:review', granted);
});
