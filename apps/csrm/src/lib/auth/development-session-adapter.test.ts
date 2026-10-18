import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const mocks = vi.hoisted(() => ({
  cookieStore: { get: vi.fn(), set: vi.fn() },
  requestHeaders: new Map<string, string>(),
  redirect: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: async () => mocks.cookieStore,
  headers: async () => ({ get: (name: string) => mocks.requestHeaders.get(name.toLowerCase()) ?? null }),
}));
vi.mock('next/navigation', () => ({ redirect: mocks.redirect }));

import { developmentFixtureIdentityForRole, getSessionAdapter } from './development-session-adapter';
import { developmentRoles, parseDevelopmentRole } from './session-adapter';
import { DevelopmentCapabilityAdapter } from '@/lib/capabilities/development-capabilities';

/** Next's redirect never returns; the mock throws the way the real one does. */
class RedirectSignal extends Error {
  constructor(readonly location: string) {
    super(`NEXT_REDIRECT ${location}`);
  }
}

const cookieName = 'csrm-development-role';
const unavailableMessage = 'Session authentication is not configured.';
const productionOnlyVariables = [
  'CSRM_ENVIRONMENT',
  'CSRM_DEV_IDENTITY',
  'CSRM_E2E_RUNTIME_ROOT',
  'CSRM_E2E_RUNTIME_ATTESTATION_PATH',
  'CSRM_E2E_RUNTIME_NONCE',
  'CSRM_E2E_UI_STATE_HARNESS',
] as const;
const runtimeDirectories: string[] = [];

function attestRuntime(): void {
  const parent = join(tmpdir(), 'csrm-playwright-e2e');
  mkdirSync(parent, { recursive: true });
  const root = mkdtempSync(join(parent, 'session-'));
  runtimeDirectories.push(root);
  const path = join(root, 'attestation.json');
  writeFileSync(path, JSON.stringify({ nonce: 'session-nonce', createdAt: new Date().toISOString() }));
  vi.stubEnv('CSRM_E2E_RUNTIME_ROOT', root);
  vi.stubEnv('CSRM_E2E_RUNTIME_ATTESTATION_PATH', path);
  vi.stubEnv('CSRM_E2E_RUNTIME_NONCE', 'session-nonce');
}

function stubProductionBuild(): void {
  vi.stubEnv('NODE_ENV', 'production');
}

function stubProductionGates(): void {
  stubProductionBuild();
  vi.stubEnv('CSRM_ENVIRONMENT', 'development');
  vi.stubEnv('CSRM_DEV_IDENTITY', 'true');
}

beforeEach(() => {
  mocks.cookieStore.get.mockReset();
  mocks.cookieStore.set.mockReset();
  mocks.requestHeaders.clear();
  mocks.redirect.mockReset().mockImplementation((location: string) => {
    throw new RedirectSignal(location);
  });
  for (const variable of productionOnlyVariables) vi.stubEnv(variable, undefined);
});

afterEach(() => {
  vi.unstubAllEnvs();
  for (const directory of runtimeDirectories.splice(0)) rmSync(directory, { recursive: true, force: true });
});

describe('getSessionAdapter under a production build outside the attested runtime', () => {
  it.each([
    ['no development variable at all', stubProductionBuild],
    ['the two development variables but no attestation', stubProductionGates],
  ])('resolves no session and sends the visitor to the sign-in page with %s', async (_scenario, configure) => {
    configure();
    const adapter = getSessionAdapter();

    await expect(adapter.current()).resolves.toBeNull();
    expect(mocks.cookieStore.get).not.toHaveBeenCalled();

    await expect(adapter.signIn('/app')).rejects.toThrow('NEXT_REDIRECT /sign-in?returnTo=%2Fapp');
    expect(mocks.redirect).toHaveBeenCalledWith('/sign-in?returnTo=%2Fapp');
  });

  it('only carries a validated internal return path to the sign-in page', async () => {
    stubProductionBuild();
    const adapter = getSessionAdapter();

    await expect(adapter.signIn('https://example.test/app')).rejects.toThrow('NEXT_REDIRECT /sign-in?returnTo=%2Fapp');
    await expect(adapter.signIn('//example.test')).rejects.toThrow('NEXT_REDIRECT /sign-in?returnTo=%2Fapp');
    await expect(adapter.signIn('/app/requests/new')).rejects.toThrow('NEXT_REDIRECT /sign-in?returnTo=%2Fapp%2Frequests%2Fnew');
  });

  it('never mints a session cookie', async () => {
    stubProductionGates();

    await expect(getSessionAdapter().setDevelopmentRole('Requestor')).rejects.toThrow(unavailableMessage);
    expect(mocks.cookieStore.set).not.toHaveBeenCalled();
  });

  it('grants no capabilities', () => {
    stubProductionBuild();

    expect(() => getSessionAdapter().capabilitiesFor({ displayName: 'Development user', developmentRole: 'Requestor' }))
      .toThrow(unavailableMessage);
  });
});

