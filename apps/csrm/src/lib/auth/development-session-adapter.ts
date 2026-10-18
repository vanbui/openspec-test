import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DevelopmentCapabilityAdapter } from '@/lib/capabilities/development-capabilities';
import { resolveSessionRuntimeMode } from './development-runtime';
import { OidcSessionAdapter } from './oidc-session-adapter';
import {
  parseDevelopmentRole,
  type DevelopmentRole,
  type Session,
  type SessionAdapter,
} from './session-adapter';
import { validatedReturnTo } from './return-to';

const cookieName = 'csrm-development-role';
const unavailableSessionMessage = 'Session authentication is not configured.';

export type DevelopmentFixtureIdentity =
  | 'jane.doe@idambox.com'
  | 'maya.requestor@idambox.com'
  | 'bob.doe@idambox.com'
  /** D-31: the second human Security Analyst, development and E2E only, with no Keycloak fixture subject. */
  | 'sam.analyst@idambox.com';

export function developmentFixtureIdentityForRole(
  role: DevelopmentRole,
): DevelopmentFixtureIdentity | null {
  switch (role) {
    case 'Requestor':
      return 'jane.doe@idambox.com';
    case 'Secondary Requestor':
      return 'maya.requestor@idambox.com';
    case 'Security Analyst':
      return 'bob.doe@idambox.com';
    case 'Second Security Analyst':
      return 'sam.analyst@idambox.com';
    default:
      return null;
  }
}

function isDevelopmentRuntime(): boolean {
  return resolveSessionRuntimeMode(process.env) === 'development';
}

function signInPath(returnTo: string): string {
  return `/sign-in?returnTo=${encodeURIComponent(validatedReturnTo(returnTo))}`;
}

/**
 * The cookie is marked Secure exactly when the request arrived over TLS, which a
 * proxy reports in the first `x-forwarded-proto` value. A plain HTTP origin (the
 * E2E harness on 127.0.0.1) gets a cookie the browser will still send.
 */
async function requestUsesHttps(): Promise<boolean> {
  const forwardedProtocol = (await headers()).get('x-forwarded-proto');
  return forwardedProtocol?.split(',')[0]?.trim() === 'https';
}

function assertDevelopmentRuntime(): void {
  if (!isDevelopmentRuntime()) {
    throw new Error(unavailableSessionMessage);
  }
}

export class DevelopmentSessionAdapter implements SessionAdapter {
  async current(): Promise<Session | null> {
    if (!isDevelopmentRuntime()) {
      return null;
    }

    const value = (await cookies()).get(cookieName)?.value;
    const developmentRole = parseDevelopmentRole(value);

    return developmentRole
      ? { displayName: 'Development user', developmentRole }
      : null;
  }

  async setDevelopmentRole(role: DevelopmentRole): Promise<void> {
    assertDevelopmentRuntime();

    const secure = await requestUsesHttps();

    (await cookies()).set(cookieName, role, {
      httpOnly: true,
      secure,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 8,
    });
  }

  capabilitiesFor(session: Session): DevelopmentCapabilityAdapter {
    if (!session.developmentRole) {
      throw new Error(unavailableSessionMessage);
    }

    return new DevelopmentCapabilityAdapter(session.developmentRole);
  }

  async identityToken(): Promise<null> {
    return null;
  }

  async signIn(returnTo: string): Promise<never> {
    assertDevelopmentRuntime();
    redirect(signInPath(returnTo));
  }

  async signOut(): Promise<never> {
    throw new Error(unavailableSessionMessage);
  }
}

/**
 * The fail-closed branch: no session exists, a visitor to an application route is
 * sent to the sign-in page (which renders the unavailable card), and nothing can
 * mint a session or grant a capability.
 */
class UnavailableSessionAdapter implements SessionAdapter {
  async current(): Promise<null> {
    return null;
  }

  async setDevelopmentRole(_role: DevelopmentRole): Promise<void> {
    throw new Error(unavailableSessionMessage);
  }

  capabilitiesFor(_session: Session): never {
    throw new Error(unavailableSessionMessage);
  }

  async identityToken(): Promise<null> {
    return null;
  }

  async signIn(returnTo: string): Promise<never> {
    redirect(signInPath(returnTo));
  }

  async signOut(): Promise<never> {
    throw new Error(unavailableSessionMessage);
  }
}

const developmentSession = new DevelopmentSessionAdapter();
const unavailableSession = new UnavailableSessionAdapter();
let oidcSession: OidcSessionAdapter | undefined;

/**
 * Switches on the single `resolveSessionRuntimeMode` predicate (ADR 0003): `'oidc'`
 * returns the OIDC adapter singleton, `'development'` the development adapter, and
 * anything else the fail-closed unavailable adapter. The two session modes are
 * mutually exclusive, so this never returns more than one adapter for a given mode.
 */
export function getSessionAdapter(): SessionAdapter {
  const mode = resolveSessionRuntimeMode(process.env);

  if (mode === 'oidc') {
    oidcSession ??= new OidcSessionAdapter();
    return oidcSession;
  }

  return mode === 'development' ? developmentSession : unavailableSession;
}
