import type { NextRequest } from 'next/server';

/*
 * The Server Action body gate (Phase 14 D-25; 14-RESEARCH Settled 6, Code Example 1; T-14-49; stage B CR-401, CR-402,
 * WR-601, IN-401).
 *
 * A file of up to 25 MB is sent to Strapi through one Server Action, so Next's two body limits are raised to 26 MB in
 * next.config.ts: `serverActions.bodySizeLimit`, and `proxyClientMaxBodySize`, without which the proxy's clone of a
 * body over 10 MB cuts it short and the action receives a truncated file with no error (Pitfall 1). Both limits are
 * global, so this gate keeps the ceiling every other page had. proxy.ts calls it first, for every request that declares
 * a body, and it answers 413 before Next reads the body.
 *
 * It holds every POST, not only those carrying `Next-Action`: Next treats any POST with a multipart or urlencoded body
 * as a possible Server Action and reads it up to the global limit before it knows whether an action exists
 * (`server-action-request-meta.js`). So:
 * - a request that is not a POST is admitted (Next dispatches Server Actions on POST only);
 * - on the four attachment pages, a `multipart/form-data` POST is admitted whatever its length: Next's 26 MB limit and
 *   the reverse proxy bound it (IN-401);
 * - every other POST, on any path, is refused when its declared `Content-Length` is absent, blank, not a decimal
 *   integer, or over 6,291,456 bytes.
 *
 * No POST is exempt. Browsers send `Content-Length` with every POST body, and `Content-Length: 0` for a POST with none
 * (the Fetch standard), and the only `/api` routes are Auth.js's (OIDC mode only), whose posts are small form bodies.
 *
 * The deployment's reverse proxy keeps a per-path limit of its own, the outer layer (R-08-04). Plain module, no
 * directive: next.config.ts imports the limit from here, so the two can never disagree.
 */

/** The ceiling every page but the attachment pages keeps: Next's former `'6mb'`. */
export const DEFAULT_ACTION_BODY_LIMIT_BYTES = 6_291_456;

/** One 25 MiB file plus the multipart overhead (27,262,976 bytes), for both of Next's limits. */
export const ATTACHMENT_ACTION_BODY_LIMIT = '26mb';

/**
 * The pages that hold the file field (14-UI-SPEC §2, §3): a request page, which also matches `/app/requests/new`, the
 * draft's edit form, and the analyst's request page.
 */
export const ATTACHMENT_ACTION_PATHS: readonly RegExp[] = [
  /^\/app\/requests\/[^/]+$/,
  /^\/app\/requests\/[^/]+\/edit$/,
  /^\/app\/review\/requests\/[^/]+$/,
];

const DECIMAL_LENGTH = /^[0-9]+$/;

/**
 * True for a POST the proxy refuses unread: over the default ceiling or unmeasured, unless it is a multipart post on an
 * attachment page.
 */
export function exceedsActionBodyLimit(request: Pick<NextRequest, 'method' | 'headers' | 'nextUrl'>): boolean {
  if (request.method !== 'POST') return false;
  if (isMultipartFormData(request.headers.get('content-type')) && isAttachmentPage(request.nextUrl.pathname)) return false;
  const declared = request.headers.get('content-length')?.trim() ?? '';
  return !DECIMAL_LENGTH.test(declared) || Number(declared) > DEFAULT_ACTION_BODY_LIMIT_BYTES;
}

function isAttachmentPage(pathname: string): boolean {
  return ATTACHMENT_ACTION_PATHS.some((pattern) => pattern.test(pathname));
}

/** The media type, without its parameters (the boundary) and whatever its case (RFC 9110 §8.3.1). */
function isMultipartFormData(contentType: string | null): boolean {
  return (contentType?.split(';', 1)[0] ?? '').trim().toLowerCase() === 'multipart/form-data';
}
