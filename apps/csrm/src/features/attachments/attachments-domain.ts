import type { RequestAttachmentSummary } from '@/features/requests/request-domain';
import { attachmentAddRefusal, attachmentAiRefusal } from '@/lib/api/refusal-copy';
import { formatFileSize } from '@/lib/files/format-file-size';

import type { RequestAttachment, RequestAttachmentAddFacts, RequestAttachmentAiPolicy } from './attachments-schema';
import { TRANSFER_FAILED, fileKey, holdsRoom, type QueueRow } from './upload-queue-model';

export {
  TRANSFER_FAILED,
  fileKey,
  holdsRoom,
  queueCountLine,
  queueReducer,
  queueSettlement,
  shownInQueue,
  waitingRow,
  type QueueAction,
  type QueueRow,
  type QueueSettlement,
  type QueueStage,
} from './upload-queue-model';

/*
 * The request attachments feature's words, facts and queue model (Phase 14 D-26 to D-28; 14-UI-SPEC §1, §3; X-19 to
 * X-21, X-23). Zod-free and directive-free, so client modules take constants and builders from here without downloading
 * zod (zod-client-boundary.test.ts): the schema module is imported for its types only. People see a record as a "file"
 * (UI-D1); nothing here says "attachment", "upload" or "scan".
 */

export type { RequestAttachment } from './attachments-schema';
export type AttachmentType = RequestAttachment['fileType'];
export type AttachmentState = RequestAttachment['state'];
export type AttachmentPart = RequestAttachment['uploaderPart'];
export type AttachmentAddFacts = RequestAttachmentAddFacts;
export type AttachmentWindow = RequestAttachmentAddFacts['window'];
export type AttachmentAddRefusalReason = NonNullable<RequestAttachmentSummary['refusal']>;
export type FilesViewer = 'requestor' | 'analyst';

/** The file chooser's filter: the allowed types by extension (D-09). Not copy: the attribute is `accept` (UI-D33). */
export const ATTACHMENT_ACCEPT = '.pdf,.docx,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg';

/** The allowed list, everywhere it is named in a sentence (X-23). */
export const ALLOWED_TYPES_SENTENCE = 'PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG';

/** The largest file Strapi accepts: 25 MiB, labelled `25 MB` (D-10, UI-D24). */
export const MAX_FILE_BYTES = 26_214_400;

const count = new Intl.NumberFormat('en-AU');

export const filesCopy = {
  title: 'Files',
  addFiles: 'Add files',
  chooseFiles: 'Choose files',
  dragHere: 'Drag files here, or',
  queueName: 'Files being added',
  beforeSubmission: 'Before submission',
  loadFailed: 'We couldn’t load the files',
  tryAgain: 'Try again',
  waiting: 'Waiting',
  adding: 'Adding…',
  added: 'Added',
  pending: 'Added. Waiting for the malware check before anyone can download it.',
  notAdded: 'Not added.',
  transferFailed: TRANSFER_FAILED,
  retry: 'Retry',
  chooseAnother: 'Choose another file',
  removeFromList: 'Remove from list',
  /** §1.4 at 375 (WR-405): the visible label of a chosen or waiting row's `Remove {name} from the list`. */
  removeChosen: 'Remove',
  restored: 'Restored from earlier in this session.',
  /** §3.6, §4.1 (UI-D6): after submission the field hands files to the Notes composer. */
  addFilesWithNote: 'Add files with a note',
  withNoteLine: 'Files are added with a note, so everyone knows what they are.',
  /** §4.2 (UI-D9): a file its note can no longer take moves to the composer. */
  addWithNewNote: 'Add with a new note',
} as const;

/** §1.4: each repeated row control's accessible name begins with its visible label and names its file (2.5.3). */
export const queueControlNames = {
  retry: (name: string) => `Retry ${name}`,
  chooseAnother: (name: string) => `Choose another file to replace ${name}`,
  removeFromList: (name: string) => `Remove from list: ${name}`,
  removeWaiting: (name: string) => `Remove ${name} from the list`,
  addWithNewNote: (name: string) => `Add with a new note: ${name}`,
} as const;

