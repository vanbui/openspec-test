import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./notes-actions', () => ({ setNoteAiInputAction: vi.fn() }));
vi.mock('@/components/ui/success-toast', () => ({ successToast: vi.fn() }));
vi.mock('sonner', () => ({ toast: { error: vi.fn() } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn(), push: vi.fn() }) }));
vi.mock('@/features/attachments/attachments-actions', () => ({ downloadAttachmentAction: vi.fn(), uploadAttachmentAction: vi.fn() }));

import { TimeZoneProvider } from '@/components/csrm/local-time';
import { uploadAttachmentAction } from '@/features/attachments/attachments-actions';
import type { RequestAttachment } from '@/features/attachments/attachments-schema';
import { AttachmentFileStoreProvider, useFileStoreDispatch } from '@/features/attachments/file-store';
import { waitingRow } from '@/features/attachments/upload-queue-model';

import { NoteComposer } from './note-composer';

import type { RequestNote } from './notes-domain';
import { NoteItem } from './note-item';

function note(overrides: Partial<RequestNote> = {}): RequestNote {
  return {
    documentId: 'n1', sequence: 1, body: 'After-hours vendor support will come from an offshore team.', authorPart: 'requestor',
    author: { documentId: 'u-jane', displayName: 'Jane Doe' }, postedAt: '2026-10-01T05:47:00.000Z', unread: false,
    ...overrides,
  };
}

function item(value: RequestNote, props: Partial<Parameters<typeof NoteItem>[0]> = {}) {
  return render(<TimeZoneProvider zone="Australia/Sydney"><ol><NoteItem note={value} unread={value.unread} {...props} /></ol></TimeZoneProvider>);
}

describe('a note in the thread (13-UI-SPEC §8.2, X-16)', () => {
  it('is a list item holding an article a link can focus, named by its author', () => {
    item(note());
    const article = screen.getByRole('article');
    expect(article).toHaveAttribute('id', 'note-n1');
    expect(article).toHaveAttribute('tabindex', '-1');
    expect(article.closest('li')).not.toBeNull();
  });

  it('heads the note with the author’s name, then the part in words and the local time in a time element', () => {
    item(note());
    const article = screen.getByRole('article');
    const name = within(article).getByText('Jane Doe');
    expect(name).toHaveClass('font-medium');
    const time = article.querySelector('time');
    expect(time).toHaveAttribute('dateTime', '2026-10-01T05:47:00.000Z');
    expect(time?.textContent).toMatch(/1 Oct 2026, 3:47\spm/);
    expect(time?.parentElement?.textContent).toMatch(/^Requestor · /);
    expect(time?.parentElement).toHaveClass('text-xs', 'text-foreground-secondary');
  });

  it('marks an unread note New, and an analyst’s note with its part', () => {
    item(note({ unread: true, authorPart: 'security-analyst', author: { documentId: 'u-bob', displayName: 'Bob Doe' } }));
    const article = screen.getByRole('article');
    expect(within(article).getByText('New')).toBeInTheDocument();
    expect(within(article).getByText('Bob Doe')).toBeInTheDocument();
    expect(article.textContent).toContain('Security Analyst · ');
  });

  it('keeps the New marker when the page says it was unread, even once the served note reads as read (D-24)', () => {
    item(note({ unread: false }), { unread: true });
    expect(screen.getByText('New')).toBeInTheDocument();
  });

  it('renders a body as text: markup stays literal and a URL is not a link (T-13-34)', () => {
    item(note({ body: '<b>x</b> see https://example.com/evil <script>alert(1)</script>' }));
    const article = screen.getByRole('article');
    expect(article.querySelector('b')).toBeNull();
    expect(article.querySelector('script')).toBeNull();
    expect(within(article).queryByRole('link')).toBeNull();
    expect(article.textContent).toContain('<b>x</b> see https://example.com/evil <script>alert(1)</script>');
  });

  it('keeps line breaks and wraps anywhere', () => {
    const { container } = item(note({ body: 'First line\nSecond line' }));
    const body = container.querySelector('[data-note-body]');
    expect(body?.textContent).toBe('First line\nSecond line');
    expect(body).toHaveClass('whitespace-pre-wrap', '[overflow-wrap:anywhere]');
  });

  it('offers no edit or delete control (D-21)', () => {
    item(note());
    expect(screen.queryByRole('button', { name: /edit|delete|remove/i })).toBeNull();
  });

  it('shows Adding… in place of the time while pending, at the pending opacity', () => {
    item(note({ documentId: 'pending' }), { pending: true });
    const article = screen.getByRole('article');
    expect(within(article).getByText('Adding…')).toBeInTheDocument();
    expect(article.querySelector('time')).toBeNull();
    expect(article.closest('li')).toHaveAttribute('data-pending', 'true');
    expect(article.closest('li')).toHaveClass('data-[pending=true]:opacity-60');
  });
});

