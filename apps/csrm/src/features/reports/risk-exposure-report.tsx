import { BarChart, type BarChartTone } from '@/components/csrm/bar-chart';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import type { AssessmentRating } from '../assessments/assessment-schema';
import {
  exposedSystemBars,
  exposedSystemRows,
  exposedSystemsNoteLinks,
  exposedSystemsNotes,
  hasHighOrCriticalResidualRisk,
  hasReleasedOpenRisks,
  hasRisksUnderAssessment,
  ratingRows,
  ratingScaleMax,
  ratingTableRows,
  reportEmptyStates,
  reportSectionCopy,
  residualByTreatmentStatusRows,
  treatmentStatusColumns,
  underAssessmentRows,
  type RatingRow,
  type UnderAssessmentRow,
} from './report-presentation';
import type { RiskExposureReport } from './report-schema';
import { ReportSection } from './report-section';
import { ReportTable } from './report-table';

/* A severity mark fills with the rating's own fg token; an unrated Risk is ink (§3.14). */
const ratingTones = {
  Critical: 'risk-critical',
  High: 'risk-high',
  Moderate: 'risk-moderate',
  Low: 'risk-low',
} as const satisfies Record<AssessmentRating, BarChartTone>;

function ratingBars(rows: readonly RatingRow[], measure: 'inherent' | 'residual') {
  return rows.map((row) => ({
    key: row.key,
    // The badge keeps the rating's icon and word beside its colour.
    label: row.rating ? <RiskRatingBadge rating={row.rating} /> : row.label,
    labelText: row.label,
    value: row[measure],
    tone: row.rating ? ratingTones[row.rating] : 'ink',
  } as const));
}

/** The Under assessment bars, Critical to Low then Not rated, each toned by its rating (§3.14). */
function underAssessmentBars(rows: readonly UnderAssessmentRow[]) {
  return rows.map((row) => ({
    key: row.key,
    label: row.rating ? <RiskRatingBadge rating={row.rating} /> : row.label,
    labelText: row.label,
    value: row.values[0] ?? 0,
    tone: row.rating ? ratingTones[row.rating] : 'ink',
  } as const));
}

/**
 * Inherent and residual ratings as small multiples on one shared scale: side by side once the
 * section is wide enough, stacked below that. The whole graphic, captions included, is hidden from
 * assistive technology; the rating table beside it carries the same figures.
 */
function RatingMultiples({ rows }: { rows: readonly RatingRow[] }) {
  const scaleMax = ratingScaleMax(rows);
  const captions = reportSectionCopy.ratings.charts;

  return (
    <div aria-hidden="true" className="grid gap-gutter-xs sm:gap-gutter-sm @xl:grid-cols-2" data-slot="report-chart">
      {(['inherent', 'residual'] as const).map((measure) => (
        <div className="min-w-0 space-y-2" key={measure}>
          <p className="micro-label text-muted-foreground">{captions[measure]}</p>
          <BarChart data={ratingBars(rows, measure)} presentation="figure-with-table" scaleMax={scaleMax} />
        </div>
      ))}
    </div>
  );
}

/**
 * The risk-exposure report (UI-SPEC §4.4, §9.3). The first three sections count released open Risks
 * (the register's state=open and stage=released); the Under assessment section counts the open Risks
 * whose risk assessment is not yet released, apart, so the two stages are never read as one total.
 */
export function RiskExposureReportView({ report }: { report: RiskExposureReport }) {
  const copy = reportSectionCopy;
  const ratings = ratingRows(report.byInherentRating, report.byResidualRating, report.acceptedByResidualRating);
  const released = hasReleasedOpenRisks(report);
  const releasedEmpty = released ? undefined : reportEmptyStates.releasedOpenRisks;
  const systems = exposedSystemRows(report.exposedSystems);
  const underAssessment = underAssessmentRows(report.underAssessment.byResidualRating);
  const systemsEmpty = releasedEmpty ?? (hasHighOrCriticalResidualRisk(report.exposedSystems) ? undefined : reportEmptyStates.highOrCriticalResidualRisks);

  return (
    <>
      <ReportSection
        caption={copy.ratings.caption}
        chart={<RatingMultiples rows={ratings} />}
        description={copy.ratings.description}
        empty={releasedEmpty}
        id="risk-exposure-ratings"
        table={<ReportTable caption={copy.ratings.caption} columns={copy.ratings.columns} rowHeader={copy.ratings.rowHeader} rows={ratingTableRows(ratings)} />}
      />
      <ReportSection
        caption={copy.residualByTreatmentStatus.caption}
        description={copy.residualByTreatmentStatus.description}
        empty={releasedEmpty}
        id="risk-exposure-treatment-status"
        // A rating-by-status matrix needs more than two series, so it is a table only (§3.14).
        table={(
          <ReportTable
            caption={copy.residualByTreatmentStatus.caption}
            columns={treatmentStatusColumns.map((column) => column.label)}
            rowHeader={copy.residualByTreatmentStatus.rowHeader}
            rows={residualByTreatmentStatusRows(report.residualByTreatmentStatus)}
            scrollLabel={copy.residualByTreatmentStatus.scrollLabel}
          />
        )}
      />
      <ReportSection
        caption={copy.exposedSystems.caption}
        chart={systems.length > 0 ? <BarChart data={exposedSystemBars(report.exposedSystems)} presentation="figure-with-table" /> : undefined}
        description={copy.exposedSystems.description}
        empty={systemsEmpty}
        id="risk-exposure-information-systems"
        noteLinks={exposedSystemsNoteLinks(report.exposedSystems)}
        notes={exposedSystemsNotes(report.exposedSystems)}
        table={systems.length > 0 ? <ReportTable caption={copy.exposedSystems.caption} columns={copy.exposedSystems.columns} rowHeader={copy.exposedSystems.rowHeader} rows={systems} /> : undefined}
      />
      <ReportSection
        caption={copy.underAssessment.caption}
        chart={<BarChart data={underAssessmentBars(underAssessment)} presentation="figure-with-table" />}
        description={copy.underAssessment.description}
        empty={hasRisksUnderAssessment(report) ? undefined : reportEmptyStates.risksUnderAssessment}
        id="risk-exposure-under-assessment"
        table={<ReportTable caption={copy.underAssessment.caption} columns={copy.underAssessment.columns} rowHeader={copy.underAssessment.rowHeader} rows={underAssessment} />}
      />
    </>
  );
}