/**
 * §3.3 (UI-D15, UI-D25): the list's Download. The visible label comes first in the accessible name and the file's
 * name follows it, so every repeated control is unique (2.5.3); once the browser has the file a visually hidden status
 * says so once, and no toast shows.
 */
export const fileDownloadCopy = {
  download: 'Download',
  downloading: 'Downloading…',
  downloaded: (name: string) => `${name} downloaded.`,
  tryAgain: 'Try again',
  refresh: 'Refresh page',
} as const;

/**
 * §3.3, §3.5 (D-20; UI-D17): Remove, Restore, the removed group and the phone actions sheet. Each repeated control's
 * accessible name begins with its visible label and names its file (2.5.3).
 */
export const fileRemovalCopy = {
  remove: 'Remove',
  restore: 'Restore',
  removeName: (name: string) => `Remove ${name}`,
  restoreName: (name: string) => `Restore ${name}`,
  showRemoved: (removed: number) => `Show removed files (${count.format(removed)})`,
  hideRemoved: 'Hide removed files',
  removedListName: 'Removed files',
  addedBy: (name: string) => `Added by ${name}`,
  removedBy: (name: string) => `Removed by ${name}`,
  /** A remover the read cannot name. */
  removed: 'Removed',
  moreActions: (name: string) => `More actions for ${name}`,
  close: 'Close',
  closeActions: (name: string) => `Close actions for ${name}`,
  undo: 'Undo',
  tryAgain: 'Try again',
  refresh: 'Refresh page',
} as const;

export type FileRemovalChange = {
  /** True to remove the file, false to restore it. */
  removed: boolean;
  /** True when this change is an Undo of the one before. */
  undoing: boolean;
  /** Whether the file's text was included in the AI inputs before it was removed (UI-D18). */
  aiIncluded: boolean;
  /**
   * The state the file had before it was removed, where this view knows it: an optimistic restore returns the file to
   * it, so a file waiting for its malware check keeps saying so until Strapi answers (IN-408).
   */
  before?: AttachmentState;
};

/**
 * §9 (X-14; UI-D18): the toast after a removal or a restore, or after its Undo. Removing an included file ends its
 * inclusion and restoring does not include it again, so the toasts say so.
 */
export function fileRemovalToast(name: string, { aiIncluded, removed, undoing }: FileRemovalChange): string {
  if (removed && !undoing) return `${name} removed.${aiIncluded ? ' Its text is no longer included in the AI inputs.' : ''}`;
  if (!removed && undoing) return `${name} restored.${aiIncluded ? ' Include its text again if the AI should use it.' : ''}`;
  return removed ? `${name} removed again.` : `${name} restored.`;
}

/** §9: the danger toast's title when a removal, a restore or its Undo is refused. */
export function fileRemovalFailureTitle({ removed, undoing }: Pick<FileRemovalChange, 'removed' | 'undoing'>): string {
  if (undoing) return 'Couldn’t undo';
  return removed ? 'File not removed' : 'File not restored';
}

/**
 * §3.4 (X-21): the line beneath a file that cannot be downloaded, saying what its state means. An available file has
 * none, and a removed file is in the removed group, never the main list. The detection name is data, shown verbatim
 * (UI-D31).
 */
export function fileStateLine(attachment: Pick<RequestAttachment, 'state' | 'detection'>): string | null {
  switch (attachment.state) {
    case 'pending':
      return 'It can be downloaded once it passes. Refresh the page later to see.';
    case 'blocked':
      return `Malware found${attachment.detection ? `: ${attachment.detection}` : ''}. The file was deleted and can’t be downloaded.`;
    case 'unavailable':
      return 'This file can’t be downloaded. Contact your administrator.';
    default:
      return null;
  }
}

/** §10: the in-app warning while a file is waiting or being added (Phase 10's leave dialog, in the files' words). */
export const filesLeaveCopy = {
  title: 'Leave while files are being added?',
  description: 'Your files are still being added. If you leave now, the files not yet added won’t be.',
  cancelLabel: 'Stay on page',
  confirmLabel: 'Leave page',
  pendingLabel: 'Leaving page…',
} as const;

