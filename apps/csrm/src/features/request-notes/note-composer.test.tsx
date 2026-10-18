import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { AnchorHTMLAttributes, MouseEvent } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  addRequestNoteAction: vi.fn(),
  listRequestNotesAction: vi.fn(),
  markRequestNotesReadAction: vi.fn(),
  uploadAttachmentAction: vi.fn(),
  refresh: vi.fn(),
  successToast: vi.fn(),
}));
vi.mock('./notes-actions', () => ({
  addRequestNoteAction: mocks.addRequestNoteAction,
  listRequestNotesAction: mocks.listRequestNotesAction,
  markRequestNotesReadAction: mocks.markRequestNotesReadAction,
}));
vi.mock('@/features/attachments/attachments-actions', () => ({ uploadAttachmentAction: mocks.uploadAttachmentAction, downloadAttachmentAction: vi.fn() }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('@/components/ui/success-toast', () => ({ successToast: mocks.successToast }));
/* next/link as it calls onClick, then onNavigate with preventDefault only (navigation-guard.test.tsx). */
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, onNavigate, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: (event: { preventDefault: () => void }) => void }) => (
    <a {...props} href={href} onClick={(event: MouseEvent<HTMLAnchorElement>) => { onClick?.(event); event.preventDefault(); onNavigate?.({ preventDefault: () => undefined }); }}>{children}</a>
  ),
}));

import { TimeZoneProvider } from '@/components/csrm/local-time';
import { GuardedLink, NavigationGuardProvider } from '@/components/csrm/navigation-guard';
import { AttachmentFileStoreProvider } from '@/features/attachments/file-store';

import { NoteComposer, type ComposerFailure, type NoteComposerProps } from './note-composer';
import type { RequestNote } from './notes-domain';
import { NotesThread, type NotesThreadProps } from './notes-thread';

const hint = 'You and the Security Analysts on this request can read notes. A note can’t be changed or removed once added.';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function composer(
  onSubmit: NoteComposerProps['onSubmit'] = vi.fn(async () => null),
  props: Partial<Omit<NoteComposerProps, 'onSubmit'>> = {},
) {
  render(<NoteComposer hint={hint} onSubmit={onSubmit} {...props} />);
  return { onSubmit, field: screen.getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement };
}

