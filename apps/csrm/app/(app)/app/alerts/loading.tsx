import { AlertListLoading } from '@/features/alerts/alert-list';
import { AlertsPageHeader } from '@/features/alerts/alerts-page-header';

/* The route's own boundary, so /app/alerts never shows the Requestor dashboard's skeleton (UI-SPEC §1.5). */
export default function AlertsLoading() {
  return (
    <>
      <AlertsPageHeader />
      <AlertListLoading />
    </>
  );
}
