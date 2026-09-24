'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { can, type Capability } from '../../lib/capabilities/capability-adapter';
import { navigation } from '../../config/navigation/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface CapabilityNavigationProps {
  granted: ReadonlySet<Capability>;
  onNavigate?: () => void;
}

function isActiveRoute(pathname: string, href: string): boolean {
  return href === '/app'
    ? pathname === href
    : pathname === href || pathname.startsWith(`${href}/`);
}

export function CapabilityNavigation({ granted, onNavigate }: CapabilityNavigationProps) {
  const pathname = usePathname();
  const visible = navigation.filter((item) => can(item.capability, granted));
  const primary = visible.filter((item) => !item.group);
  const administration = visible.filter((item) => item.group === 'Administration');

  const renderLink = (item: (typeof navigation)[number]) => {
    const Icon = item.icon;

    return (
      <Link
        aria-current={isActiveRoute(pathname, item.href) ? 'page' : undefined}
        className="nav-link"
        href={item.href}
        key={item.href}
        onClick={onNavigate}
      >
        <Icon aria-hidden="true" className="nav-link-icon" />
        {item.label}
      </Link>
    );
  };

  return (
    <nav aria-label="Primary navigation">
      {primary.map(renderLink)}
      {administration.length ? (
        <div aria-label="Administration" className="mt-4 space-y-1 border-t border-sidebar-border pt-3" role="group">
          <p className="micro-label px-3 text-sidebar-muted">Administration</p>
          {administration.map(renderLink)}
        </div>
      ) : null}
    </nav>
  );
}

interface MobileNavigationProps {
  granted: ReadonlySet<Capability>;
  footer?: ReactNode;
}

/*
 * The navigation drawer is a bespoke shell piece rather than the shared
 * ui/sheet: it needs the dark sidebar surface, an explicitly labelled close
 * control, and the focus-restoration contract the shell tests assert.
 */
function NavigationSheetContent({
  children,
  className,
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Content> & { title: string }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay className="sheet-overlay" data-testid="sheet-overlay" />
      <Dialog.Content className={cn('sheet-content', className)} {...props}>
        <Dialog.Title className="sheet-title">{title}</Dialog.Title>
        {children}
      </Dialog.Content>
    </Dialog.Portal>
  );
}

export function MobileNavigation({ granted, footer }: MobileNavigationProps) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function restoreTriggerFocus(): void {
    window.setTimeout(() => triggerRef.current?.focus(), 0);
  }

  function closeNavigation(): void {
    setOpen(false);
    restoreTriggerFocus();
  }

  function handleOpenChange(nextOpen: boolean): void {
    setOpen(nextOpen);

    if (!nextOpen) {
      restoreTriggerFocus();
    }
  }

  return (
    <>
      <Dialog.Root onOpenChange={handleOpenChange} open={open}>
        <Dialog.Trigger asChild>
          <Button
            aria-expanded={open}
            aria-label="Open navigation"
            className="mobile-trigger"
            variant="outline"
            onClick={(event) => { triggerRef.current = event.currentTarget; }}
            ref={triggerRef}
          >
            <Menu aria-hidden="true" />
            Menu
          </Button>
        </Dialog.Trigger>
        <NavigationSheetContent aria-describedby={undefined} title="Navigation">
          <Dialog.Close asChild>
            <Button aria-label="Close navigation" variant="outline">
              <X aria-hidden="true" />
              Close
            </Button>
          </Dialog.Close>
          <CapabilityNavigation granted={granted} onNavigate={closeNavigation} />
          {footer ? <div className="shell-footer">{footer}</div> : null}
        </NavigationSheetContent>
      </Dialog.Root>
    </>
  );
}
