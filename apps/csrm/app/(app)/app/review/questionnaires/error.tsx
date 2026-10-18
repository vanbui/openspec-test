'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState } from '@/components/states/states';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function QuestionnaireReviewsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <PageHeader title={pageHeadings.reviewQuestionnaires} description="Review questionnaire submission status and authorised submitted responses." />
      <ErrorState retry={retry} />
    </>
  );
}
