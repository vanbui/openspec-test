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

it('current backend 403 removes capabilities using the real typed client with unchanged credentials', async () => {
  vi.resetModules();
  vi.doUnmock('openapi-fetch');
  const identityToken = vi.fn().mockResolvedValue('same-existing-token');
  vi.doMock('@/lib/auth/development-session-adapter', () => ({ getSessionAdapter: () => ({ identityToken }) }));
  const requests: Request[] = [];
  const fetchMock = vi.fn(async (request: Request) => {
    requests.push(request);
    return requests.length === 1
      ? Response.json({ data: { displayName: 'Gate Person', functions: [], operations: ['GET:/api/v1/my_requests'] } })
      : Response.json({ error: { status: 403, name: 'ForbiddenError', message: 'Forbidden' } }, { status: 403 });
  });
  vi.stubGlobal('fetch', fetchMock);
  try {
    const { strapiGrantedCapabilities } = await import('@/lib/capabilities/strapi-capabilities');
    expect(await strapiGrantedCapabilities()).toEqual(new Set(['assessment-request:read']));
    expect(await strapiGrantedCapabilities()).toEqual(new Set());
    expect(requests).toHaveLength(2);
    for (const request of requests) {
      expect(request.url).toBe('https://strapi.example.test/api/v1/me/access');
      expect(request.headers.get('authorization')).toBe('Bearer configured-oidc-credential');
      expect(request.headers.get('x-csrm-identity-token')).toBe('same-existing-token');
      expect(request.headers.has('x-csrm-dev-identity')).toBe(false);
    }
  } finally { vi.unstubAllGlobals(); }
});
