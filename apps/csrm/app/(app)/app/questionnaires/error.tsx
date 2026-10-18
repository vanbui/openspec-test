'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState } from '@/components/states/states';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function QuestionnairesError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <PageHeader
        title={pageHeadings.myQuestionnaires}
        description="Complete the questionnaires assigned to assessment requests you are authorised to view."
      />
      <ErrorState retry={retry} />
    </>
  );
}
