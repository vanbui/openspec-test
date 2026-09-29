import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  redirect: vi.fn(),
  authFactoryCalls: { count: 0 },
  auth: vi.fn(),
  signIn: vi.fn(),
  signOut: vi.fn(),
  handlers: { GET: vi.fn(), POST: vi.fn() },
  headers: vi.fn(),
  getToken: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({ headers: mocks.headers }));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));
vi.mock('next-auth/jwt', () => ({ getToken: mocks.getToken }));
vi.mock('./oidc-auth', () => {
  mocks.authFactoryCalls.count += 1;
  return {
    auth: mocks.auth,
    signIn: mocks.signIn,
    signOut: mocks.signOut,
    handlers: mocks.handlers,
  };
});

class RedirectSignal extends Error {
  constructor(readonly location: string) {
    super(`NEXT_REDIRECT ${location}`);
  }
}

const unavailableMessage = 'Session authentication is not configured.';

const runtimeDirectories: string[] = [];

function attestRuntime(): void {
  const parent = join(tmpdir(), 'csrm-playwright-e2e');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'oidc-session-'));
  runtimeDirectories.push(root);
  const path = join(root, 'attestation.json');
  writeFileSync(path, JSON.stringify({ nonce: 'oidc-session-nonce', createdAt: new Date().toISOString() }));
  vi.stubEnv('CSRM_E2E_RUNTIME_ROOT', root);
  vi.stubEnv('CSRM_E2E_RUNTIME_ATTESTATION_PATH', path);
  vi.stubEnv('CSRM_E2E_RUNTIME_NONCE', 'oidc-session-nonce');
}

function stubOidcMode(): void {
  vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'true');
  vi.stubEnv('NODE_ENV', 'development');
}

const localAuthEnv = {
  AUTH_URL: 'http://localhost:3000',
  AUTH_SECRET: 'sentinel-auth-secret-0123456789-0123456789',
  AUTH_KEYCLOAK_ID: 'idambox-csrm',
  AUTH_KEYCLOAK_SECRET: 'sentinel-client-secret-0123456789',
  AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox',
} as const;

function stubLocalAuthEnv(): void {
  for (const [name, value] of Object.entries(localAuthEnv)) vi.stubEnv(name, value);
}

beforeEach(() => {
  mocks.authFactoryCalls.count = 0;
  mocks.redirect.mockReset().mockImplementation((location: string) => {
    throw new RedirectSignal(location);
  });
  mocks.auth.mockReset();
  mocks.signIn.mockReset();
  mocks.signOut.mockReset().mockResolvedValue(undefined);
  mocks.handlers.GET.mockReset().mockResolvedValue(new Response('get-ok'));
  mocks.handlers.POST.mockReset().mockResolvedValue(new Response('post-ok'));
  mocks.headers.mockReset().mockResolvedValue(new Headers());
  mocks.getToken.mockReset();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
  for (const directory of runtimeDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('resolveSessionRuntimeMode with the OIDC flag', () => {
  it('resolves oidc under next dev even when CSRM_DEV_IDENTITY is true', async () => {
    vi.resetModules();
    stubOidcMode();
    vi.stubEnv('CSRM_DEV_IDENTITY', 'true');
    const { resolveSessionRuntimeMode } = await import('./development-runtime');

    expect(resolveSessionRuntimeMode(process.env, 'development')).toBe('oidc');
  });

  it('resolves unavailable in a production build, including the attested E2E runtime', async () => {
    vi.resetModules();
    vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'true');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CSRM_ENVIRONMENT', 'development');
    vi.stubEnv('CSRM_DEV_IDENTITY', 'true');
    attestRuntime();
    const { resolveSessionRuntimeMode } = await import('./development-runtime');

    expect(resolveSessionRuntimeMode(process.env, 'production')).toBe('unavailable');
  });

  it('resolves development under next dev with the flag unset, unchanged', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    const { resolveSessionRuntimeMode } = await import('./development-runtime');

    expect(resolveSessionRuntimeMode(process.env, 'development')).toBe('development');
  });

  it('throws naming the flag for an invalid value', async () => {
    vi.resetModules();
    vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'yes');
    const { resolveSessionRuntimeMode } = await import('./development-runtime');

    expect(() => resolveSessionRuntimeMode(process.env, 'development')).toThrow('CSRM_AUTH_OIDC_ENABLED');
  });
});

