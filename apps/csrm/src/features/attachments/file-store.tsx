'use client';

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { useUnloadWarning } from '@/components/csrm/use-unload-warning';

import { queueReducer, type QueueAction, type QueueRow } from './upload-queue-model';

/*
 * The tab's in-memory file store (14-UI-SPEC §1.5, §4.3; UI-D10, UI-D35; X-20). It holds each upload queue's rows,
 * keyed `{ownerKey}:{requestId}:{scope}`, in React state above the request
 * routes, so an in-app navigation away and back never drops a file not yet added. `File` objects live only in memory:
 * nothing here writes a file to any browser storage (T-14-44), so a reload, a closed tab or signing out
 * clears them. While it keeps any file not added, or one waiting or being added, the browser's own `beforeunload`
 * prompt is armed on every page in the tab; in-app links never ask, because they lose nothing.
 *
 * The scopes: `draft`, the draft's queue; `composer`, the files chosen in the Notes composer and not yet posted (§4.1,
 * §4.3); and `note:{noteId}`, a posted note's files on their way (§4.2). Posting moves the composer's files to the note's
 * scope, and `Add with a new note` moves a file back (UI-D9).
 *
 * The shell mounts it in its authorised branch and every route loads it, so it stays as small as it can
 * (performance.spec.ts).
 */

export type QueueScope = 'draft' | 'composer' | `note:${string}`;

type StoreValue = {
  queues: ReadonlyMap<string, readonly QueueRow[]>;
  dispatch: (key: string, action: QueueAction) => void;
  forgetOtherOwners: (ownerKey: string) => void;
};

const AttachmentFileStoreContext = createContext<StoreValue | null>(null);

const EMPTY: readonly QueueRow[] = [];

const storeKey = (ownerKey: string, requestId: string, scope: QueueScope) => `${ownerKey}:${requestId}:${scope}`;

const keeps = (row: QueueRow) => row.stage !== 'added' && row.stage !== 'pending';
const inFlight = (row: QueueRow) => row.stage === 'waiting' || row.stage === 'adding';

export function AttachmentFileStoreProvider({ children }: { children: ReactNode }) {
  const [queues, setQueues] = useState<ReadonlyMap<string, readonly QueueRow[]>>(() => new Map());

  const dispatch = useCallback((key: string, action: QueueAction) => {
    setQueues((current) => {
      const next = queueReducer(current.get(key) ?? EMPTY, action);
      /* Nothing kept and nothing to keep: the store, and every page under it, stays as it is. */
      if (next.length === 0 && !current.has(key)) return current;
      const updated = new Map(current);
      if (next.length === 0) updated.delete(key);
      else updated.set(key, next);
      return updated;
    });
  }, []);

  /* A different person signed in on this tab (a role switch, an expired session) never sees, or keeps, another's files. */
  const forgetOtherOwners = useCallback((ownerKey: string) => {
    setQueues((current) => {
      const kept = [...current].filter(([key]) => key.startsWith(`${ownerKey}:`));
      return kept.length === current.size ? current : new Map(kept);
    });
  }, []);

  const holdsFiles = useMemo(() => [...queues.values()].some((rows) => rows.some(keeps)), [queues]);
  useUnloadWarning(holdsFiles);

  const value = useMemo(() => ({ queues, dispatch, forgetOtherOwners }), [queues, dispatch, forgetOtherOwners]);
  return <AttachmentFileStoreContext value={value}>{children}</AttachmentFileStoreContext>;
}

/**
 * One queue's rows and its dispatcher. Without a provider (a page outside the shell) the rows live in the component
 * itself, so the queue still works and only the keeping across navigation is lost.
 */
export function useAttachmentQueue(ownerKey: string, requestId: string, scope: QueueScope): [readonly QueueRow[], (action: QueueAction) => void, StoreValue['forgetOtherOwners']] {
  const store = useContext(AttachmentFileStoreContext);
  const [local, setLocal] = useState<readonly QueueRow[]>(EMPTY);
  const key = storeKey(ownerKey, requestId, scope);
  const storeDispatch = store?.dispatch;
  const dispatch = useCallback((action: QueueAction) => {
    if (storeDispatch) storeDispatch(key, action);
    else setLocal((current) => queueReducer(current, action));
  }, [key, storeDispatch]);
  const forget = store?.forgetOtherOwners ?? noop;
  return [store ? store.queues.get(key) ?? EMPTY : local, dispatch, forget];
}

function noop(): void {}

/** A queue's rows as the store holds them, read only: none without a provider. */
export function useQueueRows(ownerKey: string, requestId: string, scope: QueueScope): readonly QueueRow[] {
  return useContext(AttachmentFileStoreContext)?.queues.get(storeKey(ownerKey, requestId, scope)) ?? EMPTY;
}

/**
 * Changes any queue of the person's request: the thread puts a posted note's files in its scope, and `Add with a new
 * note` moves a file to the composer. Without a provider nothing is kept, so nothing changes.
 */
export function useFileStoreDispatch(ownerKey: string, requestId: string): (scope: QueueScope, action: QueueAction) => void {
  const dispatch = useContext(AttachmentFileStoreContext)?.dispatch;
  return useCallback((scope: QueueScope, action: QueueAction) => dispatch?.(storeKey(ownerKey, requestId, scope), action), [dispatch, ownerKey, requestId]);
}

/** How many files on the request are waiting or being added, in any of its queues: the submit dialog waits (UI-D5). */
export function useFilesInFlight(ownerKey: string, requestId: string): number {
  const queues = useContext(AttachmentFileStoreContext)?.queues;
  const prefix = `${ownerKey}:${requestId}:`;
  if (!queues) return 0;
  return [...queues].reduce((total, [key, rows]) => key.startsWith(prefix) ? total + rows.filter(inFlight).length : total, 0);
}

/** The files a queue keeps for the tab: refused, or failed and awaiting `Retry` (§1.5). */
export function useKeptFiles(ownerKey: string, requestId: string, scope: QueueScope): readonly QueueRow[] {
  const rows = useQueueRows(ownerKey, requestId, scope);
  return rows.filter((row) => row.stage === 'refused' || row.stage === 'failed');
}
