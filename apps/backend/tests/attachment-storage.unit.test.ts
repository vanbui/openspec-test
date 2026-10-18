import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Readable } from "node:stream";
import test, { after } from "node:test";

import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";

import { AttachmentConfigurationError, ATTACHMENT_CONFIG_KEY, type AttachmentConfig } from "../src/csrm/files/attachment-config";
import { createPrivateLocalProvider } from "../src/csrm/files/private-local-provider";
import { attachmentUploadPluginConfig, registerAttachmentStorage } from "../src/csrm/files/register-attachment-storage";
import { AttachmentStorageError, createAttachmentStorage, STORAGE_KEY_PATTERN, type AttachmentStorageStrapi } from "../src/csrm/files/storage-port";

/*
 * 14-04 (D-06, D-07): attachment bytes are kept by a CSRM private local provider in a directory outside public/, under
 * a generated key, and never under a URL anything serves. The mounted half (the plugin record, /uploads/ and
 * /csrm-private/ answering 404) is in http-hardening.integration.test.ts.
 */

const directories: string[] = [];
after(async () => {
  for (const directory of directories) await rm(directory, { recursive: true, force: true });
});

async function temporaryDirectory(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "csrm-private-provider-"));
  directories.push(directory);
  return directory;
}

function storageKey(): string {
  return `csrm_${randomUUID().replace(/-/g, "")}`;
}

const PNG_BYTES = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0xfe, 0xff]);

test("the private local provider writes exactly the given bytes under the key and gives a URL nothing serves", async () => {
  const directory = await temporaryDirectory();
  const provider = createPrivateLocalProvider(directory);
  const hash = storageKey();
  const file: { hash: string; ext: string; buffer: Buffer; url?: string } = { hash, ext: ".png", buffer: PNG_BYTES };
  await provider.upload(file);
  assert.deepEqual(await readFile(path.join(directory, `${hash}.png`)), PNG_BYTES, "PRIVATE_PROVIDER_BYTES_CHANGED");
  assert.equal(file.url, `/csrm-private/${hash}.png`, "PRIVATE_PROVIDER_URL");
  assert.equal(provider.isPrivate(), true, "PRIVATE_PROVIDER_NOT_PRIVATE");
  assert.deepEqual(provider.getSignedUrl(file), { url: `/csrm-private/${hash}.png` }, "PRIVATE_PROVIDER_SIGNED_URL");
});

test("the private local provider creates its directory and streams an upload to the same key", async () => {
  const directory = path.join(await temporaryDirectory(), "nested", "attachments");
  const provider = createPrivateLocalProvider(directory);
  const hash = storageKey();
  const file: { hash: string; ext: string; stream: Readable; url?: string } = { hash, ext: ".pdf", stream: Readable.from([PNG_BYTES.subarray(0, 4), PNG_BYTES.subarray(4)]) };
  await provider.uploadStream(file);
  assert.deepEqual(await readFile(path.join(directory, `${hash}.pdf`)), PNG_BYTES, "PRIVATE_PROVIDER_STREAM_BYTES_CHANGED");
  assert.equal(file.url, `/csrm-private/${hash}.pdf`, "PRIVATE_PROVIDER_STREAM_URL");
});

test("the private local provider deletes a stored file and tolerates one that is already gone", async () => {
  const directory = await temporaryDirectory();
  const provider = createPrivateLocalProvider(directory);
  const hash = storageKey();
  await provider.upload({ hash, ext: ".png", buffer: PNG_BYTES });
  await provider.delete({ hash, ext: ".png" });
  assert.equal(existsSync(path.join(directory, `${hash}.png`)), false, "PRIVATE_PROVIDER_DELETE_LEFT_FILE");
  await provider.delete({ hash, ext: ".png" });
});

test("the private local provider keeps the admin Media Library's own keys working, also privately", async () => {
  const directory = await temporaryDirectory();
  const provider = createPrivateLocalProvider(directory);
  // @strapi/upload's generateFileName: the slug of the uploaded name, "_" and 10 hex characters; a format prefixes it.
  for (const hash of ["vendor_pack_0a1b2c3d4e", "thumbnail_vendor_pack_0a1b2c3d4e"]) {
    const file: { hash: string; ext: string; buffer: Buffer; url?: string } = { hash, ext: ".png", buffer: PNG_BYTES };
    await provider.upload(file);
    assert.equal(file.url, `/csrm-private/${hash}.png`, `MEDIA_LIBRARY_KEY_${hash}`);
  }
});

