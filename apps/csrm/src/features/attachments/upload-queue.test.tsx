import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createRef, type AnchorHTMLAttributes, type MouseEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type { RequestAttachment } from './attachments-schema';

const mocks = vi.hoisted(() => ({ uploadAttachmentAction: vi.fn(), refresh: vi.fn(), push: vi.fn() }));
vi.mock('./attachments-actions', () => ({ uploadAttachmentAction: mocks.uploadAttachmentAction }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: mocks.push }) }));
/* next/link as it calls onClick, then onNavigate with preventDefault only (navigation-guard.test.tsx). */
vi.mock('next/link', () => ({
  default: ({ children, href, onClick, onNavigate, ...props }: AnchorHTMLAttributes<HTMLAnchorElement> & { href: string; onNavigate?: (event: { preventDefault: () => void }) => void }) => (
    <a {...props} href={href} onClick={(event: MouseEvent<HTMLAnchorElement>) => { onClick?.(event); event.preventDefault(); onNavigate?.({ preventDefault: () => undefined }); }}>{children}</a>
  ),
}));

import { GuardedLink, NavigationGuardProvider, useNavigationGuard } from '@/components/csrm/navigation-guard';
import { attachmentAddRefusal } from '@/lib/api/refusal-copy';
import { installTestResizeObserver } from '@/test/layout-stubs';
import { AttachmentFileStoreProvider } from './file-store';
import { UploadQueue, type QueueSettlement, type UploadQueueHandle } from './upload-queue';

type Settle = (value: unknown) => void;

function attachment(name: string, state: RequestAttachment['state'] = 'available'): RequestAttachment {
  return {
    documentId: `att-${name}`, fileName: name, fileType: 'pdf', byteSize: 4, state,
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: null, removedBy: null, removedAt: null, detection: null, actions: { download: true, remove: true, restore: false },
  };
}

const pdf = (name: string) => new File(['%PDF'], name, { type: 'application/pdf', lastModified: 1 });

/** Each upload waits until the test settles it, in order. */
function deferredUploads() {
  const settles: Settle[] = [];
  mocks.uploadAttachmentAction.mockImplementation(() => new Promise((resolve) => settles.push(resolve)));
  return settles;
}

function GuardProbe() {
  return <span data-testid="guard">{useNavigationGuard().blocking ? 'blocking' : 'clear'}</span>;
}

function queue(props: { ownerKey?: string; remaining?: number } = {}) {
  return (
    <NavigationGuardProvider>
      <AttachmentFileStoreProvider>
        <UploadQueue label="Add files" ownerKey={props.ownerKey ?? 'owner-jane'} remaining={props.remaining ?? 20} requestId="req-1" scope="draft" />
        <GuardProbe />
        <GuardedLink href="/app/requests">My requests</GuardedLink>
      </AttachmentFileStoreProvider>
    </NavigationGuardProvider>
  );
}

async function choose(files: File[]) {
  const user = userEvent.setup({ applyAccept: false });
  await user.upload(screen.getByLabelText('Add files'), files);
  return user;
}

const queueList = () => screen.getByRole('list', { name: 'Files being added' });
const rowFor = (name: string) => within(queueList()).getAllByRole('listitem').find((item) => item.textContent?.includes(name))!;

beforeEach(() => {
  installTestResizeObserver();
});

afterEach(() => {
  vi.clearAllMocks();
});

