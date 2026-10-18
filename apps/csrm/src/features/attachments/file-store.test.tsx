import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ uploadAttachmentAction: vi.fn(), refresh: vi.fn() }));
vi.mock('./attachments-actions', () => ({ uploadAttachmentAction: mocks.uploadAttachmentAction, downloadAttachmentAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));

import { NoteComposer } from '@/features/request-notes/note-composer';

import { AttachmentFileStoreProvider, useFilesInFlight } from './file-store';
import { UploadQueue } from './upload-queue';

function InFlight({ ownerKey }: { ownerKey: string }) {
  return <span data-testid="in-flight">{useFilesInFlight(ownerKey, 'req-1')}</span>;
}

/** The request page with its queue, or another page of the app: the provider stays, as the shell's does. */
function app(props: { showQueue: boolean; ownerKey?: string }) {
  const ownerKey = props.ownerKey ?? 'owner-jane';
  return (
    <AttachmentFileStoreProvider>
      {props.showQueue ? <UploadQueue label="Add files" ownerKey={ownerKey} remaining={20} requestId="req-1" scope="draft" /> : <p>My requests</p>}
      <InFlight ownerKey={ownerKey} />
    </AttachmentFileStoreProvider>
  );
}

const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf', lastModified: 1 });

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

/*
 * IN-604: IndexedDB, the third web store, as a spy. jsdom has none, so a store that reached for it would call this
 * stand-in, and the tests assert it never does.
 */
function stubIndexedDb() {
  const indexedDb = { open: vi.fn(), deleteDatabase: vi.fn(), databases: vi.fn(async () => []) };
  vi.stubGlobal('indexedDB', indexedDb);
  return indexedDb;
}

/* 14-UI-SPEC §1.5 (UI-D35; X-20): files not added are kept in the tab's memory and return where they were listed. */
describe('the tab’s file store (§1.5)', () => {
  async function keptRows() {
    mocks.uploadAttachmentAction
      .mockResolvedValueOnce({ ok: false, kind: 'refused', offerNewNote: false, message: 'This file is empty. Check it’s the file you meant and choose it again.' })
      .mockRejectedValueOnce(new Error('network'));
    const view = render(app({ showQueue: true }));
    await userEvent.setup().upload(screen.getByLabelText('Add files'), [pdf('empty.pdf'), pdf('pack.pdf')]);
    await screen.findByRole('button', { name: 'Retry pack.pdf' });
    return view;
  }

  it('keeps a refused and a failed file across an in-app navigation away and back, with their reasons and actions', async () => {
    const view = await keptRows();
    expect(screen.queryByText('Restored from earlier in this session.')).toBeNull();
    view.rerender(app({ showQueue: false }));
    expect(screen.queryByRole('list', { name: 'Files being added' })).toBeNull();
    view.rerender(app({ showQueue: true }));
    expect(await screen.findByText('Restored from earlier in this session.')).toBeInTheDocument();
    const rows = within(screen.getByRole('list', { name: 'Files being added' })).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent('Not added. This file is empty. Check it’s the file you meant and choose it again.');
    expect(within(rows[1]!).getByRole('button', { name: 'Retry pack.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('0 of 2 files added · 2 not added');
  });

  it('keeps nothing for another person signed in on the same tab', async () => {
    const view = await keptRows();
    view.rerender(app({ showQueue: false }));
    view.rerender(app({ showQueue: true, ownerKey: 'owner-bob' }));
    expect(screen.queryByRole('list', { name: 'Files being added' })).toBeNull();
    expect(screen.queryByText('Restored from earlier in this session.')).toBeNull();
  });

  it('clears a kept file once Retry adds it', async () => {
    const view = await keptRows();
    view.rerender(app({ showQueue: false }));
    view.rerender(app({ showQueue: true }));
    mocks.uploadAttachmentAction.mockResolvedValueOnce({
      ok: true,
      data: {
        documentId: 'att-1', fileName: 'pack.pdf', fileType: 'pdf', byteSize: 4, state: 'available', uploadedBy: null, uploaderPart: 'requestor',
        uploadedAt: '2026-10-10T01:00:00.000Z', note: null, removedBy: null, removedAt: null, detection: null, actions: { download: true, remove: true, restore: false },
      },
    });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Retry pack.pdf' }));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 2 files added · 1 not added'));
  });

  it('counts the files waiting or being added on the request, for the submit dialog (UI-D5)', async () => {
    const settles: ((value: unknown) => void)[] = [];
    mocks.uploadAttachmentAction.mockImplementation(() => new Promise((resolve) => settles.push(resolve)));
    render(app({ showQueue: true }));
    await userEvent.setup().upload(screen.getByLabelText('Add files'), [pdf('one.pdf'), pdf('two.pdf'), pdf('three.pdf')]);
    await waitFor(() => expect(settles).toHaveLength(1));
    expect(screen.getByTestId('in-flight')).toHaveTextContent('3');
    await act(async () => settles[0]!({ ok: false, kind: 'refused', offerNewNote: false, message: 'This file is empty. Check it’s the file you meant and choose it again.' }));
    await waitFor(() => expect(screen.getByTestId('in-flight')).toHaveTextContent('2'));
  });

  it('keeps them in the tab’s memory only: nothing is written to sessionStorage, localStorage or IndexedDB (IN-604)', async () => {
    const indexedDb = stubIndexedDb();
    const view = await keptRows();
    view.rerender(app({ showQueue: false }));
    view.rerender(app({ showQueue: true }));
    expect(await screen.findByText('Restored from earlier in this session.')).toBeInTheDocument();
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    expect(indexedDb.open).not.toHaveBeenCalled();
    expect(indexedDb.deleteDatabase).not.toHaveBeenCalled();
  });

  it('warns before the tab closes or reloads while it keeps a file not added', async () => {
    await keptRows();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
});

/*
 * 14-UI-SPEC §4.3 (UI-D10): files chosen in the Notes composer and not yet posted stay in the tab's memory per person and
 * request, come back on return with the composer's caption, arm the browser's warning before the tab closes, and are
 * never written to browser storage.
 */
describe('the composer’s files kept for the tab (§4.3; UI-D10)', () => {
  function requestPage(props: { showComposer: boolean; ownerKey?: string }) {
    return (
      <AttachmentFileStoreProvider>
        {props.showComposer
          ? <NoteComposer attach={{ remaining: 19 }} draftOwnerKey={props.ownerKey ?? 'owner-jane'} hint="Notes hint" onSubmit={vi.fn(async () => null)} requestId="req-1" />
          : <p>My requests</p>}
      </AttachmentFileStoreProvider>
    );
  }

  async function attachPack() {
    const view = render(requestPage({ showComposer: true }));
    await userEvent.setup().upload(document.getElementById('note-composer-files') as HTMLInputElement, pdf('pack.pdf'));
    return view;
  }

  afterEach(() => {
    window.sessionStorage.clear();
    window.localStorage.clear();
  });

  it('keeps chosen files across an in-app navigation away and back, under Restored from earlier in this session.', async () => {
    const view = await attachPack();
    expect(screen.queryByText('Restored from earlier in this session.')).toBeNull();
    view.rerender(requestPage({ showComposer: false }));
    expect(screen.queryByRole('list', { name: 'Files to add with this note' })).toBeNull();
    view.rerender(requestPage({ showComposer: true }));
    expect(await screen.findByText('Restored from earlier in this session.')).toBeInTheDocument();
    const chip = within(screen.getByRole('list', { name: 'Files to add with this note' })).getByRole('listitem');
    expect(chip).toHaveTextContent('pack.pdf');
    expect(within(chip).getByRole('button', { name: 'Remove pack.pdf from the list' })).toBeInTheDocument();
  });

  it('keeps nothing for another person signed in on the same tab', async () => {
    const view = await attachPack();
    view.rerender(requestPage({ showComposer: false }));
    view.rerender(requestPage({ showComposer: true, ownerKey: 'owner-bob' }));
    expect(screen.queryByRole('list', { name: 'Files to add with this note' })).toBeNull();
    expect(screen.queryByText('Restored from earlier in this session.')).toBeNull();
  });

  it('warns before the tab closes or reloads while the composer holds a file', async () => {
    await attachPack();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });

  it('writes nothing about the files to browser storage: not sessionStorage, localStorage or IndexedDB (IN-604)', async () => {
    const indexedDb = stubIndexedDb();
    const view = await attachPack();
    view.rerender(requestPage({ showComposer: false }));
    view.rerender(requestPage({ showComposer: true }));
    expect(await screen.findByText('Restored from earlier in this session.')).toBeInTheDocument();
    expect(window.sessionStorage.length).toBe(0);
    expect(window.localStorage.length).toBe(0);
    expect(indexedDb.open).not.toHaveBeenCalled();
    expect(indexedDb.deleteDatabase).not.toHaveBeenCalled();
  });
});

/*
 * The shell loads the store on every route (performance.spec.ts budgets each route's first load). That it reaches the
 * queue's plain model only, never the feature's words, its checks or the refusal copy they read, is a module-graph check
 * in the boundary guard (lib/performance/zod-client-boundary.test.ts; IN-604), which follows every value import.
 */
