import { AssessmentReportSkeleton, AssessmentReportToolbarSkeleton } from '@/features/assessments/assessment-report';

/* 19-UI-SPEC §4.4: the toolbar's shape, then the document's skeleton. */
export default function RequestorReportLoading() {
  return (
    <>
      <AssessmentReportToolbarSkeleton />
      <AssessmentReportSkeleton />
    </>
  );
}
