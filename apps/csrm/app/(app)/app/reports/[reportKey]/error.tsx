'use client';

import { ErrorState } from '@/components/states/states';
import { ReportsPageHeader } from '@/features/reports/reports-page-header';

/*
 * The boundary cannot know which report failed, so it keeps the Reports header. retry re-fetches
 * and re-renders the segment (Next.js 16.3).
 */
export default function ReportError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <ReportsPageHeader />
      <ErrorState noun="this report" retry={retry} />
    </>
  );
}
