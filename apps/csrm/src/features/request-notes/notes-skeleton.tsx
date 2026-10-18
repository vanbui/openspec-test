import { Skeleton } from '@/components/ui/skeleton';

/*
 * The Notes block of a request page's loading state (13-UI-SPEC §8.6, §14): a heading line, two notes of a header line
 * and two body lines, and the composer's textarea. It reads as the page's own loading status, so it is hidden from
 * assistive technology.
 */
export function NotesSkeleton() {
  return (
    <div aria-hidden="true" className="grid gap-4 rounded-lg border border-border p-6" data-notes-skeleton="">
      <Skeleton className="h-6 w-24" />
      {[0, 1].map((index) => (
        <div className="grid gap-2" key={index}>
          <Skeleton className="h-4 w-48 max-w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      ))}
      <Skeleton className="h-20 w-full rounded-md" />
    </div>
  );
}
