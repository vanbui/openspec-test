import assert from "node:assert/strict";
import { readdirSync, readFileSync, statSync } from "node:fs";
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
