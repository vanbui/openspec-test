import { PageHeader } from '@/components/csrm/page-header';
import { ReleasedAssessmentListSkeleton } from '@/features/assessments/released-assessment';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function AssessmentsLoading() {
  return (
    <>
      <PageHeader title={pageHeadings.myRiskAssessments} description="View risk assessments released for your authorised requests." />
      <ReleasedAssessmentListSkeleton />
    </>
  );
}
