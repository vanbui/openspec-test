import { ArchiveXIcon, FileXIcon, ShieldCheckIcon, ShieldEllipsisIcon, ShieldXIcon, type LucideIcon } from 'lucide-react';

import { StatusBadge, type AttachmentStatusIconName } from '@/components/csrm/status-badge';

import type { RequestAttachment } from './attachments-schema';

/*
 * A file state's badge (14-UI-SPEC §3.4; X-21). The one status mapping keeps each state's label and tone and names its
 * icon; this module resolves the names (IN-506), so only the routes that render a file carry the five file icons, and
 * the assessment editor's first load, which renders other badges, carries none of them (D-27, R-08-34). Server-safe: no
 * directive, so a client or a server component can render it.
 */

/** §3.4's icon for each named file state icon. */
export const attachmentStatusIcons = {
  ShieldCheck: ShieldCheckIcon,
  ShieldEllipsis: ShieldEllipsisIcon,
  ShieldX: ShieldXIcon,
  FileX: FileXIcon,
  ArchiveX: ArchiveXIcon,
} as const satisfies Readonly<Record<AttachmentStatusIconName, LucideIcon>>;

export type AttachmentStatusBadgeProps = {
  value: RequestAttachment['state'];
  className?: string;
  /** Announce state changes politely, for a badge that updates in place. */
  live?: boolean;
};

export function AttachmentStatusBadge({ className, live = false, value }: AttachmentStatusBadgeProps) {
  return <StatusBadge family="attachment" icons={attachmentStatusIcons} live={live} value={value} {...(className ? { className } : {})} />;
}
