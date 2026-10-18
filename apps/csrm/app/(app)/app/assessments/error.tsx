'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState } from '@/components/states/states';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function AssessmentsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <PageHeader title={pageHeadings.myRiskAssessments} description="View risk assessments released for your authorised requests." />
      <ErrorState retry={retry} />
    </>
  );
}
