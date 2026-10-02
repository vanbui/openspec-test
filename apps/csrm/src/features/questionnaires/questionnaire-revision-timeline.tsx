import {
  CircleCheck, ClipboardPenLine, FilePenLine, RotateCcw, Trash2, UndoDot,
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
    {event.questionKey ? <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground"><span className="font-medium">Question: </span>{event.questionKey}</p> : null}
    {event.explanation ? <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground"><span className="font-medium">Detail: </span>{event.explanation}</p> : null}
  </li>;
}

function SummaryEntry({ event, count }: { event: TimelineEvent; count?: number }) {
  const presentation = eventPresentation[event.kind];
  const Icon = presentation.icon;
  const label = event.kind === 'released' ? 'Questionnaire made available to you'
    : event.kind === 'returned-to-review' ? 'Questionnaire taken back for analyst review'
      : event.kind === 'answer-cleared' ? 'An answer was cleared because its question changed'
        : `${count ?? 1} question${count === 1 ? '' : 's'} added or changed`;
  return <li className="grid min-w-0 gap-1 rounded-lg border border-border bg-card p-3"><div className="flex min-w-0 items-start gap-2"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="font-medium text-foreground">{label}</p><p className="text-sm text-muted-foreground"><LocalInstant style="date-time" value={event.at} /></p></div></div>{event.explanation ? <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground">{event.explanation}</p> : null}</li>;
}

export function QuestionnaireRevisionTimeline({ depth, questionnaire }: { depth: 'detail' | 'summary'; questionnaire: QuestionnaireSummary }) {
  const events = [...(questionnaire.events ?? [])].reverse();
  const answerable = questionnaire.release !== null && questionnaire.release !== undefined && questionnaire.state !== 'submitted';
  const cleared = events.filter((event) => event.kind === 'answer-cleared');
  const changes = events.filter((event) => ['question-added', 'question-edited', 'question-deleted'].includes(event.kind));
  const summaryEvents = events.filter((event) => !['question-added', 'question-edited', 'question-deleted', 'answer-cleared'].includes(event.kind));
  const latestChange = changes[0];
  /*
   * A Requestor reads a dated timeline (D-09), so the summary stays in date
   * order. The question changes collapse into one entry dated by the most
   * recent of them, rather than being appended after everything else.
   */
  const summaryEntries = [
    ...summaryEvents.map((event) => ({ event, count: undefined as number | undefined })),
    ...(latestChange ? [{ event: latestChange, count: changes.length }] : []),
    ...cleared.map((event) => ({ event, count: undefined as number | undefined })),
  ].sort((left, right) => Date.parse(right.event.at) - Date.parse(left.event.at));

  return <section aria-label="Questionnaire revision timeline" className="mb-6 grid min-w-0 gap-3">
    <div><h2 className="text-heading-sm text-foreground">Revision timeline</h2>{depth === 'summary' && answerable && cleared.length > 0 ? <p className="mt-1 text-sm text-muted-foreground">Some answers need completing again before you re-submit.</p> : null}</div>
    {events.length === 0 ? <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">No revisions have been recorded.</p> : depth === 'detail' ? <ol className="grid min-w-0 gap-3">{events.map((event, index) => <DetailEntry event={event} key={`${event.at}-${event.kind}-${index}`} />)}</ol> : <ol className="grid min-w-0 gap-3">{summaryEntries.map(({ count, event }, index) => <SummaryEntry count={count} event={event} key={`${event.at}-${event.kind}-${index}`} />)}</ol>}
  </section>;
}