test("the private local provider refuses a key or extension that could leave its directory, and writes nothing", async () => {
  const parent = await temporaryDirectory();
  const directory = path.join(parent, "attachments");
  const provider = createPrivateLocalProvider(directory);
  for (const [hash, ext] of [["../escape", ".png"], ["..", ".png"], ["a/b", ".png"], ["a\\b", ".png"], ["", ".png"], [storageKey(), "/../x"], [storageKey(), ".p/ng"]] as const) {
    await assert.rejects(provider.upload({ hash, ext, buffer: PNG_BYTES }), `PRIVATE_PROVIDER_ACCEPTED_${hash}${ext}`);
    await assert.rejects(provider.delete({ hash, ext }), `PRIVATE_PROVIDER_DELETE_ACCEPTED_${hash}${ext}`);
  }
  assert.deepEqual(await readdir(parent), existsSync(directory) ? ["attachments"] : [], "PRIVATE_PROVIDER_WROTE_OUTSIDE");
  if (existsSync(directory)) assert.deepEqual(await readdir(directory), [], "PRIVATE_PROVIDER_WROTE_A_REFUSED_FILE");
});

/*
 * IN-209: the private local provider keeps attachments private on the host too. Its directory is created 0700 and each
 * file is written 0600, so other users of the host cannot read them under the usual umask 022, and with the `wx` flag,
 * so an existing key is never overwritten. File modes are POSIX: Windows keeps ACLs instead, so the stat assertions
 * are skipped there, while the options the provider passes are checked on every platform and the no-overwrite case
 * runs everywhere.
 */
type Recorded = { readonly call: string; readonly options: unknown };

/** Records the options the provider passes to mkdir, writeFile and createWriteStream for the test's duration. */
async function recordingFileSystem<T>(action: () => Promise<T>): Promise<{ result: T; calls: Recorded[] }> {
  // The provider's compiled module reads these through the shared module objects at call time.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fsPromises = require("node:fs/promises") as Record<string, (...args: unknown[]) => unknown>;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fs = require("node:fs") as Record<string, (...args: unknown[]) => unknown>;
  const originals = { mkdir: fsPromises.mkdir, writeFile: fsPromises.writeFile, createWriteStream: fs.createWriteStream };
  const calls: Recorded[] = [];
  fsPromises.mkdir = (...args: unknown[]) => (calls.push({ call: "mkdir", options: args[1] }), originals.mkdir(...args));
  fsPromises.writeFile = (...args: unknown[]) => (calls.push({ call: "writeFile", options: args[2] }), originals.writeFile(...args));
  fs.createWriteStream = (...args: unknown[]) => (calls.push({ call: "createWriteStream", options: args[1] }), originals.createWriteStream(...args));
  try {
    return { result: await action(), calls };
  } finally {
    fsPromises.mkdir = originals.mkdir;
    fsPromises.writeFile = originals.writeFile;
    fs.createWriteStream = originals.createWriteStream;
  }
}

test("the private local provider creates its directory 0700 and writes each file 0600 without overwriting, buffered or streamed (IN-209)", async () => {
  const directory = path.join(await temporaryDirectory(), "attachments");
  const provider = createPrivateLocalProvider(directory);
  const { calls } = await recordingFileSystem(async () => {
    await provider.upload({ hash: storageKey(), ext: ".png", buffer: PNG_BYTES });
    await provider.uploadStream({ hash: storageKey(), ext: ".pdf", stream: Readable.from([PNG_BYTES]) });
  });
  const of = (call: string) => calls.filter((entry) => entry.call === call).map((entry) => entry.options);
  assert.deepEqual(of("mkdir"), [{ recursive: true, mode: 0o700 }, { recursive: true, mode: 0o700 }], `THE_DIRECTORY_IS_NOT_CREATED_0700: ${JSON.stringify(of("mkdir"))}`);
  assert.deepEqual(of("writeFile"), [{ mode: 0o600, flag: "wx" }], `THE_FILE_IS_NOT_WRITTEN_0600_WX: ${JSON.stringify(of("writeFile"))}`);
  assert.deepEqual(of("createWriteStream"), [{ mode: 0o600, flags: "wx" }], `THE_STREAM_IS_NOT_WRITTEN_0600_WX: ${JSON.stringify(of("createWriteStream"))}`);
});

