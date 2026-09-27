import { ReportNotFoundState } from '@/features/reports/report-detail';

/* Only an analyst reaches this: every other viewer gets the permission state for any key. */
export default function ReportNotFound() {
  return <ReportNotFoundState />;
}
