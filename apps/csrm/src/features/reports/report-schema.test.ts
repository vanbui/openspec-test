import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import reportCopyJson from './report-copy.json';
import { isReportKey, reportCopy, reportCopyEntries, reportKeys } from './report-copy';
import {
  parseReportDefinitionListPayload,
  parseReportPayload,
  reportDefinitionListResponseSchema,
  reportPeriodSchema,
  reportPeriods,
  reportResponseSchemas,
} from './report-schema';

type SpecSchema = {
  enum?: unknown[];
  properties?: Record<string, SpecSchema>;
  oneOf?: Array<{ $ref?: string }>;
  discriminator?: { propertyName: string; mapping: Record<string, string> };
};
const specification = JSON.parse(
  readFileSync(resolve(process.cwd(), '../../docs/references/specification.json'), 'utf8'),
) as { components: { schemas: Record<string, SpecSchema> } };
const schemas = specification.components.schemas;

const statusCounts = { notStarted: 1, inProgress: 1, overdue: 0, complete: 0, notProvided: 0, total: 2 };
const riskExposure = {
  key: 'risk-exposure',
  today: '2026-09-24',
  byResidualRating: { Critical: 2, High: 3, Moderate: 1, Low: 1, notRated: 1, total: 8 },
  byInherentRating: { Critical: 1, High: 3, Moderate: 1, Low: 1, notRated: 2, total: 8 },
  acceptedByResidualRating: { Critical: 0, High: 1, Moderate: 1, Low: 0, notRated: 0, total: 2 },
  residualByTreatmentStatus: {
    Critical: statusCounts,
    High: { notStarted: 1, inProgress: 1, overdue: 0, complete: 0, notProvided: 1, total: 3 },
    Moderate: { notStarted: 0, inProgress: 0, overdue: 0, complete: 1, notProvided: 0, total: 1 },
    Low: { notStarted: 0, inProgress: 0, overdue: 1, complete: 0, notProvided: 0, total: 1 },
    notRated: { notStarted: 1, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 1 },
  },
  exposedSystems: {
    rows: [
      { documentId: 'system-1', name: 'Alpha system', critical: 1, high: 1, total: 2 },
      { documentId: 'system-2', name: 'Beta system', critical: 1, high: 1, total: 2 },
    ],
    total: 2,
    truncated: false,
    risksWithoutSystem: 1,
  },
  underAssessment: { byResidualRating: { Critical: 1, High: 0, Moderate: 0, Low: 0, notRated: 1, total: 2 } },
};
const overdueRow = {
  id: 'risk-treatment-overdue:risk-1',
  kind: 'risk-treatment-overdue',
  urgency: 'overdue',
  governingDate: '2026-09-12',
  dayOffset: -12,
  source: { type: 'risk', documentId: 'risk-1', identifier: 'RSK-2026-B2QDZ6', title: 'A released Risk.', released: true },
  link: { type: 'risk', documentId: 'risk-1' },
  residualRating: 'Critical',
};
const treatmentPerformance = {
  key: 'treatment-performance',
  today: '2026-09-24',
  dueWindowDays: 30,
  dueState: { overdue: 2, dueWithinWindow: 2, later: 1, noTargetDate: 2, total: 7 },
  treatmentStatus: { notStarted: 3, inProgress: 2, overdue: 1, complete: 1, notProvided: 1, total: 8 },
  mostOverdue: { rows: [overdueRow], total: 2, truncated: false },
};
const assessmentThroughput = {
  key: 'assessment-throughput',
  today: '2026-09-24',
  period: 6,
  periodStart: '2026-04-01',
  released: {
    months: [
      { monthStart: '2026-04-01', count: 0, partial: false },
      { monthStart: '2026-05-01', count: 0, partial: false },
      { monthStart: '2026-06-01', count: 0, partial: false },
      { monthStart: '2026-07-01', count: 1, partial: false },
      { monthStart: '2026-08-01', count: 0, partial: false },
      { monthStart: '2026-09-01', count: 2, partial: true },
    ],
    total: 3,
  },
  medianDaysToRelease: { value: 20, sampleSize: 2, truncated: false },
  requestsByStatus: { submitted: 1, questionnaireInProgress: 2, riskAssessmentDrafted: 1, underReview: 3, approved: 5, closed: 1, total: 13 },
};
const controlEffectiveness = {
  key: 'control-effectiveness',
  today: '2026-09-24',
  implementationStatus: { existing: 1, planned: 1, implemented: 2, retired: 0, notProvided: 1, total: 5 },
  effectivenessRating: { effective: 1, partiallyEffective: 1, ineffective: 1, notAssessed: 1, notProvided: 1, total: 5 },
};
const reports = {
  'risk-exposure': riskExposure,
  'treatment-performance': treatmentPerformance,
  'assessment-throughput': assessmentThroughput,
  'control-effectiveness': controlEffectiveness,
} as const;
const definitions = reportCopyEntries.map(({ key, title, description }) => ({ key, title, description }));

