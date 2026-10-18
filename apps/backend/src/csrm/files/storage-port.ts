import { randomUUID } from "node:crypto";
import { open } from "node:fs/promises";
import path from "node:path";

import { ATTACHMENT_DEFAULT_LOCAL_DIR, attachmentConfigOf } from "./attachment-config";
import { ATTACHMENT_LIMITS, ATTACHMENT_MEDIA_TYPES, ATTACHMENT_TYPES, storageExtensionFor, type AttachmentType } from "./attachment-policy";

/*
 * The attachment storage port (14-04; D-06, D-07). Strapi reaches stored bytes only through these three methods, so
 * the attachment operations, text extraction and Phase 20's evidence files never touch a provider, a URL or a key.
 *
 * - put: generates the key (`csrm_` and 32 hex characters, never the uploaded name), hands the bytes to the upload
 *   plugin's provider and creates the plugin's file record itself. The plugin's upload service is never called, so
 *   no image is optimised, oriented, resized or given formats: the stored bytes are the bytes given (D-07).
 * - read: checks the key against STORAGE_KEY_PATTERN before touching storage, then reads the private local file, whose
 *   size is checked against the 25 MiB bound before a byte is read (IN-209), or, for S3 (which has no read method),
 *   fetches a presigned GetObject server-side: a URL without X-Amz-Signature is refused before any request, as is an
 *   http URL unless the configured endpoint is itself http, which only the development key allows (WR-705, IN-209); no
 *   redirect is followed, only a 200 is accepted and the 25 MiB bound holds.
 * - remove: the provider's delete and the file record's.
 *
 * No storage URL leaves this module, and none is logged. Reversibility: costly (stored objects).
 */

export const STORAGE_KEY_PATTERN = /^csrm_[0-9a-f]{32}$/;

const UPLOAD_FILE_UID = "plugin::upload.file";
const STORAGE_EXTENSIONS: ReadonlySet<string> = new Set(ATTACHMENT_TYPES.map(storageExtensionFor));
/** A stored file is never larger than an accepted one. */
const STORAGE_READ_MAX_BYTES = ATTACHMENT_LIMITS.maxBytes;
/** The presigned URL is valid for 60 seconds; a read that has not finished by then has failed. */
const STORAGE_READ_TIMEOUT_MS = 60_000;

export type StoredAttachmentFile = { readonly fileId: number; readonly hash: string; readonly ext: string };

export interface AttachmentStorage {
  /** Stores the bytes under a new key; returns the plugin file record's id and the key. */
  put(bytes: Uint8Array, options: { readonly type: AttachmentType }): Promise<StoredAttachmentFile>;
  /** The stored bytes, exactly as they were put. */
  read(fileId: number): Promise<Buffer>;
  /** Deletes the stored bytes and the plugin file record. */
  remove(fileId: number): Promise<void>;
}

export type AttachmentStorageErrorCode =
  | "STORAGE_FILE_MISSING"
  | "STORAGE_KEY_INVALID"
  | "STORAGE_URL_UNSIGNED"
  | "STORAGE_URL_INSECURE"
  | "STORAGE_READ_FAILED";

/** A storage failure with a closed code; its message is the code, so nothing of a key, path or URL can leak. */
export class AttachmentStorageError extends Error {
  readonly code: AttachmentStorageErrorCode;

  constructor(code: AttachmentStorageErrorCode) {
    super(code);
    this.name = "AttachmentStorageError";
    this.code = code;
  }
}

type ProviderFile = Record<string, unknown> & { hash: string; ext: string; url?: string; provider_metadata?: unknown };

type UploadProvider = {
  upload(file: ProviderFile): Promise<unknown>;
  delete(file: ProviderFile): Promise<unknown>;
  getSignedUrl?(file: ProviderFile): Promise<{ url?: unknown }> | { url?: unknown };
};

type UploadFileQuery = {
  create(input: { data: Record<string, unknown> }): Promise<{ id: number }>;
  findOne(input: { where: { id: number } }): Promise<Record<string, unknown> | null>;
  delete(input: { where: { id: number } }): Promise<unknown>;
};

