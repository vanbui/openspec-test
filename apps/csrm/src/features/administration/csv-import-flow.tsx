'use client';

import { AlertCircle, Check, CircleAlert, Download, FileCheck2, FileWarning, Info, Loader2, TriangleAlert, Upload } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useId, useMemo, useRef, useState, type DragEvent, type RefObject } from 'react';
import { toast } from 'sonner';

import { HorizontalScrollRegion } from '@/components/csrm/horizontal-scroll-region';
import { PageHeader } from '@/components/csrm/page-header';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Progress } from '@/components/ui/progress';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { successToast } from '@/components/ui/success-toast';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toastAction } from '@/components/ui/toast-action';
import { formatFileSize } from '@/lib/files/format-file-size';
import { saveFile } from '@/lib/files/save-file';

import { getAdministrationConfig, type AdministrationKind } from './administration-config';
import { checkImportFileInBrowser, IMPORT_FILE_EXTENSIONS } from './csv-client-parser';
import type { CsvImportPreviewData, CsvImportPreviewRow, CsvImportResultData, CsvRowState } from './csv-import-schema';
import { importFileRefusal, type ImportFileRefusalCopy, type ImportStepRefusalCopy, type ImportStepRefusalKind } from './import-refusal-copy';
import { ImportRowBadge, importRowLabel } from './import-row-status';
import {
  bulkDecision,
  bulkToast,
  confirmSummary,
  decidedCount,
  decisionOptions,
  decisionProgress,
  decisionsField,
  ERROR_REPORT_LINE,
  gateLine,
  guidanceColumns,
  guidanceSentence,
  ignoredColumnsBody,
  IMPORT_FILE_HINT,
  keyLabel,
  newFileGuard,
  noteLine,
  reportOfferedAtResults,
  reportOfferedAtReview,
  reportToastBody,
  RESULT_TILES,
  similarDetails,
  similarPanelBody,
  similarPanelTitle,
  similarRowNumbers,
  SKIPPED_BY_CHOICE,
  VALUE_RULES,
  writeCount,
  yourChoice,
  type ImportDecisions,
  type SimilarDecision,
} from './import-flow-rules';

/*
 * The five-step import (Phase 10; Phase 19 D-25 to D-32, 19-UI-SPEC §5). The browser checks only a file's extension and
 * size; Strapi reads the file, previews every row and writes nothing until the Security Analyst confirms. A file Strapi
 * can't read says how to fix it (S2); a row matched by similar name waits for the person's own choice (X-32); the rows
 * that weren't imported come back as Strapi's error report. Templates and error reports are Strapi's files, saved
 * through Phase 14's save helper. The flow's rules and sentence parts live in import-flow-rules.ts; every row badge
 * comes from the import-only row mapping (19-13), never the shared badge map.
 */

const steps = ['Guidance', 'Select file', 'Review rows', 'Confirm import', 'Results'] as const;
/** The six row states, in the order the tiles and the filter show them. */
const rowStates = ['create', 'update', 'unchanged', 'rejected', 'ambiguous', 'similar'] as const satisfies readonly CsvRowState[];
const rowStateLabel = (state: CsvRowState) => importRowLabel(state);
const ROWS_PER_PAGE = 100;

/** Direction §4 Toasts: an info or success toast closes after 5s. */
const SUCCESS_TOAST_DURATION_MS = 5_000;

/** What a template or error report download returns: the checked file, or S3's copy. */
type FileDownload =
  | { ok: true; fileName: string; contentType: string; bytes: Uint8Array; rowCount?: number }
  | { ok: false; refusal: ImportStepRefusalCopy };

/** A refused step or file, as the actions word it (administration-actions.ts `ImportRefusal`). */
type ActionRefusal =
  | ({ family: 'file' } & ImportFileRefusalCopy)
  | ({ family: 'step'; step: ImportStepRefusalKind } & ImportStepRefusalCopy);

export type CsvImportFlowProps = {
  kind: AdministrationKind;
  previewAction: (formData: FormData) => Promise<unknown>;
  commitAction: (formData: FormData) => Promise<unknown>;
  /** Downloads the collection's template: `{ kind, format }`. */
  templateAction: (input: unknown) => Promise<unknown>;
  /** Downloads Strapi's error report: the kind, the file and one token. */
  errorReportAction: (formData: FormData) => Promise<unknown>;
};

type TemplateFormat = 'xlsx' | 'csv';

function extractData<T>(value: unknown): T | null {
  if (typeof value !== 'object' || value === null) return null;
  if ('ok' in value) {
    const wrapped = value as { ok?: unknown; data?: unknown };
    return wrapped.ok === true && 'data' in wrapped ? wrapped.data as T : null;
  }
  if ('summary' in value && 'rows' in value) return value as T;
  return null;
}

function extractError(value: unknown): { message: string; unknownOutcome: boolean; refusal: ActionRefusal | null } | null {
  if (typeof value !== 'object' || value === null || !('ok' in value) || (value as { ok?: boolean }).ok) return null;
  const failure = value as { formError?: unknown; unknownOutcome?: unknown; refusal?: unknown };
  const refusal = typeof failure.refusal === 'object' && failure.refusal !== null && 'family' in failure.refusal ? failure.refusal as ActionRefusal : null;
  return {
    message: typeof failure.formError === 'string' ? failure.formError : 'We couldn’t import this file. Review the file and try again.',
    unknownOutcome: failure.unknownOutcome === true,
    refusal,
  };
}

