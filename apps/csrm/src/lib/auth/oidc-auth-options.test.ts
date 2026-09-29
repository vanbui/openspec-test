import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { oidcAuthOptions } from './oidc-auth-options';
import type { OidcConfiguration } from './oidc-configuration';

const config: OidcConfiguration = {
  authUrl: 'http://localhost:3000',
  authSecret: 'sentinel-auth-secret-0123456789-0123456789',
  clientId: 'idambox-csrm',
  clientSecret: 'sentinel-client-secret-0123456789',
  issuer: 'http://localhost:8080/realms/idambox',
};

let errorSpy: ReturnType<typeof vi.spyOn>;
let warnSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
  warnSpy.mockRestore();
});

describe('oidcAuthOptions', () => {
  it('configures exactly one Keycloak provider from the given configuration', () => {
    const options = oidcAuthOptions(config);

    expect(options.providers).toHaveLength(1);
    const [provider] = options.providers;
    const resolved = typeof provider === 'function' ? provider() : provider;
    expect(resolved.id).toBe('keycloak');
    expect(resolved.options).toMatchObject({
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      issuer: config.issuer,
    });
  });

  it('sets the session strategy, lifetime, pages and debug flag', () => {
    const options = oidcAuthOptions(config);

    expect(options.session).toEqual({ strategy: 'jwt', maxAge: 60 * 60 * 8 });
    expect(options.pages).toEqual({ signIn: '/sign-in', error: '/sign-in' });
    expect(options.debug).toBe(false);
    expect(options.secret).toBe(config.authSecret);
  });

  it('jwt callback copies the id_token on sign-in and adds nothing else', async () => {
    const options = oidcAuthOptions(config);
    const baseToken = { name: 'Jane Doe' };

    const withAccount = await options.callbacks!.jwt!({
      token: { ...baseToken },
      user: {},
      account: { id_token: 'sentinel-id-token', access_token: 'sentinel-access-token', refresh_token: 'sentinel-refresh-token' } as never,
    } as never);
    expect(withAccount).toEqual({ ...baseToken, idToken: 'sentinel-id-token' });
    expect(withAccount).not.toHaveProperty('accessToken');
    expect(withAccount).not.toHaveProperty('refreshToken');

    const withoutAccount = await options.callbacks!.jwt!({ token: { ...baseToken }, user: {}, account: null } as never);
    expect(withoutAccount).toEqual(baseToken);
  });

  it('session callback returns only expires and the display fields', async () => {
    const options = oidcAuthOptions(config);

    const result = await options.callbacks!.session!({
      session: { expires: '2026-09-30T00:00:00.000Z', user: { name: 'Jane Doe', email: 'jane.doe@idambox.com' } },
      token: { idToken: 'sentinel-id-token', sub: 'sentinel-subject' } as never,
    } as never);

    expect(result).toEqual({
      expires: '2026-09-30T00:00:00.000Z',
      user: { name: 'Jane Doe', email: 'jane.doe@idambox.com' },
    });
    expect(JSON.stringify(result)).not.toContain('idToken');
    expect(JSON.stringify(result)).not.toContain('sentinel-id-token');
    expect(JSON.stringify(result)).not.toContain('sub');
    expect(JSON.stringify(result)).not.toContain('sentinel-subject');
  });

  it('logger.error writes only the error name and Auth.js type, never the message or cause', () => {
    const options = oidcAuthOptions(config);
    const sentinelMessage = 'sentinel-error-message-with-secret-9f8e7d';
    const error = new Error(sentinelMessage);
    (error as unknown as { type: string }).type = 'OAuthCallbackError';
    (error as unknown as { cause: unknown }).cause = { token: 'sentinel-cause-token' };

    options.logger!.error!(error);

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const [logged] = errorSpy.mock.calls[0] as [string];
    expect(logged).toContain('Error');
    expect(logged).toContain('OAuthCallbackError');
    expect(logged).not.toContain(sentinelMessage);
    expect(logged).not.toContain('sentinel-cause-token');
  });

  it('logger.warn writes only the warning code', () => {
    const options = oidcAuthOptions(config);

    options.logger!.warn!('env-url-basepath-redundant' as never);

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0]?.[0]).toContain('env-url-basepath-redundant');
  });

  it('logger.debug is a no-op', () => {
    const options = oidcAuthOptions(config);
    const debugSpy = vi.spyOn(console, 'debug').mockImplementation(() => {});

    expect(() => options.logger!.debug!('sentinel-debug-message', { token: 'x' })).not.toThrow();
    expect(debugSpy).not.toHaveBeenCalled();

    debugSpy.mockRestore();
  });
});