export type AttachmentStorageStrapi = {
  readonly config: { get: (key: string) => unknown };
  readonly dirs: { readonly app: { readonly root: string } };
  plugin(name: string): unknown;
  readonly db: { query(uid: string): unknown };
};

/** The upload plugin's configured provider name, as the plugin compares it with a file record's `provider`. */
export function uploadProviderName(strapi: { readonly config: { get: (key: string) => unknown } }): string {
  const config = strapi.config.get("plugin::upload") as { provider?: unknown } | undefined;
  return typeof config?.provider === "string" && config.provider !== "" ? config.provider : "local";
}

/** The private local directory: the configured one, or `.tmp/attachments` under the app when attachments are off. */
export function attachmentLocalDirectoryOf(strapi: Pick<AttachmentStorageStrapi, "config" | "dirs">): string {
  const storage = attachmentConfigOf(strapi).storage;
  return storage?.kind === "local" ? storage.directory : path.resolve(strapi.dirs.app.root, ATTACHMENT_DEFAULT_LOCAL_DIR);
}

function bytesToKilobytes(bytes: number): number {
  return Math.round((bytes / 1000) * 100) / 100;
}

/** A presigned S3 GetObject URL, or null: http(s) and carrying X-Amz-Signature. */
function presignedUrl(candidate: unknown): URL | null {
  if (typeof candidate !== "string") return null;
  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    return null;
  }
  return (url.protocol === "https:" || url.protocol === "http:") && url.searchParams.has("X-Amz-Signature") ? url : null;
}

/**
 * Whether a presigned read may use plain http (WR-705, IN-209): only when the configured S3 endpoint is itself http,
 * which the configuration accepts only under the development key (a local store). With AWS (no endpoint) or an https
 * endpoint, the bytes and the signed query never cross the network in cleartext.
 */
function httpReadsAllowed(strapi: Pick<AttachmentStorageStrapi, "config">): boolean {
  const storage = attachmentConfigOf(strapi).storage;
  if (storage?.kind !== "s3" || storage.endpoint === null) return false;
  try {
    return new URL(storage.endpoint).protocol === "http:";
  } catch {
    return false;
  }
}

/** D-06: reads an S3 object through a presigned GET, server-side; the URL never leaves this function. */
async function readPresigned(provider: UploadProvider, record: ProviderFile, allowHttp: boolean): Promise<Buffer> {
  if (typeof provider.getSignedUrl !== "function") throw new AttachmentStorageError("STORAGE_READ_FAILED");
  let signed: unknown;
  try {
    signed = (await provider.getSignedUrl(record))?.url;
  } catch {
    throw new AttachmentStorageError("STORAGE_READ_FAILED");
  }
  const url = presignedUrl(signed);
  if (!url) throw new AttachmentStorageError("STORAGE_URL_UNSIGNED");
  if (url.protocol !== "https:" && !allowHttp) throw new AttachmentStorageError("STORAGE_URL_INSECURE");
  let response: Response;
  try {
    response = await fetch(url, { redirect: "error", signal: AbortSignal.timeout(STORAGE_READ_TIMEOUT_MS) });
  } catch {
    throw new AttachmentStorageError("STORAGE_READ_FAILED");
  }
  const reader = response.body?.getReader();
  const declared = response.headers.get("content-length");
  if (response.status !== 200 || !reader || (declared !== null && !(Number(declared) <= STORAGE_READ_MAX_BYTES))) {
    await reader?.cancel().catch(() => undefined);
    throw new AttachmentStorageError("STORAGE_READ_FAILED");
  }
  const chunks: Buffer[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > STORAGE_READ_MAX_BYTES) throw new AttachmentStorageError("STORAGE_READ_FAILED");
      chunks.push(Buffer.from(value));
    }
  } catch {
    await reader.cancel().catch(() => undefined);
    throw new AttachmentStorageError("STORAGE_READ_FAILED");
  }
  return Buffer.concat(chunks, total);
}