describe('report copy map', () => {
  it('names exactly the published report keys, in display order', () => {
    expect(reportCopyJson.map(({ key }) => key)).toEqual([...reportKeys]);
    expect(reportCopyEntries.map(({ key }) => key)).toEqual([...reportKeys]);
    expect([...reportKeys]).toEqual(schemas.ReportKey?.enum);
  });

  it('gives each report its title, description and metadata title', () => {
    expect(reportCopy('assessment-throughput')).toEqual({
      key: 'assessment-throughput',
      title: 'Assessment throughput',
      description: 'Assessment Requests by lifecycle state, Risk Assessments released each month, and time from submission to release.',
      metadataTitle: 'Assessment Throughput Report | IdamBox CSRM',
    });
    expect(reportKeys.map((key) => reportCopy(key).metadataTitle)).toEqual([
      'Risk Exposure Report | IdamBox CSRM',
      'Treatment Performance Report | IdamBox CSRM',
      'Assessment Throughput Report | IdamBox CSRM',
      'Control Effectiveness Report | IdamBox CSRM',
    ]);
  });

  it('states each report\'s scope in its description (D-42, D-43, D-54)', () => {
    expect(reportCopyEntries.map(({ key, description }) => [key, description])).toEqual([
      ['risk-exposure', 'Released Risks by rating and treatment status, the most exposed Information Systems, and the Risks still under assessment.'],
      ['treatment-performance', 'Risk treatments by due state and treatment status, and the most overdue treatments. Includes Risks under assessment.'],
      ['assessment-throughput', 'Assessment Requests by lifecycle state, Risk Assessments released each month, and time from submission to release.'],
      ['control-effectiveness', 'Mitigation controls on open Risks by implementation status and effectiveness rating. Includes Risks under assessment.'],
    ]);
  });

  it('recognises only the closed report keys, matched exactly', () => {
    for (const key of reportKeys) expect(isReportKey(key), key).toBe(true);
    for (const value of ['unknown', 'Risk-exposure', 'risk-exposure ', '', 'constructor', '__proto__', null, undefined, 6, ['risk-exposure']]) {
      expect(isReportKey(value), String(value)).toBe(false);
    }
  });
});

describe('report contract vocabularies', () => {
  it('match the published period and the discriminated report union', () => {
    expect([...reportPeriods]).toEqual(schemas.AssessmentThroughputReport?.properties?.period?.enum);
    const union = schemas.ReportResponse?.properties?.data;
    expect(union?.discriminator?.propertyName).toBe('key');
    expect(Object.keys(union?.discriminator?.mapping ?? {})).toEqual([...reportKeys]);
    expect(Object.keys(reportResponseSchemas)).toEqual([...reportKeys]);
    for (const key of reportKeys) {
      const component = union?.discriminator?.mapping[key]?.replace('#/components/schemas/', '') ?? '';
      expect(schemas[component]?.properties?.key?.enum, key).toEqual([key]);
    }
  });
});

