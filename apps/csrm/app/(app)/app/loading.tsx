import { PageHeader } from '@/components/shell/app-shell';
import { RequestorDashboard } from '@/features/dashboard/requestor-dashboard';

export default function DashboardLoading() {
  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Your authorised requests, questionnaires, and released assessment activity."
      />
      <RequestorDashboard state={{ kind: 'loading' }} />
    </>
  );
}
