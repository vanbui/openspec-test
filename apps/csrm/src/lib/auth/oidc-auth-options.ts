import 'server-only';

import type { NextAuthConfig } from 'next-auth';
import type { JWT } from 'next-auth/jwt';
import Keycloak from 'next-auth/providers/keycloak';
import { refreshKeycloakTokens } from '@/lib/api/transport/keycloak-token-client';
import type { OidcConfiguration } from './oidc-configuration';
import { REFRESH_TOKEN_ERROR } from './oidc-session-error';

/** Matches the development session cookie lifetime (development-session-adapter.ts). */
const OIDC_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

/**
 * An access token is refreshed this long before it expires (docs/adr/0004), so the
 * token a request reads is still valid for the Strapi calls that request makes.
 */
export const ACCESS_TOKEN_REFRESH_MARGIN_SECONDS = 60;

function isFresh(token: JWT, nowSeconds: number): boolean {
  const expiresAt = token.accessTokenExpiresAt;
  return typeof token.accessToken === 'string'
    && typeof expiresAt === 'number'
    && nowSeconds < expiresAt - ACCESS_TOKEN_REFRESH_MARGIN_SECONDS;
}

/** True when the jwt callback would call Keycloak for this token now. */
export function accessTokenNeedsRefresh(token: JWT, nowSeconds: number): boolean {
  return token.error !== REFRESH_TOKEN_ERROR && !isFresh(token, nowSeconds);
}

/**
 * A failed refresh drops every Keycloak token and marks the session, so the adapter
 * treats it as signed out instead of calling Strapi with a dead token.
 */
function failedRefresh(token: JWT): JWT {
  const { accessToken: _access, refreshToken: _refresh, accessTokenExpiresAt: _expiry, ...rest } = token;
  return { ...rest, error: REFRESH_TOKEN_ERROR };
}

async function refreshedToken(token: JWT, config: OidcConfiguration, now: () => number): Promise<JWT> {
  if (!accessTokenNeedsRefresh(token, Math.floor(now() / 1000))) return token;
  if (typeof token.refreshToken !== 'string') return failedRefresh(token);

  try {
    const refreshed = await refreshKeycloakTokens({
      issuer: config.issuer,
      clientId: config.clientId,
      clientSecret: config.clientSecret,
      refreshToken: token.refreshToken,
    }, now);
    return {
      ...token,
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: refreshed.accessTokenExpiresAt,
      refreshToken: refreshed.refreshToken ?? token.refreshToken,
      ...(refreshed.idToken ? { idToken: refreshed.idToken } : {}),
    };
  } catch (error) {
    // eslint-disable-next-line no-console -- the error name only, never a token or response body.
    console.warn(`[csrm-auth] ${error instanceof Error ? error.name : 'RefreshError'}`);
    return failedRefresh(token);
  }
}

function errorTypeSuffix(error: Error): string {
  const type = (error as { type?: unknown }).type;
  return typeof type === 'string' ? ` (${type})` : '';
}

/**
 * The Auth.js v5 configuration for the Keycloak provider (ADR 0003). Only the error
 * name and Auth.js's own `type` code are ever logged: never the message, cause,
 * request or config, which is where a token or secret could otherwise leak (OIDC-04).
 * The jwt callback keeps the id_token (for RP-initiated logout) and, since Strapi now
 * verifies Keycloak access tokens (docs/adr/0004), the access and refresh tokens,
 * refreshing the access token shortly before it expires. They live only in the
 * encrypted Auth.js cookie. The session callback strips everything except `expires`,
 * the display fields and a refresh-failure code, so no token and no `sub` ever reach
 * `/api/auth/session` or the browser; tokens are read back server-side only through
 * `getToken` (oidc-session-adapter.ts).
 */
export function oidcAuthOptions(config: OidcConfiguration, now: () => number = Date.now): NextAuthConfig {
  return {
    providers: [
      Keycloak({
        clientId: config.clientId,
        clientSecret: config.clientSecret,
        issuer: config.issuer,
      }),
    ],
    secret: config.authSecret,
    session: {
      strategy: 'jwt',
      maxAge: OIDC_SESSION_MAX_AGE_SECONDS,
    },
    pages: {
      signIn: '/sign-in',
      error: '/sign-in',
    },
    debug: false,
    logger: {
      error(error: Error) {
        // eslint-disable-next-line no-console -- the only sink; never the message, cause or config.
        console.error(`[csrm-auth] ${error.name}${errorTypeSuffix(error)}`);
      },
      warn(code) {
        // eslint-disable-next-line no-console -- warning codes only, never a value.
        console.warn(`[csrm-auth] ${code}`);
      },
      debug() {
        // Intentionally silent: Auth.js debug logs may include request or token internals.
      },
    },
    callbacks: {
      async jwt({ token, account }) {
        if (account) {
          return {
            ...token,
            ...(typeof account.id_token === 'string' ? { idToken: account.id_token } : {}),
            ...(typeof account.access_token === 'string' ? { accessToken: account.access_token } : {}),
            ...(typeof account.refresh_token === 'string' ? { refreshToken: account.refresh_token } : {}),
            ...(typeof account.expires_at === 'number' ? { accessTokenExpiresAt: account.expires_at } : {}),
          };
        }
        return refreshedToken(token, config, now);
      },
      async session({ session, token }) {
        return {
          expires: session.expires,
          user: {
            name: session.user?.name,
            email: session.user?.email,
          },
          ...(token?.error === REFRESH_TOKEN_ERROR ? { error: REFRESH_TOKEN_ERROR } : {}),
        };
      },
    },
  };
}
