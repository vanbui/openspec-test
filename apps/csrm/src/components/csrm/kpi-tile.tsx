import type { LucideIcon } from 'lucide-react';
import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';
import { Children, type ComponentProps } from 'react';

import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type KpiTileIconTone = 'muted' | 'danger' | 'warning' | 'info';

export type KpiTileProps = {
  /** Sentence case; `.micro-label` renders it uppercase. */
  caption: string;
  /** A count the server supplied, or null when it could not supply one. */
  value: number | null;
  /** Names what is counted, so a caption such as "Overdue" is never ambiguous. */
  supportingText?: string;
  /** Opens the list this tile summarises, filtered by the tile's own predicate. */
  href?: string;
  icon?: LucideIcon;
  iconTone?: KpiTileIconTone;
};

const kpiValueFormat = new Intl.NumberFormat('en-AU');

const iconToneClassNames = {
  muted: 'text-muted-foreground',
  danger: 'text-destructive',
  warning: 'text-warning',
  info: 'text-info',
} satisfies Record<KpiTileIconTone, string>;

/*
 * The frame every tile and tile skeleton shares (direction §4 Cards / KPI tiles). The caption,
 * value and supporting lines sit on a row subgrid, so inside a KpiTileStrip they align across a
 * row of tiles even when one caption wraps. A tile outside a strip lays out as a plain grid.
 */
const tileFrameClassName =
  'row-span-3 grid min-w-0 grid-rows-subgrid gap-y-2 rounded-lg border border-border bg-surface p-5 text-foreground';

/*
 * A link tile lifts and darkens its hairline on hover (direction §4 Cards). The lift is motion,
 * so it only applies when motion is welcome; the border change still confirms the hover.
 */
const linkTileClassName =
  'transition-[border-color,transform] duration-(--duration-fast) ease-out-expo hover:border-line-ink-20 motion-safe:hover:-translate-y-px';

function KpiTileContent({
  caption,
  icon: Icon,
  iconTone = 'muted',
  linked,
  supportingText,
  value,
}: Omit<KpiTileProps, 'href'> & { linked: boolean }) {
  return (
    <>
      <div className="flex min-w-0 items-start gap-2">
        {Icon ? <Icon aria-hidden="true" className={cn('mt-0.5 size-3 shrink-0', iconToneClassNames[iconTone])} /> : null}
        <span className="micro-label min-w-0 flex-1 text-muted-foreground">{caption}</span>
        {linked ? <ChevronRightIcon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" /> : null}
      </div>
      {value === null ? (
        // Never a zero or a dash: an unavailable figure says so, at body size.
        <p className="self-end text-sm text-foreground-secondary" data-slot="kpi-tile-value">
          Not available
        </p>
      ) : (
        <p className="text-display tabular-nums text-foreground" data-slot="kpi-tile-value">
          {kpiValueFormat.format(value)}
        </p>
      )}
      {/* A delta would sit here, between the value and the supporting line. None is fabricated: no
          Phase 7 figure has an honest comparison period (UI-D6). */}
      {supportingText ? <p className="text-xs text-foreground-secondary">{supportingText}</p> : null}
    </>
  );
}

/**
 * One headline figure. A tile with `href` is a single link whose accessible name is its visible
 * content in reading order (caption, value, supporting line); a tile without one is a still block,
 * told apart at rest by the missing chevron.
 */
export function KpiTile({ href, ...content }: KpiTileProps) {
  if (href) {
    return (
      <Link className={cn(tileFrameClassName, linkTileClassName)} data-slot="kpi-tile" href={href}>
        <KpiTileContent {...content} linked />
      </Link>
    );
  }

  return (
    <div className={tileFrameClassName} data-slot="kpi-tile">
      <KpiTileContent {...content} linked={false} />
    </div>
  );
}

export type KpiTileStripProps = ComponentProps<'ul'>;

/**
 * A row of tiles as a list, so assistive technology announces how many there are. Each child is
 * wrapped in its own list item; the caller sets the column count (for example `sm:grid-cols-2`).
 * The list role is explicit: the markers are removed, and some screen readers then drop list
 * semantics unless the role is stated.
 */
export function KpiTileStrip({ children, className, ...props }: KpiTileStripProps) {
  return (
    <ul className={cn('grid gap-gutter-xs sm:gap-gutter-sm', className)} data-slot="kpi-tile-strip" role="list" {...props}>
      {Children.map(children, (child) =>
        child === null || child === undefined || typeof child === 'boolean' ? null : (
          <li className="row-span-3 grid min-w-0 grid-rows-subgrid">{child}</li>
        ),
      )}
    </ul>
  );
}

/** The loading form of a tile: the same frame, with blocks sized to each line it will hold. */
export function KpiTileSkeleton({ hasSupportingText = true }: { hasSupportingText?: boolean }) {
  return (
    <div className={tileFrameClassName} data-slot="kpi-tile-skeleton">
      <Skeleton className="h-4 w-3/5" />
      <Skeleton className="h-9 w-16" />
      {hasSupportingText ? <Skeleton className="h-4 w-4/5" /> : null}
    </div>
  );
}
