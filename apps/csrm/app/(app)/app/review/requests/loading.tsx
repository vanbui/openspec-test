import { AssessmentRequestListHeader, AssessmentRequestListSkeleton } from '@/features/assessments/assessment-list';

export default function AssessmentRequestsLoading() {
  return <><AssessmentRequestListHeader /><AssessmentRequestListSkeleton /></>;
}