test("the private local provider's directory is 0700 and its files 0600 on the disk (IN-209; POSIX modes)", { skip: process.platform === "win32" ? "Windows keeps ACLs, not POSIX modes; the options are checked on every platform above" : false }, async () => {
  const directory = path.join(await temporaryDirectory(), "attachments");
  const provider = createPrivateLocalProvider(directory);
  const buffered = storageKey();
  const streamed = storageKey();
  await provider.upload({ hash: buffered, ext: ".png", buffer: PNG_BYTES });
  await provider.uploadStream({ hash: streamed, ext: ".pdf", stream: Readable.from([PNG_BYTES]) });
  assert.equal((await stat(directory)).mode & 0o777, 0o700, "THE_DIRECTORY_IS_NOT_0700");
  assert.equal((await stat(path.join(directory, `${buffered}.png`))).mode & 0o777, 0o600, "THE_FILE_IS_NOT_0600");
  assert.equal((await stat(path.join(directory, `${streamed}.pdf`))).mode & 0o777, 0o600, "THE_STREAMED_FILE_IS_NOT_0600");
});

test("the private local provider never overwrites a stored key, buffered or streamed, and keeps the first bytes (IN-209)", async () => {
  const directory = await temporaryDirectory();
  const provider = createPrivateLocalProvider(directory);
  const hash = storageKey();
  await provider.upload({ hash, ext: ".png", buffer: PNG_BYTES });
  await assert.rejects(provider.upload({ hash, ext: ".png", buffer: Buffer.from("replacement") }), (error: NodeJS.ErrnoException) => error.code === "EEXIST", "A_STORED_KEY_WAS_OVERWRITTEN_BY_A_BUFFER");
  await assert.rejects(provider.uploadStream({ hash, ext: ".png", stream: Readable.from([Buffer.from("replacement")]) }), (error: NodeJS.ErrnoException) => error.code === "EEXIST", "A_STORED_KEY_WAS_OVERWRITTEN_BY_A_STREAM");
  assert.deepEqual(await readFile(path.join(directory, `${hash}.png`)), PNG_BYTES, "THE_FIRST_BYTES_WERE_LOST");
});

test("the provider's replace with the same key, as the Media Library keeps it, writes the new bytes (IN-209)", async () => {
  const directory = await temporaryDirectory();
  const provider = createPrivateLocalProvider(directory);
  const hash = storageKey();
  await provider.upload({ hash, ext: ".png", buffer: PNG_BYTES });
  await provider.replace({ hash, ext: ".png", buffer: Buffer.from("replacement") }, { hash, ext: ".png" });
  assert.deepEqual(await readFile(path.join(directory, `${hash}.png`)), Buffer.from("replacement"), "THE_REPLACE_DID_NOT_WRITE");
  const other = storageKey();
  await provider.replace({ hash: other, ext: ".png", buffer: PNG_BYTES }, { hash, ext: ".png" });
  assert.equal(existsSync(path.join(directory, `${hash}.png`)), false, "THE_OLD_KEY_WAS_KEPT");
  assert.deepEqual(await readFile(path.join(directory, `${other}.png`)), PNG_BYTES);
});

/** A Strapi whose attachments are stored locally in `directory`, with one plugin file record under `hash`. */
function localStorageStrapi(directory: string, hash: string): AttachmentStorageStrapi {
  const record = { id: 7, hash, ext: ".pdf", url: `/csrm-private/${hash}.pdf`, provider: "local" };
  const config: AttachmentConfig = { storage: { kind: "local", directory }, scanner: { kind: "development" }, available: true, unavailableReason: null };
  return {
    config: { get: (key: string) => (key === "plugin::upload" ? { provider: "local" } : key === ATTACHMENT_CONFIG_KEY ? config : undefined) },
    dirs: { app: { root: os.tmpdir() } },
    plugin: () => ({ provider: { upload: async () => undefined, delete: async () => undefined } }),
    db: { query: () => ({ findOne: async () => record, create: async () => record, delete: async () => record }) },
  };
}

test("a stored local file above 25 MiB is refused before it is read; one of exactly 25 MiB is read (IN-209)", async () => {
  const directory = await temporaryDirectory();
  const hash = storageKey();
  const location = path.join(directory, `${hash}.pdf`);
  await writeFile(location, Buffer.alloc(26_214_401, 0x61));
  assert.equal(await readRefusal(localStorageStrapi(directory, hash)), "STORAGE_READ_FAILED", "AN_OVERSIZED_STORED_FILE_WAS_READ");
  await writeFile(location, Buffer.alloc(26_214_400, 0x62));
  const bytes = await createAttachmentStorage(localStorageStrapi(directory, hash)).read(7);
  assert.equal(bytes.length, 26_214_400, "THE_LARGEST_STORED_FILE_WAS_NOT_READ");
});

