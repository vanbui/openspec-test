import { TimeZoneProvider, ViewerTimeZoneSync } from '@/components/csrm/local-time';
import { NavigationGuardProvider } from '@/components/csrm/navigation-guard';
import type { DevelopmentRole } from '@/lib/auth/session-adapter';
import { can, type Capability } from '@/lib/capabilities/capability-adapter';
import type { NavigationCounts } from '@/config/navigation/navigation';
import { quickFindViewer } from '@/features/quick-find/quick-find-domain';
import { AttachmentFileStoreProvider } from '@/features/attachments/file-store';
export { PageHeader, type PageHeaderProps } from '@/components/csrm/page-header';
import { AccountMenu } from './account-menu';
import { CapabilityNavigation, MobileNavigation } from './capability-navigation';
import { QuickFindTrigger } from './quick-find-trigger';
import { RoleSwitcher } from './role-switcher';
import { Wordmark } from './wordmark';

interface AppShellProps {
  children: React.ReactNode;
  granted: ReadonlySet<Capability>;
  /** The navigation's counts, started by the layout and never awaited there, so no page waits (D-11). */
  counts: Promise<NavigationCounts>;
  role?: DevelopmentRole;
  /** An OIDC-mode session (ADR 0003). Mutually exclusive with `role`: never both. */
  account?: { displayName: string; email?: string };
  /** The viewer's IANA time zone from its cookie, or null while unknown (D-19). */
  timeZone: string | null;
  /** Opaque server-resolved identity, used only to discard a previous viewer's search state. */
  identityKey?: string;
}

export function AppShell({ children, granted, counts, role, account, timeZone, identityKey }: AppShellProps) {
  const footer = role ? <RoleSwitcher role={role} /> : undefined;
  const searchKey = JSON.stringify([identityKey ?? role, [...granted].sort()]);
  /*
   * 14-UI-SPEC §1.5 (UI-D35): files not added are kept in the tab's memory above the request routes, so an in-app
   * navigation never drops one. Only the authorised branch holds the store; the access-denied page has no files.
   */
  const page = can('assessment-request:read', granted) ? <AttachmentFileStoreProvider>{children}</AttachmentFileStoreProvider> : children;

  return (
    <TimeZoneProvider zone={timeZone}>
      <ViewerTimeZoneSync />
      {/* Every in-app link the shell renders, and a page's own guarded links, consult this (D-12). */}
      <NavigationGuardProvider>
        <a className="skip-link" href="#main-content">Skip to main content</a>
        <div className="shell">
          <aside className="sidebar">
            <Wordmark />
            <CapabilityNavigation counts={counts} granted={granted} />
            {footer ? <div className="shell-footer">{footer}</div> : null}
          </aside>
          <div className="shell-content">
            <header className="header">
              <MobileNavigation counts={counts} footer={footer} granted={granted} />
              <span className="header-title">Cyber Risk Manager</span>
              {/* Quick find's control sits immediately before the role tag or the account menu (D-15, UI-SPEC §3). */}
              <div className="header-actions">
                {can('assessment-request:read', granted) ? <QuickFindTrigger key={searchKey} viewer={quickFindViewer(granted)} /> : null}
                {role ? <span className="header-role micro-label">{role}</span> : null}
                {account ? <AccountMenu displayName={account.displayName} email={account.email} /> : null}
              </div>
            </header>
            <main className="page" id="main-content">{page}</main>
          </div>
        </div>
      </NavigationGuardProvider>
    </TimeZoneProvider>
  );
}
