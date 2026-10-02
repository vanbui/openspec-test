import { TimeZoneProvider, ViewerTimeZoneSync } from '@/components/csrm/local-time';
import type { DevelopmentRole } from '@/lib/auth/session-adapter';
import type { Capability } from '@/lib/capabilities/capability-adapter';
export { PageHeader, type PageHeaderProps } from '@/components/csrm/page-header';
import { AccountMenu } from './account-menu';
import { CapabilityNavigation, MobileNavigation } from './capability-navigation';
import { RoleSwitcher } from './role-switcher';
import { Wordmark } from './wordmark';

interface AppShellProps {
  children: React.ReactNode;
  granted: ReadonlySet<Capability>;
  role?: DevelopmentRole;
  /** An OIDC-mode session (ADR 0003). Mutually exclusive with `role`: never both. */
  account?: { displayName: string; email?: string };
  /** The viewer's IANA time zone from its cookie, or null while unknown (D-19). */
  timeZone: string | null;
}

export function AppShell({ children, granted, role, account, timeZone }: AppShellProps) {
  const footer = role ? <RoleSwitcher role={role} /> : undefined;

  return (
    <TimeZoneProvider zone={timeZone}>
      <ViewerTimeZoneSync />
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="shell">
        <aside className="sidebar">
          <Wordmark />
          <CapabilityNavigation granted={granted} />
          {footer ? <div className="shell-footer">{footer}</div> : null}
        </aside>
        <div className="shell-content">
          <header className="header">
            <MobileNavigation footer={footer} granted={granted} />
            <span className="header-title">Cyber Risk Manager</span>
            {role ? <span className="header-role micro-label">{role}</span> : null}
            {account ? <AccountMenu displayName={account.displayName} email={account.email} /> : null}
          </header>
          <main className="page" id="main-content">{children}</main>
        </div>
      </div>
    </TimeZoneProvider>
  );
}
