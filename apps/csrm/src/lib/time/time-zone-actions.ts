'use server';

import { cookies, headers } from 'next/headers';

import { isValidTimeZone, VIEWER_TIME_ZONE_COOKIE } from './format-instant';

const oneYearInSeconds = 60 * 60 * 24 * 365;

/**
 * Secure exactly when the request arrived over TLS, which a proxy reports in the first
 * `x-forwarded-proto` value: the rule the session cookie uses, so the plain-HTTP E2E origin still
 * receives the cookie.
 */
async function requestUsesHttps(): Promise<boolean> {
  const forwardedProtocol = (await headers()).get('x-forwarded-proto');
  return forwardedProtocol?.split(',')[0]?.trim() === 'https';
}

/**
 * Stores the browser's time zone for server rendering (D-19). The value is untrusted input, so
 * anything but a valid IANA zone is refused and nothing is written; the result never echoes it.
 * The cookie holds a public zone name only and never feeds authorisation (T-10-03).
 */
export async function syncViewerTimeZoneAction(zone: unknown): Promise<{ ok: boolean }> {
  if (!isValidTimeZone(zone)) return { ok: false };

  const secure = await requestUsesHttps();
  (await cookies()).set(VIEWER_TIME_ZONE_COOKIE, zone, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    path: '/',
    maxAge: oneYearInSeconds,
  });
  return { ok: true };
}
