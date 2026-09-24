import { once } from 'node:events';
import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createStrapiClient } from './server-client';

const originalBaseUrl = process.env.CSRM_API_BASE_URL;
const originalDevelopmentIdentity = process.env.CSRM_DEV_IDENTITY;
const originalApiToken = process.env.CSRM_API_TOKEN;
const originalNodeEnvironment = process.env.NODE_ENV;
let server: Server | undefined;

async function startServer(): Promise<{ baseUrl: string; requestedPaths: string[] }> {
  const requestedPaths: string[] = [];
  server = createServer((request, response) => {
    requestedPaths.push(request.url ?? '');
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ data: [] }));
  });

  server.listen(0, '127.0.0.1');
  await once(server, 'listening');

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('The loopback test server did not expose a TCP address.');
  }

  return { baseUrl: `http://127.0.0.1:${address.port}`, requestedPaths };
}

beforeEach(() => {
  delete process.env.CSRM_API_BASE_URL;
  delete process.env.CSRM_API_TOKEN;
});

afterEach(async () => {
  vi.restoreAllMocks();
  if (server) {
    server.close();
    await once(server, 'close');
    server = undefined;
  }

  if (originalBaseUrl === undefined) {
    delete process.env.CSRM_API_BASE_URL;
  } else {
    process.env.CSRM_API_BASE_URL = originalBaseUrl;
  }

  vi.unstubAllEnvs();
  if (originalDevelopmentIdentity === undefined) {
    delete process.env.CSRM_DEV_IDENTITY;
  } else {
    process.env.CSRM_DEV_IDENTITY = originalDevelopmentIdentity;
  }
  if (originalApiToken === undefined) {
    delete process.env.CSRM_API_TOKEN;
  } else {
    process.env.CSRM_API_TOKEN = originalApiToken;
  }
  vi.stubEnv('NODE_ENV', originalNodeEnvironment);
});

describe('createStrapiClient', () => {
  it('derives the development identity header from the trusted server session', async () => {
    const createClientMock = vi.fn((_options?: unknown) => ({ marker: 'typed-client' }));
    const currentSessionMock = vi.fn();

    vi.resetModules();
    vi.doMock('openapi-fetch', () => ({ default: createClientMock }));
    vi.doMock('@/lib/auth/development-session-adapter', async (importOriginal) => ({
      ...(await importOriginal<typeof import('@/lib/auth/development-session-adapter')>()),
      getSessionAdapter: () => ({ current: currentSessionMock }),
    }));

    process.env.CSRM_API_BASE_URL = 'https://strapi.example.test/api';
    const { createStrapiClient: createIsolatedStrapiClient } = await import('./server-client');

    const createFor = async ({
      nodeEnvironment = 'development',
      identityFlag = 'true',
      developmentRole = 'Requestor',
      apiToken = 'configured-development-credential',
    }: {
      nodeEnvironment?: string;
      identityFlag?: string | null;
      developmentRole?: string | null;
      apiToken?: string | null;
    }) => {
      vi.stubEnv('NODE_ENV', nodeEnvironment);
      if (identityFlag === null) {
        delete process.env.CSRM_DEV_IDENTITY;
      } else {
        process.env.CSRM_DEV_IDENTITY = identityFlag;
      }
      currentSessionMock.mockResolvedValue(
        developmentRole === null
          ? null
          : { displayName: 'Development user', developmentRole },
      );
      if (apiToken === null) delete process.env.CSRM_API_TOKEN;
      else process.env.CSRM_API_TOKEN = apiToken;
      createClientMock.mockClear();

      await createIsolatedStrapiClient();

      const options = createClientMock.mock.calls[0]?.[0] as
        | { baseUrl?: string; headers?: Record<string, string> }
        | undefined;
      if (!options || options.baseUrl !== 'https://strapi.example.test/api') {
        throw new Error('BASELINE_02_03_01_STRAPI_CLIENT_CREATION_FAILED');
      }
      return options.headers;
    };

    const requestorHeaders = await createFor({ developmentRole: 'Requestor' });
    try {
      expect(requestorHeaders).toEqual({
        authorization: 'Bearer configured-development-credential',
        'x-csrm-dev-identity': 'jane.doe@idambox.com',
      });
    } catch {
      throw new Error('PHASE2_RED_02_03_01_DEV_IDENTITY_HEADER_ABSENT');
    }

    expect(await createFor({ developmentRole: 'Security Analyst' })).toEqual({
      authorization: 'Bearer configured-development-credential',
      'x-csrm-dev-identity': 'bob.doe@idambox.com',
    });
    expect(await createFor({ identityFlag: null, apiToken: null })).toBeUndefined();
    expect(await createFor({ identityFlag: 'false', apiToken: null })).toBeUndefined();
    expect(await createFor({ nodeEnvironment: 'production', apiToken: null })).toBeUndefined();
    expect(await createFor({ developmentRole: null })).toEqual({ authorization: 'Bearer configured-development-credential' });
    expect(await createFor({ developmentRole: 'Administrator' })).toEqual({ authorization: 'Bearer configured-development-credential' });
  });

  it('requires the API token only when the development identity bridge is enabled', async () => {
    process.env.CSRM_API_BASE_URL = 'https://strapi.example.test/api';
    vi.stubEnv('NODE_ENV', 'development');
    process.env.CSRM_DEV_IDENTITY = 'true';

    for (const token of [undefined, '']) {
      if (token === undefined) delete process.env.CSRM_API_TOKEN;
      else process.env.CSRM_API_TOKEN = token;
      await expect(createStrapiClient()).rejects.toThrow('CSRM API configuration is invalid.');
    }

    vi.stubEnv('NODE_ENV', 'production');
    await expect(createStrapiClient()).resolves.toBeDefined();
  });

  it('sends the generated applications path to the canonical Strapi REST endpoint', async () => {
    const { baseUrl, requestedPaths } = await startServer();
    process.env.CSRM_API_BASE_URL = `${baseUrl}/api/`;

    await (await createStrapiClient()).GET('/applications');

    expect(requestedPaths).toEqual(['/api/applications']);
  });

  it('preserves a reverse-proxy prefix that ends in the Strapi REST segment', async () => {
    const { baseUrl, requestedPaths } = await startServer();
    process.env.CSRM_API_BASE_URL = `${baseUrl}/csrm/api/`;

    await (await createStrapiClient()).GET('/applications');

    expect(requestedPaths).toEqual(['/csrm/api/applications']);
  });

  it('rejects an origin-only base before any request is made', async () => {
    process.env.CSRM_API_BASE_URL = 'http://localhost:1337';

    await expect(createStrapiClient()).rejects.toThrow('CSRM API configuration is invalid.');
  });

  it.each([
    ['a non-api terminal path', 'https://strapi.example.test/csrm'],
    ['credentials', 'https://operator:secret@strapi.example.test/api'],
    ['a query string', 'https://strapi.example.test/api?token=secret'],
    ['a fragment', 'https://strapi.example.test/api#secret'],
    ['a non-http protocol', 'ftp://strapi.example.test/api'],
    ['missing configuration', undefined],
    ['a malformed URL', 'not a URL'],
  ])('rejects %s without exposing the configured value', async (_scenario, baseUrl) => {
    process.env.CSRM_API_BASE_URL = baseUrl;

    await expect(createStrapiClient()).rejects.toThrow('CSRM API configuration is invalid.');
    await expect(createStrapiClient()).rejects.not.toThrow(String(baseUrl));
  });
});
