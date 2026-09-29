import { AppShell } from '@/components/shell/app-shell';
import { PermissionDeniedState } from '@/components/states/states';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { resolveSessionRuntimeMode } from '@/lib/auth/development-runtime';
import { CapabilityDeniedError, requireCapability } from '@/lib/capabilities/server-guard';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();

  if (!session) {
    return sessionAdapter.signIn('/app');
  }

  const account = resolveSessionRuntimeMode(process.env) === 'oidc'
    ? { displayName: session.displayName }
    : undefined;
  const granted = await sessionAdapter.capabilitiesFor(session).granted();

  try {
    requireCapability('assessment-request:read', granted);
  } catch (error) {
    if (error instanceof CapabilityDeniedError) {
      return (
        <AppShell account={account} granted={granted} role={session.developmentRole}>
          <PermissionDeniedState />
        </AppShell>
      );
    }

    throw error;
  }

  return <AppShell account={account} granted={granted} role={session.developmentRole}>{children}</AppShell>;
}
