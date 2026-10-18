'use client';

import Link from 'next/link';
import { ChevronDown, ChevronRight, Menu, X } from 'lucide-react';
import { usePathname, useRouter } from 'next/navigation';
import { Fragment, Suspense, use, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { can, type Capability } from '../../lib/capabilities/capability-adapter';
import {
  activeNavigationHref,
  navigationCountMeaning,
  navigationProfileFor,
  profileItems,
  sectionNavigationCount,
  shownNavigationCount,
  type NavigationCountKey,
  type NavigationCounts,
  type NavigationItem,
  type NavigationProfile,
  type NavigationSection,
} from '../../config/navigation/navigation';
import { Dialog } from 'radix-ui';
import { Button } from '../ui/button';
import { useNavigationGuard } from '../csrm/navigation-guard';
import { cn } from '../../lib/utils';

interface CapabilityNavigationProps {
  granted: ReadonlySet<Capability>;
  /**
   * The viewer's counts, streamed from the layout unawaited (D-11). Each count renders in its own Suspense
   * boundary with no fallback, so no link waits for it; without this prop the navigation shows no count.
   */
  counts?: Promise<NavigationCounts>;
  /**
   * The profile to render; the viewer's own (navigationProfileFor) unless a caller supplies one. It is
   * chosen here, on the client, because its icons are components that cannot cross from the server.
   */
  profile?: NavigationProfile;
  /**
   * Runs when one of the links navigates (the mobile sheet closes itself). While the page has unsaved
   * work it runs only once the person chooses to leave, so a blocked link leaves the sheet open.
   */
  onNavigated?: () => void;
}

/** Reads one figure from the streamed counts. */
type CountRead = (counts: NavigationCounts) => number | undefined;

interface CountSource {
  counts: Promise<NavigationCounts>;
  read: CountRead;
  /** The key whose meaning follows the number in the name. */
  countKey: NavigationCountKey;
}

/*
 * A count joins its link's name through the content, never an aria-label (UI-SPEC §1.3, research Pitfall 5):
 * the label, a hidden comma, the visible number and the hidden meaning read "My requests, 3 need your
 * action", so the visible words start the name (WCAG 2.5.3). The comma sits inline inside the label's own
 * element, because a flex item or a visually hidden element is a block whose name gains a space on each
 * side, which would read "My requests , 3". Zero and an unknown figure render nothing, and each part waits
 * for the counts in its own Suspense boundary with no fallback, so the link never waits.
 */
function CountSeparator({ counts, read }: CountSource) {
  return shownNavigationCount(read(use(counts))) === null ? null : <span className="nav-count-separator">,</span>;
}

function CountTag({ counts, read, countKey }: CountSource) {
  const value = read(use(counts));
  const shown = shownNavigationCount(value);
  // A settled zero and an unavailable read look alike, but remain distinct for the browser proofs.
  const state = <span hidden data-nav-count-state={value === undefined ? 'unavailable' : 'ready'} data-nav-count-value={value} />;
  if (shown === null) return state;

  return (
    <>
      {state}
      {' '}
      <span className="nav-count micro-label">{shown}</span>
      {' '}
      <span className="sr-only">{navigationCountMeaning(countKey, shown)}</span>
    </>
  );
}

function LabelWithCount({ label, count }: { label: string; count?: CountSource }) {
  return (
    <>
      <span className="nav-link-label">
        {label}
        {count ? <Suspense fallback={null}><CountSeparator {...count} /></Suspense> : null}
      </span>
      {count ? <Suspense fallback={null}><CountTag {...count} /></Suspense> : null}
    </>
  );
}

/*
 * Presentation only: which links show follows the granted capabilities, and every route gate and Strapi
 * policy still authorises each read behind them. The profile's primary action renders first, then each
 * section that holds a visible item, in the profile's order. Nothing here names a section (D-13).
 *
 * A collapsible section starts open when the profile says so or when the current page is one of its
 * items, opens itself on a navigation to one of them, and never closes itself; only its button closes
 * it. The state lives in this component alone, so every full load starts afresh (UI-D7). Its items are
 * not rendered while it is closed, so they are neither in the tab order nor prefetched.
 */
export function CapabilityNavigation({ granted, counts, profile: suppliedProfile, onNavigated }: CapabilityNavigationProps) {
  const pathname = usePathname();
  const router = useRouter();
  const guard = useNavigationGuard();
  const idBase = useId();
  /* Next's Link calls onClick before onNavigate, and onNavigate never sees the DOM event (link.js). */
  const activated = useRef<HTMLAnchorElement | null>(null);
  const profile = suppliedProfile ?? navigationProfileFor(granted);
  const isVisible = (item: NavigationItem) => can(item.capability, granted);
  const activeHref = activeNavigationHref(pathname, profileItems(profile).filter(isVisible));
  const primaryAction = profile.primaryAction && isVisible(profile.primaryAction) ? profile.primaryAction : null;
  const sections = profile.sections
    .map((section) => ({ section, items: section.items.filter(isVisible) }))
    .filter((entry) => entry.items.length > 0);
  const holdsCurrentPage = (section: NavigationSection) => activeHref !== null && section.items.some((item) => item.href === activeHref && isVisible(item));
  const [openSections, setOpenSections] = useState<Readonly<Record<string, boolean>>>(() => Object.fromEntries(
    profile.sections
      .filter((section) => section.collapsible)
      .map((section) => [section.id, !section.collapsible?.defaultCollapsed || holdsCurrentPage(section)]),
  ));
  const currentCollapsibleId = profile.sections.find((section) => section.collapsible && holdsCurrentPage(section))?.id ?? null;

  useEffect(() => {
    if (currentCollapsibleId === null) return;
    setOpenSections((open) => (open[currentCollapsibleId] ? open : { ...open, [currentCollapsibleId]: true }));
  }, [currentCollapsibleId, pathname]);

  const itemCount = (item: NavigationItem): CountSource | undefined => {
    const key = item.count;
    return counts && key ? { counts, countKey: key, read: (figures) => figures[key] } : undefined;
  };

  /* A collapsed section's button carries its items' count, so personal work is never hidden (D-10). */
  const sectionCount = (items: readonly NavigationItem[]): CountSource | undefined => {
    const key = items.find((item) => item.count)?.count;
    return counts && key ? { counts, countKey: key, read: (figures) => sectionNavigationCount(figures, items) } : undefined;
  };

  const isOpen = (section: NavigationSection) => openSections[section.id] ?? (!section.collapsible?.defaultCollapsed || holdsCurrentPage(section));

  const renderLink = (item: NavigationItem, options: { variant?: 'item' | 'primary-action'; prefetch?: 'intent' } = {}) => {
    const Icon = item.icon;
    const isPrimaryAction = options.variant === 'primary-action';
    /* An occasional destination is fetched only once the person shows intent (UI-D8). */
    const intentPrefetch = options.prefetch === 'intent'
      ? { prefetch: false, onFocus: () => router.prefetch(item.href), onPointerEnter: () => router.prefetch(item.href) }
      : {};

    /*
     * The key comes before the spread: Next's compiler turns a key after a spread into createElement with the
     * children in props, which React reads as an unkeyed list inside Link's anchor (a development key warning).
     */
    return (
      <Link
        key={item.href}
        {...intentPrefetch}
        aria-current={!isPrimaryAction && item.href === activeHref ? 'page' : undefined}
        className={isPrimaryAction ? 'nav-primary-action' : 'nav-link'}
        href={item.href}
        onClick={(event) => {
          activated.current = event.currentTarget;
          if (!guard.blocking) onNavigated?.();
        }}
        onNavigate={(event) => guard.guardLink(event, { href: item.href, trigger: activated.current, onLeave: onNavigated })}
      >
        <Icon aria-hidden="true" className="nav-link-icon" />
        <LabelWithCount label={item.label} count={itemCount(item)} />
      </Link>
    );
  };

  const renderSection = (section: NavigationSection, items: readonly NavigationItem[]) => {
    const links = () => items.map((item) => renderLink(item, { prefetch: section.prefetch }));

    if (section.label === null) return <Fragment key={section.id}>{links()}</Fragment>;

    if (section.collapsible) {
      const groupId = `${idBase}-${section.id}`;
      const open = isOpen(section);
      const Chevron = open ? ChevronDown : ChevronRight;

      return (
        <div className="mt-4 space-y-1 border-t border-sidebar-border pt-3" key={section.id}>
          <button
            aria-controls={groupId}
            aria-expanded={open}
            className="nav-section-toggle micro-label"
            onClick={() => setOpenSections((current) => ({ ...current, [section.id]: !open }))}
            type="button"
          >
            <Chevron aria-hidden="true" className="nav-link-icon" />
            <LabelWithCount label={section.label} count={open ? undefined : sectionCount(items)} />
          </button>
          <div aria-label={section.label} className="space-y-1" hidden={!open} id={groupId} role="group">
            {open ? links() : null}
          </div>
        </div>
      );
    }

    return (
      <div aria-label={section.label} className="mt-4 space-y-1 border-t border-sidebar-border pt-3" key={section.id} role="group">
        <p className="micro-label px-3 text-sidebar-muted">{section.label}</p>
        {links()}
      </div>
    );
  };

  return (
    <nav aria-label="Primary navigation">
      {primaryAction ? renderLink(primaryAction, { variant: 'primary-action' }) : null}
      {sections.map(({ section, items }) => renderSection(section, items))}
    </nav>
  );
}

interface MobileNavigationProps {
  granted: ReadonlySet<Capability>;
  /** The viewer's counts, the same promise the sidebar reads (D-12). */
  counts?: Promise<NavigationCounts>;
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

export function MobileNavigation({ granted, counts, footer }: MobileNavigationProps) {
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
          <CapabilityNavigation counts={counts} granted={granted} onNavigated={closeNavigation} />
          {footer ? <div className="shell-footer">{footer}</div> : null}
        </NavigationSheetContent>
      </Dialog.Root>
    </>
  );
}
