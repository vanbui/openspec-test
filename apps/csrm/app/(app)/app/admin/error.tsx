'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { Button } from '@/components/ui/button';

export default function AdministrationError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <><PageHeader title="Administration" description="Manage reusable CSRM reference data." /><section className="space-y-2 rounded-lg border border-border bg-surface p-6 text-center" role="alert"><h2 className="text-xl font-semibold text-foreground">We couldn’t load Administration</h2><p className="text-sm text-muted-foreground">Try again. If the problem continues, contact your CSRM administrator.</p><Button type="button" variant="outline" onClick={reset}>Try again</Button></section></>;
}
