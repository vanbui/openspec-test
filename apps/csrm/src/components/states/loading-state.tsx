import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export function LoadingState() {
  return (
    <section aria-label="Loading page" className="min-w-0" role="status">
      <span className="sr-only">Loading page</span>
      <Card className="w-full min-w-0">
        <CardHeader>
          <Skeleton className="h-6 w-48" data-testid="loading-skeleton" />
        </CardHeader>
        <CardContent className="grid gap-sm">
          <Skeleton className="h-5 w-full" data-testid="loading-skeleton" />
          <Skeleton className="h-5 w-4/5" data-testid="loading-skeleton" />
        </CardContent>
      </Card>
    </section>
  );
}
