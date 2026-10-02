'use client';

import { AlertCircle, Check, FileCheck2 } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { HorizontalScrollRegion } from '@/components/csrm/horizontal-scroll-region';
import { PageHeader } from '@/components/csrm/page-header';
import { StatusBadge, statusLabel } from '@/components/csrm/status-badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { getAdministrationConfig, type AdministrationKind } from './administration-config';
import {
  createAdministrationCsvErrorReport,
  createAdministrationCsvResultReport,
  createAdministrationCsvTemplate,
  downloadAdministrationCsv,
  keyLabel,
  validateAdministrationCsvFile,
} from './csv-client-parser';
import {
  csvRowStates,
  type CsvImportPreviewData,
  type CsvImportResultData,
  type CsvRowState,
  getAdministrationCsvContract,
} from './csv-import-schema';

const steps = ['Guidance', 'Select file', 'Review rows', 'Confirm import', 'Results'] as const;
// A row state's label, tone and icon come from the shared status mapping (direction section 4, CSV import rows).
const rowStateLabel = (state: CsvRowState) => statusLabel('importRow', state);

export type CsvImportFlowProps = {
  kind: AdministrationKind;
  previewAction: (formData: FormData) => Promise<unknown>;
  commitAction: (formData: FormData) => Promise<unknown>;
};

function extractData<T>(value: unknown): T | null {
  if (typeof value !== 'object' || value === null) return null;
  if ('ok' in value) {
    const wrapped = value as { ok?: unknown; data?: unknown };
    return wrapped.ok === true && 'data' in wrapped ? wrapped.data as T : null;
  }
  if ('summary' in value && 'rows' in value) return value as T;
  return null;
}

function extractError(value: unknown): { message: string; unknownOutcome: boolean } | null {
  if (typeof value !== 'object' || value === null || !('ok' in value) || (value as { ok?: boolean }).ok) return null;
  const failure = value as { formError?: unknown; unknownOutcome?: unknown };
  return {
    message: typeof failure.formError === 'string' ? failure.formError : 'We couldn’t import this CSV. Review the file and try again.',
    unknownOutcome: failure.unknownOutcome === true,
  };
}

