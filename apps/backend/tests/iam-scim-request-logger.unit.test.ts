import assert from "node:assert/strict";
import { test } from "node:test";
import type { Core } from "@strapi/strapi";
import requestLogger from "../src/middlewares/scim-request-logger";
import middlewareConfig from "../config/middlewares";

test("SCIM namespace logging delegates only to the safe boundary while other requests retain the installed logger", async () => {
  const seen: string[] = [];
  const configuration = { existing: "setting" };
  const strapi = { middleware: (name: string) => {
    assert.equal(name, "strapi::logger");
    return (config: unknown) => {
      assert.equal(config, configuration);
      return async (context: { path: string }, next: () => Promise<unknown>) => {
        seen.push(context.path);
        await next();
      };
    };
  } } as unknown as Core.Strapi;
  const logger = requestLogger(configuration, { strapi });
  let continued = 0;
  for (const path of ["/scim/v2", "/scim/v2/", "/scim/v2/Users/private-person", "/scim/v2/unknown"]) {
    await logger({ path } as Parameters<typeof logger>[0], async () => { continued++; });
  }
  assert.equal(continued, 4);
  assert.deepEqual(seen, []);
  for (const path of ["/api/v1/me/access", "/scim/v20/Users", "/api/scim/v2/Users", "/health"]) {
    await logger({ path } as Parameters<typeof logger>[0], async () => { continued++; });
  }
  assert.equal(continued, 8);
  assert.deepEqual(seen, ["/api/v1/me/access", "/scim/v20/Users", "/api/scim/v2/Users", "/health"]);
  const env = ((_: string, fallback: unknown) => fallback) as Core.Config.Shared.ConfigParams["env"];
  assert.equal(middlewareConfig({ env })[0], "global::scim-request-logger");
});

test("request logger fails startup closed when the installed logger is unavailable", () => {
  const strapi = { middleware: () => () => undefined } as unknown as Core.Strapi;
  assert.throws(() => requestLogger({}, { strapi }), /installed request logger is required/);
});
