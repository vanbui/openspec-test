import { Skeleton } from '@/components/ui/skeleton';

/*
 * The Files block of a request page's loading state (14-UI-SPEC §3.7, §12): a heading line, three rows at the list's
 * default density from 768px or three cards below it, and a block the height of the file field. It sits before the
 * Notes block, as the section sits before Notes (UI-D2), and reads as the page's own loading status, so it is hidden
 * from assistive technology.
 */
export function FilesSkeleton() {
  const rows = [0, 1, 2];
  return (
    <div aria-hidden="true" className="grid gap-4 rounded-lg border border-border p-6" data-files-skeleton="">
      <Skeleton className="h-6 w-24" />
      <div className="hidden gap-2 md:grid">
        {rows.map((row) => <Skeleton className="h-11 w-full" data-files-skeleton-row="" key={row} />)}
      </div>
      <div className="grid gap-2 md:hidden">
        {rows.map((row) => (
          <div className="grid gap-2 rounded-lg border border-border p-3" data-files-skeleton-card="" key={row}>
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-11 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-28 w-full rounded-lg" data-files-skeleton-field="" />
    </div>
  );
}
