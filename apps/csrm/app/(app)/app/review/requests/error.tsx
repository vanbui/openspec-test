'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/csrm/page-header';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/states/states';

export default function AssessmentRequestsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <><PageHeader title="Assessment Request Review" description="We couldn't load submitted assessment requests." /><ErrorState retry={reset} /><Link className={buttonVariants({ variant: 'outline' })} href="/app">Go to Home</Link></>;
}
