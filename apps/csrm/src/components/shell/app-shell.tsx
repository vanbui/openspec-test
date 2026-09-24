import type { DevelopmentRole } from '@/lib/auth/session-adapter';
import type { Capability } from '@/lib/capabilities/capability-adapter';
export { PageHeader, type PageHeaderProps } from '@/components/csrm/page-header';
import { CapabilityNavigation, MobileNavigation } from './capability-navigation';
import { RoleSwitcher } from './role-switcher';
import { Wordmark } from './wordmark';

interface AppShellProps {
  children: React.ReactNode;
  granted: ReadonlySet<Capability>;
  role?: DevelopmentRole;
}

export function AppShell({ children, granted, role }: AppShellProps) {
  const roleSwitcher = role ? <RoleSwitcher role={role} /> : undefined;

  return (
    <>
      <a className="skip-link" href="#main-content">Skip to main content</a>
      <div className="shell">
        <aside className="sidebar">
          <Wordmark />
          <CapabilityNavigation granted={granted} />
          {roleSwitcher ? <div className="shell-footer">{roleSwitcher}</div> : null}
        </aside>
        <div className="shell-content">
          <header className="header">
            <MobileNavigation footer={roleSwitcher} granted={granted} />
            <span className="header-title">Cyber Risk Manager</span>
            {role ? <span className="header-role micro-label">{role}</span> : null}
          </header>
          <main className="page" id="main-content">{children}</main>
        </div>
      </div>
    </>
  );
}
