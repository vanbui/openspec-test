import { AnalystDashboardSkeleton } from '@/features/analyst-dashboard/analyst-dashboard';
import { AnalystDashboardPageHeader } from '@/features/analyst-dashboard/analyst-dashboard-page-header';

/*
 * The dashboard's own boundary (UI-SPEC §1.5). It lives in the dashboard's route group, so it wraps
 * the dashboard alone: the three review queues keep their own boundaries and never flash this
 * skeleton, and the dashboard never flashes the Requestor dashboard's.
 */
export default function AnalystDashboardLoading() {
  return (
    <>
      <AnalystDashboardPageHeader />
      <AnalystDashboardSkeleton />
    </>
  );
}
