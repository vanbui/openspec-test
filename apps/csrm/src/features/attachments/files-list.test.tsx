import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ExternalToast } from 'sonner';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestAttachment } from './attachments-schema';

const mocks = vi.hoisted(() => ({
  downloadAttachmentAction: vi.fn(),
  setAttachmentRemovalAction: vi.fn(),
  setAttachmentAiInputAction: vi.fn(),
  saveFile: vi.fn(),
  refresh: vi.fn(),
  successToast: vi.fn(),
  toastError: vi.fn(),
}));
vi.mock('./attachments-actions', () => ({
  downloadAttachmentAction: mocks.downloadAttachmentAction,
  setAttachmentRemovalAction: mocks.setAttachmentRemovalAction,
  setAttachmentAiInputAction: mocks.setAttachmentAiInputAction,
  getAttachmentAiTextAction: vi.fn(),
}));
vi.mock('@/lib/files/save-file', () => ({ saveFile: mocks.saveFile }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));
vi.mock('@/components/ui/success-toast', () => ({ successToast: mocks.successToast }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));

import { TimeZoneProvider } from '@/components/csrm/local-time';
import { installTestResizeObserver, stubHorizontalGeometry, TestResizeObserver } from '@/test/layout-stubs';
import { FilesList, type FilesListProps } from './files-list';

type ToastOptions = ExternalToast & { action?: { label: string; onClick: () => void } };

const PACK = 'vendor-security-pack.pdf';

function attachment(overrides: Partial<RequestAttachment> = {}): RequestAttachment {
  return {
    documentId: 'att-pack', fileName: PACK, fileType: 'pdf', byteSize: 1457, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: null, removedBy: null, removedAt: null, detection: null, actions: { download: true, remove: false, restore: false }, ...overrides,
  };
}

const empty = { kind: 'first-use', description: 'Add files with a note to share documents with the Requestor.' } as const;

/** The list read's `meta.total`: the files not removed. */
const totalOf = (attachments: readonly RequestAttachment[]) => attachments.filter((file) => file.state !== 'removed').length;

function list(props: Partial<FilesListProps> = {}) {
  const attachments = props.attachments ?? [attachment()];
  return render(
    <TimeZoneProvider zone="Australia/Sydney">
      <FilesList attachments={attachments} densityUserId="owner-bob" empty={empty} requestId="req-1" total={totalOf(attachments)} viewer="analyst" {...props} />
    </TimeZoneProvider>,
  );
}

/** The file's row in the table, the layout shown from 768px. */
function tableRow(name: string): HTMLElement {
  const table = screen.getByRole('table', { name: 'Files' });
  return within(table).getAllByRole('row').find((row) => within(row).queryByText(name) !== null)!;
}

afterEach(() => {
  vi.clearAllMocks();
});

/*
 * D-23, D-24 (14-UI-SPEC §3.3, UI-D15, UI-D25): Bob downloads Jane's security pack. `Download` is an explicit outline
 * button named for its file; while the file comes it reads `Downloading…`; once the browser has it a visually hidden
 * status says so once, and no toast shows. A refusal is a danger toast titled `File not downloaded` with family O's words.
 */
