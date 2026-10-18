import { Sparkles } from 'lucide-react';
import type { ReactNode } from 'react';

import { LocalInstant } from '@/components/csrm/local-time';
import { RecordLink } from '@/components/csrm/record-link';
import { notePartLabels, type NotePart } from '@/features/request-notes/notes-domain';
import { aiInputsChangedHeadingFor } from '@/features/risk-curation/risk-curation-domain';
import type { AiInputsChanged } from './ai-assistance-domain';

/*
 * "AI inputs changed" (Phase 13 D-29; 13-UI-SPEC §10.2; the direction's X-18 AI input mark, extended by X-22 for files in
 * Phase 14 D-36, 14-UI-SPEC §6.2). Which notes and files changed a record's AI inputs since it was generated, from the one
 * signal Strapi serves to human Security Analysts only, so a Requestor's read never reaches it. Notes and files share one
 * list, notes first. It offers no action: Phases 15 and 16 attach their re-runs to the same served fields.
 *
 * A Server Component that only the three analyst record pages import (D-34's route budget). Every module between those
 * pages and where the block shows (the provenance header, the questionnaire and draft cards) is client code, so the pages
 * render it here and hand it on as a slot: no route gains client JavaScript for it. Its copy lives here too, never in
 * `ai-assistance-domain.ts`, which the Risk route's client graph loads.
 */

/** The record whose generation the signal is about, as its heading names it. */
export type AiInputsChangedTarget = 'questionnaire' | 'draft';

type ChangedNote = AiInputsChanged['notes'][number];
type ChangedFile = AiInputsChanged['files'][number];

/** §10.2: the heading line. */
export function aiInputsChangedHeading(target: AiInputsChangedTarget): string {
  return `AI inputs changed since this ${target} was generated`;
}

/** §10.2: one changed note, its link's words before the time and the caption after it. */
export function aiInputsChangedItem(note: { part: NotePart; change: ChangedNote['change'] }): { label: string; change: string } {
  return { label: `${notePartLabels[note.part]} note`, change: note.change === 'marked' ? 'Marked since' : 'Unmarked since' };
}

/** 14-UI-SPEC §6.2: one changed file's caption after its name. */
const fileChangeCaptions: Record<ChangedFile['change'], string> = {
  included: 'Included since',
  excluded: 'Excluded since',
  removed: 'Removed since',
};

export function aiInputsChangedFileCaption(change: ChangedFile['change']): string {
  return fileChangeCaptions[change];
}

/** §10.2: the closing caption. */
export const aiInputsChangedCaption = 'The AI hasn’t seen these changes.';

/* 16-UI-SPEC §10.2 (D-28, UI-D26): the assessment signal once Phase 16's requests count as its baseline. */
export const suggestMoreRisksCaption = 'To bring this into one risk, use Rewrite this risk on that risk.';
export const requestingAnalystSignalCaption = 'You raised this request, so another Security Analyst asks the AI about these changes.';

/**
 * §10.2: the assessment signal's heading, action and caption. The heading names the latest Suggest more risks request once
 * one completed after the draft; the action (`Suggest more risks`, where a start is allowed) is followed by its caption;
 * the analyst who raised the request is offered no action and reads their own caption (§12.3).
 */
export function assessmentSignalProps({ action, askedAt, generatedAt, viewerRaisedRequest }: {
  askedAt: string | null;
  generatedAt: string | null;
  viewerRaisedRequest: boolean;
  action?: ReactNode;
}): { heading: string; action?: ReactNode; caption?: string } {
  const heading = aiInputsChangedHeadingFor({ askedAt, generatedAt });
  if (viewerRaisedRequest) return { heading, caption: requestingAnalystSignalCaption };
  return action ? { heading, action, caption: suggestMoreRisksCaption } : { heading };
}

/** Where a note sits in its request's thread on the analyst's request page. */
function noteHref(requestId: string, noteId: string): string {
  return `/app/review/requests/${encodeURIComponent(requestId)}#note-${encodeURIComponent(noteId)}`;
}

/** Where a file's row sits in the Files section on the analyst's request page (14-UI-SPEC §6.2). */
function fileHref(requestId: string, fileId: string): string {
  return `/app/review/requests/${encodeURIComponent(requestId)}#file-${encodeURIComponent(fileId)}`;
}

