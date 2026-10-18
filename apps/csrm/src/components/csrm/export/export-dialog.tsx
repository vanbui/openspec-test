'use client';

import { CircleAlert, Download, Info, Loader2, TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type RefObject } from 'react';
import { toast } from 'sonner';

import { SegmentedControl } from '@/components/csrm/segmented-control';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import type { ExportActionResult } from '@/features/exports/export-actions';
import { EXPORT_FAILED, type ExportRefusalCopy } from '@/features/exports/export-refusal-copy';
import {
  exportDialogState,
  exportEmptyLine,
  exportFilterLines,
  exportFormatHint,
  exportOverLimitBody,
  exportRowCount,
  exportScopeSentence,
  readRememberedExportFormat,
  rememberExportFormat,
  type ExportFormat,
} from '@/features/exports/export-scope';
import { exportViewColumns, exportViewMeta } from '@/features/exports/export-vocabulary';
import { saveFile } from '@/lib/files/save-file';
import { cn } from '@/lib/utils';
import { ColumnChoice } from './column-choice';
import type { ExportButtonProps } from './export-button';

/*
 * The export dialog (Phase 19 X-30; 19-UI-SPEC §2), loaded on first use by ExportButton. In order: the scope sentence
 * with the active search and filters, `Format` with its hint, `Table` for a fixed-table view's CSV, the column choice
 * (or, for fixed tables, the line that every column is included), the state line or alert, then `Export file` and
 * `Cancel`. Everything it shows comes from the page, so it opens without a loading state.
 *
 * `Export file` calls the view's Server Action. While it runs, every choice stays in place and read-only and `Cancel`
 * stays enabled; closing discards the result. A file the server built is saved under the server's name, the dialog
 * closes, focus returns to Export and a success toast names the file and its rows. A refusal shows in the dialog with
 * family S1's copy and keeps every choice. An export changes nothing, so it asks for no confirmation and offers no Undo
 * (D-20). Below 768px it is a full-screen sheet with a visible title row and `Close`, as X-13's phone form.
 */

const formatOptions = [
  { value: 'xlsx', label: 'Excel workbook (.xlsx)' },
  { value: 'csv', label: 'CSV (.csv)' },
] as const satisfies readonly { value: ExportFormat; label: string }[];

/** Direction §4 Toasts: an info or success toast closes after 5s. */
const SUCCESS_TOAST_DURATION_MS = 5_000;

/* Below 768px the dialog is the phone sheet. Without matchMedia (a test environment) it is the form dialog. */
const phoneQuery = '(max-width: 767px)';
function subscribeToPhone(onChange: () => void): () => void {
  const query = window.matchMedia?.(phoneQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
function useIsPhone(): boolean {
  return useSyncExternalStore(subscribeToPhone, () => window.matchMedia?.(phoneQuery).matches ?? false, () => false);
}

export type ExportDialogProps = ExportButtonProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called once the dialog's code has loaded and it has rendered. */
  onReady: () => void;
  /** Export, which takes focus back when the dialog closes. */
  returnFocusTo: RefObject<HTMLButtonElement | null>;
};

export default function ExportDialog(props: ExportDialogProps) {
  const { fixedTables, heading, onOpenChange, onReady, open, returnFocusTo } = props;
  const isPhone = useIsPhone();
  const title = `Export ${heading}`;

  useEffect(() => {
    onReady();
  }, [onReady]);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className={cn(
          'flex flex-col gap-4',
          isPhone
            ? 'inset-0 top-0 left-0 h-dvh max-h-none w-full max-w-none translate-x-0 translate-y-0 rounded-none border-0 p-0 sm:max-w-none'
            : 'max-h-[calc(100dvh-2rem)] sm:max-w-[640px]',
        )}
        data-export-frame={isPhone ? 'phone-sheet' : 'dialog'}
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          returnFocusTo.current?.focus();
        }}
        onOpenAutoFocus={(event) => {
          // §2.6: focus starts on the checked Format segment.
          const checked = (event.currentTarget as HTMLElement | null)?.querySelector<HTMLElement>('[data-export-format] [role="radio"][data-state="checked"]');
          if (!checked) return;
          event.preventDefault();
          checked.focus();
        }}
        showCloseButton={!isPhone}
      >
        {isPhone ? (
          <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-2">
            <DialogTitle className="text-heading-sm text-foreground">{title}</DialogTitle>
            <DialogClose asChild>
              <Button className="min-h-11" type="button" variant="outline">Close</Button>
            </DialogClose>
          </div>
        ) : (
          <DialogTitle className="text-heading-sm text-foreground">{title}</DialogTitle>
        )}
        {/* Review amendment R1 part 1, rows 9 and 10: a fixed-table view offers no columns, and a Table for a CSV. */}
        <DialogDescription className="sr-only">
          {fixedTables ? 'Choose the file’s format and, for a CSV, its table, then export the file.' : 'Choose the file’s format and columns, then export the file.'}
        </DialogDescription>
        <ExportForm {...props} isPhone={isPhone} onClose={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}

