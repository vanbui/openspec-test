import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  ATTACHMENT_RESPONSE_CONTENT_TYPES,
  EXPORT_RESPONSE_CONTENT_TYPES,
  EXPORT_RESPONSE_MAX_BYTES,
  attachmentFileRule,
  exportFileRule,
  parseContentDispositionFileName,
  validateAttachmentFileResponse,
  validateFileResponse,
} from './file-response';

/*
 * The shared file-response validator (Phase 14 D-24; Phase 19 reuses it for exports). Strapi has already decided who
 * may download and checked the digest; this is the web's own check that what arrived is what the attachment says it
 * is before a single byte is handed to the browser: its type, a safe name with the type's extension, the size bound and
 * the content signature.
 */

const DOCX = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

function bytesOf(...parts: Array<string | number[]>): Uint8Array {
  const chunks = parts.map((part) => (typeof part === 'string' ? new TextEncoder().encode(part) : Uint8Array.from(part)));
  const out = new Uint8Array(chunks.reduce((total, chunk) => total + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.length;
  }
  return out;
}

const ZIP_BYTES = bytesOf([0x50, 0x4b, 0x03, 0x04], 'word/document.xml and the rest of the package');
const PDF_BYTES = bytesOf('%PDF-1.7\n1 0 obj << >> endobj\n');
const PNG_BYTES = bytesOf([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 'IHDR');
const JPEG_BYTES = bytesOf([0xff, 0xd8, 0xff, 0xe0], 'JFIF');
const TEXT_BYTES = bytesOf('Vendor access plan: offshore support connects through the PAM vault.\n');
/* A Windows PE header: MZ, then e_lfanew at 0x3C pointing at PE\0\0 (IN-206). */
const PE_HEADER_BYTES = (() => {
  const bytes = new Uint8Array(0x48);
  bytes.set([0x4d, 0x5a]);
  new DataView(bytes.buffer).setUint32(0x3c, 0x40, true);
  bytes.set([0x50, 0x45, 0x00, 0x00], 0x40);
  return bytes;
})();

function disposition(name: string): string {
  return `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`;
}

describe('validateFileResponse with the attachment rule', () => {
  it('accepts the data-flow DOCX with its media type, its name and its ZIP signature', () => {
    const result = validateFileResponse(
      { contentType: DOCX, contentDisposition: disposition('data-flow.docx'), bytes: ZIP_BYTES },
      attachmentFileRule('docx'),
    );
    expect(result).toEqual({ ok: true, fileName: 'data-flow.docx', contentType: DOCX, bytes: ZIP_BYTES });
  });

  it('refuses a content type other than the attachment’s recorded type', () => {
    for (const contentType of ['text/html', 'application/pdf', null]) {
      expect(validateFileResponse({ contentType, contentDisposition: disposition('data-flow.docx'), bytes: ZIP_BYTES }, attachmentFileRule('docx')))
        .toEqual({ ok: false, failure: 'type' });
    }
  });

  it('accepts a media type with parameters by its essence, case-insensitively', () => {
    const result = validateFileResponse(
      { contentType: 'Text/Plain; charset=utf-8', contentDisposition: disposition('plan.txt'), bytes: TEXT_BYTES },
      attachmentFileRule('txt'),
    );
    expect(result).toMatchObject({ ok: true, fileName: 'plan.txt', contentType: 'text/plain' });
  });

  it('refuses a name with a path, a bidirectional override, a control character, the wrong extension or none at all', () => {
    for (const name of ['../x.docx', 'a\u202excod.exe', 'folder\\x.docx', 'line\nbreak.docx', 'data-flow.pdf', 'data-flow', '', `${'n'.repeat(251)}.docx`]) {
      expect(
        validateFileResponse({ contentType: DOCX, contentDisposition: disposition(name), bytes: ZIP_BYTES }, attachmentFileRule('docx')),
        name,
      ).toEqual({ ok: false, failure: 'name' });
    }
    expect(validateFileResponse({ contentType: DOCX, contentDisposition: null, bytes: ZIP_BYTES }, attachmentFileRule('docx'))).toEqual({ ok: false, failure: 'name' });
  });

  it('refuses more than 26,214,400 bytes and an empty file', () => {
    const oversize = new Uint8Array(26_214_401);
    oversize.set(ZIP_BYTES);
    expect(validateFileResponse({ contentType: DOCX, contentDisposition: disposition('data-flow.docx'), bytes: oversize }, attachmentFileRule('docx')))
      .toEqual({ ok: false, failure: 'size' });
    expect(validateFileResponse({ contentType: DOCX, contentDisposition: disposition('data-flow.docx'), bytes: new Uint8Array(0) }, attachmentFileRule('docx')))
      .toEqual({ ok: false, failure: 'size' });
  });

  it('refuses bytes whose signature is not the type’s: PDF bytes under a DOCX name', () => {
    expect(validateFileResponse({ contentType: DOCX, contentDisposition: disposition('data-flow.docx'), bytes: PDF_BYTES }, attachmentFileRule('docx')))
      .toEqual({ ok: false, failure: 'signature' });
  });

  it('checks each type’s signature: %PDF, PNG, JPEG (as .jpg or .jpeg), PK for Office, and text for CSV and TXT', () => {
    const accepted: Array<[Parameters<typeof attachmentFileRule>[0], string, string, Uint8Array]> = [
      ['pdf', 'application/pdf', 'vendor-pack.pdf', PDF_BYTES],
      ['png', 'image/png', 'diagram.png', PNG_BYTES],
      ['jpeg', 'image/jpeg', 'photo.jpg', JPEG_BYTES],
      ['jpeg', 'image/jpeg', 'photo.JPEG', JPEG_BYTES],
      ['xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'register.xlsx', ZIP_BYTES],
      ['pptx', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'briefing.pptx', ZIP_BYTES],
      ['csv', 'text/csv', 'systems.csv', bytesOf('name,owner\nPAM vault,Security\n')],
      ['txt', 'text/plain', 'utf8-bom.txt', bytesOf([0xef, 0xbb, 0xbf], 'Résumé')],
    ];
    for (const [type, contentType, name, bytes] of accepted) {
      expect(validateFileResponse({ contentType, contentDisposition: disposition(name), bytes }, attachmentFileRule(type)), name).toMatchObject({ ok: true, fileName: name });
    }
    const refused: Array<[Parameters<typeof attachmentFileRule>[0], string, string, Uint8Array]> = [
      ['png', 'image/png', 'diagram.png', JPEG_BYTES],
      ['txt', 'text/plain', 'binary.txt', bytesOf('text', [0x00], 'more')],
      ['txt', 'text/plain', 'program.txt', PE_HEADER_BYTES],
      ['csv', 'text/csv', 'latin1.csv', bytesOf([0x63, 0xe9, 0x0a])],
    ];
    for (const [type, contentType, name, bytes] of refused) {
      expect(validateFileResponse({ contentType, contentDisposition: disposition(name), bytes }, attachmentFileRule(type)), name).toEqual({ ok: false, failure: 'signature' });
    }
  });

  it('names exactly the eight attachment media types', () => {
    expect([...ATTACHMENT_RESPONSE_CONTENT_TYPES]).toEqual([
      'application/pdf',
      DOCX,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/csv',
      'text/plain',
      'image/png',
      'image/jpeg',
    ]);
    expect(attachmentFileRule('docx').contentTypes).toEqual([DOCX]);
    expect(attachmentFileRule('docx').maxBytes).toBe(26_214_400);
  });
});

/*
 * IN-206's follow-on: Strapi's text rule now refuses a Windows executable by its PE header, not by a leading `MZ`, so
 * text that starts with `MZ` is stored. The web's mirror of the rule must agree, or such a file could never be downloaded.
 */
describe('the text signature follows Strapi’s rule (IN-206)', () => {
  it('accepts a TXT and a CSV that start with MZ, and refuses a PE header as text', () => {
    expect(validateFileResponse({ contentType: 'text/plain', contentDisposition: disposition('holdings.txt'), bytes: bytesOf('MZ Holdings report for the vendor review.\n') }, attachmentFileRule('txt')))
      .toMatchObject({ ok: true, fileName: 'holdings.txt' });
    expect(validateFileResponse({ contentType: 'text/csv', contentDisposition: disposition('countries.csv'), bytes: bytesOf('MZ,Mozambique\nAU,Australia\n') }, attachmentFileRule('csv')))
      .toMatchObject({ ok: true, fileName: 'countries.csv' });
    expect(validateFileResponse({ contentType: 'text/plain', contentDisposition: disposition('notes.txt'), bytes: PE_HEADER_BYTES }, attachmentFileRule('txt')))
      .toEqual({ ok: false, failure: 'signature' });
  });
});

/*
 * IN-402 (per the pilot's ruling): the download is checked against what Strapi serves for the record, never the client's
 * claim. The expected type comes from the served name's extension (Strapi's Content-Disposition, from the record), and
 * the served Content-Type and the bytes' signature must both be that type's. A served name of no allowed type is refused.
 */
describe('validateAttachmentFileResponse (IN-402)', () => {
  it('accepts a file whose served name, served type and signature agree, the type taken from the name', () => {
    expect(validateAttachmentFileResponse({ contentType: DOCX, contentDisposition: disposition('data-flow.docx'), bytes: ZIP_BYTES }))
      .toEqual({ ok: true, fileName: 'data-flow.docx', contentType: DOCX, bytes: ZIP_BYTES });
    expect(validateAttachmentFileResponse({ contentType: 'image/jpeg', contentDisposition: disposition('site-photo.JPG'), bytes: JPEG_BYTES }))
      .toMatchObject({ ok: true, fileName: 'site-photo.JPG', contentType: 'image/jpeg' });
  });

  it('refuses a served type that is not the served name’s type', () => {
    expect(validateAttachmentFileResponse({ contentType: 'image/png', contentDisposition: disposition('vendor-pack.pdf'), bytes: PNG_BYTES }))
      .toEqual({ ok: false, failure: 'type' });
    expect(validateAttachmentFileResponse({ contentType: 'application/pdf', contentDisposition: disposition('data-flow.docx'), bytes: PDF_BYTES }))
      .toEqual({ ok: false, failure: 'type' });
  });

  it('refuses a served name whose extension is not an allowed type, and a response with no name', () => {
    for (const name of ['macro.docm', 'tool.exe', 'archive.zip', 'page.html', 'no-extension']) {
      expect(validateAttachmentFileResponse({ contentType: DOCX, contentDisposition: disposition(name), bytes: ZIP_BYTES }), name).toEqual({ ok: false, failure: 'name' });
    }
    expect(validateAttachmentFileResponse({ contentType: 'application/pdf', contentDisposition: null, bytes: PDF_BYTES })).toEqual({ ok: false, failure: 'name' });
  });

  it('refuses bytes whose signature is not the served name’s type', () => {
    expect(validateAttachmentFileResponse({ contentType: 'application/pdf', contentDisposition: disposition('vendor-pack.pdf'), bytes: PNG_BYTES }))
      .toEqual({ ok: false, failure: 'signature' });
  });
});

/*
 * IN-403: the unsafe-name rule refuses what the server's name rule removes (\p{Cc}, \p{Cf}, \p{Zl}, \p{Zp}) and the path
 * separators, and is written with escapes, so no invisible character in the source can be lost by an editor.
 */
describe('the attachment name rule’s unsafe characters (IN-403)', () => {
  const characters: Array<[string, string]> = [
    ['a C0 control (U+0007)', '\u0007'],
    ['DEL (U+007F)', '\u007f'],
    ['a C1 control (U+0085)', '\u0085'],
    ['the soft hyphen (U+00AD)', '\u00ad'],
    ['the Arabic letter mark (U+061C)', '\u061c'],
    ['the zero-width space (U+200B)', '\u200b'],
    ['the right-to-left mark (U+200F)', '\u200f'],
    ['the line separator (U+2028)', '\u2028'],
    ['the paragraph separator (U+2029)', '\u2029'],
    ['the right-to-left override (U+202E)', '\u202e'],
    ['the word joiner (U+2060)', '\u2060'],
    ['the first strong isolate (U+2068)', '\u2068'],
    ['the byte order mark (U+FEFF)', '\ufeff'],
    ['a tag character (U+E0041)', '\u{e0041}'],
    ['a slash', '/'],
    ['a backslash', '\\'],
  ];

  it.each(characters)('refuses a name holding %s', (_label, character) => {
    expect(attachmentFileRule('pdf').isSafeName(`vendor${character}pack.pdf`)).toBe(false);
  });

  it('keeps a name of visible characters, accents and spaces', () => {
    expect(attachmentFileRule('pdf').isSafeName('Résumé – vendor “pack” (final).pdf')).toBe(true);
  });

  it('holds no literal invisible character in the validator’s source', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/files/file-response.ts'), 'utf8');
    const invisible = [...source].filter((character) => /[\p{Cf}\p{Zl}\p{Zp}\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/u.test(character));
    expect(invisible.map((character) => `U+${character.codePointAt(0)!.toString(16).toUpperCase().padStart(4, '0')}`)).toEqual([]);
  });
});

describe('parseContentDispositionFileName', () => {
  it('prefers the RFC 5987 filename* over the ASCII filename', () => {
    expect(parseContentDispositionFileName("attachment; filename=\"r_sum_.pdf\"; filename*=UTF-8''r%C3%A9sum%C3%A9.pdf")).toBe('résumé.pdf');
  });

  it('falls back to the quoted filename, and gives null when there is no name or the encoding is broken', () => {
    expect(parseContentDispositionFileName('attachment; filename="data-flow.docx"')).toBe('data-flow.docx');
    expect(parseContentDispositionFileName("attachment; filename=\"fallback.pdf\"; filename*=UTF-8''%E0%A4%A.pdf")).toBe('fallback.pdf');
    expect(parseContentDispositionFileName('attachment')).toBeNull();
    expect(parseContentDispositionFileName(null)).toBeNull();
  });

  it('decodes the name Strapi sends for a non-ASCII name with quotes and parentheses', () => {
    const name = 'Résumé – vendor "pack" (final)*.pdf';
    const encoded = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
    expect(parseContentDispositionFileName(`attachment; filename="R_sum_ _ vendor _pack_ (final)*.pdf"; filename*=UTF-8''${encoded}`)).toBe(name);
  });
});

/*
 * Phase 19 D-19: an export is checked by its own rule before a byte reaches the browser: exactly the format's media
 * type (compared by its essence), the server's lower-case name with the format's extension, at most 64 MiB, and the
 * format's signature (the UTF-8 byte order mark for CSV, PK for XLSX).
 */
describe('validateFileResponse with the export rule (Phase 19 D-19)', () => {
  const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
  const CSV_BYTES = bytesOf([0xef, 0xbb, 0xbf], 'Risk number,Statement\r\nRSK-0001,"\'=HYPERLINK(""https://example.test"",""Click"")"\r\n');

  it('names exactly the two media types every export serves, and a 64 MiB bound', () => {
    expect(EXPORT_RESPONSE_CONTENT_TYPES).toEqual({ csv: 'text/csv; charset=utf-8', xlsx: XLSX });
    expect(EXPORT_RESPONSE_MAX_BYTES).toBe(67_108_864);
    expect(exportFileRule('xlsx').maxBytes).toBe(67_108_864);
  });

  it('accepts PK bytes named risk-register-2026-10-01.xlsx served as the workbook type', () => {
    expect(validateFileResponse({ contentType: XLSX, contentDisposition: disposition('risk-register-2026-10-01.xlsx'), bytes: ZIP_BYTES }, exportFileRule('xlsx')))
      .toEqual({ ok: true, fileName: 'risk-register-2026-10-01.xlsx', contentType: XLSX, bytes: ZIP_BYTES });
  });

  it('refuses another type, an unsafe or upper-case name, the other format’s extension, 64 MiB plus one byte and CSV bytes', () => {
    const rule = exportFileRule('xlsx');
    expect(validateFileResponse({ contentType: 'text/html', contentDisposition: disposition('risk-register-2026-10-01.xlsx'), bytes: ZIP_BYTES }, rule)).toEqual({ ok: false, failure: 'type' });
    expect(validateFileResponse({ contentType: 'text/csv; charset=utf-8', contentDisposition: disposition('risk-register-2026-10-01.xlsx'), bytes: ZIP_BYTES }, rule)).toEqual({ ok: false, failure: 'type' });
    for (const name of ['../x.xlsx', 'Risk Register.xlsx', 'risk-register-2026-10-01.csv', 'risk-register', '-risk.xlsx', `${'r'.repeat(152)}.xlsx`]) {
      expect(validateFileResponse({ contentType: XLSX, contentDisposition: disposition(name), bytes: ZIP_BYTES }, rule), name).toEqual({ ok: false, failure: 'name' });
    }
    const oversize = new Uint8Array(EXPORT_RESPONSE_MAX_BYTES + 1);
    oversize.set(ZIP_BYTES);
    expect(validateFileResponse({ contentType: XLSX, contentDisposition: disposition('risk-register-2026-10-01.xlsx'), bytes: oversize }, rule)).toEqual({ ok: false, failure: 'size' });
    expect(validateFileResponse({ contentType: XLSX, contentDisposition: disposition('risk-register-2026-10-01.xlsx'), bytes: CSV_BYTES }, rule)).toEqual({ ok: false, failure: 'signature' });
  });

  it('accepts BOM-led CSV served as text/csv; charset=utf-8 or as its essence, and refuses CSV without the BOM', () => {
    const rule = exportFileRule('csv');
    for (const contentType of ['text/csv; charset=utf-8', 'text/csv']) {
      expect(validateFileResponse({ contentType, contentDisposition: disposition('risk-register-2026-10-01.csv'), bytes: CSV_BYTES }, rule), contentType)
        .toEqual({ ok: true, fileName: 'risk-register-2026-10-01.csv', contentType: 'text/csv', bytes: CSV_BYTES });
    }
    expect(validateFileResponse({ contentType: 'text/csv; charset=utf-8', contentDisposition: disposition('risk-register-2026-10-01.csv'), bytes: bytesOf('Risk number\r\n') }, rule))
      .toEqual({ ok: false, failure: 'signature' });
    expect(validateFileResponse({ contentType: 'text/csv; charset=utf-8', contentDisposition: disposition('risk-register-2026-10-01.csv'), bytes: ZIP_BYTES }, rule))
      .toEqual({ ok: false, failure: 'signature' });
    expect(validateFileResponse({ contentType: XLSX, contentDisposition: disposition('risk-register-2026-10-01.csv'), bytes: CSV_BYTES }, rule)).toEqual({ ok: false, failure: 'type' });
  });

  it('leaves the attachment rule as it was', () => {
    expect(attachmentFileRule('csv').signatures).toEqual(['text']);
    expect(attachmentFileRule('xlsx').maxBytes).toBe(26_214_400);
  });
});