describe('Download on the Files list (§3.3)', () => {
  it('offers Download named for its file to a reader of an available file', () => {
    list();
    const download = within(tableRow(PACK)).getByRole('button', { name: `Download ${PACK}` });
    expect(download).toHaveTextContent('Download');
  });

  it('shows Downloading… while the file comes, then saves it and says so once, with no toast', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 security pack');
    let settle: (value: unknown) => void = () => undefined;
    mocks.downloadAttachmentAction.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    const user = userEvent.setup();
    list();

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Download ${PACK}` }));
    expect(mocks.downloadAttachmentAction).toHaveBeenCalledWith({ requestId: 'req-1', attachmentId: 'att-pack' });
    expect(within(tableRow(PACK)).getByRole('button', { name: `Downloading… ${PACK}` })).toHaveTextContent('Downloading…');
    expect(mocks.saveFile).not.toHaveBeenCalled();

    await act(async () => settle({ ok: true, fileName: PACK, contentType: 'application/pdf', bytes }));

    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalledTimes(1));
    expect(mocks.saveFile).toHaveBeenCalledWith({ fileName: PACK, contentType: 'application/pdf', bytes });
    expect(screen.getAllByText(`${PACK} downloaded.`)).toHaveLength(1);
    expect(screen.getByText(`${PACK} downloaded.`)).toHaveAttribute('role', 'status');
    expect(within(tableRow(PACK)).getByRole('button', { name: `Download ${PACK}` })).toBeInTheDocument();
    expect(mocks.successToast).not.toHaveBeenCalled();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it('shows a refused download as a danger toast titled File not downloaded, with family O’s words and Refresh page', async () => {
    mocks.downloadAttachmentAction.mockResolvedValue({ ok: false, kind: 'blocked', message: 'This file is still waiting for its malware check. Try again later.' });
    const user = userEvent.setup();
    list();

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Download ${PACK}` }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    const [title, options] = mocks.toastError.mock.calls[0] as [string, ToastOptions];
    expect(title).toBe('File not downloaded');
    expect(options.description).toBe('This file is still waiting for its malware check. Try again later.');
    expect(options.action?.label).toBe('Refresh page');
    expect(mocks.saveFile).not.toHaveBeenCalled();
    expect(screen.queryByText(`${PACK} downloaded.`)).toBeNull();
  });

  it('offers Try again on a download that failed on the way, and trying again downloads it', async () => {
    mocks.downloadAttachmentAction.mockResolvedValueOnce({ ok: false, kind: 'retryable', message: 'We couldn’t download the file. Try again.' });
    mocks.downloadAttachmentAction.mockResolvedValueOnce({ ok: true, fileName: PACK, contentType: 'application/pdf', bytes: new Uint8Array([37, 80, 68, 70]) });
    const user = userEvent.setup();
    list();

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Download ${PACK}` }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    const options = mocks.toastError.mock.calls[0]?.[1] as ToastOptions;
    expect(options.action?.label).toBe('Try again');

    await act(async () => options.action?.onClick());
    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalledTimes(1));
  });

  it('shows a file waiting for its malware check with its badge and line, and no Download', () => {
    list({ attachments: [attachment({ state: 'pending', actions: { download: false, remove: false, restore: false } })] });
    const row = tableRow(PACK);
    expect(within(row).getByText('Waiting for malware check')).toBeInTheDocument();
    expect(within(row).getByText('It can be downloaded once it passes. Refresh the page later to see.')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: `Download ${PACK}` })).toBeNull();
  });

  it('shows an available file with no badge', () => {
    list();
    const row = tableRow(PACK);
    expect(row.querySelector('[data-slot="badge"]')).toBeNull();
    expect(within(row).queryByText('Available')).toBeNull();
  });
});

const FLOW = 'data-flow.docx';
const jane = { documentId: 'u-jane', displayName: 'Jane Doe' };

function flow(overrides: Partial<RequestAttachment> = {}): RequestAttachment {
  return attachment({ documentId: 'att-flow', fileName: FLOW, fileType: 'docx', uploadedAt: '2026-10-10T00:30:00.000Z', ...overrides });
}

const removable = { download: true, remove: true, restore: false };

function removedFile(name: string, id: string, restore: boolean): RequestAttachment {
  return attachment({
    documentId: id, fileName: name, state: 'removed', removedBy: jane, removedAt: '2026-10-10T03:00:00.000Z',
    actions: { download: false, remove: false, restore },
  });
}

/** What the removal answers: the file as the caller now sees it. */
function answered(file: RequestAttachment, removed: boolean): { ok: true; data: RequestAttachment } {
  return removed
    ? { ok: true, data: { ...file, state: 'removed', removedBy: jane, removedAt: '2026-10-10T04:00:00.000Z', actions: { download: false, remove: false, restore: true } } }
    : { ok: true, data: { ...file, state: 'available', removedBy: null, removedAt: null, actions: removable } };
}

function lastSuccess(): [string, { action?: { label: string; onClick: () => void } } | undefined] {
  return mocks.successToast.mock.calls.at(-1) as [string, { action?: { label: string; onClick: () => void } } | undefined];
}

/*
 * The removed group's list, open or closed. A closed group is `hidden`, and a hidden element has no accessible name, so
 * it is found by the label it carries.
 */
function removedGroup(): HTMLElement {
  return document.querySelector<HTMLElement>('ul[aria-label="Removed files"]')!;
}

function phoneWidth() {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

/*
 * D-20, D-21 (14-UI-SPEC §3.5, §9; UI-D17, UI-D18; X-14): Remove applies at once, with no confirmation and no reason
 * asked: the file leaves the main list for the removed group at the pending opacity until Strapi answers, then an Undo
 * toast says so. Undo restores it as a second recorded change. A refusal rolls the file back with family O's words.
 */
describe('Remove with Undo (§3.5, §9)', () => {
  it('moves the file to the removed group at once, at the pending opacity, then says so with Undo; nothing asks first', async () => {
    let settle: (value: unknown) => void = () => undefined;
    mocks.setAttachmentRemovalAction.mockImplementation(() => new Promise((resolve) => { settle = resolve; }));
    const user = userEvent.setup();
    const pack = attachment({ actions: removable });
    list({ attachments: [pack, flow({ actions: removable })], viewer: 'requestor' });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(mocks.setAttachmentRemovalAction).toHaveBeenCalledWith({ requestId: 'req-1', attachmentId: 'att-pack', removed: true });
    expect(within(screen.getByRole('table', { name: 'Files' })).queryByText(PACK)).toBeNull();
    expect(screen.getByRole('button', { name: 'Show removed files (1)' })).toBeInTheDocument();
    const pending = within(removedGroup()).getByText(PACK).closest('li')!;
    expect(pending).toHaveAttribute('data-pending', 'true');
    expect(mocks.successToast).not.toHaveBeenCalled();

    await act(async () => settle(answered(pack, true)));

    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    const [message, options] = lastSuccess();
    expect(message).toBe(`${PACK} removed.`);
    expect(options?.action?.label).toBe('Undo');
    await waitFor(() => expect(within(removedGroup()).getByText(PACK).closest('li')).not.toHaveAttribute('data-pending', 'true'));
    expect(mocks.refresh).toHaveBeenCalled();
  });

  it('moves focus to the next file’s Download once a file is removed', async () => {
    mocks.setAttachmentRemovalAction.mockImplementation(async () => answered(attachment({ actions: removable }), true));
    const user = userEvent.setup();
    list({ attachments: [attachment({ actions: removable }), flow({ actions: removable })], viewer: 'requestor' });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));

    await waitFor(() => expect(within(tableRow(FLOW)).getByRole('button', { name: `Download ${FLOW}` })).toHaveFocus());
  });

  it('restores the file with Undo, recorded as a second change, and says so', async () => {
    const pack = attachment({ actions: removable });
    mocks.setAttachmentRemovalAction.mockImplementation(async ({ removed }: { removed: boolean }) => answered(pack, removed));
    const user = userEvent.setup();
    list({ attachments: [pack], viewer: 'requestor' });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    await act(async () => lastSuccess()[1]?.action?.onClick());

    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(2));
    expect(mocks.setAttachmentRemovalAction).toHaveBeenLastCalledWith({ requestId: 'req-1', attachmentId: 'att-pack', removed: false });
    const [message, options] = lastSuccess();
    expect(message).toBe(`${PACK} restored.`);
    expect(options?.action).toBeUndefined();
    await waitFor(() => expect(within(tableRow(PACK)).getByRole('button', { name: `Download ${PACK}` })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /removed files/ })).toBeNull();
  });

  it('says an included file left the AI inputs, and that restoring it does not include it again (UI-D18)', async () => {
    const pack = attachment({ actions: removable, ai: { included: true, facts: { available: 900, kept: 900, truncated: false }, unavailableReason: null, canChange: true } });
    mocks.setAttachmentRemovalAction.mockImplementation(async ({ removed }: { removed: boolean }) => answered(pack, removed));
    const user = userEvent.setup();
    list({ attachments: [pack] });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    expect(lastSuccess()[0]).toBe(`${PACK} removed. Its text is no longer included in the AI inputs.`);

    await act(async () => lastSuccess()[1]?.action?.onClick());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(2));
    expect(lastSuccess()[0]).toBe(`${PACK} restored. Include its text again if the AI should use it.`);
  });

  it('rolls a refused removal back with a danger toast titled File not removed, family O’s words and Refresh page', async () => {
    mocks.setAttachmentRemovalAction.mockResolvedValue({ ok: false, kind: 'blocked', message: 'Only the person who added this file, or a Security Analyst, can remove it.' });
    const user = userEvent.setup();
    list({ attachments: [attachment({ actions: removable })], viewer: 'requestor' });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    const [title, options] = mocks.toastError.mock.calls[0] as [string, ToastOptions];
    expect(title).toBe('File not removed');
    expect(options.description).toBe('Only the person who added this file, or a Security Analyst, can remove it.');
    expect(options.action?.label).toBe('Refresh page');
    await waitFor(() => expect(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` })).toBeInTheDocument());
    expect(screen.queryByRole('button', { name: /removed files/ })).toBeNull();
    expect(mocks.successToast).not.toHaveBeenCalled();
  });

  it('offers Try again on a removal that failed on the way', async () => {
    mocks.setAttachmentRemovalAction.mockResolvedValue({ ok: false, kind: 'retryable', message: 'We couldn’t remove the file. Try again.' });
    const user = userEvent.setup();
    list({ attachments: [attachment({ actions: removable })], viewer: 'requestor' });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledTimes(1));
    expect((mocks.toastError.mock.calls[0]?.[1] as ToastOptions).action?.label).toBe('Try again');
  });

  it('titles a refused Undo Couldn’t undo', async () => {
    const pack = attachment({ actions: removable });
    mocks.setAttachmentRemovalAction.mockResolvedValueOnce(answered(pack, true));
    mocks.setAttachmentRemovalAction.mockResolvedValueOnce({ ok: false, kind: 'blocked', message: 'Only the person who removed this file can restore it.' });
    const user = userEvent.setup();
    list({ attachments: [pack], viewer: 'requestor' });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    await act(async () => lastSuccess()[1]?.action?.onClick());

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('Couldn’t undo', expect.objectContaining({ description: 'Only the person who removed this file can restore it.' })));
  });

  it('offers Remove only where the server allows it', () => {
    list({ attachments: [attachment()] });
    expect(within(tableRow(PACK)).queryByRole('button', { name: `Remove ${PACK}` })).toBeNull();
  });
});

