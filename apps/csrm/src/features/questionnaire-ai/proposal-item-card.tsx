'use client';

import { AlertCircle, Check, CircleMinus, PenLine, Plus, X } from 'lucide-react';
import { useEffect, useId, useRef, useState, type KeyboardEvent, type ReactNode } from 'react';

import { useViewerTimeZone } from '@/components/csrm/local-time';
import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { RecordLink } from '@/components/csrm/record-link';
import { StatusBadge } from '@/components/csrm/status-badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { AiCitations } from '@/features/ai-assistance/ai-citations';
import { AiRunSheetTrigger } from '@/features/ai-assistance/ai-run-sheet-trigger';
import { FieldComparison } from '@/features/ai-assistance/field-comparison';
import { compareFields, type ComparisonRow } from '@/features/ai-assistance/field-comparison-domain';
import { formatInstant } from '@/lib/time/format-instant';
import { readSessionDraft, writeSessionDraft } from '@/lib/session-drafts/session-drafts';
import { cn } from '@/lib/utils';
import {
  citationLabel,
  itemEyebrow,
  itemSubject,
  leftOutCount,
  leftOutLabel,
  leftOutLines,
  placementLine,
  REMOVAL_NOTE,
  runFactsLine,
  runGroupHeading,
  staleLine,
  unmatchedSourcesCaption,
  visibilityLine,
  type ItemActions,
  type ItemEyebrow,
  type ProposalSourceView,
  type QuestionnaireAiItemView,
  type QuestionnaireAiQuestionValues,
  type QuestionnaireAiRunView,
} from './questionnaire-ai-domain';

/*
 * The proposal cards (15-UI-SPEC §4; X-24; D-13, D-20, D-33). Every word comes from questionnaire-ai-domain.ts; the
 * AI's text is React text, never markup, with its line breaks kept (T-15-40).
 */

export type ProposalDensity = 'comfortable' | 'compact';

export const proposalKey = (item: Pick<QuestionnaireAiItemView, 'runId' | 'itemKey'>): string => `${item.runId}:${item.itemKey}`;

const eyebrowIcons: Record<ItemEyebrow['icon'], typeof Plus> = { Plus, PenLine, CircleMinus };

/** X-3 times in the viewer's zone, as the domain's lines take them. */
export function useInstant(): (value: string | null) => string {
  const zone = useViewerTimeZone();
  return (value) => (value ? formatInstant(value, { zone, style: 'date-time' }) ?? '' : '');
}

/* An item's decision handlers, provided by the panel's decisions hook. */
export type ProposalHandlers = {
  confirm: (item: QuestionnaireAiItemView) => void;
  startEdit: (item: QuestionnaireAiItemView) => void;
  startReject: (item: QuestionnaireAiItemView) => void;
  undo: (item: QuestionnaireAiItemView) => void;
};

export function Eyebrow({ eyebrow }: { eyebrow: ItemEyebrow }) {
  const Icon = eyebrowIcons[eyebrow.icon];
  return <p className="micro-label flex items-center gap-1 text-foreground-secondary"><Icon aria-hidden="true" className="size-3" />{eyebrow.label}</p>;
}

function Definition({ term, children }: { term: string; children: ReactNode }) {
  return <div className="grid gap-0.5 md:grid-cols-[10rem_1fr] md:gap-3"><dt className="micro-label text-foreground-secondary">{term}</dt><dd className="min-w-0 whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">{children}</dd></div>;
}

const choicesText = (values: QuestionnaireAiQuestionValues): string => values.choices.map((choice) => choice.label).join('\n');

/** §4.3: a question's values as a definition list. */
export function QuestionValues({ values }: { values: QuestionnaireAiQuestionValues }) {
  return (
    <>
      <Definition term="Question">{values.questionText}</Definition>
      <Definition term="Help text">{values.helpText ?? 'None'}</Definition>
      <Definition term="Answer type">{values.answerType}</Definition>
      {values.choices.length ? <Definition term="Choices">{choicesText(values)}</Definition> : null}
      <Definition term="Required">{values.required ? 'Yes' : 'No'}</Definition>
    </>
  );
}