test("the storage key is csrm_ and 32 lower-case hex characters, and nothing else", () => {
  assert.equal(STORAGE_KEY_PATTERN.test(storageKey()), true, "STORAGE_KEY_GENERATED_REFUSED");
  for (const candidate of ["../x", "csrm_ABC", `csrm_${"a".repeat(31)}`, `csrm_${"a".repeat(33)}`, `csrm_${"A".repeat(32)}`, `csrm_${"a".repeat(32)}.png`, `xcsrm_${"a".repeat(32)}`, `csrm_${"a".repeat(31)}/`]) {
    assert.equal(STORAGE_KEY_PATTERN.test(candidate), false, `STORAGE_KEY_ACCEPTED_${candidate}`);
  }
});

/*
 * 14-04 (D-06, G-7; 14-RESEARCH Pitfalls 4 and 5): the production S3 block is private. The ACL key is present and
 * undefined, so the provider applies no default public ACL and sends no ACL header; objects are encrypted with the
 * configured KMS key; the region defaults to Sydney; and nothing configures a baseUrl, which would make the provider
 * hand out unsigned URLs. The mounted proof against a fake object store is attachment-storage-s3.integration.test.ts.
 */
const S3_ENV = { CSRM_ATTACHMENT_STORAGE: "s3", CSRM_ATTACHMENT_S3_BUCKET: "csrm-attachments-test", CSRM_ATTACHMENT_S3_KMS_KEY_ID: "alias/csrm-attachments-test" } as const;

type S3PluginConfig = {
  provider: string;
  providerOptions: {
    rootPath: string;
    baseUrl?: unknown;
    s3Options: { region: string; endpoint?: string; forcePathStyle?: boolean; params: Record<string, unknown> };
    providerConfig: { encryption: { type: string; kmsKeyId: string } };
  };
};

test("the upload plugin keeps its default provider unless attachments are stored in S3", () => {
  assert.deepEqual(attachmentUploadPluginConfig({}), {}, "PLUGIN_CONFIG_WITHOUT_S3");
  assert.deepEqual(attachmentUploadPluginConfig({ CSRM_ATTACHMENT_STORAGE: "local" }), {}, "PLUGIN_CONFIG_LOCAL");
});

test("the S3 block is private: no ACL header, SSE-KMS with the configured key, Sydney by default, no baseUrl", () => {
  const config = attachmentUploadPluginConfig(S3_ENV) as S3PluginConfig;
  assert.equal(config.provider, "aws-s3", "S3_PROVIDER");
  const { providerOptions } = config;
  assert.equal(providerOptions.rootPath, "csrm/attachments", "S3_ROOT_PATH");
  assert.equal(providerOptions.s3Options.region, "ap-southeast-2", "S3_DEFAULT_REGION");
  const { params } = providerOptions.s3Options;
  assert.equal(params.Bucket, "csrm-attachments-test", "S3_BUCKET");
  assert.equal("ACL" in params, true, "S3_ACL_KEY_ABSENT: the provider would apply public-read");
  assert.equal(params.ACL, undefined, "S3_ACL_SET");
  assert.equal(params.signedUrlExpires, 60, "S3_SIGNED_URL_EXPIRY");
  assert.deepEqual(providerOptions.providerConfig.encryption, { type: "aws:kms", kmsKeyId: "alias/csrm-attachments-test" }, "S3_ENCRYPTION");
  assert.equal("baseUrl" in providerOptions, false, "S3_BASE_URL_CONFIGURED");
  assert.equal("endpoint" in providerOptions.s3Options, false, "S3_ENDPOINT_WITHOUT_SETTING");
  assert.equal("credentials" in providerOptions.s3Options, false, "S3_CREDENTIALS_IN_CONFIG");
  assert.doesNotMatch(JSON.stringify(config), /private/, "S3_ACL_PRIVATE_SENT");
});

test("the S3 block takes a configured region, and an endpoint with path-style addressing", () => {
  const config = attachmentUploadPluginConfig({ ...S3_ENV, CSRM_ATTACHMENT_S3_REGION: "ap-southeast-4", CSRM_ATTACHMENT_S3_ENDPOINT: "http://127.0.0.1:9000" }) as S3PluginConfig;
  assert.equal(config.providerOptions.s3Options.region, "ap-southeast-4", "S3_REGION");
  assert.equal(config.providerOptions.s3Options.endpoint, "http://127.0.0.1:9000", "S3_ENDPOINT");
  assert.equal(config.providerOptions.s3Options.forcePathStyle, true, "S3_PATH_STYLE");
});

