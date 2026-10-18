import {
  ArchiveRestore, CircleCheck, ClipboardPenLine, FilePenLine, RotateCcw, Sparkles, Trash2, UndoDot,
} from 'lucide-react';
import type { ReactNode } from 'react';

import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';

import { AiInstructionText } from './ai-instruction-text';
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
  // Phase 15 (15-UI-SPEC §10): a request to the AI, labelled by its scope; a question an Undo restored.
  'ai-proposal': { icon: Sparkles, label: 'Proposals requested from the AI' },
  'question-restored': { icon: ArchiveRestore, label: 'Question restored' },
} as const;

/**
 * The proposal anchors the AI proposals panel lists (15-11 passes them from the proposals read): the runs it shows as
 * groups, by run id, and the proposals it shows as cards, by `proposalItemAnchor`. A timeline link appears only for a
 * listed anchor, so it never points at a group or card the page does not hold.
 */
export type ProposalAnchors = { runs: ReadonlySet<string>; items: ReadonlySet<string> };

/** The id of a run's group in the AI proposals panel. */
export function aiRunAnchor(runId: string): string {
  return `ai-run-${runId}`;
}

/** The id of a proposal's card in the AI proposals panel. */
export function proposalItemAnchor(runId: string, itemKey: string): string {
  return `ai-proposal-${runId}-${itemKey}`;
}

/* A document id is an opaque identifier, not a person; never show one as a name. */
function actor(event: TimelineEvent): string {
  return event.by?.displayName?.trim() || 'An analyst';
}

function label(event: TimelineEvent): string {
  if (event.kind === 'ai-proposal' && event.scope === 'question') return 'Plain-language rewrite requested from the AI';
  return eventPresentation[event.kind].label;
}

function Line({ name, children }: { name: string; children: ReactNode }) {
  return <p className="min-w-0 [overflow-wrap:anywhere] text-sm text-foreground"><span className="font-medium">{name}: </span>{children}</p>;
}

/*
 * The instruction line (X-25): the analyst's words, or what the AI did instead. A replacement shows only an instruction
 * it was given: the default task there is the ordinary generation, which Phase 10's entry already describes.
 */
function InstructionLine({ event }: { event: TimelineEvent }) {
  if (event.instruction) return <AiInstructionText instruction={event.instruction} />;
  if (event.kind !== 'ai-proposal') return null;
  if (event.instructionSource === 'plain-language-preset') return <Line name="Instruction">Rewrite in plain language (standard wording)</Line>;
  if (event.instructionSource === 'default-task') return <Line name="Instruction">none - the AI suggested the questions it judged still needed</Line>;
  return null;
}

function result(itemCount: number): string {
  return itemCount === 0 ? 'nothing proposed' : `${itemCount} ${itemCount === 1 ? 'proposal' : 'proposals'}`;
}

function AiProposalLines({ event, proposalAnchors }: { event: TimelineEvent; proposalAnchors: ProposalAnchors | undefined }) {
  return <>
    {event.providerName && event.providerVersion ? <Line name="Provider">{event.providerName} · Model: {event.providerVersion}</Line> : null}
    {event.itemCount === undefined ? null : <Line name="Result"><span className="tabular-nums">{result(event.itemCount)}</span></Line>}
    {event.runId && proposalAnchors?.runs.has(event.runId) ? <RecordLink className="w-fit text-sm" href={`#${aiRunAnchor(event.runId)}`}>Show in AI proposals</RecordLink> : null}
  </>;
}

const QUESTION_CHANGES: ReadonlySet<TimelineEvent['kind']> = new Set(['question-added', 'question-edited', 'question-deleted', 'question-restored']);

/*
 * Where a question change came from (15-UI-SPEC §10): a confirmation names its run and item, and whether the analyst
 * edited the proposal first; its Undo adds `aiUndo`. A restored question only ever comes from an Undo. A manual change
 * carries no run and shows no source.
 */
function source(event: TimelineEvent): string | null {
  if (event.kind === 'question-restored' || (QUESTION_CHANGES.has(event.kind) && event.runId && event.aiUndo)) return 'undo of a confirmed AI proposal';
  if (!QUESTION_CHANGES.has(event.kind) || !event.runId) return null;
  return event.aiEdited ? 'AI proposal, edited before confirming' : 'AI proposal, confirmed';
}

