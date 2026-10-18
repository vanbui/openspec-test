import { CloudOff, Lock, Paperclip, ShieldBan } from 'lucide-react';
import type { Ref } from 'react';

import { DetailSection } from '@/components/csrm/detail-section';
import type { RequestAttachmentSummary } from '@/features/requests/request-domain';

import type { RequestAttachment, RequestAttachmentsPage } from './attachments-schema';
import {
  fileAiSectionLine,
  filesCopy,
  filesCountLabel,
  filesDescription,
  filesEmptyState,
  filesLockedLine,
  groupAttachmentsByNote,
  type FileAiSectionIcon,
  type FilesLockedIcon,
  type FilesViewer,
} from './attachments-domain';
import { FilesList, FilesReadError } from './files-list';
import { ComposerHandOffField } from './composer-hand-off';
import { DraftUploadQueue, type UploadQueueHandle } from './upload-queue';

/*
 * The `Files` section of a request page (14-UI-SPEC §3; D-27, D-28; X-21), directly before `Notes` (UI-D2). It renders
 * only for a viewer the request read gave a file summary (D-18). The page reads the list; this renders it, the §3.7
 * states, and the add control Strapi's facts allow: on a draft, its Requestor's field adds files at once (UI-D4);
 * where files cannot be added, one line says why in place of the field (§1.2, §3.6), and the draft's files not added stay
 * listed beneath it with their reasons and actions (§1.5; WR-401). After submission, for the Requestor
 * and a human Security Analyst Strapi lets add, the field reads `Add files with a note` and hands the chosen files to the
 * Notes composer (§4.1; UI-D6), so every file arrives with a note. The web never infers an action: `canAdd`, `window` and
 * `needsNote` are Strapi's.
 */

export type FilesSectionProps = {
  requestId: string;
  viewer: FilesViewer;
  /** The request read's file summary for this viewer. */
  summary: RequestAttachmentSummary;
  /** The request's files, or null when their read failed and the page did not. */
  attachments: RequestAttachmentsPage | null;
  /** The signed-in person's opaque key (`draftOwnerKey`, server-only): keys the tab's file store and the density choice. */
  draftOwnerKey: string | null;
};

const lockedIcons: Readonly<Record<FilesLockedIcon, typeof Lock>> = { Paperclip, CloudOff, Lock };
const aiLineIcons: Readonly<Record<FileAiSectionIcon, typeof Lock>> = { Lock, ShieldBan };

/** The list read as the page holds it: the files, or the failure that kept them from the page. */
type FilesRead = { data: RequestAttachmentsPage | null; error: unknown } | null;

/**
 * D-18 (T-14-47): both request pages ask this of the request read. A viewer the read gave no file summary (another
 * Requestor, a participant) gets no section at all, so nothing of the files renders for them; for anyone else it gives
 * the section's props, with no files when their read failed and the page did not (§3.7).
 */
export function filesSectionFor(
  request: { documentId: string; attachments?: RequestAttachmentSummary | null },
  files: FilesRead,
  { draftOwnerKey, viewer }: { viewer: FilesViewer; draftOwnerKey: string | null },
): FilesSectionProps | null {
  if (!request.attachments) return null;
  return {
    requestId: request.documentId,
    summary: request.attachments,
    attachments: files && !files.error ? files.data : null,
    viewer,
    draftOwnerKey,
  };
}

/** What the Notes section needs of the files (14-UI-SPEC §4): each note's files, and whether the composer takes files. */
export type NoteFiles = { byNote: Record<string, RequestAttachment[]>; attach: { remaining: number } | null };

/**
 * D-17, D-27: both request pages hand the Notes section each note's files from the list they read, and, where Strapi
 * says files are now added with a note, the room the request has left, so the composer offers `Attach files`. A viewer
 * the read gave no file summary gets neither.
 */
export function noteFilesFor(section: FilesSectionProps | null): NoteFiles {
  if (!section) return { byNote: {}, attach: null };
  const add = section.attachments?.meta.add ?? section.summary;
  return {
    byNote: groupAttachmentsByNote(section.attachments?.attachments ?? []),
    attach: add.canAdd && add.needsNote && section.draftOwnerKey !== null ? { remaining: add.remaining } : null,
  };
}