/*
 * WR-403 (14-UI-SPEC §3.5; WCAG 2.4.3): after Remove, focus goes to the next file that renders an action (its Download,
 * or its first action), else the previous such file's, else the section heading. A neighbour with nothing to press is
 * skipped, focus never falls to the page, and once the target is reached or missed the intent is spent.
 */
describe('focus after Remove skips files with nothing to press (§3.5; WR-403)', () => {
  const PENDING = 'analyst-notes.pdf';
  const LAST = 'last-pack.pdf';
  /* A Requestor after submission sees an analyst's file waiting for its malware check: no Download, no Remove, no AI. */
  const waiting = (overrides: Partial<RequestAttachment> = {}) => attachment({
    documentId: 'att-pending', fileName: PENDING, state: 'pending', uploaderPart: 'security-analyst',
    actions: { download: false, remove: false, restore: false }, ...overrides,
  });
  const last = attachment({ documentId: 'att-last', fileName: LAST, uploadedAt: '2026-10-09T01:00:00.000Z', actions: removable });

  function withHeading(attachments: RequestAttachment[]) {
    return (
      <TimeZoneProvider zone="Australia/Sydney">
        <h2 id="files" tabIndex={-1}>Files</h2>
        <FilesList attachments={attachments} densityUserId="owner-jane" empty={empty} requestId="req-1" total={totalOf(attachments)} viewer="requestor" />
      </TimeZoneProvider>
    );
  }

  it('skips a following file with no action and focuses the next file’s Download', async () => {
    mocks.setAttachmentRemovalAction.mockImplementation(async () => answered(attachment({ actions: removable }), true));
    const user = userEvent.setup();
    render(withHeading([attachment({ actions: removable }), waiting(), last]));

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));

    await waitFor(() => expect(within(tableRow(LAST)).getByRole('button', { name: `Download ${LAST}` })).toHaveFocus());
  });

  it('falls back to the section heading, never the page, when no other file has an action, and spends the intent', async () => {
    mocks.setAttachmentRemovalAction.mockImplementation(async () => answered(last, true));
    const user = userEvent.setup();
    const view = render(withHeading([waiting(), last]));

    await user.click(within(tableRow(LAST)).getByRole('button', { name: `Remove ${LAST}` }));

    const heading = screen.getByRole('heading', { name: 'Files' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(document.activeElement).not.toBe(document.body);
    await waitFor(() => expect(mocks.refresh).toHaveBeenCalled());

    /* The page's next read: the waiting file passed its check and can now be downloaded. Focus stays where it is. */
    view.rerender(withHeading([waiting({ state: 'available', actions: { download: true, remove: false, restore: false } }), answered(last, true).data]));
    expect(within(tableRow(PENDING)).getByRole('button', { name: `Download ${PENDING}` })).not.toHaveFocus();
    expect(heading).toHaveFocus();
  });
});

/*
 * IN-408 (14-UI-SPEC §3.4, §3.5): an optimistic restore returns the file to the state it had before it was removed, so a
 * file still waiting for its malware check keeps its badge and line through Undo; it is never shown as available.
 */
