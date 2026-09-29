import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

const refreshKeycloakTokensMock = vi.hoisted(() => vi.fn());
vi.mock('@/lib/api/transport/keycloak-token-client', () => ({ refreshKeycloakTokens: refreshKeycloakTokensMock }));

import { ACCESS_TOKEN_REFRESH_MARGIN_SECONDS, oidcAuthOptions } from './oidc-auth-options';
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

  it('jwt callback keeps the id, access and refresh tokens and the expiry on sign-in', async () => {
    const options = oidcAuthOptions(config);
    const baseToken = { name: 'Jane Doe' };

    const withAccount = await options.callbacks!.jwt!({
      token: { ...baseToken },
      user: {},
      account: {
        id_token: 'sentinel-id-token',
        access_token: 'sentinel-access-token',
        refresh_token: 'sentinel-refresh-token',
        expires_at: 1_900_000_000,
      } as never,
    } as never);
    expect(withAccount).toEqual({
      ...baseToken,
      idToken: 'sentinel-id-token',
      accessToken: 'sentinel-access-token',
      refreshToken: 'sentinel-refresh-token',
      accessTokenExpiresAt: 1_900_000_000,
    });
    expect(refreshKeycloakTokensMock).not.toHaveBeenCalled();
  });

  describe('jwt callback refresh', () => {
    const nowSeconds = 1_800_000_000;
    const now = () => nowSeconds * 1000;
    const signedIn = {
      name: 'Jane Doe',
      idToken: 'sentinel-id-token',
      accessToken: 'sentinel-access-token',
      refreshToken: 'sentinel-refresh-token',
    };

    beforeEach(() => {
      refreshKeycloakTokensMock.mockReset();
    });

    it('leaves a token that is not about to expire untouched', async () => {
      const token = { ...signedIn, accessTokenExpiresAt: nowSeconds + ACCESS_TOKEN_REFRESH_MARGIN_SECONDS + 1 };
      const result = await oidcAuthOptions(config, now).callbacks!.jwt!({ token, account: null } as never);

      expect(result).toEqual(token);
      expect(refreshKeycloakTokensMock).not.toHaveBeenCalled();
    });

    it('refreshes a token inside the margin and keeps the refresh token Keycloak did not rotate', async () => {
      refreshKeycloakTokensMock.mockResolvedValue({ accessToken: 'sentinel-new-access', accessTokenExpiresAt: nowSeconds + 300 });
      const token = { ...signedIn, accessTokenExpiresAt: nowSeconds + ACCESS_TOKEN_REFRESH_MARGIN_SECONDS };

      const result = await oidcAuthOptions(config, now).callbacks!.jwt!({ token, account: null } as never);

      expect(refreshKeycloakTokensMock).toHaveBeenCalledWith({
        issuer: config.issuer,
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        refreshToken: 'sentinel-refresh-token',
      }, now);
      expect(result).toEqual({ ...signedIn, accessToken: 'sentinel-new-access', accessTokenExpiresAt: nowSeconds + 300 });
    });

    it('takes a rotated refresh token and a new id token', async () => {
      refreshKeycloakTokensMock.mockResolvedValue({
        accessToken: 'sentinel-new-access',
        accessTokenExpiresAt: nowSeconds + 300,
        refreshToken: 'sentinel-new-refresh',
        idToken: 'sentinel-new-id',
      });
      const token = { ...signedIn, accessTokenExpiresAt: nowSeconds - 10 };

      const result = await oidcAuthOptions(config, now).callbacks!.jwt!({ token, account: null } as never);

      expect(result).toMatchObject({ refreshToken: 'sentinel-new-refresh', idToken: 'sentinel-new-id' });
    });

    it('drops every Keycloak token and flags the session when the refresh fails', async () => {
      refreshKeycloakTokensMock.mockRejectedValue(Object.assign(new Error('sentinel-reason'), { name: 'KeycloakRefreshError' }));
      const token = { ...signedIn, accessTokenExpiresAt: nowSeconds - 10 };

      const result = await oidcAuthOptions(config, now).callbacks!.jwt!({ token, account: null } as never);

      expect(result).toEqual({ name: 'Jane Doe', idToken: 'sentinel-id-token', error: 'RefreshTokenError' });
      expect(warnSpy).toHaveBeenCalledWith('[csrm-auth] KeycloakRefreshError');
      expect(JSON.stringify(warnSpy.mock.calls)).not.toContain('sentinel');
    });

    it('flags the session without calling Keycloak when there is no refresh token', async () => {
      const token = { name: 'Jane Doe', accessToken: 'sentinel-access-token', accessTokenExpiresAt: nowSeconds - 10 };

      const result = await oidcAuthOptions(config, now).callbacks!.jwt!({ token, account: null } as never);

      expect(result).toEqual({ name: 'Jane Doe', error: 'RefreshTokenError' });
      expect(refreshKeycloakTokensMock).not.toHaveBeenCalled();
    });

    it('never retries a session whose refresh already failed', async () => {
      const token = { name: 'Jane Doe', error: 'RefreshTokenError' };

      expect(await oidcAuthOptions(config, now).callbacks!.jwt!({ token, account: null } as never)).toEqual(token);
      expect(refreshKeycloakTokensMock).not.toHaveBeenCalled();
    });
  });

  it('session callback returns only expires and the display fields', async () => {
    const options = oidcAuthOptions(config);

    const result = await options.callbacks!.session!({
      session: { expires: '2026-09-30T00:00:00.000Z', user: { name: 'Jane Doe', email: 'jane.doe@idambox.com' } },
      token: { idToken: 'sentinel-id-token', accessToken: 'sentinel-access-token', refreshToken: 'sentinel-refresh-token', sub: 'sentinel-subject' } as never,
    } as never);

    expect(result).toEqual({
      expires: '2026-09-30T00:00:00.000Z',
      user: { name: 'Jane Doe', email: 'jane.doe@idambox.com' },
    });
    expect(JSON.stringify(result)).not.toContain('idToken');
    expect(JSON.stringify(result)).not.toContain('sentinel-id-token');
    expect(JSON.stringify(result)).not.toContain('sub');
    expect(JSON.stringify(result)).not.toContain('sentinel-subject');
    expect(JSON.stringify(result)).not.toContain('sentinel-access-token');
    expect(JSON.stringify(result)).not.toContain('sentinel-refresh-token');
  });

  it('session callback adds only the refresh-failure code when a refresh failed', async () => {
    const options = oidcAuthOptions(config);

    const result = await options.callbacks!.session!({
      session: { expires: '2026-09-30T00:00:00.000Z', user: { name: 'Jane Doe', email: 'jane.doe@idambox.com' } },
      token: { error: 'RefreshTokenError', sub: 'sentinel-subject' } as never,
    } as never);

    expect(result).toEqual({
      expires: '2026-09-30T00:00:00.000Z',
      user: { name: 'Jane Doe', email: 'jane.doe@idambox.com' },
      error: 'RefreshTokenError',
    });
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
