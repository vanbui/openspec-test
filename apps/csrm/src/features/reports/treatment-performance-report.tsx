import Link from 'next/link';

import { BarChart } from '@/components/csrm/bar-chart';
import { AlertRow } from '../alerts/alert-row';
import {
  dueStateRows,
  hasOpenContextualTreatments,
  mostOverdueNote,
  overdueTreatmentsHref,
  reportEmptyStates,
  reportSectionCopy,
  singleValueBars,
  treatmentStatusRows,
} from './report-presentation';
import type { TreatmentPerformanceReport } from './report-schema';
import { ReportSection } from './report-section';
import { ReportTable } from './report-table';

/*
 * A footer text link (UI-SPEC §2.4): ink with its at-rest underline, the button type size, and the
 * touch-target height below md. Written out rather than merged, because a merge drops the type
 * token beside a text colour.
 */
const footerLinkClassName =
  'inline-flex min-h-11 items-center self-start text-button text-foreground underline decoration-muted-foreground underline-offset-3 '
  + 'transition-colors duration-(--duration-micro) ease-standard hover:decoration-foreground md:min-h-6';

/**
 * The most overdue treatments as shared alert rows (UI-D11), then the truncation note and the list
 * link. The list role is explicit: without markers, some screen readers drop list semantics.
 */
function MostOverdueTreatments({ mostOverdue }: { mostOverdue: TreatmentPerformanceReport['mostOverdue'] }) {
  const note = mostOverdueNote(mostOverdue);

  return (
    <>
      <ul role="list">
        {mostOverdue.rows.map((alert) => (
          <li className="border-t border-border py-4 first:border-t-0 first:pt-0 last:pb-0" key={alert.id}>
            <AlertRow alert={alert} />
          </li>
        ))}
      </ul>
      <div className="flex flex-col gap-1 border-t border-border pt-4">
        {note ? <p className="text-xs tabular-nums text-foreground-secondary">{note}</p> : null}
        <Link className={footerLinkClassName} href={overdueTreatmentsHref}>{reportSectionCopy.mostOverdue.viewAll}</Link>
      </div>
    </>
  );
}

/**
 * The treatment-performance report (UI-SPEC §4.4). Due state follows the D-04 rule over open
 * treatments that are not Complete; treatment status is the value recorded on every open
 * contextual Risk. Both are categorical, so both charts are ink.
 */
export function TreatmentPerformanceReportView({ report }: { report: TreatmentPerformanceReport }) {
  const copy = reportSectionCopy;
  const openRisks = hasOpenContextualTreatments(report) ? undefined : reportEmptyStates.openContextualRisks;
  const dueStates = dueStateRows(report);
  const statuses = treatmentStatusRows(report.treatmentStatus);

  return (
    <>
      <ReportSection
        caption={copy.dueState.caption}
        chart={<BarChart data={singleValueBars(dueStates)} presentation="figure-with-table" />}
        description={copy.dueState.description}
        empty={openRisks}
        id="treatment-performance-due-state"
        table={<ReportTable caption={copy.dueState.caption} columns={copy.dueState.columns} rowHeader={copy.dueState.rowHeader} rows={dueStates} />}
      />
      <ReportSection
        caption={copy.treatmentStatus.caption}
        chart={<BarChart data={singleValueBars(statuses)} presentation="figure-with-table" />}
        description={copy.treatmentStatus.description}
        empty={openRisks}
        id="treatment-performance-status"
        table={<ReportTable caption={copy.treatmentStatus.caption} columns={copy.treatmentStatus.columns} rowHeader={copy.treatmentStatus.rowHeader} rows={statuses} />}
      />
      <ReportSection
        caption={copy.mostOverdue.caption}
        description={copy.mostOverdue.description}
        empty={report.mostOverdue.total > 0 ? undefined : reportEmptyStates.overdueTreatments}
        id="treatment-performance-most-overdue"
      >
        <MostOverdueTreatments mostOverdue={report.mostOverdue} />
      </ReportSection>
    </>
  );
}