/** A download's result, or null when the action answered something else. */
function downloaded(value: unknown): FileDownload | null {
  if (typeof value !== 'object' || value === null || !('ok' in value)) return null;
  const result = value as Partial<{ ok: boolean; fileName: unknown; contentType: unknown; bytes: unknown; rowCount: unknown; refusal: unknown }>;
  if (result.ok === true && typeof result.fileName === 'string' && typeof result.contentType === 'string' && result.bytes instanceof Uint8Array) {
    return { ok: true, fileName: result.fileName, contentType: result.contentType, bytes: result.bytes, ...(typeof result.rowCount === 'number' ? { rowCount: result.rowCount } : {}) };
  }
  if (result.ok === false && typeof result.refusal === 'object' && result.refusal !== null) return { ok: false, refusal: result.refusal as ImportStepRefusalCopy };
  return null;
}

/** The element a person sees: the first of several (the table's and the phone card's) that is laid out, else the first. */
function shownElement(elements: readonly HTMLElement[]): HTMLElement | undefined {
  return elements.find((element) => element.getClientRects().length > 0) ?? elements[0];
}

/**
 * The X-19 file field for one file (19-UI-SPEC §5.4): a labelled, visually hidden file input that `Choose file` opens, in
 * a dashed drop region whose drag line shows from 768px. Dragging is never required (2.5.7).
 */
function ImportFileField({ disabled, describedBy, onFile, inputRef }: {
  disabled: boolean;
  describedBy?: string;
  onFile: (file: File) => void;
  inputRef: RefObject<HTMLInputElement | null>;
}) {
  const inputId = useId();
  const hintId = `${inputId}-hint`;
  const labelId = `${inputId}-label`;
  const [dragging, setDragging] = useState(false);
  const carriesFiles = (event: DragEvent) => Array.from(event.dataTransfer?.types ?? []).includes('Files');
  const described = describedBy ? `${hintId} ${describedBy}` : hintId;
  return (
    // UI-12: the control a person reaches is `Choose file`, so the field is a group its label names (WCAG 1.3.1, 2.5.3).
    <div aria-labelledby={labelId} className="grid gap-2" role="group">
      <label className="text-sm font-medium text-foreground" htmlFor={inputId} id={labelId}>File to import</label>
      <div
        className={`flex flex-col items-center gap-2 rounded-lg border border-dashed border-border-strong bg-surface p-4 text-sm transition-colors duration-(--duration-micro) ease-standard md:flex-row md:justify-center md:p-6 ${dragging ? 'border-solid border-foreground bg-surface-hover' : ''}`}
        data-drag-active={dragging ? 'true' : 'false'}
        data-file-drop=""
        onDragLeave={(event) => { if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) setDragging(false); }}
        onDragOver={(event) => { if (!carriesFiles(event)) return; event.preventDefault(); if (!disabled) setDragging(true); }}
        onDrop={(event) => {
          if (!carriesFiles(event)) return;
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer?.files?.[0];
          if (!disabled && dropped) onFile(dropped);
        }}
      >
        <Upload aria-hidden="true" className="size-4 shrink-0 text-foreground-secondary" />
        <span className="hidden text-foreground md:inline">Drag a file here, or</span>
        <Button aria-describedby={described} className="max-md:min-h-11 max-md:w-full" disabled={disabled} onClick={() => inputRef.current?.click()} size="sm" type="button" variant="outline">
          Choose file
        </Button>
        <input
          accept={IMPORT_FILE_EXTENSIONS.join(',')}
          aria-describedby={described}
          className="sr-only"
          disabled={disabled}
          id={inputId}
          onChange={(event) => {
            const chosen = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            if (chosen) onFile(chosen);
          }}
          ref={inputRef}
          tabIndex={-1}
          type="file"
        />
      </div>
      <p className="text-xs text-foreground-secondary tabular-nums" id={hintId}>{IMPORT_FILE_HINT}</p>
    </div>
  );
}

/** An S2 refusal's body and numbered steps. */
function RefusalLines({ refusal }: { refusal: ImportFileRefusalCopy }) {
  return <>
    <p>{refusal.body}</p>
    {refusal.steps.length > 0 ? <ul className="mt-1 grid gap-1">{refusal.steps.map((line) => <li key={line}>{line}</li>)}</ul> : null}
  </>;
}

/**
 * A similar row's decision (X-32): a radio group named `Decision for row {n}` with nothing chosen, Update the existing
 * name or Skip the row, each with its hint. The radio stays aligned with the label's first line as a long name wraps.
 */