describe('an optimistic restore keeps the file’s state (§3.4, §3.5; IN-408)', () => {
  /*
   * 14-UI-REVIEW UI-04 (§3.5 "Restoring returns the file at the pending opacity"; Motion, the §5 Optimistic UI pending
   * opacity): a restored row reads as pending in every cell, Size, Added by, Added, Note and the actions with the badge as
   * well as the Name, because the whole row takes the pending opacity, once (no cell is dimmed twice). The row's
   * `data-pending` sets it on each of its cells, so the row's own hover tint keeps its 80ms transition.
   */
  function rowPendingFacts(row: HTMLElement) {
    const headers = [...screen.getByRole('table', { name: 'Files' }).querySelectorAll('thead th')].map((header) => header.textContent);
    const cells = within(row).getAllByRole('cell');
    return {
      element: row.tagName,
      opacity: ['[&>td]:transition-opacity', 'data-[pending=true]:[&>td]:opacity-60', 'data-[pending=true]:[&>td]:transition-none'].every((name) => row.classList.contains(name)),
      pending: row.getAttribute('data-pending'),
      /* Each column, and whether its cell is dimmed by the row itself. */
      cells: Object.fromEntries(cells.map((cell, index) => [headers[index], cell.closest('[data-pending="true"]') === row])),
      dimmedAgainInside: row.querySelectorAll('[data-pending]').length,
    };
  }
  const wholeRow = (pending: boolean) => ({
    element: 'TR',
    opacity: true,
    pending: pending ? 'true' : null,
    cells: { Name: pending, Size: pending, 'Added by': pending, Added: pending, Note: pending, Actions: pending },
    dimmedAgainInside: 0,
  });

  it('keeps Waiting for malware check on a pending file while its Undo is answered', async () => {
    const pending = attachment({ state: 'pending', actions: { download: false, remove: true, restore: false } });
    const removedPending = { ...pending, state: 'removed' as const, removedBy: jane, removedAt: '2026-10-10T04:00:00.000Z', actions: { download: false, remove: false, restore: true } };
    let settleUndo: (value: unknown) => void = () => undefined;
    mocks.setAttachmentRemovalAction
      .mockResolvedValueOnce({ ok: true, data: removedPending })
      .mockImplementationOnce(() => new Promise((resolve) => { settleUndo = resolve; }));
    const user = userEvent.setup();
    list({ attachments: [pending], viewer: 'requestor' });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    await act(async () => lastSuccess()[1]?.action?.onClick());

    expect(mocks.setAttachmentRemovalAction).toHaveBeenLastCalledWith({ requestId: 'req-1', attachmentId: 'att-pack', removed: false });
    const row = tableRow(PACK);
    expect(within(row).getByText('Waiting for malware check')).toBeInTheDocument();
    expect(within(row).getByText('It can be downloaded once it passes. Refresh the page later to see.')).toBeInTheDocument();
    const whileWaiting = rowPendingFacts(row);

    await act(async () => settleUndo({ ok: true, data: pending }));
    expect(within(tableRow(PACK)).getByText('Waiting for malware check')).toBeInTheDocument();
    expect(whileWaiting, 'while the Undo waits, the whole row is dimmed, once, in every cell').toEqual(wholeRow(true));
    expect(rowPendingFacts(tableRow(PACK)), 'once Strapi answers, nothing is dimmed').toEqual(wholeRow(false));
  });

  it('keeps the state of a file removed in this view when it is restored from the removed group', async () => {
    const pending = attachment({ state: 'pending', actions: { download: false, remove: true, restore: false } });
    const removedPending = { ...pending, state: 'removed' as const, removedBy: jane, removedAt: '2026-10-10T04:00:00.000Z', actions: { download: false, remove: false, restore: true } };
    let settleRemove: (value: unknown) => void = () => undefined;
    let settleRestore: (value: unknown) => void = () => undefined;
    mocks.setAttachmentRemovalAction
      .mockImplementationOnce(() => new Promise((resolve) => { settleRemove = resolve; }))
      .mockImplementationOnce(() => new Promise((resolve) => { settleRestore = resolve; }));
    const user = userEvent.setup();
    list({ attachments: [pending], viewer: 'requestor' });

    await user.click(within(tableRow(PACK)).getByRole('button', { name: `Remove ${PACK}` }));
    await act(async () => settleRemove({ ok: true, data: removedPending }));
    await waitFor(() => expect(within(removedGroup()).getByText(PACK).closest('li')).not.toHaveAttribute('data-pending', 'true'));
    await user.click(screen.getByRole('button', { name: 'Show removed files (1)' }));
    await user.click(within(removedGroup()).getByRole('button', { name: `Restore ${PACK}` }));

    expect(within(tableRow(PACK)).getByText('Waiting for malware check')).toBeInTheDocument();
    const whileWaiting = rowPendingFacts(tableRow(PACK));
    await act(async () => settleRestore({ ok: true, data: pending }));
    expect(whileWaiting, 'while the Restore waits, the whole row is dimmed, once, in every cell').toEqual(wholeRow(true));
    expect(rowPendingFacts(tableRow(PACK)), 'once Strapi answers, nothing is dimmed').toEqual(wholeRow(false));
  });
});

/*
 * §3.5: removed files sit below the main list in a collapsed group behind an outline toggle with its count, absent at
 * zero. Each shows who added it and who removed it, with when; only the person who removed it sees Restore. No Download.
 */
describe('the removed group (§3.5)', () => {
  const removedByJane = removedFile('old-pack.pdf', 'att-old', true);
  const removedByOther = removedFile('older-pack.pdf', 'att-older', false);

  it('shows no toggle when nothing has been removed', () => {
    list();
    expect(screen.queryByRole('button', { name: /removed files/ })).toBeNull();
  });

  it('opens and closes the group with a toggle that says what it controls', async () => {
    const user = userEvent.setup();
    list({ attachments: [attachment(), removedByJane, removedByOther] });

    const toggle = screen.getByRole('button', { name: 'Show removed files (2)' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAttribute('aria-controls', removedGroup().id);
    expect(screen.queryByRole('list', { name: 'Removed files' })).toBeNull();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(toggle).toHaveAccessibleName('Hide removed files');
    expect(screen.getByRole('list', { name: 'Removed files' })).toBeVisible();

    await user.click(toggle);
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(toggle).toHaveAccessibleName('Show removed files (2)');
  });

  it('says who added and who removed each file, with when, offers Restore to its remover only, and never Download', async () => {
    const user = userEvent.setup();
    list({ attachments: [attachment(), removedByJane, removedByOther] });
    await user.click(screen.getByRole('button', { name: 'Show removed files (2)' }));

    const group = screen.getByRole('list', { name: 'Removed files' });
    const [mine, theirs] = within(group).getAllByRole('listitem');
    expect(mine).toHaveTextContent('old-pack.pdf');
    expect(mine).toHaveTextContent('PDF · 2 KB');
    expect(mine).toHaveTextContent(/Added by Jane Doe · \S/);
    expect(mine).toHaveTextContent(/Removed by Jane Doe · \S/);
    expect(mine!.querySelectorAll('time')).toHaveLength(2);
    expect(within(mine!).getByRole('button', { name: 'Restore old-pack.pdf' })).toBeInTheDocument();
    expect(within(theirs!).queryByRole('button', { name: /^Restore/ })).toBeNull();
    expect(within(group).queryByRole('button', { name: /^Download/ })).toBeNull();
  });

  /*
   * 14-UI-REVIEW UI-06 (14-UI-SPEC Spacing, "16px | … queue and card row padding"; direction §4 Cards, "padding
   * 16–20px"): each removed file is a card row (a bordered surface rectangle at the large radius), so it takes the 16px
   * card row padding, not 12px.
   */
  it('pads each removed file’s card row 16px (UI-06)', async () => {
    const user = userEvent.setup();
    list({ attachments: [attachment(), removedByJane] });
    await user.click(screen.getByRole('button', { name: 'Show removed files (1)' }));

    const [row] = within(screen.getByRole('list', { name: 'Removed files' })).getAllByRole('listitem');
    expect(row).toHaveClass('rounded-lg', 'border', 'bg-surface', 'p-4');
    expect(row).not.toHaveClass('p-3');
  });

  it('restores at once with Undo, and Undo removes it again', async () => {
    mocks.setAttachmentRemovalAction.mockImplementation(async ({ removed }: { removed: boolean }) => answered(removedByJane, removed));
    const user = userEvent.setup();
    list({ attachments: [attachment(), removedByJane] });
    await user.click(screen.getByRole('button', { name: 'Show removed files (1)' }));

    await user.click(screen.getByRole('button', { name: 'Restore old-pack.pdf' }));

    expect(mocks.setAttachmentRemovalAction).toHaveBeenCalledWith({ requestId: 'req-1', attachmentId: 'att-old', removed: false });
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    expect(lastSuccess()[0]).toBe('old-pack.pdf restored.');
    expect(lastSuccess()[1]?.action?.label).toBe('Undo');
    await waitFor(() => expect(within(tableRow('old-pack.pdf')).getByRole('button', { name: 'Download old-pack.pdf' })).toHaveFocus());

    await act(async () => lastSuccess()[1]?.action?.onClick());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(2));
    expect(lastSuccess()[0]).toBe('old-pack.pdf removed again.');
  });

  /* The pilot's walk, O7 (§3.5): the group's open state does not outlive the group, so a group that refills starts closed. */
  it('starts closed again once it has emptied and refilled (O7)', async () => {
    mocks.setAttachmentRemovalAction.mockImplementation(async ({ removed }: { removed: boolean }) => answered(removedByJane, removed));
    const user = userEvent.setup();
    list({ attachments: [attachment(), removedByJane] });
    await user.click(screen.getByRole('button', { name: 'Show removed files (1)' }));
    expect(screen.getByRole('button', { name: 'Hide removed files' })).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Restore old-pack.pdf' }));
    await waitFor(() => expect(screen.queryByRole('button', { name: /removed files/ }), 'the group empties').toBeNull());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(1));
    await act(async () => lastSuccess()[1]?.action?.onClick());

    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledTimes(2));
    const toggle = screen.getByRole('button', { name: /removed files/ });
    expect(toggle, 'the refilled group starts closed').toHaveAccessibleName('Show removed files (1)');
    expect(toggle).toHaveAttribute('aria-expanded', 'false');
    expect(removedGroup()).not.toBeVisible();
  });

  it('refuses a restore at 20 files with its words in a toast titled File not restored, and keeps the file removed', async () => {
    mocks.setAttachmentRemovalAction.mockResolvedValue({ ok: false, kind: 'blocked', message: 'This request already has 20 files. Remove another file before restoring this one.' });
    const user = userEvent.setup();
    list({ attachments: [attachment(), removedByJane] });
    await user.click(screen.getByRole('button', { name: 'Show removed files (1)' }));

    await user.click(screen.getByRole('button', { name: 'Restore old-pack.pdf' }));

    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('File not restored', expect.objectContaining({
      description: 'This request already has 20 files. Remove another file before restoring this one.',
    })));
    await waitFor(() => expect(within(screen.getByRole('list', { name: 'Removed files' })).getByText('old-pack.pdf')).toBeInTheDocument());
  });
});

