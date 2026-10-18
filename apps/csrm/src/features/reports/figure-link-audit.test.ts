import { describe, expect, it } from 'vitest';

import {
  dashboardKpiTiles,
  reviewQueueGroups,
  riskExposureRows,
  underAssessmentRow,
} from '../analyst-dashboard/analyst-dashboard-presentation';
import type { DashboardRiskExposure } from '../analyst-dashboard/analyst-dashboard-schema';
import { ownRequestsRows, ratingChipLinks, requestorHomeCopy, sectionFooter } from '../home/requestor-home-presentation';
import {
  dueStateRows,
  effectivenessRatingRows,
  exposedSystemRows,
  exposedSystemsNoteLinks,
  formatReportCount,
  implementationStatusRows,
  ratingRows,
  ratingTableRows,
  releasedMonthRows,
  reportKpiTiles,
  reportSectionCopy,
  requestLifecycleRows,
  residualByTreatmentStatusRows,
  treatmentStatusColumns,
  treatmentStatusRows,
  underAssessmentRows,
  zeroedReport,
  type ReportTableRow,
} from './report-presentation';
import type {
  AssessmentThroughputReport,
  ControlEffectivenessReport,
  RiskExposureReport,
  TreatmentPerformanceReport,
} from './report-schema';

/*
 * UX-09 criterion 2 (D-35 to D-39, X-10, UI-SPEC §8): every figure on the four reports and both Homes opens the
 * list that holds its records, or is a documented exception. The audit builds each surface's presentation from
 * fixtures where every count is above zero and walks every tile, row, table figure, row header and chip. A second
 * pass with every count at zero proves no table figure or rating chip links (a zero is plain), while tiles and
 * Home link rows still link at any value.
 */

type FigureLink = { href: string; accessibleName?: string } | null | undefined;

type AuditedFigure = {
  /** "{surface} | {part} | {row} | {position}" */
  key: string;
  /** The visible figure or label; a link's accessible name begins with it (WCAG 2.5.3). */
  visible: string;
  link: FigureLink;
  /** Table figures and rating chips are plain at zero; tiles, link rows and row headers link at any value. */
  plainAtZero: boolean;
  value: number;
};

/*
 * The documented exceptions. `*` matches any row. Each cites the decision that keeps the figure plain, and every
 * exception must still match a figure, so a stale one fails the audit.
 */
const exceptions: Record<string, string> = {
  'risk-exposure | Most exposed Information Systems | * | Total':
    'D-37: a system’s Total is the sum of its Critical and High figures, which each open their own list.',
  'risk-exposure | Most exposed Information Systems | coverage note | Risks without an impacted Information System':
    'D-37: the note’s figure is the sum of its View Critical and View High links, which each open their own list.',
  'control-effectiveness | Implementation status | * | Mitigation controls':
    'D-36: a count of mitigation controls never poses as an equal list; its row header opens the Risks that hold them.',
  'control-effectiveness | Effectiveness rating | * | Mitigation controls':
    'D-36: a count of mitigation controls never poses as an equal list; its row header opens the Risks that hold them.',
  'control-effectiveness | Implementation status | notProvided | row header':
    'Not provided: no list holds the Risks whose mitigation controls have no recorded implementation status (the register’s none lists Risks with no mitigation control); Phase 18’s mitigation-control table owns that list.',
};

function matchesException(key: string, pattern: string): boolean {
  const keyParts = key.split(' | ');
  const patternParts = pattern.split(' | ');
  return keyParts.length === patternParts.length && patternParts.every((part, index) => part === '*' || part === keyParts[index]);
}

function exceptionFor(key: string): string | undefined {
  return Object.entries(exceptions).find(([pattern]) => matchesException(key, pattern))?.[1];
}

/* ------------------------------------------------------------------ fixtures */

const ratings = (base: number) => ({ Critical: base, High: base + 1, Moderate: base + 2, Low: base + 3, notRated: base + 4, total: 5 * base + 10 });
const statuses = (base: number) => ({ notStarted: base, inProgress: base + 1, overdue: base + 2, complete: base + 3, notProvided: base + 4, total: 5 * base + 10 });

