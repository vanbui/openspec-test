'use client';

import Link from 'next/link';
import { Menu, X } from 'lucide-react';
import { usePathname } from 'next/navigation';
import { useRef, useState, type ReactNode } from 'react';
import { can, type Capability } from '../../lib/capabilities/capability-adapter';
import {
  activeNavigationHref,
  navigation,
  navigationGroups,
  type NavigationItem,
} from '../../config/navigation/navigation';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '../ui/button';
import { cn } from '../../lib/utils';

interface CapabilityNavigationProps {
  granted: ReadonlySet<Capability>;
  /** The items to offer; the shipped navigation unless a caller supplies its own list. */
  items?: readonly NavigationItem[];
  onNavigate?: () => void;
}

/*
 * Presentation only: visibility follows the granted capabilities, and Strapi still authorises every
 * read behind each route. Primary items render first, then each group in navigationGroups order.
 */
export function CapabilityNavigation({ granted, items = navigation, onNavigate }: CapabilityNavigationProps) {
  const pathname = usePathname();
  const visible = items.filter((item) => can(item.capability, granted));
  const activeHref = activeNavigationHref(pathname, visible);
  const primary = visible.filter((item) => !item.group);
  const groups = navigationGroups
    .map((group) => ({ group, items: visible.filter((item) => item.group === group) }))
    .filter((entry) => entry.items.length > 0);

  const renderLink = (item: NavigationItem) => {
    const Icon = item.icon;

    return (
      <Link
        aria-current={item.href === activeHref ? 'page' : undefined}
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
      {groups.map(({ group, items: groupItems }) => (
        <div aria-label={group} className="mt-4 space-y-1 border-t border-sidebar-border pt-3" key={group} role="group">
          <p className="micro-label px-3 text-sidebar-muted">{group}</p>
          {groupItems.map(renderLink)}
        </div>
      ))}
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
        {/*
          * The visible label is the accessible name (WCAG 2.5.3 Label in Name), so the trigger
          * carries no aria-label. Radix's trigger supplies aria-haspopup and aria-controls.
          */}
        <Dialog.Trigger asChild>
          <Button
            aria-expanded={open}
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
