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
import { Dialog } from 'radix-ui';
import { Button } from '../ui/button';
import { useNavigationGuard } from '../csrm/navigation-guard';
import { cn } from '../../lib/utils';

interface CapabilityNavigationProps {
  granted: ReadonlySet<Capability>;
  /** The items to offer; the shipped navigation unless a caller supplies its own list. */
  items?: readonly NavigationItem[];
  /**
   * Runs when one of the links navigates (the mobile sheet closes itself). While the page has unsaved
   * work it runs only once the person chooses to leave, so a blocked link leaves the sheet open.
   */
  onNavigated?: () => void;
}

/*
 * Presentation only: visibility follows the granted capabilities, and Strapi still authorises every
 * read behind each route. Primary items render first, then each group in navigationGroups order.
 */
export function CapabilityNavigation({ granted, items = navigation, onNavigated }: CapabilityNavigationProps) {
  const pathname = usePathname();
  const guard = useNavigationGuard();
  /* Next's Link calls onClick before onNavigate, and onNavigate never sees the DOM event (link.js). */
  const activated = useRef<HTMLAnchorElement | null>(null);
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
        onClick={(event) => {
          activated.current = event.currentTarget;
          if (!guard.blocking) onNavigated?.();
        }}
        onNavigate={(event) => guard.guardLink(event, { href: item.href, trigger: activated.current, onLeave: onNavigated })}
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
 *
 * It uses the same Radix build as every other primitive (radix-ui), so a
 * dialog opened above it, such as the leave warning (UI-SPEC §6.3), shares
 * its layer and focus stacks: the sheet pauses its focus trap and ignores
 * Escape and clicks that belong to the dialog. That build waits for the click
 * before dismissing on an outside press; a mouse or pen press on the overlay
 * still closes the sheet at once, as it always has, and a touch waits for its
 * click so the tap cannot fall through to the page.
 */
function NavigationSheetContent({
  children,
  className,
  onOverlayPress,
  title,
  ...props
}: React.ComponentPropsWithoutRef<typeof Dialog.Content> & { title: string; onOverlayPress: () => void }) {
  return (
    <Dialog.Portal>
      <Dialog.Overlay
        className="sheet-overlay"
        data-testid="sheet-overlay"
        onPointerDown={(event) => { if (event.pointerType !== 'touch') onOverlayPress(); }}
      />
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
        <NavigationSheetContent aria-describedby={undefined} onOverlayPress={() => handleOpenChange(false)} title="Navigation">
          <Dialog.Close asChild>
            <Button aria-label="Close navigation" variant="outline">
              <X aria-hidden="true" />
              Close
            </Button>
          </Dialog.Close>
          <CapabilityNavigation granted={granted} onNavigated={closeNavigation} />
          {footer ? <div className="shell-footer">{footer}</div> : null}
        </NavigationSheetContent>
      </Dialog.Root>
    </>
  );
}