const riskExposure: RiskExposureReport = {
  key: 'risk-exposure',
  today: '2026-09-24',
  byResidualRating: ratings(2),
  byInherentRating: ratings(3),
  acceptedByResidualRating: ratings(1),
  residualByTreatmentStatus: { Critical: statuses(1), High: statuses(2), Moderate: statuses(3), Low: statuses(4), notRated: statuses(5) },
  exposedSystems: {
    rows: [
      { documentId: 'system-1', name: 'Alpha system', critical: 2, high: 3, total: 5 },
      { documentId: 'system-2', name: 'Beta system', critical: 1, high: 1, total: 2 },
    ],
    total: 2,
    truncated: false,
    risksWithoutSystem: 4,
  },
  underAssessment: { byResidualRating: ratings(1) },
};

const treatmentPerformance: TreatmentPerformanceReport = {
  key: 'treatment-performance',
  today: '2026-09-24',
  dueWindowDays: 14,
  dueState: { overdue: 2, dueWithinWindow: 3, later: 4, noTargetDate: 5, total: 14 },
  treatmentStatus: statuses(1),
  mostOverdue: { rows: [], total: 2, truncated: false },
};

const assessmentThroughput: AssessmentThroughputReport = {
  key: 'assessment-throughput',
  today: '2026-09-24',
  period: 6,
  periodStart: '2026-04-01',
  released: {
    months: ['2026-04-01', '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01'].map((monthStart, index) => ({
      monthStart,
      count: index + 1,
      partial: index === 5,
    })),
    total: 21,
  },
  medianDaysToRelease: { value: 20, sampleSize: 21, truncated: false },
  requestsByStatus: { submitted: 1, questionnaireInProgress: 2, riskAssessmentDrafted: 3, underReview: 4, approved: 5, closed: 6, total: 21 },
};

const controlEffectiveness: ControlEffectivenessReport = {
  key: 'control-effectiveness',
  today: '2026-09-24',
  implementationStatus: { existing: 1, planned: 2, implemented: 3, retired: 4, notProvided: 5, total: 15 },
  effectivenessRating: { effective: 1, partiallyEffective: 2, ineffective: 3, notAssessed: 4, notProvided: 5, total: 15 },
};

const kpiCounts = { needsYourAction: 2, overdue: 2, dueSoon: 4, attention: 1 };
// Phase 13 (D-15): the viewer's own counts and the team's pick-up pool, each above zero, so the walk reaches every new row.
const reviewQueue = {
  requiresAttention: 3,
  awaitingRequestor: 1,
  generationInProgress: 2,
  questionnairesReadyForReview: 4,
  assessmentsDraft: 5,
  assessmentsInReview: 6,
  mine: { requiresAttention: 2, awaitingRequestor: 1, generationInProgress: 1, withUnreadNotes: 1 },
  unassigned: 1,
};
const homeExposure: DashboardRiskExposure = { released: ratings(2), releasedAccepted: ratings(1), underAssessment: ratings(1) };
const byHolder = { requestor: 2, analyst: 3, none: 1 };
const homeRatings = { Low: 1, Moderate: 2, High: 3, Critical: 4 };
const homeSections = { needsAction: { shown: 10, total: 12 }, withAnalyst: { shown: 3, total: 3 }, released: { shown: 5, total: 9 } };

/* ------------------------------------------------------------------ the walk */

function tableFigures(surface: string, part: string, columns: readonly string[], rows: readonly ReportTableRow[]): AuditedFigure[] {
  return rows.flatMap((row) => row.values.map((value, index) => ({
    key: `${surface} | ${part} | ${row.key} | ${columns[index] ?? index}`,
    visible: formatReportCount(value),
    link: row.cells?.[index],
    plainAtZero: true,
    value,
  })));
}

function rowHeaders(surface: string, part: string, rows: readonly ReportTableRow[]): AuditedFigure[] {
  return rows.map((row) => ({ key: `${surface} | ${part} | ${row.key} | row header`, visible: row.label, link: row.header, plainAtZero: false, value: row.values[0] ?? 0 }));
}

function tileFigures(report: Parameters<typeof reportKpiTiles>[0]): AuditedFigure[] {
  return reportKpiTiles(report).map((tile) => ({
    key: `${report.key} | Summary | ${tile.key} | tile`,
    visible: tile.caption,
    link: tile.href ? { href: tile.href } : null,
    plainAtZero: false,
    value: tile.value ?? 0,
  }));
}

