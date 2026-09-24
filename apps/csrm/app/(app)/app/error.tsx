'use client';

import { PageHeader } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';

export default function DashboardError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your authorised requests, questionnaires, and released assessment activity."
      />
      <section className="state" role="alert">
        <h2>We couldn’t load your dashboard</h2>
        <p>Try again. If the problem continues, contact your administrator.</p>
        <Button type="button" onClick={reset}>Try again</Button>
      </section>
    </>
  );
}
