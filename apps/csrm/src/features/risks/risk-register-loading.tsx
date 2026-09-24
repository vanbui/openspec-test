'use client';

import { useSearchParams } from 'next/navigation';
import { RiskRegisterTable } from './risk-register';
import { parseRiskRegisterQuery } from './risk-schema';

export function RiskRegisterLoading() {
  const searchParams = useSearchParams();
  const query = parseRiskRegisterQuery(Object.fromEntries(searchParams.entries()));
  return <RiskRegisterTable risks={[]} query={query} pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={{ owners: [], assessments: [], systems: [], assets: [] }} densityUserId="security-analyst" state="loading" />;
}
