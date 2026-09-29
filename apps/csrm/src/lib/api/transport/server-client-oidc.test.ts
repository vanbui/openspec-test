import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const originalNodeEnvironment = process.env.NODE_ENV;

beforeEach(() => {
  vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'true');
  vi.stubEnv('NODE_ENV', 'development');
  vi.stubEnv('CSRM_DEV_IDENTITY', 'true');
  process.env.CSRM_API_BASE_URL = 'https://strapi.example.test/api';
  process.env.CSRM_API_TOKEN = 'configured-oidc-credential';
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.stubEnv('NODE_ENV', originalNodeEnvironment);
  vi.resetModules();
  delete process.env.CSRM_API_BASE_URL;
  delete process.env.CSRM_API_TOKEN;
});

async function clientOptionsFor(identityToken: string | null) {
  const createClientMock = vi.fn((_options?: unknown) => ({ marker: 'typed-client' }));
  const currentSessionMock = vi.fn().mockResolvedValue({
    displayName: 'Development user',
    developmentRole: 'Requestor',
  });
  const identityTokenMock = vi.fn().mockResolvedValue(identityToken);

  vi.resetModules();
  vi.doMock('openapi-fetch', () => ({ default: createClientMock }));
  vi.doMock('@/lib/auth/development-session-adapter', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/lib/auth/development-session-adapter')>()),
    getSessionAdapter: () => ({ current: currentSessionMock, identityToken: identityTokenMock }),
  }));

  const { createStrapiClient } = await import('./server-client');
  await createStrapiClient();

  return {
    currentSessionMock,
    identityTokenMock,
    options: createClientMock.mock.calls[0]?.[0] as { headers?: Record<string, string> } | undefined,
  };
}

describe('createStrapiClient in OIDC mode (docs/adr/0004)', () => {
  it("sends the API token and the caller's own access token, never the development identity header", async () => {
    const { currentSessionMock, identityTokenMock, options } = await clientOptionsFor('sentinel-access-token');

    expect(currentSessionMock).not.toHaveBeenCalled();
    expect(identityTokenMock).toHaveBeenCalledTimes(1);
    expect(options?.headers).toEqual({
      authorization: 'Bearer configured-oidc-credential',
      'x-csrm-identity-token': 'sentinel-access-token',
    });
    expect(options?.headers).not.toHaveProperty('x-csrm-dev-identity');
  });

  it('sends no identity at all when the session has no usable access token', async () => {
    const { options } = await clientOptionsFor(null);

    expect(options?.headers).toEqual({ authorization: 'Bearer configured-oidc-credential' });
  });

  it('refuses to build a client without the API token', async () => {
    delete process.env.CSRM_API_TOKEN;

    await expect(clientOptionsFor('sentinel-access-token')).rejects.toThrow('CSRM API configuration is invalid.');
  });
});
