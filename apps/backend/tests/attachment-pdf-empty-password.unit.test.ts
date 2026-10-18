import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";

import { checkAttachmentContent } from "../src/csrm/files/content-check";
import { extractAttachmentText, probePdf } from "../src/csrm/files/extraction";

/*
 * Validation audit 2026-10-11 (D-09; COLLAB-02 (1)): a PDF encrypted with an empty user password (an owner password
 * only, the "permissions" PDF many tools write) opens without a password, so it is accepted and its text extracted.
 * A PDF that needs a user password stays ATTACHMENT_ENCRYPTED. Both files are built here with the Standard security
 * handler, revision 2 (RC4, 40-bit key), and correctly encrypted content streams (PDF 1.7, 7.6.3, algorithms 1 to 4).
 */

const PAD = Buffer.from("28bf4e5e4e758a4164004e56fffa01082e2e00b6d0683e802f0ca9fe6453697a", "hex");

function rc4(key: Buffer, data: Buffer): Buffer {
  const s = Array.from({ length: 256 }, (_, index) => index);
  let j = 0;
  for (let i = 0; i < 256; i += 1) {
    j = (j + s[i]! + key[i % key.length]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
  }
  const out = Buffer.alloc(data.length);
  let i = 0;
  j = 0;
  for (let k = 0; k < data.length; k += 1) {
    i = (i + 1) & 0xff;
    j = (j + s[i]!) & 0xff;
    [s[i], s[j]] = [s[j]!, s[i]!];
    out[k] = data[k]! ^ s[(s[i]! + s[j]!) & 0xff]!;
  }
  return out;
}

const md5 = (...parts: Buffer[]) => createHash("md5").update(Buffer.concat(parts)).digest();
const padded = (password: string) => Buffer.concat([Buffer.from(password, "latin1"), PAD]).subarray(0, 32);

function encryptedPdf(userPassword: string, pageText: string): Buffer {
  const permissions = -44;
  const id = Buffer.from("0123456789abcdef0123456789abcdef", "hex");
  const owner = rc4(md5(padded("owner-secret")).subarray(0, 5), padded(userPassword));
  const p = Buffer.alloc(4);
  p.writeInt32LE(permissions);
  const fileKey = md5(padded(userPassword), owner, p, id).subarray(0, 5);
  const user = rc4(fileKey, PAD);
  const objectKey = (number: number) => md5(fileKey, Buffer.from([number & 0xff, (number >> 8) & 0xff, (number >> 16) & 0xff, 0, 0])).subarray(0, 10);

  const content = Buffer.from(`BT\n/F1 12 Tf\n36 770 Td\n(${pageText}) Tj\nET`, "latin1");
  const encryptedContent = rc4(objectKey(5), content);
  const objects: Buffer[] = [
    Buffer.from("<< /Type /Catalog /Pages 2 0 R >>", "latin1"),
    Buffer.from("<< /Type /Pages /Kids [4 0 R] /Count 1 >>", "latin1"),
    Buffer.from("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>", "latin1"),
    Buffer.from("<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents 5 0 R >>", "latin1"),
    Buffer.concat([Buffer.from(`<< /Length ${encryptedContent.length} >>\nstream\n`, "latin1"), encryptedContent, Buffer.from("\nendstream", "latin1")]),
    Buffer.from(`<< /Filter /Standard /V 1 /R 2 /O <${owner.toString("hex")}> /U <${user.toString("hex")}> /P ${permissions} >>`, "latin1"),
  ];
  const chunks: Buffer[] = [Buffer.from("%PDF-1.4\n%\xe2\xe3\xcf\xd3\n", "latin1")];
  let length = chunks[0]!.length;
  const offsets: number[] = [];
  objects.forEach((object, index) => {
    offsets.push(length);
    const chunk = Buffer.concat([Buffer.from(`${index + 1} 0 obj\n`, "latin1"), object, Buffer.from("\nendobj\n", "latin1")]);
    chunks.push(chunk);
    length += chunk.length;
  });
  let tail = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const offset of offsets) tail += `${String(offset).padStart(10, "0")} 00000 n \n`;
  tail += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R /Encrypt 6 0 R /ID [<${id.toString("hex")}> <${id.toString("hex")}>] >>\nstartxref\n${length}\n%%EOF\n`;
  chunks.push(Buffer.from(tail, "latin1"));
  return Buffer.concat(chunks);
}

test("accepted: a PDF encrypted with an empty user password opens, passes the content check and gives its text (D-09)", async () => {
  const bytes = encryptedPdf("", "Owner restricted vendor pack.");
  assert.ok(bytes.includes(Buffer.from("/Encrypt 6 0 R", "latin1")), "THE_FIXTURE_IS_NOT_ENCRYPTED");
  assert.ok(!bytes.includes(Buffer.from("Owner restricted", "latin1")), "THE_CONTENT_STREAM_WAS_NOT_ENCRYPTED");

  assert.equal(await probePdf(bytes), "ok", "THE_EMPTY_PASSWORD_PDF_DID_NOT_OPEN");
  assert.deepEqual(await checkAttachmentContent({ fileName: "vendor-pack.pdf", bytes }, { probePdf }), { ok: true, type: "pdf" }, "THE_EMPTY_PASSWORD_PDF_WAS_REFUSED");
  const text = await extractAttachmentText({ type: "pdf", bytes });
  assert.ok(text.ok, `NO_TEXT_FROM_THE_EMPTY_PASSWORD_PDF_${JSON.stringify(text)}`);
  assert.match(text.text, /Owner restricted vendor pack\./, "THE_DECRYPTED_TEXT_IS_WRONG");
});

test("ATTACHMENT_ENCRYPTED: the same PDF built with a user password needs it to open, and is refused (D-09)", async () => {
  const bytes = encryptedPdf("user-secret", "Owner restricted vendor pack.");
  assert.equal(await probePdf(bytes), "password", "THE_USER_PASSWORD_PDF_OPENED");
  assert.deepEqual(await checkAttachmentContent({ fileName: "vendor-pack.pdf", bytes }, { probePdf }), { ok: false, reason: "ATTACHMENT_ENCRYPTED" });
});
