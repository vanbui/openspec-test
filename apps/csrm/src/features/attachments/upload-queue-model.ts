/*
 * The upload queue's model (X-20; 14-UI-SPEC §1.4, §1.5): its rows, its reducer and its count line. Plain, zod-free and
 * copy-light, because the tab's file store (file-store.tsx) applies the reducer and the shell loads that store on every
 * route (performance.spec.ts budgets each route's first load). The feature's words and checks stay in
 * attachments-domain.ts, which re-exports all of this.
 */

/** §8.1: a transfer that failed (network, timeout or 5xx); `Retry` sends the same file. */
export const TRANSFER_FAILED = 'We couldn’t add this file. Try again.';

const count = new Intl.NumberFormat('en-AU');

/*
 * The upload queue (X-20; §1.4). One row per chosen file, in the order chosen: `waiting` until it is sent, `adding`
 * while its Server Action runs, then `added`, `pending` (added, waiting for the malware check), `refused` (Strapi or the
 * browser's checks said no; `Choose another file`) or `failed` (the transfer failed; `Retry` sends the same file).
 * `chosen` is the form's stage before its draft exists (14-14). An added row is `listed` once the Files list it joins
 * has re-rendered, and leaves the rows while the count line still counts it.
 */
export type QueueStage = 'chosen' | 'waiting' | 'adding' | 'added' | 'pending' | 'refused' | 'failed';

export type QueueRow = {
  /** The file's identity in the queue: its name, size and last-modified time (UI-D13). */
  key: string;
  file: File;
  stage: QueueStage;
  /** Why it was not added, in family N's words. */
  message?: string;
  /** `Add with a new note` instead of `Retry` (14-15). */
  offerNewNote?: boolean;
  /** Added, and now shown in the Files list. */
  listed?: boolean;
  /** Kept for the tab and shown again after an in-app navigation (§1.5). */
  restored?: boolean;
  /** Chosen in the Files section and handed to the Notes composer (§4.1; UI-D6). */
  handedOff?: boolean;
};

export type QueueAction =
  | { type: 'add'; rows: QueueRow[] }
  | { type: 'settle'; key: string; stage: QueueStage; message?: string; offerNewNote?: boolean }
  | { type: 'listed' }
  /** `Retry`: the same file waits to be sent again. */
  | { type: 'retry'; key: string }
  /** `Remove from list`: the row and its file leave the queue and the tab's store. */
  | { type: 'remove'; key: string }
  /** `Choose another file`: the replacement takes the row's place. */
  | { type: 'replace'; key: string; row: QueueRow }
  /**
   * The queue shows again after an in-app navigation (§1.5). The Notes composer's chips (`keepChosen`) were never sent,
   * so they stay chosen; any other queue's chosen or waiting file becomes a failed transfer to Retry.
   */
  | { type: 'restore'; keepChosen?: boolean };

export function fileKey(file: Pick<File, 'name' | 'size' | 'lastModified'>): string {
  return `${file.name}\u0000${file.size}\u0000${file.lastModified}`;
}

/** A row waiting to be sent. */
export function waitingRow(file: File): QueueRow {
  return { key: fileKey(file), file, stage: 'waiting' };
}

export function queueReducer(rows: readonly QueueRow[], action: QueueAction): QueueRow[] {
  switch (action.type) {
    case 'add':
      /* A new choice starts a new count: rows already in the Files list leave it. */
      return [...rows.filter((row) => !row.listed), ...action.rows];
    case 'settle':
      return rows.map((row) => row.key === action.key
        ? { key: row.key, file: row.file, stage: action.stage, ...(action.message ? { message: action.message } : {}), ...(action.offerNewNote ? { offerNewNote: true } : {}) }
        : row);
    case 'listed':
      return rows.map((row) => (row.stage === 'added' || row.stage === 'pending') && !row.listed ? { ...row, listed: true } : row);
    case 'retry':
      return rows.map((row) => row.key === action.key ? { key: row.key, file: row.file, stage: 'waiting' } : row);
    case 'remove':
      return rows.filter((row) => row.key !== action.key);
    case 'replace':
      return rows.map((row) => row.key === action.key ? action.row : row);
    case 'restore':
      /*
       * Added files are in the Files list the page now renders. A file left waiting when the person chose to leave was
       * never sent, so it is kept as a failed transfer to Retry; one still being added settles where it stands.
       */
      return rows.flatMap((row): QueueRow[] => {
        if (row.stage === 'added' || row.stage === 'pending') return [];
        if (row.stage === 'adding') return [row];
        if (row.stage === 'chosen' && action.keepChosen) return [{ key: row.key, file: row.file, stage: 'chosen', restored: true }];
        if (row.stage === 'waiting' || row.stage === 'chosen') return [{ key: row.key, file: row.file, stage: 'failed', message: TRANSFER_FAILED, restored: true }];
        return [{ ...row, restored: true }];
      });
    default:
      return [...rows];
  }
}

const isAdded = (row: QueueRow) => row.stage === 'added' || row.stage === 'pending';
const isNotAdded = (row: QueueRow) => row.stage === 'refused' || row.stage === 'failed';

/** §1.4: the count line, `{a} of {n} files added`, then ` · {k} not added` when above zero; the queue's only announcement. */
export function queueCountLine(rows: readonly QueueRow[]): string {
  const added = rows.filter(isAdded).length;
  const notAdded = rows.filter(isNotAdded).length;
  const line = `${count.format(added)} of ${count.format(rows.length)} files added`;
  return notAdded > 0 ? `${line} · ${count.format(notAdded)} not added` : line;
}

/**
 * A row the queue still shows: everything but an added row the Files list now carries. A file waiting for the malware
 * check stays, because what it says (nobody can download it yet) is not in the list's row.
 */
export function shownInQueue(row: QueueRow): boolean {
  return !(row.listed && row.stage === 'added');
}

/** Whether a row takes a place the request's count does not show yet: chosen, sent or to be sent, and not yet listed. */
export function holdsRoom(row: QueueRow): boolean {
  return (row.stage === 'chosen' || row.stage === 'waiting' || row.stage === 'adding' || row.stage === 'added' || row.stage === 'pending') && !row.listed;
}

/** How a queue settled once nothing is waiting or being added: what the form decides from after `Save draft` (§2.2). */
export type QueueSettlement = { added: number; pending: number; notAdded: number };

export function queueSettlement(rows: readonly QueueRow[]): QueueSettlement {
  return {
    added: rows.filter((row) => row.stage === 'added').length,
    pending: rows.filter((row) => row.stage === 'pending').length,
    notAdded: rows.filter(isNotAdded).length,
  };
}
