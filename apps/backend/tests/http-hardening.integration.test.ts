import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test, { after } from "node:test";

import { INTERNAL_ERROR_HEADER, startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * Phase 8 D-20 and D-39: Strapi answers an internal error with the bare 500
 * envelope and nothing else, sends helmet's headers on every response, and no
 * longer names its framework. The forced error comes from the harness's
 * test-only middleware (D-38); assessment-workflow.integration.test.ts proves
 * the same envelope from an injected write failure inside a production handler.
 */

const harnessPromise = startAuthorizationHttpHarness({ internalErrorMiddleware: true });
after(async () => (await harnessPromise).close());

/** The envelope @strapi/core formats for any error that is not an ApplicationError or an exposable HttpError. */
const BARE_500_ENVELOPE = Object.freeze({
  data: null,
  error: { status: 500, name: "InternalServerError", message: "Internal Server Error" },
});
const INTERNALS = /injected|SQL|at .*\.js:\d+/;

async function analystRead(path: string, headers: Record<string, string> = {}): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path, identity: harness.identities.analyst, init: { headers } });
}

function assertNoStackKey(value: unknown, at = "body"): void {
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertNoStackKey(entry, `${at}[${index}]`));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, entry] of Object.entries(value)) {
      assert.notEqual(key.toLowerCase(), "stack", `STACK_KEY_AT_${at}.${key}`);
      assertNoStackKey(entry, `${at}.${key}`);
    }
  }
}

test("the internal-error sentinel exists only in the test harness, never in application source", () => {
  // D-38: the forced failure is test plumbing. Pinning the header name keeps this scan honest if the constant moves.
  assert.equal(INTERNAL_ERROR_HEADER, "x-csrm-test-internal-error", "INTERNAL_ERROR_SENTINEL_RENAMED");
  // Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
  const sourceDir = path.resolve(__dirname, "..", "..", "..", "src");
  const offenders = readdirSync(sourceDir, { recursive: true, encoding: "utf8" })
    .map((entry) => path.join(sourceDir, entry))
    .filter((file) => statSync(file).isFile() && readFileSync(file, "utf8").includes(INTERNAL_ERROR_HEADER));
  assert.deepEqual(offenders, [], "TEST_ONLY_MIDDLEWARE_IN_APPLICATION_SOURCE");
});

test("a forced internal error answers the bare 500 envelope with no stack and no internal message", async () => {
  const failed = await analystRead("/api/v1/risk_types", { [INTERNAL_ERROR_HEADER]: "1" });
  assert.equal(failed.status, 500, "FORCED_ERROR_NOT_500");
  assert.match(failed.headers.get("content-type") ?? "", /^application\/json/, "FORCED_ERROR_NOT_JSON");
  const text = await failed.text();
  const body: unknown = JSON.parse(text);
  assert.deepEqual(body, BARE_500_ENVELOPE, "FORCED_ERROR_ENVELOPE_NOT_BARE");
  assertNoStackKey(body);
  assert.doesNotMatch(text, /stack/i, "FORCED_ERROR_STACK_LEAKED");
  assert.doesNotMatch(text, INTERNALS, "FORCED_ERROR_INTERNALS_LEAKED");

  // Without the sentinel header the middleware is inert and the route answers normally.
  const healthy = await analystRead("/api/v1/risk_types");
  assert.equal(healthy.status, 200, "INTERNAL_ERROR_MIDDLEWARE_NOT_INERT");
});

test("a production error path answers the same bare envelope without test-only plumbing", async () => {
  // The email plugin's provider throws on an empty options object (the matrix records the 500);
  // the envelope it reaches the client in is Strapi's own, identical to the forced one.
  const harness = await harnessPromise;
  const failed = await harness.request({
    path: "/api/email",
    identity: harness.identities.analyst,
    init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({}) },
  });
  assert.equal(failed.status, 500, "EMAIL_PROVIDER_FAILURE_NOT_500");
  const text = await failed.text();
  assert.deepEqual(JSON.parse(text), BARE_500_ENVELOPE, "EMAIL_PROVIDER_ENVELOPE_NOT_BARE");
  assert.doesNotMatch(text, /stack|sendmail|spawn|ENOENT/i, "EMAIL_PROVIDER_INTERNALS_LEAKED");
});

