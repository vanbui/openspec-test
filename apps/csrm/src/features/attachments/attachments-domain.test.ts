import { describe, expect, it } from 'vitest';

import {
  ALLOWED_TYPES_SENTENCE,
  ATTACHMENT_ACCEPT,
  MAX_FILE_BYTES,
  fileFieldHint,
  fileTypeIconName,
  fileTypeLabel,
  filesCountLabel,
  filesDescription,
  filesEmptyState,
  filesLockedLine,
  fileKey,
  precheckChosenFiles,
  queueCountLine,
  queueReducer,
  type QueueRow,
} from './attachments-domain';

/* 14-UI-SPEC §1.1 (X-19), §3.1, §3.6, §3.7, X-21 and X-23: the words and facts the Files section and its field show. */
describe('the file field’s facts (§1.1, X-19)', () => {
  it('accepts the eight allowed types by extension, up to 25 MB each', () => {
    expect(ATTACHMENT_ACCEPT).toBe('.pdf,.docx,.xlsx,.pptx,.csv,.txt,.png,.jpg,.jpeg');
    expect(ALLOWED_TYPES_SENTENCE).toBe('PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG');
    expect(MAX_FILE_BYTES).toBe(26_214_400);
  });

  it('names the allowed types, the size limit and how many more files the request can take', () => {
    expect(fileFieldHint(19)).toBe('PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG · up to 25 MB each · 19 more can be added to this request');
    expect(fileFieldHint(1)).toBe('PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG · up to 25 MB each · 1 more can be added to this request');
  });
});

describe('the Files section’s words (§3.1, §3.7)', () => {
  it('counts files with one-many forms', () => {
    expect(filesCountLabel(1)).toBe('1 file');
    expect(filesCountLabel(2)).toBe('2 files');
  });

  it('describes the section to the Requestor and to an analyst (D-28)', () => {
    expect(filesDescription('requestor')).toBe('Files for this request, from you and the Security Analysts. Each file is checked for malware before anyone can download it. A Security Analyst may include a file’s text in the information CSRM sends to the AI, within your organisation’s data policy.');
    expect(filesDescription('analyst')).toBe('Files from the Requestor and the Security Analysts. Each file is checked for malware before anyone can download it. Include a file’s text to use it in AI generation.');
  });

  it('says what to do next when a draft has no file', () => {
    /* IN-406: the empty state's kind, which the shared EmptyState words (`No files yet`), never a heading of its own. */
    expect(filesEmptyState('intake', 'requestor', true)).toEqual({
      kind: 'first-use',
      description: 'Add documents that help a Security Analyst understand this request, such as a vendor’s security pack or a data-flow diagram.',
    });
    expect(filesEmptyState('after-submission', 'requestor', true)).toEqual({
      kind: 'first-use',
      description: 'Add files with a note when a Security Analyst asks for them, or when you have more to share.',
    });
    expect(filesEmptyState('after-submission', 'analyst', true)).toEqual({
      kind: 'first-use',
      description: 'Add files with a note to share documents with the Requestor.',
    });
    expect(filesEmptyState('closed', 'requestor', false)).toEqual({ kind: 'cleared', description: null });
  });

  it('says why files cannot be added where the field gives way to a line (§1.2, §3.6)', () => {
    expect(filesLockedLine('ATTACHMENT_LIMIT_REACHED', 'requestor')).toEqual({ icon: 'Paperclip', text: 'This request has 20 files, the most it can hold. Remove a file to add another.' });
    expect(filesLockedLine('ATTACHMENT_LIFETIME_LIMIT_REACHED', 'requestor')).toEqual({ icon: 'Paperclip', text: 'This request has reached the most files it can keep, counting removed ones, so no more can be added.' });
    expect(filesLockedLine('ATTACHMENTS_NOT_CONFIGURED', 'requestor')).toEqual({ icon: 'CloudOff', text: 'Files can’t be added right now because file storage isn’t set up. Contact your administrator.' });
    expect(filesLockedLine('ATTACHMENTS_CLOSED', 'requestor')).toEqual({ icon: 'Lock', text: 'Files closed when the assessment was released. They stay here as part of the record.' });
    expect(filesLockedLine('REQUEST_NOT_SUBMITTED', 'analyst')).toEqual({ icon: 'Lock', text: 'Files are paused while this request is a draft. They can be added again once the Requestor resubmits it.' });
    expect(filesLockedLine(null, 'requestor')).toBeNull();
  });
});

