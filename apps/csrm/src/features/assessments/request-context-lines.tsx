import { RecordLink } from '@/components/csrm/record-link';
import { newNotesLabel, noteCountLabel } from '@/features/request-notes/notes-domain';
import { UnreadCount } from '@/features/request-notes/unread-marker';
import type { RequestSummaryAssignment, RequestSummaryFiles, RequestSummaryNotes } from '@/features/requests/request-domain';

/*
 * Who holds the request, its notes figure and its files figure, under the originating request link on the analyst's
 * questionnaire and assessment pages (Phase 13 D-16, D-25; 13-UI-SPEC §11; Phase 14 D-27, 14-UI-SPEC §6.1). Strapi serves
 * them on the analyst's reads only, so a Requestor's read renders nothing. The pick-up itself happens on the request page,
 * which offers it only when Strapi allows it.
 *
 * A Server Component that only those two pages import (D-34's route budget): the editor and the questionnaire review are
 * client code, so a module they imported would ship to the browser too, as `assessment-request-link.tsx` does. The pages
 * render the lines here and hand them on as a slot, so neither route gains client JavaScript for them.
 */

/** §11: the assignee line's words. */
export const requestContextCopy = {
  notPickedUp: 'Not picked up',
  pickUp: 'Pick up on the request page',
  noNotes: 'No notes',
  noFiles: 'No files',
} as const;

const count = (value: number) => value.toLocaleString('en-AU');

/** 14-UI-SPEC §6.1: the files figure, `{n} {file|files}`. */
export function fileCountLabel(total: number): string {
  return `${count(total)} ${total === 1 ? 'file' : 'files'}`;
}

/** 14-UI-SPEC §6.1: the part after the figure, ` · {k} included in the AI inputs`, shown when above zero. */
export function includedInAiInputsLabel(included: number): string {
  return `${count(included)} included in the AI inputs`;
}

/** §11: `Assigned to {name}`. */
export function assignedToLine(displayName: string): string {
  return `Assigned to ${displayName}`;
}

/*
 * WCAG 2.2 SC 2.5.8 (14-UI-SPEC Accessibility contract): the lines sit 4px apart, so a link shorter than 24px is within 24px
 * of the link on the next line and the spacing exception does not hold. Every link here is a 24px-tall flex box, as the
 * record links in the lists are, whatever lines are shown.
 */
const targetClassName = 'inline-flex min-h-6 items-center';

function requestPageHref(requestId: string, anchor: 'assignment' | 'notes' | 'files'): string {
  return `/app/review/requests/${encodeURIComponent(requestId)}#${anchor}`;
}

export function RequestContextLines({ assignment, files, notes, requestId }: {
  assignment?: RequestSummaryAssignment | null;
  files?: RequestSummaryFiles | null;
  notes?: RequestSummaryNotes | null;
  requestId: string;
}) {
  if (!assignment && !notes && !files) return null;
  return (
    <div className="mt-1 grid gap-1 text-xs text-foreground-secondary" data-request-context="">
      {assignment ? <AssigneeLine assignment={assignment} requestId={requestId} /> : null}
      {notes ? <NotesLine notes={notes} requestId={requestId} /> : null}
      {files ? <FilesLine files={files} requestId={requestId} /> : null}
    </div>
  );
}

function AssigneeLine({ assignment, requestId }: { assignment: RequestSummaryAssignment; requestId: string }) {
  if (assignment.assignee) return <p className="[overflow-wrap:anywhere]">{assignedToLine(assignment.assignee.displayName)}</p>;
  return (
    <p className="flex min-w-0 flex-col md:flex-row md:flex-wrap md:items-baseline">
      <span>{requestContextCopy.notPickedUp}</span>
      {assignment.pickUp === 'allowed' ? (
        <>
          <span aria-hidden="true" className="hidden whitespace-pre md:inline"> · </span>
          <RecordLink className={`${targetClassName} [overflow-wrap:anywhere]`} href={requestPageHref(requestId, 'assignment')}>{requestContextCopy.pickUp}</RecordLink>
        </>
      ) : null}
    </p>
  );
}

function NotesLine({ notes, requestId }: { notes: RequestSummaryNotes; requestId: string }) {
  if (notes.total === 0) return <p>{requestContextCopy.noNotes}</p>;
  const label = noteCountLabel(notes.total);
  const name = notes.unread > 0 ? `${label}, ${newNotesLabel(notes.unread)}` : label;
  return (
    <p>
      <RecordLink aria-label={name} className={`${targetClassName} flex-wrap gap-x-2`} href={requestPageHref(requestId, 'notes')}>
        <span className="tabular-nums">{label}</span>
        <UnreadCount count={notes.unread} />
      </RecordLink>
    </p>
  );
}

/* 14-UI-SPEC §6.1 (X-10): the files figure links to the request page's Files section; with none, plain `No files`. */
function FilesLine({ files, requestId }: { files: RequestSummaryFiles; requestId: string }) {
  if (files.count === 0) return <p>{requestContextCopy.noFiles}</p>;
  return (
    <p className="[overflow-wrap:anywhere]">
      <RecordLink className={`${targetClassName} tabular-nums`} href={requestPageHref(requestId, 'files')}>{fileCountLabel(files.count)}</RecordLink>
      {files.included > 0 ? <span className="tabular-nums"> · {includedInAiInputsLabel(files.included)}</span> : null}
    </p>
  );
}