test("every response carries helmet's headers and never X-Powered-By", async () => {
  const harness = await harnessPromise;
  const responses: Array<[label: string, response: Response]> = [
    ["200", await analystRead("/api/v1/risk_types")],
    ["403", await harness.request({ path: "/api/v1/risk_types" })],
    ["500", await analystRead("/api/v1/risk_types", { [INTERNAL_ERROR_HEADER]: "1" })],
  ];
  for (const [label, response] of responses) {
    assert.equal(response.status, Number(label), `HEADER_PROBE_STATUS_${label}`);
    // D-39: strapi::poweredBy is removed from the middleware configuration (ASVS V14.3.3).
    assert.equal(response.headers.get("x-powered-by"), null, `X_POWERED_BY_SENT_${label}`);
    // strapi::security keeps koa-helmet's defaults, each documented in docs/security/strapi-http-hardening.md.
    assert.equal(response.headers.get("x-frame-options"), "SAMEORIGIN", `X_FRAME_OPTIONS_${label}`);
    assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000; includeSubDomains", `HSTS_${label}`);
    assert.equal(response.headers.get("x-content-type-options"), "nosniff", `X_CONTENT_TYPE_OPTIONS_${label}`);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer", `REFERRER_POLICY_${label}`);
    const csp = response.headers.get("content-security-policy") ?? "";
    assert.match(csp, /(^|;)default-src 'self'(;|$)/, `CSP_DEFAULT_SRC_${label}: ${csp}`);
    assert.match(csp, /frame-ancestors 'self'/, `CSP_FRAME_ANCESTORS_${label}`);
    assert.doesNotMatch(csp, /upgrade-insecure-requests/, `CSP_UPGRADE_INSECURE_REQUESTS_${label}`);
    // Deliberately off in Strapi's defaults, and documented as such.
    for (const header of ["cross-origin-opener-policy", "cross-origin-embedder-policy", "cross-origin-resource-policy", "origin-agent-cluster", "x-xss-protection"]) {
      assert.equal(response.headers.get(header), null, `UNEXPECTED_HEADER_${header}_${label}`);
    }
  }
});

/*
 * R-08-11: no browser needs cross-origin access to Strapi. The web calls it server-side and the admin
 * panel is served from Strapi's own origin, so strapi::cors grants no origin unless configuration lists
 * it (CSRM_CORS_ALLOWED_ORIGINS, empty by default and in this harness). CORS never stops the server
 * answering; it decides whether a browser lets a foreign page read the answer. The admin access-token
 * route matters most: it answers a fresh admin access token to anyone presenting the refresh cookie.
 * The allowlisted case is proven in cors-allowlist.integration.test.ts.
 */
const FOREIGN_ORIGIN = "https://untrusted.example";
const CORS_GRANT_HEADERS = [
  "access-control-allow-origin",
  "access-control-allow-credentials",
  "access-control-allow-methods",
  "access-control-allow-headers",
] as const;

function assertNoCorsGrant(response: Response, tag: string): void {
  for (const header of CORS_GRANT_HEADERS) {
    assert.equal(response.headers.get(header), null, `CORS_GRANTED_${tag}_${header}: ${response.headers.get(header)}`);
  }
}