/* 14-UI-SPEC §1.4 (X-20; D-26): files are sent one at a time, and every file's fate is shown on its row. */
describe('the upload queue sends one file at a time (D-26)', () => {
  it('sends the second file only after the first has settled', async () => {
    const settles = deferredUploads();
    render(queue());
    await choose([pdf('one.pdf'), pdf('two.pdf'), pdf('three.pdf')]);
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(1));
    expect((mocks.uploadAttachmentAction.mock.calls[0]![0] as FormData).get('file')).toHaveProperty('name', 'one.pdf');
    expect(rowFor('one.pdf')).toHaveAttribute('aria-busy', 'true');
    expect(rowFor('two.pdf')).toHaveTextContent('Waiting');
    await act(async () => settles[0]!({ ok: true, data: attachment('one.pdf') }));
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(2));
    expect((mocks.uploadAttachmentAction.mock.calls[1]![0] as FormData).get('file')).toHaveProperty('name', 'two.pdf');
  });

  it('moves on to the next file when one is refused, and says why beside it', async () => {
    const settles = deferredUploads();
    render(queue());
    await choose([pdf('one.pdf'), pdf('invoice.pdf'), pdf('three.pdf')]);
    await waitFor(() => expect(settles).toHaveLength(1));
    await act(async () => settles[0]!({ ok: true, data: attachment('one.pdf') }));
    await waitFor(() => expect(settles).toHaveLength(2));
    await act(async () => settles[1]!({ ok: false, kind: 'refused', reason: 'ATTACHMENT_CONTENT_MISMATCH', offerNewNote: false, message: 'This file’s content doesn’t match its name. Check it’s the file you meant, save it in its real format and add it again.' }));
    await waitFor(() => expect(settles).toHaveLength(3));
    expect(rowFor('invoice.pdf')).toHaveTextContent('Not added. This file’s content doesn’t match its name. Check it’s the file you meant, save it in its real format and add it again.');
    expect(within(rowFor('invoice.pdf')).getByRole('button', { name: 'Choose another file to replace invoice.pdf' })).toBeInTheDocument();
    expect(within(rowFor('invoice.pdf')).getByRole('button', { name: 'Remove from list: invoice.pdf' })).toBeInTheDocument();
  });

  it('says a file waiting for the malware check was added', async () => {
    const settles = deferredUploads();
    render(queue());
    await choose([pdf('pack.pdf')]);
    await waitFor(() => expect(settles).toHaveLength(1));
    await act(async () => settles[0]!({ ok: true, data: attachment('pack.pdf', 'pending') }));
    expect(screen.getByText('Added. Waiting for the malware check before anyone can download it.')).toBeInTheDocument();
  });

  it('offers Retry after a failed transfer, and Retry sends the same file again', async () => {
    mocks.uploadAttachmentAction.mockRejectedValueOnce(new Error('network'));
    render(queue());
    const file = pdf('pack.pdf');
    const user = await choose([file]);
    const retry = await screen.findByRole('button', { name: 'Retry pack.pdf' });
    expect(rowFor('pack.pdf')).toHaveTextContent('Not added. We couldn’t add this file. Try again.');
    mocks.uploadAttachmentAction.mockResolvedValueOnce({ ok: true, data: attachment('pack.pdf') });
    await user.click(retry);
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(2));
    expect((mocks.uploadAttachmentAction.mock.calls[1]![0] as FormData).get('file')).toBe(file);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 1 files added'));
  });

  /* WR-204 (the stage B amendment): Strapi answers 503 ATTACHMENT_BUSY while it is checking other files. */
  it('reads a 503 ATTACHMENT_BUSY as family N’s busy sentence, with Retry sending the same file again', async () => {
    const busy = attachmentAddRefusal({ status: 503, reason: 'ATTACHMENT_BUSY' });
    mocks.uploadAttachmentAction.mockResolvedValueOnce({ ok: false, ...busy, reason: 'ATTACHMENT_BUSY' });
    render(queue());
    const file = pdf('pack.pdf');
    const user = await choose([file]);
    const retry = await screen.findByRole('button', { name: 'Retry pack.pdf' });
    expect(rowFor('pack.pdf')).toHaveTextContent('Not added. CSRM is busy checking other files. Try again in a moment.');
    expect(within(rowFor('pack.pdf')).queryByRole('button', { name: 'Choose another file to replace pack.pdf' })).not.toBeInTheDocument();
    mocks.uploadAttachmentAction.mockResolvedValueOnce({ ok: true, data: attachment('pack.pdf') });
    await user.click(retry);
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(2));
    expect((mocks.uploadAttachmentAction.mock.calls[1]![0] as FormData).get('file')).toBe(file);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('1 of 1 files added'));
  });

  it('counts the files added and not added on the one status line, and nothing else announces', async () => {
    mocks.uploadAttachmentAction
      .mockResolvedValueOnce({ ok: true, data: attachment('one.pdf') })
      .mockResolvedValueOnce({ ok: false, kind: 'refused', offerNewNote: false, message: 'This file is empty. Check it’s the file you meant and choose it again.' })
      .mockResolvedValueOnce({ ok: true, data: attachment('three.pdf', 'pending') });
    render(queue());
    await choose([pdf('one.pdf'), pdf('two.pdf'), pdf('three.pdf')]);
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('2 of 3 files added · 1 not added'));
    expect(screen.getAllByRole('status')).toHaveLength(1);
    expect(screen.queryByRole('alert')).toBeNull();
  });
});