function fakeRegistrationStrapi(upload: Record<string, unknown>, storage: AttachmentConfig["storage"]) {
  const config: AttachmentConfig = { storage, scanner: { kind: "development" }, available: storage !== null, unavailableReason: storage ? null : "ATTACHMENTS_NOT_CONFIGURED" };
  const extended: object[] = [];
  const contentApi = { routes: [{ method: "GET", path: "/files" }] as unknown[] };
  return {
    extended,
    contentApi,
    strapi: {
      config: { get: (key: string) => (key === "plugin::upload" ? upload : key === ATTACHMENT_CONFIG_KEY ? config : undefined) },
      dirs: { app: { root: os.tmpdir() } },
      plugin: () => ({ provider: { extend: (methods: object) => extended.push(methods) }, routes: { "content-api": contentApi } }),
    },
  };
}

test("registration refuses an S3 baseUrl, which would hand out unsigned URLs, and never echoes it", () => {
  const s3 = { kind: "s3", bucket: "b", region: "ap-southeast-2", kmsKeyId: "k", endpoint: null } as const;
  const { strapi } = fakeRegistrationStrapi({ provider: "aws-s3", providerOptions: { baseUrl: "https://cdn.example" } }, s3);
  assert.throws(() => registerAttachmentStorage(strapi), (error: unknown) => {
    assert.ok(error instanceof AttachmentConfigurationError, "an AttachmentConfigurationError");
    assert.match(error.message, /baseUrl/);
    assert.ok(!error.message.includes("cdn.example"), "BASE_URL_ECHOED");
    return true;
  });
  const accepted = fakeRegistrationStrapi({ provider: "aws-s3", providerOptions: {} }, s3);
  registerAttachmentStorage(accepted.strapi);
  assert.equal(accepted.extended.length, 0, "S3_PROVIDER_REPLACED");
  assert.deepEqual(accepted.contentApi.routes, [], "S3_CONTENT_API_ROUTES_KEPT");
});

test("registration installs the private local provider on the plugin's local provider and unmounts its routes", () => {
  const { strapi, extended, contentApi } = fakeRegistrationStrapi({ provider: "local" }, { kind: "local", directory: path.join(os.tmpdir(), "csrm-unit-attachments") });
  registerAttachmentStorage(strapi);
  assert.equal(extended.length, 1, "PRIVATE_PROVIDER_NOT_INSTALLED");
  assert.equal((extended[0] as { isPrivate: () => boolean }).isPrivate(), true, "INSTALLED_PROVIDER_NOT_PRIVATE");
  assert.deepEqual(contentApi.routes, [], "CONTENT_API_ROUTES_KEPT");
});

/*
 * The S3 read path never fetches a URL that is not presigned, follows no redirect and keeps the 25 MiB bound. A local
 * HTTP server stands in for the bucket and counts what reaches it.
 */
type Respond = (status: number, headers?: Record<string, string>, body?: Buffer) => void;