/** §2.1, §2.3 (D-27): the request form's `Supporting files` section, on the new-request form and the draft's edit form. */
export const filesIntakeCopy = {
  title: 'Supporting files',
  createDescription: 'Add documents that help a Security Analyst understand this request, such as a vendor’s security pack, a data-flow diagram or a completed security questionnaire. Files are added when you save the draft.',
  editDescription: 'Files are added as soon as you choose them, and stay with the draft whether or not you save your other changes.',
  addingFiles: 'Adding files…',
  goToDraft: 'Go to draft',
} as const;

/** §2.2 (UI-D29): the danger alert when the draft is saved but `{k}` files were not added. */
export function filesNotAddedAlert(notAdded: number): { title: string; description: string } {
  const one = notAdded === 1;
  return {
    title: `${count.format(notAdded)} ${one ? 'file wasn’t' : 'files weren’t'} added`,
    description: `Your draft is saved. Retry, remove or replace ${one ? 'it' : 'them'}, then save again, or go to the draft, where ${one ? 'it stays' : 'they stay'} listed for you to retry.`,
  };
}

/** §10: leaving the new-request form while it holds unsaved fields, or files chosen before the draft exists. */
export const requestLeaveCopy = {
  title: 'Leave this request?',
  description: 'Your request and its files haven’t been saved. If you leave now, they’ll be lost.',
  cancelLabel: 'Keep editing',
  confirmLabel: 'Leave page',
  pendingLabel: 'Leaving page…',
} as const;

/**
 * §10 (amended on 2026-10-11 in stage B, IN-502): leaving the new-request form with unsaved fields once its first save has
 * created the draft. The request is saved and its files not added are kept for the tab (§1.5), so only the changes made
 * since are lost.
 */
export const savedRequestLeaveCopy = {
  title: 'Leave this request?',
  description: 'Your changes to this request haven’t been saved. If you leave now, they’ll be lost.',
  cancelLabel: 'Keep editing',
  confirmLabel: 'Leave page',
  pendingLabel: 'Leaving page…',
} as const;

/** §1.1: the field's hint, linked to the field by `aria-describedby`. */
export function fileFieldHint(remaining: number): string {
  return `${ALLOWED_TYPES_SENTENCE} · up to 25 MB each · ${count.format(remaining)} more can be added to this request`;
}

/** §3.1: the section's count line, `{n} {file|files}`. */
export function filesCountLabel(total: number): string {
  return `${count.format(total)} ${total === 1 ? 'file' : 'files'}`;
}

/** §3.1 (D-28): the section's description for the viewer. */
export function filesDescription(viewer: FilesViewer): string {
  return viewer === 'requestor'
    ? 'Files for this request, from you and the Security Analysts. Each file is checked for malware before anyone can download it. A Security Analyst may include a file’s text in the information CSRM sends to the AI, within your organisation’s data policy.'
    : 'Files from the Requestor and the Security Analysts. Each file is checked for malware before anyone can download it. Include a file’s text to use it in AI generation.';
}

/**
 * §3.7's empty list, as the shared EmptyState's kind: `first-use` (`No files yet`) says what to do next while files can
 * be added; `cleared` (`No files`) stands above the §3.6 line when they are closed or paused. The heading is
 * EmptyState's, from its kind, so nothing here can drift from what renders (IN-406).
 */
export type FilesEmptyState = { kind: 'first-use'; description: string } | { kind: 'cleared'; description: null };

export function filesEmptyState(window: AttachmentWindow, viewer: FilesViewer, open: boolean): FilesEmptyState {
  if (!open || window === 'closed') return { kind: 'cleared', description: null };
  if (window === 'intake') {
    return { kind: 'first-use', description: 'Add documents that help a Security Analyst understand this request, such as a vendor’s security pack or a data-flow diagram.' };
  }
  return {
    kind: 'first-use',
    description: viewer === 'requestor'
      ? 'Add files with a note when a Security Analyst asks for them, or when you have more to share.'
      : 'Add files with a note to share documents with the Requestor.',
  };
}

export type FilesLockedIcon = 'Paperclip' | 'CloudOff' | 'Lock';

/**
 * §1.2 and §3.6: the one line that stands in place of the field where files cannot be added, from the reason Strapi
 * served. `REQUEST_NOT_SUBMITTED` reaches a Security Analyst on a returned draft.
 */