describe('getSessionAdapter switching on the OIDC flag', () => {
  it('is the development adapter with the flag unset, and never loads ./oidc-auth', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    const { getSessionAdapter } = await import('./development-session-adapter');
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');

    const adapter = getSessionAdapter();

    expect(adapter).not.toBeInstanceOf(OidcSessionAdapter);
    expect(mocks.authFactoryCalls.count).toBe(0);
  });

  it('is an OidcSessionAdapter with the flag true, and the development adapter reports no session', async () => {
    vi.resetModules();
    stubOidcMode();
    const { getSessionAdapter } = await import('./development-session-adapter');
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');

    const adapter = getSessionAdapter();
    expect(adapter).toBeInstanceOf(OidcSessionAdapter);
  });
});

describe('OidcSessionAdapter.current', () => {
  it('resolves the display name from the Auth.js session user, falling back through email to a default', async () => {
    vi.resetModules();
    stubOidcMode();
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();

    mocks.auth.mockResolvedValueOnce({ user: { name: ' Jane Doe ' }, expires: '2026-09-30T00:00:00.000Z' });
    await expect(adapter.current()).resolves.toEqual({ displayName: 'Jane Doe' });

    mocks.auth.mockResolvedValueOnce({ user: { name: '', email: 'jane.doe@idambox.com' }, expires: '2026-09-30T00:00:00.000Z' });
    await expect(adapter.current()).resolves.toEqual({ displayName: 'jane.doe@idambox.com' });

    mocks.auth.mockResolvedValueOnce({ user: {}, expires: '2026-09-30T00:00:00.000Z' });
    await expect(adapter.current()).resolves.toEqual({ displayName: 'Signed-in user' });

    mocks.auth.mockResolvedValueOnce(null);
    await expect(adapter.current()).resolves.toBeNull();
  });

  it('never carries a developmentRole key', async () => {
    vi.resetModules();
    stubOidcMode();
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();
    mocks.auth.mockResolvedValueOnce({ user: { name: 'Jane Doe' }, expires: '2026-09-30T00:00:00.000Z' });

    const session = await adapter.current();
    expect(session).not.toBeNull();
    expect(session).not.toHaveProperty('developmentRole');
  });

  it('resolves null outside OIDC mode without loading Auth.js', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();

    await expect(adapter.current()).resolves.toBeNull();
    expect(mocks.authFactoryCalls.count).toBe(0);
  });
});

describe('OidcSessionAdapter capabilities and role', () => {
  it('grants no capability, fail-closed until Strapi resolves the identity', async () => {
    vi.resetModules();
    stubOidcMode();
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();

    await expect(adapter.capabilitiesFor({ displayName: 'Jane Doe' }).granted()).resolves.toEqual(new Set());
  });

  it('rejects setDevelopmentRole with the unavailable message', async () => {
    vi.resetModules();
    stubOidcMode();
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();

    await expect(adapter.setDevelopmentRole('Requestor')).rejects.toThrow(unavailableMessage);
  });
});

describe('OidcSessionAdapter.signIn', () => {
  it('redirects to the sign-in page with a validated return path', async () => {
    vi.resetModules();
    stubOidcMode();
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();

    await expect(adapter.signIn('/app/risks')).rejects.toThrow('NEXT_REDIRECT /sign-in?returnTo=%2Fapp%2Frisks');
  });
});

describe('startOidcSignIn', () => {
  it('calls the Auth.js signIn with the keycloak provider and a validated redirectTo', async () => {
    vi.resetModules();
    stubOidcMode();
    const { startOidcSignIn } = await import('./oidc-session-adapter');
    mocks.signIn.mockResolvedValueOnce(undefined);

    await expect(startOidcSignIn('/app/requests')).rejects.toThrow('Sign-in did not redirect.');
    expect(mocks.signIn).toHaveBeenCalledWith('keycloak', { redirectTo: '/app/requests' });
  });

  it('rewrites a hostile return path to the application root', async () => {
    vi.resetModules();
    stubOidcMode();
    const { startOidcSignIn } = await import('./oidc-session-adapter');
    mocks.signIn.mockResolvedValueOnce(undefined);

    await expect(startOidcSignIn('//evil.example')).rejects.toThrow('Sign-in did not redirect.');
    expect(mocks.signIn).toHaveBeenCalledWith('keycloak', { redirectTo: '/app' });
  });

  it('rejects outside OIDC mode without loading Auth.js', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    const { startOidcSignIn } = await import('./oidc-session-adapter');

    await expect(startOidcSignIn('/app')).rejects.toThrow(unavailableMessage);
    expect(mocks.authFactoryCalls.count).toBe(0);
  });

  it('propagates the redirect signal uncaught when Auth.js signIn redirects', async () => {
    vi.resetModules();
    stubOidcMode();
    const { startOidcSignIn } = await import('./oidc-session-adapter');
    mocks.signIn.mockImplementationOnce(() => {
      throw new RedirectSignal('/api/auth/signin/keycloak');
    });

    await expect(startOidcSignIn('/app')).rejects.toThrow('NEXT_REDIRECT /api/auth/signin/keycloak');
  });
});