describe('getSessionAdapter under a production build inside the attested runtime', () => {
  beforeEach(() => {
    stubProductionGates();
    attestRuntime();
  });

  it('reads the development role cookie exactly as next dev does', async () => {
    mocks.cookieStore.get.mockReturnValue({ name: cookieName, value: 'Security Analyst' });

    await expect(getSessionAdapter().current()).resolves.toEqual({
      displayName: 'Development user',
      developmentRole: 'Security Analyst',
    });
    expect(mocks.cookieStore.get).toHaveBeenCalledWith(cookieName);
  });

  it('resolves no session from a missing or unknown cookie value', async () => {
    mocks.cookieStore.get.mockReturnValue(undefined);
    await expect(getSessionAdapter().current()).resolves.toBeNull();

    mocks.cookieStore.get.mockReturnValue({ name: cookieName, value: 'Administrator' });
    await expect(getSessionAdapter().current()).resolves.toBeNull();
  });

  it('mints the session cookie with the same attributes as next dev', async () => {
    await getSessionAdapter().setDevelopmentRole('Requestor');

    expect(mocks.cookieStore.set).toHaveBeenCalledWith(cookieName, 'Requestor', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 28800,
    });
  });
});

describe('the development session cookie under next dev', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'development');
  });

  it('is read without any attestation', async () => {
    mocks.cookieStore.get.mockReturnValue({ name: cookieName, value: 'Requestor' });

    await expect(getSessionAdapter().current()).resolves.toEqual({
      displayName: 'Development user',
      developmentRole: 'Requestor',
    });
  });

  it('is minted httpOnly, lax, on the root path, for eight hours', async () => {
    await getSessionAdapter().setDevelopmentRole('Secondary Requestor');

    expect(mocks.cookieStore.set).toHaveBeenCalledWith(cookieName, 'Secondary Requestor', {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 28800,
    });
  });

  it.each([
    ['https', true],
    ['http', false],
    ['https, http', true],
    ['http, https', false],
    [' https ', true],
  ])('is secure only when the first forwarded protocol is https (x-forwarded-proto: %s)', async (forwardedProtocol, secure) => {
    mocks.requestHeaders.set('x-forwarded-proto', forwardedProtocol);

    await getSessionAdapter().setDevelopmentRole('Requestor');

    expect(mocks.cookieStore.set).toHaveBeenCalledWith(cookieName, 'Requestor', expect.objectContaining({ secure }));
  });

  it('is not secure on a plain request without a forwarded protocol', async () => {
    await getSessionAdapter().setDevelopmentRole('Requestor');

    expect(mocks.cookieStore.set).toHaveBeenCalledWith(cookieName, 'Requestor', expect.objectContaining({ secure: false }));
  });
});

/*
 * D-31 (UI-SPEC §17, UI-D26): a second human Security Analyst, Sam Analyst, for development and E2E only. The
 * development session sends the persona's email as the development identity, so Strapi resolves a human Security
 * Analyst through the same identity middleware; the persona has no Keycloak fixture subject.
 */
describe('the Second Security Analyst development role (D-31)', () => {
  it('is the fourth development role, after Security Analyst', () => {
    expect(developmentRoles).toEqual(['Requestor', 'Secondary Requestor', 'Security Analyst', 'Second Security Analyst']);
    expect(parseDevelopmentRole('Second Security Analyst')).toBe('Second Security Analyst');
  });

  it('names Sam Analyst as the development identity, and each other role keeps its own', () => {
    expect(developmentFixtureIdentityForRole('Second Security Analyst')).toBe('sam.analyst@idambox.com');
    expect(developmentFixtureIdentityForRole('Security Analyst')).toBe('bob.doe@idambox.com');
    expect(developmentFixtureIdentityForRole('Secondary Requestor')).toBe('maya.requestor@idambox.com');
    expect(developmentFixtureIdentityForRole('Requestor')).toBe('jane.doe@idambox.com');
  });

  it('is granted exactly the Security Analyst capabilities', async () => {
    const second = await new DevelopmentCapabilityAdapter('Second Security Analyst').granted();
    const first = await new DevelopmentCapabilityAdapter('Security Analyst').granted();

    expect(second).toEqual(first);
  });

  it('reads and mints the session cookie for the persona under next dev', async () => {
    vi.stubEnv('NODE_ENV', 'development');
    mocks.cookieStore.get.mockReturnValue({ name: cookieName, value: 'Second Security Analyst' });

    await expect(getSessionAdapter().current()).resolves.toEqual({
      displayName: 'Development user',
      developmentRole: 'Second Security Analyst',
    });

    await getSessionAdapter().setDevelopmentRole('Second Security Analyst');
    expect(mocks.cookieStore.set).toHaveBeenCalledWith(cookieName, 'Second Security Analyst', expect.objectContaining({ httpOnly: true }));
  });
});
