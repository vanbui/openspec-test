import { ReportIndexSkeleton } from '@/features/reports/report-index';
import { ReportsPageHeader } from '@/features/reports/reports-page-header';

/*
 * The index's own boundary (UI-SPEC §1.5). It lives in the index route group, so it wraps the index
 * alone: a report opened from anywhere never flashes the index skeleton.
 */
export default function ReportsLoading() {
  return (
    <>
      <ReportsPageHeader />
      <ReportIndexSkeleton />
    </>
  );
}
