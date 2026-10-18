import {
  CaseSensitiveIcon,
  CheckIcon,
  CircleQuestionMarkIcon,
  CircleXIcon,
  FileCheck2Icon,
  RefreshCwIcon,
} from 'lucide-react';

import { PresentedStatusBadge, unknownStatusPresentation, type StatusPresentation } from '@/components/csrm/status-badge';

import type { CsvRowState } from './csv-import-schema';

/*
 * A CSV import row's state, in its review and its results (direction section 4, CSV import rows; 19-UI-SPEC §5.6,
 * UI-D16, X-32). Only the Administration import flow imports this module, so the six states, their labels and their
 * icons ship on /app/admin/[collection]/import alone and never on the shared first-load badge map (19-13; B4, B5).
 *
 * A row that is or will be written is success, an unchanged row is neutral, and a row the Security Analyst must
 * correct in the file, or decide, is warning. An ambiguous row is a question and a similar row a case-sensitive mark,
 * never a severity or urgency icon.
 */
export const importRowPresentation = {
  create: { icon: CheckIcon, label: 'Create', tone: 'success' },
  update: { icon: RefreshCwIcon, label: 'Update', tone: 'success' },
  unchanged: { icon: FileCheck2Icon, label: 'Unchanged', tone: 'neutral' },
  rejected: { icon: CircleXIcon, label: 'Rejected', tone: 'warning' },
  ambiguous: { icon: CircleQuestionMarkIcon, label: 'Ambiguous', tone: 'warning' },
  similar: { icon: CaseSensitiveIcon, label: 'Matched by similar name', tone: 'warning' },
} as const satisfies Record<CsvRowState, StatusPresentation>;

/** A state's presentation, or the shared mapping's safe fallback for a value added before its label (the G-13 seam). */
function presentationOf(state: CsvRowState): StatusPresentation {
  const entries: Readonly<Record<string, StatusPresentation>> = importRowPresentation;
  return Object.hasOwn(entries, state) ? entries[state] : unknownStatusPresentation(String(state));
}

/** The label an import row state displays, for tiles, filters and accessible names that are not badges. */
export function importRowLabel(state: CsvRowState): string {
  return presentationOf(state).label;
}

/** An import row state's badge, through the shared tone rendering. */
export function ImportRowBadge({ state, className }: { state: CsvRowState; className?: string }) {
  return <PresentedStatusBadge className={className} presentation={presentationOf(state)} />;
}
