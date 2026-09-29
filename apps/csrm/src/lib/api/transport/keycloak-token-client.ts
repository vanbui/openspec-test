import 'server-only';

/*
 * The one outbound call the OIDC session makes itself (docs/adr/0004): the
 * refresh_token grant against the realm's token endpoint. It lives in the
 * transport because no module outside it may call fetch. Nothing it returns or
 * throws carries a token, a secret or Keycloak's response body.
 */

export interface KeycloakRefreshParams {
  issuer: string;
  clientId: string;
  clientSecret: string;
  refreshToken: string;
}

export interface KeycloakTokenSet {
  accessToken: string;
  /** Epoch seconds. */
  accessTokenExpiresAt: number;
  /** Keycloak may rotate the refresh token; when it does not, the caller keeps the old one. */
  refreshToken?: string;
  idToken?: string;
}

export class KeycloakRefreshError extends Error {
  constructor(readonly status?: number) {
    super('Keycloak token refresh failed.');
    this.name = 'KeycloakRefreshError';
  }
}

const REFRESH_TIMEOUT_MS = 5000;

export async function refreshKeycloakTokens(
  params: KeycloakRefreshParams,
  now: () => number = Date.now,
): Promise<KeycloakTokenSet> {
  let response: Response;
  try {
    response = await fetch(`${params.issuer}/protocol/openid-connect/token`, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        client_id: params.clientId,
        client_secret: params.clientSecret,
        refresh_token: params.refreshToken,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(REFRESH_TIMEOUT_MS),
    });
  } catch {
    throw new KeycloakRefreshError();
  }

  if (!response.ok) throw new KeycloakRefreshError(response.status);

  let body: Record<string, unknown>;
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    throw new KeycloakRefreshError(response.status);
  }

  const { access_token: accessToken, expires_in: expiresIn, refresh_token: refreshToken, id_token: idToken } = body;
  if (typeof accessToken !== 'string' || typeof expiresIn !== 'number' || !Number.isFinite(expiresIn)) {
    throw new KeycloakRefreshError(response.status);
  }

  return {
    accessToken,
    accessTokenExpiresAt: Math.floor(now() / 1000) + expiresIn,
    ...(typeof refreshToken === 'string' ? { refreshToken } : {}),
    ...(typeof idToken === 'string' ? { idToken } : {}),
  };
}
