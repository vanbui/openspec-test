import { ReportDetailLoading } from '@/features/reports/report-detail';

/*
 * The report route's own boundary (UI-SPEC §1.5). It cannot know the key, so it draws the Reports
 * root, a title bar and a generic report; the page then renders the real header and the report's
 * own skeleton.
 */
export default function ReportLoading() {
  return <ReportDetailLoading />;
}
