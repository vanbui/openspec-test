import { AppShell } from '@/components/shell/app-shell';
import { loadNavigationCounts } from '@/components/shell/navigation-counts';
import { PermissionDeniedState } from '@/components/states/states';
import { getSessionAdapter } from '@/lib/auth/development-session-adapter';
import { resolveSessionRuntimeMode } from '@/lib/auth/development-runtime';
import { CapabilityDeniedError, requireCapability } from '@/lib/capabilities/server-guard';
import { readViewerTimeZone } from '@/lib/time/viewer-time-zone';

export const dynamic = 'force-dynamic';

export default async function ProtectedLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const sessionAdapter = getSessionAdapter();
  const session = await sessionAdapter.current();

  if (!session) {
    return sessionAdapter.signIn('/app');
  }

  const account = resolveSessionRuntimeMode(process.env) === 'oidc'
    ? { displayName: session.displayName, ...(session.email ? { email: session.email } : {}) }
    : undefined;
  const granted = await sessionAdapter.capabilitiesFor(session).granted();
  const timeZone = await readViewerTimeZone();

  try {
    requireCapability('assessment-request:read', granted);
  } catch (error) {
    if (error instanceof CapabilityDeniedError) {
      return (
        <AppShell account={account} counts={Promise.resolve({})} granted={granted} identityKey={session.identityKey} role={session.developmentRole} timeZone={timeZone}>
          <PermissionDeniedState action={{ label: 'Return to sign in', href: '/sign-in' }} description="Your access is unavailable. Return to sign in and try again. If the problem continues, contact your administrator." />
        </AppShell>
      );
    }

    throw error;
  }

  /*
   * The sidebar's counts start here and are never awaited: the promise streams to the navigation, which
   * renders each count once its read settles, so no page waits for one (D-11). The promise never rejects,
   * and it re-runs with every server render of this layout; nothing polls.
   */
  const counts = loadNavigationCounts(granted);

  return <AppShell account={account} counts={counts} granted={granted} identityKey={session.identityKey} role={session.developmentRole} timeZone={timeZone}>{children}</AppShell>;
}
