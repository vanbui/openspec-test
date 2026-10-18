import { DetailSection } from '@/components/csrm/detail-section';
import type { RequestAttachment } from '@/features/attachments/attachments-domain';
import { isAnalystAssignmentView, type CsrmAssessmentRequest, type RequestNotesSummary } from '@/features/requests/request-domain';

import { NotesThread } from './notes-thread';
import { NOTES_PAGE_SIZE, noteCountLabel, notesCopy, notesDescription, type NotePart, type NotesViewer } from './notes-domain';
import { listRequestNotes } from './notes-service';
import { UnreadCount } from './unread-marker';

/*
 * The `Notes` section, the last on both request pages (13-UI-SPEC §8; D-21 to D-25; X-16). It renders only for a viewer
 * the request read gave a notes summary: anyone Strapi does not let use the notes (another Requestor, a participant)
 * gets a null summary, and then no section, count or flag renders and no notes read is made (D-23, G-12).
 */

export type NotesSectionProps = {
  requestId: string;
  requestNumber: string;
  viewer: NotesViewer;
  /** The request read's notes summary for this viewer, or null when Strapi serves none. */
  summary: RequestNotesSummary | null | undefined;
  /**
   * The names the page knows for the viewer in each part (the Requestor's name; the analyst view's own viewer), so a
   * note being added shows its author: the part Strapi gives the viewer chooses one.
   */
  authorNames?: Partial<Record<NotePart, string | null>>;
  /** The signed-in person's opaque draft key (`draftOwnerKey`, server-only): keeps unsent note text (§9.3; UI-D17). */
  draftOwnerKey?: string | null;
  /** 14-UI-SPEC §4.2: the request's files grouped by the note they came with, from the page's list. */
  filesByNote?: Readonly<Record<string, readonly RequestAttachment[]>>;
  /** 14-UI-SPEC §4.1: Strapi's add facts when files can be added with a note, so the composer offers `Attach files`. */
  attach?: { remaining: number } | null;
};

/**
 * The viewer's name in each part, from the request read: the request's Requestor, and the analyst view's own viewer
 * (13-09). A part the read cannot name stays unnamed.
 */
export function notesAuthorNames(request: Pick<CsrmAssessmentRequest, 'requestorName' | 'assignment'>): Partial<Record<NotePart, string | null>> {
  const assignment = request.assignment;
  return {
    requestor: request.requestorName ?? null,
    'security-analyst': assignment && isAnalystAssignmentView(assignment) ? assignment.viewer.displayName : null,
  };
}

export async function NotesSection({ attach = null, authorNames = {}, draftOwnerKey = null, filesByNote = {}, requestId, requestNumber, summary, viewer }: NotesSectionProps) {
  if (!summary) return null;
  const result = await listRequestNotes(requestId, { limit: NOTES_PAGE_SIZE });
  const page = result.error ? null : result.data;
  /* The thread's own read is the fresher; the request read's summary stands in when it failed. */
  const total = page?.meta.total ?? summary.total;
  const unread = page?.meta.unread ?? summary.unread;
  const accepting = page?.meta.accepting ?? summary.accepting;
  const closedReason = page ? page.meta.closedReason : summary.closedReason;
  const viewerPart = page?.meta.viewerPart ?? (viewer === 'requestor' ? 'requestor' : 'security-analyst');
  const viewerName = authorNames[viewerPart] ?? null;

  return (
    <div className="scroll-mt-24" id="notes">
      {/* D1: the hub's Notes row and every unread line link here, so the heading takes focus when a link lands (UI-D27). */}
      {/* §8.1 by role, not route (IN-308): the part Strapi gives the viewer chooses the description. */}
      <DetailSection description={notesDescription(viewerPart === 'security-analyst' ? 'analyst' : 'requestor')} headingFocusable title={notesCopy.title}>
        <div className="grid gap-4">
          {total > 0 ? (
            <p className="text-xs text-foreground-secondary tabular-nums" data-notes-count="">
              {noteCountLabel(total)}
              {unread > 0 ? <>{' · '}<UnreadCount count={unread} /></> : null}
            </p>
          ) : null}
          <NotesThread
            accepting={accepting}
            attach={attach}
            canMarkAiInputs={page?.meta.canMarkAiInputs ?? false}
            closedReason={closedReason}
            draftOwnerKey={draftOwnerKey}
            filesByNote={filesByNote}
            notes={page ? page.notes : null}
            requestId={requestId}
            requestNumber={requestNumber}
            viewer={viewer}
            viewerName={viewerName}
            viewerPart={viewerPart}
          />
        </div>
      </DetailSection>
    </div>
  );
}