describe('a file’s type (X-21, X-23)', () => {
  it('labels a type by its extension in capitals', () => {
    expect(fileTypeLabel('pdf')).toBe('PDF');
    expect(fileTypeLabel('jpeg')).toBe('JPEG');
  });

  it('picks the type icon X-21 names', () => {
    expect(fileTypeIconName('pdf')).toBe('FileText');
    expect(fileTypeIconName('docx')).toBe('FileText');
    expect(fileTypeIconName('txt')).toBe('FileText');
    expect(fileTypeIconName('xlsx')).toBe('FileSpreadsheet');
    expect(fileTypeIconName('csv')).toBe('FileSpreadsheet');
    expect(fileTypeIconName('pptx')).toBe('Presentation');
    expect(fileTypeIconName('png')).toBe('FileImage');
    expect(fileTypeIconName('jpeg')).toBe('FileImage');
  });
});

/** A file of `size` bytes without allocating them: the checks read the name, the size and the last-modified time. */
function sized(name: string, size: number, lastModified = 1): File {
  const file = new File(['x'], name, { lastModified });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/* §1.3 (D-11; UI-D13): fast feedback before anything is sent. Strapi stays authoritative and refuses in the same words. */
describe('precheckChosenFiles (§1.3)', () => {
  const room = { remaining: 20, existingKeys: new Set<string>() };

  it('refuses a type that is not allowed with family N’s type sentence', () => {
    const [checked] = precheckChosenFiles([sized('tool.exe', 100)], room);
    expect(checked!.refusal).toBe('This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.');
  });

  it('allows the eight types whatever the case of the extension, .jpg among them', () => {
    const checked = precheckChosenFiles(['a.PDF', 'b.docx', 'c.xlsx', 'd.pptx', 'e.csv', 'f.txt', 'g.png', 'h.jpg', 'i.JPEG'].map((name) => sized(name, 10)), room);
    expect(checked.map((entry) => entry.refusal)).toEqual(Array(9).fill(null));
  });

  it('refuses an empty file', () => {
    const [checked] = precheckChosenFiles([sized('empty.pdf', 0)], room);
    expect(checked!.refusal).toBe('This file is empty. Check it’s the file you meant and choose it again.');
  });

  it('refuses a file over 25 MB, naming its size', () => {
    const [big, justOver, atLimit] = precheckChosenFiles([sized('big.pdf', 31_457_280), sized('over.pdf', 26_214_401), sized('limit.pdf', 26_214_400)], room);
    expect(big!.refusal).toBe('Files can be up to 25 MB, and this one is 30.0 MB. Make it smaller or split it, then add it again.');
    /* WR-604, IN-404: one byte over the limit reads 25.1 MB, never the limit itself. */
    expect(justOver!.refusal).toBe('Files can be up to 25 MB, and this one is 25.1 MB. Make it smaller or split it, then add it again.');
    expect(atLimit!.refusal).toBeNull();
  });

  it('refuses each file beyond the room the request has left, in the order chosen', () => {
    const checked = precheckChosenFiles([sized('a.pdf', 10), sized('tool.exe', 10), sized('b.pdf', 10), sized('c.pdf', 10)], { remaining: 2, existingKeys: new Set() });
    expect(checked.map((entry) => entry.refusal === null ? 'ok' : entry.refusal)).toEqual([
      'ok',
      'This type of file can’t be added. Add a PDF, Word (.docx), Excel (.xlsx), PowerPoint (.pptx), CSV, text (.txt), PNG or JPEG file.',
      'ok',
      'This request already has 20 files. Remove a file to add another.',
    ]);
  });

  it('lists the same file chosen twice once, and a file already in the queue not again (UI-D13)', () => {
    const file = sized('pack.pdf', 10, 7);
    expect(precheckChosenFiles([file, sized('pack.pdf', 10, 7)], room)).toHaveLength(1);
    expect(precheckChosenFiles([file], { remaining: 20, existingKeys: new Set([fileKey(file)]) })).toHaveLength(0);
    expect(precheckChosenFiles([file, sized('pack.pdf', 10, 8)], room)).toHaveLength(2);
  });
});

describe('the queue’s count line (§1.4)', () => {
  it('counts the files added and those not added', () => {
    const row = (stage: QueueRow['stage']): QueueRow => ({ key: stage, file: sized(`${stage}.pdf`, 10), stage });
    expect(queueCountLine([row('added'), row('pending'), row('refused')])).toBe('2 of 3 files added · 1 not added');
    expect(queueCountLine([row('added')])).toBe('1 of 1 files added');
  });

  it('restores the rows not added after an in-app navigation, and counts them afresh (§1.5)', () => {
    const row = (stage: QueueRow['stage'], key = stage): QueueRow => ({ key, file: sized(`${key}.pdf`, 10), stage });
    const restored = queueReducer([row('added'), row('refused'), row('failed'), row('waiting')], { type: 'restore' });
    expect(restored.map((entry) => [entry.key, entry.stage, entry.restored])).toEqual([
      ['refused', 'refused', true],
      ['failed', 'failed', true],
      ['waiting', 'failed', true],
    ]);
    expect(restored[2]!.message).toBe('We couldn’t add this file. Try again.');
    expect(queueCountLine(restored)).toBe('0 of 3 files added · 3 not added');
  });
});