type ExportFormProps = ExportButtonProps & { isPhone: boolean; onClose: () => void };

/*
 * The form, mounted with each opening (Radix unmounts closed content), so a refusal never outlives its opening and the
 * columns start at the visible ones each time; the format starts at the one last chosen.
 */
function ExportForm({ action, chips, columnsHint, fixedTables, isPhone, multiplePages, onClose, query, scope, search, searchActive, total, view, visibleColumns }: ExportFormProps) {
  const id = useId();
  // A fixed-table view (a report, a released assessment) is no list view: it has no columns and words its own scope.
  const records = fixedTables ? 'rows' : exportViewMeta(view).records;
  const columns = fixedTables ? [] : exportViewColumns(view);
  const visibleKeys = visibleColumns ?? columns.filter((column) => column.visible).map((column) => column.key);

  const [format, setFormat] = useState<ExportFormat>(readRememberedExportFormat);
  const [checked, setChecked] = useState<ReadonlySet<string>>(() => new Set(visibleKeys));
  const [table, setTable] = useState<string | undefined>(fixedTables?.[0]?.key);
  const [pending, setPending] = useState(false);
  const [refusal, setRefusal] = useState<ExportRefusalCopy | null>(null);
  const alive = useRef(true);
  const lastInput = useRef<Record<string, unknown> | null>(null);
  const refusalTitle = useRef<HTMLDivElement>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  useEffect(() => {
    if (refusal) refusalTitle.current?.focus();
  }, [refusal]);

  const filtered = searchActive || chips.length > 0;
  const state = exportDialogState({ total, checkedColumns: fixedTables ? 1 : checked.size, filtered });
  const stateId = `${id}-state`;
  const columnErrorId = `${id}-columns-error`;
  const formatHintId = `${id}-format-hint`;
  const csvTable = fixedTables && format === 'csv';

  function chooseFormat(next: ExportFormat) {
    if (pending) return;
    setFormat(next);
    rememberExportFormat(next);
  }

  function input(): Record<string, unknown> {
    if (fixedTables) return { query, format, ...(format === 'csv' && table ? { table } : {}) };
    return { query, format, columns: columns.map((column) => column.key).filter((key) => checked.has(key)) };
  }

  async function send(request: Record<string, unknown>, { retrying = false }: { retrying?: boolean } = {}) {
    lastInput.current = request;
    // FE4-04: Try again keeps the refusal, and itself, in place while it runs, so the focus on it is never lost.
    if (!retrying) setRefusal(null);
    setPending(true);
    let result: ExportActionResult;
    try {
      result = await action(request);
    } catch {
      // A network failure or a timeout reaching the action reads as the failed file (S1).
      result = { ok: false, refusal: EXPORT_FAILED };
    }
    // Closing while pending discards the result: nothing is saved and no toast shows (§2.6).
    if (!alive.current) return;
    setPending(false);
    if (!result.ok) {
      // A fresh copy each time, so a refusal repeated by Try again still moves focus to its title.
      setRefusal({ ...result.refusal });
      return;
    }
    saveFile({ fileName: result.fileName, contentType: result.contentType, bytes: result.bytes });
    onClose();
    toast.success(`Exported ${result.fileName}`, { description: exportRowCount(result.rowCount), duration: SUCCESS_TOAST_DURATION_MS });
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending || state !== 'ready') return;
    void send(input());
  }

  /* §2.6: Enter in the form exports. A radio or checkbox does not act on Enter, so the form submits for it. */
  function submitOnEnter(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== 'Enter' || event.nativeEvent.isComposing) return;
    const role = (event.target as HTMLElement).getAttribute('role');
    if (role !== 'radio' && role !== 'checkbox') return;
    event.preventDefault();
    event.currentTarget.requestSubmit();
  }

  const describedBy = [
    state === 'ready' ? null : state === 'no-columns' ? columnErrorId : stateId,
    refusal ? `${id}-refusal` : null,
  ].filter(Boolean).join(' ') || undefined;

  return (
    <form
      className={cn('flex min-h-0 flex-1 flex-col gap-4', isPhone && 'px-4 pb-4')}
      noValidate
      onKeyDown={submitOnEnter}
      onSubmit={submit}
    >
      <div className="grid min-h-0 flex-1 content-start gap-6 overflow-y-auto">
        <div className="grid gap-2">
          <p className="text-sm text-foreground tabular-nums">
            {fixedTables && scope ? scope : exportScopeSentence({ total, records, searchActive, filtersActive: chips.length > 0, multiplePages })}
          </p>
          {exportFilterLines({ search: searchActive ? search : undefined, chips }).map((line) => (
            <p className="text-xs text-foreground-secondary [overflow-wrap:anywhere]" key={line}>{line}</p>
          ))}
        </div>
        {/*
          * §2.6: while the file is built the choices stay in place, focusable and read-only (19-UI-REVIEW UI-01): a
          * disabled control under the focus would drop it to the page (WCAG 2.4.3).
          */}
        <>
          <div className="grid gap-2" data-export-format="">
            <SegmentedControl describedBy={formatHintId} label="Format" onValueChange={chooseFormat} options={formatOptions} readOnly={pending} value={format} />
            <p className="text-xs text-foreground-secondary" id={formatHintId}>{exportFormatHint(format, fixedTables?.length ?? 1)}</p>
          </div>
          {csvTable ? (
            <div className="grid gap-2">
              <span className="text-sm font-medium text-foreground" id={`${id}-table`}>Table</span>
              <RadioGroup aria-labelledby={`${id}-table`} aria-readonly={pending || undefined} onValueChange={(next) => { if (!pending) setTable(next); }} value={table}>
                {fixedTables.map((option) => (
                  <label className="flex min-h-11 items-center gap-2 text-sm text-foreground md:min-h-0" key={option.key}>
                    <RadioGroupItem aria-label={option.heading} value={option.key} />
                    {option.heading}
                  </label>
                ))}
              </RadioGroup>
            </div>
          ) : null}
          {fixedTables ? (
            <p className="text-xs text-foreground-secondary">Every column of each table is included, as on the page.</p>
          ) : (
            <ColumnChoice
              checked={checked}
              columns={columns}
              errorId={columnErrorId}
              {...(columnsHint ? { hint: columnsHint } : {})}
              onChange={setChecked}
              readOnly={pending}
              visibleKeys={visibleKeys}
            />
          )}
        </>
        {state === 'empty' || state === 'empty-filtered' ? (
          <p className="flex items-start gap-2 text-sm text-foreground-secondary" id={stateId}>
            <Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
            <span>{exportEmptyLine(state, records)}</span>
          </p>
        ) : null}
        {state === 'over-limit' ? (
          <Alert id={stateId} variant="warning">
            <TriangleAlert aria-hidden="true" />
            <AlertTitle>Too many rows to export</AlertTitle>
            <AlertDescription>{exportOverLimitBody(total, records)}</AlertDescription>
          </Alert>
        ) : null}
        {/* Accessibility contract 4.1.3 (FE4-03): focus moves to the refusal's title, so the alert is no live region too. */}
        {refusal ? (
          <Alert data-tone={refusal.tone} id={`${id}-refusal`} role={undefined} variant={refusal.tone === 'warning' ? 'warning' : 'destructive'}>
            {refusal.tone === 'warning' ? <TriangleAlert aria-hidden="true" /> : <CircleAlert aria-hidden="true" />}
            {/* S1 gives some refusals a title (EXPORT_CELL_TOO_LONG): the title takes focus, and its sentence follows. */}
            <AlertTitle className="line-clamp-none outline-none" ref={refusalTitle} tabIndex={-1}>{refusal.title ?? refusal.message}</AlertTitle>
            {refusal.title ? <AlertDescription><p>{refusal.message}</p></AlertDescription> : null}
            {refusal.retry ? (
              <AlertDescription>
                {/* Read-only while it runs, but still focusable, so focus stays here until the result arrives. */}
                <Button
                  aria-disabled={pending || undefined}
                  className="mt-2"
                  onClick={() => {
                    if (!pending && lastInput.current) void send(lastInput.current, { retrying: true });
                  }}
                  size="sm"
                  type="button"
                  variant="outline"
                >
                  {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : null}
                  {pending ? 'Exporting…' : 'Try again'}
                </Button>
              </AlertDescription>
            ) : null}
          </Alert>
        ) : null}
      </div>
      <div className="flex flex-col gap-2 md:flex-row-reverse md:justify-start">
        {/* UI-01: the pressed button keeps focus while it runs, read-only by aria-disabled; submit() ignores a second press. */}
        <Button aria-describedby={describedBy} aria-disabled={pending || undefined} className="min-h-11 md:min-h-0" disabled={!pending && state !== 'ready'} type="submit">
          {pending ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Download aria-hidden="true" className="size-4" />}
          {pending ? 'Exporting…' : 'Export file'}
        </Button>
        <Button className="min-h-11 md:min-h-0" onClick={onClose} type="button" variant="outline">Cancel</Button>
      </div>
    </form>
  );
}
