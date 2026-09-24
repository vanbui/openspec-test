import { AppShell } from '@/components/shell/app-shell';
import { PermissionDeniedState } from '@/components/states/states';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { CapabilityDeniedError, requireCapability } from '@/lib/capabilities/server-guard';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();

  if (!session) {
    return sessionAdapter.signIn('/app');
  }

  const granted = await sessionAdapter.capabilitiesFor(session).granted();

  try {
    requireCapability('assessment-request:read', granted);
  } catch (error) {
    if (error instanceof CapabilityDeniedError) {
      return (
        <AppShell granted={granted} role={session.developmentRole}>
          <PermissionDeniedState />
        </AppShell>
      );
    }

    throw error;
  }

  return <AppShell granted={granted} role={session.developmentRole}>{children}</AppShell>;
}
