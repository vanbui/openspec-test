'use client';

import { CircleAlert } from 'lucide-react';
import { useEffect, useId, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';

/*
 * The column-choice primitive (Phase 19 D-06, X-30; 19-UI-SPEC §2.4), which Phase 18 adopts: a fieldset named
 * `Columns` with its count, `Select all` (hidden when every column is checked) and `Reset to visible` (shown only while
 * the choice differs from the visible columns), over one checkbox per column in the view's order, one column below
 * 640px and two from 640px. With none checked it says `Choose at least one column.` as a field error, whose id the
 * form's submit is described by.
 */

export type ColumnChoiceColumn = { readonly key: string; readonly label: string };

export type ColumnChoiceProps = {
  /** Every column the view offers, in its order. */
  columns: readonly ColumnChoiceColumn[];
  /** The checked column keys. */
  checked: ReadonlySet<string>;
  onChange: (checked: ReadonlySet<string>) => void;
  /** The columns the page shows, checked by default. */
  visibleKeys: readonly string[];
  /** A line under the legend, for a reference list's import rule (§2.4). */
  hint?: string;
  /**
   * Read-only while an export is pending (§2.6): every control keeps its place and its focus, and a press changes
   * nothing (19-UI-REVIEW UI-01, WCAG 2.4.3), so no control is disabled under the focus.
   */
  readOnly?: boolean;
  /** The id the `Choose at least one column.` error carries. */
  errorId: string;
};

function sameKeys(checked: ReadonlySet<string>, keys: readonly string[]): boolean {
  return checked.size === keys.length && keys.every((key) => checked.has(key));
}

type FocusTarget = 'select-all' | 'reset' | 'first-column';

/*
 * FE4-04 (WCAG 2.4.3): a pill removes itself once chosen, so focus moves to the other pill when the new choice shows it,
 * else to the first column, never to the dialog.
 */
function focusAfter(chosen: 'select-all' | 'reset', next: ReadonlySet<string>, allKeys: readonly string[], visibleKeys: readonly string[]): FocusTarget {
  if (chosen === 'select-all') return sameKeys(next, visibleKeys) ? 'first-column' : 'reset';
  return sameKeys(next, allKeys) ? 'first-column' : 'select-all';
}

export function ColumnChoice({ checked, columns, errorId, hint, onChange, readOnly = false, visibleKeys }: ColumnChoiceProps) {
  const id = useId();
  const allKeys = columns.map((column) => column.key);
  const countId = `${id}-count`;
  const hintId = `${id}-hint`;
  const allChecked = sameKeys(checked, allKeys);
  const isDefault = sameKeys(checked, visibleKeys);
  const selectAllRef = useRef<HTMLButtonElement>(null);
  const resetRef = useRef<HTMLButtonElement>(null);
  const firstColumnRef = useRef<HTMLButtonElement>(null);
  const pendingFocus = useRef<FocusTarget | null>(null);

  useEffect(() => {
    const target = pendingFocus.current;
    if (!target) return;
    pendingFocus.current = null;
    (target === 'select-all' ? selectAllRef : target === 'reset' ? resetRef : firstColumnRef).current?.focus();
  }, [allChecked, isDefault]);

  function choose(chosen: 'select-all' | 'reset') {
    if (readOnly) return;
    const next = new Set(chosen === 'select-all' ? allKeys : visibleKeys);
    pendingFocus.current = focusAfter(chosen, next, allKeys, visibleKeys);
    onChange(next);
  }

  function toggle(key: string, on: boolean) {
    if (readOnly) return;
    const next = new Set(checked);
    if (on) next.add(key);
    else next.delete(key);
    onChange(next);
  }

  return (
    // UI-04 (WCAG 3.3.1): with none checked, the group the invalid checkboxes belong to is described by the error too.
    <fieldset aria-describedby={[hint ? hintId : null, countId, checked.size === 0 ? errorId : null].filter(Boolean).join(' ')} className="grid gap-2">
      <legend className="text-sm font-medium text-foreground">Columns</legend>
      {hint ? <p className="text-xs text-foreground-secondary" id={hintId}>{hint}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs tabular-nums text-foreground-secondary" id={countId}>{`${checked.size} of ${columns.length} columns`}</p>
        {allChecked ? null : <Button aria-disabled={readOnly || undefined} onClick={() => choose('select-all')} ref={selectAllRef} size="sm" type="button" variant="ghost">Select all</Button>}
        {isDefault ? null : <Button aria-disabled={readOnly || undefined} onClick={() => choose('reset')} ref={resetRef} size="sm" type="button" variant="ghost">Reset to visible</Button>}
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {columns.map((column, index) => {
          const boxId = `${id}-${column.key}`;
          return (
            <li className="flex min-h-11 items-center gap-2 md:min-h-0" key={column.key}>
              <Checkbox
                aria-invalid={checked.size === 0 || undefined}
                aria-readonly={readOnly || undefined}
                checked={checked.has(column.key)}
                id={boxId}
                ref={index === 0 ? firstColumnRef : undefined}
                onCheckedChange={(state) => toggle(column.key, state === true)}
              />
              <label className="text-sm text-foreground" htmlFor={boxId}>{column.label}</label>
            </li>
          );
        })}
      </ul>
      {checked.size === 0 ? (
        <p className="flex items-start gap-2 text-xs text-destructive" id={errorId}>
          <CircleAlert aria-hidden="true" className="mt-px size-3.5 shrink-0" />
          <span>Choose at least one column.</span>
        </p>
      ) : null}
    </fieldset>
  );
}
