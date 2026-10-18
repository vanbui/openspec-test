import { RecordLink } from '@/components/csrm/record-link';

/*
 * `CONTEXT_TOO_LARGE` with files (14-UI-SPEC §7.2; D-33): when a generation was refused because the files included in
 * the AI inputs hold more text than CSRM can send at once, the job card says so and names the files, each a record link
 * to its row on the analyst's request page, so the analyst can exclude one and try again. Without files, Phase 12's copy
 * stands (12 §11.2). Server-safe (no directive, no zod), so either job card, client or server, can render it.
 */

/** A file the failure counted, named as it is now (null when its record is gone; 14-10). */
export type ContextTooLargeFile = { documentId: string; fileName: string | null };

export const contextTooLargeFilesCopy = {
  sentence: 'The files included in the AI inputs hold more text than CSRM can send at once, so nothing was sent. Exclude a file, then try again.',
  listName: 'Files included in the AI inputs',
  unnamed: 'A file no longer on this request',
} as const;

/** Whether a job failure names the files that made the context too large (§7.2); otherwise Phase 12's copy stands. */
export function contextTooLargeFilesOf(failure: { failureCode: string; failureAttachments?: readonly ContextTooLargeFile[] | undefined }): readonly ContextTooLargeFile[] | null {
  return failure.failureCode === 'CONTEXT_TOO_LARGE' && failure.failureAttachments && failure.failureAttachments.length > 0 ? failure.failureAttachments : null;
}

function fileHref(requestId: string, fileId: string): string {
  return `/app/review/requests/${encodeURIComponent(requestId)}#file-${encodeURIComponent(fileId)}`;
}

/** §7.2's sentence and list; `withSentence={false}` renders the list alone, beside a served notes sentence (D-29). */
export function ContextTooLargeFiles({ files, requestId, withSentence = true }: { files: readonly ContextTooLargeFile[]; requestId: string; withSentence?: boolean }) {
  return (
    <>
      {withSentence ? <p>{contextTooLargeFilesCopy.sentence}</p> : null}
      <ul aria-label={contextTooLargeFilesCopy.listName} className="mt-1 grid gap-1">
        {files.map((file) => (
          // The name is React text, never markup; the link is built from ids only.
          <li className="[overflow-wrap:anywhere]" key={file.documentId}>
            {file.fileName ? <RecordLink href={fileHref(requestId, file.documentId)}>{file.fileName}</RecordLink> : contextTooLargeFilesCopy.unnamed}
          </li>
        ))}
      </ul>
    </>
  );
}

/*
 * `CONTEXT_TOO_LARGE` on every job surface (15-UI-SPEC §13, the amendment of 2026-10-11; Phase 15 D-29, carried from
 * Phase 13). Strapi's failure message for this code is CSRM's own sentence built from counts and note numbers, and only
 * its forms that name marked notes carry this phrase (15-04 pins it), so the phrase alone says the notes caused it.
 */
const MARKED_NOTES_PHRASE = 'marked as changing the AI inputs';

export function contextTooLargeNamesMarkedNotes(message: string | null | undefined): boolean {
  return typeof message === 'string' && message.includes(MARKED_NOTES_PHRASE);
}

export type ContextTooLargeJobFailure = {
  failureCode: string | null;
  failureMessage: string | null;
  failureAttachments?: readonly ContextTooLargeFile[] | undefined;
};

/**
 * One rendering of a CONTEXT_TOO_LARGE failure, for the hub's two cards, the AI proposals panel and the hub's proposal
 * job: (a) the served notes sentence as text, then the files list without §7.2's sentence when files are named; (b) §7.2
 * unchanged when only files are named; (c) otherwise the surface's administrator sentence (`fallback`). A served message
 * that names no marked note is never shown.
 */
export function ContextTooLargeFailure({ failure, requestId, fallback }: { failure: ContextTooLargeJobFailure; requestId: string; fallback: string }) {
  const files = failure.failureAttachments && failure.failureAttachments.length > 0 ? failure.failureAttachments : null;
  if (failure.failureMessage !== null && contextTooLargeNamesMarkedNotes(failure.failureMessage)) {
    return (
      <>
        {/* React text, never markup: the sentence is the server's, shown as it is. */}
        <p>{failure.failureMessage}</p>
        {files ? <ContextTooLargeFiles files={files} requestId={requestId} withSentence={false} /> : null}
      </>
    );
  }
  if (files) return <ContextTooLargeFiles files={files} requestId={requestId} />;
  return <p>{fallback}</p>;
}