export function CsvImportFlow({ kind, previewAction, commitAction }: CsvImportFlowProps) {
  const config = getAdministrationConfig(kind);
  const csvContract = getAdministrationCsvContract(kind);
  // The column that matches a row to an existing record, named as people know it (D-38, UI-SPEC §17.1).
  const keyColumn = keyLabel(kind);
  const filePrefix = kind;
  const [step, setStep] = useState(1);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvImportPreviewData | null>(null);
  const [result, setResult] = useState<CsvImportResultData | null>(null);
  const [filter, setFilter] = useState<'all' | CsvRowState>('all');
  const [rowPage, setRowPage] = useState(1);
  const [reviewed, setReviewed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unknownOutcome, setUnknownOutcome] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus follows a step change only. Focusing the heading on first render would
  // carry keyboard users past the page header and navigation they have not read.
  const focusedStepRef = useRef(step);
  useEffect(() => {
    if (focusedStepRef.current === step) return;
    focusedStepRef.current = step;
    headingRef.current?.focus();
  }, [step]);
  const rows = useMemo(() => preview?.rows.filter((row) => filter === 'all' || row.state === filter) ?? [], [filter, preview]);
  const resultRows = result?.rows ?? [];
  const displayedRows = rows.slice((rowPage - 1) * 100, rowPage * 100);
  const displayedResultRows = resultRows.slice((rowPage - 1) * 100, rowPage * 100);
  const rowPageCount = Math.max(1, Math.ceil((step === 5 ? resultRows.length : rows.length) / 100));
  const eligible = (preview?.summary.create ?? 0) + (preview?.summary.update ?? 0);

  function move(next: number) {
    setError(null); setStep(next);
  }

  async function validateAndPreview() {
    if (!file) { setError('Choose one CSV file to validate.'); return; }
    setBusy(true); setError(null);
    try {
      await validateAdministrationCsvFile(kind, file);
      const form = new FormData(); form.set('kind', kind); form.set('file', file);
      const response = await previewAction(form);
      const previewed = extractData<CsvImportPreviewData>(response);
      if (!previewed) throw new Error(extractError(response)?.message ?? 'The preview couldn’t be loaded. Choose the file again to retry.');
      setPreview(previewed); setFilter('all'); setRowPage(1); move(3);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'We couldn’t validate this CSV. Choose a different file.');
    } finally { setBusy(false); }
  }

  async function confirmImport() {
    if (!preview || !reviewed || eligible === 0) return;
    setBusy(true); setError(null); setUnknownOutcome(false);
    try {
      if (!file) throw new Error('The selected CSV is unavailable.');
      const form = new FormData();
      form.set('kind', kind); form.set('file', file); form.set('previewDigest', preview.previewDigest); form.set('confirmed', 'true');
      const response = await commitAction(form);
      const failure = extractError(response);
      if (failure) {
        setError(failure.message); setUnknownOutcome(failure.unknownOutcome); return;
      }
      const imported = extractData<CsvImportResultData>(response);
      if (!imported) throw new Error(`The import result couldn’t be loaded. Check the ${config.pluralLabel} list before importing again.`);
      setResult(imported); setRowPage(1); move(5);
      toast.success(`Import complete: ${imported.summary.create} created, ${imported.summary.update} updated, ${imported.summary.rejected} rejected`);
    } catch {
      setUnknownOutcome(true);
      setError('We couldn’t confirm whether the import completed. Check the collection before trying again.');
    } finally { setBusy(false); }
  }

  const currentLabel = steps[step - 1];
  const panelTitle = step === 5 && result
    ? (result.summary.rejected + result.summary.ambiguous > 0 ? 'Import completed with rejected rows' : 'Import complete')
    : currentLabel;
  return <div className="grid gap-6">
    <PageHeader title={`Import ${config.pluralLabel} from CSV`} description="Review and validate every row before any records are created or updated." />
    <p className="sr-only" role="status" aria-live="polite">Step {step} of 5: {currentLabel}</p>
    <ol aria-label="Import progress" className="grid grid-cols-1 gap-2 sm:grid-cols-5">
      {steps.map((label, index) => {
        const number = index + 1; const complete = number < step; const current = number === step;
        return <li key={label} aria-current={current ? 'step' : undefined} className={`rounded-lg border p-3 text-sm ${current ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground'}`}>
          <span className="flex items-center gap-2">{complete ? <Check aria-hidden="true" className="size-4" /> : <span aria-hidden="true">{number}</span>}<span>{label}</span></span>
          <span className="sr-only">{current ? 'Current step' : complete ? 'Complete' : 'Future step'}</span>
        </li>;
      })}
    </ol>
    {error ? <Alert variant="destructive"><AlertCircle aria-hidden="true" /><AlertTitle>{unknownOutcome ? 'Import outcome unknown' : 'Import needs attention'}</AlertTitle><AlertDescription>{error}</AlertDescription>{unknownOutcome ? <Button asChild className="mt-3" variant="outline"><Link href={config.listPath}>View {config.pluralLabel}</Link></Button> : null}</Alert> : null}
    <Card>
      <CardHeader>
        <h2 className="text-heading-lg font-display" ref={headingRef} tabIndex={-1}>
          {panelTitle}
        </h2>
      </CardHeader>
      <CardContent className="grid gap-5">
        {step === 1 ? <>
          <p className="text-sm text-muted-foreground">{`A row whose ${keyColumn.toLocaleLowerCase('en-AU')} matches an existing ${config.label} updates it. Other valid rows create new ${config.pluralLabel}. Unchanged, rejected and ambiguous rows are never written.`}</p>
          <HorizontalScrollRegion className="overflow-x-auto rounded-lg border" label={`${config.label} CSV columns`}><Table aria-label={`${config.label} CSV columns`}><TableHeader><TableRow><TableHead>Column</TableHead><TableHead>Required</TableHead><TableHead>Format</TableHead></TableRow></TableHeader><TableBody>{csvContract.columns.map((column) => <TableRow key={column.field}><TableCell>{column.field}</TableCell><TableCell>{column.required ? 'Required' : 'Optional'}</TableCell><TableCell className="whitespace-normal">{column.type === 'enum' ? column.values?.join(', ') : column.type === 'boolean' ? 'true or false' : `Text, up to ${column.maxLength.toLocaleString('en-AU')} characters`}</TableCell></TableRow>)}</TableBody></Table></HorizontalScrollRegion>
          <div className="flex flex-wrap gap-3"><Button onClick={() => move(2)}>Choose CSV file</Button><Button variant="outline" onClick={() => downloadAdministrationCsv(createAdministrationCsvTemplate(kind), `${filePrefix}-template.csv`)}>Download CSV template</Button><Button asChild variant="outline"><Link href={config.listPath}>Return to {config.pluralLabel}</Link></Button></div>
        </> : null}
        {step === 2 ? <>
          <p id="csv-help" className="text-sm text-muted-foreground">Choose one UTF-8 .csv file no larger than 5 MiB and 5,000 data rows.</p>
          <Input ref={inputRef} id="csv-file" aria-describedby={error ? 'csv-help csv-file-error' : 'csv-help'} aria-invalid={Boolean(error)} aria-label="CSV file" accept=".csv,text/csv" type="file" onChange={(event) => { setFile(event.target.files?.[0] ?? null); setError(null); }} />
          {error ? <p id="csv-file-error" className="text-sm text-destructive">{error}</p> : null}
          {file ? <p className="text-sm">Selected: {file.name} · {Math.ceil(file.size / 1024).toLocaleString('en-AU')} KiB</p> : null}
          {busy ? <div className="grid gap-2"><Progress aria-label="Validating CSV" /><p className="text-sm" role="status">Validating…</p></div> : null}
          <div className="flex flex-wrap gap-3"><Button disabled={busy} onClick={validateAndPreview}>{busy ? 'Validating…' : 'Validate and preview'}</Button><Button variant="outline" onClick={() => move(1)}>Back to guidance</Button></div>
        </> : null}
        {step === 3 && preview ? <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{csvRowStates.map((state) => <Card key={state}><CardContent className="pt-4"><p className="text-sm text-muted-foreground">{rowStateLabel(state)}</p><p className="text-2xl font-semibold tabular-nums">{preview.summary[state]}</p></CardContent></Card>)}</div>
          <div className="flex flex-wrap gap-2">{(['all', ...csvRowStates] as const).map((state) => { const label = state === 'all' ? 'All rows' : rowStateLabel(state); const count = state === 'all' ? preview.rows.length : preview.summary[state]; const active = filter === state; return <Button aria-pressed={active} className={active ? 'ring-2 ring-ring ring-offset-2' : undefined} key={state} size="sm" variant={active ? 'default' : 'outline'} onClick={() => { setFilter(state); setRowPage(1); }}>{active ? <Check aria-hidden="true" /> : null}{label} ({count})</Button>; })}</div>
          <HorizontalScrollRegion className="hidden overflow-x-auto rounded-lg border md:grid" label={`${config.label} import preview`}><Table aria-label={`${config.label} import preview`}><TableHeader><TableRow><TableHead>CSV row</TableHead><TableHead>State</TableHead><TableHead>{keyColumn}</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{displayedRows.map((row) => <TableRow key={row.rowNumber} aria-label={`Row ${row.rowNumber} ${rowStateLabel(row.state)} ${row.naturalKey ?? ''}`}><TableCell>{row.rowNumber}</TableCell><TableCell><StatusBadge family="importRow" value={row.state} /></TableCell><TableCell>{row.naturalKey ?? 'Not provided'}</TableCell><TableCell className="whitespace-normal">{row.changes.length ? row.changes.map((change) => <span className="block" key={change.field}>{change.field}: {String(change.before ?? 'Not provided')} → {String(change.after ?? 'Not provided')}</span>) : row.issues.length ? row.issues.map((issue) => <span className="block" key={`${issue.code}-${issue.message}`}>{issue.field ? `${issue.field}: ` : ''}{issue.message}</span>) : row.state === 'create' ? 'No existing match found.' : 'No changes.'}</TableCell></TableRow>)}</TableBody></Table></HorizontalScrollRegion>
          <div className="grid gap-3 md:hidden" data-slot="csv-import-mobile">{displayedRows.map((row) => <article className="space-y-2 rounded-lg border border-border p-4" key={row.rowNumber} aria-label={`Row ${row.rowNumber} ${rowStateLabel(row.state)} ${row.naturalKey ?? ''}`}><div className="flex items-center justify-between"><strong>CSV row {row.rowNumber}</strong><StatusBadge family="importRow" value={row.state} /></div><p className="break-words">{row.naturalKey ?? 'Not provided'}</p><p className="text-sm text-muted-foreground">{row.issues.map((issue) => issue.message).join(' ') || (row.changes.length ? `${row.changes.length} changes` : row.state === 'create' ? 'No existing match found.' : 'No changes.')}</p></article>)}</div>
          <div className="flex items-center gap-3"><Button disabled={rowPage <= 1} variant="outline" onClick={() => setRowPage((page) => page - 1)}>Previous rows</Button><output>Page {rowPage} of {rowPageCount}</output><Button disabled={rowPage >= rowPageCount} variant="outline" onClick={() => setRowPage((page) => page + 1)}>Next rows</Button></div>
          {(preview.summary.rejected + preview.summary.ambiguous) > 0 ? <Button variant="outline" onClick={() => downloadAdministrationCsv(createAdministrationCsvErrorReport(preview.rows), `${filePrefix}-errors.csv`)}>Download error report CSV</Button> : null}
          {eligible === 0 ? <Alert><AlertTitle>No rows are ready to import.</AlertTitle><AlertDescription>Correct the listed issues in your CSV, then choose the updated file.</AlertDescription></Alert> : null}
          <div className="flex flex-wrap gap-3"><Button disabled={eligible === 0} onClick={() => move(4)}>Continue to confirmation</Button><Button variant="outline" onClick={() => move(2)}>Back to file selection</Button></div>
        </> : null}
        {step === 4 && preview ? <>
          <p>This import will create <strong>{preview.summary.create}</strong> and update <strong>{preview.summary.update}</strong> {config.pluralLabel}. <strong>{preview.summary.rejected}</strong> rejected, <strong>{preview.summary.ambiguous}</strong> ambiguous, and <strong>{preview.summary.unchanged}</strong> unchanged rows will be skipped.</p>
          <p className="text-sm text-muted-foreground">Imports never delete records. We check the file again before anything is written.</p>
          <label className="flex items-center gap-3"><Checkbox checked={reviewed} onCheckedChange={(checked) => setReviewed(checked === true)} />I have reviewed the create and update rows.</label>
          {busy ? <div className="grid gap-2"><Progress aria-label="Importing CSV" /><p className="text-sm" role="status">Import in progress. Keep this page open.</p></div> : null}
          <div className="flex flex-wrap gap-3"><Button disabled={!reviewed || eligible === 0 || busy} onClick={confirmImport}>{busy ? 'Importing…' : 'Confirm import'}</Button><Button disabled={busy} variant="outline" onClick={() => move(3)}>Back to review rows</Button>{busy ? <Button disabled variant="outline">Cancel import</Button> : <Button asChild variant="outline"><Link href={config.listPath}>Cancel import</Link></Button>}</div>
        </> : null}
        {step === 5 && result ? <>
          <div><FileCheck2 aria-hidden="true" className="mb-2 size-8 text-primary" /><h3 className="sr-only">Result status</h3></div>
          <p className="sr-only" aria-live="polite">Import results are ready.</p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">{Object.entries(result.summary).map(([state, count]) => <p key={state} className="rounded-lg border p-3 font-medium tabular-nums">{state === 'create' ? 'Created' : state === 'update' ? 'Updated' : rowStateLabel(state as CsvRowState)} {count}</p>)}</div>
          {result.previewChanged > 0 ? <Alert><AlertTitle>The final check changed some results</AlertTitle><AlertDescription>The final check before import changed the result for {result.previewChanged} {result.previewChanged === 1 ? 'row' : 'rows'}. Review the details below.</AlertDescription></Alert> : null}
          <HorizontalScrollRegion className="hidden overflow-x-auto rounded-lg border md:grid" label={`${config.label} import results`}><Table aria-label={`${config.label} import results`}><TableHeader><TableRow><TableHead>CSV row</TableHead><TableHead>Final result</TableHead><TableHead>{keyColumn}</TableHead><TableHead>Details</TableHead></TableRow></TableHeader><TableBody>{displayedResultRows.map((row) => <TableRow key={row.rowNumber}><TableCell>{row.rowNumber}</TableCell><TableCell><StatusBadge family="importRow" value={row.state} /></TableCell><TableCell>{row.naturalKey ?? 'Not provided'}</TableCell><TableCell className="whitespace-normal">{row.documentId ? <Link className="underline" href={config.detailPath(row.documentId)}>View record</Link> : row.issues.map((issue) => issue.message).join(' ') || 'Skipped without changes.'}</TableCell></TableRow>)}</TableBody></Table></HorizontalScrollRegion>
          <div className="grid gap-3 md:hidden">{displayedResultRows.map((row) => <article className="space-y-2 rounded-lg border border-border p-4" key={row.rowNumber}><div className="flex items-center justify-between"><strong>CSV row {row.rowNumber}</strong><StatusBadge family="importRow" value={row.state} /></div><p className="break-words">{row.naturalKey ?? 'Not provided'}</p><p>{row.documentId ? <Link className="underline" href={config.detailPath(row.documentId)}>View record</Link> : row.issues.map((issue) => issue.message).join(' ') || 'Skipped without changes.'}</p></article>)}</div>
          <div className="flex items-center gap-3"><Button disabled={rowPage <= 1} variant="outline" onClick={() => setRowPage((page) => page - 1)}>Previous rows</Button><output>Page {rowPage} of {rowPageCount}</output><Button disabled={rowPage >= rowPageCount} variant="outline" onClick={() => setRowPage((page) => page + 1)}>Next rows</Button></div>
          <div className="flex flex-wrap gap-3"><Button asChild><Link href={config.listPath}>View {config.pluralLabel}</Link></Button><Button variant="outline" onClick={() => { setFile(null); setPreview(null); setResult(null); setReviewed(false); move(1); }}>Import another CSV</Button><Button variant="outline" onClick={() => downloadAdministrationCsv(createAdministrationCsvResultReport(result.rows), `${filePrefix}-results.csv`)}>Download result report CSV</Button></div>
        </> : null}
      </CardContent>
    </Card>
  </div>;
}
