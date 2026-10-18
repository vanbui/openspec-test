import { BarChart } from '@/components/csrm/bar-chart';
import {
  releasedMonthBars,
  releasedMonthRows,
  releasedPerMonthDescription,
  reportEmptyStates,
  reportSectionCopy,
  requestLifecycleRows,
  singleValueBars,
} from './report-presentation';
import type { AssessmentThroughputReport } from './report-schema';
import { ReportSection } from './report-section';
import { ReportTable } from './report-table';

/**
 * The assessment-throughput report (UI-SPEC §4.4). Released months are a time series, so they are
 * columns from the medium container size and bars below it, and they never collapse to an empty
 * state: zero months are data. The current month is partial, marked by a dashed outline, the
 * "Current month to date" legend and "(to date)" in its table row, never by colour alone (X-7).
 * The lifecycle section is a current snapshot, not limited to the period.
 */
export function AssessmentThroughputReportView({ report }: { report: AssessmentThroughputReport }) {
  const copy = reportSectionCopy;
  const lifecycle = requestLifecycleRows(report.requestsByStatus);

  return (
    <>
      <ReportSection
        caption={copy.releasedPerMonth.caption}
        chart={(
          <BarChart
            data={releasedMonthBars(report.released.months)}
            orientation="column"
            partialLabel={copy.releasedPerMonth.legend}
            presentation="figure-with-table"
          />
        )}
        description={releasedPerMonthDescription(report.released.months)}
        id="assessment-throughput-released"
        table={(
          <ReportTable
            caption={copy.releasedPerMonth.caption}
            columns={copy.releasedPerMonth.columns}
            rowHeader={copy.releasedPerMonth.rowHeader}
            rows={releasedMonthRows(report.released.months, report.today)}
          />
        )}
      />
      <ReportSection
        caption={copy.requestLifecycle.caption}
        chart={<BarChart data={singleValueBars(lifecycle)} presentation="figure-with-table" />}
        description={copy.requestLifecycle.description}
        empty={report.requestsByStatus.total > 0 ? undefined : reportEmptyStates.assessmentRequests}
        id="assessment-throughput-lifecycle"
        table={<ReportTable caption={copy.requestLifecycle.caption} columns={copy.requestLifecycle.columns} rowHeader={copy.requestLifecycle.rowHeader} rows={lifecycle} />}
      />
    </>
  );
}
