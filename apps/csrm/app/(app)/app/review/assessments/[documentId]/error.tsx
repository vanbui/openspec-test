'use client';

import Link from 'next/link';
import { buttonVariants } from '@/components/ui/button';
import { ErrorState } from '@/components/states/states';

export default function AssessmentReviewError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <div className="grid gap-4"><h1 className="text-heading-lg font-display">Risk assessment review unavailable</h1><p className="text-muted-foreground">We couldn't load this assessment.</p><ErrorState retry={reset} /><Link className={buttonVariants({ variant: 'outline' })} href="/app/review/assessments">Back to assessment reviews</Link></div>;
}