/** §4.3: the five rows a change compares, in order. */
function comparisonRows(current: QuestionnaireAiQuestionValues, proposed: QuestionnaireAiQuestionValues): ComparisonRow[] {
  const row = (label: string, read: (values: QuestionnaireAiQuestionValues) => string): ComparisonRow => ({ label, current: read(current), proposed: read(proposed) });
  return [
    row('Question', (values) => values.questionText),
    row('Help text', (values) => values.helpText ?? 'None'),
    row('Answer type', (values) => values.answerType),
    row('Choices', (values) => choicesText(values) || 'None'),
    row('Required', (values) => (values.required ? 'Yes' : 'No')),
  ];
}

function ItemContent({ density, item }: { density: ProposalDensity; item: QuestionnaireAiItemView }) {
  if (item.kind === 'change' && item.current && item.proposed) {
    return <FieldComparison caption={`Proposed change to ${item.current.questionText}`} density={density} rows={compareFields(comparisonRows(item.current, item.proposed))} />;
  }
  if (item.kind === 'add' && item.proposed) {
    const where = placementLine(item);
    const shownWhen = item.placement ? visibilityLine(item.placement) : null;
    return <dl className="grid gap-2"><QuestionValues values={item.proposed} />{where ? <Definition term="Where it goes">{where}</Definition> : null}{shownWhen ? <Definition term="Shown when">{shownWhen}</Definition> : null}</dl>;
  }
  if (item.kind === 'remove') {
    return <div className="grid gap-2">{item.current ? <dl className="grid gap-2"><QuestionValues values={item.current} /></dl> : null}<p className="text-sm text-foreground">{REMOVAL_NOTE}</p></div>;
  }
  return null;
}

function Citations({ requestId, sources, subject }: { requestId: string | null; sources: readonly ProposalSourceView[]; subject: string }) {
  const instant = useInstant();
  if (sources.length === 0) return null;
  const requestFields = sources.filter((source) => source.kind === 'request-field');
  const others = sources.filter((source) => source.kind !== 'request-field');
  const list = (
    <ul aria-label={requestFields.length && requestId ? `More sources for ${subject}` : `Sources for ${subject}`} className="flex min-w-0 flex-wrap gap-x-2 gap-y-1">
      {others.map((source) => {
        const label = citationLabel(source, instant(source.note?.postedAt ?? null));
        return (
          <li className="min-w-0 max-w-full" key={`${source.kind}:${source.ref}`}>
            {source.kind === 'note' && source.note && requestId
              ? <RecordLink className="block max-w-md truncate py-1 text-xs font-medium" href={`/app/review/requests/${encodeURIComponent(requestId)}#note-${encodeURIComponent(source.note.documentId)}`}>{label}</RecordLink>
              : <span className="block max-w-md truncate py-1 text-xs text-foreground-secondary">{label}</span>}
          </li>
        );
      })}
    </ul>
  );
  if (requestFields.length && requestId) {
    return (
      <div className="grid gap-1">
        <AiCitations fieldLabel={subject} requestId={requestId} sources={requestFields.map((source) => ({ key: source.ref, kind: 'request', label: source.label, section: null, classification: null }))} />
        {others.length ? list : null}
      </div>
    );
  }
  return <div className="grid gap-1"><p className="micro-label text-foreground-secondary">Sources</p>{list}</div>;
}

function ReasonAndSources({ density, item, requestId, subject }: { density: ProposalDensity; item: QuestionnaireAiItemView; requestId: string | null; subject: string }) {
  const [open, setOpen] = useState(false);
  const regionId = useId();
  const body = (
    <div className="grid gap-3" id={regionId}>
      <div className="grid gap-1">
        <p className="micro-label text-foreground-secondary">Reason</p>
        <p className="whitespace-pre-wrap text-sm text-foreground [overflow-wrap:anywhere]">{item.rationale}</p>
      </div>
      <Citations requestId={requestId} sources={item.sources} subject={subject} />
    </div>
  );
  if (density === 'comfortable') return body;
  return (
    <div className="grid gap-2">
      <Button aria-controls={regionId} aria-expanded={open} className="w-fit max-md:min-h-11" data-print="hidden" onClick={() => setOpen(!open)} size="sm" type="button" variant="ghost">{open ? 'Hide reason and sources' : 'Show reason and sources'}</Button>
      {open ? body : null}
    </div>
  );
}