export function FilesSection(props: FilesSectionProps) {
  return (
    <div className="scroll-mt-24">
      <DetailSection description={filesDescription(props.viewer)} headingFocusable headingId="files" title={filesCopy.title}>
        <FilesPanel {...props} />
      </DetailSection>
    </div>
  );
}

export type FilesPanelProps = FilesSectionProps & {
  /** The draft's edit form waits on the queue when it saves (§2.2, §2.3). */
  queueRef?: Ref<UploadQueueHandle>;
  /** While the edit form saves, its queue takes no change (WR-504). */
  queueDisabled?: boolean;
};

/**
 * The section's content without its frame: the count, the list or its §3.7 state, and the add control or the line that
 * stands in its place. The request pages frame it as `Files`; the draft's edit form frames it as `Supporting files`
 * (§2.3), so both render the same list and field.
 */
export function FilesPanel({ attachments, draftOwnerKey, queueDisabled = false, queueRef, requestId, summary, viewer }: FilesPanelProps) {
  const add = attachments?.meta.add ?? summary;
  const total = attachments?.meta.total ?? summary.count;
  const addsOnDraft = add.canAdd && add.window === 'intake' && !add.needsNote && draftOwnerKey !== null;
  const addsWithNote = add.canAdd && add.needsNote && draftOwnerKey !== null;
  const locked = add.canAdd ? null : filesLockedLine(add.refusal, viewer);
  const LockedIcon = locked ? lockedIcons[locked.icon] : null;
  const empty = filesEmptyState(add.window, viewer, add.canAdd);
  /* §5.1 (UI-D21): for a Security Analyst, what may be included or why nothing can be, once for the section. */
  const aiLine = fileAiSectionLine(attachments?.meta.aiPolicy);
  const AiLineIcon = aiLine?.icon ? aiLineIcons[aiLine.icon] : null;

  return (
    <div className="grid grid-cols-1 gap-4" data-files-panel="">
      {aiLine ? (
        <p className="flex items-start gap-2 text-sm text-foreground-secondary">
          {AiLineIcon ? <AiLineIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" /> : null}
          {aiLine.text}
        </p>
      ) : null}
      {/* The list counts its own files, so its count moves with a change still waiting for Strapi (D6). */}
      {attachments === null && total > 0 ? <p className="text-xs text-foreground-secondary tabular-nums" data-files-count="">{filesCountLabel(total)}</p> : null}
      {attachments === null ? (
        <FilesReadError />
      ) : (
        <FilesList
          attachments={attachments.attachments}
          densityUserId={draftOwnerKey ?? 'files'}
          empty={empty}
          requestId={requestId}
          total={total}
          viewer={viewer}
          {...(attachments.meta.aiPolicy ? { aiPolicy: attachments.meta.aiPolicy } : {})}
        />
      )}
      {locked && LockedIcon ? (
        /* In place of the field, so focus can land here once the last kept row beneath it is removed (§1.4). */
        <p className="flex items-start gap-2 text-sm text-foreground-secondary outline-none" data-files-locked="" tabIndex={-1}>
          <LockedIcon aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          {locked.text}
        </p>
      ) : null}
      {draftOwnerKey !== null ? (
        /*
         * The draft's queue: with its field while Strapi lets the person add files, and without it while the tab keeps
         * files not added for this draft (§1.5; WR-401). A ref only from the client form: a server page passes none.
         */
        <DraftUploadQueue canAdd={addsOnDraft} disabled={queueDisabled} label={filesCopy.addFiles} ownerKey={draftOwnerKey} remaining={add.remaining} requestId={requestId} {...(queueRef ? { ref: queueRef } : {})} />
      ) : null}
      {addsWithNote ? <ComposerHandOffField ownerKey={draftOwnerKey} remaining={add.remaining} requestId={requestId} /> : null}
    </div>
  );
}
