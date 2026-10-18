import type { ReactNode } from 'react';

import { RecordLink } from '@/components/csrm/record-link';
import { EmptyState } from '@/components/states/states';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ReportEmptyCopy, ReportTextLink } from './report-presentation';

export type ReportSectionProps = {
  /** The section's element id; its heading id derives from it. */
  id: string;
  caption: string;
  /** One line stating the measure and the population. */
  description: string;
  /** The hidden graphic. Its text equivalent is `table`. */
  chart?: ReactNode;
  /** The visible table: the chart's text equivalent, or the whole body of a table-only section. */
  table?: ReactNode;
  /** Replaces the body when the section's population is empty. A time series never passes one. */
  empty?: ReportEmptyCopy;
  /** Truncation and coverage notes, shown only when they apply. */
  notes?: readonly string[];
  /** Links that follow the notes, such as the coverage note's View Critical and View High (UI-SPEC §9.3). */
  noteLinks?: readonly ReportTextLink[];
  /** Any other body, such as a bounded list of shared alert rows and its footer. */
  children?: ReactNode;
};

function ReportSectionEmpty({ copy }: { copy: ReportEmptyCopy }) {
  return copy.kind === 'cleared'
    ? <EmptyState density="compact" description={copy.description} headingLevel="h3" kind="cleared" noun={copy.noun} />
    : <EmptyState density="compact" description={copy.description} headingLevel="h3" noun={copy.noun} />;
}

/**
 * One report section (UI-SPEC §4.3): the widget card, because severity renders only on a white
 * surface, with a micro-label caption and a line naming what is counted. The section is a
 * container, so its body adapts to its own width: the chart comes first, then its table, and the
 * two sit side by side once the section is wide enough.
 */
export function ReportSection({ caption, chart, children, description, empty, id, noteLinks, notes, table }: ReportSectionProps) {
  const headingId = `${id}-heading`;

  return (
    <Card className="min-w-0 gap-0 py-5">
      <section aria-labelledby={headingId} className="@container min-w-0 px-5" data-slot="report-section" id={id}>
        <h2 className="micro-label text-muted-foreground" id={headingId}>{caption}</h2>
        <p className="mt-1 text-sm text-foreground-secondary">{description}</p>
        <div className="mt-4 space-y-4">
          {empty ? <ReportSectionEmpty copy={empty} /> : (
            <>
              {chart || table ? (
                <div className={cn('grid min-w-0 gap-gutter-xs sm:gap-gutter-sm', chart && table ? '@4xl:grid-cols-2' : undefined)}>
                  {chart ? <div className="min-w-0">{chart}</div> : null}
                  {table ? <div className="min-w-0">{table}</div> : null}
                </div>
              ) : null}
              {children}
              {notes && notes.length > 0 ? (
                <div className="space-y-1" data-slot="report-section-notes">
                  {notes.map((note) => <p className="text-xs tabular-nums text-foreground-secondary" key={note}>{note}</p>)}
                  {noteLinks && noteLinks.length > 0 ? (
                    <p className="flex flex-wrap gap-x-4 text-xs" data-slot="report-section-note-links">
                      {noteLinks.map((link) => (
                        <RecordLink aria-label={link.accessibleName} className="inline-flex min-h-6 items-center" href={link.href} key={link.href}>
                          {link.label}
                        </RecordLink>
                      ))}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </>
          )}
        </div>
      </section>
    </Card>
  );
}

/** A loading section in the same card: caption and description bars, bar rows, then table rows. */
export function ReportSectionSkeleton() {
  return (
    <Card className="min-w-0 gap-0 py-5" data-slot="report-section-skeleton">
      <div className="space-y-4 px-5">
        <div className="space-y-2">
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-5 w-full max-w-md" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="space-y-1" key={index}>
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-chart-bar-thickness w-2/3" />
            </div>
          ))}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 3 }, (_, index) => <Skeleton className="h-8 w-full" key={index} />)}
        </div>
      </div>
    </Card>
  );
}