/* §3.4 (X-21): each state reads clearly, beside the actions the server allows. */
describe('file states in the list (§3.4)', () => {
  it('shows a blocked file with its detection, no Download, and Remove where allowed', () => {
    list({ attachments: [attachment({ state: 'blocked', detection: 'Csrm.Test.Signature', actions: { download: false, remove: true, restore: false } })] });
    const row = tableRow(PACK);
    expect(within(row).getByText('Blocked')).toBeInTheDocument();
    expect(within(row).getByText('Malware found: Csrm.Test.Signature. The file was deleted and can’t be downloaded.')).toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: `Download ${PACK}` })).toBeNull();
    expect(within(row).getByRole('button', { name: `Remove ${PACK}` })).toBeInTheDocument();
  });

  it('shows a file whose bytes are gone as File unavailable with what to do', () => {
    list({ attachments: [attachment({ state: 'unavailable', actions: { download: false, remove: false, restore: false } })] });
    const row = tableRow(PACK);
    expect(within(row).getByText('File unavailable')).toBeInTheDocument();
    expect(within(row).getByText('This file can’t be downloaded. Contact your administrator.')).toBeInTheDocument();
  });

  it('shows no pager and no results count under the list, and keeps the Actions header for assistive technology only', () => {
    list({ attachments: [attachment(), flow()] });
    expect(screen.queryByText(/^Page \d+ of \d+$/)).toBeNull();
    expect(screen.queryByText(/^\d+ results?$/)).toBeNull();
    expect(screen.getByRole('columnheader', { name: 'Actions' }).querySelector('.sr-only')).toHaveTextContent('Actions');
    expect(screen.getByRole('button', { name: 'Use compact density' })).toBeInTheDocument();
  });
});

/*
 * §3.3 (X-21, UI-D16): below 768px each file is a card with Download at full width and, when the file has other
 * actions, the icon-only More actions for {name}, which opens a bottom sheet titled with the file's name. Focus moves to
 * the title on open and returns to More actions on close.
 */
describe('the phone card and its actions sheet (§3.3)', () => {
  function card(name: string): HTMLElement {
    return within(screen.getByRole('list', { name: 'Files' })).getAllByRole('listitem').find((item) => within(item).queryByText(name) !== null)!;
  }

  it('puts Download at full width on the card, and More actions only when the file has other actions', () => {
    phoneWidth();
    list({ attachments: [attachment({ actions: removable }), flow()] });
    expect(within(card(PACK)).getByRole('button', { name: `Download ${PACK}` })).toHaveClass('w-full');
    const more = within(card(PACK)).getByRole('button', { name: `More actions for ${PACK}` });
    expect(more).toHaveAttribute('aria-haspopup', 'dialog');
    expect(within(card(PACK)).queryByRole('button', { name: `Remove ${PACK}` })).toBeNull();
    expect(within(card(FLOW)).queryByRole('button', { name: `More actions for ${FLOW}` })).toBeNull();
  });

  it('opens a sheet titled with the file’s name, holding Remove and Close, with focus on the title and back on close', async () => {
    phoneWidth();
    const user = userEvent.setup();
    list({ attachments: [attachment({ actions: removable })] });
    const more = within(card(PACK)).getByRole('button', { name: `More actions for ${PACK}` });

    await user.click(more);
    const sheet = await screen.findByRole('dialog', { name: PACK });
    await waitFor(() => expect(within(sheet).getByRole('heading', { name: PACK })).toHaveFocus());
    expect(within(sheet).getByRole('button', { name: `Remove ${PACK}` })).toHaveClass('w-full');

    await user.click(within(sheet).getByRole('button', { name: `Close actions for ${PACK}` }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(more).toHaveFocus();
  });

  /*
   * 14-UI-REVIEW UI-02 (the pilot's ruling; 14-UI-SPEC Motion, "Sheets: §5 'Drawer / side panel'; fade only under reduced
   * motion"; direction §3.11 `--duration-slower`, §5 "Drawer / side panel | 260ms | expo | Fade + short slide"): the
   * sheet takes the drawer motion through its own classes, a short slide up with a fade, and only the fade under reduced
   * motion. The shared Sheet primitive's classes are app-wide and stay as they are (.planning/WINDOWS.md).
   * request-attachments.spec.ts reads the motion the browser computes at 375.
   */
  it('slides up with the drawer motion, at the drawer duration on the expo curve, fading only under reduced motion (UI-02)', async () => {
    phoneWidth();
    const user = userEvent.setup();
    list({ attachments: [attachment({ actions: removable })] });
    await user.click(within(card(PACK)).getByRole('button', { name: `More actions for ${PACK}` }));
    const sheet = await screen.findByRole('dialog', { name: PACK });
    expect(sheet).toHaveAttribute('data-slot', 'sheet-content');
    expect(sheet, 'a short slide up with a fade, and back down on close').toHaveClass(
      'motion-safe:data-[state=open]:animate-drawer-in-bottom',
      'motion-safe:data-[state=closed]:animate-drawer-out-bottom',
    );
    expect(sheet, 'only the fade under reduced motion').toHaveClass(
      'motion-reduce:data-[state=open]:animate-drawer-fade-in',
      'motion-reduce:data-[state=closed]:animate-drawer-fade-out',
    );
  });

  it('removes the file from the sheet, closing it, with the same Undo toast', async () => {
    phoneWidth();
    const pack = attachment({ actions: removable });
    mocks.setAttachmentRemovalAction.mockImplementation(async () => answered(pack, true));
    const user = userEvent.setup();
    list({ attachments: [pack], viewer: 'requestor' });

    await user.click(within(card(PACK)).getByRole('button', { name: `More actions for ${PACK}` }));
    await user.click(within(await screen.findByRole('dialog', { name: PACK })).getByRole('button', { name: `Remove ${PACK}` }));

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`${PACK} removed.`, expect.anything()));
  });
});

