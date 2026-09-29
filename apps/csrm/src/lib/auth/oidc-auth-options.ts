import 'server-only';

import type { NextAuthConfig } from 'next-auth';
import Keycloak from 'next-auth/providers/keycloak';
import type { OidcConfiguration } from './oidc-configuration';

/** Matches the development session cookie lifetime (development-session-adapter.ts). */
const OIDC_SESSION_MAX_AGE_SECONDS = 60 * 60 * 8;

function errorTypeSuffix(error: Error): string {
  const type = (error as { type?: unknown }).type;
  return typeof type === 'string' ? ` (${type})` : '';
}

/**
 * The Auth.js v5 configuration for the Keycloak provider (ADR 0003). Only the error
 * name and Auth.js's own `type` code are ever logged: never the message, cause,
 * request or config, which is where a token or secret could otherwise leak (OIDC-04).
 * The session callback strips everything except `expires` and the display fields, so
 * `id_token` and `sub` never reach `/api/auth/session` or the browser; the id_token is
 * read back server-side only through `getToken` (oidc-session-adapter.ts, Task 2).
 */
export function oidcAuthOptions(config: OidcConfiguration): NextAuthConfig {
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
        if (account && typeof account.id_token === 'string') {
          return { ...token, idToken: account.id_token };
        }
        return token;
      },
      async session({ session }) {
        return {
          expires: session.expires,
          user: {
            name: session.user?.name,
            email: session.user?.email,
          },
        };
      },
    },
  };
}
