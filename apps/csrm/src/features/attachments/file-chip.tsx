'use client';

import { Download, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, type ReactNode } from 'react';
import { toast } from 'sonner';

import { RecordLink } from '@/components/csrm/record-link';
import { Button } from '@/components/ui/button';
import { toastAction } from '@/components/ui/toast-action';
import { attachmentFileRefusal, downloadFailureTitle } from '@/lib/api/refusal-copy';
import { formatFileSize } from '@/lib/files/format-file-size';
import { saveFile } from '@/lib/files/save-file';
import { cn } from '@/lib/utils';

import { downloadAttachmentAction, type DownloadAttachmentResult } from './attachments-actions';
import { fileDownloadCopy, type AttachmentType, type RequestAttachment } from './attachments-domain';
import { FileTypeIcon } from './file-type-icon';

/*
 * The file chip (X-21; 14-UI-SPEC §4.1, §4.2): a file shown inside another record, a note or the composer. A rectangle
 * with the default 1px boundary, the medium radius and 8px by 12px padding, holding the type icon, the name on one line
 * (an ellipsis beyond 28rem, the full name in the DOM and in its controls' accessible names, X-23), the size, and at its
 * end the chip's one control or the file's badge. A name with a row in the Files list is a record link to it.
 *
 * 14-UI-REVIEW UI-01 (the pilot's ruling): below 768px the badge takes its own line beneath the name, so the name keeps
 * the chip's width; the longest badge, `Waiting for malware check`, otherwise left the name a letter and an ellipsis at
 * 375. From 768px the chip is one row. The control stays at the end of the name's line at every width.
 */

export type FileChipProps = {
  name: string;
  /** Bytes, shown in X-23's 1,024-byte units. */
  size: number;
  /** The file's type; a chosen file whose extension is not allowed has none and shows the document icon. */
  type: AttachmentType | null;
  /** `#file-{id}`: the name leads to the file's row in the Files section (§4.2). */
  href?: string;
  /** The chip's control (`Download`, `Remove {name} from the list`), at the end of the name's line. */
  children?: ReactNode;
  /** The file's state badge (§3.4): its own line below 768px, the end of the chip's one row from 768px. */
  badge?: ReactNode;
  className?: string;
};

export function FileChip({ badge, children, className, href, name, size, type }: FileChipProps) {
  const nameClass = 'min-w-0 max-w-md truncate text-sm font-medium';
  return (
    <div className={cn('flex min-w-0 max-w-full flex-wrap items-center gap-1 rounded-md border border-border bg-surface px-3 py-2 md:flex-nowrap', className)} data-file-chip="">
      {/* The icon, the name and the size: below 768px this line takes the chip's width, so the name is never squeezed. */}
      <span className="flex min-w-0 items-center gap-1 max-md:flex-1">
        <FileTypeIcon type={type} />
        {href ? <RecordLink className={nameClass} href={href}>{name}</RecordLink> : <span className={cn(nameClass, 'text-foreground')}>{name}</span>}
        <span className="shrink-0 ps-1 text-xs text-foreground-secondary tabular-nums">{formatFileSize(size)}</span>
      </span>
      {children ? <span className="ms-auto flex shrink-0 items-center ps-1">{children}</span> : null}
      {badge ? <span className="flex shrink-0 items-center max-md:basis-full md:ms-auto md:ps-1" data-file-chip-badge="">{badge}</span> : null}
    </div>
  );
}

/**
 * A chip's icon-only control (`Download {name}`, the composer's `Remove {name} from the list`): `size="icon-xs"`, the
 * 24px circle from 768px (2.5.8), and below 768px the touch-target circle with the 16px icon (direction §4 Buttons,
 * "touch targets ≥44px below 768px"; 14-UI-REVIEW UI-03), as the queue's `Remove` and the card's `More actions` are.
 */
export const chipIconButtonClassName = "max-md:size-11 max-md:[&_svg:not([class*='size-'])]:size-4";

export type FileChipDownloadProps = { requestId: string; attachment: RequestAttachment };

/**
 * A chip's `Download` (X-21; UI-D15, UI-D25): icon-only and ghost, named `Download {name}` so every repeated control is
 * unique (2.5.3). The Server Action checks the bytes on the server and the browser saves them; nothing previews inline
 * (D-23, D-24). While the file comes the name reads `Downloading…` and the spinner turns; a visually hidden status says
 * it downloaded once, and a refusal is family O in a danger toast. Below 768px it is the touch-target circle with the
 * 16px icon (direction §4 Buttons, "touch targets ≥44px below 768px"; 14-UI-REVIEW UI-03); from 768px the 24px icon
 * button (2.5.8).
 */
export function FileChipDownload({ attachment, requestId }: FileChipDownloadProps) {
  const router = useRouter();
  const [downloading, setDownloading] = useState(false);
  const [announcement, setAnnouncement] = useState('');

  async function download() {
    if (downloading) return;
    setAnnouncement('');
    setDownloading(true);
    let result: DownloadAttachmentResult;
    try {
      result = await downloadAttachmentAction({ requestId, attachmentId: attachment.documentId });
    } catch {
      /* A network failure or a timeout reaching the action. */
      result = { ok: false, ...attachmentFileRefusal('download', {}) };
    }
    setDownloading(false);
    if (!result.ok) {
      toast.error(downloadFailureTitle, {
        description: result.message,
        duration: Infinity,
        action: result.kind === 'retryable'
          ? toastAction(fileDownloadCopy.tryAgain, () => void download())
          : toastAction(fileDownloadCopy.refresh, () => router.refresh()),
      });
      return;
    }
    saveFile({ fileName: result.fileName, contentType: result.contentType, bytes: result.bytes });
    setAnnouncement(fileDownloadCopy.downloaded(attachment.fileName));
  }

  const label = downloading ? fileDownloadCopy.downloading : fileDownloadCopy.download;
  return (
    <>
      <Button
        aria-disabled={downloading || undefined}
        aria-label={`${label} ${attachment.fileName}`}
        className={chipIconButtonClassName}
        data-print="hidden"
        onClick={() => void download()}
        size="icon-xs"
        type="button"
        variant="ghost"
      >
        {downloading ? <Loader2 aria-hidden="true" className="animate-spin motion-reduce:animate-none" /> : <Download aria-hidden="true" />}
      </Button>
      <span className="sr-only" role="status">{announcement}</span>
    </>
  );
}
