'use client';

import { PageHeader } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';

export default function RequestsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader title="My Requests" description="Find and track the cyber risk assessment requests you are authorised to view." />
      <section className="state" role="alert">
        <h2>We couldn’t load your requests</h2>
        <p>Try again. If the problem continues, contact your administrator.</p>
        <Button type="button" onClick={reset}>Try again</Button>
      </section>
    </>
  );
}
