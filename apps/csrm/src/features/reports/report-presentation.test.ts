import { describe, expect, it } from 'vitest';

import {
  asAtLabel,
  dueStateRows,
  effectivenessRatingRows,
  exposedSystemRows,
  exposedSystemsNotes,
  formatReportMonth,
  implementationStatusRows,
  mostOverdueNote,
  ratingRows,
  releasedMonthBars,
  releasedMonthRows,
  releasedPerMonthDescription,
  reportKpiTiles,
  requestLifecycleRows,
  residualByTreatmentStatusRows,
  throughputRangeLabel,
  treatmentStatusColumns,
  treatmentStatusRows,
  zeroedReport,
} from './report-presentation';
import type {
  AssessmentThroughputReport,
  ControlEffectivenessReport,
  RiskExposureReport,
  TreatmentPerformanceReport,
} from './report-schema';

const riskExposure: RiskExposureReport = {
  key: 'risk-exposure',
  today: '2026-09-24',
  byResidualRating: { Critical: 2, High: 3, Moderate: 1, Low: 1, notRated: 1, total: 8 },
  byInherentRating: { Critical: 1, High: 3, Moderate: 1, Low: 1, notRated: 2, total: 8 },
  residualByTreatmentStatus: {
    Critical: { notStarted: 1, inProgress: 1, overdue: 0, complete: 0, notProvided: 0, total: 2 },
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
};

const controlEffectiveness: ControlEffectivenessReport = {
  key: 'control-effectiveness',
  today: '2026-09-24',
  implementationStatus: { existing: 1, planned: 1, implemented: 2, retired: 0, notProvided: 1, total: 5 },
  effectivenessRating: { effective: 1, partiallyEffective: 1, ineffective: 1, notAssessed: 1, notProvided: 1, total: 5 },
};

const treatmentPerformance: TreatmentPerformanceReport = {
  key: 'treatment-performance',
  today: '2026-09-24',
  dueWindowDays: 30,
  dueState: { overdue: 2, dueWithinWindow: 2, later: 1, noTargetDate: 2, total: 7 },
  treatmentStatus: { notStarted: 3, inProgress: 2, overdue: 1, complete: 1, notProvided: 1, total: 8 },
  mostOverdue: {
    rows: [{
      id: 'risk-treatment-overdue:risk-1',
      kind: 'risk-treatment-overdue',
      urgency: 'overdue',
      governingDate: '2026-09-12',
      dayOffset: -12,
      source: { type: 'risk', documentId: 'risk-1', identifier: 'RSK-2026-B2QDZ6', title: 'A released Risk.', released: true },
      link: { type: 'risk', documentId: 'risk-1' },
      residualRating: 'Critical',
    }],
    total: 2,
    truncated: false,
  },
};

const assessmentThroughput: AssessmentThroughputReport = {
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

describe('report dates', () => {
  it('words the as-at line from the server today, en-AU at UTC, and keeps the machine date for <time>', () => {
    expect(asAtLabel('2026-09-24')).toEqual({
      text: 'Computed from current records as at 24 Sept 2026.',
      lead: 'Computed from current records as at ',
      date: '24 Sept 2026',
      dateTime: '2026-09-24',
      end: '.',
    });
    // A first-of-month date never slips into the previous month, whatever the machine zone.
    expect(asAtLabel('2027-01-01').text).toBe('Computed from current records as at 1 Jan 2027.');
  });

  it('formats a month short for chart labels and long with its year for tables', () => {
    expect(formatReportMonth('2026-09-01', 'short')).toBe('Sept');
    expect(formatReportMonth('2026-06-01', 'short')).toBe('Jun');
    expect(formatReportMonth('2026-09-01', 'long')).toBe('September 2026');
    expect(formatReportMonth('2027-01-01', 'long')).toBe('January 2027');
  });

  it('names the throughput range from its first and last months', () => {
    expect(throughputRangeLabel(assessmentThroughput.released.months)).toBe('April 2026 to September 2026');
    expect(throughputRangeLabel([{ monthStart: '2026-09-01' }])).toBe('September 2026');
    expect(throughputRangeLabel([])).toBe('');
  });
});

describe('report KPI tiles', () => {
  it('links every risk-exposure tile to a Risk Register list of open Risks with the same predicate', () => {
    expect(reportKpiTiles(riskExposure)).toEqual([
      { key: 'open-contextual-risks', caption: 'Open contextual Risks', value: 8, href: '/app/risks?state=open' },
      { key: 'critical-residual', caption: 'Critical residual', value: 2, href: '/app/risks?residualRating=Critical&state=open' },
      { key: 'high-residual', caption: 'High residual', value: 3, href: '/app/risks?residualRating=High&state=open' },
    ]);
  });

  it('leaves the Control Implementations tile plain and links Rated Ineffective to its alert kind', () => {
    expect(reportKpiTiles(controlEffectiveness)).toEqual([
      { key: 'control-implementations', caption: 'Control Implementations', value: 5 },
      { key: 'rated-ineffective', caption: 'Rated Ineffective', value: 1, href: '/app/alerts?kind=ineffective-control' },
    ]);
  });
});

describe('risk-exposure rows', () => {
  it('orders ratings Critical to Low and adds Not rated last when either chart has one', () => {
    expect(ratingRows(riskExposure.byInherentRating, riskExposure.byResidualRating)).toEqual([
      { key: 'Critical', label: 'Critical', rating: 'Critical', inherent: 1, residual: 2 },
      { key: 'High', label: 'High', rating: 'High', inherent: 3, residual: 3 },
      { key: 'Moderate', label: 'Moderate', rating: 'Moderate', inherent: 1, residual: 1 },
      { key: 'Low', label: 'Low', rating: 'Low', inherent: 1, residual: 1 },
      { key: 'notRated', label: 'Not rated', rating: null, inherent: 2, residual: 1 },
    ]);
    const residualOnly = { ...riskExposure.byInherentRating, notRated: 0 };
    expect(ratingRows(residualOnly, riskExposure.byResidualRating).at(-1)?.key).toBe('notRated');
    const neither = ratingRows({ ...residualOnly }, { ...riskExposure.byResidualRating, notRated: 0 });
    expect(neither.map((row) => row.key)).toEqual(['Critical', 'High', 'Moderate', 'Low']);
  });

  it('names the treatment status columns with the stored values, Total last', () => {
    expect(treatmentStatusColumns.map((column) => column.label)).toEqual(['Not Started', 'In Progress', 'Overdue', 'Complete', 'Not provided', 'Total']);
  });

  it('lays the residual rating by treatment status matrix out Critical to Low, then Not rated', () => {
    expect(residualByTreatmentStatusRows(riskExposure.residualByTreatmentStatus)).toEqual([
      { key: 'Critical', label: 'Critical', values: [1, 1, 0, 0, 0, 2] },
      { key: 'High', label: 'High', values: [1, 1, 0, 0, 1, 3] },
      { key: 'Moderate', label: 'Moderate', values: [0, 0, 0, 1, 0, 1] },
      { key: 'Low', label: 'Low', values: [0, 0, 1, 0, 0, 1] },
      { key: 'notRated', label: 'Not rated', values: [1, 0, 0, 0, 0, 1] },
    ]);
  });

  it('lists exposed Information Systems by name with their Critical, High and total counts', () => {
    expect(exposedSystemRows(riskExposure.exposedSystems)).toEqual([
      { key: 'system-1', label: 'Alpha system', values: [1, 1, 2] },
      { key: 'system-2', label: 'Beta system', values: [1, 1, 2] },
    ]);
  });

  it('notes truncation and Risks without an impacted Information System, in the singular for one', () => {
    expect(exposedSystemsNotes(riskExposure.exposedSystems)).toEqual([
      '1 High or Critical residual Risk has no impacted Information System.',
    ]);
    expect(exposedSystemsNotes({ ...riskExposure.exposedSystems, total: 1_204, truncated: true, risksWithoutSystem: 3 })).toEqual([
      'Showing the top 2 of 1,204 Information Systems.',
      '3 High or Critical residual Risks have no impacted Information System.',
    ]);
    expect(exposedSystemsNotes({ ...riskExposure.exposedSystems, risksWithoutSystem: 0 })).toEqual([]);
  });
});

describe('control-effectiveness rows', () => {
  it('orders implementation statuses as stored, with Not provided last', () => {
    expect(implementationStatusRows(controlEffectiveness.implementationStatus)).toEqual([
      { key: 'existing', label: 'Existing', values: [1] },
      { key: 'planned', label: 'Planned', values: [1] },
      { key: 'implemented', label: 'Implemented', values: [2] },
      { key: 'retired', label: 'Retired', values: [0] },
      { key: 'notProvided', label: 'Not provided', values: [1] },
    ]);
  });

  it('orders effectiveness ratings from Effective to Not Assessed, with Not provided last', () => {
    expect(effectivenessRatingRows(controlEffectiveness.effectivenessRating)).toEqual([
      { key: 'effective', label: 'Effective', values: [1] },
      { key: 'partiallyEffective', label: 'Partially Effective', values: [1] },
      { key: 'ineffective', label: 'Ineffective', values: [1] },
      { key: 'notAssessed', label: 'Not Assessed', values: [1] },
      { key: 'notProvided', label: 'Not provided', values: [1] },
    ]);
  });
});

describe('treatment-performance tiles and rows', () => {
  it('links Overdue to its alert kind and leaves the window and no-target-date tiles plain, naming the served window', () => {
    expect(reportKpiTiles(treatmentPerformance)).toEqual([
      { key: 'overdue', caption: 'Overdue', value: 2, href: '/app/alerts?kind=risk-treatment-overdue' },
      { key: 'due-within-window', caption: 'Due within 30 days', value: 2 },
      { key: 'no-target-date', caption: 'No target date', value: 2 },
    ]);
    expect(reportKpiTiles({ ...treatmentPerformance, dueWindowDays: 21 })[1]?.caption).toBe('Due within 21 days');
    expect(reportKpiTiles({ ...treatmentPerformance, dueWindowDays: 1 })[1]?.caption).toBe('Due within 1 day');
  });

  it('orders the due states Overdue, due within the window, later, then no target date', () => {
    expect(dueStateRows(treatmentPerformance)).toEqual([
      { key: 'overdue', label: 'Overdue', values: [2] },
      { key: 'dueWithinWindow', label: 'Due within 30 days', values: [2] },
      { key: 'later', label: 'Due later', values: [1] },
      { key: 'noTargetDate', label: 'No target date', values: [2] },
    ]);
  });

  it('orders the recorded treatment statuses as stored, with Not provided last', () => {
    expect(treatmentStatusRows(treatmentPerformance.treatmentStatus)).toEqual([
      { key: 'notStarted', label: 'Not Started', values: [3] },
      { key: 'inProgress', label: 'In Progress', values: [2] },
      { key: 'overdue', label: 'Overdue', values: [1] },
      { key: 'complete', label: 'Complete', values: [1] },
      { key: 'notProvided', label: 'Not provided', values: [1] },
    ]);
  });

  it('says how many overdue treatments a truncated list shows, and nothing otherwise', () => {
    expect(mostOverdueNote(treatmentPerformance.mostOverdue)).toBeNull();
    expect(mostOverdueNote({ ...treatmentPerformance.mostOverdue, total: 1_204, truncated: true })).toBe('Showing 1 of 1,204');
  });
});

describe('assessment-throughput tiles and rows', () => {
  it('names the period on the released tile and the sample on the median tile, neither linked', () => {
    expect(reportKpiTiles(assessmentThroughput)).toEqual([
      { key: 'released-in-period', caption: 'Released in period', value: 3, supportingText: 'April 2026 to September 2026' },
      { key: 'median-days-to-release', caption: 'Median days to release', value: 20, supportingText: 'Across 2 releases with a submission date' },
    ]);
  });

  it('never shows a missing median as zero, and words a single or capped sample honestly', () => {
    const tiles = (median: AssessmentThroughputReport['medianDaysToRelease']) => reportKpiTiles({ ...assessmentThroughput, medianDaysToRelease: median })[1];
    expect(tiles({ value: null, sampleSize: 0, truncated: false })).toEqual({
      key: 'median-days-to-release',
      caption: 'Median days to release',
      value: null,
      supportingText: 'No release in this period has a submission date.',
    });
    expect(tiles({ value: 12.5, sampleSize: 1, truncated: false })?.supportingText).toBe('Across 1 release with a submission date');
    expect(tiles({ value: 31, sampleSize: 5_000, truncated: true })?.supportingText).toBe('Across the 5,000 most recent releases with a submission date');
  });

  it('labels each month short in the chart and in full in the table, marking the current month to date', () => {
    expect(releasedMonthBars(assessmentThroughput.released.months)).toEqual([
      { key: '2026-04-01', label: 'Apr', labelText: 'April 2026', value: 0, partial: false },
      { key: '2026-05-01', label: 'May', labelText: 'May 2026', value: 0, partial: false },
      { key: '2026-06-01', label: 'Jun', labelText: 'June 2026', value: 0, partial: false },
      { key: '2026-07-01', label: 'Jul', labelText: 'July 2026', value: 1, partial: false },
      { key: '2026-08-01', label: 'Aug', labelText: 'August 2026', value: 0, partial: false },
      { key: '2026-09-01', label: 'Sept', labelText: 'September 2026 (to date)', value: 2, partial: true },
    ]);
    expect(releasedMonthRows(assessmentThroughput.released.months)).toEqual([
      { key: '2026-04-01', label: 'April 2026', values: [0] },
      { key: '2026-05-01', label: 'May 2026', values: [0] },
      { key: '2026-06-01', label: 'June 2026', values: [0] },
      { key: '2026-07-01', label: 'July 2026', values: [1] },
      { key: '2026-08-01', label: 'August 2026', values: [0] },
      { key: '2026-09-01', label: 'September 2026 (to date)', values: [2] },
    ]);
  });

  it('names the range in the monthly description', () => {
    expect(releasedPerMonthDescription(assessmentThroughput.released.months)).toBe(
      'Risk Assessments released by a Security Analyst in each calendar month, April 2026 to September 2026.',
    );
  });

  it('lists the review-scope lifecycle states in request order with their labels, never Draft', () => {
    expect(requestLifecycleRows(assessmentThroughput.requestsByStatus)).toEqual([
      { key: 'submitted', label: 'Submitted', values: [1] },
      { key: 'questionnaire-in-progress', label: 'Questionnaire in progress', values: [2] },
      { key: 'risk-assessment-drafted', label: 'Risk assessment drafted', values: [1] },
      { key: 'under-review', label: 'Under review', values: [3] },
      { key: 'approved', label: 'Released', values: [5] },
      { key: 'closed', label: 'Closed', values: [1] },
    ]);
  });
});

describe('the guarded empty fixture', () => {
  it('keeps each report and its dates but sets every count to zero', () => {
    expect(zeroedReport(riskExposure)).toEqual({
      key: 'risk-exposure',
      today: '2026-09-24',
      byResidualRating: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 },
      byInherentRating: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 },
      residualByTreatmentStatus: {
        Critical: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
        High: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
        Moderate: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
        Low: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
        notRated: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
      },
      exposedSystems: { rows: [], total: 0, truncated: false, risksWithoutSystem: 0 },
    });
    expect(zeroedReport(controlEffectiveness)).toEqual({
      key: 'control-effectiveness',
      today: '2026-09-24',
      implementationStatus: { existing: 0, planned: 0, implemented: 0, retired: 0, notProvided: 0, total: 0 },
      effectivenessRating: { effective: 0, partiallyEffective: 0, ineffective: 0, notAssessed: 0, notProvided: 0, total: 0 },
    });
    expect(zeroedReport(treatmentPerformance)).toEqual({
      key: 'treatment-performance',
      today: '2026-09-24',
      dueWindowDays: 30,
      dueState: { overdue: 0, dueWithinWindow: 0, later: 0, noTargetDate: 0, total: 0 },
      treatmentStatus: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
      mostOverdue: { rows: [], total: 0, truncated: false },
    });
    // Months are data even at zero, so they stay, with the current month still partial.
    expect(zeroedReport(assessmentThroughput)).toEqual({
      key: 'assessment-throughput',
      today: '2026-09-24',
      period: 6,
      periodStart: '2026-04-01',
      released: {
        months: [
          { monthStart: '2026-04-01', count: 0, partial: false },
          { monthStart: '2026-05-01', count: 0, partial: false },
          { monthStart: '2026-06-01', count: 0, partial: false },
          { monthStart: '2026-07-01', count: 0, partial: false },
          { monthStart: '2026-08-01', count: 0, partial: false },
          { monthStart: '2026-09-01', count: 0, partial: true },
        ],
        total: 0,
      },
      medianDaysToRelease: { value: null, sampleSize: 0, truncated: false },
      requestsByStatus: { submitted: 0, questionnaireInProgress: 0, riskAssessmentDrafted: 0, underReview: 0, approved: 0, closed: 0, total: 0 },
    });
  });
});
