import 'server-only';

import { cookies } from 'next/headers';

import { isValidTimeZone, VIEWER_TIME_ZONE_COOKIE } from './format-instant';

export { VIEWER_TIME_ZONE_COOKIE };

/**
 * The viewer's time zone from the cookie the shell's zone sync writes, or null while it is unknown.
 * The cookie is client-controlled, so a value that is not a valid IANA zone counts as unknown
 * rather than reaching a formatter that would throw on every page (T-10-01).
 */
export async function readViewerTimeZone(): Promise<string | null> {
  const value = (await cookies()).get(VIEWER_TIME_ZONE_COOKIE)?.value;
  return isValidTimeZone(value) ? value : null;
}