function reportFigures(fixtures: {
  riskExposure: RiskExposureReport;
  treatmentPerformance: TreatmentPerformanceReport;
  assessmentThroughput: AssessmentThroughputReport;
  controlEffectiveness: ControlEffectivenessReport;
}): AuditedFigure[] {
  const { riskExposure: exposure, treatmentPerformance: treatment, assessmentThroughput: throughput, controlEffectiveness: controls } = fixtures;
  const copy = reportSectionCopy;
  const systems = exposedSystemRows(exposure.exposedSystems);
  const implementation = implementationStatusRows(controls.implementationStatus);
  const effectiveness = effectivenessRatingRows(controls.effectivenessRating);
  return [
    ...tileFigures(exposure),
    ...tableFigures('risk-exposure', copy.ratings.caption, copy.ratings.columns,
      ratingTableRows(ratingRows(exposure.byInherentRating, exposure.byResidualRating, exposure.acceptedByResidualRating))),
    ...tableFigures('risk-exposure', copy.residualByTreatmentStatus.caption, treatmentStatusColumns.map((column) => column.label),
      residualByTreatmentStatusRows(exposure.residualByTreatmentStatus)),
    ...tableFigures('risk-exposure', copy.exposedSystems.caption, copy.exposedSystems.columns, systems),
    ...rowHeaders('risk-exposure', copy.exposedSystems.caption, systems),
    {
      key: `risk-exposure | ${copy.exposedSystems.caption} | coverage note | Risks without an impacted Information System`,
      visible: formatReportCount(exposure.exposedSystems.risksWithoutSystem),
      link: null,
      plainAtZero: true,
      value: exposure.exposedSystems.risksWithoutSystem,
    },
    ...exposedSystemsNoteLinks(exposure.exposedSystems).map((link) => ({
      key: `risk-exposure | ${copy.exposedSystems.caption} | coverage note | ${link.label}`,
      visible: link.label,
      link,
      plainAtZero: false,
      value: exposure.exposedSystems.risksWithoutSystem,
    })),
    ...tableFigures('risk-exposure', copy.underAssessment.caption, copy.underAssessment.columns, underAssessmentRows(exposure.underAssessment.byResidualRating)),

    ...tileFigures(treatment),
    ...tableFigures('treatment-performance', copy.dueState.caption, copy.dueState.columns, dueStateRows(treatment)),
    ...tableFigures('treatment-performance', copy.treatmentStatus.caption, copy.treatmentStatus.columns, treatmentStatusRows(treatment.treatmentStatus)),

    ...tileFigures(throughput),
    ...tableFigures('assessment-throughput', copy.releasedPerMonth.caption, copy.releasedPerMonth.columns, releasedMonthRows(throughput.released.months, throughput.today)),
    ...tableFigures('assessment-throughput', copy.requestLifecycle.caption, copy.requestLifecycle.columns, requestLifecycleRows(throughput.requestsByStatus)),

    ...tileFigures(controls),
    ...tableFigures('control-effectiveness', copy.implementationStatus.caption, copy.implementationStatus.columns, implementation),
    ...rowHeaders('control-effectiveness', copy.implementationStatus.caption, implementation),
    ...tableFigures('control-effectiveness', copy.effectivenessRating.caption, copy.effectivenessRating.columns, effectiveness),
    ...rowHeaders('control-effectiveness', copy.effectivenessRating.caption, effectiveness),
  ];
}

