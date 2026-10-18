import { createHash, timingSafeEqual } from "node:crypto";

import { AttachmentStorageError, createAttachmentStorage, type AttachmentStorageStrapi } from "./storage-port";

/*
 * The verified read and the hardened download response (14-07; D-23, D-37; Phase 20's evidence files reuse it).
 *
 * - readVerifiedStoredFile: reads the stored bytes through the storage port and compares their SHA-256 with the one
 *   recorded at upload before anything is sent, so bytes altered or replaced in storage never leave Strapi.
 * - contentDispositionFor: `attachment` with an ASCII `filename` and an RFC 5987 `filename*`.
 * - sendStoredFile: the four hardening headers, the recorded type's media type and the verified bytes as the body.
 */

/** The verified bytes, or why they cannot be sent: the stored file is gone, or it no longer matches its digest. */
export type VerifiedStoredFile = { readonly bytes: Buffer } | { readonly failure: "missing" | "integrity" };

const SHA256_HEX = /^[0-9a-f]{64}$/;

/**
 * Reads a stored file and checks it against its recorded digest. A missing plugin file record or stored object is
 * `missing`; a digest that differs, a recorded digest that is not one, or a file record whose storage key was altered
 * is `integrity`. Any other storage failure is thrown: it is an operational fault, never a reason to send unverified
 * bytes.
 */
export async function readVerifiedStoredFile(
  strapi: AttachmentStorageStrapi,
  file: { readonly fileId: number | null; readonly sha256: unknown },
): Promise<VerifiedStoredFile> {
  if (file.fileId === null) return { failure: "missing" };
  let bytes: Buffer;
  try {
    bytes = await createAttachmentStorage(strapi).read(file.fileId);
  } catch (error) {
    if (error instanceof AttachmentStorageError && error.code === "STORAGE_FILE_MISSING") return { failure: "missing" };
    // The plugin file record no longer names a key CSRM generated: it was altered outside CSRM, so it is tamper evidence.
    if (error instanceof AttachmentStorageError && error.code === "STORAGE_KEY_INVALID") return { failure: "integrity" };
    throw error;
  }
  if (typeof file.sha256 !== "string" || !SHA256_HEX.test(file.sha256)) return { failure: "integrity" };
  const actual = createHash("sha256").update(bytes).digest();
  return timingSafeEqual(actual, Buffer.from(file.sha256, "hex")) ? { bytes } : { failure: "integrity" };
}

/**
 * The `Content-Disposition` value for a download (RFC 6266, RFC 5987; 14-RESEARCH Pitfall 15): `attachment`, an ASCII
 * `filename` for older clients, with every non-ASCII character, `"` and `\` replaced by `_` so it can never end the
 * quoted string, and the exact name as `filename*=UTF-8''`, percent-encoded with `'()*` encoded too, since they are
 * not attribute characters.
 */
export function contentDispositionFor(name: string): string {
  const ascii = name.replace(/[^\x20-\x7e]|["\\]/g, "_");
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encoded}`;
}

/** The part of Koa's context a download writes. */
export type DownloadContext = {
  set(field: string, value: string): void;
  body: unknown;
};

/**
 * Sends verified bytes as a download (D-23): never shown inline, never sniffed, never cached, and sandboxed should a
 * browser render it anyway. The media type is set as recorded, without the charset Koa's `ctx.type` would add to a
 * text type, because a text file's encoding is whatever its uploader used.
 */
export function sendStoredFile(ctx: DownloadContext, file: { readonly fileName: string; readonly mediaType: string; readonly bytes: Buffer }): void {
  ctx.set("Content-Disposition", contentDispositionFor(file.fileName));
  ctx.set("X-Content-Type-Options", "nosniff");
  ctx.set("Cache-Control", "no-store");
  ctx.set("Content-Security-Policy", "default-src 'none'; sandbox");
  ctx.set("Content-Type", file.mediaType);
  ctx.body = file.bytes;
}
