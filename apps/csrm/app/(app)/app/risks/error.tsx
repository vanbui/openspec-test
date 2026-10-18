'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { Button } from '@/components/ui/button';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function RisksError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <><PageHeader title={pageHeadings.riskRegister} description="Search and manage Risks from released risk assessments and from those still under assessment." /><section className="space-y-2 rounded-lg border border-border bg-surface p-6 text-center" role="alert"><h2 className="text-xl font-semibold text-foreground">We couldn’t load the Risk register</h2><p className="text-sm text-muted-foreground">Try again. If the problem continues, contact your CSRM administrator.</p><Button type="button" variant="outline" onClick={retry}>Try again</Button></section></>;
}
