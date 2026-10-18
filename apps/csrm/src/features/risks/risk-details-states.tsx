'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

/*
 * The Risk detail page's loading, error, permission and not-available states. They live apart from RiskDetails so the
 * route's error and loading boundaries, which ship with every Risk detail page, do not carry a second copy of it.
 */
const safeHeader = <PageHeader title="Risk details" description="View a Risk and the controls that mitigate it." />;

export function RiskDetailsSkeleton() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 300);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <>
      {safeHeader}
      <section aria-label="Loading Risk details" aria-live="polite" className="grid gap-8" role="status">
        <span className="sr-only">Loading Risk details</span>
        {visible ? <><Skeleton className="h-10 w-full max-w-xl motion-reduce:animate-none" />{Array.from({ length: 5 }, (_, index) => <div className="grid gap-4 rounded-lg border border-border p-6" data-slot="risk-detail-skeleton-section" key={index}><Skeleton className="h-7 w-52 motion-reduce:animate-none" /><Skeleton className="h-24 w-full motion-reduce:animate-none" /></div>)}</> : null}
      </section>
    </>
  );
}

export function RiskDetailsState({ kind }: { kind: 'not-available' | 'error' | 'permission' }) {
  const content = kind === 'permission'
    ? { title: 'You don’t have permission to view the Risk register', body: 'The Risk register is for Security Analysts. Home shows the work you can open.' }
    : kind === 'error'
      ? { title: 'We couldn’t load this Risk', body: 'Try again. If the problem continues, contact your CSRM administrator.' }
      : { title: 'Risk not available', body: 'This Risk may no longer exist or may not be available to you.' };
  return (
    <>
      {safeHeader}
      <Alert role="alert"><AlertTitle>{content.title}</AlertTitle><AlertDescription>{content.body}</AlertDescription>{kind === 'permission' ? <Button asChild className="mt-4" variant="outline"><Link href="/app">Go to Home</Link></Button> : null}{kind === 'error' ? <Button className="mt-4" type="button" variant="outline" onClick={() => window.location.reload()}>Try again</Button> : null}</Alert>
    </>
  );
}
