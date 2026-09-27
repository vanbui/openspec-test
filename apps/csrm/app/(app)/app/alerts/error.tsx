'use client';

import { ErrorState } from '@/components/states/states';
import { AlertsPageHeader } from '@/features/alerts/alerts-page-header';

/* retry re-fetches and re-renders the segment (Next.js 16.3), so Try again reloads the alerts. */
export default function AlertsError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <>
      <AlertsPageHeader />
      <ErrorState noun="alerts" retry={retry} />
    </>
  );
}
