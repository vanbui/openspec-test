import { BarChart } from '@/components/csrm/bar-chart';
import {
  effectivenessRatingRows,
  implementationStatusRows,
  reportEmptyStates,
  reportSectionCopy,
  singleValueBars,
} from './report-presentation';
import type { ControlEffectivenessReport } from './report-schema';
import { ReportSection } from './report-section';
import { ReportTable } from './report-table';

/**
 * The control-effectiveness report (UI-SPEC §4.4, §9.4): mitigation controls (Control
 * Implementations) on open Risks in either stage, the scope of the ineffective-control alert (D-43).
 * Effectiveness is not the severity ladder, so both charts are ink. The figures count mitigation controls,
 * so they stay plain; each row header opens the Risks that hold them (D-36).
 */
export function ControlEffectivenessReportView({ report }: { report: ControlEffectivenessReport }) {
  const copy = reportSectionCopy;
  const empty = report.implementationStatus.total > 0 ? undefined : reportEmptyStates.mitigationControls;
  const statuses = implementationStatusRows(report.implementationStatus);
  const ratings = effectivenessRatingRows(report.effectivenessRating);

  return (
    <>
      <ReportSection
        caption={copy.implementationStatus.caption}
        chart={<BarChart data={singleValueBars(statuses)} presentation="figure-with-table" />}
        description={copy.implementationStatus.description}
        empty={empty}
        id="control-effectiveness-implementation-status"
        table={<ReportTable caption={copy.implementationStatus.caption} columns={copy.implementationStatus.columns} rowHeader={copy.implementationStatus.rowHeader} rows={statuses} />}
      />
      <ReportSection
        caption={copy.effectivenessRating.caption}
        chart={<BarChart data={singleValueBars(ratings)} presentation="figure-with-table" />}
        description={copy.effectivenessRating.description}
        empty={empty}
        id="control-effectiveness-rating"
        table={<ReportTable caption={copy.effectivenessRating.caption} columns={copy.effectivenessRating.columns} rowHeader={copy.effectivenessRating.rowHeader} rows={ratings} />}
      />
    </>
  );
}
