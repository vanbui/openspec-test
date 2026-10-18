import { createWriteStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

import { STORAGE_KEY_PATTERN } from "./storage-port";

/*
 * The CSRM private local provider (14-04; D-06). It replaces the upload plugin's local provider methods in the
 * application's register() (register-attachment-storage.ts), so every file the plugin keeps locally, attachments and
 * the admin Media Library's alike, is written to a configured directory outside public/, which Strapi serves to
 * anyone. Its URL is `/csrm-private/{key}`, which no middleware routes: the bytes reach a caller only through Strapi
 * code that reads them (storage-port.ts).
 *
 * A key is CSRM's `csrm_` form or the plugin's own (`generateFileName`: the slug of the uploaded name and 10 hex
 * characters, a format name in front for a derived image), and an extension is a dot and letters or digits. Anything
 * else is refused before a path is joined, so no key can leave the directory.
 *
 * It leaves the stock provider's checkFileSize in place: the storage port never calls it (CSRM bounds attachments
 * itself, ATTACHMENT_LIMITS), and the admin Media Library keeps the plugin's own size limit.
 *
 * On the host the files are private too (IN-209): the directory is created 0700 and each file is written 0600, so no
 * other user of the host can read them under the usual umask, and with the `wx` flag, so a stored key is never
 * overwritten. Windows keeps ACLs instead of these modes.
 */

/** The directory's and each file's POSIX modes, and the flag that never overwrites a stored key (IN-209). */
const DIRECTORY_MODE = 0o700;
const FILE_MODE = 0o600;
const WRITE_NEW = "wx";

export type PrivateLocalFile = {
  hash: string;
  ext?: string;
  buffer?: Uint8Array;
  stream?: Readable;
  url?: string;
};

export type PrivateLocalProvider = {
  upload(file: PrivateLocalFile): Promise<void>;
  uploadStream(file: PrivateLocalFile): Promise<void>;
  replace(newFile: PrivateLocalFile, oldFile: PrivateLocalFile): Promise<void>;
  replaceStream(newFile: PrivateLocalFile, oldFile: PrivateLocalFile): Promise<void>;
  delete(file: PrivateLocalFile): Promise<void>;
  isPrivate(): boolean;
  getSignedUrl(file: PrivateLocalFile): { url: string | undefined };
};

/** The prefix of the URL the plugin records; nothing serves it. */
export const PRIVATE_URL_PREFIX = "/csrm-private/";

/** `@strapi/upload`'s own key form (and a derived format's), bounded; letters, digits, `_` and `-` only. */
const PLUGIN_KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,199}$/;
const EXTENSION_PATTERN = /^(\.[A-Za-z0-9]{1,16})?$/;

function storedName(file: PrivateLocalFile): string {
  const ext = file.ext ?? "";
  const hash = typeof file.hash === "string" ? file.hash : "";
  if (!(STORAGE_KEY_PATTERN.test(hash) || PLUGIN_KEY_PATTERN.test(hash)) || !EXTENSION_PATTERN.test(ext)) {
    throw new Error("CSRM private storage refused a file key.");
  }
  return `${hash}${ext}`;
}

export function createPrivateLocalProvider(directory: string): PrivateLocalProvider {
  const root = path.resolve(directory);
  const locate = (file: PrivateLocalFile): { name: string; location: string } => {
    const name = storedName(file);
    return { name, location: path.join(root, name) };
  };
  const remove = async (location: string): Promise<void> => {
    try {
      await unlink(location);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
  };
  const upload = async (file: PrivateLocalFile): Promise<void> => {
    if (!file.buffer) throw new Error("Missing file buffer");
    const { name, location } = locate(file);
    await mkdir(root, { recursive: true, mode: DIRECTORY_MODE });
    await writeFile(location, file.buffer, { mode: FILE_MODE, flag: WRITE_NEW });
    file.url = `${PRIVATE_URL_PREFIX}${name}`;
  };
  const uploadStream = async (file: PrivateLocalFile): Promise<void> => {
    if (!file.stream) throw new Error("Missing file stream");
    const { name, location } = locate(file);
    await mkdir(root, { recursive: true, mode: DIRECTORY_MODE });
    await pipeline(file.stream, createWriteStream(location, { mode: FILE_MODE, flags: WRITE_NEW }));
    file.url = `${PRIVATE_URL_PREFIX}${name}`;
  };
  return {
    upload,
    uploadStream,
    // A replace: write the new file, then remove the old one when its key differs. Under the same key (the Media
    // Library keeps a replaced file's key), the old file is removed first, as the plugin's own replace does, because a
    // stored key is never overwritten.
    async replace(newFile, oldFile) {
      const previous = locate(oldFile).location;
      const same = previous === locate(newFile).location;
      if (same) await remove(previous);
      await upload(newFile);
      if (!same) await remove(previous);
    },
    async replaceStream(newFile, oldFile) {
      const previous = locate(oldFile).location;
      const same = previous === locate(newFile).location;
      if (same) await remove(previous);
      await uploadStream(newFile);
      if (!same) await remove(previous);
    },
    async delete(file) {
      await remove(locate(file).location);
    },
    isPrivate() {
      return true;
    },
    getSignedUrl(file) {
      return { url: file.url };
    },
  };
}
