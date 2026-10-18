import { NextResponse, type NextRequest, type ProxyConfig } from 'next/server';

import { resolveSessionRuntimeMode } from '@/lib/auth/development-runtime';
import { exceedsActionBodyLimit } from '@/lib/security/action-body-limit';
import { buildContentSecurityPolicy } from '@/lib/security/content-security-policy';

/*
 * The per-request Content-Security-Policy (D-19, D-42; docs/security/web-headers.md).
 *
 * Every page is rendered per request (the signed-in shell is force-dynamic and the sign-in page
 * reads its search parameters), so each response gets a fresh nonce. Next reads the nonce from the
 * request's Content-Security-Policy header while it renders and puts it on its own scripts, which is
 * why the policy is set on the request (with the nonce as x-nonce, for a server component that
 * needs it) as well as on the response the browser enforces. Next strips the forwarded request
 * headers from the response.
 *
 * The static headers (HSTS, nosniff, Referrer-Policy, X-Frame-Options, Permissions-Policy, COOP)
 * come from next.config.ts for every path, before this runs, so the requests the matcher skips keep
 * them.
 */
export async function proxy(request: NextRequest): Promise<NextResponse> {
  /*
   * D-25 (CR-401, IN-401): the body gate runs first, for every request the matcher sends here. A POST over 6 MB, or one
   * that does not say how long it is, is refused unread, unless it is a multipart post on a page that adds files.
   */
  if (exceedsActionBodyLimit(request)) return new NextResponse(null, { status: 413 });
  if (resolveSessionRuntimeMode(process.env) === 'oidc') return oidcProxy(request);
  return withContentSecurityPolicy(request, new Headers(request.headers));
}

/*
 * OIDC mode only (docs/adr/0004): a Keycloak access token inside its refresh window is
 * refreshed here, where cookies can be written, and the new session cookie is also
 * forwarded on this request so the render reads it. Auth.js loads only through the
 * dynamic import, never on the development path (ADR 0003).
 */
async function oidcProxy(request: NextRequest): Promise<NextResponse> {
  const { applySetCookies, refreshedSessionCookies } = await import('@/lib/auth/oidc-session-refresh');
  const setCookies = await refreshedSessionCookies(request);
  const requestHeaders = new Headers(request.headers);

  if (setCookies.length > 0) {
    const cookie = applySetCookies(request.headers.get('cookie'), setCookies);
    if (cookie === null) requestHeaders.delete('cookie');
    else requestHeaders.set('cookie', cookie);
  }

  const response = withContentSecurityPolicy(request, requestHeaders);
  for (const setCookie of setCookies) response.headers.append('set-cookie', setCookie);
  return response;
}

function withContentSecurityPolicy(request: NextRequest, requestHeaders: Headers): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = buildContentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === 'development',
    // Next reports https when the socket is TLS or a proxy in front sets x-forwarded-proto: https.
    https: request.nextUrl.protocol === 'https:',
  });

  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

/*
 * Static files and optimised images carry no document, so they skip the proxy. Each exclusion
 * names one real path and nothing that merely starts like it: the static directory with its slash,
 * the image optimiser and the favicon exactly (the matcher tests the path without its query). Any
 * other URL renders a document, the not-found page at least, and needs the policy (SR-05). The
 * only /api route is Auth.js's `/api/auth/*` (OIDC mode only, ADR 0003; 404 otherwise); it renders
 * no document and still receives the policy like any other response.
 *
 * A prefetch (`next-router-prefetch`, or `purpose: prefetch`) renders no document either, so it
 * skips the proxy, as the Next CSP guide recommends: no policy work and no session refresh. That
 * holds only while it declares no body (neither `Content-Length` nor `Transfer-Encoding`; under
 * HTTP/1.1, all Next's server speaks, a request with neither has none). A prefetch-headed request
 * that declares a body runs the proxy like any other, so the body gate sees every request with a
 * body whatever headers it carries (CR-402). The exemption has to live here: Next strips the
 * router's prefetch header from the request before proxy() reads it, so inside the function a
 * router prefetch looks like any other GET. Matcher values must be literals (Next reads them at
 * build time), so the path pattern is repeated.
 */
export const config = {
  matcher: [
    {
      source: '/((?!_next/static/|_next/image$|icon\\.png$).*)',
      missing: [
        { type: 'header', key: 'next-router-prefetch' },
        { type: 'header', key: 'purpose', value: 'prefetch' },
      ],
    },
    { source: '/((?!_next/static/|_next/image$|icon\\.png$).*)', has: [{ type: 'header', key: 'content-length' }] },
    { source: '/((?!_next/static/|_next/image$|icon\\.png$).*)', has: [{ type: 'header', key: 'transfer-encoding' }] },
  ],
} satisfies ProxyConfig;