function homeFigures(fixtures: {
  kpi: typeof kpiCounts;
  queue: typeof reviewQueue;
  exposure: DashboardRiskExposure;
  holders: typeof byHolder;
  chips: typeof homeRatings;
  sections: typeof homeSections;
}): AuditedFigure[] {
  const analyst: AuditedFigure[] = [
    ...dashboardKpiTiles(fixtures.kpi, 14).map((tile) => ({
      key: `analyst Home | Needs action | ${tile.key} | tile`, visible: tile.caption, link: { href: tile.href }, plainAtZero: false, value: tile.value,
    })),
    ...reviewQueueGroups(fixtures.queue).flatMap((group) => group.rows.map((row) => ({
      key: `analyst Home | Review queue | ${group.key} ${row.key} | row`, visible: row.label, link: row, plainAtZero: false, value: row.count,
    }))),
    ...riskExposureRows(fixtures.exposure).flatMap((row) => [
      { key: `analyst Home | Risk exposure | ${row.key} | row`, visible: row.labelText, link: { href: row.href }, plainAtZero: false, value: row.value },
      // The accepted link renders only above zero (UI-D34), so it is a figure that is plain, by absence, at zero.
      {
        key: `analyst Home | Risk exposure | ${row.key} | accepted`,
        visible: row.accepted?.label ?? '',
        link: row.accepted,
        plainAtZero: true,
        value: fixtures.exposure.releasedAccepted[row.key],
      },
    ]),
    (() => {
      const row = underAssessmentRow(fixtures.exposure);
      return { key: 'analyst Home | Risk exposure | under assessment | row', visible: row.label, link: row, plainAtZero: false, value: row.count };
    })(),
    ...ownRequestsRows(fixtures.holders).map((row) => ({
      key: `analyst Home | Your own requests | ${row.key} | row`, visible: row.label, link: row, plainAtZero: false, value: row.count,
    })),
  ];
  const requestor: AuditedFigure[] = [
    ...(['needsAction', 'withAnalyst', 'released'] as const).map((section) => {
      const { shown, total } = fixtures.sections[section];
      const link = sectionFooter(requestorHomeCopy[section], shown, total).links[0];
      // The section total is a figure only when there is one: an empty section shows its empty state instead.
      return { key: `Requestor Home | ${requestorHomeCopy[section].heading} | total | View all`, visible: link?.label ?? '', link, plainAtZero: true, value: total };
    }),
    ...ratingChipLinks(fixtures.chips).map((chip) => ({
      key: `Requestor Home | Released assessments | ${chip.rating} | chip`,
      visible: chip.rating,
      link: chip.href ? { href: chip.href, accessibleName: chip.accessibleName } : null,
      plainAtZero: true,
      value: chip.count,
    })),
  ];
  return [...analyst, ...requestor];
}

const populated = [
  ...reportFigures({ riskExposure, treatmentPerformance, assessmentThroughput, controlEffectiveness }),
  ...homeFigures({ kpi: kpiCounts, queue: reviewQueue, exposure: homeExposure, holders: byHolder, chips: homeRatings, sections: homeSections }),
];

const zeroRatings = { Critical: 0, High: 0, Moderate: 0, Low: 0, notRated: 0, total: 0 };
const zeroed = [
  ...reportFigures({
    riskExposure: zeroedReport(riskExposure),
    treatmentPerformance: zeroedReport(treatmentPerformance),
    assessmentThroughput: zeroedReport(assessmentThroughput),
    controlEffectiveness: zeroedReport(controlEffectiveness),
  }),
  ...homeFigures({
    kpi: { needsYourAction: 0, overdue: 0, dueSoon: 0, attention: 0 },
    queue: {
      requiresAttention: 0,
      awaitingRequestor: 0,
      generationInProgress: 0,
      questionnairesReadyForReview: 0,
      assessmentsDraft: 0,
      assessmentsInReview: 0,
      mine: { requiresAttention: 0, awaitingRequestor: 0, generationInProgress: 0, withUnreadNotes: 0 },
      unassigned: 0,
    },
    exposure: { released: zeroRatings, releasedAccepted: zeroRatings, underAssessment: zeroRatings },
    holders: { requestor: 0, analyst: 0, none: 0 },
    chips: { Low: 0, Moderate: 0, High: 0, Critical: 0 },
    sections: { needsAction: { shown: 0, total: 0 }, withAnalyst: { shown: 0, total: 0 }, released: { shown: 0, total: 0 } },
  }),
];

