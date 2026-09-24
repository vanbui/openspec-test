import 'server-only';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DevelopmentCapabilityAdapter } from '@/lib/capabilities/development-capabilities';
import {
  parseDevelopmentRole,
  parseSessionRuntimeMode,
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
  return parseSessionRuntimeMode(process.env.NODE_ENV) === 'development';
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

    (await cookies()).set(cookieName, role, {
      httpOnly: true,
      secure: false,
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
    redirect(`/sign-in?returnTo=${encodeURIComponent(validatedReturnTo(returnTo))}`);
  }
}

class UnavailableSessionAdapter implements SessionAdapter {
  async current(): Promise<null> {
    throw new Error(unavailableSessionMessage);
  }

  async setDevelopmentRole(_role: DevelopmentRole): Promise<void> {
    throw new Error(unavailableSessionMessage);
  }

  capabilitiesFor(_session: Session): never {
    throw new Error(unavailableSessionMessage);
  }

  async signIn(_returnTo: string): Promise<never> {
    throw new Error(unavailableSessionMessage);
  }
}

const developmentSession = new DevelopmentSessionAdapter();
const unavailableSession = new UnavailableSessionAdapter();

export function getSessionAdapter(): SessionAdapter {
  return parseSessionRuntimeMode(process.env.NODE_ENV) === 'development'
    ? developmentSession
    : unavailableSession;
}
