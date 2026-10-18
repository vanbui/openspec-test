'use client';

import { composerChips, fileFieldHint, filesCopy, holdsRoom } from './attachments-domain';
import { FileField } from './file-field';
import { useFileStoreDispatch, useQueueRows } from './file-store';

/*
 * The Files section's field after submission (14-UI-SPEC §3.6, §4.1; D-17, D-27; UI-D6). Every file now travels with a
 * note, so `Add files with a note` sends nothing itself: files chosen or dropped here are checked as the queue checks
 * them (§1.3) and join the Notes composer's chips in the tab's file store. The page then scrolls to the composer and its
 * textarea takes focus, where a caption says to write what the files are; the composer posts the note, then the files.
 */

export type ComposerHandOffFieldProps = {
  ownerKey: string;
  requestId: string;
  /** How many more files the request can take, from Strapi's add facts. */
  remaining: number;
};

export function ComposerHandOffField({ ownerKey, remaining, requestId }: ComposerHandOffFieldProps) {
  const chips = useQueueRows(ownerKey, requestId, 'composer');
  const toFileStore = useFileStoreDispatch(ownerKey, requestId);
  const room = Math.max(0, remaining - chips.filter(holdsRoom).length);

  function handOff(files: File[]) {
    const checked = composerChips(files, chips, remaining);
    if (checked.length === 0) return;
    toFileStore('composer', { type: 'add', rows: checked.map((row) => ({ ...row, handedOff: true })) });
    /*
     * On the next tick: once the chips have rendered, and after the browser has handed focus back to `Choose files` as
     * its chooser closed, so the composer keeps it.
     */
    window.setTimeout(() => {
      const field = document.getElementById('note-composer');
      if (!field) return;
      if (typeof field.scrollIntoView === 'function') field.scrollIntoView({ block: 'center' });
      field.focus({ preventScroll: true });
    }, 0);
  }

  return <FileField hint={fileFieldHint(room)} label={filesCopy.addFilesWithNote} lead={filesCopy.withNoteLine} onFiles={handOff} />;
}
