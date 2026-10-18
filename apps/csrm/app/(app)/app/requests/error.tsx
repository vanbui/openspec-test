'use client';

import { PageHeader } from '@/components/csrm/page-header';
import { Button } from '@/components/ui/button';
import { pageHeadings } from '@/config/navigation/page-headings';
import { myRequestsDescription } from '@/features/requests/my-requests-copy';

export default function RequestsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <PageHeader title={pageHeadings.myRequests} description={myRequestsDescription} />
      <section className="state" role="alert">
        <h2>We couldn’t load your requests</h2>
        <p>Try again. If the problem continues, contact your administrator.</p>
        <Button type="button" onClick={retry}>Try again</Button>
      </section>
    </>
  );
}
