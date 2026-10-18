import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { NoteActionResult } from './notes-actions';
import type { RequestNote, RequestNotesPage } from './notes-domain';

const mocks = vi.hoisted(() => ({
  addRequestNoteAction: vi.fn(),
  listRequestNotesAction: vi.fn(),
  markRequestNotesReadAction: vi.fn(),
  refresh: vi.fn(),
  successToast: vi.fn(),
}));
vi.mock('./notes-actions', () => ({
  addRequestNoteAction: mocks.addRequestNoteAction,
  listRequestNotesAction: mocks.listRequestNotesAction,
  markRequestNotesReadAction: mocks.markRequestNotesReadAction,
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
/* 14-15: each note's files (chips and their queue) reach the attachments Server Actions, which only the server runs. */
vi.mock('@/features/attachments/attachments-actions', () => ({ downloadAttachmentAction: vi.fn(), uploadAttachmentAction: vi.fn() }));
vi.mock('@/components/ui/success-toast', () => ({ successToast: mocks.successToast }));

import { TimeZoneProvider } from '@/components/csrm/local-time';
import { NotesThread, type NotesThreadProps } from './notes-thread';

const RAR = 'RAR-2026-0001';
const jane = { documentId: 'u-jane', displayName: 'Jane Doe' };
const bob = { documentId: 'u-bob', displayName: 'Bob Doe' };

function note(sequence: number, overrides: Partial<RequestNote> = {}): RequestNote {
  return {
    documentId: `n${sequence}`, sequence, body: `Note ${sequence}`, authorPart: 'requestor', author: jane,
    postedAt: `2026-10-01T0${sequence % 10}:00:00.000Z`, unread: false, ...overrides,
  };
}

/* An IntersectionObserver jsdom lacks: it records what it watches and reports intersections on demand. */
class TestIntersectionObserver {
  static readonly instances: TestIntersectionObserver[] = [];
  readonly targets = new Set<Element>();
  constructor(private readonly callback: IntersectionObserverCallback) {
    TestIntersectionObserver.instances.push(this);
  }
  observe(target: Element) { this.targets.add(target); }
  unobserve(target: Element) { this.targets.delete(target); }
  disconnect() { this.targets.clear(); }
  takeRecords() { return []; }
  static intersect(target: Element) {
    for (const observer of TestIntersectionObserver.instances) {
      if (!observer.targets.has(target)) continue;
      observer.callback([{ target, isIntersecting: true, intersectionRatio: 1 } as unknown as IntersectionObserverEntry], observer as unknown as IntersectionObserver);
    }
  }
  static watching(): Element[] {
    return TestIntersectionObserver.instances.flatMap((observer) => [...observer.targets]);
  }
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function thread(props: Partial<NotesThreadProps> = {}) {
  const all: NotesThreadProps = {
    requestId: 'request-1', requestNumber: RAR, viewer: 'requestor', viewerPart: 'requestor',
    accepting: true, closedReason: null, notes: [note(1), note(2, { authorPart: 'security-analyst', author: bob })],
    ...props,
  };
  return render(<TimeZoneProvider zone="Australia/Sydney"><NotesThread {...all} /></TimeZoneProvider>);
}

beforeEach(() => {
  TestIntersectionObserver.instances.length = 0;
  vi.stubGlobal('IntersectionObserver', TestIntersectionObserver);
  mocks.markRequestNotesReadAction.mockResolvedValue({ ok: true, data: { lastReadSequence: 2, unread: 0 } });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('the notes thread (13-UI-SPEC §8.2, X-16)', () => {
  it('is an ordered list named for the request, oldest first, each note an article with its id', () => {
    thread({ notes: [note(2), note(1), note(3)] });
    const list = screen.getByRole('list', { name: `Notes on ${RAR}` });
    expect(list.tagName).toBe('OL');
    const articles = within(list).getAllByRole('article');
    expect(articles.map((article) => article.id)).toEqual(['note-n1', 'note-n2', 'note-n3']);
  });

  it('marks an unread note New', () => {
    thread({ notes: [note(1), note(2, { unread: true })] });
    const articles = screen.getAllByRole('article');
    expect(within(articles[0]!).queryByText('New')).toBeNull();
    expect(within(articles[1]!).getByText('New')).toBeInTheDocument();
  });

  it('renders markup in a body as text and links nothing (T-13-34)', () => {
    thread({ notes: [note(1, { body: '<b>x</b> https://example.com' })] });
    const article = screen.getByRole('article');
    expect(article.querySelector('b')).toBeNull();
    expect(within(article).queryByRole('link')).toBeNull();
    expect(article.textContent).toContain('<b>x</b> https://example.com');
  });

  it('offers no edit or delete control (D-21)', () => {
    thread();
    expect(screen.queryByRole('button', { name: /edit|delete|remove/i })).toBeNull();
  });

  it('uses no dangerouslySetInnerHTML anywhere in the notes feature', () => {
    for (const file of ['notes-thread.tsx', 'note-item.tsx', 'note-composer.tsx', 'unread-marker.tsx', 'notes-section.tsx']) {
      const source = readFileSync(resolve(process.cwd(), 'src/features/request-notes', file), 'utf8');
      expect(source, file).not.toContain('dangerouslySetInnerHTML');
    }
  });

  it('keeps the thread and composer client modules free of zod', () => {
    for (const file of ['notes-thread.tsx', 'note-composer.tsx']) {
      const source = readFileSync(resolve(process.cwd(), 'src/features/request-notes', file), 'utf8');
      expect(source.startsWith("'use client';"), file).toBe(true);
      expect(source, file).not.toMatch(/from 'zod'|notes-schema/);
    }
  });
});

describe('posting a note (13-UI-SPEC §9.1)', () => {
  it('shows the note at once with Adding…, clears the field and keeps focus, then takes the server’s time and says Note added. once', async () => {
    const user = userEvent.setup();
    const answer = deferred<NoteActionResult<RequestNote>>();
    mocks.addRequestNoteAction.mockReturnValue(answer.promise);
    thread();
    const field = screen.getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement;
    await user.type(field, 'A new note');
    /* WR-501: pressing Add note moves focus to the button, so the field having it afterwards is the composer's doing. */
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(mocks.addRequestNoteAction).toHaveBeenCalledWith({ requestId: 'request-1', body: 'A new note' });
    const pending = screen.getAllByRole('article').at(-1)!;
    expect(pending.textContent).toContain('A new note');
    expect(within(pending).getByText('Adding…')).toBeInTheDocument();
    expect(field.value).toBe('');
    expect(field).toHaveFocus();
    await act(async () => answer.resolve({ ok: true, data: note(3, { body: 'A new note', postedAt: '2026-10-02T03:04:00.000Z' }) }));
    const posted = screen.getAllByRole('article').at(-1)!;
    expect(posted).toHaveAttribute('id', 'note-n3');
    expect(within(posted).queryByText('Adding…')).toBeNull();
    expect(posted.querySelector('time')).toHaveAttribute('dateTime', '2026-10-02T03:04:00.000Z');
    expect(screen.getAllByRole('article')).toHaveLength(3);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('Note added.');
    expect(screen.getAllByText('Note added.')).toHaveLength(1);
  });

  it('on a retryable failure removes the pending note and returns its text with family L’s copy and Try again', async () => {
    const user = userEvent.setup();
    mocks.addRequestNoteAction.mockResolvedValue({ ok: false, kind: 'retryable', message: 'We couldn’t add your note. Try again.' });
    thread();
    const field = screen.getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement;
    await user.type(field, 'Keep this text');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('We couldn’t add your note. Try again.')).toBeInTheDocument();
    expect(field.value).toBe('Keep this text');
    expect(field.selectionStart).toBe('Keep this text'.length);
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(2));
    expect(screen.queryByText('Adding…')).toBeNull();
  });

  it('calls the action once when Add note is pressed again while one is pending', async () => {
    const user = userEvent.setup();
    const answer = deferred<NoteActionResult<RequestNote>>();
    mocks.addRequestNoteAction.mockReturnValue(answer.promise);
    thread();
    const field = screen.getByRole('textbox', { name: 'Add a note' });
    await user.type(field, 'One');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(field, 'Two');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(mocks.addRequestNoteAction).toHaveBeenCalledTimes(1);
    await act(async () => answer.resolve({ ok: true, data: note(3, { body: 'One' }) }));
  });

  it('refreshes the page on a 404, so it shows its own not-found state', async () => {
    const user = userEvent.setup();
    mocks.addRequestNoteAction.mockResolvedValue({ ok: false, kind: 'not-found', message: 'This request is no longer available.' });
    thread();
    await user.type(screen.getByRole('textbox', { name: 'Add a note' }), 'Gone');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
  });
});

describe('the AI-input mark in the thread (13-UI-SPEC §10.1; D-26)', () => {
  it('gives every note the switch and the composer the checkbox when Strapi lets the viewer mark, and sends the mark only when checked', async () => {
    const user = userEvent.setup();
    mocks.addRequestNoteAction.mockResolvedValue({ ok: true, data: note(3, { authorPart: 'security-analyst', author: bob, changesAiInputs: true }) });
    thread({ viewer: 'analyst', viewerPart: 'security-analyst', canMarkAiInputs: true, notes: [note(1, { changesAiInputs: false }), note(2, { changesAiInputs: true })] });
    expect(screen.getAllByRole('switch', { name: 'Changes the AI inputs' })).toHaveLength(2);
    await user.click(screen.getByRole('checkbox', { name: 'Changes the AI inputs' }));
    await user.type(screen.getByRole('textbox', { name: 'Add a note' }), 'Marked from the start');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(mocks.addRequestNoteAction).toHaveBeenCalledWith({ requestId: 'request-1', body: 'Marked from the start', changesAiInputs: true }));
    await waitFor(() => expect(screen.getAllByRole('switch', { name: 'Changes the AI inputs' })).toHaveLength(3));
  });

  /* IN-504: presentation only: the thread offers what canMarkAiInputs says; Strapi omits the mark from a Requestor's read. */
  it('offers no switch and no checkbox when Strapi does not let the viewer mark (the Requestor)', () => {
    thread();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });
});

describe('marking the thread read (13-UI-SPEC §9.2; D-24)', () => {
  it('marks read once, through the newest loaded note, when the first unread note enters the viewport, and keeps New', async () => {
    thread({ notes: [note(1), note(2, { unread: true }), note(3, { unread: true })] });
    expect(mocks.markRequestNotesReadAction).not.toHaveBeenCalled();
    const firstUnread = document.getElementById('note-n2')!;
    expect(TestIntersectionObserver.watching()).toEqual([firstUnread]);
    await act(async () => TestIntersectionObserver.intersect(firstUnread));
    await act(async () => TestIntersectionObserver.intersect(firstUnread));
    expect(mocks.markRequestNotesReadAction).toHaveBeenCalledTimes(1);
    expect(mocks.markRequestNotesReadAction).toHaveBeenCalledWith({ requestId: 'request-1', throughNoteId: 'n3' });
    expect(screen.getAllByText('New')).toHaveLength(2);
  });

  it('never marks read when no note is unread', () => {
    thread();
    expect(TestIntersectionObserver.watching()).toEqual([]);
    expect(mocks.markRequestNotesReadAction).not.toHaveBeenCalled();
  });

  it('shows nothing when marking read fails', async () => {
    mocks.markRequestNotesReadAction.mockRejectedValue(new Error('offline'));
    const { container } = thread({ notes: [note(1, { unread: true })] });
    const before = container.innerHTML;
    await act(async () => TestIntersectionObserver.intersect(document.getElementById('note-n1')!));
    expect(mocks.markRequestNotesReadAction).toHaveBeenCalledTimes(1);
    expect(container.innerHTML).toBe(before);
  });

  it('keeps New for this view when the page re-renders the note as read', async () => {
    const { rerender } = thread({ notes: [note(1, { unread: true })] });
    await act(async () => TestIntersectionObserver.intersect(document.getElementById('note-n1')!));
    rerender(<TimeZoneProvider zone="Australia/Sydney"><NotesThread accepting closedReason={null} notes={[note(1)]} requestId="request-1" requestNumber={RAR} viewer="requestor" viewerPart="requestor" /></TimeZoneProvider>);
    expect(screen.getByText('New')).toBeInTheDocument();
    expect(mocks.markRequestNotesReadAction).toHaveBeenCalledTimes(1);
  });
});

describe('where notes are closed (13-UI-SPEC §8.4; D-22)', () => {
  it.each([
    ['not-submitted', 'requestor', 'You can add notes once you submit this request.'],
    ['returned-to-draft', 'requestor', 'Notes are paused while this request is a draft. Resubmit it to add a note.'],
    ['returned-to-draft', 'analyst', 'Notes are paused while this request is a draft.'],
    ['released', 'requestor', 'Notes closed when the assessment was released. They stay here as part of the record.'],
    ['released', 'analyst', 'Notes closed when the assessment was released. They stay here as part of the record.'],
  ] as const)('replaces the composer with the %s line for the %s, with a 16px Lock, and keeps the notes', (closedReason, viewer, line) => {
    thread({ accepting: false, closedReason, viewer, viewerPart: viewer === 'requestor' ? 'requestor' : 'security-analyst' });
    const closed = screen.getByText(line);
    expect(closed).toHaveClass('text-sm', 'text-foreground-secondary');
    expect(closed).toHaveAttribute('tabindex', '-1');
    const lock = closed.querySelector('svg');
    expect(lock).toHaveAttribute('aria-hidden', 'true');
    expect(lock).toHaveClass('size-4');
    expect(screen.queryByRole('textbox', { name: 'Add a note' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add note' })).toBeNull();
    expect(screen.getAllByRole('article')).toHaveLength(2);
  });
});

describe('an empty thread (13-UI-SPEC §8.5)', () => {
  it('tells the Requestor what a note is for, and the composer is the call to action', () => {
    thread({ notes: [] });
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
    expect(screen.getByText('Add a note if something about this request changes, or to answer a Security Analyst’s question.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toBeInTheDocument();
    expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Add note']);
  });

  it('tells an analyst what a note is for', () => {
    thread({ notes: [], viewer: 'analyst', viewerPart: 'security-analyst' });
    expect(screen.getByText('No notes yet')).toBeInTheDocument();
    expect(screen.getByText('Add a note to ask the Requestor for more information or to record what you’ve learned.')).toBeInTheDocument();
  });

  it('reads No notes above the closed line when the window is closed', () => {
    thread({ notes: [], accepting: false, closedReason: 'released' });
    const empty = screen.getByText('No notes');
    const line = screen.getByText('Notes closed when the assessment was released. They stay here as part of the record.');
    expect(empty.compareDocumentPosition(line) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByText('No notes yet')).toBeNull();
  });
});

describe('a failed notes read (13-UI-SPEC §8.6)', () => {
  it('says the notes could not load, offers Try again, and keeps the composer so nothing is lost', async () => {
    const user = userEvent.setup();
    thread({ notes: null });
    expect(screen.getByText('We couldn’t load the notes')).toBeInTheDocument();
    expect(screen.queryByText('No notes yet')).toBeNull();
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });

  it('shows no composer when the request takes no note', () => {
    thread({ notes: null, accepting: false, closedReason: 'released' });
    expect(screen.getByText('We couldn’t load the notes')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a note' })).toBeNull();
    expect(screen.getByText('Notes closed when the assessment was released. They stay here as part of the record.')).toBeInTheDocument();
  });
});

describe('earlier notes (13-UI-SPEC §8.2)', () => {
  const newest = Array.from({ length: 20 }, (_, index) => note(26 + index));
  const earlier = Array.from({ length: 20 }, (_, index) => note(6 + index));

  function earlierPage(notes: RequestNote[]): NoteActionResult<RequestNotesPage> {
    return { ok: true, data: { notes, meta: { total: 45, unread: 0, lastReadSequence: 45, hasEarlier: true, accepting: true, closedReason: null, viewerPart: 'requestor', canMarkAiInputs: false } } };
  }

  it('loads the previous 20 above, focuses the first inserted note, and counts what remains', async () => {
    const user = userEvent.setup();
    const answer = deferred<NoteActionResult<RequestNotesPage>>();
    mocks.listRequestNotesAction.mockReturnValue(answer.promise);
    thread({ notes: newest });
    const button = screen.getByRole('button', { name: 'Show earlier notes (25)' });
    expect(button).toHaveAttribute('data-print', 'hidden');
    expect(button.compareDocumentPosition(screen.getByRole('list')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    await user.click(button);
    /* IN-305: the page's own size, not Strapi's default. */
    expect(mocks.listRequestNotesAction).toHaveBeenCalledWith({ requestId: 'request-1', before: 26, limit: 20 });
    const loading = screen.getByRole('button', { name: 'Loading…' });
    expect(loading.querySelector('svg')).toHaveClass('size-4', 'animate-spin');
    await act(async () => answer.resolve(earlierPage(earlier)));
    const articles = screen.getAllByRole('article');
    expect(articles).toHaveLength(40);
    expect(articles[0]).toHaveAttribute('id', 'note-n6');
    expect(articles[0]).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Show earlier notes (5)' })).toBeInTheDocument();
  });

  it('leaves when none remain', () => {
    thread({ notes: [note(1), note(2)] });
    expect(screen.queryByRole('button', { name: /Show earlier notes/ })).toBeNull();
  });

  it('shows We couldn’t load earlier notes. with Try again in place of the button, and tries again', async () => {
    const user = userEvent.setup();
    mocks.listRequestNotesAction
      .mockResolvedValueOnce({ ok: false, kind: 'retryable', message: 'We couldn’t load earlier notes.' })
      .mockResolvedValueOnce(earlierPage(earlier));
    thread({ notes: newest });
    await user.click(screen.getByRole('button', { name: 'Show earlier notes (25)' }));
    expect(await screen.findByText('We couldn’t load earlier notes.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Show earlier notes/ })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(screen.getAllByRole('article')).toHaveLength(40));
    expect(mocks.listRequestNotesAction).toHaveBeenCalledTimes(2);
    expect(screen.queryByText('We couldn’t load earlier notes.')).toBeNull();
  });
});

/*
 * Notes closed with unsent text (13-UI-SPEC §9.4; D-22, D-25; UI-D19): a NOTES_CLOSED refusal keeps the text in the
 * session store and refreshes the page; once the page reads the window closed, the §8.4 line shows above a read-only
 * well holding the text. A closed request with a kept draft shows the same well on load.
 */
describe('notes closed with unsent text (13-UI-SPEC §9.4)', () => {
  const key = 'csrm-draft:note:owner-a:request-1';
  const closedLine = 'Notes closed when the assessment was released. They stay here as part of the record.';
  const closedRefusal = {
    ok: false, kind: 'blocked', reason: 'NOTES_CLOSED',
    message: 'Notes are closed on this request now, so your note wasn’t added. Your text is kept below.',
  } as const;

  afterEach(() => {
    window.sessionStorage.clear();
  });

  function withZone(props: Partial<NotesThreadProps>) {
    const all: NotesThreadProps = {
      requestId: 'request-1', requestNumber: RAR, viewer: 'requestor', viewerPart: 'requestor', draftOwnerKey: 'owner-a',
      accepting: true, closedReason: null, notes: [note(1), note(2, { authorPart: 'security-analyst', author: bob })],
      ...props,
    };
    return <TimeZoneProvider zone="Australia/Sydney"><NotesThread {...all} /></TimeZoneProvider>;
  }

  it('keeps the text and refreshes on NOTES_CLOSED; after the refresh the closed line shows above the well holding it', async () => {
    const user = userEvent.setup();
    mocks.addRequestNoteAction.mockResolvedValue(closedRefusal);
    const view = render(withZone({}));
    await user.type(screen.getByRole('textbox', { name: 'Add a note' }), 'Too late to add');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalledTimes(1));
    expect(window.sessionStorage.getItem(key)).toBe('Too late to add');
    view.rerender(withZone({ accepting: false, closedReason: 'released' }));
    const line = screen.getByText(closedLine);
    const kept = document.querySelector('[data-unsent-note]')!;
    expect(kept.textContent).toBe('Too late to add');
    expect(line.compareDocumentPosition(kept) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Copy text' })).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: 'Add a note' })).toBeNull();
  });

  it('shows a kept draft in the well on a closed request', () => {
    window.sessionStorage.setItem(key, 'Written before it closed');
    render(withZone({ accepting: false, closedReason: 'released' }));
    expect(document.querySelector('[data-unsent-note]')?.textContent).toBe('Written before it closed');
  });

  it('shows no well on a closed request without kept text, or with another person’s', () => {
    window.sessionStorage.setItem('csrm-draft:note:owner-b:request-1', 'Not yours');
    render(withZone({ accepting: false, closedReason: 'released' }));
    expect(document.querySelector('[data-unsent-note]')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Copy text' })).toBeNull();
  });

  it('Discard text removes the well and the kept text and focuses the closed line; Undo restores both', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(key, 'Second thoughts');
    render(withZone({ accepting: false, closedReason: 'released' }));
    await user.click(screen.getByRole('button', { name: 'Discard text' }));
    expect(document.querySelector('[data-unsent-note]')).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBeNull();
    expect(screen.getByText(closedLine)).toHaveFocus();
    expect(mocks.successToast).toHaveBeenCalledWith('Note text discarded.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    const undo = (mocks.successToast.mock.calls.at(-1)?.[1] as { action: { onClick: () => void } }).action;
    await act(async () => undo.onClick());
    expect(document.querySelector('[data-unsent-note]')?.textContent).toBe('Second thoughts');
    expect(window.sessionStorage.getItem(key)).toBe('Second thoughts');
    expect(mocks.successToast).toHaveBeenLastCalledWith('Note text restored.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Copy text' })).toHaveFocus());
  });

  it('hands the composer the session key, so its text is kept per person and request', async () => {
    const user = userEvent.setup();
    render(withZone({}));
    await user.type(screen.getByRole('textbox', { name: 'Add a note' }), 'Kept for later');
    await waitFor(() => expect(window.sessionStorage.getItem(key)).toBe('Kept for later'), { timeout: 1_500 });
  });
});

/*
 * Links into the thread (D1 and D3, the 13-19 walk; WR-305; 13-UI-SPEC §2.2, §5.1, §8.2, §9.2, §10.2, §12.3, §12.4). The
 * request routes stream the page in behind their loading boundary, after the browser and the router have tried to scroll to
 * the fragment, so the thread lands on its own targets once it exists: `#notes` brings the section into view and focuses
 * its heading, and brings the first unread note into view when it would otherwise sit below the fold (so §9.2's mark-read
 * can see it); `#note-{id}` scrolls to the note and moves focus there, loading earlier notes until it is loaded; and
 * `#note-composer` focuses the field. A link on the same page lands the same way once the router has moved to it.
 */
describe('landing on a link into the thread (D1, D3, WR-305)', () => {
  const scrolled: Array<{ id: string; options: unknown }> = [];
  const original = Element.prototype.scrollIntoView;

  beforeEach(() => {
    scrolled.length = 0;
    Element.prototype.scrollIntoView = function scrollIntoView(this: Element, options?: unknown) {
      scrolled.push({ id: this.id, options });
    };
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = original;
    window.history.replaceState(null, '', '/');
  });

  function at(hash: string) {
    window.history.replaceState(null, '', `/app/review/requests/request-1${hash}`);
  }

  /* The thread inside the server-rendered section frame it ships in (NotesSection): the `#notes` region and its heading. */
  function framed(props: Partial<NotesThreadProps> = {}) {
    const all: NotesThreadProps = {
      requestId: 'request-1', requestNumber: RAR, viewer: 'requestor', viewerPart: 'requestor',
      accepting: true, closedReason: null, notes: [note(1), note(2, { authorPart: 'security-analyst', author: bob, unread: true })],
      ...props,
    };
    return render(
      <TimeZoneProvider zone="Australia/Sydney">
        <div className="scroll-mt-24" id="notes">
          <section aria-labelledby="notes-heading"><h2 id="notes-heading" tabIndex={-1}>Notes</h2><NotesThread {...all} /></section>
        </div>
      </TimeZoneProvider>,
    );
  }

  it('lands on #notes once the thread exists: the section scrolls into view and its heading takes focus (D1)', async () => {
    at('#notes');
    framed();
    await waitFor(() => expect(screen.getByRole('heading', { name: 'Notes' })).toHaveFocus());
    expect(scrolled.map(({ id }) => id)).toContain('notes');
  });

  it('brings the first unread note into view after #notes when it would sit below the fold, so it can be marked read (D1, §9.2)', async () => {
    const below = vi.spyOn(Element.prototype, 'getBoundingClientRect').mockImplementation(function rect(this: Element) {
      const top = this.id === 'note-n2' ? window.innerHeight + 400 : 0;
      return { top, bottom: top + 80, left: 0, right: 300, width: 300, height: 80, x: 0, y: top, toJSON: () => ({}) } as DOMRect;
    });
    try {
      at('#notes');
      framed();
      await waitFor(() => expect(scrolled.map(({ id }) => id)).toEqual(['notes', 'note-n2']));
      expect(scrolled[1]!.options).toEqual({ block: 'nearest' });
      expect(screen.getByRole('heading', { name: 'Notes' })).toHaveFocus();
    } finally {
      below.mockRestore();
    }
  });

  it('lands on #note-{id} once the thread exists: the note scrolls into view and takes focus (D1, §8.2)', async () => {
    at('#note-n1');
    framed();
    await waitFor(() => expect(document.getElementById('note-n1')).toHaveFocus());
    expect(scrolled.map(({ id }) => id)).toEqual(['note-n1']);
  });

  it('focuses the composer for #note-composer, the hub’s Add a note link (D1, §5.1)', async () => {
    at('#note-composer');
    framed({ notes: [] });
    await waitFor(() => expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveFocus());
  });

  it('moves focus to the note a link on the same page names, once the router has moved to it (D3, §8.2)', async () => {
    const user = userEvent.setup();
    at('');
    framed();
    render(
      <a
        href="/app/review/requests/request-1#note-n1"
        /* As next/link does: it keeps the browser from navigating and moves the URL itself. */
        onClick={(event) => { event.preventDefault(); window.history.pushState(null, '', event.currentTarget.href); }}
      >
        Requestor note
      </a>,
    );
    await user.click(screen.getByRole('link', { name: 'Requestor note' }));
    await waitFor(() => expect(document.getElementById('note-n1')).toHaveFocus());
    expect(scrolled.map(({ id }) => id)).toContain('note-n1');
  });

  it('loads earlier notes until the linked note is loaded, then lands on it (WR-305)', async () => {
    const newest = Array.from({ length: 20 }, (_, index) => note(41 + index));
    const middle = Array.from({ length: 20 }, (_, index) => note(21 + index));
    const oldest = Array.from({ length: 20 }, (_, index) => note(1 + index));
    const pageOf = (notes: RequestNote[]): NoteActionResult<RequestNotesPage> => ({
      ok: true,
      data: { notes, meta: { total: 60, unread: 0, lastReadSequence: 60, hasEarlier: notes[0]!.sequence > 1, accepting: true, closedReason: null, viewerPart: 'security-analyst', canMarkAiInputs: false } },
    });
    mocks.listRequestNotesAction.mockResolvedValueOnce(pageOf(middle)).mockResolvedValueOnce(pageOf(oldest));
    at('#note-n3');
    framed({ notes: newest });
    await waitFor(() => expect(document.getElementById('note-n3')).toHaveFocus());
    expect(mocks.listRequestNotesAction.mock.calls).toEqual([
      [{ requestId: 'request-1', before: 41, limit: 20 }],
      [{ requestId: 'request-1', before: 21, limit: 20 }],
    ]);
    expect(screen.getAllByRole('article')).toHaveLength(60);
    expect(scrolled.map(({ id }) => id)).toContain('note-n3');
    expect(screen.queryByRole('button', { name: /Show earlier notes/ })).toBeNull();
  });

  it('reads nothing more for a linked note the thread already holds, or for a fragment that is not its own', async () => {
    at('#assignment');
    framed({ notes: Array.from({ length: 20 }, (_, index) => note(41 + index)) });
    await act(async () => new Promise((done) => setTimeout(done, 20)));
    expect(mocks.listRequestNotesAction).not.toHaveBeenCalled();
    expect(scrolled).toEqual([]);
  });
});
