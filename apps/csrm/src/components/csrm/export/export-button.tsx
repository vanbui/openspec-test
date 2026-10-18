'use client';

import { Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import { toastAction } from '@/components/ui/toast-action';
import type { ExportActionResult } from '@/features/exports/export-actions';
import { EXPORT_FAILED } from '@/features/exports/export-refusal-copy';
import type { ExportDialogProps } from './export-dialog';

/*
 * The page header's Export (Phase 19 X-30, 19-UI-SPEC §1): an outline pill with a 16px Download icon, named
 * `Export {page heading}`, never disabled, so the dialog can always explain an empty list or one over the limit. The
 * dialog's code loads in its own chunk on first activation, so the page's first load gains only this button; if the
 * code has not arrived within 300ms, the button shows the inline spinner until the dialog opens. If the code can't load,
 * S1's failed-file copy says so in a danger toast with `Try again`, and the page stays as it was (FE4-12).
 *
 * Rendering it is presentation, never authorisation: the page shows it only for a session granted the export, and the
 * server refuses every export the viewer may not make (D-16).
 */

type ExportDialogComponent = ComponentType<ExportDialogProps>;

/*
 * The dialog's code, loaded once. FE4-12: a failed load (a flaky network, or a deploy that replaced the chunks the page
 * knew) is not kept, so `Try again` loads the code afresh. next/dynamic's React.lazy kept the failure and threw it to the
 * route's error boundary, which replaced the whole page.
 */
let dialogCode: Promise<ExportDialogComponent> | null = null;
function loadExportDialog(): Promise<ExportDialogComponent> {
  dialogCode ??= import('./export-dialog').then((module) => module.default, (error: unknown) => {
    dialogCode = null;
    throw error;
  });
  return dialogCode;
}

/** How long the dialog's code may take before the button shows its spinner (§2.1). */
const SPINNER_DELAY_MS = 300;

/** An active filter as its chip names it: `{label}: {value}`. */
export type ExportFilterChip = { readonly label: string; readonly value: string };

/** One table of a fixed-table view (a report or a released assessment), named by its heading on the page. */
export type ExportFixedTable = { readonly key: string; readonly heading: string };

export type ExportButtonProps = {
  /** The page heading; the button reads `Export {heading}` and so does the dialog's title. */
  heading: string;
  /** The export vocabulary's view key (export-vocabulary.json). */
  view: string;
  /** The view's Server Action. */
  action: (input: unknown) => Promise<ExportActionResult>;
  /** The page's parsed query without its page and page size; the action parses it again. */
  query: Readonly<Record<string, unknown>>;
  /** The list's total from the page's own read. */
  total: number;
  searchActive: boolean;
  search?: string;
  chips: readonly ExportFilterChip[];
  multiplePages: boolean;
  /** The column keys the page shows; the view's visible columns when absent. */
  visibleColumns?: readonly string[];
  /** A line under the Columns legend: a reference list's import rule (§2.4, D-33). */
  columnsHint?: string;
  /** A fixed-table view's tables: no column choice, and a Table choice for CSV. */
  fixedTables?: readonly ExportFixedTable[];
  /** A fixed-table view's scope sentence (§2.2), worded by the page from its own read, in place of the list's. */
  scope?: string;
};

export function ExportButton(props: ExportButtonProps) {
  const button = useRef<HTMLButtonElement>(null);
  const [Dialog, setDialog] = useState<ExportDialogComponent | null>(null);
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [slow, setSlow] = useState(false);
  const markReady = useCallback(() => setReady(true), []);

  useEffect(() => {
    if (!open || ready) return undefined;
    const timer = window.setTimeout(() => setSlow(true), SPINNER_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [open, ready]);

  function openExport() {
    setOpen(true);
    if (Dialog) return;
    loadExportDialog().then((component) => setDialog(() => component), () => {
      setOpen(false);
      button.current?.focus();
      toast.error(EXPORT_FAILED.message, { duration: Infinity, action: toastAction('Try again', openExport) });
    });
  }

  const loading = open && !ready && slow;
  return (
    <>
      <Button
        aria-haspopup="dialog"
        aria-label={`Export ${props.heading}`}
        onClick={openExport}
        ref={button}
        type="button"
        variant="outline"
      >
        {loading ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Download aria-hidden="true" className="size-4" />}
        Export
      </Button>
      {Dialog ? (
        <Dialog
          {...props}
          onOpenChange={setOpen}
          onReady={markReady}
          open={open}
          returnFocusTo={button}
        />
      ) : null}
    </>
  );
}
