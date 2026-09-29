import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getToken: vi.fn(),
  auth: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }));
vi.mock('./oidc-auth', () => ({ auth: mocks.auth }));
vi.mock('next-auth/providers/keycloak', () => ({ default: vi.fn() }));
vi.mock('@/lib/api/transport/keycloak-token-client', () => ({ refreshKeycloakTokens: vi.fn() }));

import { applySetCookies, refreshedSessionCookies } from './oidc-session-refresh';

const nowSeconds = 1_800_000_000;
const now = () => nowSeconds * 1000;

beforeEach(() => {
  for (const [name, value] of Object.entries({
    AUTH_URL: 'http://localhost:3000',
    AUTH_SECRET: 'sentinel-auth-secret-0123456789-0123456789',
    AUTH_KEYCLOAK_ID: 'idambox-csrm',
    AUTH_KEYCLOAK_SECRET: 'sentinel-client-secret-0123456789',
    AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox',
  })) vi.stubEnv(name, value);
  mocks.getToken.mockReset();
  mocks.auth.mockReset().mockImplementation(async ({ res }: { res: { headers: Headers } }) => {
    res.headers.append('set-cookie', 'authjs.session-token=refreshed; Path=/; HttpOnly');
    return { user: {} };
  });
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('refreshedSessionCookies', () => {
  it('runs the Auth.js session read and returns its cookies when the access token is inside its refresh window', async () => {
    mocks.getToken.mockResolvedValueOnce({ accessToken: 'a', refreshToken: 'r', accessTokenExpiresAt: nowSeconds + 30 });

    await expect(refreshedSessionCookies(new NextRequest('http://localhost:3000/app'), now)).resolves.toEqual([
      'authjs.session-token=refreshed; Path=/; HttpOnly',
    ]);
    expect(mocks.auth).toHaveBeenCalledTimes(1);
  });

  it('writes nothing while the access token is fresh, after a failed refresh, or with no session', async () => {
    for (const token of [
      { accessToken: 'a', refreshToken: 'r', accessTokenExpiresAt: nowSeconds + 3600 },
      { error: 'RefreshTokenError' },
      null,
    ]) {
      mocks.getToken.mockResolvedValueOnce(token);
      await expect(refreshedSessionCookies(new NextRequest('http://localhost:3000/app'), now)).resolves.toEqual([]);
    }
    expect(mocks.auth).not.toHaveBeenCalled();
  });

  it('never runs for a server action or an Auth.js route, where it would race the cookie they write', async () => {
    const action = new NextRequest('http://localhost:3000/app', { method: 'POST', headers: { 'next-action': 'sign-out' } });
    const callback = new NextRequest('http://localhost:3000/api/auth/callback/keycloak');

    await expect(refreshedSessionCookies(action, now)).resolves.toEqual([]);
    await expect(refreshedSessionCookies(callback, now)).resolves.toEqual([]);
    expect(mocks.getToken).not.toHaveBeenCalled();
  });
});

describe('applySetCookies', () => {
  it('replaces, adds and removes cookies the way the browser would', () => {
    expect(applySetCookies('a=1; session=old; session.1=chunk', [
      'session=new; Path=/; HttpOnly',
      'session.1=; Path=/; Max-Age=0',
      'added=yes; Path=/',
    ])).toBe('a=1; session=new; added=yes');
  });

  it('treats a past Expires as a removal and returns null when nothing is left', () => {
    expect(applySetCookies('session=old', ['session=; Path=/; Expires=Thu, 01 Jan 1970 00:00:00 GMT'])).toBeNull();
    expect(applySetCookies(null, [])).toBeNull();
  });
});