export function filesLockedLine(refusal: AttachmentAddRefusalReason | null, _viewer: FilesViewer): { icon: FilesLockedIcon; text: string } | null {
  switch (refusal) {
    case 'ATTACHMENT_LIMIT_REACHED':
      return { icon: 'Paperclip', text: 'This request has 20 files, the most it can hold. Remove a file to add another.' };
    case 'ATTACHMENT_LIFETIME_LIMIT_REACHED':
      return { icon: 'Paperclip', text: 'This request has reached the most files it can keep, counting removed ones, so no more can be added.' };
    case 'ATTACHMENTS_NOT_CONFIGURED':
      return { icon: 'CloudOff', text: 'Files can’t be added right now because file storage isn’t set up. Contact your administrator.' };
    case 'ATTACHMENTS_CLOSED':
      return { icon: 'Lock', text: 'Files closed when the assessment was released. They stay here as part of the record.' };
    case 'REQUEST_NOT_SUBMITTED':
      return { icon: 'Lock', text: 'Files are paused while this request is a draft. They can be added again once the Requestor resubmits it.' };
    default:
      return null;
  }
}

const typeLabels: Readonly<Record<AttachmentType, string>> = {
  pdf: 'PDF', docx: 'DOCX', xlsx: 'XLSX', pptx: 'PPTX', csv: 'CSV', txt: 'TXT', png: 'PNG', jpeg: 'JPEG',
};

/** X-23: a type named by its extension in capitals. */
export function fileTypeLabel(type: AttachmentType): string {
  return typeLabels[type];
}

export type FileTypeIconName = 'FileText' | 'FileSpreadsheet' | 'Presentation' | 'FileImage';

const typeIcons: Readonly<Record<AttachmentType, FileTypeIconName>> = {
  pdf: 'FileText', docx: 'FileText', txt: 'FileText', xlsx: 'FileSpreadsheet', csv: 'FileSpreadsheet', pptx: 'Presentation', png: 'FileImage', jpeg: 'FileImage',
};

/** X-21: the 16px type icon of a file. */
export function fileTypeIconName(type: AttachmentType): FileTypeIconName {
  return typeIcons[type];
}

const partLabels: Readonly<Record<AttachmentPart, string>> = { requestor: 'Requestor', 'security-analyst': 'Security Analyst' };
const unnamedUploader: Readonly<Record<AttachmentPart, string>> = { requestor: 'The Requestor', 'security-analyst': 'A Security Analyst' };

/** §3.2 `Added by`: the person's name and their part in words; a person the read cannot name is named by part. */
export function fileUploader(attachment: Pick<RequestAttachment, 'uploadedBy' | 'uploaderPart'>): { name: string; part: string } {
  return { name: attachment.uploadedBy?.displayName ?? unnamedUploader[attachment.uploaderPart], part: partLabels[attachment.uploaderPart] };
}

/** The extension a chosen file's name carries, as the type it would be recorded as, or null when it is not allowed. */
export function chosenFileType(name: string): AttachmentType | null {
  const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
  if (extension === 'jpg') return 'jpeg';
  return (Object.keys(typeLabels) as AttachmentType[]).find((type) => type === extension) ?? null;
}

export type ChosenFile = { key: string; file: File; refusal: string | null };

/** §1.3: the first check a chosen file fails, in family N's words, or null. */
function precheckRefusal(file: File): string | null {
  if (chosenFileType(file.name) === null) return attachmentAddRefusal({ reason: 'ATTACHMENT_TYPE_NOT_ALLOWED' }).message;
  if (file.size === 0) return attachmentAddRefusal({ reason: 'ATTACHMENT_EMPTY' }).message;
  if (file.size > MAX_FILE_BYTES) return attachmentAddRefusal({ reason: 'ATTACHMENT_TOO_LARGE', sizeLabel: formatFileSize(file.size) }).message;
  return null;
}

/**
 * §1.3 (D-11; UI-D13): the files chosen, in the order chosen, checked in the browser for type, emptiness, size and the
 * room the request has left before anything is sent; each refused file carries family N's sentence and is never sent.
 * The same file (name, size and last-modified time) chosen twice, or already in the queue, is listed once. These
 * checks are fast feedback only: Strapi screens every file and refuses in the same words (T-14-43).
 */
