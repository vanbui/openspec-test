import { AssessmentRequestListSkeleton, AssignedRequestListHeader } from '@/features/assessments/assessment-list';

export default function AssignedRequestsLoading() {
  return <><AssignedRequestListHeader /><AssessmentRequestListSkeleton view="assigned" /></>;
}
