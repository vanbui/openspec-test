import { describe, expect, it } from 'vitest';

import {
  asAtLabel,
  dueStateRows,
  effectivenessRatingRows,
  exposedSystemRows,
  exposedSystemsNoteLinks,
  exposedSystemsNotes,
  formatReportMonth,
  hasReleasedOpenRisks,
  hasRisksUnderAssessment,
  implementationStatusRows,
  mostOverdueNote,
  ratingRows,
  ratingTableRows,
  releasedMonthBars,
  releasedMonthRows,
  releasedPerMonthDescription,
  reportEmptyStates,
  reportKpiTiles,
  reportSectionCopy,
  requestLifecycleRows,
  residualByTreatmentStatusRows,
  throughputRangeLabel,
  treatmentStatusColumns,
  treatmentStatusRows,
  underAssessmentRows,
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
  acceptedByResidualRating: { Critical: 0, High: 1, Moderate: 1, Low: 0, notRated: 0, total: 2 },
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
  underAssessment: { byResidualRating: { Critical: 1, High: 0, Moderate: 2, Low: 0, notRated: 1, total: 4 } },
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
  dueWindowDays: 14,
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
  it('links each of the five risk-exposure tiles to the Risk Register list of its own stage, so released and under assessment never add up (D-42)', () => {
    expect(reportKpiTiles(riskExposure)).toEqual([
      { key: 'released-open-risks', caption: 'Released open Risks', value: 8, supportingText: 'Released Risks only', href: '/app/risks?state=open&stage=released' },
      { key: 'critical-residual', caption: 'Critical residual', value: 2, supportingText: 'Released open Risks', href: '/app/risks?residualRating=Critical&state=open&stage=released' },
      { key: 'high-residual', caption: 'High residual', value: 3, supportingText: 'Released open Risks', href: '/app/risks?residualRating=High&state=open&stage=released' },
      {
        key: 'accepted',
        caption: 'Accepted',
        value: 2,
        supportingText: 'Released Risks with the treatment action Accept',
        href: '/app/risks?state=open&stage=released&treatmentAction=Accept',
      },
      { key: 'under-assessment', caption: 'Under assessment', value: 4, supportingText: 'Not yet released', href: '/app/risks?state=open&stage=under-assessment' },
    ]);
  });

  it('opens the Risks that hold mitigation controls from the Mitigation controls tile, saying so, and links Rated Ineffective to its alert kind (D-36, UI-D32, UI-D33)', () => {
    expect(reportKpiTiles(controlEffectiveness)).toEqual([
      {
        key: 'mitigation-controls',
        caption: 'Mitigation controls',
        value: 5,
        supportingText: 'View the Risks that have them',
        href: '/app/risks?mitigationStatus=any&state=open',
      },
      { key: 'rated-ineffective', caption: 'Rated Ineffective', value: 1, href: '/app/alerts?kind=ineffective-control' },
    ]);
  });
});

