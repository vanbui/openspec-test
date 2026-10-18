import { act, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type { RequestAttachmentSummary } from '@/features/requests/request-domain';
import type { RequestAttachment, RequestAttachmentAiPolicy, RequestAttachmentsPage } from './attachments-schema';

const mocks = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('./attachments-actions', () => ({
  uploadAttachmentAction: vi.fn(), downloadAttachmentAction: vi.fn(), setAttachmentRemovalAction: vi.fn(),
  setAttachmentAiInputAction: vi.fn(), getAttachmentAiTextAction: vi.fn(),
}));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));

import userEvent from '@testing-library/user-event';

import { TimeZoneProvider } from '@/components/csrm/local-time';
import { NoteComposer } from '@/features/request-notes/note-composer';
import { setAttachmentRemovalAction, uploadAttachmentAction } from './attachments-actions';
import { AttachmentFileStoreProvider } from './file-store';
import { FilesSection, filesSectionFor, type FilesSectionProps } from './files-section';

const OWNER = 'owner-key-jane';

function attachment(overrides: Partial<RequestAttachment> = {}): RequestAttachment {
  return {
    documentId: 'att-1', fileName: 'vendor-security-pack.pdf', fileType: 'pdf', byteSize: 655_000, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: null, removedBy: null, removedAt: null, detection: null, actions: { download: true, remove: true, restore: false }, ...overrides,
  };
}

const draftSummary: RequestAttachmentSummary = {
  count: 1, canAdd: true, refusal: null, window: 'intake', needsNote: false, remaining: 19, activeCount: 1, storedCount: 1,
  limits: { maxBytes: 26_214_400, maxActive: 20, maxStored: 60 }, allowedTypes: ['pdf', 'docx', 'xlsx', 'pptx', 'csv', 'txt', 'png', 'jpeg'],
};

function page(attachments: RequestAttachment[], summary: RequestAttachmentSummary = draftSummary): RequestAttachmentsPage {
  const { count: _count, ...add } = summary;
  return { attachments, meta: { total: attachments.length, removed: 0, add: { ...add, allowedTypes: [...add.allowedTypes] } } };
}

function section(props: Partial<FilesSectionProps> = {}) {
  return render(
    <TimeZoneProvider zone="Australia/Sydney">
      <AttachmentFileStoreProvider>
        <FilesSection attachments={page([attachment()])} draftOwnerKey={OWNER} requestId="req-1" summary={draftSummary} viewer="requestor" {...props} />
      </AttachmentFileStoreProvider>
    </TimeZoneProvider>,
  );
}

afterEach(() => {
  vi.clearAllMocks();
});

