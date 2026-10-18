import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ downloadAttachmentAction: vi.fn(), saveFile: vi.fn(), toastError: vi.fn(), refresh: vi.fn() }));
vi.mock('./attachments-actions', () => ({ downloadAttachmentAction: mocks.downloadAttachmentAction }));
vi.mock('@/lib/files/save-file', () => ({ saveFile: mocks.saveFile }));
vi.mock('sonner', () => ({ toast: { error: mocks.toastError } }));
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: mocks.refresh, push: vi.fn() }) }));

import type { RequestAttachment } from './attachments-schema';
import { FileChip, FileChipDownload } from './file-chip';

const LONG = `architecture-deck-${'with-a-very-long-name-'.repeat(8)}final.pptx`;

function attachment(overrides: Partial<RequestAttachment> = {}): RequestAttachment {
  return {
    documentId: 'att-9', fileName: 'architecture-deck.pptx', fileType: 'pptx', byteSize: 3_727, state: 'available',
    uploadedBy: { documentId: 'u-jane', displayName: 'Jane Doe' }, uploaderPart: 'requestor', uploadedAt: '2026-10-10T01:00:00.000Z',
    note: { documentId: 'n9', postedAt: '2026-10-10T01:00:00.000Z' }, removedBy: null, removedAt: null, detection: null,
    actions: { download: true, remove: true, restore: false }, ...overrides,
  };
}

afterEach(() => {
  vi.clearAllMocks();
});

