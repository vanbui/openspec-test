import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import test, { after } from "node:test";

import { attachmentsPath, captureSecurityEvents } from "./helpers/attachment-http";
import { startFakeObjectStore } from "./helpers/fake-object-store";
import { HARNESS_S3_ACCESS_KEY_ID, startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * 14-04 (D-06, G-7; ROADMAP success criterion 2): production attachments live in S3 through the official
 * @strapi/provider-upload-aws-s3, configured private. Proven on a mounted Strapi against a local fake object store; no
 * real AWS endpoint is contacted (the harness gives the SDK dummy credentials and points it at 127.0.0.1).
 *
 * - put sends no ACL header and asks for SSE-KMS with the configured key, under csrm/attachments/{key};
 * - read fetches a presigned GET server-side, and neither returns nor logs its URL;
 * - remove deletes the object and the plugin's file record.
 *
 * Files stay under 5 MiB, so the SDK never switches to multipart (14-RESEARCH Pitfall 6); the 25 MiB path is proven
 * on the local provider.
 */

const BUCKET = "csrm-attachments-test";
const KMS_KEY_ID = "alias/csrm-attachments-test";
const STORAGE_KEY = /^csrm_[0-9a-f]{32}$/;

const storePromise = startFakeObjectStore();
const harnessPromise = storePromise.then((store) => startAuthorizationHttpHarness({
  attachmentStorage: { kind: "s3", endpoint: store.endpoint, bucket: BUCKET, kmsKeyId: KMS_KEY_ID },
}));
after(async () => {
  const store = await storePromise;
  try {
    await (await harnessPromise).close();
  } finally {
    // Even when the boot failed, so the open listener never keeps the test process alive.
    await store.close();
  }
});

/** Everything the process writes to stdout and stderr while `action` runs: where Strapi's logger writes. */
async function captureOutput<T>(action: () => Promise<T>): Promise<{ result: T; output: string }> {
  const written: string[] = [];
  const originals = [process.stdout.write, process.stderr.write] as const;
  const capture = (original: typeof process.stdout.write) => function (this: NodeJS.WriteStream, chunk: unknown, ...rest: unknown[]) {
    written.push(typeof chunk === "string" ? chunk : Buffer.from(chunk as Uint8Array).toString("utf8"));
    return (original as (...args: unknown[]) => boolean).call(this, chunk, ...rest);
  } as typeof process.stdout.write;
  process.stdout.write = capture(originals[0]);
  process.stderr.write = capture(originals[1]);
  try {
    const result = await action();
    return { result, output: written.join("") };
  } finally {
    process.stdout.write = originals[0];
    process.stderr.write = originals[1];
  }
}

test("a 2 MiB PDF is kept privately in S3: no ACL, SSE-KMS, a presigned server-side read, and a delete on remove", async () => {
  const harness = await harnessPromise;
  const store = await storePromise;
  const storage = harness.attachmentStorage();
  const bytes = Buffer.concat([Buffer.from("%PDF-1.7\n"), randomBytes(2 * 1024 * 1024)]);

  const stored = await storage.put(bytes, { type: "pdf" });
  assert.match(stored.hash, STORAGE_KEY, "S3_KEY_NOT_GENERATED");
  assert.equal(stored.ext, ".pdf", "S3_EXTENSION");
  const objectKey = `${BUCKET}/csrm/attachments/${stored.hash}.pdf`;
  assert.ok(store.objects.get(objectKey)?.equals(bytes), "S3_OBJECT_NOT_STORED_BYTE_FOR_BYTE");

  const record = await harness.findUploadFileRecord(stored.fileId);
  assert.ok(record, "S3_FILE_RECORD_MISSING");
  assert.equal(record.provider, "aws-s3", "S3_FILE_RECORD_PROVIDER");
  assert.equal(record.name, `${stored.hash}.pdf`, "S3_FILE_RECORD_NAME_NOT_THE_KEY");

  const puts = store.requests.filter((request) => request.method === "PUT");
  assert.equal(puts.length, 1, `S3_PUT_COUNT_${puts.length}`);
  const [put] = puts;
  assert.equal(put?.path, `/${objectKey}`, "S3_PUT_PATH");
  assert.equal(put?.headers["x-amz-acl"], undefined, "S3_ACL_HEADER_SENT");
  assert.equal(put?.headers["x-amz-server-side-encryption"], "aws:kms", "S3_SSE_NOT_KMS");
  assert.equal(put?.headers["x-amz-server-side-encryption-aws-kms-key-id"], KMS_KEY_ID, "S3_SSE_KMS_KEY");

  const { result: read, output } = await captureOutput(() => storage.read(stored.fileId));
  assert.ok(Buffer.isBuffer(read) && read.equals(bytes), "S3_READ_BYTES_CHANGED");
  const gets = store.requests.filter((request) => request.method === "GET");
  assert.equal(gets.length, 1, `S3_GET_COUNT_${gets.length}`);
  assert.equal(gets[0]?.presigned, true, "S3_GET_NOT_PRESIGNED");
  assert.equal(gets[0]?.path, `/${objectKey}`, "S3_GET_PATH");
  assert.equal(gets[0]?.status, 200, "S3_GET_STATUS");
  // IN-301 (D-06): the short expiry is the one signed on the wire, and the URL is signed with the harness's dummy key.
  const expires = Number(gets[0]?.expires);
  assert.ok(Number.isInteger(expires) && expires > 0 && expires <= 60, `S3_PRESIGNED_EXPIRY_NOT_SHORT: ${gets[0]?.expires}`);
  assert.ok(gets[0]?.credential?.startsWith(`${HARNESS_S3_ACCESS_KEY_ID}/`), "S3_PRESIGNED_CREDENTIAL_NOT_THE_HARNESS_KEY");
  assert.doesNotMatch(output, /X-Amz-Signature|X-Amz-Credential/i, "S3_SIGNED_URL_LOGGED");
  assert.ok(!output.includes(store.endpoint), "S3_ENDPOINT_LOGGED");

  await storage.remove(stored.fileId);
  const deletes = store.requests.filter((request) => request.method === "DELETE");
  assert.equal(deletes.length, 1, `S3_DELETE_COUNT_${deletes.length}`);
  assert.equal(deletes[0]?.path, `/${objectKey}`, "S3_DELETE_PATH");
  assert.equal(store.objects.has(objectKey), false, "S3_OBJECT_LEFT");
  assert.equal(await harness.findUploadFileRecord(stored.fileId), null, "S3_FILE_RECORD_LEFT");
});

test("an S3 boot keeps the upload plugin's content-API routes unmounted and serves nothing under /uploads/", async () => {
  const harness = await harnessPromise;
  const storage = harness.attachmentStorage();
  const stored = await storage.put(Buffer.from("csrm,storage\n1,2\n"), { type: "csv" });
  for (const [requestPath, status] of [["/api/upload/files", 404], [`/uploads/${stored.hash}${stored.ext}`, 404]] as const) {
    const response = await harness.request({ path: requestPath, identity: harness.identities.analyst });
    await response.arrayBuffer();
    assert.equal(response.status, status, `S3_BOOT_SERVED_${requestPath}`);
  }
  await storage.remove(stored.fileId);
});

/*
 * IN-307 (D-23, D-37): the digest check holds on the S3 read path too. A seeded file's object is altered in the store;
 * Jane's download of it is 409 ATTACHMENT_INTEGRITY_FAILED with no byte of either version, after one warning-level
 * attachment.integrity_failed line carrying the recorded digest and one attachment.refused line, and no name logged.
 */
test("an object altered in the store is refused at the download with ATTACHMENT_INTEGRITY_FAILED, no byte of either version, and a warning-level integrity event (D-23, D-37, IN-307)", async () => {
  const harness = await harnessPromise;
  const store = await storePromise;
  const requestId = await harness.createAssessmentRequestFixture({ requestNumber: "S3-TAMPER-001", title: "S3 tamper probe", requestStatus: "draft", requestor: "owner" });
  const [attachmentId] = await harness.seedRequestAttachments(requestId, 1);
  const [record] = await harness.listRequestAttachments(requestId);
  const file = await harness.findUploadFileRecord(record?.fileId as number);
  assert.ok(file && typeof file.hash === "string" && typeof file.ext === "string", "S3_TAMPER_NO_FILE_RECORD");
  const objectKey = `${BUCKET}/csrm/attachments/${file.hash}${file.ext}`;
  const original = store.objects.get(objectKey);
  assert.ok(original, "S3_TAMPER_NO_OBJECT");
  const tampered = Buffer.from("Seeded attachment altered in the bucket, not by CSRM.", "utf8");
  store.objects.set(objectKey, tampered);

  const { result, events } = await captureSecurityEvents(async () => {
    const response = await harness.request({ path: `${attachmentsPath(requestId)}/${encodeURIComponent(String(attachmentId))}/content`, identity: harness.identities.owner });
    const body = Buffer.from(await response.arrayBuffer());
    assert.equal(body.includes(tampered.subarray(0, 32)), false, "S3_TAMPERED_BYTES_SENT");
    assert.equal(body.includes(original.subarray(0, 24)), false, "S3_ORIGINAL_BYTES_SENT");
    return { status: response.status, reason: (JSON.parse(body.toString("utf8")) as { error?: { details?: { reason?: unknown } } }).error?.details?.reason };
  });
  assert.deepEqual(result, { status: 409, reason: "ATTACHMENT_INTEGRITY_FAILED" }, "S3_TAMPER_NOT_REFUSED");
  assert.deepEqual(events.map((entry) => [entry.event.event, entry.level, entry.event.attachmentId, entry.event.outcome, entry.event.reason]), [
    ["attachment.integrity_failed", "warn", attachmentId, "refused", "ATTACHMENT_INTEGRITY_FAILED"],
    ["attachment.refused", "info", attachmentId, "refused", "ATTACHMENT_INTEGRITY_FAILED"],
  ], `S3_TAMPER_EVENTS_${events.map((entry) => entry.line).join(" | ")}`);
  assert.equal(events[0]?.event.sha256, record?.sha256, "S3_TAMPER_EVENT_NOT_THE_RECORDED_DIGEST");
  assert.ok(events.every((entry) => !entry.line.includes("seeded-1.txt")), "S3_TAMPER_FILE_NAME_LOGGED");
});
