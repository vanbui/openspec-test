import { PageHeader } from '@/components/csrm/page-header';
import { analystDashboardCopy } from './analyst-dashboard-presentation';

/**
 * The analyst dashboard header, shared by the page, its loading boundary and its error boundary. It
 * has no action: the tiles are the entry points, and a header button would compete with them.
 */
export function AnalystDashboardPageHeader() {
  return <PageHeader description={analystDashboardCopy.description} title={analystDashboardCopy.title} />;
}
