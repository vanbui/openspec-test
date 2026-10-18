import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * WR-306 (D-15): the harness's cleared variables stay cleared. Strapi's configuration module runs
 * `dotenv.config({ path: process.env.ENV_PATH })` when the harness first requires it, and dotenv fills every key that
 * is unset. A key the harness deleted would come back from the developer's file; a key the harness sets to "" stays
 * "", because dotenv never overrides an existing key.
 *
 * This file never reads the developer's file. It points ENV_PATH at a scratch file of its own, holding a sentinel for
 * every key the harness clears and for the three it pins, and a canary key the harness never touches. The canary
 * proves dotenv read the scratch file after the harness cleared its keys, so the test cannot pass because dotenv ran
 * earlier (each test file runs in its own process, and nothing it imports loads Strapi's configuration).
 */

const SENTINEL = "csrm-harness-sentinel-wr306";
const CANARY = "CSRM_HARNESS_ENVIRONMENT_CANARY";

/** The keys a default (local storage, development scanner) harness boot clears. */
const CLEARED = [
  "CSRM_ATTACHMENT_S3_BUCKET",
  "CSRM_ATTACHMENT_S3_REGION",
  "CSRM_ATTACHMENT_S3_KMS_KEY_ID",
  "CSRM_ATTACHMENT_S3_ENDPOINT",
  "CSRM_CLAMAV_HOST",
  "CSRM_CLAMAV_PORT",
  "CSRM_CLAMAV_TIMEOUT_MS",
  "AWS_ACCESS_KEY_ID",
  "AWS_SECRET_ACCESS_KEY",
  "AWS_SESSION_TOKEN",
  "AWS_REGION",
  "AWS_PROFILE",
  "AWS_ENDPOINT_URL",
  "AWS_ENDPOINT_URL_S3",
  "AWS_EC2_METADATA_DISABLED",
  "CSRM_DEV_API_TOKEN",
] as const;

/** The keys the same boot pins, with the value it pins. */
const PINNED = {
  CSRM_ATTACHMENT_STORAGE: "local",
  CSRM_ATTACHMENT_SCANNER: "development",
} as const;

const scratchDirectory = mkdtempSync(path.join(os.tmpdir(), "csrm-harness-environment-"));
const scratchEnvironmentFile = path.join(scratchDirectory, "sentinel.env");
writeFileSync(
  scratchEnvironmentFile,
  [...CLEARED, ...Object.keys(PINNED), "CSRM_ATTACHMENT_LOCAL_DIR"].map((name) => `${name}=${SENTINEL}`).concat(`${CANARY}=loaded`).join("\n") + "\n",
);
const previousEnvPath = process.env.ENV_PATH;
const before = new Map([...CLEARED, ...Object.keys(PINNED), "CSRM_ATTACHMENT_LOCAL_DIR"].map((name) => [name, process.env[name]] as const));
assert.equal(process.env[CANARY], undefined, "THE_CANARY_IS_ALREADY_SET");
process.env.ENV_PATH = scratchEnvironmentFile;

const harnessPromise = startAuthorizationHttpHarness();
let closed = false;
async function closeOnce(): Promise<void> {
  if (closed) return;
  closed = true;
  await (await harnessPromise).close();
}
after(async () => {
  try {
    await closeOnce();
  } finally {
    if (previousEnvPath === undefined) delete process.env.ENV_PATH;
    else process.env.ENV_PATH = previousEnvPath;
    delete process.env[CANARY];
    rmSync(scratchDirectory, { recursive: true, force: true });
  }
});

test("a key the harness clears stays empty after boot, even when Strapi's dotenv reads a file that sets it (WR-306)", async () => {
  const harness = await harnessPromise;
  assert.equal(process.env[CANARY], "loaded", "DOTENV_DID_NOT_READ_THE_SCRATCH_FILE_AFTER_THE_HARNESS_CLEARED_ITS_KEYS");
  const refilled = CLEARED.filter((name) => (process.env[name] ?? "") !== "");
  assert.deepEqual(refilled, [], `A_CLEARED_KEY_WAS_REFILLED: ${refilled.map((name) => `${name}=${process.env[name]}`).join(", ")}`);
  for (const [name, value] of Object.entries(PINNED)) assert.equal(process.env[name], value, `${name}_IS_NOT_PINNED`);
  assert.equal(process.env.CSRM_ATTACHMENT_LOCAL_DIR, harness.attachmentStorageDirectory(), "THE_STORAGE_DIRECTORY_IS_NOT_PINNED");
  assert.notEqual(process.env.CSRM_ATTACHMENT_LOCAL_DIR, SENTINEL);
});

test("closing the harness restores every key it cleared or pinned (WR-306)", async () => {
  await harnessPromise;
  await closeOnce();
  for (const [name, value] of before) assert.equal(process.env[name], value, `${name}_WAS_NOT_RESTORED`);
});
