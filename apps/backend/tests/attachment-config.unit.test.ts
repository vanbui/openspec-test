import assert from "node:assert/strict";
import path from "node:path";
import test from "node:test";

import * as attachmentConfigModule from "../src/csrm/files/attachment-config";
import {
  assertAttachmentConfiguration,
  attachmentConfigOf,
  AttachmentConfigurationError,
  readAttachmentConfig,
  type AttachmentConfig,
} from "../src/csrm/files/attachment-config";

/*
 * The attachment settings (14-03; D-15; Phase 12 D-27's pattern). Development defaults to local private storage and
 * the development scanner; everywhere else an unset storage or scanner turns attachments off without failing boot; an
 * invalid value, an incomplete block, a directory inside public/ or the double outside development fails boot.
 *
 * Unit-only proofs (accepted by the orchestrator, 2026-10-01): every mounted harness runs the development key, so the
 * non-development refusals are proven here only.
 */

const APP_ROOT = path.resolve("/srv/csrm-backend");
const DEVELOPMENT = { NODE_ENV: "development", CSRM_ENVIRONMENT: "development" } as const;
const PRODUCTION = { NODE_ENV: "production", CSRM_ENVIRONMENT: "production" } as const;
const S3 = { CSRM_ATTACHMENT_STORAGE: "s3", CSRM_ATTACHMENT_S3_BUCKET: "csrm-attachments-prod", CSRM_ATTACHMENT_S3_KMS_KEY_ID: "alias/csrm-attachments" } as const;
const CLAMAV = { CSRM_ATTACHMENT_SCANNER: "clamav", CSRM_CLAMAV_HOST: "clamd.internal", CSRM_CLAMAV_PORT: "3310" } as const;

/** Strapi's `dirs.static.public` under its default `server.dirs.public` (IN-209: the check reads the configured one). */
const PUBLIC_DIRECTORY = path.join(APP_ROOT, "public");

function read(env: Record<string, string | undefined>, publicDirectory = PUBLIC_DIRECTORY): AttachmentConfig {
  const options = { appRoot: APP_ROOT, publicDirectory };
  return readAttachmentConfig(env, options);
}

function refusesNaming(env: Record<string, string | undefined>, variable: string): void {
  assert.throws(() => read(env), (error: unknown) => {
    assert.ok(error instanceof AttachmentConfigurationError, "an AttachmentConfigurationError");
    assert.match(error.message, new RegExp(variable));
    return true;
  });
}

test("development with nothing set: local private storage under .tmp/attachments and the development scanner", () => {
  assert.deepEqual(read({ ...DEVELOPMENT }), {
    storage: { kind: "local", directory: path.join(APP_ROOT, ".tmp", "attachments") },
    scanner: { kind: "development" },
    available: true,
    unavailableReason: null,
  });
});

test("production with nothing set: attachments are unavailable, and boot does not fail", () => {
  assert.deepEqual(read({ ...PRODUCTION }), { storage: null, scanner: null, available: false, unavailableReason: "ATTACHMENTS_NOT_CONFIGURED" });
});

test("production with storage but no scanner, or a scanner but no storage, is unavailable", () => {
  assert.equal(read({ ...PRODUCTION, ...S3 }).unavailableReason, "ATTACHMENTS_NOT_CONFIGURED");
  assert.equal(read({ ...PRODUCTION, ...CLAMAV }).available, false);
});

test("empty settings count as unset", () => {
  assert.equal(read({ ...PRODUCTION, CSRM_ATTACHMENT_STORAGE: "", CSRM_ATTACHMENT_SCANNER: "" }).available, false);
  assert.equal(read({ ...DEVELOPMENT, CSRM_ATTACHMENT_STORAGE: "", CSRM_ATTACHMENT_SCANNER: "" }).available, true);
});

test("production with S3 and ClamAV is available, the region defaulting to ap-southeast-2 and the timeout to 60 s", () => {
  assert.deepEqual(read({ ...PRODUCTION, ...S3, ...CLAMAV }), {
    storage: { kind: "s3", bucket: "csrm-attachments-prod", region: "ap-southeast-2", kmsKeyId: "alias/csrm-attachments", endpoint: null },
    scanner: { kind: "clamav", host: "clamd.internal", port: 3310, timeoutMs: 60_000 },
    available: true,
    unavailableReason: null,
  });
});

test("S3 takes a region and an S3-compatible endpoint; ClamAV a scan timeout", () => {
  const config = read({ ...PRODUCTION, ...S3, ...CLAMAV, CSRM_ATTACHMENT_S3_REGION: "ap-southeast-4", CSRM_ATTACHMENT_S3_ENDPOINT: "https://s3.example.internal", CSRM_CLAMAV_TIMEOUT_MS: "120000" });
  assert.deepEqual(config.storage, { kind: "s3", bucket: "csrm-attachments-prod", region: "ap-southeast-4", kmsKeyId: "alias/csrm-attachments", endpoint: "https://s3.example.internal" });
  assert.deepEqual(config.scanner, { kind: "clamav", host: "clamd.internal", port: 3310, timeoutMs: 120_000 });
});