async function countingServer(handler: (url: URL, respond: Respond) => void) {
  const seen: string[] = [];
  const server: Server = createServer((request, response) => {
    const url = new URL(request.url ?? "/", "http://127.0.0.1");
    seen.push(url.pathname);
    handler(url, (status, headers = {}, body) => {
      response.writeHead(status, headers);
      response.end(body);
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const close = () => new Promise<void>((resolve) => {
    server.closeAllConnections();
    server.close(() => resolve());
  });
  return { base, seen, close };
}

/**
 * A Strapi storing attachments in S3 through `endpoint`. By default a local http store, which the configuration allows
 * only under the development key (WR-705), so the counting server below can stand in for it.
 */
function s3StorageStrapi(signedUrl: string, endpoint: string | null = "http://127.0.0.1:9000"): AttachmentStorageStrapi {
  const record = { id: 7, hash: storageKey(), ext: ".pdf", url: "http://bucket.invalid/csrm/attachments/x.pdf", provider: "aws-s3" };
  const config: AttachmentConfig = {
    storage: { kind: "s3", bucket: "csrm-attachments-test", region: "ap-southeast-2", kmsKeyId: "alias/csrm-attachments-test", endpoint },
    scanner: { kind: "development" },
    available: true,
    unavailableReason: null,
  };
  return {
    config: { get: (key: string) => (key === "plugin::upload" ? { provider: "aws-s3" } : key === ATTACHMENT_CONFIG_KEY ? config : undefined) },
    dirs: { app: { root: os.tmpdir() } },
    plugin: () => ({ provider: { upload: async () => undefined, delete: async () => undefined, getSignedUrl: async () => ({ url: signedUrl }) } }),
    db: { query: () => ({ findOne: async () => record, create: async () => record, delete: async () => record }) },
  };
}

async function readRefusal(strapi: AttachmentStorageStrapi): Promise<string> {
  try {
    await createAttachmentStorage(strapi).read(7);
  } catch (error) {
    assert.ok(error instanceof AttachmentStorageError, `not an AttachmentStorageError: ${String(error)}`);
    return error.code;
  }
  return "READ_SUCCEEDED";
}

test("an S3 read refuses a URL that is not presigned and sends no request", async () => {
  const server = await countingServer((_url, respond) => respond(200, {}, Buffer.from("bytes")));
  try {
    assert.equal(await readRefusal(s3StorageStrapi(`${server.base}/csrm-attachments-test/csrm/attachments/x.pdf`)), "STORAGE_URL_UNSIGNED", "UNSIGNED_URL_READ");
    assert.equal(await readRefusal(s3StorageStrapi("not a url")), "STORAGE_URL_UNSIGNED", "INVALID_URL_READ");
    assert.equal(await readRefusal(s3StorageStrapi("file:///etc/passwd?X-Amz-Signature=abc")), "STORAGE_URL_UNSIGNED", "FILE_URL_READ");
    assert.deepEqual(server.seen, [], "UNSIGNED_URL_FETCHED");
  } finally {
    await server.close();
  }
});

test("an S3 read follows no redirect, accepts only 200 and refuses a body over 25 MiB", async () => {
  const server = await countingServer((url, respond) => {
    if (url.pathname === "/redirect") return respond(302, { location: "/ok" });
    if (url.pathname === "/missing") return respond(404);
    if (url.pathname === "/too-large") return respond(200, { "content-length": "26214401" }, Buffer.alloc(26_214_401));
    respond(200, {}, Buffer.from("stored bytes"));
  });
  try {
    const signed = (name: string) => `${server.base}/${name}?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc`;
    assert.equal(await readRefusal(s3StorageStrapi(signed("redirect"))), "STORAGE_READ_FAILED", "REDIRECT_FOLLOWED");
    assert.ok(!server.seen.includes("/ok"), "REDIRECT_TARGET_FETCHED");
    assert.equal(await readRefusal(s3StorageStrapi(signed("missing"))), "STORAGE_READ_FAILED", "NOT_200_READ");
    assert.equal(await readRefusal(s3StorageStrapi(signed("too-large"))), "STORAGE_READ_FAILED", "OVERSIZE_READ");
    const bytes = await createAttachmentStorage(s3StorageStrapi(signed("ok"))).read(7);
    assert.deepEqual(bytes, Buffer.from("stored bytes"), "SIGNED_READ_BYTES");
  } finally {
    await server.close();
  }
});

/*
 * WR-705 and IN-209: a presigned read is https. An http URL is fetched only when the configured endpoint is itself http,
 * which the configuration allows only under the development key; with AWS (no endpoint) or an https endpoint, an http
 * URL is refused before any request is sent, so neither the bytes nor the signed query cross the network in cleartext.
 */
test("an http presigned URL is refused, with no request sent, unless the configured endpoint is itself http (WR-705, IN-209)", async () => {
  const server = await countingServer((_url, respond) => respond(200, {}, Buffer.from("stored bytes")));
  try {
    const signed = `${server.base}/ok?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Signature=abc`;
    assert.equal(await readRefusal(s3StorageStrapi(signed, null)), "STORAGE_URL_INSECURE", "AN_HTTP_URL_WAS_READ_FROM_AWS");
    assert.equal(await readRefusal(s3StorageStrapi(signed, "https://s3.example.internal")), "STORAGE_URL_INSECURE", "AN_HTTP_URL_WAS_READ_BESIDE_AN_HTTPS_ENDPOINT");
    assert.deepEqual(server.seen, [], "AN_HTTP_URL_WAS_FETCHED");
    const bytes = await createAttachmentStorage(s3StorageStrapi(signed, server.base)).read(7);
    assert.deepEqual(bytes, Buffer.from("stored bytes"), "THE_DEVELOPMENT_HTTP_ENDPOINT_WAS_NOT_READ");
  } finally {
    await server.close();
  }
});
