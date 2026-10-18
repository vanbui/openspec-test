import { FileImage, FileSpreadsheet, FileText, Presentation } from 'lucide-react';

import { cn } from '@/lib/utils';

import { fileTypeIconName, type AttachmentType, type FileTypeIconName } from './attachments-domain';

/*
 * The file-type icon (X-20, X-21): `FileText` for PDF, DOCX and TXT, `FileSpreadsheet` for XLSX and CSV,
 * `Presentation` for PPTX and `FileImage` for PNG and JPEG, from the one mapping in `attachments-domain`. A chosen file
 * whose extension is not allowed has no type and shows the document icon, as its file chip does. The Files list's rows
 * and cards, the file chip and the upload queue's rows all draw it here, so the mapping is never repeated. Decorative:
 * the file's name and type label say what it is.
 */

const typeIcons: Readonly<Record<FileTypeIconName, typeof FileText>> = { FileText, FileSpreadsheet, Presentation, FileImage };

export function FileTypeIcon({ className, type }: { type: AttachmentType | null; className?: string }) {
  const Icon = type ? typeIcons[fileTypeIconName(type)] : FileText;
  return <Icon aria-hidden="true" className={cn('size-4 shrink-0 text-foreground-secondary', className)} />;
}