/** §5 and X-24: the open card's actions, each named by its subject. */
function CardActions({ actions, handlers, item, subject }: { actions: ItemActions; handlers: ProposalHandlers; item: QuestionnaireAiItemView; subject: string }) {
  const key = proposalKey(item);
  const confirmShown = actions.confirm !== 'hidden';
  return (
    <div className="flex flex-col gap-2 md:flex-row md:flex-wrap" data-print="hidden">
      {confirmShown ? <Button aria-label={`Confirm: ${subject}`} className="max-md:min-h-11" data-proposal-primary={key} disabled={actions.confirm === 'disabled'} onClick={() => handlers.confirm(item)} size="sm" type="button" variant="outline"><Check aria-hidden="true" />Confirm</Button> : null}
      {actions.editThenConfirm !== 'hidden' ? <Button aria-label={`Edit, then confirm: ${subject}`} className="max-md:min-h-11" data-proposal-edit={key} disabled={actions.editThenConfirm === 'disabled'} onClick={() => handlers.startEdit(item)} size="sm" type="button" variant="ghost"><PenLine aria-hidden="true" />Edit, then confirm</Button> : null}
      {actions.reject ? <Button aria-label={`Reject: ${subject}`} className="max-md:min-h-11" data-proposal-primary={confirmShown ? undefined : key} data-proposal-reject={key} onClick={() => handlers.startReject(item)} size="sm" type="button" variant="ghost"><X aria-hidden="true" />Reject</Button> : null}
    </div>
  );
}

export function ProposalItemCard({ actions, children, density, extra, handlers, item, requestId, run }: { actions: ItemActions; children?: ReactNode; density: ProposalDensity; extra?: ReactNode; handlers: ProposalHandlers; item: QuestionnaireAiItemView; requestId: string | null; run: QuestionnaireAiRunView }) {
  const subject = itemSubject(item);
  const stale = staleLine(item);
  return (
    <li className={cn('grid gap-3 rounded-lg border border-border bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', density === 'compact' ? 'p-3' : 'p-4')} id={`ai-proposal-${item.runId}-${item.itemKey}`} tabIndex={-1}>
      <div className="flex flex-wrap items-center gap-2"><Eyebrow eyebrow={itemEyebrow(item, run)} />{item.stale === true ? <StatusBadge family="aiReview" value="stale" /> : null}</div>
      <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">{subject}</p>
      {stale ? <p className="text-xs text-foreground-secondary">{stale}</p> : null}
      {children ?? <>
        <ItemContent density={density} item={item} />
        <ReasonAndSources density={density} item={item} requestId={requestId} subject={subject} />
        <CardActions actions={actions} handlers={handlers} item={item} subject={subject} />
      </>}
      {extra}
    </li>
  );
}

/** §4.1: the open proposals one request to the AI produced, as an `article` with its heading, facts and left-out list. */
export function ProposalRunGroup({ actionsFor, anyAnswered, density, groupActions, handlers, items, renderExtra, renderItem, requestId, run }: {
  actionsFor: (item: QuestionnaireAiItemView) => ItemActions;
  anyAnswered: boolean;
  density: ProposalDensity;
  /** Reject remaining (§5.4): the panel's control and row, under the header. */
  groupActions?: ReactNode;
  handlers: ProposalHandlers;
  items: readonly QuestionnaireAiItemView[];
  /** An item's form in place of its content (Edit, then confirm; Reject), when one is open. */
  renderItem?: (item: QuestionnaireAiItemView) => ReactNode;
  /** An item's row after its actions (Reject's reason), when one is open. */
  renderExtra?: (item: QuestionnaireAiItemView) => ReactNode;
  requestId: string | null;
  run: QuestionnaireAiRunView;
}) {
  const instant = useInstant();
  const headingId = `ai-run-${run.runId}-heading`;
  const unmatched = unmatchedSourcesCaption(run.sourcesDropped);
  return (
    <article aria-labelledby={headingId} className="grid gap-3 border-t border-border pt-6 first:border-t-0 first:pt-0" id={`ai-run-${run.runId}`}>
      <h3 className="text-sm font-medium text-foreground [overflow-wrap:anywhere]" id={headingId}>{runGroupHeading(run, run.initiatedBy?.displayName ?? 'A Security Analyst', anyAnswered)}</h3>
      <p className="text-xs text-foreground-secondary tabular-nums">{runFactsLine({ ...run, counts: { ...run.counts, open: items.length } }, instant(run.completedAt ?? run.startedAt))}</p>
      <LeftOutProposals adjustments={run.adjustments} />
      {unmatched ? <p className="text-xs text-foreground-secondary">{unmatched}</p> : null}
      <div className="flex flex-col gap-2 md:flex-row md:flex-wrap md:items-center" data-print="hidden"><AiRunSheetTrigger kind="questionnaire-proposals" runId={run.runId} />{groupActions}</div>
      <ol className="grid gap-3">
        {items.map((item) => (
          <ProposalItemCard actions={actionsFor(item)} density={density} extra={renderExtra?.(item)} handlers={handlers} item={item} key={proposalKey(item)} requestId={requestId} run={run}>{renderItem?.(item)}</ProposalItemCard>
        ))}
      </ol>
    </article>
  );
}

