import { PageHeader } from '@/components/shell/app-shell';
import { RequestTable } from '@/features/requests/request-table';
import { pageHeadings } from '@/config/navigation/page-headings';
import { myRequestsDescription } from '@/features/requests/my-requests-copy';

export default function RequestsLoading() {
  return (
    <>
      <PageHeader title={pageHeadings.myRequests} description={myRequestsDescription} />
      <RequestTable
        requests={[]}
        query={{ q: '', status: undefined, holder: undefined, notes: undefined, sort: 'updatedAt:desc', page: 1, pageSize: 10 }}
        pagination={{ page: 1, pageSize: 10, pageCount: 0, total: 0 }}
        densityUserId="requestor"
        state="loading"
      />
    </>
  );
}
