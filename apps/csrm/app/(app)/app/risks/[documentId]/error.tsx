'use client';

import { RiskDetailsState } from '@/features/risks/risk-details-states';

export default function RiskDetailsError() {
  return <RiskDetailsState kind="error" />;
}
