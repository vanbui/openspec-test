import { BarChart, type BarChartTone } from '@/components/csrm/bar-chart';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import type { AssessmentRating } from '../assessments/assessment-schema';
import {
  exposedSystemBars,
  exposedSystemRows,
  exposedSystemsNotes,
  hasHighOrCriticalResidualRisk,
  hasOpenContextualRisks,
  ratingRows,
  ratingScaleMax,
  ratingTableRows,
  reportEmptyStates,
  reportSectionCopy,
  residualByTreatmentStatusRows,
  treatmentStatusColumns,
  type RatingRow,
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

/** The risk-exposure report (UI-SPEC §4.4): open contextual Risks only, as the register's state=open. */
export function RiskExposureReportView({ report }: { report: RiskExposureReport }) {
  const copy = reportSectionCopy;
  const ratings = ratingRows(report.byInherentRating, report.byResidualRating);
  const openRisks = hasOpenContextualRisks(report);
  const systems = exposedSystemRows(report.exposedSystems);

  return (
    <>
      <ReportSection
        caption={copy.ratings.caption}
        chart={<RatingMultiples rows={ratings} />}
        description={copy.ratings.description}
        empty={openRisks ? undefined : reportEmptyStates.openContextualRisks}
        id="risk-exposure-ratings"
        table={<ReportTable caption={copy.ratings.caption} columns={copy.ratings.columns} rowHeader={copy.ratings.rowHeader} rows={ratingTableRows(ratings)} />}
      />
      <ReportSection
        caption={copy.residualByTreatmentStatus.caption}
        description={copy.residualByTreatmentStatus.description}
        empty={openRisks ? undefined : reportEmptyStates.openContextualRisks}
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
        empty={hasHighOrCriticalResidualRisk(report.exposedSystems) ? undefined : reportEmptyStates.highOrCriticalResidualRisks}
        id="risk-exposure-information-systems"
        notes={exposedSystemsNotes(report.exposedSystems)}
        table={systems.length > 0 ? <ReportTable caption={copy.exposedSystems.caption} columns={copy.exposedSystems.columns} rowHeader={copy.exposedSystems.rowHeader} rows={systems} /> : undefined}
      />
    </>
  );
}
