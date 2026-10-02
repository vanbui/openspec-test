import {
  CircleCheck, ClipboardPenLine, FilePenLine, RotateCcw, Sparkles, Trash2, UndoDot,
} from 'lucide-react';

import { LocalInstant } from '@/components/csrm/local-time';

import type { QuestionnaireSummary } from './questionnaire-service';

type TimelineEvent = NonNullable<QuestionnaireSummary['events']>[number];

const eventPresentation = {
  released: { icon: CircleCheck, label: 'Released' },
  'returned-to-review': { icon: RotateCcw, label: 'Returned to analyst review' },
  'question-added': { icon: ClipboardPenLine, label: 'Question added' },
  'question-edited': { icon: FilePenLine, label: 'Question edited' },
  'question-deleted': { icon: Trash2, label: 'Question removed' },
  'answer-cleared': { icon: UndoDot, label: 'Answer cleared' },
  regenerated: { icon: Sparkles, label: 'Questionnaire replaced' },
} as const;

/* A document id is an opaque identifier, not a person; never show one as a name. */
function actor(event: TimelineEvent): string {
  return event.by?.displayName?.trim() || 'An analyst';
}

function DetailEntry({ event }: { event: TimelineEvent }) {
  const presentation = eventPresentation[event.kind];
  const Icon = presentation.icon;
  return <li className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
    <div className="flex min-w-0 items-start gap-2"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="font-medium text-foreground">{presentation.label}</p><p className="text-sm text-muted-foreground"><LocalInstant style="date-time" value={event.at} /> by {actor(event)}</p></div></div>
    {event.reason ? <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground"><span className="font-medium">Reason: </span>{event.reason}</p> : null}
    {event.questionText || event.questionKey ? <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground"><span className="font-medium">Question: </span>{event.questionText ?? <span className="text-foreground-secondary">A question from an earlier version</span>}</p> : null}
    {event.explanation ? <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground"><span className="font-medium">Detail: </span>{event.explanation}</p> : null}
  </li>;
}

const QUESTION_CHANGES: ReadonlySet<TimelineEvent['kind']> = new Set(['question-added', 'question-edited', 'question-deleted']);

/*
 * The Requestor's summary (UI-SPEC §4.3) shows only `kind`, `at` and `explanation`: the Requestor projection
 * carries no question key and no actor (D-17). Question changes collapse into one entry per release round.
 */
type SummaryItem =
  | { type: 'event'; at: string; event: TimelineEvent }
  | { type: 'round'; at: string; count: number };

const summaryLabels: Partial<Record<TimelineEvent['kind'], string>> = {
  released: 'Questionnaire made available to you',
  'returned-to-review': 'Questionnaire taken back for analyst review',
  'answer-cleared': 'An answer was cleared because its question changed',
};

/*
 * Walks the events in time order. Changes made before the first release are not listed: the Requestor never
 * saw that version (UI-D9). After it, each return to analyst review opens a round, and the changes made in
 * that round become one entry counting them, dated by its latest change. Other events stay single entries.
 * The list reads newest first.
 */
function summarise(events: readonly TimelineEvent[]): SummaryItem[] {
  const chronological = events.map((event, index) => ({ event, index }))
    .sort((left, right) => Date.parse(left.event.at) - Date.parse(right.event.at) || left.index - right.index)
    .map(({ event }) => event);
  const items: SummaryItem[] = [];
  let released = false;
  let round: { at: string; count: number } | null = null;
  const closeRound = () => {
    if (round && round.count > 0) items.push({ type: 'round', at: round.at, count: round.count });
    round = null;
  };
  for (const event of chronological) {
    if (QUESTION_CHANGES.has(event.kind)) {
      if (released && round) round = { at: event.at, count: round.count + 1 };
      continue;
    }
    if (event.kind === 'regenerated') {
      // Before the first release the Requestor never saw what was replaced. After it, the replacement discards
      // the round's earlier changes, so the round counts again from here.
      if (!released) continue;
      if (round) round = { at: event.at, count: 0 };
    }
    if (event.kind === 'released') {
      closeRound();
      released = true;
    } else if (event.kind === 'returned-to-review' && released) {
      closeRound();
      round = { at: event.at, count: 0 };
    }
    items.push({ type: 'event', at: event.at, event });
  }
  closeRound();
  return items.map((item, index) => ({ item, index }))
    .sort((left, right) => Date.parse(right.item.at) - Date.parse(left.item.at) || right.index - left.index)
    .map(({ item }) => item);
}

function SummaryEntry({ item }: { item: SummaryItem }) {
  const Icon = item.type === 'round' ? FilePenLine : eventPresentation[item.event.kind].icon;
  const label = item.type === 'round'
    ? `${item.count} ${item.count === 1 ? 'change' : 'changes'} to the questions`
    : summaryLabels[item.event.kind] ?? eventPresentation[item.event.kind].label;
  // Only a cleared answer carries its explanation to the Requestor; a replacement's detail is analyst work (§4.3).
  const explanation = item.type === 'event' && item.event.kind === 'answer-cleared' ? item.event.explanation : null;
  return <li className="grid min-w-0 gap-1 rounded-lg border border-border bg-card p-3"><div className="flex min-w-0 items-start gap-2"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="font-medium text-foreground">{label}</p><p className="text-sm text-muted-foreground"><LocalInstant style="date-time" value={item.at} /></p></div></div>{explanation ? <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground">{explanation}</p> : null}</li>;
}

export function QuestionnaireRevisionTimeline({ depth, questionnaire }: { depth: 'detail' | 'summary'; questionnaire: QuestionnaireSummary }) {
  const events = [...(questionnaire.events ?? [])].reverse();
  const answerable = questionnaire.release !== null && questionnaire.release !== undefined && questionnaire.state !== 'submitted';
  const cleared = events.filter((event) => event.kind === 'answer-cleared');
  const summaryEntries = depth === 'summary' ? summarise(questionnaire.events ?? []) : [];
  // The summary leaves out pre-release question changes and replacements, so it can hold nothing (IN-305).
  const nothingToShow = depth === 'summary' ? summaryEntries.length === 0 : events.length === 0;

  return <section aria-label="Questionnaire revision timeline" className="mb-6 grid min-w-0 gap-3">
    <div><h2 className="text-heading-sm text-foreground">Revision timeline</h2>{depth === 'summary' && answerable && cleared.length > 0 ? <p className="mt-1 text-sm text-muted-foreground">Some answers need completing again before you re-submit.</p> : null}</div>
    {nothingToShow ? <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">No revisions have been recorded.</p> : depth === 'detail' ? <ol className="grid min-w-0 gap-3">{events.map((event, index) => <DetailEntry event={event} key={`${event.at}-${event.kind}-${index}`} />)}</ol> : <ol className="grid min-w-0 gap-3">{summaryEntries.map((item, index) => <SummaryEntry item={item} key={`${item.at}-${item.type === 'round' ? 'round' : item.event.kind}-${index}`} />)}</ol>}
  </section>;
}
