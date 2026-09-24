import { Skeleton } from '@/components/ui/skeleton';

export default function RequestDetailLoading() {
  return (
    <section aria-label="Loading assessment request" className="grid gap-6" role="status">
      <div className="grid gap-3"><Skeleton className="h-8 w-2/3 max-w-md" /><Skeleton className="h-4 w-40" /></div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <Skeleton className="h-40 w-full rounded-lg" />
    </section>
  );
}