/* §5.3 and §5.4: the reason's words. */
export const PROPOSAL_FIGURE_LINK_CLASS = 'record-link inline-flex min-h-6 w-fit items-center font-medium tabular-nums';

/** The same discarded-item explanation for open groups and completed runs with nothing kept. */
export function LeftOutProposals({ adjustments }: { adjustments: QuestionnaireAiRunView['adjustments'] }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const label = leftOutLabel(leftOutCount(adjustments));
  if (!label) return null;
  return <div className="grid gap-1"><button aria-controls={id} aria-expanded={open} className={cn(PROPOSAL_FIGURE_LINK_CLASS, 'text-xs')} onClick={() => setOpen(!open)} type="button">{label}</button><ul className="grid list-disc gap-1 pl-5 text-xs text-foreground-secondary" hidden={!open} id={id}>{leftOutLines(adjustments).map((line) => <li key={line}>{line}</li>)}</ul></div>;
}

export const REJECT_REASON_LABEL = 'Reason (optional)';
const REJECT_REASON_HINT = 'The AI reads this next time, so it doesn’t propose the same again.';
const REJECT_REASON_TOO_LONG = 'Keep the reason to 500 characters or fewer.';

/*
 * §5.3 and §5.4 (UI-D5): the inline row that rejects with an optional reason, in an X-5 well, focus in its field. Enter
 * rejects and Escape keeps; a reason over 500 characters is refused in the row.
 */
export function RejectRow({ draft, keepLabel, onKeep, onReject, rejectLabel }: { draft?: { ownerKey: string | null; recordId: string }; rejectLabel: string; keepLabel: string; onReject: (reason: string | undefined) => void; onKeep: () => void }) {
  const id = useId();
  const field = useRef<HTMLInputElement>(null);
  const [reason, setReason] = useState(() => draft?.ownerKey ? readSessionDraft('proposal-edit', draft.ownerKey, draft.recordId) ?? '' : '');
  const [error, setError] = useState<string | null>(null);
  useUnloadWarning(reason.trim().length > 0);
  useEffect(() => { field.current?.focus(); }, []);

  function keep() {
    if (draft?.ownerKey) writeSessionDraft('proposal-edit', draft.ownerKey, draft.recordId, '');
    onKeep();
  }

  function reject() {
    if (reason.length > 500) {
      setError(REJECT_REASON_TOO_LONG);
      field.current?.focus();
      return;
    }
    onReject(reason.trim() === '' ? undefined : reason.trim());
  }

  function keyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault();
      reject();
    } else if (event.key === 'Escape') {
      event.preventDefault();
      keep();
    }
  }

  return (
    <div className="grid gap-2 rounded-lg border border-border bg-surface-muted p-3" data-print="hidden">
      <Label htmlFor={id}>{REJECT_REASON_LABEL}</Label>
      <p className="text-xs text-foreground-secondary" id={`${id}-hint`}>{REJECT_REASON_HINT}</p>
      <Input aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} aria-invalid={error ? true : undefined} className="max-w-[640px]" id={id} onChange={(event) => { setReason(event.target.value); if (draft?.ownerKey) writeSessionDraft('proposal-edit', draft.ownerKey, draft.recordId, event.target.value); }} onKeyDown={keyDown} ref={field} value={reason} />
      {error ? <p className="flex items-start gap-1.5 text-xs text-destructive" id={`${id}-error`} role="alert"><AlertCircle aria-hidden="true" className="mt-px size-3.5 shrink-0" />{error}</p> : null}
      <div className="flex flex-col gap-2 md:flex-row">
        <Button className="max-md:min-h-11" onClick={reject} size="sm" type="button" variant="outline">{rejectLabel}</Button>
        <Button className="max-md:min-h-11" onClick={keep} size="sm" type="button" variant="ghost">{keepLabel}</Button>
      </div>
    </div>
  );
}