describe('the composer (13-UI-SPEC §8.3, X-16)', () => {
  it('labels a three-row textarea Add a note, with no maxLength and both shortcuts declared', () => {
    const { field } = composer();
    expect(field).toHaveAttribute('id', 'note-composer');
    expect(field).toHaveAttribute('rows', '3');
    expect(field).not.toHaveAttribute('maxLength');
    expect(field).toHaveAttribute('aria-keyshortcuts', 'Control+Enter Meta+Enter');
    expect(field).toHaveAccessibleDescription(hint);
    expect(screen.getByRole('button', { name: 'Add note' })).toBeInTheDocument();
  });

  it('grows to twelve rows, then scrolls inside itself', () => {
    const { field } = composer();
    expect(field.className).toContain('max-h-[calc(12lh+1rem+2px)]');
    expect(field.className).toContain('overflow-y-auto');
  });

  /*
   * D5 (the 13-19 walk): the field is border-box with a 1px border on each side and 0.5rem of padding above and below,
   * so three and twelve lines of text need the two padding halves and the two border pixels on top of the lines.
   */
  it('sizes its three-row floor and twelve-row ceiling to the lines, the padding and the 2px border (D5)', () => {
    const { field } = composer();
    expect(field.className).toMatch(/(^| )border( |$)/);
    expect(field.className).toMatch(/(^| )py-2( |$)/);
    expect(field.className).toContain('min-h-[calc(3lh+1rem+2px)]');
    expect(field.className).toContain('max-h-[calc(12lh+1rem+2px)]');
  });

  it('refuses an empty note in §8.3’s words and posts nothing', async () => {
    const user = userEvent.setup();
    const { onSubmit, field } = composer();
    await user.type(field, '   ');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Write a note before adding it.')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('refuses a note over 5,000 characters and says how long it is', async () => {
    const user = userEvent.setup();
    const { onSubmit, field } = composer();
    await user.click(field);
    await user.paste('x'.repeat(5_001));
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Keep the note to 5,000 characters or fewer. It has 5,001.')).toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
    expect(field.value).toHaveLength(5_001);
  });

  it('posts with Ctrl+Enter and with ⌘+Enter, clearing the field and keeping focus', async () => {
    const user = userEvent.setup();
    const { onSubmit, field } = composer();
    await user.type(field, 'First note');
    await user.keyboard('{Control>}{Enter}{/Control}');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('First note'));
    expect(field.value).toBe('');
    expect(field).toHaveFocus();
    await user.type(field, 'Second note');
    await user.keyboard('{Meta>}{Enter}{/Meta}');
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Second note'));
  });

  /* WR-501: Add note takes focus when pressed, so the field having it afterwards is the composer's own doing (§9.1). */
  it('posts with Add note, clearing the field and moving focus back into it', async () => {
    const user = userEvent.setup();
    const { onSubmit, field } = composer();
    await user.type(field, 'Clicked note');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Clicked note'));
    expect(field.value).toBe('');
    expect(field).toHaveFocus();
  });

  it('on a retryable failure returns the text with the cursor at the end, shows the error and offers Try again', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<(body: string) => Promise<ComposerFailure | null>>()
      .mockResolvedValueOnce({ message: 'We couldn’t add your note. Try again.', retryable: true })
      .mockResolvedValueOnce(null);
    const { field } = composer(onSubmit);
    await user.type(field, 'Keep me');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('We couldn’t add your note. Try again.')).toBeInTheDocument();
    expect(field.value).toBe('Keep me');
    expect(field.selectionStart).toBe('Keep me'.length);
    expect(field.selectionEnd).toBe('Keep me'.length);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenLastCalledWith('Keep me');
    await waitFor(() => expect(screen.queryByText('We couldn’t add your note. Try again.')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('shows a blocked failure as the field error without Try again', async () => {
    const user = userEvent.setup();
    const { field } = composer(vi.fn(async () => ({ message: 'You can’t add notes to this request.', retryable: false })));
    await user.type(field, 'Blocked');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('You can’t add notes to this request.')).toBeInTheDocument();
    expect(field.value).toBe('Blocked');
    expect(screen.queryByRole('button', { name: 'Try again' })).toBeNull();
  });

  it('is not re-entrant: a second press while one is pending sends nothing', async () => {
    const user = userEvent.setup();
    const answer = deferred<ComposerFailure | null>();
    const onSubmit = vi.fn(() => answer.promise);
    const { field } = composer(onSubmit);
    await user.type(field, 'Once');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.type(field, 'Twice');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(onSubmit).toHaveBeenCalledTimes(1);
    await act(async () => answer.resolve(null));
  });

  it('hides itself from print', () => {
    composer();
    expect(document.querySelector('[data-print="hidden"] #note-composer')).not.toBeNull();
  });
});

describe('the composer’s AI-input checkbox (13-UI-SPEC §8.3; X-18; D-26)', () => {
  const aiHint = 'Include this note in what CSRM sends to the AI for this request.';

  it('offers a Security Analyst who may mark an off-by-default checkbox, with its hint', () => {
    composer(undefined, { canMarkAiInputs: true });
    const checkbox = screen.getByRole('checkbox', { name: 'Changes the AI inputs' });
    expect(checkbox).not.toBeChecked();
    expect(checkbox).toHaveAccessibleDescription(aiHint);
  });

  /* IN-504: presentation only: the composer offers what canMarkAiInputs says; Strapi decides it for each viewer. */
  it('offers no checkbox when Strapi does not let the viewer mark (the Requestor, a requesting analyst)', () => {
    composer(undefined, { canMarkAiInputs: false });
    expect(screen.queryByRole('checkbox')).toBeNull();
    expect(screen.queryByText(aiHint)).toBeNull();
  });

  it('sends the mark only when checked, and starts the next note unchecked', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<NoteComposerProps['onSubmit']>(async () => null);
    const { field } = composer(onSubmit, { canMarkAiInputs: true });
    await user.type(field, 'Unmarked note');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenLastCalledWith('Unmarked note');
    await user.click(screen.getByRole('checkbox', { name: 'Changes the AI inputs' }));
    await user.type(field, 'Marked note');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenLastCalledWith('Marked note', { changesAiInputs: true });
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Changes the AI inputs' })).not.toBeChecked());
  });

  it('keeps the checkbox as it was when a post fails, so trying again sends the same choice', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn<NoteComposerProps['onSubmit']>()
      .mockResolvedValueOnce({ message: 'We couldn’t add your note. Try again.', retryable: true })
      .mockResolvedValueOnce(null);
    const { field } = composer(onSubmit, { canMarkAiInputs: true });
    await user.click(screen.getByRole('checkbox', { name: 'Changes the AI inputs' }));
    await user.type(field, 'Marked');
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await user.click(await screen.findByRole('button', { name: 'Try again' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(2));
    expect(onSubmit).toHaveBeenLastCalledWith('Marked', { changesAiInputs: true });
  });
});