/*
 * 14-UI-SPEC §3.2, §5.1 (D-28, D-30): the analyst's list carries the section's AI policy, and only then does it gain the
 * `AI inputs` column, the card's `AI inputs: {facts}` line and the switch in the phone actions sheet. A Requestor's list
 * carries no policy and no file's AI facts, so nothing of the AI inputs renders for her.
 */
describe('the AI inputs on the Files list (§3.2, §5.1)', () => {
  const policy = { canChange: true, refusal: null, classification: 'Internal', ceiling: 'Restricted' } as const;
  const ai = { included: false, facts: null, unavailableReason: null, canChange: true };

  function card(name: string): HTMLElement {
    return within(screen.getByRole('list', { name: 'Files' })).getAllByRole('listitem').find((item) => within(item).queryByText(name) !== null)!;
  }

  it('adds the AI inputs column, with the switch and its facts line, when the list carries the AI policy', async () => {
    list({ attachments: [attachment({ actions: removable, ai })], aiPolicy: policy });
    const table = screen.getByRole('table', { name: 'Files' });
    expect(within(table).getByRole('columnheader', { name: 'AI inputs' })).toBeInTheDocument();
    const row = tableRow(PACK);
    expect(await within(row).findByRole('switch', { name: 'Changes the AI inputs' })).not.toBeChecked();
    expect(within(row).getByText('Not included', { exact: true })).toBeInTheDocument();
  });

  it('gives each phone card the line AI inputs: {facts}', async () => {
    phoneWidth();
    list({ attachments: [attachment({ actions: removable, ai: { ...ai, included: true, facts: { available: 960, kept: 960, truncated: false } } })], aiPolicy: policy });
    expect(await within(card(PACK)).findByText('AI inputs: Included · all 960 characters', { exact: true })).toBeInTheDocument();
    expect(within(card(PACK)).queryByRole('switch')).toBeNull();
  });

  it('puts the switch and its line in the phone actions sheet', async () => {
    phoneWidth();
    const user = userEvent.setup();
    list({ attachments: [attachment({ actions: removable, ai })], aiPolicy: policy });
    await user.click(within(card(PACK)).getByRole('button', { name: `More actions for ${PACK}` }));
    const sheet = await screen.findByRole('dialog', { name: PACK });
    expect(await within(sheet).findByRole('switch', { name: 'Changes the AI inputs' })).not.toBeChecked();
    expect(within(sheet).getByText('Not included', { exact: true })).toBeInTheDocument();
  });

  it('shows a Requestor no AI column, no AI line and no switch', () => {
    list({ attachments: [attachment({ actions: removable })], viewer: 'requestor' });
    const table = screen.getByRole('table', { name: 'Files' });
    expect(within(table).queryByRole('columnheader', { name: 'AI inputs' })).toBeNull();
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByText(/AI inputs/)).toBeNull();
    expect(screen.queryByText('Not included')).toBeNull();
  });
});

/*
 * D5, the pilot's browser walk (14-UI-SPEC §3.5): after an analyst's Restore below 768px, focus lands on the restored
 * card's first action, its full-width `Download`, never on `More actions for {name}`, which the card also offers him
 * because the file carries his AI control.
 */
describe('focus after an analyst’s Restore on the phone card (§3.5; D5)', () => {
  const XLSX = 'vendor-questionnaire.xlsx';
  const policy = { canChange: true, refusal: null, classification: 'Internal', ceiling: 'Restricted' } as const;
  const ai = { included: false, facts: null, unavailableReason: null, canChange: true };

  function card(name: string): HTMLElement {
    return within(screen.getByRole('list', { name: 'Files' })).getAllByRole('listitem').find((item) => within(item).queryByText(name) !== null)!;
  }

  it('focuses the restored card’s Download, not More actions, once Strapi answers', async () => {
    phoneWidth();
    const removedBySam = { ...removedFile(XLSX, 'att-xlsx', true), fileType: 'xlsx' as const, ai };
    mocks.setAttachmentRemovalAction.mockImplementation(async ({ removed }: { removed: boolean }) => answered(removedBySam, removed));
    const user = userEvent.setup();
    list({ attachments: [attachment({ actions: removable, ai }), removedBySam], aiPolicy: policy });
    await user.click(screen.getByRole('button', { name: 'Show removed files (1)' }));

    await user.click(screen.getByRole('button', { name: `Restore ${XLSX}` }));

    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`${XLSX} restored.`, expect.anything()));
    /* The card gains its Download once the restore's transition ends, which may follow the toast. */
    await waitFor(() => expect(within(card(XLSX)).getByRole('button', { name: `Download ${XLSX}` })).toHaveFocus());
    expect(within(card(XLSX)).getByRole('button', { name: `More actions for ${XLSX}` })).not.toHaveFocus();
  });

  it('offers no More actions on a card while its restore waits for Strapi, because nothing in it can be pressed yet', async () => {
    phoneWidth();
    const xlsx = attachment({ documentId: 'att-xlsx', fileName: XLSX, fileType: 'xlsx', actions: removable, ai });
    let settleRestore: (value: unknown) => void = () => undefined;
    mocks.setAttachmentRemovalAction
      .mockImplementationOnce(async () => answered(xlsx, true))
      .mockImplementationOnce(() => new Promise((resolve) => { settleRestore = resolve; }));
    const user = userEvent.setup();
    list({ attachments: [attachment({ actions: removable, ai }), xlsx], aiPolicy: policy });
    /* Sam removes it from its card's actions sheet, so this view knows the state it had (IN-408). */
    await user.click(within(card(XLSX)).getByRole('button', { name: `More actions for ${XLSX}` }));
    await user.click(within(await screen.findByRole('dialog', { name: XLSX })).getByRole('button', { name: `Remove ${XLSX}` }));
    await waitFor(() => expect(mocks.successToast).toHaveBeenCalledWith(`${XLSX} removed.`, expect.anything()));
    await user.click(screen.getByRole('button', { name: 'Show removed files (1)' }));

    await user.click(screen.getByRole('button', { name: `Restore ${XLSX}` }));

    expect(card(XLSX), 'the file is back on the list at once').toHaveAttribute('role', 'listitem');
    expect(within(card(XLSX)).queryByRole('button', { name: `More actions for ${XLSX}` }), 'no sheet to open while the restore is pending').toBeNull();
    await act(async () => settleRestore(answered(xlsx, false)));
    await waitFor(() => expect(within(card(XLSX)).getByRole('button', { name: `Download ${XLSX}` })).toHaveFocus());
    expect(within(card(XLSX)).getByRole('button', { name: `More actions for ${XLSX}` })).toBeInTheDocument();
  });
});

