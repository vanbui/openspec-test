'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState } from '@/components/states/states';

export default function QuestionnairesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader
        title="My Questionnaires"
        description="Complete the questionnaires assigned to assessment requests you are authorised to view."
      />
      <ErrorState retry={reset} />
    </>
  );
}
