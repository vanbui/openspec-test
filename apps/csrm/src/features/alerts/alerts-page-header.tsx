import { PageHeader } from '@/components/csrm/page-header';

/** The second sentence explains why no alert can be dismissed or acknowledged (D-06). */
export const alertsPageDescription =
  'Overdue work, approaching dates and Risks that need attention, most urgent first. Alerts clear when the underlying record changes.';

/** The Alerts header, shared by the page, its loading boundary and its error boundary. */
export function AlertsPageHeader() {
  return <PageHeader description={alertsPageDescription} title="Alerts" />;
}