/*
 * No lost input (13-UI-SPEC §9.3; D-25; UI-D17, UI-D18): the composer keeps its text in the tab's session store per
 * person and request, restores it on return, clears it once the note is added, and arms only the browser's own
 * beforeunload prompt while it holds text, because in-app navigation keeps the text.
 */
describe('the composer’s kept text (13-UI-SPEC §9.3; D-25)', () => {
  const key = 'csrm-draft:note:owner-a:request-1';
  const kept = { draftOwnerKey: 'owner-a', requestId: 'request-1' } as const;

  afterEach(() => {
    vi.useRealTimers();
    window.sessionStorage.clear();
  });

  function leave(): boolean {
    const event = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(event);
    return event.defaultPrevented;
  }

  it('keeps typed text in the session store once typing pauses for 300ms', async () => {
    vi.useFakeTimers();
    const { field } = composer(undefined, kept);
    fireEvent.change(field, { target: { value: 'Half a' } });
    await act(async () => { await vi.advanceTimersByTimeAsync(200); });
    fireEvent.change(field, { target: { value: 'Half a thought' } });
    expect(window.sessionStorage.getItem(key)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(299); });
    expect(window.sessionStorage.getItem(key)).toBeNull();
    await act(async () => { await vi.advanceTimersByTimeAsync(1); });
    expect(window.sessionStorage.getItem(key)).toBe('Half a thought');
  });

  it('restores kept text on return, with Restored from earlier in this session.', () => {
    window.sessionStorage.setItem(key, 'Written before I left');
    const { field } = composer(undefined, kept);
    expect(field.value).toBe('Written before I left');
    const caption = screen.getByText('Restored from earlier in this session.');
    expect(caption).toHaveClass('text-xs', 'text-foreground-secondary');
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Restored from earlier in this session.'));
  });

  it('never restores another person’s text, or another request’s', () => {
    window.sessionStorage.setItem('csrm-draft:note:owner-b:request-1', 'Someone else’s');
    window.sessionStorage.setItem('csrm-draft:note:owner-a:request-2', 'Another request’s');
    const { field } = composer(undefined, kept);
    expect(field.value).toBe('');
    expect(screen.queryByText('Restored from earlier in this session.')).toBeNull();
  });

  it('removes another person’s kept drafts from the store when it opens for the signed-in person (IN-402)', () => {
    window.sessionStorage.setItem('csrm-draft:note:owner-b:request-1', 'Someone else’s');
    window.sessionStorage.setItem('csrm-draft:assign:owner-b:request-9', '{"reason":"Someone else’s reason","analyst":null}');
    window.sessionStorage.setItem(key, 'Mine');
    composer(undefined, kept);
    expect(window.sessionStorage.getItem('csrm-draft:note:owner-b:request-1')).toBeNull();
    expect(window.sessionStorage.getItem('csrm-draft:assign:owner-b:request-9')).toBeNull();
    expect(window.sessionStorage.getItem(key)).toBe('Mine');
  });

  it('clears the kept text and the caption once the note is added', async () => {
    const user = userEvent.setup();
    window.sessionStorage.setItem(key, 'Ready to send');
    const onSubmit = vi.fn<NoteComposerProps['onSubmit']>(async () => null);
    composer(onSubmit, kept);
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith('Ready to send'));
    await waitFor(() => expect(window.sessionStorage.getItem(key)).toBeNull());
    expect(screen.queryByText('Restored from earlier in this session.')).toBeNull();
  });

  it('keeps the text in the store while the note is being added and when adding it fails', async () => {
    const user = userEvent.setup();
    const answer = deferred<ComposerFailure | null>();
    const { field } = composer(vi.fn(() => answer.promise), kept);
    await user.type(field, 'Sent at once');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(window.sessionStorage.getItem(key)).toBe('Sent at once');
    await act(async () => answer.resolve({ message: 'We couldn’t add your note. Try again.', retryable: true }));
    expect(window.sessionStorage.getItem(key)).toBe('Sent at once');
    expect(field.value).toBe('Sent at once');
  });

  /*
   * WR-303 and WR-502: the field clears while a note is being added, so the next note can be started. When that post
   * fails, its text comes back without losing what was typed meanwhile: the failed note's text first, then the new
   * text, in the field and in the session store alike, and a keep that was still waiting cannot overwrite them later.
   */
  it('keeps text typed while a note was being added when adding it fails, after the failed note’s text, and the store agrees (WR-303, WR-502)', async () => {
    const user = userEvent.setup();
    const answer = deferred<ComposerFailure | null>();
    const { field } = composer(vi.fn(() => answer.promise), kept);
    await user.type(field, 'First note');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(field.value).toBe('');
    await user.type(field, 'Next');
    await act(async () => answer.resolve({ message: 'We couldn’t add your note. Try again.', retryable: true }));
    const both = 'First note\n\nNext';
    expect(field.value).toBe(both);
    expect(field.selectionStart).toBe(both.length);
    expect(window.sessionStorage.getItem(key)).toBe(both);
    /* The keep that "Next" scheduled has had its 300ms: it must not have put "Next" alone back in the store. */
    await act(async () => new Promise((done) => setTimeout(done, 450)));
    expect(window.sessionStorage.getItem(key)).toBe(both);
    expect(field.value).toBe(both);
  });

  /*
   * IN-303: while a note is being added the field is empty, but its text exists only in the request and the tab's
   * store, so closing the tab must still ask; once the note is recorded nothing is left to lose.
   */
  it('keeps the browser’s leave prompt armed while a note is being added, and disarms it once the note is recorded (IN-303)', async () => {
    const user = userEvent.setup();
    const answer = deferred<ComposerFailure | null>();
    const { field } = composer(vi.fn(() => answer.promise), kept);
    await user.type(field, 'In flight');
    await user.keyboard('{Control>}{Enter}{/Control}');
    expect(field.value).toBe('');
    expect(leave()).toBe(true);
    await act(async () => answer.resolve(null));
    expect(leave()).toBe(false);
  });

  it('keeps what was typed when the composer leaves the page before the pause ends', async () => {
    const user = userEvent.setup();
    const { unmount } = render(<NoteComposer draftOwnerKey="owner-a" hint={hint} onSubmit={vi.fn(async () => null)} requestId="request-1" />);
    await user.type(screen.getByRole('textbox', { name: 'Add a note' }), 'Navigated away');
    unmount();
    expect(window.sessionStorage.getItem(key)).toBe('Navigated away');
  });

  it('arms the browser’s leave prompt while the field holds text, and disarms it when the field is empty', async () => {
    const user = userEvent.setup();
    const { field } = composer(undefined, kept);
    expect(leave()).toBe(false);
    await user.type(field, 'Unsent');
    expect(leave()).toBe(true);
    await user.clear(field);
    expect(leave()).toBe(false);
  });

  it('never blocks in-app navigation: it uses the beforeunload-only warning, not the leave guard', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/features/request-notes/note-composer.tsx'), 'utf8');
    expect(source).toMatch(/useUnloadWarning/);
    expect(source).not.toMatch(/useLeaveGuard|navigation-guard/);
    expect(source).toMatch(/writeSessionDraft/);
    expect(source).toMatch(/clearSessionDraft/);
  });
});