function SourceLines({ event, proposalAnchors }: { event: TimelineEvent; proposalAnchors: ProposalAnchors | undefined }) {
  const from = source(event);
  if (from === null) return null;
  const anchor = event.runId && event.itemKey && !event.aiUndo && event.kind !== 'question-restored' ? proposalItemAnchor(event.runId, event.itemKey) : null;
  return <>
    <Line name="Source">{from}</Line>
    {anchor && proposalAnchors?.items.has(anchor) ? <RecordLink className="w-fit text-sm" href={`#${anchor}`}>Show proposal</RecordLink> : null}
  </>;
}

function DetailEntry({ event, proposalAnchors }: { event: TimelineEvent; proposalAnchors: ProposalAnchors | undefined }) {
  const Icon = eventPresentation[event.kind].icon;
  return <li className="grid min-w-0 gap-2 rounded-lg border border-border bg-card p-3">
    <div className="flex min-w-0 items-start gap-2"><Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><p className="font-medium text-foreground">{label(event)}</p><p className="text-sm text-muted-foreground"><LocalInstant style="date-time" value={event.at} /> by {actor(event)}</p></div></div>
    {event.reason ? <Line name="Reason">{event.reason}</Line> : null}
    {event.questionText || event.questionKey ? <Line name="Question">{event.questionText ?? <span className="text-foreground-secondary">A question from an earlier version</span>}</Line> : null}
    <InstructionLine event={event} />
    {event.kind === 'ai-proposal' ? <AiProposalLines event={event} proposalAnchors={proposalAnchors} /> : null}
    <SourceLines event={event} proposalAnchors={proposalAnchors} />
    {event.explanation ? <Line name="Detail">{event.explanation}</Line> : null}
  </li>;
}


/*
 * The Requestor's summary (UI-SPEC §4.3) shows only `kind`, `at` and `explanation`: the Requestor projection
 * carries no question key and no actor (D-17). Question changes, a restored question among them (Phase 15 D-26),
 * collapse into one entry per release round. The Requestor projection carries no AI request or AI key; the summary
 * shows none even if one were served.
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
    if (event.kind === 'ai-proposal') continue;
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

export function QuestionnaireRevisionTimeline({ depth, proposalAnchors, questionnaire }: { depth: 'detail' | 'summary'; proposalAnchors?: ProposalAnchors; questionnaire: QuestionnaireSummary }) {
  const events = [...(questionnaire.events ?? [])].reverse();
  const answerable = questionnaire.release !== null && questionnaire.release !== undefined && questionnaire.state !== 'submitted';
  const cleared = events.filter((event) => event.kind === 'answer-cleared');
  const summaryEntries = depth === 'summary' ? summarise(questionnaire.events ?? []) : [];
  // The summary leaves out pre-release question changes and replacements, so it can hold nothing (IN-305).
  const nothingToShow = depth === 'summary' ? summaryEntries.length === 0 : events.length === 0;

  return <section aria-label="Questionnaire revision timeline" className="mb-6 grid min-w-0 gap-3">
    <div><h2 className="text-heading-sm text-foreground">Revision timeline</h2>{depth === 'summary' && answerable && cleared.length > 0 ? <p className="mt-1 text-sm text-muted-foreground">Some answers need completing again before you re-submit.</p> : null}</div>
    {nothingToShow ? <p className="rounded-lg border border-border bg-card p-3 text-sm text-muted-foreground">No revisions have been recorded.</p> : depth === 'detail' ? <ol className="grid min-w-0 gap-3">{events.map((event, index) => <DetailEntry event={event} proposalAnchors={proposalAnchors} key={`${event.at}-${event.kind}-${index}`} />)}</ol> : <ol className="grid min-w-0 gap-3">{summaryEntries.map((item, index) => <SummaryEntry item={item} key={`${item.at}-${item.type === 'round' ? 'round' : item.event.kind}-${index}`} />)}</ol>}
  </section>;
}