/*
 * jsdom lays nothing out, so the clamp's overflow is stubbed: a body whose text is longer than this measures taller than
 * its ten clamped lines, as a browser would report it.
 */
const LONG = 200;
function stubClampGeometry() {
  Object.defineProperty(HTMLElement.prototype, 'scrollHeight', {
    configurable: true,
    get(this: HTMLElement) { return this.hasAttribute('data-note-body') && (this.textContent ?? '').length > LONG ? 400 : 100; },
  });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 100 });
}

describe('a long note (13-UI-SPEC §8.2, UI Considerations: long-text)', () => {
  afterEach(() => {
    delete (HTMLElement.prototype as { scrollHeight?: number }).scrollHeight;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  });

  it('clamps a body at ten lines, offers Show full note and toggles it, keeping the whole text in the DOM', async () => {
    stubClampGeometry();
    const user = userEvent.setup();
    const body = 'Line of text. '.repeat(40);
    const { container } = item(note({ body }));
    const text = container.querySelector('[data-note-body]')!;
    expect(text.textContent).toBe(body);
    expect(text).toHaveClass('line-clamp-10', 'print:line-clamp-none');
    const toggle = await screen.findByRole('button', { name: 'Show full note' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('data-print', 'hidden');
    expect(toggle).toHaveAttribute('aria-controls', text.id);
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Show less' })).toHaveAttribute('aria-expanded', 'true');
    expect(text).not.toHaveClass('line-clamp-10');
    await user.click(screen.getByRole('button', { name: 'Show less' }));
    expect(screen.getByRole('button', { name: 'Show full note' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('offers no toggle for a body that fits', () => {
    stubClampGeometry();
    item(note({ body: 'Short.' }));
    expect(screen.queryByRole('button', { name: 'Show full note' })).toBeNull();
  });
});

/*
 * The AI-input mark on a note (13-UI-SPEC §10.1; X-18; D-26, D-07): Strapi's `canMarkAiInputs` decides who gets the
 * switch; a Security Analyst who may not mark sees the X-11 note on a marked note; the Requestor, whose notes carry no
 * `changesAiInputs` key, sees neither.
 */
describe('the AI-input mark on a note (13-UI-SPEC §10.1, D-26)', () => {
  it('gives a Security Analyst who may mark a switch under the body, described by the note’s header line', () => {
    item(note({ changesAiInputs: true }), { canMarkAiInputs: true, requestId: 'request-1' });
    const article = screen.getByRole('article');
    const toggle = within(article).getByRole('switch', { name: 'Changes the AI inputs' });
    expect(toggle).toBeChecked();
    expect(toggle).toHaveAccessibleDescription(/^Jane Doe\s*Requestor · /);
    const body = article.querySelector('[data-note-body]')!;
    expect(body.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(toggle.closest('[data-print="hidden"]')).not.toBeNull();
    expect(within(article).queryByText('Changes the AI inputs', { selector: '[data-ai-input-note]' })).toBeNull();
  });

  it('shows a requesting analyst the X-11 note on a marked note, with Sparkles, and no switch (D-07)', () => {
    item(note({ changesAiInputs: true }), { canMarkAiInputs: false, requestId: 'request-1' });
    const article = screen.getByRole('article');
    expect(within(article).queryByRole('switch')).toBeNull();
    const mark = within(article).getByText('Changes the AI inputs');
    const line = mark.closest('[data-ai-input-note]')!;
    expect(line).toHaveClass('text-xs', 'text-foreground-secondary');
    const icon = line.querySelector('svg');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveClass('size-3');
  });

  it('shows nothing on an unmarked note to an analyst who may not mark', () => {
    item(note({ changesAiInputs: false }), { canMarkAiInputs: false, requestId: 'request-1' });
    expect(screen.queryByText('Changes the AI inputs')).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  /*
   * IN-504: presentation only. The note does not know its viewer: a Requestor's note is unmarked because Strapi omits
   * `changesAiInputs` from the Requestor's read (request-notes.integration), and this checks what an unmarked note shows.
   */
  it('shows neither the switch nor the note on an unmarked note the viewer may not mark, as Strapi serves the Requestor’s (D-26)', () => {
    item(note());
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText('Changes the AI inputs')).toBeNull();
  });

  it('offers no switch on a note still being added', () => {
    item(note({ documentId: 'pending', changesAiInputs: false }), { pending: true, canMarkAiInputs: true, requestId: 'request-1' });
    expect(screen.queryByRole('switch')).toBeNull();
  });
});

function file(overrides: Partial<RequestAttachment> = {}): RequestAttachment {
  return {
    documentId: 'att-9', fileName: 'architecture-deck.pptx', fileType: 'pptx', byteSize: 3_727, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: { documentId: 'n1', postedAt: '2026-10-01T05:47:00.000Z' }, removedBy: null, removedAt: null, detection: null,
    actions: { download: true, remove: true, restore: false }, ...overrides,
  };
}

/*
 * 14-UI-SPEC §4.2 (D-17; X-21): a note lists the files added with it as chips, each name a record link to its row in the
 * Files section, so the file leads to its row and its row (§3.2 `Note`) leads back.
 */
describe('a note’s files (14-UI-SPEC §4.2; X-21)', () => {
  it('lists a settled file as a chip under the body, its name linking to its row, with an icon-only Download', () => {
    item(note(), { files: [file()], requestId: 'request-1' });
    const article = screen.getByRole('article');
    const list = within(article).getByRole('list', { name: 'Files with this note' });
    const body = article.querySelector('[data-note-body]')!;
    expect(body.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    const chip = within(list).getByRole('listitem');
    expect(within(chip).getByRole('link', { name: 'architecture-deck.pptx' })).toHaveAttribute('href', '#file-att-9');
    expect(chip).toHaveTextContent('4 KB');
    expect(within(chip).getByRole('button', { name: 'Download architecture-deck.pptx' })).toBeInTheDocument();
  });

  it('shows a pending file’s badge in place of Download', () => {
    item(note(), { files: [file({ state: 'pending', actions: { download: false, remove: true, restore: false } })], requestId: 'request-1' });
    const chip = within(screen.getByRole('list', { name: 'Files with this note' })).getByRole('listitem');
    expect(within(chip).getByText('Waiting for malware check')).toBeInTheDocument();
    expect(within(chip).queryByRole('button', { name: /^Download/ })).toBeNull();
  });

  /* 14-UI-REVIEW UI-01: the badge sits in the chip's badge slot, which takes its own line below 768px. */
  it('puts the waiting file’s badge in the chip’s badge slot, on its own line below 768px (UI-01)', () => {
    item(note(), { files: [file({ state: 'pending', actions: { download: false, remove: true, restore: false } })], requestId: 'request-1' });
    const chip = within(screen.getByRole('list', { name: 'Files with this note' })).getByRole('listitem');
    const slot = within(chip).getByText('Waiting for malware check').closest('[data-file-chip-badge]');
    expect(slot).not.toBeNull();
    expect(slot).toHaveClass('max-md:basis-full');
  });

  it('shows a removed file’s neutral Removed badge, and its name is no link because its row has left the list', () => {
    item(note(), {
      files: [file({ state: 'removed', removedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, removedAt: '2026-10-10T02:00:00.000Z', actions: { download: false, remove: false, restore: true } })],
      requestId: 'request-1',
    });
    const chip = within(screen.getByRole('list', { name: 'Files with this note' })).getByRole('listitem');
    expect(within(chip).getByText('Removed')).toBeInTheDocument();
    expect(within(chip).queryByRole('link')).toBeNull();
    expect(chip).toHaveTextContent('architecture-deck.pptx');
  });

  it('shows a blocked or unavailable file’s badge', () => {
    item(note(), {
      files: [
        file({ documentId: 'att-b', fileName: 'tool.pdf', state: 'blocked', detection: 'Csrm.Test.Signature', actions: { download: false, remove: true, restore: false } }),
        file({ documentId: 'att-u', fileName: 'gone.pdf', state: 'unavailable', actions: { download: false, remove: true, restore: false } }),
      ],
      requestId: 'request-1',
    });
    const list = screen.getByRole('list', { name: 'Files with this note' });
    expect(within(list).getByText('Blocked')).toBeInTheDocument();
    expect(within(list).getByText('File unavailable')).toBeInTheDocument();
  });

  it('renders no list for a note without files', () => {
    item(note(), { files: [], requestId: 'request-1' });
    expect(screen.queryByRole('list', { name: 'Files with this note' })).toBeNull();
  });

  it('shows the files of a note being added as rows at Waiting (§4.2 step 1)', () => {
    const deck = new File(['PK'], 'architecture-deck.pptx', { lastModified: 1 });
    item(note({ documentId: 'pending' }), { pending: true, pendingFiles: [deck] });
    const rows = screen.getByRole('list', { name: 'Files being added' });
    expect(within(rows).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
    expect(within(rows).getByRole('listitem')).toHaveTextContent('Waiting');
  });
});

/* Puts a just-posted note's files in its queue, as the thread does once Strapi has recorded the note. */
function PostedFiles({ files }: { files: File[] }) {
  const put = useFileStoreDispatch('owner-a', 'request-1');
  useEffect(() => {
    put('note:n1', { type: 'add', rows: files.map(waitingRow) });
  }, [files, put]);
  return null;
}

/*
 * 14-UI-SPEC §4.2 step 4 (D-17; UI-D9; family N): a file refused because its note can no longer take files keeps its
 * row on the note with the reason, and `Add with a new note` moves it to the composer's chips, so no file is trapped.
 */
describe('a file its note can no longer take (§4.2; UI-D9)', () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it('keeps the row with its reason and offers Add with a new note, which moves the file to the composer', async () => {
    vi.mocked(uploadAttachmentAction).mockResolvedValue({
      ok: false, kind: 'refused', reason: 'ATTACHMENT_NOTE_INVALID', offerNewNote: true,
      message: 'This note can no longer take files. Add the file with a new note.',
    });
    const deck = new File([new Uint8Array(3_727)], 'architecture-deck.pptx', { lastModified: 1 });
    render(
      <TimeZoneProvider zone="Australia/Sydney">
        <AttachmentFileStoreProvider>
          <PostedFiles files={[deck]} />
          <ol><NoteItem fileQueue={{ ownerKey: 'owner-a', remaining: 19, fresh: true }} note={note()} requestId="request-1" unread={false} /></ol>
          <NoteComposer attach={{ remaining: 19 }} draftOwnerKey="owner-a" hint="Notes hint" onSubmit={vi.fn(async () => null)} requestId="request-1" />
        </AttachmentFileStoreProvider>
      </TimeZoneProvider>,
    );
    const article = screen.getByRole('article');
    const move = await within(article).findByRole('button', { name: 'Add with a new note: architecture-deck.pptx' });
    expect(move).toHaveAttribute('data-variant', 'outline');
    expect(move).toHaveAttribute('data-size', 'sm');
    const row = within(within(article).getByRole('list', { name: 'Files being added' })).getByRole('listitem');
    expect(row).toHaveTextContent('Not added. This note can no longer take files. Add the file with a new note.');
    expect(within(row).queryByRole('button', { name: /^Retry|^Choose another file/ })).toBeNull();
    expect(within(row).getByRole('button', { name: 'Remove from list: architecture-deck.pptx' })).toBeInTheDocument();
    const form = vi.mocked(uploadAttachmentAction).mock.calls[0]![0];
    expect(form.get('noteId')).toBe('n1');

    await userEvent.setup().click(move);
    const chips = screen.getByRole('list', { name: 'Files to add with this note' });
    expect(within(chips).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
    await waitFor(() => expect(within(article).queryByRole('list', { name: 'Files being added' })).toBeNull());
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveFocus();
    expect(uploadAttachmentAction).toHaveBeenCalledTimes(1);
  });
});
