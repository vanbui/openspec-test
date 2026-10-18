import { RequestFormLoading } from '@/features/requests/request-form-loading';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function NewRequestLoading() {
  return <RequestFormLoading title={pageHeadings.newRequest} />;
}