describe('the queue’s checks before sending (D-11; §1.3)', () => {
  it('lists a refused file at once with its reason and never sends it', async () => {
    mocks.uploadAttachmentAction.mockResolvedValue({ ok: true, data: attachment('one.pdf') });
    render(queue());
    await choose([new File(['MZ'], 'tool.exe', { lastModified: 1 }), pdf('one.pdf')]);
    expect(rowFor('tool.exe')).toHaveTextContent('Not added. This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.');
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(1));
    expect((mocks.uploadAttachmentAction.mock.calls[0]![0] as FormData).get('file')).toHaveProperty('name', 'one.pdf');
  });

  it('lists the same file chosen twice once', async () => {
    deferredUploads();
    render(queue());
    const file = pdf('pack.pdf');
    await choose([file, file]);
    expect(within(queueList()).getAllByRole('listitem')).toHaveLength(1);
  });
});

/*
 * IN-409 (14-UI-SPEC §1.3, §1.4; UI-D13): `Choose another file` with a file already in the queue lists nothing twice. The
 * refused row stays, with its reason and both actions, and takes focus, as a replacement row would; nothing is sent.
 */
describe('Choose another file with a file already listed (§1.3, §1.4; IN-409)', () => {
  it('keeps the refused row and focuses it, sending nothing and listing the file once', async () => {
    deferredUploads();
    render(queue());
    const one = pdf('one.pdf');
    const user = await choose([new File(['MZ'], 'tool.exe', { lastModified: 1 }), one]);
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Choose another file to replace tool.exe' }));
    const replace = document.querySelectorAll<HTMLInputElement>('input[type="file"][aria-hidden="true"]');
    await user.upload(replace[replace.length - 1]!, one);

    expect(within(queueList()).getAllByRole('listitem')).toHaveLength(2);
    expect(rowFor('tool.exe')).toHaveTextContent('Not added. This type of file can’t be added.');
    expect(within(rowFor('tool.exe')).getByRole('button', { name: 'Choose another file to replace tool.exe' })).toBeInTheDocument();
    expect(within(rowFor('tool.exe')).getByRole('button', { name: 'Remove from list: tool.exe' })).toBeInTheDocument();
    expect(rowFor('tool.exe')).toHaveFocus();
    expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(1);
  });
});