/**
 * Reads a private local file within the 25 MiB bound (IN-209): its size is taken from the open file before a byte is
 * read, so an oversized file is refused without being loaded, and exactly that many bytes are then read into a buffer
 * of that size, so a file that grows meanwhile cannot take more (its digest check refuses it), and one that shrinks
 * fails the read.
 */
async function readLocal(location: string): Promise<Buffer> {
  let handle: Awaited<ReturnType<typeof open>>;
  try {
    handle = await open(location, "r");
  } catch (error) {
    throw new AttachmentStorageError((error as NodeJS.ErrnoException).code === "ENOENT" ? "STORAGE_FILE_MISSING" : "STORAGE_READ_FAILED");
  }
  try {
    const { size } = await handle.stat();
    if (size > STORAGE_READ_MAX_BYTES) throw new AttachmentStorageError("STORAGE_READ_FAILED");
    const bytes = Buffer.alloc(size);
    for (let filled = 0; filled < size;) {
      const { bytesRead } = await handle.read(bytes, filled, size - filled, filled);
      if (bytesRead === 0) throw new AttachmentStorageError("STORAGE_READ_FAILED");
      filled += bytesRead;
    }
    return bytes;
  } catch (error) {
    throw error instanceof AttachmentStorageError ? error : new AttachmentStorageError("STORAGE_READ_FAILED");
  } finally {
    await handle.close().catch(() => undefined);
  }
}

export function createAttachmentStorage(strapi: AttachmentStorageStrapi): AttachmentStorage {
  const files = () => strapi.db.query(UPLOAD_FILE_UID) as UploadFileQuery;
  const provider = () => (strapi.plugin("upload") as { provider: UploadProvider }).provider;

  async function storedRecord(fileId: number): Promise<ProviderFile> {
    const record = Number.isSafeInteger(fileId) && fileId > 0 ? await files().findOne({ where: { id: fileId } }) : null;
    if (!record) throw new AttachmentStorageError("STORAGE_FILE_MISSING");
    const { hash, ext } = record;
    if (typeof hash !== "string" || !STORAGE_KEY_PATTERN.test(hash) || typeof ext !== "string" || !STORAGE_EXTENSIONS.has(ext)) {
      throw new AttachmentStorageError("STORAGE_KEY_INVALID");
    }
    return { ...record, hash, ext };
  }

  return {
    async put(bytes, { type }) {
      const buffer = Buffer.from(bytes);
      const hash = `csrm_${randomUUID().replace(/-/g, "")}`;
      const ext = storageExtensionFor(type);
      const name = `${hash}${ext}`;
      const mime = ATTACHMENT_MEDIA_TYPES[type];
      const size = bytesToKilobytes(buffer.length);
      const file: ProviderFile = { name, hash, ext, mime, buffer, size, sizeInBytes: buffer.length };
      await provider().upload(file);
      try {
        const record = await files().create({
          data: {
            name,
            hash,
            ext,
            mime,
            size,
            url: file.url,
            provider: uploadProviderName(strapi),
            provider_metadata: file.provider_metadata ?? null,
            folderPath: "/",
          },
        });
        return { fileId: record.id, hash, ext };
      } catch (error) {
        // Bytes without a record would be unreachable and never removed.
        await Promise.resolve(provider().delete(file)).catch(() => undefined);
        throw error;
      }
    },

    async read(fileId) {
      const record = await storedRecord(fileId);
      const providerName = uploadProviderName(strapi).toLowerCase();
      if (providerName === "aws-s3") return readPresigned(provider(), record, httpReadsAllowed(strapi));
      if (providerName !== "local") throw new AttachmentStorageError("STORAGE_READ_FAILED");
      return readLocal(path.join(attachmentLocalDirectoryOf(strapi), `${record.hash}${record.ext}`));
    },

    async remove(fileId) {
      const record = await storedRecord(fileId);
      await provider().delete(record);
      await files().delete({ where: { id: fileId } });
    },
  };
}