export function precheckChosenFiles(files: readonly File[], { existingKeys, remaining }: { remaining: number; existingKeys: ReadonlySet<string> }): ChosenFile[] {
  const seen = new Set(existingKeys);
  let room = remaining;
  const checked: ChosenFile[] = [];
  for (const file of files) {
    const key = fileKey(file);
    if (seen.has(key)) continue;
    seen.add(key);
    const refusal = precheckRefusal(file);
    if (refusal !== null) {
      checked.push({ key, file, refusal });
    } else if (room > 0) {
      room -= 1;
      checked.push({ key, file, refusal: null });
    } else {
      checked.push({ key, file, refusal: attachmentAddRefusal({ reason: 'ATTACHMENT_LIMIT_REACHED' }).message });
    }
  }
  return checked;
}

/**
 * §4.2 (D-17): the request's files grouped by the note they came with, each note's oldest first, so a note lists its
 * files in the order they were added. A file added before submission has no note and is in no group.
 */
export function groupAttachmentsByNote(attachments: readonly RequestAttachment[]): Record<string, RequestAttachment[]> {
  const byNote: Record<string, RequestAttachment[]> = {};
  for (const attachment of attachments) {
    if (!attachment.note) continue;
    (byNote[attachment.note.documentId] ??= []).push(attachment);
  }
  for (const files of Object.values(byNote)) files.sort((left, right) => left.uploadedAt.localeCompare(right.uploadedAt));
  return byNote;
}

/**
 * §1.3, §4.1: files chosen for the Notes composer, from its own `Attach files` or the Files section, checked as the queue
 * checks them against the room the composer's chips leave. A file already a chip is listed once (UI-D13); a passing file
 * waits as a chip, and a refused one stays with its reason and is never sent.
 */
export function composerChips(files: readonly File[], chips: readonly QueueRow[], remaining: number): QueueRow[] {
  const room = Math.max(0, remaining - chips.filter(holdsRoom).length);
  return precheckChosenFiles(files, { remaining: room, existingKeys: new Set(chips.map((chip) => chip.key)) })
    .map(chosenRow)
    .map((row): QueueRow => (row.stage === 'waiting' ? { ...row, stage: 'chosen' } : row));
}

/** A checked file as a queue row: waiting to be sent, or not added with its reason. */
export function chosenRow(chosen: ChosenFile): QueueRow {
  return chosen.refusal === null
    ? { key: chosen.key, file: chosen.file, stage: 'waiting' }
    : { key: chosen.key, file: chosen.file, stage: 'refused', message: chosen.refusal };
}

export type FileAiPolicy = RequestAttachmentAiPolicy;
export type FileAi = NonNullable<RequestAttachment['ai']>;

/**
 * §5, §9 (D-30, D-33; UI-D18 to UI-D20; X-18, X-22): the analyst's control on each file. The switch keeps X-18's label,
 * so notes and files speak one vocabulary, and the facts line says how much of the file's text is sent.
 */
export const fileAiCopy = {
  label: 'Changes the AI inputs',
  notIncluded: 'Not included',
  reading: 'Reading the file’s text…',
  previewText: 'Preview text',
  previewTextName: (name: string) => `Preview text of ${name}`,
  /** The phone card's line (§3.2). */
  cardLine: (facts: string) => `AI inputs: ${facts}`,
  failed: 'Inclusion not changed',
  undoFailed: 'Couldn’t undo',
  undo: 'Undo',
  tryAgain: 'Try again',
  refresh: 'Refresh page',
} as const;

/** §5.1: why a file can never be included, in place of the switch. */
const fileAiUnavailableLines: Readonly<Record<NonNullable<FileAi['unavailableReason']>, string>> = {
  ATTACHMENT_NOT_TEXT_BEARING: 'Images can’t be included, because the AI reads text only.',
  ATTACHMENT_QUARANTINED: 'It can be included once it passes the malware check.',
};

