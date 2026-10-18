'use client';

import { Archive, ArchiveRestore, CircleMinus, FilePenLine, History, Plus, RotateCcw, Sparkles, Undo2, type LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useId, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';

import { LocalInstant, useViewerTimeZone } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { RiskRatingBadge } from '@/components/csrm/risk-rating-badge';
import { SegmentedControl } from '@/components/csrm/segmented-control';
import { Button } from '@/components/ui/button';
import { formatInstant } from '@/lib/time/format-instant';
import { cn } from '@/lib/utils';

import { changedFieldsToggleLabel, compareFields, type ComparedRow } from '../ai-assistance/field-comparison-domain';
import { FieldComparison } from '../ai-assistance/field-comparison';
import { readRiskHistoryAction } from './risk-curation-actions';
import {
  fieldLabel,
  historyCountLine,
  historyEntryPresentation,
  honestStartLine,
  RISK_RATINGS,
  showsHonestStart,
  type HistoryEntryIcon,
  type RiskCurationFailure,
  type RiskHistoryEvent,
  type RiskHistoryFieldChange,
  type RiskHistoryPagination,
  type RiskHistoryValue,
  type RiskRating,
} from './risk-curation-domain';
import { riskCurationRefusal } from './risk-curation-refusal-copy';
import { HISTORY_LOAD_FAILED, RiskHistoryMessage, RiskHistorySkeleton, useSkeletonDelay, type RiskHistorySheetProps } from './risk-history-frame';

/*
 * A Risk's history (16-UI-SPEC §8; X-29; D-18 to D-21, UI-D21, UI-D23), the body of `RiskHistoryFrame`, loaded on demand
 * (D-48). It reads the first 25 changes when the sheet opens, newest first, and `Show older changes` reads the next 25
 * and moves focus to the first new entry. Each entry follows X-29, built from the questionnaire timeline's presentation:
 * an icon, its label, `{instant} by {name}`, its reason, source and control lines, and the changed fields as X-24's
 * read-only comparison under `Before` and `After`, with changed words marked in long text; a control taken off the Risk
 * lists the values it held then. An entry whose details cannot be read says so in one line. The list ends with the honest
 * start when recording began after the Risk was created. Strapi decides who may read it: a refusal reads §8.5's copy.
 */

const PAGE_SIZE = 25;

const ICONS: Readonly<Record<HistoryEntryIcon, LucideIcon>> = {
  Plus, Sparkles, FilePenLine, Undo2, Archive, ArchiveRestore, CircleMinus, History,
};

/* UI-SPEC §4.3: the long-text fields whose changed words are marked (statements, cause, impact, rationales, the plan). */
const LONG_TEXT_FIELDS = ['issueStatement', 'riskStatement', 'riskCause', 'potentialImpact', 'inherentRatingRationale', 'residualRatingRationale', 'treatmentPlan'];
const LONG_TEXT_LABELS: ReadonlySet<string> = new Set(LONG_TEXT_FIELDS.map(fieldLabel));
const RATING_LABELS: ReadonlySet<string> = new Set(['inherentRating', 'residualRating'].map(fieldLabel));

const NOT_RECORDED = 'Not recorded';

/** A recorded value as the editor shows it: text as typed, a relation by the label it had then, a flag as Yes or No. */
function valueText(value: RiskHistoryValue): string {
  if (value === null || value === '') return NOT_RECORDED;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return value.toLocaleString('en-AU');
  if (typeof value === 'string') return value;
  return value.label ?? NOT_RECORDED;
}

const comparisonRows = (changes: readonly RiskHistoryFieldChange[]): readonly ComparedRow[] =>
  compareFields(changes.map((change) => ({ label: fieldLabel(change.field), current: valueText(change.from), proposed: valueText(change.to) })));

const isRating = (value: string): value is RiskRating => (RISK_RATINGS as readonly string[]).includes(value);

/* Ratings render as their badges, as the editor shows them; every other value is the comparison's own. */
function ratingBadge(row: ComparedRow, side: 'current' | 'proposed'): ReactNode {
  const value = row[side];
  return RATING_LABELS.has(row.label) && isRating(value) ? <RiskRatingBadge rating={value} /> : null;
}

const marksWords = (row: ComparedRow): boolean => LONG_TEXT_LABELS.has(row.label);

/* §8.2 (X-29): the density, kept per person in this browser as the DataTable's is; from 768px only. */
type Density = 'comfortable' | 'compact';
const DENSITY_OPTIONS = [{ value: 'comfortable', label: 'Comfortable' }, { value: 'compact', label: 'Compact' }] as const;
const densityKey = (ownerKey: string) => `csrm:risk-history-density:${ownerKey}`;
const wideQuery = '(min-width: 768px)';
function subscribeToWidth(onChange: () => void): () => void {
  const query = window.matchMedia?.(wideQuery);
  query?.addEventListener('change', onChange);
  return () => query?.removeEventListener('change', onChange);
}
/* Without matchMedia (a test environment) the sheet is wide. */
function useIsWide(): boolean {
  return useSyncExternalStore(subscribeToWidth, () => window.matchMedia?.(wideQuery).matches ?? true, () => true);
}

function useDensity(ownerKey: string | null): [Density, (density: Density) => void] {
  const [density, setDensity] = useState<Density>(() => {
    if (!ownerKey) return 'comfortable';
    try {
      return window.localStorage.getItem(densityKey(ownerKey)) === 'compact' ? 'compact' : 'comfortable';
    } catch {
      return 'comfortable';
    }
  });
  function choose(next: Density) {
    setDensity(next);
    if (!ownerKey) return;
    try {
      window.localStorage.setItem(densityKey(ownerKey), next);
    } catch {
      /* Not kept; the choice still applies while the sheet is open. */
    }
  }
  return [density, choose];
}

function EntryComparison({ changes, density, label }: { changes: readonly RiskHistoryFieldChange[]; density: Density; label: string }) {
  const [shown, setShown] = useState(false);
  const id = useId();
  const comparison = <FieldComparison caption={`${label}: changed fields`} columns={{ before: 'Before', after: 'After' }} density={density} emphasis={marksWords} renderEmphasis={ratingBadge} rows={comparisonRows(changes)} />;
  if (density === 'comfortable') return comparison;
  return (
    <div className="grid gap-2">
      <Button aria-controls={id} aria-expanded={shown} className="w-fit max-md:min-h-11" onClick={() => setShown(!shown)} size="sm" type="button" variant="outline">
        {changedFieldsToggleLabel(changes.length, shown)}
      </Button>
      <div hidden={!shown} id={id}>{shown ? comparison : null}</div>
    </div>
  );
}

function HistoryEntry({ density, event, proposalHref }: { density: Density; event: RiskHistoryEvent; proposalHref?: RiskHistorySheetProps['proposalHref'] }) {
  const entry = historyEntryPresentation(event);
  const Icon = ICONS[entry.icon];
  const href = entry.showInProposals ? proposalHref?.(event) ?? null : null;
  const text = 'text-sm text-foreground [overflow-wrap:anywhere]';
  return (
    <li
      className={cn('grid min-w-0 gap-2 rounded-lg border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', density === 'compact' ? 'p-3' : 'p-4')}
      data-history-entry=""
      id={`risk-history-${event.id}`}
      tabIndex={-1}
    >
      <div className="flex min-w-0 items-start gap-2">
        <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground-secondary" />
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground" data-history-label="">{entry.label}</p>
          <p className="text-xs text-foreground-secondary">
            {event.occurredAt ? <><LocalInstant style="date-time" value={event.occurredAt} /> by </> : null}{entry.actorName}
          </p>
        </div>
      </div>
      {entry.lines.map((line, index) => <p className={text} key={index}>{line}</p>)}
      {href ? <RecordLink className="w-fit text-sm" href={href}>Show in AI proposals</RecordLink> : null}
      {entry.comparison && entry.comparisonKind === 'compare' ? <EntryComparison changes={entry.comparison} density={density} label={entry.label} /> : null}
      {entry.comparison && entry.comparisonKind === 'values' ? (
        <div className="grid gap-1">
          <p className="micro-label text-foreground-secondary">Values when taken off</p>
          <dl className="grid gap-x-4 gap-y-1 text-sm md:grid-cols-[minmax(0,10rem)_minmax(0,1fr)]">
            {entry.comparison.map((change) => (
              <div className="contents" key={change.field}>
                <dt className="font-medium text-foreground">{fieldLabel(change.field)}</dt>
                <dd className="whitespace-pre-wrap text-foreground [overflow-wrap:anywhere]">{valueText(change.from ?? change.to)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ) : null}
    </li>
  );
}

type SheetState =
  | { kind: 'loading' }
  | { kind: 'ready'; events: readonly RiskHistoryEvent[]; pagination: RiskHistoryPagination; recordedFrom: string | null }
  | { kind: 'failed'; failure: RiskCurationFailure };

/* A read that threw (the network, a redeploy): §8.5's error, as R1 reads it. */
const thrownFailure = (): RiskCurationFailure => {
  const copy = riskCurationRefusal({}, 'history');
  return { kind: copy.kind, message: copy.message, ...(copy.detail === undefined ? {} : { detail: copy.detail }) };
};

async function readPage(riskId: string, page: number): Promise<{ ok: true; data: { events: readonly RiskHistoryEvent[]; pagination: RiskHistoryPagination; recordedFrom: string | null } } | { ok: false; failure: RiskCurationFailure }> {
  try {
    const result = await readRiskHistoryAction({ riskId, page, pageSize: PAGE_SIZE });
    if (result.ok) return { ok: true, data: result.data };
    const { ok: _ok, ...failure } = result;
    return { ok: false, failure };
  } catch {
    return { ok: false, failure: thrownFailure() };
  }
}

export function RiskHistorySheet({ open, openedAt, ownerKey, proposalHref, riskId, riskNumber, titleRef }: RiskHistorySheetProps) {
  const [state, setState] = useState<SheetState>({ kind: 'loading' });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [skeletonFrom, setSkeletonFrom] = useState(openedAt);
  const [chosenDensity, setDensity] = useDensity(ownerKey);
  const wide = useIsWide();
  const density: Density = wide ? chosenDensity : 'comfortable';
  const zone = useViewerTimeZone();
  const request = useRef(0);
  const list = useRef<HTMLOListElement>(null);
  const focusEntry = useRef<number | null>(null);
  const skeleton = useSkeletonDelay(state.kind === 'loading', skeletonFrom);

  const load = useCallback(async () => {
    const attempt = ++request.current;
    setState({ kind: 'loading' });
    setMoreError(null);
    const result = await readPage(riskId, 1);
    if (request.current !== attempt) return;
    setState(result.ok ? { kind: 'ready', ...result.data } : { kind: 'failed', failure: result.failure });
  }, [riskId]);

  useEffect(() => {
    if (open) void load();
    else request.current += 1;
  }, [load, open]);

  /* §8.4: focus the first entry `Show older changes` added, once it is listed. */
  useEffect(() => {
    if (focusEntry.current === null || state.kind !== 'ready') return;
    const entry = list.current?.querySelectorAll<HTMLElement>('[data-history-entry]')[focusEntry.current];
    focusEntry.current = null;
    entry?.focus();
  }, [state]);

  /* §8.5: Try again keeps focus on the title. */
  function retry() {
    setSkeletonFrom(Date.now());
    void load();
    titleRef.current?.focus();
  }

  async function showOlder() {
    if (state.kind !== 'ready' || loadingMore) return;
    const attempt = request.current;
    setLoadingMore(true);
    setMoreError(null);
    const result = await readPage(riskId, state.pagination.page + 1);
    setLoadingMore(false);
    if (request.current !== attempt) return;
    if (!result.ok) {
      setMoreError(result.failure.message);
      return;
    }
    /* FE3-08: a change recorded while the sheet is open shifts the pages, so an entry already listed is not listed again. */
    const listed = new Set(state.events.map((entry) => entry.id));
    const fresh = result.data.events.filter((entry) => !listed.has(entry.id));
    focusEntry.current = fresh.length > 0 ? state.events.length : null;
    setState({ kind: 'ready', events: [...state.events, ...fresh], pagination: result.data.pagination, recordedFrom: result.data.recordedFrom });
  }

  if (state.kind === 'loading') return skeleton ? <RiskHistorySkeleton /> : null;

  if (state.kind === 'failed') {
    const { failure } = state;
    const retryable = failure.kind === 'retryable';
    return (
      <RiskHistoryMessage
        action={retryable ? <Button className="w-fit max-md:min-h-11" onClick={retry} size="sm" type="button" variant="outline"><RotateCcw aria-hidden="true" />Try again</Button> : undefined}
        description={failure.detail ?? (retryable ? HISTORY_LOAD_FAILED.description : undefined)}
        title={failure.message}
        tone={retryable ? 'error' : undefined}
      />
    );
  }

  const { events, pagination, recordedFrom } = state;
  if (events.length === 0) return <RiskHistoryMessage description="Changes to this risk are listed here from now on." title="No changes recorded yet" />;

  const lastPage = pagination.page >= pagination.pageCount;
  const startDate = formatInstant(recordedFrom, { zone, style: 'date' });
  const honestStart = startDate !== null && showsHonestStart({ events, lastPage, recordedFrom });

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p aria-live="polite" className="text-xs tabular-nums text-foreground-secondary">{historyCountLine(events.length, pagination.total)}</p>
        <div className="hidden md:block" data-density-control=""><SegmentedControl label="Density" onValueChange={setDensity} options={DENSITY_OPTIONS} value={chosenDensity} /></div>
      </div>
      <ol aria-label={`Changes to ${riskNumber}`} className="grid min-w-0 gap-3" ref={list}>
        {events.map((event) => <HistoryEntry density={density} event={event} key={event.id} proposalHref={proposalHref} />)}
      </ol>
      {honestStart ? <p className="text-xs text-foreground-secondary">{honestStartLine(startDate)}</p> : null}
      {moreError ? <p className="text-sm text-destructive" role="alert">{moreError}</p> : null}
      {lastPage ? null : (
        <Button aria-disabled={loadingMore ? true : undefined} className="w-fit max-md:min-h-11" onClick={() => void showOlder()} size="sm" type="button" variant="outline">Show older changes</Button>
      )}
    </div>
  );
}