/* 14-UI-SPEC §3 (D-27, D-28; X-21): the draft's Files section on the Requestor's request page. */
describe('the Files section on Jane’s draft (§3.1, §3.2)', () => {
  it('heads the section Files at the region the hub links to, and tells the Requestor who may use the files', () => {
    section();
    const heading = screen.getByRole('heading', { level: 2, name: 'Files' });
    expect(heading).toHaveAttribute('id', 'files');
    expect(heading).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('region', { name: 'Files' })).toHaveAccessibleDescription(
      'Files for this request, from you and the Security Analysts. Each file is checked for malware before anyone can download it. A Security Analyst may include a file’s text in the information CSRM sends to the AI, within your organisation’s data policy.',
    );
  });

  it('counts the files and lists each with its type, name, size, who added it with their part, when, and where it came from', () => {
    section();
    expect(screen.getByText('1 file', { exact: true })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Files' });
    const row = within(table).getAllByRole('row')[1]!;
    expect(within(row).getByText('vendor-security-pack.pdf')).toBeInTheDocument();
    expect(within(row).getByText('PDF')).toBeInTheDocument();
    expect(within(row).getByText('640 KB')).toBeInTheDocument();
    expect(within(row).getByText('Jane Doe')).toBeInTheDocument();
    expect(within(row).getByText('Requestor')).toBeInTheDocument();
    expect(row.querySelector('time')).toHaveAttribute('dateTime', '2026-10-10T01:00:00.000Z');
    expect(within(row).getByText('Before submission')).toBeInTheDocument();
  });

  it('shows the same facts on each phone card', () => {
    section();
    const cards = screen.getByRole('list', { name: 'Files' });
    const card = within(cards).getAllByRole('listitem')[0]!;
    expect(within(card).getByText('vendor-security-pack.pdf')).toBeInTheDocument();
    expect(card).toHaveTextContent('PDF · 640 KB');
    expect(card).toHaveTextContent('Jane Doe · Requestor · ');
    expect(within(card).getByText('Before submission')).toBeInTheDocument();
  });

  it('offers the file field labelled Add files on the draft, with how many more can be added', async () => {
    section();
    const input = await screen.findByLabelText('Add files');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAccessibleDescription('PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG · up to 25 MB each · 19 more can be added to this request');
    expect(screen.getByRole('button', { name: 'Choose files' })).toBeInTheDocument();
  });

  it('says what to do next when the draft has no file yet, and the field is the call to action', async () => {
    section({ attachments: page([], { ...draftSummary, count: 0, remaining: 20, activeCount: 0, storedCount: 0 }), summary: { ...draftSummary, count: 0, remaining: 20, activeCount: 0, storedCount: 0 } });
    expect(screen.getByText('No files yet')).toBeInTheDocument();
    expect(screen.getByText('Add documents that help a Security Analyst understand this request, such as a vendor’s security pack or a data-flow diagram.')).toBeInTheDocument();
    expect(screen.queryByRole('table', { name: 'Files' })).toBeNull();
    expect(await screen.findByLabelText('Add files')).toBeInTheDocument();
  });

  it('renders a file name as text, never as markup (X-23, T-14-45)', () => {
    section({ attachments: page([attachment({ fileName: '<img src=x onerror=alert(1)>.pdf' })]) });
    expect(screen.getAllByText('<img src=x onerror=alert(1)>.pdf').length).toBeGreaterThan(0);
    expect(document.querySelector('img')).toBeNull();
  });
});

const submittedSummary: RequestAttachmentSummary = { ...draftSummary, window: 'after-submission', needsNote: true };

function lockedSummary(refusal: NonNullable<RequestAttachmentSummary['refusal']>, overrides: Partial<RequestAttachmentSummary> = {}): RequestAttachmentSummary {
  return { ...draftSummary, canAdd: false, refusal, ...overrides };
}

/** The section with no files yet, for this summary and viewer. */
function emptySection(summary: RequestAttachmentSummary, viewer: FilesSectionProps['viewer'] = 'requestor') {
  const none = { ...summary, count: 0, activeCount: 0 };
  return section({ attachments: page([], none), summary: none, viewer });
}

/*
 * 14-UI-SPEC §3.7: an empty Files section says what to do next by actor and window; where files cannot be added it reads
 * `No files` with the line that says why (§1.2, §3.6).
 */