/*
 * The pilot's walk, O6 (WCAG 2.5.8; direction §4 Source citations: "4px block padding, so each target is at least 24px
 * tall"): the `Note · {instant}` link on a file's card and row is a record link at least 24px tall, not the 15px line of
 * its caption text.
 */
describe('the Note link’s target (§3.2; O6)', () => {
  const noted = () => attachment({ note: { documentId: 'note-1', postedAt: '2026-10-11T01:47:00.000Z' } });

  it('pads the card’s Note link to the 24px target below 768px', () => {
    phoneWidth();
    list({ attachments: [noted()] });
    const card = within(screen.getByRole('list', { name: 'Files' })).getAllByRole('listitem')[0]!;
    const link = within(card).getByRole('link', { name: /^Note · / });
    expect(link).toHaveAttribute('href', '#note-note-1');
    expect(link).toHaveClass('inline-block', 'py-1');
  });

  it('pads the table’s Note link the same way', () => {
    list({ attachments: [noted()] });
    const link = within(tableRow(PACK)).getByRole('link', { name: /^Note · / });
    expect(link).toHaveClass('inline-block', 'py-1');
  });
});

/*
 * The pilot's walk, D1 (14-UI-SPEC §3.2, §6.1, §6.2, §7.1, §12; X-10; WCAG 2.4.3), and WR-506's remainder: the request
 * page streams in after the browser and the router have tried to scroll to a fragment, so the list lands on its own
 * destinations once it has mounted, on a later `hashchange` and after a plain click on a link to the same page, as Phase
 * 13's `useHashLanding` lets the Notes and Assignment sections do. `#files` focuses the section's heading; `#file-{id}`
 * focuses the file's row (its card at phone widths); a removed file's `#file-{id}` opens the removed group first.
 */
