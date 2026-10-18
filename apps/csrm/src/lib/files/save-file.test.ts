import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { saveFile } from './save-file';

/* The Blob's bytes, read the way the test environment's Blob allows. */
function blobBytes(blob: Blob): Promise<number[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve([...new Uint8Array(reader.result as ArrayBuffer)]);
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(blob);
  });
}

/*
 * The shared save-bytes helper (Phase 14 D-24; 14-UI-SPEC §3.3; Phase 19 reuses it). The bytes the server checked are
 * handed to the browser as a Blob of their checked type, saved through an anchor with `download`, never opened inline,
 * and the Blob's URL is let go a minute later, once per call (IN-405).
 */
describe('saveFile (D-24)', () => {
  let created: Blob[];
  let revoked: string[];
  let clicked: HTMLAnchorElement[];

  beforeEach(() => {
    created = [];
    revoked = [];
    clicked = [];
    vi.spyOn(URL, 'createObjectURL').mockImplementation((blob: Blob | MediaSource) => {
      created.push(blob as Blob);
      return `blob:csrm/file-${created.length}`;
    });
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation((url: string) => {
      revoked.push(url);
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      clicked.push(this);
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('saves the bytes as a Blob of their checked type, under their name, through a download anchor', async () => {
    const bytes = new TextEncoder().encode('%PDF-1.4 security pack');
    saveFile({ fileName: 'vendor-security-pack.pdf', contentType: 'application/pdf', bytes });

    expect(created).toHaveLength(1);
    expect(created[0]!.type).toBe('application/pdf');
    expect(await blobBytes(created[0]!)).toEqual([...bytes]);

    expect(clicked).toHaveLength(1);
    const anchor = clicked[0]!;
    expect(anchor.href).toBe('blob:csrm/file-1');
    expect(anchor.download).toBe('vendor-security-pack.pdf');
    expect(anchor.rel).toBe('noopener');
  });

  /*
   * IN-405: WebKit fails a blob download whose URL is revoked before it has read the blob, which a 25 MB file on a phone
   * can take a while to do. The URL is kept for 60 seconds, then let go, once for each file saved, so nothing leaks.
   */
  it('lets each Blob’s URL go 60 seconds after its file is saved, once per call', () => {
    vi.useFakeTimers();
    const docx = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    saveFile({ fileName: 'data-flow.docx', contentType: docx, bytes: new Uint8Array([0x50, 0x4b, 3, 4]) });
    vi.advanceTimersByTime(10_000);
    saveFile({ fileName: 'vendor-security-pack.pdf', contentType: 'application/pdf', bytes: new TextEncoder().encode('%PDF-1.4') });

    vi.advanceTimersByTime(49_999);
    expect(revoked).toEqual([]);
    vi.advanceTimersByTime(1);
    expect(revoked).toEqual(['blob:csrm/file-1']);
    vi.advanceTimersByTime(10_000);
    expect(revoked).toEqual(['blob:csrm/file-1', 'blob:csrm/file-2']);
    vi.runAllTimers();
    expect(revoked).toEqual(['blob:csrm/file-1', 'blob:csrm/file-2']);
  });
});