test("a local directory resolves from the app root; an absolute one is kept", () => {
  assert.deepEqual(read({ ...DEVELOPMENT, CSRM_ATTACHMENT_LOCAL_DIR: "var/attachments" }).storage, { kind: "local", directory: path.join(APP_ROOT, "var", "attachments") });
  const absolute = path.resolve("/data/csrm/attachments");
  assert.deepEqual(read({ ...PRODUCTION, CSRM_ATTACHMENT_STORAGE: "local", CSRM_ATTACHMENT_LOCAL_DIR: absolute, ...CLAMAV }).storage, { kind: "local", directory: absolute });
});

test("an invalid storage kind fails boot naming CSRM_ATTACHMENT_STORAGE", () => {
  refusesNaming({ ...DEVELOPMENT, CSRM_ATTACHMENT_STORAGE: "ftp" }, "CSRM_ATTACHMENT_STORAGE");
  refusesNaming({ ...PRODUCTION, CSRM_ATTACHMENT_STORAGE: "S3" }, "CSRM_ATTACHMENT_STORAGE");
});

test("S3 without a bucket or a KMS key fails boot naming the missing setting", () => {
  refusesNaming({ ...PRODUCTION, ...S3, CSRM_ATTACHMENT_S3_BUCKET: undefined }, "CSRM_ATTACHMENT_S3_BUCKET");
  refusesNaming({ ...PRODUCTION, ...S3, CSRM_ATTACHMENT_S3_KMS_KEY_ID: "" }, "CSRM_ATTACHMENT_S3_KMS_KEY_ID");
});

test("an S3 endpoint that is not an http(s) URL fails boot", () => {
  refusesNaming({ ...PRODUCTION, ...S3, CSRM_ATTACHMENT_S3_ENDPOINT: "s3.example.internal" }, "CSRM_ATTACHMENT_S3_ENDPOINT");
});

test("an invalid scanner kind fails boot naming CSRM_ATTACHMENT_SCANNER", () => {
  refusesNaming({ ...PRODUCTION, CSRM_ATTACHMENT_SCANNER: "virustotal" }, "CSRM_ATTACHMENT_SCANNER");
});

test("ClamAV without a host or a port fails boot naming the missing setting", () => {
  refusesNaming({ ...PRODUCTION, ...CLAMAV, CSRM_CLAMAV_HOST: undefined }, "CSRM_CLAMAV_HOST");
  refusesNaming({ ...PRODUCTION, ...CLAMAV, CSRM_CLAMAV_PORT: "" }, "CSRM_CLAMAV_PORT");
});

test("a ClamAV port outside 1 to 65,535 fails boot", () => {
  for (const port of ["70000", "0", "-1", "3310.5", "33a", "65536"]) refusesNaming({ ...PRODUCTION, ...CLAMAV, CSRM_CLAMAV_PORT: port }, "CSRM_CLAMAV_PORT");
  assert.equal((read({ ...PRODUCTION, ...CLAMAV, CSRM_CLAMAV_PORT: "65535" }).scanner as { port: number }).port, 65_535);
});

test("a ClamAV timeout outside 1,000 to 600,000 ms fails boot", () => {
  for (const timeout of ["10", "999", "600001", "sixty", "1e4"]) refusesNaming({ ...PRODUCTION, ...CLAMAV, CSRM_CLAMAV_TIMEOUT_MS: timeout }, "CSRM_CLAMAV_TIMEOUT_MS");
  assert.equal((read({ ...PRODUCTION, ...CLAMAV, CSRM_CLAMAV_TIMEOUT_MS: "1000" }).scanner as { timeoutMs: number }).timeoutMs, 1_000);
});

test("a local directory inside public/ fails boot, because Strapi serves that folder", () => {
  for (const directory of ["public/uploads", "public", "./public/../public/attachments", path.join(APP_ROOT, "public", "files")]) {
    refusesNaming({ ...DEVELOPMENT, CSRM_ATTACHMENT_LOCAL_DIR: directory }, "CSRM_ATTACHMENT_LOCAL_DIR");
  }
  assert.equal(read({ ...DEVELOPMENT, CSRM_ATTACHMENT_LOCAL_DIR: "public-files" }).available, true);
});

