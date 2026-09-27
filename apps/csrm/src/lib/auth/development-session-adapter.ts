import 'server-only';

import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { DevelopmentCapabilityAdapter } from '@/lib/capabilities/development-capabilities';
import { resolveSessionRuntimeMode } from './development-runtime';
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
  | 'bob.doe@idambox.com';

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
    return new DevelopmentCapabilityAdapter(session.developmentRole);
  }

  async signIn(returnTo: string): Promise<never> {
    assertDevelopmentRuntime();
    redirect(signInPath(returnTo));
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

  async signIn(returnTo: string): Promise<never> {
    redirect(signInPath(returnTo));
  }
}

const developmentSession = new DevelopmentSessionAdapter();
const unavailableSession = new UnavailableSessionAdapter();

export function getSessionAdapter(): SessionAdapter {
  return isDevelopmentRuntime() ? developmentSession : unavailableSession;
}