describe('links to the Files section and to a file land on them (§3.2; the pilot’s walk, D1)', () => {
  const scrollIntoView = vi.fn();
  const original = Element.prototype.scrollIntoView;
  const OLD = 'old-pack.pdf';

  beforeEach(() => {
    Element.prototype.scrollIntoView = scrollIntoView;
  });

  afterEach(() => {
    Element.prototype.scrollIntoView = original;
    scrollIntoView.mockReset();
    window.history.replaceState(null, '', '/');
  });

  function page(props: Partial<FilesListProps> = {}) {
    const attachments = props.attachments ?? [attachment(), flow()];
    return render(
      <TimeZoneProvider zone="Australia/Sydney">
        <h2 id="files" tabIndex={-1}>Files</h2>
        <FilesList attachments={attachments} densityUserId="owner-bob" empty={empty} requestId="req-1" total={totalOf(attachments)} viewer="analyst" {...props} />
        <a href="#file-att-flow">Link to {FLOW}</a>
      </TimeZoneProvider>,
    );
  }

  const scrolled = () => scrollIntoView.mock.contexts;

  it('focuses the Files heading for #files once the list has mounted, and brings it into view', async () => {
    window.history.replaceState(null, '', '#files');
    page();
    const heading = screen.getByRole('heading', { name: 'Files' });
    await waitFor(() => expect(heading).toHaveFocus());
    expect(scrolled()).toContain(heading);
  });

  it('focuses the file’s table row for #file-{id} from 768px, and brings it into view', async () => {
    window.history.replaceState(null, '', '#file-att-flow');
    page();
    const target = document.getElementById('file-att-flow')!;
    expect(tableRow(FLOW), 'the target is the file’s table row').toContainElement(target);
    await waitFor(() => expect(target).toHaveFocus());
    expect(scrolled()).toContain(target);
  });

  it('focuses the file’s card at phone widths', async () => {
    phoneWidth();
    window.history.replaceState(null, '', '#file-att-flow');
    page();
    await waitFor(() => expect(document.getElementById('file-att-flow')).toHaveFocus());
    const card = within(screen.getByRole('list', { name: 'Files' })).getAllByRole('listitem').find((item) => within(item).queryByText(FLOW) !== null)!;
    expect(card, 'the target is the file’s card').toContainElement(document.getElementById('file-att-flow'));
    expect(scrolled()).toContain(document.getElementById('file-att-flow'));
  });

  it('lands on a file a link on the same page names, once the router has moved', async () => {
    const user = userEvent.setup();
    page();
    expect(document.getElementById('file-att-flow')).not.toHaveFocus();

    await user.click(screen.getByRole('link', { name: `Link to ${FLOW}` }));

    await waitFor(() => expect(document.getElementById('file-att-flow')).toHaveFocus());
  });

  it('opens the removed group and focuses a removed file’s row for its #file-{id} (WR-506)', async () => {
    window.history.replaceState(null, '', '#file-att-old');
    page({ attachments: [attachment(), removedFile(OLD, 'att-old', true)] });

    const removedRow = within(removedGroup()).getByText(OLD).closest('li')!;
    await waitFor(() => expect(removedRow).toHaveFocus());
    expect(removedRow).toHaveAttribute('id', 'file-att-old');
    expect(removedRow).toHaveAttribute('tabindex', '-1');
    expect(screen.getByRole('button', { name: 'Hide removed files' })).toHaveAttribute('aria-expanded', 'true');
    expect(removedGroup()).toBeVisible();
    expect(scrolled()).toContain(removedRow);
  });

  it('leaves a fragment it does not own to its owner', async () => {
    window.history.replaceState(null, '', '#notes');
    page();
    await act(async () => undefined);
    expect(document.body).toHaveFocus();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

/*
 * The pilot's walk, D2 (X-21; 14-UI-SPEC §3.2): the list fits its section. Its own width chooses the layout, the table
 * from the width it needs (a Requestor's columns, a Security Analyst's with the AI inputs, and either with a file that
 * shows its state in place of Download), the cards below it; and a table that still measures wider than the list gives
 * way to the cards until the list is wide enough for it.
 */
describe('the list chooses its layout by its own width (§3.2; the pilot’s walk, D2)', () => {
  const policy = { canChange: true, refusal: null, classification: 'Internal', ceiling: 'Restricted' } as const;
  const ai = { included: false, facts: null, unavailableReason: null, canChange: true };
  const cardsOf = (view: ReturnType<typeof list>) => view.container.querySelector('[data-slot="data-table-mobile"]');
  const scrollerOf = (view: ReturnType<typeof list>) => view.container.querySelector<HTMLElement>('[data-slot="data-table-desktop"]')!;

  it.each([
    ['a Requestor’s list', '54rem', {}],
    ['a Requestor’s list with a file waiting for its malware check', '60rem', { attachments: [attachment({ state: 'pending', actions: { download: false, remove: false, restore: false } }), flow()] }],
    ['a Security Analyst’s list with the AI inputs', '65rem', { attachments: [attachment({ ai }), flow({ ai })], aiPolicy: policy }],
    ['a Security Analyst’s list with a blocked file', '70rem', { attachments: [attachment({ ai, state: 'blocked', detection: 'Csrm.Test.Signature', actions: { download: false, remove: true, restore: false } }), flow({ ai })], aiPolicy: policy }],
  ] as const)('shows the table of %s from %s of its own width, and the cards below', (_name, width, props) => {
    const view = list(props as Partial<FilesListProps>);
    expect(cardsOf(view)).toHaveClass(`@min-[${width}]:hidden`);
    expect(scrollerOf(view)).toHaveClass('hidden', `@min-[${width}]:grid`);
  });

  it('gives way to the cards when the table measures wider than the list, and returns once the list is wide enough', () => {
    installTestResizeObserver();
    const view = list({ attachments: [attachment({ ai }), flow({ ai })], aiPolicy: policy });
    const listRoot = view.container.querySelector<HTMLElement>('section[aria-label="Files controls"]')!.parentElement!;
    expect(screen.getByRole('table', { name: 'Files' }), 'the table first').toContainElement(document.getElementById('file-att-flow'));

    stubHorizontalGeometry(listRoot, { scrollWidth: 1056, clientWidth: 1056 });
    stubHorizontalGeometry(scrollerOf(view), { scrollWidth: 1141, clientWidth: 1052 });
    act(() => TestResizeObserver.notifyAll());

    expect(cardsOf(view)!.className, 'the cards at every width').not.toMatch(/hidden/);
    expect(scrollerOf(view)).toHaveClass('hidden');
    const card = within(screen.getByRole('list', { name: 'Files' })).getAllByRole('listitem').find((item) => within(item).queryAllByText(FLOW).length > 0)!;
    expect(card, 'the link target moves to the card').toContainElement(document.getElementById('file-att-flow'));
    expect(screen.getByRole('button', { name: 'Use compact density' }), 'and the density toggle hides').toHaveClass('hidden');

    stubHorizontalGeometry(listRoot, { scrollWidth: 1145, clientWidth: 1145 });
    stubHorizontalGeometry(scrollerOf(view), { scrollWidth: 1141, clientWidth: 1141 });
    act(() => TestResizeObserver.notifyAll());

    expect(cardsOf(view), 'the table again once the list is as wide as the table measured').toHaveClass('@min-[65rem]:hidden');
    expect(screen.getByRole('table', { name: 'Files' })).toContainElement(document.getElementById('file-att-flow'));
  });
});

/*
 * D5 (§3.5; the 16-15 gate's COLLAB02_UAT012_SCENARIO at 1440): both layouts of the list are in the page and the list's
 * width and files choose which shows. A refreshed list can change that choice after focus landed on a file's action (a
 * file gains or loses a badge, or the table gets its chance again), and the browser then drops focus from the hidden
 * control to the page. Focus follows the same action into the layout that shows.
 */
describe('focus across a change of layout (§3.5)', () => {
  /* The browser's layout: a control inside the hidden layout has no boxes. */
  function showOnly(slot: 'data-table-desktop' | 'data-table-mobile') {
    const hidden = slot === 'data-table-desktop' ? 'data-table-mobile' : 'data-table-desktop';
    vi.spyOn(Element.prototype, 'getClientRects').mockImplementation(function (this: Element) {
      const boxes = this.closest(`[data-slot="${hidden}"]`) ? [] : [new DOMRect(0, 0, 10, 10)];
      return Object.assign(boxes, { item: (index: number) => boxes[index] ?? null }) as unknown as DOMRectList;
    });
  }

  afterEach(() => vi.restoreAllMocks());

  it('moves focus from a file’s Download in the table to its Download on the card when the refreshed list shows the cards', () => {
    const attachments = [attachment(), attachment({ documentId: 'att-flow', fileName: 'data-flow.docx', fileType: 'docx' })];
    const view = list({ attachments });
    showOnly('data-table-desktop');
    const inTable = within(tableRow(PACK)).getByRole('button', { name: `Download ${PACK}` });
    act(() => inTable.focus());
    expect(inTable).toHaveFocus();

    // The page's next read: one file now waits for its malware check, so the list needs more room and shows the cards.
    showOnly('data-table-mobile');
    const refreshed = [attachments[0]!, { ...attachments[1]!, state: 'pending' as const }];
    view.rerender(
      <TimeZoneProvider zone="Australia/Sydney">
        <FilesList attachments={refreshed} densityUserId="owner-bob" empty={empty} requestId="req-1" total={totalOf(refreshed)} viewer="analyst" />
      </TimeZoneProvider>,
    );

    const cards = screen.getByRole('list', { name: 'Files', hidden: true });
    const onCard = within(within(cards).getAllByRole('listitem', { hidden: true }).find((item) => within(item).queryByText(PACK) !== null)!).getByRole('button', { name: `Download ${PACK}`, hidden: true });
    expect(onCard).toHaveFocus();
  });

  it('leaves focus alone when the person moved it away before the layout changed', () => {
    const view = list();
    showOnly('data-table-desktop');
    const inTable = within(tableRow(PACK)).getByRole('button', { name: `Download ${PACK}` });
    act(() => inTable.focus());
    act(() => inTable.blur());
    expect(document.body).toHaveFocus();

    showOnly('data-table-mobile');
    view.rerender(
      <TimeZoneProvider zone="Australia/Sydney">
        <FilesList attachments={[attachment({ note: null })]} densityUserId="owner-bob" empty={empty} requestId="req-1" total={1} viewer="analyst" />
      </TimeZoneProvider>,
    );
    expect(document.body).toHaveFocus();
  });
});
