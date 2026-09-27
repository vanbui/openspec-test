import assert from "node:assert/strict";
import test from "node:test";

import {
  CORS_ALLOWED_ORIGINS_VARIABLE,
  CorsAllowedOriginsError,
  parseCorsAllowedOrigins,
} from "../src/utils/cors-allowed-origins";

/*
 * R-08-11: the allowlist strapi::cors is configured with (config/middlewares.ts). The mounted proofs
 * are in http-hardening.integration.test.ts (the empty default) and cors-allowlist.integration.test.ts.
 */

test("an unset or empty CSRM_CORS_ALLOWED_ORIGINS grants no origin", () => {
  assert.equal(CORS_ALLOWED_ORIGINS_VARIABLE, "CSRM_CORS_ALLOWED_ORIGINS");
  for (const value of [undefined, "", "   ", ",", " , ,"]) {
    assert.deepEqual(parseCorsAllowedOrigins(value), [], `CORS_DEFAULT_NOT_EMPTY_${JSON.stringify(value)}`);
  }
});

test("listed origins are returned exactly as a browser sends them in Origin", () => {
  assert.deepEqual(
    parseCorsAllowedOrigins(" https://CSRM.Example.com/ ,http://localhost:3000, https://admin.csrm.example.com:443,https://csrm.example.com"),
    ["https://csrm.example.com", "http://localhost:3000", "https://admin.csrm.example.com"],
  );
});

test("a wildcard, null or anything but an exact http or https origin refuses the whole value", () => {
  for (const value of [
    "*",
    "https://*.csrm.example.com",
    "null",
    "csrm.example.com",
    "localhost:3000",
    "https://csrm.example.com/app",
    "https://csrm.example.com?next=1",
    "https://csrm.example.com#top",
    "https://user:secret@csrm.example.com",
    "ftp://csrm.example.com",
    "file:///etc/hosts",
    "https://csrm.example.com, *",
  ]) {
    assert.throws(
      () => parseCorsAllowedOrigins(value),
      (error: unknown) => error instanceof CorsAllowedOriginsError && error.message.startsWith("CSRM_CORS_ALLOWED_ORIGINS entry "),
      `CORS_ENTRY_ADMITTED_${value}`,
    );
  }
});

test("a refused entry is named by its position, never echoed", () => {
  assert.throws(
    () => parseCorsAllowedOrigins("https://csrm.example.com, https://user:secret@csrm.example.com"),
    (error: unknown) => error instanceof CorsAllowedOriginsError
      && error.message.startsWith("CSRM_CORS_ALLOWED_ORIGINS entry 2 ")
      && !error.message.includes("secret"),
  );
});