/** Whether the served signal lists any changed input, a note or a file. */
function listsAnInput(signal: AiInputsChanged | null | undefined): signal is AiInputsChanged {
  return Boolean(signal) && (signal!.notes.length + signal!.files.length > 0);
}

/**
 * The slot a record page hands its client view: the block when the served signal lists a changed note or file, and
 * otherwise no slot at all. A view keeps a bordered block (the provenance header) or a card (the hub's) for any slot it is
 * handed, and an element is truthy whatever it renders, so "nothing to show" must be `undefined`, never a block that
 * renders null.
 */
export function aiInputsChangedSlot({ action, caption, heading, requestId, signal, target }: {
  /** Phase 15 (15-UI-SPEC §9.1; D-29, UI-D20): Suggest follow-up questions, where the page allows a start. */
  action?: ReactNode;
  /** Phase 16 (§10.2): the heading once a later request is the baseline, and the caption after the action. */
  heading?: string;
  caption?: string;
  requestId: string;
  signal: AiInputsChanged | null | undefined;
  target: AiInputsChangedTarget;
}): ReactNode | undefined {
  if (!listsAnInput(signal)) return undefined;
  return <AiInputsChangedBlock action={action} caption={caption} heading={heading} requestId={requestId} signal={signal} target={target} />;
}

export function AiInputsChangedBlock({ action, caption, heading, requestId, signal, target }: {
  /** The signal's action (Phase 15 §9.1), after its caption; the signal itself offers none. */
  action?: ReactNode;
  /** Phase 16 (16-UI-SPEC §10.2, UI-D26): the heading in place of the target's, from `assessmentSignalProps`. */
  heading?: string;
  /** Phase 16: the caption after the action, or in its place for the analyst who raised the request. */
  caption?: string;
  requestId: string;
  /** The served signal; `null` when nothing changed or there is no baseline to compare with (D-29). */
  signal: AiInputsChanged | null | undefined;
  target: AiInputsChangedTarget;
}) {
  if (!listsAnInput(signal)) return null;
  const headingId = `ai-inputs-changed-${target}`;
  return (
    <div className="grid min-w-0 gap-2" data-ai-inputs-changed={target}>
      <p className="flex items-start gap-2 text-sm font-medium text-foreground" id={headingId}>
        <Sparkles aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-foreground-secondary" />
        <span className="min-w-0">{heading ?? aiInputsChangedHeading(target)}</span>
      </p>
      <ul aria-labelledby={headingId} className="grid gap-2 md:gap-1">
        {signal.notes.map((note) => {
          const item = aiInputsChangedItem(note);
          return (
            <li className="flex min-w-0 flex-col md:flex-row md:flex-wrap md:items-baseline" key={note.documentId}>
              <RecordLink className="text-sm [overflow-wrap:anywhere]" href={noteHref(requestId, note.documentId)}>
                {item.label} · <LocalInstant style="date-time" value={note.postedAt} />
              </RecordLink>
              <span aria-hidden="true" className="hidden whitespace-pre text-xs text-foreground-secondary md:inline"> · </span>
              <span className="text-xs text-foreground-secondary">{item.change}</span>
            </li>
          );
        })}
        {signal.files.map((file) => (
          // The name is React text, never markup (T-14-42); the link is built from ids only.
          <li className="flex min-w-0 flex-col md:flex-row md:flex-wrap md:items-baseline" key={`file-${file.documentId}`}>
            {/* WR-506: a removed file has no row in the main list, so its name is plain text, as a note's chip names it. */}
            {file.change === 'removed'
              ? <span className="text-sm [overflow-wrap:anywhere]">{file.fileName}</span>
              : <RecordLink className="text-sm [overflow-wrap:anywhere]" href={fileHref(requestId, file.documentId)}>{file.fileName}</RecordLink>}
            <span aria-hidden="true" className="hidden whitespace-pre text-xs text-foreground-secondary md:inline"> · </span>
            <span className="text-xs text-foreground-secondary">{aiInputsChangedFileCaption(file.change)}</span>
          </li>
        ))}
      </ul>
      <p className="text-xs text-foreground-secondary">{aiInputsChangedCaption}</p>
      {action ? <div className="mt-1">{action}</div> : null}
      {caption ? <p className="text-xs text-foreground-secondary">{caption}</p> : null}
    </div>
  );
}
