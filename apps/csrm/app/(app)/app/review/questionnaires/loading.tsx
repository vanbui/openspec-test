import { PageHeader } from '@/components/csrm/page-header';
import { QuestionnaireReviewList } from '@/features/questionnaires/questionnaire-review-list';

export default function QuestionnaireReviewsLoading() {
  return (
    <>
      <PageHeader title="Questionnaire Review" description="Review questionnaire submission status and authorised submitted responses." />
      <QuestionnaireReviewList questionnaires={[]} state="loading" />
    </>
  );
}
