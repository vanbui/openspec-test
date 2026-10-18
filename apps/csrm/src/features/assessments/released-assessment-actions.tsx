import { Printer } from 'lucide-react';
import Link from 'next/link';

import { ExportButton } from '@/components/csrm/export/export-button';
import { buttonVariants } from '@/components/ui/button';
import { exportReleasedAssessmentAction } from '@/features/exports/export-actions';

import type { ReleasedAssessmentActions } from './assessment-report-model';

/*
 * The released header's actions (19-UI-SPEC §1, §4.1; D-15, D-20, D-21; UI-D2), rendered on the server by the page's
 * data component after its reads (the export placement pattern, the pilot's ruling of 2026-10-16) and handed to the
 * view's header. `Print report` comes first in the markup and Export last, in the administration header's wrapper: the
 * keyboard, screen readers and the phone stack read Export last, and on desktop `Print report` keeps the right edge.
 *
 * Export is a fixed-table record view: no column choice, a Table choice for CSV, the action bound to the assessment's
 * id. Rendering it is presentation only; the export operation refuses every export the viewer may not make (D-16).
 */
export function ReleasedAssessmentHeaderActions({ actions }: { actions: ReleasedAssessmentActions }) {
  const print = (
    <Link className={buttonVariants({ variant: 'outline' })} href={actions.reportHref}>
      <Printer aria-hidden="true" className="size-4" />
      Print report
    </Link>
  );
  if (!actions.export) return print;
  return (
    <div className="flex w-full flex-col gap-2 md:w-auto md:flex-row-reverse">
      {print}
      <ExportButton
        action={exportReleasedAssessmentAction.bind(null, actions.documentId)}
        chips={[]}
        fixedTables={actions.export.tables}
        heading={actions.assessmentNumber}
        multiplePages={false}
        query={{}}
        scope={actions.export.scope}
        searchActive={false}
        total={actions.export.tables.length}
        view="released-assessment"
      />
    </div>
  );
}
