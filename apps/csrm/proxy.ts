import { NextResponse, type NextRequest, type ProxyConfig } from 'next/server';

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
export function proxy(request: NextRequest): NextResponse {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const policy = buildContentSecurityPolicy({
    nonce,
    development: process.env.NODE_ENV === 'development',
    // Next reports https when the socket is TLS or a proxy in front sets x-forwarded-proto: https.
    https: request.nextUrl.protocol === 'https:',
  });

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', policy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', policy);
  return response;
}

/*
 * Static files and optimised images carry no document, and a router prefetch renders none either,
 * so they skip the proxy (the matcher the Next CSP guide recommends). The app has no /api routes.
 * Each exclusion names one real path and nothing that merely starts like it: the static directory
 * with its slash, the image optimiser and the favicon exactly (the matcher tests the path without
 * its query). Any other URL renders a document, the not-found page at least, and needs the policy
 * (SR-05).
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
  ],
} satisfies ProxyConfig;