/* X-21 (14-UI-SPEC §4.1, §4.2): a file shown inside another record, a note or the composer, is a file chip. */
describe('the file chip (X-21)', () => {
  it('is a rectangle with the default 1px boundary, the medium radius and 8px by 12px padding', () => {
    const { container } = render(<FileChip name="architecture-deck.pptx" size={3_727} type="pptx" />);
    const chip = container.querySelector('[data-file-chip]');
    expect(chip).not.toBeNull();
    expect(chip).toHaveClass('border', 'border-border', 'rounded-md', 'px-3', 'py-2');
  });

  it('holds the type icon, the name and the size in X-23’s units', () => {
    const { container } = render(<FileChip name="architecture-deck.pptx" size={3_727} type="pptx" />);
    const chip = container.querySelector('[data-file-chip]')!;
    expect(chip.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
    expect(chip).toHaveTextContent('architecture-deck.pptx');
    expect(screen.getByText('4 KB')).toHaveClass('tabular-nums');
  });

  it('keeps the name on one line, ending in an ellipsis beyond 28rem, with the full name in the DOM (X-23)', () => {
    render(<FileChip name={LONG} size={3_727} type="pptx" />);
    const name = screen.getByText(LONG);
    expect(name).toHaveClass('truncate', 'max-w-md');
    expect(name.textContent).toBe(LONG);
  });

  it('makes the name a record link to the file’s row when it has one', () => {
    render(<FileChip href="#file-att-9" name="architecture-deck.pptx" size={3_727} type="pptx" />);
    expect(screen.getByRole('link', { name: 'architecture-deck.pptx' })).toHaveAttribute('href', '#file-att-9');
  });

  /*
   * 14-UI-REVIEW UI-01 (the pilot's ruling): below 768px a state badge takes its own line beneath the name, so the name
   * keeps the chip's width; the longest badge, `Waiting for malware check`, left the name a letter and an ellipsis at 375.
   * From 768px the chip stays one row. jsdom lays nothing out, so this reads the classes; request-attachments.spec.ts
   * measures the boxes at 375 (COLLAB02_FILE_STATES).
   */
  it('puts a state badge on its own line below 768px, so the name keeps the chip’s width, and keeps one row from 768px (UI-01)', () => {
    const { container } = render(<FileChip badge={<span>Waiting for malware check</span>} name={LONG} size={3_727} type="pdf" />);
    const chip = container.querySelector('[data-file-chip]')!;
    expect(chip, 'the chip wraps below 768px and stays one row from 768px').toHaveClass('flex', 'flex-wrap', 'md:flex-nowrap');
    const badge = screen.getByText('Waiting for malware check').closest<HTMLElement>('[data-file-chip-badge]');
    expect(badge, 'the badge has its own slot').not.toBeNull();
    expect(badge, 'a whole line of its own below 768px, at the row’s end from 768px').toHaveClass('shrink-0', 'max-md:basis-full', 'md:ms-auto', 'md:ps-1');
    const line = screen.getByText(LONG).parentElement!;
    expect(line, 'the icon, the name and the size share the first line, which takes the chip’s width below 768px').toHaveClass('flex', 'min-w-0', 'max-md:flex-1');
    expect(line).toContainElement(chip.querySelector('svg'));
    expect(line).toHaveTextContent('4 KB');
    expect(line, 'the badge is not on the name’s line').not.toContainElement(badge);
  });

  it('keeps the chip’s control at the end of the name’s line, not on a line of its own', () => {
    const { container } = render(<FileChip name="architecture-deck.pptx" size={3_727} type="pptx"><button type="button">Remove</button></FileChip>);
    expect(container.querySelector('[data-file-chip-badge]')).toBeNull();
    const control = screen.getByRole('button', { name: 'Remove' }).parentElement!;
    expect(control).toHaveClass('ms-auto', 'shrink-0');
    expect(control).not.toHaveClass('max-md:basis-full');
  });

  it('renders a name as text, never as markup (X-23)', () => {
    render(<FileChip name="<img src=x onerror=alert(1)>.pdf" size={10} type="pdf" />);
    expect(screen.getByText('<img src=x onerror=alert(1)>.pdf')).toBeInTheDocument();
    expect(document.querySelector('img')).toBeNull();
  });
});

describe('the chip’s Download (X-21; UI-D15, UI-D25)', () => {
  it('is an icon-only ghost control named with the full file name (2.5.3)', () => {
    render(<FileChipDownload attachment={attachment({ fileName: LONG })} requestId="request-1" />);
    const button = screen.getByRole('button', { name: `Download ${LONG}` });
    expect(button).toHaveAttribute('data-variant', 'ghost');
    expect(button.textContent?.trim()).toBe('');
  });

  /*
   * 14-UI-REVIEW UI-03 (the pilot's ruling; direction §4 Buttons, "touch targets ≥44px below 768px"): below 768px the
   * chip's Download is the touch-target circle, as the queue's Remove and the card's More actions are; from 768px it
   * keeps the 24px icon button (2.5.8). request-attachments.spec.ts measures it at 375 and 1440.
   */
  it('is the 44px touch-target circle below 768px and the 24px icon button from 768px (UI-03)', () => {
    render(<FileChipDownload attachment={attachment()} requestId="request-1" />);
    const button = screen.getByRole('button', { name: 'Download architecture-deck.pptx' });
    expect(button).toHaveAttribute('data-size', 'icon-xs');
    expect(button).toHaveClass('size-6', 'max-md:size-11', 'rounded-full');
    expect(button, 'its icon is the 16px icon at the phone size').toHaveClass("max-md:[&_svg:not([class*='size-'])]:size-4");
  });

  it('reads the file through the Server Action and saves it, saying it downloaded once', async () => {
    mocks.downloadAttachmentAction.mockResolvedValue({ ok: true, fileName: 'architecture-deck.pptx', contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', bytes: new Uint8Array([0x50, 0x4b]) });
    render(<FileChipDownload attachment={attachment()} requestId="request-1" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download architecture-deck.pptx' }));
    await waitFor(() => expect(mocks.saveFile).toHaveBeenCalledTimes(1));
    expect(mocks.downloadAttachmentAction).toHaveBeenCalledWith({ requestId: 'request-1', attachmentId: 'att-9' });
    expect(mocks.saveFile).toHaveBeenCalledWith(expect.objectContaining({ fileName: 'architecture-deck.pptx' }));
    expect(screen.getByRole('status')).toHaveTextContent('architecture-deck.pptx downloaded.');
  });

  it('shows family O in a danger toast when the download is refused', async () => {
    mocks.downloadAttachmentAction.mockResolvedValue({ ok: false, kind: 'blocked', message: 'This file was removed, so it can’t be downloaded. Refresh the page.' });
    render(<FileChipDownload attachment={attachment()} requestId="request-1" />);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Download architecture-deck.pptx' }));
    await waitFor(() => expect(mocks.toastError).toHaveBeenCalledWith('File not downloaded', expect.objectContaining({ description: 'This file was removed, so it can’t be downloaded. Refresh the page.' })));
    expect(mocks.saveFile).not.toHaveBeenCalled();
  });
});
