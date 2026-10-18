'use client';

import Link from 'next/link';
import { PageHeader } from '@/components/csrm/page-header';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/states/states';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function AssignedRequestsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <><PageHeader title={pageHeadings.assignedToMe} description="We couldn’t load the requests assigned to you." /><ErrorState retry={retry} /><Link className={buttonVariants({ variant: 'outline' })} href="/app">Go to Home</Link></>;
}
