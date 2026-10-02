import { controlLabel, type ControlLabelSource } from '@/features/assessments/control-label';

/*
 * The Risk Type form's applicable-control options, free of zod so the form's pages and the search action
 * share one rule (D-29, D-36; UI-SPEC §16.2). Every option is named by the control label, never by an id.
 */

export type ApplicableControlOption = { documentId: string; label: string };

type ApplicableControlSource = ControlLabelSource & { readonly documentId: string };

/** The page's first options: how many controls the form offers before a search. */
export const initialApplicableControlLimit = 100;

function option(control: ApplicableControlSource): ApplicableControlOption {
  return { documentId: control.documentId, label: controlLabel(control) };
}

/** Options for search results, labelled in the order the server returned them. */
export function applicableControlSearchOptions(controls: readonly ApplicableControlSource[]): ApplicableControlOption[] {
  return controls.map(option);
}

/*
 * The first 100 controls by number, then each saved selection that falls beyond them. The form hides selected
 * controls from its list, so the added options only give the saved selections their labels. A saved id the
 * library no longer holds gets no option, and the form reads it as `Control not found`.
 */
export function applicableControlOptions(
  controls: readonly ApplicableControlSource[],
  selectedIds: readonly string[] = [],
): ApplicableControlOption[] {
  const sorted = [...controls].sort((left, right) => left.controlNumber.localeCompare(right.controlNumber, 'en-AU', { numeric: true }));
  const offered = sorted.slice(0, initialApplicableControlLimit);
  const offeredIds = new Set(offered.map((control) => control.documentId));
  const wanted = new Set(selectedIds.filter((documentId) => !offeredIds.has(documentId)));
  const saved = sorted.slice(initialApplicableControlLimit).filter((control) => wanted.has(control.documentId));
  return [...offered, ...saved].map(option);
}
