import { PageHeader } from '@/components/csrm/page-header';

export default function AdministrationLoading() {
  return <><PageHeader title="Administration" description="Manage reusable CSRM reference data." /><section className="rounded-lg border border-border bg-surface p-6" role="status" aria-label="Loading Administration"><p className="text-sm text-muted-foreground">Loading Administration…</p></section></>;
}
