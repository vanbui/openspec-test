/*
 * The shared save-bytes helper (Phase 14 D-24; 14-UI-SPEC §3.3; Phase 19 reuses it for its exports). Client-only use:
 * it hands bytes the server has already checked (`validateFileResponse`) to the browser's own download, as a Blob of
 * their checked type behind an anchor with `download`, so the file is saved and never opened inline (T-14-46). The
 * Blob's URL is let go a minute later, once per call (IN-405): WebKit fails a blob download whose URL is revoked before
 * it has read the blob, which a 25 MB file on a phone can take a while to do, and a minute later nothing leaks.
 *
 * Plain TypeScript with no directive and no zod. Phase 19's exports, import templates and error reports are saved through
 * it too; the import's own CSV download helper is gone, since Strapi builds every file the import offers.
 */

export type SavedFile = {
  /** The name the server's check accepted. */
  readonly fileName: string;
  /** The media type the server's check accepted. */
  readonly contentType: string;
  readonly bytes: Uint8Array;
};

/** How long a saved file's Blob URL is kept before it is let go (IN-405; FileSaver.js keeps its URL 40 seconds). */
const OBJECT_URL_LIFETIME_MS = 60_000;

export function saveFile({ bytes, contentType, fileName }: SavedFile): void {
  const url = URL.createObjectURL(new Blob([bytes as Uint8Array<ArrayBuffer>], { type: contentType }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.click();
  window.setTimeout(() => URL.revokeObjectURL(url), OBJECT_URL_LIFETIME_MS);
}
