import { Skeleton } from '@/components/ui/skeleton';

export default function QuestionnaireDetailLoading() {
  return (
    <section aria-label="Loading questionnaire" className="grid gap-6" role="status">
      <span className="sr-only">Loading questionnaire…</span>
      <div className="grid gap-3"><Skeleton className="h-8 w-2/3 max-w-md" /><Skeleton className="h-4 w-48" /></div>
      <Skeleton className="h-24 w-full max-w-3xl rounded-lg" />
      <Skeleton className="h-80 w-full max-w-3xl rounded-lg" />
    </section>
  );
}