/** X-22, D-33: `Not included`, or how much is sent: `all {m}` or `first {n} of {m}`, never a bare `Included`. */
export function fileAiFactsLine(ai: Pick<FileAi, 'included' | 'facts'>): string {
  if (!ai.included) return fileAiCopy.notIncluded;
  if (!ai.facts) return 'Included';
  const { available, kept, truncated } = ai.facts;
  return truncated
    ? `Included · first ${count.format(kept)} of ${count.format(available)} characters`
    : `Included · all ${count.format(available)} characters`;
}

/** §9: the toast after including or excluding a file, or after its Undo. */
export function fileAiToast(name: string, { included, undoing }: { included: boolean; undoing: boolean }): string {
  if (undoing) return included ? `${name} included again.` : `${name} no longer included.`;
  return included ? `${name} included in the AI inputs.` : `${name} no longer included in the AI inputs.`;
}

/** The two policy refusals that stop inclusion, and only inclusion: an included file can always be excluded (D-30). */
const inclusionRefusals: ReadonlySet<FileAiPolicy['refusal']> = new Set(['AI_CLASSIFICATION_ABOVE_CEILING', 'AI_POLICY_NOT_CONFIGURED']);

/**
 * What the AI control shows for a file (§5.1), from what Strapi served; the web never infers an action:
 * - `none`: nothing (a Requestor's file carries no AI facts; a blocked or unavailable file shows no line);
 * - `unavailable`: why it can never be included (an image, or a file waiting for its malware check);
 * - `facts`: the facts line as read-only fact (released, closed or a returned draft; the requesting analyst, G-1; a
 *   file the policy refuses to include);
 * - `switch`: the X-18 switch with its facts line. `offOnly` is the orchestrator's ruling on D-30: under a refusing
 *   policy an included file keeps a switch that can only turn it off, because withdrawing text from the AI inputs is
 *   never blocked; once excluded the switch goes and the line reads `Not included`.
 * `preview` offers `Preview text` for an included file to anyone but the requesting analyst, whom Strapi refuses.
 */
export type FileAiControlMode =
  | { kind: 'none' }
  | { kind: 'unavailable'; line: string }
  | { kind: 'facts'; preview: boolean }
  | { kind: 'switch'; offOnly: boolean; preview: boolean };

export function fileAiControlMode(attachment: Pick<RequestAttachment, 'state' | 'ai'>, policy: FileAiPolicy | undefined): FileAiControlMode {
  const { ai } = attachment;
  if (!ai || !policy || attachment.state === 'blocked' || attachment.state === 'unavailable' || attachment.state === 'removed') return { kind: 'none' };
  if (ai.unavailableReason) return { kind: 'unavailable', line: fileAiUnavailableLines[ai.unavailableReason] };
  const ownRequest = policy.refusal === 'OWN_REQUEST';
  const preview = ai.included && !ownRequest;
  const offOnly = !policy.canChange && ai.included && inclusionRefusals.has(policy.refusal);
  if (ai.canChange && !ownRequest && (policy.canChange || offOnly)) return { kind: 'switch', offOnly, preview };
  return { kind: 'facts', preview };
}

export type FileAiSectionIcon = 'Lock' | 'ShieldBan';

/**
 * §5.1 (D-30; UI-D21; G-1): the one line under the Files section's description that says, for a Security Analyst, what
 * may be included or why nothing can be, once for the section instead of on every file. A Requestor's list carries no
 * policy, so she gets none; a released, closed or returned request says why files are closed in §3.6's line instead.
 */
export function fileAiSectionLine(policy: FileAiPolicy | undefined): { icon: FileAiSectionIcon | null; text: string } | null {
  if (!policy) return null;
  switch (policy.refusal) {
    case 'OWN_REQUEST':
      return { icon: 'Lock', text: 'You raised this request, so another Security Analyst decides which files the AI uses.' };
    case 'AI_CLASSIFICATION_ABOVE_CEILING':
    case 'AI_POLICY_NOT_CONFIGURED':
      return { icon: 'ShieldBan', text: attachmentAiRefusal({ reason: policy.refusal, classification: policy.classification, ceiling: policy.ceiling }).message };
    case null:
      return policy.canChange ? { icon: null, text: `Include only files whose content is within this request’s ${policy.classification} classification.` } : null;
    default:
      return null;
  }
}
