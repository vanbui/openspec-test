import { PageHeader } from '@/components/shell/app-shell';
import { RiskRegisterLoading } from '@/features/risks/risk-register-loading';
import { pageHeadings } from '@/config/navigation/page-headings';

export default function RisksLoading() {
  return <><PageHeader title={pageHeadings.riskRegister} description="Search and manage Risks from released risk assessments and from those still under assessment." /><RiskRegisterLoading /></>;
}
