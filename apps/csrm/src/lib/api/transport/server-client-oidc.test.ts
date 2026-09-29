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

describe('createStrapiClient in OIDC mode (D-02)', () => {
  it('sends only the API token, never the development identity header, and never reads the session', async () => {
    const createClientMock = vi.fn((_options?: unknown) => ({ marker: 'typed-client' }));
    const currentSessionMock = vi.fn().mockResolvedValue({
      displayName: 'Development user',
      developmentRole: 'Requestor',
    });

    vi.resetModules();
    vi.doMock('openapi-fetch', () => ({ default: createClientMock }));
    vi.doMock('@/lib/auth/development-session-adapter', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/lib/auth/development-session-adapter')>()),
      getSessionAdapter: () => ({ current: currentSessionMock }),
    }));

    const { createStrapiClient } = await import('./server-client');
    await createStrapiClient();

    expect(currentSessionMock).not.toHaveBeenCalled();
    const options = createClientMock.mock.calls[0]?.[0] as { headers?: Record<string, string> } | undefined;
    expect(options?.headers).toEqual({ authorization: 'Bearer configured-oidc-credential' });
    expect(options?.headers).not.toHaveProperty('x-csrm-dev-identity');
  });
});
