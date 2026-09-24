'use client';

import { PageHeader } from '@/components/shell/app-shell';
import { Button } from '@/components/ui/button';

export default function RisksError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <><PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." /><section className="space-y-2 rounded-lg border border-border bg-surface p-6 text-center" role="alert"><h2 className="text-xl font-semibold text-foreground">We couldn’t load the Risk Register</h2><p className="text-sm text-muted-foreground">Try again. If the problem continues, contact your CSRM administrator.</p><Button type="button" variant="outline" onClick={reset}>Try again</Button></section></>;
}
