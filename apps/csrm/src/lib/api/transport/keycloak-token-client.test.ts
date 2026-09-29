import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { KeycloakRefreshError, refreshKeycloakTokens } from './keycloak-token-client';

const params = {
  issuer: 'http://localhost:8080/realms/idambox',
  clientId: 'idambox-csrm',
  clientSecret: 'sentinel-client-secret',
  refreshToken: 'sentinel-refresh-token',
};
const now = () => 1_800_000_000_000;

function respond(status: number, body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('refreshKeycloakTokens', () => {
  it('posts the refresh_token grant to the realm token endpoint and returns the new token set', async () => {
    const fetchMock = respond(200, { access_token: 'new-access', expires_in: 300, refresh_token: 'new-refresh', id_token: 'new-id' });

    await expect(refreshKeycloakTokens(params, now)).resolves.toEqual({
      accessToken: 'new-access',
      accessTokenExpiresAt: 1_800_000_300,
      refreshToken: 'new-refresh',
      idToken: 'new-id',
    });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('http://localhost:8080/realms/idambox/protocol/openid-connect/token');
    expect(init.method).toBe('POST');
    expect(Object.fromEntries(new URLSearchParams(init.body as URLSearchParams))).toEqual({
      grant_type: 'refresh_token',
      client_id: 'idambox-csrm',
      client_secret: 'sentinel-client-secret',
      refresh_token: 'sentinel-refresh-token',
    });
  });

  it('omits a refresh token Keycloak did not rotate', async () => {
    respond(200, { access_token: 'new-access', expires_in: 300 });

    await expect(refreshKeycloakTokens(params, now)).resolves.toEqual({ accessToken: 'new-access', accessTokenExpiresAt: 1_800_000_300 });
  });

  it('rejects a refusal, a malformed body or a network failure without echoing anything', async () => {
    respond(400, { error: 'invalid_grant', error_description: 'sentinel-reason' });
    const refused = await refreshKeycloakTokens(params, now).catch((error: unknown) => error);
    expect(refused).toBeInstanceOf(KeycloakRefreshError);
    expect((refused as KeycloakRefreshError).status).toBe(400);
    expect(String((refused as Error).message)).not.toContain('sentinel');

    respond(200, { access_token: 'new-access' });
    await expect(refreshKeycloakTokens(params, now)).rejects.toBeInstanceOf(KeycloakRefreshError);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sentinel-network')));
    await expect(refreshKeycloakTokens(params, now)).rejects.toThrow('Keycloak token refresh failed.');
  });
});