test("the development scanner outside development fails boot", () => {
  refusesNaming({ NODE_ENV: "development", CSRM_ENVIRONMENT: "production", CSRM_ATTACHMENT_SCANNER: "development" }, "CSRM_ATTACHMENT_SCANNER");
  refusesNaming({ NODE_ENV: "production", CSRM_ENVIRONMENT: "development", CSRM_ATTACHMENT_SCANNER: "development" }, "CSRM_ATTACHMENT_SCANNER");
  refusesNaming({ CSRM_ATTACHMENT_SCANNER: "development" }, "CSRM_ATTACHMENT_SCANNER");
});

function fakeStrapi(publicDirectory = PUBLIC_DIRECTORY) {
  const values = new Map<string, unknown>();
  const lines: Array<{ level: string; message: string }> = [];
  return {
    values,
    lines,
    dirs: { app: { root: APP_ROOT }, static: { public: publicDirectory } },
    config: { get: (key: string) => values.get(key), set: (key: string, value: unknown) => void values.set(key, value) },
    log: {
      info: (message: string) => void lines.push({ level: "info", message }),
      warn: (message: string) => void lines.push({ level: "warn", message }),
    },
  };
}

test("assertAttachmentConfiguration stores the configuration and logs one line naming only the kinds", () => {
  const strapi = fakeStrapi();
  assertAttachmentConfiguration(strapi, { ...PRODUCTION, ...S3, ...CLAMAV });
  assert.deepEqual(attachmentConfigOf(strapi), read({ ...PRODUCTION, ...S3, ...CLAMAV }));
  assert.equal(strapi.lines.length, 1);
  assert.equal(strapi.lines[0].level, "info");
  assert.match(strapi.lines[0].message, /s3/);
  assert.match(strapi.lines[0].message, /clamav/);
  for (const secret of ["csrm-attachments-prod", "alias/csrm-attachments", "clamd.internal", "3310"]) {
    assert.equal(strapi.lines[0].message.includes(secret), false, `the line never names ${secret}`);
  }
});

test("assertAttachmentConfiguration says when attachments are unavailable", () => {
  const strapi = fakeStrapi();
  assertAttachmentConfiguration(strapi, { ...PRODUCTION });
  assert.equal(attachmentConfigOf(strapi).available, false);
  assert.equal(strapi.lines.length, 1);
  assert.match(strapi.lines[0].message, /unavailable/i);
});

test("assertAttachmentConfiguration fails boot for the development scanner outside development", () => {
  const strapi = fakeStrapi();
  assert.throws(() => assertAttachmentConfiguration(strapi, { ...PRODUCTION, CSRM_ATTACHMENT_SCANNER: "development" }), AttachmentConfigurationError);
});

test("attachmentConfigOf reads an unconfigured Strapi as unavailable", () => {
  assert.deepEqual(attachmentConfigOf(fakeStrapi()), { storage: null, scanner: null, available: false, unavailableReason: "ATTACHMENTS_NOT_CONFIGURED" });
});

/*
 * IN-209 and WR-705 (the configuration half): an S3 endpoint must be https outside the development key. Plain http would
 * carry every attachment's bytes and every presigned read in cleartext, so it stops the boot like every other invalid
 * S3 setting, naming the setting and never echoing its value. Under the development key a local http store (MinIO, or
 * the tests' fake object store) is still allowed.
 */
test("an http S3 endpoint outside the development key fails boot, naming the setting and never its value (WR-705, IN-209)", () => {
  const endpoint = "http://s3.secret-host.internal:9000";
  for (const runtime of [PRODUCTION, { NODE_ENV: "development", CSRM_ENVIRONMENT: "production" }, { NODE_ENV: "production", CSRM_ENVIRONMENT: "development" }, {}]) {
    for (const value of [endpoint, "HTTP://s3.secret-host.internal:9000"]) {
      assert.throws(() => read({ ...runtime, ...S3, ...CLAMAV, CSRM_ATTACHMENT_S3_ENDPOINT: value }), (error: unknown) => {
        assert.ok(error instanceof AttachmentConfigurationError, `AN_HTTP_ENDPOINT_WAS_ACCEPTED_OUTSIDE_DEVELOPMENT_${JSON.stringify(runtime)}`);
        assert.match(error.message, /CSRM_ATTACHMENT_S3_ENDPOINT/);
        assert.match(error.message, /https/);
        assert.ok(!error.message.includes("secret-host"), "THE_ENDPOINT_WAS_ECHOED");
        return true;
      });
    }
  }
  const strapi = fakeStrapi();
  assert.throws(() => assertAttachmentConfiguration(strapi, { ...PRODUCTION, ...S3, ...CLAMAV, CSRM_ATTACHMENT_S3_ENDPOINT: endpoint }), AttachmentConfigurationError, "THE_BOOT_ACCEPTED_AN_HTTP_ENDPOINT");
});

