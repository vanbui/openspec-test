import type { LucideIcon } from 'lucide-react';
import Link from 'next/link';
import type { ReactNode } from 'react';

import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

/*
 * The Home widget frame both Homes share (UI-SPEC §5.2, UI-D16): the card, its icon and heading, the one-line
 * description, the body and any footer. It was the analyst dashboard's DashboardWidget and moved here unchanged,
 * so the Requestor Home's sections and the analyst Home's widgets are one component. Every section is a region
 * named by its h2, and its rows follow the section's own width (`@container`, UI-D14).
 */

/** What a section's frame names: its heading, the heading's id, its icon and its one-line description. */
export type HomeSectionCopy = {
  heading: string;
  headingId: string;
  icon: LucideIcon;
  /** One line stating what the section holds. */
  description: string;
};

/** A footer link: it opens exactly the section's own records. */
export type HomeSectionLink = { label: string; href: string };

/* The Home grid: one column, two from lg, gaps at the grid gap (direction §3.9). */
export const homeGridClassName = 'grid min-w-0 grid-cols-1 gap-gutter-xs sm:gap-gutter-sm lg:grid-cols-2';

/* A record row in the shipped DashboardItem rhythm: hairlines between rows, none outside. */
export const homeRowClassName = 'border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0';

/*
 * A link row (UI-SPEC §2.4, §5.3): the whole row is one link at least the default table row height, with
 * the chevron as its at-rest cue. The hover tint reaches past the text edge, as the bar rows' does. The
 * Review queue and Your own requests share it.
 */
export const homeLinkRowClassName =
  '-mx-2 flex min-h-11 items-center gap-3 rounded-md px-2 text-sm text-foreground '
  + 'transition-colors duration-(--duration-micro) ease-standard hover:bg-surface-hover';

/*
 * A footer text link: ink with its at-rest underline, the button type size, and the touch-target
 * height below md. Written out rather than merged, because a merge drops the type token beside a
 * text colour.
 */
const footerLinkClassName =
  'inline-flex min-h-11 items-center text-button text-foreground underline decoration-muted-foreground underline-offset-3 '
  + 'transition-colors duration-(--duration-micro) ease-standard hover:decoration-foreground md:min-h-6';

/** The widget frame: the card, its icon and heading, the one-line predicate, the body and any footer. */
export function HomeSection({ children, className, copy, footer }: {
  children: ReactNode;
  className?: string;
  copy: HomeSectionCopy;
  footer?: ReactNode;
}) {
  const Icon = copy.icon;

  return (
    <Card className={cn('min-w-0 gap-0 py-5', className)}>
      <section aria-labelledby={copy.headingId} className="@container flex min-w-0 flex-1 flex-col px-5" data-slot="dashboard-widget">
        <div className="flex items-center gap-2">
          <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
          <h2 className="text-heading-sm text-foreground" id={copy.headingId}>{copy.heading}</h2>
        </div>
        <p className="mt-2 text-sm text-foreground-secondary">{copy.description}</p>
        {/*
         * The footer follows the rows rather than pinning to the card's bottom edge. Paired
         * widgets share a row height, so a sparse widget's spare height falls after its footer,
         * where it reads as room to grow, instead of opening a band between rows and links
         * (07-UI-REVIEW finding 1).
         */}
        <div className="mt-4">{children}</div>
        {footer}
      </section>
    </Card>
  );
}

/** The truncation note, then the links that open the section's own predicate. */
export function HomeSectionFooter({ links, note }: { links: readonly HomeSectionLink[]; note: string | null }) {
  if (!note && links.length === 0) return null;

  return (
    <div className="mt-4 flex flex-col gap-1 border-t border-border pt-4" data-slot="dashboard-widget-footer">
      {note ? <p className="text-xs tabular-nums text-foreground-secondary">{note}</p> : null}
      {links.length > 0 ? (
        <div className="flex flex-wrap gap-x-4">
          {links.map((link) => <Link className={footerLinkClassName} href={link.href} key={link.href}>{link.label}</Link>)}
        </div>
      ) : null}
    </div>
  );
}

/** A loading section in the same card: the icon and title, the description, three two-line rows, then the footer line. */
export function HomeSectionSkeleton({ className, withFooter = false }: { className?: string; withFooter?: boolean }) {
  return (
    <Card className={cn('min-w-0 gap-0 py-5', className)} data-slot="dashboard-widget-skeleton">
      <div className="px-5">
        <div className="flex h-6 items-center gap-2">
          <Skeleton className="size-4" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="mt-2 h-5 w-full max-w-sm" />
        <div className="mt-4">
          {Array.from({ length: 3 }, (_, index) => (
            <div className={homeRowClassName} key={index}>
              <Skeleton className="h-5 w-2/5" />
              <Skeleton className="mt-2 h-4 w-4/5" />
            </div>
          ))}
        </div>
        {withFooter ? <Skeleton className="mt-4 h-4 w-48" /> : null}
      </div>
    </Card>
  );
}