function DecisionGroup({ row, decision, onDecide, place, gateId }: {
  row: CsvImportPreviewRow;
  decision: SimilarDecision | undefined;
  onDecide: (rowNumber: number, decision: SimilarDecision) => void;
  place: 'table' | 'card';
  /** The gate line's id while it is shown, so an undecided group says why focus landed on it (UI-03, WCAG 3.3.1). */
  gateId?: string | undefined;
}) {
  const existing = row.matchedName ?? row.naturalKey ?? '';
  const base = `decision-${place}-${row.rowNumber}`;
  return (
    <RadioGroup
      aria-describedby={decision ? undefined : gateId}
      aria-label={`Decision for row ${row.rowNumber}`}
      className="mt-4 grid gap-2"
      data-decision-row={row.rowNumber}
      onValueChange={(value) => onDecide(row.rowNumber, value as SimilarDecision)}
      value={decision ?? ''}
    >
      {decisionOptions(existing).map((option) => (
        <div className="flex items-start gap-2" key={option.value}>
          <RadioGroupItem aria-describedby={`${base}-${option.value}-hint`} aria-labelledby={`${base}-${option.value}-label`} className="mt-0.5" id={`${base}-${option.value}`} value={option.value} />
          <div className="grid min-w-0 gap-0.5">
            <label className="min-w-0 break-words text-sm text-foreground max-md:flex max-md:min-h-11 max-md:items-center" htmlFor={`${base}-${option.value}`} id={`${base}-${option.value}-label`}>{option.label}</label>
            <p className="text-xs text-foreground-secondary" id={`${base}-${option.value}-hint`}>{option.hint}</p>
          </div>
        </div>
      ))}
    </RadioGroup>
  );
}

/**
 * A Review summary tile (19-UI-SPEC §5.5, §9 G-4; X-10 within the page): a figure above zero selects its state's rows and
 * is named by the figure, then the state; a zero figure is plain text.
 */
function SummaryTile({ count, label, onSelect, selected }: { count: number; label: string; onSelect: () => void; selected: boolean }) {
  const id = useId();
  return (
    <Card>
      <CardContent className="pt-4">
        <p className="text-sm text-muted-foreground" id={`${id}-label`}>{label}</p>
        {count > 0
          ? <Button aria-labelledby={`${id}-figure ${id}-label`} aria-pressed={selected} className="h-auto p-0 text-heading-md tabular-nums" id={`${id}-figure`} onClick={onSelect} type="button" variant="link">{count}</Button>
          : <p className="text-heading-md tabular-nums">{count}</p>}
      </CardContent>
    </Card>
  );
}

