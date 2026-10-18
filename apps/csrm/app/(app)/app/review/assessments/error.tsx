'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/csrm/page-header';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/states/states';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function AssessmentReviewsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <><PageHeader title={pageHeadings.reviewAssessments} description="We couldn't load the assessment review queue." /><ErrorState retry={retry} /><Link className={buttonVariants({ variant: 'outline' })} href="/app/review/requests">Back to assessment requests</Link></>;
}
