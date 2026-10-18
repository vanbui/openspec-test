import type { ReactNode } from 'react';

import { PageHeader } from '@/components/csrm/page-header';
import { pageHeadings } from '@/config/navigation/page-headings';

/** The second sentence explains why no alert can be dismissed or acknowledged (D-06). */
export const alertsPageDescription =
  'Overdue work, approaching dates and Risks that need attention, most urgent first. Alerts clear when the underlying record changes.';

/**
 * The Alerts header, shared by the page, its loading boundary and its error boundary. `action` is the header's Export,
 * which only the page's data component passes, after a successful read (Phase 19 export placement).
 */
export function AlertsPageHeader({ action }: { action?: ReactNode } = {}) {
  return <PageHeader action={action} description={alertsPageDescription} title={pageHeadings.alerts} />;
}
