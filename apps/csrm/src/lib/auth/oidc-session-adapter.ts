import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import type { Capability, CapabilityAdapter } from '@/lib/capabilities/capability-adapter';
import { REFRESH_TOKEN_ERROR } from './oidc-session-error';
import { resolveSessionRuntimeMode } from './development-runtime';
import { keycloakLogoutUrl, readOidcConfiguration } from './oidc-configuration';
import { validatedReturnTo } from './return-to';
import type { DevelopmentRole, Session, SessionAdapter } from './session-adapter';

const unavailableSessionMessage = 'Session authentication is not configured.';

/**
 * The dynamic import keeps next-auth and every `AUTH_*` read out of the development
 * path entirely (OIDC-02): a module-level `import('./oidc-auth')` would run at load
 * time regardless of the flag, but this only runs when a caller actually awaits it,
 * and every caller here first checks `isOidcRuntime()`.
 *
 * This module must not import `development-session-adapter.ts`, to avoid a cycle:
 * that module imports this one to construct the OIDC adapter singleton.
 */
function loadAuth() {
  return import('./oidc-auth');
}

function isOidcRuntime(): boolean {
  return resolveSessionRuntimeMode(process.env) === 'oidc';
}

function assertOidcRuntime(): void {
  if (!isOidcRuntime()) {
    throw new Error(unavailableSessionMessage);
  }
}

function signInPath(returnTo: string): string {
  return `/sign-in?returnTo=${encodeURIComponent(validatedReturnTo(returnTo))}`;
}

/**
 * Decodes the encrypted Auth.js JWT cookie of this request. next-auth marks
 * `getToken` as not the preferred server-side API, but the session callback must not
 * expose any token, so this is the only place tokens can be read back. The proxy has
 * already refreshed the cookie and forwarded it on this request (docs/adr/0004).
 */
async function readSessionToken() {
  const config = readOidcConfiguration(process.env);
  const { getToken } = await import('next-auth/jwt');
  return getToken({
    req: { headers: new Headers(await headers()) },
    secret: config.authSecret,
    secureCookie: new URL(config.authUrl).protocol === 'https:',
  });
}

/**
 * The OIDC session adapter (ADR 0003), behind the same `SessionAdapter` seam as the
 * development bridge. It never runs alongside that bridge: `resolveSessionRuntimeMode`
 * is the single predicate that decides which adapter `getSessionAdapter()` returns.
 */
export class OidcSessionAdapter implements SessionAdapter {
  async current(): Promise<Session | null> {
    if (!isOidcRuntime()) {
      return null;
    }

    const { auth } = await loadAuth();
    const session = await auth();
    const user = session?.user;

    // A failed refresh ends the session: the layout sends the visitor back through sign-in.
    if (!user || (session as { error?: unknown }).error === REFRESH_TOKEN_ERROR) {
      return null;
    }

    const email = user.email?.trim();
    const displayName = user.name?.trim() || email || 'Signed-in user';

    return { displayName, ...(email ? { email } : {}) };
  }

  async setDevelopmentRole(_role: DevelopmentRole): Promise<void> {
    throw new Error(unavailableSessionMessage);
  }

  /**
   * Capabilities come from Strapi's own resolution of the Keycloak identity
   * (`GET /v1/me/access`, docs/adr/0004). Any failure grants nothing, so the layout
   * renders `PermissionDeniedState` rather than pages whose calls would be refused.
   * The import is dynamic because the access service reaches the transport, which
   * imports `development-session-adapter.ts`, which imports this module.
   */
  capabilitiesFor(_session: Session): CapabilityAdapter {
    return {
      async granted(): Promise<ReadonlySet<Capability>> {
        const { strapiGrantedCapabilities } = await import('@/lib/capabilities/strapi-capabilities');
        return strapiGrantedCapabilities();
      },
    };
  }

  async identityToken(): Promise<string | null> {
    if (!isOidcRuntime()) {
      return null;
    }

    const token = await readSessionToken();
    if (!token || token.error === REFRESH_TOKEN_ERROR) return null;

    const expiresAt = token.accessTokenExpiresAt;
    if (typeof token.accessToken !== 'string' || typeof expiresAt !== 'number') return null;
    // Never forward a token Strapi would reject as expired; the next request refreshes it.
    return Date.now() / 1000 < expiresAt ? token.accessToken : null;
  }

  async signIn(returnTo: string): Promise<never> {
    redirect(signInPath(returnTo));
  }

  /**
   * RP-initiated logout (OIDC-06). The id_token never leaves this server: it exists
   * only in the encrypted Auth.js JWT cookie, and is read back here through
   * `getToken` (next-auth marks it as not the preferred server-side API, but the
   * session callback must not expose the token, so this is the only place it can be
   * read). The Auth.js cookie is cleared before the browser is sent to Keycloak's
   * end-session endpoint, whose origin must equal the realm's registered
   * post-logout URI.
   */
  async signOut(): Promise<never> {
    assertOidcRuntime();

    const config = readOidcConfiguration(process.env);
    const token = await readSessionToken();
    const idTokenHint = typeof token?.idToken === 'string' ? token.idToken : undefined;

    await (await loadAuth()).signOut({ redirect: false });

    redirect(keycloakLogoutUrl({
      issuer: config.issuer,
      clientId: config.clientId,
      postLogoutRedirectUri: new URL(config.authUrl).origin,
      idTokenHint,
    }));
  }
}

/**
 * Starts the Keycloak authorization-code flow. Never auto-started from a render: only
 * a server action (`beginOidcSignIn`) calls this. The redirect call is outside any
 * try/catch so Next's redirect signal propagates uncaught.
 */
export async function startOidcSignIn(returnTo: string | null | undefined): Promise<never> {
  assertOidcRuntime();

  const { signIn } = await loadAuth();
  await signIn('keycloak', { redirectTo: validatedReturnTo(returnTo) });

  throw new Error('Sign-in did not redirect.');
}

/** Serves the registered callback `http://localhost:3000/api/auth/callback/keycloak`. */
export async function handleOidcAuthRequest(request: NextRequest, method: 'GET' | 'POST'): Promise<Response> {
  if (!isOidcRuntime()) {
    return new Response(null, { status: 404 });
  }

  const { handlers } = await loadAuth();
  return handlers[method](request);
}