export function CsvImportFlow({ kind, previewAction, commitAction, templateAction, errorReportAction }: CsvImportFlowProps) {
  const config = getAdministrationConfig(kind);
  // The column that matches a row to an existing record, named as people know it (D-38, UI-SPEC §17.1).
  const keyColumn = keyLabel(kind);
  const columnsLabel = `${config.label} columns in the file`;
  const rulesHeadingId = useId();
  const gateId = useId();
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [browserRefusal, setBrowserRefusal] = useState<ImportFileRefusalCopy | null>(null);
  const [serverRefusal, setServerRefusal] = useState<ImportFileRefusalCopy | null>(null);
  const [preview, setPreview] = useState<CsvImportPreviewData | null>(null);
  const [result, setResult] = useState<CsvImportResultData | null>(null);
  const [decisions, setDecisions] = useState<ImportDecisions>({});
  const [gateShown, setGateShown] = useState(false);
  const [focusRow, setFocusRow] = useState<number | null>(null);
  const [guardOpen, setGuardOpen] = useState(false);
  const [filter, setFilter] = useState<'all' | CsvRowState>('all');
  const [rowPage, setRowPage] = useState(1);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<ImportStepRefusalCopy | null>(null);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const [templatePending, setTemplatePending] = useState<TemplateFormat | null>(null);
  const [templateRefusal, setTemplateRefusal] = useState<{ format: TemplateFormat; refusal: ImportStepRefusalCopy } | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [reportRefusal, setReportRefusal] = useState<ImportStepRefusalCopy | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const refusalTitleRef = useRef<HTMLDivElement>(null);
  const flowRef = useRef<HTMLDivElement>(null);
  const templateButtonRefs = useRef<Partial<Record<TemplateFormat, HTMLButtonElement | null>>>({});
  const reportButtonRef = useRef<HTMLButtonElement>(null);
  /** The download a `Try again` retried, whose button takes focus once it is enabled again (FE4-04). */
  const retriedRef = useRef<TemplateFormat | 'report' | null>(null);
  /** The review on screen, and the bulk choice's Undo toast, so an Undo restores only onto its own review (FE4-08). */
  const previewDigestRef = useRef<string | null>(null);
  const bulkToastRef = useRef<string | null>(null);

  // Focus follows a step change only. Focusing the heading on first render would
  // carry keyboard users past the page header and navigation they have not read.
  const focusedStepRef = useRef(step);
  useEffect(() => {
    if (focusedStepRef.current === step) return;
    focusedStepRef.current = step;
    headingRef.current?.focus();
  }, [step]);
  // §5.4: a refused file's alert takes focus at its title.
  useEffect(() => {
    if (serverRefusal) refusalTitleRef.current?.focus();
  }, [serverRefusal]);
  /*
   * FE4-04 (WCAG 2.4.3): a refusal's `Try again` removes itself, so focus moves to the template or error report button
   * it retried once that download ends, never to the page body.
   */
  useEffect(() => {
    const retried = retriedRef.current;
    if (retried === null || templatePending !== null || reportPending) return;
    retriedRef.current = null;
    (retried === 'report' ? reportButtonRef.current : templateButtonRefs.current[retried])?.focus();
  }, [templatePending, reportPending, templateRefusal, reportRefusal]);
  useEffect(() => {
    previewDigestRef.current = preview?.previewDigest ?? null;
  }, [preview]);
  // §5.6: the gate moves focus to the first undecided row's radio group, once it is on screen.
  useEffect(() => {
    if (focusRow === null) return;
    const groups = Array.from(flowRef.current?.querySelectorAll<HTMLElement>(`[data-decision-row="${focusRow}"]`) ?? []);
    shownElement(groups)?.querySelector<HTMLElement>('[role="radio"]')?.focus();
    setFocusRow(null);
  }, [focusRow]);

  const similar = useMemo(() => similarRowNumbers(preview?.rows ?? []), [preview]);
  const progress = decisionProgress(similar, decisions);
  const rows = useMemo(() => preview?.rows.filter((row) => filter === 'all' || row.state === filter) ?? [], [filter, preview]);
  const resultRows = result?.rows ?? [];
  const displayedRows = rows.slice((rowPage - 1) * ROWS_PER_PAGE, rowPage * ROWS_PER_PAGE);
  const displayedResultRows = resultRows.slice((rowPage - 1) * ROWS_PER_PAGE, rowPage * ROWS_PER_PAGE);
  const rowPageCount = Math.max(1, Math.ceil((step === 5 ? resultRows.length : rows.length) / ROWS_PER_PAGE));
  const writes = preview ? writeCount(preview.summary, similar, decisions) : 0;
  // Nothing to write and no row waiting for a choice: the review can only end in a corrected file (§8, unchanged).
  const nothingToImport = Boolean(preview) && writes === 0 && similar.length === 0;

  function move(next: number) {
    setError(null); setNotice(null); setGuardOpen(false); setStep(next);
  }

  function startOver() {
    setPreview(null); setResult(null); setDecisions({}); setGateShown(false); setReviewed(false); setReportRefusal(null);
    // A new review takes none of the last one's choices, so its Undo goes with it (FE4-08).
    if (bulkToastRef.current !== null) toast.dismiss(bulkToastRef.current);
    bulkToastRef.current = null;
  }

  async function downloadTemplate(format: TemplateFormat) {
    if (templatePending !== null) return;
    setTemplatePending(format); setTemplateRefusal(null);
    try {
      const outcome = downloaded(await templateAction({ kind, format }));
      if (!outcome || !outcome.ok) {
        setTemplateRefusal({ format, refusal: outcome && !outcome.ok ? outcome.refusal : { message: 'We couldn’t download the template.', action: 'Try again' } });
        return;
      }
      saveFile({ fileName: outcome.fileName, contentType: outcome.contentType, bytes: outcome.bytes });
      toast.success(`Downloaded ${outcome.fileName}`, { duration: SUCCESS_TOAST_DURATION_MS });
    } catch {
      setTemplateRefusal({ format, refusal: { message: 'We couldn’t download the template.', action: 'Try again' } });
    } finally { setTemplatePending(null); }
  }

  async function downloadErrorReport() {
    if (reportPending || !file || !(preview || result)) return;
    setReportPending(true); setReportRefusal(null);
    try {
      const form = new FormData();
      form.set('kind', kind); form.set('file', file);
      // At Results the commit's result record; at Review the preview's (D-32).
      if (step === 5 && result) form.set('resultToken', result.resultToken);
      else if (preview) form.set('previewDigest', preview.previewDigest);
      const outcome = downloaded(await errorReportAction(form));
      if (!outcome || !outcome.ok) {
        setReportRefusal(outcome && !outcome.ok ? outcome.refusal : { message: 'We couldn’t prepare the error report.', action: 'Try again' });
        return;
      }
      saveFile({ fileName: outcome.fileName, contentType: outcome.contentType, bytes: outcome.bytes });
      toast.success(`Downloaded ${outcome.fileName}`, { description: reportToastBody(outcome.rowCount ?? 0), duration: SUCCESS_TOAST_DURATION_MS });
    } catch {
      setReportRefusal({ message: 'We couldn’t prepare the error report.', action: 'Try again' });
    } finally { setReportPending(false); }
  }

  function retryTemplate(format: TemplateFormat) {
    retriedRef.current = format;
    void downloadTemplate(format);
  }

  function retryErrorReport() {
    retriedRef.current = 'report';
    void downloadErrorReport();
  }

  function chooseFile(next: File) {
    setFile(next); setError(null); setBrowserRefusal(null); setServerRefusal(null);
  }

  /** S3's `Choose file again`: a new review of the file, from the Select file step. */
  function chooseFileAgain() {
    startOver(); move(2);
  }

  async function validateAndPreview() {
    if (!file) { setError('Choose one file to check.'); return; }
    const checked = checkImportFileInBrowser(file);
    if (!checked.ok) {
      setBrowserRefusal(importFileRefusal({ reason: checked.reason, fileName: file.name, fileSize: formatFileSize(file.size) }));
      return;
    }
    setBusy(true); setError(null); setBrowserRefusal(null); setServerRefusal(null);
    try {
      const form = new FormData(); form.set('kind', kind); form.set('file', file);
      const response = await previewAction(form);
      const previewed = extractData<CsvImportPreviewData>(response);
      if (!previewed) {
        const failure = extractError(response);
        if (failure?.refusal?.family === 'file') { setServerRefusal(failure.refusal); return; }
        throw new Error(failure?.message ?? 'The preview couldn’t be loaded. Choose the file again to retry.');
      }
      // A new file starts a new review: no choice carries over (§5.6).
      startOver(); setPreview(previewed); setFilter('all'); setRowPage(1); move(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We couldn’t check this file. Choose a different file.');
    } finally { setBusy(false); }
  }

  function decide(rowNumber: number, decision: SimilarDecision) {
    setDecisions((current) => ({ ...current, [rowNumber]: decision }));
  }

  function decideAll(decision: SimilarDecision) {
    const previous = decisions;
    const review = preview?.previewDigest ?? null;
    const { next, replaced } = bulkDecision(similar, previous, decision);
    setDecisions(next);
    // X-14: Undo only when the bulk choice replaced a different individual choice, and only onto the same review (FE4-08).
    const undo = () => {
      if (previewDigestRef.current === review) setDecisions(previous);
    };
    if (replaced) bulkToastRef.current = successToast(bulkToast(similar.length, decision), { action: toastAction('Undo', undo) });
  }

  /** The state filter, from its button or a summary figure (§5.5): the list starts again at its first page. */
  function selectState(state: 'all' | CsvRowState) {
    setFilter(state); setRowPage(1);
  }

  function showSimilarRows() {
    selectState('similar');
  }

  function continueToConfirmation() {
    if (progress.firstUndecided !== null) {
      // The gate (§5.6): the button stays enabled, says how many rows wait, and takes the person to the first of them.
      const index = similar.indexOf(progress.firstUndecided);
      setGateShown(true); setFilter('similar'); setRowPage(Math.floor(index / ROWS_PER_PAGE) + 1); setFocusRow(progress.firstUndecided);
      return;
    }
    setGateShown(false); move(4);
  }

  function backToFileSelection() {
    if (progress.decided > 0) { setGuardOpen(true); return; }
    move(2);
  }

  /** A commit that was sent but whose result can't be read: it may have written rows, so the person checks the list. */
  function showUnknownOutcome() {
    setUnknownOutcome(true);
    setError('We couldn’t confirm whether the import completed. Check the collection before trying again.');
  }

  async function confirmImport() {
    // The reviewed file is kept from Select file to Results, so without it there is nothing to send (FE4-11).
    if (!file || !preview || !reviewed || progress.undecided > 0) return;
    setBusy(true); setError(null); setNotice(null); setUnknownOutcome(false);
    try {
      const form = new FormData();
      form.set('kind', kind); form.set('file', file); form.set('previewDigest', preview.previewDigest); form.set('confirmed', 'true');
      if (similar.length > 0) form.set('decisions', decisionsField(similar, decisions));
      const response = await commitAction(form);
      const failure = extractError(response);
      if (failure) {
        const refusal = failure.refusal;
        if (refusal?.family === 'step' && refusal.step === 'decision-missing') {
          move(3); setFilter('similar'); setRowPage(1); setNotice(refusal); return;
        }
        if (refusal?.family === 'step') { setNotice(refusal); return; }
        if (refusal?.family === 'file') { startOver(); move(2); setServerRefusal(refusal); return; }
        setError(failure.message); setUnknownOutcome(failure.unknownOutcome); return;
      }
      const imported = extractData<CsvImportResultData>(response);
      if (!imported) { showUnknownOutcome(); return; }
      setResult(imported); setRowPage(1); setReportRefusal(null); move(5);
      toast.success(`Import complete: ${imported.summary.create} created, ${imported.summary.update} updated, ${imported.summary.rejected} rejected`);
    } catch {
      showUnknownOutcome();
    } finally { setBusy(false); }
  }

  const currentLabel = steps[step - 1];
  const panelTitle = step === 5 && result
    ? (result.summary.rejected + result.summary.ambiguous > 0 ? 'Import completed with rejected rows' : 'Import complete')
    : currentLabel;
  const templateButton = (format: TemplateFormat, label: string) => (
    // UI-01 (§2.6, WCAG 2.4.3): a pending download keeps its focus, read-only by aria-disabled; the handler ignores a press.
    <Button aria-disabled={templatePending !== null || undefined} onClick={() => void downloadTemplate(format)} ref={(button) => { templateButtonRefs.current[format] = button; }} type="button" variant="outline">
      {templatePending === format ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Download aria-hidden="true" className="size-4" />}
      {templatePending === format ? 'Downloading…' : label}
    </Button>
  );
  const errorReport = (
    <div className="grid gap-2">
      <div>
        <Button aria-disabled={reportPending || undefined} onClick={() => void downloadErrorReport()} ref={reportButtonRef} type="button" variant="outline">
          {reportPending ? <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" /> : <Download aria-hidden="true" className="size-4" />}
          {reportPending ? 'Preparing error report…' : 'Download error report'}
        </Button>
      </div>
      <p className="text-xs text-foreground-secondary">{ERROR_REPORT_LINE}</p>
      {reportRefusal ? <div className="flex flex-wrap items-center gap-3 text-sm text-destructive" role="alert"><span className="flex items-center gap-2"><CircleAlert aria-hidden="true" className="size-4" />{reportRefusal.message}</span>{reportRefusal.action ? <Button onClick={() => (reportRefusal.action === 'Choose file again' ? chooseFileAgain() : retryErrorReport())} size="sm" type="button" variant="outline">{reportRefusal.action}</Button> : null}</div> : null}
    </div>
  );
  /** A row's state cell: its badge, then the person's choice once a similar row is decided. */
  const stateCell = (row: CsvImportPreviewRow) => {
    const decision = decisions[row.rowNumber];
    return <div className="grid gap-1"><ImportRowBadge state={row.state} />{row.state === 'similar' && decision ? <span className="text-xs text-foreground-secondary">{yourChoice(decision)}</span> : null}</div>;
  };
  const rowDetails = (row: CsvImportPreviewRow, place: 'table' | 'card') => {
    if (row.state === 'similar') {
      return <><span className="block">{similarDetails(kind, row.matchedName ?? row.naturalKey ?? '')}</span><DecisionGroup decision={decisions[row.rowNumber]} gateId={gateShown && progress.undecided > 0 ? gateId : undefined} onDecide={decide} place={place} row={row} /></>;
    }
    if (row.changes.length) {
      return place === 'card' ? `${row.changes.length} changes` : row.changes.map((change) => <span className="block" key={change.field}>{change.field}: {String(change.before ?? 'Not provided')} → {String(change.after ?? 'Not provided')}</span>);
    }
    if (row.issues.length) {
      return place === 'card' ? row.issues.map((issue) => issue.message).join(' ') : row.issues.map((issue) => <span className="block" key={`${issue.code}-${issue.message}`}>{issue.field ? `${issue.field}: ` : ''}{issue.message}</span>);
    }
    return row.state === 'create' ? 'No existing match found.' : 'No changes.';
  };
  const resultDetails = (row: CsvImportResultData['rows'][number]) => {
    if (row.documentId) return <Link className="underline" href={config.detailPath(row.documentId)}>View record</Link>;
    if (row.state === 'similar' && row.decision === 'skip') return SKIPPED_BY_CHOICE;
    return row.issues.map((issue) => issue.message).join(' ') || 'Skipped without changes.';
  };

  return <div className="grid gap-6" ref={flowRef}>
    <PageHeader title={`Import ${config.pluralLabel}`} description="Import a CSV or Excel file. You review every row before anything is created or updated." />
    <p className="sr-only" role="status" aria-live="polite">Step {step} of 5: {currentLabel}</p>
    <ol aria-label="Import progress" className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {steps.map((label, index) => {
        const number = index + 1; const complete = number < step; const current = number === step;
        return <li key={label} aria-current={current ? 'step' : undefined} className={`rounded-lg border p-3 text-sm ${current ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}>
          <span className="flex items-center gap-2">{complete ? <Check aria-hidden="true" className="size-4" /> : <span aria-hidden="true">{number}</span>}<span>{label}</span></span>
          <span className="sr-only">{current ? 'Current step' : complete ? 'Complete' : 'Not started'}</span>
        </li>;
      })}
    </ol>
    {error && step !== 2 ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{unknownOutcome ? 'Import outcome unknown' : 'Import needs attention'}</AlertTitle><AlertDescription>{error}</AlertDescription>{unknownOutcome ? <Button asChild className="mt-3" variant="outline"><Link href={config.listPath}>View {config.pluralLabel}</Link></Button> : null}</Alert> : null}
    {notice ? <Alert variant="warning"><TriangleAlert aria-hidden="true" /><AlertDescription>{notice.message}</AlertDescription>{notice.action ? <Button className="mt-3 w-fit" onClick={chooseFileAgain} size="sm" type="button" variant="outline">{notice.action}</Button> : null}</Alert> : null}
    <Card>
      <CardHeader>
        <h2 className="text-heading-lg font-display" ref={headingRef} tabIndex={-1}>
          {panelTitle}
        </h2>
      </CardHeader>
      <CardContent className="grid gap-6">
        {step === 1 ? <>
          <p className="text-sm text-muted-foreground">{guidanceSentence(kind)}</p>
          <HorizontalScrollRegion className="overflow-x-auto rounded-lg border" label={columnsLabel}><Table aria-label={columnsLabel}><TableHeader><TableRow><TableHead>Column</TableHead><TableHead>Also accepted as</TableHead><TableHead>Required</TableHead><TableHead>Format and allowed values</TableHead></TableRow></TableHeader><TableBody>{guidanceColumns(kind).map((column) => <TableRow key={column.field}><TableCell>{column.label}</TableCell><TableCell>{column.field}</TableCell><TableCell>{column.required}</TableCell><TableCell className="whitespace-normal">{column.format}</TableCell></TableRow>)}</TableBody></Table></HorizontalScrollRegion>
          <div className="grid gap-2">
            <h3 className="text-sm font-medium text-foreground" id={rulesHeadingId}>How values are read</h3>
            <ul aria-labelledby={rulesHeadingId} className="grid list-disc gap-1 pl-5 text-sm text-foreground">{VALUE_RULES.map((rule) => <li key={rule}>{rule}</li>)}</ul>
          </div>
          {templateRefusal ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertDescription>{templateRefusal.refusal.message}</AlertDescription>{templateRefusal.refusal.action ? <Button className="mt-3 w-fit" onClick={() => retryTemplate(templateRefusal.format)} size="sm" type="button" variant="outline">{templateRefusal.refusal.action}</Button> : null}</Alert> : null}
          <div className="flex flex-wrap gap-3"><Button onClick={() => move(2)}>Choose file</Button>{templateButton('xlsx', 'Download Excel template')}{templateButton('csv', 'Download CSV template')}<Button asChild variant="outline"><Link href={config.listPath}>Return to {config.pluralLabel}</Link></Button></div>
        </> : null}
        {step === 2 ? <>
          {/* Accessibility contract 4.1.3 (FE4-03): focus moves to the refusal's title, so the alert is no live region too. */}
          {serverRefusal ? <Alert role={undefined} variant="warning"><FileWarning aria-hidden="true" /><AlertTitle className="outline-none" ref={refusalTitleRef} tabIndex={-1}>{serverRefusal.title}</AlertTitle><AlertDescription><RefusalLines refusal={serverRefusal} /></AlertDescription><Button className="mt-3 w-fit" onClick={() => inputRef.current?.click()} size="sm" type="button" variant="outline">Choose another file</Button></Alert> : null}
          <ImportFileField describedBy={browserRefusal ? 'import-file-refusal' : error ? 'csv-file-error' : undefined} disabled={busy} inputRef={inputRef} onFile={chooseFile} />
          {browserRefusal ? <div className="grid gap-1 text-sm text-destructive" id="import-file-refusal" role="alert"><p className="flex items-center gap-2 font-medium"><AlertCircle aria-hidden="true" className="size-4" />{browserRefusal.title}</p><RefusalLines refusal={browserRefusal} /></div> : null}
          {/* UI-11: a validation line carries an icon and words, and is announced (WCAG 1.4.1, 4.1.3). */}
          {error ? <p className="flex items-center gap-2 text-sm text-destructive" id="csv-file-error" role="alert"><AlertCircle aria-hidden="true" className="size-4 shrink-0" />{error}</p> : null}
          {file ? <p className="text-sm tabular-nums">{file.name} · {formatFileSize(file.size)}</p> : null}
          {busy ? <div className="grid gap-2"><Progress aria-label="Checking file" /><p className="text-sm" role="status">Checking file…</p></div> : null}
          <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={validateAndPreview}>{busy ? 'Checking file…' : 'Validate and preview'}</Button><Button variant="outline" onClick={() => move(1)}>Back to guidance</Button></div>
        </> : null}
        {step === 3 && preview ? <>
          {preview.warnings.length > 0 ? <Alert variant="warning"><TriangleAlert aria-hidden="true" /><AlertTitle>Some columns will be ignored</AlertTitle><AlertDescription>{ignoredColumnsBody(kind, preview.warnings)}</AlertDescription></Alert> : null}
          {preview.notes.length > 0 ? <ul className="grid gap-1">{preview.notes.map((note) => <li className="flex items-start gap-2 text-sm text-foreground-secondary" key={note}><Info aria-hidden="true" className="mt-0.5 size-4 shrink-0" /><span>{noteLine(kind, note, preview.readOnlyColumns)}</span></li>)}</ul> : null}
          {similar.length > 0 ? <div className="grid gap-2">
            {/* UI-02 (4.1.3): the panel stays on screen, so it is no alert; its count below is the polite live region. */}
            <Alert role={undefined} variant="warning">
              <TriangleAlert aria-hidden="true" />
              <AlertTitle>{similarPanelTitle(similar.length)}</AlertTitle>
              <AlertDescription>
                <p>{similarPanelBody(kind)}</p>
                <p aria-live="polite" className="tabular-nums">{decidedCount(progress.decided, progress.total)}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button onClick={() => decideAll('update')} size="sm" type="button" variant="outline">Update all {similar.length}</Button>
                  <Button onClick={() => decideAll('skip')} size="sm" type="button" variant="outline">Skip all {similar.length}</Button>
                  <Button onClick={showSimilarRows} size="sm" type="button" variant="ghost">Show these rows</Button>
                </div>
              </AlertDescription>
            </Alert>
            {gateShown && progress.undecided > 0 ? <p className="flex items-center gap-2 text-sm text-destructive" id={gateId}><CircleAlert aria-hidden="true" className="size-4" />{gateLine(progress.undecided)}</p> : null}
          </div> : null}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{rowStates.map((state) => <SummaryTile count={preview.summary[state]} key={state} label={rowStateLabel(state)} onSelect={() => selectState(state)} selected={filter === state} />)}</div>
          <div className="flex flex-wrap gap-2">{(['all', ...rowStates] as const).map((state) => { const label = state === 'all' ? 'All rows' : rowStateLabel(state); const count = state === 'all' ? preview.rows.length : preview.summary[state]; const active = filter === state; return <Button aria-pressed={active} className={active ? 'ring-2 ring-ring ring-offset-2' : undefined} key={state} size="sm" variant={active ? 'default' : 'outline'} onClick={() => selectState(state)}>{active ? <Check aria-hidden="true" /> : null}{label} ({count})</Button>; })}</div>
          <HorizontalScrollRegion className="hidden overflow-x-auto rounded-lg border md:grid" label={`${config.label} import preview`}><Table aria-label={`${config.label} import preview`}><TableHeader><TableRow><TableHead>File row</TableHead><TableHead>State</TableHead><TableHead>{keyColumn}</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{displayedRows.map((row) => <TableRow key={row.rowNumber} aria-label={`Row ${row.rowNumber} ${rowStateLabel(row.state)} ${row.naturalKey ?? ''}`}><TableCell className="align-top">{row.rowNumber}</TableCell><TableCell className="align-top">{stateCell(row)}</TableCell><TableCell className="align-top">{row.naturalKey ?? 'Not provided'}</TableCell><TableCell className="whitespace-normal align-top">{rowDetails(row, 'table')}</TableCell></TableRow>)}</TableBody></Table></HorizontalScrollRegion>
          <div className="grid gap-3 md:hidden" data-slot="csv-import-mobile">{displayedRows.map((row) => <article className="space-y-2 rounded-lg border border-border p-4" key={row.rowNumber} aria-label={`Row ${row.rowNumber} ${rowStateLabel(row.state)} ${row.naturalKey ?? ''}`}><div className="flex items-start justify-between gap-2"><span className="font-medium">File row {row.rowNumber}</span>{stateCell(row)}</div><p className="break-words">{row.naturalKey ?? 'Not provided'}</p><div className="text-sm text-muted-foreground">{rowDetails(row, 'card')}</div></article>)}</div>
          <div className="flex items-center gap-3"><Button disabled={rowPage <= 1} variant="outline" onClick={() => setRowPage((page) => page - 1)}>Previous rows</Button><output>Page {rowPage} of {rowPageCount}</output><Button disabled={rowPage >= rowPageCount} variant="outline" onClick={() => setRowPage((page) => page + 1)}>Next rows</Button></div>
          {reportOfferedAtReview(preview.summary) ? errorReport : null}
          {nothingToImport ? <Alert><AlertTitle>No rows are ready to import.</AlertTitle><AlertDescription>Correct the listed issues in your file, then choose the updated file.</AlertDescription></Alert> : null}
          {guardOpen ? <Alert variant="warning"><TriangleAlert aria-hidden="true" /><AlertDescription>{newFileGuard(progress.decided)}</AlertDescription><div className="mt-3 flex flex-wrap gap-2"><Button onClick={chooseFileAgain} size="sm" type="button" variant="outline">Choose another file</Button><Button onClick={() => setGuardOpen(false)} size="sm" type="button" variant="ghost">Keep reviewing</Button></div></Alert> : null}
          <div className="flex flex-wrap gap-3"><Button disabled={nothingToImport} onClick={continueToConfirmation}>Continue to confirmation</Button><Button variant="outline" onClick={backToFileSelection}>Back to file selection</Button></div>
        </> : null}
        {step === 4 && preview ? <>
          <p>{confirmSummary(kind, preview.summary, similar, decisions)}</p>
          <p className="text-sm text-muted-foreground">Imports never delete records. We check the file again before anything is written.</p>
          <label className="flex items-center gap-3"><Checkbox checked={reviewed} onCheckedChange={(checked) => setReviewed(checked === true)} />I have reviewed the rows to create and update.</label>
          {busy ? <div className="grid gap-2"><Progress aria-label="Importing file" /><p className="text-sm" role="status">Import in progress. Keep this page open.</p></div> : null}
          <div className="flex flex-wrap gap-3"><Button disabled={!reviewed || nothingToImport || progress.undecided > 0 || busy} onClick={confirmImport}>{busy ? 'Importing…' : 'Confirm import'}</Button><Button disabled={busy} variant="outline" onClick={() => move(3)}>Back to review rows</Button>{busy ? <Button disabled variant="outline">Cancel import</Button> : <Button asChild variant="outline"><Link href={config.listPath}>Cancel import</Link></Button>}</div>
        </> : null}
        {step === 5 && result ? <>
          <div><FileCheck2 aria-hidden="true" className="mb-2 size-8 text-primary" /><h3 className="sr-only">Result status</h3></div>
          <p className="sr-only" aria-live="polite">Import results are ready.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">{RESULT_TILES.map(([key, label]) => <p key={key} className="rounded-lg border p-3 font-medium tabular-nums">{label} {result.summary[key] ?? 0}</p>)}</div>
          {result.previewChanged > 0 ? <Alert><AlertTitle>The final check changed some results</AlertTitle><AlertDescription>The final check before import changed the result for {result.previewChanged} {result.previewChanged === 1 ? 'row' : 'rows'}. Review the details below.</AlertDescription></Alert> : null}
          <HorizontalScrollRegion className="hidden overflow-x-auto rounded-lg border md:grid" label={`${config.label} import results`}><Table aria-label={`${config.label} import results`}><TableHeader><TableRow><TableHead>File row</TableHead><TableHead>Final result</TableHead><TableHead>{keyColumn}</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{displayedResultRows.map((row) => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell><TableCell><ImportRowBadge state={row.state} /></TableCell><TableCell>{row.naturalKey ?? 'Not provided'}</TableCell><TableCell className="whitespace-normal">{resultDetails(row)}</TableCell></TableRow>)}</TableBody></Table></HorizontalScrollRegion>
          <div className="grid gap-3 md:hidden">{displayedResultRows.map((row) => <article className="space-y-2 rounded-lg border border-border p-4" key={row.rowNumber}><div className="flex items-center justify-between"><span className="font-medium">File row {row.rowNumber}</span><ImportRowBadge state={row.state} /></div><p className="break-words">{row.naturalKey ?? 'Not provided'}</p><p>{resultDetails(row)}</p></article>)}</div>
          <div className="flex items-center gap-3"><Button disabled={rowPage <= 1} variant="outline" onClick={() => setRowPage((page) => page - 1)}>Previous rows</Button><output>Page {rowPage} of {rowPageCount}</output><Button disabled={rowPage >= rowPageCount} variant="outline" onClick={() => setRowPage((page) => page + 1)}>Next rows</Button></div>
          {reportOfferedAtResults(result.summary) ? errorReport : null}
          <div className="flex flex-wrap gap-3"><Button asChild><Link href={config.listPath}>View {config.pluralLabel}</Link></Button><Button variant="outline" onClick={() => { setFile(null); startOver(); move(1); }}>Import another file</Button></div>
        </> : null}
      </CardContent>
    </Card>
  </div>;
}
