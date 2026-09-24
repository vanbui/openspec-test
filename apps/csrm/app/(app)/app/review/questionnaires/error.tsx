'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState } from '@/components/states/states';

export default function QuestionnaireReviewsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader title="Questionnaire Review" description="Review questionnaire submission status and authorised submitted responses." />
      <ErrorState retry={reset} />
    </>
  );
}