describe('figure link audit (UX-09 criterion 2, D-35 to D-39, X-10)', () => {
  it('walks a figure on every surface, with every count above zero', () => {
    const surfaces = new Set(populated.map((figure) => figure.key.split(' | ')[0]));
    expect([...surfaces]).toEqual(['risk-exposure', 'treatment-performance', 'assessment-throughput', 'control-effectiveness', 'analyst Home', 'Requestor Home']);
    expect(populated.filter((figure) => figure.value <= 0).map((figure) => figure.key)).toEqual([]);
  });

  it('walks the analyst Home’s own-work figures: tile 1 and the five Phase 13 rows, each opening its list (D-15, X-10)', () => {
    const own = populated.filter((figure) => /^analyst Home \| (Needs action \| needs-your-action \| tile|Review queue \| (assigned-to-you [a-z-]+|assessment-requests waiting-for-pick-up) \| row)$/.test(figure.key));
    expect(own.map((figure) => [figure.key, figure.link?.href])).toEqual([
      ['analyst Home | Needs action | needs-your-action | tile', '/app/review/assigned?queue=requires-attention'],
      ['analyst Home | Review queue | assigned-to-you needs-your-action | row', '/app/review/assigned?queue=requires-attention'],
      ['analyst Home | Review queue | assigned-to-you with-new-notes | row', '/app/review/assigned?notes=unread'],
      ['analyst Home | Review queue | assigned-to-you awaiting-requestor | row', '/app/review/assigned?queue=awaiting-requestor'],
      ['analyst Home | Review queue | assigned-to-you generation-in-progress | row', '/app/review/assigned?queue=generation-in-progress'],
      ['analyst Home | Review queue | assessment-requests waiting-for-pick-up | row', '/app/review/requests?assignee=unassigned'],
    ]);
    expect(populated.filter((figure) => figure.key.startsWith('analyst Home | Review queue |'))).toHaveLength(11);
  });

  it('finds every figure on the four reports and both Homes opening its records, or a documented exception', () => {
    const unlinked = populated.filter((figure) => !figure.link?.href && !exceptionFor(figure.key));
    expect(unlinked.map((figure) => figure.key)).toEqual([]);
  });

  it('keeps every excepted figure plain, so a sum or a mitigation-control count never poses as an equal list (D-36, D-37)', () => {
    const excepted = populated.filter((figure) => exceptionFor(figure.key));
    expect(excepted.filter((figure) => figure.link?.href).map((figure) => figure.key)).toEqual([]);
  });

  it('cites D-36 or D-37 in each exception, or documents the plain Not provided implementation status, and matches each to a figure', () => {
    for (const [pattern, reason] of Object.entries(exceptions)) {
      const documented = /\bD-3[67]\b/.test(reason) || (pattern.endsWith('| notProvided | row header') && reason.startsWith('Not provided:'));
      expect(documented, `${pattern} cites its decision`).toBe(true);
      expect(populated.some((figure) => matchesException(figure.key, pattern)), `${pattern} still matches a figure`).toBe(true);
    }
    expect(Object.keys(exceptions)).toContain('risk-exposure | Most exposed Information Systems | * | Total');
    expect(Object.values(exceptions).some((reason) => reason.includes('D-36'))).toBe(true);
    expect(Object.values(exceptions).some((reason) => reason.includes('D-37'))).toBe(true);
  });

  it('opens the parts of every D-37 sum: each system’s Critical and High figures and the coverage note’s View Critical and View High', () => {
    const parts = populated.filter((figure) => /Most exposed Information Systems \| (system-\d \| (Critical|High)|coverage note \| View (Critical|High))$/.test(figure.key));
    expect(parts).toHaveLength(6);
    expect(parts.every((figure) => figure.link?.href)).toBe(true);
  });

  it('names every figure link with its visible figure or label first (WCAG 2.5.3, UI-SPEC §8.1)', () => {
    const named = populated.filter((figure) => figure.link?.accessibleName);
    expect(named.length).toBeGreaterThan(50);
    expect(named.filter((figure) => !figure.link!.accessibleName!.startsWith(figure.visible)).map((figure) => `${figure.key}: ${figure.link!.accessibleName}`)).toEqual([]);
  });

  it('builds every figure link as an internal path, never an absolute or protocol URL (T-11-42)', () => {
    const hrefs = populated.flatMap((figure) => (figure.link?.href ? [figure.link.href] : []));
    expect(hrefs.filter((href) => !/^\/app\/[a-z/-]+(\?[A-Za-z0-9=&%+_.-]*)?$/.test(href))).toEqual([]);
  });

  it('carries no link on a zero table figure, a zero rating chip or a zero accepted count, while tiles and link rows still link (X-10)', () => {
    expect(zeroed.filter((figure) => figure.plainAtZero && figure.link?.href).map((figure) => figure.key)).toEqual([]);
    const blockLinks = zeroed.filter((figure) => figure.key.endsWith('| tile') || figure.key.endsWith('| row'));
    expect(blockLinks.length).toBeGreaterThan(0);
    expect(blockLinks.filter((figure) => !figure.link?.href).map((figure) => figure.key)).toEqual([]);
  });
});
