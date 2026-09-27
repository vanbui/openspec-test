import { ChevronRightIcon } from 'lucide-react';
import Link from 'next/link';

import { EmptyState } from '@/components/states/states';
import { Skeleton } from '@/components/ui/skeleton';
import type { ReportDefinition } from './report-schema';

/*
 * The report index (UI-SPEC §4.1). Every card comes from a definition the server returned, in the
 * server's order (D-13): the index shows no report the analyst's grants do not serve.
 */

/*
 * A card is the widget frame on a white surface. The title link's box stretches over the whole
 * card, so the card is one hit area with one tab stop, and the card rather than the link text draws
 * the focus ring. Hover darkens the hairline to ink and lifts the card only when motion is welcome
 * (direction §4 Cards). The chevron is the at-rest cue that the block opens something (X-13).
 */
const reportCardClassName =
  'relative flex h-full min-w-0 flex-col gap-2 rounded-lg border border-border bg-surface p-5 text-foreground '
  + 'transition-[border-color,transform] duration-(--duration-fast) ease-out-expo hover:border-line-ink-20 motion-safe:hover:-translate-y-px '
  + 'has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring';

/* One column below md and two from md; list gaps follow the grid gap (§3.9). */
const reportGridClassName = 'grid gap-gutter-xs sm:gap-gutter-sm md:grid-cols-2';

function ReportCard({ definition }: { definition: ReportDefinition }) {
  return (
    <li className="min-w-0">
      <div className={reportCardClassName} data-slot="report-card">
        <div className="flex min-w-0 items-start gap-2">
          <h2 className="min-w-0 flex-1 text-heading-sm text-foreground">
            <Link
              className="after:absolute after:inset-0 after:rounded-lg focus-visible:outline-none"
              href={`/app/reports/${encodeURIComponent(definition.key)}`}
            >
              {definition.title}
            </Link>
          </h2>
          <ChevronRightIcon aria-hidden="true" className="mt-1 size-4 shrink-0 text-muted-foreground" />
        </div>
        <p className="text-sm text-foreground-secondary">{definition.description}</p>
      </div>
    </li>
  );
}

/**
 * The served report definitions as cards, or the cleared state when the server lists none. The list
 * keeps an explicit list role: its markers are removed, and some screen readers then drop list
 * semantics unless the role is stated.
 */
export function ReportIndex({ definitions }: { definitions: readonly ReportDefinition[] }) {
  if (definitions.length === 0) {
    return <EmptyState description="Reports available to your role appear here." kind="cleared" noun="reports" />;
  }

  return (
    <ul aria-label="Reports" className={reportGridClassName} data-slot="report-index" role="list">
      {definitions.map((definition) => <ReportCard definition={definition} key={definition.key} />)}
    </ul>
  );
}

/** The loading index: one card skeleton per report, with a title bar and two description bars. */
export function ReportIndexSkeleton() {
  return (
    <div aria-label="Loading reports" aria-live="polite" role="status">
      <span className="sr-only">Loading reports</span>
      <div className={reportGridClassName}>
        {Array.from({ length: 4 }, (_, index) => (
          <div className="flex min-w-0 flex-col gap-3 rounded-lg border border-border bg-surface p-5" data-slot="report-card-skeleton" key={index}>
            <Skeleton className="h-5 w-2/5" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
