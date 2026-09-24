import { PageHeader } from '@/components/shell/app-shell';
import { RiskRegisterLoading } from '@/features/risks/risk-register-loading';

export default function RisksLoading() {
  return <><PageHeader title="Risk Register" description="Search and manage contextual Risks across authorised assessments." /><RiskRegisterLoading /></>;
}
