import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  assertSessionRuntimeConfiguration,
  keycloakLogoutUrl,
  parseOidcEnabledFlag,
  readOidcConfiguration,
} from './oidc-configuration';

const sentinelClientSecret = 'sentinel-client-secret-0123456789';
const sentinelAuthSecret = 'sentinel-auth-secret-0123456789-0123456789';

const completeEnv: NodeJS.ProcessEnv = {
  NODE_ENV: 'test',
  AUTH_URL: 'http://localhost:3000',
  AUTH_SECRET: sentinelAuthSecret,
  AUTH_KEYCLOAK_ID: 'idambox-csrm',
  AUTH_KEYCLOAK_SECRET: sentinelClientSecret,
  AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox',
};

/** Records which keys were read from the given env object, without changing its values. */
function trackedEnvReads(env: NodeJS.ProcessEnv): { proxy: NodeJS.ProcessEnv; reads: string[] } {
  const reads: string[] = [];
  const proxy = new Proxy(env, {
    get(target, property, receiver) {
      if (typeof property === 'string') reads.push(property);
      return Reflect.get(target, property, receiver);
    },
  });
  return { proxy, reads };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('parseOidcEnabledFlag', () => {
  it.each([
    [undefined, false],
    ['', false],
    ['false', false],
    ['true', true],
  ])('%s -> %s', (value, expected) => {
    expect(parseOidcEnabledFlag(value)).toBe(expected);
  });

  it.each(['TRUE', 'yes', '1', ' true '])('rejects %s naming the flag, never the value', (value) => {
    expect(() => parseOidcEnabledFlag(value)).toThrow('CSRM_AUTH_OIDC_ENABLED');
    expect(() => parseOidcEnabledFlag(value)).not.toThrow(value);
  });
});

describe('readOidcConfiguration', () => {
  it('returns the normalised configuration for a complete local environment', () => {
    const config = readOidcConfiguration({
      ...completeEnv,
      AUTH_KEYCLOAK_ISSUER: 'http://localhost:8080/realms/idambox/',
    });

    expect(config).toEqual({
      authUrl: 'http://localhost:3000',
      authSecret: sentinelAuthSecret,
      clientId: 'idambox-csrm',
      clientSecret: sentinelClientSecret,
      issuer: 'http://localhost:8080/realms/idambox',
    });
  });

  it.each(['AUTH_URL', 'AUTH_SECRET', 'AUTH_KEYCLOAK_ID', 'AUTH_KEYCLOAK_SECRET', 'AUTH_KEYCLOAK_ISSUER'] as const)(
    'throws naming %s when it is missing',
    (missingName) => {
      const env = { ...completeEnv, [missingName]: undefined };
      expect(() => readOidcConfiguration(env)).toThrow(missingName);
    },
  );

  it('names every missing variable when two are absent', () => {
    const env = { ...completeEnv, AUTH_SECRET: undefined, AUTH_KEYCLOAK_SECRET: undefined };
    try {
      readOidcConfiguration(env);
      throw new Error('expected readOidcConfiguration to throw');
    } catch (error) {
      expect((error as Error).message).toContain('AUTH_SECRET');
      expect((error as Error).message).toContain('AUTH_KEYCLOAK_SECRET');
    }
  });

  it('never includes a provided value in any thrown message', () => {
    const scenarios: Array<Partial<NodeJS.ProcessEnv>> = [
      { AUTH_URL: undefined },
      { AUTH_URL: 'not a url' },
      { AUTH_URL: 'https://operator:secret@localhost:3000' },
      { AUTH_KEYCLOAK_ISSUER: 'not a url' },
      { AUTH_KEYCLOAK_ISSUER: 'https://localhost:8080/realms/idambox?token=x' },
      { AUTH_SECRET: 'too-short' },
    ];

    for (const overrides of scenarios) {
      const env = { ...completeEnv, ...overrides };
      try {
        readOidcConfiguration(env);
        throw new Error('expected readOidcConfiguration to throw');
      } catch (error) {
        const message = (error as Error).message;
        expect(message).not.toContain(sentinelClientSecret);
        expect(message).not.toContain(sentinelAuthSecret);
      }
    }
  });

  it.each([
    ['not a URL', 'AUTH_URL'],
    ['https://user:pass@localhost:3000', 'AUTH_URL'],
    ['https://localhost:3000?x=1', 'AUTH_URL'],
    ['https://localhost:3000#frag', 'AUTH_URL'],
  ])('rejects a malformed AUTH_URL (%s) naming the variable', (value, variableName) => {
    const env = { ...completeEnv, AUTH_URL: value };
    expect(() => readOidcConfiguration(env)).toThrow(variableName);
  });

  it.each([
    ['not a URL', 'AUTH_KEYCLOAK_ISSUER'],
    ['https://user:pass@localhost:8080/realms/idambox', 'AUTH_KEYCLOAK_ISSUER'],
    ['https://localhost:8080/realms/idambox?x=1', 'AUTH_KEYCLOAK_ISSUER'],
    ['https://localhost:8080/realms/idambox#frag', 'AUTH_KEYCLOAK_ISSUER'],
  ])('rejects a malformed AUTH_KEYCLOAK_ISSUER (%s) naming the variable', (value, variableName) => {
    const env = { ...completeEnv, AUTH_KEYCLOAK_ISSUER: value };
    expect(() => readOidcConfiguration(env)).toThrow(variableName);
  });

  it('rejects an AUTH_SECRET shorter than 32 characters, naming AUTH_SECRET', () => {
    const env = { ...completeEnv, AUTH_SECRET: 'short-secret' };
    expect(() => readOidcConfiguration(env)).toThrow('AUTH_SECRET');
  });

  it('reads only the five AUTH_* names, in order', () => {
    const { proxy, reads } = trackedEnvReads(completeEnv);

    readOidcConfiguration(proxy);

    expect(reads).toEqual(['AUTH_URL', 'AUTH_SECRET', 'AUTH_KEYCLOAK_ID', 'AUTH_KEYCLOAK_SECRET', 'AUTH_KEYCLOAK_ISSUER']);
  });
});

describe('assertSessionRuntimeConfiguration', () => {
  it('returns having read only the flag when it is unset', () => {
    const { proxy, reads } = trackedEnvReads({ NODE_ENV: 'test' });

    expect(() => assertSessionRuntimeConfiguration(proxy, 'development')).not.toThrow();
    expect(reads).toEqual(['CSRM_AUTH_OIDC_ENABLED']);
  });

  it('throws naming the flag when it is invalid', () => {
    const env = { ...completeEnv, CSRM_AUTH_OIDC_ENABLED: 'yes' };
    expect(() => assertSessionRuntimeConfiguration(env, 'development')).toThrow('CSRM_AUTH_OIDC_ENABLED');
  });

  it('refuses a production build naming Strapi, even with every AUTH_* value present', () => {
    const env = { ...completeEnv, CSRM_AUTH_OIDC_ENABLED: 'true' };
    expect(() => assertSessionRuntimeConfiguration(env, 'production')).toThrow('Strapi does not yet verify Keycloak identity');
  });

  it('fails fast under next dev when a value is missing, naming it without any provided value', () => {
    const env = { ...completeEnv, CSRM_AUTH_OIDC_ENABLED: 'true', AUTH_KEYCLOAK_SECRET: undefined };
    try {
      assertSessionRuntimeConfiguration(env, 'development');
      throw new Error('expected assertSessionRuntimeConfiguration to throw');
    } catch (error) {
      const message = (error as Error).message;
      expect(message).toContain('AUTH_KEYCLOAK_SECRET');
      expect(message).not.toContain(sentinelClientSecret);
    }
  });

  it('passes under next dev with the flag true and a complete configuration', () => {
    const env = { ...completeEnv, CSRM_AUTH_OIDC_ENABLED: 'true' };
    expect(() => assertSessionRuntimeConfiguration(env, 'development')).not.toThrow();
  });
});

describe('register() from apps/csrm/instrumentation.ts', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('rejects with the refusal message on the nodejs runtime, in a production build, with the flag true', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'nodejs');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'true');
    vi.resetModules();
    const { register } = await import('../../../instrumentation');

    await expect(register()).rejects.toThrow('Strapi does not yet verify Keycloak identity');
  });

  it('resolves on the edge runtime regardless of configuration', async () => {
    vi.stubEnv('NEXT_RUNTIME', 'edge');
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('CSRM_AUTH_OIDC_ENABLED', 'true');
    vi.resetModules();
    const { register } = await import('../../../instrumentation');

    await expect(register()).resolves.toBeUndefined();
  });
});

describe('keycloakLogoutUrl', () => {
  const params = {
    issuer: 'http://localhost:8080/realms/idambox',
    clientId: 'idambox-csrm',
    postLogoutRedirectUri: 'http://localhost:3000',
  };

  it('builds the discovery-reported end_session_endpoint with the hint', () => {
    const url = new URL(keycloakLogoutUrl({ ...params, idTokenHint: 'sentinel-id-token' }));

    expect(`${url.origin}${url.pathname}`).toBe('http://localhost:8080/realms/idambox/protocol/openid-connect/logout');
    expect(url.searchParams.get('client_id')).toBe('idambox-csrm');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000');
    expect(url.searchParams.get('id_token_hint')).toBe('sentinel-id-token');
  });

  it('omits id_token_hint when no id token is given', () => {
    const url = new URL(keycloakLogoutUrl(params));

    expect(url.searchParams.get('client_id')).toBe('idambox-csrm');
    expect(url.searchParams.get('post_logout_redirect_uri')).toBe('http://localhost:3000');
    expect(url.searchParams.has('id_token_hint')).toBe(false);
  });
});