describe('OidcSessionAdapter.signOut', () => {
  it('clears the Auth.js session then redirects to the Keycloak logout URL carrying the id_token_hint', async () => {
    vi.resetModules();
    stubOidcMode();
    stubLocalAuthEnv();
    mocks.getToken.mockResolvedValueOnce({ idToken: 'id-token-sentinel' });
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();

    await expect(adapter.signOut()).rejects.toThrow('NEXT_REDIRECT');

    expect(mocks.signOut).toHaveBeenCalledWith({ redirect: false });
    const signOutOrder = mocks.signOut.mock.invocationCallOrder[0]!;
    const redirectOrder = mocks.redirect.mock.invocationCallOrder[0]!;
    expect(signOutOrder).toBeLessThan(redirectOrder);

    const [location] = mocks.redirect.mock.calls[0] as [string];
    const url = new URL(location);
    expect(`${url.origin}${url.pathname}`).toBe('http://localhost:8080/realms/idambox/protocol/openid-connect/logout');
    expect(url.searchParams.get('client_id')).toBe('idambox-csrm');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000');
    expect(url.searchParams.get('id_token_hint')).toBe('id-token-sentinel');
  });

  it('omits id_token_hint when getToken returns null', async () => {
    vi.resetModules();
    stubOidcMode();
    stubLocalAuthEnv();
    mocks.getToken.mockResolvedValueOnce(null);
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();

    await expect(adapter.signOut()).rejects.toThrow('NEXT_REDIRECT');

    const [location] = mocks.redirect.mock.calls[0] as [string];
    const url = new URL(location);
    expect(url.searchParams.get('client_id')).toBe('idambox-csrm');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000');
    expect(url.searchParams.has('id_token_hint')).toBe(false);
  });

  it('rejects outside OIDC mode without loading Auth.js', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    const { OidcSessionAdapter } = await import('./oidc-session-adapter');
    const adapter = new OidcSessionAdapter();

    await expect(adapter.signOut()).rejects.toThrow(unavailableMessage);
    expect(mocks.authFactoryCalls.count).toBe(0);
  });
});

describe('the development and unavailable adapters reject signOut', () => {
  it('DevelopmentSessionAdapter.signOut rejects with the unavailable message', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    const { getSessionAdapter } = await import('./development-session-adapter');

    await expect(getSessionAdapter().signOut()).rejects.toThrow(unavailableMessage);
  });

  it('the unavailable adapter signOut rejects with the unavailable message', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'production');
    const { getSessionAdapter } = await import('./development-session-adapter');

    await expect(getSessionAdapter().signOut()).rejects.toThrow(unavailableMessage);
  });
});

describe('handleOidcAuthRequest', () => {
  it('answers 404 with the flag unset, without loading Auth.js', async () => {
    vi.resetModules();
    vi.stubEnv('NODE_ENV', 'development');
    const { handleOidcAuthRequest } = await import('./oidc-session-adapter');

    const response = await handleOidcAuthRequest({} as never, 'GET');

    expect(response.status).toBe(404);
    expect(mocks.authFactoryCalls.count).toBe(0);
  });

  it('delegates GET and POST to the Auth.js handlers under next dev with the flag true', async () => {
    vi.resetModules();
    stubOidcMode();
    const { handleOidcAuthRequest } = await import('./oidc-session-adapter');
    const request = { method: 'GET' } as never;

    const getResponse = await handleOidcAuthRequest(request, 'GET');
    expect(await getResponse.text()).toBe('get-ok');
    expect(mocks.handlers.GET).toHaveBeenCalledWith(request);

    const postResponse = await handleOidcAuthRequest(request, 'POST');
    expect(await postResponse.text()).toBe('post-ok');
    expect(mocks.handlers.POST).toHaveBeenCalledWith(request);
  });
});
