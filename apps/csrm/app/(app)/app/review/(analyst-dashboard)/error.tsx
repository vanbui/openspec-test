'use client';

import { ErrorState } from '@/components/states/states';
import { AnalystDashboardPageHeader } from '@/features/analyst-dashboard/analyst-dashboard-page-header';
import { analystDashboardCopy } from '@/features/analyst-dashboard/analyst-dashboard-presentation';

/* retry re-fetches and re-renders the segment (Next.js 16.3), so Try again reloads the dashboard. */
export default function AnalystDashboardError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <AnalystDashboardPageHeader />
      <ErrorState noun={analystDashboardCopy.area} retry={retry} />
    </>
  );
}
