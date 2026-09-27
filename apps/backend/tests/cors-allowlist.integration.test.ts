import assert from "node:assert/strict";
import test, { after } from "node:test";

import { startAuthorizationHttpHarness } from "./helpers/strapi-http-harness";

/*
 * R-08-11: strapi::cors grants a cross-origin read only to the exact origins CSRM_CORS_ALLOWED_ORIGINS
 * lists. The default, an empty list that grants no origin, is proven in http-hardening.integration.test.ts;
 * this instance boots with a list, written with the spacing and trailing slash an operator might use.
 * A listed origin is trusted with credentials, as Strapi configures CORS, because the one browser client
 * that could need it is an admin panel served from another origin.
 */
const WEB_ORIGIN = "https://web.csrm.test";
const ADMIN_ORIGIN = "https://admin.csrm.test";

const harnessPromise = startAuthorizationHttpHarness({ corsAllowedOrigins: ` ${WEB_ORIGIN}, ${ADMIN_ORIGIN}/ ` });
after(async () => (await harnessPromise).close());

async function contentApiRead(origin: string): Promise<Response> {
  const harness = await harnessPromise;
  return harness.request({ path: "/api/v1/risk_types", identity: harness.identities.analyst, init: { headers: { origin } } });
}

async function accessTokenPreflight(origin: string): Promise<Response> {
  const harness = await harnessPromise;
  return fetch(`${harness.baseUrl}/admin/access-token`, {
    method: "OPTIONS",
    headers: { origin, "access-control-request-method": "POST", "access-control-request-headers": "content-type" },
  });
}

test("a listed origin is granted cross-origin reads of the content API and the admin access-token route", async () => {
  for (const origin of [WEB_ORIGIN, ADMIN_ORIGIN]) {
    const read = await contentApiRead(origin);
    assert.equal(read.status, 200, `LISTED_READ_STATUS_${origin}`);
    assert.equal(read.headers.get("access-control-allow-origin"), origin, `LISTED_READ_NOT_GRANTED_${origin}`);
    assert.equal(read.headers.get("access-control-allow-credentials"), "true", `LISTED_READ_CREDENTIALS_${origin}`);
    assert.match(read.headers.get("vary") ?? "", /\bOrigin\b/i, `LISTED_READ_NOT_VARIED_BY_ORIGIN_${origin}`);

    const preflight = await accessTokenPreflight(origin);
    assert.equal(preflight.status, 204, `LISTED_PREFLIGHT_STATUS_${origin}`);
    assert.equal(preflight.headers.get("access-control-allow-origin"), origin, `LISTED_PREFLIGHT_NOT_GRANTED_${origin}`);
    assert.equal(preflight.headers.get("access-control-allow-credentials"), "true", `LISTED_PREFLIGHT_CREDENTIALS_${origin}`);
    assert.match(preflight.headers.get("access-control-allow-methods") ?? "", /\bPOST\b/, `LISTED_PREFLIGHT_METHODS_${origin}`);
  }
});

test("an origin the list does not name exactly is granted nothing", async () => {
  for (const origin of [
    "https://untrusted.example",
    "http://web.csrm.test",
    "https://web.csrm.test:8443",
    "https://sub.web.csrm.test",
    "https://web.csrm.test.untrusted.example",
    "null",
  ]) {
    const read = await contentApiRead(origin);
    assert.equal(read.status, 200, `UNLISTED_READ_STATUS_${origin}`);
    const preflight = await accessTokenPreflight(origin);
    for (const [label, response] of [["READ", read], ["PREFLIGHT", preflight]] as const) {
      for (const header of ["access-control-allow-origin", "access-control-allow-credentials", "access-control-allow-methods"]) {
        assert.equal(response.headers.get(header), null, `UNLISTED_${label}_GRANTED_${origin}_${header}: ${response.headers.get(header)}`);
      }
    }
  }
});
