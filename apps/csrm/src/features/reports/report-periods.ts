import type { components } from '../../lib/api/generated/schema';

/*
 * The throughput periods, in calendar months. They live apart from report-schema.ts, which defines
 * the report parsers with zod, so the period control in the browser reads them without downloading
 * the validation library (plan 08-13, D-24). report-schema.ts re-exports both.
 */
export const reportPeriods = [6, 12] as const satisfies readonly components['schemas']['AssessmentThroughputReport']['period'][];
export type ReportPeriod = (typeof reportPeriods)[number];