describe('focus after Remove from list (§1.4)', () => {
  async function refusedRows(names: string[]) {
    mocks.uploadAttachmentAction.mockResolvedValue({ ok: false, kind: 'refused', offerNewNote: false, message: 'This file is empty. Check it’s the file you meant and choose it again.' });
    render(queue());
    const user = await choose(names.map(pdf));
    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent(`0 of ${names.length} files added · ${names.length} not added`));
    return user;
  }

  it('moves to the next row’s first control, else the previous row’s, else Choose files', async () => {
    const user = await refusedRows(['a.pdf', 'b.pdf', 'c.pdf']);
    await user.click(screen.getByRole('button', { name: 'Remove from list: a.pdf' }));
    expect(screen.getByRole('button', { name: 'Choose another file to replace b.pdf' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove from list: c.pdf' }));
    expect(screen.getByRole('button', { name: 'Choose another file to replace b.pdf' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Remove from list: b.pdf' }));
    expect(screen.getByRole('button', { name: 'Choose files' })).toHaveFocus();
    expect(screen.queryByRole('list', { name: 'Files being added' })).toBeNull();
  });
});

describe('leaving while files are in flight (D-26; §10)', () => {
  it('asks before an in-app link while a file is waiting or being added, in the files’ words', async () => {
    const settles = deferredUploads();
    render(queue());
    const user = await choose([pdf('one.pdf'), pdf('two.pdf')]);
    await waitFor(() => expect(screen.getByTestId('guard')).toHaveTextContent('blocking'));
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
    await user.click(screen.getByRole('link', { name: 'My requests' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Leave while files are being added?' })).toBeInTheDocument();
    expect(dialog).toHaveTextContent('Your files are still being added. If you leave now, the files not yet added won’t be.');
    expect(within(dialog).getByRole('button', { name: 'Stay on page' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Leave page' })).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Stay on page' }));
    await act(async () => settles[0]!({ ok: true, data: attachment('one.pdf') }));
    await waitFor(() => expect(settles).toHaveLength(2));
    await act(async () => settles[1]!({ ok: true, data: attachment('two.pdf') }));
    await waitFor(() => expect(screen.getByTestId('guard')).toHaveTextContent('clear'));
  });

  it('keeps a file not added without blocking in-app links, and warns only before the tab closes or reloads', async () => {
    mocks.uploadAttachmentAction.mockResolvedValue({ ok: false, kind: 'retryable', offerNewNote: false, message: 'We couldn’t add this file. Try again.' });
    render(queue());
    await choose([pdf('pack.pdf')]);
    await screen.findByRole('button', { name: 'Retry pack.pdf' });
    expect(screen.getByTestId('guard')).toHaveTextContent('clear');
    const unload = new Event('beforeunload', { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(true);
  });
});

/*
 * 14-UI-SPEC §1.4, §2.1, §2.2 (D-26; UI-D3): on the new-request form the queue waits for the draft. Chosen files stay
 * "chosen, not yet sent" until the form saves the draft and hands the queue its id; then every chosen file is sent to that
 * draft, one at a time, and the form learns how they settled. The page never refreshes behind the form (Pitfall 18).
 */
describe('the new-request form’s queue waits for its draft (deferred)', () => {
  function deferredQueue(ref = createRef<UploadQueueHandle>()) {
    render(
      <NavigationGuardProvider>
        <AttachmentFileStoreProvider>
          <UploadQueue label="Add files" mode="deferred" ownerKey="owner-jane" ref={ref} remaining={20} scope="draft" />
          <GuardProbe />
        </AttachmentFileStoreProvider>
      </NavigationGuardProvider>,
    );
    return ref;
  }

  it('lists chosen files without sending them, each with Remove from the list and no stage', async () => {
    const ref = deferredQueue();
    expect(ref.current!.hasWork()).toBe(false);
    await choose([pdf('vendor-security-pack.pdf'), pdf('data-flow.pdf')]);
    expect(within(queueList()).getAllByRole('listitem')).toHaveLength(2);
    expect(rowFor('vendor-security-pack.pdf')).not.toHaveTextContent('Waiting');
    expect(within(rowFor('vendor-security-pack.pdf')).getByRole('button', { name: 'Remove vendor-security-pack.pdf from the list' })).toBeInTheDocument();
    expect(ref.current!.hasWork()).toBe(true);
    expect(mocks.uploadAttachmentAction).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Add files')).toBeInTheDocument();
  });

  it('counts the chosen files against the room the request has', async () => {
    deferredQueue();
    await choose([pdf('one.pdf'), pdf('two.pdf')]);
    expect(screen.getByText(/18 more can be added to this request/)).toBeInTheDocument();
  });

  it('sends every chosen file to the draft once it exists, in the order chosen, and reports how they settled', async () => {
    const settles = deferredUploads();
    const ref = deferredQueue();
    await choose([pdf('one.pdf'), pdf('two.pdf'), pdf('three.pdf')]);
    let settled: QueueSettlement | null = null;
    act(() => { void ref.current!.sendAll('request-9').then((value) => { settled = value; }); });

    await waitFor(() => expect(settles).toHaveLength(1));
    const first = mocks.uploadAttachmentAction.mock.calls[0]![0] as FormData;
    expect(first.get('requestId')).toBe('request-9');
    expect(first.get('file')).toHaveProperty('name', 'one.pdf');
    expect(rowFor('two.pdf')).toHaveTextContent('Waiting');
    await act(async () => settles[0]!({ ok: true, data: attachment('one.pdf') }));
    await waitFor(() => expect(settles).toHaveLength(2));
    expect((mocks.uploadAttachmentAction.mock.calls[1]![0] as FormData).get('file')).toHaveProperty('name', 'two.pdf');
    await act(async () => settles[1]!({ ok: false, kind: 'refused', reason: 'ATTACHMENT_EMPTY', offerNewNote: false, message: 'This file is empty. Check it’s the file you meant and choose it again.' }));
    await waitFor(() => expect(settles).toHaveLength(3));
    await act(async () => settles[2]!({ ok: true, data: attachment('three.pdf', 'pending') }));

    await waitFor(() => expect(settled).toEqual({ added: 1, pending: 1, notAdded: 1 }));
    expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(3);
    expect(mocks.refresh).not.toHaveBeenCalled();
  });

  it('reports a file the browser refused as not added, without sending it', async () => {
    mocks.uploadAttachmentAction.mockResolvedValue({ ok: true, data: attachment('one.pdf') });
    const ref = deferredQueue();
    await choose([new File(['MZ'], 'tool.exe', { lastModified: 1 }), pdf('one.pdf')]);
    let settled: QueueSettlement | null = null;
    act(() => { void ref.current!.sendAll('request-9').then((value) => { settled = value; }); });
    await waitFor(() => expect(settled).toEqual({ added: 1, pending: 0, notAdded: 1 }));
    expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(1);
  });
});

/* §10 and §1.5: what leaving does to the new-request form's files, before and after its draft exists. */
describe('leaving with the new-request form’s files (§10; UI-D35)', () => {
  const requestLeave = {
    title: 'Leave this request?',
    description: 'Your request and its files haven’t been saved. If you leave now, they’ll be lost.',
    cancelLabel: 'Keep editing',
    confirmLabel: 'Leave page',
    pendingLabel: 'Leaving page…',
  };

  function deferredQueue(ref = createRef<UploadQueueHandle>()) {
    render(
      <NavigationGuardProvider>
        <AttachmentFileStoreProvider>
          <UploadQueue label="Add files" leaveCopy={requestLeave} mode="deferred" ownerKey="owner-jane" ref={ref} remaining={20} scope="draft" />
          <GuardProbe />
          <GuardedLink href="/app/requests">My requests</GuardedLink>
        </AttachmentFileStoreProvider>
      </NavigationGuardProvider>,
    );
    return ref;
  }

  it('asks in the form’s words while chosen files wait for the draft, because leaving would lose them', async () => {
    deferredQueue();
    const user = await choose([pdf('vendor-security-pack.pdf')]);
    await waitFor(() => expect(screen.getByTestId('guard')).toHaveTextContent('blocking'));
    await user.click(screen.getByRole('link', { name: 'My requests' }));
    const dialog = await screen.findByRole('alertdialog');
    expect(within(dialog).getByRole('heading', { name: 'Leave this request?' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Keep editing' })).toHaveFocus();
  });

  it('keeps a file not added once the draft exists, with no question on an in-app link, and replaces a refused file at once', async () => {
    mocks.uploadAttachmentAction.mockResolvedValueOnce({ ok: false, kind: 'refused', reason: 'ATTACHMENT_EMPTY', offerNewNote: false, message: 'This file is empty. Check it’s the file you meant and choose it again.' });
    const ref = deferredQueue();
    const user = await choose([pdf('empty.pdf')]);
    let settled: QueueSettlement | null = null;
    act(() => { void ref.current!.sendAll('request-9').then((value) => { settled = value; }); });
    await waitFor(() => expect(settled).toEqual({ added: 0, pending: 0, notAdded: 1 }));
    expect(screen.getByTestId('guard')).toHaveTextContent('clear');

    mocks.uploadAttachmentAction.mockResolvedValueOnce({ ok: true, data: attachment('pack.pdf') });
    await user.click(screen.getByRole('button', { name: 'Choose another file to replace empty.pdf' }));
    const replace = document.querySelectorAll<HTMLInputElement>('input[type="file"][aria-hidden="true"]');
    await user.upload(replace[replace.length - 1]!, pdf('pack.pdf'));
    await waitFor(() => expect(mocks.uploadAttachmentAction).toHaveBeenCalledTimes(2));
    expect((mocks.uploadAttachmentAction.mock.calls[1]![0] as FormData).get('requestId')).toBe('request-9');
  });
});

/*
 * WR-405 and the pilot's walk (O2; 14-UI-SPEC §1.4 at 375, direction §4 Buttons "touch targets ≥44px below 768px"): a
 * chosen or waiting row's `Remove {name} from the list` is the row's action like `Retry` or `Remove from list`, so below
 * 768px it takes the full width at the touch-target height with a visible `Remove` label, which begins its accessible
 * name (2.5.3); from 768px it stays the 24px icon-only `X` (2.5.8).
 */
describe('a chosen row’s Remove at phone widths (§1.4; WR-405, O2)', () => {
  it('is full width at the touch-target height below 768px, labelled Remove, and the 24px X from 768px', async () => {
    render(
      <NavigationGuardProvider>
        <AttachmentFileStoreProvider>
          <UploadQueue label="Add files" mode="deferred" ownerKey="owner-jane" remaining={20} scope="draft" />
        </AttachmentFileStoreProvider>
      </NavigationGuardProvider>,
    );
    await choose([pdf('vendor-security-pack.pdf')]);

    const remove = within(rowFor('vendor-security-pack.pdf')).getByRole('button', { name: 'Remove vendor-security-pack.pdf from the list' });
    expect(remove, 'the row’s actions below 768px').toHaveClass('max-md:min-h-11', 'max-md:w-full');
    expect(remove, 'the 24px icon button from 768px').toHaveAttribute('data-size', 'icon-xs');
    const label = within(remove).getByText('Remove', { exact: true });
    expect(label, 'the visible label shows below 768px only').toHaveClass('md:hidden');
    expect(remove.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });
});

/*
 * The pilot's walk, O1 and O3 (X-20; 14-UI-SPEC §1.4): a row shows the file-type icon the Files list uses (the document
 * icon for a type that is not allowed, as the file chip does), and its stage sits on the name's line, after the size,
 * where it fits; a refusal's reason wraps beneath it.
 */
describe('each row’s type icon and stage line (X-20, §1.4; the pilot’s walk, O1 and O3)', () => {
  function deferredQueue() {
    return render(
      <NavigationGuardProvider>
        <AttachmentFileStoreProvider>
          <UploadQueue label="Add files" mode="deferred" ownerKey="owner-jane" remaining={20} scope="draft" />
        </AttachmentFileStoreProvider>
      </NavigationGuardProvider>,
    );
  }
  const typed = (name: string, type: string) => new File(['content'], name, { type, lastModified: 1 });

  it('shows the Files list’s type icon on every row, and the document icon for a type that is not allowed (O1)', async () => {
    deferredQueue();
    await choose([
      pdf('vendor-security-pack.pdf'),
      typed('vendor-questionnaire.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'),
      typed('architecture-deck.pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'),
      typed('diagram.png', 'image/png'),
      typed('tool.exe', 'application/octet-stream'),
    ]);

    const icon = (name: string) => rowFor(name).querySelector('svg');
    expect(icon('vendor-security-pack.pdf')).toHaveClass('lucide-file-text');
    expect(icon('vendor-questionnaire.xlsx')).toHaveClass('lucide-file-spreadsheet');
    expect(icon('architecture-deck.pptx')).toHaveClass('lucide-presentation');
    expect(icon('diagram.png')).toHaveClass('lucide-file-image');
    expect(icon('tool.exe')).toHaveClass('lucide-file-text');
    for (const name of ['vendor-security-pack.pdf', 'tool.exe']) expect(icon(name)).toHaveAttribute('aria-hidden', 'true');
  });

  it('puts a refusal’s Not added. on the name’s line, after the size, with the reason beneath (O3)', async () => {
    deferredQueue();
    await choose([typed('tool.exe', 'application/octet-stream')]);

    const row = rowFor('tool.exe');
    const nameLine = within(row).getByText('tool.exe', { exact: true }).parentElement!;
    const stage = within(nameLine).getByText('Not added.', { exact: true });
    expect(nameLine.lastElementChild, 'the stage follows the name and the size on their line').toBe(stage.closest('[data-queue-stage]'));
    expect(stage.closest('[data-queue-stage]')!.querySelector('svg'), 'with its 14px stage icon').toHaveClass('lucide-circle-alert', 'size-3.5');
    const reason = within(row).getByText('This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.', { exact: true });
    expect(nameLine, 'the reason wraps beneath the line').not.toContainElement(reason);
    expect(row).toHaveTextContent('Not added. This type of file can’t be added.');
  });

  /*
   * 14-UI-REVIEW UI-06 (14-UI-SPEC Spacing, "16px | … queue and card row padding"; X-20, at least the 44px row height):
   * a queue row has 16px padding on every side.
   */
  it('pads each row 16px on every side, at least the 44px row height (UI-06)', async () => {
    deferredQueue();
    await choose([pdf('vendor-security-pack.pdf')]);

    const row = rowFor('vendor-security-pack.pdf');
    expect(row).toHaveClass('px-4', 'py-4', 'min-h-11');
    expect(row).not.toHaveClass('py-3');
  });

  it('puts Waiting on the name’s line while a file waits its turn (O3)', async () => {
    deferredUploads();
    render(queue());
    await choose([pdf('first.pdf'), pdf('second.pdf')]);

    await waitFor(() => expect(within(rowFor('second.pdf')).getByText('Waiting', { exact: true })).toBeInTheDocument());
    const nameLine = within(rowFor('second.pdf')).getByText('second.pdf', { exact: true }).parentElement!;
    expect(within(nameLine).getByText('Waiting', { exact: true }).closest('[data-queue-stage]')!.querySelector('svg')).toHaveClass('lucide-clock');
  });
});