describe('the Files section’s empty states and lines (§1.2, §3.6, §3.7)', () => {
  it('tells the Requestor of a submitted request to add files with a note', () => {
    emptySection(submittedSummary);
    expect(screen.getByText('No files yet')).toBeInTheDocument();
    expect(screen.getByText('Add files with a note when a Security Analyst asks for them, or when you have more to share.')).toBeInTheDocument();
  });

  it('tells a Security Analyst of a submitted request to add files with a note for the Requestor', () => {
    emptySection(submittedSummary, 'analyst');
    expect(screen.getByText('No files yet')).toBeInTheDocument();
    expect(screen.getByText('Add files with a note to share documents with the Requestor.')).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Files' })).toHaveAccessibleDescription(
      'Files from the Requestor and the Security Analysts. Each file is checked for malware before anyone can download it. Include a file’s text to use it in AI generation.',
    );
  });

  it('reads No files on a closed request, with the closed line in place of the field', () => {
    emptySection(lockedSummary('ATTACHMENTS_CLOSED', { window: 'closed' }));
    expect(screen.getByText('No files')).toBeInTheDocument();
    expect(screen.getByText('Files closed when the assessment was released. They stay here as part of the record.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add files')).toBeNull();
  });

  it('reads No files on a returned draft for a Security Analyst, with the paused line', () => {
    emptySection(lockedSummary('REQUEST_NOT_SUBMITTED'), 'analyst');
    expect(screen.getByText('No files')).toBeInTheDocument();
    expect(screen.getByText('Files are paused while this request is a draft. They can be added again once the Requestor resubmits it.')).toBeInTheDocument();
  });

  it.each([
    ['ATTACHMENT_LIFETIME_LIMIT_REACHED', 'This request has reached the most files it can keep, counting removed ones, so no more can be added.'],
    ['ATTACHMENTS_NOT_CONFIGURED', 'Files can’t be added right now because file storage isn’t set up. Contact your administrator.'],
  ] as const)('replaces the field with the line for %s', (refusal, line) => {
    section({ summary: lockedSummary(refusal), attachments: page([attachment()], lockedSummary(refusal)) });
    expect(screen.getByText(line)).toBeInTheDocument();
    expect(screen.queryByLabelText('Add files')).toBeNull();
  });

  it('gives way to the limit line at 20 files', () => {
    const full = lockedSummary('ATTACHMENT_LIMIT_REACHED', { count: 20, activeCount: 20, storedCount: 20, remaining: 0 });
    const twenty = Array.from({ length: 20 }, (_, index) => attachment({ documentId: `att-${index}`, fileName: `file-${index}.pdf` }));
    section({ summary: full, attachments: page(twenty, full) });
    expect(screen.getByText('20 files', { exact: true })).toBeInTheDocument();
    expect(screen.getByText('This request has 20 files, the most it can hold. Remove a file to add another.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add files')).toBeNull();
  });

  it('offers no Remove and no field on a closed request, as the server’s actions say', () => {
    const closed = lockedSummary('ATTACHMENTS_CLOSED', { window: 'closed' });
    section({ summary: closed, attachments: page([attachment({ actions: { download: true, remove: false, restore: false } })], closed) });
    expect(screen.queryByRole('button', { name: /^Remove / })).toBeNull();
    expect(screen.queryByLabelText('Add files')).toBeNull();
    expect(screen.getAllByRole('button', { name: 'Download vendor-security-pack.pdf' }).length).toBeGreaterThan(0);
  });
});

/*
 * WR-401 (14-UI-SPEC §1.2, §1.5): a file not added is kept for the tab and returns with its reason and actions wherever
 * its draft lists it. When Strapi says no more files can be added, only the field gives way to §1.2's line: the kept
 * rows stay listed, so `Remove from list` is always reachable, and removing the last one disarms the unload warning.
 */
