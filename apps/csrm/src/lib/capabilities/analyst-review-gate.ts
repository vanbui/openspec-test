import 'server-only';

import { cache } from 'react';

import { can } from '@/lib/capabilities/capability-adapter';
import { viewerCapabilities } from '@/lib/capabilities/viewer-capabilities';

/**
 * Whether the viewer may open the analyst review routes (10-CONTEXT D-23, 07 D-16). The three analyst
 * detail routes, their metadata and the review lists await this before any record read, so a Requestor gets the route's
 * permission state and static title, and an existing id looks the same as a missing one.
 *
 * The check is presentation only: Strapi authorises every read and refuses an analyst operation to a
 * Requestor itself. React's cache() lets a route's metadata and page share one session read per request.
 */
export const canViewerReviewAssessments = cache(async (): Promise<boolean> => can('assessment:review', await viewerCapabilities()));
