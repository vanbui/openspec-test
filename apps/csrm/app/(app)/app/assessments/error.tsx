'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { ErrorState } from '@/components/states/states';

export default function AssessmentsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader title="My Risk Assessments" description="View risk assessments released for your authorised requests." />
      <ErrorState retry={reset} />
    </>
  );
}
