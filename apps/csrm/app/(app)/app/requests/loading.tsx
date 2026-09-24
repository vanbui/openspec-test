import { PageHeader } from '@/components/shell/app-shell';
import { RequestTable } from '@/features/requests/request-table';

export default function RequestsLoading() {
  return (
    <>
      <PageHeader title="My Requests" description="Find and track the cyber risk assessment requests you are authorised to view." />
      <RequestTable
        requests={[]}
        query={{ q: '', status: undefined, sort: 'updatedAt:desc', page: 1, pageSize: 10 }}
        pagination={{ page: 1, pageSize: 10, pageCount: 0, total: 0 }}
        densityUserId="requestor"
        state="loading"
      />
    </>
  );
}