const deck = () => new File([new Uint8Array(3_727)], 'architecture-deck.pptx', { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', lastModified: 1 });
const flow = () => new File([new Uint8Array(1_567)], 'data-flow.docx', { type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', lastModified: 2 });
const vendorNote = 'The vendor sent their architecture deck after today’s call';

function fileInput(): HTMLInputElement {
  return document.getElementById('note-composer-files') as HTMLInputElement;
}

function chips() {
  return screen.queryByRole('list', { name: 'Files to add with this note' });
}

function withFiles(onSubmit: NoteComposerProps['onSubmit'] = vi.fn(async () => null), props: Partial<Omit<NoteComposerProps, 'onSubmit'>> = {}) {
  render(
    <AttachmentFileStoreProvider>
      <NoteComposer attach={{ remaining: 19 }} draftOwnerKey="owner-a" hint={hint} onSubmit={onSubmit} requestId="request-1" {...props} />
    </AttachmentFileStoreProvider>,
  );
  return { onSubmit, field: screen.getByRole('textbox', { name: 'Add a note' }) as HTMLTextAreaElement };
}

/*
 * 14-UI-SPEC §4.1 (D-17, D-27; UI-D7, UI-D8; X-21): after submission the composer takes files. `Attach files` opens the
 * chooser; each chosen file is a chip with its size and its own Remove; a note with files needs text that says what
 * they are. Nothing about a file is written to browser storage.
 */
describe('the composer’s files (14-UI-SPEC §4.1)', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('offers Attach files, outline and small, on the action row before Add note, when files can be added with a note', () => {
    withFiles();
    const attach = screen.getByRole('button', { name: 'Attach files' });
    expect(attach).toHaveAttribute('data-variant', 'outline');
    expect(attach).toHaveAttribute('data-size', 'sm');
    expect(attach.compareDocumentPosition(screen.getByRole('button', { name: 'Add note' })) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(fileInput()).toHaveAttribute('type', 'file');
    expect(fileInput()).toHaveAttribute('multiple');
  });

  it('offers no Attach files where files cannot be added with a note', () => {
    composer();
    expect(screen.queryByRole('button', { name: 'Attach files' })).toBeNull();
  });

  it('lists a chosen file as a chip with its size and Remove {name} from the list, and adds the hint', async () => {
    const { field } = withFiles();
    await userEvent.setup().upload(fileInput(), deck());
    const list = chips()!;
    const chip = within(list).getByRole('listitem');
    expect(chip).toHaveTextContent('architecture-deck.pptx');
    expect(chip).toHaveTextContent('4 KB');
    expect(within(chip).getByRole('button', { name: 'Remove architecture-deck.pptx from the list' })).toBeInTheDocument();
    expect(screen.getByText('Files are checked for malware, then added with your note.')).toBeInTheDocument();
    expect(field).toHaveAccessibleDescription(expect.stringContaining('Files are checked for malware, then added with your note.'));
  });

  /*
   * 14-UI-REVIEW UI-03 (the pilot's ruling; direction §4 Buttons, "touch targets ≥44px below 768px"): below 768px the
   * chip's Remove is the touch-target circle, as the queue row's identical Remove reaches the touch-target height (WR-405);
   * from 768px it keeps the 24px icon button (2.5.8). request-attachments.spec.ts measures it at 375 and 1440.
   */
  it('makes the chip’s Remove the 44px touch-target circle below 768px and the 24px icon button from 768px (UI-03)', async () => {
    withFiles();
    await userEvent.setup().upload(fileInput(), deck());
    const remove = within(chips()!).getByRole('button', { name: 'Remove architecture-deck.pptx from the list' });
    expect(remove).toHaveAttribute('data-size', 'icon-xs');
    expect(remove).toHaveClass('size-6', 'max-md:size-11', 'rounded-full');
    expect(remove, 'its icon is the 16px icon at the phone size').toHaveClass("max-md:[&_svg:not([class*='size-'])]:size-4");
  });

  it('takes a chip off the list with its Remove', async () => {
    const user = userEvent.setup();
    withFiles();
    await user.upload(fileInput(), deck());
    await user.click(screen.getByRole('button', { name: 'Remove architecture-deck.pptx from the list' }));
    expect(chips()).toBeNull();
    expect(screen.queryByText('Files are checked for malware, then added with your note.')).toBeNull();
  });

  it('checks a chosen file before anything is sent, and keeps a refused one with its reason (§1.3)', async () => {
    const user = userEvent.setup({ applyAccept: false });
    withFiles();
    await user.upload(fileInput(), new File(['MZ'], 'tool.exe', { lastModified: 3 }));
    const chip = within(chips()!).getByRole('listitem');
    expect(chip).toHaveTextContent('Not added. This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.');
  });

  it('refuses files with no text in §4 Forms’ words, and posts nothing (UI-D7)', async () => {
    const user = userEvent.setup();
    const { onSubmit, field } = withFiles();
    await user.upload(fileInput(), deck());
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('Write a note to say what these files are.')).toBeInTheDocument();
    expect(field).toHaveAttribute('aria-invalid', 'true');
    expect(onSubmit).not.toHaveBeenCalled();
    expect(within(chips()!).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
  });

  it('posts the note with its files and clears the chips', async () => {
    const user = userEvent.setup();
    const { onSubmit, field } = withFiles();
    await user.type(field, vendorNote);
    await user.upload(fileInput(), deck());
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalledTimes(1));
    expect(onSubmit).toHaveBeenCalledWith(vendorNote, { files: [expect.objectContaining({ name: 'architecture-deck.pptx' })] });
    expect(chips()).toBeNull();
    expect(field.value).toBe('');
  });

  it('puts the files back with the text when the note fails', async () => {
    const user = userEvent.setup();
    const { field } = withFiles(vi.fn(async () => ({ message: 'We couldn’t add your note. Try again.', retryable: true })));
    await user.type(field, vendorNote);
    await user.upload(fileInput(), deck());
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(await screen.findByText('We couldn’t add your note. Try again.')).toBeInTheDocument();
    expect(field.value).toBe(vendorNote);
    expect(within(chips()!).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
  });
});

const jane = { documentId: 'u-jane', displayName: 'Jane Doe' };

function added(overrides: Partial<RequestNote> = {}): RequestNote {
  return { documentId: 'n9', sequence: 1, body: vendorNote, authorPart: 'requestor', author: jane, postedAt: '2026-10-10T01:00:00.000Z', unread: false, ...overrides };
}

function uploaded(name: string) {
  return {
    ok: true,
    data: {
      documentId: `att-${name}`, fileName: name, fileType: 'pptx', byteSize: 3_727, state: 'available', uploadedBy: jane, uploaderPart: 'requestor',
      uploadedAt: '2026-10-10T01:00:01.000Z', note: { documentId: 'n9', postedAt: '2026-10-10T01:00:00.000Z' }, removedBy: null, removedAt: null,
      detection: null, actions: { download: true, remove: true, restore: false },
    },
  };
}

function later<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

function threadElement(props: Partial<NotesThreadProps> = {}) {
  const all: NotesThreadProps = {
    requestId: 'request-1', requestNumber: 'RAR-2026-0001', viewer: 'requestor', viewerPart: 'requestor', viewerName: 'Jane Doe',
    accepting: true, closedReason: null, notes: [], draftOwnerKey: 'owner-a', attach: { remaining: 19 }, ...props,
  };
  return <TimeZoneProvider zone="Australia/Sydney"><AttachmentFileStoreProvider><NotesThread {...all} /></AttachmentFileStoreProvider></TimeZoneProvider>;
}

function threadWithFiles(props: Partial<NotesThreadProps> = {}) {
  return render(threadElement(props));
}

async function writeWithFiles(files: File[]) {
  const user = userEvent.setup();
  await user.type(screen.getByRole('textbox', { name: 'Add a note' }), vendorNote);
  await user.upload(fileInput(), files);
  await user.click(screen.getByRole('button', { name: 'Add note' }));
}

/*
 * 14-UI-SPEC §4.2 (D-17, D-26): the note goes first through Phase 13's operation; once Strapi has recorded it, each file
 * is sent with that note's id, one at a time. If the note fails, it leaves and its text and files return to the composer.
 */
describe('posting a note with files (14-UI-SPEC §4.2)', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    vi.clearAllMocks();
  });

  it('adds the note first, then sends each file with that note’s id, one at a time', async () => {
    const first = later<unknown>();
    mocks.addRequestNoteAction.mockResolvedValue({ ok: true, data: added() });
    mocks.uploadAttachmentAction.mockImplementationOnce(() => first.promise).mockResolvedValueOnce(uploaded('data-flow.docx'));
    threadWithFiles();
    await writeWithFiles([deck(), flow()]);
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(1));
    expect(mocks.addRequestNoteAction).toHaveBeenCalledWith({ requestId: 'request-1', body: vendorNote });
    expect(mocks.addRequestNoteAction.mock.invocationCallOrder[0]).toBeLessThan(mocks.uploadAttachmentAction.mock.invocationCallOrder[0]!);
    const form = mocks.uploadAttachmentAction.mock.calls[0]![0] as FormData;
    expect(form.get('requestId')).toBe('request-1');
    expect(form.get('noteId')).toBe('n9');
    expect((form.get('file') as File).name).toBe('architecture-deck.pptx');
    await act(async () => first.resolve(uploaded('architecture-deck.pptx')));
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(2));
    expect(((mocks.uploadAttachmentAction.mock.calls[1]![0] as FormData).get('file') as File).name).toBe('data-flow.docx');
    expect((mocks.uploadAttachmentAction.mock.calls[1]![0] as FormData).get('noteId')).toBe('n9');
  });

  it('shows the note at once with Adding… and its files as rows at Waiting, and the composer clears', async () => {
    const answer = later<unknown>();
    mocks.addRequestNoteAction.mockImplementation(() => answer.promise);
    threadWithFiles();
    await writeWithFiles([deck()]);
    const pending = await screen.findByRole('article');
    expect(within(pending).getByText('Adding…')).toBeInTheDocument();
    const rows = within(pending).getByRole('list', { name: 'Files being added' });
    expect(within(rows).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
    expect(within(rows).getByRole('listitem')).toHaveTextContent('Waiting');
    expect(chips()).toBeNull();
    expect(mocks.uploadAttachmentAction).not.toHaveBeenCalled();
    await act(async () => answer.resolve({ ok: false, kind: 'retryable', message: 'We couldn’t add your note. Try again.' }));
  });

  it('removes a failed note and returns its text and its files to the composer, sending no file', async () => {
    mocks.addRequestNoteAction.mockResolvedValue({ ok: false, kind: 'retryable', message: 'We couldn’t add your note. Try again.' });
    threadWithFiles();
    await writeWithFiles([deck()]);
    expect(await screen.findByText('We couldn’t add your note. Try again.')).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Add a note' })).toHaveValue(vendorNote);
    expect(within(chips()!).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
    await waitFor(() => expect(screen.queryByRole('article')).toBeNull());
    expect(mocks.uploadAttachmentAction).not.toHaveBeenCalled();
  });

  /*
   * §4.3 (13 §9.4; UI-D10): the window closed while the note was written. Its text and files are kept in the read-only
   * well under the closed line, and `Discard note` discards both under one Undo toast, which brings both back.
   */
  it('keeps the note’s text and files in the well when notes close, and Discard note discards both under one Undo', async () => {
    const closed = 'Notes closed when the assessment was released, so this note wasn’t added.';
    mocks.addRequestNoteAction.mockResolvedValue({ ok: false, kind: 'blocked', reason: 'NOTES_CLOSED', message: closed });
    const view = threadWithFiles();
    await writeWithFiles([deck()]);
    expect(await screen.findByText(closed)).toBeInTheDocument();
    view.rerender(threadElement({ accepting: false, closedReason: 'released' }));
    expect(document.querySelector('[data-unsent-note]')?.textContent).toBe(vendorNote);
    const names = screen.getByRole('list', { name: 'Files to add with this note' });
    expect(within(names).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Discard note' }));
    expect(document.querySelector('[data-unsent-note]')).toBeNull();
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    expect(mocks.successToast).toHaveBeenCalledTimes(1);
    const undo = (mocks.successToast.mock.calls[0]?.[1] as { action?: { onClick: () => void } } | undefined)?.action;
    await act(async () => undo?.onClick());
    expect(document.querySelector('[data-unsent-note]')?.textContent).toBe(vendorNote);
    expect(within(screen.getByRole('list', { name: 'Files to add with this note' })).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
    expect(window.sessionStorage.getItem('csrm-draft:note:owner-a:request-1')).toBe(vendorNote);
  });

  /*
   * WR-505 (§10 row 1): while a note carrying files is being posted, its files live only in the thread, so an in-app link
   * asks first in the files' words, as it does while they are being added.
   */
  it('asks before an in-app link while a note with files is being posted, in the files’ words (WR-505)', async () => {
    const answer = later<unknown>();
    mocks.addRequestNoteAction.mockImplementation(() => answer.promise);
    render(<NavigationGuardProvider>{threadElement()}<GuardedLink href="/app/requests">My requests</GuardedLink></NavigationGuardProvider>);
    await writeWithFiles([deck()]);
    expect(within(await screen.findByRole('article')).getByText('Adding…')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('link', { name: 'My requests' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Leave while files are being added?' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Your files are still being added. If you leave now, the files not yet added won’t be.');
    await act(async () => answer.resolve({ ok: false, kind: 'retryable', message: 'We couldn’t add your note. Try again.' }));
  });

  it('asks nothing while a note without files is being posted, whose text the composer keeps (§10 row 3)', async () => {
    const answer = later<unknown>();
    mocks.addRequestNoteAction.mockImplementation(() => answer.promise);
    render(<NavigationGuardProvider>{threadElement()}<GuardedLink href="/app/requests">My requests</GuardedLink></NavigationGuardProvider>);
    const user = userEvent.setup();
    await user.type(screen.getByRole('textbox', { name: 'Add a note' }), vendorNote);
    await user.click(screen.getByRole('button', { name: 'Add note' }));
    expect(within(await screen.findByRole('article')).getByText('Adding…')).toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'My requests' }));
    expect(screen.queryByRole('alertdialog')).toBeNull();
    await act(async () => answer.resolve({ ok: false, kind: 'retryable', message: 'We couldn’t add your note. Try again.' }));
  });

  /*
   * IN-504 (§4.3; 2.4.3): with files and no text, Discard note empties the well, and Undo brings the files back with focus
   * on the well's Discard note, never the page; the toasts say Note, because the note had files.
   */
  it('keeps focus in the well when Undo gives back a note of files alone, and says Note discarded. and Note restored. (IN-504)', async () => {
    const user = userEvent.setup();
    const view = threadWithFiles();
    await user.upload(fileInput(), deck());
    view.rerender(threadElement({ accepting: false, closedReason: 'released' }));
    expect(document.querySelector('[data-unsent-note]')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Discard note' }));
    expect(screen.queryByRole('list', { name: 'Files to add with this note' })).toBeNull();
    expect(mocks.successToast).toHaveBeenCalledWith('Note discarded.', expect.objectContaining({ action: expect.objectContaining({ label: 'Undo' }) }));
    const undo = (mocks.successToast.mock.calls.at(-1)?.[1] as { action?: { onClick: () => void } } | undefined)?.action;
    await act(async () => undo?.onClick());
    expect(within(screen.getByRole('list', { name: 'Files to add with this note' })).getByRole('listitem')).toHaveTextContent('architecture-deck.pptx');
    expect(mocks.successToast).toHaveBeenLastCalledWith('Note restored.');
    await waitFor(() => expect(screen.getByRole('button', { name: 'Discard note' })).toHaveFocus());
  });
});

/* IN-407's follow-on: the composer's drop state is control state, so it eases at the direction's micro duration token. */
describe('the composer as a drop target (14-UI-SPEC §4.1; X-19)', () => {
  it('eases its drop state at the direction’s micro duration token, with no raw duration', () => {
    withFiles();
    const classes = (fileInput().closest('[data-file-drop]') as HTMLElement).className.split(/\s+/);
    expect(classes).toContain('duration-(--duration-micro)');
    expect(classes.filter((name) => /^duration-\d+$/.test(name))).toEqual([]);
  });
});