describe('files not added once the draft can take no more (§1.2, §1.5; WR-401)', () => {
  const pdf = (name: string) => new File(['%PDF-1.7'], name, { type: 'application/pdf', lastModified: 1 });
  const nineteen = Array.from({ length: 19 }, (_, index) => attachment({ documentId: `att-${index}`, fileName: `file-${index}.pdf` }));
  const open = { ...draftSummary, count: 19, activeCount: 19, storedCount: 19, remaining: 1 };
  const full = lockedSummary('ATTACHMENT_LIMIT_REACHED', { count: 20, activeCount: 20, storedCount: 20, remaining: 0 });

  function draftPage(summary: RequestAttachmentSummary, files: RequestAttachment[]) {
    return (
      <TimeZoneProvider zone="Australia/Sydney">
        <AttachmentFileStoreProvider>
          <FilesSection attachments={page(files, summary)} draftOwnerKey={OWNER} requestId="req-1" summary={summary} viewer="requestor" />
        </AttachmentFileStoreProvider>
      </TimeZoneProvider>
    );
  }

  const unloadWarned = () => {
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    return unload.defaultPrevented;
  };

  it('keeps the refused row listed with Remove from list once the draft is full, and removing it disarms the unload warning', async () => {
    vi.mocked(uploadAttachmentAction).mockResolvedValue({ ok: true, data: attachment({ documentId: 'att-one', fileName: 'one.pdf' }) });
    const view = render(draftPage(open, nineteen));
    const user = userEvent.setup({ applyAccept: false });

    await user.upload(await screen.findByLabelText('Add files'), [pdf('one.pdf'), pdf('two.pdf')]);
    await waitFor(() => expect(uploadAttachmentAction).toHaveBeenCalledTimes(1));
    expect(await screen.findByText('1 of 2 files added · 1 not added')).toBeInTheDocument();

    /* The page's next read: 20 active files, so Strapi says no more can be added. */
    view.rerender(draftPage(full, [...nineteen, attachment({ documentId: 'att-one', fileName: 'one.pdf' })]));

    expect(screen.getByText('This request has 20 files, the most it can hold. Remove a file to add another.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add files')).toBeNull();
    const queue = screen.getByRole('list', { name: 'Files being added' });
    const kept = within(queue).getAllByRole('listitem');
    expect(kept).toHaveLength(1);
    expect(kept[0]).toHaveTextContent('two.pdf');
    expect(kept[0]).toHaveTextContent('Not added. This request already has 20 files. Remove a file to add another.');
    expect(unloadWarned()).toBe(true);

    await user.click(within(kept[0]!).getByRole('button', { name: 'Remove from list: two.pdf' }));

    expect(screen.queryByRole('list', { name: 'Files being added' })).toBeNull();
    expect(unloadWarned()).toBe(false);
    /* §1.4: with no row left and no field, focus goes to §1.2's line, which stands where `Choose files` was. */
    expect(screen.getByText('This request has 20 files, the most it can hold. Remove a file to add another.').closest('p')).toHaveFocus();
  });

  it('keeps a failed transfer listed with Retry when file storage stops being configured', async () => {
    vi.mocked(uploadAttachmentAction).mockResolvedValue({ ok: false, kind: 'retryable', offerNewNote: false, message: 'We couldn’t add this file. Try again.' });
    const view = render(draftPage(draftSummary, [attachment()]));
    const user = userEvent.setup({ applyAccept: false });
    await user.upload(await screen.findByLabelText('Add files'), [pdf('pack.pdf')]);
    await screen.findByRole('button', { name: 'Retry pack.pdf' });

    const unconfigured = lockedSummary('ATTACHMENTS_NOT_CONFIGURED');
    view.rerender(draftPage(unconfigured, [attachment()]));

    expect(screen.getByText('Files can’t be added right now because file storage isn’t set up. Contact your administrator.')).toBeInTheDocument();
    expect(screen.queryByLabelText('Add files')).toBeNull();
    expect(screen.getByRole('button', { name: 'Retry pack.pdf' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Remove from list: pack.pdf' })).toBeInTheDocument();
  });
});

/* §3.7: the files read failed and the page did not. The section says so compactly and Try again reads the files again. */
/*
 * The pilot's walk, D6 (G-4; §3.1, §3.5): the count line counts the main list as it shows, so it moves with a row whose
 * removal or restore waits for Strapi, rolls back with the row if Strapi refuses, and keeps Strapi's answer until the
 * page reads the list again.
 */
describe('the count line moves with the list (§3.1, §3.5; the pilot’s walk, D6)', () => {
  const FLOW = 'data-flow.docx';
  const OLD = 'old-pack.pdf';
  const flow = () => attachment({ documentId: 'att-flow', fileName: FLOW, fileType: 'docx', uploadedAt: '2026-10-10T00:30:00.000Z' });
  const removedOld = () => attachment({
    documentId: 'att-old', fileName: OLD, state: 'removed', removedBy: { documentId: 'u-jane', displayName: 'Jane Doe' },
    removedAt: '2026-10-10T03:00:00.000Z', actions: { download: false, remove: false, restore: true },
  });
  /* The list read as Strapi serves it: `meta.total` counts the files not removed. */
  function listRead(attachments: RequestAttachment[]): RequestAttachmentsPage {
    const read = page(attachments);
    return { ...read, meta: { ...read.meta, total: attachments.filter((file) => file.state !== 'removed').length } };
  }
  const countLine = () => document.querySelector('[data-files-count]');
  const refused = { ok: false, kind: 'blocked', message: 'This file can no longer be changed. Refresh the page.' };

  it('counts one fewer while a removal waits for Strapi, and rolls back with the row when Strapi refuses', async () => {
    let settle: (value: unknown) => void = () => undefined;
    vi.mocked(setAttachmentRemovalAction).mockImplementation(() => new Promise((resolve) => { settle = resolve as (value: unknown) => void; }));
    const user = userEvent.setup();
    section({ attachments: listRead([attachment(), flow()]) });
    expect(countLine()).toHaveTextContent(/^2 files$/);

    await user.click(screen.getByRole('button', { name: 'Remove vendor-security-pack.pdf' }));

    expect(countLine(), 'the count moves with the row').toHaveTextContent(/^1 file$/);
    await act(async () => settle(refused));
    await waitFor(() => expect(countLine(), 'and rolls back with it').toHaveTextContent(/^2 files$/));
  });

  it('keeps the count Strapi answered until the page reads the list again', async () => {
    const pack = attachment();
    vi.mocked(setAttachmentRemovalAction).mockResolvedValue({ ok: true, data: { ...pack, state: 'removed', removedAt: '2026-10-10T04:00:00.000Z', actions: { download: false, remove: false, restore: true } } });
    const user = userEvent.setup();
    section({ attachments: listRead([pack, flow()]) });

    await user.click(screen.getByRole('button', { name: 'Remove vendor-security-pack.pdf' }));

    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());
    expect(countLine()).toHaveTextContent(/^1 file$/);
  });

  it('counts one more while a restore waits for Strapi, and rolls back when Strapi refuses', async () => {
    let settle: (value: unknown) => void = () => undefined;
    vi.mocked(setAttachmentRemovalAction).mockImplementation(() => new Promise((resolve) => { settle = resolve as (value: unknown) => void; }));
    const user = userEvent.setup();
    section({ attachments: listRead([attachment(), removedOld()]) });
    expect(countLine()).toHaveTextContent(/^1 file$/);
    await user.click(screen.getByRole('button', { name: 'Show removed files (1)' }));

    await user.click(screen.getByRole('button', { name: `Restore ${OLD}` }));

    expect(countLine(), 'the count moves with the row').toHaveTextContent(/^2 files$/);
    await act(async () => settle(refused));
    await waitFor(() => expect(countLine(), 'and rolls back with it').toHaveTextContent(/^1 file$/));
  });
});

describe('the Files section when its read fails (§3.7)', () => {
  it('says We couldn’t load the files, keeps the field, and Try again refreshes the page’s reads', async () => {
    section({ attachments: null });
    expect(screen.getByRole('heading', { name: 'We couldn’t load the files' })).toBeInTheDocument();
    expect(await screen.findByLabelText('Add files')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Try again' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
  });
});

/*
 * D-18 (T-14-47): both request pages ask this one question of the request read. A viewer the read gave no file summary,
 * another Requestor or a participant, gets nothing of the files: no section, no count, no read.
 */
describe('filesSectionFor (D-18)', () => {
  const context = { viewer: 'requestor' as const, draftOwnerKey: OWNER };

  it('gives no section to a read without a file summary', () => {
    expect(filesSectionFor({ documentId: 'req-1' }, null, context)).toBeNull();
    expect(filesSectionFor({ documentId: 'req-1', attachments: undefined }, null, context)).toBeNull();
  });

  it('gives the section its props for a read with a file summary, and null files when their read failed', () => {
    const files = page([attachment()]);
    expect(filesSectionFor({ documentId: 'req-1', attachments: draftSummary }, { data: files, error: null }, context)).toEqual({
      requestId: 'req-1', summary: draftSummary, attachments: files, viewer: 'requestor', draftOwnerKey: OWNER,
    });
    expect(filesSectionFor({ documentId: 'req-1', attachments: draftSummary }, { data: null, error: { message: 'Down', status: 503 } }, context)?.attachments).toBeNull();
  });
});

/* §3.7 Loading: each request page's skeleton gains a Files block before its Notes block. */
describe('the Files block of both request pages’ loading states (§3.7)', () => {
  it('renders a heading line, three rows, three phone cards and a field-height block, before the Notes block', async () => {
    const requestor = await import('../../../app/(app)/app/requests/[documentId]/loading');
    const analyst = await import('../../../app/(app)/app/review/requests/[documentId]/loading');
    for (const Loading of [requestor.default, analyst.default]) {
      const { container, unmount } = render(<Loading />);
      const files = container.querySelector('[data-files-skeleton]');
      const notes = container.querySelector('[data-notes-skeleton]');
      expect(files).not.toBeNull();
      expect(files!.compareDocumentPosition(notes!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
      expect(files!).toHaveAttribute('aria-hidden', 'true');
      expect(files!.querySelectorAll('[data-files-skeleton-row]')).toHaveLength(3);
      expect(files!.querySelectorAll('[data-files-skeleton-card]')).toHaveLength(3);
      expect(files!.querySelector('[data-files-skeleton-field]')).not.toBeNull();
      unmount();
    }
  });
});

/*
 * 14-UI-SPEC §3.6, §4.1 (D-17, D-27; UI-D6): after submission every file travels with a note, so the Files section's
 * field is `Add files with a note` and hands the chosen files to the Notes composer: they join its chips, the page
 * scrolls to the composer, its textarea takes focus, and the caption says what to do. Nothing is sent from the field.
 */
describe('Add files with a note after submission (§3.6, §4.1; UI-D6)', () => {
  const deck = () => new File([new Uint8Array(3_727)], 'architecture-deck.pptx', { lastModified: 1 });
  const flow = () => new File([new Uint8Array(1_567)], 'data-flow.docx', { lastModified: 2 });

  function pageWithComposer(viewer: FilesSectionProps['viewer'] = 'requestor') {
    return render(
      <TimeZoneProvider zone="Australia/Sydney">
        <AttachmentFileStoreProvider>
          <FilesSection attachments={page([attachment()], submittedSummary)} draftOwnerKey={OWNER} requestId="req-1" summary={submittedSummary} viewer={viewer} />
          <NoteComposer attach={{ remaining: 19 }} draftOwnerKey={OWNER} hint="Notes hint" onSubmit={vi.fn(async () => null)} requestId="req-1" />
        </AttachmentFileStoreProvider>
      </TimeZoneProvider>,
    );
  }

  it('labels the field Add files with a note, with the line before the type list', async () => {
    pageWithComposer();
    const input = await screen.findByLabelText('Add files with a note');
    expect(input).toHaveAttribute('type', 'file');
    expect(input).toHaveAccessibleDescription(
      'Files are added with a note, so everyone knows what they are. PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG · up to 25 MB each · 19 more can be added to this request',
    );
    expect(screen.queryByLabelText('Add files')).toBeNull();
  });

  it('offers the same field to a Security Analyst', async () => {
    pageWithComposer('analyst');
    expect(await screen.findByLabelText('Add files with a note')).toBeInTheDocument();
  });

  it('hands two chosen files to the composer’s chips, scrolls to it, focuses its textarea and says what to do, sending nothing', async () => {
    const scrolled = vi.fn();
    Element.prototype.scrollIntoView = scrolled;
    pageWithComposer();
    await userEvent.setup().upload(await screen.findByLabelText('Add files with a note'), [deck(), flow()]);
    const chips = screen.getByRole('list', { name: 'Files to add with this note' });
    expect(within(chips).getAllByRole('listitem').map((chip) => chip.textContent)).toEqual([expect.stringContaining('architecture-deck.pptx'), expect.stringContaining('data-flow.docx')]);
    const field = screen.getByRole('textbox', { name: 'Add a note' });
    await waitFor(() => expect(field).toHaveFocus());
    expect(scrolled).toHaveBeenCalled();
    const caption = screen.getByText('Write a note to say what these files are, then add it.');
    expect(caption.compareDocumentPosition(chips) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole('list', { name: 'Files being added' })).toBeNull();
    expect(uploadAttachmentAction).not.toHaveBeenCalled();
  });
});

/*
 * 14-UI-SPEC §5.1 (D-28, D-30; UI-D21; G-1): for a Security Analyst one line under the section's description says what
 * may be included, or why nothing can be, once for the section rather than on every file. The Requestor keeps §3.1's
 * sentence and nothing else.
 */
describe('the section’s AI line (§5.1; UI-D21)', () => {
  const ai = { included: false, facts: null, unavailableReason: null, canChange: false };

  function analystSection(aiPolicy: RequestAttachmentAiPolicy, file: RequestAttachment = attachment({ ai: { ...ai, canChange: aiPolicy.canChange } })) {
    const { count: _count, ...add } = submittedSummary;
    const attachments: RequestAttachmentsPage = { attachments: [file], meta: { total: 1, removed: 0, add: { ...add, allowedTypes: [...add.allowedTypes] }, aiPolicy } };
    return section({ attachments, summary: submittedSummary, viewer: 'analyst' });
  }

  /** The file's AI facts have loaded (the control loads on demand), so the absence of a switch means something. */
  async function controlLoaded() {
    const table = screen.getByRole('table', { name: 'Files' });
    expect(await within(table).findByText('Not included', { exact: true })).toBeInTheDocument();
  }

  it('tells the analyst who raised the request that another Security Analyst decides, and renders no switch (G-1)', async () => {
    analystSection({ canChange: false, refusal: 'OWN_REQUEST', classification: 'Internal', ceiling: 'Restricted' });
    const files = screen.getByRole('region', { name: 'Files' });
    expect(within(files).getByText('You raised this request, so another Security Analyst decides which files the AI uses.', { exact: true })).toBeInTheDocument();
    await controlLoaded();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('names the classification and the approved limit when the request is classified above it, with no switch', async () => {
    analystSection({ canChange: false, refusal: 'AI_CLASSIFICATION_ABOVE_CEILING', classification: 'Restricted', ceiling: 'Internal' });
    expect(screen.getByText('Files can’t be included in the AI inputs: this request’s information is classified Restricted, above the Internal limit the AI provider is approved for.', { exact: true })).toBeInTheDocument();
    await controlLoaded();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('says the AI provider isn’t approved yet when no policy is set', async () => {
    analystSection({ canChange: false, refusal: 'AI_POLICY_NOT_CONFIGURED', classification: 'Internal', ceiling: null });
    expect(screen.getByText('Files can’t be included in the AI inputs, because the AI provider hasn’t been approved for any information classification yet. Contact your administrator.', { exact: true })).toBeInTheDocument();
    await controlLoaded();
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('asks the analyst to include only files within the request’s classification when inclusion is allowed', async () => {
    analystSection({ canChange: true, refusal: null, classification: 'Internal', ceiling: 'Restricted' });
    expect(screen.getByText('Include only files whose content is within this request’s Internal classification.', { exact: true })).toBeInTheDocument();
    const table = screen.getByRole('table', { name: 'Files' });
    expect(await within(table).findByRole('switch', { name: 'Changes the AI inputs' })).toBeInTheDocument();
  });

  it('gives the Requestor §3.1’s sentence only', () => {
    section({ attachments: page([attachment()], submittedSummary), summary: submittedSummary, viewer: 'requestor' });
    const files = screen.getByRole('region', { name: 'Files' });
    expect(files).toHaveAccessibleDescription(/A Security Analyst may include a file’s text in the information CSRM sends to the AI/);
    expect(within(files).queryByText(/Include only files|another Security Analyst decides|can’t be included in the AI inputs/)).toBeNull();
    expect(within(files).queryByText(/AI inputs/)).toBeNull();
  });
});
