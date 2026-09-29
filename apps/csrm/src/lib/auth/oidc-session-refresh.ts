import 'server-only';

import type { NextRequest } from 'next/server';
import { accessTokenNeedsRefresh } from './oidc-auth-options';
import { readOidcConfiguration } from './oidc-configuration';

type SessionReader = (context: { req: NextRequest; res: { headers: Headers } }) => Promise<unknown>;

/**
 * Persists a Keycloak token refresh (docs/adr/0004). A Server Component can read the
 * Auth.js session but cannot write cookies, so a refresh made while rendering would
 * be lost. The proxy calls this first: when the access token is inside its refresh
 * window, it runs the Auth.js session read (whose jwt callback refreshes) and returns
 * the resulting Set-Cookie values, which the proxy both sends to the browser and
 * forwards on this request, so the render reads the refreshed token.
 *
 * Nothing is written for any other request. Auth.js re-issues the session cookie on
 * every read, so writing unconditionally would race sign-out, a server action that
 * clears that cookie; server actions and Auth.js's own routes are skipped for the
 * same reason.
 */
export async function refreshedSessionCookies(request: NextRequest, now: () => number = Date.now): Promise<string[]> {
  if (request.headers.has('next-action') || request.nextUrl.pathname.startsWith('/api/auth/')) return [];

  const config = readOidcConfiguration(process.env);
  const { getToken } = await import('next-auth/jwt');
  const token = await getToken({
    req: request,
    secret: config.authSecret,
    secureCookie: new URL(config.authUrl).protocol === 'https:',
  });
  if (!token || !accessTokenNeedsRefresh(token, Math.floor(now() / 1000))) return [];

  const { auth } = await import('./oidc-auth');
  const response = { headers: new Headers() };
  // Auth.js's route-handler form: reads the session and appends its Set-Cookie values to `res`.
  await (auth as unknown as SessionReader)({ req: request, res: response });
  return response.headers.getSetCookie();
}

function isDeletion(attributes: string[]): boolean {
  return attributes.some((attribute) => {
    const [name, value = ''] = attribute.split('=').map((part) => part.trim());
    if (name?.toLowerCase() === 'max-age') return Number(value) <= 0;
    if (name?.toLowerCase() === 'expires') return Date.parse(value) <= Date.now();
    return false;
  });
}

/**
 * Applies Set-Cookie values to a request Cookie header, as the browser would on its
 * next request: a set replaces or adds the cookie, an expiry removes it (Auth.js
 * clears stale session chunks that way). Returns null when no cookie remains.
 */
export function applySetCookies(cookieHeader: string | null, setCookies: readonly string[]): string | null {
  const cookies = new Map<string, string>();
  for (const pair of (cookieHeader ?? '').split(';')) {
    const separator = pair.indexOf('=');
    if (separator > 0) cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
  }

  for (const setCookie of setCookies) {
    const [pair = '', ...attributes] = setCookie.split(';');
    const separator = pair.indexOf('=');
    if (separator <= 0) continue;
    const name = pair.slice(0, separator).trim();
    if (isDeletion(attributes)) cookies.delete(name);
    else cookies.set(name, pair.slice(separator + 1).trim());
  }

  return cookies.size === 0 ? null : [...cookies].map(([name, value]) => `${name}=${value}`).join('; ');
}