describe('report response parsers', () => {
  it('parse the definition list and each served report unchanged', () => {
    expect(parseReportDefinitionListPayload({ data: definitions })).toEqual(definitions);
    for (const key of reportKeys) {
      expect(parseReportPayload(key, { data: reports[key] }), key).toEqual(reports[key]);
    }
    // A throughput with no release that has a submission date has no median.
    const noMedian = { ...assessmentThroughput, medianDaysToRelease: { value: null, sampleSize: 0, truncated: false } };
    expect(parseReportPayload('assessment-throughput', { data: noMedian })).toEqual(noMedian);
    // A twelve-month period is served with twelve months.
    const twelve = { ...assessmentThroughput, period: 12, released: { months: Array.from({ length: 12 }, () => assessmentThroughput.released.months[0]), total: 0 } };
    expect(parseReportPayload('assessment-throughput', { data: twelve })).toEqual(twelve);
  });

  it('require the accepted and under-assessment counts beside the released risk-exposure sections (D-42)', () => {
    const { acceptedByResidualRating: _accepted, ...withoutAccepted } = riskExposure;
    const { underAssessment: _underAssessment, ...withoutUnderAssessment } = riskExposure;
    expect(reportResponseSchemas['risk-exposure'].safeParse({ data: withoutAccepted }).success).toBe(false);
    expect(reportResponseSchemas['risk-exposure'].safeParse({ data: withoutUnderAssessment }).success).toBe(false);
    // The under-assessment figure is its own closed object, never a flat count or a second report.
    expect(reportResponseSchemas['risk-exposure'].safeParse({ data: { ...riskExposure, underAssessment: riskExposure.underAssessment.byResidualRating } }).success).toBe(false);
    expect(reportResponseSchemas['risk-exposure'].safeParse({ data: { ...riskExposure, underAssessment: { ...riskExposure.underAssessment, total: 2 } } }).success).toBe(false);
    expect(parseReportPayload('risk-exposure', { data: riskExposure }).underAssessment.byResidualRating.total).toBe(2);
    expect(parseReportPayload('risk-exposure', { data: riskExposure }).acceptedByResidualRating.total).toBe(2);
  });

  it('refuse an unknown key in every branch and at every level', () => {
    const hostile: Array<[keyof typeof reports, unknown]> = [
      ['risk-exposure', { ...riskExposure, extra: 1 }],
      ['risk-exposure', { ...riskExposure, acceptedByResidualRating: { ...riskExposure.acceptedByResidualRating, Extreme: 1 } }],
      ['risk-exposure', { ...riskExposure, byResidualRating: { ...riskExposure.byResidualRating, Extreme: 1 } }],
      ['risk-exposure', { ...riskExposure, residualByTreatmentStatus: { ...riskExposure.residualByTreatmentStatus, total: statusCounts } }],
      ['risk-exposure', { ...riskExposure, exposedSystems: { ...riskExposure.exposedSystems, rows: [{ ...riskExposure.exposedSystems.rows[0], owner: 'x' }] } }],
      ['treatment-performance', { ...treatmentPerformance, extra: 1 }],
      ['treatment-performance', { ...treatmentPerformance, dueState: { ...treatmentPerformance.dueState, completeOrClosed: 1 } }],
      ['treatment-performance', { ...treatmentPerformance, mostOverdue: { ...treatmentPerformance.mostOverdue, rows: [{ ...overdueRow, extra: 1 }] } }],
      ['assessment-throughput', { ...assessmentThroughput, extra: 1 }],
      ['assessment-throughput', { ...assessmentThroughput, released: { ...assessmentThroughput.released, months: [{ ...assessmentThroughput.released.months[0], label: 'Apr' }] } }],
      ['assessment-throughput', { ...assessmentThroughput, medianDaysToRelease: { ...assessmentThroughput.medianDaysToRelease, mean: 3 } }],
      ['assessment-throughput', { ...assessmentThroughput, requestsByStatus: { ...assessmentThroughput.requestsByStatus, draft: 2 } }],
      ['control-effectiveness', { ...controlEffectiveness, extra: 1 }],
      ['control-effectiveness', { ...controlEffectiveness, implementationStatus: { ...controlEffectiveness.implementationStatus, removed: 1 } }],
      ['control-effectiveness', { ...controlEffectiveness, effectivenessRating: { ...controlEffectiveness.effectivenessRating, veryEffective: 1 } }],
    ];
    for (const [key, data] of hostile) {
      expect(reportResponseSchemas[key].safeParse({ data }).success, JSON.stringify(data).slice(0, 160)).toBe(false);
    }
    for (const key of reportKeys) {
      expect(reportResponseSchemas[key].safeParse({ data: reports[key], meta: {} }).success, key).toBe(false);
    }
    expect(reportDefinitionListResponseSchema.safeParse({ data: [{ ...definitions[0], metadataTitle: 'x' }] }).success).toBe(false);
  });

  it('refuse a wrong key literal in every branch, so a report is never read as another', () => {
    for (const key of reportKeys) {
      for (const other of reportKeys.filter((candidate) => candidate !== key)) {
        expect(reportResponseSchemas[key].safeParse({ data: { ...reports[key], key: other } }).success, `${key} as ${other}`).toBe(false);
      }
      expect(() => parseReportPayload(key, { data: { ...reports[key], key: 'unknown' } }), key).toThrow();
    }
    expect(() => parseReportPayload('risk-exposure', { data: controlEffectiveness })).toThrow();
  });

  it('refuse values outside the contract', () => {
    const hostile: Array<[keyof typeof reports, unknown]> = [
      ['risk-exposure', { ...riskExposure, today: '2026-02-30' }],
      ['risk-exposure', { ...riskExposure, byResidualRating: { ...riskExposure.byResidualRating, Critical: -1 } }],
      ['risk-exposure', { ...riskExposure, exposedSystems: { ...riskExposure.exposedSystems, rows: Array.from({ length: 11 }, () => riskExposure.exposedSystems.rows[0]) } }],
      ['risk-exposure', { ...riskExposure, exposedSystems: { ...riskExposure.exposedSystems, truncated: 'no' } }],
      ['treatment-performance', { ...treatmentPerformance, dueWindowDays: 0 }],
      ['treatment-performance', { ...treatmentPerformance, mostOverdue: { ...treatmentPerformance.mostOverdue, rows: Array.from({ length: 6 }, () => overdueRow) } }],
      ['treatment-performance', { ...treatmentPerformance, mostOverdue: { ...treatmentPerformance.mostOverdue, rows: [{ ...overdueRow, kind: 'forged' }] } }],
      ['assessment-throughput', { ...assessmentThroughput, period: 3 }],
      ['assessment-throughput', { ...assessmentThroughput, released: { ...assessmentThroughput.released, total: 1.5 } }],
      ['assessment-throughput', { ...assessmentThroughput, released: { months: Array.from({ length: 13 }, () => assessmentThroughput.released.months[0]), total: 0 } }],
      ['assessment-throughput', { ...assessmentThroughput, medianDaysToRelease: { value: -1, sampleSize: 1, truncated: false } }],
      ['control-effectiveness', { ...controlEffectiveness, effectivenessRating: { ...controlEffectiveness.effectivenessRating, total: '5' } }],
    ];
    for (const [key, data] of hostile) {
      expect(reportResponseSchemas[key].safeParse({ data }).success, JSON.stringify(data).slice(0, 160)).toBe(false);
    }
    expect(reportDefinitionListResponseSchema.safeParse({ data: [{ ...definitions[0], key: 'unknown' }] }).success).toBe(false);
    expect(reportDefinitionListResponseSchema.safeParse({ data: [...definitions, definitions[0]] }).success).toBe(false);
  });
});

describe('report period URL value', () => {
  it('reads twelve only from exactly 12, and anything else as the default six', () => {
    expect(reportPeriodSchema.parse('12')).toBe(12);
    expect(reportPeriodSchema.parse(['12', '6'])).toBe(12);
    expect(reportPeriodSchema.parse(12)).toBe(12);
    expect(reportPeriodSchema.parse('6')).toBe(6);
    for (const value of [undefined, '', '3', '012', ' 12', '12.0', 'twelve', ['6', '12'], null]) {
      expect(reportPeriodSchema.parse(value), String(value)).toBe(6);
    }
  });
});