describe('risk-exposure rows', () => {
  it('orders ratings Critical to Low with the accepted count, and adds Not rated last when either chart has one', () => {
    const accepted = riskExposure.acceptedByResidualRating;
    expect(ratingRows(riskExposure.byInherentRating, riskExposure.byResidualRating, accepted)).toEqual([
      { key: 'Critical', label: 'Critical', rating: 'Critical', inherent: 1, residual: 2, accepted: 0 },
      { key: 'High', label: 'High', rating: 'High', inherent: 3, residual: 3, accepted: 1 },
      { key: 'Moderate', label: 'Moderate', rating: 'Moderate', inherent: 1, residual: 1, accepted: 1 },
      { key: 'Low', label: 'Low', rating: 'Low', inherent: 1, residual: 1, accepted: 0 },
      { key: 'notRated', label: 'Not rated', rating: null, inherent: 2, residual: 1, accepted: 0 },
    ]);
    const residualOnly = { ...riskExposure.byInherentRating, notRated: 0 };
    expect(ratingRows(residualOnly, riskExposure.byResidualRating, accepted).at(-1)?.key).toBe('notRated');
    const neither = ratingRows({ ...residualOnly }, { ...riskExposure.byResidualRating, notRated: 0 }, accepted);
    expect(neither.map((row) => row.key)).toEqual(['Critical', 'High', 'Moderate', 'Low']);
  });

  it('heads the rating table Rating, Inherent, Residual and Accepted, one row per rating, each non-zero figure opening its released open list', () => {
    const rows = ratingRows(riskExposure.byInherentRating, riskExposure.byResidualRating, riskExposure.acceptedByResidualRating);
    expect(reportSectionCopy.ratings.columns).toEqual(['Inherent', 'Residual', 'Accepted']);
    const tableRows = ratingTableRows(rows);
    expect(tableRows.map((row) => [row.key, row.label, row.values])).toEqual([
      ['Critical', 'Critical', [1, 2, 0]],
      ['High', 'High', [3, 3, 1]],
      ['Moderate', 'Moderate', [1, 1, 1]],
      ['Low', 'Low', [1, 1, 0]],
      ['notRated', 'Not rated', [2, 1, 0]],
    ]);
    expect(tableRows[0]?.cells).toEqual([
      { href: '/app/risks?inherentRating=Critical&state=open&stage=released', accessibleName: '1 Risk: Critical, Inherent' },
      { href: '/app/risks?residualRating=Critical&state=open&stage=released', accessibleName: '2 Risks: Critical, Residual' },
      null,
    ]);
    expect(tableRows[1]?.cells?.[2]).toEqual({
      href: '/app/risks?residualRating=High&state=open&stage=released&treatmentAction=Accept',
      accessibleName: '1 Risk: High, Accepted',
    });
    // Not rated opens the register's none value in both rating filters (D-35).
    expect(tableRows[4]?.cells).toEqual([
      { href: '/app/risks?inherentRating=none&state=open&stage=released', accessibleName: '2 Risks: Not rated, Inherent' },
      { href: '/app/risks?residualRating=none&state=open&stage=released', accessibleName: '1 Risk: Not rated, Residual' },
      null,
    ]);
  });

  it('lists the Risks under assessment by residual rating, Critical to Low then Not rated, zeros included, each non-zero figure opening its under-assessment list', () => {
    expect(underAssessmentRows(riskExposure.underAssessment.byResidualRating)).toEqual([
      { key: 'Critical', label: 'Critical', rating: 'Critical', values: [1], cells: [{ href: '/app/risks?residualRating=Critical&state=open&stage=under-assessment', accessibleName: '1 Risk: Critical' }] },
      { key: 'High', label: 'High', rating: 'High', values: [0], cells: [null] },
      { key: 'Moderate', label: 'Moderate', rating: 'Moderate', values: [2], cells: [{ href: '/app/risks?residualRating=Moderate&state=open&stage=under-assessment', accessibleName: '2 Risks: Moderate' }] },
      { key: 'Low', label: 'Low', rating: 'Low', values: [0], cells: [null] },
      { key: 'notRated', label: 'Not rated', rating: null, values: [1], cells: [{ href: '/app/risks?residualRating=none&state=open&stage=under-assessment', accessibleName: '1 Risk: Not rated' }] },
    ]);
    expect(hasRisksUnderAssessment(riskExposure)).toBe(true);
    expect(hasRisksUnderAssessment({ underAssessment: { byResidualRating: { ...riskExposure.underAssessment.byResidualRating, Critical: 0, Moderate: 0, notRated: 0, total: 0 } } })).toBe(false);
  });

  it('says which stage each exposure section counts (D-42, D-54)', () => {
    expect(hasReleasedOpenRisks(riskExposure)).toBe(true);
    expect(hasReleasedOpenRisks({ byResidualRating: { ...riskExposure.byResidualRating, Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 } })).toBe(false);
    expect(reportSectionCopy.ratings.description).toBe('Released open Risks by inherent and residual rating, with accepted Risks by residual rating.');
    expect(reportSectionCopy.residualByTreatmentStatus.description).toBe(
      'Released open Risks by residual rating and treatment status. Treatment status is the value recorded on each Risk. Overdue by target date is in the Treatment performance report.',
    );
    expect(reportSectionCopy.exposedSystems.description).toBe(
      'Information Systems carrying the most released open High and Critical residual Risks, highest first. Select a system to view its released open Risks.',
    );
    expect(reportSectionCopy.underAssessment).toEqual({
      caption: 'Under assessment',
      description: 'Open Risks in risk assessments not yet released, by residual rating. They are not counted in the sections above.',
      rowHeader: 'Residual rating',
      columns: ['Risks'],
    });
    expect(reportEmptyStates.releasedOpenRisks).toEqual({ kind: 'cleared', noun: 'released open Risks', description: 'Risks count here once their risk assessment is released.' });
    expect(reportEmptyStates.risksUnderAssessment).toEqual({
      kind: 'cleared',
      noun: 'Risks under assessment',
      description: 'Risks appear here while their risk assessment is a draft or in review.',
    });
  });

  it('names the treatment status columns with the stored values, Total last', () => {
    expect(treatmentStatusColumns.map((column) => column.label)).toEqual(['Not Started', 'In Progress', 'Overdue', 'Complete', 'Not provided', 'Total']);
  });

  it('lays the residual rating by treatment status matrix out Critical to Low, then Not rated', () => {
    const rows = residualByTreatmentStatusRows(riskExposure.residualByTreatmentStatus);
    expect(rows.map((row) => [row.key, row.label, row.values])).toEqual([
      ['Critical', 'Critical', [1, 1, 0, 0, 0, 2]],
      ['High', 'High', [1, 1, 0, 0, 1, 3]],
      ['Moderate', 'Moderate', [0, 0, 0, 1, 0, 1]],
      ['Low', 'Low', [0, 0, 1, 0, 0, 1]],
      ['notRated', 'Not rated', [1, 0, 0, 0, 0, 1]],
    ]);
  });

  it('opens each non-zero matrix figure’s released open Risks by rating and treatment status, and each row Total by the rating alone (UI-SPEC §9.3)', () => {
    const [critical, high, , , notRated] = residualByTreatmentStatusRows(riskExposure.residualByTreatmentStatus);
    expect(critical?.cells).toEqual([
      { href: '/app/risks?residualRating=Critical&treatmentStatus=Not+Started&state=open&stage=released', accessibleName: '1 Risk: Critical, Not Started' },
      { href: '/app/risks?residualRating=Critical&treatmentStatus=In+Progress&state=open&stage=released', accessibleName: '1 Risk: Critical, In Progress' },
      null,
      null,
      null,
      { href: '/app/risks?residualRating=Critical&state=open&stage=released', accessibleName: '2 Risks: Critical, Total' },
    ]);
    expect(high?.cells?.[4]).toEqual({ href: '/app/risks?residualRating=High&treatmentStatus=none&state=open&stage=released', accessibleName: '1 Risk: High, Not provided' });
    expect(notRated?.cells?.[0]).toEqual({ href: '/app/risks?residualRating=none&treatmentStatus=Not+Started&state=open&stage=released', accessibleName: '1 Risk: Not rated, Not Started' });
  });

  it('lists exposed Information Systems by name, the name opening the system’s released open Risks and Critical and High their rating, with Total plain (D-37)', () => {
    expect(exposedSystemRows(riskExposure.exposedSystems)).toEqual([
      {
        key: 'system-1',
        label: 'Alpha system',
        values: [1, 1, 2],
        header: { href: '/app/risks?system=system-1&state=open&stage=released', accessibleName: 'Alpha system: view its released open Risks' },
        cells: [
          { href: '/app/risks?system=system-1&residualRating=Critical&state=open&stage=released', accessibleName: '1 Risk: Alpha system, Critical' },
          { href: '/app/risks?system=system-1&residualRating=High&state=open&stage=released', accessibleName: '1 Risk: Alpha system, High' },
          null,
        ],
      },
      {
        key: 'system-2',
        label: 'Beta system',
        values: [1, 1, 2],
        header: { href: '/app/risks?system=system-2&state=open&stage=released', accessibleName: 'Beta system: view its released open Risks' },
        cells: [
          { href: '/app/risks?system=system-2&residualRating=Critical&state=open&stage=released', accessibleName: '1 Risk: Beta system, Critical' },
          { href: '/app/risks?system=system-2&residualRating=High&state=open&stage=released', accessibleName: '1 Risk: Beta system, High' },
          null,
        ],
      },
    ]);
  });

  it('follows the no-impacted-system note with View Critical and View High, each opening its rating with no impacted system, and nothing without the note', () => {
    expect(exposedSystemsNoteLinks(riskExposure.exposedSystems)).toEqual([
      {
        label: 'View Critical',
        href: '/app/risks?impactedSystem=none&residualRating=Critical&state=open&stage=released',
        accessibleName: 'View Critical Risks with no impacted Information System',
      },
      {
        label: 'View High',
        href: '/app/risks?impactedSystem=none&residualRating=High&state=open&stage=released',
        accessibleName: 'View High Risks with no impacted Information System',
      },
    ]);
    expect(exposedSystemsNoteLinks({ ...riskExposure.exposedSystems, risksWithoutSystem: 0 })).toEqual([]);
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

describe('report scope copy (D-43, D-54, UI-SPEC §9.4)', () => {
  it('says the treatment and control figures include Risks under assessment, in the mitigation-control term', () => {
    expect(reportSectionCopy.dueState.description).toBe('Open Risks whose treatment is not Complete, by target date. Includes Risks under assessment.');
    expect(reportSectionCopy.treatmentStatus.description).toBe('All open Risks, by the treatment status recorded on each Risk. Includes Risks under assessment.');
    expect(reportSectionCopy.implementationStatus.description).toBe(
      'Mitigation controls on open Risks by implementation status. Select a status to view the Risks with those mitigation controls.',
    );
    expect(reportSectionCopy.implementationStatus.columns).toEqual(['Mitigation controls']);
    expect(reportSectionCopy.effectivenessRating.description).toBe(
      'Mitigation controls on open Risks by effectiveness rating. Select a rating to view the Risks with those mitigation controls.',
    );
    expect(reportSectionCopy.effectivenessRating.columns).toEqual(['Mitigation controls']);
    expect(reportEmptyStates.openRisks).toEqual({ kind: 'cleared', noun: 'open Risks', description: 'Risks appear here when a Risk Assessment identifies them.' });
    expect(reportEmptyStates.mitigationControls).toEqual({ kind: 'cleared', noun: 'mitigation controls', description: 'Mitigation controls appear here when they are added to open Risks.' });
    expect(JSON.stringify({ reportSectionCopy, reportEmptyStates })).not.toMatch(/Control Implementation/i);
  });
});

describe('control-effectiveness rows', () => {
  it('orders implementation statuses as stored, with Not provided last; each row header opens the Risks with those mitigation controls and the figures stay plain (D-36)', () => {
    const header = (status: string) => ({
      href: `/app/risks?mitigationStatus=${status}&state=open`,
      accessibleName: `${status}: view the Risks with ${status} mitigation controls`,
    });
    expect(implementationStatusRows(controlEffectiveness.implementationStatus)).toEqual([
      { key: 'existing', label: 'Existing', values: [1], header: header('Existing') },
      { key: 'planned', label: 'Planned', values: [1], header: header('Planned') },
      { key: 'implemented', label: 'Implemented', values: [2], header: header('Implemented') },
      { key: 'retired', label: 'Retired', values: [0], header: header('Retired') },
      // No list holds the Risks whose mitigation controls have no recorded status, so Not provided stays plain.
      { key: 'notProvided', label: 'Not provided', values: [1] },
    ]);
  });

  it('orders effectiveness ratings from Effective to Not Assessed, with Not provided last; each row header opens the Risks with those mitigation controls (D-36)', () => {
    const header = (rating: string, value: string) => ({
      href: `/app/risks?mitigationEffectiveness=${value}&state=open`,
      accessibleName: `${rating}: view the Risks with ${rating} mitigation controls`,
    });
    expect(effectivenessRatingRows(controlEffectiveness.effectivenessRating)).toEqual([
      { key: 'effective', label: 'Effective', values: [1], header: header('Effective', 'Effective') },
      { key: 'partiallyEffective', label: 'Partially Effective', values: [1], header: header('Partially Effective', 'Partially+Effective') },
      { key: 'ineffective', label: 'Ineffective', values: [1], header: header('Ineffective', 'Ineffective') },
      { key: 'notAssessed', label: 'Not Assessed', values: [1], header: header('Not Assessed', 'Not+Assessed') },
      {
        key: 'notProvided',
        label: 'Not provided',
        values: [1],
        header: {
          href: '/app/risks?mitigationEffectiveness=none&state=open',
          accessibleName: 'Not provided: view the Risks with mitigation controls whose effectiveness is not recorded',
        },
      },
    ]);
  });
});

describe('treatment-performance tiles and rows', () => {
  it('links each tile to the list its figure equals: the overdue and due-soon alerts and the register’s no-target-date list (UI-SPEC §8.2)', () => {
    expect(reportKpiTiles(treatmentPerformance)).toEqual([
      { key: 'overdue', caption: 'Overdue', value: 2, href: '/app/alerts?kind=risk-treatment-overdue' },
      { key: 'due-within-window', caption: 'Due within 14 days', value: 2, href: '/app/alerts?kind=risk-treatment-due-soon' },
      { key: 'no-target-date', caption: 'No target date', value: 2, href: '/app/risks?dueState=no-target-date' },
    ]);
    expect(reportKpiTiles({ ...treatmentPerformance, dueWindowDays: 21 })[1]?.caption).toBe('Due within 21 days');
    expect(reportKpiTiles({ ...treatmentPerformance, dueWindowDays: 1 })[1]?.caption).toBe('Due within 1 day');
  });

  it('orders the due states Overdue, due within the window, later, then no target date, each opening its list with a name that says what it counts', () => {
    expect(dueStateRows(treatmentPerformance)).toEqual([
      { key: 'overdue', label: 'Overdue', values: [2], cells: [{ href: '/app/alerts?kind=risk-treatment-overdue', accessibleName: '2 Risks: Overdue' }] },
      { key: 'dueWithinWindow', label: 'Due within 14 days', values: [2], cells: [{ href: '/app/alerts?kind=risk-treatment-due-soon', accessibleName: '2 Risks: Due within 14 days' }] },
      { key: 'later', label: 'Due later', values: [1], cells: [{ href: '/app/risks?dueState=later', accessibleName: '1 Risk: Due later' }] },
      { key: 'noTargetDate', label: 'No target date', values: [2], cells: [{ href: '/app/risks?dueState=no-target-date', accessibleName: '2 Risks: No target date' }] },
    ]);
  });

  it('orders the recorded treatment statuses as stored, with Not provided last, each opening the open Risks with that status (none for Not provided)', () => {
    expect(treatmentStatusRows(treatmentPerformance.treatmentStatus)).toEqual([
      { key: 'notStarted', label: 'Not Started', values: [3], cells: [{ href: '/app/risks?state=open&treatmentStatus=Not+Started', accessibleName: '3 Risks: Not Started' }] },
      { key: 'inProgress', label: 'In Progress', values: [2], cells: [{ href: '/app/risks?state=open&treatmentStatus=In+Progress', accessibleName: '2 Risks: In Progress' }] },
      { key: 'overdue', label: 'Overdue', values: [1], cells: [{ href: '/app/risks?state=open&treatmentStatus=Overdue', accessibleName: '1 Risk: Overdue' }] },
      { key: 'complete', label: 'Complete', values: [1], cells: [{ href: '/app/risks?state=open&treatmentStatus=Complete', accessibleName: '1 Risk: Complete' }] },
      { key: 'notProvided', label: 'Not provided', values: [1], cells: [{ href: '/app/risks?state=open&treatmentStatus=none', accessibleName: '1 Risk: Not provided' }] },
    ]);
  });

  it('carries no figure link for a zero, so a zero due state or treatment status is plain (X-10)', () => {
    const zero = zeroedReport(treatmentPerformance);
    expect(dueStateRows(zero).map((row) => row.cells)).toEqual([[null], [null], [null], [null]]);
    expect(treatmentStatusRows(zero.treatmentStatus).map((row) => row.cells)).toEqual([[null], [null], [null], [null], [null]]);
  });

  it('says how many overdue treatments a truncated list shows, and nothing otherwise', () => {
    expect(mostOverdueNote(treatmentPerformance.mostOverdue)).toBeNull();
    expect(mostOverdueNote({ ...treatmentPerformance.mostOverdue, total: 1_204, truncated: true })).toBe('Showing 1 of 1,204');
  });
});

describe('assessment-throughput tiles and rows', () => {
  it('opens the period’s released Risk Assessments from both tiles, naming the period and the median’s sample (D-39)', () => {
    const periodReleases = '/app/review/assessments?status=approved&approvedFrom=2026-04-01&approvedTo=2026-09-24';
    expect(reportKpiTiles(assessmentThroughput)).toEqual([
      { key: 'released-in-period', caption: 'Released in period', value: 3, supportingText: 'April 2026 to September 2026', href: periodReleases },
      { key: 'median-days-to-release', caption: 'Median days to release', value: 20, supportingText: 'Across 2 releases with a submission date', href: periodReleases },
    ]);
  });

  it('never shows a missing median as zero, and words a single or capped sample honestly', () => {
    const tiles = (median: AssessmentThroughputReport['medianDaysToRelease']) => reportKpiTiles({ ...assessmentThroughput, medianDaysToRelease: median })[1];
    expect(tiles({ value: null, sampleSize: 0, truncated: false })).toEqual({
      key: 'median-days-to-release',
      caption: 'Median days to release',
      value: null,
      supportingText: 'No release in this period has a submission date.',
      href: '/app/review/assessments?status=approved&approvedFrom=2026-04-01&approvedTo=2026-09-24',
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
    const monthRows = releasedMonthRows(assessmentThroughput.released.months, assessmentThroughput.today);
    expect(monthRows.map((row) => [row.key, row.label, row.values])).toEqual([
      ['2026-04-01', 'April 2026', [0]],
      ['2026-05-01', 'May 2026', [0]],
      ['2026-06-01', 'June 2026', [0]],
      ['2026-07-01', 'July 2026', [1]],
      ['2026-08-01', 'August 2026', [0]],
      ['2026-09-01', 'September 2026 (to date)', [2]],
    ]);
  });

  it('opens each non-zero month’s released Risk Assessments, its first day to its last or to today for the current month', () => {
    const monthRows = releasedMonthRows(assessmentThroughput.released.months, assessmentThroughput.today);
    expect(monthRows.map((row) => row.cells)).toEqual([
      [null],
      [null],
      [null],
      [{ href: '/app/review/assessments?status=approved&approvedFrom=2026-07-01&approvedTo=2026-07-31', accessibleName: '1 released in July 2026' }],
      [null],
      [{ href: '/app/review/assessments?status=approved&approvedFrom=2026-09-01&approvedTo=2026-09-24', accessibleName: '2 released in September 2026' }],
    ]);
    // A February ends on its own last day, in a leap year too.
    const february = releasedMonthRows([{ monthStart: '2028-02-01', count: 4, partial: false }], '2028-06-10');
    expect(february[0]?.cells?.[0]?.href).toBe('/app/review/assessments?status=approved&approvedFrom=2028-02-01&approvedTo=2028-02-29');
  });

  it('names the range in the monthly description', () => {
    expect(releasedPerMonthDescription(assessmentThroughput.released.months)).toBe(
      'Risk Assessments released by a Security Analyst in each UTC calendar month, April 2026 to September 2026. Release dates in the lists use your time zone.',
    );
  });

  it('lists the review-scope lifecycle states in request order with their labels, never Draft', () => {
    const lifecycle = (key: string, label: string, count: number) => ({
      key,
      label,
      values: [count],
      cells: [{ href: `/app/review/requests?queue=all&status=${key}`, accessibleName: `${count} ${count === 1 ? 'request' : 'requests'}: ${label}` }],
    });
    expect(requestLifecycleRows(assessmentThroughput.requestsByStatus)).toEqual([
      lifecycle('submitted', 'Submitted', 1),
      lifecycle('questionnaire-in-progress', 'Questionnaire in progress', 2),
      lifecycle('risk-assessment-drafted', 'Risk assessment drafted', 1),
      lifecycle('under-review', 'Under review', 3),
      // The approved row reads Released through the one status mapping, and opens the approved requests.
      lifecycle('approved', 'Released', 5),
      lifecycle('closed', 'Closed', 1),
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
      acceptedByResidualRating: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 },
      residualByTreatmentStatus: {
        Critical: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
        High: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
        Moderate: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
        Low: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
        notRated: { notStarted: 0, inProgress: 0, overdue: 0, complete: 0, notProvided: 0, total: 0 },
      },
      exposedSystems: { rows: [], total: 0, truncated: false, risksWithoutSystem: 0 },
      underAssessment: { byResidualRating: { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 } },
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
      dueWindowDays: 14,
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
