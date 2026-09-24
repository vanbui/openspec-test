import { Skeleton } from '@/components/ui/skeleton';

export function RequestFormLoading({ title }: { title: string }) {
  return (
    <section aria-label={`Loading ${title.toLowerCase()}`} className="grid w-full max-w-2xl gap-8" role="status">
      <div className="grid gap-2">
        <Skeleton className="h-8 w-72 max-w-full" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      {['Request overview', 'Business context', 'Scope and timing'].map((section) => (
        <div key={section} className="grid gap-4 rounded-lg border border-border bg-surface p-5">
          <span className="sr-only">{section}</span>
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-9 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ))}
    </section>
  );
}
