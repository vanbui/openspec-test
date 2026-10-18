import { PageHeader } from '@/components/csrm/page-header';
import { QuestionnaireReviewList } from '@/features/questionnaires/questionnaire-review-list';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function QuestionnaireReviewsLoading() {
  return (
    <>
      <PageHeader title={pageHeadings.reviewQuestionnaires} description="Review questionnaire submission status and authorised submitted responses." />
      <QuestionnaireReviewList questionnaires={[]} state="loading" />
    </>
  );
}