test("an https S3 endpoint is accepted everywhere, and an http one under the development key (WR-705, IN-209)", () => {
  assert.equal((read({ ...PRODUCTION, ...S3, ...CLAMAV, CSRM_ATTACHMENT_S3_ENDPOINT: "https://s3.example.internal" }).storage as { endpoint: string }).endpoint, "https://s3.example.internal");
  assert.equal((read({ ...DEVELOPMENT, ...S3, CSRM_ATTACHMENT_S3_ENDPOINT: "https://s3.example.internal" }).storage as { endpoint: string }).endpoint, "https://s3.example.internal");
  assert.equal((read({ ...DEVELOPMENT, ...S3, CSRM_ATTACHMENT_S3_ENDPOINT: "http://127.0.0.1:9000" }).storage as { endpoint: string }).endpoint, "http://127.0.0.1:9000", "THE_DEVELOPMENT_HTTP_ENDPOINT_WAS_REFUSED");
});

/*
 * IN-209: the public/ check compares against the folder Strapi actually serves, `strapi.dirs.static.public` (from
 * `server.dirs.public`), not a hard-coded `<appRoot>/public`, and it folds case where the file system does: on Windows
 * and on macOS (darwin), both case-insensitive by default.
 */
test("a local directory inside Strapi's configured static folder fails boot, wherever that folder is (IN-209)", () => {
  const site = path.join(APP_ROOT, "site");
  for (const directory of ["site", "site/attachments", path.join(site, "files")]) {
    refusesNamingWith(() => read({ ...DEVELOPMENT, CSRM_ATTACHMENT_LOCAL_DIR: directory }, site), "CSRM_ATTACHMENT_LOCAL_DIR", `THE_CONFIGURED_STATIC_FOLDER_WAS_NOT_CHECKED_${directory}`);
  }
  assert.equal(read({ ...DEVELOPMENT, CSRM_ATTACHMENT_LOCAL_DIR: "site-private" }, site).available, true);
  const strapi = fakeStrapi(site);
  assert.throws(() => assertAttachmentConfiguration(strapi, { ...DEVELOPMENT, CSRM_ATTACHMENT_LOCAL_DIR: "site/attachments" }), AttachmentConfigurationError, "THE_BOOT_DID_NOT_READ_DIRS_STATIC_PUBLIC");
});

function refusesNamingWith(action: () => unknown, variable: string, message: string): void {
  assert.throws(action, (error: unknown) => {
    assert.ok(error instanceof AttachmentConfigurationError, message);
    assert.match(error.message, new RegExp(variable));
    return true;
  }, message);
}

type IsWithinDirectory = (parent: string, candidate: string, platform?: NodeJS.Platform) => boolean;

test("the public/ comparison folds case on Windows and on macOS, and on Linux compares exactly (IN-209)", () => {
  const isWithinDirectory = (attachmentConfigModule as unknown as Record<string, unknown>).isWithinDirectory as IsWithinDirectory | undefined;
  assert.equal(typeof isWithinDirectory, "function", "NO_PLATFORM_AWARE_PUBLIC_CHECK");
  if (!isWithinDirectory) return;
  assert.equal(isWithinDirectory("/Users/jane/csrm/public", "/Users/jane/csrm/PUBLIC/attachments", "darwin"), true, "DARWIN_IS_CASE_SENSITIVE");
  assert.equal(isWithinDirectory("/Users/jane/csrm/public", "/Users/jane/csrm/Public", "darwin"), true, "DARWIN_IS_CASE_SENSITIVE_AT_THE_FOLDER");
  assert.equal(isWithinDirectory("C:\\csrm\\public", "c:\\CSRM\\PUBLIC\\files", "win32"), true, "WIN32_IS_CASE_SENSITIVE");
  assert.equal(isWithinDirectory("/srv/csrm/public", "/srv/csrm/PUBLIC/attachments", "linux"), false, "LINUX_FOLDED_CASE");
  assert.equal(isWithinDirectory("/srv/csrm/public", "/srv/csrm/public/attachments", "linux"), true, "LINUX_MISSED_THE_FOLDER");
  for (const platform of ["darwin", "linux"] as const) {
    assert.equal(isWithinDirectory("/srv/csrm/public", "/srv/csrm/public-files", platform), false, `A_SIBLING_COUNTED_AS_INSIDE_${platform}`);
    assert.equal(isWithinDirectory("/srv/csrm/public", "/srv/csrm", platform), false, `THE_PARENT_COUNTED_AS_INSIDE_${platform}`);
  }
  assert.equal(isWithinDirectory("C:\\csrm\\public", "C:\\csrm\\public-files", "win32"), false, "A_WIN32_SIBLING_COUNTED_AS_INSIDE");
});
