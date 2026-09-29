import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import type { NextRequest } from 'next/server';
import type { CapabilityAdapter } from '@/lib/capabilities/capability-adapter';
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

    if (!user) {
      return null;
    }

    const displayName = user.name?.trim() || user.email?.trim() || 'Signed-in user';

    return { displayName };
  }

  async setDevelopmentRole(_role: DevelopmentRole): Promise<void> {
    throw new Error(unavailableSessionMessage);
  }

  /**
   * Fail-closed optimistic UX (D-02): no capability is granted until Strapi resolves
   * the Keycloak identity server-side (the follow-up issue). The layout renders the
   * existing `PermissionDeniedState` for every OIDC session in the meantime.
   */
  capabilitiesFor(_session: Session): CapabilityAdapter {
    return {
      async granted() {
        return new Set();
      },
    };
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
    const { getToken } = await import('next-auth/jwt');
    const token = await getToken({
      req: { headers: new Headers(await headers()) },
      secret: config.authSecret,
      secureCookie: new URL(config.authUrl).protocol === 'https:',
    });
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
