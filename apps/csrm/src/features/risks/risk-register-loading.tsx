'use client';

import { useSearchParams } from 'next/navigation';
import { RiskRegisterTable } from './risk-register';
import { readRiskRegisterQuery } from './risk-domain';
import type { RiskRegisterQuery } from './risk-schema';

/*
 * The fallback streams before the page decides anything, so it must draw for every URL. The page
 * refuses an impossible target date or a reversed range and renders the invalid-filter state itself;
 * throwing here instead would abandon the server render of the whole route. A refused URL is drawn
 * without its target-date bounds.
 */
function loadingQuery(params: Record<string, string | string[]>): RiskRegisterQuery {
  try {
    return readRiskRegisterQuery(params);
  } catch {
    const withoutDates = { ...params };
    delete withoutDates.targetDateFrom;
    delete withoutDates.targetDateTo;
    return readRiskRegisterQuery(withoutDates);
  }
}

/*
 * The URL in the shape Next passes the page's searchParams: a string for a key that appears once and an
 * array only for a repeated key, so both read a repeated key by its first value and refuse a repeated
 * target date alike. An array for every key would refuse every date.
 */
function searchParamsRecord(searchParams: URLSearchParams): Record<string, string | string[]> {
  const record: Record<string, string | string[]> = {};
  for (const key of new Set(searchParams.keys())) {
    const values = searchParams.getAll(key);
    record[key] = values.length === 1 ? values[0]! : values;
  }
  return record;
}

export function RiskRegisterLoading() {
  const searchParams = useSearchParams();
  // Read without zod: this state renders in the browser, where the register validates nothing.
  const query = loadingQuery(searchParamsRecord(searchParams));
  return <RiskRegisterTable risks={[]} query={query} pagination={{ page: query.page, pageSize: query.pageSize, pageCount: 0, total: 0 }} selectedLabels={{}} pickerOptions={{ owners: [], assessments: [], systems: [], assets: [] }} densityUserId="security-analyst" state="loading" />;
}