test("a foreign origin is granted no cross-origin read of the content API or the admin access-token route", async () => {
  const harness = await harnessPromise;
  const contentApi = await analystRead("/api/v1/risk_types", { origin: FOREIGN_ORIGIN });
  assert.equal(contentApi.status, 200, "CORS_CONTENT_API_NOT_ANSWERED");
  assertNoCorsGrant(contentApi, "CONTENT_API");

  // No refresh cookie here, so the route refuses; what matters is that a foreign page could never read an answer.
  const accessToken = await harness.request({
    path: "/admin/access-token",
    omitApiToken: true,
    init: { method: "POST", headers: { origin: FOREIGN_ORIGIN } },
  });
  assert.equal(accessToken.status, 401, "CORS_ADMIN_ACCESS_TOKEN_NOT_ANSWERED");
  assertNoCorsGrant(accessToken, "ADMIN_ACCESS_TOKEN");

  // Nothing is granted to a preflight either, so a browser never sends the credentialed request.
  for (const [label, path] of [["CONTENT_API", "/api/csrm-assessment-requests"], ["ADMIN_ACCESS_TOKEN", "/admin/access-token"]] as const) {
    const preflight = await fetch(`${harness.baseUrl}${path}`, {
      method: "OPTIONS",
      headers: { origin: FOREIGN_ORIGIN, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
    });
    assertNoCorsGrant(preflight, `${label}_PREFLIGHT`);
  }
});

test("the admin panel's same-origin requests are answered exactly as before", async () => {
  // The admin panel's browser sends its own origin on a POST, and a same-origin read needs no CORS grant.
  const harness = await harnessPromise;
  for (const [label, path, method] of [
    ["ADMIN_INIT", "/admin/init", "GET"],
    ["ADMIN_ACCESS_TOKEN", "/admin/access-token", "POST"],
  ] as const) {
    const withoutOrigin = await harness.request({ path, omitApiToken: true, init: { method } });
    const sameOrigin = await harness.request({ path, omitApiToken: true, init: { method, headers: { origin: harness.baseUrl } } });
    assert.equal(sameOrigin.status, withoutOrigin.status, `SAME_ORIGIN_STATUS_CHANGED_${label}`);
    assert.deepEqual(await sameOrigin.json(), await withoutOrigin.json(), `SAME_ORIGIN_BODY_CHANGED_${label}`);
  }
});

/*
 * 14-04 (D-06, D-07; ROADMAP success criterion 2): attachment bytes are kept privately through one storage port, under
 * a generated key, byte for byte, and nothing serves them: not /uploads/, which serves public/, and not the private
 * provider's own /csrm-private/ URL, which no middleware routes. The provider itself is unit-tested in
 * attachment-storage.unit.test.ts.
 */
// Tests compile into `.tmp/tests-dist/tests`; three parents resolve apps/backend.
const strapiDir = path.resolve(__dirname, "..", "..", "..");
const attachmentFixture = (name: string) => readFileSync(path.join(strapiDir, "tests", "fixtures", "attachments", name));
const STORAGE_KEY = /^csrm_[0-9a-f]{32}$/;

function filesUnder(directory: string): string[] {
  return existsSync(directory) ? readdirSync(directory, { recursive: true, encoding: "utf8" }) : [];
}

test("the storage port keeps PNG and JPEG bytes privately under a generated key and returns them unchanged", async () => {
  const harness = await harnessPromise;
  const storage = harness.attachmentStorage();
  const publicUploads = path.join(strapiDir, "public", "uploads");
  const publicBefore = filesUnder(publicUploads);
  for (const [type, name, ext] of [["png", "diagram.png", ".png"], ["jpeg", "photo.jpg", ".jpg"]] as const) {
    const bytes = attachmentFixture(name);
    const stored = await storage.put(bytes, { type });
    assert.match(stored.hash, STORAGE_KEY, `STORAGE_KEY_NOT_GENERATED_${type}`);
    assert.equal(stored.ext, ext, `STORAGE_EXTENSION_${type}`);
    assert.ok(Buffer.from(await storage.read(stored.fileId)).equals(bytes), `STORAGE_BYTES_CHANGED_${type}`);

    const record = await harness.findUploadFileRecord(stored.fileId);
    assert.ok(record, `UPLOAD_FILE_RECORD_MISSING_${type}`);
    assert.equal(record.provider, "local", `UPLOAD_FILE_PROVIDER_${type}`);
    assert.equal(record.name, `${stored.hash}${ext}`, `UPLOAD_FILE_NAME_NOT_THE_KEY_${type}`);
    assert.equal(record.hash, stored.hash, `UPLOAD_FILE_HASH_${type}`);
    // The file content type has no sizeInBytes attribute; `size` is the plugin's kilobytes, two decimals.
    assert.equal(Number(record.size), Math.round((bytes.length / 1000) * 100) / 100, `UPLOAD_FILE_SIZE_${type}`);
    assert.equal(record.formats ?? null, null, `UPLOAD_FILE_DERIVED_FORMATS_${type}`);

    const kept = path.join(harness.attachmentStorageDirectory(), `${stored.hash}${ext}`);
    assert.ok(readFileSync(kept).equals(bytes), `STORAGE_FILE_NOT_IN_PRIVATE_DIRECTORY_${type}`);
  }
  assert.deepEqual(filesUnder(publicUploads), publicBefore, "ATTACHMENT_WRITTEN_UNDER_PUBLIC_UPLOADS");
  const fromPublic = path.relative(path.join(strapiDir, "public"), harness.attachmentStorageDirectory());
  assert.ok(fromPublic.startsWith("..") || path.isAbsolute(fromPublic), "PRIVATE_DIRECTORY_INSIDE_PUBLIC");
});

test("nothing serves a stored attachment: /uploads/ and /csrm-private/ answer 404 with none of its bytes, and remove deletes it", async () => {
  const harness = await harnessPromise;
  const storage = harness.attachmentStorage();
  const bytes = attachmentFixture("diagram.png");
  const stored = await storage.put(bytes, { type: "png" });
  const key = `${stored.hash}${stored.ext}`;
  for (const servedPath of [`/uploads/${key}`, `/csrm-private/${key}`, `/api/csrm-private/${key}`]) {
    for (const omitApiToken of [false, true]) {
      const response = await harness.request({ path: servedPath, identity: harness.identities.analyst, omitApiToken });
      const body = Buffer.from(await response.arrayBuffer());
      assert.equal(response.status, 404, `ATTACHMENT_SERVED_${servedPath}_${omitApiToken ? "NO_TOKEN" : "TOKEN"}`);
      assert.equal(body.indexOf(bytes.subarray(0, 64)), -1, `ATTACHMENT_BYTES_IN_RESPONSE_${servedPath}`);
    }
  }

  await storage.remove(stored.fileId);
  assert.equal(existsSync(path.join(harness.attachmentStorageDirectory(), key)), false, "REMOVE_LEFT_THE_FILE");
  assert.equal(await harness.findUploadFileRecord(stored.fileId), null, "REMOVE_LEFT_THE_RECORD");
});

/*
 * 14-04 (D-08; R-08-02): with private files in the upload plugin, its content-API routes would let the full-access
 * token holder list their metadata, upload unscanned files or delete them, so the application unmounts all five for
 * every caller. An unmounted /api path answers a GET with 404 and a mutation with 405 (strapi-http-hardening.md,
 * "Unmounted paths"). The admin panel's own upload routes are a separate router and stay (served-operations test).
 */
const UPLOAD_CONTENT_API_PROBES = [
  { method: "GET", path: "/api/upload/files", status: 404 },
  { method: "GET", path: "/api/upload/files/page", status: 404 },
  { method: "GET", path: "/api/upload/files/1", status: 404 },
  { method: "POST", path: "/api/upload", status: 405 },
  { method: "DELETE", path: "/api/upload/files/1", status: 405 },
] as const;

test("the upload plugin's content-API routes are unmounted for every caller, the full-access token included", async () => {
  const harness = await harnessPromise;
  const before = await harness.countUploadFileRecords();
  const callers: Array<[label: string, caller: { identity?: string; omitApiToken?: boolean }]> = [
    ["TOKEN", {}],
    ["OWNER", { identity: harness.identities.owner }],
    ["OTHER", { identity: harness.identities.otherRequestor }],
    ["ANALYST", { identity: harness.identities.analyst }],
    ["SERVICE_AGENT", { identity: harness.identities.serviceAnalystAgent }],
    ["NO_TOKEN", { identity: harness.identities.analyst, omitApiToken: true }],
  ];
  for (const probe of UPLOAD_CONTENT_API_PROBES) {
    for (const [label, caller] of callers) {
      const init: RequestInit = probe.method === "POST" ? { method: "POST", body: new FormData() } : { method: probe.method };
      const response = await harness.request({ path: probe.path, ...caller, init });
      const text = await response.text();
      assert.equal(response.status, probe.status, `UPLOAD_CONTENT_API_MOUNTED_${probe.method}_${probe.path}_${label}: ${text.slice(0, 200)}`);
    }
  }
  assert.equal(await harness.countUploadFileRecords(), before, "UPLOAD_FILE_RECORDS_CHANGED");
});

/*
 * 14-RESEARCH Pitfalls 2 and 3 (D-11, D-25, T-14-16): strapi::body removes only the temporary file of a part named
 * `files`, and never when a later middleware throws; a route's own middlewares never run for a refused caller. The
 * global csrm-multipart-cleanup middleware removes every part's temporary file after every request.
 */
const PROBE_PART_BYTES = 777_777;

function temporaryProbeFiles(since: number): string[] {
  const directory = os.tmpdir();
  return readdirSync(directory).filter((name) => {
    try {
      const stats = statSync(path.join(directory, name));
      return stats.isFile() && stats.size === PROBE_PART_BYTES && stats.mtimeMs >= since;
    } catch {
      return false;
    }
  });
}

/*
 * WR-304: the probes cover both outcomes. Three are refused (the unmounted upload routes under both part names, and a CSV
 * import the policy refuses before its route runs), and one is accepted: Jane adds a probe-sized text file to a fresh
 * draft of hers through the attachment upload, 201. Each answers its own expected status, and no temporary file of the
 * probe's size survives any of them.
 */
test("no multipart temporary file survives a request, whatever the part name and whether the caller was refused or the upload accepted (WR-304)", async () => {
  const harness = await harnessPromise;
  const since = Date.now() - 1_000;
  const part = (name: string, filename: string, type: string, bytes: Uint8Array = randomBytes(PROBE_PART_BYTES)) => {
    const form = new FormData();
    form.set(name, new File([bytes], filename, { type }));
    return form;
  };
  const draft = await harness.createAssessmentRequestFixture({ requestNumber: "HARDEN-PROBE-001", title: "Temporary file probe", requestStatus: "draft", requestor: "owner" });
  // Text the content check accepts, exactly the probe's size.
  const acceptedText = Buffer.alloc(PROBE_PART_BYTES, "Probe line for the temporary file check.\n", "utf8");
  const probes: Array<[label: string, path: string, form: FormData, status: number, identity?: string]> = [
    ["UPLOAD_FILE_PART", "/api/upload", part("file", "probe.bin", "application/octet-stream"), 405],
    ["UPLOAD_FILES_PART", "/api/upload", part("files", "probe.bin", "application/octet-stream"), 405],
    // No identity: the policy refuses the import before its route runs.
    ["REFUSED_CSV_IMPORT", "/api/v1/risk_types/import/preview", part("file", "probe.csv", "text/csv"), 403],
    ["ACCEPTED_ATTACHMENT", `/api/v1/assessment_requests/${encodeURIComponent(draft)}/attachments`, part("file", "probe.txt", "text/plain", acceptedText), 201, harness.identities.owner],
  ];
  for (const [label, requestPath, form, status, identity] of probes) {
    const response = await harness.request({ path: requestPath, ...(identity ? { identity } : {}), init: { method: "POST", body: form } });
    const text = await response.text();
    assert.equal(response.status, status, `MULTIPART_PROBE_${label}_UNEXPECTED_STATUS: ${text.slice(0, 200)}`);
    assert.deepEqual(temporaryProbeFiles(since), [], `MULTIPART_TEMPORARY_FILE_LEFT_${label}`);
  }
});
