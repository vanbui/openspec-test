import { PageHeader } from '@/components/csrm/page-header';
import { ReleasedAssessmentListSkeleton } from '@/features/assessments/released-assessment';

export default function AssessmentsLoading() {
  return (
    <>
      <PageHeader title="My Risk Assessments" description="View risk assessments released for your authorised requests." />
      <ReleasedAssessmentListSkeleton />
    </>
  );
}
