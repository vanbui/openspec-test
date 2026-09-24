'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/csrm/page-header';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/states/states';

export default function AssessmentReviewsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <><PageHeader title="Risk Assessment Review" description="We couldn't load the assessment review queue." /><ErrorState retry={reset} /><Link className={buttonVariants({ variant: 'outline' })} href="/app/review/requests">Back to assessment requests</Link></>;
}
