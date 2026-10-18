'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { useUnloadWarning } from '@/components/csrm/use-unload-warning';
import { Button } from '@/components/ui/button';
import { successToast } from '@/components/ui/success-toast';
import { toastAction } from '@/components/ui/toast-action';

import { noteFilesCopy, unsentWellCopy } from './notes-domain';

/*
 * The read-only well under the §8.4 closed line (13-UI-SPEC §9.4; D-22; UI-D19; X-16): note text that was being written
 * when the window closed, so it is never lost. The text is React text only, on `--color-bg-inset`, with line breaks
 * kept. `Copy text` puts it on the clipboard; `Discard text` removes it at once with an X-14 Undo toast, and `Undo`
 * puts it back and focuses `Copy text`. The thread owns the session store and the closed line (`onDiscard`,
 * `onRestore`). The well is not part of the record, so it does not print.
 *
 * With files chosen for the note and not yet posted (14-UI-SPEC §4.3; UI-D10), the well lists their names beneath the
 * text, and `Discard text` reads `Discard note`: it discards the text and the files together under the same Undo toast,
 * whose `Undo` brings both back. The thread keeps the files in the tab's memory.
 */

export type UnsentNoteWellProps = {
  text: string;
  /** The names of the files chosen for the note and not yet posted (§4.3). */
  files?: readonly string[];
  /** Called when the person discards the text: the thread clears the kept draft and focuses the closed line. */
  onDiscard: () => void;
  /** Called when `Undo` puts the text back: the thread keeps it in the session store again. */
  onRestore: (text: string) => void;
};

export function UnsentNoteWell({ files = [], onDiscard, onRestore, text }: UnsentNoteWellProps) {
  const [shown, setShown] = useState(true);
  const body = useRef<HTMLParagraphElement>(null);
  const copyButton = useRef<HTMLButtonElement>(null);
  const discardButton = useRef<HTMLButtonElement>(null);
  /* Set by Undo, so focus reaches the well's first action once it is back: Copy text, or Discard note with no text (IN-504). */
  const focusAfterRestore = useRef(false);
  /* UI-D18 (IN-304): closing the tab is the only way the shown text is lost, so the browser asks while it shows. */
  useUnloadWarning(shown);

  useEffect(() => {
    if (!shown || !focusAfterRestore.current) return;
    focusAfterRestore.current = false;
    (copyButton.current ?? discardButton.current)?.focus();
  }, [shown]);

  /* A browser that refuses the clipboard: the text is selected, so the person can copy it themselves. */
  function selectText() {
    const element = body.current;
    const selection = window.getSelection();
    if (!element || !selection) return;
    const range = document.createRange();
    range.selectNodeContents(element);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      selectText();
      /* UI-04: the text is selected, so nothing needs recovering; danger is kept for rollbacks (13-UI-SPEC Color). */
      toast(unsentWellCopy.copyFailed, { description: unsentWellCopy.copyFailedHint });
      return;
    }
    successToast(unsentWellCopy.copied);
  }

  /* IN-504 (14-UI-SPEC §9): a note that had files is discarded and restored as a note, not as its text. */
  function restore(hadFiles: boolean) {
    focusAfterRestore.current = true;
    setShown(true);
    onRestore(text);
    successToast(hadFiles ? unsentWellCopy.noteRestored : unsentWellCopy.restored);
  }

  function discard() {
    const hadFiles = files.length > 0;
    setShown(false);
    onDiscard();
    successToast(hadFiles ? unsentWellCopy.noteDiscarded : unsentWellCopy.discarded, { action: toastAction(unsentWellCopy.undo, () => restore(hadFiles)) });
  }

  if (!shown) return null;
  return (
    <div className="grid gap-2 rounded-md bg-surface-muted p-4" data-print="hidden">
      {text ? <p className="text-sm text-foreground whitespace-pre-wrap [overflow-wrap:anywhere]" data-unsent-note="" ref={body}>{text}</p> : null}
      {files.length > 0 ? (
        <ul aria-label={noteFilesCopy.chipsName} className="grid gap-1">
          {files.map((name, index) => <li className="text-sm text-foreground [overflow-wrap:anywhere]" key={`${index}-${name}`}>{name}</li>)}
        </ul>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {text ? <Button className="max-md:min-h-11" onClick={() => void copy()} ref={copyButton} size="sm" type="button" variant="ghost">{unsentWellCopy.copy}</Button> : null}
        <Button className="max-md:min-h-11" onClick={discard} ref={discardButton} size="sm" type="button" variant="ghost">{files.length > 0 ? unsentWellCopy.discardNote : unsentWellCopy.discard}</Button>
      </div>
    </div>
  );
}
