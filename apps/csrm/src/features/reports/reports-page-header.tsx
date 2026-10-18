import { PageHeader } from '@/components/csrm/page-header';
import { pageHeadings } from '@/config/navigation/page-headings';

/** The Reports index copy (UI-SPEC §7.1). */
export const reportsPageTitle = pageHeadings.reports;
export const reportsPageDescription = 'Read-only reports computed from the current records you can open.';

/**
 * The Reports header. The index, its loading and error boundaries, the report error boundary and
 * every refused report URL render this one header, so a refused viewer is never shown a report's
 * own title and cannot tell a real report key from an invented one.
 */
export function ReportsPageHeader() {
  return <PageHeader description={reportsPageDescription} title={reportsPageTitle} />;
}
