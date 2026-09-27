import 'server-only';

import type { Metadata } from 'next';
import { notFound } from 'next/navigation';

/*
 * The document title of a record route (WCAG 2.4.2 Page Titled). The title names the page, never the
 * record, so a refused or failed read keeps it. A record the read reports missing takes the in-shell
 * not-found's title, `Page not found | IdamBox CSRM`, instead: a record page streams, so the notFound()
 * its body raises comes too late to change a title already resolved, but a notFound() raised while the
 * metadata resolves makes Next render the not-found convention's metadata in its place
 * (next/dist/lib/metadata/metadata.js, getNotFoundMetadata). The HTTP status stays the streamed 200,
 * with Next's noindex tag (not-found.md, "Calling notFound() after streaming has started").
 *
 * `read` must be the page's own read wrapped in React's cache(), so the check costs no second request.
 */
export async function recordRouteMetadata(
  read: Promise<{ error: { status?: number } | null }>,
  title: string,
): Promise<Metadata> {
  if ((await read).error?.status === 404) notFound();
  return { title };
}
