'use client';

import { ErrorState } from '@/components/states/states';
import { ReportsPageHeader } from '@/features/reports/reports-page-header';

/* retry re-fetches and re-renders the segment (Next.js 16.3), so Try again reloads the index. */
export default function ReportsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <ReportsPageHeader />
      <ErrorState noun="reports" retry={retry} />
    </>
  );
}
